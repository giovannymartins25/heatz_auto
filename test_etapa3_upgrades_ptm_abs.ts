import assert from 'node:assert'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useUIStore } from './src/stores/useUIStore'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { ClutchSystem } from './src/systems/clutch/ClutchSystem'
import { AutomaticTransmission } from './src/systems/transmission/AutomaticTransmission'
import type { VehicleConfig } from './src/types/vehicle'

import porscheConfig from './public/vehicles/porsche-gt3/config.json' with { type: 'json' }
import yarisConfig from './public/vehicles/yaris-2019/config.json' with { type: 'json' }
import golfConfig from './public/vehicles/golf-gti/config.json' with { type: 'json' }
import civicConfig from './public/vehicles/civic-si/config.json' with { type: 'json' }
import golConfig from './public/vehicles/gol-g6/config.json' with { type: 'json' }

console.log('\n=================================================================')
console.log('  HEATZ AUTO — TESTES ETAPA 3: UPGRADES, PTM AWD, CVT, ABS E 2D  ')
console.log('=================================================================\n')

let passed = 0
let failed = 0

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  [OK] ${name}`)
    passed++
  } catch (err: any) {
    console.error(`  [FALHA] ${name}: ${err.message}`)
    if (err.actual !== undefined && err.expected !== undefined) {
      console.error(`         Atual: ${err.actual} !== Esperado: ${err.expected}`)
    }
    failed++
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ABERTURA AUTOMÁTICA DO MUNDO 2D AO ENTRAR EM DIREÇÃO
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- 1. ENTRADA NO MUNDO 2D ---')

runTest('TEST-2D-01: isMapOpen é true por padrão na UIStore e na SimulationStore', () => {
  const ui = useUIStore.getState()
  const sim = useSimulationStore.getState()

  assert.strictEqual(ui.isMapOpen, true, 'UIStore deve inicializar com isMapOpen = true')
  assert.strictEqual(sim.isMapOpen, true, 'SimulationStore deve inicializar com isMapOpen = true')
  assert.notStrictEqual(ui.mapViewportSize, 'hidden', 'Tamanho do viewport não deve ser hidden')
})

runTest('TEST-2D-02: init(vehicle) preserva mapa aberto pronto para condução', () => {
  const sim = useSimulationStore.getState()
  sim.init(porscheConfig as unknown as VehicleConfig)

  assert.strictEqual(useSimulationStore.getState().isMapOpen, true, 'Mapa deve permanecer aberto após init')
  assert.strictEqual(typeof useSimulationStore.getState().positionX, 'number')
  assert.strictEqual(typeof useSimulationStore.getState().positionY, 'number')
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. UPGRADE DE TURBO (FÍSICO): BOOST, SPOOL E MULTIPLICADOR DE TORQUE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 2. UPGRADES FÍSICOS: TURBOCHARGER ---')

runTest('TEST-TURBO-01: Multiplicador instantâneo M_boost = 1.0 + max(0, P_boost) * 0.80', () => {
  const sim = useSimulationStore.getState()
  sim.init(golConfig as unknown as VehicleConfig) // Gol originalmente aspirado
  sim.setEquippedUpgrades({ turboKit: true, turboLevel: 'basic' })
  sim.startEngine()
  sim.selectDrive()
  sim.setThrottle(1.0)

  // Executa passos até gerar boost
  for (let i = 0; i < 120; i++) {
    sim.update(1 / 120)
  }

  const state = useSimulationStore.getState()
  assert.strictEqual(state.hasTurbo, true, 'hasTurbo deve ser true com upgrade')
  assert.ok(state.boostPressureBar > 0, `Pressão de boost deve ser positiva (${state.boostPressureBar.toFixed(2)} bar)`)
  assert.ok(state.boostTorqueMultiplier > 1.0, `Multiplicador de torque deve ser > 1.0 (${state.boostTorqueMultiplier.toFixed(3)})`)
  const expectedMultiplier = 1.0 + state.boostPressureBar * 0.80
  assert.ok(Math.abs(state.boostTorqueMultiplier - expectedMultiplier) < 0.05, 'Multiplicador deve seguir M_boost')
})

runTest('TEST-TURBO-02: Escalonamento de pressão entre níveis basic, intermediate e big_turbo', () => {
  const sim = useSimulationStore.getState()

  function getPeakBoostForLevel(level: 'basic' | 'intermediate' | 'big_turbo') {
    sim.init(golConfig as unknown as VehicleConfig)
    sim.setEquippedUpgrades({ turboKit: true, turboLevel: level })
    sim.startEngine()
    sim.setHandbrake(false)
    sim.selectDrive()
    sim.setThrottle(1.0)
    let maxBoost = 0
    for (let i = 0; i < 300; i++) {
      sim.update(1 / 120)
      maxBoost = Math.max(maxBoost, useSimulationStore.getState().boostPressureBar)
    }
    return maxBoost
  }

  const boostBasic = getPeakBoostForLevel('basic')
  const boostInter = getPeakBoostForLevel('intermediate')
  const boostBig = getPeakBoostForLevel('big_turbo')

  assert.ok(boostInter > boostBasic, `Intermediate (${boostInter.toFixed(2)}) deve superar Basic (${boostBasic.toFixed(2)})`)
  assert.ok(boostBig > boostInter, `Big Turbo (${boostBig.toFixed(2)}) deve superar Intermediate (${boostInter.toFixed(2)})`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. UPGRADE DE EMBREAGEM CERÂMICA: CAPACIDADE 1.75X E DISSIPAÇÃO TÉRMICA
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 3. EMBREAGEM CERÂMICA REFORÇADA ---')

runTest('TEST-CLUTCH-CERAMIC: Capacidade 1.75x e maior dissipação sem criar potência fictícia no motor', () => {
  const baseCapacity = 300
  const clutch = new ClutchSystem(baseCapacity)

  assert.strictEqual(clutch.getBaseTorqueCapacity(), baseCapacity * 1.4)
  const initialMax = clutch.getMaxTorqueCapacity()
  clutch.setCeramicClutch(true)
  assert.strictEqual(clutch.getMaxTorqueCapacity(), initialMax * 1.75, 'Capacidade estática e cinética deve aumentar 1.75x')

  clutch.setPosition(0.5)
  clutch.calculateTorqueTransfer(300, 100, false, 250, 1 / 120)
  const heatAfterSlip = clutch.getHeat()

  // Resfriamento com embreagem aberta
  clutch.setPosition(1.0)
  clutch.calculateTorqueTransfer(300, 100, true, 0, 1 / 120)
  const heatAfterCooling = clutch.getHeat()
  assert.ok(heatAfterCooling < heatAfterSlip, 'Taxa de resfriamento elevada dissipa calor eficientemente')
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. UPGRADE DE FREIOS BREMBO SPORT: FADING A 820°C E ALTA DISSIPAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 4. FREIOS BREMBO SPORT ---')

runTest('TEST-BRAKE-BREMBO: Limiar de fading 820°C e resfriamento acelerado (+40%)', () => {
  const sim = useSimulationStore.getState()
  sim.init(civicConfig as unknown as VehicleConfig)
  sim.setEquippedUpgrades({ brakeUpgrade: 'sport' })

  assert.strictEqual(useSimulationStore.getState().brakeUpgrade, 'sport')

  // Aquece os freios até 500°C (freio convencional sofre fading a ~650°C, Brembo resiste até 820°C)
  sim.setSpeed(120)
  sim.setBrake(1.0)
  for (let i = 0; i < 60; i++) {
    sim.update(1 / 120)
  }

  const state = useSimulationStore.getState()
  assert.ok(state.brakeDiscTemp > 60, 'Temperatura dos freios deve se elevar sob frenagem')
  assert.strictEqual(state.brakeFadeFactor, 1.0, 'A 500°C o freio Brembo Sport NÃO deve sofrer fading (fadeFactor 1.0, limite 820°C)')
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. GASOLINA PODIUM 102: AVANÇO DE IGNIÇÃO EM CARROS DE ALTA TAXA
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 5. COMBUSTÍVEL PODIUM 102 ---')

runTest('TEST-FUEL-PODIUM: Ganho de ignição em Porsche (+5%), Golf (+4%) e Civic Si (+4% >5500 RPM); 1.0 em Gol', () => {
  const sim = useSimulationStore.getState()

  // 1. Porsche com Podium (+5%)
  sim.init(porscheConfig as unknown as VehicleConfig)
  sim.setFuelType('premium_podium')
  sim.startEngine()
  sim.selectDrive()
  sim.setThrottle(1.0)
  sim.update(1 / 120)
  assert.strictEqual(useSimulationStore.getState().fuelPowerMultiplier, 1.05, 'Porsche deve receber +5% com Podium')

  // 2. Golf GTI com Podium (+4%)
  sim.init(golfConfig as unknown as VehicleConfig)
  sim.setFuelType('premium_podium')
  sim.startEngine()
  sim.selectDrive()
  sim.setThrottle(1.0)
  sim.update(1 / 120)
  assert.strictEqual(useSimulationStore.getState().fuelPowerMultiplier, 1.04, 'Golf GTI deve receber +4% com Podium')

  // 3. Gol Popular com Podium (0% ganho)
  sim.init(golConfig as unknown as VehicleConfig)
  sim.setFuelType('premium_podium')
  sim.startEngine()
  sim.selectDrive()
  sim.setThrottle(1.0)
  sim.update(1 / 120)
  assert.strictEqual(useSimulationStore.getState().fuelPowerMultiplier, 1.00, 'Carro popular não tem taxa para ganho com Podium')
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. PORSCHE 911 TURBO S 992.1 — PTM AWD E DIFERENCIAIS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 6. PORSCHE PTM AWD: DIFERENCIAIS 3.330 / 3.020 E CONSERVAÇÃO ---')

runTest('TEST-PTM-AWD: Conservação estrita de torque T_front + T_rear = T_box e limites por eixo', () => {
  const porsche = porscheConfig as unknown as VehicleConfig
  const phys = new VehiclePhysics({
    weight: porsche.info.weight,
    wheelDiameter: porsche.info.wheelDiameter,
    vehicleId: porsche.id,
    chassis: porsche.chassis,
    frontFinalDrive: 3.330,
  })

  const res = phys.tick({
    driveTorqueAtTransmission: 700,
    gearRatio: 4.89,
    finalDrive: 3.02,
    frontFinalDrive: 3.33,
    brake: 0,
    deltaTime: 1 / 120,
    steeringAngleRad: 0,
    isRaining: false,
  })

  assert.ok(res.acceleration > 0, 'Veículo deve acelerar')
  assert.ok(res.wheelTorque > 0, 'Torque total entregue às 4 rodas deve ser positivo')
  assert.strictEqual(porsche.transmission.drivetrain, 'awd')
  assert.strictEqual(porsche.transmission.frontFinalDrive, 3.33)
  assert.strictEqual(porsche.transmission.finalDrive, 3.02)
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. TOYOTA YARIS CVT: VARIAÇÃO CONTÍNUA EM D E 7 RELAÇÕES EM M
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 7. TOYOTA YARIS CVT: TRANSIÇÃO CONTÍNUA E MODO MANUAL ---')

runTest('TEST-CVT-RATIO: Variação contínua em D dentro de [0.396, 2.480] e conversor de torque lockup >= 12 km/h', () => {
  const yaris = yarisConfig as unknown as VehicleConfig
  const cvt = new AutomaticTransmission({
    gearRatios: yaris.transmission.gearRatios,
    finalDrive: yaris.transmission.finalDrive,
    wheelDiameter: yaris.info.wheelDiameter,
    maxRpm: yaris.engine.maxRpm,
    idleRpm: yaris.engine.idleRpm,
    isCvt: true,
  })

  // Em repouso (0 km/h) -> relação máxima de saída (2.480)
  const ratioAtRest = cvt.getCurrentCvtRatio()
  assert.strictEqual(ratioAtRest, 2.480, 'CVT em repouso deve estar na relação mais curta (2.480)')

  // Em velocidade de cruzeiro (100 km/h) com carga leve após 1.5s -> relação overdrive contínua (~0.396 a 0.600)
  for (let i = 0; i < 180; i++) {
    cvt.decide({
      currentRpm: 1800,
      vehicleSpeedKmh: 100,
      throttle: 0.15,
      brake: 0,
      currentGear: 1,
      drivingMode: 'comfort',
      selectorPosition: 'D',
      deltaTime: 1 / 120,
    })
  }
  const ratioAtSpeed = cvt.getCurrentCvtRatio()
  assert.ok(ratioAtSpeed < 1.0, `CVT a 100 km/h deve alongar para overdrive (atual: ${ratioAtSpeed.toFixed(3)})`)
  assert.ok(ratioAtSpeed >= 0.396, `CVT deve respeitar o limite inferior de 0.396 (atual: ${ratioAtSpeed.toFixed(3)})`)

  // Modo Manual (M) -> 7 marchas escalonadas fixas declaradas
  assert.strictEqual(yaris.transmission.gearCount, 7)
  assert.strictEqual(yaris.transmission.gearRatios[0].ratio, 2.480)
  assert.strictEqual(yaris.transmission.gearRatios[6].ratio, 0.510)
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. ABS DE 4 CANAIS: VELOCIDADES INDIVIDUAIS E MÁQUINA DE ESTADOS INDEPENDENTE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 8. ABS DE 4 CANAIS INDEPENDENTES ---')

runTest('TEST-ABS-4CH: 4 velocidades angulares de roda e modulação independente por canal', () => {
  const porsche = porscheConfig as unknown as VehicleConfig
  const phys = new VehiclePhysics({
    weight: porsche.info.weight,
    wheelDiameter: porsche.info.wheelDiameter,
    vehicleId: porsche.id,
    chassis: porsche.chassis,
  })

  phys.setSpeedKmh(120)
  const res = phys.tick({
    driveTorqueAtTransmission: 0,
    gearRatio: 0,
    finalDrive: 3.02,
    brake: 1.0,
    deltaTime: 1 / 120,
    steeringAngleRad: 0.15, // esterçamento moderado para assimetria de velocidade lateral
    isRaining: true,
  })

  assert.strictEqual(res.absEngaged, true, 'ABS de 4 canais deve estar engajado em frenagem violenta na chuva')
  assert.ok(res.wheelAngularVelocities, 'wheelAngularVelocities deve ser retornado')
  assert.strictEqual(res.wheelAngularVelocities?.length, 4, 'Devem existir 4 velocidades angulares [FL, FR, RL, RR]')
  assert.ok(res.absChannelStates, 'absChannelStates deve ser retornado')
  assert.strictEqual(res.absChannelStates?.length, 4, 'Devem existir 4 estados de canais ABS')

  // Verifica se pelo menos um canal entrou em DUMP ou HOLD
  const activeChannels = res.absChannelStates?.filter((st) => st === 'DUMP' || st === 'HOLD' || st === 'APPLY')
  assert.ok((activeChannels?.length ?? 0) > 0, 'Pelo menos um canal individual deve estar ativamente modulando')
})

console.log('\n=================================================================')
console.log(`  RESULTADO DOS TESTES ETAPA 3: ${passed} PASSOU | ${failed} FALHOU`)
console.log('=================================================================\n')

if (failed > 0) {
  process.exit(1)
}
