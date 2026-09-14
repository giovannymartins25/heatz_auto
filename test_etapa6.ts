/**
 * Bateria de Testes — ETAPA 6: DASHBOARD, INSTRUMENTAÇÃO E FEEDBACK VISUAL
 *
 * Valida:
 * TESTE A — RPM (tacômetro acompanha RPM real, redline por veículo)
 * TESTE B — VELOCIDADE (velocímetro acompanha velocidade física real do VehiclePhysics)
 * TESTE C — MARCHAS (Gol 1-5/N/R, CB1000R 1-6/N, Yaris AUTO D/N/R, Yaris MANUAL M1-M7)
 * TESTE D — STALL (motor estolado reflete STALLED e aciona Check Engine / Óleo)
 * TESTE E — START (transição OFF -> STARTING -> RUNNING)
 * TESTE F — YARIS AUTO (D + ECO, D + NORMAL, D + SPORT)
 * TESTE G — YARIS MANUAL (M1 -> M2 -> M3)
 * TESTE H — TCS (TCS ON, TCS OFF e intervenção piscante)
 * TESTE I — PEDAIS (throttle, brake, clutch presente apenas em manuais)
 * TESTE J — SHIFT LIGHT E TEMAS (offset configurável por veículo, temas classic/modern/motorcycle)
 */

import { DashboardSystem } from './src/systems/dashboard'
import type { DashboardInput } from './src/systems/dashboard'
import type { VehicleConfig } from './src/types'

// Mock de configurações reais dos 3 veículos
const golConfig: VehicleConfig = {
  id: 'gol-g6',
  info: {
    name: 'Gol G6 1.6 MSI',
    brand: 'Volkswagen',
    model: 'Gol',
    year: 2016,
    category: 'car',
    weight: 1075,
    wheelDiameter: 0.59,
  },
  engine: {
    maxPower: 120,
    maxPowerRpm: 6000,
    maxTorque: 165,
    maxTorqueRpm: 3500,
    maxRpm: 6500,
    idleRpm: 850,
    revLimiter: 6400,
    flywheelMass: 8.5,
    engineBrakeFactor: 0.3,
    torqueCurve: [],
  },
  transmission: {
    type: 'manual',
    gearCount: 5,
    gearRatios: [],
    reverseRatio: 3.167,
    finalDrive: 4.062,
    hasClutch: true,
  },
  audio: { useSamples: false, synthConfig: { baseFrequency: 65, harmonics: [], gainIdle: 0.1, gainMax: 0.7 } },
  dashboard: {
    type: 'default',
    theme: 'classic',
    tachometerMax: 8000,
    speedometerMax: 220,
    redlineStart: 6000,
    shiftLightOffsetRpm: 500,
    fuelCapacity: 55,
  },
}

const yarisConfig: VehicleConfig = {
  id: 'yaris-2019',
  info: {
    name: 'Toyota Yaris 1.5 XLS',
    brand: 'Toyota',
    model: 'Yaris',
    year: 2019,
    category: 'car',
    weight: 1130,
    wheelDiameter: 0.60,
  },
  engine: {
    maxPower: 110,
    maxPowerRpm: 5600,
    maxTorque: 146,
    maxTorqueRpm: 4000,
    maxRpm: 6400,
    idleRpm: 750,
    revLimiter: 6300,
    flywheelMass: 7.5,
    engineBrakeFactor: 0.25,
    torqueCurve: [],
  },
  transmission: {
    type: 'cvt',
    isSimulatedGears: true,
    hasManualMode: true,
    gearCount: 7,
    gearRatios: [],
    reverseRatio: 2.6,
    finalDrive: 5.1,
    hasClutch: false,
    supportedModes: ['eco', 'normal', 'sport'],
    tcs: { enabled: true },
  },
  audio: { useSamples: false, synthConfig: { baseFrequency: 58, harmonics: [], gainIdle: 0.1, gainMax: 0.7 } },
  dashboard: {
    type: 'default',
    theme: 'modern',
    tachometerMax: 8000,
    speedometerMax: 220,
    redlineStart: 6200,
    shiftLightOffsetRpm: 400,
    fuelCapacity: 45,
  },
}

const cbConfig: VehicleConfig = {
  id: 'cb1000r',
  info: {
    name: 'Honda CB1000R',
    brand: 'Honda',
    model: 'CB1000R',
    year: 2022,
    category: 'motorcycle',
    weight: 212,
    wheelDiameter: 0.63,
  },
  engine: {
    maxPower: 143,
    maxPowerRpm: 10500,
    maxTorque: 104,
    maxTorqueRpm: 8250,
    maxRpm: 11500,
    idleRpm: 1100,
    revLimiter: 11300,
    flywheelMass: 3.2,
    engineBrakeFactor: 0.25,
    torqueCurve: [],
  },
  transmission: {
    type: 'manual',
    gearCount: 6,
    gearRatios: [],
    reverseRatio: 0,
    finalDrive: 2.625,
    hasClutch: true,
  },
  audio: { useSamples: false, synthConfig: { baseFrequency: 82, harmonics: [], gainIdle: 0.1, gainMax: 0.8 } },
  dashboard: {
    type: 'default',
    theme: 'motorcycle',
    tachometerMax: 12000,
    speedometerMax: 240,
    redlineStart: 10500,
    shiftLightOffsetRpm: 800,
    fuelCapacity: 16.2,
  },
}

function makeInput(overrides: Partial<DashboardInput> = {}): DashboardInput {
  return {
    rpm: 850,
    engineStatus: 'running',
    isRevLimiting: false,
    engineConfig: {
      maxRpm: golConfig.engine.maxRpm,
      idleRpm: golConfig.engine.idleRpm,
      revLimiter: golConfig.engine.revLimiter,
    },
    speed: 0,
    currentGear: 0,
    transmissionMode: 'manual',
    drivingMode: 'normal',
    isKickdown: false,
    hasClutch: true,
    throttle: 0,
    brake: 0,
    clutchPosition: 0,
    tcsEnabled: true,
    tcsIntervening: false,
    tcsInterventionLevel: 0,
    dashboardConfig: golConfig.dashboard,
    ...overrides,
  }
}

console.log('═══════════════════════════════════════════════════════════════')
console.log('         HEATZ AUTO — BATERIA DE TESTES — ETAPA 6              ')
console.log('   DASHBOARD, INSTRUMENTAÇÃO E FEEDBACK VISUAL (SVG/MODULAR)    ')
console.log('═══════════════════════════════════════════════════════════════\n')

let passCount = 0

// TESTE A — RPM & Redline por Veículo
{
  const tGol = DashboardSystem.computeTelemetry(makeInput({ rpm: 3000, dashboardConfig: golConfig.dashboard }))
  const tYaris = DashboardSystem.computeTelemetry(makeInput({ rpm: 3000, dashboardConfig: yarisConfig.dashboard }))
  const tCb = DashboardSystem.computeTelemetry(makeInput({ rpm: 3000, dashboardConfig: cbConfig.dashboard }))

  const pass =
    tGol.tachometer.redlineStart === 6000 &&
    tYaris.tachometer.redlineStart === 6200 &&
    tCb.tachometer.redlineStart === 10500 &&
    tGol.tachometer.rpm === 3000 &&
    tGol.tachometer.needleAngle > -210 &&
    tGol.tachometer.needleAngle < 30

  console.log(`[TESTE A — RPM & REDLINE] Tacômetro e redlines específicos: ${pass ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  Gol Redline: ${tGol.tachometer.redlineStart} | Yaris: ${tYaris.tachometer.redlineStart} | CB1000R: ${tCb.tachometer.redlineStart}`)
  if (pass) passCount++
}

// TESTE B — Velocidade real do VehiclePhysics
{
  const t1 = DashboardSystem.computeTelemetry(makeInput({ speed: 45.6, dashboardConfig: golConfig.dashboard }))
  const t2 = DashboardSystem.computeTelemetry(makeInput({ speed: 120.3, dashboardConfig: golConfig.dashboard }))

  const pass = t1.speedometer.speed === 45.6 && t2.speedometer.speed === 120.3 && t2.speedometer.needleAngle > t1.speedometer.needleAngle
  console.log(`[TESTE B — VELOCIDADE] Velocímetro reflete velocidade física real: ${pass ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  V1: ${t1.speedometer.speed} km/h (ang: ${t1.speedometer.needleAngle.toFixed(1)}°) | V2: ${t2.speedometer.speed} km/h (ang: ${t2.speedometer.needleAngle.toFixed(1)}°)`)
  if (pass) passCount++
}

// TESTE C — Marchas e Relações por Veículo
{
  const tGol1 = DashboardSystem.computeTelemetry(makeInput({ currentGear: 1, transmissionMode: 'manual' }))
  const tGolN = DashboardSystem.computeTelemetry(makeInput({ currentGear: 0, transmissionMode: 'manual' }))
  const tGolR = DashboardSystem.computeTelemetry(makeInput({ currentGear: -1, transmissionMode: 'manual' }))
  const tCb6 = DashboardSystem.computeTelemetry(makeInput({ currentGear: 6, transmissionMode: 'manual' }))

  const pass =
    tGol1.gear.label === '1' &&
    tGolN.gear.label === 'N' &&
    tGolR.gear.label === 'R' &&
    tCb6.gear.label === '6'

  console.log(`[TESTE C — MARCHAS CONVENCIONAIS] Gol e CB1000R formatados: ${pass ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  Gol 1: '${tGol1.gear.label}' | Gol N: '${tGolN.gear.label}' | Gol R: '${tGolR.gear.label}' | CB 6: '${tCb6.gear.label}'`)
  if (pass) passCount++
}

// TESTE D — STALL (Motor morre)
{
  const tStalled = DashboardSystem.computeTelemetry(makeInput({ engineStatus: 'stalled', rpm: 0 }))
  const pass =
    tStalled.engine.status === 'STALLED' &&
    tStalled.engine.isStalled === true &&
    tStalled.warningLights.checkEngine === true &&
    tStalled.warningLights.oil === true &&
    tStalled.warningLights.battery === true

  console.log(`[TESTE D — STALL] Status STALLED e luzes Check Engine/Óleo/Bateria: ${pass ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  Status: ${tStalled.engine.status} | CheckEngine: ${tStalled.warningLights.checkEngine} | Óleo: ${tStalled.warningLights.oil}`)
  if (pass) passCount++
}

// TESTE E — START (Transições de estado do motor)
{
  const tOff = DashboardSystem.computeTelemetry(makeInput({ engineStatus: 'off', rpm: 0 }))
  const tStart = DashboardSystem.computeTelemetry(makeInput({ engineStatus: 'starting', rpm: 350 }))
  const tRun = DashboardSystem.computeTelemetry(makeInput({ engineStatus: 'running', rpm: 850 }))

  const pass =
    tOff.engine.status === 'OFF' &&
    tStart.engine.status === 'STARTING' &&
    tRun.engine.status === 'RUNNING' &&
    tRun.engine.isRunning === true

  console.log(`[TESTE E — START/RUNNING] Transições OFF -> STARTING -> RUNNING: ${pass ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  Off: ${tOff.engine.status} | Start: ${tStart.engine.status} | Run: ${tRun.engine.status}`)
  if (pass) passCount++
}

// TESTE F — Yaris AUTO (D + ECO, D + NORMAL, D + SPORT)
{
  const tEco = DashboardSystem.computeTelemetry(makeInput({ currentGear: 2, transmissionMode: 'automatic', drivingMode: 'eco' }))
  const tNorm = DashboardSystem.computeTelemetry(makeInput({ currentGear: 3, transmissionMode: 'automatic', drivingMode: 'normal' }))
  const tSport = DashboardSystem.computeTelemetry(makeInput({ currentGear: 4, transmissionMode: 'automatic', drivingMode: 'sport' }))

  const pass =
    tEco.gear.label === 'D2' && tEco.gear.subLabel === 'ECO' &&
    tNorm.gear.label === 'D3' && tNorm.gear.subLabel === 'NORMAL' &&
    tSport.gear.label === 'D4' && tSport.gear.subLabel === 'SPORT'

  console.log(`[TESTE F — YARIS AUTO] Modos de condução D + ECO/NORMAL/SPORT: ${pass ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  Eco: ${tEco.gear.label} (${tEco.gear.subLabel}) | Norm: ${tNorm.gear.label} (${tNorm.gear.subLabel}) | Sport: ${tSport.gear.label} (${tSport.gear.subLabel})`)
  if (pass) passCount++
}

// TESTE G — Yaris MANUAL SIMULATED (M1 -> M2 -> M3)
{
  const tM1 = DashboardSystem.computeTelemetry(makeInput({ currentGear: 1, transmissionMode: 'manual_simulated' }))
  const tM2 = DashboardSystem.computeTelemetry(makeInput({ currentGear: 2, transmissionMode: 'manual_simulated' }))
  const tM3 = DashboardSystem.computeTelemetry(makeInput({ currentGear: 3, transmissionMode: 'manual_simulated' }))

  const pass =
    tM1.gear.label === 'M1' &&
    tM2.gear.label === 'M2' &&
    tM3.gear.label === 'M3' &&
    tM1.gear.transmissionMode === 'manual_simulated'

  console.log(`[TESTE G — YARIS MANUAL SIMULATED] Relações virtuais M1→M2→M3: ${pass ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  M1: '${tM1.gear.label}' | M2: '${tM2.gear.label}' | M3: '${tM3.gear.label}'`)
  if (pass) passCount++
}

// TESTE H — TCS (TCS ON, OFF, Intervenção)
{
  const tcsOn = DashboardSystem.computeTelemetry(makeInput({ tcsEnabled: true, tcsIntervening: false }))
  const tcsOff = DashboardSystem.computeTelemetry(makeInput({ tcsEnabled: false, tcsIntervening: false }))
  const tcsSlip = DashboardSystem.computeTelemetry(makeInput({ tcsEnabled: true, tcsIntervening: true, tcsInterventionLevel: 0.5 }))

  const pass =
    tcsOn.tcs.statusLabel === 'TCS ON' && !tcsOn.warningLights.tcs &&
    tcsOff.tcs.statusLabel === 'TCS OFF' && tcsOff.warningLights.tcs &&
    tcsSlip.tcs.intervening === true && tcsSlip.warningLights.tcsFlash === true

  console.log(`[TESTE H — TCS] Indicadores ON/OFF e intervenção piscante: ${pass ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  TCS ON: ${tcsOn.tcs.statusLabel} | TCS OFF: ${tcsOff.tcs.statusLabel} | Slip Intervening: ${tcsSlip.warningLights.tcsFlash}`)
  if (pass) passCount++
}

// TESTE I — Pedais (Throttle, Brake, Clutch apenas em manuais)
{
  const tGolPedals = DashboardSystem.computeTelemetry(makeInput({
    hasClutch: true,
    throttle: 0.75,
    brake: 0.30,
    clutchPosition: 0.50,
  }))

  const tYarisPedals = DashboardSystem.computeTelemetry(makeInput({
    hasClutch: false,
    throttle: 0.80,
    brake: 0.10,
    clutchPosition: 0,
  }))

  const pass =
    tGolPedals.pedals.throttlePercent === 75 &&
    tGolPedals.pedals.brakePercent === 30 &&
    tGolPedals.pedals.clutchPercent === 50 &&
    tGolPedals.pedals.hasClutch === true &&
    tYarisPedals.pedals.clutchPercent === null &&
    tYarisPedals.pedals.hasClutch === false

  console.log(`[TESTE I — PEDAIS] Leituras 0-100% e Clutch ausente no Yaris: ${pass ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  Gol (hasClutch: true): Thr=${tGolPedals.pedals.throttlePercent}% Brk=${tGolPedals.pedals.brakePercent}% Clu=${tGolPedals.pedals.clutchPercent}%`)
  console.log(`  Yaris (hasClutch: false): Thr=${tYarisPedals.pedals.throttlePercent}% Brk=${tYarisPedals.pedals.brakePercent}% Clu=${tYarisPedals.pedals.clutchPercent}`)
  if (pass) passCount++
}

// TESTE J — Shift Light e Temas (Offset configurável por veículo)
{
  // Gol: redlineStart = 6000, offset = 500 -> ativa a partir de 5500 RPM
  const tGolBelow = DashboardSystem.computeTelemetry(makeInput({ rpm: 5400, dashboardConfig: golConfig.dashboard }))
  const tGolAbove = DashboardSystem.computeTelemetry(makeInput({ rpm: 5600, dashboardConfig: golConfig.dashboard }))

  // CB1000R: redlineStart = 10500, offset = 800 -> ativa a partir de 9700 RPM
  const tCbBelow = DashboardSystem.computeTelemetry(makeInput({ rpm: 9500, dashboardConfig: cbConfig.dashboard }))
  const tCbAbove = DashboardSystem.computeTelemetry(makeInput({ rpm: 9800, dashboardConfig: cbConfig.dashboard }))

  const pass =
    !tGolBelow.shiftLight.isActive &&
    tGolAbove.shiftLight.isActive &&
    !tCbBelow.shiftLight.isActive &&
    tCbAbove.shiftLight.isActive &&
    tGolAbove.theme === 'classic' &&
    tCbAbove.theme === 'motorcycle'

  console.log(`[TESTE J — SHIFT LIGHT & TEMAS] Offset por veículo e temas modulares: ${pass ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  Gol Shift: 5400rpm=${tGolBelow.shiftLight.isActive} | 5600rpm=${tGolAbove.shiftLight.isActive} (tema: ${tGolAbove.theme})`)
  console.log(`  CB Shift: 9500rpm=${tCbBelow.shiftLight.isActive} | 9800rpm=${tCbAbove.shiftLight.isActive} (tema: ${tCbAbove.theme})`)
  if (pass) passCount++
}

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`  RESULTADO: ${passCount}/10 TESTES PASSARAM COM SUCESSO!     `)
console.log('═══════════════════════════════════════════════════════════════\n')

if (passCount !== 10) {
  process.exit(1)
}
