import type { DrivingMode } from '@/types'
import { clamp } from '@/utils/math'

export interface AutomaticTransmissionConfig {
  gearRatios: { gear: number; ratio: number }[]
  finalDrive: number
  wheelDiameter: number
  maxRpm: number
  idleRpm: number
  isCvt?: boolean
}

export interface AutoShiftInput {
  currentRpm: number
  vehicleSpeedKmh: number
  throttle: number
  brake: number
  currentGear: number
  drivingMode: DrivingMode
  deltaTime: number
}

export interface AutoShiftDecision {
  targetGear: number
  targetClutchEngagement: number // 0 (desacoplada) a 1 (100% acoplada)
  isKickdown: boolean
  targetRpm: number
}

/**
 * AutomaticTransmission — Sistema inteligente de transmissão automática e CVT.
 *
 * Gerencia trocas dinâmicas de relações virtuais com base no contexto:
 * - Throttle, Velocidade, RPM e Carga
 * - Perfis de condução: ECO (1800-2200 RPM), NORMAL (2500-3200 RPM), SPORT (5200-6000 RPM)
 * - Kickdown (redução agressiva em aceleração plena >= 85%)
 * - Proteção estrita contra over-rev e relações incompatíveis
 * - Acoplamento automático do conversor/CVT (evita estol ao parar)
 */
export class AutomaticTransmission {
  private readonly config: AutomaticTransmissionConfig
  private readonly wheelCircumference: number
  private shiftTimer: number = 0
  private lastThrottle: number = 0

  constructor(config: AutomaticTransmissionConfig) {
    this.config = config
    this.wheelCircumference = Math.PI * config.wheelDiameter
  }

  /**
   * Converte velocidade (km/h) para RPM teórico numa marcha/relação virtual específica.
   */
  speedToRpm(speedKmh: number, gear: number): number {
    const gearEntry = this.config.gearRatios.find((g) => g.gear === gear)
    if (!gearEntry || gearEntry.ratio === 0) return 0

    const totalRatio = gearEntry.ratio * this.config.finalDrive
    const speedMs = speedKmh / 3.6
    const wheelRps = speedMs / this.wheelCircumference
    return wheelRps * totalRatio * 60
  }

  /**
   * Determina a faixa ideal de RPM de acordo com o modo de condução e intensidade do acelerador.
   */
  private getTargetRpmBand(drivingMode: DrivingMode, throttle: number): { min: number; max: number } {
    const { maxRpm } = this.config

    switch (drivingMode) {
      case 'eco': {
        // ECO: Alvo baixo em aceleração leve (~1800-2100 RPM), sobe até ~3200 em throttle alto
        const minTarget = 1600 + throttle * 800
        const maxTarget = 1950 + throttle * 1100
        return { min: minTarget, max: Math.min(maxTarget, maxRpm * 0.70) }
      }

      case 'sport': {
        // SPORT: Mantém rotação alta para resposta imediata (4500-6000 RPM sob carga)
        const minTarget = 3400 + throttle * 2000
        const maxTarget = 4600 + throttle * 1500
        return { min: minTarget, max: Math.min(maxTarget, maxRpm * 0.96) }
      }

      case 'normal':
      default: {
        // NORMAL: Equilíbrio (~2600-3000 RPM em aceleração moderada)
        const minTarget = 1900 + throttle * 1200
        const maxTarget = 2400 + throttle * 1400
        return { min: minTarget, max: Math.min(maxTarget, maxRpm * 0.85) }
      }
    }
  }

  /**
   * Executa a lógica de decisão de troca da transmissão automática.
   */
  decide(input: AutoShiftInput): AutoShiftDecision {
    const { currentRpm, vehicleSpeedKmh, throttle, brake, currentGear, drivingMode, deltaTime } = input
    const maxGear = this.config.gearRatios.length

    this.shiftTimer += deltaTime
    const isThrottleAggressive = throttle >= 0.85 || (throttle - this.lastThrottle > 0.4 && throttle > 0.6)
    this.lastThrottle = throttle

    // ─── 1. Acoplamento Automático (Embreagem Interna / Conversor de Torque do CVT) ───
    let targetClutchEngagement = 1.0
    if (vehicleSpeedKmh < 3 && throttle < 0.05 && brake > 0.1) {
      // Parado no semáforo com o pé no freio: desacopla para o motor não morrer
      targetClutchEngagement = 0.0
    } else if (vehicleSpeedKmh < 22) {
      // Arrancada com conversor de torque / embreagem CVT:
      // Permite o motor subir de giro livremente em direção ao alvo do modo de condução
      const { min: targetMinRpm } = this.getTargetRpmBand(drivingMode, throttle)
      const targetLaunchRpm = Math.max(2000, targetMinRpm)
      const rpmRatio = clamp((currentRpm - this.config.idleRpm) / (targetLaunchRpm - this.config.idleRpm), 0, 1)
      const speedRatio = clamp(vehicleSpeedKmh / 22, 0, 1)
      targetClutchEngagement = clamp(Math.pow(rpmRatio, 3.0) * 0.72 + speedRatio * 0.28, 0.05, 0.98)
    }

    // Se estiver em ponto morto (neutro), não realiza trocas automáticas
    if (currentGear === 0) {
      return {
        targetGear: 0,
        targetClutchEngagement: 0,
        isKickdown: false,
        targetRpm: this.config.idleRpm,
      }
    }

    // ─── 2. Detecção de KICKDOWN (prioridade máxima — sobrepõe cooldown) ───
    // Pressionamento forte do acelerador (>= 85%): reduz para a menor marcha virtual segura
    if (isThrottleAggressive && vehicleSpeedKmh > 5 && currentGear > 1) {
      for (let testGear = 1; testGear < currentGear; testGear++) {
        const projectedRpm = this.speedToRpm(vehicleSpeedKmh, testGear)
        // Só reduz se o giro não ultrapassar a faixa de segurança (94% do redline)
        if (projectedRpm < this.config.maxRpm * 0.94) {
          this.shiftTimer = 0
          return {
            targetGear: testGear,
            targetClutchEngagement: 1.0,
            isKickdown: true,
            targetRpm: projectedRpm,
          }
        }
      }
    }

    // Se acabou de trocar, aguarda histerese mínima para evitar trocas intermitentes normais
    const shiftCooldown = 1.0
    if (this.shiftTimer < shiftCooldown) {
      return {
        targetGear: currentGear,
        targetClutchEngagement,
        isKickdown: false,
        targetRpm: currentRpm,
      }
    }

    const { max: targetMaxRpm } = this.getTargetRpmBand(drivingMode, throttle)

    // ─── 3. REDUÇÃO AUTOMÁTICA (Downshift) POR VELOCIDADE / SUB-ROTAÇÃO ───
    if (currentGear > 1) {
      const currentTheoreticalRpm = this.speedToRpm(vehicleSpeedKmh, currentGear)
      // Só reduz se a rotação cair perto da marcha lenta para evitar bater pino / sub-rotação
      const downshiftThreshold = Math.max(1100, this.config.idleRpm * 1.35)
      if (currentTheoreticalRpm < downshiftThreshold) {
        const lowerGear = currentGear - 1
        const projectedRpm = this.speedToRpm(vehicleSpeedKmh, lowerGear)
        if (projectedRpm < this.config.maxRpm * 0.92) {
          this.shiftTimer = 0
          return {
            targetGear: lowerGear,
            targetClutchEngagement: 1.0,
            isKickdown: false,
            targetRpm: projectedRpm,
          }
        }
      }
    }

    // ─── 4. SUBIDA DE RELAÇÃO (Upshift) ───
    if (currentGear < maxGear) {
      // Se o RPM ultrapassou o alvo do modo atual e não estamos com freio pressionado
      if (currentRpm > targetMaxRpm && brake < 0.1) {
        const higherGear = currentGear + 1
        const projectedRpm = this.speedToRpm(vehicleSpeedKmh, higherGear)
        // Só sobe se a próxima marcha não for cair para uma rotação excessivamente baixa
        if (projectedRpm > this.config.idleRpm * 1.3) {
          this.shiftTimer = 0
          return {
            targetGear: higherGear,
            targetClutchEngagement: 1.0,
            isKickdown: false,
            targetRpm: projectedRpm,
          }
        }
      }
    }

    return {
      targetGear: currentGear,
      targetClutchEngagement,
      isKickdown: false,
      targetRpm: currentRpm,
    }
  }

  reset(): void {
    this.shiftTimer = 0
    this.lastThrottle = 0
  }
}
