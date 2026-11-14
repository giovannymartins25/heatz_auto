/**
 * test_phase_refinement.ts
 *
 * Suíte de Testes Automatizada — FASE DE REFINAMENTO:
 * HUD, Veículos, Garagem e Concessionária Mobile
 *
 * 1. Arquitetura de Capacidades e Recursos (VehicleCapabilities)
 *    - CB1000R: Moto naked manual, sem modos de carro, sem paddle shifters, seletor apenas N.
 *    - Toro Endurance: Flex AT6, sem modos de chassi, sem borboletas, seletor com Sport (S), FWD.
 *    - Toro Ranch: Diesel AT9, sem modos fictícios, com borboletas, 4x4 inteligente com reduzida.
 *    - Carros Esportivos (GT3, GTI) e Manuais (Gol G6, Gol Turbo, Civic Si, Opala).
 * 2. Painéis Digitais 7" TFT Dedicados para Fiat Toro 2025
 *    - Toro Endurance: tema "toro_endurance", tacômetro 7000 RPM (redline 6200), AT6, perfil no cluster.
 *    - Toro Ranch: tema "toro_ranch", tacômetro Diesel 6000 RPM (redline 4500), AT9, indicador 4x4.
 *    - Roteamento correto em ClusterView e perfis em CLUSTER_PROFILES.
 * 3. Multimídias Livres de Estouro / Overflow
 *    - Uconnect 10.1" Vertical: container com overflow seguro, botões compactos, abas sem quebra.
 *    - Uconnect 7" Horizontal: responsividade mantida.
 * 4. Ficha Técnica Oficial e Filtros da Concessionária
 *    - VehicleSpecsModal exportado e funcional com 5 abas completas.
 *    - HomeScreen com filtros por Marca (Fiat, VW, Honda, etc.) e Câmbio.
 *    - Botões de Ficha Técnica na Garagem e Concessionária.
 * 5. Dinamômetro Mobile
 *    - DynoTestModal com eixos graduados SVG, container com scroll seguro anti-corte.
 * 6. Preservação Integral de Física e Não-Regressão
 */

import fs from 'node:fs'
import path from 'node:path'
import { getVehicleCapabilities } from './src/types/vehicle'
import type { VehicleConfig } from './src/types/vehicle'
import { CLUSTER_PROFILES } from './src/components/dashboard/VehicleDashboardCluster'
import { calculateDynoProfile } from './src/utils/dynoCalculator'

import cb1000rConfig from './public/vehicles/cb1000r/config.json' with { type: 'json' }
import toroEnduranceConfig from './public/vehicles/fiat-toro-endurance-2025/config.json' with { type: 'json' }
import toroRanchConfig from './public/vehicles/fiat-toro-ranch-2025/config.json' with { type: 'json' }
import yarisConfig from './public/vehicles/yaris-2019/config.json' with { type: 'json' }
import golfGtiConfig from './public/vehicles/golf-gti/config.json' with { type: 'json' }
import porscheGt3Config from './public/vehicles/porsche-gt3/config.json' with { type: 'json' }
import golG6Config from './public/vehicles/gol-g6/config.json' with { type: 'json' }
import civicSiConfig from './public/vehicles/civic-si/config.json' with { type: 'json' }
import manifestJson from './public/vehicles/manifest.json' with { type: 'json' }

let passed = 0
let failed = 0
const baseDir = process.cwd()

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++
    console.log(`  [OK] ${msg}`)
  } else {
    failed++
    console.error(`  [FALHA] ${msg}`)
  }
}

console.log('\n===============================================================')
console.log('  HEATZ AUTO · AUDITORIA DE REFINAMENTO MOBILE & VEÍCULOS')
console.log('===============================================================\n')

// ─── 1. CAPACIDADES E RECURSOS POR VEÍCULO ───
console.log('--- BLOCO 1: Arquitetura de Capacidades e Recursos (VehicleCapabilities) ---')
{
  // CB1000R
  const moto = cb1000rConfig as unknown as VehicleConfig
  const motoCaps = getVehicleCapabilities(moto)
  assert(motoCaps.isMotorcycle === true, 'CB1000R: identificada como motocicleta')
  assert(motoCaps.hasDriveModes === false, 'CB1000R: sem modos eletrônicos de condução de carros (hasDriveModes=false)')
  assert(motoCaps.supportedDrivingModes.length === 0, 'CB1000R: lista de modos de condução vazia')
  assert(motoCaps.supportsPaddleShifters === false, 'CB1000R: sem borboletas paddle shift')
  assert(motoCaps.hasClutchPedal === true, 'CB1000R: possui embreagem mecânica')
  assert(motoCaps.hasManualShift === true, 'CB1000R: possui troca manual')
  assert(motoCaps.manualShiftControls.includes('sequential_lever'), 'CB1000R: acionamento por alavanca sequencial de pé')
  assert(motoCaps.supportedSelectorPositions.length === 1 && motoCaps.supportedSelectorPositions[0] === 'N', 'CB1000R: seletor de câmbio apenas neutro (sem PRND de carro)')

  // Toro Endurance
  const endurance = toroEnduranceConfig as unknown as VehicleConfig
  const enduranceCaps = getVehicleCapabilities(endurance)
  assert(enduranceCaps.hasDriveModes === false, 'Toro Endurance: sem modos de condução de chassi (hasDriveModes=false)')
  assert(enduranceCaps.supportedDrivingModes.length === 0, 'Toro Endurance: sem botão de modos de chassi')
  assert(enduranceCaps.supportsPaddleShifters === false, 'Toro Endurance: sem paddle shifters no volante')
  assert(enduranceCaps.has4x4Selector === false, 'Toro Endurance: tração dianteira 4x2 sem seletor 4x4')
  assert(enduranceCaps.hasInfotainment === true, 'Toro Endurance: possui central multimídia Uconnect 7"')
  assert(enduranceCaps.supportedSelectorPositions.includes('S'), 'Toro Endurance: câmbio AT6 possui posição Sport (S) na alavanca')
  assert(enduranceCaps.supportedSelectorPositions.includes('M'), 'Toro Endurance: câmbio AT6 possui modo Manual (M) sequencial')

  // Toro Ranch
  const ranch = toroRanchConfig as unknown as VehicleConfig
  const ranchCaps = getVehicleCapabilities(ranch)
  assert(ranchCaps.hasDriveModes === false, 'Toro Ranch: sem modos de condução fictícios de chassi')
  assert(ranchCaps.supportsPaddleShifters === true, 'Toro Ranch: possui paddle shifters no volante para câmbio AT9')
  assert(ranchCaps.has4x4Selector === true, 'Toro Ranch: possui seletor eletrônico 4x4 (AUTO / LOCK / LOW)')
  assert(ranchCaps.hasInfotainment === true, 'Toro Ranch: possui multimídia vertical Uconnect 10.1"')

  // Esportivos (Porsche GT3 & Golf GTI)
  const gt3 = porscheGt3Config as unknown as VehicleConfig
  const gt3Caps = getVehicleCapabilities(gt3)
  assert(gt3Caps.supportsPaddleShifters === true, 'Porsche 911 GT3: possui paddle shifters PDK')
  assert(gt3Caps.hasDriveModes === true, 'Porsche 911 GT3: possui múltiplos modos de pilotagem')

  const gti = golfGtiConfig as unknown as VehicleConfig
  const gtiCaps = getVehicleCapabilities(gti)
  assert(gtiCaps.supportsPaddleShifters === true, 'Golf GTI: possui paddle shifters DSG')

  // Manuais (Gol G6 & Civic Si)
  const gol = golG6Config as unknown as VehicleConfig
  const golCaps = getVehicleCapabilities(gol)
  assert(golCaps.hasClutchPedal === true, 'Gol G6: câmbio manual com pedal de embreagem')
  assert(golCaps.supportsPaddleShifters === false, 'Gol G6: sem paddle shifters')
}

// ─── 2. PAINÉIS ESPECÍFICOS PARA A FIAT TORO 2025 ───
console.log('\n--- BLOCO 2: Painéis Digitais 7" TFT Dedicados (Toro Endurance & Ranch) ---')
{
  const endurance = toroEnduranceConfig as unknown as VehicleConfig
  const ranch = toroRanchConfig as unknown as VehicleConfig

  assert(endurance.dashboard.theme === 'toro_endurance', 'Toro Endurance possui theme próprio "toro_endurance"')
  assert(ranch.dashboard.theme === 'toro_ranch', 'Toro Ranch possui theme próprio "toro_ranch"')

  assert(CLUSTER_PROFILES.toro_endurance !== undefined, 'CLUSTER_PROFILES contém perfil para "toro_endurance"')
  assert(CLUSTER_PROFILES.toro_ranch !== undefined, 'CLUSTER_PROFILES contém perfil para "toro_ranch"')
  assert(CLUSTER_PROFILES.toro_endurance.width === 750, 'Largura de referência da Toro Endurance é 750px')
  assert(CLUSTER_PROFILES.toro_ranch.width === 750, 'Largura de referência da Toro Ranch é 750px')

  // Inspeção de ClusterView
  const clusterViewCode = fs.readFileSync(path.join(baseDir, 'src/components/dashboard/ClusterView.tsx'), 'utf-8')
  assert(clusterViewCode.includes("case 'toro_endurance':"), 'ClusterView mapeia case "toro_endurance"')
  assert(clusterViewCode.includes("case 'toro_ranch':"), 'ClusterView mapeia case "toro_ranch"')
  assert(clusterViewCode.includes('FiatToroEnduranceCluster'), 'ClusterView importa e renderiza FiatToroEnduranceCluster')
  assert(clusterViewCode.includes('FiatToroRanchCluster'), 'ClusterView importa e renderiza FiatToroRanchCluster')

  // Inspeção do componente FiatToroEnduranceCluster
  const enduranceClusterCode = fs.readFileSync(path.join(baseDir, 'src/components/dashboard/clusters/FiatToroEnduranceCluster.tsx'), 'utf-8')
  assert(enduranceClusterCode.includes('TURBO FLEX T270'), 'FiatToroEnduranceCluster possui identidade visual Flex T270')
  assert(enduranceClusterCode.includes('6200'), 'FiatToroEnduranceCluster redline a 6.200 RPM')
  assert(enduranceClusterCode.includes('7000'), 'FiatToroEnduranceCluster escala máxima a 7.000 RPM')

  // Inspeção do componente FiatToroRanchCluster
  const ranchClusterCode = fs.readFileSync(path.join(baseDir, 'src/components/dashboard/clusters/FiatToroRanchCluster.tsx'), 'utf-8')
  assert(ranchClusterCode.includes('2.2 TURBODIESEL 16V'), 'FiatToroRanchCluster possui identidade do motor Turbodiesel')
  assert(ranchClusterCode.includes('4500'), 'FiatToroRanchCluster redline de diesel a 4.500 RPM')
  assert(ranchClusterCode.includes('6000'), 'FiatToroRanchCluster escala máxima diesel a 6.000 RPM')
  assert(ranchClusterCode.includes('ZF 9HP'), 'FiatToroRanchCluster indica transmissão ZF 9HP AT9')
  assert(ranchClusterCode.includes('SISTEMA 4X4:'), 'FiatToroRanchCluster exibe status ativo do sistema 4x4 no cluster')
}

// ─── 3. MULTIMÍDIAS LIVRES DE ESTOURO E RESPONSIVAS ───
console.log('\n--- BLOCO 3: Multimídias sem Estouro e Fluídas ---')
{
  const verticalCode = fs.readFileSync(path.join(baseDir, 'src/components/dashboard/infotainment/FiatToroUconnectVertical.tsx'), 'utf-8')
  assert(verticalCode.includes('overflow-y-auto'), 'FiatToroUconnectVertical possui scroll vertical seguro anti-estouro')
  assert(!verticalCode.includes('h-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-700'), 'FiatToroUconnectVertical capa de álbum foi compactada (não tem mais h-20 desproporcional)')
  assert(verticalCode.includes('grid-cols-4'), 'FiatToroUconnectVertical mantém as 4 abas (4x4, Mídia, Clima, Ajustes)')

  const uconnect7Code = fs.readFileSync(path.join(baseDir, 'src/components/dashboard/infotainment/FiatToroUconnect7.tsx'), 'utf-8')
  assert(uconnect7Code.includes('overflow-y-auto'), 'FiatToroUconnect7 possui overflow-y-auto seguro')
}

// ─── 4. REFORMULAÇÃO DA GARAGEM E CONCESSIONÁRIA + FICHA TÉCNICA ───
console.log('\n--- BLOCO 4: Garagem, Concessionária Mobile e Ficha Técnica ---')
{
  // Modal de Ficha Técnica
  const specsModalCode = fs.readFileSync(path.join(baseDir, 'src/components/ui/VehicleSpecsModal.tsx'), 'utf-8')
  assert(specsModalCode.includes('Identificação'), 'VehicleSpecsModal contém aba Identificação')
  assert(specsModalCode.includes('Motor'), 'VehicleSpecsModal contém aba Motor')
  assert(specsModalCode.includes('Câmbio & Tração'), 'VehicleSpecsModal contém aba Câmbio & Tração')
  assert(specsModalCode.includes('Chassi'), 'VehicleSpecsModal contém aba Chassi')
  assert(specsModalCode.includes('Tecnologia'), 'VehicleSpecsModal contém aba Tecnologia/Equipamentos')
  assert(specsModalCode.includes('Relações de Transmissão Oficiais'), 'VehicleSpecsModal exibe gear ratios reais de cada marcha')

  // HomeScreen
  const homeScreenCode = fs.readFileSync(path.join(baseDir, 'src/screens/HomeScreen.tsx'), 'utf-8')
  assert(homeScreenCode.includes('VehicleSpecsModal'), 'HomeScreen importa e integra VehicleSpecsModal')
  assert(homeScreenCode.includes('specsModalData'), 'HomeScreen gerencia estado de abertura da Ficha Técnica')
  assert(homeScreenCode.includes('FICHA TÉCNICA'), 'HomeScreen possui botão explícito de Ficha Técnica')
  assert(homeScreenCode.includes('selectedBrand'), 'HomeScreen possui filtro de marca na concessionária')
  assert(homeScreenCode.includes('selectedTransmission'), 'HomeScreen possui filtro de câmbio na concessionária')
  assert(homeScreenCode.includes('availableBrands'), 'HomeScreen calcula marcas disponíveis dinamicamente')
}

// ─── 5. DINAMÔMETRO MOBILE ───
console.log('\n--- BLOCO 5: Dinamômetro Mobile ---')
{
  const dynoCode = fs.readFileSync(path.join(baseDir, 'src/components/tuning/DynoTestModal.tsx'), 'utf-8')
  assert(dynoCode.includes('max-h-[92dvh] overflow-y-auto'), 'DynoTestModal possui container com scroll vertical seguro anti-corte')
  assert(dynoCode.includes('viewBox={`0 0 ${svgWidth} ${svgHeight}`}'), 'DynoTestModal SVG possui viewBox fluido e responsivo')
  assert(dynoCode.includes('textAnchor="end"'), 'DynoTestModal possui eixos Y com legendas numéricas proporcionais')

  // Teste de cálculo de perfil no dyno
  const gti = golfGtiConfig as unknown as VehicleConfig
  const profile = calculateDynoProfile(gti)
  assert(profile.maxPowerHp >= 200 && profile.maxPowerHp <= 320, `Cálculo do Dinamômetro calcula potência condizente para o Golf GTI (${profile.maxPowerHp} CV)`)
  assert(profile.maxTorqueNm >= 300 && profile.maxTorqueNm <= 450, `Cálculo do Dinamômetro calcula torque condizente para o Golf GTI (${profile.maxTorqueNm} Nm)`)
}

// ─── 6. NÃO-REGRESSÃO E INTEGRIDADE ───
console.log('\n--- BLOCO 6: Não-Regressão e Integridade dos 10 Veículos ---')
{
  assert(manifestJson.vehicles.length === 10, 'Catálogo possui exatamente 10 veículos reais cadastrados')
  const ids = manifestJson.vehicles.map((v) => v.id)
  assert(ids.includes('fiat-toro-endurance-2025'), 'Manifest inclui fiat-toro-endurance-2025')
  assert(ids.includes('fiat-toro-ranch-2025'), 'Manifest inclui fiat-toro-ranch-2025')
  assert(ids.includes('cb1000r'), 'Manifest inclui cb1000r')
  assert(ids.includes('golf-gti'), 'Manifest inclui golf-gti')
  assert(ids.includes('porsche-gt3'), 'Manifest inclui porsche-gt3')
  assert(ids.includes('yaris-2019'), 'Manifest inclui yaris-2019')
  assert(ids.includes('gol-g6'), 'Manifest inclui gol-g6')
  assert(ids.includes('civic-si'), 'Manifest inclui civic-si')
  assert(ids.includes('gol-quadrado-turbo'), 'Manifest inclui gol-quadrado-turbo')
  assert(ids.includes('opala-4100'), 'Manifest inclui opala-4100')
}

console.log('\n===============================================================')
console.log(`RESULTADO FINAL DA AUDITORIA: ${passed} PASSOU | ${failed} FALHOU`)
console.log('===============================================================\n')

if (failed > 0) {
  process.exit(1)
}
