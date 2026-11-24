import { create } from 'zustand'
import type { VehicleConfig, DrivingMode, GearSelectorPosition } from '@/types'
import { getVehicleCapabilities } from '@/types'
import type { EngineStatus, FuelType, DragTreeStage, DragTimeSlip } from '@/types/simulation'
import { EngineSimulator, type EngineSimulatorSnapshot } from '@/systems/engine'
import { Transmission, AutomaticTransmission, type TransmissionSnapshot, type AutoTransmissionSnapshot } from '@/systems/transmission'
import { ClutchSystem, type ClutchSnapshot } from '@/systems/clutch'
import { VehiclePhysics, DeterministicIntegrator, type PhysicsIntegrityStatus, type VehiclePhysicsSnapshot, type FourWheelDriveMode } from '@/systems/physics'
import { WorldMap } from '@/systems/world/WorldMap'
import { TractionControlSystem } from '@/systems/tcs'
import { PedalInputSystem, createInitialZeroToHundredState, stepZeroToHundredTimer, type ZeroToHundredState } from '@/systems/vehicle'
import {
  resolveDefaultAmbientColor,
  resolveVehicleAero,
  resolveVehicleCabin,
  resolveVehicleDrivetrain,
  resolveVehicleFuelDefaults,
  resolveVehicleIgnition,
} from '@/systems/vehicle/vehicleResolvers'
import {
  ClimateSystem,
  CLIMATE_CALIBRATION,
  WindowSystem,
  WINDOW_CALIBRATION,
  IgnitionSystem,
  IGNITION_CALIBRATION,
  LightingSystem,
  type FanLevel,
  type ClimateStateSnapshot,
  type WindowId,
  type WindowStateSnapshot,
  type IgnitionStateSnapshot,
  type TurnSignalSelection,
  type LightingStateSnapshot,
} from '@/systems/cabin'
import type { IgnitionPosition, IgnitionStartInterlock, IgnitionType } from '@/types/vehicle'
import type { SensorPermissionState, SteeringMethod } from '@/systems/input'
import { MAX_SUBSTEPS } from '@/systems/engine/constants'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'
import { clamp } from '@/utils/math'
import type { AmbientLightColor } from '@/utils/ambientLighting'
import { useGarageStore, type CarUpgrades, type ExhaustType, type SuspensionHeight, type RearWingPosition, type RearWingType, type TurboLevel, type EngineInternals } from './useGarageStore'
import { useUIStore, type MapViewportSize } from './useUIStore'
import { performanceMonitor } from '@/utils/performanceMonitor'

/**
 * Estado físico autoritativo desacoplado das publicações visuais do Zustand.
 * Permite que todos os subsistemas integrem a 120 Hz sem perda nem quantização
 * mesmo quando a UI recebe snapshots em 35 Hz (ECO), 60 Hz (NORMAL) ou ~6.6 Hz (telemetria lenta).
 */
export interface PhysicsInternalState {
  boostPressureBar: number
  peakBoostBar: number
  boostTorqueMultiplier: number
  fuelPowerMultiplier: number
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
  // ─── Navegação e Dinâmica 2D ───
  positionX: number
  positionY: number
  headingDeg: number
  lateralSpeedMs: number
  slipAngleDeg: number
  lateralAccelG: number
  leanAngleDeg: number
  isColliding: boolean
  collisionBoundaryName: string | null
  surfaceType: string
  zoneName: string
  absEngaged: boolean
  isAirbrakeActive: boolean
  engineDamageRatio: number

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

/**
 * Estado candidato completo para execução transacional isolada no DeterministicIntegrator.
 * Abrange 100% dos subsistemas mutáveis: física, motor, embreagem, transmissão e timers.
 */
export interface SimulationRuntimeCandidate {
  phys: PhysicsInternalState
  timer0to100State: ZeroToHundredState
  engine: EngineSimulatorSnapshot
  clutch: ClutchSnapshot
  transmission: TransmissionSnapshot
  autoTransmission: AutoTransmissionSnapshot | null
  physics: VehiclePhysicsSnapshot
  climate?: ClimateStateSnapshot
  windows?: WindowStateSnapshot
  ignition?: IgnitionStateSnapshot
  lighting?: LightingStateSnapshot
}

/**
 * Contexto de entrada imutável passado aos subpassos pelo integrador.
 */
export interface SimulationSubstepContext {
  throttle: number
  brake: number
  handbrake: boolean
  drivingMode: DrivingMode
  transmissionMode: TransmissionMode
  gearSelectorPosition: GearSelectorPosition
  tuningStage: 0 | 1 | 2 | 3
  intakeType: 'stock' | 'cold_air'
  exhaustType: ExhaustType
  hasTurbo: boolean
  hasNosKit: boolean
  hasPopsAndBangs: boolean
  popsAndBangsEnabled: boolean
  suspensionHeight: SuspensionHeight
  rearWingPosition: RearWingPosition
  rearWingType: RearWingType
  tires: 'street' | 'semi_slick'
  isRaining: boolean
  isAeroWingExtended: boolean
  hasLaunchControl: boolean
  hasBoostGaugeKit: boolean
  fuelType: FuelType
  engineInternals?: EngineInternals
  turboLevel?: TurboLevel
  now: number
  injectedSpeedFloor: number
  steeringAngle: number
  fourWheelDriveMode: FourWheelDriveMode
  clutchUpgrade?: 'stock' | 'ceramic'
  brakeUpgrade?: 'stock' | 'sport'
}

function cloneRuntimeCandidate(candidate: SimulationRuntimeCandidate): SimulationRuntimeCandidate {
  return {
    phys: {
      ...candidate.phys,
      dragTimeSlip: candidate.phys.dragTimeSlip ? { ...candidate.phys.dragTimeSlip } : null,
    },
    timer0to100State: { ...candidate.timer0to100State },
    engine: { ...candidate.engine },
    clutch: { ...candidate.clutch },
    transmission: { ...candidate.transmission },
    autoTransmission: candidate.autoTransmission ? { ...candidate.autoTransmission } : null,
    physics: { ...candidate.physics },
    climate: candidate.climate ? { ...candidate.climate } : undefined,
    windows: candidate.windows
      ? {
          ...candidate.windows,
          positions: { ...candidate.windows.positions },
          targets: { ...candidate.windows.targets },
        }
      : undefined,
    ignition: candidate.ignition ? { ...candidate.ignition } : undefined,
    lighting: candidate.lighting ? { ...candidate.lighting } : undefined,
  }
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
    boostTorqueMultiplier: 1.0,
    fuelPowerMultiplier: 1.0,
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
    positionX: overrides.positionX ?? WorldMap.SPAWN_X,
    positionY: overrides.positionY ?? WorldMap.SPAWN_Y,
    headingDeg: overrides.headingDeg ?? WorldMap.SPAWN_HEADING_DEG,
    lateralSpeedMs: 0,
    slipAngleDeg: 0,
    lateralAccelG: 0,
    leanAngleDeg: 0,
    isColliding: false,
    collisionBoundaryName: null,
    surfaceType: overrides.surfaceType ?? 'asphalt',
    zoneName: overrides.zoneName ?? 'Rotatória Central',
    absEngaged: false,
    isAirbrakeActive: false,
    engineDamageRatio: 0,

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
  /** Altura da suspensão (Original, Sport, Track, Lift) */
  setSuspensionHeight: (height: SuspensionHeight) => void
  /** Posição/ângulo aerodinâmico da asa traseira */
  setRearWingPosition: (pos: RearWingPosition) => void
  /** Alterna ativação de Pops & Bangs */
  togglePopsAndBangs: () => void
  /** Liga o motor (ou aciona arranque se parado/estolado) */
  startEngine: (options?: { enforceInterlock?: boolean }) => void
  /** Solicita partida do motor respeitando estritamente o contrato `startInterlock` da ignição */
  requestEngineStart: (enforceInterlock?: boolean) => boolean
  /** Define posição da chave/comutador de ignição (OFF, ACC, ON, CRANK) */
  setIgnitionPosition: (pos: IgnitionPosition, enforceInterlock?: boolean) => boolean
  /** Avança um estágio na chave física (OFF -> ACC -> ON -> CRANK) ou botão Start/Stop */
  advanceIgnition: (enforceInterlock?: boolean) => boolean
  /** Retorna um estágio na chave física (ON -> ACC -> OFF) */
  stepBackIgnitionKey: () => void
  /** Define estado de descarga da bateria para simulação de falha de partida */
  setBatteryDischarged: (discharged: boolean) => void
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
  /** Controle de Faróis, Neblina e Setas / Pisca-Alerta */
  cycleHeadlights: () => void
  setHeadlightsMode: (mode: 'off' | 'parking' | 'low' | 'high') => void
  toggleFogLights: () => void
  setFogLightsEnabled: (enabled: boolean) => void
  toggleLeftTurnSignal: () => void
  toggleRightTurnSignal: () => void
  setTurnSignal: (selection: TurnSignalSelection) => void
  toggleHazardLights: () => void
  setHazardLights: (enabled: boolean) => void
  /** Clima & Limpadores */
  toggleRain: () => void
  toggleWipers: () => void
  /** Sistema de Climatização da Cabine (ClimateSystem) */
  setClimateAcEnabled: (enabled: boolean) => void
  toggleClimateAc: () => void
  setClimateTargetTempC: (tempC: number) => void
  stepClimateTargetTempC: (deltaC: number) => void
  setClimateFanLevel: (level: FanLevel) => void
  setClimateAutoMode: (enabled: boolean) => void
  toggleClimateAutoMode: () => void
  setClimateRecirculation: (enabled: boolean) => void
  toggleClimateRecirculation: () => void
  setClimateHeaterEnabled: (enabled: boolean) => void
  toggleClimateHeater: () => void
  setClimateDefrosterEnabled: (enabled: boolean) => void
  toggleClimateDefroster: () => void
  setAmbientTempC: (tempC: number) => void
  /** Vidros Elétricos / Manivela & Acústica (WindowSystem) */
  toggleWindows: () => void
  setWindowsOpen: (open: boolean) => void
  setWindowPosition: (id: WindowId, openRatio: number) => void
  setWindowTarget: (id: WindowId, targetRatio: number) => void
  stepWindowPosition: (id: WindowId, deltaRatio: number) => void
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
  setSteeringAngle: (angle: number, source?: SteeringMethod) => void
  /** Método de direção ativo (touch, tilt, keyboard) */
  setSteeringMethod: (method: SteeringMethod) => void
  /** Ativa ou desativa a direção por inclinação mobile */
  setTiltSteeringEnabled: (enabled: boolean) => void
  /** Ajusta sensibilidade da direção por inclinação */
  setSteeringSensitivity: (sens: number) => void
  /** Ajusta a zona morta (deadzone) da direção em graus */
  setSteeringDeadzone: (deadzone: number) => void
  /** Atualiza o estado da permissão de sensores mobile */
  setSensorPermission: (perm: SensorPermissionState) => void
  /** Alterna visibilidade do mapa 2D dirigível */
  toggleMap: () => void
  /** Define estado aberto/fechado do mapa */
  setMapOpen: (open: boolean) => void
  /** Ajusta tamanho do mapa de condução */
  setMapViewportSize: (size: MapViewportSize) => void
  /** Reseta a posição do veículo para o centro da pista (0, 0) */
  resetPosition: () => void
  /** Alterna o modo de tração 4x4 (AUTO, 4WD, 4WD LOW) com trava de segurança em velocidade */
  setFourWheelDriveMode: (mode: FourWheelDriveMode) => void
  /** Reseta dados de performance */
  resetPerformanceStats: () => void
  /** Atualiza a simulação (chamado pelo game loop) */
  update: (frameTime: number) => void
  /** Reseta a simulação */
  reset: () => void
  /** Pausa a simulação física determinística (congela relógio sem saltos) */
  pauseSimulation: () => void
  /** Retoma a simulação física */
  resumeSimulation: () => void
  /** Alterna pausa/retomada */
  togglePauseSimulation: () => void
  /** Define diretamente a velocidade linear do veículo (km/h) para testes e telemetria */
  setSpeed: (speedKmh: number) => void
}

interface SimulationState {
  // Estado do motor
  rpm: number
  isRunning: boolean
  isStalled: boolean
  isBogWarning: boolean       // Motor amarrando (pré-afogamento)
  status: EngineStatus
  isRevLimiting: boolean
  boostTorqueMultiplier: number
  fuelPowerMultiplier: number

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
  turboLevel: TurboLevel
  engineInternals: EngineInternals
  rearWingType: RearWingType
  /** Unidade da garagem carregada no simulador (null = carro de fábrica sem garagem) */
  garageInstanceId: string | null
  exhaustType: ExhaustType
  intakeType: 'stock' | 'cold_air'
  tires: 'street' | 'semi_slick'
  clutchUpgrade: 'stock' | 'ceramic'
  brakeUpgrade: 'stock' | 'sport'
  isAeroWingExtended: boolean
  hasPopsAndBangs: boolean
  popsAndBangsEnabled: boolean
  suspensionHeight: SuspensionHeight
  rearWingPosition: RearWingPosition
  downforceN: number

  // Volante & Esterço
  steeringAngle: number
  steeringMethod: SteeringMethod
  tiltSteeringEnabled: boolean
  steeringSensitivity: number
  steeringDeadzone: number
  sensorPermission: SensorPermissionState

  // ─── Condução e Navegação no Mundo 2D ───
  positionX: number
  positionY: number
  headingDeg: number
  visualPositionX: number
  visualPositionY: number
  visualHeadingDeg: number
  lateralSpeedMs: number
  slipAngleDeg: number
  lateralAccelG: number
  leanAngleDeg: number
  isColliding: boolean
  collisionBoundaryName: string | null
  surfaceType: string
  zoneName: string
  absEngaged: boolean
  isAirbrakeActive: boolean
  isMapOpen: boolean
  mapViewportSize: MapViewportSize

  // Tração 4x4 (Fiat Toro Ranch 2025 e futuros veículos integrais)
  fourWheelDriveMode: FourWheelDriveMode
  fourWheelDriveWarning: string | null

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

  // Vidros Elétricos / Manivela, Climatização, Ignição, Iluminação & H-Shifter
  windowsOpen: boolean
  windowPositions: Record<WindowId, number>
  windowTargets: Record<WindowId, number>
  windowAverageOpenRatio: number
  windowAeroDragMultiplier: number
  cabinNoiseLevel: number
  cabinFilterCutoffHz: number
  ambientTempC: number
  cabinTempC: number
  climateTargetTempC: number
  climateAcEnabled: boolean
  isCompressorEngaged: boolean
  climateFanLevel: FanLevel
  climateAutoMode: boolean
  climateRecirculation: boolean
  climateHeaterEnabled: boolean
  climateDefrosterEnabled: boolean
  compressorMechanicalPowerW: number
  compressorLoadTorqueNm: number
  blowerElectricalPowerW: number
  ignitionPosition: IgnitionPosition
  ignitionType: IgnitionType
  ignitionStartInterlock: IgnitionStartInterlock
  batteryVoltageV: number
  isBatteryDischarged: boolean
  ignitionStartAttempts: number
  ignitionFailedAttempts: number
  ignitionFailureReason: string | null
  fogLightsEnabled: boolean
  hasFogLights: boolean
  turnSignal: TurnSignalSelection
  leftTurnSignal: boolean
  rightTurnSignal: boolean
  hazardLights: boolean
  leftIndicatorLit: boolean
  rightIndicatorLit: boolean
  hazardIndicatorLit: boolean
  parkingLightsLit: boolean
  lowBeamLit: boolean
  highBeamLit: boolean
  fogLightsLit: boolean
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
  _climate: ClimateSystem | null
  _windows: WindowSystem | null
  _ignition: IgnitionSystem | null
  _lighting: LightingSystem | null
  _config: VehicleConfig | null
  _accumulator: number
  _isInitialized: boolean
  _phys: PhysicsInternalState
  _integrator: DeterministicIntegrator<SimulationRuntimeCandidate, SimulationSubstepContext> | null
  isPaused: boolean
  physicsIntegrityStatus: PhysicsIntegrityStatus
  interpolationAlpha: number
  visualSpeed: number
  visualRpm: number
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
  boostTorqueMultiplier: 1.0,
  fuelPowerMultiplier: 1.0,
  isAutomaticVehicle: true,
  ambientLightColor: 'red',
  currentGear: 0,
  visualSpeed: 0,
  visualRpm: 0,
  interpolationAlpha: 0,
  isPaused: false,
  physicsIntegrityStatus: 'NORMAL',
  _integrator: null,
  // Peças & Customizações Equipadas da Loja
  hasRetrofitInfotainment: false,
  hasBoostGaugeKit: false,
  turboLevel: 'none',
  engineInternals: 'stock',
  rearWingType: 'none',
  garageInstanceId: null,
  exhaustType: 'stock',
  intakeType: 'stock',
  tires: 'street',
  clutchUpgrade: 'stock',
  brakeUpgrade: 'stock',
  isAeroWingExtended: false,
  hasPopsAndBangs: false,
  popsAndBangsEnabled: false,
  suspensionHeight: 'stock',
  rearWingPosition: 'balanced',
  downforceN: 0,

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
  steeringMethod: 'tilt',
  tiltSteeringEnabled: true,
  steeringSensitivity: 1.0,
  steeringDeadzone: 2.0,
  sensorPermission: 'prompt',
  positionX: WorldMap.SPAWN_X,
  positionY: WorldMap.SPAWN_Y,
  headingDeg: WorldMap.SPAWN_HEADING_DEG,
  visualPositionX: WorldMap.SPAWN_X,
  visualPositionY: WorldMap.SPAWN_Y,
  visualHeadingDeg: WorldMap.SPAWN_HEADING_DEG,
  lateralSpeedMs: 0,
  slipAngleDeg: 0,
  lateralAccelG: 0,
  leanAngleDeg: 0,
  isColliding: false,
  collisionBoundaryName: null,
  surfaceType: 'asphalt',
  zoneName: 'Rotatória Central',
  absEngaged: false,
  isAirbrakeActive: false,
  isMapOpen: true,
  mapViewportSize: 'balanced',
  fourWheelDriveMode: 'auto',
  fourWheelDriveWarning: null,
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

  // Vidros Elétricos / Manivela, Climatização, Ignição, Iluminação & H-Shifter
  windowsOpen: false,
  windowPositions: { front_left: 0, front_right: 0, rear_left: 0, rear_right: 0 },
  windowTargets: { front_left: 0, front_right: 0, rear_left: 0, rear_right: 0 },
  windowAverageOpenRatio: 0,
  windowAeroDragMultiplier: 1.0,
  cabinNoiseLevel: 0.18,
  cabinFilterCutoffHz: WINDOW_CALIBRATION.CLOSED_CABIN_CUTOFF_HZ,
  ambientTempC: CLIMATE_CALIBRATION.DEFAULT_AMBIENT_TEMP_C,
  cabinTempC: CLIMATE_CALIBRATION.DEFAULT_AMBIENT_TEMP_C,
  climateTargetTempC: CLIMATE_CALIBRATION.DEFAULT_TARGET_TEMP_C,
  climateAcEnabled: false,
  isCompressorEngaged: false,
  climateFanLevel: 0,
  climateAutoMode: false,
  climateRecirculation: false,
  climateHeaterEnabled: false,
  climateDefrosterEnabled: false,
  compressorMechanicalPowerW: 0,
  compressorLoadTorqueNm: 0,
  blowerElectricalPowerW: 0,
  ignitionPosition: 'OFF',
  ignitionType: 'key',
  ignitionStartInterlock: 'none',
  batteryVoltageV: IGNITION_CALIBRATION.BATTERY_REST_VOLTAGE_V,
  isBatteryDischarged: false,
  ignitionStartAttempts: 0,
  ignitionFailedAttempts: 0,
  ignitionFailureReason: null,
  fogLightsEnabled: false,
  hasFogLights: false,
  turnSignal: 'off',
  leftTurnSignal: false,
  rightTurnSignal: false,
  hazardLights: false,
  leftIndicatorLit: false,
  rightIndicatorLit: false,
  hazardIndicatorLit: false,
  parkingLightsLit: true,
  lowBeamLit: true,
  highBeamLit: false,
  fogLightsLit: false,
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
  _climate: null,
  _windows: null,
  _ignition: null,
  _lighting: null,
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
    const clutchUpgrade = initialUpgrades?.clutchUpgrade ?? 'stock'
    const brakeUpgrade = initialUpgrades?.brakeUpgrade ?? 'stock'
    const clutch = new ClutchSystem(config.engine.maxTorque)
    if (clutchUpgrade === 'ceramic') {
      clutch.setCeramicClutch(true)
    }
    const resolvedDrivetrain = resolveVehicleDrivetrain(config)
    const resolvedAero = resolveVehicleAero(config)
    const resolvedFuel = resolveVehicleFuelDefaults(config)

    const physics = new VehiclePhysics({
      weight: config.info.weight,
      wheelDiameter: config.info.wheelDiameter,
      isMotorcycle: config.info.category === 'motorcycle',
      vehicleId: config.id,
      drivetrain: resolvedDrivetrain,
      hasAirbrake: resolvedAero.hasAirbrake,
      baseDownforceCoeff: resolvedAero.baseDownforceCoeff,
      chassis: config.chassis,
      frontFinalDrive: config.transmission.frontFinalDrive,
      brakeUpgrade,
    })

    let autoTransmission: AutomaticTransmission | null = null
    if (isAutoOrCvt) {
      autoTransmission = new AutomaticTransmission({
        gearRatios: config.transmission.gearRatios,
        finalDrive: config.transmission.finalDrive,
        wheelDiameter: config.info.wheelDiameter,
        maxRpm: config.engine.maxRpm,
        idleRpm: config.engine.idleRpm,
        revLimiter: config.engine.revLimiter,
        isCvt: config.transmission.type === 'cvt',
      })
    }

    const tcs = new TractionControlSystem()
    const pedalInput = new PedalInputSystem()
    const resolvedCabin = resolveVehicleCabin(config)
    const resolvedIgnition = resolveVehicleIgnition(config)
    const climate = new ClimateSystem(resolvedCabin)
    const windows = new WindowSystem(resolvedCabin)
    const ignition = new IgnitionSystem(resolvedIgnition)
    const lighting = new LightingSystem(resolvedCabin)

    const defaultTransMode: TransmissionMode = isAutoOrCvt ? 'automatic' : 'manual'
    const defaultDriveMode: DrivingMode = caps.defaultDrivingMode

    // TCS ligado por padrão se o veículo tiver TCS configurado
    const hasTcs = !!config.transmission.tcs?.enabled
    const hasTurbo = Boolean(config.engine.turbo?.enabled || initialUpgrades?.turboKit)
    const hasLaunchControl = Boolean(
      config.transmission.launchControl?.enabled ||
      config.engine.turbo?.enabled ||
      initialUpgrades?.turboKit
    )

    transmission.shiftTo(isAutoOrCvt ? -2 : 0, 0, undefined, true)

    const initialPhys = createInitialPhysicsInternalState({ gear: isAutoOrCvt ? -2 : 0 })
    const initialCandidate: SimulationRuntimeCandidate = {
      phys: initialPhys,
      timer0to100State: createInitialZeroToHundredState(),
      engine: engine.getStateSnapshot(),
      clutch: clutch.getStateSnapshot(),
      transmission: transmission.getStateSnapshot(),
      autoTransmission: autoTransmission ? autoTransmission.getStateSnapshot() : null,
      physics: physics.getStateSnapshot(),
      climate: climate.getStateSnapshot(),
      windows: windows.getStateSnapshot(),
      ignition: ignition.getStateSnapshot(),
      lighting: lighting.getStateSnapshot(),
    }

    const integrator = new DeterministicIntegrator<SimulationRuntimeCandidate, SimulationSubstepContext>(
      initialCandidate,
      {
        physicsFrequency: 120,
        maxSubsteps: MAX_SUBSTEPS,
        cloneState: cloneRuntimeCandidate,
      },
    )

    if (initialUpgrades?.suspensionHeight) {
      physics.setSuspensionHeight(initialUpgrades.suspensionHeight)
    }
    const defaultWing = initialUpgrades?.rearWingPosition ?? resolvedAero.defaultWingPosition
    const initialWingType: RearWingType = initialUpgrades?.rearWingType ?? resolvedAero.defaultWingType
    const initialAeroExtended = false
    physics.setAerodynamics(defaultWing, initialAeroExtended, initialWingType)
    physics.setTireCompound(initialUpgrades?.tires || 'street', false)

    const defaultAmbientColor: AmbientLightColor = resolveDefaultAmbientColor(config)

    set({
      _engine: engine,
      _transmission: transmission,
      _autoTransmission: autoTransmission,
      _clutch: clutch,
      _physics: physics,
      _tcs: tcs,
      _pedalInput: pedalInput,
      _climate: climate,
      _windows: windows,
      _ignition: ignition,
      _lighting: lighting,
      _config: config,
      _isInitialized: true,
      _integrator: integrator,
      isPaused: false,
      physicsIntegrityStatus: 'NORMAL',
      visualSpeed: 0,
      visualRpm: 0,
      interpolationAlpha: 0,
      steeringAngle: 0,
      positionX: WorldMap.SPAWN_X,
      positionY: WorldMap.SPAWN_Y,
      headingDeg: WorldMap.SPAWN_HEADING_DEG,
      visualPositionX: WorldMap.SPAWN_X,
      visualPositionY: WorldMap.SPAWN_Y,
      visualHeadingDeg: WorldMap.SPAWN_HEADING_DEG,
      lateralSpeedMs: 0,
      slipAngleDeg: 0,
      lateralAccelG: 0,
      leanAngleDeg: 0,
      isColliding: false,
      collisionBoundaryName: null,
      surfaceType: 'asphalt',
      zoneName: 'Rotatória Central',
      absEngaged: false,
      isAirbrakeActive: false,
      isAutomaticVehicle: isAutoOrCvt,
      ambientLightColor: defaultAmbientColor,
      hasTurbo,
      turboLevel: initialUpgrades?.turboLevel ?? (config.engine.turbo?.enabled ? 'none' : initialUpgrades?.turboKit ? 'basic' : 'none'),
      engineInternals: initialUpgrades?.engineInternals ?? 'stock',
      rearWingType: initialWingType,
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
      clutchUpgrade,
      brakeUpgrade,
      isAeroWingExtended: initialAeroExtended,
      hasPopsAndBangs: initialUpgrades?.hasPopsAndBangs ?? false,
      popsAndBangsEnabled: initialUpgrades?.popsAndBangsEnabled ?? false,
      suspensionHeight: initialUpgrades?.suspensionHeight ?? 'stock',
      rearWingPosition: initialUpgrades?.rearWingPosition ?? resolvedAero.defaultWingPosition,
      downforceN: 0,
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
      steeringMethod: 'tilt',
      tiltSteeringEnabled: true,
      steeringSensitivity: 1.0,
      steeringDeadzone: 2.0,
      sensorPermission: 'prompt',
      fourWheelDriveMode: 'auto',
      fourWheelDriveWarning: null,
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
      boostTorqueMultiplier: 1.0,
      fuelPowerMultiplier: 1.0,
      tcsEnabled: hasTcs,
      tcsIntervening: false,
      tcsInterventionLevel: 0,
      fuelType: initialUpgrades?.fuelType || resolvedFuel.defaultFuelType,
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
      windowPositions: windows.getStateSnapshot().positions,
      windowTargets: windows.getStateSnapshot().targets,
      windowAverageOpenRatio: 0,
      windowAeroDragMultiplier: 1.0,
      cabinNoiseLevel: windows.getCabinNoiseLevel(),
      cabinFilterCutoffHz: windows.getCabinFilterCutoffHz(),
      ambientTempC: climate.getAmbientTempC(),
      cabinTempC: climate.getCabinTempC(),
      climateTargetTempC: climate.getTargetTempC(),
      climateAcEnabled: false,
      isCompressorEngaged: false,
      climateFanLevel: 0,
      climateAutoMode: false,
      climateRecirculation: false,
      climateHeaterEnabled: false,
      climateDefrosterEnabled: false,
      compressorMechanicalPowerW: 0,
      compressorLoadTorqueNm: 0,
      blowerElectricalPowerW: 0,
      ignitionPosition: 'OFF',
      ignitionType: resolvedIgnition.type,
      ignitionStartInterlock: resolvedIgnition.startInterlock,
      batteryVoltageV: ignition.getBatteryVoltageV(),
      isBatteryDischarged: false,
      ignitionStartAttempts: 0,
      ignitionFailedAttempts: 0,
      ignitionFailureReason: null,
      fogLightsEnabled: false,
      hasFogLights: lighting.supportsFogLights(),
      turnSignal: 'off',
      leftTurnSignal: false,
      rightTurnSignal: false,
      hazardLights: false,
      leftIndicatorLit: false,
      rightIndicatorLit: false,
      hazardIndicatorLit: false,
      parkingLightsLit: true,
      lowBeamLit: true,
      highBeamLit: false,
      fogLightsLit: false,
      isMapOpen: true,
      mapViewportSize: 'balanced',
      shifterLayout: !isAutoOrCvt ? 'h_pattern' : 'sequential',
      isGearGrinding: false,
      gearGrindTrigger: 0,
      dragStage: 'idle',
      dragTimeSlip: null,
      _dragDistanceTraveled: 0,
      _dragTimerStart: null,
      _dragGreenTime: null,
      _accumulator: 0,
      _phys: initialPhys,
    })
  },

  startEngine: (options?: { enforceInterlock?: boolean }) => {
    const {
      _engine,
      _ignition,
      transmissionMode,
      _transmission,
      _clutch,
      currentGear,
      clutchPosition,
      brake,
      isEngineBlown,
      isOutOfFuel,
    } = get()
    if (!_engine) return

    // Se já estiver no processo de partida (cranking), ignora para evitar reiniciar o arranque
    if (_engine.getStatus() === 'starting') return

    const enforceInterlock = options?.enforceInterlock ?? false
    if (_ignition) {
      const attempt = _ignition.attemptCrank({
        brake,
        clutch: clutchPosition,
        engineStatus: _engine.getStatus(),
        isEngineBlown,
        isOutOfFuel,
        enforceInterlock,
      })
      const ignSnap = _ignition.getStateSnapshot()
      if (!attempt.shouldStartEngine) {
        HapticFeedback.light()
        if (isEngineBlown) {
          set({
            isRunning: false,
            isStalled: true,
            status: 'stalled',
            ignitionPosition: ignSnap.position,
            ignitionStartAttempts: ignSnap.startAttempts,
            ignitionFailedAttempts: ignSnap.failedAttempts,
            ignitionFailureReason: ignSnap.lastFailureReason,
          })
          return
        }
        if (isOutOfFuel) {
          set({
            isRunning: false,
            isStalled: true,
            status: 'stalled',
            damageReason: 'Pane Seca: Sem combustível!',
            ignitionPosition: ignSnap.position,
            ignitionStartAttempts: ignSnap.startAttempts,
            ignitionFailedAttempts: ignSnap.failedAttempts,
            ignitionFailureReason: ignSnap.lastFailureReason,
          })
          return
        }
        set({
          ignitionPosition: ignSnap.position,
          ignitionStartAttempts: ignSnap.startAttempts,
          ignitionFailedAttempts: ignSnap.failedAttempts,
          ignitionFailureReason: ignSnap.lastFailureReason,
        })
        return
      }
    } else {
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

    const ignSnap = _ignition?.getStateSnapshot()
    set({
      isRunning: startedRunning,
      isStalled: false,
      status: startedStatus,
      rpm: startedRpm,
      currentGear: startedGear,
      damageReason: null,
      ignitionPosition: ignSnap?.position ?? 'CRANK',
      ignitionStartAttempts: ignSnap?.startAttempts ?? get().ignitionStartAttempts + 1,
      ignitionFailedAttempts: ignSnap?.failedAttempts ?? get().ignitionFailedAttempts,
      ignitionFailureReason: null,
    })
  },

  requestEngineStart: (enforceInterlock = true) => {
    const prevAttempts = get().ignitionFailedAttempts
    get().startEngine({ enforceInterlock })
    const st = get()
    return st.status === 'starting' || st.isRunning || st.ignitionFailedAttempts === prevAttempts
  },

  setIgnitionPosition: (pos: IgnitionPosition, enforceInterlock = true) => {
    const { _ignition, _engine, brake, clutchPosition, isEngineBlown, isOutOfFuel } = get()
    if (!_ignition) return false

    if (pos === 'CRANK') {
      return get().requestEngineStart(enforceInterlock)
    }

    const result = _ignition.setPosition(pos, {
      brake,
      clutch: clutchPosition,
      engineStatus: _engine?.getStatus() ?? 'off',
      isEngineBlown,
      isOutOfFuel,
      enforceInterlock,
    })

    if (result.shouldStopEngine && _engine && (_engine.getIsRunning() || _engine.getStatus() === 'starting')) {
      get().stopEngine()
    }

    const snap = _ignition.getStateSnapshot()
    set({
      ignitionPosition: snap.position,
      batteryVoltageV: snap.batteryVoltageV,
      isBatteryDischarged: snap.isBatteryDischarged,
      ignitionStartAttempts: snap.startAttempts,
      ignitionFailedAttempts: snap.failedAttempts,
      ignitionFailureReason: snap.lastFailureReason,
    })
    HapticFeedback.light()
    return result.failureReason === null
  },

  advanceIgnition: (enforceInterlock = true) => {
    const { _ignition, _engine, brake, clutchPosition, isEngineBlown, isOutOfFuel } = get()
    if (!_ignition) return false

    const result = _ignition.advanceStage({
      brake,
      clutch: clutchPosition,
      engineStatus: _engine?.getStatus() ?? 'off',
      isEngineBlown,
      isOutOfFuel,
      enforceInterlock,
    })

    if (result.shouldStartEngine) {
      // Executa partida mecânica (interlock já validado acima)
      get().startEngine({ enforceInterlock: false })
      return true
    }

    if (result.shouldStopEngine) {
      get().stopEngine()
    }

    const snap = _ignition.getStateSnapshot()
    set({
      ignitionPosition: snap.position,
      batteryVoltageV: snap.batteryVoltageV,
      isBatteryDischarged: snap.isBatteryDischarged,
      ignitionStartAttempts: snap.startAttempts,
      ignitionFailedAttempts: snap.failedAttempts,
      ignitionFailureReason: snap.lastFailureReason,
    })
    HapticFeedback.light()
    return result.failureReason === null
  },

  stepBackIgnitionKey: () => {
    const { _ignition } = get()
    if (!_ignition) return
    const res = _ignition.stepBackKey()
    if (res.shouldStopEngine) {
      get().stopEngine()
    }
    const snap = _ignition.getStateSnapshot()
    set({
      ignitionPosition: snap.position,
      ignitionFailureReason: snap.lastFailureReason,
    })
    HapticFeedback.light()
  },

  setBatteryDischarged: (discharged: boolean) => {
    const { _ignition } = get()
    _ignition?.setBatteryDischarged(discharged)
    const snap = _ignition?.getStateSnapshot()
    set({
      isBatteryDischarged: Boolean(discharged),
      batteryVoltageV: snap?.batteryVoltageV ?? (discharged ? 8.4 : IGNITION_CALIBRATION.BATTERY_REST_VOLTAGE_V),
    })
  },

  stopEngine: () => {
    const { _engine, _ignition, _transmission, transmissionMode, _phys } = get()
    if (!_engine) return

    _engine.stop()
    _engine.setAccessoryLoadTorque(0)
    _ignition?.setPosition('OFF')
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
      ignitionPosition: 'OFF',
      isCompressorEngaged: false,
      compressorMechanicalPowerW: 0,
      compressorLoadTorqueNm: 0,
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
    const { _config, _physics, _clutch } = get()
    set((state) => {
      const hasTurbo = Boolean(_config?.engine.turbo?.enabled || (upgrades.turboKit !== undefined ? upgrades.turboKit : state.hasTurbo))
      const turboLevel = upgrades.turboLevel ?? state.turboLevel ?? (hasTurbo ? 'basic' : 'none')
      const engineInternals = upgrades.engineInternals ?? state.engineInternals ?? 'stock'
      const rearWingType = upgrades.rearWingType ?? state.rearWingType ?? (_config?.id === 'porsche-gt3' || _config?.id === 'civic-si' ? 'oem' : 'none')
      const exhaustType = upgrades.exhaustType ?? state.exhaustType
      const intakeType = upgrades.intakeType ?? state.intakeType
      const tires = upgrades.tires ?? state.tires
      const clutchUpgrade = upgrades.clutchUpgrade ?? state.clutchUpgrade ?? 'stock'
      const brakeUpgrade = upgrades.brakeUpgrade ?? state.brakeUpgrade ?? 'stock'
      const tuningStage = upgrades.tuningStage ?? state.tuningStage
      const hasRetrofitInfotainment =
        upgrades.multimediaKit !== undefined ? upgrades.multimediaKit : state.hasRetrofitInfotainment
      const hasBoostGaugeKit =
        upgrades.boostGaugeKit !== undefined ? upgrades.boostGaugeKit : state.hasBoostGaugeKit
      const hasNosKit =
        upgrades.hasNosKit !== undefined ? upgrades.hasNosKit : state.hasNosKit
      const exhaustValveOpen = upgrades.exhaustValveOpen ?? state.exhaustValveOpen
      const hasPopsAndBangs =
        upgrades.hasPopsAndBangs !== undefined ? upgrades.hasPopsAndBangs : state.hasPopsAndBangs
      const popsAndBangsEnabled =
        upgrades.popsAndBangsEnabled !== undefined ? upgrades.popsAndBangsEnabled : state.popsAndBangsEnabled
      const suspensionHeight = upgrades.suspensionHeight ?? state.suspensionHeight
      const rearWingPosition = upgrades.rearWingPosition ?? state.rearWingPosition

      if (_clutch) {
        _clutch.setCeramicClutch(clutchUpgrade === 'ceramic')
      }

      if (_physics) {
        _physics.setBrakeUpgrade(brakeUpgrade)
        _physics.setTireCompound(tires, state.isRaining)
        _physics.setSuspensionHeight(suspensionHeight)
        _physics.setAerodynamics(rearWingPosition, state.isAeroWingExtended, rearWingType)
      }

      return {
        hasTurbo,
        turboLevel,
        engineInternals,
        rearWingType,
        exhaustType,
        intakeType,
        tires,
        clutchUpgrade,
        brakeUpgrade,
        tuningStage,
        hasRetrofitInfotainment,
        hasBoostGaugeKit,
        hasNosKit,
        exhaustValveOpen,
        hasPopsAndBangs,
        popsAndBangsEnabled,
        suspensionHeight,
        rearWingPosition,
      }
    })
  },

  setAeroWing: (extended: boolean) => {
    const { _physics, rearWingPosition, rearWingType } = get()
    _physics?.setAerodynamics(rearWingPosition, extended, rearWingType)
    set({ isAeroWingExtended: extended })
    HapticFeedback.light()
  },

  toggleAeroWing: () => {
    get().setAeroWing(!get().isAeroWingExtended)
  },

  setSuspensionHeight: (height: SuspensionHeight) => {
    const { _physics } = get()
    _physics?.setSuspensionHeight(height)
    set({ suspensionHeight: height })
    HapticFeedback.light()
  },

  setRearWingPosition: (pos: RearWingPosition) => {
    const { _physics, isAeroWingExtended, rearWingType } = get()
    _physics?.setAerodynamics(pos, isAeroWingExtended, rearWingType)
    set({ rearWingPosition: pos })
    HapticFeedback.light()
  },

  togglePopsAndBangs: () => {
    const next = !get().popsAndBangsEnabled
    set({ popsAndBangsEnabled: next })
    const instanceId = get().garageInstanceId
    if (instanceId) {
      useGarageStore.getState().installUpgrade(instanceId, { popsAndBangsEnabled: next })
    }
    HapticFeedback.light()
  },

  cycleHeadlights: () => {
    const { _lighting } = get()
    if (_lighting) {
      _lighting.cycleHeadlightsMode()
      const snap = _lighting.getStateSnapshot()
      set({
        headlightsMode: snap.headlightsMode,
        fogLightsEnabled: snap.fogLightsEnabled,
        parkingLightsLit: snap.parkingLightsLit,
        lowBeamLit: snap.lowBeamLit,
        highBeamLit: snap.highBeamLit,
        fogLightsLit: snap.fogLightsLit,
      })
    } else {
      const modes: ('off' | 'parking' | 'low' | 'high')[] = ['off', 'parking', 'low', 'high']
      const current = get().headlightsMode
      const nextIdx = (modes.indexOf(current) + 1) % modes.length
      set({ headlightsMode: modes[nextIdx] })
    }
    HapticFeedback.light()
  },

  setHeadlightsMode: (mode: 'off' | 'parking' | 'low' | 'high') => {
    const { _lighting } = get()
    if (_lighting) {
      _lighting.setHeadlightsMode(mode)
      const snap = _lighting.getStateSnapshot()
      set({
        headlightsMode: snap.headlightsMode,
        fogLightsEnabled: snap.fogLightsEnabled,
        parkingLightsLit: snap.parkingLightsLit,
        lowBeamLit: snap.lowBeamLit,
        highBeamLit: snap.highBeamLit,
        fogLightsLit: snap.fogLightsLit,
      })
    } else {
      set({ headlightsMode: mode })
    }
    HapticFeedback.light()
  },

  toggleFogLights: () => {
    const { _lighting } = get()
    if (!_lighting) return
    _lighting.toggleFogLights()
    const snap = _lighting.getStateSnapshot()
    set({
      headlightsMode: snap.headlightsMode,
      fogLightsEnabled: snap.fogLightsEnabled,
      parkingLightsLit: snap.parkingLightsLit,
      lowBeamLit: snap.lowBeamLit,
      highBeamLit: snap.highBeamLit,
      fogLightsLit: snap.fogLightsLit,
    })
    HapticFeedback.light()
  },

  setFogLightsEnabled: (enabled: boolean) => {
    const { _lighting } = get()
    if (!_lighting) return
    _lighting.setFogLightsEnabled(enabled)
    const snap = _lighting.getStateSnapshot()
    set({
      headlightsMode: snap.headlightsMode,
      fogLightsEnabled: snap.fogLightsEnabled,
      parkingLightsLit: snap.parkingLightsLit,
      lowBeamLit: snap.lowBeamLit,
      highBeamLit: snap.highBeamLit,
      fogLightsLit: snap.fogLightsLit,
    })
    HapticFeedback.light()
  },

  toggleLeftTurnSignal: () => {
    const { _lighting } = get()
    if (!_lighting) return
    _lighting.toggleLeftTurnSignal()
    const snap = _lighting.getStateSnapshot()
    set({
      turnSignal: snap.turnSignal,
      leftTurnSignal: snap.leftTurnSignal,
      rightTurnSignal: snap.rightTurnSignal,
      leftIndicatorLit: snap.leftIndicatorLit,
      rightIndicatorLit: snap.rightIndicatorLit,
      hazardIndicatorLit: snap.hazardIndicatorLit,
    })
    HapticFeedback.light()
  },

  toggleRightTurnSignal: () => {
    const { _lighting } = get()
    if (!_lighting) return
    _lighting.toggleRightTurnSignal()
    const snap = _lighting.getStateSnapshot()
    set({
      turnSignal: snap.turnSignal,
      leftTurnSignal: snap.leftTurnSignal,
      rightTurnSignal: snap.rightTurnSignal,
      leftIndicatorLit: snap.leftIndicatorLit,
      rightIndicatorLit: snap.rightIndicatorLit,
      hazardIndicatorLit: snap.hazardIndicatorLit,
    })
    HapticFeedback.light()
  },

  setTurnSignal: (selection: TurnSignalSelection) => {
    const { _lighting } = get()
    if (!_lighting) return
    _lighting.setTurnSignal(selection)
    const snap = _lighting.getStateSnapshot()
    set({
      turnSignal: snap.turnSignal,
      leftTurnSignal: snap.leftTurnSignal,
      rightTurnSignal: snap.rightTurnSignal,
      leftIndicatorLit: snap.leftIndicatorLit,
      rightIndicatorLit: snap.rightIndicatorLit,
      hazardIndicatorLit: snap.hazardIndicatorLit,
    })
    HapticFeedback.light()
  },

  toggleHazardLights: () => {
    const { _lighting } = get()
    if (!_lighting) return
    _lighting.toggleHazardLights()
    const snap = _lighting.getStateSnapshot()
    set({
      hazardLights: snap.hazardLights,
      leftIndicatorLit: snap.leftIndicatorLit,
      rightIndicatorLit: snap.rightIndicatorLit,
      hazardIndicatorLit: snap.hazardIndicatorLit,
    })
    HapticFeedback.light()
  },

  setHazardLights: (enabled: boolean) => {
    const { _lighting } = get()
    if (!_lighting) return
    _lighting.setHazardLights(enabled)
    const snap = _lighting.getStateSnapshot()
    set({
      hazardLights: snap.hazardLights,
      leftIndicatorLit: snap.leftIndicatorLit,
      rightIndicatorLit: snap.rightIndicatorLit,
      hazardIndicatorLit: snap.hazardIndicatorLit,
    })
    HapticFeedback.light()
  },

  setClimateAcEnabled: (enabled: boolean) => {
    const { _climate } = get()
    if (!_climate) return
    _climate.setAcEnabled(enabled)
    const snap = _climate.getStateSnapshot()
    set({
      climateAcEnabled: snap.acEnabled,
      climateFanLevel: snap.fanLevel,
      isCompressorEngaged: snap.isCompressorEngaged,
    })
    HapticFeedback.light()
  },

  toggleClimateAc: () => {
    const { _climate } = get()
    if (!_climate) return
    _climate.toggleAc()
    const snap = _climate.getStateSnapshot()
    set({
      climateAcEnabled: snap.acEnabled,
      climateFanLevel: snap.fanLevel,
      isCompressorEngaged: snap.isCompressorEngaged,
    })
    HapticFeedback.light()
  },

  setClimateTargetTempC: (tempC: number) => {
    const { _climate } = get()
    if (!_climate) return
    _climate.setTargetTempC(tempC)
    set({ climateTargetTempC: _climate.getTargetTempC() })
    HapticFeedback.light()
  },

  stepClimateTargetTempC: (deltaC: number) => {
    const { _climate } = get()
    if (!_climate) return
    _climate.stepTargetTempC(deltaC)
    set({ climateTargetTempC: _climate.getTargetTempC() })
    HapticFeedback.light()
  },

  setClimateFanLevel: (level: FanLevel) => {
    const { _climate } = get()
    if (!_climate) return
    _climate.setFanLevel(level)
    const snap = _climate.getStateSnapshot()
    set({
      climateFanLevel: snap.fanLevel,
      climateAutoMode: snap.autoMode,
    })
    HapticFeedback.light()
  },

  setClimateAutoMode: (enabled: boolean) => {
    const { _climate } = get()
    if (!_climate) return
    _climate.setAutoMode(enabled)
    const snap = _climate.getStateSnapshot()
    set({
      climateAutoMode: snap.autoMode,
      climateAcEnabled: snap.acEnabled,
      climateHeaterEnabled: snap.heaterEnabled,
      climateFanLevel: snap.fanLevel,
    })
    HapticFeedback.light()
  },

  toggleClimateAutoMode: () => {
    const { _climate } = get()
    if (!_climate) return
    _climate.toggleAutoMode()
    const snap = _climate.getStateSnapshot()
    set({
      climateAutoMode: snap.autoMode,
      climateAcEnabled: snap.acEnabled,
      climateHeaterEnabled: snap.heaterEnabled,
      climateFanLevel: snap.fanLevel,
    })
    HapticFeedback.light()
  },

  setClimateRecirculation: (enabled: boolean) => {
    const { _climate } = get()
    if (!_climate) return
    _climate.setRecirculation(enabled)
    set({ climateRecirculation: _climate.isRecirculationEnabled() })
    HapticFeedback.light()
  },

  toggleClimateRecirculation: () => {
    const { _climate } = get()
    if (!_climate) return
    _climate.toggleRecirculation()
    set({ climateRecirculation: _climate.isRecirculationEnabled() })
    HapticFeedback.light()
  },

  setClimateHeaterEnabled: (enabled: boolean) => {
    const { _climate } = get()
    if (!_climate) return
    _climate.setHeaterEnabled(enabled)
    const snap = _climate.getStateSnapshot()
    set({
      climateHeaterEnabled: snap.heaterEnabled,
      climateFanLevel: snap.fanLevel,
    })
    HapticFeedback.light()
  },

  toggleClimateHeater: () => {
    const { _climate } = get()
    if (!_climate) return
    _climate.toggleHeater()
    const snap = _climate.getStateSnapshot()
    set({
      climateHeaterEnabled: snap.heaterEnabled,
      climateFanLevel: snap.fanLevel,
    })
    HapticFeedback.light()
  },

  setClimateDefrosterEnabled: (enabled: boolean) => {
    const { _climate } = get()
    if (!_climate) return
    _climate.setDefrosterEnabled(enabled)
    const snap = _climate.getStateSnapshot()
    set({
      climateDefrosterEnabled: snap.defrosterEnabled,
      climateFanLevel: snap.fanLevel,
    })
    HapticFeedback.light()
  },

  toggleClimateDefroster: () => {
    const { _climate } = get()
    if (!_climate) return
    _climate.toggleDefroster()
    const snap = _climate.getStateSnapshot()
    set({
      climateDefrosterEnabled: snap.defrosterEnabled,
      climateFanLevel: snap.fanLevel,
    })
    HapticFeedback.light()
  },

  setAmbientTempC: (tempC: number) => {
    const { _climate } = get()
    if (!_climate) return
    _climate.setAmbientTempC(tempC)
    set({
      ambientTempC: _climate.getAmbientTempC(),
      cabinTempC: _climate.getCabinTempC(),
    })
  },

  toggleRain: () => {
    const nextRain = !get().isRaining
    const { _physics, tires } = get()
    if (_physics) {
      _physics.setTireCompound(tires, nextRain)
    }
    set({ isRaining: nextRain, isWiperActive: nextRain ? true : get().isWiperActive })
    HapticFeedback.light()
  },

  toggleWipers: () => {
    set({ isWiperActive: !get().isWiperActive })
    HapticFeedback.light()
  },

  setSteeringAngle: (angle: number, source?: SteeringMethod) => {
    // Volante touch virtual foi removido do mobile. Apenas tilt físico e keyboard (desktop) são aceitos.
    if (source === 'touch') return
    const safeAngle = Number.isFinite(angle) ? angle : 0
    set({ steeringAngle: clamp(safeAngle, -1, 1) })
  },

  setSteeringMethod: (method: SteeringMethod) => {
    set({
      steeringMethod: method,
      tiltSteeringEnabled: method === 'tilt',
      steeringAngle: 0,
    })
  },

  setTiltSteeringEnabled: (enabled: boolean) => {
    set({
      tiltSteeringEnabled: enabled,
      steeringMethod: enabled ? 'tilt' : 'touch',
      steeringAngle: 0,
    })
  },

  setSteeringSensitivity: (sens: number) => {
    if (Number.isFinite(sens)) {
      set({ steeringSensitivity: clamp(sens, 0.2, 3.5) })
    }
  },

  setSteeringDeadzone: (deadzone: number) => {
    if (Number.isFinite(deadzone)) {
      set({ steeringDeadzone: clamp(deadzone, 0, 15) })
    }
  },

  toggleMap: () => {
    const nextOpen = !get().isMapOpen
    set({ isMapOpen: nextOpen })
    useUIStore.getState().setMapOpen(nextOpen)
    HapticFeedback.light()
  },

  setMapOpen: (open: boolean) => {
    set({ isMapOpen: open })
    useUIStore.getState().setMapOpen(open)
  },

  setMapViewportSize: (size: MapViewportSize) => {
    set({ mapViewportSize: size })
    useUIStore.getState().setMapViewportSize(size)
  },

  resetPosition: () => {
    const { _physics } = get()
    if (_physics) {
      _physics.setPosition(0, 25, 0)
    }
    set({
      positionX: 0,
      positionY: 25,
      headingDeg: 0,
      visualPositionX: 0,
      visualPositionY: 25,
      visualHeadingDeg: 0,
      surfaceType: 'asphalt',
      zoneName: 'Rotatória Central',
    })
    HapticFeedback.medium()
  },

  setSensorPermission: (perm: SensorPermissionState) => {
    set({ sensorPermission: perm })
  },

  setFourWheelDriveMode: (mode: FourWheelDriveMode) => {
    const currentSpeedKmh = get().speed
    if (mode === '4wd_low' && currentSpeedKmh > 3.0) {
      set({ fourWheelDriveWarning: '4WD LOW: Pare o veículo para engatar!' })
      setTimeout(() => {
        if (get().fourWheelDriveWarning === '4WD LOW: Pare o veículo para engatar!') {
          set({ fourWheelDriveWarning: null })
        }
      }, 3500)
      return
    }

    const { _transmission, _config, gearSelectorPosition, fourWheelDriveMode: prevMode } = get()
    if (_config?.id === 'fiat-toro-ranch-2025' && _transmission && gearSelectorPosition === 'D') {
      if (mode === '4wd_low' && currentSpeedKmh <= 3.0) {
        // Em 4WD LOW engata a 1ª marcha ultracurta de crawl ratio (4.700:1)
        _transmission.shiftTo(1, currentSpeedKmh)
        set({ currentGear: 1 })
      } else if (mode !== '4wd_low' && prevMode === '4wd_low' && currentSpeedKmh <= 3.0) {
        // Ao desengatar 4WD LOW para AUTO ou 4WD LOCK com veículo parado, retorna para a 2ª marcha padrão (2.840:1)
        _transmission.shiftTo(2, currentSpeedKmh)
        set({ currentGear: 2 })
      }
    }

    set({ fourWheelDriveMode: mode, fourWheelDriveWarning: null })
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
        const isToroRanch = _config?.id === 'fiat-toro-ranch-2025'
        const isLowMode = get().fourWheelDriveMode === '4wd_low'
        const defaultForwardGear = isToroRanch && !isLowMode ? 2 : 1
        const targetGear = get().currentGear > 0 ? get().currentGear : defaultForwardGear
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
        const targetGear = speed < 2 ? 1 : (get().currentGear > 0 ? get().currentGear : 1)
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
    const { _windows, _physics } = get()
    if (_windows) {
      if (_windows.getWindowCount() === 0) return
      _windows.toggleAllWindows()
      const snap = _windows.getStateSnapshot()
      _physics?.setWindowAeroDragMultiplier(snap.aeroDragMultiplier)
      set({
        windowsOpen: snap.windowsOpen,
        windowPositions: snap.positions,
        windowTargets: snap.targets,
        windowAverageOpenRatio: snap.averageOpenRatio,
        windowAeroDragMultiplier: snap.aeroDragMultiplier,
        cabinNoiseLevel: snap.cabinNoiseLevel,
        cabinFilterCutoffHz: snap.cabinFilterCutoffHz,
      })
    } else {
      const next = !get().windowsOpen
      set({ windowsOpen: next })
    }
    HapticFeedback.light()
  },

  setWindowsOpen: (open: boolean) => {
    const { _windows, _physics } = get()
    if (_windows) {
      _windows.setWindowsOpen(open)
      const snap = _windows.getStateSnapshot()
      _physics?.setWindowAeroDragMultiplier(snap.aeroDragMultiplier)
      set({
        windowsOpen: snap.windowsOpen,
        windowPositions: snap.positions,
        windowTargets: snap.targets,
        windowAverageOpenRatio: snap.averageOpenRatio,
        windowAeroDragMultiplier: snap.aeroDragMultiplier,
        cabinNoiseLevel: snap.cabinNoiseLevel,
        cabinFilterCutoffHz: snap.cabinFilterCutoffHz,
      })
    } else {
      set({ windowsOpen: open })
    }
  },

  setWindowPosition: (id: WindowId, openRatio: number) => {
    const { _windows, _physics } = get()
    if (!_windows) return
    _windows.setWindowPosition(id, openRatio)
    const snap = _windows.getStateSnapshot()
    _physics?.setWindowAeroDragMultiplier(snap.aeroDragMultiplier)
    set({
      windowsOpen: snap.windowsOpen,
      windowPositions: snap.positions,
      windowTargets: snap.targets,
      windowAverageOpenRatio: snap.averageOpenRatio,
      windowAeroDragMultiplier: snap.aeroDragMultiplier,
      cabinNoiseLevel: snap.cabinNoiseLevel,
      cabinFilterCutoffHz: snap.cabinFilterCutoffHz,
    })
  },

  setWindowTarget: (id: WindowId, targetRatio: number) => {
    const { _windows } = get()
    if (!_windows) return
    _windows.setWindowTarget(id, targetRatio)
    const snap = _windows.getStateSnapshot()
    set({
      windowTargets: snap.targets,
    })
  },

  stepWindowPosition: (id: WindowId, deltaRatio: number) => {
    const { _windows, _physics } = get()
    if (!_windows) return
    _windows.stepWindowPosition(id, deltaRatio)
    const snap = _windows.getStateSnapshot()
    _physics?.setWindowAeroDragMultiplier(snap.aeroDragMultiplier)
    set({
      windowsOpen: snap.windowsOpen,
      windowPositions: snap.positions,
      windowTargets: snap.targets,
      windowAverageOpenRatio: snap.averageOpenRatio,
      windowAeroDragMultiplier: snap.aeroDragMultiplier,
      cabinNoiseLevel: snap.cabinNoiseLevel,
      cabinFilterCutoffHz: snap.cabinFilterCutoffHz,
    })
    HapticFeedback.light()
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

  setSpeed: (speedKmh: number) => {
    const { _physics } = get()
    if (_physics) {
      _physics.setSpeedKmh(speedKmh)
      set((s) => ({
        speed: speedKmh,
        _phys: {
          ...s._phys,
          speedKmh,
        },
      }))
    }
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
    const {
      _engine,
      _transmission,
      _autoTransmission,
      _clutch,
      _physics,
      _tcs,
      _climate,
      _windows,
      _ignition,
      _lighting,
      _config,
      _integrator,
    } = state

    if (!_engine || !_transmission || !_clutch || !_physics || !_config || !_integrator) return

    if (state.isPaused || _integrator.isPaused()) {
      return
    }

    if (_integrator.getIntegrityStatus() === 'FAIL_SAFE_HOLD') {
      return
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    let phys: PhysicsInternalState = { ...state._phys }

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
      if (injectedSpeedFloor > 0) {
        _physics.setSpeedKmh(injectedSpeedFloor)
      }
    }
    if (state.topSpeedRecord !== phys.lastPubTopSpeedRecord) {
      phys.topSpeedRecord = state.topSpeedRecord
      phys.lastPubTopSpeedRecord = state.topSpeedRecord
    }

    const prevRevLimiting = phys.isRevLimiting

    // Contexto de entrada imutável para os subpassos determinísticos
    const substepContext: SimulationSubstepContext = {
      throttle: state.throttle,
      brake: state.brake,
      handbrake: state.handbrake,
      drivingMode: state.drivingMode,
      transmissionMode: state.transmissionMode,
      gearSelectorPosition: state.gearSelectorPosition,
      tuningStage: state.tuningStage,
      intakeType: state.intakeType,
      exhaustType: state.exhaustType,
      hasTurbo: state.hasTurbo,
      hasNosKit: state.hasNosKit,
      hasPopsAndBangs: state.hasPopsAndBangs,
      popsAndBangsEnabled: state.popsAndBangsEnabled,
      suspensionHeight: state.suspensionHeight,
      rearWingPosition: state.rearWingPosition,
      rearWingType: state.rearWingType,
      tires: state.tires,
      isRaining: state.isRaining,
      isAeroWingExtended: state.isAeroWingExtended,
      hasLaunchControl: state.hasLaunchControl,
      hasBoostGaugeKit: state.hasBoostGaugeKit,
      fuelType: state.fuelType,
      engineInternals: state.engineInternals,
      turboLevel: state.turboLevel,
      now,
      injectedSpeedFloor,
      steeringAngle: state.steeringAngle,
      fourWheelDriveMode: state.fourWheelDriveMode,
      clutchUpgrade: state.clutchUpgrade,
      brakeUpgrade: state.brakeUpgrade,
    }

    // Sincroniza o estado mestre do integrador com eventuais injeções externas
    const currentCandidate = _integrator.getState()
    currentCandidate.phys = phys
    currentCandidate.timer0to100State = { ...state._timer0to100State }
    currentCandidate.engine = _engine.getStateSnapshot()
    currentCandidate.clutch = _clutch.getStateSnapshot()
    currentCandidate.transmission = _transmission.getStateSnapshot()
    currentCandidate.autoTransmission = _autoTransmission ? _autoTransmission.getStateSnapshot() : null
    currentCandidate.physics = _physics.getStateSnapshot()
    currentCandidate.climate = _climate ? _climate.getStateSnapshot() : undefined
    currentCandidate.windows = _windows ? _windows.getStateSnapshot() : undefined
    currentCandidate.ignition = _ignition ? _ignition.getStateSnapshot() : undefined
    currentCandidate.lighting = _lighting ? _lighting.getStateSnapshot() : undefined
    const syncSuccess = _integrator.setState(currentCandidate)
    if (!syncSuccess) {
      // Estado externo continha NaN/Infinito: ativa FAIL_SAFE_HOLD e restaura subsistemas
      const validMaster = _integrator.getState()
      _engine.restoreSnapshot(validMaster.engine)
      _clutch.restoreSnapshot(validMaster.clutch)
      _transmission.restoreSnapshot(validMaster.transmission)
      if (_autoTransmission && validMaster.autoTransmission) {
        _autoTransmission.restoreSnapshot(validMaster.autoTransmission)
      }
      _physics.restoreSnapshot(validMaster.physics)

      set({
        physicsIntegrityStatus: 'FAIL_SAFE_HOLD',
        _phys: validMaster.phys,
        _timer0to100State: validMaster.timer0to100State,
        _accumulator: _integrator.getAccumulator(),
      })
      console.warn('[HEATZ FAIL_SAFE_HOLD] Falha detectada na sincronização de subsistema. Simulação congelada.', _integrator.getLastFault())
      return
    }

    // Executa a evolução temporal determinística a 120 Hz com isolamento transacional
    const stepResult = _integrator.step(
      frameTime,
      substepContext,
      (cand, dt, ctx, substepIdx) => {
        // 0. Restaura snapshots no início do subpasso
        _engine.restoreSnapshot(cand.engine)
        _clutch.restoreSnapshot(cand.clutch)
        _transmission.restoreSnapshot(cand.transmission)
        if (_autoTransmission && cand.autoTransmission) {
          _autoTransmission.restoreSnapshot(cand.autoTransmission)
        }
        _physics.restoreSnapshot(cand.physics)
        if (_climate && cand.climate) _climate.restoreSnapshot(cand.climate)
        if (_windows && cand.windows) _windows.restoreSnapshot(cand.windows)
        if (_ignition && cand.ignition) _ignition.restoreSnapshot(cand.ignition)
        if (_lighting && cand.lighting) _lighting.restoreSnapshot(cand.lighting)

        const substepPhys = cand.phys
        let substepTimer0to100 = cand.timer0to100State

        // 0.1 Evolução a 120 Hz dos sistemas de Cabine (Vidros, Ignição, Climatização e Iluminação)
        const winSnap = _windows ? _windows.tick(dt) : null
        const ignSnap = _ignition
          ? _ignition.tick({
              deltaTime: dt,
              engineStatus: _engine.getStatus(),
              engineRpm: _engine.getRpm(),
              isEngineBlown: substepPhys.isEngineBlown,
              isOutOfFuel: substepPhys.isOutOfFuel,
            })
          : null
        const climSnap = _climate
          ? _climate.tick({
              deltaTime: dt,
              isEngineRunning: _engine.getIsRunning(),
              engineRpm: _engine.getRpm(),
              coolantTempC: substepPhys.coolantTemp,
              ignitionPosition: ignSnap?.position ?? (_engine.getIsRunning() ? 'ON' : 'OFF'),
              windowOpenRatio: winSnap?.averageOpenRatio ?? 0,
              isRaining: ctx.isRaining,
              speedKmh: substepPhys.speedKmh,
            })
          : null
        if (_lighting) {
          _lighting.tick(dt)
        }

        // Ponto único de aplicação da carga mecânica do compressor de A/C no virabrequim
        _engine.setAccessoryLoadTorque(climSnap?.compressorLoadTorqueNm ?? 0)
        // Ponto único de aplicação do modificador aerodinâmico de vidros abertos
        _physics.setWindowAeroDragMultiplier(winSnap?.aeroDragMultiplier ?? 1.0)

        substepPhys.rpm = _engine.getRpm()
        substepPhys.gear = _transmission.currentGear
        substepPhys.isRunning = _engine.getIsRunning()

        // ─── Launch Control Lógica de Armação / Disparo ───
        const canLaunch = ctx.hasLaunchControl && substepPhys.isRunning && !ctx.handbrake
        const isStationary = substepPhys.speedKmh < 3.5
        const isLaunchGear = substepPhys.gear === 1 || (ctx.transmissionMode === 'automatic' && substepPhys.gear === 1)

        if (canLaunch && isStationary && isLaunchGear && ctx.brake >= 0.60 && ctx.throttle >= 0.65) {
          substepPhys.isLaunchControlArmed = true
          substepPhys.isLaunching = false
        } else if (substepPhys.isLaunchControlArmed && ctx.brake < 0.25 && ctx.throttle >= 0.50) {
          substepPhys.isLaunchControlArmed = false
          substepPhys.isLaunching = true
        } else if (substepPhys.isLaunchControlArmed && (ctx.throttle < 0.40 || substepPhys.gear === 0 || ctx.handbrake)) {
          substepPhys.isLaunchControlArmed = false
          substepPhys.isLaunching = false
        }

        if (substepPhys.isLaunching && (substepPhys.speedKmh > 45 || ctx.throttle < 0.3 || substepPhys.gear > 1)) {
          substepPhys.isLaunching = false
        }

        performanceMonitor.recordPhysicsTick()

        // ─── 1. Tomada de Decisão da Transmissão ───
        if (ctx.transmissionMode === 'automatic' && _autoTransmission) {
          if (substepPhys.isLaunchControlArmed) {
            _clutch.setPosition(0.95)
            substepPhys.isKickdown = false
          } else if (substepPhys.isLaunching) {
            // Modulação progressiva da dupla embreagem úmida durante o Launch Control:
            // mantém acoplamento alto sem travar abruptamente o virabrequim a 0 km/h (evita estol)
            const launchEngagement = clamp(0.45 + (substepPhys.speedKmh / 28) * 0.55, 0.45, 1.0)
            _clutch.setPosition(1.0 - launchEngagement)
            substepPhys.isKickdown = true
          } else {
            const autoDecision = _autoTransmission.decide({
              currentRpm: _engine.getRpm(),
              vehicleSpeedKmh: _physics.getSpeedKmh(),
              throttle: ctx.throttle,
              brake: ctx.brake,
              currentGear: _transmission.currentGear,
              drivingMode: ctx.drivingMode,
              selectorPosition: ctx.gearSelectorPosition,
              fourWheelDriveMode: ctx.fourWheelDriveMode,
              maxPowerRpm: _config.engine.maxPowerRpm,
              maxTorqueRpm: _config.engine.maxTorqueRpm,
              revLimiter: _config.engine.revLimiter,
              deltaTime: dt,
            })

            substepPhys.isKickdown = autoDecision.isKickdown

            if (autoDecision.targetGear !== _transmission.currentGear) {
              _transmission.shiftTo(autoDecision.targetGear, _physics.getSpeedKmh())
              substepPhys.gear = autoDecision.targetGear
            }

            const autoClutchPosition = 1.0 - autoDecision.targetClutchEngagement
            _clutch.setPosition(autoClutchPosition)
          }
        } else if (ctx.transmissionMode === 'manual_simulated') {
          const speedKmh = _physics.getSpeedKmh()
          const currentRpm = _engine.getRpm()

          let targetClutchEngagement = 1.0
          if (speedKmh < 3 && ctx.throttle < 0.05 && ctx.brake > 0.1) {
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
          substepPhys.isKickdown = false
        } else {
          substepPhys.isKickdown = false
        }

        const gear = _transmission.currentGear
        substepPhys.gear = gear
        const isCvtContinuous =
          _config.transmission.type === 'cvt' &&
          state.gearSelectorPosition !== 'M' &&
          state.transmissionMode !== 'manual_simulated'
        const gearRatio =
          isCvtContinuous && _autoTransmission
            ? _autoTransmission.getCurrentCvtRatio()
            : _transmission.calculator.getGearRatio(gear)
        const finalDrive = _config.transmission.finalDrive
        const isInNeutral = gear === 0 || gear === -2

        // 2. Velocidade angular das rodas tracionadas e da entrada da transmissão
        // Usa wheelSpeedMs (rotação real das rodas, incluindo patinação/wheelspin) para evitar
        // reação impossível de torque travado no asfalto durante arrancadas fortes em carros manuais.
        const wheelLinearMs = Math.max(_physics.getSpeedMs(), _physics.getWheelSpeedMs())
        const wheelRadius = _config.info.wheelDiameter / 2
        const wheelAngVel = wheelLinearMs / wheelRadius
        const transInputAngVel = isInNeutral
          ? _engine.getAngularVelocity()
          : wheelAngVel * (gearRatio * finalDrive)

        const effectiveSubstepThrottle = substepPhys.isLaunchControlArmed
          ? Math.min(ctx.throttle, 0.45)
          : ctx.throttle

        // 3. ClutchSystem: torque de atrito transferido e carga física refletida pelo solo/drivetrain
        const totalGearRatioAbs = Math.abs(gearRatio * finalDrive)
        const maxReflectedRoadTorque =
          !isInNeutral && totalGearRatioAbs > 0.1
            ? (_physics.getMaxGripTorque() / (totalGearRatioAbs * 0.90)) * 1.15 + 45
            : 0
        const clutchState = _clutch.calculateTorqueTransfer(
          _engine.getAngularVelocity(),
          transInputAngVel,
          isInNeutral,
          _engine.getDrivetrainTorque(effectiveSubstepThrottle),
          dt,
          maxReflectedRoadTorque,
        )

        // 4. EngineSimulator: processa o tick com o torque de CARGA da embreagem sobre o volante
        const engineTick = _engine.tick({
          throttle: effectiveSubstepThrottle,
          loadTorque: clutchState.loadTorqueOnEngine,
          deltaTime: dt,
        })

        substepPhys.rpm = engineTick.rpm
        substepPhys.isRevLimiting = engineTick.isRevLimiting
        substepPhys.isRunning = _engine.getIsRunning()
        substepPhys.isStalled = engineTick.isStalled
        substepPhys.isBogWarning = engineTick.isBogWarning
        substepPhys.status = engineTick.status

        if (substepPhys.isLaunchControlArmed) {
          const launchRpm =
            _config.transmission.launchControl?.launchRpm ||
            (resolveVehicleDrivetrain(_config) === 'awd_ptm' ? 4500 : 3800)
          if (_engine.getRpm() > launchRpm) {
            _engine.setRpm(launchRpm)
            substepPhys.rpm = launchRpm
          }
        }

        substepPhys.clutchSlipRpm = clutchState.slipRpm
        substepPhys.clutchSlipRatio = clutchState.slipRatio
        substepPhys.clutchTorqueTransfer = clutchState.transmittedTorque
        substepPhys.clutchHeat = clutchState.heat
        substepPhys.isClutchSlipping = clutchState.isSlipping

        // 5. VehiclePhysics: calcula forças longitudinais com modificadores de Preparação, Peças e Modos
        const stage = ctx.tuningStage || 0
        const stageMult = stage === 1 ? 1.25 : stage === 2 ? 1.50 : stage === 3 ? 1.85 : 1.0
        const intakeMult = ctx.intakeType === 'cold_air' ? 1.06 : 1.0
        const exhaustMult =
          ctx.exhaustType === 'straight_pipe' ? 1.08
          : ctx.exhaustType === 'downpipe' ? 1.07
          : ctx.exhaustType === 'cat_back' ? 1.05
          : ctx.exhaustType === 'sport' ? 1.04
          : 1.0

        // Ganho de torque físico da turbina baseado na pressão instantânea de boost
        let turboKitMult = 1.0
        if (!_config.engine.turbo?.enabled && ctx.hasTurbo) {
          turboKitMult = 1.0 + Math.max(0, substepPhys.boostPressureBar) * 0.80
        } else if (_config.engine.turbo?.enabled) {
          const stockMaxBoost = _config.engine.turbo.maxBoostBar || 1.25
          if (substepPhys.boostPressureBar > stockMaxBoost) {
            turboKitMult = 1.0 + (substepPhys.boostPressureBar - stockMaxBoost) * 0.70
          }
        }

        // Gasolina Podium 102: avanço de ignição (+4% a +5% torque) conforme resolver declarativo
        let fuelTorqueMult = 1.0
        if (ctx.fuelType === 'premium_podium') {
          const fuelDefaults = resolveVehicleFuelDefaults(_config)
          if (fuelDefaults.podiumGainMultiplier > 1.0 && substepPhys.rpm >= fuelDefaults.podiumGainMinRpm) {
            fuelTorqueMult = fuelDefaults.podiumGainMultiplier
          }
        }

        const driveModeMult =
          ctx.drivingMode === 'track'
            ? 1.10
            : ctx.drivingMode === 'sport'
            ? 1.05
            : ctx.drivingMode === 'eco'
            ? 0.85
            : 1.0
        const isNosInjecting = substepPhys.nosActive && ctx.hasNosKit && substepPhys.nosPressurePercent > 0 && ctx.throttle > 0.65 && substepPhys.isRunning
        const nosMult = isNosInjecting ? 1.55 : 1.0
        const totalTorqueMult = stageMult * intakeMult * exhaustMult * turboKitMult * driveModeMult * nosMult * fuelTorqueMult
        substepPhys.fuelPowerMultiplier = fuelTorqueMult
        substepPhys.boostTorqueMultiplier = turboKitMult

        _physics.setTireCompound(ctx.tires, ctx.isRaining)
        _physics.setFourWheelDriveMode(ctx.fourWheelDriveMode)
        _physics.setSuspensionHeight(ctx.suspensionHeight)
        _physics.setAerodynamics(ctx.rearWingPosition, ctx.isAeroWingExtended, ctx.rearWingType)

        const rawBrake = Math.max(ctx.brake, ctx.handbrake || gear === -2 ? 1 : 0)
        const effectiveBrake = rawBrake * substepPhys.brakeFadeFactor
        const driveTorqueAtTransmission =
          clutchState.transmittedTorque >= 0
            ? clutchState.transmittedTorque * totalTorqueMult
            : clutchState.transmittedTorque
        const steeringAngleRad = (ctx.steeringAngle || 0) * 0.55
        const physicsTick = _physics.tick({
          driveTorqueAtTransmission,
          gearRatio,
          finalDrive,
          frontFinalDrive: _config.transmission.frontFinalDrive,
          brake: effectiveBrake,
          handbrake: ctx.handbrake,
          deltaTime: dt,
          steeringAngleRad,
          gear,
          isRaining: ctx.isRaining,
          brakeUpgrade: ctx.brakeUpgrade,
        })

        substepPhys.positionX = physicsTick.positionX
        substepPhys.positionY = physicsTick.positionY
        substepPhys.headingDeg = physicsTick.headingDeg
        substepPhys.lateralSpeedMs = physicsTick.lateralSpeedMs
        substepPhys.slipAngleDeg = physicsTick.slipAngleDeg
        substepPhys.lateralAccelG = physicsTick.lateralAccelG
        substepPhys.leanAngleDeg = physicsTick.leanAngleDeg
        substepPhys.isColliding = physicsTick.isColliding
        substepPhys.collisionBoundaryName = physicsTick.collisionBoundaryName
        substepPhys.surfaceType = physicsTick.surfaceType
        substepPhys.zoneName = physicsTick.zoneName
        substepPhys.absEngaged = physicsTick.absEngaged
        substepPhys.isAirbrakeActive = physicsTick.isAirbrakeActive

        const prevSubstepSpeed = substepPhys.speedKmh
        substepPhys.speedKmh = gear === -2 ? 0 : physicsTick.speedKmh
        if (gear === -2) {
          _physics.reset()
        }

        const timerStep = stepZeroToHundredTimer(substepTimer0to100, {
          prevSpeedKmh: prevSubstepSpeed,
          speedKmh: substepPhys.speedKmh,
          gear,
          throttle: ctx.throttle,
          brake: ctx.brake,
          handbrake: ctx.handbrake,
          isRunning: substepPhys.isRunning,
          deltaTime: dt,
        })
        substepTimer0to100 = timerStep.state
        if (timerStep.isNewBest) {
          useGarageStore.getState().addCredits(2500)
        }

        // 6. TractionControlSystem
        if (_tcs) {
          const tcsDecision = _tcs.decide({
            wheelTorque: physicsTick.wheelTorque,
            maxGripTorque: physicsTick.maxGripTorque,
            slipRatio: physicsTick.slipRatio,
            drivingMode: ctx.drivingMode,
            enabled: state.tcsEnabled,
          }, dt)

          substepPhys.tcsIntervening = tcsDecision.isIntervening
          substepPhys.tcsInterventionLevel = tcsDecision.interventionLevel

          if (tcsDecision.isIntervening && physicsTick.isWheelSlipping) {
            const reducedThrottle = ctx.throttle * tcsDecision.throttleMultiplier
            _engine.tick({
              throttle: reducedThrottle,
              loadTorque: 0,
              deltaTime: 0,
            })
          }
        }

        // 7. Quando 100% acoplado em movimento com rotação suficiente acima do estol, sincroniza RPM
        if (
          gear !== 0 &&
          _clutch.getEngagement() > 0.95 &&
          substepPhys.isRunning
        ) {
          const expectedRpm = _transmission.calculator.speedToRpm(substepPhys.speedKmh, gear)
          if (expectedRpm >= _config.engine.idleRpm * 0.85) {
            _engine.setRpm(expectedRpm)
            substepPhys.rpm = expectedRpm
          }
        }

        // ─── 8. Subsistemas Físicos Secundários em 120 Hz Contínuo ───

        // Turbo Boost Pressure Calculation
        if (ctx.hasTurbo) {
          const isOriginallyTurbo = !!_config.engine.turbo?.enabled
          const turboLevel = ctx.turboLevel || (isOriginallyTurbo ? 'basic' : 'none')

          let baseMaxBoost = 0
          let spoolRpm = 1800
          let fullRpm = 2800

          if (isOriginallyTurbo) {
            baseMaxBoost = _config.engine.turbo?.maxBoostBar ?? 1.25
            spoolRpm = _config.engine.turbo?.spoolRpmStart ?? 1800
            fullRpm = _config.engine.turbo?.fullBoostRpm ?? 2800

            if (turboLevel === 'basic') {
              baseMaxBoost += 0.30
            } else if (turboLevel === 'intermediate') {
              baseMaxBoost += 0.65
              spoolRpm += 150
              fullRpm += 200
            } else if (turboLevel === 'big_turbo') {
              baseMaxBoost += 1.20
              spoolRpm += 400
              fullRpm += 500
            }
          } else {
            // Motores aspirados com kit turbo instalado
            if (turboLevel === 'basic') {
              baseMaxBoost = 0.45
              spoolRpm = 2000
              fullRpm = 3200
            } else if (turboLevel === 'intermediate') {
              baseMaxBoost = 0.85
              spoolRpm = 2400
              fullRpm = 3800
            } else if (turboLevel === 'big_turbo') {
              baseMaxBoost = 1.55
              spoolRpm = 3200
              fullRpm = 4800
            } else {
              baseMaxBoost = 0.40
              spoolRpm = 2200
              fullRpm = 3400
            }
          }

          const stageExtraBoost = stage === 1 ? 0.20 : stage === 2 ? 0.40 : stage === 3 ? 0.70 : 0.0
          const maxBoost = baseMaxBoost + stageExtraBoost

          let targetBoost = -0.7
          if (substepPhys.isRunning) {
            if (substepPhys.isLaunchControlArmed) {
              targetBoost = maxBoost * 0.65
            } else if (ctx.throttle < 0.08) {
              targetBoost = -0.75 + clamp((substepPhys.rpm - 1000) / 6000, 0, 0.25)
            } else if (substepPhys.rpm < spoolRpm) {
              targetBoost = -0.7 + ctx.throttle * 0.7
            } else {
              const rpmFactor = clamp((substepPhys.rpm - spoolRpm) / (fullRpm - spoolRpm), 0, 1)
              targetBoost = ctx.throttle * (rpmFactor * maxBoost)
            }
          } else {
            targetBoost = 0
          }

          const spoolRate =
            turboLevel === 'big_turbo'
              ? 3.6
              : turboLevel === 'intermediate'
              ? 4.8
              : isOriginallyTurbo && turboLevel === 'none'
              ? 8.2
              : 6.2
          const dropRate = 8.5
          const boostSpeed = targetBoost > substepPhys.boostPressureBar ? spoolRate : dropRate
          substepPhys.boostPressureBar += (targetBoost - substepPhys.boostPressureBar) * clamp(dt * boostSpeed, 0, 1)
          substepPhys.peakBoostBar = Math.max(substepPhys.peakBoostBar, substepPhys.boostPressureBar)
        } else if (ctx.hasBoostGaugeKit) {
          let targetVacuum = 0
          if (substepPhys.isRunning) {
            targetVacuum = ctx.throttle < 0.08
              ? -0.75 + clamp((substepPhys.rpm - 1000) / 8000, 0, 0.1)
              : -0.7 + ctx.throttle * 0.65
          }
          substepPhys.boostPressureBar += (targetVacuum - substepPhys.boostPressureBar) * clamp(dt * 7, 0, 1)
          substepPhys.peakBoostBar = 0
        } else {
          substepPhys.boostPressureBar = 0
          substepPhys.peakBoostBar = 0
        }

        // Top Speed Record
        substepPhys.topSpeedRecord = Math.max(substepPhys.topSpeedRecord, Math.round(substepPhys.speedKmh))

        // Térmica dos Freios, Brilho & Brake Fade
        const effectiveBrakeSpeed = ctx.injectedSpeedFloor > 0
          ? Math.max(substepPhys.speedKmh, ctx.injectedSpeedFloor)
          : substepPhys.speedKmh
        if (rawBrake > 0.05 && effectiveBrakeSpeed > 1) {
          substepPhys.brakeDiscTemp += rawBrake * (effectiveBrakeSpeed / 75) * 140 * dt
        }
        const discCoolingMult = ctx.brakeUpgrade === 'sport' ? 1.40 : 1.0
        const discCooling = ((substepPhys.speedKmh / 100) * 0.75 + 0.18) * Math.max(0, (substepPhys.brakeDiscTemp - 60) / 100) * 9.0 * dt * discCoolingMult
        substepPhys.brakeDiscTemp = clamp(substepPhys.brakeDiscTemp - discCooling, 60, 950)
        substepPhys.isBrakeGlowing = substepPhys.brakeDiscTemp >= 500
        const fadeThreshold = ctx.brakeUpgrade === 'sport' ? 820 : 650
        substepPhys.brakeFadeFactor = substepPhys.brakeDiscTemp > fadeThreshold
          ? clamp(1.0 - ((substepPhys.brakeDiscTemp - fadeThreshold) / 250) * 0.55, 0.45, 1.0)
          : 1.0

        // Sistema Real de Combustível & Consumo Dinâmico
        if (substepPhys.isRunning) {
          const hours = dt / 3600
          const fuelMult = ctx.fuelType === 'ethanol_e100' ? 1.34 : 1.0
          const stageFuelFactor = stage === 1 ? 1.2 : stage === 2 ? 1.4 : stage === 3 ? 1.8 : 1.0
          const burnPerHour = (0.85 + ctx.throttle * 22.0 + (substepPhys.rpm / _config.engine.maxRpm) * 8.5) * stageFuelFactor * fuelMult
          substepPhys.fuelLevelLiters = Math.max(0, substepPhys.fuelLevelLiters - burnPerHour * hours)

          if (substepPhys.fuelLevelLiters <= 0.005) {
            substepPhys.fuelLevelLiters = 0
            substepPhys.isOutOfFuel = true
            substepPhys.isRunning = false
            substepPhys.isStalled = true
            substepPhys.status = 'stalled'
            _engine.stop()
          }
        }

        // Dinâmica Térmica do Motor, Termostática, Ventoinha (com Histerese) e Óleo
        const targetCoolant = _config.dashboard.coolantTempTarget ?? 88
        if (!substepPhys.isRunning) {
          substepPhys.isRadiatorFanOn = false
        } else if (!substepPhys.isRadiatorFanOn && substepPhys.coolantTemp >= 96.0) {
          substepPhys.isRadiatorFanOn = true
        } else if (substepPhys.isRadiatorFanOn && substepPhys.coolantTemp <= 91.0) {
          substepPhys.isRadiatorFanOn = false
        }

        if (substepPhys.isRunning) {
          const stageHeatMult = stage === 1 ? 1.25 : stage === 2 ? 1.50 : stage === 3 ? 1.85 : 1.0
          const fuelHeatFactor = ctx.fuelType === 'ethanol_e100' ? 0.90 : 1.0
          const rpmRatio = clamp(substepPhys.rpm / Math.max(1000, _config.engine.maxRpm), 0, 1.2)
          const engineLoad = clamp(ctx.throttle * 0.72 + Math.pow(rpmRatio, 1.35) * 0.38, 0.05, 1.25)

          const thermostatOpen = clamp((substepPhys.coolantTemp - (targetCoolant - 2)) / 8, 0.05, 1.0)
          const coolantHeatIn = (0.10 + engineLoad * 1.15) * stageHeatMult * fuelHeatFactor
          const radFanFactor = substepPhys.isRadiatorFanOn ? 0.52 : 0.0
          const airflowFactor = 0.20 + clamp(substepPhys.speedKmh / 100, 0, 1.40) * 0.85 + radFanFactor
          const tempDeltaAboveAmbient = Math.max(0, substepPhys.coolantTemp - 25) / 65
          const coolantCoolingOut = airflowFactor * tempDeltaAboveAmbient * thermostatOpen * 0.85

          const idleEquilibriumPull =
            ctx.throttle < 0.08 && substepPhys.coolantTemp > targetCoolant && substepPhys.coolantTemp < 95.5
              ? (substepPhys.coolantTemp - targetCoolant) * 0.025
              : 0

          substepPhys.coolantTemp = clamp(
            substepPhys.coolantTemp + (coolantHeatIn - coolantCoolingOut - idleEquilibriumPull) * dt,
            20,
            135,
          )

          const targetOilEquilibrium =
            substepPhys.coolantTemp + 3.5 + (Math.pow(rpmRatio, 1.6) * 11.0 + ctx.throttle * 6.5) * stageHeatMult
          const oilTau = substepPhys.oilTemp < targetOilEquilibrium ? 0.065 : 0.045
          substepPhys.oilTemp = clamp(
            substepPhys.oilTemp + (targetOilEquilibrium - substepPhys.oilTemp) * clamp(dt * oilTau, 0, 1),
            20,
            150,
          )
        } else if (substepPhys.status === 'starting') {
          substepPhys.coolantTemp = Math.max(25, substepPhys.coolantTemp - 0.02 * dt)
          substepPhys.oilTemp = Math.max(25, substepPhys.oilTemp - 0.02 * dt)
        } else {
          substepPhys.coolantTemp = Math.max(25, substepPhys.coolantTemp - Math.max(0.03, (substepPhys.coolantTemp - 25) * 0.008) * dt)
          substepPhys.oilTemp = Math.max(25, substepPhys.oilTemp - Math.max(0.025, (substepPhys.oilTemp - 25) * 0.006) * dt)
        }

        // Superaquecimento crítico (>=125°C)
        if (substepPhys.coolantTemp >= 125 && !substepPhys.isEngineBlown) {
          substepPhys.isEngineBlown = true
          substepPhys.damageReason = 'Superaquecimento (>125°C): Junta Queimada!'
          substepPhys.isRunning = false
          substepPhys.isStalled = true
          substepPhys.status = 'stalled'
          substepPhys.engineBlownTrigger = Date.now()
          _engine.stop()
          HapticFeedback.heavy()
        }

        // ─── MODELO FÍSICO DE DANO MECÂNICO ACUMULADO (ETAPA 2) ───
        // P_ref = 1.00 bar (gauge) normaliza pressão de sobrealimentação prevenindo divisão por zero em motores aspirados
        if (substepPhys.isRunning && !substepPhys.isEngineBlown) {
          const internals = ctx.engineInternals ?? 'stock'
          const internalsTorqueMult = internals === 'race' ? 2.0 : internals === 'forged' ? 1.6 : internals === 'reinforced' ? 1.3 : 1.0
          const internalsBoostBonus = internals === 'race' ? 1.4 : internals === 'forged' ? 0.9 : internals === 'reinforced' ? 0.4 : 0.0

          const maxRatedTorque = _config.engine.maxTorque
          const torqueTolerance = maxRatedTorque * 1.35 * internalsTorqueMult

          const maxAllowedBoostBar = (_config.engine.turbo?.maxBoostBar ?? 0) + internalsBoostBonus
          const PREF_TURBO_BAR = 1.00

          const k_tau = 0.015
          const k_P = 0.020
          const k_T = 0.005
          const k_N = 0.100

          const effectiveEngineTorque = _engine.getTorqueOutput() * totalTorqueMult
          const torqueExcess = Math.max(0, (effectiveEngineTorque - torqueTolerance) / torqueTolerance)
          const boostExcess = Math.max(0, (substepPhys.boostPressureBar - maxAllowedBoostBar) / PREF_TURBO_BAR)
          const tempExcess = Math.max(0, (substepPhys.coolantTemp - 118) / 118)
          const nosExcess = isNosInjecting && (substepPhys.rpm > _config.engine.revLimiter - 100 || substepPhys.rpm < 2400) ? 1.0 : 0.0

          const damageRatePerSec = k_tau * torqueExcess + k_P * boostExcess + k_T * tempExcess + k_N * nosExcess
          if (damageRatePerSec > 0) {
            substepPhys.engineDamageRatio = (substepPhys.engineDamageRatio ?? 0) + damageRatePerSec * dt
            if (substepPhys.engineDamageRatio >= 1.0) {
              substepPhys.isEngineBlown = true
              substepPhys.damageReason =
                torqueExcess > 0 ? 'Sobrecarga de Torque: Biela Partida!'
                : boostExcess > 0 ? 'Excesso de Pressão: Bloco Rompido!'
                : nosExcess > 0 ? 'Detonação por Óxido Nitroso: Pistão Furado!'
                : 'Fadiga Térmica Severa: Motor Fundido!'
              substepPhys.isRunning = false
              substepPhys.isStalled = true
              substepPhys.status = 'stalled'
              substepPhys.engineBlownTrigger = Date.now()
              _engine.stop()
              HapticFeedback.heavy()
            }
          }
        }

        // Burnout & Fumaça Densa de Pneus
        const isHoldBrake = ctx.brake > 0.35 || ctx.handbrake
        const isBurnoutThrottle = ctx.throttle > 0.60 && substepPhys.rpm > 2600
        const isForwardOrReverse = gear === 1 || gear === -1 || (ctx.transmissionMode === 'automatic' && gear === 1)

        if (substepPhys.isRunning && isHoldBrake && isBurnoutThrottle && isForwardOrReverse && substepPhys.speedKmh < 18) {
          substepPhys.isBurningOut = true
          substepPhys.tireSmokeDensity = clamp(substepPhys.tireSmokeDensity + dt * 1.8, 0, 1.0)
        } else {
          substepPhys.isBurningOut = false
          substepPhys.tireSmokeDensity = clamp(substepPhys.tireSmokeDensity - dt * 0.85, 0, 1.0)
        }

        // Pista de Arrancada 402m (Drag Strip)
        const currentMoveSpeed = ctx.injectedSpeedFloor > 0
          ? Math.max(substepPhys.speedKmh, ctx.injectedSpeedFloor)
          : substepPhys.speedKmh

        if (
          (substepPhys.dragStage === 'pre_stage' ||
            substepPhys.dragStage === 'staged' ||
            substepPhys.dragStage === 'yellow_1' ||
            substepPhys.dragStage === 'yellow_2' ||
            substepPhys.dragStage === 'yellow_3') &&
          (currentMoveSpeed > 1.8 || substepPhys.dragDistanceTraveled > 0.25)
        ) {
          substepPhys.dragStage = 'false_start'
          substepPhys.dragTimeSlip = {
            reactionTime: 0,
            time60ft: 0,
            time0to100: 0,
            time201m: 0,
            time402m: 0,
            trapSpeedKmh: Math.round(currentMoveSpeed),
            isDisqualified: true,
            createdAt: Date.now(),
          }
        } else if (substepPhys.dragStage === 'green') {
          if (currentMoveSpeed > 0.6 || substepPhys.dragDistanceTraveled > 0.1) {
            const simReactionSec = substepPhys.dragGreenSimMs !== null
              ? ((substepPhys.elapsedSimMs + substepIdx * dt * 1000) - substepPhys.dragGreenSimMs) / 1000
              : 0
            const wallReactionSec = state._dragGreenTime ? (ctx.now - state._dragGreenTime) / 1000 : 0.25
            const rawReaction = simReactionSec > 0 ? simReactionSec : wallReactionSec
            const reaction = Math.max(0.001, Math.round(rawReaction * 1000) / 1000)
            substepPhys.dragStage = 'racing'
            substepPhys.dragTimerStart = ctx.now
            substepPhys.dragElapsedSeconds = dt
            substepPhys.dragDistanceTraveled = Math.max(0, substepPhys.dragDistanceTraveled + (currentMoveSpeed / 3.6) * dt)
            substepPhys.dragTimeSlip = {
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
        } else if (substepPhys.dragStage === 'racing' && substepPhys.dragTimeSlip) {
          substepPhys.dragElapsedSeconds += dt
          substepPhys.dragDistanceTraveled += (currentMoveSpeed / 3.6) * dt
          const elapsed = Math.round(substepPhys.dragElapsedSeconds * 1000) / 1000

          if (substepPhys.dragDistanceTraveled >= 18.288 && substepPhys.dragTimeSlip.time60ft === 0) {
            substepPhys.dragTimeSlip.time60ft = elapsed
          }
          if (currentMoveSpeed >= 100 && substepPhys.dragTimeSlip.time0to100 === 0) {
            substepPhys.dragTimeSlip.time0to100 = elapsed
          }
          if (substepPhys.dragDistanceTraveled >= 201.168 && substepPhys.dragTimeSlip.time201m === 0) {
            substepPhys.dragTimeSlip.time201m = elapsed
          }
          if (substepPhys.dragDistanceTraveled >= 402.336) {
            substepPhys.dragTimeSlip.time402m = elapsed
            substepPhys.dragTimeSlip.trapSpeedKmh = Math.round(currentMoveSpeed)
            substepPhys.dragStage = 'finished'
            HapticFeedback.heavy()

            if (!substepPhys.dragTimeSlip.isDisqualified) {
              let prize = 3000
              const breakdown: string[] = ['Premiação base 402m: +R$ 3.000']
              if (substepPhys.dragTimeSlip.reactionTime < 0.100) {
                prize += 5000
                breakdown.push('Reação perfeita (<0.100s): +R$ 5.000')
              } else if (substepPhys.dragTimeSlip.reactionTime < 0.250) {
                prize += 2000
                breakdown.push('Reação rápida (<0.250s): +R$ 2.000')
              }
              if (substepPhys.dragTimeSlip.trapSpeedKmh >= 200) {
                prize += 3000
                breakdown.push('Trap Speed > 200 km/h: +R$ 3.000')
              } else if (substepPhys.dragTimeSlip.trapSpeedKmh >= 160) {
                prize += 1500
                breakdown.push('Trap Speed > 160 km/h: +R$ 1.500')
              }
              substepPhys.dragTimeSlip.reward = prize
              substepPhys.dragTimeSlip.rewardBreakdown = breakdown
              useGarageStore.getState().addCredits(prize)
            }
          }
        }

        // Kit de Óxido Nitroso (NOS) & Consumo de Pressão
        if (ctx.hasNosKit && substepPhys.nosActive && ctx.throttle > 0.60 && substepPhys.isRunning && substepPhys.nosPressurePercent > 0) {
          substepPhys.nosPressurePercent = Math.max(0, substepPhys.nosPressurePercent - dt * 12.5)
          if (substepPhys.nosPressurePercent <= 0) {
            substepPhys.nosActive = false
          }
        }

        // Captura snapshots atualizados no candidato
        cand.engine = _engine.getStateSnapshot()
        cand.clutch = _clutch.getStateSnapshot()
        cand.transmission = _transmission.getStateSnapshot()
        cand.autoTransmission = _autoTransmission ? _autoTransmission.getStateSnapshot() : null
        cand.physics = _physics.getStateSnapshot()
        cand.climate = _climate ? _climate.getStateSnapshot() : undefined
        cand.windows = _windows ? _windows.getStateSnapshot() : undefined
        cand.ignition = _ignition ? _ignition.getStateSnapshot() : undefined
        cand.lighting = _lighting ? _lighting.getStateSnapshot() : undefined
        cand.phys = substepPhys
        cand.timer0to100State = substepTimer0to100

        return cand
      },
    )

    if (stepResult.integrityStatus === 'FAIL_SAFE_HOLD') {
      // Rollback transacional de todos os 5 subsistemas mutáveis para o último estado mestre válido
      _engine.restoreSnapshot(stepResult.state.engine)
      _clutch.restoreSnapshot(stepResult.state.clutch)
      _transmission.restoreSnapshot(stepResult.state.transmission)
      if (_autoTransmission && stepResult.state.autoTransmission) {
        _autoTransmission.restoreSnapshot(stepResult.state.autoTransmission)
      }
      _physics.restoreSnapshot(stepResult.state.physics)

      set({
        physicsIntegrityStatus: 'FAIL_SAFE_HOLD',
        _phys: stepResult.state.phys,
        _timer0to100State: stepResult.state.timer0to100State,
        _accumulator: _integrator.getAccumulator(),
      })
      console.warn('[HEATZ FAIL_SAFE_HOLD] Falha física capturada no runtime. Simulação congelada com integridade preservada.', stepResult.lastFault)
      return
    }

    // Sincroniza instâncias para o estado comitado pelo integrador
    _engine.restoreSnapshot(stepResult.state.engine)
    _clutch.restoreSnapshot(stepResult.state.clutch)
    _transmission.restoreSnapshot(stepResult.state.transmission)
    if (_autoTransmission && stepResult.state.autoTransmission) {
      _autoTransmission.restoreSnapshot(stepResult.state.autoTransmission)
    }
    _physics.restoreSnapshot(stepResult.state.physics)
    if (_climate && stepResult.state.climate) _climate.restoreSnapshot(stepResult.state.climate)
    if (_windows && stepResult.state.windows) _windows.restoreSnapshot(stepResult.state.windows)
    if (_ignition && stepResult.state.ignition) _ignition.restoreSnapshot(stepResult.state.ignition)
    if (_lighting && stepResult.state.lighting) _lighting.restoreSnapshot(stepResult.state.lighting)

    const committedClimate = stepResult.state.climate ?? _climate?.getStateSnapshot()
    const committedWindows = stepResult.state.windows ?? _windows?.getStateSnapshot()
    const committedIgnition = stepResult.state.ignition ?? _ignition?.getStateSnapshot()
    const committedLighting = stepResult.state.lighting ?? _lighting?.getStateSnapshot()

    const prevPhys = stepResult.previousState.phys
    const currPhys = stepResult.state.phys
    const alpha = stepResult.interpolationAlpha

    // Interpolação visual precisa (lerp entre o penúltimo e o último estado discretos)
    const visualSpeed = prevPhys.speedKmh + (currPhys.speedKmh - prevPhys.speedKmh) * alpha
    const visualRpm = prevPhys.rpm + (currPhys.rpm - prevPhys.rpm) * alpha

    const visualPositionX = (prevPhys.positionX ?? 0) + ((currPhys.positionX ?? 0) - (prevPhys.positionX ?? 0)) * alpha
    const visualPositionY = (prevPhys.positionY ?? 0) + ((currPhys.positionY ?? 0) - (prevPhys.positionY ?? 0)) * alpha

    let dHeading = (currPhys.headingDeg ?? 0) - (prevPhys.headingDeg ?? 0)
    while (dHeading > 180) dHeading -= 360
    while (dHeading < -180) dHeading += 360
    const visualHeadingDeg = (((prevPhys.headingDeg ?? 0) + dHeading * alpha) + 360) % 360

    phys = currPhys
    const timer0to100State = stepResult.state.timer0to100State

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

    const hasCabinCriticalEvent =
      (committedIgnition !== undefined && committedIgnition.position !== state.ignitionPosition) ||
      (committedLighting !== undefined &&
        (committedLighting.leftIndicatorLit !== state.leftIndicatorLit ||
          committedLighting.rightIndicatorLit !== state.rightIndicatorLit ||
          committedLighting.hazardIndicatorLit !== state.hazardIndicatorLit)) ||
      (committedWindows !== undefined &&
        Math.abs(committedWindows.averageOpenRatio - state.windowAverageOpenRatio) >= 0.01)

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
      phys.nosActive !== state.nosActive ||
      hasCabinCriticalEvent

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
      state._accumulator = _integrator.getAccumulator()
      state._timer0to100State = timer0to100State
      state._phys = phys
      state.visualSpeed = visualSpeed
      state.visualRpm = visualRpm
      state.interpolationAlpha = alpha
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
      visualSpeed,
      visualRpm,
      interpolationAlpha: alpha,
      physicsIntegrityStatus: 'NORMAL',
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
      boostTorqueMultiplier: phys.boostTorqueMultiplier ?? 1.0,
      fuelPowerMultiplier: phys.fuelPowerMultiplier ?? 1.0,
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
      positionX: phys.positionX,
      positionY: phys.positionY,
      headingDeg: phys.headingDeg,
      visualPositionX,
      visualPositionY,
      visualHeadingDeg,
      lateralSpeedMs: phys.lateralSpeedMs,
      slipAngleDeg: phys.slipAngleDeg,
      lateralAccelG: phys.lateralAccelG,
      leanAngleDeg: phys.leanAngleDeg,
      isColliding: phys.isColliding,
      collisionBoundaryName: phys.collisionBoundaryName,
      surfaceType: phys.surfaceType,
      zoneName: phys.zoneName,
      absEngaged: phys.absEngaged,
      isAirbrakeActive: phys.isAirbrakeActive,
      _timer0to100State: timer0to100State,
      _accumulator: _integrator.getAccumulator(),
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
      downforceN: Math.round(_physics.getDownforceN()),
      ...(committedWindows
        ? {
            windowsOpen: committedWindows.windowsOpen,
            windowPositions: committedWindows.positions,
            windowTargets: committedWindows.targets,
            windowAverageOpenRatio: Math.round(committedWindows.averageOpenRatio * 1000) / 1000,
            windowAeroDragMultiplier: Math.round(committedWindows.aeroDragMultiplier * 10000) / 10000,
            cabinNoiseLevel: Math.round(committedWindows.cabinNoiseLevel * 1000) / 1000,
            cabinFilterCutoffHz: committedWindows.cabinFilterCutoffHz,
          }
        : {}),
      ...(committedClimate
        ? {
            ambientTempC: Math.round(committedClimate.ambientTempC * 10) / 10,
            cabinTempC: Math.round(committedClimate.cabinTempC * 10) / 10,
            climateTargetTempC: committedClimate.targetTempC,
            climateAcEnabled: committedClimate.acEnabled,
            isCompressorEngaged: committedClimate.isCompressorEngaged,
            climateFanLevel: committedClimate.fanLevel,
            climateAutoMode: committedClimate.autoMode,
            climateRecirculation: committedClimate.recirculation,
            climateHeaterEnabled: committedClimate.heaterEnabled,
            climateDefrosterEnabled: committedClimate.defrosterEnabled,
            compressorMechanicalPowerW: Math.round(committedClimate.compressorMechanicalPowerW),
            compressorLoadTorqueNm: Math.round(committedClimate.compressorLoadTorqueNm * 100) / 100,
            blowerElectricalPowerW: Math.round(committedClimate.blowerElectricalPowerW),
          }
        : {}),
      ...(committedIgnition
        ? {
            ignitionPosition: committedIgnition.position,
            batteryVoltageV: Math.round(committedIgnition.batteryVoltageV * 100) / 100,
            isBatteryDischarged: committedIgnition.isBatteryDischarged,
            ignitionStartAttempts: committedIgnition.startAttempts,
            ignitionFailedAttempts: committedIgnition.failedAttempts,
            ignitionFailureReason: committedIgnition.lastFailureReason,
          }
        : {}),
      ...(committedLighting
        ? {
            headlightsMode: committedLighting.headlightsMode,
            fogLightsEnabled: committedLighting.fogLightsEnabled,
            hasFogLights: committedLighting.hasFogLights,
            turnSignal: committedLighting.turnSignal,
            leftTurnSignal: committedLighting.leftTurnSignal,
            rightTurnSignal: committedLighting.rightTurnSignal,
            hazardLights: committedLighting.hazardLights,
            leftIndicatorLit: committedLighting.leftIndicatorLit,
            rightIndicatorLit: committedLighting.rightIndicatorLit,
            hazardIndicatorLit: committedLighting.hazardIndicatorLit,
            parkingLightsLit: committedLighting.parkingLightsLit,
            lowBeamLit: committedLighting.lowBeamLit,
            highBeamLit: committedLighting.highBeamLit,
            fogLightsLit: committedLighting.fogLightsLit,
          }
        : {}),
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
      turboLevel: 'none',
      engineInternals: 'stock',
      rearWingType: 'none',
      garageInstanceId: null,
      exhaustType: 'stock',
      exhaustValveOpen: false,
      intakeType: 'stock',
      tires: 'street',
      isAeroWingExtended: false,
      fourWheelDriveMode: 'auto',
      fourWheelDriveWarning: null,

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
      windowPositions: { front_left: 0, front_right: 0, rear_left: 0, rear_right: 0 },
      windowTargets: { front_left: 0, front_right: 0, rear_left: 0, rear_right: 0 },
      windowAverageOpenRatio: 0,
      windowAeroDragMultiplier: 1.0,
      cabinNoiseLevel: 0.18,
      cabinFilterCutoffHz: WINDOW_CALIBRATION.CLOSED_CABIN_CUTOFF_HZ,
      ambientTempC: CLIMATE_CALIBRATION.DEFAULT_AMBIENT_TEMP_C,
      cabinTempC: CLIMATE_CALIBRATION.DEFAULT_AMBIENT_TEMP_C,
      climateTargetTempC: CLIMATE_CALIBRATION.DEFAULT_TARGET_TEMP_C,
      climateAcEnabled: false,
      isCompressorEngaged: false,
      climateFanLevel: 0,
      climateAutoMode: false,
      climateRecirculation: false,
      climateHeaterEnabled: false,
      climateDefrosterEnabled: false,
      compressorMechanicalPowerW: 0,
      compressorLoadTorqueNm: 0,
      blowerElectricalPowerW: 0,
      ignitionPosition: 'OFF',
      batteryVoltageV: IGNITION_CALIBRATION.BATTERY_REST_VOLTAGE_V,
      isBatteryDischarged: false,
      ignitionStartAttempts: 0,
      ignitionFailedAttempts: 0,
      ignitionFailureReason: null,
      fogLightsEnabled: false,
      turnSignal: 'off',
      leftTurnSignal: false,
      rightTurnSignal: false,
      hazardLights: false,
      leftIndicatorLit: false,
      rightIndicatorLit: false,
      hazardIndicatorLit: false,
      parkingLightsLit: true,
      lowBeamLit: true,
      highBeamLit: false,
      fogLightsLit: false,
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
      _climate: null,
      _windows: null,
      _ignition: null,
      _lighting: null,
      _config: null,
      _accumulator: 0,
      _isInitialized: false,
      _integrator: null,
      isPaused: false,
      physicsIntegrityStatus: 'NORMAL',
      visualSpeed: 0,
      visualRpm: 0,
      interpolationAlpha: 0,
      steeringAngle: 0,
      positionX: WorldMap.SPAWN_X,
      positionY: WorldMap.SPAWN_Y,
      headingDeg: WorldMap.SPAWN_HEADING_DEG,
      visualPositionX: WorldMap.SPAWN_X,
      visualPositionY: WorldMap.SPAWN_Y,
      visualHeadingDeg: WorldMap.SPAWN_HEADING_DEG,
      lateralSpeedMs: 0,
      slipAngleDeg: 0,
      lateralAccelG: 0,
      leanAngleDeg: 0,
      isColliding: false,
      collisionBoundaryName: null,
      surfaceType: 'asphalt',
      zoneName: 'Rotatória Central',
      absEngaged: false,
      isAirbrakeActive: false,
      _phys: createInitialPhysicsInternalState({
        gear: initialGear,
        nosPressurePercent: get().nosPressurePercent,
        topSpeedRecord: get().topSpeedRecord,
      }),
    })
  },

  pauseSimulation: () => {
    const { _integrator } = get()
    _integrator?.pause()
    set({ isPaused: true })
  },

  resumeSimulation: () => {
    const { _integrator } = get()
    _integrator?.resume()
    set({ isPaused: false })
  },

  togglePauseSimulation: () => {
    const { isPaused, pauseSimulation, resumeSimulation } = get()
    if (isPaused) {
      resumeSimulation()
    } else {
      pauseSimulation()
    }
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
