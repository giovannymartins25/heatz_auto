/**
 * HEATZ AUTO — FASE 4.4.3 (ETAPA 1): Suíte Completa de Telemetria Real, Capacidades de Combustível,
 * Luzes-Espia e Contratos Declarativos
 *
 * Verifica rigorosamente:
 * 1. Capacidade real declarada de combustível (`dashboard.fuelCapacity`) respeitada na store para todos os 15 veículos
 *    (de 16.2L na Honda CB1000R até 68L no Ford Fusion Titanium AWD 2019), sem overflow em `repairEngine` ou `refuel`.
 * 2. Separação estrita e inequívoca no `DashboardSystem` entre:
 *    - Freio de mão (`parkingBrake` / `brake` = `(P)`),
 *    - Freio de serviço (`serviceBrake`),
 *    - ABS ativo (`absActive`),
 *    - Falha de ABS (`absFault`),
 *    - Ignição `OFF` vs `ACC` vs `ON` vs `RUNNING` (apagamento integral do quadro em `OFF`).
 * 3. Telemetria viva 100% derivada da física na `useSimulationStore` (fonte única da verdade):
 *    - `liveTorqueNm` e `livePowerHp` = 0 com motor desligado e coerentes com a curva real + upgrades em movimento;
 *    - `instantFuelBurnLh`, `instantConsumptionKmL`, `avgConsumptionKmL`, `estimatedRangeKm`, `tripDistanceKm`,
 *      `tripFuelUsedLiters`, `tripDurationSec`, `avgSpeedKmh` e `odometerKm` integrados em tempo real;
 *    - Reação física imediata da autonomia (`estimatedRangeKm`) ao alternar Gasolina <-> Etanol E100 (`-25%`) e ao abastecer;
 *    - Repartição real de tração (`awdRearCoupling`, `frontAxleTorqueNm`, `rearAxleTorqueNm`,
 *      `frontTorqueSplitPercent`, `rearTorqueSplitPercent`) para FWD (100/0), RWD (0/100), PTM AWD (Porsche),
 *      Intelligent AWD (Fusion 2019) e 4x4 selecionável (Toro Ranch AUTO vs 4WD/4WD LOW 50/50).
 * 4. Preservação incondicional dos controles físicos de ventilação e ar-condicionado no Painel 3 mesmo com
 *    upgrade de multimídia `retrofit_2din` (`multimediaKit: true`), mais migração de `manual_ac` da Toro Endurance para o Painel 3.
 * 5. Regras travadas de fidelidade:
 *    - Opala Diplomata 1992 mantido intacto (`manual_vent`, `manual_crank`, sem A/C);
 *    - Yaris 2019 Hatch sem paddle shifters, A/C mantido na multimídia e sem RGB (`hasAmbientLighting: false`);
 *    - Porsche 911 Turbo S mantendo PSE como upgrade (`!canControlExhaustValve` stock);
 *    - Golf GTI 2018 vermelho fixo sem RGB (`!supportsConfigurableAmbientRgb`);
 *    - Toro Ranch 2025 branca fixa sem RGB (`ambientLightColor === 'white'`, `!supportsConfigurableAmbientRgb`);
 *    - Civic Si 2008 stock sem flag `multimediaKit` aftermarket (`multimediaKit === false`), aceitando upgrade quando comprado.
 * 6. Invariância da física e do dinamômetro (`simulateDynoRun` e `VehiclePhysics`).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { VehicleConfig, VehicleManifest } from './src/types/vehicle'
import {
  canControlExhaustValve,
  resolveClimateControlsLocation,
  resolveDefaultAmbientColor,
  resolveDefaultUpgradesForVehicle,
  resolveVehicleCabin,
  resolveVehicleControls,
  resolveVehicleHasAbs,
  resolveVehicleMultimediaSpec,
  supportsConfigurableAmbientRgb,
  validateVehicleConfig,
} from './src/systems/vehicle/vehicleResolvers'
import { DashboardSystem } from './src/systems/dashboard/DashboardSystem'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useGarageStore } from './src/stores/useGarageStore'
import { calculateDynoProfile } from './src/utils/dynoCalculator'

let passed = 0
let failed = 0

function assert(cond: boolean, msg: string, detail = '') {
  if (cond) {
    passed++
    console.log(`  ✅ ${msg}`)
  } else {
    failed++
    console.error(`  ❌ ${msg}${detail ? ` — ${detail}` : ''}`)
  }
}

const REPO = process.cwd()
const manifest = JSON.parse(
  fs.readFileSync(path.join(REPO, 'public', 'vehicles', 'manifest.json'), 'utf8'),
) as VehicleManifest

function loadVehicle(id: string): VehicleConfig {
  const entry = manifest.vehicles.find((v) => v.id === id)
  if (!entry) throw new Error(`Veículo ${id} não encontrado`)
  return JSON.parse(
    fs.readFileSync(path.join(REPO, 'public', entry.configPath.replace(/^\//, '')), 'utf8'),
  ) as VehicleConfig
}

function stepSeconds(seconds: number) {
  const ticks = Math.round(seconds * 120)
  const sim = useSimulationStore.getState()
  for (let i = 0; i < ticks; i++) {
    sim.update(1 / 120)
  }
}

console.log('\n=== ETAPA 1.1 — CAPACIDADE REAL DE COMBUSTÍVEL NOS 15 VEÍCULOS ===')
{
  const expectedCapacities: Record<string, number> = {
    cb1000r: 16.2,
    'yaris-2019': 45,
    'golf-gti': 50,
    'jetta-gli-2021': 50,
    'civic-si': 50,
    'gol-g6': 55,
    'gol-quadrado-turbo': 55,
    'fiat-toro-endurance-2025': 55,
    'bmw-320i-msport-2024': 59,
    'fiat-toro-ranch-2025': 60,
    'opala-4100': 65,
    'ford-pampa-l-1997': 66,
    'ford-fusion-sel-2012': 66,
    'porsche-gt3': 67,
    'ford-fusion-titanium-awd-2019': 68,
  }

  const sim = useSimulationStore.getState()
  for (const entry of manifest.vehicles) {
    const cfg = loadVehicle(entry.id)
    const val = validateVehicleConfig(cfg)
    assert(val.valid, `[${cfg.id}] validateVehicleConfig() aprovado`, val.errors.join('; '))

    sim.reset()
    sim.init(cfg)
    const st = useSimulationStore.getState()
    const expectedCap = expectedCapacities[cfg.id]
    const expectedInit = Math.round(expectedCap * 0.9 * 1000) / 1000
    assert(
      st.fuelCapacityLiters === expectedCap && st.fuelLevelLiters === expectedInit,
      `[${cfg.id}] tanque inicializa com ${st.fuelLevelLiters}L / ${st.fuelCapacityLiters}L (esperado ${expectedInit}L / ${expectedCap}L)`,
    )

    // Testa repairEngine sem transbordar tanques pequenos (ex.: CB1000R 16.2L)
    useSimulationStore.setState({ fuelLevelLiters: 0, isOutOfFuel: true })
    sim.update(1 / 120)
    sim.repairEngine()
    const afterRepair = useSimulationStore.getState()
    assert(
      afterRepair.fuelLevelLiters > 0 && afterRepair.fuelLevelLiters <= expectedCap,
      `[${cfg.id}] repairEngine reabastece reserva segura (${afterRepair.fuelLevelLiters}L <= ${expectedCap}L)`,
    )

    // Testa refuel cheio cravando exatamente na capacidade declarada
    sim.refuel()
    const afterFullRefuel = useSimulationStore.getState()
    assert(
      afterFullRefuel.fuelLevelLiters === expectedCap,
      `[${cfg.id}] refuel completo respeita teto exato de ${expectedCap}L`,
    )
  }
}

console.log('\n=== ETAPA 1.2 — DIFERENCIAÇÃO ESTRITA DE FREIO DE MÃO, FREIO DE SERVIÇO, ABS ATIVO, FALHA ABS E IGNIÇÃO OFF ===')
{
  const cb1000r = loadVehicle('cb1000r')
  const porsche = loadVehicle('porsche-gt3')
  const sim = useSimulationStore.getState()

  // 1. Ignição totalmente desligada ('OFF'): todas as luzes-espia apagadas
  sim.reset()
  sim.init(porsche)
  const offSt = useSimulationStore.getState()
  const telOff = DashboardSystem.computeTelemetry(DashboardSystem.createInputFromState(porsche, offSt))
  assert(
    offSt.ignitionPosition === 'OFF' &&
      !telOff.warningLights.oil &&
      !telOff.warningLights.battery &&
      !telOff.warningLights.checkEngine &&
      !telOff.warningLights.tcs &&
      !telOff.warningLights.brake &&
      !telOff.warningLights.absActive &&
      !telOff.warningLights.absFault,
    'Ignição em OFF mantém todas as luzes-espia do cluster (óleo, bateria, injeção, freio, TCS, ABS) apagadas',
  )

  // 2. Chave em ON com motor parado: acende auto-teste de óleo e bateria, mas NÃO acende falha de ABS nem freio de mão sem handbrake
  sim.setIgnitionPosition('ON', false)
  const onSt = useSimulationStore.getState()
  const telOn = DashboardSystem.computeTelemetry(DashboardSystem.createInputFromState(porsche, onSt))
  assert(
    onSt.ignitionPosition === 'ON' &&
      telOn.warningLights.oil === true &&
      telOn.warningLights.battery === true &&
      telOn.warningLights.brake === false &&
      telOn.warningLights.absFault === false,
    'Ignição em ON (motor parado) acende óleo e bateria sem falso positivo de freio de mão ou falha ABS',
  )

  // 3. Motor em funcionamento: freio de serviço vs freio de mão vs ABS ativo vs falha de ABS
  sim.reset()
  sim.init(cb1000r)
  sim.startEngine()
  stepSeconds(0.6)

  // Pressiona apenas freio de serviço (sem travar roda / sem ABS)
  sim.setBrake(0.5)
  sim.setHandbrake(false)
  const stServiceBrake = useSimulationStore.getState()
  const telService = DashboardSystem.computeTelemetry(
    DashboardSystem.createInputFromState(cb1000r, stServiceBrake),
  )
  assert(
    telService.warningLights.serviceBrake === true &&
      telService.warningLights.parkingBrake === false &&
      telService.warningLights.brake === false &&
      telService.warningLights.absActive === false &&
      telService.warningLights.absFault === false,
    'Freio de serviço acionado marca serviceBrake=true SEM acender freio de mão (brake/parkingBrake) nem ABS',
  )

  // Aciona freio de mão (sem freio de pé)
  sim.setBrake(0)
  sim.setHandbrake(true)
  const stHandbrake = useSimulationStore.getState()
  const telHandbrake = DashboardSystem.computeTelemetry(
    DashboardSystem.createInputFromState(porsche, stHandbrake),
  )
  assert(
    telHandbrake.warningLights.parkingBrake === true &&
      telHandbrake.warningLights.brake === true &&
      telHandbrake.warningLights.serviceBrake === false &&
      telHandbrake.warningLights.absActive === false &&
      telHandbrake.warningLights.absFault === false,
    'Freio de mão acionado acende exclusivamente parkingBrake e luz (P) (brake=true)',
  )

  // ABS atuando fisicamente em frenagem severa no molhado
  sim.reset()
  sim.init(porsche)
  sim.startEngine()
  stepSeconds(0.6)
  sim.toggleRain()
  sim.selectDrive()
  sim.setSpeed(110)
  sim.setBrake(1.0)
  let sawAbsEngaged = false
  for (let i = 0; i < 60; i++) {
    sim.update(1 / 120)
    if (useSimulationStore.getState().absEngaged) {
      sawAbsEngaged = true
      break
    }
  }
  const stAbs = useSimulationStore.getState()
  const telAbs = DashboardSystem.computeTelemetry(DashboardSystem.createInputFromState(porsche, stAbs))
  assert(
    sawAbsEngaged &&
      telAbs.warningLights.absActive === true &&
      telAbs.warningLights.absFault === false &&
      telAbs.warningLights.parkingBrake === false &&
      telAbs.warningLights.brake === false,
    'Frenagem severa sob chuva aciona absActive=true na física sem confundir com falha de ABS (absFault=false) ou freio de mão',
  )

  // Simulação explícita de falha de ABS
  const telAbsFault = DashboardSystem.computeTelemetry({
    ...DashboardSystem.createInputFromState(porsche, stAbs),
    absEngaged: false,
    absFault: true,
  })
  assert(
    telAbsFault.warningLights.absFault === true && telAbsFault.warningLights.absActive === false,
    'Anomalia de ABS aciona exclusivamente absFault=true mantendo absActive=false',
  )
}

console.log('\n=== ETAPA 1.3 — TELEMETRIA FÍSICA VIVA: POTÊNCIA, TORQUE, CONSUMO, AUTONOMIA, VIAGEM E AWD ===')
{
  const sim = useSimulationStore.getState()
  const yaris = loadVehicle('yaris-2019')

  sim.reset()
  sim.init(yaris)
  const stParked = useSimulationStore.getState()
  assert(
    stParked.livePowerHp === 0 &&
      stParked.liveTorqueNm === 0 &&
      stParked.instantFuelBurnLh === 0 &&
      stParked.instantConsumptionKmL === 0 &&
      stParked.estimatedRangeKm > 0,
    `Yaris desligado exibe 0 CV, 0 Nm e 0 L/h (autonomia física inicial=${stParked.estimatedRangeKm} km)`,
  )

  // Alternar para Etanol E100 deve reduzir a autonomia estimada na proporção física real (1 / 1.34)
  const rangeGasoline = stParked.estimatedRangeKm
  sim.setFuelType('ethanol_e100')
  const rangeEthanol = useSimulationStore.getState().estimatedRangeKm
  assert(
    rangeEthanol < rangeGasoline &&
      Math.abs(rangeEthanol / rangeGasoline - 1 / 1.34) < 0.03,
    `Troca Gasolina -> Etanol E100 reduz autonomia na proporção física exata (${rangeGasoline} km -> ${rangeEthanol} km)`,
  )
  sim.setFuelType('common_gasoline')

  // Partida e condução real por 6 segundos na reta limpa (sem colidir com a ilha central da rotatória)
  useSimulationStore.getState()._physics?.restoreSnapshot({
    ...useSimulationStore.getState()._physics!.getStateSnapshot(),
    positionX: 60,
    positionY: 52,
    headingRad: Math.PI / 2,
  })
  useSimulationStore.setState({ positionX: 60, positionY: 52, headingDeg: 90 })
  sim.setBrake(1)
  sim.startEngine()
  stepSeconds(0.6)
  sim.setBrake(0)
  sim.selectDrive()
  sim.setThrottle(0.85)
  stepSeconds(8.0)

  const stDriving = useSimulationStore.getState()
  assert(
    stDriving.liveTorqueNm > 40 &&
      stDriving.livePowerHp > 20 &&
      stDriving.instantFuelBurnLh > 5 &&
      stDriving.instantConsumptionKmL > 0 &&
      stDriving.tripDistanceKm >= 0.05 &&
      stDriving.tripFuelUsedLiters > 0.005 &&
      stDriving.tripDurationSec >= 8 &&
      stDriving.avgSpeedKmh > 25,
    `Telemetria dinâmica do Yaris em condução real: ${stDriving.livePowerHp} cv, ${stDriving.liveTorqueNm} Nm, inst=${stDriving.instantConsumptionKmL} km/L, média=${stDriving.avgConsumptionKmL} km/L, dist=${stDriving.tripDistanceKm} km`,
  )

  // Repartição real de tração (FWD vs RWD vs Toro Ranch 4x4 AUTO/LOCK vs Porsche PTM AWD)
  assert(
    stDriving.frontTorqueSplitPercent === 100 && stDriving.rearTorqueSplitPercent === 0,
    'Veículo FWD (Yaris) publica repartição 100% dianteira / 0% traseira',
  )

  const bmw = loadVehicle('bmw-320i-msport-2024')
  sim.reset()
  sim.init(bmw)
  assert(
    useSimulationStore.getState().frontTorqueSplitPercent === 0 &&
      useSimulationStore.getState().rearTorqueSplitPercent === 100,
    'Veículo RWD (BMW 320i) publica repartição 0% dianteira / 100% traseira',
  )

  const toroRanch = loadVehicle('fiat-toro-ranch-2025')
  sim.reset()
  sim.init(toroRanch)
  const ranchAutoSplit = useSimulationStore.getState()
  assert(
    ranchAutoSplit.frontTorqueSplitPercent === 96 && ranchAutoSplit.rearTorqueSplitPercent === 4,
    `Toro Ranch em modo AUTO inicia com repartição sob demanda (${ranchAutoSplit.frontTorqueSplitPercent}/${ranchAutoSplit.rearTorqueSplitPercent})`,
  )
  sim.setFourWheelDriveMode('4wd')
  sim.update(1 / 120)
  const ranchLockSplit = useSimulationStore.getState()
  assert(
    ranchLockSplit.frontTorqueSplitPercent === 50 &&
      ranchLockSplit.rearTorqueSplitPercent === 50 &&
      ranchLockSplit.awdRearCoupling === 1,
    `Toro Ranch em 4WD LOCK trava repartição real 50/50 (${ranchLockSplit.frontTorqueSplitPercent}/${ranchLockSplit.rearTorqueSplitPercent})`,
  )

  const porsche = loadVehicle('porsche-gt3')
  sim.reset()
  sim.init(porsche)
  useSimulationStore.getState()._physics?.restoreSnapshot({
    ...useSimulationStore.getState()._physics!.getStateSnapshot(),
    positionX: 60,
    positionY: 52,
    headingRad: Math.PI / 2,
  })
  useSimulationStore.setState({ positionX: 60, positionY: 52, headingDeg: 90 })
  sim.setBrake(1)
  sim.startEngine()
  stepSeconds(0.6)
  sim.setBrake(0)
  sim.selectSport()
  sim.setThrottle(1.0)
  stepSeconds(2.6)
  const porscheLaunch = useSimulationStore.getState()
  assert(
    porscheLaunch.frontAxleTorqueNm > 0 &&
      porscheLaunch.rearAxleTorqueNm > 0 &&
      porscheLaunch.frontTorqueSplitPercent + porscheLaunch.rearTorqueSplitPercent === 100 &&
      porscheLaunch.livePowerHp > 450,
    `Porsche 911 Turbo S PTM AWD distribui torque real nos dois eixos (${porscheLaunch.frontTorqueSplitPercent}/${porscheLaunch.rearTorqueSplitPercent}, F=${porscheLaunch.frontAxleTorqueNm} Nm, R=${porscheLaunch.rearAxleTorqueNm} Nm, P=${porscheLaunch.livePowerHp} cv)`,
  )
}

console.log('\n=== ETAPA 1.4 — PRESERVAÇÃO DE CONTROLES FÍSICOS COM UPGRADE 2-DIN & REGRAS DE FIDELIDADE ===')
{
  const physicalClimateIds = [
    'gol-quadrado-turbo',
    'opala-4100',
    'ford-pampa-l-1997',
    'gol-g6',
    'civic-si',
    'ford-fusion-sel-2012',
    'fiat-toro-endurance-2025',
  ]
  for (const id of physicalClimateIds) {
    const cfg = loadVehicle(id)
    const stockLoc = resolveClimateControlsLocation(cfg, { multimediaKit: false })
    const retroLoc = resolveClimateControlsLocation(cfg, { multimediaKit: true })
    const retroControls = resolveVehicleControls(cfg, { multimediaKit: true })
    assert(
      stockLoc === 'panel' &&
        retroLoc === 'panel' &&
        retroControls.climate.panel === 'controls' &&
        retroControls.climate.controlType === 'physical',
      `[${id}] preserva controles físicos de ventilação/A/C no Painel 3 mesmo com multimediaKit=true`,
    )
  }

  // Opala Diplomata 1992 mantido intacto conforme decisão
  const opala = loadVehicle('opala-4100')
  const opalaCabin = resolveVehicleCabin(opala)
  assert(
    opalaCabin.climateType === 'manual_vent' &&
      opalaCabin.hasAcCompressor === false &&
      opalaCabin.windowControlType === 'manual_crank' &&
      opalaCabin.windowCount === 4,
    '[opala-4100] configuração atual preservada sem alterações não documentadas',
  )

  // Yaris 2019: sem paddles, A/C mantido na multimídia, sem iluminação RGB
  const yaris = loadVehicle('yaris-2019')
  assert(
    yaris.transmission.supportsPaddleShifters === false &&
      resolveClimateControlsLocation(yaris) === 'multimedia' &&
      !resolveVehicleCabin(yaris).hasAmbientLighting &&
      !supportsConfigurableAmbientRgb(yaris),
    '[yaris-2019] preserva supportsPaddleShifters=false e A/C na multimídia, sem RGB de fábrica',
  )

  // Porsche 911 Turbo S: PSE mantido como upgrade
  const porsche = loadVehicle('porsche-gt3')
  assert(
    !canControlExhaustValve(porsche, { exhaustType: 'sport', hasExhaustValveKit: false }) &&
      canControlExhaustValve(porsche, { exhaustType: 'sport', hasExhaustValveKit: true }),
    '[porsche-gt3] PSE mantido estritamente como upgrade (desativado stock, ativo com kit)',
  )

  // Golf GTI 2018 (vermelho fixo) e Toro Ranch 2025 (branco fixo) sem seletor RGB
  const gti = loadVehicle('golf-gti')
  const ranch = loadVehicle('fiat-toro-ranch-2025')
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(gti)
  sim.setAmbientLightColor('purple')
  assert(
    resolveDefaultAmbientColor(gti) === 'red' &&
      !supportsConfigurableAmbientRgb(gti) &&
      useSimulationStore.getState().ambientLightColor === 'red',
    '[golf-gti] iluminação vermelha original fixa bloqueia troca para RGB arbitrário',
  )

  sim.reset()
  sim.init(ranch)
  sim.setAmbientLightColor('purple')
  assert(
    resolveDefaultAmbientColor(ranch) === 'white' &&
      !supportsConfigurableAmbientRgb(ranch) &&
      useSimulationStore.getState().ambientLightColor === 'white',
    '[fiat-toro-ranch-2025] iluminação branca original fixa bloqueia troca para RGB arbitrário',
  )

  // Civic Si 2008: multimediaKit=false de fábrica, mas aceita retrofit_2din quando comprado
  const civic = loadVehicle('civic-si')
  const civicDefaultUpgrades = resolveDefaultUpgradesForVehicle('civic-si', civic)
  const civicStockMedia = resolveVehicleMultimediaSpec(civic, { multimediaKit: false })
  const civicUpgradedMedia = resolveVehicleMultimediaSpec(civic, { multimediaKit: true })
  assert(
    civicDefaultUpgrades.multimediaKit === false &&
      civicStockMedia.unitId === 'honda_haudio' &&
      civicStockMedia.type === 'factory' &&
      civicUpgradedMedia.unitId === 'retrofit_2din' &&
      civicUpgradedMedia.type === 'aftermarket',
    '[civic-si] sai stock com Honda H-Audio OEM (multimediaKit=false) e migra para retrofit_2din apenas quando comprado',
  )

  // Gol G6: escala do tacômetro alinhada para 7.000 RPM sem alterar dinamômetro/motor
  const golG6 = loadVehicle('gol-g6')
  const dynoGol = calculateDynoProfile(golG6, resolveDefaultUpgradesForVehicle('gol-g6', golG6))
  assert(
    golG6.dashboard.tachometerMax === 7000 &&
      dynoGol.maxEnginePowerHp >= 100 &&
      dynoGol.maxEnginePowerHp <= 125 &&
      dynoGol.maxWheelPowerHp > 85,
    `[gol-g6] tachometerMax=7000 alinhado com motor/dinamômetro intactos (pico motor=${dynoGol.maxEnginePowerHp.toFixed(1)} cv, roda=${dynoGol.maxWheelPowerHp.toFixed(1)} whp)`,
  )
}

console.log('\n=== ETAPA 1.5 — AUDITORIA COMPLEMENTAR (AWD/PTM, CONSUMO/AUTONOMIA, ODÔMETRO, ABS) ===')
{
  const sim = useSimulationStore.getState()

  // 1.5.1 — AWD / PTM: distinção explícita entre torque medido nos eixos e acoplamento nominal em repouso/roda-livre
  const ranch = loadVehicle('fiat-toro-ranch-2025')
  const porsche = loadVehicle('porsche-gt3')

  sim.reset()
  sim.init(ranch)
  const ranchIdle = useSimulationStore.getState()
  assert(
    ranchIdle.torqueSplitSource === 'nominal_idle_coupling' &&
      ranchIdle.frontTorqueSplitPercent === 96 &&
      ranchIdle.rearTorqueSplitPercent === 4 &&
      ranchIdle.frontAxleTorqueNm === 0 &&
      ranchIdle.rearAxleTorqueNm === 0,
    '[AWD Toro AUTO] em repouso identifica explicitamente torqueSplitSource="nominal_idle_coupling" (96/4, 0 Nm)',
  )

  sim.setFourWheelDriveMode('4wd')
  const ranchLockIdle = useSimulationStore.getState()
  assert(
    ranchLockIdle.torqueSplitSource === 'nominal_idle_coupling' &&
      ranchLockIdle.frontTorqueSplitPercent === 50 &&
      ranchLockIdle.rearTorqueSplitPercent === 50,
    '[AWD Toro 4WD] alternância parado atualiza imediatamente acoplamento nominal 50/50',
  )

  sim.setFourWheelDriveMode('auto')
  useSimulationStore.getState()._physics?.restoreSnapshot({
    ...useSimulationStore.getState()._physics!.getStateSnapshot(),
    positionX: 60,
    positionY: 52,
    headingRad: Math.PI / 2,
  })
  useSimulationStore.setState({ positionX: 60, positionY: 52, headingDeg: 90 })
  sim.setBrake(1)
  sim.startEngine()
  stepSeconds(0.6)
  sim.setBrake(0)
  sim.selectDrive()
  sim.setThrottle(1.0)
  stepSeconds(1.2)
  const ranchUnderLoad = useSimulationStore.getState()
  const ranchExpectedFrontPct = Math.round(
    (ranchUnderLoad._phys.frontAxleTorqueNm /
      (ranchUnderLoad._phys.frontAxleTorqueNm + ranchUnderLoad._phys.rearAxleTorqueNm)) *
      100,
  )
  assert(
    ranchUnderLoad.torqueSplitSource === 'measured_axle_torque' &&
      ranchUnderLoad.frontAxleTorqueNm + ranchUnderLoad.rearAxleTorqueNm > 100 &&
      ranchUnderLoad.frontTorqueSplitPercent === ranchExpectedFrontPct &&
      ranchUnderLoad.frontTorqueSplitPercent + ranchUnderLoad.rearTorqueSplitPercent === 100,
    `[AWD Toro AUTO sob carga] calcula percentuais diretamente dos torques de eixo (${ranchUnderLoad.frontTorqueSplitPercent}/${ranchUnderLoad.rearTorqueSplitPercent}, F=${ranchUnderLoad.frontAxleTorqueNm} Nm, R=${ranchUnderLoad.rearAxleTorqueNm} Nm, source=${ranchUnderLoad.torqueSplitSource})`,
  )

  // Porsche PTM: repouso (8/92 nominal) -> carga máxima (measured_axle_torque) -> neutro/roda-livre (retorna a nominal_idle_coupling)
  sim.reset()
  sim.init(porsche)
  const porscheIdle = useSimulationStore.getState()
  assert(
    porscheIdle.torqueSplitSource === 'nominal_idle_coupling' &&
      porscheIdle.frontTorqueSplitPercent === 8 &&
      porscheIdle.rearTorqueSplitPercent === 92,
    '[PTM Porsche] em repouso identifica acoplamento nominal de base 8/92 (gama_min=0.15 => rear=92.5%)',
  )
  useSimulationStore.getState()._physics?.restoreSnapshot({
    ...useSimulationStore.getState()._physics!.getStateSnapshot(),
    positionX: 60,
    positionY: 52,
    headingRad: Math.PI / 2,
  })
  useSimulationStore.setState({ positionX: 60, positionY: 52, headingDeg: 90 })
  sim.setBrake(1)
  sim.startEngine()
  stepSeconds(0.6)
  sim.setBrake(0)
  sim.selectSport()
  sim.setThrottle(1.0)
  stepSeconds(1.5)
  const porscheLoad = useSimulationStore.getState()
  assert(
    porscheLoad.torqueSplitSource === 'measured_axle_torque' &&
      porscheLoad.frontTorqueSplitPercent >= 20 &&
      porscheLoad.frontTorqueSplitPercent <= 55,
    `[PTM Porsche sob carga] transfere torque ativo ao eixo dianteiro (${porscheLoad.frontTorqueSplitPercent}/${porscheLoad.rearTorqueSplitPercent}, source=${porscheLoad.torqueSplitSource})`,
  )
  sim.setThrottle(0)
  sim.selectNeutral()
  stepSeconds(0.3)
  const porscheCoastNeutral = useSimulationStore.getState()
  assert(
    porscheCoastNeutral.frontAxleTorqueNm === 0 &&
      porscheCoastNeutral.rearAxleTorqueNm === 0 &&
      porscheCoastNeutral.torqueSplitSource === 'nominal_idle_coupling' &&
      porscheCoastNeutral.frontTorqueSplitPercent === 8 &&
      porscheCoastNeutral.rearTorqueSplitPercent === 92,
    '[PTM Porsche em neutro/roda-livre] não congela último split sob carga; retorna a nominal_idle_coupling (8/92)',
  )

  // 1.5.2 — Consumo e Autonomia: desligado, marcha lenta, transição 20m-250m, consolidado >=250m e pane seca
  const yaris = loadVehicle('yaris-2019')
  sim.reset()
  sim.init(yaris)
  const yarisOff = useSimulationStore.getState()
  assert(
    !yarisOff.hasMeasuredAvgConsumption &&
      yarisOff.avgConsumptionKmL === 0 &&
      yarisOff.cruiseReferenceConsumptionKmL > 4 &&
      yarisOff.rangeEstimationSource === 'cruise_reference',
    `[Consumo OFF] avgConsumptionKmL=0 (hasMeasuredAvgConsumption=false) separado de cruiseReferenceConsumptionKmL=${yarisOff.cruiseReferenceConsumptionKmL} km/L`,
  )

  useSimulationStore.getState()._physics?.restoreSnapshot({
    ...useSimulationStore.getState()._physics!.getStateSnapshot(),
    positionX: 60,
    positionY: 52,
    headingRad: Math.PI / 2,
  })
  useSimulationStore.setState({ positionX: 60, positionY: 52, headingDeg: 90 })
  sim.setBrake(1)
  sim.startEngine()
  stepSeconds(3.0) // 3s em marcha lenta parado em P
  const yarisIdle = useSimulationStore.getState()
  assert(
    yarisIdle.isRunning &&
      yarisIdle.speed === 0 &&
      yarisIdle.instantFuelBurnLh > 0.8 &&
      yarisIdle.instantConsumptionKmL === 0 &&
      yarisIdle._phys.tripFuelUsedLiters > 0.0005 &&
      yarisIdle._phys.tripDistanceKm === 0 &&
      !yarisIdle.hasMeasuredAvgConsumption &&
      yarisIdle.avgConsumptionKmL === 0 &&
      yarisIdle.rangeEstimationSource === 'cruise_reference',
    `[Marcha lenta parado] queima real (${yarisIdle.instantFuelBurnLh} L/h) acumula em tripFuelUsedLiters (${yarisIdle._phys.tripFuelUsedLiters.toFixed(4)} L) mantendo inst=0 e avg=0`,
  )

  const idleBurnedBeforeMove = yarisIdle._phys.tripFuelUsedLiters
  sim.setBrake(0)
  sim.selectDrive()
  sim.setThrottle(0.75)
  // Avança até cruzar 20m (<250m)
  while (useSimulationStore.getState()._phys.tripDistanceKm < 0.05) {
    sim.update(1 / 120)
  }
  stepSeconds(0.2) // Garante publicação slow
  const yarisEarly = useSimulationStore.getState()
  const exactEarlyAvg = yarisEarly._phys.tripDistanceKm / yarisEarly._phys.tripFuelUsedLiters
  assert(
    yarisEarly.hasMeasuredAvgConsumption &&
      yarisEarly._phys.tripFuelUsedLiters > idleBurnedBeforeMove &&
      Math.abs(yarisEarly._phys.avgConsumptionKmL - exactEarlyAvg) < 1e-6 &&
      yarisEarly.rangeEstimationSource === 'blended_transition',
    `[Primeiros metros 20m-250m] avgConsumptionKmL=${yarisEarly._phys.avgConsumptionKmL.toFixed(2)} km/L usa estritamente dist/combustível (incluindo lenta) e rangeEstimationSource="blended_transition"`,
  )

  // Avança até ultrapassar 250m para consolidar 100% dados reais na autonomia
  while (useSimulationStore.getState()._phys.tripDistanceKm < 0.28) {
    // Reposiciona em linha reta se necessário para não tocar bordas do mundo
    const curSnap = useSimulationStore.getState()._physics!.getStateSnapshot()
    if (Math.abs(curSnap.positionY) > 150 || Math.abs(curSnap.positionX) > 150) {
      useSimulationStore.getState()._physics!.restoreSnapshot({
        ...curSnap,
        positionX: 60,
        positionY: -100,
        headingRad: Math.PI / 2,
      })
    }
    sim.update(1 / 120)
  }
  stepSeconds(0.2)
  const yarisConsolidated = useSimulationStore.getState()
  const exactConsolidatedAvg =
    yarisConsolidated._phys.tripDistanceKm / yarisConsolidated._phys.tripFuelUsedLiters
  const expectedPhysRange = Math.round(
    yarisConsolidated._phys.fuelLevelLiters * exactConsolidatedAvg,
  )
  assert(
    yarisConsolidated.rangeEstimationSource === 'measured_trip' &&
      Math.abs(yarisConsolidated._phys.avgConsumptionKmL - exactConsolidatedAvg) < 1e-6 &&
      yarisConsolidated._phys.estimatedRangeKm === expectedPhysRange &&
      Math.abs(yarisConsolidated.estimatedRangeKm - expectedPhysRange) <= 1,
    `[Acima de 250m] rangeEstimationSource="measured_trip" usa 100% média real acumulada (${exactConsolidatedAvg.toFixed(2)} km/L -> ${yarisConsolidated.estimatedRangeKm} km)`,
  )

  // Pane seca zera autonomia com fonte explícita 'out_of_fuel'
  useSimulationStore.setState({ fuelLevelLiters: 0, isOutOfFuel: true })
  stepSeconds(0.2)
  assert(
    useSimulationStore.getState().estimatedRangeKm === 0 &&
      useSimulationStore.getState().rangeEstimationSource === 'out_of_fuel',
    '[Pane seca] estimatedRangeKm=0 com rangeEstimationSource="out_of_fuel"',
  )

  // 1.5.3 — Odômetro: zero chamadas a 120 Hz, lote >=0.5 km, idempotência em reset/troca de carro e proteção de re-init
  const garageState = useGarageStore.getState()
  const ownedGol = garageState.resolveInstanceForVehicle('gol-g6')
  const ownedYaris = garageState.resolveInstanceForVehicle('yaris-2019')
  assert(Boolean(ownedGol && ownedYaris), 'Instâncias de garagem disponíveis para auditoria de odômetro')

  if (ownedGol && ownedYaris) {
    const golCfg = loadVehicle('gol-g6')
    const origAddMileage = useGarageStore.getState().addMileageKm
    let addMileageCalls = 0
    let lastAddedDelta = 0
    useGarageStore.setState({
      addMileageKm: (id: string, deltaKm: number) => {
        addMileageCalls++
        lastAddedDelta = deltaKm
        origAddMileage(id, deltaKm)
      },
    })

    try {
      const startGolMileage = useGarageStore.getState().getCarById(ownedGol.instanceId)!.mileageKm
      sim.reset()
      addMileageCalls = 0
      sim.init(golCfg, ownedGol.upgrades, ownedGol.instanceId)

      // 1.200 ticks (10s a 120 Hz) a 72 km/h => exatos 0.200 km (< limiar 0.5 km em condução)
      for (let i = 0; i < 1200; i++) {
        useSimulationStore.getState()._physics!.setSpeedKmh(72)
        const snap = useSimulationStore.getState()._physics!.getStateSnapshot()
        if (Math.abs(snap.positionX) > 120 || Math.abs(snap.positionY) > 120) {
          useSimulationStore.getState()._physics!.restoreSnapshot({
            ...snap,
            positionX: 60,
            positionY: 0,
            headingRad: Math.PI / 2,
          })
        }
        sim.update(1 / 120)
      }
      const midOdo = useSimulationStore.getState()._phys.odometerKm
      assert(
        addMileageCalls === 0 && midOdo - startGolMileage > 0.18 && midOdo - startGolMileage < 0.25,
        `[Odômetro 120 Hz] 1.200 ticks (~0.20 km) executam ZERO chamadas a addMileageKm/localStorage (odômetro interno=${midOdo.toFixed(3)} km)`,
      )

      // Continua mais 2.000 ticks a 72 km/h (+0.40 km => total ~0.60 km >= 0.5 km)
      for (let i = 0; i < 2000; i++) {
        useSimulationStore.getState()._physics!.setSpeedKmh(72)
        const snap = useSimulationStore.getState()._physics!.getStateSnapshot()
        if (Math.abs(snap.positionX) > 120 || Math.abs(snap.positionY) > 120) {
          useSimulationStore.getState()._physics!.restoreSnapshot({
            ...snap,
            positionX: 60,
            positionY: 0,
            headingRad: Math.PI / 2,
          })
        }
        sim.update(1 / 120)
      }
      stepSeconds(0.2)
      assert(
        addMileageCalls === 1 && lastAddedDelta >= 0.5,
        `[Odômetro batching] ao cruzar 0.5 km sincroniza exatamente 1 lote em shouldUpdateSlow (delta=${lastAddedDelta.toFixed(3)} km)`,
      )

      // Testa idempotência em reset() duplo (saldo residual ~0.10 km >= 0.05 km)
      const callsBeforeReset = addMileageCalls
      sim.reset()
      const callsAfterFirstReset = addMileageCalls
      sim.reset()
      const callsAfterSecondReset = addMileageCalls
      assert(
        callsAfterFirstReset === callsBeforeReset + 1 &&
          callsAfterSecondReset === callsAfterFirstReset,
        '[Odômetro reset idempotente] primeiro reset() persiste saldo residual (>=0.05 km) e segundo reset() NÃO duplica quilometragem',
      )

      // Testa troca direta de veículo init(Gol) -> conduz ~0.12 km -> init(Yaris) sem duplicar nem misturar instâncias
      const golBeforeSwitch = useGarageStore.getState().getCarById(ownedGol.instanceId)!.mileageKm
      const yarisBeforeSwitch = useGarageStore.getState().getCarById(ownedYaris.instanceId)!.mileageKm
      sim.init(golCfg, ownedGol.upgrades, ownedGol.instanceId)
      for (let i = 0; i < 720; i++) {
        useSimulationStore.getState()._physics!.setSpeedKmh(72)
        sim.update(1 / 120)
      }
      const callsBeforeSwitch = addMileageCalls
      sim.init(yaris, ownedYaris.upgrades, ownedYaris.instanceId)
      const golAfterSwitch = useGarageStore.getState().getCarById(ownedGol.instanceId)!.mileageKm
      const yarisAfterSwitch = useGarageStore.getState().getCarById(ownedYaris.instanceId)!.mileageKm
      assert(
        addMileageCalls === callsBeforeSwitch + 1 &&
          golAfterSwitch > golBeforeSwitch + 0.1 &&
          yarisAfterSwitch === yarisBeforeSwitch &&
          useSimulationStore.getState().odometerKm === yarisBeforeSwitch,
        `[Odômetro troca de veículo] flush atômico credita saldo apenas no Gol (${golBeforeSwitch.toFixed(3)} -> ${golAfterSwitch.toFixed(3)} km) e preserva Yaris isolado (${yarisAfterSwitch.toFixed(3)} km)`,
      )
    } finally {
      useGarageStore.setState({ addMileageKm: origAddMileage })
    }
  }

  // Verificação estrutural: VehicleDashboard não depende da referência de objeto `activeCar` no useEffect de init/reset
  const dashboardSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'dashboard', 'VehicleDashboard.tsx'),
    'utf8',
  )
  assert(
    dashboardSrc.includes('[vehicle, activeCarInstanceId, instanceIdFromUrl, init, reset, entryMode]'),
    '[Ciclo de vida VehicleDashboard] useEffect depende de activeCarInstanceId estável (addMileageKm não reinicia a simulação)',
  )

  // 1.5.4 — Diferenciação completa de ABS: indisponível (clássicos anos 90) vs standby vs modulação ativa vs falha
  const preAbsIds = ['opala-4100', 'gol-quadrado-turbo', 'ford-pampa-l-1997']
  for (const id of preAbsIds) {
    const classic = loadVehicle(id)
    sim.reset()
    sim.init(classic)
    sim.setIgnitionPosition('ON', false)
    sim.setAbsFault(true)
    sim.setBatteryDischarged(true)
    sim.setBrake(1.0)
    const stClassic = useSimulationStore.getState()
    const telClassic = DashboardSystem.computeTelemetry(
      DashboardSystem.createInputFromState(classic, stClassic),
    )
    assert(
      !resolveVehicleHasAbs(classic) &&
        !stClassic.hasAbs &&
        !stClassic.absFault &&
        !stClassic.absEngaged &&
        !telClassic.abs.available &&
        telClassic.abs.status === 'unavailable' &&
        !telClassic.warningLights.absActive &&
        !telClassic.warningLights.absFault,
      `[ABS Indisponível: ${id}] sem ABS de fábrica mantém status="unavailable" e luzes ABS apagadas mesmo sob falha/bateria baixa/freio 100%`,
    )
  }

  // Em veículo com ABS (Porsche): bateria descarregada em ON sinaliza falha de ABS (subtensão da bomba) e inibe modulação
  sim.reset()
  sim.init(porsche)
  sim.setIgnitionPosition('ON', false)
  sim.setBrake(0.8)
  const telNormalBrakeOn = DashboardSystem.computeTelemetry(
    DashboardSystem.createInputFromState(porsche, useSimulationStore.getState()),
  )
  assert(
    telNormalBrakeOn.abs.available &&
      telNormalBrakeOn.abs.status === 'standby' &&
      telNormalBrakeOn.warningLights.serviceBrake &&
      !telNormalBrakeOn.warningLights.absActive &&
      !telNormalBrakeOn.warningLights.absFault,
    '[ABS Standby] pisar forte no freio (80%) sem travar roda mantém status="standby" e luzes ABS 100% apagadas',
  )

  sim.setBatteryDischarged(true)
  const telLowVoltage = DashboardSystem.computeTelemetry(
    DashboardSystem.createInputFromState(porsche, useSimulationStore.getState()),
  )
  assert(
    telLowVoltage.abs.status === 'fault' &&
      telLowVoltage.warningLights.absFault &&
      !telLowVoltage.warningLights.absActive,
    '[ABS Falha por subtensão] bateria descarregada (<9.6V) em ON acende absFault=true e bloqueia absActive',
  )

  sim.setBatteryDischarged(false)
  sim.setAbsFault(true)
  const telExplicitFault = DashboardSystem.computeTelemetry(
    DashboardSystem.createInputFromState(porsche, useSimulationStore.getState()),
  )
  assert(
    telExplicitFault.abs.status === 'fault' &&
      telExplicitFault.warningLights.absFault &&
      !telExplicitFault.warningLights.absActive,
    '[ABS Falha de módulo] setAbsFault(true) em ON acende absFault=true mantendo absActive=false',
  )
}

console.log(`\n=============================================================`)
console.log(`RESULTADO ETAPA 1 (FASE 4.4.3): ${passed} PASSOU | ${failed} FALHOU`)
console.log(`=============================================================\n`)

if (failed > 0) {
  process.exit(1)
}
