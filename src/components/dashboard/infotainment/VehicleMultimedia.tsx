import { memo, useEffect, useState } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { AMBIENT_COLOR_MAP, type AmbientLightColor } from '@/utils/ambientLighting'
import { getShortVehicleName } from '@/utils/vehicleSpecs'

export interface VehicleMultimediaProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  className?: string
  /** true: preenche 100% do container pai posicionado (slot do cockpit). */
  fill?: boolean
}

type TabId = 'home' | 'music' | 'youtube' | 'climate' | 'settings'

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'home', icon: '🏠', label: 'Início' },
  { id: 'music', icon: '🎵', label: 'Música' },
  { id: 'youtube', icon: '▶️', label: 'YouTube' },
  { id: 'climate', icon: '❄️', label: 'Ar' },
  { id: 'settings', icon: '⚙️', label: 'Ajustes' },
]

export const TRACKS = [
  { title: 'Midnight Drive', artist: 'Neon Highway', dur: 214 },
  { title: 'Redline', artist: 'V8 Dreams', dur: 187 },
  { title: 'Touge Run', artist: 'Drift Kings', dur: 242 },
  { title: 'Asphalt Sunrise', artist: 'Cruise Control', dur: 198 },
]
export const PLAYLIST = TRACKS

const VIDEOS = [
  { title: 'Onboard — Serra do Rio do Rastro', ch: 'Heatz Garage', len: '12:04', hue: 'from-sky-700 to-indigo-900' },
  { title: 'Arrancada 402m — melhores tempos', ch: 'Drag Brasil', len: '8:31', hue: 'from-red-700 to-orange-900' },
  { title: 'Som de escapamento: top 10', ch: 'Sound Lab', len: '15:47', hue: 'from-emerald-700 to-teal-900' },
]

const ACCENT_BY_BRAND: Record<string, string> = {
  porsche: '#d4af37',
  honda: '#ef4444',
  toyota: '#ef4444',
  volkswagen: '#38bdf8',
  chevrolet: '#f59e0b',
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * VehicleMultimedia — central multimídia que preenche 100% do retângulo do painel.
 *
 * Estrutura fixa (nunca excede o container pai):
 *   ┌ barra de status (relógio · veículo · conexões) ┐
 *   │ conteúdo principal da aba ativa (flex-1)       │
 *   └ barra de navegação inferior (sempre visível)  ┘
 * Todo conteúdo é demonstrativo: sem integração real com YouTube, serviços externos ou hardware.
 */
export const VehicleMultimedia = memo(function VehicleMultimedia({
  vehicle,
  telemetry,
  className = '',
  fill = false,
}: VehicleMultimediaProps) {
  const [tab, setTab] = useState<TabId>('home')
  const [clock, setClock] = useState(() => new Date())
  const [track, setTrack] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(37)
  const [video, setVideo] = useState<number | null>(null)
  const [temp, setTemp] = useState(22)
  const [fan, setFan] = useState(2)
  const [acOn, setAcOn] = useState(true)
  const [auto, setAuto] = useState(true)
  const [recirc, setRecirc] = useState(false)
  const [defrost, setDefrost] = useState(false)
  const [volume, setVolume] = useState(55)
  const [brightness, setBrightness] = useState(80)

  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const setAmbientLightColor = useSimulationStore((s) => s.setAmbientLightColor)

  const brand = vehicle.info.brand.toLowerCase()
  const accent = ACCENT_BY_BRAND[brand] ?? '#f59e0b'
  const shortName = getShortVehicleName(vehicle)
  const current = TRACKS[track]

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 15000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= TRACKS[track].dur) {
          setTrack((t) => (t + 1) % TRACKS.length)
          return 0
        }
        return e + 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [playing, track])

  const selectTrack = (i: number) => {
    setTrack(i)
    setElapsed(0)
    setPlaying(true)
  }
  const step = (d: number) => selectTrack((track + d + TRACKS.length) % TRACKS.length)

  const time = clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const date = clock.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
  const speed = Math.round(telemetry.speedometer.speed)

  const Btn = ({ on, onClick, children, label }: { on?: boolean; onClick: () => void; children: React.ReactNode; label: string }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className="rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-wide active:scale-95 cursor-pointer"
      style={on ? { background: accent, color: '#000', borderColor: accent } : { background: 'rgba(24,24,27,0.9)', color: '#d4d4d8', borderColor: 'rgba(255,255,255,0.12)' }}
    >
      {children}
    </button>
  )

  const Player = ({ compact }: { compact?: boolean }) => (
    <div className="flex h-full min-h-0 flex-col justify-between rounded-xl border border-white/10 bg-zinc-900/80 p-2">
      <div className="flex min-h-0 items-center gap-2">
        <div
          className="flex aspect-square h-full max-h-14 shrink-0 items-center justify-center rounded-lg text-xl"
          style={{ background: `linear-gradient(135deg, ${accent}, #18181b)` }}
        >
          🎵
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[11px] font-black text-white">{current.title}</div>
          <div className="truncate text-[9px] text-zinc-400">{current.artist}</div>
          {!compact && <div className="text-[8px] text-zinc-500">Bluetooth · Smartphone</div>}
        </div>
      </div>
      <div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-700">
          <div className="h-full rounded-full" style={{ width: `${(elapsed / current.dur) * 100}%`, background: accent }} />
        </div>
        <div className="mt-0.5 flex justify-between text-[8px] font-mono text-zinc-500">
          <span>{fmt(elapsed)}</span>
          <span>{fmt(current.dur)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-center gap-3 text-base text-white">
          <button type="button" aria-label="Faixa anterior" onClick={() => step(-1)} className="cursor-pointer active:scale-90">⏮</button>
          <button
            type="button"
            aria-label={playing ? 'Pausar' : 'Reproduzir'}
            onClick={() => setPlaying((p) => !p)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-black cursor-pointer active:scale-90"
            style={{ background: accent }}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button type="button" aria-label="Próxima faixa" onClick={() => step(1)} className="cursor-pointer active:scale-90">⏭</button>
        </div>
      </div>
    </div>
  )

  return (
    <div
      className={`${fill ? 'absolute inset-0 w-full h-full' : 'relative h-60 w-[30rem] max-w-full'} flex flex-col min-h-0 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white select-none ${className}`}
      style={{ filter: `brightness(${0.55 + brightness / 220})` }}
      data-multimedia-root
    >
      {/* Barra de status (reserva espaço à direita para o botão de alternância painel/mídia) */}
      <div className="flex h-5 shrink-0 items-center gap-2 border-b border-white/5 bg-black/40 pl-2 pr-28 text-[9px] font-mono">
        <b style={{ color: accent }}>{time}</b>
        <span className="truncate font-black tracking-wider text-zinc-300">{shortName}</span>
        <span className="ml-auto flex shrink-0 gap-1.5 text-zinc-400">
          <span>🔵 BT</span>
          <span>📶 5G</span>
        </span>
      </div>

      {/* Conteúdo principal — mesmo espaço para todas as funções */}
      <div className="min-h-0 flex-1 overflow-hidden p-1.5" data-multimedia-main>
        {tab === 'home' && (
          <div className="grid h-full grid-cols-2 gap-1.5">
            <div className="flex min-h-0 flex-col justify-between rounded-xl border border-white/10 bg-zinc-900/60 p-2">
              <div>
                <div className="text-3xl font-black leading-none tracking-tight" style={{ color: accent }}>{time}</div>
                <div className="mt-0.5 text-[10px] capitalize text-zinc-400">{date}</div>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center font-mono">
                <div className="rounded-md bg-black/40 py-0.5"><div className="text-xs font-black">{speed}</div><div className="text-[7px] text-zinc-500">KM/H</div></div>
                <div className="rounded-md bg-black/40 py-0.5"><div className="text-xs font-black">{telemetry.gear.label}</div><div className="text-[7px] text-zinc-500">MARCHA</div></div>
                <div className="rounded-md bg-black/40 py-0.5"><div className="text-xs font-black">{Math.round(telemetry.tachometer.rpm)}</div><div className="text-[7px] text-zinc-500">RPM</div></div>
              </div>
              <div className="flex flex-wrap gap-1 text-[8px] font-bold text-zinc-300">
                <span className="rounded-full bg-black/40 px-1.5 py-0.5">🔵 Smartphone</span>
                <span className="rounded-full bg-black/40 px-1.5 py-0.5">📶 5G · Hotspot</span>
              </div>
            </div>
            <Player compact />
          </div>
        )}

        {tab === 'music' && (
          <div className="grid h-full grid-cols-[1.1fr_1fr] gap-1.5">
            <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
              {TRACKS.map((t, i) => (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => selectTrack(i)}
                  className="flex min-h-0 flex-1 items-center justify-between rounded-lg border px-2 text-left cursor-pointer active:scale-[0.98]"
                  style={i === track ? { borderColor: accent, background: 'rgba(255,255,255,0.07)' } : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(24,24,27,0.6)' }}
                >
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[10px] font-bold">{t.title}</span>
                    <span className="block truncate text-[8px] text-zinc-400">{t.artist}</span>
                  </span>
                  <span className="shrink-0 text-[9px] font-mono text-zinc-500">{fmt(t.dur)}</span>
                </button>
              ))}
            </div>
            <Player />
          </div>
        )}

        {tab === 'youtube' && (
          <div className="flex h-full min-h-0 flex-col gap-1">
            <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-800/80 px-2 py-0.5 text-[9px] text-zinc-400">
              <span className="font-black text-red-500">▶ YouTube</span>
              <span className="truncate">Buscar… (demonstração, sem conexão real)</span>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5">
              {VIDEOS.map((v, i) => (
                <button
                  key={v.title}
                  type="button"
                  onClick={() => setVideo(video === i ? null : i)}
                  className="flex min-h-0 flex-col overflow-hidden rounded-lg border text-left cursor-pointer active:scale-[0.98]"
                  style={video === i ? { borderColor: '#ef4444' } : { borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  <div className={`relative flex min-h-0 flex-1 items-center justify-center bg-gradient-to-br ${v.hue}`}>
                    <span className="text-lg">{video === i ? '⏸' : '▶'}</span>
                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[7px] font-mono">{v.len}</span>
                  </div>
                  <div className="shrink-0 bg-zinc-900/90 px-1 py-0.5 leading-tight">
                    <div className="truncate text-[8px] font-bold">{v.title}</div>
                    <div className="truncate text-[7px] text-zinc-500">{video === i ? 'Reproduzindo (demo)' : v.ch}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'climate' && (
          <div className="grid h-full grid-cols-[1fr_1.2fr_1fr] items-center gap-1.5">
            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/10 bg-zinc-900/60 py-1">
              <span className="text-[8px] text-zinc-500">TEMPERATURA</span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Diminuir temperatura" onClick={() => setTemp((t) => Math.max(16, t - 1))} className="h-6 w-6 rounded-full bg-zinc-800 text-sm font-black cursor-pointer active:scale-90">−</button>
                <span className="text-xl font-black" style={{ color: accent }}>{temp}°</span>
                <button type="button" aria-label="Aumentar temperatura" onClick={() => setTemp((t) => Math.min(30, t + 1))} className="h-6 w-6 rounded-full bg-zinc-800 text-sm font-black cursor-pointer active:scale-90">+</button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-zinc-900/60 py-1">
              <span className="text-[8px] text-zinc-500">VENTILAÇÃO</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={`Ventilação ${n}`} onClick={() => setFan(n)} className="w-4 cursor-pointer rounded-sm" style={{ height: 6 + n * 4, background: n <= fan ? accent : '#3f3f46' }} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <Btn on={acOn} onClick={() => setAcOn((v) => !v)} label="Ar-condicionado">A/C</Btn>
              <Btn on={auto} onClick={() => setAuto((v) => !v)} label="Automático">AUTO</Btn>
              <Btn on={recirc} onClick={() => setRecirc((v) => !v)} label="Recirculação">Recirc.</Btn>
              <Btn on={defrost} onClick={() => setDefrost((v) => !v)} label="Desembaçar">Desemb.</Btn>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="grid h-full grid-cols-2 gap-1.5">
            <div className="flex min-h-0 flex-col justify-around rounded-xl border border-white/10 bg-zinc-900/60 px-2 py-1 text-[9px]">
              <label className="flex items-center gap-2">
                <span className="w-14 text-zinc-400">Volume</span>
                <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(+e.target.value)} className="h-1 flex-1" style={{ accentColor: accent }} />
                <span className="w-5 text-right font-mono">{volume}</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-14 text-zinc-400">Brilho</span>
                <input type="range" min={20} max={100} value={brightness} onChange={(e) => setBrightness(+e.target.value)} className="h-1 flex-1" style={{ accentColor: accent }} />
                <span className="w-5 text-right font-mono">{brightness}</span>
              </label>
              <div className="text-[8px] text-zinc-500">{vehicle.info.brand} · {shortName} · v1.5.1</div>
            </div>
            <div className="flex min-h-0 flex-col justify-center gap-1 rounded-xl border border-white/10 bg-zinc-900/60 px-2 py-1">
              <span className="text-[8px] text-zinc-500">LUZ AMBIENTE</span>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(AMBIENT_COLOR_MAP) as AmbientLightColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Luz ambiente ${AMBIENT_COLOR_MAP[c].name}`}
                    onClick={() => setAmbientLightColor(c)}
                    className="h-5 w-5 cursor-pointer rounded-full border-2 active:scale-90"
                    style={{ background: AMBIENT_COLOR_MAP[c].hex, borderColor: ambientLightColor === c ? '#fff' : 'transparent' }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barra de navegação inferior — sempre visível */}
      <nav className="grid h-9 shrink-0 grid-cols-5 border-t border-white/10 bg-black/70" aria-label="Navegação da multimídia">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id}
            className="flex flex-col items-center justify-center gap-px text-[8px] font-bold uppercase tracking-wide cursor-pointer active:bg-white/10"
            style={{ color: tab === t.id ? accent : '#a1a1aa', borderTop: `2px solid ${tab === t.id ? accent : 'transparent'}` }}
          >
            <span className="text-[12px] leading-none">{t.icon}</span>
            <span className="leading-none">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
})
