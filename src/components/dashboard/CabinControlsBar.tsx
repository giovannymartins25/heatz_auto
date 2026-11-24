/**
 * CabinControlsBar.tsx — Painel funcional de controles de cabine, climatização,
 * vidros individuais, válvula de escapamento e sinalização (Fases 4.2 e 4.4.1).
 *
 * Projetado para:
 * - Respeitar estritamente os contratos declarativos `VehicleCabinSpec`
 *   (ex.: CB1000R não exibe climatização nem vidros; Gol Quadrado e Opala não exibem botão A/C
 *   nem recirculação; Porsche, Pampa e Gol Quadrado exibem apenas 2 vidros; veículos sem farol
 *   de neblina não exibem o botão de neblina).
 * - Na Fase 4.4.1 (`variant === 'panel'`, Painel 3):
 *   - Os controles de ignição foram removidos do Painel 3 (a ignição permanece exclusivamente
 *     no canto inferior direito do HUD principal via `HudIgnitionControl`).
 *   - O controle de válvula/difusor de escapamento (`exhaustValveOpen` / `toggleExhaustValve`)
 *     está integrado ao Painel 3 reutilizando a `useSimulationStore` sem duplicação de estado.
 */

import { memo, useState } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { resolveVehicleCabin } from '@/systems/vehicle/vehicleResolvers'
import type { FanLevel, WindowId } from '@/systems/cabin'

export interface CabinControlsBarProps {
  vehicle: VehicleConfig
  /** 'desktop' = barra horizontal com gaveta expansível | 'mobile_hud' = pílula compacta com popover flutuante | 'menu' = painel embutido no menu | 'panel' = Painel 3 completo dedicado do cockpit */
  variant?: 'desktop' | 'mobile_hud' | 'menu' | 'panel'
  className?: string
}

const WINDOW_SHORT_LABELS: Readonly<Record<WindowId, string>> = {
  front_left: 'DE (Mot.)',
  front_right: 'DD (Pass.)',
  rear_left: 'TE',
  rear_right: 'TD',
}

export const CabinControlsBar = memo(function CabinControlsBar({
  vehicle,
  variant = 'desktop',
  className = '',
}: CabinControlsBarProps) {
  const cabinSpec = resolveVehicleCabin(vehicle)

  const [activeDrawer, setActiveDrawer] = useState<'none' | 'all' | 'climate' | 'windows'>('none')

  // Bateria / Telemetria Elétrica (somente leitura informativa na cabine)
  const batteryVoltageV = useSimulationStore((s) => s.batteryVoltageV)

  // Escapamento / Difusor (reutiliza estado único da useSimulationStore)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const toggleExhaustValve = useSimulationStore((s) => s.toggleExhaustValve)

  // Iluminação e Sinalização
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const cycleHeadlights = useSimulationStore((s) => s.cycleHeadlights)
  const fogLightsEnabled = useSimulationStore((s) => s.fogLightsEnabled)
  const fogLightsLit = useSimulationStore((s) => s.fogLightsLit)
  const toggleFogLights = useSimulationStore((s) => s.toggleFogLights)
  const leftTurnSignal = useSimulationStore((s) => s.leftTurnSignal)
  const rightTurnSignal = useSimulationStore((s) => s.rightTurnSignal)
  const hazardLights = useSimulationStore((s) => s.hazardLights)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const hazardIndicatorLit = useSimulationStore((s) => s.hazardIndicatorLit)
  const toggleLeftTurnSignal = useSimulationStore((s) => s.toggleLeftTurnSignal)
  const toggleRightTurnSignal = useSimulationStore((s) => s.toggleRightTurnSignal)
  const toggleHazardLights = useSimulationStore((s) => s.toggleHazardLights)

  // Climatização
  const ambientTempC = useSimulationStore((s) => s.ambientTempC)
  const cabinTempC = useSimulationStore((s) => s.cabinTempC)
  const climateTargetTempC = useSimulationStore((s) => s.climateTargetTempC)
  const climateAcEnabled = useSimulationStore((s) => s.climateAcEnabled)
  const isCompressorEngaged = useSimulationStore((s) => s.isCompressorEngaged)
  const climateFanLevel = useSimulationStore((s) => s.climateFanLevel)
  const climateAutoMode = useSimulationStore((s) => s.climateAutoMode)
  const climateRecirculation = useSimulationStore((s) => s.climateRecirculation)
  const climateHeaterEnabled = useSimulationStore((s) => s.climateHeaterEnabled)
  const climateDefrosterEnabled = useSimulationStore((s) => s.climateDefrosterEnabled)
  const compressorMechanicalPowerW = useSimulationStore((s) => s.compressorMechanicalPowerW)
  const blowerElectricalPowerW = useSimulationStore((s) => s.blowerElectricalPowerW)
  const toggleClimateAc = useSimulationStore((s) => s.toggleClimateAc)
  const stepClimateTargetTempC = useSimulationStore((s) => s.stepClimateTargetTempC)
  const setClimateFanLevel = useSimulationStore((s) => s.setClimateFanLevel)
  const toggleClimateAutoMode = useSimulationStore((s) => s.toggleClimateAutoMode)
  const toggleClimateRecirculation = useSimulationStore((s) => s.toggleClimateRecirculation)
  const toggleClimateHeater = useSimulationStore((s) => s.toggleClimateHeater)
  const toggleClimateDefroster = useSimulationStore((s) => s.toggleClimateDefroster)

  // Vidros
  const windowPositions = useSimulationStore((s) => s.windowPositions)
  const windowTargets = useSimulationStore((s) => s.windowTargets)
  const windowAverageOpenRatio = useSimulationStore((s) => s.windowAverageOpenRatio)
  const setWindowTarget = useSimulationStore((s) => s.setWindowTarget)
  const toggleWindows = useSimulationStore((s) => s.toggleWindows)

  const hasClimate = cabinSpec.climateType !== 'none'
  const hasAutoClimate =
    cabinSpec.climateType === 'auto_single' ||
    cabinSpec.climateType === 'auto_dual' ||
    cabinSpec.climateType === 'auto_tri'
  const availableWindowIds: WindowId[] =
    cabinSpec.windowCount === 4
      ? ['front_left', 'front_right', 'rear_left', 'rear_right']
      : cabinSpec.windowCount === 2
        ? ['front_left', 'front_right']
        : []

  const stopProp = (e: React.SyntheticEvent) => {
    if (variant !== 'panel') {
      e.stopPropagation()
    }
  }

  const toggleDrawer = (drawer: 'all' | 'climate' | 'windows') => {
    setActiveDrawer((prev) => (prev === drawer ? 'none' : drawer))
  }

  const isCompactPanel = variant === 'panel'

  const renderDetailedControls = () => (
    <div
      className={`flex flex-col ${
        isCompactPanel
          ? 'gap-0.5 rounded-xl border border-white/10 bg-zinc-950/90 p-1 text-white'
          : 'gap-2.5 rounded-2xl border border-white/15 bg-zinc-950/95 p-3 text-white shadow-2xl backdrop-blur-md'
      }`}
      onPointerDown={!isCompactPanel ? stopProp : undefined}
      onTouchStart={!isCompactPanel ? stopProp : undefined}
      style={{ touchAction: isCompactPanel ? 'pan-y' : 'manipulation' }}
      data-testid="cabin-controls-panel"
    >
      {/* 1. CLIMATIZAÇÃO (somente veículos com cabine climatizada/ventilada) */}
      {hasClimate && (
        <div
          className={`rounded-lg border border-white/10 bg-zinc-900/70 ${isCompactPanel ? 'px-1.5 py-0.5' : 'rounded-xl p-2'}`}
          data-testid="cabin-climate-section"
        >
          <div className={`${isCompactPanel ? 'mb-0.5 text-[8px]' : 'mb-1.5 text-[9px]'} flex items-center justify-between font-mono`}>
            <span className="font-black uppercase tracking-wider text-zinc-300">
              ❄️ Clima ({cabinSpec.climateType.replace('_', ' ').toUpperCase()})
            </span>
            <span className="text-zinc-400">
              Ext <b>{ambientTempC.toFixed(0)}°</b> · Cab{' '}
              <b className="text-cyan-300" data-testid="cabin-temp-value">
                {cabinTempC.toFixed(1)}°C
              </b>
              {isCompactPanel && (
                <span className="ml-1 text-[7.5px] text-zinc-500">
                  ({isCompressorEngaged ? `${compressorMechanicalPowerW}W` : `${blowerElectricalPowerW}We`})
                </span>
              )}
            </span>
          </div>

          <div className={`flex flex-wrap items-center justify-between ${isCompactPanel ? 'gap-1' : 'gap-2'}`}>
            {/* Controle de Temperatura Alvo */}
            <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-zinc-950 px-1 py-0.5">
              <button
                type="button"
                data-testid="btn-climate-temp-down"
                onClick={() => stepClimateTargetTempC(-0.5)}
                className={`${isCompactPanel ? 'h-5 w-5 text-[10px]' : 'h-6 w-6 text-xs'} rounded bg-zinc-800 font-mono font-black text-cyan-300 active:scale-90 cursor-pointer`}
                aria-label="Diminuir temperatura da cabine"
              >
                −
              </button>
              <span className={`${isCompactPanel ? 'min-w-[34px] text-[9px]' : 'min-w-[42px] text-[10px]'} text-center font-mono font-black text-white`}>
                {climateTargetTempC.toFixed(1)}°
              </span>
              <button
                type="button"
                data-testid="btn-climate-temp-up"
                onClick={() => stepClimateTargetTempC(0.5)}
                className={`${isCompactPanel ? 'h-5 w-5 text-[10px]' : 'h-6 w-6 text-xs'} rounded bg-zinc-800 font-mono font-black text-amber-300 active:scale-90 cursor-pointer`}
                aria-label="Aumentar temperatura da cabine"
              >
                +
              </button>
            </div>

            {/* Níveis de Ventilação 0..5 */}
            <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-zinc-950 px-1 py-0.5">
              <span className="mr-0.5 font-mono text-[7.5px] font-bold text-zinc-400">VENT</span>
              {([0, 1, 2, 3, 4, 5] as FanLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  data-testid={`btn-climate-fan-${lvl}`}
                  onClick={() => setClimateFanLevel(lvl)}
                  className={`${isCompactPanel ? 'h-5 w-4 text-[8px]' : 'h-6 w-5 text-[9px]'} rounded font-mono font-black transition-all active:scale-90 cursor-pointer ${
                    climateFanLevel === lvl
                      ? 'bg-sky-500 text-black'
                      : lvl > 0 && lvl <= climateFanLevel
                        ? 'bg-sky-500/30 text-sky-200'
                        : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Botões de Funções Disponíveis conforme VehicleCabinSpec */}
            <div className="flex flex-wrap items-center gap-1">
              {cabinSpec.hasAcCompressor && (
                <button
                  type="button"
                  data-testid="btn-climate-ac"
                  onClick={toggleClimateAc}
                  className={`${isCompactPanel ? 'h-5 px-1.5 text-[8px]' : 'h-7 px-2 text-[9px]'} rounded-md border font-mono font-black uppercase active:scale-95 cursor-pointer ${
                    climateAcEnabled
                      ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200'
                      : 'border-white/10 bg-zinc-950 text-zinc-400'
                  }`}
                >
                  A/C{isCompressorEngaged ? ' ●' : ''}
                </button>
              )}

              {hasAutoClimate && (
                <button
                  type="button"
                  data-testid="btn-climate-auto"
                  onClick={toggleClimateAutoMode}
                  className={`${isCompactPanel ? 'h-5 px-1.5 text-[8px]' : 'h-7 px-2 text-[9px]'} rounded-md border font-mono font-black uppercase active:scale-95 cursor-pointer ${
                    climateAutoMode
                      ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                      : 'border-white/10 bg-zinc-950 text-zinc-400'
                  }`}
                >
                  AUTO
                </button>
              )}

              {cabinSpec.hasRecirculation && (
                <button
                  type="button"
                  data-testid="btn-climate-recirc"
                  onClick={toggleClimateRecirculation}
                  className={`${isCompactPanel ? 'h-5 px-1.5 text-[8px]' : 'h-7 px-2 text-[9px]'} rounded-md border font-mono font-black uppercase active:scale-95 cursor-pointer ${
                    climateRecirculation
                      ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                      : 'border-white/10 bg-zinc-950 text-zinc-400'
                  }`}
                >
                  REC
                </button>
              )}

              {cabinSpec.hasHeater && (
                <button
                  type="button"
                  data-testid="btn-climate-heater"
                  onClick={toggleClimateHeater}
                  className={`${isCompactPanel ? 'h-5 px-1.5 text-[8px]' : 'h-7 px-2 text-[9px]'} rounded-md border font-mono font-black uppercase active:scale-95 cursor-pointer ${
                    climateHeaterEnabled
                      ? 'border-orange-400 bg-orange-500/25 text-orange-200'
                      : 'border-white/10 bg-zinc-950 text-zinc-400'
                  }`}
                >
                  AQUEC
                </button>
              )}

              {cabinSpec.hasDefroster && (
                <button
                  type="button"
                  data-testid="btn-climate-defrost"
                  onClick={toggleClimateDefroster}
                  className={`${isCompactPanel ? 'h-5 px-1.5 text-[8px]' : 'h-7 px-2 text-[9px]'} rounded-md border font-mono font-black uppercase active:scale-95 cursor-pointer ${
                    climateDefrosterEnabled
                      ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                      : 'border-white/10 bg-zinc-950 text-zinc-400'
                  }`}
                >
                  DESEMB
                </button>
              )}

              {cabinSpec.hasSeatHeating && (
                <span
                  data-testid="badge-seat-heating"
                  className={`${isCompactPanel ? 'h-5 px-1.5 text-[7.5px]' : 'h-7 px-2 text-[8.5px]'} inline-flex items-center rounded-md border border-orange-500/35 bg-orange-500/15 font-mono font-black text-orange-200 uppercase`}
                  title="Bancos dianteiros aquecidos disponíveis na multimídia / climatização"
                >
                  🔥 BANCOS
                </span>
              )}
            </div>
          </div>

          {!isCompactPanel && (
            <div className="mt-1 flex items-center justify-between text-[8px] font-mono text-zinc-500">
              <span>
                Compressor: <b>{isCompressorEngaged ? `${compressorMechanicalPowerW} W mec` : 'DESACOPLADO'}</b>
              </span>
              <span>
                Ventilação elétrica: <b>{blowerElectricalPowerW} W elét</b>
              </span>
            </div>
          )}
        </div>
      )}

      {/* 2. VIDROS INDIVIDUAIS (somente veículos com windowCount > 0) */}
      {availableWindowIds.length > 0 && (
        <div
          className={`rounded-lg border border-white/10 bg-zinc-900/70 ${isCompactPanel ? 'px-1.5 py-0.5' : 'rounded-xl p-2'}`}
          data-testid="cabin-windows-section"
        >
          <div className={`${isCompactPanel ? 'mb-0.5 text-[8px]' : 'mb-1.5 text-[9px]'} flex items-center justify-between font-mono`}>
            <span className="font-black uppercase tracking-wider text-zinc-300">
              🪟 Vidros ({cabinSpec.windowCount}x ·{' '}
              {cabinSpec.windowControlType === 'electric' ? 'Elét.' : 'Manivela'})
            </span>
            <button
              type="button"
              data-testid="btn-windows-toggle-all"
              onClick={toggleWindows}
              className="rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-px font-mono text-[8px] font-bold text-sky-200 active:scale-95 cursor-pointer"
            >
              {windowAverageOpenRatio > 0.05 ? 'Fechar Todos' : 'Abrir Todos'} ({Math.round(windowAverageOpenRatio * 100)}%)
            </button>
          </div>

          <div className={`grid ${isCompactPanel && availableWindowIds.length === 4 ? 'grid-cols-4' : 'grid-cols-2'} gap-1`}>
            {availableWindowIds.map((winId) => {
              const posPct = Math.round((windowPositions[winId] ?? 0) * 100)
              const targetRatio = windowTargets[winId] ?? 0
              return (
                <div
                  key={winId}
                  className={`flex items-center justify-between rounded border border-white/10 bg-zinc-950 ${
                    isCompactPanel ? 'px-1 py-0.5' : 'px-2 py-1'
                  }`}
                >
                  <div className="leading-none">
                    <span className={`block font-mono font-bold text-zinc-300 ${isCompactPanel ? 'text-[7.5px]' : 'text-[8.5px]'}`}>
                      {isCompactPanel
                        ? winId
                            .replace('front_left', 'DE')
                            .replace('front_right', 'DD')
                            .replace('rear_left', 'TE')
                            .replace('rear_right', 'TD')
                        : WINDOW_SHORT_LABELS[winId]}
                    </span>
                    <span
                      className={`font-mono text-sky-400 ${isCompactPanel ? 'text-[7.5px]' : 'text-[8px]'}`}
                      data-testid={`window-pos-${winId}`}
                    >
                      {posPct}%{isCompactPanel ? '' : ' aberto'}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      data-testid={`btn-window-up-${winId}`}
                      onClick={() => setWindowTarget(winId, Math.max(0, targetRatio - 0.25))}
                      className={`${isCompactPanel ? 'h-4 w-4 text-[8px]' : 'h-6 w-6 text-[10px]'} rounded bg-zinc-800 font-mono font-black text-zinc-200 active:scale-90 cursor-pointer`}
                      title="Subir/fechar vidro (-25%)"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      data-testid={`btn-window-down-${winId}`}
                      onClick={() => setWindowTarget(winId, Math.min(1, targetRatio + 0.25))}
                      className={`${isCompactPanel ? 'h-4 w-4 text-[8px]' : 'h-6 w-6 text-[10px]'} rounded bg-zinc-800 font-mono font-black text-sky-300 active:scale-90 cursor-pointer`}
                      title="Descer/abrir vidro (+25%)"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. VÁLVULA / DIFUSOR DE ESCAPAMENTO E REDE 12V (reutiliza useSimulationStore sem estado paralelo) */}
      <div
        className={`flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/70 ${
          isCompactPanel ? 'px-1.5 py-0.5' : 'rounded-xl p-2'
        }`}
        data-testid="cabin-exhaust-section"
      >
        <div className="flex items-center gap-1.5 font-mono leading-none">
          <span className={`${isCompactPanel ? 'text-[8px]' : 'text-[9px]'} font-black uppercase tracking-wider text-zinc-300`}>
            🔊 Escapamento
          </span>
          <span className="rounded bg-zinc-950 px-1 py-0.5 text-[7.5px] font-mono text-zinc-400">
            Rede <b className="text-emerald-400">{batteryVoltageV.toFixed(1)}V</b>
          </span>
        </div>

        <button
          type="button"
          data-testid="btn-cabin-exhaust-toggle"
          onClick={toggleExhaustValve}
          className={`${
            isCompactPanel ? 'h-5 px-2 text-[8px]' : 'h-7 px-3 text-[9px]'
          } rounded-md border font-mono font-black uppercase transition-all active:scale-95 cursor-pointer ${
            exhaustValveOpen
              ? 'border-amber-400 bg-amber-500/25 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.35)]'
              : 'border-white/10 bg-zinc-950 text-zinc-400 hover:text-white'
          }`}
          title="Alternar difusor/válvula de escapamento (Aberto / Fechado)"
        >
          {exhaustValveOpen ? '⚡ ESCAPE ABERTO' : 'ESCAPE FECHADO'}
        </button>
      </div>
    </div>
  )

  if (variant === 'menu' || variant === 'panel') {
    const isFullPanel = variant === 'panel'
    return (
      <div
        className={`${
          isFullPanel
            ? 'flex h-full w-full min-h-0 flex-col overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/90 px-1 py-0.5'
            : ''
        } ${className}`}
        onPointerDown={!isFullPanel ? stopProp : undefined}
        onTouchStart={!isFullPanel ? stopProp : undefined}
        style={{ touchAction: 'pan-y' }}
        data-testid={isFullPanel ? 'vehicle-controls-panel-root' : undefined}
      >
        {/* Barra rápida de Setas, Pisca-Alerta, Faróis e Neblina */}
        <div className={`mb-0.5 grid ${cabinSpec.hasFogLights ? 'grid-cols-5' : 'grid-cols-4'} gap-1 flex-shrink-0`}>
          <button
            type="button"
            data-testid="btn-turn-left"
            onClick={toggleLeftTurnSignal}
            className={`${isFullPanel ? 'h-5 text-[8px] rounded-md' : 'h-8 text-[9.5px] rounded-xl'} border font-mono font-black transition-all active:scale-95 cursor-pointer ${
              leftIndicatorLit
                ? 'border-emerald-400 bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                : leftTurnSignal
                  ? 'border-emerald-500/60 bg-emerald-950/60 text-emerald-300'
                  : 'border-white/10 bg-zinc-900 text-zinc-300'
            }`}
          >
            ⬅ SETA
          </button>
          <button
            type="button"
            data-testid="btn-hazard"
            onClick={toggleHazardLights}
            className={`${isFullPanel ? 'h-5 text-[8px] rounded-md' : 'h-8 text-[9.5px] rounded-xl'} border font-mono font-black transition-all active:scale-95 cursor-pointer ${
              hazardIndicatorLit
                ? 'border-red-400 bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                : hazardLights
                  ? 'border-red-500/60 bg-red-950/60 text-red-300'
                  : 'border-white/10 bg-zinc-900 text-zinc-300'
            }`}
          >
            ⚠️ ALERTA
          </button>
          <button
            type="button"
            data-testid="btn-turn-right"
            onClick={toggleRightTurnSignal}
            className={`${isFullPanel ? 'h-5 text-[8px] rounded-md' : 'h-8 text-[9.5px] rounded-xl'} border font-mono font-black transition-all active:scale-95 cursor-pointer ${
              rightIndicatorLit
                ? 'border-emerald-400 bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                : rightTurnSignal
                  ? 'border-emerald-500/60 bg-emerald-950/60 text-emerald-300'
                  : 'border-white/10 bg-zinc-900 text-zinc-300'
            }`}
          >
            SETA ➡
          </button>
          <button
            type="button"
            data-testid="btn-panel-headlights"
            onClick={cycleHeadlights}
            className={`${isFullPanel ? 'h-5 text-[8px] rounded-md' : 'h-8 text-[9.5px] rounded-xl'} border font-mono font-black transition-all active:scale-95 cursor-pointer ${
              headlightsMode !== 'off'
                ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                : 'border-white/10 bg-zinc-900 text-zinc-400'
            }`}
          >
            💡 {headlightsMode.toUpperCase()}
          </button>
          {cabinSpec.hasFogLights && (
            <button
              type="button"
              data-testid="btn-fog-lights"
              onClick={toggleFogLights}
              className={`${isFullPanel ? 'h-5 text-[8px] rounded-md' : 'h-8 text-[9.5px] rounded-xl'} border font-mono font-black uppercase transition-all active:scale-95 cursor-pointer ${
                fogLightsLit
                  ? 'border-amber-400 bg-amber-500/30 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.45)]'
                  : 'border-white/10 bg-zinc-900 text-zinc-400'
              }`}
            >
              🌫️ NEBL
            </button>
          )}
        </div>

        {renderDetailedControls()}
      </div>
    )
  }

  return (
    <div
      className={`relative flex flex-col items-center ${className}`}
      onPointerDown={stopProp}
      onTouchStart={stopProp}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Barra compacta de acesso imediato (Setas, Alerta, Luzes, A/C, Vidros e Escape) */}
      <div className="flex flex-wrap items-center justify-center gap-1 rounded-full border border-white/10 bg-zinc-950/85 px-2 py-1 shadow-lg">
        <button
          type="button"
          data-testid="btn-turn-left"
          onClick={toggleLeftTurnSignal}
          aria-label="Seta esquerda"
          className={`h-6 px-2 rounded-full border font-mono text-[9px] font-black transition-all active:scale-95 cursor-pointer ${
            leftIndicatorLit
              ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.9)]'
              : leftTurnSignal
                ? 'border-emerald-500/60 bg-emerald-950/70 text-emerald-300'
                : 'border-white/10 bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          ⬅
        </button>

        <button
          type="button"
          data-testid="btn-hazard"
          onClick={toggleHazardLights}
          aria-label="Pisca-alerta"
          className={`h-6 px-2 rounded-full border font-mono text-[9px] font-black transition-all active:scale-95 cursor-pointer ${
            hazardIndicatorLit
              ? 'border-red-300 bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.9)]'
              : hazardLights
                ? 'border-red-500/60 bg-red-950/70 text-red-300'
                : 'border-white/10 bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          ⚠️
        </button>

        <button
          type="button"
          data-testid="btn-turn-right"
          onClick={toggleRightTurnSignal}
          aria-label="Seta direita"
          className={`h-6 px-2 rounded-full border font-mono text-[9px] font-black transition-all active:scale-95 cursor-pointer ${
            rightIndicatorLit
              ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.9)]'
              : rightTurnSignal
                ? 'border-emerald-500/60 bg-emerald-950/70 text-emerald-300'
                : 'border-white/10 bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          ➡
        </button>

        {cabinSpec.hasFogLights && (
          <button
            type="button"
            data-testid="btn-fog-lights"
            onClick={toggleFogLights}
            className={`h-6 px-2 rounded-full border font-mono text-[8.5px] font-bold uppercase transition-all active:scale-95 cursor-pointer ${
              fogLightsLit
                ? 'border-amber-400 bg-amber-500/25 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                : fogLightsEnabled
                  ? 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                  : 'border-white/10 bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
            title="Farol de Neblina"
          >
            🌫️ NEBL
          </button>
        )}

        <button
          type="button"
          data-testid="btn-cabin-drawer-toggle"
          onClick={() => toggleDrawer('all')}
          className={`h-6 px-2.5 rounded-full border font-mono text-[8.5px] font-black uppercase transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
            activeDrawer !== 'none'
              ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200'
              : 'border-white/15 bg-zinc-900 text-zinc-300 hover:text-white'
          }`}
        >
          <span>🎛️</span>
          <span>CABINE</span>
          {hasClimate && (
            <>
              <span className="opacity-40">·</span>
              <span>{cabinTempC.toFixed(0)}°C</span>
              {climateAcEnabled && <span className="text-cyan-300">❄️</span>}
            </>
          )}
          {availableWindowIds.length > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span>🪟{Math.round(windowAverageOpenRatio * 100)}%</span>
            </>
          )}
        </button>
      </div>

      {activeDrawer !== 'none' && (
        <div
          className={`${
            variant === 'mobile_hud'
              ? 'fixed left-1/2 top-11 z-50 w-[min(94vw,440px)] -translate-x-1/2'
              : 'mt-2 w-full max-w-2xl'
          }`}
        >
          {renderDetailedControls()}
        </div>
      )}
    </div>
  )
})
