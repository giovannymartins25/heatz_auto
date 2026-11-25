import { useEffect, useRef, memo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { WorldMap } from '@/systems/world/WorldMap'
import type { RoadArc, RoadSegment, WorldObstacle } from '@/systems/world/WorldGeometry'
import {
  AsphaltGuidanceTracker,
  type AsphaltExitArrow,
  type WorldGeometryData,
} from '@/systems/world/asphaltGuidance'
import type { VehicleConfig } from '@/types/vehicle'
import { resolveVehicleVisual2D } from '@/systems/vehicle/vehicleResolvers'

interface DrivingWorldCanvasProps {
  vehicle?: VehicleConfig
  className?: string
  cameraMode?: 'follow' | 'north_up'
  zoomScale?: number // pixels por metro
  /** Quando true, enquadra o mapa completo do mundo 2D com rótulos de setor e marcador GPS destacado */
  overviewMode?: boolean
}

interface SkidMark {
  x: number
  y: number
  opacity: number
}

interface SmokeParticle {
  x: number
  y: number
  radius: number
  opacity: number
  vx: number
  vy: number
  life: number
}

function toCanvasArcAngles(arc: RoadArc): { start: number; end: number; anticlockwise: boolean } {
  if (arc.fullCircle) {
    return { start: 0, end: Math.PI * 2, anticlockwise: false }
  }
  return {
    start: -arc.startAngle,
    end: -arc.endAngle,
    anticlockwise: true,
  }
}

function formatAsphaltArrowGlyph(arrow: AsphaltExitArrow): string {
  switch (arrow) {
    case 'left':
      return '↰'
    case 'straight':
      return '↑'
    case 'right':
      return '↱'
    case 'roundabout':
      return '↻'
  }
}

function drawRoadSegmentBase(
  ctx: CanvasRenderingContext2D,
  seg: RoadSegment,
  toCanvasY: (y: number) => number,
  layer: 'sidewalk' | 'curb' | 'asphalt' | 'markings',
) {
  const x1 = seg.x1
  const y1 = toCanvasY(seg.y1)
  const x2 = seg.x2
  const y2 = toCanvasY(seg.y2)

  ctx.save()
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)

  if (layer === 'sidewalk') {
    if (seg.sidewalkWidth <= 0) {
      ctx.restore()
      return
    }
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = seg.width + seg.sidewalkWidth * 2
    ctx.stroke()
  } else if (layer === 'curb') {
    if (seg.curbWidth <= 0) {
      ctx.restore()
      return
    }
    ctx.strokeStyle = seg.roadClass === 'avenue' ? '#b91c1c' : '#64748b'
    ctx.lineWidth = seg.width
    ctx.stroke()
  } else if (layer === 'asphalt') {
    ctx.strokeStyle = seg.surfaceKind === 'drag_vht' ? '#0f172a' : '#1e293b'
    ctx.lineWidth = Math.max(2, seg.width - seg.curbWidth * 2)
    ctx.stroke()
  } else if (layer === 'markings') {
    if (seg.centerLineStyle === 'yellow_dashed') {
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 0.55
      ctx.setLineDash([6, 5])
      ctx.stroke()
      ctx.setLineDash([])
    } else if (seg.centerLineStyle === 'white_dashed') {
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.72)'
      ctx.lineWidth = 0.5
      ctx.setLineDash([5, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
  ctx.restore()
}

function drawRoadArcBase(
  ctx: CanvasRenderingContext2D,
  arc: RoadArc,
  toCanvasY: (y: number) => number,
  layer: 'curb' | 'asphalt' | 'markings',
) {
  const cy = toCanvasY(arc.cy)
  const { start, end, anticlockwise } = toCanvasArcAngles(arc)

  ctx.save()
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.arc(arc.cx, cy, arc.radius, start, end, anticlockwise)

  if (layer === 'curb') {
    if (arc.curbWidth <= 0) {
      ctx.restore()
      return
    }
    ctx.strokeStyle = arc.id === 'rotatoria-central' ? '#dc2626' : '#64748b'
    ctx.lineWidth = arc.width
    ctx.stroke()
  } else if (layer === 'asphalt') {
    ctx.strokeStyle = arc.id === 'circuito-handling' ? '#273549' : '#1e293b'
    const innerShrink = arc.innerCurbOnly ? 0 : arc.curbWidth * 2
    ctx.lineWidth = Math.max(2, arc.width - innerShrink)
    ctx.stroke()
  } else if (layer === 'markings') {
    if (arc.centerLineStyle === 'yellow_dashed') {
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 0.55
      ctx.setLineDash([6, 5])
      ctx.stroke()
      ctx.setLineDash([])
    } else if (arc.centerLineStyle === 'white_dashed') {
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)'
      ctx.lineWidth = arc.id === 'circuito-handling' ? 0.75 : 0.55
      ctx.setLineDash(arc.id === 'circuito-handling' ? [8, 8] : [4, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
  ctx.restore()
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  obs: WorldObstacle,
  toCanvasY: (y: number) => number,
) {
  ctx.save()
  if (obs.shape === 'circle' && obs.cx !== undefined && obs.cy !== undefined && obs.radius !== undefined) {
    const cy = toCanvasY(obs.cy)
    if (obs.sidewalkMargin > 0) {
      ctx.fillStyle = obs.category === 'monument' ? '#dc2626' : '#475569'
      ctx.beginPath()
      ctx.arc(obs.cx, cy, obs.radius + obs.sidewalkMargin, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = obs.fillColor
    ctx.beginPath()
    ctx.arc(obs.cx, cy, obs.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = obs.borderColor
    ctx.lineWidth = 1.4
    ctx.stroke()

    ctx.fillStyle = obs.roofColor
    ctx.beginPath()
    ctx.arc(
      obs.cx,
      cy,
      obs.category === 'monument' ? Math.min(4.8, obs.radius * 0.3) : obs.radius * 0.62,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  } else if (
    obs.shape === 'box' &&
    obs.minX !== undefined &&
    obs.maxX !== undefined &&
    obs.minY !== undefined &&
    obs.maxY !== undefined
  ) {
    const w = obs.maxX - obs.minX
    const h = obs.maxY - obs.minY
    const topY = toCanvasY(obs.maxY)

    if (obs.sidewalkMargin > 0) {
      const m = obs.sidewalkMargin
      ctx.fillStyle = '#475569'
      ctx.fillRect(obs.minX - m, topY - m, w + m * 2, h + m * 2)
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 0.6
      ctx.strokeRect(obs.minX - m, topY - m, w + m * 2, h + m * 2)
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)'
    ctx.fillRect(obs.minX + 1.8, topY + 1.8, w, h)

    ctx.fillStyle = obs.fillColor
    ctx.fillRect(obs.minX, topY, w, h)

    const inset = Math.min(3.5, w * 0.14, h * 0.14)
    ctx.fillStyle = obs.roofColor
    ctx.fillRect(obs.minX + inset, topY + inset, w - inset * 2, h - inset * 2)

    ctx.strokeStyle = obs.borderColor
    ctx.lineWidth = 1.2
    ctx.strokeRect(obs.minX, topY, w, h)
  }
  ctx.restore()
}

function drawStaticWorldGeometry(ctx: CanvasRenderingContext2D, geo: WorldGeometryData) {
  const toCanvasY = (worldY: number) => -worldY
  const hw = geo.bounds.halfWidth
  const hh = geo.bounds.halfHeight

  // 1A. Terreno base (gramado) + corredor leste da Drag Strip
  ctx.fillStyle = '#062615'
  ctx.fillRect(-hw, toCanvasY(hh), hw * 2, hh * 2)
  const ds = geo.dragStrip
  ctx.fillRect(
    hw - 15,
    toCanvasY(ds.yCenter + ds.halfWidth + 14),
    ds.eastBoundaryX - hw + 30,
    (ds.halfWidth + 14) * 2,
  )

  // Grade métrica sutil
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)'
  ctx.lineWidth = 0.45
  ctx.beginPath()
  for (let gx = -hw; gx <= hw; gx += 40) {
    ctx.moveTo(gx, toCanvasY(hh))
    ctx.lineTo(gx, toCanvasY(-hh))
  }
  for (let gy = -hh; gy <= hh; gy += 40) {
    ctx.moveTo(-hw, toCanvasY(gy))
    ctx.lineTo(hw, toCanvasY(gy))
  }
  ctx.stroke()

  // 1B. Calçadas das vias
  for (const seg of geo.segments) {
    drawRoadSegmentBase(ctx, seg, toCanvasY, 'sidewalk')
  }

  // 1C. Zonas Especiais (Skidpad Molhado e Circuito Off-Road 4x4)
  for (const zone of geo.zones) {
    const zcy = toCanvasY(zone.cy)
    ctx.fillStyle = zone.fillColor
    ctx.beginPath()
    ctx.arc(zone.cx, zcy, zone.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = zone.borderColor
    ctx.lineWidth = 2.6
    ctx.stroke()

    ctx.strokeStyle =
      zone.surfaceKind === 'wet_asphalt' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(217, 119, 6, 0.25)'
    ctx.lineWidth = 0.9
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.arc(zone.cx, zcy, zone.radius * 0.62, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // 1D. Bordas / Guias
  for (const arc of geo.arcs) {
    drawRoadArcBase(ctx, arc, toCanvasY, 'curb')
  }
  for (const seg of geo.segments) {
    drawRoadSegmentBase(ctx, seg, toCanvasY, 'curb')
  }

  // 1E. Asfalto principal
  for (const arc of geo.arcs) {
    drawRoadArcBase(ctx, arc, toCanvasY, 'asphalt')
  }
  for (const seg of geo.segments) {
    drawRoadSegmentBase(ctx, seg, toCanvasY, 'asphalt')
  }
  for (const inter of geo.intersections) {
    if (inter.kind === 'roundabout') continue
    ctx.fillStyle = '#1e293b'
    ctx.beginPath()
    ctx.arc(inter.x, toCanvasY(inter.y), inter.radius * 0.72, 0, Math.PI * 2)
    ctx.fill()
  }

  // 1F. Sinalização horizontal
  for (const seg of geo.segments) {
    drawRoadSegmentBase(ctx, seg, toCanvasY, 'markings')
  }
  for (const arc of geo.arcs) {
    drawRoadArcBase(ctx, arc, toCanvasY, 'markings')
  }

  const rotArc = geo.arcs.find((a) => a.id === 'rotatoria-central')
  if (rotArc) {
    drawRoadArcBase(ctx, rotArc, toCanvasY, 'asphalt')
    drawRoadArcBase(ctx, rotArc, toCanvasY, 'markings')
  }

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.32)'
  ctx.lineWidth = 0.6
  for (const inter of geo.intersections) {
    if (inter.kind === 'roundabout') continue
    const iy = toCanvasY(inter.y)
    ctx.strokeRect(inter.x - 10, iy - 10, 20, 20)
  }

  // Marcas oficiais da Pista de Arrancada 402m
  const dsCanvasY = toCanvasY(ds.yCenter)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(ds.startX, dsCanvasY - ds.halfWidth, 1.5, ds.halfWidth * 2)
  ctx.fillStyle = '#38bdf8'
  ctx.fillRect(ds.mark60ftX, dsCanvasY - ds.halfWidth, 0.8, ds.halfWidth * 2)
  ctx.fillStyle = '#fbbf24'
  ctx.fillRect(ds.mark201mX, dsCanvasY - ds.halfWidth, 1.2, ds.halfWidth * 2)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(ds.mark402mX, dsCanvasY - ds.halfWidth, 2.5, ds.halfWidth * 2)
  ctx.fillStyle = '#000000'
  for (let y = dsCanvasY - ds.halfWidth; y < dsCanvasY + ds.halfWidth; y += 2) {
    ctx.fillRect(ds.mark402mX, y, 1.25, 1)
    ctx.fillRect(ds.mark402mX + 1.25, y + 1, 1.25, 1)
  }

  // 1G. Obstáculos físicos não dirigíveis
  for (const obs of geo.obstacles) {
    drawObstacle(ctx, obs, toCanvasY)
  }

  // 1H. Barreiras Perimetrais da Cidade + Corredor Leste da Drag Strip
  const bLimit = geo.bounds.boundaryLimit
  const dragCorridorTop = toCanvasY(ds.yCenter + ds.halfWidth + 3.5)
  const dragCorridorBottom = toCanvasY(ds.yCenter - ds.halfWidth - 3.5)
  ctx.strokeStyle = '#dc2626'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(bLimit, toCanvasY(bLimit))
  ctx.lineTo(-bLimit, toCanvasY(bLimit))
  ctx.lineTo(-bLimit, toCanvasY(-bLimit))
  ctx.lineTo(bLimit, toCanvasY(-bLimit))
  ctx.lineTo(bLimit, dragCorridorBottom)
  ctx.lineTo(ds.eastBoundaryX, dragCorridorBottom)
  ctx.lineTo(ds.eastBoundaryX, dragCorridorTop)
  ctx.lineTo(bLimit, dragCorridorTop)
  ctx.lineTo(bLimit, toCanvasY(bLimit))
  ctx.stroke()
}

interface CachedStaticWorld {
  canvas: HTMLCanvasElement
  minWorldX: number
  minCanvasY: number
  pxPerMeter: number
}

let cachedStaticWorld: CachedStaticWorld | null = null

/**
 * Pré-renderiza todo o cenário estático do mundo 2D (vias, guias, faixas tracejadas, blocos urbanos,
 * zonas e muros) UMA ÚNICA VEZ em canvas offscreen de alta nitidez (4.5 px/m), eliminando mais de
 * 100 chamadas de `stroke`/`setLineDash`/`fillRect` por frame sem perder nenhum detalhe visual!
 */
function getStaticWorldCache(geo: WorldGeometryData): CachedStaticWorld | null {
  if (cachedStaticWorld) return cachedStaticWorld
  if (typeof document === 'undefined') return null

  const pxPerMeter = 4.5
  const minWorldX = -315
  const maxWorldX = 550
  const minCanvasY = -315
  const maxCanvasY = 315
  const spanX = maxWorldX - minWorldX
  const spanY = maxCanvasY - minCanvasY

  const offscreen = document.createElement('canvas')
  offscreen.width = Math.round(spanX * pxPerMeter)
  offscreen.height = Math.round(spanY * pxPerMeter)
  const octx = offscreen.getContext('2d', { alpha: false })
  if (!octx) return null

  octx.fillStyle = '#070b12'
  octx.fillRect(0, 0, offscreen.width, offscreen.height)
  octx.save()
  octx.scale(pxPerMeter, pxPerMeter)
  octx.translate(-minWorldX, -minCanvasY)
  drawStaticWorldGeometry(octx, geo)
  octx.restore()

  cachedStaticWorld = {
    canvas: offscreen,
    minWorldX,
    minCanvasY,
    pxPerMeter,
  }
  return cachedStaticWorld
}

const MAX_SKID_MARKS = 360

/**
 * DrivingWorldCanvas — Renderizador 2D Top-Down de alta performance em Canvas (Fase 4.4.2.2).
 */
export const DrivingWorldCanvas = memo(function DrivingWorldCanvas({
  vehicle,
  className = '',
  cameraMode = 'follow',
  zoomScale = 4.2,
  overviewMode = false,
}: DrivingWorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameIdRef = useRef<number | null>(null)

  // Buffer circular de marcas de pneu sem realocação O(N) de Array.shift()
  const skidMarksRef = useRef<SkidMark[]>([])
  const skidWriteIdxRef = useRef<number>(0)
  const smokeParticlesRef = useRef<SmokeParticle[]>([])
  const guidanceTrackerRef = useRef<AsphaltGuidanceTracker>(new AsphaltGuidanceTracker())

  const cameraRef = useRef<{ x: number; y: number; headingDeg: number }>({
    x: WorldMap.SPAWN_X,
    y: WorldMap.SPAWN_Y,
    headingDeg: WorldMap.SPAWN_HEADING_DEG,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const geo = WorldMap.getGeometry()
    const staticWorld = getStaticWorldCache(geo)
    const visual2d = resolveVehicleVisual2D(vehicle)
    let lastTime = performance.now()

    const pushSkidMark = (x: number, y: number, opacity: number) => {
      const buf = skidMarksRef.current
      if (buf.length < MAX_SKID_MARKS) {
        buf.push({ x, y, opacity })
      } else {
        const idx = skidWriteIdxRef.current % MAX_SKID_MARKS
        buf[idx].x = x
        buf[idx].y = y
        buf[idx].opacity = opacity
        skidWriteIdxRef.current = idx + 1
      }
    }

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1)
      lastTime = time

      const state = useSimulationStore.getState()
      const carX = state.visualPositionX ?? state.positionX ?? 0
      const carY = state.visualPositionY ?? state.positionY ?? 0
      const carHeadingDeg = state.visualHeadingDeg ?? state.headingDeg ?? 0
      const carSpeed = state.visualSpeed ?? state.speed ?? 0
      const steeringAngle = state.steeringAngle ?? 0
      const brake = state.brake ?? 0
      const currentGear = state.currentGear ?? 0
      const isReverse = currentGear === -1
      const slipAngleDeg = state.slipAngleDeg ?? 0
      const leanAngleDeg = state.leanAngleDeg ?? 0
      const isColliding = state.isColliding ?? false
      const isLateralSliding = Math.abs(slipAngleDeg) > 6.5 && carSpeed > 18
      const isWheelSlipping =
        state._phys?.isClutchSlipping ||
        (state.speed > 5 && Math.abs(state._phys?.clutchSlipRpm || 0) > 80) ||
        state._phys?.isBurningOut ||
        isLateralSliding
      const isAirbrake = state.isAirbrakeActive
      const headlightsOn = state.headlightsMode !== 'off'
      const isHighBeam = state.highBeamLit
      const isFogLit = state.fogLightsLit
      const leftBlinkLit = state.leftIndicatorLit
      const rightBlinkLit = state.rightIndicatorLit

      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.floor(rect.width * dpr))
      const height = Math.max(1, Math.floor(rect.height * dpr))

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      const speedMs = carSpeed / 3.6
      const leadDist = overviewMode ? 0 : Math.min(8.5, speedMs * 0.18) * (isReverse ? -0.5 : 1)
      const radH = (carHeadingDeg * Math.PI) / 180
      const targetCamX = carX + Math.sin(radH) * leadDist
      const targetCamY = carY + Math.cos(radH) * leadDist

      const camLerp = Math.min(1.0, dt * 11.0)
      cameraRef.current.x += (targetCamX - cameraRef.current.x) * camLerp
      cameraRef.current.y += (targetCamY - cameraRef.current.y) * camLerp

      const targetHeading = cameraMode === 'follow' ? carHeadingDeg : 0
      let dH = targetHeading - cameraRef.current.headingDeg
      while (dH > 180) dH -= 360
      while (dH < -180) dH += 360
      cameraRef.current.headingDeg += dH * camLerp

      ctx.fillStyle = '#070b12'
      ctx.fillRect(0, 0, width, height)

      ctx.save()
      ctx.translate(width / 2, height / 2)

      if (overviewMode) {
        const worldSpanX = 850
        const worldSpanY = 640
        const fitScale = Math.min(width / worldSpanX, height / worldSpanY) * 0.96
        ctx.scale(fitScale, fitScale)
        ctx.translate(-95, 0)
      } else {
        const scale = zoomScale * dpr
        ctx.scale(scale, scale)

        const camRad = (cameraRef.current.headingDeg * Math.PI) / 180
        if (cameraMode === 'follow') {
          ctx.rotate(-camRad)
        }
        ctx.translate(-cameraRef.current.x, cameraRef.current.y)
      }

      const toCanvasY = (worldY: number) => -worldY

      // ─── 1. CENÁRIO ESTÁTICO VIA CACHE OFFSCREEN (1 único drawImage na GPU!) ───
      if (staticWorld) {
        ctx.drawImage(
          staticWorld.canvas,
          staticWorld.minWorldX,
          staticWorld.minCanvasY,
          staticWorld.canvas.width / staticWorld.pxPerMeter,
          staticWorld.canvas.height / staticWorld.pxPerMeter,
        )
      } else {
        drawStaticWorldGeometry(ctx, geo)
      }

      // ─── 1F.2. Orientação de velocidade e saídas no asfalto com ciclo de vida persistente (Fase 4.4.2.2) ───
      if (!overviewMode && !isReverse) {
        const guidance = guidanceTrackerRef.current.update(
          carX,
          carY,
          carHeadingDeg,
          carSpeed,
          Boolean(state.isRaining),
          geo,
        )
        if (guidance && guidance.alpha > 0.02) {
          const halfMarkW = Math.min(guidance.laneWidthM * 0.38, 5.4)
          const alpha = guidance.alpha

          ctx.save()
          ctx.translate(guidance.paintX, toCanvasY(guidance.paintY))
          ctx.rotate((guidance.laneHeadingDeg * Math.PI) / 180)
          ctx.globalAlpha = alpha

          ctx.fillStyle = 'rgba(8, 12, 20, 0.56)'
          ctx.beginPath()
          ctx.roundRect(-halfMarkW, -5.8, halfMarkW * 2, 9.6, 1.1)
          ctx.fill()

          ctx.strokeStyle = 'rgba(250, 204, 21, 0.82)'
          ctx.lineWidth = 0.45
          ctx.beginPath()
          ctx.moveTo(-halfMarkW * 0.92, -5.2)
          ctx.lineTo(halfMarkW * 0.92, -5.2)
          ctx.moveTo(-halfMarkW * 0.92, 3.2)
          ctx.lineTo(halfMarkW * 0.92, 3.2)
          ctx.stroke()

          ctx.save()
          ctx.scale(0.1, 0.1)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          if (guidance.exitArrows.length > 0) {
            const arrowText = guidance.exitArrows.map(formatAsphaltArrowGlyph).join('  ')
            ctx.fillStyle = 'rgba(224, 242, 254, 0.92)'
            ctx.font = '900 24px monospace'
            ctx.fillText(arrowText, 0, -31)
          }

          ctx.fillStyle = 'rgba(254, 240, 138, 0.96)'
          ctx.font = '900 30px monospace'
          ctx.fillText(
            `${guidance.recommendedSpeedKmh}`,
            0,
            guidance.exitArrows.length > 0 ? -1 : -12,
          )

          ctx.fillStyle = 'rgba(203, 213, 225, 0.85)'
          ctx.font = '800 13px monospace'
          ctx.fillText('KM/H', 0, guidance.exitArrows.length > 0 ? 19 : 12)
          ctx.restore()

          ctx.restore()
        }
      } else if (isReverse) {
        guidanceTrackerRef.current.reset()
      }

      // ─── 2. SKID MARKS AGRUPADOS EM PATH ÚNICO (1 fill em vez de 360 fills/frame!) ───
      if ((isWheelSlipping || brake > 0.45) && carSpeed > 2) {
        const rearOffset = vehicle?.info?.category === 'motorcycle' ? 0.5 : 1.35
        const halfTrack = vehicle?.info?.category === 'motorcycle' ? 0 : 0.72
        const cosH = Math.cos(radH)
        const sinH = Math.sin(radH)
        const rearX = carX - sinH * rearOffset
        const rearY = carY - cosH * rearOffset

        if (halfTrack > 0) {
          const op = isLateralSliding ? 0.85 : 0.65
          pushSkidMark(rearX - cosH * halfTrack, -(rearY + sinH * halfTrack), op)
          pushSkidMark(rearX + cosH * halfTrack, -(rearY - sinH * halfTrack), op)
        } else {
          pushSkidMark(rearX, -rearY, 0.7)
        }
      }

      const skids = skidMarksRef.current
      if (skids.length > 1) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.30)'
        ctx.beginPath()
        for (let i = 0; i < skids.length; i++) {
          const sm = skids[i]
          ctx.moveTo(sm.x + 0.38, sm.y)
          ctx.arc(sm.x, sm.y, 0.38, 0, Math.PI * 2)
        }
        ctx.fill()
      }

      // ─── 3. FUMAÇA DE BURNOUT E DERRAPAGEM (swap-and-pop O(1)) ───
      const smokes = smokeParticlesRef.current
      if (isWheelSlipping && (carSpeed < 45 || isLateralSliding) && smokes.length < 120) {
        for (let k = 0; k < 2; k++) {
          smokes.push({
            x: carX + (Math.random() - 0.5) * 1.4,
            y: -carY + (Math.random() - 0.5) * 1.4,
            radius: 0.7 + Math.random() * 0.7,
            opacity: isLateralSliding ? 0.42 : 0.55,
            vx: (Math.random() - 0.5) * 1.4,
            vy: (Math.random() - 0.5) * 1.4,
            life: 0.9,
          })
        }
      }

      for (let i = smokes.length - 1; i >= 0; i--) {
        const p = smokes[i]
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.radius += dt * 1.2
        p.opacity -= dt * 0.6
        p.life -= dt

        if (p.opacity <= 0 || p.life <= 0) {
          const last = smokes.pop()!
          if (i < smokes.length) {
            smokes[i] = last
          }
        } else {
          ctx.fillStyle = '#e2e8f0'
          ctx.globalAlpha = p.opacity * 0.36
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1.0

      // ─── 4. RENDERIZAÇÃO DO VEÍCULO DO JOGADOR ───
      ctx.save()
      ctx.translate(carX, -carY)
      const carHeadingRad = (carHeadingDeg * Math.PI) / 180
      ctx.rotate(carHeadingRad)

      const isMotorcycle = visual2d.silhouette === 'motorcycle' || vehicle?.info?.category === 'motorcycle'
      const isSquareHatch = visual2d.silhouette === 'hatch_square'
      const carLength = visual2d.lengthM
      const carWidth = visual2d.widthM
      const halfL = carLength / 2
      const halfW = carWidth / 2

      if (isMotorcycle && Math.abs(leanAngleDeg) > 1.5) {
        const leanShift = Math.sin((leanAngleDeg * Math.PI) / 180) * 0.45
        ctx.translate(leanShift, 0)
      }

      if (isColliding) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)'
        ctx.lineWidth = 0.25
        ctx.beginPath()
        ctx.arc(0, 0, Math.max(halfL, halfW) + 0.55, 0, Math.PI * 2)
        ctx.stroke()
      }

      if (headlightsOn && state.headlightsMode !== 'parking') {
        ctx.save()
        const reach = isHighBeam ? 42 : 30
        const spread = isHighBeam ? 17 : 13
        const beamGradient = ctx.createRadialGradient(0, -halfL - 2, 1, 0, -halfL - reach, reach * 0.88)
        beamGradient.addColorStop(0, isHighBeam ? 'rgba(254, 249, 195, 0.58)' : 'rgba(254, 240, 138, 0.45)')
        beamGradient.addColorStop(1, 'rgba(254, 240, 138, 0.0)')
        ctx.fillStyle = beamGradient
        ctx.beginPath()
        ctx.moveTo(-halfW * 0.7, -halfL)
        ctx.lineTo(-spread, -halfL - reach)
        ctx.lineTo(spread, -halfL - reach)
        ctx.lineTo(halfW * 0.7, -halfL)
        ctx.closePath()
        ctx.fill()

        if (isFogLit) {
          ctx.fillStyle = 'rgba(253, 224, 71, 0.22)'
          ctx.beginPath()
          ctx.moveTo(-halfW * 0.85, -halfL)
          ctx.lineTo(-16, -halfL - 12)
          ctx.lineTo(16, -halfL - 12)
          ctx.lineTo(halfW * 0.85, -halfL)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }

      ctx.fillStyle = '#09090b'
      const tireWidth = isMotorcycle ? 0.22 : isSquareHatch ? 0.30 : 0.38
      const tireLength = isMotorcycle ? 0.65 : isSquareHatch ? 0.62 : 0.72
      if (!isMotorcycle) {
        ctx.fillRect(-halfW - 0.05, halfL * 0.48 - tireLength / 2, tireWidth, tireLength)
        ctx.fillRect(halfW - tireWidth + 0.05, halfL * 0.48 - tireLength / 2, tireWidth, tireLength)
      } else {
        ctx.fillRect(-tireWidth / 2, halfL * 0.45 - tireLength / 2, tireWidth, tireLength)
      }

      const steerRad = steeringAngle * 0.55
      if (!isMotorcycle) {
        ctx.save()
        ctx.translate(-halfW + tireWidth / 2, -halfL * 0.55)
        ctx.rotate(steerRad)
        ctx.fillStyle = '#09090b'
        ctx.fillRect(-tireWidth / 2, -tireLength / 2, tireWidth, tireLength)
        ctx.restore()

        ctx.save()
        ctx.translate(halfW - tireWidth / 2, -halfL * 0.55)
        ctx.rotate(steerRad)
        ctx.fillStyle = '#09090b'
        ctx.fillRect(-tireWidth / 2, -tireLength / 2, tireWidth, tireLength)
        ctx.restore()
      } else {
        ctx.save()
        ctx.translate(0, -halfL * 0.55)
        ctx.rotate(steerRad)
        ctx.fillStyle = '#09090b'
        ctx.fillRect(-tireWidth / 2, -tireLength / 2, tireWidth, tireLength)
        ctx.restore()
      }

      const bodyColor = visual2d.bodyColor
      ctx.fillStyle = bodyColor
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 0.12

      ctx.beginPath()
      if (isSquareHatch) {
        ctx.roundRect(-halfW, -halfL, carWidth, carLength, 0.22)
      } else if (!isMotorcycle) {
        ctx.roundRect(-halfW, -halfL, carWidth, carLength, 0.6)
      } else {
        ctx.roundRect(-halfW, -halfL, carWidth, carLength, 0.35)
      }
      ctx.fill()
      ctx.stroke()

      if (!isMotorcycle) {
        if (visual2d.hasFrontRedStripe) {
          ctx.fillStyle = visual2d.accentColor ?? '#dc2626'
          ctx.fillRect(-halfW + 0.08, -halfL + 0.05, carWidth - 0.16, 0.14)
        }

        ctx.fillStyle = '#0a1120'
        ctx.beginPath()
        ctx.roundRect(-halfW * 0.76, -halfL * 0.42, carWidth * 0.76, carLength * 0.22, isSquareHatch ? 0.08 : 0.2)
        ctx.fill()

        ctx.fillStyle = bodyColor
        ctx.fillRect(-halfW * 0.72, -halfL * 0.18, carWidth * 0.72, carLength * 0.34)

        ctx.fillStyle = '#0a1120'
        ctx.beginPath()
        ctx.roundRect(-halfW * 0.74, halfL * 0.18, carWidth * 0.74, carLength * 0.20, isSquareHatch ? 0.08 : 0.2)
        ctx.fill()
      }

      const isBraking = brake > 0.05
      ctx.fillStyle = isBraking ? '#ff0000' : '#7f1d1d'
      ctx.fillRect(-halfW + 0.1, halfL - 0.22, 0.42, 0.18)
      ctx.fillRect(halfW - 0.52, halfL - 0.22, 0.42, 0.18)

      if (isReverse) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(-halfW + 0.55, halfL - 0.22, 0.28, 0.18)
        ctx.fillRect(halfW - 0.83, halfL - 0.22, 0.28, 0.18)
      }

      if (isAirbrake) {
        ctx.fillStyle = '#ef4444'
        ctx.fillRect(-halfW * 0.9, halfL - 0.45, carWidth * 0.9, 0.35)
      }

      if (leftBlinkLit) {
        ctx.fillStyle = '#f59e0b'
        ctx.fillRect(-halfW - 0.04, -halfL + 0.04, 0.24, 0.22)
        ctx.fillRect(-halfW - 0.04, halfL - 0.26, 0.24, 0.22)
      }
      if (rightBlinkLit) {
        ctx.fillStyle = '#f59e0b'
        ctx.fillRect(halfW - 0.20, -halfL + 0.04, 0.24, 0.22)
        ctx.fillRect(halfW - 0.20, halfL - 0.26, 0.24, 0.22)
      }

      ctx.restore()

      // ─── 5. RÓTULOS DO MODO VISÃO GERAL (WorldMapModal) ───
      if (overviewMode) {
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        for (const z of geo.zones) {
          ctx.fillStyle = 'rgba(2, 6, 23, 0.78)'
          ctx.fillRect(z.cx - 42, toCanvasY(z.cy) - 8, 84, 16)
          ctx.fillStyle = '#e2e8f0'
          ctx.font = 'bold 9.5px monospace'
          ctx.fillText(z.name, z.cx, toCanvasY(z.cy))
        }

        ctx.fillStyle = 'rgba(2, 6, 23, 0.82)'
        ctx.fillRect(260, toCanvasY(geo.dragStrip.yCenter + 22) - 8, 130, 16)
        ctx.fillStyle = '#fbbf24'
        ctx.font = 'bold 9.5px monospace'
        ctx.fillText('Arrancada 402m', 325, toCanvasY(geo.dragStrip.yCenter + 22))

        // Halo GPS pulsante sobre a posição atual do veículo
        ctx.beginPath()
        ctx.arc(carX, toCanvasY(carY), 12, 0, Math.PI * 2)
        ctx.strokeStyle = '#22d3ee'
        ctx.lineWidth = 2.2
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(carX, toCanvasY(carY), 4.2, 0, Math.PI * 2)
        ctx.fillStyle = '#22d3ee'
        ctx.fill()
        ctx.restore()
      }

      ctx.restore()
      animFrameIdRef.current = requestAnimationFrame(render)
    }

    animFrameIdRef.current = requestAnimationFrame(render)
    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current)
      }
    }
  }, [vehicle, cameraMode, zoomScale, overviewMode])

  return (
    <canvas
      ref={canvasRef}
      data-testid={overviewMode ? 'world-map-overview-canvas' : 'driving-world-canvas'}
      className={`block w-full h-full select-none ${className}`}
    />
  )
})
