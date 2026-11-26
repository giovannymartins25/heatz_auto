/**
 * Tipos de configuração de veículos.
 * Cada veículo é definido por um VehicleConfig completo.
 * Esses tipos são a base para todo o sistema — motor, transmissão, áudio e painel.
 */

import type { ChassisConfig } from '@/systems/physics/Chassis'
import type { AmbientLightColor } from '@/utils/ambientLighting'
import {
  resolveVehicleAero,
  resolveVehicleDrivetrain,
  resolveVehicleMultimediaSpec,
} from '@/systems/vehicle/vehicleResolvers'
export type { ChassisConfig }

export type VehicleCategory = 'car' | 'motorcycle' | 'truck' | 'bus' | 'tractor' | 'custom'

export type TransmissionType = 'manual' | 'automatic' | 'sequential' | 'cvt' | 'dct'

export type DrivingMode = 'eco' | 'normal' | 'sport' | 'track'

export type GearSelectorPosition = SelectorPosition

/**
 * Arquitetura canônica de tração do veículo (localização única: `transmission.drivetrain`).
 * `'awd'` é aceito como alias legado para retrocompatibilidade com configs existentes.
 */
export type DrivetrainLayout = 'fwd' | 'rwd' | 'awd_ptm' | 'awd_ondemand' | '4x4_selectable'
export type DrivetrainConfigValue = DrivetrainLayout | 'awd'

/** Tipo de sistema de ignição/partida do veículo */
export type IgnitionType = 'key' | 'push_button'

/** Posição do comutador/sistema de ignição */
export type IgnitionPosition = 'OFF' | 'ACC' | 'ON' | 'CRANK'

/** Requisito de intertravamento mecânico/eletrônico de pedal para acionar o motor de arranque (CRANK) */
export type IgnitionStartInterlock = 'none' | 'brake' | 'clutch' | 'brake_or_clutch'

export interface VehicleIgnitionSpec {
  type: IgnitionType
  /** Contrato explícito de intertravamento de partida (evita ambiguidade entre freio e embreagem) */
  startInterlock: IgnitionStartInterlock
  supportsAccessoryMode: boolean
  /** @deprecated Mantido opcionalmente apenas para retrocompatibilidade com configs legados; prefira `startInterlock` */
  requiresPedalForStart?: boolean
}

/** Arquitetura de climatização da cabine */
export type ClimateSystemType =
  | 'none'
  | 'manual_vent'
  | 'manual_ac'
  | 'auto_single'
  | 'auto_dual'
  | 'auto_tri'

/** Localização canônica dos controles de climatização na interface do veículo */
export type ClimateControlsLocation = 'multimedia' | 'panel' | 'none'

/** Painel alvo na arquitetura modular de 3 painéis (Painel 2 = 'multimedia', Painel 3 = 'controls', 'none' = ausente) */
export type ControlPanelTarget = 'controls' | 'multimedia' | 'none'

/** Natureza física ou digital do comando no veículo real */
export type ControlActuationType = 'physical' | 'digital' | 'none'

/** Grau de confirmação documental do equipamento para o ano/versão do veículo */
export type EquipmentConfirmationStatus = 'confirmed' | 'estimated_or_optional' | 'unconfirmed'

/** Tipo de acionamento real de assistências de condução (preparação arquitetural) */
export type DriverAssistControlType =
  | 'steering_wheel_physical'
  | 'stalk_physical'
  | 'digital_multimedia'
  | 'none'

/** Nível de ajuste de assistências de condução */
export type DriverAssistAdjustability = 'toggle_only' | 'setpoint_adjustable' | 'none'

/** Estado de implementação na simulação (evita botões falsos para sistemas autônomos ainda sem sensores) */
export type DriverAssistImplementationState = 'pending_sensors' | 'not_applicable'

export interface VehicleClimateControlSpec {
  available: boolean
  confirmationStatus: EquipmentConfirmationStatus
  controlType: ControlActuationType
  panel: ControlPanelTarget
  adjustable: 'setpoint_and_fan' | 'vent_only' | 'none'
}

export interface VehicleTractionControlSpec {
  available: boolean
  confirmationStatus: EquipmentConfirmationStatus
  userToggleable: boolean
  controlType: ControlActuationType
  panel: ControlPanelTarget
  systemLabel: string
}

export interface VehicleSteeringWheelControlsSpec {
  hasAudioControls: boolean
  hasCruiseControls: boolean
  confirmationStatus: EquipmentConfirmationStatus
}

export interface VehicleDriverAssistEntry {
  available: boolean
  confirmationStatus: EquipmentConfirmationStatus
  controlType: DriverAssistControlType
  panel: ControlPanelTarget
  adjustable: DriverAssistAdjustability
  implementationState: DriverAssistImplementationState
  notes?: string
}

export interface VehicleDriverAssistsSpec {
  cruiseControl: VehicleDriverAssistEntry
  adaptiveCruiseControl: VehicleDriverAssistEntry
  laneKeepingAssist: VehicleDriverAssistEntry
}

/**
 * Arquitetura declarativa unificada de distribuição dos comandos e sistemas do veículo
 * entre Painel 2 (Multimídia) e Painel 3 (Controles do Veículo), sem duplicação.
 */
export interface VehicleControlsSpec {
  climate: VehicleClimateControlSpec
  tractionControl: VehicleTractionControlSpec
  steeringWheel: VehicleSteeringWheelControlsSpec
  driverAssists: VehicleDriverAssistsSpec
}

export interface VehicleCabinSpec {
  climateType: ClimateSystemType
  /** Onde os controles de climatização devem aparecer ('multimedia' = central multimídia integrada; 'panel' = Painel 3 físico; 'none' = sem climatização) */
  climateControlsLocation?: ClimateControlsLocation
  hasAcCompressor: boolean
  hasHeater: boolean
  hasSeatHeating?: boolean
  hasRecirculation: boolean
  hasDefroster: boolean
  windowCount: 0 | 2 | 4
  windowControlType: 'none' | 'manual_crank' | 'electric'
  hasFogLights?: boolean
  hasAmbientLighting?: boolean
  /** Indica se a iluminação ambiente permite seleção multicor RGB pelo usuário (false = cor OEM fixa de fábrica) */
  hasConfigurableAmbientRgb?: boolean
  defaultAmbientColor?: AmbientLightColor
  /** Capacidade declarativa de escapamento ativo de fábrica com válvula eletrônica; padrão false */
  hasFactoryActiveExhaust?: boolean
}

/** Identificador canônico de unidade multimídia no MULTIMEDIA_REGISTRY */
export type MultimediaUnitId =
  | 'toro_uconnect_7'
  | 'toro_uconnect_10_vertical'
  | 'porsche_pcm6'
  | 'vw_discover_pro'
  | 'vw_discover_media_8'
  | 'bmw_idrive8_curved'
  | 'ford_pampa_radio_1din'
  | 'ford_sync1_2012'
  | 'ford_sync3_8'
  | 'toyota_smart_connect'
  | 'honda_haudio'
  | 'retrofit_2din'
  | 'classic_radio_1din'
  | 'classic_blank_console'
  | 'generic_multimedia'
  | 'none'

export interface VehicleMultimediaSpec {
  unitId: MultimediaUnitId
  type: MultimediaType
  layout: MultimediaLayout
  screenSize?: number
  name: string
  era?: '1990s' | '2000s' | '2010s' | '2020s'
  features: string[]
  supportsAftermarketUpgrade: boolean
}

export type VehicleVisual2DSilhouette =
  | 'hatch'
  | 'hatch_square'
  | 'sedan'
  | 'coupe'
  | 'pickup_compact'
  | 'pickup_mid'
  | 'motorcycle'
  | 'truck_light'
  | 'truck_medium'
  | 'truck_heavy'

/** Preparação arquitetural declarativa para futuros caminhões e veículos comerciais pesados */
export type TruckAxleConfig = '4x2' | '6x2' | '6x4' | '8x2' | '8x4'
export type TruckBrakeSystemType = 'hydraulic' | 'pneumatic_air'

export interface VehicleHeavyDutySpec {
  axleConfig?: TruckAxleConfig
  brakeSystemType?: TruckBrakeSystemType
  hasExhaustBrake?: boolean
  dragAreaCdA?: number
  grossCombinedWeightKg?: number
}

export interface VehicleVisual2DSpec {
  bodyColor: string
  accentColor?: string
  lengthM: number
  widthM: number
  silhouette: VehicleVisual2DSilhouette
  hasFrontRedStripe?: boolean
}

export interface VehicleAeroSpec {
  hasActiveRearWing?: boolean
  hasAdjustableRideHeight?: boolean
  hasAirbrake?: boolean
  defaultWingType?: 'none' | 'oem' | 'sport_gt'
  defaultWingPosition?: 'low_drag' | 'balanced' | 'high_downforce'
  baseDownforceCoeff?: number
}

export type VehicleFuelType = 'common_gasoline' | 'premium_podium' | 'ethanol_e100'

/** Ponto na curva de torque: RPM → torque em Nm */
export interface TorqueCurvePoint {
  rpm: number
  torque: number
}

/** Configuração do turbocompressor */
export interface TurboConfig {
  enabled: boolean
  maxBoostBar: number       // Pressão máxima positiva (ex: 1.4 bar)
  spoolRpmStart: number     // RPM onde a turbina começa a encher (ex: 1600)
  fullBoostRpm: number      // RPM onde atinge pressão máxima (ex: 2800)
  hasBlowOff: boolean       // Válvula de alívio com som característico
  defaultUpgradeLevel?: 'none' | 'basic' | 'intermediate' | 'big_turbo'
}

/** Configuração do motor */
export interface EngineConfig {
  maxPower: number           // cv / hp
  maxPowerRpm: number        // RPM onde atinge potência máxima
  maxTorque: number          // Nm
  maxTorqueRpm: number       // RPM onde atinge torque máximo
  maxRpm: number             // RPM máximo (corte)
  idleRpm: number            // RPM de marcha lenta
  revLimiter: number         // RPM do limitador
  flywheelMass: number       // kg — massa do volante do motor
  engineBrakeFactor: number  // Fator de freio motor (0-1)
  throttleProgressionExponent?: number // Expoente de progressividade do acelerador (ex: 1.45 para carros, 1.15 para motos)
  engineType?: string        // Tipo acústico / mecânico (ex: 'i4_turbo_flex', 'i4_diesel', 'boxer6')
  defaultFuelType?: VehicleFuelType
  podiumGainMultiplier?: number
  podiumGainMinRpm?: number
  defaultInternals?: 'stock' | 'forged'
  torqueCurve: TorqueCurvePoint[]
  turbo?: TurboConfig
}

/** Relação de cada marcha */
export interface GearRatio {
  gear: number
  ratio: number
}

/** Configuração do TCS */
export interface TcsConfig {
  enabled: boolean
  slipThreshold?: number     // Tolerância de escorregamento
  torqueReduction?: number   // Percentual de corte de torque (0-1)
}

/** Configuração do controle de largada (Launch Control) */
export interface LaunchControlConfig {
  enabled: boolean
  launchRpm: number          // RPM sustentado na largada (ex: 4500 para GT3 RS, 3800 para GTI)
  targetBoostBar?: number    // Pressão gerada no turbo com launch armado (anti-lag spool)
}

export type SelectorPosition = 'P' | 'R' | 'N' | 'D' | 'S' | 'M'

export type ManualShiftControl =
  | 'paddle_shifters'
  | 'gear_selector_gesture'
  | 'gear_selector_buttons'
  | 'sequential_lever'

export type MultimediaType = 'factory' | 'radio' | 'aftermarket' | 'none'
export type MultimediaLayout = 'horizontal' | 'vertical' | 'compact' | 'none'

export interface VehicleMultimediaCapability {
  type: MultimediaType
  layout: MultimediaLayout
  screenSize?: number
  name: string
  features: string[]
  supportsAftermarketUpgrade: boolean
}

export interface VehicleActiveAeroCapability {
  hasActiveRearWing: boolean
  hasAdjustableRideHeight: boolean
}

export interface VehicleCapabilities {
  supportedDrivingModes: DrivingMode[]
  defaultDrivingMode: DrivingMode
  transmissionType: TransmissionType
  supportedSelectorPositions: SelectorPosition[]
  supportsManualMode: boolean
  manualShiftControls: ManualShiftControl[]
  supportsPaddleShifters: boolean
  supportsNos: boolean
  hasDriveModes: boolean
  hasTransmissionModes: boolean
  hasPaddleShifters: boolean
  hasManualShift: boolean
  hasClutchPedal: boolean
  has4x4Selector: boolean
  hasInfotainment: boolean
  isMotorcycle: boolean
  multimedia: VehicleMultimediaCapability
  activeAero?: VehicleActiveAeroCapability
}

/** Configuração da transmissão */
export interface TransmissionConfig {
  type: TransmissionType
  /** Arquitetura canônica de tração (localização única — não duplicar na raiz de VehicleConfig) */
  drivetrain?: DrivetrainConfigValue
  /** Posições físicas/operacionais realmente disponíveis no seletor deste veículo. */
  supportedSelectorPositions: SelectorPosition[]
  gearCount: number
  gearRatios: GearRatio[]
  reverseRatio: number
  finalDrive: number         // Relação do diferencial
  frontFinalDrive?: number    // Relação do diferencial dianteiro (ex: Porsche 992 3.330)
  hasClutch: boolean
  isSimulatedGears?: boolean // Ex: relações virtuais no CVT
  hasManualMode?: boolean    // Permite trocar manualmente (borboletas / alavanca)
  defaultMode?: 'automatic' | 'manual'
  defaultDrivingMode?: DrivingMode
  supportedModes?: DrivingMode[]
  manualShiftControls?: ManualShiftControl[]
  supportsPaddleShifters?: boolean
  supportsNos?: boolean
  /** Indica declarativamente se o veículo possui freios ABS de fábrica (false em clássicos pré-ABS) */
  hasAbs?: boolean
  tcs?: TcsConfig
  launchControl?: LaunchControlConfig
}

/** Configuração de áudio (preparada para amostras reais e sintetizador) */
export interface AudioConfig {
  useSamples: boolean
  engineType?: 'i4' | 'boxer6' | 'i4_highrev' | 'i4_ap' | 'i4_vtec' | 'v6' | 'v8' | string
  synthConfig: SynthAudioConfig
  sampleConfig?: SampleAudioConfig
}

/** Configuração para áudio sintetizado (MVP e Modelagem Acústica Física) */
export interface SynthAudioConfig {
  baseFrequency: number      // Frequência base do oscilador em Hz
  harmonics: number[]        // Multiplicadores de harmônicos
  gainIdle: number           // Ganho na marcha lenta (0-1)
  gainMax: number            // Ganho no RPM máximo (0-1)
  cylinders?: number         // Número de cilindros (ex: 4, 6)
  engineType?: 'i4' | 'boxer6' | 'i4_highrev' | 'i4_ap' | 'i4_vtec' | 'v6' | 'v8' | 'i6_chevrolet' | 'i4_diesel' | 'i4_turbo_flex' | 'i4_flex' | string
  exhaustResonanceHz?: number // Frequência de ressonância do escape em Hz
  intakeResonanceHz?: number  // Frequência de ressonância da admissão em Hz
  hasBrapOnShift?: boolean   // Estouro de troca de marcha PDK/DSG
}

/** Configuração para amostras de áudio reais (futuro) */
export interface SampleAudioConfig {
  basePath: string           // Ex: '/vehicles/gol-g6/sounds/'
  layers: AudioLayerConfig[]
}

/** Camada de áudio (RPM range → arquivo) */
export interface AudioLayerConfig {
  file: string               // Ex: 'idle.ogg'
  rpmMin: number
  rpmMax: number
  baseRpm: number            // RPM de referência do sample
}

export type DashboardTheme =
  | 'classic'
  | 'modern'
  | 'motorcycle'
  | 'supercar'
  | 'gti'
  | 'jetta_gli_aid'
  | 'bmw_curved_msport'
  | 'ford_pampa_1997'
  | 'ford_fusion_2012_ice'
  | 'ford_fusion_2019_smartgauge'
  | 'square_turbo'
  | 'civic_si'
  | 'opala_classic'
  | 'toro_endurance'
  | 'toro_ranch'
  | 'default'

/** Configuração do painel visual */
export interface DashboardConfig {
  type: 'default' | 'custom'
  theme?: DashboardTheme
  customSvgPath?: string     // SVG customizado do painel
  tachometerMax: number      // RPM máximo no conta-giros
  speedometerMax: number     // Velocidade máxima no velocímetro
  redlineStart: number       // Onde começa a zona vermelha
  shiftLightOffsetRpm?: number // RPM antes do redline para acionar o shift light (default 500)
  fuelCapacity?: number      // Litros do tanque de combustível
  coolantTempTarget?: number // Temperatura operacional nominal em °C (default 90)
  hasBoostGauge?: boolean    // Manômetro de pressão de turbo
  hasInfotainment?: boolean  // Central multimídia automotiva inteligente
}

/** Dados do veículo */
export interface VehicleInfo {
  name: string
  brand: string
  model: string
  year: number
  category: VehicleCategory
  weight: number             // kg
  wheelDiameter: number      // metros
  description?: string
  thumbnailPath?: string
  powerHp?: string | number  // Ex: "106 / 110 HP" ou 120
  torqueKgfm?: number        // Ex: 14.3
}

/** Configuração completa de um veículo */
export interface VehicleConfig {
  id: string
  info: VehicleInfo
  engine: EngineConfig
  transmission: TransmissionConfig
  audio: AudioConfig
  dashboard: DashboardConfig
  chassis?: ChassisConfig
  ignition?: VehicleIgnitionSpec
  cabin?: VehicleCabinSpec
  controls?: VehicleControlsSpec
  multimedia?: VehicleMultimediaSpec
  visual2d?: VehicleVisual2DSpec
  aerodynamics?: VehicleAeroSpec
  heavyDuty?: VehicleHeavyDutySpec
}

/** Manifest de veículos disponíveis (índice) */
export interface VehicleManifest {
  vehicles: VehicleManifestEntry[]
}

export interface VehicleManifestEntry {
  id: string
  name: string
  brand: string
  model?: string
  year: number
  category: VehicleCategory
  powerHp: string | number
  torqueKgfm: number
  transmissionType: TransmissionType
  transmissionLabel: string
  gearCount: number
  isSimulatedGears?: boolean
  hasManualMode?: boolean
  supportedModes?: DrivingMode[]
  hasTcs?: boolean
  hasClutchPedal?: boolean
  thumbnailPath?: string
  configPath: string
}

/**
 * Extrai e normaliza as capacidades individuais de um veículo.
 * Centraliza regras para que a interface e a simulação consultem a mesma fonte.
 */
export function getVehicleCapabilities(
  vehicle: VehicleConfig,
  upgrades?: { multimediaKit?: boolean } | null,
): VehicleCapabilities {
  const { transmission, info } = vehicle
  const isMoto = info.category === 'motorcycle'
  const isAutoOrCvt =
    transmission.type === 'automatic' ||
    transmission.type === 'cvt' ||
    transmission.type === 'dct'

  // Modos de condução suportados (ECO / NORMAL / SPORT / TRACK de chassi/acelerador)
  let supportedDrivingModes: DrivingMode[] = transmission.supportedModes ?? []
  if (isMoto) {
    // Motocicletas: respeita apenas os modos reais declarados no config.json (ex.: CB1000R: RAIN/STANDARD/SPORT)
    supportedDrivingModes =
      transmission.supportedModes && transmission.supportedModes.length > 0
        ? [...transmission.supportedModes]
        : []
  } else if (vehicle.id.includes('toro-endurance')) {
    // Toro Endurance de entrada: possui seletor de modo Sport (Normal ↔ Sport), sem posição S independente
    supportedDrivingModes =
      transmission.supportedModes && transmission.supportedModes.length > 0
        ? transmission.supportedModes
        : ['normal', 'sport']
  } else if (vehicle.id.includes('toro-ranch') || vehicle.id.includes('toro')) {
    // Toro Ranch: possui modos de troca de marcha Eco, Normal e Sport
    supportedDrivingModes =
      transmission.supportedModes && transmission.supportedModes.length > 0
        ? transmission.supportedModes
        : ['eco', 'normal', 'sport']
  } else if (vehicle.id === 'yaris-2019' || vehicle.id.includes('yaris')) {
    // Yaris possui somente modo NORMAL de condução
    supportedDrivingModes = ['normal']
  } else if (!isAutoOrCvt && !isMoto) {
    // Carros puramente manuais sem modos eletrônicos (Civic Si, Gol G6, Gol Quadrado, Opala)
    supportedDrivingModes = []
  }

  const defaultDrivingMode: DrivingMode =
    transmission.defaultDrivingMode ??
    (supportedDrivingModes.includes('normal')
      ? 'normal'
      : (supportedDrivingModes[0] ?? 'normal'))

  // Posições de seletor suportadas
  let supportedSelectorPositions: SelectorPosition[] =
    transmission.supportedSelectorPositions
      ? [...transmission.supportedSelectorPositions]
      : (isAutoOrCvt ? ['P', 'R', 'N', 'D', 'M'] : ['N'])
  if (!isAutoOrCvt) {
    supportedSelectorPositions = ['N']
  } else if (vehicle.id.includes('toro-endurance')) {
    // Toro Endurance de entrada: sem posição S no câmbio
    supportedSelectorPositions = supportedSelectorPositions.filter((pos) => pos !== 'S')
  } else if (vehicle.id.includes('toro-ranch') || vehicle.id.includes('porsche-gt3')) {
    // Toro Ranch e Porsche GT3: garantem posição S no câmbio
    if (!supportedSelectorPositions.includes('S')) {
      const dIndex = supportedSelectorPositions.indexOf('D')
      if (dIndex >= 0) {
        supportedSelectorPositions.splice(dIndex + 1, 0, 'S')
      } else {
        supportedSelectorPositions.push('S')
      }
    }
  }

  // Suporte a modo manual em automáticos/CVT
  const supportsManualMode = Boolean(isAutoOrCvt && transmission.hasManualMode)

  // Borboletas (Paddle Shifters)
  const supportsPaddleShifters =
    transmission.supportsPaddleShifters ??
    (supportsManualMode &&
      (vehicle.id.includes('golf-gti') ||
        vehicle.id.includes('porsche-gt3') ||
        vehicle.id.includes('toro-ranch')) &&
      !vehicle.id.includes('toro-endurance'))

  // Controles de troca manual
  let manualShiftControls: ManualShiftControl[] = transmission.manualShiftControls ?? []
  if (manualShiftControls.length === 0) {
    if (isMoto) {
      manualShiftControls = ['sequential_lever']
    } else if (vehicle.id.includes('toro-endurance')) {
      manualShiftControls = ['gear_selector_gesture']
    } else if (vehicle.id.includes('toro-ranch')) {
      manualShiftControls = ['paddle_shifters', 'gear_selector_gesture']
    } else if (vehicle.id.includes('yaris')) {
      manualShiftControls = ['gear_selector_gesture']
    } else if (vehicle.id.includes('porsche-gt3')) {
      manualShiftControls = ['paddle_shifters', 'gear_selector_gesture']
    } else if (vehicle.id.includes('golf-gti')) {
      manualShiftControls = ['paddle_shifters', 'gear_selector_gesture']
    }
  }

  // Suporte a nitro (NOS): motos não possuem por padrão, carros suportam via oficina
  const supportsNos = transmission.supportsNos ?? !isMoto

  // Capacidade de multimídia e unidade de áudio individual (delegado ao resolver declarativo)
  const resolvedMedia = resolveVehicleMultimediaSpec(vehicle, upgrades)
  const multimedia: VehicleMultimediaCapability = {
    type: resolvedMedia.type,
    layout: resolvedMedia.layout,
    screenSize: resolvedMedia.screenSize,
    name: resolvedMedia.name,
    features: resolvedMedia.features,
    supportsAftermarketUpgrade: resolvedMedia.supportsAftermarketUpgrade,
  }

  // Aerodinâmica ativa (delegada ao resolver declarativo)
  const resolvedAero = resolveVehicleAero(vehicle)
  const activeAero: VehicleActiveAeroCapability | undefined =
    resolvedAero.hasActiveRearWing || resolvedAero.hasAdjustableRideHeight
      ? {
          hasActiveRearWing: resolvedAero.hasActiveRearWing,
          hasAdjustableRideHeight: resolvedAero.hasAdjustableRideHeight,
        }
      : undefined

  // Recursos de tração 4x4 e multimídia (derivados da arquitetura canônica de tração)
  const resolvedDrivetrain = resolveVehicleDrivetrain(vehicle)
  const has4x4Selector = resolvedDrivetrain === '4x4_selectable'
  const hasInfotainment =
    multimedia.type === 'factory' ||
    multimedia.type === 'aftermarket' ||
    Boolean(vehicle.dashboard.hasInfotainment && !isMoto)

  return {
    supportedDrivingModes,
    defaultDrivingMode,
    transmissionType: transmission.type,
    supportedSelectorPositions,
    supportsManualMode,
    manualShiftControls,
    supportsPaddleShifters,
    supportsNos,
    hasDriveModes: supportedDrivingModes.length > 1,
    hasTransmissionModes: supportedSelectorPositions.length > 1,
    hasPaddleShifters: supportsPaddleShifters,
    hasManualShift: supportsManualMode || transmission.type === 'manual' || transmission.type === 'sequential',
    hasClutchPedal: transmission.hasClutch,
    has4x4Selector,
    hasInfotainment,
    isMotorcycle: isMoto,
    multimedia,
    activeAero,
  }
}
