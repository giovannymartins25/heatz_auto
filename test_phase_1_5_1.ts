import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getShortVehicleName } from './src/utils/vehicleSpecs'
import { CLUSTER_PROFILES } from './src/components/dashboard/VehicleDashboardCluster'

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
console.log('  HEATZ AUTO · FASE 1.5.1 — SUÍTE DE VALIDAÇÃO COMPLETA')
console.log('===============================================================\n')

// ─────────────────────────────────────────────────────────────
// 1. CORREÇÃO DEFINITIVA DO CORTE INFERIOR DOS PAINÉIS (CLUSTERS)
// ─────────────────────────────────────────────────────────────
test('1.1 VehicleDashboardCluster mede dimensões naturais reais via ResizeObserver', () => {
  const clusterCode = read('src/components/dashboard/VehicleDashboardCluster.tsx')

  // Verifica que existe contentRef medindo o conteúdo antes da transformação
  assert.ok(clusterCode.includes('contentRef'), 'Possui contentRef para medição do conteúdo interno unscaled')
  assert.ok(clusterCode.includes('naturalHeight'), 'Armazena e utiliza naturalHeight para o cálculo do scale')
  assert.ok(clusterCode.includes('ResizeObserver'), 'Utiliza ResizeObserver para rastreamento de layout dinâmico')

  // Verifica que o scale calcula tanto pelo naturalHeight quanto pela bounding box
  assert.ok(
    clusterCode.includes('const naturalHeight = natural && natural.theme === telemetry.theme ? natural.height : profile.height'),
    'Utiliza naturalHeight real quando disponível com fallback para profile.height',
  )
  assert.ok(clusterCode.includes('effectiveHeight / naturalHeight'), 'Calcula escala vertical baseada na altura efetiva dividida pela natural')
})

test('1.2 Todos os 8 temas possuem perfis calibrados em CLUSTER_PROFILES', () => {
  const themes = [
    'civic_si',
    'gti',
    'classic',
    'square_turbo',
    'supercar',
    'opala_classic',
    'modern',
    'motorcycle',
  ] as const

  for (const th of themes) {
    const prof = CLUSTER_PROFILES[th]
    assert.ok(prof, `Perfil para tema ${th} deve existir em CLUSTER_PROFILES`)
    assert.ok(prof.width > 0, `Largura do perfil ${th} deve ser positiva`)
    assert.ok(prof.height > 0, `Altura do perfil ${th} deve ser positiva`)
  }
})

test('1.3 Isolamento de layout: cluster não sofre overflow vertical invisível', () => {
  const clusterCode = read('src/components/dashboard/VehicleDashboardCluster.tsx')
  assert.ok(clusterCode.includes('transform: `scale(${scale})`'), 'Aplica scale CSS dinâmico')
  assert.ok(clusterCode.includes('transformOrigin:'), 'Origem de transformação calibrada')
  assert.ok(clusterCode.includes('overflow-hidden'), 'Container raiz com overflow-hidden para contenção geométrica')
})

// ─────────────────────────────────────────────────────────────
// 2. MULTIMÍDIA COMPLETA: 100% DO RETÂNGULO DO PAINEL (SLOT)
// ─────────────────────────────────────────────────────────────
test('2.1 VehicleMultimedia ocupa 100% do espaço (w-full h-full) sem encolhimento', () => {
  const mmCode = read('src/components/dashboard/infotainment/VehicleMultimedia.tsx')

  assert.ok(mmCode.includes('w-full h-full'), 'Container principal ocupa 100% da largura e altura')
  assert.ok(mmCode.includes('flex flex-col'), 'Layout em coluna estruturada')
  assert.ok(mmCode.includes('min-h-0'), 'min-h-0 para evitar transbordamento no flexbox')
  assert.ok(!mmCode.includes('max-w-md'), 'Não impõe limite de largura artificial tipo card')
})

test('2.2 VehicleMultimedia possui barra de status automotiva nativa', () => {
  const mmCode = read('src/components/dashboard/infotainment/VehicleMultimedia.tsx')

  assert.ok(mmCode.includes('shortName'), 'Exibe nome curto do veículo na barra de status')
  assert.ok(mmCode.includes('time'), 'Exibe relógio digital na barra de status')
  assert.ok(mmCode.includes('BT') || mmCode.includes('5G'), 'Exibe indicadores de conectividade (BT, 5G, Wi-Fi)')
})

test('2.3 VehicleMultimedia disponibiliza 5 abas de navegação (Início, Música, YouTube, Ar, Ajustes)', () => {
  const mmCode = read('src/components/dashboard/infotainment/VehicleMultimedia.tsx')

  assert.ok(mmCode.includes("id: 'home'"), 'Aba Início presente')
  assert.ok(mmCode.includes("label: 'Início'"), 'Rótulo Início presente')
  assert.ok(mmCode.includes("id: 'music'"), 'Aba Música presente')
  assert.ok(mmCode.includes("label: 'Música'"), 'Rótulo Música presente')
  assert.ok(mmCode.includes("id: 'youtube'"), 'Aba YouTube presente')
  assert.ok(mmCode.includes("label: 'YouTube'"), 'Rótulo YouTube presente')
  assert.ok(mmCode.includes("id: 'climate'"), 'Aba Ar/Clima presente')
  assert.ok(mmCode.includes("label: 'Ar'"), 'Rótulo Ar presente')
  assert.ok(mmCode.includes("id: 'settings'"), 'Aba Ajustes presente')
  assert.ok(mmCode.includes("label: 'Ajustes'"), 'Rótulo Ajustes presente')

  // Barra inferior de navegação
  assert.ok(mmCode.includes('<nav className='), 'Barra de navegação inferior presente')
})

test('2.4 Conteúdo de todas as abas é demonstrativo e funciona 100% offline sem APIs externas', () => {
  const mmCode = read('src/components/dashboard/infotainment/VehicleMultimedia.tsx')

  // Sem requisições fetch ou axios externas
  assert.ok(!mmCode.includes('fetch('), 'Sem chamadas fetch externas')
  assert.ok(!mmCode.includes('axios'), 'Sem chamadas axios externas')

  // Player de música integrado e interativo
  assert.ok(mmCode.includes('TRACKS') || mmCode.includes('PLAYLIST'), 'Playlist demonstrativa com faixas automotivas')
  assert.ok(mmCode.includes('playing'), 'Estado de reprodução/pausa')

  // Controle de climatização (Ar Condicionado) interativo
  assert.ok(mmCode.includes('temp'), 'Ajuste de temperatura do clima')
  assert.ok(mmCode.includes('fan'), 'Ajuste da velocidade do ventilador')
  assert.ok(mmCode.includes('acOn') || mmCode.includes('setAcOn'), 'Toggle do ar-condicionado (A/C)')

  // YouTube / Vídeos automotivos interativo
  assert.ok(mmCode.includes('VIDEOS'), 'Lista demonstrativa de vídeos')
})

test('2.5 InfotainmentScreen delega para VehicleMultimedia ocupando 100% do slot', () => {
  const infoScreen = read('src/components/dashboard/InfotainmentScreen.tsx')

  assert.ok(infoScreen.includes('<VehicleMultimedia'), 'Renderiza o novo componente VehicleMultimedia')
  assert.ok(infoScreen.includes('fill={fill}'), 'Repassa propriedade fill para ocupar 100% do slot')
})

// ─────────────────────────────────────────────────────────────
// 3. REPOSICIONAMENTO E ELEVAÇÃO DO MAPA AO TOPO
// ─────────────────────────────────────────────────────────────
test('3.1 MobileLandscapeCockpit alinha o topo do mapa ao topo da Buzina e TCS', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')

  // Não possui header horizontal ocupando o centro da tela
  assert.ok(!landscape.includes('<header className="flex items-center justify-between px-3'), 'Header horizontal descartado em favor do mapa')

  // Coluna esquerda possui menu e nome curto
  assert.ok(landscape.includes('getShortVehicleName'), 'Coluna esquerda integra nome curto do veículo')

  // Coluna direita possui Buzina e TCS no topo
  assert.ok(landscape.includes('aria-label="Buzina"'), 'Buzina presente na lateral direita')
  assert.ok(landscape.includes('setTcsEnabled') && landscape.includes('TCS'), 'TCS presente na lateral direita')

  // O centro (DrivingMapViewport) começa diretamente no topo
  assert.ok(landscape.includes('<DrivingMapViewport'), 'DrivingMapViewport renderizado na área central')
})

test('3.2 Proporções dos 3 modos de mapa (compact, balanced, expanded) preservadas', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')

  assert.ok(landscape.includes("mapViewportSize === 'compact'"), 'Trata modo compact')
  assert.ok(landscape.includes("mapViewportSize === 'expanded'"), 'Trata modo expanded')
  assert.ok(landscape.includes('h-[44%]'), 'Modo balanced aproveita ~44% no landscape liberando o cluster')
  assert.ok(landscape.includes('h-[58%]'), 'Modo expanded aproveita ~58% no landscape')
})

// ─────────────────────────────────────────────────────────────
// 4. IDENTIFICAÇÃO CURTA DOS 8 VEÍCULOS
// ─────────────────────────────────────────────────────────────
test('4.1 getShortVehicleName retorna crachás compactos para os 8 modelos', () => {
  assert.strictEqual(getShortVehicleName({ id: 'civic-si', info: { name: 'Honda Civic Si' } } as any), 'CIVIC SI')
  assert.strictEqual(getShortVehicleName({ id: 'golf-gti', info: { name: 'VW Golf GTI' } } as any), 'GOLF GTI')
  assert.strictEqual(getShortVehicleName({ id: 'gol-g6', info: { name: 'VW Gol Rallye G6' } } as any), 'GOL RALLYE')
  assert.strictEqual(getShortVehicleName({ id: 'gol-quadrado-turbo', info: { name: 'VW Gol Turbo AP' } } as any), 'GOL TURBO')
  assert.strictEqual(getShortVehicleName({ id: 'porsche-gt3', info: { name: 'Porsche 911 GT3 RS' } } as any), '911 GT3 RS')
  assert.strictEqual(getShortVehicleName({ id: 'opala-4100', info: { name: 'Chevrolet Opala Diplomata 4.1' } } as any), 'OPALA 4.1')
  assert.strictEqual(getShortVehicleName({ id: 'yaris-2019', info: { name: 'Toyota Yaris XLS' } } as any), 'YARIS XLS')
  assert.strictEqual(getShortVehicleName({ id: 'cb1000r', info: { name: 'Honda CB1000R' } } as any), 'CB1000R')
})

// ─────────────────────────────────────────────────────────────
// 5. SLOT DESLIZANTE (SWIPE) E CONTROLE POR GESTO + PILL
// ─────────────────────────────────────────────────────────────
test('5.1 SwipeableClusterMediaSlot permite alternar painel e multimídia com gesto horizontal', () => {
  const slot = read('src/components/dashboard/SwipeableClusterMediaSlot.tsx')

  assert.ok(slot.includes('SWIPE_THRESHOLD = 40'), 'Threshold de gesto horizontal de 40px')
  assert.ok(slot.includes('Math.abs(dy) > Math.abs(dx) * 1.5'), 'Proteção contra gestos verticais')
  assert.ok(slot.includes('e.stopPropagation()'), 'Interrompe propagação para proteger controles periféricos')
  assert.ok(slot.includes('translateX('), 'Transição suave via translateX entre o painel e a multimídia')
})

test('5.2 Botão Pill acessível e dots de status funcionam como alternativa confiável ao toque', () => {
  const slot = read('src/components/dashboard/SwipeableClusterMediaSlot.tsx')

  assert.ok(slot.includes("activeView === 'cluster' ? '📺' : '📟'"), 'Ícone contextual da pill')
  assert.ok(slot.includes("activeView === 'cluster' ? 'MÍDIA' : 'PAINEL'"), 'Rótulo contextual da pill')
  assert.ok(slot.includes("setView('cluster')"), 'Dot interativo para selecionar cluster')
  assert.ok(slot.includes("setView('multimedia')"), 'Dot interativo para selecionar multimídia')
})

// ─────────────────────────────────────────────────────────────
// 6. ERGONOMIA DOS CONTROLES, PEDAIS E LOOP DE SIMULAÇÃO
// ─────────────────────────────────────────────────────────────
test('6.1 Dimensões dos pedais e botões compactos preservadas da Fase 1.5', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')

  // Pedais com altura segura sem corte
  assert.ok(landscape.includes('h-28 sm:h-32'), 'Altura segura do acelerador e freio em landscape')
  assert.ok(landscape.includes('pb-0.5') || landscape.includes('pb-1'), 'Padding inferior de segurança')

  // Botões de câmbio e START compactos
  assert.ok(landscape.includes('MobileStartButton'), 'Botão START presente')
  assert.ok(landscape.includes('h-11'), 'Botão de freio de mão compacto')
})

test('6.2 Física, motor, transmissão e áudio não sofrem alteração nem impacto', () => {
  const sim = read('src/stores/useSimulationStore.ts')

  assert.ok(sim.includes('PHYSICS_TIMESTEP'), 'Timestep de física preservado')
  assert.ok(sim.includes('EngineSimulator'), 'EngineSimulator preservado')
  assert.ok(sim.includes('AutomaticTransmission'), 'AutomaticTransmission preservado')
  assert.ok(sim.includes('Transmission'), 'Transmission manual preservada')
})

console.log('\n===============================================================')
console.log(`RESULTADO DA FASE 1.5.1: ${passed} PASSOU | ${failed} FALHOU`)
console.log('===============================================================\n')

if (failed > 0) {
  process.exit(1)
}
