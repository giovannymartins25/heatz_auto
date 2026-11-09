import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { BoostGauge } from '@/components/gauges'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp } from '@/utils/math'

interface InfotainmentScreenProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  compact?: boolean
  className?: string
}

/**
 * InfotainmentScreen — Central Multimídia Automotiva de Bordo com Display Esportivo (Sport HMI).
 *
 * Inspirada nas telas multimídia de alto desempenho da vida real:
 * - Volkswagen Discover Pro / Sport HMI (Performance Monitor com Ladedruck, Potência kW e Óleo)
 * - Porsche Communication Management (PCM Track Precision Display)
 * - Moldura de tela automotiva com botões capacitivos virtuais e barra de status de fábrica
 * - Tamanho refinado e compacto ("de menor tamanho"), perfeitamente integrado ao painel.
 */
export const InfotainmentScreen = memo(function InfotainmentScreen({
  vehicle,
  telemetry,
  compact = false,
  className = '',
}: InfotainmentScreenProps) {
  const [activeTab, setActiveTab] = useState<'sport' | 'gforce' | 'status'>('sport')
  const [clockTime, setClockTime] = useState('14:32')

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const current0to100 = useSimulationStore((s) => s.current0to100)
  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)

  const hasTurbo = !!vehicle.engine.turbo?.enabled
  const maxPowerHp = vehicle.engine.maxPower || 230
  const redlineRpm = vehicle.engine.maxRpm || 6800
  const rpm = telemetry.tachometer.rpm
  const throttlePercent = telemetry.pedals.throttlePercent
  const coolantTemp = telemetry.auxGauges.coolantTemp || 90

  // Relógio do sistema atualizado dinamicamente
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      setClockTime(`${hours}:${minutes}`)
    }
    updateTime()
    const timer = setInterval(updateTime, 30000)
    return () => clearInterval(timer)
  }, [])

  // Estimativa realista de Potência Instantânea em CV
  const throttleFactor = 0.25 + 0.75 * (throttlePercent / 100)
  const rpmFactor = clamp(rpm / redlineRpm, 0.1, 1.05)
  const turboMultiplier = hasTurbo
    ? clamp(1 + Math.max(0, boostPressureBar) * 0.45, 0.75, 1.5)
    : 1
  const instantHp = Math.round(
    maxPowerHp * rpmFactor * throttleFactor * turboMultiplier * (rpm > 1200 ? 1 : 0.2)
  )

  // Temperatura estimada do óleo (sempre um pouco acima do fluido de arrefecimento sob esforço)
  const oilTemp = Math.round(coolantTemp + (rpm > 4000 ? 6 : 2))

  // Branding do sistema conforme fabricante
  const isVW =
    vehicle.info.brand.toLowerCase().includes('volkswagen') ||
    vehicle.info.name.toLowerCase().includes('golf')
  const isPorsche = vehicle.info.brand.toLowerCase().includes('porsche')

  const brandTitle = isPorsche
    ? 'PORSCHE PCM · TRACK PRECISION'
    : isVW
    ? 'VW DISCOVER · SPORT HMI'
    : 'MULTIMÍDIA · SPORT DISPLAY'

  // Barra de Spool do Turbo (-1.0 a +1.5 bar)
  const spoolPercent = clamp((boostPressureBar + 1.0) / 2.5, 0, 1) * 100

  return (
    <div
      className={`relative flex flex-col rounded-2xl bg-gradient-to-b from-[#14151a] via-[#0d0e12] to-[#07080a] border-2 border-zinc-700/60 shadow-[0_12px_40px_rgba(0,0,0,0.85)] overflow-hidden select-none font-mono ${
        compact ? 'w-[260px] p-2' : 'w-[315px] sm:w-[335px] p-2.5 sm:p-3'
      } ${className}`}
    >
      {/* ── Moldura Superior: Barra de Status da Multimídia ── */}
      <div className="w-full flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10 text-[8px] sm:text-[9px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
          <span className="font-black text-zinc-200 tracking-wider uppercase truncate max-w-[170px]">
            {brandTitle}
          </span>
        </div>
        <div className="flex items-center gap-2 font-bold text-zinc-400">
          <span className="text-[7px] text-zinc-500 hidden xs:inline">4G LTE</span>
          <span className="text-zinc-300">{clockTime}</span>
        </div>
      </div>

      {/* ── Área Principal dos Mostradores de Telemetria (Sport HMI) ── */}
      {activeTab === 'sport' && (
        <div className="w-full flex flex-col items-center gap-1.5">
          <div className="w-full flex items-center justify-around">
            {/* 1. Manômetro de Turbo (Boost Gauge) */}
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">
                TURBO BOOST
              </span>
              <div className="relative p-0.5 rounded-full bg-zinc-900/90 border border-white/10 shadow-inner">
                <BoostGauge
                  boostBar={hasTurbo ? boostPressureBar : -0.2}
                  peakBar={hasTurbo ? peakBoostBar : 0}
                  size={compact ? 68 : 78}
                  showPeak={false}
                  showLabel={false}
                />
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-[8px] font-black">
                <span className={boostPressureBar > 0 ? 'text-amber-400' : 'text-sky-400'}>
                  {hasTurbo
                    ? boostPressureBar > 0
                      ? `+${boostPressureBar.toFixed(2)}`
                      : boostPressureBar.toFixed(2)
                    : 'N/A'}{' '}
                  BAR
                </span>
                {hasTurbo && peakBoostBar > 0.1 && (
                  <span className="text-amber-400/80 text-[7px]">PK +{peakBoostBar.toFixed(1)}</span>
                )}
              </div>
            </div>

            {/* 2. Mostrador de Potência Instantânea (CV) */}
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">
                POTÊNCIA
              </span>
              <div
                className={`relative flex flex-col items-center justify-center rounded-full bg-zinc-900/90 border border-white/10 shadow-inner ${
                  compact ? 'w-[68px] h-[68px]' : 'w-[78px] h-[78px]'
                }`}
              >
                {/* Arco de Potência em SVG */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx={compact ? 34 : 39}
                    cy={compact ? 34 : 39}
                    r={compact ? 28 : 32}
                    fill="none"
                    stroke="#27272a"
                    strokeWidth="3"
                  />
                  <circle
                    cx={compact ? 34 : 39}
                    cy={compact ? 34 : 39}
                    r={compact ? 28 : 32}
                    fill="none"
                    stroke={isPorsche ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3"
                    strokeDasharray={compact ? 175 : 201}
                    strokeDashoffset={
                      (compact ? 175 : 201) * (1 - clamp(instantHp / maxPowerHp, 0, 1))
                    }
                    strokeLinecap="round"
                    className="transition-all duration-75"
                  />
                </svg>
                <span className="text-base sm:text-lg font-black text-white leading-none z-10">
                  {instantHp}
                </span>
                <span className="text-[7px] font-bold text-zinc-400 tracking-wider mt-0.5 z-10">
                  CV
                </span>
              </div>
              <span className="text-[8px] text-zinc-500 font-bold mt-0.5">
                MAX {maxPowerHp} CV
              </span>
            </div>

            {/* 3. Mostrador de Temperatura do Óleo */}
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">
                ÖLTEMP
              </span>
              <div
                className={`relative flex flex-col items-center justify-center rounded-full bg-zinc-900/90 border border-white/10 shadow-inner ${
                  compact ? 'w-[68px] h-[68px]' : 'w-[78px] h-[78px]'
                }`}
              >
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx={compact ? 34 : 39}
                    cy={compact ? 34 : 39}
                    r={compact ? 28 : 32}
                    fill="none"
                    stroke="#27272a"
                    strokeWidth="3"
                  />
                  <circle
                    cx={compact ? 34 : 39}
                    cy={compact ? 34 : 39}
                    r={compact ? 28 : 32}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeDasharray={compact ? 175 : 201}
                    strokeDashoffset={
                      (compact ? 175 : 201) * (1 - clamp((oilTemp - 50) / 80, 0, 1))
                    }
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-base sm:text-lg font-black text-white leading-none z-10">
                  {oilTemp}
                </span>
                <span className="text-[7px] font-bold text-zinc-400 tracking-wider mt-0.5 z-10">
                  °C
                </span>
              </div>
              <span className="text-[8px] text-emerald-400 font-bold mt-0.5">
                NORMAL
              </span>
            </div>
          </div>

          {/* Barra de Spool do Turbo no rodapé da visualização esportiva */}
          {hasTurbo && (
            <div className="w-full flex flex-col px-1 pt-1 border-t border-white/5">
              <div className="w-full flex justify-between items-center text-[7px] text-zinc-400 mb-0.5">
                <span className="font-bold text-zinc-300">TURBINA PRESSURIZADA</span>
                <span className={boostPressureBar > 0 ? 'text-amber-400 font-black' : 'text-zinc-500'}>
                  {boostPressureBar > 0 ? 'SOBREALIMENTAÇÃO' : 'VÁCUO ADMISSÃO'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-950 rounded-full border border-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 via-amber-400 to-red-500 transition-all duration-75"
                  style={{ width: `${spoolPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Aba Alternativa: Telemetria e 0-100 km/h ── */}
      {activeTab === 'gforce' && (
        <div className="w-full flex flex-col items-center justify-center py-2 gap-1.5 text-center">
          <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">
            PERFORMANCE & ACELERAÇÃO
          </span>
          <div className="w-full grid grid-cols-2 gap-2 my-1">
            <div className="p-2 rounded-xl bg-zinc-900/80 border border-white/10">
              <span className="text-[7px] text-zinc-500 block">0 A 100 KM/H</span>
              <strong className="text-base font-black text-amber-400">
                {current0to100 ? `${current0to100.toFixed(2)}s` : '--'}
              </strong>
            </div>
            <div className="p-2 rounded-xl bg-zinc-900/80 border border-white/10">
              <span className="text-[7px] text-zinc-500 block">LAUNCH CONTROL</span>
              <strong
                className={`text-[10px] font-black ${
                  isLaunching
                    ? 'text-emerald-400'
                    : isLaunchControlArmed
                    ? 'text-amber-400 animate-pulse'
                    : 'text-zinc-400'
                }`}
              >
                {isLaunching ? 'LARGADA!' : isLaunchControlArmed ? 'ARMADO' : 'PRONTO'}
              </strong>
            </div>
          </div>
          <div className="w-full flex justify-between items-center text-[8px] text-zinc-400 px-1 border-t border-white/10 pt-1">
            <span>ÁGUA: <b className="text-white">{Math.round(coolantTemp)}°C</b></span>
            <span>PRESSÃO PEAK: <b className="text-amber-400">+{peakBoostBar.toFixed(2)} BAR</b></span>
          </div>
        </div>
      )}

      {/* ── Aba Alternativa: Status Geral do Veículo ── */}
      {activeTab === 'status' && (
        <div className="w-full flex flex-col py-1.5 gap-1 text-[8px]">
          <div className="flex justify-between items-center bg-zinc-900/60 px-2 py-1 rounded">
            <span className="text-zinc-400">VEÍCULO</span>
            <span className="text-white font-bold">{vehicle.info.brand} {vehicle.info.name}</span>
          </div>
          <div className="flex justify-between items-center bg-zinc-900/60 px-2 py-1 rounded">
            <span className="text-zinc-400">TRANSMISSÃO</span>
            <span className="text-amber-400 font-bold uppercase">{vehicle.transmission.type}</span>
          </div>
          <div className="flex justify-between items-center bg-zinc-900/60 px-2 py-1 rounded">
            <span className="text-zinc-400">SOBREALIMENTAÇÃO</span>
            <span className={hasTurbo ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
              {hasTurbo ? 'TURBOCHARGED' : 'ASPIRADO NATURAL'}
            </span>
          </div>
        </div>
      )}

      {/* ── Botões Capacitivos Virtuais da Multimídia (Rodapé) ── */}
      <div className="w-full flex items-center justify-between border-t border-white/10 pt-1.5 mt-1.5 text-[7px] sm:text-[8px] font-bold">
        <button
          onClick={() => setActiveTab('sport')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'sport'
              ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          SPORT HMI
        </button>
        <button
          onClick={() => setActiveTab('gforce')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'gforce'
              ? 'bg-amber-600 text-white shadow-[0_0_8px_rgba(217,119,6,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          TELEMETRIA
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'status'
              ? 'bg-zinc-700 text-white'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          INFO
        </button>
      </div>
    </div>
  )
})
