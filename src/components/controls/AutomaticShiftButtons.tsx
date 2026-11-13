import { memo, useRef } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

export interface AutomaticShiftButtonProps {
  direction: 'down' | 'up'
  className?: string
  compact?: boolean
}

/**
 * AutomaticShiftButton — Botão de alta visibilidade `-` (reduzir) ou `+` (subir)
 * posicionado na parte superior do cockpit mobile para trocas sequenciais ágeis.
 */
export const AutomaticShiftButton = memo(function AutomaticShiftButton({
  direction,
  className = '',
  compact = false,
}: AutomaticShiftButtonProps) {
  const isAutomaticVehicle = useSimulationStore((s) => s.isAutomaticVehicle)
  const hasManualMode = useSimulationStore((s) => Boolean(s._config?.transmission.hasManualMode))
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const gearSelectorPosition = useSimulationStore((s) => s.gearSelectorPosition)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const shiftDown = useSimulationStore((s) => s.shiftDown)
  const shiftUp = useSimulationStore((s) => s.shiftUp)
  const lastTriggerRef = useRef(0)

  // Exibe apenas em veículos automáticos com modo manual E quando o modo manual estiver ativado (M / manual_simulated)
  const isManualActive = transmissionMode === 'manual_simulated' || gearSelectorPosition === 'M'

  if (!isAutomaticVehicle || !hasManualMode || !isManualActive) {
    return null
  }

  const isUp = direction === 'up'

  const triggerShift = () => {
    if (!isRunning) return
    const now = performance.now()
    if (now - lastTriggerRef.current < 50) return
    lastTriggerRef.current = now
    if (isUp) {
      shiftUp()
    } else {
      shiftDown()
    }
  }

  return (
    <button
      type="button"
      disabled={!isRunning}
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        triggerShift()
      }}
      onTouchStart={(e) => {
        e.preventDefault()
        e.stopPropagation()
        triggerShift()
      }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          triggerShift()
        }
      }}
      style={{ touchAction: 'none' }}
      aria-label={isUp ? 'Subir marcha (+)' : 'Reduzir marcha (-)'}
      title={isUp ? 'Subir marcha (+)' : 'Reduzir marcha (-)'}
      className={`select-none flex flex-col items-center justify-center rounded-2xl border-2 font-mono font-black transition-all active:scale-90 active:brightness-125 cursor-pointer backdrop-blur-md shadow-2xl ${
        compact ? 'w-11 h-14' : 'w-12 h-16 sm:w-14 sm:h-18'
      } ${
        !isRunning
          ? 'bg-zinc-950/70 border-zinc-800 text-zinc-600 opacity-40 cursor-not-allowed'
          : isUp
          ? 'bg-gradient-to-b from-zinc-900/95 via-neutral-950/95 to-black/95 border-amber-400 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.55),inset_0_1px_1px_rgba(255,255,255,0.2)] active:bg-amber-500/30'
          : 'bg-gradient-to-b from-zinc-900/95 via-neutral-950/95 to-black/95 border-sky-400 text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.55),inset_0_1px_1px_rgba(255,255,255,0.2)] active:bg-sky-500/30'
      } ${className}`}
    >
      <span className={`${compact ? 'text-2xl' : 'text-3xl'} leading-none font-bold select-none drop-shadow`}>
        {isUp ? '+' : '−'}
      </span>
      <span
        className={`text-[7.5px] tracking-wider uppercase font-black opacity-80 mt-0.5 select-none ${
          isUp ? 'text-amber-400' : 'text-sky-300'
        }`}
      >
        {isUp ? 'UP' : 'DOWN'}
      </span>
    </button>
  )
})

export interface AutomaticShiftButtonsProps {
  orientation?: 'row' | 'column'
  compact?: boolean
  className?: string
}

/**
 * AutomaticShiftButtons — Par `-` na esquerda e `+` na direita.
 */
export const AutomaticShiftButtons = memo(function AutomaticShiftButtons({
  orientation = 'row',
  compact = false,
  className = '',
}: AutomaticShiftButtonsProps) {
  const isAutomaticVehicle = useSimulationStore((s) => s.isAutomaticVehicle)
  const hasManualMode = useSimulationStore((s) => Boolean(s._config?.transmission.hasManualMode))
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const gearSelectorPosition = useSimulationStore((s) => s.gearSelectorPosition)

  const isManualActive = transmissionMode === 'manual_simulated' || gearSelectorPosition === 'M'

  if (!isAutomaticVehicle || !hasManualMode || !isManualActive) {
    return null
  }

  return (
    <div
      className={`flex items-center justify-between ${
        orientation === 'column' ? 'flex-col gap-2' : 'flex-row gap-3'
      } ${className}`}
      role="group"
      aria-label="Troca manual de marchas"
    >
      <AutomaticShiftButton direction="down" compact={compact} />
      <AutomaticShiftButton direction="up" compact={compact} />
    </div>
  )
})
