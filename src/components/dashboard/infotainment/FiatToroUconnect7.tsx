import { memo, useEffect, useState } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { TRACKS } from './VehicleMultimedia'

export interface FiatToroUconnect7Props {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  className?: string
  fill?: boolean
}

type Uconnect7Tab = 'media' | 'climate' | 'vehicle' | 'settings'

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

  // Climatização
  const [temp, setTemp] = useState(21.5)
  const [fanSpeed, setFanSpeed] = useState(3)
  const [isAcOn, setIsAcOn] = useState(true)
  const [isAuto, setIsAuto] = useState(true)
  const [recirc, setRecirc] = useState(false)
  const [defrost, setDefrost] = useState(false)

  // Ajustes
  const [volume, setVolume] = useState(65)
  const [brightness, setBrightness] = useState(85)

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)

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
    >
      {/* Moldura superior estilo Uconnect 7" — Barra de arraste/encaixe */}
      <header className="flex h-7 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3 text-[10px] font-mono cursor-grab active:cursor-grabbing select-none">
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

        <div className="flex items-center gap-3 text-zinc-400 text-[9px]">
          <span>26°C</span>
          <span>📶 4G</span>
          <span>📱 Bluetooth</span>
          <span className="font-bold text-white">{timeStr}</span>
        </div>
      </header>

      {/* Conteúdo da Tela */}
      <main className="flex-1 min-h-0 p-2 overflow-y-auto">
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
          <div className="grid h-full grid-cols-[1fr_1.1fr_1fr] gap-2 items-center">
            {/* Temperatura */}
            <div className="flex h-full flex-col items-center justify-center gap-1 rounded-xl bg-zinc-900/70 border border-white/5 p-2">
              <span className="text-[8px] font-mono font-bold text-zinc-400 uppercase">Temperatura</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTemp((t) => Math.max(16, t - 0.5))}
                  className="h-8 w-8 rounded-full bg-zinc-800 border border-white/10 text-white font-bold active:scale-90 cursor-pointer"
                >
                  −
                </button>
                <span className="text-2xl font-black text-red-400 font-mono min-w-[65px] text-center">
                  {temp.toFixed(1)}°
                </span>
                <button
                  type="button"
                  onClick={() => setTemp((t) => Math.min(30, t + 0.5))}
                  className="h-8 w-8 rounded-full bg-zinc-800 border border-white/10 text-white font-bold active:scale-90 cursor-pointer"
                >
                  +
                </button>
              </div>
              <span className="text-[7.5px] font-mono text-zinc-500">Ar Digital Automático</span>
            </div>

            {/* Ventilação */}
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl bg-zinc-900/70 border border-white/5 p-2">
              <span className="text-[8px] font-mono font-bold text-zinc-400 uppercase">Fluxo de Ar</span>
              <div className="flex items-end gap-1.5 h-10">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setFanSpeed(lvl)}
                    className="w-5 rounded-t-sm transition-all cursor-pointer"
                    style={{
                      height: `${lvl * 20}%`,
                      background: lvl <= fanSpeed ? '#dc2626' : '#27272a',
                    }}
                    title={`Velocidade ${lvl}`}
                  />
                ))}
              </div>
              <span className="text-[7.5px] font-mono text-zinc-400">Nível {fanSpeed} de 5</span>
            </div>

            {/* Botões de Comando */}
            <div className="grid grid-cols-2 gap-1.5 h-full content-center">
              <button
                type="button"
                onClick={() => setIsAcOn(!isAcOn)}
                className={`py-2 px-1 rounded-lg border font-mono text-[9px] font-black uppercase transition-all cursor-pointer ${
                  isAcOn ? 'bg-red-600 text-white border-red-500' : 'bg-zinc-900 text-zinc-500 border-white/5'
                }`}
              >
                A/C
              </button>
              <button
                type="button"
                onClick={() => setIsAuto(!isAuto)}
                className={`py-2 px-1 rounded-lg border font-mono text-[9px] font-black uppercase transition-all cursor-pointer ${
                  isAuto ? 'bg-red-600 text-white border-red-500' : 'bg-zinc-900 text-zinc-500 border-white/5'
                }`}
              >
                AUTO
              </button>
              <button
                type="button"
                onClick={() => setRecirc(!recirc)}
                className={`py-2 px-1 rounded-lg border font-mono text-[8px] font-bold uppercase transition-all cursor-pointer ${
                  recirc ? 'bg-red-600 text-white border-red-500' : 'bg-zinc-900 text-zinc-500 border-white/5'
                }`}
              >
                Recirc.
              </button>
              <button
                type="button"
                onClick={() => setDefrost(!defrost)}
                className={`py-2 px-1 rounded-lg border font-mono text-[8px] font-bold uppercase transition-all cursor-pointer ${
                  defrost ? 'bg-red-600 text-white border-red-500' : 'bg-zinc-900 text-zinc-500 border-white/5'
                }`}
              >
                Desemb.
              </button>
            </div>
          </div>
        )}

        {activeTab === 'vehicle' && (
          <div className="grid h-full grid-cols-4 gap-2 items-center">
            {/* Card 1: Velocidade e Marcha */}
            <div className="flex h-full flex-col justify-center items-center rounded-xl bg-zinc-900/70 border border-white/5 p-2">
              <span className="text-[7.5px] font-mono text-zinc-500 uppercase">Velocidade</span>
              <div className="text-2xl font-black font-mono text-white">{speedKmh}</div>
              <span className="text-[7.5px] font-mono text-zinc-500">KM/H · AT6</span>
            </div>

            {/* Card 2: Motor T270 Flex */}
            <div className="flex h-full flex-col justify-center items-center rounded-xl bg-zinc-900/70 border border-white/5 p-2">
              <span className="text-[7.5px] font-mono text-zinc-500 uppercase">1.3 Turbo Flex</span>
              <div className="text-lg font-black font-mono text-red-400">{rpm}</div>
              <span className="text-[7.5px] font-mono text-zinc-500">RPM (Máx 6.500)</span>
            </div>

            {/* Card 3: Pressão de Turbo */}
            <div className="flex h-full flex-col justify-center items-center rounded-xl bg-zinc-900/70 border border-white/5 p-2">
              <span className="text-[7.5px] font-mono text-zinc-500 uppercase">Pressão Turbo</span>
              <div className="text-lg font-black font-mono text-white">
                {boostPressureBar > 0.05 ? `${boostPressureBar.toFixed(2)}` : '0.00'}
              </div>
              <span className="text-[7.5px] font-mono text-zinc-500">BAR (Pico 1.25)</span>
            </div>

            {/* Card 4: Tração FWD (Endurance) */}
            <div className="flex h-full flex-col justify-center items-center rounded-xl bg-zinc-900/70 border border-white/5 p-2 text-center">
              <span className="text-[7.5px] font-mono text-zinc-500 uppercase">Arquitetura Tração</span>
              <div className="text-xs font-black font-mono text-emerald-400 mt-1">FWD 4x2</div>
              <span className="text-[7px] font-mono text-zinc-400 mt-0.5 leading-tight">
                Eixo Dianteiro · Picape Monobloco
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

      {/* Barra de Navegação Inferior Uconnect 7" */}
      <nav className="grid h-10 shrink-0 grid-cols-4 border-t border-zinc-800 bg-zinc-950/90 text-center font-sans font-bold text-[9px] tracking-wide">
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
    </div>
  )
})
