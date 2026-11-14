import { memo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useDeviceTilt } from '@/hooks/useDeviceTilt'
import { InteractiveSteeringWheel } from './InteractiveSteeringWheel'
import type { VehicleConfig } from '@/types/vehicle'

export interface SteeringControlZoneProps {
  vehicle: VehicleConfig
  compact?: boolean
  variant?: 'full' | 'hud-bar'
  className?: string
}

/**
 * SteeringControlZone — Zona de controle de esterço responsiva para mobile.
 * 
 * Alterna dinamicamente entre:
 * - Modo TOUCH: Volante interativo para arrastar com os dedos.
 * - Modo TILT: Direção por giroscópio/inclinação do smartphone com HUD de horizonte e calibração rápida.
 */
export const SteeringControlZone = memo(function SteeringControlZone({
  vehicle,
  compact = false,
  variant = 'full',
  className = '',
}: SteeringControlZoneProps) {
  const steeringMethod = useSimulationStore((s) => s.steeringMethod)
  const steeringAngle = useSimulationStore((s) => s.steeringAngle)
  const setSteeringMethod = useSimulationStore((s) => s.setSteeringMethod)

  const {
    isSupported,
    permission,
    requestPermission,
    calibrateNeutral,
    calibratedAngleDeg,
    isCalibrated,
  } = useDeviceTilt()

  const handleToggleMethod = async () => {
    if (steeringMethod === 'touch') {
      if (permission === 'prompt') {
        const granted = await requestPermission()
        if (!granted) return
      }
      setSteeringMethod('tilt')
    } else {
      setSteeringMethod('touch')
    }
  }

  const steerPercent = Math.round(Math.abs(steeringAngle) * 100)
  const steerDirection = steeringAngle < -0.02 ? 'ESQ' : steeringAngle > 0.02 ? 'DIR' : 'CENTRO'

  // ─── VARIANTE HUD-BAR: Barra horizontal discreta para cockpits ───
  if (variant === 'hud-bar') {
    return (
      <div className={`flex items-center gap-1.5 p-1 rounded-xl bg-zinc-950/85 border border-white/10 backdrop-blur-md select-none shadow-lg z-20 ${className}`}>
        {/* Alternador de Método */}
        <button
          type="button"
          onClick={handleToggleMethod}
          className={`h-6 px-2 rounded-lg border font-mono text-[7.5px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm flex items-center gap-1 ${
            steeringMethod === 'tilt'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
              : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
          }`}
          title="Alternar entre volante touch e inclinação do celular"
        >
          <span>{steeringMethod === 'tilt' ? '📱 INCLINAÇÃO' : '🛞 VOLANTE'}</span>
        </button>

        {/* HUD de Horizonte no modo Tilt */}
        {steeringMethod === 'tilt' ? (
          <>
            {/* Balanço visual de inclinação */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-zinc-900/90 border border-white/10 text-[7px] font-mono">
              <span className={`text-[8px] ${steeringAngle < -0.02 ? 'text-cyan-400 font-bold' : 'text-zinc-600'}`}>◄</span>
              <div className="relative w-12 h-1.5 rounded-full bg-zinc-800 overflow-hidden border border-white/5">
                {/* Linha do centro */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-zinc-500" />
                {/* Ponto de esterço */}
                <div
                  className="absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.9)] transition-all duration-75"
                  style={{ left: `${Math.max(5, Math.min(95, 50 + steeringAngle * 45))}%` }}
                />
              </div>
              <span className={`text-[8px] ${steeringAngle > 0.02 ? 'text-cyan-400 font-bold' : 'text-zinc-600'}`}>►</span>
              <span className="font-bold text-cyan-300 ml-0.5">
                {steerDirection === 'CENTRO' ? '0°' : `${steerPercent}%`}
              </span>
            </div>

            {/* Botão de Calibração Neutra */}
            <button
              type="button"
              onClick={calibrateNeutral}
              className={`h-6 px-1.5 rounded-lg border font-mono text-[7px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm flex items-center gap-1 ${
                isCalibrated
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                  : 'bg-amber-500/20 text-amber-300 border-amber-400 animate-pulse'
              }`}
              title="Calibrar posição atual como centro neutro"
            >
              <span>🎯</span>
              <span>{isCalibrated ? 'CALIBRADO' : 'CALIBRAR'}</span>
            </button>
          </>
        ) : (
          <div className="text-[7.5px] font-mono text-zinc-400 px-1">
            Gire tocando ou via Teclado [A/D]
          </div>
        )}

        {/* Feedback caso sensor esteja indisponível */}
        {steeringMethod === 'tilt' && !isSupported && (
          <span className="text-[7px] font-mono text-red-400 px-1">⚠️ Sem sensor</span>
        )}
        {steeringMethod === 'tilt' && permission === 'denied' && (
          <span className="text-[7px] font-mono text-amber-400 px-1">⚠️ Permissão negada</span>
        )}
      </div>
    )
  }

  // ─── VARIANTE FULL: Volante completo com HUD ───
  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* Botões superiores de modo e calibração rápida */}
      <div className="flex items-center gap-1.5 mb-1 z-10">
        <button
          type="button"
          onClick={handleToggleMethod}
          className={`px-2 py-0.5 rounded-full border font-mono text-[8px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm flex items-center gap-1 ${
            steeringMethod === 'tilt'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
              : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
          }`}
          title="Alternar entre volante touch e inclinação do celular"
        >
          <span>{steeringMethod === 'tilt' ? '📱 INCLINAÇÃO' : '🛞 VOLANTE'}</span>
        </button>

        {steeringMethod === 'tilt' && (
          <button
            type="button"
            onClick={calibrateNeutral}
            className={`px-2 py-0.5 rounded-full border font-mono text-[8px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm flex items-center gap-1 ${
              isCalibrated
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                : 'bg-amber-500/20 text-amber-300 border-amber-400 animate-pulse'
            }`}
            title="Calibrar posição atual como centro neutro"
          >
            <span>🎯</span>
            <span>{isCalibrated ? 'CALIBRADO' : 'CALIBRAR'}</span>
          </button>
        )}
      </div>

      {/* Exibição se o sensor for rejeitado ou não suportado no modo Tilt */}
      {steeringMethod === 'tilt' && !isSupported && (
        <div className="text-center p-2 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-[9px] font-mono mb-1 max-w-[170px]">
          Sensor não disponível neste dispositivo.
        </div>
      )}

      {steeringMethod === 'tilt' && permission === 'denied' && (
        <div className="text-center p-2 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[9px] font-mono mb-1 max-w-[170px]">
          Permissão do giroscópio negada no navegador.
        </div>
      )}

      {/* Volante / HUD Visual */}
      <div className="relative flex items-center justify-center">
        {/* Arco de Horizonte / Telemetria de Inclinação no modo TILT */}
        {steeringMethod === 'tilt' && (
          <div className="absolute -inset-3 rounded-full border border-cyan-500/20 pointer-events-none flex items-center justify-center">
            {/* Marcador de zero central superior */}
            <div className="absolute -top-1 w-1.5 h-2 bg-cyan-400 rounded-sm shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            
            {/* Indicador de ângulo e direção */}
            <div className="absolute -bottom-4 bg-zinc-950/90 border border-cyan-500/30 px-2 py-0.5 rounded-full text-[7.5px] font-mono font-bold text-cyan-300 flex items-center gap-1 shadow">
              <span>{steerDirection}</span>
              <span>{steerPercent}%</span>
              <span className="text-zinc-500">({calibratedAngleDeg > 0 ? `+${calibratedAngleDeg}` : calibratedAngleDeg}°)</span>
            </div>
          </div>
        )}

        {/* Volante Interativo */}
        <InteractiveSteeringWheel
          vehicle={vehicle}
          compact={compact}
          className="transition-transform duration-75"
        />
      </div>
    </div>
  )
})
