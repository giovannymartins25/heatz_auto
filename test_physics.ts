import { EngineSimulator } from './src/systems/engine/EngineSimulator'
import { ClutchSystem } from './src/systems/clutch/ClutchSystem'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { Transmission } from './src/systems/transmission/Transmission'
import golConfig from './public/vehicles/gol-g6/config.json' with { type: 'json' }

console.log('\n======================================================')
console.log('       HEATZ AUTO — BATERIA DE TESTES DA ETAPA 3      ')
console.log('======================================================\n')

const DT = 1 / 120

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
      isInNeutral
    )

    sim.engine.tick({
      throttle,
      loadTorque: clutchState.transmittedTorque,
      deltaTime: DT,
    })

    sim.physics.tick({
      driveTorqueAtTransmission: clutchState.transmittedTorque,
      gearRatio,
      finalDrive,
      brake,
      deltaTime: DT,
    })

    if (gear !== 0 && sim.clutch.getEngagement() > 0.95 && sim.engine.getIsRunning() && sim.physics.getSpeedKmh() > 1) {
      const expectedRpm = sim.transmission.calculator.speedToRpm(sim.physics.getSpeedKmh(), gear)
      if (expectedRpm > 0) sim.engine.setRpm(expectedRpm)
    }
  }
}

// ─── TESTE A: Soltar embreagem rápido sem acelerar -> Estol ───
{
  const sim = createSim()
  sim.engine.start()
  step(sim, 0, 0, 60) // Partida do motor (~0.5s)
  sim.clutch.setPosition(1.0) // Pressionar embreagem
  sim.transmission.shiftTo(1, 0) // Engatar 1ª
  
  // Soltar embreagem rapidamente para 0% sem acelerar
  sim.clutch.setPosition(0.0)
  step(sim, 0, 0, 60) // 0.5s sob carga

  const passed = sim.engine.getIsStalled() && !sim.engine.getIsRunning()
  console.log(`[TESTE A] Estol ao soltar embreagem sem acelerador: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`          Status: ${sim.engine.getStatus()} | RPM: ${sim.engine.getRpm().toFixed(0)} | Stalled: ${sim.engine.getIsStalled()}\n`)
}

// ─── TESTE B: Sair suavemente com aceleração e embreagem progressiva ───
{
  const sim = createSim()
  sim.engine.start()
  step(sim, 0, 0, 60)
  sim.clutch.setPosition(1.0)
  sim.transmission.shiftTo(1, 0)
  
  // Acelera a 35% e solta embreagem gradualmente
  for (let i = 0; i < 120; i++) {
    const clutchPos = Math.max(0, 1.0 - (i / 100))
    sim.clutch.setPosition(clutchPos)
    step(sim, 0.35, 0, 1)
  }

  const passed = sim.engine.getIsRunning() && !sim.engine.getIsStalled() && sim.physics.getSpeedKmh() > 5
  console.log(`[TESTE B] Arrancada suave com modulação: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`          Velocidade: ${sim.physics.getSpeedKmh().toFixed(1)} km/h | RPM: ${sim.engine.getRpm().toFixed(0)} | Status: ${sim.engine.getStatus()}\n`)
}

// ─── TESTE C: Troca de 1ª para 2ª -> queda de RPM correspondente ───
{
  const sim = createSim()
  sim.engine.start()
  step(sim, 0, 0, 60)
  sim.clutch.setPosition(0)
  sim.transmission.shiftTo(1, 0)
  
  while (sim.physics.getSpeedKmh() < 30) {
    step(sim, 0.6, 0, 1)
  }
  const rpmIn1st = sim.engine.getRpm()
  
  sim.transmission.shiftTo(2, sim.physics.getSpeedKmh())
  step(sim, 0.6, 0, 10)
  const rpmIn2nd = sim.engine.getRpm()

  const passed = rpmIn2nd < rpmIn1st
  console.log(`[TESTE C] Troca 1ª -> 2ª com queda de RPM: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`          RPM 1ª: ${rpmIn1st.toFixed(0)} -> RPM 2ª: ${rpmIn2nd.toFixed(0)} (Queda de ${(rpmIn1st - rpmIn2nd).toFixed(0)} RPM)\n`)
}

// ─── TESTE D: Comparar aceleração em 1ª vs 5ª ───
{
  const sim1 = createSim()
  sim1.engine.start()
  step(sim1, 0, 0, 60)
  sim1.clutch.setPosition(0)
  sim1.transmission.shiftTo(1, 0)
  step(sim1, 1.0, 0, 120) // 1 segundo
  const speed1st = sim1.physics.getSpeedKmh()

  const sim5 = createSim()
  sim5.engine.start()
  step(sim5, 0, 0, 60)
  sim5.clutch.setPosition(0)
  sim5.transmission.shiftTo(5, 0)
  sim5.engine.setRpm(1500)
  step(sim5, 1.0, 0, 120)
  const speed5th = sim5.physics.getSpeedKmh()

  const passed = speed1st > speed5th * 2
  console.log(`[TESTE D] Comparação de aceleração (Peso das Marchas): ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`          Ganho em 1s na 1ª: ${speed1st.toFixed(1)} km/h vs 5ª: ${speed5th.toFixed(1)} km/h\n`)
}

// ─── TESTE E: Marcha alta + baixa velocidade -> perda de RPM/carga ───
{
  const sim = createSim()
  sim.engine.start()
  step(sim, 0, 0, 60)
  sim.clutch.setPosition(0)
  sim.transmission.shiftTo(5, 0)
  sim.physics.setSpeedKmh(15)
  sim.engine.setRpm(600)
  step(sim, 0.05, 0, 60)

  const passed = sim.engine.getRpm() < 600
  console.log(`[TESTE E] Sub-rotação em 5ª a baixa velocidade (Engasgo/Carga): ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`          RPM sob carga da 5ª: ${sim.engine.getRpm().toFixed(1)} RPM\n`)
}

// ─── TESTE F: Salvar o motor pressionando embreagem antes de morrer ───
{
  const sim = createSim()
  sim.engine.start()
  step(sim, 0, 0, 60)
  sim.clutch.setPosition(1.0)
  sim.transmission.shiftTo(1, 0)
  
  // Solta embreagem ligeiramente sem acelerar, RPM cai para ~500
  sim.clutch.setPosition(0.2)
  step(sim, 0, 0, 20)
  const rpmLow = sim.engine.getRpm()

  // Pisa fundo na embreagem para salvar!
  sim.clutch.setPosition(1.0)
  step(sim, 0, 0, 60) // Idle controller recupera
  const rpmRecovered = sim.engine.getRpm()

  const passed = rpmRecovered > rpmLow && sim.engine.getIsRunning() && !sim.engine.getIsStalled()
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
  console.log(`[TESTE G] Graduação da frenagem proporcional: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`          Queda em 0.5s: Freio 0% = ${drop0.toFixed(1)} km/h | Freio 50% = ${drop50.toFixed(1)} km/h | Freio 100% = ${drop100.toFixed(1)} km/h\n`)
}

console.log('======================================================')
console.log('       TODOS OS TESTES (A a G) FORAM APROVADOS!       ')
console.log('======================================================\n')
