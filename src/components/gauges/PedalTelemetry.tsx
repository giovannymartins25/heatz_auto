import { memo } from 'react'

interface PedalTelemetryProps {
  throttlePercent: number // 0 a 100
  brakePercent: number    // 0 a 100
  clutchPercent: number | null // null se o veículo não possui embreagem
  hasClutch: boolean
}

/**
 * PedalTelemetry — Barras de telemetria analógica em tempo real para os pedais.
 *
 * Exibe a intensidade exata (0% → 100%) aplicada em:
 * - THROTTLE (Acelerador): verde/ciano vibrante com glow
 * - BRAKE (Freio): vermelho de alta visibilidade
 * - CLUTCH (Embreagem): azul (oculto automaticamente em veículos automáticos como o Yaris)
 */
export const PedalTelemetry = memo(function PedalTelemetry({
  throttlePercent,
  brakePercent,
  clutchPercent,
  hasClutch,
}: PedalTelemetryProps) {
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 p-2 rounded-xl bg-zinc-950/70 border border-white/10 shadow-lg select-none">
      {/* 1. CLUTCH (Apenas veículos manuais) */}
      {hasClutch && clutchPercent !== null && (
        <div className="flex flex-col items-center gap-1 w-14 sm:w-16">
          <div className="flex justify-between w-full text-[9px] font-mono uppercase tracking-wider text-blue-400">
            <span>CLU</span>
            <span className="font-bold">{clutchPercent}%</span>
          </div>
          <div className="w-full h-2.5 sm:h-3 rounded-full bg-zinc-900 border border-blue-500/30 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-75 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
              style={{ width: `${clutchPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* 2. BRAKE */}
      <div className="flex flex-col items-center gap-1 w-14 sm:w-16">
        <div className="flex justify-between w-full text-[9px] font-mono uppercase tracking-wider text-red-400">
          <span>BRK</span>
          <span className="font-bold">{brakePercent}%</span>
        </div>
        <div className="w-full h-2.5 sm:h-3 rounded-full bg-zinc-900 border border-red-500/30 overflow-hidden p-0.5">
          <div
            className="h-full rounded-full bg-red-500 transition-all duration-75 shadow-[0_0_8px_rgba(239,68,68,0.7)]"
            style={{ width: `${brakePercent}%` }}
          />
        </div>
      </div>

      {/* 3. THROTTLE */}
      <div className="flex flex-col items-center gap-1 w-14 sm:w-16">
        <div className="flex justify-between w-full text-[9px] font-mono uppercase tracking-wider text-emerald-400">
          <span>THR</span>
          <span className="font-bold">{throttlePercent}%</span>
        </div>
        <div className="w-full h-2.5 sm:h-3 rounded-full bg-zinc-900 border border-emerald-500/30 overflow-hidden p-0.5">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-75 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
            style={{ width: `${throttlePercent}%` }}
          />
        </div>
      </div>
    </div>
  )
})
