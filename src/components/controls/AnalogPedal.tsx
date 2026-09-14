import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { clamp } from '@/utils/math'

export interface AnalogPedalProps {
  label: string
  sublabel?: string
  value: number
  onChange: (value: number) => void
  colorTheme?: 'accent' | 'red' | 'amber' | 'blue'
  widthClass?: string
  heightClass?: string
  disabled?: boolean
  showPercent?: boolean
}

/**
 * AnalogPedal — Pedal de controle analógico contínuo de 0% a 100%.
 *
 * Utiliza PointerEvents com PointerCapture para rastrear toques/arraste
 * de mouse e mobile sem perder o foco fora da área do pedal.
 *
 * Movimento:
 * - Arrastar para cima: aumenta a intensidade (0 -> 100%)
 * - Arrastar para baixo: diminui a intensidade
 * - Ao soltar: retorna imediatamente a 0% com animação suave de retorno
 */
export const AnalogPedal = memo(function AnalogPedal({
  label,
  sublabel,
  value,
  onChange,
  colorTheme = 'accent',
  widthClass = 'w-16',
  heightClass = 'h-44',
  disabled = false,
  showPercent = true,
}: AnalogPedalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isPointerDownRef = useRef(false)
  const animFrameRef = useRef<number>(0)
  const [internalValue, setInternalValue] = useState(value)

  // Sincronizar quando valor externo mudar (caso o motor desligue ou resete)
  useEffect(() => {
    if (!isPointerDownRef.current) {
      setInternalValue(value)
    }
  }, [value])

  // Limpeza de animação
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // Calcula o valor percentual (0 a 1) baseado na posição vertical do ponteiro
  const calculatePedalValue = useCallback((clientY: number): number => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    // A base do pedal é 0%, o topo é 100%
    const normalized = (rect.bottom - clientY) / rect.height
    return clamp(normalized, 0, 1)
  }, [])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    isPointerDownRef.current = true
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Ignora se não for suportado
    }

    const newVal = calculatePedalValue(e.clientY)
    setInternalValue(newVal)
    onChange(newVal)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current || disabled) return
    const newVal = calculatePedalValue(e.clientY)
    setInternalValue(newVal)
    onChange(newVal)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignora
    }

    // Retorno suave e rápido a 0%
    let current = internalValue
    const releaseLoop = () => {
      current -= 0.25 // Retorna em ~3-4 frames (~50ms)
      if (current <= 0) {
        setInternalValue(0)
        onChange(0)
      } else {
        setInternalValue(current)
        onChange(current)
        animFrameRef.current = requestAnimationFrame(releaseLoop)
      }
    }
    animFrameRef.current = requestAnimationFrame(releaseLoop)
  }

  // Configurações visuais por tema
  const themeStyles = {
    accent: {
      borderActive: 'border-[var(--color-accent)]',
      glow: 'shadow-[0_0_20px_var(--color-accent-muted)]',
      fillBg: 'bg-[var(--color-accent)]',
      fillGlow: 'shadow-[0_0_15px_var(--color-accent)]',
      textAccent: 'text-[var(--color-accent)]',
      trackBorder: 'border-[var(--color-accent)]/30',
    },
    red: {
      borderActive: 'border-red-500',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
      fillBg: 'bg-red-500',
      fillGlow: 'shadow-[0_0_15px_rgba(239,68,68,0.5)]',
      textAccent: 'text-red-400',
      trackBorder: 'border-red-500/30',
    },
    amber: {
      borderActive: 'border-amber-500',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
      fillBg: 'bg-amber-500',
      fillGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]',
      textAccent: 'text-amber-400',
      trackBorder: 'border-amber-500/30',
    },
    blue: {
      borderActive: 'border-cyan-500',
      glow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]',
      fillBg: 'bg-cyan-500',
      fillGlow: 'shadow-[0_0_15px_rgba(6,182,212,0.5)]',
      textAccent: 'text-cyan-400',
      trackBorder: 'border-cyan-500/30',
    },
  }[colorTheme]

  const percentDisplay = Math.round(internalValue * 100)

  return (
    <div className={`flex flex-col items-center select-none touch-none ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      {/* HUD de Percentual no topo do pedal */}
      {showPercent && (
        <div className="h-5 flex items-center justify-center mb-1">
          <span
            className={`font-mono text-[11px] font-black tracking-tight ${
              internalValue > 0.02 ? themeStyles.textAccent : 'text-zinc-600'
            }`}
          >
            {percentDisplay}%
          </span>
        </div>
      )}

      {/* Corpo do Pedal Interativo */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`${widthClass} ${heightClass} relative rounded-xl border-2 cursor-grab active:cursor-grabbing flex flex-col justify-end p-1.5 transition-colors overflow-hidden ${
          internalValue > 0.05
            ? `${themeStyles.borderActive} bg-zinc-900/80 ${themeStyles.glow}`
            : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700'
        }`}
        style={{
          boxShadow: internalValue > 0.05 ? undefined : 'inset 0 2px 6px rgba(0,0,0,0.8)',
        }}
      >
        {/* Preenchimento contínuo de intensidade de 0% a 100% */}
        <div
          className={`absolute inset-x-0 bottom-0 ${themeStyles.fillBg} transition-[height] duration-75 ease-out opacity-25`}
          style={{ height: `${internalValue * 100}%` }}
        />

        {/* Linha brilhante do topo do preenchimento */}
        {internalValue > 0.02 && (
          <div
            className={`absolute inset-x-0 h-1 ${themeStyles.fillBg} ${themeStyles.fillGlow} pointer-events-none`}
            style={{ bottom: `${internalValue * 100}%` }}
          />
        )}

        {/* Textura metálica antiderrapante do pedal */}
        <div className="relative z-10 flex flex-col items-center justify-between w-full h-full py-2 pointer-events-none opacity-60">
          <div className="w-4/5 h-1 bg-zinc-600/60 rounded-full" />
          <div className="w-4/5 h-1 bg-zinc-600/60 rounded-full" />
          <div className="w-4/5 h-1 bg-zinc-600/60 rounded-full" />
          <div className="w-4/5 h-1 bg-zinc-600/60 rounded-full" />
          <div className="w-4/5 h-1 bg-zinc-600/60 rounded-full" />
        </div>

        {/* Rótulo do pedal */}
        <div className="relative z-10 text-center w-full pb-1 pointer-events-none">
          <span className="text-[10px] font-black font-mono tracking-wider block text-white/90">
            {label}
          </span>
          {sublabel && (
            <span className="text-[8px] font-mono block text-zinc-500 uppercase leading-none">
              {sublabel}
            </span>
          )}
        </div>
      </div>

      {/* Mini indicador em régua inferior */}
      <div className={`w-full bg-zinc-950 h-1.5 rounded-full mt-2 overflow-hidden border border-white/5`}>
        <div
          className={`h-full ${themeStyles.fillBg} transition-all duration-75`}
          style={{ width: `${internalValue * 100}%` }}
        />
      </div>
    </div>
  )
})
