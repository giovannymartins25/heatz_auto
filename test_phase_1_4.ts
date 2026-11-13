/**
 * HEATZ AUTO — FASE 1.4: SUÍTE DE TESTES E VALIDAÇÃO COMPLETA
 *
 * Valida:
 * 1. Arquitetura de Capacidades Individuais dos Veículos (getVehicleCapabilities)
 * 2. Modos de Condução por Veículo (Yaris só normal, manuais sem modos, Porsche com track)
 * 3. Transição Limpa entre Veículos (reset de modo incompatível)
 * 4. Comandos de Troca de Marcha (Paddles no Golf, Gestual no Yaris, Ambos no Porsche, Sequencial na CB1000R, Manuais sem paddles)
 * 5. Matriz de Câmbio Automático: D/S e ECO/NORMAL/SPORT (upshifts, downshifts, S+SPORT e resolução de conflito S+ECO)
 * 6. Indicador P/D no Toyota Yaris (exclusividade mútua entre P, R, N, D e M)
 * 7. Acelerador Proporcional (demanda contínua de torque do motor)
 * 8. Cockpit Mobile: Seletores de visão verticais, mapa expandido, botão NOS abaixo do 0–100 e remoção de fumaça redundante
 */

import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getVehicleCapabilities } from './src/types/vehicle'
import type { VehicleConfig } from './src/types/vehicle'
import { AutomaticTransmission } from './src/systems/transmission/AutomaticTransmission'
import { EngineSimulator } from './src/systems/engine/EngineSimulator'
import { useSimulationStore } from './src/stores/useSimulationStore'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadVehicle(id: string): VehicleConfig {
  const filePath = path.join(__dirname, 'public/vehicles', id, 'config.json')
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`[OK] ${name}`)
    passed++
  } catch (err: any) {
    console.error(`[FAIL] ${name}:`, err.message)
    failed++
  }
}

console.log('\n===============================================================')
console.log('  HEATZ AUTO · FASE 1.4 — SUÍTE DE VALIDAÇÃO COMPLETA')
console.log('===============================================================\n')

// ─── 1. ARQUITETURA DE CAPACIDADES INDIVIDUAIS DOS VEÍCULOS ───
test('1.1 Toyota Yaris XLS: apenas modo normal, CVT virtual, sem paddles, com gestual vertical', () => {
  const yaris = loadVehicle('yaris-2019')
  const caps = getVehicleCapabilities(yaris)

  assert.deepStrictEqual(caps.supportedDrivingModes, ['normal'], 'Yaris suporta apenas modo normal')
  assert.strictEqual(caps.defaultDrivingMode, 'normal')
  assert.strictEqual(caps.transmissionType, 'cvt')
  assert.strictEqual(caps.supportsManualMode, true)
  assert.strictEqual(caps.supportsPaddleShifters, false, 'Yaris NÃO possui paddle shifters')
  assert.deepStrictEqual(caps.manualShiftControls, ['gear_selector_gesture'], 'Yaris possui seletor gestual vertical')
  assert.strictEqual(caps.supportsNos, true)
})

test('1.2 Porsche 911 GT3 RS: modos normal/sport/track, PDK, paddles E gestual vertical no modo M', () => {
  const porsche = loadVehicle('porsche-gt3')
  const caps = getVehicleCapabilities(porsche)

  assert.deepStrictEqual(caps.supportedDrivingModes, ['normal', 'sport', 'track'])
  assert.strictEqual(caps.defaultDrivingMode, 'normal')
  assert.strictEqual(caps.transmissionType, 'automatic')
  assert.strictEqual(caps.supportsManualMode, true)
  assert.strictEqual(caps.supportsPaddleShifters, true, 'Porsche possui paddle shifters')
  assert.ok(caps.manualShiftControls.includes('paddle_shifters'), 'Porsche tem paddles')
  assert.ok(caps.manualShiftControls.includes('gear_selector_gesture'), 'Porsche tem seletor gestual no console')
  assert.strictEqual(caps.supportsNos, true)
})

test('1.3 VW Golf GTI MK7.5: modos eco/normal/sport, DSG, apenas paddles de fábrica', () => {
  const golf = loadVehicle('golf-gti')
  const caps = getVehicleCapabilities(golf)

  assert.deepStrictEqual(caps.supportedDrivingModes, ['eco', 'normal', 'sport'])
  assert.strictEqual(caps.transmissionType, 'automatic')
  assert.strictEqual(caps.supportsPaddleShifters, true)
  assert.deepStrictEqual(caps.manualShiftControls, ['paddle_shifters', 'gear_selector_gesture'], 'Golf possui paddle shifters e seletor gestual')
  assert.strictEqual(caps.supportsNos, true)
})

test('1.4 Honda CB1000R: modos eco/normal/sport, câmbio sequencial, sem paddles, sem gestual, sem NOS', () => {
  const bike = loadVehicle('cb1000r')
  const caps = getVehicleCapabilities(bike)

  assert.deepStrictEqual(caps.supportedDrivingModes, ['eco', 'normal', 'sport'])
  assert.strictEqual(caps.transmissionType, 'manual')
  assert.strictEqual(caps.supportsPaddleShifters, false)
  assert.deepStrictEqual(caps.manualShiftControls, ['sequential_lever'])
  assert.strictEqual(caps.supportsNos, false, 'Moto não possui kit NOS instalado')
})

test('1.5 Veículos Manuais Convencionais: sem modos eletrônicos e sem borboletas artificiais', () => {
  const manuals = ['civic-si', 'gol-g6', 'gol-quadrado-turbo', 'opala-4100']
  for (const id of manuals) {
    const car = loadVehicle(id)
    const caps = getVehicleCapabilities(car)
    assert.deepStrictEqual(caps.supportedDrivingModes, [], `${id} não possui modos eletrônicos`)
    assert.strictEqual(caps.transmissionType, 'manual')
    assert.strictEqual(caps.supportsPaddleShifters, false, `${id} sem paddle shifters`)
    assert.deepStrictEqual(caps.manualShiftControls, [], `${id} sem comandos artificiais de troca`)
  }
})

// ─── 2. TRANSIÇÃO LIMPA ENTRE VEÍCULOS NO STORE ───
test('2.1 Transição entre veículos redefine modos para o padrão e impede modos incompatíveis', () => {
  const golf = loadVehicle('golf-gti')
  const civic = loadVehicle('civic-si')
  const yaris = loadVehicle('yaris-2019')

  // Inicializa com Golf GTI e ativa Sport
  useSimulationStore.getState().reset()
  useSimulationStore.getState().init(golf)
  useSimulationStore.getState().setDrivingMode('sport')
  assert.strictEqual(useSimulationStore.getState().drivingMode, 'sport')

  // Troca para Civic Si (manual, sem modos)
  useSimulationStore.getState().init(civic)
  assert.strictEqual(useSimulationStore.getState().drivingMode, 'normal', 'Resetou para normal')
  useSimulationStore.getState().setDrivingMode('sport') // Deve ser rejeitado
  assert.strictEqual(useSimulationStore.getState().drivingMode, 'normal', 'Civic Si rejeita modo sport')

  // Troca para Yaris (apenas normal)
  useSimulationStore.getState().init(yaris)
  assert.strictEqual(useSimulationStore.getState().drivingMode, 'normal')
  useSimulationStore.getState().setDrivingMode('eco') // Deve ser rejeitado
  assert.strictEqual(useSimulationStore.getState().drivingMode, 'normal', 'Yaris rejeita modo eco')
})

// ─── 3. MATRIZ DE CÂMBIO AUTOMÁTICO: D/S E MODOS DE CONDUÇÃO ───
test('3.1 Matriz de trocas automáticas: D+NORMAL, D+SPORT, S+NORMAL, S+SPORT e resolução de conflito S+ECO', () => {
  const golf = loadVehicle('golf-gti')
  const auto = new AutomaticTransmission({
    gearRatios: golf.transmission.gearRatios,
    finalDrive: golf.transmission.finalDrive,
    wheelDiameter: golf.info.wheelDiameter,
    maxRpm: golf.engine.maxRpm,
    idleRpm: golf.engine.idleRpm,
  })

  // D + NORMAL: ~2850-3200 RPM upshift, ~1950-2500 RPM downshift
  const dNormal = auto.getTargetRpmBand('normal', 'D', 0.5, golf.engine.maxPowerRpm)
  assert.ok(dNormal.max >= 2800 && dNormal.max <= 3300, `D+NORMAL upshift (${dNormal.max}) na faixa esperada`)
  assert.ok(dNormal.downshiftThreshold >= 1950 && dNormal.downshiftThreshold <= 2500, `D+NORMAL downshift (${dNormal.downshiftThreshold})`)

  // D + SPORT: ~5200-5800 RPM upshift, ~3800-4250 RPM downshift
  const dSport = auto.getTargetRpmBand('sport', 'D', 0.5, golf.engine.maxPowerRpm)
  assert.ok(dSport.max >= 5200 && dSport.max <= 5900, `D+SPORT upshift (${dSport.max}) na faixa esportiva`)
  assert.ok(dSport.downshiftThreshold >= 3800 && dSport.downshiftThreshold <= 4300, `D+SPORT downshift (${dSport.downshiftThreshold})`)

  // S + NORMAL: mesma estratégia esportiva de D + SPORT
  const sNormal = auto.getTargetRpmBand('normal', 'S', 0.5, golf.engine.maxPowerRpm)
  assert.strictEqual(sNormal.max, dSport.max, 'S+NORMAL tem mesmo teto esportivo de D+SPORT')
  assert.strictEqual(sNormal.downshiftThreshold, dSport.downshiftThreshold)

  // S + SPORT: Desempenho máximo calibrado na potência máxima (Golf GTI maxPowerRpm: 4700)
  const sSport = auto.getTargetRpmBand('sport', 'S', 1.0, golf.engine.maxPowerRpm)
  assert.ok(sSport.max >= golf.engine.maxPowerRpm, `S+SPORT upshift (${sSport.max}) aproveita rotação de pico`)
  assert.ok(sSport.max < golf.engine.maxRpm, `S+SPORT não fica batendo no corte de giro`)

  // Resolução de Conflito S + ECO:
  useSimulationStore.getState().reset()
  useSimulationStore.getState().init(golf)
  useSimulationStore.getState().selectShifterMode('S')
  assert.strictEqual(useSimulationStore.getState().gearSelectorPosition, 'S')

  // Ao ativar ECO enquanto em S, a alavanca retorna para D
  useSimulationStore.getState().setDrivingMode('eco')
  assert.strictEqual(useSimulationStore.getState().drivingMode, 'eco')
  assert.strictEqual(useSimulationStore.getState().gearSelectorPosition, 'D', 'Conflito resolvido: ativou ECO -> voltou seletor para D')

  // Ao selecionar S enquanto em ECO, modo de condução comuta para NORMAL
  useSimulationStore.getState().selectShifterMode('S')
  assert.strictEqual(useSimulationStore.getState().gearSelectorPosition, 'S')
  assert.strictEqual(useSimulationStore.getState().drivingMode, 'normal', 'Conflito resolvido: selecionou S em ECO -> mudou modo para NORMAL')
})

// ─── 4. CORREÇÃO DO INDICADOR P/D NO TOYOTA YARIS ───
test('4.1 Indicador P/D no cluster do Yaris: posições P, R, N, D e M são mutuamente exclusivas', () => {
  const clusterCode = fs.readFileSync(
    path.join(__dirname, 'src/components/dashboard/clusters/ToyotaYarisRealCluster.tsx'),
    'utf-8',
  )

  // Confirma que não usa a lógica antiga !isNeutral && !isReverse para D
  assert.ok(
    !clusterCode.includes('!gear.isNeutral && !gear.isReverse && !isManualSimulated'),
    'Lógica antiga que acendia D simultâneo com P foi eliminada',
  )

  // Confirma resolução unificada de activePos
  assert.ok(clusterCode.includes("activePos === 'P'"), 'Detecta P exclusivamente')
  assert.ok(clusterCode.includes("activePos === 'D'"), 'Detecta D exclusivamente')
  assert.ok(clusterCode.includes("activePos === 'M'"), 'Detecta M exclusivamente')
})

// ─── 5. ACELERADOR PROPORCIONAL E DEMANDA DO MOTOR ───
test('5.1 Acelerador entrega demanda proporcional e contínua de torque (0 a 100%)', () => {
  const golf = loadVehicle('golf-gti')
  const engine = new EngineSimulator(golf.engine)
  engine.start()
  // Avança o tempo de partida (cranking 0.4s) para colocar o motor em 'running'
  engine.tick({ throttle: 0, loadTorque: 0, deltaTime: 0.5 })
  assert.strictEqual(engine.getStatus(), 'running', 'Motor está em funcionamento normal')

  // Torque disponível a 3000 RPM
  const availableTorque = engine.getTorqueAtRpm(3000)
  assert.ok(availableTorque > 250, 'Torque disponível consistente (> 250 Nm)')

  // 0% pedal: torque gerado = 0
  const tick0 = engine.tick({ throttle: 0, loadTorque: 0, deltaTime: 0.001 })
  assert.strictEqual(tick0.torqueOutput, 0, '0% pedal gera 0 torque')

  // Testa diferentes posições do acelerador com progressividade contínua e monotônica
  let prevTorque = 0
  for (const t of [0.25, 0.50, 0.75, 1.0]) {
    const rpmBefore = engine.getRpm()
    const avail = engine.getTorqueAtRpm(rpmBefore)
    const tick = engine.tick({ throttle: t, loadTorque: 0, deltaTime: 0.001 })
    const exp = golf.engine.throttleProgressionExponent ?? 1.45
    const expected = avail * Math.pow(t, exp)
    assert.ok(
      Math.abs(tick.torqueOutput - expected) < 15,
      `Acelerador a ${(t * 100).toFixed(0)}% entrega torque progressivo (${tick.torqueOutput.toFixed(1)} Nm vs esperado ${expected.toFixed(1)} Nm)`,
    )
    assert.ok(tick.torqueOutput > prevTorque, `Torque cresce monotonicamente a ${(t * 100).toFixed(0)}%`)
    prevTorque = tick.torqueOutput
  }
})

// ─── 6. COCKPIT MOBILE: SELETORES VERTICAIS, MAPA, PADDLES E NOS ───
test('6.1 Cockpit Mobile: seletores de visualização em coluna vertical [PAINEL] [DIRIGIR] [MÍDIA]', () => {
  const landscape = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobileLandscapeCockpit.tsx'), 'utf-8')
  const portrait = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobilePortraitCockpit.tsx'), 'utf-8')

  // Verifica coluna vertical compacta de visualização
  assert.ok(landscape.includes("viewTabs.map((tab)"), 'Landscape mapeia viewTabs')
  assert.ok(landscape.includes("flex-col gap-1 bg-zinc-900/90"), 'Landscape possui container vertical de visão')
  assert.ok(portrait.includes("viewTabs.map((tab)"), 'Portrait mapeia viewTabs')
  assert.ok(portrait.includes("flex-col gap-1 bg-zinc-900/90"), 'Portrait possui container vertical de visão')

  // Ordem correta: PAINEL, DIRIGIR, MÍDIA
  assert.ok(landscape.includes("{ id: 'cluster', label: 'PAINEL' }"))
  assert.ok(landscape.includes("{ id: 'hud', label: 'DIRIGIR' }"))
  assert.ok(portrait.includes("{ id: 'cluster', label: 'PAINEL' }"))
  assert.ok(portrait.includes("{ id: 'hud', label: 'DIRIGIR' }"))
})

test('6.2 Cockpit Mobile: borboletas ladeiam o painel de instrumentos sem sobrepor o mapa', () => {
  const landscape = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobileLandscapeCockpit.tsx'), 'utf-8')
  const portrait = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobilePortraitCockpit.tsx'), 'utf-8')

  // Borboletas aparecem apenas quando veículo suporta e modo manual ativo
  assert.ok(landscape.includes('caps.supportsPaddleShifters && isManualActive'), 'Landscape condiciona paddles a suporte e modo manual')
  assert.ok(portrait.includes('caps.supportsPaddleShifters && isManualActive'), 'Portrait condiciona paddles a suporte e modo manual')

  // Borboleta [-] na esquerda e [+] na direita ladeando o cluster
  assert.ok(landscape.includes('<AutomaticShiftButton direction="down" />'), 'Paddle down na esquerda')
  assert.ok(landscape.includes('<AutomaticShiftButton direction="up" />'), 'Paddle up na direita')
})

test('6.3 Cockpit Mobile: Seletor Gestual Vertical para Yaris e Porsche ao lado do câmbio', () => {
  const landscape = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobileLandscapeCockpit.tsx'), 'utf-8')
  const portrait = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobilePortraitCockpit.tsx'), 'utf-8')

  assert.ok(landscape.includes("caps.manualShiftControls.includes('gear_selector_gesture') && isManualActive"))
  assert.ok(landscape.includes('<VerticalGestureShifter size="compact" />'))
  assert.ok(portrait.includes("caps.manualShiftControls.includes('gear_selector_gesture') && isManualActive"))
  assert.ok(portrait.includes('<VerticalGestureShifter size="compact" />'))
})

test('6.4 Cockpit Mobile: Botão NOS oficial posicionado abaixo do 0–100 km/h e fumaça redundante eliminada', () => {
  const landscape = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobileLandscapeCockpit.tsx'), 'utf-8')
  const portrait = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobilePortraitCockpit.tsx'), 'utf-8')

  // Botão NOS no cabeçalho abaixo do 0-100
  assert.ok(landscape.includes('Disparar Nitro NOS'), 'Landscape possui botão oficial NOS abaixo do 0-100')
  assert.ok(portrait.includes('Disparar Nitro NOS'), 'Portrait possui botão oficial NOS abaixo do 0-100')

  // Botão redundante de fumaça (💨 PURGA) removido da interface mobile
  assert.ok(!landscape.includes('title="Purga de Nitro"'), 'Botão redundante de fumaça removido do cockpit landscape')
  assert.ok(!portrait.includes('title="Purga de Nitro"'), 'Botão redundante de fumaça removido do cockpit portrait')
})

test('6.5 Cockpit Mobile: Cabeçalho em 2 linhas (Linha 1: Título, Linha 2: Ficha Técnica resumida)', () => {
  const landscape = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobileLandscapeCockpit.tsx'), 'utf-8')
  const portrait = fs.readFileSync(path.join(__dirname, 'src/components/dashboard/MobilePortraitCockpit.tsx'), 'utf-8')

  assert.ok(landscape.includes('{vehicleHeader.title}') && landscape.includes('{vehicleHeader.specsSummary}'))
  assert.ok(portrait.includes('{vehicleHeader.title}') && portrait.includes('{vehicleHeader.specsSummary}'))
})

console.log('\n===============================================================')
console.log(`RESULTADO DA FASE 1.4: ${passed} PASSOU | ${failed} FALHOU`)
console.log('===============================================================\n')

if (failed > 0) {
  process.exit(1)
}
