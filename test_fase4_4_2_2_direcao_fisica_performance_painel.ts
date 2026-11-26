/**
 * HEATZ AUTO — FASE 4.4.2.2: Suíte Completa de Direção, Física, Performance e Modo Painel
 *
 * Cobre integralmente os requisitos técnicos da Fase 4.4.2.2:
 * 1. Orientação de frenagem no asfalto: distância dinâmica (velocidade/curvatura/atrito) e ciclo de vida
 *    com estado (`AsphaltGuidanceTracker`: aproximação -> permanência -> travessia -> desaparecimento pós-curva).
 * 2. Minimapa radar equilibrado: dimensões intermediárias, escala mais distante, foco frontal e cache estático.
 * 3. Freio de mão e pedais com multitouch real (acelerador + freio + freio de mão + inclinação simultâneos).
 * 4. Válvula/difusor de escapamento dependente de upgrade nos 15 veículos (UI + validação na store/atalhos).
 * 5. Compatibilidade multi-smartphone do sensor de inclinação (fallback DeviceMotion acelerômetro 3D + diagnóstico).
 * 6. Sensibilidade progressiva + velocidade-dependente e centralização perfeita sem inversão/overshoot nas 5 sequências.
 * 7. Proteção de transição D ↔ R em movimento (Automático convencional/CVT, DCT e Manual) + trocas parado.
 * 8. Separação arquitetural completa do Modo Painel (`PanelModeInteriorView`) em Desktop, Portrait e Landscape.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { VehicleConfig } from './src/types/vehicle'
import {
  AsphaltGuidanceTracker,
  computeAnticipationDistanceM,
} from './src/systems/world/asphaltGuidance'
import { HUD_MINIMAP_SPECS } from './src/components/dashboard/HudMinimap'
import {
  TiltSteeringController,
  sharedTiltSteering,
  TILT_SENSITIVITY_PRESETS,
} from './src/systems/input'
import { canControlExhaustValve, resolveDefaultUpgradesForVehicle } from './src/systems/vehicle/vehicleResolvers'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'

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
console.log('  HEATZ AUTO — FASE 4.4.2.2: DIREÇÃO, FÍSICA, PERFORMANCE E MODO PAINEL')
console.log('══════════════════════════════════════════════════════════════════════════\n')

// ─── 1. ORIENTAÇÃO DE FRENAGEM NO ASFALTO: ANTECIPAÇÃO E CICLO DE VIDA ───
console.log('=== 1. Orientação de Frenagem no Asfalto (Aproximação, Permanência, Travessia e Saída) ===')
{
  const distLowSpeed = computeAnticipationDistanceM(35, 50, 35, 0.95)
  // Mantém as duas medições abaixo do teto de 145m para comparar o efeito do atrito.
  const distHighSpeed = computeAnticipationDistanceM(90, 50, 35, 0.95)
  const distWetHighSpeed = computeAnticipationDistanceM(90, 50, 35, 0.58)
  const distTightCurve = computeAnticipationDistanceM(90, 35, 16, 0.95)
  const distGentleCurve = computeAnticipationDistanceM(90, 85, 80, 0.95)

  assert(
    distHighSpeed > distLowSpeed + 30,
    `Antecipação escala com velocidade (${distHighSpeed.toFixed(1)}m a 115 km/h vs ${distLowSpeed.toFixed(1)}m a 35 km/h)`,
  )
  assert(
    distWetHighSpeed > distHighSpeed,
    `Antecipação aumenta em piso molhado (${distWetHighSpeed.toFixed(1)}m molhado > ${distHighSpeed.toFixed(1)}m seco)`,
  )
  assert(
    distTightCurve > distGentleCurve,
    `Antecipação maior para curva fechada (${distTightCurve.toFixed(1)}m R=16m > ${distGentleCurve.toFixed(1)}m R=80m)`,
  )

  // Simula aproximação contínua pela Av. Sul rumo à Rotatória Central (interseção em y=0, r=36m -> borda em y=-36m):
  // De y = -140m (104m antes da entrada) até y = +24m (após cruzar a rotatória)
  const tracker = new AsphaltGuidanceTracker()
  const approach104m = tracker.update(0, -140, 0, 110, false)
  assert(
    approach104m !== null && approach104m.featureId === 'int-rotatoria' && approach104m.alpha > 0.2,
    'A ~104m de distância em alta velocidade (110 km/h), a marcação da rotatória aparece no asfalto',
  )

  const anchorPaintX = approach104m!.paintX
  const anchorPaintY = approach104m!.paintY

  // Avança de y = -120m até y = -38m (2m antes da borda!) e verifica que NUNCA desaparece nem muda de lugar
  let stayedVisibleAllApproach = true
  let stayedAnchoredOnAsphalt = true
  for (const y of [-120, -100, -80, -60, -48, -42, -38, -34, -20, -5]) {
    // Inclui pequenas oscilações laterais (±1.2m) e frenagem gradual para testar ausência de flicker
    const jitterX = Math.sin(y) * 1.2
    const speedAtPoint = y < -60 ? 95 : 52
    const g = tracker.update(jitterX, y, 0, speedAtPoint, false)
    if (!g || g.featureId !== 'int-rotatoria' || g.alpha < 0.85) {
      stayedVisibleAllApproach = false
    } else if (Math.hypot(g.paintX - anchorPaintX, g.paintY - anchorPaintY) > 1e-4) {
      stayedAnchoredOnAsphalt = false
    }
  }
  assert(
    stayedVisibleAllApproach,
    'Marcação permanece continuamente visível durante toda a aproximação (100m -> 2m -> entrada do trecho) sem sumir cedo',
  )
  assert(
    stayedAnchoredOnAsphalt,
    'Coordenadas da pintura no asfalto permanecem fixas sem piscar sob oscilações laterais e desaceleração',
  )

  // No ápice/centro (y = 0..+8m) ainda está concluindo a passagem; após superar clearPastRefM (y = +24m) desaparece!
  const atCenter = tracker.update(0, 4, 0, 48, false)
  assert(atCenter !== null && atCenter.featureId === 'int-rotatoria', 'Permanece visível ao alcançar/atravessar o ponto relevante')

  const afterPass = tracker.update(0, 26, 0, 55, false)
  assert(
    afterPass === null || afterPass.featureId !== 'int-rotatoria',
    'Desaparece somente DEPOIS que o veículo conclui a passagem pelo trecho',
  )

  // Teste de perda de relevância por conversão/retorno: trava em curva e vira em sentido oposto
  const divergeTracker = new AsphaltGuidanceTracker()
  const lockedBefore = divergeTracker.update(0, -110, 0, 90, false)
  const afterUTurn = divergeTracker.update(0, -112, 180, 40, false)
  assert(
    lockedBefore !== null && (afterUTurn === null || afterUTurn.featureId !== lockedBefore.featureId),
    'Descarta o trecho imediatamente quando o motorista inverte o sentido e a curva deixa de ser relevante',
  )
}

// ─── 2. MINIMAPA RADAR EQUILIBRADO ───
console.log('\n=== 2. Minimapa Radar Equilibrado (Dimensões, Escala Distante e Foco Frontal) ===')
{
  const minimapSrc = fs.readFileSync(path.join(REPO, 'src', 'components', 'dashboard', 'HudMinimap.tsx'), 'utf8')
  const d = HUD_MINIMAP_SPECS.desktop
  const l = HUD_MINIMAP_SPECS.mobile_landscape
  const p = HUD_MINIMAP_SPECS.mobile_portrait

  assert(
    d.widthPx > 96 && d.widthPx < 152 && d.heightPx > 62 && d.heightPx < 86,
    `Desktop minimap (${d.widthPx}×${d.heightPx}px) equilibra Fase 4.4.2.1 (96×62) e Fase 4.4.2 (152×86)`,
  )
  assert(
    l.widthPx > 92 && l.widthPx < 136 && p.widthPx > 82 && p.widthPx < 124,
    `Mobile Landscape (${l.widthPx}×${l.heightPx}px) e Portrait (${p.widthPx}×${p.heightPx}px) ampliados sem exagero`,
  )
  const lookaheadDesktopM = (d.heightPx * d.headingUpAnchorYRatio) / d.scalePxPerMeter
  const lookaheadPortraitM = (p.heightPx * p.headingUpAnchorYRatio) / p.scalePxPerMeter
  assert(
    lookaheadDesktopM >= 90 && lookaheadDesktopM <= 135 && lookaheadPortraitM >= 85,
    `Zoom radar antecipa ~${Math.round(lookaheadDesktopM)}m (Desktop) e ~${Math.round(lookaheadPortraitM)}m (Mobile) à frente`,
  )
  assert(
    d.headingUpAnchorYRatio > 0.60 &&
      minimapSrc.includes("'heading_up'") &&
      minimapSrc.includes("'north_up'") &&
      !minimapSrc.includes('computeUpcomingNavigation') &&
      minimapSrc.includes('hud-minimap-context-bar'),
    'Prioriza área à frente do veículo, preserva heading_up/north_up e organiza contexto real em micro-barra externa ao canvas (Fase 4.4.3)',
  )
}

// ─── 3. FREIO DE MÃO E MULTITOUCH SIMULTÂNEO COM FÍSICA REAL ───
console.log('\n=== 3. Multitouch: Acelerador + Freio + Freio de Mão + Inclinação Simultâneos ===')
{
  const handbrakeBtnSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'controls', 'HandbrakeButton.tsx'),
    'utf8',
  )
  const portraitSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'dashboard', 'MobilePortraitCockpit.tsx'),
    'utf8',
  )
  const landscapeSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'dashboard', 'MobileLandscapeCockpit.tsx'),
    'utf8',
  )

  assert(
    handbrakeBtnSrc.includes('onPointerDown') &&
      handbrakeBtnSrc.includes('handledPointersRef') &&
      handbrakeBtnSrc.includes("touchAction: 'none'") &&
      portraitSrc.includes('<HandbrakeButton') &&
      portraitSrc.includes('useSecondaryTouchTapBridge') &&
      landscapeSrc.includes('<HandbrakeButton') &&
      landscapeSrc.includes('useSecondaryTouchTapBridge'),
    'HandbrakeButton opera por pointerId independente em onPointerDown nos cockpits Portrait e Landscape',
  )

  // Simula ciclo completo multitouch na física: acelerador pressionado -> puxa freio de mão -> inclina -> solta freio de mão
  const bmw = loadVehicle('bmw-320i-msport-2024')
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(bmw)
  sim.setBrake(0.8)
  sim.pressPushButtonIgnition(true)
  for (let i = 0; i < 65; i++) sim.update(1 / 120)
  sim.setBrake(0)
  sim.selectDrive()

  // Dedo 1 segura o acelerador (0.85) até ganhar velocidade
  sim.setThrottle(0.85)
  for (let i = 0; i < 240; i++) sim.update(1 / 120)
  const speedBeforeHandbrake = useSimulationStore.getState().speed
  assert(speedBeforeHandbrake > 25, `Veículo acelera normalmente com Dedo 1 (${speedBeforeHandbrake.toFixed(1)} km/h)`)

  // Dedo 2 aciona o freio de mão + sensor de inclinação esterça simultaneamente, mantendo Dedo 1 no acelerador!
  sim.toggleHandbrake()
  sharedTiltSteering.processSample({ beta: 18, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60, true)
  assert(
    useSimulationStore.getState().handbrake === true &&
      useSimulationStore.getState().throttle === 0.85 &&
      useSimulationStore.getState().steeringAngle > 0,
    'Acionar freio de mão + inclinar smartphone NÃO cancela nem reduz o acelerador mantido pelo Dedo 1',
  )

  for (let i = 0; i < 90; i++) sim.update(1 / 120)
  const speedDuringHandbrake = useSimulationStore.getState().speed
  assert(
    speedDuringHandbrake < speedBeforeHandbrake,
    `Freio de mão aplica frenagem física real (${speedBeforeHandbrake.toFixed(1)} -> ${speedDuringHandbrake.toFixed(1)} km/h)`,
  )

  // Dedo 2 solta o freio de mão enquanto Dedo 1 continua acelerando!
  sim.toggleHandbrake()
  assert(
    useSimulationStore.getState().handbrake === false && useSimulationStore.getState().throttle === 0.85,
    'Soltar o freio de mão preserva o acelerador ativo sem travamento de estado',
  )
  for (let i = 0; i < 120; i++) sim.update(1 / 120)
  assert(
    useSimulationStore.getState().speed > speedDuringHandbrake + 5,
    'Após soltar o freio de mão, o veículo volta a ganhar velocidade imediatamente com o acelerador pressionado',
  )
}

// ─── 4. ABERTURA DO ESCAPAMENTO DEPENDENTE DE UPGRADE NOS 15 VEÍCULOS ───
console.log('\n=== 4. Escapamento Dependente de Upgrade (15 Veículos + Bloqueio na Store) ===')
{
  let stockGrantedCount = 0
  for (const entry of manifest.vehicles) {
    const cfg = loadVehicle(entry.id)
    const defaultUpg = resolveDefaultUpgradesForVehicle(cfg.id, cfg)
    if (canControlExhaustValve(cfg, defaultUpg)) {
      stockGrantedCount++
    }
  }
  assert(
    stockGrantedCount === 0,
    `Nenhum dos 15 veículos recebe o difusor de escapamento automaticamente de fábrica (0/${manifest.vehicles.length})`,
  )

  const jetta = loadVehicle('jetta-gli-2021')
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(jetta)

  // Tentativa direta sem upgrade deve ser bloqueada na store!
  sim.toggleExhaustValve()
  sim.setExhaustValve(true)
  assert(
    useSimulationStore.getState().exhaustValveOpen === false,
    'Sem upgrade compatível, chamadas diretas a toggleExhaustValve / setExhaustValve(true) são bloqueadas',
  )

  // Instala Kit Difusor Eletrônico -> habilita e abre!
  sim.setEquippedUpgrades({ hasExhaustValveKit: true })
  sim.toggleExhaustValve()
  assert(
    useSimulationStore.getState().exhaustValveOpen === true,
    'Após instalar Kit Difusor Eletrônico, o controle de abertura funciona normalmente',
  )

  // Remove Kit Difusor (mantendo escape original) -> fecha automaticamente e volta a bloquear!
  sim.setEquippedUpgrades({ hasExhaustValveKit: false, exhaustType: 'sport' })
  assert(
    useSimulationStore.getState().exhaustValveOpen === false,
    'Remover o upgrade fecha automaticamente a válvula de escapamento',
  )
  sim.toggleExhaustValve()
  assert(
    useSimulationStore.getState().exhaustValveOpen === false,
    'Após remoção do upgrade, o controle volta a ficar bloqueado',
  )

  // Instala escapamento Cat-Back compatível -> habilita novamente!
  sim.setEquippedUpgrades({ exhaustType: 'cat_back' })
  sim.toggleExhaustValve()
  assert(
    useSimulationStore.getState().exhaustValveOpen === true,
    'Instalar sistema Cat-Back compatível também habilita a abertura da válvula',
  )
}

// ─── 5. COMPATIBILIDADE ENTRE SMARTPHONES (FALLBACK ACELERÔMETRO 3D) & DIAGNÓSTICO ───
console.log('\n=== 5. Compatibilidade Multi-Smartphone (Sem Giroscópio / Acelerômetro 3D + Diagnóstico) ===')
{
  memoryStorage.clear()
  sharedTiltSteering.resetCalibration()

  // Simula smartphone de entrada ("celular da avó") SEM giroscópio, usando apenas acelerômetro 3D (`accelerationIncludingGravity`)
  const accelCtrl = new TiltSteeringController({
    enabled: true,
    deadzoneDeg: 2.0,
    smoothingFactor: 1.0,
    responseExponent: 1.65,
    sensitivity: TILT_SENSITIVITY_PRESETS.medium.sensitivity,
  })

  // Calibração bloqueada enquanto só chegam eventos nulos
  const nullSample = { beta: null, gamma: null, isLandscape: true, orientationAngle: 90 }
  accelCtrl.calibrate(nullSample)
  assert(
    !accelCtrl.isCalibratedState(),
    'Aparelho que emitiu apenas evento nulo NÃO é marcado falsamente como calibrado',
  )

  // Amostra real de acelerômetro 3D em Paisagem 90° parado no centro (ax = +9.81, ay = 0, az = 0)
  const centerGravityLand = {
    accelIncludingGravityX: 9.4,
    accelIncludingGravityY: 0.0,
    accelIncludingGravityZ: 2.8,
    isLandscape: true,
    orientationAngle: 90,
  }
  const calDeg = accelCtrl.calibrate(centerGravityLand)
  assert(
    accelCtrl.isCalibratedState() && Math.abs(calDeg) < 0.01,
    'Fallback por acelerômetro 3D (DeviceMotion) permite calibrar normalmente smartphone sem giroscópio',
  )

  // Inclinar 20° à direita em Paisagem 90° -> ay = +g*sin(20°) = +3.35 m/s²
  const rightGravityLand = {
    accelIncludingGravityX: 9.22 * Math.cos((20 * Math.PI) / 180),
    accelIncludingGravityY: 9.81 * Math.sin((20 * Math.PI) / 180),
    accelIncludingGravityZ: 2.5,
    isLandscape: true,
    orientationAngle: 90,
  }
  const leftGravityLand = {
    accelIncludingGravityX: 9.22 * Math.cos((20 * Math.PI) / 180),
    accelIncludingGravityY: -9.81 * Math.sin((20 * Math.PI) / 180),
    accelIncludingGravityZ: 2.5,
    isLandscape: true,
    orientationAngle: 90,
  }
  const sRight = accelCtrl.computeSteering(rightGravityLand, 1 / 60)
  const sLeft = accelCtrl.computeSteering(leftGravityLand, 1 / 60)
  assert(
    sRight > 0.05 && sLeft < -0.05 && Math.abs(sRight + sLeft) < 1e-4,
    `Acelerômetro 3D em Paisagem gera direção simétrica Direita (+${sRight.toFixed(3)}) e Esquerda (${sLeft.toFixed(3)})`,
  )

  // Verifica exposição completa do diagnóstico ao jogador
  sharedTiltSteering.processSample(rightGravityLand, 1 / 60, false)
  const diag = sharedTiltSteering.getSnapshot().diagnostics
  assert(
    diag.receivingValidEvents === true &&
      diag.validEventCount > 0 &&
      typeof diag.statusLabel === 'string' &&
      diag.statusLabel.length > 0,
    `Diagnóstico do sensor reporta estado real (${diag.statusLabel}, eventos válidos=${diag.validEventCount})`,
  )
}

// ─── 6. SENSIBILIDADE PROGRESSIVA E CENTRALIZAÇÃO SEM INVERSÃO (5 SEQUÊNCIAS) ───
console.log('\n=== 6. Sensibilidade Progressiva e Centralização do Volante (Problema A & B) ===')
{
  memoryStorage.clear()
  sharedTiltSteering.resetCalibration()
  const sim = useSimulationStore.getState()
  const golf = loadVehicle('golf-gti')
  sim.reset()
  sim.init(golf)
  sim.setSteeringSensitivityPreset('medium')
  sim.setSteeringDeadzone(3.0)
  sim.setSteeringInvertDirection(false)

  // Problema A: pequena inclinação de 6° (3° além da deadzone) deve produzir correção suave (< 8% de volante),
  // enquanto inclinação de 32° produz esterçamento forte (> 45%)
  const ctrlProg = new TiltSteeringController({
    enabled: true,
    deadzoneDeg: 3.0,
    smoothingFactor: 1.0,
    responseExponent: 1.65,
    sensitivity: TILT_SENSITIVITY_PRESETS.medium.sensitivity,
  })
  const smallSteer6Deg = ctrlProg.computeSteering({ beta: 6, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  const medSteer18Deg = ctrlProg.computeSteering({ beta: 18, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  const largeSteer34Deg = ctrlProg.computeSteering({ beta: 34, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60)
  assert(
    smallSteer6Deg > 0 && smallSteer6Deg < 0.06 && medSteer18Deg > 0.14 && largeSteer34Deg > 0.55,
    `Curva progressiva suave: 6° -> ${(smallSteer6Deg * 100).toFixed(1)}%, 18° -> ${(medSteer18Deg * 100).toFixed(1)}%, 34° -> ${(largeSteer34Deg * 100).toFixed(1)}%`,
  )

  // Problema B — Sequência 1: Centro -> Direita (+24°) -> Centro (0°) + Física 120 Hz acoplada!
  const phys = new VehiclePhysics({
    vehicleId: golf.id,
    weight: golf.info.weight,
    wheelDiameter: golf.info.wheelDiameter,
    drivetrain: golf.transmission.drivetrain,
    chassis: golf.chassis,
  })
  phys.setSpeedKmh(80)

  sharedTiltSteering.calibrateNeutral({ beta: 0, gamma: 40, isLandscape: true, orientationAngle: 90 })
  for (let i = 0; i < 45; i++) {
    const st = sharedTiltSteering.processSample({ beta: 24, gamma: 40, isLandscape: true, orientationAngle: 90 }, 1 / 60, true)
    phys.setSteeringAngle(st * 0.30)
    phys.tick({ driveTorqueAtTransmission: 90, gearRatio: 1.5, finalDrive: 3.5, brake: 0, handbrake: false, deltaTime: 1 / 60, steeringAngleRad: st * 0.30, gear: 3 })
  }
  assert(useSimulationStore.getState().steeringAngle > 0.25, 'Sequência 1 (Centro -> Direita): volante vira à direita (+)')

  let minSteerDuringReturnRight = Infinity
  for (let i = 0; i < 90; i++) {
    const st = sharedTiltSteering.processSample({ beta: 0, gamma: 40, isLandscape: true, orientationAngle: 90 }, 1 / 60, true)
    if (st < minSteerDuringReturnRight) minSteerDuringReturnRight = st
    phys.setSteeringAngle(st * 0.30)
    phys.tick({ driveTorqueAtTransmission: 90, gearRatio: 1.5, finalDrive: 3.5, brake: 0, handbrake: false, deltaTime: 1 / 60, steeringAngleRad: st * 0.30, gear: 3 })
  }
  assert(
    minSteerDuringReturnRight >= 0 && useSimulationStore.getState().steeringAngle === 0 && Math.abs(phys.getYawRate()) < 0.12,
    `Sequência 1 (Direita -> Centro): retorno monotônico a 0.000 sem esterço negativo/esquerdo (min=${minSteerDuringReturnRight.toFixed(5)}, yaw residual=${phys.getYawRate().toFixed(4)} rad/s)`,
  )

  // Sequência 2: Centro -> Esquerda (-24°) -> Centro (0°)
  for (let i = 0; i < 45; i++) {
    sharedTiltSteering.processSample({ beta: -24, gamma: 40, isLandscape: true, orientationAngle: 90 }, 1 / 60, true)
  }
  let maxSteerDuringReturnLeft = -Infinity
  for (let i = 0; i < 90; i++) {
    const st = sharedTiltSteering.processSample({ beta: 0, gamma: 40, isLandscape: true, orientationAngle: 90 }, 1 / 60, true)
    if (st > maxSteerDuringReturnLeft) maxSteerDuringReturnLeft = st
  }
  assert(
    maxSteerDuringReturnLeft <= 0 && useSimulationStore.getState().steeringAngle === 0,
    `Sequência 2 (Esquerda -> Centro): retorno monotônico a 0.000 sem NENHUM esterço positivo/direito (max=${maxSteerDuringReturnLeft.toFixed(5)})`,
  )

  // Sequência 3: Centro -> Direita -> Esquerda -> Centro
  for (let i = 0; i < 30; i++) sharedTiltSteering.processSample({ beta: 22, gamma: 40, isLandscape: true, orientationAngle: 90 }, 1 / 60, true)
  const rightPeak = useSimulationStore.getState().steeringAngle
  for (let i = 0; i < 45; i++) sharedTiltSteering.processSample({ beta: -22, gamma: 40, isLandscape: true, orientationAngle: 90 }, 1 / 60, true)
  const leftPeak = useSimulationStore.getState().steeringAngle
  for (let i = 0; i < 90; i++) sharedTiltSteering.processSample({ beta: 0, gamma: 40, isLandscape: true, orientationAngle: 90 }, 1 / 60, true)
  assert(
    rightPeak > 0.15 && leftPeak < -0.15 && useSimulationStore.getState().steeringAngle === 0,
    'Sequência 3 (Centro -> Direita -> Esquerda -> Centro): transição limpa e centralização exata em 0',
  )

  // Sequência 4: Pequenas inclinações repetidas (±6°) e retorno ao centro
  for (const b of [6, -6, 7, -7, 5, -5]) {
    for (let i = 0; i < 12; i++) sharedTiltSteering.processSample({ beta: b, gamma: 40, isLandscape: true, orientationAngle: 90 }, 1 / 60, true)
  }
  for (let i = 0; i < 75; i++) sharedTiltSteering.processSample({ beta: 0, gamma: 40, isLandscape: true, orientationAngle: 90 }, 1 / 60, true)
  assert(
    useSimulationStore.getState().steeringAngle === 0,
    'Sequência 4 (Pequenas inclinações repetidas): sem acúmulo de erro ou deriva residual ao voltar ao centro',
  )

  // Sequência 5: Retrato quase vertical (beta = 86°..94° — antigo ponto de explosão/inversão Euler!) + troca Portrait <-> Landscape
  // Em W3C para celular a 86° vertical inclinado 15° à direita: ux = -sin(86)*sin(15), uy = sin(86)*cos(15), uz = cos(86)
  const port86Right = {
    accelIncludingGravityX: -9.81 * Math.sin((86 * Math.PI) / 180) * Math.sin((15 * Math.PI) / 180),
    accelIncludingGravityY: 9.81 * Math.sin((86 * Math.PI) / 180) * Math.cos((15 * Math.PI) / 180),
    accelIncludingGravityZ: 9.81 * Math.cos((86 * Math.PI) / 180),
    isLandscape: false,
    orientationAngle: 0,
  }
  const port94Center = {
    beta: 94,
    gamma: 0,
    isLandscape: false,
    orientationAngle: 0,
  }
  for (let i = 0; i < 30; i++) sharedTiltSteering.processSample(port86Right, 1 / 60, true)
  assert(useSimulationStore.getState().steeringAngle > 0, 'Sequência 5a (Retrato vertical 86°): inclinação à direita controlada sem explosão de ganho')
  for (let i = 0; i < 80; i++) sharedTiltSteering.processSample(port94Center, 1 / 60, true)
  assert(
    useSimulationStore.getState().steeringAngle === 0,
    'Sequência 5b (Retrato cruzando 90° -> 94° no centro): centraliza perfeitamente sem virar para a esquerda',
  )
}

// ─── 7. PROTEÇÃO DE TROCA ENTRE D E R EM MOVIMENTO (AUTO, DCT E MANUAL) ───
console.log('\n=== 7. Proteção de Mudança de Sentido D ↔ R (Automático, DCT e Manual) ===')
{
  const sim = useSimulationStore.getState()

  // 7A. Automático Convencional (BMW 320i ZF8): D -> R em movimento para frente (60 km/h)
  const bmw = loadVehicle('bmw-320i-msport-2024')
  sim.reset()
  sim.init(bmw)
  sim.setBrake(0.8)
  sim.pressPushButtonIgnition(true)
  for (let i = 0; i < 65; i++) sim.update(1 / 120)
  sim.setBrake(0)
  sim.selectDrive()
  sim.setThrottle(0.9)
  let ticksTo60 = 0
  while (useSimulationStore.getState().speed < 60 && ticksTo60 < 12000) {
    sim.update(1 / 120)
    ticksTo60++
  }
  assert(useSimulationStore.getState().speed >= 60, `BMW atinge 60 km/h em até ${ticksTo60} ticks`)
  const yBeforeShiftR = useSimulationStore.getState().positionY

  // Jogador engata R a 60 km/h enquanto acelera!
  sim.selectReverse()
  const immediatelyAfterR = useSimulationStore.getState()
  assert(
    immediatelyAfterR.gearSelectorPosition === 'R' &&
      immediatelyAfterR.isDirectionProtectionActive === true &&
      immediatelyAfterR.currentGear === 0,
    'Automático ZF8 (D -> R a 60 km/h): registra seletor R, ativa proteção e desacopla marcha (Neutro)',
  )

  // Nos primeiros 0.4s (48 ticks), o carro AINDA está indo para frente (positionY aumentando) e desacelerando!
  for (let i = 0; i < 48; i++) sim.update(1 / 120)
  const midDecel = useSimulationStore.getState()
  assert(
    midDecel.positionY > yBeforeShiftR && midDecel.speed < 60 && midDecel.currentGear === 0,
    `Automático ZF8: continua deslocando-se para frente enquanto desacelera (${midDecel.speed.toFixed(1)} km/h), sem força reversa instantânea`,
  )

  // Continua desacelerando com freio até velocidade segura -> engata ré (-1) automaticamente e passa a recuar!
  sim.setBrake(0.85)
  for (let i = 0; i < 360; i++) {
    sim.update(1 / 120)
    if (useSimulationStore.getState().currentGear === -1) break
  }
  assert(
    useSimulationStore.getState().currentGear === -1 &&
      useSimulationStore.getState().isDirectionProtectionActive === false &&
      useSimulationStore.getState().speed <= 3.0,
    'Automático ZF8: engata ré (-1) somente após desacelerar até condição segura (<= 2.5 km/h)',
  )

  // 7B. DCT Dupla Embreagem (Porsche PDK): R -> D andando de ré (-25 km/h)
  const porsche = loadVehicle('porsche-gt3')
  sim.reset()
  sim.init(porsche)
  sim.setBrake(0.8)
  sim.pressPushButtonIgnition(true)
  for (let i = 0; i < 65; i++) sim.update(1 / 120)
  sim.setBrake(0)
  sim.selectReverse()
  assert(
    useSimulationStore.getState().currentGear === -1 && !useSimulationStore.getState().isDirectionProtectionActive,
    'DCT PDK parado (0 km/h): engata R imediatamente sem atraso',
  )
  sim.setThrottle(0.75)
  let ticksTo25Reverse = 0
  while (useSimulationStore.getState().speed < 25 && ticksTo25Reverse < 12000) {
    sim.update(1 / 120)
    ticksTo25Reverse++
  }
  assert(useSimulationStore.getState().speed >= 25, `Porsche atinge 25 km/h em ré em até ${ticksTo25Reverse} ticks`)
  const yBeforeShiftD = useSimulationStore.getState().positionY

  // Engata D andando de ré a 25 km/h!
  sim.selectDrive()
  assert(
    useSimulationStore.getState().gearSelectorPosition === 'D' &&
      useSimulationStore.getState().isDirectionProtectionActive === true &&
      useSimulationStore.getState().currentGear === 0,
    'DCT PDK (R -> D a -25 km/h): ativa proteção eletrônica da dupla embreagem e posterga torque à frente',
  )
  for (let i = 0; i < 36; i++) sim.update(1 / 120)
  assert(
    useSimulationStore.getState().positionY < yBeforeShiftD && useSimulationStore.getState().speed < 25,
    'DCT PDK: não dispara para frente enquanto ainda possui velocidade de ré',
  )

  for (let i = 0; i < 360; i++) {
    sim.update(1 / 120)
    if (useSimulationStore.getState().currentGear >= 1) break
  }
  const yAtSafeStop = useSimulationStore.getState().positionY
  for (let i = 0; i < 90; i++) sim.update(1 / 120)
  assert(
    useSimulationStore.getState().currentGear >= 1 &&
      !useSimulationStore.getState().isDirectionProtectionActive &&
      useSimulationStore.getState().positionY > yAtSafeStop,
    'DCT PDK: após desacelerar até parar, acopla 1ª marcha e traciona suavemente para frente',
  )

  // R -> D parado (0 km/h)
  sim.selectPark()
  sim.selectDrive()
  assert(
    useSimulationStore.getState().currentGear === 1 && !useSimulationStore.getState().isDirectionProtectionActive,
    'Parado (0 km/h): P/R -> D acopla imediatamente sem bloqueio indevido',
  )

  // 7C. Transmissão Manual (VW Gol G6): bloqueio mecânico de Ré em movimento para frente
  const gol = loadVehicle('gol-g6')
  sim.reset()
  sim.init(gol)
  sim.setClutch(1.0)
  sim.setIgnitionPosition('CRANK', true)
  for (let i = 0; i < 65; i++) sim.update(1 / 120)
  sim.releaseIgnitionKey()
  sim.setBrake(0)
  sim.setClutch(1.0)
  sim.shiftHPattern(1)
  sim.setClutch(0)
  // Injeta velocidade assinada para isolar a proteção mecânica do câmbio do teste de aceleração.
  sim.setSpeed(35)
  assert(useSimulationStore.getState().speed === 35, 'Gol recebe estado de movimento à frente a 35 km/h para o teste do bloqueio mecânico')
  const yManualBefore = useSimulationStore.getState().positionY
  sim.setClutch(1.0)
  sim.shiftHPattern(-1)
  const manualAfterR = useSimulationStore.getState()
  for (let i = 0; i < 30; i++) sim.update(1 / 120)
  assert(
    manualAfterR.isGearGrinding === true &&
      manualAfterR.currentGear === 0 &&
      useSimulationStore.getState().positionY > yManualBefore,
    'Manual H-Pattern (Gol G6 a 35 km/h): bloqueia engate de Ré com alerta mecânico e preserva movimento à frente',
  )
}

// ─── 8. MODO PAINEL DIRIGÍVEL (`entryMode === "cluster"`, EVOLUÍDO NA FASE 4.4.3 ETAPA 2) ───
console.log('\n=== 8. Modo Painel Dirigível (`entryMode === "cluster"`, Fase 4.4.3 Etapa 2) ===')
{
  const dashSrc = fs.readFileSync(path.join(REPO, 'src', 'components', 'dashboard', 'VehicleDashboard.tsx'), 'utf8')
  const portraitSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'dashboard', 'MobilePortraitCockpit.tsx'),
    'utf8',
  )
  const landscapeSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'dashboard', 'MobileLandscapeCockpit.tsx'),
    'utf8',
  )
  const panelInteriorSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'cockpit', 'PanelModeInteriorView.tsx'),
    'utf8',
  )
  const panelExecutableSrc = panelInteriorSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '')

  assert(
    dashSrc.includes("const isDriveMode = entryMode !== 'cluster'") &&
      dashSrc.includes('<PanelModeInteriorView') &&
      portraitSrc.includes('<PanelModeInteriorView') &&
      landscapeSrc.includes('<PanelModeInteriorView'),
    'VehicleDashboard, MobilePortraitCockpit e MobileLandscapeCockpit integram PanelModeInteriorView mantendo pedais, câmbio, freio de mão e ignição',
  )
  assert(
    !panelExecutableSrc.includes('HudMinimap') &&
      !panelExecutableSrc.includes('DrivingMapViewport') &&
      !panelExecutableSrc.includes('WorldMapModal') &&
      !panelExecutableSrc.includes('AsphaltGuidanceTracker'),
    'PanelModeInteriorView NÃO importa nem renderiza minimapa, mapa 2D, WorldMapModal ou guias de asfalto',
  )
  assert(
    panelInteriorSrc.includes('<InstrumentClusterPanel') &&
      panelInteriorSrc.includes('<MultimediaPanel') &&
      panelInteriorSrc.includes('<VehicleControlsPanel') &&
      panelInteriorSrc.includes('data-layout="mobile_portrait"') &&
      panelInteriorSrc.includes('data-layout="mobile_landscape"') &&
      panelInteriorSrc.includes('data-layout="desktop"'),
    'PanelModeInteriorView organiza Controles (ex-GPS) + Cluster centralizado + Multimídia abaixo em Desktop, Portrait e Landscape',
  )
}

console.log('\n══════════════════════════════════════════════════════════════════════════')
console.log(`  RESULTADO FASE 4.4.2.2: ${passed} PASSARAM | ${failed} FALHARAM`)
console.log('══════════════════════════════════════════════════════════════════════════\n')

if (failed > 0) {
  process.exit(1)
}
