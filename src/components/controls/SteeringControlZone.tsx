import { memo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore } from '@/stores/useUIStore'
import { useDeviceTilt } from '@/hooks/useDeviceTilt'
import type { VehicleConfig } from '@/types/vehicle'

export interface SteeringControlZoneProps {
  vehicle?: VehicleConfig
  compact?: boolean
  className?: string
}

/**
 * SteeringControlZone — Indicador discreto de direção por inclinação física (Mobile Tilt Steering).
 *
 * No HEATZ AUTO, o smartphone funciona como o próprio volante físico:
 * - Não exibe volante virtual na interface mobile.
 * - Ocultar o indicador visual (`showTiltIndicator = false`) NÃO desativa o listener do sensor,
 *   pois `useDeviceTilt()` é mantido montado antes do retorno visual nulo.
 */
export const SteeringControlZone = memo(function SteeringControlZone({
  className = '',
}: SteeringControlZoneProps) {
  const showTiltIndicator = useUIStore((s) => s.showTiltIndicator)
  const steeringAngle = useSimulationStore((s) => s.steeringAngle)
  const steeringInvertDirection = useSimulationStore((s) => s.steeringInvertDirection)

  const {
    isSupported,
    requiresPermissionPrompt,
    permission,
    requestPermission,
    calibrateNeutral,
    calibratedAngleDeg,
    isCalibrated,
  } = useDeviceTilt()

  // Se o usuário optou por ocultar no Menu Rápido, não exibe o HUD visual,
  // mas o sensor de inclinação acima (useDeviceTilt) permanece 100% ativo na escuta física.
  if (!showTiltIndicator) {
    return null
  }

  const steerPercent = Math.round(Math.abs(steeringAngle) * 100)
  const steerDirection = steeringAngle < -0.02 ? 'ESQ' : steeringAngle > 0.02 ? 'DIR' : 'CENTRO'

  return (
    <div
      data-testid="steering-control-zone"
      className={`flex flex-wrap items-center justify-center gap-1 max-w-full p-1 rounded-xl bg-zinc-950/85 border border-white/10 backdrop-blur-md select-none shadow-lg z-20 ${className}`}
    >
      {/* Badge identificador do modo inclinação física */}
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-zinc-900 border border-white/10 text-cyan-400 font-mono text-[7.5px] font-black uppercase tracking-wider shrink-0">
        <span>📱</span>
        <span className="hidden sm:inline">INCLINAÇÃO</span>
        <span className="sm:hidden">TILT</span>
        {steeringInvertDirection && (
          <span className="rounded bg-amber-500/25 px-1 text-[6.5px] text-amber-300">INV</span>
        )}
      </div>

      {/* Balanço visual de inclinação de horizonte */}
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-zinc-900/90 border border-white/10 text-[7px] font-mono shrink-0">
        <span
          data-testid="tilt-arrow-left"
          className={`text-[8px] ${steeringAngle < -0.02 ? 'text-cyan-400 font-bold' : 'text-zinc-600'}`}
        >
          ◄
        </span>
        <div className="relative w-10 sm:w-12 h-1.5 rounded-full bg-zinc-800 overflow-hidden border border-white/5">
          {/* Linha do centro neutro */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-zinc-500" />
          {/* Ponto indicador de esterço */}
          <div
            className="absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.9)] transition-all duration-75"
            style={{ left: `${Math.max(5, Math.min(95, 50 + steeringAngle * 45))}%` }}
          />
        </div>
        <span
          data-testid="tilt-arrow-right"
          className={`text-[8px] ${steeringAngle > 0.02 ? 'text-cyan-400 font-bold' : 'text-zinc-600'}`}
        >
          ►
        </span>
        <span className="font-bold text-cyan-300 ml-0.5 min-w-[26px] text-right">
          {steerDirection === 'CENTRO' ? '0°' : `${steerPercent}%`}
        </span>
      </div>

      {/* Botão de Calibração Neutra Rápida */}
      <button
        type="button"
        onClick={calibrateNeutral}
        className={`h-6 px-1.5 sm:px-2 rounded-lg border font-mono text-[7px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm flex items-center gap-1 shrink-0 ${
          isCalibrated
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
            : 'bg-amber-500/20 text-amber-300 border-amber-400 animate-pulse'
        }`}
        title="Calibrar posição atual do smartphone como centro neutro (0°)"
      >
        <span>🎯</span>
        <span>{isCalibrated ? `${calibratedAngleDeg}° OK` : 'CALIBRAR'}</span>
      </button>

      {/* Feedback caso permissão ou sensor requeiram atenção (botão iOS exclusivo para WebKit c/ requestPermission) */}
      {!isSupported && (
        <span className="text-[7px] font-mono text-red-400 px-1">⚠️ Sem sensor</span>
      )}
      {isSupported && permission === 'denied' && (
        <span className="text-[7px] font-mono text-amber-400 px-1">⚠️ Negado</span>
      )}
      {isSupported && requiresPermissionPrompt && permission === 'prompt' && (
        <button
          type="button"
          onClick={requestPermission}
          className="h-6 px-1.5 rounded-lg border border-cyan-400/60 bg-cyan-500/20 text-cyan-200 font-mono text-[7px] font-black uppercase active:scale-95 cursor-pointer shrink-0"
          title="Permitir acesso aos sensores no Safari/iOS"
        >
          🔒 ATIVAR
        </button>
      )}
    </div>
  )
})
