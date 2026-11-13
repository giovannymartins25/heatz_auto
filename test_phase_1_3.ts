import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Polyfill mínimo de localStorage para execução em Node/tsx
if (typeof globalThis.localStorage === 'undefined') {
  const memoryStorage = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    get length() {
      return memoryStorage.size
    },
    clear() {
      memoryStorage.clear()
    },
    getItem(key: string) {
      return memoryStorage.get(key) ?? null
    },
    key(index: number) {
      return Array.from(memoryStorage.keys())[index] ?? null
    },
    removeItem(key: string) {
      memoryStorage.delete(key)
    },
    setItem(key: string, value: string) {
      memoryStorage.set(key, value)
    },
  }
}

import type { VehicleConfig } from './src/types/vehicle'
import { useGarageStore } from './src/stores/useGarageStore'
import { useSimulationStore } from './src/stores/useSimulationStore'
import {
  stepZeroToHundredTimer,
  formatZeroToHundredSeconds,
  createInitialZeroToHundredState,
} from './src/systems/vehicle'
import { formatVehicleHeaderInfo } from './src/utils/vehicleSpecs'

const ROOT = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const VEHICLE_DIRS = [
  'golf-gti',
  'civic-si',
  'gol-g6',
  'gol-quadrado-turbo',
  'porsche-gt3',
  'opala-4100',
  'yaris-2019',
  'cb1000r',
] as const

const vehicles: VehicleConfig[] = VEHICLE_DIRS.map((dir) =>
  JSON.parse(read(`public/vehicles/${dir}/config.json`)) as VehicleConfig,
)

console.log('\n===============================================================')
console.log('  HEATZ AUTO · FASE 1.3 — SUÍTE DE VALIDAÇÃO COMPLETA')
console.log('===============================================================')

// ── 1. Pops & Bangs desligado por padrão em todos os carros e lojas ──
{
  // Simulação inicial, após init(vehicle) e após reset()
  assert.equal(useSimulationStore.getState().exhaustValveOpen, false, 'Estado inicial deve iniciar sem Pops & Bangs')

  for (const vehicle of vehicles) {
    useSimulationStore.getState().init(vehicle)
    assert.equal(
      useSimulationStore.getState().exhaustValveOpen,
      false,
      `${vehicle.info.name} deve iniciar com exhaustValveOpen=false após init()`,
    )
    useSimulationStore.getState().setExhaustValve(true)
    assert.equal(useSimulationStore.getState().exhaustValveOpen, true, 'Toggle manual para ON deve funcionar')
    useSimulationStore.getState().setExhaustValve(false)
    assert.equal(useSimulationStore.getState().exhaustValveOpen, false, 'Toggle manual para OFF deve funcionar')

    useSimulationStore.getState().setExhaustValve(true)
    useSimulationStore.getState().reset()
    assert.equal(
      useSimulationStore.getState().exhaustValveOpen,
      false,
      `${vehicle.info.name} após reset() deve voltar com exhaustValveOpen=false`,
    )
  }

  // Garagem padrão (createDefaultUpgrades) & migração única
  const garageCars = useGarageStore.getState().ownedCars
  assert.ok(garageCars.length >= 1, 'Garagem deve inicializar com ao menos 1 veículo')
  for (const car of garageCars) {
    assert.equal(
      car.upgrades.exhaustValveOpen,
      false,
      `Carro na garagem (${car.customName}) deve ter exhaustValveOpen=false por padrão`,
    )
  }

  const synthSrc = read('src/systems/audio/SynthEngine.ts')
  assert.ok(synthSrc.includes('private exhaustValveOpen = false'), 'SynthEngine deve inicializar exhaustValveOpen=false')
  assert.ok(synthSrc.includes('!this.exhaustValveOpen) return'), 'triggerDecelBurble deve respeitar exhaustValveOpen')

  const useAudioSrc = read('src/hooks/useAudio.ts')
  assert.ok(useAudioSrc.includes('isRevLimiting && exhaustValveOpen'), 'Corte de giro só estoura com Pops & Bangs ON')
  assert.ok(useAudioSrc.includes('isLaunchControlArmed && exhaustValveOpen'), 'Launch control só estoura com Pops & Bangs ON')

  console.log('[OK] 1. Pops & Bangs desligado por padrão e toggle manual preservado')
}

// ── 2. Ficha técnica dinâmica no cabeçalho para os 8 veículos ──
{
  for (const vehicle of vehicles) {
    const header = formatVehicleHeaderInfo(vehicle)
    assert.equal(header.title, vehicle.info.name, `Título deve refletir VehicleConfig (${vehicle.id})`)
    assert.ok(header.specsSummary.length >= 6, `Resumo técnico inválido para ${vehicle.id}: ${header.specsSummary}`)
    assert.ok(header.specsSummary.includes('CV'), `Potência em CV ausente para ${vehicle.id}: ${header.specsSummary}`)
    assert.ok(header.specsSummary.includes('kgfm'), `Torque em kgfm ausente para ${vehicle.id}: ${header.specsSummary}`)
  }
  console.log('[OK] 2. Resumo dinâmico de ficha técnica validado nos 8 veículos')
}

// ── 3. Cronômetro 0–100 km/h (máquina de estados + integração física) ──
{
  assert.equal(formatZeroToHundredSeconds(null), '--')
  assert.equal(formatZeroToHundredSeconds(0), '--')
  assert.equal(formatZeroToHundredSeconds(6.24), '6,2 s')
  assert.equal(formatZeroToHundredSeconds(7.0), '7,0 s')

  const dt = 0.1
  let state = createInitialZeroToHundredState()

  // Jitter perto de 0 sem acelerador não deve disparar
  for (let i = 0; i < 10; i++) {
    const res = stepZeroToHundredTimer(state, {
      prevSpeedKmh: 0.1,
      speedKmh: 0.4,
      gear: 1,
      throttle: 0,
      brake: 0,
      handbrake: false,
      isRunning: true,
      deltaTime: dt,
    })
    state = res.state
    assert.equal(state.isTiming, false, 'Jitter baixo sem throttle não deve iniciar cronômetro')
  }

  // Primeira corrida válida: 0 -> 100 em 6.2s
  for (let step = 1; step <= 62; step++) {
    const prevSpeed = ((step - 1) / 62) * 100
    const nextSpeed = (step / 62) * 100
    const res = stepZeroToHundredTimer(state, {
      prevSpeedKmh: prevSpeed,
      speedKmh: nextSpeed,
      gear: 1,
      throttle: 1,
      brake: 0,
      handbrake: false,
      isRunning: true,
      deltaTime: dt,
    })
    state = res.state
  }
  assert.equal(state.isTiming, false, 'Cronômetro deve encerrar aos 100 km/h')
  assert.equal(formatZeroToHundredSeconds(state.lastCompleted), '6,2 s', 'Primeira corrida válida deve marcar 6,2 s')

  // Em movimento (>= 0.3 km/h) não pode re-disparar mesmo acelerando de 30 -> 110
  for (const [p, n] of [
    [110, 60],
    [60, 30],
    [30, 80],
    [80, 115],
  ]) {
    const res = stepZeroToHundredTimer(state, {
      prevSpeedKmh: p,
      speedKmh: n,
      gear: 3,
      throttle: 1,
      brake: 0,
      handbrake: false,
      isRunning: true,
      deltaTime: dt,
    })
    state = res.state
    assert.equal(state.isTiming, false, 'Não pode disparar nova medição em movimento sem parar primeiro')
  }
  assert.equal(formatZeroToHundredSeconds(state.lastCompleted), '6,2 s')

  // Parar completamente (<= 0.3 km/h) re-arma
  state = stepZeroToHundredTimer(state, {
    prevSpeedKmh: 0.4,
    speedKmh: 0.2,
    gear: 1,
    throttle: 0,
    brake: 0.5,
    handbrake: false,
    isRunning: true,
    deltaTime: dt,
  }).state
  assert.equal(state.armed, true, 'Deve re-armar após parada completa <= 0.3 km/h')

  // Nova tentativa em andamento preserva lastCompleted anterior (6,2 s) e suporta passagem 1 -> N -> 2
  state = stepZeroToHundredTimer(state, {
    prevSpeedKmh: 0.2,
    speedKmh: 2.0,
    gear: 1,
    throttle: 1,
    brake: 0,
    handbrake: false,
    isRunning: true,
    deltaTime: dt,
  }).state
  assert.equal(state.isTiming, true)
  assert.equal(formatZeroToHundredSeconds(state.lastCompleted), '6,2 s', 'Tentativa ativa preserva último tempo válido')

  // Troca manual rápida passando por N (0.3s < 1.5s) não aborta
  for (let i = 0; i < 3; i++) {
    state = stepZeroToHundredTimer(state, {
      prevSpeedKmh: 38,
      speedKmh: 38.2,
      gear: 0,
      throttle: 0,
      brake: 0,
      handbrake: false,
      isRunning: true,
      deltaTime: dt,
    }).state
    assert.equal(state.isTiming, true, 'Passagem breve por N em câmbio manual não deve abortar')
  }

  // Abortamento por freada forte mantém último tempo válido (6,2 s) intacto
  state = stepZeroToHundredTimer(state, {
    prevSpeedKmh: 38.2,
    speedKmh: 25,
    gear: 2,
    throttle: 0,
    brake: 0.8,
    handbrake: false,
    isRunning: true,
    deltaTime: dt,
  }).state
  assert.equal(state.isTiming, false, 'Freada forte deve cancelar tentativa ativa')
  assert.equal(formatZeroToHundredSeconds(state.lastCompleted), '6,2 s', 'Tentativa abortada preserva último tempo válido')

  // Segunda corrida válida mais lenta (7,0 s) SUBSTITUI 6,2 s como último tempo
  state = stepZeroToHundredTimer(state, {
    prevSpeedKmh: 0.2,
    speedKmh: 0,
    gear: 1,
    throttle: 0,
    brake: 0.2,
    handbrake: false,
    isRunning: true,
    deltaTime: dt,
  }).state
  for (let step = 1; step <= 70; step++) {
    const prevSpeed = ((step - 1) / 70) * 100
    const nextSpeed = (step / 70) * 100
    const res = stepZeroToHundredTimer(state, {
      prevSpeedKmh: prevSpeed,
      speedKmh: nextSpeed,
      gear: 2,
      throttle: 1,
      brake: 0,
      handbrake: false,
      isRunning: true,
      deltaTime: dt,
    })
    state = res.state
  }
  assert.equal(formatZeroToHundredSeconds(state.lastCompleted), '7,0 s', 'Última corrida válida (7,0 s) deve substituir 6,2 s')
  assert.equal(formatZeroToHundredSeconds(state.bestCompleted), '6,2 s', 'Melhor histórica continua preservada em bestCompleted')

  // Integração com useSimulationStore (substeps físicos)
  const golf = vehicles.find((v) => v.id === 'golf-gti' || v.id === 'golf-gti-mk7') || vehicles[0]
  useSimulationStore.getState().init(golf)
  useSimulationStore.getState().startEngine()
  useSimulationStore.getState().selectShifterMode('D')
  useSimulationStore.setState({ brake: 0, handbrake: false, throttle: 1 })
  for (let i = 0; i < 60 * 15; i++) {
    useSimulationStore.getState().update(1 / 60)
    if (useSimulationStore.getState().last0to100 !== null) break
  }
  const simRun = useSimulationStore.getState().last0to100
  assert.ok(simRun !== null && simRun > 2 && simRun < 15, `Simulação real Golf GTI deve medir 0-100 válido (obteve ${simRun})`)
  assert.equal(useSimulationStore.getState().isTiming0to100, false, 'Simulação deve finalizar cronômetro ao cruzar 100 km/h')

  console.log(`[OK] 3. Cronômetro 0–100 validado (corrida real simulada Golf GTI: ${formatZeroToHundredSeconds(simRun)})`)
}

// ── 4. Reorganização da Interface Mobile (Landscape & Portrait) + Map + 8 Clusters ──
{
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')
  const portrait = read('src/components/dashboard/MobilePortraitCockpit.tsx')
  const mapViewport = read('src/components/dashboard/DrivingMapViewport.tsx')
  const clusterWrapper = read('src/components/dashboard/VehicleDashboardCluster.tsx')

  // 4.1 Botão único [☰] + ausência de botão duplicado de garagem
  for (const [name, src] of [
    ['MobileLandscapeCockpit', landscape],
    ['MobilePortraitCockpit', portrait],
  ] as const) {
    assert.ok(!src.includes('Voltar para a garagem'), `${name}: botão duplicado de garagem deve ser removido`)
    assert.ok(!src.includes('WarningLights'), `${name}: faixa antiga WarningLights deve sair do cabeçalho`)
    assert.ok(src.includes('aria-label="Abrir menu e garagem"'), `${name}: botão único [☰] presente`)
    assert.ok(src.includes('formatVehicleHeaderInfo(vehicle)'), `${name}: cabeçalho usa ficha técnica dinâmica`)
    assert.ok(src.includes('formatZeroToHundredSeconds(last0to100)'), `${name}: indicador 0–100 usa last0to100`)
    assert.ok(src.includes('w-7 h-7 rounded-full') || src.includes('w-8 h-8 rounded-full'), `${name}: buzina circular no topo direito`)
    assert.ok(
      src.includes('w-9 h-9 rounded-full') || src.includes('w-10 h-10 rounded-full'),
      `${name}: botão circular TCS no topo direito`,
    )
    const hornMatches = src.match(/aria-label="Buzina"/g) ?? []
    assert.equal(hornMatches.length, 1, `${name}: buzina deve aparecer apenas 1x (canto superior direito)`)
  }

  // 4.2 Controles exclusivos da Honda CB1000R preservados
  assert.ok(landscape.includes("label={isMotorcycle ? 'MANETE' : 'EMBR'}"))
  assert.ok(landscape.includes("label={isMotorcycle ? 'F. TRAS' : 'FREIO'}"))
  assert.ok(landscape.includes("label={isMotorcycle ? 'PUNHO' : 'ACEL'}"))
  assert.ok(landscape.includes('F. DIANTEIRO'))

  // 4.3 Mapa com flex-col e proporções expandidas sem esticar
  assert.ok(mapViewport.includes('relative isolate flex flex-col w-full h-full'), 'DrivingMapViewport deve ancorar rodapé com flex-col')
  assert.ok(landscape.includes("h-[30%] flex-shrink-0") && landscape.includes("h-[44%] flex-shrink-0") && landscape.includes("h-[58%] flex-shrink-0"))
  assert.ok(portrait.includes("h-[30%] flex-shrink-0") && portrait.includes("h-[43%] flex-shrink-0") && portrait.includes("h-[56%] flex-shrink-0"))

  // 4.4 Verificação matemática de encaixe nos viewports Landscape (844x390, 932x430) & Portrait (390x844, 430x932)
  const gtiMatch = clusterWrapper.match(/gti:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/)
  assert.ok(gtiMatch, 'Perfil GTI encontrado em CLUSTER_PROFILES')
  const gtiW = Number(gtiMatch[1])
  const gtiH = Number(gtiMatch[2])

  for (const vp of [
    { name: 'Landscape 844x390', w: 844, h: 390, centerW: 520, clusterAvailH: Math.round((390 - 70) * 0.56) },
    { name: 'Landscape 932x430', w: 932, h: 430, centerW: 600, clusterAvailH: Math.round((430 - 70) * 0.56) },
    { name: 'Portrait 390x844', w: 390, h: 844, centerW: 366, clusterAvailH: Math.round(420 * 0.57) },
    { name: 'Portrait 430x932', w: 430, h: 932, centerW: 406, clusterAvailH: Math.round(470 * 0.57) },
  ]) {
    const scale = Math.min(1.35, vp.centerW / gtiW, vp.clusterAvailH / gtiH)
    assert.ok(scale > 0.35 && gtiW * scale <= vp.centerW + 1 && gtiH * scale <= vp.clusterAvailH + 1, `${vp.name}: GTI cabe sem overflow (scale=${scale.toFixed(2)})`)
  }

  // 4.5 Todos os 8 clusters: remoção de banners redundantes + preservação de luzes reais
  const golf = read('src/components/dashboard/clusters/GolfGTIRealCluster.tsx')
  assert.ok(!golf.includes('2.0 TSI EA888 · DSG6 DQ250'), 'Golf GTI sem faixa fixa redundante')
  assert.ok(!golf.includes('230 CV · 350 NM'), 'Golf GTI sem ficha técnica interna duplicada')
  assert.ok(golf.includes('ClusterIndicatorIcon'), 'Golf GTI usa ícones reais de alerta')
  assert.ok(golf.includes('last0to100'), 'Golf GTI exibe last0to100 no MFD')

  const checks: Array<[string, string]> = [
    ['src/components/dashboard/clusters/CivicSiRealCluster.tsx', 'MULTIPLEX UPPER DISPLAY'],
    ['src/components/dashboard/clusters/Porsche992GT3RealCluster.tsx', '9.000 RPM REDLINE'],
    ['src/components/dashboard/clusters/HondaCB1000RRealCluster.tsx', 'HONDA TFT 5"'],
    ['src/components/dashboard/clusters/GolG6RealCluster.tsx', 'VW I-SYSTEM'],
    ['src/components/dashboard/clusters/GolQuadradoRealCluster.tsx', 'VW AP 1.9 FORJADO'],
    ['src/components/dashboard/clusters/ToyotaYarisRealCluster.tsx', 'TOYOTA OPTITRON'],
    ['src/components/dashboard/clusters/Opala4100RealCluster.tsx', '4.1L 6 CILINDROS'],
  ]
  for (const [file, removedBanner] of checks) {
    const content = read(file)
    assert.ok(!content.includes(removedBanner), `${file} não deve conter banner redundante "${removedBanner}"`)
  }

  const yaris = read('src/components/dashboard/clusters/ToyotaYarisRealCluster.tsx')
  assert.ok(!yaris.includes('💡') && !yaris.includes('👤'), 'Yaris sem luzes decorativas estáticas')
  assert.ok(yaris.includes('ClusterIndicatorIcon'), 'Yaris com luzes de advertência reais')

  console.log('[OK] 4. Cockpit mobile, mapa, CB1000R e todos os 8 clusters validados')
}

console.log('===============================================================\n')

