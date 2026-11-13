import { memo, useState } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore } from '@/stores/useUIStore'
import { useGarageStore, type GarageCarInstance } from '@/stores/useGarageStore'
import { useInteriorAccessories } from '@/hooks/useInteriorAccessories'
import { AnalogPedal } from '@/components/controls/AnalogPedal'
import { GearShift } from '@/components/controls/GearShift'
import { QuickClutchButton, MobileStartButton, DrivingModesSelector, AutomaticShiftButton } from '@/components/controls'
import { VehicleDashboardCluster } from './VehicleDashboardCluster'
import { DrivingMapViewport } from './DrivingMapViewport'
import { InfotainmentScreen } from './InfotainmentScreen'
import { MobileQuickMenu } from './MobileQuickMenu'
import { formatZeroToHundredSeconds } from '@/systems/vehicle'
import { formatVehicleHeaderInfo } from '@/utils/vehicleSpecs'
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
}

/**
 * MobileLandscapeCockpit — Layout horizontal dedicado para dispositivos móveis.
 *
 * - Polegar esquerdo: pedais analógicos (embreagem, freio, acelerador).
 * - Centro: barra superior limpa (Menu ☰ · Carro · Visão · Modo) + painel.
 * - Polegar direito: Embreagem 100% / Buzina / NOS no topo, câmbio no meio
 *   e Freio de mão + START na base.
 * - Atalhos secundários ficam no menu ☰ (Oficina, 402M, Dyno, Escape, Faróis, Clima, TCS, Som).
 */
export const MobileLandscapeCockpit = memo(function MobileLandscapeCockpit({
  telemetry,
  vehicle,
  onBack,
  carInstance,
}: MobileLandscapeCockpitProps) {
  const throttle = useSimulationStore((s) => s.throttle)
  const throttleLock = useSimulationStore((s) => s.throttleLock)
  const toggleThrottleLock = useSimulationStore((s) => s.toggleThrottleLock)
  const brake = useSimulationStore((s) => s.brake)
  const clutchPosition = useSimulationStore((s) => s.clutchPosition)
  const setThrottle = useSimulationStore((s) => s.setThrottle)
  const setBrake = useSimulationStore((s) => s.setBrake)
  const setClutch = useSimulationStore((s) => s.setClutch)

  const isRunning = useSimulationStore((s) => s.isRunning)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
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
  const purgeNos = useSimulationStore((s) => s.purgeNos)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isTuningOpen, setIsTuningOpen] = useState(false)
  const [isDragStripOpen, setIsDragStripOpen] = useState(false)
  const [isDynoOpen, setIsDynoOpen] = useState(false)

  const hasClutch = vehicle.transmission.hasClutch ?? false
  const isMotorcycle = vehicle.info.category === 'motorcycle'
  const supportedModes = vehicle.transmission.supportedModes || []
  const resolveInstanceForVehicle = useGarageStore((s) => s.resolveInstanceForVehicle)
  const activeCar = carInstance || resolveInstanceForVehicle(vehicle.id)
  const { hasInfotainment, showAftermarketBoostGauge } = useInteriorAccessories(vehicle)
  const [centerMode, setCenterMode] = useState<'cluster' | 'multimedia' | 'hud'>('hud')
  const mapViewportSize = useUIStore((s) => s.mapViewportSize)
  const setMapViewportSize = useUIStore((s) => s.setMapViewportSize)
  const vehicleHeader = formatVehicleHeaderInfo(vehicle)

  const viewTabs: { id: 'cluster' | 'hud' | 'multimedia'; label: string }[] = [
    { id: 'cluster', label: 'PAINEL' },
    { id: 'hud', label: 'DIRIGIR' },
    ...(hasInfotainment ? [{ id: 'multimedia' as const, label: 'MÍDIA' }] : []),
  ]
  const hasActiveAlert =
    telemetry.engine.isBogWarning ||
    (hasClutch && telemetry.clutchTelemetry.isSlipping) ||
    telemetry.shiftLight.isActive ||
    !isRunning

  return (
    <div
      className="fixed inset-0 w-screen h-dvh bg-zinc-950 text-white flex flex-col select-none touch-none overflow-hidden z-40"
      style={{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        paddingTop: 'max(0.45rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.45rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* ═══ CABEÇALHO SUPERIOR UNIFICADO ═══ */}
      <header className="flex items-center justify-between gap-2 w-full pb-1 border-b border-white/5 flex-shrink-0">
        {/* Esquerda (alinhada acima da coluna de pedais): Menu ☰ + Carro + Ficha */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="relative w-9 h-9 flex-shrink-0 rounded-xl bg-zinc-900 border border-white/15 hover:bg-zinc-800 text-zinc-100 text-base flex items-center justify-center active:scale-95 cursor-pointer"
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

          <div className="min-w-0 leading-tight max-w-[185px] sm:max-w-[260px]">
            <span className="block text-[11px] sm:text-xs font-bold text-white tracking-tight truncate">
              {vehicleHeader.title}
            </span>
            <span className="block text-[8.5px] font-mono text-zinc-400 tracking-wide truncate">
              {vehicleHeader.specsSummary}
            </span>
          </div>
        </div>

        {/* Centro: Abas de visão + Modo */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-xl border border-white/10 flex-shrink-0">
            {viewTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCenterMode(tab.id)}
                className={`h-7 px-2.5 text-[9px] font-mono font-black rounded-lg transition-all cursor-pointer ${
                  centerMode === tab.id ? 'bg-white text-zinc-950 shadow' : 'text-zinc-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {supportedModes.length > 0 && (
            <span className="hidden xs:inline-flex text-[8.5px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-lg border bg-zinc-900 border-white/10 text-zinc-400">
              MODO: <b className="text-white ml-1">{drivingMode}</b>
            </span>
          )}
        </div>

        {/* Direita superior: Buzina + TCS circulares e 0–100 km/h imediatamente abaixo */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onPointerDown={() => setHorn(true)}
              onPointerUp={() => setHorn(false)}
              onPointerLeave={() => setHorn(false)}
              onPointerCancel={() => setHorn(false)}
              className="w-7 h-7 rounded-full bg-zinc-900 border border-white/15 active:bg-amber-500/20 active:border-amber-400 flex items-center justify-center text-xs transition-all active:scale-95 cursor-pointer"
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
                className={`w-9 h-9 rounded-full border font-mono font-black leading-none flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 ${
                  !tcsEnabled
                    ? 'bg-zinc-900 text-zinc-500 border-zinc-700 opacity-75'
                    : telemetry.tcs.intervening
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.45)] animate-pulse'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/60'
                }`}
              >
                <span className="text-[8.5px]">TCS</span>
                <span className="text-[6.5px] opacity-85">{tcsEnabled ? 'ON' : 'OFF'}</span>
              </button>
            )}
          </div>

          <div
            aria-label="Cronômetro 0 a 100 km/h"
            className={`px-2 py-0.5 rounded-full bg-zinc-900/95 border text-[8.5px] font-mono leading-none flex items-center gap-1 whitespace-nowrap ${
              isTiming0to100 ? 'border-amber-400/60 text-amber-300' : 'border-white/10 text-zinc-400'
            }`}
          >
            <span>0–100 km/h</span>
            <b className={last0to100 !== null ? 'text-amber-400 font-black' : 'text-zinc-500 font-bold'}>
              {formatZeroToHundredSeconds(last0to100)}
            </b>
          </div>
        </div>
      </header>

      {/* ═══ CORPO PRINCIPAL (PEDAIS · MAPA/PAINEL · CÂMBIO) ═══ */}
      <div className="flex-1 flex min-h-0 w-full">
        {/* ═══ 1. ESQUERDA: PEDAIS & QUICKCLUTCH (POLEGAR ESQUERDO) ═══ */}
        <aside className="flex items-end justify-center gap-2 sm:gap-2.5 h-full py-1 pr-2 border-r border-white/5 flex-shrink-0">
          {hasClutch && (
            <div className="flex flex-col items-center justify-end gap-1.5 h-full">
              <QuickClutchButton
                layout="stack"
                className="w-13 sm:w-14 h-11 flex-shrink-0"
                label={isMotorcycle ? 'MANETE' : 'EMBR'}
                sublabel={isMotorcycle ? '100%' : '100%'}
              />
              <AnalogPedal
                label={isMotorcycle ? 'MANETE' : 'EMBR'}
                sublabel={isMotorcycle ? 'EMBREAGEM' : 'CLUTCH'}
                value={clutchPosition}
                onChange={setClutch}
                colorTheme="amber"
                widthClass="w-13 sm:w-14"
                heightClass="h-[50dvh]"
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
            widthClass="w-13 sm:w-14"
            heightClass="h-[64dvh]"
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
              className={`w-13 sm:w-14 py-1 mb-1 rounded-xl font-mono text-[8px] font-black uppercase tracking-wider border transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-0.5 ${
                throttleLock
                  ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.85)] animate-pulse'
                  : 'bg-zinc-900/90 text-zinc-400 border-white/10 hover:text-white'
              }`}
              title="Travar acelerador em 100% (solta ao pisar no freio)"
            >
              <span>{throttleLock ? '🔒' : '🔓'}</span>
              <span>{throttleLock ? 'TRAVADO' : 'TRAVA'}</span>
            </button>
            <AnalogPedal
              label={isMotorcycle ? 'PUNHO' : 'ACEL'}
              sublabel={isMotorcycle ? 'ACELERAR' : 'GAS'}
              value={throttle}
              onChange={setThrottle}
              colorTheme="accent"
              widthClass="w-13 sm:w-14"
              heightClass="h-[56dvh]"
              disabled={false}
              showPercent={true}
            />
          </div>
        </aside>

        {/* ═══ 2. CENTRO: MAPA + PAINEL ═══ */}
        <main className={`flex-1 flex flex-col items-center py-0.5 min-w-0 h-full ${centerMode === 'cluster' ? 'px-0.5' : 'px-1 sm:px-1.5'}`}>

        {isLaunchControlArmed && (
          <div className="w-full py-1 px-2 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 text-center text-[10px] font-mono font-black animate-pulse my-0.5">
            🏁 LAUNCH CONTROL ATIVO · SOLTE O FREIO PARA LARGAR!
          </div>
        )}
        {isLaunching && (
          <div className="w-full py-1 px-2 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-center text-[10px] font-mono font-black my-0.5">
            🚀 LARGADA!
          </div>
        )}

        {/* Conteúdo central */}
        <div className="relative w-full flex-1 flex items-center justify-center min-h-0 self-stretch">
          {/* Botões de Troca de Marcha (- na esquerda e + na direita, posicionados mais para cima) */}
          <div className="absolute left-2 top-2 z-30 pointer-events-auto">
            <AutomaticShiftButton direction="down" />
          </div>
          <div className="absolute right-2 top-2 z-30 pointer-events-auto">
            <AutomaticShiftButton direction="up" />
          </div>

          {centerMode === 'cluster' ? (
            <div className="w-full h-full flex items-center justify-center relative min-h-0 self-stretch">
              <VehicleDashboardCluster telemetry={telemetry} expanded={true} />
              {(hasTurbo || showAftermarketBoostGauge) && (
                <span className="pointer-events-none absolute top-0.5 right-16 px-2 py-0.5 rounded-full bg-black/85 border border-amber-500/40 text-[9px] font-mono text-amber-300">
                  TURBO{' '}
                  <b>{boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR</b>
                </span>
              )}
            </div>
          ) : centerMode === 'multimedia' ? (
            <div className="w-full h-full flex items-center justify-center min-h-0 self-stretch">
              <InfotainmentScreen vehicle={vehicle} telemetry={telemetry} compact={false} />
            </div>
          ) : (
            <div className="flex-1 flex min-h-0 w-full h-full flex-col gap-1 overflow-hidden self-stretch items-center">
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

              {/* 2. PAINEL ORIGINAL DO VEÍCULO — IMEDIATAMENTE ABAIXO DO MAPA */}
              <div className="w-full flex-1 flex items-center justify-center min-h-0 self-stretch">
                <VehicleDashboardCluster telemetry={telemetry} />
              </div>
            </div>
          )}
        </div>

        {/* Alertas (oculta barra vazia para ampliar o cluster) */}
        {hasActiveAlert && (
          <div className="flex items-center justify-center gap-2 h-6 w-full flex-shrink-0">
          {telemetry.engine.isBogWarning && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500 text-yellow-300 text-[9px] font-mono font-black animate-pulse">
              MOTOR AMARRANDO
            </span>
          )}
          {hasClutch && telemetry.clutchTelemetry.isSlipping && (
            <span className="px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500 text-orange-400 text-[9px] font-mono font-black animate-pulse">
              PATINANDO {Math.round(telemetry.clutchTelemetry.slipRpm)} RPM
            </span>
          )}
          {telemetry.shiftLight.isActive && (
            <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-mono font-black text-[10px] animate-bounce">
              ▲ TROQUE DE MARCHA!
            </span>
          )}
          {!isRunning && (
            <span
              className={`px-3 py-0.5 rounded-full border font-mono font-black text-[10px] ${
                telemetry.engine.isStalled
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 animate-pulse'
                  : 'bg-white/5 border-white/10 text-zinc-400'
              }`}
            >
              {telemetry.engine.isStalled ? '⚠️ MOTOR APAGOU · RELIGUE NO START ↘' : 'MOTOR DESLIGADO · TOQUE EM START ↘'}
            </span>
          )}
          </div>
        )}
      </main>

      {/* ═══ 3. DIREITA: CONTROLES (POLEGAR DIREITO) ═══ */}
      <aside className="flex flex-col items-stretch justify-between h-full py-1 pl-2 border-l border-white/5 flex-shrink-0 w-[132px] sm:w-[150px] gap-1.5">
        {/* Topo: Moto / NOS (Buzina e TCS no topo direito do cabeçalho) */}
        <div className="flex flex-col gap-1.5">
          {isMotorcycle && (
            <button
              type="button"
              onPointerDown={() => setBrake(1)}
              onPointerUp={() => setBrake(0)}
              onPointerLeave={() => setBrake(0)}
              onPointerCancel={() => setBrake(0)}
              className="h-11 rounded-xl border border-red-400/50 bg-red-950/50 font-mono text-[9px] font-black text-red-200 active:bg-red-500/40"
              aria-label="Manete de freio dianteiro"
            >
              F. DIANTEIRO
            </button>
          )}

          {hasNosKit && (
            <div className="grid grid-cols-[1fr_40px] gap-1.5">
              <button
                type="button"
                onPointerDown={() => setNosActive(true)}
                onPointerUp={() => setNosActive(false)}
                onPointerLeave={() => setNosActive(false)}
                onPointerCancel={() => setNosActive(false)}
                disabled={nosPressurePercent <= 0 || !isRunning}
                className={`h-10 rounded-xl border-2 font-mono text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  nosActive
                    ? 'bg-cyan-400 text-black border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.9)] animate-pulse'
                    : nosPressurePercent <= 0
                    ? 'bg-zinc-900/50 text-zinc-600 border-zinc-800'
                    : 'bg-cyan-950/70 text-cyan-300 border-cyan-500/50'
                }`}
                title="Segure para disparar Nitro"
              >
                <span>NOS</span>
                <span>{Math.round(nosPressurePercent)}%</span>
              </button>
              <button
                type="button"
                onClick={purgeNos}
                disabled={nosPressurePercent <= 0}
                className="h-10 rounded-xl border border-sky-400/40 bg-sky-950/50 text-sky-300 text-sm transition-all active:scale-95 cursor-pointer"
                title="Purga de Nitro"
              >
                💨
              </button>
            </div>
          )}
        </div>

        {/* Meio: Perfis de Condução (ECO, NORMAL, SPORT) & Câmbio */}
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 min-h-0 w-full py-1">
          {supportedModes.length > 0 && (
            <DrivingModesSelector
              supportedModes={supportedModes}
              orientation="grid"
              size="compact"
              showTitle={true}
              className="w-full"
            />
          )}
          <GearShift orientation="vertical" size="compact" showPaddles={false} />
        </div>

        {/* Base: Freio de mão + START */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={toggleHandbrake}
            className={`h-14 rounded-2xl border font-mono font-black uppercase leading-none flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer ${
              handbrake
                ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.8)]'
                : 'bg-zinc-900 border-white/10 text-zinc-400'
            }`}
            aria-label="Freio de mão"
          >
            <span className="text-[13px]">(P)</span>
            <span className="text-[7px] mt-0.5">{handbrake ? 'PUXADO' : 'F. MÃO'}</span>
          </button>
          <MobileStartButton variant="square" className="h-14 w-full" />
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
