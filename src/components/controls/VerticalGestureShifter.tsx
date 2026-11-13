import { memo, useRef, useState, useCallback } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'

export interface VerticalGestureShifterProps {
  className?: string
  size?: 'compact' | 'normal'
}

/**
 * VerticalGestureShifter — Controle vertical de troca de marcha por gesto (Swipe / Drag / Tap).
 *
 * Requisitos:
 * - Arrastar / Deslizar para cima: aumenta a marcha / relação virtual (+)
 * - Arrastar / Deslizar para baixo: reduz a marcha / relação virtual (-)
 * - Toques diretos nos polos [+] e [-] também acionam a troca
 * - Retorno automático suave ao centro (mola) ao soltar
 * - Proteção contra repetição acidental (apenas 1 troca por curso de gesto)
 * - Feedback visual e tátil com iluminação dinâmica
 */
export const VerticalGestureShifter = memo(function VerticalGestureShifter({
  className = '',
  size = 'normal',
}: VerticalGestureShifterProps) {
  const isRunning = useSimulationStore((s) => s.isRunning)
  const shiftUp = useSimulationStore((s) => s.shiftUp)
  const shiftDown = useSimulationStore((s) => s.shiftDown)

  const [knobOffset, setKnobOffset] = useState(0) // Deslocamento vertical em px (-24 a +24)
  const [activeZone, setActiveZone] = useState<'up' | 'down' | null>(null)
  const startYRef = useRef<number | null>(null)
  const hasTriggeredRef = useRef(false)
  const isDraggingRef = useRef(false)

  const triggerUp = useCallback(() => {
    if (!isRunning) return
    shiftUp()
    HapticFeedback.gearShift()
    setActiveZone('up')
    setTimeout(() => setActiveZone(null), 250)
  }, [isRunning, shiftUp])

  const triggerDown = useCallback(() => {
    if (!isRunning) return
    shiftDown()
    HapticFeedback.gearShift()
    setActiveZone('down')
    setTimeout(() => setActiveZone(null), 250)
  }, [isRunning, shiftDown])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isRunning) return
    startYRef.current = e.clientY
    hasTriggeredRef.current = false
    isDraggingRef.current = true
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Ignora se não for suportado
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || startYRef.current === null) return
    const deltaY = e.clientY - startYRef.current

    // Limita o deslocamento visual do pomo (-24px a +24px)
    const clampedOffset = Math.max(-24, Math.min(24, deltaY))
    setKnobOffset(clampedOffset)

    // Limiar de ativação do gesto: 16px
    if (!hasTriggeredRef.current) {
      if (deltaY <= -16) {
        hasTriggeredRef.current = true
        triggerUp()
      } else if (deltaY >= 16) {
        hasTriggeredRef.current = true
        triggerDown()
      }
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    startYRef.current = null
    hasTriggeredRef.current = false
    setKnobOffset(0) // Retorna ao centro

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignora
    }
  }

  const widthClass = size === 'compact' ? 'w-10' : 'w-11 sm:w-12'
  const heightClass = size === 'compact' ? 'h-28' : 'h-32 sm:h-36'

  return (
    <div
      aria-label="Controle de Câmbio por Gesto Vertical (+ / -)"
      title="Deslize para cima (+) ou para baixo (-) para trocar de marcha"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none' }}
      className={`relative select-none flex flex-col items-center justify-between p-1 rounded-2xl bg-zinc-950/95 border border-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.8),inset_0_1px_4px_rgba(255,255,255,0.06)] cursor-grab active:cursor-grabbing ${widthClass} ${heightClass} ${className}`}
    >
      {/* ── Polo Superior: (+) ── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          triggerUp()
        }}
        className={`w-full py-1.5 rounded-xl flex flex-col items-center justify-center transition-all ${
          activeZone === 'up' || knobOffset < -10
            ? 'bg-amber-500/30 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.5)] font-black'
            : 'text-zinc-400 hover:text-white'
        }`}
      >
        <span className="text-base font-black leading-none">+</span>
        <span className="text-[6.5px] font-mono tracking-widest uppercase opacity-75">UP</span>
      </button>

      {/* ── Trilho Central e Pomo Móvel ── */}
      <div className="relative w-full flex-1 flex items-center justify-center my-0.5">
        {/* Linha guia do trilho */}
        <div className="absolute inset-y-1 w-1 bg-zinc-800 rounded-full" />

        {/* Pomo de Alavanca Tátil */}
        <div
          style={{
            transform: `translateY(${knobOffset}px)`,
            transition: isDraggingRef.current ? 'none' : 'transform 180ms cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
          className={`relative z-10 w-8 h-8 rounded-xl border-2 flex items-center justify-center shadow-lg transition-colors pointer-events-none ${
            activeZone === 'up'
              ? 'bg-amber-500 border-amber-300 text-black shadow-[0_0_12px_rgba(245,158,11,0.85)]'
              : activeZone === 'down'
              ? 'bg-sky-500 border-sky-300 text-white shadow-[0_0_12px_rgba(56,189,248,0.85)]'
              : 'bg-gradient-to-b from-zinc-800 via-zinc-900 to-black border-zinc-600 text-zinc-300'
          }`}
        >
          {/* Ranhura antiderrapante do pomo */}
          <div className="flex flex-col gap-0.5 items-center justify-center">
            <span className="block w-3.5 h-0.5 bg-white/40 rounded-full" />
            <span className="block w-3.5 h-0.5 bg-white/60 rounded-full" />
            <span className="block w-3.5 h-0.5 bg-white/40 rounded-full" />
          </div>
        </div>
      </div>

      {/* ── Polo Inferior: (-) ── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          triggerDown()
        }}
        className={`w-full py-1.5 rounded-xl flex flex-col items-center justify-center transition-all ${
          activeZone === 'down' || knobOffset > 10
            ? 'bg-sky-500/30 text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.5)] font-black'
            : 'text-zinc-400 hover:text-white'
        }`}
      >
        <span className="text-[6.5px] font-mono tracking-widest uppercase opacity-75">DOWN</span>
        <span className="text-base font-black leading-none">−</span>
      </button>
    </div>
  )
})
