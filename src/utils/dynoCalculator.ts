import type { VehicleConfig } from '@/types'
import type { DynoDataPoint } from '@/types/simulation'
import type { CarUpgrades } from '@/stores/useGarageStore'

export interface DynoResult {
  dataPoints: DynoDataPoint[]
  maxPowerHp: number
  maxPowerRpm: number
  maxTorqueNm: number
  maxTorqueRpm: number
}

/**
 * Calcula a curva de dinamômetro em tempo real (potência em cv e torque em Nm)
 * considerando o veículo base, estágio de preparação (Stage 1/2/3),
 * peças instaladas (intake, escape, turbo) e combustível utilizado (Etanol/Podium/Comum).
 */
export function calculateDynoProfile(
  config: VehicleConfig,
  upgrades?: Partial<CarUpgrades>,
): DynoResult {
  const stage = upgrades?.tuningStage ?? 0
  const intake = upgrades?.intakeType ?? 'stock'
  const exhaust = upgrades?.exhaustType ?? 'stock'
  const fuel = upgrades?.fuelType ?? 'common_gasoline'
  const hasTurbo = Boolean(config.engine.turbo?.enabled || upgrades?.turboKit)

  // Multiplicadores mecânicos acumulados
  const stageMult = stage === 1 ? 1.25 : stage === 2 ? 1.50 : stage === 3 ? 1.85 : 1.0
  const intakeMult = intake === 'cold_air' ? 1.06 : 1.0
  const exhaustMult = exhaust === 'straight_pipe' ? 1.08 : exhaust === 'sport' ? 1.04 : 1.0
  const turboAftermarketMult = (!config.engine.turbo?.enabled && hasTurbo) ? 1.45 : 1.0

  let fuelMult = 1.0
  if (fuel === 'ethanol_e100') {
    fuelMult = hasTurbo ? 1.12 : 1.07 // Etanol permite maior pressão e ponto adiantado
  } else if (fuel === 'premium_podium') {
    fuelMult = 1.05
  }

  const totalMult = stageMult * intakeMult * exhaustMult * turboAftermarketMult * fuelMult

  const minRpm = 1000
  const maxRpm = config.engine.maxRpm
  const peakTorqueRpmBase = config.engine.maxTorqueRpm || (maxRpm * 0.55)
  const baseTorqueNm = config.engine.maxTorque

  const dataPoints: DynoDataPoint[] = []
  let maxPowerHp = 0
  let maxPowerRpm = minRpm
  let maxTorqueNm = 0
  let maxTorqueRpm = minRpm

  const step = 200
  for (let rpm = minRpm; rpm <= maxRpm; rpm += step) {
    // Modelagem física da curva de torque por respiração volumétrica do motor:
    // Sobe suavemente em baixas rotações, atinge platô próximo a peakTorqueRpm,
    // e sofre queda gradual em altas rotações devido à restrição de fluxo dos dutos.
    const relRpm = rpm / peakTorqueRpmBase
    let torqueShape: number
    if (relRpm < 1.0) {
      torqueShape = 0.55 + 0.45 * Math.sin((relRpm * Math.PI) / 2)
    } else {
      const dropFactor = ((rpm - peakTorqueRpmBase) / (maxRpm - peakTorqueRpmBase))
      torqueShape = 1.0 - Math.pow(dropFactor, 1.8) * 0.28
    }

    // Se tiver turbo, ganho extra de torque na faixa de spool (2000-4500 RPM)
    if (hasTurbo && rpm >= 2200 && rpm <= 5500) {
      torqueShape *= 1.14
    }

    const torque = Math.max(20, Math.round(baseTorqueNm * torqueShape * totalMult))
    // Potência métrica em cavalos (cv): P (cv) = (Torque_Nm * RPM) / 7023.5
    const power = Math.max(10, Math.round((torque * rpm) / 7023.5))

    dataPoints.push({
      rpm,
      powerHp: power,
      torqueNm: torque,
    })

    if (power > maxPowerHp) {
      maxPowerHp = power
      maxPowerRpm = rpm
    }
    if (torque > maxTorqueNm) {
      maxTorqueNm = torque
      maxTorqueRpm = rpm
    }
  }

  return {
    dataPoints,
    maxPowerHp,
    maxPowerRpm,
    maxTorqueNm,
    maxTorqueRpm,
  }
}
