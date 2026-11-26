/**
 * HEATZ AUTO — FASE 4.4.2.1: Suíte Automatizada de Refinamento do Cockpit, Minimap e Arquitetura de Controles
 *
 * Valida integralmente os requisitos das Seções 1 a 8 da Fase 4.4.2.1:
 * 1. Minimapa compacto, discreto e simplificado (`HudMinimap.tsx`):
 *    - Dimensões significativamente reduzidas, zoom próximo dedicado (`>= 1.75 px/m`), veículo centralizado (50%×50%),
 *      alternância de orientação (`heading_up` / `north_up`) preservada e zero textos/rotas de navegação sobrepostos.
 * 2. Orientação de velocidade e saídas diretamente no asfalto (`asphaltGuidance.ts` + `DrivingWorldCanvas.tsx`):
 *    - Velocidade recomendada calculada geometricamente e fisicamente a partir de `WORLD_GEOMETRY` + atrito real (`isRaining`),
 *      variando entre entroncamento em T (30 km/h), curva fechada/rotatória (40 km/h), curva média (55 km/h) e curva rápida (75 km/h).
 *    - Setas de saída derivadas da conectividade real dos segmentos (sem rota obrigatória e sem inventar saídas).
 *    - Máximo de 1 marcação ativa por vez, ancorada no espaço métrico do asfalto antes de obstáculos, marcas de pneu e veículo.
 * 3. Novo rodapé das centrais multimídia (`MultimediaStatusFooter.tsx`):
 *    - Formato `HH:mm | INTERIOR XX°C | EXTERIOR YY°C` usando `cabinTempC` e `ambientTempC` reais da simulação (`ClimateSystem`),
 *      substituindo o rodapé antigo de setpoint de A/C.
 * 4. Remoção do controle de tração do topo do HUD e preservação da buzina nos 3 layouts.
 * 5. Arquitetura declarativa `VehicleControlsSpec` + auditoria individual dos 15 veículos sem duplicação entre Painel 2 e Painel 3,
 *    e preparação declarativa de `driverAssists` (`pending_sensors`) sem simulação autônoma falsa.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { VehicleConfig, VehicleManifest } from './src/types/vehicle'
import {
  resolveClimateControlsLocation,
  resolveVehicleControls,
  validateVehicleConfig,
} from './src/systems/vehicle/vehicleResolvers'
import { computeAsphaltGuidance } from './src/systems/world/asphaltGuidance'
import { WORLD_GEOMETRY } from './src/systems/world/WorldGeometry'
import { useSimulationStore } from './src/stores/useSimulationStore'

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

console.log('\n=== FASE 4.4.2.1 — 1. MINIMAPA COMPACTO, DISCRETO E SIMPLIFICADO ===')
{
  const minimapCode = fs.readFileSync(
    path.join(REPO, 'src/components/dashboard/HudMinimap.tsx'),
    'utf8',
  )
  assert(
    minimapCode.includes('w-[132px] h-[82px]') &&
      minimapCode.includes('w-[120px] h-[68px]') &&
      minimapCode.includes('w-[112px] h-[66px]'),
    'HudMinimap utiliza dimensões equilibradas de radar nos layouts Desktop, Landscape e Portrait (evoluído na Fase 4.4.2.2)',
  )
  assert(
    minimapCode.includes('0.56') && minimapCode.includes('0.50') && minimapCode.includes('0.48'),
    'HudMinimap utiliza zoom radar dedicado (0.48–0.56 px/m) distinto do mapa principal (evoluído na Fase 4.4.2.2)',
  )
  assert(
    minimapCode.includes('cssW * 0.5') &&
      minimapCode.includes('headingUpAnchorYRatio'),
    'HudMinimap mantém o veículo como referência central horizontal priorizando a área à frente (Fase 4.4.2.2)',
  )
  assert(
    minimapCode.includes('btn-hud-minimap-orientation') &&
      minimapCode.includes("'heading_up'") &&
      minimapCode.includes("'north_up'"),
    'HudMinimap preserva a alternância de orientação heading_up ↔ north_up',
  )
  assert(
    !minimapCode.includes('hud-minimap-nav-hint') &&
      minimapCode.includes('hud-minimap-context-bar') &&
      minimapCode.includes('computeMinimapNavigationHint') &&
      minimapCode.includes('computeAsphaltGuidance'),
    'HudMinimap mantém o canvas interno sem textos sobrepostos às vias e exibe micro-barra contextual externa real (Fase 4.4.3)',
  )
}

console.log('\n=== FASE 4.4.2.1 — 2. ORIENTAÇÃO DE VELOCIDADE E SAÍDAS DIRETA NO ASFALTO ===')
{
  const worldCanvasCode = fs.readFileSync(
    path.join(REPO, 'src/components/dashboard/DrivingWorldCanvas.tsx'),
    'utf8',
  )
  const guidanceIdx = worldCanvasCode.lastIndexOf('guidanceTrackerRef.current.update(')
  const skidIdx = worldCanvasCode.indexOf('SKID MARKS AGRUPADOS')
  assert(
    guidanceIdx > 0 &&
      guidanceIdx < skidIdx &&
      worldCanvasCode.includes('if (!overviewMode && !isReverse)'),
    'Marcação de velocidade/saídas é desenhada diretamente na camada do asfalto em coordenadas do mundo (antes de pneus/carro e oculta no overview)',
  )

  // 2.1 Rotatória Central (0, -85 rumo Norte 0°)
  const gRoundDry = computeAsphaltGuidance(0, -85, 0, false, WORLD_GEOMETRY)
  const gRoundWet = computeAsphaltGuidance(0, -85, 0, true, WORLD_GEOMETRY)
  assert(
    gRoundDry !== null &&
      gRoundDry.featureId === 'int-rotatoria' &&
      gRoundDry.exitArrows.includes('roundabout') &&
      gRoundDry.recommendedSpeedKmh === 40,
    `Rotatória Central calcula velocidade física coerente em piso seco (${gRoundDry?.recommendedSpeedKmh} km/h, setas=${JSON.stringify(gRoundDry?.exitArrows)})`,
  )
  assert(
    gRoundWet !== null && gRoundWet.recommendedSpeedKmh < gRoundDry!.recommendedSpeedKmh,
    `Velocidade recomendada no asfalto reduz automaticamente sob chuva (${gRoundDry?.recommendedSpeedKmh} -> ${gRoundWet?.recommendedSpeedKmh} km/h)`,
  )

  // 2.2 Entroncamento em T sem passagem reta: int-ne-anel-norte (140, 230) na aproximação pela ligação norte (140, 200 rumo Norte 0°)
  const gT = computeAsphaltGuidance(140, 200, 0, false, WORLD_GEOMETRY)
  assert(
    gT !== null &&
      gT.featureId === 'int-ne-anel-norte' &&
      JSON.stringify(gT.exitArrows) === JSON.stringify(['left', 'right']) &&
      gT.recommendedSpeedKmh === 30,
    `Entroncamento em T (int-ne-anel-norte) exibe apenas saídas reais ['left','right'] sem seta reta falsa e 30 km/h (obtido=${gT?.recommendedSpeedKmh} km/h, ${JSON.stringify(gT?.exitArrows)})`,
  )

  // 2.3 Cruzamento completo com continuação reta: int-norte-anel (0, 230) vindo da Av. Norte (0, 175 rumo Norte 0°)
  const gCross = computeAsphaltGuidance(0, 175, 0, false, WORLD_GEOMETRY)
  assert(
    gCross !== null &&
      gCross.featureId === 'int-norte-anel' &&
      JSON.stringify(gCross.exitArrows) === JSON.stringify(['left', 'straight', 'right']),
    `Cruzamento 4 ramos (int-norte-anel) deriva ['left','straight','right'] da geometria real (${JSON.stringify(gCross?.exitArrows)})`,
  )

  // 2.4 Diferenciação física real por raio de curva em WORLD_GEOMETRY:
  // - Curva Fechada NE (curva-fechada-ne, R=25m, entrada em (70, 115) vindo do Oeste rumo Leste 90° em (32, 115))
  const gHairpin = computeAsphaltGuidance(32, 115, 90, false, WORLD_GEOMETRY)
  // - Curva Média NE (curva-media-ne, R=45m, entrada em (140, 185) vindo do Leste rumo Oeste 270° em (185, 185))
  const gMedCurve = computeAsphaltGuidance(185, 185, 270, false, WORLD_GEOMETRY)
  // - Circuito de Handling Rápido (circuito-handling, R=80m, entrada em (-60, 140) vindo do Leste rumo Oeste 270° em (-22, 140))
  const gFastCurve = computeAsphaltGuidance(-22, 140, 270, false, WORLD_GEOMETRY)

  assert(
    gHairpin !== null &&
      gMedCurve !== null &&
      gFastCurve !== null &&
      gHairpin.recommendedSpeedKmh < gMedCurve.recommendedSpeedKmh &&
      gMedCurve.recommendedSpeedKmh < gFastCurve.recommendedSpeedKmh,
    `Velocidades variam fisicamente conforme o raio real da curva: R=25m (${gHairpin?.recommendedSpeedKmh} km/h) < R=45m (${gMedCurve?.recommendedSpeedKmh} km/h) < R=80m (${gFastCurve?.recommendedSpeedKmh} km/h)`,
  )

  // 2.5 Reta limpa da Drag Strip 402m não inventa marcação
  const gDragStraight = computeAsphaltGuidance(180, 52, 90, false, WORLD_GEOMETRY)
  assert(
    gDragStraight === null,
    'Reta aberta da Pista de Arrancada 402m sem curvas/cruzamentos à frente não exibe marcação desnecessária',
  )
}

console.log('\n=== FASE 4.4.2.1 — 3. RODAPÉ PADRONIZADO DA MULTIMÍDIA (HORA LOCAL | INTERIOR | EXTERIOR) ===')
{
  const footerCode = fs.readFileSync(
    path.join(REPO, 'src/components/dashboard/infotainment/shared/MultimediaStatusFooter.tsx'),
    'utf8',
  )
  assert(
    footerCode.includes('s.cabinTempC') &&
      footerCode.includes('s.ambientTempC') &&
      !footerCode.includes('climateTargetTempC') &&
      footerCode.includes('INTERIOR') &&
      footerCode.includes('EXTERIOR'),
    'MultimediaStatusFooter consome cabinTempC (INTERIOR) e ambientTempC (EXTERIOR) do ClimateSystem, sem confundir com temperatura alvo do A/C',
  )

  const multimediaFiles = [
    'src/components/dashboard/infotainment/BMWiDrive8Curved.tsx',
    'src/components/dashboard/infotainment/PorschePCM6.tsx',
    'src/components/dashboard/infotainment/GolfGTIDiscoverPro.tsx',
    'src/components/dashboard/infotainment/JettaDiscoverMedia8.tsx',
    'src/components/dashboard/infotainment/FordSync3Titanium8.tsx',
    'src/components/dashboard/infotainment/ToyotaSmartConnect.tsx',
    'src/components/dashboard/infotainment/FiatToroUconnect7.tsx',
    'src/components/dashboard/infotainment/FiatToroUconnectVertical.tsx',
    'src/components/dashboard/infotainment/Retrofit2DinInfotainment.tsx',
    'src/components/dashboard/infotainment/CivicSiInfotainment.tsx',
    'src/components/dashboard/infotainment/VehicleMultimedia.tsx',
  ]
  for (const relPath of multimediaFiles) {
    const code = fs.readFileSync(path.join(REPO, relPath), 'utf8')
    assert(
      code.includes('<MultimediaStatusFooter'),
      `[${path.basename(relPath)}] integra o novo rodapé padronizado <MultimediaStatusFooter />`,
    )
  }

  const bmwCode = fs.readFileSync(
    path.join(REPO, 'src/components/dashboard/infotainment/BMWiDrive8Curved.tsx'),
    'utf8',
  )
  assert(
    !bmwCode.includes('❄️ {climateTargetTempC.toFixed(1)}°C'),
    'BMWiDrive8Curved substituiu o antigo rodapé de graus alvo do A/C pelo novo rodapé informativo',
  )

  // Verifica evolução dinâmica real de cabinTempC e ambientTempC no ClimateSystem
  const sim = useSimulationStore.getState()
  const bmw = loadVehicle('bmw-320i-msport-2024')
  sim.reset()
  sim.init(bmw)
  const extDry = useSimulationStore.getState().ambientTempC
  sim.toggleRain()
  for (let i = 0; i < 240; i++) sim.update(1 / 120)
  const extRain = useSimulationStore.getState().ambientTempC
  assert(
    extRain < extDry,
    `Temperatura externa simulada (ambientTempC) responde deterministicamente ao ambiente (${extDry.toFixed(1)}°C seco -> ${extRain.toFixed(1)}°C sob chuva)`,
  )
}

console.log('\n=== FASE 4.4.2.1 — 4. REMOÇÃO DO TCS DO TOPO DO HUD E PRESERVAÇÃO DA BUZINA ===')
{
  for (const relPath of [
    'src/components/dashboard/MobilePortraitCockpit.tsx',
    'src/components/dashboard/MobileLandscapeCockpit.tsx',
    'src/components/dashboard/VehicleDashboard.tsx',
  ]) {
    const code = fs.readFileSync(path.join(REPO, relPath), 'utf8')
    assert(
      !code.includes('btn-tcs-toggle') && !code.includes('setTcsEnabled') && code.includes('setHorn'),
      `[${path.basename(relPath)}] removeu botão TCS do HUD superior e preservou a buzina (setHorn)`,
    )
  }
}

console.log('\n=== FASE 4.4.2.1 — 5. ARQUITETURA DECLARATIVA DE CONTROLES E AUDITORIA DOS 15 VEÍCULOS ===')
{
  const EXPECTED_DIGITAL_MULTIMEDIA_TCS = new Set([
    'bmw-320i-msport-2024',
    'golf-gti',
    'jetta-gli-2021',
    'ford-fusion-titanium-awd-2019',
  ])
  const EXPECTED_PHYSICAL_PANEL_TCS = new Set([
    'porsche-gt3',
    'yaris-2019',
    'fiat-toro-endurance-2025',
    'fiat-toro-ranch-2025',
    'ford-fusion-sel-2012',
    'civic-si',
    'cb1000r',
  ])
  const EXPECTED_NO_TCS = new Set([
    'gol-g6',
    'gol-quadrado-turbo',
    'opala-4100',
    'ford-pampa-l-1997',
  ])

  for (const vEntry of manifest.vehicles) {
    const cfg = loadVehicle(vEntry.id)
    const val = validateVehicleConfig(cfg)
    assert(
      val.valid && Boolean(cfg.controls),
      `[${cfg.id}] config.controls declarativo presente e validado por validateVehicleConfig()`,
      val.errors.join('; '),
    )

    const resolved = resolveVehicleControls(cfg)
    const tcs = resolved.tractionControl

    if (EXPECTED_DIGITAL_MULTIMEDIA_TCS.has(cfg.id)) {
      assert(
        tcs.available && tcs.userToggleable && tcs.panel === 'multimedia' && tcs.controlType === 'digital',
        `[${cfg.id}] TCS digital posicionado exclusivamente na Multimídia / Painel 2 (${tcs.systemLabel})`,
      )
    } else if (EXPECTED_PHYSICAL_PANEL_TCS.has(cfg.id)) {
      assert(
        tcs.available && tcs.userToggleable && tcs.panel === 'controls' && tcs.controlType === 'physical',
        `[${cfg.id}] TCS físico posicionado exclusivamente nos Controles / Painel 3 (${tcs.systemLabel})`,
      )
    } else if (EXPECTED_NO_TCS.has(cfg.id)) {
      assert(
        !tcs.available && !tcs.userToggleable && tcs.panel === 'none' && tcs.controlType === 'none',
        `[${cfg.id}] veículo sem TCS de fábrica não expõe comando em nenhum painel`,
      )
    }

    // Assistências de condução: todas as disponíveis devem estar marcadas como pending_sensors (sem simulação falsa)
    for (const [assistName, assist] of Object.entries(resolved.driverAssists)) {
      if (assist.available) {
        assert(
          assist.implementationState === 'pending_sensors',
          `[${cfg.id}] ${assistName} modelado declarativamente com implementationState='pending_sensors'`,
        )
      }
    }
  }

  // Teste de rejeição semântica de config inconsistente
  const brokenCfg = structuredClone(loadVehicle('gol-g6'))
  brokenCfg.controls!.tractionControl = {
    available: false,
    confirmationStatus: 'confirmed',
    userToggleable: true,
    controlType: 'physical',
    panel: 'controls',
    systemLabel: 'FAKE',
  }
  const brokenValidation = validateVehicleConfig(brokenCfg)
  assert(
    !brokenValidation.valid && brokenValidation.errors.length > 0,
    'validateVehicleConfig() rejeita conflito declarativo (TCS indisponível com userToggleable=true)',
  )

  // Fase 4.4.3: Preservação dos controles físicos de ventilação no Painel 3 mesmo com upgrade aftermarket 2-DIN
  const pampa = loadVehicle('ford-pampa-l-1997')
  assert(
    resolveVehicleControls(pampa, { multimediaKit: false }).climate.panel === 'controls' &&
      resolveVehicleControls(pampa, { multimediaKit: true }).climate.panel === 'controls' &&
      resolveClimateControlsLocation(pampa, { multimediaKit: false }) === 'panel' &&
      resolveClimateControlsLocation(pampa, { multimediaKit: true }) === 'panel',
    'resolveVehicleControls e resolveClimateControlsLocation preservam controles físicos no Painel 3 com e sem upgrade aftermarket',
  )

  // Teste funcional em runtime da store para veículos com e sem TCS
  const sim = useSimulationStore.getState()
  const porsche = loadVehicle('porsche-gt3')
  sim.reset()
  sim.init(porsche)
  assert(useSimulationStore.getState().tcsEnabled === true, '[porsche-gt3] inicia com PSM/TCS ativo')
  sim.setTcsEnabled(false)
  assert(useSimulationStore.getState().tcsEnabled === false, '[porsche-gt3] comando desativa TCS real na simulação')
  sim.setTcsEnabled(true)
  assert(useSimulationStore.getState().tcsEnabled === true, '[porsche-gt3] comando reativa TCS real na simulação')

  const opala = loadVehicle('opala-4100')
  sim.reset()
  sim.init(opala)
  assert(useSimulationStore.getState().tcsEnabled === false, '[opala-4100] inicia com TCS inativo (inexistente)')
  sim.setTcsEnabled(true)
  assert(
    useSimulationStore.getState().tcsEnabled === false,
    '[opala-4100] store bloqueia ativação indevida de TCS em veículo mecânico sem o equipamento',
  )
}

console.log(`\n===============================================================`)
console.log(`FASE 4.4.2.1 RESULTADO: ${passed} PASSOU | ${failed} FALHOU`)
console.log(`===============================================================\n`)

if (failed > 0) {
  process.exit(1)
}
