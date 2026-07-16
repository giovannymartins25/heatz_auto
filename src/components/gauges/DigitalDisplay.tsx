import { memo } from 'react'
import { formatRpm, formatSpeed } from '@/utils/format'

interface DigitalDisplayProps {
  rpm: number
  speed: number
  isRevLimiting: boolean
}

/**
 * DigitalDisplay — Painel numérico auxiliar digital.
 *
 * Exibe a velocidade e o RPM atuais de forma textual/digital estilizada
 * com fonte monoespacada JetBrains Mono. Adiciona efeito de flash vermelho
 * se o motor estiver no corte de giros (rev limiter).
 */
export const DigitalDisplay = memo(function DigitalDisplay({
  rpm,
  speed,
  isRevLimiting,
}: DigitalDisplayProps) {
  return (
    <div
      className={`glass rounded-[var(--radius-lg)] p-4 flex justify-around items-center w-full max-w-sm transition-colors duration-75 ${
        isRevLimiting ? 'border-red-500 bg-red-950/20' : 'border-white/5'
      }`}
    >
      {/* Bloco de Velocidade */}
      <div className="flex flex-col items-center">
        <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--color-text-muted)] mb-0.5">
          Velocidade
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-mono font-bold tracking-tight text-white">
            {formatSpeed(speed)}
          </span>
          <span className="text-xs font-mono text-[var(--color-text-secondary)]">km/h</span>
        </div>
      </div>

      {/* Divisor vertical */}
      <div className="w-[1px] h-10 bg-white/10" />

      {/* Bloco de RPM */}
      <div className="flex flex-col items-center">
        <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--color-text-muted)] mb-0.5">
          Giro do Motor
        </span>
        <div className="flex items-baseline gap-1">
          <span
            className={`text-3xl font-mono font-bold tracking-tight transition-colors ${
              isRevLimiting ? 'text-red-500 animate-pulse' : 'text-[var(--color-text-primary)]'
            }`}
          >
            {formatRpm(rpm)}
          </span>
          <span className="text-xs font-mono text-[var(--color-text-secondary)]">rpm</span>
        </div>
      </div>
    </div>
  )
})
