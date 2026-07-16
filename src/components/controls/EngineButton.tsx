import { memo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

/**
 * EngineButton — Botão estilo Start/Stop Engine.
 *
 * Liga o motor ao ser pressionado. Possui efeito de luz vermelha pulsante
 * quando o veículo está parado, e brilha intensamente quando está ligado.
 */
export const EngineButton = memo(function EngineButton() {
  const isRunning = useSimulationStore((s) => s.isRunning)
  const startEngine = useSimulationStore((s) => s.startEngine)
  const stopEngine = useSimulationStore((s) => s.stopEngine)

  const handleClick = () => {
    if (isRunning) {
      stopEngine()
    } else {
      startEngine()
    }
  }

  return (
    <div className="flex flex-col items-center select-none touch-none">
      <button
        onClick={handleClick}
        className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center p-2 transition-all active:scale-95 duration-200 cursor-pointer ${
          isRunning
            ? 'border-red-500 bg-red-950/40 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
            : 'border-zinc-700 bg-zinc-900 text-zinc-400 animate-pulse'
        }`}
        style={{
          boxShadow: isRunning ? '0 0 25px rgba(239, 68, 68, 0.3)' : 'none',
        }}
        aria-label={isRunning ? 'Desligar motor' : 'Ligar motor'}
      >
        <span className="text-[8px] font-bold tracking-widest uppercase text-zinc-500">Engine</span>
        <span className="text-[12px] font-black tracking-tighter uppercase my-0.5">START</span>
        <span className="text-[8px] font-bold tracking-widest uppercase text-zinc-500">STOP</span>
      </button>
    </div>
  )
})
