import { useSimulationStore } from '@/stores/useSimulationStore'
import { TiltSteeringController, type TiltSample } from './TiltSteeringController'

export interface SharedTiltSnapshot {
  rawAngleDeg: number
  calibratedAngleDeg: number
  isCalibrated: boolean
}

type Subscriber = (snapshot: SharedTiltSnapshot) => void

/**
 * SharedTiltSteeringManager — Controlador singleton compartilhado para o sensor
 * de inclinação (DeviceOrientationEvent) em todos os componentes mobile.
 *
 * Elimina a duplicação de instâncias independentes de TiltSteeringController e
 * garante que apenas UM listener de `deviceorientation` esteja registrado e que
 * a calibração do ponto neutro afete imediatamente todos os consumidores.
 */
class SharedTiltSteeringManager {
  private readonly controller = new TiltSteeringController()
  private subscribers = new Set<Subscriber>()
  private lastSample: TiltSample | null = null
  private lastTimeMs = 0
  private isListenerAttached = false
  private snapshot: SharedTiltSnapshot = {
    rawAngleDeg: 0,
    calibratedAngleDeg: 0,
    isCalibrated: false,
  }

  private emit(): void {
    const next = { ...this.snapshot }
    for (const cb of this.subscribers) {
      cb(next)
    }
  }

  private handleOrientation = (e: DeviceOrientationEvent): void => {
    if (e.beta === null && e.gamma === null) return

    const simState = useSimulationStore.getState()
    const tiltActive =
      simState.tiltSteeringEnabled &&
      simState.steeringMethod === 'tilt' &&
      simState.sensorPermission !== 'unsupported' &&
      simState.sensorPermission !== 'denied'

    this.controller.updateConfig({
      enabled: tiltActive,
      sensitivity: simState.steeringSensitivity,
      deadzoneDeg: simState.steeringDeadzone,
    })

    let orientationAngle = 0
    if (typeof window !== 'undefined') {
      if (window.screen?.orientation) {
        orientationAngle = window.screen.orientation.angle || 0
      } else if (typeof (window as unknown as { orientation?: number }).orientation === 'number') {
        orientationAngle = (window as unknown as { orientation: number }).orientation
      }
    }

    const isLandscape =
      typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : true

    const sample: TiltSample = {
      beta: e.beta,
      gamma: e.gamma,
      alpha: e.alpha,
      orientationAngle,
      isLandscape,
    }
    this.lastSample = sample

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const dt = this.lastTimeMs > 0 ? (now - this.lastTimeMs) / 1000 : 1 / 60
    this.lastTimeMs = now

    const steer = this.controller.computeSteering(sample, dt)
    const state = this.controller.getState()

    this.snapshot = {
      rawAngleDeg: Math.round(state.rawAngleDeg * 10) / 10,
      calibratedAngleDeg: Math.round(state.calibratedAngleDeg * 10) / 10,
      isCalibrated: this.snapshot.isCalibrated,
    }
    this.emit()

    // Atualiza a direção na store somente quando o sensor tilt estiver explicitamente ativo
    if (tiltActive) {
      simState.setSteeringAngle(steer, 'tilt')
    }
  }

  private attachListener(): void {
    if (this.isListenerAttached || typeof window === 'undefined') return
    if (!('DeviceOrientationEvent' in window)) return
    window.addEventListener('deviceorientation', this.handleOrientation, { passive: true })
    this.isListenerAttached = true
  }

  private detachListener(): void {
    if (!this.isListenerAttached || typeof window === 'undefined') return
    window.removeEventListener('deviceorientation', this.handleOrientation)
    this.isListenerAttached = false
    this.lastTimeMs = 0
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback)
    if (this.subscribers.size === 1) {
      this.attachListener()
    }
    callback({ ...this.snapshot })

    return () => {
      this.subscribers.delete(callback)
      if (this.subscribers.size === 0) {
        this.detachListener()
      }
    }
  }

  getController(): TiltSteeringController {
    return this.controller
  }

  getSnapshot(): SharedTiltSnapshot {
    return { ...this.snapshot }
  }

  syncConfig(config: { enabled: boolean; sensitivity: number; deadzoneDeg: number }): void {
    this.controller.updateConfig(config)
  }

  /**
   * Processa uma amostra diretamente (útil em testes unitários e validação determinística).
   */
  processSample(sample: TiltSample, dtSeconds: number = 1 / 60, updateStore: boolean = true): number {
    this.lastSample = sample
    const simState = useSimulationStore.getState()
    const tiltActive = simState.tiltSteeringEnabled && simState.steeringMethod === 'tilt'
    this.controller.updateConfig({
      enabled: tiltActive,
      sensitivity: simState.steeringSensitivity,
      deadzoneDeg: simState.steeringDeadzone,
    })

    const steer = this.controller.computeSteering(sample, dtSeconds)
    const state = this.controller.getState()
    this.snapshot = {
      rawAngleDeg: Math.round(state.rawAngleDeg * 10) / 10,
      calibratedAngleDeg: Math.round(state.calibratedAngleDeg * 10) / 10,
      isCalibrated: this.snapshot.isCalibrated,
    }
    this.emit()

    if (updateStore && tiltActive) {
      simState.setSteeringAngle(steer, 'tilt')
    }
    return steer
  }

  calibrateNeutral(sample?: TiltSample): number {
    const targetSample = sample ?? this.lastSample ?? undefined
    const angle = this.controller.calibrate(targetSample)
    const state = this.controller.getState()
    this.snapshot = {
      rawAngleDeg: Math.round(state.rawAngleDeg * 10) / 10,
      calibratedAngleDeg: 0,
      isCalibrated: true,
    }
    this.emit()
    return angle
  }

  resetCalibration(): void {
    this.controller.resetCalibration()
    const state = this.controller.getState()
    this.snapshot = {
      rawAngleDeg: Math.round(state.rawAngleDeg * 10) / 10,
      calibratedAngleDeg: Math.round(state.calibratedAngleDeg * 10) / 10,
      isCalibrated: false,
    }
    this.emit()
  }

  getSubscriberCount(): number {
    return this.subscribers.size
  }

  isAttached(): boolean {
    return this.isListenerAttached
  }
}

export const sharedTiltSteering = new SharedTiltSteeringManager()
