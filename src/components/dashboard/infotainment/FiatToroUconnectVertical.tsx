import { memo, useEffect, useState } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { useSimulationStore } from '@/stores/useSimulationStore'
import type { FourWheelDriveMode } from '@/systems/physics'
import { TRACKS } from './VehicleMultimedia'

export interface FiatToroUconnectVerticalProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  className?: string
  fill?: boolean
}

type RanchTab = 'media' | 'climate' | 'drive4x4' | 'settings'

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * FiatToroUconnectVertical — Central Multimídia oficial Fiat Uconnect 10,1" Vertical (Toro Ranch 2025).
 * 
 * Recursos da versão Ranch:
 * - Tela vertical de 10,1 polegadas com proporção nobre e acabamento premium (tons amadeirados e couro marrom)
 * - Painel de Controle TRAÇÃO 4X4 interativo e dedicado:
 *   · Modos: AUTO (sob demanda), 4WD LOCK (bloqueio 50/50) e 4WD LOW (reduzida / crawl ratio)
 *   · Trava de segurança ativa: impede engate de 4WD LOW com velocidade > 3 km/h
 *   · Banner de alerta sonoro/visual: "4WD LOW: Pare o veículo para engatar!"
 *   · Esquema gráfico dos eixos dianteiro e traseiro com indicação luminosa de torque
 * - Abas completas de Mídia, Climatização Dual-Zone e Ajustes
 * - Design responsivo fluido e anti-estouro (zero overflow no slot mobile).
 */
export const FiatToroUconnectVertical = memo(function FiatToroUconnectVertical({
  vehicle,
  telemetry,
  className = '',
  fill = false,
}: FiatToroUconnectVerticalProps) {
  const [activeTab, setActiveTab] = useState<RanchTab>('drive4x4')
  const [clock, setClock] = useState(() => new Date())
  const [trackIndex, setTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(38)

  // Climatização Dual-Zone Ranch
  const [driverTemp, setDriverTemp] = useState(21.0)
  const [passengerTemp, setPassengerTemp] = useState(22.0)
  const [isAcOn, setIsAcOn] = useState(true)
  const [isAuto, setIsAuto] = useState(true)
  const [isDual, setIsDual] = useState(true)

  // Tração 4x4 da Store
  const fourWheelDriveMode = useSimulationStore((s) => s.fourWheelDriveMode)
  const fourWheelDriveWarning = useSimulationStore((s) => s.fourWheelDriveWarning)
  const setFourWheelDriveMode = useSimulationStore((s) => s.setFourWheelDriveMode)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)

  // Ajustes de volume e brilho
  const [volume, setVolume] = useState(70)
  const [brightness, setBrightness] = useState(90)

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
  const currentSpeedPrecise = telemetry.speedometer.speed
  const timeStr = clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const changeTrack = (delta: number) => {
    setTrackIndex((prev) => (prev + delta + TRACKS.length) % TRACKS.length)
    setElapsed(0)
    setIsPlaying(true)
  }

  const handleSelect4x4Mode = (mode: FourWheelDriveMode) => {
    setFourWheelDriveMode(mode)
  }

  const isLowEngageable = currentSpeedPrecise <= 3.0

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl bg-zinc-950 border-2 border-amber-900/60 text-zinc-100 select-none shadow-[0_0_30px_rgba(180,83,9,0.25)] ${
        fill ? 'w-full h-full' : 'w-full max-w-[560px] aspect-[9/13]'
      } ${className}`}
      data-prevent-swipe
    >
      {/* Moldura Premium Ranch com textura marrom/bronze */}
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-amber-800/40 bg-gradient-to-r from-amber-950/80 via-zinc-900 to-amber-950/80 px-2.5 text-[9px] font-mono">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-900/50 border border-amber-600/40 text-amber-300 font-sans font-black text-[8px] uppercase tracking-wider">
            <span>🐂</span>
            <span>RANCH</span>
          </div>
          <span className="text-amber-500 font-sans font-bold text-[9px] tracking-tight">
            Uconnect™ 10.1"
          </span>
        </div>

        <div className="flex items-center gap-2 text-zinc-300 text-[8.5px]">
          <span className="text-amber-400 font-bold hidden sm:inline">2.2 TURBODIESEL</span>
          <span>📶 4G</span>
          <span className="font-bold text-white px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono">
            {timeStr}
          </span>
        </div>
      </header>

      {/* Alerta de Bloqueio de 4WD LOW caso o usuário tente acionar em movimento */}
      {fourWheelDriveWarning && (
        <div className="mx-2 mt-1 px-2.5 py-1 rounded-xl bg-red-950/90 border border-red-500 text-red-200 text-[10px] font-mono font-bold flex items-center justify-between shadow-[0_0_15px_rgba(239,68,68,0.7)] animate-bounce z-30">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-sm">⚠️</span>
            <span className="truncate">{fourWheelDriveWarning}</span>
          </div>
          <span className="text-[8px] uppercase px-1 py-0.5 rounded bg-red-900/80 text-white font-mono shrink-0 ml-1">
            {speedKmh} km/h
          </span>
        </div>
      )}

      {/* Conteúdo Principal por Aba — Com scroll seguro anti-estouro */}
      <main className="flex-1 min-h-0 p-1.5 sm:p-2 overflow-y-auto flex flex-col">
        {/* ─── ABA 1: PAINEL TRAÇÃO 4X4 (DEDICADO) ─── */}
        {activeTab === 'drive4x4' && (
          <div className="flex flex-col gap-1.5 min-h-0">
            {/* Header da Aba 4x4 */}
            <div className="flex items-center justify-between px-2 py-0.5 rounded-lg bg-amber-950/30 border border-amber-800/30 shrink-0">
              <div>
                <span className="block text-[7.5px] font-mono text-amber-400 uppercase tracking-widest leading-tight">
                  Tração 4x4
                </span>
                <span className="block text-[10px] font-bold text-white leading-tight">
                  Seletor Inteligente
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[7.5px] font-mono text-zinc-400 leading-tight">Modo Ativo:</span>
                <span className="block text-[9.5px] font-black font-mono text-amber-400 uppercase tracking-wider leading-tight">
                  {fourWheelDriveMode === '4wd_low'
                    ? '4WD LOW (REDUZIDA)'
                    : fourWheelDriveMode === '4wd'
                    ? '4WD LOCK (50/50)'
                    : 'AUTO (SOB DEMANDA)'}
                </span>
              </div>
            </div>

            {/* Diagrama Visual Compacto dos Eixos / Chassi 4x4 */}
            <div className="rounded-xl bg-zinc-900/80 border border-amber-900/40 p-1.5 flex flex-col justify-between items-center overflow-hidden shrink-0">
              {/* Eixo Dianteiro */}
              <div className="w-full flex items-center justify-between px-2">
                <div
                  className={`w-7 h-9 rounded border transition-all flex flex-col items-center justify-center text-[7px] font-mono font-bold leading-none ${
                    fourWheelDriveMode !== 'auto' || speedKmh > 0
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                  }`}
                >
                  <span>D.ESQ</span>
                </div>

                <div className="flex flex-col items-center flex-1 px-2">
                  <div className="h-1 w-full max-w-[140px] rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
                  <span className="text-[6.5px] font-mono text-amber-300 uppercase tracking-wider mt-0.5">
                    Diferencial Dianteiro
                  </span>
                </div>

                <div
                  className={`w-7 h-9 rounded border transition-all flex flex-col items-center justify-center text-[7px] font-mono font-bold leading-none ${
                    fourWheelDriveMode !== 'auto' || speedKmh > 0
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                  }`}
                >
                  <span>D.DIR</span>
                </div>
              </div>

              {/* Cardã Central & Acoplador */}
              <div className="flex items-center gap-1.5 my-0.5">
                <div
                  className={`px-2 py-0.5 rounded-full border text-[7.5px] font-mono font-black uppercase tracking-wider transition-all ${
                    fourWheelDriveMode === '4wd_low'
                      ? 'bg-red-600 text-white border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse'
                      : fourWheelDriveMode === '4wd'
                      ? 'bg-amber-500 text-black border-amber-300'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {fourWheelDriveMode === '4wd_low'
                    ? '🔒 4WD LOW (REDUZIDA)'
                    : fourWheelDriveMode === '4wd'
                    ? '🔒 4WD LOCK (50/50)'
                    : '⚡ ACOPLAMENTO AUTO'}
                </div>
              </div>

              {/* Eixo Traseiro */}
              <div className="w-full flex items-center justify-between px-2">
                <div
                  className={`w-7 h-9 rounded border transition-all flex flex-col items-center justify-center text-[7px] font-mono font-bold leading-none ${
                    fourWheelDriveMode === '4wd' || fourWheelDriveMode === '4wd_low'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : fourWheelDriveMode === 'auto'
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                  }`}
                >
                  <span>T.ESQ</span>
                </div>

                <div className="flex flex-col items-center flex-1 px-2">
                  <div className="h-1 w-full max-w-[140px] rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
                  <span className="text-[6.5px] font-mono text-amber-300 uppercase tracking-wider mt-0.5">
                    Diferencial Traseiro
                  </span>
                </div>

                <div
                  className={`w-7 h-9 rounded border transition-all flex flex-col items-center justify-center text-[7px] font-mono font-bold leading-none ${
                    fourWheelDriveMode === '4wd' || fourWheelDriveMode === '4wd_low'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : fourWheelDriveMode === 'auto'
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                  }`}
                >
                  <span>T.DIR</span>
                </div>
              </div>
            </div>

            {/* Painel Interativo de Botões de Tração — Compacto */}
            <div className="bg-zinc-900/90 border border-amber-800/40 rounded-xl p-1.5 space-y-1 shrink-0">
              <div className="flex items-center justify-between text-[7.5px] font-mono text-zinc-400 px-0.5">
                <span>SELETOR 4X4</span>
                <span className={isLowEngageable ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {speedKmh} km/h ({isLowEngageable ? 'Apto para LOW' : 'Pare para LOW'})
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {/* Botão AUTO */}
                <button
                  type="button"
                  onClick={() => handleSelect4x4Mode('auto')}
                  className={`h-9 rounded-lg border flex flex-col items-center justify-center font-mono uppercase transition-all cursor-pointer active:scale-95 ${
                    fourWheelDriveMode === 'auto'
                      ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                      : 'bg-zinc-900 text-zinc-400 border-white/10 hover:border-amber-500/50 hover:text-white'
                  }`}
                >
                  <span className="text-[10px] font-black">AUTO</span>
                  <span className="text-[6.5px] font-bold">Sob Demanda</span>
                </button>

                {/* Botão 4WD LOCK */}
                <button
                  type="button"
                  onClick={() => handleSelect4x4Mode('4wd')}
                  className={`h-9 rounded-lg border flex flex-col items-center justify-center font-mono uppercase transition-all cursor-pointer active:scale-95 ${
                    fourWheelDriveMode === '4wd'
                      ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                      : 'bg-zinc-900 text-zinc-400 border-white/10 hover:border-amber-500/50 hover:text-white'
                  }`}
                >
                  <span className="text-[10px] font-black">4WD</span>
                  <span className="text-[6.5px] font-bold">Lock 50/50</span>
                </button>

                {/* Botão 4WD LOW */}
                <button
                  type="button"
                  onClick={() => handleSelect4x4Mode('4wd_low')}
                  className={`h-9 rounded-lg border flex flex-col items-center justify-center font-mono uppercase transition-all cursor-pointer active:scale-95 relative overflow-hidden ${
                    fourWheelDriveMode === '4wd_low'
                      ? 'bg-red-600 text-white border-red-400 font-black shadow-[0_0_10px_rgba(239,68,68,0.8)]'
                      : isLowEngageable
                      ? 'bg-zinc-900 text-zinc-300 border-white/10 hover:border-red-500/50 hover:text-white'
                      : 'bg-zinc-950 text-zinc-600 border-white/5 opacity-70'
                  }`}
                >
                  <span className="text-[10px] font-black flex items-center gap-0.5">
                    <span>4WD LOW</span>
                    <span className="text-[7.5px]">⚙️</span>
                  </span>
                  <span className="text-[6.5px] font-bold">Reduzida</span>
                  {!isLowEngageable && (
                    <span className="absolute top-0.5 right-1 text-[6.5px] text-amber-400 font-mono">
                      🔒
                    </span>
                  )}
                </button>
              </div>

              {/* Descrição do Modo Atual */}
              <div className="text-[7.5px] font-mono text-zinc-400 px-0.5 text-center leading-tight">
                {fourWheelDriveMode === 'auto' && (
                  <span>Modo AUTO: Tração sob demanda. Distribui torque automaticamente entre eixos.</span>
                )}
                {fourWheelDriveMode === '4wd' && (
                  <span className="text-amber-300 font-bold">
                    Modo 4WD LOCK: Bloqueio 50% dianteira / 50% traseira para terra, cascalho e lama.
                  </span>
                )}
                {fourWheelDriveMode === '4wd_low' && (
                  <span className="text-red-300 font-bold">
                    Modo 4WD LOW: Primeira marcha ultracurta com crawl ratio total e bloqueio 50/50 para subidas extremas.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA 2: MÍDIA & ÁUDIO ─── */}
        {activeTab === 'media' && (
          <div className="flex flex-col gap-1.5 min-h-0">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900/80 border border-amber-900/30">
              <div className="flex aspect-square h-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-700 to-zinc-950 text-xl shadow border border-amber-600/40">
                🎵
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-block px-1 py-0.5 rounded bg-amber-600/20 text-amber-300 font-mono text-[7px] font-bold uppercase mb-0.5">
                  Harman Kardon · Bluetooth
                </span>
                <div className="truncate text-xs font-black text-white">{currentTrack.title}</div>
                <div className="truncate text-[9px] text-zinc-400">{currentTrack.artist}</div>
              </div>
            </div>

            {/* Barra de Progresso */}
            <div className="space-y-0.5 px-0.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300"
                  style={{ width: `${(elapsed / currentTrack.dur) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[7.5px] font-mono text-zinc-500">
                <span>{fmtTime(elapsed)}</span>
                <span>{fmtTime(currentTrack.dur)}</span>
              </div>
            </div>

            {/* Controles de Reprodução */}
            <div className="flex items-center justify-center gap-4 text-base py-0.5">
              <button
                type="button"
                onClick={() => changeTrack(-1)}
                className="p-1 rounded-full text-zinc-400 hover:text-white active:scale-90 transition-transform cursor-pointer"
              >
                ⏮
              </button>
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-8 w-8 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow active:scale-95 transition-transform cursor-pointer text-base font-bold"
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button
                type="button"
                onClick={() => changeTrack(1)}
                className="p-1 rounded-full text-zinc-400 hover:text-white active:scale-90 transition-transform cursor-pointer"
              >
                ⏭
              </button>
            </div>

            {/* Lista de Músicas */}
            <div className="flex flex-col gap-1 max-h-28 overflow-y-auto pr-0.5">
              {TRACKS.map((t, i) => (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => {
                    setTrackIndex(i)
                    setElapsed(0)
                    setIsPlaying(true)
                  }}
                  className={`flex items-center justify-between px-2 py-1 rounded-lg border text-left transition-all cursor-pointer ${
                    i === trackIndex
                      ? 'bg-amber-950/40 border-amber-500 text-white shadow-sm'
                      : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="truncate min-w-0 pr-1">
                    <div className="truncate text-[10px] font-bold">{t.title}</div>
                    <div className="truncate text-[7.5px] text-zinc-500">{t.artist}</div>
                  </div>
                  <span className="text-[8px] font-mono text-zinc-500 shrink-0">{fmtTime(t.dur)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── ABA 3: CLIMATIZAÇÃO DUAL-ZONE ─── */}
        {activeTab === 'climate' && (
          <div className="flex flex-col gap-2 p-1">
            <div className="grid grid-cols-2 gap-2">
              {/* Motorista */}
              <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-zinc-900/80 border border-amber-900/40 p-2">
                <span className="text-[7.5px] font-mono font-bold text-amber-300 uppercase">
                  Motorista
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDriverTemp((t) => Math.max(16, t - 0.5))}
                    className="h-7 w-7 rounded-full bg-zinc-800 border border-white/10 text-white font-bold active:scale-90 cursor-pointer text-xs"
                  >
                    −
                  </button>
                  <span className="text-lg font-black font-mono text-white min-w-[50px] text-center">
                    {driverTemp.toFixed(1)}°
                  </span>
                  <button
                    type="button"
                    onClick={() => setDriverTemp((t) => Math.min(30, t + 0.5))}
                    className="h-7 w-7 rounded-full bg-zinc-800 border border-white/10 text-white font-bold active:scale-90 cursor-pointer text-xs"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Passageiro */}
              <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-zinc-900/80 border border-amber-900/40 p-2">
                <span className="text-[7.5px] font-mono font-bold text-amber-300 uppercase">
                  Passageiro
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPassengerTemp((t) => Math.max(16, t - 0.5))}
                    className="h-7 w-7 rounded-full bg-zinc-800 border border-white/10 text-white font-bold active:scale-90 cursor-pointer text-xs"
                  >
                    −
                  </button>
                  <span className="text-lg font-black font-mono text-white min-w-[50px] text-center">
                    {passengerTemp.toFixed(1)}°
                  </span>
                  <button
                    type="button"
                    onClick={() => setPassengerTemp((t) => Math.min(30, t + 0.5))}
                    className="h-7 w-7 rounded-full bg-zinc-800 border border-white/10 text-white font-bold active:scale-90 cursor-pointer text-xs"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Modos do Clima */}
            <div className="grid grid-cols-3 gap-1 text-[8px] font-mono font-bold uppercase">
              <button
                type="button"
                onClick={() => setIsAcOn(!isAcOn)}
                className={`py-1 rounded-lg border transition-colors cursor-pointer ${
                  isAcOn ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-zinc-900 text-zinc-500 border-white/5'
                }`}
              >
                A/C {isAcOn ? 'LIGADO' : 'DESL'}
              </button>
              <button
                type="button"
                onClick={() => setIsAuto(!isAuto)}
                className={`py-1 rounded-lg border transition-colors cursor-pointer ${
                  isAuto ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-zinc-900 text-zinc-500 border-white/5'
                }`}
              >
                AUTO
              </button>
              <button
                type="button"
                onClick={() => setIsDual(!isDual)}
                className={`py-1 rounded-lg border transition-colors cursor-pointer ${
                  isDual ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-zinc-900 text-zinc-500 border-white/5'
                }`}
              >
                DUAL ZONE
              </button>
            </div>
          </div>
        )}

        {/* ─── ABA 4: AJUSTES & VEÍCULO ─── */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-1.5 p-1">
            <div className="grid grid-cols-2 gap-1.5 text-center font-mono">
              <div className="rounded-lg bg-zinc-900/80 border border-amber-900/30 p-1.5">
                <span className="text-[6.5px] text-zinc-500 uppercase block">Velocidade</span>
                <span className="text-base font-black text-white">{speedKmh}</span>
                <span className="text-[6.5px] text-zinc-500 block">KM/H</span>
              </div>
              <div className="rounded-lg bg-zinc-900/80 border border-amber-900/30 p-1.5">
                <span className="text-[6.5px] text-zinc-500 uppercase block">Turbo Boost</span>
                <span className="text-base font-black text-amber-400">
                  {boostPressureBar > 0.05 ? `${boostPressureBar.toFixed(2)}` : '0.00'}
                </span>
                <span className="text-[6.5px] text-zinc-500 block">BAR</span>
              </div>
            </div>

            {/* Controles de Volume e Brilho */}
            <div className="flex flex-col gap-1 rounded-xl bg-zinc-900/80 border border-amber-900/30 p-2 text-[8px] font-mono">
              <label className="flex items-center gap-1.5">
                <span className="w-12 text-zinc-400">Volume</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => setVolume(+e.target.value)}
                  className="h-1 flex-1 accent-amber-500 cursor-pointer"
                />
                <span className="w-5 text-right text-white font-bold">{volume}</span>
              </label>

              <label className="flex items-center gap-1.5">
                <span className="w-12 text-zinc-400">Brilho</span>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={brightness}
                  onChange={(e) => setBrightness(+e.target.value)}
                  className="h-1 flex-1 accent-amber-500 cursor-pointer"
                />
                <span className="w-5 text-right text-white font-bold">{brightness}</span>
              </label>
            </div>

            {/* Ficha Técnica e Identidade Ranch */}
            <div className="rounded-xl bg-gradient-to-r from-amber-950/60 to-zinc-900 border border-amber-700/40 p-2 text-[7.5px] font-mono space-y-0.5">
              <div className="text-amber-300 font-black text-[9px] truncate">
                {vehicle.info.name}
              </div>
              <div className="text-zinc-300">Tração Integral com Reduzida 4WD LOW e Crawl Ratio</div>
              <div className="text-zinc-400">Distribuição estática de peso: 56% D / 44% T (1.910 kg)</div>
              <div className="text-amber-500 font-bold mt-0.5">Uconnect™ 10.1 Vertical Edition</div>
            </div>
          </div>
        )}
      </main>

      {/* Barra de Navegação Inferior (4 abas compactas) */}
      <nav className="grid h-9 shrink-0 grid-cols-4 border-t border-amber-800/40 bg-zinc-950/95 text-center font-sans font-bold text-[8px] tracking-wide">
        <button
          type="button"
          onClick={() => setActiveTab('drive4x4')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === 'drive4x4'
              ? 'text-amber-400 border-t-2 border-amber-400 bg-amber-950/30'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="text-xs">🛞</span>
          <span>Tração 4x4</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('media')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === 'media'
              ? 'text-amber-400 border-t-2 border-amber-400 bg-amber-950/30'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="text-xs">🎵</span>
          <span>Mídia</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('climate')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === 'climate'
              ? 'text-amber-400 border-t-2 border-amber-400 bg-amber-950/30'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="text-xs">❄️</span>
          <span>Clima</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === 'settings'
              ? 'text-amber-400 border-t-2 border-amber-400 bg-amber-950/30'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className="text-xs">⚙️</span>
          <span>Ajustes</span>
        </button>
      </nav>
    </div>
  )
})
