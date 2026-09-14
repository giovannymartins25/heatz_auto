import type { DrivingMode } from '@/types'
import { clamp } from '@/utils/math'

export interface TcsInput {
  /** Torque bruto aplicado nas rodas (Nm) — antes da intervenção do TCS */
  wheelTorque: number
  /** Torque máximo que o atrito dos pneus suporta (Nm) */
  maxGripTorque: number
  /** Razão de escorregamento detectada pela física (0 = sem slip, 1 = patinamento total) */
  slipRatio: number
  /** Modo de condução — determina o limiar de intervenção */
  drivingMode: DrivingMode
  /** Se o TCS está ativado pelo motorista */
  enabled: boolean
}

export interface TcsDecision {
  /**
   * Multiplicador de torque a ser aplicado (0.0 a 1.0).
   * 1.0 = sem intervenção (100% do torque).
   * 0.0 = bloqueio total (improvável em condições normais).
   */
  throttleMultiplier: number
  /**
   * Nível de intervenção normalizado (0 = inativo, 1 = máxima intervenção).
   * Usado para animar o indicador visual no dashboard.
   */
  interventionLevel: number
  /** Indica se o TCS está ativamente intervindo neste frame */
  isIntervening: boolean
}

/**
 * TractionControlSystem — Controle eletrônico de tração (TCS).
 *
 * O TCS detecta quando o torque nas rodas excede a aderência disponível
 * e reduz progressivamente o torque entregue para minimizar a patinação.
 *
 * NÃO é um limitador artificial de acelerador.
 * Só atua quando há perda de aderência real (slipRatio > limiar do modo).
 *
 * Limiares de intervenção por modo de condução:
 * - ECO:    slipRatio > 0.08 — intervenção conservadora
 * - NORMAL: slipRatio > 0.15 — comportamento equilibrado
 * - SPORT:  slipRatio > 0.22 — permite mais deslizamento antes de intervir
 */
export class TractionControlSystem {
  /** Multiplicador atual — suavizado para evitar oscilações bruscas */
  private currentMultiplier: number = 1.0

  /** Velocidade de recuperação do multiplier (por segundo) */
  private readonly recoveryRate: number = 1.8

  /** Velocidade de corte do multiplier (por segundo) */
  private readonly cutRate: number = 4.5

  /**
   * Retorna o limiar de escorregamento antes de intervir, baseado no modo.
   */
  private getSlipThreshold(drivingMode: DrivingMode): number {
    switch (drivingMode) {
      case 'eco':    return 0.08
      case 'sport':  return 0.22
      case 'normal':
      default:       return 0.15
    }
  }

  /**
   * Executa a lógica do TCS para um frame.
   *
   * @param input Dados do estado atual da física e configuração
   * @param deltaTime Intervalo de tempo do frame em segundos
   */
  decide(input: TcsInput, deltaTime: number): TcsDecision {
    const { slipRatio, drivingMode, enabled } = input

    // TCS desativado: sem intervenção, multiplier retorna a 1.0
    if (!enabled) {
      this.currentMultiplier = Math.min(1.0, this.currentMultiplier + this.recoveryRate * deltaTime)
      return {
        throttleMultiplier: 1.0,
        interventionLevel: 0,
        isIntervening: false,
      }
    }

    const threshold = this.getSlipThreshold(drivingMode)

    if (slipRatio > threshold) {
      // Slip acima do limiar: calcula o excesso normalizado
      const slipExcess = clamp((slipRatio - threshold) / 0.30, 0, 1)

      // Redução proporcional: quanto maior o excesso, mais forte a intervenção
      const targetMultiplier = clamp(1.0 - slipExcess * 0.75, 0.20, 0.98)

      // Aplica taxa de corte (rápida para reagir ao escorregamento)
      this.currentMultiplier = Math.max(
        targetMultiplier,
        this.currentMultiplier - this.cutRate * deltaTime,
      )
    } else {
      // Sem slip: recuperação gradual do torque (evita surge brusco)
      this.currentMultiplier = Math.min(1.0, this.currentMultiplier + this.recoveryRate * deltaTime)
    }

    const isIntervening = this.currentMultiplier < 0.99
    const interventionLevel = clamp(1.0 - this.currentMultiplier, 0, 1)

    return {
      throttleMultiplier: this.currentMultiplier,
      interventionLevel,
      isIntervening,
    }
  }

  /** Reseta o estado interno do TCS */
  reset(): void {
    this.currentMultiplier = 1.0
  }
}
