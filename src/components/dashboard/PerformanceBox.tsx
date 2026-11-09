import { memo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

export const PerformanceBox = memo(function PerformanceBox() {
  const current0to100 = useSimulationStore((s) => s.current0to100)
  const best0to100 = useSimulationStore((s) => s.best0to100)
  const isTiming0to100 = useSimulationStore((s) => s.isTiming0to100)
  const topSpeedRecord = useSimulationStore((s) => s.topSpeedRecord)
  const resetPerformanceStats = useSimulationStore((s) => s.resetPerformanceStats)

  return (
    <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-1.5 rounded-2xl bg-zinc-950/80 border border-white/10 shadow-lg text-xs font-mono select-none backdrop-blur-md">
      {/* 0-100 km/h */}
      <div className="flex flex-col items-center">
        <span className="text-[9px] uppercase tracking-wider text-zinc-500">0-100 KM/H</span>
        <div className="flex items-baseline gap-0.5">
          <span
            className={`text-sm sm:text-base font-bold ${
              isTiming0to100
                ? 'text-amber-400 animate-pulse'
                : current0to100
                ? 'text-emerald-400'
                : 'text-zinc-500'
            }`}
          >
            {current0to100 !== null ? `${current0to100.toFixed(2)}s` : '--'}
          </span>
        </div>
      </div>

      <div className="w-[1px] h-6 bg-white/10" />

      {/* Melhor Tempo */}
      <div className="flex flex-col items-center">
        <span className="text-[9px] uppercase tracking-wider text-zinc-500">MELHOR</span>
        <span className="text-sm sm:text-base font-bold text-amber-400">
          {best0to100 !== null ? `${best0to100.toFixed(2)}s` : '--'}
        </span>
      </div>

      <div className="w-[1px] h-6 bg-white/10" />

      {/* Top Speed */}
      <div className="flex flex-col items-center">
        <span className="text-[9px] uppercase tracking-wider text-zinc-500">TOP SPEED</span>
        <span className="text-sm sm:text-base font-bold text-sky-400">
          {topSpeedRecord > 0 ? `${topSpeedRecord} km/h` : '--'}
        </span>
      </div>

      {/* Botão de Reset */}
      {(best0to100 !== null || topSpeedRecord > 0) && (
        <button
          onClick={resetPerformanceStats}
          title="Zerar estatísticas de arrancada"
          className="ml-1 text-[10px] text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
        >
          ✕
        </button>
      )}
    </div>
  )
})

