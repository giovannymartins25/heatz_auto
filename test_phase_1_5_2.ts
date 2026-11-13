import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useUIStore } from './src/stores/useUIStore'
import { performanceMonitor } from './src/utils/performanceMonitor'
import { isFullscreenSupported, isDocumentFullscreen, isStandaloneOrFullscreenApp } from './src/utils/fullscreen'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
console.log('  HEATZ AUTO · FASE 1.5.2 — SUÍTE DE VALIDAÇÃO COMPLETA')
console.log('===============================================================\n')

// ─────────────────────────────────────────────────────────────
// 1. PWA IMMERSIVE MODE & CONFIGURAÇÃO DO MANIFESTO
// ─────────────────────────────────────────────────────────────
test('1.1 Manifesto PWA configurado com display: fullscreen e display_override', () => {
  const viteConfig = read('vite.config.ts')

  assert.ok(viteConfig.includes("display: 'fullscreen'"), 'Manifesto define display: fullscreen')
  assert.ok(
    viteConfig.includes("display_override: ['fullscreen', 'standalone']"),
    'Manifesto define display_override com fallback gracioso para standalone',
  )
  assert.ok(viteConfig.includes("orientation: 'any'"), 'Manifesto permite orientação fluida')
})

test('1.2 index.html possui meta tags de viewport-fit=cover e mobile-web-app-capable', () => {
  const html = read('index.html')

  assert.ok(html.includes('viewport-fit=cover'), 'index.html inclui viewport-fit=cover para suporte a safe-areas')
  assert.ok(html.includes('name="mobile-web-app-capable" content="yes"'), 'mobile-web-app-capable presente para Android')
  assert.ok(html.includes('name="apple-mobile-web-app-capable" content="yes"'), 'apple-mobile-web-app-capable presente')
})

test('1.3 Utilitário de Fullscreen (fullscreen.ts) implementa API com navigationUI: hide', () => {
  const fsCode = read('src/utils/fullscreen.ts')

  assert.ok(fsCode.includes("navigationUI: 'hide'"), 'requestFullscreen utiliza navigationUI: hide para Android')
  assert.ok(fsCode.includes('webkitRequestFullscreen'), 'Possui fallback para WebKit/Blink')
  assert.ok(fsCode.includes('onFullscreenChange'), 'Exporta listener de mudança de fullscreen')
  assert.strictEqual(typeof isFullscreenSupported, 'function')
  assert.strictEqual(typeof isDocumentFullscreen, 'function')
  assert.strictEqual(typeof isStandaloneOrFullscreenApp, 'function')
})

// ─────────────────────────────────────────────────────────────
// 2. MONITOR INTERNO DE DIAGNÓSTICO DE PERFORMANCE
// ─────────────────────────────────────────────────────────────
test('2.1 PerformanceDiagnosticsTracker coleta todas as métricas obrigatórias', () => {
  assert.ok(performanceMonitor, 'Instância singleton do performanceMonitor exportada')

  const snap = performanceMonitor.getSnapshot()
  assert.ok('fps' in snap, 'Métrica FPS presente')
  assert.ok('frameTimeMs' in snap, 'Métrica frameTimeMs presente')
  assert.ok('frameTimeP95Ms' in snap, 'Métrica frameTimeP95Ms presente')
  assert.ok('physicsHz' in snap, 'Métrica physicsHz presente')
  assert.ok('droppedFrames' in snap, 'Métrica droppedFrames presente')
  assert.ok('longTasksCount' in snap, 'Métrica longTasksCount presente')
  assert.ok('memoryMb' in snap, 'Métrica memoryMb presente')
  assert.ok('reactRendersPerSec' in snap, 'Métrica reactRendersPerSec presente')
})

test('2.2 PerformanceDiagnosticsTracker suporta ciclo de vida start/stop e subscrição', () => {
  let receivedSnapshot = false
  const unsubscribe = performanceMonitor.subscribe((snap) => {
    if (snap) receivedSnapshot = true
  })

  assert.ok(performanceMonitor.isEnabled(), 'Monitor ativado com ouvintes')
  assert.ok(receivedSnapshot, 'Snapshot imediato fornecido ao assinante')

  unsubscribe()
  assert.ok(!performanceMonitor.isEnabled(), 'Monitor desativado sem ouvintes (zero overhead em prod)')
})

test('2.3 PerformanceMonitorOverlay implementa HUD discreto a 2Hz', () => {
  const hudCode = read('src/components/debug/PerformanceMonitorOverlay.tsx')

  assert.ok(hudCode.includes('showPerformanceMonitor'), 'Conectado à store useUIStore')
  assert.ok(hudCode.includes('urlEnabled'), 'Suporta ativação via query param ?perf=1')
  assert.ok(hudCode.includes('performanceMonitor.subscribe'), 'Subscreve ao performanceMonitor')
  assert.ok(hudCode.includes('pointer-events-none'), 'Não bloqueia toques do jogador')
})

// ─────────────────────────────────────────────────────────────
// 3. DESACOPLAMENTO DE FÍSICA (120 HZ) E TELEMETRIA VISUAL
// ─────────────────────────────────────────────────────────────
test('3.1 Loop de física preservado a 120 Hz com medição dedicada', () => {
  const simCode = read('src/stores/useSimulationStore.ts')

  assert.ok(simCode.includes('const dt = PHYSICS_TIMESTEP'), 'Timestep fixo de física 120 Hz preservado')
  assert.ok(simCode.includes('performanceMonitor.recordPhysicsTick()'), 'Frequência da física instrumentada no loop')
})

test('3.2 useSimulationStore implementa desacoplamento e throttle visual adaptativo', () => {
  const simCode = read('src/stores/useSimulationStore.ts')

  assert.ok(simCode.includes('minVisualInterval'), 'Intervalo mínimo visual configurável por perfil')
  assert.ok(simCode.includes('shouldUpdateVisual'), 'Lógica de separação entre avanço físico e renderização')
  assert.ok(simCode.includes('shouldUpdateSlow'), 'Throttle de telemetria secundária (térmica, combustível)')
  assert.ok(simCode.includes('now - _lastSlowTelemetryUpdate >= 150'), 'Telemetria lenta atualizada a ~6.6 Hz')
})

// ─────────────────────────────────────────────────────────────
// 4. PERFIS DE DESEMPENHO (ECO / NORMAL / ALTO)
// ─────────────────────────────────────────────────────────────
test('4.1 useUIStore gerencia perfis de desempenho gráfico (eco, normal, high)', () => {
  const store = useUIStore.getState()

  assert.ok('graphicProfile' in store, 'graphicProfile presente na store')
  assert.strictEqual(useUIStore.getState().graphicProfile, 'normal', 'Perfil padrão é normal')

  useUIStore.getState().setGraphicProfile('eco')
  assert.strictEqual(useUIStore.getState().graphicProfile, 'eco', 'Permite alternar para eco')

  useUIStore.getState().setGraphicProfile('high')
  assert.strictEqual(useUIStore.getState().graphicProfile, 'high', 'Permite alternar para high')

  useUIStore.getState().setGraphicProfile('normal')
})

test('4.2 Efeitos visuais adaptam filtros e animações conforme o perfil gráfico', () => {
  const burnoutCode = read('src/components/effects/BurnoutSmokeEffect.tsx')
  const blownCode = read('src/components/effects/EngineBlownSmokeEffect.tsx')

  assert.ok(burnoutCode.includes("graphicProfile === 'eco' ? 'blur-sm' : 'blur-3xl'"), 'Burnout usa blur leve no modo eco')
  assert.ok(blownCode.includes("graphicProfile === 'eco' ? 'blur-md' : 'blur-3xl'"), 'Engine blown usa blur leve no modo eco')
})

test('4.3 MobileQuickMenu disponibiliza atalhos para Tela Cheia, Gráficos e Diagnóstico', () => {
  const menuCode = read('src/components/dashboard/MobileQuickMenu.tsx')

  assert.ok(menuCode.includes('Tela Cheia'), 'Botão Tela Cheia presente')
  assert.ok(menuCode.includes('Gráficos'), 'Seletor de Perfil Gráfico presente')
  assert.ok(menuCode.includes('Diagnóstico'), 'Toggle do HUD de Diagnóstico presente')
  assert.ok(menuCode.includes('handleToggleFullscreen'), 'Chama toggle fullscreen')
})

// ─────────────────────────────────────────────────────────────
// 5. OTIMIZAÇÃO DE RE-RENDERIZAÇÃO DO MAPA E CLUSTER
// ─────────────────────────────────────────────────────────────
test('5.1 DrivingMapViewport possui comparador customizado em memo para evitar re-renders a 120Hz', () => {
  const mapCode = read('src/components/dashboard/DrivingMapViewport.tsx')

  assert.ok(mapCode.includes('prevMoving === nextMoving'), 'Compara estado parado/movimento em vez de objeto de telemetria')
  assert.ok(mapCode.includes('prev.size === next.size'), 'Compara tamanho P/M/G')
})

test('5.2 VehicleDashboardCluster registra contagem real de reconciliações React', () => {
  const clusterCode = read('src/components/dashboard/VehicleDashboardCluster.tsx')

  assert.ok(clusterCode.includes('performanceMonitor.recordReactRender()'), 'Mede frequência de renderização do painel')
})

console.log('\n===============================================================')
console.log(`RESULTADO DA FASE 1.5.2: ${passed} PASSOU | ${failed} FALHOU`)
console.log('===============================================================\n')

if (failed > 0) {
  process.exit(1)
}
