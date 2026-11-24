/**
 * HEATZ AUTO — CONTROLE DE DIREÇÃO POR SENSORES DE INCLINAÇÃO (TILT STEERING)
 *
 * Controlador determinístico de esterçamento baseado em giroscópio e acelerômetro (DeviceOrientation).
 *
 * Características (revisadas na Fase 4.4.1):
 * - Normalização física consistente para Paisagem (90° / 270° / 0° tablet) e Retrato (0° / 180°)
 *   com compensação de quadrante gravitacional (|beta| > 90°) sem inversão súbita de sinal.
 * - Desacoplamento de bússola/magnetômetro (não depende de alpha instável).
 * - Ponto neutro calibrável e validado contra amostras nulas/NaN/Infinity.
 * - Opção de inversão aplicada exclusivamente ao sinal final da direção (preserva eixo físico e calibração).
 * - Zona morta (deadzone) com transição C0 contínua sem degrau.
 * - Curva progressiva opcional (responseExponent) para precisão em linha reta.
 * - Filtro passa-baixa exponencial de camada única matematicamente independente da taxa de quadros/eventos.
 * - Saída normalizada contínua no intervalo [-1.0, +1.0].
 */

import { clamp } from '@/utils/math'

export type SensorPermissionState = 'unsupported' | 'prompt' | 'granted' | 'denied'

export type SteeringMethod = 'touch' | 'tilt' | 'keyboard'

export interface TiltSteeringConfig {
  /** Se a direção por inclinação está habilitada */
  enabled: boolean
  /** Sensibilidade do esterço (padrão: 1.0; maior = atinge batente com menor inclinação) */
  sensitivity: number
  /** Zona morta central em graus (padrão: 2.0°) */
  deadzoneDeg: number
  /** Ângulo máximo de inclinação para esterçamento total a 1.0x sensibilidade (padrão: 30.0°) */
  baseMaxAngleDeg: number
  /** Alias opcional compatível com configurações de teste para baseMaxAngleDeg */
  maxSteerAngleDeg?: number
  /** Limite máximo de esterçamento (padrão: 1.0) */
  maxSteerLimit: number
  /** Fator de suavização passa-baixa (0.02 a 1.0; 1.0 = resposta instantânea sem filtro) */
  smoothingFactor: number
  /** Expoente de progressividade após a zona morta (1.0 = linear, >1.0 = centro mais progressivo) */
  responseExponent: number
  /** Taxa de retorno ao centro por segundo (padrão: 12.0) */
  autoCenteringRate: number
  /** Alias opcional compatível com configurações de teste para autoCenteringRate */
  autoCenterRate?: number
  /** Ângulo neutro calibrado pelo usuário em graus */
  neutralAngleDeg: number
  /** Inverter sinal final da direção */
  invertAxis: boolean
}

export interface TiltSample {
  /** Rotação em torno do eixo Y (-90 a +90 graus) */
  gamma: number | null | undefined
  /** Rotação em torno do eixo X (-180 a +180 graus) */
  beta: number | null | undefined
  /** Rotação em torno do eixo Z (0 a 360 graus — ignorado na direção para evitar deriva magnética) */
  alpha?: number | null | undefined
  /** Ângulo efetivo de orientação da tela em graus (0, 90, 180, 270 ou -90) */
  orientationAngle?: number
  /** Se o viewport está na orientação paisagem */
  isLandscape?: boolean
}

export interface TiltSteeringState {
  rawAngleDeg: number
  calibratedAngleDeg: number
  targetSteer: number
  filteredSteer: number
  isCalibrated: boolean
  neutralAngleDeg: number
  hasValidSample: boolean
}

export const DEFAULT_TILT_STEERING_CONFIG: TiltSteeringConfig = {
  enabled: false,
  sensitivity: 1.0,
  deadzoneDeg: 2.0,
  baseMaxAngleDeg: 30.0,
  maxSteerLimit: 1.0,
  smoothingFactor: 0.08,
  responseExponent: 1.0,
  autoCenteringRate: 12.0,
  neutralAngleDeg: 0,
  invertAxis: false,
}

/**
 * Converte beta W3C [-180°, +180°] em ângulo contínuo de rolagem lateral [-90°, +90°],
 * evitando salto ou saturação quando o smartphone em paisagem passa da vertical (|beta| > 90°).
 */
function foldBetaToRollDeg(betaDeg: number): number {
  let b = betaDeg
  while (b > 180) b -= 360
  while (b < -180) b += 360
  if (b > 90) return 180 - b
  if (b < -90) return -180 - b
  return b
}

function normalizeScreenAngleDeg(angle: number): 0 | 90 | 180 | 270 {
  const mod = ((Math.round(angle) % 360) + 360) % 360
  if (mod >= 45 && mod < 135) return 90
  if (mod >= 135 && mod < 225) return 180
  if (mod >= 225 && mod < 315) return 270
  return 0
}

export class TiltSteeringController {
  private config: TiltSteeringConfig
  private filteredSteer: number = 0
  private lastTargetSteer: number = 0
  private lastRawAngleDeg: number = 0
  private isCalibrated: boolean = false
  private hasReceivedValidSample: boolean = false

  constructor(customConfig?: Partial<TiltSteeringConfig>) {
    const merged: TiltSteeringConfig = {
      ...DEFAULT_TILT_STEERING_CONFIG,
      ...customConfig,
    }
    if (customConfig?.maxSteerAngleDeg !== undefined && Number.isFinite(customConfig.maxSteerAngleDeg)) {
      merged.baseMaxAngleDeg = clamp(customConfig.maxSteerAngleDeg, 5, 90)
    }
    if (customConfig?.autoCenterRate !== undefined && Number.isFinite(customConfig.autoCenterRate)) {
      merged.autoCenteringRate = clamp(customConfig.autoCenterRate, 0.5, 50)
    }
    this.config = merged
    if (customConfig?.neutralAngleDeg !== undefined && Number.isFinite(customConfig.neutralAngleDeg) && customConfig.neutralAngleDeg !== 0) {
      this.isCalibrated = true
    }
  }

  getConfig(): Readonly<TiltSteeringConfig> {
    return { ...this.config }
  }

  isEnabled(): boolean {
    return this.config.enabled
  }

  getSteeringAngle(): number {
    return this.filteredSteer
  }

  getNeutralAngleDeg(): number {
    return this.config.neutralAngleDeg
  }

  isCalibratedState(): boolean {
    return this.isCalibrated
  }

  hasValidSensorSample(): boolean {
    return this.hasReceivedValidSample
  }

  updateConfig(partial: Partial<TiltSteeringConfig>): void {
    if (partial.sensitivity !== undefined && Number.isFinite(partial.sensitivity)) {
      this.config.sensitivity = clamp(partial.sensitivity, 0.2, 3.5)
    }
    if (partial.deadzoneDeg !== undefined && Number.isFinite(partial.deadzoneDeg)) {
      this.config.deadzoneDeg = clamp(partial.deadzoneDeg, 0.0, 15.0)
    }
    if (partial.baseMaxAngleDeg !== undefined && Number.isFinite(partial.baseMaxAngleDeg)) {
      this.config.baseMaxAngleDeg = clamp(partial.baseMaxAngleDeg, 5.0, 90.0)
    }
    if (partial.maxSteerAngleDeg !== undefined && Number.isFinite(partial.maxSteerAngleDeg)) {
      this.config.baseMaxAngleDeg = clamp(partial.maxSteerAngleDeg, 5.0, 90.0)
    }
    if (partial.smoothingFactor !== undefined && Number.isFinite(partial.smoothingFactor)) {
      this.config.smoothingFactor = clamp(partial.smoothingFactor, 0.02, 1.0)
    }
    if (partial.responseExponent !== undefined && Number.isFinite(partial.responseExponent)) {
      this.config.responseExponent = clamp(partial.responseExponent, 1.0, 2.5)
    }
    if (partial.maxSteerLimit !== undefined && Number.isFinite(partial.maxSteerLimit)) {
      this.config.maxSteerLimit = clamp(partial.maxSteerLimit, 0.2, 1.0)
    }
    if (partial.autoCenteringRate !== undefined && Number.isFinite(partial.autoCenteringRate)) {
      this.config.autoCenteringRate = clamp(partial.autoCenteringRate, 0.5, 50.0)
    }
    if (partial.autoCenterRate !== undefined && Number.isFinite(partial.autoCenterRate)) {
      this.config.autoCenteringRate = clamp(partial.autoCenterRate, 0.5, 50.0)
    }
    if (partial.enabled !== undefined) {
      this.config.enabled = Boolean(partial.enabled)
    }
    if (partial.invertAxis !== undefined) {
      this.config.invertAxis = Boolean(partial.invertAxis)
    }
    if (partial.neutralAngleDeg !== undefined && Number.isFinite(partial.neutralAngleDeg)) {
      this.config.neutralAngleDeg = clamp(partial.neutralAngleDeg, -75, 75)
      this.isCalibrated = true
    }
  }

  /**
   * Restaura estado de calibração persistido sem exigir amostra imediata.
   */
  restoreCalibration(neutralAngleDeg: number, isCalibrated: boolean): void {
    if (isCalibrated && Number.isFinite(neutralAngleDeg) && Math.abs(neutralAngleDeg) <= 75) {
      this.config.neutralAngleDeg = clamp(neutralAngleDeg, -75, 75)
      this.isCalibrated = true
    } else {
      this.config.neutralAngleDeg = 0
      this.isCalibrated = false
    }
  }

  /**
   * Verifica se uma amostra possui o eixo numérico finito requerido pela orientação atual.
   */
  isSampleUsable(sample?: TiltSample | null): boolean {
    if (!sample) return false
    const betaOk = typeof sample.beta === 'number' && Number.isFinite(sample.beta)
    const gammaOk = typeof sample.gamma === 'number' && Number.isFinite(sample.gamma)
    if (!betaOk && !gammaOk) return false
    // Rejeita se qualquer eixo presente for NaN/Infinity explícito
    if (sample.beta !== undefined && sample.beta !== null && !Number.isFinite(sample.beta)) return false
    if (sample.gamma !== undefined && sample.gamma !== null && !Number.isFinite(sample.gamma)) return false

    const effectiveAngle =
      typeof sample.orientationAngle === 'number' && Number.isFinite(sample.orientationAngle)
        ? normalizeScreenAngleDeg(sample.orientationAngle)
        : sample.isLandscape
          ? 90
          : 0

    if (effectiveAngle === 90 || effectiveAngle === 270) {
      return betaOk
    }
    return gammaOk
  }

  /**
   * Define o ponto neutro atual com base em uma amostra válida de inclinação.
   * Se nenhuma amostra válida estiver disponível, preserva o estado anterior sem gravar NaN/falso zero.
   */
  calibrate(sample?: TiltSample): number {
    if (sample !== undefined) {
      if (!this.isSampleUsable(sample)) {
        return this.config.neutralAngleDeg
      }
      const extracted = this.extractSteeringAngleDeg(sample)
      if (!Number.isFinite(extracted)) {
        return this.config.neutralAngleDeg
      }
      this.lastRawAngleDeg = extracted
      this.hasReceivedValidSample = true
      this.config.neutralAngleDeg = clamp(extracted, -75, 75)
      this.isCalibrated = true
      this.filteredSteer = 0
      this.lastTargetSteer = 0
      return this.config.neutralAngleDeg
    }

    if (!this.hasReceivedValidSample || !Number.isFinite(this.lastRawAngleDeg)) {
      return this.config.neutralAngleDeg
    }

    this.config.neutralAngleDeg = clamp(this.lastRawAngleDeg, -75, 75)
    this.isCalibrated = true
    this.filteredSteer = 0
    this.lastTargetSteer = 0
    return this.config.neutralAngleDeg
  }

  /**
   * Reseta a calibração de ponto neutro para 0.0°.
   */
  resetCalibration(): void {
    this.config.neutralAngleDeg = 0
    this.isCalibrated = false
  }

  /**
   * Reseta apenas o estado transitório do filtro (preservando calibração e preferências).
   */
  resetTransientFilter(): void {
    this.filteredSteer = 0
    this.lastTargetSteer = 0
  }

  /**
   * Reseta o estado interno transitório de esterço para zero.
   */
  reset(): void {
    this.filteredSteer = 0
    this.lastTargetSteer = 0
    this.lastRawAngleDeg = 0
    this.hasReceivedValidSample = false
  }

  /**
   * Extrai o ângulo físico de rolagem lateral (como um volante: direita > 0, esquerda < 0)
   * consistente com a orientação efetiva da tela (0°, 90°, 180°, 270°):
   * - 90° (paisagem com topo à esquerda): +foldBetaToRoll(beta)
   * - 270° / -90° (paisagem com topo à direita): -foldBetaToRoll(beta)
   * - 0° (retrato padrão ou tablet paisagem nativa 0°): gamma compensado contra flip |beta| > 90°
   * - 180° (retrato invertido): -gamma compensado contra flip |beta| > 90°
   */
  extractSteeringAngleDeg(sample: TiltSample): number {
    const beta = typeof sample.beta === 'number' && Number.isFinite(sample.beta) ? sample.beta : null
    const gamma = typeof sample.gamma === 'number' && Number.isFinite(sample.gamma) ? sample.gamma : null

    if (beta === null && gamma === null) {
      return this.lastRawAngleDeg
    }

    const effectiveAngle =
      typeof sample.orientationAngle === 'number' && Number.isFinite(sample.orientationAngle)
        ? normalizeScreenAngleDeg(sample.orientationAngle)
        : sample.isLandscape
          ? 90
          : 0

    if (effectiveAngle === 90 || effectiveAngle === 270) {
      if (beta === null) return this.lastRawAngleDeg
      const rollDeg = foldBetaToRollDeg(beta)
      return effectiveAngle === 270 ? -rollDeg : rollDeg
    }

    // Orientação 0° ou 180°: o eixo de rolagem da tela corresponde a gamma,
    // mas a parametrização Euler W3C Z-X'-Y'' inverte o sinal de gamma quando |beta| > 90°
    // (aparelho segurado levemente reclinado além da vertical). Compensamos o quadrante:
    if (gamma === null) return this.lastRawAngleDeg
    const correctedGamma = beta !== null && Math.abs(beta) > 90 ? -gamma : gamma
    return effectiveAngle === 180 ? -correctedGamma : correctedGamma
  }

  /**
   * Processa uma amostra bruta dos sensores e calcula o esterçamento filtrado normalizado [-1.0, +1.0].
   *
   * @param sample Amostra bruta de DeviceOrientation
   * @param deltaTime Intervalo de tempo decorrido em segundos (usado no filtro exponencial contínuo)
   */
  computeSteering(sample: TiltSample | null | undefined, deltaTime: number = 0.016): number {
    const dt = Number.isFinite(deltaTime) ? Math.max(0.0005, Math.min(deltaTime, 0.25)) : 0.016

    // Se o controle de inclinação estiver desativado ou sem amostra, retorna gradualmente ao centro
    if (!this.config.enabled || !sample) {
      return this.stepAutoCentering(dt)
    }

    // Rejeição estrita de NaN / Infinity / null em ambos os eixos
    if (!this.isSampleUsable(sample)) {
      if (sample.beta === null && sample.gamma === null && !this.hasReceivedValidSample) {
        return 0
      }
      return this.filteredSteer
    }

    const rawAngle = this.extractSteeringAngleDeg(sample)
    if (!Number.isFinite(rawAngle)) {
      return this.filteredSteer
    }
    this.lastRawAngleDeg = rawAngle
    this.hasReceivedValidSample = true

    // 1. Delta físico em relação ao centro neutro calibrado (não afetado por invertAxis)
    let deltaAngle = rawAngle - this.config.neutralAngleDeg
    while (deltaAngle > 180) deltaAngle -= 360
    while (deltaAngle < -180) deltaAngle += 360

    // 2. Zona morta (deadzone) com transição contínua C0 e curva progressiva opcional
    const deadzone = this.config.deadzoneDeg
    const sensitivity = Math.max(0.2, this.config.sensitivity)
    const maxAngle = Math.max(deadzone + 1.0, this.config.baseMaxAngleDeg / sensitivity)

    let targetSteer = 0
    const absDelta = Math.abs(deltaAngle)

    if (absDelta > deadzone) {
      const normalizedRatio = clamp((absDelta - deadzone) / (maxAngle - deadzone), 0.0, 1.0)
      const curvedRatio =
        this.config.responseExponent !== 1.0
          ? Math.pow(normalizedRatio, this.config.responseExponent)
          : normalizedRatio
      targetSteer = Math.sign(deltaAngle) * curvedRatio * this.config.maxSteerLimit
    }

    // 3. Inversão opcional aplicada EXCLUSIVAMENTE ao sinal final da direção
    if (this.config.invertAxis && targetSteer !== 0) {
      targetSteer = -targetSteer
    }

    this.lastTargetSteer = targetSteer

    // 4. Filtro passa-baixa exponencial contínuo (independente de FPS e da taxa de eventos)
    const smoothingAlpha =
      this.config.smoothingFactor >= 0.999
        ? 1.0
        : clamp(1.0 - Math.exp(-this.config.smoothingFactor * 180.0 * dt), 0.0005, 1.0)

    this.filteredSteer += (targetSteer - this.filteredSteer) * smoothingAlpha

    if (Math.abs(this.filteredSteer) < 0.0005 && targetSteer === 0) {
      this.filteredSteer = 0
    } else if (Math.abs(this.filteredSteer - targetSteer) < 0.0001) {
      this.filteredSteer = targetSteer
    }

    this.filteredSteer = clamp(this.filteredSteer, -this.config.maxSteerLimit, this.config.maxSteerLimit)

    if (!Number.isFinite(this.filteredSteer)) {
      this.filteredSteer = 0
    }

    return this.filteredSteer
  }

  /**
   * Retorno gradual do volante para o centro neutro (0.0).
   */
  stepAutoCentering(dt: number): number {
    const safeDt = Number.isFinite(dt) ? Math.max(0.0005, Math.min(dt, 0.25)) : 0.016
    if (Math.abs(this.filteredSteer) <= 0.001) {
      this.filteredSteer = 0
      this.lastTargetSteer = 0
      return 0
    }

    const centerSpeed = this.config.autoCenteringRate * safeDt
    if (this.filteredSteer > 0) {
      this.filteredSteer = Math.max(0, this.filteredSteer - centerSpeed)
    } else {
      this.filteredSteer = Math.min(0, this.filteredSteer + centerSpeed)
    }

    this.lastTargetSteer = 0
    return this.filteredSteer
  }

  /**
   * Força uma atribuição direta no esterço filtrado (usado por controle de teclado desktop).
   */
  setSteerDirect(value: number): void {
    if (Number.isFinite(value)) {
      this.filteredSteer = clamp(value, -this.config.maxSteerLimit, this.config.maxSteerLimit)
      this.lastTargetSteer = this.filteredSteer
    }
  }

  getState(): Readonly<TiltSteeringState> {
    let calAngle = this.lastRawAngleDeg - this.config.neutralAngleDeg
    while (calAngle > 180) calAngle -= 360
    while (calAngle < -180) calAngle += 360
    return {
      rawAngleDeg: this.lastRawAngleDeg,
      calibratedAngleDeg: Number.isFinite(calAngle) ? calAngle : 0,
      targetSteer: this.lastTargetSteer,
      filteredSteer: this.filteredSteer,
      isCalibrated: this.isCalibrated,
      neutralAngleDeg: this.config.neutralAngleDeg,
      hasValidSample: this.hasReceivedValidSample,
    }
  }
}
