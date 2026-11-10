/**
 * Tipos do estado da simulação.
 * Representam o estado instantâneo do motor e veículo em runtime.
 */

export type EngineStatus = 'off' | 'starting' | 'running' | 'stalled'

export type FuelType = 'common_gasoline' | 'premium_podium' | 'ethanol_e100'

export type DragTreeStage =
  | 'idle'
  | 'pre_stage'
  | 'staged'
  | 'yellow_1'
  | 'yellow_2'
  | 'yellow_3'
  | 'green'
  | 'false_start'
  | 'racing'
  | 'finished'

export interface DragTimeSlip {
  reactionTime: number
  time60ft: number
  time0to100: number
  time201m: number
  time402m: number
  trapSpeedKmh: number
  isDisqualified: boolean
  createdAt: number
}

export interface DynoDataPoint {
  rpm: number
  powerHp: number
  torqueNm: number
}

/** Estado instantâneo do motor */
export interface EngineState {
  rpm: number
  throttle: number          // 0-1 (posição do acelerador)
  brake: number             // 0-1 (posição do freio)
  isRunning: boolean
  isStalled: boolean
  status: EngineStatus
  isRevLimiting: boolean    // Se está no limitador
}

/** Estado instantâneo da transmissão */
export interface TransmissionState {
  currentGear: number       // 0 = neutro, -1 = ré, 1+ = marchas
  isClutchPressed: boolean
  clutchPosition: number    // 0 = solta, 1 = pressionada
}

/** Estado instantâneo do veículo */
export interface VehicleState {
  speed: number             // km/h
  acceleration: number      // m/s²
}

/** Estado completo da simulação */
export interface SimulationState {
  engine: EngineState
  transmission: TransmissionState
  vehicle: VehicleState
  deltaTime: number         // Tempo desde o último frame (s)
  totalTime: number         // Tempo total da simulação (s)
  isActive: boolean         // Se a simulação está rodando
}
