import { useSimulationStore } from '@/stores/useSimulationStore'
import { TiltSteeringController, type TiltSample } from './TiltSteeringController'
import {
  loadTiltPreferences,
  saveTiltPreferencesPatch,
} from './tiltPreferences'

export interface SharedTiltSnapshot {
  rawAngleDeg: number
  calibratedAngleDeg: number
  neutralAngleDeg: number
  isCalibrated: boolean
  hasValidSample: boolean
}

type Subscriber = (snapshot: SharedTiltSnapshot) => void

export interface ScreenOrientationEnvironment {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  screenOrientationAngle?: number | null
  windowOrientation?: number | null
  innerWidth?: number
  innerHeight?: number
}

/**
 * Detecta se o ambiente é WebKit no iOS / iPadOS, onde `screen.orientation.angle` apresenta
 * inversão conhecida entre 90° e 270° em paisagem (WebKit Bug #254863), enquanto `window.orientation`
 * preserva a convenção física correta (+90° topo à esquerda, -90°/270° topo à direita).
 */
export function isIOSWebKitEnvironment(env?: ScreenOrientationEnvironment): boolean {
  const ua = env?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  const platform = env?.platform ?? (typeof navigator !== 'undefined' ? navigator.platform : '')
  const maxTouchPoints =
    env?.maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0)

  if (/iPhone|iPad|iPod/i.test(ua)) return true
  if (platform === 'MacIntel' && maxTouchPoints > 1) return true
  return false
}

/**
 * Resolve o ângulo efetivo da orientação da tela normalizado em {0, 90, 180, 270}
 * de forma consistente entre iOS Safari/WebKit e Android Chrome/WebView.
 */
export function resolveEffectiveScreenAngleDeg(env?: ScreenOrientationEnvironment): 0 | 90 | 180 | 270 {
  const winOrient =
    env?.windowOrientation !== undefined
      ? env.windowOrientation
      : typeof window !== 'undefined' &&
          typeof (window as unknown as { orientation?: unknown }).orientation === 'number'
        ? (window as unknown as { orientation: number }).orientation
        : null

  const scrOrient =
    env?.screenOrientationAngle !== undefined
      ? env.screenOrientationAngle
      : typeof window !== 'undefined' && typeof window.screen?.orientation?.angle === 'number'
        ? window.screen.orientation.angle
        : null

  let rawAngle: number | null = null

  if (isIOSWebKitEnvironment(env) && typeof winOrient === 'number' && Number.isFinite(winOrient)) {
    rawAngle = winOrient
  } else if (typeof scrOrient === 'number' && Number.isFinite(scrOrient)) {
    rawAngle = scrOrient
  } else if (typeof winOrient === 'number' && Number.isFinite(winOrient)) {
    rawAngle = winOrient
  } else {
    const w = env?.innerWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 844)
    const h = env?.innerHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 390)
    rawAngle = w > h ? 90 : 0
  }

  const mod = ((Math.round(rawAngle) % 360) + 360) % 360
  if (mod >= 45 && mod < 135) return 90
  if (mod >= 135 && mod < 225) return 180
  if (mod >= 225 && mod < 315) return 270
  return 0
}

/**
 * Verifica se o navegador exige chamada explícita a `DeviceOrientationEvent.requestPermission()`
 * mediante gesto do usuário.
 *
 * IMPORTANTE: versões recentes do Chromium expõem `DeviceOrientationEvent.requestPermission` como função
 * no construtor mesmo em Android/Desktop onde o evento `deviceorientation` já dispara livremente sem prompt.
 * Portanto, restringimos o fluxo de autorização explícita ao ambiente iOS/iPadOS WebKit real.
 */
export function requiresDeviceOrientationPermissionPrompt(env?: ScreenOrientationEnvironment): boolean {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
    return false
  }
  if (!isIOSWebKitEnvironment(env)) {
    return false
  }
  const DeviceOrientation = window.DeviceOrientationEvent as unknown as {
    requestPermission?: unknown
  }
  return typeof DeviceOrientation.requestPermission === 'function'
}

/**
 * SharedTiltSteeringManager — Controlador singleton compartilhado para o sensor
 * de inclinação (DeviceOrientationEvent) em todos os componentes mobile.
 *
 * Garante:
 * - Instância única de TiltSteeringController (sem estados duplicados).
 * - Exatamente UM listener global de `deviceorientation` quando há assinantes.
 * - Suavização contínua independente de FPS/taxa de eventos e progressividade calibrada.
 * - Persistência validada da calibração de centro neutro em localStorage.
 */
class SharedTiltSteeringManager {
  private readonly controller: TiltSteeringController
  private subscribers = new Set<Subscriber>()
  private lastSample: TiltSample | null = null
  private lastTimeMs = 0
  private lastAxisGroup: 'landscape_rot' | 'portrait_nat' | null = null
  private isListenerAttached = false
  private snapshot: SharedTiltSnapshot

  constructor() {
    const prefs = loadTiltPreferences()
    this.controller = new TiltSteeringController({
      smoothingFactor: 0.075,
      responseExponent: 1.18,
      deadzoneDeg: prefs.deadzoneDeg,
      invertAxis: prefs.invertDirection,
    })
    this.controller.restoreCalibration(prefs.neutralAngleDeg, prefs.isCalibrated)
    this.snapshot = {
      rawAngleDeg: 0,
      calibratedAngleDeg: 0,
      neutralAngleDeg: Math.round(this.controller.getNeutralAngleDeg() * 10) / 10,
      isCalibrated: this.controller.isCalibratedState(),
      hasValidSample: false,
    }
  }

  private emit(): void {
    const next = { ...this.snapshot }
    for (const cb of this.subscribers) {
      cb(next)
    }
  }

  private handleOrientation = (e: DeviceOrientationEvent): void => {
    if (e.beta === null && e.gamma === null) return

    const orientationAngle = resolveEffectiveScreenAngleDeg()
    const isLandscape =
      typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : orientationAngle === 90 || orientationAngle === 270

    const sample: TiltSample = {
      beta: e.beta,
      gamma: e.gamma,
      alpha: e.alpha,
      orientationAngle,
      isLandscape,
    }

    if (!this.controller.isSampleUsable(sample)) {
      return
    }

    const simState = useSimulationStore.getState()

    // Em Android/navegadores sem requestPermission, promove 'prompt' -> 'granted' na 1ª leitura real válida
    if (simState.sensorPermission === 'prompt' && !requiresDeviceOrientationPermissionPrompt()) {
      simState.setSensorPermission('granted')
    }

    const axisGroup: 'landscape_rot' | 'portrait_nat' =
      orientationAngle === 90 || orientationAngle === 270 ? 'landscape_rot' : 'portrait_nat'
    if (this.lastAxisGroup !== null && this.lastAxisGroup !== axisGroup) {
      // Ao girar entre retrato e paisagem, limpa o estado transitório do filtro sem duplicar listener
      this.controller.resetTransientFilter()
      this.lastTimeMs = 0
    }
    this.lastAxisGroup = axisGroup
    this.lastSample = sample

    const effectivePermission = useSimulationStore.getState().sensorPermission
    const tiltActive =
      simState.tiltSteeringEnabled &&
      simState.steeringMethod === 'tilt' &&
      effectivePermission !== 'unsupported' &&
      effectivePermission !== 'denied'

    this.controller.updateConfig({
      enabled: tiltActive,
      sensitivity: simState.steeringSensitivity,
      deadzoneDeg: simState.steeringDeadzone,
      invertAxis: simState.steeringInvertDirection,
    })

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const dt = this.lastTimeMs > 0 ? (now - this.lastTimeMs) / 1000 : 1 / 60
    this.lastTimeMs = now

    const steer = this.controller.computeSteering(sample, dt)
    const state = this.controller.getState()

    this.snapshot = {
      rawAngleDeg: Math.round(state.rawAngleDeg * 10) / 10,
      calibratedAngleDeg: Math.round(state.calibratedAngleDeg * 10) / 10,
      neutralAngleDeg: Math.round(state.neutralAngleDeg * 10) / 10,
      isCalibrated: state.isCalibrated,
      hasValidSample: state.hasValidSample,
    }
    this.emit()

    // Atualiza a direção na store somente quando o sensor tilt estiver ativo e a simulação não estiver pausada
    if (tiltActive && !simState.isPaused) {
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

  syncConfig(config: {
    enabled: boolean
    sensitivity: number
    deadzoneDeg: number
    invertAxis?: boolean
  }): void {
    this.controller.updateConfig(config)
  }

  /**
   * Recarrega calibração e preferências persistidas do localStorage (útil em inicialização e testes).
   */
  reloadPersistedPreferences(): void {
    const prefs = loadTiltPreferences()
    this.controller.updateConfig({
      deadzoneDeg: prefs.deadzoneDeg,
      invertAxis: prefs.invertDirection,
    })
    this.controller.restoreCalibration(prefs.neutralAngleDeg, prefs.isCalibrated)
    const state = this.controller.getState()
    this.snapshot = {
      rawAngleDeg: Math.round(state.rawAngleDeg * 10) / 10,
      calibratedAngleDeg: Math.round(state.calibratedAngleDeg * 10) / 10,
      neutralAngleDeg: Math.round(state.neutralAngleDeg * 10) / 10,
      isCalibrated: state.isCalibrated,
      hasValidSample: state.hasValidSample,
    }
    this.emit()
  }

  /**
   * Limpa apenas a velocidade transitória do filtro na troca de veículo,
   * preservando integralmente calibração, listener e preferências do usuário.
   */
  onVehicleSwitch(): void {
    this.controller.resetTransientFilter()
    this.lastTimeMs = 0
  }

  /**
   * Processa uma amostra diretamente (útil em testes unitários e validação determinística).
   */
  processSample(sample: TiltSample, dtSeconds: number = 1 / 60, updateStore: boolean = true): number {
    const simState = useSimulationStore.getState()
    const tiltActive = simState.tiltSteeringEnabled && simState.steeringMethod === 'tilt'
    this.controller.updateConfig({
      enabled: tiltActive,
      sensitivity: simState.steeringSensitivity,
      deadzoneDeg: simState.steeringDeadzone,
      invertAxis: simState.steeringInvertDirection,
    })

    if (this.controller.isSampleUsable(sample)) {
      const effectiveAngle =
        typeof sample.orientationAngle === 'number' && Number.isFinite(sample.orientationAngle)
          ? resolveEffectiveScreenAngleDeg({ screenOrientationAngle: sample.orientationAngle })
          : sample.isLandscape
            ? 90
            : 0
      const axisGroup: 'landscape_rot' | 'portrait_nat' =
        effectiveAngle === 90 || effectiveAngle === 270 ? 'landscape_rot' : 'portrait_nat'
      if (this.lastAxisGroup !== null && this.lastAxisGroup !== axisGroup) {
        this.controller.resetTransientFilter()
      }
      this.lastAxisGroup = axisGroup
      this.lastSample = sample
    }

    const steer = this.controller.computeSteering(sample, dtSeconds)
    const state = this.controller.getState()
    this.snapshot = {
      rawAngleDeg: Math.round(state.rawAngleDeg * 10) / 10,
      calibratedAngleDeg: Math.round(state.calibratedAngleDeg * 10) / 10,
      neutralAngleDeg: Math.round(state.neutralAngleDeg * 10) / 10,
      isCalibrated: state.isCalibrated,
      hasValidSample: state.hasValidSample,
    }
    this.emit()

    if (updateStore && tiltActive && !simState.isPaused) {
      simState.setSteeringAngle(steer, 'tilt')
    }
    return steer
  }

  /**
   * Calibra a posição atual do smartphone como centro neutro (0° relativo).
   * Retorna o ângulo neutro gravado; caso nenhuma amostra válida exista ainda, preserva o estado seguro.
   */
  calibrateNeutral(sample?: TiltSample): number {
    const candidate = sample ?? this.lastSample ?? undefined
    const canUseCandidate = candidate !== undefined ? this.controller.isSampleUsable(candidate) : this.controller.hasValidSensorSample()

    if (!canUseCandidate) {
      return this.controller.getNeutralAngleDeg()
    }

    const angle = this.controller.calibrate(candidate)
    const state = this.controller.getState()

    if (state.isCalibrated) {
      saveTiltPreferencesPatch({
        neutralAngleDeg: state.neutralAngleDeg,
        isCalibrated: true,
      })
    }

    this.snapshot = {
      rawAngleDeg: Math.round(state.rawAngleDeg * 10) / 10,
      calibratedAngleDeg: Math.round(state.calibratedAngleDeg * 10) / 10,
      neutralAngleDeg: Math.round(state.neutralAngleDeg * 10) / 10,
      isCalibrated: state.isCalibrated,
      hasValidSample: state.hasValidSample,
    }
    this.emit()

    const simState = useSimulationStore.getState()
    if (simState.tiltSteeringEnabled && simState.steeringMethod === 'tilt' && !simState.isPaused) {
      simState.setSteeringAngle(0, 'tilt')
    }

    return angle
  }

  resetCalibration(): void {
    this.controller.resetCalibration()
    saveTiltPreferencesPatch({
      neutralAngleDeg: 0,
      isCalibrated: false,
    })
    const state = this.controller.getState()
    this.snapshot = {
      rawAngleDeg: Math.round(state.rawAngleDeg * 10) / 10,
      calibratedAngleDeg: Math.round(state.calibratedAngleDeg * 10) / 10,
      neutralAngleDeg: 0,
      isCalibrated: false,
      hasValidSample: state.hasValidSample,
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
