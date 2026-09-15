/**
 * Bateria de Testes — ETAPA 7: FÍSICA REAL DA EMBREAGEM, TROCA DE MARCHAS E AFOGAMENTO
 *
 * TESTE A — Embreagem 100% pressionada: motor não transmite torque às rodas
 * TESTE B — Embreagem 0% (solta/acoplada): torque transmitido normalmente
 * TESTE C — Zona de patinação: clutch parcial -> slipRpm > 0
 * TESTE D — Saída suave: 1ª + acelerador moderado + soltura progressiva -> carro acelera sem afogar
 * TESTE E — Saída errada: 1ª + throttle=0 + clutch soltando -> motor afoga (STALLED)
 * TESTE F — Afogamento parado: 1ª + clutch=0 + parado + throttle=0 -> motor afoga
 * TESTE G — Salvar motor: RPM caindo + pisar embreagem -> motor recupera idle
 * TESTE H — Troca correta: 1ª -> 2ª com clutch >= 0.95 -> sucesso
 * TESTE I — Troca sem embreagem: 1ª -> 2ª com clutch < 0.95 -> bloqueada (clutch_required)
 * TESTE J — Bog: marcha alta + baixa velocidade -> RPM cai naturalmente
 * TESTE K — Downshift perigoso: 5ª -> 2ª em alta velocidade -> bloqueada (over_rev)
 * TESTE L — Yaris CVT: não usa clutch, sem afogamento, hasClutch=false
 * TESTE M — CB1000R manual: exige clutch para troca, over-rev protegido
 * TESTE N — PedalInputSystem: W/E/Q interpolação progressiva correta
 */

import { EngineSimulator } from './src/systems/engine/EngineSimulator'
import { ClutchSystem } from './src/systems/clutch/ClutchSystem'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { Transmission } from './src/systems/transmission/Transmission'
import { PedalInputSystem } from './src/systems/vehicle/PedalInputSystem'
import golConfig from './public/vehicles/gol-g6/config.json' with { type: 'json' }
import cbConfig from './public/vehicles/cb1000r/config.json' with { type: 'json' }
import yarisConfig from './public/vehicles/yaris-2019/config.json' with { type: 'json' }

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('         HEATZ AUTO — BATERIA DE TESTES — ETAPA 7              ')
console.log('     FÍSICA REAL DA EMBREAGEM, STALL, BOG E TROCA DE MARCHAS   ')
console.log('═══════════════════════════════════════════════════════════════\n')

const DT = 1 / 120

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeGol() {
  const engine = new EngineSimulator(golConfig.engine as any)
  const trans = new Transmission(golConfig.transmission as any, golConfig.info.wheelDiameter)
  const clutch = new ClutchSystem(golConfig.engine.maxTorque)
  const physics = new VehiclePhysics({
    weight: golConfig.info.weight,
    wheelDiameter: golConfig.info.wheelDiameter,
    isMotorcycle: false,
  })
  return { engine, trans, clutch, physics }
}

function makeCb() {
  const engine = new EngineSimulator(cbConfig.engine as any)
  const trans = new Transmission(cbConfig.transmission as any, cbConfig.info.wheelDiameter)
  const clutch = new ClutchSystem(cbConfig.engine.maxTorque)
  const physics = new VehiclePhysics({
    weight: cbConfig.info.weight,
    wheelDiameter: cbConfig.info.wheelDiameter,
    isMotorcycle: true,
  })
  return { engine, trans, clutch, physics }
}

/**
 * Simula N ticks com embreagem fixa e throttle fixo.
 * Retorna o estado final do motor.
 */
function runTicks(
  engine: EngineSimulator,
  clutch: ClutchSystem,
  trans: Transmission,
  physics: VehiclePhysics,
  opts: {
    throttle?: number
    clutchPos?: number
    gear?: number
    ticks?: number
  },
) {
  const { throttle = 0, clutchPos = 0, gear = 1, ticks = 120 } = opts
  clutch.setPosition(clutchPos)
  if (trans.currentGear !== gear) trans.shiftTo(gear, 0)

  for (let i = 0; i < ticks; i++) {
    const wheelRadius = golConfig.info.wheelDiameter / 2
    const speedMs = physics.getSpeedMs()
    const wheelAngVel = speedMs / wheelRadius
    const gearRatio = trans.calculator.getGearRatio(gear)
    const finalDrive = (golConfig.transmission as any).finalDrive
    const isNeutral = gear === 0
    const transInputAngVel = isNeutral ? engine.getAngularVelocity() : wheelAngVel * (gearRatio * finalDrive)

    const clutchState = clutch.calculateTorqueTransfer(
      engine.getAngularVelocity(),
      transInputAngVel,
      isNeutral,
      engine.getTorqueOutput(),
      DT,
    )

    engine.tick({
      throttle,
      loadTorque: clutchState.loadTorqueOnEngine,
      deltaTime: DT,
    })

    physics.tick({
      driveTorqueAtTransmission: clutchState.transmittedTorque,
      gearRatio,
      finalDrive,
      brake: 0,
      deltaTime: DT,
    })
  }
}

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail: string) {
  if (condition) {
    console.log(`✓ PASSOU | ${name}`)
    console.log(`  ${detail}`)
    passed++
  } else {
    console.log(`✗ FALHOU | ${name}`)
    console.log(`  ${detail}`)
    failed++
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE A — Embreagem 100% pressionada: torque 0 às rodas
// ═══════════════════════════════════════════════════════════════════════════
{
  const clutch = new ClutchSystem(golConfig.engine.maxTorque)
  clutch.setPosition(1.0) // 100% pressionada = desacoplada
  const state = clutch.calculateTorqueTransfer(400, 0, false, 120, DT)

  check(
    'TESTE A — Clutch 100% pressionado',
    state.transmittedTorque === 0 && state.engagement === 0,
    `transmittedTorque=${state.transmittedTorque.toFixed(1)}Nm | engagement=${state.engagement.toFixed(3)}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE B — Embreagem 0% (solta/acoplada): torque transmitido
// ═══════════════════════════════════════════════════════════════════════════
{
  const clutch = new ClutchSystem(golConfig.engine.maxTorque)
  clutch.setPosition(0.0) // 0% = totalmente acoplada
  const state = clutch.calculateTorqueTransfer(200, 200, false, 120, DT)

  check(
    'TESTE B — Clutch 0% (acoplada): torque transmitido',
    state.engagement >= 0.99 && state.transmittedTorque > 0,
    `engagement=${state.engagement.toFixed(3)} | transmittedTorque=${state.transmittedTorque.toFixed(1)}Nm`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE C — Clutch parcial na zona de patinação
// ═══════════════════════════════════════════════════════════════════════════
{
  const clutch = new ClutchSystem(golConfig.engine.maxTorque)
  clutch.setPosition(0.5) // zona de atrito
  const engineRad = 2000 * (Math.PI / 30) // 2000 RPM
  const transRad = 500 * (Math.PI / 30)   // 500 RPM (grande diferença)
  const state = clutch.calculateTorqueTransfer(engineRad, transRad, false, 80, DT)

  check(
    'TESTE C — Clutch 50%: zona de patinação ativa',
    state.isSlipping && state.slipRpm > 100,
    `isSlipping=${state.isSlipping} | slipRpm=${state.slipRpm.toFixed(0)} | engagement=${state.engagement.toFixed(3)}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE D — Saída suave: throttle moderado + soltura progressiva
// ═══════════════════════════════════════════════════════════════════════════
{
  const { engine, trans, clutch, physics } = makeGol()
  engine.start()
  // Dar partida
  for (let i = 0; i < 60; i++) {
    engine.tick({ throttle: 0, loadTorque: 0, deltaTime: DT })
  }
  trans.shiftTo(1, 0)

  // Soltura progressiva da embreagem (0.4s) com throttle moderado
  for (let i = 0; i < 48; i++) {
    const clutchPos = 1.0 - (i / 48)
    clutch.setPosition(clutchPos)
    const wheelRadius = golConfig.info.wheelDiameter / 2
    const speedMs = physics.getSpeedMs()
    const wheelAngVel = speedMs / wheelRadius
    const gearRatio = trans.calculator.getGearRatio(1)
    const finalDrive = (golConfig.transmission as any).finalDrive
    const transInputAngVel = wheelAngVel * (gearRatio * finalDrive)

    const clutchState = clutch.calculateTorqueTransfer(
      engine.getAngularVelocity(), transInputAngVel, false, engine.getTorqueOutput(), DT,
    )
    engine.tick({ throttle: 0.30, loadTorque: clutchState.loadTorqueOnEngine, deltaTime: DT })
    physics.tick({ driveTorqueAtTransmission: clutchState.transmittedTorque, gearRatio, finalDrive, brake: 0, deltaTime: DT })
  }

  const rpm = engine.getRpm()
  const speed = physics.getSpeedKmh()
  const survived = engine.getStatus() !== 'stalled'

  check(
    'TESTE D — Saída suave (throttle 30%): carro acelera sem afogar',
    survived && speed > 0.5,
    `RPM=${rpm.toFixed(0)} | Speed=${speed.toFixed(1)}km/h | Status=${engine.getStatus()}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE E — Saída errada: throttle=0, soltura brusca -> afogamento
// ═══════════════════════════════════════════════════════════════════════════
{
  const { engine, trans, clutch, physics } = makeGol()
  engine.start()
  for (let i = 0; i < 60; i++) engine.tick({ throttle: 0, loadTorque: 0, deltaTime: DT })

  trans.shiftTo(1, 0)

  // Soltura BRUSCA sem throttle (clutch vai de 1 para 0 em 2 ticks)
  for (let i = 0; i < 240; i++) {
    const clutchPos = i < 5 ? Math.max(0, 1.0 - (i / 5)) : 0
    clutch.setPosition(clutchPos)

    const wheelRadius = golConfig.info.wheelDiameter / 2
    const speedMs = physics.getSpeedMs()
    const wheelAngVel = speedMs / wheelRadius
    const gearRatio = trans.calculator.getGearRatio(1)
    const finalDrive = (golConfig.transmission as any).finalDrive
    const transInputAngVel = wheelAngVel * (gearRatio * finalDrive)

    const cs = clutch.calculateTorqueTransfer(engine.getAngularVelocity(), transInputAngVel, false, engine.getTorqueOutput(), DT)
    engine.tick({ throttle: 0, loadTorque: cs.loadTorqueOnEngine, deltaTime: DT })
    physics.tick({ driveTorqueAtTransmission: cs.transmittedTorque, gearRatio, finalDrive, brake: 0, deltaTime: DT })

    if (engine.getStatus() === 'stalled') break
  }

  check(
    'TESTE E — Saída errada (throttle=0 + soltura brusca): motor afoga',
    engine.getStatus() === 'stalled',
    `Status final=${engine.getStatus()} | RPM=${engine.getRpm().toFixed(0)}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE F — Afogamento parado: 1ª + clutch=0 + parado + throttle=0
// ═══════════════════════════════════════════════════════════════════════════
{
  const { engine, trans, clutch, physics } = makeGol()
  engine.start()
  for (let i = 0; i < 60; i++) engine.tick({ throttle: 0, loadTorque: 0, deltaTime: DT })

  trans.shiftTo(1, 0)
  clutch.setPosition(0) // embreagem solta, veículo parado

  for (let i = 0; i < 360; i++) {
    const gearRatio = trans.calculator.getGearRatio(1)
    const finalDrive = (golConfig.transmission as any).finalDrive
    // Veículo parado: transInputAngVel é próximo de 0
    const cs = clutch.calculateTorqueTransfer(engine.getAngularVelocity(), 0, false, engine.getTorqueOutput(), DT)
    engine.tick({ throttle: 0, loadTorque: cs.loadTorqueOnEngine, deltaTime: DT })
    physics.tick({ driveTorqueAtTransmission: cs.transmittedTorque, gearRatio, finalDrive, brake: 0, deltaTime: DT })
    if (engine.getStatus() === 'stalled') break
  }

  check(
    'TESTE F — Afogamento parado: embreagem acoplada + parado + sem throttle -> STALLED',
    engine.getStatus() === 'stalled',
    `Status=${engine.getStatus()} | RPM=${engine.getRpm().toFixed(0)}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE G — Salvar motor: RPM caindo + pisar embreagem
// ═══════════════════════════════════════════════════════════════════════════
{
  const { engine, trans, clutch, physics } = makeGol()
  engine.start()
  // Esperar motor estabilizar
  for (let i = 0; i < 120; i++) engine.tick({ throttle: 0, loadTorque: 0, deltaTime: DT })

  trans.shiftTo(1, 0)

  // Embreagem solta = carga alta. Dar ticks para RPM começar a cair, parando antes do stall (<=600 RPM)
  clutch.setPosition(0)
  let rpmBeforeSave = engine.getRpm()
  for (let i = 0; i < 20; i++) {
    const cs = clutch.calculateTorqueTransfer(engine.getAngularVelocity(), 0, false, engine.getTorqueOutput(), DT)
    const tick = engine.tick({ throttle: 0, loadTorque: cs.loadTorqueOnEngine, deltaTime: DT })
    physics.tick({ driveTorqueAtTransmission: cs.transmittedTorque, gearRatio: trans.calculator.getGearRatio(1), finalDrive: (golConfig.transmission as any).finalDrive, brake: 0, deltaTime: DT })
    rpmBeforeSave = tick.rpm
    if (tick.rpm <= 600) break
  }

  const engineFellLow = rpmBeforeSave < golConfig.engine.idleRpm * 0.95

  // Pisar na embreagem AGORA para salvar
  clutch.setPosition(1.0)
  let rpmAfterSave = rpmBeforeSave
  for (let i = 0; i < 180; i++) {
    const cs = clutch.calculateTorqueTransfer(engine.getAngularVelocity(), 0, false, engine.getTorqueOutput(), DT)
    const tick = engine.tick({ throttle: 0, loadTorque: cs.loadTorqueOnEngine, deltaTime: DT })
    rpmAfterSave = tick.rpm
    if (engine.getStatus() === 'stalled') break
  }

  const survived = engine.getStatus() === 'running'
  const recovered = rpmAfterSave >= golConfig.engine.idleRpm * 0.85

  check(
    'TESTE G — Salvar motor: pisar embreagem remove carga, motor recupera',
    engineFellLow && survived && recovered,
    `RPM antes salvar=${rpmBeforeSave.toFixed(0)} | RPM após=${rpmAfterSave.toFixed(0)} | Status=${engine.getStatus()}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE H — Troca correta: 1ª -> 2ª com clutch >= 0.95
// ═══════════════════════════════════════════════════════════════════════════
{
  const trans = new Transmission(golConfig.transmission as any, golConfig.info.wheelDiameter)
  // Usar shiftTo com bypass (como o init faz) para colocar em 1ª
  trans['_currentGear'] = 1
  trans.setClutch(0.98) // clutch >= 0.95

  const result = trans.shiftUp(3000, 30, golConfig.engine.maxRpm)

  check(
    'TESTE H — Troca correta (clutch 98%): 1ª -> 2ª sucesso',
    result.success && result.gear === 2 && result.reason === 'none',
    `success=${result.success} | gear=${result.gear} | reason=${result.reason}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE I — Troca sem embreagem: deve ser bloqueada
// ═══════════════════════════════════════════════════════════════════════════
{
  const trans = new Transmission(golConfig.transmission as any, golConfig.info.wheelDiameter)
  trans['_currentGear'] = 1
  trans.setClutch(0.40) // clutch insuficiente

  const result = trans.shiftUp(3000, 30, golConfig.engine.maxRpm)

  check(
    'TESTE I — Troca sem embreagem (clutch 40%): bloqueada',
    !result.success && result.reason === 'clutch_required' && result.gear === 1,
    `success=${result.success} | gear=${result.gear} | reason=${result.reason}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE J — Bog: marcha alta (4ª) em baixa velocidade, RPM cai
// ═══════════════════════════════════════════════════════════════════════════
{
  const { engine, trans, clutch, physics } = makeGol()
  engine.start()
  for (let i = 0; i < 60; i++) engine.tick({ throttle: 0, loadTorque: 0, deltaTime: DT })

  // Simula estar em 4ª a 20 km/h (situação de bog)
  physics.setSpeedKmh(20)
  trans.shiftTo(4, 20)
  clutch.setPosition(0) // acoplado

  const rpmInitial = trans.calculator.speedToRpm(20, 4)
  engine.setRpm(rpmInitial)

  let bogDetected = false
  let finalRpm = rpmInitial

  for (let i = 0; i < 180; i++) {
    const wheelRadius = golConfig.info.wheelDiameter / 2
    const speedMs = physics.getSpeedMs()
    const wheelAngVel = speedMs / wheelRadius
    const gearRatio = trans.calculator.getGearRatio(4)
    const finalDrive = (golConfig.transmission as any).finalDrive
    const transInputAngVel = wheelAngVel * (gearRatio * finalDrive)

    const cs = clutch.calculateTorqueTransfer(engine.getAngularVelocity(), transInputAngVel, false, engine.getTorqueOutput(), DT)
    const tick = engine.tick({ throttle: 0.05, loadTorque: cs.loadTorqueOnEngine, deltaTime: DT })

    if (tick.isBogWarning) bogDetected = true
    finalRpm = tick.rpm

    physics.tick({ driveTorqueAtTransmission: cs.transmittedTorque, gearRatio, finalDrive, brake: 0, deltaTime: DT })
    if (engine.getStatus() === 'stalled') break
  }

  check(
    'TESTE J — Bog: 4ª marcha a 20 km/h causa queda de RPM',
    bogDetected || finalRpm < rpmInitial * 0.75,
    `bogDetected=${bogDetected} | RPM inicial=${rpmInitial.toFixed(0)} | RPM final=${finalRpm.toFixed(0)}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE K — Downshift perigoso: 5ª -> ??? a 100 km/h -> bloqueado (over_rev)
// ═══════════════════════════════════════════════════════════════════════════
{
  const trans = new Transmission(golConfig.transmission as any, golConfig.info.wheelDiameter)
  trans['_currentGear'] = 5
  trans.setClutch(1.0) // embreagem pressionada

  // shiftDown verifica 1 passo de cada vez (5->4). A 100km/h, 4ª deve ser ok.
  // Mas a 2 passos (5->3), deve ser bloqueado.
  // Vamos testar canShiftTo diretamente para 2ª a 100km/h:
  const rpm2ndAt100 = trans.calculator.speedToRpm(100, 2)
  const rpm3rdAt100 = trans.calculator.speedToRpm(100, 3)
  const canShift2nd = trans.canShiftTo(2, 100, golConfig.engine.maxRpm)
  const canShift3rd = trans.canShiftTo(3, 100, golConfig.engine.maxRpm)

  check(
    'TESTE K — Downshift protegido: 2ª a 100km/h (over-rev) e 3ª (verificar)',
    !canShift2nd,
    `RPM em 2ª a 100km/h=${rpm2ndAt100.toFixed(0)} (max=${golConfig.engine.maxRpm}) | canShift2nd=${canShift2nd} | RPM3ª=${rpm3rdAt100.toFixed(0)} | canShift3rd=${canShift3rd}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE L — Yaris CVT: sem embreagem, sem afogamento, hasClutch=false
// ═══════════════════════════════════════════════════════════════════════════
{
  const yarisEngine = new EngineSimulator(yarisConfig.engine as any)
  const yarisTrans = new Transmission(yarisConfig.transmission as any, yarisConfig.info.wheelDiameter)
  const yarisClutch = new ClutchSystem(yarisConfig.engine.maxTorque)

  yarisEngine.start()
  for (let i = 0; i < 60; i++) yarisEngine.tick({ throttle: 0, loadTorque: 0, deltaTime: DT })

  // Yaris: embreagem sempre em 0 (gerenciada pelo CVT, nunca pelo usuário)
  yarisClutch.setPosition(0)
  yarisTrans.setClutch(0) // não exige clutch para trocar

  const shiftResult = yarisTrans.shiftUp(2000, 30)

  // hasClutch deve ser false na config
  const hasClutch = yarisConfig.transmission.hasClutch === false

  check(
    'TESTE L — Yaris CVT: hasClutch=false, troca sem exigir pedal',
    hasClutch && shiftResult.success,
    `hasClutch=false: ${hasClutch} | shiftResult.success=${shiftResult.success} | reason=${shiftResult.reason}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE M — CB1000R manual: exige clutch para troca, over-rev protegido
// ═══════════════════════════════════════════════════════════════════════════
{
  const cbTrans = new Transmission(cbConfig.transmission as any, cbConfig.info.wheelDiameter)
  cbTrans['_currentGear'] = 3

  // Tentativa sem embreagem
  cbTrans.setClutch(0.30)
  const noClutchResult = cbTrans.shiftUp(8000, 80, cbConfig.engine.maxRpm)

  // Tentativa com embreagem completa
  cbTrans.setClutch(0.98)
  const withClutchResult = cbTrans.shiftUp(8000, 80, cbConfig.engine.maxRpm)

  // Proteção over-rev downshift: testamos canShiftTo diretamente
  // em uma velocidade onde a marcha mais baixa ultrapassaria maxRpm
  const cbTransFast = new Transmission(cbConfig.transmission as any, cbConfig.info.wheelDiameter)
  const cbMaxRpm = cbConfig.engine.maxRpm
  // Encontrar velocidade que causaria over-rev em 1ª
  const highSpeed = 220
  const rpm1stAtHighSpeed = cbTransFast.calculator.speedToRpm(highSpeed, 1)
  const overRevProtected = !cbTransFast.canShiftTo(1, highSpeed, cbMaxRpm)

  check(
    'TESTE M — CB1000R: clutch exigido + over-rev protegido',
    !noClutchResult.success &&
      noClutchResult.reason === 'clutch_required' &&
      withClutchResult.success &&
      overRevProtected,
    `SemClutch:${noClutchResult.reason} | ComClutch:${withClutchResult.success ? 'OK' : 'FAIL'} | OverRev@1ª/${highSpeed}km/h=${rpm1stAtHighSpeed.toFixed(0)}rpm (max=${cbMaxRpm})`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTE N — PedalInputSystem: interpolação progressiva de W/E/Q
// ═══════════════════════════════════════════════════════════════════════════
{
  const pedals = new PedalInputSystem()

  // W pressionado por 80ms (≈10 ticks @ 120Hz) — parcial esperado ~0.7
  for (let i = 0; i < 10; i++) {
    pedals.update(DT, { throttlePressed: true, brakePressed: false, clutchPressed: false }, true)
  }
  const throttleAt80ms = pedals.getThrottle()

  // Soltar W por 200ms — deve cair a zero
  for (let i = 0; i < 24; i++) {
    pedals.update(DT, { throttlePressed: false, brakePressed: false, clutchPressed: false }, true)
  }
  const throttleAfterRelease = pedals.getThrottle()

  // Q pressionado até 100% (60 ticks)
  for (let i = 0; i < 60; i++) {
    pedals.update(DT, { throttlePressed: false, brakePressed: false, clutchPressed: true }, true)
  }
  const clutchFull = pedals.getClutch()

  // Sem clutch (hasClutch=false): Q não deve ter efeito
  const pedalsNoCl = new PedalInputSystem()
  for (let i = 0; i < 60; i++) {
    pedalsNoCl.update(DT, { throttlePressed: false, brakePressed: false, clutchPressed: true }, false)
  }
  const clutchOnNoCl = pedalsNoCl.getClutch()

  check(
    'TESTE N — PedalInputSystem: W sobe parcialmente, libera desce, Q funciona, Q ignorado sem clutch',
    throttleAt80ms > 0.05 &&
      throttleAt80ms < 1.0 &&
      throttleAfterRelease < 0.05 &&
      clutchFull >= 0.99 &&
      clutchOnNoCl === 0,
    `W@80ms=${throttleAt80ms.toFixed(2)} | W@release=${throttleAfterRelease.toFixed(2)} | Q=${clutchFull.toFixed(2)} | Q(noCl)=${clutchOnNoCl.toFixed(2)}`,
  )
}

// ─── Resultado Final ─────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`  RESULTADO: ${passed}/${passed + failed} TESTES PASSARAM`)
if (failed === 0) {
  console.log('  ✓ TODOS OS TESTES DA ETAPA 7 PASSARAM COM SUCESSO!')
} else {
  console.log(`  ✗ ${failed} TESTES FALHARAM`)
}
console.log('═══════════════════════════════════════════════════════════════\n')
