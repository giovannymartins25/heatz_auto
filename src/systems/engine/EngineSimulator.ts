import type { EngineConfig } from '@/types'
import type { EngineTickInput, EngineTickResult } from '@/types'
import type { EngineStatus } from '@/types/simulation'
import { TorqueCurve } from './TorqueCurve'
import { clamp } from '@/utils/math'
import {
  RPM_TO_RAD_S,
  RAD_S_TO_RPM,
  FLYWHEEL_RADIUS,
  ENGINE_FRICTION_COEFFICIENT,
  IDLE_CONTROLLER_GAIN,
} from './constants'


/** Duração do processo de partida (cranking) pelo motor de arranque em segundos */
const CRANKING_DURATION = 0.45

/** Rotação crítica de estol em RPM — abaixo disso o motor apaga */
const STALL_RPM_THRESHOLD = 380

/**
 * EngineSimulator — Simulação física do motor a combustão.
 *
 * Estados:
 * - OFF: Desligado (RPM 0)
 * - STARTING: Dando partida com motor de arranque girando até idle
 * - RUNNING: Em funcionamento normal produzindo torque
 * - STALLED: Motor afogou / estolou por excesso de carga ou sub-rotação
 */
export class EngineSimulator {
  private readonly config: EngineConfig
  private readonly torqueCurve: TorqueCurve
  private readonly momentOfInertia: number

  /** Velocidade angular em rad/s */
  private angularVelocity: number = 0
  private status: EngineStatus = 'off'
  private startingElapsed: number = 0
  private lastTorqueOutput: number = 0

  constructor(config: EngineConfig) {
    this.config = config
    this.torqueCurve = new TorqueCurve(config.torqueCurve)

    // Momento de inércia do volante: I = m * r²
    this.momentOfInertia = config.flywheelMass * FLYWHEEL_RADIUS * FLYWHEEL_RADIUS
  }

  getStatus(): EngineStatus {
    return this.status
  }

  getIsRunning(): boolean {
    return this.status === 'running'
  }

  getIsStalled(): boolean {
    return this.status === 'stalled'
  }

  getRpm(): number {
    return Math.max(0, this.angularVelocity * RAD_S_TO_RPM)
  }

  getAngularVelocity(): number {
    return this.angularVelocity
  }

  getTorqueOutput(): number {
    return this.lastTorqueOutput
  }

  /**
   * Inicia o processo de partida (cranking).
   * Se já estiver em funcionamento, ignora.
   * Se estiver parado ou estolado, aciona o motor de arranque.
   */
  start(): void {
    if (this.status === 'running' || this.status === 'starting') return

    this.status = 'starting'
    this.startingElapsed = 0
    this.angularVelocity = Math.max(this.angularVelocity, 100 * RPM_TO_RAD_S)
  }

  /** Desliga o motor */
  stop(): void {
    this.status = 'off'
    this.startingElapsed = 0
  }

  /**
   * Executa um tick da simulação do motor (120Hz).
   */
  tick(input: EngineTickInput): EngineTickResult {
    const { throttle, loadTorque, deltaTime } = input

    // ─── 1. ESTADO: OFF ou STALLED ───
    if (this.status === 'off' || this.status === 'stalled') {
      // O motor perde rotação por atrito até parar
      const decayTorque = ENGINE_FRICTION_COEFFICIENT * this.angularVelocity + 15
      const decel = decayTorque / this.momentOfInertia
      this.angularVelocity = Math.max(0, this.angularVelocity - decel * deltaTime)

      return {
        rpm: this.getRpm(),
        torqueOutput: 0,
        isRevLimiting: false,
        angularVelocity: this.angularVelocity,
        isStalled: this.status === 'stalled',
        isBogWarning: false,
        status: this.status,
      }
    }

    // ─── 2. ESTADO: STARTING (Cranking) ───
    if (this.status === 'starting') {
      this.startingElapsed += deltaTime

      // Durante o cranking, qualquer carga de transmissão é ignorada:
      // o motor de arranque gira sozinho sem estar acoplado ao drivetrain
      const progress = clamp(this.startingElapsed / CRANKING_DURATION, 0, 1)
      const targetRpm = progress * this.config.idleRpm
      this.angularVelocity = targetRpm * RPM_TO_RAD_S

      if (this.startingElapsed >= CRANKING_DURATION) {
        // Motor pegou e entra em regime estável de funcionamento
        this.status = 'running'
        this.angularVelocity = this.config.idleRpm * RPM_TO_RAD_S
      }

      return {
        rpm: this.getRpm(),
        torqueOutput: 0,
        isRevLimiting: false,
        angularVelocity: this.angularVelocity,
        isStalled: false,
        isBogWarning: false,
        status: this.status,
      }
    }

    // ─── 3. ESTADO: RUNNING (Funcionamento Normal) ───
    const currentRpm = this.getRpm()

    // 3.1 Torque do motor baseado na curva de torque x resposta progressiva do acelerador
    const availableTorque = this.torqueCurve.getTorqueAtRpm(currentRpm)
    // Curva progressiva de borboleta de aceleração (0-100%)
    const effectiveThrottle = throttle > 0 ? Math.pow(throttle, 0.75) : 0
    let engineTorque = availableTorque * effectiveThrottle

    // 3.2 Limitador de Rotação (Rev Limiter) — corta injeção
    let isRevLimiting = false
    if (currentRpm >= this.config.revLimiter) {
      engineTorque = 0
      isRevLimiting = true
    }

    // 3.3 Atuador de Marcha Lenta (Idle Controller)
    // Mantém a rotação de idle quando não há carga, mas cede sob carga pesada da transmissão.
    // A força do controlador é inversamente proporcional à carga — isso permite afogamento real.
    const loadFraction = clamp(loadTorque / Math.max(this.config.maxTorque * 0.5, 1), 0, 1)
    const idleGainReduction = 1.0 - loadFraction * 0.85
    let idleTorque = 0
    if (currentRpm < this.config.idleRpm) {
      const rpmError = this.config.idleRpm - currentRpm
      // Quanto maior a carga, menor a capacidade do controlador de recuperar o giro
      const rawIdleTorque = rpmError * IDLE_CONTROLLER_GAIN * 1.5 * idleGainReduction
      idleTorque = clamp(rawIdleTorque, 0, 80 * idleGainReduction)
    } else if (throttle < 0.12 && currentRpm < this.config.idleRpm * 1.2) {
      const rpmError = this.config.idleRpm - currentRpm
      idleTorque = clamp(rpmError * IDLE_CONTROLLER_GAIN * idleGainReduction, -10, 55)
    }

    // 3.4 Atrito interno do motor (proporcional à rotação)
    const frictionTorque = ENGINE_FRICTION_COEFFICIENT * this.angularVelocity

    // 3.5 Freio Motor (quando throttle é baixo e giro alto)
    let engineBrakeTorque = 0
    if (throttle < 0.05 && currentRpm > this.config.idleRpm * 1.1) {
      engineBrakeTorque = this.config.engineBrakeFactor * availableTorque * 0.35
    }

    // 3.6 Torque Líquido atuando no virabrequim / volante
    // loadTorque vem da embreagem/transmissão
    const netTorque = engineTorque + idleTorque - frictionTorque - engineBrakeTorque - loadTorque

    // 3.7 Aceleração Angular: alpha = tau / I
    const angularAcceleration = netTorque / this.momentOfInertia

    // 3.8 Atualizar Velocidade Angular
    this.angularVelocity += angularAcceleration * deltaTime

    // 3.9 Limite Superior (maxRpm)
    const maxAngularVelocity = this.config.maxRpm * RPM_TO_RAD_S
    this.angularVelocity = Math.min(this.angularVelocity, maxAngularVelocity)

    // 3.10 VERIFICAÇÃO DE ESTOL (MOTOR MORRER)
    // O motor afoga quando o torque líquido derruba o RPM abaixo do limiar crítico.
    // Esta é uma consequência natural da física — não um if artificial.
    const postRpm = this.getRpm()
    if (postRpm < STALL_RPM_THRESHOLD) {
      this.status = 'stalled'
      // A inércia do volante não permite queda instantânea — decelera suavemente
      this.angularVelocity = Math.max(0, this.angularVelocity * 0.4)

      return {
        rpm: this.getRpm(),
        torqueOutput: 0,
        isRevLimiting: false,
        angularVelocity: this.angularVelocity,
        isStalled: true,
        isBogWarning: false,
        status: 'stalled',
      }
    }

    // 3.11 BOG WARNING — motor amarrando mas ainda não afogou
    // Ocorre quando RPM está abaixo de 30% acima do idle sob carga
    const isBogWarning = postRpm < this.config.idleRpm * 1.30 && loadTorque > 0 && throttle < 0.4

    const outputTorque = Math.max(0, engineTorque)
    this.lastTorqueOutput = outputTorque

    return {
      rpm: postRpm,
      torqueOutput: outputTorque,
      isRevLimiting,
      angularVelocity: this.angularVelocity,
      isStalled: false,
      isBogWarning: isBogWarning ?? false,
      status: 'running',
    }
  }

  /** Força o RPM (ex: troca de marcha rígida em sincronização instantânea) */
  setRpm(rpm: number): void {
    this.angularVelocity = clamp(rpm, 0, this.config.maxRpm) * RPM_TO_RAD_S
  }
}
