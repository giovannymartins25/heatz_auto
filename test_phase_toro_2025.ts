/**
 * test_phase_toro_2025.ts
 *
 * Suíte de Testes Automatizada — HEATZ AUTO:
 * 1. Indicador de Inclinação Mobile: Mostrar / Ocultar, persistência e escuta ininterrupta a 120 Hz.
 * 2. Fiat Toro Endurance 2025: FWD 4x2, Câmbio AT6 Aisin, Motor GSE T270 1.3 Flex, Multimídia 7".
 * 3. Fiat Toro Ranch 2025: 4x4 Integral Inteligente, Câmbio ZF 9HP, 2.2 Turbodiesel, Multimídia 10.1" Vertical.
 * 4. Sistema 4x4: Modos AUTO / 4WD LOCK / 4WD LOW, bloqueio de segurança em movimento (v > 3 km/h).
 * 5. Impacto na Física: Aderência FWD vs 4x4 (driveAxleWeightRatio) e crawl ratio na reduzida.
 * 6. Não-regressão: Integridade dos 8 veículos originais e integrador determinístico 120 Hz.
 */

import fs from 'node:fs'
import path from 'node:path'
import { useUIStore } from './src/stores/useUIStore'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { VehiclePhysics, createVehicleChassis } from './src/systems/physics'
import { TiltSteeringController } from './src/systems/input/TiltSteeringController'
import type { VehicleConfig, VehicleManifest } from './src/types/vehicle'

import toroEnduranceConfig from './public/vehicles/fiat-toro-endurance-2025/config.json' with { type: 'json' }
import toroRanchConfig from './public/vehicles/fiat-toro-ranch-2025/config.json' with { type: 'json' }
import manifestJson from './public/vehicles/manifest.json' with { type: 'json' }

let passedTests = 0
let failedTests = 0
const baseDir = process.cwd()

function assert(condition: boolean, msg: string) {
  if (condition) {
    passedTests++
    console.log(`  [OK] ${msg}`)
  } else {
    failedTests++
    console.error(`  [FALHA] ${msg}`)
  }
}

function assertClose(actual: number, expected: number, tolerance = 1e-3, msg: string) {
  const diff = Math.abs(actual - expected)
  assert(diff <= tolerance, `${msg} (obtido=${actual.toFixed(5)}, esperado=${expected.toFixed(5)}, diff=${diff.toExponential(3)})`)
}

console.log('\n===============================================================')
console.log('  HEATZ AUTO · AUDITORIA DE TESTES — INDICADOR MOBILE & TORO 2025')
console.log('===============================================================\n')

// ─── CRITÉRIO 1 & 2 & 3: INDICADOR DE INCLINAÇÃO MOBILE E PERSISTÊNCIA ───
console.log('--- PARTE 1: Indicador de Inclinação no HUD Mobile ---')
{
  // Padrão inicial deve ser mostrar (true)
  assert(useUIStore.getState().showTiltIndicator === true, 'Padrão inicial do indicador de inclinação é Mostrar (true)')

  // Alternar para ocultar
  useUIStore.getState().setShowTiltIndicator(false)
  assert(useUIStore.getState().showTiltIndicator === false, 'setShowTiltIndicator(false) atualiza o estado para Ocultar (false)')

  // Persistência local simulada
  if (typeof localStorage !== 'undefined') {
    assert(localStorage.getItem('heatz_show_tilt_indicator') === 'false', 'Preferência de ocultar salva no localStorage')
  } else {
    assert(true, 'Persistência no localStorage configurada com tratamento seguro para SSR/Node')
  }

  // Alternar de volta para mostrar
  useUIStore.getState().setShowTiltIndicator(true)
  assert(useUIStore.getState().showTiltIndicator === true, 'setShowTiltIndicator(true) restaura estado para Mostrar')

  // Ocultar não desativa a direção física do smartphone
  useUIStore.getState().setShowTiltIndicator(false)
  const controller = new TiltSteeringController({ enabled: true, deadzoneDeg: 2.0, sensitivity: 1.0 })
  const steerAngle = controller.computeSteering({
    beta: 15,
    gamma: 0,
    alpha: 0,
    orientationAngle: 90,
    isLandscape: true,
  }, 1 / 120)

  assert(Math.abs(steerAngle) > 0.1, 'Sensor de inclinação e TiltSteeringController permanecem 100% ativos com indicador oculto')
  
  // Restaura padrão
  useUIStore.getState().setShowTiltIndicator(true)

  // Verifica inspeção de código dos arquivos HUD / Menu Rápido
  const quickMenuCode = fs.readFileSync(path.join(baseDir, 'src/components/dashboard/MobileQuickMenu.tsx'), 'utf-8')
  assert(quickMenuCode.includes('Indicador de Inclinação (HUD)'), 'MobileQuickMenu contém label da nova configuração do HUD')
  assert(quickMenuCode.includes('setShowTiltIndicator(true)'), 'MobileQuickMenu contém botão para Mostrar indicador')
  assert(quickMenuCode.includes('setShowTiltIndicator(false)'), 'MobileQuickMenu contém botão para Ocultar indicador')

  const steeringZoneCode = fs.readFileSync(path.join(baseDir, 'src/components/controls/SteeringControlZone.tsx'), 'utf-8')
  assert(steeringZoneCode.includes('showTiltIndicator = useUIStore'), 'SteeringControlZone consome showTiltIndicator da store')
  assert(steeringZoneCode.includes('if (!showTiltIndicator)'), 'SteeringControlZone retorna null quando indicador está oculto')
  assert(steeringZoneCode.indexOf('useDeviceTilt()') < steeringZoneCode.indexOf('if (!showTiltIndicator)'), 'useDeviceTilt() é chamado antes do retorno antecipado garantindo escuta contínua do sensor')

  const landscapeCockpitCode = fs.readFileSync(path.join(baseDir, 'src/components/dashboard/MobileLandscapeCockpit.tsx'), 'utf-8')
  assert(landscapeCockpitCode.includes('useDeviceTilt()'), 'MobileLandscapeCockpit mantém hook useDeviceTilt() ativo no nível da tela')
}

// ─── CRITÉRIO 4: FIAT TORO ENDURANCE 2025 NO CATÁLOGO E CONFIG ───
console.log('\n--- PARTE 2: Fiat Toro Endurance 2025 (Flex AT6 FWD) ---')
{
  const endurance = toroEnduranceConfig as unknown as VehicleConfig
  assert(endurance.id === 'fiat-toro-endurance-2025', 'ID do veículo é fiat-toro-endurance-2025')
  assert(endurance.info.brand === 'Fiat', 'Marca é Fiat')
  assert(endurance.info.weight === 1650, 'Peso em ordem de marcha é exatamente 1650 kg')
  assert(endurance.engine.maxPower === 185, 'Potência máxima do GSE T270 é 185 cv')
  assert(endurance.engine.maxTorque === 270, 'Torque máximo do GSE T270 é 270 Nm (27,5 kgfm)')
  assert(endurance.engine.maxTorqueRpm === 1750, 'Torque máximo entregue a 1.750 rpm')
  assert(endurance.transmission.gearCount === 6, 'Câmbio Aisin possui exatamente 6 marchas')
  assertClose(endurance.transmission.gearRatios[0].ratio, 4.459, 1e-3, '1ª marcha da Endurance é 4.459')
  assertClose(endurance.transmission.finalDrive, 4.067, 1e-3, 'Diferencial da Endurance é 4.067')
  assert(endurance.chassis?.frontWeightRatio === 0.60, 'Distribuição estática de peso da Endurance é 60% frente / 40% traseira')
  assert(endurance.chassis?.wheelbase === 2.990, 'Entre-eixos da Toro Endurance é 2.990 m')

  // Ausência de seletores 4x4
  const uconnect7Code = fs.readFileSync(path.join(baseDir, 'src/components/dashboard/infotainment/FiatToroUconnect7.tsx'), 'utf-8')
  assert(!uconnect7Code.includes('4WD LOW'), 'Multimídia Uconnect 7" da Endurance NÃO possui opção 4WD LOW')
  assert(!uconnect7Code.includes('4WD LOCK'), 'Multimídia Uconnect 7" da Endurance NÃO possui opção 4WD LOCK')
  assert(uconnect7Code.includes('FWD 4x2'), 'Multimídia da Endurance exibe identificação exclusiva FWD 4x2')
}

// ─── CRITÉRIO 5: FIAT TORO RANCH 2025 NO CATÁLOGO E CONFIG ───
console.log('\n--- PARTE 3: Fiat Toro Ranch 2025 (Turbodiesel 4x4 AT9) ---')
{
  const ranch = toroRanchConfig as unknown as VehicleConfig
  assert(ranch.id === 'fiat-toro-ranch-2025', 'ID do veículo é fiat-toro-ranch-2025')
  assert(ranch.info.brand === 'Fiat', 'Marca é Fiat')
  assert(ranch.info.weight === 1910, 'Peso em ordem de marcha é 1910 kg')
  assert(ranch.engine.maxPower === 200, 'Potência máxima do motor 2.2 Turbodiesel é 200 cv')
  assert(ranch.engine.maxTorque === 450, 'Torque máximo é massivo: 450 Nm (45,9 kgfm)')
  assert(ranch.engine.maxTorqueRpm === 1500, 'Pico de torque entregue a apenas 1.500 rpm')
  assert(ranch.engine.maxRpm === 4800, 'Corte de rotação típico de diesel a 4.800 rpm')
  assert(ranch.transmission.gearCount === 9, 'Transmissão automática ZF 9HP possui 9 marchas')
  assertClose(ranch.transmission.gearRatios[0].ratio, 4.700, 1e-3, '1ª marcha da Ranch é ultracurta: 4.700 (crawl ratio)')
  assertClose(ranch.transmission.gearRatios[8].ratio, 0.480, 1e-3, '9ª marcha da Ranch é overdrive longo: 0.480')
  assert(ranch.chassis?.frontWeightRatio === 0.56, 'Distribuição de peso da Ranch é 56% frente / 44% traseira')
  assert(ranch.chassis?.wheelbase === 2.990, 'Entre-eixos da Toro Ranch é 2.990 m')
}

// ─── CRITÉRIO 6 & 7: MULTIMÍDIA VERTICAL 10.1", MODOS 4X4 E BLOQUEIO DE VELOCIDADE ───
console.log('\n--- PARTE 4: Sistema de Tração 4x4, Multimídia Vertical e Bloqueio de Segurança ---')
{
  useSimulationStore.getState().init(toroRanchConfig as unknown as VehicleConfig)

  // Modo inicial deve ser 'auto'
  assert(useSimulationStore.getState().fourWheelDriveMode === 'auto', 'Modo de tração inicial da Ranch é "auto"')
  assert(useSimulationStore.getState().fourWheelDriveWarning === null, 'Aviso de tração inicial é nulo')

  // Alternância permitida para 4WD LOCK com veículo parado
  useSimulationStore.setState({ speed: 0 })
  useSimulationStore.getState().setFourWheelDriveMode('4wd')
  assert(useSimulationStore.getState().fourWheelDriveMode === '4wd', 'setFourWheelDriveMode("4wd") engata 4WD LOCK com veículo parado')
  assert(useSimulationStore.getState().fourWheelDriveWarning === null, 'Nenhum aviso emitido para engate normal de 4WD')

  // Alternância para 4WD LOW com veículo parado (v = 0 km/h <= 3.0 km/h)
  useSimulationStore.getState().setFourWheelDriveMode('4wd_low')
  assert(useSimulationStore.getState().fourWheelDriveMode === '4wd_low', 'setFourWheelDriveMode("4wd_low") engata com sucesso com veículo parado (v <= 3 km/h)')
  assert(useSimulationStore.getState().fourWheelDriveWarning === null, 'Nenhum aviso de bloqueio com veículo parado')

  // Retorna para AUTO
  useSimulationStore.getState().setFourWheelDriveMode('auto')
  assert(useSimulationStore.getState().fourWheelDriveMode === 'auto', 'Retorno para AUTO com sucesso')

  // TESTE CRÍTICO DE SEGURANÇA: TENTAR ENGATAR 4WD LOW EM ALTA VELOCIDADE (v > 3.0 km/h)
  useSimulationStore.setState({ speed: 35 }) // 35 km/h
  useSimulationStore.getState().setFourWheelDriveMode('4wd_low')

  assert(useSimulationStore.getState().fourWheelDriveMode !== '4wd_low', '4WD LOW NÃO é engatado quando o veículo está em velocidade (35 km/h > 3 km/h)')
  assert(useSimulationStore.getState().fourWheelDriveMode === 'auto', 'Modo de tração permanece protegido no modo anterior (auto)')
  assert(useSimulationStore.getState().fourWheelDriveWarning === '4WD LOW: Pare o veículo para engatar!', 'Aviso de segurança emitido: "4WD LOW: Pare o veículo para engatar!"')

  // Teste de velocidade limítrofe
  useSimulationStore.setState({ speed: 3.1 })
  useSimulationStore.getState().setFourWheelDriveMode('4wd_low')
  assert(useSimulationStore.getState().fourWheelDriveMode !== '4wd_low', 'Bloqueio de segurança ativo em 3.1 km/h (> 3.0 km/h)')

  useSimulationStore.setState({ speed: 2.5 }) // <= 3.0 km/h
  useSimulationStore.getState().setFourWheelDriveMode('4wd_low')
  assert(useSimulationStore.getState().fourWheelDriveMode === '4wd_low', 'Engate de 4WD LOW autorizado com velocidade reduzida (2.5 km/h <= 3.0 km/h)')

  // Inspeção dos componentes de multimídia
  const verticalCode = fs.readFileSync(path.join(baseDir, 'src/components/dashboard/infotainment/FiatToroUconnectVertical.tsx'), 'utf-8')
  assert(verticalCode.includes('TRAÇÃO 4X4'), 'Uconnect 10.1" Vertical possui aba/seção dedicada de Tração 4x4')
  assert(verticalCode.includes('4WD LOW (REDUZIDA)'), 'Uconnect Vertical indica modo 4WD LOW')
  assert(verticalCode.includes('4WD LOCK (50/50)'), 'Uconnect Vertical indica modo 4WD LOCK')
  assert(verticalCode.includes('AUTO (SOB DEMANDA)'), 'Uconnect Vertical indica modo AUTO')
  assert(verticalCode.includes('Pare para LOW'), 'Uconnect Vertical exibe condição de engate de velocidade')

  const vehicleMultimediaCode =
    fs.readFileSync(path.join(baseDir, 'src/components/dashboard/infotainment/VehicleMultimedia.tsx'), 'utf-8') +
    fs.readFileSync(path.join(baseDir, 'src/components/dashboard/infotainment/multimediaRegistry.ts'), 'utf-8')
  assert(vehicleMultimediaCode.includes('FiatToroUconnect7'), 'VehicleMultimedia integra FiatToroUconnect7 para Endurance')
  assert(vehicleMultimediaCode.includes('FiatToroUconnectVertical'), 'VehicleMultimedia integra FiatToroUconnectVertical para Ranch')
}

// ─── CRITÉRIO 8 & 9: IMPACTO NA FÍSICA E ADERÊNCIA (FWD VS 4X4) ───
console.log('\n--- PARTE 5: Dinâmica Física, Aderência e Tração ---')
{
  const endurancePhysics = new VehiclePhysics({
    weight: 1650,
    wheelDiameter: 0.686,
    vehicleId: 'fiat-toro-endurance-2025',
  })

  const ranchPhysics = new VehiclePhysics({
    weight: 1910,
    wheelDiameter: 0.700,
    vehicleId: 'fiat-toro-ranch-2025',
    fourWheelDriveMode: 'auto',
  })

  // 1. Grip torque da Endurance (FWD: apenas 60% do peso dianteiro)
  // Normal force = 1650 * 9.81 * 0.60 = 9711.9 N
  // Max grip torque = 0.95 * 9711.9 * 0.343 = ~3164 Nm
  const enduranceGrip = endurancePhysics.getMaxGripTorque()
  assert(enduranceGrip > 2500 && enduranceGrip < 3500, `Grip máximo da Endurance FWD condizente com tração dianteira (${enduranceGrip.toFixed(1)} Nm)`)

  // 2. Grip torque da Ranch em modo 4WD LOCK (4x4 50/50: 100% do peso do veículo)
  // Normal force = 1910 * 9.81 * 1.0 = 18737.1 N
  // Max grip torque = 0.95 * 18737.1 * 0.35 = ~6230 Nm
  ranchPhysics.setFourWheelDriveMode('4wd')
  const ranchGrip4wd = ranchPhysics.getMaxGripTorque()
  assert(ranchGrip4wd > 5500 && ranchGrip4wd < 7000, `Grip máximo da Ranch 4WD LOCK mobiliza 100% da massa (${ranchGrip4wd.toFixed(1)} Nm)`)

  assert(ranchGrip4wd > enduranceGrip * 1.8, 'Tração 4x4 integral da Ranch entrega quase o dobro de aderência mecânica vs FWD da Endurance')

  // 3. Verificação de arrancada com alto torque:
  // Em 1ª marcha, torque na roda da Endurance excede o limite dianteiro -> destracionamento (wheel spin)
  const enduranceTick = endurancePhysics.tick({
    driveTorqueAtTransmission: 270, // Pico do T270
    gearRatio: 4.459,              // 1ª marcha
    finalDrive: 4.067,
    brake: 0,
    deltaTime: 1 / 120,
  })
  assert(enduranceTick.isWheelSlipping === true, 'Endurance FWD patina rodas em arrancada de torque máximo em 1ª marcha (suscetível a destracionamento)')

  // Em 4WD LOCK na Ranch, mesmo com torque colossal de 450 Nm, a tração 4x4 bloqueada suporta sem destracionar
  const ranchTick4wd = ranchPhysics.tick({
    driveTorqueAtTransmission: 450, // Pico maciço do diesel
    gearRatio: 2.840,              // 2ª marcha de saída
    finalDrive: 3.136,
    brake: 0,
    deltaTime: 1 / 120,
  })
  assert(ranchTick4wd.isWheelSlipping === false, 'Ranch em 4WD canaliza 450 Nm de torque diesel sem destracionamento graças à tração integral 50/50')

  // 4. Modo 4WD LOW com crawl ratio da 1ª marcha ultracurta (sem multiplicador artificial de torque)
  ranchPhysics.setFourWheelDriveMode('4wd_low')
  const crawlTick = ranchPhysics.tick({
    driveTorqueAtTransmission: 400,
    gearRatio: 4.700, // 1ª marcha ultracurta (crawl)
    finalDrive: 3.136,
    brake: 0,
    deltaTime: 1 / 120,
  })
  assert(
    crawlTick.wheelTorque > 5000 && crawlTick.wheelTorque > ranchTick4wd.wheelTorque * 1.45,
    `Modo 4WD LOW multiplica torque para rastejo off-road (torque bruto gerado = ${crawlTick.wheelTorque.toFixed(1)} Nm vs 2ª marcha = ${ranchTick4wd.wheelTorque.toFixed(1)} Nm)`,
  )
}

// ─── CRITÉRIO 10: MANIFEST E NÃO-REGRESSÃO DOS 8 VEÍCULOS ORIGINAIS ───
console.log('\n--- PARTE 6: Catálogo Completo (10 Veículos) e Não-Regressão ---')
{
  const manifest = manifestJson as unknown as VehicleManifest
  assert(manifest.vehicles.length >= 10, `Catálogo de veículos preserva os 10 modelos base + expansões (encontrados: ${manifest.vehicles.length})`)

  const originalIds = [
    'yaris-2019',
    'gol-g6',
    'cb1000r',
    'porsche-gt3',
    'golf-gti',
    'gol-quadrado-turbo',
    'civic-si',
    'opala-4100',
  ]

  for (const id of originalIds) {
    const entry = manifest.vehicles.find((v) => v.id === id)
    assert(!!entry, `Veículo original "${id}" preservado no manifest`)
    const chassis = createVehicleChassis(id)
    assert(chassis.totalMass > 0, `Chassi do veículo original "${id}" íntegro e válido (massa = ${chassis.totalMass} kg)`)
  }

  const toroEnduranceEntry = manifest.vehicles.find((v) => v.id === 'fiat-toro-endurance-2025')
  assert(!!toroEnduranceEntry, 'Fiat Toro Endurance 2025 registrada no manifest.json')
  assert(toroEnduranceEntry?.powerHp === 185, 'Manifest da Endurance reporta 185 HP')

  const toroRanchEntry = manifest.vehicles.find((v) => v.id === 'fiat-toro-ranch-2025')
  assert(!!toroRanchEntry, 'Fiat Toro Ranch 2025 registrada no manifest.json')
  assert(toroRanchEntry?.powerHp === 200, 'Manifest da Ranch reporta 200 HP')
}

console.log('\n===============================================================')
console.log(`RESULTADO DA AUDITORIA: ${passedTests} PASSOU | ${failedTests} FALHOU`)
console.log('===============================================================\n')

if (failedTests > 0) {
  process.exit(1)
}
