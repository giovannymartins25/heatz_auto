import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  getAppDisplayMode,
  isImmersiveFullscreenActive,
  isStandaloneOrFullscreenApp,
  requestAppFullscreen,
  exitAppFullscreen,
  toggleAppFullscreen,
  initImmersiveFullscreenLifecycle,
  resetFullscreenManagerForTests,
} from './src/utils/fullscreen'
import { DashboardSystem } from './src/systems/dashboard'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useUIStore, type GraphicProfile } from './src/stores/useUIStore'
import { ToyotaYarisRealCluster } from './src/components/dashboard/clusters/ToyotaYarisRealCluster'
import { GolfGTIRealCluster } from './src/components/dashboard/clusters/GolfGTIRealCluster'
import { GolG6RealCluster } from './src/components/dashboard/clusters/GolG6RealCluster'
import type { VehicleConfig } from './src/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, relPath), 'utf-8')
}

function loadVehicle(vehicleId: string): VehicleConfig {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'public/vehicles', vehicleId, 'config.json'), 'utf-8'),
  ) as VehicleConfig
}

const flushMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

interface MockHarnessOptions {
  displayMode?: 'fullscreen' | 'standalone' | 'browser'
  iosStandalone?: boolean
  fullscreenEnabled?: boolean
  userActivationActive?: boolean
  rejectOnRequest?: boolean
  rejectPointerDownOnly?: boolean
  stayInFullscreen?: boolean
}

function withDomHarness(
  options: MockHarnessOptions,
  run: (ctx: {
    setFullscreenElement: (active: boolean) => void
    setVisibility: (state: 'visible' | 'hidden') => void
    dispatchDocEvent: (type: string, extra?: Record<string, unknown>) => void
    dispatchWindowEvent: (type: string) => void
    requestCalls: Array<{ arg: unknown; eventType?: string }>
    getExitCalls: () => number
  }) => Promise<void> | void,
) {
  return (async () => {
    const prevWindow = (globalThis as Record<string, unknown>).window
    const prevDocument = (globalThis as Record<string, unknown>).document
    const prevNavigator = (globalThis as Record<string, unknown>).navigator

    const docListeners = new Map<string, Set<(e: unknown) => void>>()
    const winListeners = new Map<string, Set<(e: unknown) => void>>()
    const requestCalls: Array<{ arg: unknown; eventType?: string }> = []
    let exitCalls = 0
    let currentEventType: string | undefined
    let visibilityState: 'visible' | 'hidden' = 'visible'
    let fullscreenElement: unknown = null

    const docElem: Record<string, unknown> = {
      requestFullscreen: async (arg?: unknown) => {
        requestCalls.push({ arg, eventType: currentEventType })
        if (options.rejectOnRequest) {
          throw new Error('NotAllowedError: requestFullscreen denied')
        }
        if (options.rejectPointerDownOnly && currentEventType === 'pointerdown') {
          throw new Error('NotAllowedError: pointerdown requires click activation')
        }
        if (options.stayInFullscreen !== false) {
          fullscreenElement = docElem
          dispatchDocEvent('fullscreenchange')
        }
      },
    }

    function addTo(map: Map<string, Set<(e: unknown) => void>>, type: string, fn: (e: unknown) => void) {
      let set = map.get(type)
      if (!set) {
        set = new Set()
        map.set(type, set)
      }
      set.add(fn)
    }

    function removeFrom(map: Map<string, Set<(e: unknown) => void>>, type: string, fn: (e: unknown) => void) {
      map.get(type)?.delete(fn)
    }

    function dispatchDocEvent(type: string, extra: Record<string, unknown> = {}) {
      currentEventType = type
      try {
        const evt = { type, target: null, ...extra }
        const list = Array.from(docListeners.get(type) ?? [])
        for (const fn of list) fn(evt)
      } finally {
        currentEventType = undefined
      }
    }

    function dispatchWindowEvent(type: string) {
      const evt = { type }
      const list = Array.from(winListeners.get(type) ?? [])
      for (const fn of list) fn(evt)
    }

    const mockDocument = {
      documentElement: docElem,
      get fullscreenEnabled() {
        return options.fullscreenEnabled ?? true
      },
      get fullscreenElement() {
        return fullscreenElement
      },
      get visibilityState() {
        return visibilityState
      },
      exitFullscreen: async () => {
        exitCalls++
        fullscreenElement = null
        dispatchDocEvent('fullscreenchange')
      },
      addEventListener: (type: string, fn: (e: unknown) => void) => addTo(docListeners, type, fn),
      removeEventListener: (type: string, fn: (e: unknown) => void) => removeFrom(docListeners, type, fn),
    }

    const mockWindow = {
      matchMedia: (query: string) => ({
        matches:
          (query === '(display-mode: fullscreen)' && options.displayMode === 'fullscreen') ||
          (query === '(display-mode: standalone)' && options.displayMode === 'standalone'),
      }),
      screen: {
        orientation: {
          lock: async () => {},
        },
      },
      addEventListener: (type: string, fn: (e: unknown) => void) => addTo(winListeners, type, fn),
      removeEventListener: (type: string, fn: (e: unknown) => void) => removeFrom(winListeners, type, fn),
    }

    const mockNavigator: Record<string, unknown> = {
      standalone: Boolean(options.iosStandalone),
    }
    if (options.userActivationActive !== undefined) {
      mockNavigator.userActivation = {
        isActive: options.userActivationActive,
        hasBeenActive: options.userActivationActive,
      }
    }

    Object.defineProperty(globalThis, 'window', { value: mockWindow, configurable: true, writable: true })
    Object.defineProperty(globalThis, 'document', { value: mockDocument, configurable: true, writable: true })
    Object.defineProperty(globalThis, 'navigator', { value: mockNavigator, configurable: true, writable: true })

    resetFullscreenManagerForTests()

    try {
      await run({
        setFullscreenElement: (active: boolean) => {
          fullscreenElement = active ? docElem : null
        },
        setVisibility: (state: 'visible' | 'hidden') => {
          visibilityState = state
        },
        dispatchDocEvent,
        dispatchWindowEvent,
        requestCalls,
        getExitCalls: () => exitCalls,
      })
    } finally {
      resetFullscreenManagerForTests()
      if (prevWindow === undefined) {
        delete (globalThis as Record<string, unknown>).window
      } else {
        Object.defineProperty(globalThis, 'window', { value: prevWindow, configurable: true, writable: true })
      }
      if (prevDocument === undefined) {
        delete (globalThis as Record<string, unknown>).document
      } else {
        Object.defineProperty(globalThis, 'document', { value: prevDocument, configurable: true, writable: true })
      }
      if (prevNavigator === undefined) {
        delete (globalThis as Record<string, unknown>).navigator
      } else {
        Object.defineProperty(globalThis, 'navigator', { value: prevNavigator, configurable: true, writable: true })
      }
    }
  })()
}

let passed = 0
let failed = 0

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`[OK] ${name}`)
    passed++
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[FAIL] ${name}: ${msg}`)
    failed++
  }
}

async function main() {
  console.log('\n===============================================================')
  console.log('  HEATZ AUTO · FASE 1.5.4 — TESTES COMPORTAMENTAIS E REGRESSÃO')
  console.log('===============================================================\n')

  // ─────────────────────────────────────────────────────────────
  // 1. GERENCIAMENTO DE FULLSCREEN E CICLO DE VIDA PWA (BUG 01)
  // ─────────────────────────────────────────────────────────────
  await runTest('1.1 Detecção de display-mode (fullscreen, standalone WebAPK, standalone iOS e browser)', async () => {
    await withDomHarness({ displayMode: 'fullscreen' }, () => {
      assert.strictEqual(getAppDisplayMode(), 'fullscreen')
      assert.strictEqual(isImmersiveFullscreenActive(), true)
      assert.strictEqual(isStandaloneOrFullscreenApp(), true)
    })

    await withDomHarness({ displayMode: 'standalone' }, () => {
      assert.strictEqual(getAppDisplayMode(), 'standalone')
      assert.strictEqual(isImmersiveFullscreenActive(), false)
      assert.strictEqual(isStandaloneOrFullscreenApp(), true)
    })

    await withDomHarness({ displayMode: 'browser', iosStandalone: true }, () => {
      assert.strictEqual(getAppDisplayMode(), 'standalone')
      assert.strictEqual(isStandaloneOrFullscreenApp(), true)
    })

    await withDomHarness({ displayMode: 'browser', iosStandalone: false }, () => {
      assert.strictEqual(getAppDisplayMode(), 'browser')
      assert.strictEqual(isImmersiveFullscreenActive(), false)
      assert.strictEqual(isStandaloneOrFullscreenApp(), false)
    })
  })

  await runTest('1.2 Ciclo global em App.tsx ativa navigationUI: hide já no primeiro gesto na HomeScreen', async () => {
    const appCode = readSource('src/App.tsx')
    assert.ok(appCode.includes('initImmersiveFullscreenLifecycle'), 'App.tsx inicializa o ciclo global de fullscreen')

    const vdashCode = readSource('src/components/dashboard/VehicleDashboard.tsx')
    assert.ok(
      vdashCode.includes('toggleAppFullscreen') && vdashCode.includes('data-fullscreen-toggle'),
      'VehicleDashboard usa toggleAppFullscreen centralizado com data-fullscreen-toggle',
    )

    // Simula PWA Android abrindo em standalone com userActivation inicialmente false
    await withDomHarness({ displayMode: 'standalone', userActivationActive: false }, async (ctx) => {
      const cleanup = initImmersiveFullscreenLifecycle({ attemptOnInit: true })
      await flushMicrotasks()

      // Sem userActivation inicial, não dispara chamada inválida bloqueada
      assert.strictEqual(ctx.requestCalls.length, 0, 'Não força chamada antes de ativação do usuário quando userActivation=false')

      // Primeiro toque do usuário em qualquer região da HomeScreen (sem clicar em DIRIGIR)
      ctx.dispatchDocEvent('click', { target: { closest: () => null } })
      await flushMicrotasks()

      assert.strictEqual(ctx.requestCalls.length, 1, 'Primeiro gesto dispara exatamente uma solicitação de fullscreen')
      assert.deepStrictEqual(ctx.requestCalls[0].arg, { navigationUI: 'hide' }, 'Solicita navigationUI: hide')
      assert.strictEqual(isImmersiveFullscreenActive(), true, 'Entrou em fullscreen após primeiro toque na HomeScreen')

      // Novos toques já em fullscreen não duplicam chamadas à API nativa
      ctx.dispatchDocEvent('pointerdown', { target: { closest: () => null } })
      ctx.dispatchDocEvent('click', { target: { closest: () => null } })
      await flushMicrotasks()
      assert.strictEqual(ctx.requestCalls.length, 1, 'Sem chamadas redundantes após entrar em fullscreen')

      cleanup()
    })
  })

  await runTest('1.3 Fallback click caso pointerdown seja rejeitado e deduplicação de chamadas concorrentes', async () => {
    await withDomHarness({ displayMode: 'standalone', userActivationActive: false, rejectPointerDownOnly: true }, async (ctx) => {
      const cleanup = initImmersiveFullscreenLifecycle({ attemptOnInit: true })

      // 1) pointerdown rejeitado pelo Chrome mobile não impede que click subsequente entre em fullscreen
      ctx.dispatchDocEvent('pointerdown', { target: { closest: () => null } })
      await flushMicrotasks()
      assert.strictEqual(isImmersiveFullscreenActive(), false, 'Ainda fora de fullscreen após pointerdown rejeitado')

      ctx.dispatchDocEvent('click', { target: { closest: () => null } })
      await flushMicrotasks()
      assert.strictEqual(ctx.requestCalls.length, 2, 'Click imediatamente após pointerdown rejeitado efetua entrada')
      assert.strictEqual(isImmersiveFullscreenActive(), true, 'Entrou em fullscreen no click')
      cleanup()
    })

    // Chamadas concorrentes enquanto já há promise pendente
    await withDomHarness({ displayMode: 'standalone' }, async (ctx) => {
      const [a, b, c] = await Promise.all([
        requestAppFullscreen(),
        requestAppFullscreen(),
        requestAppFullscreen(),
      ])
      assert.strictEqual(a && b && c, true)
      assert.strictEqual(ctx.requestCalls.length, 1, 'Chamadas simultâneas compartilham uma única promise')

      // Chamada extra já em fullscreen retorna true sem chamar DOM novamente
      const again = await requestAppFullscreen()
      assert.strictEqual(again, true)
      assert.strictEqual(ctx.requestCalls.length, 1, 'Já em fullscreen não chama requestFullscreen de novo')
    })
  })

  await runTest('1.4 Saída manual via toggle não força reentrada automática em cliques subsequentes', async () => {
    await withDomHarness({ displayMode: 'standalone', userActivationActive: false }, async (ctx) => {
      const cleanup = initImmersiveFullscreenLifecycle({ attemptOnInit: true })

      // Entra no primeiro toque
      ctx.dispatchDocEvent('click', { target: { closest: () => null } })
      await flushMicrotasks()
      assert.strictEqual(isImmersiveFullscreenActive(), true)
      assert.strictEqual(ctx.requestCalls.length, 1)

      // Simula usuário clicando no botão [data-fullscreen-toggle] para sair de tela cheia
      ctx.dispatchDocEvent('click', { target: { closest: (sel: string) => (sel === '[data-fullscreen-toggle]' ? {} : null) } })
      await toggleAppFullscreen()
      await flushMicrotasks()
      assert.strictEqual(isImmersiveFullscreenActive(), false, 'Saiu da tela cheia manualmente')
      assert.strictEqual(ctx.getExitCalls(), 1)

      // Retorna visível e toca novamente na tela -> NÃO deve forçar tela cheia contra o desejo do usuário
      ctx.setVisibility('hidden')
      ctx.dispatchDocEvent('visibilitychange')
      ctx.setVisibility('visible')
      ctx.dispatchDocEvent('visibilitychange')
      ctx.dispatchDocEvent('click', { target: { closest: () => null } })
      await flushMicrotasks()
      assert.strictEqual(ctx.requestCalls.length, 1, 'Respeita saída manual de tela cheia')

      // Clicar no toggle novamente volta para fullscreen
      const reEntered = await toggleAppFullscreen()
      assert.strictEqual(reEntered, true)
      assert.strictEqual(ctx.requestCalls.length, 2)

      cleanup()
    })
  })

  await runTest('1.5 Retorno de background restaura listener de gesto quando Android derruba imersivo', async () => {
    await withDomHarness({ displayMode: 'standalone', userActivationActive: false }, async (ctx) => {
      const cleanup = initImmersiveFullscreenLifecycle({ attemptOnInit: true })

      ctx.dispatchDocEvent('click', { target: { closest: () => null } })
      await flushMicrotasks()
      assert.strictEqual(ctx.requestCalls.length, 1)
      assert.strictEqual(isImmersiveFullscreenActive(), true)

      // Sistema Android derruba fullscreen ao trocar de aplicativo e depois volta ao foreground via pageshow/visibilitychange
      ctx.setFullscreenElement(false)
      ctx.dispatchDocEvent('fullscreenchange')
      ctx.setVisibility('hidden')
      ctx.dispatchDocEvent('visibilitychange')
      ctx.setVisibility('visible')
      ctx.dispatchDocEvent('visibilitychange')
      ctx.dispatchWindowEvent('pageshow')
      await flushMicrotasks()

      // Próximo toque do usuário após voltar do background reativa modo imersivo
      ctx.dispatchDocEvent('click', { target: { closest: () => null } })
      await flushMicrotasks()
      assert.strictEqual(ctx.requestCalls.length, 2, 'Restaurou fullscreen no primeiro toque ao voltar do background')
      assert.strictEqual(isImmersiveFullscreenActive(), true)

      cleanup()
    })
  })

  await runTest('1.6 Fallbacks seguros quando requestFullscreen rejeita ou API não é suportada', async () => {
    await withDomHarness({ displayMode: 'browser', fullscreenEnabled: false, rejectOnRequest: true }, async (ctx) => {
      const cleanup = initImmersiveFullscreenLifecycle({ attemptOnInit: true })
      const ok = await requestAppFullscreen()
      assert.strictEqual(ok, false, 'Retorna false sem lançar exceção quando rejeitado')
      const exited = await exitAppFullscreen()
      assert.strictEqual(exited, true, 'exitAppFullscreen retorna true sem exceção quando já fora de tela cheia')
      ctx.dispatchDocEvent('click', { target: { closest: () => null } })
      await flushMicrotasks()
      cleanup()
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 2. AUDITORIA E OTIMIZAÇÃO DO TOYOTA YARIS XLS (BUG 02 & PARTE D)
  // ─────────────────────────────────────────────────────────────
  await runTest('2.1 ToyotaYarisRealCluster elimina 100% dos filtros CSS drop-shadow, isola faces memoizadas e usa GPU scaleX', () => {
    const yarisCode = readSource('src/components/dashboard/clusters/ToyotaYarisRealCluster.tsx')

    assert.ok(!/drop-shadow-(?:\[|sm|md|lg|xl|2xl)/.test(yarisCode), 'ToyotaYarisRealCluster não possui classes CSS drop-shadow')
    assert.ok(!/className=[^\n]*transition-all/.test(yarisCode), 'ToyotaYarisRealCluster não usa transition-all em barras contínuas')
    assert.ok(yarisCode.includes('YarisTachometerStaticFace = memo('), 'Face estática do tacômetro isolada em memo')
    assert.ok(yarisCode.includes('YarisSpeedometerStaticFace = memo('), 'Face estática do velocímetro isolada em memo')
    assert.ok(yarisCode.includes('YarisOptitronNeedle = memo('), 'Agulha Optitron memoizada')
    assert.ok(yarisCode.includes('scaleX('), 'Barras do MID TFT utilizam transform: scaleX GPU-composited')
    assert.ok(yarisCode.includes("graphicProfile === 'eco'"), 'Cluster respeita perfil ECO reduzindo sombras externas')

    // Preserva requisitos das fases anteriores
    assert.ok(yarisCode.includes("activePos === 'P'") && yarisCode.includes("activePos === 'D'") && yarisCode.includes("activePos === 'M'"))
    assert.ok(yarisCode.includes('ClusterIndicatorIcon'))
  })

  await runTest('2.2 Renderização SSR/React de ToyotaYarisRealCluster, GolfGTIRealCluster e GolG6RealCluster sem erros e sem SVG drop-shadow', () => {
    const yarisConfig = loadVehicle('yaris-2019')
    const golfConfig = loadVehicle('golf-gti')
    const golConfig = loadVehicle('gol-g6')

    const renderCluster = (cfg: VehicleConfig, speed: number, rpm: number, profile: GraphicProfile): string => {
      useUIStore.getState().setGraphicProfile(profile)
      useSimulationStore.getState().init(cfg)
      const telemetry = DashboardSystem.computeTelemetry(
        DashboardSystem.createInputFromState(cfg, {
          rpm,
          status: 'running',
          isRevLimiting: false,
          isBogWarning: false,
          speed,
          currentGear: 3,
          transmissionMode: cfg.transmission.defaultMode ?? 'manual',
          drivingMode: cfg.transmission.defaultDrivingMode ?? 'normal',
          gearSelectorPosition: cfg.transmission.hasClutch ? 'N' : 'D',
          isKickdown: false,
          throttle: 0.65,
          brake: 0,
          clutchPosition: 1,
          clutchSlipRpm: 0,
          clutchSlipRatio: 0,
          clutchTorqueTransfer: 1,
          clutchHeat: 25,
          isClutchSlipping: false,
          tcsEnabled: true,
          tcsIntervening: false,
          tcsInterventionLevel: 0,
        }),
      )

      const elem =
        cfg.id === 'yaris-2019'
          ? React.createElement(ToyotaYarisRealCluster, { telemetry, graphicProfile: profile })
          : cfg.id === 'golf-gti'
          ? React.createElement(GolfGTIRealCluster, { telemetry })
          : React.createElement(GolG6RealCluster, { telemetry })

      return renderToStaticMarkup(elem)
    }

    const yarisNormalHtml = renderCluster(yarisConfig, 95, 3200, 'normal')
    const yarisEcoHtml = renderCluster(yarisConfig, 95, 3200, 'eco')
    const golfHtml = renderCluster(golfConfig, 95, 3200, 'normal')
    const golHtml = renderCluster(golConfig, 95, 3200, 'normal')

    assert.ok(yarisNormalHtml.includes('x1000 r/min') && yarisNormalHtml.includes('km/h'), 'Yaris renderiza mostradores completos')
    assert.ok(!yarisNormalHtml.includes('drop-shadow'), 'HTML renderizado do Yaris contém zero drop-shadow')
    assert.ok(!yarisEcoHtml.includes('box-shadow:0 0 20px'), 'Perfil ECO do Yaris omite glow inline')
    assert.ok(yarisNormalHtml.includes('box-shadow:0 0 20px'), 'Perfil NORMAL do Yaris mantém halo Optitron')
    assert.ok(yarisNormalHtml.includes('scaleX('), 'Barras TFT do Yaris usam scaleX')
    const golfSvgs = golfHtml.match(/<svg[\s\S]*?<\/svg>/g) ?? []
    assert.ok(golfSvgs.length >= 2, `Golf GTI renderiza pelo menos 2 mostradores SVG (encontrados: ${golfSvgs.length})`)
    assert.ok(golfSvgs.every((svg) => !svg.includes('drop-shadow')), 'SVGs renderizados do Golf GTI contêm zero drop-shadow')
    assert.ok(golHtml.includes('km/h'), 'Gol G6 renderiza corretamente')
  })

  await runTest('2.3 Simulação comparativa Yaris CVT vs Golf GTI DSG vs Gol G6 a 120 Hz (física idêntica e throttle visual consistente)', () => {
    const yaris = loadVehicle('yaris-2019')
    const golf = loadVehicle('golf-gti')
    const gol = loadVehicle('gol-g6')

    const run10s60Fps = (cfg: VehicleConfig, profile: GraphicProfile) => {
      const sim = useSimulationStore.getState()
      useUIStore.getState().setGraphicProfile(profile)
      sim.init(cfg)
      sim.startEngine()
      if (!cfg.transmission.hasClutch) {
        sim.selectShifterMode('D')
      }

      const t0 = performance.now()
      let telemetryMicros = 0
      for (let f = 0; f < 600; f++) {
        const s = useSimulationStore.getState()
        if (cfg.transmission.hasClutch && f === 10) {
          s.setClutch(1)
          s.shiftUp()
          s.setClutch(0)
        }
        s.setThrottle(0.85)
        s.update(1 / 60)

        const cur = useSimulationStore.getState()
        const tStart = performance.now()
        DashboardSystem.computeTelemetry(
          DashboardSystem.createInputFromState(cfg, {
            rpm: cur.rpm,
            status: cur.status,
            isRevLimiting: cur.isRevLimiting,
            isBogWarning: cur.isBogWarning,
            speed: cur.speed,
            currentGear: cur.currentGear,
            transmissionMode: cur.transmissionMode,
            drivingMode: cur.drivingMode,
            gearSelectorPosition: cur.gearSelectorPosition,
            isKickdown: cur.isKickdown,
            throttle: cur.throttle,
            brake: cur.brake,
            clutchPosition: cur.clutchPosition,
            clutchSlipRpm: cur.clutchSlipRpm,
            clutchSlipRatio: cur.clutchSlipRatio,
            clutchTorqueTransfer: cur.clutchTorqueTransfer,
            clutchHeat: cur.clutchHeat,
            isClutchSlipping: cur.isClutchSlipping,
            tcsEnabled: cur.tcsEnabled,
            tcsIntervening: cur.tcsIntervening,
            tcsInterventionLevel: cur.tcsInterventionLevel,
          }),
        )
        telemetryMicros += (performance.now() - tStart) * 1000
      }
      const totalMs = performance.now() - t0
      const p = useSimulationStore.getState()._phys
      return {
        speedKmh: p.speedKmh,
        rpm: p.rpm,
        gear: p.gear,
        visualUpdatesCount: p.visualUpdatesCount,
        skippedVisualUpdatesCount: p.skippedVisualUpdatesCount,
        totalMs,
        telemetryAvgUs: telemetryMicros / 600,
      }
    }

    const yarisEco = run10s60Fps(yaris, 'eco')
    const yarisNormal = run10s60Fps(yaris, 'normal')
    const yarisHigh = run10s60Fps(yaris, 'high')
    const golfNormal = run10s60Fps(golf, 'normal')
    const golNormal = run10s60Fps(gol, 'normal')

    // Física do Yaris idêntica nos 3 perfis gráficos (120 Hz preservado)
    assert.ok(yarisHigh.speedKmh > 65, `Yaris CVT deve acelerar além de 65 km/h em 10s (atual: ${yarisHigh.speedKmh.toFixed(1)})`)
    assert.ok(Math.abs(yarisEco.speedKmh - yarisHigh.speedKmh) < 0.01, 'Yaris: velocidade idêntica entre ECO e ALTO')
    assert.ok(Math.abs(yarisNormal.speedKmh - yarisHigh.speedKmh) < 0.01, 'Yaris: velocidade idêntica entre NORMAL e ALTO')
    assert.strictEqual(yarisEco.gear, yarisHigh.gear, 'Yaris: relação simulada idêntica entre ECO e ALTO')

    // Throttling visual equivalente ao Golf GTI e Gol G6 (~35 Hz no ECO, 600 no HIGH em 60 FPS)
    assert.ok(
      Math.abs(yarisNormal.visualUpdatesCount - golfNormal.visualUpdatesCount) <= 10,
      `Yaris e Golf devem publicar visualmente na mesma cadência (${yarisNormal.visualUpdatesCount} vs ${golfNormal.visualUpdatesCount})`,
    )
    assert.ok(yarisEco.skippedVisualUpdatesCount > 150, `Yaris ECO pula frames visuais (>150 em 60fps, pulou ${yarisEco.skippedVisualUpdatesCount})`)

    console.log(
      `   [Bench 10s@60fps] Yaris=${yarisNormal.totalMs.toFixed(1)}ms (telemetria=${yarisNormal.telemetryAvgUs.toFixed(2)}us) | Golf=${golfNormal.totalMs.toFixed(1)}ms | Gol=${golNormal.totalMs.toFixed(1)}ms`,
    )
  })

  await runTest('2.4 Alternar ECO <-> NORMAL <-> HIGH em movimento no Toyota Yaris preserva sessão e estado mecânico', () => {
    const yaris = loadVehicle('yaris-2019')
    const sim = useSimulationStore.getState()
    useUIStore.getState().setGraphicProfile('normal')
    sim.init(yaris)
    sim.startEngine()
    sim.selectShifterMode('D')
    sim.setThrottle(0.9)

    for (let i = 0; i < 360; i++) {
      useSimulationStore.getState().update(1 / 60)
    }

    const mid = useSimulationStore.getState()
    const speedBefore = mid._phys.speedKmh
    const gearBefore = mid._phys.gear
    assert.ok(speedBefore > 45, `Yaris deve estar em movimento (>45 km/h em 6s, atual ${speedBefore.toFixed(1)})`)

    useUIStore.getState().setGraphicProfile('eco')
    useSimulationStore.getState().update(1 / 60)
    assert.ok(useSimulationStore.getState()._phys.speedKmh >= speedBefore, 'Troca NORMAL->ECO mantém velocidade do Yaris')
    assert.strictEqual(useSimulationStore.getState()._phys.isRunning, true, 'Motor continua ligado na troca')

    useUIStore.getState().setGraphicProfile('high')
    useSimulationStore.getState().update(1 / 60)
    assert.ok(useSimulationStore.getState()._phys.speedKmh >= speedBefore, 'Troca ECO->HIGH mantém velocidade do Yaris')
    assert.ok(useSimulationStore.getState()._phys.gear >= gearBefore, 'Relação CVT mantida na troca')
  })

  await runTest('2.5 Todos os clusters principais (Yaris, Golf GTI, Porsche, Civic Si, Gol Quadrado, Opala) livres de classes CSS drop-shadow em SVGs', () => {
    const files = [
      'src/components/dashboard/clusters/ToyotaYarisRealCluster.tsx',
      'src/components/dashboard/clusters/GolfGTIRealCluster.tsx',
      'src/components/dashboard/clusters/Porsche992GT3RealCluster.tsx',
      'src/components/dashboard/clusters/CivicSiRealCluster.tsx',
      'src/components/dashboard/clusters/GolQuadradoRealCluster.tsx',
      'src/components/dashboard/clusters/Opala4100RealCluster.tsx',
    ]
    for (const file of files) {
      const code = readSource(file)
      const svgBlocks = code.match(/<svg[\s\S]*?<\/svg>/g) ?? []
      assert.ok(svgBlocks.length > 0, `${file} deve conter blocos <svg> válidos`)
      assert.ok(
        svgBlocks.every((svg) => !/drop-shadow-(?:\[|sm|md|lg|xl|2xl)/.test(svg)),
        `${file} não deve conter classes CSS drop-shadow em SVG`,
      )
    }
  })

  useUIStore.getState().setGraphicProfile('normal')

  console.log('\n===============================================================')
  console.log(`RESULTADO DA FASE 1.5.4: ${passed} PASSOU | ${failed} FALHOU`)
  console.log('===============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Erro fatal nos testes da Fase 1.5.4:', err)
  process.exit(1)
})
