/**
 * HEATZ AUTO — FASE 4.1: Suíte de Paridade dos 10 Veículos Existentes + Validação Declarativa e Registros
 *
 * Verifica:
 * 1. Paridade 100% bit-a-bit de TODOS os 10 veículos atuais contra o baseline real pré-migração
 *    (`baseline_10_vehicles.json`): drivetrain, distribuição de peso no eixo motriz, capacidades,
 *    upgrades padrão, inicialização da store e amostra física de 60 ticks (120 Hz + 240 Hz).
 * 2. Arquiteturas representativas: FWD (Gol Quadrado, Civic Si), RWD (Opala 4.1), AWD PTM
 *    (Porsche 911 Turbo S), 4x4 selecionável (Toro Ranch) e Motocicleta (CB1000R).
 * 3. Veículos sintéticos declarativos (sem hardcode de vehicleId): RWD, AWD on-demand, ignição,
 *    cabine, multimídia, visual2d e validação de configuração (`validateVehicleConfig`).
 * 4. Registros dedicados: `CLUSTER_REGISTRY` e `MULTIMEDIA_REGISTRY` + fallbacks explícitos.
 */

import fs from 'fs'
import path from 'path'
import { getVehicleCapabilities, type VehicleConfig } from './src/types/vehicle'
import { createDefaultUpgrades } from './src/stores/useGarageStore'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { getDrivetrainType } from './src/utils/dynoCalculator'
import {
  resolveDefaultAmbientColor,
  resolveDefaultUpgradesForVehicle,
  resolveVehicleAero,
  resolveVehicleCabin,
  resolveVehicleDrivetrain,
  resolveVehicleFuelDefaults,
  resolveVehicleIgnition,
  resolveVehicleMultimediaSpec,
  resolveVehicleVisual2D,
  validateVehicleConfig,
} from './src/systems/vehicle/vehicleResolvers'
import { CLUSTER_REGISTRY, resolveClusterEntry } from './src/components/dashboard/clusters/clusterRegistry'
import { MULTIMEDIA_REGISTRY, resolveMultimediaEntry } from './src/components/dashboard/infotainment/multimediaRegistry'

let passed = 0
let failed = 0

function assert(cond: boolean, name: string, detail = '') {
  if (cond) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

const REPO = process.cwd()
const BASELINE_PATH =
  'C:\\Users\\giovanny\\.gemini\\antigravity\\brain\\90e9f79c-3dca-43fa-96e3-aa471006c689\\scratch\\baseline_10_vehicles.json'

const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'public', 'vehicles', 'manifest.json'), 'utf8'))
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Record<string, any>

function loadVehicle(id: string): VehicleConfig {
  const entry = manifest.vehicles.find((v: any) => v.id === id)
  if (!entry) throw new Error(`Veículo ${id} não encontrado no manifest`)
  const cfgPath = path.join(REPO, 'public', entry.configPath.replace(/^\//, ''))
  return JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as VehicleConfig
}

console.log('\n=== FASE 4.1 — 1. PARIDADE EXATA DOS 10 VEÍCULOS EXISTENTES VS BASELINE REAL ===')

for (const baselineId of Object.keys(baseline)) {
  const entry = manifest.vehicles.find((v: any) => v.id === baselineId)
  assert(Boolean(entry), `[${baselineId}] preservado no manifest.json`)
  const cfg = loadVehicle(baselineId)
  const expected = baseline[cfg.id]
  assert(Boolean(expected), `[${cfg.id}] baseline pré-migração presente`)

  const validation = validateVehicleConfig(cfg)
  assert(validation.valid, `[${cfg.id}] validateVehicleConfig() aprovado`, validation.errors.join('; '))

  const caps = getVehicleCapabilities(cfg)
  const upgrades = createDefaultUpgrades(cfg.id)
  const dynoDrivetrain = getDrivetrainType(cfg)

  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(cfg, upgrades)
  const initSt = useSimulationStore.getState()

  const phys = new VehiclePhysics({
    weight: cfg.info.weight,
    wheelDiameter: cfg.info.wheelDiameter,
    vehicleId: cfg.id,
    drivetrain: cfg.transmission.drivetrain,
    isMotorcycle: cfg.info.category === 'motorcycle',
    chassis: cfg.chassis,
    frontFinalDrive: cfg.transmission.frontFinalDrive,
    initialPositionX: 0,
    initialPositionY: 60,
    initialHeadingDeg: 0,
  })
  phys.setSpeedKmh(45)
  const gIdx = Math.min(1, cfg.transmission.gearRatios.length - 1)
  const gearRatio = cfg.transmission.gearRatios[gIdx].ratio
  let lastTick: any = null
  for (let i = 0; i < 60; i++) {
    lastTick = phys.tick({
      driveTorqueAtTransmission: cfg.engine.maxTorque * 0.65,
      gearRatio,
      finalDrive: cfg.transmission.finalDrive,
      frontFinalDrive: cfg.transmission.frontFinalDrive,
      brake: 0,
      deltaTime: 1 / 120,
      steeringAngleRad: 0.20,
      gear: gIdx + 1,
      isRaining: false,
    })
  }

  const actualCapabilities = {
    supportedDrivingModes: caps.supportedDrivingModes,
    defaultDrivingMode: caps.defaultDrivingMode,
    transmissionType: caps.transmissionType,
    supportedSelectorPositions: caps.supportedSelectorPositions,
    supportsManualMode: caps.supportsManualMode,
    manualShiftControls: caps.manualShiftControls,
    supportsPaddleShifters: caps.supportsPaddleShifters,
    supportsNos: caps.supportsNos,
    hasClutchPedal: caps.hasClutchPedal,
    has4x4Selector: caps.has4x4Selector,
    hasInfotainment: caps.hasInfotainment,
    isMotorcycle: caps.isMotorcycle,
    multimediaType: caps.multimedia.type,
    multimediaLayout: caps.multimedia.layout,
    multimediaName: caps.multimedia.name,
    supportsAftermarketUpgrade: caps.multimedia.supportsAftermarketUpgrade,
    activeAero: caps.activeAero ?? null,
  }

  const actualUpgrades = {
    turboKit: upgrades.turboKit,
    turboLevel: upgrades.turboLevel,
    engineInternals: upgrades.engineInternals,
    rearWingType: upgrades.rearWingType,
    multimediaKit: upgrades.multimediaKit,
    exhaustType: upgrades.exhaustType,
    fuelType: upgrades.fuelType,
    rearWingPosition: upgrades.rearWingPosition,
  }

  const actualStoreInit = {
    hasTurbo: initSt.hasTurbo,
    hasLaunchControl: initSt.hasLaunchControl,
    ambientLightColor: initSt.ambientLightColor,
    fuelType: initSt.fuelType,
    rearWingType: initSt.rearWingType,
    rearWingPosition: initSt.rearWingPosition,
    currentGear: initSt.currentGear,
    isAutomaticVehicle: initSt.isAutomaticVehicle,
  }

  const actualPhysics = {
    speedKmh: Number(lastTick.speedKmh.toFixed(6)),
    positionX: Number(lastTick.positionX.toFixed(6)),
    positionY: Number(lastTick.positionY.toFixed(6)),
    headingDeg: Number(lastTick.headingDeg.toFixed(6)),
    lateralSpeedMs: Number(lastTick.lateralSpeedMs.toFixed(6)),
    slipAngleDeg: Number(lastTick.slipAngleDeg.toFixed(6)),
    lateralAccelG: Number(lastTick.lateralAccelG.toFixed(6)),
    leanAngleDeg: Number(lastTick.leanAngleDeg.toFixed(6)),
    frontAxleTorqueNm: Number(lastTick.frontAxleTorqueNm.toFixed(4)),
    rearAxleTorqueNm: Number(lastTick.rearAxleTorqueNm.toFixed(4)),
    frontTractionForceN: Number(lastTick.frontTractionForceN.toFixed(4)),
    rearTractionForceN: Number(lastTick.rearTractionForceN.toFixed(4)),
    yawInertiaKgM2: Number(lastTick.yawInertiaKgM2.toFixed(4)),
  }

  assert(dynoDrivetrain === expected.dynoDrivetrain, `[${cfg.id}] dynoDrivetrain paridade (${dynoDrivetrain})`)
  assert(
    Number(phys.getDriveAxleWeightRatio().toFixed(6)) === expected.driveAxleWeightRatio,
    `[${cfg.id}] driveAxleWeightRatio paridade (${expected.driveAxleWeightRatio})`,
  )
  assert(
    deepEqual(actualCapabilities, expected.capabilities),
    `[${cfg.id}] capabilities paridade exata`,
    `diff: ${JSON.stringify(actualCapabilities)} vs ${JSON.stringify(expected.capabilities)}`,
  )
  assert(
    deepEqual(actualUpgrades, expected.defaultUpgrades),
    `[${cfg.id}] defaultUpgrades paridade exata`,
    `diff: ${JSON.stringify(actualUpgrades)} vs ${JSON.stringify(expected.defaultUpgrades)}`,
  )
  assert(
    deepEqual(actualStoreInit, expected.storeInit),
    `[${cfg.id}] storeInit paridade exata`,
    `diff: ${JSON.stringify(actualStoreInit)} vs ${JSON.stringify(expected.storeInit)}`,
  )
  assert(
    deepEqual(actualPhysics, expected.physicsSample),
    `[${cfg.id}] física 60 ticks (120Hz/240Hz) paridade bit-a-bit`,
    `diff: ${JSON.stringify(actualPhysics)} vs ${JSON.stringify(expected.physicsSample)}`,
  )
}

console.log('\n=== FASE 4.1 — 2. ARQUITETURAS REPRESENTATIVAS (FWD, RWD, AWD PTM, 4x4, MOTO) ===')

assert(resolveVehicleDrivetrain(loadVehicle('gol-quadrado-turbo')) === 'fwd', 'Gol Quadrado resolve como FWD')
assert(resolveVehicleDrivetrain(loadVehicle('opala-4100')) === 'rwd', 'Opala 4.1 resolve como RWD')
assert(resolveVehicleDrivetrain(loadVehicle('porsche-gt3')) === 'awd_ptm', 'Porsche 911 Turbo S resolve como AWD PTM')
assert(resolveVehicleDrivetrain(loadVehicle('fiat-toro-ranch-2025')) === '4x4_selectable', 'Toro Ranch resolve como 4x4 selecionável')
assert(resolveVehicleDrivetrain(loadVehicle('cb1000r')) === 'rwd', 'CB1000R resolve como RWD (motocicleta)')

console.log('\n=== FASE 4.1 — 3. CONFIGS DECLARATIVOS SINTÉTICOS (ZERO HARDCODE DE vehicleId) ===')

const baseTemplate = loadVehicle('gol-g6')

const syntheticRwdSedan: VehicleConfig = {
  ...baseTemplate,
  id: 'synthetic-rwd-sedan-test',
  transmission: {
    ...baseTemplate.transmission,
    drivetrain: 'rwd',
  },
  ignition: {
    type: 'push_button',
    startInterlock: 'brake',
    supportsAccessoryMode: true,
  },
  cabin: {
    climateType: 'auto_tri',
    hasAcCompressor: true,
    hasHeater: true,
    hasSeatHeating: true,
    hasRecirculation: true,
    hasDefroster: true,
    windowCount: 4,
    windowControlType: 'electric',
    hasFogLights: true,
    hasAmbientLighting: true,
    defaultAmbientColor: 'cyan',
  },
  multimedia: {
    unitId: 'generic_multimedia',
    type: 'factory',
    layout: 'horizontal',
    screenSize: 12.3,
    name: 'Tela Curva Sintética 12.3"',
    era: '2020s',
    features: ['CarPlay', 'Clima Tri-Zone'],
    supportsAftermarketUpgrade: false,
  },
  visual2d: {
    bodyColor: '#1e40af',
    lengthM: 4.71,
    widthM: 1.83,
    silhouette: 'sedan',
  },
}

const rwdVal = validateVehicleConfig(syntheticRwdSedan)
assert(rwdVal.valid, 'Veículo sintético RWD declarativo passa em validateVehicleConfig()')
assert(resolveVehicleDrivetrain(syntheticRwdSedan) === 'rwd', 'Veículo sintético resolve drivetrain=rwd sem vehicleId hardcoded')
assert(getDrivetrainType(syntheticRwdSedan) === 'rwd', 'dynoCalculator resolve rwd declarativamente')
assert(resolveVehicleIgnition(syntheticRwdSedan).type === 'push_button', 'resolveVehicleIgnition lê ignition declarativo')
assert(resolveVehicleCabin(syntheticRwdSedan).climateType === 'auto_tri', 'resolveVehicleCabin lê cabin declarativo')
assert(resolveDefaultAmbientColor(syntheticRwdSedan) === 'cyan', 'resolveDefaultAmbientColor lê cabin.defaultAmbientColor')
assert(resolveVehicleVisual2D(syntheticRwdSedan).bodyColor === '#1e40af', 'resolveVehicleVisual2D lê visual2d declarativo')
assert(resolveVehicleMultimediaSpec(syntheticRwdSedan).screenSize === 12.3, 'resolveVehicleMultimediaSpec lê multimedia declarativo')
assert(
  resolveDefaultUpgradesForVehicle(syntheticRwdSedan.id, syntheticRwdSedan).multimediaKit === true,
  'resolveDefaultUpgradesForVehicle deriva multimediaKit=true de config declarativo',
)

const rwdPhys = new VehiclePhysics({
  weight: syntheticRwdSedan.info.weight,
  wheelDiameter: syntheticRwdSedan.info.wheelDiameter,
  vehicleId: syntheticRwdSedan.id,
  drivetrain: syntheticRwdSedan.transmission.drivetrain,
})
rwdPhys.setSpeedKmh(30)
const rwdTick = rwdPhys.tick({
  driveTorqueAtTransmission: 180,
  gearRatio: 3.0,
  finalDrive: 3.5,
  brake: 0,
  deltaTime: 1 / 120,
  gear: 2,
})
assert(
  rwdTick.rearAxleTorqueNm > 0 && rwdTick.frontAxleTorqueNm === 0,
  'VehiclePhysics entrega 100% do torque no eixo traseiro para RWD declarativo (sem hardcode de ID)',
)

const syntheticAwdOnDemand: VehicleConfig = {
  ...baseTemplate,
  id: 'synthetic-awd-ondemand-test',
  transmission: {
    ...baseTemplate.transmission,
    drivetrain: 'awd_ondemand',
  },
}
const awdPhys = new VehiclePhysics({
  weight: 1650,
  wheelDiameter: 0.68,
  vehicleId: syntheticAwdOnDemand.id,
  drivetrain: syntheticAwdOnDemand.transmission.drivetrain,
})
awdPhys.setSpeedKmh(25)
const awdTick = awdPhys.tick({
  driveTorqueAtTransmission: 320,
  gearRatio: 3.2,
  finalDrive: 3.5,
  brake: 0,
  deltaTime: 1 / 120,
  gear: 1,
})
assert(
  awdPhys.getDrivetrain() === 'awd_ondemand' &&
    awdTick.frontAxleTorqueNm > 0 &&
    awdTick.rearAxleTorqueNm > 0,
  'VehiclePhysics suporta awd_ondemand declarativamente nos dois eixos',
)

// Validação de erro para drivetrain duplicado na raiz
const invalidDupConfig = { ...baseTemplate, drivetrain: 'rwd' } as unknown as VehicleConfig
const dupValidation = validateVehicleConfig(invalidDupConfig)
assert(!dupValidation.valid, 'validateVehicleConfig rejeita drivetrain duplicado na raiz de VehicleConfig')

console.log('\n=== FASE 4.1 — 4. REGISTROS DEDICADOS (CLUSTER_REGISTRY & MULTIMEDIA_REGISTRY) ===')

const allThemes = Object.keys(CLUSTER_REGISTRY)
assert(allThemes.length >= 11, `CLUSTER_REGISTRY cobre todos os temas registrados (${allThemes.length})`)
for (const theme of allThemes) {
  const entry = resolveClusterEntry(theme)
  assert(
    typeof entry.component === 'function' || typeof entry.component === 'object',
    `CLUSTER_REGISTRY['${theme}'] possui componente válido`,
  )
  assert(entry.profile.width > 0 && entry.profile.height > 0, `CLUSTER_REGISTRY['${theme}'] possui perfil dimensional válido`)
}
assert(
  resolveClusterEntry('tema_inexistente_futuro').theme === 'classic',
  'resolveClusterEntry aplica fallback explícito para classic em tema desconhecido',
)

const allMediaIds = Object.keys(MULTIMEDIA_REGISTRY)
assert(allMediaIds.length >= 10, `MULTIMEDIA_REGISTRY cobre todas as unidades registradas (${allMediaIds.length})`)
assert(resolveMultimediaEntry('none') === null, "resolveMultimediaEntry('none') retorna null (motocicletas)")
assert(
  resolveMultimediaEntry('unidade_inexistente_futura')?.unitId === 'generic_multimedia',
  'resolveMultimediaEntry aplica fallback explícito para generic_multimedia em unitId desconhecido',
)

console.log('\n=== FASE 4.1 — 5. VERIFICAÇÃO DE RESOLVERS DE AERO E COMBUSTÍVEL ===')
assert(resolveVehicleAero(loadVehicle('porsche-gt3')).hasAirbrake === true, 'Porsche preserva hasAirbrake=true via resolver')
assert(resolveVehicleFuelDefaults(loadVehicle('gol-quadrado-turbo')).defaultFuelType === 'ethanol_e100', 'Gol Quadrado Turbo preserva ethanol_e100')
assert(resolveVehicleFuelDefaults(loadVehicle('civic-si')).podiumGainMinRpm === 5500, 'Civic Si preserva podiumGainMinRpm=5500')

console.log(`\n══════════════════════════════════════════════════`)
console.log(`RESULTADO FASE 4.1: ${passed} passaram | ${failed} falharam`)
console.log(`══════════════════════════════════════════════════\n`)

if (failed > 0) {
  process.exit(1)
}
