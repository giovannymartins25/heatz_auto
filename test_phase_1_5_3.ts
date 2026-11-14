import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useUIStore, type GraphicProfile } from './src/stores/useUIStore'
import { areDrivingMapPropsEqual, type MapNavigationTelemetry } from './src/components/dashboard/DrivingMapViewport'
import { performanceMonitor } from './src/utils/performanceMonitor'
import type { VehicleConfig } from './src/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadVehicle(vehicleId: string): VehicleConfig {
  const fullPath = path.join(__dirname, 'public/vehicles', vehicleId, 'config.json')
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as VehicleConfig
}

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, relPath), 'utf-8')
}

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`[OK] ${name}`)
    passed++
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[FAIL] ${name}: ${msg}`)
    failed++
  }
}

interface SimRunMetrics {
  speed: number
  rpm: number
  gear: number
  isRunning: boolean
  isStalled: boolean
  best0to100: number | null
  last0to100: number | null
  boostPressureBar: number
  peakBoostBar: number
  coolantTemp: number
  oilTemp: number
  brakeDiscTemp: number
  brakeFadeFactor: number
  fuelLevelLiters: number
  nosPressurePercent: number
  dragStage: string
  dragDistanceTraveled: number
  dragTimeSlip: ReturnType<typeof useSimulationStore.getState>['dragTimeSlip']
  visualUpdatesCount: number
  skippedVisualUpdatesCount: number
  slowUpdatesCount: number
  skippedSlowUpdatesCount: number
}

function runControlledPull(
  vehicle: VehicleConfig,
  profile: GraphicProfile,
  frameDt: number,
  totalSeconds: number,
): SimRunMetrics {
  const sim = useSimulationStore.getState()
  useUIStore.getState().setGraphicProfile(profile)
  sim.init(vehicle, { turboKit: true, nosKit: true, tuningStage: 1 })
  sim.startEngine()
  sim.selectShifterMode('D')

  const totalFrames = Math.round(totalSeconds / frameDt)
  for (let i = 0; i < totalFrames; i++) {
    const tSec = i * frameDt
    if (i === 1) {
      useSimulationStore.setState({
        dragStage: 'green',
        _dragGreenTime: 0,
      })
    }
    if (tSec < 4.5) {
      useSimulationStore.getState().setThrottle(1.0)
      useSimulationStore.getState().setBrake(0)
      if (tSec >= 1.5) {
        useSimulationStore.getState().setNosActive(true)
      }
    } else if (tSec < 6.5) {
      useSimulationStore.getState().setNosActive(false)
      useSimulationStore.getState().setThrottle(0)
      useSimulationStore.getState().setBrake(1.0)
    } else {
      useSimulationStore.getState().setBrake(0)
      useSimulationStore.getState().setThrottle(1.0)
    }

    useSimulationStore.getState().update(frameDt)
  }

  const finalState = useSimulationStore.getState()
  const p = finalState._phys
  return {
    speed: p.speedKmh,
    rpm: p.rpm,
    gear: p.gear,
    isRunning: p.isRunning,
    isStalled: p.isStalled,
    best0to100: finalState._timer0to100State.bestCompleted,
    last0to100: finalState._timer0to100State.lastCompleted,
    boostPressureBar: p.boostPressureBar,
    peakBoostBar: p.peakBoostBar,
    coolantTemp: p.coolantTemp,
    oilTemp: p.oilTemp,
    brakeDiscTemp: p.brakeDiscTemp,
    brakeFadeFactor: p.brakeFadeFactor,
    fuelLevelLiters: p.fuelLevelLiters,
    nosPressurePercent: p.nosPressurePercent,
    dragStage: p.dragStage,
    dragDistanceTraveled: p.dragDistanceTraveled,
    dragTimeSlip: p.dragTimeSlip,
    visualUpdatesCount: p.visualUpdatesCount,
    skippedVisualUpdatesCount: p.skippedVisualUpdatesCount,
    slowUpdatesCount: p.slowUpdatesCount,
    skippedSlowUpdatesCount: p.skippedSlowUpdatesCount,
  }
}

console.log('\n===============================================================')
console.log('  HEATZ AUTO · FASE 1.5.3 — VERIFICAÇÃO COMPORTAMENTAL E REGRESSÃO')
console.log('===============================================================\n')

const golfGti = loadVehicle('golf-gti')
const golG6 = loadVehicle('gol-g6')
const porscheGt3 = loadVehicle('porsche-gt3')

// ─────────────────────────────────────────────────────────────
// A. EQUIVALÊNCIA FÍSICA ENTRE PERFIS ECO / NORMAL / ALTO
// ─────────────────────────────────────────────────────────────
test('A.1 Equivalência exata de física em 60 FPS (1/60s) entre ECO, NORMAL e ALTO', () => {
  const frameDt = 1 / 60
  const eco = runControlledPull(golfGti, 'eco', frameDt, 10)
  const normal = runControlledPull(golfGti, 'normal', frameDt, 10)
  const high = runControlledPull(golfGti, 'high', frameDt, 10)

  // Exercício explícito dos caminhos com throttle ativo sem !isBrowser
  assert.ok(eco.skippedVisualUpdatesCount > 0, `ECO deve pular atualizações visuais (puladas: ${eco.skippedVisualUpdatesCount})`)
  assert.ok(eco.skippedVisualUpdatesCount > high.skippedVisualUpdatesCount, 'ECO pula mais visual que ALTO')
  assert.ok(eco.skippedSlowUpdatesCount > 0, 'ECO pula telemetria lenta entre 150ms')
  assert.ok(normal.skippedSlowUpdatesCount > 0, 'NORMAL pula telemetria lenta entre 150ms')
  assert.ok(high.skippedSlowUpdatesCount > 0, 'ALTO pula telemetria lenta entre 150ms')

  // Métricas físicas finais idênticas nos 3 perfis
  const pairs: Array<[string, SimRunMetrics, SimRunMetrics]> = [
    ['ECO vs ALTO', eco, high],
    ['NORMAL vs ALTO', normal, high],
  ]

  for (const [label, a, b] of pairs) {
    assert.ok(Math.abs(a.speed - b.speed) < 0.001, `${label}: speed diverge (${a.speed} vs ${b.speed})`)
    assert.ok(Math.abs(a.rpm - b.rpm) < 0.01, `${label}: rpm diverge (${a.rpm} vs ${b.rpm})`)
    assert.strictEqual(a.gear, b.gear, `${label}: gear diverge`)
    assert.strictEqual(a.isRunning, b.isRunning, `${label}: isRunning diverge`)
    assert.strictEqual(a.isStalled, b.isStalled, `${label}: isStalled diverge`)
    assert.strictEqual(a.best0to100, b.best0to100, `${label}: best0to100 diverge (${a.best0to100} vs ${b.best0to100})`)
    assert.strictEqual(a.last0to100, b.last0to100, `${label}: last0to100 diverge`)
    assert.ok(Math.abs(a.boostPressureBar - b.boostPressureBar) < 0.001, `${label}: boostPressureBar diverge`)
    assert.ok(Math.abs(a.peakBoostBar - b.peakBoostBar) < 0.001, `${label}: peakBoostBar diverge`)
    assert.ok(Math.abs(a.coolantTemp - b.coolantTemp) < 0.001, `${label}: coolantTemp diverge`)
    assert.ok(Math.abs(a.oilTemp - b.oilTemp) < 0.001, `${label}: oilTemp diverge`)
    assert.ok(Math.abs(a.brakeDiscTemp - b.brakeDiscTemp) < 0.001, `${label}: brakeDiscTemp diverge`)
    assert.ok(Math.abs(a.brakeFadeFactor - b.brakeFadeFactor) < 0.001, `${label}: brakeFadeFactor diverge`)
    assert.ok(Math.abs(a.fuelLevelLiters - b.fuelLevelLiters) < 0.0001, `${label}: fuelLevelLiters diverge`)
    assert.ok(Math.abs(a.nosPressurePercent - b.nosPressurePercent) < 0.001, `${label}: nosPressurePercent diverge`)
    assert.ok(Math.abs(a.dragDistanceTraveled - b.dragDistanceTraveled) < 0.01, `${label}: dragDistance diverge`)
    assert.strictEqual(a.dragStage, b.dragStage, `${label}: dragStage diverge`)
  }
})

test('A.2 Equivalência exata de física em 120 FPS (1/120s) e variação mínima vs 60 FPS', () => {
  const eco120 = runControlledPull(golfGti, 'eco', 1 / 120, 8)
  const normal120 = runControlledPull(golfGti, 'normal', 1 / 120, 8)
  const high120 = runControlledPull(golfGti, 'high', 1 / 120, 8)
  const eco60 = runControlledPull(golfGti, 'eco', 1 / 60, 8)

  assert.ok(eco120.skippedVisualUpdatesCount > 400, `120 FPS em ECO deve pular >400 frames visuais (pulou ${eco120.skippedVisualUpdatesCount})`)
  assert.ok(normal120.skippedVisualUpdatesCount > 200, `120 FPS em NORMAL deve pular >200 frames visuais (pulou ${normal120.skippedVisualUpdatesCount})`)
  assert.ok(high120.skippedVisualUpdatesCount > 200, `Fase 1.5.5: 120 Hz em ALTO respeita teto visual de 60 FPS pulando frames intermediários (pulou ${high120.skippedVisualUpdatesCount})`)

  assert.ok(Math.abs(eco120.speed - high120.speed) < 0.001, '120 FPS ECO vs ALTO velocidade idêntica')
  assert.ok(Math.abs(normal120.speed - high120.speed) < 0.001, '120 FPS NORMAL vs ALTO velocidade idêntica')
  assert.ok(Math.abs(eco120.brakeDiscTemp - high120.brakeDiscTemp) < 0.001, '120 FPS freios idênticos')
  assert.ok(Math.abs(eco120.coolantTemp - high120.coolantTemp) < 0.001, '120 FPS arrefecimento idêntico')
  assert.ok(Math.abs(eco120.fuelLevelLiters - high120.fuelLevelLiters) < 0.0001, '120 FPS combustível idêntico')

  // Equivalência entre 60 FPS e 120 FPS no mesmo tempo simulado
  assert.ok(Math.abs(eco60.speed - eco120.speed) < 0.5, `60Hz vs 120Hz speed convergente (${eco60.speed.toFixed(2)} vs ${eco120.speed.toFixed(2)})`)
  assert.ok(Math.abs(eco60.coolantTemp - eco120.coolantTemp) < 0.2, '60Hz vs 120Hz arrefecimento convergente')
})

// ─────────────────────────────────────────────────────────────
// B. EVENTOS CRÍTICOS IMEDIATOS NO PERFIL ECO
// ─────────────────────────────────────────────────────────────
test('B.1 Pane seca dispara imediatamente no exato tick sob perfil ECO a 120 FPS', () => {
  useUIStore.getState().setGraphicProfile('eco')
  const sim = useSimulationStore.getState()
  sim.init(golG6)
  sim.startEngine()
  // Primeira atualização força publicação inicial para zerar janela ECO
  sim.update(1 / 120)
  useSimulationStore.setState({ fuelLevelLiters: 0.008 })
  sim.setThrottle(1.0)

  let detectedSameTick = false
  for (let i = 0; i < 600; i++) {
    useSimulationStore.getState().update(1 / 120)
    const s = useSimulationStore.getState()
    if (s._phys.isOutOfFuel) {
      assert.strictEqual(s.isOutOfFuel, true, 'store.isOutOfFuel deve refletir imediatamente no tick da pane seca')
      assert.strictEqual(s.isRunning, false, 'Motor deve desligar imediatamente na pane seca')
      assert.strictEqual(s.isStalled, true, 'Estado must ser stalled na pane seca')
      detectedSameTick = true
      break
    }
  }
  assert.ok(detectedSameTick, 'Pane seca deve ocorrer dentro dos ticks simulados')
})

test('B.2 Superaquecimento crítico (>125°C) dispara isEngineBlown imediatamente no perfil ECO', () => {
  useUIStore.getState().setGraphicProfile('eco')
  const sim = useSimulationStore.getState()
  sim.init(porscheGt3)
  sim.startEngine()
  sim.update(1 / 120)
  useSimulationStore.setState({ coolantTemp: 124.85 })
  sim.setThrottle(1.0)

  let blownSameTick = false
  for (let i = 0; i < 240; i++) {
    useSimulationStore.getState().update(1 / 120)
    const s = useSimulationStore.getState()
    if (s._phys.isEngineBlown) {
      assert.strictEqual(s.isEngineBlown, true, 'store.isEngineBlown deve refletir imediatamente ao cruzar 125°C')
      assert.strictEqual(s.isRunning, false, 'Motor deve desligar ao fundir por superaquecimento')
      blownSameTick = true
      break
    }
  }
  assert.ok(blownSameTick, 'Superaquecimento deve ocorrer e publicar no mesmo tick')
})

test('B.3 Corte de giro (rev limiter) e transição de arrancada refletem imediatamente no ECO', () => {
  useUIStore.getState().setGraphicProfile('eco')
  const sim = useSimulationStore.getState()
  sim.init(golG6)
  sim.startEngine()
  sim.update(1 / 120)
  sim.setThrottle(1.0)

  let revLimitSyncOk = false
  for (let i = 0; i < 600; i++) {
    useSimulationStore.getState().update(1 / 120)
    const s = useSimulationStore.getState()
    if (s._phys.isRevLimiting && s.isRevLimiting) {
      revLimitSyncOk = true
      break
    }
  }
  assert.ok(revLimitSyncOk, 'Corte de giro sincroniza imediatamente na store sob perfil ECO')

  // Chegada nos 402m durante janela suprimida
  useSimulationStore.setState({
    dragStage: 'racing',
    _dragDistanceTraveled: 402.0,
    speed: 180,
    dragTimeSlip: {
      reactionTime: 0.12,
      time60ft: 2.0,
      time0to100: 4.5,
      time201m: 7.5,
      time402m: 0,
      trapSpeedKmh: 0,
      isDisqualified: false,
      createdAt: Date.now(),
    },
  })
  useSimulationStore.getState().update(1 / 120)
  assert.strictEqual(useSimulationStore.getState().dragStage, 'finished', 'dragStage finished deve refletir no exato tick de chegada')
})

test('B.4 Alternância de perfil em movimento preserva sessão, velocidade, RPM e marcha sem saltos', () => {
  const sim = useSimulationStore.getState()
  sim.init(golfGti)
  sim.startEngine()
  sim.selectShifterMode('D')
  sim.setThrottle(1.0)

  useUIStore.getState().setGraphicProfile('eco')
  for (let i = 0; i < 180; i++) useSimulationStore.getState().update(1 / 60)

  const beforeSwitch = useSimulationStore.getState()
  assert.ok(beforeSwitch._phys.speedKmh > 30, 'Veículo deve estar em movimento antes da troca')
  const speedBefore = beforeSwitch._phys.speedKmh
  const rpmBefore = beforeSwitch._phys.rpm
  const gearBefore = beforeSwitch._phys.gear

  useUIStore.getState().setGraphicProfile('high')
  useSimulationStore.getState().update(1 / 60)
  const afterHigh = useSimulationStore.getState()
  assert.ok(afterHigh._phys.speedKmh >= speedBefore, 'Trocar para ALTO não reseta velocidade')
  assert.strictEqual(afterHigh._phys.isRunning, true, 'Motor continua ligado')
  assert.ok(afterHigh._phys.gear >= gearBefore, 'Marcha preservada na troca de perfil')
  assert.ok(afterHigh._phys.rpm > 1000 && rpmBefore > 1000, 'RPM contínuo preservado')

  useUIStore.getState().setGraphicProfile('normal')
  useSimulationStore.getState().update(1 / 60)
  assert.ok(useSimulationStore.getState()._phys.speedKmh >= speedBefore, 'Trocar para NORMAL preserva sessão contínua')
})

// ─────────────────────────────────────────────────────────────
// C. INTEGRIDADE DO MAPA (BUG-02)
// ─────────────────────────────────────────────────────────────
test('C.1 Comparador memo do DrivingMapViewport atualiza em 0→1→10→85→200→50→0 e ignora sub-inteiros', () => {
  const onSizeChange = () => {}
  const makeProps = (speed: number, size: 'compact' | 'balanced' | 'expanded' = 'balanced', nav?: MapNavigationTelemetry) => ({
    size,
    onSizeChange,
    compact: false,
    className: '',
    telemetry: { speedometer: { speed } } as any,
    navigation: nav,
  })

  const sequence = [0, 1, 10, 85, 200, 50, 0]
  for (let i = 0; i < sequence.length - 1; i++) {
    const a = makeProps(sequence[i])
    const b = makeProps(sequence[i + 1])
    assert.strictEqual(
      areDrivingMapPropsEqual(a, b),
      false,
      `Transição ${sequence[i]} -> ${sequence[i + 1]} km/h DEVE exigir re-render`,
    )
  }

  // Sub-variações que arredondam para o mesmo inteiro não causam re-render extra
  assert.strictEqual(
    areDrivingMapPropsEqual(makeProps(85.1), makeProps(85.4)),
    true,
    'Mesmo inteiro arredondado (85 km/h) preserva memoização',
  )

  // Mudanças de tamanho P / M / G
  assert.strictEqual(areDrivingMapPropsEqual(makeProps(50, 'compact'), makeProps(50, 'balanced')), false)
  assert.strictEqual(areDrivingMapPropsEqual(makeProps(50, 'balanced'), makeProps(50, 'expanded')), false)

  // Mudanças na telemetria de navegação (heading, distância, coordenadas)
  assert.strictEqual(
    areDrivingMapPropsEqual(
      makeProps(60, 'balanced', { headingDeg: 10, speedKmh: 60, distanceTraveledMeters: 100, coordinates: { x: 1, y: 2 } }),
      makeProps(60, 'balanced', { headingDeg: 25, speedKmh: 60, distanceTraveledMeters: 100, coordinates: { x: 1, y: 2 } }),
    ),
    false,
    'Mudança em navigation.headingDeg deve atualizar o mapa',
  )
  assert.strictEqual(
    areDrivingMapPropsEqual(
      makeProps(60, 'balanced', { headingDeg: 10, coordinates: { x: 1, y: 2 } }),
      makeProps(60, 'balanced', { headingDeg: 10, coordinates: { x: 4, y: 2 } }),
    ),
    false,
    'Mudança em navigation.coordinates deve atualizar o mapa',
  )
})

test('C.2 Malha SVG estática do mapa isolada em MapSvgMesh sem quebrar invariantes de layout', () => {
  const mapCode = readSource('src/components/dashboard/DrivingMapViewport.tsx')
  assert.ok(mapCode.includes('const MapSvgMesh = memo('), 'Malha SVG isolada em MapSvgMesh memoizado')
  assert.ok(mapCode.includes('export function areDrivingMapPropsEqual'), 'Comparador exportado para teste unitário')
  assert.ok(mapCode.includes('preserveAspectRatio="xMidYMid slice"'), 'Preserva proporção slice exigida pelo layout')
  assert.ok(mapCode.includes('relative isolate flex flex-col w-full h-full'), 'Preserva container raiz')
})

// ─────────────────────────────────────────────────────────────
// D. MONITOR DE PERFORMANCE (BUG-03)
// ─────────────────────────────────────────────────────────────
test('D.1 performanceMonitor zera métricas ao reiniciar (reset/start)', () => {
  performanceMonitor.stop()
  performanceMonitor.start(0)
  // Simula picos antigos com dropped frames
  performanceMonitor.recordFrameDelta(16.67, 16.67)
  performanceMonitor.recordFrameDelta(40, 56.67)
  performanceMonitor.recordPhysicsTick(10)
  assert.ok(performanceMonitor.getSnapshot().droppedFrames >= 1, 'Dropped frame antigo registrado')

  performanceMonitor.stop()
  performanceMonitor.start(1000)
  const cleanSnap = performanceMonitor.getSnapshot()
  assert.strictEqual(cleanSnap.droppedFrames, 0, 'droppedFrames deve zerar no start()')
  assert.strictEqual(cleanSnap.physicsTicksTotal, 0, 'physicsTicksTotal deve zerar no start()')
  assert.strictEqual(cleanSnap.physicsHz, 0, 'physicsHz inicia zerado antes dos ticks')
  assert.strictEqual(cleanSnap.reactRendersPerSec, 0, 'reactRendersPerSec inicia zerado')
  performanceMonitor.stop()
})

test('D.2 Detecção adaptativa de dropped frames para 60 Hz e 120 Hz + FPS sem distorção EMA', () => {
  performanceMonitor.stop()
  performanceMonitor.start(0)

  // Cenário 60 Hz (dt = 16.67ms): não deve contar drop; dt = 30ms conta 1 drop
  let t = 0
  for (let i = 0; i < 20; i++) {
    t += 16.67
    performanceMonitor.recordFrameDelta(16.67, t)
  }
  const snap60 = performanceMonitor.getSnapshot()
  assert.strictEqual(snap60.droppedFrames, 0, 'Frames estáveis a 60 Hz não contam como drop')
  assert.ok(Math.abs(snap60.fps - 60) <= 0.5, `FPS em janela de 60 Hz deve ser ~60 (atual: ${snap60.fps})`)

  t += 30
  performanceMonitor.recordFrameDelta(30, t)
  assert.strictEqual(performanceMonitor.getSnapshot().droppedFrames, 1, 'dt=30ms em tela 60 Hz deve contar como drop')

  // Cenário 120 Hz (dt = 8.33ms): dt = 16ms (> 13.5ms) deve contar como drop!
  performanceMonitor.stop()
  performanceMonitor.start(0)
  t = 0
  for (let i = 0; i < 20; i++) {
    t += 8.333
    performanceMonitor.recordFrameDelta(8.333, t)
  }
  const snap120 = performanceMonitor.getSnapshot()
  assert.strictEqual(snap120.droppedFrames, 0, 'Frames estáveis a 120 Hz não contam como drop')
  assert.ok(Math.abs(snap120.fps - 120) <= 0.5, `FPS em janela de 120 Hz deve ser ~120 (atual: ${snap120.fps})`)

  t += 16
  performanceMonitor.recordFrameDelta(16, t)
  assert.strictEqual(performanceMonitor.getSnapshot().droppedFrames, 1, 'dt=16ms em tela 120 Hz deve contar como 1 dropped frame')

  // Queda abrupta 60 -> 30 FPS reflete na janela sem inércia EMA lenta
  performanceMonitor.stop()
  performanceMonitor.start(0)
  t = 0
  for (let i = 0; i < 60; i++) {
    t += 16.67
    performanceMonitor.recordFrameDelta(16.67, t)
  }
  for (let i = 0; i < 35; i++) {
    t += 33.33
    performanceMonitor.recordFrameDelta(33.33, t)
  }
  const dropFpsSnap = performanceMonitor.getSnapshot()
  assert.ok(Math.abs(dropFpsSnap.fps - 30) <= 1.5, `Queda real para 30 FPS sobre 1s deve refletir ~30 FPS (atual: ${dropFpsSnap.fps})`)

  performanceMonitor.stop()
})

test('D.3 physicsHz estável em 120 Hz em janela >=1s, reactRendersPerSec cai a 0 ocioso e memoryMb retorna null sem API', () => {
  performanceMonitor.stop()
  performanceMonitor.start(0)

  // Dispara 240 ticks exatos em 2000ms a 120 Hz (2 ticks por frame de 16.6667ms como no browser)
  for (let frame = 1; frame <= 120; frame++) {
    const ts = frame * (1000 / 60)
    performanceMonitor.recordPhysicsTick(ts)
    performanceMonitor.recordPhysicsTick(ts)
  }

  const snapAfter2s = performanceMonitor.getSnapshot(2000)
  assert.strictEqual(snapAfter2s.physicsHz, 120, `physicsHz sobre janela de 1s deve ser exato 120 Hz (atual: ${snapAfter2s.physicsHz})`)
  assert.strictEqual(snapAfter2s.physicsTicksTotal, 240, 'physicsTicksTotal registra 240 ticks reais')

  // Após > 1s sem ticks, physicsHz cai para 0
  const snapIdlePhys = performanceMonitor.getSnapshot(3500)
  assert.strictEqual(snapIdlePhys.physicsHz, 0, 'physicsHz deve ir para 0 quando simulação para')

  // React renders: 18 renders dentro de [100..500], depois ócio até t = 2000 -> cai a 0
  for (let i = 0; i < 18; i++) {
    performanceMonitor.recordReactRender(100 + i * 20)
  }
  assert.strictEqual(performanceMonitor.getSnapshot(500).reactRendersPerSec, 18, 'Registra 18 renders/s na janela')
  performanceMonitor.flushMetrics(2000)
  assert.strictEqual(performanceMonitor.getSnapshot(2000).reactRendersPerSec, 0, 'reactRendersPerSec cai para 0 quando UI está ociosa')

  // Sem performance.memory no Node -> memoryMb === null
  const originalMemory = (performance as unknown as { memory?: unknown }).memory
  try {
    Object.defineProperty(performance, 'memory', { value: undefined, configurable: true })
    assert.strictEqual(performanceMonitor.getSnapshot().memoryMb, null, 'memoryMb é null quando API heap não está disponível')
  } finally {
    if (originalMemory !== undefined) {
      Object.defineProperty(performance, 'memory', { value: originalMemory, configurable: true })
    }
  }

  // PerformanceMonitorOverlay exibe RENDERS e N/D quando memoryMb === null
  const overlayCode = readSource('src/components/debug/PerformanceMonitorOverlay.tsx')
  assert.ok(overlayCode.includes('RENDERS') && overlayCode.includes('reactRendersPerSec'), 'Overlay exibe reactRendersPerSec')
  assert.ok(overlayCode.includes("'N/D'"), 'Overlay exibe N/D quando memória não está disponível')

  performanceMonitor.stop()
})

// ─────────────────────────────────────────────────────────────
// E. EFEITOS CONECTADOS AO PERFIL GRÁFICO
// ─────────────────────────────────────────────────────────────
test('E.1 RainWindshieldEffect e BackfireFlameFlash respeitam graphicProfile apenas visualmente', () => {
  const rainCode = readSource('src/components/effects/RainWindshieldEffect.tsx')
  const flameCode = readSource('src/components/effects/BackfireFlameFlash.tsx')

  assert.ok(rainCode.includes('useUIStore'), 'RainWindshieldEffect conecta-se a useUIStore')
  assert.ok(rainCode.includes("graphicProfile === 'eco'"), 'RainWindshieldEffect adapta gotas e blur para modo eco')
  assert.ok(!rainCode.includes('setSurfaceFriction'), 'RainWindshieldEffect não manipula atrito físico')

  assert.ok(flameCode.includes('useUIStore'), 'BackfireFlameFlash conecta-se a useUIStore')
  assert.ok(flameCode.includes("graphicProfile === 'eco'"), 'BackfireFlameFlash reduz camadas pesadas no modo eco')
  assert.ok(!flameCode.includes('useSimulationStore.setState'), 'BackfireFlameFlash não altera estado físico')
})

useUIStore.getState().setGraphicProfile('normal')
performanceMonitor.stop()

console.log('\n===============================================================')
console.log(`RESULTADO DA FASE 1.5.3: ${passed} PASSOU | ${failed} FALHOU`)
console.log('===============================================================\n')

if (failed > 0) {
  process.exit(1)
}
