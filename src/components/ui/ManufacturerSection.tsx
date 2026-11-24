import { memo } from 'react'

export interface ManufacturerSectionProps {
  brand: string
  countLabel: string
  children: React.ReactNode
  className?: string
}

export const BRAND_THEME_COLORS: Record<
  string,
  { border: string; text: string; bg: string; accent: string; glow: string; badgeBg: string }
> = {
  volkswagen: {
    accent: '#0ea5e9',
    border: 'border-sky-500/30',
    text: 'text-sky-400',
    bg: 'from-sky-950/40 via-zinc-900/10 to-transparent',
    glow: 'rgba(14, 165, 233, 0.3)',
    badgeBg: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  },
  porsche: {
    accent: '#d4af37',
    border: 'border-amber-400/30',
    text: 'text-amber-300',
    bg: 'from-amber-950/40 via-zinc-900/10 to-transparent',
    glow: 'rgba(212, 175, 55, 0.3)',
    badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-400/30',
  },
  honda: {
    accent: '#ef4444',
    border: 'border-red-500/30',
    text: 'text-red-400',
    bg: 'from-red-950/40 via-zinc-900/10 to-transparent',
    glow: 'rgba(239, 68, 68, 0.3)',
    badgeBg: 'bg-red-500/10 text-red-300 border-red-500/30',
  },
  fiat: {
    accent: '#dc2626',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    bg: 'from-rose-950/40 via-zinc-900/10 to-transparent',
    glow: 'rgba(220, 38, 38, 0.3)',
    badgeBg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  },
  chevrolet: {
    accent: '#f59e0b',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    bg: 'from-amber-950/40 via-zinc-900/10 to-transparent',
    glow: 'rgba(245, 158, 11, 0.3)',
    badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  },
  toyota: {
    accent: '#e11d48',
    border: 'border-rose-600/30',
    text: 'text-rose-300',
    bg: 'from-rose-950/40 via-zinc-900/10 to-transparent',
    glow: 'rgba(225, 29, 72, 0.3)',
    badgeBg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  },
  bmw: {
    accent: '#38bdf8',
    border: 'border-cyan-500/30',
    text: 'text-cyan-300',
    bg: 'from-cyan-950/40 via-blue-950/20 to-transparent',
    glow: 'rgba(56, 189, 248, 0.32)',
    badgeBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  },
  ford: {
    accent: '#3b82f6',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
    bg: 'from-blue-950/45 via-zinc-900/10 to-transparent',
    glow: 'rgba(59, 130, 246, 0.32)',
    badgeBg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  },
}

export function getBrandTheme(brand: string) {
  const key = brand.toLowerCase().trim()
  return (
    BRAND_THEME_COLORS[key] || {
      accent: '#ef4444',
      border: 'border-white/10',
      text: 'text-white',
      bg: 'from-zinc-900/50 via-zinc-900/10 to-transparent',
      glow: 'rgba(255, 255, 255, 0.15)',
      badgeBg: 'bg-zinc-800 text-zinc-300 border-white/10',
    }
  )
}

/**
 * ManufacturerSection — Seção de agrupamento vertical por fabricante inspirada no Forza Horizon.
 * Exibe cabeçalho imponente com nome da marca, acento cromático característico e badge com contagem de veículos.
 */
export const ManufacturerSection = memo(function ManufacturerSection({
  brand,
  countLabel,
  children,
  className = '',
}: ManufacturerSectionProps) {
  const theme = getBrandTheme(brand)

  return (
    <section className={`flex flex-col gap-2.5 sm:gap-3.5 mb-6 sm:mb-8 last:mb-2 ${className}`}>
      {/* ─── Faixa do Fabricante Estilo Forza Horizon ─── */}
      <div
        className={`relative px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r ${theme.bg} border-b ${theme.border} flex items-center justify-between gap-2 overflow-hidden shadow-sm`}
      >
        {/* Barra lateral e Nome da Marca */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div
            className="w-1.5 sm:w-2 h-5 sm:h-7 rounded-full shrink-0"
            style={{ backgroundColor: theme.accent, boxShadow: `0 0 12px ${theme.glow}` }}
          />
          <h2 className="text-sm sm:text-base md:text-lg font-black uppercase tracking-wider text-white truncate flex items-center gap-2">
            <span>{brand}</span>
          </h2>
        </div>

        {/* Badge da Contagem de Máquinas / Modelos */}
        <div
          className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[9.5px] font-mono font-bold uppercase tracking-wider border shrink-0 ${theme.badgeBg}`}
        >
          {countLabel}
        </div>
      </div>

      {/* ─── Grid de Veículos deste Fabricante ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4 lg:gap-5">
        {children}
      </div>
    </section>
  )
})
