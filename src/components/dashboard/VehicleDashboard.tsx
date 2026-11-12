import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useGarageStore } from '@/stores/useGarageStore'
import { useUIStore } from '@/stores/useUIStore'
import { useSimulationLoop } from '@/hooks/useSimulationLoop'
import { useAudio } from '@/hooks/useAudio'
import { useKeyboardControls } from '@/hooks/useKeyboardControls'
import { useOrientation } from '@/hooks/useOrientation'
import { useInteriorAccessories } from '@/hooks/useInteriorAccessories'
import { DashboardSystem } from '@/systems/dashboard'
import { ClusterView } from './ClusterView'
import { CockpitView } from './CockpitView'
import { MobileLandscapeCockpit } from './MobileLandscapeCockpit'
import { MobilePortraitCockpit } from './MobilePortraitCockpit'
import { RotateDeviceOverlay } from './RotateDeviceOverlay'
import { PerformanceBox } from './PerformanceBox'
import { KeyboardHUD } from './KeyboardHUD'
import { InfotainmentScreen } from './InfotainmentScreen'
import { PedalTelemetry, AftermarketPillarGaugePod } from '@/components/gauges'
import { Pedals, GearShift, EngineButton } from '@/components/controls'
import { HPatternShifter } from '@/components/controls/HPatternShifter'
import { BackfireFlameFlash, RainWindshieldEffect } from '@/components/effects'
import { BurnoutSmokeEffect } from '@/components/effects/BurnoutSmokeEffect'
import { EngineBlownSmokeEffect } from '@/components/effects/EngineBlownSmokeEffect'
import { DragStripTree } from './DragStripTree'
import { TuningGarageModal } from '@/components/tuning'
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
  const gearSelectorPosition = useSimulationStore((s) => s.gearSelectorPosition)
  const isKickdown = useSimulationStore((s) => s.isKickdown)
  const isBogWarning = useSimulationStore((s) => s.isBogWarning)
  const throttle = useSimulationStore((s) => s.throttle)
  const brake = useSimulationStore((s) => s.brake)
  const clutchPosition = useSimulationStore((s) => s.clutchPosition)
  const clutchSlipRpm = useSimulationStore((s) => s.clutchSlipRpm)
  const clutchSlipRatio = useSimulationStore((s) => s.clutchSlipRatio)
  const clutchTorqueTransfer = useSimulationStore((s) => s.clutchTorqueTransfer)
  const clutchHeat = useSimulationStore((s) => s.clutchHeat)
  const isClutchSlipping = useSimulationStore((s) => s.isClutchSlipping)
  const tcsEnabled = useSimulationStore((s) => s.tcsEnabled)
  const tcsIntervening = useSimulationStore((s) => s.tcsIntervening)
  const tcsInterventionLevel = useSimulationStore((s) => s.tcsInterventionLevel)
  const setDrivingMode = useSimulationStore((s) => s.setDrivingMode)
  const toggleSimulatedManual = useSimulationStore((s) => s.toggleSimulatedManual)
  const setTcsEnabled = useSimulationStore((s) => s.setTcsEnabled)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const handbrake = useSimulationStore((s) => s.handbrake)
  const toggleHandbrake = useSimulationStore((s) => s.toggleHandbrake)
  const setHorn = useSimulationStore((s) => s.setHorn)
  const isMuted = useSimulationStore((s) => s.isMuted)
  const toggleMute = useSimulationStore((s) => s.toggleMute)
  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const toggleExhaustValve = useSimulationStore((s) => s.toggleExhaustValve)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const cycleHeadlights = useSimulationStore((s) => s.cycleHeadlights)
  const isRaining = useSimulationStore((s) => s.isRaining)
  const toggleRain = useSimulationStore((s) => s.toggleRain)
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const windowsOpen = useSimulationStore((s) => s.windowsOpen)
  const toggleWindows = useSimulationStore((s) => s.toggleWindows)
  const shifterLayout = useSimulationStore((s) => s.shifterLayout)
  const toggleShifterLayout = useSimulationStore((s) => s.toggleShifterLayout)
  const fuelLevelLiters = useSimulationStore((s) => s.fuelLevelLiters)
  const fuelType = useSimulationStore((s) => s.fuelType)
  const isOutOfFuel = useSimulationStore((s) => s.isOutOfFuel)
  const coolantTemp = useSimulationStore((s) => s.coolantTemp)
  const oilTemp = useSimulationStore((s) => s.oilTemp)
  const isEngineBlown = useSimulationStore((s) => s.isEngineBlown)
  const brakeDiscTemp = useSimulationStore((s) => s.brakeDiscTemp)
  const isBrakeGlowing = useSimulationStore((s) => s.isBrakeGlowing)
  const brakeFadeFactor = useSimulationStore((s) => s.brakeFadeFactor)
  const hasNosKit = useSimulationStore((s) => s.hasNosKit)
  const nosActive = useSimulationStore((s) => s.nosActive)
  const nosPressurePercent = useSimulationStore((s) => s.nosPressurePercent)
  const setNosActive = useSimulationStore((s) => s.setNosActive)
  const purgeNos = useSimulationStore((s) => s.purgeNos)

  const [searchParams] = useSearchParams()
  const instanceIdFromUrl = searchParams.get('instance')
  const resolveInstanceForVehicle = useGarageStore((s) => s.resolveInstanceForVehicle)
  const activeCar = resolveInstanceForVehicle(vehicle.id, instanceIdFromUrl)

  const [isTuningOpen, setIsTuningOpen] = useState(false)
  const [isDragStripOpen, setIsDragStripOpen] = useState(false)
  const { hasInfotainment, showAftermarketBoostGauge } = useInteriorAccessories(vehicle)

  const viewMode = useUIStore((s) => s.viewMode)
  const setViewMode = useUIStore((s) => s.setViewMode)
  const allowPortraitCockpit = useUIStore((s) => s.allowPortraitCockpit)
  const setAllowPortraitCockpit = useUIStore((s) => s.setAllowPortraitCockpit)

  // Inicializar a física com as especificações do veículo e peças equipadas da unidade exata da garagem
  useEffect(() => {
    init(vehicle, activeCar?.upgrades, activeCar?.instanceId)
    return () => {
      reset()
    }
  }, [vehicle, activeCar, init, reset])

  // Disparar loop de física (120Hz)
  useSimulationLoop()

  // Conectar sistema de som (SynthEngine)
  useAudio(vehicle)

  // Conectar controles de teclado do PC (desativa enquanto modais estiverem abertos)
  useKeyboardControls(vehicle, !isTuningOpen && !isDragStripOpen)

  // Computar telemetria do DashboardSystem (desacoplado e puro)
  const telemetry = useMemo(() => {
    const input = DashboardSystem.createInputFromState(vehicle, {
      rpm,
      status,
      isRevLimiting,
      isBogWarning,
      speed,
      currentGear,
      transmissionMode,
      drivingMode,
      gearSelectorPosition,
      isKickdown,
      throttle,
      brake,
      clutchPosition,
      clutchSlipRpm,
      clutchSlipRatio,
      clutchTorqueTransfer,
      clutchHeat,
      isClutchSlipping,
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
    isBogWarning,
    speed,
    currentGear,
    transmissionMode,
    drivingMode,
    gearSelectorPosition,
    isKickdown,
    throttle,
    brake,
    clutchPosition,
    clutchSlipRpm,
    clutchSlipRatio,
    clutchTorqueTransfer,
    clutchHeat,
    isClutchSlipping,
    tcsEnabled,
    tcsIntervening,
    tcsInterventionLevel,
  ])

  const { isLandscape, isPortrait, isMobileDevice, lockLandscape } = useOrientation()

  const handleBack = () => {
    reset()
    navigate('/')
  }

  const isManualSimulated = transmissionMode === 'manual_simulated'
  const hasAutoManualToggle =
    vehicle.transmission.hasManualMode === true &&
    (vehicle.transmission.type === 'automatic' ||
      vehicle.transmission.type === 'cvt' ||
      vehicle.transmission.type === 'dct' ||
      vehicle.transmission.defaultMode === 'automatic')
  const hasTcs = !!vehicle.transmission.tcs?.enabled
  const supportedModes = vehicle.transmission.supportedModes || []

  // ── Em dispositivos móveis verticais: permitir jogar no Portrait Cockpit ou virar o celular ──
  if (isMobileDevice && isPortrait) {
    if (allowPortraitCockpit) {
      return (
        <MobilePortraitCockpit
          telemetry={telemetry}
          vehicle={vehicle}
          onBack={handleBack}
          carInstance={activeCar}
        />
      )
    }
    return (
      <RotateDeviceOverlay
        onAttemptLock={lockLandscape}
        onPlayInPortrait={() => setAllowPortraitCockpit(true)}
        onBack={handleBack}
      />
    )
  }

  // ── Em dispositivos móveis horizontais: cockpit dedicado para mobile ──
  if (isMobileDevice && isLandscape) {
    return (
      <MobileLandscapeCockpit
        telemetry={telemetry}
        vehicle={vehicle}
        onBack={handleBack}
        carInstance={activeCar}
      />
    )
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--color-bg-primary)] safe-top safe-bottom p-3 sm:p-4 justify-between select-none">
      {/* Barra de cabeçalho superior */}
      <header className="flex flex-wrap justify-between items-center w-full gap-2 mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-[var(--radius-sm)] border border-white/10 bg-white/5 text-[var(--color-text-secondary)] hover:border-red-500/50 hover:text-white transition-all active:scale-95 cursor-pointer"
          >
            ← Garagem
          </button>

          {/* Botão de Som Mute */}
          <button
            onClick={toggleMute}
            className={`px-2.5 py-1 text-xs rounded-lg border font-mono transition-all cursor-pointer ${
              isMuted ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
            }`}
            title="Alternar Áudio"
          >
            {isMuted ? '🔇 Mudo' : '🔊 Som'}
          </button>

          {/* Botão Tela Cheia */}
          <button
            onClick={toggleFullscreen}
            className="hidden sm:inline-flex px-2.5 py-1 text-xs rounded-lg border border-white/10 bg-zinc-900 text-zinc-400 hover:text-white font-mono transition-all cursor-pointer"
            title="Alternar Tela Cheia"
          >
            ⛶ Fullscreen
          </button>

          {/* Botão Oficina de Preparação (Tuning Stages) */}
          <button
            onClick={() => setIsTuningOpen(true)}
            className={`px-2.5 py-1 text-xs rounded-lg border font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
              tuningStage > 0
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-zinc-900 border-white/10 text-zinc-300 hover:text-white'
            }`}
            title="Oficina de Preparação (Stage 1, 2 e 3)"
          >
            <span>🔧</span>
            <span>{tuningStage === 0 ? 'OFICINA' : `STAGE ${tuningStage}`}</span>
          </button>

          {/* Botão Pista de Arrancada (Drag Strip 402m) */}
          <button
            onClick={() => setIsDragStripOpen(true)}
            className="px-2.5 py-1 text-xs rounded-lg border border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-500/30 font-mono font-bold transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-amber-950/40"
            title="Abrir Pista de Arrancada 402m (Árvore de Natal NHRA)"
          >
            <span>🏁</span>
            <span>402M DRAG</span>
          </button>

          {/* Botão Vidros Elétricos & Acústica */}
          {vehicle.info.category !== 'motorcycle' && (
            <button
              onClick={toggleWindows}
              className={`px-2.5 py-1 text-xs rounded-lg border font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                windowsOpen
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                  : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
              }`}
              title="Abrir/Fechar Vidros (Modifica acústica interna: 14kHz vs 2.2kHz)"
            >
              <span>🪟</span>
              <span>{windowsOpen ? 'VIDROS ABERTOS' : 'VIDROS FECHADOS'}</span>
            </button>
          )}
        </div>

        {/* Centro do Topo: Seletor de Modo de Visualização (Cluster / Cockpit) + PerformanceBox */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-zinc-950/80 p-1 rounded-full border border-white/10 text-[9px] font-mono shadow-md">
            <button
              onClick={() => setViewMode('cluster')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                viewMode === 'cluster'
                  ? 'bg-zinc-700 text-white font-bold shadow'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              CLUSTER
            </button>
            <button
              onClick={() => setViewMode('cockpit')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                viewMode === 'cockpit'
                  ? 'bg-zinc-700 text-white font-bold shadow'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Modo Cockpit com pista 3D e velocidade dinâmica"
            >
              COCKPIT
            </button>
          </div>

          {/* Performance Box (0-100 km/h Dragy Timer) */}
          <PerformanceBox />
        </div>

        {/* Informações do veículo e Atalhos */}
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--color-text-muted)] block">
              {vehicle.info.brand}
            </span>
            {activeCar?.instanceId && (
              <span className="text-[7.5px] font-mono font-bold px-1 py-0.5 rounded bg-zinc-800 text-amber-400 border border-white/10 uppercase">
                GARAGEM
              </span>
            )}
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">
            {activeCar?.vehicleId === vehicle.id ? activeCar.customName : vehicle.info.name}
          </h2>
        </div>
      </header>

      {/* Seção Central: Painel de Instrumentos ou Cockpit View */}
      <main className="flex flex-col items-center gap-2 sm:gap-3 my-auto w-full">
        {/* Controles superiores: Modo de Condução + Toggle AUTO/MANUAL + TCS */}
        <div className="flex flex-wrap items-center justify-center gap-2 w-full">
          {/* Seletor de Modo de Condução (ECO, NORMAL, SPORT, TRACK) */}
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
                  track: isActive
                    ? 'bg-purple-500/20 border-purple-500 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
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

          {/* Toggle AUTO ↔ MANUAL (Tiptronic / Borboletas) */}
          {hasAutoManualToggle && (
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

          {/* Freio de Mão Ativo Badge */}
          {handbrake && (
            <span className="px-2 py-0.5 rounded-full border border-orange-500 bg-orange-500/20 text-orange-400 text-[9px] font-mono font-bold uppercase animate-pulse">
              (P) FREIO DE MÃO
            </span>
          )}

          {/* Indicador de Patinação da Embreagem (apenas manuais) */}
          {vehicle.transmission.hasClutch && telemetry.clutchTelemetry.isSlipping && (
            <span className="px-2 py-0.5 rounded-full border border-orange-500/60 bg-orange-500/10 text-orange-400 text-[9px] font-mono font-bold uppercase animate-pulse">
              CLUTCH SLIP {Math.round(telemetry.clutchTelemetry.slipRpm)}rpm
            </span>
          )}

          {/* Aviso de motor amarrando (BOG) */}
          {telemetry.engine.isBogWarning && (
            <span className="px-2 py-0.5 rounded-full border border-yellow-500/60 bg-yellow-500/10 text-yellow-400 text-[9px] font-mono font-bold uppercase animate-pulse">
              BOG!
            </span>
          )}

          {/* Botão Válvula de Difusor de Escape */}
          <button
            onClick={toggleExhaustValve}
            className={`px-3 py-1 rounded-full border font-mono text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
              exhaustValveOpen
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                : 'bg-zinc-950/70 border-white/10 text-zinc-500'
            }`}
            title="Tecla V — Alterna Válvula de Difusor (Escape Aberto / Direto)"
          >
            <span>⚡</span>
            <span>{exhaustValveOpen ? 'DIFUSOR ON' : 'DIFUSOR OFF'}</span>
          </button>

          {/* Botão de Faróis */}
          <button
            onClick={cycleHeadlights}
            className={`px-3 py-1 rounded-full border font-mono text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
              headlightsMode !== 'off'
                ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                : 'bg-zinc-950/70 border-white/10 text-zinc-500'
            }`}
            title="Tecla L — Alterna Faróis (Desligado, Lanterna, Farol Baixo, Farol Alto)"
          >
            <span>💡</span>
            <span>{headlightsMode.toUpperCase()}</span>
          </button>

          {/* Botão de Clima & Chuva */}
          <button
            onClick={toggleRain}
            className={`px-3 py-1 rounded-full border font-mono text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
              isRaining
                ? 'bg-blue-600/30 border-blue-400 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                : 'bg-zinc-950/70 border-white/10 text-zinc-500'
            }`}
            title="Tecla C — Alterna Clima (Chuva com pista escorregadia ou Pista Seca)"
          >
            <span>{isRaining ? '🌧️ CHUVA ON' : '☀️ SECO'}</span>
          </button>
        </div>

        {/* ── Barra de Telemetria de Realismo: Combustível, Térmica e Freios ── */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono">
          {/* Nível de Combustível */}
          <div
            className={`flex items-center gap-1 px-3 py-1 rounded-full border ${
              isOutOfFuel
                ? 'border-red-500 bg-red-950/70 text-red-300 animate-pulse font-black'
                : fuelLevelLiters < 8
                ? 'border-amber-500 bg-amber-950/60 text-amber-300 font-bold'
                : 'border-white/10 bg-black/60 text-neutral-300'
            }`}
          >
            <span>⛽</span>
            <span>{isOutOfFuel ? 'PANE SECA' : `${fuelLevelLiters.toFixed(1)}L`}</span>
            <span className="text-[8.5px] uppercase opacity-75">
              ({fuelType === 'ethanol_e100' ? 'Etanol E100' : fuelType === 'premium_podium' ? 'Podium 102' : 'Comum'})
            </span>
          </div>

          {/* Arrefecimento do Motor & Temperatura do Óleo */}
          <div
            className={`flex items-center gap-1 px-3 py-1 rounded-full border ${
              isEngineBlown
                ? 'border-red-500 bg-red-950/80 text-red-400 font-black animate-pulse'
                : coolantTemp >= 115
                ? 'border-red-500 bg-red-950/70 text-red-300 animate-pulse font-bold'
                : 'border-white/10 bg-black/60 text-neutral-300'
            }`}
          >
            <span>🌡️</span>
            <span>H2O: <strong className={coolantTemp >= 115 ? 'text-red-400' : 'text-white'}>{Math.round(coolantTemp)}°C</strong></span>
            <span className="text-neutral-500">|</span>
            <span>ÓLEO: <strong>{Math.round(oilTemp)}°C</strong></span>
          </div>

          {/* Temperatura de Freios & Brake Fade */}
          <div
            className={`flex items-center gap-1 px-3 py-1 rounded-full border ${
              brakeDiscTemp > 650
                ? 'border-purple-500 bg-purple-950/70 text-purple-300 animate-pulse font-bold'
                : isBrakeGlowing
                ? 'border-red-500 bg-red-950/70 text-red-400 animate-pulse'
                : 'border-white/10 bg-black/60 text-neutral-300'
            }`}
          >
            <span>🛑</span>
            <span>DISCOS: <strong>{Math.round(brakeDiscTemp)}°C</strong></span>
            {isBrakeGlowing && <span className="font-bold text-red-400">🔥 AO RUBRO</span>}
            {brakeDiscTemp > 650 && (
              <span className="font-black text-purple-300">
                ⚠️ BRAKE FADE ({Math.round(brakeFadeFactor * 100)}%)
              </span>
            )}
          </div>
        </div>

        {/* HUD Interativo de Teclas Físicas do PC */}
        <KeyboardHUD hasClutch={vehicle.transmission.hasClutch} />

        {/* ── Banner de Launch Control ── */}
        {isLaunchControlArmed && (
          <div className="w-full max-w-xl py-2 px-4 rounded-xl bg-amber-500/20 border-2 border-amber-400 text-amber-300 font-mono font-black text-center text-xs sm:text-sm tracking-wide animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2">
            <span>🏁</span>
            <span>LAUNCH CONTROL ATIVO — SEGURE O FREIO E ACELERE TUDO, SOLTE O FREIO PARA LARGAR!</span>
            <span>🏁</span>
          </div>
        )}
        {isLaunching && (
          <div className="w-full max-w-xl py-2 px-4 rounded-xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 font-mono font-black text-center text-xs sm:text-sm tracking-wide shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2">
            <span>🚀</span>
            <span>LARGADA DISPARADA! ACELERAÇÃO MÁXIMA!</span>
            <span>🚀</span>
          </div>
        )}

        {/* ── Painel de Instrumentos Modular (ClusterView) ou Visão de Cabine (CockpitView) ── */}
        <div className="relative w-full flex flex-col xl:flex-row items-center justify-center gap-4">
          <div className="w-full max-w-5xl flex items-center justify-center relative">
            {/* Manômetro Esportivo de Coluna Aftermarket (visível quando equipado em carros sem manômetro original) */}
            {showAftermarketBoostGauge && viewMode === 'cluster' && (
              <div className="hidden sm:flex absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-20 animate-in zoom-in-95 duration-200">
                <AftermarketPillarGaugePod size={88} />
              </div>
            )}

            {viewMode === 'cluster' ? (
              <ClusterView telemetry={telemetry} />
            ) : (
              <CockpitView telemetry={telemetry} vehicle={vehicle} />
            )}
          </div>

          {/* Central Multimídia Automotiva ao lado (Console Central com Sport HMI / Turbo / Yaris / Porsche) */}
          {hasInfotainment && (
            <div className="flex flex-col items-center justify-center shrink-0">
              <InfotainmentScreen vehicle={vehicle} telemetry={telemetry} />
            </div>
          )}
        </div>

        {/* ── Telemetria Analógica dos Pedais (0-100%) ── */}
        <PedalTelemetry
          throttlePercent={telemetry.pedals.throttlePercent}
          brakePercent={telemetry.pedals.brakePercent}
          clutchPercent={telemetry.pedals.clutchPercent}
          hasClutch={telemetry.pedals.hasClutch}
        />
      </main>

      {/* Seção Inferior: Controles de Pilotagem (Start, Alavanca, Freio de Mão, Pedais) */}
      <footer className="w-full flex flex-col items-center gap-3 sm:gap-4 mt-auto">
        {/* Controles: Start Engine, Freio de Mão, Buzina & Shifter */}
        <div className="flex items-center justify-between w-full max-w-md px-2">
          <div className="flex items-center gap-2">
            <EngineButton />

            {/* Buzina Desktop */}
            <button
              onPointerDown={() => setHorn(true)}
              onPointerUp={() => setHorn(false)}
              onPointerCancel={() => setHorn(false)}
              className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/10 active:bg-amber-500/20 active:border-amber-400 flex items-center justify-center text-sm transition-all active:scale-95 cursor-pointer"
              title="Buzina (H)"
            >
              📢
            </button>

            {/* Freio de mão Desktop */}
            <button
              onClick={toggleHandbrake}
              className={`px-2.5 py-2 rounded-xl border font-mono text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                handbrake
                  ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.8)]'
                  : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
              }`}
              title="Tecla Espaço — Freio de mão"
            >
              (P) {handbrake ? 'TRAVADO' : 'FREIO'}
            </button>

            {/* Injeção de Nitro (NOS) & Purga */}
            {hasNosKit && (
              <div className="flex items-center gap-1">
                <button
                  onPointerDown={() => setNosActive(true)}
                  onPointerUp={() => setNosActive(false)}
                  onPointerCancel={() => setNosActive(false)}
                  disabled={nosPressurePercent <= 0 || !isRunning}
                  className={`px-3 py-2 rounded-xl border font-mono text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow ${
                    nosActive
                      ? 'bg-cyan-400 text-black border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.9)] animate-pulse'
                      : nosPressurePercent <= 0
                      ? 'bg-zinc-900/50 text-zinc-600 border-zinc-800'
                      : 'bg-cyan-950/70 text-cyan-300 border-cyan-500/50 hover:bg-cyan-900/80'
                  }`}
                  title="Segure tecla B ou Shift para disparar Nitro (NOS)"
                >
                  <span>⚡</span>
                  <span>NOS {Math.round(nosPressurePercent)}%</span>
                </button>
                <button
                  onClick={purgeNos}
                  disabled={nosPressurePercent <= 0}
                  className="px-2 py-2 rounded-xl border border-sky-400/40 bg-sky-950/50 text-sky-300 text-[10px] font-black uppercase transition-all active:scale-95 cursor-pointer"
                  title="Purga de Nitro (Tecla X)"
                >
                  💨
                </button>
              </div>
            )}
          </div>

          {/* Seletor de Câmbio: H-Pattern vs Sequencial para manuais, ou PRNDS/M para automáticos */}
          <div className="flex items-center gap-1.5">
            {vehicle.transmission.hasClutch && (
              <button
                onClick={toggleShifterLayout}
                className="px-2 py-1.5 rounded-lg border border-white/10 bg-zinc-900 text-zinc-400 hover:text-white font-mono text-[9px] font-bold uppercase transition-all"
                title="Alternar entre Câmbio Sequencial (+/-) e Grade H (1ª-6ª + R)"
              >
                {shifterLayout === 'h_pattern' ? 'GRADE H' : 'SEQ (+/-)'}
              </button>
            )}
            <GearShift />
          </div>
        </div>

        {/* Câmbio H-Pattern Interativo na Tela (quando ativado no modo manual) */}
        {vehicle.transmission.hasClutch && shifterLayout === 'h_pattern' && (
          <div className="w-full max-w-xs animate-in zoom-in-95 duration-150">
            <HPatternShifter gearCount={vehicle.transmission.gearCount} />
          </div>
        )}

        {/* Pedais interativos com Pointer Capture */}
        <Pedals vehicle={vehicle} />
      </footer>

      {/* ── Efeitos Especiais de Imersão e Oficina ── */}
      <BackfireFlameFlash />
      <RainWindshieldEffect />
      <BurnoutSmokeEffect />
      <EngineBlownSmokeEffect />

      {/* Pista de Arrancada 402m (Drag Strip Modal) */}
      {isDragStripOpen && <DragStripTree onClose={() => setIsDragStripOpen(false)} />}

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
}
