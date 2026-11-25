import { EngineSimulator } from './src/systems/engine/EngineSimulator'
import { ClutchSystem } from './src/systems/clutch/ClutchSystem'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { Transmission } from './src/systems/transmission/Transmission'
import golConfig from './public/vehicles/gol-g6/config.json' with { type: 'json' }

console.log('\n======================================================')
console.log('       HEATZ AUTO — BATERIA DE TESTES DA ETAPA 3      ')
console.log('======================================================\n')

const DT = 1 / 120
let passedCount = 0
let failedCount = 0

function recordTest(passed: boolean) {
  if (passed) passedCount++
  else failedCount++
}

function createSim() {
  const engine = new EngineSimulator(golConfig.engine)
  const transmission = new Transmission(golConfig.transmission, golConfig.info.wheelDiameter)
  const clutch = new ClutchSystem(golConfig.engine.maxTorque)
  const physics = new VehiclePhysics({
    weight: golConfig.info.weight,
    wheelDiameter: golConfig.info.wheelDiameter,
  })
  return { engine, transmission, clutch, physics }
}

function step(sim: any, throttle: number, brake: number, steps = 1) {
  for (let i = 0; i < steps; i++) {
    const gear = sim.transmission.currentGear
    const gearRatio = sim.transmission.calculator.getGearRatio(gear)
    const finalDrive = golConfig.transmission.finalDrive
    const isInNeutral = gear === 0

    const speedMs = sim.physics.getSpeedMs()
    const wheelRadius = golConfig.info.wheelDiameter / 2
    const wheelAngVel = speedMs / wheelRadius
    const transInputAngVel = isInNeutral ? sim.engine.getAngularVelocity() : wheelAngVel * (gearRatio * finalDrive)

    const clutchState = sim.clutch.calculateTorqueTransfer(
      sim.engine.getAngularVelocity(),
      transInputAngVel,
      isInNeutral,
      sim.engine.getDrivetrainTorque(throttle),
      DT,
    )

    sim.engine.tick({
      throttle,
      loadTorque: clutchState.loadTorqueOnEngine,
      deltaTime: DT,
    })

    sim.physics.tick({
      driveTorqueAtTransmission: clutchState.transmittedTorque,
      gearRatio,
      finalDrive,
      brake,
      deltaTime: DT,
    gear,
    })

    if (gear !== 0 && sim.clutch.getEngagement() > 0.95 && sim.engine.getIsRunning() && sim.physics.getSpeedKmh() > 1) {
      const expectedRpm = sim.transmission.calculator.speedToRpm(sim.physics.getSpeedKmh(), gear)
      if (expectedRpm > 0) sim.engine.setRpm(expectedRpm)
    }
  }
}

function setClutch(sim: any, pos: number) {
  sim.clutch.setPosition(pos)
  sim.transmission.setClutch(pos)
}

// ─── TESTE A: Soltar embreagem rápido sem acelerar -> Estol ───
{
  const sim = createSim()
  sim.engine.start()
  step(sim, 0, 0, 80) // Partida do motor (~0.67s para completar cranking de 0.55s)
  setClutch(sim, 1.0) // Pressionar embreagem
  sim.transmission.shiftTo(1, 0, undefined, true) // Engatar 1ª
  
  // Soltar embreagem rapidamente para 0% sem acelerar
  setClutch(sim, 0.0)
  step(sim, 0, 0, 60) // 0.5s sob carga

  const passed = sim.engine.getIsStalled() && !sim.engine.getIsRunning()
  recordTest(passed)
  console.log(`[TESTE A] Estol ao soltar embreagem sem acelerador: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`          Status: ${sim.engine.getStatus()} | RPM: ${sim.engine.getRpm().toFixed(0)} | Stalled: ${sim.engine.getIsStalled()}\n`)
}

// ─── TESTE B: Sair suavemente com aceleração e embreagem progressiva ───
{
  const sim = createSim()
  sim.engine.start()
  step(sim, 0, 0, 80)
  setClutch(sim, 1.0)
  sim.transmission.shiftTo(1, 0, undefined, true)
  
  // Acelera a 45% e modula a embreagem progressivamente até embalar
  for (let i = 0; i < 150; i++) {
    const clutchPos = Math.max(0, 1.0 - (i / 120))
    setClutch(sim, clutchPos)
    step(sim, 0.45, 0, 1)
  }
  // Continua acelerando com embreagem 100% solta
  for (let i = 0; i < 60; i++) {
    step(sim, 0.45, 0, 1)
  }

  const passed = sim.engine.getIsRunning() && !sim.engine.getIsStalled() && sim.physics.getSpeedKmh() > 5
  recordTest(passed)
  console.log(`[TESTE B] Arrancada suave com modulação: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`          Velocidade: ${sim.physics.getSpeedKmh().toFixed(1)} km/h | RPM: ${sim.engine.getRpm().toFixed(0)} | Status: ${sim.engine.getStatus()}\n`)
}

// ─── TESTE C: Troca de 1ª para 2ª -> queda de RPM correspondente ───
{
  const sim = createSim()
  sim.engine.start()
  step(sim, 0, 0, 80)
  setClutch(sim, 1.0)
  sim.transmission.shiftTo(1, 0, undefined, true)
  
  // Arrancada inicial modulada
  for (let i = 0; i < 120; i++) {
    const clutchPos = Math.max(0, 1.0 - (i / 100))
    setClutch(sim, clutchPos)
    step(sim, 0.6, 0, 1)
  }
  
  let safetyLoops = 0
  while (sim.physics.getSpeedKmh() < 30 && safetyLoops++ < 1000) {
    step(sim, 0.6, 0, 1)
  }
  const rpmIn1st = sim.engine.getRpm()
  
  // Troca para 2ª marcha com acionamento de embreagem
  setClutch(sim, 1.0)
  sim.transmission.shiftTo(2, sim.physics.getSpeedKmh(), undefined, true)
  setClutch(sim, 0.0)
  step(sim, 0.6, 0, 20)
  const rpmIn2nd = sim.engine.getRpm()

  const passed = rpmIn2nd < rpmIn1st
  recordTest(passed)
  console.log(`[TESTE C] Troca 1ª -> 2ª com queda de RPM: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`          RPM 1ª: ${rpmIn1st.toFixed(0)} -> RPM 2ª: ${rpmIn2nd.toFixed(0)} (Queda de ${(rpmIn1st - rpmIn2nd).toFixed(0)} RPM)\n`)
}

// ─── TESTE D: Comparar aceleração em 1ª vs 5ª ───
{
  const sim1 = createSim()
  sim1.engine.start()
  step(sim1, 0, 0, 80)
  setClutch(sim1, 1.0)
  sim1.transmission.shiftTo(1, 0, undefined, true)
  // Arrancada rápida em 1ª
  for (let i = 0; i < 60; i++) {
    setClutch(sim1, Math.max(0, 1.0 - (i / 50)))
    step(sim1, 1.0, 0, 1)
  }
  step(sim1, 1.0, 0, 60)
  const speed1st = sim1.physics.getSpeedKmh()

  const sim5 = createSim()
  sim5.engine.start()
  step(sim5, 0, 0, 80)
  setClutch(sim5, 1.0)
  sim5.transmission.shiftTo(5, 0, undefined, true)
  sim5.engine.setRpm(1500)
  // Arrancada forçada em 5ª marcha
  for (let i = 0; i < 60; i++) {
    setClutch(sim5, Math.max(0, 1.0 - (i / 50)))
    step(sim5, 1.0, 0, 1)
  }
  step(sim5, 1.0, 0, 60)
  const speed5th = sim5.physics.getSpeedKmh()

  const passed = speed1st > speed5th * 1.5
  recordTest(passed)
  console.log(`[TESTE D] Comparação de aceleração (Peso das Marchas): ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`          Ganho em 1s na 1ª: ${speed1st.toFixed(1)} km/h vs 5ª: ${speed5th.toFixed(1)} km/h\n`)
}

// ─── TESTE E: Marcha alta + baixa velocidade -> perda de RPM/carga ───
{
  const sim = createSim()
  sim.engine.start()
  step(sim, 0, 0, 80)
  setClutch(sim, 1.0)
  sim.transmission.shiftTo(5, 0, undefined, true)
  sim.physics.setSpeedKmh(15)
  sim.engine.setRpm(600)
  setClutch(sim, 0.0)
  step(sim, 0.05, 0, 60)

  const passed = sim.engine.getRpm() < 600
  recordTest(passed)
  console.log(`[TESTE E] Sub-rotação em 5ª a baixa velocidade (Engasgo/Carga): ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`          RPM sob carga da 5ª: ${sim.engine.getRpm().toFixed(1)} RPM\n`)
}

// ─── TESTE F: Salvar o motor pressionando embreagem antes de morrer ───
{
  const sim = createSim()
  sim.engine.start()
  step(sim, 0, 0, 80)
  setClutch(sim, 1.0)
  sim.transmission.shiftTo(1, 0, undefined, true)
  
  // Solta embreagem ligeiramente sem acelerar, RPM começa a afogar
  setClutch(sim, 0.55)
  step(sim, 0, 0, 8)
  const rpmLow = sim.engine.getRpm()

  // Pisa fundo na embreagem para salvar!
  setClutch(sim, 1.0)
  step(sim, 0, 0, 60) // Idle controller recupera rotação
  const rpmRecovered = sim.engine.getRpm()

  const passed = rpmRecovered > rpmLow && sim.engine.getIsRunning() && !sim.engine.getIsStalled()
  recordTest(passed)
  console.log(`[TESTE F] Salvar o motor acionando embreagem a tempo: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`          RPM em queda: ${rpmLow.toFixed(0)} -> Recuperado pós-embreagem: ${rpmRecovered.toFixed(0)} RPM\n`)
}

// ─── TESTE G: Intensidade de frenagem 0%, 50%, 100% ───
{
  function testBrake(brakeVal: number) {
    const sim = createSim()
    sim.physics.setSpeedKmh(80)
    step(sim, 0, brakeVal, 60) // 0.5s de frenagem
    return 80 - sim.physics.getSpeedKmh()
  }

  const drop0 = testBrake(0)
  const drop50 = testBrake(0.5)
  const drop100 = testBrake(1.0)

  const passed = drop100 > drop50 && drop50 > drop0
  recordTest(passed)
  console.log(`[TESTE G] Graduação da frenagem proporcional: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`          Queda em 0.5s: Freio 0% = ${drop0.toFixed(1)} km/h | Freio 50% = ${drop50.toFixed(1)} km/h | Freio 100% = ${drop100.toFixed(1)} km/h\n`)
}

console.log('======================================================')
console.log(`       RESULTADO: ${passedCount} PASSARAM | ${failedCount} FALHARAM       `)
console.log('======================================================\n')
if (failedCount > 0) process.exitCode = 1
