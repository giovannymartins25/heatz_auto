import { memo, useState } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig, DrivingMode } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useGarageStore, type GarageCarInstance } from '@/stores/useGarageStore'
import { useInteriorAccessories } from '@/hooks/useInteriorAccessories'
import { AnalogPedal } from '@/components/controls/AnalogPedal'
import { GearShift } from '@/components/controls/GearShift'
import { EngineButton } from '@/components/controls/EngineButton'
import { WarningLights, AuxGauges } from '@/components/gauges'
import { ClusterView } from './ClusterView'
import { InfotainmentScreen } from './InfotainmentScreen'
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
 * Permite pilotar confortavelmente com os polegares sem obrigar a girar o aparelho.
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
  const setDrivingMode = useSimulationStore((s) => s.setDrivingMode)
  const tcsEnabled = useSimulationStore((s) => s.tcsEnabled)
  const setTcsEnabled = useSimulationStore((s) => s.setTcsEnabled)
  const setHorn = useSimulationStore((s) => s.setHorn)
  const toggleHandbrake = useSimulationStore((s) => s.toggleHandbrake)
  const handbrake = useSimulationStore((s) => s.handbrake)
  const isMuted = useSimulationStore((s) => s.isMuted)
  const toggleMute = useSimulationStore((s) => s.toggleMute)
  const current0to100 = useSimulationStore((s) => s.current0to100)
  const best0to100 = useSimulationStore((s) => s.best0to100)
  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const toggleExhaustValve = useSimulationStore((s) => s.toggleExhaustValve)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const cycleHeadlights = useSimulationStore((s) => s.cycleHeadlights)
  const isRaining = useSimulationStore((s) => s.isRaining)
  const toggleRain = useSimulationStore((s) => s.toggleRain)
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const hasTurbo = useSimulationStore((s) => s.hasTurbo)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const hasNosKit = useSimulationStore((s) => s.hasNosKit)
  const nosActive = useSimulationStore((s) => s.nosActive)
  const nosPressurePercent = useSimulationStore((s) => s.nosPressurePercent)
  const setNosActive = useSimulationStore((s) => s.setNosActive)
  const purgeNos = useSimulationStore((s) => s.purgeNos)

  const [isTuningOpen, setIsTuningOpen] = useState(false)
  const [isDragStripOpen, setIsDragStripOpen] = useState(false)
  const [isDynoOpen, setIsDynoOpen] = useState(false)

  const hasClutch = vehicle.transmission.hasClutch ?? false
  const supportedModes = vehicle.transmission.supportedModes || []
  const resolveInstanceForVehicle = useGarageStore((s) => s.resolveInstanceForVehicle)
  const activeCar = carInstance || resolveInstanceForVehicle(vehicle.id)
  const { hasInfotainment, showAftermarketBoostGauge } = useInteriorAccessories(vehicle)
  const [portraitMode, setPortraitMode] = useState<'cluster' | 'multimedia' | 'hud'>('cluster')

  const displaySpeed = Math.round(telemetry.speedometer.speed)
  const displayRpm = Math.round(telemetry.tachometer.rpm)
  const maxRpm = vehicle.engine.maxRpm
  const rpmPercent = Math.min(100, Math.round((displayRpm / maxRpm) * 100))

  return (
    <div
      className="fixed inset-0 w-screen h-dvh bg-zinc-950 text-white flex flex-col justify-between select-none touch-none overflow-hidden z-40"
      style={{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* ─── 1. Topo: Navegação, Modos e Botões Rápidos ─── */}
      <header className="flex flex-col w-full gap-1 pb-1 border-b border-white/5">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onBack}
              className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-white transition-all active:scale-95 cursor-pointer"
            >
              ← Sair
            </button>
            <div className="leading-tight">
              <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block">
                {vehicle.info.brand}
              </span>
              <span className="text-[11px] font-bold text-white tracking-tight truncate max-w-[110px] block">
                {vehicle.info.name}
              </span>
            </div>
          </div>

          {/* Alternador Painel / HUD / Multimídia */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-full border border-white/10">
            <button
              onClick={() => setPortraitMode('cluster')}
              className={`px-2 py-0.5 text-[8.5px] font-mono font-bold rounded-full border transition-all cursor-pointer ${
                portraitMode === 'cluster'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow'
                  : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              PAINEL
            </button>
            <button
              onClick={() => setPortraitMode('hud')}
              className={`px-2 py-0.5 text-[8.5px] font-mono font-bold rounded-full border transition-all cursor-pointer ${
                portraitMode === 'hud'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow'
                  : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              HUD
            </button>
            {hasInfotainment && (
              <button
                onClick={() => setPortraitMode('multimedia')}
                className={`px-2 py-0.5 text-[8.5px] font-mono font-bold rounded-full border transition-all cursor-pointer ${
                  portraitMode === 'multimedia'
                    ? 'bg-red-500/20 text-red-300 border-red-500/50 shadow'
                    : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-300'
                }`}
              >
                MÍDIA
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsDragStripOpen(true)}
              className="px-1.5 py-0.5 text-[8.5px] rounded-lg border border-amber-500/50 bg-amber-950/40 text-amber-300 font-mono font-bold transition-all cursor-pointer flex items-center gap-0.5"
              title="Pista de Arrancada 402M"
            >
              <span>🏁</span>
              <span>402M</span>
            </button>
            <button
              onClick={() => setIsDynoOpen(true)}
              className="px-1.5 py-0.5 text-[8.5px] rounded-lg border border-sky-500/50 bg-sky-950/40 text-sky-300 font-mono font-bold transition-all cursor-pointer flex items-center gap-0.5"
              title="Dinamômetro de Chassi"
            >
              <span>📈</span>
              <span>DYNO</span>
            </button>
            <button
              onClick={() => setIsTuningOpen(true)}
              className={`px-2 py-0.5 text-[9px] rounded-lg border font-black transition-all cursor-pointer flex items-center gap-1 ${
                tuningStage > 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}
              title="Abrir Oficina de Peças"
            >
              <span>🔧</span>
              <span>{tuningStage > 0 ? `STG ${tuningStage}` : 'OFICINA'}</span>
            </button>
            <button
              onClick={toggleMute}
              className={`p-1 text-[10px] font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                isMuted ? 'bg-red-500/20 text-red-400 border-red-500' : 'bg-zinc-900 text-zinc-400 border-white/10'
              }`}
              title="Alternar Áudio"
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>

        {/* Faixa Secundária: Modos de Condução + Luzes de Alerta + Ações Rápidas */}
        <div className="flex items-center justify-between w-full px-1 text-[8.5px] font-mono">
          <div className="flex items-center gap-1">
            <WarningLights lights={telemetry.warningLights} />
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-zinc-900/90 border border-white/10 text-zinc-400">
              <span className="text-zinc-500">0-100:</span>
              <span className="font-bold text-amber-400">
                {best0to100 ? `${best0to100.toFixed(2)}s` : current0to100 ? `${current0to100.toFixed(2)}s` : '--'}
              </span>
            </div>
          </div>

          {/* Modos de Condução (ECO / NORMAL / SPORT) */}
          <div className="flex items-center gap-0.5 bg-zinc-900/90 px-1.5 py-0.5 rounded-full border border-white/10">
            {supportedModes.map((mode) => (
              <button
                key={mode}
                onClick={() => setDrivingMode(mode as DrivingMode)}
                className={`px-1.5 py-0.2 uppercase rounded-full transition-all cursor-pointer ${
                  drivingMode === mode
                    ? 'bg-white text-zinc-950 font-bold shadow'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {mode}
              </button>
            ))}
            {vehicle.transmission.tcs?.enabled && (
              <button
                onClick={() => setTcsEnabled(!tcsEnabled)}
                className={`ml-0.5 px-1 py-0.2 uppercase rounded-full border transition-all cursor-pointer ${
                  !tcsEnabled
                    ? 'bg-zinc-800 text-zinc-500 line-through border-zinc-700'
                    : telemetry.tcs.intervening
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500 animate-pulse'
                    : 'bg-zinc-950 text-emerald-400 border-white/10'
                }`}
              >
                TCS
              </button>
            )}
          </div>

          {/* Quick Actions (Escape, Farol, Chuva) */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleExhaustValve}
              className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                exhaustValveOpen
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                  : 'bg-zinc-900 text-zinc-500 border-white/10'
              }`}
              title="Difusor de Escape"
            >
              ⚡
            </button>
            <button
              onClick={cycleHeadlights}
              className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                headlightsMode !== 'off'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-400'
                  : 'bg-zinc-900 text-zinc-500 border-white/10'
              }`}
              title="Faróis"
            >
              💡
            </button>
            <button
              onClick={toggleRain}
              className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                isRaining
                  ? 'bg-blue-600/30 text-blue-200 border-blue-400'
                  : 'bg-zinc-900 text-zinc-500 border-white/10'
              }`}
              title="Clima Chuva / Seco"
            >
              {isRaining ? '🌧️' : '☀️'}
            </button>
          </div>
        </div>
      </header>

      {/* ─── 2. Bloco Central: Painel de Instrumentos Vertical ─── */}
      <main className="flex-1 flex flex-col justify-around items-center px-2 py-1 min-w-0">
        {/* ── Banner de Launch Control no Mobile ── */}
        {isLaunchControlArmed && (
          <div className="w-full py-1 px-2 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 text-center text-[10px] font-mono font-black animate-pulse my-0.5">
            🏁 LAUNCH CONTROL ATIVO · SOLTE O FREIO!
          </div>
        )}
        {isLaunching && (
          <div className="w-full py-1 px-2 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-center text-[10px] font-mono font-black my-0.5">
            🚀 LARGADA!
          </div>
        )}

        {/* ── Centro: Painel Real Completo, Central Multimídia ou HUD Digital ── */}
        {portraitMode === 'cluster' ? (
          <div className="w-full flex-1 flex flex-col items-center justify-center overflow-hidden my-auto py-1 select-none pointer-events-none relative max-h-[32vh]">
            <div className="scale-[0.45] xs:scale-[0.52] sm:scale-[0.62] origin-center flex items-center justify-center">
              <ClusterView telemetry={telemetry} />
            </div>
          </div>
        ) : portraitMode === 'multimedia' ? (
          <div className="w-full flex-1 flex items-center justify-center my-auto py-1">
            <InfotainmentScreen vehicle={vehicle} telemetry={telemetry} compact={true} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full gap-1.5 my-auto px-1">
            {/* Alertas Físicos: BOG, CLUTCH SLIP, CORTE */}
            <div className="flex items-center gap-2 h-4">
              {telemetry.engine.isBogWarning && (
                <span className="px-2 py-0.2 rounded-full bg-yellow-500/20 border border-yellow-500 text-yellow-300 text-[8px] font-mono font-black animate-pulse">
                  MOTOR AMARRANDO (BOG!)
                </span>
              )}
              {hasClutch && telemetry.clutchTelemetry.isSlipping && (
                <span className="px-2 py-0.2 rounded-full bg-orange-500/20 border border-orange-500 text-orange-400 text-[8px] font-mono font-black animate-pulse">
                  PATINANDO {Math.round(telemetry.clutchTelemetry.slipRpm)} RPM
                </span>
              )}
              {telemetry.shiftLight.isActive && (
                <span className="px-2 py-0.2 rounded-full bg-red-500/20 border border-red-500 text-red-400 text-[8px] font-mono font-black animate-ping">
                  CORTE DE GIRO!
                </span>
              )}
            </div>

            {/* Tríptico Esportivo Principal: KM/H | MARCHA GIGANTE | RPM */}
            <div className="grid grid-cols-3 items-center justify-items-center w-full max-w-sm px-2">
              {/* Velocidade */}
              <div className="flex flex-col items-center">
                <span className="text-3xl sm:text-4xl font-mono font-black tracking-tight text-white leading-none">
                  {displaySpeed}
                </span>
                <span className="text-[8.5px] font-mono uppercase tracking-widest text-zinc-500 mt-0.5">
                  KM/H
                </span>
              </div>

              {/* Moldura de Marcha Iluminada */}
              <div className="relative flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900/90 border-2 border-[var(--color-accent)] shadow-[0_0_20px_var(--color-accent-muted)]">
                <span className="text-3xl font-mono font-black tracking-tighter text-[var(--color-accent)] leading-none">
                  {telemetry.gear.label}
                </span>
                <span className="text-[7.5px] font-mono font-bold text-zinc-400 uppercase mt-0.5">
                  {telemetry.gear.subLabel}
                </span>
                {telemetry.shiftLight.isActive && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
                )}
              </div>

              {/* RPM */}
              <div className="flex flex-col items-center">
                <span
                  className={`text-3xl sm:text-4xl font-mono font-black tracking-tight leading-none ${
                    displayRpm > maxRpm * 0.9 ? 'text-red-500 animate-pulse' : 'text-zinc-200'
                  }`}
                >
                  {displayRpm}
                </span>
                <span className="text-[8.5px] font-mono uppercase tracking-widest text-zinc-500 mt-0.5">
                  RPM
                </span>
              </div>
            </div>

            {/* Barra Dinâmica Horizontal de LED de RPM */}
            <div className="w-full max-w-xs bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-white/10 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  displayRpm > maxRpm * 0.88
                    ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                    : displayRpm > maxRpm * 0.7
                    ? 'bg-amber-400'
                    : 'bg-[var(--color-accent)]'
                }`}
                style={{ width: `${rpmPercent}%` }}
              />
            </div>

            {/* Manômetro Turbo Digital ou Analógico Compacto */}
            {(hasTurbo || showAftermarketBoostGauge) && (
              <div className="flex items-center justify-center gap-2 px-3 py-0.5 rounded-xl bg-black/60 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                <span className="text-zinc-500 font-bold">TURBO:</span>
                <span className="font-black text-amber-400 text-xs">
                  {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR
                </span>
                <span className="text-zinc-500 text-[9px]">(PICO {peakBoostBar.toFixed(2)})</span>
              </div>
            )}

            {/* Marcadores Auxiliares */}
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
          </div>
        )}

        {/* Barra de Controles e Câmbio (Sempre Ativo) */}
        <div className="w-full flex flex-col items-center gap-1.5 px-2 pt-1 max-w-sm">
          {/* Seletor de Câmbio: PRNDS/M para automáticos e [-][N][+] para manuais */}
          <GearShift size="compact" orientation="horizontal" />

          {/* Botões Secundários: Start Engine, Buzina e Freio de Mão */}
          <div className="flex items-center justify-between w-full px-2">
            <div className="scale-90 origin-left">
              <EngineButton />
            </div>

            {/* Buzina Touch */}
            <button
              onPointerDown={() => setHorn(true)}
              onPointerUp={() => setHorn(false)}
              onPointerCancel={() => setHorn(false)}
              className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 active:bg-amber-500/20 active:border-amber-400 flex items-center justify-center text-sm font-bold transition-all active:scale-95 cursor-pointer shadow"
              title="Buzina"
            >
              📢
            </button>

            {/* Botão de Injeção de Nitro (NOS) & Purga */}
            {hasNosKit && (
              <div className="flex items-center gap-1">
                <button
                  onPointerDown={() => setNosActive(true)}
                  onPointerUp={() => setNosActive(false)}
                  onPointerCancel={() => setNosActive(false)}
                  disabled={nosPressurePercent <= 0 || !isRunning}
                  className={`px-2.5 py-1.5 rounded-xl border font-mono text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow ${
                    nosActive
                      ? 'bg-cyan-400 text-black border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.9)] animate-pulse'
                      : nosPressurePercent <= 0
                      ? 'bg-zinc-900/50 text-zinc-600 border-zinc-800'
                      : 'bg-cyan-950/70 text-cyan-300 border-cyan-500/50 hover:bg-cyan-900/80'
                  }`}
                  title="Segure para disparar Nitro NOS"
                >
                  <span>⚡</span>
                  <span>NOS {Math.round(nosPressurePercent)}%</span>
                </button>
                <button
                  onClick={purgeNos}
                  disabled={nosPressurePercent <= 0}
                  className="px-2 py-1.5 rounded-xl border border-sky-400/40 bg-sky-950/50 text-sky-300 text-[9px] font-black uppercase transition-all active:scale-95 cursor-pointer"
                  title="Purga de Nitro"
                >
                  💨
                </button>
              </div>
            )}

            {/* Freio de Mão */}
            <button
              onClick={toggleHandbrake}
              className={`px-3 py-1.5 rounded-xl border font-mono text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                handbrake
                  ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.6)]'
                  : 'bg-zinc-900 text-zinc-400 border-white/10'
              }`}
            >
              (P) {handbrake ? 'TRAVADO' : 'FREIO'}
            </button>
          </div>
        </div>
      </main>

      {/* ─── 3. Base: Pedais Analógicos Ergonômicos Verticais ─── */}
      <footer className="w-full flex items-end justify-center gap-3 sm:gap-5 pt-1 pb-1 border-t border-white/5">
        {/* Pedal de Embreagem (Se tiver) */}
        {hasClutch && (
          <AnalogPedal
            label="EMBR"
            sublabel="CLUTCH"
            value={clutchPosition}
            onChange={setClutch}
            colorTheme="amber"
            widthClass="w-13"
            heightClass="h-38 sm:h-44"
            disabled={!isRunning}
            showPercent={true}
          />
        )}

        {/* Pedal de Freio */}
        <AnalogPedal
          label="FREIO"
          sublabel="BRAKE"
          value={brake}
          onChange={setBrake}
          colorTheme="red"
          widthClass="w-15 sm:w-16"
          heightClass="h-38 sm:h-44"
          disabled={!isRunning}
          showPercent={true}
        />

        {/* Pedal do Acelerador */}
        <AnalogPedal
          label="ACEL"
          sublabel="RUN"
          value={throttle}
          onChange={setThrottle}
          colorTheme="accent"
          widthClass="w-15 sm:w-16"
          heightClass="h-38 sm:h-44"
          disabled={!isRunning}
          showPercent={true}
        />
      </footer>

      {/* ── Efeitos Especiais de Imersão e Oficina ── */}
      <BackfireFlameFlash />
      <RainWindshieldEffect />
      <BurnoutSmokeEffect />
      <EngineBlownSmokeEffect />
      {/* Pista de Arrancada 402m */}
      {isDragStripOpen && <DragStripTree onClose={() => setIsDragStripOpen(false)} />}

      {/* Dinamômetro de Chassi */}
      {isDynoOpen && (
        <DynoTestModal
          config={vehicle}
          upgrades={activeCar?.upgrades}
          onClose={() => setIsDynoOpen(false)}
        />
      )}

      {/* Modal da Oficina de Peças & Preparação */}
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

