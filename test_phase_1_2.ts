import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useSimulationStore } from './src/stores/useSimulationStore'
import type { VehicleConfig, DrivingMode, GearSelectorPosition } from './src/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('═══════════════════════════════════════════════════════════════')
console.log('  HEATZ AUTO — VALIDAÇÃO DA FASE 1.2 (MOBILE QUICKCLUTCH & MODOS)')
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

// Carregar configs dos veículos
const vehiclesDir = path.join(__dirname, 'public', 'vehicles')
const vehicleDirs = fs.readdirSync(vehiclesDir).filter((d) =>
  fs.statSync(path.join(vehiclesDir, d)).isDirectory()
)

const vehicleConfigs: Record<string, VehicleConfig> = {}
for (const vId of vehicleDirs) {
  const cfgPath = path.join(vehiclesDir, vId, 'config.json')
  if (fs.existsSync(cfgPath)) {
    vehicleConfigs[vId] = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
  }
}

console.log('▶ [Cenário 1] Regras de Embreagem (QuickClutch) por Veículo')
runTest('Veículos manuais possuem hasClutch: true (Civic, Gol G6, Gol Turbo, Opala, CB1000R)', () => {
  const manualCars = ['civic-si', 'gol-g6', 'gol-quadrado-turbo', 'opala-4100', 'cb1000r']
  for (const id of manualCars) {
    const v = vehicleConfigs[id]
    assert.ok(v, `Veículo ${id} não encontrado`)
    assert.strictEqual(v.transmission.hasClutch, true, `${id} deveria ter hasClutch: true`)
  }
})

runTest('Veículos automáticos/DSG/CVT possuem hasClutch: false (Golf GTI, Porsche GT3, Yaris)', () => {
  const autoCars = ['golf-gti', 'porsche-gt3', 'yaris-2019']
  for (const id of autoCars) {
    const v = vehicleConfigs[id]
    assert.ok(v, `Veículo ${id} não encontrado`)
    assert.strictEqual(v.transmission.hasClutch, false, `${id} deveria ter hasClutch: false`)
  }
})

console.log('\n▶ [Cenário 2] Modos de Condução Suportados por Veículo')
runTest('Golf GTI e Yaris suportam ["eco", "normal", "sport"]', () => {
  assert.deepStrictEqual(vehicleConfigs['golf-gti'].transmission.supportedModes, ['eco', 'normal', 'sport'])
  assert.deepStrictEqual(vehicleConfigs['yaris-2019'].transmission.supportedModes, ['eco', 'normal', 'sport'])
})

runTest('Porsche GT3 suporta ["normal", "sport", "track"]', () => {
  assert.deepStrictEqual(vehicleConfigs['porsche-gt3'].transmission.supportedModes, ['normal', 'sport', 'track'])
})

runTest('Opala suporta ["normal", "sport"]', () => {
  assert.deepStrictEqual(vehicleConfigs['opala-4100'].transmission.supportedModes, ['normal', 'sport'])
})

runTest('Veículos sem modos múltiplos possuem supportedModes indefinido ou vazio', () => {
  const baseVehicles = ['civic-si', 'gol-g6', 'gol-quadrado-turbo', 'cb1000r']
  for (const id of baseVehicles) {
    const modes = vehicleConfigs[id].transmission.supportedModes
    assert.ok(!modes || modes.length === 0, `${id} não deveria ter modos múltiplos`)
  }
})

console.log('\n▶ [Cenário 3] Desacoplamento entre Perfil SPORT e Seletor de Marcha')
runTest('Selecionar perfil SPORT NUNCA altera gearSelectorPosition para S', () => {
  useSimulationStore.getState().init(vehicleConfigs['golf-gti'])
  useSimulationStore.getState().startEngine()
  useSimulationStore.getState().selectDrive()

  assert.strictEqual(useSimulationStore.getState().gearSelectorPosition, 'D')
  assert.strictEqual(useSimulationStore.getState().drivingMode, 'normal')

  // Troca para SPORT
  useSimulationStore.getState().setDrivingMode('sport')

  // O perfil de condução mudou para sport...
  assert.strictEqual(useSimulationStore.getState().drivingMode, 'sport')
  // ...mas a posição física da alavanca CONTINUA RIGOROSAMENTE em D!
  assert.strictEqual(useSimulationStore.getState().gearSelectorPosition, 'D')

  // Troca para ECO
  useSimulationStore.getState().setDrivingMode('eco')
  assert.strictEqual(useSimulationStore.getState().drivingMode, 'eco')
  assert.strictEqual(useSimulationStore.getState().gearSelectorPosition, 'D')
})

console.log('\n▶ [Cenário 4] Inspeção dos Arquivos de Cockpit Mobile')
runTest('MobilePortraitCockpit possui QuickClutchButton à esquerda e DrivingModesSelector', () => {
  const code = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobilePortraitCockpit.tsx'), 'utf-8')
  assert.ok(code.includes('DrivingModesSelector'), 'MobilePortraitCockpit deve importar/usar DrivingModesSelector')
  assert.ok(code.includes('QuickClutchButton'), 'MobilePortraitCockpit deve usar QuickClutchButton')
  
  // Dentro do footer, QuickClutchButton deve vir antes de <AnalogPedal (coluna esquerda vs centro)
  const footerStart = code.indexOf('<footer')
  const footerCode = code.slice(footerStart)
  const quickClutchIdx = footerCode.indexOf('<QuickClutchButton')
  const pedalsIdx = footerCode.indexOf('<AnalogPedal')
  assert.ok(quickClutchIdx !== -1, 'QuickClutchButton deve existir no footer')
  assert.ok(pedalsIdx !== -1, 'AnalogPedal deve existir no footer')
  assert.ok(quickClutchIdx < pedalsIdx, 'QuickClutchButton deve vir antes dos pedais (coluna esquerda)')
})

runTest('MobileLandscapeCockpit possui QuickClutchButton na lateral esquerda com pedais', () => {
  const code = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobileLandscapeCockpit.tsx'), 'utf-8')
  assert.ok(code.includes('DrivingModesSelector'), 'MobileLandscapeCockpit deve importar/usar DrivingModesSelector')
  assert.ok(code.includes('QuickClutchButton'), 'MobileLandscapeCockpit deve usar QuickClutchButton')
  
  // No aside direito não deve conter QuickClutchButton
  const rightAsideStart = code.indexOf('3. DIREITA: CONTROLES')
  const rightAsideCode = code.slice(rightAsideStart)
  assert.ok(!rightAsideCode.includes('QuickClutchButton'), 'Right aside NÃO deve conter QuickClutchButton')
  
  // Right aside deve conter DrivingModesSelector
  assert.ok(rightAsideCode.includes('DrivingModesSelector'), 'Right aside DEVE conter DrivingModesSelector')
})

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`RESULTADO DA FASE 1.2: ${passed} PASSOU | ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════\n')

if (failed > 0) process.exit(1)
