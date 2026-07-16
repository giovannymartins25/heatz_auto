import { memo } from 'react'
import { Link } from 'react-router-dom'
import type { VehicleManifestEntry } from '@/types'

interface VehicleCardProps {
  vehicle: VehicleManifestEntry
}

/**
 * VehicleCard — Card de veículo premium para a tela inicial.
 *
 * Exibe nome, marca e categoria com efeito glass e hover interativo.
 * O ícone lateral mostra uma abreviação da marca colorida.
 * 
 * Dados adicionais (potência, torque) serão exibidos quando o
 * manifest for expandido no futuro (Heatz Studio).
 */
export const VehicleCard = memo(function VehicleCard({ vehicle }: VehicleCardProps) {
  const abbreviation = getAbbreviation(vehicle)
  const categoryLabel = vehicle.category === 'car' ? 'Carro' : 'Moto'
  const categoryIcon = vehicle.category === 'car' ? '🚗' : '🏍️'

  return (
    <Link
      to={`/simulator/${vehicle.id}`}
      className="group flex items-center gap-4 p-4 rounded-[var(--radius-lg)] glass hover:border-[var(--color-accent)] transition-all duration-200 hover:shadow-[0_0_20px_var(--color-accent-muted)] active:scale-[0.98]"
      id={`vehicle-card-${vehicle.id}`}
    >
      {/* Ícone do veículo */}
      <div className="w-14 h-14 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-bg-tertiary)] to-[var(--color-bg-elevated)] flex items-center justify-center text-lg font-mono font-black text-[var(--color-accent)] border border-[var(--color-border-subtle)] shrink-0 group-hover:shadow-[0_0_12px_var(--color-accent-muted)] transition-shadow">
        {abbreviation}
      </div>

      {/* Informações do veículo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white truncate group-hover:text-gradient transition-colors">
            {vehicle.name}
          </h3>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
          {vehicle.brand}
        </p>
      </div>

      {/* Badge da categoria */}
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-full)] bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] shrink-0">
        <span className="text-xs">{categoryIcon}</span>
        <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">{categoryLabel}</span>
      </div>

      {/* Seta de navegação */}
      <svg
        className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  )
})

/** Gera abreviação de 2 letras para o ícone do card */
function getAbbreviation(vehicle: VehicleManifestEntry): string {
  const parts = vehicle.name.split(' ')
  if (parts.length >= 2) {
    // "Gol G6" → "G6", "Honda CB1000R" → "CB"
    const second = parts[1]
    if (second.length <= 3) return second.toUpperCase()
    return second.substring(0, 2).toUpperCase()
  }
  return vehicle.name.substring(0, 2).toUpperCase()
}
