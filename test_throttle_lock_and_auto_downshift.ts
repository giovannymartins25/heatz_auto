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

// ─── TESTE 2: Kickdown estica marchas sem mudar drivingMode para sport ───
runTest('Pisou fundo (Kickdown >= 85%) estica até giro alto sem alterar drivingMode', () => {
  const golf = loadVehicle('golf-gti')
  const autoTrans = new AutomaticTransmission({
    gearRatios: golf.transmission.gearRatios,
    finalDrive: golf.transmission.finalDrive,
    wheelDiameter: golf.info.wheelDiameter,
    maxRpm: golf.engine.maxRpm,
    idleRpm: golf.engine.idleRpm,
  })

  // Inicializa store no modo ECO
  useSimulationStore.getState().init(golf)
  useSimulationStore.getState().setDrivingMode('eco')
  assert.strictEqual(useSimulationStore.getState().drivingMode, 'eco')

  // Em aceleração normal no modo ECO com 2500 RPM, quer subir marcha
  const decisionNormal = autoTrans.decide({
    currentRpm: 2500,
    vehicleSpeedKmh: 40,
    throttle: 0.3,
    brake: 0,
    currentGear: 2,
    drivingMode: 'eco',
    deltaTime: 1.0,
  })
  assert.strictEqual(decisionNormal.targetGear, 3, 'No ECO sob aceleração leve sobe marcha aos 2500 RPM')

  // Agora pisando fundo (throttle = 1.0) em 5500 RPM no modo ECO:
  // NÃO deve subir antes de chegar na faixa de alta potência (~6200+ RPM)
  const decisionWot = autoTrans.decide({
    currentRpm: 5500,
    vehicleSpeedKmh: 75,
    throttle: 1.0,
    brake: 0,
    currentGear: 2,
    drivingMode: 'eco',
    deltaTime: 1.0,
  })
  assert.strictEqual(decisionWot.targetGear, 2, 'Pisando fundo (WOT), segura a 2ª marcha a 5500 RPM mesmo em ECO!')

  // Quando atinge 6400 RPM no kickdown:
  const decisionRedline = autoTrans.decide({
    currentRpm: 6420,
    vehicleSpeedKmh: 88,
    throttle: 1.0,
    brake: 0,
    currentGear: 2,
    drivingMode: 'eco',
    deltaTime: 1.0,
  })
  assert.strictEqual(decisionRedline.targetGear, 3, 'Sobe marcha no redline / pico de potência')

  // O drivingMode na store permaneceu estritamente 'eco'!
  assert.strictEqual(useSimulationStore.getState().drivingMode, 'eco', 'Modo de condução continua ECO sem ser corrompido para sport')
})

// ─── TESTE 3: Redução no Normal desce em ~2000 RPM e no Sport em ~4000 RPM ───
runTest('Troca automática reduz marcha ao descer de 2.000 RPM no Normal e 4.000 RPM no Sport', () => {
  const golf = loadVehicle('golf-gti')
  const autoTrans = new AutomaticTransmission({
    gearRatios: golf.transmission.gearRatios,
    finalDrive: golf.transmission.finalDrive,
    wheelDiameter: golf.info.wheelDiameter,
    maxRpm: golf.engine.maxRpm,
    idleRpm: golf.engine.idleRpm,
  })

  // 3.1: MODO NORMAL
  // Em 3ª marcha a 45 km/h -> RPM é ~1950 (abaixo de 2000 RPM)
  // Projetado na 2ª marcha a 45 km/h -> ~3070 RPM (abaixo do redline de 6800 RPM)
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

  // 3.2: MODO SPORT
  // Em 3ª marcha a 85 km/h -> RPM é ~3900 (abaixo de ~4000 RPM)
  // Projetado na 2ª marcha a 85 km/h -> ~6150 RPM (seguro, < 6800 * 0.94 = 6392 RPM)
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

// ─── TESTE 4: Yaris CVT simula relações esticadas no Kickdown ───
runTest('Yaris CVT estica relações virtuais para o pico de 5.600+ RPM no Kickdown', () => {
  const yaris = loadVehicle('yaris-2019')
  const autoTrans = new AutomaticTransmission({
    gearRatios: yaris.transmission.gearRatios,
    finalDrive: yaris.transmission.finalDrive,
    wheelDiameter: yaris.info.wheelDiameter,
    maxRpm: yaris.engine.maxRpm,
    idleRpm: yaris.engine.idleRpm,
    isCvt: true,
  })

  // Pisou fundo a 4800 RPM: segura a relação virtual
  const cvtHold = autoTrans.decide({
    currentRpm: 4800,
    vehicleSpeedKmh: 50,
    throttle: 1.0,
    brake: 0,
    currentGear: 2,
    drivingMode: 'normal',
    deltaTime: 1.0,
  })
  assert.strictEqual(cvtHold.targetGear, 2, 'Yaris CVT segura giro a 4800 RPM no kickdown')

  // Ao atingir 5700 RPM (pico de potência do 1.5 16V): sobe relação
  const cvtShift = autoTrans.decide({
    currentRpm: 5750,
    vehicleSpeedKmh: 65,
    throttle: 1.0,
    brake: 0,
    currentGear: 2,
    drivingMode: 'normal',
    deltaTime: 1.0,
  })
  assert.strictEqual(cvtShift.targetGear, 3, 'Yaris CVT troca relação virtual acima de 5600 RPM no kickdown')
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

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════\n')

if (failed > 0) process.exit(1)
