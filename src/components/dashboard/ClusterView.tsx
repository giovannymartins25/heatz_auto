import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { resolveClusterEntry } from './clusters/clusterRegistry'

interface ClusterViewProps {
  telemetry: DashboardTelemetry
}

/**
 * ClusterView — Componente modular de painel de instrumentos (Instrument Cluster).
 *
 * Resolve o componente do painel declarativamente via `CLUSTER_REGISTRY`
 * (com fallback explícito para o cluster clássico).
 */
export const ClusterView = memo(function ClusterView({ telemetry }: ClusterViewProps) {
  const { component: ClusterComponent } = resolveClusterEntry(telemetry.theme)
  return <ClusterComponent telemetry={telemetry} />
})
