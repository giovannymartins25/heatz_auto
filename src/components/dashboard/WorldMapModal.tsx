import { memo, useEffect, useState } from 'react'
import type { VehicleConfig } from '@/types'
import { useUIStore } from '@/stores/useUIStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { DrivingWorldCanvas } from './DrivingWorldCanvas'

export interface WorldMapModalProps {
  vehicle?: VehicleConfig
}

const FOLLOW_ZOOM_MIN = 1.2
const FOLLOW_ZOOM_MAX = 6.0
const FOLLOW_ZOOM_STEP = 0.6

/**
 * WorldMapModal — Visão ampla dedicada do Mapa do Mundo 2D do HEATZ AUTO (Fase 4.4.2).
 *
 * Integra:
 * - Geometria completa de `WorldGeometry.ts` via `DrivingWorldCanvas`
 * - Zoom direto nos cantos opostos do mapa (+ no canto superior direito, − no canto inferior esquerdo)
 * - Menu expansível por seta para controles secundários (Mundo Inteiro, Seguir Veículo e Centralizar)
 * - Execução em tempo real sem pausar a simulação nem desativar o minimapa fixo do HUD
 */
export const WorldMapModal = memo(function WorldMapModal({ vehicle }: WorldMapModalProps) {
  const isWorldMapOpen = useUIStore((s) => s.isWorldMapOpen)
  const closeWorldMap = useUIStore((s) => s.closeWorldMap)

  const positionX = useSimulationStore((s) => s.positionX)
  const positionY = useSimulationStore((s) => s.positionY)
  const headingDeg = useSimulationStore((s) => s.headingDeg)
  const speed = useSimulationStore((s) => s.speed)
  const zoneName = useSimulationStore((s) => s.zoneName)
  const surfaceType = useSimulationStore((s) => s.surfaceType)
  const lateralAccelG = useSimulationStore((s) => s.lateralAccelG)
  const resetPosition = useSimulationStore((s) => s.resetPosition)

  const [viewScope, setViewScope] = useState<'world' | 'follow'>('world')
  const [followZoom, setFollowZoom] = useState<number>(2.8)
  const [isSecondaryOpen, setIsSecondaryOpen] = useState<boolean>(true)

  useEffect(() => {
    if (!isWorldMapOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeWorldMap()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isWorldMapOpen, closeWorldMap])

  if (!isWorldMapOpen) return null

  const surfaceLabel =
    surfaceType === 'wet_asphalt'
      ? 'Asfalto Molhado'
      : surfaceType === 'gravel'
        ? 'Cascalho'
        : surfaceType === 'grass'
          ? 'Grama'
          : surfaceType === 'curb'
            ? 'Guia / Calçada'
            : 'Asfalto'

  const handleZoomIn = () => {
    if (viewScope === 'world') {
      setViewScope('follow')
      setFollowZoom(2.2)
      return
    }
    setFollowZoom((z) => Math.min(FOLLOW_ZOOM_MAX, Number((z + FOLLOW_ZOOM_STEP).toFixed(2))))
  }

  const handleZoomOut = () => {
    if (viewScope === 'world') return
    if (followZoom <= FOLLOW_ZOOM_MIN + 1e-3) {
      setViewScope('world')
      return
    }
    setFollowZoom((z) => Math.max(FOLLOW_ZOOM_MIN, Number((z - FOLLOW_ZOOM_STEP).toFixed(2))))
  }

  const canZoomIn = viewScope === 'world' || followZoom < FOLLOW_ZOOM_MAX - 1e-3
  const canZoomOut = viewScope === 'follow'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mapa do Mundo"
      data-testid="world-map-modal"
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 select-none"
      onClick={closeWorldMap}
    >
      <div
        className="relative flex flex-col w-full max-w-5xl h-[92dvh] max-h-[820px] rounded-2xl border border-sky-500/40 bg-[#06090f] shadow-[0_20px_70px_rgba(0,0,0,0.95)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Mapa Completo (Contexto apropriado para navegação e localização) */}
        <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-zinc-950/95 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base sm:text-lg">🗺️</span>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-mono font-black uppercase tracking-wider text-white truncate">
                Mapa do Mundo · HEATZ AUTO
              </h2>
              <p className="text-[9px] sm:text-[10px] font-mono text-zinc-400 truncate">
                📍 <span className="text-sky-300 font-bold">{zoneName || 'Rotatória Central'}</span> · {surfaceLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div
              data-testid="world-map-coords"
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-black/80 border border-white/10 font-mono text-[10px] text-zinc-300"
            >
              <span className="text-emerald-400 font-black">{Math.round(speed)} km/h</span>
              <span className="text-zinc-600">|</span>
              <span className="text-sky-400 font-bold">▲ {Math.round(headingDeg)}°</span>
              {Math.abs(lateralAccelG) >= 0.05 && (
                <>
                  <span className="text-zinc-600">|</span>
                  <span className="text-amber-400 font-bold">{Math.abs(lateralAccelG).toFixed(2)}G</span>
                </>
              )}
              <span className="text-zinc-600">|</span>
              <span>
                X:{positionX >= 0 ? '+' : ''}
                {positionX.toFixed(1)}m · Y:{positionY >= 0 ? '+' : ''}
                {positionY.toFixed(1)}m
              </span>
            </div>

            <button
              type="button"
              onClick={closeWorldMap}
              aria-label="Fechar mapa do mundo"
              data-testid="btn-close-world-map"
              className="h-9 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-100 font-mono text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <span>✕</span>
              <span>Fechar</span>
            </button>
          </div>
        </header>

        {/* Área Principal do Mapa do Mundo (Canvas 2D Real Sincronizado + Zoom nos Cantos + Menu Expansível) */}
        <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-[#070b12]">
          <DrivingWorldCanvas
            vehicle={vehicle}
            overviewMode={viewScope === 'world'}
            cameraMode={viewScope === 'world' ? 'north_up' : 'follow'}
            zoomScale={viewScope === 'world' ? 1.0 : followZoom}
          />

          {/* Zoom + no Canto Superior Direito */}
          <button
            type="button"
            data-testid="btn-worldmap-zoom-in"
            onClick={handleZoomIn}
            disabled={!canZoomIn}
            aria-label="Aproximar zoom no mapa do mundo"
            className={`absolute top-3 right-3 z-20 h-9 w-9 rounded-xl border font-mono font-black text-base flex items-center justify-center backdrop-blur-md shadow-lg transition-all ${
              canZoomIn
                ? 'bg-black/80 hover:bg-zinc-900 border-white/20 text-sky-300 active:scale-90 cursor-pointer'
                : 'bg-black/45 border-white/5 text-zinc-600 cursor-not-allowed'
            }`}
          >
            +
          </button>

          {/* Zoom − no Canto Inferior Esquerdo (oposto) */}
          <button
            type="button"
            data-testid="btn-worldmap-zoom-out"
            onClick={handleZoomOut}
            disabled={!canZoomOut}
            aria-label="Afastar zoom no mapa do mundo"
            className={`absolute bottom-3 left-3 z-20 h-9 w-9 rounded-xl border font-mono font-black text-base flex items-center justify-center backdrop-blur-md shadow-lg transition-all ${
              canZoomOut
                ? 'bg-black/80 hover:bg-zinc-900 border-white/20 text-sky-300 active:scale-90 cursor-pointer'
                : 'bg-black/45 border-white/5 text-zinc-600 cursor-not-allowed'
            }`}
          >
            −
          </button>

          {/* Agrupamento Expansível de Controles Secundários (Canto Inferior Direito com seta) */}
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 max-w-[calc(100%-4rem)]">
            {isSecondaryOpen && (
              <div
                data-testid="worldmap-secondary-controls-panel"
                className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/15 bg-black/85 p-1.5 backdrop-blur-md shadow-xl"
              >
                <button
                  type="button"
                  data-testid="btn-worldmap-scope-world"
                  onClick={() => setViewScope('world')}
                  aria-pressed={viewScope === 'world'}
                  className={`h-8 px-2.5 rounded-lg border font-mono text-[9.5px] font-black uppercase cursor-pointer transition-all ${
                    viewScope === 'world'
                      ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                      : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  🗺️ Mundo Inteiro
                </button>
                <button
                  type="button"
                  data-testid="btn-worldmap-scope-follow"
                  onClick={() => setViewScope('follow')}
                  aria-pressed={viewScope === 'follow'}
                  className={`h-8 px-2.5 rounded-lg border font-mono text-[9.5px] font-black uppercase cursor-pointer transition-all ${
                    viewScope === 'follow'
                      ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                      : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  🔄 Seguir Veículo
                </button>
                <button
                  type="button"
                  data-testid="btn-worldmap-center"
                  onClick={resetPosition}
                  className="h-8 px-2.5 rounded-lg border border-white/10 bg-zinc-900 text-zinc-300 hover:text-white font-mono text-[9.5px] font-black uppercase cursor-pointer transition-all"
                >
                  🎯 Centralizar
                </button>
              </div>
            )}

            <button
              type="button"
              data-testid="btn-worldmap-secondary-toggle"
              aria-expanded={isSecondaryOpen}
              aria-label={isSecondaryOpen ? 'Recolher controles secundários do mapa' : 'Expandir controles secundários do mapa'}
              onClick={() => setIsSecondaryOpen((prev) => !prev)}
              className="h-9 px-2.5 rounded-xl border border-white/20 bg-black/80 hover:bg-zinc-900 text-sky-200 font-mono text-xs font-black flex items-center gap-1 backdrop-blur-md shadow-lg cursor-pointer"
            >
              <span>{isSecondaryOpen ? '▶' : '◀'}</span>
              <span className="text-[9px] uppercase">Controles</span>
            </button>
          </div>
        </div>

        {/* Rodapé com Legenda dos Setores */}
        <footer className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-white/10 bg-zinc-950/95 flex-shrink-0 text-[9px] font-mono text-zinc-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
              <strong className="text-white">Você</strong>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-slate-400" />
              Avenidas / Anel
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-amber-400" />
              Arrancada 402m
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-blue-500" />
              Skidpad
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-amber-800" />
              Off-Road
            </span>
          </div>
          <span className="text-zinc-500">
            Escala: <b className="text-sky-300">{viewScope === 'world' ? 'Visão Geral' : `${followZoom.toFixed(1)}x`}</b>
          </span>
        </footer>
      </div>
    </div>
  )
})
