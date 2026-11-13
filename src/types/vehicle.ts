/**
 * Tipos de configuração de veículos.
 * Cada veículo é definido por um VehicleConfig completo.
 * Esses tipos são a base para todo o sistema — motor, transmissão, áudio e painel.
 */

export type VehicleCategory = 'car' | 'motorcycle' | 'truck' | 'bus' | 'tractor' | 'custom'

export type TransmissionType = 'manual' | 'automatic' | 'sequential' | 'cvt' | 'dct'

export type DrivingMode = 'eco' | 'normal' | 'sport' | 'track'

export type GearSelectorPosition = SelectorPosition

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

export interface VehicleCapabilities {
  supportedDrivingModes: DrivingMode[]
  defaultDrivingMode: DrivingMode
  transmissionType: TransmissionType
  supportedSelectorPositions: SelectorPosition[]
  supportsManualMode: boolean
  manualShiftControls: ManualShiftControl[]
  supportsPaddleShifters: boolean
  supportsNos: boolean
}

/** Configuração da transmissão */
export interface TransmissionConfig {
  type: TransmissionType
  /** Posições físicas/operacionais realmente disponíveis no seletor deste veículo. */
  supportedSelectorPositions: SelectorPosition[]
  gearCount: number
  gearRatios: GearRatio[]
  reverseRatio: number
  finalDrive: number         // Relação do diferencial
  hasClutch: boolean
  isSimulatedGears?: boolean // Ex: relações virtuais no CVT
  hasManualMode?: boolean    // Permite trocar manualmente (borboletas / alavanca)
  defaultMode?: 'automatic' | 'manual'
  defaultDrivingMode?: DrivingMode
  supportedModes?: DrivingMode[]
  manualShiftControls?: ManualShiftControl[]
  supportsPaddleShifters?: boolean
  supportsNos?: boolean
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
  engineType?: 'i4' | 'boxer6' | 'i4_highrev' | 'i4_ap' | 'i4_vtec' | 'v6' | 'v8' | 'i6_chevrolet'
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
  | 'square_turbo'
  | 'civic_si'
  | 'opala_classic'
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
export function getVehicleCapabilities(vehicle: VehicleConfig): VehicleCapabilities {
  const { transmission, info } = vehicle
  const isMoto = info.category === 'motorcycle'
  const isAutoOrCvt =
    transmission.type === 'automatic' ||
    transmission.type === 'cvt' ||
    transmission.type === 'dct'

  // Modos de condução suportados
  let supportedDrivingModes: DrivingMode[] = transmission.supportedModes ?? []
  if (vehicle.id === 'yaris-2019' || vehicle.id.includes('yaris')) {
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
    transmission.supportedSelectorPositions ?? (isAutoOrCvt ? ['P', 'R', 'N', 'D', 'M'] : ['N'])
  if (!isAutoOrCvt) {
    supportedSelectorPositions = ['N']
  }

  // Suporte a modo manual em automáticos/CVT
  const supportsManualMode = Boolean(isAutoOrCvt && transmission.hasManualMode)

  // Borboletas (Paddle Shifters)
  const supportsPaddleShifters =
    transmission.supportsPaddleShifters ??
    (supportsManualMode && (vehicle.id.includes('golf-gti') || vehicle.id.includes('porsche-gt3')))

  // Controles de troca manual
  let manualShiftControls: ManualShiftControl[] = transmission.manualShiftControls ?? []
  if (manualShiftControls.length === 0) {
    if (isMoto) {
      manualShiftControls = ['sequential_lever']
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

  return {
    supportedDrivingModes,
    defaultDrivingMode,
    transmissionType: transmission.type,
    supportedSelectorPositions,
    supportsManualMode,
    manualShiftControls,
    supportsPaddleShifters,
    supportsNos,
  }
}
