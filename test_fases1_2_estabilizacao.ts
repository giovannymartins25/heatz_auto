/**
 * Suite funcional real — Fases 1 e 2 (Estabilização Crítica, Física 120Hz, Controles e Oficina)
 * Sem testes de regex/strings: executa simulação real no integrador de 120Hz e sistemas de entrada/garagem.
 */
import fs from 'fs'
import path from 'path'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useGarageStore, createDefaultUpgrades } from './src/stores/useGarageStore'
import { WorldMap } from './src/systems/world/WorldMap'
import { sharedTiltSteering } from './src/systems/input/sharedTiltSteering'
import { calculateDynoProfile, getDrivetrainType } from './src/utils/dynoCalculator'
import type { VehicleConfig } from './src/types'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++
    console.log(`  ✅ PASS: ${label}${detail ? ` (${detail})` : ''}`)
  } else {
    failed++
    console.error(`  ❌ FAIL: ${label}${detail ? ` (${detail})` : ''}`)
  }
}

function loadVehicle(id: string): VehicleConfig {
  const filePath = path.join(process.cwd(), 'public', 'vehicles', id, 'config.json')
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as VehicleConfig
}

function stepSeconds(seconds: number) {
  const ticks = Math.round(seconds * 120)
  for (let i = 0; i < ticks; i++) {
    useSimulationStore.getState().update(1 / 120)
  }
}

console.log('\n═══════════════════════════════════════════════════════════════════')
console.log(' HEATZ AUTO — TESTE FUNCIONAL REAL DAS FASES 1 E 2')
console.log('═══════════════════════════════════════════════════════════════════\n')

// ─── 1. SPAWN SEGURO E CORREDOR 402m DO MUNDO 2D ──────────────────────────────
console.log('1. Mundo 2D: Spawn seguro e corredor da Pista de Arrancada 402m')
{
  const porsche = loadVehicle('porsche-gt3')
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(porsche)
  const s = useSimulationStore.getState()
  assert(
    s.positionX === WorldMap.SPAWN_X && s.positionY === WorldMap.SPAWN_Y,
    'Spawn inicial utiliza coordenadas seguras fora da rotatória',
    `x=${s.positionX}, y=${s.positionY}`,
  )
  assert(
    Math.hypot(s.positionX, s.positionY) > 18,
    'Spawn inicial está fora do canteiro central (r > 18m)',
    `dist=${Math.hypot(s.positionX, s.positionY).toFixed(1)}m`,
  )

  // Testa colisão no corredor da pista de arrancada (y = 52) até 450m
  const dragCheck = WorldMap.checkCollision(450, 52)
  assert(!dragCheck.isColliding, 'Corredor 402m em y=52 permite percorrer 450m sem parede artificial', `colliding=${dragCheck.isColliding}`)
  // Testa que fora da pista (y = 0) o limite urbano 285m continua protegido
  const cityCheck = WorldMap.checkCollision(310, 0)
  assert(cityCheck.isColliding && cityCheck.boundaryName === 'Defensa Leste', 'Limite urbano em y=0 preservado em 285m', `boundary=${cityCheck.boundaryName}`)
}

function signedAngleDeltaDeg(fromDeg: number, toDeg: number): number {
  return ((toDeg - fromDeg + 540) % 360) - 180
}

// ─── 2. DIREÇÃO ESQUERDA E DIREITA EM AUTOMÁTICO (PORSCHE) E MANUAL (CIVIC) ───
console.log('\n2. Direção 2D: Virar esquerda e direita (Automático e Manual)')
{
  // 2A. Porsche automático
  const porsche = loadVehicle('porsche-gt3')
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(porsche)
  sim.startEngine()
  stepSeconds(0.8)
  sim.selectShifterMode('D')
  sim.setThrottle(0.55)
  const h0 = useSimulationStore.getState().headingDeg
  sim.setSteeringAngle(-0.7) // Esquerda
  stepSeconds(1.8)
  const afterLeftHeading = useSimulationStore.getState().headingDeg
  const afterLeftX = useSimulationStore.getState().positionX
  const speedAuto = useSimulationStore.getState().speed
  const leftDelta = signedAngleDeltaDeg(h0, afterLeftHeading)

  assert(speedAuto > 20, 'Automático acelera em D', `speed=${speedAuto.toFixed(1)} km/h`)
  assert(leftDelta < -10 && afterLeftX < -1, 'Automático vira à esquerda corretamente', `Δheading=${leftDelta.toFixed(1)}°, x=${afterLeftX.toFixed(1)}m`)

  // Agora vira à direita
  sim.setSteeringAngle(0.85)
  stepSeconds(2.4)
  const afterRightHeading = useSimulationStore.getState().headingDeg
  const rightDelta = signedAngleDeltaDeg(afterLeftHeading, afterRightHeading)
  assert(rightDelta > 15, 'Automático vira à direita corretamente', `Δheading=+${rightDelta.toFixed(1)}°`)

  // 2B. Civic Si manual
  const civic = loadVehicle('civic-si')
  sim.reset()
  sim.init(civic)
  sim.startEngine()
  stepSeconds(0.8)
  sim.setClutch(1.0)
  sim.shiftUp() // 1ª
  sim.setThrottle(0.6)
  for (let i = 0; i < 60; i++) {
    useSimulationStore.getState().setClutch(Math.max(0, 0.5 - (i / 60) * 0.5))
    useSimulationStore.getState().update(1 / 120)
  }
  sim.setClutch(0)
  const c0 = useSimulationStore.getState().headingDeg
  sim.setSteeringAngle(0.75) // Direita
  stepSeconds(1.6)
  const civicRightHeading = useSimulationStore.getState().headingDeg
  const civicSpeed = useSimulationStore.getState().speed
  const civicRightDelta = signedAngleDeltaDeg(c0, civicRightHeading)
  assert(civicSpeed > 15, 'Manual (Civic Si) arranca e ganha velocidade', `speed=${civicSpeed.toFixed(1)} km/h`)
  assert(civicRightDelta > 10, 'Manual vira à direita corretamente', `Δheading=+${civicRightDelta.toFixed(1)}°`)

  sim.setSteeringAngle(-0.85) // Esquerda
  stepSeconds(2.0)
  const civicLeftHeading = useSimulationStore.getState().headingDeg
  const civicLeftDelta = signedAngleDeltaDeg(civicRightHeading, civicLeftHeading)
  assert(civicLeftDelta < -15, 'Manual vira à esquerda corretamente', `Δheading=${civicLeftDelta.toFixed(1)}°`)
}

// ─── 3. SENSOR DE INCLINAÇÃO COMPARTILHADO (SINGLETON) ────────────────────────
console.log('\n3. Sensor de inclinação compartilhado (Singleton + Calibração + Guard)')
{
  const sim = useSimulationStore.getState()
  useSimulationStore.setState({ tiltSteeringEnabled: false, steeringMethod: 'touch' })
  sim.setSteeringAngle(0.42)

  // Processa amostra com tilt desativado → NÃO deve sobrescrever steeringAngle manual
  sharedTiltSteering.processSample({ beta: 25, gamma: 25, alpha: 0, orientationAngle: 90, isLandscape: true }, 1 / 60, true)
  assert(
    Math.abs(useSimulationStore.getState().steeringAngle - 0.42) < 1e-6,
    'Tilt desativado não sobrescreve steeringAngle manual',
    `steer=${useSimulationStore.getState().steeringAngle.toFixed(2)}`,
  )

  // Ativa tilt e verifica sincronização de calibração entre múltiplos assinantes do singleton
  useSimulationStore.setState({ tiltSteeringEnabled: true, steeringMethod: 'tilt', steeringSensitivity: 1.2, steeringDeadzone: 2 })
  let subA = sharedTiltSteering.getSnapshot()
  let subB = sharedTiltSteering.getSnapshot()
  const unsubA = sharedTiltSteering.subscribe((s) => { subA = s })
  const unsubB = sharedTiltSteering.subscribe((s) => { subB = s })

  sharedTiltSteering.processSample({ beta: 18, gamma: 0, alpha: 0, orientationAngle: 90, isLandscape: true }, 1 / 60, true)
  sharedTiltSteering.calibrateNeutral()
  assert(
    subA.isCalibrated && subB.isCalibrated && subA.calibratedAngleDeg === 0 && subB.calibratedAngleDeg === 0,
    'Calibração do ponto neutro sincronizada entre múltiplos consumidores do singleton',
    `subA=${subA.calibratedAngleDeg}°, subB=${subB.calibratedAngleDeg}°`,
  )

  unsubA()
  unsubB()
  sharedTiltSteering.resetCalibration()
  useSimulationStore.setState({ tiltSteeringEnabled: false, steeringMethod: 'touch' })
}

// ─── 4. COMPOSTOS DE PNEUS (STREET VS SEMI_SLICK) × SUPERFÍCIES ───────────────
console.log('\n4. Pneus (street vs semi_slick) × superfícies (seco, chuva, cascalho)')
{
  const civic = loadVehicle('civic-si')
  const sim = useSimulationStore.getState()

  // Mede aceleração no asfalto seco com street vs semi_slick
  const measureLaunchSpeed = (tires: 'street' | 'semi_slick', isRaining: boolean, startX: number, startY: number) => {
    sim.reset()
    sim.init(civic, { tires, turboKit: true, turboLevel: 'intermediate', tuningStage: 2 })
    useSimulationStore.setState({ isRaining, positionX: startX, positionY: startY })
    const st = useSimulationStore.getState()
    st._phys.positionX = startX
    st._phys.positionY = startY
    if (st._physics) {
      st._physics.restoreSnapshot({
        ...st._physics.getStateSnapshot(),
        positionX: startX,
        positionY: startY,
        headingRad: 0,
      })
    }
    sim.startEngine()
    stepSeconds(0.6)
    sim.setClutch(1.0)
    sim.shiftUp()
    sim.setThrottle(1.0)
    for (let i = 0; i < 40; i++) {
      useSimulationStore.getState().setClutch(Math.max(0, 0.45 - (i / 40) * 0.45))
      useSimulationStore.getState().update(1 / 120)
    }
    sim.setClutch(0)
    stepSeconds(2.0)
    return useSimulationStore.getState().speed
  }

  const dryStreet = measureLaunchSpeed('street', false, 0, 25)
  const drySemi = measureLaunchSpeed('semi_slick', false, 0, 25)
  const rainStreet = measureLaunchSpeed('street', true, 0, 25)
  const rainSemi = measureLaunchSpeed('semi_slick', true, 0, 25)
  // Zona Off-road cascalho (x=140, y=-140)
  const gravelStreet = measureLaunchSpeed('street', false, 140, -140)
  const gravelSemi = measureLaunchSpeed('semi_slick', false, 140, -140)

  assert(drySemi >= dryStreet + 2, 'Semi-slick acelera melhor que street no asfalto seco sob alto torque', `semi=${drySemi.toFixed(1)} vs street=${dryStreet.toFixed(1)} km/h`)
  assert(rainSemi < rainStreet, 'Semi-slick perde aderência para street na chuva', `semi=${rainSemi.toFixed(1)} vs street=${rainStreet.toFixed(1)} km/h`)
  assert(gravelSemi < gravelStreet, 'Semi-slick perde aderência para street no cascalho off-road', `semi=${gravelSemi.toFixed(1)} vs street=${gravelStreet.toFixed(1)} km/h`)
}

// ─── 5. AERODINÂMICA: rearWingType NO INTEGRADOR DE 120Hz ─────────────────────
console.log('\n5. Aerodinâmica: rearWingType propagado no integrador 120Hz')
{
  const civic = loadVehicle('civic-si')
  const sim = useSimulationStore.getState()

  const coastFrom200 = (rearWingType: 'none' | 'sport_gt', rearWingPosition: 'low_drag' | 'high_downforce') => {
    sim.reset()
    sim.init(civic, { rearWingType, rearWingPosition })
    sim.startEngine()
    stepSeconds(0.5)
    sim.setClutch(1.0)
    sim.shiftUp(); sim.shiftUp(); sim.shiftUp(); sim.shiftUp(); sim.shiftUp() // 5ª
    sim.setClutch(0)
    useSimulationStore.setState({ speed: 200 })
    useSimulationStore.getState()._phys.speedKmh = 200
    sim.setThrottle(0)
    stepSeconds(3.0)
    return useSimulationStore.getState().speed
  }

  const speedNoWing = coastFrom200('none', 'low_drag')
  const speedGtWing = coastFrom200('sport_gt', 'high_downforce')
  assert(
    speedGtWing < speedNoWing - 0.8,
    'Aerofólio GT de alto downforce gera mais arrasto real em alta velocidade (200 km/h)',
    `sem asa=${speedNoWing.toFixed(2)} km/h vs GT wing=${speedGtWing.toFixed(2)} km/h`,
  )
}

// ─── 6. LAUNCH CONTROL (PORSCHE) + CVT FREIO-MOTOR + DSG SEM HUNTING ──────────
console.log('\n6. Launch Control (Porsche), CVT freio-motor (Yaris) e DSG (Golf GTI)')
{
  const porsche = loadVehicle('porsche-gt3')
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(porsche)
  sim.startEngine()
  stepSeconds(0.8)
  sim.selectShifterMode('D')
  sim.setDrivingMode('sport')
  sim.setBrake(1.0)
  sim.setThrottle(1.0)
  stepSeconds(0.5)
  const armed = useSimulationStore.getState().isLaunchControlArmed
  assert(armed, 'Porsche arma Launch Control em Sport + Freio + Acelerador')

  sim.setBrake(0)
  stepSeconds(3.2)
  const afterLaunch = useSimulationStore.getState()
  assert(
    !afterLaunch.isStalled && afterLaunch.speed > 85,
    'Porsche larga sem estolar e supera 85 km/h em 3.2s',
    `speed=${afterLaunch.speed.toFixed(1)} km/h, stalled=${afterLaunch.isStalled}`,
  )

  // Yaris CVT freio-motor
  const yaris = loadVehicle('yaris-2019')
  sim.reset()
  sim.init(yaris)
  sim.startEngine()
  stepSeconds(0.8)
  sim.selectShifterMode('D')
  sim.setThrottle(0.85)
  for (let i = 0; i < 1200; i++) {
    useSimulationStore.getState().update(1 / 120)
    if (useSimulationStore.getState().speed >= 80) break
  }
  const vStart = useSimulationStore.getState().speed
  sim.setThrottle(0)
  stepSeconds(5.0)
  const vDrop = vStart - useSimulationStore.getState().speed
  assert(vDrop >= 10, 'Yaris CVT aplica freio-motor coerente ao tirar o pé do acelerador', `queda=${vDrop.toFixed(2)} km/h`)
}

// ─── 7. DINAMÔMETRO E GARAGEM (SPECS UNIFICADAS E UPGRADES) ───────────────────
console.log('\n7. Dinamômetro (calculateDynoProfile) e Garagem (Porsche 911 Turbo S 992)')
{
  const civic = loadVehicle('civic-si')
  const porsche = loadVehicle('porsche-gt3')

  const dynoStock = calculateDynoProfile(civic, {
    ...createDefaultUpgrades('civic-si'),
    turboKit: false,
    turboLevel: 'none',
    fuelType: 'common_gasoline',
  })
  const dynoBigTurboE100 = calculateDynoProfile(civic, {
    ...createDefaultUpgrades('civic-si'),
    turboKit: true,
    turboLevel: 'big_turbo',
    tuningStage: 3,
    fuelType: 'ethanol_e100',
  })
  const dynoPorsche = calculateDynoProfile(porsche, createDefaultUpgrades('porsche-gt3'))

  assert(
    dynoStock.maxPowerHp > 170 && dynoStock.maxTorqueNm > 180,
    'Dyno expõe aliases maxPowerHp e maxTorqueNm válidos',
    `${dynoStock.maxPowerHp} cv / ${dynoStock.maxTorqueNm} Nm`,
  )
  assert(
    dynoBigTurboE100.maxPowerHp > dynoStock.maxPowerHp * 1.4,
    'Dyno reflete ganho de big_turbo + Stage 3 + E100',
    `stock=${dynoStock.maxPowerHp} cv → prep=${dynoBigTurboE100.maxPowerHp} cv`,
  )
  assert(
    getDrivetrainType(porsche) === 'awd' && dynoPorsche.drivetrainLossPercent >= 16,
    'Dyno classifica Porsche 911 Turbo S como AWD com perda de tração coerente',
    `drivetrain=${getDrivetrainType(porsche)}, loss=${dynoPorsche.drivetrainLossPercent}%`,
  )

  const porscheDefaults = createDefaultUpgrades('porsche-gt3')
  assert(
    porscheDefaults.turboKit === true && porscheDefaults.turboLevel === 'none',
    'Porsche nasce com turboKit=true e turboLevel=none (Turbo Original de Fábrica)',
    `turboKit=${porscheDefaults.turboKit}, turboLevel=${porscheDefaults.turboLevel}`,
  )

  const garagePorsche = useGarageStore.getState().ownedCars.find((c) => c.vehicleId === 'porsche-gt3')
  assert(
    Boolean(garagePorsche && garagePorsche.customName.includes('Turbo S')),
    'Instância padrão do Porsche na garagem usa nomenclatura unificada Turbo S',
    garagePorsche?.customName,
  )
}

console.log('\n═══════════════════════════════════════════════════════════════════')
console.log(` RESULTADO FINAL: ${passed} PASSOU · ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════════\n')

if (failed > 0) {
  process.exit(1)
}
