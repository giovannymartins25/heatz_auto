import { create } from 'zustand'
import type { VehicleConfig } from '@/types'
import { EngineSimulator } from '@/systems/engine'
import { Transmission } from '@/systems/transmission'
import { PHYSICS_TIMESTEP, MAX_SUBSTEPS } from '@/systems/engine/constants'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'
import { clamp } from '@/utils/math'

interface SimulationActions {
  /** Inicializa a simulação com um veículo */
  init: (config: VehicleConfig) => void
  /** Liga o motor */
  startEngine: () => void
  /** Desliga o motor */
  stopEngine: () => void
  /** Define a posição do acelerador (0-1) */
  setThrottle: (value: number) => void
  /** Define a posição do freio (0-1) */
  setBrake: (value: number) => void
  /** Troca para marcha acima */
  shiftUp: () => void
  /** Troca para marcha abaixo */
  shiftDown: () => void
  /** Coloca em neutro */
  shiftNeutral: () => void
  /** Atualiza a simulação (chamado pelo game loop) */
  update: (frameTime: number) => void
  /** Reseta a simulação */
  reset: () => void
}

interface SimulationState {
  // Estado do motor
  rpm: number
  isRunning: boolean
  isRevLimiting: boolean

  // Estado da transmissão
  currentGear: number
  clutchPosition: number

  // Estado do veículo
  speed: number
  throttle: number
  brake: number

  // Internos (não renderizados diretamente)
  _engine: EngineSimulator | null
  _transmission: Transmission | null
  _config: VehicleConfig | null
  _accumulator: number
  _isInitialized: boolean
}

type SimulationStore = SimulationState & SimulationActions

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  // Estado inicial
  rpm: 0,
  isRunning: false,
  isRevLimiting: false,
  currentGear: 0,
  clutchPosition: 0,
  speed: 0,
  throttle: 0,
  brake: 0,
  _engine: null,
  _transmission: null,
  _config: null,
  _accumulator: 0,
  _isInitialized: false,

  init: (config: VehicleConfig) => {
    const engine = new EngineSimulator(config.engine)
    const transmission = new Transmission(
      config.transmission,
      config.info.wheelDiameter,
    )

    set({
      _engine: engine,
      _transmission: transmission,
      _config: config,
      _isInitialized: true,
      rpm: 0,
      speed: 0,
      currentGear: 0,
      throttle: 0,
      brake: 0,
      isRunning: false,
      isRevLimiting: false,
      _accumulator: 0,
    })
  },

  startEngine: () => {
    const { _engine } = get()
    if (!_engine) return

    _engine.start()
    HapticFeedback.engineStart()
    set({ isRunning: true, rpm: _engine.getRpm() })
  },

  stopEngine: () => {
    const { _engine, _transmission } = get()
    if (!_engine) return

    _engine.stop()
    _transmission?.reset()
    set({
      isRunning: false,
      rpm: 0,
      speed: 0,
      currentGear: 0,
      throttle: 0,
      brake: 0,
    })
  },

  setThrottle: (value: number) => {
    set({ throttle: clamp(value, 0, 1) })
  },

  setBrake: (value: number) => {
    set({ brake: clamp(value, 0, 1) })
  },

  shiftUp: () => {
    const { _engine, _transmission, _config, speed, isRunning } = get()
    if (!_engine || !_transmission || !_config || !isRunning) return

    const result = _transmission.shiftUp(_engine.getRpm(), speed)

    // Recalcular RPM baseado na nova marcha
    if (result.newRpm > 0) {
      const clampedRpm = clamp(result.newRpm, _config.engine.idleRpm, _config.engine.maxRpm)
      _engine.setRpm(clampedRpm)
    }

    HapticFeedback.gearShift()
    set({
      currentGear: result.gear,
      rpm: _engine.getRpm(),
    })
  },

  shiftDown: () => {
    const { _engine, _transmission, _config, speed, isRunning } = get()
    if (!_engine || !_transmission || !_config || !isRunning) return

    const result = _transmission.shiftDown(
      _engine.getRpm(),
      speed,
      _config.engine.maxRpm,
    )

    if (result.newRpm > 0) {
      const clampedRpm = clamp(result.newRpm, _config.engine.idleRpm, _config.engine.maxRpm)
      _engine.setRpm(clampedRpm)
    }

    HapticFeedback.gearShift()
    set({
      currentGear: result.gear,
      rpm: _engine.getRpm(),
    })
  },

  shiftNeutral: () => {
    const { _transmission } = get()
    if (!_transmission) return

    _transmission.neutral()
    HapticFeedback.light()
    set({ currentGear: 0 })
  },

  update: (frameTime: number) => {
    const state = get()
    const { _engine, _transmission, _config } = state

    if (!_engine || !_transmission || !_config || !state.isRunning) return

    // Fixed timestep com acumulador
    // Garante que a física roda a 120Hz independente do FPS
    let accumulator = state._accumulator + frameTime
    let latestRpm = state.rpm
    let latestIsRevLimiting = state.isRevLimiting
    let substeps = 0

    while (accumulator >= PHYSICS_TIMESTEP && substeps < MAX_SUBSTEPS) {
      const gearRatio = _transmission.calculator.getGearRatio(_transmission.currentGear)

      const tickResult = _engine.tick({
        throttle: state.throttle,
        currentGear: _transmission.currentGear,
        gearRatio,
        finalDrive: _config.transmission.finalDrive,
        vehicleSpeed: state.speed / 3.6, // km/h → m/s
        wheelRadius: _config.info.wheelDiameter / 2,
        isClutchPressed: _transmission.isClutchPressed,
        deltaTime: PHYSICS_TIMESTEP,
      })

      latestRpm = tickResult.rpm
      latestIsRevLimiting = tickResult.isRevLimiting

      accumulator -= PHYSICS_TIMESTEP
      substeps++
    }

    // Calcular velocidade baseada no RPM e marcha atual
    let newSpeed = state.speed
    if (_transmission.isEngaged) {
      newSpeed = _transmission.calculator.rpmToSpeed(latestRpm, _transmission.currentGear)
      newSpeed = Math.max(0, newSpeed)
    }

    // Frenagem
    if (state.brake > 0.05) {
      const brakeDeceleration = state.brake * 15 * frameTime // km/h por frame
      newSpeed = Math.max(0, newSpeed - brakeDeceleration)
    }

    // Haptics no rev limiter
    if (latestIsRevLimiting && !state.isRevLimiting) {
      HapticFeedback.revLimiter()
    }

    set({
      rpm: latestRpm,
      speed: newSpeed,
      isRevLimiting: latestIsRevLimiting,
      _accumulator: accumulator,
    })
  },

  reset: () => {
    set({
      rpm: 0,
      isRunning: false,
      isRevLimiting: false,
      currentGear: 0,
      clutchPosition: 0,
      speed: 0,
      throttle: 0,
      brake: 0,
      _engine: null,
      _transmission: null,
      _config: null,
      _accumulator: 0,
      _isInitialized: false,
    })
  },
}))
