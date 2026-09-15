import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig, DrivingMode } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { AnalogPedal } from '@/components/controls/AnalogPedal'
import { GearShift } from '@/components/controls/GearShift'
import { EngineButton } from '@/components/controls/EngineButton'

export interface MobileLandscapeCockpitProps {
  telemetry: DashboardTelemetry
  vehicle: VehicleConfig
  onBack: () => void
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

  const hasClutch = vehicle.transmission.hasClutch ?? false
  const isCvtWithManual = vehicle.transmission.hasManualMode === true
  const isManualSimulated = transmissionMode === 'manual_simulated'
  const isManualOrSimulated = transmissionMode === 'manual' || transmissionMode === 'manual_simulated'
  const supportedModes = vehicle.transmission.supportedModes || []

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
        <header className="flex items-center justify-between w-full">
          <button
            onClick={onBack}
            className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-white transition-all active:scale-95 cursor-pointer"
          >
            ← Sair
          </button>

          {/* Seletores compactos de Modo de Condução */}
          <div className="flex items-center gap-1.5 bg-zinc-900/90 px-2 py-0.5 rounded-full border border-white/10">
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

            {/* Botão TCS */}
            {vehicle.transmission.tcs?.enabled && (
              <button
                onClick={() => setTcsEnabled(!tcsEnabled)}
                className={`ml-1 px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded-full border transition-all cursor-pointer ${
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

          <div className="text-right">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block leading-none">
              {vehicle.info.brand}
            </span>
            <span className="text-xs font-bold text-white tracking-tight truncate max-w-[120px] block leading-tight">
              {vehicle.info.name}
            </span>
          </div>
        </header>

        {/* Bloco Central de Telemetria Horizontal */}
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
        {/* Botão de Partida / Desligar Motor */}
        <div className="w-full flex justify-center">
          <EngineButton />
        </div>

        {/* Câmbio Sequencial Touch (▲ + e ▼ -) */}
        {isManualOrSimulated ? (
          <div className="my-auto py-2">
            <GearShift orientation="vertical" size="compact" />
          </div>
        ) : (
          <div className="my-auto text-center px-2 py-4 rounded-xl bg-zinc-900/50 border border-white/5">
            <span className="text-[9px] font-mono uppercase text-zinc-500 block">CVT</span>
            <span className="text-xs font-mono font-bold text-emerald-400">AUTO</span>
          </div>
        )}

        {/* Alternador AUTO ↔ MANUAL SIMULADO (para Yaris) */}
        {isCvtWithManual ? (
          <button
            onClick={toggleSimulatedManual}
            disabled={!isRunning}
            className={`w-full px-2 py-1.5 rounded-xl border font-mono text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
              isManualSimulated
                ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                : 'bg-zinc-900/80 border-white/10 text-zinc-400'
            }`}
          >
            {isManualSimulated ? 'M-SIM' : 'AUTO'}
          </button>
        ) : (
          <div className="h-6" />
        )}
      </aside>
    </div>
  )
})
