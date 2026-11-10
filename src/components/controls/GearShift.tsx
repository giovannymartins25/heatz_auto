import { memo, useEffect, useState, useRef } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

export interface GearShiftProps {
  orientation?: 'horizontal' | 'vertical'
  size?: 'normal' | 'compact' | 'large'
}

/**
 * GearShift — Alavanca de Câmbio e Borboletas Paddle Shift.
 *
 * Suporte completo:
 * - Veículos Automáticos (Porsche PDK, Golf GTI DSG, Yaris CVT):
 *   Seletor de Console PRNDS/M (Park, Reverse, Neutral, Drive, Sport, Manual)
 *   com indicação visual iluminada e borboletas de toque para trocas sequenciais Tiptronic.
 * - Veículos Manuais (Gol G6, CB1000R):
 *   Paddle Shift sequencial [-] [N] [+] com exigência mecânica de embreagem.
 */
export const GearShift = memo(function GearShift({
  orientation = 'horizontal',
  size = 'normal',
}: GearShiftProps) {
  const currentGear = useSimulationStore((s) => s.currentGear)
  const isAutomaticVehicle = useSimulationStore((s) => s.isAutomaticVehicle)
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const shifterPosition = useSimulationStore((s) => s.shifterPosition)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const lastShiftReason = useSimulationStore((s) => s.lastShiftReason)

  const shiftUp = useSimulationStore((s) => s.shiftUp)
  const shiftDown = useSimulationStore((s) => s.shiftDown)
  const shiftNeutral = useSimulationStore((s) => s.shiftNeutral)
  const selectPark = useSimulationStore((s) => s.selectPark)
  const selectReverse = useSimulationStore((s) => s.selectReverse)
  const selectNeutral = useSimulationStore((s) => s.selectNeutral)
  const selectDrive = useSimulationStore((s) => s.selectDrive)
  const selectSport = useSimulationStore((s) => s.selectSport)
  const selectManual = useSimulationStore((s) => s.selectManual)

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const lastActionTimeRef = useRef(0)

  const handleShiftUp = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const now = performance.now()
    if (now - lastActionTimeRef.current < 60) return
    lastActionTimeRef.current = now
    if (isRunning) shiftUp()
  }

  const handleShiftDown = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const now = performance.now()
    if (now - lastActionTimeRef.current < 60) return
    lastActionTimeRef.current = now
    if (isRunning) shiftDown()
  }

  const handleShiftNeutral = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const now = performance.now()
    if (now - lastActionTimeRef.current < 60) return
    lastActionTimeRef.current = now
    if (isRunning && currentGear !== 0) shiftNeutral()
  }

  useEffect(() => {
    if (lastShiftReason === 'clutch_required') {
      setFeedbackMessage('PRESSIONE A EMBREAGEM')
      const t = setTimeout(() => setFeedbackMessage(null), 1800)
      return () => clearTimeout(t)
    } else if (lastShiftReason === 'over_rev') {
      setFeedbackMessage('SOBREGIRO BLOQUEADO')
      const t = setTimeout(() => setFeedbackMessage(null), 1800)
      return () => clearTimeout(t)
    } else {
      setFeedbackMessage(null)
    }
  }, [lastShiftReason])

  const buttonSizeClass = {
    compact: 'w-10 h-10 text-base',
    normal: 'w-12 h-12 sm:w-14 sm:h-14 text-lg sm:text-xl',
    large: 'w-14 h-14 sm:w-16 sm:h-16 text-xl sm:text-2xl',
  }[size]

  // Posições ativas do câmbio automático — exatamente UMA única ativa por vez
  const isP = shifterPosition === 'P' || currentGear === -2
  const isR = !isP && (shifterPosition === 'R' || currentGear === -1)
  const isN = !isP && !isR && (shifterPosition === 'N' || (currentGear === 0 && transmissionMode !== 'manual_simulated'))
  const isM = !isP && !isR && !isN && (shifterPosition === 'M' || transmissionMode === 'manual_simulated')
  const isS = !isP && !isR && !isN && !isM && (shifterPosition === 'S' || drivingMode === 'sport')
  const isD = !isP && !isR && !isN && !isM && !isS

  const activeLabel =
    isP ? 'PARK'
    : isR ? 'RÉ'
    : isN ? 'NEUTRO'
    : isS ? (currentGear > 0 ? `SPORT (S${currentGear})` : 'SPORT')
    : isM ? (currentGear > 0 ? `MANUAL (M${currentGear})` : 'MANUAL')
    : (currentGear > 0 ? `DRIVE (D${currentGear})` : 'DRIVE')

  return (
    <div className="flex flex-col items-center select-none touch-none relative font-mono">
      {/* Alerta de Feedback Visual Rápido */}
      {feedbackMessage && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap px-2.5 py-0.5 rounded bg-red-500/90 text-white font-mono text-[9px] font-black tracking-wider uppercase shadow-lg shadow-red-500/30 animate-pulse">
          {feedbackMessage}
        </div>
      )}

      {/* ── SELETOR AUTOMÁTICO PRNDS (Para Porsche, Golf GTI e Yaris) ── */}
      {isAutomaticVehicle ? (
        <div className="flex flex-col items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-950/90 border border-white/10 shadow-xl">
          <div className="w-full flex items-center justify-between px-1 text-[8px] text-zinc-400 font-bold">
            <span className="text-zinc-500">CÂMBIO AUTO</span>
            <span className="text-amber-400 font-black">
              {activeLabel}
            </span>
          </div>

          {/* Barra de Seleção PRNDS / M */}
          <div
            className={
              orientation === 'vertical'
                ? 'grid grid-cols-2 gap-1'
                : 'flex items-center gap-1'
            }
          >
            {/* P - PARK */}
            <button
              onClick={selectPark}
              disabled={!isRunning}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center border ${
                isP
                  ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                  : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'
              }`}
              title="Park (P) — Trava mecânica de estacionamento"
            >
              P
            </button>

            {/* R - REVERSE */}
            <button
              onClick={selectReverse}
              disabled={!isRunning}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center border ${
                isR
                  ? 'bg-red-600 text-white border-red-400 shadow-[0_0_12px_rgba(220,38,38,0.8)]'
                  : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'
              }`}
              title="Reverse (R) — Marcha ré"
            >
              R
            </button>

            {/* N - NEUTRAL */}
            <button
              onClick={selectNeutral}
              disabled={!isRunning}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center border ${
                isN
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                  : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'
              }`}
              title="Neutral (N) — Ponto morto / Roda livre"
            >
              N
            </button>

            {/* D - DRIVE */}
            <button
              onClick={selectDrive}
              disabled={!isRunning}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center border ${
                isD
                  ? 'bg-sky-600 text-white border-sky-400 shadow-[0_0_12px_rgba(2,132,199,0.8)]'
                  : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'
              }`}
              title="Drive (D) — Marchas automáticas para frente"
            >
              D
            </button>

            {/* S - SPORT */}
            <button
              onClick={selectSport}
              disabled={!isRunning}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center border ${
                isS
                  ? 'bg-rose-600 text-white border-rose-400 shadow-[0_0_12px_rgba(225,29,72,0.8)]'
                  : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'
              }`}
              title="Sport (S) — Modo esportivo com giro elevado"
            >
              S
            </button>

            {/* M - MANUAL / TIPTRONIC */}
            <button
              onClick={selectManual}
              disabled={!isRunning}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center border ${
                isM
                  ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.8)]'
                  : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'
              }`}
              title="Manual (M) — Trocas manuais sequenciais pelas borboletas"
            >
              M
            </button>
          </div>

          {/* Borboletas Paddle Shift para Trocas Rápidas */}
          <div
            className={`w-full flex ${
              orientation === 'vertical' ? 'flex-col gap-1' : 'items-center justify-between'
            } pt-1 border-t border-white/10`}
          >
            <button
              onPointerDown={handleShiftDown}
              onTouchStart={handleShiftDown}
              onClick={handleShiftDown}
              disabled={!isRunning}
              className={`${
                orientation === 'vertical' ? 'w-full py-1 text-[9px]' : 'flex-1 py-1 mx-0.5 text-[10px]'
              } rounded-lg bg-zinc-900 border border-white/10 active:bg-zinc-800 font-black text-zinc-300 flex items-center justify-center gap-1 cursor-pointer transition-transform active:scale-95 shadow`}
              title="Reduzir Marcha / Tiptronic [-]"
            >
              <span>▼</span>
              <span>PADDLE [-]</span>
            </button>
            <button
              onPointerDown={handleShiftUp}
              onTouchStart={handleShiftUp}
              onClick={handleShiftUp}
              disabled={!isRunning}
              className={`${
                orientation === 'vertical' ? 'w-full py-1 text-[9px]' : 'flex-1 py-1 mx-0.5 text-[10px]'
              } rounded-lg bg-zinc-900 border border-white/10 active:bg-zinc-800 font-black text-amber-400 flex items-center justify-center gap-1 cursor-pointer transition-transform active:scale-95 shadow`}
              title="Subir Marcha / Tiptronic [+]"
            >
              <span>PADDLE [+]</span>
              <span>▲</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── SELETOR MANUAL CLÁSSICO [-] [N] [+] (Para Gol G6 e CB1000R) ── */
        <div
          className={`flex items-center gap-3 sm:gap-4 ${
            orientation === 'vertical' ? 'flex-col-reverse' : 'flex-row'
          }`}
        >
          {/* Botão Downshift (▼ -) */}
          <button
            id="btn-shift-down"
            onPointerDown={handleShiftDown}
            onTouchStart={handleShiftDown}
            onClick={handleShiftDown}
            disabled={!isRunning}
            style={{ touchAction: 'none' }}
            className={`${buttonSizeClass} rounded-2xl border-2 border-zinc-700/80 bg-zinc-900/80 active:bg-zinc-800 active:border-zinc-500 disabled:opacity-30 disabled:pointer-events-none flex flex-col items-center justify-center font-mono font-black text-[var(--color-text-secondary)] transition-all active:scale-90 cursor-pointer shadow-lg`}
            aria-label="Reduzir marcha"
            title="Tecla ] — Reduzir marcha"
          >
            <span className="text-[10px] leading-none text-zinc-500">▼</span>
            <span className="leading-none mt-0.5">-</span>
          </button>

          {/* Botão Neutro (N) */}
          <button
            id="btn-shift-neutral"
            onPointerDown={handleShiftNeutral}
            onTouchStart={handleShiftNeutral}
            onClick={handleShiftNeutral}
            disabled={!isRunning || currentGear === 0}
            style={{ touchAction: 'none' }}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border font-mono font-black text-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
              currentGear === 0
                ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'border-zinc-800 bg-zinc-950/80 text-zinc-600 disabled:opacity-35'
            }`}
            aria-label="Engatar Neutro"
            title="Engatar Neutro"
          >
            N
          </button>

          {/* Botão Upshift (▲ +) */}
          <button
            id="btn-shift-up"
            onPointerDown={handleShiftUp}
            onTouchStart={handleShiftUp}
            onClick={handleShiftUp}
            disabled={!isRunning}
            style={{ touchAction: 'none' }}
            className={`${buttonSizeClass} rounded-2xl border-2 border-zinc-700/80 bg-zinc-900/80 active:bg-zinc-800 active:border-[var(--color-accent)] disabled:opacity-30 disabled:pointer-events-none flex flex-col items-center justify-center font-mono font-black text-[var(--color-accent)] transition-all active:scale-90 cursor-pointer shadow-lg`}
            aria-label="Subir marcha"
            title="Tecla [ — Subir marcha"
          >
            <span className="text-[10px] leading-none text-[var(--color-accent-muted)]">▲</span>
            <span className="leading-none mt-0.5">+</span>
          </button>
        </div>
      )}
    </div>
  )
})
