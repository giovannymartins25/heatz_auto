/**
 * Tipos de configuração de veículos.
 * Cada veículo é definido por um VehicleConfig completo.
 * Esses tipos são a base para todo o sistema — motor, transmissão, áudio e painel.
 */

export type VehicleCategory = 'car' | 'motorcycle' | 'truck' | 'bus' | 'tractor' | 'custom'

export type TransmissionType = 'manual' | 'automatic' | 'sequential' | 'cvt' | 'dct'

/** Ponto na curva de torque: RPM → torque em Nm */
export interface TorqueCurvePoint {
  rpm: number
  torque: number
}

/** Configuração do motor */
export interface EngineConfig {
  maxPower: number           // cv
  maxPowerRpm: number        // RPM onde atinge potência máxima
  maxTorque: number          // Nm
  maxTorqueRpm: number       // RPM onde atinge torque máximo
  maxRpm: number             // RPM máximo (corte)
  idleRpm: number            // RPM de marcha lenta
  revLimiter: number         // RPM do limitador
  flywheelMass: number       // kg — massa do volante do motor
  engineBrakeFactor: number  // Fator de freio motor (0-1)
  torqueCurve: TorqueCurvePoint[]
}

/** Relação de cada marcha */
export interface GearRatio {
  gear: number
  ratio: number
}

/** Configuração da transmissão */
export interface TransmissionConfig {
  type: TransmissionType
  gearCount: number
  gearRatios: GearRatio[]
  reverseRatio: number
  finalDrive: number        // Relação do diferencial
  hasClutch: boolean
}

/** Configuração de áudio (preparada para amostras reais e sintetizador) */
export interface AudioConfig {
  useSamples: boolean
  synthConfig: SynthAudioConfig
  sampleConfig?: SampleAudioConfig
}

/** Configuração para áudio sintetizado (MVP) */
export interface SynthAudioConfig {
  baseFrequency: number      // Frequência base do oscilador em Hz
  harmonics: number[]        // Multiplicadores de harmônicos
  gainIdle: number           // Ganho na marcha lenta (0-1)
  gainMax: number            // Ganho no RPM máximo (0-1)
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

/** Configuração do painel visual */
export interface DashboardConfig {
  type: 'default' | 'custom'
  customSvgPath?: string     // SVG customizado do painel
  tachometerMax: number      // RPM máximo no conta-giros
  speedometerMax: number     // Velocidade máxima no velocímetro
  redlineStart: number       // Onde começa a zona vermelha
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
  category: VehicleCategory
  thumbnailPath?: string
  configPath: string
}
