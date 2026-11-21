import { useEffect, useState, useCallback } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { sharedTiltSteering, type SharedTiltSnapshot } from '@/systems/input'

/**
 * useDeviceTilt — Hook gerenciador dos sensores de movimento (DeviceOrientationEvent)
 * para controle de direção por inclinação no HEATZ AUTO.
 *
 * Delega para o singleton `sharedTiltSteering` para garantir uma única instância de
 * TiltSteeringController, um único listener global e calibração compartilhada entre
 * todos os componentes montados simultaneamente.
 */
export function useDeviceTilt() {
  const steeringMethod = useSimulationStore((s) => s.steeringMethod)
  const tiltSteeringEnabled = useSimulationStore((s) => s.tiltSteeringEnabled)
  const steeringSensitivity = useSimulationStore((s) => s.steeringSensitivity)
  const steeringDeadzone = useSimulationStore((s) => s.steeringDeadzone)
  const sensorPermission = useSimulationStore((s) => s.sensorPermission)
  const setSensorPermission = useSimulationStore((s) => s.setSensorPermission)

  const [snapshot, setSnapshot] = useState<SharedTiltSnapshot>(() =>
    sharedTiltSteering.getSnapshot(),
  )

  // Verifica suporte aos sensores na inicialização
  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensorPermission('unsupported')
      return
    }

    const DeviceOrientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }

    if (typeof DeviceOrientation.requestPermission !== 'function') {
      if (sensorPermission === 'unsupported') {
        setSensorPermission('prompt')
      }
    }
  }, [sensorPermission, setSensorPermission])

  // Sincroniza configurações com o controlador compartilhado
  useEffect(() => {
    sharedTiltSteering.syncConfig({
      enabled: tiltSteeringEnabled && steeringMethod === 'tilt',
      sensitivity: steeringSensitivity,
      deadzoneDeg: steeringDeadzone,
    })
  }, [tiltSteeringEnabled, steeringMethod, steeringSensitivity, steeringDeadzone])

  // Assina o singleton compartilhado (apenas 1 listener global para toda a aplicação)
  useEffect(() => {
    if (typeof window === 'undefined' || sensorPermission === 'unsupported' || sensorPermission === 'denied') {
      return
    }
    return sharedTiltSteering.subscribe(setSnapshot)
  }, [sensorPermission])

  /**
   * Solicita permissão ao usuário (obrigatório em iOS Safari via gesto explícito).
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensorPermission('unsupported')
      return false
    }

    const DeviceOrientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }

    if (typeof DeviceOrientation.requestPermission === 'function') {
      try {
        const response = await DeviceOrientation.requestPermission()
        if (response === 'granted') {
          setSensorPermission('granted')
          return true
        } else {
          setSensorPermission('denied')
          return false
        }
      } catch (err) {
        console.warn('[HEATZ TILT] Erro ao solicitar permissão de orientação:', err)
        setSensorPermission('denied')
        return false
      }
    } else {
      setSensorPermission('granted')
      return true
    }
  }, [setSensorPermission])

  const calibrateNeutral = useCallback((): number => {
    return sharedTiltSteering.calibrateNeutral()
  }, [])

  const resetCalibration = useCallback(() => {
    sharedTiltSteering.resetCalibration()
  }, [])

  return {
    isSupported: sensorPermission !== 'unsupported',
    permission: sensorPermission,
    rawAngleDeg: snapshot.rawAngleDeg,
    calibratedAngleDeg: snapshot.calibratedAngleDeg,
    isCalibrated: snapshot.isCalibrated,
    requestPermission,
    calibrateNeutral,
    resetCalibration,
    controller: sharedTiltSteering.getController(),
  }
}
