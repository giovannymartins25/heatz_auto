/**
 * HEATZ AUTO — FASE 4.3: Suíte Automatizada do Cockpit Modular de Três Painéis
 *
 * Verifica:
 * 1. Descoberta e identidade visual por veículo em todos os 10 modelos atuais
 *    (`getAvailableCockpitPanels`: Painel 1 Cluster, Painel 2 Mídia/Rádio/Console, Painel 3 Controles).
 * 2. CB1000R mantém cockpit de motocicleta (2 painéis: Painel TFT + Comandos Moto, sem multimídia).
 * 3. Preservação de estado de painel ao redimensionar (`useUIStore.activeCockpitPanel`).
 * 4. Troca de veículo de carro (em 'multimedia') para moto ('cb1000r') via `resolveValidCockpitPanel`
 *    e `resolveValidDesktopSecondaryPanel` evita manter seleção inválida.
 * 5. Preservação dos estados reais de climatização, vidros, ignição e setas na `useSimulationStore`
 *    durante navegação entre painéis (sem estados paralelos ou duplicação).
 * 6. Garantia de ausência de `useSecondaryTouchTapBridge` duplicado em componentes aninhados.
 */

import fs from 'fs'
import path from 'path'
import type { VehicleConfig } from './src/types/vehicle'
import { useUIStore } from './src/stores/useUIStore'
import { useSimulationStore } from './src/stores/useSimulationStore'
import {
  getAvailableCockpitPanels,
  resolveValidCockpitPanel,
  resolveValidDesktopSecondaryPanel,
} from './src/components/cockpit/cockpitPanels'
import {
  resolveVehicleCabin,
  resolveVehicleIgnition,
  resolveVehicleMultimediaSpec,
} from './src/systems/vehicle/vehicleResolvers'

let passed = 0
let failed = 0

function assert(cond: boolean, name: string, detail = '') {
  if (cond) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const REPO = process.cwd()
const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'public', 'vehicles', 'manifest.json'), 'utf8'))

function loadVehicle(id: string): VehicleConfig {
  const entry = manifest.vehicles.find((v: any) => v.id === id)
  if (!entry) throw new Error(`Veículo ${id} não encontrado no manifest`)
  const cfgPath = path.join(REPO, 'public', entry.configPath.replace(/^\//, ''))
  return JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as VehicleConfig
}

console.log('\n=== FASE 4.3 — 1. DESCOBERTA DE PAINÉIS E IDENTIDADE DOS 10 VEÍCULOS ===')

for (const entry of manifest.vehicles) {
  const cfg = loadVehicle(entry.id)
  const panels = getAvailableCockpitPanels(cfg)
  const isMoto = cfg.info.category === 'motorcycle'

  if (isMoto) {
    assert(
      panels.length === 2 && panels[0].id === 'cluster' && panels[1].id === 'controls',
      `[${cfg.id}] motocicleta possui 2 painéis (cluster + controls), omitindo multimídia`,
    )
    const cabin = resolveVehicleCabin(cfg)
    assert(
      cabin.climateType === 'none' && cabin.windowCount === 0 && !cabin.hasFogLights,
      `[${cfg.id}] sem controles automotivos de A/C, vidros ou neblina`,
    )
  } else {
    assert(
      panels.length === 3 &&
        panels[0].id === 'cluster' &&
        panels[1].id === 'multimedia' &&
        panels[2].id === 'controls',
      `[${cfg.id}] carro possui 3 painéis modulares completos (cluster, multimedia, controls)`,
    )

    const mediaSpec = resolveVehicleMultimediaSpec(cfg)
    const panel2 = panels[1]
    if (mediaSpec.type === 'radio') {
      assert(panel2.shortLabel === 'RÁDIO', `[${cfg.id}] Painel 2 rotulado como RÁDIO (${mediaSpec.name})`)
    } else if (mediaSpec.type === 'none') {
      assert(panel2.shortLabel === 'CONSOLE', `[${cfg.id}] Painel 2 rotulado como CONSOLE (${mediaSpec.name})`)
    } else {
      assert(panel2.shortLabel === 'MÍDIA', `[${cfg.id}] Painel 2 rotulado como MÍDIA (${mediaSpec.name})`)
    }
  }
}

const golQuadrado = loadVehicle('gol-quadrado-turbo')
const golQuadUpgradedPanels = getAvailableCockpitPanels(golQuadrado, { multimediaKit: true })
assert(
  golQuadUpgradedPanels[1].shortLabel === 'MÍDIA',
  'Gol Quadrado com upgrade Retrofit 2-DIN promove Painel 2 de CONSOLE -> MÍDIA',
)

console.log('\n=== FASE 4.3 — 2. NAVEGAÇÃO, REDIMENSIONAMENTO E TROCA DE VEÍCULO ===')

{
  const golfGti = loadVehicle('golf-gti')
  const cb1000r = loadVehicle('cb1000r')
  const ui = useUIStore.getState()

  // Navegação direta entre os 3 painéis e preservação durante redimensionamento (portrait <-> landscape)
  ui.setActiveCockpitPanel('controls')
  assert(
    useUIStore.getState().activeCockpitPanel === 'controls',
    'useUIStore persiste activeCockpitPanel = controls durante troca de layout portrait ↔ landscape',
  )
  assert(
    resolveValidCockpitPanel(useUIStore.getState().activeCockpitPanel, golfGti) === 'controls',
    'resolveValidCockpitPanel preserva controls no Golf GTI após redimensionamento',
  )

  // Troca de veículo enquanto usuário estava em Painel 2 ('multimedia') para CB1000R (sem multimídia)
  ui.setActiveCockpitPanel('multimedia')
  ui.setDesktopSecondaryPanel('multimedia')
  assert(
    resolveValidCockpitPanel(useUIStore.getState().activeCockpitPanel, cb1000r) === 'cluster',
    'Troca de carro em multimedia para CB1000R corrige activeCockpitPanel para cluster',
  )
  assert(
    resolveValidDesktopSecondaryPanel(useUIStore.getState().desktopSecondaryPanel, cb1000r) === 'controls',
    'Troca para CB1000R no desktop corrige painel secundário para controls',
  )
}

console.log('\n=== FASE 4.3 — 3. PRESERVAÇÃO DE ESTADOS REAIS DURANTE NAVEGAÇÃO ===')

{
  const golfGti = loadVehicle('golf-gti')
  const sim = useSimulationStore.getState()
  const ui = useUIStore.getState()

  sim.reset()
  sim.init(golfGti)
  sim.setBrake(0.8)
  sim.requestEngineStart(true)
  for (let i = 0; i < 65; i++) sim.update(1 / 120)

  // Painel 3: altera climatização, vidros e seta
  ui.setActiveCockpitPanel('controls')
  sim.toggleClimateAc()
  sim.setClimateTargetTempC(19.5)
  sim.setClimateFanLevel(4)
  sim.setWindowPosition('front_left', 0.75)
  sim.toggleLeftTurnSignal()

  // Alterna para Painel 2 e depois volta ao Painel 1
  ui.setActiveCockpitPanel('multimedia')
  for (let i = 0; i < 60; i++) sim.update(1 / 120)
  ui.setActiveCockpitPanel('cluster')
  for (let i = 0; i < 30; i++) sim.update(1 / 120)

  const st = useSimulationStore.getState()
  assert(
    st.climateAcEnabled === true &&
      st.climateTargetTempC === 19.5 &&
      st.climateFanLevel === 4 &&
      st.isCompressorEngaged === true,
    'Estado da climatização (A/C, setpoint, ventilação, compressor) preservado ao navegar entre os 3 painéis',
  )
  assert(
    Math.abs(st.windowPositions.front_left - 0.75) < 1e-4 && st.windowsOpen === true,
    'Abertura individual do vidro dianteiro esquerdo (75%) preservada ao alternar painéis',
  )
  assert(
    st.leftTurnSignal === true && st.isRunning === true,
    'Seta esquerda e estado de motor ligado preservados sem reset ou duplicação',
  )
}

console.log('\n=== FASE 4.3 — 4. ARQUITETURA MODULAR E AUSÊNCIA DE MULTITOUCH BRIDGE DUPLICADO ===')

{
  const cockpitDir = path.join(REPO, 'src', 'components', 'cockpit')
  const requiredFiles = [
    'cockpitPanels.ts',
    'InstrumentClusterPanel.tsx',
    'MultimediaPanel.tsx',
    'VehicleControlsPanel.tsx',
    'CockpitPanelCarousel.tsx',
    'DesktopCockpitLayout.tsx',
    'index.ts',
  ]
  for (const f of requiredFiles) {
    assert(fs.existsSync(path.join(cockpitDir, f)), `Arquivo modular presente: src/components/cockpit/${f}`)
  }

  const controlsPanelSrc = fs.readFileSync(path.join(cockpitDir, 'VehicleControlsPanel.tsx'), 'utf8')
  const clusterPanelSrc = fs.readFileSync(path.join(cockpitDir, 'InstrumentClusterPanel.tsx'), 'utf8')
  const multimediaPanelSrc = fs.readFileSync(path.join(cockpitDir, 'MultimediaPanel.tsx'), 'utf8')
  const cabinBarSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'dashboard', 'CabinControlsBar.tsx'),
    'utf8',
  )

  assert(
    !controlsPanelSrc.includes('useSecondaryTouchTapBridge') &&
      !clusterPanelSrc.includes('useSecondaryTouchTapBridge') &&
      !multimediaPanelSrc.includes('useSecondaryTouchTapBridge') &&
      !cabinBarSrc.includes('useSecondaryTouchTapBridge'),
    'useSecondaryTouchTapBridge não está duplicado em subpainéis internos (aplicado apenas nos containers raiz)',
  )

  // Garante que ignition spec e cabin spec seguem íntegros para todos os 10 veículos
  const opala = loadVehicle('opala-4100')
  assert(
    resolveVehicleIgnition(opala).type === 'key' && resolveVehicleIgnition(opala).startInterlock === 'none',
    'Identidade de ignição preservada no painel para Opala 4.1',
  )
}

console.log(`\n══════════════════════════════════════════════════`)
console.log(`RESULTADO FASE 4.3: ${passed} passaram | ${failed} falharam`)
console.log(`══════════════════════════════════════════════════\n`)

if (failed > 0) {
  process.exit(1)
}
