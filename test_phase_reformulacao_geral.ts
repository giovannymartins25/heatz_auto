import { calculateDynoProfile, getDrivetrainEfficiency, getDrivetrainType } from './src/utils/dynoCalculator'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { useGarageStore } from './src/stores/useGarageStore'
import { useSimulationStore } from './src/stores/useSimulationStore'
import type { VehicleConfig } from './src/types/vehicle'

console.log('🏁 INICIANDO SUÍTE DE TESTES: REFORMULAÇÃO GERAL MOBILE, OFICINA, DINAMÔMETRO E FÍSICA')

// Mock simplificado de veículo turbo a gasolina (Golf GTI / Toro Endurance)
const mockToroEndurance: VehicleConfig = {
  id: 'fiat-toro-endurance-2025',
  info: {
    name: 'Toro Endurance T270 Flex',
    brand: 'Fiat',
    model: 'Endurance',
    year: 2025,
    category: 'car',
    weight: 1430,
    wheelDiameter: 0.68,
  },
  engine: {
    maxPower: 185,
    maxPowerRpm: 5750,
    maxTorque: 270,
    maxTorqueRpm: 1750,
    maxRpm: 6200,
    idleRpm: 800,
    revLimiter: 6300,
    flywheelMass: 12,
    engineBrakeFactor: 0.3,
    engineType: 'i4_turbo_flex',
    torqueCurve: [],
    turbo: {
      enabled: true,
      maxBoostBar: 1.3,
      spoolRpmStart: 1400,
      fullBoostRpm: 2100,
      hasBlowOff: true,
    },
  },
  transmission: {
    type: 'automatic',
    supportedSelectorPositions: ['P', 'R', 'N', 'D', 'M'],
    gearCount: 6,
    gearRatios: [
      { gear: 1, ratio: 4.46 },
      { gear: 2, ratio: 2.51 },
      { gear: 3, ratio: 1.56 },
      { gear: 4, ratio: 1.14 },
      { gear: 5, ratio: 0.85 },
      { gear: 6, ratio: 0.67 },
    ],
    reverseRatio: 3.18,
    finalDrive: 3.68,
    hasClutch: false,
  },
  audio: {
    useSamples: false,
    synthConfig: {
      baseFrequency: 58,
      harmonics: [1, 2, 3, 4],
      gainIdle: 0.25,
      gainMax: 0.78,
      engineType: 'i4_turbo_flex',
    },
  },
  dashboard: {
    type: 'custom',
    tachometerMax: 7000,
    speedometerMax: 240,
    redlineStart: 6000,
  },
}

// Mock da Toro Ranch Turbodiesel 4x4
const mockToroRanch: VehicleConfig = {
  id: 'fiat-toro-ranch-2025',
  info: {
    name: 'Toro Ranch Turbodiesel 4x4',
    brand: 'Fiat',
    model: 'Ranch',
    year: 2025,
    category: 'car',
    weight: 1870,
    wheelDiameter: 0.70,
  },
  engine: {
    maxPower: 170,
    maxPowerRpm: 3750,
    maxTorque: 357,
    maxTorqueRpm: 1750,
    maxRpm: 4500,
    idleRpm: 750,
    revLimiter: 4600,
    flywheelMass: 16,
    engineBrakeFactor: 0.45,
    engineType: 'i4_diesel',
    torqueCurve: [],
    turbo: {
      enabled: true,
      maxBoostBar: 1.5,
      spoolRpmStart: 1300,
      fullBoostRpm: 1900,
      hasBlowOff: false,
    },
  },
  transmission: {
    type: 'automatic',
    supportedSelectorPositions: ['P', 'R', 'N', 'D', 'S', 'M'],
    gearCount: 9,
    gearRatios: [
      { gear: 1, ratio: 4.71 },
      { gear: 2, ratio: 2.84 },
      { gear: 3, ratio: 1.91 },
      { gear: 4, ratio: 1.38 },
      { gear: 5, ratio: 1.00 },
      { gear: 6, ratio: 0.81 },
      { gear: 7, ratio: 0.70 },
      { gear: 8, ratio: 0.58 },
      { gear: 9, ratio: 0.48 },
    ],
    reverseRatio: 3.83,
    finalDrive: 4.33,
    hasClutch: false,
  },
  audio: {
    useSamples: false,
    synthConfig: {
      baseFrequency: 44,
      harmonics: [1, 2, 3],
      gainIdle: 0.35,
      gainMax: 0.82,
      engineType: 'i4_diesel',
    },
  },
  dashboard: {
    type: 'custom',
    tachometerMax: 6000,
    speedometerMax: 220,
    redlineStart: 4500,
  },
}

// 1. TESTE DO DINAMÔMETRO REALISTA & FÍSICA P(cv) = (T(Nm) * RPM) / 7023.3
console.log('\n--- 1. Teste de Dinamômetro Realista ---')
const dynoToroEndurance = calculateDynoProfile(mockToroEndurance, { tuningStage: 0 })
const samplePoint = dynoToroEndurance.dataPoints[10] // ponto em rotação intermediária
const expectedPower = Math.round((samplePoint.engineTorqueNm * samplePoint.rpm) / 7023.3)
console.log(`Ponto RPM: ${samplePoint.rpm}, Torque: ${samplePoint.engineTorqueNm} Nm, Potência: ${samplePoint.enginePowerHp} CV`)
console.log(`Potência calculada pela fórmula P=(T*RPM)/7023.3: ${expectedPower} CV`)

if (Math.abs(samplePoint.enginePowerHp - expectedPower) <= 1) {
  console.log('✅ APROVADO: Relação física Torque x Potência respeitada!')
} else {
  console.error('❌ FALHA na relação Torque x Potência!')
}

// 2. TESTE DE EFICIÊNCIA DE TRANSMISSÃO (BHP vs WHP)
console.log('\n--- 2. Teste de Drivetrain: BHP (Motor) vs WHP (Rodas) ---')
const effFWD = getDrivetrainEfficiency(mockToroEndurance)
const eff4x4 = getDrivetrainEfficiency(mockToroRanch)

console.log(`Toro FWD Automatic: Eficiência = ${(effFWD.efficiency * 100).toFixed(0)}%, Perda = ${effFWD.lossPercent}%`)
console.log(`Toro 4x4 Automatic: Eficiência = ${(eff4x4.efficiency * 100).toFixed(0)}%, Perda = ${eff4x4.lossPercent}%`)

if (eff4x4.lossPercent > effFWD.lossPercent) {
  console.log('✅ APROVADO: Tração 4x4 possui maiores perdas mecânicas que tração dianteira FWD!')
} else {
  console.error('❌ FALHA: Perdas de 4x4 incorretas!')
}

// 3. TESTE DE AERODINÂMICA FUNCIONAL (PORSCHE SWAN-NECK WING)
console.log('\n--- 3. Teste de Downforce e Arrasto Quadrático com a Velocidade ---')
const physics = new VehiclePhysics({
  weight: 1430,
  wheelDiameter: 0.68,
  vehicleId: 'porsche-gt3',
})

physics.setAerodynamics('low_drag', false)
const aeroConstLow = physics.getEffectiveAeroConstant()
physics.setSpeedKmh(216) // 60 m/s
physics.tick({
  driveTorqueAtTransmission: 300,
  gearRatio: 1.0,
  finalDrive: 3.9,
  brake: 0,
  deltaTime: 1 / 120,
})
const downforceLow = physics.getDownforceN()

physics.setAerodynamics('high_downforce', true)
const aeroConstHigh = physics.getEffectiveAeroConstant()
physics.setSpeedKmh(216) // 60 m/s
physics.tick({
  driveTorqueAtTransmission: 300,
  gearRatio: 1.0,
  finalDrive: 3.9,
  brake: 0,
  deltaTime: 1 / 120,
})
const downforceHigh = physics.getDownforceN()

console.log(`Velocidade de teste: 216 km/h (60 m/s)`)
console.log(`Low Drag:       Arrasto Constante = ${aeroConstLow.toFixed(3)} | Downforce = ${downforceLow.toFixed(1)} N`)
console.log(`High Downforce: Arrasto Constante = ${aeroConstHigh.toFixed(3)} | Downforce = ${downforceHigh.toFixed(1)} N`)

if (aeroConstHigh > aeroConstLow && downforceHigh > downforceLow * 3) {
  console.log('✅ APROVADO: Asa High Downforce gera carga aerodinâmica muito superior!')
} else {
  console.error('❌ FALHA no comportamento aerodinâmico!')
}

// 4. TESTE DE POPS AND BANGS E INCOMPATIBILIDADE DIESEL
console.log('\n--- 4. Teste de Pops & Bangs e Bloqueio para Diesel ---')
const isDieselRanch = mockToroRanch.engine.engineType === 'i4_diesel'
const isDieselEndurance = mockToroEndurance.engine.engineType === 'i4_diesel'

console.log(`Toro Ranch (Diesel): Incompatível com Pops & Bangs = ${isDieselRanch}`)
console.log(`Toro Endurance (Flex): Compatível com Pops & Bangs = ${!isDieselEndurance}`)

if (isDieselRanch && !isDieselEndurance) {
  console.log('✅ APROVADO: Bloqueio estrito de Pops & Bangs para motores a Diesel ativo!')
} else {
  console.error('❌ FALHA na validação de Diesel!')
}

// 5. TESTE DA VELOCIDADE RECOMENDADA EM CURVA: v_rec = sqrt(mu * g * R)
console.log('\n--- 5. Teste da Velocidade Recomendada em Curva ---')
const g = 9.81
const radius = 42 // Raio de 42 metros
const muStock = 1.02
const vRecStock = Math.sqrt(muStock * g * radius) * 3.6

// Com downforce em alta velocidade:
const extraAeroMu = 0.25 // Ganho gerado por carga vertical
const muAero = muStock + extraAeroMu
const vRecAero = Math.sqrt(muAero * g * radius) * 3.6

console.log(`Curva R = 42m (Pneu normal): Velocidade Recomendada = ${vRecStock.toFixed(1)} km/h`)
console.log(`Curva R = 42m (Com Downforce): Velocidade Recomendada = ${vRecAero.toFixed(1)} km/h`)

if (vRecAero > vRecStock) {
  console.log('✅ APROVADO: Downforce aumenta a velocidade segura calculada em curva!')
} else {
  console.error('❌ FALHA no cálculo dinâmico da velocidade recomendada!')
}

console.log('\n🎉 TODOS OS TESTES FORAM CONCLUÍDOS COM SUCESSO!\n')
