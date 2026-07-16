import type { TransmissionConfig } from '@/types'

/**
 * GearCalculator — Cálculos de relação de marcha e velocidade.
 *
 * Funções puras (sem estado) para converter entre RPM e velocidade
 * baseado nas relações de marcha e diferencial do veículo.
 */
export class GearCalculator {
  private readonly config: TransmissionConfig
  private readonly wheelCircumference: number

  constructor(config: TransmissionConfig, wheelDiameter: number) {
    this.config = config
    this.wheelCircumference = Math.PI * wheelDiameter
  }

  /** Retorna a relação de uma marcha específica. 0 = neutro, -1 = ré */
  getGearRatio(gear: number): number {
    if (gear === 0) return 0
    if (gear === -1) return this.config.reverseRatio

    const gearEntry = this.config.gearRatios.find(g => g.gear === gear)
    if (!gearEntry) return 0

    return gearEntry.ratio
  }

  /** Relação total (marcha × diferencial) */
  getTotalRatio(gear: number): number {
    const gearRatio = this.getGearRatio(gear)
    if (gearRatio === 0) return 0
    return gearRatio * this.config.finalDrive
  }

  /**
   * Calcula a velocidade (km/h) a partir do RPM e marcha.
   * speed = (rpm × wheelCircumference) / (totalRatio × 60) → convertido para km/h
   */
  rpmToSpeed(rpm: number, gear: number): number {
    const totalRatio = this.getTotalRatio(gear)
    if (totalRatio === 0) return 0

    const wheelRps = rpm / (totalRatio * 60) // rotações por segundo da roda
    const speedMs = wheelRps * this.wheelCircumference // m/s
    return speedMs * 3.6 // km/h
  }

  /**
   * Calcula o RPM a partir da velocidade (km/h) e marcha.
   * Usado para determinar o RPM correto ao trocar de marcha.
   */
  speedToRpm(speedKmh: number, gear: number): number {
    const totalRatio = this.getTotalRatio(gear)
    if (totalRatio === 0) return 0

    const speedMs = speedKmh / 3.6
    const wheelRps = speedMs / this.wheelCircumference
    return wheelRps * totalRatio * 60
  }

  /** Velocidade máxima teórica na marcha mais alta no RPM máximo */
  getMaxSpeed(maxRpm: number): number {
    const topGear = this.config.gearCount
    return this.rpmToSpeed(maxRpm, topGear)
  }
}
