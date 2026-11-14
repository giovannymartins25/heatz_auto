/**
 * HEATZ AUTO — FASE 1.6.2: CONTROLE DE DIREÇÃO POR SENSORES DE INCLINAÇÃO (TILT STEERING)
 * 
 * Controlador puro de esterçamento baseado em giroscópio e acelerômetro (DeviceOrientation).
 * 
 * Características:
 * - Normalização precisa de ângulos para Paisagem e Retrato sem inversões.
 * - Desacoplamento do vetor de gravidade (não usa bússola/yaw magnético instável).
 * - Ponto neutro calibrável (re-zero offset).
 * - Zona morta (deadzone) configurável com transição contínua sem saltos.
 * - Sensibilidade ajustável (graus de inclinação para batente máximo).
 * - Filtro passa-baixa de suavização contra micro-vibrações da mão.
 * - Retorno gradual ao centro.
 * - Proteção estrita contra NaN e Infinity.
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
  /** Limite máximo de esterçamento (padrão: 1.0) */
  maxSteerLimit: number
  /** Fator de suavização passa-baixa (0.05 a 1.0; 1.0 = sem filtro, 0.25 = equilibrado) */
  smoothingFactor: number
  /** Taxa de retorno ao centro por segundo (padrão: 10.0) */
  autoCenteringRate: number
  /** Ângulo neutro calibrado pelo usuário em graus */
  neutralAngleDeg: number
  /** Inverter direção do esterço */
  invertAxis: boolean
}

export interface TiltSample {
  /** Rotação em torno do eixo Y (-90 a +90 graus) */
  gamma: number | null | undefined
  /** Rotação em torno do eixo X (-180 a +180 graus) */
  beta: number | null | undefined
  /** Rotação em torno do eixo Z (0 a 360 graus) */
  alpha?: number | null | undefined
  /** Ângulo de orientação da tela (0, 90, 180, 270) */
  orientationAngle?: number
  /** Se o dispositivo está na orientação paisagem */
  isLandscape?: boolean
}

export interface TiltSteeringState {
  rawAngleDeg: number
  calibratedAngleDeg: number
  targetSteer: number
  filteredSteer: number
  isCalibrated: boolean
  neutralAngleDeg: number
}

export const DEFAULT_TILT_STEERING_CONFIG: TiltSteeringConfig = {
  enabled: false,
  sensitivity: 1.0,
  deadzoneDeg: 2.0,
  baseMaxAngleDeg: 30.0,
  maxSteerLimit: 1.0,
  smoothingFactor: 0.28,
  autoCenteringRate: 12.0,
  neutralAngleDeg: 0,
  invertAxis: false,
}

export class TiltSteeringController {
  private config: TiltSteeringConfig
  private filteredSteer: number = 0
  private lastTargetSteer: number = 0
  private lastRawAngleDeg: number = 0
  private isCalibrated: boolean = false

  constructor(customConfig?: Partial<TiltSteeringConfig>) {
    this.config = { ...DEFAULT_TILT_STEERING_CONFIG, ...customConfig }
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

  updateConfig(partial: Partial<TiltSteeringConfig>): void {
    if (partial.sensitivity !== undefined && Number.isFinite(partial.sensitivity)) {
      this.config.sensitivity = clamp(partial.sensitivity, 0.2, 3.5)
    }
    if (partial.deadzoneDeg !== undefined && Number.isFinite(partial.deadzoneDeg)) {
      this.config.deadzoneDeg = clamp(partial.deadzoneDeg, 0.0, 15.0)
    }
    if (partial.smoothingFactor !== undefined && Number.isFinite(partial.smoothingFactor)) {
      this.config.smoothingFactor = clamp(partial.smoothingFactor, 0.02, 1.0)
    }
    if (partial.maxSteerLimit !== undefined && Number.isFinite(partial.maxSteerLimit)) {
      this.config.maxSteerLimit = clamp(partial.maxSteerLimit, 0.2, 1.0)
    }
    if (partial.enabled !== undefined) {
      this.config.enabled = Boolean(partial.enabled)
    }
    if (partial.invertAxis !== undefined) {
      this.config.invertAxis = Boolean(partial.invertAxis)
    }
    if (partial.neutralAngleDeg !== undefined && Number.isFinite(partial.neutralAngleDeg)) {
      this.config.neutralAngleDeg = partial.neutralAngleDeg
      this.isCalibrated = true
    }
  }

  /**
   * Define o ponto neutro atual com base em uma amostra de inclinação.
   * Se nenhuma amostra for passada, usa a última leitura válida.
   */
  calibrate(sample?: TiltSample): number {
    let angleToSet = this.lastRawAngleDeg
    if (sample) {
      const extracted = this.extractSteeringAngleDeg(sample)
      if (Number.isFinite(extracted)) {
        angleToSet = extracted
      }
    }
    this.config.neutralAngleDeg = angleToSet
    this.isCalibrated = true
    return angleToSet
  }

  /**
   * Reseta a calibração de ponto neutro para 0.0°.
   */
  resetCalibration(): void {
    this.config.neutralAngleDeg = 0
    this.isCalibrated = false
  }

  /**
   * Reseta o estado interno de esterço para zero.
   */
  reset(): void {
    this.filteredSteer = 0
    this.lastTargetSteer = 0
    this.lastRawAngleDeg = 0
  }

  /**
   * Extrai o ângulo de rotação relevante para a direção com base na orientação da tela.
   * Não utiliza magnetômetro ou yaw da gravidade.
   */
  extractSteeringAngleDeg(sample: TiltSample): number {
    const beta = typeof sample.beta === 'number' && Number.isFinite(sample.beta) ? sample.beta : null
    const gamma = typeof sample.gamma === 'number' && Number.isFinite(sample.gamma) ? sample.gamma : null

    if (beta === null && gamma === null) {
      return this.lastRawAngleDeg
    }

    const angle = sample.orientationAngle ?? (sample.isLandscape ? 90 : 0)
    const isLandscape = sample.isLandscape ?? (angle === 90 || angle === 270 || angle === -90)

    if (isLandscape) {
      // Em modo Paisagem, o smartphone é segurado com ambas as mãos como um volante.
      // O eixo longitudinal do volante corresponde ao eixo X do celular (beta).
      if (beta === null) return this.lastRawAngleDeg

      if (angle === 270 || angle === -90) {
        // Paisagem secundária (celular virado 180° no landscape)
        return -beta
      } else {
        // Paisagem primária padrão (topo do celular à esquerda, 90°)
        return beta
      }
    } else {
      // Em modo Retrato, o esterço para esquerda/direita corresponde à rotação no eixo Y (gamma).
      if (gamma === null) return this.lastRawAngleDeg

      if (angle === 180) {
        return -gamma
      }
      return gamma
    }
  }

  /**
   * Processa uma amostra bruta dos sensores e calcula o esterçamento filtrado normalizado [-1.0, +1.0].
   * 
   * @param sample Amostra bruta de DeviceOrientation
   * @param deltaTime Intervalo de tempo decorrido em segundos (usado na suavização)
   */
  computeSteering(sample: TiltSample | null | undefined, deltaTime: number = 0.016): number {
    const dt = Math.max(0.001, Math.min(deltaTime, 0.25))

    // Se o controle de inclinação estiver desativado, retorna gradualmente ao centro
    if (!this.config.enabled || !sample) {
      return this.stepAutoCentering(dt)
    }

    // Validação estrita de valores numéricos
    if (
      (sample.beta !== undefined && sample.beta !== null && !Number.isFinite(sample.beta)) ||
      (sample.gamma !== undefined && sample.gamma !== null && !Number.isFinite(sample.gamma))
    ) {
      // Rejeita leitura inválida / NaN / Infinito sem contaminar o estado
      return this.filteredSteer
    }

    const rawAngle = this.extractSteeringAngleDeg(sample)
    if (!Number.isFinite(rawAngle)) {
      return this.filteredSteer
    }
    this.lastRawAngleDeg = rawAngle

    // 1. Aplicação do ponto neutro calibrado
    let deltaAngle = rawAngle - this.config.neutralAngleDeg

    // Normalização no intervalo [-180, +180] graus
    while (deltaAngle > 180) deltaAngle -= 360
    while (deltaAngle < -180) deltaAngle += 360

    if (this.config.invertAxis) {
      deltaAngle = -deltaAngle
    }

    // 2. Zona morta (deadzone) com transição contínua
    const deadzone = this.config.deadzoneDeg
    const sensitivity = Math.max(0.2, this.config.sensitivity)
    const maxAngle = Math.max(deadzone + 1.0, this.config.baseMaxAngleDeg / sensitivity)

    let targetSteer = 0
    const absDelta = Math.abs(deltaAngle)

    if (absDelta > deadzone) {
      const normalizedRatio = (absDelta - deadzone) / (maxAngle - deadzone)
      const clampedRatio = clamp(normalizedRatio, 0.0, 1.0)
      targetSteer = Math.sign(deltaAngle) * clampedRatio * this.config.maxSteerLimit
    } else {
      targetSteer = 0
    }

    this.lastTargetSteer = targetSteer

    // 3. Suavização temporal (filtro passa-baixa desacoplado da taxa de quadros)
    const smoothingAlpha = 1.0 - Math.exp(-this.config.smoothingFactor * (dt / 0.016) * 12.0)
    const clampedAlpha = clamp(smoothingAlpha, 0.02, 1.0)

    this.filteredSteer += (targetSteer - this.filteredSteer) * clampedAlpha

    // Batente definitivo de segurança
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
    if (Math.abs(this.filteredSteer) <= 0.001) {
      this.filteredSteer = 0
      this.lastTargetSteer = 0
      return 0
    }

    const centerSpeed = this.config.autoCenteringRate * dt
    if (this.filteredSteer > 0) {
      this.filteredSteer = Math.max(0, this.filteredSteer - centerSpeed)
    } else {
      this.filteredSteer = Math.min(0, this.filteredSteer + centerSpeed)
    }

    this.lastTargetSteer = 0
    return this.filteredSteer
  }

  /**
   * Força uma atribuição direta no esterço filtrado (usado por controle touch ou teclado).
   */
  setSteerDirect(value: number): void {
    if (Number.isFinite(value)) {
      this.filteredSteer = clamp(value, -this.config.maxSteerLimit, this.config.maxSteerLimit)
      this.lastTargetSteer = this.filteredSteer
    }
  }

  getState(): Readonly<TiltSteeringState> {
    const calAngle = this.lastRawAngleDeg - this.config.neutralAngleDeg
    return {
      rawAngleDeg: this.lastRawAngleDeg,
      calibratedAngleDeg: Number.isFinite(calAngle) ? calAngle : 0,
      targetSteer: this.lastTargetSteer,
      filteredSteer: this.filteredSteer,
      isCalibrated: this.isCalibrated,
      neutralAngleDeg: this.config.neutralAngleDeg,
    }
  }
}
