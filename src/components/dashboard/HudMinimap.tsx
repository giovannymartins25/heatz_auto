import { memo, useEffect, useRef, useState } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { WorldMap } from '@/systems/world/WorldMap'
import { computeMinimapNavigationHint } from '@/systems/world/minimapNavigation'
import { computeAsphaltGuidance } from '@/systems/world/asphaltGuidance'
import type { RoadArc } from '@/systems/world/WorldGeometry'

export interface HudMinimapProps {
  variant?: 'desktop' | 'mobile_portrait' | 'mobile_landscape'
  className?: string
}

export interface MinimapLayoutSpec {
  widthPx: number
  heightPx: number
  sizeClass: string
  /** Escala radar mais distante (px/m) para antecipar curvas, cruzamentos e rotatórias ~95–110m à frente */
  scalePxPerMeter: number
  /** Fração vertical da âncora do veículo em heading_up (>0.5 prioriza a área à frente do veículo) */
  headingUpAnchorYRatio: number
}

export const HUD_MINIMAP_SPECS: Readonly<
  Record<'desktop' | 'mobile_landscape' | 'mobile_portrait', MinimapLayoutSpec>
> = {
  desktop: {
    widthPx: 132,
    heightPx: 82,
    sizeClass: 'w-[132px] h-[82px]',
    scalePxPerMeter: 0.56,
    headingUpAnchorYRatio: 0.70,
  },
  mobile_landscape: {
    widthPx: 120,
    heightPx: 68,
    sizeClass: 'w-[120px] h-[68px]',
    scalePxPerMeter: 0.50,
    headingUpAnchorYRatio: 0.70,
  },
  mobile_portrait: {
    widthPx: 112,
    heightPx: 66,
    sizeClass: 'w-[112px] h-[66px]',
    scalePxPerMeter: 0.48,
    headingUpAnchorYRatio: 0.70,
  },
}

interface MinimapContextualSnapshot {
  cardinal: string
  primaryLabel: string
  recommendedSpeedKmh: number | null
  shouldSlowDown: boolean
}

const CARDINAL_LABELS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'] as const

export function formatHeadingCardinal(headingDeg: number): string {
  const norm = (((headingDeg % 360) + 360) % 360)
  const idx = Math.round(norm / 45) % 8
  return CARDINAL_LABELS[idx]
}

function shortenZoneName(zoneName: string): string {
  const trimmed = (zoneName || '').trim()
  if (!trimmed) return 'Via Livre'
  return trimmed
    .replace('Rotatória Central', 'Rotatória')
    .replace('Anel Viário ', 'Anel ')
    .replace('Avenida ', 'Av. ')
    .replace('Circuito ', 'Circ. ')
    .slice(0, 16)
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

interface CachedMinimapLayer {
  canvas: HTMLCanvasElement
  minWorldX: number
  minCanvasY: number
  pxPerMeter: number
}

let cachedMinimapRoadLayer: CachedMinimapLayer | null = null

/**
 * Pré-renderiza toda a malha viária esquemática do minimapa UMA ÚNICA VEZ em canvas offscreen,
 * substituindo ~90 chamadas por frame (`stroke`, `arc`, `setLineDash`) por um único `drawImage` acelerado.
 */
function getMinimapRoadLayer(): CachedMinimapLayer | null {
  if (cachedMinimapRoadLayer) return cachedMinimapRoadLayer
  if (typeof document === 'undefined') return null

  const geo = WorldMap.getGeometry()
  const pxPerMeter = 1.6
  const minWorldX = -340
  const maxWorldX = 560
  const minCanvasY = -340
  const maxCanvasY = 340
  const widthM = maxWorldX - minWorldX
  const heightM = maxCanvasY - minCanvasY

  const offscreen = document.createElement('canvas')
  offscreen.width = Math.round(widthM * pxPerMeter)
  offscreen.height = Math.round(heightM * pxPerMeter)
  const octx = offscreen.getContext('2d')
  if (!octx) return null

  const toCanvasY = (y: number) => -y

  octx.save()
  octx.scale(pxPerMeter, pxPerMeter)
  octx.translate(-minWorldX, -minCanvasY)

  // 1. Zonas especiais (Skidpad / Off-road)
  for (const z of geo.zones) {
    octx.beginPath()
    octx.arc(z.cx, toCanvasY(z.cy), z.radius, 0, Math.PI * 2)
    octx.fillStyle =
      z.surfaceKind === 'wet_asphalt' ? 'rgba(14,165,233,0.18)' : 'rgba(180,83,9,0.22)'
    octx.fill()
  }

  // 2. Vias retas esquemáticas com contraste radar nítido
  octx.lineCap = 'round'
  for (const seg of geo.segments) {
    const roadW = Math.max(7.5, seg.width * 0.68)
    octx.beginPath()
    octx.moveTo(seg.x1, toCanvasY(seg.y1))
    octx.lineTo(seg.x2, toCanvasY(seg.y2))
    octx.strokeStyle = seg.roadClass === 'drag_strip' ? '#334155' : '#475569'
    octx.lineWidth = roadW
    octx.stroke()

    octx.beginPath()
    octx.moveTo(seg.x1, toCanvasY(seg.y1))
    octx.lineTo(seg.x2, toCanvasY(seg.y2))
    octx.strokeStyle =
      seg.roadClass === 'drag_strip' ? 'rgba(245,158,11,0.78)' : 'rgba(203,213,225,0.68)'
    octx.lineWidth = 1.15
    octx.setLineDash([7, 6])
    octx.stroke()
    octx.setLineDash([])
  }

  // 3. Curvas e rotatória esquemáticas
  for (const arc of geo.arcs) {
    const { start, end, anticlockwise } = toCanvasArcAngles(arc)
    const arcW = Math.max(7.5, arc.width * 0.68)
    octx.beginPath()
    octx.arc(arc.cx, toCanvasY(arc.cy), arc.radius, start, end, anticlockwise)
    octx.strokeStyle = arc.id === 'rotatoria-central' ? '#64748b' : '#475569'
    octx.lineWidth = arcW
    octx.stroke()

    octx.beginPath()
    octx.arc(arc.cx, toCanvasY(arc.cy), arc.radius, start, end, anticlockwise)
    octx.strokeStyle = 'rgba(56,189,248,0.70)'
    octx.lineWidth = 1.1
    octx.setLineDash([6, 6])
    octx.stroke()
    octx.setLineDash([])
  }

  // 4. Interseções e ilha central da rotatória
  for (const inter of geo.intersections) {
    if (inter.kind === 'roundabout') {
      octx.beginPath()
      octx.arc(inter.x, toCanvasY(inter.y), 14, 0, Math.PI * 2)
      octx.fillStyle = '#071a12'
      octx.fill()
      octx.strokeStyle = 'rgba(239,68,68,0.80)'
      octx.lineWidth = 1.6
      octx.stroke()
      continue
    }
    octx.beginPath()
    octx.arc(inter.x, toCanvasY(inter.y), inter.radius * 0.62, 0, Math.PI * 2)
    octx.fillStyle = '#475569'
    octx.fill()
  }

  octx.restore()

  cachedMinimapRoadLayer = {
    canvas: offscreen,
    minWorldX,
    minCanvasY,
    pxPerMeter,
  }
  return cachedMinimapRoadLayer
}

/**
 * HudMinimap — Radar viário equilibrado com micro-moldura contextual externa (Fase 4.4.3 — Etapa 2).
 *
 * Exibido exclusivamente no Modo Dirigir (`entryMode === 'drive'`):
 * - Canvas interno 100% limpo com geometria real (`WorldMap.getGeometry()`), alcance ~95–110m à frente
 *   e marcador sutil no próximo ponto geométrico real quando em aproximação.
 * - Micro-barra contextual externa (fora do canvas) alimentada exclusivamente por dados reais da simulação
 *   (`computeMinimapNavigationHint` + `computeAsphaltGuidance` + `zoneName` + rumo cardeal), sem rotas falsas.
 */
export const HudMinimap = memo(function HudMinimap({
  variant = 'desktop',
  className = '',
}: HudMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [orientationMode, setOrientationMode] = useState<'heading_up' | 'north_up'>('heading_up')
  const [contextSnap, setContextSnap] = useState<MinimapContextualSnapshot>({
    cardinal: 'N',
    primaryLabel: 'Rotatória',
    recommendedSpeedKmh: null,
    shouldSlowDown: false,
  })
  const modeRef = useRef<'heading_up' | 'north_up'>('heading_up')
  const lastTargetRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  })
  const spec = HUD_MINIMAP_SPECS[variant]

  useEffect(() => {
    modeRef.current = orientationMode
  }, [orientationMode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const staticLayer = getMinimapRoadLayer()
    const geo = WorldMap.getGeometry()
    const toCanvasY = (y: number) => -y
    const scalePxPerMeter = spec.scalePxPerMeter

    let rafId = 0
    let lastContextUpdateMs = -1000

    const render = (nowMs: number) => {
      const rect = canvas.getBoundingClientRect()
      const cssW = Math.max(80, Math.round(rect.width || spec.widthPx))
      const cssH = Math.max(52, Math.round(rect.height || spec.heightPx))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const targetW = Math.round(cssW * dpr)
      const targetH = Math.round(cssH * dpr)

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
      }

      const st = useSimulationStore.getState()
      const posX = Number.isFinite(st.visualPositionX) ? st.visualPositionX : st.positionX
      const posY = Number.isFinite(st.visualPositionY) ? st.visualPositionY : st.positionY
      const headingDeg = Number.isFinite(st.visualHeadingDeg) ? st.visualHeadingDeg : st.headingDeg
      const headingRad = (headingDeg * Math.PI) / 180

      // Atualização desacelerada (5 Hz) da micro-moldura contextual externa usando dados reais do mundo
      if (nowMs - lastContextUpdateMs >= 200) {
        lastContextUpdateMs = nowMs
        const dragActive = st.dragStage !== 'idle'
        const navHint = computeMinimapNavigationHint(posX, posY, headingDeg, geo, dragActive)
        const guidance = computeAsphaltGuidance(posX, posY, headingDeg, st.isRaining, geo, st.speed)
        const cardinal = formatHeadingCardinal(headingDeg)
        const primaryLabel =
          navHint.kind !== 'clear' ? navHint.label : `📍 ${shortenZoneName(st.zoneName)}`
        const recommendedSpeedKmh = guidance ? guidance.recommendedSpeedKmh : null
        const shouldSlowDown =
          recommendedSpeedKmh !== null && st.speed > recommendedSpeedKmh + 5

        lastTargetRef.current =
          navHint.kind !== 'clear' &&
          navHint.targetX !== undefined &&
          navHint.targetY !== undefined
            ? { x: navHint.targetX, y: navHint.targetY, active: true }
            : { x: 0, y: 0, active: false }

        setContextSnap((prev) => {
          if (
            prev.cardinal === cardinal &&
            prev.primaryLabel === primaryLabel &&
            prev.recommendedSpeedKmh === recommendedSpeedKmh &&
            prev.shouldSlowDown === shouldSlowDown
          ) {
            return prev
          }
          return {
            cardinal,
            primaryLabel,
            recommendedSpeedKmh,
            shouldSlowDown,
          }
        })
      }

      ctx.save()
      ctx.scale(dpr, dpr)

      // 1. Fundo radar escuro profundo
      ctx.fillStyle = '#050911'
      ctx.fillRect(0, 0, cssW, cssH)

      // 2. Referência central horizontal com prioridade para a área à frente do veículo
      const isHeadingUp = modeRef.current === 'heading_up'
      const anchorX = isHeadingUp ? cssW * 0.5 : cssW * 0.5 - Math.sin(headingRad) * (cssW * 0.14)
      const anchorY = isHeadingUp
        ? cssH * spec.headingUpAnchorYRatio
        : cssH * 0.5 + Math.cos(headingRad) * (cssH * 0.16)

      ctx.save()
      ctx.translate(anchorX, anchorY)
      ctx.scale(scalePxPerMeter, scalePxPerMeter)
      if (isHeadingUp) {
        ctx.rotate(-headingRad)
      }
      ctx.translate(-posX, -toCanvasY(posY))

      if (staticLayer) {
        ctx.drawImage(
          staticLayer.canvas,
          staticLayer.minWorldX,
          staticLayer.minCanvasY,
          staticLayer.canvas.width / staticLayer.pxPerMeter,
          staticLayer.canvas.height / staticLayer.pxPerMeter,
        )
      }

      // Marcador geométrico discreto no ponto real da próxima curva/interseção (sem inventar rota)
      if (lastTargetRef.current.active) {
        const tx = lastTargetRef.current.x
        const ty = toCanvasY(lastTargetRef.current.y)
        ctx.beginPath()
        ctx.arc(tx, ty, 6.2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(56, 189, 248, 0.24)'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(tx, ty, 2.8, 0, Math.PI * 2)
        ctx.fillStyle = '#38bdf8'
        ctx.fill()
      }

      ctx.restore()

      // Anel de alcance radar sutil (~45m) + marcação de Norte real na borda do anel
      const ringRadiusPx = 45 * scalePxPerMeter
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)'
      ctx.lineWidth = 0.85
      ctx.beginPath()
      ctx.arc(anchorX, anchorY, ringRadiusPx, 0, Math.PI * 2)
      ctx.stroke()

      const northAngleRad = isHeadingUp ? -headingRad - Math.PI / 2 : -Math.PI / 2
      const nx = anchorX + Math.cos(northAngleRad) * ringRadiusPx
      const ny = anchorY + Math.sin(northAngleRad) * ringRadiusPx
      ctx.beginPath()
      ctx.arc(nx, ny, 2.1, 0, Math.PI * 2)
      ctx.fillStyle = '#f87171'
      ctx.fill()

      // 3. Indicador de Posição + Cone Direcional do Veículo
      ctx.save()
      ctx.translate(anchorX, anchorY)
      if (!isHeadingUp) {
        ctx.rotate(headingRad)
      }

      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-10, -22)
      ctx.lineTo(10, -22)
      ctx.closePath()
      ctx.fillStyle = 'rgba(34, 211, 238, 0.22)'
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(0, -5.8)
      ctx.lineTo(4.3, 4.5)
      ctx.lineTo(0, 2.3)
      ctx.lineTo(-4.3, 4.5)
      ctx.closePath()
      ctx.fillStyle = '#22d3ee'
      ctx.fill()
      ctx.lineWidth = 1.05
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      ctx.restore()

      ctx.restore()
      rafId = window.requestAnimationFrame(render)
    }

    rafId = window.requestAnimationFrame(render)
    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [spec])

  const widthOnlyClass =
    variant === 'desktop'
      ? 'w-[132px]'
      : variant === 'mobile_landscape'
        ? 'w-[120px]'
        : 'w-[112px]'

  return (
    <div
      data-testid="hud-minimap"
      data-variant={variant}
      style={{ touchAction: 'none' }}
      className={`flex flex-col overflow-hidden rounded-xl border border-sky-500/25 bg-[#050911]/95 shadow-[0_4px_14px_rgba(0,0,0,0.86)] select-none flex-shrink-0 ${widthOnlyClass} ${className}`}
      aria-label="Radar viário contextual"
    >
      {/* Área do Canvas Radar (sem textos internos poluindo as vias) */}
      <div className={`relative overflow-hidden ${spec.sizeClass}`}>
        <canvas
          ref={canvasRef}
          data-testid="hud-minimap-canvas"
          className="block w-full h-full pointer-events-none"
        />

        {/* Pílula compacta de Rumo Cardeal + Alternância Heading-Up / North-Up */}
        <button
          type="button"
          data-testid="btn-hud-minimap-orientation"
          onClick={(e) => {
            e.stopPropagation()
            setOrientationMode((m) => (m === 'heading_up' ? 'north_up' : 'heading_up'))
          }}
          style={{ touchAction: 'manipulation' }}
          title={
            orientationMode === 'heading_up'
              ? 'Minimapa acompanhando direção do veículo (toque para Norte fixo)'
              : 'Minimapa com Norte fixo (toque para acompanhar direção do veículo)'
          }
          className="absolute top-1 right-1 rounded bg-black/85 px-1.5 py-0.5 font-mono text-[7px] font-black text-cyan-300 border border-white/15 active:scale-95 cursor-pointer leading-none flex items-center gap-0.5"
        >
          <span>{orientationMode === 'heading_up' ? '▲' : 'N'}</span>
          <span className="text-zinc-400">·</span>
          <span data-testid="hud-minimap-cardinal" className="text-sky-200">
            {contextSnap.cardinal}
          </span>
        </button>
      </div>

      {/* Micro-barra Contextual Externa (próxima referência real + velocidade recomendada em aproximação) */}
      <div
        data-testid="hud-minimap-context-bar"
        className="flex items-center justify-between gap-1 border-t border-white/10 bg-zinc-950/95 px-1.5 py-0.5 font-mono leading-none"
      >
        <span
          data-testid="hud-minimap-context-label"
          className="truncate text-[7px] font-bold text-slate-200"
          title={contextSnap.primaryLabel}
        >
          {contextSnap.primaryLabel}
        </span>

        {contextSnap.recommendedSpeedKmh !== null && (
          <span
            data-testid="hud-minimap-rec-speed"
            className={`flex-shrink-0 rounded px-1 py-px text-[6.5px] font-black ${
              contextSnap.shouldSlowDown
                ? 'bg-rose-500/30 text-rose-200 border border-rose-400/60'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
            }`}
            title={`Velocidade física recomendada na aproximação: ${contextSnap.recommendedSpeedKmh} km/h`}
          >
            {contextSnap.recommendedSpeedKmh}
          </span>
        )}
      </div>
    </div>
  )
})
