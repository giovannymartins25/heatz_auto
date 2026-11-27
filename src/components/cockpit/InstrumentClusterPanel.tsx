/**
 * InstrumentClusterPanel.tsx — Painel 1 do Cockpit Modular (Fase 4.4.3 — Etapa 3).
 *
 * Reutiliza `VehicleDashboardCluster` (que consome `CLUSTER_REGISTRY` via `ClusterView`),
 * sem sobrepor setas/faróis/ignição duplicados sobre os 15 clusters reais (que possuem
 * suas próprias luzes-espia e indicadores nativos integrados). Exibe overlays apenas no
 * modo `cockpit` 3D ou para o manômetro de coluna aftermarket `[UPG]` / borboletas.
 */

import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { VehicleDashboardCluster } from '@/components/dashboard/VehicleDashboardCluster'
import { CockpitView } from '@/components/dashboard/CockpitView'
import { AutomaticShiftButton } from '@/components/controls'
import { AftermarketPillarGaugePod } from '@/components/gauges'

export interface InstrumentClusterPanelProps {
  telemetry: DashboardTelemetry
  vehicle: VehicleConfig
  viewMode?: 'cluster' | 'cockpit'
  expanded?: boolean
  maxScale?: number
  supportsPaddleShifters?: boolean
  isManualActive?: boolean
  hasTurbo?: boolean
  showAftermarketBoostGauge?: boolean
  boostPressureBar?: number
  showPillarGaugePod?: boolean
  className?: string
}

export const InstrumentClusterPanel = memo(function InstrumentClusterPanel({
  telemetry,
  vehicle,
  viewMode = 'cluster',
  expanded = false,
  maxScale,
  supportsPaddleShifters = false,
  isManualActive = false,
  hasTurbo = false,
  showAftermarketBoostGauge = false,
  boostPressureBar = 0,
  showPillarGaugePod = false,
  className = '',
}: InstrumentClusterPanelProps) {
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const hazardIndicatorLit = useSimulationStore((s) => s.hazardIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const fogLightsLit = useSimulationStore((s) => s.fogLightsLit)

  return (
    <div
      className={`relative flex h-full w-full min-h-0 items-center justify-center ${className}`}
      data-testid="cockpit-panel-cluster"
    >
      {/* Indicadores sobrepostos exibidos APENAS no modo Cockpit 3D (evitando duplicação nos 15 clusters reais) */}
      {viewMode === 'cockpit' && (
        <div className="pointer-events-none absolute top-0.5 left-1.5 z-20 flex items-center gap-1.5">
          <span
            data-testid="cluster-indicator-left"
            className={`px-1 rounded text-[9px] font-mono font-black transition-opacity ${
              leftIndicatorLit ? 'bg-emerald-500/25 text-emerald-400 opacity-100' : 'text-zinc-700 opacity-35'
            }`}
          >
            ⬅
          </span>
          {hazardIndicatorLit && (
            <span
              data-testid="cluster-indicator-hazard"
              className="px-1 rounded bg-red-500/25 text-[8.5px] font-mono font-black text-red-400"
            >
              ⚠️
            </span>
          )}
          <span
            data-testid="cluster-indicator-right"
            className={`px-1 rounded text-[9px] font-mono font-black transition-opacity ${
              rightIndicatorLit ? 'bg-emerald-500/25 text-emerald-400 opacity-100' : 'text-zinc-700 opacity-35'
            }`}
          >
            ➡
          </span>

          {headlightsMode !== 'off' && (
            <span
              className={`px-1 rounded text-[8px] font-mono font-bold uppercase ${
                headlightsMode === 'high'
                  ? 'bg-blue-500/25 text-blue-300'
                  : headlightsMode === 'low'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {headlightsMode === 'high' ? 'ALTO' : headlightsMode === 'low' ? 'BAIXO' : 'LANT'}
            </span>
          )}

          {fogLightsLit && (
            <span className="px-1 rounded bg-amber-500/25 text-[8px] font-mono font-bold text-amber-300">
              NEBL
            </span>
          )}

          {(hasTurbo || showAftermarketBoostGauge) && (
            <span className="px-1.5 py-px rounded-full bg-black/80 border border-amber-500/40 text-[8px] font-mono text-amber-300">
              TURBO <b>{boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR</b>
            </span>
          )}
        </div>
      )}

      {/* Manômetro Esportivo de Coluna Aftermarket [UPG] (desktop / veículos com kit instalado) */}
      {showPillarGaugePod && showAftermarketBoostGauge && viewMode === 'cluster' && (
        <div className="hidden sm:flex absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-20 animate-in zoom-in-95 duration-200">
          <AftermarketPillarGaugePod size={80} />
        </div>
      )}

      {/* Borboleta esquerda (redução) quando modo manual ativo no mobile */}
      {supportsPaddleShifters && isManualActive && (
        <div className="flex-shrink-0 mr-1 z-20 pointer-events-auto">
          <AutomaticShiftButton direction="down" />
        </div>
      )}

      <div className="flex-1 h-full min-w-0 flex items-center justify-center">
        {viewMode === 'cluster' ? (
          <VehicleDashboardCluster telemetry={telemetry} expanded={expanded} maxScale={maxScale} />
        ) : (
          <CockpitView telemetry={telemetry} vehicle={vehicle} />
        )}
      </div>

      {/* Borboleta direita (subida) quando modo manual ativo no mobile */}
      {supportsPaddleShifters && isManualActive && (
        <div className="flex-shrink-0 ml-1 z-20 pointer-events-auto">
          <AutomaticShiftButton direction="up" />
        </div>
      )}
    </div>
  )
})
