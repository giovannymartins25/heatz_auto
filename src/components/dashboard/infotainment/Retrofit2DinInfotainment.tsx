import { memo, useState, useEffect } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types/vehicle'
import { clamp } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { AMBIENT_COLOR_MAP } from '@/utils/ambientLighting'
import { ClimateControlPanel, InternetMediaCenter } from './shared'
import { BoostGauge } from '@/components/gauges'

export interface Retrofit2DinInfotainmentProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  compact?: boolean
  className?: string
}

type RetrofitActiveTab = 'telemetry' | 'clima' | 'media' | 'ambient'

/**
 * Retrofit2DinInfotainment — Central Multimídia 2-DIN Aftermarket Inteligente.
 *
 * Projetada especialmente para veículos customizados que não vinham com tela original (ex: Gol G6, Gol Quadrado):
 * - Moldura 2-DIN em textura de fibra de carbono com botões físicos touch laterais (PWR, Home, Vol, Nav)
 * - Abas:
 *   1. SPORT TELEMETRY: Manômetro de Turbo/Vácuo de alta resolução, Dragy 0-100 km/h, Potência CV instantânea e Volts
 *   2. CLIMA DIGITAL: Ar-condicionado touch com ventilação proporcional e desembaçador
 *   3. YOUTUBE & STREAMING: Acesso online ao YouTube, videoclipes, rádio FM e músicas
 *   4. LUZ DE CABINE RGB: Controle da iluminação ambiente do painel e console
 */
export const Retrofit2DinInfotainment = memo(function Retrofit2DinInfotainment({
  vehicle,
  telemetry,
  compact = false,
  className = '',
}: Retrofit2DinInfotainmentProps) {
  const [activeTab, setActiveTab] = useState<RetrofitActiveTab>('telemetry')
  const [clockTime, setClockTime] = useState('14:32')

  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const setAmbientLightColor = useSimulationStore((s) => s.setAmbientLightColor)
  const ambientTheme = AMBIENT_COLOR_MAP[ambientLightColor] || AMBIENT_COLOR_MAP.amber

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const hasTurbo = useSimulationStore((s) => s.hasTurbo)
  const current0to100 = useSimulationStore((s) => s.current0to100)
  const best0to100 = useSimulationStore((s) => s.best0to100)
  const isTiming0to100 = useSimulationStore((s) => s.isTiming0to100)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const toggleExhaustValve = useSimulationStore((s) => s.toggleExhaustValve)
  const tuningStage = useSimulationStore((s) => s.tuningStage)

  const maxPowerHp = vehicle.engine.maxPower || 120
  const redlineRpm = vehicle.engine.maxRpm || 6500
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

  // Potência instantânea calculada
  const stageMult = tuningStage === 1 ? 1.25 : tuningStage === 2 ? 1.50 : tuningStage === 3 ? 1.85 : 1.0
  const instantHp = Math.round(
    maxPowerHp *
      stageMult *
      clamp(rpm / redlineRpm, 0.1, 1) *
      clamp((throttlePercent / 100) * 1.15, 0.15, 1)
  )

  return (
    <div
      className={`relative flex flex-col justify-between rounded-3xl bg-[#090b10] border-4 border-[#222838] shadow-[0_12px_36px_rgba(0,0,0,0.9),inset_0_2px_4px_rgba(255,255,255,0.08)] font-mono select-none overflow-hidden ${
        compact ? 'w-80 h-64 p-2' : 'w-88 sm:w-96 h-80 sm:h-88 p-3'
      } ${className}`}
      style={{
        boxShadow: `0 0 24px ${ambientTheme.glowRgba}, inset 0 0 12px ${ambientTheme.glowRgba}`,
      }}
    >
      {/* ── Barra Superior do Display 2-DIN ── */}
      <div className="w-full flex items-center justify-between px-2 pb-1.5 border-b border-white/10 text-[9px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse" />
          <span className="font-black text-white tracking-wider">SMART 2-DIN RETROFIT</span>
        </div>
        <div className="flex items-center gap-2">
          {hasTurbo && (
            <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold text-[8px] border border-sky-400/30">
              TURBO ON
            </span>
          )}
          <span className="font-mono text-zinc-300 font-bold">{clockTime}</span>
        </div>
      </div>

      {/* ── Área Central de Conteúdo ── */}
      <div className="flex-1 w-full flex items-center justify-center overflow-hidden py-1">
        
        {/* ABA 1: TELEMETRIA ESPORTIVA & MANÔMETRO DE TURBO / VÁCUO */}
        {activeTab === 'telemetry' && (
          <div className="w-full h-full flex flex-col justify-between gap-1.5 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-2 flex-1">
              {/* Manômetro Digital & Analógico */}
              <div className="p-2 rounded-2xl bg-black/60 border border-white/10 flex flex-col items-center justify-center relative shadow-inner">
                <span className="text-[8px] uppercase tracking-wider text-zinc-400 font-bold mb-1">
                  {hasTurbo ? 'PRESSÃO DE TURBO' : 'VACUÔMETRO DE MOTOR'}
                </span>
                <BoostGauge
                  boostBar={boostPressureBar}
                  peakBar={peakBoostBar}
                  size={compact ? 68 : 80}
                  showPeak={hasTurbo}
                />
              </div>

              {/* Painel Dragy 0-100 & Potência */}
              <div className="flex flex-col justify-between gap-1 p-2 rounded-2xl bg-black/60 border border-white/10 shadow-inner">
                {/* Potência Instantânea */}
                <div className="text-center">
                  <span className="text-[7.5px] uppercase tracking-wider text-zinc-400 block">Potência Estimada</span>
                  <span className="text-base sm:text-lg font-black text-emerald-400">{instantHp} CV</span>
                  <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-75"
                      style={{ width: `${clamp((instantHp / (maxPowerHp * stageMult)) * 100, 5, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Dragy 0-100 */}
                <div className="text-center pt-1 border-t border-white/5">
                  <span className="text-[7.5px] uppercase tracking-wider text-amber-400 font-bold block">
                    {isTiming0to100 ? '⏱️ CRONOMETRANDO...' : '0-100 KM/H'}
                  </span>
                  <div className="flex items-center justify-around text-[10px]">
                    <div>
                      <span className="text-[7px] text-zinc-500 block">ATUAL</span>
                      <span className="font-bold text-white">{current0to100 ? `${current0to100}s` : '--'}</span>
                    </div>
                    <div>
                      <span className="text-[7px] text-zinc-500 block">RECORDE</span>
                      <span className="font-bold text-amber-400">{best0to100 ? `${best0to100}s` : '--'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Barra Inferior Rápida */}
            <div className="w-full flex items-center justify-between px-2 py-1 rounded-xl bg-black/40 border border-white/5 text-[8px] text-zinc-400">
              <span>ESTÁGIO: <b className="text-white">{tuningStage === 0 ? 'STOCK' : `STAGE ${tuningStage}`}</b></span>
              <button
                onClick={toggleExhaustValve}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-all ${
                  exhaustValveOpen ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                DIFUSOR: {exhaustValveOpen ? 'ABERTO' : 'FECHADO'}
              </button>
            </div>
          </div>
        )}

        {/* ABA 2: CLIMATIZAÇÃO DIGITAL TOUCH */}
        {activeTab === 'clima' && (
          <ClimateControlPanel theme="gti" compact={compact} />
        )}

        {/* ABA 3: YOUTUBE & STREAMING ONLINE */}
        {activeTab === 'media' && (
          <InternetMediaCenter theme="gti" compact={compact} />
        )}

        {/* ABA 4: ILUMINAÇÃO AMBIENTE RGB */}
        {activeTab === 'ambient' && (
          <div className="w-full h-full flex flex-col justify-between p-2 animate-in fade-in duration-150">
            <div>
              <span className="text-xs font-black text-white block">ILUMINAÇÃO AMBIENTE DA CABINE</span>
              <span className="text-[8px] text-zinc-400">Personalize a cor dos LEDs do console e cluster</span>
            </div>

            <div className="grid grid-cols-4 gap-2 my-auto">
              {(
                [
                  { id: 'red', name: 'Vermelho Racing', color: 'bg-red-500' },
                  { id: 'blue', name: 'Azul Elétrico', color: 'bg-blue-500' },
                  { id: 'amber', name: 'Âmbar Noturno', color: 'bg-amber-500' },
                  { id: 'white', name: 'Branco Puro', color: 'bg-white' },
                  { id: 'cyan', name: 'Ciano Neón', color: 'bg-cyan-400' },
                  { id: 'purple', name: 'Roxo Violeta', color: 'bg-purple-500' },
                  { id: 'green', name: 'Verde Sport', color: 'bg-emerald-500' },
                ] as const
              ).map((amb) => {
                const isSelected = ambientLightColor === amb.id
                return (
                  <button
                    key={amb.id}
                    onClick={() => setAmbientLightColor(amb.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-white bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                        : 'border-white/5 bg-black/40 hover:border-white/20'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full ${amb.color} shadow-sm`} />
                    <span className="text-[7.5px] font-bold text-zinc-300 text-center leading-tight">
                      {amb.name.split(' ')[0]}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="text-[7.5px] text-zinc-500 text-center">
              Cor selecionada: <b className="text-white uppercase">{ambientLightColor}</b>
            </div>
          </div>
        )}

      </div>

      {/* ── Teclas Físicas Inferiores do Rádio 2-DIN ── */}
      <div className="w-full grid grid-cols-4 gap-1 pt-1.5 border-t border-white/10 text-[9px] font-black">
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`py-1 rounded-xl transition-all cursor-pointer flex flex-col items-center ${
            activeTab === 'telemetry'
              ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.7)]'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-white'
          }`}
        >
          <span>📊</span>
          <span className="text-[7.5px]">TELEMETRIA</span>
        </button>

        <button
          onClick={() => setActiveTab('media')}
          className={`py-1 rounded-xl transition-all cursor-pointer flex flex-col items-center ${
            activeTab === 'media'
              ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.7)]'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-white'
          }`}
        >
          <span>▶️</span>
          <span className="text-[7.5px]">YOUTUBE</span>
        </button>

        <button
          onClick={() => setActiveTab('clima')}
          className={`py-1 rounded-xl transition-all cursor-pointer flex flex-col items-center ${
            activeTab === 'clima'
              ? 'bg-sky-500 text-black shadow-[0_0_10px_rgba(14,165,233,0.7)]'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-white'
          }`}
        >
          <span>❄️</span>
          <span className="text-[7.5px]">CLIMA</span>
        </button>

        <button
          onClick={() => setActiveTab('ambient')}
          className={`py-1 rounded-xl transition-all cursor-pointer flex flex-col items-center ${
            activeTab === 'ambient'
              ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.7)]'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-white'
          }`}
        >
          <span>💡</span>
          <span className="text-[7.5px]">LUZ RGB</span>
        </button>
      </div>
    </div>
  )
})

