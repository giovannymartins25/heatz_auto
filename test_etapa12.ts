import { useSimulationStore } from './src/stores/useSimulationStore'
import { calculateDynoProfile } from './src/utils/dynoCalculator'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { VehicleConfig } from './src/types'

function loadConfig(vehicleId: string): VehicleConfig {
  const fullPath = resolve(process.cwd(), 'public/vehicles', vehicleId, 'config.json')
  return JSON.parse(readFileSync(fullPath, 'utf-8'))
}

async function runEtapa12Tests() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('         HEATZ AUTO — BATERIA DE TESTES — ETAPA 12             ')
  console.log('   ULTRA-REALISMO: TÉRMICA, DANOS, COMBUSTÍVEL, H-SHIFTER,     ')
  console.log('       BURNOUT, FREIOS AO RUBRO, DINAMÔMETRO & 402M           ')
  console.log('═══════════════════════════════════════════════════════════════\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`✓ PASSOU | ${desc}`)
      passed++
    } else {
      console.error(`✗ FALHOU | ${desc}`)
      failed++
    }
  }

  const golG6Config = loadConfig('gol-g6')
  const porscheConfig = loadConfig('porsche-gt3')
  const civicConfig = loadConfig('civic-si')
  const golQuadradoConfig = loadConfig('gol-quadrado-turbo')

  // ─── RECURSO 1: SISTEMA REAL DE COMBUSTÍVEL & PANE SECA ───
  console.log('▶ [1/6] Sistema de Combustível, Consumo Dinâmico & Pane Seca')
  useSimulationStore.getState().init(golG6Config)
  assert(useSimulationStore.getState().fuelLevelLiters === 45, 'Tanque inicializado com 45 Litros')
  assert(useSimulationStore.getState().fuelType === 'common_gasoline', 'Combustível padrão é Gasolina Comum')

  // Troca de combustível para Etanol E100
  useSimulationStore.getState().setFuelType('ethanol_e100')
  assert(useSimulationStore.getState().fuelType === 'ethanol_e100', 'Combustível alterado com sucesso para Etanol Puro E100')

  // Ligar motor e acelerar para simular consumo
  useSimulationStore.getState().startEngine()
  useSimulationStore.getState().setThrottle(1.0)
  for (let i = 0; i < 50; i++) {
    useSimulationStore.getState().update(0.1) // 5 segundos sob aceleração plena
  }
  const fuelAfterBurn = useSimulationStore.getState().fuelLevelLiters
  assert(fuelAfterBurn < 45, `Combustível consumido sob plena carga: ${fuelAfterBurn.toFixed(2)}L restando`)

  // Simular tanque quase vazio para testar pane seca
  useSimulationStore.setState({ fuelLevelLiters: 0.001 })
  useSimulationStore.getState().update(0.1)
  assert(
    useSimulationStore.getState().isOutOfFuel && !useSimulationStore.getState().isRunning,
    'Pane Seca detectada: motor desliga e entra em estado de estol'
  )

  // Tentar dar partida com pane seca deve ser bloqueado
  useSimulationStore.getState().startEngine()
  assert(!useSimulationStore.getState().isRunning, 'Partida bloqueada enquanto tanque estiver em pane seca')

  // Abastecer o carro
  useSimulationStore.getState().refuel(25)
  assert(
    useSimulationStore.getState().fuelLevelLiters === 25 && !useSimulationStore.getState().isOutOfFuel,
    'Tanque abastecido com sucesso (+25L) e pane seca desativada'
  )

  // ─── RECURSO 2: DINÂMICA TÉRMICA & DANOS (SUPERAQUECIMENTO & MONEY SHIFT) ───
  console.log('\n▶ [2/6] Dinâmica Térmica & Danos (Superaquecimento e Money Shift)')
  useSimulationStore.getState().init(civicConfig)
  useSimulationStore.getState().startEngine()
  assert(useSimulationStore.getState().coolantTemp === 88, 'Temperatura da água inicializa em 88°C (faixa ideal)')

  // Forçar superaquecimento extremo (>125°C)
  useSimulationStore.setState({ coolantTemp: 126 })
  useSimulationStore.getState().update(0.1)
  assert(
    useSimulationStore.getState().isEngineBlown && !useSimulationStore.getState().isRunning,
    'Motor funde ao superar 125°C com quebra catastrófica'
  )
  assert(
    useSimulationStore.getState().damageReason?.includes('Superaquecimento') === true,
    `Motivo da quebra registrado: "${useSimulationStore.getState().damageReason}"`
  )

  // Reparo do motor
  useSimulationStore.getState().repairEngine()
  assert(
    !useSimulationStore.getState().isEngineBlown && useSimulationStore.getState().coolantTemp === 88,
    'Oficina repara o motor, restaura componentes e resfria arrefecimento'
  )

  // Teste de Money Shift no Câmbio Manual
  // Civic Si andando a 160 km/h: piloto joga a 2ª marcha (Money Shift devastador!)
  useSimulationStore.setState({ speed: 160, currentGear: 5, clutchPosition: 1.0 })
  useSimulationStore.getState().shiftHPattern(2)
  assert(
    useSimulationStore.getState().isEngineBlown,
    'Money Shift destrutivo detectado e motor explodido ao engatar 2ª marcha a 160 km/h'
  )
  assert(
    useSimulationStore.getState().damageReason?.includes('Money Shift') === true,
    `Motivo de quebra registrado com RPM excessivo: "${useSimulationStore.getState().damageReason}"`
  )

  // ─── RECURSO 3: CÂMBIO MANUAL H-SHIFTER & ARRANHÃO DE SINCRONIZADOR ───
  console.log('\n▶ [3/6] Câmbio Manual H-Shifter & Arranhar de Marcha')
  useSimulationStore.getState().repairEngine()
  useSimulationStore.getState().init(golQuadradoConfig)
  useSimulationStore.getState().startEngine()
  useSimulationStore.getState().setShifterLayout('h_pattern')
  assert(useSimulationStore.getState().shifterLayout === 'h_pattern', 'Layout do câmbio configurado para Grade H')

  // Engatar 1ª marcha parado sem embreagem: permitido (veículo imóvel)
  useSimulationStore.setState({ speed: 0, clutchPosition: 0 })
  useSimulationStore.getState().shiftHPattern(1)
  assert(useSimulationStore.getState().currentGear === 1, '1ª marcha engata com veículo imóvel')

  // Carro em velocidade (45 km/h): trocar para 2ª SEM pisar na embreagem deve arranhar!
  useSimulationStore.setState({ speed: 45, clutchPosition: 0 })
  useSimulationStore.getState().shiftHPattern(2)
  assert(
    useSimulationStore.getState().isGearGrinding,
    'Sincronizador arranha violentamente ao tentar trocar marcha em movimento sem pisar na embreagem'
  )
  assert(
    useSimulationStore.getState().lastShiftReason === 'clutch_required',
    'Motivo de bloqueio de marcha registrado como "clutch_required"'
  )

  // Agora pisando na embreagem (clutchPosition = 1.0)
  useSimulationStore.setState({ speed: 45, clutchPosition: 1.0 })
  useSimulationStore.getState().shiftHPattern(2)
  assert(
    useSimulationStore.getState().currentGear === 2 && !useSimulationStore.getState().isGearGrinding,
    'Marcha engata perfeitamente de forma suave ao acionar a embreagem'
  )

  // ─── RECURSO 4: BURNOUT / FUMAÇA DE PNEUS & FREIOS AO RUBRO ───
  console.log('\n▶ [4/6] Burnout, Fumaça de Pneu & Temperatura de Freios com Fade')
  useSimulationStore.getState().init(golQuadradoConfig, { turboKit: true })
  useSimulationStore.getState().startEngine()
  for (let i = 0; i < 45; i++) {
    useSimulationStore.getState().update(0.016)
  }
  assert(useSimulationStore.getState().brakeDiscTemp === 60, 'Discos de freio inicializam em 60°C')

  // Simular Burnout: Parado em 1ª marcha, acelerador fundo e freio pressionado
  useSimulationStore.getState().shiftHPattern(1)
  useSimulationStore.setState({ speed: 5, rpm: 4500 })
  useSimulationStore.getState().setThrottle(0.9)
  useSimulationStore.getState().setBrake(0.8)
  for (let i = 0; i < 20; i++) {
    useSimulationStore.getState().update(0.1)
  }
  assert(
    useSimulationStore.getState().isBurningOut && useSimulationStore.getState().tireSmokeDensity > 0.1,
    `Burnout detectado e nuvem de fumaça gerada (${Math.round(useSimulationStore.getState().tireSmokeDensity * 100)}%)`
  )

  // Simular Frenagem Intensa em Alta Velocidade (>650°C Brake Fade)
  useSimulationStore.setState({ speed: 180, brakeDiscTemp: 450 })
  useSimulationStore.getState().setBrake(1.0)
  for (let i = 0; i < 15; i++) {
    useSimulationStore.setState({ speed: 180 - i * 4 })
    useSimulationStore.getState().update(0.1)
  }
  const brakeTemp = useSimulationStore.getState().brakeDiscTemp
  assert(brakeTemp >= 500 && useSimulationStore.getState().isBrakeGlowing, `Discos de freio ao rubro incandescente (>500°C): ${brakeTemp}°C`)
  assert(useSimulationStore.getState().brakeFadeFactor < 1.0, `Brake Fade ativo reduzindo poder de frenagem (Fator: ${useSimulationStore.getState().brakeFadeFactor.toFixed(2)})`)

  // ─── RECURSO 5: DINAMÔMETRO DE CHASSI VIRTUAL ───
  console.log('\n▶ [5/6] Dinamômetro Virtual & Curvas de Potência / Torque')
  const stockDyno = calculateDynoProfile(golG6Config, { tuningStage: 0 })
  const stage3Dyno = calculateDynoProfile(golG6Config, { tuningStage: 3, turboKit: true, fuelType: 'ethanol_e100' })

  assert(stockDyno.dataPoints.length > 15, 'Curva de dinamômetro gerou pontos detalhados de RPM')
  assert(
    stage3Dyno.maxPowerHp > stockDyno.maxPowerHp * 1.8,
    `Stage 3 + Turbo + Etanol amplia cavalaria brutalmente (Stock: ${stockDyno.maxPowerHp} cv vs Stage 3: ${stage3Dyno.maxPowerHp} cv)`
  )
  assert(
    stage3Dyno.maxTorqueNm > stockDyno.maxTorqueNm * 1.8,
    `Torque maximizado no dinamômetro (Stock: ${stockDyno.maxTorqueNm} Nm vs Stage 3: ${stage3Dyno.maxTorqueNm} Nm)`
  )

  // ─── RECURSO 6: PISTA DE ARRANCADA 402M (DRAG STRIP) & VIDROS ELÉTRICOS ───
  console.log('\n▶ [6/6] Pista de Arrancada 402m (NHRA Tree) & Vidros Elétricos')
  useSimulationStore.getState().init(porscheConfig)
  useSimulationStore.getState().startEngine()

  // Teste dos Vidros
  assert(!useSimulationStore.getState().windowsOpen, 'Vidros iniciam fechados (acústica isolada)')
  useSimulationStore.getState().toggleWindows()
  assert(useSimulationStore.getState().windowsOpen, 'Vidros abertos com sucesso (acústica aberta com indução nítida)')

  // Iniciar Pista de Arrancada
  useSimulationStore.getState().startDragRace()
  assert(useSimulationStore.getState().dragStage === 'pre_stage', 'Carro alinhado na largada em Pre-Stage')

  // Teste de Falsa Largada (Queima antes do verde)
  useSimulationStore.setState({ speed: 10, _dragDistanceTraveled: 1.5 })
  useSimulationStore.getState().update(0.1)
  assert(
    useSimulationStore.getState().dragStage === 'false_start',
    'Queima de largada (Red Foul) detectada imediatamente com desclassificação'
  )
  assert(
    useSimulationStore.getState().dragTimeSlip?.isDisqualified === true,
    'Time-Slip oficial emitido marcando desclassificação'
  )

  // Largada válida
  useSimulationStore.getState().resetDragRace()
  useSimulationStore.setState({
    dragStage: 'green',
    _dragGreenTime: performance.now() - 250, // 250ms após a luz verde
    speed: 0,
  })
  // Carro sai acelerando
  useSimulationStore.setState({ speed: 45 })
  useSimulationStore.getState().update(0.1)
  assert(useSimulationStore.getState().dragStage === 'racing', 'Largada válida confirmada: cronômetro oficial disparado')

  // Cruzando a marca de 402m (1/4 de milha)
  useSimulationStore.setState({ _dragDistanceTraveled: 405, speed: 220 })
  useSimulationStore.getState().update(0.1)
  assert(useSimulationStore.getState().dragStage === 'finished', 'Chegada aos 402 metros registrada com sucesso')
  assert(
    (useSimulationStore.getState().dragTimeSlip?.trapSpeedKmh ?? 0) >= 200,
    `Trap Speed aferido nos 402m: ${useSimulationStore.getState().dragTimeSlip?.trapSpeedKmh} km/h`
  )

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`  RESULTADO FINAL: ${passed} PASSARAM | ${failed} FALHARAM`)
  console.log('═══════════════════════════════════════════════════════════════')

  if (failed > 0) {
    process.exit(1)
  }
}

runEtapa12Tests().catch((err) => {
  console.error('Erro na execução dos testes:', err)
  process.exit(1)
})
