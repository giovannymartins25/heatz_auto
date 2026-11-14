/**
 * Heatz Auto — Monitor Interno de Diagnóstico de Performance (Fase 1.5.2)
 *
 * Coleta métricas de runtime em tempo real com overhead quase nulo:
 * - FPS: Frequência visual real média ponderada
 * - Frame Time: Duração do último frame em ms
 * - Frame Time P95: 95º percentil de tempo de quadro (revela micro-travamentos)
 * - Physics Updates: Frequência real de sub-passos da física (120 Hz)
 * - Dropped Frames: Contagem de quadros que excederam o limiar de fluidez (> 1.5x intervalo alvo)
 * - Long Tasks: Contagem e duração cumulativa de tarefas que bloquearam a thread principal (> 50ms)
 * - Memory: Heap JS alocado em MB (quando suportado pelo navegador)
 * - React Renders: Contador de reconciliações de componentes
 */

export interface PerformanceSnapshot {
  fps: number
  frameTimeMs: number
  avgFrameTimeMs: number
  frameTimeP95Ms: number
  physicsHz: number
  physicsTicksTotal: number
  droppedFrames: number
  longTasksCount: number
  longTasksTotalMs: number
  memoryMb: number | null
  reactRendersPerSec: number
}

export type PerformanceMetrics = PerformanceSnapshot

interface FrameSample {
  dt: number
  ts: number
}

const getNowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

class PerformanceDiagnosticsTracker {
  private enabled = false
  private rafId = 0
  private flushTimerId: ReturnType<typeof setInterval> | null = null
  private lastTime = 0

  // Amostragem de quadros por janela temporal (1000ms) para FPS e P95 reais
  private frameSamples: FrameSample[] = []
  private readonly maxBufferSize = 240

  // Métricas acumuladas de frame
  private currentFrameTime = 0
  private avgFrameTimeMs = 0
  private droppedFramesCount = 0
  private fpsWindow = 0

  // Física (janela de >= 1000ms para evitar salto artificial em bordas de substep)
  private physicsTimestamps: number[] = []
  private physicsTicksTotal = 0
  private physicsWindowStartMs = 0
  private physicsHz = 0

  // Long tasks
  private longTaskObserver: PerformanceObserver | null = null
  private longTasksCount = 0
  private longTasksTotalMs = 0

  // React renders (janela deslizante de 1000ms para cair a 0 quando ocioso)
  private renderTimestamps: number[] = []
  private rendersPerSec = 0

  // Listeners para UI (disparados a cada ~500ms para custo mínimo)
  private listeners: Set<(snapshot: PerformanceSnapshot) => void> = new Set()
  private lastBroadcast = 0

  constructor() {
    this.initLongTaskObserver()
  }

  private initLongTaskObserver() {
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return
    try {
      const types = (PerformanceObserver as unknown as { supportedEntryTypes?: string[] }).supportedEntryTypes || []
      if (types.includes('longtask')) {
        this.longTaskObserver = new PerformanceObserver((list) => {
          if (!this.enabled) return
          for (const entry of list.getEntries()) {
            this.longTasksCount++
            this.longTasksTotalMs += Math.round(entry.duration)
          }
        })
        this.longTaskObserver.observe({ entryTypes: ['longtask'] })
      }
    } catch {
      // Navegadores sem suporte a longtask ignoram graciosamente
    }
  }

  public reset(nowMs?: number) {
    const now = nowMs ?? getNowMs()
    this.lastTime = now
    this.lastBroadcast = now
    this.frameSamples = []
    this.currentFrameTime = 0
    this.avgFrameTimeMs = 0
    this.droppedFramesCount = 0
    this.fpsWindow = 0
    this.physicsTimestamps = []
    this.physicsTicksTotal = 0
    this.physicsWindowStartMs = now
    this.physicsHz = 0
    this.longTasksCount = 0
    this.longTasksTotalMs = 0
    this.renderTimestamps = []
    this.rendersPerSec = 0
  }

  public recordPhysicsTick(nowMs?: number) {
    if (!this.enabled) return
    const now = nowMs ?? getNowMs()
    this.physicsTicksTotal++
    this.physicsTimestamps.push(now)
    this.updatePhysicsRate(now)
  }

  public recordReactRender(nowMs?: number) {
    if (!this.enabled) return
    const now = nowMs ?? getNowMs()
    this.renderTimestamps.push(now)
    this.updateRenderRate(now)
  }

  public recordFrameDelta(dt: number, nowMs?: number) {
    if (!this.enabled || dt <= 0 || dt >= 500) {
      if (nowMs !== undefined) {
        this.lastTime = nowMs
      }
      return
    }

    const now = nowMs ?? (this.lastTime + dt)
    this.lastTime = now
    this.currentFrameTime = dt
    this.frameSamples.push({ dt, ts: now })

    // Mantém janela temporal dos últimos 1000ms (respeitando limite máximo de buffer)
    const cutoff = now - 1000
    while (
      this.frameSamples.length > 1 &&
      (this.frameSamples[0].ts <= cutoff || this.frameSamples.length > this.maxBufferSize)
    ) {
      this.frameSamples.shift()
    }

    // Cálculo por janela temporal real sem distorção EMA
    let sumDt = 0
    for (const sample of this.frameSamples) {
      sumDt += sample.dt
    }
    const count = this.frameSamples.length
    this.avgFrameTimeMs = count > 0 ? sumDt / count : 0
    this.fpsWindow = sumDt > 0 ? (count * 1000) / sumDt : 0

    // Limiar adaptativo pela mediana: display ~120Hz (mediana < 11.5ms) vs 60Hz
    const sorted = [...this.frameSamples].map((s) => s.dt).sort((a, b) => a - b)
    const medianDt = sorted[Math.floor(sorted.length / 2)] ?? dt
    const dropThresholdMs = medianDt < 11.5 ? 13.5 : 25
    if (dt > dropThresholdMs) {
      this.droppedFramesCount++
    }
  }

  private updatePhysicsRate(now: number) {
    const cutoff = now - 1000
    while (this.physicsTimestamps.length > 0 && this.physicsTimestamps[0] <= cutoff) {
      this.physicsTimestamps.shift()
    }

    const elapsedSinceStart = now - this.physicsWindowStartMs
    if (elapsedSinceStart < 1000) {
      this.physicsHz = this.physicsTicksTotal > 0 ? 120 : 0
      return
    }

    // Janela deslizante de 1000ms exatos para evitar overshoots em bordas de substeps
    this.physicsHz = this.physicsTimestamps.length
  }

  private updateRenderRate(now: number) {
    const cutoff = now - 1000
    while (this.renderTimestamps.length > 0 && this.renderTimestamps[0] <= cutoff) {
      this.renderTimestamps.shift()
    }
    this.rendersPerSec = this.renderTimestamps.length
  }

  public flushMetrics(nowMs?: number) {
    const now = nowMs ?? getNowMs()
    this.updatePhysicsRate(now)
    this.updateRenderRate(now)
  }

  public start(nowMs?: number) {
    if (this.enabled) return
    this.enabled = true
    this.reset(nowMs)

    if (typeof setInterval !== 'undefined') {
      this.flushTimerId = setInterval(() => {
        if (!this.enabled) return
        const now = getNowMs()
        this.flushMetrics(now)
        this.lastBroadcast = now
        this.broadcast(now)
      }, 500)
      if (typeof this.flushTimerId === 'object' && this.flushTimerId !== null && 'unref' in this.flushTimerId) {
        ;(this.flushTimerId as { unref?: () => void }).unref?.()
      }
    }

    const loop = (timestamp: number) => {
      if (!this.enabled) return

      const dt = timestamp - this.lastTime
      this.recordFrameDelta(dt, timestamp)

      // Notifica os componentes a cada 500ms (2Hz) para custo mínimo de UI
      if (timestamp - this.lastBroadcast >= 500) {
        this.lastBroadcast = timestamp
        this.flushMetrics(timestamp)
        this.broadcast(timestamp)
      }

      if (typeof requestAnimationFrame !== 'undefined') {
        this.rafId = requestAnimationFrame(loop)
      }
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(loop)
    }
  }

  public stop() {
    this.enabled = false
    if (this.rafId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
    if (this.flushTimerId !== null && typeof clearInterval !== 'undefined') {
      clearInterval(this.flushTimerId)
      this.flushTimerId = null
    }
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public subscribe(listener: (snapshot: PerformanceSnapshot) => void): () => void {
    this.listeners.add(listener)
    if (this.listeners.size === 1) {
      this.start()
    }
    listener(this.getSnapshot())

    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        this.stop()
      }
    }
  }

  private calculateP95(): number {
    if (this.frameSamples.length === 0) return 0
    const sorted = this.frameSamples.map((s) => s.dt).sort((a, b) => a - b)
    const idx = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1)
    return Math.round(sorted[idx] * 10) / 10
  }

  public getSnapshot(nowMs?: number): PerformanceSnapshot {
    if (this.enabled && nowMs !== undefined) {
      this.flushMetrics(nowMs)
    }

    let memoryMb: number | null = null
    if (typeof performance !== 'undefined') {
      const perfMem = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory
      if (typeof perfMem?.usedJSHeapSize === 'number' && perfMem.usedJSHeapSize > 0) {
        memoryMb = Math.round((perfMem.usedJSHeapSize / (1024 * 1024)) * 10) / 10
      }
    }

    return {
      fps: Math.round(this.fpsWindow * 10) / 10,
      frameTimeMs: Math.round(this.currentFrameTime * 10) / 10,
      avgFrameTimeMs: Math.round(this.avgFrameTimeMs * 10) / 10,
      frameTimeP95Ms: this.calculateP95(),
      physicsHz: this.physicsHz,
      physicsTicksTotal: this.physicsTicksTotal,
      droppedFrames: this.droppedFramesCount,
      longTasksCount: this.longTasksCount,
      longTasksTotalMs: this.longTasksTotalMs,
      memoryMb,
      reactRendersPerSec: this.rendersPerSec,
    }
  }

  private broadcast(nowMs?: number) {
    const snap = this.getSnapshot(nowMs)
    for (const listener of this.listeners) {
      try {
        listener(snap)
      } catch {
        // Ignora
      }
    }
  }
}

export const performanceMonitor = new PerformanceDiagnosticsTracker()
