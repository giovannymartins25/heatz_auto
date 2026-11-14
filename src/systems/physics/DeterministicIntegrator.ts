/**
 * HEATZ AUTO — FASE 1.6.1: INTEGRADOR FÍSICO DETERMINÍSTICO & FAIL_SAFE_HOLD
 * 
 * Gerencia a evolução temporal da física automotiva com:
 * - Timestep fixo e determinístico a 120 Hz (h = 1/120 s).
 * - Acumulador de tempo desacoplado da taxa de quadros (renderização).
 * - Proteção contra "spiral-of-death" via limitação de subpassos (maxSubsteps = 8).
 * - Interpolação visual precisa (fator alpha ∈ [0, 1)).
 * - Protocolo estrito de contenção FAIL_SAFE_HOLD para preservação de estado.
 */

import { PHYSICS_TIMESTEP, MAX_SUBSTEPS } from '@/systems/engine/constants'

/**
 * Status da integridade operacional do integrador.
 */
export type PhysicsIntegrityStatus = 'NORMAL' | 'FAIL_SAFE_HOLD' | 'RECOVERED'

/**
 * Diagnóstico de falha física capturada.
 */
export interface PhysicsFaultRecord<TState> {
  timestamp: number
  substepIndex: number
  errorCode: 'PHYSICS_NAN_DETECTED' | 'PHYSICS_INFINITE_DETECTED' | 'PHYSICS_SUBSTEP_EXCEPTION' | 'PHYSICS_CUSTOM_VALIDATION_FAILED'
  errorMessage: string
  lastValidStateSnapshot: TState
}

/**
 * Configurações do integrador determinístico.
 */
export interface IntegratorOptions<TState> {
  /** Frequência física fixa em Hz (padrão: 120 Hz) */
  physicsFrequency?: number
  /** Limite máximo de subpassos físicos por frame visual (padrão: 8) */
  maxSubsteps?: number
  /** Limite máximo de dt recebido da renderização em segundos (padrão: 0.25 s) */
  maxFrameDelta?: number
  /** Função customizada de validação física do estado */
  validateState?: (state: TState) => { valid: boolean; reason?: string }
  /** Função para clonar o estado com segurança contra mutação externa */
  cloneState?: (state: TState) => TState
}

/**
 * Assinatura da função de subpasso físico determinístico.
 */
export type SubstepHandler<TState, TInput> = (
  currentState: TState,
  dt: number,
  input: TInput,
  substepIndex: number
) => TState

/**
 * Resultado retornado a cada frame pelo integrador determinístico.
 */
export interface IntegratorStepResult<TState> {
  /** Estado físico mestre resultante (último estado válido garantido) */
  state: TState
  /** Quantidade de subpassos físicos efetivamente executados neste frame */
  substepsExecuted: number
  /** Fator de interpolação visual entre o penúltimo e o último estado: alpha = accumulator / h in [0, 1) */
  interpolationAlpha: number
  /** Relógio físico acumulado em segundos */
  physicalTime: number
  /** Estado da integridade da física */
  integrityStatus: PhysicsIntegrityStatus
  /** Sinaliza se o acumulador sofreu clamp para evitar espiral da morte */
  spiralOfDeathClamped: boolean
  /** Diagnóstico de falha física ativa, se houver */
  lastFault: PhysicsFaultRecord<TState> | null
}

/**
 * Implementação do Integrador Físico Determinístico com FAIL_SAFE_HOLD.
 */
export class DeterministicIntegrator<TState, TInput = void> {
  public readonly timestep: number // h [s]
  public readonly frequency: number // f [Hz]
  public readonly maxSubsteps: number
  public readonly maxFrameDelta: number

  private masterState: TState
  private accumulator: number = 0
  private physicalTime: number = 0
  private paused: boolean = false
  private integrityStatus: PhysicsIntegrityStatus = 'NORMAL'
  private lastFault: PhysicsFaultRecord<TState> | null = null

  private readonly validateStateCustom?: (state: TState) => { valid: boolean; reason?: string }
  private readonly cloneStateFn: (state: TState) => TState

  constructor(initialState: TState, options?: IntegratorOptions<TState>) {
    this.frequency = options?.physicsFrequency ?? 120
    this.timestep = options?.physicsFrequency ? 1 / options.physicsFrequency : PHYSICS_TIMESTEP
    this.maxSubsteps = options?.maxSubsteps ?? MAX_SUBSTEPS
    this.maxFrameDelta = options?.maxFrameDelta ?? 0.25
    this.validateStateCustom = options?.validateState
    this.cloneStateFn = options?.cloneState ?? ((s: TState) => {
      if (typeof structuredClone === 'function') {
        try {
          return structuredClone(s)
        } catch {
          // Fallback para objetos planos
          return JSON.parse(JSON.stringify(s))
        }
      }
      return JSON.parse(JSON.stringify(s))
    })

    this.masterState = this.cloneStateFn(initialState)
  }

  /**
   * Retorna o estado mestre atual.
   */
  getState(): TState {
    return this.cloneStateFn(this.masterState)
  }

  /**
   * Força uma atualização segura do estado mestre (ex: teleport, reset de corrida).
   */
  setState(newState: TState): void {
    const validation = this.checkStateIntegrity(newState)
    if (!validation.valid) {
      throw new Error(`[DeterministicIntegrator] Não é possível definir estado inválido: ${validation.reason}`)
    }
    this.masterState = this.cloneStateFn(newState)
    if (this.integrityStatus === 'FAIL_SAFE_HOLD') {
      this.integrityStatus = 'RECOVERED'
    }
  }

  /**
   * Retorna o tempo acumulado no relógio físico em segundos.
   */
  getPhysicalTime(): number {
    return this.physicalTime
  }

  /**
   * Retorna o valor atual do acumulador residual de tempo em segundos.
   */
  getAccumulator(): number {
    return this.accumulator
  }

  /**
   * Retorna o fator de interpolação visual: alpha = accumulator / timestep in [0, 1).
   */
  getInterpolationAlpha(): number {
    return Math.min(0.999999, Math.max(0, this.accumulator / this.timestep))
  }

  /**
   * Retorna o status de integridade da física.
   */
  getIntegrityStatus(): PhysicsIntegrityStatus {
    return this.integrityStatus
  }

  /**
   * Retorna o último registro de diagnóstico de falha.
   */
  getLastFault(): PhysicsFaultRecord<TState> | null {
    return this.lastFault
  }

  /**
   * Pausa a integração física. Nenhum tempo é acumulado enquanto pausado.
   */
  pause(): void {
    this.paused = true
    this.accumulator = 0
  }

  /**
   * Retoma a integração física sem saltos temporais.
   */
  resume(): void {
    this.paused = false
    this.accumulator = 0
  }

  /**
   * Verifica se a simulação física está pausada.
   */
  isPaused(): boolean {
    return this.paused
  }

  /**
   * Limpa o estado de falha FAIL_SAFE_HOLD e restaura a operação normal.
   */
  clearFault(): void {
    this.integrityStatus = 'NORMAL'
    this.lastFault = null
  }

  /**
   * Reseta o relógio físico e acumulador para zero.
   */
  resetClock(): void {
    this.physicalTime = 0
    this.accumulator = 0
  }

  /**
   * Executa a passagem de um frame visual recebendo o delta time do navegador (frameTime em segundos).
   * 
   * Executa 0, 1 ou N subpassos fixos a 120 Hz dependendo do tempo decorrido.
   * Se um subpasso falhar ou gerar valores não-físicos (NaN/Infinito):
   * - O subpasso falho é descartado.
   * - O masterState permanece exatamente no último estado válido antes da falha.
   * - O relógio físico congela.
   * - O status entra em FAIL_SAFE_HOLD com registro de diagnóstico.
   */
  step(frameTime: number, input: TInput, substepFn: SubstepHandler<TState, TInput>): IntegratorStepResult<TState> {
    if (this.paused) {
      return {
        state: this.cloneStateFn(this.masterState),
        substepsExecuted: 0,
        interpolationAlpha: 0,
        physicalTime: this.physicalTime,
        integrityStatus: this.integrityStatus,
        spiralOfDeathClamped: false,
        lastFault: this.lastFault,
      }
    }

    // Se estiver em FAIL_SAFE_HOLD, a física permanece congelada até que clearFault() ou setState() ocorra
    if (this.integrityStatus === 'FAIL_SAFE_HOLD') {
      return {
        state: this.cloneStateFn(this.masterState),
        substepsExecuted: 0,
        interpolationAlpha: 0,
        physicalTime: this.physicalTime,
        integrityStatus: 'FAIL_SAFE_HOLD',
        spiralOfDeathClamped: false,
        lastFault: this.lastFault,
      }
    }

    // Limitação de sanidade do frameTime para proteger contra tab switching e spikes gigantes
    const safeFrameTime = Math.min(Math.max(0, frameTime), this.maxFrameDelta)
    this.accumulator += safeFrameTime

    let substepsExecuted = 0
    let spiralOfDeathClamped = false

    while (this.accumulator >= this.timestep && substepsExecuted < this.maxSubsteps) {
      // Estado de cálculo temporário (scratch state / candidate)
      const candidateStateBefore = this.cloneStateFn(this.masterState)
      let candidateStateAfter: TState

      try {
        candidateStateAfter = substepFn(candidateStateBefore, this.timestep, input, substepsExecuted)
      } catch (err: any) {
        // Exceção de execução no subpasso: acionar FAIL_SAFE_HOLD imediato
        this.integrityStatus = 'FAIL_SAFE_HOLD'
        this.lastFault = {
          timestamp: Date.now(),
          substepIndex: substepsExecuted,
          errorCode: 'PHYSICS_SUBSTEP_EXCEPTION',
          errorMessage: err?.message || String(err),
          lastValidStateSnapshot: this.cloneStateFn(this.masterState),
        }
        break // Interrompe o loop preservando o masterState intacto
      }

      // Validação rigorosa de sanidade numérica e física
      const integrityCheck = this.checkStateIntegrity(candidateStateAfter)
      if (!integrityCheck.valid) {
        this.integrityStatus = 'FAIL_SAFE_HOLD'
        this.lastFault = {
          timestamp: Date.now(),
          substepIndex: substepsExecuted,
          errorCode: integrityCheck.code,
          errorMessage: integrityCheck.reason || 'Validação de integridade numérica física falhou',
          lastValidStateSnapshot: this.cloneStateFn(this.masterState),
        }
        break // Rejeita candidateStateAfter; masterState NÃO é contaminado
      }

      // Subpasso aprovado: comita para o estado mestre e avança o relógio físico
      this.masterState = candidateStateAfter
      this.physicalTime += this.timestep
      this.accumulator -= this.timestep
      substepsExecuted++
    }

    // Proteção contra spiral of death: se atingiu o teto de subpassos e o acumulador continua grande, zera o backlog
    if (substepsExecuted >= this.maxSubsteps && this.accumulator > this.timestep) {
      this.accumulator = 0
      spiralOfDeathClamped = true
    }

    return {
      state: this.cloneStateFn(this.masterState),
      substepsExecuted,
      interpolationAlpha: this.getInterpolationAlpha(),
      physicalTime: this.physicalTime,
      integrityStatus: this.integrityStatus,
      spiralOfDeathClamped,
      lastFault: this.lastFault,
    }
  }

  /**
   * Checagem recursiva de integridade numérica (rejeição de NaN e infinitos).
   */
  private checkStateIntegrity(state: unknown): {
    valid: boolean
    code: 'PHYSICS_NAN_DETECTED' | 'PHYSICS_INFINITE_DETECTED' | 'PHYSICS_CUSTOM_VALIDATION_FAILED'
    reason?: string
  } {
    const scan = (val: unknown, path: string): { valid: boolean; code?: any; reason?: string } => {
      if (typeof val === 'number') {
        if (Number.isNaN(val)) {
          return { valid: false, code: 'PHYSICS_NAN_DETECTED', reason: `Valor NaN detectado na propriedade: ${path}` }
        }
        if (!Number.isFinite(val)) {
          return { valid: false, code: 'PHYSICS_INFINITE_DETECTED', reason: `Valor infinito detectado na propriedade: ${path}` }
        }
      } else if (val && typeof val === 'object') {
        for (const [key, prop] of Object.entries(val)) {
          const res = scan(prop, path ? `${path}.${key}` : key)
          if (!res.valid) return res
        }
      }
      return { valid: true }
    }

    const numericCheck = scan(state, 'state')
    if (!numericCheck.valid) {
      return {
        valid: false,
        code: numericCheck.code,
        reason: numericCheck.reason,
      }
    }

    if (this.validateStateCustom) {
      const customRes = this.validateStateCustom(state as TState)
      if (!customRes.valid) {
        return {
          valid: false,
          code: 'PHYSICS_CUSTOM_VALIDATION_FAILED',
          reason: customRes.reason || 'Validação customizada de física falhou',
        }
      }
    }

    return { valid: true, code: 'PHYSICS_NAN_DETECTED' }
  }
}
