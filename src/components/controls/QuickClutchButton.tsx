import { memo, useState, useRef } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'

export interface QuickClutchButtonProps {
  className?: string
  size?: 'compact' | 'normal' | 'large'
  /** 'row' = ícone + texto lado a lado | 'stack' = texto empilhado (colunas estreitas) */
  layout?: 'row' | 'stack'
  label?: string
  sublabel?: string
}

/**
 * QuickClutchButton — Botão rápido de acionamento 100% da embreagem para mobile.
 *
 * Facilita a pilotagem em telas touch:
 * - Segurar (Hold): Mantém a embreagem 100% pressionada (desacoplada) enquanto o dedo estiver no botão
 * - Soltar (Release): Solta a embreagem instantaneamente para arrancadas e trocas de marcha
 * - Toque Rápido (Tap): Pressiona 100% e solta em 120ms para trocas sequenciais ágeis sem arranhar
 */
export const QuickClutchButton = memo(function QuickClutchButton({
  className = '',
  size = 'normal',
  layout = 'row',
  label = 'EMBR',
  sublabel = '100%',
}: QuickClutchButtonProps) {
  const isRunning = useSimulationStore((s) => s.isRunning)
  const clutchPosition = useSimulationStore((s) => s.clutchPosition)
  const setClutch = useSimulationStore((s) => s.setClutch)
  const [isHolding, setIsHolding] = useState(false)
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const downTimeRef = useRef<number>(0)

  const isFullyPressed = isHolding || clutchPosition >= 0.85

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isRunning) return

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current)
      tapTimeoutRef.current = null
    }

    downTimeRef.current = Date.now()
    setIsHolding(true)
    setClutch(1.0)
    HapticFeedback.light()
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isHolding) return

    const holdDuration = Date.now() - downTimeRef.current
    setIsHolding(false)

    if (holdDuration < 130) {
      // Toque rápido: mantém 100% de embreagem por 140ms para dar tempo de engatar a marcha
      tapTimeoutRef.current = setTimeout(() => {
        setClutch(0.0)
        tapTimeoutRef.current = null
      }, 140)
    } else {
      // Soltura de segurar: solta instantaneamente
      setClutch(0.0)
      HapticFeedback.light()
    }
  }

  const handlePointerCancel = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current)
      tapTimeoutRef.current = null
    }
    setIsHolding(false)
    setClutch(0.0)
  }

  const sizeClasses = {
    compact: 'h-9 px-2 text-[8.5px]',
    normal: 'h-11 px-3 text-[10px]',
    large: 'h-13 px-4 text-xs',
  }[size]

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      style={{ touchAction: 'none' }}
      className={`relative select-none touch-none rounded-2xl font-mono font-black uppercase tracking-wider flex items-center justify-center transition-all active:scale-95 cursor-pointer border-2 shadow-lg ${
        layout === 'stack' ? 'flex-col gap-0.5 px-1 text-[10px]' : `gap-1.5 ${sizeClasses}`
      } ${
        isFullyPressed
          ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-black border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.8)] scale-98'
          : 'bg-gradient-to-b from-zinc-900 to-black text-amber-400 border-amber-500/40 hover:border-amber-400'
      } ${className}`}
      title="Segure ou toque para acionar 100% da embreagem instantaneamente"
      aria-label="Embreagem 100%"
    >
      {layout === 'stack' ? (
        <>
          <span className="text-[12px] leading-none font-black">{label}</span>
          <span className="text-[10px] leading-none font-black">{sublabel}</span>
          <span
            className={`text-[6.5px] font-sans tracking-normal leading-none mt-0.5 ${
              isFullyPressed ? 'text-black font-bold' : 'text-zinc-400'
            }`}
          >
            {isFullyPressed ? 'SOLTA' : 'SEGURE'}
          </span>
        </>
      ) : (
        <>
          <span className="text-xs">⚡</span>
          <div className="flex flex-col items-start text-left leading-tight">
            <span className="font-mono font-black tracking-tight">{label} {sublabel}</span>
            <span
              className={`text-[7px] font-sans tracking-normal opacity-80 ${
                isFullyPressed ? 'text-black font-bold' : 'text-zinc-400'
              }`}
            >
              {isFullyPressed ? 'DESACOPLADA' : 'SEGURE P/ TROCAR'}
            </span>
          </div>
        </>
      )}
    </button>
  )
})
