/**
 * ClimateSystem.ts — Sistema determinístico de climatização automotiva (HVAC).
 *
 * Responsabilidades:
 * 1. Respeitar estritamente `VehicleCabinSpec` (`climateType`, `hasAcCompressor`, `hasHeater`,
 *    `hasRecirculation`, `hasDefroster`). Veículos com `climateType === 'none'` (ex.: CB1000R)
 *    não possuem controles nem carga térmica/mecânica de cabine.
 * 2. Modelar evolução térmica contínua e determinística da cabine (`cabinTempC`) em função de:
 *    - Temperatura externa (`ambientTempC`), insolação/chuva e abertura de vidros (`windowOpenRatio`)
 *    - Potência frigorífica do compressor de A/C (quando acoplado e motor girando)
 *    - Aquecimento via trocador de calor do líquido de arrefecimento (`coolantTempC`)
 *    - Vazão do eletroventilador (`fanLevel` 0..5) e ganho de eficiência por recirculação interna
 * 3. Separar rigorosamente:
 *    - Carga mecânica parasita do compressor no virabrequim (`compressorMechanicalPowerW` -> `compressorLoadTorqueNm`)
 *    - Consumo elétrico do eletroventilador e desembaçador (`blowerElectricalPowerW`)
 *
 * NOTA DE CALIBRAÇÃO:
 * Os parâmetros abaixo (`NOMINAL_COMPRESSOR_MECH_POWER_W`, constantes térmicas `TAU_*`, consumo do blower)
 * são parâmetros de calibração da simulação física, e não especificações de fábrica de um OEM específico.
 */

import type { ClimateSystemType, IgnitionPosition, VehicleCabinSpec } from '@/types/vehicle'
import { clamp } from '@/utils/math'

export type FanLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface ClimateTickInput {
  deltaTime: number
  isEngineRunning: boolean
  engineRpm: number
  coolantTempC: number
  ignitionPosition: IgnitionPosition
  windowOpenRatio: number
  isRaining?: boolean
  speedKmh?: number
}

export interface ClimateStateSnapshot {
  ambientTempC: number
  cabinTempC: number
  targetTempC: number
  acEnabled: boolean
  isCompressorEngaged: boolean
  fanLevel: FanLevel
  autoMode: boolean
  recirculation: boolean
  heaterEnabled: boolean
  defrosterEnabled: boolean
  compressorMechanicalPowerW: number
  compressorLoadTorqueNm: number
  blowerElectricalPowerW: number
}

// ─── Parâmetros Calibrados de Simulação (Não-OEM) ────────────────────────────
export const CLIMATE_CALIBRATION = {
  /** Temperatura ambiente padrão em pista seca (°C) — [CALIBRAÇÃO] */
  DEFAULT_AMBIENT_TEMP_C: 26.0,
  /** Temperatura ambiente sob chuva (°C) — [CALIBRAÇÃO] */
  RAIN_AMBIENT_TEMP_C: 20.5,
  /** Faixa de ajuste do termostato da cabine (°C) — [CALIBRAÇÃO] */
  MIN_TARGET_TEMP_C: 16.0,
  MAX_TARGET_TEMP_C: 30.0,
  DEFAULT_TARGET_TEMP_C: 22.0,
  /** Potência mecânica nominal do compressor de A/C no eixo a carga plena (W) — [CALIBRAÇÃO] */
  NOMINAL_COMPRESSOR_MECH_POWER_W: 1850,
  /** Potência mecânica mínima com compressor acoplado em regime variável/leve (W) — [CALIBRAÇÃO] */
  MIN_COMPRESSOR_MECH_POWER_W: 480,
  /** RPM mínimo do motor para acoplamento da embreagem eletromagnética do compressor — [CALIBRAÇÃO] */
  MIN_COMPRESSOR_ENGAGE_RPM: 520,
  /** Torque máximo absoluto do compressor no virabrequim por segurança numérica (Nm) — [CALIBRAÇÃO] */
  MAX_COMPRESSOR_TORQUE_NM: 22.0,
  /** Consumo elétrico por nível do eletroventilador da caixa de ar (W/nível) — [CALIBRAÇÃO] */
  BLOWER_POWER_PER_LEVEL_W: 42,
  /** Consumo elétrico adicional do desembaçador traseiro/dianteiro ativo (W) — [CALIBRAÇÃO] */
  DEFROSTER_ELECTRICAL_POWER_W: 160,
  /** Bônus de eficiência térmica de refrigeração com recirculação fechada — [CALIBRAÇÃO] */
  RECIRCULATION_COOLING_BONUS: 1.24,
} as const

export class ClimateSystem {
  private readonly cabinSpec: VehicleCabinSpec

  private ambientTempC: number = CLIMATE_CALIBRATION.DEFAULT_AMBIENT_TEMP_C
  private manualAmbientOverride: boolean = false
  private cabinTempC: number = CLIMATE_CALIBRATION.DEFAULT_AMBIENT_TEMP_C
  private targetTempC: number = CLIMATE_CALIBRATION.DEFAULT_TARGET_TEMP_C
  private acEnabled: boolean = false
  private isCompressorEngaged: boolean = false
  private fanLevel: FanLevel = 0
  private autoMode: boolean = false
  private recirculation: boolean = false
  private heaterEnabled: boolean = false
  private defrosterEnabled: boolean = false
  private compressorMechanicalPowerW: number = 0
  private compressorLoadTorqueNm: number = 0
  private blowerElectricalPowerW: number = 0

  constructor(cabinSpec: VehicleCabinSpec) {
    this.cabinSpec = cabinSpec
  }

  getCabinSpec(): VehicleCabinSpec {
    return this.cabinSpec
  }

  getClimateType(): ClimateSystemType {
    return this.cabinSpec.climateType
  }

  hasClimateControl(): boolean {
    return this.cabinSpec.climateType !== 'none'
  }

  supportsAutoMode(): boolean {
    return (
      this.cabinSpec.climateType === 'auto_single' ||
      this.cabinSpec.climateType === 'auto_dual' ||
      this.cabinSpec.climateType === 'auto_tri'
    )
  }

  setAmbientTempC(tempC: number): void {
    this.ambientTempC = clamp(tempC, -15, 50)
    this.manualAmbientOverride = true
    if (!this.hasClimateControl()) {
      this.cabinTempC = this.ambientTempC
    }
  }

  getAmbientTempC(): number {
    return this.ambientTempC
  }

  getCabinTempC(): number {
    return this.cabinTempC
  }

  setCabinTempC(tempC: number): void {
    this.cabinTempC = clamp(tempC, -15, 60)
  }

  getTargetTempC(): number {
    return this.targetTempC
  }

  setTargetTempC(tempC: number): void {
    if (!this.hasClimateControl()) return
    this.targetTempC = clamp(
      tempC,
      CLIMATE_CALIBRATION.MIN_TARGET_TEMP_C,
      CLIMATE_CALIBRATION.MAX_TARGET_TEMP_C,
    )
  }

  stepTargetTempC(deltaC: number): void {
    this.setTargetTempC(this.targetTempC + deltaC)
  }

  isAcEnabled(): boolean {
    return this.acEnabled
  }

  setAcEnabled(enabled: boolean): void {
    if (!this.hasClimateControl() || !this.cabinSpec.hasAcCompressor) {
      this.acEnabled = false
      this.isCompressorEngaged = false
      return
    }
    this.acEnabled = Boolean(enabled)
    if (this.acEnabled && this.fanLevel === 0) {
      this.fanLevel = 2
    }
  }

  toggleAc(): void {
    this.setAcEnabled(!this.acEnabled)
  }

  getIsCompressorEngaged(): boolean {
    return this.isCompressorEngaged
  }

  getFanLevel(): FanLevel {
    return this.fanLevel
  }

  setFanLevel(level: number): void {
    if (!this.hasClimateControl()) {
      this.fanLevel = 0
      return
    }
    const clamped = Math.round(clamp(level, 0, 5)) as FanLevel
    this.fanLevel = clamped
    if (clamped === 0) {
      this.autoMode = false
    }
  }

  isAutoMode(): boolean {
    return this.autoMode
  }

  setAutoMode(enabled: boolean): void {
    if (!this.supportsAutoMode()) {
      this.autoMode = false
      return
    }
    this.autoMode = Boolean(enabled)
    if (this.autoMode) {
      if (this.cabinSpec.hasAcCompressor) {
        this.acEnabled = true
      }
      if (this.cabinSpec.hasHeater) {
        this.heaterEnabled = true
      }
      if (this.fanLevel === 0) {
        this.fanLevel = 2
      }
    }
  }

  toggleAutoMode(): void {
    this.setAutoMode(!this.autoMode)
  }

  isRecirculationEnabled(): boolean {
    return this.recirculation
  }

  setRecirculation(enabled: boolean): void {
    if (!this.hasClimateControl() || !this.cabinSpec.hasRecirculation) {
      this.recirculation = false
      return
    }
    this.recirculation = Boolean(enabled)
  }

  toggleRecirculation(): void {
    this.setRecirculation(!this.recirculation)
  }

  isHeaterEnabled(): boolean {
    return this.heaterEnabled
  }

  setHeaterEnabled(enabled: boolean): void {
    if (!this.hasClimateControl() || !this.cabinSpec.hasHeater) {
      this.heaterEnabled = false
      return
    }
    this.heaterEnabled = Boolean(enabled)
    if (this.heaterEnabled && this.fanLevel === 0) {
      this.fanLevel = 2
    }
  }

  toggleHeater(): void {
    this.setHeaterEnabled(!this.heaterEnabled)
  }

  isDefrosterEnabled(): boolean {
    return this.defrosterEnabled
  }

  setDefrosterEnabled(enabled: boolean): void {
    if (!this.hasClimateControl() || !this.cabinSpec.hasDefroster) {
      this.defrosterEnabled = false
      return
    }
    this.defrosterEnabled = Boolean(enabled)
    if (this.defrosterEnabled && this.fanLevel === 0) {
      this.fanLevel = 2
    }
  }

  toggleDefroster(): void {
    this.setDefrosterEnabled(!this.defrosterEnabled)
  }

  getCompressorMechanicalPowerW(): number {
    return this.compressorMechanicalPowerW
  }

  getCompressorLoadTorqueNm(): number {
    return this.compressorLoadTorqueNm
  }

  getBlowerElectricalPowerW(): number {
    return this.blowerElectricalPowerW
  }

  /**
   * Passo determinístico a 120 Hz.
   */
  tick(input: ClimateTickInput): ClimateStateSnapshot {
    const dt = Math.max(0, input.deltaTime)

    // Atualiza temperatura externa caso não tenha sido fixada manualmente em teste
    if (!this.manualAmbientOverride && input.isRaining !== undefined) {
      const targetAmbient = input.isRaining
        ? CLIMATE_CALIBRATION.RAIN_AMBIENT_TEMP_C
        : CLIMATE_CALIBRATION.DEFAULT_AMBIENT_TEMP_C
      this.ambientTempC += (targetAmbient - this.ambientTempC) * Math.min(1, dt * 0.25)
    }

    // Motocicletas ou veículos sem cabine fechada
    if (!this.hasClimateControl()) {
      this.cabinTempC = this.ambientTempC
      this.acEnabled = false
      this.isCompressorEngaged = false
      this.fanLevel = 0
      this.autoMode = false
      this.recirculation = false
      this.heaterEnabled = false
      this.defrosterEnabled = false
      this.compressorMechanicalPowerW = 0
      this.compressorLoadTorqueNm = 0
      this.blowerElectricalPowerW = 0
      return this.getStateSnapshot()
    }

    const hasElectricalPower =
      input.isEngineRunning ||
      input.ignitionPosition === 'ACC' ||
      input.ignitionPosition === 'ON' ||
      input.ignitionPosition === 'CRANK'

    // 1. Controle automático de ventilação (Climatronic / Auto HVAC)
    if (this.autoMode && hasElectricalPower) {
      const tempError = Math.abs(this.cabinTempC - this.targetTempC)
      if (tempError > 5.0) this.fanLevel = 5
      else if (tempError > 3.2) this.fanLevel = 4
      else if (tempError > 1.8) this.fanLevel = 3
      else if (tempError > 0.6) this.fanLevel = 2
      else this.fanLevel = 1
    }

    const activeFanLevel: FanLevel = hasElectricalPower ? this.fanLevel : 0

    // 2. Consumo elétrico da ventilação e desembaçador (independente do compressor!)
    this.blowerElectricalPowerW =
      activeFanLevel * CLIMATE_CALIBRATION.BLOWER_POWER_PER_LEVEL_W +
      (hasElectricalPower && this.defrosterEnabled && this.cabinSpec.hasDefroster
        ? CLIMATE_CALIBRATION.DEFROSTER_ELECTRICAL_POWER_W
        : 0)

    // 3. Acoplamento mecânico do compressor de A/C (exige motor girando + ventilação ligada + equipamento presente)
    const canEngageCompressor =
      this.cabinSpec.hasAcCompressor &&
      this.acEnabled &&
      input.isEngineRunning &&
      input.engineRpm >= CLIMATE_CALIBRATION.MIN_COMPRESSOR_ENGAGE_RPM &&
      activeFanLevel > 0

    this.isCompressorEngaged = canEngageCompressor

    if (this.isCompressorEngaged) {
      // Demanda frigorífica: em A/C automático modula conforme proximidade do setpoint;
      // em A/C manual opera proporcionalmente à ventilação e rotação da polia.
      const coolingDelta = Math.max(0, this.cabinTempC - this.targetTempC)
      const demandFactor = this.supportsAutoMode()
        ? clamp(0.32 + coolingDelta * 0.14 + (activeFanLevel / 5) * 0.25, 0.28, 1.0)
        : clamp(0.55 + (activeFanLevel / 5) * 0.45, 0.55, 1.0)

      const rpmPulleyFactor = clamp((input.engineRpm - 500) / 1500, 0.45, 1.15)
      const rawMechPowerW =
        CLIMATE_CALIBRATION.MIN_COMPRESSOR_MECH_POWER_W +
        (CLIMATE_CALIBRATION.NOMINAL_COMPRESSOR_MECH_POWER_W -
          CLIMATE_CALIBRATION.MIN_COMPRESSOR_MECH_POWER_W) *
          demandFactor *
          rpmPulleyFactor

      this.compressorMechanicalPowerW = rawMechPowerW

      // Conversão física exata: P = tau * omega  =>  tau = P / omega (N·m = W / (rad/s))
      const engineOmegaRadS = Math.max(55, (input.engineRpm * 2 * Math.PI) / 60)
      this.compressorLoadTorqueNm = clamp(
        this.compressorMechanicalPowerW / engineOmegaRadS,
        0,
        CLIMATE_CALIBRATION.MAX_COMPRESSOR_TORQUE_NM,
      )
    } else {
      this.compressorMechanicalPowerW = 0
      this.compressorLoadTorqueNm = 0
    }

    // 4. Evolução térmica determinística da cabine
    const windowOpen = clamp(input.windowOpenRatio, 0, 1)
    const speedFactor = 1 + clamp((input.speedKmh ?? 0) / 90, 0, 1.2) * 0.6

    // Troca passiva com o ambiente externo (muito mais rápida com vidros abertos)
    const passiveLeakRate = (0.015 + windowOpen * 0.14 * speedFactor) * (this.recirculation ? 0.65 : 1.0)
    let dTempDt = (this.ambientTempC - this.cabinTempC) * passiveLeakRate

    if (activeFanLevel > 0) {
      const fanFlowFactor = activeFanLevel / 5

      if (this.isCompressorEngaged) {
        // Refrigeração ativa em direção ao targetTempC
        const recircBonus = this.recirculation ? CLIMATE_CALIBRATION.RECIRCULATION_COOLING_BONUS : 1.0
        const coolingTarget = this.targetTempC
        const coolingRate = 0.22 * fanFlowFactor * recircBonus
        if (this.cabinTempC > coolingTarget || !this.cabinSpec.hasHeater) {
          dTempDt += (coolingTarget - this.cabinTempC) * coolingRate
        } else if (this.cabinSpec.hasHeater && (this.heaterEnabled || this.autoMode)) {
          const coolantFactor = clamp((input.coolantTempC - 45) / 45, 0, 1)
          dTempDt += (this.targetTempC - this.cabinTempC) * (0.18 * fanFlowFactor * coolantFactor)
        }
      } else if (this.cabinSpec.hasHeater && this.heaterEnabled && this.targetTempC > this.cabinTempC) {
        // Aquecimento via arrefecimento do motor (mesmo sem compressor de A/C, ex.: Gol Quadrado / Opala)
        const coolantFactor = clamp((input.coolantTempC - 42) / 46, 0, 1)
        const heatingRate = 0.19 * fanFlowFactor * coolantFactor
        dTempDt += (this.targetTempC - this.cabinTempC) * heatingRate
      } else {
        // Ventilação forçada simples (sem A/C e sem aquecedor ativo): sopra ar externo para dentro da cabine
        const ventExchangeRate = 0.08 * fanFlowFactor * (this.recirculation ? 0.25 : 1.0)
        dTempDt += (this.ambientTempC - this.cabinTempC) * ventExchangeRate
      }
    }

    this.cabinTempC = clamp(this.cabinTempC + dTempDt * dt, -15, 60)

    return this.getStateSnapshot()
  }

  reset(): void {
    this.ambientTempC = CLIMATE_CALIBRATION.DEFAULT_AMBIENT_TEMP_C
    this.manualAmbientOverride = false
    this.cabinTempC = CLIMATE_CALIBRATION.DEFAULT_AMBIENT_TEMP_C
    this.targetTempC = CLIMATE_CALIBRATION.DEFAULT_TARGET_TEMP_C
    this.acEnabled = false
    this.isCompressorEngaged = false
    this.fanLevel = 0
    this.autoMode = false
    this.recirculation = false
    this.heaterEnabled = false
    this.defrosterEnabled = false
    this.compressorMechanicalPowerW = 0
    this.compressorLoadTorqueNm = 0
    this.blowerElectricalPowerW = 0
  }

  getStateSnapshot(): ClimateStateSnapshot {
    return {
      ambientTempC: this.ambientTempC,
      cabinTempC: this.cabinTempC,
      targetTempC: this.targetTempC,
      acEnabled: this.acEnabled,
      isCompressorEngaged: this.isCompressorEngaged,
      fanLevel: this.fanLevel,
      autoMode: this.autoMode,
      recirculation: this.recirculation,
      heaterEnabled: this.heaterEnabled,
      defrosterEnabled: this.defrosterEnabled,
      compressorMechanicalPowerW: this.compressorMechanicalPowerW,
      compressorLoadTorqueNm: this.compressorLoadTorqueNm,
      blowerElectricalPowerW: this.blowerElectricalPowerW,
    }
  }

  restoreSnapshot(snapshot: ClimateStateSnapshot): void {
    this.ambientTempC = snapshot.ambientTempC
    this.cabinTempC = snapshot.cabinTempC
    this.targetTempC = snapshot.targetTempC
    this.acEnabled = snapshot.acEnabled
    this.isCompressorEngaged = snapshot.isCompressorEngaged
    this.fanLevel = snapshot.fanLevel
    this.autoMode = snapshot.autoMode
    this.recirculation = snapshot.recirculation
    this.heaterEnabled = snapshot.heaterEnabled
    this.defrosterEnabled = snapshot.defrosterEnabled
    this.compressorMechanicalPowerW = snapshot.compressorMechanicalPowerW
    this.compressorLoadTorqueNm = snapshot.compressorLoadTorqueNm
    this.blowerElectricalPowerW = snapshot.blowerElectricalPowerW
  }
}
