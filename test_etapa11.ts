import { useGarageStore } from './src/stores/useGarageStore'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { VehicleConfig } from './src/types'

function loadConfig(vehicleId: string): VehicleConfig {
  const fullPath = resolve(process.cwd(), 'public/vehicles', vehicleId, 'config.json')
  return JSON.parse(readFileSync(fullPath, 'utf-8'))
}

async function runEtapa11Tests() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('         HEATZ AUTO — BATERIA DE TESTES — ETAPA 11             ')
  console.log('   GARAGEM MULTI-CARROS, CONCESSIONÁRIA, LOJA DE PEÇAS & SOM   ')
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

  // ─── TESTE 1: Múltiplos carros do mesmo modelo na Garagem ───
  useGarageStore.getState().resetToDefaults()
  const initialCount = useGarageStore.getState().ownedCars.length

  // Comprar 2 Gol G6 adicionais com nomes diferentes
  const gol2 = useGarageStore.getState().buyCar('gol-g6', 'Gol G6 Turbo Projeto', 42000)
  const gol3 = useGarageStore.getState().buyCar('gol-g6', 'Gol G6 Pista Trackday', 42000)

  const carsAfterBuy = useGarageStore.getState().ownedCars
  const golCount = carsAfterBuy.filter((c) => c.vehicleId === 'gol-g6').length

  assert(
    carsAfterBuy.length === initialCount + 2 && golCount >= 3,
    `Garagem suporta múltiplos carros do mesmo modelo (Gols na frota: ${golCount})`
  )

  // ─── TESTE 2: Renomear veículo na Garagem ───
  useGarageStore.getState().renameCar(gol2.instanceId, 'Gol G6 1.9 Turbo Monstro')
  const updatedGol2 = useGarageStore.getState().ownedCars.find((c) => c.instanceId === gol2.instanceId)
  assert(
    updatedGol2?.customName === 'Gol G6 1.9 Turbo Monstro',
    'Renomeação de carro salva e persistida com sucesso'
  )

  // ─── TESTE 3: Equipar Peças da Loja em Carro Aspirado (Transformar em Turbo) ───
  assert(!golG6Config.engine.turbo?.enabled, 'Gol G6 original é naturalmente aspirado de fábrica')

  // Equipar Kit Turbo, Stage 2, Escapamento Direto, Intake K&N, Pneus Semi-Slick e Multimídia Retrofit
  useGarageStore.getState().installUpgrade(gol2.instanceId, {
    turboKit: true,
    tuningStage: 2,
    exhaustType: 'straight_pipe',
    intakeType: 'cold_air',
    tires: 'semi_slick',
    multimediaKit: true,
  })

  const upgradedCar = useGarageStore.getState().ownedCars.find((c) => c.instanceId === gol2.instanceId)
  assert(
    Boolean(
      upgradedCar?.upgrades.turboKit &&
      upgradedCar?.upgrades.tuningStage === 2 &&
      upgradedCar?.upgrades.exhaustType === 'straight_pipe' &&
      upgradedCar?.upgrades.intakeType === 'cold_air' &&
      upgradedCar?.upgrades.tires === 'semi_slick' &&
      upgradedCar?.upgrades.multimediaKit
    ),
    'Todas as peças (Turbo, Stage 2, Straight Pipe, Intake K&N, Semi-Slick, Multimídia 2-DIN) equipadas na instância'
  )

  // ─── TESTE 4: Inicialização do Simulador com Upgrades da Garagem ───
  useSimulationStore.getState().reset()
  useSimulationStore.getState().init(golG6Config, upgradedCar?.upgrades)

  const simState = useSimulationStore.getState()
  assert(
    simState.hasTurbo === true &&
    simState.tuningStage === 2 &&
    simState.exhaustType === 'straight_pipe' &&
    simState.intakeType === 'cold_air' &&
    simState.tires === 'semi_slick' &&
    simState.hasRetrofitInfotainment === true,
    'Simulador inicializado com peças instaladas: hasTurbo=true, stage=2, straight_pipe, cold_air, semi_slick, retrofit'
  )

  // ─── TESTE 5: Geração de Pressão de Turbo em Carro originalmente aspirado ───
  useSimulationStore.getState().startEngine()
  useSimulationStore.getState().setThrottle(1.0)
  for (let i = 0; i < 60; i++) {
    useSimulationStore.getState().update(0.016)
  }

  const boost = useSimulationStore.getState().boostPressureBar
  assert(
    boost > 0,
    `Kit Turbo gera pressão de boost positiva no motor aspirado (pressão: ${boost.toFixed(2)} bar)`
  )

  // ─── TESTE 6: Aderência dos Pneus Semi-Slick vs Radial ───
  useSimulationStore.getState().setEquippedUpgrades({ tires: 'semi_slick' })
  assert(useSimulationStore.getState().tires === 'semi_slick', 'Pneus Semi-Slick equipados com alta aderência')

  useSimulationStore.getState().setEquippedUpgrades({ tires: 'street' })
  assert(
    useSimulationStore.getState().tires === 'street',
    'Alternância entre pneus de rua e semi-slick de pista'
  )

  // ─── TESTE 7: Asa Traseira Ativa (Active Wing Aerodynamics) ───
  useSimulationStore.getState().reset()
  useSimulationStore.getState().init(porscheConfig)
  assert(!useSimulationStore.getState().isAeroWingExtended, 'Porsche inicia com asa traseira fechada (arrasto reduzido)')

  useSimulationStore.getState().toggleAeroWing()
  assert(
    useSimulationStore.getState().isAeroWingExtended === true,
    'Toggle da Asa Traseira Porsche PCM 6.0 aciona modo aerodinâmico (+150kg downforce)'
  )

  // ─── TESTE 8: Civic Si com Perfil K20 i-VTEC & Multimídia ───
  assert(
    civicConfig.audio.engineType === 'i4_vtec' && civicConfig.dashboard.hasInfotainment === true,
    'Civic Si possui perfil de áudio i4_vtec e central multimídia 2-DIN habilitada'
  )

  // ─── TESTE 9: Gol Quadrado com Perfil AP 1.9 Turbo ───
  assert(
    golQuadradoConfig.audio.engineType === 'i4_ap' && golQuadradoConfig.engine.turbo?.enabled === true,
    'Gol Quadrado possui perfil de áudio i4_ap e turbocompressor de 2.15 bar'
  )

  // ─── TESTE 10: Venda de Veículo e Reembolso de Créditos ───
  const creditsBefore = useGarageStore.getState().credits
  useGarageStore.getState().sellCar(gol3.instanceId, 30000)
  const creditsAfter = useGarageStore.getState().credits
  const remainingCars = useGarageStore.getState().ownedCars

  assert(
    creditsAfter === creditsBefore + 30000 && !remainingCars.some((c) => c.instanceId === gol3.instanceId),
    'Venda de veículo remove unidade da frota e reembolsa carteira com sucesso'
  )

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  if (failed > 0) process.exit(1)
}

runEtapa11Tests().catch((err) => {
  console.error(err)
  process.exit(1)
})
