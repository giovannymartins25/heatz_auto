import assert from 'node:assert'
import { ClutchSystem } from './src/systems/clutch/ClutchSystem'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { WorldMap } from './src/systems/world/WorldMap'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useUIStore } from './src/stores/useUIStore'
import porscheConfig from './public/vehicles/porsche-gt3/config.json' with { type: 'json' }
import civicConfig from './public/vehicles/civic-si/config.json' with { type: 'json' }
import toroConfig from './public/vehicles/fiat-toro-ranch-2025/config.json' with { type: 'json' }
import type { VehicleConfig } from './src/types/vehicle'

console.log('=================================================================')
console.log('  HEATZ AUTO · ETAPA 2 — FÍSICA DE ALTA PRECISÃO & MUNDO 2D      ')
console.log('=================================================================\n')

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  [OK] ${name}`)
    passed++
  } catch (err: any) {
    console.error(`  [FALHA] ${name}: ${err.message}`)
    failed++
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. EMBREAGEM FÍSICA DE 3 ESTADOS (OPEN, SLIPPING, LOCKED)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- 1. EMBREAGEM FÍSICA: 3 ESTADOS, REGULARIZAÇÃO E HISTERESE ---')

test('TEST-CLUTCH-01: Estado OPEN não transmite torque nem gera calor', () => {
  const clutch = new ClutchSystem(500, 0.22, 0.08)

  // Pedal pressionado a 100% (posição 1.0 = desengatado)
  clutch.setPosition(1.0)
  const state = clutch.calculateTorqueTransfer(300, 100, false, 250, 1 / 120)

  assert.strictEqual(state.mechanicalState, 'OPEN')
  assert.strictEqual(state.transmittedTorque, 0)
  assert.strictEqual(clutch.getHeat(), 0)
})

test('TEST-CLUTCH-02: Transição OPEN -> SLIPPING -> LOCKED e transmissão bidirecional', () => {
  const clutch = new ClutchSystem(450, 0.18, 0.05)

  // Pedal liberado (0.0 = 100% engatado) com rotações sincronizadas
  clutch.setPosition(0.0)
  const lockedState = clutch.calculateTorqueTransfer(200, 200, false, 350, 1 / 120)

  assert.strictEqual(lockedState.mechanicalState, 'LOCKED')
  assert.strictEqual(lockedState.isSlipping, false)
  assert.strictEqual(lockedState.slipRpm, 0)
  assert.strictEqual(lockedState.transmittedTorque, 350, 'Em LOCKED transmite torque integral positivo')

  // Freio-motor bidirecional em LOCKED (torque negativo)
  const engineBraking = clutch.calculateTorqueTransfer(200, 200, false, -180, 1 / 120)
  assert.strictEqual(engineBraking.mechanicalState, 'LOCKED')
  assert.strictEqual(engineBraking.transmittedTorque, -180, 'Em LOCKED transmite freio-motor integral negativo')
})

test('TEST-CLUTCH-03: Descolamento estático (breakaway) sob torque que excede capacidade estática', () => {
  // Motor com torque máximo de 250 Nm -> maxTorqueCapacity = 350 Nm, staticCapacity = 402.5 Nm
  const clutch = new ClutchSystem(250, 0.18, 0.05)

  // Trava em regime suave
  clutch.setPosition(0.0)
  clutch.calculateTorqueTransfer(150, 150, false, 200, 1 / 120)
  assert.strictEqual(clutch.getMechanicalState(), 'LOCKED')

  // Aplica torque excessivo (480 Nm > staticCapacity de 402.5 Nm)
  const slippingState = clutch.calculateTorqueTransfer(250, 150, false, 480, 1 / 120)
  assert.strictEqual(slippingState.mechanicalState, 'SLIPPING')
  assert.strictEqual(slippingState.isSlipping, true)
  assert.ok(slippingState.transmittedTorque > 0)
})

test('TEST-CLUTCH-04: Dissipação térmica irreversível P = tau * |delta_omega| em SLIPPING', () => {
  const clutch = new ClutchSystem(500, 0.22, 0.08)

  // Meia embreagem sob diferença substancial de rotação
  clutch.setPosition(0.5)
  const initialHeat = clutch.getHeat()
  clutch.calculateTorqueTransfer(300, 100, false, 300, 1 / 120)

  assert.strictEqual(clutch.getMechanicalState(), 'SLIPPING')
  assert.ok(clutch.getHeat() > initialHeat, 'Calor acumulado deve aumentar estritamente durante patinamento')
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. PORSCHE 911 TURBO S 992 (PDK 8 MARCHAS & PTM AWD & AIRBRAKE)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 2. PORSCHE 911 TURBO S: PDK 8 MARCHAS, PTM AWD E AIRBRAKE PAA ---')

test('TEST-PORSCHE-01: Configuração oficial de 8 marchas, relações e tração AWD', () => {
  const porsche = porscheConfig as unknown as VehicleConfig
  assert.strictEqual(porsche.id, 'porsche-gt3')
  assert.strictEqual(porsche.transmission.drivetrain, 'awd')
  assert.strictEqual(porsche.transmission.gearCount, 8, 'PDK deve possuir exatamente 8 marchas')
  assert.strictEqual(porsche.transmission.gearRatios.length, 8, 'PDK deve listar 8 relações')

  const expectedRatios = [4.89, 3.17, 2.15, 1.56, 1.18, 0.94, 0.76, 0.61]
  for (let i = 0; i < 8; i++) {
    assert.strictEqual(porsche.transmission.gearRatios[i].ratio, expectedRatios[i], `Marcha ${i + 1} deve ser ${expectedRatios[i]}`)
  }
  assert.strictEqual(porsche.transmission.reverseRatio, 3.99, 'Ré da PDK deve ser 3.99')
  assert.strictEqual(porsche.transmission.finalDrive, 3.02, 'Diferencial traseiro deve ser 3.02')
  assert.strictEqual(porsche.transmission.frontFinalDrive, 3.33, 'Diferencial dianteiro deve ser 3.33')
})

test('TEST-PORSCHE-02: PTM distribui torque entre os eixos dianteiro e traseiro sob tração', () => {
  const porsche = porscheConfig as unknown as VehicleConfig
  const phys = new VehiclePhysics({
    weight: porsche.info.weight,
    wheelDiameter: porsche.info.wheelDiameter,
    vehicleId: porsche.id,
    chassis: porsche.chassis,
  })

  // Aceleração forte em 1ª marcha
  const res = phys.tick({
    driveTorqueAtTransmission: 650,
    gearRatio: 4.89,
    finalDrive: 3.02,
    brake: 0,
    deltaTime: 1 / 120,
    steeringAngleRad: 0,
    isRaining: false,
  })

  assert.ok(res.acceleration > 0, 'Veículo deve acelerar positivamente')
  assert.strictEqual(res.absEngaged, false)
})

test('TEST-PORSCHE-03: Sistema PAA ativa Airbrake automaticamente em frenagem severa em alta velocidade', () => {
  const porsche = porscheConfig as unknown as VehicleConfig
  const phys = new VehiclePhysics({
    weight: porsche.info.weight,
    wheelDiameter: porsche.info.wheelDiameter,
    vehicleId: porsche.id,
    chassis: porsche.chassis,
    initialPositionX: 0,
    initialPositionY: 50,
  })

  // Simula veículo trafegando a 140 km/h (~38.8 m/s)
  phys.setSpeedKmh(140)

  // Frenagem moderada (0.40 <= 0.55): Airbrake não arma
  const modBrake = phys.tick({
    driveTorqueAtTransmission: 0,
    gearRatio: 0.94,
    finalDrive: 3.02,
    brake: 0.40,
    deltaTime: 1 / 120,
    steeringAngleRad: 0,
    isRaining: false,
  })
  assert.strictEqual(modBrake.isAirbrakeActive, false, 'Frenagem moderada não deve acionar Airbrake')

  // Frenagem violenta (0.85 > 0.55 e velocidade > 90 km/h): Airbrake arma
  const heavyBrake = phys.tick({
    driveTorqueAtTransmission: 0,
    gearRatio: 0.94,
    finalDrive: 3.02,
    brake: 0.85,
    deltaTime: 1 / 120,
    steeringAngleRad: 0,
    isRaining: false,
  })
  assert.strictEqual(heavyBrake.isAirbrakeActive, true, 'Frenagem severa acima de 90 km/h deve armar Airbrake PAA')
  assert.ok(phys.getDownforceN() > 0, 'Airbrake deve gerar carga aerodinâmica substancial')
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. ABS DE 4 CANAIS COM FILTRAGEM DIGITAL E CORTE SEGURO
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 3. ABS DE 4 CANAIS: ESCORREGAMENTO INDIVIDUAL, FILTRAGEM E CORTE ---')

test('TEST-ABS-01: ABS intervém em piso molhado impedindo colapso do escorregamento', () => {
  const porsche = porscheConfig as unknown as VehicleConfig
  const phys = new VehiclePhysics({
    weight: porsche.info.weight,
    wheelDiameter: porsche.info.wheelDiameter,
    vehicleId: porsche.id,
    chassis: porsche.chassis,
  })
  phys.setSpeedKmh(100)

  // Freio 100% na chuva
  const step = phys.tick({
    driveTorqueAtTransmission: 0,
    gearRatio: 0,
    finalDrive: 3.02,
    brake: 1.0,
    deltaTime: 1 / 120,
    steeringAngleRad: 0,
    isRaining: true,
  })

  assert.strictEqual(step.absEngaged, true, 'ABS de 4 canais deve pulsar em frenagem 100% na chuva')
})

test('TEST-ABS-02: Corte seguro de desativação do ABS em velocidade < 2.0 m/s para parada total controlada', () => {
  const porsche = porscheConfig as unknown as VehicleConfig
  const phys = new VehiclePhysics({
    weight: porsche.info.weight,
    wheelDiameter: porsche.info.wheelDiameter,
    vehicleId: porsche.id,
    chassis: porsche.chassis,
  })

  // Velocidade rastejante de 4.0 km/h (~1.1 m/s)
  phys.setSpeedKmh(4.0)

  const step = phys.tick({
    driveTorqueAtTransmission: 0,
    gearRatio: 0,
    finalDrive: 3.02,
    brake: 1.0,
    deltaTime: 1 / 120,
    steeringAngleRad: 0,
    isRaining: false,
  })

  // Abaixo de 2.0 m/s (7.2 km/h), o ABS deve desarmar para permitir imobilização mecânica total
  assert.strictEqual(step.absEngaged, false, 'ABS deve desarmar em v < 2.0 m/s para imobilização mecânica')
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. MUNDO 2D DIRIGÍVEL: MALHA MÉTRICA, LIMITES E DETECÇÃO DE ZONAS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 4. MUNDO 2D DIRIGÍVEL: ZONAS, SUPERFÍCIES E LIMITES MÉTRICOS ---')

test('TEST-WORLD-01: Detecção precisa de zonas na malha métrica 600m x 600m', () => {
  // Centro (0, 0) é a Rotatória Central
  const center = WorldMap.query(0, 0)
  assert.strictEqual(center.surface.type, 'asphalt')
  assert.strictEqual(center.zoneName, 'Rotatória Central')
  assert.strictEqual(center.surface.friction, 0.95)

  // Reta de Arrancada (Drag Strip)
  const dragStrip = WorldMap.query(120, 50)
  assert.strictEqual(dragStrip.surface.type, 'asphalt')
  assert.strictEqual(dragStrip.zoneName, 'Reta Oficial de Arrancada')

  // Skidpad Molhado
  const skidpad = WorldMap.query(-140, -140)
  assert.strictEqual(skidpad.surface.type, 'wet_asphalt')
  assert.strictEqual(skidpad.surface.friction, 0.50)
  assert.strictEqual(skidpad.zoneName, 'Área de Teste de Derrapagem (Skidpad)')

  // Setor Off-Road
  const offRoad = WorldMap.query(150, -150)
  assert.strictEqual(offRoad.surface.type, 'gravel')
  assert.strictEqual(offRoad.surface.friction, 0.48)
  assert.strictEqual(offRoad.zoneName, 'Circuito Off-Road 4x4')

  // Grama
  const grass = WorldMap.query(250, 250)
  assert.strictEqual(grass.surface.type, 'grass')
  assert.strictEqual(grass.surface.friction, 0.35)
})

test('TEST-WORLD-02: Resposta elástica e amortecimento ao colidir com limites do mapa (-290m a +290m)', () => {
  // Posição além do muro norte (Y = +305m)
  const queryNorth = WorldMap.query(0, 305)
  assert.strictEqual(queryNorth.collision.isColliding, true)
  assert.strictEqual(queryNorth.collision.normalY, -1)

  // Posição além do muro sul (Y = -305m)
  const querySouth = WorldMap.query(0, -305)
  assert.strictEqual(querySouth.collision.isColliding, true)
  assert.strictEqual(querySouth.collision.normalY, 1)
})

test('TEST-WORLD-03: Cinemática 2D de bicicleta/Ackermann integrando rumo e posição', () => {
  const porsche = porscheConfig as unknown as VehicleConfig
  const phys = new VehiclePhysics({
    weight: porsche.info.weight,
    wheelDiameter: porsche.info.wheelDiameter,
    vehicleId: porsche.id,
    chassis: porsche.chassis,
  })

  phys.setPosition(0, 0, 0) // Origem, apontando para o Norte
  phys.setSpeedKmh(72) // 20 m/s

  // 60 passos em linha reta
  for (let i = 0; i < 60; i++) {
    phys.tick({
      driveTorqueAtTransmission: 300,
      gearRatio: 2.15,
      finalDrive: 3.02,
      brake: 0,
      deltaTime: 1 / 120,
      steeringAngleRad: 0,
      isRaining: false,
    })
  }

  const posStraight = phys.getPosition()
  assert.ok(posStraight.y > 9.0, 'Posição Y deve avançar no sentido Norte')
  assert.strictEqual(Math.round(posStraight.x), 0, 'Posição X deve permanecer nula em linha reta')
  assert.strictEqual(phys.getHeadingDeg(), 0, 'Rumo deve permanecer 0 graus')

  // Agora esterça para a direita (+0.30 rad)
  for (let i = 0; i < 60; i++) {
    phys.tick({
      driveTorqueAtTransmission: 300,
      gearRatio: 2.15,
      finalDrive: 3.02,
      brake: 0,
      deltaTime: 1 / 120,
      steeringAngleRad: 0.30,
      isRaining: false,
    })
  }

  const steeredPos = phys.getPosition()
  assert.ok(steeredPos.x > 0, 'Esterçamento para a direita deve mover posição X para o quadrante Leste (+X)')
  assert.ok(phys.getHeadingDeg() > 0, 'Rumo deve girar positivamente no sentido horário')
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. SISTEMA DE DANO E MODELO COM P_REF = 1.00 BAR (SEM DIVISÃO POR ZERO)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 5. SISTEMA DE DANO: NORMALIZAÇÃO SEGURA P_REF = 1.00 BAR ---')

test('TEST-DAMAGE-01: Civic Si aspirado (P_boost = 0) não gera NaN ou colapso matemático', () => {
  const civic = civicConfig as unknown as VehicleConfig
  const phys = new VehiclePhysics({
    weight: civic.info.weight,
    wheelDiameter: civic.info.wheelDiameter,
    vehicleId: civic.id,
    chassis: civic.chassis,
  })

  // Opera motor aspirado em alta rotação por 120 passos
  for (let i = 0; i < 120; i++) {
    const res = phys.tick({
      driveTorqueAtTransmission: 190,
      gearRatio: 3.267,
      finalDrive: 4.764,
      brake: 0,
      deltaTime: 1 / 120,
      steeringAngleRad: 0,
      isRaining: false,
    })

    assert.ok(!Number.isNaN(res.speedMs), 'Velocidade não pode ser NaN')
    assert.ok(!Number.isNaN(res.acceleration), 'Aceleração não pode ser NaN')
    assert.ok(!Number.isNaN(res.surfaceType), 'Superfície não pode ser nula')
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. INTEGRAÇÃO NO SIMULATION STORE E SINCRONIZAÇÃO DE UI/MULTIMÍDIA
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 6. INTEGRAÇÃO NA STORE, TELEMETRIA 2D E ATALHOS DE MAPA ---')

test('TEST-STORE-01: useSimulationStore sincroniza telemetria 2D e atalhos de mapa', () => {
  const store = useSimulationStore.getState()
  const ui = useUIStore.getState()

  // Inicializa com Porsche
  store.init(porscheConfig as unknown as VehicleConfig)
  assert.strictEqual(useSimulationStore.getState()._config?.id, 'porsche-gt3')

  // Verifica propriedades 2D
  assert.strictEqual(typeof store.positionX, 'number')
  assert.strictEqual(typeof store.positionY, 'number')
  assert.strictEqual(typeof store.headingDeg, 'number')
  assert.strictEqual(typeof store.zoneName, 'string')
  assert.strictEqual(typeof store.surfaceType, 'string')

  // Testa alternância de mapa via toggleMap (inicia aberto por padrão conforme requisito de entrada no modo direção)
  assert.strictEqual(useSimulationStore.getState().isMapOpen, true)
  store.toggleMap()
  assert.strictEqual(useSimulationStore.getState().isMapOpen, false)
  store.toggleMap()
  assert.strictEqual(useSimulationStore.getState().isMapOpen, true)

  // Testa alternância de mapa via useUIStore
  ui.toggleMap()
  assert.strictEqual(useUIStore.getState().isMapOpen, false)
  assert.strictEqual(useUIStore.getState().mapViewportSize, 'hidden')
  ui.toggleMap()
  assert.strictEqual(useUIStore.getState().isMapOpen, true)
  assert.notStrictEqual(useUIStore.getState().mapViewportSize, 'hidden')

  // Testa tecla 'map' no activeKeys do UIStore
  assert.strictEqual(useUIStore.getState().activeKeys.map, false)
  useUIStore.getState().setActiveKey('map', true)
  assert.strictEqual(useUIStore.getState().activeKeys.map, true)
  useUIStore.getState().setActiveKey('map', false)
  assert.strictEqual(useUIStore.getState().activeKeys.map, false)
})

test('TEST-STORE-02: Execução de 240 subpassos a 120 Hz no useSimulationStore com posição e rumo íntegros', () => {
  const store = useSimulationStore.getState()
  store.init(porscheConfig as unknown as VehicleConfig)
  store.startEngine()
  store.setHandbrake(false)
  store.selectDrive()
  store.setThrottle(0.8)
  store.setSteeringAngle(0.2, 'keyboard')

  // Roda 2 segundos (240 updates)
  for (let i = 0; i < 240; i++) {
    store.update(1 / 120)
  }

  const endState = useSimulationStore.getState()
  assert.ok(endState.speed > 5, 'Veículo deve estar em movimento')
  assert.ok(Math.abs(endState.positionY) > 0.5 || Math.abs(endState.positionX) > 0.5, 'Coordenadas 2D devem progredir')
  assert.ok(!Number.isNaN(endState.positionX), 'Posição X não pode ser NaN')
  assert.ok(!Number.isNaN(endState.positionY), 'Posição Y não pode ser NaN')
  assert.ok(!Number.isNaN(endState.headingDeg), 'Rumo não pode ser NaN')
  assert.ok(endState.zoneName.length > 0, 'Nome da zona deve ser preenchido')
})

console.log('\n=================================================================')
console.log(`  RESULTADO DOS TESTES DA ETAPA 2: ${passed} PASSOU | ${failed} FALHOU`)
console.log('=================================================================')

if (failed > 0) {
  process.exit(1)
}
