import { memo, useState, useEffect } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types/vehicle'
import { clamp } from '@/utils/math'
import { CircularProgressDial } from '@/components/gauges'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { AMBIENT_COLOR_MAP } from '@/utils/ambientLighting'
import { ClimateControlPanel, InternetMediaCenter } from './shared'

export interface CivicSiInfotainmentProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  compact?: boolean
  fill?: boolean
  className?: string
}

type CivicActiveTab = 'vtec' | 'nav' | 'clima' | 'media' | 'ambient'

/**
 * CivicSiInfotainment — Central Multimídia oficial Honda Civic Si (H-Audio / Pioneer 2-DIN).
 *
 * Características autênticas do Civic Si K20:
 * - Moldura automotiva 2-DIN em preto fosco com textura de fibra de carbono e friso vermelho Si
 * - Abas:
 *   1. VTEC TELEMETRY: Status de acoplamento do i-VTEC (5.800 RPM), Manômetro de Potência CV, Óleo e Água
 *   2. CLIMA DIGITAL: Ar-condicionado touch com Dual-Zone e ventilação
 *   3. YOUTUBE / STREAMING: Acesso online ao YouTube, videoclipes e player musical
 *   4. AMBIENTE Si: Iluminação ambiente da cabine sincronizada com o painel Multiplex
 */
export const CivicSiInfotainment = memo(function CivicSiInfotainment({
  vehicle,
  telemetry,
  compact = false,
  fill = false,
  className = '',
}: CivicSiInfotainmentProps) {
  const [activeTab, setActiveTab] = useState<CivicActiveTab>('vtec')
  const [clockTime, setClockTime] = useState('14:32')

  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const setAmbientLightColor = useSimulationStore((s) => s.setAmbientLightColor)
  const ambientTheme = AMBIENT_COLOR_MAP[ambientLightColor] || AMBIENT_COLOR_MAP.red
  const positionX = useSimulationStore((s) => s.positionX)
  const positionY = useSimulationStore((s) => s.positionY)
  const headingDeg = useSimulationStore((s) => s.headingDeg)
  const zoneName = useSimulationStore((s) => s.zoneName)
  const surfaceType = useSimulationStore((s) => s.surfaceType)
  const isMapOpen = useSimulationStore((s) => s.isMapOpen)
  const toggleMap = useSimulationStore((s) => s.toggleMap)

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
      className={`relative flex flex-col justify-between rounded-2xl sm:rounded-3xl bg-[#090b0e] border-2 sm:border-4 border-[#222834] shadow-[0_12px_36px_rgba(0,0,0,0.9),inset_0_2px_4px_rgba(255,255,255,0.06)] font-mono select-none overflow-hidden ${
        fill ? 'w-full h-full max-w-full max-h-full p-1.5 sm:p-2.5' : (compact ? 'w-80 h-64 p-2' : 'w-88 sm:w-96 h-80 sm:h-88 p-3')
      } ${className}`}
      style={{
        boxShadow: `0 0 24px ${ambientTheme.glowRgba}, inset 0 0 12px ${ambientTheme.glowRgba}`,
      }}
    >
      {/* ── Barra Superior do Display 2-DIN ── */}
      <div className="w-full flex items-center justify-between px-2 pr-28 pb-1 border-b border-red-950/80 text-[8.5px] sm:text-[9px] text-zinc-400 shrink-0">
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
      <div className="flex-1 min-h-0 w-full flex flex-col justify-between overflow-y-auto p-1" style={{ touchAction: 'pan-y' }}>
        {/* ABA 1: TELEMETRIA VTEC & MANÔMETROS */}
        {activeTab === 'vtec' && (
          <div className="w-full flex flex-col items-center gap-1 my-auto">
            <div className="w-full flex items-center justify-around">
              {/* Mostrador 1: i-VTEC Status */}
              <CircularProgressDial
                label="i-VTEC STATUS"
                value={rpm}
                min={0}
                max={8300}
                unit={isVtecActive ? 'CAM 2' : 'CAM 1'}
                color={isVtecActive ? '#ef4444' : '#71717a'}
                glowColor={isVtecActive ? '#ef4444' : undefined}
                formatValue={() => (isVtecActive ? 'ENGAGED' : '5.8K')}
                subLabel={isVtecActive ? '8.300 MAX' : 'VTEC @ 5.8K'}
                active={isVtecActive}
                compact={compact}
                fill={fill}
              />

              {/* Mostrador 2: Potência Instantânea */}
              <CircularProgressDial
                label="POTÊNCIA"
                value={instantHp}
                max={maxPowerHp}
                unit="CV"
                color={isVtecActive ? '#ef4444' : '#f87171'}
                glowColor={isVtecActive ? '#ef4444' : undefined}
                subLabel={`MAX ${maxPowerHp} CV`}
                compact={compact}
                fill={fill}
              />

              {/* Mostrador 3: Temperatura Óleo */}
              <CircularProgressDial
                label="ÓLEO"
                value={oilTemp}
                min={50}
                max={130}
                unit="°C"
                color={oilTemp > 115 ? '#ef4444' : '#10b981'}
                glowColor={oilTemp > 115 ? '#ef4444' : '#10b981'}
                subLabel={oilTemp > 115 ? 'ALERTA' : 'NORMAL'}
                compact={compact}
                fill={fill}
              />
            </div>

            {/* Barra de Engate do i-VTEC */}
            <div className="w-full flex flex-col px-1 pt-0.5 border-t border-white/5">
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

            {/* Status do trem de força OEM Civic Si */}
            <div className="w-full flex items-center justify-between px-2 py-0.5 rounded bg-black/60 border border-white/5 text-[7px] font-mono text-zinc-400">
              <span>MOTOR: <b className="text-red-400">K20Z3 i-VTEC</b></span>
              <span>LSD: <b className="text-white">HELICAL</b></span>
              <span>CORTE: <b className="text-amber-400">8.300 RPM</b></span>
            </div>
          </div>
        )}

        {/* ABA: NAVEGAÇÃO GPS HONDA Si */}
        {activeTab === 'nav' && (
          <div className="w-full flex flex-col justify-between items-center gap-1 h-full p-1 text-center font-mono">
            {/* Header da Navegação Honda */}
            <div className="w-full flex items-center justify-between px-2 py-0.5 rounded-lg bg-zinc-900/90 border border-red-500/30">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-[7px] font-black text-red-400 uppercase tracking-widest">
                  HONDA GPS NAVI
                </span>
              </div>
              <span className="text-[7px] text-zinc-300 font-bold uppercase truncate max-w-[130px]">
                {zoneName || 'Circuito 2D'}
              </span>
            </div>

            {/* Radar / Mapa Vetorial Honda */}
            <div className="relative w-full max-w-[260px] h-[90px] sm:h-[105px] rounded-xl bg-[#090b10] border border-red-500/20 overflow-hidden shadow-inner flex items-center justify-center">
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, #ef4444 1px, transparent 1px), linear-gradient(to bottom, #ef4444 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-red-500/20" />
              <div className="absolute inset-y-0 left-1/2 w-[1px] bg-red-500/20" />

              {/* Indicador do Veículo */}
              <div
                className="absolute w-4 h-4 -ml-2 -mt-2 flex items-center justify-center transition-all duration-75"
                style={{
                  left: `${Math.max(10, Math.min(90, 50 + (positionX / 300) * 40))}%`,
                  top: `${Math.max(10, Math.min(90, 50 - (positionY / 300) * 40))}%`,
                }}
              >
                <div
                  className="text-red-500 text-xs drop-shadow-[0_0_6px_rgba(239,68,68,0.9)]"
                  style={{ transform: `rotate(${headingDeg}deg)` }}
                >
                  ▲
                </div>
              </div>

              {/* Rosa dos Ventos */}
              <div className="absolute top-1 right-2 flex flex-col items-center text-[6px] text-zinc-400 font-bold">
                <span className="text-red-400 font-black">N</span>
                <span>{Math.round(headingDeg)}°</span>
              </div>

              {/* Badge de Superfície */}
              <div className="absolute bottom-1 left-2 text-[6px] font-bold px-1.5 py-0.5 rounded bg-black/70 border border-white/10 text-zinc-300">
                PISO: <span className="text-red-400">{surfaceType.toUpperCase()}</span>
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
                <span className="text-red-400 font-mono">{Math.round(headingDeg)}°</span>
              </div>
            </div>

            {/* Ação: Alternar Mapa Dirigível no Cockpit */}
            <button
              onClick={toggleMap}
              className={`w-full py-0.5 px-2 rounded-lg border text-[7px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow flex items-center justify-center gap-1 ${
                isMapOpen
                  ? 'bg-red-600 text-white border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.6)]'
                  : 'bg-zinc-900 text-red-400 border-red-500/40 hover:bg-zinc-800'
              }`}
            >
              <span>🗺️</span>
              <span>{isMapOpen ? 'MAPA 2D ATIVO NO COCKPIT' : 'PROJETAR MAPA NO COCKPIT'}</span>
            </button>
          </div>
        )}

        {/* ABA 2: CLIMATIZAÇÃO DIGITAL Si */}
        {activeTab === 'clima' && (
          <ClimateControlPanel theme="honda" compact={compact || fill} />
        )}

        {/* ABA 3: YOUTUBE & STREAMING */}
        {activeTab === 'media' && (
          <InternetMediaCenter theme="honda" compact={compact || fill} />
        )}

        {/* ABA 4: ILUMINAÇÃO DE CABINE */}
        {activeTab === 'ambient' && (
          <div className="w-full flex flex-col items-center justify-center py-1 gap-1 text-center my-auto">
            <span className="text-[7.5px] sm:text-[8px] text-zinc-400 font-bold uppercase tracking-widest">
              ILUMINAÇÃO DE CABINE HONDA Si
            </span>
            <div className="w-full grid grid-cols-4 gap-1 px-1 my-0.5">
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
                    className={`flex flex-col items-center p-1 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-800 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)] scale-105'
                        : 'bg-zinc-900/60 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/20 mb-0.5"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-[6.5px] font-bold text-zinc-300">
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
      <div className="w-full flex items-center justify-around pt-1 border-t border-red-950/80 text-[7.5px] sm:text-[8px] font-bold shrink-0">
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
          onClick={() => setActiveTab('nav')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'nav'
              ? 'bg-red-600 text-white font-black shadow-[0_0_8px_rgba(220,38,38,0.5)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          GPS MAP
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
