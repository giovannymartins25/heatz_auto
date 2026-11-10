import { memo } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import { useSimulationStore } from '@/stores/useSimulationStore'

interface TuningGarageModalProps {
  isOpen: boolean
  onClose: () => void
  vehicle: VehicleConfig
}

/**
 * TuningGarageModal — Oficina de Preparação Automotiva (Stage 1, 2 e 3).
 *
 * Permite reprogramar a ECU do carro, trocar turbocompressor, downpipe,
 * acionar o difusor de escape e extrair o máximo de potência em tempo real.
 */
export const TuningGarageModal = memo(function TuningGarageModal({
  isOpen,
  onClose,
  vehicle,
}: TuningGarageModalProps) {
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const setTuningStage = useSimulationStore((s) => s.setTuningStage)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const toggleExhaustValve = useSimulationStore((s) => s.toggleExhaustValve)

  if (!isOpen) return null

  const basePower = vehicle.engine.maxPower || 150
  const baseTorque = vehicle.engine.maxTorque || 200
  const baseBoost = vehicle.engine.turbo?.maxBoostBar || 1.1

  const stages = [
    {
      stage: 0 as const,
      name: 'STOCK (ORIGINAL)',
      subtitle: 'Configuração original de fábrica',
      power: basePower,
      torque: baseTorque,
      boost: vehicle.engine.turbo?.enabled ? baseBoost : 0,
      badge: 'FÁBRICA',
      accentColor: 'border-zinc-700 text-zinc-300',
      activeColor: 'bg-zinc-800/80 border-white text-white shadow-lg',
      perks: ['Garantia preservada', 'Consumo equilibrado', 'Emissões padrão'],
    },
    {
      stage: 1 as const,
      name: 'STAGE 1 (REMAP ECU)',
      subtitle: 'Reprogramação de injeção & ponto de ignição',
      power: Math.round(basePower * 1.22),
      torque: Math.round(baseTorque * 1.20),
      boost: vehicle.engine.turbo?.enabled ? Number((baseBoost + 0.35).toFixed(2)) : 0,
      badge: '+22% CV',
      accentColor: 'border-blue-500/50 text-blue-400',
      activeColor: 'bg-blue-950/60 border-blue-400 text-blue-200 shadow-[0_0_20px_rgba(59,130,246,0.5)]',
      perks: ['+400 RPM no corte de giro', '+0.35 bar de pressão de turbo', 'Resposta instantânea de acelerador'],
    },
    {
      stage: 2 as const,
      name: 'STAGE 2 (DOWNPIPE + INTAKE)',
      subtitle: 'Filtro esportivo, escape direto & Pops agressivos',
      power: Math.round(basePower * 1.42),
      torque: Math.round(baseTorque * 1.38),
      boost: vehicle.engine.turbo?.enabled ? Number((baseBoost + 0.65).toFixed(2)) : 0,
      badge: '+42% CV',
      accentColor: 'border-amber-500/50 text-amber-400',
      activeColor: 'bg-amber-950/60 border-amber-400 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.5)]',
      perks: ['Pops & Bangs estalando no escape', 'Espirro de turbina de alta vazão', 'Menos restrição nos gases'],
    },
    {
      stage: 3 as const,
      name: 'STAGE 3 (TURBO FORJADO RACING)',
      subtitle: 'Turbina roletada grande, bielas forjadas & Boost Extremo',
      power: Math.round(basePower * 1.75),
      torque: Math.round(baseTorque * 1.68),
      boost: vehicle.engine.turbo?.enabled ? Number((baseBoost + 1.15).toFixed(2)) : 0,
      badge: '+75% CV',
      accentColor: 'border-red-500/50 text-red-400',
      activeColor: 'bg-red-950/60 border-red-500 text-red-200 shadow-[0_0_25px_rgba(239,68,68,0.7)]',
      perks: ['Pressão de turbo até 2.8 bar', 'Aceleração brutal de arrancada', 'Corte de giro aos berros'],
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md font-mono select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border-2 border-white/20 p-4 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🔧</span>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                OFICINA DE PREPARAÇÃO & TUNING
              </h2>
              <span className="text-[10px] text-zinc-400">
                {vehicle.info.brand} {vehicle.info.name} · Selecione o nível de preparação
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ── Difusor de Escape Rápido ── */}
        <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/80 border border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span>📢</span>
            <div>
              <span className="font-bold text-white block text-[11px]">VÁLVULA DE ESCAPE / DIFUSOR</span>
              <span className="text-[9px] text-zinc-400">
                {exhaustValveOpen ? 'Direto / Straight Pipe (Grave forte & Pops)' : 'Silencioso com abafador'}
              </span>
            </div>
          </div>

          <button
            onClick={toggleExhaustValve}
            className={`px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
              exhaustValveOpen
                ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                : 'bg-zinc-800 text-zinc-400 border border-white/10'
            }`}
          >
            {exhaustValveOpen ? 'ABERTO (V)' : 'FECHADO'}
          </button>
        </div>

        {/* ── Lista de Estágios de Preparação ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {stages.map((st) => {
            const isSelected = tuningStage === st.stage
            return (
              <div
                key={st.stage}
                onClick={() => setTuningStage(st.stage)}
                className={`relative p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  isSelected ? st.activeColor : 'bg-zinc-900/40 border-white/10 hover:border-white/20'
                }`}
              >
                {/* Topo do Card */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-black tracking-wide block text-white">
                      {st.name}
                    </span>
                    <span className="text-[9px] text-zinc-400 block mt-0.5 leading-tight">
                      {st.subtitle}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider ${
                      isSelected ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {st.badge}
                  </span>
                </div>

                {/* Números de Performance */}
                <div className="grid grid-cols-3 gap-1 py-1.5 px-2 rounded-xl bg-black/40 border border-white/5 text-center">
                  <div>
                    <span className="text-[8px] text-zinc-500 uppercase block">Potência</span>
                    <span className="text-xs font-black text-white">{st.power} cv</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-zinc-500 uppercase block">Torque</span>
                    <span className="text-xs font-black text-amber-400">{st.torque} Nm</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-zinc-500 uppercase block">Turbo</span>
                    <span className="text-xs font-black text-sky-400">
                      {st.boost > 0 ? `+${st.boost}b` : 'Asp.'}
                    </span>
                  </div>
                </div>

                {/* Lista de Vantagens */}
                <ul className="text-[8.5px] text-zinc-400 flex flex-col gap-0.5">
                  {st.perks.map((p, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="text-emerald-400">✓</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>

                {/* Botão de Ativação */}
                <button
                  type="button"
                  className={`w-full py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all mt-1 ${
                    isSelected
                      ? 'bg-white text-black shadow'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {isSelected ? 'INSTALADO NO CARRO' : 'APLICAR PREPARAÇÃO'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Rodapé informativo */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[9px] text-zinc-500">
          <span>Tuning em tempo real aplicado instantaneamente ao motor e transmissão</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow"
          >
            VOLTAR À PISTA
          </button>
        </div>
      </div>
    </div>
  )
})

