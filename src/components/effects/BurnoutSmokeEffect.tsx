import React from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

/**
 * BurnoutSmokeEffect — Renderiza partículas de fumaça densa de pneus fritando no asfalto.
 */
export const BurnoutSmokeEffect: React.FC = () => {
  const isBurningOut = useSimulationStore((s) => s.isBurningOut)
  const tireSmokeDensity = useSimulationStore((s) => s.tireSmokeDensity)

  if (tireSmokeDensity <= 0.02 && !isBurningOut) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      style={{ opacity: Math.min(1.0, tireSmokeDensity * 1.2) }}
    >
      {/* Nuvens de fumaça nas laterais e na base da tela */}
      <div className="absolute -bottom-10 -left-10 h-72 w-96 rounded-full bg-slate-300/40 blur-3xl animate-pulse" />
      <div className="absolute -bottom-10 -right-10 h-72 w-96 rounded-full bg-slate-300/40 blur-3xl animate-pulse delay-150" />
      <div className="absolute bottom-4 left-1/4 h-56 w-80 rounded-full bg-slate-200/35 blur-2xl animate-ping" />
      <div className="absolute bottom-2 right-1/4 h-56 w-80 rounded-full bg-slate-200/35 blur-2xl animate-ping delay-200" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-300/50 via-slate-400/20 to-transparent blur-xl" />

      {/* Partículas flutuantes de fumaça */}
      <div className="absolute bottom-6 left-12 flex items-center gap-2 rounded-full border border-amber-500/40 bg-black/80 px-3 py-1 font-mono text-xs font-bold text-amber-400 backdrop-blur-md shadow-lg shadow-amber-500/20">
        <span className="h-2.5 w-2.5 animate-ping rounded-full bg-amber-500" />
        BURNOUT FERVENDO PNEUS ({Math.round(tireSmokeDensity * 100)}%)
      </div>
    </div>
  )
}
