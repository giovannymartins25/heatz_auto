import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useSimulationLoop } from '@/hooks/useSimulationLoop'
import { useAudio } from '@/hooks/useAudio'
import { useKeyboardControls } from '@/hooks/useKeyboardControls'
import { DashboardSystem } from '@/systems/dashboard'
import { ClusterView } from './ClusterView'
import { PedalTelemetry } from '@/components/gauges'
import { Pedals, GearShift, EngineButton } from '@/components/controls'
import type { VehicleConfig, DrivingMode } from '@/types'

interface VehicleDashboardProps {
  vehicle: VehicleConfig
}

export function VehicleDashboard({ vehicle }: VehicleDashboardProps) {
  const navigate = useNavigate()
  const init = useSimulationStore((s) => s.init)
  const reset = useSimulationStore((s) => s.reset)

  // Estados em tempo real da store
  const rpm = useSimulationStore((s) => s.rpm)
  const speed = useSimulationStore((s) => s.speed)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const status = useSimulationStore((s) => s.status)
  const isRevLimiting = useSimulationStore((s) => s.isRevLimiting)
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const isKickdown = useSimulationStore((s) => s.isKickdown)
  const throttle = useSimulationStore((s) => s.throttle)
  const brake = useSimulationStore((s) => s.brake)
  const clutchPosition = useSimulationStore((s) => s.clutchPosition)
  const tcsEnabled = useSimulationStore((s) => s.tcsEnabled)
  const tcsIntervening = useSimulationStore((s) => s.tcsIntervening)
  const tcsInterventionLevel = useSimulationStore((s) => s.tcsInterventionLevel)
  const setDrivingMode = useSimulationStore((s) => s.setDrivingMode)
  const toggleSimulatedManual = useSimulationStore((s) => s.toggleSimulatedManual)
  const setTcsEnabled = useSimulationStore((s) => s.setTcsEnabled)
  const isRunning = useSimulationStore((s) => s.isRunning)

  // Modo de visualização: Cluster View (padrão) ou Cockpit View (preparado para câmera 3D futura)
  const [viewMode, setViewMode] = useState<'cluster' | 'cockpit'>('cluster')

  // Inicializar a física com as especificações do veículo
  useEffect(() => {
    init(vehicle)
    return () => {
      reset()
    }
  }, [vehicle, init, reset])

  // Disparar loop de física (120Hz)
  useSimulationLoop()

  // Conectar sistema de som (SynthEngine)
  useAudio(vehicle)

  // Conectar controles de teclado do PC
  useKeyboardControls(vehicle)

  // Computar telemetria do DashboardSystem (desacoplado e puro)
  const telemetry = useMemo(() => {
    const input = DashboardSystem.createInputFromState(vehicle, {
      rpm,
      status,
      isRevLimiting,
      speed,
      currentGear,
      transmissionMode,
      drivingMode,
      isKickdown,
      throttle,
      brake,
      clutchPosition,
      tcsEnabled,
      tcsIntervening,
      tcsInterventionLevel,
    })
    return DashboardSystem.computeTelemetry(input)
  }, [
    vehicle,
    rpm,
    status,
    isRevLimiting,
    speed,
    currentGear,
    transmissionMode,
    drivingMode,
    isKickdown,
    throttle,
    brake,
    clutchPosition,
    tcsEnabled,
    tcsIntervening,
    tcsInterventionLevel,
  ])

  const handleBack = () => {
    reset()
    navigate('/')
  }

  const isManualSimulated = transmissionMode === 'manual_simulated'
  const isCvtWithManualMode = vehicle.transmission.hasManualMode === true
  const hasTcs = !!vehicle.transmission.tcs?.enabled
  const supportedModes = vehicle.transmission.supportedModes || []

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--color-bg-primary)] safe-top safe-bottom p-3 sm:p-4 justify-between select-none">
      {/* Barra de cabeçalho superior */}
      <header className="flex justify-between items-center w-full mb-1">
        <button
          onClick={handleBack}
          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-[var(--radius-sm)] border border-white/10 bg-white/5 text-[var(--color-text-secondary)] hover:border-red-500/50 hover:text-white transition-all active:scale-95 cursor-pointer"
        >
          ← Garagem
        </button>

        {/* Seletor de Modo de Visualização (Cluster / Cockpit) */}
        <div className="flex items-center gap-1 bg-zinc-950/70 p-1 rounded-full border border-white/10 text-[9px] font-mono">
          <button
            onClick={() => setViewMode('cluster')}
            className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
              viewMode === 'cluster'
                ? 'bg-zinc-700 text-white font-bold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            CLUSTER
          </button>
          <button
            onClick={() => setViewMode('cockpit')}
            className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
              viewMode === 'cockpit'
                ? 'bg-zinc-700 text-white font-bold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Modo Cockpit View preparado para câmera 3D"
          >
            COCKPIT
          </button>
        </div>

        {/* Informações do veículo */}
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <span className="hidden sm:inline text-[9px] font-mono text-zinc-500 border border-white/10 px-1.5 py-0.5 rounded">
              {vehicle.transmission.hasClutch
                ? 'W=Acel | E=Freio | Q=Embr'
                : isCvtWithManualMode
                ? 'W=Acel | E=Freio | M=Auto/Man | T=TCS'
                : 'W=Acel | E=Freio'}
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--color-text-muted)] block">
              {vehicle.info.brand}
            </span>
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">{vehicle.info.name}</h2>
        </div>
      </header>

      {/* Seção Central: Painel de Instrumentos (Gauges / ClusterView) */}
      <main className="flex flex-col items-center gap-2 sm:gap-4 my-auto w-full">
        {/* Controles superiores: Modo de Condução + Toggle AUTO/MANUAL + TCS */}
        <div className="flex flex-wrap items-center justify-center gap-2 w-full">
          {/* Seletor de Modo de Condução (ECO, NORMAL, SPORT) */}
          {supportedModes.length > 1 && (
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-zinc-950/80 border border-white/10 shadow-lg">
              {supportedModes.map((mode) => {
                const isActive = drivingMode === mode
                const styles = {
                  eco: isActive
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300',
                  normal: isActive
                    ? 'bg-zinc-700/40 border-zinc-500 text-white shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300',
                  sport: isActive
                    ? 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300',
                }[mode]

                return (
                  <button
                    key={mode}
                    onClick={() => setDrivingMode(mode as DrivingMode)}
                    className={`px-2.5 py-0.5 text-[10px] font-mono font-black uppercase rounded-full border transition-all active:scale-95 cursor-pointer ${styles}`}
                  >
                    {mode}
                  </button>
                )
              })}
            </div>
          )}

          {/* Toggle AUTO ↔ MANUAL (apenas CVTs com hasManualMode) */}
          {isCvtWithManualMode && (
            <button
              id="btn-auto-manual-toggle"
              onClick={toggleSimulatedManual}
              disabled={!isRunning}
              className={`px-3 py-1 rounded-full border font-mono text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer disabled:opacity-40 ${
                isManualSimulated
                  ? 'bg-sky-500/20 border-sky-500 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                  : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-300'
              }`}
              title="Tecla M — Alterna entre AUTO e MANUAL SIMULADO"
            >
              {isManualSimulated ? '⇌ MANUAL' : '⇌ AUTO'}
            </button>
          )}

          {/* Indicador e Controle TCS */}
          {hasTcs && (
            <button
              id="btn-tcs-toggle"
              onClick={() => setTcsEnabled(!tcsEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border font-mono text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer ${
                !tcsEnabled
                  ? 'bg-zinc-950/70 border-zinc-700/30 text-zinc-600 line-through'
                  : tcsIntervening
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse'
                  : 'bg-zinc-950/60 border-white/10 text-zinc-400'
              }`}
              title="Tecla T — Liga/desliga TCS"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  !tcsEnabled ? 'bg-zinc-600' : tcsIntervening ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                }`}
              />
              {telemetry.tcs.statusLabel}
              {tcsIntervening && tcsEnabled && (
                <span className="text-amber-400 font-black">●</span>
              )}
            </button>
          )}
        </div>

        {/* ── Painel de Instrumentos Modular (ClusterView) ── */}
        <ClusterView telemetry={telemetry} />

        {/* ── Telemetria Analógica dos Pedais (0-100%) ── */}
        <PedalTelemetry
          throttlePercent={telemetry.pedals.throttlePercent}
          brakePercent={telemetry.pedals.brakePercent}
          clutchPercent={telemetry.pedals.clutchPercent}
          hasClutch={telemetry.pedals.hasClutch}
        />
      </main>

      {/* Seção Inferior: Controles de Pilotagem (Start, Alavanca, Pedais) */}
      <footer className="w-full flex flex-col items-center gap-4 sm:gap-6 mt-auto">
        {/* Controles: Start Engine & Shifter */}
        <div className="flex items-center justify-between w-full max-w-sm px-2">
          <EngineButton />

          {/* Câmbio manual ou manual simulado: exibe alavanca de trocas */}
          {transmissionMode === 'manual' || transmissionMode === 'manual_simulated' ? (
            <GearShift />
          ) : (
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">
                Transmissão
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400 px-2.5 py-1 rounded bg-zinc-950 border border-white/10 mt-0.5">
                CVT AUTOMÁTICO
              </span>
            </div>
          )}
        </div>

        {/* Pedais interativos com Pointer Capture */}
        <Pedals vehicle={vehicle} />
      </footer>
    </div>
  )
}
