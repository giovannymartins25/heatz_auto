import { create } from 'zustand'
import type { VehicleConfig, DrivingMode } from '@/types'
import { getVehicleCapabilities } from '@/types'
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
import { useUIStore } from './useUIStore'
import { performanceMonitor } from '@/utils/performanceMonitor'

/**
 * Estado físico autoritativo desacoplado das publicações visuais do Zustand.
 * Permite que todos os subsistemas integrem a 120 Hz sem perda nem quantização
 * mesmo quando a UI recebe snapshots em 35 Hz (ECO), 60 Hz (NORMAL) ou ~6.6 Hz (telemetria lenta).
 */
export interface PhysicsInternalState {
  boostPressureBar: number
  peakBoostBar: number
  brakeDiscTemp: number
  brakeFadeFactor: number
  isBrakeGlowing: boolean
  fuelLevelLiters: number
  isOutOfFuel: boolean
  coolantTemp: number
  oilTemp: number
  isRadiatorFanOn: boolean
  isEngineBlown: boolean
  damageReason: string | null
  engineBlownTrigger: number
  isBurningOut: boolean
  tireSmokeDensity: number
  nosPressurePercent: number
  nosActive: boolean
  dragStage: DragTreeStage
  dragTimeSlip: DragTimeSlip | null
  dragDistanceTraveled: number
  dragTimerStart: number | null
  dragElapsedSeconds: number
  dragGreenSimMs: number | null
  speedKmh: number
  rpm: number
  gear: number
  isRunning: boolean
  isStalled: boolean
  isBogWarning: boolean
  status: EngineStatus
  isRevLimiting: boolean
  isKickdown: boolean
  tcsIntervening: boolean
  tcsInterventionLevel: number
  clutchSlipRpm: number
  clutchSlipRatio: number
  clutchTorqueTransfer: number
  clutchHeat: number
  isClutchSlipping: boolean
  isLaunchControlArmed: boolean
  isLaunching: boolean
  topSpeedRecord: number

  // Acumuladores determinísticos de tempo simulado e contadores de publicação
  elapsedSimMs: number
  lastVisualUpdateMs: number
  lastSlowUpdateMs: number
  pendingSlowPublish: boolean
  visualUpdatesCount: number
  skippedVisualUpdatesCount: number
  slowUpdatesCount: number
  skippedSlowUpdatesCount: number

  // Sentinelas do último snapshot publicado na store (detectam setState externo)
  lastPubBoost: number
  lastPubPeakBoost: number
  lastPubBrakeDiscTemp: number
  lastPubBrakeFadeFactor: number
  lastPubFuelLevelLiters: number
  lastPubIsOutOfFuel: boolean
  lastPubCoolantTemp: number
  lastPubOilTemp: number
  lastPubIsEngineBlown: boolean
  lastPubNosPressurePercent: number
  lastPubNosActive: boolean
  lastPubDragStage: DragTreeStage
  lastPubDragDistance: number
  lastPubDragTimerStart: number | null
  lastPubSpeedKmh: number
  lastPubTopSpeedRecord: number
}

function createInitialPhysicsInternalState(
  overrides: Partial<PhysicsInternalState> = {},
): PhysicsInternalState {
  const boostPressureBar = overrides.boostPressureBar ?? 0
  const peakBoostBar = overrides.peakBoostBar ?? 0
  const brakeDiscTemp = overrides.brakeDiscTemp ?? 60
  const brakeFadeFactor = overrides.brakeFadeFactor ?? 1.0
  const fuelLevelLiters = overrides.fuelLevelLiters ?? 45
  const isOutOfFuel = overrides.isOutOfFuel ?? false
  const coolantTemp = overrides.coolantTemp ?? 88
  const oilTemp = overrides.oilTemp ?? 92
  const isRadiatorFanOn = overrides.isRadiatorFanOn ?? false
  const isEngineBlown = overrides.isEngineBlown ?? false
  const nosPressurePercent = overrides.nosPressurePercent ?? 100
  const nosActive = overrides.nosActive ?? false
  const dragStage = overrides.dragStage ?? 'idle'
  const dragDistanceTraveled = overrides.dragDistanceTraveled ?? 0
  const dragTimerStart = overrides.dragTimerStart ?? null
  const speedKmh = overrides.speedKmh ?? 0
  const topSpeedRecord = overrides.topSpeedRecord ?? 0

  return {
    boostPressureBar,
    peakBoostBar,
    brakeDiscTemp,
    brakeFadeFactor,
    isBrakeGlowing: brakeDiscTemp >= 500,
    fuelLevelLiters,
    isOutOfFuel,
    coolantTemp,
    oilTemp,
    isRadiatorFanOn,
    isEngineBlown,
    damageReason: overrides.damageReason ?? null,
    engineBlownTrigger: overrides.engineBlownTrigger ?? 0,
    isBurningOut: false,
    tireSmokeDensity: 0,
    nosPressurePercent,
    nosActive,
    dragStage,
    dragTimeSlip: null,
    dragDistanceTraveled,
    dragTimerStart,
    dragElapsedSeconds: 0,
    dragGreenSimMs: null,
    speedKmh,
    rpm: 0,
    gear: 0,
    isRunning: false,
    isStalled: false,
    isBogWarning: false,
    status: 'off',
    isRevLimiting: false,
    isKickdown: false,
    tcsIntervening: false,
    tcsInterventionLevel: 0,
    clutchSlipRpm: 0,
    clutchSlipRatio: 0,
    clutchTorqueTransfer: 0,
    clutchHeat: 0,
    isClutchSlipping: false,
    isLaunchControlArmed: false,
    isLaunching: false,
    topSpeedRecord,

    elapsedSimMs: 0,
    lastVisualUpdateMs: 0,
    lastSlowUpdateMs: 0,
    pendingSlowPublish: false,
    visualUpdatesCount: 0,
    skippedVisualUpdatesCount: 0,
    slowUpdatesCount: 0,
    skippedSlowUpdatesCount: 0,

    lastPubBoost: boostPressureBar,
    lastPubPeakBoost: peakBoostBar,
    lastPubBrakeDiscTemp: brakeDiscTemp,
    lastPubBrakeFadeFactor: brakeFadeFactor,
    lastPubFuelLevelLiters: fuelLevelLiters,
    lastPubIsOutOfFuel: isOutOfFuel,
    lastPubCoolantTemp: coolantTemp,
    lastPubOilTemp: oilTemp,
    lastPubIsEngineBlown: isEngineBlown,
    lastPubNosPressurePercent: nosPressurePercent,
    lastPubNosActive: nosActive,
    lastPubDragStage: dragStage,
    lastPubDragDistance: dragDistanceTraveled,
    lastPubDragTimerStart: dragTimerStart,
    lastPubSpeedKmh: speedKmh,
    lastPubTopSpeedRecord: topSpeedRecord,

    ...overrides,
  }
}


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
  isRadiatorFanOn: boolean
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
  _phys: PhysicsInternalState
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
  isRadiatorFanOn: false,
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
  _phys: createInitialPhysicsInternalState(),

  init: (config: VehicleConfig, initialUpgrades?: Partial<CarUpgrades>, garageInstanceId?: string | null) => {
    const caps = getVehicleCapabilities(config)
    const isAutoOrCvt =
      caps.transmissionType === 'automatic' ||
      caps.transmissionType === 'cvt' ||
      caps.transmissionType === 'dct' ||
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
    const defaultDriveMode: DrivingMode = caps.defaultDrivingMode

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
      fuelType: initialUpgrades?.fuelType || ((config.id === 'gol-quadrado' || config.id === 'gol-quadrado-turbo') ? 'ethanol_e100' : 'common_gasoline'),
      fuelLevelLiters: 45,
      fuelCapacityLiters: 50,
      isOutOfFuel: false,
      coolantTemp: 88,
      oilTemp: 92,
      isRadiatorFanOn: false,
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
      _phys: createInitialPhysicsInternalState({ gear: isAutoOrCvt ? -2 : 0 }),
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

    const startedRunning = _engine.getIsRunning()
    const startedStatus = _engine.getStatus()
    const startedRpm = _engine.getRpm()
    const startedGear = _transmission?.currentGear ?? 0
    const phys = get()._phys
    phys.isRunning = startedRunning
    phys.isStalled = false
    phys.status = startedStatus
    phys.rpm = startedRpm
    phys.gear = startedGear
    phys.damageReason = null

    set({
      isRunning: startedRunning,
      isStalled: false,
      status: startedStatus,
      rpm: startedRpm,
      currentGear: startedGear,
      damageReason: null,
    })
  },

  stopEngine: () => {
    const { _engine, _transmission, transmissionMode, _phys } = get()
    if (!_engine) return

    _engine.stop()
    if (transmissionMode === 'manual') {
      _transmission?.reset()
    }
    _phys.isRunning = false
    _phys.isStalled = false
    _phys.status = 'off'
    _phys.rpm = 0
    _phys.isKickdown = false
    _phys.tcsIntervening = false
    _phys.tcsInterventionLevel = 0
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
    const { _config, gearSelectorPosition } = get()
    if (_config) {
      const caps = getVehicleCapabilities(_config)
      const allowed = caps.supportedDrivingModes.length > 0 ? caps.supportedDrivingModes : ['normal']
      if (!allowed.includes(mode)) {
        return
      }
    }

    // Seletor S + modo ECO bloqueado: seletor retorna para D ao entrar em ECO
    if (mode === 'eco' && gearSelectorPosition === 'S') {
      set({ drivingMode: mode, gearSelectorPosition: 'D' })
    } else {
      set({ drivingMode: mode })
    }
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
        // Seletor físico S: não força drivingMode='sport' (D e S são posições físicas independentes).
        // Se estiver em ECO, comuta para NORMAL para impedir o conflito S + ECO.
        const currentMode = get().drivingMode
        const nextMode = currentMode === 'eco' ? 'normal' : currentMode
        set({
          currentGear: targetGear,
          gearSelectorPosition: 'S',
          transmissionMode: 'automatic',
          drivingMode: nextMode,
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
  selectDrive: () => {
    const { _config, isAutomaticVehicle } = get()
    if (isAutomaticVehicle && _config) {
      const caps = getVehicleCapabilities(_config)
      if (caps.supportedDrivingModes.includes('normal')) {
        set({ drivingMode: 'normal' })
      }
    }
    get().selectShifterMode('D')
  },
  selectSport: () => {
    const { _config, isAutomaticVehicle } = get()
    if (!isAutomaticVehicle || !_config) return
    const caps = getVehicleCapabilities(_config)
    if (caps.supportedDrivingModes.includes('sport')) {
      set({ drivingMode: 'sport' })
    }
    get().selectShifterMode('S')
  },
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
    set((s) => {
      const nextFuel = Math.min(s.fuelCapacityLiters, s._phys.fuelLevelLiters + (liters ?? s.fuelCapacityLiters))
      const nextDamageReason = s.damageReason === 'Pane Seca: Sem combustível!' ? null : s.damageReason
      const publishedFuel = Math.round(nextFuel * 1000) / 1000
      return {
        fuelLevelLiters: publishedFuel,
        isOutOfFuel: false,
        damageReason: nextDamageReason,
        _phys: {
          ...s._phys,
          fuelLevelLiters: nextFuel,
          lastPubFuelLevelLiters: publishedFuel,
          isOutOfFuel: false,
          lastPubIsOutOfFuel: false,
          damageReason: nextDamageReason,
        },
      }
    })
    HapticFeedback.medium()
  },

  setFuelType: (type: FuelType) => {
    set({ fuelType: type })
    HapticFeedback.light()
  },

  repairEngine: () => {
    set((s) => {
      const nextFuel = Math.max(s._phys.fuelLevelLiters, 15)
      const publishedFuel = Math.round(nextFuel * 1000) / 1000
      return {
        isEngineBlown: false,
        damageReason: null,
        coolantTemp: 88,
        oilTemp: 92,
        brakeDiscTemp: 60,
        brakeFadeFactor: 1.0,
        isBrakeGlowing: false,
        isOutOfFuel: false,
        fuelLevelLiters: publishedFuel,
        _phys: {
          ...s._phys,
          isEngineBlown: false,
          lastPubIsEngineBlown: false,
          damageReason: null,
          coolantTemp: 88,
          lastPubCoolantTemp: 88,
          oilTemp: 92,
          lastPubOilTemp: 92,
          brakeDiscTemp: 60,
          lastPubBrakeDiscTemp: 60,
          brakeFadeFactor: 1.0,
          lastPubBrakeFadeFactor: 1.0,
          isBrakeGlowing: false,
          isOutOfFuel: false,
          lastPubIsOutOfFuel: false,
          fuelLevelLiters: nextFuel,
          lastPubFuelLevelLiters: publishedFuel,
        },
      }
    })
    HapticFeedback.medium()
  },

  startDragRace: () => {
    const { _physics, _engine } = get()
    _physics?.reset()
    if (_engine) _engine.setRpm(1000)
    set((s) => ({
      dragStage: 'pre_stage',
      dragTimeSlip: null,
      _dragDistanceTraveled: 0,
      _dragTimerStart: null,
      _dragGreenTime: null,
      _phys: {
        ...s._phys,
        dragStage: 'pre_stage',
        lastPubDragStage: 'pre_stage',
        dragTimeSlip: null,
        dragDistanceTraveled: 0,
        lastPubDragDistance: 0,
        dragTimerStart: null,
        lastPubDragTimerStart: null,
        dragElapsedSeconds: 0,
        dragGreenSimMs: null,
        speedKmh: 0,
        lastPubSpeedKmh: s.speed,
        rpm: _engine ? 1000 : s._phys.rpm,
      },
    }))
    HapticFeedback.light()

    // Sequência Árvore de Natal NHRA Drag Strip
    setTimeout(() => {
      if (get().dragStage === 'pre_stage') set((s) => ({
        dragStage: 'staged',
        _phys: { ...s._phys, dragStage: 'staged', lastPubDragStage: 'staged' },
      }))
    }, 600)
    setTimeout(() => {
      if (get().dragStage === 'staged') set((s) => ({
        dragStage: 'yellow_1',
        _phys: { ...s._phys, dragStage: 'yellow_1', lastPubDragStage: 'yellow_1' },
      }))
    }, 1200)
    setTimeout(() => {
      if (get().dragStage === 'yellow_1') set((s) => ({
        dragStage: 'yellow_2',
        _phys: { ...s._phys, dragStage: 'yellow_2', lastPubDragStage: 'yellow_2' },
      }))
    }, 1700)
    setTimeout(() => {
      if (get().dragStage === 'yellow_2') set((s) => ({
        dragStage: 'yellow_3',
        _phys: { ...s._phys, dragStage: 'yellow_3', lastPubDragStage: 'yellow_3' },
      }))
    }, 2200)
    setTimeout(() => {
      if (get().dragStage === 'yellow_3') {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
        set((s) => ({
          dragStage: 'green',
          _dragGreenTime: now,
          _phys: {
            ...s._phys,
            dragStage: 'green',
            lastPubDragStage: 'green',
            dragGreenSimMs: s._phys.elapsedSimMs,
          },
        }))
        HapticFeedback.heavy()
      }
    }, 2700)
  },

  resetDragRace: () => {
    set((s) => ({
      dragStage: 'idle',
      dragTimeSlip: null,
      _dragDistanceTraveled: 0,
      _dragTimerStart: null,
      _dragGreenTime: null,
      _phys: {
        ...s._phys,
        dragStage: 'idle',
        lastPubDragStage: 'idle',
        dragTimeSlip: null,
        dragDistanceTraveled: 0,
        lastPubDragDistance: 0,
        dragTimerStart: null,
        lastPubDragTimerStart: null,
        dragElapsedSeconds: 0,
        dragGreenSimMs: null,
      },
    }))
  },

  cancelDragRace: () => {
    set((s) => ({
      dragStage: 'idle',
      _phys: {
        ...s._phys,
        dragStage: 'idle',
        lastPubDragStage: 'idle',
      },
    }))
  },

  resetPerformanceStats: () => {
    const stopped = get()._phys.speedKmh <= 0.3 && get().speed <= 0.3
    set((s) => ({
      best0to100: null,
      last0to100: null,
      current0to100: null,
      isTiming0to100: false,
      topSpeedRecord: 0,
      _timer0to100State: createInitialZeroToHundredState({ armed: stopped }),
      _phys: {
        ...s._phys,
        topSpeedRecord: 0,
        lastPubTopSpeedRecord: 0,
      },
    }))
  },

  setNosActive: (active: boolean) => {
    const { hasNosKit, _phys, isRunning } = get()
    if (!hasNosKit || _phys.nosPressurePercent <= 0 || !isRunning) {
      set((s) => ({
        nosActive: false,
        _phys: {
          ...s._phys,
          nosActive: false,
          lastPubNosActive: false,
        },
      }))
      return
    }
    if (active) {
      HapticFeedback.heavy()
    }
    set((s) => ({
      nosActive: active,
      _phys: {
        ...s._phys,
        nosActive: active,
        lastPubNosActive: active,
      },
    }))
  },

  purgeNos: () => {
    const { hasNosKit, _phys } = get()
    if (!hasNosKit || _phys.nosPressurePercent <= 0) return
    HapticFeedback.light()
    set((s) => {
      const nextPressure = Math.max(0, s._phys.nosPressurePercent - 3)
      const pubPressure = Math.round(nextPressure * 10) / 10
      return {
        isNosPurging: true,
        nosPurgeTrigger: Date.now(),
        nosPressurePercent: pubPressure,
        _phys: {
          ...s._phys,
          nosPressurePercent: nextPressure,
          lastPubNosPressurePercent: pubPressure,
        },
      }
    })
    setTimeout(() => {
      set({ isNosPurging: false })
    }, 600)
  },

  refillNos: () => {
    set((s) => ({
      nosPressurePercent: 100,
      _phys: {
        ...s._phys,
        nosPressurePercent: 100,
        lastPubNosPressurePercent: 100,
      },
    }))
  },

  update: (frameTime: number) => {
    const state = get()
    const { _engine, _transmission, _autoTransmission, _clutch, _physics, _tcs, _config } = state

    if (!_engine || !_transmission || !_clutch || !_physics || !_config) return

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const phys: PhysicsInternalState = { ...state._phys }

    // Sincroniza eventuais injeções externas via useSimulationStore.setState()
    if (state.boostPressureBar !== phys.lastPubBoost) {
      phys.boostPressureBar = state.boostPressureBar
      phys.lastPubBoost = state.boostPressureBar
    }
    if (state.peakBoostBar !== phys.lastPubPeakBoost) {
      phys.peakBoostBar = state.peakBoostBar
      phys.lastPubPeakBoost = state.peakBoostBar
    }
    if (state.brakeDiscTemp !== phys.lastPubBrakeDiscTemp) {
      phys.brakeDiscTemp = state.brakeDiscTemp
      phys.isBrakeGlowing = state.brakeDiscTemp >= 500
      phys.lastPubBrakeDiscTemp = state.brakeDiscTemp
    }
    if (state.brakeFadeFactor !== phys.lastPubBrakeFadeFactor) {
      phys.brakeFadeFactor = state.brakeFadeFactor
      phys.lastPubBrakeFadeFactor = state.brakeFadeFactor
    }
    if (state.fuelLevelLiters !== phys.lastPubFuelLevelLiters) {
      phys.fuelLevelLiters = state.fuelLevelLiters
      phys.lastPubFuelLevelLiters = state.fuelLevelLiters
    }
    if (state.isOutOfFuel !== phys.lastPubIsOutOfFuel) {
      phys.isOutOfFuel = state.isOutOfFuel
      phys.lastPubIsOutOfFuel = state.isOutOfFuel
    }
    if (state.coolantTemp !== phys.lastPubCoolantTemp) {
      phys.coolantTemp = state.coolantTemp
      phys.lastPubCoolantTemp = state.coolantTemp
    }
    if (state.oilTemp !== phys.lastPubOilTemp) {
      phys.oilTemp = state.oilTemp
      phys.lastPubOilTemp = state.oilTemp
    }
    if (state.isEngineBlown !== phys.lastPubIsEngineBlown) {
      phys.isEngineBlown = state.isEngineBlown
      phys.damageReason = state.damageReason
      phys.engineBlownTrigger = state.engineBlownTrigger
      phys.lastPubIsEngineBlown = state.isEngineBlown
    }
    if (state.nosPressurePercent !== phys.lastPubNosPressurePercent) {
      phys.nosPressurePercent = state.nosPressurePercent
      phys.lastPubNosPressurePercent = state.nosPressurePercent
    }
    if (state.nosActive !== phys.lastPubNosActive) {
      phys.nosActive = state.nosActive
      phys.lastPubNosActive = state.nosActive
    }
    if (state.dragStage !== phys.lastPubDragStage) {
      phys.dragStage = state.dragStage
      phys.dragTimeSlip = state.dragTimeSlip ? { ...state.dragTimeSlip } : null
      phys.lastPubDragStage = state.dragStage
      if (state.dragStage === 'green' && phys.dragGreenSimMs === null) {
        phys.dragGreenSimMs = phys.elapsedSimMs
      }
    }
    if (state._dragDistanceTraveled !== phys.lastPubDragDistance) {
      phys.dragDistanceTraveled = state._dragDistanceTraveled
      phys.lastPubDragDistance = state._dragDistanceTraveled
    }
    if (state._dragTimerStart !== phys.lastPubDragTimerStart) {
      phys.dragTimerStart = state._dragTimerStart
      phys.lastPubDragTimerStart = state._dragTimerStart
    }
    const injectedSpeedFloor = state.speed !== phys.lastPubSpeedKmh ? state.speed : 0
    if (state.speed !== phys.lastPubSpeedKmh) {
      phys.speedKmh = state.speed
      phys.lastPubSpeedKmh = state.speed
    }
    if (state.topSpeedRecord !== phys.lastPubTopSpeedRecord) {
      phys.topSpeedRecord = state.topSpeedRecord
      phys.lastPubTopSpeedRecord = state.topSpeedRecord
    }

    const prevRevLimiting = phys.isRevLimiting
    let accumulator = state._accumulator + frameTime
    let timer0to100State = state._timer0to100State
    let substeps = 0

    phys.rpm = _engine.getRpm()
    phys.gear = _transmission.currentGear
    phys.isRunning = _engine.getIsRunning()

    // ─── Launch Control Lógica de Armação / Disparo ───
    const canLaunch = state.hasLaunchControl && phys.isRunning && !state.handbrake
    const isStationary = phys.speedKmh < 3.5
    const isLaunchGear = phys.gear === 1 || (state.transmissionMode === 'automatic' && phys.gear === 1)

    // Armar: parado em 1ª ou D, freio firme (>= 0.60) e acelerador a fundo (>= 0.65)
    if (canLaunch && isStationary && isLaunchGear && state.brake >= 0.60 && state.throttle >= 0.65) {
      phys.isLaunchControlArmed = true
      phys.isLaunching = false
    } else if (phys.isLaunchControlArmed && state.brake < 0.25 && state.throttle >= 0.50) {
      // Piloto soltou o freio com o pé no fundo -> DISPARO / LARGADA!
      phys.isLaunchControlArmed = false
      phys.isLaunching = true
    } else if (phys.isLaunchControlArmed && (state.throttle < 0.40 || phys.gear === 0 || state.handbrake)) {
      // Cancelou se tirou o pé do acelerador, botou no neutro ou puxou freio de mão
      phys.isLaunchControlArmed = false
      phys.isLaunching = false
    }

    if (phys.isLaunching && (phys.speedKmh > 45 || state.throttle < 0.3 || phys.gear > 1)) {
      phys.isLaunching = false
    }

    const maxSubsteps = Math.max(MAX_SUBSTEPS, 12)
    while (accumulator >= PHYSICS_TIMESTEP && substeps < maxSubsteps) {
      const dt = PHYSICS_TIMESTEP
      performanceMonitor.recordPhysicsTick()

      // ─── 1. Tomada de Decisão da Transmissão ───
      if (state.transmissionMode === 'automatic' && _autoTransmission) {
        if (phys.isLaunchControlArmed) {
          // Com Launch Control armado no automático, segura a embreagem desacoplada
          _clutch.setPosition(0.95)
          phys.isKickdown = false
        } else if (phys.isLaunching) {
          // No disparo da largada, joga torque total imediato
          _clutch.setPosition(0.0)
          phys.isKickdown = true
        } else {
          // AUTO convencional
          const autoDecision = _autoTransmission.decide({
            currentRpm: _engine.getRpm(),
            vehicleSpeedKmh: _physics.getSpeedKmh(),
            throttle: state.throttle,
            brake: state.brake,
            currentGear: _transmission.currentGear,
            drivingMode: state.drivingMode,
            selectorPosition: state.gearSelectorPosition,
            maxPowerRpm: _config.engine.maxPowerRpm,
            maxTorqueRpm: _config.engine.maxTorqueRpm,
            deltaTime: dt,
          })

          phys.isKickdown = autoDecision.isKickdown

          if (autoDecision.targetGear !== _transmission.currentGear) {
            _transmission.shiftTo(autoDecision.targetGear, _physics.getSpeedKmh())
            phys.gear = autoDecision.targetGear
          }

          const autoClutchPosition = 1.0 - autoDecision.targetClutchEngagement
          _clutch.setPosition(autoClutchPosition)
        }
      } else if (state.transmissionMode === 'manual_simulated') {
        // MANUAL_SIMULATED: jogador escolheu a relação.
        // CVT continua gerenciando a embreagem para evitar estol.
        const speedKmh = _physics.getSpeedKmh()
        const currentRpm = _engine.getRpm()

        let targetClutchEngagement = 1.0
        if (speedKmh < 3 && state.throttle < 0.05 && state.brake > 0.1) {
          targetClutchEngagement = 0.0
        } else if (speedKmh < 8 || currentRpm < _config.engine.idleRpm * 1.18) {
          const idleRpm = _config.engine.idleRpm
          const targetLaunchRpm = Math.max(idleRpm + 800, 1900)
          const rpmRatio = clamp((currentRpm - idleRpm) / (targetLaunchRpm - idleRpm), 0, 1)
          const speedRatio = clamp(speedKmh / 14, 0, 1)
          targetClutchEngagement = clamp(
            Math.pow(rpmRatio, 2.2) * 0.60 + speedRatio * 0.40,
            0.05,
            0.98,
          )
        }

        _clutch.setPosition(1.0 - targetClutchEngagement)
        phys.isKickdown = false
      } else {
        // MANUAL convencional: embreagem controlada pelo jogador
        phys.isKickdown = false
      }

      const gear = _transmission.currentGear
      phys.gear = gear
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

      const effectiveSubstepThrottle = phys.isLaunchControlArmed
        ? Math.min(state.throttle, 0.45)
        : state.throttle

      // 3. ClutchSystem: torque de atrito transferido e carga sobre o motor
      const clutchState = _clutch.calculateTorqueTransfer(
        _engine.getAngularVelocity(),
        transInputAngVel,
        isInNeutral,
        _engine.getDrivetrainTorque(effectiveSubstepThrottle),
        dt,
      )

      // 4. EngineSimulator: processa o tick com o torque de CARGA da embreagem sobre o volante
      const engineTick = _engine.tick({
        throttle: effectiveSubstepThrottle,
        loadTorque: clutchState.loadTorqueOnEngine,
        deltaTime: dt,
      })

      phys.rpm = engineTick.rpm
      phys.isRevLimiting = engineTick.isRevLimiting
      phys.isRunning = _engine.getIsRunning()
      phys.isStalled = engineTick.isStalled
      phys.isBogWarning = engineTick.isBogWarning
      phys.status = engineTick.status

      // Se o Launch Control estiver armado, fixa o RPM de corte de largada
      if (phys.isLaunchControlArmed) {
        const launchRpm = _config.transmission.launchControl?.launchRpm || (_config.id === 'porsche-gt3' ? 4500 : 3800)
        if (_engine.getRpm() > launchRpm) {
          _engine.setRpm(launchRpm)
          phys.rpm = launchRpm
        }
      }

      // Telemetria da embreagem
      phys.clutchSlipRpm = clutchState.slipRpm
      phys.clutchSlipRatio = clutchState.slipRatio
      phys.clutchTorqueTransfer = clutchState.transmittedTorque
      phys.clutchHeat = clutchState.heat
      phys.isClutchSlipping = clutchState.isSlipping

      // 5. VehiclePhysics: calcula forças longitudinais com modificadores de Preparação, Peças e Modos
      const stage = state.tuningStage || 0
      const stageMult = stage === 1 ? 1.25 : stage === 2 ? 1.50 : stage === 3 ? 1.85 : 1.0
      const intakeMult = state.intakeType === 'cold_air' ? 1.06 : 1.0
      const exhaustMult = state.exhaustType === 'straight_pipe' ? 1.08 : state.exhaustType === 'sport' ? 1.04 : 1.0
      const turboKitMult = (!_config.engine.turbo?.enabled && state.hasTurbo) ? 1.45 : 1.0
      const driveModeMult = state.drivingMode === 'track' ? 1.10 : state.drivingMode === 'sport' ? 1.05 : 1.0
      const isNosInjecting = phys.nosActive && state.hasNosKit && phys.nosPressurePercent > 0 && state.throttle > 0.65 && phys.isRunning
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
      const effectiveBrake = rawBrake * phys.brakeFadeFactor
      const driveTorqueAtTransmission =
        clutchState.transmittedTorque >= 0
          ? clutchState.transmittedTorque * totalTorqueMult
          : clutchState.transmittedTorque
      const physicsTick = _physics.tick({
        driveTorqueAtTransmission,
        gearRatio,
        finalDrive,
        brake: effectiveBrake,
        deltaTime: dt,
      })

      const prevSubstepSpeed = phys.speedKmh
      phys.speedKmh = gear === -2 ? 0 : physicsTick.speedKmh
      if (gear === -2) {
        _physics.reset()
      }

      const timerStep = stepZeroToHundredTimer(timer0to100State, {
        prevSpeedKmh: prevSubstepSpeed,
        speedKmh: phys.speedKmh,
        gear,
        throttle: state.throttle,
        brake: state.brake,
        handbrake: state.handbrake,
        isRunning: phys.isRunning,
        deltaTime: dt,
      })
      timer0to100State = timerStep.state
      if (timerStep.isNewBest) {
        useGarageStore.getState().addCredits(2500)
      }

      // 6. TractionControlSystem
      if (_tcs) {
        const tcsDecision = _tcs.decide({
          wheelTorque: physicsTick.wheelTorque,
          maxGripTorque: physicsTick.maxGripTorque,
          slipRatio: physicsTick.slipRatio,
          drivingMode: state.drivingMode,
          enabled: state.tcsEnabled,
        }, dt)

        phys.tcsIntervening = tcsDecision.isIntervening
        phys.tcsInterventionLevel = tcsDecision.interventionLevel

        if (tcsDecision.isIntervening && physicsTick.isWheelSlipping) {
          const reducedThrottle = state.throttle * tcsDecision.throttleMultiplier
          _engine.tick({
            throttle: reducedThrottle,
            loadTorque: 0,
            deltaTime: 0,
          })
        }
      }

      // 7. Quando 100% acoplado em movimento com rotação suficiente, sincroniza RPM
      if (gear !== 0 && _clutch.getEngagement() > 0.95 && phys.isRunning) {
        const expectedRpm = _transmission.calculator.speedToRpm(phys.speedKmh, gear)
        if (expectedRpm >= _config.engine.idleRpm) {
          _engine.setRpm(expectedRpm)
          phys.rpm = expectedRpm
        }
      }

      // ─── 8. Subsistemas Físicos Secundários em 120 Hz Contínuo (sem quantização) ───

      // Turbo Boost Pressure Calculation
      if (state.hasTurbo) {
        const turboCfg = _config.engine.turbo || {
          maxBoostBar: 1.25,
          spoolRpmStart: 1800,
          fullBoostRpm: 2800,
        }
        const extraBoost = stage === 1 ? 0.35 : stage === 2 ? 0.65 : stage === 3 ? 1.15 : 0.0
        const maxBoost = (turboCfg.maxBoostBar || 1.25) + extraBoost
        const spoolRpm = turboCfg.spoolRpmStart || 1600
        const fullRpm = turboCfg.fullBoostRpm || 2600

        let targetBoost = -0.7
        if (phys.isRunning) {
          if (phys.isLaunchControlArmed) {
            targetBoost = maxBoost * 0.65
          } else if (state.throttle < 0.08) {
            targetBoost = -0.75 + clamp((phys.rpm - 1000) / 6000, 0, 0.25)
          } else if (phys.rpm < spoolRpm) {
            targetBoost = -0.7 + state.throttle * 0.7
          } else {
            const rpmFactor = clamp((phys.rpm - spoolRpm) / (fullRpm - spoolRpm), 0, 1)
            targetBoost = state.throttle * (rpmFactor * maxBoost)
          }
        } else {
          targetBoost = 0
        }

        const boostSpeed = targetBoost > phys.boostPressureBar ? 4.8 : 8.5
        phys.boostPressureBar += (targetBoost - phys.boostPressureBar) * clamp(dt * boostSpeed, 0, 1)
        phys.peakBoostBar = Math.max(phys.peakBoostBar, phys.boostPressureBar)
      } else if (state.hasBoostGaugeKit) {
        let targetVacuum = 0
        if (phys.isRunning) {
          targetVacuum = state.throttle < 0.08
            ? -0.75 + clamp((phys.rpm - 1000) / 8000, 0, 0.1)
            : -0.7 + state.throttle * 0.65
        }
        phys.boostPressureBar += (targetVacuum - phys.boostPressureBar) * clamp(dt * 7, 0, 1)
        phys.peakBoostBar = 0
      } else {
        phys.boostPressureBar = 0
        phys.peakBoostBar = 0
      }

      // Top Speed Record
      phys.topSpeedRecord = Math.max(phys.topSpeedRecord, Math.round(phys.speedKmh))

      // Térmica dos Freios, Brilho & Brake Fade
      const effectiveBrakeSpeed = injectedSpeedFloor > 0
        ? Math.max(phys.speedKmh, injectedSpeedFloor)
        : phys.speedKmh
      if (rawBrake > 0.05 && effectiveBrakeSpeed > 1) {
        phys.brakeDiscTemp += rawBrake * (effectiveBrakeSpeed / 75) * 80 * dt
      }
      const discCooling = ((phys.speedKmh / 100) * 0.75 + 0.18) * Math.max(0, (phys.brakeDiscTemp - 60) / 100) * 9.0 * dt
      phys.brakeDiscTemp = clamp(phys.brakeDiscTemp - discCooling, 60, 950)
      phys.isBrakeGlowing = phys.brakeDiscTemp >= 500
      phys.brakeFadeFactor = phys.brakeDiscTemp > 650
        ? clamp(1.0 - ((phys.brakeDiscTemp - 650) / 300) * 0.55, 0.45, 1.0)
        : 1.0

      // Sistema Real de Combustível & Consumo Dinâmico
      if (phys.isRunning) {
        const hours = dt / 3600
        const fuelMult = state.fuelType === 'ethanol_e100' ? 1.34 : 1.0
        const stageFuelFactor = stage === 1 ? 1.2 : stage === 2 ? 1.4 : stage === 3 ? 1.8 : 1.0
        const burnPerHour = (0.85 + state.throttle * 22.0 + (phys.rpm / _config.engine.maxRpm) * 8.5) * stageFuelFactor * fuelMult
        phys.fuelLevelLiters = Math.max(0, phys.fuelLevelLiters - burnPerHour * hours)

        if (phys.fuelLevelLiters <= 0.005) {
          phys.fuelLevelLiters = 0
          phys.isOutOfFuel = true
          phys.isRunning = false
          phys.isStalled = true
          phys.status = 'stalled'
          _engine.stop()
        }
      }

      // Dinâmica Térmica do Motor, Termostática, Ventoinha (com Histerese) e Óleo
      const targetCoolant = _config.dashboard.coolantTempTarget ?? 88
      if (!phys.isRunning) {
        phys.isRadiatorFanOn = false
      } else if (!phys.isRadiatorFanOn && phys.coolantTemp >= 96.0) {
        phys.isRadiatorFanOn = true
      } else if (phys.isRadiatorFanOn && phys.coolantTemp <= 91.0) {
        phys.isRadiatorFanOn = false
      }

      if (phys.isRunning) {
        const stageHeatMult = stage === 1 ? 1.25 : stage === 2 ? 1.50 : stage === 3 ? 1.85 : 1.0
        const fuelHeatFactor = state.fuelType === 'ethanol_e100' ? 0.90 : 1.0
        const rpmRatio = clamp(phys.rpm / Math.max(1000, _config.engine.maxRpm), 0, 1.2)
        const engineLoad = clamp(state.throttle * 0.72 + Math.pow(rpmRatio, 1.35) * 0.38, 0.05, 1.25)

        // Válvula termostática mantém estabilidade perto da temperatura ideal e evita quedas bruscas
        const thermostatOpen = clamp((phys.coolantTemp - (targetCoolant - 2)) / 8, 0.05, 1.0)
        const coolantHeatIn = (0.10 + engineLoad * 1.15) * stageHeatMult * fuelHeatFactor
        const radFanFactor = phys.isRadiatorFanOn ? 0.52 : 0.0
        const airflowFactor = 0.20 + clamp(phys.speedKmh / 100, 0, 1.40) * 0.85 + radFanFactor
        const tempDeltaAboveAmbient = Math.max(0, phys.coolantTemp - 25) / 65
        const coolantCoolingOut = airflowFactor * tempDeltaAboveAmbient * thermostatOpen * 0.85

        // Regulação suave em marcha lenta/baixa carga para manter patamar operacional
        const idleEquilibriumPull =
          state.throttle < 0.08 && phys.coolantTemp > targetCoolant && phys.coolantTemp < 95.5
            ? (phys.coolantTemp - targetCoolant) * 0.025
            : 0

        phys.coolantTemp = clamp(
          phys.coolantTemp + (coolantHeatIn - coolantCoolingOut - idleEquilibriumPull) * dt,
          20,
          135,
        )

        // Temperatura do óleo com inércia térmica própria ligada a RPM, carga e troca com arrefecimento
        const targetOilEquilibrium =
          phys.coolantTemp + 3.5 + (Math.pow(rpmRatio, 1.6) * 11.0 + state.throttle * 6.5) * stageHeatMult
        const oilTau = phys.oilTemp < targetOilEquilibrium ? 0.065 : 0.045
        phys.oilTemp = clamp(
          phys.oilTemp + (targetOilEquilibrium - phys.oilTemp) * clamp(dt * oilTau, 0, 1),
          20,
          150,
        )
      } else if (phys.status === 'starting') {
        phys.coolantTemp = Math.max(25, phys.coolantTemp - 0.02 * dt)
        phys.oilTemp = Math.max(25, phys.oilTemp - 0.02 * dt)
      } else {
        phys.coolantTemp = Math.max(25, phys.coolantTemp - Math.max(0.03, (phys.coolantTemp - 25) * 0.008) * dt)
        phys.oilTemp = Math.max(25, phys.oilTemp - Math.max(0.025, (phys.oilTemp - 25) * 0.006) * dt)
      }

      // Superaquecimento crítico (>=125°C)
      if (phys.coolantTemp >= 125 && !phys.isEngineBlown) {
        phys.isEngineBlown = true
        phys.damageReason = 'Superaquecimento (>125°C): Junta Queimada!'
        phys.isRunning = false
        phys.isStalled = true
        phys.status = 'stalled'
        phys.engineBlownTrigger = Date.now()
        _engine.stop()
        HapticFeedback.heavy()
      }

      // Burnout & Fumaça Densa de Pneus
      const isHoldBrake = state.brake > 0.35 || state.handbrake
      const isBurnoutThrottle = state.throttle > 0.60 && phys.rpm > 2600
      const isForwardOrReverse = gear === 1 || gear === -1 || (state.transmissionMode === 'automatic' && gear === 1)

      if (phys.isRunning && isHoldBrake && isBurnoutThrottle && isForwardOrReverse && phys.speedKmh < 18) {
        phys.isBurningOut = true
        phys.tireSmokeDensity = clamp(phys.tireSmokeDensity + dt * 1.8, 0, 1.0)
      } else {
        phys.isBurningOut = false
        phys.tireSmokeDensity = clamp(phys.tireSmokeDensity - dt * 0.85, 0, 1.0)
      }

      // Pista de Arrancada 402m (Drag Strip)
      const currentMoveSpeed = injectedSpeedFloor > 0
        ? Math.max(phys.speedKmh, injectedSpeedFloor)
        : phys.speedKmh

      if (
        (phys.dragStage === 'pre_stage' ||
          phys.dragStage === 'staged' ||
          phys.dragStage === 'yellow_1' ||
          phys.dragStage === 'yellow_2' ||
          phys.dragStage === 'yellow_3') &&
        (currentMoveSpeed > 1.8 || phys.dragDistanceTraveled > 0.25)
      ) {
        phys.dragStage = 'false_start'
        phys.dragTimeSlip = {
          reactionTime: 0,
          time60ft: 0,
          time0to100: 0,
          time201m: 0,
          time402m: 0,
          trapSpeedKmh: Math.round(currentMoveSpeed),
          isDisqualified: true,
          createdAt: Date.now(),
        }
      } else if (phys.dragStage === 'green') {
        if (currentMoveSpeed > 0.6 || phys.dragDistanceTraveled > 0.1) {
          const simReactionSec = phys.dragGreenSimMs !== null
            ? ((phys.elapsedSimMs + substeps * dt * 1000) - phys.dragGreenSimMs) / 1000
            : 0
          const wallReactionSec = state._dragGreenTime ? (now - state._dragGreenTime) / 1000 : 0.25
          const rawReaction = simReactionSec > 0 ? simReactionSec : wallReactionSec
          const reaction = Math.max(0.001, Math.round(rawReaction * 1000) / 1000)
          phys.dragStage = 'racing'
          phys.dragTimerStart = now
          phys.dragElapsedSeconds = dt
          phys.dragDistanceTraveled = Math.max(0, phys.dragDistanceTraveled + (currentMoveSpeed / 3.6) * dt)
          phys.dragTimeSlip = {
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
      } else if (phys.dragStage === 'racing' && phys.dragTimeSlip) {
        phys.dragElapsedSeconds += dt
        phys.dragDistanceTraveled += (currentMoveSpeed / 3.6) * dt
        const elapsed = Math.round(phys.dragElapsedSeconds * 1000) / 1000

        if (phys.dragDistanceTraveled >= 18.288 && phys.dragTimeSlip.time60ft === 0) {
          phys.dragTimeSlip.time60ft = elapsed
        }
        if (currentMoveSpeed >= 100 && phys.dragTimeSlip.time0to100 === 0) {
          phys.dragTimeSlip.time0to100 = elapsed
        }
        if (phys.dragDistanceTraveled >= 201.168 && phys.dragTimeSlip.time201m === 0) {
          phys.dragTimeSlip.time201m = elapsed
        }
        if (phys.dragDistanceTraveled >= 402.336) {
          phys.dragTimeSlip.time402m = elapsed
          phys.dragTimeSlip.trapSpeedKmh = Math.round(currentMoveSpeed)
          phys.dragStage = 'finished'
          HapticFeedback.heavy()

          if (!phys.dragTimeSlip.isDisqualified) {
            let prize = 3000
            const breakdown: string[] = ['Premiação base 402m: +R$ 3.000']
            if (phys.dragTimeSlip.reactionTime < 0.100) {
              prize += 5000
              breakdown.push('Reação perfeita (<0.100s): +R$ 5.000')
            } else if (phys.dragTimeSlip.reactionTime < 0.250) {
              prize += 2000
              breakdown.push('Reação rápida (<0.250s): +R$ 2.000')
            }
            if (phys.dragTimeSlip.trapSpeedKmh >= 200) {
              prize += 3000
              breakdown.push('Trap Speed > 200 km/h: +R$ 3.000')
            } else if (phys.dragTimeSlip.trapSpeedKmh >= 160) {
              prize += 1500
              breakdown.push('Trap Speed > 160 km/h: +R$ 1.500')
            }
            phys.dragTimeSlip.reward = prize
            phys.dragTimeSlip.rewardBreakdown = breakdown
            useGarageStore.getState().addCredits(prize)
          }
        }
      }

      // Kit de Óxido Nitroso (NOS) & Consumo de Pressão
      if (state.hasNosKit && phys.nosActive && state.throttle > 0.60 && phys.isRunning && phys.nosPressurePercent > 0) {
        phys.nosPressurePercent = Math.max(0, phys.nosPressurePercent - dt * 12.5)
        if (phys.nosPressurePercent <= 0) {
          phys.nosActive = false
        }
      }

      accumulator -= dt
      substeps++
    }

    if (substeps === maxSubsteps && accumulator > PHYSICS_TIMESTEP) {
      accumulator = 0
    }

    // Haptics no corte de giro
    if (phys.isRevLimiting && !prevRevLimiting) {
      HapticFeedback.revLimiter()
    }

    // ─── Throttling Determinístico de Publicação Visual (ECO ~35Hz / NORMAL & ALTO máx 60Hz) & Lenta (150ms) ───
    phys.elapsedSimMs += frameTime * 1000
    const profile = useUIStore.getState().graphicProfile
    const minVisualInterval = profile === 'eco' ? 28 : 16.0

    const wasLowFuel = state.fuelLevelLiters <= 5
    const isLowFuel = phys.fuelLevelLiters <= 5
    const wasHighCoolant = state.coolantTemp >= 115
    const isHighCoolant = phys.coolantTemp >= 115
    const wasBrakeFade = state.brakeDiscTemp > 650
    const isBrakeFade = phys.brakeDiscTemp > 650

    const hasCriticalEvent =
      phys.isEngineBlown !== state.isEngineBlown ||
      phys.isOutOfFuel !== state.isOutOfFuel ||
      phys.isRevLimiting !== state.isRevLimiting ||
      phys.isRunning !== state.isRunning ||
      phys.isStalled !== state.isStalled ||
      phys.dragStage !== state.dragStage ||
      timer0to100State.isTiming !== state.isTiming0to100 ||
      timer0to100State.lastCompleted !== state.last0to100 ||
      phys.isBrakeGlowing !== state.isBrakeGlowing ||
      phys.nosActive !== state.nosActive

    const hasSlowThresholdCrossed =
      phys.isEngineBlown !== state.isEngineBlown ||
      phys.isOutOfFuel !== state.isOutOfFuel ||
      phys.isBrakeGlowing !== state.isBrakeGlowing ||
      phys.dragStage !== state.dragStage ||
      phys.isRadiatorFanOn !== state.isRadiatorFanOn ||
      (isLowFuel && !wasLowFuel) ||
      (isHighCoolant && !wasHighCoolant) ||
      isBrakeFade !== wasBrakeFade

    if (hasSlowThresholdCrossed || phys.elapsedSimMs - phys.lastSlowUpdateMs >= 150) {
      phys.pendingSlowPublish = true
    }

    const shouldUpdateVisual =
      phys.visualUpdatesCount === 0 ||
      hasCriticalEvent ||
      frameTime >= 0.05 ||
      phys.elapsedSimMs - phys.lastVisualUpdateMs >= minVisualInterval

    if (!shouldUpdateVisual) {
      phys.skippedVisualUpdatesCount += 1
      phys.skippedSlowUpdatesCount += 1
      state._accumulator = accumulator
      state._timer0to100State = timer0to100State
      state._phys = phys
      return
    }

    phys.visualUpdatesCount += 1
    phys.lastVisualUpdateMs = phys.elapsedSimMs
    performanceMonitor.recordVisualPublish()

    const shouldUpdateSlow =
      phys.slowUpdatesCount === 0 ||
      hasCriticalEvent ||
      frameTime >= 0.05 ||
      phys.pendingSlowPublish ||
      phys.elapsedSimMs - phys.lastSlowUpdateMs >= 150

    if (shouldUpdateSlow) {
      phys.slowUpdatesCount += 1
      phys.lastSlowUpdateMs = phys.elapsedSimMs
      phys.pendingSlowPublish = false
    } else {
      phys.skippedSlowUpdatesCount += 1
    }

    // Valores arredondados apenas na publicação da UI (estado físico contínuo preservado em _phys)
    const pubBoost = Math.round(phys.boostPressureBar * 100) / 100
    const pubPeakBoost = Math.round(phys.peakBoostBar * 100) / 100
    const pubFuel = shouldUpdateSlow ? Math.round(phys.fuelLevelLiters * 1000) / 1000 : state.fuelLevelLiters
    const pubOutOfFuel = shouldUpdateSlow ? phys.isOutOfFuel : state.isOutOfFuel
    const roundedCoolant = Math.round(phys.coolantTemp * 10) / 10
    const roundedOil = Math.round(phys.oilTemp * 10) / 10
    const hasTempDelta =
      Math.abs(roundedCoolant - state.coolantTemp) >= 0.1 ||
      Math.abs(roundedOil - state.oilTemp) >= 0.1 ||
      phys.isRadiatorFanOn !== state.isRadiatorFanOn
    const pubCoolant = (shouldUpdateSlow || hasTempDelta) ? roundedCoolant : state.coolantTemp
    const pubOil = (shouldUpdateSlow || hasTempDelta) ? roundedOil : state.oilTemp
    const pubBrakeDiscTemp = shouldUpdateSlow ? Math.round(phys.brakeDiscTemp * 10) / 10 : state.brakeDiscTemp
    const pubBrakeFadeFactor = shouldUpdateSlow ? phys.brakeFadeFactor : state.brakeFadeFactor
    const pubNosPressure = Math.round(phys.nosPressurePercent * 10) / 10

    phys.lastPubBoost = pubBoost
    phys.lastPubPeakBoost = pubPeakBoost
    phys.lastPubBrakeDiscTemp = pubBrakeDiscTemp
    phys.lastPubBrakeFadeFactor = pubBrakeFadeFactor
    phys.lastPubFuelLevelLiters = pubFuel
    phys.lastPubIsOutOfFuel = pubOutOfFuel
    phys.lastPubCoolantTemp = pubCoolant
    phys.lastPubOilTemp = pubOil
    phys.lastPubIsEngineBlown = phys.isEngineBlown
    phys.lastPubNosPressurePercent = pubNosPressure
    phys.lastPubNosActive = phys.nosActive
    phys.lastPubDragStage = phys.dragStage
    phys.lastPubDragDistance = phys.dragDistanceTraveled
    phys.lastPubDragTimerStart = phys.dragTimerStart
    phys.lastPubSpeedKmh = phys.speedKmh
    phys.lastPubTopSpeedRecord = phys.topSpeedRecord

    set({
      rpm: phys.rpm,
      speed: phys.speedKmh,
      currentGear: phys.gear,
      isRunning: phys.isRunning,
      isStalled: phys.isStalled,
      isBogWarning: phys.isBogWarning,
      status: phys.status,
      isKickdown: phys.isKickdown,
      isRevLimiting: phys.isRevLimiting,
      isLaunchControlArmed: phys.isLaunchControlArmed,
      isLaunching: phys.isLaunching,
      boostPressureBar: pubBoost,
      peakBoostBar: pubPeakBoost,
      tcsIntervening: phys.tcsIntervening,
      tcsInterventionLevel: phys.tcsInterventionLevel,
      clutchSlipRpm: phys.clutchSlipRpm,
      clutchSlipRatio: phys.clutchSlipRatio,
      clutchTorqueTransfer: phys.clutchTorqueTransfer,
      clutchHeat: phys.clutchHeat,
      isClutchSlipping: phys.isClutchSlipping,
      best0to100: timer0to100State.bestCompleted,
      last0to100: timer0to100State.lastCompleted,
      current0to100: timer0to100State.currentDisplay,
      isTiming0to100: timer0to100State.isTiming,
      topSpeedRecord: phys.topSpeedRecord,
      _timer0to100State: timer0to100State,
      _accumulator: accumulator,
      _phys: phys,

      // Telemetria secundária desacoplada para evitar re-renderizações desnecessárias a 120Hz
      fuelLevelLiters: pubFuel,
      isOutOfFuel: pubOutOfFuel,
      coolantTemp: pubCoolant,
      oilTemp: pubOil,
      isRadiatorFanOn: phys.isRadiatorFanOn,
      isEngineBlown: phys.isEngineBlown,
      damageReason: phys.damageReason,
      engineBlownTrigger: phys.engineBlownTrigger,
      brakeDiscTemp: pubBrakeDiscTemp,
      isBrakeGlowing: phys.isBrakeGlowing,
      brakeFadeFactor: pubBrakeFadeFactor,
      isBurningOut: phys.isBurningOut,
      tireSmokeDensity: phys.tireSmokeDensity,
      nosPressurePercent: pubNosPressure,
      nosActive: phys.nosActive,
      dragStage: phys.dragStage,
      dragTimeSlip: phys.dragTimeSlip,
      _dragDistanceTraveled: phys.dragDistanceTraveled,
      _dragTimerStart: phys.dragTimerStart,
    })
  },

  reset: () => {
    const isManual = !get().isAutomaticVehicle
    const supported = get()._config?.transmission.supportedSelectorPositions ?? []
    const defaultSelector = isManual
      ? (supported.includes('N') ? 'N' : (supported[0] ?? 'N'))
      : (supported.includes('P') ? 'P' : (supported[0] ?? 'N'))
    const initialGear = isManual ? 0 : -2
    set({
      rpm: 0,
      isRunning: false,
      isStalled: false,
      isBogWarning: false,
      status: 'off',
      isRevLimiting: false,
      currentGear: initialGear,
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
      isRadiatorFanOn: false,
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
      _phys: createInitialPhysicsInternalState({
        gear: initialGear,
        nosPressurePercent: get().nosPressurePercent,
        topSpeedRecord: get().topSpeedRecord,
      }),
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
