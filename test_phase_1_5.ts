import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useSessionStore } from './src/stores/useSessionStore'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useGarageStore } from './src/stores/useGarageStore'
import { useUIStore } from './src/stores/useUIStore'
import { getVehicleSpecs, VEHICLE_PRICES } from './src/screens/HomeScreen'
import { formatVehicleHeaderInfo } from './src/utils/vehicleSpecs'

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
    console.error(`[FAIL] ${name}: ${err.message}`)
    failed++
  }
}

console.log('\n===============================================================')
console.log('  HEATZ AUTO · FASE 1.5 — SUÍTE DE VALIDAÇÃO COMPLETA')
console.log('===============================================================\n')

// ─────────────────────────────────────────────────────────────
// 1. MODOS DE ENTRADA: GARAGEM, SESSION STORE & SIMULATOR SCREEN
// ─────────────────────────────────────────────────────────────
test('1.1 Garagem disponibiliza botões distintos [ PAINEL ] e [ DIRIGIR ] para cada veículo', () => {
  const home = read('src/screens/HomeScreen.tsx')

  // Verifica presença dos botões com estilos distintos e ícones
  assert.ok(home.includes("handleSelectMode(car, 'cluster')"), 'Botão PAINEL chama handleSelectMode com mode=cluster')
  assert.ok(home.includes("handleSelectMode(car, 'drive')"), 'Botão DIRIGIR chama handleSelectMode com mode=drive')
  assert.ok(home.includes('>PAINEL<'), 'Texto do botão PAINEL presente')
  assert.ok(home.includes('>DIRIGIR<'), 'Texto do botão DIRIGIR presente')
  assert.ok(home.includes('mode=${mode}'), 'Navegação repassa parâmetro mode na query string')
})

test('1.2 Session Store gerencia isoladamente o estado da sessão sem misturar com simulação', () => {
  const session = useSessionStore.getState()
  assert.strictEqual(session.isSessionActive, false, 'Sessão inicia inativa')
  assert.strictEqual(session.entryMode, 'drive', 'entryMode padrão é drive')

  // Iniciar sessão em modo cluster
  session.startSession('golf-gti', 'cluster', 'golf-inst-1')
  const afterStart = useSessionStore.getState()
  assert.strictEqual(afterStart.isSessionActive, true, 'Sessão fica ativa')
  assert.strictEqual(afterStart.entryMode, 'cluster', 'entryMode atualizado para cluster')
  assert.strictEqual(afterStart.vehicleId, 'golf-gti', 'vehicleId registrado')
  assert.strictEqual(afterStart.instanceId, 'golf-inst-1', 'instanceId registrado')
  assert.ok(typeof afterStart.sessionStartedAt === 'number', 'Timestamp de início gravado')

  // Finalizar sessão
  afterStart.endSession()
  const afterEnd = useSessionStore.getState()
  assert.strictEqual(afterEnd.isSessionActive, false, 'Sessão desativada após endSession')
  assert.strictEqual(afterEnd.vehicleId, null, 'vehicleId limpo')
})

test('1.3 SimulatorScreen lê parâmetro ?mode= e despacha para useSessionStore e VehicleDashboard', () => {
  const simScreen = read('src/screens/SimulatorScreen.tsx')
  assert.ok(simScreen.includes("searchParams.get('mode')"), 'Lê searchParams ?mode')
  assert.ok(simScreen.includes("modeParam === 'cluster' ? 'cluster' : 'drive'"), 'Converte mode para cluster ou drive')
  assert.ok(simScreen.includes('startSession(vehicleId, entryMode'), 'Chama startSession com vehicleId e entryMode')
  assert.ok(simScreen.includes('<VehicleDashboard vehicle={selectedVehicle} entryMode={entryMode} />'), 'Repassa entryMode para VehicleDashboard')
})

test('1.4 Cockpit em modo DIRIGIR não possui botão de troca de volta para PAINEL (sessão persistente)', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')
  const portrait = read('src/components/dashboard/MobilePortraitCockpit.tsx')

  // Abas de topo/dock antigo removidas
  assert.ok(!landscape.includes("id: 'cluster', label: 'PAINEL'"), 'Landscape não possui dock lateral com abas PAINEL/DIRIGIR')
  assert.ok(!portrait.includes("id: 'cluster', label: 'PAINEL'"), 'Portrait não possui dock lateral com abas PAINEL/DIRIGIR')
  assert.ok(!landscape.includes('viewTabs.map'), 'Landscape não possui viewTabs')
  assert.ok(!portrait.includes('viewTabs.map'), 'Portrait não possui viewTabs')
})

// ─────────────────────────────────────────────────────────────
// 2. MULTIMÍDIA INTEGRADA POR SWIPE NO MESMO RETÂNGULO DO PAINEL
// ─────────────────────────────────────────────────────────────
test('2.1 SwipeableClusterMediaSlot compartilha exatamente o mesmo retângulo para cluster e multimídia', () => {
  const slot = read('src/components/dashboard/SwipeableClusterMediaSlot.tsx')

  assert.ok(slot.includes("activeView === 'cluster' ?"), 'Alterna dinamicamente entre cluster e multimídia')
  assert.ok(slot.includes('<VehicleDashboardCluster'), 'Renderiza o cluster original do veículo no slot')
  assert.ok(slot.includes('<InfotainmentScreen'), 'Renderiza a multimídia no mesmo slot')
  assert.ok(slot.includes('SWIPE_THRESHOLD = 40'), 'Threshold de gesto horizontal de no mínimo 40px')
  assert.ok(slot.includes('Math.abs(dy) > Math.abs(dx) * 1.5'), 'Proteção contra gestos verticais')
  assert.ok(slot.includes('touchAction: \'pan-y\''), 'Isolamento touchAction pan-y para evitar interferência nos controles')
  assert.ok(slot.includes('e.stopPropagation()'), 'Interrompe propagação para proteger controles periféricos')
})

test('2.2 Alternativa acessível: botão pill discreto e indicador de bolinhas (dots)', () => {
  const slot = read('src/components/dashboard/SwipeableClusterMediaSlot.tsx')

  assert.ok(slot.includes("activeView === 'cluster' ? '📺' : '📟'"), 'Ícone contextual da pill')
  assert.ok(slot.includes("activeView === 'cluster' ? 'MÍDIA' : 'PAINEL'"), 'Rótulo contextual da pill')
  assert.ok(slot.includes('setView(\'cluster\')'), 'Dot interativo para selecionar cluster')
  assert.ok(slot.includes('setView(\'multimedia\')'), 'Dot interativo para selecionar multimídia')
})

test('2.3 Alternância visual não interrompe a física, motor, áudio nem loop de simulação', () => {
  const sim = useSimulationStore.getState()
  sim.setThrottle(0.75)
  assert.strictEqual(useSimulationStore.getState().throttle, 0.75, 'Acelerador ativo')

  // Troca de tela no slot não toca na store física
  const slot = read('src/components/dashboard/SwipeableClusterMediaSlot.tsx')
  assert.ok(!slot.includes('useSimulationStore'), 'SwipeableClusterMediaSlot é puramente visual e desacoplado da store física')
  assert.ok(!slot.includes('reset('), 'Não chama reset')
  assert.ok(!slot.includes('stop('), 'Não para o motor')
})

// ─────────────────────────────────────────────────────────────
// 3. RESPONSIVIDADE REAL NO CELULAR FÍSICO & CORREÇÕES DO HUD
// ─────────────────────────────────────────────────────────────
test('3.1 Root containers do cockpit usam w-full h-full overflow-hidden e insets seguros', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')
  const portrait = read('src/components/dashboard/MobilePortraitCockpit.tsx')

  assert.ok(landscape.includes('fixed inset-0 w-full h-full'), 'Landscape usa w-full h-full para respeitar viewport real')
  assert.ok(portrait.includes('fixed inset-0 w-full h-full'), 'Portrait usa w-full h-full para respeitar viewport real')
  assert.ok(landscape.includes('overflow-hidden'), 'Landscape com overflow-hidden para travar rolagem fantasma')
  assert.ok(portrait.includes('overflow-hidden'), 'Portrait com overflow-hidden para travar rolagem fantasma')
  assert.ok(landscape.includes('safe-area-inset-top'), 'Landscape considera safe-area-inset-top')
  assert.ok(landscape.includes('safe-area-inset-bottom'), 'Landscape considera safe-area-inset-bottom')
})

test('3.2 Pedais possuem alturas seguras (sem corte na base no celular deitado)', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')

  // Alturas calibradas anti-corte: h-28 / h-32 / h-36 em vez de h-[64dvh]
  assert.ok(landscape.includes('heightClass="h-28 sm:h-32"'), 'Acelerador e embreagem com altura compacta segura')
  assert.ok(landscape.includes('heightClass="h-32 sm:h-36"'), 'Freio com altura segura')
  assert.ok(!landscape.includes('heightClass="h-[64dvh]"'), 'Eliminada altura excessiva de 64dvh que causava corte')
})

test('3.3 Botões de partida (START) e freio de mão possuem alturas compactas anti-corte', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')

  // Altura h-11 (44px) padrão de toque seguro sem vazar a tela
  assert.ok(landscape.includes('h-11 rounded-xl'), 'Freio de mão com h-11')
  assert.ok(landscape.includes('MobileStartButton variant="square" className="h-11'), 'START button com h-11')
  assert.ok(!landscape.includes('h-14 rounded-2xl'), 'Eliminada altura excessiva h-14')
})

test('3.4 Faixa textual fixa de troca de marcha (hasActiveAlert) eliminada do HUD vertical', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')
  const portrait = read('src/components/dashboard/MobilePortraitCockpit.tsx')

  // Removida barra fixa de texto que empurrava e cortava o cluster
  assert.ok(!landscape.includes('▲ TROQUE DE MARCHA!'), 'Faixa fixa de troca de marcha removida do cockpit landscape')
  assert.ok(!portrait.includes('▲ TROQUE DE MARCHA!'), 'Faixa fixa de troca de marcha removida do cockpit portrait')
  assert.ok(!landscape.includes('hasActiveAlert &&'), 'hasActiveAlert removido de landscape')
})

test('3.5 Mapa centralizado, amplo e proporções preservadas nos 3 modos (P, M, G)', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')
  assert.ok(landscape.includes("mapViewportSize === 'compact'"), 'Trata modo compacto')
  assert.ok(landscape.includes("mapViewportSize === 'expanded'"), 'Trata modo expandido')
  assert.ok(landscape.includes('h-[30%] flex-shrink-0'), 'Altura compacta calibrada')
  assert.ok(landscape.includes('h-[44%] flex-shrink-0'), 'Altura balanceada calibrada')
  assert.ok(landscape.includes('h-[58%] flex-shrink-0'), 'Altura expandida calibrada')
})

test('3.6 Buzina e TCS reposicionados no topo direito alinhados ao mapa', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')
  assert.ok(landscape.includes('aria-label="Buzina"'), 'Buzina presente')
  assert.ok(landscape.includes('w-9 h-9 rounded-full'), 'TCS circular confortável presente')
  assert.ok(landscape.includes('aria-label="Cronômetro 0 a 100 km/h"'), 'Indicador 0-100 posicionado logo abaixo')
})

// ─────────────────────────────────────────────────────────────
// 4. REFORMULAÇÃO DA GARAGEM: ENQUADRAMENTO, SPECS E BOTÕES
// ─────────────────────────────────────────────────────────────
test('4.1 Veículos com visualização integral e escala moderada (object-contain sem cortes)', () => {
  const home = read('src/screens/HomeScreen.tsx')

  assert.ok(home.includes('object-contain p-1.5'), 'Thumbnail usa object-contain com padding para enquadramento perfeito')
  assert.ok(!home.includes('object-cover opacity-85'), 'Removido object-cover que recortava para-choques')
})

test('4.2 Ficha técnica detalhada renderizada em cada card de veículo', () => {
  const specsCivic = getVehicleSpecs({ powerHp: 192, torqueKgfm: 19.2, transmissionLabel: 'Manual 6 marchas' }, 'civic-si')
  assert.ok(specsCivic.engine.includes('i-VTEC'), 'Civic identifica motor i-VTEC')
  assert.ok(specsCivic.drivetrain.includes('FWD'), 'Civic identifica tração dianteira')

  const specsPorsche = getVehicleSpecs({ powerHp: 525, torqueKgfm: 47.4, transmissionLabel: 'PDK 7 marchas' }, 'porsche-gt3')
  assert.ok(specsPorsche.engine.includes('Boxer-6'), 'Porsche identifica motor Boxer-6')
  assert.ok(specsPorsche.drivetrain.includes('RWD'), 'Porsche identifica tração traseira')

  const specsOpala = getVehicleSpecs({ powerHp: 171, torqueKgfm: 32.5, transmissionLabel: 'Manual 4 marchas' }, 'opala-diplomata')
  assert.ok(specsOpala.engine.includes('250-S'), 'Opala identifica motor 250-S')
  assert.ok(specsOpala.drivetrain.includes('RWD'), 'Opala identifica tração traseira')
})

test('4.3 Funcionalidades da Garagem (oficina, dyno, venda, sandbox, compras) 100% preservadas', () => {
  const home = read('src/screens/HomeScreen.tsx')
  assert.ok(home.includes('handleOpenWorkshop'), 'Oficina de peças preservada')
  assert.ok(home.includes('handleOpenDyno'), 'Dinamômetro preservado')
  assert.ok(home.includes('handleSellCar'), 'Venda de veículos preservada')
  assert.ok(home.includes('handleBuyCar'), 'Compra de novos veículos preservada')
  assert.ok(home.includes('toggleSandboxMode'), 'Modo Sandbox preservado')
})

// ─────────────────────────────────────────────────────────────
// 5. PRESERVAÇÃO DOS 8 VEÍCULOS E ARQUITETURA MULTIPLAYER
// ─────────────────────────────────────────────────────────────
test('5.1 Preservação dos 8 veículos cadastrados', () => {
  const manifest = JSON.parse(read('public/vehicles/manifest.json'))
  const ids = manifest.vehicles.map((v: any) => v.id)

  const expectedVehicles = [
    'civic-si',
    'golf-gti',
    'gol-g6',
    'gol-quadrado-turbo',
    'porsche-gt3',
    'opala-4100',
    'yaris-2019',
    'cb1000r',
  ]

  for (const expected of expectedVehicles) {
    assert.ok(ids.includes(expected), `Veículo ${expected} presente no manifest oficial`)
  }
})

test('5.2 Controles exclusivos da motocicleta Honda CB1000R preservados', () => {
  const landscape = read('src/components/dashboard/MobileLandscapeCockpit.tsx')
  assert.ok(landscape.includes("label={isMotorcycle ? 'MANETE' : 'EMBR'}"), 'Manete de embreagem')
  assert.ok(landscape.includes("label={isMotorcycle ? 'F. TRAS' : 'FREIO'}"), 'Freio a pé traseiro')
  assert.ok(landscape.includes("label={isMotorcycle ? 'PUNHO' : 'ACEL'}"), 'Punho de aceleração')
  assert.ok(landscape.includes('F. DIANTEIRO'), 'Freio manete dianteiro')
})

test('5.3 Arquitetura de stores desacoplada e preparada para Multiplayer', () => {
  // 1. Estado da Simulação
  assert.ok(typeof useSimulationStore.getState().speed === 'number', 'Simulação controla física')
  // 2. Estado da Interface
  assert.ok(typeof useUIStore.getState().mapViewportSize === 'string', 'UI controla mapa e views')
  // 3. Estado da Sessão
  assert.ok(typeof useSessionStore.getState().entryMode === 'string', 'Sessão controla contexto')
})

console.log('\n===============================================================')
console.log(`RESULTADO DA FASE 1.5: ${passed} PASSOU | ${failed} FALHOU`)
console.log('===============================================================\n')

if (failed > 0) {
  process.exit(1)
}
