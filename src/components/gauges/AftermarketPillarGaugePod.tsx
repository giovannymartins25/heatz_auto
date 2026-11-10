import { memo } from 'react'
import { BoostGauge } from './BoostGauge'
import { useSimulationStore } from '@/stores/useSimulationStore'

interface AftermarketPillarGaugePodProps {
  className?: string
  size?: number
}

/**
 * AftermarketPillarGaugePod — Manômetro Esportivo de Coluna / Painel (Aftermarket Tuning Accessory).
 *
 * Reproduz os manômetros de competição (estilo AutoMeter, Cronomac ou Defi)
 * montados na coluna A do motorista ou sobre o tabelier:
 * - Copo com acabamento em fibra de carbono fosca
 * - Suporte articulado em alumínio billet anodizado
 * - Aro cromado com iluminação noturna
 * - Medição analógica e digital em tempo real (vácuo -1.0 a +3.0 bar de pressão)
 * - LED indicador de Sobrepressão / Overboost (> 1.6 bar)
 */
export const AftermarketPillarGaugePod = memo(function AftermarketPillarGaugePod({
  className = '',
  size = 86,
}: AftermarketPillarGaugePodProps) {
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const hasTurbo = useSimulationStore((s) => s.hasTurbo)
  const isRunning = useSimulationStore((s) => s.isRunning)

  const isOverboost = boostPressureBar > 1.65

  return (
    <div
      className={`relative flex flex-col items-center select-none font-mono ${className}`}
      title="Manômetro de Pressão de Turbo / Vácuo (Aftermarket Tuning Pod)"
    >
      {/* Plaqueta do Suporte Billet */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-zinc-950/90 border border-white/20 text-[7px] font-black tracking-widest text-zinc-400 uppercase shadow-md flex items-center gap-1 z-20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>{hasTurbo ? 'TURBO BOOST' : 'VACUÔMETRO'}</span>
      </div>

      {/* Copo Exterior 3D (Gauge Pod Shell) */}
      <div className="relative p-2 rounded-full bg-gradient-to-br from-zinc-800 via-zinc-950 to-black border-2 border-zinc-700 shadow-[0_10px_25px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.15)] flex items-center justify-center">
        {/* Aro Anodizado Interno */}
        <div className="rounded-full p-1 bg-gradient-to-tr from-zinc-900 to-zinc-700 border border-white/10 shadow-inner">
          <BoostGauge
            boostBar={boostPressureBar}
            peakBar={peakBoostBar}
            size={size}
            showPeak={true}
          />
        </div>

        {/* LED Alerta de Overboost */}
        {isRunning && isOverboost && (
          <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-600 border border-white shadow-[0_0_12px_rgba(239,68,68,1)] animate-ping" />
        )}
      </div>

      {/* Suporte Articulado / Haste de Fixação de Coluna */}
      <div className="w-3.5 h-4 bg-gradient-to-b from-zinc-700 to-zinc-900 border-x border-zinc-600 rounded-b shadow-md -mt-0.5 flex flex-col items-center justify-end pb-0.5">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 border border-black" />
      </div>
      <div className="w-8 h-1 bg-zinc-800 rounded-full border border-white/10 shadow" />
    </div>
  )
})

