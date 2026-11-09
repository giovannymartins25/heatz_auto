import { useSimulationStore } from './src/stores/useSimulationStore'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { VehicleConfig } from './src/types'

function loadConfig(relPath: string): VehicleConfig {
  const fullPath = resolve(process.cwd(), 'public', relPath)
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

function startAndRunEngine() {
  const store = useSimulationStore.getState()
  store.startEngine()
  // Avança tempo para concluir o cranking (~0.6s)
  for (let i = 0; i < 45; i++) {
    useSimulationStore.getState().update(0.016)
  }
}

console.log('═══════════════════════════════════════════════════════════════')
console.log('         HEATZ AUTO — BATERIA DE TESTES — ETAPA 9              ')
console.log('  LAUNCH CONTROL, TURBO BOOST SYSTEM, CÂMBIO AUTO & ROLLOUT    ')
console.log('═══════════════════════════════════════════════════════════════\n')

const porscheConfig = loadConfig('vehicles/porsche-gt3/config.json')
const golConfig = loadConfig('vehicles/gol-g6/config.json')
const gtiConfig = loadConfig('vehicles/golf-gti/config.json')

// 1. Cronômetro 0-100 NÃO inicia no neutro
test('0-100 km/h: Acelerar a fundo em Neutro NÃO dispara o cronômetro', () => {
  const store = useSimulationStore.getState()
  store.init(golConfig)
  startAndRunEngine()

  // No neutro, pé a fundo no acelerador
  useSimulationStore.setState({ currentGear: 0, throttle: 1.0, brake: 0 })

  for (let i = 0; i < 60; i++) {
    useSimulationStore.getState().update(0.016)
  }

  const s = useSimulationStore.getState()
  assert(s.rpm > 3000, `Giro deve ter subido em neutro, atual: ${s.rpm}`)
  assert(s.isTiming0to100 === false, 'Cronômetro não pode disparar no Neutro!')
  assert(s.current0to100 === null, 'Tempo atual de 0-100 deve continuar nulo!')
})

// 2. Cronômetro 0-100 NÃO inicia enquanto segura o freio no Launch Control
test('0-100 km/h: Segurar freio e acelerador no Launch Control NÃO dispara o cronômetro antes da largada', () => {
  const store = useSimulationStore.getState()
  store.init(porscheConfig)
  startAndRunEngine()

  // Em D (1ª marcha automática), freio a 90%, acelerador a 100%
  useSimulationStore.setState({ brake: 0.9, throttle: 1.0, speed: 0 })

  for (let i = 0; i < 20; i++) {
    useSimulationStore.getState().update(0.016)
  }

  const s = useSimulationStore.getState()
  assert(s.currentGear === 1, `Deve estar em 1ª marcha / D, atual: ${s.currentGear}`)
  assert(s.isLaunchControlArmed === true, 'Launch Control deve estar armado!')
  assert(s.isTiming0to100 === false, 'Cronômetro NÃO deve disparar enquanto o freio estiver pressionado!')
})

// 3. Launch Control arma e limita rotação no Porsche Bi-Turbo
test('Launch Control: Porsche 992 Bi-Turbo limita giro em 4.500 RPM na armação', () => {
  const store = useSimulationStore.getState()
  store.init(porscheConfig)
  startAndRunEngine()

  useSimulationStore.setState({ brake: 0.85, throttle: 0.95, speed: 0 })

  for (let i = 0; i < 30; i++) {
    useSimulationStore.getState().update(0.016)
  }

  const s = useSimulationStore.getState()
  assert(s.isLaunchControlArmed === true, 'Launch Control deve armar!')
  assert(s.rpm <= 4550, `RPM (${s.rpm}) deve estar travado próximo do corte de largada (4500 RPM)`)
})

// 4. Soltar o freio dispara o Launch e o cronômetro 0-100
test('Launch Control: Soltar freio larga com força e dispara cronômetro 0-100 no rollout', () => {
  // Solta o freio mantendo pé no fundo
  useSimulationStore.setState({ brake: 0.0, throttle: 1.0 })

  for (let i = 0; i < 35; i++) {
    useSimulationStore.getState().update(0.016)
  }

  const s = useSimulationStore.getState()
  assert(s.isLaunchControlArmed === false, 'Launch Control armado deve desativar após largada!')
  assert(s.speed > 0.8, `Carro deve ter começado a acelerar, atual: ${s.speed} km/h`)
  assert(s.isTiming0to100 === true, 'Cronômetro 0-100 deve iniciar no rollout!')
})

// 5. Veículo aspirado vs Veículo Turbo
test('Turbo: Gol G6 aspirado tem hasTurbo=false; Porsche 992 Bi-Turbo e Golf GTI têm hasTurbo=true', () => {
  const store = useSimulationStore.getState()
  store.init(golConfig)
  assert(useSimulationStore.getState().hasTurbo === false, 'Gol G6 não tem turbo!')
  assert(useSimulationStore.getState().boostPressureBar === 0, 'Gol G6 pressão deve ser 0 bar!')

  store.init(porscheConfig)
  assert(useSimulationStore.getState().hasTurbo === true, 'Porsche 992 Bi-Turbo tem turbo!')

  store.init(gtiConfig)
  assert(useSimulationStore.getState().hasTurbo === true, 'Golf GTI 2.0 TSI tem turbo!')
})

// 6. Veículo turbo: Golf GTI 2.0 TSI enche turbo sob aceleração e anti-lag
test('Turbo: Golf GTI Mk7 2.0 TSI ativa hasTurbo=true, enche pressão até pico positivo', () => {
  const store = useSimulationStore.getState()
  store.init(gtiConfig)
  startAndRunEngine()

  assert(useSimulationStore.getState().hasTurbo === true, 'Golf GTI deve ter hasTurbo=true!')

  // Em marcha lenta, gera vácuo negativo
  useSimulationStore.setState({ throttle: 0.0, brake: 1.0 })
  for (let i = 0; i < 30; i++) {
    useSimulationStore.getState().update(0.016)
  }
  const idleBoost = useSimulationStore.getState().boostPressureBar
  assert(idleBoost < 0, `Pressão em marcha lenta deve ser vácuo negativo (< 0), atual: ${idleBoost}`)

  // Solta freio com pé a fundo em D: turbo enche para pressão positiva
  useSimulationStore.setState({ throttle: 1.0, brake: 0.0 })
  for (let i = 0; i < 80; i++) {
    useSimulationStore.getState().update(0.016)
  }
  const boost = useSimulationStore.getState().boostPressureBar
  assert(boost > 0.5, `Turbo deve ter enchido para pressão positiva (> 0.5 bar), atual: ${boost}`)
  assert(useSimulationStore.getState().peakBoostBar >= boost, 'Peak boost deve ter registrado o pico!')
})

// 7. Modos Automático e Tiptronic Manual no Golf GTI e Porsche
test('Transmissão: Porsche PDK e Golf GTI DSG suportam modo Automático e toggle para Manual M', () => {
  const store = useSimulationStore.getState()
  store.init(gtiConfig)
  assert(useSimulationStore.getState().transmissionMode === 'automatic', 'Golf GTI deve iniciar em automático (D)!')

  // Alterna para Manual Simulado
  store.toggleSimulatedManual()
  assert(useSimulationStore.getState().transmissionMode === 'manual_simulated', 'Deve alternar para Manual M!')

  // Alterna de volta para Automático
  store.toggleSimulatedManual()
  assert(useSimulationStore.getState().transmissionMode === 'automatic', 'Deve voltar para Automático D!')

  // Mesma coisa na Porsche
  store.init(porscheConfig)
  assert(useSimulationStore.getState().transmissionMode === 'automatic', 'Porsche PDK deve iniciar em automático (D)!')
  store.toggleSimulatedManual()
  assert(useSimulationStore.getState().transmissionMode === 'manual_simulated', 'Porsche deve alternar para Manual M!')
})

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`  RESULTADO: ${passed}/${passed + failed} TESTES PASSARAM`)
if (failed === 0) {
  console.log('  ✓ TODOS OS TESTES DA ETAPA 9 PASSARAM COM SUCESSO!')
} else {
  console.log(`  ✗ ${failed} TESTES FALHARAM!`)
  process.exit(1)
}
console.log('═══════════════════════════════════════════════════════════════\n')
