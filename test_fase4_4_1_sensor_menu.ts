/**
 * HEATZ AUTO — FASE 4.4.1: Suíte Completa do Sensor de Inclinação Mobile, Menu Hambúrguer e Ignição no HUD
 *
 * Valida determinísticamente todos os requisitos obrigatórios das Partes A, B, C, D, E, F e G:
 * 1. Inclinação à direita -> esterço positivo (direita) em Paisagem (90°, 270°, |beta|>90°), Retrato (0°, 180°, |beta|>90°),
 *    tablet paisagem nativa (0°) e iOS Safari WebKit (compensação Bug #254863 window.orientation vs screen.orientation).
 * 2. Inclinação à esquerda -> esterço negativo (esquerda) consistente em todas as orientações.
 * 3. Opção "Inverter direção" aplicada apenas ao sinal final (sem alterar rawAngleDeg, calibratedAngleDeg ou neutralAngleDeg).
 * 4. Três níveis discretos de sensibilidade (Baixa / Média / Alta) com progressividade monotônica e padrão inicial Média.
 * 5. Zona morta (deadzone) com transição contínua C0 sem degrau.
 * 6. Suavização exponencial de camada única independente de FPS e da taxa de eventos.
 * 7. Calibração central repetível, resetável, protegida contra ausência de dados e sem alterar física/posição/motor.
 * 8. Persistência validada em localStorage (inversão, sensibilidade, deadzone, calibração) sobrevivendo a reload e troca de veículo.
 * 9. Tratamento de NaN/Infinity/null, permissão iOS vs Android, rotação retrato ↔ paisagem, pausa/retomada,
 *    ocultação do indicador visual sem desligar o sensor e unicidade estrita de 1 listener global.
 * 10. Reorganização do Menu Hambúrguer, integração funcional do Escape no Painel 3, remoção de ignição do Painel 3
 *     e funcionamento de Start/Stop vs Chave Física (OFF/ACC/ON + segurar CRANK -> soltar ON) nos 15 veículos.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { VehicleConfig } from './src/types/vehicle'
import {
  TiltSteeringController,
  sharedTiltSteering,
  resolveEffectiveScreenAngleDeg,
  requiresDeviceOrientationPermissionPrompt,
  TILT_PREFERENCES_STORAGE_KEY,
  TILT_SENSITIVITY_PRESETS,
  loadTiltPreferences,
  type TiltSample,
} from './src/systems/input'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useUIStore } from './src/stores/useUIStore'
import { resolveVehicleIgnition } from './src/systems/vehicle/vehicleResolvers'
import { getAvailableCockpitPanels } from './src/components/cockpit/cockpitPanels'

let passed = 0
let failed = 0

function assert(cond: boolean, label: string, detail = '') {
  if (cond) {
    passed++
    console.log(`  ✅ ${label}`)
  } else {
    failed++
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function assertClose(actual: number, expected: number, tol: number, label: string) {
  const diff = Math.abs(actual - expected)
  assert(
    diff <= tol,
    label,
    `obtido=${actual.toFixed(6)}, esperado=${expected.toFixed(6)}, diff=${diff.toExponential(2)}`,
  )
}

// Mock controlado de localStorage em Node para validar persistência, reload e corrupção
class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length(): number {
    return this.map.size
  }
  clear(): void {
    this.map.clear()
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value))
  }
}

const memoryStorage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage,
  configurable: true,
  writable: true,
})

const REPO = process.cwd()
const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'public', 'vehicles', 'manifest.json'), 'utf8'))

function loadVehicle(id: string): VehicleConfig {
  const entry = manifest.vehicles.find((v: { id: string; configPath: string }) => v.id === id)
  if (!entry) throw new Error(`Veículo ${id} não encontrado no manifest.json`)
  return JSON.parse(fs.readFileSync(path.join(REPO, 'public', entry.configPath.replace(/^\//, '')), 'utf8'))
}

console.log('\n══════════════════════════════════════════════════════════════════════════')
console.log('  HEATZ AUTO — FASE 4.4.1: SENSOR MOBILE, MENU HAMBÚRGUER & IGNIÇÃO HUD')
console.log('══════════════════════════════════════════════════════════════════════════\n')

// ─── 1. SENTIDO FÍSICO DA DIREÇÃO EM TODAS AS ORIENTAÇÕES + WEBKIT BUG #254863 ───
console.log('=== 1. Sentido físico (Direita > 0, Esquerda < 0) e Orientação iOS/Android ===')
{
  const ctrl = new TiltSteeringController({
    enabled: true,
    deadzoneDeg: 0,
    smoothingFactor: 1.0,
    sensitivity: 1.0,
    invertAxis: false,
  })

  // Paisagem 90° (topo à esquerda): inclinar à direita -> beta > 0 -> esterço > 0
  const rightLand90 = ctrl.computeSteering({ beta: 16, gamma: 35, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  const leftLand90 = ctrl.computeSteering({ beta: -16, gamma: 35, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  assert(rightLand90 > 0, 'Paisagem 90°: inclinar à direita gera esterço positivo (virar à direita)')
  assert(leftLand90 < 0, 'Paisagem 90°: inclinar à esquerda gera esterço negativo (virar à esquerda)')

  // Paisagem 270° / -90° (topo à direita): inclinar à direita -> beta < 0 -> esterço > 0
  const rightLand270 = ctrl.computeSteering({ beta: -16, gamma: -35, isLandscape: true, orientationAngle: 270 }, 1 / 60)
  const leftLand270 = ctrl.computeSteering({ beta: 16, gamma: -35, isLandscape: true, orientationAngle: 270 }, 1 / 60)
  assert(rightLand270 > 0, 'Paisagem 270°: inclinar à direita gera esterço positivo')
  assert(leftLand270 < 0, 'Paisagem 270°: inclinar à esquerda gera esterço negativo')

  // Paisagem além da vertical (|beta| > 90°, ex.: beta = +164° corresponde a +16° de rolagem física)
  const rightLandPast90 = ctrl.computeSteering({ beta: 164, gamma: -80, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  assertClose(rightLandPast90, rightLand90, 1e-4, 'Paisagem |beta| > 90°: sem salto nem saturação ao passar da vertical')

  // Retrato 0° normal (beta=55°) e simétrico reclinado além da vertical (beta=125° = 180°-55°, onde W3C inverte sinal de gamma!)
  const rightPortNormal = ctrl.computeSteering({ beta: 55, gamma: 15, isLandscape: false, orientationAngle: 0 }, 1 / 60)
  const rightPortPastVertical = ctrl.computeSteering({ beta: 125, gamma: -15, isLandscape: false, orientationAngle: 0 }, 1 / 60)
  const leftPortPastVertical = ctrl.computeSteering({ beta: 125, gamma: 15, isLandscape: false, orientationAngle: 0 }, 1 / 60)
  assert(rightPortNormal > 0, 'Retrato 0° (beta=55°): inclinar à direita gera esterço positivo')
  assertClose(
    rightPortPastVertical,
    rightPortNormal,
    1e-4,
    'Retrato 0° com aparelho vertical/reclinado (beta=125°): projeção 3D compensa inversão Euler de gamma sem virar para o lado errado',
  )
  assert(leftPortPastVertical < 0, 'Retrato 0° com beta=125°: inclinar à esquerda mantém esterço negativo')

  // Tablet Android com orientação paisagem nativa (orientationAngle = 0, isLandscape = true): eixo horizontal é X -> gamma
  const rightNativeTablet = ctrl.computeSteering({ beta: 0, gamma: 15, isLandscape: true, orientationAngle: 0 }, 1 / 60)
  assertClose(rightNativeTablet, 0.5, 1e-3, 'Tablet paisagem nativa (0°): lê eixo gamma real em vez de pitch beta')

  // iOS Safari 16.4+ WebKit Bug #254863: screen.orientation.angle reporta 90 quando window.orientation é -90 (topo à direita)
  const iosRightAngle = resolveEffectiveScreenAngleDeg({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
    platform: 'iPhone',
    maxTouchPoints: 5,
    screenOrientationAngle: 90, // Valor trocado pelo bug do WebKit
    windowOrientation: -90, // Valor físico real (topo na mão direita)
  })
  assert(iosRightAngle === 270, 'iOS Safari WebKit: prioriza window.orientation (-90 -> 270°), eliminando inversão em paisagem')
  const iosRightSteer = ctrl.computeSteering({ beta: -15, gamma: -40, isLandscape: true, orientationAngle: iosRightAngle }, 1 / 60)
  assert(iosRightSteer > 0, 'iOS Safari em paisagem: inclinar iPhone à direita vira o carro para a direita (+)')

  const androidAngle = resolveEffectiveScreenAngleDeg({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0',
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
    screenOrientationAngle: 90,
    windowOrientation: 90,
  })
  assert(androidAngle === 90, 'Android Chrome: utiliza screen.orientation.angle (90°) consistentemente')
}

// ─── 2. OPÇÃO INVERTER DIREÇÃO (SINAL FINAL SEM AFETAR EIXO/CALIBRAÇÃO) ───
console.log('\n=== 2. Opção Inverter Direção ===')
{
  const ctrl = new TiltSteeringController({
    enabled: true,
    deadzoneDeg: 0,
    smoothingFactor: 1.0,
    sensitivity: 1.0,
    invertAxis: false,
  })

  ctrl.calibrate({ beta: 10, gamma: 30, isLandscape: true, orientationAngle: 90 })
  const normalRight = ctrl.computeSteering({ beta: 22, gamma: 30, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  const stateNormal = ctrl.getState()

  ctrl.updateConfig({ invertAxis: true })
  const invertedRight = ctrl.computeSteering({ beta: 22, gamma: 30, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  const stateInverted = ctrl.getState()

  assert(normalRight > 0 && invertedRight < 0, 'Inverter direção inverte o sinal final (+ vira -)')
  assertClose(invertedRight, -normalRight, 1e-6, 'Magnitude do esterço invertido é simétrica à normal')
  assertClose(stateInverted.rawAngleDeg, stateNormal.rawAngleDeg, 1e-6, 'invertAxis NÃO altera rawAngleDeg físico')
  assertClose(stateInverted.neutralAngleDeg, 10, 1e-6, 'invertAxis NÃO corrompe neutralAngleDeg calibrado')
  assertClose(stateInverted.calibratedAngleDeg, 12, 1e-6, 'invertAxis NÃO altera calibratedAngleDeg físico')
}

// ─── 3. SENSIBILIDADE EM 3 NÍVEIS (BAIXA, MÉDIA, ALTA) & ZONA MORTA ───
console.log('\n=== 3. Sensibilidade (Baixa / Média / Alta) e Zona Morta ===')
{
  memoryStorage.clear()
  useSimulationStore.getState().reloadTiltPreferencesFromStorage()
  assert(
    useSimulationStore.getState().steeringSensitivityPreset === 'medium',
    'Sensibilidade padrão inicial é Média (medium)',
  )

  const sample18Deg: TiltSample = { beta: 18, gamma: 30, isLandscape: true, orientationAngle: 90 }
  const evalAtPreset = (preset: 'low' | 'medium' | 'high') => {
    const c = new TiltSteeringController({
      enabled: true,
      deadzoneDeg: 3.0,
      smoothingFactor: 1.0,
      responseExponent: 1.18,
      sensitivity: TILT_SENSITIVITY_PRESETS[preset].sensitivity,
    })
    return c.computeSteering(sample18Deg, 1 / 60)
  }

  const sLow = evalAtPreset('low')
  const sMed = evalAtPreset('medium')
  const sHigh = evalAtPreset('high')

  assert(
    sLow > 0 && sLow < sMed && sMed < sHigh && sHigh <= 1.0,
    `Progressão estrita Baixa (${sLow.toFixed(3)}) < Média (${sMed.toFixed(3)}) < Alta (${sHigh.toFixed(3)})`,
  )

  // Zona morta contínua sem degrau
  const dzCtrl = new TiltSteeringController({
    enabled: true,
    deadzoneDeg: 3.0,
    smoothingFactor: 1.0,
    responseExponent: 1.18,
    sensitivity: TILT_SENSITIVITY_PRESETS.medium.sensitivity,
  })
  assert(
    dzCtrl.computeSteering({ beta: 2.95, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60) === 0,
    'Dentro da deadzone (2.95° <= 3.0°) esterço é exatamente 0.0',
  )
  const justOutside = dzCtrl.computeSteering({ beta: 3.1, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  assert(
    justOutside > 0 && justOutside < 0.01,
    `Saída da deadzone (3.1°) inicia suavemente sem degrau (${justOutside.toFixed(5)})`,
  )
}

// ─── 4. SUAVIZAÇÃO EXPONENCIAL DE CAMADA ÚNICA INDEPENDENTE DE FPS / TAXA DE EVENTOS ───
console.log('\n=== 4. Filtro Passa-Baixa Independente de FPS e Atenuação de Tremor ===')
{
  const makeCtrl = () =>
    new TiltSteeringController({
      enabled: true,
      deadzoneDeg: 0,
      smoothingFactor: 0.075,
      responseExponent: 1.0,
      sensitivity: 1.0,
    })

  const c30 = makeCtrl()
  const c60 = makeCtrl()
  const c120 = makeCtrl()
  const cIrregular = makeCtrl()

  const stepSample: TiltSample = { beta: 20, gamma: 0, isLandscape: true, orientationAngle: 90 }
  // Integra exatamente 0.20s em diferentes taxas de eventos/quadros
  for (let i = 0; i < 6; i++) c30.computeSteering(stepSample, 1 / 30)
  for (let i = 0; i < 12; i++) c60.computeSteering(stepSample, 1 / 60)
  for (let i = 0; i < 24; i++) c120.computeSteering(stepSample, 1 / 120)
  for (const dt of [0.011, 0.029, 0.008, 0.042, 0.019, 0.031, 0.025, 0.035]) {
    cIrregular.computeSteering(stepSample, dt) // soma = 0.200s
  }

  assertClose(c30.getSteeringAngle(), c60.getSteeringAngle(), 1e-6, 'Suavização 30 Hz === 60 Hz para mesmo tempo físico')
  assertClose(c60.getSteeringAngle(), c120.getSteeringAngle(), 1e-6, 'Suavização 60 Hz === 120 Hz para mesmo tempo físico')
  assertClose(
    c60.getSteeringAngle(),
    cIrregular.getSteeringAngle(),
    1e-6,
    'Suavização com intervalos irregulares de eventos === 60 Hz exato',
  )

  // Verifica que tremor rápido de mão (±1.5° a 60 Hz em torno de 10°) é fortemente atenuado
  const tremorCtrl = makeCtrl()
  for (let i = 0; i < 60; i++) {
    tremorCtrl.computeSteering({ beta: 10, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  }
  const baseSteer = tremorCtrl.getSteeringAngle()
  const spikeSteer = tremorCtrl.computeSteering({ beta: 11.5, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  const rawJump = 1.5 / 30
  assert(
    Math.abs(spikeSteer - baseSteer) < rawJump * 0.25,
    'Filtro atenua mais de 75% de um pico isolado de tremor de mão em 1 frame',
  )
}

// ─── 5. CALIBRAÇÃO CENTRAL, PERSISTÊNCIA LOCALSTORAGE, TROCA DE VEÍCULO E CORRUPÇÃO ───
console.log('\n=== 5. Calibração Central, Persistência e Isolamento da Física ===')
{
  memoryStorage.clear()
  const jetta = loadVehicle('jetta-gli-2021')
  const bmw = loadVehicle('bmw-320i-msport-2024')

  const sim = useSimulationStore.getState()
  sim.init(jetta)
  sim.setBrake(0.8)
  sim.pressPushButtonIgnition(true)
  for (let i = 0; i < 65; i++) sim.update(1 / 120)

  const posBefore = {
    x: useSimulationStore.getState().positionX,
    y: useSimulationStore.getState().positionY,
    heading: useSimulationStore.getState().headingDeg,
    running: useSimulationStore.getState().isRunning,
  }

  // Configura preferências do usuário e calibra em +13.5°
  useSimulationStore.getState().setSteeringSensitivityPreset('low')
  useSimulationStore.getState().setSteeringInvertDirection(true)
  useSimulationStore.getState().setSteeringDeadzone(4)
  sharedTiltSteering.processSample({ beta: 13.5, gamma: 40, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  const calibratedAt = sharedTiltSteering.calibrateNeutral()

  assertClose(calibratedAt, 13.5, 1e-3, 'Calibração captura posição atual de +13.5° como neutro')
  assertClose(useSimulationStore.getState().steeringAngle, 0, 1e-5, 'Após calibrar, direção vai imediatamente a 0.0')

  const posAfter = useSimulationStore.getState()
  assert(
    posAfter.positionX === posBefore.x &&
      posAfter.positionY === posBefore.y &&
      posAfter.headingDeg === posBefore.heading &&
      posAfter.isRunning === posBefore.running,
    'Calibrar o sensor NÃO altera posição do veículo, heading nem estado do motor',
  )

  // Verifica conteúdo salvo em localStorage (sem dados brutos transitórios!)
  const rawJson = memoryStorage.getItem(TILT_PREFERENCES_STORAGE_KEY) ?? ''
  const parsedJson = JSON.parse(rawJson)
  assert(
    parsedJson.sensitivityPreset === 'low' &&
      parsedJson.invertDirection === true &&
      parsedJson.deadzoneDeg === 4 &&
      parsedJson.isCalibrated === true &&
      Math.abs(parsedJson.neutralAngleDeg - 13.5) < 1e-3,
    'Preferências (sensibilidade, inversão, deadzone e calibração) persistidas em localStorage',
  )
  assert(
    !('rawAngleDeg' in parsedJson) && !('beta' in parsedJson) && !('gamma' in parsedJson),
    'localStorage NÃO persiste leituras brutas transitórias do acelerômetro/giroscópio',
  )

  // Troca de veículo (Jetta -> BMW) deve preservar permissão, preferências e calibração
  useSimulationStore.getState().setSensorPermission('granted')
  useSimulationStore.getState().init(bmw)
  const afterSwitch = useSimulationStore.getState()
  assert(
    afterSwitch.steeringSensitivityPreset === 'low' &&
      afterSwitch.steeringInvertDirection === true &&
      afterSwitch.steeringDeadzone === 4 &&
      afterSwitch.sensorPermission === 'granted' &&
      sharedTiltSteering.getSnapshot().isCalibrated === true,
    'Troca de veículo (init) preserva sensibilidade, inversão, deadzone, calibração e permissão concedida',
  )

  // Reset de calibração
  sharedTiltSteering.resetCalibration()
  assert(
    sharedTiltSteering.getSnapshot().isCalibrated === false &&
      loadTiltPreferences().isCalibrated === false &&
      loadTiltPreferences().neutralAngleDeg === 0,
    'Reset de calibração restaura neutro 0° em memória e no localStorage',
  )

  // Proteção contra JSON corrompido ou valores inválidos no localStorage
  memoryStorage.setItem(TILT_PREFERENCES_STORAGE_KEY, '{corrupted_json')
  const safeFromCorrupt = loadTiltPreferences()
  assert(
    safeFromCorrupt.sensitivityPreset === 'medium' &&
      safeFromCorrupt.invertDirection === false &&
      safeFromCorrupt.deadzoneDeg === 3.0 &&
      safeFromCorrupt.isCalibrated === false,
    'JSON corrompido em localStorage cai para defaults seguros sem quebrar',
  )

  memoryStorage.setItem(
    TILT_PREFERENCES_STORAGE_KEY,
    JSON.stringify({ sensitivityPreset: 'invalid', invertDirection: 'yes', deadzoneDeg: 999, neutralAngleDeg: 500, isCalibrated: true }),
  )
  const safeFromOutOfRange = loadTiltPreferences()
  assert(
    safeFromOutOfRange.sensitivityPreset === 'medium' &&
      safeFromOutOfRange.invertDirection === false &&
      safeFromOutOfRange.deadzoneDeg === 12 &&
      safeFromOutOfRange.isCalibrated === false,
    'Valores fora de faixa / tipos incorretos em localStorage são higienizados com segurança',
  )

  memoryStorage.clear()
  useSimulationStore.getState().reloadTiltPreferencesFromStorage()
  sharedTiltSteering.reloadPersistedPreferences()
}

// ─── 6. CICLO DE VIDA, PERMISSÃO IOS/ANDROID, ROTAÇÃO, PAUSA E LISTENER ÚNICO ───
console.log('\n=== 6. Ciclo de Vida, Listener Único, Ocultação do HUD e Pausa ===')
{
  // Calibração sem amostra prévia não deve forjar calibração
  const freshCtrl = new TiltSteeringController({ enabled: true })
  freshCtrl.calibrate()
  assert(!freshCtrl.isCalibratedState(), 'Calibrar antes de qualquer leitura válida NÃO marca isCalibrated=true')
  freshCtrl.calibrate({ beta: Number.NaN, gamma: Number.POSITIVE_INFINITY, isLandscape: true })
  assert(!freshCtrl.isCalibratedState(), 'Calibrar com NaN/Infinity é rejeitado com segurança')

  // Simula window com addEventListener/removeEventListener para verificar listener único e permissão iOS vs Android
  let addCount = 0
  let removeCount = 0
  const listeners = new Set<EventListenerOrEventListenerObject>()

  const fakeWindow: Record<string, unknown> = {
    innerWidth: 844,
    innerHeight: 390,
    screen: { orientation: { angle: 90 } },
    DeviceOrientationEvent: function FakeDOE() {},
    addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
      if (type === 'deviceorientation') {
        addCount++
        listeners.add(fn)
      }
    },
    removeEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
      if (type === 'deviceorientation') {
        removeCount++
        listeners.delete(fn)
      }
    },
  }

  Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true, writable: true })

  assert(
    requiresDeviceOrientationPermissionPrompt() === false,
    'Android/Chromium (sem DeviceOrientationEvent.requestPermission): NÃO exibe prompt exclusivo do iOS',
  )

  ;(fakeWindow.DeviceOrientationEvent as unknown as { requestPermission: () => Promise<'granted'> }).requestPermission =
    async () => 'granted'
  assert(
    requiresDeviceOrientationPermissionPrompt({
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
    }) === false,
    'Android Chrome moderno (mesmo quando Chromium expõe DeviceOrientationEvent.requestPermission): NÃO exibe prompt iOS',
  )
  assert(
    requiresDeviceOrientationPermissionPrompt({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone',
      maxTouchPoints: 5,
    }) === true,
    'iOS Safari/WebKit (com DeviceOrientationEvent.requestPermission): detecta necessidade de gesto do usuário',
  )

  // Múltiplos assinantes simultâneos (ex.: HUD + Menu Hambúrguer aberto) -> apenas 1 listener global!
  const unsub1 = sharedTiltSteering.subscribe(() => {})
  const unsub2 = sharedTiltSteering.subscribe(() => {})
  const unsub3 = sharedTiltSteering.subscribe(() => {})
  assert(
    addCount === 1 && listeners.size === 1 && sharedTiltSteering.getSubscriberCount() === 3,
    'Múltiplos componentes montados registram estritamente 1 único listener global de deviceorientation',
  )

  unsub1()
  unsub2()
  assert(listeners.size === 1, 'Desmontar menu mantém listener ativo enquanto HUD continuar inscrito')
  unsub3()
  assert(
    removeCount === 1 && listeners.size === 0 && !sharedTiltSteering.isAttached(),
    'Desmontar todos os consumidores remove o listener global sem vazamento',
  )

  // Ocultar indicador visual no HUD (showTiltIndicator = false) NÃO desativa leitura do sensor
  useUIStore.getState().setShowTiltIndicator(false)
  useSimulationStore.getState().setSteeringMethod('tilt')
  useSimulationStore.getState().setSteeringInvertDirection(false)
  sharedTiltSteering.processSample({ beta: 20, gamma: 0, isLandscape: true, orientationAngle: 90 }, 0.1, true)
  assert(
    useUIStore.getState().showTiltIndicator === false && useSimulationStore.getState().steeringAngle > 0,
    'Ocultar indicador visual de inclinação no HUD NÃO desativa o controle de direção pelo sensor',
  )
  useUIStore.getState().setShowTiltIndicator(true)

  // Pausa e retomada da simulação
  useSimulationStore.getState().setSteeringAngle(0, 'tilt')
  useSimulationStore.getState().pauseSimulation()
  sharedTiltSteering.processSample({ beta: 25, gamma: 0, isLandscape: true, orientationAngle: 90 }, 0.1, true)
  assertClose(
    useSimulationStore.getState().steeringAngle,
    0,
    1e-6,
    'Com simulação pausada, eventos do sensor não alteram steeringAngle físico',
  )
  useSimulationStore.getState().resumeSimulation()
  sharedTiltSteering.processSample({ beta: 25, gamma: 0, isLandscape: true, orientationAngle: 90 }, 0.1, true)
  assert(
    useSimulationStore.getState().steeringAngle > 0,
    'Ao retomar simulação (resumeSimulation), o sensor volta a comandar steeringAngle imediatamente',
  )

  // Rotação retrato <-> paisagem limpa estado transitório sem NaN
  sharedTiltSteering.processSample({ beta: 45, gamma: -18, isLandscape: false, orientationAngle: 0 }, 0.1, true)
  assert(
    useSimulationStore.getState().steeringAngle < 0 && Number.isFinite(useSimulationStore.getState().steeringAngle),
    'Transição dinâmica Paisagem -> Retrato atualiza eixo sem salto inválido nem NaN',
  )

  // Remove mock de window para restaurar ambiente Node puro
  // @ts-expect-error limpeza intencional do mock global em ambiente Node
  delete globalThis.window
}

// ─── 7. REORGANIZAÇÃO DO MENU HAMBÚRGUER & ESCAPE NO PAINEL 3 ───
console.log('\n=== 7. Menu Hambúrguer Limpo, Escape no Painel 3 e Ignição Fora do Painel 3 ===')
{
  const menuSrc = fs.readFileSync(path.join(REPO, 'src', 'components', 'dashboard', 'MobileQuickMenu.tsx'), 'utf8')
  const cabinSrc = fs.readFileSync(path.join(REPO, 'src', 'components', 'dashboard', 'CabinControlsBar.tsx'), 'utf8')
  const zoneSrc = fs.readFileSync(path.join(REPO, 'src', 'components', 'controls', 'SteeringControlZone.tsx'), 'utf8')

  // Itens obrigatoriamente removidos do MobileQuickMenu
  assert(!menuSrc.includes('setDrivingMode'), 'Menu Hambúrguer NÃO contém seletor duplicado de modos de condução')
  assert(!menuSrc.includes('setTcsEnabled'), 'Menu Hambúrguer NÃO contém tile duplicado de TCS')
  assert(!menuSrc.includes('setActiveCockpitPanel'), 'Menu Hambúrguer NÃO contém atalho redundante Cabine / PAINEL 3')
  assert(!menuSrc.includes('toggleExhaustValve'), 'Menu Hambúrguer NÃO contém tile de Escape (movido para Painel 3)')

  // Itens obrigatoriamente presentes/removidos no MobileQuickMenu (evoluído na Fase 4.4.3 Etapa 2: Faróis e 402M removidos do menu rápido)
  assert(
    !menuSrc.includes('menu-tile-headlights') &&
      !menuSrc.includes('menu-tile-drag') &&
      menuSrc.includes('menu-tile-rain') &&
      menuSrc.includes('menu-tile-sound') &&
      menuSrc.includes('menu-tile-tuning') &&
      menuSrc.includes('menu-tile-dyno') &&
      menuSrc.includes('menu-tile-fullscreen') &&
      menuSrc.includes('menu-tile-graphics') &&
      menuSrc.includes('menu-tile-diagnostics') &&
      menuSrc.includes('btn-exit-garage'),
    'Menu Hambúrguer remove Faróis/402M (Fase 4.4.3) e preserva Clima, Som, Oficina, Dyno, Tela Cheia, Gráficos, Diagnóstico e Sair',
  )
  assert(
    menuSrc.includes('btn-tilt-invert-normal') &&
      menuSrc.includes('btn-tilt-invert-inverted') &&
      menuSrc.includes('btn-tilt-sens-${presetId}') &&
      menuSrc.includes("['low', 'medium', 'high']") &&
      menuSrc.includes('requiresPermissionPrompt'),
    'Menu Hambúrguer expõe Inversão de Direção, Sensibilidade (Baixa/Média/Alta) e guarda de permissão exclusiva iOS',
  )

  // SteeringControlZone chama useDeviceTilt() ANTES do if (!showTiltIndicator) return null
  const hookIdx = zoneSrc.indexOf('useDeviceTilt()')
  const hideIdx = zoneSrc.indexOf('if (!showTiltIndicator)')
  assert(
    hookIdx > 0 && hideIdx > hookIdx,
    'SteeringControlZone mantém useDeviceTilt() ativo antes do retorno condicional de showTiltIndicator',
  )

  // Painel 3 (CabinControlsBar): SEM ignição e COM controle funcional de escapamento
  assert(
    !cabinSrc.includes('btn-ignition-') && !cabinSrc.includes('setIgnitionPosition'),
    'Painel 3 (CabinControlsBar) NÃO contém controles de ignição',
  )
  assert(
    cabinSrc.includes('btn-cabin-exhaust-toggle') && cabinSrc.includes('toggleExhaustValve'),
    'Painel 3 (CabinControlsBar) integra controle funcional de Escapamento reutilizando useSimulationStore',
  )

  // Teste funcional do estado de Escape (dependente de upgrade na Fase 4.4.2.2) + navegação entre os 3 painéis
  const golf = loadVehicle('golf-gti')
  useSimulationStore.getState().init(golf)
  assert(useSimulationStore.getState().exhaustValveOpen === false, 'Escape inicia fechado por padrão')
  useSimulationStore.getState().setEquippedUpgrades({ hasExhaustValveKit: true })
  useUIStore.getState().setActiveCockpitPanel('controls')
  useSimulationStore.getState().toggleExhaustValve()
  useSimulationStore.getState().toggleClimateAc()
  useSimulationStore.getState().setWindowPosition('front_left', 0.5)
  useSimulationStore.getState().toggleHazardLights()

  // Navega pelos 3 painéis
  const panels = getAvailableCockpitPanels(golf)
  assert(panels.length === 3, 'Golf GTI mantém navegação completa pelos 3 painéis')
  useUIStore.getState().setActiveCockpitPanel('multimedia')
  useUIStore.getState().setActiveCockpitPanel('cluster')
  useUIStore.getState().setActiveCockpitPanel('controls')

  const st = useSimulationStore.getState()
  assert(
    st.exhaustValveOpen === true &&
      st.climateAcEnabled === true &&
      Math.abs(st.windowPositions.front_left - 0.5) < 1e-4 &&
      st.hazardLights === true,
    'Escape, climatização, vidros e iluminação permanecem íntegros ao alternar entre os 3 painéis',
  )
}

// ─── 8. IGNIÇÃO NO HUD PRINCIPAL NOS 15 VEÍCULOS (PUSH_BUTTON VS CHAVE FÍSICA) ───
console.log('\n=== 8. Ignição no Canto Inferior Direito do HUD nos 15 Veículos ===')
{
  const portraitSrc = fs.readFileSync(path.join(REPO, 'src', 'components', 'dashboard', 'MobilePortraitCockpit.tsx'), 'utf8')
  const landscapeSrc = fs.readFileSync(path.join(REPO, 'src', 'components', 'dashboard', 'MobileLandscapeCockpit.tsx'), 'utf8')
  const hudIgnSrc = fs.readFileSync(path.join(REPO, 'src', 'components', 'controls', 'HudIgnitionControl.tsx'), 'utf8')

  assert(
    portraitSrc.includes('<HudIgnitionControl') && landscapeSrc.includes('<HudIgnitionControl'),
    'Cockpits mobile (Retrato e Paisagem) renderizam HudIgnitionControl no canto inferior direito do HUD',
  )
  assert(
    hudIgnSrc.includes('hud-ignition-push-button') &&
      hudIgnSrc.includes('hud-ignition-key-control') &&
      hudIgnSrc.includes('btn-hud-key-crank') &&
      hudIgnSrc.includes('releaseIgnitionKey'),
    'HudIgnitionControl diferencia Start/Stop (push_button) e Chave Física (OFF/ACC/ON + segurar CRANK -> ON)',
  )

  let pushButtonCount = 0
  let keyCount = 0

  for (const entry of manifest.vehicles) {
    const cfg = loadVehicle(entry.id)
    const ign = resolveVehicleIgnition(cfg)
    const sim = useSimulationStore.getState()
    sim.reset()
    sim.init(cfg)

    if (ign.type === 'push_button') {
      pushButtonCount++
      // 1. Sem pisar no freio -> não deve dar partida quando há startInterlock; cicla ACC/ON
      if (ign.startInterlock !== 'none') {
        sim.setBrake(0)
        sim.setClutch(0)
        sim.pressPushButtonIgnition(true)
        const blockedState = useSimulationStore.getState()
        assert(
          !blockedState.isRunning &&
            blockedState.status === 'off' &&
            (blockedState.ignitionPosition === 'ACC' || blockedState.ignitionPosition === 'ON') &&
            Boolean(blockedState.ignitionFailureReason),
          `[${cfg.id}] Start/Stop bloqueia partida sem pedal (${ign.startInterlock}) e alimenta ${blockedState.ignitionPosition}`,
        )
      }

      // 2. Com pedal requerido -> dá partida real e vai para ON quando motor pega
      if (ign.startInterlock === 'brake' || ign.startInterlock === 'brake_or_clutch') sim.setBrake(0.8)
      if (ign.startInterlock === 'clutch') sim.setClutch(1.0)
      sim.pressPushButtonIgnition(true)
      for (let i = 0; i < 65; i++) sim.update(1 / 120)
      assert(
        useSimulationStore.getState().isRunning === true &&
          useSimulationStore.getState().ignitionPosition === 'ON',
        `[${cfg.id}] Start/Stop liga o motor real e estabiliza ignição em ON`,
      )

      // 3. Pressionar novamente com motor ligado -> desliga para OFF
      sim.pressPushButtonIgnition(true)
      assert(
        useSimulationStore.getState().isRunning === false &&
          useSimulationStore.getState().ignitionPosition === 'OFF',
        `[${cfg.id}] Start/Stop desliga o motor e retorna ignição para OFF`,
      )
    } else {
      keyCount++
      // 1. Estágios OFF -> ACC (quando suportado) -> ON
      if (ign.supportsAccessoryMode) {
        sim.setIgnitionPosition('ACC', true)
        assert(useSimulationStore.getState().ignitionPosition === 'ACC', `[${cfg.id}] Chave física entra em ACC`)
      } else {
        sim.setIgnitionPosition('ACC', true)
        assert(
          useSimulationStore.getState().ignitionPosition === 'ON',
          `[${cfg.id}] Sem modo ACC, chave avança direto para ON`,
        )
      }
      sim.setIgnitionPosition('ON', true)
      assert(
        useSimulationStore.getState().ignitionPosition === 'ON' && !useSimulationStore.getState().isRunning,
        `[${cfg.id}] Chave física energiza painel em ON sem ligar o motor`,
      )

      // 2. Se houver interlock (ex.: Fusion SEL 2012 = brake, Civic Si = clutch), valida bloqueio sem pedal
      if (ign.startInterlock !== 'none') {
        sim.setBrake(0)
        sim.setClutch(0)
        sim.setIgnitionPosition('CRANK', true)
        assert(
          !useSimulationStore.getState().isRunning &&
            useSimulationStore.getState().status === 'off' &&
            Boolean(useSimulationStore.getState().ignitionFailureReason),
          `[${cfg.id}] Chave física respeita startInterlock (${ign.startInterlock}) ao tentar girar para CRANK`,
        )
      }

      // 3. Segurar CRANK por tempo insuficiente (0.10s < 0.45s) e soltar -> retorna para ON sem pegar!
      if (ign.startInterlock === 'brake' || ign.startInterlock === 'brake_or_clutch') sim.setBrake(0.8)
      if (ign.startInterlock === 'clutch') sim.setClutch(1.0)
      sim.setIgnitionPosition('CRANK', true)
      for (let i = 0; i < 12; i++) sim.update(1 / 120) // 0.10s
      const releasedEarlyPos = sim.releaseIgnitionKey()
      assert(
        releasedEarlyPos === 'ON' &&
          useSimulationStore.getState().ignitionPosition === 'ON' &&
          useSimulationStore.getState().isRunning === false,
        `[${cfg.id}] Soltar CRANK precocemente retorna chave para ON e desacopla arranque antes de pegar`,
      )

      // 4. Segurar CRANK até o motor pegar (~0.54s) e soltar -> motor permanece ligado e chave em ON!
      sim.setIgnitionPosition('CRANK', true)
      for (let i = 0; i < 65; i++) sim.update(1 / 120)
      const releasedAfterStartPos = sim.releaseIgnitionKey()
      assert(
        releasedAfterStartPos === 'ON' &&
          useSimulationStore.getState().ignitionPosition === 'ON' &&
          useSimulationStore.getState().isRunning === true,
        `[${cfg.id}] Segurar CRANK liga o motor e ao soltar mantém chave em ON com motor em funcionamento`,
      )

      // 5. Girar chave para OFF desliga o motor
      sim.setIgnitionPosition('OFF', true)
      assert(
        useSimulationStore.getState().ignitionPosition === 'OFF' &&
          useSimulationStore.getState().isRunning === false,
        `[${cfg.id}] Girar chave para OFF desliga o motor`,
      )
    }
  }

  assert(
    pushButtonCount === 7 && keyCount === 8 && pushButtonCount + keyCount === 15,
    `Cobertura integral dos 15 veículos validada (${pushButtonCount} push_button + ${keyCount} chave física)`,
  )
}

console.log('\n══════════════════════════════════════════════════════════════════════════')
console.log(`  RESULTADO FASE 4.4.1: ${passed} PASSARAM | ${failed} FALHARAM`)
console.log('══════════════════════════════════════════════════════════════════════════\n')

if (failed > 0) {
  process.exit(1)
}
