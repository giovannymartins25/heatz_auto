/**
 * ==============================================================================
 * HEATZ AUTO — SUITE DE TESTES AUTOMATIZADOS: FASE 1.6.1
 * CENTRO DE MASSA + INTEGRAÇÃO FÍSICA DETERMINÍSTICA (120 Hz)
 * ==============================================================================
 * 
 * Requisitos testados rigorosamente:
 * 1. Frequência física fixa de 120 Hz (h = 1/120 s).
 * 2. Independência da renderização (30 Hz, 60 Hz, 144 Hz e jitter variável).
 * 3. Determinismo exato com a mesma sequência de entradas.
 * 4. Acumulador de tempo com diferentes taxas de quadros e interpolação visual alpha.
 * 5. Pausa e retomada sem avanço artificial nem salto temporal.
 * 6. Limite de subpassos (maxSubsteps = 8) contra spiral-of-death.
 * 7. Preservação de estado em falhas via protocolo FAIL_SAFE_HOLD.
 * 8. Consistência dimensional dos parâmetros de chassi (SI, L = a + b, df + dr = 1).
 * 9. Distribuição estática e conservação dinâmica de carga nos 8 veículos.
 * 10. Regressão completa dos sistemas anteriores integrados com o novo chassi.
 */

import {
  VehicleChassis,
  VEHICLE_CHASSIS_DATABASE,
  createVehicleChassis,
  DeterministicIntegrator,
  VehiclePhysics,
} from './src/systems/physics'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useUIStore } from './src/stores/useUIStore'

import golfConfig from './public/vehicles/golf-gti/config.json' with { type: 'json' }
import porscheConfig from './public/vehicles/porsche-gt3/config.json' with { type: 'json' }
import civicConfig from './public/vehicles/civic-si/config.json' with { type: 'json' }
import golG6Config from './public/vehicles/gol-g6/config.json' with { type: 'json' }
import golQuadConfig from './public/vehicles/gol-quadrado-turbo/config.json' with { type: 'json' }
import opalaConfig from './public/vehicles/opala-4100/config.json' with { type: 'json' }
import yarisConfig from './public/vehicles/yaris-2019/config.json' with { type: 'json' }
import cbConfig from './public/vehicles/cb1000r/config.json' with { type: 'json' }

const ALL_VEHICLE_CONFIGS = [
  golfConfig,
  porscheConfig,
  civicConfig,
  golG6Config,
  golQuadConfig,
  opalaConfig,
  yarisConfig,
  cbConfig,
]

let passedCount = 0
let failedCount = 0

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  [OK] ${message}`)
    passedCount++
  } else {
    console.error(`  [FALHA] ${message}`)
    failedCount++
  }
}

console.log('\n===============================================================')
console.log('  HEATZ AUTO · FASE 1.6.1 — CENTRO DE MASSA & INTEGRADOR 120 HZ')
console.log('===============================================================\n')

// ─── TESTE 1: Frequência Física Fixa de 120 Hz ───
console.log('--- REQUISITO 1: Frequência física fixa de 120 Hz (h = 1/120 s) ---')
{
  interface SimpleState { pos: number; vel: number }
  const integrator = new DeterministicIntegrator<SimpleState>({ pos: 0, vel: 10 }, { physicsFrequency: 120 })

  assert(Math.abs(integrator.timestep - (1 / 120)) < 1e-15, 'Timestep nominal é exatamente 1/120 s (8.3333 ms)')
  assert(integrator.frequency === 120, 'Frequência física configurada é 120 Hz')

  // Alimentar exatamente 120 frames de 1/120s
  for (let i = 0; i < 120; i++) {
    integrator.step(1 / 120, undefined, (s, dt) => ({
      pos: s.pos + s.vel * dt,
      vel: s.vel,
    }))
  }

  assert(Math.abs(integrator.getPhysicalTime() - 1.0) < 1e-12, '120 passos de 1/120s resultam exatamente em 1.000s de tempo físico')
  assert(Math.abs(integrator.getState().pos - 10.0) < 1e-12, 'Posição integrada coincide com velocidade constante v*t = 10*1 = 10m')
}

// ─── TESTE 2: Independência da Renderização ───
console.log('\n--- REQUISITO 2: Independência da taxa de quadros de renderização ---')
{
  // Integrar exatamente 240 subpassos físicos (2.0 segundos de física pura a 120 Hz)
  // alimentados por fluxos visuais em 30 FPS, 60 FPS, 144 FPS e jitter aleatório variável.
  interface AccelState { speed: number; dist: number }
  const TARGET_SUBSTEPS = 240

  const runSimulation = (frameDts: number[]): AccelState => {
    const it = new DeterministicIntegrator<AccelState>({ speed: 0, dist: 0 }, { physicsFrequency: 120 })
    let idx = 0
    let executed = 0
    let exactStateAtTarget: AccelState = { speed: 0, dist: 0 }
    while (executed < TARGET_SUBSTEPS) {
      const dt = frameDts[idx % frameDts.length]
      it.step(dt, undefined, (s, h) => {
        executed++
        const a = 3.5 // m/s² constante
        const nextState = {
          speed: s.speed + a * h,
          dist: s.dist + s.speed * h + 0.5 * a * h * h,
        }
        if (executed === TARGET_SUBSTEPS) {
          exactStateAtTarget = { ...nextState }
        }
        return nextState
      })
      idx++
    }
    return exactStateAtTarget
  }

  const dt30 = [1 / 30]
  const dt60 = [1 / 60]
  const dt144 = [1 / 144]

  // Sequência determinística com jitter variável (frames entre 7ms e 35ms)
  const dtJitter: number[] = []
  let seed = 42
  for (let i = 0; i < 300; i++) {
    seed = (seed * 9301 + 49297) % 233280
    const frameMs = 7 + (seed / 233280) * 28
    dtJitter.push(frameMs / 1000)
  }

  const res30 = runSimulation(dt30)
  const res60 = runSimulation(dt60)
  const res144 = runSimulation(dt144)
  const resJitter = runSimulation(dtJitter)

  // Ao completar 240 subpassos físicos exatos a 120 Hz, a física deve ser matematicamente idêntica
  assert(Math.abs(res30.speed - res60.speed) < 1e-12, `Velocidade idêntica entre 30 FPS e 60 FPS (diff = ${Math.abs(res30.speed - res60.speed)})`)
  assert(Math.abs(res60.speed - res144.speed) < 1e-12, `Velocidade idêntica entre 60 FPS e 144 FPS (diff = ${Math.abs(res60.speed - res144.speed)})`)
  assert(Math.abs(res60.speed - resJitter.speed) < 1e-12, `Velocidade idêntica sob frame-rate irregular com jitter (diff = ${Math.abs(res60.speed - resJitter.speed)})`)
  assert(Math.abs(res30.dist - res60.dist) < 1e-12, `Distância percorrida idêntica entre taxas de renderização distintas (diff = ${Math.abs(res30.dist - res60.dist)})`)
  assert(Math.abs(res60.dist - res144.dist) < 1e-12, `Distância percorrida idêntica entre 60 FPS e 144 FPS`)
}

// ─── TESTE 3: Determinismo com a Mesma Sequência de Entradas ───
console.log('\n--- REQUISITO 3: Determinismo absoluto sob a mesma sequência de entradas ---')
{
  const runVehicleSimulation = () => {
    const physics = new VehiclePhysics({
      weight: golfConfig.info.weight,
      wheelDiameter: golfConfig.info.wheelDiameter,
      vehicleId: golfConfig.id,
    })
    const dt = 1 / 120
    const trajectory: number[] = []

    for (let step = 0; step < 360; step++) {
      const throttle = step < 180 ? 0.85 : 0.0
      const brake = step >= 180 ? 0.60 : 0.0
      const torque = throttle * 320

      const tickRes = physics.tick({
        driveTorqueAtTransmission: torque,
        gearRatio: 3.10,
        finalDrive: 4.05,
        brake,
        deltaTime: dt,
      })
      trajectory.push(tickRes.speedMs)
    }
    return trajectory
  }

  const simA = runVehicleSimulation()
  const simB = runVehicleSimulation()

  let maxDiff = 0
  for (let i = 0; i < simA.length; i++) {
    const diff = Math.abs(simA[i] - simB[i])
    if (diff > maxDiff) maxDiff = diff
  }

  assert(maxDiff === 0, `Determinismo bit-a-bit estrito comprovado em 360 passos (diferença máxima = ${maxDiff})`)
}

// ─── TESTE 4: Acumulador e Fator de Interpolação Visual Alpha ───
console.log('\n--- REQUISITO 4: Acumulador de tempo e interpolação visual alpha [0, 1) ---')
{
  interface State { stepCount: number }
  const it = new DeterministicIntegrator<State>({ stepCount: 0 }, { physicsFrequency: 120 })
  const h = 1 / 120 // 0.008333s

  // Injetar metade de um timestep: nenhum subpasso deve ser executado, alpha deve ser ~0.5
  const res1 = it.step(0.5 * h, undefined, (s) => ({ stepCount: s.stepCount + 1 }))
  assert(res1.substepsExecuted === 0, 'Frame com dt = 0.5*h não dispara subpasso prematuro')
  assert(Math.abs(res1.interpolationAlpha - 0.5) < 1e-6, `Alpha visual reflete fração acumulada: ${res1.interpolationAlpha.toFixed(4)}`)

  // Injetar mais 0.6 * h: acumulador agora é 1.1 * h -> deve executar 1 subpasso, resto 0.1 * h
  const res2 = it.step(0.6 * h, undefined, (s) => ({ stepCount: s.stepCount + 1 }))
  assert(res2.substepsExecuted === 1, 'Ao cruzar o limiar de 1.0*h, dispara exatamente 1 subpasso')
  assert(res2.state.stepCount === 1, 'Estado mestre incrementou exatamente 1 passo')
  assert(Math.abs(res2.interpolationAlpha - 0.1) < 1e-6, `Alpha visual residual é ~0.10: ${res2.interpolationAlpha.toFixed(4)}`)
  assert(res2.interpolationAlpha >= 0 && res2.interpolationAlpha < 1.0, 'Alpha permanece estritamente no intervalo [0, 1)')
}

// ─── TESTE 5: Pausa e Retomada sem Salto Temporal ───
console.log('\n--- REQUISITO 5: Tratamento explícito de pausa e retomada sem salto temporal ---')
{
  interface State { ticks: number }
  const it = new DeterministicIntegrator<State>({ ticks: 0 }, { physicsFrequency: 120 })

  // Executar 10 passos normais
  for (let i = 0; i < 10; i++) {
    it.step(1 / 120, undefined, (s) => ({ ticks: s.ticks + 1 }))
  }
  const timeBeforePause = it.getPhysicalTime()
  assert(it.getState().ticks === 10, '10 ticks executados antes da pausa')

  // Ativar pausa
  it.pause()
  assert(it.isPaused() === true, 'Integrador reconhece estado pausado')

  // Simular passagem de 3 segundos na UI durante a pausa
  for (let i = 0; i < 60; i++) {
    const res = it.step(0.05, undefined, (s) => ({ ticks: s.ticks + 1 }))
    assert(res.substepsExecuted === 0, 'Enquanto pausado, zero subpassos são executados')
  }

  assert(it.getPhysicalTime() === timeBeforePause, 'Relógio físico congelado estritamente durante a pausa')
  assert(it.getState().ticks === 10, 'Estado mestre inalterado durante a pausa')

  // Retomar simulação
  it.resume()
  assert(it.isPaused() === false, 'Integrador retomado com sucesso')

  // Próximo frame a 60 FPS (1/60s): deve executar exatamente 2 subpassos de 1/120s sem compensar os 3s da pausa
  const resResume = it.step(1 / 60, undefined, (s) => ({ ticks: s.ticks + 1 }))
  assert(resResume.substepsExecuted === 2, `Retomada executou exatamente 2 subpassos regulares (executado = ${resResume.substepsExecuted})`)
  assert(it.getState().ticks === 12, 'Estado mestre avançou apenas os 2 subpassos devidos (ticks = 12)')
}

// ─── TESTE 6: Limite de Subpassos contra Spiral-of-Death ───
console.log('\n--- REQUISITO 6: Limite de subpassos (maxSubsteps = 8) contra spiral-of-death ---')
{
  interface State { count: number }
  const it = new DeterministicIntegrator<State>({ count: 0 }, {
    physicsFrequency: 120,
    maxSubsteps: 8,
    maxFrameDelta: 0.5,
  })

  // Simular lag spike massivo de 0.5 segundos (acumularia 60 subpassos se descontrolado)
  const resSpike = it.step(0.5, undefined, (s) => ({ count: s.count + 1 }))

  assert(resSpike.substepsExecuted === 8, `Subpassos limitados estritamente ao teto maxSubsteps = 8 (executado = ${resSpike.substepsExecuted})`)
  assert(resSpike.spiralOfDeathClamped === true, 'Flag spiralOfDeathClamped ativada após saturação do teto')
  assert(it.getAccumulator() === 0, 'Acumulador remanescente zerado para impedir sobrecarga infinita no frame seguinte')

  // Frame normal subsequente de 1/120s
  const resNormal = it.step(1 / 120, undefined, (s) => ({ count: s.count + 1 }))
  assert(resNormal.substepsExecuted === 1, 'Frame seguinte normal opera imediatamente com 1 subpasso limpo')
}

// ─── TESTE 7: Preservação de Estado em Falhas via FAIL_SAFE_HOLD ───
console.log('\n--- REQUISITO 7: Preservação estrita de estado via FAIL_SAFE_HOLD ---')
{
  interface PhysicsState {
    speedMs: number
    engineRpm: number
    distanceM: number
  }

  const initialValidState: PhysicsState = {
    speedMs: 25.0,
    engineRpm: 3200,
    distanceM: 150.0,
  }

  const it = new DeterministicIntegrator<PhysicsState>(initialValidState, {
    physicsFrequency: 120,
  })

  const timeBeforeFault = it.getPhysicalTime()

  // Simular subpasso que gera NaN
  const resNaN = it.step(1 / 120, undefined, (s) => {
    return {
      speedMs: NaN, // Erro matemático no modelo não linear
      engineRpm: s.engineRpm,
      distanceM: s.distanceM,
    }
  })

  assert(resNaN.integrityStatus === 'FAIL_SAFE_HOLD', 'Status migrou imediatamente para FAIL_SAFE_HOLD')
  assert(resNaN.lastFault?.errorCode === 'PHYSICS_NAN_DETECTED', `Código de erro registrado: ${resNaN.lastFault?.errorCode}`)
  assert(resNaN.state.speedMs === 25.0, 'Estado mestre PRESERVADO com a velocidade anterior intacta (25.0 m/s)')
  assert(it.getPhysicalTime() === timeBeforeFault, 'Relógio físico congelado no instante exato da falha')

  // Tentativa de novo passo sob FAIL_SAFE_HOLD não avança
  const resHold = it.step(1 / 60, undefined, (s) => ({ ...s, speedMs: s.speedMs + 1 }))
  assert(resHold.substepsExecuted === 0, 'Enquanto em FAIL_SAFE_HOLD, nenhum subpasso é executado')
  assert(resHold.state.speedMs === 25.0, 'Estado mestre permanece inalterado')

  // Recuperação controlada
  it.clearFault()
  assert(it.getIntegrityStatus() === 'NORMAL', 'clearFault() restaura status para NORMAL')

  // Simular falha por exceção não tratada
  const resExc = it.step(1 / 120, undefined, () => {
    throw new Error('Falha de singularidade numérica no kernel')
  })
  assert(resExc.integrityStatus === 'FAIL_SAFE_HOLD', 'Exceção aciona FAIL_SAFE_HOLD sem travar o processo')
  assert(resExc.lastFault?.errorCode === 'PHYSICS_SUBSTEP_EXCEPTION', 'Código PHYSICS_SUBSTEP_EXCEPTION registrado')
  assert(resExc.state.speedMs === 25.0, 'Estado mestre preservado mesmo sob exceção')
}

// ─── TESTE 8: Consistência Dimensional dos Parâmetros de Chassi ───
console.log('\n--- REQUISITO 8: Consistência dimensional dos parâmetros de chassi (SI) ---')
{
  const vehicleIds = Object.keys(VEHICLE_CHASSIS_DATABASE)
  assert(vehicleIds.length === 8, `Banco de chassi contém os 8 veículos (total = ${vehicleIds.length})`)

  for (const id of vehicleIds) {
    const chassis = createVehicleChassis(id)
    const L = chassis.wheelbase
    const a = chassis.distanceCgToFrontAxle
    const b = chassis.distanceCgToRearAxle
    const df = chassis.frontWeightRatio
    const dr = chassis.rearWeightRatio

    const sumDist = a + b
    const sumRatio = df + dr

    assert(Math.abs(sumDist - L) < 1e-12, `${id}: Distância CG entre eixos fecha exatamente L (a + b = ${sumDist.toFixed(4)}m == L = ${L.toFixed(4)}m)`)
    assert(Math.abs(sumRatio - 1.0) < 1e-12, `${id}: Soma das proporções de peso é 1.0 (df + dr = ${sumRatio.toFixed(4)})`)
    assert(chassis.totalMass > 0, `${id}: Massa é positiva (m = ${chassis.totalMass} kg)`)
    assert(chassis.centerOfMassHeight > 0 && chassis.centerOfMassHeight < 1.0, `${id}: Altura de CG realista (hcg = ${chassis.centerOfMassHeight} m)`)
    assert(chassis.wheelRadius > 0.1 && chassis.wheelRadius < 0.5, `${id}: Raio dinâmico realista (rw = ${chassis.wheelRadius} m)`)
    assert(chassis.wheelInertia > 0, `${id}: Inércia rotacional positiva (Iw = ${chassis.wheelInertia} kg·m²)`)

    // Verificar correspondência com configs JSON
    const jsonCfg = ALL_VEHICLE_CONFIGS.find((c) => c.id === id)
    if (jsonCfg) {
      assert(chassis.totalMass === jsonCfg.info.weight, `${id}: Massa coincide com config.json (${chassis.totalMass} kg)`)
      assert(Math.abs(chassis.wheelRadius - jsonCfg.info.wheelDiameter / 2) < 1e-6, `${id}: Raio coincide com wheelDiameter / 2 (${chassis.wheelRadius} m)`)
    }
  }
}

// ─── TESTE 9: Distribuição Estática e Dinâmica de Cargas Normais ───
console.log('\n--- REQUISITO 9: Distribuição estática e conservação dinâmica de carga ---')
{
  for (const cfg of ALL_VEHICLE_CONFIGS) {
    const chassis = createVehicleChassis(cfg.id)
    const W = chassis.getTotalWeight()
    const staticLoads = chassis.getStaticAxleLoads()

    // 1. Equilíbrio estático perfeito
    const sumStatic = staticLoads.frontAxleLoad + staticLoads.rearAxleLoad
    assert(Math.abs(sumStatic - W) < 1e-10, `${cfg.id}: Carga estática total fecha com o peso (Fzf0 + Fzr0 = ${sumStatic.toFixed(1)} N == W = ${W.toFixed(1)} N)`)

    // Carga por roda
    const totalWheelsLoad = staticLoads.frontWheelLoad * (chassis.wheelCount / 2) + staticLoads.rearWheelLoad * (chassis.wheelCount / 2)
    assert(Math.abs(totalWheelsLoad - W) < 1e-10, `${cfg.id}: Carga somada das ${chassis.wheelCount} rodas fecha exatamente o peso`)

    // 2. Transferência dinâmica em aceleração (+4 m/s²)
    const dynAccel = chassis.getDynamicAxleLoads(4.0)
    assert(dynAccel.rearAxleLoad > staticLoads.rearAxleLoad, `${cfg.id}: Em aceleração (+4m/s²), traseira ganha carga (+${(dynAccel.rearAxleLoad - staticLoads.rearAxleLoad).toFixed(1)} N)`)
    assert(dynAccel.frontAxleLoad < staticLoads.frontAxleLoad, `${cfg.id}: Em aceleração (+4m/s²), dianteira perde carga (-${(staticLoads.frontAxleLoad - dynAccel.frontAxleLoad).toFixed(1)} N)`)
    const sumDynAccel = dynAccel.frontAxleLoad + dynAccel.rearAxleLoad
    assert(Math.abs(sumDynAccel - W) < 1e-10, `${cfg.id}: Conservação estrita da carga normal em aceleração (soma = ${sumDynAccel.toFixed(1)} N)`)

    // 3. Transferência dinâmica em frenagem pesada (-8 m/s²)
    const dynBrake = chassis.getDynamicAxleLoads(-8.0)
    assert(dynBrake.frontAxleLoad > staticLoads.frontAxleLoad, `${cfg.id}: Em frenagem (-8m/s²), dianteira ganha carga (+${(dynBrake.frontAxleLoad - staticLoads.frontAxleLoad).toFixed(1)} N)`)
    assert(dynBrake.rearAxleLoad < staticLoads.rearAxleLoad, `${cfg.id}: Em frenagem (-8m/s²), traseira perde carga (-${(staticLoads.rearAxleLoad - dynBrake.rearAxleLoad).toFixed(1)} N)`)
    const sumDynBrake = dynBrake.frontAxleLoad + dynBrake.rearAxleLoad
    assert(Math.abs(sumDynBrake - W) < 1e-10, `${cfg.id}: Conservação estrita da carga normal em frenagem (soma = ${sumDynBrake.toFixed(1)} N)`)

    // 4. Batente de segurança contra carga negativa (clamp em aceleração extrema -50 m/s²)
    const dynExtreme = chassis.getDynamicAxleLoads(-50.0)
    assert(dynExtreme.rearAxleLoad >= chassis.minAxleLoad, `${cfg.id}: Batente impede carga traseira negativa sob desaceleração extrema (Fzr = ${dynExtreme.rearAxleLoad.toFixed(1)} N >= ${chassis.minAxleLoad} N)`)
    const sumExtreme = dynExtreme.frontAxleLoad + dynExtreme.rearAxleLoad
    assert(Math.abs(sumExtreme - W) < 1e-10, `${cfg.id}: Conservação preservada mesmo com batente ativo (soma = ${sumExtreme.toFixed(1)} N)`)
  }
}

// ─── TESTE 10: Regressão e Integração Completa com o Loop de Simulação ───
console.log('\n--- REQUISITO 10: Regressão completa dos sistemas anteriores integrados ---')
{
  useUIStore.getState().setGraphicProfile('normal')
  const DT_120 = 1 / 120

  const stepStore = (seconds: number) => {
    const ticks = Math.round(seconds / DT_120)
    for (let i = 0; i < ticks; i++) {
      useSimulationStore.getState().update(DT_120)
    }
  }

  for (const cfg of ALL_VEHICLE_CONFIGS) {
    const sim = useSimulationStore.getState()
    sim.reset()
    sim.init(cfg)
    sim.startEngine()

    // 1. Cranking por 0.6s (garante conclusão do tempo de arranque de 0.45s)
    stepStore(0.6)
    assert(useSimulationStore.getState().isRunning, `${cfg.id}: Motor dá partida e sustenta idle`)

    // 2. Tração e Aceleração
    if (cfg.transmission.type === 'manual') {
      sim.setClutch(1.0)
      sim.shiftUp() // 1ª marcha
      sim.setThrottle(0.95)
      stepStore(0.25)

      // Soltura progressiva da embreagem na zona de atrito
      for (let t = 0; t < 120; t++) {
        const s = useSimulationStore.getState()
        if (s._phys.gear === 1 && s._phys.speedKmh < 18) {
          s.setClutch(Math.max(0, 0.52 - (s._phys.speedKmh / 18) * 0.52))
        } else {
          s.setClutch(0)
        }
        s.update(DT_120)
      }
      useSimulationStore.getState().setClutch(0)
    } else {
      sim.selectShifterMode('D')
      sim.setThrottle(0.95)
      stepStore(2.0)
    }

    const currentSpeed = useSimulationStore.getState().speed
    assert(currentSpeed > 5, `${cfg.id}: Acelera normalmente e atinge velocidade > 5 km/h (${currentSpeed.toFixed(1)} km/h)`)

    // 3. Verificação do Chassi integrado e massa consistente
    const physicsInstance = useSimulationStore.getState()._physics
    assert(physicsInstance !== null, `${cfg.id}: Instância de VehiclePhysics ativa`)
    const chassis = physicsInstance?.getChassis()
    assert(chassis?.totalMass === cfg.info.weight, `${cfg.id}: Chassis integrado no store reporta massa idêntica (${chassis?.totalMass} kg)`)

    // 4. Verificação das cargas normais dinâmicas e conservação estrita
    const axleLoads = physicsInstance?.getAxleLoads()
    const W = chassis?.getTotalWeight() ?? 0
    const sumAxle = (axleLoads?.frontAxleLoad ?? 0) + (axleLoads?.rearAxleLoad ?? 0)
    assert((axleLoads?.frontAxleLoad ?? 0) > 0 && (axleLoads?.rearAxleLoad ?? 0) > 0, `${cfg.id}: Cargas normais dinâmicas positivas no loop principal`)
    assert(Math.abs(sumAxle - W) < 1e-9, `${cfg.id}: Conservação de carga preservada no loop principal (Fzf + Fzr = ${sumAxle.toFixed(1)} N == W = ${W.toFixed(1)} N)`)

    // 5. Teste de frenagem
    sim.setThrottle(0)
    sim.setBrake(1.0)
    stepStore(1.0)
    const afterBrakeSpeed = useSimulationStore.getState().speed
    assert(afterBrakeSpeed < currentSpeed, `${cfg.id}: Freio desacelera o veículo (${currentSpeed.toFixed(1)} -> ${afterBrakeSpeed.toFixed(1)} km/h)`)

    // 6. Reset limpo
    sim.reset()
    assert(useSimulationStore.getState().speed === 0, `${cfg.id}: Reset zera velocidade com sucesso`)
  }
}

// ─── TESTE 11: Integração Real do DeterministicIntegrator no Runtime da Store ───
console.log('\n--- REQUISITO 11: Integração Real do DeterministicIntegrator no Runtime da Store ---')
{
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(golfConfig)

  // 1. Instanciação de DeterministicIntegrator via init()
  const integrator = useSimulationStore.getState()._integrator
  assert(integrator !== null && integrator !== undefined, 'DeterministicIntegrator é instanciado em useSimulationStore.init()')
  assert(integrator instanceof DeterministicIntegrator, 'Instância em store._integrator é do tipo DeterministicIntegrator')
  assert(integrator?.frequency === 120, 'Integrador opera com frequência fixa de 120 Hz')
  assert(useSimulationStore.getState().physicsIntegrityStatus === 'NORMAL', 'Status de integridade inicial da store é NORMAL')
  assert(useSimulationStore.getState().isPaused === false, 'Estado inicial isPaused é false')

  // 2. Chamada de update() executando via integrador a 120 Hz
  sim.startEngine()
  const t0 = integrator!.getPhysicalTime()
  // 1 frame a 60 FPS (1/60s = 2 * 1/120s) deve executar exatamente 2 subpassos a 120 Hz
  sim.update(1 / 60)
  const t1 = integrator!.getPhysicalTime()
  assert(Math.abs((t1 - t0) - (2 / 120)) < 1e-12, `update(1/60s) avança exatamente 2 subpassos de 1/120s (delta = ${((t1 - t0) * 1000).toFixed(4)} ms == 16.6667 ms)`)

  // 3. Ausência de dois acumuladores (store reflete a única fonte da verdade do integrador)
  sim.update(0.004) // 4 ms < 8.33 ms: zero subpassos executados
  const storeAcc = useSimulationStore.getState()._accumulator
  const integAcc = integrator!.getAccumulator()
  assert(Math.abs(storeAcc - integAcc) < 1e-15, `Store e integrador compartilham único acumulador idêntico (store=${storeAcc.toFixed(6)}s, integrator=${integAcc.toFixed(6)}s)`)

  // 4. Interpolação visual no runtime real (visualSpeed e visualRpm)
  const alpha = useSimulationStore.getState().interpolationAlpha
  const visualSpeed = useSimulationStore.getState().visualSpeed
  const visualRpm = useSimulationStore.getState().visualRpm
  assert(alpha >= 0 && alpha < 1.0, `Fator interpolationAlpha está estritamente no intervalo [0, 1) (alpha = ${alpha.toFixed(4)})`)
  assert(typeof visualSpeed === 'number' && Number.isFinite(visualSpeed), `visualSpeed é número finito interpolado (${visualSpeed.toFixed(2)} km/h)`)
  assert(typeof visualRpm === 'number' && Number.isFinite(visualRpm), `visualRpm é número finito interpolado (${visualRpm.toFixed(1)} RPM)`)

  // 5. Pausa e Retomada no runtime real
  sim.pauseSimulation()
  assert(useSimulationStore.getState().isPaused === true, 'pauseSimulation() atualizou isPaused para true')
  assert(integrator!.isPaused() === true, 'DeterministicIntegrator reconhece estado de pausa')
  const timeAtPause = integrator!.getPhysicalTime()

  // Loop durante a pausa não pode avançar o relógio físico nem acumular tempo
  for (let i = 0; i < 30; i++) {
    sim.update(1 / 60)
  }
  assert(integrator!.getPhysicalTime() === timeAtPause, 'Durante a pausa, nenhum tempo físico é acumulado')
  assert(integrator!.getAccumulator() === 0, 'Acumulador permanece zerado durante a pausa')

  sim.resumeSimulation()
  assert(useSimulationStore.getState().isPaused === false, 'resumeSimulation() restaurou isPaused para false')
  assert(integrator!.isPaused() === false, 'DeterministicIntegrator reconhece retomada')

  // 6. Injeção de erro / NaN em subsistema e ativação de FAIL_SAFE_HOLD com rollback transacional
  // Acelera o veículo para registrar velocidade positiva válida
  sim.selectShifterMode('D')
  sim.setThrottle(0.8)
  for (let i = 0; i < 180; i++) {
    sim.update(1 / 120)
  }
  const preCorruptSpeed = useSimulationStore.getState().speed
  const preCorruptRpm = useSimulationStore.getState().rpm
  assert(preCorruptSpeed > 5, `Veículo em velocidade válida antes do teste de falha (${preCorruptSpeed.toFixed(1)} km/h)`)

  // Injeta corrupção não-física (NaN) em subsistema mutável
  useSimulationStore.getState()._physics!.setSpeedKmh(NaN)

  // Dispara o frame: o integrador deve capturar o NaN no candidato, abortar e acionar FAIL_SAFE_HOLD
  sim.update(1 / 120)

  assert(useSimulationStore.getState().physicsIntegrityStatus === 'FAIL_SAFE_HOLD', 'useSimulationStore entrou em FAIL_SAFE_HOLD após detecção de NaN')
  const heldSpeed = useSimulationStore.getState().speed
  const heldRpm = useSimulationStore.getState().rpm
  assert(!Number.isNaN(heldSpeed) && Number.isFinite(heldSpeed), `Velocidade na store NÃO foi corrompida por NaN (${heldSpeed.toFixed(1)} km/h)`)
  assert(Math.abs(heldSpeed - preCorruptSpeed) < 1e-9, 'Rollback transacional restaurou exatamente a última velocidade mestre válida')
  assert(!Number.isNaN(heldRpm) && Number.isFinite(heldRpm), `RPM na store NÃO foi corrompido por NaN (${heldRpm.toFixed(1)} RPM)`)

  // Verifica que os 5 subsistemas mutáveis foram restaurados a partir do snapshot e não retêm NaN
  const recoveredPhysSpeed = useSimulationStore.getState()._physics!.getSpeedKmh()
  const recoveredEngineRpm = useSimulationStore.getState()._engine!.getRpm()
  assert(!Number.isNaN(recoveredPhysSpeed) && Number.isFinite(recoveredPhysSpeed), `VehiclePhysics foi restaurado do snapshot limpo sem reter NaN (${recoveredPhysSpeed.toFixed(1)} km/h)`)
  assert(!Number.isNaN(recoveredEngineRpm) && Number.isFinite(recoveredEngineRpm), `EngineSimulator foi restaurado do snapshot limpo sem reter NaN (${recoveredEngineRpm.toFixed(1)} RPM)`)

  // Verifica que novos frames não avançam o relógio físico enquanto em FAIL_SAFE_HOLD
  const clockBefore = integrator!.getPhysicalTime()
  sim.update(1 / 60)
  assert(integrator!.getPhysicalTime() === clockBefore, 'Relógio físico permanece congelado enquanto em FAIL_SAFE_HOLD')

  sim.reset()
  assert(useSimulationStore.getState().physicsIntegrityStatus === 'NORMAL', 'Reset limpa FAIL_SAFE_HOLD e restaura integridade NORMAL')
}

console.log('\n===============================================================')
console.log(`RESULTADO DA FASE 1.6.1: ${passedCount} PASSOU | ${failedCount} FALHOU`)
console.log('===============================================================\n')

if (failedCount > 0) {
  process.exit(1)
}
