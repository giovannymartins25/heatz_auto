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

  const rpm = useSimulationStore((s) => s.rpm)
  const throttle = useSimulationStore((s) => s.throttle)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const status = useSimulationStore((s) => s.status)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const isRevLimiting = useSimulationStore((s) => s.isRevLimiting)
  const isHornActive = useSimulationStore((s) => s.isHornActive)
  const isMuted = useSimulationStore((s) => s.isMuted)
  const masterVolume = useSimulationStore((s) => s.masterVolume)

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

    if (isRevLimiting) {
      synth.triggerBackfire()
    }
  }, [rpm, throttle, isRevLimiting])

  // Troca de marcha em alta rotação (PDK / DSG / Racing shift brap)
  useEffect(() => {
    const synth = engineRef.current
    if (!synth || !synth.isPlaying) return

    const prevGear = prevGearRef.current
    if (currentGear > prevGear && prevGear > 0 && throttle > 0.4 && rpm > 3400) {
      synth.triggerShiftBrap()
    }
    prevGearRef.current = currentGear
  }, [currentGear, throttle, rpm])

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
