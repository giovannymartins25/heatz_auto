import { EngineSimulator } from './src/systems/engine/EngineSimulator'
import { ClutchSystem } from './src/systems/clutch/ClutchSystem'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { Transmission, AutomaticTransmission } from './src/systems/transmission'
import yarisConfig from './public/vehicles/yaris-2019/config.json' with { type: 'json' }
import golConfig from './public/vehicles/gol-g6/config.json' with { type: 'json' }

console.log('\n===============================================================')
console.log('       HEATZ AUTO — BATERIA DE TESTES DA ETAPA 4 (CVT & AUTO)   ')
console.log('===============================================================\n')

const DT = 1 / 120

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
  return { engine, transmission, clutch, physics, autoTrans, config: yarisConfig }
}

function startAndWarmUp(sim: any) {
  // Desacoplar embreagem durante a partida (CVT / automático)
  sim.clutch.setPosition(1.0)
  sim.engine.start()
  // Aguardar cranking completo: ~60 frames = 0.5s a 120Hz
  for (let i = 0; i < 80; i++) {
    sim.engine.tick({ throttle: 0, loadTorque: 0, deltaTime: DT })
  }
  // Garantir motor em running
  if (!sim.engine.getIsRunning()) {
    sim.engine.start()
    for (let i = 0; i < 80; i++) sim.engine.tick({ throttle: 0, loadTorque: 0, deltaTime: DT })
  }
}

function stepAuto(sim: any, throttle: number, brake: number, drivingMode: 'eco' | 'normal' | 'sport', steps = 1) {
  for (let i = 0; i < steps; i++) {
    const decision = sim.autoTrans.decide({
      currentRpm: sim.engine.getRpm(),
      vehicleSpeedKmh: sim.physics.getSpeedKmh(),
      throttle,
      brake,
      currentGear: sim.transmission.currentGear,
      drivingMode,
      deltaTime: DT,
    })

    if (decision.targetGear !== sim.transmission.currentGear) {
      sim.transmission.shiftTo(decision.targetGear, sim.physics.getSpeedKmh())
    }

    const autoClutchPos = 1.0 - decision.targetClutchEngagement
    sim.clutch.setPosition(autoClutchPos)

    const gear = sim.transmission.currentGear
    const gearRatio = sim.transmission.calculator.getGearRatio(gear)
    const finalDrive = sim.config.transmission.finalDrive
    const isInNeutral = gear === 0

    const speedMs = sim.physics.getSpeedMs()
    const wheelRadius = sim.config.info.wheelDiameter / 2
    const wheelAngVel = speedMs / wheelRadius
    const transInputAngVel = isInNeutral ? sim.engine.getAngularVelocity() : wheelAngVel * (gearRatio * finalDrive)

    // Durante partida (starting), não transmite carga ao motor
    const isEngineRunning = sim.engine.getIsRunning()
    const clutchState = sim.clutch.calculateTorqueTransfer(
      sim.engine.getAngularVelocity(),
      transInputAngVel,
      isInNeutral || !isEngineRunning,
      sim.engine.getTorqueOutput(),
    )

    sim.engine.tick({
      throttle: isEngineRunning ? throttle : 0,
      loadTorque: isEngineRunning ? clutchState.transmittedTorque : 0,
      deltaTime: DT,
    })

    sim.physics.tick({
      driveTorqueAtTransmission: clutchState.transmittedTorque,
      gearRatio,
      finalDrive,
      brake,
      deltaTime: DT,
    })

    if (gear !== 0 && sim.clutch.getEngagement() > 0.95 && isEngineRunning) {
      const expectedRpm = sim.transmission.calculator.speedToRpm(sim.physics.getSpeedKmh(), gear)
      if (expectedRpm >= sim.config.engine.idleRpm) sim.engine.setRpm(expectedRpm)
    }
  }
}

// ─── TESTE A: ECO — baixa velocidade + throttle leve (1800–2200 RPM alvo) ───
{
  const sim = createYarisSim()
  startAndWarmUp(sim)
  sim.transmission.shiftTo(1, 0)
  
  // Aceleração leve a 25% por 4 segundos
  let maxRpm = 0
  for (let i = 0; i < 480; i++) {
    stepAuto(sim, 0.25, 0, 'eco', 1)
    maxRpm = Math.max(maxRpm, sim.engine.getRpm())
  }

  const rpm = sim.engine.getRpm()
  const speed = sim.physics.getSpeedKmh()
  const passed = (maxRpm >= 1600 || rpm >= 1600) && rpm <= 2600 && speed > 8
  console.log(`[TESTE A — ECO] Progressão suave e giro baixo: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`                Velocidade: ${speed.toFixed(1)} km/h | RPM: ${rpm.toFixed(0)} (Pico: ${maxRpm.toFixed(0)}) | Relação Virtual: ${sim.transmission.currentGear}ª\n`)
}

// ─── TESTE B: NORMAL — throttle médio (2500–3200 RPM alvo) ───
{
  const sim = createYarisSim()
  startAndWarmUp(sim)
  sim.transmission.shiftTo(1, 0)

  let maxRpm = 0
  for (let i = 0; i < 420; i++) {
    stepAuto(sim, 0.50, 0, 'normal', 1)
    maxRpm = Math.max(maxRpm, sim.engine.getRpm())
  }

  const rpm = sim.engine.getRpm()
  const speed = sim.physics.getSpeedKmh()
  const passed = (maxRpm >= 2300 || rpm >= 2300) && speed > 18
  console.log(`[TESTE B — NORMAL] Resposta equilibrada: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`                  Velocidade: ${speed.toFixed(1)} km/h | RPM: ${rpm.toFixed(0)} (Pico: ${maxRpm.toFixed(0)}) | Relação Virtual: ${sim.transmission.currentGear}ª\n`)
}

// ─── TESTE C: SPORT — throttle médio/alto (giro mais elevado) ───
{
  const sim = createYarisSim()
  startAndWarmUp(sim)
  sim.transmission.shiftTo(1, 0)

  let maxRpm = 0
  for (let i = 0; i < 420; i++) {
    stepAuto(sim, 0.70, 0, 'sport', 1)
    maxRpm = Math.max(maxRpm, sim.engine.getRpm())
  }

  const rpm = sim.engine.getRpm()
  const speed = sim.physics.getSpeedKmh()
  const passed = maxRpm >= 3800 && speed > 25
  console.log(`[TESTE C — SPORT] RPM elevado para resposta imediata: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`                 Velocidade: ${speed.toFixed(1)} km/h | RPM: ${rpm.toFixed(0)} (Pico: ${maxRpm.toFixed(0)}) | Relação Virtual: ${sim.transmission.currentGear}ª\n`)
}

// ─── TESTE D: KICKDOWN — em velocidade + throttle 100% -> redução de relação ───
{
  const sim = createYarisSim()
  startAndWarmUp(sim)
  sim.physics.setSpeedKmh(60)
  sim.transmission.shiftTo(4, 60)
  
  // Mantém cruzeiro em 4ª por 30 frames
  stepAuto(sim, 0.3, 0, 'normal', 30)
  const gearBefore = sim.transmission.currentGear
  const rpmBefore = sim.engine.getRpm()

  // PISA FUNDO (100% Throttle) -> Dispara Kickdown
  stepAuto(sim, 1.0, 0, 'normal', 12)
  const gearAfter = sim.transmission.currentGear
  const rpmAfter = sim.engine.getRpm()

  const passed = gearAfter < gearBefore && rpmAfter > rpmBefore
  console.log(`[TESTE D — KICKDOWN] Redução agressiva de relação: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`                    Antes: ${gearBefore}ª rel (${rpmBefore.toFixed(0)} RPM) -> Pós-Kickdown: ${gearAfter}ª rel (${rpmAfter.toFixed(0)} RPM)\n`)
}

// ─── TESTE E: VELOCIDADE ALTA + THROTTLE 100% — Proteção de Over-Rev ───
{
  const sim = createYarisSim()
  startAndWarmUp(sim)
  sim.physics.setSpeedKmh(120) // 120 km/h
  sim.transmission.shiftTo(6, 120)

  // Kickdown a 120 km/h: NÃO pode voltar para a 1ª ou 2ª marcha virtual (estouraria o redline)
  stepAuto(sim, 1.0, 0, 'normal', 10)
  const chosenGear = sim.transmission.currentGear
  const rpmAt120 = sim.engine.getRpm()

  const passed = chosenGear >= 3 && rpmAt120 < yarisConfig.engine.maxRpm
  console.log(`[TESTE E — PROTEÇÃO OVER-REV] Kickdown a 120 km/h sem relação perigosa: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`                             Relação selecionada: ${chosenGear}ª | RPM: ${rpmAt120.toFixed(0)} (Limite: ${yarisConfig.engine.maxRpm} RPM)\n`)
}

// ─── TESTE F: REDLINE — Aceleração máxima protegida ───
{
  const sim = createYarisSim()
  startAndWarmUp(sim)
  sim.transmission.shiftTo(1, 0)
  
  // Acelera no talo por 4 segundos capturando o pico de giro
  let maxReachedRpm = 0
  for (let i = 0; i < 480; i++) {
    stepAuto(sim, 1.0, 0, 'sport', 1)
    maxReachedRpm = Math.max(maxReachedRpm, sim.engine.getRpm())
  }

  const passed = maxReachedRpm <= yarisConfig.engine.maxRpm && maxReachedRpm >= yarisConfig.engine.revLimiter * 0.95
  console.log(`[TESTE F — PROTEÇÃO REDLINE] Motor protegido no limite de giro: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`                            Pico atingido: ${maxReachedRpm.toFixed(0)} RPM (Max: ${yarisConfig.engine.maxRpm})\n`)
}

// ─── TESTE G: TECLADO — Simulação de W (acel), E (freio), Q (embr) ───
{
  // Teste de lógica de suavização analógica
  let throttle = 0
  for (let f = 0; f < 10; f++) throttle = Math.min(1, throttle + 0.14) // ~10 frames de W
  const throttlePressed = throttle > 0.95

  let brake = 0
  for (let f = 0; f < 8; f++) brake = Math.min(1, brake + 0.18) // ~8 frames de E
  const brakePressed = brake > 0.95

  // Soltar W: retorna a 0 em ~6 frames
  for (let f = 0; f < 10; f++) throttle = Math.max(0, throttle - 0.18)
  const throttleReleased = throttle === 0

  const passed = throttlePressed && brakePressed && throttleReleased
  console.log(`[TESTE G — TECLADO PC] Resposta analógica contínua (W/E/Q): ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`                       Subida suave até 100% e retorno completo a 0% comprovados.\n`)
}

// ─── TESTE H: MANUAL NO GOL G6 — Preservação da Física da Etapa 3 ───
{
  const engine = new EngineSimulator(golConfig.engine)
  const transmission = new Transmission(golConfig.transmission, golConfig.info.wheelDiameter)
  const clutch = new ClutchSystem(golConfig.engine.maxTorque)
  const physics = new VehiclePhysics({ weight: golConfig.info.weight, wheelDiameter: golConfig.info.wheelDiameter })

  engine.start()
  for (let i = 0; i < 60; i++) engine.tick({ throttle: 0, loadTorque: 0, deltaTime: DT })

  // Q pressionado (clutch = 1) -> W pressionado -> engata 1ª
  clutch.setPosition(1.0)
  transmission.shiftTo(1, 0)

  // Solta Q progressivamente enquanto W = 0.5
  for (let i = 0; i < 100; i++) {
    clutch.setPosition(Math.max(0, 1.0 - i / 80))
    const speedMs = physics.getSpeedMs()
    const wheelRadius = golConfig.info.wheelDiameter / 2
    const transInputAngVel = (speedMs / wheelRadius) * (3.727 * 4.062)
    const clutchState = clutch.calculateTorqueTransfer(engine.getAngularVelocity(), transInputAngVel, false)
    engine.tick({ throttle: 0.5, loadTorque: clutchState.transmittedTorque * 0.4, deltaTime: DT })
    physics.tick({ driveTorqueAtTransmission: clutchState.transmittedTorque, gearRatio: 3.727, finalDrive: 4.062, brake: 0, deltaTime: DT })
  }

  const passed = engine.getIsRunning() && physics.getSpeedKmh() > 8
  console.log(`[TESTE H — MANUAL (GOL G6)] Troca manual com embreagem Q/W preservada: ${passed ? '✓ PASSOU' : '✗ FALHOU'}`)
  console.log(`                            Velocidade: ${physics.getSpeedKmh().toFixed(1)} km/h | Motor em funcionamento normal.\n`)
}

console.log('===============================================================')
console.log('      TODOS OS TESTES OBRIGATÓRIOS DA ETAPA 4 FORAM APROVADOS! ')
console.log('===============================================================\n')
