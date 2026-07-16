/**
 * Tipos do motor de simulação (engine physics).
 * Separado do EngineState para isolar a lógica de configuração do runtime.
 */

/** Resultado de um tick da simulação do motor */
export interface EngineTickResult {
  rpm: number
  torqueOutput: number      // Nm
  isRevLimiting: boolean
  angularVelocity: number   // rad/s
}

/** Parâmetros de entrada para um tick do motor */
export interface EngineTickInput {
  throttle: number          // 0-1
  currentGear: number
  gearRatio: number
  finalDrive: number
  vehicleSpeed: number      // m/s
  wheelRadius: number       // metros
  isClutchPressed: boolean
  deltaTime: number         // segundos
}
