import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useSimulationStore } from './src/stores/useSimulationStore'
import type { VehicleConfig } from './src/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('═══════════════════════════════════════════════════════════════')
console.log('  HEATZ AUTO — VALIDAÇÃO DOS CONTROLES MOBILE & PAINEL AMPLIADO ')
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

function loadVehicle(id: string): VehicleConfig {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'vehicles', id, 'config.json'), 'utf-8'))
}

runTest('Botão TCS da store alterna tcsEnabled corretamente em veículos com TCS', () => {
  const golf = loadVehicle('golf-gti')
  assert.strictEqual(golf.transmission.tcs?.enabled, true, 'Golf GTI possui TCS configurado')
  useSimulationStore.getState().init(golf)
  assert.strictEqual(useSimulationStore.getState().tcsEnabled, true, 'TCS inicia ativo')
  useSimulationStore.getState().setTcsEnabled(!useSimulationStore.getState().tcsEnabled)
  assert.strictEqual(useSimulationStore.getState().tcsEnabled, false, 'TCS desativa pelo toggle')
  useSimulationStore.getState().setTcsEnabled(!useSimulationStore.getState().tcsEnabled)
  assert.strictEqual(useSimulationStore.getState().tcsEnabled, true, 'TCS reativa pelo toggle')
})

runTest('Troca manual (- / +) via shiftUp/shiftDown funciona nos automáticos com hasManualMode', () => {
  for (const autoId of ['golf-gti', 'porsche-gt3', 'yaris-2019']) {
    const cfg = loadVehicle(autoId)
    assert.strictEqual(cfg.transmission.hasManualMode, true, `${autoId} deve ter hasManualMode: true`)
    useSimulationStore.getState().init(cfg)
    useSimulationStore.getState().startEngine()
    for (let i = 0; i < 100 && !useSimulationStore.getState().isRunning; i++) {
      useSimulationStore.getState().update(0.02)
    }
    assert.strictEqual(useSimulationStore.getState().isRunning, true, `${autoId} deve ligar após arranque`)
    useSimulationStore.getState().selectDrive()
    assert.strictEqual(useSimulationStore.getState().isAutomaticVehicle, true)
    assert.strictEqual(useSimulationStore.getState().currentGear, 1)

    useSimulationStore.getState().shiftUp()
    assert.strictEqual(useSimulationStore.getState().transmissionMode, 'manual_simulated', `${autoId} entra em modo manual simulado no +`)
    assert.strictEqual(useSimulationStore.getState().gearSelectorPosition, 'M', `${autoId} move seletor para M`)
    assert.strictEqual(useSimulationStore.getState().currentGear, 2, `${autoId} sobe para 2ª marcha`)

    useSimulationStore.getState().shiftDown()
    assert.strictEqual(useSimulationStore.getState().currentGear, 1, `${autoId} reduz de volta para 1ª marcha no -`)
  }
})

runTest('GearShift permite ocultar PADDLE [-]/[+ ] no mobile mantendo desktop intacto', () => {
  const gearShiftCode = fs.readFileSync(path.join(__dirname, 'src/components/controls/GearShift.tsx'), 'utf-8')
  const desktopCode = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/VehicleDashboard.tsx'), 'utf-8')
  assert.ok(gearShiftCode.includes('showPaddles = true'), 'GearShift deve manter showPaddles=true por padrão')
  assert.ok(gearShiftCode.includes('{showPaddles && ('), 'GearShift deve envolver PADDLE [-]/[+] em showPaddles')
  assert.ok(!desktopCode.includes('showPaddles={false}'), 'Desktop mantém Paddle Shift dentro do GearShift')
})

runTest('Cockpits mobile possuem botão TCS interativo, voltar para garagem, - na esquerda e + na direita no alto e PAINEL ampliado', () => {
  const shiftBtnsCode = fs.readFileSync(
    path.join(__dirname, 'src/components/controls/AutomaticShiftButtons.tsx'),
    'utf-8',
  )
  assert.ok(shiftBtnsCode.includes('!isAutomaticVehicle || !hasManualMode'), 'Botões -/+ exclusivos de automáticos com modo manual')
  assert.ok(shiftBtnsCode.includes('isManualActive'), 'Botões -/+ só aparecem quando o modo manual estiver ativo')
  assert.ok(
    shiftBtnsCode.includes("transmissionMode === 'manual_simulated' || gearSelectorPosition === 'M'"),
    'Modo manual definido por M ou manual_simulated',
  )
  assert.ok(!shiftBtnsCode.includes('PADDLE'), 'Botões ao lado do painel exibem apenas - e +, sem texto PADDLE')

  for (const file of ['MobilePortraitCockpit.tsx', 'MobileLandscapeCockpit.tsx']) {
    const code = fs.readFileSync(path.join(__dirname, 'src/components/dashboard', file), 'utf-8')
    assert.ok(code.includes('onClick={() => setTcsEnabled(!tcsEnabled)}'), `${file}: TCS deve ser botão interativo ao lado do 0-100`)
    assert.ok(code.includes('onClick={onBack}'), `${file}: deve possuir botão direto onBack ao lado do botão ☰`)
    assert.ok(code.includes('showPaddles={false}'), `${file}: deve ocultar PADDLE [-]/[+] de GearShift`)
    assert.ok(code.includes('AutomaticShiftButton direction="down"'), `${file}: deve possuir botão - na esquerda`)
    assert.ok(code.includes('AutomaticShiftButton direction="up"'), `${file}: deve possuir botão + na direita`)
    assert.ok(code.includes('expanded={true}'), `${file}: deve ampliar o cluster na aba PAINEL`)
  }
})

runTest('Clusters responsivos utilizam container queries para não empilhar verticalmente no mobile', () => {
  for (const clusterFile of [
    'Porsche992GT3RealCluster.tsx',
    'Opala4100RealCluster.tsx',
    'GolfGTIRealCluster.tsx',
    'GolG6RealCluster.tsx',
    'ToyotaYarisRealCluster.tsx',
    'GolQuadradoRealCluster.tsx',
  ]) {
    const code = fs.readFileSync(
      path.join(__dirname, 'src/components/dashboard/clusters', clusterFile),
      'utf-8',
    )
    assert.ok(code.includes('@container'), `${clusterFile} deve definir @container no container raiz`)
    assert.ok(code.includes('@['), `${clusterFile} deve usar breakpoint baseado em container em vez de viewport`)
  }
})

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`RESULTADO MOBILE HUD & CONTROLES: ${passed} PASSOU | ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════\n')

if (failed > 0) process.exit(1)
