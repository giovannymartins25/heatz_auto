import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp } from '@/utils/math'
import { CircularProgressDial } from '@/components/gauges'
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

type ToyotaActiveTab = 'eco' | 'nav' | 'clima' | 'media' | 'ambient'

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
  const positionX = useSimulationStore((s) => s.positionX)
  const positionY = useSimulationStore((s) => s.positionY)
  const headingDeg = useSimulationStore((s) => s.headingDeg)
  const zoneName = useSimulationStore((s) => s.zoneName)
  const surfaceType = useSimulationStore((s) => s.surfaceType)
  const isMapOpen = useSimulationStore((s) => s.isMapOpen)
  const toggleMap = useSimulationStore((s) => s.toggleMap)

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
      className={`relative flex flex-col justify-between rounded-2xl sm:rounded-[1.8rem] bg-gradient-to-b from-[#141519] via-[#0d0e12] to-[#07080a] border-2 ${ambientTheme.borderClass} ${ambientTheme.shadowClass} overflow-hidden select-none font-mono transition-all duration-300 ${
        fill ? 'w-full h-full max-w-full max-h-full p-1.5 sm:p-2.5' : (compact ? 'w-[270px] p-2' : 'w-[325px] sm:w-[350px] p-2.5 sm:p-3')
      } ${className}`}
    >
      {/* ── Barra Superior Toyota Play ── */}
      <div className={`w-full flex items-center justify-between pb-1 mb-1 pr-28 border-b ${ambientTheme.headerBorderClass} text-[8px] sm:text-[9px] shrink-0`}>
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
      <div className="flex-1 min-h-0 w-full flex flex-col justify-between overflow-y-auto p-1" style={{ touchAction: 'pan-y' }}>
        {/* ABA 1: ECO & DRIVE MONITOR */}
        {activeTab === 'eco' && (
          <div className="w-full flex flex-col items-center gap-1 my-auto">
            {/* Status ECO */}
            <div className="w-full flex items-center justify-between px-1 text-[7.5px] sm:text-[8.5px]">
              <span className="font-bold text-zinc-400 uppercase">COMPUTADOR DE BORDO:</span>
              <div className="flex items-center gap-1">
                <span
                  className={`px-1.5 py-0.2 rounded text-[7.5px] font-black uppercase tracking-wider ${
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
            <div className="w-full flex items-center justify-around py-0.5">
              {/* Consumo Médio */}
              <div className="flex flex-col items-center">
                <span className="text-[6.5px] sm:text-[7px] font-bold text-zinc-400 uppercase mb-0.5">
                  CONSUMO MÉDIO
                </span>
                <div className="flex flex-col items-center justify-center p-1 sm:p-2 rounded-xl bg-zinc-900/90 border border-white/10 min-w-[55px] sm:min-w-[70px]">
                  <span className={`${compact || fill ? 'text-sm sm:text-base' : 'text-lg'} font-black text-emerald-400 leading-none`}>
                    13,8
                  </span>
                  <span className="text-[6.5px] font-mono text-zinc-400 mt-0.5">KM/L</span>
                </div>
                <span className="text-[6.5px] text-zinc-500 mt-0.5">GASOLINA</span>
              </div>

              {/* Potência Instantânea */}
              <CircularProgressDial
                label="POTÊNCIA VVT-I"
                value={instantHp}
                max={maxPowerHp}
                unit="CV"
                color="#e11d48"
                glowColor="#e11d48"
                subLabel={`MAX ${maxPowerHp} CV`}
                compact={compact}
                fill={fill}
              />

              {/* Autonomia Estimada */}
              <div className="flex flex-col items-center">
                <span className="text-[6.5px] sm:text-[7px] font-bold text-zinc-400 uppercase mb-0.5">
                  AUTONOMIA
                </span>
                <div className="flex flex-col items-center justify-center p-1 sm:p-2 rounded-xl bg-zinc-900/90 border border-white/10 min-w-[55px] sm:min-w-[70px]">
                  <span className={`${compact || fill ? 'text-sm sm:text-base' : 'text-lg'} font-black text-sky-400 leading-none`}>
                    520
                  </span>
                  <span className="text-[6.5px] font-mono text-zinc-400 mt-0.5">KM REST.</span>
                </div>
                <span className="text-[6.5px] text-zinc-500 mt-0.5">TANQUE 45L</span>
              </div>
            </div>

            {/* Eficiência do Estilo de Condução */}
            <div className="w-full flex items-center justify-between px-2 py-0.5 rounded bg-black/40 border border-white/5 text-[7px] font-mono">
              <span className="text-zinc-400">ECO SCORE:</span>
              <div className="flex items-center gap-1">
                <div className="w-20 sm:w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
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

        {/* ABA: NAVEGAÇÃO TOYOTA SMART CONNECT */}
        {activeTab === 'nav' && (
          <div className="w-full flex flex-col justify-between items-center gap-1 h-full p-1 text-center font-mono">
            {/* Header da Navegação Toyota */}
            <div className="w-full flex items-center justify-between px-2 py-0.5 rounded-lg bg-zinc-900/90 border border-cyan-500/30">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-[7px] font-black text-cyan-400 uppercase tracking-widest">
                  TOYOTA SMART NAV
                </span>
              </div>
              <span className="text-[7px] text-zinc-300 font-bold uppercase truncate max-w-[130px]">
                {zoneName || 'Circuito 2D'}
              </span>
            </div>

            {/* Radar / Mapa Vetorial Toyota */}
            <div className="relative w-full max-w-[260px] h-[90px] sm:h-[105px] rounded-xl bg-[#080d14] border border-cyan-500/20 overflow-hidden shadow-inner flex items-center justify-center">
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, #06b6d4 1px, transparent 1px), linear-gradient(to bottom, #06b6d4 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-cyan-500/20" />
              <div className="absolute inset-y-0 left-1/2 w-[1px] bg-cyan-500/20" />

              {/* Indicador do Veículo */}
              <div
                className="absolute w-4 h-4 -ml-2 -mt-2 flex items-center justify-center transition-all duration-75"
                style={{
                  left: `${Math.max(10, Math.min(90, 50 + (positionX / 300) * 40))}%`,
                  top: `${Math.max(10, Math.min(90, 50 - (positionY / 300) * 40))}%`,
                }}
              >
                <div
                  className="text-cyan-400 text-xs drop-shadow-[0_0_6px_rgba(6,182,212,0.9)]"
                  style={{ transform: `rotate(${headingDeg}deg)` }}
                >
                  ▲
                </div>
              </div>

              {/* Rosa dos Ventos */}
              <div className="absolute top-1 right-2 flex flex-col items-center text-[6px] text-zinc-400 font-bold">
                <span className="text-cyan-400 font-black">N</span>
                <span>{Math.round(headingDeg)}°</span>
              </div>

              {/* Badge de Superfície */}
              <div className="absolute bottom-1 left-2 text-[6px] font-bold px-1.5 py-0.5 rounded bg-black/70 border border-white/10 text-zinc-300">
                PISO: <span className="text-cyan-400">{surfaceType.toUpperCase()}</span>
              </div>
            </div>

            {/* Leituras Numéricas de Coordenadas */}
            <div className="w-full grid grid-cols-3 gap-1 text-[6.5px] font-bold">
              <div className="p-0.5 rounded bg-zinc-900/80 border border-white/5 flex flex-col items-center">
                <span className="text-zinc-500 text-[5.5px]">COORD X</span>
                <span className="text-white font-mono">{positionX >= 0 ? '+' : ''}{positionX.toFixed(1)}m</span>
              </div>
              <div className="p-0.5 rounded bg-zinc-900/80 border border-white/5 flex flex-col items-center">
                <span className="text-zinc-500 text-[5.5px]">COORD Y</span>
                <span className="text-white font-mono">{positionY >= 0 ? '+' : ''}{positionY.toFixed(1)}m</span>
              </div>
              <div className="p-0.5 rounded bg-zinc-900/80 border border-white/5 flex flex-col items-center">
                <span className="text-zinc-500 text-[5.5px]">RUMO</span>
                <span className="text-cyan-400 font-mono">{Math.round(headingDeg)}°</span>
              </div>
            </div>

            {/* Ação: Alternar Mapa Dirigível no Cockpit */}
            <button
              onClick={toggleMap}
              className={`w-full py-0.5 px-2 rounded-lg border text-[7px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow flex items-center justify-center gap-1 ${
                isMapOpen
                  ? 'bg-cyan-500 text-black border-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.6)]'
                  : 'bg-zinc-900 text-cyan-400 border-cyan-500/40 hover:bg-zinc-800'
              }`}
            >
              <span>🗺️</span>
              <span>{isMapOpen ? 'MAPA 2D ATIVO NO COCKPIT' : 'PROJETAR MAPA NO COCKPIT'}</span>
            </button>
          </div>
        )}

        {/* ABA 2: CLIMATIZAÇÃO DUAL TOYOTA NANOEX */}
        {activeTab === 'clima' && (
          <ClimateControlPanel vehicle={vehicle} theme="toyota" compact={compact || fill} />
        )}

        {/* ABA 3: TOYOTA MULTIMEDIA / YOUTUBE & MÚSICAS */}
        {activeTab === 'media' && (
          <InternetMediaCenter theme="toyota" compact={compact || fill} />
        )}

        {/* ABA 4: ILUMINAÇÃO AMBIENTE OPTITRON (CABINE & PAINEL) */}
        {activeTab === 'ambient' && (
          <div className="w-full flex flex-col items-center justify-center py-1 gap-1 text-center my-auto">
            <span className="text-[7.5px] sm:text-[8px] text-zinc-400 font-bold uppercase tracking-widest">
              ILUMINAÇÃO AMBIENTE OPTITRON
            </span>
            <div className="w-full grid grid-cols-4 gap-1 px-1 my-0.5">
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
                    className={`py-1 px-1 rounded-lg border flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
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
                      className="w-2.5 h-2.5 rounded-full shadow"
                      style={{
                        backgroundColor: col.hex,
                        boxShadow: `0 0 8px ${col.hex}aa`,
                      }}
                    />
                    <span className="text-[6px] font-bold leading-tight truncate w-full">{col.name}</span>
                  </button>
                )
              })}
            </div>
            <span className="text-[6.5px] text-zinc-400 font-semibold">
              Sincroniza o halo 3D Optitron do painel de instrumentos e da multimídia
            </span>
          </div>
        )}
      </div>

      {/* ── Botões Capacitivos Virtuais Toyota (Rodapé) ── */}
      <div className="w-full flex items-center justify-around border-t border-white/10 pt-1 mt-auto text-[6.5px] sm:text-[7.5px] font-bold shrink-0">
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
          onClick={() => setActiveTab('nav')}
          className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'nav'
              ? 'bg-cyan-500 text-black font-black shadow-[0_0_8px_rgba(6,182,212,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          GPS MAP
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
