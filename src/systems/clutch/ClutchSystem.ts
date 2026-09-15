import { clamp } from '@/utils/math'
import { RAD_S_TO_RPM } from '../engine/constants'

export interface ClutchState {
  position: number            // 0 = pedal solto / acoplada, 1 = pedal pressionado / desacoplada
  engagement: number          // 0 = livre/desacoplada, 1 = 100% acoplada
  isSlipping: boolean         // true se houver patinação ativa sob carga
  transmittedTorque: number   // Nm transmitido para o eixo da transmissão
  loadTorqueOnEngine: number  // Nm de carga resistiva imposta ao volante do motor
  slipRpm: number             // diferença de rotação (RPM) entre motor e transmissão
  slipRatio: number           // razão relativa de patinamento (0 a 1)
  heat: number                // energia térmica acumulada (preparada para futuro desgaste)
}

/**
 * ClutchSystem — Modela fisicamente o disco de embreagem por fricção.
 *
 * Conecta o volante do motor (virabrequim) ao eixo primário da transmissão.
 * - 0% (pedal solto): 100% acoplada (transmissão direta de torque).
 * - 100% (pedal pressionado): 0% acoplada (motor gira livre, 0 torque às rodas).
 * - Zona de atrito (15% a 85%): transferência progressiva com deslizamento (slip),
 *   produção de carga sobre o motor e dissipação térmica.
 */
export class ClutchSystem {
  private position: number = 0 // 0 a 1 (0 = solta/acoplada, 1 = pressionada/desacoplada)
  private readonly maxTorqueCapacity: number
  private heat: number = 0 // Calor acumulado em kJ (aproximado)

  constructor(maxEngineTorque: number) {
    // Capacidade máxima de atrito do disco (~1.4x o torque máximo do motor)
    this.maxTorqueCapacity = Math.max(50, maxEngineTorque * 1.4)
  }

  /** Define a posição do pedal/manete de embreagem (0 a 1) */
  setPosition(pos: number): void {
    this.position = clamp(pos, 0, 1)
  }

  getPosition(): number {
    return this.position
  }

  /**
   * Retorna o fator de acoplamento mecânico (1 = 100% acoplada, 0 = desacoplada).
   *
   * Curva progressiva realista:
   * - 0.00 a 0.15: Folga inicial / 100% acoplada
   * - 0.15 a 0.85: Zona de atrito/patinação progressiva (curva não-linear)
   * - 0.85 a 1.00: Desacoplamento total
   */
  getEngagement(): number {
    if (this.position <= 0.15) return 1.0
    if (this.position >= 0.85) return 0.0

    // Curva não-linear na zona de patinação (0.15 a 0.85)
    // 0.15 -> 1.0 (acoplada); 0.85 -> 0.0 (desacoplada)
    const normalized = (0.85 - this.position) / 0.70
    return Math.pow(normalized, 1.35)
  }

  getHeat(): number {
    return this.heat
  }

  /**
   * Calcula o torque transferido e a carga sobre o motor neste tick.
   *
   * @param engineAngularVelocity Velocidade angular do motor (rad/s)
   * @param transmissionAngularVelocity Velocidade angular do eixo primário (rad/s)
   * @param isInNeutral Se o câmbio está em ponto morto
   * @param engineTorque Torque gerado pela combustão neste frame (Nm)
   * @param deltaTime Intervalo de tempo do tick (segundos)
   */
  calculateTorqueTransfer(
    engineAngularVelocity: number,
    transmissionAngularVelocity: number,
    isInNeutral: boolean,
    engineTorque: number = 0,
    deltaTime: number = 1 / 120,
  ): ClutchState {
    const engagement = this.getEngagement()
    const engineRpm = Math.max(0, engineAngularVelocity * RAD_S_TO_RPM)
    const transRpm = Math.max(0, transmissionAngularVelocity * RAD_S_TO_RPM)
    const slipRpm = isInNeutral ? 0 : Math.abs(engineRpm - transRpm)

    // 1. Desacoplamento total ou Ponto Morto
    if (isInNeutral || engagement <= 0.001) {
      // Resfriamento gradual da embreagem
      this.coolDown(deltaTime)
      return {
        position: this.position,
        engagement: 0,
        isSlipping: false,
        transmittedTorque: 0,
        loadTorqueOnEngine: 0,
        slipRpm: 0,
        slipRatio: 0,
        heat: this.heat,
      }
    }

    // 2. Diferença de velocidade angular entre motor e transmissão (rad/s)
    const deltaOmega = engineAngularVelocity - transmissionAngularVelocity
    const slipRatio = clamp(slipRpm / Math.max(engineRpm, transRpm, 200), 0, 1)

    // Capacidade instantânea de atrito com base na pressão da placa de pressão
    const frictionCapacity = this.maxTorqueCapacity * engagement

    // 3. Torque Dinâmico de Deslizamento (Slip Torque)
    // Modulado pela rigidez de atrito do composto do disco
    const K_friction = 3.2
    let dynamicFrictionTorque = deltaOmega * K_friction * engagement
    dynamicFrictionTorque = clamp(dynamicFrictionTorque, -frictionCapacity, frictionCapacity)

    // 4. Regime Estático / Acoplamento Rígido:
    // Quando a embreagem está bem acoplada (engagement > 0.85) e a diferença de rotação é baixa (< 12 rad/s ≈ 115 RPM),
    // o conjunto entra em aderência estática (lock-up), transmitindo diretamente o torque do motor
    let transmittedTorque: number
    let loadTorqueOnEngine: number

    const isNearLock = Math.abs(deltaOmega) < 12.0 && engagement > 0.85

    if (isNearLock) {
      // Regime acoplado rígido: transfere o torque de acionamento do motor
      transmittedTorque = engineTorque
      loadTorqueOnEngine = engineTorque
    } else {
      // Regime de patinação (Slip):
      // O torque transmitido às rodas é a força de atrito dinâmico que o disco consegue passar
      transmittedTorque = Math.max(0, dynamicFrictionTorque)

      // A carga resistiva sobre o volante do motor é igual à reação do atrito dinâmico
      // Se deltaOmega > 0 (motor mais rápido que a transmissão parada), a embreagem desacelera o motor
      loadTorqueOnEngine = dynamicFrictionTorque
    }

    // Limita o torque transmitido à capacidade máxima instantânea
    transmittedTorque = clamp(transmittedTorque, 0, frictionCapacity)

    // 5. Patinação Ativa
    const isSlipping = slipRpm > 45 && engagement > 0.05 && engagement < 0.98

    // 6. Dissipação Térmica (Calor)
    // Potência dissipada no disco: P = Torque * |deltaOmega| (Watts)
    if (isSlipping || (engagement > 0.05 && Math.abs(deltaOmega) > 5)) {
      const frictionPower = Math.abs(dynamicFrictionTorque * deltaOmega) // Watts
      const heatIncrement = (frictionPower * 0.00008) * deltaTime // kJ
      this.heat = Math.min(500, this.heat + heatIncrement)
    }
    this.coolDown(deltaTime)

    return {
      position: this.position,
      engagement,
      isSlipping,
      transmittedTorque,
      loadTorqueOnEngine,
      slipRpm,
      slipRatio,
      heat: this.heat,
    }
  }

  private coolDown(deltaTime: number): void {
    if (this.heat > 0) {
      // Resfriamento exponencial em direção ao ambiente (0)
      const coolingRate = 0.035 // taxa de perda térmica por segundo
      this.heat = Math.max(0, this.heat - (this.heat * coolingRate + 0.01) * deltaTime)
    }
  }

  reset(): void {
    this.position = 0
    this.heat = 0
  }
}
