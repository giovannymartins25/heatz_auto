import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { BoostGauge } from '@/components/gauges'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp } from '@/utils/math'
import { AMBIENT_COLOR_MAP } from '@/utils/ambientLighting'
import { ClimateControlPanel } from './shared/ClimateControlPanel'
import { InternetMediaCenter } from './shared/InternetMediaCenter'

interface PorschePCM6Props {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  compact?: boolean
  className?: string
}

type PorscheActiveTab = 'track' | 'chassis' | 'clima' | 'media' | 'ambient'

/**
 * PorschePCM6 — Central Multimídia oficial Porsche Communication Management (PCM 6.0).
 *
 * Características autênticas da Porsche Motorsport:
 * - Moldura widescreen esportiva em titânio acetinado e fibra de carbono com tipografia âmbar/branca
 * - Funções exclusivas Porsche:
 *   1. TRACK PRECISION: Boost bar Bi-Turbo em alta resolução, Friction Circle (G-Force 360°) e TPMS 4 pneus
 *   2. CHASSIS & AERO:
 *      - Front Axle Lift (+30mm no eixo dianteiro com animação e aviso de spoiler protegido)
 *      - Active Rear Wing (Asa traseira ativa com modos Automático / Downforce Máximo +150kg)
 *   3. CLIMATE: Porsche Advanced 2-Zone Climate com Ionizador de ar
 *   4. PCM STREAMING: Acesso ao YouTube e reprodutor de músicas online
 */
export const PorschePCM6 = memo(function PorschePCM6({
  vehicle,
  telemetry,
  compact = false,
  className = '',
}: PorschePCM6Props) {
  const [activeTab, setActiveTab] = useState<PorscheActiveTab>('track')
  const [clockTime, setClockTime] = useState('14:32')
  const [isFrontLiftActive, setIsFrontLiftActive] = useState(false)
  const [wingMode, setWingMode] = useState<'auto' | 'extended'>('auto')

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const current0to100 = useSimulationStore((s) => s.current0to100)
  const best0to100 = useSimulationStore((s) => s.best0to100)
  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const setAmbientLightColor = useSimulationStore((s) => s.setAmbientLightColor)
  const ambientTheme = AMBIENT_COLOR_MAP[ambientLightColor] || AMBIENT_COLOR_MAP.amber

  const rpm = telemetry.tachometer.rpm
  const speed = telemetry.speedometer.speed
  const gForceX = 0
  const gForceY = Math.min(1.4, Math.max(-1.4, (speed > 5 ? 0.6 : 0) * (rpm > 5000 ? 1 : 0.4)))

  const maxPowerHp = vehicle.engine.maxPower || 650
  const redlineRpm = vehicle.engine.maxRpm || 7400
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

  // Potência instantânea em CV
  const throttleFactor = 0.25 + 0.75 * (throttlePercent / 100)
  const rpmFactor = clamp(rpm / redlineRpm, 0.1, 1.05)
  const turboMultiplier = clamp(1 + Math.max(0, boostPressureBar) * 0.45, 0.75, 1.5)
  const instantHp = Math.round(maxPowerHp * rpmFactor * throttleFactor * turboMultiplier * (rpm > 1200 ? 1 : 0.2))

  return (
    <div
      className={`relative flex flex-col rounded-[1.8rem] bg-gradient-to-b from-[#16171d] via-[#0c0d12] to-[#060709] border-2 ${ambientTheme.borderClass} ${ambientTheme.shadowClass} overflow-hidden select-none font-mono transition-all duration-300 ${
        compact ? 'w-[270px] p-2' : 'w-[325px] sm:w-[350px] p-2.5 sm:p-3'
      } ${className}`}
    >
      {/* ── Barra Superior Porsche PCM ── */}
      <div className={`w-full flex items-center justify-between pb-1.5 mb-1.5 border-b ${ambientTheme.headerBorderClass} text-[8px] sm:text-[9px]`}>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: ambientTheme.hex }} />
          <span className="font-black tracking-wider" style={{ color: ambientTheme.hex }}>PORSCHE PCM 6.0</span>
          <span className="text-zinc-500 hidden xs:inline">· TRACK PRECISION</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 font-bold">
          <span className="text-[7px] text-amber-500/80">CONNECT PLUS</span>
          <span className="text-white font-mono">{clockTime}</span>
        </div>
      </div>

      {/* ── Conteúdo Central por Aba ── */}
      <div className="w-full min-h-[175px] flex flex-col justify-center">
        {/* ABA 1: TRACK PRECISION & TELEMETRIA PORSCHE */}
        {activeTab === 'track' && (
          <div className="w-full flex flex-col items-center gap-1.5">
            <div className="w-full flex items-center justify-around">
              {/* Manômetro Bi-Turbo Porsche */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-amber-400 uppercase tracking-widest mb-0.5">
                  BI-TURBO BOOST
                </span>
                <div className="relative p-0.5 rounded-full bg-zinc-900/90 border border-amber-500/30 shadow-inner">
                  <BoostGauge
                    boostBar={boostPressureBar}
                    peakBar={peakBoostBar}
                    size={compact ? 66 : 76}
                    showPeak={false}
                    showLabel={false}
                  />
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[8px] font-black">
                  <span className={boostPressureBar > 0 ? 'text-amber-400' : 'text-sky-400'}>
                    {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR
                  </span>
                  {peakBoostBar > 0.1 && (
                    <span className="text-amber-400 text-[7px]">PK +{peakBoostBar.toFixed(1)}</span>
                  )}
                </div>
              </div>

              {/* Potência Instantânea Flat-6 Boxer */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-amber-400 uppercase tracking-widest mb-0.5">
                  FLAT-6 POWER
                </span>
                <div
                  className={`relative flex flex-col items-center justify-center rounded-full bg-zinc-900/90 border border-amber-500/30 shadow-inner ${
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
                      stroke="#f59e0b"
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

              {/* Friction Circle (G-Force Lateral / Longitudinal) */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-amber-400 uppercase tracking-widest mb-0.5">
                  G-FORCE
                </span>
                <div
                  className={`relative flex items-center justify-center rounded-full bg-zinc-900/90 border border-amber-500/30 shadow-inner ${
                    compact ? 'w-[66px] h-[66px]' : 'w-[76px] h-[76px]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full border border-white/10" />
                  <div className="w-5 h-5 rounded-full border border-white/10" />
                  <div className="absolute inset-x-0 h-px bg-white/15" />
                  <div className="absolute inset-y-0 w-px bg-white/15" />
                  <div
                    className="absolute w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,1)] transition-transform duration-75"
                    style={{
                      transform: `translate(${clamp(gForceX * 12, -16, 16)}px, ${clamp(
                        -gForceY * 12,
                        -16,
                        16
                      )}px)`,
                    }}
                  />
                </div>
                <span className="text-[8px] text-amber-400 font-bold mt-0.5">
                  {Math.abs(gForceY).toFixed(1)}G LAT
                </span>
              </div>
            </div>

            {/* Rodapé de Telemetria de Arrancada */}
            <div className="w-full flex justify-between items-center px-2 py-1 bg-zinc-900/60 rounded-xl border border-white/10 text-[8px]">
              <span className="text-zinc-400">
                0-100 KM/H: <strong className="text-amber-400">{current0to100 ? `${current0to100.toFixed(2)}s` : '--'}</strong>
              </span>
              <span className="text-zinc-500">
                RECORD: <strong className="text-white">{best0to100 ? `${best0to100.toFixed(2)}s` : '--'}</strong>
              </span>
            </div>
          </div>
        )}

        {/* ABA 2: CHASSIS & AERODINÂMICA ATIVA (PORSCHE EXCLUSIVE) */}
        {activeTab === 'chassis' && (
          <div className="w-full flex flex-col items-center justify-center py-1 gap-2">
            <span className="text-[8px] text-amber-400 font-bold uppercase tracking-widest">
              CHASSIS DYNAMICS & AERODINÂMICA ATIVA
            </span>

            <div className="w-full grid grid-cols-2 gap-2 px-1">
              {/* Front Axle Lift System */}
              <button
                onClick={() => setIsFrontLiftActive(!isFrontLiftActive)}
                className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isFrontLiftActive
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                    : 'bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <span className="text-xl">⏫</span>
                <strong className="text-[9px] font-black">LIFT DIANTEIRO</strong>
                <span className={`text-[7px] font-bold ${isFrontLiftActive ? 'text-amber-400' : 'text-zinc-500'}`}>
                  {isFrontLiftActive ? '+30mm ELEVADO' : 'PADRÃO PISTA'}
                </span>
              </button>

              {/* Active Rear Wing */}
              <button
                onClick={() => setWingMode(wingMode === 'auto' ? 'extended' : 'auto')}
                className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  wingMode === 'extended'
                    ? 'bg-red-500/20 border-red-400 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                    : 'bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <span className="text-xl">🪽</span>
                <strong className="text-[9px] font-black">ASA TRASEIRA</strong>
                <span className={`text-[7px] font-bold ${wingMode === 'extended' ? 'text-red-400' : 'text-zinc-500'}`}>
                  {wingMode === 'extended' ? '+150KG DOWNFORCE' : 'MODO AUTOMÁTICO'}
                </span>
              </button>
            </div>

            <div className="w-full flex justify-between items-center px-2 py-1 rounded bg-black/60 text-[7px] text-zinc-400 border border-white/5">
              <span>PROTEÇÃO DE SPOILER: <b className="text-white">{isFrontLiftActive ? 'ATIVA' : 'DESLIGADA'}</b></span>
              <span>CARGA AERODINÂMICA: <b className="text-amber-400">{wingMode === 'extended' ? 'MAX' : 'DYNAMIC'}</b></span>
            </div>
          </div>
        )}

        {/* ABA 3: CLIMATIZAÇÃO PORSCHE ADVANCED 2-ZONE */}
        {activeTab === 'clima' && (
          <ClimateControlPanel theme="porsche" compact={compact} />
        )}

        {/* ABA 4: PCM STREAMING / YOUTUBE & MÚSICAS */}
        {activeTab === 'media' && (
          <InternetMediaCenter theme="porsche" compact={compact} />
        )}

        {/* ABA 5: LUZ AMBIENTE DA CABINE & PAINEL DIGITAL */}
        {activeTab === 'ambient' && (
          <div className="w-full flex flex-col items-center justify-center py-2 gap-2 text-center">
            <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">
              ILUMINAÇÃO DE CABINE PORSCHE
            </span>
            <div className="w-full grid grid-cols-4 gap-1.5 px-2 my-1">
              {(
                [
                  { id: 'amber', name: 'SPEED YELLOW', hex: '#f59e0b' },
                  { id: 'red', name: 'GUARDS RED', hex: '#ef4444' },
                  { id: 'blue', name: 'SHARK BLUE', hex: '#3b82f6' },
                  { id: 'cyan', name: 'MIAMI BLUE', hex: '#06b6d4' },
                  { id: 'purple', name: 'ULTRAVIOLET', hex: '#a855f7' },
                  { id: 'green', name: 'ACID GREEN', hex: '#10b981' },
                  { id: 'white', name: 'PURE WHITE', hex: '#ffffff' },
                ] as const
              ).map((col) => {
                const isSelected = ambientLightColor === col.id
                return (
                  <button
                    key={col.id}
                    onClick={() => setAmbientLightColor(col.id)}
                    className={`py-1.5 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-800 border-white text-white shadow-lg'
                        : 'bg-zinc-900/60 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                    style={
                      isSelected
                        ? {
                            borderColor: col.hex,
                            boxShadow: `0 0 12px ${col.hex}66`,
                          }
                        : {}
                    }
                  >
                    <span
                      className="w-3 h-3 rounded-full shadow"
                      style={{
                        backgroundColor: col.hex,
                        boxShadow: `0 0 8px ${col.hex}aa`,
                      }}
                    />
                    <span className="text-[6.5px] font-bold leading-tight truncate w-full">{col.name}</span>
                  </button>
                )
              })}
            </div>
            <span className="text-[7px] text-zinc-400 font-semibold">
              Sincroniza o brilho de LED do painel digital 992 GT3 RS, console e multimídia
            </span>
          </div>
        )}
      </div>

      {/* ── Botões Capacitivos Virtuais Porsche (Rodapé) ── */}
      <div className="w-full flex items-center justify-between border-t border-white/10 pt-1.5 mt-1.5 text-[6.5px] sm:text-[7.5px] font-bold">
        <button
          onClick={() => setActiveTab('track')}
          className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'track'
              ? 'bg-amber-600 text-white shadow-[0_0_8px_rgba(217,119,6,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          TELEMETRIA
        </button>
        <button
          onClick={() => setActiveTab('chassis')}
          className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'chassis'
              ? 'bg-amber-600 text-white shadow-[0_0_8px_rgba(217,119,6,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          CHASSI
        </button>
        <button
          onClick={() => setActiveTab('clima')}
          className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'clima'
              ? 'bg-sky-600 text-white shadow-[0_0_8px_rgba(2,132,199,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          CLIMA
        </button>
        <button
          onClick={() => setActiveTab('media')}
          className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'media'
              ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          YOUTUBE
        </button>
        <button
          onClick={() => setActiveTab('ambient')}
          className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'ambient'
              ? 'bg-purple-600 text-white shadow-[0_0_8px_rgba(168,85,247,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          LUZ CABINE
        </button>
      </div>
    </div>
  )
})
