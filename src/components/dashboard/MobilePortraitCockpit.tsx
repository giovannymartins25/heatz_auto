import { memo, useState } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import type { SessionEntryMode } from '@/stores/useSessionStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useGarageStore, type GarageCarInstance } from '@/stores/useGarageStore'
import { useInteriorAccessories } from '@/hooks/useInteriorAccessories'
import { AnalogPedal } from '@/components/controls/AnalogPedal'
import { GearShift } from '@/components/controls/GearShift'
import { QuickClutchButton, MobileStartButton, DrivingModesSelector, VerticalGestureShifter } from '@/components/controls'
import { DrivingMapViewport } from './DrivingMapViewport'
import { useUIStore } from '@/stores/useUIStore'
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

export interface MobilePortraitCockpitProps {
  telemetry: DashboardTelemetry
  vehicle: VehicleConfig
  onBack: () => void
  carInstance?: GarageCarInstance
  entryMode?: SessionEntryMode
}

/**
 * MobilePortraitCockpit — Cockpit vertical para celulares em modo Retrato (Fase 1.5).
 */
export const MobilePortraitCockpit = memo(function MobilePortraitCockpit({
  telemetry,
  vehicle,
  onBack,
  carInstance,
  entryMode = 'drive',
}: MobilePortraitCockpitProps) {
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
  const toggleHandbrake = useSimulationStore((s) => s.toggleHandbrake)
  const handbrake = useSimulationStore((s) => s.handbrake)
  const last0to100 = useSimulationStore((s) => s.last0to100)
  const isTiming0to100 = useSimulationStore((s) => s.isTiming0to100)
  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const hasTurbo = useSimulationStore((s) => s.hasTurbo)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
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
  const caps = getVehicleCapabilities(vehicle)
  const isManualActive = telemetry.gear.transmissionMode === 'manual_simulated' || telemetry.gear.gearSelectorPosition === 'M'

  // Larguras dos pedais adaptadas para caber 3 pedais + colunas laterais
  const pedalWidth = hasClutch ? 'w-11 sm:w-13' : 'w-14 sm:w-16'
  const pedalHeight = 'h-32 sm:h-36'

  return (
    <div
      className="fixed inset-0 w-full h-full bg-zinc-950 text-white flex flex-col select-none touch-none overflow-hidden z-40"
      style={{
        paddingLeft: 'max(0.4rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.4rem, env(safe-area-inset-right))',
        paddingTop: 'max(0.35rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* ─── 1. Cabeçalho superior unificado ─── */}
      <header className="flex items-start justify-between gap-2 w-full pb-1 px-1 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 pt-0.5">
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="relative w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-xl bg-zinc-900 border border-white/15 hover:bg-zinc-800 text-zinc-100 text-base sm:text-lg flex items-center justify-center active:scale-95 cursor-pointer shadow"
            aria-label="Abrir menu e garagem"
            title="Menu e garagem (Esc)"
          >
            ☰
            {tuningStage > 0 && (
              <span className="absolute -top-1 -right-1 px-1 rounded bg-amber-500 text-black text-[7px] font-black font-mono">
                S{tuningStage}
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1 leading-tight" data-vehicle-id>
            <span
              className="block text-[10px] font-black font-mono tracking-wider text-zinc-400 truncate"
              title={`${vehicleHeader.title} · ${vehicleHeader.specsSummary}`}
            >
              {getShortVehicleName(vehicle)}
            </span>
          </div>
        </div>

        {/* Lado direito do header */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onPointerDown={() => setHorn(true)}
            onPointerUp={() => setHorn(false)}
            onPointerLeave={() => setHorn(false)}
            onPointerCancel={() => setHorn(false)}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-white/15 active:bg-amber-500/20 active:border-amber-400 flex items-center justify-center text-xs transition-all active:scale-95 cursor-pointer shadow-sm"
            title="Buzina"
            aria-label="Buzina"
          >
            📢
          </button>

          {vehicle.transmission.tcs?.enabled && (
            <button
              type="button"
              onClick={() => setTcsEnabled(!tcsEnabled)}
              aria-pressed={tcsEnabled}
              className={`w-9 h-9 rounded-full border font-mono font-black text-[8px] flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                !tcsEnabled
                  ? 'bg-zinc-900 text-zinc-500 border-zinc-700'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
              }`}
            >
              TCS
            </button>
          )}

          <div className={`px-2 py-0.5 rounded-full bg-zinc-900 border text-[8px] font-mono shadow-sm ${
            isTiming0to100 ? 'border-amber-400/70 text-amber-300' : 'border-white/10 text-zinc-300'
          }`}>
            0-100: <b className={last0to100 !== null ? 'text-amber-400 font-bold' : 'text-zinc-500 font-normal'}>
              {formatZeroToHundredSeconds(last0to100)}
            </b>
          </div>
        </div>
      </header>

      {/* ─── 2. Centro: Mapa + Slot (Painel ↔ Multimídia) ─── */}
      <main className="relative flex-1 flex flex-col items-center justify-center w-full min-h-0 px-0.5 overflow-hidden">
        {/* Launch Control Overlay */}
        {(isLaunchControlArmed || isLaunching) && (
          <div className="absolute top-1 inset-x-0 z-30 pointer-events-none flex justify-center">
            <div className={`py-0.5 px-3 rounded-full text-[9px] font-mono font-black shadow-lg ${
              isLaunchControlArmed ? 'bg-amber-500 text-black animate-pulse' : 'bg-emerald-500 text-black'
            }`}>
              {isLaunchControlArmed ? '🏁 LAUNCH CONTROL ATIVO · SOLTE O FREIO!' : '🚀 LARGADA!'}
            </div>
          </div>
        )}

        {isDriveMode ? (
          <div className="flex flex-1 flex-col items-center justify-center w-full gap-1 min-h-0 self-stretch overflow-hidden">
            {/* 1. MAPA DE CONDUÇÃO */}
            <div
              className={`w-full min-h-0 flex items-center justify-center transition-all duration-200 ${
                mapViewportSize === 'compact'
                  ? 'h-[30%] flex-shrink-0'
                  : mapViewportSize === 'expanded'
                  ? 'h-[56%] flex-shrink-0'
                  : 'h-[43%] flex-shrink-0'
              }`}
            >
              <DrivingMapViewport
                size={mapViewportSize}
                onSizeChange={setMapViewportSize}
                compact
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
          /* MODO PAINEL: Foco 100% no cluster com swipe para multimídia */
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

      {/* ─── 3. Câmbio e Perfis de Condução (apenas no modo DIRIGIR) ─── */}
      {isDriveMode && (
        <div className="w-full flex items-center justify-between gap-2 pt-1 pb-1 border-t border-white/5 px-1 flex-shrink-0">
          <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
            <GearShift size="compact" orientation="horizontal" showPaddles={false} />
            {caps.manualShiftControls.includes('gear_selector_gesture') && isManualActive && (
              <VerticalGestureShifter size="compact" />
            )}
          </div>
          {caps.supportedDrivingModes.length > 1 && (
            <div className="flex-shrink-0 flex items-center pr-1">
              <DrivingModesSelector
                supportedModes={caps.supportedDrivingModes}
                orientation="horizontal"
                size="compact"
              />
            </div>
          )}
        </div>
      )}

      {/* ─── 4. Zona dos polegares: botões laterais + pedais (apenas no modo DIRIGIR) ─── */}
      {isDriveMode && (
        <footer className="w-full grid grid-cols-[68px_1fr_68px] sm:grid-cols-[76px_1fr_76px] items-end gap-1.5 px-1 pb-0.5 flex-shrink-0">
          {/* Coluna esquerda: Freio de mão · START · QuickClutch */}
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={toggleHandbrake}
              className={`h-10 rounded-xl border font-mono font-black uppercase leading-none flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm ${
                handbrake
                  ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.7)]'
                  : 'bg-zinc-900 text-zinc-400 border-white/10'
              }`}
              aria-label="Freio de mão"
            >
              <span className="text-[11px]">(P)</span>
              <span className="text-[6px] mt-0.5">{handbrake ? 'PUXADO' : 'F. MÃO'}</span>
            </button>
            <MobileStartButton variant="square" className="h-11 w-full rounded-xl" />
            {hasClutch && (
              <QuickClutchButton
                layout="stack"
                className="h-11 w-full rounded-xl"
                label={isMotorcycle ? 'MANETE' : 'EMBR'}
                sublabel="100%"
              />
            )}
          </div>

          {/* Centro: pedais */}
          <div className="flex items-end justify-center gap-1.5 sm:gap-2.5">
            {hasClutch && (
              <AnalogPedal
                label={isMotorcycle ? 'MANETE' : 'EMBR'}
                sublabel={isMotorcycle ? 'EMBREAGEM' : 'CLUTCH'}
                value={clutchPosition}
                onChange={setClutch}
                colorTheme="amber"
                widthClass={pedalWidth}
                heightClass={pedalHeight}
                disabled={false}
                showPercent={true}
              />
            )}
            <AnalogPedal
              label={isMotorcycle ? 'F. TRAS' : 'FREIO'}
              sublabel={isMotorcycle ? 'TRASEIRO' : 'BRAKE'}
              value={brake}
              onChange={setBrake}
              colorTheme="red"
              widthClass={pedalWidth}
              heightClass={pedalHeight}
              disabled={false}
              showPercent={true}
            />
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={toggleThrottleLock}
                onPointerDown={(e) => { e.stopPropagation() }}
                onTouchStart={(e) => { e.stopPropagation() }}
                style={{ touchAction: 'none' }}
                className={`py-0.5 mb-1 px-2 rounded-lg font-mono text-[7px] font-black uppercase tracking-wider border transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-0.5 shadow-sm ${
                  throttleLock
                    ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.85)] animate-pulse'
                    : 'bg-zinc-900/90 text-zinc-400 border-white/10 hover:text-white'
                }`}
                title="Trava acelerador"
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
                widthClass={pedalWidth}
                heightClass={pedalHeight}
                disabled={false}
                showPercent={true}
              />
            </div>
          </div>

          {/* Coluna direita: Moto freio dianteiro ou NOS */}
          <div className="flex flex-col gap-1 items-stretch">
            {isMotorcycle && (
              <button
                type="button"
                onPointerDown={() => setBrake(1)}
                onPointerUp={() => setBrake(0)}
                onPointerLeave={() => setBrake(0)}
                onPointerCancel={() => setBrake(0)}
                className="h-10 rounded-xl border border-red-400/50 bg-red-950/50 font-mono text-[8px] font-black text-red-200 active:bg-red-500/40"
              >
                F. DIANT.
              </button>
            )}
            {hasNosKit && (
              <button
                type="button"
                onPointerDown={() => setNosActive(true)}
                onPointerUp={() => setNosActive(false)}
                onPointerLeave={() => setNosActive(false)}
                onPointerCancel={() => setNosActive(false)}
                disabled={nosPressurePercent <= 0 || !isRunning}
                aria-label="Disparar Nitro NOS"
                className={`h-11 rounded-xl border font-mono text-[8px] font-black uppercase flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm ${
                  nosActive
                    ? 'bg-cyan-400 text-black border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.9)] animate-pulse'
                    : nosPressurePercent <= 0
                    ? 'bg-zinc-900/50 text-zinc-600 border-zinc-800'
                    : 'bg-cyan-950/70 text-cyan-300 border-cyan-500/50'
                }`}
              >
                <span>NOS</span>
                <span>{Math.round(nosPressurePercent)}%</span>
              </button>
            )}
          </div>
        </footer>
      )}

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
