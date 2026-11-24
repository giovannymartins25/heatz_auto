import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { TRACKS } from './VehicleMultimedia'
import { useSimulationStore } from '@/stores/useSimulationStore'
import type { FanLevel } from '@/systems/cabin'

export interface FordPampa1997RadioUnitProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  className?: string
  fill?: boolean
}

type PampaAudioMode = 'FM' | 'AM' | 'TAPE'

/**
 * FordPampa1997RadioUnit — Console Utilitário 1997 com Rádio Toca-Fitas Ford FIC Sound 1-DIN
 * e Comandos Deslizantes de Ventilação Mecânica (sem A/C e sem telas modernas).
 *
 * Respeita estritamente a época (1997) e o contrato declarativo da Ford Pampa L 1.8i:
 * - Rádio AM/FM/Cassete FIC Sound 1-DIN com visor LCD verde de 7 segmentos e memórias físicas 1–6
 * - Painel mecânico inferior de ventilação forçada (0–4/5), ar quente pelo arrefecimento do AP-1800
 *   e desembaçador do para-brisa sincronizados com o `ClimateSystem` (sem botão de A/C!)
 */
export const FordPampa1997RadioUnit = memo(function FordPampa1997RadioUnit({
  className = '',
  fill = false,
}: FordPampa1997RadioUnitProps) {
  const [mode, setMode] = useState<PampaAudioMode>('FM')
  const [preset, setPreset] = useState(2)
  const [trackIndex, setTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [volume, setVolume] = useState(55)
  const [elapsed, setElapsed] = useState(8)

  const ignitionPosition = useSimulationStore((s) => s.ignitionPosition)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const climateFanLevel = useSimulationStore((s) => s.climateFanLevel)
  const climateHeaterEnabled = useSimulationStore((s) => s.climateHeaterEnabled)
  const climateDefrosterEnabled = useSimulationStore((s) => s.climateDefrosterEnabled)
  const cabinTempC = useSimulationStore((s) => s.cabinTempC)
  const setClimateFanLevel = useSimulationStore((s) => s.setClimateFanLevel)
  const toggleClimateHeater = useSimulationStore((s) => s.toggleClimateHeater)
  const toggleClimateDefroster = useSimulationStore((s) => s.toggleClimateDefroster)

  const hasRadioPower = isRunning || ignitionPosition === 'ACC' || ignitionPosition === 'ON'
  const currentTrack = TRACKS[trackIndex] || TRACKS[0]
  const fmFreq = (88.7 + preset * 2.6).toFixed(1)
  const amFreq = 580 + preset * 140

  useEffect(() => {
    if (!isPlaying || !hasRadioPower) return
    const id = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= currentTrack.dur) {
          setTrackIndex((i) => (i + 1) % TRACKS.length)
          return 0
        }
        return prev + 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isPlaying, hasRadioPower, currentTrack.dur])

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-xl border-2 border-zinc-700 bg-gradient-to-b from-[#26292d] via-[#1a1c1f] to-[#101214] p-2 font-mono text-zinc-200 shadow-2xl select-none ${
        fill ? 'h-full w-full' : 'w-[335px]'
      } ${className}`}
      data-testid="multimedia-ford-pampa-radio-1din"
    >
      {/* 1. UNIDADE 1-DIN FORD FIC SOUND (TOCA-FITAS + AM/FM) */}
      <div className="rounded-lg border-2 border-zinc-800 bg-[#0d0e10] p-1.5 shadow-inner">
        <div className="mb-1 flex items-center justify-between text-[7.5px] font-black tracking-wider text-zinc-400">
          <span>FORD FIC SOUND · AUTO-REVERSE</span>
          <span>1997 1-DIN</span>
        </div>

        {/* Visor LCD Verde 7-Segmentos + Porta-Fita K7 */}
        <div className="grid grid-cols-[1.2fr_0.8fr] gap-1.5">
          <div
            className={`rounded border px-2 py-1 ${
              hasRadioPower
                ? 'border-[#2f5d3a] bg-[#0e1b11] text-[#6ee7b7] shadow-[inset_0_0_8px_rgba(52,211,153,0.2)]'
                : 'border-zinc-800 bg-[#090b09] text-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between text-[8px] font-black">
              <span>{hasRadioPower ? mode : 'OFF'}</span>
              <span>
                {hasRadioPower
                  ? mode === 'FM'
                    ? `${fmFreq} MHz`
                    : mode === 'AM'
                      ? `${amFreq} kHz`
                      : 'TAPE K7 ◄►'
                  : '---.-'}
              </span>
              <span>VOL {hasRadioPower ? volume : 0}</span>
            </div>
            <div className="mt-0.5 truncate text-[9px] font-bold">
              {hasRadioPower
                ? mode === 'TAPE'
                  ? `K7 ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')} · ${currentTrack.title.toUpperCase()}`
                  : `CH${preset} · ${currentTrack.artist.toUpperCase()}`
                : 'CHAVE DESLIGADA'}
            </div>
          </div>

          {/* Escotilha mecânica de fita cassete */}
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'TAPE' ? 'FM' : 'TAPE'))}
            className="flex flex-col items-center justify-center rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[7px] font-bold text-zinc-400 hover:border-zinc-500 cursor-pointer"
            title="Alternar Fita K7 / Rádio"
          >
            <span className="w-full rounded-xs border border-zinc-700 bg-black py-0.5 text-center text-[6.5px] tracking-widest text-amber-400">
              CASSETTE DECK
            </span>
            <span className="mt-0.5 text-[6.5px]">
              {mode === 'TAPE' ? '⏏ EJETAR K7' : '▶ INSERIR K7'}
            </span>
          </button>
        </div>

        {/* Botões físicos plásticos 1–6, Band e Volume */}
        <div className="mt-1.5 flex items-center justify-between gap-1 text-[7.5px] font-black">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setVolume((v) => Math.max(0, v - 10))}
              className="h-5 w-5 rounded bg-zinc-800 text-zinc-200 active:scale-95 cursor-pointer"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="h-5 rounded bg-zinc-800 px-1.5 text-emerald-300 active:scale-95 cursor-pointer"
            >
              {isPlaying ? '❚❚' : '▶'}
            </button>
            <button
              type="button"
              onClick={() => setVolume((v) => Math.min(100, v + 10))}
              className="h-5 w-5 rounded bg-zinc-800 text-zinc-200 active:scale-95 cursor-pointer"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setPreset(n)
                  setTrackIndex((n - 1) % TRACKS.length)
                }}
                className={`h-5 w-4 rounded border text-[7.5px] cursor-pointer ${
                  preset === n && mode !== 'TAPE'
                    ? 'border-emerald-500 bg-emerald-900/50 text-emerald-200'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setMode((m) => (m === 'FM' ? 'AM' : 'FM'))}
            className="h-5 rounded border border-zinc-600 bg-zinc-800 px-1.5 text-zinc-200 active:scale-95 cursor-pointer"
          >
            AM/FM
          </button>
        </div>
      </div>

      {/* 2. RÉGUA MECÂNICA DE VENTILAÇÃO FORÇADA DA PAMPA L (SEM A/C DE FÁBRICA) */}
      <div className="mt-1.5 rounded-lg border border-zinc-700 bg-[#15181b] px-2 py-1.5">
        <div className="mb-1 flex items-center justify-between text-[7.5px] font-bold text-zinc-400">
          <span>VENTILAÇÃO MECÂNICA (SEM A/C)</span>
          <span className="text-zinc-300">CABINE {cabinTempC.toFixed(1)}°C</span>
        </div>

        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-0.5">
            {([0, 1, 2, 3, 4] as FanLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setClimateFanLevel(lvl)}
                className={`h-5 w-5 rounded border text-[7.5px] font-black cursor-pointer ${
                  climateFanLevel === lvl
                    ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400'
                }`}
              >
                {lvl === 0 ? '0' : lvl}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-[7.5px] font-black">
            <button
              type="button"
              onClick={toggleClimateHeater}
              className={`h-5 rounded border px-2 cursor-pointer ${
                climateHeaterEnabled
                  ? 'border-red-400 bg-red-600/30 text-red-200'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400'
              }`}
            >
              AR QUENTE
            </button>
            <button
              type="button"
              onClick={toggleClimateDefroster}
              className={`h-5 rounded border px-2 cursor-pointer ${
                climateDefrosterEnabled
                  ? 'border-amber-400 bg-amber-600/25 text-amber-200'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400'
              }`}
            >
              DESEMB.
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
