import { useEffect, useRef, useState } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

/**
 * Pedals — Controles de acelerador e freio otimizados para touch.
 *
 * Utiliza PointerEvents para detectar cliques e toques contínuos de forma responsiva.
 * Incrementa gradualmente o valor do pedal enquanto pressionado e retorna a zero ao soltar.
 */
export function Pedals() {
  const setThrottle = useSimulationStore((s) => s.setThrottle)
  const setBrake = useSimulationStore((s) => s.setBrake)
  const isRunning = useSimulationStore((s) => s.isRunning)

  const [throttlePressed, setThrottlePressed] = useState(false)
  const [brakePressed, setBrakePressed] = useState(false)

  // Valores de simulação para simular curso físico do pedal
  const throttleValRef = useRef(0)
  const brakeValRef = useRef(0)

  useEffect(() => {
    let active = true
    const loop = () => {
      if (!active) return

      // Acelerador: sobe em 0.1s (10% por frame a 60fps), desce em 0.15s
      if (throttlePressed && isRunning) {
        throttleValRef.current = Math.min(throttleValRef.current + 0.12, 1)
      } else {
        throttleValRef.current = Math.max(throttleValRef.current - 0.15, 0)
      }

      // Freio: sobe muito rápido (0.05s), desce rápido também
      if (brakePressed) {
        brakeValRef.current = Math.min(brakeValRef.current + 0.2, 1)
      } else {
        brakeValRef.current = Math.max(brakeValRef.current - 0.25, 0)
      }

      setThrottle(throttleValRef.current)
      setBrake(brakeValRef.current)

      requestAnimationFrame(loop)
    }

    requestAnimationFrame(loop)
    return () => {
      active = false
    }
  }, [throttlePressed, brakePressed, isRunning, setThrottle, setBrake])

  // Tratar soltura acidental fora do botão
  useEffect(() => {
    const handleGlobalRelease = () => {
      setThrottlePressed(false)
      setBrakePressed(false)
    }
    window.addEventListener('pointerup', handleGlobalRelease)
    return () => window.removeEventListener('pointerup', handleGlobalRelease)
  }, [])

  return (
    <div className="flex gap-8 justify-center items-end w-full max-w-xs h-48 px-4 touch-none">
      {/* Freio */}
      <div className="flex flex-col items-center flex-1 h-full">
        <button
          onPointerDown={() => setBrakePressed(true)}
          onPointerUp={() => setBrakePressed(false)}
          className={`w-16 h-36 border-2 rounded-lg relative flex flex-col justify-between p-2 select-none outline-none transition-all ${
            brakePressed
              ? 'border-red-500 bg-red-950/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
              : 'border-zinc-700 bg-zinc-900/50'
          }`}
          aria-label="Pedal do Freio"
        >
          {/* Ranhuras metálicas do freio */}
          <div className="w-full h-1 bg-zinc-600 rounded-full" />
          <div className="w-full h-1 bg-zinc-600 rounded-full" />
          <div className="w-full h-1 bg-zinc-600 rounded-full" />
          <div className="w-full h-1 bg-zinc-600 rounded-full" />
          <span className="text-[10px] font-bold text-center w-full block text-zinc-500">FREIO</span>
        </button>
        {/* Indicador de curso do pedal */}
        <div className="w-16 bg-zinc-950 h-2 rounded-full mt-3 overflow-hidden border border-white/5">
          <div
            className="h-full bg-red-500 transition-all duration-75"
            style={{ width: `${brakeValRef.current * 100}%` }}
          />
        </div>
      </div>

      {/* Acelerador */}
      <div className="flex flex-col items-center flex-1 h-full">
        <button
          onPointerDown={() => setThrottlePressed(true)}
          onPointerUp={() => setThrottlePressed(false)}
          className={`w-12 h-44 border-2 rounded-lg relative flex flex-col justify-end p-2 select-none outline-none transition-all ${
            throttlePressed
              ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]/10 shadow-[0_0_15px_var(--color-accent-muted)]'
              : 'border-zinc-700 bg-zinc-900/50'
          }`}
          aria-label="Pedal do Acelerador"
        >
          {/* Ranhuras metálicas do acelerador vertical */}
          <div className="flex justify-between w-full h-32 px-1">
            <div className="w-1 bg-zinc-600 h-full rounded-full" />
            <div className="w-1 bg-zinc-600 h-full rounded-full" />
            <div className="w-1 bg-zinc-600 h-full rounded-full" />
          </div>
          <span className="text-[10px] font-bold text-center w-full block text-zinc-500 mt-2">RUN</span>
        </button>
        {/* Indicador de curso do pedal */}
        <div className="w-12 bg-zinc-950 h-2 rounded-full mt-3 overflow-hidden border border-white/5">
          <div
            className="h-full bg-[var(--color-accent)] transition-all duration-75"
            style={{ width: `${throttleValRef.current * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
