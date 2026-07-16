import type { TransmissionConfig } from '@/types'
import { GearCalculator } from './GearCalculator'
import { clamp } from '@/utils/math'

/**
 * Transmission — Sistema de câmbio e marchas.
 *
 * Gerencia o estado da transmissão:
 * - Marcha atual
 * - Estado da embreagem
 * - Troca de marchas (com validação)
 * - Cálculo do RPM resultante após troca
 *
 * Quando uma marcha é trocada, o RPM do motor é recalculado
 * para manter a velocidade do veículo consistente.
 */
export class Transmission {
  private readonly config: TransmissionConfig
  readonly calculator: GearCalculator

  private _currentGear: number = 0 // 0 = neutro
  private _clutchPosition: number = 0 // 0 = solta, 1 = pressionada

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

  get isClutchPressed(): boolean {
    return this._clutchPosition > 0.8
  }

  get isNeutral(): boolean {
    return this._currentGear === 0
  }

  get isEngaged(): boolean {
    return !this.isNeutral && !this.isClutchPressed
  }

  /** Pressiona a embreagem (0 = solta, 1 = pressionada) */
  setClutch(position: number): void {
    this._clutchPosition = clamp(position, 0, 1)
  }

  /**
   * Troca para uma marcha acima.
   * Retorna o novo RPM que o motor deve assumir.
   */
  shiftUp(currentRpm: number, currentSpeedKmh: number): { gear: number; newRpm: number } {
    const nextGear = this._currentGear + 1
    if (nextGear > this.config.gearCount) {
      return { gear: this._currentGear, newRpm: currentRpm }
    }

    return this.shiftTo(nextGear, currentSpeedKmh)
  }

  /**
   * Troca para uma marcha abaixo.
   * Retorna o novo RPM que o motor deve assumir.
   */
  shiftDown(currentRpm: number, currentSpeedKmh: number, maxRpm: number): { gear: number; newRpm: number } {
    const nextGear = this._currentGear - 1
    if (nextGear < 0) {
      return { gear: this._currentGear, newRpm: currentRpm }
    }

    // Verifica se a redução não vai ultrapassar o RPM máximo
    if (nextGear > 0) {
      const newRpm = this.calculator.speedToRpm(currentSpeedKmh, nextGear)
      if (newRpm > maxRpm * 0.95) {
        return { gear: this._currentGear, newRpm: currentRpm }
      }
    }

    return this.shiftTo(nextGear, currentSpeedKmh)
  }

  /**
   * Troca para uma marcha específica.
   * Recalcula o RPM baseado na velocidade atual.
   */
  shiftTo(gear: number, currentSpeedKmh: number): { gear: number; newRpm: number } {
    if (gear < -1 || gear > this.config.gearCount) {
      return { gear: this._currentGear, newRpm: 0 }
    }

    this._currentGear = gear

    // Em neutro, motor gira livre
    if (gear === 0) {
      return { gear: 0, newRpm: -1 } // -1 = manter RPM atual
    }

    // Calcula RPM baseado na velocidade e nova marcha
    const newRpm = this.calculator.speedToRpm(currentSpeedKmh, gear)
    return { gear, newRpm }
  }

  /** Coloca em neutro */
  neutral(): void {
    this._currentGear = 0
  }

  /** Reseta o estado da transmissão */
  reset(): void {
    this._currentGear = 0
    this._clutchPosition = 0
  }
}
