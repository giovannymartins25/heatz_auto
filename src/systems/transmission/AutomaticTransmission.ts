import type { DrivingMode, SelectorPosition } from '@/types'
import type { FourWheelDriveMode } from '@/systems/physics'
import { clamp } from '@/utils/math'

export interface AutomaticTransmissionConfig {
  gearRatios: { gear: number; ratio: number }[]
  finalDrive: number
  wheelDiameter: number
  maxRpm: number
  idleRpm: number
  revLimiter?: number
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
  fourWheelDriveMode?: FourWheelDriveMode
  maxPowerRpm?: number
  maxTorqueRpm?: number
  revLimiter?: number
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
  private lastShiftDirection: 'up' | 'down' | 'none' = 'none'
  private prevThrottle: number = 0
  private shiftCount: number = 0
  private coastingTimer: number = 0

  constructor(config: AutomaticTransmissionConfig) {
    this.config = config
    this.wheelCircumference = Math.PI * config.wheelDiameter
  }

  private getGearRatio(gear: number): number {
    return this.config.gearRatios.find((g) => g.gear === gear)?.ratio ?? 0
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
   *   * S + SPORT: Desempenho Máximo no Corte de Giro (Upshift no limitador / redline)
   *   * D + ECO: Econômica (~2.050-2.350 RPM upshift, ~1.350-1.550 RPM downshift)
   */
  private getTargetRpmBand(
    drivingMode: DrivingMode,
    selectorPosition: SelectorPosition = 'D',
    throttle: number,
    _maxPowerRpm?: number,
    revLimiterRpm?: number,
  ): {
    min: number
    max: number
    downshiftThreshold: number
  } {
    const { maxRpm } = this.config
    const cutoffRpm = revLimiterRpm || this.config.revLimiter || maxRpm
    const isSelectorSport = selectorPosition === 'S'
    const isModeSport = drivingMode === 'sport' || drivingMode === 'track'
    const isEco = drivingMode === 'eco' && !isSelectorSport

    // 10.4 S + SPORT: Desempenho Máximo / Troca no Corte de Giro (Redline / Rev Limiter)
    if (isSelectorSport && isModeSport) {
      // Sob aceleração esportiva (throttle >= 0.40), estica tudo até o corte de giro com margem mínima de 25 RPM
      // Sob aceleração moderada (< 0.40), mantém giro alto escalonado
      const targetUpshift =
        throttle >= 0.40
          ? cutoffRpm - 25
          : Math.min(cutoffRpm - 25, Math.max(3800, cutoffRpm * 0.72 + throttle * (cutoffRpm * 0.26)))

      const downshiftTarget = Math.max(
        Math.min(3800, cutoffRpm * 0.58),
        cutoffRpm * 0.52 + throttle * 450,
      )

      return {
        min: Math.min(3600 + throttle * 500, cutoffRpm * 0.70),
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
      fourWheelDriveMode = 'auto',
      maxPowerRpm,
      revLimiter,
      deltaTime,
    } = input
    const maxGear = this.config.gearRatios.length
    const hasCrawlerFirstGear = this.config.gearRatios.length === 9 && (this.config.gearRatios[0]?.ratio ?? 0) >= 4.5
    const is4wdLow = fourWheelDriveMode === '4wd_low'
    const cutoffRpm = revLimiter || this.config.revLimiter || this.config.maxRpm
    const isSelectorSport = selectorPosition === 'S'
    const isModeSport = drivingMode === 'sport' || drivingMode === 'track'
    const isSportCutoff = isSelectorSport && isModeSport

    // Em transmissões ZF 9HP com 1ª marcha ultracurta (crawler ratio 4.700:1):
    // No modo D convencional (AUTO ou 4WD LOCK) sob condução suave (throttle <= 0.50), a arrancada padrão é em 2ª marcha (2.840:1).
    // No modo S (Sport), em 4WD LOW ou sob aceleração forte em D (throttle > 0.50), a arrancada utiliza a 1ª marcha com força total.
    if (
      selectorPosition === 'D' &&
      hasCrawlerFirstGear &&
      !is4wdLow &&
      currentGear === 1 &&
      vehicleSpeedKmh < 8 &&
      throttle <= 0.50
    ) {
      return {
        targetGear: 2,
        targetClutchEngagement: 1.0,
        isKickdown: false,
        targetRpm: this.speedToRpm(vehicleSpeedKmh, 2) || currentRpm,
      }
    }

    this.shiftTimer += deltaTime
    const throttleDelta = throttle - this.prevThrottle
    this.prevThrottle = throttle
    if (throttle < 0.08) {
      this.coastingTimer += deltaTime
    } else {
      this.coastingTimer = 0
    }

    // ─── 1. Acoplamento Automático (Embreagem Interna / Conversor de Torque do CVT) ───
    let targetClutchEngagement = 1.0
    if (vehicleSpeedKmh < 3 && throttle < 0.05 && brake > 0.1) {
      // Parado no semáforo com o pé no freio: desacopla para o motor não morrer
      targetClutchEngagement = 0.0
    } else if (vehicleSpeedKmh < 8 || currentRpm < this.config.idleRpm * 1.18) {
      // Arrancada suave e proteção anti-estol ao parar; acima de 8 km/h mantém acoplado para freio motor
      const { min: targetMinRpm } = this.getTargetRpmBand(drivingMode, selectorPosition, throttle, maxPowerRpm, cutoffRpm)
      const targetLaunchRpm = Math.max(1850, Math.min(targetMinRpm, 2400))
      const rpmRatio = clamp((currentRpm - this.config.idleRpm) / (targetLaunchRpm - this.config.idleRpm), 0, 1)
      const speedRatio = clamp(vehicleSpeedKmh / 14, 0, 1)
      targetClutchEngagement = clamp(Math.pow(rpmRatio, 2.2) * 0.60 + speedRatio * 0.40, 0.05, 0.98)
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

    const { max: targetMaxRpm, downshiftThreshold } = this.getTargetRpmBand(
      drivingMode,
      selectorPosition,
      throttle,
      maxPowerRpm,
      cutoffRpm,
    )

    const isContinuousLoop = deltaTime < 0.5
    const minSameDirCooldown = 0.65
    const minReverseDirCooldown = 0.95
    const isEmergencyLowRpm = currentGear > 1 && currentRpm < this.config.idleRpm * 1.15 && this.shiftTimer >= 0.20
    const overRevDangerThreshold = isSportCutoff ? cutoffRpm - 20 : this.config.maxRpm * 0.94
    const isOverRevDanger = currentGear < maxGear && currentRpm >= overRevDangerThreshold && this.shiftTimer >= 0.20
    const isRapidStomp = throttle >= 0.90 && throttleDelta >= 0.28

    if (
      isContinuousLoop &&
      this.shiftCount > 0 &&
      this.shiftTimer < minSameDirCooldown &&
      !isEmergencyLowRpm &&
      !isOverRevDanger &&
      !(isRapidStomp && this.shiftTimer >= 0.30)
    ) {
      return {
        targetGear: currentGear,
        targetClutchEngagement,
        isKickdown: false,
        targetRpm: currentRpm,
      }
    }

    // ─── 2. REDUÇÃO POR KICKDOWN E REDUÇÃO NORMAL COM HISTERESE ANTI-HUNTING ───
    if (currentGear > 1) {
      const lowerGear = currentGear - 1
      const ratioCurrent = this.getGearRatio(currentGear)
      const ratioLower = this.getGearRatio(lowerGear)
      const gearStepRatio = ratioCurrent / Math.max(0.1, ratioLower)
      const speedProjectedRpm = this.speedToRpm(vehicleSpeedKmh, lowerGear)
      const projectedRpm =
        speedProjectedRpm > 0 ? speedProjectedRpm : currentRpm / Math.max(0.1, gearStepRatio)

      // Nunca reduz para 1ª marcha em movimento elevado (>= 12 km/h);
      // Em transmissões com 1ª crawler (ZF 9HP):
      // - Em S (Sport), desce para 1ª marcha ao desacelerar/parar (< 10 km/h) para arrancada esportiva;
      // - Em 4WD LOW ou modo M, reduz para 1ª crawler;
      // - Em D, mantém 2ª marcha ao parar, exceto sob kickdown ou aceleração forte (throttle > 0.50).
      const allowDownshiftToFirst =
        lowerGear > 1 ||
        (vehicleSpeedKmh < 12 && (
          !hasCrawlerFirstGear ||
          is4wdLow ||
          selectorPosition === 'M' ||
          selectorPosition === 'S' ||
          (selectorPosition === 'D' && throttle > 0.50)
        ))

      // Kickdown intencional quando o motorista pisa fundo em marcha alta (3ª+) e há margem útil antes do upshift
      const wantsKickdown =
        currentGear >= 3 &&
        (isRapidStomp || (throttle >= 0.92 && this.lastShiftDirection !== 'up' && currentRpm < targetMaxRpm * 0.62)) &&
        (this.lastShiftDirection !== 'up' || this.shiftTimer >= 0.70)

      if (
        wantsKickdown &&
        allowDownshiftToFirst &&
        projectedRpm >= this.config.idleRpm * 1.35 &&
        projectedRpm <= Math.min(this.config.maxRpm * 0.86, targetMaxRpm - 250)
      ) {
        this.shiftTimer = 0
        this.lastShiftDirection = 'down'
        this.shiftCount += 1
        return {
          targetGear: lowerGear,
          targetClutchEngagement: 1.0,
          isKickdown: true,
          targetRpm: projectedRpm,
        }
      }

      const reverseBlocked =
        isContinuousLoop && this.lastShiftDirection === 'up' && this.shiftTimer < minReverseDirCooldown
      // Limiar consciente da razão entre marchas: garante que o RPM pós-upshift nunca caia dentro da zona de downshift
      const hysteresisDownshiftCeiling = (targetMaxRpm - 320) * gearStepRatio
      const effectiveDownshiftRpm = isContinuousLoop
        ? Math.min(downshiftThreshold, hysteresisDownshiftCeiling)
        : downshiftThreshold
      const maxSafeProjectedRpm = isContinuousLoop
        ? Math.min(this.config.maxRpm * 0.85, targetMaxRpm - 260)
        : this.config.maxRpm * 0.94

      const shouldNormalDownshift =
        isEmergencyLowRpm ||
        vehicleSpeedKmh < 8 ||
        (hasCrawlerFirstGear && selectorPosition === 'S' && vehicleSpeedKmh < 10) ||
        (hasCrawlerFirstGear && selectorPosition === 'D' && throttle > 0.50 && vehicleSpeedKmh < 10) ||
        (currentRpm <= effectiveDownshiftRpm && projectedRpm <= maxSafeProjectedRpm)

      if (
        allowDownshiftToFirst &&
        (!reverseBlocked || isEmergencyLowRpm) &&
        shouldNormalDownshift &&
        projectedRpm < this.config.maxRpm * 0.94
      ) {
        this.shiftTimer = 0
        this.lastShiftDirection = 'down'
        this.shiftCount += 1
        return {
          targetGear: lowerGear,
          targetClutchEngagement: 1.0,
          isKickdown: false,
          targetRpm: projectedRpm,
        }
      }
    }

    // ─── 3. SUBIDA DE RELAÇÃO (Upshift) COM PROTEÇÃO EM ALÍVIO DE ACELERADOR E HISTERESE ───
    if (currentGear < maxGear) {
      const reverseBlocked =
        isContinuousLoop && this.lastShiftDirection === 'down' && this.shiftTimer < minReverseDirCooldown
      const isCoasting = isContinuousLoop && (throttle < 0.08 || (throttleDelta < -0.20 && this.coastingTimer >= 0))
      const upshiftMargin =
        isContinuousLoop && this.lastShiftDirection === 'down' && this.shiftTimer < 1.5 ? 200 : 0
      const effectiveUpshiftRpm = isSportCutoff
        ? Math.min(cutoffRpm - 25, targetMaxRpm)
        : Math.min(this.config.maxRpm * 0.94, targetMaxRpm + upshiftMargin)

      const allowUpshiftLoad = !isCoasting || isOverRevDanger
      if (allowUpshiftLoad && (!reverseBlocked || isOverRevDanger) && currentRpm >= effectiveUpshiftRpm && brake < 0.1) {
        const higherGear = currentGear + 1
        const projectedRpm = this.speedToRpm(vehicleSpeedKmh, higherGear)
        // Só sobe se a próxima marcha não for cair abaixo da marcha lenta segura
        if (projectedRpm >= this.config.idleRpm * 1.35) {
          this.shiftTimer = 0
          this.lastShiftDirection = 'up'
          this.shiftCount += 1
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
    this.lastShiftDirection = 'none'
    this.prevThrottle = 0
    this.shiftCount = 0
    this.coastingTimer = 0
  }

  /** Captura snapshot imutável para isolamento transacional */
  getStateSnapshot(): AutoTransmissionSnapshot {
    return {
      shiftTimer: this.shiftTimer,
      lastShiftDirection: this.lastShiftDirection,
      prevThrottle: this.prevThrottle,
      shiftCount: this.shiftCount,
      coastingTimer: this.coastingTimer,
    }
  }

  /** Restaura estado da transmissão automática a partir do snapshot */
  restoreSnapshot(snapshot: AutoTransmissionSnapshot): void {
    this.shiftTimer = snapshot.shiftTimer
    this.lastShiftDirection = snapshot.lastShiftDirection
    this.prevThrottle = snapshot.prevThrottle
    this.shiftCount = snapshot.shiftCount
    this.coastingTimer = snapshot.coastingTimer
  }
}

/**
 * Snapshot isolado do estado do controlador de câmbio automático/DSG/CVT.
 */
export interface AutoTransmissionSnapshot {
  shiftTimer: number
  lastShiftDirection: 'up' | 'down' | 'none'
  prevThrottle: number
  shiftCount: number
  coastingTimer: number
}
