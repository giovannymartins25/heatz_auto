import { memo, useState } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig, DrivingMode } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { AnalogPedal } from '@/components/controls/AnalogPedal'
import { GearShift } from '@/components/controls/GearShift'
import { EngineButton } from '@/components/controls/EngineButton'
import { WarningLights, AuxGauges } from '@/components/gauges'
import { ClusterView } from './ClusterView'
import { InfotainmentScreen } from './InfotainmentScreen'
import { BackfireFlameFlash, RainWindshieldEffect } from '@/components/effects'
import { TuningGarageModal } from '@/components/tuning'

export interface MobilePortraitCockpitProps {
  telemetry: DashboardTelemetry
  vehicle: VehicleConfig
  onBack: () => void
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

  const [isTuningOpen, setIsTuningOpen] = useState(false)

  const hasClutch = vehicle.transmission.hasClutch ?? false
  const supportedModes = vehicle.transmission.supportedModes || []
  const hasInfotainment =
    vehicle.dashboard?.hasInfotainment ??
    (vehicle.id !== 'gol-g6' &&
      vehicle.id !== 'cb1000r' &&
      vehicle.info.category !== 'motorcycle')
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
      <header className="flex items-center justify-between w-full pb-1 border-b border-white/5">
        <button
          onClick={onBack}
          className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-white transition-all active:scale-95 cursor-pointer"
        >
          ← Sair
        </button>

        {/* Modos de condução */}
        <div className="flex items-center gap-1 bg-zinc-900/90 px-2 py-0.5 rounded-full border border-white/10">
          {supportedModes.map((mode) => (
            <button
              key={mode}
              onClick={() => setDrivingMode(mode as DrivingMode)}
              className={`px-2 py-0.5 text-[9px] font-mono font-black uppercase rounded-full transition-all cursor-pointer ${
                drivingMode === mode
                  ? 'bg-white text-zinc-950 font-bold shadow'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {mode}
            </button>
          ))}

          {/* TCS */}
          {vehicle.transmission.tcs?.enabled && (
            <button
              onClick={() => setTcsEnabled(!tcsEnabled)}
              className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded-full border transition-all cursor-pointer ${
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

          {/* Som Mute */}
          <button
            onClick={toggleMute}
            className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-full border transition-all cursor-pointer ${
              isMuted ? 'bg-red-500/20 text-red-400 border-red-500' : 'bg-zinc-900 text-zinc-400 border-white/10'
            }`}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>

        <div className="text-right">
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block leading-none">
            {vehicle.info.brand}
          </span>
          <span className="text-xs font-bold text-white tracking-tight truncate max-w-[100px] block leading-tight">
            {vehicle.info.name}
          </span>
        </div>
      </header>

      {/* ─── Faixa Rápida de Oficina e Imersão ─── */}
      <div className="flex items-center justify-between w-full px-1 py-1 bg-zinc-900/60 rounded-xl border border-white/5 text-[9px] font-mono">
        <button
          onClick={() => setIsTuningOpen(true)}
          className={`px-2 py-0.5 rounded-lg border font-black transition-all cursor-pointer flex items-center gap-1 ${
            tuningStage > 0
              ? 'bg-amber-500/20 text-amber-300 border-amber-400'
              : 'bg-zinc-800 text-zinc-300 border-zinc-700'
          }`}
        >
          <span>🔧</span>
          <span>{tuningStage === 0 ? 'OFICINA' : `STG ${tuningStage}`}</span>
        </button>

        <button
          onClick={toggleExhaustValve}
          className={`px-2 py-0.5 rounded-lg border font-black transition-all cursor-pointer flex items-center gap-1 ${
            exhaustValveOpen
              ? 'bg-amber-500/20 text-amber-300 border-amber-400'
              : 'bg-zinc-800 text-zinc-500 border-zinc-700'
          }`}
        >
          <span>⚡</span>
          <span>{exhaustValveOpen ? 'ESCAPE ON' : 'ESCAPE OFF'}</span>
        </button>

        <button
          onClick={cycleHeadlights}
          className={`px-2 py-0.5 rounded-lg border font-black transition-all cursor-pointer flex items-center gap-1 ${
            headlightsMode !== 'off'
              ? 'bg-sky-500/20 text-sky-300 border-sky-400'
              : 'bg-zinc-800 text-zinc-500 border-zinc-700'
          }`}
        >
          <span>💡</span>
          <span>{headlightsMode.toUpperCase()}</span>
        </button>

        <button
          onClick={toggleRain}
          className={`px-2 py-0.5 rounded-lg border font-black transition-all cursor-pointer flex items-center gap-1 ${
            isRaining
              ? 'bg-blue-600/30 text-blue-200 border-blue-400'
              : 'bg-zinc-800 text-zinc-500 border-zinc-700'
          }`}
        >
          <span>{isRaining ? '🌧️ CHUVA' : '☀️ SECO'}</span>
        </button>
      </div>

      {/* ─── 2. Bloco Central: Painel de Instrumentos Vertical ─── */}
      <main className="flex-1 flex flex-col justify-around items-center px-2 py-2 min-w-0">
        {/* Luzes de Alerta no Topo e Alternador */}
        <div className="flex items-center justify-between w-full px-2">
          <WarningLights lights={telemetry.warningLights} />

          <div className="flex items-center gap-1.5">
            {/* 0-100 km/h chip */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-900 border border-white/10 text-[9px] font-mono">
              <span className="text-zinc-500">0-100:</span>
              <span className="font-bold text-amber-400">
                {best0to100 ? `${best0to100.toFixed(2)}s` : current0to100 ? `${current0to100.toFixed(2)}s` : '--'}
              </span>
            </div>

            {/* Alternador Painel / Multimídia / HUD */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPortraitMode('cluster')}
                className={`px-1.5 py-0.5 text-[8px] font-mono font-bold rounded-full border transition-all cursor-pointer ${
                  portraitMode === 'cluster'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-zinc-900 text-zinc-500 border-white/5'
                }`}
              >
                PAINEL
              </button>
              {hasInfotainment && (
                <button
                  onClick={() => setPortraitMode('multimedia')}
                  className={`px-1.5 py-0.5 text-[8px] font-mono font-bold rounded-full border transition-all cursor-pointer ${
                    portraitMode === 'multimedia'
                      ? 'bg-red-500/20 text-red-300 border-red-500/50'
                      : 'bg-zinc-900 text-zinc-500 border-white/5'
                  }`}
                >
                  MULTIMÍDIA
                </button>
              )}
              <button
                onClick={() => setPortraitMode('hud')}
                className={`px-1.5 py-0.5 text-[8px] font-mono font-bold rounded-full border transition-all cursor-pointer ${
                  portraitMode === 'hud'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                    : 'bg-zinc-900 text-zinc-500 border-white/5'
                }`}
              >
                HUD
              </button>
            </div>
          </div>
        </div>

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
          <div className="w-full flex-1 flex flex-col items-center justify-center overflow-hidden my-auto py-1 select-none pointer-events-none relative">
            <div className="scale-[0.48] xs:scale-[0.55] sm:scale-[0.65] origin-center flex items-center justify-center">
              <ClusterView telemetry={telemetry} />
            </div>
          </div>
        ) : portraitMode === 'multimedia' ? (
          <div className="w-full flex-1 flex items-center justify-center my-auto py-1">
            <InfotainmentScreen vehicle={vehicle} telemetry={telemetry} compact={true} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full gap-2 my-auto">
            {/* Alertas Físicos */}
            <div className="flex items-center gap-2 h-4 my-0.5">
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

            {/* Destaque: Marcha, Velocidade e RPM em grande formato */}
            <div className="flex items-center justify-center gap-5 w-full">
              {/* Velocidade */}
              <div className="flex flex-col items-center">
                <span className="text-4xl sm:text-5xl font-mono font-black tracking-tight text-white leading-none">
                  {displaySpeed}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  KM/H
                </span>
              </div>

              {/* Moldura de Marcha */}
              <div className="relative flex flex-col items-center justify-center w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-zinc-900/90 border-2 border-[var(--color-accent)] shadow-[0_0_20px_var(--color-accent-muted)]">
                <span className="text-3xl sm:text-4xl font-mono font-black tracking-tighter text-[var(--color-accent)] leading-none">
                  {telemetry.gear.label}
                </span>
                <span className="text-[8px] font-mono font-bold text-zinc-400 uppercase">
                  {telemetry.gear.subLabel}
                </span>
              </div>

              {/* RPM */}
              <div className="flex flex-col items-center">
                <span
                  className={`text-4xl sm:text-5xl font-mono font-black tracking-tight leading-none ${
                    displayRpm > maxRpm * 0.9 ? 'text-red-500 animate-pulse' : 'text-zinc-200'
                  }`}
                >
                  {displayRpm}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  RPM
                </span>
              </div>
            </div>

            {/* Barra Curva / Horizontal de RPM */}
            <div className="w-full max-w-xs bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-white/10 p-0.5 my-1">
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

            {/* Marcadores Auxiliares */}
            <div className="w-full flex justify-center scale-90">
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
      <footer className="w-full flex items-end justify-center gap-4 sm:gap-6 pt-1 pb-1 border-t border-white/5">
        {/* Pedal de Embreagem (Se tiver) */}
        {hasClutch && (
          <AnalogPedal
            label="EMBR"
            sublabel="CLUTCH"
            value={clutchPosition}
            onChange={setClutch}
            colorTheme="amber"
            widthClass="w-14"
            heightClass="h-44 sm:h-52"
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
          widthClass="w-16 sm:w-18"
          heightClass="h-44 sm:h-52"
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
          widthClass="w-16 sm:w-18"
          heightClass="h-44 sm:h-52"
          disabled={!isRunning}
          showPercent={true}
        />
      </footer>

      {/* ── Efeitos Especiais de Imersão e Oficina ── */}
      <BackfireFlameFlash />
      <RainWindshieldEffect />
      <TuningGarageModal
        isOpen={isTuningOpen}
        onClose={() => setIsTuningOpen(false)}
        vehicle={vehicle}
      />
    </div>
  )
})

