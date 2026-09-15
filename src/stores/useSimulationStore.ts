import { create } from 'zustand'
import type { VehicleConfig, DrivingMode } from '@/types'
import type { EngineStatus } from '@/types/simulation'
import { EngineSimulator } from '@/systems/engine'
import { Transmission, AutomaticTransmission } from '@/systems/transmission'
import { ClutchSystem } from '@/systems/clutch'
import { VehiclePhysics } from '@/systems/physics'
import { TractionControlSystem } from '@/systems/tcs'
import { PedalInputSystem } from '@/systems/vehicle'
import { PHYSICS_TIMESTEP, MAX_SUBSTEPS } from '@/systems/engine/constants'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'
import { clamp } from '@/utils/math'


/**
 * TransmissionMode — modos de operação da transmissão:
 * - 'manual'           → Câmbio manual convencional com embreagem (Gol, CB1000R)
 * - 'automatic'        → CVT/Automático gerenciado eletronicamente (Yaris AUTO)
 * - 'manual_simulated' → CVT em modo manual: jogador escolhe relações virtuais sem embreagem
 */
export type TransmissionMode = 'manual' | 'automatic' | 'manual_simulated'

interface SimulationActions {
  /** Inicializa a simulação com um veículo */
  init: (config: VehicleConfig) => void
  /** Liga o motor (ou aciona arranque se parado/estolado) */
  startEngine: () => void
  /** Desliga o motor */
  stopEngine: () => void
  /** Define a posição do acelerador (0-1) */
  setThrottle: (value: number) => void
  /** Define a posição do freio (0-1) */
  setBrake: (value: number) => void
  /** Define a posição da embreagem (0-1: 0 = acoplada, 1 = desacoplada) */
  setClutch: (value: number) => void
  /** Altera o modo de condução (ECO, NORMAL, SPORT) */
  setDrivingMode: (mode: DrivingMode) => void
  /** Altera o modo de transmissão */
  setTransmissionMode: (mode: TransmissionMode) => void
  /**
   * Alterna entre AUTO e MANUAL_SIMULATED (apenas para CVTs com hasManualMode).
   * Ao entrar no manual, escolhe a relação virtual mais próxima do estado atual.
   */
  toggleSimulatedManual: () => void
  /** Troca para marcha acima */
  shiftUp: () => void
  /** Troca para marcha abaixo */
  shiftDown: () => void
  /** Coloca em neutro */
  shiftNeutral: () => void
  /** Liga ou desliga o TCS */
  setTcsEnabled: (enabled: boolean) => void
  /** Atualiza a simulação (chamado pelo game loop) */
  update: (frameTime: number) => void
  /** Reseta a simulação */
  reset: () => void
}

interface SimulationState {
  // Estado do motor
  rpm: number
  isRunning: boolean
  isStalled: boolean
  isBogWarning: boolean       // Motor amarrando (pré-afogamento)
  status: EngineStatus
  isRevLimiting: boolean

  // Estado da transmissão
  currentGear: number
  clutchPosition: number
  transmissionMode: TransmissionMode
  drivingMode: DrivingMode
  isKickdown: boolean
  lastShiftReason: string     // 'none' | 'clutch_required' | 'over_rev' | 'gear_limit'

  // Estado da embreagem (telemetria real)
  clutchSlipRpm: number        // Diferenciação de RPM entre motor e transmissão
  clutchSlipRatio: number      // Razão relativa de patinamento (0 a 1)
  clutchTorqueTransfer: number // Nm sendo transmitidos pelo disco
  clutchHeat: number           // Calor acumulado no disco (kJ, preparado para desgaste futuro)
  isClutchSlipping: boolean

  // Estado do TCS
  tcsEnabled: boolean
  tcsIntervening: boolean
  tcsInterventionLevel: number

  // Estado do veículo
  speed: number
  throttle: number
  brake: number

  // Internos (não renderizados diretamente)
  _engine: EngineSimulator | null
  _transmission: Transmission | null
  _autoTransmission: AutomaticTransmission | null
  _clutch: ClutchSystem | null
  _physics: VehiclePhysics | null
  _tcs: TractionControlSystem | null
  _pedalInput: PedalInputSystem | null
  _config: VehicleConfig | null
  _accumulator: number
  _isInitialized: boolean
}

type SimulationStore = SimulationState & SimulationActions

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  // Estado inicial
  rpm: 0,
  isRunning: false,
  isStalled: false,
  isBogWarning: false,
  status: 'off',
  isRevLimiting: false,
  currentGear: 0,
  clutchPosition: 0,
  transmissionMode: 'manual',
  drivingMode: 'normal',
  isKickdown: false,
  lastShiftReason: 'none',
  clutchSlipRpm: 0,
  clutchSlipRatio: 0,
  clutchTorqueTransfer: 0,
  clutchHeat: 0,
  isClutchSlipping: false,
  tcsEnabled: true,
  tcsIntervening: false,
  tcsInterventionLevel: 0,
  speed: 0,
  throttle: 0,
  brake: 0,
  _engine: null,
  _transmission: null,
  _autoTransmission: null,
  _clutch: null,
  _physics: null,
  _tcs: null,
  _pedalInput: null,
  _config: null,
  _accumulator: 0,
  _isInitialized: false,

  init: (config: VehicleConfig) => {
    const isAutoOrCvt = config.transmission.type === 'automatic' || config.transmission.type === 'cvt'

    const engine = new EngineSimulator(config.engine)
    const transmission = new Transmission(
      config.transmission,
      config.info.wheelDiameter,
    )
    const clutch = new ClutchSystem(config.engine.maxTorque)
    const physics = new VehiclePhysics({
      weight: config.info.weight,
      wheelDiameter: config.info.wheelDiameter,
      isMotorcycle: config.info.category === 'motorcycle',
    })

    let autoTransmission: AutomaticTransmission | null = null
    if (isAutoOrCvt) {
      autoTransmission = new AutomaticTransmission({
        gearRatios: config.transmission.gearRatios,
        finalDrive: config.transmission.finalDrive,
        wheelDiameter: config.info.wheelDiameter,
        maxRpm: config.engine.maxRpm,
        idleRpm: config.engine.idleRpm,
        isCvt: config.transmission.type === 'cvt',
      })
    }

    const tcs = new TractionControlSystem()
    const pedalInput = new PedalInputSystem()

    const defaultTransMode: TransmissionMode = isAutoOrCvt ? 'automatic' : 'manual'
    const defaultDriveMode: DrivingMode = config.transmission.supportedModes?.includes('normal')
      ? 'normal'
      : (config.transmission.supportedModes?.[0] ?? 'normal')

    // TCS ligado por padrão se o veículo tiver TCS configurado
    const hasTcs = !!config.transmission.tcs?.enabled

    set({
      _engine: engine,
      _transmission: transmission,
      _autoTransmission: autoTransmission,
      _clutch: clutch,
      _physics: physics,
      _tcs: tcs,
      _pedalInput: pedalInput,
      _config: config,
      _isInitialized: true,
      rpm: 0,
      speed: 0,
      currentGear: isAutoOrCvt ? 1 : 0,
      throttle: 0,
      brake: 0,
      clutchPosition: isAutoOrCvt ? 0 : 0,
      transmissionMode: defaultTransMode,
      drivingMode: defaultDriveMode,
      isKickdown: false,
      isBogWarning: false,
      lastShiftReason: 'none',
      clutchSlipRpm: 0,
      clutchSlipRatio: 0,
      clutchTorqueTransfer: 0,
      clutchHeat: 0,
      isClutchSlipping: false,
      isRunning: false,
      isStalled: false,
      status: 'off',
      isRevLimiting: false,
      tcsEnabled: hasTcs,
      tcsIntervening: false,
      tcsInterventionLevel: 0,
      _accumulator: 0,
    })
  },

  startEngine: () => {
    const { _engine, transmissionMode, _transmission } = get()
    if (!_engine) return

    _engine.start()
    HapticFeedback.engineStart()

    // Se for automático ou manual simulado, garante que está engatado em D (1ª relação)
    const isAuto = transmissionMode === 'automatic' || transmissionMode === 'manual_simulated'
    if (isAuto && _transmission && _transmission.currentGear === 0) {
      _transmission.shiftTo(1, 0)
    }

    set({
      isRunning: _engine.getIsRunning(),
      isStalled: false,
      status: _engine.getStatus(),
      rpm: _engine.getRpm(),
      currentGear: _transmission?.currentGear ?? 0,
    })
  },

  stopEngine: () => {
    const { _engine, _transmission, transmissionMode } = get()
    if (!_engine) return

    _engine.stop()
    if (transmissionMode === 'manual') {
      _transmission?.reset()
    }
    set({
      isRunning: false,
      isStalled: false,
      status: 'off',
      rpm: 0,
      throttle: 0,
      isKickdown: false,
      tcsIntervening: false,
      tcsInterventionLevel: 0,
    })
  },

  setThrottle: (value: number) => {
    set({ throttle: clamp(value, 0, 1) })
  },

  setBrake: (value: number) => {
    set({ brake: clamp(value, 0, 1) })
  },

  setClutch: (value: number) => {
    const clamped = clamp(value, 0, 1)
    const { _transmission, _clutch } = get()
    _transmission?.setClutch(clamped)
    _clutch?.setPosition(clamped)
    set({ clutchPosition: clamped })
  },

  setDrivingMode: (mode: DrivingMode) => {
    set({ drivingMode: mode })
    HapticFeedback.light()
  },

  setTransmissionMode: (mode: TransmissionMode) => {
    set({ transmissionMode: mode })
    HapticFeedback.light()
  },

  toggleSimulatedManual: () => {
    const { transmissionMode, _transmission, _autoTransmission, _config, speed, rpm } = get()

    // Só funciona em CVTs com modo manual habilitado
    if (!_config?.transmission.hasManualMode) return
    if (!_transmission || !_config) return

    if (transmissionMode === 'automatic') {
      // AUTO -> MANUAL_SIMULATED
      // Encontra a relação virtual mais próxima do RPM/velocidade atual
      const targetGear = findBestGearForConditions(
        rpm,
        speed,
        _config,
      )
      _transmission.shiftTo(targetGear, speed)
      set({ transmissionMode: 'manual_simulated', currentGear: targetGear })
      HapticFeedback.gearShift()
    } else if (transmissionMode === 'manual_simulated') {
      // MANUAL_SIMULATED -> AUTO
      // Reseta o timer do câmbio automático para evitar troca imediata
      _autoTransmission?.reset()
      // Mantém a relação atual — o AutomaticTransmission vai assumir no próximo tick
      set({ transmissionMode: 'automatic', isKickdown: false })
      HapticFeedback.light()
    }
    // Modo 'manual' (Gol, etc.) não é afetado por este toggle
  },

  shiftUp: () => {
    const { _engine, _transmission, _clutch, _config, speed, isRunning, transmissionMode } = get()
    if (!_engine || !_transmission || !_config || !isRunning) return

    if (transmissionMode === 'automatic') return // câmbio gerencia as trocas

    if (transmissionMode === 'manual_simulated') {
      // Modo manual simulado: sem embreagem, proteção via canShiftTo
      const nextGear = _transmission.currentGear + 1
      if (nextGear > _config.transmission.gearCount) return

      // Proteção over-rev no upshift (raro, mas seguro verificar)
      if (!_transmission.canShiftTo(nextGear, speed, _config.engine.maxRpm)) return

      const result = _transmission.shiftTo(nextGear, speed)
      // Sincroniza RPM baseado na nova relação e velocidade atual
      const newRpm = clamp(result.newRpm, _config.engine.idleRpm, _config.engine.maxRpm)
      if (result.newRpm > 0) _engine.setRpm(newRpm)

      HapticFeedback.gearShift()
      set({ currentGear: result.gear, rpm: _engine.getRpm(), lastShiftReason: 'none' })
      return
    }

    // Modo 'manual' convencional (Gol G6, CB1000R) com validação de embreagem
    if (!_clutch) return
    const result = _transmission.shiftUp(_engine.getRpm(), speed, _config.engine.maxRpm)

    if (result.success) {
      const clampedRpm = clamp(result.newRpm, _config.engine.idleRpm, _config.engine.maxRpm)
      _engine.setRpm(clampedRpm)
      HapticFeedback.gearShift()
      set({ currentGear: result.gear, rpm: _engine.getRpm(), lastShiftReason: 'none' })
    } else {
      // Bloqueado — feedback tátil sutil + registro do motivo
      if (result.reason === 'clutch_required') HapticFeedback.light()
      set({ lastShiftReason: result.reason ?? 'none' })
    }
  },

  shiftDown: () => {
    const { _engine, _transmission, _clutch, _config, speed, isRunning, transmissionMode } = get()
    if (!_engine || !_transmission || !_config || !isRunning) return

    if (transmissionMode === 'automatic') return

    if (transmissionMode === 'manual_simulated') {
      // Modo manual simulado: sem embreagem
      const nextGear = _transmission.currentGear - 1
      if (nextGear < 1) return // não vai para neutro/reverso no modo simulado

      // Proteção CRÍTICA contra over-rev no downshift
      if (!_transmission.canShiftTo(nextGear, speed, _config.engine.maxRpm)) {
        HapticFeedback.light()
        return
      }

      const result = _transmission.shiftTo(nextGear, speed)
      const newRpm = clamp(result.newRpm, _config.engine.idleRpm, _config.engine.maxRpm)
      if (result.newRpm > 0) _engine.setRpm(newRpm)

      HapticFeedback.gearShift()
      set({ currentGear: result.gear, rpm: _engine.getRpm(), lastShiftReason: 'none' })
      return
    }

    // Modo 'manual' convencional (Gol G6, CB1000R) com validação de embreagem
    if (!_clutch) return
    const result = _transmission.shiftDown(_engine.getRpm(), speed, _config.engine.maxRpm)

    if (result.success) {
      const clampedRpm = clamp(result.newRpm, _config.engine.idleRpm, _config.engine.maxRpm)
      _engine.setRpm(clampedRpm)
      HapticFeedback.gearShift()
      set({ currentGear: result.gear, rpm: _engine.getRpm(), lastShiftReason: 'none' })
    } else {
      if (result.reason === 'clutch_required') HapticFeedback.light()
      set({ lastShiftReason: result.reason ?? 'none' })
    }
  },

  shiftNeutral: () => {
    const { _transmission, transmissionMode } = get()
    if (!_transmission) return
    if (transmissionMode === 'automatic' || transmissionMode === 'manual_simulated') return

    _transmission.neutral()
    HapticFeedback.light()
    set({ currentGear: 0 })
  },

  setTcsEnabled: (enabled: boolean) => {
    const { _tcs } = get()
    if (!enabled) {
      _tcs?.reset()
    }
    set({ tcsEnabled: enabled, tcsIntervening: false, tcsInterventionLevel: 0 })
    HapticFeedback.light()
  },

  update: (frameTime: number) => {
    const state = get()
    const { _engine, _transmission, _autoTransmission, _clutch, _physics, _tcs, _config } = state

    if (!_engine || !_transmission || !_clutch || !_physics || !_config) return

    let accumulator = state._accumulator + frameTime
    let latestRpm = state.rpm
    let latestSpeed = state.speed
    let latestGear = state.currentGear
    let latestIsRevLimiting = state.isRevLimiting
    let latestIsRunning = state.isRunning
    let latestIsStalled = state.isStalled
    let latestIsBogWarning = state.isBogWarning
    let latestStatus = state.status
    let latestIsKickdown = state.isKickdown
    let latestTcsIntervening = state.tcsIntervening
    let latestTcsLevel = state.tcsInterventionLevel
    let latestClutchSlipRpm = state.clutchSlipRpm
    let latestClutchSlipRatio = state.clutchSlipRatio
    let latestClutchTorqueTransfer = state.clutchTorqueTransfer
    let latestClutchHeat = state.clutchHeat
    let latestIsClutchSlipping = state.isClutchSlipping
    let substeps = 0

    while (accumulator >= PHYSICS_TIMESTEP && substeps < MAX_SUBSTEPS) {
      const dt = PHYSICS_TIMESTEP

      // ─── 1. Tomada de Decisão da Transmissão ───
      if (state.transmissionMode === 'automatic' && _autoTransmission) {
        // AUTO: AutomaticTransmission gerencia tudo
        const autoDecision = _autoTransmission.decide({
          currentRpm: _engine.getRpm(),
          vehicleSpeedKmh: _physics.getSpeedKmh(),
          throttle: state.throttle,
          brake: state.brake,
          currentGear: _transmission.currentGear,
          drivingMode: state.drivingMode,
          deltaTime: dt,
        })

        latestIsKickdown = autoDecision.isKickdown

        if (autoDecision.targetGear !== _transmission.currentGear) {
          _transmission.shiftTo(autoDecision.targetGear, _physics.getSpeedKmh())
          latestGear = autoDecision.targetGear
        }

        const autoClutchPosition = 1.0 - autoDecision.targetClutchEngagement
        _clutch.setPosition(autoClutchPosition)

      } else if (state.transmissionMode === 'manual_simulated') {
        // MANUAL_SIMULATED: jogador escolheu a relação.
        // CVT continua gerenciando a embreagem para evitar estol.
        // Usa a mesma lógica de acoplamento automático do conversor.
        const speedKmh = _physics.getSpeedKmh()
        const currentRpm = _engine.getRpm()

        // Acoplamento CVT proporcional (mesmo algoritmo da AutomaticTransmission)
        let targetClutchEngagement = 1.0
        if (speedKmh < 3 && state.throttle < 0.05 && state.brake > 0.1) {
          targetClutchEngagement = 0.0
        } else if (speedKmh < 22) {
          const idleRpm = _config.engine.idleRpm
          const targetLaunchRpm = 2200
          const rpmRatio = clamp((currentRpm - idleRpm) / (targetLaunchRpm - idleRpm), 0, 1)
          const speedRatio = clamp(speedKmh / 22, 0, 1)
          targetClutchEngagement = clamp(
            Math.pow(rpmRatio, 3.0) * 0.72 + speedRatio * 0.28,
            0.05,
            0.98,
          )
        }

        _clutch.setPosition(1.0 - targetClutchEngagement)
        latestIsKickdown = false

      } else {
        // MANUAL convencional: embreagem controlada pelo jogador
        latestIsKickdown = false
      }

      const gear = _transmission.currentGear
      const gearRatio = _transmission.calculator.getGearRatio(gear)
      const finalDrive = _config.transmission.finalDrive
      const isInNeutral = gear === 0

      // 2. Velocidade angular das rodas e da entrada da transmissão
      const speedMs = _physics.getSpeedMs()
      const wheelRadius = _config.info.wheelDiameter / 2
      const wheelAngVel = speedMs / wheelRadius
      const transInputAngVel = isInNeutral
        ? _engine.getAngularVelocity()
        : wheelAngVel * (gearRatio * finalDrive)

      // 3. ClutchSystem: torque de atrito transferido e carga sobre o motor
      const clutchState = _clutch.calculateTorqueTransfer(
        _engine.getAngularVelocity(),
        transInputAngVel,
        isInNeutral,
        _engine.getTorqueOutput(),
        dt,
      )

      // 4. EngineSimulator: processa o tick com o torque de CARGA da embreagem sobre o volante
      const engineTick = _engine.tick({
        throttle: state.throttle,
        loadTorque: clutchState.loadTorqueOnEngine, // carga resistiva real da embreagem
        deltaTime: dt,
      })

      latestRpm = engineTick.rpm
      latestIsRevLimiting = engineTick.isRevLimiting
      latestIsRunning = _engine.getIsRunning()
      latestIsStalled = engineTick.isStalled
      latestIsBogWarning = engineTick.isBogWarning
      latestStatus = engineTick.status

      // Telemetria da embreagem
      latestClutchSlipRpm = clutchState.slipRpm
      latestClutchSlipRatio = clutchState.slipRatio
      latestClutchTorqueTransfer = clutchState.transmittedTorque
      latestClutchHeat = clutchState.heat
      latestIsClutchSlipping = clutchState.isSlipping

      // 5. VehiclePhysics: calcula forças longitudinais
      const physicsTick = _physics.tick({
        driveTorqueAtTransmission: clutchState.transmittedTorque,
        gearRatio,
        finalDrive,
        brake: state.brake,
        deltaTime: dt,
      })

      latestSpeed = physicsTick.speedKmh

      // 6. TractionControlSystem: atua após a física, prepara multiplicador para o próximo frame
      // (O TCS modula o torque de forma suave — a intervenção real ocorre no próximo tick via
      // throttle efetivo reduzido no EngineSimulator, mas usamos o slipRatio atual para calcular)
      if (_tcs) {
        const tcsDecision = _tcs.decide({
          wheelTorque: physicsTick.wheelTorque,
          maxGripTorque: physicsTick.maxGripTorque,
          slipRatio: physicsTick.slipRatio,
          drivingMode: state.drivingMode,
          enabled: state.tcsEnabled,
        }, dt)

        latestTcsIntervening = tcsDecision.isIntervening
        latestTcsLevel = tcsDecision.interventionLevel

        // Aplica redução de torque no motor via throttle efetivo
        // (reduz a aceleração do motor no próximo tick se TCS intervindo)
        if (tcsDecision.isIntervening && physicsTick.isWheelSlipping) {
          const reducedThrottle = state.throttle * tcsDecision.throttleMultiplier
          _engine.tick({
            throttle: reducedThrottle,
            loadTorque: 0, // compensação já aplicada acima
            deltaTime: 0,  // frame zero — apenas ajusta o estado interno sem avançar tempo
          })
        }
      }

      // 7. Quando 100% acoplado em movimento com rotação suficiente, sincroniza RPM
      if (gear !== 0 && _clutch.getEngagement() > 0.95 && latestIsRunning) {
        const expectedRpm = _transmission.calculator.speedToRpm(latestSpeed, gear)
        if (expectedRpm >= _config.engine.idleRpm) {
          _engine.setRpm(expectedRpm)
          latestRpm = expectedRpm
        }
      }
      accumulator -= dt
      substeps++
    }

    // Haptics no rev limiter
    if (latestIsRevLimiting && !state.isRevLimiting) {
      HapticFeedback.revLimiter()
    }

    set({
      rpm: latestRpm,
      speed: latestSpeed,
      currentGear: latestGear,
      isRunning: latestIsRunning,
      isStalled: latestIsStalled,
      isBogWarning: latestIsBogWarning,
      status: latestStatus,
      isKickdown: latestIsKickdown,
      isRevLimiting: latestIsRevLimiting,
      tcsIntervening: latestTcsIntervening,
      tcsInterventionLevel: latestTcsLevel,
      clutchSlipRpm: latestClutchSlipRpm,
      clutchSlipRatio: latestClutchSlipRatio,
      clutchTorqueTransfer: latestClutchTorqueTransfer,
      clutchHeat: latestClutchHeat,
      isClutchSlipping: latestIsClutchSlipping,
      _accumulator: accumulator,
    })
  },

  reset: () => {
    set({
      rpm: 0,
      isRunning: false,
      isStalled: false,
      isBogWarning: false,
      status: 'off',
      isRevLimiting: false,
      currentGear: 0,
      clutchPosition: 0,
      transmissionMode: 'manual',
      drivingMode: 'normal',
      isKickdown: false,
      lastShiftReason: 'none',
      clutchSlipRpm: 0,
      clutchSlipRatio: 0,
      clutchTorqueTransfer: 0,
      clutchHeat: 0,
      isClutchSlipping: false,
      tcsEnabled: true,
      tcsIntervening: false,
      tcsInterventionLevel: 0,
      speed: 0,
      throttle: 0,
      brake: 0,
      _engine: null,
      _transmission: null,
      _autoTransmission: null,
      _clutch: null,
      _physics: null,
      _tcs: null,
      _pedalInput: null,
      _config: null,
      _accumulator: 0,
      _isInitialized: false,
    })
  },
}))

// ─── Helper: encontra a relação virtual mais adequada para as condições atuais ───

function findBestGearForConditions(
  rpm: number,
  speedKmh: number,
  config: VehicleConfig,
): number {
  const gearRatios = config.transmission.gearRatios
  const finalDrive = config.transmission.finalDrive
  const wheelDiameter = config.info.wheelDiameter
  const wheelCircumference = Math.PI * wheelDiameter
  const maxRpm = config.engine.maxRpm
  const idleRpm = config.engine.idleRpm

  let bestGear = 1
  let bestRpmDiff = Infinity

  for (const gr of gearRatios) {
    const speedMs = speedKmh / 3.6
    const wheelRps = speedMs / wheelCircumference
    const projectedRpm = wheelRps * (gr.ratio * finalDrive) * 60

    // Só considera relações que manteriam o RPM dentro do faixa operacional
    if (projectedRpm < idleRpm * 0.9 || projectedRpm > maxRpm * 0.95) continue

    const diff = Math.abs(projectedRpm - rpm)
    if (diff < bestRpmDiff) {
      bestRpmDiff = diff
      bestGear = gr.gear
    }
  }

  return bestGear
}
