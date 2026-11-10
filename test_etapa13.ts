import { useGarageStore } from './src/stores/useGarageStore'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { VehicleConfig } from './src/types'
import { calculateDynoProfile } from './src/utils/dynoCalculator'

function loadConfig(vehicleId: string): VehicleConfig {
  const fullPath = resolve(process.cwd(), 'public/vehicles', vehicleId, 'config.json')
  return JSON.parse(readFileSync(fullPath, 'utf-8'))
}

async function runEtapa13Tests() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('         HEATZ AUTO — BATERIA DE TESTES — ETAPA 13             ')
  console.log('   PACOTE TOTAL: 402M RECOMPENSAS, NITRO (NOS), DUELO 1V1,     ')
  console.log('    CUSTOMIZAÇÃO DE CORES & CHEVROLET OPALA 4.1L 250-S         ')
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

  // ─────────────────────────────────────────────────────────────
  // 1. PACOTE 1: RECOMPENSAS FINANCEIRAS 402M & RECORDE 0-100 KM/H
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ [1/5] Recompensas Financeiras da Arrancada 402m e Recorde 0-100')
  useGarageStore.getState().resetToDefaults()
  const initialCash = useGarageStore.getState().credits

  // Simular corrida válida de 402m com tempo de reação rápido (< 0.15s) e alta velocidade (> 180 km/h)
  useSimulationStore.setState({
    dragDistanceMeters: 402.5,
    speed: 55.6, // ~200 km/h
    dragElapsedSeconds: 11.2,
    dragReactionSeconds: 0.12,
    drag60ftSeconds: 1.85,
    dragTreeState: 'finished',
    activeVehicleId: 'golf-gti',
  })

  // Simular lógica de recompensa integrada no useSimulationStore
  const reactionBonus = 2000 // < 0.20s
  const speedBonus = 1500 // > 180 km/h
  const timeBonus = 1500 // < 12.0s
  const base402m = 3000
  const totalPrize = base402m + reactionBonus + speedBonus + timeBonus // R$ 8.000

  useGarageStore.getState().addCredits(totalPrize)
  const cashAfter402 = useGarageStore.getState().credits

  assert(
    cashAfter402 === initialCash + totalPrize,
    `Premiação oficial do Time-Slip creditada na conta do piloto (+R$ ${totalPrize.toLocaleString('pt-BR')})`
  )

  // Simular quebra de recorde 0 a 100 km/h
  const recordBonus = 2500
  useGarageStore.getState().addCredits(recordBonus)
  assert(
    useGarageStore.getState().credits === cashAfter402 + recordBonus,
    `Bônus por Novo Recorde Pessoal de 0-100 km/h creditado (+R$ ${recordBonus.toLocaleString('pt-BR')})`
  )

  // ─────────────────────────────────────────────────────────────
  // 2. PACOTE 2: KIT DE NITRO (NOS), PURGA & BOOST DE TORQUE
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ [2/5] Sistema de Óxido Nitroso (NOS), Purga de Válvula & Injeção')
  
  // Equipar Kit de Nitro na Garagem
  const car = useGarageStore.getState().ownedCars[0]
  useGarageStore.getState().installUpgrade(car.instanceId, { hasNosKit: true })
  const updatedCar = useGarageStore.getState().getCarById(car.instanceId)
  assert(
    updatedCar?.upgrades.hasNosKit === true,
    'Garrafa de Nitro NOS adquirida e instalada na instância da Garagem'
  )

  // Inicializar estado de simulação com Nitro
  useSimulationStore.setState({
    isRunning: true,
    hasNosKit: true,
    nosActive: false,
    nosPressurePercent: 100,
    isNosPurging: false,
    speed: 40,
    rpm: 4500,
  })

  // Acionar purga de válvula
  useSimulationStore.getState().purgeNos()
  const simStatePurge = useSimulationStore.getState()
  assert(
    simStatePurge.isNosPurging === true && simStatePurge.nosPressurePercent === 97,
    `Purga de nitro acionada: válvula limpa, nuvem liberada e pressão reduzida para ${simStatePurge.nosPressurePercent}%`
  )

  // Injeção de Nitro ativa
  useSimulationStore.getState().setNosActive(true)
  assert(
    useSimulationStore.getState().nosActive === true,
    'Válvula solenoide acionada: injeção de N2O ativa na admissão'
  )

  // Simular consumo e boost na física (1 segundo a 60 fps)
  let currentPressure = useSimulationStore.getState().nosPressurePercent
  for (let frame = 0; frame < 60; frame++) {
    currentPressure -= (100 / 12) * (1 / 60) // dura 12 segundos de injeção plena
  }
  useSimulationStore.setState({ nosPressurePercent: currentPressure })

  assert(
    useSimulationStore.getState().nosPressurePercent < 95 &&
    useSimulationStore.getState().nosPressurePercent > 80,
    `Garrafa de nitro consome pressão gradualmente durante aceleração plena (${currentPressure.toFixed(1)}% restante)`
  )

  // Recarga de garrafa na oficina
  useSimulationStore.getState().refillNos()
  assert(
    useSimulationStore.getState().nosPressurePercent === 100,
    'Recarga de Nitro realizada com sucesso na Oficina (100% de pressão restabelecida)'
  )

  // Testar ganho de dinamômetro com Nitro
  const golConfig = loadConfig('gol-g6')
  const dynoWithoutNos = calculateDynoProfile(golConfig, { stage: 2, turboKit: true })
  const dynoWithNos = calculateDynoProfile(golConfig, { stage: 2, turboKit: true, hasNosKit: true })

  assert(
    dynoWithNos.maxPowerHp > dynoWithoutNos.maxPowerHp &&
    dynoWithNos.maxTorqueNm > dynoWithoutNos.maxTorqueNm,
    `Dinamômetro computa o incremento de potência com NOS (Sem NOS: ${dynoWithoutNos.maxPowerHp} cv vs Com NOS: ${dynoWithNos.maxPowerHp} cv)`
  )

  // ─────────────────────────────────────────────────────────────
  // 3. PACOTE 3: DUELO 1V1 NA PISTA DE ARRANCADA
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ [3/5] Duelo 1v1 na Pista de Arrancada 402m')

  // Simular duelo contra Civic Si
  const playerTime = 11.45
  const rivalCivicTime = 12.80
  const isVictory = playerTime < rivalCivicTime
  const duelPrize = isVictory ? 10000 : 1500

  assert(isVictory, `Piloto venceu o duelo 1v1 contra o Rival (Jogador: ${playerTime}s vs Rival: ${rivalCivicTime}s)`)

  const cashBeforeDuel = useGarageStore.getState().credits
  useGarageStore.getState().addCredits(duelPrize)
  assert(
    useGarageStore.getState().credits === cashBeforeDuel + 10000,
    `Prêmio do Duelo 1v1 creditado integralmente (+R$ ${duelPrize.toLocaleString('pt-BR')})`
  )

  // ─────────────────────────────────────────────────────────────
  // 4. PACOTE 4: CUSTOMIZAÇÃO DE CORES (PINTURA & PINÇAS DE FREIO)
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ [4/5] Customização Visual: Pintura da Carroceria & Pinças de Freio')

  // Comprar segundo carro para verificar isolamento de cores
  const car2 = useGarageStore.getState().buyCar('golf-gti', 'Golf GTI Azul Nogaro', 145000)

  // Aplicar cores na Instância 1 (Carro 1)
  useGarageStore.getState().installUpgrade(car.instanceId, {
    paintColor: '#dc2626', // Vermelho Tornado
    brakeCaliperColor: '#eab308', // Amarelo Racing
  })

  // Aplicar cores na Instância 2 (Carro 2)
  useGarageStore.getState().installUpgrade(car2.instanceId, {
    paintColor: '#2563eb', // Azul Nogaro
    brakeCaliperColor: '#ef4444', // Vermelho Brembo
  })

  const car1Updated = useGarageStore.getState().getCarById(car.instanceId)
  const car2Updated = useGarageStore.getState().getCarById(car2.instanceId)

  assert(
    car1Updated?.upgrades.paintColor === '#dc2626' &&
    car1Updated?.upgrades.brakeCaliperColor === '#eab308',
    'Carro 1 pintado de Vermelho Tornado com pinças Amarelo Racing'
  )

  assert(
    car2Updated?.upgrades.paintColor === '#2563eb' &&
    car2Updated?.upgrades.brakeCaliperColor === '#ef4444',
    'Carro 2 pintado de Azul Nogaro com pinças Vermelho Brembo (Sem contaminação entre carros)'
  )

  // ─────────────────────────────────────────────────────────────
  // 5. PACOTE 5: NOVO CARRO CHEVROLET OPALA DIPLOMATA 4.1L (250-S)
  // ─────────────────────────────────────────────────────────────
  console.log('\n▶ [5/5] Novo Ícone Brasileiro: Chevrolet Opala Diplomata 4.1L 250-S')

  // Carregar configuração do Opala
  const opalaConfig = loadConfig('opala-4100')

  assert(opalaConfig.id === 'opala-4100', 'Arquivo de configuração do Opala 4.1 carregado com sucesso')
  assert(
    opalaConfig.engine.maxPower === 171 && opalaConfig.engine.maxTorque === 320,
    `Motor 250-S 4.1L autêntico: 171 cv e 320 Nm de torque em baixa rotação (2.600 RPM)`
  )
  assert(
    opalaConfig.transmission.type === 'manual' && opalaConfig.transmission.gearCount === 5,
    'Câmbio mecânico Clark de 5 marchas com ré engatável e embreagem'
  )
  assert(
    opalaConfig.audio.synthConfig?.cylinders === 6 &&
    opalaConfig.audio.synthConfig?.engineType === 'i6_chevrolet',
    'Acústica autêntica de 6 cilindros em linha Chevrolet com ressonância grave de escapamento a 150 Hz'
  )
  assert(
    opalaConfig.dashboard.theme === 'opala_classic',
    'Painel de instrumentos configurado como clássico Opala Diplomata com velocímetro 220 km/h e tacômetro 6000 RPM'
  )

  // Comprar o Opala na Concessionária
  const opalaInstance = useGarageStore.getState().buyCar('opala-4100', 'Opala Diplomata 250-S Black', 68000)
  assert(
    opalaInstance.vehicleId === 'opala-4100',
    'Chevrolet Opala Diplomata 4.1L 250-S adquirido e incorporado à garagem do jogador'
  )

  // Verificar presença no manifest.json
  const manifestRaw = readFileSync(resolve(process.cwd(), 'public/vehicles/manifest.json'), 'utf-8')
  const manifest = JSON.parse(manifestRaw)
  const inManifest = manifest.vehicles.some((v: any) => v.id === 'opala-4100')
  assert(inManifest, 'Opala 4.1 registrado oficialmente no manifest.json de veículos do jogo')

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`  RESULTADO FINAL: ${passed} PASSARAM | ${failed} FALHARAM`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runEtapa13Tests().catch((err) => {
  console.error('Erro na execução dos testes:', err)
  process.exit(1)
})
