export type AmbientLightColor = 'red' | 'blue' | 'amber' | 'white' | 'cyan' | 'purple' | 'green'

export interface AmbientColorConfig {
  id: AmbientLightColor
  name: string
  carSpec: string
  hex: string
  borderClass: string
  shadowClass: string
  headerBorderClass: string
  glowRgba: string
  accentTextClass: string
  haloGradient: string
}

export const AMBIENT_COLOR_MAP: Record<AmbientLightColor, AmbientColorConfig> = {
  red: {
    id: 'red',
    name: 'VERMELHO GTI',
    carSpec: 'GTI Performance / Guards Red',
    hex: '#ef4444',
    borderClass: 'border-red-600/50',
    shadowClass: 'shadow-[0_20px_70px_rgba(239,68,68,0.25)]',
    headerBorderClass: 'border-red-600/30',
    glowRgba: 'rgba(239, 68, 68, 0.45)',
    accentTextClass: 'text-red-400',
    haloGradient: 'from-transparent via-red-500/80 to-transparent',
  },
  blue: {
    id: 'blue',
    name: 'AZUL GOLF R',
    carSpec: 'Golf R / Shark Blue',
    hex: '#3b82f6',
    borderClass: 'border-blue-600/50',
    shadowClass: 'shadow-[0_20px_70px_rgba(59,130,246,0.25)]',
    headerBorderClass: 'border-blue-600/30',
    glowRgba: 'rgba(59, 130, 246, 0.45)',
    accentTextClass: 'text-blue-400',
    haloGradient: 'from-transparent via-blue-500/80 to-transparent',
  },
  amber: {
    id: 'amber',
    name: 'ÂMBAR PORSCHE',
    carSpec: 'Clubsport / Speed Yellow',
    hex: '#f59e0b',
    borderClass: 'border-amber-500/50',
    shadowClass: 'shadow-[0_20px_70px_rgba(245,158,11,0.25)]',
    headerBorderClass: 'border-amber-500/30',
    glowRgba: 'rgba(245, 158, 11, 0.45)',
    accentTextClass: 'text-amber-400',
    haloGradient: 'from-transparent via-amber-400/80 to-transparent',
  },
  white: {
    id: 'white',
    name: 'BRANCO PURO',
    carSpec: 'Pure Ice White',
    hex: '#ffffff',
    borderClass: 'border-zinc-300/40',
    shadowClass: 'shadow-[0_20px_70px_rgba(255,255,255,0.2)]',
    headerBorderClass: 'border-zinc-400/30',
    glowRgba: 'rgba(255, 255, 255, 0.35)',
    accentTextClass: 'text-zinc-100',
    haloGradient: 'from-transparent via-white/80 to-transparent',
  },
  cyan: {
    id: 'cyan',
    name: 'AZUL GELO',
    carSpec: 'Optitron Ice Blue / Miami Blue',
    hex: '#06b6d4',
    borderClass: 'border-cyan-500/50',
    shadowClass: 'shadow-[0_20px_70px_rgba(6,182,212,0.25)]',
    headerBorderClass: 'border-cyan-500/30',
    glowRgba: 'rgba(6, 182, 212, 0.45)',
    accentTextClass: 'text-cyan-400',
    haloGradient: 'from-transparent via-cyan-400/80 to-transparent',
  },
  purple: {
    id: 'purple',
    name: 'ROXO VIOLETA',
    carSpec: 'Ultraviolet Neon',
    hex: '#a855f7',
    borderClass: 'border-purple-500/50',
    shadowClass: 'shadow-[0_20px_70px_rgba(168,85,247,0.25)]',
    headerBorderClass: 'border-purple-500/30',
    glowRgba: 'rgba(168, 85, 247, 0.45)',
    accentTextClass: 'text-purple-400',
    haloGradient: 'from-transparent via-purple-500/80 to-transparent',
  },
  green: {
    id: 'green',
    name: 'VERDE ACID',
    carSpec: 'Porsche Acid Green / Manthey',
    hex: '#10b981',
    borderClass: 'border-emerald-500/50',
    shadowClass: 'shadow-[0_20px_70px_rgba(16,185,129,0.25)]',
    headerBorderClass: 'border-emerald-500/30',
    glowRgba: 'rgba(16, 185, 129, 0.45)',
    accentTextClass: 'text-emerald-400',
    haloGradient: 'from-transparent via-emerald-400/80 to-transparent',
  },
}

