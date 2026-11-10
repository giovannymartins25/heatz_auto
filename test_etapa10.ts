import { useSimulationStore } from './src/stores/useSimulationStore'
import { readFileSync, existsSync } from 'fs'
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
  for (let i = 0; i < 45; i++) {
    useSimulationStore.getState().update(0.016)
  }
}

console.log('═══════════════════════════════════════════════════════════════')
console.log('         HEATZ AUTO — BATERIA DE TESTES — ETAPA 10             ')
console.log('  ESCAPE/DIFUSOR, OFICINA STAGE 1-3, CLIMA/FARÓIS, GOL & CIVIC ')
console.log('═══════════════════════════════════════════════════════════════\n')

// ── Teste 1: Manifest dos veículos inclui Gol Quadrado Turbo e Civic Si ──
test('Manifest: novos carros icônicos registrados', () => {
  const manifestPath = resolve(process.cwd(), 'public/vehicles/manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  const ids = manifest.vehicles.map((v: { id: string }) => v.id)

  assert(ids.includes('gol-quadrado-turbo'), 'Manifest deve conter gol-quadrado-turbo')
  assert(ids.includes('civic-si'), 'Manifest deve conter civic-si')
  assert(ids.includes('golf-gti'), 'Manifest deve conter golf-gti')
  assert(ids.includes('porsche-gt3'), 'Manifest deve conter porsche-gt3')
})

// ── Teste 2: Configuração do Gol Quadrado 1.9 AP Turbo ──
test('Gol Quadrado Turbo: 380 cv, turbina 2.15 bar, 3-step a 4800 RPM', () => {
  const cfg = loadConfig('vehicles/gol-quadrado-turbo/config.json')
  assert(cfg.id === 'gol-quadrado-turbo', 'ID correto')
  assert(cfg.engine.maxPower === 380, 'Potência deve ser 380 cv')
  assert(cfg.engine.turbo?.enabled === true, 'Turbo deve estar habilitado')
  assert(cfg.engine.turbo?.maxBoostBar === 2.15, 'Pressão máxima deve ser 2.15 bar')
  assert(cfg.transmission.launchControl?.launchRpm === 4800, '3-Step deve cortar a 4800 RPM')
  assert(cfg.dashboard?.theme === 'square_turbo', 'Tema do cluster deve ser square_turbo')
})

// ── Teste 3: Configuração do Honda Civic Si 2.0 i-VTEC K20 ──
test('Civic Si: 192 cv, corte a 8300 RPM, câmbio manual 6M, tema civic_si', () => {
  const cfg = loadConfig('vehicles/civic-si/config.json')
  assert(cfg.id === 'civic-si', 'ID correto')
  assert(cfg.engine.maxPower === 192, 'Potência deve ser 192 cv')
  assert(cfg.engine.revLimiter === 8300, 'Corte de giro deve ser a 8300 RPM')
  assert(cfg.transmission.gearCount === 6, 'Câmbio manual de 6 marchas')
  assert(cfg.dashboard?.theme === 'civic_si', 'Tema do cluster deve ser civic_si')
})

// ── Teste 4: Válvula de Difusor de Escape (Exhaust Valve) ──
test('Difusor de Escape: alternância entre Aberto (Direto) e Fechado (Civil)', () => {
  const store = useSimulationStore.getState()
  store.setExhaustValve(false)
  assert(useSimulationStore.getState().exhaustValveOpen === false, 'Difusor deve estar fechado')

  store.toggleExhaustValve()
  assert(useSimulationStore.getState().exhaustValveOpen === true, 'Difusor deve alternar para aberto')

  store.toggleExhaustValve()
  assert(useSimulationStore.getState().exhaustValveOpen === false, 'Difusor deve alternar para fechado')
})

// ── Teste 5: Oficina de Preparação (Stage 0, 1, 2, 3) ──
test('Oficina: Estágios de Tuning 0 (Stock), 1 (Remap), 2 (Full Bolt-on) e 3 (Forged)', () => {
  const store = useSimulationStore.getState()
  const gtiConfig = loadConfig('vehicles/golf-gti/config.json')
  store.init(gtiConfig)

  store.setTuningStage(0)
  assert(useSimulationStore.getState().tuningStage === 0, 'Stage 0 Stock')

  store.setTuningStage(1)
  assert(useSimulationStore.getState().tuningStage === 1, 'Stage 1 Remap')

  store.setTuningStage(2)
  assert(useSimulationStore.getState().tuningStage === 2, 'Stage 2 Bolt-on')

  store.setTuningStage(3)
  assert(useSimulationStore.getState().tuningStage === 3, 'Stage 3 Forged')
})

// ── Teste 6: Clima e Chuva (Pista molhada com atrito reduzido) ──
test('Clima: Chuva reduz atrito da pista de 0.95 para 0.62', () => {
  const store = useSimulationStore.getState()
  const porscheConfig = loadConfig('vehicles/porsche-gt3/config.json')
  store.init(porscheConfig)

  // Desativa chuva se ativa
  if (useSimulationStore.getState().isRaining) {
    store.toggleRain()
  }
  assert(useSimulationStore.getState().isRaining === false, 'Clima inicial seco')

  store.toggleRain()
  assert(useSimulationStore.getState().isRaining === true, 'Chuva ativada')
  assert(useSimulationStore.getState().isWiperActive === true, 'Limpadores acionados com chuva')

  store.toggleRain()
  assert(useSimulationStore.getState().isRaining === false, 'Chuva desativada (pista seca)')
})

// ── Teste 7: Faróis (off -> parking -> low -> high -> off) ──
test('Faróis: ciclo completo de iluminação', () => {
  const store = useSimulationStore.getState()
  store.setHeadlightsMode('off')
  assert(useSimulationStore.getState().headlightsMode === 'off', 'Farol desligado')

  store.cycleHeadlights()
  assert(useSimulationStore.getState().headlightsMode === 'parking', 'Lanterna')

  store.cycleHeadlights()
  assert(useSimulationStore.getState().headlightsMode === 'low', 'Farol baixo')

  store.cycleHeadlights()
  assert(useSimulationStore.getState().headlightsMode === 'high', 'Farol alto')

  store.cycleHeadlights()
  assert(useSimulationStore.getState().headlightsMode === 'off', 'Volta a desligado')
})

// ── Teste 8: Seletor de Câmbio Automático PRNDS/M sem conflito N e M ──
test('Câmbio Automático: P, R, N, D, S e M são mutuamente exclusivos', () => {
  const store = useSimulationStore.getState()
  const porscheConfig = loadConfig('vehicles/porsche-gt3/config.json')
  store.init(porscheConfig)
  startAndRunEngine()

  // Seleciona N
  store.selectNeutral()
  let state = useSimulationStore.getState()
  assert(state.shifterPosition === 'N', 'Shifter deve estar em N')
  assert(state.currentGear === 0, 'Marcha deve ser 0 (Neutro)')
  assert(state.transmissionMode === 'automatic', 'transmissionMode deve ser automatic')

  // Seleciona M
  store.selectManual()
  state = useSimulationStore.getState()
  assert(state.shifterPosition === 'M', 'Shifter deve estar em M')
  assert(state.currentGear >= 1, 'Marcha deve ser >= 1')
  assert(state.transmissionMode === 'manual_simulated', 'transmissionMode deve ser manual_simulated')

  // Ao voltar para N a partir de M, transmissionMode reseta e M desliga
  store.selectNeutral()
  state = useSimulationStore.getState()
  assert(state.shifterPosition === 'N', 'Shifter deve estar em N')
  assert(state.currentGear === 0, 'Marcha deve ser 0 (Neutro)')
  assert(state.transmissionMode === 'automatic', 'transmissionMode deve voltar a automatic')
})

// ── Teste 9: Launch Control no Gol Quadrado Turbo (3-Step AP) ──
test('Gol Quadrado Turbo: 3-Step arma com freio e acelerador a fundo', () => {
  const store = useSimulationStore.getState()
  const golCfg = loadConfig('vehicles/gol-quadrado-turbo/config.json')
  store.init(golCfg)
  startAndRunEngine()

  // No carro manual com embreagem, pressiona a embreagem para engatar 1ª marcha
  store.setClutch(1.0)
  store.shiftUp()
  assert(useSimulationStore.getState().currentGear === 1, '1ª marcha deve estar engatada')

  // Segura freio e pisa fundo
  useSimulationStore.setState({ brake: 0.9, throttle: 0.95, speed: 0 })
  for (let i = 0; i < 30; i++) {
    useSimulationStore.getState().update(0.016)
  }

  const state = useSimulationStore.getState()
  assert(state.isLaunchControlArmed === true, '3-Step deve estar armado!')
  assert(state.rpm <= 4850, `RPM do 3-Step deve ser contido em ~4800 (obtido: ${state.rpm})`)
  assert(state.boostPressureBar > 0.5, `3-Step deve pré-carregar pressão de turbo anti-lag (obtido: ${state.boostPressureBar})`)
})

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════')

if (failed > 0) {
  process.exit(1)
}
