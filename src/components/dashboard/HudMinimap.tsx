import { memo, useEffect, useRef, useState } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { WorldMap } from '@/systems/world/WorldMap'
import type { RoadArc } from '@/systems/world/WorldGeometry'
import { computeMinimapNavigationHint } from '@/systems/world/minimapNavigation'

export interface HudMinimapProps {
  variant?: 'desktop' | 'mobile_portrait' | 'mobile_landscape'
  className?: string
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

/**
 * HudMinimap — Minimapa fixo e leve do HUD principal (Fase 4.4.2).
 *
 * Características:
 * - Posicionado acima da região dos pedais sem obstruir acelerador, freio, embreagem, direção ou multitouch
 * - Consome diretamente `WorldMap.getGeometry()` (`WORLD_GEOMETRY`) sem criar segundo mapa ou física paralela
 * - Renderizado em `<canvas>` via `requestAnimationFrame` lendo `useSimulationStore.getState()` diretamente
 *   (zero re-render React de alta frequência; desacoplado do integrador determinístico 120 Hz / 240 Hz)
 */
export const HudMinimap = memo(function HudMinimap({
  variant = 'desktop',
  className = '',
}: HudMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const navLabelRef = useRef<HTMLSpanElement | null>(null)
  const compassBadgeRef = useRef<HTMLSpanElement | null>(null)
  const [orientationMode, setOrientationMode] = useState<'heading_up' | 'north_up'>('heading_up')
  const modeRef = useRef<'heading_up' | 'north_up'>('heading_up')

  useEffect(() => {
    modeRef.current = orientationMode
  }, [orientationMode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const geo = WorldMap.getGeometry()
    const toCanvasY = (y: number) => -y
    // Escala rápida de leitura para condução (~0.85 a 1.05 px por metro)
    const scalePxPerMeter =
      variant === 'desktop' ? 0.95 : variant === 'mobile_landscape' ? 0.85 : 0.80

    let rafId = 0
    let lastLabelUpdateMs = 0

    const render = (nowMs: number) => {
      const rect = canvas.getBoundingClientRect()
      const cssW = Math.max(64, Math.round(rect.width || 136))
      const cssH = Math.max(48, Math.round(rect.height || 76))
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
      const dragActive = st.dragStage !== 'idle'
      const hint = computeMinimapNavigationHint(posX, posY, headingDeg, geo, dragActive)

      // Atualiza texto de instrução via DOM ref a ~6 Hz (zero re-render React)
      if (nowMs - lastLabelUpdateMs >= 160) {
        lastLabelUpdateMs = nowMs
        if (navLabelRef.current && navLabelRef.current.textContent !== hint.label) {
          navLabelRef.current.textContent = hint.label
        }
        if (compassBadgeRef.current) {
          const hdg = ((Math.round(headingDeg) % 360) + 360) % 360
          const txt = modeRef.current === 'heading_up' ? `${hdg}°` : 'N▲'
          if (compassBadgeRef.current.textContent !== txt) {
            compassBadgeRef.current.textContent = txt
          }
        }
      }

      ctx.save()
      ctx.scale(dpr, dpr)

      // 1. Fundo radar escuro
      ctx.fillStyle = '#050a12'
      ctx.fillRect(0, 0, cssW, cssH)

      const anchorX = cssW * 0.5
      const anchorY = modeRef.current === 'heading_up' ? cssH * 0.64 : cssH * 0.52

      ctx.save()
      ctx.translate(anchorX, anchorY)
      ctx.scale(scalePxPerMeter, scalePxPerMeter)
      if (modeRef.current === 'heading_up') {
        ctx.rotate((-headingDeg * Math.PI) / 180)
      }
      ctx.translate(-posX, -toCanvasY(posY))

      // 2. Zonas especiais do mundo (Skidpad / Off-road)
      for (const z of geo.zones) {
        ctx.beginPath()
        ctx.arc(z.cx, toCanvasY(z.cy), z.radius, 0, Math.PI * 2)
        ctx.fillStyle = z.surfaceKind === 'wet_asphalt' ? 'rgba(14,165,233,0.18)' : 'rgba(180,83,9,0.22)'
        ctx.fill()
      }

      // 3. Estradas próximas (segmentos retos de WORLD_GEOMETRY)
      ctx.lineCap = 'round'
      for (const seg of geo.segments) {
        ctx.beginPath()
        ctx.moveTo(seg.x1, toCanvasY(seg.y1))
        ctx.lineTo(seg.x2, toCanvasY(seg.y2))
        ctx.strokeStyle = seg.roadClass === 'drag_strip' ? '#334155' : '#475569'
        ctx.lineWidth = Math.max(4, seg.width)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(seg.x1, toCanvasY(seg.y1))
        ctx.lineTo(seg.x2, toCanvasY(seg.y2))
        ctx.strokeStyle = seg.roadClass === 'drag_strip' ? '#f59e0b' : '#94a3b8'
        ctx.lineWidth = 1.2
        ctx.setLineDash([7, 7])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // 4. Curvas do mundo (arcs de WORLD_GEOMETRY)
      for (const arc of geo.arcs) {
        const { start, end, anticlockwise } = toCanvasArcAngles(arc)
        ctx.beginPath()
        ctx.arc(arc.cx, toCanvasY(arc.cy), arc.radius, start, end, anticlockwise)
        ctx.strokeStyle = arc.id === 'rotatoria-central' ? '#64748b' : '#475569'
        ctx.lineWidth = Math.max(4, arc.width)
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(arc.cx, toCanvasY(arc.cy), arc.radius, start, end, anticlockwise)
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 1.1
        ctx.setLineDash([6, 6])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // 5. Cruzamentos / Interseções (WORLD_GEOMETRY.intersections)
      for (const inter of geo.intersections) {
        ctx.beginPath()
        ctx.arc(inter.x, toCanvasY(inter.y), inter.radius, 0, Math.PI * 2)
        ctx.fillStyle = '#334155'
        ctx.fill()
        ctx.strokeStyle = inter.kind === 'roundabout' ? '#ef4444' : '#38bdf8'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // 6. Rota ativa / Próximo ponto de navegação quando existir
      if (hint.targetX !== undefined && hint.targetY !== undefined && hint.kind !== 'clear') {
        ctx.beginPath()
        ctx.moveTo(posX, toCanvasY(posY))
        ctx.lineTo(hint.targetX, toCanvasY(hint.targetY))
        ctx.strokeStyle = hint.kind === 'drag_route' ? '#fbbf24' : '#22d3ee'
        ctx.lineWidth = 2.4
        ctx.setLineDash([5, 4])
        ctx.stroke()
        ctx.setLineDash([])

        ctx.beginPath()
        ctx.arc(hint.targetX, toCanvasY(hint.targetY), 5, 0, Math.PI * 2)
        ctx.fillStyle = hint.kind === 'drag_route' ? '#fbbf24' : '#22d3ee'
        ctx.fill()
      }

      ctx.restore()

      // 7. Cone de visão + Seta de Posição e Orientação do Veículo
      ctx.save()
      ctx.translate(anchorX, anchorY)
      if (modeRef.current === 'north_up') {
        ctx.rotate((headingDeg * Math.PI) / 180)
      }

      // Cone frontal discreto indicando direção de movimento
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-11, -22)
      ctx.lineTo(11, -22)
      ctx.closePath()
      const grad = ctx.createLinearGradient(0, 0, 0, -22)
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.34)')
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)')
      ctx.fillStyle = grad
      ctx.fill()

      // Seta de proa do veículo
      ctx.beginPath()
      ctx.moveTo(0, -7)
      ctx.lineTo(5.2, 5.5)
      ctx.lineTo(0, 2.8)
      ctx.lineTo(-5.2, 5.5)
      ctx.closePath()
      ctx.fillStyle = '#22d3ee'
      ctx.fill()
      ctx.lineWidth = 1.25
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
  }, [variant])

  const sizeClass =
    variant === 'desktop'
      ? 'w-[152px] h-[86px]'
      : variant === 'mobile_landscape'
        ? 'w-full min-w-[114px] max-w-[168px] h-[78px]'
        : 'w-[126px] h-[64px]'

  return (
    <div
      data-testid="hud-minimap"
      data-variant={variant}
      style={{ touchAction: 'none' }}
      className={`relative overflow-hidden rounded-xl border border-sky-500/35 bg-[#050a12]/95 shadow-[0_4px_14px_rgba(0,0,0,0.85)] select-none flex-shrink-0 ${sizeClass} ${className}`}
      aria-label="Minimapa de condução em tempo real"
    >
      <canvas
        ref={canvasRef}
        data-testid="hud-minimap-canvas"
        className="block w-full h-full pointer-events-none"
      />

      {/* Faixa superior compacta: próxima instrução + alternância discreta de orientação */}
      <div className="absolute inset-x-1 top-0.5 flex items-center justify-between gap-1 pointer-events-none">
        <span
          ref={navLabelRef}
          data-testid="hud-minimap-nav-hint"
          className="truncate rounded bg-black/75 px-1 py-px font-mono text-[6.5px] sm:text-[7px] font-black text-sky-200 border border-white/10"
        >
          ▲ Via Livre
        </span>

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
              ? 'Minimapa orientado pela direção do veículo (toque para Norte fixo)'
              : 'Minimapa com Norte fixo (toque para acompanhar direção do veículo)'
          }
          className="pointer-events-auto rounded bg-black/80 px-1 py-px font-mono text-[6.5px] font-black text-cyan-300 border border-sky-400/30 active:scale-95 cursor-pointer"
        >
          <span ref={compassBadgeRef}>0°</span>
        </button>
      </div>
    </div>
  )
})
