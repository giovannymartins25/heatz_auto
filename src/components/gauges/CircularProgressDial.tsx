import { memo, useId } from 'react'
import { clamp } from '@/utils/math'

export interface CircularProgressDialProps {
  value: number
  max: number
  min?: number
  label?: string
  subLabel?: string
  unit: string
  color?: string
  trackColor?: string
  glowColor?: string
  sizeClassName?: string
  formatValue?: (val: number) => string | number
  active?: boolean
  className?: string
  compact?: boolean
  fill?: boolean
}

/**
 * CircularProgressDial — Mostrador circular analógico-digital de alta precisão.
 *
 * Geometria rigorosa:
 * - viewBox: 0 0 100 100 (vetorial 100% responsivo)
 * - Centro: (50, 50), Raio: 38
 * - Arco esportivo clássico de 270° de varredura: Inicia a 135° (7:30h) e termina a 405° (4:30h)
 * - Comprimento total do arco: L = 179.07 px
 * - Traçado com strokeDasharray estritamente delimitado de 0 a L
 * - clipPath e overflow-hidden garantem contenção absoluta (vazamento zero)
 * - Ocultação do cap a 0% para eliminar ponto residual com carro parado
 * - Travamento estrito a 100% mesmo em picos de aceleração ou overboost
 */
export const CircularProgressDial = memo(function CircularProgressDial({
  value,
  max,
  min = 0,
  label,
  subLabel,
  unit,
  color = '#ef4444',
  trackColor = '#27272a',
  glowColor,
  sizeClassName,
  formatValue,
  active = true,
  className = '',
  compact = false,
  fill = false,
}: CircularProgressDialProps) {
  const clipId = useId()

  const safeMax = max > min ? max : min + 1
  const ratio = clamp((value - min) / (safeMax - min), 0, 1)
  const totalArcLen = 179.07
  const activeArcLen = ratio * totalArcLen

  const displayVal = formatValue ? formatValue(value) : Math.round(value)

  const resolvedSizeClass =
    sizeClassName ||
    (compact || fill
      ? 'w-[52px] h-[52px] sm:w-[68px] sm:h-[68px]'
      : 'w-[76px] h-[76px]')

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {label && (
        <span className="text-[6.5px] sm:text-[7px] font-bold uppercase tracking-widest mb-0.5 text-zinc-400">
          {label}
        </span>
      )}

      <div
        className={`relative flex flex-col items-center justify-center rounded-full bg-zinc-900/95 border border-white/10 shadow-inner overflow-hidden ${resolvedSizeClass}`}
      >
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full overflow-hidden"
          style={{ clipPath: `url(#${clipId})` }}
        >
          <defs>
            <clipPath id={clipId}>
              <circle cx="50" cy="50" r="48" />
            </clipPath>
          </defs>

          {/* Trilha base de 270° (de 135° a 405°) */}
          <path
            d="M 23.13 76.87 A 38 38 0 1 1 76.87 76.87"
            fill="none"
            stroke={trackColor}
            strokeWidth="4.5"
            strokeLinecap="round"
          />

          {/* Trilha ativa iluminada de 0 a 100% estritamente contida */}
          <path
            d="M 23.13 76.87 A 38 38 0 1 1 76.87 76.87"
            fill="none"
            stroke={color}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={`${activeArcLen.toFixed(1)} ${totalArcLen.toFixed(1)}`}
            strokeDashoffset="0"
            style={{
              opacity: active && ratio > 0.005 ? 1 : 0,
              filter: glowColor ? `drop-shadow(0 0 3px ${glowColor})` : undefined,
            }}
            className="transition-all duration-75"
          />
        </svg>

        {/* Valor digital central e unidade */}
        <span
          className={`${
            compact || fill ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
          } font-black text-white leading-none z-10`}
        >
          {displayVal}
        </span>
        <span className="text-[6.5px] sm:text-[7px] font-bold text-zinc-400 tracking-wider mt-0.5 z-10">
          {unit}
        </span>
      </div>

      {subLabel && (
        <span className="text-[7px] sm:text-[8px] text-zinc-500 font-bold mt-0.5 whitespace-nowrap">
          {subLabel}
        </span>
      )}
    </div>
  )
})
