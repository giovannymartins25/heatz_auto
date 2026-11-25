import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { BoostGauge, CircularProgressDial } from '@/components/gauges'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp } from '@/utils/math'
import { AMBIENT_COLOR_MAP } from '@/utils/ambientLighting'
import { resolveVehicleControls } from '@/systems/vehicle/vehicleResolvers'
import { ClimateControlPanel } from './shared/ClimateControlPanel'
import { InternetMediaCenter } from './shared/InternetMediaCenter'
import { MultimediaStatusFooter } from './shared/MultimediaStatusFooter'

interface GolfGTIDiscoverProProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  compact?: boolean
  fill?: boolean
  className?: string
}

type GTIActiveTab = 'sport' | 'nav' | 'clima' | 'media' | 'ambient'

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
  fill = false,
  className = '',
}: GolfGTIDiscoverProProps) {
  const [activeTab, setActiveTab] = useState<GTIActiveTab>('sport')
  const [clockTime, setClockTime] = useState('14:32')

  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const setAmbientLightColor = useSimulationStore((s) => s.setAmbientLightColor)
  const ambientTheme = AMBIENT_COLOR_MAP[ambientLightColor] || AMBIENT_COLOR_MAP.red

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const hasTurbo = !!vehicle.engine.turbo?.enabled
  const maxPowerHp = vehicle.engine.maxPower || 230
  const redlineRpm = vehicle.engine.maxRpm || 6800
  const rpm = telemetry.tachometer.rpm
  const throttlePercent = telemetry.pedals.throttlePercent
  const coolantTemp = telemetry.auxGauges.coolantTemp || 90
  const positionX = useSimulationStore((s) => s.positionX)
  const positionY = useSimulationStore((s) => s.positionY)
  const headingDeg = useSimulationStore((s) => s.headingDeg)
  const zoneName = useSimulationStore((s) => s.zoneName)
  const surfaceType = useSimulationStore((s) => s.surfaceType)
  const isMapOpen = useSimulationStore((s) => s.isMapOpen)
  const toggleMap = useSimulationStore((s) => s.toggleMap)
  const tcsEnabled = useSimulationStore((s) => s.tcsEnabled)
  const tcsIntervening = useSimulationStore((s) => s.tcsIntervening)
  const setTcsEnabled = useSimulationStore((s) => s.setTcsEnabled)
  const controlsSpec = resolveVehicleControls(vehicle)
  const showDigitalTcs =
    controlsSpec.tractionControl.available &&
    controlsSpec.tractionControl.userToggleable &&
    controlsSpec.tractionControl.panel === 'multimedia'

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

  // Temperatura do óleo real da simulação térmica
  const oilTemp = Math.round(telemetry.auxGauges.oilTemp ?? (coolantTemp + 4))

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl sm:rounded-[1.8rem] bg-gradient-to-b from-[#131418] via-[#0b0c0f] to-[#050608] border-2 ${ambientTheme.borderClass} ${ambientTheme.shadowClass} overflow-hidden select-none font-mono transition-all duration-300 ${
        fill ? 'w-full h-full max-w-full max-h-full p-1.5 sm:p-2.5' : (compact ? 'w-[270px] p-2' : 'w-[325px] sm:w-[350px] p-2.5 sm:p-3')
      } ${className}`}
    >
      {/* ── Friso Superior GTI & Barra de Status ── */}
      <div className={`w-full flex items-center justify-between pb-1 mb-1 pr-28 border-b ${ambientTheme.headerBorderClass} text-[8px] sm:text-[9px] shrink-0`}>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: ambientTheme.hex }} />
          <span className="font-black tracking-wider" style={{ color: ambientTheme.hex }}>DISCOVER PRO</span>
          <span className="text-zinc-400 font-bold hidden xs:inline">· SPORT HMI</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 font-bold">
          <span className="text-[7px] text-zinc-500">APP-CONNECT</span>
          <span className="text-white font-mono">{clockTime}</span>
        </div>
      </div>

      {/* ── Conteúdo Central por Aba ── */}
      <div className="flex-1 min-h-0 w-full flex flex-col justify-between overflow-y-auto p-1" style={{ touchAction: 'pan-y' }}>
        {/* ABA 1: SPORT HMI (3 MOSTRADORES GTI) */}
        {activeTab === 'sport' && (
          <div className="w-full flex flex-col items-center gap-1 my-auto">
            <div className="w-full flex items-center justify-around">
              {/* Mostrador 1: Ladedruck (Turbo Boost) */}
              <div className="flex flex-col items-center">
                <span className="text-[6.5px] sm:text-[7px] font-bold text-red-500 uppercase tracking-widest mb-0.5">
                  LADEDRUCK
                </span>
                <div className="relative p-0.5 rounded-full bg-zinc-900/90 border border-red-600/30 shadow-inner">
                  <BoostGauge
                    boostBar={hasTurbo ? boostPressureBar : -0.2}
                    peakBar={hasTurbo ? peakBoostBar : 0}
                    size={compact || fill ? 52 : 76}
                    showPeak={false}
                    showLabel={false}
                  />
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[7px] sm:text-[8px] font-black">
                  <span className={boostPressureBar > 0 ? 'text-red-400' : 'text-sky-400'}>
                    {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR
                  </span>
                  {peakBoostBar > 0.1 && (
                    <span className="text-amber-400 text-[6.5px]">PK +{peakBoostBar.toFixed(1)}</span>
                  )}
                </div>
              </div>

              {/* Mostrador 2: Leistung (Potência em CV) */}
              <CircularProgressDial
                label="LEISTUNG"
                value={instantHp}
                max={maxPowerHp}
                unit="CV"
                color="#ef4444"
                glowColor="#ef4444"
                subLabel={`MAX ${maxPowerHp} CV`}
                compact={compact}
                fill={fill}
              />

              {/* Mostrador 3: Öltemperatur */}
              <CircularProgressDial
                label="ÖLTEMP"
                value={oilTemp}
                min={50}
                max={130}
                unit="°C"
                color="#10b981"
                glowColor="#10b981"
                subLabel="NORMAL"
                compact={compact}
                fill={fill}
              />
            </div>

            {/* Barra de Spool da Turbina GTI */}
            <div className="w-full flex flex-col px-1 pt-0.5 border-t border-white/5">
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

            {/* Status Oficial VW Sport HMI + Controle Digital ASR/ESC */}
            <div className="w-full flex items-center justify-between px-2 py-0.5 rounded bg-black/60 border border-white/5 text-[7px] font-mono text-zinc-400 mt-0.5">
              <span>MOTOR: <b className="text-red-400">2.0 TSI EA888</b></span>
              <span>CÂMBIO: <b className="text-white">DSG DQ250</b></span>
              {showDigitalTcs ? (
                <button
                  type="button"
                  data-testid="multimedia-tcs-toggle"
                  aria-pressed={tcsEnabled}
                  onClick={() => setTcsEnabled(!tcsEnabled)}
                  className={`px-1.5 py-0.5 rounded border font-black cursor-pointer transition-all ${
                    !tcsEnabled
                      ? 'border-amber-400/60 bg-amber-500/20 text-amber-300'
                      : tcsIntervening
                        ? 'border-amber-400 bg-amber-500/30 text-amber-200 animate-pulse'
                        : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {tcsEnabled ? 'ASR ATIVO' : 'ESC SPORT / OFF'}
                </button>
              ) : (
                <span>BOOST: <b className="text-amber-400">{boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : '0.00'} BAR</b></span>
              )}
            </div>
          </div>
        )}

        {/* ABA: NAVEGAÇÃO VW DISCOVER PRO */}
        {activeTab === 'nav' && (
          <div className="w-full flex flex-col justify-between items-center gap-1 h-full p-1 text-center font-mono">
            {/* Header da Navegação VW */}
            <div className="w-full flex items-center justify-between px-2 py-0.5 rounded-lg bg-zinc-900/90 border border-red-500/30">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-[7px] font-black text-red-400 uppercase tracking-widest">
                  DISCOVER PRO GPS
                </span>
              </div>
              <span className="text-[7px] text-zinc-300 font-bold uppercase truncate max-w-[130px]">
                {zoneName || 'Circuito 2D'}
              </span>
            </div>

            {/* Radar / Mapa Vetorial VW */}
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

        {/* ABA 2: CLIMATRONIC GTI */}
        {activeTab === 'clima' && (
          <ClimateControlPanel vehicle={vehicle} theme="gti" compact={compact || fill} />
        )}

        {/* ABA 3: APP-CONNECT / YOUTUBE & MÚSICAS */}
        {activeTab === 'media' && (
          <InternetMediaCenter theme="gti" compact={compact || fill} />
        )}

        {/* ABA 4: ILUMINAÇÃO AMBIENTE GTI */}
        {activeTab === 'ambient' && (
          <div className="w-full flex flex-col items-center justify-center py-1 gap-1 text-center my-auto">
            <span className="text-[7.5px] sm:text-[8px] text-zinc-400 font-bold uppercase tracking-widest">
              ILUMINAÇÃO AMBIENTE GTI (CABINE & PAINEL)
            </span>
            <div className="w-full grid grid-cols-4 sm:grid-cols-4 gap-1 px-1 my-0.5">
              {(
                [
                  { id: 'red', name: 'VERMELHO GTI', hex: '#ef4444' },
                  { id: 'blue', name: 'AZUL GOLF R', hex: '#3b82f6' },
                  { id: 'amber', name: 'CLUBSPORT', hex: '#f59e0b' },
                  { id: 'cyan', name: 'AZUL GELO', hex: '#06b6d4' },
                  { id: 'purple', name: 'ROXO VIOLETA', hex: '#a855f7' },
                  { id: 'green', name: 'VERDE MINT', hex: '#10b981' },
                  { id: 'white', name: 'BRANCO PURO', hex: '#ffffff' },
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
              Sincroniza o brilho de LED do painel de instrumentos, console e multimídia
            </span>
          </div>
        )}
      </div>

      {/* ── Botões Capacitivos Virtuais VW (Rodapé) ── */}
      <div className="w-full flex items-center justify-around border-t border-white/10 pt-1 mt-auto text-[7.5px] sm:text-[8px] font-bold shrink-0">
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
      <MultimediaStatusFooter theme="red" />
    </div>
  )
})
