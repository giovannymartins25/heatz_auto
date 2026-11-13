import type { DrivingMode, SelectorPosition } from '@/types'
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
  selectorPosition?: SelectorPosition
  maxPowerRpm?: number
  maxTorqueRpm?: number
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
   * perfil de condução (ECO, NORMAL, SPORT, TRACK), posição do seletor (D, S) e nível de aceleração (throttle).
   *
   * Separação estrita entre:
   * - Posição física do seletor: D vs S
   * - Modo de condução: ECO, NORMAL, SPORT, TRACK
   * - Matriz de estratégia:
   *   * D + NORMAL: Convencional (~2.850-3.200 RPM upshift, ~1.950-2.100 RPM downshift)
   *   * D + SPORT ou S + NORMAL: Esportiva (~5.200-5.800 RPM upshift, ~3.800-4.200 RPM downshift)
   *   * S + SPORT: Desempenho Máximo (troca na faixa de potência ideal sem ficar desnecessariamente no limitador)
   *   * D + ECO: Econômica (~2.050-2.350 RPM upshift, ~1.350-1.550 RPM downshift)
   */
  private getTargetRpmBand(
    drivingMode: DrivingMode,
    selectorPosition: SelectorPosition = 'D',
    throttle: number,
    maxPowerRpm?: number,
  ): {
    min: number
    max: number
    downshiftThreshold: number
  } {
    const { maxRpm } = this.config
    const isSelectorSport = selectorPosition === 'S'
    const isModeSport = drivingMode === 'sport' || drivingMode === 'track'
    const isEco = drivingMode === 'eco' && !isSelectorSport

    // 10.4 S + SPORT: Desempenho Máximo
    if (isSelectorSport && isModeSport) {
      const peakPowerRpm = maxPowerRpm && maxPowerRpm > 3000 ? maxPowerRpm : maxRpm * 0.9
      const targetUpshift = Math.min(
        maxRpm - 150,
        throttle > 0.75 ? peakPowerRpm + 120 + throttle * 180 : peakPowerRpm - 300 + throttle * 350,
      )
      const downshiftTarget = Math.max(
        3800,
        Math.min(targetUpshift - 1200, peakPowerRpm - 1800 + throttle * 600),
      )
      return {
        min: 3600 + throttle * 500,
        max: targetUpshift,
        downshiftThreshold: downshiftTarget,
      }
    }

    // 10.2 / 10.5 D + SPORT ou S + NORMAL: Estratégia Esportiva
    if (isSelectorSport || isModeSport) {
      const minTarget = 3800 + throttle * 400
      const maxTarget = 5500 + throttle * 400
      const downshiftThreshold = 4000 + throttle * 250
      return {
        min: minTarget,
        max: Math.min(maxTarget, maxRpm * 0.92),
        downshiftThreshold: Math.min(downshiftThreshold, maxRpm * 0.70),
      }
    }

    // 10.1 D + ECO: Estratégia Econômica
    if (isEco) {
      const minTarget = 1500 + throttle * 300
      const maxTarget = 2050 + throttle * 300
      const downshiftThreshold = 1350 + throttle * 200
      return {
        min: minTarget,
        max: Math.min(maxTarget, maxRpm * 0.65),
        downshiftThreshold,
      }
    }

    // 10.1 D + NORMAL: Estratégia Convencional
    const minTarget = 1900 + throttle * 300
    const maxTarget = 2850 + throttle * 350
    const downshiftThreshold = 1950 + throttle * 550
    return {
      min: minTarget,
      max: Math.min(maxTarget, maxRpm * 0.75),
      downshiftThreshold,
    }
  }

  /**
   * Executa a lógica de decisão de troca da transmissão automática.
   */
  decide(input: AutoShiftInput): AutoShiftDecision {
    const {
      currentRpm,
      vehicleSpeedKmh,
      throttle,
      brake,
      currentGear,
      drivingMode,
      selectorPosition = 'D',
      maxPowerRpm,
      deltaTime,
    } = input
    const maxGear = this.config.gearRatios.length

    this.shiftTimer += deltaTime

    // ─── 1. Acoplamento Automático (Embreagem Interna / Conversor de Torque do CVT) ───
    let targetClutchEngagement = 1.0
    if (vehicleSpeedKmh < 3 && throttle < 0.05 && brake > 0.1) {
      // Parado no semáforo com o pé no freio: desacopla para o motor não morrer
      targetClutchEngagement = 0.0
    } else if (vehicleSpeedKmh < 22) {
      // Arrancada com conversor de torque / embreagem CVT:
      // Permite o motor subir de giro livremente em direção ao alvo do modo de condução
      const { min: targetMinRpm } = this.getTargetRpmBand(drivingMode, selectorPosition, throttle, maxPowerRpm)
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

    // Sem kickdown forçado: acelerador alto (80%+/100%) NUNCA pula aleatoriamente para o redline.

    // Se acabou de trocar, aguarda histerese mínima para evitar trocas intermitentes normais
    const shiftCooldown = 0.75
    const rpmBandMax = this.getTargetRpmBand(drivingMode, selectorPosition, throttle, maxPowerRpm).max
    const mustUpshiftSoon = currentRpm >= rpmBandMax && this.shiftTimer >= 0.3
    if (this.shiftTimer < shiftCooldown && !mustUpshiftSoon) {
      return {
        targetGear: currentGear,
        targetClutchEngagement,
        isKickdown: false,
        targetRpm: currentRpm,
      }
    }

    const { max: targetMaxRpm, downshiftThreshold } = this.getTargetRpmBand(
      drivingMode,
      selectorPosition,
      throttle,
      maxPowerRpm,
    )

    // ─── 2. REDUÇÃO AUTOMÁTICA (Downshift) POR VELOCIDADE / ROTAÇÃO ───
    if (currentGear > 1) {
      const lowerGear = currentGear - 1
      const projectedRpm = this.speedToRpm(vehicleSpeedKmh, lowerGear)

      // Regra de segurança para a 1ª marcha:
      // Em veículos reais, a 1ª marcha é exclusiva para arrancar da imobilidade.
      // Nunca reduz de 2ª para 1ª marcha em movimento (>= 12 km/h) ao pisar no acelerador.
      const allowDownshiftToFirst = lowerGear > 1 || vehicleSpeedKmh < 12

      // Se a rotação cair abaixo do threshold do modo (ex: ~2000 no normal, ~4000 no sport)
      // OU se o veículo estiver quase parando (< 8 km/h):
      if (
        allowDownshiftToFirst &&
        (currentRpm <= downshiftThreshold || vehicleSpeedKmh < 8) &&
        projectedRpm < this.config.maxRpm * 0.94
      ) {
        this.shiftTimer = 0
        return {
          targetGear: lowerGear,
          targetClutchEngagement: 1.0,
          isKickdown: false,
          targetRpm: projectedRpm,
        }
      }
    }

    // ─── 3. SUBIDA DE RELAÇÃO (Upshift) ───
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
  }
}
