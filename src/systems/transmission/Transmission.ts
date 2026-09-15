import type { TransmissionConfig } from '@/types'
import { GearCalculator } from './GearCalculator'
import { clamp } from '@/utils/math'

export interface ShiftResult {
  gear: number
  newRpm: number
  success: boolean
  reason?: 'clutch_required' | 'over_rev' | 'gear_limit' | 'none'
}

/**
 * Transmission — Sistema de câmbio e marchas.
 *
 * Gerencia o estado da transmissão:
 * - Marcha atual
 * - Estado da embreagem
 * - Troca de marchas com validação física (exige embreagem >= 95% em manuais)
 * - Proteção ativa contra over-rev em reduções
 * - Cálculo do RPM resultante após troca
 */
export class Transmission {
  private readonly config: TransmissionConfig
  readonly calculator: GearCalculator

  private _currentGear: number = 0 // 0 = neutro, -1 = ré
  private _clutchPosition: number = 0 // 0 = solta / acoplada, 1 = pressionada / desacoplada

  constructor(config: TransmissionConfig, wheelDiameter: number) {
    this.config = config
    this.calculator = new GearCalculator(config, wheelDiameter)
  }

  get currentGear(): number {
    return this._currentGear
  }

  get clutchPosition(): number {
    return this._clutchPosition
  }

  /** Embreagem suficientemente pressionada para desacoplamento mecânico (>= 95%) */
  get isClutchPressed(): boolean {
    return this._clutchPosition >= 0.95
  }

  get isNeutral(): boolean {
    return this._currentGear === 0
  }

  get isEngaged(): boolean {
    return !this.isNeutral && !this.isClutchPressed
  }

  get hasClutch(): boolean {
    return !!this.config.hasClutch
  }

  /**
   * Verifica se a embreagem permite a troca de marcha.
   * Veículos com embreagem física exigem clutch >= 95% (0.95).
   * Veículos sem embreagem (CVT/Automáticos) sempre permitem.
   */
  canShiftWithClutch(): boolean {
    if (!this.config.hasClutch) return true
    return this._clutchPosition >= 0.95
  }

  /** Pressiona/solta a embreagem (0 = solta, 1 = pressionada) */
  setClutch(position: number): void {
    this._clutchPosition = clamp(position, 0, 1)
  }

  /**
   * Troca para uma marcha acima.
   * Exige embreagem >= 95% em veículos manuais.
   */
  shiftUp(currentRpm: number, currentSpeedKmh: number, maxRpm?: number): ShiftResult {
    // 1. Validação de embreagem
    if (!this.canShiftWithClutch()) {
      return {
        gear: this._currentGear,
        newRpm: currentRpm,
        success: false,
        reason: 'clutch_required',
      }
    }

    const nextGear = this._currentGear + 1
    if (nextGear > this.config.gearCount) {
      return {
        gear: this._currentGear,
        newRpm: currentRpm,
        success: false,
        reason: 'gear_limit',
      }
    }

    // 2. Proteção over-rev (se fornecido)
    if (maxRpm && !this.canShiftTo(nextGear, currentSpeedKmh, maxRpm)) {
      return {
        gear: this._currentGear,
        newRpm: currentRpm,
        success: false,
        reason: 'over_rev',
      }
    }

    return this.shiftTo(nextGear, currentSpeedKmh, maxRpm, true)
  }

  /**
   * Troca para uma marcha abaixo.
   * Exige embreagem >= 95% em veículos manuais e protege contra over-rev.
   */
  shiftDown(currentRpm: number, currentSpeedKmh: number, maxRpm: number): ShiftResult {
    // 1. Validação de embreagem
    if (!this.canShiftWithClutch()) {
      return {
        gear: this._currentGear,
        newRpm: currentRpm,
        success: false,
        reason: 'clutch_required',
      }
    }

    const nextGear = this._currentGear - 1
    if (nextGear < -1) {
      return {
        gear: this._currentGear,
        newRpm: currentRpm,
        success: false,
        reason: 'gear_limit',
      }
    }

    // 2. Proteção contra Over-rev mecânico
    if (nextGear > 0 && !this.canShiftTo(nextGear, currentSpeedKmh, maxRpm)) {
      return {
        gear: this._currentGear,
        newRpm: currentRpm,
        success: false,
        reason: 'over_rev',
      }
    }

    return this.shiftTo(nextGear, currentSpeedKmh, maxRpm, true)
  }

  /**
   * Troca para uma marcha específica.
   * Recalcula o RPM baseado na velocidade atual.
   */
  shiftTo(
    gear: number,
    currentSpeedKmh: number,
    maxRpm?: number,
    bypassClutchCheck: boolean = false,
  ): ShiftResult {
    if (gear < -1 || gear > this.config.gearCount) {
      return { gear: this._currentGear, newRpm: 0, success: false, reason: 'gear_limit' }
    }

    // Validação de embreagem se não for bypass
    if (!bypassClutchCheck && !this.canShiftWithClutch()) {
      return {
        gear: this._currentGear,
        newRpm: this.calculator.speedToRpm(currentSpeedKmh, this._currentGear),
        success: false,
        reason: 'clutch_required',
      }
    }

    // Proteção de over-rev se houver maxRpm
    if (gear > 0 && maxRpm && !this.canShiftTo(gear, currentSpeedKmh, maxRpm)) {
      return {
        gear: this._currentGear,
        newRpm: this.calculator.speedToRpm(currentSpeedKmh, this._currentGear),
        success: false,
        reason: 'over_rev',
      }
    }

    this._currentGear = gear

    // Em neutro, motor gira livre
    if (gear === 0) {
      return { gear: 0, newRpm: -1, success: true, reason: 'none' } // -1 = manter RPM atual
    }

    // Calcula RPM correspondente na nova marcha
    const newRpm = this.calculator.speedToRpm(currentSpeedKmh, gear)
    return { gear, newRpm, success: true, reason: 'none' }
  }

  /** Coloca em neutro (ponto morto sempre permitido) */
  neutral(): void {
    this._currentGear = 0
  }

  /**
   * Verifica se a troca para uma marcha alvo é segura contra over-rev.
   */
  canShiftTo(targetGear: number, currentSpeedKmh: number, maxRpm: number): boolean {
    if (targetGear <= 0) return true
    if (targetGear > this.config.gearCount) return false
    const projectedRpm = this.calculator.speedToRpm(currentSpeedKmh, targetGear)
    return projectedRpm <= maxRpm * 0.95
  }

  /**
   * Verifica se uma redução (downshift) é segura contra over-rev.
   */
  canShiftDown(currentSpeedKmh: number, maxRpm: number): boolean {
    if (this._currentGear <= 1) return false
    return this.canShiftTo(this._currentGear - 1, currentSpeedKmh, maxRpm)
  }

  /** Reseta o estado da transmissão */
  reset(): void {
    this._currentGear = 0
    this._clutchPosition = 0
  }
}
