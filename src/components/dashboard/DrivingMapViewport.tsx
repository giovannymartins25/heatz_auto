import { memo, useMemo, useState } from 'react'
import type { MapViewportSize } from '@/stores/useUIStore'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types/vehicle'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { WORLD_GEOMETRY } from '@/systems/world/WorldGeometry'
import { DrivingWorldCanvas } from './DrivingWorldCanvas'

export interface MapNavigationTelemetry {
  coordinates?: { x: number; y: number }
  headingDeg?: number
  speedKmh?: number
  distanceTraveledMeters?: number
}

export interface DrivingMapViewportProps {
  size: MapViewportSize
  onSizeChange: (size: MapViewportSize) => void
  compact?: boolean
  className?: string
  telemetry?: DashboardTelemetry
  vehicle?: VehicleConfig
  navigation?: MapNavigationTelemetry
  onOpenDragStrip?: () => void
}

const ZOOM_MIN = 2.2
const ZOOM_MAX = 6.5
const ZOOM_STEP = 0.8

const roundOptional = (val?: number): number | undefined =>
  val === undefined ? undefined : Math.round(val)

export function areDrivingMapPropsEqual(
  prev: DrivingMapViewportProps,
  next: DrivingMapViewportProps,
): boolean {
  const prevSpeed = prev.telemetry ? Math.round(prev.telemetry.speedometer.speed) : 0
  const nextSpeed = next.telemetry ? Math.round(next.telemetry.speedometer.speed) : 0

  const prevNav = prev.navigation
  const nextNav = next.navigation
  const sameNav =
    prevNav === nextNav ||
    (prevNav !== undefined &&
      nextNav !== undefined &&
      roundOptional(prevNav.headingDeg) === roundOptional(nextNav.headingDeg) &&
      roundOptional(prevNav.speedKmh) === roundOptional(nextNav.speedKmh) &&
      roundOptional(prevNav.distanceTraveledMeters) === roundOptional(nextNav.distanceTraveledMeters) &&
      prevNav.coordinates?.x === nextNav.coordinates?.x &&
      prevNav.coordinates?.y === nextNav.coordinates?.y)

  return (
    prev.size === next.size &&
    prev.compact === next.compact &&
    prev.className === next.className &&
    prevSpeed === nextSpeed &&
    sameNav &&
    prev.onSizeChange === next.onSizeChange &&
    prev.onOpenDragStrip === next.onOpenDragStrip
  )
}

/**
 * DrivingMapViewport — Viewport interativo de condução automotiva 2D em tempo real (Fase 4.4.2).
 *
 * Reorganização visual:
 * - Sem textos persistentes de nome da rua ou superfície ocupando espaço da pista
 * - Controles discretos e touch-friendly de Zoom nos cantos opostos (+ no canto superior direito, − no canto inferior esquerdo)
 * - Controles secundários (Centralizar veículo, Seguir/Norte e tamanho P/M/G) agrupados em menu expansível com seta indicadora
 * - Alertas temporários/contextuais preservados (aproximação de curva, ABS e Airbrake)
 */
export const DrivingMapViewport = memo(function DrivingMapViewport({
  size,
  onSizeChange,
  className = '',
  telemetry,
  vehicle,
  navigation,
  onOpenDragStrip,
}: DrivingMapViewportProps) {
  const [cameraMode, setCameraMode] = useState<'follow' | 'north_up'>('follow')
  const [zoomScale, setZoomScale] = useState<number>(4.2)
  const [isSecondaryMenuOpen, setIsSecondaryMenuOpen] = useState<boolean>(false)

  const rawSpeed = navigation?.speedKmh ?? telemetry?.speedometer.speed ?? 0
  const currentSpeed = Math.round(rawSpeed)

  const absEngaged = useSimulationStore((s) => s.absEngaged)
  const isAirbrakeActive = useSimulationStore((s) => s.isAirbrakeActive)
  const downforceN = useSimulationStore((s) => s.downforceN)
  const positionX = useSimulationStore((s) => s.positionX)
  const positionY = useSimulationStore((s) => s.positionY)
  const dragStage = useSimulationStore((s) => s.dragStage)
  const resetPosition = useSimulationStore((s) => s.resetPosition)

  const isAtDragStaging =
    Boolean(onOpenDragStrip) &&
    dragStage === 'idle' &&
    Math.abs(positionY - WORLD_GEOMETRY.dragStrip.yCenter) <= WORLD_GEOMETRY.dragStrip.halfWidth + 4 &&
    positionX >= WORLD_GEOMETRY.dragStrip.startX - 20 &&
    positionX <= WORLD_GEOMETRY.dragStrip.startX + 35

  // Alerta contextual temporário de próxima curva (exibido apenas em aproximação <= 120 m)
  const curveInfo = useMemo(() => {
    const trackCurves = [
      { id: 'c1', name: 'Curva da Praça', positionM: 140, radiusM: 42, direction: 'right' as const },
      { id: 'c2', name: 'Acesso Norte', positionM: 320, radiusM: 65, direction: 'left' as const },
      { id: 'c3', name: 'Grampo Sul', positionM: 490, radiusM: 26, direction: 'right' as const },
    ]

    const traveled = (navigation?.distanceTraveledMeters ?? 0) % 600
    let target = trackCurves.find((c) => c.positionM > traveled)
    const dist = target ? target.positionM - traveled : (600 - traveled) + trackCurves[0].positionM
    if (!target) target = trackCurves[0]

    const g = 9.81
    const mass = vehicle?.info.weight || 1400
    const muBase = 1.02
    const muAeroBonus = Math.max(0, downforceN) / (mass * g)
    const muTotal = muBase + muAeroBonus
    const vRecMs = Math.sqrt(muTotal * g * target.radiusM)
    const vRecKmh = Math.round(vRecMs * 3.6)

    const isAlert = navigation?.distanceTraveledMeters !== undefined && dist <= 120
    const shouldBrake = isAlert && currentSpeed > vRecKmh + 4

    return {
      target,
      dist: Math.round(dist),
      vRecKmh,
      isAlert,
      shouldBrake,
    }
  }, [navigation?.distanceTraveledMeters, vehicle?.info.weight, downforceN, currentSpeed])

  if (size === 'hidden') {
    return null
  }

  const canZoomIn = zoomScale < ZOOM_MAX - 1e-3
  const canZoomOut = zoomScale > ZOOM_MIN + 1e-3

  return (
    <section
      aria-label="Mapa de condução 2D dirigível"
      data-testid="driving-map-viewport"
      className={`relative isolate flex flex-col w-full h-full max-w-xl sm:max-w-2xl mx-auto overflow-hidden rounded-2xl border border-sky-500/25 bg-[#06090f] shadow-[0_4px_25px_rgba(0,0,0,0.85),inset_0_0_20px_rgba(15,23,42,0.9)] transition-all duration-200 select-none ${className}`}
    >
      {/* ── 1. Canvas 2D Dirigível de Alta Performance ── */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <DrivingWorldCanvas
          vehicle={vehicle}
          cameraMode={cameraMode}
          zoomScale={zoomScale}
        />
      </div>

      {/* ── 2. Alertas Temporários Contextuais (ABS / Airbrake / Aproximação de Curva / Alinhamento 402m) ── */}
      {(absEngaged || isAirbrakeActive || curveInfo.isAlert || isAtDragStaging) && (
        <div className="relative z-10 mx-auto mt-1.5 flex flex-col items-center gap-1 px-2 pointer-events-none">
          {isAtDragStaging && onOpenDragStrip && (
            <button
              type="button"
              data-testid="btn-contextual-drag-strip"
              onClick={onOpenDragStrip}
              style={{ touchAction: 'manipulation' }}
              className="pointer-events-auto flex items-center gap-1 rounded-full border border-amber-400/70 bg-amber-950/90 px-2.5 py-0.5 font-mono text-[8px] font-black uppercase tracking-wider text-amber-200 shadow-lg backdrop-blur-md active:scale-95 cursor-pointer"
              title="Abrir Árvore de Natal NHRA na Pista de Arrancada 402m"
            >
              <span>🏁</span>
              <span>LARGADA 402M</span>
            </button>
          )}
          {(absEngaged || isAirbrakeActive) && (
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/80 px-2 py-0.5 backdrop-blur-md">
              {absEngaged && (
                <span className="px-1.5 py-px rounded bg-amber-500 text-black font-mono font-black text-[7.5px] animate-pulse">
                  ABS
                </span>
              )}
              {isAirbrakeActive && (
                <span className="px-1.5 py-px rounded bg-rose-600 text-white font-mono font-black text-[7.5px] animate-pulse">
                  AIRBRAKE
                </span>
              )}
            </div>
          )}

          {curveInfo.isAlert && (
            <div
              className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border backdrop-blur-md shadow-lg ${
                curveInfo.shouldBrake
                  ? 'bg-rose-950/85 border-rose-500 text-rose-100 animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                  : 'bg-black/85 border-sky-400/40 text-slate-200 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
              }`}
            >
              <span className="text-sm font-black">
                {curveInfo.target.direction === 'right' ? '↱' : '↰'}
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1 text-[7.5px] font-bold uppercase tracking-wider">
                  <span className={curveInfo.shouldBrake ? 'text-rose-400' : 'text-sky-400'}>
                    {curveInfo.target.name}
                  </span>
                  <span className="text-slate-400">· {curveInfo.dist}m</span>
                </div>
                <div className="flex items-center gap-1.5 text-[8.5px] font-black font-mono">
                  <span>
                    REC:{' '}
                    <strong className={curveInfo.shouldBrake ? 'text-rose-300' : 'text-emerald-400'}>
                      {curveInfo.vRecKmh} km/h
                    </strong>
                  </span>
                  {curveInfo.shouldBrake && (
                    <span className="text-[7.5px] text-rose-400 font-black tracking-widest uppercase">
                      ⚠ REDUZA
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3. Controle de Zoom + no Canto Superior Direito ── */}
      <button
        type="button"
        data-testid="btn-map-zoom-in"
        onClick={() => setZoomScale((z) => Math.min(ZOOM_MAX, Number((z + ZOOM_STEP).toFixed(2))))}
        disabled={!canZoomIn}
        style={{ touchAction: 'manipulation' }}
        className={`absolute top-2 right-2 z-20 h-7 w-7 sm:h-8 sm:w-8 rounded-xl border font-mono text-sm font-black flex items-center justify-center transition-all backdrop-blur-md shadow-md ${
          canZoomIn
            ? 'bg-black/75 hover:bg-zinc-900/90 border-white/15 text-sky-300 active:scale-90 cursor-pointer'
            : 'bg-black/45 border-white/5 text-zinc-600 cursor-not-allowed'
        }`}
        title="Aproximar Zoom (+)"
        aria-label="Aproximar Zoom"
      >
        +
      </button>

      {/* ── 4. Controle de Zoom − no Canto Oposto (Inferior Esquerdo) ── */}
      <button
        type="button"
        data-testid="btn-map-zoom-out"
        onClick={() => setZoomScale((z) => Math.max(ZOOM_MIN, Number((z - ZOOM_STEP).toFixed(2))))}
        disabled={!canZoomOut}
        style={{ touchAction: 'manipulation' }}
        className={`absolute bottom-2 left-2 z-20 h-7 w-7 sm:h-8 sm:w-8 rounded-xl border font-mono text-sm font-black flex items-center justify-center transition-all backdrop-blur-md shadow-md ${
          canZoomOut
            ? 'bg-black/75 hover:bg-zinc-900/90 border-white/15 text-sky-300 active:scale-90 cursor-pointer'
            : 'bg-black/45 border-white/5 text-zinc-600 cursor-not-allowed'
        }`}
        title="Afastar Zoom (−)"
        aria-label="Afastar Zoom"
      >
        −
      </button>

      {/* ── 5. Agrupamento Expansível dos Controles Secundários (Canto Inferior Direito, com seta indicadora) ── */}
      <div
        className="absolute bottom-2 right-2 z-20 flex items-center gap-1 max-w-[calc(100%-3.5rem)]"
        style={{ touchAction: 'manipulation' }}
      >
        {isSecondaryMenuOpen && (
          <div
            data-testid="map-secondary-controls-panel"
            className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/85 px-1.5 py-1 shadow-xl backdrop-blur-md animate-in fade-in duration-150"
          >
            {/* Centralizar Veículo */}
            <button
              type="button"
              data-testid="btn-map-center-vehicle"
              onClick={resetPosition}
              className="h-6 px-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-[8px] font-mono font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1"
              title="Centralizar / reposicionar veículo"
              aria-label="Centralizar veículo"
            >
              <span>🎯</span>
              <span>Centro</span>
            </button>

            {/* Seguir Veículo vs Norte Fixo */}
            <button
              type="button"
              data-testid="btn-map-follow-toggle"
              onClick={() => setCameraMode((prev) => (prev === 'follow' ? 'north_up' : 'follow'))}
              aria-pressed={cameraMode === 'follow'}
              className={`h-6 px-2 rounded-lg border text-[8px] font-mono font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
                cameraMode === 'follow'
                  ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                  : 'bg-zinc-900/90 border-white/15 text-zinc-300 hover:text-white'
              }`}
              title={cameraMode === 'follow' ? 'Seguindo proa do veículo' : 'Norte fixo para cima'}
              aria-label="Alternar acompanhamento da câmera"
            >
              <span>{cameraMode === 'follow' ? '🔄' : '🧭'}</span>
              <span>{cameraMode === 'follow' ? 'Seguir' : 'Norte'}</span>
            </button>

            {/* Tamanho do Mapa (P · M · G) */}
            <div
              className="flex items-center rounded-lg border border-white/10 bg-zinc-950/90 p-0.5"
              role="group"
              aria-label="Tamanho do mapa"
            >
              {(
                [
                  { id: 'compact', label: 'P', title: 'Mapa Compacto' },
                  { id: 'balanced', label: 'M', title: 'Mapa Equilibrado' },
                  { id: 'expanded', label: 'G', title: 'Mapa Expandido' },
                ] as const
              ).map((option) => {
                const isSelected = size === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    data-testid={`btn-map-size-${option.id}`}
                    onClick={() => onSizeChange(option.id)}
                    aria-pressed={isSelected}
                    title={option.title}
                    className={`min-h-5 min-w-5 rounded px-1 font-mono text-[8px] font-black uppercase transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Botão de Seta para Abrir/Fechar Controles Secundários */}
        <button
          type="button"
          data-testid="btn-map-secondary-toggle"
          aria-expanded={isSecondaryMenuOpen}
          aria-label={isSecondaryMenuOpen ? 'Recolher controles do mapa' : 'Expandir controles do mapa'}
          title={isSecondaryMenuOpen ? 'Recolher controles do mapa' : 'Controles do mapa (Centralizar / Seguir / Tamanho)'}
          onClick={() => setIsSecondaryMenuOpen((prev) => !prev)}
          className={`h-7 sm:h-8 px-2 rounded-xl border font-mono text-[10px] font-black flex items-center justify-center gap-1 transition-all backdrop-blur-md shadow-md active:scale-95 cursor-pointer ${
            isSecondaryMenuOpen
              ? 'bg-sky-600/30 border-sky-400 text-sky-200'
              : 'bg-black/75 hover:bg-zinc-900/90 border-white/15 text-zinc-300'
          }`}
        >
          <span>{isSecondaryMenuOpen ? '▶' : '◀'}</span>
          <span className="text-[8px] uppercase tracking-wider">Opções</span>
        </button>
      </div>
    </section>
  )
}, areDrivingMapPropsEqual)
