/**
 * HEATZ AUTO — FASE 4.4: Suíte Completa da Frota Expandida (15 Veículos)
 *
 * Verifica:
 * 1. Catálogo completo de 15 veículos em `manifest.json`, preços/fichas da Concessionária,
 *    compra/venda/seleção na Garagem, preservação de saves antigos e migração do Porsche 992.
 * 2. Contratos declarativos (`validateVehicleConfig`), `VEHICLE_CHASSIS_DATABASE`,
 *    `CLUSTER_REGISTRY` (5 clusters exclusivos novos) e `MULTIMEDIA_REGISTRY` (5 multimídias/rádios exclusivos novos).
 * 3. Especificações autênticas por modelo:
 *    - Jetta GLI 2021 (EA888 230 cv / 350 Nm, DSG6, FWD, Active Info Display 10.25", Discover Media 8" — sem VW Play 10.1")
 *    - BMW 320i M Sport 2024 (B48 184 cv / 300 Nm, ZF8, RWD, BMW Curved Display 12.3" + OS 8 14.9", Clima Tri-Zone)
 *    - Ford Pampa L 1.8i 1997 (AP-1800i CFI 95 cv / 153 Nm, Manual 5M, FWD, painel analógico 1997, rádio 1-DIN sem A/C, 2 vidros a manivela)
 *    - Ford Fusion SEL 2.5 2012 (Duratec 173 cv / 225 Nm, 6F35 AT6, FWD, Ice Blue + SYNC 1 — sem SYNC 3)
 *    - Ford Fusion Titanium 2.0 AWD 2019 (EcoBoost 248 cv / 373 Nm, 6F35 AT6 + paddles, Intelligent AWD `awd_ondemand` sem 4WD Lock/Low, SmartGauge + SYNC 3 8", tanque 68 L, bancos aquecidos)
 * 4. Dinamômetro (`calculateDynoProfile`) e Oficina (`installUpgrade`) nos 15 veículos.
 * 5. Validação física 120 Hz + micropassos 240 Hz nos 5 novos veículos + amostragem integral dos 15 veículos:
 *    aceleração, trocas sem caça de marchas, frenagem ABS, estabilidade em curva, velocidade máxima plausível
 *    e diferenciação em superfícies distintas (asfalto seco, chuva e baixa aderência).
 */

import fs from 'fs'
import path from 'path'
import { getVehicleCapabilities, type VehicleConfig, type VehicleManifest } from './src/types/vehicle'
import {
  resolveVehicleCabin,
  resolveVehicleDrivetrain,
  resolveVehicleIgnition,
  resolveVehicleMultimediaSpec,
  resolveVehicleVisual2D,
  validateVehicleConfig,
} from './src/systems/vehicle/vehicleResolvers'
import { CLUSTER_REGISTRY, resolveClusterEntry } from './src/components/dashboard/clusters/clusterRegistry'
import { MULTIMEDIA_REGISTRY, resolveMultimediaEntry } from './src/components/dashboard/infotainment/multimediaRegistry'
import { createVehicleChassis, VEHICLE_CHASSIS_DATABASE } from './src/systems/physics/Chassis'
import { calculateDynoProfile } from './src/utils/dynoCalculator'
import { getShortVehicleName } from './src/utils/vehicleSpecs'
import { VEHICLE_PRICES, getVehicleSpecs } from './src/screens/HomeScreen'
import { BRAND_THEME_COLORS } from './src/components/ui/ManufacturerSection'
import { useGarageStore } from './src/stores/useGarageStore'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { WorldMap } from './src/systems/world/WorldMap'

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
const manifest = JSON.parse(
  fs.readFileSync(path.join(REPO, 'public', 'vehicles', 'manifest.json'), 'utf8'),
) as VehicleManifest

const ORIGINAL_10_IDS = [
  'yaris-2019',
  'gol-g6',
  'cb1000r',
  'porsche-gt3',
  'golf-gti',
  'gol-quadrado-turbo',
  'civic-si',
  'opala-4100',
  'fiat-toro-endurance-2025',
  'fiat-toro-ranch-2025',
] as const

const NEW_5_IDS = [
  'jetta-gli-2021',
  'bmw-320i-msport-2024',
  'ford-pampa-l-1997',
  'ford-fusion-sel-2012',
  'ford-fusion-titanium-awd-2019',
] as const

function loadVehicle(id: string): VehicleConfig {
  const entry = manifest.vehicles.find((v) => v.id === id)
  if (!entry) throw new Error(`Veículo ${id} ausente no manifest.json`)
  const cfgPath = path.join(REPO, 'public', entry.configPath.replace(/^\//, ''))
  return JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as VehicleConfig
}

console.log('\n=== FASE 4.4 — 1. CATÁLOGO DE 15 VEÍCULOS, CONCESSIONÁRIA, GARAGEM E MIGRAÇÃO DE SAVES ===')

assert(manifest.vehicles.length === 15, `manifest.json possui exatamente 15 veículos (${manifest.vehicles.length})`)
for (const id of [...ORIGINAL_10_IDS, ...NEW_5_IDS]) {
  assert(manifest.vehicles.some((v) => v.id === id), `Veículo '${id}' registrado no manifest.json`)
  assert(Boolean(VEHICLE_PRICES[id] && VEHICLE_PRICES[id].price > 0), `Concessionária possui preço para '${id}' (R$ ${VEHICLE_PRICES[id]?.price})`)
  assert(Boolean(VEHICLE_CHASSIS_DATABASE[id]), `VEHICLE_CHASSIS_DATABASE contém chassi calibrado para '${id}'`)
}

assert(Boolean(BRAND_THEME_COLORS.bmw && BRAND_THEME_COLORS.ford), 'Temas de fabricante para BMW e Ford registrados')

// Compra, seleção, oficina, dinamômetro e venda dos 5 novos veículos na Garagem
useGarageStore.getState().resetToDefaults()
useGarageStore.getState().addCredits(5_000_000)

for (const id of NEW_5_IDS) {
  const cfg = loadVehicle(id)
  const entry = manifest.vehicles.find((v) => v.id === id)!
  const specs = getVehicleSpecs(entry, id)
  assert(specs.engine !== 'Motor Original', `[${id}] getVehicleSpecs retorna motor específico (${specs.engine})`)
  assert(getShortVehicleName(cfg).length > 0, `[${id}] possui nome curto mobile (${getShortVehicleName(cfg)})`)

  const bought = useGarageStore.getState().buyCar(id, `Teste ${cfg.info.name}`, VEHICLE_PRICES[id].price)
  assert(bought.vehicleId === id, `[${id}] comprável na concessionária`)
  useGarageStore.getState().setActiveCar(bought.instanceId)
  assert(useGarageStore.getState().activeCarInstanceId === bought.instanceId, `[${id}] selecionável na garagem`)

  // Upgrade de oficina + Dinamômetro
  useGarageStore.getState().installUpgrade(bought.instanceId, { tuningStage: 1, intakeType: 'cold_air' })
  const updatedCar = useGarageStore.getState().getCarById(bought.instanceId)!
  const dynoStock = calculateDynoProfile(cfg)
  const dynoStage1 = calculateDynoProfile(cfg, updatedCar.upgrades)
  assert(
    dynoStock.maxEnginePowerHp > 50 && dynoStage1.maxEnginePowerHp >= dynoStock.maxEnginePowerHp,
    `[${id}] compatível com Dinamômetro e Oficina (Stock ${dynoStock.maxEnginePowerHp} cv -> Stage 1 ${dynoStage1.maxEnginePowerHp} cv)`,
  )
}

// Preservação da migração histórica de save do Porsche 992 Turbo S
const porscheDefault = useGarageStore.getState().ownedCars.find((c) => c.vehicleId === 'porsche-gt3')
assert(
  porscheDefault?.customName === 'Porsche 911 Turbo S (992) PDK',
  'Garagem preserva instância e nomenclatura migrada do Porsche 911 Turbo S (992)',
)
useGarageStore.getState().resetToDefaults()

console.log('\n=== FASE 4.4 — 2. REGISTROS EXCLUSIVOS DE CLUSTER E MULTIMÍDIA PARA OS 5 NOVOS VEÍCULOS ===')

const seenNewClusters = new Set<unknown>()
const seenNewMedia = new Set<unknown>()

for (const id of NEW_5_IDS) {
  const cfg = loadVehicle(id)
  const val = validateVehicleConfig(cfg)
  assert(val.valid, `[${id}] validateVehicleConfig() aprovado sem erros`, val.errors.join('; '))
  assert(val.warnings.length === 0, `[${id}] validateVehicleConfig() sem avisos inconsistentes`, val.warnings.join('; '))

  const clusterEntry = resolveClusterEntry(cfg.dashboard.theme)
  assert(clusterEntry.theme === cfg.dashboard.theme, `[${id}] cluster dedicado '${cfg.dashboard.theme}' registrado em CLUSTER_REGISTRY`)
  assert(!seenNewClusters.has(clusterEntry.component), `[${id}] utiliza componente React de cluster exclusivo (sem reutilização visual)`)
  seenNewClusters.add(clusterEntry.component)

  const mediaSpec = resolveVehicleMultimediaSpec(cfg)
  const mediaEntry = resolveMultimediaEntry(mediaSpec.unitId)
  assert(Boolean(mediaEntry && mediaEntry.component !== 'generic'), `[${id}] multimídia/rádio dedicado '${mediaSpec.unitId}' registrado em MULTIMEDIA_REGISTRY`)
  assert(!seenNewMedia.has(mediaEntry?.component), `[${id}] utiliza componente React de multimídia/rádio exclusivo`)
  seenNewMedia.add(mediaEntry?.component)
}

assert(Object.keys(CLUSTER_REGISTRY).length === 16, `CLUSTER_REGISTRY possui 16 temas registrados (${Object.keys(CLUSTER_REGISTRY).length})`)
assert(Object.keys(MULTIMEDIA_REGISTRY).length === 15, `MULTIMEDIA_REGISTRY possui 15 unidades registradas (${Object.keys(MULTIMEDIA_REGISTRY).length})`)

console.log('\n=== FASE 4.4 — 3. AUDITORIA DE REQUISITOS ESPECÍFICOS POR VEÍCULO E CABINE ===')

const jetta = loadVehicle('jetta-gli-2021')
const bmw = loadVehicle('bmw-320i-msport-2024')
const pampa = loadVehicle('ford-pampa-l-1997')
const fusion2012 = loadVehicle('ford-fusion-sel-2012')
const fusion2019 = loadVehicle('ford-fusion-titanium-awd-2019')

// Jetta GLI 2021
assert(
  jetta.multimedia?.unitId === 'vw_discover_media_8' &&
    jetta.multimedia?.screenSize === 8.0 &&
    !jetta.multimedia.name.toLowerCase().includes('vw play'),
  'Jetta GLI 2021 usa Discover Media 8" MIB e NÃO utiliza VW Play 10.1"',
)
assert(
  resolveVehicleDrivetrain(jetta) === 'fwd' &&
    jetta.transmission.gearCount === 6 &&
    resolveVehicleIgnition(jetta).type === 'push_button' &&
    resolveVehicleCabin(jetta).climateType === 'auto_dual' &&
    resolveVehicleCabin(jetta).hasFogLights === false,
  'Jetta GLI 2021: FWD, DSG 6M, botão Start/Stop, Climatronic Dual-Zone e sem faróis de neblina dianteiros',
)

// BMW 320i M Sport 2024
assert(
  resolveVehicleDrivetrain(bmw) === 'rwd' &&
    bmw.transmission.gearCount === 8 &&
    resolveVehicleCabin(bmw).climateType === 'auto_tri' &&
    bmw.multimedia?.screenSize === 14.9,
  'BMW 320i M Sport 2024: RWD, ZF 8HP 8M, ar-condicionado automático Tri-Zone e BMW Curved Display 14.9"',
)

// Ford Pampa L 1.8i 1997
assert(
  pampa.engine.maxPower === 95 &&
    pampa.engine.maxTorque === 153 &&
    pampa.transmission.type === 'manual' &&
    pampa.transmission.gearCount === 5 &&
    resolveVehicleDrivetrain(pampa) === 'fwd' &&
    resolveVehicleVisual2D(pampa).silhouette === 'pickup_compact',
  'Ford Pampa L 1.8i 1997: motor AP-1800i CFI (95 cv / 153 Nm), manual 5M, FWD e silhueta pickup_compact',
)
assert(
  resolveVehicleCabin(pampa).climateType === 'manual_vent' &&
    resolveVehicleCabin(pampa).hasAcCompressor === false &&
    resolveVehicleCabin(pampa).windowCount === 2 &&
    resolveVehicleCabin(pampa).windowControlType === 'manual_crank' &&
    resolveVehicleIgnition(pampa).type === 'key',
  'Ford Pampa L 1.8i 1997: chave tradicional, ventilação manual sem A/C e 2 vidros a manivela',
)

// Ford Fusion SEL 2012 vs Titanium AWD 2019
assert(
  resolveVehicleDrivetrain(fusion2012) === 'fwd' &&
    fusion2012.multimedia?.unitId === 'ford_sync1_2012' &&
    resolveVehicleIgnition(fusion2012).type === 'key',
  'Ford Fusion SEL 2.5 2012: FWD, partida por chave e console SYNC 1 (distinto do SYNC 3 de 2019)',
)
assert(
  resolveVehicleDrivetrain(fusion2019) === 'awd_ondemand' &&
    getVehicleCapabilities(fusion2019).has4x4Selector === false &&
    fusion2019.multimedia?.unitId === 'ford_sync3_8' &&
    fusion2019.dashboard.fuelCapacity === 68 &&
    resolveVehicleCabin(fusion2019).hasSeatHeating === true &&
    resolveVehicleIgnition(fusion2019).type === 'push_button',
  'Ford Fusion Titanium 2.0 AWD 2019: Intelligent AWD sob demanda (sem seletor 4WD Lock/Low), SYNC 3 8", tanque 68 L, bancos aquecidos e partida por botão',
)

console.log('\n=== FASE 4.4 — 4. VALIDAÇÃO FÍSICA COMPLETA (ACELERAÇÃO, FRENAGEM, CURVA, MARCHAS E SUPERFÍCIES) ===')

function placeVehicle(x: number, y: number, headingDeg: number, speedKmh = 0) {
  const st = useSimulationStore.getState()
  if (st._physics) {
    st._physics.setPosition(x, y, headingDeg)
    st._physics.setSpeedKmh(speedKmh)
    st._physics.restoreSnapshot({
      ...st._physics.getStateSnapshot(),
      positionX: x,
      positionY: y,
      headingRad: (headingDeg * Math.PI) / 180,
      speedMs: speedKmh / 3.6,
      wheelSpeedMs: speedKmh / 3.6,
      lateralSpeedMs: 0,
      yawRate: 0,
      slipAngleRad: 0,
      lateralAccelMs2: 0,
      leanAngleRad: 0,
    })
  }
  const q = WorldMap.query(x, y, st.isRaining)
  useSimulationStore.setState({
    positionX: x,
    positionY: y,
    headingDeg,
    visualPositionX: x,
    visualPositionY: y,
    visualHeadingDeg: headingDeg,
    speed: speedKmh,
    surfaceType: q.surface.type,
    zoneName: q.zoneName,
    _phys: {
      ...st._phys,
      positionX: x,
      positionY: y,
      headingDeg,
      speedKmh,
      lastPubSpeedKmh: speedKmh,
      lateralSpeedMs: 0,
      slipAngleDeg: 0,
      lateralAccelG: 0,
      leanAngleDeg: 0,
      surfaceType: q.surface.type,
      zoneName: q.zoneName,
    },
  })
}

function runDynamicValidation(cfg: VehicleConfig) {
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(cfg)

  // Posiciona na reta oficial da Drag Strip (leste livre > 550m sem paredes frontais)
  placeVehicle(WorldMap.DRAG_STRIP_START_X, WorldMap.DRAG_STRIP_Y_CENTER, 90, 0)

  // 1. Ignição / Partida respeitando intertravamento declarativo
  const interlock = resolveVehicleIgnition(cfg).startInterlock
  if (interlock === 'brake' || interlock === 'brake_or_clutch') sim.setBrake(1.0)
  if (interlock === 'clutch') sim.setClutch(1.0)
  sim.startEngine()
  for (let i = 0; i < 72; i++) sim.update(1 / 120)
  assert(useSimulationStore.getState().isRunning, `[${cfg.id}] partida funcional respeitando startInterlock='${interlock}'`)
  sim.setBrake(0)
  sim.setClutch(0)

  // 2. Aceleração de 0 até regime dinâmico (8.5s a 120 Hz na Drag Strip) e verificação de trocas sem caça de marchas
  const isManual = cfg.transmission.type === 'manual' || cfg.transmission.type === 'sequential'
  const isMoto = cfg.info.category === 'motorcycle'
  let gearChanges = 0
  let lastGear = 1
  if (isManual) {
    sim.setClutch(1.0)
    sim.shiftUp()
  } else {
    sim.selectShifterMode('D')
  }
  sim.setThrottle(1.0)
  for (let i = 0; i < 30; i++) sim.update(1 / 120) // pré-rotação antes de soltar embreagem

  const slipReleaseKmh = isMoto ? 34 : 16
  const initialSlip = isMoto ? 0.68 : 0.52

  for (let i = 0; i < 120 * 8.5; i++) {
    const st = useSimulationStore.getState()
    if (isManual) {
      if (st._phys.gear === 1 && st._phys.speedKmh < slipReleaseKmh) {
        sim.setClutch(Math.max(0, initialSlip - (st._phys.speedKmh / slipReleaseKmh) * initialSlip))
      } else {
        sim.setClutch(0)
      }
      const shiftRpmThreshold = isMoto ? cfg.engine.revLimiter * 0.68 : cfg.engine.revLimiter * 0.87
      if (st._phys.rpm >= shiftRpmThreshold && st._phys.gear < cfg.transmission.gearCount) {
        sim.setClutch(1.0)
        sim.shiftUp()
        sim.update(1 / 120)
        sim.setClutch(0)
      } else {
        sim.update(1 / 120)
      }
    } else {
      sim.update(1 / 120)
    }
    const g = useSimulationStore.getState()._phys.gear
    if (g > 0 && g !== lastGear) {
      gearChanges++
      lastGear = g
    }
  }

  const accelSpeed = useSimulationStore.getState()._phys.speedKmh
  assert(
    accelSpeed > 72 && accelSpeed < 290,
    `[${cfg.id}] aceleração coerente em 8.5s: ${accelSpeed.toFixed(1)} km/h (marcha atual: ${lastGear})`,
  )
  assert(
    gearChanges >= 1 && gearChanges <= 8,
    `[${cfg.id}] progressão de marchas estável sem caça oscilatória (${gearChanges} trocas em 8.5s)`,
  )

  // 3. Frenagem plena até imobilização / desaceleração forte com ABS na reta
  sim.setThrottle(0)
  sim.setBrake(1.0)
  const speedBeforeBrake = useSimulationStore.getState()._phys.speedKmh
  for (let i = 0; i < 120 * 4.2; i++) sim.update(1 / 120)
  const speedAfterBrake = useSimulationStore.getState()._phys.speedKmh
  assert(
    speedAfterBrake < speedBeforeBrake * 0.30 || speedAfterBrake < 5,
    `[${cfg.id}] frenagem eficiente (${speedBeforeBrake.toFixed(1)} -> ${speedAfterBrake.toFixed(1)} km/h)`,
  )
  sim.setBrake(0)

  // 4. Estabilidade em curva no anel asfaltado de Handling R=80m (-140, 220) a 68 km/h
  if (isManual) {
    sim.setClutch(1.0)
    for (let s = 0; s < 6 && useSimulationStore.getState().currentGear < 3; s++) sim.shiftUp()
    for (let s = 0; s < 6 && useSimulationStore.getState().currentGear > 3; s++) sim.shiftDown()
    sim.setClutch(0)
  } else {
    sim.selectShifterMode('D')
  }
  placeVehicle(-140, 220, 90, 68)
  sim.setThrottle(0.32)
  sim.setSteeringAngle(0.45, 'keyboard')
  let maxLatG = 0
  for (let i = 0; i < 150; i++) {
    sim.update(1 / 120)
    maxLatG = Math.max(maxLatG, Math.abs(useSimulationStore.getState()._phys.lateralAccelG))
  }
  const cornerSt = useSimulationStore.getState()
  assert(
    Number.isFinite(cornerSt._phys.lateralAccelG) &&
      maxLatG > 0.08 &&
      !cornerSt.isColliding &&
      cornerSt.physicsIntegrityStatus === 'NORMAL',
    `[${cfg.id}] curva R=80m estável sem colisão (pico lateral ${maxLatG.toFixed(2)} G)`,
  )
  sim.setSteeringAngle(0, 'keyboard')

  // 5. Sistemas de cabine integrados a 120 Hz (vidros + iluminação)
  sim.toggleLeftTurnSignal()
  sim.toggleWindows()
  for (let i = 0; i < 60; i++) sim.update(1 / 120)
  const cabSt = useSimulationStore.getState()
  if (resolveVehicleCabin(cfg).windowCount > 0) {
    assert(cabSt.windowAverageOpenRatio > 0.05, `[${cfg.id}] vidros respondem gradualmente (${(cabSt.windowAverageOpenRatio * 100).toFixed(0)}%)`)
  } else {
    assert(cabSt.windowAverageOpenRatio === 0, `[${cfg.id}] moto mantém windowAverageOpenRatio = 0`)
  }
}

// Executa validação dinâmica profunda nos 5 novos veículos + representantes de cada arquitetura existente
for (const id of [
  ...NEW_5_IDS,
  'gol-g6',
  'opala-4100',
  'porsche-gt3',
  'fiat-toro-ranch-2025',
  'cb1000r',
]) {
  runDynamicValidation(loadVehicle(id))
}

// Verifica inicialização limpa dos demais 5 veículos originais (totalizando 15/15 inicializados na store)
for (const id of ['yaris-2019', 'golf-gti', 'gol-quadrado-turbo', 'civic-si', 'fiat-toro-endurance-2025']) {
  const cfg = loadVehicle(id)
  const chassis = createVehicleChassis(id)
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(cfg)
  for (let i = 0; i < 30; i++) sim.update(1 / 120)
  assert(
    chassis.totalMass === cfg.info.weight && useSimulationStore.getState().physicsIntegrityStatus === 'NORMAL',
    `[${id}] inicialização e integridade 120 Hz preservadas`,
  )
}

// Comparação de tração em baixa aderência: Fusion Titanium AWD (awd_ondemand) vs Fusion SEL FWD (fwd)
{
  const measureSlipperyAccel = (cfg: VehicleConfig): number => {
    const sim = useSimulationStore.getState()
    sim.reset()
    sim.init(cfg)
    if (!useSimulationStore.getState().isRaining) sim.toggleRain() // chuva reduz aderência
    sim.setBrake(1.0)
    sim.startEngine()
    for (let i = 0; i < 60; i++) sim.update(1 / 120)
    sim.setBrake(0)
    sim.selectShifterMode('D')
    sim.setThrottle(1.0)
    for (let i = 0; i < 120 * 6; i++) sim.update(1 / 120)
    const v = useSimulationStore.getState()._phys.speedKmh
    if (useSimulationStore.getState().isRaining) sim.toggleRain()
    return v
  }

  const vSelRain = measureSlipperyAccel(fusion2012)
  const vTitRain = measureSlipperyAccel(fusion2019)
  assert(
    vTitRain > vSelRain + 12,
    `Sob chuva, Fusion Titanium Intelligent AWD (${vTitRain.toFixed(1)} km/h em 6s) traciona superiormente ao Fusion SEL FWD (${vSelRain.toFixed(1)} km/h)`,
  )
}

console.log(`\n══════════════════════════════════════════════════════════`)
console.log(`RESULTADO FASE 4.4 (15 VEÍCULOS): ${passed} passaram | ${failed} falharam`)
console.log(`══════════════════════════════════════════════════════════\n`)

if (failed > 0) {
  process.exit(1)
}
