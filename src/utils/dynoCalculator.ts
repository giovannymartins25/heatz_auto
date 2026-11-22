import type { VehicleConfig } from '@/types'
import type { CarUpgrades } from '@/stores/useGarageStore'
import { resolveVehicleDrivetrain, toSimpleDrivetrain } from '@/systems/vehicle/vehicleResolvers'

export interface DynoDataPoint {
  rpm: number
  /** Potência no motor (BHP / cv virabrequim) */
  enginePowerHp: number
  /** Potência nas rodas (WHP / cv nas rodas com perdas de transmissão) */
  wheelPowerHp: number
  /** Torque no motor (Nm) */
  engineTorqueNm: number
  /** Torque nas rodas (Nm) */
  wheelTorqueNm: number
}

export interface DynoResult {
  dataPoints: DynoDataPoint[]
  maxEnginePowerHp: number
  maxWheelPowerHp: number
  /** Alias retrocompatível para potência máxima no motor (BHP / cv) */
  maxPowerHp: number
  maxPowerRpm: number
  maxEngineTorqueNm: number
  /** Alias retrocompatível para torque máximo no motor (Nm) */
  maxTorqueNm: number
  maxTorqueRpm: number
  drivetrainEfficiency: number
  drivetrainLossPercent: number
  testGear: number
  testGearRatio: number
}

/**
 * Determina a arquitetura de tração do veículo (FWD, RWD, AWD)
 */
export function getDrivetrainType(config: VehicleConfig): 'fwd' | 'rwd' | 'awd' {
  return toSimpleDrivetrain(resolveVehicleDrivetrain(config))
}

/**
 * Determina a eficiência mecânica da transmissão (descontando atrito, diferenciais e eixos)
 */
export function getDrivetrainEfficiency(config: VehicleConfig): {
  efficiency: number
  lossPercent: number
  drivetrainType: 'fwd' | 'rwd' | 'awd'
} {
  const drivetrain = getDrivetrainType(config)
  const transType = config.transmission.type

  let efficiency = 0.88 // Padrão FWD manual / DCT

  if (drivetrain === 'awd') {
    // 4x4 / AWD tem perdas em diferenciais dianteiro/traseiro, caixa de transferência e cardãs
    efficiency = transType === 'automatic' ? 0.80 : 0.82
  } else if (drivetrain === 'rwd') {
    // RWD tem perda no eixo cardã longo e diferencial traseiro
    efficiency = transType === 'automatic' ? 0.84 : 0.86
  } else {
    // FWD
    efficiency = transType === 'automatic' ? 0.85 : 0.89
  }

  const lossPercent = Math.round((1 - efficiency) * 100)
  return { efficiency, lossPercent, drivetrainType: drivetrain }
}

/**
 * Calcula a marcha de teste ideal no dinamômetro (mais próxima da relação 1.00:1 direta)
 */
export function getOptimalDynoGear(config: VehicleConfig): { gear: number; ratio: number } {
  const ratios = config.transmission.gearRatios || []
  let bestGear = 4
  let bestRatio = 1.0
  let closestDiff = Infinity

  for (let i = 0; i < ratios.length; i++) {
    const r = typeof ratios[i] === 'object' ? ratios[i].ratio : Number(ratios[i])
    const g = typeof ratios[i] === 'object' ? ratios[i].gear : i + 1
    const diff = Math.abs(r - 1.0)
    if (diff < closestDiff) {
      closestDiff = diff
      bestGear = g
      bestRatio = r
    }
  }

  return { gear: bestGear, ratio: bestRatio }
}

/**
 * Calcula a curva de dinamômetro com base na física estrita:
 * P(cv) = (Torque_Nm * RPM) / 7023.3
 * e P_roda = P_motor * eficiencia_transmissao
 */
export function calculateDynoProfile(
  config: VehicleConfig,
  upgrades?: Partial<CarUpgrades>,
): DynoResult {
  const stage = upgrades?.tuningStage ?? 0
  const intake = upgrades?.intakeType ?? 'stock'
  const exhaust = upgrades?.exhaustType ?? 'stock'
  const hasTurbo = Boolean(config.engine.turbo?.enabled || upgrades?.turboKit)

  // Multiplicadores mecânicos reais de preparação
  const stageMult = stage === 1 ? 1.22 : stage === 2 ? 1.45 : stage === 3 ? 1.80 : 1.0
  const intakeMult = intake === 'cold_air' ? 1.05 : 1.0

  let exhaustMult = 1.0
  if (exhaust === 'straight_pipe') exhaustMult = 1.08
  else if (exhaust === 'downpipe') exhaustMult = hasTurbo ? 1.07 : 1.04
  else if (exhaust === 'cat_back') exhaustMult = 1.05
  else if (exhaust === 'sport') exhaustMult = 1.03

  let turboAftermarketMult = 1.0
  const turboLevel = upgrades?.turboLevel
  if (!config.engine.turbo?.enabled && hasTurbo) {
    turboAftermarketMult =
      turboLevel === 'big_turbo' ? 1.95 : turboLevel === 'intermediate' ? 1.55 : 1.40
  } else if (config.engine.turbo?.enabled) {
    turboAftermarketMult =
      turboLevel === 'big_turbo' ? 1.60 : turboLevel === 'intermediate' ? 1.25 : turboLevel === 'basic' ? 1.12 : 1.0
  }

  let fuelMult = 1.0
  if (upgrades?.fuelType === 'ethanol_e100') {
    fuelMult = 1.06
  } else if (upgrades?.fuelType === 'premium_podium') {
    fuelMult = config.id === 'porsche-gt3' ? 1.05 : config.id === 'golf-gti' || config.id === 'civic-si' ? 1.04 : 1.0
  }

  const nosMult = upgrades?.hasNosKit ? 1.25 : 1.0

  const totalMult = stageMult * intakeMult * exhaustMult * turboAftermarketMult * fuelMult * nosMult

  const minRpm = 1000
  const maxRpm = config.engine.maxRpm || 6500
  const peakTorqueRpmBase = config.engine.maxTorqueRpm || (maxRpm * 0.52)
  const baseTorqueNm = config.engine.maxTorque || 200

  const { efficiency, lossPercent } = getDrivetrainEfficiency(config)
  const { gear: testGear, ratio: testGearRatio } = getOptimalDynoGear(config)

  const dataPoints: DynoDataPoint[] = []
  let maxEnginePowerHp = 0
  let maxWheelPowerHp = 0
  let maxPowerRpm = minRpm
  let maxEngineTorqueNm = 0
  let maxTorqueRpm = minRpm

  const step = 150
  for (let rpm = minRpm; rpm <= maxRpm; rpm += step) {
    // Modelagem da respiração volumétrica do motor:
    const relRpm = rpm / peakTorqueRpmBase
    let torqueShape: number
    if (relRpm < 1.0) {
      torqueShape = 0.52 + 0.48 * Math.sin((relRpm * Math.PI) / 2)
    } else {
      const dropFactor = (rpm - peakTorqueRpmBase) / Math.max(1, maxRpm - peakTorqueRpmBase)
      torqueShape = 1.0 - Math.pow(dropFactor, 1.75) * 0.32
    }

    // Sobrealimentação Turbo na faixa útil de pressão
    if (hasTurbo && rpm >= 2000 && rpm <= 5200) {
      torqueShape *= 1.15
    }

    const engineTorque = Math.max(20, Math.round(baseTorqueNm * torqueShape * totalMult))
    // Relação física obrigatória: P(cv) = (T(Nm) * RPM) / 7023.3
    const enginePower = Math.max(10, Math.round((engineTorque * rpm) / 7023.3))

    // Potência e Torque nas rodas (WHP) com perdas mecânicas
    const wheelPower = Math.round(enginePower * efficiency)
    const wheelTorque = Math.round(engineTorque * efficiency)

    dataPoints.push({
      rpm,
      enginePowerHp: enginePower,
      wheelPowerHp: wheelPower,
      engineTorqueNm: engineTorque,
      wheelTorqueNm: wheelTorque,
    })

    if (enginePower > maxEnginePowerHp) {
      maxEnginePowerHp = enginePower
      maxWheelPowerHp = wheelPower
      maxPowerRpm = rpm
    }
    if (engineTorque > maxEngineTorqueNm) {
      maxEngineTorqueNm = engineTorque
      maxTorqueRpm = rpm
    }
  }

  return {
    dataPoints,
    maxEnginePowerHp,
    maxWheelPowerHp,
    maxPowerHp: maxEnginePowerHp,
    maxPowerRpm,
    maxEngineTorqueNm,
    maxTorqueNm: maxEngineTorqueNm,
    maxTorqueRpm,
    drivetrainEfficiency: efficiency,
    drivetrainLossPercent: lossPercent,
    testGear,
    testGearRatio,
  }
}
