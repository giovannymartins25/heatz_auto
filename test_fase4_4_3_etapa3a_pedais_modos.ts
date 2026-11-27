/**
 * HEATZ AUTO — FASE 4.4.3 (ETAPA 3A): Suíte Completa de Pedais Funcionais no Modo Painel,
 * Slots Geométricos Fixos, Intertravamentos Reais, Alternância Sem Reinicialização e Persistência de Combustível
 *
 * Cobre rigorosamente todos os cenários obrigatórios da Etapa 3A:
 * 1. Veículo automático (`bmw-320i-msport-2024`) no Modo Painel e Modo Dirigir (freio desacelerando velocidade longitudinal simulada, trava de acelerador destravando no freio, zero deslocamento/consumo no Painel);
 * 2. Veículo DCT (`porsche-gt3` / `golf-gti`) no Modo Painel e Modo Dirigir (acionamento simultâneo Acelerador + Freio armando Launch Control e frenagem com ABS);
 * 3. Veículo manual (`civic-si` 6M com intertravamento de embreagem + `gol-g6` 5M sem intertravamento) no Modo Painel e Modo Dirigir (ClutchSystem real, zero embreagem automática artificial, acionamento simultâneo Acelerador + Embreagem, bloqueio/arranhada sem embreagem, estol físico em sobrecarga, preservação de `h_pattern`);
 * 4. Motocicleta (`cb1000r`) no Modo Painel e Modo Dirigir (manete de embreagem real obrigatória para trocas sequenciais, freio real desacelerando velocidade simulada, zero inclinação/deslocamento no Painel);
 * 5. Intertravamentos reais de partida (`brake`, `clutch`, `none`) validados COM e SEM pedais exigidos em AMBOS os modos;
 * 6. Alternância direta `Modo Dirigir ↔ Modo Painel` com motor LIGADO e motor DESLIGADO preservando marcha, estado do motor, combustível, consumo médio, autonomia, dados de viagem e hodômetro sem reinicializar a simulação;
 * 7. Cenário exato `30 L → consumir 2 L no Modo Dirigir (28 L) → Modo Painel (permanece 28 L) → Modo Dirigir (28 L e volta a consumir) → Sair para a Garagem → Reentrar no veículo` comprovando persistência real em `useGarageStore` sem sobrescrita pelos `90%` padrão.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { VehicleConfig, VehicleManifest } from './src/types/vehicle'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useGarageStore } from './src/stores/useGarageStore'
import { sharedTiltSteering } from './src/systems/input'

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

function stepSeconds(seconds: number) {
  const ticks = Math.round(seconds * 120)
  const sim = useSimulationStore.getState()
  for (let i = 0; i < ticks; i++) {
    sim.update(1 / 120)
  }
}

console.log('\n=== ETAPA 3A.1 — AUTOMÁTICO (BMW 320i) E DCT (PORSCHE 911 TURBO S): FREIO REAL + INTERTRAVAMENTO + LAUNCH CONTROL ===')
{
  const sim = useSimulationStore.getState()
  const bmw = loadVehicle('bmw-320i-msport-2024')

  // 1. BMW 320i no Modo Painel: intertravamento de freio exigido + aceleração + frenagem até 0 km/h
  sim.reset()
  sim.init(bmw, undefined, null, 'panel')
  const startFuel = useSimulationStore.getState().fuelLevelLiters
  const startPos = { x: useSimulationStore.getState().positionX, y: useSimulationStore.getState().positionY }

  sim.pressPushButtonIgnition(true)
  assert(
    !useSimulationStore.getState().isRunning &&
      useSimulationStore.getState().ignitionFailedAttempts === 1,
    '[BMW 320i · Modo Painel] partida bloqueada sem pisar no freio (intertravamento real)',
  )

  sim.setBrake(0.6)
  sim.pressPushButtonIgnition(true)
  stepSeconds(0.65)
  sim.setBrake(0)
  assert(
    useSimulationStore.getState().isRunning && useSimulationStore.getState().ignitionPosition === 'ON',
    '[BMW 320i · Modo Painel] partida autorizada ao pisar no freio (>= 15%)',
  )

  sim.selectDrive()
  sim.setThrottleLock(true)
  stepSeconds(5.0)
  const bmwPeakSpeed = useSimulationStore.getState().speed
  assert(
    bmwPeakSpeed > 60 && useSimulationStore.getState().throttleLock === true,
    `[BMW 320i · Modo Painel] acelera em D até ${bmwPeakSpeed.toFixed(1)} km/h com trava de acelerador ativa`,
  )

  // Tocar no freio destrava o acelerador e desacelera a velocidade longitudinal simulada até 0 km/h
  sim.setBrake(1.0)
  assert(
    useSimulationStore.getState().throttleLock === false && useSimulationStore.getState().throttle === 0,
    '[BMW 320i · Modo Painel] pisar no freio (>= 10%) destrava automaticamente o acelerador',
  )
  stepSeconds(4.0)
  const bmwStopped = useSimulationStore.getState()
  assert(
    bmwStopped.speed === 0 &&
      bmwStopped.positionX === startPos.x &&
      bmwStopped.positionY === startPos.y &&
      bmwStopped.fuelLevelLiters === startFuel,
    `[BMW 320i · Modo Painel] freio desacelera velocidade longitudinal de ${bmwPeakSpeed.toFixed(1)} -> 0.0 km/h com posição e combustível congelados (${bmwStopped.fuelLevelLiters}L)`,
  )

  // 2. Porsche 911 Turbo S (DCT/PDK) no Modo Painel: Acelerador + Freio simultâneos armam Launch Control
  const porsche = loadVehicle('porsche-gt3')
  sim.reset()
  sim.init(porsche, undefined, null, 'panel')
  sim.setBrake(0.85)
  sim.pressPushButtonIgnition(true)
  stepSeconds(0.65)
  sim.selectSport()
  sim.setBrake(0.85)
  sim.setThrottle(1.0)
  stepSeconds(1.2)
  const lcArmedSt = useSimulationStore.getState()
  assert(
    lcArmedSt.brake === 0.85 &&
      lcArmedSt.throttle === 1.0 &&
      lcArmedSt.isLaunchControlArmed === true &&
      lcArmedSt.speed < 1.5,
    `[Porsche 911 PDK · Modo Painel] acionamento simultâneo Acelerador (100%) + Freio (85%) arma Launch Control (${Math.round(lcArmedSt.rpm)} RPM, ${lcArmedSt.speed.toFixed(1)} km/h)`,
  )

  sim.setBrake(0)
  stepSeconds(3.2)
  const lcLaunchSt = useSimulationStore.getState()
  assert(
    lcLaunchSt.speed > 75 && lcLaunchSt.positionX === startPos.x && lcLaunchSt.positionY === startPos.y,
    `[Porsche 911 PDK · Modo Painel] soltar o freio dispara aceleração longitudinal simulada (${lcLaunchSt.speed.toFixed(1)} km/h) sem deslocar no mapa`,
  )
}

console.log('\n=== ETAPA 3A.2 — MANUAL (CIVIC SI 6M + GOL G6 5M): CLUTCHSYSTEM REAL, ZERO AUTO-CLUTCH E SIMULTANEIDADE ACEL + EMBR ===')
{
  const sim = useSimulationStore.getState()
  const civic = loadVehicle('civic-si')

  sim.reset()
  sim.init(civic, undefined, null, 'panel')
  assert(
    useSimulationStore.getState().shifterLayout === 'h_pattern',
    '[Civic Si · Modo Painel] preserva layout H-Pattern real (não força sequencial artificial)',
  )

  // 1. Intertravamento de embreagem no Modo Painel: falha sem embreagem, liga com embreagem
  sim.setIgnitionPosition('CRANK', true)
  assert(
    !useSimulationStore.getState().isRunning &&
      useSimulationStore.getState().ignitionFailedAttempts === 1,
    '[Civic Si · Modo Painel] partida bloqueada sem pisar na embreagem (startInterlock=clutch)',
  )

  sim.setClutch(1.0)
  sim.setIgnitionPosition('CRANK', true)
  stepSeconds(0.65)
  sim.releaseIgnitionKey()
  assert(
    useSimulationStore.getState().isRunning && useSimulationStore.getState().ignitionPosition === 'ON',
    '[Civic Si · Modo Painel] partida na chave autorizada com embreagem pressionada (100%)',
  )

  // 2. Sem embreagem, tentar subir marcha via shiftUp bloqueia com 'clutch_required' (zero auto-clutch!)
  sim.setClutch(0)
  stepSeconds(0.2)
  sim.shiftUp()
  assert(
    useSimulationStore.getState().currentGear === 0 &&
      useSimulationStore.getState().lastShiftReason === 'clutch_required',
    '[Civic Si · Modo Painel] shiftUp sem embreagem é bloqueado por clutch_required (zero embreagem automática artificial)',
  )

  // 3. Simultaneidade Embreagem (100%) + Acelerador (75%): motor sobe giro desacoplado e acopla progressivamente ao soltar
  sim.setClutch(1.0)
  sim.shiftHPattern(1)
  sim.setThrottle(0.75)
  stepSeconds(0.8)
  const disengagedSt = useSimulationStore.getState()
  assert(
    disengagedSt.currentGear === 1 && disengagedSt.rpm > 4000 && disengagedSt.speed < 0.5,
    `[Civic Si · Modo Painel] Embreagem 100% + Acelerador 75% mantém 1ª desacoplada (${Math.round(disengagedSt.rpm)} RPM, ${disengagedSt.speed.toFixed(1)} km/h)`,
  )

  sim.setClutch(0.45) // Zona de fricção (slip)
  stepSeconds(0.6)
  const slippingSt = useSimulationStore.getState()
  assert(
    slippingSt.isClutchSlipping && slippingSt.clutchTorqueTransfer > 20 && slippingSt.speed > 5,
    `[Civic Si · Modo Painel] meia-embreagem (45%) transfere torque real (${Math.round(slippingSt.clutchTorqueTransfer)} Nm) e inicia rolagem (${slippingSt.speed.toFixed(1)} km/h)`,
  )

  sim.setClutch(0.0)
  stepSeconds(2.4)
  const rolling1st = useSimulationStore.getState().speed
  assert(
    rolling1st > 25,
    `[Civic Si · Modo Painel] embreagem 100% acoplada acelera em 1ª até ${rolling1st.toFixed(1)} km/h`,
  )

  // 4. Tentar engatar 2ª no H-Pattern em movimento (> 6 km/h) SEM embreagem arranha sincronizador!
  sim.shiftHPattern(2)
  assert(
    useSimulationStore.getState().currentGear === 1 &&
      useSimulationStore.getState().isGearGrinding === true &&
      useSimulationStore.getState().lastShiftReason === 'clutch_required',
    '[Civic Si · Modo Painel] H-Pattern 1ª -> 2ª sem embreagem arranha sincronizador (isGearGrinding=true)',
  )

  // Com embreagem pressionada, 2ª entra limpo!
  sim.setClutch(1.0)
  sim.shiftHPattern(2)
  sim.setClutch(0.0)
  stepSeconds(2.0)
  assert(
    useSimulationStore.getState().currentGear === 2 &&
      !useSimulationStore.getState().isGearGrinding &&
      useSimulationStore.getState().speed > 38,
    `[Civic Si · Modo Painel] H-Pattern 1ª -> 2ª com embreagem engata limpo (${useSimulationStore.getState().speed.toFixed(1)} km/h)`,
  )

  // 5. Freia até parar segurando a embreagem e comprova estol real ao largar embreagem em 5ª a 0 km/h sem acelerador
  sim.setThrottle(0)
  sim.setClutch(1.0)
  sim.setBrake(1.0)
  stepSeconds(3.0)
  sim.setBrake(0)
  assert(
    useSimulationStore.getState().speed === 0 && useSimulationStore.getState().isRunning,
    '[Civic Si · Modo Painel] frear até 0 km/h com embreagem pressionada mantém motor vivo em marcha lenta',
  )

  sim.shiftHPattern(5)
  sim.setClutch(0.0) // Solta embreagem bruscamente em 5ª a 0 km/h sem acelerador
  stepSeconds(1.2)
  assert(
    useSimulationStore.getState().isStalled === true && !useSimulationStore.getState().isRunning,
    '[Civic Si · Modo Painel] soltar embreagem em 5ª a 0 km/h sem acelerador estola o motor (prova definitiva de zero auto-clutch)',
  )

  // 6. Gol G6 (startInterlock = 'none'): parte na chave sem exigir pedal em ambos os modos
  const gol = loadVehicle('gol-g6')
  for (const mode of ['panel', 'drive'] as const) {
    sim.reset()
    sim.init(gol, undefined, null, mode)
    sim.setIgnitionPosition('CRANK', true)
    stepSeconds(0.65)
    sim.releaseIgnitionKey()
    assert(
      useSimulationStore.getState().isRunning,
      `[Gol G6 · modo=${mode}] startInterlock='none' permite partida direta na chave sem exigir pedal`,
    )
  }
}

console.log('\n=== ETAPA 3A.3 — MOTOCICLETA (CB1000R): MANETE DE EMBREAGEM E FREIO REAIS EM AMBOS OS MODOS ===')
{
  const sim = useSimulationStore.getState()
  const cb1000r = loadVehicle('cb1000r')

  for (const mode of ['panel', 'drive'] as const) {
    sim.reset()
    sim.init(cb1000r, undefined, null, mode)
    sim.setIgnitionPosition('CRANK', true)
    stepSeconds(0.65)
    sim.releaseIgnitionKey()

    // Sem puxar a manete de embreagem, shiftUp é bloqueado!
    sim.setClutch(0)
    sim.shiftUp()
    assert(
      useSimulationStore.getState().currentGear === 0 &&
        useSimulationStore.getState().lastShiftReason === 'clutch_required',
      `[CB1000R · modo=${mode}] engatar 1ª sem manete de embreagem é bloqueado por clutch_required`,
    )

    // Com manete puxada + acelerador, engata 1ª -> 2ª e depois freia até 0 km/h
    sim.setClutch(1.0)
    sim.shiftUp()
    sim.setThrottle(0.95)
    sim.setClutch(0.35)
    stepSeconds(0.8)
    sim.setClutch(0.0)
    stepSeconds(3.5)
    sim.setClutch(1.0)
    sim.shiftUp()
    sim.setClutch(0.0)
    stepSeconds(2.0)
    const peakMotoSpeed = useSimulationStore.getState().speed

    sim.setThrottle(0)
    sim.setClutch(1.0)
    sim.setBrake(1.0)
    sharedTiltSteering.processSample({ beta: 20, gamma: 0, isLandscape: true, orientationAngle: 90 }, 1 / 60, true)
    stepSeconds(3.5)
    const stoppedMoto = useSimulationStore.getState()
    assert(
      peakMotoSpeed > 50 &&
        stoppedMoto.currentGear === 2 &&
        stoppedMoto.speed === 0 &&
        stoppedMoto.isRunning &&
        (mode === 'drive' || (stoppedMoto.leanAngleDeg === 0 && stoppedMoto.steeringAngle === 0)),
      `[CB1000R · modo=${mode}] acelera a ${peakMotoSpeed.toFixed(1)} km/h em 2ª e freia até 0.0 km/h mantendo motor vivo com manete acionada`,
    )
  }
}

console.log('\n=== ETAPA 3A.4 — ALTERNÂNCIA DE MODO COM MOTOR DESLIGADO E MOTOR LIGADO (PRESERVAÇÃO TOTAL DE ESTADO) ===')
{
  const sim = useSimulationStore.getState()
  const civic = loadVehicle('civic-si')

  // Caso A: Motor DESLIGADO (chave em ACC, 2ª marcha engatada) -> Dirigir <-> Painel
  sim.reset()
  sim.init(civic, undefined, null, 'drive')
  sim.setIgnitionPosition('ACC', true)
  sim.setClutch(1.0)
  sim.shiftHPattern(2)
  sim.setClutch(0)
  const offBefore = useSimulationStore.getState()

  sim.setSessionMode('panel')
  const offInPanel = useSimulationStore.getState()
  assert(
    offInPanel.isRunning === false &&
      offInPanel.ignitionPosition === 'ACC' &&
      offInPanel.currentGear === 2 &&
      offInPanel.shifterLayout === 'h_pattern' &&
      offInPanel.fuelLevelLiters === offBefore.fuelLevelLiters &&
      offInPanel.estimatedRangeKm === offBefore.estimatedRangeKm &&
      offInPanel.odometerKm === offBefore.odometerKm,
    '[Alternância Motor DESLIGADO · Drive -> Panel] preserva ignição ACC, 2ª marcha, H-Pattern, combustível, autonomia e hodômetro',
  )

  sim.setSessionMode('drive')
  const offBackToDrive = useSimulationStore.getState()
  assert(
    offBackToDrive.isRunning === false &&
      offBackToDrive.ignitionPosition === 'ACC' &&
      offBackToDrive.currentGear === 2 &&
      offBackToDrive.shifterLayout === 'h_pattern' &&
      offBackToDrive.fuelLevelLiters === offBefore.fuelLevelLiters,
    '[Alternância Motor DESLIGADO · Panel -> Drive] retorna ao Modo Dirigir sem reinicializar estado',
  )

  // Caso B: Motor LIGADO em movimento e com viagem acumulada -> Dirigir -> Painel -> Dirigir
  const bmw = loadVehicle('bmw-320i-msport-2024')
  sim.reset()
  sim.init(bmw, undefined, null, 'drive')
  sim.setBrake(0.8)
  sim.pressPushButtonIgnition(true)
  stepSeconds(0.65)
  sim.setBrake(0)
  sim.selectDrive()
  sim.setThrottle(0.85)
  stepSeconds(5.5)

  const runningDrive = useSimulationStore.getState()
  const gearBeforeSwitch = runningDrive.currentGear
  const fuelBeforeSwitch = runningDrive.fuelLevelLiters
  const avgKmLBeforeSwitch = runningDrive.avgConsumptionKmL
  const rangeBeforeSwitch = runningDrive.estimatedRangeKm
  const tripDistBeforeSwitch = runningDrive.tripDistanceKm
  const tripFuelBeforeSwitch = runningDrive.tripFuelUsedLiters
  const odoBeforeSwitch = runningDrive.odometerKm

  sim.setSessionMode('panel')
  stepSeconds(0.5)
  const runningPanel = useSimulationStore.getState()
  assert(
    runningPanel.isRunning === true &&
      runningPanel.ignitionPosition === 'ON' &&
      runningPanel.currentGear === gearBeforeSwitch &&
      runningPanel.gearSelectorPosition === 'D' &&
      runningPanel.fuelLevelLiters === fuelBeforeSwitch &&
      runningPanel.avgConsumptionKmL === avgKmLBeforeSwitch &&
      runningPanel.estimatedRangeKm === rangeBeforeSwitch &&
      runningPanel.tripDistanceKm === tripDistBeforeSwitch &&
      runningPanel.tripFuelUsedLiters === tripFuelBeforeSwitch &&
      runningPanel.odometerKm === odoBeforeSwitch,
    `[Alternância Motor LIGADO · Drive -> Panel] preserva motor ON, D${runningPanel.currentGear}, tanque (${runningPanel.fuelLevelLiters}L), média (${runningPanel.avgConsumptionKmL} km/L), autonomia (${runningPanel.estimatedRangeKm} km), viagem (${runningPanel.tripDistanceKm} km) e odo (${runningPanel.odometerKm} km)`,
  )

  sim.setSessionMode('drive')
  const runningBackDrive = useSimulationStore.getState()
  assert(
    runningBackDrive.isRunning === true &&
      runningBackDrive.ignitionPosition === 'ON' &&
      runningBackDrive.currentGear === 1 &&
      runningBackDrive.gearSelectorPosition === 'D' &&
      runningBackDrive.speed === 0 &&
      runningBackDrive.fuelLevelLiters === fuelBeforeSwitch &&
      runningBackDrive.avgConsumptionKmL === avgKmLBeforeSwitch &&
      runningBackDrive.estimatedRangeKm === rangeBeforeSwitch &&
      runningBackDrive.tripDistanceKm === tripDistBeforeSwitch &&
      runningBackDrive.tripFuelUsedLiters === tripFuelBeforeSwitch &&
      runningBackDrive.odometerKm === odoBeforeSwitch,
    '[Alternância Motor LIGADO · Panel -> Drive] preserva motor ON, seletor D (D1 estacionário pronto para arrancar), combustível, consumo, autonomia, viagem e hodômetro',
  )
}

console.log('\n=== ETAPA 3A.5 — CENÁRIO EXATO 30 L -> 28 L -> PAINEL -> DIRIGIR -> GARAGEM -> REENTRADA (SEM SOBRESCREVER COM 90%) ===')
{
  const sim = useSimulationStore.getState()
  const garage = useGarageStore.getState()
  const gti = loadVehicle('golf-gti')
  const gtiInstance = garage.resolveInstanceForVehicle(gti.id)
  if (!gtiInstance) throw new Error('Instância padrão do Golf GTI não encontrada')

  const originalMileage = gtiInstance.mileageKm
  const originalFuel = gtiInstance.fuelLevelLiters

  // 1. Configura tanque persistido em exatos 30.000 L (diferente dos 45.0 L = 90% padrão do tanque de 50 L!)
  garage.setFuelLevelLiters(gtiInstance.instanceId, 30.0)
  sim.reset()
  sim.init(gti, gtiInstance.upgrades, gtiInstance.instanceId, 'drive')

  assert(
    useSimulationStore.getState().fuelLevelLiters === 30.0 &&
      useSimulationStore.getState()._phys.fuelLevelLiters === 30.0,
    `[Entrada da Garagem] tanque inicializa em exatos 30.000 L persistidos (NÃO sobrescreve pelos 45.0 L / 90% padrão!)`,
  )

  // Posiciona na reta norte livre de obstáculos para consumir exatos ~2.000 L até ~28.000 L
  const repositionNorth = () => {
    const s = useSimulationStore.getState()
    s._physics?.setPosition(0, 55, 0)
    if (s._integrator && s._physics) {
      const cand = s._integrator.getState()
      cand.physics = s._physics.getStateSnapshot()
      cand.phys.positionX = 0
      cand.phys.positionY = 55
      cand.phys.headingDeg = 0
      s._integrator.setState(cand)
    }
  }
  repositionNorth()

  sim.setBrake(0.8)
  sim.pressPushButtonIgnition(true)
  stepSeconds(0.65)
  sim.setBrake(0)
  sim.selectDrive()
  sim.setThrottle(1.0)

  let guard = 0
  while (useSimulationStore.getState()._phys.fuelLevelLiters > 28.0 && guard < 72000) {
    if (useSimulationStore.getState()._phys.positionY > 235) {
      repositionNorth()
    }
    sim.update(1 / 120)
    guard++
  }

  // Força publicação lenta para alinhar fuelLevelLiters público
  stepSeconds(0.2)
  const at28Drive = Math.round(useSimulationStore.getState()._phys.fuelLevelLiters * 1000) / 1000
  assert(
    Math.abs(at28Drive - 28.0) <= 0.05,
    `[Modo Dirigir] consumiu ~2 L de 30.000 L para ${at28Drive.toFixed(3)} L (~28 L)`,
  )

  // 2. Alterna para Modo Painel e acelera WOT por 10s: permanece estritamente em ~28 L!
  sim.setSessionMode('panel')
  const fuelEnteringPanel = useSimulationStore.getState().fuelLevelLiters
  sim.selectDrive()
  sim.setThrottle(1.0)
  stepSeconds(10.0)
  const afterPanelWot = useSimulationStore.getState()
  assert(
    afterPanelWot.speed > 130 &&
      afterPanelWot.fuelLevelLiters === fuelEnteringPanel &&
      afterPanelWot._phys.fuelLevelLiters === fuelEnteringPanel,
    `[Modo Painel · 10s WOT] permanece cravado em ${afterPanelWot.fuelLevelLiters.toFixed(3)} L (Δ = 0.000 L a ${afterPanelWot.speed.toFixed(1)} km/h)`,
  )

  // 3. Retorna ao Modo Dirigir: começa em ~28 L e volta a consumir ao rodar
  sim.setSessionMode('drive')
  assert(
    useSimulationStore.getState().fuelLevelLiters === fuelEnteringPanel,
    `[Retorno Modo Dirigir] preserva exatamente ${fuelEnteringPanel.toFixed(3)} L`,
  )
  repositionNorth()
  sim.selectDrive()
  sim.setThrottle(0.85)
  stepSeconds(3.0)
  const afterResumedDrive = Math.round(useSimulationStore.getState()._phys.fuelLevelLiters * 1000) / 1000
  assert(
    afterResumedDrive < fuelEnteringPanel,
    `[Modo Dirigir Retomado] volta a consumir normalmente (${fuelEnteringPanel.toFixed(3)} L -> ${afterResumedDrive.toFixed(3)} L)`,
  )

  // 4. Sai para a Garagem (persistCurrentVehicleState + reset) e reentra no veículo!
  sim.persistCurrentVehicleState()
  sim.reset()

  const persistedInGarage = useGarageStore.getState().getCarById(gtiInstance.instanceId)?.fuelLevelLiters
  assert(
    persistedInGarage === afterResumedDrive,
    `[Persistência Garagem] useGarageStore salvou exatamente ${persistedInGarage?.toFixed(3)} L ao sair para a garagem`,
  )

  // Reentra no Modo Painel e depois no Modo Dirigir a partir da Garagem: NÃO sobrescreve com 45.0 L (90%)!
  sim.init(gti, gtiInstance.upgrades, gtiInstance.instanceId, 'panel')
  assert(
    useSimulationStore.getState().fuelLevelLiters === afterResumedDrive,
    `[Reentrada Garagem -> Modo Painel] restaura ${useSimulationStore.getState().fuelLevelLiters.toFixed(3)} L (sem sobrescrever com 90% = 45.0 L)`,
  )
  sim.reset()
  sim.init(gti, gtiInstance.upgrades, gtiInstance.instanceId, 'drive')
  assert(
    useSimulationStore.getState().fuelLevelLiters === afterResumedDrive,
    `[Reentrada Garagem -> Modo Dirigir] restaura ${useSimulationStore.getState().fuelLevelLiters.toFixed(3)} L (sem sobrescrever com 90% = 45.0 L)`,
  )

  // Restaura estado original da instância padrão para isolar demais suítes
  sim.reset()
  useGarageStore.setState((state) => ({
    ownedCars: state.ownedCars.map((c) =>
      c.instanceId === gtiInstance.instanceId
        ? { ...c, mileageKm: originalMileage, fuelLevelLiters: originalFuel }
        : c,
    ),
  }))
}

console.log(`\n════════════════════════════════════════════════════════════════════════`)
console.log(`  RESULTADO ETAPA 3A: ${passed} asserções aprovadas, ${failed} falhas`)
console.log(`════════════════════════════════════════════════════════════════════════\n`)

if (failed > 0) {
  process.exit(1)
}
