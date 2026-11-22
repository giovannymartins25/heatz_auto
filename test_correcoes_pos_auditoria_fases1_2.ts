/**
 * Suite funcional real — Correções Pós-Auditoria das Fases 1 e 2:
 * 1. Modos de condução da Honda CB1000R 2022 (RAIN / STANDARD / SPORT) e efeitos reais a 120 Hz.
 * 2. Mapa do Mundo dedicado (WorldMapModal / isWorldMapOpen) isolado do Minimap e do Painel de Instrumentos,
 *    acompanhando posição/orientação em tempo real sem reiniciar a simulação.
 */
import fs from 'fs'
import path from 'path'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useUIStore } from './src/stores/useUIStore'
import { DashboardSystem } from './src/systems/dashboard'
import { TractionControlSystem } from './src/systems/physics/TractionControlSystem'
import { getVehicleCapabilities, type VehicleConfig } from './src/types'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++
    console.log(`  ✅ PASS: ${label}${detail ? ` (${detail})` : ''}`)
  } else {
    failed++
    console.error(`  ❌ FAIL: ${label}${detail ? ` (${detail})` : ''}`)
  }
}

function loadVehicle(id: string): VehicleConfig {
  const filePath = path.join(process.cwd(), 'public', 'vehicles', id, 'config.json')
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as VehicleConfig
}

function stepSeconds(seconds: number) {
  const ticks = Math.round(seconds * 120)
  for (let i = 0; i < ticks; i++) {
    useSimulationStore.getState().update(1 / 120)
  }
}

console.log('\n═══════════════════════════════════════════════════════════════════')
console.log(' HEATZ AUTO — TESTES FUNCIONAIS PÓS-AUDITORIA (CB1000R + MAPA MUNDO)')
console.log('═══════════════════════════════════════════════════════════════════\n')

// ─── 1. HONDA CB1000R 2022 — MODOS RAIN / STANDARD / SPORT ────────────────────
console.log('1. Honda CB1000R 2022 — Configuração, Capacidades, Cluster e Efeito Real 120 Hz')
{
  const cb1000r = loadVehicle('cb1000r')
  const caps = getVehicleCapabilities(cb1000r)

  assert(
    JSON.stringify(cb1000r.transmission.supportedModes) === JSON.stringify(['eco', 'normal', 'sport']),
    'cb1000r/config.json declara supportedModes = ["eco", "normal", "sport"] (RAIN / STANDARD / SPORT)',
    JSON.stringify(cb1000r.transmission.supportedModes),
  )
  assert(
    caps.hasDriveModes && caps.defaultDrivingMode === 'normal',
    'getVehicleCapabilities habilita seletor de modos com default STANDARD (normal)',
    `hasDriveModes=${caps.hasDriveModes}, default=${caps.defaultDrivingMode}`,
  )

  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(cb1000r)

  for (const mode of ['eco', 'normal', 'sport'] as const) {
    sim.setDrivingMode(mode)
    const st = useSimulationStore.getState()
    const telemetry = DashboardSystem.computeTelemetry(DashboardSystem.createInputFromState(cb1000r, st))
    assert(
      st.drivingMode === mode && telemetry.gear.drivingMode === mode,
      `Modo "${mode}" propagado corretamente para store e DashboardTelemetry`,
      `store=${st.drivingMode}, cluster=${telemetry.gear.drivingMode}`,
    )
  }

  // Mede retomada limpa em 2ª marcha a partir de 40 km/h (120 Hz, sem patinada de arrancada)
  const measureCbSpeed = (mode: 'eco' | 'normal' | 'sport') => {
    sim.reset()
    sim.init(cb1000r)
    sim.startEngine()
    stepSeconds(0.5)
    sim.setDrivingMode(mode)
    sim.setClutch(1.0)
    sim.shiftUp() // 1ª
    sim.shiftUp() // 2ª
    sim.setClutch(0)
    useSimulationStore.setState({ speed: 40 })
    useSimulationStore.getState()._phys.speedKmh = 40
    const phys = useSimulationStore.getState()._physics
    if (phys) {
      phys.restoreSnapshot({ ...phys.getStateSnapshot(), speedMs: 40 / 3.6 })
    }
    sim.setThrottle(0.85)
    stepSeconds(2.0)
    return useSimulationStore.getState().speed
  }

  const speedRain = measureCbSpeed('eco')
  const speedStd = measureCbSpeed('normal')
  const speedSport = measureCbSpeed('sport')

  assert(
    speedRain > 20 && speedRain < speedStd && speedStd < speedSport,
    'Entrega de potência real na CB1000R cresce progressivamente: RAIN < STANDARD < SPORT',
    `RAIN=${speedRain.toFixed(1)} < STD=${speedStd.toFixed(1)} < SPORT=${speedSport.toFixed(1)} km/h`,
  )

  // Verifica intervenção diferencial do HSTC (TCS) entre RAIN (eco) e SPORT ao longo de 0.3s
  const tcsRain = new TractionControlSystem()
  const tcsSport = new TractionControlSystem()
  tcsRain.setEnabled(true)
  tcsSport.setEnabled(true)
  let resRain = tcsRain.process({
    wheelTorque: 900,
    wheelSpeedKmh: 58,
    vehicleSpeedKmh: 50,
    drivingMode: 'eco',
    maxGripTorque: 850,
    deltaTime: 1 / 120,
  })
  let resSport = tcsSport.process({
    wheelTorque: 900,
    wheelSpeedKmh: 58,
    vehicleSpeedKmh: 50,
    drivingMode: 'sport',
    maxGripTorque: 850,
    deltaTime: 1 / 120,
  })
  for (let i = 0; i < 36; i++) {
    resRain = tcsRain.process({
      wheelTorque: 900,
      wheelSpeedKmh: 58,
      vehicleSpeedKmh: 50, // slip ~13.8%: acima do limiar ECO (0.04) e abaixo de SPORT (0.14)
      drivingMode: 'eco',
      maxGripTorque: 920,
      deltaTime: 1 / 120,
    })
    resSport = tcsSport.process({
      wheelTorque: 900,
      wheelSpeedKmh: 58,
      vehicleSpeedKmh: 50,
      drivingMode: 'sport',
      maxGripTorque: 920,
      deltaTime: 1 / 120,
    })
  }
  assert(
    resRain.effectiveWheelTorque < resSport.effectiveWheelTorque,
    'HSTC (TCS) atua mais restritivamente em RAIN (eco) do que em SPORT',
    `torque RAIN=${resRain.effectiveWheelTorque.toFixed(0)} Nm vs SPORT=${resSport.effectiveWheelTorque.toFixed(0)} Nm`,
  )
}

// ─── 2. MAPA DO MUNDO DEDICADO × MINIMAP × PAINEL DE INSTRUMENTOS ────────────
console.log('\n2. Mapa do Mundo — Abertura/Fechamento isolados e Sincronia em Tempo Real')
{
  const porsche = loadVehicle('porsche-gt3')
  const sim = useSimulationStore.getState()
  const ui = useUIStore.getState()

  sim.reset()
  sim.init(porsche)
  ui.setMapOpen(true)
  ui.setViewMode('cluster')
  ui.closeWorldMap()

  // Liga e dirige o carro antes de abrir o Mapa do Mundo
  sim.startEngine()
  stepSeconds(0.7)
  sim.selectShifterMode('D')
  sim.setThrottle(0.7)
  sim.setSteeringAngle(0.35)
  stepSeconds(1.5)

  const beforeOpen = useSimulationStore.getState()
  const posXBefore = beforeOpen.positionX
  const posYBefore = beforeOpen.positionY
  const speedBefore = beforeOpen.speed
  const gearBefore = beforeOpen.currentGear
  const isRunningBefore = beforeOpen.isRunning

  assert(
    speedBefore > 20 && Math.hypot(posXBefore, posYBefore - 25) > 5,
    'Veículo está em movimento antes de abrir o Mapa do Mundo',
    `speed=${speedBefore.toFixed(1)} km/h, pos=(${posXBefore.toFixed(1)}, ${posYBefore.toFixed(1)})`,
  )

  // Abre o Mapa do Mundo
  useUIStore.getState().toggleWorldMap()
  const uiAfterOpen = useUIStore.getState()
  assert(uiAfterOpen.isWorldMapOpen === true, 'Botão do mapa abre isWorldMapOpen=true')
  assert(
    uiAfterOpen.isMapOpen === true && uiAfterOpen.viewMode === 'cluster',
    'Abrir Mapa do Mundo NÃO esconde o minimap nem troca viewMode/painel de instrumentos',
    `isMapOpen=${uiAfterOpen.isMapOpen}, viewMode=${uiAfterOpen.viewMode}`,
  )

  // Continua simulando enquanto o Mapa do Mundo está aberto → posição acompanha o movimento
  stepSeconds(1.0)
  const duringOpen = useSimulationStore.getState()
  const movedDist = Math.hypot(duringOpen.positionX - posXBefore, duringOpen.positionY - posYBefore)
  assert(
    movedDist > 4,
    'Posição do veículo continua acompanhando o movimento com o Mapa do Mundo aberto',
    `Δdist=${movedDist.toFixed(1)}m, pos=(${duringOpen.positionX.toFixed(1)}, ${duringOpen.positionY.toFixed(1)})`,
  )

  // Fecha o Mapa do Mundo e confirma que a simulação NÃO foi reiniciada
  useUIStore.getState().closeWorldMap()
  const uiAfterClose = useUIStore.getState()
  const simAfterClose = useSimulationStore.getState()
  assert(uiAfterClose.isWorldMapOpen === false, 'Fechar Mapa do Mundo define isWorldMapOpen=false e retorna ao cockpit')
  assert(
    simAfterClose.isRunning === isRunningBefore &&
      simAfterClose.currentGear >= gearBefore &&
      simAfterClose.speed > 15 &&
      Math.abs(simAfterClose.positionX - duringOpen.positionX) < 1e-6 &&
      Math.abs(simAfterClose.positionY - duringOpen.positionY) < 1e-6,
    'Fechar Mapa do Mundo preserva integralmente estado da simulação (sem reiniciar motor, marcha ou posição)',
    `running=${simAfterClose.isRunning}, gear=${simAfterClose.currentGear}, speed=${simAfterClose.speed.toFixed(1)} km/h`,
  )
}

console.log('\n═══════════════════════════════════════════════════════════════════')
console.log(` RESULTADO FINAL: ${passed} PASSOU · ${failed} FALHOU`)
console.log('═══════════════════════════════════════════════════════════════════\n')

if (failed > 0) {
  process.exit(1)
}
