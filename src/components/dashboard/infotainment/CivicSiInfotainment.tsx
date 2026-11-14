import { memo, useState, useEffect } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types/vehicle'
import { clamp } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { AMBIENT_COLOR_MAP } from '@/utils/ambientLighting'
import { ClimateControlPanel, InternetMediaCenter } from './shared'

export interface CivicSiInfotainmentProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  compact?: boolean
  className?: string
}

type CivicActiveTab = 'vtec' | 'clima' | 'media' | 'ambient'

/**
 * CivicSiInfotainment — Central Multimídia oficial Honda Civic Si (H-Audio / Pioneer 2-DIN).
 *
 * Características autênticas do Civic Si K20:
 * - Moldura automotiva 2-DIN em preto fosco com textura de fibra de carbono e friso vermelho Si
 * - Abas:
 *   1. VTEC TELEMETRY: Status de acoplamento do i-VTEC (5.800 RPM), Manômetro (Vácuo / Turbo se preparado), Potência CV e Óleo
 *   2. CLIMA DIGITAL: Ar-condicionado touch com Dual-Zone e ventilação
 *   3. YOUTUBE / STREAMING: Acesso online ao YouTube, videoclipes e player musical
 *   4. AMBIENTE Si: Iluminação ambiente da cabine sincronizada com o painel Multiplex
 */
export const CivicSiInfotainment = memo(function CivicSiInfotainment({
  vehicle,
  telemetry,
  compact = false,
  className = '',
}: CivicSiInfotainmentProps) {
  const [activeTab, setActiveTab] = useState<CivicActiveTab>('vtec')
  const [clockTime, setClockTime] = useState('14:32')

  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const setAmbientLightColor = useSimulationStore((s) => s.setAmbientLightColor)
  const ambientTheme = AMBIENT_COLOR_MAP[ambientLightColor] || AMBIENT_COLOR_MAP.red

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const hasTurbo = useSimulationStore((s) => s.hasTurbo)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const toggleExhaustValve = useSimulationStore((s) => s.toggleExhaustValve)
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const setTuningStage = useSimulationStore((s) => s.setTuningStage)

  const maxPowerHp = vehicle.engine.maxPower || 192
  const redlineRpm = vehicle.engine.maxRpm || 8400
  const rpm = telemetry.tachometer.rpm
  const throttlePercent = telemetry.pedals.throttlePercent
  const isVtecActive = rpm >= 5800

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
  const instantHp = Math.round(
    maxPowerHp *
      clamp(rpm / redlineRpm, 0.1, 1) *
      clamp((throttlePercent / 100) * 1.15, 0.15, 1) *
      (isVtecActive ? 1.08 : 0.92)
  )

  const coolantTemp = telemetry.auxGauges.coolantTemp ?? 88
  const oilTemp = Math.round(telemetry.auxGauges.oilTemp ?? (coolantTemp + 4))

  return (
    <div
      className={`relative flex flex-col justify-between rounded-3xl bg-[#090b0e] border-4 border-[#222834] shadow-[0_12px_36px_rgba(0,0,0,0.9),inset_0_2px_4px_rgba(255,255,255,0.06)] font-mono select-none overflow-hidden ${
        compact ? 'w-80 h-64 p-2' : 'w-88 sm:w-96 h-80 sm:h-88 p-3'
      } ${className}`}
      style={{
        boxShadow: `0 0 24px ${ambientTheme.glowRgba}, inset 0 0 12px ${ambientTheme.glowRgba}`,
      }}
    >
      {/* ── Barra Superior do Display 2-DIN ── */}
      <div className="w-full flex items-center justify-between px-2 pb-1.5 border-b border-red-950/80 text-[9px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
          <span className="font-bold text-white tracking-wider">HONDA Si H-AUDIO</span>
        </div>
        <div className="flex items-center gap-2">
          {isVtecActive && (
            <span className="px-1.5 py-0.2 rounded bg-red-600 text-white font-black text-[8px] animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]">
              VTEC ON
            </span>
          )}
          <span className="text-zinc-500 font-bold">{clockTime}</span>
        </div>
      </div>

      {/* ── Conteúdo Central da Tela ── */}
      <div className="flex-1 w-full flex flex-col items-center justify-center p-1.5">
        {/* ABA 1: TELEMETRIA VTEC & MANÔMETROS */}
        {activeTab === 'vtec' && (
          <div className="w-full flex flex-col items-center gap-1.5">
            <div className="w-full flex items-center justify-around">
              {/* Mostrador 1: VTEC / Boost */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-red-500 uppercase tracking-widest mb-0.5">
                  {hasTurbo ? 'TURBO BOOST' : 'i-VTEC STATUS'}
                </span>
                <div
                  className={`relative flex flex-col items-center justify-center rounded-full bg-zinc-900/90 border transition-all ${
                    compact ? 'w-[66px] h-[66px]' : 'w-[76px] h-[76px]'
                  } ${
                    isVtecActive
                      ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]'
                      : 'border-zinc-700'
                  }`}
                >
                  <span className={`text-base sm:text-lg font-black leading-none z-10 ${isVtecActive ? 'text-red-400' : 'text-white'}`}>
                    {hasTurbo ? (boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)) : isVtecActive ? 'ENGAGED' : '5.8K'}
                  </span>
                  <span className="text-[7px] font-bold text-zinc-400 tracking-wider mt-0.5 z-10">
                    {hasTurbo ? 'BAR' : isVtecActive ? 'CAM 2' : 'CAM 1'}
                  </span>
                </div>
                <span className="text-[8px] text-zinc-500 font-bold mt-0.5">
                  {isVtecActive ? '8.300 RPM MAX' : 'VTEC @ 5.800'}
                </span>
              </div>

              {/* Mostrador 2: Potência Instantânea */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-red-500 uppercase tracking-widest mb-0.5">
                  POTÊNCIA
                </span>
                <div
                  className={`relative flex flex-col items-center justify-center rounded-full bg-zinc-900/90 border border-zinc-700 ${
                    compact ? 'w-[66px] h-[66px]' : 'w-[76px] h-[76px]'
                  }`}
                >
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

              {/* Mostrador 3: Temperatura Óleo */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-red-500 uppercase tracking-widest mb-0.5">
                  ÓLEO
                </span>
                <div
                  className={`relative flex flex-col items-center justify-center rounded-full bg-zinc-900/90 border border-zinc-700 ${
                    compact ? 'w-[66px] h-[66px]' : 'w-[76px] h-[76px]'
                  }`}
                >
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

            {/* Barra de Engate do i-VTEC */}
            <div className="w-full flex flex-col px-1 pt-1 border-t border-white/5">
              <div className="w-full flex justify-between items-center text-[7px] text-zinc-400 mb-0.5">
                <span className="font-bold text-red-400">FAIXA DE ATUAÇÃO VTEC (K20Z3)</span>
                <span className="text-zinc-400 font-black">
                  {Math.round(rpm)} RPM
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-950 rounded-full border border-white/10 overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    isVtecActive
                      ? 'bg-red-600 shadow-[0_0_10px_rgba(239,68,68,1)]'
                      : 'bg-gradient-to-r from-sky-500 to-amber-500'
                  }`}
                  style={{ width: `${clamp((rpm / redlineRpm) * 100, 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Controles de Escape e Preparação Honda Racing */}
            <div className="w-full grid grid-cols-2 gap-1.5 px-1 pt-1 border-t border-white/5">
              <button
                onClick={toggleExhaustValve}
                className={`py-1 px-1.5 rounded-lg border font-mono text-[8px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  exhaustValveOpen
                    ? 'bg-red-500/20 border-red-500 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                    : 'bg-zinc-900 border-white/10 text-zinc-400'
                }`}
              >
                <span>⚡ DIFUSOR:</span>
                <span className="font-black">{exhaustValveOpen ? 'ABERTO' : 'CIVIL'}</span>
              </button>

              <button
                onClick={() => setTuningStage(((tuningStage + 1) % 4) as 0 | 1 | 2 | 3)}
                className={`py-1 px-1.5 rounded-lg border font-mono text-[8px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  tuningStage > 0
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    : 'bg-zinc-900 border-white/10 text-zinc-400'
                }`}
              >
                <span>🔧 PREPARAÇÃO:</span>
                <span className="font-black">{tuningStage === 0 ? 'STOCK' : `STG ${tuningStage}`}</span>
              </button>
            </div>
          </div>
        )}

        {/* ABA 2: CLIMATIZAÇÃO DIGITAL Si */}
        {activeTab === 'clima' && (
          <ClimateControlPanel theme="honda" compact={compact} />
        )}

        {/* ABA 3: YOUTUBE & STREAMING */}
        {activeTab === 'media' && (
          <InternetMediaCenter theme="honda" compact={compact} />
        )}

        {/* ABA 4: ILUMINAÇÃO DE CABINE */}
        {activeTab === 'ambient' && (
          <div className="w-full flex flex-col items-center justify-center py-2 gap-2 text-center">
            <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">
              ILUMINAÇÃO DE CABINE HONDA Si
            </span>
            <div className="w-full grid grid-cols-4 gap-1.5 px-2 my-1">
              {(
                [
                  { id: 'red', name: 'VERMELHO Si', hex: '#ef4444' },
                  { id: 'amber', name: 'TYPE R', hex: '#f59e0b' },
                  { id: 'blue', name: 'MUGEN AZUL', hex: '#3b82f6' },
                  { id: 'white', name: 'BRANCO RACING', hex: '#ffffff' },
                ] as const
              ).map((color) => {
                const isSelected = ambientLightColor === color.id
                return (
                  <button
                    key={color.id}
                    onClick={() => setAmbientLightColor(color.id)}
                    className={`flex flex-col items-center p-1.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-800 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)] scale-105'
                        : 'bg-zinc-900/60 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 mb-1"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-[7px] font-bold text-zinc-300">
                      {color.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Barra Inferior de Navegação Touch (Botões 2-DIN Si) ── */}
      <div className="w-full flex items-center justify-around pt-1 border-t border-red-950/80 text-[8px] font-bold">
        <button
          onClick={() => setActiveTab('vtec')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'vtec'
              ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          VTEC HMI
        </button>
        <button
          onClick={() => setActiveTab('clima')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'clima'
              ? 'bg-sky-600 text-white shadow-[0_0_8px_rgba(2,132,199,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          A/C DIGITAL
        </button>
        <button
          onClick={() => setActiveTab('media')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'media'
              ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          YOUTUBE
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
