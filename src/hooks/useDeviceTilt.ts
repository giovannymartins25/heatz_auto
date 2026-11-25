import { useEffect, useState, useCallback } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import {
  sharedTiltSteering,
  isSensorSecureContext,
  requiresDeviceOrientationPermissionPrompt,
  type SharedTiltSnapshot,
} from '@/systems/input'

/**
 * useDeviceTilt — Hook gerenciador dos sensores de movimento (DeviceOrientationEvent / DeviceMotionEvent)
 * para controle de direção por inclinação no HEATZ AUTO.
 *
 * Delega para o singleton `sharedTiltSteering` para garantir uma única instância de
 * TiltSteeringController, listener global com fallback automático para acelerômetro 3D e
 * diagnóstico completo entre diferentes smartphones.
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

  // Verifica suporte real às APIs (DeviceOrientation OU DeviceMotion) e contexto seguro HTTPS/localhost
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasOrientation = 'DeviceOrientationEvent' in window
    const hasMotion = 'DeviceMotionEvent' in window

    if ((!hasOrientation && !hasMotion) || !isSensorSecureContext()) {
      setSensorPermission('unsupported')
      setSnapshot(sharedTiltSteering.getSnapshot())
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

  // Assina o singleton compartilhado
  useEffect(() => {
    if (typeof window === 'undefined' || sensorPermission === 'unsupported' || sensorPermission === 'denied') {
      setSnapshot(sharedTiltSteering.getSnapshot())
      return
    }
    if (requiresPermissionPrompt && sensorPermission === 'prompt') {
      setSnapshot(sharedTiltSteering.getSnapshot())
      return
    }
    return sharedTiltSteering.subscribe(setSnapshot)
  }, [sensorPermission, requiresPermissionPrompt])

  /**
   * Solicita permissão explícita ao usuário quando exigida pelo navegador (iOS Safari/WebKit),
   * requisitando tanto DeviceOrientationEvent quanto DeviceMotionEvent (fallback de acelerômetro).
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false
    const hasOrientation = 'DeviceOrientationEvent' in window
    const hasMotion = 'DeviceMotionEvent' in window
    if ((!hasOrientation && !hasMotion) || !isSensorSecureContext()) {
      setSensorPermission('unsupported')
      setSnapshot(sharedTiltSteering.getSnapshot())
      return false
    }

    if (useSimulationStore.getState().sensorPermission === 'granted') {
      return true
    }

    const DeviceOrientation = (window as unknown as {
      DeviceOrientationEvent?: { requestPermission?: () => Promise<'granted' | 'denied'> }
    }).DeviceOrientationEvent
    const DeviceMotion = (window as unknown as {
      DeviceMotionEvent?: { requestPermission?: () => Promise<'granted' | 'denied'> }
    }).DeviceMotionEvent

    let grantedAny = false
    let askedAny = false

    if (typeof DeviceOrientation?.requestPermission === 'function') {
      askedAny = true
      try {
        const res = await DeviceOrientation.requestPermission()
        if (res === 'granted') grantedAny = true
      } catch (err) {
        console.warn('[HEATZ TILT] Erro ao solicitar DeviceOrientationEvent.requestPermission:', err)
      }
    }

    if (typeof DeviceMotion?.requestPermission === 'function') {
      askedAny = true
      try {
        const res = await DeviceMotion.requestPermission()
        if (res === 'granted') grantedAny = true
      } catch (err) {
        console.warn('[HEATZ TILT] Erro ao solicitar DeviceMotionEvent.requestPermission:', err)
      }
    }

    if (askedAny) {
      setSensorPermission(grantedAny ? 'granted' : 'denied')
      setSnapshot(sharedTiltSteering.getSnapshot())
      return grantedAny
    }

    setSensorPermission('granted')
    setSnapshot(sharedTiltSteering.getSnapshot())
    return true
  }, [setSensorPermission])

  const calibrateNeutral = useCallback((): number => {
    return sharedTiltSteering.calibrateNeutral()
  }, [])

  const resetCalibration = useCallback(() => {
    sharedTiltSteering.resetCalibration()
  }, [])

  return {
    isSupported:
      sensorPermission !== 'unsupported' &&
      snapshot.diagnostics.status !== 'unsupported_browser' &&
      snapshot.diagnostics.status !== 'insecure_context',
    requiresPermissionPrompt,
    permission: sensorPermission,
    rawAngleDeg: snapshot.rawAngleDeg,
    calibratedAngleDeg: snapshot.calibratedAngleDeg,
    neutralAngleDeg: snapshot.neutralAngleDeg,
    isCalibrated: snapshot.isCalibrated,
    hasValidSample: snapshot.hasValidSample,
    diagnostics: snapshot.diagnostics,
    requestPermission,
    calibrateNeutral,
    resetCalibration,
    controller: sharedTiltSteering.getController(),
  }
}
