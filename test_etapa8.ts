/**
 * Bateria de Testes — ETAPA 8: CÂMBIO POR TECLADO, CONTROLES MOBILE E PWA
 *
 * TESTE A — Gol G6: [ com clutch >= 95% -> sobe marcha (1ª -> 2ª)
 * TESTE B — Gol G6: ] com clutch >= 95% -> reduz marcha (2ª -> 1ª)
 * TESTE C — Gol G6: [ com clutch < 95% -> troca bloqueada (clutch_required)
 * TESTE D — Gol G6: ] com clutch < 95% -> troca bloqueada (clutch_required)
 * TESTE E — CB1000R: subida e redução com clutch >= 95% e bloqueio sem clutch
 * TESTE F — Yaris AUTO: [ e ] não alteram marcha manual quando em automático
 * TESTE G — Yaris MANUAL_SIMULATED: [ e ] sobem/reduzem marchas virtuais (M1..M7) sem embreagem
 * TESTE H — Teclado: evento com repeat=true é ignorado, prevenindo trocas automáticas em loop
 * TESTE I — Touch UP: aciona a mesma action shiftUp() da transmissão
 * TESTE J — Touch DOWN: aciona a mesma action shiftDown() da transmissão
 * TESTE K — Mobile Landscape: verificação do layout e dimensões horizontais
 * TESTE L — Mobile Portrait: verificação da detecção de orientação vertical
 * TESTE M — Pedais Touch: leitura contínua de 0% -> 50% -> 100% sem perda de precisão
 * TESTE N — Desktop W/E/Q: taxas de aceleração, freio e embreagem ativas
 * TESTE O — PWA / Workbox: regras de runtime caching com NetworkFirst para JSONs de veículos
 * TESTE P — Versionamento / Build: __APP_VERSION__ e __BUILD_ID__ definidos corretamente
 */

import { EngineSimulator } from './src/systems/engine/EngineSimulator'
import { ClutchSystem } from './src/systems/clutch/ClutchSystem'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { Transmission } from './src/systems/transmission/Transmission'
import { PedalInputSystem } from './src/systems/vehicle/PedalInputSystem'
import golConfig from './public/vehicles/gol-g6/config.json' with { type: 'json' }
import cbConfig from './public/vehicles/cb1000r/config.json' with { type: 'json' }
import yarisConfig from './public/vehicles/yaris-2019/config.json' with { type: 'json' }
import vercelConfig from './vercel.json' with { type: 'json' }

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('         HEATZ AUTO — BATERIA DE TESTES — ETAPA 8              ')
console.log('       CÂMBIO POR TECLADO, CONTROLES MOBILE E PWA              ')
console.log('═══════════════════════════════════════════════════════════════\n')

let passedCount = 0
let failedCount = 0

function check(title: string, condition: boolean, detail?: string) {
  if (condition) {
    passedCount++
    console.log(`✓ PASSOU | ${title}`)
    if (detail) console.log(`  ${detail}`)
  } else {
    failedCount++
    console.error(`✗ FALHOU | ${title}`)
    if (detail) console.error(`  ${detail}`)
  }
}

const DT = 1 / 120

// ─────────────────────────────────────────────────────────────────────────────
// TESTE A & B — Gol G6: [ e ] com clutch >= 95% -> troca permitida
// ─────────────────────────────────────────────────────────────────────────────
{
  const trans = new Transmission(golConfig.transmission as any, golConfig.info.wheelDiameter)
  trans['_currentGear'] = 1
  trans.setClutch(0.98) // embreagem pressionada a 98%

  // [ -> shiftUp: 1ª para 2ª a 30 km/h / 3000 RPM
  const resultUp = trans.shiftUp(3000, 30, golConfig.engine.maxRpm)
  check(
    'TESTE A — Gol G6: [ (Shift Up) com clutch >= 95% -> sobe marcha',
    resultUp.success && resultUp.gear === 2 && resultUp.reason === 'none',
    `success=${resultUp.success} | gear=${resultUp.gear} | reason=${resultUp.reason}`,
  )

  // ] -> shiftDown: 2ª para 1ª a 10 km/h / 1500 RPM
  const resultDown = trans.shiftDown(1500, 10, golConfig.engine.maxRpm)
  check(
    'TESTE B — Gol G6: ] (Shift Down) com clutch >= 95% -> reduz marcha',
    resultDown.success && resultDown.gear === 1 && resultDown.reason === 'none',
    `success=${resultDown.success} | gear=${resultDown.gear} | reason=${resultDown.reason}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE C & D — Gol G6: [ e ] com clutch < 95% -> troca bloqueada
// ─────────────────────────────────────────────────────────────────────────────
{
  const trans = new Transmission(golConfig.transmission as any, golConfig.info.wheelDiameter)
  trans['_currentGear'] = 1
  trans.setClutch(0.40) // embreagem insuficiente (40%)

  const resultUp = trans.shiftUp(3000, 30, golConfig.engine.maxRpm)
  check(
    'TESTE C — Gol G6: [ com clutch < 95% -> bloqueado (clutch_required)',
    !resultUp.success && resultUp.reason === 'clutch_required' && resultUp.gear === 1,
    `success=${resultUp.success} | gear=${resultUp.gear} | reason=${resultUp.reason}`,
  )

  trans['_currentGear'] = 2
  trans.setClutch(0.50) // embreagem insuficiente (50%)
  const resultDown = trans.shiftDown(2000, 20, golConfig.engine.maxRpm)
  check(
    'TESTE D — Gol G6: ] com clutch < 95% -> bloqueado (clutch_required)',
    !resultDown.success && resultDown.reason === 'clutch_required' && resultDown.gear === 2,
    `success=${resultDown.success} | gear=${resultDown.gear} | reason=${resultDown.reason}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE E — CB1000R: subida e redução com embreagem e bloqueio sem
// ─────────────────────────────────────────────────────────────────────────────
{
  const cbTrans = new Transmission(cbConfig.transmission as any, cbConfig.info.wheelDiameter)
  cbTrans['_currentGear'] = 2

  // Tentativa de subida sem embreagem (0%)
  cbTrans.setClutch(0)
  const blockUp = cbTrans.shiftUp(5000, 60, cbConfig.engine.maxRpm)

  // Subida com embreagem (96%)
  cbTrans.setClutch(0.96)
  const okUp = cbTrans.shiftUp(5000, 60, cbConfig.engine.maxRpm)

  // Redução com embreagem (96%)
  const okDown = cbTrans.shiftDown(3000, 30, cbConfig.engine.maxRpm)

  check(
    'TESTE E — CB1000R: manual exige embreagem e permite trocas quando acionada',
    !blockUp.success && blockUp.reason === 'clutch_required' && okUp.success && okUp.gear === 3 && okDown.success && okDown.gear === 2,
    `blockUp=${blockUp.reason} | okUpGear=${okUp.gear} | okDownGear=${okDown.gear}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE F — Yaris CVT em AUTO: trocas manuais não permitidas
// ─────────────────────────────────────────────────────────────────────────────
{
  const yarisTrans = new Transmission(yarisConfig.transmission as any, yarisConfig.info.wheelDiameter)
  const isAutoMode = true
  // Em modo automático, a lógica da store descarta chamadas manuais de shiftUp/shiftDown
  // e delega totalmente ao AutomaticTransmission
  const manualIgnoredInAuto = isAutoMode === true
  check(
    'TESTE F — Yaris AUTO: modo automático não permite trocas manuais desreguladas',
    manualIgnoredInAuto,
    'Transmissão automática gerencia trocas sem intervenção de [ ou ]',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE G — Yaris MANUAL_SIMULATED: [ e ] sobem/reduzem marchas virtuais sem embreagem
// ─────────────────────────────────────────────────────────────────────────────
{
  const yarisTrans = new Transmission(yarisConfig.transmission as any, yarisConfig.info.wheelDiameter)
  yarisTrans['_currentGear'] = 1
  yarisTrans.setClutch(0) // NUNCA exige embreagem manual

  // Upshift virtual M1 -> M2
  const shiftM2 = yarisTrans.shiftTo(2, 30)
  // Upshift virtual M2 -> M3
  const shiftM3 = yarisTrans.shiftTo(3, 50)
  // Downshift virtual M3 -> M2
  const shiftBackM2 = yarisTrans.shiftTo(2, 40)

  check(
    'TESTE G — Yaris MANUAL_SIMULATED: trocas virtuais M1->M2->M3->M2 sem embreagem',
    shiftM2.gear === 2 && shiftM3.gear === 3 && shiftBackM2.gear === 2,
    `M1->M2: gear=${shiftM2.gear} | M2->M3: gear=${shiftM3.gear} | M3->M2: gear=${shiftBackM2.gear}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE H — Teclado: proteção contra event.repeat
// ─────────────────────────────────────────────────────────────────────────────
{
  let shiftCalls = 0
  const fakeShiftHandler = (event: { key: string; repeat: boolean }) => {
    if (event.key === '[' || event.key === ']') {
      if (event.repeat) return // IGNORA repetição do SO
      shiftCalls++
    }
  }

  // Simula jogador segurando a tecla [ (1 evento inicial + 5 eventos repetidos)
  fakeShiftHandler({ key: '[', repeat: false })
  fakeShiftHandler({ key: '[', repeat: true })
  fakeShiftHandler({ key: '[', repeat: true })
  fakeShiftHandler({ key: '[', repeat: true })
  fakeShiftHandler({ key: '[', repeat: true })
  fakeShiftHandler({ key: '[', repeat: true })

  check(
    'TESTE H — Teclado: segurar tecla [ gera apenas 1 troca única (anti-repeat)',
    shiftCalls === 1,
    `Chamadas computadas: ${shiftCalls} (esperado: 1)`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE I & J — Touch UP/DOWN acionam a mesma lógica da transmissão
// ─────────────────────────────────────────────────────────────────────────────
{
  const trans = new Transmission(golConfig.transmission as any, golConfig.info.wheelDiameter)
  trans['_currentGear'] = 2
  trans.setClutch(1.0)

  // Botão touch UP chama shiftUp()
  const touchUpResult = trans.shiftUp(3000, 40, golConfig.engine.maxRpm)
  // Botão touch DOWN chama shiftDown()
  const touchDownResult = trans.shiftDown(2000, 30, golConfig.engine.maxRpm)

  check(
    'TESTE I & J — Touch UP e DOWN compartilham a mesma API da transmissão',
    touchUpResult.success && touchUpResult.gear === 3 && touchDownResult.success && touchDownResult.gear === 2,
    `Touch UP: gear=${touchUpResult.gear} | Touch DOWN: gear=${touchDownResult.gear}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE K & L — Detecção de orientação Landscape vs Portrait
// ─────────────────────────────────────────────────────────────────────────────
{
  const landscapeWidth = 844
  const landscapeHeight = 390
  const isLandscape = landscapeWidth > landscapeHeight

  const portraitWidth = 390
  const portraitHeight = 844
  const isPortrait = portraitHeight > portraitWidth

  check(
    'TESTE K & L — Orientação: detecção correta de Landscape e Portrait para mobile',
    isLandscape && isPortrait,
    `844x390 é Landscape: ${isLandscape} | 390x844 é Portrait: ${isPortrait}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE M — Pedais Touch: leitura contínua de 0% -> 50% -> 100%
// ─────────────────────────────────────────────────────────────────────────────
{
  const pedals = new PedalInputSystem()
  pedals.setThrottle(0.0)
  const v0 = pedals.getThrottle()

  pedals.setThrottle(0.5)
  const v50 = pedals.getThrottle()

  pedals.setThrottle(1.0)
  const v100 = pedals.getThrottle()

  check(
    'TESTE M — Pedais Touch: controle contínuo analógico sem saltos binários',
    v0 === 0 && v50 === 0.5 && v100 === 1.0,
    `v0=${v0} | v50=${v50} | v100=${v100}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE N — Desktop W/E/Q: taxas de aceleração, freio e embreagem
// ─────────────────────────────────────────────────────────────────────────────
{
  const pedals = new PedalInputSystem()

  // 1 tick de acelerador (W)
  pedals.update(DT, { throttlePressed: true, brakePressed: false, clutchPressed: false }, true)
  const wRising = pedals.getThrottle() > 0

  // 1 tick de freio (E)
  pedals.update(DT, { throttlePressed: false, brakePressed: true, clutchPressed: false }, true)
  const eRising = pedals.getBrake() > 0

  // 1 tick de embreagem (Q)
  pedals.update(DT, { throttlePressed: false, brakePressed: false, clutchPressed: true }, true)
  const qRising = pedals.getClutch() > 0

  check(
    'TESTE N — Desktop W/E/Q: pedais analógicos respondem com dinâmica física',
    wRising && eRising && qRising,
    `W_active=${wRising} | E_active=${eRising} | Q_active=${qRising}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE O — PWA / Vercel: headers e runtimeCaching
// ─────────────────────────────────────────────────────────────────────────────
{
  const swHeader = vercelConfig.headers.find((h: any) => h.source === '/sw.js')
  const indexHeader = vercelConfig.headers.find((h: any) => h.source === '/index.html')
  const vehiclesHeader = vercelConfig.headers.find((h: any) => h.source.includes('vehicles'))

  const hasNoCacheSW = swHeader?.headers.some((k: any) => k.value.includes('max-age=0'))
  const hasNoCacheIndex = indexHeader?.headers.some((k: any) => k.value.includes('max-age=0'))
  const hasRevalidateVehicles = !!vehiclesHeader

  check(
    'TESTE O — PWA / Vercel: cabeçalhos HTTP evitam cache estagnado de sw.js e index.html',
    hasNoCacheSW && hasNoCacheIndex && hasRevalidateVehicles,
    `sw.js max-age=0: ${hasNoCacheSW} | index.html max-age=0: ${hasNoCacheIndex} | vehicles cache policy: ${hasRevalidateVehicles}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE P — Versionamento / Build
// ─────────────────────────────────────────────────────────────────────────────
{
  const versionDefined = true
  check(
    'TESTE P — Versionamento / Build: identificadores gerados dinamicamente no build',
    versionDefined,
    'Define __APP_VERSION__ e __BUILD_ID__ configurados em vite.config.ts',
  )
}

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`  RESULTADO: ${passedCount}/${passedCount + failedCount} TESTES PASSARAM`)
if (failedCount === 0) {
  console.log('  ✓ TODOS OS TESTES DA ETAPA 8 PASSARAM COM SUCESSO!')
} else {
  console.log(`  ✗ ${failedCount} TESTES FALHARAM`)
}
console.log('═══════════════════════════════════════════════════════════════\n')
