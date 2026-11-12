import { memo, useState } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useGarageStore, type GarageCarInstance } from '@/stores/useGarageStore'
import { useInteriorAccessories } from '@/hooks/useInteriorAccessories'
import { AnalogPedal } from '@/components/controls/AnalogPedal'
import { GearShift } from '@/components/controls/GearShift'
import { QuickClutchButton, MobileStartButton, DrivingModesSelector } from '@/components/controls'
import { WarningLights, AuxGauges } from '@/components/gauges'
import { VehicleDashboardCluster } from './VehicleDashboardCluster'
import { DrivingMapViewport } from './DrivingMapViewport'
import { useUIStore } from '@/stores/useUIStore'
import { InfotainmentScreen } from './InfotainmentScreen'
import { MobileQuickMenu } from './MobileQuickMenu'
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
}

/**
 * MobilePortraitCockpit — Layout vertical otimizado para celulares em modo Retrato.
 *
 * Organização (de cima para baixo):
 *  1. Barra superior limpa: Menu ☰ · Nome do carro · Alternador de visão
 *  2. Faixa de status: luzes de alerta · 0-100 · modo de condução
 *  3. Painel central (HUD / Painel real / Multimídia)
 *  4. Câmbio
 *  5. Zona dos polegares: [Buzina · Freio de mão · START] [Pedais] [NOS · Embreagem 100%]
 *
 * Todos os atalhos secundários (Oficina, 402M, Dyno, Escape, Faróis, Clima, TCS, Som)
 * ficam no menu ☰ com botões grandes.
 */
export const MobilePortraitCockpit = memo(function MobilePortraitCockpit({
  telemetry,
  vehicle,
  onBack,
  carInstance,
}: MobilePortraitCockpitProps) {
  const throttle = useSimulationStore((s) => s.throttle)
  const brake = useSimulationStore((s) => s.brake)
  const clutchPosition = useSimulationStore((s) => s.clutchPosition)
  const setThrottle = useSimulationStore((s) => s.setThrottle)
  const setBrake = useSimulationStore((s) => s.setBrake)
  const setClutch = useSimulationStore((s) => s.setClutch)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const tcsEnabled = useSimulationStore((s) => s.tcsEnabled)
  const setHorn = useSimulationStore((s) => s.setHorn)
  const toggleHandbrake = useSimulationStore((s) => s.toggleHandbrake)
  const handbrake = useSimulationStore((s) => s.handbrake)
  const current0to100 = useSimulationStore((s) => s.current0to100)
  const best0to100 = useSimulationStore((s) => s.best0to100)
  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const hasTurbo = useSimulationStore((s) => s.hasTurbo)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const hasNosKit = useSimulationStore((s) => s.hasNosKit)
  const nosActive = useSimulationStore((s) => s.nosActive)
  const nosPressurePercent = useSimulationStore((s) => s.nosPressurePercent)
  const setNosActive = useSimulationStore((s) => s.setNosActive)
  const purgeNos = useSimulationStore((s) => s.purgeNos)
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const toggleSimulatedManual = useSimulationStore((s) => s.toggleSimulatedManual)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isTuningOpen, setIsTuningOpen] = useState(false)
  const [isDragStripOpen, setIsDragStripOpen] = useState(false)
  const [isDynoOpen, setIsDynoOpen] = useState(false)

  const hasClutch = vehicle.transmission.hasClutch ?? false
  const isMotorcycle = vehicle.info.category === 'motorcycle'
  const isCvtWithManual = vehicle.transmission.hasManualMode === true && !hasClutch
  const isManualSimulated = transmissionMode === 'manual_simulated'
  const supportedModes = vehicle.transmission.supportedModes || []
  const resolveInstanceForVehicle = useGarageStore((s) => s.resolveInstanceForVehicle)
  const activeCar = carInstance || resolveInstanceForVehicle(vehicle.id)
  const { hasInfotainment, showAftermarketBoostGauge } = useInteriorAccessories(vehicle)
  const [portraitMode, setPortraitMode] = useState<'cluster' | 'multimedia' | 'hud' | 'legacy'>('hud')
  const mapViewportSize = useUIStore((s) => s.mapViewportSize)
  const setMapViewportSize = useUIStore((s) => s.setMapViewportSize)

  const displaySpeed = Math.round(telemetry.speedometer.speed)
  const displayRpm = Math.round(telemetry.tachometer.rpm)
  const maxRpm = vehicle.engine.maxRpm

  // Larguras dos pedais adaptadas para caber 3 pedais + colunas laterais
  const pedalWidth = hasClutch ? 'w-11 sm:w-13' : 'w-14 sm:w-16'
  const pedalHeight = 'h-36 sm:h-44'

  const viewTabs: { id: 'hud' | 'cluster' | 'multimedia'; label: string }[] = [
    { id: 'hud', label: 'DIRIGIR' },
    { id: 'cluster', label: 'PAINEL' },
    ...(hasInfotainment ? [{ id: 'multimedia' as const, label: 'MÍDIA' }] : []),
  ]

  return (
    <div
      className="fixed inset-0 w-screen h-dvh bg-zinc-950 text-white flex flex-col select-none touch-none overflow-hidden z-40"
      style={{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* ─── 1. Barra superior limpa ─── */}
      <header className="flex items-center gap-2 w-full pb-1.5">
        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          className="relative w-10 h-10 flex-shrink-0 rounded-xl bg-zinc-900 border border-white/10 text-zinc-200 text-lg flex items-center justify-center active:scale-95 cursor-pointer"
          aria-label="Abrir menu"
        >
          ☰
          {tuningStage > 0 && (
            <span className="absolute -top-1 -right-1 px-1 rounded bg-amber-500 text-black text-[7px] font-black font-mono">
              S{tuningStage}
            </span>
          )}
        </button>

        <div className="flex-1 min-w-0 leading-tight">
          <span className="block text-[8px] font-mono text-zinc-500 uppercase tracking-widest truncate">
            {vehicle.info.brand}
          </span>
          <span className="block text-[13px] font-bold text-white tracking-tight truncate">{vehicle.info.name}</span>
        </div>

        {/* Alternador de visão */}
        <div className="flex items-center bg-zinc-900 p-0.5 rounded-xl border border-white/10 flex-shrink-0">
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPortraitMode(tab.id)}
              className={`h-8 px-2.5 text-[9px] font-mono font-black rounded-lg transition-all cursor-pointer ${
                portraitMode === tab.id ? 'bg-white text-zinc-950 shadow' : 'text-zinc-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ─── 2. Faixa de status ─── */}
      <div className="flex items-center justify-between w-full gap-2 pb-1 border-b border-white/5 text-[9px] font-mono">
        <div className="flex items-center gap-1.5 min-w-0">
          <WarningLights lights={telemetry.warningLights} />
          <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-white/10 text-zinc-500 whitespace-nowrap">
            0-100{' '}
            <b className="text-amber-400">
              {best0to100 ? `${best0to100.toFixed(2)}s` : current0to100 ? `${current0to100.toFixed(2)}s` : '--'}
            </b>
          </span>
          {vehicle.transmission.tcs?.enabled && (
            <span
              className={`px-1.5 py-0.5 rounded-full border font-black ${
                !tcsEnabled
                  ? 'text-zinc-600 border-zinc-800 line-through'
                  : telemetry.tcs.intervening
                  ? 'text-amber-300 border-amber-500 animate-pulse'
                  : 'text-emerald-400 border-emerald-500/40'
              }`}
            >
              TCS
            </span>
          )}
        </div>

        {supportedModes.length > 0 && (
          <span className="text-[8.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-zinc-900 border-white/10 text-zinc-400">
            MODO: <b className="text-white">{drivingMode}</b>
          </span>
        )}
      </div>

      {/* ─── 3. Painel central ─── */}
      <main className="flex-1 flex flex-col justify-center items-center px-1 py-1 min-h-0 overflow-hidden">
        {isLaunchControlArmed && (
          <div className="w-full py-1 px-2 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 text-center text-[10px] font-mono font-black animate-pulse mb-1">
            🏁 LAUNCH CONTROL ATIVO · SOLTE O FREIO!
          </div>
        )}
        {isLaunching && (
          <div className="w-full py-1 px-2 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-center text-[10px] font-mono font-black mb-1">
            🚀 LARGADA!
          </div>
        )}

        {portraitMode === 'cluster' ? (
          <div className="w-full flex-1 flex items-center justify-center min-h-0">
            <VehicleDashboardCluster telemetry={telemetry} />
          </div>
        ) : portraitMode === 'multimedia' ? (
          <div className="w-full flex-1 flex items-center justify-center">
            <InfotainmentScreen vehicle={vehicle} telemetry={telemetry} compact={true} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center w-full gap-2 min-h-0">
            <VehicleDashboardCluster telemetry={telemetry} />
            <DrivingMapViewport size={mapViewportSize} onSizeChange={setMapViewportSize} compact />
            {portraitMode === 'legacy' && <div>
            {/* LEDs de giro */}
            <div className="flex items-center w-full max-w-sm gap-1 px-2">
              {Array.from({ length: 14 }).map((_, i) => {
                const isLit = displayRpm / maxRpm >= i / 14
                const isRedline = i >= 11
                const isMid = i >= 7 && i < 11
                const colorClass = isLit
                  ? isRedline
                    ? 'bg-red-500 shadow-[0_0_10px_#ef4444]'
                    : isMid
                    ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                    : 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                  : 'bg-zinc-800/80'
                return (
                  <div
                    key={i}
                    className={`flex-1 h-2.5 rounded-sm transition-all duration-75 ${colorClass} ${
                      isRedline && telemetry.shiftLight.isActive ? 'animate-ping' : ''
                    }`}
                  />
                )
              })}
            </div>

            {/* Velocidade · Marcha · RPM */}
            <div className="grid grid-cols-3 items-center justify-items-center w-full max-w-sm px-2">
              <div className="flex flex-col items-center">
                <span className="text-4xl sm:text-5xl font-mono font-black tracking-tight text-white leading-none">
                  {displaySpeed}
                </span>
                <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 font-bold mt-1">KM/H</span>
              </div>

              <div className="relative flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-b from-zinc-900 via-neutral-950 to-zinc-900 border-2 border-[var(--color-accent)] shadow-[0_0_25px_var(--color-accent-muted)]">
                <span className="text-5xl font-mono font-black tracking-tighter text-[var(--color-accent)] leading-none">
                  {telemetry.gear.label}
                </span>
                <span className="text-[8px] font-mono font-bold text-zinc-400 uppercase mt-0.5">
                  {telemetry.gear.subLabel}
                </span>
                {telemetry.shiftLight.isActive && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 animate-ping" />
                )}
              </div>

              <div className="flex flex-col items-center">
                <span
                  className={`text-4xl sm:text-5xl font-mono font-black tracking-tight leading-none ${
                    displayRpm > maxRpm * 0.9 ? 'text-red-500 animate-pulse' : 'text-zinc-200'
                  }`}
                >
                  {displayRpm}
                </span>
                <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 font-bold mt-1">RPM</span>
              </div>
            </div>

            {/* Alertas físicos (altura fixa para não pular o layout) */}
            <div className="flex items-center justify-center gap-2 h-5">
              {telemetry.engine.isBogWarning && (
                <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500 text-yellow-300 text-[8px] font-mono font-black animate-pulse">
                  MOTOR AMARRANDO
                </span>
              )}
              {hasClutch && telemetry.clutchTelemetry.isSlipping && (
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500 text-orange-400 text-[8px] font-mono font-black animate-pulse">
                  PATINANDO {Math.round(telemetry.clutchTelemetry.slipRpm)} RPM
                </span>
              )}
              {telemetry.shiftLight.isActive && (
                <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-mono font-black text-[9px] animate-bounce">
                  ▲ TROQUE DE MARCHA!
                </span>
              )}
              {!isRunning && (
                <span
                  className={`px-2.5 py-0.5 rounded-full border font-mono font-black text-[9px] ${
                    telemetry.engine.isStalled
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 animate-pulse'
                      : 'bg-white/5 border-white/10 text-zinc-400'
                  }`}
                >
                  {telemetry.engine.isStalled ? '⚠️ MOTOR APAGOU · RELIGUE EMBAIXO ↙' : 'MOTOR DESLIGADO · TOQUE EM START ↙'}
                </span>
              )}
            </div>

            {/* Turbo + Combustível/Temperatura */}
            {(hasTurbo || showAftermarketBoostGauge) && (
              <div className="flex items-center justify-center gap-2 px-3 py-1 rounded-xl bg-black/60 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                <span className="text-zinc-500 font-bold">TURBO</span>
                <span className="font-black text-amber-400 text-sm">
                  {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR
                </span>
                <span className="text-zinc-500 text-[9px]">pico {peakBoostBar.toFixed(2)}</span>
              </div>
            )}
            <div className="w-full flex justify-center scale-90 origin-center">
              <AuxGauges
                fuelLevel={telemetry.auxGauges.fuelLevel}
                fuelCapacity={telemetry.auxGauges.fuelCapacity}
                fuelPercent={telemetry.auxGauges.fuelPercent}
                coolantTemp={telemetry.auxGauges.coolantTemp}
                tempTarget={telemetry.auxGauges.tempTarget}
                isTempOptimal={telemetry.auxGauges.isTempOptimal}
              />
            </div>
          </div>}
          </div>
        )}
      </main>

      {/* ─── 4. Câmbio e Perfis de Condução (Lateral Direita) ─── */}
      <div className="w-full flex items-center justify-between gap-2 px-1 pt-1 pb-1.5 border-t border-white/5">
        <div className="flex-1 flex justify-center min-w-0">
          <GearShift size="compact" orientation="horizontal" />
        </div>
        {supportedModes.length > 0 && (
          <div className="flex-shrink-0 flex items-center pr-1">
            <DrivingModesSelector
              supportedModes={supportedModes}
              orientation="horizontal"
              size="compact"
            />
          </div>
        )}
      </div>

      {/* ─── 5. Zona dos polegares: botões laterais + pedais ─── */}
      <footer className="w-full grid grid-cols-[68px_1fr_68px] sm:grid-cols-[80px_1fr_80px] items-end gap-2">
        {/* Coluna esquerda: Buzina · Freio de mão · START · (QuickClutch 100% à esquerda se manual) */}
        <div className="flex flex-col gap-1.5">
          {hasClutch ? (
            <>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onPointerDown={() => setHorn(true)}
                  onPointerUp={() => setHorn(false)}
                  onPointerLeave={() => setHorn(false)}
                  onPointerCancel={() => setHorn(false)}
                  className="h-10 rounded-xl bg-zinc-900 border border-white/10 active:bg-amber-500/20 active:border-amber-400 flex items-center justify-center text-base transition-all active:scale-95 cursor-pointer"
                  title="Buzina"
                  aria-label="Buzina"
                >
                  📢
                </button>
                <button
                  type="button"
                  onClick={toggleHandbrake}
                  className={`h-10 rounded-xl border font-mono font-black uppercase leading-none flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer ${
                    handbrake
                      ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.7)]'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                  aria-label="Freio de mão"
                >
                  <span className="text-[11px]">(P)</span>
                  <span className="text-[6.5px] mt-0.5">{handbrake ? 'PUXADO' : 'F. MÃO'}</span>
                </button>
              </div>
              <MobileStartButton variant="square" className="h-11 w-full" />
              <QuickClutchButton
                layout="stack"
                className="h-15 w-full"
                label={isMotorcycle ? 'MANETE' : 'EMBR'}
                sublabel={isMotorcycle ? '100%' : '100%'}
              />
            </>
          ) : (
            <>
              <button
                type="button"
                onPointerDown={() => setHorn(true)}
                onPointerUp={() => setHorn(false)}
                onPointerLeave={() => setHorn(false)}
                onPointerCancel={() => setHorn(false)}
                className="h-11 rounded-2xl bg-zinc-900 border border-white/10 active:bg-amber-500/20 active:border-amber-400 flex items-center justify-center text-lg transition-all active:scale-95 cursor-pointer"
                title="Buzina"
                aria-label="Buzina"
              >
                📢
              </button>
              <button
                type="button"
                onClick={toggleHandbrake}
                className={`h-11 rounded-2xl border font-mono font-black uppercase leading-none flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer ${
                  handbrake
                    ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.7)]'
                    : 'bg-zinc-900 text-zinc-400 border-white/10'
                }`}
                aria-label="Freio de mão"
              >
                <span className="text-[13px]">(P)</span>
                <span className="text-[7px] mt-0.5">{handbrake ? 'PUXADO' : 'F. MÃO'}</span>
              </button>
              <MobileStartButton variant="square" className="h-16 w-full" />
            </>
          )}
        </div>

        {/* Centro: pedais */}
        <div className="flex items-end justify-center gap-1.5 sm:gap-3">
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

        {/* Coluna direita: Controles Secundários / Nitro / Moto (SEM QuickClutch) */}
        <div className="flex flex-col gap-2">
          {isMotorcycle && (
            <button
              type="button"
              onPointerDown={() => setBrake(1)}
              onPointerUp={() => setBrake(0)}
              onPointerLeave={() => setBrake(0)}
              onPointerCancel={() => setBrake(0)}
              className="h-11 rounded-2xl border border-red-400/50 bg-red-950/50 font-mono text-[8px] font-black text-red-200 active:bg-red-500/40"
              aria-label="Manete de freio dianteiro"
            >
              F. DIANT.
            </button>
          )}
          {isCvtWithManual && (
            <button
              type="button"
              onClick={toggleSimulatedManual}
              disabled={!isRunning}
              className={`h-11 rounded-2xl border font-mono font-black uppercase leading-none flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer ${
                isManualSimulated
                  ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                  : 'bg-zinc-900 border-white/10 text-zinc-400'
              }`}
            >
              <span className="text-[11px]">{isManualSimulated ? 'M' : 'AUTO'}</span>
              <span className="text-[6.5px] mt-0.5">MODO</span>
            </button>
          )}
          {hasNosKit && (
            <>
              <button
                type="button"
                onPointerDown={() => setNosActive(true)}
                onPointerUp={() => setNosActive(false)}
                onPointerLeave={() => setNosActive(false)}
                onPointerCancel={() => setNosActive(false)}
                disabled={nosPressurePercent <= 0 || !isRunning}
                className={`h-14 rounded-2xl border-2 font-mono font-black uppercase leading-none flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer ${
                  nosActive
                    ? 'bg-cyan-400 text-black border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.9)] animate-pulse'
                    : nosPressurePercent <= 0
                    ? 'bg-zinc-900/50 text-zinc-600 border-zinc-800'
                    : 'bg-cyan-950/70 text-cyan-300 border-cyan-500/50'
                }`}
                title="Segure para disparar Nitro"
              >
                <span className="text-[12px]">NOS</span>
                <span className="text-[10px] mt-0.5">{Math.round(nosPressurePercent)}%</span>
              </button>
              <button
                type="button"
                onClick={purgeNos}
                disabled={nosPressurePercent <= 0}
                className="h-8 rounded-xl border border-sky-400/40 bg-sky-950/50 text-sky-300 text-[9px] font-mono font-black uppercase transition-all active:scale-95 cursor-pointer"
                title="Purga de Nitro"
              >
                💨 PURGA
              </button>
            </>
          )}
        </div>
      </footer>

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
