import { memo } from 'react'
import { formatGear } from '@/utils/format'

interface GearIndicatorProps {
  gear: number
}

/**
 * GearIndicator — Indicador digital da marcha atual.
 *
 * Exibe a marcha atual em tamanho grande, ideal para visualização rápida.
 * Destaca o Neutro (N) em verde e a Ré (R) em vermelho.
 */
export const GearIndicator = memo(function GearIndicator({ gear }: GearIndicatorProps) {
  const displayGear = formatGear(gear)
  const isNeutral = gear === 0
  const isReverse = gear === -1

  const colorClass = isNeutral
    ? 'text-green-500 border-green-500/20 bg-green-500/5'
    : isReverse
    ? 'text-red-500 border-red-500/20 bg-red-500/5'
    : 'text-gradient border-[var(--color-accent-muted)] bg-[var(--color-accent-muted)]/5'

  return (
    <div className="flex flex-col items-center justify-center">
      <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--color-text-muted)] mb-1">
        Marcha
      </span>
      <div
        className={`w-16 h-16 rounded-[var(--radius-md)] flex items-center justify-center text-3xl font-mono font-black border transition-all duration-150 ${colorClass}`}
        style={{
          boxShadow: isNeutral
            ? '0 0 15px rgba(34, 197, 94, 0.1)'
            : isReverse
            ? '0 0 15px rgba(239, 68, 68, 0.1)'
            : '0 0 15px var(--color-accent-muted)',
        }}
      >
        {displayGear}
      </div>
    </div>
  )
})
