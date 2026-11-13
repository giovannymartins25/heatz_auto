import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useUIStore } from './src/stores/useUIStore'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('═══════════════════════════════════════════════════════════════')
console.log('  HEATZ AUTO — TESTES FASE 1.2: HUD MOBILE & MAPA SUPERIOR      ')
console.log('═══════════════════════════════════════════════════════════════\n')

let passed = 0
let failed = 0

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ PASSOU | ${name}`)
    passed++
  } catch (err) {
    console.error(`✗ FALHOU | ${name}`)
    console.error(err)
    failed++
  }
}

// 1. Validar useUIStore
console.log('▶ [Cenário 1] Store de Interface (useUIStore) e Modos de Mapa')
runTest('useUIStore inicia com mapViewportSize="balanced" como padrão', () => {
  const state = useUIStore.getState()
  assert.strictEqual(state.mapViewportSize, 'balanced', 'Modo padrão deve ser balanced (Equilibrado)')
})

runTest('useUIStore permite alternar entre compact, balanced e expanded', () => {
  useUIStore.getState().setMapViewportSize('compact')
  assert.strictEqual(useUIStore.getState().mapViewportSize, 'compact')

  useUIStore.getState().setMapViewportSize('expanded')
  assert.strictEqual(useUIStore.getState().mapViewportSize, 'expanded')

  useUIStore.getState().setMapViewportSize('balanced')
  assert.strictEqual(useUIStore.getState().mapViewportSize, 'balanced')
})

// 2. Validar DrivingMapViewport
console.log('\n▶ [Cenário 2] Componente do Mapa (DrivingMapViewport)')
runTest('DrivingMapViewport renderiza ruas cinzas, quarteirões escuros e marcador azul', () => {
  const mapCode = fs.readFileSync(
    path.join(__dirname, 'src/components/dashboard/DrivingMapViewport.tsx'),
    'utf-8',
  )
  assert.ok(mapCode.includes('stroke="#475569"'), 'Mapa deve conter avenidas cinzas')
  assert.ok(mapCode.includes('fill="#0b111e"'), 'Mapa deve conter quarteirões escuros')
  assert.ok(mapCode.includes('fill="#3b82f6"'), 'Mapa deve conter marcador azul do veículo')
  assert.ok(mapCode.includes('GPS 2D'), 'Mapa deve conter indicador de telemetria GPS')
  assert.ok(mapCode.includes('P · M · G') || mapCode.includes("id: 'compact', label: 'P'"), 'Mapa deve conter seletor de modos P, M, G')
})

// 3. Validar Hierarquia no MobileLandscapeCockpit
console.log('\n▶ [Cenário 3] Hierarquia do Cockpit em Paisagem (MobileLandscapeCockpit)')
runTest('MobileLandscapeCockpit posiciona DrivingMapViewport ANTES de VehicleDashboardCluster', () => {
  const landscapeCode = fs.readFileSync(
    path.join(__dirname, 'src/components/dashboard/MobileLandscapeCockpit.tsx'),
    'utf-8',
  )
  const mapIndex = landscapeCode.indexOf('<DrivingMapViewport')
  const clusterIndex = landscapeCode.lastIndexOf('<VehicleDashboardCluster')

  assert.ok(mapIndex !== -1, 'DrivingMapViewport deve estar presente')
  assert.ok(clusterIndex !== -1, 'VehicleDashboardCluster deve estar presente')
  assert.ok(
    mapIndex < clusterIndex,
    'DrivingMapViewport deve vir ANTES (superior) do VehicleDashboardCluster no HUD central',
  )
})

runTest('MobileLandscapeCockpit possui proporções adaptativas para compact, balanced e expanded', () => {
  const landscapeCode = fs.readFileSync(
    path.join(__dirname, 'src/components/dashboard/MobileLandscapeCockpit.tsx'),
    'utf-8',
  )
  assert.ok(landscapeCode.includes("mapViewportSize === 'compact'"), 'Deve tratar modo compact')
  assert.ok(landscapeCode.includes("mapViewportSize === 'expanded'"), 'Deve tratar modo expanded')
  assert.ok(landscapeCode.includes('h-[24%]'), 'compact deve ocupar ~24% de altura')
  assert.ok(landscapeCode.includes('h-[36%]'), 'balanced deve ocupar ~36% de altura')
  assert.ok(landscapeCode.includes('h-[50%]'), 'expanded deve ocupar ~50% de altura')
})

// 4. Validar Hierarquia no MobilePortraitCockpit
console.log('\n▶ [Cenário 4] Hierarquia do Cockpit em Retrato (MobilePortraitCockpit)')
runTest('MobilePortraitCockpit posiciona DrivingMapViewport ANTES de VehicleDashboardCluster no HUD', () => {
  const portraitCode = fs.readFileSync(
    path.join(__dirname, 'src/components/dashboard/MobilePortraitCockpit.tsx'),
    'utf-8',
  )
  const mapIndex = portraitCode.indexOf('<DrivingMapViewport')
  const clusterIndex = portraitCode.indexOf('<VehicleDashboardCluster telemetry={telemetry} />')

  assert.ok(mapIndex !== -1, 'DrivingMapViewport deve estar presente')
  assert.ok(clusterIndex !== -1, 'VehicleDashboardCluster deve estar presente')
  assert.ok(
    mapIndex < clusterIndex,
    'DrivingMapViewport deve vir ANTES (superior) de VehicleDashboardCluster no modo HUD',
  )
})

runTest('MobilePortraitCockpit possui proporções adaptativas no HUD', () => {
  const portraitCode = fs.readFileSync(
    path.join(__dirname, 'src/components/dashboard/MobilePortraitCockpit.tsx'),
    'utf-8',
  )
  assert.ok(portraitCode.includes("mapViewportSize === 'compact'"), 'Deve tratar modo compact no retrato')
  assert.ok(portraitCode.includes("mapViewportSize === 'expanded'"), 'Deve tratar modo expanded no retrato')
  assert.ok(portraitCode.includes('h-[26%]'), 'compact deve ocupar ~26% no retrato')
  assert.ok(portraitCode.includes('h-[36%]'), 'balanced deve ocupar ~36% no retrato')
  assert.ok(portraitCode.includes('h-[48%]'), 'expanded deve ocupar ~48% no retrato')
})

// 5. Validar Preservação dos 8 Clusters Originais
console.log('\n▶ [Cenário 5] Preservação Integral dos 8 Clusters')
runTest('ClusterView exporta e mapeia os 8 clusters de veículos sem exceção', () => {
  const clusterViewCode = fs.readFileSync(
    path.join(__dirname, 'src/components/dashboard/ClusterView.tsx'),
    'utf-8',
  )
  const requiredClusters = [
    'CivicSiRealCluster',
    'GolfGTIRealCluster',
    'GolG6RealCluster',
    'GolQuadradoRealCluster',
    'Porsche992GT3RealCluster',
    'Opala4100RealCluster',
    'ToyotaYarisRealCluster',
    'HondaCB1000RRealCluster',
  ]
  for (const c of requiredClusters) {
    assert.ok(clusterViewCode.includes(c), `ClusterView deve importar e usar ${c}`)
  }
})

// 6. Validar Controles Laterais
console.log('\n▶ [Cenário 6] Controles Laterais e Ergonomia')
runTest('Controles laterais continuam segregados nas laterais sem sobrepor a área central', () => {
  const landscapeCode = fs.readFileSync(
    path.join(__dirname, 'src/components/dashboard/MobileLandscapeCockpit.tsx'),
    'utf-8',
  )
  assert.ok(landscapeCode.includes('toggleThrottleLock'), 'Trava do acelerador deve permanecer')
  assert.ok(landscapeCode.includes('QuickClutchButton'), 'QuickClutchButton deve permanecer na esquerda')
  assert.ok(landscapeCode.includes('DrivingModesSelector'), 'DrivingModesSelector deve permanecer')
  assert.ok(landscapeCode.includes('GearShift'), 'GearShift deve permanecer')
  assert.ok(landscapeCode.includes('MobileStartButton'), 'MobileStartButton deve permanecer')
})

// 7. Validar Perfis Calibrados e Escala do Cluster
console.log('\n▶ [Cenário 7] Perfis Calibrados do Painel (VehicleDashboardCluster)')
runTest('VehicleDashboardCluster possui perfis calibrados sem alturas fantasmas e maxScale expandido', () => {
  const clusterCode = fs.readFileSync(
    path.join(__dirname, 'src/components/dashboard/VehicleDashboardCluster.tsx'),
    'utf-8',
  )
  assert.ok(!clusterCode.includes('height: 480'), 'Perfis não devem conter altura inflada de 480px')
  assert.ok(!clusterCode.includes('height: 460'), 'Perfis não devem conter altura inflada de 460px')
  assert.ok(!clusterCode.includes('height: 420'), 'Perfis não devem conter altura inflada de 420px')
  assert.ok(clusterCode.includes('height: 280') || clusterCode.includes('height: 285'), 'Perfis devem refletir alturas reais dos instrumentos (~275-290px)')
  assert.ok(clusterCode.includes('maxScale = expanded ? 1.6 : 1.35'), 'maxScale deve permitir até 1.35x para preencher o cockpit')
})

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`RESULTADO: ${passed} PASSOU | ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════')

if (failed > 0) {
  process.exit(1)
}

