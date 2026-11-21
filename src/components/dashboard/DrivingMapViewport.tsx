import { memo, useMemo, useState } from 'react'
import type { MapViewportSize } from '@/stores/useUIStore'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types/vehicle'
import { useSimulationStore } from '@/stores/useSimulationStore'
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
}

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
    prev.onSizeChange === next.onSizeChange
  )
}

/**
 * DrivingMapViewport — Viewport interativo de condução automotiva 2D em tempo real.
 * Renderiza o mapa métrico com física compartilhada a 120 Hz, câmera suave e HUD informativo.
 */
export const DrivingMapViewport = memo(function DrivingMapViewport({
  size,
  onSizeChange,
  compact = false,
  className = '',
  telemetry,
  vehicle,
  navigation,
}: DrivingMapViewportProps) {
  const [cameraMode, setCameraMode] = useState<'follow' | 'north_up'>('follow')
  const [zoomScale, setZoomScale] = useState<number>(4.2)

  const rawSpeed = navigation?.speedKmh ?? telemetry?.speedometer.speed ?? 0
  const currentSpeed = Math.round(rawSpeed)
  const isMoving = currentSpeed > 0

  // Telemetria 2D ao vivo da store
  const storeX = useSimulationStore((s) => s.positionX)
  const storeY = useSimulationStore((s) => s.positionY)
  const storeHeading = useSimulationStore((s) => s.headingDeg)
  const zoneName = useSimulationStore((s) => s.zoneName)
  const surfaceType = useSimulationStore((s) => s.surfaceType)
  const absEngaged = useSimulationStore((s) => s.absEngaged)
  const isAirbrakeActive = useSimulationStore((s) => s.isAirbrakeActive)
  const downforceN = useSimulationStore((s) => s.downforceN)
  const resetPosition = useSimulationStore((s) => s.resetPosition)

  const effectiveHeading = navigation?.headingDeg ?? storeHeading ?? 0
  const headingLabel = `${Math.round(effectiveHeading)}°`
  const paddingClass = compact ? 'p-1.5' : 'p-2'

  // Formatação de coordenadas métricas (X, Y)
  const coordX = Math.round(storeX * 10) / 10
  const coordY = Math.round(storeY * 10) / 10
  const coordLabel = `X: ${coordX >= 0 ? '+' : ''}${coordX.toFixed(1)}m · Y: ${coordY >= 0 ? '+' : ''}${coordY.toFixed(1)}m`

  // Cálculo da Próxima Curva e Velocidade Recomendada
  const curveInfo = useMemo(() => {
    const trackCurves = [
      { id: 'c1', name: 'Curva da Praça', positionM: 140, radiusM: 42, direction: 'right' as const },
      { id: 'c2', name: 'Acesso Norte', positionM: 320, radiusM: 65, direction: 'left' as const },
      { id: 'c3', name: 'Grampo Sul', positionM: 490, radiusM: 26, direction: 'right' as const },
    ]

    const traveled = (navigation?.distanceTraveledMeters ?? 0) % 600
    let target = trackCurves.find((c) => c.positionM > traveled)
    let dist = target ? target.positionM - traveled : (600 - traveled) + trackCurves[0].positionM
    if (!target) target = trackCurves[0]

    const g = 9.81
    const mass = vehicle?.info.weight || 1400
    const muBase = 1.02
    const muAeroBonus = Math.max(0, downforceN) / (mass * g)
    const muTotal = muBase + muAeroBonus
    const vRecMs = Math.sqrt(muTotal * g * target.radiusM)
    const vRecKmh = Math.round(vRecMs * 3.6)

    const isAlert = dist <= 120
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

  return (
    <section
      aria-label="Mapa de condução 2D dirigível"
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

      {/* ── 2. HUD / Badges Superiores ── */}
      <div className={`relative z-10 flex items-center justify-between w-full ${paddingClass} text-white pointer-events-none`}>
        {/* Status GPS e Velocidade */}
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/80 px-2 py-0.5 backdrop-blur-md shadow-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span className="font-mono text-[8px] sm:text-[9px] font-black tracking-wider text-slate-200">
            GPS 2D · {isMoving ? `${currentSpeed} KM/H` : 'PARADO'}
          </span>
          {absEngaged && (
            <span className="ml-1 px-1 rounded bg-amber-500 text-black font-mono font-black text-[7.5px] animate-pulse">
              ABS
            </span>
          )}
          {isAirbrakeActive && (
            <span className="ml-1 px-1 rounded bg-rose-600 text-white font-mono font-black text-[7.5px] animate-pulse">
              AIRBRAKE
            </span>
          )}
        </div>

        {/* Bússola e Coordenadas Métricas */}
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/80 px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-slate-300 backdrop-blur-md shadow-md">
          <span className="text-sky-400 font-black">▲ {headingLabel}</span>
          <span className="text-slate-400 hidden xs:inline">{coordLabel}</span>
        </div>
      </div>

      {/* ── 2.1 Alerta e Orientação Antecipada de Curvas ── */}
      {curveInfo.isAlert && (
        <div className="relative z-10 mx-auto -mt-1 px-2 pointer-events-none transition-all">
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
                <span className="text-slate-400">· R:{curveInfo.target.radiusM}m em {curveInfo.dist}m</span>
              </div>
              <div className="flex items-center gap-1.5 text-[8.5px] font-black font-mono">
                <span>REC: <strong className={curveInfo.shouldBrake ? 'text-rose-300' : 'text-emerald-400'}>{curveInfo.vRecKmh} km/h</strong></span>
                {curveInfo.shouldBrake && (
                  <span className="text-[7.5px] text-rose-400 font-black tracking-widest uppercase">⚠ REDUZA</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Rodapé com Informações de Rua, Câmera & Seletor de Modos ── */}
      <div className={`relative z-10 mt-auto flex flex-wrap items-center justify-between gap-1 w-full max-w-full ${paddingClass}`}>
        {/* Localização e Superfície Atual */}
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/85 px-1.5 sm:px-2 py-0.5 sm:py-1 font-mono text-[7px] sm:text-[8.5px] font-semibold text-slate-300 backdrop-blur-md shadow-md min-w-0 max-w-full">
          <span className="text-sky-400 font-bold shrink-0">📍</span>
          <span className="font-bold text-white uppercase truncate max-w-[110px] sm:max-w-none">{zoneName || 'Setor Central'}</span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <span className="text-slate-400 hidden sm:inline capitalize">
            {surfaceType === 'wet_asphalt' ? 'Asfalto Molhado' : surfaceType === 'gravel' ? 'Cascalho' : surfaceType === 'grass' ? 'Grama' : 'Asfalto'}
          </span>
        </div>

        {/* Controles de Câmera e Centralização */}
        <div className="flex items-center gap-1 flex-wrap justify-end max-w-full">
          {/* Botão de Centralizar / Spawn */}
          <button
            type="button"
            onClick={resetPosition}
            className="h-6 px-1.5 rounded-lg bg-black/80 hover:bg-zinc-800 border border-white/15 text-zinc-300 text-[8px] font-mono font-bold transition-all active:scale-95 cursor-pointer backdrop-blur-md flex items-center gap-0.5"
            title="Recolocar veículo no ponto inicial seguro"
            aria-label="Centralizar veículo"
          >
            <span>🎯</span>
            <span className="hidden sm:inline">Centro</span>
          </button>

          {/* Alternar Câmera: Seguir vs Norte Fixo */}
          <button
            type="button"
            onClick={() => setCameraMode(cameraMode === 'follow' ? 'north_up' : 'follow')}
            className={`h-6 px-1.5 rounded-lg border text-[8px] font-mono font-bold transition-all active:scale-95 cursor-pointer backdrop-blur-md flex items-center gap-0.5 ${
              cameraMode === 'follow'
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-black/80 border-white/15 text-zinc-400 hover:text-white'
            }`}
            title={cameraMode === 'follow' ? 'Câmera acompanhando a proa do carro' : 'Câmera com Norte fixo para cima'}
            aria-label="Alternar modo de câmera"
          >
            <span>{cameraMode === 'follow' ? '🔄' : '🧭'}</span>
            <span className="hidden sm:inline">{cameraMode === 'follow' ? 'Seguir' : 'Norte'}</span>
          </button>

          {/* Zoom In / Out */}
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.min(6.5, z + 0.8))}
            className="h-6 w-6 rounded-lg bg-black/80 hover:bg-zinc-800 border border-white/15 text-zinc-300 text-[10px] font-mono font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md"
            title="Aproximar Zoom"
            aria-label="Aproximar Zoom"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.max(2.2, z - 0.8))}
            className="h-6 w-6 rounded-lg bg-black/80 hover:bg-zinc-800 border border-white/15 text-zinc-300 text-[10px] font-mono font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md"
            title="Afastar Zoom"
            aria-label="Afastar Zoom"
          >
            -
          </button>

          {/* ── Alternador de Tamanho (P · M · G) ── */}
          <div
            className="flex items-center rounded-xl border border-white/15 bg-black/85 p-0.5 shadow-lg backdrop-blur-md"
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
                  onClick={() => onSizeChange(option.id)}
                  aria-pressed={isSelected}
                  title={option.title}
                  className={`min-h-5 min-w-5 sm:min-w-6 rounded-lg px-1 sm:px-1.5 font-mono text-[8px] font-black uppercase transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300 active:scale-95 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.85)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}, areDrivingMapPropsEqual)
