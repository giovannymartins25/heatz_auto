import { useEffect, useState, useCallback } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import {
  sharedTiltSteering,
  requiresDeviceOrientationPermissionPrompt,
  type SharedTiltSnapshot,
} from '@/systems/input'

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
  const steeringInvertDirection = useSimulationStore((s) => s.steeringInvertDirection)
  const sensorPermission = useSimulationStore((s) => s.sensorPermission)
  const setSensorPermission = useSimulationStore((s) => s.setSensorPermission)

  const [snapshot, setSnapshot] = useState<SharedTiltSnapshot>(() =>
    sharedTiltSteering.getSnapshot(),
  )

  const requiresPermissionPrompt = requiresDeviceOrientationPermissionPrompt()

  // Verifica suporte aos sensores na inicialização sem exibir prompt iOS em Android/Desktop
  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensorPermission('unsupported')
      return
    }

    if (!requiresDeviceOrientationPermissionPrompt() && sensorPermission === 'unsupported') {
      setSensorPermission('prompt')
    }
  }, [sensorPermission, setSensorPermission])

  // Sincroniza configurações com o controlador compartilhado
  useEffect(() => {
    sharedTiltSteering.syncConfig({
      enabled: tiltSteeringEnabled && steeringMethod === 'tilt',
      sensitivity: steeringSensitivity,
      deadzoneDeg: steeringDeadzone,
      invertAxis: steeringInvertDirection,
    })
  }, [tiltSteeringEnabled, steeringMethod, steeringSensitivity, steeringDeadzone, steeringInvertDirection])

  // Assina o singleton compartilhado (apenas 1 listener global para toda a aplicação)
  // Nota: em iOS, só anexa o listener quando a permissão não foi negada; se já concedida ou em Android, escuta normalmente.
  useEffect(() => {
    if (typeof window === 'undefined' || sensorPermission === 'unsupported' || sensorPermission === 'denied') {
      return
    }
    // Em iOS antes da autorização explícita, aguarda o gesto do usuário em requestPermission()
    if (requiresPermissionPrompt && sensorPermission === 'prompt') {
      return
    }
    return sharedTiltSteering.subscribe(setSnapshot)
  }, [sensorPermission, requiresPermissionPrompt])

  /**
   * Solicita permissão ao usuário (obrigatório em iOS Safari via gesto explícito).
   * Evita chamadas repetidas caso já esteja concedida.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensorPermission('unsupported')
      return false
    }

    if (useSimulationStore.getState().sensorPermission === 'granted') {
      return true
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
        }
        setSensorPermission('denied')
        return false
      } catch (err) {
        console.warn('[HEATZ TILT] Erro ao solicitar permissão de orientação:', err)
        setSensorPermission('denied')
        return false
      }
    }

    setSensorPermission('granted')
    return true
  }, [setSensorPermission])

  const calibrateNeutral = useCallback((): number => {
    return sharedTiltSteering.calibrateNeutral()
  }, [])

  const resetCalibration = useCallback(() => {
    sharedTiltSteering.resetCalibration()
  }, [])

  return {
    isSupported: sensorPermission !== 'unsupported',
    requiresPermissionPrompt,
    permission: sensorPermission,
    rawAngleDeg: snapshot.rawAngleDeg,
    calibratedAngleDeg: snapshot.calibratedAngleDeg,
    neutralAngleDeg: snapshot.neutralAngleDeg,
    isCalibrated: snapshot.isCalibrated,
    hasValidSample: snapshot.hasValidSample,
    requestPermission,
    calibrateNeutral,
    resetCalibration,
    controller: sharedTiltSteering.getController(),
  }
}
