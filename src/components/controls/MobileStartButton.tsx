import { memo, useRef, useState, useEffect } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'

export interface MobileStartButtonProps {
  className?: string
  /** 'wide' = barra horizontal (retrato) | 'square' = bloco compacto (paisagem) */
  variant?: 'wide' | 'square'
}

const HOLD_TO_STOP_MS = 650

/**
 * MobileStartButton — Botão de partida para a base da tela no mobile.
 *
 * - Desligado / Estolado: um toque liga o motor.
 * - Ligado: é preciso SEGURAR ~0,65s para desligar (barra de progresso),
 *   evitando desligar o carro sem querer com o polegar perto dos pedais.
 */
export const MobileStartButton = memo(function MobileStartButton({
  className = '',
  variant = 'wide',
}: MobileStartButtonProps) {
  const isRunning = useSimulationStore((s) => s.isRunning)
  const isStalled = useSimulationStore((s) => s.isStalled)
  const status = useSimulationStore((s) => s.status)
  const startEngine = useSimulationStore((s) => s.startEngine)
  const stopEngine = useSimulationStore((s) => s.stopEngine)

  const [holdProgress, setHoldProgress] = useState(0)
  const holdStartRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastPressRef = useRef(0)

  const isStarting = status === 'starting'

  const cancelHold = () => {
    holdStartRef.current = null
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setHoldProgress(0)
  }

  useEffect(() => () => cancelHold(), [])

  const tickHold = () => {
    if (holdStartRef.current === null) return
    const p = Math.min(1, (performance.now() - holdStartRef.current) / HOLD_TO_STOP_MS)
    setHoldProgress(p)
    if (p >= 1) {
      HapticFeedback.medium()
      stopEngine()
      cancelHold()
      return
    }
    rafRef.current = requestAnimationFrame(tickHold)
  }

  const handleDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const now = performance.now()
    if (now - lastPressRef.current < 350) return
    lastPressRef.current = now
    if (isStarting) return

    if (!isRunning) {
      HapticFeedback.heavy()
      startEngine()
      return
    }
    holdStartRef.current = now
    rafRef.current = requestAnimationFrame(tickHold)
  }

  const handleUp = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    cancelHold()
  }

  const theme = isStalled
    ? 'border-amber-400 bg-gradient-to-b from-amber-600/90 to-red-700/90 text-white shadow-[0_0_18px_rgba(245,158,11,0.6)] animate-pulse'
    : isStarting
    ? 'border-cyan-400 bg-cyan-950/90 text-cyan-200 shadow-[0_0_18px_rgba(6,182,212,0.6)] animate-pulse'
    : isRunning
    ? 'border-red-500/60 bg-gradient-to-b from-zinc-900 to-red-950/80 text-red-300'
    : 'border-emerald-400 bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-[0_0_18px_rgba(16,185,129,0.6)] animate-pulse'

  const mainLabel = isStalled ? 'RELIGAR' : isStarting ? 'PARTIDA…' : isRunning ? 'STOP' : 'START'
  const subLabel = isStalled
    ? 'MOTOR APAGOU'
    : isStarting
    ? 'GIRANDO'
    : isRunning
    ? 'SEGURE P/ DESLIGAR'
    : 'TOQUE P/ LIGAR'

  return (
    <button
      type="button"
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      onPointerCancel={handleUp}
      onContextMenu={(e) => e.preventDefault()}
      disabled={isStarting}
      style={{ touchAction: 'none' }}
      aria-label={isRunning ? 'Segure para desligar o motor' : 'Ligar o motor'}
      className={`relative overflow-hidden select-none touch-none rounded-2xl border-2 font-mono font-black uppercase transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
        variant === 'wide' ? 'flex-row gap-2 px-3' : 'flex-col gap-0.5 px-1'
      } ${theme} ${className}`}
    >
      {/* Preenchimento de progresso do "segurar para desligar" */}
      {holdProgress > 0 && (
        <span
          className="absolute inset-y-0 left-0 bg-red-500/60 pointer-events-none"
          style={{ width: `${holdProgress * 100}%` }}
        />
      )}
      <span
        className={`relative w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          isStalled
            ? 'bg-amber-300'
            : isStarting
            ? 'bg-cyan-300'
            : isRunning
            ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
            : 'bg-white'
        }`}
      />
      <span className="relative flex flex-col items-center leading-none">
        <span className={variant === 'wide' ? 'text-sm tracking-wider' : 'text-[12px] tracking-wider'}>
          {mainLabel}
        </span>
        <span className="text-[6.5px] font-bold tracking-wider opacity-80 mt-0.5">{subLabel}</span>
      </span>
    </button>
  )
})

