/**
 * HEATZ AUTO — FASE 4.2: Suíte Completa de Testes de Cabine, Climatização, Vidros, Ignição e Iluminação
 *
 * Verifica:
 * 1. ClimateSystem: evolução térmica, limites [16..30°C], compressor ligado/desligado, motor desligado,
 *    ventilação elétrica independente do compressor, carga mecânica no virabrequim sem duplicação,
 *    determinismo em passos fixos de 120 Hz e respeito a `VehicleCabinSpec` (incluindo CB1000R e clássicos sem A/C).
 * 2. WindowSystem: abertura individual e gradual (0% a 100%), limites, efeito único no arrasto aerodinâmico,
 *    ruído/filtro acústico da cabine (2200 Hz a 14000 Hz), compatibilidade com `windowsOpen`, veículos de 2 e 4 vidros e moto sem vidros.
 * 3. IgnitionSystem: máquina de estados `OFF -> ACC -> ON -> CRANK -> ON`, partida por chave e por botão,
 *    intertravamento explícito por freio (`brake`) e por embreagem (`clutch`), retorno automático `CRANK -> ON`,
 *    falhas de partida (bateria descarregada, pane seca, motor fundido), desligamento e reinicialização coordenados com `EngineSimulator`.
 * 4. LightingSystem: setas esquerda/direita, pisca-alerta, frequência determinística de 1,4 Hz,
 *    sincronização visual/funcional, faróis e bloqueio de farol de neblina em veículos sem o equipamento.
 * 5. Migração declarativa dos 10 veículos atuais nos arquivos `public/vehicles/<id>/config.json`.
 */

import fs from 'fs'
import path from 'path'
import type { VehicleConfig } from './src/types/vehicle'
import {
  resolveVehicleCabin,
  resolveVehicleIgnition,
  validateVehicleConfig,
} from './src/systems/vehicle/vehicleResolvers'
import {
  ClimateSystem,
  CLIMATE_CALIBRATION,
  WindowSystem,
  WINDOW_CALIBRATION,
  IgnitionSystem,
  LightingSystem,
  LIGHTING_CALIBRATION,
} from './src/systems/cabin'
import { useSimulationStore } from './src/stores/useSimulationStore'

let passed = 0
let failed = 0

function assert(cond: boolean, name: string, detail = '') {
  if (cond) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const REPO = process.cwd()
const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'public', 'vehicles', 'manifest.json'), 'utf8'))

function loadVehicle(id: string): VehicleConfig {
  const entry = manifest.vehicles.find((v: any) => v.id === id)
  if (!entry) throw new Error(`Veículo ${id} não encontrado no manifest`)
  const cfgPath = path.join(REPO, 'public', entry.configPath.replace(/^\//, ''))
  return JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as VehicleConfig
}

function stepStoreSeconds(seconds: number) {
  const ticks = Math.round(seconds * 120)
  const sim = useSimulationStore.getState()
  for (let i = 0; i < ticks; i++) {
    sim.update(1 / 120)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. MIGRAÇÃO DECLARATIVA DOS 10 VEÍCULOS EXISTENTES
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n=== FASE 4.2 — 1. CONTRATOS DECLARATIVOS DE CABINE E IGNIÇÃO NOS 10 VEÍCULOS ===')

for (const entry of manifest.vehicles) {
  const cfg = loadVehicle(entry.id)
  const val = validateVehicleConfig(cfg)
  assert(val.valid, `[${cfg.id}] config.json válido com ignition e cabin declarativos`, val.errors.join('; '))
  assert(
    Boolean(cfg.ignition && cfg.ignition.startInterlock),
    `[${cfg.id}] declara ignition.startInterlock explícito (${cfg.ignition?.startInterlock})`,
  )
  assert(
    Boolean(cfg.cabin && cfg.cabin.climateType),
    `[${cfg.id}] declara cabin.climateType explícito (${cfg.cabin?.climateType})`,
  )
}

const cb1000r = loadVehicle('cb1000r')
const golQuadrado = loadVehicle('gol-quadrado-turbo')
const opala = loadVehicle('opala-4100')
const civicSi = loadVehicle('civic-si')
const golfGti = loadVehicle('golf-gti')
const porsche = loadVehicle('porsche-gt3')
const toroEndurance = loadVehicle('fiat-toro-endurance-2025')
const toroRanch = loadVehicle('fiat-toro-ranch-2025')
const golG6 = loadVehicle('gol-g6')

assert(
  cb1000r.cabin?.climateType === 'none' && cb1000r.cabin?.windowCount === 0 && !cb1000r.ignition?.supportsAccessoryMode,
  'CB1000R não recebe funcionalidades de cabine automotiva (climateType=none, windowCount=0, supportsAccessoryMode=false)',
)
assert(
  golQuadrado.cabin?.hasAcCompressor === false && golQuadrado.cabin?.windowCount === 2 && golQuadrado.cabin?.windowControlType === 'manual_crank',
  'Gol Quadrado declara ventilação manual sem A/C e 2 vidros a manivela',
)
assert(
  opala.cabin?.hasAcCompressor === false && opala.cabin?.windowCount === 4 && opala.cabin?.windowControlType === 'manual_crank',
  'Opala 4.1 declara ventilação manual sem A/C e 4 vidros a manivela',
)

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SISTEMA DE CLIMATIZAÇÃO (ClimateSystem)
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n=== FASE 4.2 — 2. SISTEMA DE CLIMATIZAÇÃO (ClimateSystem) ===')

{
  const gtiCabin = resolveVehicleCabin(golfGti)
  const clim = new ClimateSystem(gtiCabin)

  // Limites de temperatura [16°C, 30°C]
  clim.setTargetTempC(10)
  assert(clim.getTargetTempC() === CLIMATE_CALIBRATION.MIN_TARGET_TEMP_C, 'Limite inferior de temperatura desejada = 16.0°C')
  clim.setTargetTempC(42)
  assert(clim.getTargetTempC() === CLIMATE_CALIBRATION.MAX_TARGET_TEMP_C, 'Limite superior de temperatura desejada = 30.0°C')
  clim.setTargetTempC(18.0)

  // Ventilação elétrica independente do compressor (motor desligado, chave em ON)
  clim.setAcEnabled(true)
  clim.setFanLevel(3)
  clim.setDefrosterEnabled(true)
  const offSnap = clim.tick({
    deltaTime: 1 / 120,
    isEngineRunning: false,
    engineRpm: 0,
    coolantTempC: 88,
    ignitionPosition: 'ON',
    windowOpenRatio: 0,
  })
  assert(
    !offSnap.isCompressorEngaged && offSnap.compressorMechanicalPowerW === 0 && offSnap.compressorLoadTorqueNm === 0,
    'Motor desligado: compressor permanece desacoplado com 0 W mecânicos e 0 Nm no virabrequim',
  )
  assert(
    offSnap.blowerElectricalPowerW > 0,
    `Ventilação elétrica e desembaçador operam na chave ON independentes do compressor (${offSnap.blowerElectricalPowerW} W)`,
  )

  // Compressor acoplado com motor funcionando e conversão P = tau * omega
  const initialTemp = clim.getCabinTempC()
  let onSnap = offSnap
  for (let i = 0; i < 120 * 15; i++) {
    onSnap = clim.tick({
      deltaTime: 1 / 120,
      isEngineRunning: true,
      engineRpm: 2400,
      coolantTempC: 90,
      ignitionPosition: 'ON',
      windowOpenRatio: 0,
    })
  }
  const expectedOmega = (2400 * 2 * Math.PI) / 60
  const expectedTorque = onSnap.compressorMechanicalPowerW / expectedOmega
  assert(onSnap.isCompressorEngaged, 'Motor ligado + A/C ativo + ventilação > 0 acopla o compressor')
  assert(
    Math.abs(onSnap.compressorLoadTorqueNm - expectedTorque) < 1e-4 && onSnap.compressorLoadTorqueNm > 2.0,
    `Conversão potência -> torque do compressor exata: ${onSnap.compressorMechanicalPowerW.toFixed(0)} W @ 2400 RPM = ${onSnap.compressorLoadTorqueNm.toFixed(2)} Nm`,
  )
  assert(
    onSnap.cabinTempC < initialTemp - 2.0,
    `Evolução térmica de resfriamento contínua: cabine caiu de ${initialTemp.toFixed(2)}°C para ${onSnap.cabinTempC.toFixed(2)}°C`,
  )

  // Aquecimento em veículo clássico sem A/C (Gol Quadrado)
  const golClim = new ClimateSystem(resolveVehicleCabin(golQuadrado))
  golClim.setAmbientTempC(14.0)
  golClim.setCabinTempC(14.0)
  golClim.setAcEnabled(true) // Deve ser rejeitado pois hasAcCompressor = false
  assert(!golClim.isAcEnabled(), 'Veículo sem compressor de A/C rejeita ativação de A/C')
  golClim.setTargetTempC(26.0)
  golClim.setHeaterEnabled(true)
  golClim.setFanLevel(4)
  for (let i = 0; i < 120 * 12; i++) {
    golClim.tick({
      deltaTime: 1 / 120,
      isEngineRunning: true,
      engineRpm: 2200,
      coolantTempC: 90,
      ignitionPosition: 'ON',
      windowOpenRatio: 0,
    })
  }
  assert(
    golClim.getCabinTempC() > 16.5 && golClim.getCompressorLoadTorqueNm() === 0,
    `Aquecedor eleva temperatura da cabine (${golClim.getCabinTempC().toFixed(2)}°C) com 0 Nm de carga de compressor`,
  )

  // Determinismo estrito em passos fixos de 120 Hz
  const c1 = new ClimateSystem(gtiCabin)
  const c2 = new ClimateSystem(gtiCabin)
  c1.setAcEnabled(true)
  c1.setFanLevel(4)
  c1.setRecirculation(true)
  c2.setAcEnabled(true)
  c2.setFanLevel(4)
  c2.setRecirculation(true)
  for (let i = 0; i < 600; i++) {
    c1.tick({ deltaTime: 1 / 120, isEngineRunning: true, engineRpm: 2150, coolantTempC: 90, ignitionPosition: 'ON', windowOpenRatio: 0.25 })
    c2.tick({ deltaTime: 1 / 120, isEngineRunning: true, engineRpm: 2150, coolantTempC: 90, ignitionPosition: 'ON', windowOpenRatio: 0.25 })
  }
  assert(
    c1.getCabinTempC() === c2.getCabinTempC() && c1.getCompressorLoadTorqueNm() === c2.getCompressorLoadTorqueNm(),
    'Determinismo estrito de 120 Hz no ClimateSystem confirmado bit-a-bit',
  )

  // Carga mecânica no motor sem duplicação na store (comparação A/C OFF vs A/C ON)
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(golfGti)
  sim.startEngine()
  stepStoreSeconds(0.6)
  sim.selectDrive()
  sim.setThrottle(0.65)
  stepStoreSeconds(3.0)
  const speedAcOff = useSimulationStore.getState().speed

  sim.reset()
  sim.init(golfGti)
  sim.startEngine()
  stepStoreSeconds(0.6)
  sim.toggleClimateAc()
  sim.setClimateFanLevel(5)
  sim.selectDrive()
  sim.setThrottle(0.65)
  stepStoreSeconds(3.0)
  const stAcOn = useSimulationStore.getState()
  const speedAcOn = stAcOn.speed

  assert(
    stAcOn.isCompressorEngaged && stAcOn.compressorLoadTorqueNm > 0 && speedAcOn < speedAcOff && speedAcOff - speedAcOn < 4.0,
    `Carga parasita do compressor aplicada uma única vez no motor (v_off=${speedAcOff.toFixed(2)} km/h vs v_on=${speedAcOn.toFixed(2)} km/h, tau=${stAcOn.compressorLoadTorqueNm} Nm)`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SISTEMA DE VIDROS (WindowSystem)
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n=== FASE 4.2 — 3. SISTEMA DE VIDROS (WindowSystem) ===')

{
  // Veículo de 4 vidros elétricos (Golf GTI)
  const win4 = new WindowSystem(resolveVehicleCabin(golfGti))
  assert(win4.getWindowCount() === 4 && win4.getAvailableWindowIds().length === 4, 'Golf GTI possui 4 vidros controláveis')
  assert(!win4.isWindowsOpen() && win4.getAeroDragMultiplier() === 1.0, 'Vidros iniciam 100% fechados com multiplicador de arrasto = 1.0')

  // Limites mínimo e máximo + abertura individual
  win4.setWindowPosition('front_left', 1.5)
  assert(win4.getWindowPosition('front_left') === 1.0, 'Clamping superior de abertura individual = 1.0 (100%)')
  win4.setWindowPosition('front_left', -0.4)
  assert(win4.getWindowPosition('front_left') === 0.0, 'Clamping inferior de abertura individual = 0.0 (0%)')

  // Abertura gradual via setWindowTarget + tick(dt)
  win4.setWindowTarget('front_left', 1.0)
  win4.tick(0.5) // 0.5s * 0.72/s = 0.36
  const partialPos = win4.getWindowPosition('front_left')
  assert(
    partialPos > 0.30 && partialPos < 0.45 && win4.isWindowsOpen(),
    `Abertura gradual determinística do vidro dianteiro esquerdo (${Math.round(partialPos * 100)}%) ativa windowsOpen=true`,
  )
  win4.tick(2.0)
  assert(win4.getWindowPosition('front_left') === 1.0 && win4.getWindowPosition('front_right') === 0, 'Vidro individual atinge 100% sem abrir os demais')
  assert(Math.abs(win4.getAverageOpenRatio() - 0.25) < 1e-6, 'Média de abertura com 1 de 4 vidros aberto = 25%')

  // Abertura total e efeito no arrasto e ruído da cabine
  win4.setWindowsOpen(true)
  assert(
    win4.getAverageOpenRatio() === 1.0 &&
      Math.abs(win4.getAeroDragMultiplier() - (1 + WINDOW_CALIBRATION.MAX_AERO_DRAG_PENALTY)) < 1e-6 &&
      win4.getCabinFilterCutoffHz() === WINDOW_CALIBRATION.OPEN_CABIN_CUTOFF_HZ &&
      win4.getCabinNoiseLevel() === 1.0,
    `Todos os vidros abertos: arrasto=${win4.getAeroDragMultiplier().toFixed(4)}x, filtro=${win4.getCabinFilterCutoffHz()} Hz, ruído=${win4.getCabinNoiseLevel()}`,
  )

  // Veículo de 2 vidros (Gol Quadrado)
  const win2 = new WindowSystem(resolveVehicleCabin(golQuadrado))
  win2.setWindowPosition('rear_left', 1.0)
  assert(
    win2.getWindowCount() === 2 && win2.getWindowPosition('rear_left') === 0 && !win2.isWindowsOpen(),
    'Veículo de 2 portas ignora comandos para vidros traseiros inexistentes',
  )

  // Motocicleta sem vidros (CB1000R)
  const win0 = new WindowSystem(resolveVehicleCabin(cb1000r))
  win0.setWindowsOpen(true)
  win0.toggleAllWindows()
  assert(
    win0.getWindowCount() === 0 && !win0.isWindowsOpen() && win0.getAeroDragMultiplier() === 1.0,
    'CB1000R (motocicleta) não possui vidros e mantém aeroDragMultiplier = 1.0',
  )

  // Efeito real no arrasto aerodinâmico em alta velocidade na store (ponto único em VehiclePhysics)
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(golfGti)
  sim.startEngine()
  stepStoreSeconds(0.6)
  sim.selectDrive()
  sim.setSpeed(160)
  sim.setThrottle(0.8)
  stepStoreSeconds(2.0)
  const speedClosed = useSimulationStore.getState().speed

  sim.reset()
  sim.init(golfGti)
  sim.startEngine()
  stepStoreSeconds(0.6)
  sim.setWindowsOpen(true)
  sim.selectDrive()
  sim.setSpeed(160)
  sim.setThrottle(0.8)
  stepStoreSeconds(2.0)
  const speedOpen = useSimulationStore.getState().speed

  assert(
    speedOpen < speedClosed && speedClosed - speedOpen < 3.5,
    `Vidros abertos aumentam arrasto aerodinâmico a 160 km/h sem duplicação (v_fechado=${speedClosed.toFixed(2)} vs v_aberto=${speedOpen.toFixed(2)} km/h)`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SISTEMA DE IGNIÇÃO (IgnitionSystem)
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n=== FASE 4.2 — 4. SISTEMA DE IGNIÇÃO (IgnitionSystem) ===')

{
  // 4.1 Partida por chave sem intertravamento (Gol G6: OFF -> ACC -> ON -> CRANK -> ON)
  const keyIgn = new IgnitionSystem(resolveVehicleIgnition(golG6))
  assert(keyIgn.getPosition() === 'OFF' && keyIgn.getType() === 'key', 'Gol G6 inicia com chave em OFF')

  let res = keyIgn.advanceStage({ brake: 0, clutch: 0, engineStatus: 'off' })
  assert(res.position === 'ACC' && !res.shouldStartEngine, '1º giro da chave avança OFF -> ACC')

  res = keyIgn.advanceStage({ brake: 0, clutch: 0, engineStatus: 'off' })
  assert(res.position === 'ON' && !res.shouldStartEngine, '2º giro da chave avança ACC -> ON')

  res = keyIgn.advanceStage({ brake: 0, clutch: 0, engineStatus: 'off' })
  assert(res.position === 'CRANK' && res.shouldStartEngine, '3º giro da chave avança ON -> CRANK e comanda arranque')

  // Retorno automático de CRANK para ON quando o motor pega
  const afterRun = keyIgn.tick({ deltaTime: 1 / 120, engineStatus: 'running', engineRpm: 850 })
  assert(afterRun.position === 'ON' && afterRun.batteryVoltageV > 12.6, 'Chave retorna automaticamente de CRANK para ON quando o motor entra em RUNNING')

  // 4.2 Partida por chave COM intertravamento de embreagem (Civic Si: startInterlock = 'clutch')
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(civicSi)
  sim.setClutch(0) // Embreagem solta
  const startedWithoutClutch = sim.requestEngineStart(true)
  assert(
    !startedWithoutClutch &&
      useSimulationStore.getState().status === 'off' &&
      useSimulationStore.getState().ignitionPosition === 'ON' &&
      useSimulationStore.getState().ignitionFailedAttempts === 1 &&
      Boolean(useSimulationStore.getState().ignitionFailureReason?.includes('embreagem')),
    'Civic Si bloqueia partida sem pisar na embreagem e registra tentativa falha',
  )

  sim.setClutch(1.0) // Embreagem pressionada
  const startedWithClutch = sim.requestEngineStart(true)
  assert(
    startedWithClutch &&
      useSimulationStore.getState().status === 'starting' &&
      useSimulationStore.getState().ignitionPosition === 'CRANK',
    'Civic Si entra em CRANK e aciona arranque com embreagem pressionada',
  )
  stepStoreSeconds(0.55)
  assert(
    useSimulationStore.getState().isRunning && useSimulationStore.getState().ignitionPosition === 'ON',
    'Civic Si conclui partida (0.45s cranking) e retorna ignição de CRANK para ON',
  )

  // 4.3 Partida por botão COM intertravamento de freio (Porsche 911 / Golf GTI: startInterlock = 'brake')
  sim.reset()
  sim.init(porsche)
  sim.setBrake(0)
  const btnNoBrake1 = sim.advanceIgnition(true)
  assert(
    !btnNoBrake1 &&
      !useSimulationStore.getState().isRunning &&
      useSimulationStore.getState().ignitionPosition === 'ACC' &&
      Boolean(useSimulationStore.getState().ignitionFailureReason?.includes('freio')),
    'Botão Start/Stop sem pisar no freio entra em ACC e bloqueia motor de arranque',
  )
  const btnNoBrake2 = sim.advanceIgnition(true)
  assert(
    !btnNoBrake2 &&
      !useSimulationStore.getState().isRunning &&
      useSimulationStore.getState().ignitionPosition === 'ON',
    '2º toque no botão Start/Stop sem freio avança ACC -> ON sem girar arranque',
  )

  sim.setBrake(0.5)
  const btnWithBrake = sim.advanceIgnition(true)
  assert(
    btnWithBrake &&
      useSimulationStore.getState().status === 'starting' &&
      useSimulationStore.getState().ignitionPosition === 'CRANK',
    'Botão Start/Stop com freio pressionado aciona CRANK imediatamente',
  )
  stepStoreSeconds(0.55)
  assert(
    useSimulationStore.getState().isRunning && useSimulationStore.getState().ignitionPosition === 'ON',
    'Porsche 911 conclui partida por botão e estabiliza em ON',
  )

  // Desligamento pelo botão Start/Stop e reinicialização
  sim.advanceIgnition(true)
  assert(
    !useSimulationStore.getState().isRunning &&
      useSimulationStore.getState().status === 'off' &&
      useSimulationStore.getState().ignitionPosition === 'OFF',
    'Pressionar botão Start/Stop com motor ligado desliga o motor e retorna ignição para OFF',
  )

  // 4.4 Falha de partida por bateria descarregada
  sim.setBatteryDischarged(true)
  sim.setBrake(0.8)
  const startedDeadBattery = sim.requestEngineStart(true)
  assert(
    !startedDeadBattery &&
      !useSimulationStore.getState().isRunning &&
      Boolean(useSimulationStore.getState().ignitionFailureReason?.includes('bateria')),
    'Bateria descarregada (< 9.6V) impede partida e informa motivo da falha',
  )
  sim.setBatteryDischarged(false)
  const restartedOk = sim.requestEngineStart(true)
  stepStoreSeconds(0.55)
  assert(restartedOk && useSimulationStore.getState().isRunning, 'Após restabelecer bateria, veículo dá partida normalmente')
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SISTEMA DE ILUMINAÇÃO E SINALIZAÇÃO (LightingSystem)
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n=== FASE 4.2 — 5. SISTEMA DE ILUMINAÇÃO E SINALIZAÇÃO (LightingSystem) ===')

{
  const lightWithFog = new LightingSystem(resolveVehicleCabin(golfGti))
  const lightNoFog = new LightingSystem(resolveVehicleCabin(toroEndurance))

  // Exclusão mútua das setas e início imediato na fase acesa
  lightWithFog.toggleLeftTurnSignal()
  let snap = lightWithFog.getStateSnapshot()
  assert(
    snap.leftTurnSignal && !snap.rightTurnSignal && snap.leftIndicatorLit && !snap.rightIndicatorLit,
    'Seta esquerda acende imediatamente no início do ciclo e mantém direita apagada',
  )

  lightWithFog.toggleRightTurnSignal()
  snap = lightWithFog.getStateSnapshot()
  assert(
    !snap.leftTurnSignal && snap.rightTurnSignal && !snap.leftIndicatorLit && snap.rightIndicatorLit,
    'Acionar seta direita cancela seta esquerda automaticamente e sincroniza estado visual',
  )

  // Frequência determinística de 1,4 Hz (T = 1/1.4 ≈ 0.7142857s; meio período ≈ 0.35714285s)
  const halfPeriod = LIGHTING_CALIBRATION.BLINK_HALF_PERIOD_SEC
  // Avança até 0.30s (< meio período): ainda deve estar ACESA
  lightWithFog.tick(0.30)
  assert(lightWithFog.getStateSnapshot().rightIndicatorLit === true, 'Em t = 0.30s (< T/2 = 0.357s) a seta permanece ACESA')

  // Avança mais 0.10s (t = 0.40s, entre T/2 e T): deve estar APAGADA
  lightWithFog.tick(0.10)
  assert(
    lightWithFog.getStateSnapshot().rightTurnSignal === true &&
      lightWithFog.getStateSnapshot().rightIndicatorLit === false,
    'Em t = 0.40s (segundo meio-ciclo de 1,4 Hz) a seta funcional continua ativa mas a lâmpada apaga',
  )

  // Avança mais 0.35s (t = 0.75s > T = 0.714s): inicia novo ciclo ACESA
  lightWithFog.tick(0.35)
  assert(
    lightWithFog.getStateSnapshot().rightIndicatorLit === true && Math.abs(halfPeriod * 2 - 1 / 1.4) < 1e-9,
    `Ciclo completo de 1,4 Hz (T = ${(halfPeriod * 2).toFixed(4)}s) reinicia fase acesa com precisão determinística`,
  )

  // Pisca-alerta sincronizando ambos os lados
  lightWithFog.toggleHazardLights()
  snap = lightWithFog.getStateSnapshot()
  assert(
    snap.hazardLights && snap.leftIndicatorLit && snap.rightIndicatorLit && snap.hazardIndicatorLit,
    'Pisca-alerta acende indicadores esquerdo, direito e alerta em sincronismo',
  )
  lightWithFog.tick(0.40)
  snap = lightWithFog.getStateSnapshot()
  assert(
    snap.hazardLights && !snap.leftIndicatorLit && !snap.rightIndicatorLit && !snap.hazardIndicatorLit,
    'Pisca-alerta apaga ambos os lados simultaneamente no segundo meio-ciclo',
  )

  // Faróis de neblina disponíveis vs indisponíveis
  assert(
    lightWithFog.toggleFogLights() === true && lightWithFog.getStateSnapshot().fogLightsLit === true,
    'Golf GTI (hasFogLights=true) permite ligar faróis de neblina',
  )
  assert(
    lightNoFog.toggleFogLights() === false && lightNoFog.getStateSnapshot().fogLightsLit === false,
    'Fiat Toro Endurance (hasFogLights=false) bloqueia ativação de faróis de neblina inexistentes',
  )
}

console.log(`\n══════════════════════════════════════════════════`)
console.log(`RESULTADO FASE 4.2: ${passed} passaram | ${failed} falharam`)
console.log(`══════════════════════════════════════════════════\n`)

if (failed > 0) {
  process.exit(1)
}
