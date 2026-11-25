import { useSimulationStore } from '@/stores/useSimulationStore'
import {
  TiltSteeringController,
  type SensorPermissionState,
  type TiltSample,
} from './TiltSteeringController'
import {
  loadTiltPreferences,
  saveTiltPreferencesPatch,
} from './tiltPreferences'

export type TiltSensorSource =
  | 'none'
  | 'deviceorientation'
  | 'deviceorientationabsolute'
  | 'devicemotion_gravity'

export type TiltSensorDiagnosticStatus =
  | 'active'
  | 'waiting_permission'
  | 'permission_denied'
  | 'insecure_context'
  | 'unsupported_browser'
  | 'waiting_events'
  | 'null_sensor_events'

export interface TiltSensorDiagnostics {
  status: TiltSensorDiagnosticStatus
  statusLabel: string
  blockReason: string | null
  secureContext: boolean
  hasOrientationApi: boolean
  hasMotionApi: boolean
  requiresPermissionPrompt: boolean
  permissionState: SensorPermissionState
  activeSource: TiltSensorSource
  receivingValidEvents: boolean
  validEventCount: number
  nullOrInvalidEventCount: number
  screenAngleDeg: 0 | 90 | 180 | 270
  rawBetaDeg: number | null
  rawGammaDeg: number | null
  rawGravityX: number | null
  rawGravityY: number | null
  rawGravityZ: number | null
}

export interface SharedTiltSnapshot {
  rawAngleDeg: number
  calibratedAngleDeg: number
  neutralAngleDeg: number
  isCalibrated: boolean
  hasValidSample: boolean
  diagnostics: TiltSensorDiagnostics
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
 * mediante gesto do usuário (exclusivo iOS/iPadOS WebKit).
 */
export function requiresDeviceOrientationPermissionPrompt(env?: ScreenOrientationEnvironment): boolean {
  if (typeof window === 'undefined') return false
  if (!isIOSWebKitEnvironment(env)) return false

  const DeviceOrientation = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: unknown } })
    .DeviceOrientationEvent
  const DeviceMotion = (window as unknown as { DeviceMotionEvent?: { requestPermission?: unknown } })
    .DeviceMotionEvent

  return (
    typeof DeviceOrientation?.requestPermission === 'function' ||
    typeof DeviceMotion?.requestPermission === 'function'
  )
}

/**
 * Verifica se o navegador atual está em contexto seguro (HTTPS ou localhost).
 * Navegadores baseados em Chromium bloqueiam `DeviceOrientationEvent` e `DeviceMotionEvent`
 * silenciosamente quando abertos por IP HTTP inseguro na rede local (ex.: http://192.168.x.x).
 */
export function isSensorSecureContext(): boolean {
  if (typeof window === 'undefined') return true
  if (typeof window.isSecureContext === 'boolean') {
    return window.isSecureContext
  }
  const host = window.location?.hostname ?? ''
  const proto = window.location?.protocol ?? 'https:'
  return proto === 'https:' || host === 'localhost' || host === '127.0.0.1' || host === ''
}

const FALLBACK_DELAY_MS = 450

/**
 * SharedTiltSteeringManager — Controlador singleton compartilhado para os sensores de inclinação
 * com cadeia automática de fallback para smartphones sem giroscópio:
 *   1. `deviceorientation` (fusão giroscópio + acelerômetro — menor ruído)
 *   2. `deviceorientationabsolute` (fusão acelerômetro + magnetômetro)
 *   3. `devicemotion` (`accelerationIncludingGravity` — acelerômetro puro 3D presente em aparelhos de entrada)
 */
class SharedTiltSteeringManager {
  private readonly controller: TiltSteeringController
  private subscribers = new Set<Subscriber>()
  private lastSample: TiltSample | null = null
  private lastTimeMs = 0
  private lastAxisGroup: 'landscape_rot' | 'portrait_nat' | null = null
  private isListenerAttached = false
  private isFallbackAttached = false
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null

  private activeSource: TiltSensorSource = 'none'
  private validEventCount = 0
  private nullOrInvalidEventCount = 0
  private rawBetaDeg: number | null = null
  private rawGammaDeg: number | null = null
  private rawGravityX: number | null = null
  private rawGravityY: number | null = null
  private rawGravityZ: number | null = null

  // Filtro adicional de vibração linear exclusivo para o fallback de acelerômetro puro (sem giroscópio)
  private smoothedGravity: { x: number; y: number; z: number } | null = null

  private snapshot: SharedTiltSnapshot

  constructor() {
    const prefs = loadTiltPreferences()
    this.controller = new TiltSteeringController({
      smoothingFactor: 0.085,
      responseExponent: 1.65,
      deadzoneDeg: prefs.deadzoneDeg,
      invertAxis: prefs.invertDirection,
      autoCenteringRate: 14.0,
    })
    this.controller.restoreCalibration(prefs.neutralAngleDeg, prefs.isCalibrated)
    this.snapshot = {
      rawAngleDeg: 0,
      calibratedAngleDeg: 0,
      neutralAngleDeg: Math.round(this.controller.getNeutralAngleDeg() * 10) / 10,
      isCalibrated: this.controller.isCalibratedState(),
      hasValidSample: false,
      diagnostics: this.buildDiagnostics('prompt'),
    }
  }

  private buildDiagnostics(permissionOverride?: SensorPermissionState): TiltSensorDiagnostics {
    const hasWindow = typeof window !== 'undefined'
    const hasOrientationApi = hasWindow && 'DeviceOrientationEvent' in window
    const hasMotionApi = hasWindow && 'DeviceMotionEvent' in window
    const secureContext = isSensorSecureContext()
    const requiresPrompt = requiresDeviceOrientationPermissionPrompt()
    const permissionState: SensorPermissionState =
      permissionOverride ??
      (hasWindow ? useSimulationStore.getState().sensorPermission : 'prompt')
    const screenAngleDeg = hasWindow ? resolveEffectiveScreenAngleDeg() : 90
    const receivingValidEvents = this.controller.hasValidSensorSample()

    let status: TiltSensorDiagnosticStatus = 'waiting_events'
    let statusLabel = 'AGUARDANDO DADOS DO SENSOR'
    let blockReason: string | null = null

    if (!secureContext) {
      status = 'insecure_context'
      statusLabel = 'BLOQUEADO (HTTP INSEGURO)'
      blockReason =
        'Acesso via HTTP sem HTTPS bloqueia os sensores no navegador móvel. Abra via HTTPS ou localhost.'
    } else if (hasWindow && !hasOrientationApi && !hasMotionApi) {
      status = 'unsupported_browser'
      statusLabel = 'NAVEGADOR SEM SUPORTE'
      blockReason = 'Este navegador não expõe DeviceOrientationEvent nem DeviceMotionEvent.'
    } else if (permissionState === 'denied') {
      status = 'permission_denied'
      statusLabel = 'PERMISSÃO NEGADA'
      blockReason =
        'Permissão de sensores negada. Habilite "Sensores de movimento" nas configurações do navegador.'
    } else if (requiresPrompt && permissionState === 'prompt' && !receivingValidEvents) {
      status = 'waiting_permission'
      statusLabel = 'AGUARDANDO AUTORIZAÇÃO'
      blockReason = 'Toque em Autorizar Sensor para liberar o giroscópio/acelerômetro no iOS.'
    } else if (receivingValidEvents) {
      status = 'active'
      statusLabel =
        this.activeSource === 'devicemotion_gravity'
          ? 'ATIVO (ACELERÔMETRO 3D)'
          : this.activeSource === 'deviceorientationabsolute'
            ? 'ATIVO (ORIENTAÇÃO ABSOLUTA)'
            : 'ATIVO (GIROSCÓPIO/ORIENTAÇÃO)'
      blockReason = null
    } else if (this.nullOrInvalidEventCount > 0) {
      status = 'null_sensor_events'
      statusLabel = 'SENSOR SEM LEITURA VÁLIDA'
      blockReason =
        'O navegador disparou eventos vazios (sem giroscópio fundido). Tentando fallback pelo acelerômetro; verifique também se "Sensores de movimento" está ativo no Chrome.'
    } else {
      status = 'waiting_events'
      statusLabel = 'AGUARDANDO LEITURA FÍSICA'
      blockReason =
        'Nenhuma leitura recebida ainda. Mova levemente o aparelho ou verifique se "Sensores de movimento" está permitido nas configurações do site no navegador.'
    }

    return {
      status,
      statusLabel,
      blockReason,
      secureContext,
      hasOrientationApi,
      hasMotionApi,
      requiresPermissionPrompt: requiresPrompt,
      permissionState,
      activeSource: this.activeSource,
      receivingValidEvents,
      validEventCount: this.validEventCount,
      nullOrInvalidEventCount: this.nullOrInvalidEventCount,
      screenAngleDeg,
      rawBetaDeg: this.rawBetaDeg,
      rawGammaDeg: this.rawGammaDeg,
      rawGravityX: this.rawGravityX,
      rawGravityY: this.rawGravityY,
      rawGravityZ: this.rawGravityZ,
    }
  }

  private refreshSnapshotAndEmit(): void {
    const state = this.controller.getState()
    this.snapshot = {
      rawAngleDeg: Math.round(state.rawAngleDeg * 10) / 10,
      calibratedAngleDeg: Math.round(state.calibratedAngleDeg * 10) / 10,
      neutralAngleDeg: Math.round(state.neutralAngleDeg * 10) / 10,
      isCalibrated: state.isCalibrated,
      hasValidSample: state.hasValidSample,
      diagnostics: this.buildDiagnostics(),
    }
    const next = { ...this.snapshot, diagnostics: { ...this.snapshot.diagnostics } }
    for (const cb of this.subscribers) {
      cb(next)
    }
  }

  private applyAxisSpecificCalibration(axisGroup: 'landscape_rot' | 'portrait_nat'): void {
    if (this.lastAxisGroup === null) {
      this.lastAxisGroup = axisGroup
      return
    }
    if (this.lastAxisGroup === axisGroup) {
      return
    }
    this.lastAxisGroup = axisGroup
    this.controller.resetTransientFilter()
    this.lastTimeMs = 0

    // Ao alternar entre Retrato e Paisagem, restaura a calibração própria daquela orientação
    // para evitar que um offset gravado em retrato puxe a direção para o lado em paisagem (e vice-versa)
    const prefs = loadTiltPreferences()
    if (axisGroup === 'landscape_rot') {
      this.controller.restoreCalibration(
        prefs.neutralLandscapeDeg ?? 0,
        Boolean(prefs.isCalibratedLandscape),
      )
    } else {
      this.controller.restoreCalibration(
        prefs.neutralPortraitDeg ?? 0,
        Boolean(prefs.isCalibratedPortrait),
      )
    }
  }

  private ingestValidSample(sample: TiltSample, source: TiltSensorSource): void {
    const simState = useSimulationStore.getState()

    if (simState.sensorPermission === 'prompt' && !requiresDeviceOrientationPermissionPrompt()) {
      simState.setSensorPermission('granted')
    }

    const orientationAngle =
      typeof sample.orientationAngle === 'number' && Number.isFinite(sample.orientationAngle)
        ? resolveEffectiveScreenAngleDeg({ screenOrientationAngle: sample.orientationAngle })
        : sample.isLandscape
          ? 90
          : 0

    const axisGroup: 'landscape_rot' | 'portrait_nat' =
      orientationAngle === 90 || orientationAngle === 270 ? 'landscape_rot' : 'portrait_nat'
    this.applyAxisSpecificCalibration(axisGroup)

    this.lastSample = sample
    this.activeSource = source
    this.validEventCount++

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
    this.refreshSnapshotAndEmit()

    if (tiltActive && !simState.isPaused) {
      simState.setSteeringAngle(steer, 'tilt')
    }
  }

  private handleOrientation = (e: DeviceOrientationEvent): void => {
    if (e.beta === null && e.gamma === null) {
      this.nullOrInvalidEventCount++
      // Em smartphones sem giroscópio, Chrome dispara deviceorientation com beta/gamma nulos:
      // aciona imediatamente os listeners de fallback (deviceorientationabsolute + devicemotion)!
      this.attachFallbackListeners()
      if (this.nullOrInvalidEventCount <= 3) {
        this.refreshSnapshotAndEmit()
      }
      return
    }

    this.rawBetaDeg = typeof e.beta === 'number' && Number.isFinite(e.beta) ? Math.round(e.beta * 10) / 10 : null
    this.rawGammaDeg = typeof e.gamma === 'number' && Number.isFinite(e.gamma) ? Math.round(e.gamma * 10) / 10 : null

    const orientationAngle = resolveEffectiveScreenAngleDeg()
    const isLandscape =
      typeof window !== 'undefined'
        ? window.innerWidth > window.innerHeight
        : orientationAngle === 90 || orientationAngle === 270

    const sample: TiltSample = {
      beta: e.beta,
      gamma: e.gamma,
      alpha: e.alpha,
      orientationAngle,
      isLandscape,
    }

    if (!this.controller.isSampleUsable(sample)) {
      this.nullOrInvalidEventCount++
      this.attachFallbackListeners()
      return
    }

    // Se o evento primário `deviceorientation` funciona normalmente, desativa os fallbacks para zero custo extra
    if (this.isFallbackAttached) {
      this.detachFallbackListeners()
    }

    this.ingestValidSample(sample, 'deviceorientation')
  }

  private handleOrientationAbsolute = (e: Event): void => {
    if (this.activeSource === 'deviceorientation') return
    const oe = e as DeviceOrientationEvent
    if (oe.beta === null && oe.gamma === null) {
      this.nullOrInvalidEventCount++
      return
    }

    this.rawBetaDeg = typeof oe.beta === 'number' && Number.isFinite(oe.beta) ? Math.round(oe.beta * 10) / 10 : null
    this.rawGammaDeg = typeof oe.gamma === 'number' && Number.isFinite(oe.gamma) ? Math.round(oe.gamma * 10) / 10 : null

    const orientationAngle = resolveEffectiveScreenAngleDeg()
    const isLandscape =
      typeof window !== 'undefined'
        ? window.innerWidth > window.innerHeight
        : orientationAngle === 90 || orientationAngle === 270

    const sample: TiltSample = {
      beta: oe.beta,
      gamma: oe.gamma,
      alpha: oe.alpha,
      orientationAngle,
      isLandscape,
    }

    if (!this.controller.isSampleUsable(sample)) return
    this.ingestValidSample(sample, 'deviceorientationabsolute')
  }

  private handleDeviceMotion = (e: Event): void => {
    // Só utiliza acelerômetro bruto se nem deviceorientation nem deviceorientationabsolute entregaram dados
    if (this.activeSource === 'deviceorientation' || this.activeSource === 'deviceorientationabsolute') {
      return
    }

    const me = e as DeviceMotionEvent
    const acc = me.accelerationIncludingGravity
    if (!acc || acc.x === null || acc.y === null) {
      this.nullOrInvalidEventCount++
      return
    }

    const ax = acc.x
    const ay = acc.y
    const az = acc.z ?? 0
    if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(az)) {
      this.nullOrInvalidEventCount++
      return
    }

    // Filtro passa-baixa nos 3 eixos de gravidade para rejeitar vibração linear das mãos em aparelhos sem giroscópio
    if (!this.smoothedGravity) {
      this.smoothedGravity = { x: ax, y: ay, z: az }
    } else {
      const gAlpha = 0.28
      this.smoothedGravity.x += (ax - this.smoothedGravity.x) * gAlpha
      this.smoothedGravity.y += (ay - this.smoothedGravity.y) * gAlpha
      this.smoothedGravity.z += (az - this.smoothedGravity.z) * gAlpha
    }

    this.rawGravityX = Math.round(this.smoothedGravity.x * 100) / 100
    this.rawGravityY = Math.round(this.smoothedGravity.y * 100) / 100
    this.rawGravityZ = Math.round(this.smoothedGravity.z * 100) / 100

    const orientationAngle = resolveEffectiveScreenAngleDeg()
    const isLandscape =
      typeof window !== 'undefined'
        ? window.innerWidth > window.innerHeight
        : orientationAngle === 90 || orientationAngle === 270

    const sample: TiltSample = {
      accelIncludingGravityX: this.smoothedGravity.x,
      accelIncludingGravityY: this.smoothedGravity.y,
      accelIncludingGravityZ: this.smoothedGravity.z,
      invertGravitySign: isIOSWebKitEnvironment(),
      orientationAngle,
      isLandscape,
    }

    if (!this.controller.isSampleUsable(sample)) return
    this.ingestValidSample(sample, 'devicemotion_gravity')
  }

  private attachFallbackListeners(): void {
    if (this.isFallbackAttached || typeof window === 'undefined') return
    if (this.activeSource === 'deviceorientation') return

    window.addEventListener('deviceorientationabsolute', this.handleOrientationAbsolute, { passive: true })
    if ('DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', this.handleDeviceMotion, { passive: true })
    }
    this.isFallbackAttached = true
  }

  private detachFallbackListeners(): void {
    if (this.fallbackTimer !== null) {
      clearTimeout(this.fallbackTimer)
      this.fallbackTimer = null
    }
    if (!this.isFallbackAttached || typeof window === 'undefined') return
    window.removeEventListener('deviceorientationabsolute', this.handleOrientationAbsolute)
    window.removeEventListener('devicemotion', this.handleDeviceMotion)
    this.isFallbackAttached = false
  }

  private attachListener(): void {
    if (this.isListenerAttached || typeof window === 'undefined') return
    const hasOrientation = 'DeviceOrientationEvent' in window
    const hasMotion = 'DeviceMotionEvent' in window
    if (!hasOrientation && !hasMotion) return

    if (hasOrientation) {
      window.addEventListener('deviceorientation', this.handleOrientation, { passive: true })
      // Se após 450 ms `deviceorientation` não emitir nenhuma leitura válida (aparelho sem giroscópio),
      // habilita automaticamente o fallback para `deviceorientationabsolute` e `devicemotion`!
      this.fallbackTimer = setTimeout(() => {
        this.fallbackTimer = null
        if (this.isListenerAttached && !this.controller.hasValidSensorSample()) {
          this.attachFallbackListeners()
          this.refreshSnapshotAndEmit()
        }
      }, FALLBACK_DELAY_MS)
    } else if (hasMotion) {
      this.attachFallbackListeners()
    }

    this.isListenerAttached = true
  }

  private detachListener(): void {
    if (!this.isListenerAttached || typeof window === 'undefined') return
    window.removeEventListener('deviceorientation', this.handleOrientation)
    this.detachFallbackListeners()
    this.isListenerAttached = false
    this.lastTimeMs = 0
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback)
    if (this.subscribers.size === 1) {
      this.attachListener()
    }
    this.snapshot = {
      ...this.snapshot,
      diagnostics: this.buildDiagnostics(),
    }
    callback({ ...this.snapshot, diagnostics: { ...this.snapshot.diagnostics } })

    return () => {
      this.subscribers.delete(callback)
      if (this.subscribers.size === 0) {
        this.detachListener()
      }
    }
  }

  /**
   * Avança suavemente a convergência do volante no loop de quadros mesmo quando o Android
   * reduz eventos do sensor com o smartphone mantido imóvel no centro.
   */
  tickFrame(dtSeconds: number): void {
    if (!this.isListenerAttached || !this.controller.hasValidSensorSample()) return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    // Só atua quando nenhum evento novo do sensor chegou nos últimos 28 ms
    if (this.lastTimeMs > 0 && now - this.lastTimeMs < 28) return

    const simState = useSimulationStore.getState()
    const tiltActive =
      simState.tiltSteeringEnabled &&
      simState.steeringMethod === 'tilt' &&
      simState.sensorPermission !== 'unsupported' &&
      simState.sensorPermission !== 'denied'
    if (!tiltActive || simState.isPaused) return

    const prevSteer = simState.steeringAngle
    const nextSteer = this.controller.stepFilterTowardLastTarget(dtSeconds)
    if (Math.abs(nextSteer - prevSteer) > 1e-4 || (nextSteer === 0 && prevSteer !== 0)) {
      simState.setSteeringAngle(nextSteer, 'tilt')
    }
  }

  getController(): TiltSteeringController {
    return this.controller
  }

  getSnapshot(): SharedTiltSnapshot {
    return {
      ...this.snapshot,
      diagnostics: this.buildDiagnostics(),
    }
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
    this.refreshSnapshotAndEmit()
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
      this.validEventCount++
      if (this.activeSource === 'none') {
        this.activeSource =
          sample.accelIncludingGravityX !== undefined && sample.accelIncludingGravityX !== null
            ? 'devicemotion_gravity'
            : 'deviceorientation'
      }
    }

    const steer = this.controller.computeSteering(sample, dtSeconds)
    this.refreshSnapshotAndEmit()

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
    const canUseCandidate =
      candidate !== undefined ? this.controller.isSampleUsable(candidate) : this.controller.hasValidSensorSample()

    if (!canUseCandidate) {
      this.refreshSnapshotAndEmit()
      return this.controller.getNeutralAngleDeg()
    }

    const angle = this.controller.calibrate(candidate)
    const state = this.controller.getState()

    if (state.isCalibrated) {
      const refSample = candidate ?? this.lastSample
      const effAngle =
        refSample && typeof refSample.orientationAngle === 'number'
          ? resolveEffectiveScreenAngleDeg({ screenOrientationAngle: refSample.orientationAngle })
          : refSample?.isLandscape
            ? 90
            : resolveEffectiveScreenAngleDeg()
      const isLandscapeAxis = effAngle === 90 || effAngle === 270

      saveTiltPreferencesPatch({
        neutralAngleDeg: state.neutralAngleDeg,
        isCalibrated: true,
        ...(isLandscapeAxis
          ? { neutralLandscapeDeg: state.neutralAngleDeg, isCalibratedLandscape: true }
          : { neutralPortraitDeg: state.neutralAngleDeg, isCalibratedPortrait: true }),
      })
    }

    this.refreshSnapshotAndEmit()

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
      neutralLandscapeDeg: 0,
      isCalibratedLandscape: false,
      neutralPortraitDeg: 0,
      isCalibratedPortrait: false,
    })
    this.refreshSnapshotAndEmit()
    const simState = useSimulationStore.getState()
    if (simState.tiltSteeringEnabled && simState.steeringMethod === 'tilt' && !simState.isPaused) {
      simState.setSteeringAngle(0, 'tilt')
    }
  }

  getSubscriberCount(): number {
    return this.subscribers.size
  }

  isAttached(): boolean {
    return this.isListenerAttached
  }
}

export const sharedTiltSteering = new SharedTiltSteeringManager()
