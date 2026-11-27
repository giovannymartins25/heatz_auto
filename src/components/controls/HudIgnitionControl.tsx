import { memo, useRef, useState, useEffect } from 'react'
import type { IgnitionPosition, VehicleConfig } from '@/types/vehicle'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { resolveVehicleIgnition } from '@/systems/vehicle/vehicleResolvers'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'

export interface HudIgnitionControlProps {
  vehicle?: VehicleConfig
  variant?: 'desktop' | 'mobile_portrait' | 'mobile_landscape'
  className?: string
}

const HOLD_TO_STOP_MOVING_MS = 500

/**
 * HudIgnitionControl — Controle unificado de ignição no canto inferior direito do HUD principal (Fase 4.4.1).
 *
 * Respeita estritamente a arquitetura declarativa do veículo (`resolveVehicleIgnition`):
 * - `push_button` (Jetta GLI 2021, BMW 320i 2024, Fusion Titanium 2019, Golf GTI, Porsche GT3, Yaris, Toro Ranch):
 *   exibe botão Start/Stop funcional integrado ao `IgnitionSystem` e `EngineSimulator`, respeitando `startInterlock`.
 * - `key` (Ford Pampa 1997, Ford Fusion SEL 2012, Gol, Civic Si, Opala 4.1, Toro Endurance, CB1000R):
 *   exibe cilindro de chave física com estágios `OFF`, `ACC` (quando suportado), `ON` e `CRANK` (segurar para dar
 *   partida e retornar automaticamente para `ON` ao soltar).
 */
export const HudIgnitionControl = memo(function HudIgnitionControl({
  vehicle,
  variant = 'mobile_landscape',
  className = '',
}: HudIgnitionControlProps) {
  const storeConfig = useSimulationStore((s) => s._config)
  const effectiveVehicle = vehicle ?? storeConfig

  const isRunning = useSimulationStore((s) => s.isRunning)
  const isStalled = useSimulationStore((s) => s.isStalled)
  const status = useSimulationStore((s) => s.status)
  const speed = useSimulationStore((s) => s.speed)
  const brake = useSimulationStore((s) => s.brake)
  const clutchPosition = useSimulationStore((s) => s.clutchPosition)
  const ignitionPosition = useSimulationStore((s) => s.ignitionPosition)
  const ignitionType = useSimulationStore((s) => s.ignitionType)
  const ignitionStartInterlock = useSimulationStore((s) => s.ignitionStartInterlock)
  const ignitionFailureReason = useSimulationStore((s) => s.ignitionFailureReason)

  const pressPushButtonIgnition = useSimulationStore((s) => s.pressPushButtonIgnition)
  const setIgnitionPosition = useSimulationStore((s) => s.setIgnitionPosition)
  const releaseIgnitionKey = useSimulationStore((s) => s.releaseIgnitionKey)
  const stopEngine = useSimulationStore((s) => s.stopEngine)

  const resolvedSpec = effectiveVehicle
    ? resolveVehicleIgnition(effectiveVehicle)
    : {
        type: ignitionType,
        startInterlock: ignitionStartInterlock,
        supportsAccessoryMode: true,
      }

  const [holdStopProgress, setHoldStopProgress] = useState(0)
  const [isHoldingCrank, setIsHoldingCrank] = useState(false)
  const holdStartRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastPressRef = useRef(0)

  const isStarting = status === 'starting'

  const cancelStopHold = () => {
    holdStartRef.current = null
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setHoldStopProgress(0)
  }

  useEffect(() => () => cancelStopHold(), [])

  const interlockSatisfied =
    resolvedSpec.startInterlock === 'none' ||
    (resolvedSpec.startInterlock === 'brake' && brake >= 0.15) ||
    (resolvedSpec.startInterlock === 'clutch' && clutchPosition >= 0.7) ||
    (resolvedSpec.startInterlock === 'brake_or_clutch' && (brake >= 0.15 || clutchPosition >= 0.7))

  const interlockHint =
    resolvedSpec.startInterlock === 'brake'
      ? 'PISE FREIO'
      : resolvedSpec.startInterlock === 'clutch'
        ? 'PISE EMBR.'
        : resolvedSpec.startInterlock === 'brake_or_clutch'
          ? 'FREIO/EMBR'
          : null

  const showInterlockAlert =
    !isRunning &&
    !isStarting &&
    !interlockSatisfied &&
    Boolean(ignitionFailureReason && ignitionFailureReason.toLowerCase().includes('intertravamento'))

  // ─── MODO 1: BOTÃO START/STOP (push_button) ───
  if (resolvedSpec.type === 'push_button') {
    const tickHoldStop = () => {
      if (holdStartRef.current === null) return
      const p = Math.min(1, (performance.now() - holdStartRef.current) / HOLD_TO_STOP_MOVING_MS)
      setHoldStopProgress(p)
      if (p >= 1) {
        HapticFeedback.medium()
        stopEngine()
        cancelStopHold()
        return
      }
      rafRef.current = requestAnimationFrame(tickHoldStop)
    }

    const handlePushDown = (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const now = performance.now()
      if (now - lastPressRef.current < 220) return
      lastPressRef.current = now
      if (isStarting) return

      if (!isRunning) {
        HapticFeedback.heavy()
        pressPushButtonIgnition(true)
        return
      }

      // Parado ou em Desktop: desliga imediatamente; em movimento no mobile: segurar 0.5s evita toque acidental
      if (variant === 'desktop' || speed < 2.0) {
        HapticFeedback.medium()
        stopEngine()
        return
      }

      holdStartRef.current = now
      rafRef.current = requestAnimationFrame(tickHoldStop)
    }

    const handlePushUp = (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      cancelStopHold()
    }

    const isDesktop = variant === 'desktop'

    const theme = isStalled
      ? 'border-amber-400 bg-gradient-to-b from-amber-600/90 to-red-700/90 text-white shadow-[0_0_16px_rgba(245,158,11,0.55)] animate-pulse'
      : isStarting
        ? 'border-cyan-400 bg-cyan-950/90 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.6)] animate-pulse'
        : isRunning
          ? 'border-red-500/70 bg-gradient-to-b from-zinc-900 to-red-950/85 text-red-300'
          : showInterlockAlert
            ? 'border-amber-400 bg-gradient-to-b from-amber-900/90 to-zinc-950 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.45)]'
            : ignitionPosition === 'ACC' || ignitionPosition === 'ON'
              ? 'border-amber-400/80 bg-gradient-to-b from-zinc-800 to-amber-950/70 text-amber-200'
              : 'border-emerald-400 bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-[0_0_14px_rgba(16,185,129,0.5)]'

    const mainLabel = isStalled
      ? 'RELIGAR'
      : isStarting
        ? 'CRANK…'
        : isRunning
          ? 'STOP'
          : 'START'

    const subLabel = isStalled
      ? interlockSatisfied || !interlockHint
        ? 'APAGOU'
        : interlockHint
      : isStarting
        ? 'PARTIDA'
        : isRunning
          ? !isDesktop && speed >= 2.0
            ? 'SEGURE STOP'
            : 'MOTOR ON'
          : showInterlockAlert && interlockHint
            ? `${ignitionPosition} · ${interlockHint}`
            : ignitionPosition !== 'OFF'
              ? `IGN ${ignitionPosition}`
              : interlockHint && !interlockSatisfied
                ? `${interlockHint}`
                : 'ENGINE PUSH'

    return (
      <button
        type="button"
        data-testid="hud-ignition-push-button"
        data-ignition-type="push_button"
        data-ignition-position={ignitionPosition}
        onPointerDown={handlePushDown}
        onPointerUp={handlePushUp}
        onPointerLeave={handlePushUp}
        onPointerCancel={handlePushUp}
        onContextMenu={(e) => e.preventDefault()}
        disabled={isStarting}
        style={{ touchAction: 'none' }}
        aria-label={isRunning ? 'Desligar motor (Start/Stop)' : 'Dar partida no motor (Start/Stop)'}
        className={`relative overflow-hidden select-none touch-none font-mono font-black uppercase transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center ${
          isDesktop
            ? 'w-16 h-16 flex-shrink-0 rounded-full border-2 p-1'
            : 'h-11 w-full rounded-xl border-2 px-1 py-0.5'
        } ${theme} ${className}`}
      >
        {holdStopProgress > 0 && (
          <span
            className="absolute inset-y-0 left-0 bg-red-500/60 pointer-events-none"
            style={{ width: `${holdStopProgress * 100}%` }}
          />
        )}
        <span className="relative flex items-center gap-1 leading-none">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isStalled
                ? 'bg-amber-300'
                : isStarting
                  ? 'bg-cyan-300 animate-ping'
                  : isRunning
                    ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                    : ignitionPosition !== 'OFF'
                      ? 'bg-amber-400'
                      : 'bg-white'
            }`}
          />
          <span className={isDesktop ? 'text-[11px] tracking-wider' : 'text-[10.5px] tracking-wider'}>
            {mainLabel}
          </span>
        </span>
        <span className="relative text-[6.5px] font-bold tracking-tight opacity-90 mt-0.5 leading-none truncate max-w-full">
          {subLabel}
        </span>
      </button>
    )
  }

  // ─── MODO 2: CHAVE FÍSICA NO CILINDRO (key: OFF / ACC / ON + segurar CRANK) ───
  const keyStages: IgnitionPosition[] = resolvedSpec.supportsAccessoryMode
    ? ['OFF', 'ACC', 'ON']
    : ['OFF', 'ON']

  const handleStageSelect = (stage: IgnitionPosition, e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsHoldingCrank(false)
    setIgnitionPosition(stage, true)
  }

  const handleCrankDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isRunning) {
      if (variant === 'desktop' || speed < 2.0) {
        setIgnitionPosition('OFF', true)
      }
      return
    }
    setIsHoldingCrank(true)
    HapticFeedback.heavy()
    setIgnitionPosition('CRANK', true)
  }

  const handleCrankRelease = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isHoldingCrank && ignitionPosition !== 'CRANK') return
    setIsHoldingCrank(false)
    releaseIgnitionKey()
  }

  const isDesktop = variant === 'desktop'
  const isCrankingNow = ignitionPosition === 'CRANK' || isStarting || isHoldingCrank

  return (
    <div
      data-testid="hud-ignition-key-control"
      data-ignition-type="key"
      data-ignition-position={ignitionPosition}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      style={{ touchAction: 'none' }}
      className={`select-none touch-none rounded-xl border border-white/15 bg-zinc-950/95 flex flex-col justify-between shadow-md ${
        isDesktop ? 'w-[138px] flex-shrink-0 p-1.5 gap-1' : 'h-11 w-full px-1 py-0.5 gap-0.5'
      } ${className}`}
    >
      {/* Estágios da chave física: OFF · ACC (quando suportado) · ON */}
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${keyStages.length}, minmax(0, 1fr))` }}>
        {keyStages.map((stage) => {
          const active =
            ignitionPosition === stage || (stage === 'ON' && ignitionPosition === 'CRANK')
          return (
            <button
              key={stage}
              type="button"
              data-testid={`btn-hud-key-${stage.toLowerCase()}`}
              onPointerDown={(e) => handleStageSelect(stage, e)}
              onClick={(e) => handleStageSelect(stage, e)}
              className={`${
                isDesktop ? 'h-5 text-[8px]' : 'h-[15px] text-[6.5px]'
              } rounded font-mono font-black uppercase leading-none transition-all cursor-pointer border ${
                active
                  ? stage === 'ON'
                    ? 'border-emerald-400 bg-emerald-500/30 text-emerald-200'
                    : stage === 'ACC'
                      ? 'border-amber-400 bg-amber-500/30 text-amber-200'
                      : 'border-zinc-400 bg-zinc-700 text-white'
                  : 'border-white/10 bg-zinc-900 text-zinc-500 hover:text-zinc-200'
              }`}
              title={`Girar chave para ${stage}`}
            >
              {stage}
            </button>
          )
        })}
      </div>

      {/* Posição de mola CRANK: segurar para dar partida e retornar para ON ao soltar */}
      <button
        type="button"
        data-testid="btn-hud-key-crank"
        onPointerDown={handleCrankDown}
        onPointerUp={handleCrankRelease}
        onPointerLeave={handleCrankRelease}
        onPointerCancel={handleCrankRelease}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
        aria-label={
          isRunning
            ? 'Motor ligado — toque em OFF para desligar'
            : 'Segure CRANK para girar a chave e dar partida'
        }
        className={`${
          isDesktop ? 'h-7 text-[8.5px]' : 'h-[21px] text-[7px]'
        } w-full rounded-md border font-mono font-black uppercase leading-none flex items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer ${
          isCrankingNow
            ? 'border-cyan-300 bg-cyan-500/35 text-cyan-100 shadow-[0_0_10px_rgba(6,182,212,0.7)] animate-pulse'
            : isRunning
              ? 'border-emerald-500/60 bg-emerald-950/70 text-emerald-300'
              : showInterlockAlert
                ? 'border-amber-400 bg-amber-950/80 text-amber-200'
                : isStalled
                  ? 'border-amber-400 bg-amber-600/30 text-amber-200 animate-pulse'
                  : 'border-amber-400/60 bg-amber-500/20 text-amber-200 hover:border-amber-300'
        }`}
      >
        <span>🔑</span>
        <span className="truncate">
          {isCrankingNow
            ? 'CRANK...'
            : isRunning
              ? speed < 2
                ? 'LIGADO·OFF'
                : 'MOTOR ON'
              : showInterlockAlert && interlockHint
                ? interlockHint
                : 'CRANK ↻'}
        </span>
      </button>
    </div>
  )
})
