import { memo } from 'react'
import type { DrivingMode } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'

export interface DrivingModesSelectorProps {
  supportedModes?: DrivingMode[]
  orientation?: 'horizontal' | 'vertical' | 'grid'
  size?: 'compact' | 'normal'
  showTitle?: boolean
  className?: string
}

interface ModeVisualConfig {
  label: string
  compactLabel: string
  activeClass: string
  inactiveClass: string
  dotClass: string
  title: string
}

const MODE_CONFIGS: Record<DrivingMode, ModeVisualConfig> = {
  eco: {
    label: 'ECO',
    compactLabel: 'ECO',
    // Verde vibrante
    activeClass:
      'bg-emerald-500 text-black border-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.85)] font-black',
    inactiveClass:
      'bg-zinc-900/90 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/60 font-bold',
    dotClass: 'bg-emerald-400',
    title: 'Modo ECO — Resposta suave e máxima economia de combustível',
  },
  normal: {
    label: 'NORMAL',
    compactLabel: 'NORM',
    // Azul vibrante
    activeClass:
      'bg-sky-500 text-white border-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.85)] font-black',
    inactiveClass:
      'bg-zinc-900/90 text-sky-400 border border-sky-500/30 hover:border-sky-500/60 font-bold',
    dotClass: 'bg-sky-400',
    title: 'Modo NORMAL — Calibração equilibrada para condução diária',
  },
  sport: {
    label: 'SPORT',
    compactLabel: 'SPORT',
    // Vermelho vibrante
    activeClass:
      'bg-rose-600 text-white border-rose-300 shadow-[0_0_14px_rgba(225,29,72,0.9)] font-black',
    inactiveClass:
      'bg-zinc-900/90 text-rose-400 border border-rose-500/30 hover:border-rose-500/60 font-bold',
    dotClass: 'bg-rose-500',
    title: 'Modo SPORT — Resposta imediata do acelerador e trocas em giro alto',
  },
  track: {
    label: 'TRACK',
    compactLabel: 'TRACK',
    // Âmbar/Pista vibrante
    activeClass:
      'bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.85)] font-black',
    inactiveClass:
      'bg-zinc-900/90 text-amber-400 border border-amber-500/30 hover:border-amber-500/60 font-bold',
    dotClass: 'bg-amber-400',
    title: 'Modo TRACK — Máxima agressividade mecânica e telemetria de pista',
  },
}

/**
 * DrivingModesSelector — Seletor de Perfis de Condução (ECO, NORMAL, SPORT, TRACK).
 *
 * Requisitos:
 * - ECO: verde
 * - NORMAL: azul
 * - SPORT: vermelho
 * - Integrado ao estado `drivingMode` da store de simulação
 * - Não altera `gearSelectorPosition` (selecionar SPORT nunca altera o câmbio para S)
 * - Posicionado na lateral direita próximo ao seletor de marchas
 */
export const DrivingModesSelector = memo(function DrivingModesSelector({
  supportedModes,
  orientation = 'horizontal',
  size = 'compact',
  showTitle = false,
  className = '',
}: DrivingModesSelectorProps) {
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const setDrivingMode = useSimulationStore((s) => s.setDrivingMode)

  if (!supportedModes || supportedModes.length === 0) {
    return null
  }

  const handleSelectMode = (mode: DrivingMode, e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDrivingMode(mode)
    HapticFeedback.light()
  }

  const isCompact = size === 'compact'

  const containerClasses =
    orientation === 'vertical'
      ? 'flex flex-col gap-1 w-full'
      : orientation === 'grid'
      ? 'grid grid-cols-3 gap-1 w-full'
      : 'flex items-center gap-1'

  const buttonClasses = (mode: DrivingMode, isActive: boolean) => {
    const config = MODE_CONFIGS[mode] || MODE_CONFIGS.normal
    const heightClass = isCompact ? 'h-8' : 'h-9'
    const paddingClass = isCompact ? 'px-2' : 'px-3'
    const fontClass = isCompact ? 'text-[9px]' : 'text-[10px]'

    return `
      relative select-none touch-none rounded-xl uppercase tracking-wider
      flex items-center justify-center transition-all active:scale-95 cursor-pointer border
      ${heightClass} ${paddingClass} ${fontClass}
      ${orientation === 'grid' || orientation === 'vertical' ? 'w-full' : ''}
      ${isActive ? config.activeClass : config.inactiveClass}
    `.trim()
  }

  return (
    <div className={`flex flex-col gap-1 font-mono ${className}`}>
      {showTitle && (
        <div className="flex items-center justify-between px-1 text-[7.5px] font-bold text-zinc-400">
          <span className="text-zinc-500 uppercase tracking-widest">MODO</span>
          <span className="uppercase font-black text-white">
            {MODE_CONFIGS[drivingMode]?.label || drivingMode}
          </span>
        </div>
      )}

      <div className={containerClasses} role="group" aria-label="Perfis de Condução">
        {supportedModes.map((mode) => {
          const config = MODE_CONFIGS[mode] || {
            label: mode.toUpperCase(),
            compactLabel: mode.slice(0, 4).toUpperCase(),
            activeClass: 'bg-white text-black border-white shadow font-black',
            inactiveClass: 'bg-zinc-900 text-zinc-400 border-white/10 font-bold',
            dotClass: 'bg-white',
            title: `Modo ${mode}`,
          }
          const isActive = drivingMode === mode
          const displayLabel = isCompact ? config.compactLabel : config.label

          return (
            <button
              key={mode}
              type="button"
              onClick={(e) => handleSelectMode(mode, e)}
              className={buttonClasses(mode, isActive)}
              title={config.title}
              aria-pressed={isActive}
            >
              <span>{displayLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
})
