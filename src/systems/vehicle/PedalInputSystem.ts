import { clamp } from '@/utils/math'

export interface PedalKeys {
  throttlePressed: boolean
  brakePressed: boolean
  clutchPressed: boolean
}

export interface PedalRates {
  throttleRise: number // taxa por segundo
  throttleFall: number
  brakeRise: number
  brakeFall: number
  clutchRise: number
  clutchFall: number
}

const DEFAULT_RATES: PedalRates = {
  // Teclado/analog: resposta ágil e progressiva imitando o curso de pedais reais
  throttleRise: 8.5,   // ~120ms de 0 a 100%
  throttleFall: 10.0,  // ~100ms de retorno
  brakeRise: 12.5,     // ~80ms de 0 a 100%
  brakeFall: 10.0,     // ~100ms de alívio
  clutchRise: 9.5,     // ~105ms para pisar fundo
  clutchFall: 7.0,     // ~140ms para soltar (mais controlável para embreagem)
}

/**
 * PedalInputSystem — Gerenciador unificado de entradas analógicas dos pedais.
 *
 * Garante que tanto o teclado (W/E/Q) quanto os controles táteis (Touch/Mouse)
 * compartilhem a mesma dinâmica física de curso, suavização e limites.
 */
export class PedalInputSystem {
  private throttle: number = 0
  private brake: number = 0
  private clutch: number = 0
  private rates: PedalRates

  constructor(customRates?: Partial<PedalRates>) {
    this.rates = { ...DEFAULT_RATES, ...customRates }
  }

  getThrottle(): number {
    return this.throttle
  }

  getBrake(): number {
    return this.brake
  }

  getClutch(): number {
    return this.clutch
  }

  /** Define valor analógico direto (usado por sliders e touch) */
  setThrottle(value: number): void {
    this.throttle = clamp(value, 0, 1)
  }

  setBrake(value: number): void {
    this.brake = clamp(value, 0, 1)
  }

  setClutch(value: number): void {
    this.clutch = clamp(value, 0, 1)
  }

  /**
   * Atualiza a dinâmica dos pedais baseada no tempo e nas teclas pressionadas.
   * Retorna true se algum valor foi alterado.
   */
  update(deltaTime: number, keys: PedalKeys, hasClutch: boolean = true): boolean {
    const dt = Math.max(0, deltaTime)
    let changed = false

    // 1. Acelerador
    const prevThrottle = this.throttle
    if (keys.throttlePressed) {
      this.throttle = clamp(this.throttle + this.rates.throttleRise * dt, 0, 1)
    } else if (this.throttle > 0) {
      this.throttle = clamp(this.throttle - this.rates.throttleFall * dt, 0, 1)
    }
    if (Math.abs(this.throttle - prevThrottle) > 0.0001) changed = true

    // 2. Freio
    const prevBrake = this.brake
    if (keys.brakePressed) {
      this.brake = clamp(this.brake + this.rates.brakeRise * dt, 0, 1)
    } else if (this.brake > 0) {
      this.brake = clamp(this.brake - this.rates.brakeFall * dt, 0, 1)
    }
    if (Math.abs(this.brake - prevBrake) > 0.0001) changed = true

    // 3. Embreagem (apenas se o veículo possuir embreagem física)
    if (hasClutch) {
      const prevClutch = this.clutch
      if (keys.clutchPressed) {
        this.clutch = clamp(this.clutch + this.rates.clutchRise * dt, 0, 1)
      } else if (this.clutch > 0) {
        this.clutch = clamp(this.clutch - this.rates.clutchFall * dt, 0, 1)
      }
      if (Math.abs(this.clutch - prevClutch) > 0.0001) changed = true
    } else {
      this.clutch = 0
    }

    return changed
  }

  reset(): void {
    this.throttle = 0
    this.brake = 0
    this.clutch = 0
  }
}
