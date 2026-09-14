import { memo } from 'react'
import { Link } from 'react-router-dom'
import type { VehicleManifestEntry } from '@/types'

interface VehicleCardProps {
  vehicle: VehicleManifestEntry
}

/**
 * VehicleCard — Card de veículo completo para a tela inicial.
 *
 * Exibe Ano, Marca, Modelo, HP, Torque, Câmbio (com indicação de marchas ou relações simuladas),
 * Modos de condução disponíveis e indicador de TCS.
 */
export const VehicleCard = memo(function VehicleCard({ vehicle }: VehicleCardProps) {
  const abbreviation = getAbbreviation(vehicle)
  const categoryLabel = vehicle.category === 'car' ? 'Carro' : 'Moto'
  const categoryIcon = vehicle.category === 'car' ? '🚗' : '🏍️'

  return (
    <Link
      to={`/simulator/${vehicle.id}`}
      className="group flex flex-col p-4 rounded-[var(--radius-lg)] glass hover:border-[var(--color-accent)] transition-all duration-200 hover:shadow-[0_0_24px_var(--color-accent-muted)] active:scale-[0.98] border border-[var(--color-border-subtle)] relative overflow-hidden"
      id={`vehicle-card-${vehicle.id}`}
    >
      {/* Glow de fundo sutil no hover */}
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-[var(--color-accent)]/5 rounded-full blur-2xl group-hover:bg-[var(--color-accent)]/15 transition-all duration-300 pointer-events-none" />

      {/* Topo do Card: Marca, Ano e Categoria */}
      <div className="flex items-center justify-between w-full mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-bg-tertiary)] to-[var(--color-bg-elevated)] flex items-center justify-center text-sm font-mono font-black text-[var(--color-accent)] border border-[var(--color-border-subtle)] shrink-0 group-hover:shadow-[0_0_12px_var(--color-accent-muted)] transition-shadow">
            {abbreviation}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[var(--color-accent)]">
                {vehicle.brand}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-white/80 font-bold">
                {vehicle.year}
              </span>
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-gradient transition-colors leading-tight">
              {vehicle.name}
            </h3>
          </div>
        </div>

        {/* Badge da Categoria */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-full)] bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] shrink-0">
          <span className="text-xs">{categoryIcon}</span>
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">{categoryLabel}</span>
        </div>
      </div>

      {/* Grade de Especificações Técnicas */}
      <div className="grid grid-cols-2 gap-2 my-2 p-2.5 rounded-lg bg-zinc-950/60 border border-white/5 font-mono text-xs">
        {/* Potência */}
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">Potência</span>
          <span className="font-bold text-white text-sm">
            {typeof vehicle.powerHp === 'number' ? `${vehicle.powerHp} HP` : vehicle.powerHp}
          </span>
        </div>

        {/* Torque */}
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">Torque</span>
          <span className="font-bold text-[var(--color-accent)] text-sm">
            {vehicle.torqueKgfm.toString().replace('.', ',')} kgfm
          </span>
        </div>

        {/* Câmbio */}
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">Câmbio</span>
          <span className="font-semibold text-zinc-300">
            {vehicle.transmissionLabel}
          </span>
        </div>

        {/* Configuração de Operação */}
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">Operação</span>
          <span className="font-semibold text-zinc-300">
            {vehicle.transmissionType === 'cvt'
              ? 'Auto / Manual sim.'
              : vehicle.hasClutchPedal
              ? 'Manual + Embreagem'
              : 'Automático'}
          </span>
        </div>
      </div>

      {/* Rodapé do Card: Tags de Recursos (Modos, TCS, etc.) */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Modos de Condução */}
          {vehicle.supportedModes?.map((mode) => (
            <span
              key={mode}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                mode === 'sport'
                  ? 'bg-red-950/40 border border-red-500/30 text-red-400'
                  : mode === 'eco'
                  ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-800/60 border border-zinc-700/40 text-zinc-300'
              }`}
            >
              {mode}
            </span>
          ))}

          {/* Badge TCS */}
          {vehicle.hasTcs && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-950/40 border border-amber-500/30 text-amber-400">
              TCS
            </span>
          )}
        </div>

        {/* Seta indicativa */}
        <div className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors">
          <span>Pilotar</span>
          <svg
            className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </Link>
  )
})

/** Gera abreviação de 2 letras para o ícone do card */
function getAbbreviation(vehicle: VehicleManifestEntry): string {
  const parts = vehicle.name.split(' ')
  if (parts.length >= 2) {
    const second = parts[1]
    if (second.length <= 3) return second.toUpperCase()
    return second.substring(0, 2).toUpperCase()
  }
  return vehicle.name.substring(0, 2).toUpperCase()
}
