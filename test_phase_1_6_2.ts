/**
 * test_phase_1_6_2.ts
 *
 * Suíte de Testes da Fase 1.6.2 — Direção por Sensores de Inclinação Mobile
 *
 * Cobre rigorosamente os 12 critérios:
 * 1. Detecção de disponibilidade e fallback para não suportado.
 * 2. Permissão concedida vs negada vs prompt (fluxo iOS Safari).
 * 3. Calibração de ponto neutro e offset.
 * 4. Esterço esquerda e direita (valores de -1.0 a +1.0) em Paisagem e Retrato.
 * 5. Zona morta configurável (deadzone contínua sem degrau).
 * 6. Limites máximos de esterçamento (clamp em [-1.0, +1.0]).
 * 7. Rejeição de leituras inválidas (NaN, Infinity, null, undefined).
 * 8. Suavização temporal (filtro passa-baixa exponencial desacoplado do framerate).
 * 9. Retorno gradual ao centro (auto-centering).
 * 10. Alternância mútua entre touch e inclinação sem disputa de inputs.
 * 11. Ausência de alteração direta da física fora do ciclo determinístico.
 * 12. Compatibilidade e estabilidade com o integrador determinístico de 120 Hz da Fase 1.6.1.
 */

import { TiltSteeringController, type TiltSample } from './src/systems/input/TiltSteeringController'
import { useSimulationStore } from './src/stores/useSimulationStore'
import golfConfig from './public/vehicles/golf-gti/config.json' with { type: 'json' }
import porscheConfig from './public/vehicles/porsche-gt3/config.json' with { type: 'json' }
import type { VehicleConfig } from './src/types/vehicle'

let passedTests = 0
let failedTests = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    passedTests++
    console.log(`  [OK] ${msg}`)
  } else {
    failedTests++
    console.error(`  [FALHA] ${msg}`)
  }
}

function assertClose(actual: number, expected: number, tolerance = 1e-4, msg: string) {
  const diff = Math.abs(actual - expected)
  assert(diff <= tolerance, `${msg} (obtido=${actual.toFixed(5)}, esperado=${expected.toFixed(5)}, diff=${diff.toExponential(3)})`)
}

console.log('\n===============================================================')
console.log('  HEATZ AUTO · FASE 1.6.2 — DIREÇÃO POR SENSORES MOBILE')
console.log('===============================================================\n')

// ─── TESTE 1: Detecção de disponibilidade e fallback para não suportado ───
console.log('--- CRITÉRIO 1: Detecção de sensores e fallback para não suportado ---')
{
  const controller = new TiltSteeringController({ enabled: false })
  assert(!controller.isEnabled(), 'Controlador inicia desabilitado por padrão quando configurado enabled: false')

  // Avaliação sem leitura prévia
  const initialSteer = controller.getSteeringAngle()
  assert(initialSteer === 0, 'Ângulo inicial de esterço é exatamente 0.0')

  // Fallback quando amostra não possui dados de orientação
  const emptySample: TiltSample = { beta: null, gamma: null, isLandscape: true }
  const steerFromEmpty = controller.computeSteering(emptySample, 1 / 60)
  assert(steerFromEmpty === 0, 'Amostra nula retorna 0.0 sem erros de runtime')
}

// ─── TESTE 2: Permissão concedida vs negada vs prompt ───
console.log('\n--- CRITÉRIO 2: Permissão concedida vs negada vs prompt ---')
{
  const store = useSimulationStore.getState()
  assert(store.sensorPermission === 'prompt', 'Estado inicial de sensorPermission é "prompt"')

  useSimulationStore.getState().setSensorPermission('granted')
  assert(useSimulationStore.getState().sensorPermission === 'granted', 'setSensorPermission("granted") atualiza permissão para concedida')

  useSimulationStore.getState().setSensorPermission('denied')
  assert(useSimulationStore.getState().sensorPermission === 'denied', 'setSensorPermission("denied") atualiza permissão para negada')

  useSimulationStore.getState().setSensorPermission('unsupported')
  assert(useSimulationStore.getState().sensorPermission === 'unsupported', 'setSensorPermission("unsupported") reflete ausência de suporte no hardware/browser')

  // Restaura para prompt
  useSimulationStore.getState().setSensorPermission('prompt')
}

// ─── TESTE 3: Calibração de ponto neutro e offset ───
console.log('\n--- CRITÉRIO 3: Calibração de ponto neutro e offset ---')
{
  const controller = new TiltSteeringController({
    enabled: true,
    deadzoneDeg: 0,
    smoothingFactor: 1.0, // resposta instantânea para teste determinístico de calibração
    maxSteerAngleDeg: 30,
  })

  // Simula aparelho inclinado a 12° em repouso confortável nas mãos
  const restingSample: TiltSample = {
    beta: 12,
    gamma: 45, // pitch de elevação do aparelho
    isLandscape: true,
    orientationAngle: 90,
  }

  // Antes da calibração, 12° produz esterço não nulo
  const beforeCalib = controller.computeSteering(restingSample, 1 / 60)
  assert(Math.abs(beforeCalib) > 0.1, 'Antes da calibração, 12° produz esterço residual ativo')

  // Executa calibração de zero neutro
  const neutralAngle = controller.calibrate(restingSample)
  assertClose(neutralAngle, 12, 1e-3, 'Ponto neutro calibrado registrado em 12.0°')
  assert(controller.isCalibratedState(), 'Controlador reporta estado calibrado como verdadeiro')

  // Na mesma posição de 12°, agora deve produzir exatamente 0.0 de esterço
  const afterCalib = controller.computeSteering(restingSample, 1 / 60)
  assertClose(afterCalib, 0.0, 1e-3, 'Na posição calibrada de 12°, o esterço resultante é rigorosamente 0.0')

  // Se inclinar mais 15° (total 27°), o esterço deve refletir apenas o delta relativo (+15°)
  const tiltedSample: TiltSample = {
    beta: 27,
    gamma: 45,
    isLandscape: true,
    orientationAngle: 90,
  }
  const deltaSteer = controller.computeSteering(tiltedSample, 1 / 60)
  assertClose(deltaSteer, 0.5, 0.05, 'Inclinação de 27° (delta +15° sobre ponto de 30° max) gera esterço ~0.50')

  // Reset de calibração
  controller.resetCalibration()
  assert(!controller.isCalibratedState(), 'resetCalibration() restaura calibração para falso')
  assertClose(controller.getNeutralAngleDeg(), 0.0, 1e-3, 'Ponto neutro restaurado para 0.0°')
}

// ─── TESTE 4: Esterço esquerda e direita em Paisagem e Retrato ───
console.log('\n--- CRITÉRIO 4: Esterço esquerda e direita (valores de -1.0 a +1.0) ---')
{
  const controller = new TiltSteeringController({
    enabled: true,
    deadzoneDeg: 0,
    smoothingFactor: 1.0,
    maxSteerAngleDeg: 30,
    sensitivity: 1.0,
  })

  // 1. Paisagem primária (orientation = 90)
  // Inclinar esquerda (mão esquerda desce: beta negativo)
  const landLeftSample: TiltSample = { beta: -15, gamma: 20, isLandscape: true, orientationAngle: 90 }
  const landLeft = controller.computeSteering(landLeftSample, 1 / 60)
  assert(landLeft < 0, 'Inclinar para esquerda em Paisagem produz esterço negativo')
  assertClose(landLeft, -0.5, 0.02, 'Beta -15° com max 30° produz esterço ~ -0.50')

  // Inclinar direita (mão direita desce: beta positivo)
  const landRightSample: TiltSample = { beta: 15, gamma: 20, isLandscape: true, orientationAngle: 90 }
  const landRight = controller.computeSteering(landRightSample, 1 / 60)
  assert(landRight > 0, 'Inclinar para direita em Paisagem produz esterço positivo')
  assertClose(landRight, +0.5, 0.02, 'Beta +15° com max 30° produz esterço ~ +0.50')

  // 2. Paisagem invertida (orientation = 270 ou -90)
  // Na orientação invertida, o sensor físico do aparelho inverte o eixo beta; o controlador deve compensar!
  const landInvertedRightSample: TiltSample = { beta: -15, gamma: 20, isLandscape: true, orientationAngle: 270 }
  const landInvertedRight = controller.computeSteering(landInvertedRightSample, 1 / 60)
  assert(landInvertedRight > 0, 'Na orientação Paisagem 270°, virar para direita mantém esterço positivo (compensação de inversão)')

  // 3. Retrato (eixo de giro é gamma)
  const portLeftSample: TiltSample = { beta: 45, gamma: -15, isLandscape: false, orientationAngle: 0 }
  const portLeft = controller.computeSteering(portLeftSample, 1 / 60)
  assert(portLeft < 0, 'Virar à esquerda em Retrato (gamma negativo) produz esterço negativo')
  assertClose(portLeft, -0.5, 0.02, 'Gamma -15° em Retrato com max 30° produz ~ -0.50')

  const portRightSample: TiltSample = { beta: 45, gamma: +15, isLandscape: false, orientationAngle: 0 }
  const portRight = controller.computeSteering(portRightSample, 1 / 60)
  assert(portRight > 0, 'Virar à direita em Retrato (gamma positivo) produz esterço positivo')
  assertClose(portRight, +0.5, 0.02, 'Gamma +15° em Retrato com max 30° produz ~ +0.50')
}

// ─── TESTE 5: Zona morta (deadzone) contínua sem degrau ───
console.log('\n--- CRITÉRIO 5: Zona morta configurável sem degrau ---')
{
  const controller = new TiltSteeringController({
    enabled: true,
    deadzoneDeg: 3.0, // zona morta de 3 graus
    smoothingFactor: 1.0,
    maxSteerAngleDeg: 30,
    sensitivity: 1.0,
  })

  // Ângulos dentro da deadzone (<= 3.0°)
  const samplesWithinDeadzone = [0.5, 1.5, 2.9, -1.0, -2.8]
  let allZero = true
  for (const ang of samplesWithinDeadzone) {
    const steer = controller.computeSteering({ beta: ang, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60)
    if (steer !== 0) allZero = false
  }
  assert(allZero, 'Inclinações dentro da zona morta (<= 3.0°) produzem rigorosamente 0.0 de esterço')

  // Ao ultrapassar a deadzone, a resposta deve começar suavemente de 0.0 (sem salto brusco / sem degrau)
  const slightlyPastDeadzone = controller.computeSteering({ beta: 3.1, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  assert(slightlyPastDeadzone > 0 && slightlyPastDeadzone < 0.02, `Transição da deadzone é contínua e infinitesimal (obtido=${slightlyPastDeadzone.toFixed(4)})`)
}

// ─── TESTE 6: Limites máximos de esterçamento (clamp a [-1.0, +1.0]) ───
console.log('\n--- CRITÉRIO 6: Limites máximos de esterçamento (clamp ±1.0) ---')
{
  const controller = new TiltSteeringController({
    enabled: true,
    deadzoneDeg: 0,
    smoothingFactor: 1.0,
    maxSteerAngleDeg: 25,
    sensitivity: 2.0, // sensibilidade dobrada
    maxSteerLimit: 1.0,
  })

  // Inclinação extrema para direita: 60°, 90°, 150°
  const extremeRight = controller.computeSteering({ beta: 85, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  assert(extremeRight === 1.0, `Inclinação extrema para direita satura exatamente em +1.0 (obtido=${extremeRight})`)

  // Inclinação extrema para esquerda: -60°, -90°
  const extremeLeft = controller.computeSteering({ beta: -85, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  assert(extremeLeft === -1.0, `Inclinação extrema para esquerda satura exatamente em -1.0 (obtido=${extremeLeft})`)
}

// ─── TESTE 7: Rejeição de leituras inválidas (NaN, Infinity) ───
console.log('\n--- CRITÉRIO 7: Rejeição de leituras espúrias (NaN, Infinity, null) ---')
{
  const controller = new TiltSteeringController({
    enabled: true,
    deadzoneDeg: 0,
    smoothingFactor: 1.0,
    maxSteerAngleDeg: 30,
  })

  // Estabelece leitura válida prévia (+0.4)
  controller.computeSteering({ beta: 12, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  const validSteer = controller.getSteeringAngle()
  assert(Number.isFinite(validSteer) && validSteer > 0, 'Leitura válida estabelecida')

  // Injeta amostras corrompidas com NaN e Infinity
  const corruptedSamples: TiltSample[] = [
    { beta: NaN, gamma: 0, isLandscape: true },
    { beta: Infinity, gamma: 0, isLandscape: true },
    { beta: -Infinity, gamma: 0, isLandscape: true },
    { beta: null, gamma: null, isLandscape: true },
  ]

  for (const badSample of corruptedSamples) {
    const output = controller.computeSteering(badSample, 1 / 60)
    assert(Number.isFinite(output), `computeSteering com ${badSample.beta} rejeitou sem retornar NaN/Infinity (retornou=${output})`)
  }

  // Verifica se o estado interno do controlador permaneceu íntegro
  const stateAfterCorruption = controller.getState()
  assert(Number.isFinite(stateAfterCorruption.filteredSteer), 'Estado interno do filtro permaneceu finito e protegido contra infecção por NaN')
}

// ─── TESTE 8: Suavização temporal (filtro passa-baixa desacoplado) ───
console.log('\n--- CRITÉRIO 8: Suavização temporal (filtro passa-baixa exponencial) ---')
{
  const controller = new TiltSteeringController({
    enabled: true,
    deadzoneDeg: 0,
    smoothingFactor: 0.05, // filtro passa-baixa com resposta progressiva
    maxSteerAngleDeg: 30,
  })

  // Degrau súbito de 0° para 30° (alvo = 1.0)
  const dt = 1 / 60
  const step1 = controller.computeSteering({ beta: 30, gamma: 0, isLandscape: true, orientationAngle: 90 }, dt)
  assert(step1 > 0 && step1 < 0.5, `Primeiro frame sob filtro não pula bruscamente para 1.0 (step1=${step1.toFixed(3)})`)

  const step2 = controller.computeSteering({ beta: 30, gamma: 0, isLandscape: true, orientationAngle: 90 }, dt)
  assert(step2 > step1, `Segundo frame avança suavemente (step2=${step2.toFixed(3)} > step1=${step1.toFixed(3)})`)

  // Evolui 20 frames (~0.33s)
  let current = step2
  for (let i = 0; i < 20; i++) {
    current = controller.computeSteering({ beta: 30, gamma: 0, isLandscape: true, orientationAngle: 90 }, dt)
  }
  assert(current > 0.95 && current <= 1.0, `Após convergência suave, atinge o valor alvo com estabilidade (obtido=${current.toFixed(4)})`)
}

// ─── TESTE 9: Retorno gradual ao centro (Auto-Centering) ───
console.log('\n--- CRITÉRIO 9: Retorno gradual ao centro ---')
{
  const controller = new TiltSteeringController({
    enabled: true,
    autoCenterRate: 4.0, // taxa de auto-centralização
    smoothingFactor: 1.0,
  })

  // Esterça para 0.8
  controller.computeSteering({ beta: 24, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  assertClose(controller.getSteeringAngle(), 0.8, 0.05, 'Esterço inicial estabelecido em ~0.8')

  // Simula usuário soltando o sensor (stepAutoCentering)
  const centered1 = controller.stepAutoCentering(0.05)
  assert(centered1 < 0.8 && centered1 > 0, `Auto-centering reduz o esterço gradualmente (após 50ms = ${centered1.toFixed(3)})`)

  // Avança tempo suficiente para retornar a zero
  let finalCentered = centered1
  for (let i = 0; i < 40; i++) {
    finalCentered = controller.stepAutoCentering(0.05)
  }
  assert(finalCentered === 0, `Após retorno ao centro, atinge rigorosamente zero (obtido=${finalCentered})`)
}

// ─── TESTE 10: Alternância mútua entre touch e inclinação sem disputa ───
console.log('\n--- CRITÉRIO 10: Alternância mútua entre touch e inclinação sem disputa ---')
{
  const store = useSimulationStore.getState()

  // 1. Configura modo TOUCH
  store.setSteeringMethod('touch')
  assert(useSimulationStore.getState().steeringMethod === 'touch', 'Modo touch ativado')

  // Touch deve ter sucesso
  store.setSteeringAngle(0.65, 'touch')
  assertClose(useSimulationStore.getState().steeringAngle, 0.65, 1e-4, 'setSteeringAngle de fonte touch aceito quando steeringMethod == "touch"')

  // Tilt deve ser rejeitado em modo touch
  store.setSteeringAngle(-0.80, 'tilt')
  assertClose(useSimulationStore.getState().steeringAngle, 0.65, 1e-4, 'setSteeringAngle de fonte tilt é IGNORADO quando steeringMethod == "touch"')

  // 2. Configura modo TILT
  store.setSteeringMethod('tilt')
  assert(useSimulationStore.getState().steeringMethod === 'tilt', 'Modo tilt ativado')
  assert(useSimulationStore.getState().steeringAngle === 0, 'Ao alternar modo, volante é centrado em 0')

  // Tilt deve ter sucesso
  store.setSteeringAngle(-0.45, 'tilt')
  assertClose(useSimulationStore.getState().steeringAngle, -0.45, 1e-4, 'setSteeringAngle de fonte tilt aceito quando steeringMethod == "tilt"')

  // Touch deve ser rejeitado em modo tilt
  store.setSteeringAngle(0.90, 'touch')
  assertClose(useSimulationStore.getState().steeringAngle, -0.45, 1e-4, 'setSteeringAngle de fonte touch é IGNORADO quando steeringMethod == "tilt" (sem disputa)')

  // Teclado funciona em ambos como acessibilidade/fallback
  store.setSteeringAngle(0.75, 'keyboard')
  assertClose(useSimulationStore.getState().steeringAngle, 0.75, 1e-4, 'Entrada de teclado é permitida em conformidade com acessibilidade')

  // Restaura para modo touch
  store.setSteeringMethod('touch')
}

// ─── TESTE 11: Ausência de alteração direta da física fora do ciclo determinístico ───
console.log('\n--- CRITÉRIO 11: Ausência de alteração direta da física fora do ciclo determinístico ---')
{
  useSimulationStore.getState().init(golfConfig as unknown as VehicleConfig)

  const speedBefore = useSimulationStore.getState().speed
  const rpmBefore = useSimulationStore.getState().rpm
  const integrityBefore = useSimulationStore.getState().physicsIntegrityStatus

  // Alterar esterço via sensor mobile
  useSimulationStore.getState().setSteeringMethod('tilt')
  useSimulationStore.getState().setSteeringAngle(0.85, 'tilt')

  const speedAfter = useSimulationStore.getState().speed
  const rpmAfter = useSimulationStore.getState().rpm
  const integrityAfter = useSimulationStore.getState().physicsIntegrityStatus

  assert(speedAfter === speedBefore, 'Alteração do sensor de esterço NÃO altera velocidade física diretamente')
  assert(rpmAfter === rpmBefore, 'Alteração do sensor de esterço NÃO altera RPM físico diretamente')
  assert(integrityAfter === integrityBefore && integrityAfter === 'NORMAL', 'Integridade física permanece NORMAL sem efeitos colaterais fora do ciclo')
}

// ─── TESTE 12: Compatibilidade com integrador determinístico de 120 Hz ───
console.log('\n--- CRITÉRIO 12: Compatibilidade e estabilidade com integrador 120 Hz ---')
{
  useSimulationStore.getState().init(porscheConfig as unknown as VehicleConfig)
  useSimulationStore.getState().startEngine()
  useSimulationStore.getState().selectShifterMode('D')
  useSimulationStore.getState().setHandbrake(false)
  useSimulationStore.getState().setSteeringMethod('tilt')

  let allStepsValid = true
  let noFailSafe = true

  // Simula 120 quadros (~2 segundos) com o volante variando sob inclinação e o carro acelerando
  const dtFrame = 1 / 60
  for (let frame = 0; frame < 120; frame++) {
    // Simula inclinação oscilante: senóide suave
    const simulatedAngle = Math.sin(frame * 0.1) * 0.75
    useSimulationStore.getState().setSteeringAngle(simulatedAngle, 'tilt')

    // Acelera levemente
    useSimulationStore.getState().setThrottle(0.6)

    // Avança o loop determinístico
    useSimulationStore.getState().update(dtFrame)

    const state = useSimulationStore.getState()
    if (state.physicsIntegrityStatus !== 'NORMAL') {
      noFailSafe = false
    }
    if (!Number.isFinite(state.speed) || !Number.isFinite(state.rpm) || !Number.isFinite(state.steeringAngle)) {
      allStepsValid = false
    }
  }

  assert(noFailSafe, 'Nenhum FAIL_SAFE_HOLD disparado durante 120 quadros de condução sob direção por inclinação')
  assert(allStepsValid, 'Todos os estados físicos e de esterço permaneceram estritamente finitos e íntegros a 120 Hz')
  assert(useSimulationStore.getState().speed > 0, `Porsche GT3 acelerou normalmente com esterço tilt ativo (velocidade=${useSimulationStore.getState().speed.toFixed(1)} km/h)`)
}

// ─── FINALIZAÇÃO ───
console.log('\n===============================================================')
console.log(`RESULTADO DA FASE 1.6.2: ${passedTests} PASSOU | ${failedTests} FALHOU`)
console.log('===============================================================\n')

if (failedTests > 0) {
  process.exit(1)
}
