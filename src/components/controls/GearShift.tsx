import { memo, useEffect, useState } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

export interface GearShiftProps {
  orientation?: 'horizontal' | 'vertical'
  size?: 'normal' | 'compact' | 'large'
}

/**
 * GearShift — Controles táteis de troca de marcha sequencial estilo Paddle Shift.
 *
 * Utiliza diretamente shiftUp() e shiftDown() da store, mantendo a mesma física.
 * Exibe feedback visual ("PRESSIONE A EMBREAGEM" / "OVER-REV") quando uma troca é bloqueada.
 */
export const GearShift = memo(function GearShift({
  orientation = 'horizontal',
  size = 'normal',
}: GearShiftProps) {
  const currentGear = useSimulationStore((s) => s.currentGear)
  const shiftUp = useSimulationStore((s) => s.shiftUp)
  const shiftDown = useSimulationStore((s) => s.shiftDown)
  const shiftNeutral = useSimulationStore((s) => s.shiftNeutral)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const lastShiftReason = useSimulationStore((s) => s.lastShiftReason)

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  useEffect(() => {
    if (lastShiftReason === 'clutch_required') {
      setFeedbackMessage('PRESSIONE A EMBREAGEM')
      const t = setTimeout(() => setFeedbackMessage(null), 1800)
      return () => clearTimeout(t)
    } else if (lastShiftReason === 'over_rev') {
      setFeedbackMessage('SOBREGIRO BLOQUEADO')
      const t = setTimeout(() => setFeedbackMessage(null), 1800)
      return () => clearTimeout(t)
    } else {
      setFeedbackMessage(null)
    }
  }, [lastShiftReason])

  const buttonSizeClass = {
    compact: 'w-12 h-12 text-lg',
    normal: 'w-14 h-14 sm:w-16 sm:h-16 text-xl sm:text-2xl',
    large: 'w-16 h-16 sm:w-20 sm:h-20 text-2xl sm:text-3xl',
  }[size]

  return (
    <div className="flex flex-col items-center select-none touch-none relative">
      {/* Alerta de Feedback Visual Rápido */}
      {feedbackMessage && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap px-2.5 py-0.5 rounded bg-red-500/90 text-white font-mono text-[9px] font-black tracking-wider uppercase shadow-lg shadow-red-500/30 animate-pulse">
          {feedbackMessage}
        </div>
      )}

      <div
        className={`flex items-center gap-3 sm:gap-4 ${
          orientation === 'vertical' ? 'flex-col-reverse' : 'flex-row'
        }`}
      >
        {/* Botão Downshift (▼ -) */}
        <button
          id="btn-shift-down"
          onClick={shiftDown}
          disabled={!isRunning}
          className={`${buttonSizeClass} rounded-2xl border-2 border-zinc-700/80 bg-zinc-900/80 active:bg-zinc-800 active:border-zinc-500 disabled:opacity-30 disabled:pointer-events-none flex flex-col items-center justify-center font-mono font-black text-[var(--color-text-secondary)] transition-all active:scale-90 cursor-pointer shadow-lg`}
          aria-label="Reduzir marcha"
          title="Tecla ] — Reduzir marcha"
        >
          <span className="text-[10px] leading-none text-zinc-500">▼</span>
          <span className="leading-none mt-0.5">-</span>
        </button>

        {/* Botão Neutro (N) */}
        <button
          id="btn-shift-neutral"
          onClick={shiftNeutral}
          disabled={!isRunning || currentGear === 0}
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border font-mono font-black text-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
            currentGear === 0
              ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              : 'border-zinc-800 bg-zinc-950/80 text-zinc-600 disabled:opacity-35'
          }`}
          aria-label="Engatar Neutro"
          title="Engatar Neutro"
        >
          N
        </button>

        {/* Botão Upshift (▲ +) */}
        <button
          id="btn-shift-up"
          onClick={shiftUp}
          disabled={!isRunning}
          className={`${buttonSizeClass} rounded-2xl border-2 border-zinc-700/80 bg-zinc-900/80 active:bg-zinc-800 active:border-[var(--color-accent)] disabled:opacity-30 disabled:pointer-events-none flex flex-col items-center justify-center font-mono font-black text-[var(--color-accent)] transition-all active:scale-90 cursor-pointer shadow-lg`}
          aria-label="Subir marcha"
          title="Tecla [ — Subir marcha"
        >
          <span className="text-[10px] leading-none text-[var(--color-accent-muted)]">▲</span>
          <span className="leading-none mt-0.5">+</span>
        </button>
      </div>
    </div>
  )
})
