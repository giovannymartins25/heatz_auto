import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useSimulationStore } from './src/stores/useSimulationStore'
import { useUIStore, type GraphicProfile } from './src/stores/useUIStore'
import { DashboardSystem } from './src/systems/dashboard'
import { AutomaticTransmission } from './src/systems/transmission/AutomaticTransmission'
import { EngineSimulator } from './src/systems/engine/EngineSimulator'
import { ClutchSystem } from './src/systems/clutch/ClutchSystem'
import { VehiclePhysics } from './src/systems/physics/VehiclePhysics'
import { performanceMonitor } from './src/utils/performanceMonitor'
import type { VehicleConfig, DrivingMode } from './src/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ALL_VEHICLE_IDS = [
  'gol-g6',
  'gol-quadrado-turbo',
  'golf-gti',
  'porsche-gt3',
  'yaris-2019',
  'civic-si',
  'opala-4100',
  'cb1000r',
] as const

function loadVehicle(vehicleId: string): VehicleConfig {
  const fullPath = path.join(__dirname, 'public/vehicles', vehicleId, 'config.json')
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as VehicleConfig
}

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, relPath), 'utf-8')
}

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`[OK] ${name}`)
    passed++
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[FAIL] ${name}: ${msg}`)
    failed++
  }
}

const DT_120 = 1 / 120

function stepStore(seconds: number, dt = DT_120, onStep?: (tick: number) => void) {
  const ticks = Math.round(seconds / dt)
  for (let i = 0; i < ticks; i++) {
    useSimulationStore.getState().update(dt)
    onStep?.(i)
  }
}

function warmUpStart(config: VehicleConfig, upgrades?: Record<string, unknown>) {
  const sim = useSimulationStore.getState()
  sim.reset()
  sim.init(config, upgrades)
  sim.startEngine()
  stepStore(0.6)
}

function launchManualToSpeed(targetSpeedKmh: number, maxSeconds = 12) {
  const sim = useSimulationStore.getState()
  sim.setClutch(1.0)
  sim.shiftUp() // 1ª marcha
  sim.setThrottle(0.95)
  stepStore(0.25)

  const maxTicks = Math.round(maxSeconds / DT_120)
  for (let i = 0; i < maxTicks; i++) {
    const s = useSimulationStore.getState()
    if (s._phys.speedKmh >= targetSpeedKmh) break

    // Modulação suave na zona de atrito evita estol em motos com 1ª longa (ex: CB1000R)
    if (s._phys.gear === 1 && s._phys.speedKmh < 18) {
      s.setClutch(Math.max(0, 0.52 - (s._phys.speedKmh / 18) * 0.52))
    } else {
      s.setClutch(0)
    }

    const maxRpm = s._config?.engine.maxRpm ?? 6500
    if (s._phys.rpm >= maxRpm * 0.85 && s._phys.gear < 4) {
      s.setClutch(1.0)
      s.shiftUp()
      s.update(DT_120)
      s.setClutch(0)
    } else {
      s.update(DT_120)
    }
  }
  useSimulationStore.getState().setClutch(0)
}

function accelerateAutoToSpeed(targetSpeedKmh: number, throttle = 0.85, maxSeconds = 15) {
  const sim = useSimulationStore.getState()
  sim.selectShifterMode('D')
  sim.setThrottle(throttle)
  const maxTicks = Math.round(maxSeconds / DT_120)
  for (let i = 0; i < maxTicks; i++) {
    useSimulationStore.getState().update(DT_120)
    if (useSimulationStore.getState()._phys.speedKmh >= targetSpeedKmh) break
  }
}

console.log('\n===============================================================')
console.log('  HEATZ AUTO · FASE 1.5.5 — FÍSICA, TRANSMISSÃO & 60 FPS CAP')
console.log('===============================================================\n')

const golG6 = loadVehicle('gol-g6')
const golQuadradoTurbo = loadVehicle('gol-quadrado-turbo')
const golfGti = loadVehicle('golf-gti')
const porscheGt3 = loadVehicle('porsche-gt3')
const yaris = loadVehicle('yaris-2019')

// ─────────────────────────────────────────────────────────────
// BLOCO 1 — INTEGRIDADE TÉRMICA (GOL G6, GOL QUADRADO TURBO E OUTROS)
// ─────────────────────────────────────────────────────────────

test('1.1 Marcha lenta estável nos Gol sem saltos térmicos bruscos', () => {
  for (const car of [golG6, golQuadradoTurbo]) {
    useUIStore.getState().setGraphicProfile('normal')
    warmUpStart(car)

    const initialTemp = useSimulationStore.getState()._phys.coolantTemp
    let maxStepJump = 0
    let prevTemp = initialTemp

    stepStore(10, DT_120, () => {
      const curTemp = useSimulationStore.getState()._phys.coolantTemp
      const stepDelta = Math.abs(curTemp - prevTemp)
      if (stepDelta > maxStepJump) maxStepJump = stepDelta
      prevTemp = curTemp
    })

    const finalState = useSimulationStore.getState()
    assert.ok(maxStepJump < 0.05, `${car.id}: variação por substep foi mínima (${maxStepJump.toFixed(4)}°C)`)
    assert.ok(
      finalState._phys.coolantTemp >= 85 && finalState._phys.coolantTemp <= 94,
      `${car.id}: coolantTemp estável em idle (${finalState._phys.coolantTemp.toFixed(2)}°C)`,
    )
    assert.strictEqual(finalState._phys.isRadiatorFanOn, false, `${car.id}: ventoinha desligada em idle normal`)
  }
})

test('1.2 Subida térmica gradual sob carga contínua nos Gol (inclusive Stage 3) sem saltos repentinos', () => {
  // Testa inclusive Gol Quadrado Turbo preparado (Stage 3) que antes disparava >15°C/s
  useUIStore.getState().setGraphicProfile('normal')
  warmUpStart(golQuadradoTurbo, { tuningStage: 3, turboKit: true })

  const sim = useSimulationStore.getState()
  sim.setClutch(0)
  sim.setThrottle(1.0) // Neutro acelerando forte

  let prevSecondTemp = sim._phys.coolantTemp
  let maxPerSecondRise = 0
  let maxSubstepDelta = 0
  let prevTickTemp = prevSecondTemp

  for (let sec = 1; sec <= 5; sec++) {
    stepStore(1.0, DT_120, () => {
      const t = useSimulationStore.getState()._phys.coolantTemp
      const d = Math.abs(t - prevTickTemp)
      if (d > maxSubstepDelta) maxSubstepDelta = d
      prevTickTemp = t
    })
    const curTemp = useSimulationStore.getState()._phys.coolantTemp
    const rise = curTemp - prevSecondTemp
    if (rise > maxPerSecondRise) maxPerSecondRise = rise
    prevSecondTemp = curTemp
  }

  const endTemp = useSimulationStore.getState()._phys.coolantTemp
  assert.ok(endTemp > 88.2, `Carga intensa deve aquecer gradualmente (${endTemp.toFixed(2)}°C)`)
  assert.ok(maxPerSecondRise < 4.0, `Sem saltos de vários graus por segundo em Stage 3 (pico ${maxPerSecondRise.toFixed(2)}°C/s)`)
  assert.ok(maxSubstepDelta < 0.05, `Sem salto instantâneo por tick (${maxSubstepDelta.toFixed(4)}°C)`)
})

test('1.3 Histerese da ventoinha (liga >= 96°C, mantém ativa > 91°C e desliga <= 91°C)', () => {
  warmUpStart(golG6)
  const sim = useSimulationStore.getState()

  // Começa abaixo do limiar de acionamento
  useSimulationStore.setState({ coolantTemp: 95.6 })
  sim.setThrottle(0.95)

  let turnedOnAt = 0
  for (let i = 0; i < 600; i++) {
    useSimulationStore.getState().update(DT_120)
    const p = useSimulationStore.getState()._phys
    if (p.isRadiatorFanOn) {
      turnedOnAt = p.coolantTemp
      break
    }
  }
  assert.ok(turnedOnAt >= 96.0, `Ventoinha acionou ao atingir >= 96°C (${turnedOnAt.toFixed(2)}°C)`)

  // Em 93.5°C ainda dentro da banda de histerese -> deve permanecer ligada
  useSimulationStore.setState({ coolantTemp: 93.5 })
  useSimulationStore.getState().setThrottle(0)
  useSimulationStore.getState().update(DT_120)
  assert.strictEqual(
    useSimulationStore.getState()._phys.isRadiatorFanOn,
    true,
    'Ventoinha permanece ligada em 93.5°C devido à histerese (desliga apenas <= 91°C)',
  )

  // Abaixo de 91.0°C -> desliga
  useSimulationStore.setState({ coolantTemp: 90.8 })
  useSimulationStore.getState().update(DT_120)
  assert.strictEqual(
    useSimulationStore.getState()._phys.isRadiatorFanOn,
    false,
    'Ventoinha desliga ao baixar para <= 91°C',
  )
})

test('1.4 Resfriamento coerente ao aliviar carga em cruzeiro + termostática evita queda brusca', () => {
  warmUpStart(golG6)
  launchManualToSpeed(80, 14)

  // Sobe temperatura para simulacro de condução quente e sincroniza _phys antes de aliviar pedal
  useSimulationStore.setState({ coolantTemp: 103.5 })
  useSimulationStore.getState().setThrottle(0)
  useSimulationStore.getState().update(DT_120)

  const beforeCoastTemp = useSimulationStore.getState()._phys.coolantTemp
  stepStore(6.0)
  const afterCoastTemp = useSimulationStore.getState()._phys.coolantTemp

  assert.ok(afterCoastTemp < beforeCoastTemp, `Água deve esfriar ao aliviar acelerador (${beforeCoastTemp.toFixed(2)} -> ${afterCoastTemp.toFixed(2)}°C)`)
  assert.ok(afterCoastTemp >= 85.0, `Válvula termostática impede queda irreal abaixo de 85°C (${afterCoastTemp.toFixed(2)}°C)`)

  // Em temperatura ideal (~88°C) soltar o acelerador em movimento não despenca para 60°C
  useSimulationStore.setState({ coolantTemp: 88.2 })
  useSimulationStore.getState().update(DT_120)
  stepStore(5.0)
  const thermTemp = useSimulationStore.getState()._phys.coolantTemp
  assert.ok(thermTemp >= 84.5 && thermTemp <= 91.0, `Temperatura regulada pela termostática (${thermTemp.toFixed(2)}°C)`)
})

test('1.5 Evolução independente de oilTemp + superaquecimento >= 125°C funde o motor', () => {
  warmUpStart(golG6)
  const sim = useSimulationStore.getState()
  const oilStart = sim._phys.oilTemp

  sim.setThrottle(0.95)
  stepStore(8.0)
  const highLoadState = useSimulationStore.getState()._phys
  assert.ok(highLoadState.oilTemp > oilStart, `Óleo aquece com carga/RPM (${oilStart.toFixed(2)} -> ${highLoadState.oilTemp.toFixed(2)}°C)`)
  assert.ok(
    highLoadState.oilTemp > highLoadState.coolantTemp + 2.5,
    `Óleo opera acima da água sob carga contínua (${highLoadState.oilTemp.toFixed(2)} vs H2O ${highLoadState.coolantTemp.toFixed(2)})`,
  )

  // Abuso extremo até ultrapassar 125°C
  useSimulationStore.setState({ coolantTemp: 124.75 })
  sim.setThrottle(1.0)
  stepStore(2.0)

  const blownState = useSimulationStore.getState()
  assert.strictEqual(blownState._phys.isEngineBlown, true, 'Superaquecimento crítico (>= 125°C) preservado')
  assert.strictEqual(blownState._phys.isRunning, false, 'Motor desliga após queima por superaquecimento')
})

test('1.6 DashboardSystem e clusters/infotainments refletem temperatura ao vivo (sem 90°C fixo)', () => {
  const input = DashboardSystem.createInputFromState(golQuadradoTurbo, {
    rpm: 2800,
    status: 'running',
    isRevLimiting: false,
    isBogWarning: false,
    speed: 65,
    currentGear: 3,
    transmissionMode: 'manual',
    drivingMode: 'normal',
    isKickdown: false,
    throttle: 0.4,
    brake: 0,
    clutchPosition: 0,
    clutchSlipRpm: 0,
    clutchSlipRatio: 0,
    clutchTorqueTransfer: 80,
    clutchHeat: 0,
    isClutchSlipping: false,
    tcsEnabled: false,
    tcsIntervening: false,
    tcsInterventionLevel: 0,
    coolantTemp: 116.4,
    oilTemp: 122.1,
    fuelLevelLiters: 25,
    fuelCapacityLiters: 50,
    isEngineBlown: false,
  })
  const telemetry = DashboardSystem.computeTelemetry(input)

  assert.strictEqual(telemetry.auxGauges.coolantTemp, 116.4, 'auxGauges.coolantTemp reflete temperatura ao vivo')
  assert.strictEqual(telemetry.auxGauges.oilTemp, 122.1, 'auxGauges.oilTemp reflete temperatura real do óleo')
  assert.strictEqual(telemetry.auxGauges.fuelPercent, 50, 'auxGauges.fuelPercent calcula fração real do tanque')
  assert.strictEqual(telemetry.warningLights.temp, true, 'Luz de advertência térmica acende acima de 115°C')

  const golClusterCode = readSource('src/components/dashboard/clusters/GolQuadradoRealCluster.tsx')
  assert.ok(!golClusterCode.includes('>TEMP 90°C<'), 'GolQuadradoRealCluster não exibe TEMP 90°C estático')

  const golfInfoCode = readSource('src/components/dashboard/infotainment/GolfGTIDiscoverPro.tsx')
  assert.ok(golfInfoCode.includes('telemetry.auxGauges.oilTemp'), 'GolfGTIDiscoverPro lê oilTemp real da telemetria')

  const civicInfoCode = readSource('src/components/dashboard/infotainment/CivicSiInfotainment.tsx')
  assert.ok(civicInfoCode.includes('telemetry.auxGauges.oilTemp'), 'CivicSiInfotainment lê oilTemp real da telemetria')
})

// ─────────────────────────────────────────────────────────────
// BLOCO 2 — DESACELERAÇÃO E FREIO MOTOR REAL
// ─────────────────────────────────────────────────────────────

test('2.1 Ao soltar acelerador a >= 60 km/h (manual, auto e CVT), torque positivo zera e freio motor desacelera', () => {
  // Manual (Gol G6), Automático (Golf GTI), CVT (Yaris)
  for (const car of [golG6, golfGti, yaris]) {
    warmUpStart(car)
    const sim = useSimulationStore.getState()

    if (car.transmission.type === 'manual') {
      launchManualToSpeed(65, 14)
    } else {
      accelerateAutoToSpeed(70, 0.85, 15)
    }

    const speedAtLift = useSimulationStore.getState()._phys.speedKmh
    assert.ok(speedAtLift >= 60, `${car.id}: atingiu velocidade alvo antes de soltar pedal (${speedAtLift.toFixed(1)} km/h)`)
    sim.setThrottle(0)
    useSimulationStore.getState().update(DT_120)

    const immediatelyAfterLift = useSimulationStore.getState()
    assert.strictEqual(
      immediatelyAfterLift._engine?.getTorqueOutput(),
      0,
      `${car.id}: torque positivo de propulsão zera ao soltar acelerador`,
    )
    assert.ok(
      (immediatelyAfterLift._engine?.getDrivetrainTorque() ?? 0) < 0,
      `${car.id}: torque de freio motor no eixo é negativo`,
    )
    assert.ok(
      immediatelyAfterLift._phys.clutchTorqueTransfer < 0,
      `${car.id}: embreagem transmite torque negativo de freio motor (${immediatelyAfterLift._phys.clutchTorqueTransfer.toFixed(1)} Nm)`,
    )

    stepStore(4.0)
    const speedAfter4s = useSimulationStore.getState()._phys.speedKmh
    const drop = speedAtLift - speedAfter4s

    assert.ok(
      drop >= 10.0,
      `${car.id}: desaceleração real em 4s após soltar acelerador (caiu ${drop.toFixed(2)} km/h: ${speedAtLift.toFixed(1)} -> ${speedAfter4s.toFixed(1)} km/h)`,
    )
  }
})

test('2.2 Desaceleração em 60 km/h respeita marcha engatada: 2ª > 3ª > 4ª > 5ª > Neutro/Embreagem', () => {
  function measureCoastDropInGear(gearRatio: number, clutchPos: number): number {
    const engine = new EngineSimulator(golG6.engine)
    const clutch = new ClutchSystem(golG6.engine.maxTorque)
    const physics = new VehiclePhysics({
      weight: golG6.info.weight,
      wheelDiameter: golG6.info.wheelDiameter,
    })

    engine.start()
    for (let i = 0; i < 60; i++) engine.tick({ throttle: 0, loadTorque: 0, deltaTime: DT_120 })

    const startSpeedKmh = 60
    physics.setSpeedKmh(startSpeedKmh)
    clutch.setPosition(clutchPos)
    const finalDrive = golG6.transmission.finalDrive
    const wheelRadius = golG6.info.wheelDiameter / 2

    // Sincroniza rotação inicial do motor caso acoplado
    if (gearRatio !== 0 && clutchPos < 0.85) {
      const wheelAngVel = (startSpeedKmh / 3.6) / wheelRadius
      const initRpm = (wheelAngVel * gearRatio * finalDrive * 60) / (2 * Math.PI)
      engine.setRpm(initRpm)
    }

    for (let i = 0; i < Math.round(2.5 / DT_120); i++) {
      const wheelAngVel = physics.getSpeedMs() / wheelRadius
      const transInputAngVel = gearRatio === 0 ? engine.getAngularVelocity() : wheelAngVel * gearRatio * finalDrive
      const cs = clutch.calculateTorqueTransfer(
        engine.getAngularVelocity(),
        transInputAngVel,
        gearRatio === 0,
        engine.getDrivetrainTorque(),
        DT_120,
      )
      engine.tick({ throttle: 0, loadTorque: cs.loadTorqueOnEngine, deltaTime: DT_120 })
      physics.tick({
        driveTorqueAtTransmission: cs.transmittedTorque,
        gearRatio,
        finalDrive,
        brake: 0,
        deltaTime: DT_120,
      })
      if (gearRatio !== 0 && clutch.getEngagement() > 0.95) {
        const expectedRpm = ((physics.getSpeedMs() / wheelRadius) * gearRatio * finalDrive * 60) / (2 * Math.PI)
        if (expectedRpm >= golG6.engine.idleRpm) engine.setRpm(expectedRpm)
      }
    }

    return startSpeedKmh - physics.getSpeedKmh()
  }

  const r2 = golG6.transmission.gearRatios.find((g) => g.gear === 2)!.ratio
  const r3 = golG6.transmission.gearRatios.find((g) => g.gear === 3)!.ratio
  const r4 = golG6.transmission.gearRatios.find((g) => g.gear === 4)!.ratio
  const r5 = golG6.transmission.gearRatios.find((g) => g.gear === 5)!.ratio

  const drop2 = measureCoastDropInGear(r2, 0)
  const drop3 = measureCoastDropInGear(r3, 0)
  const drop4 = measureCoastDropInGear(r4, 0)
  const drop5 = measureCoastDropInGear(r5, 0)
  const dropNeutral = measureCoastDropInGear(0, 0)
  const dropClutchIn3 = measureCoastDropInGear(r3, 1.0)

  assert.ok(drop2 > drop3, `2ª desacelera mais que 3ª (${drop2.toFixed(2)} vs ${drop3.toFixed(2)} km/h)`)
  assert.ok(drop3 > drop4, `3ª desacelera mais que 4ª (${drop3.toFixed(2)} vs ${drop4.toFixed(2)} km/h)`)
  assert.ok(drop4 > drop5, `4ª desacelera mais que 5ª (${drop4.toFixed(2)} vs ${drop5.toFixed(2)} km/h)`)
  assert.ok(drop5 > dropNeutral, `5ª desacelera mais que Neutro (${drop5.toFixed(2)} vs ${dropNeutral.toFixed(2)} km/h)`)
  assert.ok(
    drop3 > dropClutchIn3 + 4.0,
    `Soltar acelerador engatado freia muito mais que embreagem pressionada (${drop3.toFixed(2)} vs ${dropClutchIn3.toFixed(2)} km/h)`,
  )
  assert.ok(
    Math.abs(dropNeutral - dropClutchIn3) < 0.25,
    `Neutro e Embreagem pressionada têm mesma perda passiva (${dropNeutral.toFixed(2)} vs ${dropClutchIn3.toFixed(2)} km/h)`,
  )
})

// ─────────────────────────────────────────────────────────────
// BLOCO 3 — ESTABILIDADE DO CÂMBIO AUTOMÁTICO (GOLF GTI DSG, YARIS, PORSCHE)
// ─────────────────────────────────────────────────────────────

test('3.1 Relações de marcha do Golf GTI são estritamente decrescentes (4ª > 5ª > 6ª)', () => {
  const ratios = [...golfGti.transmission.gearRatios].sort((a, b) => a.gear - b.gear)
  for (let i = 0; i < ratios.length - 1; i++) {
    assert.ok(
      ratios[i].ratio > ratios[i + 1].ratio,
      `Marcha ${ratios[i].gear} (${ratios[i].ratio}) deve ser > marcha ${ratios[i + 1].gear} (${ratios[i + 1].ratio})`,
    )
  }
})

test('3.2 Golf GTI, Porsche GT3 e Yaris sem gear hunting em aceleração leve, média e forte (eco/normal/sport)', () => {
  const scenarios: Array<{ car: VehicleConfig; modes: DrivingMode[]; throttles: number[] }> = [
    { car: golfGti, modes: ['eco', 'normal', 'sport'], throttles: [0.3, 0.6, 1.0] },
    { car: porscheGt3, modes: ['normal', 'sport'], throttles: [0.35, 0.7, 1.0] },
    { car: yaris, modes: ['normal'], throttles: [0.35, 0.7, 1.0] },
  ]

  for (const { car, modes, throttles } of scenarios) {
    for (const mode of modes) {
      for (const throttleVal of throttles) {
        warmUpStart(car)
        const sim = useSimulationStore.getState()
        sim.selectShifterMode('D')
        sim.setDrivingMode(mode)
        sim.setThrottle(throttleVal)

        let prevGear = useSimulationStore.getState()._phys.gear
        let gearReversals = 0
        const shiftEvents: Array<{ t: number; from: number; to: number }> = []

        const ticks = Math.round(12 / DT_120)
        for (let i = 0; i < ticks; i++) {
          useSimulationStore.getState().update(DT_120)
          const g = useSimulationStore.getState()._phys.gear
          if (g !== prevGear) {
            shiftEvents.push({ t: i * DT_120, from: prevGear, to: g })
            if (g < prevGear) {
              gearReversals++
            }
            prevGear = g
          }
        }

        assert.strictEqual(
          gearReversals,
          0,
          `${car.id} (${mode}, ${(throttleVal * 100).toFixed(0)}%): zero reduções indevidas em aceleração contínua (eventos: ${JSON.stringify(shiftEvents)})`,
        )
        const minExpectedGear = throttleVal <= 0.35 ? 1 : 3
        assert.ok(
          useSimulationStore.getState()._phys.gear >= minExpectedGear,
          `${car.id} (${mode}, ${(throttleVal * 100).toFixed(0)}%): progrediu para marchas superiores (final: ${useSimulationStore.getState()._phys.gear})`,
        )
      }
    }
  }
})

test('3.3 Golf GTI: estabilidade em cruzeiro quase constante, alívio do acelerador (coasting) e desaceleração progressiva', () => {
  warmUpStart(golfGti)
  const sim = useSimulationStore.getState()
  sim.selectShifterMode('D')
  sim.setDrivingMode('normal')

  // Sobe até ~80 km/h em aceleração média
  accelerateAutoToSpeed(80, 0.55, 18)

  // Cruzeiro com pequenas variações de pedal (16%..24%) por 6s -> zero trocas repetitivas
  let cruiseShifts = 0
  let prevGear = useSimulationStore.getState()._phys.gear
  for (let i = 0; i < Math.round(6.0 / DT_120); i++) {
    const wave = 0.20 + Math.sin(i * 0.05) * 0.04
    useSimulationStore.getState().setThrottle(wave)
    useSimulationStore.getState().update(DT_120)
    const g = useSimulationStore.getState()._phys.gear
    if (g !== prevGear) {
      cruiseShifts++
      prevGear = g
    }
  }
  assert.ok(cruiseShifts <= 1, `Cruzeiro estável no GTI DSG teve no máximo 1 acomodação (teve ${cruiseShifts})`)

  // Alívio total do acelerador (coasting) por 8s -> só reduz progressivamente, NUNCA sobe marcha nem caça
  useSimulationStore.getState().setThrottle(0)
  const decelHistory: Array<{ from: number; to: number; speed: number }> = []
  let upshiftsDuringCoast = 0
  for (let i = 0; i < Math.round(8.0 / DT_120); i++) {
    useSimulationStore.getState().update(DT_120)
    const s = useSimulationStore.getState()._phys
    if (s.gear !== prevGear) {
      if (s.gear > prevGear) upshiftsDuringCoast++
      decelHistory.push({ from: prevGear, to: s.gear, speed: s.speedKmh })
      if (s.gear === 1 && s.speedKmh >= 12) {
        assert.fail(`Não deve reduzir para 1ª marcha em movimento (${s.speedKmh.toFixed(1)} km/h)`)
      }
      prevGear = s.gear
    }
  }
  assert.strictEqual(upshiftsDuringCoast, 0, `Sem upshift inesperado durante coasting/desaceleração (${JSON.stringify(decelHistory)})`)
  assert.ok(decelHistory.length <= 5, `Número coerente de reduções em 8s de desaceleração (${decelHistory.length})`)
})

test('3.4 Kickdown responsivo em marcha alta ao pisar fundo + proteção contra over-rev', () => {
  const auto = new AutomaticTransmission({
    gearRatios: golfGti.transmission.gearRatios,
    finalDrive: golfGti.transmission.finalDrive,
    wheelDiameter: golfGti.info.wheelDiameter,
    maxRpm: golfGti.engine.maxRpm,
    idleRpm: golfGti.engine.idleRpm,
  })

  // Estabiliza histórico a carga baixa em 5ª marcha a 85 km/h (~2750 RPM em Normal? No Sport ou Normal)
  // No modo SPORT (upshift ~5800 RPM), em 5ª marcha a 105 km/h (~2680 RPM) e pisada rápida para 100%:
  const rpm5At105 = auto.speedToRpm(105, 5)
  auto.decide({
    currentRpm: rpm5At105,
    vehicleSpeedKmh: 105,
    throttle: 0.15,
    brake: 0,
    currentGear: 5,
    drivingMode: 'sport',
    selectorPosition: 'D',
    deltaTime: 1.0,
  })

  const kickdownDecision = auto.decide({
    currentRpm: rpm5At105,
    vehicleSpeedKmh: 105,
    throttle: 1.0,
    brake: 0,
    currentGear: 5,
    drivingMode: 'sport',
    selectorPosition: 'D',
    deltaTime: 1.0,
  })

  assert.strictEqual(kickdownDecision.targetGear, 4, `Kickdown 5ª->4ª acionado a 105 km/h (foi para ${kickdownDecision.targetGear}ª)`)
  assert.strictEqual(kickdownDecision.isKickdown, true, 'Flag isKickdown ativa no kickdown real')
  assert.ok(
    kickdownDecision.targetRpm < golfGti.engine.maxRpm * 0.88,
    `Kickdown respeita proteção contra over-rev (${kickdownDecision.targetRpm.toFixed(0)} RPM)`,
  )

  // Proteção extrema contra over-rev: a 190 km/h em 5ª, tentativa de kickdown NÃO reduz para 4ª se passar do limite seguro
  const rpm5At190 = auto.speedToRpm(190, 5)
  const overRevGuard = auto.decide({
    currentRpm: rpm5At190,
    vehicleSpeedKmh: 190,
    throttle: 1.0,
    brake: 0,
    currentGear: 5,
    drivingMode: 'sport',
    selectorPosition: 'D',
    deltaTime: 1.0,
  })
  assert.ok(overRevGuard.targetGear >= 5, `Protege contra redução destrutiva a 190 km/h (marcha ${overRevGuard.targetGear})`)
})

// ─────────────────────────────────────────────────────────────
// BLOCO 4 — LIMITE VISUAL DE 60 FPS + FÍSICA EM 120 HZ
// ─────────────────────────────────────────────────────────────

test('4.1 Teto visual <= 60 FPS sob loops de 60, 90 e 120 Hz com física preservada a 120 Hz', () => {
  const rates = [60, 90, 120] as const
  const profiles: GraphicProfile[] = ['eco', 'normal', 'high']
  const simDuration = 4.0

  const baselineSpeedByProfile: Record<number, Record<GraphicProfile, number>> = {
    60: { eco: 0, normal: 0, high: 0 },
    90: { eco: 0, normal: 0, high: 0 },
    120: { eco: 0, normal: 0, high: 0 },
  }

  for (const profile of profiles) {
    for (const hz of rates) {
      useUIStore.getState().setGraphicProfile(profile)
      warmUpStart(golfGti)
      const sim = useSimulationStore.getState()
      sim.selectShifterMode('D')
      useSimulationStore.setState((s) => ({
        _phys: {
          ...s._phys,
          visualUpdatesCount: 0,
          skippedVisualUpdatesCount: 0,
        },
      }))

      const frameDt = 1 / hz
      const frames = Math.round(simDuration / frameDt)
      for (let i = 0; i < frames; i++) {
        if (i === Math.round(0.6 / frameDt)) useSimulationStore.getState().setThrottle(1.0)
        useSimulationStore.getState().update(frameDt)
      }

      const finalPhys = useSimulationStore.getState()._phys
      const visualFps = finalPhys.visualUpdatesCount / simDuration

      assert.ok(
        visualFps <= 60.5,
        `Perfil ${profile} a ${hz} Hz manteve taxa visual <= 60 FPS (${visualFps.toFixed(1)} FPS)`,
      )
      if (profile === 'eco') {
        assert.ok(visualFps <= 37.0, `Perfil ECO manteve <= 37 FPS (${visualFps.toFixed(1)} FPS)`)
      }
      if (hz === 120) {
        assert.ok(
          finalPhys.skippedVisualUpdatesCount >= 200,
          `A 120 Hz (${profile}) publicações intermediárias são puladas (${finalPhys.skippedVisualUpdatesCount})`,
        )
      }

      baselineSpeedByProfile[hz][profile] = finalPhys.speedKmh
    }

    // Equivalência física entre 60/90/120 Hz no mesmo perfil
    assert.ok(
      Math.abs(baselineSpeedByProfile[60][profile] - baselineSpeedByProfile[120][profile]) < 0.5,
      `Física convergente entre 60 Hz e 120 Hz (${profile}): ${baselineSpeedByProfile[60][profile].toFixed(2)} vs ${baselineSpeedByProfile[120][profile].toFixed(2)}`,
    )
    assert.ok(
      Math.abs(baselineSpeedByProfile[90][profile] - baselineSpeedByProfile[120][profile]) < 0.5,
      `Física convergente entre 90 Hz e 120 Hz (${profile}): ${baselineSpeedByProfile[90][profile].toFixed(2)} vs ${baselineSpeedByProfile[120][profile].toFixed(2)}`,
    )
  }

  // Equivalência física entre perfis em todas as taxas de tela
  for (const hz of rates) {
    const sEco = baselineSpeedByProfile[hz].eco
    const sHigh = baselineSpeedByProfile[hz].high
    const sNorm = baselineSpeedByProfile[hz].normal
    assert.ok(
      Math.abs(sEco - sHigh) < 0.01 && Math.abs(sNorm - sHigh) < 0.01,
      `Física idêntica a ${hz} Hz entre ECO (${sEco.toFixed(2)}), NORMAL (${sNorm.toFixed(2)}) e ALTO (${sHigh.toFixed(2)})`,
    )
  }

  useUIStore.getState().setGraphicProfile('normal')
})

test('4.2 performanceMonitor distingue FPS visual (<= 60) vs física (120 Hz) e Overlay exibe ambos', () => {
  performanceMonitor.stop()
  performanceMonitor.start(0)

  // Simula 2 segundos de RAF a 120 Hz (240 frames de 8.333ms), porém publicações visuais limitadas a 60 FPS
  for (let i = 1; i <= 240; i++) {
    const t = i * (1000 / 120)
    performanceMonitor.recordFrameDelta(1000 / 120, t)
    performanceMonitor.recordPhysicsTick(t)
    if (i % 2 === 0) {
      performanceMonitor.recordVisualPublish(t)
    }
  }

  const snap = performanceMonitor.getSnapshot(2000)
  assert.strictEqual(snap.physicsHz, 120, `physicsHz = 120 Hz exato (atual: ${snap.physicsHz})`)
  assert.strictEqual(snap.visualFps, 60, `visualFps = 60 FPS exato sob teto visual (atual: ${snap.visualFps})`)
  assert.ok(snap.fps > snap.visualFps, `Taxa bruta de loop (${snap.fps}) diferenciada da taxa visual (${snap.visualFps})`)

  const overlayCode = readSource('src/components/debug/PerformanceMonitorOverlay.tsx')
  assert.ok(overlayCode.includes('data.visualFps'), 'PerformanceMonitorOverlay exibe visualFps limitado a 60 FPS')
  assert.ok(overlayCode.includes('data.physicsHz'), 'PerformanceMonitorOverlay exibe physicsHz em 120 Hz')

  performanceMonitor.stop()
})

test('4.3 Eventos críticos refletem imediatamente mesmo em frames visuais suprimidos sob teto 60 FPS', () => {
  useUIStore.getState().setGraphicProfile('high')
  warmUpStart(golfGti)
  const sim = useSimulationStore.getState()
  sim.selectShifterMode('D')
  sim.setThrottle(1.0)
  useSimulationStore.setState({ fuelLevelLiters: 0.004 })

  let caughtOutOfFuelSameTick = false
  for (let i = 0; i < 60; i++) {
    useSimulationStore.getState().update(DT_120)
    const s = useSimulationStore.getState()
    if (s._phys.isOutOfFuel) {
      assert.strictEqual(s.isOutOfFuel, true, 'isOutOfFuel sincronizou no mesmo tick apesar do teto de 60 FPS')
      caughtOutOfFuelSameTick = true
      break
    }
  }
  assert.ok(caughtOutOfFuelSameTick, 'Pane seca imediata sob teto visual 60 FPS a 120 Hz')
  useUIStore.getState().setGraphicProfile('normal')
})

// ─────────────────────────────────────────────────────────────
// BLOCO 5 — COMPATIBILIDADE DOS 8 VEÍCULOS
// ─────────────────────────────────────────────────────────────

test('5.1 Todos os 8 veículos executam ciclo completo (partida, aceleração, desaceleração e reset) sem regressões', () => {
  useUIStore.getState().setGraphicProfile('normal')

  for (const id of ALL_VEHICLE_IDS) {
    const cfg = loadVehicle(id)
    warmUpStart(cfg)
    const sim = useSimulationStore.getState()

    if (cfg.transmission.type === 'manual') {
      launchManualToSpeed(65, 8)
    } else {
      sim.selectShifterMode('D')
      sim.setThrottle(1.0)
      stepStore(6.0)
    }

    const peakState = useSimulationStore.getState()._phys
    assert.ok(Number.isFinite(peakState.speedKmh) && peakState.speedKmh > 40, `${id}: acelerou normalmente (${peakState.speedKmh.toFixed(1)} km/h)`)
    assert.ok(Number.isFinite(peakState.rpm) && peakState.rpm > cfg.engine.idleRpm, `${id}: RPM válido (${peakState.rpm.toFixed(0)})`)
    assert.ok(Number.isFinite(peakState.coolantTemp) && peakState.coolantTemp < 115, `${id}: temperatura controlada (${peakState.coolantTemp.toFixed(1)}°C)`)
    assert.ok(Number.isFinite(peakState.oilTemp), `${id}: oilTemp finito (${peakState.oilTemp.toFixed(1)}°C)`)

    // Desacelera ao soltar acelerador
    sim.setThrottle(0)
    stepStore(3.0)
    const afterDecelSpeed = useSimulationStore.getState()._phys.speedKmh
    assert.ok(
      afterDecelSpeed < peakState.speedKmh - 4.0,
      `${id}: desacelerou ao soltar pedal (${peakState.speedKmh.toFixed(1)} -> ${afterDecelSpeed.toFixed(1)} km/h)`,
    )

    sim.reset()
    assert.strictEqual(useSimulationStore.getState().speed, 0, `${id}: reset zera velocidade`)
  }
})

console.log('\n===============================================================')
console.log(`RESULTADO DA FASE 1.5.5: ${passed} PASSOU | ${failed} FALHOU`)
console.log('===============================================================\n')

if (failed > 0) {
  process.exit(1)
}
