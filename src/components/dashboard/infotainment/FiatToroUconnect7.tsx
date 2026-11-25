import { memo, useEffect, useState } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { TRACKS } from './VehicleMultimedia'
import { MultimediaStatusFooter } from './shared/MultimediaStatusFooter'

export interface FiatToroUconnect7Props {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  className?: string
  fill?: boolean
}

type Uconnect7Tab = 'media' | 'climate' | 'nav' | 'vehicle' | 'settings'

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * FiatToroUconnect7 — Central Multimídia oficial Fiat Uconnect 7" (Toro Endurance 2025).
 * 
 * Especificações da versão Endurance:
 * - Tela horizontal sensível ao toque de 7 polegadas
 * - Funções essenciais: Mídia/Rádio, Climatização digital, Computador de Bordo e Ajustes
 * - Tração dianteira FWD exclusiva: sem seletor de tração integral ou reduzida
 * - Identidade visual Fiat moderna com acentos em vermelho (#dc2626) e grafite
 */
export const FiatToroUconnect7 = memo(function FiatToroUconnect7({
  vehicle,
  telemetry,
  className = '',
  fill = false,
}: FiatToroUconnect7Props) {
  const [activeTab, setActiveTab] = useState<Uconnect7Tab>('media')
  const [clock, setClock] = useState(() => new Date())
  const [trackIndex, setTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(42)

  // Climatização real sincronizada com useSimulationStore (ClimateSystem)
  const ambientTempC = useSimulationStore((s) => s.ambientTempC)
  const cabinTempC = useSimulationStore((s) => s.cabinTempC)
  const climateTargetTempC = useSimulationStore((s) => s.climateTargetTempC)
  const climateFanLevel = useSimulationStore((s) => s.climateFanLevel)
  const climateAcEnabled = useSimulationStore((s) => s.climateAcEnabled)
  const isCompressorEngaged = useSimulationStore((s) => s.isCompressorEngaged)
  const climateRecirculation = useSimulationStore((s) => s.climateRecirculation)
  const climateHeaterEnabled = useSimulationStore((s) => s.climateHeaterEnabled)
  const climateDefrosterEnabled = useSimulationStore((s) => s.climateDefrosterEnabled)
  const stepClimateTargetTempC = useSimulationStore((s) => s.stepClimateTargetTempC)
  const setClimateFanLevel = useSimulationStore((s) => s.setClimateFanLevel)
  const toggleClimateAc = useSimulationStore((s) => s.toggleClimateAc)
  const toggleClimateRecirculation = useSimulationStore((s) => s.toggleClimateRecirculation)
  const toggleClimateHeater = useSimulationStore((s) => s.toggleClimateHeater)
  const toggleClimateDefroster = useSimulationStore((s) => s.toggleClimateDefroster)

  // Ajustes
  const [volume, setVolume] = useState(65)
  const [brightness, setBrightness] = useState(85)

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const positionX = useSimulationStore((s) => s.positionX)
  const positionY = useSimulationStore((s) => s.positionY)
  const headingDeg = useSimulationStore((s) => s.headingDeg)
  const zoneName = useSimulationStore((s) => s.zoneName)
  const surfaceType = useSimulationStore((s) => s.surfaceType)
  const isMapOpen = useSimulationStore((s) => s.isMapOpen)
  const toggleMap = useSimulationStore((s) => s.toggleMap)

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 15000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isPlaying) return
    const timer = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= TRACKS[trackIndex].dur) {
          setTrackIndex((i) => (i + 1) % TRACKS.length)
          return 0
        }
        return prev + 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isPlaying, trackIndex])

  const currentTrack = TRACKS[trackIndex]
  const speedKmh = Math.round(telemetry.speedometer.speed)
  const rpm = Math.round(telemetry.tachometer.rpm)
  const timeStr = clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const changeTrack = (delta: number) => {
    setTrackIndex((prev) => (prev + delta + TRACKS.length) % TRACKS.length)
    setElapsed(0)
    setIsPlaying(true)
  }

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-100 select-none shadow-2xl ${
        fill ? 'w-full h-full' : 'w-full max-w-[720px] aspect-[16/9]'
      } ${className}`}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Moldura superior estilo Uconnect 7" — Barra de arraste/encaixe */}
      <header
        className="flex h-7 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3 pr-28 text-[9px] sm:text-[10px] font-mono cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'none' }}
      >
        <div className="flex items-center gap-2">
          {/* Logo Fiat text + bandeira italiana */}
          <div className="flex items-center gap-1 font-black tracking-wider text-red-500">
            <span className="text-[11px] font-sans tracking-tight">FIAT</span>
            <span className="inline-flex h-2.5 w-3 overflow-hidden rounded-xs border border-white/20">
              <span className="w-1/3 bg-emerald-600" />
              <span className="w-1/3 bg-white" />
              <span className="w-1/3 bg-red-600" />
            </span>
          </div>
          <span className="text-zinc-500">|</span>
          <span className="text-zinc-400 font-sans font-bold text-[9px]">Uconnect™ 7"</span>
        </div>

        <div className="flex items-center gap-2 text-zinc-400 text-[8.5px]">
          <span>{Math.round(ambientTempC)}°C</span>
          <span>📶 4G</span>
          <span className="font-bold text-white">{timeStr}</span>
        </div>
      </header>

      {/* Conteúdo da Tela */}
      <main className="flex-1 min-h-0 p-2 overflow-y-auto" style={{ touchAction: 'pan-y' }}>
        {activeTab === 'media' && (
          <div className="grid h-full grid-cols-[1.1fr_1fr] gap-2 items-center">
            {/* Capa e Telemetria Musical */}
            <div className="flex h-full flex-col justify-between rounded-xl bg-zinc-900/70 border border-white/5 p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex aspect-square h-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-zinc-900 text-2xl shadow-lg border border-red-500/30">
                  📻
                </div>
                <div className="min-w-0">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono text-[7.5px] font-bold uppercase mb-0.5">
                    FM / Bluetooth
                  </span>
                  <div className="truncate text-xs font-black text-white">{currentTrack.title}</div>
                  <div className="truncate text-[9.5px] text-zinc-400">{currentTrack.artist}</div>
                </div>
              </div>

              {/* Barra de Progresso */}
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all duration-300"
                    style={{ width: `${(elapsed / currentTrack.dur) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] font-mono text-zinc-500">
                  <span>{fmtTime(elapsed)}</span>
                  <span>{fmtTime(currentTrack.dur)}</span>
                </div>
              </div>

              {/* Botões do Player */}
              <div className="flex items-center justify-center gap-4 text-base">
                <button
                  type="button"
                  onClick={() => changeTrack(-1)}
                  className="p-1 rounded-full text-zinc-300 hover:text-white active:scale-90 transition-transform cursor-pointer"
                  title="Anterior"
                >
                  ⏮
                </button>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="h-8 w-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform cursor-pointer"
                  title={isPlaying ? 'Pausar' : 'Reproduzir'}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button
                  type="button"
                  onClick={() => changeTrack(1)}
                  className="p-1 rounded-full text-zinc-300 hover:text-white active:scale-90 transition-transform cursor-pointer"
                  title="Próxima"
                >
                  ⏭
                </button>
              </div>
            </div>

            {/* Lista Rápida de Músicas */}
            <div className="flex h-full flex-col gap-1 overflow-y-auto pr-0.5">
              <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase px-1">
                Playlist Uconnect
              </span>
              {TRACKS.map((t, i) => (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => {
                    setTrackIndex(i)
                    setElapsed(0)
                    setIsPlaying(true)
                  }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    i === trackIndex
                      ? 'bg-red-950/40 border-red-500 text-white shadow-sm'
                      : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="truncate min-w-0 pr-2">
                    <div className="truncate text-[9.5px] font-bold">{t.title}</div>
                    <div className="truncate text-[7.5px] text-zinc-500">{t.artist}</div>
                  </div>
                  <span className="text-[8px] font-mono text-zinc-500 shrink-0">{fmtTime(t.dur)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'climate' && (
          <div className="grid h-full grid-cols-[1fr_1.1fr_1fr] gap-1.5 items-center" data-testid="multimedia-climate-panel">
            {/* Temperatura */}
            <div className="flex h-full flex-col items-center justify-center gap-0.5 rounded-xl bg-zinc-900/70 border border-white/5 p-1.5">
              <span className="text-[7.5px] font-mono font-bold text-zinc-400 uppercase">Temperatura</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="multimedia-btn-temp-down"
                  onClick={() => stepClimateTargetTempC(-0.5)}
                  className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-zinc-800 border border-white/10 text-white font-bold active:scale-90 cursor-pointer text-sm"
                >
                  −
                </button>
                <span className="text-lg sm:text-2xl font-black text-red-400 font-mono min-w-[55px] text-center" data-testid="multimedia-target-temp">
                  {climateTargetTempC.toFixed(1)}°
                </span>
                <button
                  type="button"
                  data-testid="multimedia-btn-temp-up"
                  onClick={() => stepClimateTargetTempC(0.5)}
                  className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-zinc-800 border border-white/10 text-white font-bold active:scale-90 cursor-pointer text-sm"
                >
                  +
                </button>
              </div>
              <span className="text-[7px] font-mono text-zinc-500">
                Ext {ambientTempC.toFixed(0)}° · Cab {cabinTempC.toFixed(1)}°C
              </span>
            </div>

            {/* Ventilação (0 a 5) */}
            <div className="flex h-full flex-col items-center justify-center gap-1 rounded-xl bg-zinc-900/70 border border-white/5 p-1.5">
              <span className="text-[7.5px] font-mono font-bold text-zinc-400 uppercase">Fluxo de Ar</span>
              <div className="flex items-end gap-0.5 h-8 sm:h-10">
                {([0, 1, 2, 3, 4, 5] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    data-testid={`multimedia-btn-fan-${lvl}`}
                    onClick={() => setClimateFanLevel(lvl)}
                    className={`w-3.5 sm:w-4 rounded-t-sm text-[7px] font-mono font-black transition-all cursor-pointer flex items-end justify-center pb-0.5 ${
                      climateFanLevel === lvl ? 'text-white ring-1 ring-red-300' : 'text-zinc-400'
                    }`}
                    style={{
                      height: `${lvl === 0 ? 28 : 28 + lvl * 14}%`,
                      background:
                        lvl === 0
                          ? climateFanLevel === 0
                            ? '#52525b'
                            : '#27272a'
                          : lvl <= climateFanLevel
                            ? '#dc2626'
                            : '#27272a',
                    }}
                    title={`Velocidade ${lvl}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <span className="text-[7px] font-mono text-zinc-400">Nível {climateFanLevel} de 5</span>
            </div>

            {/* Botões de Comando (conforme VehicleCabinSpec manual_ac da Endurance) */}
            <div className="grid grid-cols-2 gap-1 h-full content-center">
              <button
                type="button"
                data-testid="multimedia-btn-ac"
                onClick={toggleClimateAc}
                className={`py-1 px-1 rounded-lg border font-mono text-[8px] font-black uppercase transition-all cursor-pointer ${
                  climateAcEnabled ? 'bg-red-600 text-white border-red-500' : 'bg-zinc-900 text-zinc-500 border-white/5'
                }`}
              >
                A/C{isCompressorEngaged ? ' ●' : ''}
              </button>
              <button
                type="button"
                data-testid="multimedia-btn-heater"
                onClick={toggleClimateHeater}
                className={`py-1 px-1 rounded-lg border font-mono text-[7.5px] font-bold uppercase transition-all cursor-pointer ${
                  climateHeaterEnabled ? 'bg-orange-600 text-white border-orange-400' : 'bg-zinc-900 text-zinc-500 border-white/5'
                }`}
              >
                Aquec.
              </button>
              <button
                type="button"
                data-testid="multimedia-btn-recirc"
                onClick={toggleClimateRecirculation}
                className={`py-1 px-1 rounded-lg border font-mono text-[7.5px] font-bold uppercase transition-all cursor-pointer ${
                  climateRecirculation ? 'bg-red-600 text-white border-red-500' : 'bg-zinc-900 text-zinc-500 border-white/5'
                }`}
              >
                Recirc.
              </button>
              <button
                type="button"
                data-testid="multimedia-btn-defrost"
                onClick={toggleClimateDefroster}
                className={`py-1 px-1 rounded-lg border font-mono text-[7.5px] font-bold uppercase transition-all cursor-pointer ${
                  climateDefrosterEnabled ? 'bg-red-600 text-white border-red-500' : 'bg-zinc-900 text-zinc-500 border-white/5'
                }`}
              >
                Desemb.
              </button>
            </div>
          </div>
        )}

        {activeTab === 'nav' && (
          <div className="flex flex-col justify-between items-center gap-1 h-full p-1 text-center font-mono">
            {/* Header da Navegação Toro */}
            <div className="w-full flex items-center justify-between px-2 py-0.5 rounded-lg bg-zinc-900/90 border border-red-500/30">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-[7px] font-black text-red-400 uppercase tracking-widest">
                  UCONNECT NAV 7"
                </span>
              </div>
              <span className="text-[7px] text-zinc-300 font-bold uppercase truncate max-w-[130px]">
                {zoneName || 'Circuito 2D'}
              </span>
            </div>

            {/* Radar / Mapa Vetorial Toro */}
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

        {activeTab === 'vehicle' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 items-stretch my-auto">
            {/* Card 1: Velocidade e Marcha */}
            <div className="flex flex-col justify-center items-center rounded-xl bg-zinc-900/70 border border-white/5 p-1.5">
              <span className="text-[7px] font-mono text-zinc-500 uppercase">Velocidade</span>
              <div className="text-xl sm:text-2xl font-black font-mono text-white">{speedKmh}</div>
              <span className="text-[7px] font-mono text-zinc-500">KM/H · AT6</span>
            </div>

            {/* Card 2: Motor T270 Flex */}
            <div className="flex flex-col justify-center items-center rounded-xl bg-zinc-900/70 border border-white/5 p-1.5">
              <span className="text-[7px] font-mono text-zinc-500 uppercase">1.3 Turbo Flex</span>
              <div className="text-base sm:text-lg font-black font-mono text-red-400">{rpm}</div>
              <span className="text-[7px] font-mono text-zinc-500">RPM (Máx 6.500)</span>
            </div>

            {/* Card 3: Pressão de Turbo */}
            <div className="flex flex-col justify-center items-center rounded-xl bg-zinc-900/70 border border-white/5 p-1.5">
              <span className="text-[7px] font-mono text-zinc-500 uppercase">Pressão Turbo</span>
              <div className="text-base sm:text-lg font-black font-mono text-white">
                {boostPressureBar > 0.05 ? `${boostPressureBar.toFixed(2)}` : '0.00'}
              </div>
              <span className="text-[7px] font-mono text-zinc-500">BAR (Pico 1.25)</span>
            </div>

            {/* Card 4: Tração FWD (Endurance) */}
            <div className="flex flex-col justify-center items-center rounded-xl bg-zinc-900/70 border border-white/5 p-1.5 text-center">
              <span className="text-[7px] font-mono text-zinc-500 uppercase">Arquitetura Tração</span>
              <div className="text-xs font-black font-mono text-emerald-400 mt-0.5">FWD 4x2</div>
              <span className="text-[6.5px] font-mono text-zinc-400 mt-0.5 leading-tight">
                Eixo Dianteiro
              </span>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid h-full grid-cols-2 gap-2 items-center">
            <div className="flex h-full flex-col justify-around rounded-xl bg-zinc-900/70 border border-white/5 p-2.5 text-[9px] font-mono">
              <label className="flex items-center gap-2">
                <span className="w-16 text-zinc-400">Volume</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => setVolume(+e.target.value)}
                  className="h-1 flex-1 accent-red-500 cursor-pointer"
                />
                <span className="w-6 text-right text-white font-bold">{volume}</span>
              </label>

              <label className="flex items-center gap-2">
                <span className="w-16 text-zinc-400">Brilho</span>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={brightness}
                  onChange={(e) => setBrightness(+e.target.value)}
                  className="h-1 flex-1 accent-red-500 cursor-pointer"
                />
                <span className="w-6 text-right text-white font-bold">{brightness}</span>
              </label>
            </div>

            <div className="flex h-full flex-col justify-center gap-1 rounded-xl bg-zinc-900/70 border border-white/5 p-2.5 text-[8.5px] font-mono">
              <div className="text-white font-bold">{vehicle.info.name}</div>
              <div className="text-zinc-400">Motor GSE T270 1.3 Turbo 16V Flex</div>
              <div className="text-zinc-500">Câmbio Aisin AT6 · Tração Dianteira FWD</div>
              <div className="text-red-400 text-[8px] mt-1">Uconnect™ 7 Touch · v2.5</div>
            </div>
          </div>
        )}
      </main>

      {/* Barra de Navegação Inferior Uconnect 7" (5 abas) */}
      <nav className="grid h-10 shrink-0 grid-cols-5 border-t border-zinc-800 bg-zinc-950/90 text-center font-sans font-bold text-[8px] sm:text-[9px] tracking-wide">
        <button
          type="button"
          onClick={() => setActiveTab('media')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === 'media' ? 'text-red-500 border-t-2 border-red-500 bg-red-950/20' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="text-xs">🎵</span>
          <span>Mídia</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('nav')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === 'nav' ? 'text-red-500 border-t-2 border-red-500 bg-red-950/20 font-black' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="text-xs">🧭</span>
          <span>GPS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('climate')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === 'climate' ? 'text-red-500 border-t-2 border-red-500 bg-red-950/20' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="text-xs">❄️</span>
          <span>Clima</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vehicle')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === 'vehicle' ? 'text-red-500 border-t-2 border-red-500 bg-red-950/20' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="text-xs">🚗</span>
          <span>Veículo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === 'settings' ? 'text-red-500 border-t-2 border-red-500 bg-red-950/20' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="text-xs">⚙️</span>
          <span>Ajustes</span>
        </button>
      </nav>
      <MultimediaStatusFooter theme="red" className="mt-0" />
    </div>
  )
})
