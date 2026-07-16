import type { EngineConfig } from '@/types'
import type { EngineTickInput, EngineTickResult } from '@/types'
import { TorqueCurve } from './TorqueCurve'
import { clamp } from '@/utils/math'
import {
  RPM_TO_RAD_S,
  RAD_S_TO_RPM,
  FLYWHEEL_RADIUS,
  ENGINE_FRICTION_COEFFICIENT,
  IDLE_CONTROLLER_GAIN,
} from './constants'

/**
 * EngineSimulator — Simulação física do motor.
 *
 * Modela o motor como um corpo rotacional (volante do motor / flywheel).
 * O RPM nunca é "setado" diretamente — ele é calculado a cada tick
 * como resultado das forças atuando no volante:
 *
 *   Torque líquido = Torque do motor × throttle
 *                   - Atrito interno
 *                   - Freio motor
 *                   - Carga da transmissão
 *
 *   Aceleração angular = Torque líquido / Momento de inércia
 *   Velocidade angular += Aceleração angular × deltaTime
 *   RPM = Velocidade angular × (60 / 2π)
 *
 * Isso produz comportamento realista:
 * - Motor leve (moto) sobe RPM rápido
 * - Motor pesado (caminhão) sobe RPM devagar
 * - Cada marcha altera a carga no motor
 */
export class EngineSimulator {
  private readonly config: EngineConfig
  private readonly torqueCurve: TorqueCurve
  private readonly momentOfInertia: number

  /** Velocidade angular em rad/s (estado interno) */
  private angularVelocity: number
  private isRunning: boolean

  constructor(config: EngineConfig) {
    this.config = config
    this.torqueCurve = new TorqueCurve(config.torqueCurve)

    // Momento de inércia: I = m × r²
    // flywheelMass em kg, FLYWHEEL_RADIUS em metros
    this.momentOfInertia = config.flywheelMass * FLYWHEEL_RADIUS * FLYWHEEL_RADIUS

    // Iniciar parado
    this.angularVelocity = 0
    this.isRunning = false
  }

  /** Liga o motor — seta o RPM na marcha lenta */
  start(): void {
    this.isRunning = true
    this.angularVelocity = this.config.idleRpm * RPM_TO_RAD_S
  }

  /** Desliga o motor */
  stop(): void {
    this.isRunning = false
    this.angularVelocity = 0
  }

  /** Retorna o RPM atual */
  getRpm(): number {
    return this.angularVelocity * RAD_S_TO_RPM
  }

  /** Retorna se o motor está ligado */
  getIsRunning(): boolean {
    return this.isRunning
  }

  /**
   * Executa um tick da simulação física.
   * Chamado a cada passo do fixed timestep (120Hz).
   */
  tick(input: EngineTickInput): EngineTickResult {
    if (!this.isRunning) {
      return {
        rpm: 0,
        torqueOutput: 0,
        isRevLimiting: false,
        angularVelocity: 0,
      }
    }

    const currentRpm = this.getRpm()
    const { throttle, deltaTime } = input

    // 1. Torque do motor baseado na curva × throttle
    const availableTorque = this.torqueCurve.getTorqueAtRpm(currentRpm)
    let engineTorque = availableTorque * throttle

    // 2. Rev limiter — corta injeção quando atinge o limite
    let isRevLimiting = false
    if (currentRpm >= this.config.revLimiter) {
      engineTorque = 0
      isRevLimiting = true
    }

    // 3. Controlador de marcha lenta (idle)
    // Quando throttle = 0, aplica torque para manter RPM de idle
    let idleTorque = 0
    if (throttle < 0.05 && currentRpm < this.config.idleRpm * 1.2) {
      const rpmError = this.config.idleRpm - currentRpm
      idleTorque = rpmError * IDLE_CONTROLLER_GAIN
      idleTorque = clamp(idleTorque, -20, 50)
    }

    // 4. Atrito interno do motor
    // Proporcional à velocidade angular — mais rápido = mais atrito
    const frictionTorque = ENGINE_FRICTION_COEFFICIENT * this.angularVelocity

    // 5. Freio motor (engine braking)
    // Ativo quando throttle é baixo e RPM acima de idle
    let engineBrakeTorque = 0
    if (throttle < 0.05 && currentRpm > this.config.idleRpm * 1.1) {
      engineBrakeTorque = this.config.engineBrakeFactor * availableTorque * 0.3
    }

    // 6. Carga da transmissão
    // Quando engrenado, a inércia do veículo resiste à aceleração
    let loadTorque = 0
    if (!input.isClutchPressed && input.currentGear !== 0) {
      const effectiveRatio = Math.abs(input.gearRatio * input.finalDrive)
      if (effectiveRatio > 0) {
        // Simula a resistência do veículo transmitida ao motor
        // Mais pesado em marchas mais baixas (ratio maior)
        loadTorque = effectiveRatio * 2.0
        
        // Se o veículo está em movimento, a velocidade dele influencia o motor
        if (input.vehicleSpeed > 0) {
          const wheelRpm = (input.vehicleSpeed / (Math.PI * input.wheelRadius * 2)) * 60
          const expectedEngineRpm = wheelRpm * effectiveRatio
          const rpmDiff = currentRpm - expectedEngineRpm
          
          // Se o motor está girando mais rápido que as rodas pedem, a transmissão freia o motor
          if (rpmDiff > 0) {
            loadTorque += rpmDiff * 0.02 * effectiveRatio
          }
        }
      }
    }

    // 7. Torque líquido
    const netTorque = engineTorque + idleTorque - frictionTorque - engineBrakeTorque - loadTorque

    // 8. Aceleração angular: α = τ / I
    const angularAcceleration = netTorque / this.momentOfInertia

    // 9. Atualizar velocidade angular: ω += α × dt
    this.angularVelocity += angularAcceleration * deltaTime

    // 10. Clamp RPM — nunca abaixo de 0 e nunca acima de maxRpm
    const minAngularVelocity = this.isRunning
      ? (this.config.idleRpm * 0.7) * RPM_TO_RAD_S
      : 0
    const maxAngularVelocity = this.config.maxRpm * RPM_TO_RAD_S

    this.angularVelocity = clamp(this.angularVelocity, minAngularVelocity, maxAngularVelocity)

    return {
      rpm: this.getRpm(),
      torqueOutput: Math.max(0, engineTorque),
      isRevLimiting,
      angularVelocity: this.angularVelocity,
    }
  }

  /**
   * Força o RPM para um valor específico.
   * Usado quando a transmissão impõe RPM (ex: trocar de marcha).
   */
  setRpm(rpm: number): void {
    this.angularVelocity = clamp(rpm, 0, this.config.maxRpm) * RPM_TO_RAD_S
  }
}
