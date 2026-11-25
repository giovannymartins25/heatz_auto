import assert from 'assert'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { useGarageStore, createDefaultUpgrades } from './src/stores/useGarageStore'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { AutomaticTransmission } from './src/systems/transmission/AutomaticTransmission'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { resolveVehicleMultimediaSpec } from './src/systems/vehicle/vehicleResolvers'
import { MULTIMEDIA_REGISTRY } from './src/components/dashboard/infotainment/multimediaRegistry'
import type { VehicleConfig } from './src/types'

function loadConfig(vehicleId: string): VehicleConfig {
  const fullPath = resolve(process.cwd(), 'public/vehicles', vehicleId, 'config.json')
  return JSON.parse(readFileSync(fullPath, 'utf-8'))
}

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ PASSOU | ${name}`)
    passed++
  } catch (err: any) {
    console.error(`✗ FALHOU | ${name}`)
    console.error(' ', err.message || err)
    failed++
  }
}

console.log('═══════════════════════════════════════════════════════════════════')
console.log(' HEATZ AUTO — VALIDAÇÃO DA REVISÃO FASE 2 + OFICINA & CÂMBIO       ')
console.log('═══════════════════════════════════════════════════════════════════\n')

// ─────────────────────────────────────────────────────────────────
// 1. ISOLAMENTO E ROTEAMENTO DAS MULTIMÍDIAS (BLOCO 2)
// ─────────────────────────────────────────────────────────────────
console.log('▶ [1/6] Auditoria de Roteamento e Isolamento das Centrais Multimídia')

test('Honda CB1000R: Painel TFT exclusivo, sem central multimídia e sem gesto de swipe', () => {
  const cbConfig = loadConfig('cb1000r')
  assert.strictEqual(cbConfig.info.category, 'motorcycle')
  assert.strictEqual(cbConfig.dashboard?.hasInfotainment, false)
  const upgrades = createDefaultUpgrades('cb1000r')
  assert.strictEqual(upgrades.multimediaKit, false)
})

test('Porsche 911 GT3: PCM 6.0 oficial com suporte widescreen fill e aerodinâmica ativa', () => {
  const pcmFile = readFileSync(resolve(process.cwd(), 'src/components/dashboard/infotainment/PorschePCM6.tsx'), 'utf-8')
  assert.ok(pcmFile.includes('fill?: boolean'), 'PorschePCM6 deve suportar prop fill fluido')
  assert.ok(pcmFile.includes('setAeroWing(false)'), 'PorschePCM6 possui botão para recolher a asa')
  assert.ok(pcmFile.includes('setAeroWing(true)'), 'PorschePCM6 possui botão para elevar a asa')
  assert.ok(pcmFile.includes('setRearWingPosition(\'low_drag\')'), 'PorschePCM6 ajusta Low Drag')
  assert.ok(pcmFile.includes('setRearWingPosition(\'high_downforce\')'), 'PorschePCM6 ajusta High Downforce')
})

test('Honda Civic Si: H-Audio 2-DIN OEM sem parâmetros vazados de turbo de Gol', () => {
  const civicFile = readFileSync(resolve(process.cwd(), 'src/components/dashboard/infotainment/CivicSiInfotainment.tsx'), 'utf-8')
  assert.ok(civicFile.includes('fill?: boolean'), 'CivicSiInfotainment deve suportar prop fill')
  assert.ok(civicFile.includes('5800'), 'CivicSi exibe telemetria i-VTEC aos 5.800 RPM')
  assert.ok(!civicFile.includes('hasTurbo = useSimulationStore'), 'CivicSi não deve vazar hasTurbo de outros carros')
  assert.ok(!civicFile.includes('setTuningStage'), 'CivicSi não deve ter botões de oficina vazados')
})

test('Golf GTI: Discover Pro 8" com Sport HMI integrado sem botões de oficina vazados', () => {
  const golfFile = readFileSync(resolve(process.cwd(), 'src/components/dashboard/infotainment/GolfGTIDiscoverPro.tsx'), 'utf-8')
  assert.ok(golfFile.includes('fill?: boolean'), 'Discover Pro deve suportar prop fill')
  assert.ok(golfFile.includes('Sport HMI'), 'Discover Pro exibe Sport HMI')
  assert.ok(!golfFile.includes('PREPARAÇÃO STG'), 'Discover Pro não deve exibir botões de oficina')
})

test('Fiat Toro: Endurance (7" FWD) e Ranch (10.1" Vertical 4x4) mantêm componentes próprios', () => {
  const routerFile = readFileSync(resolve(process.cwd(), 'src/components/dashboard/infotainment/VehicleMultimedia.tsx'), 'utf-8')
  const endurance = resolveVehicleMultimediaSpec(loadConfig('fiat-toro-endurance-2025'))
  const ranch = resolveVehicleMultimediaSpec(loadConfig('fiat-toro-ranch-2025'))
  assert.ok(routerFile.includes('resolveVehicleMultimediaSpec') && routerFile.includes('resolveMultimediaEntry'), 'VehicleMultimedia usa resolução declarativa e registro dedicado')
  assert.strictEqual(endurance.unitId, 'toro_uconnect_7')
  assert.strictEqual(ranch.unitId, 'toro_uconnect_10_vertical')
  const enduranceComponent = MULTIMEDIA_REGISTRY[endurance.unitId].component
  const ranchComponent = MULTIMEDIA_REGISTRY[ranch.unitId].component
  assert.notStrictEqual(enduranceComponent, 'generic')
  assert.notStrictEqual(ranchComponent, 'generic')
  assert.notStrictEqual(enduranceComponent, ranchComponent, 'Toro Endurance e Ranch mantêm unidades React próprias')
})

// ─────────────────────────────────────────────────────────────────
// 2. OFICINA & UPGRADES SEPARADOS (BLOCO 3)
// ─────────────────────────────────────────────────────────────────
console.log('\n▶ [2/6] Oficina: Turbo Básico em Aspirados & Internos de Motor Separados')

test('Carro aspirado pode equipar Kit Turbo Básico (+0.4 bar) sem exigir motor forjado', () => {
  const modalFile = readFileSync(resolve(process.cwd(), 'src/components/tuning/TuningGarageModal.tsx'), 'utf-8')
  assert.ok(modalFile.includes('Kit Turbo Básico de Rua (+0.45 bar)'), 'Oficina possui Kit Turbo Básico de rua (+0.45 bar)')
  assert.ok(modalFile.includes('Instalação em motores aspirados!'), 'Deixa explícito que pode instalar em aspirados sem exigir motor forjado')
  assert.ok(modalFile.includes('Pistões & Bielas Forjadas'), 'Possui opção separada de motor forjado')
  assert.ok(modalFile.includes('Internos Reforçados ARP'), 'Possui opção de internos reforçados')
})

test('Aba dedicada de Multimídia na Oficina com tratamento para motos, OEM e analógicos', () => {
  const modalFile = readFileSync(resolve(process.cwd(), 'src/components/tuning/TuningGarageModal.tsx'), 'utf-8')
  assert.ok(modalFile.includes('activeTab === \'multimidia\''), 'Oficina possui aba multimidia dedicada')
  assert.ok(modalFile.includes('Incompatível com centrais multimídia automotivas'), 'Bloqueia moto com aviso amigável')
  assert.ok(modalFile.includes('CENTRAL MULTIMÍDIA ORIGINAL DE FÁBRICA (OEM)'), 'Reconhece centrais de fábrica')
  assert.ok(modalFile.includes('Central Multimídia 2-DIN Retrofit'), 'Oferece kit 2-DIN para analógicos')
})

// ─────────────────────────────────────────────────────────────────
// 3. AERODINÂMICA REAL & AEROFÓLIOS (BLOCO 4)
// ─────────────────────────────────────────────────────────────────
console.log('\n▶ [3/6] Aerodinâmica: Downforce vs Arrasto F_drag nos Aerofólios')

test('Física calcula arrasto e downforce proporcionais ao equipamento de aerofólio', () => {
  const physics = new VehiclePhysics({
    weight: 1400,
    wheelDiameter: 0.65,
    vehicleId: 'golf-gti',
  })

  // Sem aerofólio: arrasto base mínimo
  physics.setAerodynamics('balanced', true, 'none')
  const aeroNone = physics.getEffectiveAeroConstant()

  // Spoiler ducktail esportivo: mais arrasto (+8%) e mais downforce
  physics.setAerodynamics('balanced', true, 'aftermarket')
  const aeroDucktail = physics.getEffectiveAeroConstant()
  assert.ok(aeroDucktail > aeroNone, 'Spoiler Ducktail gera maior arrasto do que sem aerofólio')

  // Asa alta Motorsport GT: arrasto ainda maior (+24%)
  physics.setAerodynamics('balanced', true, 'sport_gt')
  const aeroGT = physics.getEffectiveAeroConstant()
  assert.ok(aeroGT > aeroDucktail, 'Asa Motorsport GT gera maior arrasto aerodinâmico para maximizar downforce')
})

test('Porsche 911 GT3 RS mantém aerodinâmica ativa com controles Low Drag e High Downforce', () => {
  const physics = new VehiclePhysics({
    weight: 1450,
    wheelDiameter: 0.68,
    vehicleId: 'porsche-gt3',
  })

  physics.setAerodynamics('low_drag', true)
  const dragLow = physics.getEffectiveAeroConstant()

  physics.setAerodynamics('high_downforce', true)
  const dragHigh = physics.getEffectiveAeroConstant()

  assert.ok(dragHigh > dragLow * 1.4, 'High Downforce gera significativamente mais resistência do que Low Drag na Porsche')
})

// ─────────────────────────────────────────────────────────────────
// 4. CÂMBIO MANUAL E SELETOR AUTOMÁTICO MOBILE (BLOCO 5)
// ─────────────────────────────────────────────────────────────────
console.log('\n▶ [4/6] Controles: Remoção de Alternância de Grade e Layout Sem Sobreposição')

test('GearShift remove botões de inversão de layout e mantém cabeçalho limpo sem sobreposição', () => {
  const gearShiftFile = readFileSync(resolve(process.cwd(), 'src/components/controls/GearShift.tsx'), 'utf-8')
  assert.ok(!gearShiftFile.includes('⚙️ GRADE H'), 'Botão de alternância GRADE H deve ter sido removido')
  assert.ok(gearShiftFile.includes('CÂMBIO AUTO'), 'Contém cabeçalho CÂMBIO AUTO')
  assert.ok(gearShiftFile.includes('activeLabel'), 'Exibe activeLabel em badge separado')
})

test('HPatternShifter remove botão confuso SEQ (+/-) do rodapé', () => {
  const hPatternFile = readFileSync(resolve(process.cwd(), 'src/components/controls/HPatternShifter.tsx'), 'utf-8')
  assert.ok(!hPatternFile.includes('SEQ (+/-)'), 'Botão SEQ (+/-) deve ter sido removido de HPatternShifter')
})

// ─────────────────────────────────────────────────────────────────
// 5. TRANSMISSÃO DA FIAT TORO RANCH ZF 9HP (BLOCO 6)
// ─────────────────────────────────────────────────────────────────
console.log('\n▶ [5/6] Transmissão: Fiat Toro Ranch ZF 9HP em D, S e 4WD LOW')

test('Fiat Toro Ranch: Em D sob condução suave (< 8 km/h, throttle <= 0.50), arranca em 2ª marcha', () => {
  const ranchConfig = loadConfig('fiat-toro-ranch-2025')
  const at = new AutomaticTransmission({
    gearRatios: ranchConfig.transmission.gearRatios,
    finalDrive: ranchConfig.transmission.finalDrive,
    maxRpm: ranchConfig.engine.maxRpm,
    idleRpm: ranchConfig.engine.idleRpm,
    shiftUpRpm: ranchConfig.transmission.automatic?.shiftUpRpm ?? 3600,
    shiftDownRpm: ranchConfig.transmission.automatic?.shiftDownRpm ?? 1800,
    wheelDiameter: ranchConfig.chassis.wheelDiameter,
    clutchPackEngagementTimeSeconds: 0.15,
  })

  // Partida suave em D: engata 2ª marcha
  const decisionSmooth = at.decide({
    currentRpm: 1200,
    vehicleSpeedKmh: 4,
    throttle: 0.20,
    brake: 0,
    currentGear: 1,
    drivingMode: 'normal',
    selectorPosition: 'D',
    fourWheelDriveMode: 'auto',
    deltaTime: 0.05,
  })

  assert.strictEqual(decisionSmooth.targetGear, 2, 'Toro Ranch em D suave deve manter 2ª marcha para economia')
})

test('Fiat Toro Ranch: Em D sob aceleração forte (throttle > 0.50), permite redução e arrancada em 1ª', () => {
  const ranchConfig = loadConfig('fiat-toro-ranch-2025')
  const at = new AutomaticTransmission({
    gearRatios: ranchConfig.transmission.gearRatios,
    finalDrive: ranchConfig.transmission.finalDrive,
    maxRpm: ranchConfig.engine.maxRpm,
    idleRpm: ranchConfig.engine.idleRpm,
    shiftUpRpm: ranchConfig.transmission.automatic?.shiftUpRpm ?? 3600,
    shiftDownRpm: ranchConfig.transmission.automatic?.shiftDownRpm ?? 1800,
    wheelDiameter: ranchConfig.chassis.wheelDiameter,
    clutchPackEngagementTimeSeconds: 0.15,
  })

  // Se o motorista pisar fundo (throttle 0.85) em baixa velocidade com marcha 2, permite redução para 1ª
  const decisionKick = at.decide({
    currentRpm: 1400,
    vehicleSpeedKmh: 5,
    throttle: 0.85,
    brake: 0,
    currentGear: 2,
    drivingMode: 'normal',
    selectorPosition: 'D',
    fourWheelDriveMode: 'auto',
    deltaTime: 0.05,
  })

  assert.strictEqual(decisionKick.targetGear, 1, 'Toro Ranch sob aceleração forte em D reduz para 1ª para arranque vigoroso')
})

test('Fiat Toro Ranch: Em modo S (Sport), reduz para 1ª marcha ao desacelerar/parar (< 10 km/h)', () => {
  const ranchConfig = loadConfig('fiat-toro-ranch-2025')
  const at = new AutomaticTransmission({
    gearRatios: ranchConfig.transmission.gearRatios,
    finalDrive: ranchConfig.transmission.finalDrive,
    maxRpm: ranchConfig.engine.maxRpm,
    idleRpm: ranchConfig.engine.idleRpm,
    shiftUpRpm: ranchConfig.transmission.automatic?.shiftUpRpm ?? 3600,
    shiftDownRpm: ranchConfig.transmission.automatic?.shiftDownRpm ?? 1800,
    wheelDiameter: ranchConfig.chassis.wheelDiameter,
    clutchPackEngagementTimeSeconds: 0.15,
  })

  // Desacelerando no modo S: velocidade cai abaixo de 10 km/h
  const decisionSport = at.decide({
    currentRpm: 1300,
    vehicleSpeedKmh: 7,
    throttle: 0,
    brake: 0.4,
    currentGear: 2,
    drivingMode: 'sport',
    selectorPosition: 'S',
    fourWheelDriveMode: 'auto',
    deltaTime: 0.05,
  })

  assert.strictEqual(decisionSport.targetGear, 1, 'Toro Ranch em S deve reduzir para 1ª ao parar para arrancada esportiva')
})

test('Fiat Toro Endurance (AT6): Continua arrancando em 1ª marcha sem crawler', () => {
  const enduranceConfig = loadConfig('fiat-toro-endurance-2025')
  const at = new AutomaticTransmission({
    gearRatios: enduranceConfig.transmission.gearRatios,
    finalDrive: enduranceConfig.transmission.finalDrive,
    maxRpm: enduranceConfig.engine.maxRpm,
    idleRpm: enduranceConfig.engine.idleRpm,
    shiftUpRpm: enduranceConfig.transmission.automatic?.shiftUpRpm ?? 3400,
    shiftDownRpm: enduranceConfig.transmission.automatic?.shiftDownRpm ?? 1600,
    wheelDiameter: enduranceConfig.chassis.wheelDiameter,
    clutchPackEngagementTimeSeconds: 0.15,
  })

  const decision = at.decide({
    currentRpm: 1200,
    vehicleSpeedKmh: 4,
    throttle: 0.20,
    brake: 0,
    currentGear: 1,
    drivingMode: 'normal',
    selectorPosition: 'D',
    fourWheelDriveMode: 'auto',
    deltaTime: 0.05,
  })

  assert.strictEqual(decision.targetGear, 1, 'Toro Endurance AT6 deve permanecer em 1ª marcha normalmente')
})

// ─────────────────────────────────────────────────────────────────
// 6. SWIPE E COCKPIT (BLOCO 7)
// ─────────────────────────────────────────────────────────────────
console.log('\n▶ [6/6] Cockpit: Swipe com Deslocamento Robusto e PointerCancel')

test('SwipeableClusterMediaSlot honra gestos significativos mesmo com eventos de pointercancel', () => {
  const slotFile = readFileSync(resolve(process.cwd(), 'src/components/dashboard/SwipeableClusterMediaSlot.tsx'), 'utf-8')
  assert.ok(slotFile.includes('if (cancelled && Math.abs(dx) < SWIPE_THRESHOLD) return'), 'Honra swipe >= 40px mesmo em cancelamento de ponteiro')
  assert.ok(slotFile.includes('vehicle.info.category === \'motorcycle\' || vehicle.id === \'cb1000r\''), 'CB1000R não tem swipe')
})

console.log('\n═══════════════════════════════════════════════════════════════════')
console.log(` RESULTADO FINAL: ${passed} PASSARAM | ${failed} FALHARAM`)
console.log('═══════════════════════════════════════════════════════════════════\n')

if (failed > 0) {
  process.exit(1)
}
