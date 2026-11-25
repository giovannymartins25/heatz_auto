/**
 * Suite funcional e auditoria matemática — FASE 3.2.1 (Validação Estendida da Física 2D em Diferentes Veículos)
 *
 * Veículos e cenários:
 * 1. Auditoria Matemática (240 Hz substeps, transferência de carga, continuidade C0, marcha ré, energia em colisão)
 * 2. Chevrolet Opala Diplomata 4.1 RWD — Skidpad molhado e curvas (sobresterço por excesso de torque + recuperação)
 * 3. Porsche 911 Turbo S AWD — Circuito de Handling R=80m (curvas em múltiplas velocidades, estabilidade AWD, aderência)
 * 4. Fiat Toro Ranch 4x4 — Circuito Off-Road (asfalto/cascalho/grama, AUTO vs 4WD vs 4WD_LOW, baixa velocidade)
 * 5. Honda CB1000R — S-Curvas Nordeste (R=25m/45m) e baixa velocidade (inclinação roll/lean real, limite de aderência, guidão)
 */
import fs from 'fs'
import path from 'path'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { WorldMap } from './src/systems/world/WorldMap'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
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

function placeVehicle(x: number, y: number, headingDeg: number, speedKmh = 0) {
  const st = useSimulationStore.getState()
  if (st._physics) {
    st._physics.setPosition(x, y, headingDeg)
    st._physics.setSpeedKmh(speedKmh)
    st._physics.restoreSnapshot({
      ...st._physics.getStateSnapshot(),
      positionX: x,
      positionY: y,
      headingRad: (headingDeg * Math.PI) / 180,
      speedMs: speedKmh / 3.6,
      wheelSpeedMs: speedKmh / 3.6,
      lateralSpeedMs: 0,
      yawRate: 0,
      slipAngleRad: 0,
      lateralAccelMs2: 0,
      leanAngleRad: 0,
    })
  }
  const q = WorldMap.query(x, y, st.isRaining)
  useSimulationStore.setState({
    positionX: x,
    positionY: y,
    headingDeg,
    visualPositionX: x,
    visualPositionY: y,
    visualHeadingDeg: headingDeg,
    speed: speedKmh,
    surfaceType: q.surface.type,
    zoneName: q.zoneName,
    _phys: {
      ...st._phys,
      positionX: x,
      positionY: y,
      headingDeg,
      speedKmh,
      lastPubSpeedKmh: speedKmh,
      lateralSpeedMs: 0,
      slipAngleDeg: 0,
      lateralAccelG: 0,
      leanAngleDeg: 0,
      surfaceType: q.surface.type,
      zoneName: q.zoneName,
    },
  })
}

console.log('\n═══════════════════════════════════════════════════════════════════════════')
console.log(' HEATZ AUTO — FASE 3.2.1: AUDITORIA MATEMÁTICA & VALIDAÇÃO 4 VEÍCULOS 120Hz')
console.log('═══════════════════════════════════════════════════════════════════════════\n')

// ─── 1. AUDITORIA MATEMÁTICA DO INTEGRADOR PLANAR 2D ─────────────────────────
console.log('1. Auditoria Matemática — Carga Normal, Continuidade C0, Marcha Ré e Energia')
{
  const porscheCfg = loadVehicle('porsche-gt3')
  const cbCfg = loadVehicle('cb1000r')

  const carPhys = new VehiclePhysics({
    weight: porscheCfg.info.weight,
    wheelDiameter: porscheCfg.info.wheelDiameter,
    vehicleId: porscheCfg.id,
    chassis: porscheCfg.chassis,
  })
  const bikePhys = new VehiclePhysics({
    weight: cbCfg.info.weight,
    wheelDiameter: cbCfg.info.wheelDiameter,
    vehicleId: cbCfg.id,
    isMotorcycle: true,
    chassis: cbCfg.chassis,
  })

  // 1A. Conservação de peso e sinal da transferência lateral de carga
  const rightTurnLoads = carPhys.getDynamicWheelLoads(7.5) // curva à direita (+ay)
  const sumFront = rightTurnLoads.fl + rightTurnLoads.fr
  const sumRear = rightTurnLoads.rl + rightTurnLoads.rr
  assert(
    Math.abs(sumFront - rightTurnLoads.frontAxleLoad) < 0.01 &&
      Math.abs(sumRear - rightTurnLoads.rearAxleLoad) < 0.01 &&
      rightTurnLoads.fl > rightTurnLoads.fr &&
      rightTurnLoads.rl > rightTurnLoads.rr,
    'Transferência lateral de carga conserva peso total e sobrecarrega rodas externas (esq.) em curva à direita',
    `FL=${rightTurnLoads.fl.toFixed(0)}N > FR=${rightTurnLoads.fr.toFixed(0)}N, RL=${rightTurnLoads.rl.toFixed(0)}N > RR=${rightTurnLoads.rr.toFixed(0)}N`,
  )

  const bikeLoads = bikePhys.getDynamicWheelLoads(7.5)
  assert(
    bikeLoads.fl === bikeLoads.fr && bikeLoads.rl === bikeLoads.rr,
    'Motocicleta (bitola zero) não aplica transferência lateral esquerda/direita de carro',
    `F=${bikeLoads.frontAxleLoad.toFixed(0)}N, R=${bikeLoads.rearAxleLoad.toFixed(0)}N`,
  )

  // 1B. Continuidade C0 na fronteira cinemática <-> dinâmica (v = 1.95 m/s vs v = 2.05 m/s)
  const sampleAtSpeed = (speedMs: number) => {
    const p = new VehiclePhysics({
      weight: porscheCfg.info.weight,
      wheelDiameter: porscheCfg.info.wheelDiameter,
      vehicleId: porscheCfg.id,
      chassis: porscheCfg.chassis,
      initialPositionX: 0,
      initialPositionY: 60,
    })
    p.setSpeedKmh(speedMs * 3.6)
    return p.tick({
      driveTorqueAtTransmission: 120,
      gearRatio: 3.17,
      finalDrive: 3.02,
      brake: 0,
      deltaTime: 1 / 120,
      steeringAngleRad: 0.25,
      gear: 2,
      isRaining: false,
    })
  }
  const below = sampleAtSpeed(1.95)
  const above = sampleAtSpeed(2.05)
  assert(
    Math.abs(above.yawRate - below.yawRate) < 0.05 &&
      Math.abs(above.lateralAccelG - below.lateralAccelG) < 0.05 &&
      Math.abs(above.lateralSpeedMs - below.lateralSpeedMs) < 0.05,
    'Transição cinemático <-> dinâmico em v = 2.0 m/s é contínua (C0 sem salto de guinada ou ay)',
    `Δr=${Math.abs(above.yawRate - below.yawRate).toFixed(4)} rad/s, Δay=${Math.abs(above.lateralAccelG - below.lateralAccelG).toFixed(4)}G`,
  )

  // 1C. Marcha ré estável (sentido inverso, zero NaN)
  const revPhys = new VehiclePhysics({
    weight: porscheCfg.info.weight,
    wheelDiameter: porscheCfg.info.wheelDiameter,
    vehicleId: porscheCfg.id,
    chassis: porscheCfg.chassis,
    initialPositionX: 0,
    initialPositionY: 70,
    initialHeadingDeg: 0,
  })
  // setSpeedKmh agora aceita sinal para definir o sentido efetivo do movimento.
  revPhys.setSpeedKmh(-15)
  let revRes = revPhys.tick({
    driveTorqueAtTransmission: 150,
    gearRatio: 3.99,
    finalDrive: 3.02,
    brake: 0,
    deltaTime: 1 / 120,
    steeringAngleRad: 0.30,
    gear: -1,
    isRaining: false,
  })
  for (let i = 0; i < 60; i++) {
    revRes = revPhys.tick({
      driveTorqueAtTransmission: 150,
      gearRatio: 3.99,
      finalDrive: 3.02,
      brake: 0,
      deltaTime: 1 / 120,
      steeringAngleRad: 0.30,
      gear: -1,
      isRaining: false,
    })
  }
  assert(
    revRes.positionY < 69 && revRes.yawRate < 0 && Number.isFinite(revRes.positionX),
    'Marcha ré desloca para trás (-Y) com guinada invertida coerente e estabilidade total',
    `Y=${revRes.positionY.toFixed(1)}m, r=${revRes.yawRate.toFixed(2)} rad/s`,
  )

  // 1D. Dissipação de energia em colisão (E_post < E_pre)
  const colPhys = new VehiclePhysics({
    weight: porscheCfg.info.weight,
    wheelDiameter: porscheCfg.info.wheelDiameter,
    vehicleId: porscheCfg.id,
    chassis: porscheCfg.chassis,
    initialPositionX: 0,
    initialPositionY: 283.5,
    initialHeadingDeg: 0,
  })
  colPhys.setSpeedKmh(90)
  const preEnergy = 0.5 * porscheCfg.info.weight * (25 * 25)
  let postRes = colPhys.tick({
    driveTorqueAtTransmission: 0,
    gearRatio: 1.56,
    finalDrive: 3.02,
    brake: 0,
    deltaTime: 1 / 120,
    steeringAngleRad: 0,
    gear: 4,
    isRaining: false,
  })
  for (let i = 0; i < 15 && !postRes.isColliding; i++) {
    postRes = colPhys.tick({
      driveTorqueAtTransmission: 0,
      gearRatio: 1.56,
      finalDrive: 3.02,
      brake: 0,
      deltaTime: 1 / 120,
      steeringAngleRad: 0,
      gear: 4,
      isRaining: false,
    })
  }
  const postSpeedSq = postRes.speedMs * postRes.speedMs + postRes.lateralSpeedMs * postRes.lateralSpeedMs
  const postEnergy = 0.5 * porscheCfg.info.weight * postSpeedSq
  assert(
    postRes.isColliding && postEnergy < preEnergy * 0.6,
    'Colisão dissipa estritamente energia cinética (E_post < E_pre, zero ganho espúrio)',
    `E_pre=${(preEnergy / 1000).toFixed(1)} kJ → E_post=${(postEnergy / 1000).toFixed(1)} kJ`,
  )
}

// ─── 2. CHEVROLET OPALA 4.1 RWD — SKIDPAD & CURVAS ───────────────────────────
console.log('\n2. Chevrolet Opala 4.1 RWD — Skidpad Molhado, Sobresterço por Torque e Recuperação')
{
  const opala = loadVehicle('opala-4100')
  const sim = useSimulationStore.getState()

  const runOpalaSkidpad = (throttle: number) => {
    sim.reset()
    sim.init(opala)
    sim.startEngine()
    stepSeconds(0.8) // Aguarda conclusão do arranque (motor 100% em marcha lenta)
    sim.setClutch(1.0)
    sim.shiftUp() // 1ª
    sim.shiftUp() // 2ª
    placeVehicle(-140, -100, 90, 52) // Dentro do Skidpad molhado (centro -140,-140, r=65m)
    sim.setClutch(0)
    sim.setThrottle(throttle)
    sim.setSteeringAngle(0.55, 'keyboard')

    let maxSlip = 0
    let maxLatG = 0
    let maxVy = 0
    let surface = ''
    for (let i = 0; i < 180; i++) {
      sim.update(1 / 120)
      const s = useSimulationStore.getState()
      maxSlip = Math.max(maxSlip, Math.abs(s.slipAngleDeg))
      maxLatG = Math.max(maxLatG, Math.abs(s.lateralAccelG))
      maxVy = Math.max(maxVy, Math.abs(s.lateralSpeedMs))
      surface = s.surfaceType
    }
    return { maxSlip, maxLatG, maxVy, surface, endSpeed: useSimulationStore.getState().speed }
  }

  const gentle = runOpalaSkidpad(0.15)
  const powerOversteer = runOpalaSkidpad(1.0)

  assert(
    gentle.surface === 'wet_asphalt' && powerOversteer.surface === 'wet_asphalt',
    'Opala 4.1 executa o teste integralmente sobre o Skidpad Molhado (mu=0.50)',
    `surface=${powerOversteer.surface}`,
  )
  assert(
    powerOversteer.maxSlip > gentle.maxSlip + 2.0 && powerOversteer.maxSlip > 6.0,
    'Excesso de torque traseiro no Opala RWD induz sobresterço mensurável vs curva suave',
    `suave=${gentle.maxSlip.toFixed(1)}° vs pé-embaixo=${powerOversteer.maxSlip.toFixed(1)}°, vy=${powerOversteer.maxVy.toFixed(2)} m/s, ay=${powerOversteer.maxLatG.toFixed(2)}G`,
  )

  // Recuperação após sobresterço: alivia acelerador (0%) e aplica contra-esterço real (-0.55) antes de alinhar
  sim.setThrottle(0.0)
  sim.setSteeringAngle(-0.55, 'keyboard')
  stepSeconds(0.65)
  sim.setSteeringAngle(0, 'keyboard')
  stepSeconds(1.5)
  const recovered = useSimulationStore.getState()
  assert(
    Math.abs(recovered.slipAngleDeg) < 2.5 && Number.isFinite(recovered.headingDeg),
    'Opala 4.1 recupera aderência e estabiliza deriva após alívio de acelerador e contra-esterço',
    `slip_final=${recovered.slipAngleDeg.toFixed(2)}°, vy=${recovered.lateralSpeedMs.toFixed(2)} m/s, speed=${recovered.speed.toFixed(1)} km/h`,
  )
}

// ─── 3. PORSCHE 911 TURBO S AWD — CIRCUITO DE HANDLING (R=80M) ───────────────
console.log('\n3. Porsche 911 Turbo S AWD — Circuito de Handling R=80m (Múltiplas Velocidades & PTM)')
{
  const porsche = loadVehicle('porsche-gt3')
  const sim = useSimulationStore.getState()

  const runPorscheHandling = (entrySpeedKmh: number, throttle: number, steer: number) => {
    sim.reset()
    sim.init(porsche)
    sim.startEngine()
    stepSeconds(0.4)
    sim.selectShifterMode('D')
    placeVehicle(-140, 220, 90, entrySpeedKmh) // Topo do anel de Handling R=80m indo para Leste
    sim.setThrottle(throttle)
    sim.setSteeringAngle(steer, 'keyboard')

    let maxSlip = 0
    let maxLatG = 0
    let maxVy = 0
    let endZone = ''
    for (let i = 0; i < 180; i++) {
      sim.update(1 / 120)
      const s = useSimulationStore.getState()
      maxSlip = Math.max(maxSlip, Math.abs(s.slipAngleDeg))
      maxLatG = Math.max(maxLatG, Math.abs(s.lateralAccelG))
      maxVy = Math.max(maxVy, Math.abs(s.lateralSpeedMs))
      endZone = s.zoneName
    }
    return { maxSlip, maxLatG, maxVy, endSpeed: useSimulationStore.getState().speed, endZone }
  }

  const slowCorner = runPorscheHandling(40, 0.25, 0.16)
  const fastCorner = runPorscheHandling(110, 0.70, 0.24)

  assert(
    fastCorner.maxLatG > slowCorner.maxLatG + 0.15 && fastCorner.maxLatG >= 0.70 && fastCorner.maxLatG <= 1.25,
    'Porsche 911 Turbo S escala aceleração lateral com a velocidade respeitando aderência real no Handling',
    `40km/h=${slowCorner.maxLatG.toFixed(2)}G → 110km/h=${fastCorner.maxLatG.toFixed(2)}G`,
  )
  assert(
    fastCorner.maxSlip < 7.5 && fastCorner.endSpeed > 95,
    'Tração PTM AWD mantém estabilidade direcional em curva rápida sob forte aceleração',
    `maxSlip=${fastCorner.maxSlip.toFixed(1)}°, maxVy=${fastCorner.maxVy.toFixed(2)} m/s, v_saida=${fastCorner.endSpeed.toFixed(1)} km/h`,
  )
}

// ─── 4. FIAT TORO RANCH 4x4 — CIRCUITO OFF-ROAD ──────────────────────────────
console.log('\n4. Fiat Toro Ranch 4x4 — Asfalto vs Cascalho vs Grama, Modos 4x4 e Baixa Velocidade')
{
  const toro = loadVehicle('fiat-toro-ranch-2025')
  const sim = useSimulationStore.getState()

  const accelToro = (x: number, y: number, mode: 'auto' | '4wd' | '4wd_low', seconds = 2.0) => {
    sim.reset()
    sim.init(toro)
    sim.startEngine()
    stepSeconds(0.4)
    sim.selectShifterMode('D')
    sim.setFourWheelDriveMode(mode)
    placeVehicle(x, y, 0, 0)
    sim.setThrottle(0.9)
    sim.setSteeringAngle(0, 'keyboard')
    stepSeconds(seconds)
    const s = useSimulationStore.getState()
    return { speed: s.speed, surface: s.surfaceType, mode: s.fourWheelDriveMode }
  }

  const asphaltAuto = accelToro(0, 60, 'auto', 2.0)
  const gravelAuto = accelToro(140, -140, 'auto', 2.0)
  const gravel4wd = accelToro(140, -140, '4wd', 2.0)
  const grass4wd = accelToro(255, 255, '4wd', 2.0)

  assert(
    asphaltAuto.surface === 'asphalt' && gravel4wd.surface === 'gravel' && grass4wd.surface === 'grass',
    'Toro Ranch reconhece asfalto, cascalho Off-Road e grama corretamente',
    `${asphaltAuto.surface} / ${gravel4wd.surface} / ${grass4wd.surface}`,
  )
  assert(
    gravel4wd.speed >= gravelAuto.speed && asphaltAuto.speed > gravel4wd.speed && grass4wd.speed > 12,
    'Tração 4WD LOCK entrega igual ou superior arrancada no cascalho vs AUTO e mantém progressão na grama',
    `asfalto=${asphaltAuto.speed.toFixed(1)}, cascalho_AUTO=${gravelAuto.speed.toFixed(1)}, cascalho_4WD=${gravel4wd.speed.toFixed(1)}, grama_4WD=${grass4wd.speed.toFixed(1)} km/h`,
  )

  // Perda e recuperação de aderência em curva no cascalho Off-Road
  placeVehicle(140, -110, 90, 50)
  sim.setFourWheelDriveMode('4wd')
  sim.setThrottle(0.75)
  sim.setSteeringAngle(0.65, 'keyboard')
  let peakGravelSlip = 0
  let peakGravelLatG = 0
  for (let i = 0; i < 150; i++) {
    sim.update(1 / 120)
    const s = useSimulationStore.getState()
    peakGravelSlip = Math.max(peakGravelSlip, Math.abs(s.slipAngleDeg))
    peakGravelLatG = Math.max(peakGravelLatG, Math.abs(s.lateralAccelG))
  }
  // Recuperação
  sim.setThrottle(0.1)
  sim.setSteeringAngle(0, 'keyboard')
  stepSeconds(1.2)
  const toroRecovered = useSimulationStore.getState()
  assert(
    peakGravelSlip > 0.8 && peakGravelLatG <= 0.58 && Math.abs(toroRecovered.slipAngleDeg) < 1.5,
    'Toro Ranch exibe deriva limitada pelo atrito do cascalho (mu=0.48) e recupera estabilidade ao corrigir',
    `peakSlip=${peakGravelSlip.toFixed(1)}°, peakLatG=${peakGravelLatG.toFixed(2)}G → recSlip=${toroRecovered.slipAngleDeg.toFixed(2)}°`,
  )

  // Baixa velocidade em 4WD LOW no Off-Road
  sim.reset()
  sim.init(toro)
  sim.startEngine()
  stepSeconds(0.4)
  sim.selectShifterMode('D')
  sim.setFourWheelDriveMode('4wd_low')
  placeVehicle(140, -140, 0, 8)
  sim.setThrottle(0.18)
  sim.setSteeringAngle(0.55, 'keyboard')
  stepSeconds(1.5)
  const lowSpd = useSimulationStore.getState()
  assert(
    lowSpd.fourWheelDriveMode === '4wd_low' && Math.abs(lowSpd.slipAngleDeg) < 3.0 && Number.isFinite(lowSpd.positionX),
    'Toro Ranch em 4WD LOW mantém manobra estável em baixa velocidade no cascalho',
    `speed=${lowSpd.speed.toFixed(1)} km/h, slip=${lowSpd.slipAngleDeg.toFixed(2)}°, heading=${lowSpd.headingDeg.toFixed(1)}°`,
  )
}

// ─── 5. HONDA CB1000R — S-CURVAS NORDESTE & MODELO ESPECÍFICO DE MOTOCICLETA ─
console.log('\n5. Honda CB1000R — Modelo Roll/Lean nas S-Curvas Nordeste e Estabilidade em Baixa Velocidade')
{
  const cb = loadVehicle('cb1000r')
  const sim = useSimulationStore.getState()

  // 5A. Baixa velocidade (~10 km/h): guidão predominante, inclinação mínima e zero oscilação
  sim.reset()
  sim.init(cb)
  sim.startEngine()
  stepSeconds(0.4)
  sim.setClutch(1.0)
  sim.shiftUp() // 1ª
  sim.setClutch(0)
  placeVehicle(20, 115, 90, 9) // Rua do Distrito Nordeste indo para a curva fechada R=25m
  sim.setThrottle(0.12)
  sim.setSteeringAngle(0.45, 'keyboard')
  let maxLowLean = 0
  for (let i = 0; i < 120; i++) {
    sim.update(1 / 120)
    maxLowLean = Math.max(maxLowLean, Math.abs(useSimulationStore.getState().leanAngleDeg))
  }
  const cbLow = useSimulationStore.getState()
  assert(
    maxLowLean < 14 && Number.isFinite(cbLow.headingDeg) && Math.abs(cbLow.slipAngleDeg) < 4,
    'CB1000R em baixa velocidade (~9-15 km/h) esterça suavemente sem inclinação excessiva ou oscilação',
    `maxLean=${maxLowLean.toFixed(1)}°, speed=${cbLow.speed.toFixed(1)} km/h, slip=${cbLow.slipAngleDeg.toFixed(2)}°`,
  )

  // 5B. Curva progressiva em velocidade (asfalto seco vs chuva) + retorno estável à vertical
  const testBikeCorner = (isRaining: boolean) => {
    sim.reset()
    sim.init(cb)
    if (isRaining) sim.toggleRain()
    sim.startEngine()
    stepSeconds(0.8)
    sim.setClutch(1.0)
    sim.shiftUp(); sim.shiftUp(); sim.shiftUp() // 3ª
    placeVehicle(-140, 220, 90, 72) // Anel amplo asfaltado de Handling R=80m (mantém 100% no asfalto seco ou molhado)
    sim.setClutch(0)
    sim.setThrottle(0.32)
    sim.setSteeringAngle(0.75, 'keyboard') // Curva progressiva à direita acompanhando o raio

    let maxLean = 0
    let maxLatG = 0
    let maxSlip = 0
    let firstTickLean = 0
    for (let i = 0; i < 160; i++) {
      sim.update(1 / 120)
      const s = useSimulationStore.getState()
      if (i === 0) firstTickLean = Math.abs(s.leanAngleDeg)
      maxLean = Math.max(maxLean, Math.abs(s.leanAngleDeg))
      maxLatG = Math.max(maxLatG, Math.abs(s.lateralAccelG))
      maxSlip = Math.max(maxSlip, Math.abs(s.slipAngleDeg))
    }
    return { firstTickLean, maxLean, maxLatG, maxSlip }
  }

  const dryBike = testBikeCorner(false)
  const wetBike = testBikeCorner(true)

  assert(
    dryBike.firstTickLean < 3.0 && dryBike.maxLean >= 24 && dryBike.maxLean <= 48.1,
    'CB1000R inclina progressivamente (sem salto instantâneo) atingindo ângulo realista de moto esportiva no seco',
    `tick1=${dryBike.firstTickLean.toFixed(2)}° → maxLean=${dryBike.maxLean.toFixed(1)}°, ay=${dryBike.maxLatG.toFixed(2)}G, slip=${dryBike.maxSlip.toFixed(1)}°`,
  )
  assert(
    wetBike.maxLean < dryBike.maxLean - 4.0 && wetBike.maxLatG < dryBike.maxLatG && wetBike.maxLatG <= 0.65,
    'Na chuva (mu=0.62), o modelo de motocicleta reduz automaticamente o limite físico de inclinação e aceleração lateral',
    `seco=${dryBike.maxLean.toFixed(1)}° (${dryBike.maxLatG.toFixed(2)}G) vs chuva=${wetBike.maxLean.toFixed(1)}° (${wetBike.maxLatG.toFixed(2)}G)`,
  )

  // 5C. Retorno estável à posição vertical ao soltar o comando de direção
  sim.setSteeringAngle(0, 'keyboard')
  stepSeconds(1.4)
  const cbUpright = useSimulationStore.getState()
  assert(
    Math.abs(cbUpright.leanAngleDeg) < 1.5 && Math.abs(cbUpright.lateralAccelG) < 0.08,
    'CB1000R retorna suavemente à vertical (0° lean) ao endireitar em reta',
    `lean_final=${cbUpright.leanAngleDeg.toFixed(2)}°, ay=${cbUpright.lateralAccelG.toFixed(3)}G`,
  )
}

console.log('\n═══════════════════════════════════════════════════════════════════════════')
console.log(` RESULTADO FASE 3.2.1: ${passed} PASSOU · ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════════════════\n')

if (failed > 0) {
  process.exit(1)
}
