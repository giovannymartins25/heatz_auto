import { memo, useLayoutEffect, useRef, useState } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { ClusterView } from './ClusterView'

type ClusterProfile = { width: number; height: number }

const CLUSTER_PROFILES: Record<DashboardTelemetry['theme'], ClusterProfile> = {
  civic_si: { width: 780, height: 480 },
  gti: { width: 880, height: 420 },
  classic: { width: 860, height: 420 },
  square_turbo: { width: 800, height: 480 },
  supercar: { width: 920, height: 420 },
  opala_classic: { width: 780, height: 460 },
  modern: { width: 880, height: 420 },
  motorcycle: { width: 600, height: 360 },
  default: { width: 860, height: 440 },
}

interface VehicleDashboardClusterProps {
  telemetry: DashboardTelemetry
  expanded?: boolean
}

/** Preserva a área real do painel: escala garantida e estável sem recorte e sem colapso vertical. */
export const VehicleDashboardCluster = memo(function VehicleDashboardCluster({
  telemetry,
  expanded = false,
}: VehicleDashboardClusterProps) {
  const containerRef = useRef<HTMLElement>(null)
  const [bounds, setBounds] = useState({ width: 0, height: 0 })
  const profile = CLUSTER_PROFILES[telemetry.theme] ?? CLUSTER_PROFILES.default

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return

    const update = () => {
      const w = element.clientWidth
      const h = element.clientHeight
      if (w > 0 && h > 0) {
        setBounds({ width: w, height: h })
      }
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [profile.width, telemetry.theme])

  // Fallback seguro caso os bounds ainda não tenham sido medidos no primeiro tick síncrono
  const effectiveWidth =
    bounds.width > 0 ? bounds.width : typeof window !== 'undefined' ? window.innerWidth : 390
  const effectiveHeight =
    bounds.height > 0 ? bounds.height : typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.4) : 260

  const maxScale = expanded ? 1.4 : 1.15
  const scale = Math.min(maxScale, effectiveWidth / profile.width, effectiveHeight / profile.height)

  return (
    <section
      ref={containerRef}
      aria-label="Painel de instrumentos original"
      className="relative flex h-full w-full min-h-0 flex-1 self-stretch items-center justify-center overflow-visible"
    >
      <div
        className="relative shrink-0 transition-transform duration-150"
        style={{ width: profile.width * scale, height: profile.height * scale }}
      >
        <div
          className="absolute left-0 top-0 pointer-events-none"
          style={{ width: profile.width, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <ClusterView telemetry={telemetry} />
        </div>
      </div>
    </section>
  )
})
