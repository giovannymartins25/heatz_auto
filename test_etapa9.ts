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
console.log('    LAUNCH CONTROL, TURBO BOOST SYSTEM E TIMER 0-100 ROLLOUT   ')
console.log('═══════════════════════════════════════════════════════════════\n')

const porscheConfig = loadConfig('vehicles/porsche-gt3/config.json')
const golConfig = loadConfig('vehicles/gol-g6/config.json')
const gtiConfig = loadConfig('vehicles/golf-gti/config.json')

// 1. Cronômetro 0-100 NÃO inicia no neutro
test('0-100 km/h: Acelerar a 9.000 RPM em Neutro NÃO dispara o cronômetro', () => {
  const store = useSimulationStore.getState()
  store.init(porscheConfig)
  startAndRunEngine()

  // No neutro, pé a fundo no acelerador
  useSimulationStore.setState({ throttle: 1.0, brake: 0 })

  for (let i = 0; i < 30; i++) {
    useSimulationStore.getState().update(0.016)
  }

  const s = useSimulationStore.getState()
  assert(s.rpm > 7000, `Giro deve ter subido em neutro, atual: ${s.rpm}`)
  assert(s.isTiming0to100 === false, 'Cronômetro não pode disparar no Neutro!')
  assert(s.current0to100 === null, 'Tempo atual de 0-100 deve continuar nulo!')
})

// 2. Cronômetro 0-100 NÃO inicia enquanto segura o freio no Launch Control
test('0-100 km/h: Segurar freio e acelerador no Launch Control NÃO dispara o cronômetro antes da largada', () => {
  const store = useSimulationStore.getState()
  store.init(porscheConfig)
  startAndRunEngine()

  // Engata 1ª marcha
  store.shiftUp()

  // Freio a 90%, acelerador a 100%
  useSimulationStore.setState({ brake: 0.9, throttle: 1.0 })

  for (let i = 0; i < 20; i++) {
    useSimulationStore.getState().update(0.016)
  }

  const s = useSimulationStore.getState()
  assert(s.currentGear === 1, `Deve estar em 1ª marcha, atual: ${s.currentGear}`)
  assert(s.isLaunchControlArmed === true, 'Launch Control deve estar armado!')
  assert(s.isTiming0to100 === false, 'Cronômetro NÃO deve disparar enquanto o freio estiver pressionado!')
})

// 3. Launch Control arma e limita rotação no Porsche GT3 RS
test('Launch Control: Porsche 992 GT3 RS limita giro em 4.500 RPM na armação', () => {
  const store = useSimulationStore.getState()
  store.init(porscheConfig)
  startAndRunEngine()

  store.shiftUp()
  useSimulationStore.setState({ brake: 0.85, throttle: 0.95 })

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

// 5. Veículo aspirado NÃO tem turbo
test('Turbo: Gol G6 e Porsche GT3 RS aspirados têm hasTurbo=false e pressão zero', () => {
  const store = useSimulationStore.getState()
  store.init(golConfig)
  assert(useSimulationStore.getState().hasTurbo === false, 'Gol G6 não tem turbo!')
  assert(useSimulationStore.getState().boostPressureBar === 0, 'Gol G6 pressão deve ser 0 bar!')

  store.init(porscheConfig)
  assert(useSimulationStore.getState().hasTurbo === false, 'Porsche GT3 RS 4.0 é aspirado!')
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

  // Engata 1ª marcha e solta freio com pé a fundo: turbo enche para pressão positiva
  store.shiftUp()
  useSimulationStore.setState({ throttle: 1.0, brake: 0.0 })
  for (let i = 0; i < 80; i++) {
    useSimulationStore.getState().update(0.016)
  }
  const boost = useSimulationStore.getState().boostPressureBar
  assert(boost > 0.5, `Turbo deve ter enchido para pressão positiva (> 0.5 bar), atual: ${boost}`)
  assert(useSimulationStore.getState().peakBoostBar >= boost, 'Peak boost deve ter registrado o pico!')
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
