export { VehiclePhysics } from './VehiclePhysics'
export type { VehiclePhysicsConfig, PhysicsTickInput, PhysicsTickResult, VehiclePhysicsSnapshot, FourWheelDriveMode } from './VehiclePhysics'
export { TractionControlSystem } from './TractionControlSystem'
export type { TractionControlConfig, TcsInput, TcsResult } from './TractionControlSystem'

// Fase 1.6.1: Chassi e Centro de Massa
export {
  VehicleChassis,
  VEHICLE_CHASSIS_DATABASE,
  createVehicleChassis,
} from './Chassis'
export type {
  ChassisConfig,
  AxleLoads,
  DynamicLoadResult,
} from './Chassis'

// Fase 1.6.1: Integração Temporal Determinística e FAIL_SAFE_HOLD
export {
  DeterministicIntegrator,
} from './DeterministicIntegrator'
export type {
  IntegratorOptions,
  IntegratorStepResult,
  PhysicsIntegrityStatus,
  PhysicsFaultRecord,
  SubstepHandler,
} from './DeterministicIntegrator'
