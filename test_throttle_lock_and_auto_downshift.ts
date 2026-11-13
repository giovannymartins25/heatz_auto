import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { AutomaticTransmission } from './src/systems/transmission/AutomaticTransmission'
import type { VehicleConfig } from './src/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('═══════════════════════════════════════════════════════════════')
console.log('  HEATZ AUTO — TESTES: TRAVA DO ACELERADOR, MULTITOUCH & AUTO  ')
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

// ─── TESTE 1: Trava do Acelerador (Throttle Lock) ───
runTest('Trava do acelerador liga a 100% e desliga com o freio', () => {
  const golf = loadVehicle('golf-gti')
  useSimulationStore.getState().init(golf)

  assert.strictEqual(useSimulationStore.getState().throttleLock, false, 'Inicia destravado')
  assert.strictEqual(useSimulationStore.getState().throttle, 0, 'Acelerador inicia em 0')

  // Trava o acelerador
  useSimulationStore.getState().toggleThrottleLock()
  assert.strictEqual(useSimulationStore.getState().throttleLock, true, 'Trava ativada')
  assert.strictEqual(useSimulationStore.getState().throttle, 1.0, 'Acelerador em 100%')

  // Soltar o dedo (setThrottle(0)) não zera enquanto travado
  useSimulationStore.getState().setThrottle(0)
  assert.strictEqual(useSimulationStore.getState().throttle, 1.0, 'Permanece em 1.0 mesmo soltando o pedal')

  // Pisar no freio (>= 10%) destrava automaticamente
  useSimulationStore.getState().setBrake(0.3)
  assert.strictEqual(useSimulationStore.getState().throttleLock, false, 'Destrava ao pisar no freio')
  assert.strictEqual(useSimulationStore.getState().throttle, 0.0, 'Acelerador zera com o freio')
})

// ─── TESTE 2: Acelerar 80%+ ou fundo NÃO troca marcha no RPM max e sim respeita o modo ativo ───
runTest('Acelerar 80%+ ou fundo NÃO troca no RPM max e sim respeita o modo ativo (Normal ~3000, Eco ~2200)', () => {
  const golf = loadVehicle('golf-gti')
  const autoTrans = new AutomaticTransmission({
    gearRatios: golf.transmission.gearRatios,
    finalDrive: golf.transmission.finalDrive,
    wheelDiameter: golf.info.wheelDiameter,
    maxRpm: golf.engine.maxRpm,
    idleRpm: golf.engine.idleRpm,
  })

  // 2.1: MODO NORMAL — mesmo com 80% ou 100% de throttle, sobe marcha em ~3.000-3.200 RPM (NÃO estica até 6400+ RPM)
  const decisionNormalWot = autoTrans.decide({
    currentRpm: 3250,
    vehicleSpeedKmh: 45,
    throttle: 1.0,
    brake: 0,
    currentGear: 2,
    drivingMode: 'normal',
    deltaTime: 1.0,
  })
  assert.strictEqual(decisionNormalWot.targetGear, 3, 'No modo Normal com acelerador no fundo, sobe marcha em ~3.200 RPM (não espera redline)')
  assert.strictEqual(decisionNormalWot.isKickdown, false, 'isKickdown permanece falso sem acionar modo especial')

  // 2.2: MODO ECO — mesmo com 90% de acelerador, sobe marcha cedo (~2.300 RPM)
  const decisionEcoHeavy = autoTrans.decide({
    currentRpm: 2400,
    vehicleSpeedKmh: 35,
    throttle: 0.9,
    brake: 0,
    currentGear: 2,
    drivingMode: 'eco',
    deltaTime: 1.0,
  })
  assert.strictEqual(decisionEcoHeavy.targetGear, 3, 'No modo ECO mesmo acelerando 90%, sobe marcha aos 2.400 RPM')

  // 2.3: MODO SPORT — aqui sim o giro sobe até a faixa esportiva (~6.000 RPM)
  const decisionSportHold = autoTrans.decide({
    currentRpm: 4500,
    vehicleSpeedKmh: 65,
    throttle: 0.8,
    brake: 0,
    currentGear: 2,
    drivingMode: 'sport',
    deltaTime: 1.0,
  })
  assert.strictEqual(decisionSportHold.targetGear, 2, 'No modo SPORT segura o giro em 4.500 RPM')

  const decisionSportShift = autoTrans.decide({
    currentRpm: 6150,
    vehicleSpeedKmh: 85,
    throttle: 0.8,
    brake: 0,
    currentGear: 2,
    drivingMode: 'sport',
    deltaTime: 1.0,
  })
  assert.strictEqual(decisionSportShift.targetGear, 3, 'No modo SPORT sobe marcha aos ~6.000 RPM')
})

// ─── TESTE 3: Pisar ~50%+ de acelerador com o carro andando NÃO joga o carro para a 1ª marcha ───
runTest('Pisar 50%+ em movimento NÃO reduz para a 1ª marcha nem entra em modo de giro máximo', () => {
  const golf = loadVehicle('golf-gti')
  const autoTrans = new AutomaticTransmission({
    gearRatios: golf.transmission.gearRatios,
    finalDrive: golf.transmission.finalDrive,
    wheelDiameter: golf.info.wheelDiameter,
    maxRpm: golf.engine.maxRpm,
    idleRpm: golf.engine.idleRpm,
  })

  // Carro em 2ª marcha a 28 km/h (giro ~2.100 RPM), acelerador saindo de 0 para 60%
  const decisionMidThrottle = autoTrans.decide({
    currentRpm: 2100,
    vehicleSpeedKmh: 28,
    throttle: 0.6,
    brake: 0,
    currentGear: 2,
    drivingMode: 'normal',
    deltaTime: 1.0,
  })
  assert.strictEqual(decisionMidThrottle.targetGear, 2, 'Permanece em 2ª marcha ao pisar 60%, não joga para 1ª marcha')
  assert.strictEqual(decisionMidThrottle.isKickdown, false, 'Não ativa kickdown')

  // Mesmo pisando 100% a 25 km/h em 2ª marcha, nunca reduz para 1ª em movimento (segurança)
  const decisionFullThrottle = autoTrans.decide({
    currentRpm: 1900,
    vehicleSpeedKmh: 25,
    throttle: 1.0,
    brake: 0,
    currentGear: 2,
    drivingMode: 'normal',
    deltaTime: 1.0,
  })
  assert.strictEqual(decisionFullThrottle.targetGear, 2, 'Não reduz para 1ª marcha em movimento (>= 12 km/h)')
})

// ─── TESTE 4: Redução no Normal desce em ~2000 RPM e no Sport em ~4000 RPM ───
runTest('Troca automática reduz marcha ao descer de 2.000 RPM no Normal e 4.000 RPM no Sport', () => {
  const golf = loadVehicle('golf-gti')
  const autoTrans = new AutomaticTransmission({
    gearRatios: golf.transmission.gearRatios,
    finalDrive: golf.transmission.finalDrive,
    wheelDiameter: golf.info.wheelDiameter,
    maxRpm: golf.engine.maxRpm,
    idleRpm: golf.engine.idleRpm,
  })

  // 4.1: MODO NORMAL
  // Em 3ª marcha a 45 km/h -> RPM é ~1950 (abaixo de 2000 RPM)
  const normalDownshift = autoTrans.decide({
    currentRpm: 1950,
    vehicleSpeedKmh: 45,
    throttle: 0.2,
    brake: 0,
    currentGear: 3,
    drivingMode: 'normal',
    deltaTime: 1.0,
  })
  assert.strictEqual(normalDownshift.targetGear, 2, 'No modo Normal reduz para 2ª marcha quando giro cai abaixo de 2000 RPM')

  // 4.2: MODO SPORT
  // Em 3ª marcha a 85 km/h -> RPM é ~3900 (abaixo de ~4000 RPM)
  const sportDownshift = autoTrans.decide({
    currentRpm: 3900,
    vehicleSpeedKmh: 85,
    throttle: 0.2,
    brake: 0,
    currentGear: 3,
    drivingMode: 'sport',
    deltaTime: 1.0,
  })
  assert.strictEqual(sportDownshift.targetGear, 2, 'No modo Sport reduz para 2ª marcha quando giro cai abaixo de 4000 RPM')
})

// ─── TESTE 5: Suporte a Multitouch nos Controles Mobile ───
runTest('Componentes possuem handlers de ponteiro/touch isolados com touch-action: none', () => {
  const pedalCode = fs.readFileSync(path.join(__dirname, 'src/components/controls/AnalogPedal.tsx'), 'utf-8')
  assert.ok(pedalCode.includes('activePointerIdRef'), 'AnalogPedal isola ID do ponteiro ativo')
  assert.ok(pedalCode.includes("touchAction: 'none'"), 'AnalogPedal define touchAction none no elemento interativo')

  const autoShiftCode = fs.readFileSync(path.join(__dirname, 'src/components/controls/AutomaticShiftButtons.tsx'), 'utf-8')
  assert.ok(autoShiftCode.includes('onTouchStart'), 'AutomaticShiftButtons possui onTouchStart imediato')
  assert.ok(autoShiftCode.includes("touchAction: 'none'"), 'AutomaticShiftButtons possui touchAction none')

  const gearShiftCode = fs.readFileSync(path.join(__dirname, 'src/components/controls/GearShift.tsx'), 'utf-8')
  assert.ok(gearShiftCode.includes('selectDrive();'), 'GearShift possui selectDrive')
  assert.ok(gearShiftCode.includes('onTouchStart'), 'GearShift possui onTouchStart em botões')

  const portraitCode = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobilePortraitCockpit.tsx'), 'utf-8')
  assert.ok(portraitCode.includes('toggleThrottleLock'), 'MobilePortraitCockpit possui botão de travar acelerador')

  const landscapeCode = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobileLandscapeCockpit.tsx'), 'utf-8')
  assert.ok(landscapeCode.includes('toggleThrottleLock'), 'MobileLandscapeCockpit possui botão de travar acelerador')
})

// ─── TESTE 6: Display PDK da Porsche e DSG do Golf exibem 'P' no modo Park ───
runTest('Display PDK da Porsche 992 GT3 e DSG do Golf GTI exibem P quando no modo Park (não D-2 ou D2)', () => {
  const porscheClusterCode = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/clusters/Porsche992GT3RealCluster.tsx'), 'utf-8')
  assert.ok(
    porscheClusterCode.includes("gearSelectorPosition === 'P' || currentGear === -2"),
    'Porsche cluster verifica explicitamente P e currentGear -2'
  )
  assert.ok(
    porscheClusterCode.includes("? 'P'"),
    'Porsche cluster retorna P para o display PDK no modo Park'
  )

  const golfClusterCode = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/clusters/GolfGTIRealCluster.tsx'), 'utf-8')
  assert.ok(
    golfClusterCode.includes("gearSelectorPosition === 'P' || currentGear === -2"),
    'Golf GTI cluster verifica explicitamente P e currentGear -2'
  )
  assert.ok(
    golfClusterCode.includes("? 'P'"),
    'Golf GTI cluster retorna P para o display DSG no modo Park'
  )
})

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════\n')

if (failed > 0) process.exit(1)
