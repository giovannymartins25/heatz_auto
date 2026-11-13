import { memo, useState } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import type { SessionEntryMode } from '@/stores/useSessionStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore } from '@/stores/useUIStore'
import { useGarageStore, type GarageCarInstance } from '@/stores/useGarageStore'
import { useInteriorAccessories } from '@/hooks/useInteriorAccessories'
import { AnalogPedal } from '@/components/controls/AnalogPedal'
import { GearShift } from '@/components/controls/GearShift'
import { QuickClutchButton, MobileStartButton, DrivingModesSelector, VerticalGestureShifter } from '@/components/controls'
import { DrivingMapViewport } from './DrivingMapViewport'
import { SwipeableClusterMediaSlot } from './SwipeableClusterMediaSlot'
import { MobileQuickMenu } from './MobileQuickMenu'
import { formatZeroToHundredSeconds } from '@/systems/vehicle'
import { formatVehicleHeaderInfo, getShortVehicleName } from '@/utils/vehicleSpecs'
import { getVehicleCapabilities } from '@/types'
import { BackfireFlameFlash, RainWindshieldEffect } from '@/components/effects'
import { BurnoutSmokeEffect } from '@/components/effects/BurnoutSmokeEffect'
import { EngineBlownSmokeEffect } from '@/components/effects/EngineBlownSmokeEffect'
import { TuningGarageModal, DynoTestModal } from '@/components/tuning'
import { DragStripTree } from './DragStripTree'

export interface MobileLandscapeCockpitProps {
  telemetry: DashboardTelemetry
  vehicle: VehicleConfig
  onBack: () => void
  carInstance?: GarageCarInstance
  entryMode?: SessionEntryMode
}

/**
 * MobileLandscapeCockpit — Cockpit horizontal responsivo para dispositivos móveis (Fase 1.5).
 *
 * Características principais:
 * - Separação estrita dos modos PAINEL vs DIRIGIR decidida na Garagem.
 * - Em modo PAINEL: Foco 100% no cluster original do veículo, sem mapa e sem pedais,
 *   com alternância para multimídia por swipe horizontal ou botão pill.
 * - Em modo DIRIGIR: Cockpit completo:
 *   · Mapa superior amplo e centralizado com proporções corretas.
 *   · Slot inferior idêntico compartilhado entre o painel original e a central multimídia via swipe.
 *   · Pedais à esquerda com alturas seguras para Android (sem corte inferior).
 *   · Câmbio, freio de mão e botão START à direita com alturas compactas anti-corte.
 *   · Reivindicação total do espaço lateral ocupado anteriormente pelas abas.
 *   · Remoção da barra de aviso fixa de troca de marcha (shift light no cluster preservada).
 *   · Sessão persistente sem botão de retorno para PAINEL durante a condução.
 */
export const MobileLandscapeCockpit = memo(function MobileLandscapeCockpit({
  telemetry,
  vehicle,
  onBack,
  carInstance,
  entryMode = 'drive',
}: MobileLandscapeCockpitProps) {
  const isDriveMode = entryMode !== 'cluster'

  const throttle = useSimulationStore((s) => s.throttle)
  const throttleLock = useSimulationStore((s) => s.throttleLock)
  const toggleThrottleLock = useSimulationStore((s) => s.toggleThrottleLock)
  const brake = useSimulationStore((s) => s.brake)
  const clutchPosition = useSimulationStore((s) => s.clutchPosition)
  const setThrottle = useSimulationStore((s) => s.setThrottle)
  const setBrake = useSimulationStore((s) => s.setBrake)
  const setClutch = useSimulationStore((s) => s.setClutch)

  const isRunning = useSimulationStore((s) => s.isRunning)
  const tcsEnabled = useSimulationStore((s) => s.tcsEnabled)
  const setTcsEnabled = useSimulationStore((s) => s.setTcsEnabled)
  const setHorn = useSimulationStore((s) => s.setHorn)
  const handbrake = useSimulationStore((s) => s.handbrake)
  const toggleHandbrake = useSimulationStore((s) => s.toggleHandbrake)
  const last0to100 = useSimulationStore((s) => s.last0to100)
  const isTiming0to100 = useSimulationStore((s) => s.isTiming0to100)
  const hasTurbo = useSimulationStore((s) => s.hasTurbo)
  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const hasNosKit = useSimulationStore((s) => s.hasNosKit)
  const nosActive = useSimulationStore((s) => s.nosActive)
  const nosPressurePercent = useSimulationStore((s) => s.nosPressurePercent)
  const setNosActive = useSimulationStore((s) => s.setNosActive)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isTuningOpen, setIsTuningOpen] = useState(false)
  const [isDragStripOpen, setIsDragStripOpen] = useState(false)
  const [isDynoOpen, setIsDynoOpen] = useState(false)

  const hasClutch = vehicle.transmission.hasClutch ?? false
  const isMotorcycle = vehicle.info.category === 'motorcycle'
  const resolveInstanceForVehicle = useGarageStore((s) => s.resolveInstanceForVehicle)
  const activeCar = carInstance || resolveInstanceForVehicle(vehicle.id)
  const { showAftermarketBoostGauge } = useInteriorAccessories(vehicle)
  const mapViewportSize = useUIStore((s) => s.mapViewportSize)
  const setMapViewportSize = useUIStore((s) => s.setMapViewportSize)
  const vehicleHeader = formatVehicleHeaderInfo(vehicle)
  const shortName = getShortVehicleName(vehicle)
  const caps = getVehicleCapabilities(vehicle)
  const isManualActive = telemetry.gear.transmissionMode === 'manual_simulated' || telemetry.gear.gearSelectorPosition === 'M'

  return (
    <div
      className="fixed inset-0 w-full h-full bg-zinc-950 text-white flex flex-col select-none touch-none overflow-hidden z-40"
      style={{
        paddingLeft: 'max(0.35rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.35rem, env(safe-area-inset-right))',
        paddingTop: 'max(0.25rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* ═══ CORPO PRINCIPAL ═══ */}
      <div className="flex-1 flex min-h-0 w-full relative">
        {/* Aviso flutuante de Launch Control (não empurra o layout) */}
        {(isLaunchControlArmed || isLaunching) && (
          <div className="absolute top-1 inset-x-0 z-30 pointer-events-none flex justify-center">
            <div className={`py-0.5 px-3 rounded-full text-[9px] font-mono font-black shadow-lg ${
              isLaunchControlArmed ? 'bg-amber-500 text-black animate-pulse' : 'bg-emerald-500 text-black'
            }`}>
              {isLaunchControlArmed ? '🏁 LAUNCH CONTROL ATIVO · SOLTE O FREIO!' : '🚀 LARGADA!'}
            </div>
          </div>
        )}

        {/* ═══ 1. ESQUERDA: MENU + IDENTIFICAÇÃO CURTA (topo) · PEDAIS (base, só no modo DIRIGIR) ═══ */}
        <aside className="flex flex-col justify-between items-start h-full pt-0 pb-0.5 pr-1.5 border-r border-white/5 flex-shrink-0 gap-1">
          <div className="flex items-center gap-1.5 min-w-0" data-vehicle-id>
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="relative w-8 h-8 flex-shrink-0 rounded-lg bg-zinc-900 border border-white/15 hover:bg-zinc-800 text-zinc-100 text-sm flex items-center justify-center active:scale-95 cursor-pointer shadow"
              aria-label="Abrir menu e garagem"
              title="Menu e garagem (Esc)"
            >
              ☰
              {tuningStage > 0 && (
                <span className="absolute -top-1 -right-1 px-1 rounded bg-amber-500 text-black text-[6.5px] font-black font-mono">
                  S{tuningStage}
                </span>
              )}
            </button>
            <span
              className="text-[9px] font-black font-mono tracking-wider text-zinc-400 whitespace-nowrap"
              title={`${vehicleHeader.title} · ${vehicleHeader.specsSummary}`}
            >
              {shortName}
            </span>
          </div>
          {isDriveMode && (
          <div className="flex items-end justify-center gap-1.5 sm:gap-2 min-h-0">
            {hasClutch && (
              <div className="flex flex-col items-center justify-end gap-1 h-full">
                <QuickClutchButton
                  layout="stack"
                  className="w-12 sm:w-13 h-9 sm:h-10 flex-shrink-0"
                  label={isMotorcycle ? 'MANETE' : 'EMBR'}
                  sublabel="100%"
                />
                <AnalogPedal
                  label={isMotorcycle ? 'MANETE' : 'EMBR'}
                  sublabel={isMotorcycle ? 'EMBREAGEM' : 'CLUTCH'}
                  value={clutchPosition}
                  onChange={setClutch}
                  colorTheme="amber"
                  widthClass="w-12 sm:w-13"
                  heightClass="h-28 sm:h-32"
                  disabled={false}
                  showPercent={true}
                />
              </div>
            )}

            <AnalogPedal
              label={isMotorcycle ? 'F. TRAS' : 'FREIO'}
              sublabel={isMotorcycle ? 'TRASEIRO' : 'BRAKE'}
              value={brake}
              onChange={setBrake}
              colorTheme="red"
              widthClass="w-12 sm:w-13"
              heightClass="h-32 sm:h-36"
              disabled={false}
              showPercent={true}
            />

            <div className="flex flex-col items-center justify-end h-full">
              <button
                type="button"
                onClick={toggleThrottleLock}
                onPointerDown={(e) => { e.stopPropagation() }}
                onTouchStart={(e) => { e.stopPropagation() }}
                style={{ touchAction: 'none' }}
                className={`w-12 sm:w-13 py-0.5 mb-1 rounded-lg font-mono text-[7.5px] font-black uppercase tracking-wider border transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-0.5 shadow-sm ${
                  throttleLock
                    ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.85)] animate-pulse'
                    : 'bg-zinc-900/90 text-zinc-400 border-white/10 hover:text-white'
                }`}
                title="Travar acelerador em 100% (solta ao pisar no freio)"
              >
                <span>{throttleLock ? '🔒' : '🔓'}</span>
                <span>{throttleLock ? 'TRAV' : 'TRAVA'}</span>
              </button>
              <AnalogPedal
                label={isMotorcycle ? 'PUNHO' : 'ACEL'}
                sublabel={isMotorcycle ? 'ACELERAR' : 'GAS'}
                value={throttle}
                onChange={setThrottle}
                colorTheme="accent"
                widthClass="w-12 sm:w-13"
                heightClass="h-28 sm:h-32"
                disabled={false}
                showPercent={true}
              />
            </div>
          </div>
          )}
        </aside>

        {/* ═══ 2. CENTRO: MAPA SUPERIOR + SLOT INFERIOR (PAINEL ↔ MULTIMÍDIA) ═══ */}
        <main className={`relative flex-1 flex flex-col items-center min-w-0 h-full ${isDriveMode ? 'px-1 sm:px-1.5' : 'px-1'}`}>
          {isDriveMode ? (
            <div className="flex-1 flex min-h-0 w-full h-full flex-col gap-0.5 overflow-hidden self-stretch items-center">
              {/* 1. MAPA DE CONDUÇÃO — PARTE SUPERIOR DA REGIÃO CENTRAL */}
              <div
                className={`w-full min-h-0 flex items-center justify-center transition-all duration-200 ${
                  mapViewportSize === 'compact'
                    ? 'h-[30%] flex-shrink-0'
                    : mapViewportSize === 'expanded'
                    ? 'h-[58%] flex-shrink-0'
                    : 'h-[44%] flex-shrink-0'
                }`}
              >
                <DrivingMapViewport
                  size={mapViewportSize}
                  onSizeChange={setMapViewportSize}
                  telemetry={telemetry}
                />
              </div>

              {/* 2. SLOT INFERIOR RESPONSIVO: PAINEL ORIGINAL (<VehicleDashboardCluster telemetry={telemetry} />) ↔ MULTIMÍDIA VIA SWIPE */}
              <div className="w-full flex-1 flex items-center justify-center min-h-0 self-stretch relative">
                <SwipeableClusterMediaSlot
                  telemetry={telemetry}
                  vehicle={vehicle}
                  expanded={false}
                  supportsPaddleShifters={caps.supportsPaddleShifters} /* AutomaticShiftButton direction="down" e AutomaticShiftButton direction="up" */
                  isManualActive={isManualActive}
                  hasTurbo={hasTurbo}
                  showAftermarketBoostGauge={showAftermarketBoostGauge}
                  boostPressureBar={boostPressureBar}
                />
              </div>
            </div>
          ) : (
            /* MODO PAINEL: Foco exclusivo no painel do veículo, ocupando todo o espaço com swipe para multimídia */
            <div className="w-full h-full flex items-center justify-center min-h-0 self-stretch relative">
              <SwipeableClusterMediaSlot
                telemetry={telemetry}
                vehicle={vehicle}
                expanded={true}
                supportsPaddleShifters={caps.supportsPaddleShifters}
                isManualActive={isManualActive}
                hasTurbo={hasTurbo}
                showAftermarketBoostGauge={showAftermarketBoostGauge}
                boostPressureBar={boostPressureBar}
              />
            </div>
          )}
        </main>

        {/* ═══ 3. DIREITA: CONTROLES (BUZINA/TCS no topo alinhado ao mapa · CÂMBIO · START) ═══ */}
        <aside className={`flex flex-col items-stretch justify-between h-full pt-0 pb-0.5 pl-1.5 border-l border-white/5 flex-shrink-0 gap-1 ${isDriveMode ? 'w-[124px] sm:w-[140px]' : 'w-auto min-w-[88px]'}`}>
        {/* Direita superior: [ 📢 ] [ TCS ] em cima, 0–100 no meio, e botão NOS abaixo */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0 w-full">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onPointerDown={() => setHorn(true)}
              onPointerUp={() => setHorn(false)}
              onPointerLeave={() => setHorn(false)}
              onPointerCancel={() => setHorn(false)}
              className="w-7 h-7 rounded-full bg-zinc-900 border border-white/15 active:bg-amber-500/20 active:border-amber-400 flex items-center justify-center text-xs transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Buzina (H)"
              aria-label="Buzina"
            >
              📢
            </button>

            {vehicle.transmission.tcs?.enabled && (
              <button
                type="button"
                onClick={() => setTcsEnabled(!tcsEnabled)}
                aria-pressed={tcsEnabled}
                title={tcsEnabled ? 'Desativar controle de tração (TCS)' : 'Ativar controle de tração (TCS)'}
                className={`w-9 h-9 rounded-full border font-mono font-black leading-none flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 shadow-sm ${
                  !tcsEnabled
                    ? 'bg-zinc-900 text-zinc-500 border-zinc-700 opacity-75'
                    : telemetry.tcs.intervening
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.45)] animate-pulse'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/60'
                }`}
              >
                <span className="text-[8px] sm:text-[8.5px]">TCS</span>
                <span className="text-[6px] sm:text-[6.5px] opacity-85">{tcsEnabled ? 'ON' : 'OFF'}</span>
              </button>
            )}
          </div>

          <div
            aria-label="Cronômetro 0 a 100 km/h"
            className={`px-1.5 sm:px-2 py-0.5 rounded-full bg-zinc-900/95 border text-[7.5px] sm:text-[8px] font-mono leading-none flex items-center gap-1 whitespace-nowrap shadow-sm ${
              isTiming0to100 ? 'border-amber-400/60 text-amber-300' : 'border-white/10 text-zinc-400'
            }`}
          >
            <span>0–100</span>
            <b className={last0to100 !== null ? 'text-amber-400 font-black' : 'text-zinc-500 font-bold'}>
              {formatZeroToHundredSeconds(last0to100)}
            </b>
          </div>

          {/* Botão NOS oficial reposicionado abaixo do 0–100 */}
          {hasNosKit && (
            <button
              type="button"
              onPointerDown={() => setNosActive(true)}
              onPointerUp={() => setNosActive(false)}
              onPointerLeave={() => setNosActive(false)}
              onPointerCancel={() => setNosActive(false)}
              disabled={nosPressurePercent <= 0 || !isRunning}
              className={`h-5 sm:h-6 px-2 rounded-full border font-mono text-[7.5px] sm:text-[8px] font-black uppercase flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm ${
                nosActive
                  ? 'bg-cyan-400 text-black border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.9)] animate-pulse'
                  : nosPressurePercent <= 0
                  ? 'bg-zinc-900/50 text-zinc-600 border-zinc-800'
                  : 'bg-cyan-950/70 text-cyan-300 border-cyan-500/50 hover:border-cyan-400'
              }`}
              title="Segure para disparar Nitro (+120 CV)"
              aria-label="Disparar Nitro NOS"
            >
              <span>NOS</span>
              <span>{Math.round(nosPressurePercent)}%</span>
            </button>
          )}
        </div>
          {isDriveMode && (
            <>
              {/* Topo: Moto Freio dianteiro */}
              {isMotorcycle && (
                <button
                  type="button"
                  onPointerDown={() => setBrake(1)}
                  onPointerUp={() => setBrake(0)}
                  onPointerLeave={() => setBrake(0)}
                  onPointerCancel={() => setBrake(0)}
                  className="h-9 rounded-xl border border-red-400/50 bg-red-950/50 font-mono text-[8.5px] font-black text-red-200 active:bg-red-500/40"
                  aria-label="Manete de freio dianteiro"
                >
                  F. DIANTEIRO
                </button>
              )}
  
              {/* Meio: Perfis de Condução & Câmbio */}
              <div className="flex-1 flex flex-col items-center justify-center gap-1 min-h-0 w-full py-0.5">
                {caps.supportedDrivingModes.length > 1 && (
                  <DrivingModesSelector
                    supportedModes={caps.supportedDrivingModes}
                    orientation="grid"
                    size="compact"
                    showTitle={true}
                    className="w-full"
                  />
                )}
                <div className="flex items-center justify-center gap-1.5">
                  <GearShift orientation="vertical" size="compact" showPaddles={false} />
                  {caps.manualShiftControls.includes('gear_selector_gesture') && isManualActive && (
                    <VerticalGestureShifter size="compact" />
                  )}
                </div>
              </div>
  
              {/* Base: Freio de mão + START — alturas compactas anti-corte */}
              <div className="grid grid-cols-2 gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={toggleHandbrake}
                  className={`h-11 rounded-xl border font-mono font-black uppercase leading-none flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm ${
                    handbrake
                      ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.8)]'
                      : 'bg-zinc-900 border-white/10 text-zinc-400'
                  }`}
                  aria-label="Freio de mão"
                >
                  <span className="text-[11px] sm:text-xs">(P)</span>
                  <span className="text-[6.5px] sm:text-[7px] mt-0.5">{handbrake ? 'PUXADO' : 'F. MÃO'}</span>
                </button>
                <MobileStartButton variant="square" className="h-11 w-full rounded-xl" />
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ── Efeitos & Modais ── */}
      <BackfireFlameFlash />
      <RainWindshieldEffect />
      <BurnoutSmokeEffect />
      <EngineBlownSmokeEffect />

      <MobileQuickMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        vehicle={vehicle}
        onOpenDragStrip={() => setIsDragStripOpen(true)}
        onOpenDyno={() => setIsDynoOpen(true)}
        onOpenTuning={() => setIsTuningOpen(true)}
        onExit={onBack}
      />

      {isDragStripOpen && <DragStripTree onClose={() => setIsDragStripOpen(false)} />}
      {isDynoOpen && (
        <DynoTestModal config={vehicle} upgrades={activeCar?.upgrades} onClose={() => setIsDynoOpen(false)} />
      )}
      {isTuningOpen && (
        <TuningGarageModal
          isOpen={true}
          onClose={() => setIsTuningOpen(false)}
          vehicle={vehicle}
          carInstance={activeCar}
        />
      )}
    </div>
  )
})
