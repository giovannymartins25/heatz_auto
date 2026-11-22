import { useEffect, useRef, memo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { WorldMap } from '@/systems/world/WorldMap'
import type { RoadArc, RoadSegment, WorldObstacle } from '@/systems/world/WorldGeometry'
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

/**
 * Converte ângulo cartesiano padrão (0 = +X, +pi/2 = +Y Norte) para ângulo do Canvas 2D
 * onde Y cresce para baixo (-Y = Norte).
 */
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
  ctx.lineCap = seg.roadClass === 'drag_strip' ? 'butt' : 'butt'
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
    // Calçada / guia ao redor
    if (obs.sidewalkMargin > 0) {
      ctx.fillStyle = obs.category === 'monument' ? '#dc2626' : '#475569'
      ctx.beginPath()
      ctx.arc(obs.cx, cy, obs.radius + obs.sidewalkMargin, 0, Math.PI * 2)
      ctx.fill()
    }
    // Corpo principal do obstáculo
    ctx.fillStyle = obs.fillColor
    ctx.beginPath()
    ctx.arc(obs.cx, cy, obs.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = obs.borderColor
    ctx.lineWidth = 1.4
    ctx.stroke()

    // Estrutura central / teto
    if (obs.category === 'monument') {
      ctx.fillStyle = obs.roofColor
      ctx.beginPath()
      ctx.arc(obs.cx, cy, Math.min(4.8, obs.radius * 0.3), 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = obs.roofColor
      ctx.beginPath()
      ctx.arc(obs.cx, cy, obs.radius * 0.62, 0, Math.PI * 2)
      ctx.fill()
    }
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

    // Calçada ao redor do bloco urbano
    if (obs.sidewalkMargin > 0) {
      const m = obs.sidewalkMargin
      ctx.fillStyle = '#475569'
      ctx.fillRect(obs.minX - m, topY - m, w + m * 2, h + m * 2)
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 0.6
      ctx.strokeRect(obs.minX - m, topY - m, w + m * 2, h + m * 2)
    }

    // Sombra projetada
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)'
    ctx.fillRect(obs.minX + 1.8, topY + 1.8, w, h)

    // Estrutura sólida (colisão física ativa em WorldMap)
    ctx.fillStyle = obs.fillColor
    ctx.fillRect(obs.minX, topY, w, h)

    // Cobertura / telhado interno
    const inset = Math.min(3.5, w * 0.14, h * 0.14)
    ctx.fillStyle = obs.roofColor
    ctx.fillRect(obs.minX + inset, topY + inset, w - inset * 2, h - inset * 2)

    // Contorno de destaque
    ctx.strokeStyle = obs.borderColor
    ctx.lineWidth = 1.2
    ctx.strokeRect(obs.minX, topY, w, h)
  }
  ctx.restore()
}

/**
 * DrivingWorldCanvas — Renderizador 2D Top-Down de alta performance em Canvas.
 *
 * Fonte única da verdade:
 * - Geometria do mundo: WorldMap.getGeometry() (vias, curvas, cruzamentos, zonas, calçadas e obstáculos)
 * - Estado do veículo: useSimulationStore (posição, orientação, esterçamento, deriva lateral e colisão da física 120 Hz)
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

  const skidMarksRef = useRef<SkidMark[]>([])
  const smokeParticlesRef = useRef<SmokeParticle[]>([])

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
    let lastTime = performance.now()

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1)
      lastTime = time

      // Leitura direta do estado físico autoritativo sem overhead de re-render React
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

      // Ajusta dimensões do canvas ao tamanho real do elemento
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const width = Math.floor(rect.width * dpr)
      const height = Math.floor(rect.height * dpr)

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      // Câmera com leve antecipação na direção de deslocamento para leitura confortável das curvas
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
        // Enquadra toda a cidade (-300..+300) + corredor da Drag Strip 402m (+522)
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

      // ─── 1. RENDERIZAÇÃO DO MUNDO MÉTRICO A PARTIR DE WORLD_GEOMETRY ───
      const toCanvasY = (worldY: number) => -worldY
      const hw = geo.bounds.halfWidth
      const hh = geo.bounds.halfHeight

      // 1A. Terreno base (gramado) + corredor leste da Drag Strip
      ctx.fillStyle = '#062615'
      ctx.fillRect(-hw, toCanvasY(hh), hw * 2, hh * 2)
      const ds = geo.dragStrip
      ctx.fillRect(hw - 15, toCanvasY(ds.yCenter + ds.halfWidth + 14), ds.eastBoundaryX - hw + 30, (ds.halfWidth + 14) * 2)

      // Grade métrica sutil para noção real de velocidade e distância
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

        // Anéis de referência interna (calibragem no Skidpad / trilha no Off-Road)
        ctx.strokeStyle = zone.surfaceKind === 'wet_asphalt' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(217, 119, 6, 0.25)'
        ctx.lineWidth = 0.9
        ctx.setLineDash([6, 6])
        ctx.beginPath()
        ctx.arc(zone.cx, zcy, zone.radius * 0.62, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // 1D. Bordas / Guias de todas as curvas e segmentos
      for (const arc of geo.arcs) {
        drawRoadArcBase(ctx, arc, toCanvasY, 'curb')
      }
      for (const seg of geo.segments) {
        drawRoadSegmentBase(ctx, seg, toCanvasY, 'curb')
      }

      // 1E. Asfalto principal de todas as curvas, segmentos e cruzamentos (sem guias internas em cruzamentos)
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

      // 1F. Sinalização horizontal (linhas centrais + marcas da Drag Strip 402m)
      for (const seg of geo.segments) {
        drawRoadSegmentBase(ctx, seg, toCanvasY, 'markings')
      }
      for (const arc of geo.arcs) {
        drawRoadArcBase(ctx, arc, toCanvasY, 'markings')
      }

      // Re-limpa núcleo da Rotatória para a linha da avenida não atravessar a ilha
      const rotArc = geo.arcs.find((a) => a.id === 'rotatoria-central')
      if (rotArc) {
        drawRoadArcBase(ctx, rotArc, toCanvasY, 'asphalt')
        drawRoadArcBase(ctx, rotArc, toCanvasY, 'markings')
      }

      // Faixas sutis de retenção nos cruzamentos principais
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

      // Linha de chegada quadriculada 402m
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(ds.mark402mX, dsCanvasY - ds.halfWidth, 2.5, ds.halfWidth * 2)
      ctx.fillStyle = '#000000'
      for (let y = dsCanvasY - ds.halfWidth; y < dsCanvasY + ds.halfWidth; y += 2) {
        ctx.fillRect(ds.mark402mX, y, 1.25, 1)
        ctx.fillRect(ds.mark402mX + 1.25, y + 1, 1.25, 1)
      }

      // 1G. Obstáculos físicos não dirigíveis (Ilha da Rotatória, blocos urbanos, boxes, paddock)
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
      // Muro Norte, Oeste e Sul
      ctx.moveTo(bLimit, toCanvasY(bLimit))
      ctx.lineTo(-bLimit, toCanvasY(bLimit))
      ctx.lineTo(-bLimit, toCanvasY(-bLimit))
      ctx.lineTo(bLimit, toCanvasY(-bLimit))
      // Muro Leste (aberto no corredor da Drag Strip)
      ctx.lineTo(bLimit, dragCorridorBottom)
      ctx.lineTo(ds.eastBoundaryX, dragCorridorBottom)
      ctx.lineTo(ds.eastBoundaryX, dragCorridorTop)
      ctx.lineTo(bLimit, dragCorridorTop)
      ctx.lineTo(bLimit, toCanvasY(bLimit))
      ctx.stroke()

      // ─── 2. SKID MARKS DE PNEUS (TRAÇÃO, FRENAGEM E DERIVA LATERAL REAL) ───
      if ((isWheelSlipping || brake > 0.45) && carSpeed > 2) {
        const rearOffset = vehicle?.info?.category === 'motorcycle' ? 0.5 : 1.35
        const halfTrack = vehicle?.info?.category === 'motorcycle' ? 0 : 0.72
        const cosH = Math.cos(radH)
        const sinH = Math.sin(radH)
        const rearX = carX - sinH * rearOffset
        const rearY = carY - cosH * rearOffset

        if (halfTrack > 0) {
          skidMarksRef.current.push(
            { x: rearX - cosH * halfTrack, y: -(rearY + sinH * halfTrack), opacity: isLateralSliding ? 0.85 : 0.65 },
            { x: rearX + cosH * halfTrack, y: -(rearY - sinH * halfTrack), opacity: isLateralSliding ? 0.85 : 0.65 },
          )
        } else {
          skidMarksRef.current.push({ x: rearX, y: -rearY, opacity: 0.7 })
        }
        while (skidMarksRef.current.length > 360) {
          skidMarksRef.current.shift()
        }
      }

      if (skidMarksRef.current.length > 1) {
        ctx.fillStyle = '#000000'
        for (let i = 0; i < skidMarksRef.current.length; i++) {
          const sm = skidMarksRef.current[i]
          ctx.globalAlpha = sm.opacity * 0.42
          ctx.beginPath()
          ctx.arc(sm.x, sm.y, 0.38, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1.0
      }

      // ─── 3. FUMAÇA DE BURNOUT E DERRAPAGEM ───
      if (isWheelSlipping && (carSpeed < 45 || isLateralSliding)) {
        for (let k = 0; k < 2; k++) {
          smokeParticlesRef.current.push({
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

      for (let i = smokeParticlesRef.current.length - 1; i >= 0; i--) {
        const p = smokeParticlesRef.current[i]
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.radius += dt * 1.2
        p.opacity -= dt * 0.6
        p.life -= dt

        if (p.opacity <= 0 || p.life <= 0) {
          smokeParticlesRef.current.splice(i, 1)
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

      const visual2d = resolveVehicleVisual2D(vehicle)
      const isMotorcycle = visual2d.silhouette === 'motorcycle' || vehicle?.info?.category === 'motorcycle'
      const isSquareHatch = visual2d.silhouette === 'hatch_square'
      const carLength = visual2d.lengthM
      const carWidth = visual2d.widthM
      const halfL = carLength / 2
      const halfW = carWidth / 2

      // Para motocicletas, desloca sutilmente o corpo no eixo lateral para representar o ângulo de inclinação (lean)
      if (isMotorcycle && Math.abs(leanAngleDeg) > 1.5) {
        const leanShift = Math.sin((leanAngleDeg * Math.PI) / 180) * 0.45
        ctx.translate(leanShift, 0)
      }

      // Anel visual discreto de impacto em caso de colisão com barreira/obstáculo
      if (isColliding) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)'
        ctx.lineWidth = 0.25
        ctx.beginPath()
        ctx.arc(0, 0, Math.max(halfL, halfW) + 0.55, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Feixe de Faróis
      if (headlightsOn) {
        ctx.save()
        const beamGradient = ctx.createRadialGradient(0, -halfL - 2, 1, 0, -halfL - 30, 26)
        beamGradient.addColorStop(0, 'rgba(254, 240, 138, 0.45)')
        beamGradient.addColorStop(1, 'rgba(254, 240, 138, 0.0)')
        ctx.fillStyle = beamGradient
        ctx.beginPath()
        ctx.moveTo(-halfW * 0.7, -halfL)
        ctx.lineTo(-13, -halfL - 30)
        ctx.lineTo(13, -halfL - 30)
        ctx.lineTo(halfW * 0.7, -halfL)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      // Rodas Traseiras
      ctx.fillStyle = '#09090b'
      const tireWidth = isMotorcycle ? 0.22 : isSquareHatch ? 0.30 : 0.38
      const tireLength = isMotorcycle ? 0.65 : isSquareHatch ? 0.62 : 0.72
      if (!isMotorcycle) {
        ctx.fillRect(-halfW - 0.05, halfL * 0.48 - tireLength / 2, tireWidth, tireLength)
        ctx.fillRect(halfW - tireWidth + 0.05, halfL * 0.48 - tireLength / 2, tireWidth, tireLength)
      } else {
        ctx.fillRect(-tireWidth / 2, halfL * 0.45 - tireLength / 2, tireWidth, tireLength)
      }

      // Rodas Dianteiras (esterçam de acordo com steeringAngle real)
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

      // Chassi do Veículo (identidade visual declarativa via resolveVehicleVisual2D)
      const bodyColor = visual2d.bodyColor

      ctx.fillStyle = bodyColor
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 0.12

      ctx.beginPath()
      if (isSquareHatch) {
        // Silhueta quadrada clássica (bordas retas)
        ctx.roundRect(-halfW, -halfL, carWidth, carLength, 0.22)
      } else if (!isMotorcycle) {
        ctx.roundRect(-halfW, -halfL, carWidth, carLength, 0.6)
      } else {
        ctx.roundRect(-halfW, -halfL, carWidth, carLength, 0.35)
      }
      ctx.fill()
      ctx.stroke()

      // Detalhes de cabine / vidros
      if (!isMotorcycle) {
        if (visual2d.hasFrontRedStripe) {
          // Faixa esportiva no para-choque dianteiro
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

      // Lanternas Traseiras (Freio e Ré)
      const isBraking = brake > 0.05
      ctx.fillStyle = isBraking ? '#ff0000' : '#7f1d1d'
      ctx.shadowColor = isBraking ? '#ff0000' : 'transparent'
      ctx.shadowBlur = isBraking ? 12 : 0
      ctx.fillRect(-halfW + 0.1, halfL - 0.22, 0.42, 0.18)
      ctx.fillRect(halfW - 0.52, halfL - 0.22, 0.42, 0.18)

      if (isReverse) {
        ctx.fillStyle = '#ffffff'
        ctx.shadowColor = '#ffffff'
        ctx.shadowBlur = 8
        ctx.fillRect(-halfW + 0.55, halfL - 0.22, 0.28, 0.18)
        ctx.fillRect(halfW - 0.83, halfL - 0.22, 0.28, 0.18)
      }

      if (isAirbrake) {
        ctx.fillStyle = '#ef4444'
        ctx.shadowColor = '#ef4444'
        ctx.shadowBlur = 15
        ctx.fillRect(-halfW * 0.9, halfL - 0.45, carWidth * 0.9, 0.35)
      }

      ctx.restore()

      // ─── 5. RÓTULOS DE SETORES E MARCADOR GPS DESTACADO (MODO MAPA DO MUNDO) ───
      if (overviewMode) {
        ctx.save()
        ctx.font = 'bold 13px ui-monospace, monospace'
        ctx.textAlign = 'center'
        for (const label of geo.labels) {
          ctx.fillStyle = label.color
          ctx.fillText(label.text, label.x, toCanvasY(label.y))
        }

        // Marcador GPS pulsante + seta de orientação na posição exata do veículo
        const pulse = 1 + 0.25 * Math.sin(time / 180)
        ctx.translate(carX, toCanvasY(carY))
        ctx.beginPath()
        ctx.arc(0, 0, 14 * pulse, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(34, 211, 238, 0.22)'
        ctx.fill()
        ctx.lineWidth = 2.5
        ctx.strokeStyle = '#22d3ee'
        ctx.stroke()

        ctx.rotate((carHeadingDeg * Math.PI) / 180)
        ctx.beginPath()
        ctx.moveTo(0, -11)
        ctx.lineTo(7, 8)
        ctx.lineTo(0, 4)
        ctx.lineTo(-7, 8)
        ctx.closePath()
        ctx.fillStyle = '#38bdf8'
        ctx.fill()
        ctx.lineWidth = 1.6
        ctx.strokeStyle = '#ffffff'
        ctx.stroke()
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
      className={`w-full h-full block rounded-xl overflow-hidden cursor-crosshair ${className}`}
    />
  )
})
