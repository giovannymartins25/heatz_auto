import { useEffect, useRef, useState, useCallback } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import {
  TiltSteeringController,
  type TiltSample,
} from '@/systems/input'

/**
 * useDeviceTilt — Hook gerenciador dos sensores de movimento (DeviceOrientationEvent)
 * para controle de direção por inclinação no HEATZ AUTO.
 *
 * Respeita as políticas de segurança do Safari iOS (permissão explícita por gesto do usuário)
 * e desacopla a amostragem assíncrona dos sensores do ciclo físico determinístico de 120 Hz.
 */
export function useDeviceTilt() {
  const steeringMethod = useSimulationStore((s) => s.steeringMethod)
  const tiltSteeringEnabled = useSimulationStore((s) => s.tiltSteeringEnabled)
  const steeringSensitivity = useSimulationStore((s) => s.steeringSensitivity)
  const steeringDeadzone = useSimulationStore((s) => s.steeringDeadzone)
  const sensorPermission = useSimulationStore((s) => s.sensorPermission)
  const setSteeringAngle = useSimulationStore((s) => s.setSteeringAngle)
  const setSensorPermission = useSimulationStore((s) => s.setSensorPermission)

  const controllerRef = useRef<TiltSteeringController>(new TiltSteeringController())
  const lastTimeRef = useRef<number>(performance.now())
  const lastSampleRef = useRef<TiltSample | null>(null)

  const [rawAngleDeg, setRawAngleDeg] = useState(0)
  const [calibratedAngleDeg, setCalibratedAngleDeg] = useState(0)
  const [isCalibrated, setIsCalibrated] = useState(false)

  // Verifica suporte aos sensores na inicialização
  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensorPermission('unsupported')
      return
    }

    // Se a API requestPermission não existir (ex: Android Chrome / Firefox), assume prompt/granted
    const DeviceOrientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }

    if (typeof DeviceOrientation.requestPermission !== 'function') {
      // Dispositivos modernos Android que suportam sem popup explícito
      if (sensorPermission === 'unsupported') {
        setSensorPermission('prompt')
      }
    }
  }, [sensorPermission, setSensorPermission])

  // Atualiza configurações no controlador interno
  useEffect(() => {
    controllerRef.current.updateConfig({
      enabled: tiltSteeringEnabled && steeringMethod === 'tilt',
      sensitivity: steeringSensitivity,
      deadzoneDeg: steeringDeadzone,
    })
  }, [tiltSteeringEnabled, steeringMethod, steeringSensitivity, steeringDeadzone])

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
      // Navegadores que não exigem requestPermission explícito (Android / Chrome)
      setSensorPermission('granted')
      return true
    }
  }, [setSensorPermission])

  /**
   * Calibra o ponto neutro com base na inclinação atual do smartphone.
   */
  const calibrateNeutral = useCallback((): number => {
    const angle = controllerRef.current.calibrate(lastSampleRef.current ?? undefined)
    setIsCalibrated(true)
    setRawAngleDeg(controllerRef.current.getState().rawAngleDeg)
    setCalibratedAngleDeg(0)
    return angle
  }, [])

  /**
   * Reseta a calibração de ponto neutro para o padrão (0°).
   */
  const resetCalibration = useCallback(() => {
    controllerRef.current.resetCalibration()
    setIsCalibrated(false)
    setCalibratedAngleDeg(controllerRef.current.getState().calibratedAngleDeg)
  }, [])

  // Listener contínuo de DeviceOrientationEvent
  useEffect(() => {
    if (typeof window === 'undefined' || sensorPermission === 'unsupported' || sensorPermission === 'denied') {
      return
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // Ignora leituras se os eixos essenciais forem nulos
      if (e.beta === null && e.gamma === null) return

      let orientationAngle = 0
      if (window.screen?.orientation) {
        orientationAngle = window.screen.orientation.angle || 0
      } else if (typeof window.orientation === 'number') {
        orientationAngle = window.orientation
      }

      const isLandscape =
        window.screen?.orientation?.type
          ? window.screen.orientation.type.startsWith('landscape')
          : window.innerWidth > window.innerHeight

      const sample: TiltSample = {
        beta: e.beta,
        gamma: e.gamma,
        alpha: e.alpha,
        orientationAngle,
        isLandscape,
      }
      lastSampleRef.current = sample

      const now = performance.now()
      const dt = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now

      // Executa cálculo filtrado com proteções contra NaN / Infinity
      const steer = controllerRef.current.computeSteering(sample, dt)

      const state = controllerRef.current.getState()
      setRawAngleDeg(Math.round(state.rawAngleDeg * 10) / 10)
      setCalibratedAngleDeg(Math.round(state.calibratedAngleDeg * 10) / 10)

      // Atualiza a store apenas se o modo tilt estiver ativo
      if (tiltSteeringEnabled && steeringMethod === 'tilt') {
        setSteeringAngle(steer, 'tilt')
      }
    }

    window.addEventListener('deviceorientation', handleOrientation, { passive: true })

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [sensorPermission, tiltSteeringEnabled, steeringMethod, setSteeringAngle])

  return {
    isSupported: sensorPermission !== 'unsupported',
    permission: sensorPermission,
    rawAngleDeg,
    calibratedAngleDeg,
    isCalibrated,
    requestPermission,
    calibrateNeutral,
    resetCalibration,
    controller: controllerRef.current,
  }
}
