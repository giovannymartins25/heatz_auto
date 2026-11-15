import { memo, useState, useRef, useCallback } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import { VehicleDashboardCluster } from './VehicleDashboardCluster'
import { InfotainmentScreen } from './InfotainmentScreen'
import { AutomaticShiftButton } from '@/components/controls'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'

export interface SwipeableClusterMediaSlotProps {
  telemetry: DashboardTelemetry
  vehicle: VehicleConfig
  expanded?: boolean
  supportsPaddleShifters?: boolean
  isManualActive?: boolean
  hasTurbo?: boolean
  showAftermarketBoostGauge?: boolean
  boostPressureBar?: number
  className?: string
  initialView?: 'cluster' | 'multimedia'
  onViewChange?: (view: 'cluster' | 'multimedia') => void
}

const SWIPE_THRESHOLD = 40 // px

/**
 * SwipeableClusterMediaSlot — UMA área única com duas visualizações intercambiáveis.
 *
 * Painel original e central multimídia vivem em dois painéis (panes) de exatamente
 * a mesma largura/altura dentro de uma esteira (track) 200% que desliza horizontalmente.
 * Ambos permanecem montados: simulação, relógio e estado da multimídia nunca são interrompidos.
 *
 * - Swipe horizontal (>= 40px) restrito a este container; esquerda → mídia, direita → painel.
 * - Botão pill + indicadores (dots) como alternativa visual ao gesto.
 */
export const SwipeableClusterMediaSlot = memo(function SwipeableClusterMediaSlot({
  telemetry,
  vehicle,
  expanded = false,
  supportsPaddleShifters = false,
  isManualActive = false,
  hasTurbo = false,
  showAftermarketBoostGauge = false,
  boostPressureBar = 0,
  className = '',
  initialView = 'cluster',
  onViewChange,
}: SwipeableClusterMediaSlotProps) {
  // Motocicletas (CB1000R): utilizam painel TFT dedicado sem tela de multimídia ou gesto de swipe
  if (vehicle.info.category === 'motorcycle' || vehicle.id === 'cb1000r') {
    return (
      <div
        className={`relative flex items-center justify-center w-full h-full overflow-hidden select-none ${className}`}
        aria-label="Painel TFT de instrumentos da motocicleta"
      >
        <div className="flex-1 h-full min-w-0 flex items-center justify-center">
          <VehicleDashboardCluster telemetry={telemetry} expanded={expanded} />
        </div>
      </div>
    )
  }

  const [activeView, setActiveView] = useState<'cluster' | 'multimedia'>(initialView)
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  const startRef = useRef<{ x: number; y: number; id: number } | null>(null)
  const lastDxRef = useRef(0)
  const lockedRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const setView = useCallback(
    (view: 'cluster' | 'multimedia') => {
      setActiveView((prev) => {
        if (prev !== view) {
          HapticFeedback.light()
          onViewChange?.(view)
        }
        return view
      })
    },
    [onViewChange],
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Apenas botão primário (toque ou botão esquerdo do mouse)
    if (!e.isPrimary) return
    if (e.button !== undefined && e.button !== 0) return

    const target = e.target as HTMLElement
    // Não sequestrar toques de botões, links, inputs, selects, textareas e elementos marcados
    if (target.closest('button, a, input, select, textarea, [data-prevent-swipe]')) return

    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    lastDxRef.current = 0
    lockedRef.current = false

    // Captura o ponteiro imediatamente para garantir rastreamento contínuo em desktop e mobile
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch { /* noop */ }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = startRef.current
    if (!s) return

    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    lastDxRef.current = dx

    // Decisão de travamento horizontal
    if (!lockedRef.current) {
      // Se for preponderantemente vertical e além de 18px, é rolagem interna de lista: libera
      if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx) * 2) {
        try {
          if (rootRef.current?.hasPointerCapture(s.id)) {
            rootRef.current.releasePointerCapture(s.id)
          }
        } catch { /* noop */ }
        startRef.current = null
        return
      }

      // Trava o gesto horizontal quando há movimento horizontal definido (>= 4px)
      if (Math.abs(dx) >= 4 && Math.abs(dx) >= Math.abs(dy)) {
        lockedRef.current = true
        setDragging(true)
      } else {
        return
      }
    }

    if (lockedRef.current) {
      e.stopPropagation()
    }

    // Resistência nas bordas (esquerda no painel / direita na mídia)
    const w = rootRef.current?.clientWidth ?? 300
    const max = w * 0.6
    let off = Math.max(-max, Math.min(max, dx))
    if ((activeView === 'cluster' && dx > 0) || (activeView === 'multimedia' && dx < 0)) {
      off *= 0.2
    }
    setDragOffset(off)
  }

  const endGesture = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const s = startRef.current
    if (!s) return

    const wasLocked = lockedRef.current
    const currentX =
      e.clientX !== undefined && Number.isFinite(e.clientX) && e.clientX !== 0
        ? e.clientX
        : s.x + lastDxRef.current
    const dx = currentX - s.x

    startRef.current = null
    lockedRef.current = false
    setDragging(false)
    setDragOffset(0)

    try {
      if (rootRef.current?.hasPointerCapture(s.id)) {
        rootRef.current.releasePointerCapture(s.id)
      }
    } catch { /* noop */ }

    if (!wasLocked) return
    if (cancelled && Math.abs(dx) < SWIPE_THRESHOLD) return

    if (dx <= -SWIPE_THRESHOLD && activeView === 'cluster') {
      setView('multimedia')
    } else if (dx >= SWIPE_THRESHOLD && activeView === 'multimedia') {
      setView('cluster')
    }
  }

  const index = activeView === 'cluster' ? 0 : 1

  return (
    <div
      ref={rootRef}
      className={`relative w-full h-full min-h-0 flex-1 self-stretch select-none overflow-hidden ${
        dragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => endGesture(e)}
      onPointerCancel={(e) => endGesture(e, true)}
      style={{ touchAction: 'pan-y' }}
      aria-label="Slot inferior de instrumentos e multimídia"
      data-swipe-slot
    >
      {/* Botão pill acessível + indicador de bolinhas */}
      <div className="absolute top-0.5 right-1 z-30 flex items-center gap-1 pointer-events-auto">
        <button
          type="button"
          onClick={() => setView(activeView === 'cluster' ? 'multimedia' : 'cluster')}
          className="px-1.5 py-px rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/20 font-mono text-[8px] font-black tracking-wider shadow flex items-center gap-1 active:scale-95 cursor-pointer"
          title="Alternar entre Painel de Instrumentos e Central Multimídia"
        >
          <span>{activeView === 'cluster' ? '📺' : '📟'}</span>
          <span>{activeView === 'cluster' ? 'MÍDIA' : 'PAINEL'}</span>
        </button>
        <div className="flex items-center gap-1 bg-black/70 px-1 py-0.5 rounded-full border border-white/10">
          <button
            type="button"
            onClick={() => setView('cluster')}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${activeView === 'cluster' ? 'bg-amber-400 w-3' : 'bg-zinc-600 hover:bg-zinc-400 w-1.5'}`}
            title="Ver Painel"
            aria-label="Ver Painel"
          />
          <button
            type="button"
            onClick={() => setView('multimedia')}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${activeView === 'multimedia' ? 'bg-cyan-400 w-3' : 'bg-zinc-600 hover:bg-zinc-400 w-1.5'}`}
            title="Ver Multimídia"
            aria-label="Ver Multimídia"
          />
        </div>
      </div>

      {/* Esteira: dois painéis de MESMA largura e altura (cada um = 100% do slot) */}
      <div
        className={`absolute inset-y-0 left-0 flex ${dragging ? '' : 'transition-transform duration-300 ease-out'}`}
        style={{
          width: '200%',
          transform: `translateX(calc(${-index * 50}% + ${dragOffset}px))`,
          touchAction: 'pan-y',
        }}
        data-swipe-track
      >
        <div
          className="relative h-full w-1/2"
          data-pane="cluster"
          aria-hidden={activeView !== 'cluster'}
          style={{ pointerEvents: dragging ? 'none' : (activeView === 'cluster' ? 'auto' : 'none') }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            {supportsPaddleShifters && isManualActive && (
              <div className="flex-shrink-0 mr-1 z-20 pointer-events-auto">
                <AutomaticShiftButton direction="down" />
              </div>
            )}
            <div className="flex-1 h-full min-w-0 flex items-center justify-center">
              <VehicleDashboardCluster telemetry={telemetry} expanded={expanded} />
            </div>
            {supportsPaddleShifters && isManualActive && (
              <div className="flex-shrink-0 ml-1 z-20 pointer-events-auto">
                <AutomaticShiftButton direction="up" />
              </div>
            )}
            {(hasTurbo || showAftermarketBoostGauge) && (
              <span className="pointer-events-none absolute top-0.5 left-1 px-1.5 py-px rounded-full bg-black/85 border border-amber-500/40 text-[8px] font-mono text-amber-300">
                TURBO <b>{boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR</b>
              </span>
            )}
          </div>
        </div>

        <div
          className="relative h-full w-1/2"
          data-pane="multimedia"
          aria-hidden={activeView !== 'multimedia'}
          style={{ pointerEvents: dragging ? 'none' : (activeView === 'multimedia' ? 'auto' : 'none') }}
        >
          <InfotainmentScreen vehicle={vehicle} telemetry={telemetry} fill />
        </div>
      </div>
    </div>
  )
})
