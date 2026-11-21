import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { BoostGauge, CircularProgressDial } from '@/components/gauges'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp } from '@/utils/math'
import { AMBIENT_COLOR_MAP } from '@/utils/ambientLighting'
import { ClimateControlPanel } from './shared/ClimateControlPanel'
import { InternetMediaCenter } from './shared/InternetMediaCenter'

interface PorschePCM6Props {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  compact?: boolean
  fill?: boolean
  className?: string
}

type PorscheActiveTab = 'track' | 'chassis' | 'nav' | 'clima' | 'media' | 'ambient'

/**
 * PorschePCM6 — Central Multimídia oficial Porsche Communication Management (PCM 6.0).
 *
 * Características autênticas da Porsche Motorsport:
 * - Moldura widescreen esportiva em titânio acetinado e fibra de carbono com tipografia âmbar/branca
 * - Funções exclusivas Porsche:
 *   1. TRACK PRECISION: Boost bar Bi-Turbo em alta resolução, Friction Circle (G-Force 360°) e TPMS 4 pneus
 *   2. CHASSIS & AERO:
 *      - Front Axle Lift (+30mm no eixo dianteiro com animação e aviso de spoiler protegido)
 *      - Active Rear Wing (Asa traseira ativa com recolher / elevar e modos Low Drag / Balanced / High Downforce)
 *   3. CLIMATE: Porsche Advanced 2-Zone Climate com Ionizador de ar
 *   4. PCM STREAMING: Acesso ao YouTube e reprodutor de músicas online
 */
export const PorschePCM6 = memo(function PorschePCM6({
  vehicle,
  telemetry,
  compact = false,
  fill = false,
  className = '',
}: PorschePCM6Props) {
  const [activeTab, setActiveTab] = useState<PorscheActiveTab>('track')
  const [clockTime, setClockTime] = useState('14:32')
  const isAeroWingExtended = useSimulationStore((s) => s.isAeroWingExtended)
  const setAeroWing = useSimulationStore((s) => s.setAeroWing)
  const suspensionHeight = useSimulationStore((s) => s.suspensionHeight)
  const setSuspensionHeight = useSimulationStore((s) => s.setSuspensionHeight)
  const rearWingPosition = useSimulationStore((s) => s.rearWingPosition)
  const setRearWingPosition = useSimulationStore((s) => s.setRearWingPosition)
  const downforceN = useSimulationStore((s) => s.downforceN)
  const positionX = useSimulationStore((s) => s.positionX)
  const positionY = useSimulationStore((s) => s.positionY)
  const headingDeg = useSimulationStore((s) => s.headingDeg)
  const zoneName = useSimulationStore((s) => s.zoneName)
  const surfaceType = useSimulationStore((s) => s.surfaceType)
  const isMapOpen = useSimulationStore((s) => s.isMapOpen)
  const toggleMap = useSimulationStore((s) => s.toggleMap)

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const current0to100 = useSimulationStore((s) => s.current0to100)
  const best0to100 = useSimulationStore((s) => s.best0to100)
  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const setAmbientLightColor = useSimulationStore((s) => s.setAmbientLightColor)
  const ambientTheme = AMBIENT_COLOR_MAP[ambientLightColor] || AMBIENT_COLOR_MAP.amber
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const toggleExhaustValve = useSimulationStore((s) => s.toggleExhaustValve)

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
      className={`relative flex flex-col justify-between rounded-2xl sm:rounded-[1.8rem] bg-gradient-to-b from-[#16171d] via-[#0c0d12] to-[#060709] border-2 ${ambientTheme.borderClass} ${ambientTheme.shadowClass} overflow-hidden select-none font-mono transition-all duration-300 ${
        fill ? 'w-full h-full max-w-full max-h-full p-1.5 sm:p-2.5' : (compact ? 'w-[270px] p-2' : 'w-[325px] sm:w-[350px] p-2.5 sm:p-3')
      } ${className}`}
    >
      {/* ── Barra Superior Porsche PCM ── */}
      <div className={`w-full flex items-center justify-between pb-1 mb-1 pr-28 border-b ${ambientTheme.headerBorderClass} text-[8px] sm:text-[9px] shrink-0`}>
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
      <div className="flex-1 min-h-0 w-full flex flex-col justify-between overflow-y-auto p-1" style={{ touchAction: 'pan-y' }}>
        {/* ABA 1: TRACK PRECISION & TELEMETRIA PORSCHE */}
        {activeTab === 'track' && (
          <div className="w-full flex flex-col items-center gap-1 my-auto">
            <div className="w-full flex items-center justify-around">
              {/* Manômetro Bi-Turbo Porsche */}
              <div className="flex flex-col items-center">
                <span className="text-[6.5px] sm:text-[7px] font-bold text-amber-400 uppercase tracking-widest mb-0.5">
                  BI-TURBO BOOST
                </span>
                <div className="relative p-0.5 rounded-full bg-zinc-900/90 border border-amber-500/30 shadow-inner">
                  <BoostGauge
                    boostBar={boostPressureBar}
                    peakBar={peakBoostBar}
                    size={compact || fill ? 52 : 76}
                    showPeak={false}
                    showLabel={false}
                  />
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[7px] sm:text-[8px] font-black">
                  <span className={boostPressureBar > 0 ? 'text-amber-400' : 'text-sky-400'}>
                    {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR
                  </span>
                  {peakBoostBar > 0.1 && (
                    <span className="text-amber-400 text-[6.5px]">PK +{peakBoostBar.toFixed(1)}</span>
                  )}
                </div>
              </div>

              {/* Potência Instantânea Flat-6 Boxer */}
              <CircularProgressDial
                label="FLAT-6 POWER"
                value={instantHp}
                max={maxPowerHp}
                unit="CV"
                color="#f59e0b"
                glowColor="#f59e0b"
                subLabel={`MAX ${maxPowerHp} CV`}
                compact={compact}
                fill={fill}
              />

              {/* Friction Circle (G-Force Lateral / Longitudinal) */}
              <div className="flex flex-col items-center">
                <span className="text-[6.5px] sm:text-[7px] font-bold text-amber-400 uppercase tracking-widest mb-0.5">
                  G-FORCE
                </span>
                <div
                  className={`relative flex items-center justify-center rounded-full bg-zinc-900/90 border border-amber-500/30 shadow-inner ${
                    compact || fill ? 'w-[52px] h-[52px] sm:w-[68px] sm:h-[68px]' : 'w-[76px] h-[76px]'
                  }`}
                >
                  <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-full border border-white/10" />
                  <div className="w-4 sm:w-5 h-4 sm:h-5 rounded-full border border-white/10" />
                  <div className="absolute inset-x-0 h-px bg-white/15" />
                  <div className="absolute inset-y-0 w-px bg-white/15" />
                  <div
                    className="absolute w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,1)] transition-transform duration-75"
                    style={{
                      transform: `translate(${clamp(gForceX * (compact || fill ? 8 : 12), -14, 14)}px, ${clamp(
                        -gForceY * (compact || fill ? 8 : 12),
                        -14,
                        14
                      )}px)`,
                    }}
                  />
                </div>
                <span className="text-[7px] sm:text-[8px] text-amber-400 font-bold mt-0.5">
                  {Math.abs(gForceY).toFixed(1)}G LAT
                </span>
              </div>
            </div>

            {/* Rodapé de Telemetria de Arrancada */}
            <div className="w-full flex justify-between items-center px-2 py-0.5 bg-zinc-900/60 rounded-xl border border-white/10 text-[7px] font-mono">
              <span className="text-zinc-400">
                0-100: <strong className="text-amber-400">{current0to100 ? `${current0to100.toFixed(2)}s` : '--'}</strong>
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
              CHASSIS DYNAMICS & AERODINÂMICA ATIVA (SWAN-NECK)
            </span>

            <div className="w-full grid grid-cols-2 gap-2 px-1">
              {/* Ajuste de Altura de Suspensão / Front Axle Lift */}
              <div className="bg-zinc-900/80 border border-white/10 p-2 rounded-xl flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-black text-amber-400">SUSPENSÃO & LIFT</span>
                  <span className="text-[7px] text-zinc-400 font-mono">
                    {suspensionHeight === 'track' ? '-30mm PISTA' : suspensionHeight === 'lift' ? '+30mm LIFT' : 'PADRÃO 0mm'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setSuspensionHeight('track')}
                    className={`py-1 text-[7px] font-bold rounded border transition-colors cursor-pointer ${
                      suspensionHeight === 'track'
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                        : 'bg-black/40 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    PISTA
                  </button>
                  <button
                    onClick={() => setSuspensionHeight('stock')}
                    className={`py-1 text-[7px] font-bold rounded border transition-colors cursor-pointer ${
                      suspensionHeight === 'stock'
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                        : 'bg-black/40 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    NORMAL
                  </button>
                  <button
                    onClick={() => setSuspensionHeight('lift')}
                    className={`py-1 text-[7px] font-bold rounded border transition-colors cursor-pointer ${
                      suspensionHeight === 'lift'
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                        : 'bg-black/40 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    LIFT +30
                  </button>
                </div>
              </div>

              {/* Swan-neck Wing / Aerodinâmica Funcional */}
              <div className="bg-zinc-900/80 border border-white/10 p-2 rounded-xl flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-black text-red-400">ASA ATIVA (SWAN-NECK)</span>
                  <span className={`text-[7px] font-mono font-bold ${isAeroWingExtended ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    {isAeroWingExtended ? '▲ ELEVADA (UP)' : '▼ RECOLHIDA (DOWN)'}
                  </span>
                </div>
                {/* 1. Atuador: Recolher vs Elevar */}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => setAeroWing(false)}
                    className={`py-1 text-[7px] font-bold rounded border transition-colors cursor-pointer ${
                      !isAeroWingExtended
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                        : 'bg-black/40 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    ⬇️ RECOLHER
                  </button>
                  <button
                    onClick={() => setAeroWing(true)}
                    className={`py-1 text-[7px] font-bold rounded border transition-colors cursor-pointer ${
                      isAeroWingExtended
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                        : 'bg-black/40 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    ⬆️ ELEVAR (+150KG)
                  </button>
                </div>
                {/* 2. Ângulo de ataque */}
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setRearWingPosition('low_drag')}
                    className={`py-1 text-[7px] font-bold rounded border transition-colors cursor-pointer ${
                      rearWingPosition === 'low_drag'
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                        : 'bg-black/40 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    LOW DRAG
                  </button>
                  <button
                    onClick={() => setRearWingPosition('balanced')}
                    className={`py-1 text-[7px] font-bold rounded border transition-colors cursor-pointer ${
                      rearWingPosition === 'balanced'
                        ? 'bg-zinc-500/25 border-zinc-300 text-white shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                        : 'bg-black/40 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    BALANCED
                  </button>
                  <button
                    onClick={() => setRearWingPosition('high_downforce')}
                    className={`py-1 text-[7px] font-bold rounded border transition-colors cursor-pointer ${
                      rearWingPosition === 'high_downforce'
                        ? 'bg-red-500/25 border-red-400 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                        : 'bg-black/40 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    DOWNFORCE
                  </button>
                </div>
              </div>

              {/* PSE - Porsche Sport Exhaust (Válvula de Difusor) */}
              <button
                onClick={toggleExhaustValve}
                className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  exhaustValveOpen
                    ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                    : 'bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <span className="text-xl">⚡</span>
                <strong className="text-[9px] font-black">SPORT EXHAUST (PSE)</strong>
                <span className={`text-[7px] font-bold ${exhaustValveOpen ? 'text-amber-400' : 'text-zinc-500'}`}>
                  {exhaustValveOpen ? 'VÁLVULA ABERTA · ROAR' : 'SILENCIOSO · CIVIL'}
                </span>
              </button>

              {/* Porsche Stability & Launch Control Status */}
              <div className="p-2.5 rounded-2xl border border-white/10 bg-zinc-900/80 flex flex-col items-center justify-center gap-1 text-center">
                <span className="text-xl">🛡️</span>
                <strong className="text-[9px] font-black text-white">PORSCHE STABILITY (PSM)</strong>
                <span className="text-[7px] font-bold text-emerald-400">
                  SISTEMA ELETRÔNICO ATIVO · SPORT CHRONO
                </span>
              </div>
            </div>

            <div className="w-full flex justify-between items-center px-2 py-1 rounded bg-black/60 text-[7px] text-zinc-400 border border-white/5">
              <span>SUSPENSÃO: <b className="text-white">{suspensionHeight.toUpperCase()}</b></span>
              <span>DOWNFORCE REAL: <b className="text-amber-400">{downforceN ? `${downforceN.toFixed(0)} N (${(downforceN / 9.81).toFixed(0)} kgf)` : '0 N'}</b></span>
              <span>ASA: <b className="text-red-400">{rearWingPosition.toUpperCase()}</b></span>
            </div>
          </div>
        )}

        {/* ABA: PORSCHE NAVIGATION PLUS & GPS TELEMETRY */}
        {activeTab === 'nav' && (
          <div className="w-full flex flex-col justify-between items-center gap-1 h-full p-1 text-center font-mono">
            {/* Header da Navegação */}
            <div className="w-full flex items-center justify-between px-2 py-0.5 rounded-lg bg-zinc-900/90 border border-amber-500/30">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[7px] font-black text-amber-400 uppercase tracking-widest">
                  GPS CONNECT PLUS
                </span>
              </div>
              <span className="text-[7px] text-zinc-300 font-bold uppercase truncate max-w-[130px]">
                {zoneName || 'Circuito 2D'}
              </span>
            </div>

            {/* Radar / Mapa Vetorial Tático Porsche */}
            <div className="relative w-full max-w-[260px] h-[90px] sm:h-[105px] rounded-xl bg-[#07090e] border border-amber-500/20 overflow-hidden shadow-inner flex items-center justify-center">
              {/* Grid de Coordenadas */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, #f59e0b 1px, transparent 1px), linear-gradient(to bottom, #f59e0b 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-amber-500/20" />
              <div className="absolute inset-y-0 left-1/2 w-[1px] bg-amber-500/20" />

              {/* Indicador do Veículo (Blip com Rumo) */}
              <div
                className="absolute w-4 h-4 -ml-2 -mt-2 flex items-center justify-center transition-all duration-75"
                style={{
                  left: `${Math.max(10, Math.min(90, 50 + (positionX / 300) * 40))}%`,
                  top: `${Math.max(10, Math.min(90, 50 - (positionY / 300) * 40))}%`,
                }}
              >
                <div
                  className="text-amber-400 text-xs drop-shadow-[0_0_6px_rgba(245,158,11,0.9)]"
                  style={{ transform: `rotate(${headingDeg}deg)` }}
                >
                  ▲
                </div>
              </div>

              {/* Rosa dos Ventos Mini */}
              <div className="absolute top-1 right-2 flex flex-col items-center text-[6px] text-zinc-400 font-bold">
                <span className="text-amber-400">N</span>
                <span>{Math.round(headingDeg)}°</span>
              </div>

              {/* Badge de Superfície */}
              <div className="absolute bottom-1 left-2 text-[6px] font-bold px-1.5 py-0.5 rounded bg-black/70 border border-white/10 text-zinc-300">
                PISO: <span className="text-amber-300">{surfaceType.toUpperCase()}</span>
              </div>
            </div>

            {/* Leituras Numéricas de Navegação */}
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
                <span className="text-amber-400 font-mono">{Math.round(headingDeg)}°</span>
              </div>
            </div>

            {/* Ação: Alternar Mapa Dirigível no Cockpit */}
            <button
              onClick={toggleMap}
              className={`w-full py-0.5 px-2 rounded-lg border text-[7px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow flex items-center justify-center gap-1 ${
                isMapOpen
                  ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                  : 'bg-zinc-900 text-amber-300 border-amber-500/40 hover:bg-zinc-800'
              }`}
            >
              <span>🗺️</span>
              <span>{isMapOpen ? 'MAPA 2D ATIVO NO COCKPIT' : 'PROJETAR MAPA NO COCKPIT'}</span>
            </button>
          </div>
        )}

        {/* ABA 3: CLIMATIZAÇÃO PORSCHE ADVANCED 2-ZONE */}
        {activeTab === 'clima' && (
          <ClimateControlPanel theme="porsche" compact={compact || fill} />
        )}

        {/* ABA 4: PCM STREAMING / YOUTUBE & MÚSICAS */}
        {activeTab === 'media' && (
          <InternetMediaCenter theme="porsche" compact={compact || fill} />
        )}

        {/* ABA 5: LUZ AMBIENTE DA CABINE & PAINEL DIGITAL */}
        {activeTab === 'ambient' && (
          <div className="w-full flex flex-col items-center justify-center py-1 gap-1 text-center my-auto">
            <span className="text-[7.5px] sm:text-[8px] text-zinc-400 font-bold uppercase tracking-widest">
              ILUMINAÇÃO DE CABINE PORSCHE
            </span>
            <div className="w-full grid grid-cols-4 gap-1 px-1 my-0.5">
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
              Sincroniza o brilho de LED do painel digital 992 GT3 RS, console e multimídia
            </span>
          </div>
        )}
      </div>

      {/* ── Botões Capacitivos Virtuais Porsche (Rodapé) ── */}
      <div className="w-full flex items-center justify-around border-t border-white/10 pt-1 mt-auto text-[6.5px] sm:text-[7.5px] font-bold shrink-0">
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
          onClick={() => setActiveTab('nav')}
          className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
            activeTab === 'nav'
              ? 'bg-amber-500 text-black font-black shadow-[0_0_8px_rgba(245,158,11,0.5)]'
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
