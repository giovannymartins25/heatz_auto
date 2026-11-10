import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { BoostGauge } from '@/components/gauges'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp } from '@/utils/math'
import { ClimateControlPanel } from './shared/ClimateControlPanel'
import { InternetMediaCenter } from './shared/InternetMediaCenter'

interface GolfGTIDiscoverProProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  compact?: boolean
  className?: string
}

type GTIActiveTab = 'sport' | 'clima' | 'media' | 'ambient'

/**
 * GolfGTIDiscoverPro — Central Multimídia oficial Volkswagen Discover Pro / Sport HMI (Golf GTI Mk7).
 *
 * Características autênticas da Volkswagen GTI:
 * - Moldura em acabamento preto piano brilhante (glossy piano black) com friso vermelho GTI
 * - Botões capacitivos laterais VW: RADIO, MEDIA, CAR / SPORT, CLIMA, APP-CONNECT
 * - Modos:
 *   1. SPORT HMI: 3 mostradores circulares GTI (Ladedruck / Boost, Leistung / Potência CV e Öltemperatur)
 *   2. CLIMATRONIC: Ar-condicionado digital Dual-Zone com Air Care
 *   3. APP-CONNECT: Acesso ao YouTube e reprodutor de músicas com streaming online
 *   4. AMBIENTE GTI: Iluminação interna configurável (Vermelho GTI, Azul Golf R, Âmbar, Branco)
 */
export const GolfGTIDiscoverPro = memo(function GolfGTIDiscoverPro({
  vehicle,
  telemetry,
  compact = false,
  className = '',
}: GolfGTIDiscoverProProps) {
  const [activeTab, setActiveTab] = useState<GTIActiveTab>('sport')
  const [clockTime, setClockTime] = useState('14:32')
  const [ambientColor, setAmbientColor] = useState<'red' | 'blue' | 'amber' | 'white'>('red')

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const hasTurbo = !!vehicle.engine.turbo?.enabled
  const maxPowerHp = vehicle.engine.maxPower || 230
  const redlineRpm = vehicle.engine.maxRpm || 6800
  const rpm = telemetry.tachometer.rpm
  const throttlePercent = telemetry.pedals.throttlePercent
  const coolantTemp = telemetry.auxGauges.coolantTemp || 90

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

  // Potência instantânea em CV
  const throttleFactor = 0.25 + 0.75 * (throttlePercent / 100)
  const rpmFactor = clamp(rpm / redlineRpm, 0.1, 1.05)
  const turboMultiplier = hasTurbo ? clamp(1 + Math.max(0, boostPressureBar) * 0.45, 0.75, 1.5) : 1
  const instantHp = Math.round(maxPowerHp * rpmFactor * throttleFactor * turboMultiplier * (rpm > 1200 ? 1 : 0.2))

  // Temperatura do óleo
  const oilTemp = Math.round(coolantTemp + (rpm > 4000 ? 7 : 3))

  // Cores de iluminação ambiente
  const ambientGlow =
    ambientColor === 'blue'
      ? 'shadow-[0_12px_45px_rgba(37,99,235,0.25)] border-blue-600/40'
      : ambientColor === 'amber'
      ? 'shadow-[0_12px_45px_rgba(245,158,11,0.25)] border-amber-600/40'
      : ambientColor === 'white'
      ? 'shadow-[0_12px_45px_rgba(255,255,255,0.15)] border-zinc-500/40'
      : 'shadow-[0_12px_45px_rgba(220,38,38,0.25)] border-red-600/40'

  return (
    <div
      className={`relative flex flex-col rounded-[1.8rem] bg-gradient-to-b from-[#131418] via-[#0b0c0f] to-[#050608] border-2 ${ambientGlow} overflow-hidden select-none font-mono transition-all duration-300 ${
        compact ? 'w-[270px] p-2' : 'w-[325px] sm:w-[350px] p-2.5 sm:p-3'
      } ${className}`}
    >
      {/* ── Friso Superior GTI & Barra de Status ── */}
      <div className="w-full flex items-center justify-between pb-1.5 mb-1.5 border-b border-red-600/20 text-[8px] sm:text-[9px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
          <span className="font-black text-red-500 tracking-wider">DISCOVER PRO</span>
          <span className="text-zinc-400 font-bold hidden xs:inline">· SPORT HMI</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 font-bold">
          <span className="text-[7px] text-zinc-500">APP-CONNECT</span>
          <span className="text-white font-mono">{clockTime}</span>
        </div>
      </div>

      {/* ── Conteúdo Central por Aba ── */}
      <div className="w-full min-h-[175px] flex flex-col justify-center">
        {/* ABA 1: SPORT HMI (3 MOSTRADORES GTI) */}
        {activeTab === 'sport' && (
          <div className="w-full flex flex-col items-center gap-1.5">
            <div className="w-full flex items-center justify-around">
              {/* Mostrador 1: Ladedruck (Turbo Boost) */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-red-500 uppercase tracking-widest mb-0.5">
                  LADEDRUCK
                </span>
                <div className="relative p-0.5 rounded-full bg-zinc-900/90 border border-red-600/30 shadow-inner">
                  <BoostGauge
                    boostBar={hasTurbo ? boostPressureBar : -0.2}
                    peakBar={hasTurbo ? peakBoostBar : 0}
                    size={compact ? 66 : 76}
                    showPeak={false}
                    showLabel={false}
                  />
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[8px] font-black">
                  <span className={boostPressureBar > 0 ? 'text-red-400' : 'text-sky-400'}>
                    {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR
                  </span>
                  {peakBoostBar > 0.1 && (
                    <span className="text-amber-400 text-[7px]">PK +{peakBoostBar.toFixed(1)}</span>
                  )}
                </div>
              </div>

              {/* Mostrador 2: Leistung (Potência em CV) */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-red-500 uppercase tracking-widest mb-0.5">
                  LEISTUNG
                </span>
                <div
                  className={`relative flex flex-col items-center justify-center rounded-full bg-zinc-900/90 border border-red-600/30 shadow-inner ${
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

              {/* Mostrador 3: Öltemperatur */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-red-500 uppercase tracking-widest mb-0.5">
                  ÖLTEMP
                </span>
                <div
                  className={`relative flex flex-col items-center justify-center rounded-full bg-zinc-900/90 border border-red-600/30 shadow-inner ${
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
                      stroke="#10b981"
                      strokeWidth="3"
                      strokeDasharray={compact ? 170 : 195}
                      strokeDashoffset={
                        (compact ? 170 : 195) * (1 - clamp((oilTemp - 50) / 80, 0, 1))
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

            {/* Barra de Spool da Turbina GTI */}
            <div className="w-full flex flex-col px-1 pt-1 border-t border-white/5">
              <div className="w-full flex justify-between items-center text-[7px] text-zinc-400 mb-0.5">
                <span className="font-bold text-red-400">PRESSÃO DE TRABALHO EA888</span>
                <span className="text-zinc-400 font-black">
                  {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)} BAR` : 'VÁCUO'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-950 rounded-full border border-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 via-amber-400 to-red-500 transition-all duration-75"
                  style={{ width: `${clamp((boostPressureBar + 1.0) / 2.5, 0, 1) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: CLIMATRONIC GTI */}
        {activeTab === 'clima' && (
          <ClimateControlPanel theme="gti" compact={compact} />
        )}

        {/* ABA 3: APP-CONNECT / YOUTUBE & MÚSICAS */}
        {activeTab === 'media' && (
          <InternetMediaCenter theme="gti" compact={compact} />
        )}

        {/* ABA 4: ILUMINAÇÃO AMBIENTE GTI */}
        {activeTab === 'ambient' && (
          <div className="w-full flex flex-col items-center justify-center py-2 gap-2 text-center">
            <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">
              ILUMINAÇÃO AMBIENTE GTI (CABINE)
            </span>
            <div className="w-full grid grid-cols-4 gap-1.5 px-2 my-1">
              <button
                onClick={() => setAmbientColor('red')}
                className={`py-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  ambientColor === 'red' ? 'bg-red-600/30 border-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'bg-zinc-900/60 border-white/10 text-zinc-400'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
                <span className="text-[7px] font-bold">VERMELHO GTI</span>
              </button>

              <button
                onClick={() => setAmbientColor('blue')}
                className={`py-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  ambientColor === 'blue' ? 'bg-blue-600/30 border-blue-500 text-white shadow-[0_0_12px_rgba(37,99,235,0.5)]' : 'bg-zinc-900/60 border-white/10 text-zinc-400'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.9)]" />
                <span className="text-[7px] font-bold">AZUL GOLF R</span>
              </button>

              <button
                onClick={() => setAmbientColor('amber')}
                className={`py-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  ambientColor === 'amber' ? 'bg-amber-600/30 border-amber-500 text-white shadow-[0_0_12px_rgba(245,158,11,0.5)]' : 'bg-zinc-900/60 border-white/10 text-zinc-400'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
                <span className="text-[7px] font-bold">CLUBSPORT</span>
              </button>

              <button
                onClick={() => setAmbientColor('white')}
                className={`py-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  ambientColor === 'white' ? 'bg-white/20 border-white text-white shadow-[0_0_12px_rgba(255,255,255,0.4)]' : 'bg-zinc-900/60 border-white/10 text-zinc-400'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                <span className="text-[7px] font-bold">BRANCO PURO</span>
              </button>
            </div>
            <span className="text-[7px] text-zinc-500">
              Personaliza o brilho de LED do painel e frisos das portas
            </span>
          </div>
        )}
      </div>

      {/* ── Botões Capacitivos Virtuais VW (Rodapé) ── */}
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
          onClick={() => setActiveTab('clima')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'clima'
              ? 'bg-sky-600 text-white shadow-[0_0_8px_rgba(2,132,199,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          CLIMATRONIC
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
        <button
          onClick={() => setActiveTab('ambient')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'ambient'
              ? 'bg-zinc-700 text-white'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          LUZ CABINE
        </button>
      </div>
    </div>
  )
})
