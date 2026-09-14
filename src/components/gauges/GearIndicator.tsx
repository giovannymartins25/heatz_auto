import { memo } from 'react'
import { formatGear } from '@/utils/format'
import type { DrivingMode } from '@/types'
import type { TransmissionMode } from '@/stores/useSimulationStore'

interface GearIndicatorProps {
  gear: number
  transmissionMode?: TransmissionMode
  drivingMode?: DrivingMode
  isKickdown?: boolean
  engineStatus?: 'OFF' | 'STARTING' | 'RUNNING' | 'STALLED'
}

/**
 * GearIndicator — Indicador digital da marcha, modo de condução e estado do motor.
 *
 * Exibe fielmente:
 * - Gol Manual: 1, 2, 3, 4, 5, N, R
 * - CB1000R: 1, 2, 3, 4, 5, 6, N
 * - Yaris AUTO: D / D1..D7, N, R com badge do modo (ECO, NORMAL, SPORT)
 * - Yaris MANUAL SIMULATED: M1, M2, M3, M4, M5, M6, M7
 * - Estado real do motor: OFF, STARTING, RUNNING, STALLED
 */
export const GearIndicator = memo(function GearIndicator({
  gear,
  transmissionMode = 'manual',
  drivingMode = 'normal',
  isKickdown = false,
  engineStatus = 'RUNNING',
}: GearIndicatorProps) {
  const isNeutral = gear === 0
  const isReverse = gear === -1
  const isAutomatic = transmissionMode === 'automatic'
  const isManualSimulated = transmissionMode === 'manual_simulated'

  // Formatação da marcha
  let displayGear: string
  if (isNeutral) {
    displayGear = 'N'
  } else if (isReverse) {
    displayGear = 'R'
  } else if (isAutomatic) {
    displayGear = `D${gear > 0 ? gear : ''}`
  } else if (isManualSimulated) {
    displayGear = `M${gear}`
  } else {
    displayGear = formatGear(gear)
  }

  // Estilos de cor da marcha
  const colorClass = isNeutral
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20'
    : isReverse
    ? 'text-red-400 border-red-500/30 bg-red-950/20'
    : isKickdown
    ? 'text-amber-300 border-amber-500/40 bg-amber-950/30'
    : isManualSimulated
    ? 'text-sky-400 border-sky-500/30 bg-sky-950/20'
    : 'text-white border-white/10 bg-zinc-900/50'

  // Label do câmbio
  let modeLabel = 'CÂMBIO MANUAL'
  if (isAutomatic) modeLabel = 'CÂMBIO AUTO'
  else if (isManualSimulated) modeLabel = 'MANUAL SIM'

  // Badge do estado do motor
  const engineBadge = {
    RUNNING: { label: 'RUNNING', class: 'text-emerald-400/90 border-emerald-500/30 bg-emerald-950/40' },
    STARTING: { label: 'STARTING', class: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/50 animate-pulse' },
    STALLED: { label: 'STALLED', class: 'text-amber-400 border-amber-500/50 bg-amber-950/60 animate-bounce' },
    OFF: { label: 'ENGINE OFF', class: 'text-zinc-500 border-zinc-700 bg-zinc-900/40' },
  }[engineStatus]

  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* Rótulo superior do modo de transmissão */}
      <span className="text-[9px] uppercase font-mono tracking-widest text-zinc-400 mb-1">
        {modeLabel}
      </span>

      {/* Caixa central da marcha */}
      <div
        className={`w-20 h-16 sm:w-24 sm:h-18 rounded-xl flex flex-col items-center justify-center border transition-all duration-150 relative shadow-inner ${colorClass}`}
        style={{
          boxShadow: isNeutral
            ? '0 0 15px rgba(16, 185, 129, 0.2)'
            : isReverse
            ? '0 0 15px rgba(239, 68, 68, 0.2)'
            : isKickdown
            ? '0 0 20px rgba(245, 158, 11, 0.4)'
            : isManualSimulated
            ? '0 0 15px rgba(56, 189, 248, 0.3)'
            : '0 0 10px rgba(255, 255, 255, 0.05)',
        }}
      >
        <span className="text-2xl sm:text-3xl font-mono font-black tracking-tight leading-none">
          {displayGear}
        </span>

        {/* Subtítulo: AUTO exibe D — ECO / NORMAL / SPORT */}
        {isAutomatic && !isNeutral && !isReverse && (
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-300 mt-1">
            {drivingMode.toUpperCase()}
          </span>
        )}

        {/* Subtítulo: MANUAL SIMULATED exibe MANUAL */}
        {isManualSimulated && !isNeutral && !isReverse && (
          <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-sky-400/80 mt-1">
            VIRTUAL
          </span>
        )}
      </div>

      {/* Indicador de Estado do Motor */}
      <span
        className={`text-[8px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border mt-1.5 transition-all ${engineBadge.class}`}
      >
        ● {engineBadge.label}
      </span>

      {/* Alerta de Kickdown */}
      {isKickdown && (
        <span className="text-[8px] font-mono font-black uppercase tracking-wider text-amber-400 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded mt-1 animate-pulse">
          ⚡ KICKDOWN
        </span>
      )}
    </div>
  )
})
