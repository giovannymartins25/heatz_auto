import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp } from '@/utils/math'
import { ClimateControlPanel } from './shared/ClimateControlPanel'
import { InternetMediaCenter } from './shared/InternetMediaCenter'

interface ToyotaSmartConnectProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  compact?: boolean
  className?: string
}

type ToyotaActiveTab = 'gr-four' | 'clima' | 'media'

/**
 * ToyotaSmartConnect — Central Multimídia oficial Toyota Smart Connect / Gazoo Racing (Yaris GR).
 *
 * Características autênticas Gazoo Racing:
 * - Design esportivo em grafite fosco com detalhes em vermelho GR e branco acetinado
 * - Recursos exclusivos do Yaris:
 *   1. GR-FOUR AWD MONITOR:
 *      - Seletor de tração: NORMAL (60:40 dianteira), SPORT (30:70 traseira divertida) e TRACK (50:50 rally)
 *      - Gráfico interativo de transferência de torque entre as 4 rodas
 *      - INTERCOOLER WATER SPRAY: Botão oficial do Yaris Rallye de borrifar água no intercooler para resfriamento!
 *   2. TOYOTA NANOEX CLIMATE: Climatização digital automática com purificador de ar
 *   3. TOYOTA MULTIMEDIA: Acesso ao YouTube e player de músicas conectado
 */
export const ToyotaSmartConnect = memo(function ToyotaSmartConnect({
  vehicle,
  telemetry,
  compact = false,
  className = '',
}: ToyotaSmartConnectProps) {
  const [activeTab, setActiveTab] = useState<ToyotaActiveTab>('gr-four')
  const [clockTime, setClockTime] = useState('14:32')
  const [grFourMode, setGrFourMode] = useState<'normal' | 'sport' | 'track'>('track')
  const [isSprayingWater, setIsSprayingWater] = useState(false)
  const [intakeTemp, setIntakeTemp] = useState(38) // Temperatura do ar de admissão

  const maxPowerHp = vehicle.engine.maxPower || 110
  const redlineRpm = vehicle.engine.maxRpm || 6400
  const rpm = telemetry.tachometer.rpm
  const throttlePercent = telemetry.pedals.throttlePercent

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

  // Ação de Spray de Água no Intercooler
  const triggerWaterSpray = () => {
    setIsSprayingWater(true)
    setIntakeTemp((prev) => Math.max(22, prev - 8))
    setTimeout(() => {
      setIsSprayingWater(false)
    }, 1500)
  }

  // Potência instantânea em CV
  const throttleFactor = 0.25 + 0.75 * (throttlePercent / 100)
  const rpmFactor = clamp(rpm / redlineRpm, 0.1, 1.05)
  const instantHp = Math.round(maxPowerHp * rpmFactor * throttleFactor * (rpm > 1200 ? 1 : 0.2))

  // Divisão de torque GR-FOUR
  const frontTorquePercent = grFourMode === 'sport' ? 30 : grFourMode === 'track' ? 50 : 60
  const rearTorquePercent = 100 - frontTorquePercent

  return (
    <div
      className={`relative flex flex-col rounded-[1.8rem] bg-gradient-to-b from-[#141519] via-[#0d0e12] to-[#07080a] border-2 border-red-600/40 shadow-[0_12px_45px_rgba(220,38,38,0.2)] overflow-hidden select-none font-mono ${
        compact ? 'w-[270px] p-2' : 'w-[325px] sm:w-[350px] p-2.5 sm:p-3'
      } ${className}`}
    >
      {/* ── Barra Superior Gazoo Racing ── */}
      <div className="w-full flex items-center justify-between pb-1.5 mb-1.5 border-b border-red-600/20 text-[8px] sm:text-[9px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          <span className="font-black text-white tracking-wider">TOYOTA SMART CONNECT</span>
          <span className="text-red-500 font-bold hidden xs:inline">· GR-FOUR</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 font-bold">
          <span className="text-[7px] text-zinc-500">T-CONNECT</span>
          <span className="text-white font-mono">{clockTime}</span>
        </div>
      </div>

      {/* ── Conteúdo Central por Aba ── */}
      <div className="w-full min-h-[175px] flex flex-col justify-center">
        {/* ABA 1: GR-FOUR AWD & WATER SPRAY */}
        {activeTab === 'gr-four' && (
          <div className="w-full flex flex-col items-center gap-1.5">
            {/* Seletor de Tração GR-FOUR */}
            <div className="w-full flex items-center justify-between px-1 text-[8px]">
              <span className="font-bold text-zinc-400">DISTRIBUIÇÃO GR-FOUR:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setGrFourMode('normal')}
                  className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                    grFourMode === 'normal'
                      ? 'bg-red-600 text-white font-bold'
                      : 'bg-zinc-900 text-zinc-400'
                  }`}
                >
                  NORMAL (60:40)
                </button>
                <button
                  onClick={() => setGrFourMode('sport')}
                  className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                    grFourMode === 'sport'
                      ? 'bg-amber-600 text-white font-bold'
                      : 'bg-zinc-900 text-zinc-400'
                  }`}
                >
                  SPORT (30:70)
                </button>
                <button
                  onClick={() => setGrFourMode('track')}
                  className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                    grFourMode === 'track'
                      ? 'bg-red-600 text-white font-bold'
                      : 'bg-zinc-900 text-zinc-400'
                  }`}
                >
                  TRACK (50:50)
                </button>
              </div>
            </div>

            {/* Painel Central: Gráfico das 4 Rodas + Manômetro Turbo/Potência */}
            <div className="w-full flex items-center justify-around py-0.5">
              {/* Gráfico do Chassi 4WD do Yaris */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-zinc-400 uppercase mb-0.5">
                  TRAÇÃO 4X4
                </span>
                <div className="relative w-20 h-24 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col justify-between items-center p-1.5">
                  {/* Rodas Dianteiras */}
                  <div className="w-full flex justify-between items-center px-1">
                    <div
                      className={`w-3.5 h-6 rounded border ${
                        throttlePercent > 10 ? 'bg-red-500 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-zinc-800 border-zinc-600'
                      }`}
                    />
                    <span className="text-[7px] font-mono text-zinc-400 font-bold">{frontTorquePercent}%</span>
                    <div
                      className={`w-3.5 h-6 rounded border ${
                        throttlePercent > 10 ? 'bg-red-500 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-zinc-800 border-zinc-600'
                      }`}
                    />
                  </div>

                  <span className="text-[7px] font-black text-red-500 uppercase tracking-widest">
                    GR-FOUR
                  </span>

                  {/* Rodas Traseiras */}
                  <div className="w-full flex justify-between items-center px-1">
                    <div
                      className={`w-3.5 h-6 rounded border ${
                        throttlePercent > 10 ? 'bg-amber-500 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'bg-zinc-800 border-zinc-600'
                      }`}
                    />
                    <span className="text-[7px] font-mono text-zinc-400 font-bold">{rearTorquePercent}%</span>
                    <div
                      className={`w-3.5 h-6 rounded border ${
                        throttlePercent > 10 ? 'bg-amber-500 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'bg-zinc-800 border-zinc-600'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Potência Instantânea */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-zinc-400 uppercase mb-0.5">
                  POTÊNCIA VVT-I
                </span>
                <div
                  className={`relative flex flex-col items-center justify-center rounded-full bg-zinc-900/90 border border-white/10 shadow-inner ${
                    compact ? 'w-[66px] h-[66px]' : 'w-[76px] h-[76px]'
                  }`}
                >
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      cx={compact ? 33 : 38}
                      cy={compact ? 33 : 38}
                      r={compact ? 27 : 31}
                      fill="none"
                      stroke="#27272a"
                      strokeWidth="3"
                    />
                    <circle
                      cx={compact ? 33 : 38}
                      cy={compact ? 33 : 38}
                      r={compact ? 27 : 31}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3"
                      strokeDasharray={compact ? 170 : 195}
                      strokeDashoffset={
                        (compact ? 170 : 195) * (1 - clamp(instantHp / maxPowerHp, 0, 1))
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

              {/* Botão Oficial de Intercooler Water Spray */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-sky-400 uppercase mb-0.5">
                  SPRAY RADIADOR
                </span>
                <button
                  onClick={triggerWaterSpray}
                  className={`relative flex flex-col items-center justify-center rounded-2xl border transition-all cursor-pointer ${
                    compact ? 'w-[66px] h-[66px]' : 'w-[76px] h-[76px]'
                  } ${
                    isSprayingWater
                      ? 'bg-sky-500/30 border-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.7)] animate-pulse'
                      : 'bg-zinc-900/90 border-sky-500/40 hover:border-sky-400'
                  }`}
                  title="Borrifar água no Intercooler para resfriamento"
                >
                  <span className="text-xl">💦</span>
                  <strong className="text-[8px] font-black text-white mt-0.5">
                    {isSprayingWater ? 'BORRIFANDO!' : 'WATER SPRAY'}
                  </strong>
                  <span className="text-[6px] font-mono text-sky-300">
                    {intakeTemp}°C ADMISSÃO
                  </span>
                </button>
                <span className="text-[7px] text-zinc-500 mt-0.5">RALLY SPEC</span>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: CLIMATIZAÇÃO DUAL TOYOTA NANOEX */}
        {activeTab === 'clima' && (
          <ClimateControlPanel theme="toyota" compact={compact} />
        )}

        {/* ABA 3: TOYOTA MULTIMEDIA / YOUTUBE & MÚSICAS */}
        {activeTab === 'media' && (
          <InternetMediaCenter theme="toyota" compact={compact} />
        )}
      </div>

      {/* ── Botões Capacitivos Virtuais Toyota (Rodapé) ── */}
      <div className="w-full flex items-center justify-between border-t border-white/10 pt-1.5 mt-1.5 text-[7px] sm:text-[8px] font-bold">
        <button
          onClick={() => setActiveTab('gr-four')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'gr-four'
              ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          GR-FOUR AWD
        </button>
        <button
          onClick={() => setActiveTab('clima')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'clima'
              ? 'bg-sky-600 text-white shadow-[0_0_8px_rgba(2,132,199,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          CLIMATIZAÇÃO
        </button>
        <button
          onClick={() => setActiveTab('media')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'media'
              ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          YOUTUBE / SOM
        </button>
      </div>
    </div>
  )
})
