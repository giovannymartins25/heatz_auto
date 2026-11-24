/**
 * IgnitionSystem.ts — Máquina de estados determinística de ignição e partida.
 *
 * Estados suportados:
 *   `OFF → ACC → ON → CRANK → ON`
 *   (Para veículos sem modo acessório, ex.: motocicleta CB1000R: `OFF → ON → CRANK → ON`)
 *
 * Responsabilidades:
 * 1. Coordenar-se com `EngineSimulator` sem criar um segundo estado paralelo de motor.
 * 2. Distinguir veículos com chave física (`type: 'key'`) e botão Start/Stop (`type: 'push_button'`).
 * 3. Validar o contrato explícito `startInterlock` (`'none' | 'brake' | 'clutch' | 'brake_or_clutch'`).
 * 4. Gerenciar tensão da bateria (`batteryVoltageV`), tentativas de partida, motivos de falha
 *    (intertravamento de pedal, bateria descarregada, pane seca, motor fundido) e retorno
 *    automático de `CRANK` para `ON` assim que o motor entra em funcionamento.
 */

import type { EngineStatus } from '@/types/simulation'
import type { IgnitionPosition, IgnitionStartInterlock, IgnitionType, VehicleIgnitionSpec } from '@/types/vehicle'
import { clamp } from '@/utils/math'

export interface IgnitionCrankInput {
  brake: number
  clutch: number
  engineStatus: EngineStatus
  isEngineBlown?: boolean
  isOutOfFuel?: boolean
  /** Quando false, permite partida programática legada sem exigir pedal (default: true) */
  enforceInterlock?: boolean
}

export interface IgnitionAttemptResult {
  shouldStartEngine: boolean
  shouldStopEngine: boolean
  position: IgnitionPosition
  failureReason: string | null
}

export interface IgnitionTickInput {
  deltaTime: number
  engineStatus: EngineStatus
  engineRpm: number
  isEngineBlown?: boolean
  isOutOfFuel?: boolean
}

export interface IgnitionStateSnapshot {
  position: IgnitionPosition
  batteryVoltageV: number
  isBatteryDischarged: boolean
  startAttempts: number
  failedAttempts: number
  lastFailureReason: string | null
  crankElapsedSec: number
}

export const IGNITION_CALIBRATION = {
  /** Limiar mínimo de pedal de freio para liberar partida com startInterlock = 'brake' — [CALIBRAÇÃO] */
  BRAKE_INTERLOCK_THRESHOLD: 0.15,
  /** Limiar mínimo de pedal de embreagem para liberar partida com startInterlock = 'clutch' — [CALIBRAÇÃO] */
  CLUTCH_INTERLOCK_THRESHOLD: 0.70,
  /** Tensão nominal da bateria em repouso com motor desligado (V) — [CALIBRAÇÃO] */
  BATTERY_REST_VOLTAGE_V: 12.6,
  /** Tensão sob carga do motor de arranque durante CRANK (V) — [CALIBRAÇÃO] */
  BATTERY_CRANK_VOLTAGE_V: 10.8,
  /** Tensão regulada pelo alternador com motor em funcionamento (V) — [CALIBRAÇÃO] */
  ALTERNATOR_CHARGING_VOLTAGE_V: 14.1,
  /** Tensão mínima crítica abaixo da qual o motor de arranque não gira (V) — [CALIBRAÇÃO] */
  MIN_CRANK_BATTERY_VOLTAGE_V: 9.6,
} as const

export class IgnitionSystem {
  private readonly spec: VehicleIgnitionSpec
  private position: IgnitionPosition = 'OFF'
  private batteryVoltageV: number = IGNITION_CALIBRATION.BATTERY_REST_VOLTAGE_V
  private isBatteryDischarged: boolean = false
  private startAttempts: number = 0
  private failedAttempts: number = 0
  private lastFailureReason: string | null = null
  private crankElapsedSec: number = 0

  constructor(spec: VehicleIgnitionSpec) {
    this.spec = spec
  }

  getSpec(): VehicleIgnitionSpec {
    return this.spec
  }

  getType(): IgnitionType {
    return this.spec.type
  }

  getStartInterlock(): IgnitionStartInterlock {
    return this.spec.startInterlock
  }

  supportsAccessoryMode(): boolean {
    return this.spec.supportsAccessoryMode
  }

  getPosition(): IgnitionPosition {
    return this.position
  }

  getBatteryVoltageV(): number {
    return this.batteryVoltageV
  }

  getIsBatteryDischarged(): boolean {
    return this.isBatteryDischarged
  }

  setBatteryVoltageV(voltageV: number): void {
    this.batteryVoltageV = clamp(voltageV, 0, 16.0)
    this.isBatteryDischarged = this.batteryVoltageV < IGNITION_CALIBRATION.MIN_CRANK_BATTERY_VOLTAGE_V
  }

  setBatteryDischarged(discharged: boolean): void {
    this.isBatteryDischarged = Boolean(discharged)
    this.batteryVoltageV = this.isBatteryDischarged ? 8.4 : IGNITION_CALIBRATION.BATTERY_REST_VOLTAGE_V
  }

  getStartAttempts(): number {
    return this.startAttempts
  }

  getFailedAttempts(): number {
    return this.failedAttempts
  }

  getLastFailureReason(): string | null {
    return this.lastFailureReason
  }

  /**
   * Verifica se o requisito de pedal (`startInterlock`) está atendido.
   */
  checkInterlockSatisfied(brake: number, clutch: number): { satisfied: boolean; reason: string | null } {
    const interlock = this.spec.startInterlock
    if (interlock === 'none') {
      return { satisfied: true, reason: null }
    }
    if (interlock === 'brake') {
      if (brake >= IGNITION_CALIBRATION.BRAKE_INTERLOCK_THRESHOLD) {
        return { satisfied: true, reason: null }
      }
      return {
        satisfied: false,
        reason: 'Intertravamento de segurança: pressione o pedal de freio para dar a partida.',
      }
    }
    if (interlock === 'clutch') {
      if (clutch >= IGNITION_CALIBRATION.CLUTCH_INTERLOCK_THRESHOLD) {
        return { satisfied: true, reason: null }
      }
      return {
        satisfied: false,
        reason: 'Intertravamento de segurança: pressione a embreagem até o fim para dar a partida.',
      }
    }
    // 'brake_or_clutch'
    if (
      brake >= IGNITION_CALIBRATION.BRAKE_INTERLOCK_THRESHOLD ||
      clutch >= IGNITION_CALIBRATION.CLUTCH_INTERLOCK_THRESHOLD
    ) {
      return { satisfied: true, reason: null }
    }
    return {
      satisfied: false,
      reason: 'Intertravamento de segurança: pressione o freio ou a embreagem para dar a partida.',
    }
  }

  /**
   * Muda diretamente a posição da chave/ignição (`OFF`, `ACC`, `ON`, `CRANK`).
   * Se `target === 'CRANK'`, valida bateria, estado do motor e intertravamento.
   */
  setPosition(target: IgnitionPosition, input?: IgnitionCrankInput): IgnitionAttemptResult {
    if (target === 'OFF') {
      this.position = 'OFF'
      this.crankElapsedSec = 0
      this.lastFailureReason = null
      return {
        shouldStartEngine: false,
        shouldStopEngine: true,
        position: this.position,
        failureReason: null,
      }
    }

    if (target === 'ACC') {
      if (!this.spec.supportsAccessoryMode) {
        this.position = 'ON'
      } else {
        this.position = 'ACC'
      }
      this.crankElapsedSec = 0
      return {
        shouldStartEngine: false,
        shouldStopEngine: true,
        position: this.position,
        failureReason: null,
      }
    }

    if (target === 'ON') {
      this.position = 'ON'
      this.crankElapsedSec = 0
      return {
        shouldStartEngine: false,
        shouldStopEngine: false,
        position: this.position,
        failureReason: null,
      }
    }

    // target === 'CRANK'
    return this.attemptCrank(
      input ?? {
        brake: 0,
        clutch: 0,
        engineStatus: 'off',
        enforceInterlock: true,
      },
    )
  }

  /**
   * Avança um estágio na chave física (`OFF → ACC → ON → CRANK`) ou cicla o botão Start/Stop.
   */
  advanceStage(input: IgnitionCrankInput): IgnitionAttemptResult {
    if (this.spec.type === 'push_button') {
      return this.pressPushButton(input)
    }

    // Chave física: OFF -> ACC (se suportado) -> ON -> CRANK
    if (this.position === 'OFF') {
      return this.setPosition(this.spec.supportsAccessoryMode ? 'ACC' : 'ON', input)
    }
    if (this.position === 'ACC') {
      return this.setPosition('ON', input)
    }
    return this.attemptCrank(input)
  }

  /**
   * Retorna um estágio na chave física (`ON → ACC → OFF`).
   */
  stepBackKey(): IgnitionAttemptResult {
    if (this.position === 'CRANK' || this.position === 'ON') {
      if (this.spec.supportsAccessoryMode) {
        return this.setPosition('ACC')
      }
      return this.setPosition('OFF')
    }
    return this.setPosition('OFF')
  }

  /**
   * Solta a chave da posição de partida (`CRANK → ON`).
   */
  releaseKeyFromCrank(): IgnitionPosition {
    if (this.position === 'CRANK') {
      this.position = 'ON'
      this.crankElapsedSec = 0
    }
    return this.position
  }

  /**
   * Comportamento real de botão Start/Stop (`type: 'push_button'`):
   * - Se o motor estiver ligado (`running`): desliga o motor e vai para `OFF`.
   * - Se o pedal exigido pelo `startInterlock` estiver pressionado (ou `startInterlock === 'none'`):
   *   aciona `CRANK` diretamente a partir de qualquer estado (`OFF`, `ACC` ou `ON`).
   * - Se o pedal exigido NÃO estiver pressionado:
   *   cicla a alimentação elétrica `OFF → ACC → ON → OFF` e registra o motivo do bloqueio de partida!
   */
  pressPushButton(input: IgnitionCrankInput): IgnitionAttemptResult {
    if (input.engineStatus === 'running') {
      return this.setPosition('OFF', input)
    }

    const enforce = input.enforceInterlock ?? true
    const interlockCheck = enforce
      ? this.checkInterlockSatisfied(input.brake, input.clutch)
      : { satisfied: true, reason: null }

    if (!interlockCheck.satisfied) {
      this.startAttempts += 1
      this.failedAttempts += 1
      this.lastFailureReason = interlockCheck.reason

      if (this.position === 'OFF') {
        this.position = this.spec.supportsAccessoryMode ? 'ACC' : 'ON'
      } else if (this.position === 'ACC') {
        this.position = 'ON'
      } else {
        this.position = 'ON'
      }

      return {
        shouldStartEngine: false,
        shouldStopEngine: false,
        position: this.position,
        failureReason: this.lastFailureReason,
      }
    }

    return this.attemptCrank(input)
  }

  /**
   * Tenta acionar o motor de arranque (`CRANK`), validando intertravamento, bateria, combustível e integridade.
   */
  attemptCrank(input: IgnitionCrankInput): IgnitionAttemptResult {
    if (input.engineStatus === 'running') {
      this.position = 'ON'
      this.lastFailureReason = null
      return {
        shouldStartEngine: false,
        shouldStopEngine: false,
        position: this.position,
        failureReason: null,
      }
    }

    if (input.engineStatus === 'starting' && this.position === 'CRANK') {
      return {
        shouldStartEngine: false,
        shouldStopEngine: false,
        position: 'CRANK',
        failureReason: null,
      }
    }

    this.startAttempts += 1

    // 1. Verifica intertravamento de pedal (freio / embreagem)
    const enforce = input.enforceInterlock ?? true
    if (enforce) {
      const interlockCheck = this.checkInterlockSatisfied(input.brake, input.clutch)
      if (!interlockCheck.satisfied) {
        this.failedAttempts += 1
        this.lastFailureReason = interlockCheck.reason
        if (this.position === 'OFF') {
          this.position = 'ON'
        }
        return {
          shouldStartEngine: false,
          shouldStopEngine: false,
          position: this.position,
          failureReason: this.lastFailureReason,
        }
      }
    }

    // 2. Verifica tensão da bateria
    if (
      this.isBatteryDischarged ||
      this.batteryVoltageV < IGNITION_CALIBRATION.MIN_CRANK_BATTERY_VOLTAGE_V
    ) {
      this.failedAttempts += 1
      this.lastFailureReason = 'Falha de partida: bateria descarregada (< 9.6V).'
      this.position = 'ON'
      return {
        shouldStartEngine: false,
        shouldStopEngine: false,
        position: this.position,
        failureReason: this.lastFailureReason,
      }
    }

    // 3. Verifica se o motor está fundido
    if (input.isEngineBlown) {
      this.failedAttempts += 1
      this.lastFailureReason = 'Falha de partida: motor fundido / dano mecânico crítico.'
      this.position = 'ON'
      return {
        shouldStartEngine: false,
        shouldStopEngine: false,
        position: this.position,
        failureReason: this.lastFailureReason,
      }
    }

    // 4. Verifica pane seca (sem combustível)
    if (input.isOutOfFuel) {
      this.failedAttempts += 1
      this.lastFailureReason = 'Pane Seca: Sem combustível!'
      this.position = 'ON'
      return {
        shouldStartEngine: false,
        shouldStopEngine: false,
        position: this.position,
        failureReason: this.lastFailureReason,
      }
    }

    // 5. Partida autorizada: entra em CRANK e comanda EngineSimulator.start()
    this.position = 'CRANK'
    this.crankElapsedSec = 0
    this.lastFailureReason = null

    return {
      shouldStartEngine: true,
      shouldStopEngine: false,
      position: 'CRANK',
      failureReason: null,
    }
  }

  /**
   * Passo determinístico a 120 Hz:
   * - Retorna automaticamente de `CRANK` para `ON` quando o motor pega (`engineStatus === 'running'`)
   *   ou caso ocorra falha durante o giro do motor de arranque.
   * - Atualiza a tensão da bateria conforme o regime (repouso 12.6V, arranque 10.8V, alternador 14.1V).
   */
  tick(input: IgnitionTickInput): IgnitionStateSnapshot {
    const dt = Math.max(0, input.deltaTime)

    if (this.position === 'CRANK') {
      this.crankElapsedSec += dt
      if (input.engineStatus === 'running') {
        // Retorno automático da mola do cilindro / módulo eletrônico: CRANK -> ON
        this.position = 'ON'
        this.crankElapsedSec = 0
      } else if (input.isEngineBlown || input.isOutOfFuel || input.engineStatus === 'off' || input.engineStatus === 'stalled') {
        if (this.crankElapsedSec >= 0.05 && input.engineStatus !== 'starting') {
          this.position = 'ON'
          this.crankElapsedSec = 0
        }
      }
    } else if (input.engineStatus === 'running' && this.position === 'OFF') {
      // Sincronização defensiva caso o motor tenha sido ligado externamente
      this.position = 'ON'
    }

    // Evolução determinística da tensão da bateria
    if (!this.isBatteryDischarged) {
      let targetVoltage: number = IGNITION_CALIBRATION.BATTERY_REST_VOLTAGE_V
      if (this.position === 'CRANK' || input.engineStatus === 'starting') {
        targetVoltage = IGNITION_CALIBRATION.BATTERY_CRANK_VOLTAGE_V
      } else if (input.engineStatus === 'running' && input.engineRpm > 500) {
        targetVoltage = IGNITION_CALIBRATION.ALTERNATOR_CHARGING_VOLTAGE_V
      } else if (this.position === 'ON' || this.position === 'ACC') {
        targetVoltage = 12.4
      }
      this.batteryVoltageV += (targetVoltage - this.batteryVoltageV) * Math.min(1, dt * 8.0)
    }

    return this.getStateSnapshot()
  }

  reset(): void {
    this.position = 'OFF'
    this.batteryVoltageV = IGNITION_CALIBRATION.BATTERY_REST_VOLTAGE_V
    this.isBatteryDischarged = false
    this.startAttempts = 0
    this.failedAttempts = 0
    this.lastFailureReason = null
    this.crankElapsedSec = 0
  }

  getStateSnapshot(): IgnitionStateSnapshot {
    return {
      position: this.position,
      batteryVoltageV: this.batteryVoltageV,
      isBatteryDischarged: this.isBatteryDischarged,
      startAttempts: this.startAttempts,
      failedAttempts: this.failedAttempts,
      lastFailureReason: this.lastFailureReason,
      crankElapsedSec: this.crankElapsedSec,
    }
  }

  restoreSnapshot(snapshot: IgnitionStateSnapshot): void {
    this.position = snapshot.position
    this.batteryVoltageV = snapshot.batteryVoltageV
    this.isBatteryDischarged = snapshot.isBatteryDischarged
    this.startAttempts = snapshot.startAttempts
    this.failedAttempts = snapshot.failedAttempts
    this.lastFailureReason = snapshot.lastFailureReason
    this.crankElapsedSec = snapshot.crankElapsedSec
  }
}
