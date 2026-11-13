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
  frameTimeP95Ms: number
  physicsHz: number
  droppedFrames: number
  longTasksCount: number
  longTasksTotalMs: number
  memoryMb: number | null
  reactRendersPerSec: number
}

class PerformanceDiagnosticsTracker {
  private enabled = false
  private rafId = 0
  private lastTime = 0

  // Amostragem de quadros (últimos 60 quadros para cálculo de P95 estável)
  private readonly frameBuffer: number[] = []
  private readonly maxBufferSize = 60

  // Métricas acumuladas
  private currentFrameTime = 0
  private droppedFramesCount = 0
  private fpsSmoothed = 60

  // Física
  private physicsTickCounter = 0
  private physicsLastSecTime = 0
  private physicsHz = 120

  // Long tasks
  private longTaskObserver: PerformanceObserver | null = null
  private longTasksCount = 0
  private longTasksTotalMs = 0

  // React renders
  private renderCounter = 0
  private rendersPerSec = 0
  private rendersLastSecTime = 0

  // Listeners para UI (disparados a cada ~500ms para não gerar re-renderizações desnecessárias)
  private listeners: Set<(snapshot: PerformanceSnapshot) => void> = new Set()
  private lastBroadcast = 0

  constructor() {
    this.initLongTaskObserver()
  }

  private initLongTaskObserver() {
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return
    try {
      const types = (PerformanceObserver as any).supportedEntryTypes || []
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

  public recordPhysicsTick() {
    if (!this.enabled) return
    this.physicsTickCounter++
    const now = performance.now()
    if (now - this.physicsLastSecTime >= 1000) {
      this.physicsHz = Math.round((this.physicsTickCounter * 1000) / (now - this.physicsLastSecTime))
      this.physicsTickCounter = 0
      this.physicsLastSecTime = now
    }
  }

  public recordReactRender() {
    if (!this.enabled) return
    this.renderCounter++
    const now = performance.now()
    if (now - this.rendersLastSecTime >= 1000) {
      this.rendersPerSec = Math.round((this.renderCounter * 1000) / (now - this.rendersLastSecTime))
      this.renderCounter = 0
      this.rendersLastSecTime = now
    }
  }

  public start() {
    if (this.enabled) return
    this.enabled = true
    this.lastTime = performance.now()
    this.physicsLastSecTime = this.lastTime
    this.rendersLastSecTime = this.lastTime
    this.frameBuffer.length = 0

    const loop = (timestamp: number) => {
      if (!this.enabled) return

      const dt = timestamp - this.lastTime
      this.lastTime = timestamp

      if (dt > 0 && dt < 500) {
        this.currentFrameTime = dt
        this.frameBuffer.push(dt)
        if (this.frameBuffer.length > this.maxBufferSize) {
          this.frameBuffer.shift()
        }

        // FPS instantâneo suavizado
        const currentFps = 1000 / dt
        this.fpsSmoothed = this.fpsSmoothed * 0.9 + currentFps * 0.1

        // Dropped frame: quando o quadro leva mais de 24ms (~41 FPS) em tela de 60Hz, ou > 12ms em 120Hz
        if (dt > 25) {
          this.droppedFramesCount++
        }
      }

      // Notifica os componentes a cada 500ms (2Hz) para custo mínimo de UI
      if (timestamp - this.lastBroadcast >= 500) {
        this.lastBroadcast = timestamp
        this.broadcast()
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
    if (this.frameBuffer.length === 0) return 0
    const sorted = [...this.frameBuffer].sort((a, b) => a - b)
    const idx = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1)
    return Math.round(sorted[idx] * 10) / 10
  }

  public getSnapshot(): PerformanceSnapshot {
    let memoryMb: number | null = null
    if (typeof performance !== 'undefined' && (performance as any).memory?.usedJSHeapSize) {
      memoryMb = Math.round(((performance as any).memory.usedJSHeapSize / (1024 * 1024)) * 10) / 10
    }

    return {
      fps: Math.round(this.fpsSmoothed * 10) / 10,
      frameTimeMs: Math.round(this.currentFrameTime * 10) / 10,
      frameTimeP95Ms: this.calculateP95(),
      physicsHz: this.physicsHz,
      droppedFrames: this.droppedFramesCount,
      longTasksCount: this.longTasksCount,
      longTasksTotalMs: this.longTasksTotalMs,
      memoryMb,
      reactRendersPerSec: this.rendersPerSec,
    }
  }

  private broadcast() {
    const snap = this.getSnapshot()
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
