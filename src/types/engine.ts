import type { EngineStatus } from './simulation'

/** Resultado de um tick da simulação do motor */
export interface EngineTickResult {
  rpm: number
  torqueOutput: number      // Nm (torque positivo de propulsão)
  engineBrakeTorque?: number // Nm (magnitude do torque resistivo de freio motor quando negativo no eixo)
  isRevLimiting: boolean
  angularVelocity: number   // rad/s
  isStalled: boolean
  isBogWarning: boolean     // RPM abaixo do idle sob carga (motor amarrando, pré-afogamento)
  status: EngineStatus
}

/** Parâmetros de entrada para um tick do motor */
export interface EngineTickInput {
  throttle: number          // 0-1
  loadTorque: number        // Torque resistivo transmitido pela embreagem/drivetrain (Nm)
  deltaTime: number         // segundos
}
