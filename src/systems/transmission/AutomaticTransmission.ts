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
   * Determina as faixas de RPM de subida (upshift) e descida (downshift) de acordo com o
   * perfil de condução (ECO, NORMAL, SPORT, TRACK) e nível de aceleração (throttle).
   */
  private getTargetRpmBand(drivingMode: DrivingMode, throttle: number): {
    min: number
    max: number
    downshiftThreshold: number
  } {
    const { maxRpm } = this.config

    // ─── PISOU FUNDO / KICKDOWN (throttle >= 0.85) em QUALQUER MODO ───
    // Todo carro automático real (DSG, PDK, CVT) sob aceleração plena estica as marchas
    // até a faixa de potência máxima / próximo ao redline, independente do modo de condução ativo.
    if (throttle >= 0.85) {
      const kickdownUpshiftRpm = this.config.isCvt
        ? Math.min(this.config.maxRpm * 0.89, 5700)
        : Math.min(maxRpm * 0.94, maxRpm - 350)
      const kickdownDownshiftRpm = maxRpm * 0.58
      return {
        min: 2400,
        max: kickdownUpshiftRpm,
        downshiftThreshold: kickdownDownshiftRpm,
      }
    }

    switch (drivingMode) {
      case 'eco': {
        // ECO: Trocas antecipadas para máxima economia de combustível
        const minTarget = 1500 + throttle * 600
        const maxTarget = 2000 + throttle * 900
        const downshiftThreshold = 1350 + throttle * 350
        return {
          min: minTarget,
          max: Math.min(maxTarget, maxRpm * 0.70),
          downshiftThreshold,
        }
      }

      case 'sport':
      case 'track': {
        // SPORT / TRACK: Rotação alta para resposta imediata
        // Exemplo: se troca em ~6000 RPM, ao descer de ~4000 RPM reduz a marcha
        const minTarget = 3600 + throttle * 1200
        const maxTarget = 5400 + throttle * 1200
        const downshiftThreshold = 4000 + throttle * 400
        return {
          min: minTarget,
          max: Math.min(maxTarget, maxRpm * 0.95),
          downshiftThreshold: Math.min(downshiftThreshold, maxRpm * 0.65),
        }
      }

      case 'normal':
      default: {
        // NORMAL: Equilíbrio urbano e rodoviário
        // Exemplo: se o carro muda de marcha a ~3000 RPM, reduz ao descer de ~2000 RPM
        const minTarget = 1900 + throttle * 800
        const maxTarget = 2700 + throttle * 900
        const downshiftThreshold = 2000 + throttle * 350
        return {
          min: minTarget,
          max: Math.min(maxTarget, maxRpm * 0.82),
          downshiftThreshold,
        }
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

    // Se estiver em Park (-2) ou ponto morto (0), não realiza trocas automáticas para frente
    if (currentGear === -2 || currentGear === 0) {
      return {
        targetGear: currentGear,
        targetClutchEngagement: 0,
        isKickdown: false,
        targetRpm: this.config.idleRpm,
      }
    }

    // Se estiver em marcha ré (-1), mantém ré com acoplamento automático do conversor
    if (currentGear === -1) {
      return {
        targetGear: -1,
        targetClutchEngagement,
        isKickdown: false,
        targetRpm: currentRpm,
      }
    }

    // ─── 2. Detecção de KICKDOWN (prioridade máxima — sobrepõe cooldown) ───
    // Pressionamento forte do acelerador (>= 85%): reduz para a menor marcha se o giro atual
    // ainda estiver baixo/médio e a marcha menor colocar o motor na faixa de potência sem sobregiro
    if (isThrottleAggressive && vehicleSpeedKmh > 8 && currentGear > 1) {
      for (let testGear = 1; testGear < currentGear; testGear++) {
        const projectedRpm = this.speedToRpm(vehicleSpeedKmh, testGear)
        // Só reduz via kickdown se a marcha menor cair em até 86% do giro máximo e der ganho substancial de giro
        if (projectedRpm <= this.config.maxRpm * 0.86 && projectedRpm > currentRpm + 500) {
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
    const shiftCooldown = 0.75
    if (this.shiftTimer < shiftCooldown) {
      return {
        targetGear: currentGear,
        targetClutchEngagement,
        isKickdown: false,
        targetRpm: currentRpm,
      }
    }

    const { max: targetMaxRpm, downshiftThreshold } = this.getTargetRpmBand(drivingMode, throttle)

    // ─── 3. REDUÇÃO AUTOMÁTICA (Downshift) POR VELOCIDADE / ROTAÇÃO ───
    if (currentGear > 1) {
      const lowerGear = currentGear - 1
      const projectedRpm = this.speedToRpm(vehicleSpeedKmh, lowerGear)

      // Se a rotação cair abaixo do threshold do modo (ex: 2000 no normal, 4000 no sport)
      // OU se o veículo estiver quase parando (< 8 km/h):
      if ((currentRpm <= downshiftThreshold || vehicleSpeedKmh < 8) && projectedRpm < this.config.maxRpm * 0.94) {
        this.shiftTimer = 0
        return {
          targetGear: lowerGear,
          targetClutchEngagement: 1.0,
          isKickdown: false,
          targetRpm: projectedRpm,
        }
      }
    }

    // ─── 4. SUBIDA DE RELAÇÃO (Upshift) ───
    if (currentGear < maxGear) {
      // Se o RPM ultrapassou o alvo do modo atual e não estamos com freio pressionado
      if (currentRpm >= targetMaxRpm && brake < 0.1) {
        const higherGear = currentGear + 1
        const projectedRpm = this.speedToRpm(vehicleSpeedKmh, higherGear)
        // Só sobe se a próxima marcha não for cair abaixo da marcha lenta segura
        if (projectedRpm >= this.config.idleRpm * 1.35) {
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
