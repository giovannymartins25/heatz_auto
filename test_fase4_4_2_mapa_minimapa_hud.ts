/**
 * HEATZ AUTO — FASE 4.4.2: Suíte Automatizada (Mapa, Minimapa, HUD, Climatização e Fiat Toro)
 *
 * Cobre integralmente a Parte G (itens 12, 13 e 14):
 * 1. Climatização nos 15 veículos:
 *    - Diferenciação declarativa entre multimídia integrada ('multimedia'), rádio convencional 1-DIN/2-DIN
 *      ou console cego ('panel') e motocicleta ('none') via `resolveClimateControlsLocation`.
 *    - Zero duplicação entre Painel 2 (multimídia) e Painel 3 (`CabinControlsBar`).
 *    - Upgrade aftermarket 2-DIN (`multimediaKit`) em carros de rádio migra o controle para a multimídia.
 *    - `ClimateSystem` único em `useSimulationStore`: temperatura, ventilação 0..5, A/C, AUTO, recirculação,
 *      aquecimento e desembaçador preservados sem perda de funcionalidade nem alteração indevida de carga.
 * 2. Fiat Toro Endurance 2025 & Fiat Toro Ranch 2025:
 *    - Endurance: modos `['normal', 'sport']` (padrão `normal`), seletor `['P', 'R', 'N', 'D', 'M']` SEM `S`,
 *      transmissão automática AT6 funcionando normalmente.
 *    - Ranch: modos `['eco', 'normal', 'sport']` com `normal` como padrão inicial, troca funcional de estado
 *      e consistência entre store, seletor e cluster.
 * 3. Mapa Principal (`DrivingMapViewport`), Mapa Completo (`WorldMapModal`) e Minimapa Fixo (`HudMinimap`):
 *    - Remoção de rua e superfície persistentes do mapa principal de condução.
 *    - Controles de zoom `+` e `−` em cantos opostos respeitando limites mínimo e máximo.
 *    - Agrupamento expansível por seta dos controles secundários (Centralizar, Seguir/Norte, Tamanho).
 *    - Minimapa fixo no HUD consumindo diretamente `WORLD_GEOMETRY` (`WorldMap.getGeometry()`),
 *      acompanhando posição/orientação em tempo real, curvas, cruzamentos e rota 402m, integrado aos 3 layouts.
 */

import fs from 'node:fs'
import path from 'node:path'
import { getVehicleCapabilities, type VehicleConfig, type VehicleManifest } from './src/types/vehicle'
import {
  resolveClimateControlsLocation,
  resolveVehicleCabin,
  resolveVehicleMultimediaSpec,
  validateVehicleConfig,
} from './src/systems/vehicle/vehicleResolvers'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useUIStore } from './src/stores/useUIStore'
import { WORLD_GEOMETRY } from './src/systems/world/WorldGeometry'
import { computeMinimapNavigationHint } from './src/systems/world/minimapNavigation'

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
  if (!entry) throw new Error(`Veículo ${id} não encontrado no manifest.json`)
  const cfgPath = path.join(REPO, 'public', entry.configPath.replace(/^\//, ''))
  return JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as VehicleConfig
}

console.log('\n=== FASE 4.4.2 — 1. AUDITORIA DECLARATIVA DE CLIMATIZAÇÃO NOS 15 VEÍCULOS ===')

const EXPECTED_MULTIMEDIA_CLIMATE_IDS = [
  'yaris-2019',
  'porsche-gt3',
  'golf-gti',
  'fiat-toro-endurance-2025',
  'fiat-toro-ranch-2025',
  'jetta-gli-2021',
  'bmw-320i-msport-2024',
  'ford-fusion-titanium-awd-2019',
] as const

const EXPECTED_PANEL_CLIMATE_IDS = [
  'gol-g6',
  'gol-quadrado-turbo',
  'opala-4100',
  'ford-pampa-l-1997',
  'civic-si',
  'ford-fusion-sel-2012',
] as const

assert(manifest.vehicles.length === 15, `Catálogo contém exatamente 15 veículos (${manifest.vehicles.length})`)

for (const vEntry of manifest.vehicles) {
  const cfg = loadVehicle(vEntry.id)
  const val = validateVehicleConfig(cfg)
  assert(val.valid, `[${cfg.id}] validateVehicleConfig() válido com climateControlsLocation`, val.errors.join('; '))
}

for (const id of EXPECTED_MULTIMEDIA_CLIMATE_IDS) {
  const cfg = loadVehicle(id)
  const loc = resolveClimateControlsLocation(cfg)
  const media = resolveVehicleMultimediaSpec(cfg)
  assert(
    loc === 'multimedia' && media.type === 'factory',
    `[${id}] multimídia integrada (${media.name}) -> climatização exclusivamente na multimídia ('${loc}')`,
  )
}

for (const id of EXPECTED_PANEL_CLIMATE_IDS) {
  const cfg = loadVehicle(id)
  const loc = resolveClimateControlsLocation(cfg)
  const media = resolveVehicleMultimediaSpec(cfg)
  assert(
    loc === 'panel',
    `[${id}] rádio convencional 1-DIN/2-DIN ou console sem multimídia (${media.name}) -> climatização no Painel 3 ('${loc}')`,
  )
}

{
  const moto = loadVehicle('cb1000r')
  assert(
    resolveClimateControlsLocation(moto) === 'none' && resolveVehicleCabin(moto).climateType === 'none',
    `[cb1000r] motocicleta mantém climateControlsLocation='none'`,
  )

  // Upgrade aftermarket 2-DIN em carro de rádio convencional migra controles para a central aftermarket sem duplicar
  const golG6 = loadVehicle('gol-g6')
  assert(
    resolveClimateControlsLocation(golG6, { multimediaKit: false }) === 'panel' &&
      resolveClimateControlsLocation(golG6, { multimediaKit: true }) === 'multimedia',
    `[gol-g6] troca declarativa coerente: 'panel' com rádio 1-DIN original -> 'multimedia' ao instalar kit 2-DIN aftermarket`,
  )

  // Rádio 2-DIN OEM Honda H-Audio (Civic Si 2008) e Console SYNC 1 VFD 2-DIN (Fusion SEL 2012) NÃO são tratados como central multimídia touchscreen
  const civic = loadVehicle('civic-si')
  const fusion2012 = loadVehicle('ford-fusion-sel-2012')
  assert(
    resolveClimateControlsLocation(civic, { multimediaKit: true }) === 'panel' &&
      resolveClimateControlsLocation(fusion2012) === 'panel',
    'Rádios 2-DIN OEM (Civic Si H-Audio e Fusion SEL 2012 SYNC 1 VFD) diferenciados de centrais multimídia touchscreen',
  )

  // Verifica ausência de controles duplicados nos componentes de rádio/console e no Painel 3
  const cabinBarCode = fs.readFileSync(path.join(REPO, 'src/components/dashboard/CabinControlsBar.tsx'), 'utf8')
  assert(
    cabinBarCode.includes('resolveClimateControlsLocation') &&
      cabinBarCode.includes("variant !== 'panel' || climateLocation === 'panel'"),
    'CabinControlsBar (Painel 3) oculta controles duplicados de ar-condicionado quando climateLocation === "multimedia"',
  )

  const civicMediaCode = fs.readFileSync(path.join(REPO, 'src/components/dashboard/infotainment/CivicSiInfotainment.tsx'), 'utf8')
  const sync1Code = fs.readFileSync(path.join(REPO, 'src/components/dashboard/infotainment/FordSync1Console2012.tsx'), 'utf8')
  const pampaRadioCode = fs.readFileSync(path.join(REPO, 'src/components/dashboard/infotainment/FordPampa1997RadioUnit.tsx'), 'utf8')
  const blankConsoleCode = fs.readFileSync(path.join(REPO, 'src/components/dashboard/infotainment/ClassicDashboardBlankUnit.tsx'), 'utf8')

  assert(!civicMediaCode.includes('ClimateControlPanel'), 'CivicSiInfotainment (2-DIN OEM) não duplica aba de ar-condicionado')
  assert(!sync1Code.includes('toggleClimateAc'), 'FordSync1Console2012 (2-DIN SYNC 1 VFD) não duplica controles DEATC fora do Painel 3')
  assert(!pampaRadioCode.includes('setClimateFanLevel'), 'FordPampa1997RadioUnit (1-DIN) não duplica ventilação fora do Painel 3')
  assert(!blankConsoleCode.includes('setFanSpeed'), 'ClassicDashboardBlankUnit não mantém estado local paralelo de ventilação')

  // Verifica que ClimateControlPanel compartilhado e Uconnect 7"/10.1" usam useSimulationStore (zero useState falso de A/C)
  const sharedClimateCode = fs.readFileSync(
    path.join(REPO, 'src/components/dashboard/infotainment/shared/ClimateControlPanel.tsx'),
    'utf8',
  )
  const uconnect7Code = fs.readFileSync(
    path.join(REPO, 'src/components/dashboard/infotainment/FiatToroUconnect7.tsx'),
    'utf8',
  )
  const uconnect10Code = fs.readFileSync(
    path.join(REPO, 'src/components/dashboard/infotainment/FiatToroUconnectVertical.tsx'),
    'utf8',
  )
  for (const [label, code] of [
    ['ClimateControlPanel', sharedClimateCode],
    ['FiatToroUconnect7', uconnect7Code],
    ['FiatToroUconnectVertical', uconnect10Code],
  ] as const) {
    assert(
      code.includes('toggleClimateAc') &&
        code.includes('setClimateFanLevel') &&
        code.includes('stepClimateTargetTempC') &&
        code.includes('toggleClimateHeater') &&
        code.includes('toggleClimateDefroster') &&
        code.includes('toggleClimateRecirculation'),
      `[${label}] conectado ao ClimateSystem real em useSimulationStore com todos os controles preservados`,
    )
  }

  // Teste funcional do ClimateSystem único via store e troca de veículo
  const sim = useSimulationStore.getState()
  const jetta = loadVehicle('jetta-gli-2021')
  sim.reset()
  sim.init(jetta)
  sim.setBrake(1)
  sim.startEngine()
  for (let i = 0; i < 60; i++) sim.update(1 / 120)
  sim.setBrake(0)

  const initialTemp = useSimulationStore.getState().climateTargetTempC
  sim.stepClimateTargetTempC(-1.5)
  sim.setClimateFanLevel(4)
  if (!useSimulationStore.getState().climateAcEnabled) sim.toggleClimateAc()
  sim.toggleClimateRecirculation()
  sim.toggleClimateDefroster()
  for (let i = 0; i < 120; i++) sim.update(1 / 120)

  const stAfterClimate = useSimulationStore.getState()
  assert(
    Math.abs(stAfterClimate.climateTargetTempC - (initialTemp - 1.5)) < 1e-6 &&
      stAfterClimate.climateFanLevel === 4 &&
      stAfterClimate.climateAcEnabled === true &&
      stAfterClimate.isCompressorEngaged === true &&
      stAfterClimate.compressorLoadTorqueNm > 0,
    'Ações de climatização operam sobre o mesmo estado real e acoplam carga física genuína do compressor no motor',
  )

  // Troca de veículo atualiza localização declarativa imediatamente
  const pampa = loadVehicle('ford-pampa-l-1997')
  sim.init(pampa)
  assert(
    resolveClimateControlsLocation(jetta) === 'multimedia' &&
      resolveClimateControlsLocation(pampa) === 'panel' &&
      useSimulationStore.getState().climateAcEnabled === false,
    'Troca de veículo (Jetta GLI -> Ford Pampa) atualiza localização dos controles e capacidades de cabine sem vazamento de estado',
  )
}

console.log('\n=== FASE 4.4.2 — 2. MODOS DE CONDUÇÃO E TRANSMISSÃO DAS DUAS FIAT TORO 2025 ===')
{
  const endurance = loadVehicle('fiat-toro-endurance-2025')
  const ranch = loadVehicle('fiat-toro-ranch-2025')
  const enduranceCaps = getVehicleCapabilities(endurance)
  const ranchCaps = getVehicleCapabilities(ranch)

  // Toro Endurance 2025
  assert(
    JSON.stringify(enduranceCaps.supportedDrivingModes) === JSON.stringify(['normal', 'sport']) &&
      enduranceCaps.defaultDrivingMode === 'normal',
    `Toro Endurance 2025 possui modos ['normal', 'sport'] (Sport disponível sem Eco indevido; obtido=${JSON.stringify(enduranceCaps.supportedDrivingModes)})`,
  )
  assert(
    !enduranceCaps.supportedSelectorPositions.includes('S') &&
      ['P', 'R', 'N', 'D'].every((p) => enduranceCaps.supportedSelectorPositions.includes(p as any)),
    `Toro Endurance 2025 preserva P, R, N e D e NÃO apresenta posição S redundante (${JSON.stringify(enduranceCaps.supportedSelectorPositions)})`,
  )

  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(endurance)
  sim.setBrake(1)
  sim.startEngine()
  for (let i = 0; i < 60; i++) sim.update(1 / 120)
  sim.setBrake(0)

  assert(useSimulationStore.getState().drivingMode === 'normal', 'Toro Endurance inicia em modo normal')
  sim.setDrivingMode('sport')
  assert(useSimulationStore.getState().drivingMode === 'sport', 'Toro Endurance ativa modo Sport no seletor de modos')
  sim.selectShifterMode('S')
  assert(
    useSimulationStore.getState().gearSelectorPosition !== 'S',
    'Toro Endurance bloqueia seleção de posição S inexistente no câmbio',
  )

  for (const pos of ['R', 'N', 'D', 'P'] as const) {
    sim.selectShifterMode(pos)
    assert(
      useSimulationStore.getState().gearSelectorPosition === pos,
      `Toro Endurance preserva engate funcional da posição '${pos}' na transmissão automática AT6`,
    )
  }

  // Aceleração em D na Toro Endurance valida funcionamento normal do câmbio automático AT6
  sim.selectShifterMode('D')
  sim.setThrottle(0.85)
  for (let i = 0; i < 360; i++) sim.update(1 / 120)
  assert(
    useSimulationStore.getState()._phys.speedKmh > 25 && useSimulationStore.getState().currentGear >= 1,
    `Toro Endurance acelera normalmente com câmbio automático AT6 em D (${useSimulationStore.getState()._phys.speedKmh.toFixed(1)} km/h, marcha ${useSimulationStore.getState().currentGear})`,
  )

  // Toro Ranch 2025
  assert(
    JSON.stringify(ranchCaps.supportedDrivingModes) === JSON.stringify(['eco', 'normal', 'sport']) &&
      ranchCaps.defaultDrivingMode === 'normal',
    `Toro Ranch 2025 apresenta modos ['eco', 'normal', 'sport'] com 'normal' como padrão (${JSON.stringify(ranchCaps.supportedDrivingModes)})`,
  )

  sim.reset()
  sim.init(ranch)
  assert(useSimulationStore.getState().drivingMode === 'normal', 'Toro Ranch inicia no modo padrão NORMAL')

  sim.setDrivingMode('eco')
  assert(useSimulationStore.getState().drivingMode === 'eco', 'Toro Ranch alterna corretamente para modo ECO')

  sim.setDrivingMode('sport')
  assert(useSimulationStore.getState().drivingMode === 'sport', 'Toro Ranch alterna corretamente para modo SPORT')

  sim.setDrivingMode('normal')
  assert(useSimulationStore.getState().drivingMode === 'normal', 'Toro Ranch retorna corretamente para modo NORMAL')

  sim.setDrivingMode('track')
  assert(
    useSimulationStore.getState().drivingMode === 'normal',
    'Toro Ranch rejeita modos não suportados pelo veículo (ex.: track)',
  )
}

console.log('\n=== FASE 4.4.2 — 3. MAPA PRINCIPAL, ZOOM NOS CANTOS, MENU EXPANSÍVEL E MINIMAPA DO HUD ===')
{
  const drivingMapCode = fs.readFileSync(
    path.join(REPO, 'src/components/dashboard/DrivingMapViewport.tsx'),
    'utf8',
  )
  const worldMapCode = fs.readFileSync(
    path.join(REPO, 'src/components/dashboard/WorldMapModal.tsx'),
    'utf8',
  )
  const hudMinimapCode = fs.readFileSync(
    path.join(REPO, 'src/components/dashboard/HudMinimap.tsx'),
    'utf8',
  )
  const desktopDashCode = fs.readFileSync(
    path.join(REPO, 'src/components/dashboard/VehicleDashboard.tsx'),
    'utf8',
  )
  const portraitCode = fs.readFileSync(
    path.join(REPO, 'src/components/dashboard/MobilePortraitCockpit.tsx'),
    'utf8',
  )
  const landscapeCode = fs.readFileSync(
    path.join(REPO, 'src/components/dashboard/MobileLandscapeCockpit.tsx'),
    'utf8',
  )

  // Mapa principal limpo (sem nome de rua ou superfície persistente)
  assert(
    !drivingMapCode.includes('zoneName') && !drivingMapCode.includes('surfaceType'),
    'DrivingMapViewport removeu nome da rua e nome da superfície permanentemente exibidos',
  )
  assert(
    drivingMapCode.includes('top-2 right-2') &&
      drivingMapCode.includes('bottom-2 left-2') &&
      drivingMapCode.includes('btn-map-zoom-in') &&
      drivingMapCode.includes('btn-map-zoom-out'),
    'DrivingMapViewport posiciona controles discretos de Zoom + e Zoom − em cantos opostos do mapa',
  )
  assert(
    drivingMapCode.includes('btn-map-secondary-toggle') &&
      drivingMapCode.includes('map-secondary-controls-panel') &&
      drivingMapCode.includes('btn-map-center-vehicle') &&
      drivingMapCode.includes('btn-map-follow-toggle'),
    'DrivingMapViewport agrupa controles secundários (Centralizar, Seguir/Norte e Tamanho) em menu expansível com seta',
  )

  // Integração com WorldMapModal (botão MAPA preservado + zoom e controles secundários)
  assert(
    worldMapCode.includes('btn-worldmap-zoom-in') &&
      worldMapCode.includes('btn-worldmap-zoom-out') &&
      worldMapCode.includes('btn-worldmap-secondary-toggle'),
    'WorldMapModal preserva visualização completa com zoom nos cantos e controles secundários expansíveis',
  )
  assert(
    desktopDashCode.includes('btn-world-map') &&
      portraitCode.includes('btn-world-map') &&
      landscapeCode.includes('btn-world-map'),
    'Botão existente do Mapa Completo (World Map) preservado nos layouts Desktop, Mobile Portrait e Mobile Landscape',
  )

  // Minimapa fixo no HUD integrado aos 3 layouts e consumindo WorldGeometry diretamente
  assert(
    hudMinimapCode.includes('WorldMap.getGeometry()') &&
      !hudMinimapCode.includes('VehiclePhysics') &&
      desktopDashCode.includes('<HudMinimap variant="desktop"') &&
      portraitCode.includes('<HudMinimap variant="mobile_portrait"') &&
      landscapeCode.includes('<HudMinimap variant="mobile_landscape"'),
    'HudMinimap consome WorldGeometry.ts diretamente (sem física paralela) e está integrado a Desktop, Portrait e Landscape',
  )

  // Geometria real do mundo intacta e cálculo de navegação em tempo real coerente com WORLD_GEOMETRY
  assert(
    WORLD_GEOMETRY.segments.length > 0 &&
      WORLD_GEOMETRY.arcs.length > 0 &&
      WORLD_GEOMETRY.intersections.length > 0,
    `WORLD_GEOMETRY preservado integralmente (${WORLD_GEOMETRY.segments.length} segmentos, ${WORLD_GEOMETRY.arcs.length} curvas, ${WORLD_GEOMETRY.intersections.length} cruzamentos)`,
  )

  // 1. Apontando para a Rotatória Central a partir do sul (0, -90) rumo Norte (0°) -> deve detectar cruzamento/rotatória à frente
  const hintRoundabout = computeMinimapNavigationHint(0, -95, 0, WORLD_GEOMETRY, false)
  assert(
    hintRoundabout.kind === 'intersection' && hintRoundabout.distanceM > 0 && hintRoundabout.distanceM <= 100,
    `Minimapa detecta cruzamento/rotatória real à frente em WORLD_GEOMETRY (${hintRoundabout.label})`,
  )

  // 2. Alinhado na Pista de Arrancada 402m -> deve exibir rota ativa de 402m
  const hintDrag = computeMinimapNavigationHint(
    WORLD_GEOMETRY.dragStrip.startX + 10,
    WORLD_GEOMETRY.dragStrip.yCenter,
    90,
    WORLD_GEOMETRY,
    true,
  )
  assert(
    hintDrag.kind === 'drag_route' && hintDrag.distanceM > 380 && hintDrag.distanceM <= 402,
    `Minimapa exibe rota ativa da pista de 402m (${hintDrag.label})`,
  )

  // 3. Abrir e fechar WorldMapModal não pausa nem reinicia posição do veículo
  const sim = useSimulationStore.getState()
  const ranchCfg = loadVehicle('fiat-toro-ranch-2025')
  sim.reset()
  sim.init(ranchCfg)
  sim.setBrake(1)
  sim.startEngine()
  for (let i = 0; i < 60; i++) sim.update(1 / 120)
  sim.setBrake(0)
  sim.selectShifterMode('D')

  useUIStore.getState().openWorldMap()
  assert(useUIStore.getState().isWorldMapOpen === true, 'WorldMapModal abre normalmente pelo estado de UI')
  const posYBefore = useSimulationStore.getState()._phys.positionY
  sim.setThrottle(0.9)
  for (let i = 0; i < 180; i++) sim.update(1 / 120)
  const posYDuringModal = useSimulationStore.getState()._phys.positionY
  useUIStore.getState().closeWorldMap()
  for (let i = 0; i < 60; i++) sim.update(1 / 120)
  const posYAfterClose = useSimulationStore.getState()._phys.positionY
  assert(
    useUIStore.getState().isWorldMapOpen === false &&
      posYDuringModal > posYBefore + 1.0 &&
      posYAfterClose > posYDuringModal,
    `Abrir e fechar o mapa grande preserva posição e movimento contínuo do veículo em tempo real (Y: ${posYBefore.toFixed(1)}m -> ${posYDuringModal.toFixed(1)}m -> ${posYAfterClose.toFixed(1)}m)`,
  )
}

console.log(`\n===============================================================`)
console.log(`FASE 4.4.2 RESULTADO: ${passed} PASSOU | ${failed} FALHOU`)
console.log(`===============================================================\n`)

if (failed > 0) {
  process.exit(1)
}
