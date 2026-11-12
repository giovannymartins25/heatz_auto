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
  const golfConfig = loadConfig('golf-gti')

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

  // ─── TESTE 11: Bloqueio estrito de modos automáticos em carros manuais ───
  useSimulationStore.getState().reset()
  useSimulationStore.getState().init(civicConfig) // Civic Si é Manual 6M

  assert(useSimulationStore.getState().isAutomaticVehicle === false, 'Civic Si identificado corretamente como manual')
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'Carro manual inicia em N (Neutro)')

  // Tentar selecionar P, D, R, S, M
  useSimulationStore.getState().selectShifterMode('P')
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'selectShifterMode("P") rejeitado em carro manual')

  useSimulationStore.getState().selectShifterMode('D')
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'selectShifterMode("D") rejeitado em carro manual')

  useSimulationStore.getState().selectShifterMode('R')
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'selectShifterMode("R") rejeitado em carro manual')

  useSimulationStore.getState().selectShifterMode('S')
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'selectShifterMode("S") rejeitado em carro manual')

  useSimulationStore.getState().selectSport()
  assert(useSimulationStore.getState().gearSelectorPosition === 'N', 'selectSport() rejeitado em carro manual')

  // Ativação do Modo Sport no automático (Golf GTI)
  useSimulationStore.getState().reset()
  useSimulationStore.getState().init(golfConfig)
  assert(useSimulationStore.getState().isAutomaticVehicle === true, 'Golf GTI identificado como automático')
  
  useSimulationStore.getState().selectDrive()
  assert(useSimulationStore.getState().gearSelectorPosition === 'D' && useSimulationStore.getState().drivingMode === 'normal', 'selectDrive() ativa D e modo normal no automático')

  useSimulationStore.getState().selectSport()
  assert(useSimulationStore.getState().gearSelectorPosition === 'S' && useSimulationStore.getState().drivingMode === 'sport', 'Tecla S / selectSport() ativa S e modo sport no automático')

  // Troca D <-> S em velocidade preserva marcha sem resetar para 1ª marcha
  useSimulationStore.setState({ currentGear: 4, speed: 80 })
  useSimulationStore.getState().selectDrive()
  assert(useSimulationStore.getState().currentGear === 4, 'Troca para D a 80 km/h preserva 4ª marcha sem tranco')

  useSimulationStore.getState().selectSport()
  assert(useSimulationStore.getState().currentGear === 4 && useSimulationStore.getState().drivingMode === 'sport', 'Troca para S a 80 km/h preserva 4ª marcha e ativa modo sport')

  // ─── TESTE 12: Isolamento de Upgrades entre diferentes instâncias ───
  const instanceA = useGarageStore.getState().buyCar('gol-g6', 'Gol A - Original', 42000)
  const instanceB = useGarageStore.getState().buyCar('gol-g6', 'Gol B - Turbo Stage 3', 42000)

  // Modificar exclusivamente a instância B
  useGarageStore.getState().installUpgrade(instanceB.instanceId, {
    turboKit: true,
    tuningStage: 3,
    boostGaugeKit: true,
    multimediaKit: true,
  })

  const carA = useGarageStore.getState().getCarById(instanceA.instanceId)
  const carB = useGarageStore.getState().getCarById(instanceB.instanceId)

  assert(
    carA?.upgrades.turboKit === false &&
    carA?.upgrades.tuningStage === 0 &&
    carA?.upgrades.boostGaugeKit === false &&
    carA?.upgrades.multimediaKit === false,
    'Instância A permaneceu 100% original sem contaminação'
  )

  assert(
    carB?.upgrades.turboKit === true &&
    carB?.upgrades.tuningStage === 3 &&
    carB?.upgrades.boostGaugeKit === true &&
    carB?.upgrades.multimediaKit === true,
    'Instância B recebeu os upgrades exclusivamente'
  )

  // ─── TESTE 13: Manômetro Esportivo de Turbo/Vácuo Aftermarket no Interior ───
  useSimulationStore.getState().reset()
  useSimulationStore.getState().init(golG6Config, carB?.upgrades)

  assert(
    useSimulationStore.getState().hasBoostGaugeKit === true,
    'Manômetro de coluna/painel esportivo aftermarket ativado com sucesso no interior'
  )

  // ─── TESTE 14: Integridade do Áudio de Síntese do Civic Si e Gol Quadrado ───
  assert(
    civicConfig.audio.synthConfig.baseFrequency > 0 &&
    civicConfig.audio.synthConfig.harmonics.length > 0 &&
    civicConfig.audio.synthConfig.gainMax > 0,
    'Civic Si possui synthConfig de áudio completo com harmônicos e frequência base'
  )

  assert(
    golQuadradoConfig.audio.synthConfig.baseFrequency > 0 &&
    golQuadradoConfig.audio.synthConfig.harmonics.length > 0 &&
    golQuadradoConfig.audio.synthConfig.gainMax > 0,
    'Gol Quadrado possui synthConfig de áudio completo com harmônicos e frequência base'
  )

  // ─── TESTE 15: Configuração do Tacômetro AutoMeter 10.000 RPM do Gol Quadrado ───
  assert(
    golQuadradoConfig.dashboard.tachometerMax === 10000 &&
    golQuadradoConfig.dashboard.speedometerMax === 260 &&
    golQuadradoConfig.dashboard.redlineStart === 7200,
    'Gol Quadrado possui escala AutoMeter Monster calibrada para 10.000 RPM e redline aos 7.200 RPM'
  )

  // ─── TESTE 16: Compra da Multimídia 2-DIN para carro sem multimídia original ───
  const golQuadCar = useGarageStore.getState().buyCar('gol-quadrado-turbo', 'Gol Quadrado com Multimídia', 65000)
  assert(!golQuadradoConfig.dashboard.hasInfotainment, 'Gol Quadrado sai de fábrica sem multimídia')

  // Equipar multimídia 2-DIN
  useGarageStore.getState().installUpgrade(golQuadCar.instanceId, { multimediaKit: true })
  const updatedQuad = useGarageStore.getState().getCarById(golQuadCar.instanceId)
  assert(updatedQuad?.upgrades.multimediaKit === true, 'Multimídia 2-DIN comprada e persistida no Gol Quadrado')

  useSimulationStore.getState().reset()
  useSimulationStore.getState().init(golQuadradoConfig, updatedQuad?.upgrades, updatedQuad?.instanceId)
  assert(
    useSimulationStore.getState().hasRetrofitInfotainment === true,
    'Simulador inicializa com central multimídia 2-DIN ativa no Gol Quadrado'
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
