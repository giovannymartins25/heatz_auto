import { useEffect, useRef } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { SynthEngine } from '@/systems/audio/SynthEngine'
import type { VehicleConfig } from '@/types'

/**
 * useAudio — Conecta o sistema de áudio à simulação.
 *
 * Cria e gerencia o SynthEngine, atualizando RPM e throttle
 * a cada frame baseado no estado da simulação store.
 */
export function useAudio(config: VehicleConfig | null) {
  const engineRef = useRef<SynthEngine | null>(null)
  const rpm = useSimulationStore((s) => s.rpm)
  const throttle = useSimulationStore((s) => s.throttle)
  const isRunning = useSimulationStore((s) => s.isRunning)

  // Inicializar o engine quando o veículo é carregado
  useEffect(() => {
    if (!config) return

    const synth = new SynthEngine(
      config.audio.synthConfig,
      config.engine.idleRpm,
      config.engine.maxRpm,
    )

    engineRef.current = synth

    return () => {
      synth.dispose()
      engineRef.current = null
    }
  }, [config])

  // Iniciar/parar áudio junto com o motor
  useEffect(() => {
    const synth = engineRef.current
    if (!synth) return

    const initAndToggle = async () => {
      if (isRunning) {
        if (!synth.isInitialized) {
          await synth.init()
        }
        synth.start()
      } else {
        synth.stop()
      }
    }

    initAndToggle()
  }, [isRunning])

  // Atualizar RPM e throttle do áudio
  useEffect(() => {
    const synth = engineRef.current
    if (!synth || !synth.isPlaying) return

    synth.setRpm(rpm)
    synth.setThrottle(throttle)
  }, [rpm, throttle])
}
