import { useEffect, useRef } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { SynthEngine } from '@/systems/audio/SynthEngine'
import type { VehicleConfig } from '@/types'

/**
 * useAudio — Conecta o sistema de áudio acústico realista à simulação.
 *
 * Gerencia o ciclo de vida do SynthEngine, sincronizando RPM, throttle,
 * corte de giro, estampidos de troca de marcha (brap), borbulhas de escape
 * e efeitos de partida e buzina com a física do veículo.
 */
export function useAudio(config: VehicleConfig | null) {
  const engineRef = useRef<SynthEngine | null>(null)
  const prevGearRef = useRef<number>(0)
  const prevStatusRef = useRef<string>('off')
  const prevThrottleRef = useRef<number>(0)
  const prevBoostRef = useRef<number>(0)

  const rpm = useSimulationStore((s) => s.rpm)
  const throttle = useSimulationStore((s) => s.throttle)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const status = useSimulationStore((s) => s.status)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const isRevLimiting = useSimulationStore((s) => s.isRevLimiting)
  const isHornActive = useSimulationStore((s) => s.isHornActive)
  const isMuted = useSimulationStore((s) => s.isMuted)
  const masterVolume = useSimulationStore((s) => s.masterVolume)
  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const hasPopsAndBangs = useSimulationStore((s) => s.hasPopsAndBangs)
  const popsAndBangsEnabled = useSimulationStore((s) => s.popsAndBangsEnabled)
  const exhaustType = useSimulationStore((s) => s.exhaustType)
  const triggerBackfireFlame = useSimulationStore((s) => s.triggerBackfireFlame)
  const windowsOpen = useSimulationStore((s) => s.windowsOpen)
  const windowAverageOpenRatio = useSimulationStore((s) => s.windowAverageOpenRatio)
  const gearGrindTrigger = useSimulationStore((s) => s.gearGrindTrigger)
  const engineBlownTrigger = useSimulationStore((s) => s.engineBlownTrigger)
  const isBurningOut = useSimulationStore((s) => s.isBurningOut)
  const tireSmokeDensity = useSimulationStore((s) => s.tireSmokeDensity)

  const prevGrindRef = useRef<number>(0)
  const prevBlownRef = useRef<number>(0)

  // Inicializar o engine quando o veículo é carregado
  useEffect(() => {
    if (!config) return

    const synth = new SynthEngine(
      config.audio.synthConfig,
      config.engine.idleRpm,
      config.engine.maxRpm,
    )

    engineRef.current = synth
    prevGearRef.current = 0
    prevStatusRef.current = 'off'

    return () => {
      synth.dispose()
      engineRef.current = null
    }
  }, [config])

  // Iniciar/parar áudio junto com o motor e tocar arranque
  useEffect(() => {
    const synth = engineRef.current
    if (!synth) return

    const initAndToggle = async () => {
      if (status === 'starting' && prevStatusRef.current !== 'starting') {
        if (!synth.isInitialized) await synth.init()
        synth.playStarterCrank()
      }

      if (isRunning) {
        if (!synth.isInitialized) {
          await synth.init()
        }
        synth.start()
      } else if (status === 'off' || status === 'stalled') {
        synth.stop()
      }
      prevStatusRef.current = status
    }

    initAndToggle()
  }, [isRunning, status])

  // Atualizar RPM e throttle do áudio
  useEffect(() => {
    const synth = engineRef.current
    if (!synth || !synth.isPlaying) return

    synth.setRpm(rpm)
    synth.setThrottle(throttle)
    synth.setTurboBoost(boostPressureBar)
    synth.setExhaustValve(exhaustValveOpen || exhaustType === 'straight_pipe' || (hasPopsAndBangs && popsAndBangsEnabled))

    const isPopsActive = hasPopsAndBangs && popsAndBangsEnabled

    if (isRevLimiting && (exhaustValveOpen || isPopsActive || exhaustType === 'straight_pipe')) {
      synth.triggerBackfire()
      triggerBackfireFlame()
    }

    if (isLaunchControlArmed && (exhaustValveOpen || isPopsActive)) {
      synth.triggerLaunchLimiter()
      if (Math.random() < 0.3) {
        triggerBackfireFlame()
      }
    }

    // Detecção de alívio do turbo (Blow-Off / Compressor flutter ao soltar acelerador)
    const prevThrottle = prevThrottleRef.current
    const prevBoost = prevBoostRef.current
    if (throttle < 0.22 && prevThrottle >= 0.45 && prevBoost > 0.25) {
      synth.triggerBlowOff(prevBoost)
      if ((exhaustValveOpen || isPopsActive) && Math.random() < 0.4) {
        triggerBackfireFlame()
      }
    }

    // Overrun Crackles / Pops and Bangs ativo ao soltar o acelerador em giros médios/altos
    if (isPopsActive && throttle < 0.15 && prevThrottle >= 0.38 && rpm > 2600) {
      synth.triggerBackfire()
      if (Math.random() < (exhaustType === 'straight_pipe' || exhaustType === 'downpipe' ? 0.75 : 0.4)) {
        triggerBackfireFlame()
      }
    }

    prevThrottleRef.current = throttle
    prevBoostRef.current = boostPressureBar
  }, [rpm, throttle, isRevLimiting, isLaunchControlArmed, boostPressureBar, exhaustValveOpen, hasPopsAndBangs, popsAndBangsEnabled, exhaustType, triggerBackfireFlame])

  // Troca de marcha em alta rotação (PDK / DSG / Racing shift brap)
  useEffect(() => {
    const synth = engineRef.current
    if (!synth || !synth.isPlaying) return

    const prevGear = prevGearRef.current
    const isPopsActive = hasPopsAndBangs && popsAndBangsEnabled
    if (currentGear > prevGear && prevGear > 0 && throttle > 0.4 && rpm > 3400 && (exhaustValveOpen || isPopsActive || exhaustType === 'straight_pipe')) {
      synth.triggerShiftBrap()
      triggerBackfireFlame()
    }
    prevGearRef.current = currentGear
  }, [currentGear, throttle, rpm, hasPopsAndBangs, popsAndBangsEnabled, exhaustType, exhaustValveOpen, triggerBackfireFlame])

  // Controle de buzina
  useEffect(() => {
    const synth = engineRef.current
    if (!synth) return

    if (isHornActive) {
      synth.startHorn()
    } else {
      synth.stopHorn()
    }
  }, [isHornActive])

  // Controle de mute e volume
  useEffect(() => {
    const synth = engineRef.current
    if (!synth) return

    synth.setMasterGain(isMuted ? 0 : masterVolume)
  }, [isMuted, masterVolume])

  // Acústica de Cabine & Vidros (abertura gradual 0% a 100%)
  useEffect(() => {
    const synth = engineRef.current
    if (!synth) return
    synth.setWindowsOpen(windowsOpen, windowAverageOpenRatio)
  }, [windowsOpen, windowAverageOpenRatio])

  // Som de sincronizador arranhando (Crrrck!)
  useEffect(() => {
    const synth = engineRef.current
    if (!synth || !gearGrindTrigger) return
    if (gearGrindTrigger !== prevGrindRef.current) {
      prevGrindRef.current = gearGrindTrigger
      synth.playGearGrind()
    }
  }, [gearGrindTrigger])

  // Som de quebra mecânica / motor fundido (Blown Engine)
  useEffect(() => {
    const synth = engineRef.current
    if (!synth || !engineBlownTrigger) return
    if (engineBlownTrigger !== prevBlownRef.current) {
      prevBlownRef.current = engineBlownTrigger
      synth.playEngineBlown()
    }
  }, [engineBlownTrigger])

  // Chiado contínuo de burnout / fritar pneu
  useEffect(() => {
    const synth = engineRef.current
    if (!synth) return
    synth.setBurnout(isBurningOut, tireSmokeDensity)
  }, [isBurningOut, tireSmokeDensity])
}
