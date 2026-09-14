import { memo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

/**
 * EngineButton — Botão estilo Start/Stop Engine.
 *
 * Estados:
 * - RUNNING: Borda vermelha luminosa (Start/Stop)
 * - CRANKING: Dando partida no motor (pisca em ciano)
 * - STALLED: Motor estolou/morreu (alerta pulsante âmbar/laranja convidando a religar)
 * - OFF: Desligado (pulsando suavemente)
 */
export const EngineButton = memo(function EngineButton() {
  const isRunning = useSimulationStore((s) => s.isRunning)
  const isStalled = useSimulationStore((s) => s.isStalled)
  const status = useSimulationStore((s) => s.status)
  const startEngine = useSimulationStore((s) => s.startEngine)
  const stopEngine = useSimulationStore((s) => s.stopEngine)

  const handleClick = () => {
    if (isRunning) {
      stopEngine()
    } else {
      startEngine()
    }
  }

  const isStarting = status === 'starting'

  return (
    <div className="flex flex-col items-center select-none touch-none">
      <button
        onClick={handleClick}
        className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center p-2 transition-all active:scale-95 duration-200 cursor-pointer ${
          isStalled
            ? 'border-amber-500 bg-amber-950/60 text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-bounce'
            : isStarting
            ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.4)] animate-pulse'
            : isRunning
            ? 'border-red-500 bg-red-950/40 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
            : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 animate-pulse'
        }`}
        aria-label={isRunning ? 'Desligar motor' : isStalled ? 'Religar motor estolado' : 'Ligar motor'}
      >
        <span className="text-[8px] font-bold tracking-widest uppercase text-zinc-400">Engine</span>
        <span className="text-[11px] font-black tracking-tighter uppercase my-0.5">
          {isStalled ? 'RESTART' : isStarting ? 'CRANK' : 'START'}
        </span>
        <span className="text-[8px] font-bold tracking-widest uppercase text-zinc-500">
          {isStalled ? 'STALLED' : isRunning ? 'STOP' : 'PUSH'}
        </span>
      </button>

      {/* Indicador de status abaixo do botão */}
      {isStalled && (
        <span className="text-[9px] font-mono font-bold text-amber-400 mt-1 uppercase tracking-wider animate-pulse">
          Motor Morreu!
        </span>
      )}
    </div>
  )
})
