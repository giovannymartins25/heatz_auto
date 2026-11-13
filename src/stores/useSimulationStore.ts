import { create } from 'zustand'
import type { VehicleConfig, DrivingMode } from '@/types'
import type { EngineStatus, FuelType, DragTreeStage, DragTimeSlip } from '@/types/simulation'
import { EngineSimulator } from '@/systems/engine'
import { Transmission, AutomaticTransmission } from '@/systems/transmission'
import { ClutchSystem } from '@/systems/clutch'
import { VehiclePhysics } from '@/systems/physics'
import { TractionControlSystem } from '@/systems/tcs'
import { PedalInputSystem, createInitialZeroToHundredState, stepZeroToHundredTimer, type ZeroToHundredState } from '@/systems/vehicle'
import { PHYSICS_TIMESTEP, MAX_SUBSTEPS } from '@/systems/engine/constants'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'
import { clamp } from '@/utils/math'
import type { AmbientLightColor } from '@/utils/ambientLighting'
import { useGarageStore, type CarUpgrades } from './useGarageStore'


/**
 * TransmissionMode — modos de operação da transmissão:
 * - 'manual'           → Câmbio manual convencional com embreagem (Gol, CB1000R)
 * - 'automatic'        → CVT/Automático gerenciado eletronicamente (Yaris AUTO)
 * - 'manual_simulated' → CVT em modo manual: jogador escolhe relações virtuais sem embreagem
 */
export type TransmissionMode = 'manual' | 'automatic' | 'manual_simulated'

interface SimulationActions {
  /** Inicializa a simulação com um veículo e eventuais peças equipadas */
  init: (config: VehicleConfig, initialUpgrades?: Partial<CarUpgrades>, garageInstanceId?: string | null) => void
  /** Atualiza peças e upgrades equipados */
  setEquippedUpgrades: (upgrades: Partial<CarUpgrades>) => void
  /** Asa traseira aerodinâmica (Porsche / Supercarros) */
  setAeroWing: (extended: boolean) => void
  toggleAeroWing: () => void
  /** Liga o motor (ou aciona arranque se parado/estolado) */
  startEngine: () => void
  /** Desliga o motor */
  stopEngine: () => void
  /** Define a posição do acelerador (0-1) */
  setThrottle: (value: number) => void
  /** Trava o acelerador em 100% ou destrava */
  setThrottleLock: (locked: boolean) => void
  /** Alterna trava do acelerador */
  toggleThrottleLock: () => void
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
  /** Define cor da iluminação ambiente da cabine e painel */
  setAmbientLightColor: (color: AmbientLightColor) => void
  /** Válvula de Difusor de Escape */
  toggleExhaustValve: () => void
  setExhaustValve: (open: boolean) => void
  /** Dispara chama visual no escape / painel */
  triggerBackfireFlame: () => void
  /** Oficina de Preparação (Stage 0 Stock, Stage 1, Stage 2, Stage 3) */
  setTuningStage: (stage: 0 | 1 | 2 | 3) => void
  /** Controle de Faróis (Desligado, Lanterna, Farol Baixo, Farol Alto) */
  cycleHeadlights: () => void
  setHeadlightsMode: (mode: 'off' | 'parking' | 'low' | 'high') => void
  /** Clima & Limpadores */
  toggleRain: () => void
  toggleWipers: () => void
  /** Vidros Elétricos & Acústica */
  toggleWindows: () => void
  setWindowsOpen: (open: boolean) => void
  /** Alternador de Câmbio: Sequencial (+/-) vs H-Shifter (1ª-6ª + Ré) */
  setShifterLayout: (layout: 'sequential' | 'h_pattern') => void
  toggleShifterLayout: () => void
  shiftHPattern: (targetGear: number) => void
  /** Sistema de Combustível */
  refuel: (liters?: number) => void
  setFuelType: (type: FuelType) => void
  /** Reparo Mecânico de Danos / Motor Fundido */
  repairEngine: () => void
  /** Kit de Óxido Nitroso (NOS) */
  setNosActive: (active: boolean) => void
  purgeNos: () => void
  refillNos: () => void
  /** Pista de Arrancada 402m (Drag Strip) */
  startDragRace: () => void
  resetDragRace: () => void
  cancelDragRace: () => void
  /** Esterço do Volante (-1 a +1) */
  setSteeringAngle: (angle: number) => void
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
  isAutomaticVehicle: boolean
  currentGear: number
  clutchPosition: number
  transmissionMode: TransmissionMode
  drivingMode: DrivingMode
  isKickdown: boolean
  lastShiftReason: string     // 'none' | 'clutch_required' | 'over_rev' | 'gear_limit'
  gearSelectorPosition: 'P' | 'R' | 'N' | 'D' | 'S' | 'M'

  // Iluminação de Cabine e Painel
  ambientLightColor: AmbientLightColor

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
  throttleLock: boolean
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

  // Escape, Efeitos & Difusor
  exhaustValveOpen: boolean
  isBackfireFlashing: boolean

  // Oficina de Preparação (Stage 0 Stock, 1, 2, 3)
  tuningStage: 0 | 1 | 2 | 3

  // Iluminação Externa / Faróis
  headlightsMode: 'off' | 'parking' | 'low' | 'high'

  // Clima & Limpador
  isRaining: boolean
  isWiperActive: boolean

  // Peças & Customizações Equipadas da Loja
  hasRetrofitInfotainment: boolean
  /** Manômetro de turbo/vácuo aftermarket instalado no interior */
  hasBoostGaugeKit: boolean
  /** Unidade da garagem carregada no simulador (null = carro de fábrica sem garagem) */
  garageInstanceId: string | null
  exhaustType: 'stock' | 'sport' | 'straight_pipe'
  intakeType: 'stock' | 'cold_air'
  tires: 'street' | 'semi_slick'
  isAeroWingExtended: boolean

  // Volante & Esterço
  steeringAngle: number

  // Cronômetro 0-100 & Records
  best0to100: number | null
  last0to100: number | null
  current0to100: number | null
  isTiming0to100: boolean
  topSpeedRecord: number
  _timer0to100State: ZeroToHundredState

  // Sistema de Combustível
  fuelLevelLiters: number
  fuelCapacityLiters: number
  fuelType: FuelType
  isOutOfFuel: boolean

  // Dinâmica Térmica & Danos
  coolantTemp: number
  oilTemp: number
  isEngineBlown: boolean
  damageReason: string | null
  engineBlownTrigger: number

  // Freios, Temperatura & Burnout
  brakeDiscTemp: number
  isBrakeGlowing: boolean
  brakeFadeFactor: number
  isBurningOut: boolean
  tireSmokeDensity: number

  // Vidros Elétricos & H-Shifter
  windowsOpen: boolean
  shifterLayout: 'sequential' | 'h_pattern'
  isGearGrinding: boolean
  gearGrindTrigger: number

  // Kit de Óxido Nitroso (NOS)
  hasNosKit: boolean
  nosActive: boolean
  nosPressurePercent: number
  isNosPurging: boolean
  nosPurgeTrigger: number

  // Pista de Arrancada 402m (Drag Strip)
  dragStage: DragTreeStage
  dragTimeSlip: DragTimeSlip | null
  _dragDistanceTraveled: number
  _dragTimerStart: number | null
  _dragGreenTime: number | null

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
  isAutomaticVehicle: true,
  ambientLightColor: 'red',
  currentGear: 0,
  // Peças & Customizações Equipadas da Loja
  hasRetrofitInfotainment: false,
  hasBoostGaugeKit: false,
  garageInstanceId: null,
  exhaustType: 'stock',
  intakeType: 'stock',
  tires: 'street',
  isAeroWingExtended: false,

  clutchPosition: 0,
  transmissionMode: 'manual',
  drivingMode: 'normal',
  isKickdown: false,
  lastShiftReason: 'none',
  gearSelectorPosition: 'P',
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
  throttleLock: false,
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
  exhaustValveOpen: false,
  isBackfireFlashing: false,
  tuningStage: 0,
  headlightsMode: 'low',
  isRaining: false,
  isWiperActive: false,
  steeringAngle: 0,
  best0to100: null,
  last0to100: null,
  current0to100: null,
  isTiming0to100: false,
  topSpeedRecord: 0,
  _timer0to100State: createInitialZeroToHundredState(),

  // Sistema de Combustível
  fuelLevelLiters: 45,
  fuelCapacityLiters: 50,
  fuelType: 'common_gasoline',
  isOutOfFuel: false,

  // Dinâmica Térmica & Danos
  coolantTemp: 88,
  oilTemp: 92,
  isEngineBlown: false,
  damageReason: null,
  engineBlownTrigger: 0,

  // Freios, Temperatura & Burnout
  brakeDiscTemp: 60,
  isBrakeGlowing: false,
  brakeFadeFactor: 1.0,
  isBurningOut: false,
  tireSmokeDensity: 0,

  // Vidros Elétricos & H-Shifter
  windowsOpen: false,
  shifterLayout: 'sequential',
  isGearGrinding: false,
  gearGrindTrigger: 0,

  // Kit de Óxido Nitroso (NOS)
  hasNosKit: false,
  nosActive: false,
  nosPressurePercent: 100,
  isNosPurging: false,
  nosPurgeTrigger: 0,

  // Pista de Arrancada 402m (Drag Strip)
  dragStage: 'idle',
  dragTimeSlip: null,
  _dragDistanceTraveled: 0,
  _dragTimerStart: null,
  _dragGreenTime: null,

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

  init: (config: VehicleConfig, initialUpgrades?: Partial<CarUpgrades>, garageInstanceId?: string | null) => {
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
    const hasTurbo = Boolean(config.engine.turbo?.enabled || initialUpgrades?.turboKit)
    const hasLaunchControl = Boolean(
      config.transmission.launchControl?.enabled ||
      config.id === 'porsche-gt3' ||
      config.id === 'golf-gti' ||
      config.engine.turbo?.enabled ||
      initialUpgrades?.turboKit
    )

    transmission.shiftTo(isAutoOrCvt ? -2 : 0, 0, undefined, true)

    const defaultAmbientColor: AmbientLightColor =
      config.id === 'golf-gti'
        ? 'red'
        : config.id === 'porsche-gt3'
          ? 'amber'
          : config.id?.includes('yaris')
            ? 'cyan'
            : 'red'

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
      isAutomaticVehicle: isAutoOrCvt,
      ambientLightColor: defaultAmbientColor,
      hasTurbo,
      hasLaunchControl,
      hasRetrofitInfotainment: Boolean(initialUpgrades?.multimediaKit),
      hasBoostGaugeKit: Boolean(initialUpgrades?.boostGaugeKit),
      hasNosKit: Boolean(initialUpgrades?.hasNosKit),
      nosActive: false,
      nosPressurePercent: 100,
      isNosPurging: false,
      nosPurgeTrigger: 0,
      garageInstanceId: garageInstanceId ?? null,
      exhaustType: initialUpgrades?.exhaustType || (hasTurbo ? 'sport' : 'stock'),
      intakeType: initialUpgrades?.intakeType || 'stock',
      tires: initialUpgrades?.tires || 'street',
      isAeroWingExtended: false,
      isLaunchControlArmed: false,
      isLaunching: false,
      boostPressureBar: 0,
      peakBoostBar: 0,
      exhaustValveOpen: initialUpgrades?.exhaustValveOpen ?? false,
      best0to100: null,
      last0to100: null,
      current0to100: null,
      isTiming0to100: false,
      topSpeedRecord: 0,
      _timer0to100State: createInitialZeroToHundredState(),
      isBackfireFlashing: false,
      tuningStage: initialUpgrades?.tuningStage ?? 0,
      headlightsMode: 'low',
      isRaining: false,
      isWiperActive: false,
      steeringAngle: 0,
      rpm: 0,
      speed: 0,
      currentGear: isAutoOrCvt ? -2 : 0,
      throttle: 0,
      throttleLock: false,
      brake: 0,
      clutchPosition: isAutoOrCvt ? 0 : 0,
      transmissionMode: defaultTransMode,
      drivingMode: defaultDriveMode,
      isKickdown: false,
      isBogWarning: false,
      lastShiftReason: 'none',
      gearSelectorPosition: isAutoOrCvt ? 'P' : 'N',
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
      fuelType: initialUpgrades?.fuelType || (config.id === 'gol-quadrado' ? 'ethanol_e100' : 'common_gasoline'),
      fuelLevelLiters: 45,
      fuelCapacityLiters: 50,
      isOutOfFuel: false,
      coolantTemp: 88,
      oilTemp: 92,
      isEngineBlown: false,
      damageReason: null,
      engineBlownTrigger: 0,
      brakeDiscTemp: 60,
      isBrakeGlowing: false,
      brakeFadeFactor: 1.0,
      isBurningOut: false,
      tireSmokeDensity: 0,
      windowsOpen: false,
      shifterLayout: !isAutoOrCvt ? 'h_pattern' : 'sequential',
      isGearGrinding: false,
      gearGrindTrigger: 0,
      dragStage: 'idle',
      dragTimeSlip: null,
      _dragDistanceTraveled: 0,
      _dragTimerStart: null,
      _dragGreenTime: null,
      _accumulator: 0,
    })
  },

  startEngine: () => {
    const {
      _engine,
      transmissionMode,
      _transmission,
      _clutch,
      currentGear,
      clutchPosition,
      isEngineBlown,
      isOutOfFuel,
    } = get()
    if (!_engine) return

    // Se já estiver no processo de partida (cranking), ignora para evitar reiniciar o arranque
    if (_engine.getStatus() === 'starting') return

    if (isEngineBlown) {
      HapticFeedback.light()
      set({ isRunning: false, isStalled: true, status: 'stalled' })
      return
    }

    if (isOutOfFuel) {
      HapticFeedback.light()
      set({ isRunning: false, isStalled: true, status: 'stalled', damageReason: 'Pane Seca: Sem combustível!' })
      return
    }

    // Em veículos manuais, se estiver engatado sem a embreagem pressionada,
    // desengata para Neutro (0) e desacopla a embreagem para evitar afogamento instantâneo
    if (transmissionMode === 'manual') {
      if (currentGear !== 0 && clutchPosition < 0.5) {
        _transmission?.shiftTo(0, 0)
      }
      _clutch?.setPosition(1)
    }

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
      damageReason: null,
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
      throttleLock: false,
      isKickdown: false,
      tcsIntervening: false,
      tcsInterventionLevel: 0,
    })
  },

  setThrottle: (value: number) => {
    const clamped = clamp(value, 0, 1)
    const { throttleLock } = get()
    // Se estiver travado e o valor recebido for soltura (< 0.05), mantém 100% acelerado
    if (throttleLock && clamped < 0.05) {
      return
    }
    // Se o usuário acelerar acima de 95% ou alterar ativamente, atualiza
    set({ throttle: clamped })
  },

  setThrottleLock: (locked: boolean) => {
    set({
      throttleLock: locked,
      throttle: locked ? 1.0 : get().throttle,
    })
    HapticFeedback.light()
  },

  toggleThrottleLock: () => {
    const next = !get().throttleLock
    set({
      throttleLock: next,
      throttle: next ? 1.0 : 0.0,
    })
    HapticFeedback.light()
  },

  setBrake: (value: number) => {
    const clamped = clamp(value, 0, 1)
    // Tocar no freio (>= 10%) destrava automaticamente o acelerador travado (segurança estilo cruise control)
    if (clamped >= 0.1 && get().throttleLock) {
      set({
        brake: clamped,
        throttleLock: false,
        throttle: 0.0,
      })
      HapticFeedback.light()
      return
    }
    set({ brake: clamped })
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

  setAmbientLightColor: (color: AmbientLightColor) => {
    set({ ambientLightColor: color })
    HapticFeedback.light()
  },

  toggleExhaustValve: () => {
    const next = !get().exhaustValveOpen
    const instanceId = get().garageInstanceId
    set({ exhaustValveOpen: next })
    if (instanceId) {
      useGarageStore.getState().installUpgrade(instanceId, { exhaustValveOpen: next })
    }
    HapticFeedback.light()
  },

  setExhaustValve: (open: boolean) => {
    const instanceId = get().garageInstanceId
    set({ exhaustValveOpen: open })
    if (instanceId) {
      useGarageStore.getState().installUpgrade(instanceId, { exhaustValveOpen: open })
    }
  },

  triggerBackfireFlame: () => {
    set({ isBackfireFlashing: true })
    setTimeout(() => {
      set({ isBackfireFlashing: false })
    }, 120)
  },

  setTuningStage: (stage: 0 | 1 | 2 | 3) => {
    set({ tuningStage: stage })
    HapticFeedback.medium()
  },

  setEquippedUpgrades: (upgrades: Partial<CarUpgrades>) => {
    const { _config, _physics } = get()
    set((state) => {
      const hasTurbo = Boolean(_config?.engine.turbo?.enabled || (upgrades.turboKit !== undefined ? upgrades.turboKit : state.hasTurbo))
      const exhaustType = upgrades.exhaustType ?? state.exhaustType
      const intakeType = upgrades.intakeType ?? state.intakeType
      const tires = upgrades.tires ?? state.tires
      const tuningStage = upgrades.tuningStage ?? state.tuningStage
      const hasRetrofitInfotainment =
        upgrades.multimediaKit !== undefined ? upgrades.multimediaKit : state.hasRetrofitInfotainment
      const hasBoostGaugeKit =
        upgrades.boostGaugeKit !== undefined ? upgrades.boostGaugeKit : state.hasBoostGaugeKit
      const hasNosKit =
        upgrades.hasNosKit !== undefined ? upgrades.hasNosKit : state.hasNosKit
      const exhaustValveOpen = upgrades.exhaustValveOpen ?? state.exhaustValveOpen

      if (_physics) {
        let baseFric = tires === 'semi_slick' ? 1.22 : 0.95
        if (state.isRaining) baseFric = tires === 'semi_slick' ? 0.52 : 0.62
        if (state.isAeroWingExtended) baseFric += 0.14
        _physics.setSurfaceFriction(baseFric)
      }

      return {
        hasTurbo,
        exhaustType,
        intakeType,
        tires,
        tuningStage,
        hasRetrofitInfotainment,
        hasBoostGaugeKit,
        hasNosKit,
        exhaustValveOpen,
      }
    })
  },

  setAeroWing: (extended: boolean) => {
    const { _physics, isRaining, tires } = get()
    let baseFric = tires === 'semi_slick' ? 1.22 : 0.95
    if (isRaining) baseFric = tires === 'semi_slick' ? 0.52 : 0.62
    if (extended) baseFric += 0.14
    _physics?.setSurfaceFriction(baseFric)
    set({ isAeroWingExtended: extended })
    HapticFeedback.light()
  },

  toggleAeroWing: () => {
    get().setAeroWing(!get().isAeroWingExtended)
  },

  cycleHeadlights: () => {
    const modes: ('off' | 'parking' | 'low' | 'high')[] = ['off', 'parking', 'low', 'high']
    const current = get().headlightsMode
    const nextIdx = (modes.indexOf(current) + 1) % modes.length
    set({ headlightsMode: modes[nextIdx] })
    HapticFeedback.light()
  },

  setHeadlightsMode: (mode: 'off' | 'parking' | 'low' | 'high') => {
    set({ headlightsMode: mode })
    HapticFeedback.light()
  },

  toggleRain: () => {
    const nextRain = !get().isRaining
    const { _physics, tires, isAeroWingExtended } = get()
    if (_physics) {
      let baseFric = tires === 'semi_slick' ? (nextRain ? 0.52 : 1.22) : (nextRain ? 0.62 : 0.95)
      if (isAeroWingExtended) baseFric += 0.14
      _physics.setSurfaceFriction(baseFric)
    }
    set({ isRaining: nextRain, isWiperActive: nextRain ? true : get().isWiperActive })
    HapticFeedback.light()
  },

  toggleWipers: () => {
    set({ isWiperActive: !get().isWiperActive })
    HapticFeedback.light()
  },

  setSteeringAngle: (angle: number) => {
    set({ steeringAngle: clamp(angle, -1, 1) })
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
      set({ transmissionMode: 'manual_simulated', currentGear: targetGear, gearSelectorPosition: 'M' })
      HapticFeedback.gearShift()
    } else if (transmissionMode === 'manual_simulated') {
      // MANUAL_SIMULATED -> AUTO
      // Reseta o timer do câmbio automático para evitar troca imediata
      _autoTransmission?.reset()
      // Mantém a relação atual — o AutomaticTransmission vai assumir no próximo tick
      set({
        transmissionMode: 'automatic',
        isKickdown: false,
        gearSelectorPosition: 'D',
      })
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
        const currentG = _transmission.currentGear > 0 ? _transmission.currentGear : 1
        const targetG = Math.min(_config.transmission.gearCount, currentG + 1)
        _transmission.shiftTo(targetG, speed, undefined, true)
        const newRpm = clamp(
          _transmission.calculator.speedToRpm(speed, targetG),
          _config.engine.idleRpm,
          _config.engine.maxRpm
        )
        if (newRpm > 0) _engine.setRpm(newRpm)
        HapticFeedback.gearShift()
        set({
          transmissionMode: 'manual_simulated',
          gearSelectorPosition: 'M',
          currentGear: targetG,
          rpm: _engine.getRpm(),
          lastShiftReason: 'none',
        })
      }
      return
    }

    if (transmissionMode === 'manual_simulated') {
      // Modo manual simulado: sem embreagem, troca instantânea mesmo acelerando a fundo
      const nextGear = _transmission.currentGear + 1
      if (nextGear > _config.transmission.gearCount) return

      // Upshift reduz rotação, portanto é 100% seguro contra over-rev; bypassClutchCheck = true
      const result = _transmission.shiftTo(nextGear, speed, undefined, true)
      if (result.success) {
        const newRpm = clamp(result.newRpm, _config.engine.idleRpm, _config.engine.maxRpm)
        if (result.newRpm > 0) _engine.setRpm(newRpm)
        HapticFeedback.gearShift()
        set({ currentGear: result.gear, rpm: _engine.getRpm(), lastShiftReason: 'none' })
      }
      return
    }

    // Modo 'manual' convencional (Gol G6, CB1000R, Opala, etc.) com validação de embreagem
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
        const currentG = _transmission.currentGear > 1 ? _transmission.currentGear : 2
        const targetG = Math.max(1, currentG - 1)
        const projectedRpm = _transmission.calculator.speedToRpm(speed, targetG)
        if (projectedRpm > _config.engine.maxRpm * 1.05) {
          HapticFeedback.light()
          set({ lastShiftReason: 'over_rev' })
          return
        }
        _transmission.shiftTo(targetG, speed, undefined, true)
        const newRpm = clamp(projectedRpm, _config.engine.idleRpm, _config.engine.maxRpm)
        if (newRpm > 0) _engine.setRpm(newRpm)
        HapticFeedback.gearShift()
        set({
          transmissionMode: 'manual_simulated',
          gearSelectorPosition: 'M',
          currentGear: targetG,
          rpm: _engine.getRpm(),
          lastShiftReason: 'none',
        })
      }
      return
    }

    if (transmissionMode === 'manual_simulated') {
      // Modo manual simulado: sem embreagem, permite redução esportiva sob aceleração
      const nextGear = _transmission.currentGear - 1
      if (nextGear < 1) return

      // Proteção realista contra over-rev mecânico (permite até 105% do corte)
      const projectedRpm = _transmission.calculator.speedToRpm(speed, nextGear)
      if (projectedRpm > _config.engine.maxRpm * 1.05) {
        HapticFeedback.light()
        set({ lastShiftReason: 'over_rev' })
        return
      }

      const result = _transmission.shiftTo(nextGear, speed, undefined, true)
      if (result.success) {
        const newRpm = clamp(result.newRpm, _config.engine.idleRpm, _config.engine.maxRpm)
        if (result.newRpm > 0) _engine.setRpm(newRpm)
        HapticFeedback.gearShift()
        set({ currentGear: result.gear, rpm: _engine.getRpm(), lastShiftReason: 'none' })
      }
      return
    }

    // Modo 'manual' convencional (Gol G6, CB1000R) com validação de embreagem
    if (!_clutch) return

    // Detecção de Money Shift em reduções violentas acima do corte
    const targetGear = _transmission.currentGear - 1
    if (targetGear > 0) {
      const expectedRpm = _transmission.calculator.speedToRpm(speed, targetGear)
      if (expectedRpm > _config.engine.maxRpm * 1.25 && speed > 35) {
        _engine.stop()
        set({
          isEngineBlown: true,
          damageReason: `Money Shift: Sobregiro Destrutivo de ${Math.round(expectedRpm)} RPM!`,
          isRunning: false,
          isStalled: true,
          status: 'stalled',
          engineBlownTrigger: Date.now(),
        })
        HapticFeedback.heavy()
        return
      }
    }

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
    const { _transmission, _autoTransmission, _physics, _config, speed, isAutomaticVehicle } = get()
    if (!_transmission || !_config) return
    const supported = _config.transmission.supportedSelectorPositions ?? []
    if (!supported.includes(mode)) return

    // Carros com câmbio manual convencional (Gol, Civic Si, Gol Quadrado, CB1000R)
    // NÃO possuem alavanca P/R/N/D/S/M. Apenas o Neutro é permitido, sem trocar o modo.
    if (!isAutomaticVehicle) {
      if (mode === 'N') {
        _transmission.neutral()
        HapticFeedback.light()
        set({ currentGear: 0, gearSelectorPosition: 'N' })
      }
      return
    }

    switch (mode) {
      case 'P': {
        _transmission.shiftTo(-2, 0, undefined, true)
        _physics?.reset()
        HapticFeedback.gearShift()
        set({ currentGear: -2, gearSelectorPosition: 'P', transmissionMode: 'automatic' })
        break
      }
      case 'R': {
        _autoTransmission?.reset()
        _transmission.shiftTo(-1, speed, undefined, true)
        HapticFeedback.gearShift()
        set({ currentGear: -1, gearSelectorPosition: 'R', transmissionMode: 'automatic' })
        break
      }
      case 'N': {
        _transmission.neutral()
        HapticFeedback.light()
        set({ currentGear: 0, gearSelectorPosition: 'N', transmissionMode: 'automatic' })
        break
      }
      case 'D': {
        const targetGear = get().currentGear > 0 ? get().currentGear : 1
        _autoTransmission?.reset()
        _transmission.shiftTo(targetGear, speed, undefined, true)
        HapticFeedback.gearShift()
        set({
          currentGear: targetGear,
          gearSelectorPosition: 'D',
          transmissionMode: 'automatic',
        })
        break
      }
      case 'S': {
        const targetGear = get().currentGear > 0 ? get().currentGear : 1
        _autoTransmission?.reset()
        _transmission.shiftTo(targetGear, speed, undefined, true)
        HapticFeedback.gearShift()
        set({
          currentGear: targetGear,
          gearSelectorPosition: 'S',
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
          gearSelectorPosition: 'M',
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
    set({
      currentGear: 0,
      gearSelectorPosition: 'N',
      transmissionMode: get().isAutomaticVehicle ? 'automatic' : get().transmissionMode,
    })
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

  toggleWindows: () => {
    const next = !get().windowsOpen
    set({ windowsOpen: next })
    HapticFeedback.light()
  },

  setWindowsOpen: (open: boolean) => {
    set({ windowsOpen: open })
  },

  setShifterLayout: (layout: 'sequential' | 'h_pattern') => {
    set({ shifterLayout: layout })
    HapticFeedback.light()
  },

  toggleShifterLayout: () => {
    const next = get().shifterLayout === 'sequential' ? 'h_pattern' : 'sequential'
    set({ shifterLayout: next })
    HapticFeedback.light()
  },

  shiftHPattern: (targetGear: number) => {
    const { _engine, _transmission, _config, speed, isRunning, clutchPosition, isAutomaticVehicle, isEngineBlown } = get()
    if (!_transmission || !_config || isEngineBlown) return

    // Ponto morto sempre entra de forma imediata e desengata a transmissão
    if (targetGear === 0) {
      _transmission.neutral()
      HapticFeedback.light()
      set({ currentGear: 0, gearSelectorPosition: 'N', isGearGrinding: false, lastShiftReason: 'none' })
      return
    }

    // Validação de embreagem em câmbio manual com o veículo em movimento (>6 km/h)
    if (!isAutomaticVehicle && speed > 6 && clutchPosition < 0.45) {
      // Sincronizador arranha violentamente!
      HapticFeedback.heavy()
      set({
        isGearGrinding: true,
        gearGrindTrigger: Date.now(),
        lastShiftReason: 'clutch_required',
      })
      return
    }

    // Ré enquanto anda para frente (>8 km/h): tranca mecânica com arranhão
    if (targetGear === -1 && speed > 8) {
      HapticFeedback.heavy()
      set({
        isGearGrinding: true,
        gearGrindTrigger: Date.now(),
        lastShiftReason: 'gear_limit',
      })
      return
    }

    // Detecção de Money Shift em engate incorreto em alta velocidade
    if (targetGear > 0) {
      const expectedRpm = _transmission.calculator.speedToRpm(speed, targetGear)
      if (expectedRpm > _config.engine.maxRpm * 1.25 && speed > 35) {
        _engine?.stop()
        set({
          isEngineBlown: true,
          damageReason: `Money Shift: Sobregiro Destrutivo de ${Math.round(expectedRpm)} RPM!`,
          isRunning: false,
          isStalled: true,
          status: 'stalled',
          engineBlownTrigger: Date.now(),
          currentGear: targetGear,
          isGearGrinding: false,
        })
        HapticFeedback.heavy()
        return
      }
    }

    // Engate bem-sucedido
    const result = _transmission.shiftTo(targetGear, speed, undefined, true)
    if (_engine && result.newRpm > 0 && isRunning) {
      const clampedRpm = clamp(result.newRpm, _config.engine.idleRpm, _config.engine.maxRpm)
      _engine.setRpm(clampedRpm)
    }
    HapticFeedback.gearShift()
    const supported = _config.transmission.supportedSelectorPositions ?? ['N']
    const newSelector = targetGear === 0
      ? 'N'
      : (targetGear === -1 && supported.includes('R') ? 'R' : (supported.includes('M') ? 'M' : 'N'))
    set({
      currentGear: targetGear,
      isGearGrinding: false,
      lastShiftReason: 'none',
      gearSelectorPosition: newSelector,
    })
  },

  refuel: (liters?: number) => {
    set((s) => ({
      fuelLevelLiters: Math.min(s.fuelCapacityLiters, s.fuelLevelLiters + (liters ?? s.fuelCapacityLiters)),
      isOutOfFuel: false,
      damageReason: s.damageReason === 'Pane Seca: Sem combustível!' ? null : s.damageReason,
    }))
    HapticFeedback.medium()
  },

  setFuelType: (type: FuelType) => {
    set({ fuelType: type })
    HapticFeedback.light()
  },

  repairEngine: () => {
    set((s) => ({
      isEngineBlown: false,
      damageReason: null,
      coolantTemp: 88,
      oilTemp: 92,
      brakeDiscTemp: 60,
      brakeFadeFactor: 1.0,
      isBrakeGlowing: false,
      isOutOfFuel: false,
      fuelLevelLiters: Math.max(s.fuelLevelLiters, 15),
    }))
    HapticFeedback.medium()
  },

  startDragRace: () => {
    const { _physics, _engine } = get()
    _physics?.reset()
    if (_engine) _engine.setRpm(1000)
    set({
      dragStage: 'pre_stage',
      dragTimeSlip: null,
      _dragDistanceTraveled: 0,
      _dragTimerStart: null,
      _dragGreenTime: null,
    })
    HapticFeedback.light()

    // Sequência Árvore de Natal NHRA Drag Strip
    setTimeout(() => {
      if (get().dragStage === 'pre_stage') set({ dragStage: 'staged' })
    }, 600)
    setTimeout(() => {
      if (get().dragStage === 'staged') set({ dragStage: 'yellow_1' })
    }, 1200)
    setTimeout(() => {
      if (get().dragStage === 'yellow_1') set({ dragStage: 'yellow_2' })
    }, 1700)
    setTimeout(() => {
      if (get().dragStage === 'yellow_2') set({ dragStage: 'yellow_3' })
    }, 2200)
    setTimeout(() => {
      if (get().dragStage === 'yellow_3') {
        set({ dragStage: 'green', _dragGreenTime: performance.now() })
        HapticFeedback.heavy()
      }
    }, 2700)
  },

  resetDragRace: () => {
    set({
      dragStage: 'idle',
      dragTimeSlip: null,
      _dragDistanceTraveled: 0,
      _dragTimerStart: null,
      _dragGreenTime: null,
    })
  },

  cancelDragRace: () => {
    set({ dragStage: 'idle' })
  },

  resetPerformanceStats: () => {
    const stopped = get().speed <= 0.3
    set({
      best0to100: null,
      last0to100: null,
      current0to100: null,
      isTiming0to100: false,
      topSpeedRecord: 0,
      _timer0to100State: createInitialZeroToHundredState({ armed: stopped }),
    })
  },

  setNosActive: (active: boolean) => {
    const { hasNosKit, nosPressurePercent, isRunning } = get()
    if (!hasNosKit || nosPressurePercent <= 0 || !isRunning) {
      set({ nosActive: false })
      return
    }
    if (active) {
      HapticFeedback.heavy()
    }
    set({ nosActive: active })
  },

  purgeNos: () => {
    const { hasNosKit, nosPressurePercent } = get()
    if (!hasNosKit || nosPressurePercent <= 0) return
    HapticFeedback.light()
    set((s) => ({
      isNosPurging: true,
      nosPurgeTrigger: Date.now(),
      nosPressurePercent: Math.max(0, s.nosPressurePercent - 3),
    }))
    setTimeout(() => {
      set({ isNosPurging: false })
    }, 600)
  },

  refillNos: () => {
    set({ nosPressurePercent: 100 })
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
    let timer0to100State = state._timer0to100State
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
      latestGear = gear
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

      // 5. VehiclePhysics: calcula forças longitudinais com modificadores de Preparação, Peças e Modos
      const stage = state.tuningStage || 0
      const stageMult = stage === 1 ? 1.25 : stage === 2 ? 1.50 : stage === 3 ? 1.85 : 1.0
      const intakeMult = state.intakeType === 'cold_air' ? 1.06 : 1.0
      const exhaustMult = state.exhaustType === 'straight_pipe' ? 1.08 : state.exhaustType === 'sport' ? 1.04 : 1.0
      const turboKitMult = (!_config.engine.turbo?.enabled && state.hasTurbo) ? 1.45 : 1.0
      const driveModeMult = state.drivingMode === 'track' ? 1.10 : state.drivingMode === 'sport' ? 1.05 : 1.0
      const isNosInjecting = state.nosActive && state.hasNosKit && state.nosPressurePercent > 0 && state.throttle > 0.65 && latestIsRunning
      const nosMult = isNosInjecting ? 1.55 : 1.0
      const totalTorqueMult = stageMult * intakeMult * exhaustMult * turboKitMult * driveModeMult * nosMult

      // Atualiza atrito em tempo de execução com aderência dos pneus e asa ativa
      let targetFriction = state.tires === 'semi_slick' ? 1.22 : 0.95
      if (state.isRaining) {
        targetFriction = state.tires === 'semi_slick' ? 0.52 : 0.62
      }
      if (state.isAeroWingExtended) {
        targetFriction += 0.14
      }
      _physics.setSurfaceFriction(targetFriction)

      const rawBrake = Math.max(state.brake, state.handbrake || gear === -2 ? 1 : 0)
      const effectiveBrake = rawBrake * state.brakeFadeFactor
      const physicsTick = _physics.tick({
        driveTorqueAtTransmission: clutchState.transmittedTorque * totalTorqueMult,
        gearRatio,
        finalDrive,
        brake: effectiveBrake,
        deltaTime: dt,
      })

      const prevSubstepSpeed = latestSpeed
      latestSpeed = gear === -2 ? 0 : physicsTick.speedKmh
      if (gear === -2) {
        _physics.reset()
      }

      const timerStep = stepZeroToHundredTimer(timer0to100State, {
        prevSpeedKmh: prevSubstepSpeed,
        speedKmh: latestSpeed,
        gear,
        throttle: state.throttle,
        brake: state.brake,
        handbrake: state.handbrake,
        isRunning: latestIsRunning,
        deltaTime: dt,
      })
      timer0to100State = timerStep.state
      if (timerStep.isNewBest) {
        // Premiação de R$ 2.500 por bater novo recorde pessoal de 0 a 100 km/h
        useGarageStore.getState().addCredits(2500)
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

    if (state.hasTurbo) {
      const turboCfg = _config.engine.turbo || {
        maxBoostBar: 1.25,
        spoolRpmStart: 1800,
        fullBoostRpm: 2800,
      }
      const stage = state.tuningStage || 0
      const extraBoost = stage === 1 ? 0.35 : stage === 2 ? 0.65 : stage === 3 ? 1.15 : 0.0
      const maxBoost = (turboCfg.maxBoostBar || 1.25) + extraBoost
      const spoolRpm = turboCfg.spoolRpmStart || 1600
      const fullRpm = turboCfg.fullBoostRpm || 2600

      let targetBoost = -0.7 // Vácuo de marcha lenta (-0.7 bar)
      if (latestIsRunning) {
        if (isLaunchArmed) {
          // Anti-lag no Launch Control: 2-step spools turbo to ~65% do boost máximo
          targetBoost = maxBoost * 0.65
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
    } else if (state.hasBoostGaugeKit) {
      // Motor aspirado com manômetro aftermarket: funciona como vacuômetro do coletor
      // (-0.75 bar em marcha lenta/desaceleração até ~-0.05 bar com borboleta toda aberta)
      let targetVacuum = 0
      if (latestIsRunning) {
        targetVacuum = state.throttle < 0.08
          ? -0.75 + clamp((latestRpm - 1000) / 8000, 0, 0.1)
          : -0.7 + state.throttle * 0.65
      }
      currentBoost += (targetVacuum - currentBoost) * clamp(frameTime * 7, 0, 1)
      currentBoost = Math.round(currentBoost * 100) / 100
      peakBoost = 0
    } else {
      currentBoost = 0
      peakBoost = 0
    }

    // ─── Recorde Top Speed ───
    const topSpeed = Math.max(state.topSpeedRecord, Math.round(latestSpeed))

    // ─── 1. Térmica dos Freios, Brilho Incandescente & Brake Fade ───
    let latestBrakeDiscTemp = state.brakeDiscTemp
    const rawBrakeInput = Math.max(state.brake, state.handbrake || latestGear === -2 ? 1 : 0)
    const effectiveBrakeSpeed = Math.max(latestSpeed, state.speed)
    if (rawBrakeInput > 0.05 && effectiveBrakeSpeed > 1) {
      latestBrakeDiscTemp += rawBrakeInput * (effectiveBrakeSpeed / 75) * 80 * frameTime
    }
    const discCooling = ((latestSpeed / 100) * 0.75 + 0.18) * Math.max(0, (latestBrakeDiscTemp - 25) / 100) * 9.0 * frameTime
    latestBrakeDiscTemp = clamp(latestBrakeDiscTemp - discCooling, 25, 950)
    latestBrakeDiscTemp = Math.round(latestBrakeDiscTemp * 10) / 10
    const latestIsBrakeGlowing = latestBrakeDiscTemp >= 500
    const latestBrakeFadeFactor = latestBrakeDiscTemp > 650
      ? clamp(1.0 - ((latestBrakeDiscTemp - 650) / 300) * 0.55, 0.45, 1.0)
      : 1.0

    // ─── 2. Sistema Real de Combustível & Consumo Dinâmico ───
    let latestFuelLevel = state.fuelLevelLiters
    let latestIsOutOfFuel = state.isOutOfFuel
    if (latestIsRunning) {
      const hours = frameTime / 3600
      const fuelMult = state.fuelType === 'ethanol_e100' ? 1.34 : 1.0
      const stage = state.tuningStage || 0
      const stageFuelFactor = stage === 1 ? 1.2 : stage === 2 ? 1.4 : stage === 3 ? 1.8 : 1.0
      const burnPerHour = (0.85 + state.throttle * 22.0 + (latestRpm / _config.engine.maxRpm) * 8.5) * stageFuelFactor * fuelMult
      latestFuelLevel = Math.max(0, latestFuelLevel - burnPerHour * hours)
      latestFuelLevel = Math.round(latestFuelLevel * 1000) / 1000

      if (latestFuelLevel <= 0.005) {
        latestFuelLevel = 0
        latestIsOutOfFuel = true
        latestIsRunning = false
        latestIsStalled = true
        latestStatus = 'stalled'
        _engine.stop()
      }
    }

    // ─── 3. Dinâmica Térmica do Motor & Superaquecimento ───
    let latestCoolantTemp = state.coolantTemp
    let latestOilTemp = state.oilTemp
    let latestIsEngineBlown = state.isEngineBlown
    let latestDamageReason = state.damageReason
    let latestEngineBlownTrigger = state.engineBlownTrigger

    if (latestIsRunning) {
      const stage = state.tuningStage || 0
      const stageHeatMult = stage === 1 ? 1.25 : stage === 2 ? 1.5 : stage === 3 ? 1.85 : 1.0
      const fuelHeatFactor = state.fuelType === 'ethanol_e100' ? 0.90 : 1.0
      const heatGenerated = (state.throttle * 0.70 + (latestRpm / _config.engine.maxRpm) * 0.50) * stageHeatMult * fuelHeatFactor * 8.2 * frameTime
      const radFan = latestCoolantTemp > 92 ? 0.45 : 0.15
      const radCooling = ((latestSpeed / 110) + radFan) * Math.max(0, (latestCoolantTemp - 25) / 70) * 7.2 * frameTime

      latestCoolantTemp = clamp(latestCoolantTemp + heatGenerated - radCooling, 25, 140)
      latestOilTemp += (latestCoolantTemp * 1.04 - latestOilTemp) * clamp(frameTime * 0.8, 0, 1)
    } else {
      latestCoolantTemp = Math.max(25, latestCoolantTemp - 1.2 * frameTime)
      latestOilTemp = Math.max(25, latestOilTemp - 1.0 * frameTime)
    }

    // Detecção universal de superaquecimento crítico (>125°C)
    if (latestCoolantTemp >= 125 && !latestIsEngineBlown) {
      latestIsEngineBlown = true
      latestDamageReason = 'Superaquecimento (>125°C): Junta Queimada!'
      latestIsRunning = false
      latestIsStalled = true
      latestStatus = 'stalled'
      latestEngineBlownTrigger = Date.now()
      _engine.stop()
      HapticFeedback.heavy()
    }

    latestCoolantTemp = Math.round(latestCoolantTemp * 10) / 10
    latestOilTemp = Math.round(latestOilTemp * 10) / 10

    // ─── 4. Burnout & Fumaça Densa de Pneus ───
    let isBurningOut = false
    let latestSmoke = state.tireSmokeDensity
    const isHoldBrake = state.brake > 0.35 || state.handbrake
    const isBurnoutThrottle = state.throttle > 0.60 && latestRpm > 2600
    const isForwardOrReverse = latestGear === 1 || latestGear === -1 || (state.transmissionMode === 'automatic' && latestGear === 1)

    if (latestIsRunning && isHoldBrake && isBurnoutThrottle && isForwardOrReverse && latestSpeed < 18) {
      isBurningOut = true
      latestSmoke = clamp(latestSmoke + frameTime * 1.8, 0, 1.0)
    } else {
      isBurningOut = false
      latestSmoke = clamp(latestSmoke - frameTime * 0.85, 0, 1.0)
    }

    // ─── 5. Pista de Arrancada 402m (Drag Strip) ───
    let latestDragStage = state.dragStage
    let latestTimeSlip = state.dragTimeSlip ? { ...state.dragTimeSlip } : null
    let dragDistance = state._dragDistanceTraveled
    let dragTimerStart = state._dragTimerStart
    const currentMoveSpeed = Math.max(latestSpeed, state.speed)

    if (
      (latestDragStage === 'pre_stage' ||
        latestDragStage === 'staged' ||
        latestDragStage === 'yellow_1' ||
        latestDragStage === 'yellow_2' ||
        latestDragStage === 'yellow_3') &&
      (currentMoveSpeed > 1.8 || dragDistance > 0.25)
    ) {
      latestDragStage = 'false_start'
      latestTimeSlip = {
        reactionTime: 0,
        time60ft: 0,
        time0to100: 0,
        time201m: 0,
        time402m: 0,
        trapSpeedKmh: Math.round(currentMoveSpeed),
        isDisqualified: true,
        createdAt: Date.now(),
      }
    } else if (latestDragStage === 'green') {
      if (currentMoveSpeed > 0.6 || dragDistance > 0.1) {
        const greenTime = state._dragGreenTime || (performance.now() - 250)
        const reaction = Math.max(0.001, Math.round((performance.now() - greenTime)) / 1000)
        latestDragStage = 'racing'
        dragTimerStart = performance.now()
        dragDistance = Math.max(0, dragDistance)
        latestTimeSlip = {
          reactionTime: reaction,
          time60ft: 0,
          time0to100: 0,
          time201m: 0,
          time402m: 0,
          trapSpeedKmh: 0,
          isDisqualified: false,
          createdAt: Date.now(),
        }
      }
    } else if (latestDragStage === 'racing' && dragTimerStart && latestTimeSlip) {
      dragDistance += (currentMoveSpeed / 3.6) * frameTime
      const elapsed = Math.round(((performance.now() - dragTimerStart) / 1000) * 1000) / 1000

      if (dragDistance >= 18.288 && latestTimeSlip.time60ft === 0) {
        latestTimeSlip.time60ft = elapsed
      }
      if (currentMoveSpeed >= 100 && latestTimeSlip.time0to100 === 0) {
        latestTimeSlip.time0to100 = elapsed
      }
      if (dragDistance >= 201.168 && latestTimeSlip.time201m === 0) {
        latestTimeSlip.time201m = elapsed
      }
      if (dragDistance >= 402.336) {
        latestTimeSlip.time402m = elapsed
        latestTimeSlip.trapSpeedKmh = Math.round(currentMoveSpeed)
        latestDragStage = 'finished'
        HapticFeedback.heavy()

        // Cálculo de Recompensa em Dinheiro na Arrancada 402m
        if (!latestTimeSlip.isDisqualified) {
          let prize = 3000
          const breakdown: string[] = ['Premiação base 402m: +R$ 3.000']
          if (latestTimeSlip.reactionTime < 0.100) {
            prize += 5000
            breakdown.push('Reação perfeita (<0.100s): +R$ 5.000')
          } else if (latestTimeSlip.reactionTime < 0.250) {
            prize += 2000
            breakdown.push('Reação rápida (<0.250s): +R$ 2.000')
          }
          if (latestTimeSlip.trapSpeedKmh >= 200) {
            prize += 3000
            breakdown.push('Trap Speed > 200 km/h: +R$ 3.000')
          } else if (latestTimeSlip.trapSpeedKmh >= 160) {
            prize += 1500
            breakdown.push('Trap Speed > 160 km/h: +R$ 1.500')
          }
          latestTimeSlip.reward = prize
          latestTimeSlip.rewardBreakdown = breakdown
          useGarageStore.getState().addCredits(prize)
        }
      }
    }

    // ─── 6. Kit de Óxido Nitroso (NOS) & Consumo de Pressão ───
    let latestNosPressure = state.nosPressurePercent
    let latestNosActive = state.nosActive
    if (state.hasNosKit && state.nosActive && state.throttle > 0.60 && latestIsRunning && latestNosPressure > 0) {
      latestNosPressure = Math.max(0, latestNosPressure - frameTime * 12.5)
      if (latestNosPressure <= 0) {
        latestNosActive = false
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
      best0to100: timer0to100State.bestCompleted,
      last0to100: timer0to100State.lastCompleted,
      current0to100: timer0to100State.currentDisplay,
      isTiming0to100: timer0to100State.isTiming,
      topSpeedRecord: topSpeed,
      _timer0to100State: timer0to100State,
      _accumulator: accumulator,

      // Novos Estados de Realismo
      fuelLevelLiters: latestFuelLevel,
      isOutOfFuel: latestIsOutOfFuel,
      coolantTemp: latestCoolantTemp,
      oilTemp: latestOilTemp,
      isEngineBlown: latestIsEngineBlown,
      damageReason: latestDamageReason,
      engineBlownTrigger: latestEngineBlownTrigger,
      brakeDiscTemp: latestBrakeDiscTemp,
      isBrakeGlowing: latestIsBrakeGlowing,
      brakeFadeFactor: latestBrakeFadeFactor,
      isBurningOut,
      tireSmokeDensity: latestSmoke,
      nosPressurePercent: latestNosPressure,
      nosActive: latestNosActive,
      dragStage: latestDragStage,
      dragTimeSlip: latestTimeSlip,
      _dragDistanceTraveled: dragDistance,
      _dragTimerStart: dragTimerStart,
    })
  },

  reset: () => {
    const isManual = !get().isAutomaticVehicle
    const supported = get()._config?.transmission.supportedSelectorPositions ?? []
    const defaultSelector = isManual
      ? (supported.includes('N') ? 'N' : (supported[0] ?? 'N'))
      : (supported.includes('P') ? 'P' : (supported[0] ?? 'N'))
    set({
      rpm: 0,
      isRunning: false,
      isStalled: false,
      isBogWarning: false,
      status: 'off',
      isRevLimiting: false,
      currentGear: isManual ? 0 : -2,
      // Peças & Customizações Equipadas da Loja
      hasRetrofitInfotainment: false,
      hasBoostGaugeKit: false,
      garageInstanceId: null,
      exhaustType: 'stock',
      exhaustValveOpen: false,
      intakeType: 'stock',
      tires: 'street',
      isAeroWingExtended: false,

      clutchPosition: 0,
      transmissionMode: isManual ? 'manual' : 'automatic',
      drivingMode: 'normal',
      isKickdown: false,
      lastShiftReason: 'none',
      gearSelectorPosition: defaultSelector,
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
      throttleLock: false,
      brake: 0,
      handbrake: false,
      isHornActive: false,
      isLaunchControlArmed: false,
      isLaunching: false,
      boostPressureBar: 0,
      peakBoostBar: 0,
      isTiming0to100: false,
      last0to100: null,
      current0to100: null,
      _timer0to100State: createInitialZeroToHundredState(),
      fuelLevelLiters: 45,
      isOutOfFuel: false,
      coolantTemp: 88,
      oilTemp: 92,
      isEngineBlown: false,
      damageReason: null,
      engineBlownTrigger: 0,
      brakeDiscTemp: 60,
      isBrakeGlowing: false,
      brakeFadeFactor: 1.0,
      isBurningOut: false,
      tireSmokeDensity: 0,
      windowsOpen: false,
      shifterLayout: isManual ? 'h_pattern' : 'sequential',
      isGearGrinding: false,
      gearGrindTrigger: 0,
      dragStage: 'idle',
      dragTimeSlip: null,
      _dragDistanceTraveled: 0,
      _dragTimerStart: null,
      _dragGreenTime: null,
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
