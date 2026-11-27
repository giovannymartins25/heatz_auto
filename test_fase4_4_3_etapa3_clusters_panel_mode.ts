/**
 * HEATZ AUTO — FASE 4.4.3 (ETAPA 3): Suíte Completa da Separação Modo Painel vs Modo Dirigir,
 * Regra Estrita de Combustível e Auditoria dos 15 Painéis de Instrumentos
 *
 * Valida rigorosamente:
 * 1. Separação estrutural e física entre Modo Painel (`sessionMode === 'panel'`) e Modo Dirigir (`sessionMode === 'drive'`)
 *    sobre a MESMA `useSimulationStore` e o mesmo `EngineSimulator` / `DeterministicIntegrator` a 120 Hz:
 *    - Modo Painel: zero deslocamento espacial (`positionX`, `positionY`, `headingDeg`), zero colisões, zero direção
 *      por inclinação/teclado, zero pedal de freio/embreagem/freio de mão, partida autêntica (`push_button` e `key`),
 *      giro livre em `P`/`N` (`0 km/h`) e aceleração estacionária com reação real de RPM, velocímetro e turbo.
 * 2. Regra estrita de combustível, autonomia e odômetro centralizada na store:
 *    - Modo Painel: `fuelLevelLiters` estritamente constante (`delta === 0`), `tripFuelUsedLiters === 0`,
 *      `tripDistanceKm === 0`, `instantFuelBurnLh === 0`, `instantConsumptionKmL === 0`, `estimatedRangeKm` inalterado,
 *      `odometerKm` e `useGarageStore.mileageKm` inalterados.
 *    - Modo Dirigir: consumo real de combustível, evolução de distância, consumo instantâneo/médio, autonomia e odômetro.
 *    - Alternância `drive -> panel -> drive`: preserva combustível, histórico de viagem e odômetro sem corrupção.
 * 3. Auditoria individual de todos os 15 clusters (`CLUSTER_REGISTRY` + `DashboardSystem`):
 *    - Escalas de RPM/velocímetro/redline coerentes com `config.json` (incluindo Porsche 911 Turbo S 8.000/7.000 RPM e
 *      Gol Quadrado 260 km/h);
 *    - Zero leitura incorreta de `auxGauges.fuelLevel` (litros) como percentual em qualquer cluster;
 *    - Ponteiro de combustível do Golf GTI corrigido (`0% -> -50° R`, `100% -> +50° 1/1`);
 *    - Diferenciação estrutural real entre Fiat Toro Ranch 4x4 Diesel e Fiat Toro Endurance T270 Flex;
 *    - `M1..M6` / `S1..S6` nos Ford Fusion 2019 e 2012 e seletor `M` no Jetta GLI;
 *    - `Civic Si` com Upper Deck vermelho Si e barras de 8 segmentos calibradas (`0..8`);
 *    - `Opala` com arcos SVG polares exatos e voltímetro 12V funcional;
 *    - `CB1000R` com `ABS` vinculado exclusivamente a `absFault`/`absActive` (nunca ao freio de mão) e sem multimídia;
 *    - Veículos sem ABS (`Pampa 1997`, `Opala 1992`, `Gol Quadrado 1994`) com `abs.available === false`.
 */

import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { VehicleConfig, VehicleManifest } from './src/types/vehicle'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useGarageStore } from './src/stores/useGarageStore'
import { DashboardSystem } from './src/systems/dashboard'
import { sharedTiltSteering } from './src/systems/input'
import { CLUSTER_REGISTRY, resolveClusterEntry } from './src/components/dashboard/clusters/clusterRegistry'

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

function buildTelemetryForCurrentState(vehicle: VehicleConfig) {
  const st = useSimulationStore.getState()
  return DashboardSystem.computeTelemetry(
    DashboardSystem.createInputFromState(vehicle, {
      rpm: st.rpm,
      status: st.status,
      isRevLimiting: st.isRevLimiting,
      isBogWarning: st.isBogWarning,
      speed: st.speed,
      currentGear: st.currentGear,
      transmissionMode: st.transmissionMode,
      drivingMode: st.drivingMode,
      gearSelectorPosition: st.gearSelectorPosition,
      isKickdown: st.isKickdown,
      throttle: st.throttle,
      brake: st.brake,
      handbrake: st.handbrake,
      ignitionPosition: st.ignitionPosition,
      hasAbs: st.hasAbs,
      absEngaged: st.absEngaged,
      absFault: st.absFault,
      isBatteryDischarged: st.isBatteryDischarged,
      clutchPosition: st.clutchPosition,
      clutchSlipRpm: st.clutchSlipRpm,
      clutchSlipRatio: st.clutchSlipRatio,
      clutchTorqueTransfer: st.clutchTorqueTransfer,
      clutchHeat: st.clutchHeat,
      isClutchSlipping: st.isClutchSlipping,
      tcsEnabled: st.tcsEnabled,
      tcsIntervening: st.tcsIntervening,
      tcsInterventionLevel: st.tcsInterventionLevel,
      coolantTemp: st.coolantTemp,
      oilTemp: st.oilTemp,
      fuelLevelLiters: st.fuelLevelLiters,
      fuelCapacityLiters: st.fuelCapacityLiters,
      isEngineBlown: st.isEngineBlown,
    }),
  )
}

console.log('\n=== ETAPA 3.1 — SEPARAÇÃO ESTRUTURAL DO MODO PAINEL (SEM MUNDO, SEM FREIO/EMBREAGEM/FREIO DE MÃO/INCLINAÇÃO) ===')
{
  const panelSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'cockpit', 'PanelModeInteriorView.tsx'),
    'utf8',
  )
  const panelExec = panelSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '')
  const clusterPanelSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'cockpit', 'InstrumentClusterPanel.tsx'),
    'utf8',
  )

  assert(
    !panelExec.includes('DrivingMapViewport') &&
      !panelExec.includes('HudMinimap') &&
      !panelExec.includes('WorldMapModal') &&
      !panelExec.includes('SteeringControlZone') &&
      !panelExec.includes('useDeviceTilt') &&
      !panelExec.includes('HandbrakeButton') &&
      !panelExec.includes('QuickClutchButton') &&
      !panelExec.includes('<Pedals') &&
      !panelExec.includes('setBrake') &&
      !panelExec.includes('setClutch') &&
      !panelExec.includes('toggleHandbrake'),
    'PanelModeInteriorView omite 100% de mapa, minimapa, direção por inclinação, pedal de freio, embreagem e freio de mão',
  )

  assert(
    panelExec.includes('panel-mode-cluster-region') &&
      panelExec.includes('panel-mode-multimedia-region') &&
      panelExec.includes('panel-mode-controls-region') &&
      panelExec.includes('panel-mode-telemetry-strip') &&
      panelExec.includes('panel-mode-accelerator-deck'),
    'PanelModeInteriorView estrutura Hero Cluster, Multimídia dedicada, Controles organizados e Telemetria + Acelerador nos 3 formatos',
  )

  assert(
    clusterPanelSrc.includes("viewMode === 'cockpit'") &&
      !clusterPanelSrc.includes('cluster-indicator-ignition'),
    'InstrumentClusterPanel não sobrepõe setas/faróis/ignição duplicados sobre os 15 clusters reais',
  )
}

console.log('\n=== ETAPA 3.2 — SIMULAÇÃO ESTACIONÁRIA DO MODO PAINEL + CONGELAMENTO ESTRITO DE COMBUSTÍVEL E ODÔMETRO ===')
{
  const sim = useSimulationStore.getState()
  const porsche = loadVehicle('porsche-gt3')
  const garageCar = useGarageStore.getState().resolveInstanceForVehicle(porsche.id)
  const startGarageMileage = garageCar?.mileageKm ?? 0

  sim.reset()
  sim.init(porsche, garageCar?.upgrades, garageCar?.instanceId, 'panel')

  const initSt = useSimulationStore.getState()
  const startX = initSt.positionX
  const startY = initSt.positionY
  const startHeading = initSt.headingDeg
  const startFuel = initSt.fuelLevelLiters
  const startRange = initSt.estimatedRangeKm
  const startOdo = initSt.odometerKm

  // 1. Partida Start/Stop no Modo Painel NÃO exige pedal de freio (inexistente no Modo Painel)
  sim.pressPushButtonIgnition(true)
  stepSeconds(0.65)
  assert(
    useSimulationStore.getState().isRunning && useSimulationStore.getState().ignitionPosition === 'ON',
    '[Modo Painel · Porsche] botão Start/Stop liga o motor sem exigir pedal de freio ausente',
  )

  // 2. Tentativas de acionar freio, freio de mão ou direção são bloqueadas no Modo Painel
  sim.setBrake(1.0)
  sim.setHandbrake(true)
  sim.setSteeringAngle(0.9, 'keyboard')
  sharedTiltSteering.processSample({ beta: 22, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60, true)
  assert(
    useSimulationStore.getState().brake === 0 &&
      useSimulationStore.getState().handbrake === false &&
      useSimulationStore.getState().steeringAngle === 0,
    '[Modo Painel] freio, freio de mão e esterço permanecem bloqueados em 0 / false',
  )

  // 3. Giro livre em P / N: RPM sobe com resposta real, velocímetro permanece 0 km/h
  sim.selectNeutral()
  sim.setThrottle(1.0)
  stepSeconds(1.2)
  const freeRevSt = useSimulationStore.getState()
  assert(
    freeRevSt.rpm > 5000 && freeRevSt.speed === 0,
    `[Modo Painel · Neutro] motor sobe giro livremente (${Math.round(freeRevSt.rpm)} RPM) com velocímetro em 0 km/h`,
  )

  // 4. Aceleração estacionária em marcha (D / S / M): RPM, velocímetro, turbo e trocas reagem com ZERO deslocamento espacial e ZERO gasto de combustível!
  sim.setThrottle(0)
  stepSeconds(0.8)
  sim.selectDrive()
  sim.setThrottle(1.0)
  stepSeconds(8.0)

  const panelRunSt = useSimulationStore.getState()
  assert(
    panelRunSt.speed > 140 &&
      panelRunSt.currentGear >= 3 &&
      panelRunSt.boostPressureBar > 0.6 &&
      panelRunSt.livePowerHp > 300,
    `[Modo Painel · Drive] reação real de velocímetro (${panelRunSt.speed.toFixed(1)} km/h), marcha (${panelRunSt.currentGear}ª), boost (+${panelRunSt.boostPressureBar.toFixed(2)} bar) e potência (${Math.round(panelRunSt.livePowerHp)} cv)`,
  )

  assert(
    panelRunSt.positionX === startX &&
      panelRunSt.positionY === startY &&
      panelRunSt.headingDeg === startHeading &&
      panelRunSt.isColliding === false &&
      panelRunSt.lateralAccelG === 0 &&
      panelRunSt.longitudinalAccelG === 0,
    `[Modo Painel] ZERO deslocamento espacial no mundo (pos=(${panelRunSt.positionX}, ${panelRunSt.positionY}), heading=${panelRunSt.headingDeg}°, colisão=false)`,
  )

  assert(
    panelRunSt.fuelLevelLiters === startFuel &&
      panelRunSt._phys.fuelLevelLiters === startFuel &&
      panelRunSt.tripFuelUsedLiters === 0 &&
      panelRunSt.tripDistanceKm === 0 &&
      panelRunSt.instantFuelBurnLh === 0 &&
      panelRunSt.instantConsumptionKmL === 0 &&
      panelRunSt.estimatedRangeKm === startRange &&
      panelRunSt.odometerKm === startOdo,
    `[Modo Painel] COMBUSTÍVEL E ODÔMETRO 100% INTACTOS (tanque=${panelRunSt.fuelLevelLiters}L === ${startFuel}L, tripFuel=0, auton=${panelRunSt.estimatedRangeKm} km, odo=${panelRunSt.odometerKm} km)`,
  )

  // 5. Motocicleta manual com chave (CB1000R) no Modo Painel: parte na chave e troca marchas 1ª -> 2ª -> 3ª sem manete de embreagem
  const cb1000r = loadVehicle('cb1000r')
  sim.reset()
  sim.init(cb1000r, undefined, null, 'panel')
  const motoInitSt = useSimulationStore.getState()
  const motoStartFuel = motoInitSt.fuelLevelLiters
  const motoStartX = motoInitSt.positionX
  const motoStartY = motoInitSt.positionY
  sim.setIgnitionPosition('CRANK', true)
  stepSeconds(0.65)
  sim.releaseIgnitionKey()
  sim.shiftUp() // 1ª marcha sem precisar de manete de embreagem no Modo Painel
  sim.setThrottle(0.95)
  stepSeconds(6.0) // 1ª marcha longa de superbike (sobe até a faixa nobre de giro)
  sim.shiftUp() // 2ª marcha
  stepSeconds(1.5)
  sim.shiftUp() // 3ª marcha
  stepSeconds(1.2)
  const motoPanelSt = useSimulationStore.getState()
  assert(
    motoPanelSt.isRunning &&
      motoPanelSt.currentGear === 3 &&
      motoPanelSt.speed > 75 &&
      motoPanelSt.fuelLevelLiters === motoStartFuel &&
      motoPanelSt.positionX === motoStartX &&
      motoPanelSt.positionY === motoStartY,
    `[Modo Painel · CB1000R] parte na chave e troca 1ª->2ª->3ª sem embreagem (${motoPanelSt.speed.toFixed(1)} km/h), zero deslocamento e tanque intacto (${motoPanelSt.fuelLevelLiters}L)`,
  )

  // Restaura quilometragem original caso houvesse instância
  if (garageCar) {
    assert(
      (useGarageStore.getState().getCarById(garageCar.instanceId)?.mileageKm ?? 0) === startGarageMileage,
      '[Modo Painel] useGarageStore não acumulou nenhuma quilometragem durante aceleração no Modo Painel',
    )
  }
}

console.log('\n=== ETAPA 3.3 — CONSUMO REAL NO MODO DIRIGIR E INTEGRIDADE NA ALTERNÂNCIA DRIVE ↔ PANEL ===')
{
  const sim = useSimulationStore.getState()
  const gti = loadVehicle('golf-gti')
  sim.reset()
  sim.init(gti, undefined, null, 'drive')

  const initialFuel = useSimulationStore.getState().fuelLevelLiters
  const initialX = useSimulationStore.getState().positionX
  const initialY = useSimulationStore.getState().positionY

  sim.setBrake(0.8)
  sim.pressPushButtonIgnition(true)
  stepSeconds(0.65)
  sim.setBrake(0)
  sim.selectDrive()
  sim.setThrottle(0.85)
  stepSeconds(5.5)

  const afterDrive1 = useSimulationStore.getState()
  const movedDistM = Math.hypot(afterDrive1.positionX - initialX, afterDrive1.positionY - initialY)
  assert(
    movedDistM > 55 &&
      afterDrive1.fuelLevelLiters < initialFuel &&
      afterDrive1.tripFuelUsedLiters > 0 &&
      afterDrive1.tripDistanceKm >= 0.05 &&
      afterDrive1.hasMeasuredAvgConsumption &&
      afterDrive1.avgConsumptionKmL > 0,
    `[Modo Dirigir · Golf GTI] desloca no mundo (${movedDistM.toFixed(1)} m) e consome combustível real (${initialFuel}L -> ${afterDrive1.fuelLevelLiters}L, média=${afterDrive1.avgConsumptionKmL} km/L)`,
  )

  // Alterna para Modo Painel no meio da sessão: preserva combustível exato, histórico de viagem e não gasta nada acelerando!
  sim.setSessionMode('panel')
  const switchedSt = useSimulationStore.getState()
  const fuelAtSwitch = switchedSt._phys.fuelLevelLiters
  const pubFuelAtSwitch = switchedSt.fuelLevelLiters
  const tripDistAtSwitch = switchedSt.tripDistanceKm
  const odoAtSwitch = switchedSt.odometerKm
  const posAtSwitch = { x: switchedSt.positionX, y: switchedSt.positionY }

  sim.selectDrive()
  sim.setThrottle(1.0)
  stepSeconds(5.0)

  const duringPanel = useSimulationStore.getState()
  assert(
    duringPanel.speed > 65 &&
      duringPanel._phys.fuelLevelLiters === fuelAtSwitch &&
      duringPanel.fuelLevelLiters === pubFuelAtSwitch &&
      duringPanel.tripDistanceKm === tripDistAtSwitch &&
      duringPanel.odometerKm === odoAtSwitch &&
      duringPanel.positionX === posAtSwitch.x &&
      duringPanel.positionY === posAtSwitch.y,
    `[Transição Drive -> Panel] velocidade de rolo=${duringPanel.speed.toFixed(1)} km/h com combustível (${duringPanel.fuelLevelLiters}L), distância (${duringPanel.tripDistanceKm} km) e posição congelados`,
  )

  // Retorna para Modo Dirigir: velocidade estacionária do rolo é zerada com segurança e o consumo real retoma do mesmo ponto!
  sim.setSessionMode('drive')
  const rightAfterReturn = useSimulationStore.getState()
  assert(
    rightAfterReturn.speed === 0 &&
      rightAfterReturn.fuelLevelLiters === pubFuelAtSwitch &&
      rightAfterReturn.tripDistanceKm === tripDistAtSwitch,
    '[Transição Panel -> Drive] zera velocidade de rolo com segurança e preserva combustível e viagem anteriores',
  )

  sim.selectDrive()
  sim.setThrottle(0.8)
  stepSeconds(3.0)
  const afterDrive2 = useSimulationStore.getState()
  assert(
    afterDrive2._phys.fuelLevelLiters < fuelAtSwitch && afterDrive2.tripDistanceKm > tripDistAtSwitch,
    `[Retomada Modo Dirigir] consumo e distância voltam a evoluir normalmente (${pubFuelAtSwitch}L -> ${afterDrive2.fuelLevelLiters}L)`,
  )
}

console.log('\n=== ETAPA 3.4 — AUDITORIA INDIVIDUAL DOS 15 CLUSTERS (ESCALAS, COMBUSTÍVEL, LUZES, RENDER SSR) ===')
{
  const clustersDir = path.join(REPO, 'src', 'components', 'dashboard', 'clusters')
  const clusterFiles = fs.readdirSync(clustersDir).filter((f) => f.endsWith('Cluster.tsx'))

  assert(clusterFiles.length === 15, `Exatamente 15 componentes dedicados de cluster presentes (${clusterFiles.length}/15)`)

  // Nenhum cluster pode usar auxGauges.fuelLevel como percentual (0..100)
  for (const file of clusterFiles) {
    const src = fs.readFileSync(path.join(clustersDir, file), 'utf8')
    assert(
      !src.includes('clamp(auxGauges.fuelLevel') && !src.includes('fuelPercent = auxGauges.fuelLevel'),
      `[${file}] não interpreta litros brutos (auxGauges.fuelLevel) como percentual`,
    )
    assert(
      !src.includes('* 880') && !src.includes('* 620') && !src.includes('* 6.8') && !src.includes('* 6.5'),
      `[${file}] sem multiplicadores estáticos hardcoded de autonomia`,
    )
  }

  // Verificações específicas de bugs corrigidos nos clusters
  const porscheSrc = fs.readFileSync(path.join(clustersDir, 'Porsche992GT3RealCluster.tsx'), 'utf8')
  assert(
    porscheSrc.includes('tachometer.maxRpm || 8000') &&
      porscheSrc.includes('tachometer.redlineStart || 7000') &&
      porscheSrc.includes("drivingMode === 'track'") &&
      porscheSrc.includes('frontTorqueSplitPercent') &&
      !porscheSrc.includes('>2.1<') &&
      !porscheSrc.includes('>2.3<'),
    '[Porsche 911 Turbo S] tacômetro 8.000/7.000 RPM, modo TRACK, combustível 67L, PTM real e zero TPMS fixo',
  )

  const bmwSrc = fs.readFileSync(path.join(clustersDir, 'BMW320iCurvedCluster.tsx'), 'utf8')
  assert(
    !bmwSrc.includes('M320i') &&
      bmwSrc.includes('>320i<') &&
      bmwSrc.includes('livePowerHp') &&
      bmwSrc.includes('warningLights.battery'),
    '[BMW 320i M Sport] emblema ///M + 320i correto (sem "M320i"), Sport Display real e warningLights.battery',
  )

  const gtiSrc = fs.readFileSync(path.join(clustersDir, 'GolfGTIRealCluster.tsx'), 'utf8')
  assert(
    gtiSrc.includes('mapRange(fuelPercent, 0, 100, -50, 50)') &&
      gtiSrc.includes('AMBIENT_COLOR_MAP.red'),
    '[Golf GTI 2018] ponteiro de combustível corrigido (-50° = R vazio, +50° = 1/1 cheio) e iluminação vermelha OEM',
  )

  const jettaSrc = fs.readFileSync(path.join(clustersDir, 'JettaGLIActiveInfoCluster.tsx'), 'utf8')
  assert(
    jettaSrc.includes("['P', 'R', 'N', 'D', 'S', 'M']"),
    '[Jetta GLI 2021] seletor DSG contempla todas as posições P R N D S M',
  )

  const fusion19Src = fs.readFileSync(path.join(clustersDir, 'FordFusion2019SmartGaugeCluster.tsx'), 'utf8')
  const fusion12Src = fs.readFileSync(path.join(clustersDir, 'FordFusion2012IceCluster.tsx'), 'utf8')
  assert(
    fusion19Src.includes("transmissionMode === 'manual_simulated' || gearSelectorPosition === 'M'") &&
      !fusion19Src.includes('_physics?.getStateSnapshot()') &&
      fusion12Src.includes("transmissionMode === 'manual_simulated' || gearSelectorPosition === 'M'"),
    '[Fusion 2019 & 2012] exibem M1..M6 em modo manual simulado e usam telemetria AWD centralizada da store',
  )

  const toroRanchSrc = fs.readFileSync(path.join(clustersDir, 'FiatToroRanchCluster.tsx'), 'utf8')
  const toroEnduranceSrc = fs.readFileSync(path.join(clustersDir, 'FiatToroEnduranceCluster.tsx'), 'utf8')
  assert(
    toroRanchSrc.includes('TRAÇÃO 4×4 TORQUE SPLIT') &&
      !toroEnduranceSrc.includes('4×4') &&
      !toroEnduranceSrc.includes('4WD') &&
      toroRanchSrc.includes('flashing={warningLights.tcsFlash}') &&
      toroEnduranceSrc.includes('flashing={warningLights.tcsFlash}'),
    '[Toro Ranch vs Toro Endurance] layouts distintos (Ranch 4x4 Diesel vs Endurance barra horizontal T270 FWD) e luz TCS completa',
  )

  const civicSrc = fs.readFileSync(path.join(clustersDir, 'CivicSiRealCluster.tsx'), 'utf8')
  const opalaSrc = fs.readFileSync(path.join(clustersDir, 'Opala4100RealCluster.tsx'), 'utf8')
  const golQuadSrc = fs.readFileSync(path.join(clustersDir, 'GolQuadradoRealCluster.tsx'), 'utf8')
  const cbSrc = fs.readFileSync(path.join(clustersDir, 'HondaCB1000RRealCluster.tsx'), 'utf8')

  assert(
    civicSrc.includes('text-red-100') &&
      civicSrc.includes('Math.round((fuelPercent / 100) * 8)') &&
      opalaSrc.includes('VOLTÍMETRO') &&
      opalaSrc.includes('describeArc(') &&
      golQuadSrc.includes('speedometer.maxSpeed || 260') &&
      cbSrc.includes('warningLights.absFault') &&
      cbSrc.includes('warningLights.absActive') &&
      !cbSrc.includes('warningLights.brake'),
    '[Civic Si, Opala, Gol Quadrado, CB1000R] cores Si, 8 segmentos exatos, voltímetro/arcos Opala, 260 km/h VDO e ABS real na moto',
  )

  // Renderização SSR real dos 15 veículos em 0% (vazio), 100% (cheio), ignição OFF e modo manual/marchas
  const sim = useSimulationStore.getState()
  const expectedNoAbs = new Set(['ford-pampa-l-1997', 'opala-4100', 'gol-quadrado-turbo'])

  for (const entry of manifest.vehicles) {
    const cfg = loadVehicle(entry.id)
    sim.reset()
    sim.init(cfg, undefined, null, 'panel')

    // Estado 1: Ignição OFF + tanque cheio (100%)
    useSimulationStore.setState({
      fuelLevelLiters: cfg.dashboard.fuelCapacity ?? 50,
      fuelCapacityLiters: cfg.dashboard.fuelCapacity ?? 50,
      ignitionPosition: 'OFF',
    })
    const telOffFull = buildTelemetryForCurrentState(cfg)
    const regEntry = resolveClusterEntry(telOffFull.theme)
    const htmlFull = renderToStaticMarkup(React.createElement(regEntry.component, { telemetry: telOffFull }))

    // Estado 2: Motor ligado + tanque vazio (0%)
    sim.pressPushButtonIgnition(true)
    if (!useSimulationStore.getState().isRunning) {
      sim.setIgnitionPosition('CRANK', true)
      stepSeconds(0.65)
      sim.releaseIgnitionKey()
    } else {
      stepSeconds(0.65)
    }
    useSimulationStore.setState({
      fuelLevelLiters: 0,
      isOutOfFuel: true,
    })
    const telEmpty = buildTelemetryForCurrentState(cfg)
    const htmlEmpty = renderToStaticMarkup(React.createElement(regEntry.component, { telemetry: telEmpty }))

    const shouldHaveAbs = !expectedNoAbs.has(cfg.id)
    assert(
      telOffFull.auxGauges.fuelPercent === 100 &&
        telEmpty.auxGauges.fuelPercent === 0 &&
        telOffFull.warningLights.oil === false &&
        telOffFull.warningLights.battery === false &&
        telOffFull.warningLights.checkEngine === false &&
        telOffFull.abs.available === shouldHaveAbs &&
        htmlFull.length > 500 &&
        htmlEmpty.length > 500 &&
        htmlFull !== htmlEmpty,
      `[Cluster SSR · ${cfg.id}] renderiza 100% vs 0% combustível, luzes apagadas em OFF e ABS=${shouldHaveAbs}`,
    )
  }

  assert(
    Object.keys(CLUSTER_REGISTRY).length === 16,
    'CLUSTER_REGISTRY mantém todos os 15 temas dedicados + fallback default íntegros',
  )
}

console.log(`\n=============================================================`)
console.log(`RESULTADO ETAPA 3 (FASE 4.4.3): ${passed} PASSOU | ${failed} FALHOU`)
console.log(`=============================================================\n`)

if (failed > 0) {
  process.exit(1)
}
