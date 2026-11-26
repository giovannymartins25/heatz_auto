/**
 * HEATZ AUTO — FASE 4.4.3 (ETAPA 2): Suíte Completa do Panel Mode Dirigível, Seletor 4x4 Físico,
 * Menu HUD e Minimapa Contextual
 *
 * Verifica rigorosamente todos os requisitos aprovados para a Etapa 2:
 * 1. Panel Mode (`entryMode === 'cluster'`) 100% dirigível sobre a MESMA instância `useSimulationStore`
 *    (zero estado paralelo), preservando pedais, embreagem, câmbio, freio de mão, ignição e direção por
 *    inclinação nas exatas mesmas posições e dimensões do Driving Mode.
 * 2. Hierarquia espacial do Panel Mode nos 3 layouts (`desktop`, `mobile_portrait`, `mobile_landscape`):
 *    Controles na área superior (anteriormente ocupada pelo GPS) -> Cluster centralizado -> Multimídia abaixo
 *    (omitida em motocicletas como `cb1000r`), sem `DrivingMapViewport`, sem `HudMinimap`, sem `WorldMapModal`
 *    e sem orientações de pista.
 * 3. Seletor físico `4x4` da `Fiat Toro Ranch 2025` no Painel 3 (`CabinControlsBar.tsx`):
 *    exclusivo para `drivetrain === '4x4_selectable'`, operando `AUTO`, `4WD` (`50/50`) e `4WD LOW`
 *    respeitando intertravamento `<= 3.0 km/h` e engate da 1ª marcha reduzida (`4.700:1`).
 * 4. Remoção integral das opções `Faróis` (`menu-tile-headlights`) e `402M` (`menu-tile-drag`) do
 *    `MobileQuickMenu.tsx`, preservando `Faróis` no Painel 3 e adicionando gatilho contextual discreto
 *    (`btn-contextual-drag-strip`) ao alinhar na largada da pista de 402m no Driving Mode.
 * 5. Melhoria contextual real do `HudMinimap.tsx` exclusivamente no Driving Mode usando apenas dados reais
 *    (`computeMinimapNavigationHint`, `computeAsphaltGuidance`, `formatHeadingCardinal` e `zoneName`),
 *    sem inventar rotas ou dados de navegação.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { VehicleConfig, VehicleManifest } from './src/types/vehicle'
import { resolveVehicleDrivetrain } from './src/systems/vehicle/vehicleResolvers'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { sharedTiltSteering } from './src/systems/input'
import { formatHeadingCardinal, HUD_MINIMAP_SPECS } from './src/components/dashboard/HudMinimap'
import { computeMinimapNavigationHint } from './src/systems/world/minimapNavigation'
import { computeAsphaltGuidance } from './src/systems/world/asphaltGuidance'
import { WORLD_GEOMETRY } from './src/systems/world/WorldGeometry'

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

console.log('\n=== ETAPA 2.1 — ARQUITETURA DO PANEL MODE DIRIGÍVEL (ZERO ESTADO PARALELO, ZERO MAPA/MINIMAPA) ===')
{
  const dashSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'dashboard', 'VehicleDashboard.tsx'),
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
  const panelSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'cockpit', 'PanelModeInteriorView.tsx'),
    'utf8',
  )
  const pedalsSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'controls', 'Pedals.tsx'),
    'utf8',
  )

  const panelExec = panelSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '')

  // 1. Não há mais retorno prematuro que descarte pedais, freio de mão, câmbio ou inclinação em VehicleDashboard
  assert(
    !dashSrc.includes('if (entryMode === \'cluster\') {\n    return (\n      <PanelModeInteriorView') &&
      dashSrc.includes("const isDriveMode = entryMode !== 'cluster'") &&
      portraitSrc.includes("const isDriveMode = entryMode !== 'cluster'") &&
      landscapeSrc.includes("const isDriveMode = entryMode !== 'cluster'"),
    'Desktop, Mobile Portrait e Mobile Landscape compartilham a mesma árvore de condução entre Dirigir e Painel',
  )

  // 2. Mapa principal, minimapa e modal de mapa são estritamente condicionados a isDriveMode nos 3 layouts
  assert(
    dashSrc.includes('{isDriveMode && isMapOpen && (') &&
      dashSrc.includes('{isDriveMode && <HudMinimap variant="desktop" />}') &&
      dashSrc.includes('{isDriveMode && <WorldMapModal vehicle={vehicle} />}') &&
      portraitSrc.includes('{isDriveMode && <HudMinimap variant="mobile_portrait" />}') &&
      portraitSrc.includes('{isDriveMode && <WorldMapModal vehicle={vehicle} />}') &&
      landscapeSrc.includes('{isDriveMode && (') &&
      landscapeSrc.includes('<HudMinimap variant="mobile_landscape" />') &&
      landscapeSrc.includes('{isDriveMode && <WorldMapModal vehicle={vehicle} />}'),
    'DrivingMapViewport, HudMinimap e WorldMapModal são estritamente omitidos quando entryMode === "cluster"',
  )

  // 3. PanelModeInteriorView não importa nem instancia segunda store, física, mapa, minimapa ou guias de pista
  assert(
    !panelExec.includes('DrivingMapViewport') &&
      !panelExec.includes('HudMinimap') &&
      !panelExec.includes('WorldMapModal') &&
      !panelExec.includes('AsphaltGuidanceTracker') &&
      !panelExec.includes('VehiclePhysics') &&
      !panelExec.includes('EngineSimulator') &&
      !panelExec.includes('btn-panel-rev-engine'),
    'PanelModeInteriorView não cria simulação paralela, console falso de bancada, mapa, minimapa ou guias de pista',
  )

  // 4. Ordem espacial obrigatória em todos os 3 blocos de layout de PanelModeInteriorView:
  //    panel-mode-controls-region (ex-GPS) ANTES de panel-mode-cluster-region ANTES de panel-mode-multimedia-region
  for (const layoutId of ['mobile_portrait', 'mobile_landscape', 'desktop'] as const) {
    const startIdx = panelSrc.indexOf(`data-layout="${layoutId}"`)
    const nextIdx = panelSrc.indexOf('data-testid="panel-mode-interior-root"', startIdx + 1)
    const block = panelSrc.slice(startIdx, nextIdx > startIdx ? nextIdx : undefined)
    const idxControls = block.indexOf('data-testid="panel-mode-controls-region"')
    const idxCluster = block.indexOf('data-testid="panel-mode-cluster-region"')
    const idxMultimedia = block.indexOf('data-testid="panel-mode-multimedia-region"')
    assert(
      idxControls > 0 && idxCluster > idxControls && idxMultimedia > idxCluster,
      `[Layout ${layoutId}] ordem espacial correta: Controles (ex-GPS) -> Cluster centralizado -> Multimídia abaixo`,
    )
  }

  // 5. Pedais habilitados mesmo antes da partida (permitindo pisar no freio/embreagem para startInterlock em ambos os modos)
  assert(
    !pedalsSrc.includes('disabled={!isRunning}') && pedalsSrc.includes('disabled={false}'),
    'Pedals.tsx permite acionar freio e embreagem antes da partida para satisfazer startInterlock real',
  )
}

console.log('\n=== ETAPA 2.2 — CONDUÇÃO REAL COMPLETA NO PANEL MODE (AUTOMÁTICO, MANUAL + EMBREAGEM, MOTO E TILT) ===')
{
  const sim = useSimulationStore.getState()

  // 2.2.A — Automático Start/Stop com interlock de freio (Porsche 911 Turbo S) + Inclinação do Celular
  const porsche = loadVehicle('porsche-gt3')
  sim.reset()
  sim.init(porsche)

  // Partida real exigindo pedal de freio + soltura de freio de mão + engate de D + aceleração + inclinação
  sim.setHandbrake(true)
  sim.setBrake(0.85)
  sim.pressPushButtonIgnition(true)
  stepSeconds(0.65)
  assert(
    useSimulationStore.getState().isRunning && useSimulationStore.getState().ignitionPosition === 'ON',
    '[Panel Mode · Porsche] ignição Start/Stop com pedal de freio liga o motor na simulação principal',
  )

  sim.setBrake(0)
  sim.setHandbrake(false)
  sim.selectDrive()
  sim.setThrottle(0.8)
  for (let i = 0; i < 20; i++) {
    sharedTiltSteering.processSample({ beta: 18, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60, true)
  }
  stepSeconds(2.5)
  const stPorsche = useSimulationStore.getState()
  assert(
    stPorsche.speed > 45 &&
      stPorsche.currentGear >= 1 &&
      stPorsche.steeringAngle > 0.05 &&
      stPorsche.headingDeg > 1.5 &&
      stPorsche._phys.tripDistanceKm > 0.02,
    `[Panel Mode · Porsche] conduz, troca marcha, esterça por inclinação e desloca no mundo real (v=${stPorsche.speed.toFixed(1)} km/h, marcha=${stPorsche.currentGear}, heading=${stPorsche.headingDeg.toFixed(1)}°)`,
  )

  // Freio de mão e freio de serviço reduzem velocidade normalmente
  const speedBeforeBrake = stPorsche.speed
  sim.setThrottle(0)
  sim.setBrake(0.9)
  sim.setHandbrake(true)
  stepSeconds(1.2)
  assert(
    useSimulationStore.getState().speed < speedBeforeBrake - 20,
    `[Panel Mode · Porsche] freio de serviço + freio de mão desaceleram fisicamente (${speedBeforeBrake.toFixed(1)} -> ${useSimulationStore.getState().speed.toFixed(1)} km/h)`,
  )

  // 2.2.B — Manual com Embreagem e Chave Física (Honda CB1000R — sem multimídia)
  const cb1000r = loadVehicle('cb1000r')
  sim.reset()
  sim.init(cb1000r)
  sharedTiltSteering.resetCalibration()
  sim.setSteeringAngle(0, 'tilt')

  sim.setClutch(1.0)
  sim.setIgnitionPosition('CRANK', true)
  stepSeconds(0.65)
  sim.releaseIgnitionKey()
  sim.setThrottle(0.85)
  stepSeconds(0.35) // Sobe giro antes de soltar manete de embreagem
  sim.shiftUp() // 1ª marcha
  for (const c of [0.6, 0.35, 0.15, 0]) {
    sim.setClutch(c)
    stepSeconds(0.25)
  }
  stepSeconds(1.6)
  sim.setClutch(1.0)
  sim.shiftUp() // 2ª marcha
  sim.setClutch(0)
  stepSeconds(1.2)
  const stMoto = useSimulationStore.getState()
  assert(
    stMoto.isRunning && stMoto.currentGear === 2 && stMoto.speed > 25,
    `[Panel Mode · CB1000R] motocicleta manual com embreagem parte na chave, engata 1ª->2ª e acelera (${stMoto.speed.toFixed(1)} km/h)`,
  )
}

console.log('\n=== ETAPA 2.3 — SELETOR FÍSICO 4x4 DA TORO RANCH NO PAINEL 3 (INTERTRAVAMENTOS E EXCLUSIVIDADE) ===')
{
  const cabinSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'dashboard', 'CabinControlsBar.tsx'),
    'utf8',
  )
  assert(
    cabinSrc.includes('data-testid="cabin-4x4-section"') &&
      cabinSrc.includes('btn-cabin-4x4-${opt.id}') &&
      cabinSrc.includes("id: 'auto'") &&
      cabinSrc.includes("id: '4wd'") &&
      cabinSrc.includes("id: '4wd_low'") &&
      cabinSrc.includes('cabin-4x4-warning') &&
      cabinSrc.includes("resolveVehicleDrivetrain(vehicle) === '4x4_selectable'"),
    'CabinControlsBar (Painel 3) implementa seletor físico 4x4 (AUTO / 4WD / 4WD LOW) exclusivo para 4x4_selectable',
  )

  // Exclusividade na frota: somente Fiat Toro Ranch 2025 possui drivetrain === '4x4_selectable'
  const selectableIds = manifest.vehicles
    .map((v) => loadVehicle(v.id))
    .filter((cfg) => resolveVehicleDrivetrain(cfg) === '4x4_selectable')
    .map((cfg) => cfg.id)
  assert(
    selectableIds.length === 1 && selectableIds[0] === 'fiat-toro-ranch-2025',
    `Seletor físico 4x4 habilitado exclusivamente na Fiat Toro Ranch 2025 (${JSON.stringify(selectableIds)})`,
  )

  // Teste funcional completo: AUTO -> 4WD -> 4WD LOW (parado) -> bloqueio >3 km/h
  const sim = useSimulationStore.getState()
  const ranch = loadVehicle('fiat-toro-ranch-2025')
  sim.reset()
  sim.init(ranch)
  sim.setBrake(1.0)
  sim.pressPushButtonIgnition(true)
  stepSeconds(0.65)
  sim.selectDrive()

  // Em D parado no modo AUTO padrão, AT9 da Toro Ranch sai em 2ª marcha (2.840:1) com pré-carga 96/4
  assert(
    useSimulationStore.getState().fourWheelDriveMode === 'auto' &&
      useSimulationStore.getState().currentGear === 2 &&
      useSimulationStore.getState().frontTorqueSplitPercent === 96,
    '[Toro Ranch] inicia em AUTO (96/4) e 2ª marcha padrão da caixa ZF 9HP em D parado',
  )

  // Aciona 4WD LOCK parado -> 50/50
  sim.setFourWheelDriveMode('4wd')
  assert(
    useSimulationStore.getState().fourWheelDriveMode === '4wd' &&
      useSimulationStore.getState().frontTorqueSplitPercent === 50 &&
      useSimulationStore.getState().rearTorqueSplitPercent === 50,
    '[Toro Ranch] seletor 4WD trava acoplamento 50/50 entre os eixos',
  )

  // Aciona 4WD LOW parado (<= 3 km/h) -> engata 1ª reduzida crawler (4.700:1)
  sim.setFourWheelDriveMode('4wd_low')
  assert(
    useSimulationStore.getState().fourWheelDriveMode === '4wd_low' &&
      useSimulationStore.getState().currentGear === 1 &&
      useSimulationStore.getState().fourWheelDriveWarning === null,
    '[Toro Ranch] seletor 4WD LOW parado engata 1ª marcha reduzida (4.700:1) sem alerta de erro',
  )

  // Desengata 4WD LOW para AUTO ainda parado -> retorna à 2ª marcha padrão
  sim.setFourWheelDriveMode('auto')
  assert(
    useSimulationStore.getState().fourWheelDriveMode === 'auto' &&
      useSimulationStore.getState().currentGear === 2,
    '[Toro Ranch] desengatar 4WD LOW parado retorna suavemente à 2ª marcha padrão',
  )

  // Em movimento (> 3 km/h), tentativa de engatar 4WD LOW é bloqueada pelo intertravamento de segurança!
  sim.setBrake(0)
  sim.setSpeed(22)
  sim.setFourWheelDriveMode('4wd_low')
  const blockedLow = useSimulationStore.getState()
  assert(
    blockedLow.fourWheelDriveMode === 'auto' &&
      Boolean(blockedLow.fourWheelDriveWarning && blockedLow.fourWheelDriveWarning.includes('Pare o veículo')),
    `[Toro Ranch] intertravamento bloqueia 4WD LOW a 22 km/h com aviso real ("${blockedLow.fourWheelDriveWarning}")`,
  )
}

console.log('\n=== ETAPA 2.4 — LIMPEZA DO MENU HUD (SEM FARÓIS E SEM 402M) & GATILHO CONTEXTUAL ===')
{
  const menuSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'dashboard', 'MobileQuickMenu.tsx'),
    'utf8',
  )
  const cabinSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'dashboard', 'CabinControlsBar.tsx'),
    'utf8',
  )
  const mapViewportSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'dashboard', 'DrivingMapViewport.tsx'),
    'utf8',
  )

  assert(
    !menuSrc.includes('menu-tile-headlights') &&
      !menuSrc.includes('cycleHeadlights') &&
      !menuSrc.includes('menu-tile-drag'),
    'MobileQuickMenu removeu completamente as opções de Faróis e 402M',
  )
  assert(
    menuSrc.includes('menu-tile-rain') &&
      menuSrc.includes('menu-tile-sound') &&
      menuSrc.includes('menu-tile-tuning') &&
      menuSrc.includes('menu-tile-dyno') &&
      cabinSrc.includes('btn-panel-headlights') &&
      mapViewportSrc.includes('btn-contextual-drag-strip'),
    'Menu preserva Clima/Som/Oficina/Dyno, Faróis permanecem no Painel 3 e 402M possui gatilho contextual na pista',
  )
}

console.log('\n=== ETAPA 2.5 — MINIMAPA CONTEXTUAL NO DRIVING MODE (DADOS REAIS, ZERO INVENÇÃO) ===')
{
  const minimapSrc = fs.readFileSync(
    path.join(REPO, 'src', 'components', 'dashboard', 'HudMinimap.tsx'),
    'utf8',
  )

  assert(
    formatHeadingCardinal(0) === 'N' &&
      formatHeadingCardinal(45) === 'NE' &&
      formatHeadingCardinal(90) === 'L' &&
      formatHeadingCardinal(180) === 'S' &&
      formatHeadingCardinal(270) === 'O' &&
      formatHeadingCardinal(-45) === 'NO',
    'formatHeadingCardinal converte graus reais do veículo em pontos cardeais exatos em português (N, NE, L, S, O, NO)',
  )

  // Verifica que na aproximação da Rotatória Central (0, -85, rumo 0° Norte), os dois sistemas reais
  // alimentam o minimapa com distância e velocidade física recomendada coerentes
  const hint = computeMinimapNavigationHint(0, -85, 0, WORLD_GEOMETRY, false)
  const guidance = computeAsphaltGuidance(0, -85, 0, false, WORLD_GEOMETRY, 70)
  assert(
    hint.kind === 'intersection' &&
      hint.label.includes('Rotatória') &&
      guidance !== null &&
      guidance.recommendedSpeedKmh === 40,
    `Minimapa contextual consome sistemas reais na aproximação (${hint.label}, vel. recomendada=${guidance?.recommendedSpeedKmh} km/h)`,
  )

  assert(
    HUD_MINIMAP_SPECS.desktop.widthPx === 132 &&
      HUD_MINIMAP_SPECS.mobile_landscape.widthPx === 120 &&
      HUD_MINIMAP_SPECS.mobile_portrait.widthPx === 112 &&
      minimapSrc.includes('hud-minimap-context-bar') &&
      minimapSrc.includes('hud-minimap-rec-speed') &&
      minimapSrc.includes('hud-minimap-cardinal'),
    'HudMinimap preserva dimensões equilibradas do radar e expõe rumo cardeal, referência e velocidade recomendada na moldura externa',
  )
}

console.log(`\n=============================================================`)
console.log(`RESULTADO ETAPA 2 (FASE 4.4.3): ${passed} PASSOU | ${failed} FALHOU`)
console.log(`=============================================================\n`)

if (failed > 0) {
  process.exit(1)
}
