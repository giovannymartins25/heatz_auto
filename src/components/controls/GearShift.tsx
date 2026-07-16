import { memo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

/**
 * GearShift — Controles de troca de marcha sequencial estilo Paddle Shift (borboletas).
 *
 * Oferece dois botões gigantes nas laterais da tela (ou centralizados no mobile)
 * para subir (+) ou descer (-) as marchas, além de um botão menor para Neutro (N).
 */
export const GearShift = memo(function GearShift() {
  const currentGear = useSimulationStore((s) => s.currentGear)
  const shiftUp = useSimulationStore((s) => s.shiftUp)
  const shiftDown = useSimulationStore((s) => s.shiftDown)
  const shiftNeutral = useSimulationStore((s) => s.shiftNeutral)
  const isRunning = useSimulationStore((s) => s.isRunning)

  return (
    <div className="flex items-center gap-6 select-none touch-none">
      {/* Botão Downshift (-) */}
      <button
        onClick={shiftDown}
        disabled={!isRunning}
        className="w-16 h-16 rounded-full border-2 border-zinc-700 bg-zinc-900/50 active:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center font-mono font-bold text-2xl text-[var(--color-text-secondary)] transition-all active:scale-95 border-subtle"
        aria-label="Marcha abaixo"
      >
        -
      </button>

      {/* Botão Neutro (N) */}
      <button
        onClick={shiftNeutral}
        disabled={!isRunning || currentGear === 0}
        className={`w-12 h-12 rounded-lg border font-mono font-bold text-sm flex items-center justify-center transition-all active:scale-95 ${
          currentGear === 0
            ? 'border-green-500/50 bg-green-950/20 text-green-400'
            : 'border-zinc-800 bg-zinc-950 text-zinc-600 disabled:opacity-35'
        }`}
        aria-label="Engatar Neutro"
      >
        N
      </button>

      {/* Botão Upshift (+) */}
      <button
        onClick={shiftUp}
        disabled={!isRunning}
        className="w-16 h-16 rounded-full border-2 border-zinc-700 bg-zinc-900/50 active:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center font-mono font-bold text-2xl text-[var(--color-accent)] transition-all active:scale-95 border-subtle"
        aria-label="Marcha acima"
      >
        +
      </button>
    </div>
  )
})
