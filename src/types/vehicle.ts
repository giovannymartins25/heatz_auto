/**
 * Tipos de configuração de veículos.
 * Cada veículo é definido por um VehicleConfig completo.
 * Esses tipos são a base para todo o sistema — motor, transmissão, áudio e painel.
 */

export type VehicleCategory = 'car' | 'motorcycle' | 'truck' | 'bus' | 'tractor' | 'custom'

export type TransmissionType = 'manual' | 'automatic' | 'sequential' | 'cvt' | 'dct'

export type DrivingMode = 'eco' | 'normal' | 'sport' | 'track'

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

/** Configuração da transmissão */
export interface TransmissionConfig {
  type: TransmissionType
  gearCount: number
  gearRatios: GearRatio[]
  reverseRatio: number
  finalDrive: number         // Relação do diferencial
  hasClutch: boolean
  isSimulatedGears?: boolean // Ex: relações virtuais no CVT
  hasManualMode?: boolean    // Permite trocar manualmente (borboletas / alavanca)
  defaultMode?: 'automatic' | 'manual'
  supportedModes?: DrivingMode[]
  tcs?: TcsConfig
  launchControl?: LaunchControlConfig
}

/** Configuração de áudio (preparada para amostras reais e sintetizador) */
export interface AudioConfig {
  useSamples: boolean
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
  engineType?: 'i4' | 'boxer6' | 'i4_highrev' | 'v6' | 'v8'
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

export type DashboardTheme = 'classic' | 'modern' | 'motorcycle' | 'supercar' | 'gti' | 'default'

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
