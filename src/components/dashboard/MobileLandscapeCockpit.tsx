import { memo, useState } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import type { SessionEntryMode } from '@/stores/useSessionStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore } from '@/stores/useUIStore'
import { useGarageStore, type GarageCarInstance } from '@/stores/useGarageStore'
import { useInteriorAccessories } from '@/hooks/useInteriorAccessories'
import { useDeviceTilt } from '@/hooks/useDeviceTilt'
import { AnalogPedal } from '@/components/controls/AnalogPedal'
import { GearShift } from '@/components/controls/GearShift'
import { QuickClutchButton, HudIgnitionControl, DrivingModesSelector, VerticalGestureShifter, SteeringControlZone, HandbrakeButton } from '@/components/controls'
import { useSecondaryTouchTapBridge } from '@/utils/multitouchBridge'
import { DrivingMapViewport } from './DrivingMapViewport'
import { HudMinimap } from './HudMinimap'
import { WorldMapModal } from './WorldMapModal'
import { CockpitPanelCarousel, PanelModeInteriorView } from '@/components/cockpit'
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
  onToggleSessionMode?: () => void
  carInstance?: GarageCarInstance
  entryMode?: SessionEntryMode
}

export const MobileLandscapeCockpit = memo(function MobileLandscapeCockpit({
  telemetry,
  vehicle,
  onBack,
  onToggleSessionMode,
  carInstance,
  entryMode = 'drive',
}: MobileLandscapeCockpitProps) {
  const isDriveMode = entryMode !== 'cluster'
  const secondaryTouchHandlers = useSecondaryTouchTapBridge()

  // Garante escuta física ininterrupta do sensor de inclinação durante toda a sessão de condução
  useDeviceTilt()

  const throttle = useSimulationStore((s) => s.throttle)
  const throttleLock = useSimulationStore((s) => s.throttleLock)
  const toggleThrottleLock = useSimulationStore((s) => s.toggleThrottleLock)
  const brake = useSimulationStore((s) => s.brake)
  const clutchPosition = useSimulationStore((s) => s.clutchPosition)
  const setThrottle = useSimulationStore((s) => s.setThrottle)
  const setBrake = useSimulationStore((s) => s.setBrake)
  const setClutch = useSimulationStore((s) => s.setClutch)

  const isRunning = useSimulationStore((s) => s.isRunning)
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
  const isMapOpen = useUIStore((s) => s.isMapOpen)
  const isWorldMapOpen = useUIStore((s) => s.isWorldMapOpen)
  const toggleWorldMap = useUIStore((s) => s.toggleWorldMap)
  const vehicleHeader = formatVehicleHeaderInfo(vehicle)
  const shortName = getShortVehicleName(vehicle)
  const caps = getVehicleCapabilities(vehicle)
  const isManualActive = telemetry.gear.transmissionMode === 'manual_simulated' || telemetry.gear.gearSelectorPosition === 'M'

  return (
    <div
      {...secondaryTouchHandlers}
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

        {/* ═══ 1. ESQUERDA FIXA (180px): MENU + IDENTIFICAÇÃO (topo) · 3 SLOTS GEOMÉTRICOS FIXOS DE PEDAIS (base) ═══ */}
        <aside className="w-[180px] flex flex-col justify-between items-start h-full pt-0 pb-0.5 pr-1.5 border-r border-white/5 flex-shrink-0 gap-1">
          <div className="flex items-center gap-1 min-w-0 w-full" data-vehicle-id>
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
            <button
              type="button"
              onClick={onBack}
              className="h-8 px-2 flex-shrink-0 rounded-lg bg-zinc-900 border border-white/15 hover:bg-zinc-800 text-zinc-200 font-mono text-[9px] font-black uppercase flex items-center justify-center gap-0.5 active:scale-95 cursor-pointer shadow"
              aria-label="Voltar à garagem"
              title="Voltar à Garagem"
            >
              <span>←</span>
              <span className="hidden sm:inline">Garagem</span>
            </button>
            <span
              className="text-[8.5px] font-black font-mono tracking-wider text-zinc-400 truncate flex-1 min-w-0"
              title={`${vehicleHeader.title} · ${vehicleHeader.specsSummary}`}
            >
              {shortName}
            </span>
          </div>

          {/* Minimapa contextual acima da região dos pedais (exclusivo do Modo Dirigir) */}
          {isDriveMode && (
            <div className="self-center">
              <HudMinimap variant="mobile_landscape" />
            </div>
          )}

          {/* 3 Slots Geométricos Fixos [EMBR/Vazio 52px | FREIO 52px | ACEL 52px] (0 px de deslocamento) */}
          <div
            data-testid="pedal-slots-grid"
            className="grid grid-cols-[52px_52px_52px] items-end gap-1.5 w-[168px] min-h-0"
          >
            <div data-testid="pedal-slot-clutch" className="w-[52px] flex flex-col items-center justify-end gap-1">
              {hasClutch ? (
                <>
                  <QuickClutchButton
                    layout="stack"
                    className="w-[52px] h-9 flex-shrink-0"
                    label={isMotorcycle ? 'MANETE' : 'EMBR'}
                    sublabel="100%"
                  />
                  <AnalogPedal
                    label={isMotorcycle ? 'MANETE' : 'EMBR'}
                    sublabel={isMotorcycle ? 'EMBREAGEM' : 'CLUTCH'}
                    value={clutchPosition}
                    onChange={setClutch}
                    colorTheme="amber"
                    widthClass="w-[52px]"
                    heightClass="h-32"
                    disabled={false}
                    showPercent={true}
                  />
                </>
              ) : (
                <div aria-hidden="true" className="w-[52px] h-32 pointer-events-none opacity-0" />
              )}
            </div>

            <div data-testid="pedal-slot-brake" className="w-[52px] flex items-end justify-center">
              <AnalogPedal
                label={isMotorcycle ? 'F. TRAS' : 'FREIO'}
                sublabel={isMotorcycle ? 'TRASEIRO' : 'BRAKE'}
                value={brake}
                onChange={setBrake}
                colorTheme="red"
                widthClass="w-[52px]"
                heightClass="h-36"
                disabled={false}
                showPercent={true}
              />
            </div>

            <div data-testid="pedal-slot-throttle" className="w-[52px] flex flex-col items-center justify-end">
              <button
                type="button"
                onClick={toggleThrottleLock}
                onPointerDown={(e) => { e.stopPropagation() }}
                onTouchStart={(e) => { e.stopPropagation() }}
                style={{ touchAction: 'none' }}
                className={`w-[52px] py-0.5 mb-1 rounded-lg font-mono text-[7px] font-black uppercase tracking-wider border transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-0.5 shadow-sm ${
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
                widthClass="w-[52px]"
                heightClass="h-32"
                disabled={false}
                showPercent={true}
              />
            </div>
          </div>
        </aside>

        {/* ═══ 2. CENTRO: MAPA SUPERIOR + SLOT INFERIOR (DIRIGIR) OU PALCO MODO PAINEL ═══ */}
        <main className="relative flex-1 flex flex-col items-center min-w-0 h-full px-1.5">
          {isDriveMode ? (
            <div className="flex-1 flex min-h-0 w-full h-full flex-col gap-0.5 overflow-hidden self-stretch items-center">
              {/* 1. MAPA DE CONDUÇÃO — PARTE SUPERIOR DA REGIÃO CENTRAL */}
              {isMapOpen && mapViewportSize !== 'hidden' && (
                <div
                  className={`w-full min-h-0 flex items-center justify-center transition-all duration-200 relative ${
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
                    vehicle={vehicle}
                    onOpenDragStrip={() => setIsDragStripOpen(true)}
                  />

                  {/* Telemetria e Calibração de Direção por Inclinação Mobile (Fase 1.6.2) */}
                  <SteeringControlZone
                    vehicle={vehicle}
                    className="absolute top-1.5 left-2 z-20"
                  />
                </div>
              )}

              {/* 2. CARROSSEL MODULAR DE 3 PAINÉIS: CLUSTER ↔ MULTIMÍDIA ↔ CONTROLES */}
              <div className="w-full flex-1 flex items-center justify-center min-h-0 self-stretch relative">
                <CockpitPanelCarousel
                  telemetry={telemetry}
                  vehicle={vehicle}
                  expanded={false}
                  supportsPaddleShifters={caps.supportsPaddleShifters}
                  isManualActive={isManualActive}
                  hasTurbo={hasTurbo}
                  showAftermarketBoostGauge={showAftermarketBoostGauge}
                  boostPressureBar={boostPressureBar}
                />
              </div>
            </div>
          ) : (
            /* MODO PAINEL DIRIGÍVEL: Controles no topo (ex-GPS) + Tilt · Cluster centralizado · Multimídia abaixo */
            <PanelModeInteriorView
              layout="mobile_landscape"
              telemetry={telemetry}
              vehicle={vehicle}
              carInstance={activeCar}
              hasTurbo={hasTurbo}
              showAftermarketBoostGauge={showAftermarketBoostGauge}
              boostPressureBar={boostPressureBar}
              onBack={onBack}
            />
          )}
        </main>

        {/* ═══ 3. DIREITA FIXA (172px): ALTERNÂNCIA DE MODO + BUZINA · CÂMBIO · IGNIÇÃO CONSTANTE ═══ */}
        <aside className="w-[172px] flex flex-col items-stretch justify-between h-full pt-0 pb-0.5 px-1.5 border-l border-white/5 flex-shrink-0 gap-1">
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0 w-full">
            <div className="flex items-center justify-end gap-1 w-full">
              {onToggleSessionMode && (
                <button
                  type="button"
                  data-testid="btn-toggle-session-mode"
                  onClick={onToggleSessionMode}
                  className={`h-7 px-2 rounded-full border font-mono text-[7.5px] font-black uppercase tracking-wider flex items-center gap-0.5 transition-all active:scale-95 cursor-pointer shadow-sm ${
                    isDriveMode
                      ? 'border-cyan-500/45 bg-cyan-950/60 text-cyan-300'
                      : 'border-emerald-500/50 bg-emerald-950/65 text-emerald-300'
                  }`}
                  title={isDriveMode ? 'Alternar para Modo Painel' : 'Alternar para Modo Dirigir'}
                >
                  <span>{isDriveMode ? '🎛️' : '🛣️'}</span>
                  <span>{isDriveMode ? 'PAINEL' : 'DIRIGIR'}</span>
                </button>
              )}

              {isDriveMode ? (
                <button
                  type="button"
                  onClick={toggleWorldMap}
                  data-testid="btn-world-map"
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs transition-all active:scale-95 cursor-pointer shadow-sm ${
                    isWorldMapOpen
                      ? 'bg-sky-500/25 text-sky-200 border-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.6)]'
                      : 'bg-zinc-900 border-sky-500/35 text-sky-300 hover:text-white'
                  }`}
                  title="Abrir Mapa do Mundo 2D"
                  aria-label="Abrir mapa do mundo"
                >
                  🗺️
                </button>
              ) : (
                <span
                  data-testid="badge-panel-mode"
                  className="px-1.5 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/35 text-[6.5px] font-mono font-black uppercase text-cyan-300"
                >
                  PAINEL
                </span>
              )}

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
            </div>

          {isDriveMode && (
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
          )}

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
              isMotorcycle={isMotorcycle}
              className="w-full"
            />
          )}
          <div className="flex items-center justify-center gap-1 w-full max-w-full overflow-hidden">
            <GearShift orientation="vertical" size="compact" showPaddles={false} />
            {caps.manualShiftControls.includes('gear_selector_gesture') && isManualActive && (
              <VerticalGestureShifter size="compact" />
            )}
          </div>
        </div>

        {/* Base constante (canto inferior direito): Slot fixo de Freio de Mão (44px) + Coluna de Ignição (1fr) */}
        <div
          data-testid="ignition-column-slot"
          className="grid grid-cols-[44px_1fr] gap-1 items-end flex-shrink-0 w-full"
        >
          <div className={!isDriveMode ? 'invisible pointer-events-none' : ''}>
            <HandbrakeButton
              active={handbrake}
              onToggle={toggleHandbrake}
              variant="mobile_landscape"
            />
          </div>
          <HudIgnitionControl vehicle={vehicle} variant="mobile_landscape" />
        </div>
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

      {isDriveMode && isDragStripOpen && <DragStripTree onClose={() => setIsDragStripOpen(false)} />}
      {isDriveMode && <WorldMapModal vehicle={vehicle} />}
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
