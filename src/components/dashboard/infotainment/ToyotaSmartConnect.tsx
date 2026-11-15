import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { AMBIENT_COLOR_MAP } from '@/utils/ambientLighting'
import { ClimateControlPanel } from './shared/ClimateControlPanel'
import { InternetMediaCenter } from './shared/InternetMediaCenter'

interface ToyotaSmartConnectProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  compact?: boolean
  fill?: boolean
  className?: string
}

type ToyotaActiveTab = 'eco' | 'clima' | 'media' | 'ambient'

/**
 * ToyotaSmartConnect — Central Multimídia oficial Toyota Play 7" / Smart Connect (Toyota Yaris 1.5 XLS).
 *
 * Características autênticas do Yaris XLS Sedan:
 * - Design moderno com acabamento em grafite acetinado e detalhes em vermelho e ciano
 * - Recursos oficiais do Yaris:
 *   1. ECO MONITOR & DRIVE:
 *      - Computador de bordo com consumo médio e instantâneo
 *      - Indicador de condução econômica ECO em tempo real
 *      - Mostrador de potência instantânea Dual VVT-i (0 a 110 CV)
 *      - Autonomia estimada
 *   2. TOYOTA CLIMATE: Climatização digital automática com purificador de ar
 *   3. TOYOTA MULTIMEDIA: Acesso ao YouTube e reprodutor musical com streaming
 *   4. LUZ DE CABINE: Iluminação ambiente sincronizada
 */
export const ToyotaSmartConnect = memo(function ToyotaSmartConnect({
  vehicle,
  telemetry,
  compact = false,
  fill = false,
  className = '',
}: ToyotaSmartConnectProps) {
  const [activeTab, setActiveTab] = useState<ToyotaActiveTab>('eco')
  const [clockTime, setClockTime] = useState('14:32')

  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const setAmbientLightColor = useSimulationStore((s) => s.setAmbientLightColor)
  const ambientTheme = AMBIENT_COLOR_MAP[ambientLightColor] || AMBIENT_COLOR_MAP.cyan

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

  // Potência instantânea em CV
  const throttleFactor = 0.25 + 0.75 * (throttlePercent / 100)
  const rpmFactor = clamp(rpm / redlineRpm, 0.1, 1.05)
  const instantHp = Math.round(maxPowerHp * rpmFactor * throttleFactor * (rpm > 1200 ? 1 : 0.2))

  return (
    <div
      className={`relative flex flex-col rounded-[1.8rem] bg-gradient-to-b from-[#141519] via-[#0d0e12] to-[#07080a] border-2 ${ambientTheme.borderClass} ${ambientTheme.shadowClass} overflow-hidden select-none font-mono transition-all duration-300 ${
        fill ? 'w-full h-full max-w-full max-h-full p-2.5 sm:p-3' : (compact ? 'w-[270px] p-2' : 'w-[325px] sm:w-[350px] p-2.5 sm:p-3')
      } ${className}`}
    >
      {/* ── Barra Superior Toyota Play ── */}
      <div className={`w-full flex items-center justify-between pb-1.5 mb-1.5 border-b ${ambientTheme.headerBorderClass} text-[8px] sm:text-[9px]`}>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: ambientTheme.hex }} />
          <span className="font-black text-white tracking-wider">TOYOTA PLAY 7"</span>
          <span className="font-bold hidden xs:inline" style={{ color: ambientTheme.hex }}>· SMART CONNECT</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 font-bold">
          <span className="text-[7px] text-zinc-500">T-CONNECT</span>
          <span className="text-white font-mono">{clockTime}</span>
        </div>
      </div>

      {/* ── Conteúdo Central por Aba ── */}
      <div className="w-full min-h-[175px] flex flex-col justify-center">
        {/* ABA 1: ECO & DRIVE MONITOR */}
        {activeTab === 'eco' && (
          <div className="w-full flex flex-col items-center gap-2">
            {/* Status ECO */}
            <div className="w-full flex items-center justify-between px-1 text-[8.5px]">
              <span className="font-bold text-zinc-400 uppercase">COMPUTADOR DE BORDO:</span>
              <div className="flex items-center gap-1">
                <span
                  className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                    throttlePercent < 45 && rpm < 3500
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  🍃 ECO DRIVE {throttlePercent < 45 && rpm < 3500 ? 'ATIVO' : 'OFF'}
                </span>
              </div>
            </div>

            {/* Painel Central: Consumo Médio, Potência VVT-i e Autonomia */}
            <div className="w-full flex items-center justify-around py-1">
              {/* Consumo Médio */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-zinc-400 uppercase mb-0.5">
                  CONSUMO MÉDIO
                </span>
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-900/90 border border-white/10 min-w-[70px]">
                  <span className="text-lg font-black text-emerald-400 leading-none">
                    13,8
                  </span>
                  <span className="text-[7px] font-mono text-zinc-400 mt-0.5">KM/L</span>
                </div>
                <span className="text-[7px] text-zinc-500 mt-0.5">GASOLINA</span>
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
                      stroke="#e11d48"
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

              {/* Autonomia Estimada */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold text-zinc-400 uppercase mb-0.5">
                  AUTONOMIA
                </span>
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-900/90 border border-white/10 min-w-[70px]">
                  <span className="text-lg font-black text-sky-400 leading-none">
                    520
                  </span>
                  <span className="text-[7px] font-mono text-zinc-400 mt-0.5">KM REST.</span>
                </div>
                <span className="text-[7px] text-zinc-500 mt-0.5">TANQUE 45L</span>
              </div>
            </div>

            {/* Eficiência do Estilo de Condução */}
            <div className="w-full flex items-center justify-between px-2 py-1 rounded bg-black/40 border border-white/5 text-[8px] font-mono">
              <span className="text-zinc-400">ECO SCORE:</span>
              <div className="flex items-center gap-1">
                <div className="w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 transition-all duration-300"
                    style={{ width: `${Math.max(10, Math.round(100 - throttlePercent * 0.8))}%` }}
                  />
                </div>
                <span className="text-emerald-400 font-bold">
                  {Math.max(10, Math.round(100 - throttlePercent * 0.8))}/100
                </span>
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

        {/* ABA 4: ILUMINAÇÃO AMBIENTE OPTITRON (CABINE & PAINEL) */}
        {activeTab === 'ambient' && (
          <div className="w-full flex flex-col items-center justify-center py-2 gap-2 text-center">
            <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">
              ILUMINAÇÃO AMBIENTE OPTITRON
            </span>
            <div className="w-full grid grid-cols-4 gap-1.5 px-2 my-1">
              {(
                [
                  { id: 'cyan', name: 'ICE BLUE', hex: '#06b6d4' },
                  { id: 'red', name: 'GR RACING', hex: '#ef4444' },
                  { id: 'amber', name: 'SOLAR AMBER', hex: '#f59e0b' },
                  { id: 'blue', name: 'DEEP BLUE', hex: '#3b82f6' },
                  { id: 'purple', name: 'NEON PURPLE', hex: '#a855f7' },
                  { id: 'green', name: 'ECO GREEN', hex: '#10b981' },
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
              Sincroniza o halo 3D Optitron do painel de instrumentos e da multimídia
            </span>
          </div>
        )}
      </div>

      {/* ── Botões Capacitivos Virtuais Toyota (Rodapé) ── */}
      <div className="w-full flex items-center justify-between border-t border-white/10 pt-1.5 mt-1.5 text-[6.5px] sm:text-[7.5px] font-bold">
        <button
          onClick={() => setActiveTab('eco')}
          className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'eco'
              ? 'bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          ECO MONITOR
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
              ? 'bg-cyan-600 text-white shadow-[0_0_8px_rgba(6,182,212,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          LUZ CABINE
        </button>
      </div>
    </div>
  )
})
