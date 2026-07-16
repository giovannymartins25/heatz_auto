import type { TorqueCurvePoint } from '@/types'
import { clamp } from '@/utils/math'

/**
 * TorqueCurve — Interpolação da curva de torque do motor.
 * 
 * Recebe os pontos da curva (RPM → Torque em Nm) definidos no JSON
 * do veículo e interpola linearmente para qualquer RPM intermediário.
 * 
 * Em motores reais, o torque varia de forma não-linear com o RPM.
 * Cada motor tem uma curva única que define seu "caráter".
 * 
 * Exemplo: o Gol G6 tem pico de torque a 3500 RPM (165 Nm),
 * enquanto a CB1000R tem pico a 8250 RPM (104 Nm) — curvas
 * completamente diferentes que resultam em comportamentos distintos.
 */
export class TorqueCurve {
  private readonly points: TorqueCurvePoint[]
  private readonly minRpm: number
  private readonly maxRpm: number

  constructor(points: TorqueCurvePoint[]) {
    if (points.length < 2) {
      throw new Error('Curva de torque precisa de pelo menos 2 pontos')
    }

    this.points = [...points].sort((a, b) => a.rpm - b.rpm)
    this.minRpm = this.points[0].rpm
    this.maxRpm = this.points[this.points.length - 1].rpm
  }

  /**
   * Retorna o torque interpolado para um dado RPM.
   * Usa interpolação linear entre os dois pontos mais próximos.
   */
  getTorqueAtRpm(rpm: number): number {
    const clampedRpm = clamp(rpm, this.minRpm, this.maxRpm)

    // Se está exatamente em um ponto da curva
    for (const point of this.points) {
      if (Math.abs(point.rpm - clampedRpm) < 0.5) {
        return point.torque
      }
    }

    // Encontrar os dois pontos vizinhos para interpolação
    let lower = this.points[0]
    let upper = this.points[1]

    for (let i = 0; i < this.points.length - 1; i++) {
      if (clampedRpm >= this.points[i].rpm && clampedRpm <= this.points[i + 1].rpm) {
        lower = this.points[i]
        upper = this.points[i + 1]
        break
      }
    }

    // Interpolação linear: t = (rpm - rpmA) / (rpmB - rpmA)
    const t = (clampedRpm - lower.rpm) / (upper.rpm - lower.rpm)
    return lower.torque + (upper.torque - lower.torque) * t
  }
}
