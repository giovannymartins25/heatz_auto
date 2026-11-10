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
  /** Seleciona modo de câmbio automático: P, R, N, D, S, M */
  selectShifterMode: (mode: 'P' | 'R' | 'N' | 'D' | 'S' | 'M') => void
  selectPark: () => void
  selectReverse: () => void
  selectNeutral: () => void
  selectDrive: () => void
  selectSport: () => void
  selectManual: () => void
  /** Liga ou desliga o TCS */
  setTcsEnabled: (enabled: boolean) => void
  /** Define estado do freio de mão */
  setHandbrake: (active: boolean) => void
  /** Alterna freio de mão */
  toggleHandbrake: () => void
  /** Aciona buzina */
  setHorn: (active: boolean) => void
  /** Alterna áudio mudo */
  toggleMute: () => void
  /** Define volume geral */
  setMasterVolume: (vol: number) => void
  /** Reseta dados de performance */
  resetPerformanceStats: () => void
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
  shifterPosition: 'P' | 'R' | 'N' | 'D' | 'S' | 'M'

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
  handbrake: boolean

  // Áudio & Controles extras
  isHornActive: boolean
  isMuted: boolean
  masterVolume: number

  // Launch Control & Turbo
  hasTurbo: boolean
  hasLaunchControl: boolean
  isLaunchControlArmed: boolean
  isLaunching: boolean
  boostPressureBar: number
  peakBoostBar: number

  // Cronômetro 0-100 & Records
  best0to100: number | null
  current0to100: number | null
  isTiming0to100: boolean
  topSpeedRecord: number
  _timer0to100Start: number | null

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
  shifterPosition: 'P',
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
  handbrake: false,
  isHornActive: false,
  isMuted: false,
  masterVolume: 1,
  hasTurbo: false,
  hasLaunchControl: false,
  isLaunchControlArmed: false,
  isLaunching: false,
  boostPressureBar: 0,
  peakBoostBar: 0,
  best0to100: null,
  current0to100: null,
  isTiming0to100: false,
  topSpeedRecord: 0,
  _timer0to100Start: null,
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
    const isAutoOrCvt =
      config.transmission.type === 'automatic' ||
      config.transmission.type === 'cvt' ||
      config.transmission.type === 'dct' ||
      config.transmission.defaultMode === 'automatic'

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
    const hasTurbo = Boolean(config.engine.turbo?.enabled)
    const hasLaunchControl = Boolean(
      config.transmission.launchControl?.enabled ||
      config.id === 'porsche-gt3' ||
      config.id === 'golf-gti' ||
      config.engine.turbo?.enabled
    )

    transmission.shiftTo(isAutoOrCvt ? -2 : 0, 0, undefined, true)

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
      hasTurbo,
      hasLaunchControl,
      isLaunchControlArmed: false,
      isLaunching: false,
      boostPressureBar: 0,
      peakBoostBar: 0,
      rpm: 0,
      speed: 0,
      currentGear: isAutoOrCvt ? -2 : 0,
      throttle: 0,
      brake: 0,
      clutchPosition: isAutoOrCvt ? 0 : 0,
      transmissionMode: defaultTransMode,
      drivingMode: defaultDriveMode,
      isKickdown: false,
      isBogWarning: false,
      lastShiftReason: 'none',
      shifterPosition: isAutoOrCvt ? 'P' : 'N',
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

    if (transmissionMode === 'automatic') {
      if (_config.transmission.hasManualMode) {
        // Tiptronic override: paddle shifter ativa modo manual imediatamente
        get().toggleSimulatedManual()
        get().shiftUp()
      }
      return
    }

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

    if (transmissionMode === 'automatic') {
      if (_config.transmission.hasManualMode) {
        // Tiptronic override: paddle shifter ativa modo manual imediatamente
        get().toggleSimulatedManual()
        get().shiftDown()
      }
      return
    }

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

  selectShifterMode: (mode: 'P' | 'R' | 'N' | 'D' | 'S' | 'M') => {
    const { _transmission, _autoTransmission, _physics, _config, speed } = get()
    if (!_transmission || !_config) return

    switch (mode) {
      case 'P': {
        _transmission.shiftTo(-2, 0, undefined, true)
        _physics?.reset()
        HapticFeedback.gearShift()
        set({ currentGear: -2, shifterPosition: 'P' })
        break
      }
      case 'R': {
        _autoTransmission?.reset()
        _transmission.shiftTo(-1, speed, undefined, true)
        HapticFeedback.gearShift()
        set({ currentGear: -1, shifterPosition: 'R' })
        break
      }
      case 'N': {
        _transmission.neutral()
        HapticFeedback.light()
        set({ currentGear: 0, shifterPosition: 'N' })
        break
      }
      case 'D': {
        _autoTransmission?.reset()
        _transmission.shiftTo(1, speed, undefined, true)
        HapticFeedback.gearShift()
        set({
          currentGear: 1,
          shifterPosition: 'D',
          transmissionMode: 'automatic',
          drivingMode: 'normal',
        })
        break
      }
      case 'S': {
        _autoTransmission?.reset()
        _transmission.shiftTo(1, speed, undefined, true)
        HapticFeedback.gearShift()
        set({
          currentGear: 1,
          shifterPosition: 'S',
          transmissionMode: 'automatic',
          drivingMode: 'sport',
        })
        break
      }
      case 'M': {
        const gear = get().currentGear <= 0 ? 1 : get().currentGear
        _transmission.shiftTo(gear, speed, undefined, true)
        HapticFeedback.gearShift()
        set({
          currentGear: gear,
          shifterPosition: 'M',
          transmissionMode: 'manual_simulated',
        })
        break
      }
    }
  },

  selectPark: () => get().selectShifterMode('P'),
  selectReverse: () => get().selectShifterMode('R'),
  selectNeutral: () => get().selectShifterMode('N'),
  selectDrive: () => get().selectShifterMode('D'),
  selectSport: () => get().selectShifterMode('S'),
  selectManual: () => get().selectShifterMode('M'),

  shiftNeutral: () => {
    const { _transmission } = get()
    if (!_transmission) return
    _transmission.neutral()
    HapticFeedback.light()
    set({ currentGear: 0, shifterPosition: 'N' })
  },

  setTcsEnabled: (enabled: boolean) => {
    const { _tcs } = get()
    if (!enabled) {
      _tcs?.reset()
    }
    set({ tcsEnabled: enabled, tcsIntervening: false, tcsInterventionLevel: 0 })
    HapticFeedback.light()
  },

  setHandbrake: (active: boolean) => {
    set({ handbrake: active })
    HapticFeedback.light()
  },

  toggleHandbrake: () => {
    set((s) => ({ handbrake: !s.handbrake }))
    HapticFeedback.light()
  },

  setHorn: (active: boolean) => {
    set({ isHornActive: active })
  },

  toggleMute: () => {
    set((s) => ({ isMuted: !s.isMuted }))
  },

  setMasterVolume: (vol: number) => {
    set({ masterVolume: clamp(vol, 0, 1) })
  },

  resetPerformanceStats: () => {
    set({
      best0to100: null,
      current0to100: null,
      isTiming0to100: false,
      topSpeedRecord: 0,
      _timer0to100Start: null,
    })
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

    // ─── Launch Control Lógica de Armação / Disparo ───
    let isLaunchArmed = state.isLaunchControlArmed
    let isLaunching = state.isLaunching

    const canLaunch = state.hasLaunchControl && latestIsRunning && !state.handbrake
    const isStationary = latestSpeed < 3.5
    const isLaunchGear = latestGear === 1 || (state.transmissionMode === 'automatic' && latestGear === 1)

    // Armar: parado em 1ª ou D, freio firme (>= 0.60) e acelerador a fundo (>= 0.65)
    if (canLaunch && isStationary && isLaunchGear && state.brake >= 0.60 && state.throttle >= 0.65) {
      isLaunchArmed = true
      isLaunching = false
    } else if (isLaunchArmed && state.brake < 0.25 && state.throttle >= 0.50) {
      // Piloto soltou o freio com o pé no fundo -> DISPARO / LARGADA!
      isLaunchArmed = false
      isLaunching = true
    } else if (isLaunchArmed && (state.throttle < 0.40 || latestGear === 0 || state.handbrake)) {
      // Cancelou se tirou o pé do acelerador, botou no neutro ou puxou freio de mão
      isLaunchArmed = false
      isLaunching = false
    }

    if (isLaunching && (latestSpeed > 45 || state.throttle < 0.3 || latestGear > 1)) {
      isLaunching = false
    }

    while (accumulator >= PHYSICS_TIMESTEP && substeps < MAX_SUBSTEPS) {
      const dt = PHYSICS_TIMESTEP

      // ─── 1. Tomada de Decisão da Transmissão ───
      if (state.transmissionMode === 'automatic' && _autoTransmission) {
        if (isLaunchArmed) {
          // Com Launch Control armado no automático, segura a embreagem desacoplada
          _clutch.setPosition(0.95)
          latestIsKickdown = false
        } else if (isLaunching) {
          // No disparo da largada, joga torque total imediato
          _clutch.setPosition(0.0)
          latestIsKickdown = true
        } else {
          // AUTO convencional
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
        }

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
      const isInNeutral = gear === 0 || gear === -2

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
        throttle: isLaunchArmed ? Math.min(state.throttle, 0.45) : state.throttle,
        loadTorque: clutchState.loadTorqueOnEngine, // carga resistiva real da embreagem
        deltaTime: dt,
      })

      latestRpm = engineTick.rpm
      latestIsRevLimiting = engineTick.isRevLimiting
      latestIsRunning = _engine.getIsRunning()
      latestIsStalled = engineTick.isStalled
      latestIsBogWarning = engineTick.isBogWarning
      latestStatus = engineTick.status

      // Se o Launch Control estiver armado, fixa o RPM de corte de largada
      if (isLaunchArmed) {
        const launchRpm = _config.transmission.launchControl?.launchRpm || (_config.id === 'porsche-gt3' ? 4500 : 3800)
        if (_engine.getRpm() > launchRpm) {
          _engine.setRpm(launchRpm)
          latestRpm = launchRpm
        }
      }

      // Telemetria da embreagem
      latestClutchSlipRpm = clutchState.slipRpm
      latestClutchSlipRatio = clutchState.slipRatio
      latestClutchTorqueTransfer = clutchState.transmittedTorque
      latestClutchHeat = clutchState.heat
      latestIsClutchSlipping = clutchState.isSlipping

      // 5. VehiclePhysics: calcula forças longitudinais
      const effectiveBrake = Math.max(state.brake, state.handbrake || gear === -2 ? 1 : 0)
      const physicsTick = _physics.tick({
        driveTorqueAtTransmission: clutchState.transmittedTorque,
        gearRatio,
        finalDrive,
        brake: effectiveBrake,
        deltaTime: dt,
      })

      latestSpeed = gear === -2 ? 0 : physicsTick.speedKmh
      if (gear === -2) {
        _physics.reset()
      }

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

    // ─── Turbo Boost Pressure Calculation ───
    let currentBoost = state.boostPressureBar
    let peakBoost = state.peakBoostBar

    if (state.hasTurbo && _config.engine.turbo?.enabled) {
      const turboCfg = _config.engine.turbo
      const maxBoost = turboCfg.maxBoostBar || 1.35
      const spoolRpm = turboCfg.spoolRpmStart || 1600
      const fullRpm = turboCfg.fullBoostRpm || 2600

      let targetBoost = -0.7 // Vácuo de marcha lenta (-0.7 bar)
      if (latestIsRunning) {
        if (isLaunchArmed) {
          // Anti-lag no Launch Control: 2-step spools turbo to ~65% do boost máximo
          targetBoost = turboCfg.maxBoostBar ? turboCfg.maxBoostBar * 0.65 : 0.85
        } else if (state.throttle < 0.08) {
          // Vácuo no coletor de admissão (-0.8 a -0.5 bar)
          targetBoost = -0.75 + clamp((latestRpm - 1000) / 6000, 0, 0.25)
        } else {
          // Sob aceleração
          if (latestRpm < spoolRpm) {
            // Abaixo do spool, sobe de vácuo para ~atmosférico (0.0 bar)
            targetBoost = -0.7 + (state.throttle * 0.7)
          } else {
            // Turbo enchendo proporcionalmente ao giro e acelerador
            const rpmFactor = clamp((latestRpm - spoolRpm) / (fullRpm - spoolRpm), 0, 1)
            targetBoost = state.throttle * (rpmFactor * maxBoost)
          }
        }
      } else {
        targetBoost = 0 // Motor desligado: pressão atmosférica
      }

      // Interpolação suave e realista da inércia da turbina
      const boostSpeed = targetBoost > currentBoost ? 4.8 : 8.5
      currentBoost += (targetBoost - currentBoost) * clamp(frameTime * boostSpeed, 0, 1)
      currentBoost = Math.round(currentBoost * 100) / 100
      peakBoost = Math.max(peakBoost, currentBoost)
    } else {
      currentBoost = 0
      peakBoost = 0
    }

    // ─── Tracking 0-100 km/h e Top Speed (Rollout Dragy Style) ───
    let timerStart = state._timer0to100Start
    let isTiming = state.isTiming0to100
    let bestTime = state.best0to100
    let currentTime = state.current0to100
    const topSpeed = Math.max(state.topSpeedRecord, Math.round(latestSpeed))

    // Disparo estrito de 0-100:
    // 1. Motor ligado
    // 2. Marcha à frente engatada (gear > 0) — NUNCA no Neutro ou Ré
    // 3. Freio solto (brake < 0.3) e freio de mão solto
    // 4. Rollout / Largada real: velocidade cruzando 0.8 km/h com acelerador > 0.15
    if (!isTiming && latestIsRunning && latestGear > 0 && !state.handbrake && state.brake < 0.3) {
      if (latestSpeed >= 0.8 && latestSpeed < 5 && state.throttle > 0.15) {
        timerStart = performance.now()
        isTiming = true
        currentTime = 0
      }
    } else if (isTiming && timerStart) {
      const elapsed = (performance.now() - timerStart) / 1000
      currentTime = Math.round(elapsed * 100) / 100
      if (latestSpeed >= 100) {
        isTiming = false
        if (!bestTime || currentTime < bestTime) {
          bestTime = currentTime
        }
      } else if (latestGear === 0 || (latestSpeed < 1 && state.throttle < 0.05)) {
        isTiming = false
      }
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
      isLaunchControlArmed: isLaunchArmed,
      isLaunching,
      boostPressureBar: currentBoost,
      peakBoostBar: peakBoost,
      tcsIntervening: latestTcsIntervening,
      tcsInterventionLevel: latestTcsLevel,
      clutchSlipRpm: latestClutchSlipRpm,
      clutchSlipRatio: latestClutchSlipRatio,
      clutchTorqueTransfer: latestClutchTorqueTransfer,
      clutchHeat: latestClutchHeat,
      isClutchSlipping: latestIsClutchSlipping,
      best0to100: bestTime,
      current0to100: currentTime,
      isTiming0to100: isTiming,
      topSpeedRecord: topSpeed,
      _timer0to100Start: timerStart,
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
  shifterPosition: 'P',
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
      handbrake: false,
      isHornActive: false,
      isLaunchControlArmed: false,
      isLaunching: false,
      boostPressureBar: 0,
      peakBoostBar: 0,
      isTiming0to100: false,
      current0to100: null,
      _timer0to100Start: null,
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
