import { memo, useState } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig, DrivingMode } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useGarageStore, type GarageCarInstance } from '@/stores/useGarageStore'
import { useInteriorAccessories } from '@/hooks/useInteriorAccessories'
import { AnalogPedal } from '@/components/controls/AnalogPedal'
import { GearShift } from '@/components/controls/GearShift'
import { EngineButton } from '@/components/controls/EngineButton'
import { ClusterView } from './ClusterView'
import { InfotainmentScreen } from './InfotainmentScreen'
import { BoostGauge } from '@/components/gauges'
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
 * Arquitetura ergonômica otimizada para os dois polegares:
 * - Polegar Esquerdo: Pedais analógicos contínuos de aceleração, freio e embreagem.
 * - Centro: Painel de telemetria (RPM, Velocidade, Marcha, Alertas, TCS).
 * - Polegar Direito: Câmbio sequencial (▲ + / ▼ -), Start Engine e Controles de Modo.
 * - Respeito integral às Safe Areas (Notch, Dynamic Island, Home Bar).
 */
export const MobileLandscapeCockpit = memo(function MobileLandscapeCockpit({
  telemetry,
  vehicle,
  onBack,
  carInstance,
}: MobileLandscapeCockpitProps) {
  const throttle = useSimulationStore((s) => s.throttle)
  const brake = useSimulationStore((s) => s.brake)
  const clutchPosition = useSimulationStore((s) => s.clutchPosition)
  const setThrottle = useSimulationStore((s) => s.setThrottle)
  const setBrake = useSimulationStore((s) => s.setBrake)
  const setClutch = useSimulationStore((s) => s.setClutch)

  const isRunning = useSimulationStore((s) => s.isRunning)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const setDrivingMode = useSimulationStore((s) => s.setDrivingMode)
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const toggleSimulatedManual = useSimulationStore((s) => s.toggleSimulatedManual)
  const tcsEnabled = useSimulationStore((s) => s.tcsEnabled)
  const setTcsEnabled = useSimulationStore((s) => s.setTcsEnabled)
  const setHorn = useSimulationStore((s) => s.setHorn)
  const handbrake = useSimulationStore((s) => s.handbrake)
  const toggleHandbrake = useSimulationStore((s) => s.toggleHandbrake)
  const isMuted = useSimulationStore((s) => s.isMuted)
  const toggleMute = useSimulationStore((s) => s.toggleMute)
  const best0to100 = useSimulationStore((s) => s.best0to100)
  const current0to100 = useSimulationStore((s) => s.current0to100)
  const hasTurbo = useSimulationStore((s) => s.hasTurbo)
  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const toggleExhaustValve = useSimulationStore((s) => s.toggleExhaustValve)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const cycleHeadlights = useSimulationStore((s) => s.cycleHeadlights)
  const isRaining = useSimulationStore((s) => s.isRaining)
  const toggleRain = useSimulationStore((s) => s.toggleRain)
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const hasNosKit = useSimulationStore((s) => s.hasNosKit)
  const nosActive = useSimulationStore((s) => s.nosActive)
  const nosPressurePercent = useSimulationStore((s) => s.nosPressurePercent)
  const setNosActive = useSimulationStore((s) => s.setNosActive)
  const purgeNos = useSimulationStore((s) => s.purgeNos)

  const [isTuningOpen, setIsTuningOpen] = useState(false)
  const [isDragStripOpen, setIsDragStripOpen] = useState(false)
  const [isDynoOpen, setIsDynoOpen] = useState(false)

  const hasClutch = vehicle.transmission.hasClutch ?? false
  const isCvtWithManual = vehicle.transmission.hasManualMode === true
  const isManualSimulated = transmissionMode === 'manual_simulated'
  const supportedModes = vehicle.transmission.supportedModes || []
  const resolveInstanceForVehicle = useGarageStore((s) => s.resolveInstanceForVehicle)
  const activeCar = carInstance || resolveInstanceForVehicle(vehicle.id)
  const { hasInfotainment, showAftermarketBoostGauge } = useInteriorAccessories(vehicle)
  const [centerMode, setCenterMode] = useState<'cluster' | 'multimedia' | 'hud'>('cluster')

  // Formatação de valores centrais
  const displaySpeed = Math.round(telemetry.speedometer.speed)
  const displayRpm = Math.round(telemetry.tachometer.rpm)
  const maxRpm = vehicle.engine.maxRpm
  const rpmPercent = Math.min(100, Math.round((displayRpm / maxRpm) * 100))

  return (
    <div
      className="fixed inset-0 w-screen h-dvh bg-zinc-950 text-white flex select-none touch-none overflow-hidden z-40"
      style={{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 1. LADO ESQUERDO: PEDAIS ANALÓGICOS (POLEGAR ESQUERDO)               */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <aside className="flex items-end justify-center gap-3 sm:gap-4 h-full py-1 pr-2 border-r border-white/5 flex-shrink-0">
        {/* Pedal de Embreagem (Apenas para manuais com hasClutch) */}
        {hasClutch && (
          <AnalogPedal
            label="EMBR"
            sublabel="CLUTCH"
            value={clutchPosition}
            onChange={setClutch}
            colorTheme="amber"
            widthClass="w-13 sm:w-14"
            heightClass="h-[74dvh]"
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
          widthClass="w-13 sm:w-14"
          heightClass="h-[74dvh]"
          disabled={!isRunning}
          showPercent={true}
        />

        {/* Pedal do Acelerador */}
        <AnalogPedal
          label="ACEL"
          sublabel="THROTTLE"
          value={throttle}
          onChange={setThrottle}
          colorTheme="accent"
          widthClass="w-13 sm:w-14"
          heightClass="h-[74dvh]"
          disabled={!isRunning}
          showPercent={true}
        />
      </aside>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 2. CENTRO: DASHBOARD & INSTRUMENTAÇÃO REAL                            */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col justify-between items-center px-3 py-1 min-w-0 h-full">
        {/* Barra superior de navegação e modos */}
        <header className="flex items-center justify-between w-full pb-1 border-b border-white/5">
          {/* Lado Esquerdo: Sair + Nome do Veículo */}
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-white transition-all active:scale-95 cursor-pointer"
            >
              ← Sair
            </button>
            <div className="leading-tight">
              <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block leading-none">
                {vehicle.info.brand}
              </span>
              <span className="text-xs font-bold text-white tracking-tight truncate max-w-[130px] block leading-tight">
                {vehicle.info.name}
              </span>
            </div>
          </div>

          {/* Centro: Alternador de Modo (PAINEL / HUD / MÍDIA) + Modos de Condução */}
          <div className="flex items-center gap-1.5">
            {/* Alternador Painel / HUD / Multimídia */}
            <div className="flex items-center gap-0.5 bg-zinc-900/90 p-0.5 rounded-full border border-white/10 text-[9px] font-mono">
              <button
                onClick={() => setCenterMode('cluster')}
                className={`px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer ${
                  centerMode === 'cluster'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                PAINEL
              </button>
              <button
                onClick={() => setCenterMode('hud')}
                className={`px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer ${
                  centerMode === 'hud'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                HUD
              </button>
              {hasInfotainment && (
                <button
                  onClick={() => setCenterMode('multimedia')}
                  className={`px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer ${
                    centerMode === 'multimedia'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  MÍDIA
                </button>
              )}
            </div>

            {/* Modos de Condução */}
            <div className="hidden xs:flex items-center gap-0.5 bg-zinc-900/90 px-1.5 py-0.5 rounded-full border border-white/10 text-[8.5px] font-mono">
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
            </div>

            {/* Chip 0-100 km/h */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-900/90 border border-white/10 text-[8.5px] font-mono text-zinc-400">
              <span className="text-zinc-500">0-100:</span>
              <span className="text-amber-400 font-bold">
                {best0to100 ? `${best0to100.toFixed(2)}s` : current0to100 ? `${current0to100.toFixed(2)}s` : '--'}
              </span>
            </div>
          </div>

          {/* Lado Direito: Ações Rápidas em ícones compactos */}
          <div className="flex items-center gap-1 text-[9px] font-mono">
            {/* 402m Arrancada */}
            <button
              onClick={() => setIsDragStripOpen(true)}
              className="px-1.5 py-0.5 rounded-lg border border-amber-500/50 bg-amber-950/40 text-amber-300 font-bold transition-all cursor-pointer flex items-center gap-0.5"
              title="Pista de Arrancada 402M"
            >
              <span>🏁</span>
              <span>402M</span>
            </button>

            {/* Dinamômetro */}
            <button
              onClick={() => setIsDynoOpen(true)}
              className="px-1.5 py-0.5 rounded-lg border border-sky-500/50 bg-sky-950/40 text-sky-300 font-bold transition-all cursor-pointer flex items-center gap-0.5"
              title="Dinamômetro de Chassi"
            >
              <span>📈</span>
              <span>DYNO</span>
            </button>

            {/* Oficina */}
            <button
              onClick={() => setIsTuningOpen(true)}
              className={`px-2 py-0.5 rounded-lg border font-bold transition-all cursor-pointer flex items-center gap-1 ${
                tuningStage > 0
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-zinc-900 border-white/10 text-zinc-300'
              }`}
              title="Oficina de Peças"
            >
              <span>🔧</span>
              <span>{tuningStage === 0 ? 'OFICINA' : `STG ${tuningStage}`}</span>
            </button>

            {/* Mute */}
            <button
              onClick={toggleMute}
              className={`p-1 rounded-lg border transition-all cursor-pointer ${
                isMuted ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-zinc-900 border-white/10 text-zinc-400'
              }`}
              title="Alternar Áudio"
            >
              {isMuted ? '🔇' : '🔊'}
            </button>

            {/* Difusor */}
            <button
              onClick={toggleExhaustValve}
              className={`px-1.5 py-1 rounded-lg border font-bold transition-all cursor-pointer flex items-center gap-1 ${
                exhaustValveOpen
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-zinc-900 border-white/10 text-zinc-500'
              }`}
              title="Difusor de Escape"
            >
              ⚡
            </button>

            {/* Faróis */}
            <button
              onClick={cycleHeadlights}
              className={`px-1.5 py-1 rounded-lg border font-bold transition-all cursor-pointer flex items-center gap-1 ${
                headlightsMode !== 'off'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                  : 'bg-zinc-900 border-white/10 text-zinc-500'
              }`}
              title="Faróis"
            >
              💡
            </button>

            {/* Clima */}
            <button
              onClick={toggleRain}
              className={`px-1.5 py-1 rounded-lg border font-bold transition-all cursor-pointer flex items-center gap-1 ${
                isRaining
                  ? 'bg-blue-600/30 border-blue-400 text-blue-200'
                  : 'bg-zinc-900 border-white/10 text-zinc-500'
              }`}
              title="Clima"
            >
              {isRaining ? '🌧️' : '☀️'}
            </button>

            {/* TCS */}
            {vehicle.transmission.tcs?.enabled && (
              <button
                onClick={() => setTcsEnabled(!tcsEnabled)}
                className={`px-1.5 py-1 rounded-lg border font-bold uppercase transition-all cursor-pointer ${
                  !tcsEnabled
                    ? 'bg-zinc-800 text-zinc-500 line-through border-zinc-700'
                    : telemetry.tcs.intervening
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500 animate-pulse'
                    : 'bg-zinc-950 text-emerald-400 border-white/10'
                }`}
                title="Controle de Tração"
              >
                TCS
              </button>
            )}
          </div>
        </header>

        {/* ── Banner de Launch Control no Mobile ── */}
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

        {/* ── Centro: Painel Real Completo, Central Multimídia ou HUD Digital ── */}
        {centerMode === 'cluster' ? (
          <div className="w-full flex-1 flex items-center justify-center overflow-hidden my-auto py-0.5 select-none relative">
            <div className="scale-[0.50] xs:scale-[0.60] sm:scale-[0.72] md:scale-[0.84] origin-center flex items-center justify-center pointer-events-none">
              <ClusterView telemetry={telemetry} />
            </div>
            {hasTurbo && hasInfotainment && (
              <button
                onClick={() => setCenterMode('multimedia')}
                className="absolute right-2 top-1 z-20 pointer-events-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/85 border border-amber-500/40 text-[9px] font-mono text-amber-300 shadow active:scale-95 transition-all cursor-pointer hover:border-amber-400"
                title="Abrir Central Multimídia"
              >
                <span>⚡ TURBO:</span>
                <span className="font-bold">
                  {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR
                </span>
                <span className="text-[8px] opacity-75">📺</span>
              </button>
            )}
          </div>
        ) : centerMode === 'multimedia' ? (
          <div className="w-full flex-1 flex items-center justify-center my-auto py-0.5 select-none">
            <InfotainmentScreen vehicle={vehicle} telemetry={telemetry} compact={false} />
          </div>
        ) : (
          /* Bloco Central de Telemetria Horizontal */
          <div className="flex flex-col items-center justify-center w-full my-auto gap-2">
            {/* Alertas Físicos: BOG e CLUTCH SLIP */}
            <div className="flex items-center gap-2 h-5">
              {telemetry.engine.isBogWarning && (
                <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500 text-yellow-300 text-[9px] font-mono font-black animate-pulse">
                  MOTOR AMARRANDO (BOG!)
                </span>
              )}
              {hasClutch && telemetry.clutchTelemetry.isSlipping && (
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500 text-orange-400 text-[9px] font-mono font-black animate-pulse">
                  PATINANDO {Math.round(telemetry.clutchTelemetry.slipRpm)} RPM
                </span>
              )}
              {telemetry.shiftLight.isActive && (
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500 text-red-400 text-[9px] font-mono font-black animate-ping">
                  CORTE DE GIRO!
                </span>
              )}
            </div>

            {/* Destaque Central: Velocidade, Marcha e RPM */}
            <div className="flex items-center justify-center gap-6 sm:gap-8 w-full">
              {/* Velocímetro Digital */}
              <div className="flex flex-col items-center">
                <span className="text-4xl sm:text-5xl font-mono font-black tracking-tight text-white leading-none">
                  {displaySpeed}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  KM/H
                </span>
              </div>

              {/* Turbo Boost se tiver */}
              {(hasTurbo || showAftermarketBoostGauge) && (
                <div className="flex flex-col items-center">
                  <BoostGauge boostBar={boostPressureBar} peakBar={peakBoostBar} size={65} showPeak={false} />
                </div>
              )}

              {/* Marcha em Destaque com Moldura Esportiva */}
              <div className="relative flex flex-col items-center justify-center w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-zinc-900/90 border-2 border-[var(--color-accent)] shadow-[0_0_25px_var(--color-accent-muted)]">
                <span className="text-3xl sm:text-4xl font-mono font-black tracking-tighter text-[var(--color-accent)] leading-none">
                  {telemetry.gear.label}
                </span>
                <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase mt-0.5">
                  {telemetry.gear.subLabel}
                </span>
              </div>

              {/* Conta-giros Digital */}
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

            {/* Barra Horizontal Dinâmica de RPM */}
            <div className="w-full max-w-md bg-zinc-900 h-3 rounded-full overflow-hidden border border-white/10 p-0.5">
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
          </div>
        )}

        {/* Rodapé Central: Indicadores de telemetria de pedais */}
        <footer className="w-full flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-white/5 pt-1">
          <div className="flex items-center gap-4">
            <span>A: {Math.round(telemetry.pedals.throttlePercent)}%</span>
            <span>F: {Math.round(telemetry.pedals.brakePercent)}%</span>
            {hasClutch && <span>E: {Math.round(telemetry.pedals.clutchPercent ?? 0)}%</span>}
          </div>
          <span className="text-[9px] text-zinc-600">
            {telemetry.engine.status}
          </span>
        </footer>
      </main>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 3. LADO DIREITO: CONTROLES SECUNDÁRIOS & CÂMBIO (POLEGAR DIREITO)    */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <aside className="flex flex-col items-center justify-between h-full py-1 pl-2 border-l border-white/5 flex-shrink-0">
        {/* Topo do lado direito: Start Engine & Ações Rápidas */}
        <div className="w-full flex items-center gap-1.5 justify-center">
          <EngineButton />

          {/* Buzina Touch */}
          <button
            onPointerDown={() => setHorn(true)}
            onPointerUp={() => setHorn(false)}
            onPointerCancel={() => setHorn(false)}
            className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/10 active:bg-amber-500/20 active:border-amber-400 flex items-center justify-center text-sm transition-all active:scale-95 cursor-pointer"
            title="Buzina (H)"
          >
            📢
          </button>

          {/* Botão de Nitro (NOS) & Purga */}
          {hasNosKit && (
            <div className="flex items-center gap-1">
              <button
                onPointerDown={() => setNosActive(true)}
                onPointerUp={() => setNosActive(false)}
                onPointerCancel={() => setNosActive(false)}
                disabled={nosPressurePercent <= 0 || !isRunning}
                className={`px-2 py-1.5 rounded-xl border font-mono text-[8px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow ${
                  nosActive
                    ? 'bg-cyan-400 text-black border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.9)] animate-pulse'
                    : nosPressurePercent <= 0
                    ? 'bg-zinc-900/50 text-zinc-600 border-zinc-800'
                    : 'bg-cyan-950/70 text-cyan-300 border-cyan-500/50 hover:bg-cyan-900/80'
                }`}
                title="Segure para disparar Nitro NOS"
              >
                <span>⚡</span>
                <span>{Math.round(nosPressurePercent)}%</span>
              </button>
              <button
                onClick={purgeNos}
                disabled={nosPressurePercent <= 0}
                className="p-1 rounded-xl border border-sky-400/40 bg-sky-950/50 text-sky-300 text-[9px] font-black uppercase transition-all active:scale-95 cursor-pointer"
                title="Purga de Nitro"
              >
                💨
              </button>
            </div>
          )}
        </div>

        {/* Seletor de Câmbio: PRNDS/M para automáticos e [-][N][+] para manuais (sempre ativo) */}
        <div className="my-auto py-1">
          <GearShift orientation="vertical" size="compact" />
        </div>

        {/* Botão de Freio de Mão & Alternador AUTO/MANUAL */}
        <div className="flex flex-col gap-1 w-full">
          <button
            onClick={toggleHandbrake}
            className={`w-full px-2 py-1 rounded-lg border font-mono text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
              handbrake
                ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.8)]'
                : 'bg-zinc-900 border-white/10 text-zinc-400'
            }`}
          >
            (P) FREIO
          </button>

          {isCvtWithManual && (
            <button
              onClick={toggleSimulatedManual}
              disabled={!isRunning}
              className={`w-full px-2 py-1 rounded-lg border font-mono text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                isManualSimulated
                  ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                  : 'bg-zinc-900/80 border-white/10 text-zinc-400'
              }`}
            >
              {isManualSimulated ? 'M-SIM' : 'AUTO'}
            </button>
          )}
        </div>
      </aside>

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
