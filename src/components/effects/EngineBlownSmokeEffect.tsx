import React from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore } from '@/stores/useUIStore'

/**
 * EngineBlownSmokeEffect — Efeito de vapor/fumaça de motor fundido ou superaquecido
 * com painel de diagnóstico e botão de reparo imediato.
 */
export const EngineBlownSmokeEffect: React.FC = () => {
  const isEngineBlown = useSimulationStore((s) => s.isEngineBlown)
  const damageReason = useSimulationStore((s) => s.damageReason)
  const coolantTemp = useSimulationStore((s) => s.coolantTemp)
  const isOutOfFuel = useSimulationStore((s) => s.isOutOfFuel)
  const repairEngine = useSimulationStore((s) => s.repairEngine)
  const refuel = useSimulationStore((s) => s.refuel)
  const graphicProfile = useUIStore((s) => s.graphicProfile)

  const isOverheating = coolantTemp >= 118

  if (!isEngineBlown && !isOverheating && !isOutOfFuel) return null

  const blurClass = graphicProfile === 'eco' ? 'blur-md' : 'blur-3xl'

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden flex flex-col items-center justify-start pt-12">
      {/* Vapor espesso do capô */}
      <div className={`absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-white/30 via-slate-200/20 to-transparent ${blurClass} animate-pulse`} />
      {graphicProfile !== 'eco' && (
        <>
          <div className="absolute top-8 left-1/3 h-64 w-80 rounded-full bg-white/25 blur-2xl animate-ping" />
          <div className="absolute top-12 right-1/3 h-64 w-80 rounded-full bg-white/25 blur-2xl animate-ping delay-300" />
        </>
      )}

      {/* Banner de Diagnóstico e Ação de Reparo (com pointer-events-auto) */}
      <div className="pointer-events-auto relative mt-4 max-w-md rounded-2xl border-2 border-red-500/80 bg-black/90 p-5 text-center shadow-2xl shadow-red-500/40 backdrop-blur-xl animate-in fade-in zoom-in-95">
        <div className="mb-2 flex items-center justify-center gap-2">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
          </span>
          <h3 className="font-mono text-base font-black uppercase tracking-wider text-red-500">
            {isEngineBlown
              ? 'MOTOR FUNDIDO / QUEBRA CATASTRÓFICA'
              : isOutOfFuel
              ? 'PANE SECA — TANQUE VAZIO'
              : 'ALERTA CRÍTICO: SUPERAQUECIMENTO!'}
          </h3>
        </div>

        <p className="font-mono text-xs text-neutral-300 leading-relaxed mb-4">
          {damageReason ||
            (isEngineBlown
              ? 'O motor sofreu danos internos severos e parou de funcionar.'
              : isOutOfFuel
              ? 'O combustível acabou! Abasteça o carro para dar nova partida.'
              : `Líquido de arrefecimento atingiu ${Math.round(coolantTemp)}°C! Pare imediatamente para não fundir o motor.`)}
        </p>

        <div className="flex items-center justify-center gap-3">
          {isOutOfFuel ? (
            <button
              onClick={() => refuel(20)}
              className="rounded-xl border border-amber-500 bg-amber-600/90 px-5 py-2 font-mono text-xs font-bold text-white shadow-lg transition hover:bg-amber-500 active:scale-95"
            >
              ⛽ ABASTECER 20 LITROS
            </button>
          ) : (
            <button
              onClick={repairEngine}
              className="rounded-xl border border-red-500 bg-red-600 px-5 py-2 font-mono text-xs font-bold text-white shadow-lg transition hover:bg-red-500 active:scale-95"
            >
              🔧 REPARAR MOTOR & RESFRIAR
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

