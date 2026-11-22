/**
 * Suite de Auditoria Quantitativa — FASE 3.2.2
 * 1. Auditoria de Energia do Veículo (balanço energético longitudinal, lateral, guinada, trabalho e dissipação)
 * 2. Validação da Fiat Toro Ranch 4x4 (AUTO vs 4WD vs 4WD LOW em asfalto, cascalho, grama, split-mu e curva)
 * 3. Auditoria da Honda CB1000R (velocidade × esterço × inclinação, camber thrust, transição, chuva e Iz)
 */
import fs from 'fs'
import path from 'path'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { WorldMap } from './src/systems/world/WorldMap'
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

console.log('\n═══════════════════════════════════════════════════════════════════════════════')
console.log(' HEATZ AUTO — FASE 3.2.2: AUDITORIA QUANTITATIVA DE ENERGIA, 4X4 E MOTOCICLETA')
console.log('═══════════════════════════════════════════════════════════════════════════════\n')

// ─────────────────────────────────────────────────────────────────────────────
// 1. AUDITORIA DE ENERGIA DO VEÍCULO (7 CENÁRIOS ISOLADOS E COMBINADOS)
// ─────────────────────────────────────────────────────────────────────────────
console.log('1. Auditoria de Balanço Energético do Modelo Planar 2D (120 Hz)')

interface EnergyAuditRow {
  scenario: string
  eInitTransJ: number
  eInitRotJ: number
  eInitTotalJ: number
  workMotorWheelJ: number
  workChassisDriveJ: number
  dissLongSlipJ: number
  dissBrakeJ: number
  dissRollJ: number
  dissAeroJ: number
  dissLateralJ: number
  dissCollisionJ: number
  eFinalTransJ: number
  eFinalRotJ: number
  eFinalTotalJ: number
  residualJ: number
  residualPct: number
}

const energyRows: EnergyAuditRow[] = []

function runEnergyScenario(
  name: string,
  cfg: VehicleConfig,
  initSpeedKmh: number,
  ticks: number,
  startPos: { x: number; y: number; headingDeg: number },
  stepInput: (tickIdx: number, phys: VehiclePhysics) => {
    torqueNm: number
    gearRatio: number
    brake: number
    steerRad: number
    gear: number
  },
): EnergyAuditRow {
  const phys = new VehiclePhysics({
    weight: cfg.info.weight,
    wheelDiameter: cfg.info.wheelDiameter,
    vehicleId: cfg.id,
    chassis: cfg.chassis,
    initialPositionX: startPos.x,
    initialPositionY: startPos.y,
    initialHeadingDeg: startPos.headingDeg,
  })
  phys.setSpeedKmh(initSpeedKmh)

  const m = cfg.info.weight
  const dt = 1 / 120
  const aDist = phys.getChassis().distanceCgToFrontAxle
  const bDist = phys.getChassis().distanceCgToRearAxle
  const L = phys.getChassis().wheelbase
  const Iz = Math.max(180, m * (aDist * bDist + 0.16 * L * L))

  const v0 = phys.getSpeedMs()
  const vy0 = phys.getLateralSpeedMs()
  const r0 = phys.getYawRate()
  const eInitTransJ = 0.5 * m * (v0 * v0 + vy0 * vy0)
  const eInitRotJ = 0.5 * Iz * (r0 * r0)
  const eInitTotalJ = eInitTransJ + eInitRotJ

  let workMotorWheelJ = 0
  let workChassisDriveJ = 0
  let dissLongSlipJ = 0
  let dissBrakeJ = 0
  let dissRollJ = 0
  let dissAeroJ = 0
  let dissLateralJ = 0
  let dissCollisionJ = 0

  for (let i = 0; i < ticks; i++) {
    const prevVx = phys.getSpeedMs()
    const prevVy = phys.getLateralSpeedMs()
    const prevR = phys.getYawRate()
    const prevE = 0.5 * m * (prevVx * prevVx + prevVy * prevVy) + 0.5 * Iz * (prevR * prevR)

    const inp = stepInput(i, phys)
    const res = phys.tick({
      driveTorqueAtTransmission: inp.torqueNm,
      gearRatio: inp.gearRatio,
      finalDrive: cfg.transmission.finalDrive,
      frontFinalDrive: cfg.transmission.frontFinalDrive,
      brake: inp.brake,
      deltaTime: dt,
      steeringAngleRad: inp.steerRad,
      gear: inp.gear,
      isRaining: false,
    })

    const nextVx = res.speedMs
    const nextVy = res.lateralSpeedMs
    const nextR = res.yawRate
    const nextE = 0.5 * m * (nextVx * nextVx + nextVy * nextVy) + 0.5 * Iz * (nextR * nextR)

    if (res.isColliding) {
      // Em subpasso com colisão inelástica de barreira, contabiliza a perda abrupta no impacto
      dissCollisionJ += Math.max(0, prevE - nextE)
      continue
    }

    // No integrador semi-implícito de Euler: v_{n+1} = v_n + (F/m)*dt => d(0.5*m*v^2) = F * 0.5*(v_n + v_{n+1}) * dt
    const midVx = 0.5 * (prevVx + nextVx)
    const wheelLinSpeed = res.wheelSpeedKmh / 3.6

    const stepDriveWork = res.tractionForce * midVx * dt
    const stepSlipDiss = res.isWheelSlipping ? res.tractionForce * Math.max(0, wheelLinSpeed - midVx) * dt : 0
    workChassisDriveJ += stepDriveWork
    dissLongSlipJ += stepSlipDiss
    workMotorWheelJ += stepDriveWork + stepSlipDiss

    dissBrakeJ += res.brakeForceN * midVx * dt
    dissRollJ += res.rollingResistanceN * midVx * dt
    dissAeroJ += res.aeroResistanceN * midVx * dt

    // Trabalho dissipativo lateral: arrasto longitudinal de deriva (scrubForceN) + trabalho lateral dos pneus
    const stepScrubDiss = res.scrubForceN * midVx * dt
    const stepLatTireDiss = -res.lateralWorkJ
    dissLateralJ += stepScrubDiss + stepLatTireDiss
  }

  const vf = phys.getSpeedMs()
  const vyf = phys.getLateralSpeedMs()
  const rf = phys.getYawRate()
  const eFinalTransJ = 0.5 * m * (vf * vf + vyf * vyf)
  const eFinalRotJ = 0.5 * Iz * (rf * rf)
  const eFinalTotalJ = eFinalTransJ + eFinalRotJ

  // Balanço do chassi: E_final_esperada = E_init + W_chassis_drive - (D_brake + D_roll + D_aero + D_lateral + D_collision)
  const totalChassisDissipation = dissBrakeJ + dissRollJ + dissAeroJ + dissLateralJ + dissCollisionJ
  const expectedFinalJ = eInitTotalJ + workChassisDriveJ - totalChassisDissipation
  const residualJ = eFinalTotalJ - expectedFinalJ
  const scaleJ = Math.max(1000, eInitTotalJ, workChassisDriveJ, eFinalTotalJ)
  const residualPct = (Math.abs(residualJ) / scaleJ) * 100

  const row: EnergyAuditRow = {
    scenario: name,
    eInitTransJ,
    eInitRotJ,
    eInitTotalJ,
    workMotorWheelJ,
    workChassisDriveJ,
    dissLongSlipJ,
    dissBrakeJ,
    dissRollJ,
    dissAeroJ,
    dissLateralJ,
    dissCollisionJ,
    eFinalTransJ,
    eFinalRotJ,
    eFinalTotalJ,
    residualJ,
    residualPct,
  }
  energyRows.push(row)
  return row
}

{
  const civic = loadVehicle('civic-si')
  const opala = loadVehicle('opala-4100')

  // E1. Coasting puro em linha reta (100 km/h por 3.0s)
  const e1 = runEnergyScenario('E1. Coasting Reto (100 km/h, 3s)', civic, 100, 360, { x: 0, y: 50, headingDeg: 0 }, () => ({
    torqueNm: 0,
    gearRatio: 0,
    brake: 0,
    steerRad: 0,
    gear: 0,
  }))

  // E2. Aceleração limpa em linha reta sem patinamento (3ª marcha, 40 -> ~70 km/h, 2.5s)
  const e2 = runEnergyScenario('E2. Aceleração Reta Sem Slip (3ª, 2.5s)', civic, 40, 300, { x: 0, y: 50, headingDeg: 0 }, () => ({
    torqueNm: 145,
    gearRatio: civic.transmission.gearRatios[2].ratio,
    brake: 0,
    steerRad: 0,
    gear: 3,
  }))

  // E3. Aceleração com patinamento de pneus (1ª marcha, alto torque no Opala em piso molhado Skidpad)
  const e3 = runEnergyScenario('E3. Aceleração Com Wheelspin (Skidpad)', opala, 15, 180, { x: -140, y: -140, headingDeg: 0 }, () => ({
    torqueNm: 320,
    gearRatio: opala.transmission.gearRatios[0].ratio,
    brake: 0,
    steerRad: 0,
    gear: 1,
  }))

  // E4. Frenagem pura em linha reta (90 km/h -> parada, 3.0s)
  const e4 = runEnergyScenario('E4. Frenagem Reta (90 -> 0 km/h)', civic, 90, 360, { x: 0, y: 50, headingDeg: 0 }, () => ({
    torqueNm: 0,
    gearRatio: 0,
    brake: 0.85,
    steerRad: 0,
    gear: 0,
  }))

  // E5. Curva livre em coasting (85 km/h no circuito de Handling R=80m, 2.0s)
  const e5 = runEnergyScenario('E5. Curva Livre Coasting (85 km/h, 2s)', civic, 85, 240, { x: -140, y: 220, headingDeg: 90 }, () => ({
    torqueNm: 0,
    gearRatio: 0,
    brake: 0,
    steerRad: 0.18,
    gear: 0,
  }))

  // E6. Curva combinada com aceleração e deriva (Opala RWD no Skidpad, 2.0s)
  const e6 = runEnergyScenario('E6. Curva + Deriva RWD (Opala Skidpad)', opala, 50, 240, { x: -140, y: -100, headingDeg: 90 }, () => ({
    torqueNm: 260,
    gearRatio: opala.transmission.gearRatios[1].ratio,
    brake: 0,
    steerRad: 0.30,
    gear: 2,
  }))

  // E7. Colisão frontal contra Defensa Norte (72 km/h)
  const e7 = runEnergyScenario('E7. Colisão com Barreira (72 km/h)', civic, 72, 60, { x: 0, y: 281, headingDeg: 0 }, () => ({
    torqueNm: 0,
    gearRatio: 0,
    brake: 0,
    steerRad: 0,
    gear: 0,
  }))

  console.log('\n  ┌────────────────────────────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐')
  console.log('  │ Cenário                                │ E_ini kJ │ W_ch kJ  │ D_tot kJ │ E_fim kJ │ Err (J)  │ Err (%)  │')
  console.log('  ├────────────────────────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤')
  for (const r of energyRows) {
    const dTot = r.dissBrakeJ + r.dissRollJ + r.dissAeroJ + r.dissLateralJ + r.dissCollisionJ
    console.log(
      `  │ ${r.scenario.padEnd(38)} │ ${(r.eInitTotalJ / 1000).toFixed(2).padStart(8)} │ ${(r.workChassisDriveJ / 1000).toFixed(2).padStart(8)} │ ${(dTot / 1000).toFixed(2).padStart(8)} │ ${(r.eFinalTotalJ / 1000).toFixed(2).padStart(8)} │ ${r.residualJ.toFixed(1).padStart(8)} │ ${r.residualPct.toFixed(3).padStart(7)}% │`,
    )
  }
  console.log('  └────────────────────────────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘\n')

  assert(
    e1.residualPct < 0.05 && e2.residualPct < 0.05 && e4.residualPct < 0.5,
    'Balanço energético longitudinal (coasting, aceleração e frenagem) fecha com erro residual < 0.5%',
    `E1=${e1.residualPct.toFixed(4)}%, E2=${e2.residualPct.toFixed(4)}%, E4=${e4.residualPct.toFixed(4)}%`,
  )
  assert(
    e3.dissLongSlipJ > 5000 && e3.workMotorWheelJ > e3.workChassisDriveJ,
    'Patinamento longitudinal contabiliza explicitamente energia dissipada nos pneus (W_roda = W_chassi + D_slip)',
    `W_roda=${(e3.workMotorWheelJ / 1000).toFixed(2)} kJ = W_chassi=${(e3.workChassisDriveJ / 1000).toFixed(2)} kJ + D_slip=${(e3.dissLongSlipJ / 1000).toFixed(2)} kJ`,
  )
  assert(
    e5.dissLateralJ > 1000 && e5.eFinalTotalJ < e5.eInitTotalJ && e5.residualPct < 1.5,
    'Curva livre em coasting dissipa energia cinética estritamente via deriva lateral, rolamento e aero (sem criar energia)',
    `E_ini=${(e5.eInitTotalJ / 1000).toFixed(2)} kJ -> E_fim=${(e5.eFinalTotalJ / 1000).toFixed(2)} kJ, D_lat=${(e5.dissLateralJ / 1000).toFixed(2)} kJ, err=${e5.residualPct.toFixed(3)}%`,
  )
  assert(
    e6.eFinalRotJ > 0 && e6.dissLateralJ > 2000 && e6.residualPct < 2.5,
    'Curva combinada com aceleração e deriva RWD fecha balanço translacional + rotacional (Iz*r²/2) com erro < 2.5%',
    `E_rot_fim=${e6.eFinalRotJ.toFixed(1)} J, D_lat=${(e6.dissLateralJ / 1000).toFixed(2)} kJ, err=${e6.residualPct.toFixed(3)}%`,
  )
  assert(
    e7.dissCollisionJ > e7.eInitTotalJ * 0.9 && e7.eFinalTotalJ < e7.eInitTotalJ * 0.1,
    'Colisão com barreira dissipa energia cinética de forma estritamente inelástica',
    `E_ini=${(e7.eInitTotalJ / 1000).toFixed(2)} kJ -> D_col=${(e7.dissCollisionJ / 1000).toFixed(2)} kJ`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. VALIDAÇÃO CONTROLADA DA FIAT TORO RANCH 4x4 (AUTO vs 4WD vs 4WD LOW)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. Fiat Toro Ranch 4x4 — Diferenciação Quantitativa entre AUTO, 4WD e 4WD LOW')
{
  const toro = loadVehicle('fiat-toro-ranch-2025')

  // 2A. Comparação em Cascalho (mu = 0.48) e Grama (mu = 0.35) sob torque elevado em 2ª marcha
  const runToroSurfaceTest = (
    mode: 'auto' | '4wd' | '4wd_low',
    pos: { x: number; y: number },
    gear: number,
    torqueNm: number,
    ticks: number,
    splitMu?: { front: number; rear: number },
  ) => {
    const phys = new VehiclePhysics({
      weight: toro.info.weight,
      wheelDiameter: toro.info.wheelDiameter,
      vehicleId: toro.id,
      chassis: toro.chassis,
      fourWheelDriveMode: mode,
      initialPositionX: pos.x,
      initialPositionY: pos.y,
      initialHeadingDeg: 0,
    })
    const ratio = toro.transmission.gearRatios[gear - 1].ratio
    let sumFrontTorque = 0
    let sumRearTorque = 0
    let sumFrontTraction = 0
    let sumRearTraction = 0
    let frontSlipTicks = 0
    let rearSlipTicks = 0
    let firstTickRearTorque = 0
    let lastCoupling = 0

    for (let i = 0; i < ticks; i++) {
      const r = phys.tick({
        driveTorqueAtTransmission: torqueNm,
        gearRatio: ratio,
        finalDrive: toro.transmission.finalDrive,
        brake: 0,
        deltaTime: 1 / 120,
        steeringAngleRad: 0,
        gear,
        isRaining: false,
        frontSurfaceFrictionOverride: splitMu?.front,
        rearSurfaceFrictionOverride: splitMu?.rear,
      })
      if (i === 0) firstTickRearTorque = r.rearAxleTorqueNm
      sumFrontTorque += r.frontAxleTorqueNm
      sumRearTorque += r.rearAxleTorqueNm
      sumFrontTraction += r.frontTractionForceN
      sumRearTraction += r.rearTractionForceN
      if (r.frontAxleSlip) frontSlipTicks++
      if (r.rearAxleSlip) rearSlipTicks++
      lastCoupling = r.awdRearCoupling
    }
    return {
      mode,
      gear,
      firstTickRearTorque,
      avgFrontTorque: sumFrontTorque / ticks,
      avgRearTorque: sumRearTorque / ticks,
      avgFrontTraction: sumFrontTraction / ticks,
      avgRearTraction: sumRearTraction / ticks,
      frontSlipTicks,
      rearSlipTicks,
      endSpeedKmh: phys.getSpeedKmh(),
      lastCoupling,
    }
  }

  // Asfalto seco (0, 60) com carga moderada (260 Nm): AUTO opera ~96% dianteiro; 4WD divide 50/50; 4WD LOW usa 1ª crawler (4.700:1)
  const asphaltAuto = runToroSurfaceTest('auto', { x: 0, y: 60 }, 2, 260, 120)
  const asphalt4wd = runToroSurfaceTest('4wd', { x: 0, y: 60 }, 2, 260, 120)
  const asphalt4wdLow = runToroSurfaceTest('4wd_low', { x: 0, y: 60 }, 1, 260, 120)

  // Cascalho (140, -140, mu=0.48) sob torque de 330 Nm em 2ª marcha (excede aderência de 1 eixo em AUTO, mas cabe nos 2 eixos em 4WD!)
  const gravelAuto = runToroSurfaceTest('auto', { x: 140, y: -140 }, 2, 330, 120)
  const gravel4wd = runToroSurfaceTest('4wd', { x: 140, y: -140 }, 2, 330, 120)

  // Grama (255, 255, mu=0.35) sob torque de 240 Nm em 2ª marcha por 1.0s
  const grassAuto = runToroSurfaceTest('auto', { x: 255, y: 255 }, 2, 240, 120)
  const grass4wd = runToroSurfaceTest('4wd', { x: 255, y: 255 }, 2, 240, 120)

  // Split-Mu Assimétrico 1: Eixo dianteiro na lama/gelo (mu=0.18) e eixo traseiro no asfalto seco (mu=0.95)
  const splitFrontLowAuto = runToroSurfaceTest('auto', { x: 0, y: 60 }, 2, 380, 120, { front: 0.18, rear: 0.95 })
  const splitFrontLow4wd = runToroSurfaceTest('4wd', { x: 0, y: 60 }, 2, 380, 120, { front: 0.18, rear: 0.95 })
  const splitFrontLow4wdLow = runToroSurfaceTest('4wd_low', { x: 0, y: 60 }, 1, 380, 120, { front: 0.18, rear: 0.95 })

  // Split-Mu Assimétrico 2: Eixo dianteiro no asfalto seco (mu=0.95) e eixo traseiro na lama (mu=0.18)
  const splitRearLow4wd = runToroSurfaceTest('4wd', { x: 0, y: 60 }, 2, 380, 120, { front: 0.95, rear: 0.18 })

  console.log('\n  ┌───────────────────────────────┬────────┬──────────┬──────────┬──────────┬──────────┬───────────┬──────────┐')
  console.log('  │ Cenário Toro Ranch 4x4        │ Modo   │ T_diant  │ T_tras   │ F_diant  │ F_tras   │ Slip D/T  │ Vel.Fim  │')
  console.log('  ├───────────────────────────────┼────────┼──────────┼──────────┼──────────┼──────────┼───────────┼──────────┤')
  for (const [label, r] of [
    ['Asfalto Seco (260Nm, 2ª)', asphaltAuto],
    ['Asfalto Seco (260Nm, 2ª)', asphalt4wd],
    ['Asfalto Seco Crawler (1ª)', asphalt4wdLow],
    ['Cascalho mu=0.48 (330Nm)', gravelAuto],
    ['Cascalho mu=0.48 (330Nm)', gravel4wd],
    ['Grama mu=0.35 (240Nm)', grassAuto],
    ['Grama mu=0.35 (240Nm)', grass4wd],
    ['Split-Mu D=0.18 / T=0.95', splitFrontLowAuto],
    ['Split-Mu D=0.18 / T=0.95', splitFrontLow4wd],
    ['Split-Mu D=0.18 / T=0.95 1ª', splitFrontLow4wdLow],
    ['Split-Mu D=0.95 / T=0.18', splitRearLow4wd],
  ] as const) {
    console.log(
      `  │ ${label.padEnd(29)} │ ${r.mode.padEnd(6)} │ ${r.avgFrontTorque.toFixed(0).padStart(6)}Nm │ ${r.avgRearTorque.toFixed(0).padStart(6)}Nm │ ${r.avgFrontTraction.toFixed(0).padStart(6)} N │ ${r.avgRearTraction.toFixed(0).padStart(6)} N │ ${String(r.frontSlipTicks).padStart(3)}/${String(r.rearSlipTicks).padEnd(3)}tk │ ${r.endSpeedKmh.toFixed(1).padStart(5)}km/h│`,
    )
  }
  console.log('  └───────────────────────────────┴────────┴──────────┴──────────┴──────────┴──────────┴───────────┴──────────┘\n')

  assert(
    asphaltAuto.avgFrontTorque > asphaltAuto.avgRearTorque * 10 &&
      Math.abs(asphalt4wd.avgFrontTorque - asphalt4wd.avgRearTorque) < 1 &&
      asphalt4wdLow.avgFrontTorque > asphalt4wd.avgFrontTorque * 1.6,
    'Em asfalto seco, AUTO prioriza eixo dianteiro (~96/4), 4WD divide 50/50 e 4WD LOW multiplica torque via 1ª crawler (1.65x)',
    `AUTO=${asphaltAuto.avgFrontTorque.toFixed(0)}/${asphaltAuto.avgRearTorque.toFixed(0)}Nm, 4WD=${asphalt4wd.avgFrontTorque.toFixed(0)}/${asphalt4wd.avgRearTorque.toFixed(0)}Nm, LOW=${asphalt4wdLow.avgFrontTorque.toFixed(0)}/${asphalt4wdLow.avgRearTorque.toFixed(0)}Nm`,
  )
  assert(
    gravelAuto.frontSlipTicks > 40 &&
      gravel4wd.frontSlipTicks === 0 &&
      gravel4wd.endSpeedKmh > gravelAuto.endSpeedKmh + 0.8,
    'No cascalho (mu=0.48), AUTO sofre patinamento dianteiro inicial durante o acoplamento reativo, enquanto 4WD traciona sem patinar e atinge maior velocidade',
    `AUTO: slip=${gravelAuto.frontSlipTicks}tk / v=${gravelAuto.endSpeedKmh.toFixed(1)} km/h vs 4WD: slip=${gravel4wd.frontSlipTicks}tk / v=${gravel4wd.endSpeedKmh.toFixed(1)} km/h`,
  )
  assert(
    splitFrontLow4wd.avgRearTraction > splitFrontLowAuto.avgRearTraction * 1.4 &&
      splitFrontLow4wd.endSpeedKmh > splitFrontLowAuto.endSpeedKmh + 5.0,
    'Em aderência assimétrica (dianteira mu=0.18, traseira mu=0.95), 4WD transfere torque imediato ao eixo traseiro e supera AUTO com ampla margem',
    `AUTO v=${splitFrontLowAuto.endSpeedKmh.toFixed(1)} km/h (F_tras=${splitFrontLowAuto.avgRearTraction.toFixed(0)}N) vs 4WD v=${splitFrontLow4wd.endSpeedKmh.toFixed(1)} km/h (F_tras=${splitFrontLow4wd.avgRearTraction.toFixed(0)}N)`,
  )
  assert(
    splitRearLow4wd.avgFrontTraction > splitRearLow4wd.avgRearTraction * 3.0,
    'Em aderência assimétrica inversa (dianteira mu=0.95, traseira mu=0.18), 4WD sustenta tração pelo eixo dianteiro',
    `F_diant=${splitRearLow4wd.avgFrontTraction.toFixed(0)}N vs F_tras=${splitRearLow4wd.avgRearTraction.toFixed(0)}N`,
  )

  // 2B. Curva com aceleração forte no cascalho: AUTO (subesterço por saturação dianteira) vs 4WD (neutro)
  const runToroCorner = (mode: 'auto' | '4wd') => {
    const phys = new VehiclePhysics({
      weight: toro.info.weight,
      wheelDiameter: toro.info.wheelDiameter,
      vehicleId: toro.id,
      chassis: toro.chassis,
      fourWheelDriveMode: mode,
      initialPositionX: 140,
      initialPositionY: -120,
      initialHeadingDeg: 90,
    })
    phys.setSpeedKmh(45)
    let sumYawRate = 0
    let frontSlipCount = 0
    for (let i = 0; i < 90; i++) {
      const r = phys.tick({
        driveTorqueAtTransmission: 330,
        gearRatio: toro.transmission.gearRatios[1].ratio,
        finalDrive: toro.transmission.finalDrive,
        brake: 0,
        deltaTime: 1 / 120,
        steeringAngleRad: 0.32,
        gear: 2,
        isRaining: false,
      })
      sumYawRate += r.yawRate
      if (r.frontAxleSlip) frontSlipCount++
    }
    return { avgYawRate: sumYawRate / 90, frontSlipCount, endHeading: phys.getHeadingDeg() }
  }

  const cornerAuto = runToroCorner('auto')
  const corner4wd = runToroCorner('4wd')
  assert(
    cornerAuto.frontSlipCount > corner4wd.frontSlipCount && corner4wd.avgYawRate > cornerAuto.avgYawRate,
    'Em curva sob aceleração no cascalho, 4WD reduz o patinamento dianteiro do modo AUTO e contorna a curva com menor subesterço',
    `AUTO: frontSlip=${cornerAuto.frontSlipCount}tk, r_med=${cornerAuto.avgYawRate.toFixed(3)} rad/s vs 4WD: frontSlip=${corner4wd.frontSlipCount}tk, r_med=${corner4wd.avgYawRate.toFixed(3)} rad/s`,
  )

  // 2C. Verificação na Store completa (ZF 9HP seleciona 2ª marcha padrão em AUTO/4WD sob aceleração leve e 1ª marcha crawler em 4WD LOW)
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(toro)
  sim.startEngine()
  for (let i = 0; i < 96; i++) sim.update(1 / 120)
  sim.selectShifterMode('D')
  sim.setFourWheelDriveMode('auto')
  const gearInAuto = useSimulationStore.getState().currentGear
  sim.setFourWheelDriveMode('4wd_low')
  const gearInLow = useSimulationStore.getState().currentGear
  assert(
    gearInAuto === 2 && gearInLow === 1,
    'ZF 9HP na Toro Ranch seleciona 2ª marcha (2.840:1) em D-AUTO parado e engata 1ª crawler (4.700:1) ao acionar 4WD LOW',
    `gear_AUTO=${gearInAuto}ª vs gear_4WD_LOW=${gearInLow}ª`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AUDITORIA QUANTITATIVA DA HONDA CB1000R (MOTOCICLETA)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3. Honda CB1000R — Matriz Velocidade × Esterço × Inclinação, Camber Thrust, Transição e Iz')
{
  const cb = loadVehicle('cb1000r')

  const runBikeSteadyCorner = (speedKmh: number, steerRad: number, isRaining = false, ticks = 180) => {
    const phys = new VehiclePhysics({
      weight: cb.info.weight,
      wheelDiameter: cb.info.wheelDiameter,
      vehicleId: cb.id,
      isMotorcycle: true,
      chassis: cb.chassis,
      initialPositionX: -140,
      initialPositionY: 220,
      initialHeadingDeg: 90,
    })
    phys.setSpeedKmh(speedKmh)
    let last = phys.tick({
      driveTorqueAtTransmission: 18,
      gearRatio: cb.transmission.gearRatios[2].ratio,
      finalDrive: cb.transmission.finalDrive,
      brake: 0,
      deltaTime: 1 / 120,
      steeringAngleRad: steerRad,
      gear: 3,
      isRaining,
    })
    for (let i = 1; i < ticks; i++) {
      last = phys.tick({
        driveTorqueAtTransmission: 18,
        gearRatio: cb.transmission.gearRatios[2].ratio,
        finalDrive: cb.transmission.finalDrive,
        brake: 0,
        deltaTime: 1 / 120,
        steeringAngleRad: steerRad,
        gear: 3,
        isRaining,
      })
    }
    return last
  }

  const m10 = runBikeSteadyCorner(10, 0.25, false)
  const m25 = runBikeSteadyCorner(25, 0.25, false)
  const m50 = runBikeSteadyCorner(50, 0.25, false)
  const m80 = runBikeSteadyCorner(80, 0.25, false)
  const m80MaxDry = runBikeSteadyCorner(85, 0.58, false)
  const m80MaxWet = runBikeSteadyCorner(85, 0.58, true)

  console.log('\n  ┌───────────────────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐')
  console.log('  │ Cenário CB1000R               │ Vel km/h │ SteerRad │ Lean (°) │ tan(phi) │ Lat (G)  │ Slip (°) │')
  console.log('  ├───────────────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤')
  for (const [label, r] of [
    ['Baixa Vel. (Guidão)', m10],
    ['Transição (25 km/h)', m25],
    ['Média Vel. (50 km/h)', m50],
    ['Alta Vel. (80 km/h)', m80],
    ['Limite Seco (mu=0.95)', m80MaxDry],
    ['Limite Chuva (mu=0.62)', m80MaxWet],
  ] as const) {
    const tanPhi = Math.tan((r.leanAngleDeg * Math.PI) / 180)
    console.log(
      `  │ ${label.padEnd(29)} │ ${r.speedKmh.toFixed(1).padStart(8)} │ ${r.steeringAngleRad.toFixed(2).padStart(8)} │ ${r.leanAngleDeg.toFixed(2).padStart(8)} │ ${tanPhi.toFixed(3).padStart(8)} │ ${r.lateralAccelG.toFixed(3).padStart(8)} │ ${r.slipAngleDeg.toFixed(2).padStart(8)} │`,
    )
  }
  console.log('  └───────────────────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘\n')

  assert(
    m10.leanAngleDeg < m25.leanAngleDeg && m25.leanAngleDeg < m50.leanAngleDeg && m50.leanAngleDeg < m80.leanAngleDeg,
    'Inclinação (leanAngleDeg) cresce monotonicamente com a velocidade para um mesmo comando de direção',
    `10km/h=${m10.leanAngleDeg.toFixed(1)}° < 25km/h=${m25.leanAngleDeg.toFixed(1)}° < 50km/h=${m50.leanAngleDeg.toFixed(1)}° < 80km/h=${m80.leanAngleDeg.toFixed(1)}°`,
  )

  // Verifica que o empuxo de cambagem (tan(phi)) domina a geração de força lateral em equilíbrio de rolagem (ay ≈ g*tan(phi)) com baixo slipAngleDeg (< 3.5°)
  const tanPhi80 = Math.tan((m80.leanAngleDeg * Math.PI) / 180)
  assert(
    Math.abs(m80.lateralAccelG - tanPhi80) < 0.08 && Math.abs(m80.slipAngleDeg) < 3.5,
    'Força lateral em curva da CB1000R obedece ao equilíbrio físico de rolagem (ay ≈ g*tan(phi)) com baixo ângulo de deriva',
    `ay=${m80.lateralAccelG.toFixed(3)}G vs tan(phi)=${tanPhi80.toFixed(3)}G, slip=${m80.slipAngleDeg.toFixed(2)}°`,
  )

  assert(
    m80MaxDry.leanAngleDeg <= 48.05 && m80MaxDry.leanAngleDeg > 40.0 && m80MaxWet.leanAngleDeg < 31.5,
    'Limite de inclinação respeita teto mecânico/atrito no seco (~42-48°) e reduz automaticamente na chuva (< 31.5°)',
    `seco=${m80MaxDry.leanAngleDeg.toFixed(1)}° (${m80MaxDry.lateralAccelG.toFixed(2)}G) vs chuva=${m80MaxWet.leanAngleDeg.toFixed(1)}° (${m80MaxWet.lateralAccelG.toFixed(2)}G)`,
  )

  assert(
    m80.yawInertiaKgM2 > 50 && m80.yawInertiaKgM2 < 85,
    'Inércia de guinada da CB1000R reflete massa compacta de motocicleta (~71.7 kg·m² em vez do piso de 180 kg·m² de carros)',
    `Iz=${m80.yawInertiaKgM2.toFixed(1)} kg·m²`,
  )
}

console.log('\n═══════════════════════════════════════════════════════════════════════════════')
console.log(` RESULTADO FASE 3.2.2: ${passed} PASSOU · ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════════════════════\n')

if (failed > 0) {
  process.exit(1)
}
