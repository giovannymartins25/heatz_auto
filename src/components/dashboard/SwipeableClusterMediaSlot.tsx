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

/**
 * SwipeableClusterMediaSlot — Container inferior do Cockpit Heatz Auto.
 *
 * Ocupa exatamente o mesmo retângulo tanto para o Cluster original do veículo
 * quanto para a Central Multimídia.
 *
 * Funcionalidades:
 * - Arraste / swipe horizontal (esquerda/direita >= 40px) com transição suave.
 * - Botão pill acessível no canto [📺 MÍDIA] / [📟 PAINEL] como alternativa ao gesto.
 * - Indicador discreto em bolinhas (● ○).
 * - Isolamento total de eventos touch (touchAction: pan-y, stopPropagation).
 * - Não interfere na física, motor, áudio, acelerador, freio ou mapa.
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
  const [activeView, setActiveView] = useState<'cluster' | 'multimedia'>(initialView)
  const [dragOffset, setDragOffset] = useState(0)

  const startXRef = useRef<number | null>(null)
  const startYRef = useRef<number | null>(null)
  const isSwipingRef = useRef(false)

  const toggleView = useCallback(() => {
    setActiveView((prev) => {
      const next = prev === 'cluster' ? 'multimedia' : 'cluster'
      HapticFeedback.light()
      onViewChange?.(next)
      return next
    })
  }, [onViewChange])

  const setView = useCallback((view: 'cluster' | 'multimedia') => {
    setActiveView(view)
    HapticFeedback.light()
    onViewChange?.(view)
  }, [onViewChange])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return
    const target = e.target as HTMLElement
    // Não sequestrar toques de botões internos
    if (target.closest('button, a, input, select, textarea, [data-prevent-swipe]')) {
      return
    }

    startXRef.current = e.clientX
    startYRef.current = e.clientY
    isSwipingRef.current = true
    e.stopPropagation()
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSwipingRef.current || startXRef.current === null || startYRef.current === null) return
    const dx = e.clientX - startXRef.current
    const dy = e.clientY - startYRef.current

    // Cancela se for gesto vertical preponderante
    if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > 10) {
      isSwipingRef.current = false
      setDragOffset(0)
      return
    }

    // Amortecimento de arraste
    const dampedDx = Math.max(-100, Math.min(100, dx))
    setDragOffset(dampedDx)
    e.stopPropagation()
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSwipingRef.current || startXRef.current === null) {
      startXRef.current = null
      startYRef.current = null
      isSwipingRef.current = false
      setDragOffset(0)
      return
    }

    const dx = e.clientX - startXRef.current
    const SWIPE_THRESHOLD = 40 // >= 40px

    if (dx < -SWIPE_THRESHOLD) {
      // Swipe para a esquerda
      setActiveView((prev) => {
        const next = prev === 'cluster' ? 'multimedia' : 'cluster'
        HapticFeedback.light()
        onViewChange?.(next)
        return next
      })
    } else if (dx > SWIPE_THRESHOLD) {
      // Swipe para a direita
      setActiveView((prev) => {
        const next = prev === 'multimedia' ? 'cluster' : 'multimedia'
        HapticFeedback.light()
        onViewChange?.(next)
        return next
      })
    }

    startXRef.current = null
    startYRef.current = null
    isSwipingRef.current = false
    setDragOffset(0)
    e.stopPropagation()
  }

  return (
    <div
      className={`relative w-full h-full min-h-0 flex-1 self-stretch flex items-center justify-center select-none overflow-hidden ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'pan-y' }}
      aria-label="Slot inferior de instrumentos e multimídia"
    >
      {/* Botão Pill Acessível e Indicador no topo do slot */}
      <div className="absolute top-1 right-2 z-30 flex items-center gap-1.5 pointer-events-auto">
        <button
          type="button"
          onClick={toggleView}
          className="px-2 py-0.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/20 font-mono text-[8.5px] font-black tracking-wider shadow-lg flex items-center gap-1 transition-all active:scale-95 cursor-pointer backdrop-blur-sm"
          title="Alternar entre Painel de Instrumentos e Central Multimídia"
        >
          <span>{activeView === 'cluster' ? '📺' : '📟'}</span>
          <span>{activeView === 'cluster' ? 'MÍDIA' : 'PAINEL'}</span>
        </button>

        {/* Indicador de Bolinhas (Dots) */}
        <div className="flex items-center gap-1 bg-black/70 px-1.5 py-1 rounded-full border border-white/10 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setView('cluster')}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${
              activeView === 'cluster' ? 'bg-amber-400 w-3' : 'bg-zinc-600 hover:bg-zinc-400 w-1.5'
            }`}
            title="Ver Painel"
          />
          <button
            type="button"
            onClick={() => setView('multimedia')}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${
              activeView === 'multimedia' ? 'bg-cyan-400 w-3' : 'bg-zinc-600 hover:bg-zinc-400 w-1.5'
            }`}
            title="Ver Multimídia"
          />
        </div>
      </div>

      {/* Conteúdo Deslizante */}
      <div
        className="w-full h-full min-h-0 flex-1 self-stretch flex items-center justify-center transition-transform duration-150 ease-out"
        style={{
          transform: dragOffset !== 0 ? `translateX(${dragOffset}px)` : undefined,
        }}
      >
        {activeView === 'cluster' ? (
          <div className="w-full h-full flex items-center justify-center relative min-h-0 self-stretch px-0.5">
            {supportsPaddleShifters && isManualActive && (
              <div className="flex-shrink-0 mr-1 sm:mr-2 z-20 pointer-events-auto">
                <AutomaticShiftButton direction="down" />
              </div>
            )}
            <div className="flex-1 h-full min-w-0 flex items-center justify-center">
              <VehicleDashboardCluster telemetry={telemetry} expanded={expanded} />
            </div>
            {supportsPaddleShifters && isManualActive && (
              <div className="flex-shrink-0 ml-1 sm:ml-2 z-20 pointer-events-auto">
                <AutomaticShiftButton direction="up" />
              </div>
            )}
            {(hasTurbo || showAftermarketBoostGauge) && (
              <span className="pointer-events-none absolute top-1 left-2 px-2 py-0.5 rounded-full bg-black/85 border border-amber-500/40 text-[8.5px] font-mono text-amber-300">
                TURBO <b>{boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR</b>
              </span>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center min-h-0 self-stretch p-0.5">
            <InfotainmentScreen vehicle={vehicle} telemetry={telemetry} compact={!expanded} />
          </div>
        )}
      </div>
    </div>
  )
})
