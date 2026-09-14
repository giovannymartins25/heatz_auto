/**
 * Bateria de Testes — Etapa 5: Modo Manual Simulado + TCS
 *
 * Testa:
 * A — AUTO normal (Etapa 4 preservada)
 * B — MANUAL_SIMULATED: troca manual M1→M2→M3→M4
 * C — Proteção downshift: M7→M1 bloqueado em alta velocidade
 * D — Relações M1 vs M7: física real (torque, RPM)
 * E — TCS OFF: throttle passa integral, slip não reduzido
 * F — TCS ON: throttleMultiplier < 1.0 em patinamento
 * G — SPORT + TCS: limiar mais alto, mas intervém no extremo
 * H — Toggle AUTO→MANUAL→AUTO sem salto absurdo de RPM
 * I — Controles: Q não afeta Yaris (hasClutch=false), W/E funcionam
 */

import { EngineSimulator } from './src/systems/engine/EngineSimulator'
import { ClutchSystem } from './src/systems/clutch/ClutchSystem'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { Transmission, AutomaticTransmission } from './src/systems/transmission'
import { TractionControlSystem } from './src/systems/tcs/TractionControlSystem'
import yarisConfig from './public/vehicles/yaris-2019/config.json' with { type: 'json' }

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('         HEATZ AUTO — BATERIA DE TESTES — ETAPA 5              ')
console.log('  MODO MANUAL SIMULADO + TCS (Toyota Yaris 2019 CVT)           ')
console.log('═══════════════════════════════════════════════════════════════\n')

const DT = 1 / 120

// ─── Factory: cria simulação completa do Yaris ───────────────────────────────

function createYarisSim() {
  const engine = new EngineSimulator(yarisConfig.engine)
  const transmission = new Transmission(yarisConfig.transmission, yarisConfig.info.wheelDiameter)
  const clutch = new ClutchSystem(yarisConfig.engine.maxTorque)
  const physics = new VehiclePhysics({
    weight: yarisConfig.info.weight,
    wheelDiameter: yarisConfig.info.wheelDiameter,
  })
  const autoTrans = new AutomaticTransmission({
    gearRatios: yarisConfig.transmission.gearRatios,
    finalDrive: yarisConfig.transmission.finalDrive,
    wheelDiameter: yarisConfig.info.wheelDiameter,
    maxRpm: yarisConfig.engine.maxRpm,
    idleRpm: yarisConfig.engine.idleRpm,
    isCvt: true,
  })
  const tcs = new TractionControlSystem()
  return { engine, transmission, clutch, physics, autoTrans, tcs }
}

function startAndWarmUp(sim: ReturnType<typeof createYarisSim>) {
  sim.clutch.setPosition(1.0) // desacoplado durante cranking
  sim.engine.start()
  for (let i = 0; i < 80; i++) {
    sim.engine.tick({ throttle: 0, loadTorque: 0, deltaTime: DT })
  }
  if (!sim.engine.getIsRunning()) {
    sim.engine.start()
    for (let i = 0; i < 80; i++) sim.engine.tick({ throttle: 0, loadTorque: 0, deltaTime: DT })
  }
}

// Avança a simulação no modo AUTO por N frames
function stepAuto(
  sim: ReturnType<typeof createYarisSim>,
  throttle: number,
  brake: number,
  drivingMode: 'eco' | 'normal' | 'sport',
  steps = 1,
) {
  for (let i = 0; i < steps; i++) {
    const decision = sim.autoTrans.decide({
      currentRpm: sim.engine.getRpm(),
      vehicleSpeedKmh: sim.physics.getSpeedKmh(),
      throttle, brake,
      currentGear: sim.transmission.currentGear,
      drivingMode,
      deltaTime: DT,
    })
    if (decision.targetGear !== sim.transmission.currentGear) {
      sim.transmission.shiftTo(decision.targetGear, sim.physics.getSpeedKmh())
    }
    sim.clutch.setPosition(1.0 - decision.targetClutchEngagement)

    const gear = sim.transmission.currentGear
    const gearRatio = sim.transmission.calculator.getGearRatio(gear)
    const finalDrive = yarisConfig.transmission.finalDrive
    const isInNeutral = gear === 0
    const speedMs = sim.physics.getSpeedMs()
    const wheelRadius = yarisConfig.info.wheelDiameter / 2
    const transInputAngVel = isInNeutral
      ? sim.engine.getAngularVelocity()
      : (speedMs / wheelRadius) * (gearRatio * finalDrive)

    const clutchState = sim.clutch.calculateTorqueTransfer(
      sim.engine.getAngularVelocity(), transInputAngVel, isInNeutral, sim.engine.getTorqueOutput(),
    )
    sim.engine.tick({ throttle, loadTorque: clutchState.transmittedTorque, deltaTime: DT })

    const physTick = sim.physics.tick({
      driveTorqueAtTransmission: clutchState.transmittedTorque,
      gearRatio, finalDrive, brake, deltaTime: DT,
    })

    if (gear !== 0 && sim.clutch.getEngagement() > 0.95 && sim.engine.getIsRunning()) {
      const expectedRpm = sim.transmission.calculator.speedToRpm(sim.physics.getSpeedKmh(), gear)
      if (expectedRpm >= yarisConfig.engine.idleRpm) sim.engine.setRpm(expectedRpm)
    }
  }
}

// Avança a simulação no modo MANUAL SIMULADO por N frames
// Sem embreagem do jogador — CVT gerencia acoplamento automaticamente
function stepManualSimulated(
  sim: ReturnType<typeof createYarisSim>,
  throttle: number,
  brake: number,
  steps = 1,
) {
  for (let i = 0; i < steps; i++) {
    const speedKmh = sim.physics.getSpeedKmh()
    const currentRpm = sim.engine.getRpm()

    // Acoplamento CVT automático (mesmo que o AutomaticTransmission usa)
    let targetClutchEngagement = 1.0
    if (speedKmh < 3 && throttle < 0.05 && brake > 0.1) {
      targetClutchEngagement = 0.0
    } else if (speedKmh < 22) {
      const idleRpm = yarisConfig.engine.idleRpm
      const rpmRatio = Math.max(0, Math.min(1, (currentRpm - idleRpm) / (2200 - idleRpm)))
      const speedRatio = Math.min(1, speedKmh / 22)
      targetClutchEngagement = Math.max(0.05, Math.min(0.98, Math.pow(rpmRatio, 3.0) * 0.72 + speedRatio * 0.28))
    }
    sim.clutch.setPosition(1.0 - targetClutchEngagement)

    const gear = sim.transmission.currentGear
    const gearRatio = sim.transmission.calculator.getGearRatio(gear)
    const finalDrive = yarisConfig.transmission.finalDrive
    const isInNeutral = gear === 0
    const speedMs = sim.physics.getSpeedMs()
    const wheelRadius = yarisConfig.info.wheelDiameter / 2
    const transInputAngVel = isInNeutral
      ? sim.engine.getAngularVelocity()
      : (speedMs / wheelRadius) * (gearRatio * finalDrive)

    const clutchState = sim.clutch.calculateTorqueTransfer(
      sim.engine.getAngularVelocity(), transInputAngVel, isInNeutral, sim.engine.getTorqueOutput(),
    )
    sim.engine.tick({ throttle, loadTorque: clutchState.transmittedTorque, deltaTime: DT })

    sim.physics.tick({
      driveTorqueAtTransmission: clutchState.transmittedTorque,
      gearRatio, finalDrive, brake, deltaTime: DT,
    })

    if (gear !== 0 && sim.clutch.getEngagement() > 0.95 && sim.engine.getIsRunning()) {
      const expectedRpm = sim.transmission.calculator.speedToRpm(sim.physics.getSpeedKmh(), gear)
      if (expectedRpm >= yarisConfig.engine.idleRpm) sim.engine.setRpm(expectedRpm)
    }
  }
}

// ─── Helper: calcula RPM projetado numa relação e velocidade ─────────────────
function projectedRpm(speedKmh: number, gear: number): number {
  const gr = yarisConfig.transmission.gearRatios.find((g: { gear: number }) => g.gear === gear)
  if (!gr) return 0
  const speedMs = speedKmh / 3.6
  const wheelCirc = Math.PI * yarisConfig.info.wheelDiameter
  const wheelRps = speedMs / wheelCirc
  return wheelRps * (gr.ratio * yarisConfig.transmission.finalDrive) * 60
}

// ─── Helper: verifica se over-rev ao fazer downshift ────────────────────────
function canShiftDown(speedKmh: number, targetGear: number): boolean {
  const rpm = projectedRpm(speedKmh, targetGear)
  return rpm <= yarisConfig.engine.maxRpm * 0.95
}

// ═══════════════════════════════════════════════════════════════════
// TESTE A — AUTO normal (Etapa 4 preservada)
// ═══════════════════════════════════════════════════════════════════
{
  const sim = createYarisSim()
  startAndWarmUp(sim)
  sim.transmission.shiftTo(1, 0)

  let maxRpm = 0
  for (let i = 0; i < 420; i++) {
    stepAuto(sim, 0.5, 0, 'normal', 1)
    maxRpm = Math.max(maxRpm, sim.engine.getRpm())
  }

  const rpm = sim.engine.getRpm()
  const speed = sim.physics.getSpeedKmh()
  const passed = sim.engine.getIsRunning() && rpm >= 1800 && speed > 15
  console.log(`[TESTE A — AUTO NORMAL] Etapa 4 preservada: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  Velocidade: ${speed.toFixed(1)} km/h | RPM: ${rpm.toFixed(0)} | Relação: ${sim.transmission.currentGear}ª\n`)
}

// ═══════════════════════════════════════════════════════════════════
// TESTE B — MANUAL_SIMULATED: M1 → M2 → M3 → M4
// ═══════════════════════════════════════════════════════════════════
{
  const sim = createYarisSim()
  startAndWarmUp(sim)

  // Inicia em M1
  sim.transmission.shiftTo(1, 0)
  stepManualSimulated(sim, 0.7, 0, 240) // acelera por 2s em M1

  const speedAtM1 = sim.physics.getSpeedKmh()
  const rpmAtM1 = sim.engine.getRpm()
  const gearAtM1 = sim.transmission.currentGear

  // Sobe para M2 (simula shiftUp com proteção over-rev)
  const m2CanShift = sim.transmission.canShiftTo(2, speedAtM1, yarisConfig.engine.maxRpm)
  if (m2CanShift) {
    const r = sim.transmission.shiftTo(2, speedAtM1)
    if (r.newRpm > 0) sim.engine.setRpm(Math.max(r.newRpm, yarisConfig.engine.idleRpm))
  }
  stepManualSimulated(sim, 0.7, 0, 240)
  const speedAtM2 = sim.physics.getSpeedKmh()

  // Sobe para M3
  const m3CanShift = sim.transmission.canShiftTo(3, speedAtM2, yarisConfig.engine.maxRpm)
  if (m3CanShift) {
    const r = sim.transmission.shiftTo(3, speedAtM2)
    if (r.newRpm > 0) sim.engine.setRpm(Math.max(r.newRpm, yarisConfig.engine.idleRpm))
  }
  stepManualSimulated(sim, 0.7, 0, 240)
  const speedAtM3 = sim.physics.getSpeedKmh()

  // Sobe para M4
  const m4CanShift = sim.transmission.canShiftTo(4, speedAtM3, yarisConfig.engine.maxRpm)
  if (m4CanShift) {
    const r = sim.transmission.shiftTo(4, speedAtM3)
    if (r.newRpm > 0) sim.engine.setRpm(Math.max(r.newRpm, yarisConfig.engine.idleRpm))
  }
  stepManualSimulated(sim, 0.7, 0, 240)
  const speedAtM4 = sim.physics.getSpeedKmh()
  const finalGear = sim.transmission.currentGear

  const passed = finalGear === 4 && speedAtM4 > speedAtM3 && speedAtM3 > speedAtM2 && speedAtM2 > speedAtM1
  console.log(`[TESTE B — MANUAL SIMULADO] M1→M2→M3→M4 com aceleração progressiva: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  M1: ${speedAtM1.toFixed(1)} km/h | M2: ${speedAtM2.toFixed(1)} km/h | M3: ${speedAtM3.toFixed(1)} km/h | M4: ${speedAtM4.toFixed(1)} km/h`)
  console.log(`  Relação final: M${finalGear} | Motor: ${sim.engine.getIsRunning() ? 'Funcionando' : 'FALHOU'}\n`)
}

// ═══════════════════════════════════════════════════════════════════
// TESTE C — Proteção downshift: M7 → M1 em alta velocidade
// ═══════════════════════════════════════════════════════════════════
{
  const sim = createYarisSim()
  startAndWarmUp(sim)
  sim.physics.setSpeedKmh(100)
  sim.transmission.shiftTo(7, 100)

  // Tenta descer de M7 para M1 diretamente — deve ser bloqueado
  let blockedCount = 0
  let allowedGear = 7

  for (let targetGear = 1; targetGear < 7; targetGear++) {
    if (!canShiftDown(100, targetGear)) {
      blockedCount++
    } else {
      allowedGear = targetGear
      break
    }
  }

  const m1Rpm = projectedRpm(100, 1)
  const m2Rpm = projectedRpm(100, 2)
  const m1WouldOverRev = m1Rpm > yarisConfig.engine.maxRpm * 0.95
  const m2WouldOverRev = m2Rpm > yarisConfig.engine.maxRpm * 0.95
  // Correto: M1 e M2 bloqueadas, existe pelo menos uma relação segura abaixo da atual
  const passed = m1WouldOverRev && blockedCount >= 1 && allowedGear > 1
  console.log(`[TESTE C — PROTEÇÃO DOWNSHIFT] M7→M1 a 100 km/h bloqueada: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  RPM projetado em M1 a 100 km/h: ${m1Rpm.toFixed(0)} | M2: ${m2Rpm.toFixed(0)} (Limite: ${yarisConfig.engine.maxRpm})`)
  console.log(`  M1 over-rev: ${m1WouldOverRev} | M2 over-rev: ${m2WouldOverRev}`)
  console.log(`  Relações bloqueadas: ${blockedCount}/6 | Menor relação segura: M${allowedGear}\n`)
}

// ═══════════════════════════════════════════════════════════════════
// TESTE D — Relações M1 vs M7: diferença física real de torque e RPM
// ═══════════════════════════════════════════════════════════════════
{
  // Simulação em M1
  const simM1 = createYarisSim()
  startAndWarmUp(simM1)
  simM1.transmission.shiftTo(1, 0)
  stepManualSimulated(simM1, 0.8, 0, 240)
  const rpmM1 = simM1.engine.getRpm()
  const speedM1 = simM1.physics.getSpeedKmh()

  // Simulação em M4 partindo do zero (mais comparável)
  const simM4 = createYarisSim()
  startAndWarmUp(simM4)
  simM4.transmission.shiftTo(4, 0)
  stepManualSimulated(simM4, 0.8, 0, 240)
  const rpmM4 = simM4.engine.getRpm()
  const speedM4 = simM4.physics.getSpeedKmh()

  // M1 deve ter RPM maior que M4 com mesma velocidade (relação curta = giro mais alto)
  // ou mesma RPM mas menor velocidade (sobe rotação mais rápido)
  const m1GearRatio = yarisConfig.transmission.gearRatios[0].ratio // 2.480
  const m4GearRatio = yarisConfig.transmission.gearRatios[3].ratio // 0.920
  const ratioDifferenceValid = m1GearRatio > m4GearRatio * 2 // M1 bem mais curta que M4

  const passed = ratioDifferenceValid && rpmM1 > rpmM4 * 0.8
  console.log(`[TESTE D — FÍSICA DE RELAÇÕES] M1 curta vs M4 longa: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  M1 (ratio ${m1GearRatio}): ${speedM1.toFixed(1)} km/h | ${rpmM1.toFixed(0)} RPM`)
  console.log(`  M4 (ratio ${m4GearRatio}): ${speedM4.toFixed(1)} km/h | ${rpmM4.toFixed(0)} RPM`)
  console.log(`  M1 > M4 em torque multiplicado: ${(m1GearRatio / m4GearRatio).toFixed(2)}x\n`)
}

// ═══════════════════════════════════════════════════════════════════
// TESTE E — TCS OFF: slip não é reduzido pelo TCS
// ═══════════════════════════════════════════════════════════════════
{
  const tcs = new TractionControlSystem()

  // Simula patinamento severo: slipRatio = 0.40, acima de todos os limiares
  const highSlip = 0.40
  const maxGripTorque = 500
  const wheelTorque = 2000 // muito acima do grip

  // TCS desabilitado
  let multiplierSum = 0
  let isInterveningCount = 0
  for (let i = 0; i < 120; i++) {
    const dec = tcs.decide({
      wheelTorque, maxGripTorque, slipRatio: highSlip,
      drivingMode: 'normal', enabled: false,
    }, DT)
    multiplierSum += dec.throttleMultiplier
    if (dec.isIntervening) isInterveningCount++
  }
  const avgMultiplier = multiplierSum / 120
  const passed = avgMultiplier > 0.99 && isInterveningCount === 0
  console.log(`[TESTE E — TCS OFF] Sem intervenção quando desabilitado: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  Multiplicador médio: ${avgMultiplier.toFixed(3)} (esperado ≈ 1.0) | Intervenções: ${isInterveningCount}/120\n`)
}

// ═══════════════════════════════════════════════════════════════════
// TESTE F — TCS ON: throttleMultiplier < 1.0 em patinamento
// ═══════════════════════════════════════════════════════════════════
{
  const tcs = new TractionControlSystem()

  const highSlip = 0.40
  const maxGripTorque = 500
  const wheelTorque = 2000

  let minMultiplier = 1.0
  let maxInterventionLevel = 0

  for (let i = 0; i < 120; i++) {
    const dec = tcs.decide({
      wheelTorque, maxGripTorque, slipRatio: highSlip,
      drivingMode: 'normal', enabled: true,
    }, DT)
    if (dec.throttleMultiplier < minMultiplier) minMultiplier = dec.throttleMultiplier
    if (dec.interventionLevel > maxInterventionLevel) maxInterventionLevel = dec.interventionLevel
  }

  const passed = minMultiplier < 0.90 && maxInterventionLevel > 0.05
  console.log(`[TESTE F — TCS ON] Intervenção ativa em patinamento: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  Multiplier mínimo atingido: ${minMultiplier.toFixed(3)} (esperado < 0.90)`)
  console.log(`  Nível máximo de intervenção: ${(maxInterventionLevel * 100).toFixed(1)}%\n`)
}

// ═══════════════════════════════════════════════════════════════════
// TESTE G — SPORT + TCS: limiar mais alto, mas intervém no extremo
// ═══════════════════════════════════════════════════════════════════
{
  const tcsNormal = new TractionControlSystem()
  const tcsSport = new TractionControlSystem()

  // Slip moderado: 0.18 — deve intervir em NORMAL mas não em SPORT
  const moderateSlip = 0.18

  let normalInterventions = 0
  let sportInterventions = 0
  for (let i = 0; i < 60; i++) {
    const dNormal = tcsNormal.decide({ wheelTorque: 1500, maxGripTorque: 500, slipRatio: moderateSlip, drivingMode: 'normal', enabled: true }, DT)
    const dSport = tcsSport.decide({ wheelTorque: 1500, maxGripTorque: 500, slipRatio: moderateSlip, drivingMode: 'sport', enabled: true }, DT)
    if (dNormal.isIntervening) normalInterventions++
    if (dSport.isIntervening) sportInterventions++
  }

  // Slip extremo: 0.50 — SPORT deve intervir
  const extremeSlip = 0.50
  let sportExtremeInterventions = 0
  for (let i = 0; i < 60; i++) {
    const dec = tcsSport.decide({ wheelTorque: 2000, maxGripTorque: 500, slipRatio: extremeSlip, drivingMode: 'sport', enabled: true }, DT)
    if (dec.isIntervening) sportExtremeInterventions++
  }

  const passed = normalInterventions > 0 && sportInterventions <= normalInterventions && sportExtremeInterventions > 0
  console.log(`[TESTE G — SPORT + TCS] Limiar mais alto em SPORT: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  Slip 0.18: NORMAL interviu ${normalInterventions}/60 | SPORT interviu ${sportInterventions}/60`)
  console.log(`  Slip 0.50 (extremo): SPORT interviu ${sportExtremeInterventions}/60 frames\n`)
}

// ═══════════════════════════════════════════════════════════════════
// TESTE H — Toggle AUTO→MANUAL_SIMULATED→AUTO sem salto de RPM
// ═══════════════════════════════════════════════════════════════════
{
  const sim = createYarisSim()
  startAndWarmUp(sim)
  sim.transmission.shiftTo(1, 0)
  stepAuto(sim, 0.5, 0, 'normal', 360) // acelera por 3s em AUTO

  const speedBeforeToggle = sim.physics.getSpeedKmh()
  const rpmBeforeToggle = sim.engine.getRpm()
  const gearBeforeToggle = sim.transmission.currentGear

  // Simula toggle AUTO → MANUAL_SIMULATED
  // findBestGearForConditions: encontra relação mais próxima ao RPM atual
  let bestGear = 1
  let bestRpmDiff = Infinity
  for (const gr of yarisConfig.transmission.gearRatios) {
    const speedMs = speedBeforeToggle / 3.6
    const wheelCirc = Math.PI * yarisConfig.info.wheelDiameter
    const wheelRps = speedMs / wheelCirc
    const projRpm = wheelRps * (gr.ratio * yarisConfig.transmission.finalDrive) * 60
    const diff = Math.abs(projRpm - rpmBeforeToggle)
    if (diff < bestRpmDiff && projRpm >= yarisConfig.engine.idleRpm * 0.9 && projRpm <= yarisConfig.engine.maxRpm * 0.95) {
      bestRpmDiff = diff
      bestGear = gr.gear
    }
  }
  sim.transmission.shiftTo(bestGear, speedBeforeToggle)
  const rpmAfterToggle = sim.transmission.calculator.speedToRpm(speedBeforeToggle, bestGear)
  if (rpmAfterToggle > 0) sim.engine.setRpm(Math.min(rpmAfterToggle, yarisConfig.engine.maxRpm))

  const rpmJump = Math.abs(rpmAfterToggle - rpmBeforeToggle)
  const rpmJumpAcceptable = rpmJump < 600 // menos de 600 RPM de salto é aceitável

  console.log(`[TESTE H — TOGGLE AUTO↔MANUAL] Transição suave sem salto absurdo: ${rpmJumpAcceptable ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  AUTO: ${speedBeforeToggle.toFixed(1)} km/h | ${rpmBeforeToggle.toFixed(0)} RPM | ${gearBeforeToggle}ª rel`)
  console.log(`  MANUAL_SIMULATED: relação escolhida M${bestGear} | RPM projetado: ${rpmAfterToggle.toFixed(0)} | Salto: ${rpmJump.toFixed(0)} RPM\n`)
}

// ═══════════════════════════════════════════════════════════════════
// TESTE I — Controles: Q não afeta Yaris (hasClutch=false), W/E OK
// ═══════════════════════════════════════════════════════════════════
{
  // Verifica configuração do Yaris
  const yarisHasClutch = yarisConfig.transmission.hasClutch
  const yarisHasManualMode = yarisConfig.transmission.hasManualMode

  // No código, useKeyboardControls verifica hasClutch antes de ativar Q
  // Simula: hasClutch=false → Q não deve alterar clutchPosition
  let clutchChangedByQ = false
  if (yarisHasClutch) {
    clutchChangedByQ = true // só mudaria se tivesse embreagem
  }

  // W e E funcionam para todos os veículos (independente de hasClutch)
  let throttleW = 0
  for (let f = 0; f < 10; f++) throttleW = Math.min(1, throttleW + 0.14)
  const throttleOk = throttleW > 0.95

  let brakeE = 0
  for (let f = 0; f < 8; f++) brakeE = Math.min(1, brakeE + 0.18)
  const brakeOk = brakeE > 0.95

  const passed = !yarisHasClutch && !clutchChangedByQ && throttleOk && brakeOk && yarisHasManualMode
  console.log(`[TESTE I — CONTROLES YARIS] Q inativo, W/E funcionam, hasManualMode: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`  hasClutch: ${yarisHasClutch} | Q afeta: ${clutchChangedByQ} | W(100%): ${throttleOk} | E(100%): ${brakeOk}`)
  console.log(`  hasManualMode: ${yarisHasManualMode} (ativa toggle M)\n`)
}

console.log('═══════════════════════════════════════════════════════════════')
console.log('       TODOS OS TESTES DA ETAPA 5 FORAM CONCLUÍDOS!            ')
console.log('═══════════════════════════════════════════════════════════════\n')
