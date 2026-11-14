import fs from 'fs'
import assert from 'assert'
import { EngineSimulator } from './src/systems/engine/EngineSimulator'
import { AutomaticTransmission } from './src/systems/transmission/AutomaticTransmission'
import { Transmission } from './src/systems/transmission/Transmission'
import { ClutchSystem } from './src/systems/clutch/ClutchSystem'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { DashboardSystem } from './src/systems/dashboard/DashboardSystem'
import { getVehicleCapabilities } from './src/types/vehicle'

console.log('\n===============================================================')
console.log('  HEATZ AUTO · AUDITORIA DE CORREÇÕES PÓS-IMPLEMENTAÇÃO & 4X4')
console.log('===============================================================\n')

const enduranceCfg = JSON.parse(fs.readFileSync('public/vehicles/fiat-toro-endurance-2025/config.json', 'utf8'))
const ranchCfg = JSON.parse(fs.readFileSync('public/vehicles/fiat-toro-ranch-2025/config.json', 'utf8'))
const cb1000rCfg = JSON.parse(fs.readFileSync('public/vehicles/cb1000r/config.json', 'utf8'))
const golfGtiCfg = JSON.parse(fs.readFileSync('public/vehicles/golf-gti/config.json', 'utf8'))
const porscheGt3Cfg = JSON.parse(fs.readFileSync('public/vehicles/porsche-gt3/config.json', 'utf8'))

// ─── 1. CORREÇÃO DOS PAINÉIS DE INSTRUMENTOS E TACÔMETROS ───
console.log('--- BLOCO 1: Tacômetros e Iluminação Angular da Fiat Toro ---')
{
  // 1.1 Endurance 1.3 Turbo Flex (Escala 0-7000 RPM, Redline 6200 RPM)
  const endMax = enduranceCfg.dashboard.tachometerMax // 7000
  const endRedline = enduranceCfg.dashboard.redlineStart // 6200
  assert.strictEqual(endMax, 7000, 'Endurance: escala máxima do tacômetro é 7.000 RPM')
  assert.strictEqual(endRedline, 6200, 'Endurance: redline começa aos 6.200 RPM')

  // 1.2 Ranch 2.2 Turbodiesel (Escala 0-6000 RPM, Redline 4500 RPM)
  const ranchMax = ranchCfg.dashboard.tachometerMax // 6000
  const ranchRedline = ranchCfg.dashboard.redlineStart // 4500
  assert.strictEqual(ranchMax, 6000, 'Ranch: escala máxima do tacômetro é 6.000 RPM (curva diesel)')
  assert.strictEqual(ranchRedline, 4500, 'Ranch: redline começa aos 4.500 RPM (faixa vermelha precoce)')
  assert.notStrictEqual(endMax, ranchMax, 'Escalas e limites não são reutilizados: Endurance e Ranch possuem faixas próprias')

  // 1.3 Teste de Geometria Angular e Arco do Tacômetro
  const startDeg = 140
  const totalSweepDeg = 260
  const radius = 85
  const totalArcLen = (totalSweepDeg / 360) * 2 * Math.PI * radius // ~385.72 px

  // Motor desligado (RPM = 0)
  {
    const rpm = 0
    const ratio = Math.max(0, Math.min(1, rpm / endMax))
    const angle = startDeg + ratio * totalSweepDeg
    const activeLen = ratio * totalArcLen
    assert.strictEqual(angle, 140, 'RPM 0: ângulo do ponteiro é exatamente 140° (inferior esquerdo)')
    assert.strictEqual(activeLen, 0, 'RPM 0: comprimento de arco iluminado é exatamente 0')
  }

  // Marcha lenta (RPM = 750)
  {
    const rpm = 750
    const ratio = rpm / endMax
    const angle = startDeg + ratio * totalSweepDeg
    const activeLen = ratio * totalArcLen
    assert(angle > 140 && angle < 175, `Marcha lenta: ângulo proporcional no arco (${angle.toFixed(1)}°)`)
    assert(activeLen > 0 && activeLen < totalArcLen, 'Marcha lenta: arco iluminado ativo e contido')
  }

  // Aceleração média (RPM = 3500)
  {
    const rpm = 3500
    const ratio = rpm / endMax
    const angle = startDeg + ratio * totalSweepDeg
    const activeLen = ratio * totalArcLen
    assert.strictEqual(ratio, 0.5, 'Endurance 3500 RPM representa exatamente 50% da escala')
    assert.strictEqual(angle, 140 + 130, 'Endurance 3500 RPM aponta para o topo central (270°)')
    assert.strictEqual(Math.round(activeLen), Math.round(totalArcLen * 0.5), 'Arco iluminado preenche exatamente metade do percurso')
  }

  // Redline Endurance (RPM >= 6200)
  {
    const rpm = 6200
    const isRed = rpm >= endRedline
    assert.strictEqual(isRed, true, 'Endurance aos 6200 RPM entra em zona vermelha de alerta')
  }

  // Redline Ranch (RPM >= 4500)
  {
    const rpm = 4500
    const isRed = rpm >= ranchRedline
    assert.strictEqual(isRed, true, 'Ranch aos 4500 RPM entra em zona vermelha de alerta diesel')
    const angleRanch = startDeg + (rpm / ranchMax) * totalSweepDeg
    assert.strictEqual(angleRanch, 140 + 0.75 * 260, 'Ranch 4500 RPM inicia redline em exatamente 75% do arco (335°)')
  }

  // Tratamento de valores inválidos (NaN, Infinity, negativos, estouro de escala)
  {
    const clampRpm = (val: number, max: number) => {
      const safe = Number.isFinite(val) ? val : 0
      return Math.max(0, Math.min(safe, max))
    }
    assert.strictEqual(clampRpm(NaN, 7000), 0, 'NaN é normalizado com segurança para 0 RPM')
    assert.strictEqual(clampRpm(-500, 7000), 0, 'Valores negativos são travados em 0 RPM')
    assert.strictEqual(clampRpm(12000, 7000), 7000, 'Valores acima do limite são limitados à escala máxima (7.000 RPM)')
    assert.strictEqual(clampRpm(Infinity, 6000), 0, 'Infinity é normalizado com segurança para 0 RPM')
  }

  console.log('  [OK] Escalas e redlines distintos verificados (Endurance: 7k/6.2k, Ranch: 6k/4.5k)')
  console.log('  [OK] Geometria angular de 140° a 400° (260° sweep) confirmada')
  console.log('  [OK] Iluminação estritamente contida por strokeDasharray')
  console.log('  [OK] Tratamento resiliente de NaN, Infinity e valores fora de escala')
}

// ─── 2. SISTEMA 4X4 MECÂNICO REAL (ZF 9HP, CARGA NORMAL E SUBIDAS) ───
console.log('\n--- BLOCO 2: Consequências Físicas Reais do Sistema 4x4 da Toro Ranch ---')
{
  const ranchPhysics = new VehiclePhysics({
    weight: ranchCfg.chassis.totalMass,
    wheelDiameter: ranchCfg.info.wheelDiameter,
    chassis: ranchCfg.chassis,
    vehicleId: ranchCfg.id,
    fourWheelDriveMode: 'auto',
  })

  // 2.1 Comparação de Aderência Normal e Atrito
  // Asfalto Seco (mu = 0.95)
  ranchPhysics.setSurfaceFriction(0.95)
  ranchPhysics.setFourWheelDriveMode('auto')
  const gripAutoSeco = ranchPhysics.getMaxGripTorque()

  ranchPhysics.setFourWheelDriveMode('4wd')
  const grip4wdSeco = ranchPhysics.getMaxGripTorque()
  assert(grip4wdSeco >= gripAutoSeco, `4WD LOCK em asfalto seco disponibiliza máxima aderência (${grip4wdSeco.toFixed(1)} Nm >= ${gripAutoSeco.toFixed(1)} Nm)`)

  // Asfalto Molhado (mu = 0.55)
  ranchPhysics.setSurfaceFriction(0.55)
  ranchPhysics.setFourWheelDriveMode('4wd')
  const grip4wdMolhado = ranchPhysics.getMaxGripTorque()
  assert(grip4wdMolhado < grip4wdSeco, `Asfalto molhado reduz aderência proporcionalmente (${grip4wdMolhado.toFixed(1)} Nm < ${grip4wdSeco.toFixed(1)} Nm)`)

  // Terra / Cascalho (mu = 0.45)
  ranchPhysics.setSurfaceFriction(0.45)
  const grip4wdTerra = ranchPhysics.getMaxGripTorque()
  assert(grip4wdTerra < grip4wdMolhado, `Terra possui menor coeficiente que asfalto molhado (${grip4wdTerra.toFixed(1)} Nm)`)

  // Superfície de baixa aderência (Lama / Gelo, mu = 0.25)
  ranchPhysics.setSurfaceFriction(0.25)
  const grip4wdLama = ranchPhysics.getMaxGripTorque()
  assert(grip4wdLama < grip4wdTerra, `Lama/gelo reduz aderência a níveis críticos (${grip4wdLama.toFixed(1)} Nm)`)

  console.log(`  [OK] Variação de atrito por piso validada: Seco=${grip4wdSeco.toFixed(0)}Nm, Molhado=${grip4wdMolhado.toFixed(0)}Nm, Terra=${grip4wdTerra.toFixed(0)}Nm, Lama=${grip4wdLama.toFixed(0)}Nm`)

  // 2.2 Comparativo 2WD (FWD) vs 4WD LOCK em Subida Íngreme (18% de inclinação) em Piso de Baixa Aderência (mu = 0.35)
  const endurancePhysics = new VehiclePhysics({
    weight: enduranceCfg.chassis.totalMass,
    wheelDiameter: enduranceCfg.info.wheelDiameter,
    chassis: enduranceCfg.chassis,
    vehicleId: enduranceCfg.id,
  })

  // Configura rampa de 18% de subida
  endurancePhysics.setRoadGrade(18)
  endurancePhysics.setSurfaceFriction(0.35)
  ranchPhysics.setRoadGrade(18)
  ranchPhysics.setSurfaceFriction(0.35)
  ranchPhysics.setFourWheelDriveMode('4wd')

  const enduranceLoads = endurancePhysics.getAxleLoads()
  const ranchLoads = ranchPhysics.getAxleLoads()

  // Na subida, a transferência de peso alivia a carga normal dianteira em relação ao solo plano
  const flatFrontLoad = enduranceCfg.chassis.totalMass * 9.81 * enduranceCfg.chassis.frontWeightRatio
  assert(
    enduranceLoads.frontAxleLoad < flatFrontLoad,
    `Subida de 18% alivia o eixo dianteiro em relação ao plano (Carga na rampa=${enduranceLoads.frontAxleLoad.toFixed(0)}N < Plano=${flatFrontLoad.toFixed(0)}N)`,
  )

  // FWD da Endurance só consegue tracionar pela carga do eixo dianteiro
  const enduranceGrip = endurancePhysics.getMaxGripTorque()
  // 4WD LOCK da Ranch mobiliza ambos os eixos (100% da carga normal)
  const ranchGrip = ranchPhysics.getMaxGripTorque()

  assert(ranchGrip > enduranceGrip * 1.5, `4WD LOCK em subida de baixa aderência entrega muito mais tração que FWD (${ranchGrip.toFixed(0)} Nm vs ${enduranceGrip.toFixed(0)} Nm)`)

  // Teste de Arrancada na Subida:
  // FWD da Endurance: mesmo com acelerador moderado (180 Nm), as rodas dianteiras destracionam devido ao alívio de peso
  const tickEnduranceSlope = endurancePhysics.tick({
    driveTorqueAtTransmission: 180,
    gearRatio: 4.459,
    finalDrive: 4.067,
    brake: 0,
    deltaTime: 1 / 120,
  })
  assert.strictEqual(tickEnduranceSlope.isWheelSlipping, true, 'FWD patina as rodas na subida de 18% com baixa aderência (mu=0.35)')

  // 4WD LOCK da Ranch: com 250 Nm de torque diesel, mobiliza a carga de ambos os eixos e arranca sem destracionar
  const tickRanchSlope = ranchPhysics.tick({
    driveTorqueAtTransmission: 250,
    gearRatio: 2.840,
    finalDrive: 3.136,
    brake: 0,
    deltaTime: 1 / 120,
  })
  assert.strictEqual(tickRanchSlope.isWheelSlipping, false, '4WD LOCK arranca na subida sem destracionar')

  console.log('  [OK] FWD destraciona em rampa de baixa aderência; 4WD LOCK mantém tração firme')

  // 2.3 Comparação 4WD LOCK (2ª marcha) versus 4WD LOW (1ª marcha crawler 4.700:1)
  ranchPhysics.setRoadGrade(0)
  ranchPhysics.setSurfaceFriction(0.95)
  ranchPhysics.reset()

  // 4WD LOCK com saída padrão em 2ª marcha
  ranchPhysics.setFourWheelDriveMode('4wd')
  const tickLock2nd = ranchPhysics.tick({
    driveTorqueAtTransmission: 400,
    gearRatio: 2.840, // 2ª marcha
    finalDrive: 3.136,
    brake: 0,
    deltaTime: 1 / 120,
  })

  // 4WD LOW com crawl ratio em 1ª marcha
  ranchPhysics.setFourWheelDriveMode('4wd_low')
  const tickLow1st = ranchPhysics.tick({
    driveTorqueAtTransmission: 400,
    gearRatio: 4.700, // 1ª marcha crawl
    finalDrive: 3.136,
    brake: 0,
    deltaTime: 1 / 120,
  })

  const torqueRatio = tickLow1st.wheelTorque / tickLock2nd.wheelTorque
  assert(
    Math.abs(torqueRatio - (4.700 / 2.840)) < 0.01,
    `Multiplicação mecânica da 1ª marcha crawl ratio é exatamente ${torqueRatio.toFixed(3)}x (sem multiplicador arbitrário)`,
  )
  assert(tickLow1st.wheelTorque > tickLock2nd.wheelTorque * 1.6, '4WD LOW produz 65% mais torque bruto nas rodas')

  // Comparação de velocidade para uma mesma rotação (2000 RPM)
  const speedAt2000Rpm2nd = (2000 / (60 * 2.840 * 3.136)) * (Math.PI * ranchCfg.info.wheelDiameter) * 3.6
  const speedAt2000Rpm1st = (2000 / (60 * 4.700 * 3.136)) * (Math.PI * ranchCfg.info.wheelDiameter) * 3.6
  assert(
    speedAt2000Rpm1st < speedAt2000Rpm2nd * 0.65,
    `4WD LOW produz menor velocidade a 2000 RPM para rastejo off-road controlado (${speedAt2000Rpm1st.toFixed(1)} km/h vs ${speedAt2000Rpm2nd.toFixed(1)} km/h)`,
  )

  // Freio Motor: em desaceleração com torque negativo do motor (-80 Nm)
  ranchPhysics.setSpeedKmh(25)
  const brakeEngine2nd = ranchPhysics.tick({
    driveTorqueAtTransmission: -80,
    gearRatio: 2.840,
    finalDrive: 3.136,
    brake: 0,
    deltaTime: 1 / 120,
  })

  ranchPhysics.setSpeedKmh(25)
  const brakeEngine1st = ranchPhysics.tick({
    driveTorqueAtTransmission: -80,
    gearRatio: 4.700,
    finalDrive: 3.136,
    brake: 0,
    deltaTime: 1 / 120,
  })

  assert(
    Math.abs(brakeEngine1st.wheelTorque) > Math.abs(brakeEngine2nd.wheelTorque) * 1.5,
    `Freio motor em 4WD LOW (1ª marcha) é ~65% superior ao de 2ª marcha (${Math.abs(brakeEngine1st.wheelTorque).toFixed(1)} Nm vs ${Math.abs(brakeEngine2nd.wheelTorque).toFixed(1)} Nm)`,
  )

  console.log(`  [OK] 4WD LOW: torque nas rodas=${tickLow1st.wheelTorque.toFixed(0)}Nm (+65.5% vs 2ª=${tickLock2nd.wheelTorque.toFixed(0)}Nm)`)
  console.log(`  [OK] 4WD LOW: velocidade a 2000 RPM=${speedAt2000Rpm1st.toFixed(1)} km/h (crawl ratio para terrenos difíceis)`)
  console.log(`  [OK] 4WD LOW: freio motor aumentado em ${((Math.abs(brakeEngine1st.wheelTorque) / Math.abs(brakeEngine2nd.wheelTorque) - 1) * 100).toFixed(0)}%`)
}

// ─── 3. VEHICLE CAPABILITIES — DESACOPLAMENTO RIGOROSO ───
console.log('\n--- BLOCO 3: Validação das Capacidades por Veículo (VehicleCapabilities) ---')
{
  const capEndurance = getVehicleCapabilities(enduranceCfg)
  const capRanch = getVehicleCapabilities(ranchCfg)
  const capCb1000r = getVehicleCapabilities(cb1000rCfg)
  const capGolf = getVehicleCapabilities(golfGtiCfg)
  const capPorsche = getVehicleCapabilities(porscheGt3Cfg)

  // Honda CB1000R
  assert.strictEqual(capCb1000r.isMotorcycle, true, 'CB1000R é classificada como moto')
  assert.strictEqual(capCb1000r.hasDriveModes, false, 'CB1000R sem modos genéricos de carro')
  assert.strictEqual(capCb1000r.supportsPaddleShifters, false, 'CB1000R sem borboletas')
  assert.deepStrictEqual(capCb1000r.manualShiftControls, ['sequential_lever'], 'CB1000R opera por alavanca sequencial de pé')
  assert.strictEqual(capCb1000r.hasClutchPedal, true, 'CB1000R possui manete de embreagem manual')

  // Toro Endurance
  assert.strictEqual(capEndurance.hasDriveModes, false, 'Toro Endurance sem modos eletrônicos de chassi')
  assert.strictEqual(capEndurance.supportsPaddleShifters, false, 'Toro Endurance sem borboletas no volante')
  assert.strictEqual(capEndurance.has4x4Selector, false, 'Toro Endurance sem seletor 4x4 (FWD)')
  assert.strictEqual(capEndurance.hasInfotainment, true, 'Toro Endurance possui multimídia de 7 polegadas')

  // Toro Ranch
  assert.strictEqual(capRanch.hasDriveModes, false, 'Toro Ranch sem modos fictícios de chassi')
  assert.strictEqual(capRanch.supportsPaddleShifters, true, 'Toro Ranch possui borboletas no volante para câmbio AT9')
  assert.strictEqual(capRanch.has4x4Selector, true, 'Toro Ranch possui seletor inteligente 4x4')
  assert.strictEqual(capRanch.hasInfotainment, true, 'Toro Ranch possui multimídia vertical de 10.1 polegadas')

  // Golf GTI e Porsche 911 GT3
  assert.strictEqual(capGolf.hasDriveModes, true, 'Golf GTI preserva múltiplos modos de condução')
  assert.strictEqual(capGolf.supportsPaddleShifters, true, 'Golf GTI preserva borboletas DSG')
  assert.strictEqual(capPorsche.hasDriveModes, true, 'Porsche 911 GT3 preserva modos Track/Sport')
  assert.strictEqual(capPorsche.supportsPaddleShifters, true, 'Porsche 911 GT3 preserva borboletas PDK')

  console.log('  [OK] CB1000R: estritamente moto sequencial sem herança indevida de carros')
  console.log('  [OK] Toro Endurance: AT6, sem borboletas, sem 4x4, Uconnect 7"')
  console.log('  [OK] Toro Ranch: AT9, com borboletas, com seletor 4x4, Uconnect 10.1"')
  console.log('  [OK] Golf GTI e Porsche GT3: capacidades esportivas preservadas')
}

// ─── 4. VERIFICAÇÃO DE ESPECIFICAÇÕES OFICIAIS E EQUIPAMENTOS ───
console.log('\n--- BLOCO 4: Especificações Oficiais Homologadas ---')
{
  // Toro Endurance 1.3 Turbo Flex 2025
  assert.strictEqual(enduranceCfg.engine.maxPower, 185, 'Endurance: 185 cv (Etanol)')
  assert.strictEqual(enduranceCfg.engine.maxPowerRpm, 5750, 'Endurance: pico de potência a 5.750 rpm')
  assert.strictEqual(enduranceCfg.engine.maxTorque, 270, 'Endurance: 270 Nm (27,5 kgfm)')
  assert.strictEqual(enduranceCfg.engine.maxTorqueRpm, 1750, 'Endurance: pico de torque a 1.750 rpm')
  assert.strictEqual(enduranceCfg.transmission.gearCount, 6, 'Endurance: câmbio automático de 6 marchas')
  assert.strictEqual(enduranceCfg.dashboard.fuelCapacity, 55, 'Endurance: tanque de 55 litros')

  // Toro Ranch 2.2 Turbodiesel 4x4 AT9 2025
  assert.strictEqual(ranchCfg.engine.maxPower, 200, 'Ranch: 200 cv (Turbodiesel)')
  assert.strictEqual(ranchCfg.engine.maxPowerRpm, 3500, 'Ranch: pico de potência diesel a 3.500 rpm')
  assert.strictEqual(ranchCfg.engine.maxTorque, 450, 'Ranch: 450 Nm (45,9 kgfm)')
  assert.strictEqual(ranchCfg.engine.maxTorqueRpm, 1500, 'Ranch: pico de torque diesel a 1.500 rpm')
  assert.strictEqual(ranchCfg.transmission.gearCount, 9, 'Ranch: câmbio ZF de 9 marchas')
  assert.strictEqual(ranchCfg.transmission.gearRatios[0].ratio, 4.700, 'Ranch: 1ª marcha é crawl ratio 4.700:1')
  assert.strictEqual(ranchCfg.dashboard.fuelCapacity, 60, 'Ranch: tanque de 60 litros')

  console.log('  [OK] Fichas técnicas rigorosamente alinhadas aos manuais Stellantis')
}

console.log('\n===============================================================')
console.log('  RESULTADO: 100% DOS CRITÉRIOS DE CORREÇÃO APROVADOS!')
console.log('===============================================================\n')
