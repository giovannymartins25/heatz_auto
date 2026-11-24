import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { TRACKS } from './VehicleMultimedia'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { AMBIENT_COLOR_MAP, type AmbientLightColor } from '@/utils/ambientLighting'

export interface FordSync1Console2012Props {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  className?: string
  fill?: boolean
}

type Sync1Source = 'FM1' | 'SYNC BT' | 'CD/MP3' | 'INFO'

/**
 * FordSync1Console2012 — Console de Áudio 2-DIN Ford SYNC de 1ª Geração ("Powered by Microsoft")
 * exclusivo do Ford Fusion SEL 2.5 16V 2012 (CD338).
 *
 * Fidelidade histórica à geração 2012 (unidade de rádio/CD 2-DIN com visor VFD de 2 linhas,
 * NÃO é central multimídia touchscreen SYNC 3):
 * - Os comandos físicos de climatização da cabine permanecem exclusivamente no Painel 3
 *   (`climateControlsLocation: 'panel'`), evitando qualquer duplicação entre painéis.
 */
export const FordSync1Console2012 = memo(function FordSync1Console2012({
  telemetry,
  className = '',
  fill = false,
}: FordSync1Console2012Props) {
  const [source, setSource] = useState<Sync1Source>('SYNC BT')
  const [preset, setPreset] = useState(1)
  const [trackIdx, setTrackIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [volume, setVolume] = useState(50)
  const [clockTime, setClockTime] = useState('16:05')

  const isRunning = useSimulationStore((s) => s.isRunning)
  const ignitionPosition = useSimulationStore((s) => s.ignitionPosition)
  const ambientTempC = useSimulationStore((s) => s.ambientTempC)
  const cabinTempC = useSimulationStore((s) => s.cabinTempC)
  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const setAmbientLightColor = useSimulationStore((s) => s.setAmbientLightColor)

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setClockTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      )
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [])

  const powered = isRunning || ignitionPosition === 'ACC' || ignitionPosition === 'ON'
  const track = TRACKS[trackIdx] || TRACKS[0]
  const fmFreq = (89.3 + preset * 2.2).toFixed(1)

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-slate-500/40 bg-gradient-to-b from-[#2b313a] via-[#1b2027] to-[#101318] p-2 font-mono text-white shadow-2xl select-none ${
        fill ? 'h-full w-full' : 'w-[345px]'
      } ${className}`}
      data-testid="multimedia-ford-sync1-2012"
    >
      {/* 1. VISOR VFD DOT-MATRIX SUPERIOR ICE BLUE (2 LINHAS) */}
      <div className="rounded-lg border-2 border-slate-700 bg-[#041419] px-2.5 py-1.5 shadow-[inset_0_0_12px_rgba(34,211,238,0.18)]">
        <div className="flex items-center justify-between text-[8px] font-black text-cyan-300">
          <span>{powered ? source : 'SYNC OFF'}</span>
          <span>{clockTime} · EXT {Math.round(ambientTempC)}°C</span>
          <span>VOL {powered ? volume : 0}</span>
        </div>
        <div className="mt-0.5 truncate text-[10px] font-black tracking-wider text-cyan-200">
          {!powered
            ? 'FORD FUSION · INSIRA A CHAVE'
            : source === 'FM1'
              ? `FM1 ${fmFreq} MHz · MEM ${preset}`
              : source === 'INFO'
                ? `DURATEC 2.5 · ${Math.round(telemetry.tachometer.rpm)} RPM · CAB ${cabinTempC.toFixed(1)}°C`
                : `${isPlaying ? '▶' : '❚❚'} ${track.title.toUpperCase()} - ${track.artist.toUpperCase()}`}
        </div>
        <div className="mt-0.5 flex items-center justify-between border-t border-cyan-500/20 pt-0.5 text-[7.5px] font-bold text-cyan-400">
          <span>2-DIN OEM AUDIO</span>
          <span>SYNC · MICROSOFT</span>
          <span>SONY SOUND</span>
        </div>
      </div>

      {/* 2. CONSOLE FÍSICO METÁLICO ESCOVADO COM TECLADO E BOTÃO ROTATIVO CENTRAL */}
      <div className="my-1 rounded-xl border border-slate-600/50 bg-gradient-to-b from-[#353c47] to-[#20252d] p-1.5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
          {/* Teclas de Fonte à Esquerda */}
          <div className="grid grid-cols-2 gap-1 text-[7px] font-black">
            {(
              [
                { id: 'FM1', label: 'RADIO' },
                { id: 'CD/MP3', label: 'CD/AUX' },
                { id: 'SYNC BT', label: 'SYNC 🎤' },
                { id: 'INFO', label: 'INFO' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setSource(btn.id)}
                className={`h-5 rounded border transition-all cursor-pointer ${
                  source === btn.id
                    ? 'border-sky-300 bg-sky-500/30 text-sky-100'
                    : 'border-slate-600 bg-slate-900/80 text-slate-300'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Botão Rotativo Central Metálico VOL / PLAY */}
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="flex h-11 w-11 flex-col items-center justify-center rounded-full border-2 border-slate-300 bg-gradient-to-b from-slate-600 to-slate-900 text-[7px] font-black text-cyan-200 shadow-lg active:scale-95 cursor-pointer"
            title="Power / Play-Pause"
          >
            <span>VOL</span>
            <span className="text-[8px] text-white">{isPlaying ? '❚❚' : '▶'}</span>
          </button>

          {/* Memórias Físicas 1–6 + Faixa à Direita */}
          <div className="grid grid-cols-3 gap-0.5 text-[7px] font-black">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setPreset(n)
                  setTrackIdx((n - 1) % TRACKS.length)
                }}
                className={`h-5 rounded border cursor-pointer ${
                  preset === n
                    ? 'border-sky-300 bg-sky-500/25 text-sky-100'
                    : 'border-slate-600 bg-slate-900/80 text-slate-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[7px] font-black">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setVolume((v) => Math.max(0, v - 10))}
              className="rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-sky-300 cursor-pointer"
            >
              VOL -
            </button>
            <button
              type="button"
              onClick={() => setVolume((v) => Math.min(100, v + 10))}
              className="rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-sky-300 cursor-pointer"
            >
              VOL +
            </button>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setTrackIdx((i) => (i - 1 + TRACKS.length) % TRACKS.length)}
              className="rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-slate-200 cursor-pointer"
            >
              |◀ SEEK
            </button>
            <button
              type="button"
              onClick={() => setTrackIdx((i) => (i + 1) % TRACKS.length)}
              className="rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-slate-200 cursor-pointer"
            >
              SEEK ▶|
            </button>
          </div>
        </div>
      </div>

      {/* 3. ILUMINAÇÃO AMBIENTE FORD ICE BLUE (7 CORES OEM DO CONSOLE 2012) */}
      <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-[#14181f] px-2.5 py-1.5 text-[7px] font-black">
        <span className="text-slate-300">AMBIENT LIGHTING OEM</span>
        <div className="flex items-center gap-1">
          {(['cyan', 'blue', 'purple', 'red', 'amber', 'green', 'white'] as AmbientLightColor[]).map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => setAmbientLightColor(col)}
              className={`h-3.5 w-3.5 rounded-full border cursor-pointer ${
                ambientLightColor === col ? 'scale-110 border-white' : 'border-white/20 opacity-75'
              }`}
              style={{ backgroundColor: AMBIENT_COLOR_MAP[col].hex }}
              title={`Luz ambiente ${col}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
})
