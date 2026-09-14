import { clamp } from '@/utils/math'

export interface ClutchState {
  position: number         // 0 = solta / acoplada, 1 = pressionada / desacoplada
  engagement: number       // 0 = livre, 1 = 100% acoplada
  isSlipping: boolean
  transmittedTorque: number // Nm transmitido
}

/**
 * ClutchSystem — Modela o disco de embreagem por fricção.
 *
 * Conecta o volante do motor (virabrequim) ao eixo primário da transmissão.
 * - 0% (solta): 100% acoplada (transfere torque total).
 * - 100% (pressionada): 0% acoplada (motor gira livre).
 * - Zona de atrito (slip): transferência progressiva de torque proporcional
 *   à pressão do disco e à diferença de rotação entre motor e transmissão.
 */
export class ClutchSystem {
  private position: number = 0 // 0 a 1
  private maxTorqueCapacity: number

  constructor(maxEngineTorque: number) {
    // Capacidade de atrito do disco de embreagem (geralmente ~1.4x o torque máximo do motor)
    this.maxTorqueCapacity = maxEngineTorque * 1.4
  }

  /** Define a posição do pedal/manete de embreagem (0 a 1) */
  setPosition(pos: number): void {
    this.position = clamp(pos, 0, 1)
  }

  getPosition(): number {
    return this.position
  }

  /** Retorna o fator de acoplamento mecânico (1 = acoplada, 0 = desacoplada) */
  getEngagement(): number {
    // Zona de folga inicial (0 a 0.15) e desacoplamento final (> 0.80)
    if (this.position <= 0.15) return 1.0
    if (this.position >= 0.85) return 0.0

    // Curva progressiva na zona de atrito (0.15 a 0.85)
    const normalized = (0.85 - this.position) / 0.70
    return Math.pow(normalized, 1.2) // Ligeiramente não-linear para maior realismo
  }

  /**
   * Calcula o torque transferido entre motor e transmissão.
   *
   * Suporta tanto o regime de deslizamento dinâmico (slip) quanto o regime
   * de acoplamento rígido (stick/lock), onde o torque transmitido reflete
   * a força motriz do motor.
   *
   * @param engineAngularVelocity Velocidade angular do motor (rad/s)
   * @param transmissionAngularVelocity Velocidade angular do eixo primário (rad/s)
   * @param isInNeutral Se a transmissão está em ponto morto (neutro)
   * @param engineTorque Torque gerado pelo motor neste frame (opcional para regime bloqueado)
   */
  calculateTorqueTransfer(
    engineAngularVelocity: number,
    transmissionAngularVelocity: number,
    isInNeutral: boolean,
    engineTorque: number = 0,
  ): ClutchState {
    const engagement = this.getEngagement()

    // Em neutro ou com embreagem 100% pressionada, nenhum torque é transmitido
    if (isInNeutral || engagement <= 0.001) {
      return {
        position: this.position,
        engagement: 0,
        isSlipping: false,
        transmittedTorque: 0,
      }
    }

    // Diferença de velocidade angular entre motor e transmissão (rad/s)
    const slipSpeed = engineAngularVelocity - transmissionAngularVelocity

    // Capacidade instantânea de atrito com base na pressão do disco
    const frictionCapacity = this.maxTorqueCapacity * engagement

    // 1. Torque dinâmico de deslizamento (slip)
    const K_slip = 2.5
    let dynamicTorque = slipSpeed * K_slip * engagement
    dynamicTorque = clamp(dynamicTorque, -frictionCapacity, frictionCapacity)

    // 2. Regime estático / bloqueado: quando acoplada, transfere o torque do motor
    let torque = dynamicTorque
    if (engineTorque !== 0 && engagement > 0.5) {
      const lockFactor = clamp((engagement - 0.5) / 0.4, 0, 1)
      const slipFactor = clamp(Math.abs(slipSpeed) / 20, 0, 1)
      const directFactor = lockFactor * (1 - slipFactor)
      torque = (1 - directFactor) * dynamicTorque + directFactor * engineTorque
      torque = clamp(torque, -frictionCapacity, frictionCapacity)
    }

    const isSlipping = Math.abs(slipSpeed) > 5.0 && engagement > 0.05 && engagement < 0.95

    return {
      position: this.position,
      engagement,
      isSlipping,
      transmittedTorque: torque,
    }
  }

  reset(): void {
    this.position = 0
  }
}
