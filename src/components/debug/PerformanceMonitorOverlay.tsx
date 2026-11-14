import { useEffect, useState, memo } from 'react'
import { performanceMonitor, type PerformanceSnapshot } from '@/utils/performanceMonitor'
import { useUIStore } from '@/stores/useUIStore'

/**
 * PerformanceMonitorOverlay — HUD de diagnóstico técnico interno (Fase 1.5.2).
 *
 * Exibe métricas de runtime com taxa de atualização de 2 Hz (a cada 500ms)
 * para garantir impacto nulo no desempenho do jogo.
 *
 * Ativado via:
 * - Query param: ?perf=1 ou ?debug=1
 * - Menu Rápido: MobileQuickMenu -> DIAGNÓSTICO
 */
export const PerformanceMonitorOverlay = memo(function PerformanceMonitorOverlay() {
  const showFromStore = useUIStore((s) => s.showPerformanceMonitor)
  const [urlEnabled, setUrlEnabled] = useState(false)
  const [data, setData] = useState<PerformanceSnapshot | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search)
      if (p.get('perf') === '1' || p.get('debug') === '1') {
        setUrlEnabled(true)
      }
    }
  }, [])

  const isVisible = showFromStore || urlEnabled

  useEffect(() => {
    if (!isVisible) return
    const unsubscribe = performanceMonitor.subscribe((snap) => {
      setData(snap)
    })
    return unsubscribe
  }, [isVisible])

  if (!isVisible || !data) return null

  // Taxa visual limitada a no máximo 60 FPS enquanto a física permanece em 120 Hz
  const displayFps = data.visualFps > 0 ? Math.min(60, data.visualFps) : Math.min(60, data.fps)
  // Cores dinâmicas para alertas de frame drop / queda de FPS
  const fpsColor = displayFps >= 55 ? 'text-emerald-400' : displayFps >= 35 ? 'text-amber-400' : 'text-red-400'
  const p95Color = data.frameTimeP95Ms <= 18 ? 'text-emerald-400' : data.frameTimeP95Ms <= 30 ? 'text-amber-400' : 'text-red-400'

  return (
    <aside
      aria-label="Diagnóstico de Performance"
      className="fixed top-1 left-1/2 -translate-x-1/2 z-[70] pointer-events-none select-none flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-white/15 bg-black/80 backdrop-blur-md font-mono text-[9px] text-zinc-300 shadow-xl"
    >
      <div className="flex items-center gap-1">
        <span className="text-[7.5px] font-black uppercase text-zinc-500">FPS</span>
        <b className={`font-black ${fpsColor}`}>{displayFps.toFixed(1)}</b>
      </div>

      <span className="text-zinc-700">|</span>

      <div className="flex items-center gap-1">
        <span className="text-[7.5px] font-black uppercase text-zinc-500">P95</span>
        <b className={`font-black ${p95Color}`}>{data.frameTimeP95Ms.toFixed(1)}ms</b>
      </div>

      <span className="text-zinc-700">|</span>

      <div className="flex items-center gap-1">
        <span className="text-[7.5px] font-black uppercase text-zinc-500">FÍSICA</span>
        <b className="font-black text-cyan-400">{data.physicsHz}Hz</b>
      </div>

      <span className="text-zinc-700">|</span>

      <div className="flex items-center gap-1">
        <span className="text-[7.5px] font-black uppercase text-zinc-500">DROP</span>
        <b className={data.droppedFrames > 0 ? 'text-amber-400' : 'text-zinc-400'}>{data.droppedFrames}</b>
      </div>

      <span className="text-zinc-700">|</span>

      <div className="flex items-center gap-1">
        <span className="text-[7.5px] font-black uppercase text-zinc-500">RENDERS</span>
        <b className="font-black text-emerald-300">{data.reactRendersPerSec}/s</b>
      </div>

      <span className="text-zinc-700">|</span>

      <div className="flex items-center gap-1">
        <span className="text-[7.5px] font-black uppercase text-zinc-500">MEM</span>
        <b className="font-black text-zinc-200">
          {data.memoryMb !== null ? `${data.memoryMb}MB` : 'N/D'}
        </b>
      </div>

      {data.longTasksCount > 0 && (
        <>
          <span className="text-zinc-700">|</span>
          <div className="flex items-center gap-1">
            <span className="text-[7.5px] font-black uppercase text-red-500">LT</span>
            <b className="font-black text-red-400">{data.longTasksCount} ({data.longTasksTotalMs}ms)</b>
          </div>
        </>
      )}
    </aside>
  )
})
