import React from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

interface HPatternShifterProps {
  className?: string
  gearCount?: number
}

/**
 * HPatternShifter — Alavanca de Câmbio Manual em Grade H interativa.
 * Permite selecionar diretamente 1ª a 6ª marcha, Ré e Ponto Morto (N).
 * Simula a física de trava mecânica: se trocar em movimento sem embreagem,
 * o sincronizador arranha (Crrrck!) e acende alerta.
 */
export const HPatternShifter: React.FC<HPatternShifterProps> = ({
  className = '',
  gearCount = 5,
}) => {
  const currentGear = useSimulationStore((s) => s.currentGear)
  const isGearGrinding = useSimulationStore((s) => s.isGearGrinding)
  const clutchPosition = useSimulationStore((s) => s.clutchPosition)
  const shiftHPattern = useSimulationStore((s) => s.shiftHPattern)
  const isEngineBlown = useSimulationStore((s) => s.isEngineBlown)

  const isClutchEngaged = clutchPosition >= 0.45

  // Posições da grade
  const gears = [
    { label: 'R', gear: -1, col: 0, row: 0, color: 'text-red-400 border-red-500/50' },
    { label: '1', gear: 1, col: 1, row: 0, color: 'text-amber-400 border-amber-500/50' },
    { label: '3', gear: 3, col: 2, row: 0, color: 'text-cyan-400 border-cyan-500/50' },
    { label: '5', gear: 5, col: 3, row: 0, color: 'text-emerald-400 border-emerald-500/50' },
    { label: '2', gear: 2, col: 1, row: 2, color: 'text-amber-400 border-amber-500/50' },
    { label: '4', gear: 4, col: 2, row: 2, color: 'text-cyan-400 border-cyan-500/50' },
    gearCount >= 6 ? { label: '6', gear: 6, col: 3, row: 2, color: 'text-emerald-400 border-emerald-500/50' } : null,
  ].filter(Boolean) as { label: string; gear: number; col: number; row: number; color: string }[]

  return (
    <div
      className={`relative flex flex-col items-center rounded-2xl border border-white/10 bg-neutral-900/90 p-4 shadow-2xl backdrop-blur-md ${className}`}
    >
      <div className="mb-2 flex w-full items-center justify-between text-[11px] font-mono">
        <span className="font-bold tracking-wider text-neutral-400">H-SHIFTER MANUAL</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
            isClutchEngaged ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}
        >
          {isClutchEngaged ? 'EMBREAGEM ACIONADA' : 'EMBREAGEM SOLTA'}
        </span>
      </div>

      {/* Alerta de sincronizador arranhando */}
      {isGearGrinding && (
        <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-red-500 bg-red-950/80 px-2.5 py-1 text-center font-mono text-[11px] font-black text-red-300 animate-bounce">
          <span>⚠️</span> ARRANHOU! PISE NA EMBREAGEM!
        </div>
      )}

      {/* Grade Mecânica */}
      <div className="relative my-2 w-48 h-36 rounded-xl border border-neutral-700/60 bg-neutral-950/90 p-3 flex flex-col justify-between shadow-inner">
        {/* Linhas da grade (sulcos de metal) */}
        <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 h-2.5 rounded bg-neutral-800 border-y border-neutral-700 shadow-inner" />
        <div className="pointer-events-none absolute left-9 top-4 bottom-4 w-2 rounded bg-neutral-800 border-x border-neutral-700 shadow-inner" />
        <div className="pointer-events-none absolute left-[4.8rem] top-4 bottom-4 w-2 rounded bg-neutral-800 border-x border-neutral-700 shadow-inner" />
        <div className="pointer-events-none absolute left-[7.8rem] top-4 bottom-4 w-2 rounded bg-neutral-800 border-x border-neutral-700 shadow-inner" />
        {gearCount >= 5 && (
          <div className="pointer-events-none absolute right-7 top-4 bottom-4 w-2 rounded bg-neutral-800 border-x border-neutral-700 shadow-inner" />
        )}

        {/* Linha Superior (R, 1, 3, 5) */}
        <div className="relative z-10 flex justify-between items-center px-2">
          {gears
            .filter((g) => g.row === 0)
            .map((g) => {
              const isActive = currentGear === g.gear
              return (
                <button
                  key={g.label}
                  disabled={isEngineBlown}
                  onClick={() => shiftHPattern(g.gear)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full font-mono text-xs font-bold transition-all shadow-md active:scale-95 ${
                    isActive
                      ? 'border-2 border-white bg-white text-black font-black shadow-lg shadow-white/30 scale-110'
                      : `border bg-neutral-800/90 hover:bg-neutral-700 ${g.color}`
                  }`}
                >
                  {g.label}
                </button>
              )
            })}
        </div>

        {/* Linha Central: Botão de Neutro (Ponto Morto) */}
        <div className="relative z-10 flex justify-center">
          <button
            onClick={() => shiftHPattern(0)}
            className={`rounded-full px-3 py-0.5 font-mono text-[11px] font-bold transition-all shadow active:scale-95 ${
              currentGear === 0
                ? 'border-2 border-amber-400 bg-amber-400 text-black font-black shadow-amber-400/30'
                : 'border border-neutral-600 bg-neutral-800/80 text-neutral-400 hover:text-white'
            }`}
          >
            NEUTRO (N)
          </button>
        </div>

        {/* Linha Inferior (2, 4, 6) */}
        <div className="relative z-10 flex justify-around items-center px-6">
          {gears
            .filter((g) => g.row === 2)
            .map((g) => {
              const isActive = currentGear === g.gear
              return (
                <button
                  key={g.label}
                  disabled={isEngineBlown}
                  onClick={() => shiftHPattern(g.gear)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full font-mono text-xs font-bold transition-all shadow-md active:scale-95 ${
                    isActive
                      ? 'border-2 border-white bg-white text-black font-black shadow-lg shadow-white/30 scale-110'
                      : `border bg-neutral-800/90 hover:bg-neutral-700 ${g.color}`
                  }`}
                >
                  {g.label}
                </button>
              )
            })}
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between w-full px-1 text-[10px] font-mono text-neutral-400">
        <span>MARCHA ATUAL: <strong className="text-white text-xs">{currentGear === -1 ? 'R' : currentGear === 0 ? 'N' : currentGear}</strong></span>
        <span>MODO: H-GATE</span>
      </div>
    </div>
  )
}

