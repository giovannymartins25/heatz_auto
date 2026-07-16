import { memo } from 'react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

/**
 * SearchBar — Barra de busca minimalista com ícone de lupa.
 * Busca em tempo real sem debounce (lista pequena).
 */
export const SearchBar = memo(function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative w-full max-w-sm">
      {/* Ícone de lupa */}
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar veículo..."
        className="w-full pl-10 pr-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-muted)] transition-colors"
        id="vehicle-search"
      />
    </div>
  )
})
