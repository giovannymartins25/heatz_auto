import { AutomaticTransmission } from './src/systems/transmission/AutomaticTransmission'
import type { AutomaticTransmissionConfig } from './src/systems/transmission/AutomaticTransmission'

console.log('═══════════════════════════════════════════════════════════════════')
console.log('  TESTE DE VALIDAÇÃO: TROCAS NO CORTE DE GIRO (MODO S + SPORT)     ')
console.log('═══════════════════════════════════════════════════════════════════\n')

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ PASSOU | ${name}`)
    passed++
  } catch (err) {
    console.error(`✗ FALHOU | ${name}`)
    console.error(`  Erro: ${(err as Error).message}`)
    failed++
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg)
}

// ─── 1. GOLF GTI 2.0 TSI (EA888, DSG 6) ───
// maxRpm: 6800, revLimiter: 6800, maxPowerRpm: 6200
const golfGtiConfig: AutomaticTransmissionConfig = {
  gearRatios: [
    { gear: 1, ratio: 3.46 },
    { gear: 2, ratio: 2.05 },
    { gear: 3, ratio: 1.30 },
    { gear: 4, ratio: 0.90 },
    { gear: 5, ratio: 0.91 },
    { gear: 6, ratio: 0.76 },
  ],
  finalDrive: 4.06,
  wheelDiameter: 0.63,
  maxRpm: 6800,
  idleRpm: 800,
  revLimiter: 6800,
}

test('Golf GTI: D + NORMAL troca em rotação civil confortável (~2.800-3.200 RPM)', () => {
  const trans = new AutomaticTransmission(golfGtiConfig)
  
  // A 3.200 RPM em 2ª marcha com acelerador moderado (0.45)
  const decision = trans.decide({
    currentRpm: 3200,
    vehicleSpeedKmh: 45,
    throttle: 0.45,
    brake: 0,
    currentGear: 2,
    drivingMode: 'normal',
    selectorPosition: 'D',
    maxPowerRpm: 6200,
    revLimiter: 6800,
    deltaTime: 0.016,
  })

  assert(decision.targetGear === 3, `Deveria subir para 3ª marcha aos 3.200 RPM em D+Normal (obteve: ${decision.targetGear})`)
})

test('Golf GTI: D + SPORT ou S + NORMAL troca esportivamente (~5.500-6.000 RPM) sem ir ao corte', () => {
  const trans = new AutomaticTransmission(golfGtiConfig)
  
  // A 5.400 RPM com throttle 1.0 em S + NORMAL ainda não deve trocar
  const decisionBefore = trans.decide({
    currentRpm: 5400,
    vehicleSpeedKmh: 75,
    throttle: 1.0,
    brake: 0,
    currentGear: 2,
    drivingMode: 'normal',
    selectorPosition: 'S',
    maxPowerRpm: 6200,
    revLimiter: 6800,
    deltaTime: 0.016,
  })
  assert(decisionBefore.targetGear === 2, `Em S+Normal a 5400 RPM ainda deve segurar marcha (obteve: ${decisionBefore.targetGear})`)

  // A 6.000 RPM já sobe marcha em S + NORMAL
  const decisionAfter = trans.decide({
    currentRpm: 6000,
    vehicleSpeedKmh: 85,
    throttle: 1.0,
    brake: 0,
    currentGear: 2,
    drivingMode: 'normal',
    selectorPosition: 'S',
    maxPowerRpm: 6200,
    revLimiter: 6800,
    deltaTime: 0.016,
  })
  assert(decisionAfter.targetGear === 3, `Em S+Normal a 6000 RPM deve subir para 3ª (obteve: ${decisionAfter.targetGear})`)
})

test('Golf GTI: S + SPORT segura e NÃO troca em 6.000 nem 6.500 RPM', () => {
  const trans = new AutomaticTransmission(golfGtiConfig)
  
  // A 6.000 RPM em S + SPORT: segura marcha
  const dec6000 = trans.decide({
    currentRpm: 6000,
    vehicleSpeedKmh: 85,
    throttle: 1.0,
    brake: 0,
    currentGear: 2,
    drivingMode: 'sport',
    selectorPosition: 'S',
    maxPowerRpm: 6200,
    revLimiter: 6800,
    deltaTime: 0.016,
  })
  assert(dec6000.targetGear === 2, `Em S+Sport a 6000 RPM NÃO deve subir (obteve: ${dec6000.targetGear})`)

  // A 6.600 RPM em S + SPORT: ainda segura marcha
  const dec6600 = trans.decide({
    currentRpm: 6600,
    vehicleSpeedKmh: 93,
    throttle: 1.0,
    brake: 0,
    currentGear: 2,
    drivingMode: 'sport',
    selectorPosition: 'S',
    maxPowerRpm: 6200,
    revLimiter: 6800,
    deltaTime: 0.016,
  })
  assert(dec6600.targetGear === 2, `Em S+Sport a 6600 RPM NÃO deve subir antes do corte (obteve: ${dec6600.targetGear})`)
})

test('Golf GTI: S + SPORT dispara troca EXATAMENTE na rotação de corte (>= 6.775 RPM)', () => {
  const trans = new AutomaticTransmission(golfGtiConfig)
  
  // A 6.780 RPM em S + SPORT (bravíssimo no corte de 6.800 RPM): dispara o upshift!
  const decCutoff = trans.decide({
    currentRpm: 6780,
    vehicleSpeedKmh: 95,
    throttle: 1.0,
    brake: 0,
    currentGear: 2,
    drivingMode: 'sport',
    selectorPosition: 'S',
    maxPowerRpm: 6200,
    revLimiter: 6800,
    deltaTime: 0.016,
  })
  assert(decCutoff.targetGear === 3, `Em S+Sport no corte (6780 RPM) DEVE subir para 3ª (obteve: ${decCutoff.targetGear})`)
})

// ─── 2. PORSCHE 911 GT3 (PDK 7) ───
// maxRpm: 7400, revLimiter: 7200, maxPowerRpm: 6750
const porscheConfig: AutomaticTransmissionConfig = {
  gearRatios: [
    { gear: 1, ratio: 3.75 },
    { gear: 2, ratio: 2.38 },
    { gear: 3, ratio: 1.72 },
    { gear: 4, ratio: 1.34 },
    { gear: 5, ratio: 1.11 },
    { gear: 6, ratio: 0.96 },
    { gear: 7, ratio: 0.84 },
  ],
  finalDrive: 3.44,
  wheelDiameter: 0.69,
  maxRpm: 7400,
  idleRpm: 850,
  revLimiter: 7200,
}

test('Porsche GT3: S + SPORT / TRACK troca no limitador de 7.200 RPM (a 7.180 RPM)', () => {
  const trans = new AutomaticTransmission(porscheConfig)
  
  // A 6.900 RPM: não troca ainda
  const dec6900 = trans.decide({
    currentRpm: 6900,
    vehicleSpeedKmh: 120,
    throttle: 1.0,
    brake: 0,
    currentGear: 2,
    drivingMode: 'track',
    selectorPosition: 'S',
    maxPowerRpm: 6750,
    revLimiter: 7200,
    deltaTime: 0.016,
  })
  assert(dec6900.targetGear === 2, `Porsche em S+Track a 6900 RPM deve segurar (obteve: ${dec6900.targetGear})`)

  // A 7.180 RPM: dispara troca no corte
  const decCutoff = trans.decide({
    currentRpm: 7180,
    vehicleSpeedKmh: 125,
    throttle: 1.0,
    brake: 0,
    currentGear: 2,
    drivingMode: 'track',
    selectorPosition: 'S',
    maxPowerRpm: 6750,
    revLimiter: 7200,
    deltaTime: 0.016,
  })
  assert(decCutoff.targetGear === 3, `Porsche em S+Track a 7180 RPM DEVE subir marcha no limitador (obteve: ${decCutoff.targetGear})`)
})

// ─── 3. FIAT TORO RANCH 2.2 TURBODIESEL (ZF 9HP) ───
// maxRpm: 4800, revLimiter: 4800, maxPowerRpm: 3500
const toroRanchConfig: AutomaticTransmissionConfig = {
  gearRatios: [
    { gear: 1, ratio: 4.70 },
    { gear: 2, ratio: 2.84 },
    { gear: 3, ratio: 1.91 },
    { gear: 4, ratio: 1.38 },
    { gear: 5, ratio: 1.00 },
    { gear: 6, ratio: 0.81 },
    { gear: 7, ratio: 0.70 },
    { gear: 8, ratio: 0.58 },
    { gear: 9, ratio: 0.48 },
  ],
  finalDrive: 4.33,
  wheelDiameter: 0.70,
  maxRpm: 4800,
  idleRpm: 700,
  revLimiter: 4800,
}

test('Fiat Toro Ranch: S + SPORT estica o motor Turbodiesel até o corte (4.780 RPM)', () => {
  const trans = new AutomaticTransmission(toroRanchConfig)
  
  // A 4.200 RPM em S + SPORT: não troca ainda
  const dec4200 = trans.decide({
    currentRpm: 4200,
    vehicleSpeedKmh: 65,
    throttle: 1.0,
    brake: 0,
    currentGear: 3,
    drivingMode: 'sport',
    selectorPosition: 'S',
    maxPowerRpm: 3500,
    revLimiter: 4800,
    deltaTime: 0.016,
  })
  assert(dec4200.targetGear === 3, `Toro Ranch em S+Sport a 4200 RPM deve segurar (obteve: ${dec4200.targetGear})`)

  // A 4.780 RPM: dispara troca no corte máximo de giro diesel
  const decCutoff = trans.decide({
    currentRpm: 4780,
    vehicleSpeedKmh: 75,
    throttle: 1.0,
    brake: 0,
    currentGear: 3,
    drivingMode: 'sport',
    selectorPosition: 'S',
    maxPowerRpm: 3500,
    revLimiter: 4800,
    deltaTime: 0.016,
  })
  assert(decCutoff.targetGear === 4, `Toro Ranch em S+Sport no corte (4780 RPM) DEVE subir para 4ª (obteve: ${decCutoff.targetGear})`)
})

console.log('\n═══════════════════════════════════════════════════════════════════')
console.log(` RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════════')

if (failed > 0) {
  process.exit(1)
}
