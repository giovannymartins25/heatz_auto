import { useSimulationStore } from './src/stores/useSimulationStore'
import { DashboardSystem } from './src/systems/dashboard/DashboardSystem'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { VehicleConfig } from './src/types'

function loadConfig(id: string): VehicleConfig {
  const fullPath = resolve(process.cwd(), 'public/vehicles', id, 'config.json')
  return JSON.parse(readFileSync(fullPath, 'utf-8'))
}

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ PASSOU | ${name}`)
    passed++
  } catch (err) {
    console.error(`✗ FALHOU | ${name}`)
    console.error(`  Erro: ${(err as Error).message}`)
    failed++
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg)
}

console.log('═══════════════════════════════════════════════════════════════')
console.log('  HEATZ AUTO — VALIDAÇÃO DA MIGRAÇÃO DO SELETOR DE TRANSMISSÃO ')
console.log('═══════════════════════════════════════════════════════════════\n')

const vehicles = [
  'civic-si',
  'golf-gti',
  'gol-g6',
  'gol-quadrado-turbo',
  'porsche-gt3',
  'opala-4100',
  'yaris-2019',
  'cb1000r',
]

// ─────────────────────────────────────────────────────────────
// CENÁRIO A: Configuração dos 8 Veículos
// ─────────────────────────────────────────────────────────────
console.log('▶ [Cenário A] Configurações de Veículos e Posições Suportadas')

test('Todos os 8 veículos possuem supportedSelectorPositions explicitamente declarado', () => {
  for (const id of vehicles) {
    const config = loadConfig(id)
    assert(
      Array.isArray(config.transmission.supportedSelectorPositions) &&
      config.transmission.supportedSelectorPositions.length > 0,
      `Veículo ${id} deve possuir supportedSelectorPositions não-vazio`
    )
  }
})

test('Posições declaradas são coerentes com o tipo mecânico de cada transmissão', () => {
  const gti = loadConfig('golf-gti')
  assert(
    JSON.stringify(gti.transmission.supportedSelectorPositions) === JSON.stringify(['P', 'R', 'N', 'D', 'S', 'M']),
    'Golf GTI DSG suporta P, R, N, D, S, M'
  )

  const porsche = loadConfig('porsche-gt3')
  assert(
    JSON.stringify(porsche.transmission.supportedSelectorPositions) === JSON.stringify(['P', 'R', 'N', 'D', 'M']),
    'Porsche 992 GT3 PDK suporta P, R, N, D, M (sem posição física S)'
  )

  const yaris = loadConfig('yaris-2019')
  assert(
    JSON.stringify(yaris.transmission.supportedSelectorPositions) === JSON.stringify(['P', 'R', 'N', 'D', 'M']),
    'Toyota Yaris CVT suporta P, R, N, D, M (sem posição física S)'
  )

  const cb = loadConfig('cb1000r')
  assert(
    JSON.stringify(cb.transmission.supportedSelectorPositions) === JSON.stringify(['N']),
    'Honda CB1000R sequencial declara apenas N'
  )

  for (const id of ['civic-si', 'gol-g6', 'gol-quadrado-turbo', 'opala-4100']) {
    const manualCar = loadConfig(id)
    assert(
      JSON.stringify(manualCar.transmission.supportedSelectorPositions) === JSON.stringify(['N']),
      `Carro manual ${id} declara apenas N no seletor`
    )
  }
})

// ─────────────────────────────────────────────────────────────
// CENÁRIO B: Validação Centralizada na Store
// ─────────────────────────────────────────────────────────────
console.log('\n▶ [Cenário B] Validação Centralizada na Store')

test('Store aceita posições suportadas e rejeita posições não suportadas', () => {
  const store = useSimulationStore.getState()
  const porsche = loadConfig('porsche-gt3')
  store.init(porsche)
  store.startEngine()

  // Porsche suporta D
  store.selectDrive()
  assert(useSimulationStore.getState().gearSelectorPosition === 'D', 'Porsche aceita D')

  // Porsche NÃO suporta S -> deve rejeitar e manter D!
  store.selectShifterMode('S')
  assert(useSimulationStore.getState().gearSelectorPosition === 'D', 'Porsche rejeita chamada direta selectShifterMode("S")')

  store.selectSport()
  assert(useSimulationStore.getState().gearSelectorPosition === 'D', 'Porsche rejeita selectSport() mantendo D')

  // Porsche suporta M
  store.selectManual()
  assert(useSimulationStore.getState().gearSelectorPosition === 'M', 'Porsche aceita M')

  // Porsche suporta N
  store.selectNeutral()
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'Porsche aceita N')

  // Porsche suporta R
  store.selectReverse()
  assert(useSimulationStore.getState().gearSelectorPosition === 'R', 'Porsche aceita R')

  // Porsche suporta P
  store.selectPark()
  assert(useSimulationStore.getState().gearSelectorPosition === 'P', 'Porsche aceita P')
})

test('Carros manuais rejeitam P, R, D, S, M e aceitam apenas N', () => {
  const store = useSimulationStore.getState()
  const civic = loadConfig('civic-si')
  store.init(civic)

  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'Civic inicia em N')

  store.selectShifterMode('P')
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'Civic rejeita P')

  store.selectShifterMode('D')
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'Civic rejeita D')

  store.selectShifterMode('R')
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'Civic rejeita R')

  store.selectShifterMode('S')
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'Civic rejeita S')

  store.selectShifterMode('M')
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'Civic rejeita M')

  store.selectNeutral()
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'Civic aceita N')
})

// ─────────────────────────────────────────────────────────────
// CENÁRIO C: Troca de Veículo e Isolamento de Estados
// ─────────────────────────────────────────────────────────────
console.log('\n▶ [Cenário C] Troca de Veículo e Isolamento')

test('Troca de veículo reseta para a posição inicial válida do novo veículo', () => {
  const store = useSimulationStore.getState()
  const gti = loadConfig('golf-gti')
  const civic = loadConfig('civic-si')

  // No GTI, coloca em S
  store.init(gti)
  store.startEngine()
  store.selectSport()
  assert(useSimulationStore.getState().gearSelectorPosition === 'S', 'GTI em posição S')

  // Troca para Civic Si (manual)
  store.init(civic)
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'Civic Si inicia em N e não herda S do GTI')
  assert(useSimulationStore.getState().isAutomaticVehicle === false, 'Civic Si é manual')

  // Troca para Porsche
  const porsche = loadConfig('porsche-gt3')
  store.init(porsche)
  assert(useSimulationStore.getState().gearSelectorPosition === 'P', 'Porsche inicia em P e não herda N do Civic')
})

// ─────────────────────────────────────────────────────────────
// CENÁRIO D: Perfil de Condução Desacoplado da Posição do Seletor
// ─────────────────────────────────────────────────────────────
console.log('\n▶ [Cenário D] Desacoplamento entre Perfil de Condução e Posição')

test('Ativar modo SPORT não altera a posição física D do seletor', () => {
  const store = useSimulationStore.getState()
  const porsche = loadConfig('porsche-gt3')
  store.init(porsche)
  store.startEngine()
  store.selectDrive()

  assert(useSimulationStore.getState().gearSelectorPosition === 'D', 'Seletor em D')
  assert(useSimulationStore.getState().drivingMode === 'normal', 'Perfil normal')

  // Ativa perfil SPORT
  store.setDrivingMode('sport')
  assert(useSimulationStore.getState().gearSelectorPosition === 'D', 'Seletor permanece em D ao ativar perfil SPORT')
  assert(useSimulationStore.getState().drivingMode === 'sport', 'Perfil de condução atualizado para sport')

  // Ativa perfil ECO
  store.setDrivingMode('eco')
  assert(useSimulationStore.getState().gearSelectorPosition === 'D', 'Seletor permanece em D ao ativar perfil ECO')
  assert(useSimulationStore.getState().drivingMode === 'eco', 'Perfil de condução atualizado para eco')
})

test('No modo M, alternar perfil de condução preserva a posição M', () => {
  const store = useSimulationStore.getState()
  const yaris = loadConfig('yaris-2019')
  store.init(yaris)
  store.startEngine()
  store.selectManual()

  assert(useSimulationStore.getState().gearSelectorPosition === 'M', 'Yaris em M')

  store.setDrivingMode('sport')
  assert(useSimulationStore.getState().gearSelectorPosition === 'M', 'Yaris preserva M com Sport')

  store.setDrivingMode('eco')
  assert(useSimulationStore.getState().gearSelectorPosition === 'M', 'Yaris preserva M com Eco')
})

// ─────────────────────────────────────────────────────────────
// CENÁRIO E: Transmissão Automática e Estratégia
// ─────────────────────────────────────────────────────────────
console.log('\n▶ [Cenário E] Transmissão Automática e Estratégia')

test('AutomaticTransmission recebe perfil de condução correto e opera normalmente', () => {
  const store = useSimulationStore.getState()
  const yaris = loadConfig('yaris-2019')
  store.init(yaris)
  store.startEngine()
  store.selectDrive()

  // Acelera em ECO
  store.setDrivingMode('eco')
  useSimulationStore.setState({ throttle: 0.3, speed: 10, currentGear: 1, rpm: 2000 })
  store.update(0.1)
  assert(useSimulationStore.getState().drivingMode === 'eco', 'Estratégia ECO ativa')

  // Acelera em SPORT
  store.setDrivingMode('sport')
  useSimulationStore.setState({ throttle: 0.9, speed: 30, currentGear: 1, rpm: 4500 })
  store.update(0.1)
  assert(useSimulationStore.getState().drivingMode === 'sport', 'Estratégia SPORT ativa')
})

// ─────────────────────────────────────────────────────────────
// CENÁRIO F: Dashboard e Telemetria
// ─────────────────────────────────────────────────────────────
console.log('\n▶ [Cenário F] Dashboard e Telemetria')

test('Telemetria reflete gearSelectorPosition e não confunde SPORT com S', () => {
  const porsche = loadConfig('porsche-gt3')

  // Porsche em D com perfil SPORT
  const inputPorsche = DashboardSystem.createInputFromState(porsche, {
    rpm: 5000,
    status: 'running',
    isRevLimiting: false,
    isBogWarning: false,
    speed: 100,
    currentGear: 3,
    transmissionMode: 'automatic',
    drivingMode: 'sport',
    gearSelectorPosition: 'D',
    isKickdown: false,
    throttle: 0.7,
    brake: 0,
    clutchPosition: 0,
    clutchSlipRpm: 0,
    clutchSlipRatio: 0,
    clutchTorqueTransfer: 0,
    clutchHeat: 0,
    isClutchSlipping: false,
    tcsEnabled: true,
    tcsIntervening: false,
    tcsInterventionLevel: 0,
  })

  const telemetryPorsche = DashboardSystem.computeTelemetry(inputPorsche)
  assert(telemetryPorsche.gear.label === 'D3', 'Porsche em D com perfil Sport exibe D3 (não S3)')
  assert(telemetryPorsche.gear.subLabel === 'SPORT', 'Subrótulo exibe SPORT')
  assert(telemetryPorsche.gear.gearSelectorPosition === 'D', 'gearSelectorPosition é D')

  // Golf GTI em posição física S
  const gti = loadConfig('golf-gti')
  const inputGti = DashboardSystem.createInputFromState(gti, {
    rpm: 5500,
    status: 'running',
    isRevLimiting: false,
    isBogWarning: false,
    speed: 110,
    currentGear: 4,
    transmissionMode: 'automatic',
    drivingMode: 'sport',
    gearSelectorPosition: 'S',
    isKickdown: false,
    throttle: 0.8,
    brake: 0,
    clutchPosition: 0,
    clutchSlipRpm: 0,
    clutchSlipRatio: 0,
    clutchTorqueTransfer: 0,
    clutchHeat: 0,
    isClutchSlipping: false,
    tcsEnabled: true,
    tcsIntervening: false,
    tcsInterventionLevel: 0,
  })

  const telemetryGti = DashboardSystem.computeTelemetry(inputGti)
  assert(telemetryGti.gear.label === 'S4', 'Golf GTI na posição S exibe S4')
  assert(telemetryGti.gear.subLabel === 'SPORT', 'Subrótulo do GTI exibe SPORT')
})

// ─────────────────────────────────────────────────────────────
// CENÁRIO G: Inicialização e Reset
// ─────────────────────────────────────────────────────────────
console.log('\n▶ [Cenário G] Inicialização e Reset')

test('Reset de carro manual reseta para N e automático para P', () => {
  const store = useSimulationStore.getState()
  const civic = loadConfig('civic-si')
  store.init(civic)
  store.reset()

  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'Carro manual após reset fica em N')
  assert(useSimulationStore.getState().currentGear === 0, 'Carro manual após reset marcha 0')

  const gti = loadConfig('golf-gti')
  store.init(gti)
  store.reset()

  assert(useSimulationStore.getState().gearSelectorPosition === 'P', 'Carro automático após reset fica em P')
  assert(useSimulationStore.getState().currentGear === -2, 'Carro automático após reset marcha -2')
})

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`RESULTADO DA SUÍTE DE MIGRAÇÃO: ${passed} PASSOU | ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════\n')

if (failed > 0) {
  process.exit(1)
}
