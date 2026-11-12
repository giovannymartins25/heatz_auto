import { memo, useLayoutEffect, useRef, useState } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { ClusterView } from './ClusterView'

type ClusterProfile = { width: number; height: number }

const CLUSTER_PROFILES: Record<DashboardTelemetry['theme'], ClusterProfile> = {
  civic_si: { width: 780, height: 500 }, gti: { width: 900, height: 500 }, classic: { width: 860, height: 520 },
  square_turbo: { width: 780, height: 560 }, supercar: { width: 930, height: 520 }, opala_classic: { width: 760, height: 570 },
  modern: { width: 900, height: 520 }, motorcycle: { width: 600, height: 380 }, default: { width: 860, height: 520 },
}

interface VehicleDashboardClusterProps { telemetry: DashboardTelemetry }

/** Preserva a área real do painel: a caixa reservada acompanha a escala, sem recorte. */
export const VehicleDashboardCluster = memo(function VehicleDashboardCluster({ telemetry }: VehicleDashboardClusterProps) {
  const containerRef = useRef<HTMLElement>(null)
  const [bounds, setBounds] = useState({ width: 0, height: 0 })
  const profile = CLUSTER_PROFILES[telemetry.theme] ?? CLUSTER_PROFILES.default

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => setBounds({ width: element.clientWidth, height: element.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const scale = bounds.width && bounds.height ? Math.min(1, bounds.width / profile.width, bounds.height / profile.height) : 0.01
  return (
    <section ref={containerRef} aria-label="Painel de instrumentos original" className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-visible">
      <div className="relative shrink-0" style={{ width: profile.width * scale, height: profile.height * scale }}>
        <div className="absolute left-0 top-0 pointer-events-none" style={{ width: profile.width, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <ClusterView telemetry={telemetry} />
        </div>
      </div>
    </section>
  )
})
