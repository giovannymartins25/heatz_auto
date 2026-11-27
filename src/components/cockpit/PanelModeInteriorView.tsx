/**
 * PanelModeInteriorView.tsx — Simulador Independente de Painel e Aceleração (Fase 4.4.3 — Etapa 3).
 *
 * Conceito arquitetural do Modo Painel (`?mode=cluster` / `sessionMode === 'panel'`):
 * - Opera sobre a MESMA `useSimulationStore` e o mesmo `EngineSimulator` / `DeterministicIntegrator` a 120 Hz
 *   (zero simulação paralela, zero tanque paralelo, zero estado duplicado).
 * - NÃO renderiza o veículo no mundo 2D/3D, NÃO executa deslocamento espacial, NÃO exibe mapa, minimapa,
 *   rotas, pistas ou colisões, NÃO consome combustível nem altera autonomia/odômetro.
 * - NÃO exibe volante virtual, direção por inclinação, pedal de freio, pedal de embreagem ou freio de mão.
 * - Hierarquia visual responsiva (Desktop 1280×800, Mobile Portrait 390×844, Mobile Landscape 844×390):
 *   1. Painel de instrumentos como elemento visual principal (hero), com amplo aproveitamento de largura e
 *      proporção original preservada sem deformação.
 *   2. Multimídia posicionada em área dedicada e bem dimensionada (omitida em motocicletas como CB1000R).
 *   3. Controles físicos da cabine integrados em região organizada e acessível (sem esmagamento no topo).
 *   4. Telemetria real ao vivo do motor/sistema elétrico acima do console do Acelerador + Ignição + Câmbio compacto.
 */

import { memo, useState } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { DrivingMode, VehicleConfig } from '@/types'
import { getVehicleCapabilities } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { type GarageCarInstance } from '@/stores/useGarageStore'
import { AnalogPedal } from '@/components/controls/AnalogPedal'
import { DrivingModesSelector, HudIgnitionControl } from '@/components/controls'
import { MobileQuickMenu } from '@/components/dashboard/MobileQuickMenu'
import { BackfireFlameFlash, RainWindshieldEffect } from '@/components/effects'
import { EngineBlownSmokeEffect } from '@/components/effects/EngineBlownSmokeEffect'
import { TuningGarageModal, DynoTestModal } from '@/components/tuning'
import { toggleAppFullscreen } from '@/utils/fullscreen'
import { useSecondaryTouchTapBridge } from '@/utils/multitouchBridge'
import { getShortVehicleName } from '@/utils/vehicleSpecs'
import { getAvailableCockpitPanels } from './cockpitPanels'
import { InstrumentClusterPanel } from './InstrumentClusterPanel'
import { MultimediaPanel } from './MultimediaPanel'
import { VehicleControlsPanel } from './VehicleControlsPanel'

export type PanelModeViewportLayout = 'desktop' | 'mobile_portrait' | 'mobile_landscape'

export interface PanelModeInteriorViewProps {
  layout: PanelModeViewportLayout
  telemetry: DashboardTelemetry
  vehicle: VehicleConfig
  carInstance?: GarageCarInstance
  hasTurbo: boolean
  showAftermarketBoostGauge: boolean
  boostPressureBar: number
  onBack: () => void
}

interface LivePanelTelemetryProps {
  compact?: boolean
  grid?: boolean
  hasBoost: boolean
  boostPressureBar: number
}

const PanelModeLiveTelemetryStrip = memo(function PanelModeLiveTelemetryStrip({
  compact = false,
  grid = false,
  hasBoost,
  boostPressureBar,
}: LivePanelTelemetryProps) {
  const livePowerHp = useSimulationStore((s) => s.livePowerHp)
  const liveTorqueNm = useSimulationStore((s) => s.liveTorqueNm)
  const coolantTemp = useSimulationStore((s) => s.coolantTemp)
  const oilTemp = useSimulationStore((s) => s.oilTemp)
  const batteryVoltageV = useSimulationStore((s) => s.batteryVoltageV)

  const items = [
    {
      key: 'power',
      label: 'POTÊNCIA',
      value: `${Math.round(livePowerHp)} CV`,
      tone: 'text-amber-300',
    },
    {
      key: 'torque',
      label: 'TORQUE',
      value: `${Math.round(liveTorqueNm)} Nm`,
      tone: 'text-cyan-300',
    },
    {
      key: 'coolant',
      label: 'ÁGUA',
      value: `${Math.round(coolantTemp)}°C`,
      tone: coolantTemp >= 112 ? 'text-red-400' : 'text-emerald-300',
    },
    {
      key: 'oil',
      label: 'ÓLEO',
      value: `${Math.round(oilTemp)}°C`,
      tone: oilTemp >= 125 ? 'text-red-400' : 'text-zinc-100',
    },
    {
      key: 'battery',
      label: 'BATERIA',
      value: `${batteryVoltageV.toFixed(1)}V`,
      tone: batteryVoltageV < 11.6 ? 'text-amber-400' : 'text-sky-300',
    },
    ...(hasBoost
      ? [
          {
            key: 'boost',
            label: 'TURBO',
            value: `${boostPressureBar >= 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} bar`,
            tone: boostPressureBar > 0.05 ? 'text-amber-400' : 'text-sky-300',
          },
        ]
      : []),
  ]

  if (grid) {
    return (
      <div
        data-testid="panel-mode-telemetry-strip"
        aria-label="Telemetria real ao vivo do motor"
        className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-zinc-950/90 p-1.5 font-mono"
      >
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-1 rounded-lg border border-white/5 bg-black/60 px-1.5 py-0.5"
          >
            <span className="text-[7px] font-bold text-zinc-500 uppercase">{item.label}</span>
            <strong className={`text-[8.5px] font-black tabular-nums ${item.tone}`}>{item.value}</strong>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      data-testid="panel-mode-telemetry-strip"
      aria-label="Telemetria real ao vivo do motor"
      className={`grid w-full font-mono rounded-xl border border-white/10 bg-zinc-950/90 ${
        compact ? 'px-1.5 py-1 gap-1' : 'p-1.5 gap-1.5'
      }`}
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      }}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className="flex flex-col items-center justify-center rounded-lg border border-white/5 bg-black/55 px-1 py-0.5 leading-tight"
        >
          <span className="text-[6.5px] sm:text-[7px] font-bold text-zinc-500 uppercase tracking-wider truncate max-w-full">
            {item.label}
          </span>
          <strong className={`text-[8.5px] sm:text-[9.5px] font-black tabular-nums whitespace-nowrap ${item.tone}`}>
            {item.value}
          </strong>
        </div>
      ))}
    </div>
  )
})

interface CompactPanelGearBarProps {
  vehicle: VehicleConfig
}

/**
 * Seletor enxuto e integrado de marcha para o Modo Painel:
 * permite acelerar livremente em Ponto Morto (N / P) ou engatar marchas para observar
 * o velocímetro, conta-giros, trocas e turbo reagindo sem exigir embreagem ou freio.
 */
const CompactPanelGearBar = memo(function CompactPanelGearBar({ vehicle }: CompactPanelGearBarProps) {
  const isAutomaticVehicle = useSimulationStore((s) => s.isAutomaticVehicle)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const gearSelectorPosition = useSimulationStore((s) => s.gearSelectorPosition)
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const selectShifterMode = useSimulationStore((s) => s.selectShifterMode)
  const shiftUp = useSimulationStore((s) => s.shiftUp)
  const shiftDown = useSimulationStore((s) => s.shiftDown)
  const shiftNeutral = useSimulationStore((s) => s.shiftNeutral)

  const caps = getVehicleCapabilities(vehicle)

  if (isAutomaticVehicle) {
    const positions = caps.supportedSelectorPositions.filter((p) => p !== 'R')
    const showStepButtons =
      Boolean(vehicle.transmission.hasManualMode) &&
      (gearSelectorPosition === 'M' || transmissionMode === 'manual_simulated')
    return (
      <div
        data-testid="panel-mode-gear-selector"
        className="flex flex-col gap-1 rounded-xl border border-white/10 bg-zinc-950/90 p-1.5 font-mono"
      >
        <div className="flex items-center justify-between text-[7.5px] text-zinc-400 px-0.5">
          <span className="font-bold uppercase tracking-wider">CÂMBIO</span>
          <strong className="text-amber-400 font-black">
            {currentGear === -2
              ? 'P'
              : currentGear === 0
                ? 'N'
                : `${transmissionMode === 'manual_simulated' ? 'M' : gearSelectorPosition}${Math.max(1, currentGear)}`}
          </strong>
        </div>
        <div className="flex items-center gap-1">
          {positions.map((pos) => {
            const active =
              (pos === 'P' && (gearSelectorPosition === 'P' || currentGear === -2)) ||
              (pos === 'N' && gearSelectorPosition === 'N' && currentGear === 0) ||
              (pos === 'M' && (gearSelectorPosition === 'M' || transmissionMode === 'manual_simulated')) ||
              (pos === 'S' && gearSelectorPosition === 'S' && transmissionMode === 'automatic') ||
              (pos === 'D' &&
                gearSelectorPosition === 'D' &&
                transmissionMode === 'automatic' &&
                currentGear > 0)
            return (
              <button
                key={pos}
                type="button"
                disabled={!isRunning}
                onClick={() => selectShifterMode(pos)}
                className={`h-7 flex-1 min-w-[26px] rounded-lg border text-[10px] font-black transition-all active:scale-95 cursor-pointer disabled:opacity-40 ${
                  active
                    ? pos === 'N'
                      ? 'border-emerald-400 bg-emerald-600 text-white'
                      : pos === 'P'
                        ? 'border-amber-300 bg-amber-500 text-black'
                        : pos === 'S'
                          ? 'border-rose-400 bg-rose-600 text-white'
                          : 'border-cyan-400 bg-cyan-600 text-white'
                    : 'border-white/10 bg-zinc-900 text-zinc-300 hover:text-white'
                }`}
              >
                {pos}
              </button>
            )
          })}
        </div>
        {showStepButtons && (
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              disabled={!isRunning}
              onClick={shiftDown}
              className="h-6 rounded-md border border-white/10 bg-zinc-900 text-[9px] font-black text-zinc-200 active:scale-95 cursor-pointer disabled:opacity-40"
            >
              ▼ M-
            </button>
            <button
              type="button"
              disabled={!isRunning}
              onClick={shiftUp}
              className="h-6 rounded-md border border-amber-400/40 bg-zinc-900 text-[9px] font-black text-amber-300 active:scale-95 cursor-pointer disabled:opacity-40"
            >
              M+ ▲
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      data-testid="panel-mode-gear-selector"
      className="flex flex-col gap-1 rounded-xl border border-white/10 bg-zinc-950/90 p-1.5 font-mono"
    >
      <div className="flex items-center justify-between text-[7.5px] text-zinc-400 px-0.5">
        <span className="font-bold uppercase tracking-wider">MARCHA</span>
        <strong className="text-amber-400 font-black">
          {currentGear === 0 ? 'NEUTRO' : currentGear === -1 ? 'RÉ' : `${currentGear}ª`}
        </strong>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <button
          type="button"
          disabled={!isRunning}
          onClick={shiftDown}
          aria-label="Reduzir marcha"
          className="h-7 rounded-lg border border-white/10 bg-zinc-900 text-xs font-black text-zinc-200 active:scale-95 cursor-pointer disabled:opacity-40"
        >
          −
        </button>
        <button
          type="button"
          disabled={!isRunning || currentGear === 0}
          onClick={shiftNeutral}
          aria-label="Engatar Neutro"
          className={`h-7 rounded-lg border text-[10px] font-black active:scale-95 cursor-pointer disabled:opacity-40 ${
            currentGear === 0
              ? 'border-emerald-400 bg-emerald-600/30 text-emerald-300'
              : 'border-white/10 bg-zinc-900 text-zinc-300'
          }`}
        >
          N
        </button>
        <button
          type="button"
          disabled={!isRunning}
          onClick={shiftUp}
          aria-label="Subir marcha"
          className="h-7 rounded-lg border border-amber-400/40 bg-zinc-900 text-xs font-black text-amber-300 active:scale-95 cursor-pointer disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  )
})

export const PanelModeInteriorView = memo(function PanelModeInteriorView({
  layout,
  telemetry,
  vehicle,
  carInstance,
  hasTurbo,
  showAftermarketBoostGauge,
  boostPressureBar,
  onBack,
}: PanelModeInteriorViewProps) {
  const secondaryTouchHandlers = useSecondaryTouchTapBridge()
  const caps = getVehicleCapabilities(vehicle)
  const isMotorcycle = vehicle.info.category === 'motorcycle'
  const hasBoostDisplay = hasTurbo || showAftermarketBoostGauge

  const throttle = useSimulationStore((s) => s.throttle)
  const throttleLock = useSimulationStore((s) => s.throttleLock)
  const setThrottle = useSimulationStore((s) => s.setThrottle)
  const toggleThrottleLock = useSimulationStore((s) => s.toggleThrottleLock)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const isMuted = useSimulationStore((s) => s.isMuted)
  const toggleMute = useSimulationStore((s) => s.toggleMute)
  const isRaining = useSimulationStore((s) => s.isRaining)
  const toggleRain = useSimulationStore((s) => s.toggleRain)
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const setDrivingMode = useSimulationStore((s) => s.setDrivingMode)
  const setHorn = useSimulationStore((s) => s.setHorn)
  const hasNosKit = useSimulationStore((s) => s.hasNosKit)
  const nosActive = useSimulationStore((s) => s.nosActive)
  const nosPressurePercent = useSimulationStore((s) => s.nosPressurePercent)
  const setNosActive = useSimulationStore((s) => s.setNosActive)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isTuningOpen, setIsTuningOpen] = useState(false)
  const [isDynoOpen, setIsDynoOpen] = useState(false)

  const availablePanels = getAvailableCockpitPanels(vehicle, carInstance?.upgrades)
  const hasMultimediaPanel = availablePanels.some((p) => p.id === 'multimedia')
  const supportedModes = caps.supportedDrivingModes

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. MOBILE RETRATO (390×844):
  //    Header -> Hero Cluster -> Multimídia dedicada -> Controles organizados -> Telemetria + Acelerador
  // ═══════════════════════════════════════════════════════════════════════════════
  if (layout === 'mobile_portrait') {
    return (
      <div
        {...secondaryTouchHandlers}
        data-testid="panel-mode-interior-root"
        data-layout="mobile_portrait"
        className="fixed inset-0 z-40 flex h-full w-full flex-col justify-between gap-1.5 overflow-hidden bg-zinc-950 text-white select-none touch-none"
        style={{
          paddingLeft: 'max(0.45rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.45rem, env(safe-area-inset-right))',
          paddingTop: 'max(0.35rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Cabeçalho enxuto */}
        <header className="flex items-center justify-between gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Abrir menu e garagem"
              className="relative h-8 w-8 flex-shrink-0 rounded-xl border border-white/15 bg-zinc-900 text-sm text-zinc-100 flex items-center justify-center active:scale-95 cursor-pointer"
            >
              ☰
              {tuningStage > 0 && (
                <span className="absolute -top-1 -right-1 rounded bg-amber-500 px-1 font-mono text-[6.5px] font-black text-black">
                  S{tuningStage}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onBack}
              aria-label="Voltar à garagem"
              className="h-8 px-2.5 flex-shrink-0 rounded-xl border border-white/15 bg-zinc-900 font-mono text-[9.5px] font-black uppercase text-zinc-200 flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <span>←</span>
              <span>Garagem</span>
            </button>
            <span className="truncate font-mono text-[10px] font-black tracking-wider text-zinc-300">
              {getShortVehicleName(vehicle)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              data-testid="badge-panel-mode"
              className="rounded-full border border-cyan-500/40 bg-cyan-950/70 px-2 py-0.5 font-mono text-[7.5px] font-black uppercase tracking-wider text-cyan-300"
            >
              MODO PAINEL
            </span>
            <button
              type="button"
              onPointerDown={() => setHorn(true)}
              onPointerUp={() => setHorn(false)}
              onPointerLeave={() => setHorn(false)}
              onPointerCancel={() => setHorn(false)}
              aria-label="Buzina"
              className="h-8 w-8 rounded-full border border-white/15 bg-zinc-900 text-xs flex items-center justify-center active:bg-amber-500/20 active:border-amber-400 active:scale-95 cursor-pointer"
            >
              📢
            </button>
          </div>
        </header>

        {/* 1. HERO: Painel de Instrumentos (elemento visual principal em destaque) */}
        <section
          data-testid="panel-mode-cluster-region"
          aria-label="Painel de instrumentos principal"
          className={`${
            hasMultimediaPanel ? 'h-[196px]' : 'flex-1 min-h-[240px]'
          } w-full rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/50 to-black/80 px-1 py-1 flex items-center justify-center relative overflow-hidden flex-shrink-0 shadow-lg`}
        >
          <InstrumentClusterPanel
            telemetry={telemetry}
            vehicle={vehicle}
            viewMode="cluster"
            maxScale={1.25}
            hasTurbo={hasTurbo}
            showAftermarketBoostGauge={showAftermarketBoostGauge}
            boostPressureBar={boostPressureBar}
          />
        </section>

        {/* 2. Multimídia dedicada e bem dimensionada (omitida na motocicleta CB1000R) */}
        {hasMultimediaPanel && (
          <section
            data-testid="panel-mode-multimedia-region"
            aria-label="Multimídia do veículo"
            className="h-[222px] w-full rounded-2xl border border-white/10 bg-zinc-950/90 p-1 flex items-center justify-center overflow-hidden flex-shrink-0"
          >
            <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
          </section>
        )}

        {/* 3. Controles físicos da cabine em região organizada e acessível */}
        <section
          data-testid="panel-mode-controls-region"
          aria-label="Controles físicos da cabine"
          className={`${
            hasMultimediaPanel ? 'flex-1 min-h-[118px]' : 'h-[148px]'
          } w-full rounded-2xl border border-white/10 bg-zinc-950/90 p-1 overflow-y-auto`}
        >
          <VehicleControlsPanel vehicle={vehicle} />
        </section>

        {/* 4. Região inferior: Telemetria real ao vivo + Câmbio enxuto + Acelerador principal + Ignição */}
        <footer
          data-testid="panel-mode-accelerator-deck"
          className="flex flex-col gap-1.5 w-full flex-shrink-0"
        >
          <PanelModeLiveTelemetryStrip
            compact
            hasBoost={hasBoostDisplay}
            boostPressureBar={boostPressureBar}
          />

          <div className="grid grid-cols-[1fr_auto_88px] items-end gap-2 w-full">
            <div className="flex flex-col gap-1 min-w-0">
              {supportedModes.length > 1 && (
                <DrivingModesSelector
                  supportedModes={supportedModes}
                  orientation="horizontal"
                  size="compact"
                  isMotorcycle={isMotorcycle}
                />
              )}
              <CompactPanelGearBar vehicle={vehicle} />
            </div>

            {/* Pedal principal do Acelerador + Trava */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={toggleThrottleLock}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                style={{ touchAction: 'none' }}
                className={`mb-1 rounded-lg border px-2 py-0.5 font-mono text-[7px] font-black uppercase tracking-wider cursor-pointer ${
                  throttleLock
                    ? 'border-amber-300 bg-amber-500 text-black animate-pulse'
                    : 'border-white/10 bg-zinc-900 text-zinc-400'
                }`}
              >
                {throttleLock ? '🔒 TRAVADO' : '🔓 TRAVA'}
              </button>
              <AnalogPedal
                label={isMotorcycle ? 'PUNHO' : 'ACEL'}
                sublabel={isMotorcycle ? 'ACELERAR' : 'GAS'}
                value={throttle}
                onChange={setThrottle}
                colorTheme="accent"
                widthClass="w-16"
                heightClass="h-28"
                disabled={false}
                showPercent={true}
              />
            </div>

            {/* Ignição autêntica do veículo (+ NOS opcional) */}
            <div className="flex flex-col gap-1 items-stretch justify-end">
              {hasNosKit && (
                <button
                  type="button"
                  onPointerDown={() => setNosActive(true)}
                  onPointerUp={() => setNosActive(false)}
                  onPointerLeave={() => setNosActive(false)}
                  onPointerCancel={() => setNosActive(false)}
                  disabled={nosPressurePercent <= 0 || !isRunning}
                  className={`h-9 rounded-xl border font-mono text-[8px] font-black uppercase flex flex-col items-center justify-center cursor-pointer ${
                    nosActive
                      ? 'border-cyan-300 bg-cyan-400 text-black animate-pulse'
                      : 'border-cyan-500/50 bg-cyan-950/70 text-cyan-300 disabled:opacity-40'
                  }`}
                >
                  <span>NOS</span>
                  <span>{Math.round(nosPressurePercent)}%</span>
                </button>
              )}
              <HudIgnitionControl vehicle={vehicle} variant="mobile_portrait" />
            </div>
          </div>
        </footer>

        <BackfireFlameFlash />
        <RainWindshieldEffect />
        <EngineBlownSmokeEffect />

        <MobileQuickMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          vehicle={vehicle}
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. MOBILE PAISAGEM (844×390):
  //    Esquerda/Centro (Hero Cluster amplo no topo + Multimídia e Controles lado a lado)
  //    Direita (Header + Telemetria real ao vivo + Câmbio enxuto + Acelerador + Ignição)
  // ═══════════════════════════════════════════════════════════════════════════════
  if (layout === 'mobile_landscape') {
    return (
      <div
        {...secondaryTouchHandlers}
        data-testid="panel-mode-interior-root"
        data-layout="mobile_landscape"
        className="fixed inset-0 z-40 grid h-full w-full grid-cols-[1fr_178px] gap-1.5 overflow-hidden bg-zinc-950 text-white select-none touch-none"
        style={{
          paddingLeft: 'max(0.4rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.4rem, env(safe-area-inset-right))',
          paddingTop: 'max(0.28rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.28rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Palco Esquerdo/Central: Hero Cluster + [Multimídia | Controles] */}
        <main className="flex h-full min-h-0 min-w-0 flex-col gap-1.5 overflow-hidden">
          {/* 1. HERO: Painel de Instrumentos ocupando toda a largura nobre do palco */}
          <section
            data-testid="panel-mode-cluster-region"
            aria-label="Painel de instrumentos principal"
            className={`${
              hasMultimediaPanel ? 'h-[200px]' : 'flex-1 min-h-0'
            } w-full rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/50 to-black/80 px-1.5 py-1 flex items-center justify-center relative overflow-hidden flex-shrink-0 shadow-lg`}
          >
            <InstrumentClusterPanel
              telemetry={telemetry}
              vehicle={vehicle}
              viewMode="cluster"
              maxScale={1.2}
              hasTurbo={hasTurbo}
              showAftermarketBoostGauge={showAftermarketBoostGauge}
              boostPressureBar={boostPressureBar}
            />
          </section>

          {/* 2 & 3. Multimídia dedicada + Controles físicos organizados lado a lado */}
          <div
            className={`${
              hasMultimediaPanel
                ? 'grid flex-1 min-h-0 w-full grid-cols-[1.15fr_1fr] gap-1.5'
                : 'flex h-[132px] flex-shrink-0 w-full'
            } overflow-hidden`}
          >
            {hasMultimediaPanel && (
              <section
                data-testid="panel-mode-multimedia-region"
                aria-label="Multimídia do veículo"
                className="h-full min-h-0 w-full rounded-xl border border-white/10 bg-zinc-950/90 p-1 flex items-center justify-center overflow-hidden"
              >
                <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
              </section>
            )}

            <section
              data-testid="panel-mode-controls-region"
              aria-label="Controles físicos da cabine"
              className="h-full min-h-0 w-full rounded-xl border border-white/10 bg-zinc-950/90 p-1 overflow-y-auto"
            >
              <VehicleControlsPanel vehicle={vehicle} />
            </section>
          </div>
        </main>

        {/* Coluna Direita: Navegação rápida + Telemetria real + Câmbio + Acelerador + Ignição */}
        <aside
          data-testid="panel-mode-accelerator-deck"
          className="flex h-full min-h-0 flex-col justify-between gap-1 border-l border-white/5 pl-1.5"
        >
          {/* Topo: Menu, Garagem, Badge e Buzina */}
          <div className="flex items-center justify-between gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Abrir menu e garagem"
              className="relative h-7 w-7 flex-shrink-0 rounded-lg border border-white/15 bg-zinc-900 text-xs text-zinc-100 flex items-center justify-center active:scale-95 cursor-pointer"
            >
              ☰
            </button>
            <button
              type="button"
              onClick={onBack}
              aria-label="Voltar à garagem"
              className="h-7 px-1.5 flex-shrink-0 rounded-lg border border-white/15 bg-zinc-900 font-mono text-[8px] font-black uppercase text-zinc-200 flex items-center gap-0.5 active:scale-95 cursor-pointer"
            >
              ← Garagem
            </button>
            <span
              data-testid="badge-panel-mode"
              className="rounded-full border border-cyan-500/40 bg-cyan-950/70 px-1.5 py-0.5 font-mono text-[6.5px] font-black uppercase text-cyan-300"
            >
              PAINEL
            </span>
            <button
              type="button"
              onPointerDown={() => setHorn(true)}
              onPointerUp={() => setHorn(false)}
              onPointerLeave={() => setHorn(false)}
              onPointerCancel={() => setHorn(false)}
              aria-label="Buzina"
              className="h-7 w-7 flex-shrink-0 rounded-full border border-white/15 bg-zinc-900 text-xs flex items-center justify-center active:scale-95 cursor-pointer"
            >
              📢
            </button>
          </div>

          {/* Telemetria real acima do acelerador */}
          <PanelModeLiveTelemetryStrip
            grid
            hasBoost={hasBoostDisplay}
            boostPressureBar={boostPressureBar}
          />

          {/* Modos de condução + Seletor compacto de câmbio */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            {supportedModes.length > 1 && (
              <DrivingModesSelector
                supportedModes={supportedModes}
                orientation="horizontal"
                size="compact"
                isMotorcycle={isMotorcycle}
              />
            )}
            <CompactPanelGearBar vehicle={vehicle} />
          </div>

          {/* Base ergonômica: Acelerador principal + Ignição real */}
          <div className="grid grid-cols-[1fr_84px] items-end gap-1.5 flex-shrink-0">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={toggleThrottleLock}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                style={{ touchAction: 'none' }}
                className={`mb-0.5 w-full rounded-md border py-0.5 font-mono text-[6.5px] font-black uppercase cursor-pointer ${
                  throttleLock
                    ? 'border-amber-300 bg-amber-500 text-black animate-pulse'
                    : 'border-white/10 bg-zinc-900 text-zinc-400'
                }`}
              >
                {throttleLock ? '🔒 TRAV' : '🔓 TRAVA'}
              </button>
              <AnalogPedal
                label={isMotorcycle ? 'PUNHO' : 'ACEL'}
                sublabel={isMotorcycle ? 'ACELERAR' : 'GAS'}
                value={throttle}
                onChange={setThrottle}
                colorTheme="accent"
                widthClass="w-full"
                heightClass="h-[104px]"
                disabled={false}
                showPercent={true}
              />
            </div>

            <div className="flex flex-col gap-1 items-stretch justify-end">
              {hasNosKit && (
                <button
                  type="button"
                  onPointerDown={() => setNosActive(true)}
                  onPointerUp={() => setNosActive(false)}
                  onPointerLeave={() => setNosActive(false)}
                  onPointerCancel={() => setNosActive(false)}
                  disabled={nosPressurePercent <= 0 || !isRunning}
                  className={`h-7 rounded-lg border font-mono text-[7.5px] font-black uppercase cursor-pointer ${
                    nosActive
                      ? 'border-cyan-300 bg-cyan-400 text-black animate-pulse'
                      : 'border-cyan-500/50 bg-cyan-950/70 text-cyan-300 disabled:opacity-40'
                  }`}
                >
                  NOS {Math.round(nosPressurePercent)}%
                </button>
              )}
              <HudIgnitionControl vehicle={vehicle} variant="mobile_landscape" />
            </div>
          </div>
        </aside>

        <BackfireFlameFlash />
        <RainWindshieldEffect />
        <EngineBlownSmokeEffect />

        <MobileQuickMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          vehicle={vehicle}
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. DESKTOP (1280×800+):
  //    Header limpo -> Hero Cluster gigante centralizado ->
  //    Deck inferior em colunas equilibradas: [Multimídia | Controles da Cabine | Telemetria + Acelerador + Ignição]
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div
      data-testid="panel-mode-interior-root"
      data-layout="desktop"
      className="flex h-dvh max-h-dvh w-full flex-col justify-between gap-2 overflow-hidden bg-[var(--color-bg-primary)] px-3 py-2 text-white select-none"
    >
      {/* Cabeçalho Desktop do Modo Painel (sem botões de Mapa ou 402M Drag) */}
      <header className="mx-auto flex w-full max-w-[1380px] flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] hover:border-red-500/50 hover:text-white transition-all active:scale-95 cursor-pointer"
          >
            ← Garagem
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition-all cursor-pointer ${
              isMuted
                ? 'border-red-500 bg-red-500/20 text-red-400'
                : 'border-white/10 bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            {isMuted ? '🔇 Mudo' : '🔊 Som'}
          </button>

          <button
            type="button"
            data-fullscreen-toggle
            onClick={() => void toggleAppFullscreen()}
            className="hidden sm:inline-flex rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            ⛶ Fullscreen
          </button>

          <button
            type="button"
            onClick={() => setIsTuningOpen(true)}
            className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
              tuningStage > 0
                ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                : 'border-white/10 bg-zinc-900 text-zinc-300 hover:text-white'
            }`}
          >
            <span>🔧</span>
            <span>{tuningStage === 0 ? 'OFICINA' : `STAGE ${tuningStage}`}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDynoOpen(true)}
            className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1 font-mono text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
          >
            <span>📈</span>
            <span>DYNO</span>
          </button>

          <button
            type="button"
            onClick={toggleRain}
            className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-bold transition-all cursor-pointer ${
              isRaining
                ? 'border-blue-400 bg-blue-600/30 text-blue-200'
                : 'border-white/10 bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            {isRaining ? '🌧️ CHUVA' : '☀️ SECO'}
          </button>
        </div>

        <span
          data-testid="badge-panel-mode"
          className="rounded-full border border-cyan-500/40 bg-cyan-950/60 px-3.5 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-cyan-300"
        >
          🎛️ MODO PAINEL · SIMULADOR DE ACELERAÇÃO
        </span>

        <div className="text-right leading-tight">
          <span className="block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            {vehicle.info.brand}
          </span>
          <h2 className="text-xs sm:text-sm font-bold text-white">
            {carInstance?.vehicleId === vehicle.id ? carInstance.customName : vehicle.info.name}
          </h2>
        </div>
      </header>

      {/* 1. HERO: Painel de Instrumentos como Elemento Visual Principal (ampla largura + proporção preservada) */}
      <section
        data-testid="panel-mode-cluster-region"
        aria-label="Painel de instrumentos principal"
        className="mx-auto flex flex-[1.15] min-h-[270px] max-h-[395px] w-full max-w-[1220px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/45 via-zinc-950/80 to-black px-4 py-2 relative shadow-2xl"
      >
        <InstrumentClusterPanel
          telemetry={telemetry}
          vehicle={vehicle}
          viewMode="cluster"
          maxScale={1.32}
          hasTurbo={hasTurbo}
          showAftermarketBoostGauge={showAftermarketBoostGauge}
          boostPressureBar={boostPressureBar}
          showPillarGaugePod={true}
        />
      </section>

      {/* 2, 3 & 4. Deck Inferior Equilibrado: Multimídia + Controles da Cabine + Console de Aceleração e Telemetria */}
      <div
        className={`mx-auto grid flex-1 min-h-[275px] max-h-[355px] w-full max-w-[1280px] gap-2.5 overflow-hidden ${
          hasMultimediaPanel ? 'grid-cols-[1.18fr_1fr_340px]' : 'grid-cols-[1fr_360px]'
        }`}
      >
        {/* 2. Multimídia dedicada e bem dimensionada */}
        {hasMultimediaPanel && (
          <section
            data-testid="panel-mode-multimedia-region"
            aria-label="Multimídia do veículo"
            className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 p-2 shadow-xl"
          >
            <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
          </section>
        )}

        {/* 3. Controles físicos da cabine + Modos de Condução integrados sem compressão */}
        <section
          data-testid="panel-mode-controls-region"
          aria-label="Controles físicos da cabine"
          className="flex h-full min-h-0 w-full flex-col gap-1.5 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 p-2 shadow-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-1 flex-shrink-0">
            <span className="font-mono text-[9px] font-black uppercase tracking-wider text-zinc-300">
              🎛️ Controles da Cabine
            </span>

            {supportedModes.length > 1 && (
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 p-0.5">
                {supportedModes.map((mode) => {
                  const active = drivingMode === mode
                  const label = isMotorcycle
                    ? mode === 'eco'
                      ? 'RAIN'
                      : mode === 'normal'
                        ? 'STD'
                        : 'SPORT'
                    : mode.toUpperCase()
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDrivingMode(mode as DrivingMode)}
                      className={`rounded-full px-2 py-0.5 font-mono text-[8.5px] font-black uppercase transition-all cursor-pointer ${
                        active
                          ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/60'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 w-full overflow-y-auto">
            <VehicleControlsPanel vehicle={vehicle} />
          </div>
        </section>

        {/* 4. Console de Telemetria ao Vivo + Acelerador Principal + Câmbio Integrado + Ignição */}
        <section
          data-testid="panel-mode-accelerator-deck"
          aria-label="Console de aceleração e telemetria ao vivo"
          className="flex h-full min-h-0 w-full flex-col justify-between gap-1.5 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 p-2 shadow-xl"
        >
          {/* Telemetria real ao vivo acima do acelerador */}
          <PanelModeLiveTelemetryStrip
            grid
            hasBoost={hasBoostDisplay}
            boostPressureBar={boostPressureBar}
          />

          {/* Câmbio enxuto integrado (sem Ré desnecessária no Modo Painel) */}
          <CompactPanelGearBar vehicle={vehicle} />

          {/* Linha inferior compacta: Buzina/NOS + Acelerador Principal + Ignição do Veículo */}
          <div className="flex items-end justify-between gap-2 min-h-0">
            <div className="flex flex-col gap-1 items-center">
              <button
                type="button"
                onPointerDown={() => setHorn(true)}
                onPointerUp={() => setHorn(false)}
                onPointerCancel={() => setHorn(false)}
                title="Buzina (Tecla H)"
                aria-label="Buzina"
                className="h-8 w-8 rounded-xl border border-white/10 bg-zinc-900 text-xs flex items-center justify-center active:bg-amber-500/20 active:border-amber-400 active:scale-95 cursor-pointer"
              >
                📢
              </button>

              {hasNosKit && (
                <button
                  type="button"
                  onPointerDown={() => setNosActive(true)}
                  onPointerUp={() => setNosActive(false)}
                  onPointerCancel={() => setNosActive(false)}
                  disabled={nosPressurePercent <= 0 || !isRunning}
                  className={`rounded-xl border px-2 py-1 font-mono text-[8px] font-black uppercase cursor-pointer ${
                    nosActive
                      ? 'border-cyan-300 bg-cyan-400 text-black animate-pulse'
                      : 'border-cyan-500/50 bg-cyan-950/70 text-cyan-300 disabled:opacity-40'
                  }`}
                >
                  NOS {Math.round(nosPressurePercent)}%
                </button>
              )}
            </div>

            {/* Acelerador Principal (sem freio, sem embreagem, sem freio de mão) */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={toggleThrottleLock}
                className={`mb-0.5 rounded-md border px-2 py-0.5 font-mono text-[7.5px] font-black uppercase tracking-wider cursor-pointer ${
                  throttleLock
                    ? 'border-amber-300 bg-amber-500 text-black animate-pulse'
                    : 'border-white/10 bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
                title="Travar acelerador em 100%"
              >
                {throttleLock ? '🔒 TRAVADO' : '🔓 TRAVA'}
              </button>
              <AnalogPedal
                label={isMotorcycle ? 'PUNHO' : 'ACEL'}
                sublabel="TECLA W"
                value={throttle}
                onChange={setThrottle}
                colorTheme="accent"
                widthClass="w-15"
                heightClass="h-[78px]"
                disabled={false}
                showPercent={true}
              />
            </div>

            {/* Ignição autêntica do veículo (Start/Stop ou Chave Física) */}
            <HudIgnitionControl vehicle={vehicle} variant="mobile_landscape" />
          </div>
        </section>
      </div>

      <BackfireFlameFlash />
      <RainWindshieldEffect />
      <EngineBlownSmokeEffect />

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
})
