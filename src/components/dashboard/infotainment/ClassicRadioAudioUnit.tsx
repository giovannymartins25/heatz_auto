import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { TRACKS } from './VehicleMultimedia'

export interface ClassicRadioAudioUnitProps {
  vehicle: VehicleConfig
  telemetry?: DashboardTelemetry
  className?: string
  fill?: boolean
}

type RadioBand = 'FM1' | 'FM2' | 'AM' | 'BT'

/**
 * ClassicRadioAudioUnit — Unidade de áudio e rádio automotivo convencional 1-DIN.
 * 
 * Fiel aos veículos que não possuíam central multimídia moderna de fábrica (ex.: Opala Diplomata e Gol G6):
 * - Visor LCD/VFD retroiluminado com sintonia FM e identificação de faixa
 * - Botões físicos frontais: TUNE/SEEK, MEMÓRIAS 1-6, BAND e VOLUME
 * - Tema visual adaptativo:
 *   * Opala 1992: estilo vintage clássico com iluminação âmbar/verde fluorescente
 *   * Gol G6 2016: estilo moderno 1-DIN com iluminação azul/vermelha VW
 */
export const ClassicRadioAudioUnit = memo(function ClassicRadioAudioUnit({
  vehicle,
  className = '',
  fill = false,
}: ClassicRadioAudioUnitProps) {
  const [band, setBand] = useState<RadioBand>('FM1')
  const [trackIndex, setTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(14)
  const [volume, setVolume] = useState(60)
  const [loudness, setLoudness] = useState(true)
  const [preset, setPreset] = useState(1)

  const isOpala = vehicle.id.includes('opala')
  const isGol = vehicle.id.includes('gol')

  // Cores de display conforme época do veículo
  const displayTheme = isOpala
    ? {
        bg: 'bg-[#0f140e]',
        text: 'text-[#58d68d]',
        border: 'border-[#2d4a34]',
        glow: 'shadow-[0_0_12px_rgba(88,214,141,0.25)]',
        accentText: 'text-[#82e0aa]',
      }
    : isGol
    ? {
        bg: 'bg-[#080d18]',
        text: 'text-[#38bdf8]',
        border: 'border-[#1e3a5f]',
        glow: 'shadow-[0_0_12px_rgba(56,189,248,0.25)]',
        accentText: 'text-[#ef4444]',
      }
    : {
        bg: 'bg-[#181108]',
        text: 'text-[#fbbf24]',
        border: 'border-[#5f421e]',
        glow: 'shadow-[0_0_12px_rgba(251,191,36,0.25)]',
        accentText: 'text-[#f59e0b]',
      }

  const currentTrack = TRACKS[trackIndex] || TRACKS[0]
  const currentFreq = 88.1 + preset * 2.4

  useEffect(() => {
    if (!isPlaying) return
    const timer = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= currentTrack.dur) {
          setTrackIndex((t) => (t + 1) % TRACKS.length)
          return 0
        }
        return prev + 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isPlaying, currentTrack.dur])

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  return (
    <div
      className={`relative rounded-xl border-2 border-zinc-700 bg-gradient-to-b from-zinc-800 via-zinc-900 to-black p-1.5 sm:p-2.5 select-none font-mono flex flex-col justify-between shadow-2xl overflow-hidden ${
        fill ? 'w-full h-full' : 'w-[320px] h-[190px]'
      } ${className}`}
    >
      {/* ─── Moldura Superior com Marca do Rádio ─── */}
      <div className="flex items-center justify-between px-1 pr-28 pb-1 border-b border-white/10 text-[8px] sm:text-[9px] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold tracking-wider text-zinc-300 uppercase truncate">
            {isOpala ? 'ALFACELL SIRIUS' : 'VOLKSWAGEN SOUND'}
          </span>
        </div>
        <span className="text-zinc-500 font-bold uppercase shrink-0">{vehicle.info.brand} AUDIO</span>
      </div>

      <div className="flex-1 min-h-0 w-full flex flex-col justify-between overflow-y-auto py-0.5" style={{ touchAction: 'pan-y' }}>
        {/* ─── Visor LCD / VFD Retrô ─── */}
        <div
          className={`my-0.5 p-1 sm:p-1.5 rounded-lg border ${displayTheme.border} ${displayTheme.bg} ${displayTheme.glow} flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-black">
            <div className="flex items-center gap-1.5">
              <span className={`px-1 py-0.2 rounded bg-black/60 ${displayTheme.accentText}`}>{band}</span>
              <span className={displayTheme.text}>{band === 'BT' ? 'BLUETOOTH' : `${currentFreq.toFixed(1)} MHz`}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {loudness && <span className="text-[7px] px-1 rounded bg-black/60 text-amber-400">LOUD</span>}
              <span className={displayTheme.text}>VOL {volume}%</span>
            </div>
          </div>

          <div className="my-0.5 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className={`text-[10px] sm:text-xs font-black truncate tracking-wider ${displayTheme.text}`}>
                {currentTrack.title.toUpperCase()}
              </div>
              <div className="text-[7.5px] sm:text-[8px] text-zinc-400 truncate uppercase">
                {currentTrack.artist}
              </div>
            </div>
            <div className={`text-[9px] font-bold shrink-0 ${displayTheme.text}`}>
              {formatSec(elapsed)} / {formatSec(currentTrack.dur)}
            </div>
          </div>

          {/* Barra de Progresso Retrô (Segmentada) */}
          <div className="w-full h-1 rounded bg-black/80 p-0.5 flex gap-0.5 overflow-hidden border border-white/5">
            {Array.from({ length: 24 }).map((_, i) => {
              const active = i / 24 <= elapsed / currentTrack.dur
              return (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-xs transition-colors ${
                    active ? (isGol ? 'bg-sky-400' : 'bg-emerald-400') : 'bg-zinc-800'
                  }`}
                />
              )
            })}
          </div>
        </div>

        {/* ─── Painel de Controle e Teclas Físicas ─── */}
        <div className="flex flex-col gap-1 pt-0.5">
          {/* Presets Numéricos 1 a 6 */}
          <div className="grid grid-cols-6 gap-1 font-mono text-[7.5px] sm:text-[8.5px]">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  setPreset(num)
                  setTrackIndex((num - 1) % TRACKS.length)
                  setElapsed(0)
                }}
                className={`py-0.5 sm:py-1 rounded border font-bold transition-all active:scale-95 cursor-pointer ${
                  preset === num
                    ? 'bg-zinc-700 text-white border-white/40 shadow-inner'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-white/10'
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          {/* Botões Operacionais: SEEK, PLAY, BAND, LOUD, VOLUME */}
          <div className="flex items-center justify-between gap-1 text-[7.5px] sm:text-[8px] font-bold">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setTrackIndex((t) => (t - 1 + TRACKS.length) % TRACKS.length)
                  setElapsed(0)
                }}
                className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 active:scale-95 cursor-pointer"
                title="Faixa Anterior / Sintonia para baixo"
              >
                ◀◀
              </button>
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-white/10 active:scale-95 cursor-pointer"
                title={isPlaying ? 'Pausar' : 'Reproduzir'}
              >
                {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrackIndex((t) => (t + 1) % TRACKS.length)
                  setElapsed(0)
                }}
                className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 active:scale-95 cursor-pointer"
                title="Próxima Faixa / Sintonia para cima"
              >
                ▶▶
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const bands: RadioBand[] = ['FM1', 'FM2', 'AM', 'BT']
                  const next = bands[(bands.indexOf(band) + 1) % bands.length]
                  setBand(next)
                }}
                className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 active:scale-95 cursor-pointer"
              >
                BAND
              </button>
              <button
                type="button"
                onClick={() => setLoudness(!loudness)}
                className={`px-1.5 py-0.5 rounded border active:scale-95 cursor-pointer ${
                  loudness ? 'bg-amber-600/30 text-amber-300 border-amber-500/40' : 'bg-zinc-900 text-zinc-500 border-white/10'
                }`}
              >
                LOUD
              </button>
              <div className="flex items-center gap-0.5 bg-black/60 px-1 py-0.5 rounded border border-white/10">
                <button
                  type="button"
                  onClick={() => setVolume((v) => Math.max(0, v - 10))}
                  className="px-1 text-zinc-400 hover:text-white"
                >
                  -
                </button>
                <span className="text-[7.5px] text-zinc-300">VOL</span>
                <button
                  type="button"
                  onClick={() => setVolume((v) => Math.min(100, v + 10))}
                  className="px-1 text-zinc-400 hover:text-white"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
