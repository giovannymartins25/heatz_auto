import { memo } from 'react'
import type { VehicleCategory } from '@/types'

type FilterOption = 'all' | VehicleCategory

interface CategoryFilterProps {
  active: FilterOption
  onChange: (filter: FilterOption) => void
}

const FILTERS: { value: FilterOption; label: string; icon: string }[] = [
  { value: 'all', label: 'Todos', icon: '🏁' },
  { value: 'car', label: 'Carros', icon: '🚗' },
  { value: 'motorcycle', label: 'Motos', icon: '🏍️' },
]

/**
 * CategoryFilter — Filtros de categoria com pills animados.
 */
export const CategoryFilter = memo(function CategoryFilter({
  active,
  onChange,
}: CategoryFilterProps) {
  return (
    <div className="flex gap-2 w-full max-w-sm overflow-x-auto no-scrollbar">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-full)] text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
            active === filter.value
              ? 'bg-[var(--color-accent)] text-white shadow-[0_0_12px_var(--color-accent-muted)]'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent-muted)]'
          }`}
        >
          <span>{filter.icon}</span>
          {filter.label}
        </button>
      ))}
    </div>
  )
})

export type { FilterOption }
