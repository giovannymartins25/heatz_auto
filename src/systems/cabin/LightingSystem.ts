/**
 * LightingSystem.ts — Sistema determinístico de iluminação externa e sinalização (setas/pisca-alerta).
 *
 * Responsabilidades:
 * 1. Controlar setas direcionais (`leftTurnSignal`, `rightTurnSignal` mutuamente exclusivas)
 *    e pisca-alerta (`hazardLights`).
 * 2. Oscilar o relé de pisca de forma 100% determinística a 1,4 Hz para o ciclo completo
 *    (período T = 1 / 1,4 ≈ 0,7142857 s; 50% duty cycle: ~0,35714285 s aceso / ~0,35714285 s apagado).
 * 3. Sincronizar estado funcional (comando acionado) e estado visual instantâneo (`leftIndicatorLit`,
 *    `rightIndicatorLit`, `hazardIndicatorLit`).
 * 4. Controlar lanternas (`parking`), farol baixo (`low`), farol alto (`high`) e faróis de neblina
 *    (`fogLights` — somente quando `cabinSpec.hasFogLights === true`).
 * 5. Manter cancelamento manual de seta nesta etapa (sem heurística frágil por limite simples de ângulo).
 */

import type { VehicleCabinSpec } from '@/types/vehicle'

export type HeadlightsMode = 'off' | 'parking' | 'low' | 'high'
export type TurnSignalSelection = 'off' | 'left' | 'right'

export interface LightingStateSnapshot {
  headlightsMode: HeadlightsMode
  fogLightsEnabled: boolean
  hasFogLights: boolean
  turnSignal: TurnSignalSelection
  leftTurnSignal: boolean
  rightTurnSignal: boolean
  hazardLights: boolean
  blinkerTimerSec: number
  blinkerPhaseOn: boolean
  // Estados visuais sincronizados (lâmpadas/indicadores efetivamente acesos no instante t)
  leftIndicatorLit: boolean
  rightIndicatorLit: boolean
  hazardIndicatorLit: boolean
  parkingLightsLit: boolean
  lowBeamLit: boolean
  highBeamLit: boolean
  fogLightsLit: boolean
}

export const LIGHTING_CALIBRATION = {
  /** Frequência padrão do relé de seta/pisca-alerta em Hz (norma ECE R48: 90 ± 30 ciclos/min = 1.5 Hz / 1.4 Hz) */
  BLINK_FREQUENCY_HZ: 1.4,
  /** Período completo do ciclo ligado+desligado em segundos (1 / 1.4 ≈ 0.7142857s) */
  BLINK_PERIOD_SEC: 1 / 1.4,
  /** Meio período (duração do pulso aceso e do pulso apagado: ~0.35714285s) */
  BLINK_HALF_PERIOD_SEC: 0.5 / 1.4,
} as const

export class LightingSystem {
  private readonly hasFogLightsCapability: boolean

  private headlightsMode: HeadlightsMode = 'low'
  private fogLightsEnabled: boolean = false
  private turnSignal: TurnSignalSelection = 'off'
  private hazardLights: boolean = false
  private blinkerTimerSec: number = 0
  private blinkerPhaseOn: boolean = false

  constructor(cabinSpec?: Pick<VehicleCabinSpec, 'hasFogLights'>) {
    this.hasFogLightsCapability = Boolean(cabinSpec?.hasFogLights)
  }

  supportsFogLights(): boolean {
    return this.hasFogLightsCapability
  }

  getHeadlightsMode(): HeadlightsMode {
    return this.headlightsMode
  }

  setHeadlightsMode(mode: HeadlightsMode): void {
    this.headlightsMode = mode
    if (mode === 'off') {
      this.fogLightsEnabled = false
    }
  }

  cycleHeadlightsMode(): HeadlightsMode {
    const modes: HeadlightsMode[] = ['off', 'parking', 'low', 'high']
    const nextIdx = (modes.indexOf(this.headlightsMode) + 1) % modes.length
    this.setHeadlightsMode(modes[nextIdx])
    return this.headlightsMode
  }

  isFogLightsEnabled(): boolean {
    return this.fogLightsEnabled
  }

  setFogLightsEnabled(enabled: boolean): boolean {
    if (!this.hasFogLightsCapability) {
      this.fogLightsEnabled = false
      return false
    }
    if (enabled && this.headlightsMode === 'off') {
      // Farol de neblina exige ao menos lanternas (luz de posição) acesas
      this.headlightsMode = 'parking'
    }
    this.fogLightsEnabled = Boolean(enabled)
    return this.fogLightsEnabled
  }

  toggleFogLights(): boolean {
    return this.setFogLightsEnabled(!this.fogLightsEnabled)
  }

  getTurnSignal(): TurnSignalSelection {
    return this.turnSignal
  }

  setTurnSignal(selection: TurnSignalSelection): void {
    const prevActive = this.isBlinkerCircuitActive()
    this.turnSignal = selection
    if (selection !== 'off' && !prevActive) {
      // Inicia imediatamente na fase acesa (t = 0) ao acionar a alavanca de seta
      this.blinkerTimerSec = 0
      this.blinkerPhaseOn = true
    } else if (!this.isBlinkerCircuitActive()) {
      this.blinkerTimerSec = 0
      this.blinkerPhaseOn = false
    }
  }

  toggleLeftTurnSignal(): TurnSignalSelection {
    const next: TurnSignalSelection = this.turnSignal === 'left' ? 'off' : 'left'
    this.setTurnSignal(next)
    return this.turnSignal
  }

  toggleRightTurnSignal(): TurnSignalSelection {
    const next: TurnSignalSelection = this.turnSignal === 'right' ? 'off' : 'right'
    this.setTurnSignal(next)
    return this.turnSignal
  }

  isHazardLightsEnabled(): boolean {
    return this.hazardLights
  }

  setHazardLights(enabled: boolean): void {
    const next = Boolean(enabled)
    if (next !== this.hazardLights) {
      this.hazardLights = next
      // Reinicia fase em 0 para garantir sincronismo visual imediato de ambas as setas
      this.blinkerTimerSec = 0
      this.blinkerPhaseOn = this.isBlinkerCircuitActive()
    }
  }

  toggleHazardLights(): boolean {
    this.setHazardLights(!this.hazardLights)
    return this.hazardLights
  }

  isBlinkerCircuitActive(): boolean {
    return this.hazardLights || this.turnSignal !== 'off'
  }

  /**
   * Evolução determinística do relé de pisca (~1,4 Hz ciclo completo).
   */
  tick(deltaTime: number): LightingStateSnapshot {
    const dt = Math.max(0, deltaTime)
    if (this.isBlinkerCircuitActive()) {
      this.blinkerTimerSec =
        (this.blinkerTimerSec + dt) % LIGHTING_CALIBRATION.BLINK_PERIOD_SEC
      this.blinkerPhaseOn =
        this.blinkerTimerSec < LIGHTING_CALIBRATION.BLINK_HALF_PERIOD_SEC
    } else {
      this.blinkerTimerSec = 0
      this.blinkerPhaseOn = false
    }

    return this.getStateSnapshot()
  }

  reset(): void {
    this.headlightsMode = 'low'
    this.fogLightsEnabled = false
    this.turnSignal = 'off'
    this.hazardLights = false
    this.blinkerTimerSec = 0
    this.blinkerPhaseOn = false
  }

  getStateSnapshot(): LightingStateSnapshot {
    const leftSignalActive = this.turnSignal === 'left'
    const rightSignalActive = this.turnSignal === 'right'
    const phase = this.isBlinkerCircuitActive() ? this.blinkerPhaseOn : false

    return {
      headlightsMode: this.headlightsMode,
      fogLightsEnabled: this.fogLightsEnabled,
      hasFogLights: this.hasFogLightsCapability,
      turnSignal: this.turnSignal,
      leftTurnSignal: leftSignalActive,
      rightTurnSignal: rightSignalActive,
      hazardLights: this.hazardLights,
      blinkerTimerSec: this.blinkerTimerSec,
      blinkerPhaseOn: phase,
      leftIndicatorLit: (this.hazardLights || leftSignalActive) && phase,
      rightIndicatorLit: (this.hazardLights || rightSignalActive) && phase,
      hazardIndicatorLit: this.hazardLights && phase,
      parkingLightsLit: this.headlightsMode !== 'off',
      lowBeamLit: this.headlightsMode === 'low' || this.headlightsMode === 'high',
      highBeamLit: this.headlightsMode === 'high',
      fogLightsLit:
        this.hasFogLightsCapability && this.fogLightsEnabled && this.headlightsMode !== 'off',
    }
  }

  restoreSnapshot(snapshot: LightingStateSnapshot): void {
    this.headlightsMode = snapshot.headlightsMode
    this.fogLightsEnabled = this.hasFogLightsCapability ? snapshot.fogLightsEnabled : false
    this.turnSignal = snapshot.turnSignal
    this.hazardLights = snapshot.hazardLights
    this.blinkerTimerSec = snapshot.blinkerTimerSec
    this.blinkerPhaseOn = snapshot.blinkerPhaseOn
  }
}
