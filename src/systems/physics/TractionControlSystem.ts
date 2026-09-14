import type { DrivingMode } from '@/types'
import { clamp } from '@/utils/math'

export interface TractionControlConfig {
  enabled: boolean
  slipThresholdEco?: number     // ex: 0.08 (8% escorregamento)
  slipThresholdNormal?: number  // ex: 0.14 (14% escorregamento)
  slipThresholdSport?: number   // ex: 0.24 (24% escorregamento)
  torqueReductionGain?: number  // quão rápido corta o torque sob slip excessivo
}

export interface TcsInput {
  wheelTorque: number           // Nm calculado antes da roda
  wheelSpeedKmh: number         // velocidade periférica da roda (km/h)
  vehicleSpeedKmh: number       // velocidade real do chassi (km/h)
  drivingMode: DrivingMode
  maxGripTorque: number         // torque máximo que o atrito estático do pneu suporta
  deltaTime: number
}

export interface TcsResult {
  effectiveWheelTorque: number  // torque final liberado para a física da roda (Nm)
  interventionLevel: number     // 0 (sem intervenção) a 1 (máxima intervenção)
  isIntervening: boolean        // se está cortando ativamente (para UI/dashboard)
  slipRatio: number             // razão de escorregamento calculada
}

/**
 * TractionControlSystem (TCS) — Controle Ativo e Modular de Tração.
 *
 * Princípio físico:
 * - O pneu transmite força enquanto a velocidade da roda estiver próxima à velocidade linear do veículo.
 * - Quando wheelTorque > maxGripTorque, a roda começa a patinar (wheel spin).
 * - O TCS calcula a razão de escorregamento (Slip Ratio): s = (v_roda - v_carro) / max(v_roda, 10).
 * - Quando 's' supera a tolerância do modo de condução (ECO rígido, NORMAL equilibrado, SPORT permissivo),
 *   o sistema atua modulando progressivamente o torque liberado às rodas para restabelecer a aderência.
 * - Não é um limitador estúpido de acelerador: permite 100% de throttle contanto que haja atrito suficiente.
 */
export class TractionControlSystem {
  private enabled: boolean = true
  private interventionLevel: number = 0 // filtro passa-baixa para intervenção suave (0 a 1)

  private readonly slipThresholdEco: number
  private readonly slipThresholdNormal: number
  private readonly slipThresholdSport: number
  private readonly torqueReductionGain: number

  constructor(config?: TractionControlConfig) {
    this.enabled = config?.enabled ?? true
    this.slipThresholdEco = config?.slipThresholdEco ?? 0.08
    this.slipThresholdNormal = config?.slipThresholdNormal ?? 0.14
    this.slipThresholdSport = config?.slipThresholdSport ?? 0.24
    this.torqueReductionGain = config?.torqueReductionGain ?? 6.0
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.interventionLevel = 0
    }
  }

  getIsEnabled(): boolean {
    return this.enabled
  }

  /**
   * Processa a intervenção do TCS para o frame atual.
   */
  process(input: TcsInput): TcsResult {
    const { wheelTorque, wheelSpeedKmh, vehicleSpeedKmh, drivingMode, maxGripTorque, deltaTime } = input

    // Se o torque for negativo (freio motor/frenagem) ou tração nula, não há slip de aceleração
    if (wheelTorque <= 0) {
      this.interventionLevel = Math.max(0, this.interventionLevel - 8.0 * deltaTime)
      return {
        effectiveWheelTorque: wheelTorque,
        interventionLevel: 0,
        isIntervening: false,
        slipRatio: 0,
      }
    }

    // Se o TCS estiver desativado pelo usuário (TCS OFF)
    if (!this.enabled) {
      this.interventionLevel = 0
      const slipSpeed = Math.max(0, wheelSpeedKmh - vehicleSpeedKmh)
      const slipRatio = slipSpeed / Math.max(12, wheelSpeedKmh)
      return {
        effectiveWheelTorque: wheelTorque, // Entrega torque total sem modulação
        interventionLevel: 0,
        isIntervening: false,
        slipRatio,
      }
    }

    // 1. Cálculo da Velocidade e Razão de Escorregamento (Slip Ratio)
    const slipSpeed = Math.max(0, wheelSpeedKmh - vehicleSpeedKmh)
    const refSpeed = Math.max(10, wheelSpeedKmh, vehicleSpeedKmh)
    const slipRatio = slipSpeed / refSpeed

    // 2. Limiar de tolerância baseado no modo de condução
    let threshold: number
    switch (drivingMode) {
      case 'eco':
        threshold = this.slipThresholdEco // Muito conservador: não tolera perda
        break
      case 'sport':
        threshold = this.slipThresholdSport // Permite leve patinada para largadas fortes
        break
      case 'normal':
      default:
        threshold = this.slipThresholdNormal // Equilíbrio dinâmico
        break
    }

    // 3. Detecção de Excesso de Tração vs Aderência do Solo
    const torqueExcessRatio = maxGripTorque > 0 ? wheelTorque / maxGripTorque : 1.0

    // O TCS deve intervir se o slip passar do limiar OU se o torque solicitado superar a aderência disponível
    let targetIntervention = 0
    if (slipRatio > threshold) {
      const excessSlip = (slipRatio - threshold) / (1.0 - threshold)
      targetIntervention = clamp(excessSlip * 1.5, 0, 1)
    } else if (torqueExcessRatio > 1.05 && wheelSpeedKmh > 2) {
      const excessTorque = (torqueExcessRatio - 1.05) / 1.0
      targetIntervention = clamp(excessTorque * 0.8, 0, 1)
    }

    // 4. Modulação progressiva da intervenção (ataque rápido, liberação suave)
    if (targetIntervention > this.interventionLevel) {
      this.interventionLevel += (targetIntervention - this.interventionLevel) * Math.min(1, this.torqueReductionGain * 2.5 * deltaTime)
    } else {
      this.interventionLevel += (targetIntervention - this.interventionLevel) * Math.min(1, 4.0 * deltaTime)
    }
    this.interventionLevel = clamp(this.interventionLevel, 0, 1)

    // 5. Cálculo do Torque Efetivo entregue às rodas
    const isIntervening = this.interventionLevel > 0.04
    let effectiveWheelTorque = wheelTorque

    if (isIntervening && wheelTorque > maxGripTorque) {
      const excess = wheelTorque - maxGripTorque
      effectiveWheelTorque = wheelTorque - excess * this.interventionLevel
    } else if (isIntervening) {
      effectiveWheelTorque = wheelTorque * (1 - this.interventionLevel * 0.4)
    }

    return {
      effectiveWheelTorque: Math.max(0, effectiveWheelTorque),
      interventionLevel: this.interventionLevel,
      isIntervening,
      slipRatio,
    }
  }

  reset(): void {
    this.interventionLevel = 0
  }
}
