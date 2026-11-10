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
  const triggerBackfireFlame = useSimulationStore((s) => s.triggerBackfireFlame)

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
    synth.setExhaustValve(exhaustValveOpen)

    if (isRevLimiting) {
      synth.triggerBackfire()
      triggerBackfireFlame()
    }

    if (isLaunchControlArmed) {
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
      if (exhaustValveOpen && Math.random() < 0.4) {
        triggerBackfireFlame()
      }
    }

    prevThrottleRef.current = throttle
    prevBoostRef.current = boostPressureBar
  }, [rpm, throttle, isRevLimiting, isLaunchControlArmed, boostPressureBar, exhaustValveOpen, triggerBackfireFlame])

  // Troca de marcha em alta rotação (PDK / DSG / Racing shift brap)
  useEffect(() => {
    const synth = engineRef.current
    if (!synth || !synth.isPlaying) return

    const prevGear = prevGearRef.current
    if (currentGear > prevGear && prevGear > 0 && throttle > 0.4 && rpm > 3400) {
      synth.triggerShiftBrap()
      triggerBackfireFlame()
    }
    prevGearRef.current = currentGear
  }, [currentGear, throttle, rpm, triggerBackfireFlame])

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
}
