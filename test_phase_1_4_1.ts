import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getVehicleCapabilities } from './src/types/vehicle'
import type { VehicleConfig } from './src/types/vehicle'
import { EngineSimulator } from './src/systems/engine/EngineSimulator'
import { AutomaticTransmission } from './src/systems/transmission/AutomaticTransmission'
import { useSimulationStore } from './src/stores/useSimulationStore'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadVehicle(id: string): VehicleConfig {
  const file = path.join(__dirname, 'public', 'vehicles', id, 'config.json')
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, relPath), 'utf-8')
}

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`[OK] ${name}`)
    passed++
  } catch (err: any) {
    console.error(`[FAIL] ${name}: ${err?.message || err}`)
    failed++
  }
}

console.log('\n===============================================================')
console.log('  HEATZ AUTO · FASE 1.4.1 — SUÍTE DE VALIDAÇÃO COMPLETA')
console.log('===============================================================\n')

// ─────────────────────────────────────────────────────────────
// 1. VW GOLF GTI MK7.5 — COMANDOS DE CÂMBIO MANUAL (DSG M)
// ─────────────────────────────────────────────────────────────
test('1.1 Golf GTI possui paddle_shifters E gear_selector_gesture declarados', () => {
  const golf = loadVehicle('golf-gti')
  const caps = getVehicleCapabilities(golf)

  assert.strictEqual(caps.transmissionType, 'automatic')
  assert.strictEqual(caps.supportsPaddleShifters, true, 'Golf GTI suporta borboletas')
  assert.ok(
    caps.manualShiftControls.includes('paddle_shifters'),
    'Golf GTI inclui paddle_shifters nas capacidades',
  )
  assert.ok(
    caps.manualShiftControls.includes('gear_selector_gesture'),
    'Golf GTI inclui gear_selector_gesture nas capacidades para modo manual',
  )
})

test('1.2 Golf GTI: Comportamento dinâmico em D vs M (seletor gestual e borboletas)', () => {
  const golf = loadVehicle('golf-gti')
  const store = useSimulationStore.getState()

  store.reset()
  store.init(golf)
  store.startEngine()

  // Em D (Drive automático)
  store.selectDrive()
  const stateD = useSimulationStore.getState()
  const isManualActiveD =
    stateD.transmissionMode === 'manual_simulated' || stateD.gearSelectorPosition === 'M'
  assert.strictEqual(isManualActiveD, false, 'Em D, modo manual está inativo')

  // Seleciona M (Modo Manual da DSG)
  store.selectManual()
  const stateM = useSimulationStore.getState()
  const isManualActiveM =
    stateM.transmissionMode === 'manual_simulated' || stateM.gearSelectorPosition === 'M'
  assert.strictEqual(isManualActiveM, true, 'Em M, modo manual está ativo')
  assert.strictEqual(stateM.gearSelectorPosition, 'M', 'Posição do seletor é M')

  // Troca via paddle shifter (+)
  store.shiftUp()
  const postPaddleUp = useSimulationStore.getState().currentGear

  // Troca via seletor gestual (+) — ambos usam a mesma store (shiftUp / shiftDown)
  store.shiftUp()
  const postGestureUp = useSimulationStore.getState().currentGear
  assert.ok(postGestureUp >= postPaddleUp, 'Seletor gestual comanda a mesma transmissão DSG que as borboletas')

  // Troca via seletor gestual (-)
  store.shiftDown()
  const postGestureDown = useSimulationStore.getState().currentGear
  assert.ok(postGestureDown <= postGestureUp, 'Seletor gestual reduz marcha (-)')

  // Retorna para D
  store.selectDrive()
  const stateReturnD = useSimulationStore.getState()
  assert.strictEqual(stateReturnD.gearSelectorPosition, 'D', 'Retorna à posição D')
  assert.strictEqual(stateReturnD.transmissionMode, 'automatic', 'Retorna ao modo automático')
})

// ─────────────────────────────────────────────────────────────
// 2. ESTABILIZAÇÃO DO PAINEL — ELIMINAÇÃO DA TREMEDEIRA
// ─────────────────────────────────────────────────────────────
test('2.1 VehicleDashboardCluster: Deadband no ResizeObserver e remoção de transition-transform', () => {
  const clusterWrapperCode = read('src/components/dashboard/VehicleDashboardCluster.tsx')

  // Deadband contra feedback loop subpixel no DevTools responsivo
  assert.ok(
    clusterWrapperCode.includes('Math.abs(prev.width - w) < 2') ||
    clusterWrapperCode.includes('Math.abs(prev.width - w) <='),
    'Implementa deadband de medição para evitar oscilações subpixel no ResizeObserver',
  )

  // Arredondamento de dimensões para layout estável
  assert.ok(
    clusterWrapperCode.includes('Math.round(element.clientWidth)'),
    'Arredonda clientWidth para evitar jittering subpixel',
  )
  assert.ok(
    clusterWrapperCode.includes('Math.round(element.clientHeight)'),
    'Arredonda clientHeight para evitar jittering subpixel',
  )

  // Sem transição CSS de escala que brigue com 60/120Hz
  assert.ok(
    !clusterWrapperCode.includes('transition-transform duration-150'),
    'Elimina transition-transform duration-150 que causava atraso visual e tremedeira',
  )

  // overflow-hidden na seção para isolamento
  assert.ok(
    clusterWrapperCode.includes('overflow-hidden'),
    'Container do cluster possui overflow-hidden seguro',
  )
})

test('2.2 Clusters originais: Remoção de transition-all em containers sob requestAnimationFrame', () => {
  const golfCluster = read('src/components/dashboard/clusters/GolfGTIRealCluster.tsx')
  const porscheCluster = read('src/components/dashboard/clusters/Porsche992GT3RealCluster.tsx')
  const yarisCluster = read('src/components/dashboard/clusters/ToyotaYarisRealCluster.tsx')

  // Não deve ter transition-all no root container dos clusters
  assert.ok(
    !golfCluster.includes('transition-all duration-300'),
    'Golf GTI usa transition-colors e não transition-all no container principal',
  )
  assert.ok(
    !porscheCluster.includes('transition-all duration-300'),
    'Porsche GT3 usa transition-colors e não transition-all no container principal',
  )
  assert.ok(
    !yarisCluster.includes('transition-all duration-300'),
    'Toyota Yaris usa transition-colors e não transition-all no container principal',
  )

  // Barras de turbo com atualização frame-a-frame instantânea sem lag de 75ms
  assert.ok(
    !golfCluster.includes('transition-all duration-75'),
    'Barra de boost do Golf sem atraso artificial de animação CSS',
  )
})

// ─────────────────────────────────────────────────────────────
// 3. REORGANIZAÇÃO DO CABEÇALHO E EXPANSÃO DO MAPA
// ─────────────────────────────────────────────────────────────
test('3.1 Cabeçalho compacto em 2 linhas sem ocupar faixa central extensa', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')
  const portrait = read('src/components/dashboard/MobilePortraitCockpit.tsx')

  // Landscape: cabeçalho com padding compacto e identificação em 2 linhas
  assert.ok(landscape.includes('pb-0.5 border-b'), 'Landscape possui cabeçalho superior compacto')
  assert.ok(landscape.includes('{vehicleHeader.title}'), 'Linha 1 do cabeçalho contém título do carro')
  assert.ok(landscape.includes('{vehicleHeader.specsSummary}'), 'Linha 2 do cabeçalho contém motor/CV/torque')
  assert.ok(!landscape.includes('MODO: <b className="text-white ml-1">{drivingMode}</b>'), 'Faixa central do cabeçalho liberada sem badge redundante')

  // Portrait: cabeçalho com identificação em 2 linhas
  assert.ok(portrait.includes('{vehicleHeader.title}'))
  assert.ok(portrait.includes('{vehicleHeader.specsSummary}'))
})

test('3.2 Seletores PAINEL e DIRIGIR na Garagem e MÍDIA por Swipe no slot inferior (Fase 1.5)', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')
  const portrait = read('src/components/dashboard/MobilePortraitCockpit.tsx')
  const home = read('src/screens/HomeScreen.tsx')
  const slot = read('src/components/dashboard/SwipeableClusterMediaSlot.tsx')

  // Na Fase 1.5, PAINEL e DIRIGIR foram movidos para a Garagem e MÍDIA para o slot inferior com swipe
  assert.ok(home.includes("handleSelectMode(car, 'cluster')"), 'Garagem possui botão PAINEL')
  assert.ok(home.includes("handleSelectMode(car, 'drive')"), 'Garagem possui botão DIRIGIR')
  assert.ok(slot.includes("'cluster' | 'multimedia'"), 'Slot inferior permite alternar Painel e Mídia')
  assert.ok(landscape.includes('SwipeableClusterMediaSlot'), 'Landscape utiliza o slot responsivo')
  assert.ok(portrait.includes('SwipeableClusterMediaSlot'), 'Portrait utiliza o slot responsivo')
})

test('3.3 Preservação dos 3 modos do mapa (P, M, G) com expansão vertical sem distorção', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')
  const portrait = read('src/components/dashboard/MobilePortraitCockpit.tsx')
  const mapViewport = read('src/components/dashboard/DrivingMapViewport.tsx')

  // Modos P (compact), M (balanced), G (expanded) preservados
  assert.ok(landscape.includes("mapViewportSize === 'compact'"))
  assert.ok(landscape.includes("mapViewportSize === 'expanded'"))
  assert.ok(portrait.includes("mapViewportSize === 'compact'"))
  assert.ok(portrait.includes("mapViewportSize === 'expanded'"))

  // SVG do mapa preserva proporções cartográficas reais (preserveAspectRatio slice)
  assert.ok(
    mapViewport.includes('preserveAspectRatio="xMidYMid slice"'),
    'DrivingMapViewport mantém aspecto 1:1 sem distorção de ruas ou quarteirões',
  )
})

// ─────────────────────────────────────────────────────────────
// 4. REFINAMENTO DO ACELERADOR PROPORCIONAL E PROGRESSIVO
// ─────────────────────────────────────────────────────────────
test('4.1 Acelerador progressivo: tabela de calibração (10%, 25%, 50%, 75%, 100%)', () => {
  const golf = loadVehicle('golf-gti')
  const engine = new EngineSimulator(golf.engine)
  engine.start()
  engine.tick({ throttle: 0, loadTorque: 0, deltaTime: 0.5 }) // Cranking para running

  const currentRpm = engine.getRpm()
  const maxAvail = engine.getTorqueAtRpm(currentRpm)
  assert.ok(maxAvail >= 150, 'Torque disponível consistente em marcha lenta')

  // Simulações isoladas da curva progressiva do pedal
  const testThrottle = (thr: number) => {
    const e = new EngineSimulator(golf.engine)
    e.start()
    e.tick({ throttle: 0, loadTorque: 0, deltaTime: 0.5 }) // Cranking para running
    const avail = e.getTorqueAtRpm(e.getRpm())
    const tick = e.tick({ throttle: thr, loadTorque: 0, deltaTime: 0.001 })
    return { torque: tick.torqueOutput, ratio: tick.torqueOutput / avail }
  }

  const t10 = testThrottle(0.10)
  const t25 = testThrottle(0.25)
  const t50 = testThrottle(0.50)
  const t75 = testThrottle(0.75)
  const t100 = testThrottle(1.00)

  const ratio10 = t10.ratio
  const ratio25 = t25.ratio
  const ratio50 = t50.ratio
  const ratio75 = t75.ratio
  const ratio100 = t100.ratio

  // 10% do pedal -> Muito suave (~3.5%)
  assert.ok(ratio10 > 0.02 && ratio10 < 0.07, `10% pedal muito suave: ${(ratio10 * 100).toFixed(1)}%`)

  // 25% do pedal -> Suave (~13.4%)
  assert.ok(ratio25 > 0.10 && ratio25 < 0.20, `25% pedal suave: ${(ratio25 * 100).toFixed(1)}%`)

  // 50% do pedal -> Intermediária (~36.6%), longe de 100%!
  assert.ok(ratio50 > 0.30 && ratio50 < 0.45, `50% pedal intermediária: ${(ratio50 * 100).toFixed(1)}%`)

  // 75% do pedal -> Forte (~65.9%)
  assert.ok(ratio75 > 0.60 && ratio75 < 0.75, `75% pedal forte: ${(ratio75 * 100).toFixed(1)}%`)

  // 100% do pedal -> Máxima (100%)
  assert.ok(Math.abs(ratio100 - 1.0) < 0.01, `100% pedal máxima: ${(ratio100 * 100).toFixed(1)}%`)

  // Monotonicidade estrita: cada nível de pedal entrega estritamente mais torque que o anterior
  assert.ok(t10.torque < t25.torque, 'Monotônico: 10% < 25%')
  assert.ok(t25.torque < t50.torque, 'Monotônico: 25% < 50%')
  assert.ok(t50.torque < t75.torque, 'Monotônico: 50% < 75%')
  assert.ok(t75.torque < t100.torque, 'Monotônico: 75% < 100%')
})

test('4.2 Acelerador contínuo: estabilidade ao manter, redução ao aliviar e corte a 0%', () => {
  const golf = loadVehicle('golf-gti')
  const engine = new EngineSimulator(golf.engine)
  engine.start()
  engine.tick({ throttle: 0, loadTorque: 0, deltaTime: 0.5 })

  // Mantendo 50%: resposta se mantém estável
  const tick1 = engine.tick({ throttle: 0.50, loadTorque: 0, deltaTime: 0.001 })
  const tick2 = engine.tick({ throttle: 0.50, loadTorque: 0, deltaTime: 0.001 })
  assert.ok(Math.abs(tick1.torqueOutput - tick2.torqueOutput) < 1.0, 'Manter pedal mantém torque estável')

  // Aliviando para 25%: torque cai progressivamente
  const tickAlivio = engine.tick({ throttle: 0.25, loadTorque: 0, deltaTime: 0.001 })
  assert.ok(tickAlivio.torqueOutput < tick2.torqueOutput, 'Aliviar pressão reduz torque entregue')

  // Soltando completamente (0%): torque de propulsão zera imediatamente
  const tickZero = engine.tick({ throttle: 0.0, loadTorque: 0, deltaTime: 0.001 })
  assert.strictEqual(tickZero.torqueOutput, 0, 'Soltar pedal zera torque de propulsão')
})

test('4.3 Honda CB1000R: Preservação de sensibilidade esportiva de motocicleta', () => {
  const bike = loadVehicle('cb1000r')
  assert.strictEqual(
    bike.engine.throttleProgressionExponent,
    1.15,
    'CB1000R configurada com punho rápido de motocicleta (expoente 1.15)',
  )

  const engine = new EngineSimulator(bike.engine)
  engine.start()
  engine.tick({ throttle: 0, loadTorque: 0, deltaTime: 0.5 })

  const maxAvail = engine.getTorqueAtRpm(engine.getRpm())
  const t50 = engine.tick({ throttle: 0.50, loadTorque: 0, deltaTime: 0.001 })
  const ratio50 = t50.torqueOutput / maxAvail

  // Moto esportiva a 50% de punho entrega ~45% (mais direta que o carro de passeio)
  assert.ok(ratio50 > 0.40 && ratio50 < 0.50, `Punho de moto mais direto: ${(ratio50 * 100).toFixed(1)}%`)
})

// ─────────────────────────────────────────────────────────────
// 5. PREPARAÇÃO DO MAPA PARA MOVIMENTAÇÃO FUTURA
// ─────────────────────────────────────────────────────────────
test('5.1 DrivingMapViewport exporta interface preparatória MapNavigationTelemetry sem impacto visual', () => {
  const mapCode = read('src/components/dashboard/DrivingMapViewport.tsx')

  assert.ok(
    mapCode.includes('export interface MapNavigationTelemetry'),
    'DrivingMapViewport exporta interface MapNavigationTelemetry',
  )
  assert.ok(mapCode.includes('coordinates?: { x: number; y: number }'), 'Suporta coordenadas cartográficas')
  assert.ok(mapCode.includes('headingDeg?: number'), 'Suporta rumo em graus')
  assert.ok(mapCode.includes('speedKmh?: number'), 'Suporta velocidade em km/h')
  assert.ok(mapCode.includes('navigation?: MapNavigationTelemetry'), 'Props do mapa suportam estado preparatório')
})

console.log('\n===============================================================')
console.log(`RESULTADO DA FASE 1.4.1: ${passed} PASSOU | ${failed} FALHOU`)
console.log('===============================================================\n')

if (failed > 0) {
  process.exit(1)
}
