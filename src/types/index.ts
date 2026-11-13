export { getVehicleCapabilities } from './vehicle'

export type {
  VehicleCategory,
  TransmissionType,
  DrivingMode,
  GearSelectorPosition,
  SelectorPosition,
  ManualShiftControl,
  VehicleCapabilities,
  TorqueCurvePoint,
  EngineConfig,
  GearRatio,
  TransmissionConfig,
  AudioConfig,
  SynthAudioConfig,
  SampleAudioConfig,
  AudioLayerConfig,
  DashboardConfig,
  DashboardTheme,
  VehicleInfo,
  VehicleConfig,
  VehicleManifest,
  VehicleManifestEntry,
} from './vehicle'

export type {
  EngineState,
  TransmissionState,
  VehicleState,
  SimulationState,
} from './simulation'

export type {
  IAudioEngine,
  SoundCategory,
} from './audio'

export type {
  EngineTickResult,
  EngineTickInput,
} from './engine'
