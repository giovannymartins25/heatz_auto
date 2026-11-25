/**
 * PanelModeInteriorView.tsx — Experiência dedicada de Interior do Veículo (Modo Painel — Fase 4.4.2.2).
 *
 * Completamente separado do layout de condução (Modo Dirigir):
 * - NÃO renderiza minimapa (`HudMinimap`), mapa 2D (`DrivingMapViewport`), pedais de condução
 *   (`AnalogPedal` / `Pedals`), cronômetro 0–100 de pista ou indicador de inclinação mobile.
 * - Apresenta os equipamentos reais do veículo organizados como visão interna do cockpit:
 *   · Região central/superior em destaque: `InstrumentClusterPanel` (cluster específico do modelo)
 *   · Região inferior: `MultimediaPanel` (central multimídia / rádio OEM / console do modelo; omitido em motos)
 *   · Região lateral / console acessível: `VehicleControlsPanel` (climatização física, tração física,
 *     iluminação, janelas e difusor quando equipado)
 *   · Console compacto de bancada: Ignição real (`HudIgnitionControl`), seletor de marcha/modos e
 *     comando discreto de giro do motor para observar os instrumentos funcionando em tempo real.
 */

import { memo, useState } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import { getVehicleCapabilities } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { type GarageCarInstance } from '@/stores/useGarageStore'
import { useOrientation } from '@/hooks/useOrientation'
import { useSecondaryTouchTapBridge } from '@/utils/multitouchBridge'
import { getShortVehicleName } from '@/utils/vehicleSpecs'
import { toggleAppFullscreen } from '@/utils/fullscreen'
import { getAvailableCockpitPanels } from './cockpitPanels'
import { InstrumentClusterPanel } from './InstrumentClusterPanel'
import { MultimediaPanel } from './MultimediaPanel'
import { VehicleControlsPanel } from './VehicleControlsPanel'
import { GearShift, HudIgnitionControl, DrivingModesSelector } from '@/components/controls'
import { TuningGarageModal, DynoTestModal } from '@/components/tuning'
import { MobileQuickMenu } from '@/components/dashboard/MobileQuickMenu'
import { BackfireFlameFlash, RainWindshieldEffect } from '@/components/effects'
import { BurnoutSmokeEffect } from '@/components/effects/BurnoutSmokeEffect'
import { EngineBlownSmokeEffect } from '@/components/effects/EngineBlownSmokeEffect'

export interface PanelModeInteriorViewProps {
  telemetry: DashboardTelemetry
  vehicle: VehicleConfig
  onBack: () => void
  carInstance?: GarageCarInstance
  hasTurbo: boolean
  showAftermarketBoostGauge: boolean
  boostPressureBar: number
  isTuningOpen: boolean
  setIsTuningOpen: (open: boolean) => void
}

export const PanelModeInteriorView = memo(function PanelModeInteriorView({
  telemetry,
  vehicle,
  onBack,
  carInstance,
  hasTurbo,
  showAftermarketBoostGauge,
  boostPressureBar,
  isTuningOpen,
  setIsTuningOpen,
}: PanelModeInteriorViewProps) {
  const { isMobileDevice, isPortrait, isLandscape } = useOrientation()
  const secondaryTouchHandlers = useSecondaryTouchTapBridge()

  const isRunning = useSimulationStore((s) => s.isRunning)
  const throttle = useSimulationStore((s) => s.throttle)
  const setThrottle = useSimulationStore((s) => s.setThrottle)
  const setBrake = useSimulationStore((s) => s.setBrake)
  const setClutch = useSimulationStore((s) => s.setClutch)
  const brake = useSimulationStore((s) => s.brake)
  const clutchPosition = useSimulationStore((s) => s.clutchPosition)
  const isMuted = useSimulationStore((s) => s.isMuted)
  const toggleMute = useSimulationStore((s) => s.toggleMute)
  const isRaining = useSimulationStore((s) => s.isRaining)
  const toggleRain = useSimulationStore((s) => s.toggleRain)
  const setHorn = useSimulationStore((s) => s.setHorn)
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const coolantTemp = useSimulationStore((s) => s.coolantTemp)
  const fuelLevelLiters = useSimulationStore((s) => s.fuelLevelLiters)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDynoOpen, setIsDynoOpen] = useState(false)

  const caps = getVehicleCapabilities(vehicle)
  const isMotorcycle = vehicle.info.category === 'motorcycle'
  const isManualActive =
    telemetry.gear.transmissionMode === 'manual_simulated' ||
    telemetry.gear.gearSelectorPosition === 'M'

  const availablePanels = getAvailableCockpitPanels(vehicle, carInstance?.upgrades)
  const hasMultimediaPanel = availablePanels.some((p) => p.id === 'multimedia')

  const startBenchRev = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setThrottle(0.85)
  }
  const stopBenchRev = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setThrottle(0)
  }

  // Interlock discreto para dar partida nos modelos que exigem freio ou embreagem pressionados
  const needsBrakeInterlock =
    !isRunning &&
    (vehicle.ignition?.startInterlock === 'brake' ||
      vehicle.ignition?.startInterlock === 'brake_or_clutch')
  const needsClutchInterlock = !isRunning && vehicle.ignition?.startInterlock === 'clutch'

  const renderBenchConsole = (compactMobile: boolean) => (
    <div
      data-testid="panel-mode-bench-console"
      className={`flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-white/10 bg-zinc-950/95 ${
        compactMobile ? 'px-2 py-1' : 'px-3 py-1.5'
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        <GearShift size="compact" orientation="horizontal" showPaddles={false} />
        {!compactMobile && caps.supportedDrivingModes.length > 1 && (
          <DrivingModesSelector
            supportedModes={caps.supportedDrivingModes}
            orientation="horizontal"
            size="compact"
            isMotorcycle={isMotorcycle}
          />
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {needsBrakeInterlock && (
          <button
            type="button"
            data-testid="btn-panel-interlock-brake"
            onClick={() => setBrake(brake > 0.5 ? 0 : 0.85)}
            className={`h-8 px-2 rounded-lg border font-mono text-[8px] font-black uppercase cursor-pointer transition-all ${
              brake > 0.5
                ? 'border-red-400 bg-red-500/25 text-red-200'
                : 'border-white/15 bg-zinc-900 text-zinc-400'
            }`}
            title="Apoiar pedal de freio para destravar partida Start/Stop"
          >
            {brake > 0.5 ? '🛑 Freio OK' : 'Pisar Freio'}
          </button>
        )}

        {needsClutchInterlock && (
          <button
            type="button"
            data-testid="btn-panel-interlock-clutch"
            onClick={() => setClutch(clutchPosition > 0.8 ? 0 : 1.0)}
            className={`h-8 px-2 rounded-lg border font-mono text-[8px] font-black uppercase cursor-pointer transition-all ${
              clutchPosition > 0.8
                ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                : 'border-white/15 bg-zinc-900 text-zinc-400'
            }`}
            title="Pressionar embreagem para destravar partida"
          >
            {clutchPosition > 0.8 ? '⚙️ Embr. OK' : 'Embreagem'}
          </button>
        )}

        <button
          type="button"
          data-testid="btn-panel-rev-engine"
          disabled={!isRunning}
          onPointerDown={startBenchRev}
          onPointerUp={stopBenchRev}
          onPointerCancel={stopBenchRev}
          onPointerLeave={stopBenchRev}
          style={{ touchAction: 'none' }}
          className={`h-9 px-2.5 rounded-xl border font-mono text-[8.5px] font-black uppercase tracking-wider transition-all select-none ${
            !isRunning
              ? 'border-zinc-800 bg-zinc-900/50 text-zinc-600 cursor-not-allowed'
              : throttle > 0.05
                ? 'border-emerald-400 bg-emerald-500/30 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.5)] scale-95 cursor-pointer'
                : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 cursor-pointer'
          }`}
          title="Segure para girar o motor e observar os ponteiros/instrumentos (ou tecla W no PC)"
        >
          {throttle > 0.05 ? `⚡ ${Math.round(throttle * 100)}% GIRO` : '⚡ GIRO MOTOR'}
        </button>

        <HudIgnitionControl
          vehicle={vehicle}
          variant={
            isMobileDevice
              ? isPortrait
                ? 'mobile_portrait'
                : 'mobile_landscape'
              : 'desktop'
          }
        />
      </div>
    </div>
  )

  // ─── 1. LAYOUT MOBILE RETRATO (390×844): Cluster em destaque + Multimídia abaixo + Controles acessíveis ───
  if (isMobileDevice && isPortrait) {
    return (
      <div
        data-testid="panel-mode-interior-root"
        data-layout="mobile_portrait"
        {...secondaryTouchHandlers}
        className="fixed inset-0 w-full h-full bg-zinc-950 text-white flex flex-col select-none overflow-hidden z-40"
        style={{
          paddingLeft: 'max(0.45rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.45rem, env(safe-area-inset-right))',
          paddingTop: 'max(0.35rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))',
        }}
      >
        <header className="flex items-center justify-between gap-2 pb-1 flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/15 text-zinc-100 text-sm flex items-center justify-center active:scale-95 cursor-pointer"
              aria-label="Abrir menu"
            >
              ☰
            </button>
            <button
              type="button"
              onClick={onBack}
              className="h-8 px-2.5 rounded-xl bg-zinc-900 border border-white/15 text-zinc-200 font-mono text-[9.5px] font-black uppercase flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              ← Garagem
            </button>
            <span className="font-mono text-[10px] font-black text-zinc-300 truncate">
              {getShortVehicleName(vehicle)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/35 text-[8px] font-mono font-black uppercase text-cyan-300">
              MODO PAINEL
            </span>
            <button
              type="button"
              onPointerDown={() => setHorn(true)}
              onPointerUp={() => setHorn(false)}
              onPointerLeave={() => setHorn(false)}
              onPointerCancel={() => setHorn(false)}
              className="w-8 h-8 rounded-full bg-zinc-900 border border-white/15 flex items-center justify-center text-xs cursor-pointer"
              aria-label="Buzina"
            >
              📢
            </button>
          </div>
        </header>

        {/* Região Central Superior — Painel de Instrumentos em Destaque */}
        <section
          data-testid="panel-mode-cluster-region"
          className={`${
            hasMultimediaPanel ? 'h-[212px]' : 'flex-1 min-h-0'
          } w-full rounded-2xl border border-white/10 bg-black/45 flex items-center justify-center relative overflow-hidden flex-shrink-0`}
        >
          <InstrumentClusterPanel
            telemetry={telemetry}
            vehicle={vehicle}
            expanded={true}
            supportsPaddleShifters={caps.supportsPaddleShifters}
            isManualActive={isManualActive}
            hasTurbo={hasTurbo}
            showAftermarketBoostGauge={showAftermarketBoostGauge}
            boostPressureBar={boostPressureBar}
          />
        </section>

        {/* Região Inferior — Central Multimídia Específica do Veículo */}
        {hasMultimediaPanel && (
          <section
            data-testid="panel-mode-multimedia-region"
            className="flex-1 min-h-0 w-full my-1 rounded-2xl border border-white/10 bg-zinc-950/90 p-1 overflow-hidden flex items-center justify-center"
          >
            <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
          </section>
        )}

        {/* Região Acessível de Controles Físicos da Cabine */}
        <section
          data-testid="panel-mode-controls-region"
          className="h-[196px] w-full mb-1 rounded-2xl border border-white/10 bg-zinc-950/90 p-1 overflow-y-auto flex-shrink-0"
        >
          <VehicleControlsPanel vehicle={vehicle} />
        </section>

        {/* Console compacto de Ignição, Marcha e Giro de Bancada */}
        <footer className="w-full flex-shrink-0">{renderBenchConsole(true)}</footer>

        <BackfireFlameFlash />
        <RainWindshieldEffect />
        <BurnoutSmokeEffect />
        <EngineBlownSmokeEffect />

        <MobileQuickMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          vehicle={vehicle}
          onOpenDragStrip={() => setIsMenuOpen(false)}
          onOpenDyno={() => setIsDynoOpen(true)}
          onOpenTuning={() => setIsTuningOpen(true)}
          onExit={onBack}
        />
        {isDynoOpen && (
          <DynoTestModal config={vehicle} upgrades={carInstance?.upgrades} onClose={() => setIsDynoOpen(false)} />
        )}
        {isTuningOpen && (
          <TuningGarageModal
            isOpen={true}
            onClose={() => setIsTuningOpen(false)}
            vehicle={vehicle}
            carInstance={carInstance}
          />
        )}
      </div>
    )
  }

  // ─── 2. LAYOUT MOBILE PAISAGEM (844×390): Esquerda Cluster + Multimídia abaixo | Direita Controles ───
  if (isMobileDevice && isLandscape) {
    return (
      <div
        data-testid="panel-mode-interior-root"
        data-layout="mobile_landscape"
        {...secondaryTouchHandlers}
        className="fixed inset-0 w-full h-full bg-zinc-950 text-white flex flex-col select-none overflow-hidden z-40"
        style={{
          paddingLeft: 'max(0.4rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.4rem, env(safe-area-inset-right))',
          paddingTop: 'max(0.25rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))',
        }}
      >
        <header className="flex items-center justify-between gap-2 pb-1 flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/15 text-zinc-100 text-xs flex items-center justify-center cursor-pointer"
              aria-label="Abrir menu"
            >
              ☰
            </button>
            <button
              type="button"
              onClick={onBack}
              className="h-7 px-2 rounded-lg bg-zinc-900 border border-white/15 text-zinc-200 font-mono text-[9px] font-black uppercase flex items-center gap-1 cursor-pointer"
            >
              ← Garagem
            </button>
            <span className="font-mono text-[9.5px] font-black text-zinc-300 truncate">
              {vehicle.info.brand} · {getShortVehicleName(vehicle)}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/35 text-[7.5px] font-mono font-black uppercase text-cyan-300">
              INTERIOR / PAINEL
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={toggleMute}
              className="h-7 px-2 rounded-lg bg-zinc-900 border border-white/10 font-mono text-[8.5px] text-zinc-300 cursor-pointer"
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <button
              type="button"
              onPointerDown={() => setHorn(true)}
              onPointerUp={() => setHorn(false)}
              onPointerLeave={() => setHorn(false)}
              onPointerCancel={() => setHorn(false)}
              className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/15 flex items-center justify-center text-xs cursor-pointer"
              aria-label="Buzina"
            >
              📢
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-12 gap-1.5 w-full overflow-hidden">
          {/* Coluna Esquerda/Central: Instrumentos em cima + Multimídia abaixo */}
          <div className="col-span-7 flex flex-col gap-1 min-h-0 overflow-hidden">
            <section
              data-testid="panel-mode-cluster-region"
              className={`${
                hasMultimediaPanel ? 'h-[52%]' : 'flex-1'
              } w-full min-h-0 rounded-xl border border-white/10 bg-black/45 flex items-center justify-center relative overflow-hidden`}
            >
              <InstrumentClusterPanel
                telemetry={telemetry}
                vehicle={vehicle}
                expanded={false}
                supportsPaddleShifters={caps.supportsPaddleShifters}
                isManualActive={isManualActive}
                hasTurbo={hasTurbo}
                showAftermarketBoostGauge={showAftermarketBoostGauge}
                boostPressureBar={boostPressureBar}
              />
            </section>

            {hasMultimediaPanel && (
              <section
                data-testid="panel-mode-multimedia-region"
                className="flex-1 min-h-0 w-full rounded-xl border border-white/10 bg-zinc-950/90 p-0.5 overflow-hidden flex items-center justify-center"
              >
                <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
              </section>
            )}
          </div>

          {/* Coluna Lateral Direita: Controles do Veículo + Ignição/Bancada */}
          <div className="col-span-5 flex flex-col gap-1 min-h-0 overflow-hidden">
            <section
              data-testid="panel-mode-controls-region"
              className="flex-1 min-h-0 w-full rounded-xl border border-white/10 bg-zinc-950/90 p-0.5 overflow-y-auto"
            >
              <VehicleControlsPanel vehicle={vehicle} />
            </section>
            <div className="flex-shrink-0">{renderBenchConsole(true)}</div>
          </div>
        </div>

        <BackfireFlameFlash />
        <RainWindshieldEffect />
        <BurnoutSmokeEffect />
        <EngineBlownSmokeEffect />

        <MobileQuickMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          vehicle={vehicle}
          onOpenDragStrip={() => setIsMenuOpen(false)}
          onOpenDyno={() => setIsDynoOpen(true)}
          onOpenTuning={() => setIsTuningOpen(true)}
          onExit={onBack}
        />
        {isDynoOpen && (
          <DynoTestModal config={vehicle} upgrades={carInstance?.upgrades} onClose={() => setIsDynoOpen(false)} />
        )}
        {isTuningOpen && (
          <TuningGarageModal
            isOpen={true}
            onClose={() => setIsTuningOpen(false)}
            vehicle={vehicle}
            carInstance={carInstance}
          />
        )}
      </div>
    )
  }

  // ─── 3. LAYOUT DESKTOP (1280×800+): Visão ampla de Interior (Centro: Cluster + Multimídia inferior | Lateral: Controles) ───
  return (
    <div
      data-testid="panel-mode-interior-root"
      data-layout="desktop"
      {...secondaryTouchHandlers}
      className="flex flex-col h-dvh max-h-dvh overflow-hidden bg-[var(--color-bg-primary)] p-2.5 sm:p-3 gap-2 select-none text-white"
    >
      {/* Barra superior limpa de Interior (sem cronômetro de arrancada e sem botões de mapa) */}
      <header className="flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-[var(--radius-sm)] border border-white/10 bg-white/5 text-[var(--color-text-secondary)] hover:border-red-500/50 hover:text-white transition-all active:scale-95 cursor-pointer"
          >
            ← Garagem
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className={`px-2.5 py-1 text-xs rounded-lg border font-mono transition-all cursor-pointer ${
              isMuted
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            {isMuted ? '🔇 Mudo' : '🔊 Som'}
          </button>

          <button
            type="button"
            onClick={() => void toggleAppFullscreen()}
            className="hidden sm:inline-flex px-2.5 py-1 text-xs rounded-lg border border-white/10 bg-zinc-900 text-zinc-400 hover:text-white font-mono transition-all cursor-pointer"
          >
            ⛶ Fullscreen
          </button>

          <button
            type="button"
            onClick={() => setIsTuningOpen(true)}
            className={`px-2.5 py-1 text-xs rounded-lg border font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
              tuningStage > 0
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-zinc-900 border-white/10 text-zinc-300 hover:text-white'
            }`}
          >
            <span>🔧</span>
            <span>{tuningStage === 0 ? 'OFICINA' : `STAGE ${tuningStage}`}</span>
          </button>

          <button
            type="button"
            onClick={toggleRain}
            className={`px-2.5 py-1 text-xs rounded-lg border font-mono font-bold transition-all cursor-pointer ${
              isRaining
                ? 'bg-blue-600/30 border-blue-400 text-blue-200'
                : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            {isRaining ? '🌧️ CHUVA' : '☀️ SECO'}
          </button>

          <button
            type="button"
            onPointerDown={() => setHorn(true)}
            onPointerUp={() => setHorn(false)}
            onPointerCancel={() => setHorn(false)}
            className="px-2.5 py-1 text-xs rounded-lg border border-white/10 bg-zinc-900 text-zinc-300 hover:text-white font-mono cursor-pointer"
            title="Buzina (Tecla H)"
          >
            📢 Buzina
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 font-mono text-[10px] font-black uppercase tracking-widest text-cyan-300">
            🎛️ MODO PAINEL · INTERIOR DO VEÍCULO
          </span>
          <div className="text-right leading-tight">
            <span className="block text-[9.5px] uppercase font-mono tracking-widest text-zinc-400">
              {vehicle.info.brand}
            </span>
            <h2 className="text-xs sm:text-sm font-bold text-white">
              {carInstance?.vehicleId === vehicle.id ? carInstance.customName : vehicle.info.name}
            </h2>
          </div>
        </div>
      </header>

      {/* Grade Principal de Interior: Esquerda/Centro (Cluster + Multimídia Inferior) | Lateral Direita (Controles + Bancada) */}
      <main className="flex-1 min-h-0 w-full max-w-[1440px] mx-auto grid grid-cols-12 gap-3 overflow-hidden">
        {/* Coluna Central-Esquerda: Painel de Instrumentos (topo/centro) + Central Multimídia (inferior) */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-2.5 min-h-0 overflow-hidden">
          <section
            data-testid="panel-mode-cluster-region"
            className={`${
              hasMultimediaPanel ? 'flex-[1.08]' : 'flex-1'
            } min-h-0 w-full rounded-2xl border border-white/10 bg-black/40 p-2 flex flex-col overflow-hidden`}
          >
            <div className="flex items-center justify-between px-1 pb-1 text-[9px] font-mono text-zinc-400 uppercase tracking-wider flex-shrink-0">
              <span>🧭 Painel de Instrumentos ({vehicle.info.name})</span>
              <span>
                H2O <b className="text-zinc-200">{Math.round(coolantTemp)}°C</b> · Comb.{' '}
                <b className="text-zinc-200">{fuelLevelLiters.toFixed(1)}L</b>
              </span>
            </div>
            <div className="flex-1 min-h-0 w-full flex items-center justify-center relative overflow-hidden">
              <InstrumentClusterPanel
                telemetry={telemetry}
                vehicle={vehicle}
                viewMode="cluster"
                maxScale={1.05}
                hasTurbo={hasTurbo}
                showAftermarketBoostGauge={showAftermarketBoostGauge}
                boostPressureBar={boostPressureBar}
                showPillarGaugePod={true}
              />
            </div>
          </section>

          {hasMultimediaPanel && (
            <section
              data-testid="panel-mode-multimedia-region"
              className="flex-[0.95] min-h-0 w-full rounded-2xl border border-white/10 bg-zinc-950/85 p-2 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-1 pb-1 text-[9px] font-mono text-zinc-400 uppercase tracking-wider flex-shrink-0">
                <span>📺 Console Central & Multimídia</span>
                <span className="text-zinc-500">Áudio · Telemetria · Ajustes Digitais</span>
              </div>
              <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
                <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
              </div>
            </section>
          )}
        </div>

        {/* Coluna Lateral Direita: Controles Físicos da Cabine + Console de Ignição e Giro */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-2.5 min-h-0 overflow-hidden">
          <section
            data-testid="panel-mode-controls-region"
            className="flex-1 min-h-0 w-full rounded-2xl border border-white/10 bg-zinc-950/85 p-2 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-1 pb-1 text-[9px] font-mono text-zinc-400 uppercase tracking-wider flex-shrink-0">
              <span>🎛️ Comandos Físicos do Veículo</span>
              <span className="text-zinc-500">Iluminação · Vidros · Clima/Tração</span>
            </div>
            <div className="flex-1 min-h-0 w-full overflow-y-auto">
              <VehicleControlsPanel vehicle={vehicle} />
            </div>
          </section>

          <div className="flex-shrink-0">{renderBenchConsole(false)}</div>
        </div>
      </main>

      <BackfireFlameFlash />
      <RainWindshieldEffect />
      <BurnoutSmokeEffect />
      <EngineBlownSmokeEffect />

      {isTuningOpen && (
        <TuningGarageModal
          isOpen={true}
          onClose={() => setIsTuningOpen(false)}
          vehicle={vehicle}
          carInstance={carInstance}
        />
      )}
    </div>
  )
})
