import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { ClusterView } from './ClusterView'

interface VehicleDashboardClusterProps {
  telemetry: DashboardTelemetry
  compact?: boolean
}

/** Mantém cada painel original encapsulado e escalado sem alterar sua telemetria. */
export const VehicleDashboardCluster = memo(function VehicleDashboardCluster({ telemetry, compact = false }: VehicleDashboardClusterProps) {
  return (
    <section aria-label="Painel de instrumentos original" className={`flex w-full items-center justify-center overflow-hidden ${compact ? 'max-h-[27vh]' : 'max-h-[42vh]'}`}>
      <div className={`${compact ? 'scale-[0.42] xs:scale-[0.5]' : 'scale-[0.5] xs:scale-[0.6] sm:scale-[0.72]'} origin-center pointer-events-none`}>
        <ClusterView telemetry={telemetry} />
      </div>
    </section>
  )
})
