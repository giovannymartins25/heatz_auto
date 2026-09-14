import type { EngineStatus } from './simulation'

/** Resultado de um tick da simulação do motor */
export interface EngineTickResult {
  rpm: number
  torqueOutput: number      // Nm
  isRevLimiting: boolean
  angularVelocity: number   // rad/s
  isStalled: boolean
  status: EngineStatus
}

/** Parâmetros de entrada para um tick do motor */
export interface EngineTickInput {
  throttle: number          // 0-1
  loadTorque: number        // Torque resistivo transmitido pela embreagem/drivetrain (Nm)
  deltaTime: number         // segundos
}
