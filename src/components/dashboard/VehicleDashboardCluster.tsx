import { memo, useLayoutEffect, useRef, useState } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { ClusterView } from './ClusterView'
import { performanceMonitor } from '@/utils/performanceMonitor'

type ClusterProfile = { width: number; height: number }

/**
 * Perfis de referência (largura natural fixa de cada cluster + altura estimada).
 * A LARGURA é a referência real de layout; a ALTURA é apenas um valor inicial
 * (antes da primeira medição): a altura verdadeira é medida no DOM.
 */
export const CLUSTER_PROFILES: Record<DashboardTelemetry['theme'], ClusterProfile> = {
  civic_si: { width: 640, height: 335 },
  gti: { width: 790, height: 260 },
  classic: { width: 710, height: 265 },
  square_turbo: { width: 700, height: 270 },
  supercar: { width: 770, height: 268 },
  opala_classic: { width: 730, height: 248 },
  modern: { width: 750, height: 268 },
  motorcycle: { width: 500, height: 228 },
  default: { width: 750, height: 268 },
}

interface VehicleDashboardClusterProps {
  telemetry: DashboardTelemetry
  expanded?: boolean
}

/**
 * Painel original: escala garantida, estável e SEM recorte.
 * Causa do corte anterior: a escala era calculada com a altura estimada do perfil, mas o
 * cluster renderiza mais alto (ex.: Civic 457px vs 335px). Agora a altura natural real do
 * conteúdo é medida (ResizeObserver no elemento NÃO escalado) e usada no cálculo.
 */
export const VehicleDashboardCluster = memo(function VehicleDashboardCluster({
  telemetry,
  expanded = false,
}: VehicleDashboardClusterProps) {
  performanceMonitor.recordReactRender()
  const containerRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState({ width: 0, height: 0 })
  const profile = CLUSTER_PROFILES[telemetry.theme] ?? CLUSTER_PROFILES.default
  const [natural, setNatural] = useState<{ theme: string; height: number } | null>(null)

  // 1) Área realmente disponível (container visível)
  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return

    const update = () => {
      const w = Math.round(element.clientWidth)
      const h = Math.round(element.clientHeight)
      if (w > 0 && h > 0) {
        setBounds((prev) => {
          // Deadband de 2px para evitar oscilações de subpixel no DevTools/DPR fracionário
          if (Math.abs(prev.width - w) < 2 && Math.abs(prev.height - h) < 2) {
            return prev
          }
          return { width: w, height: h }
        })
      }
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [profile.width, telemetry.theme])

  // 2) Altura natural REAL do cluster (offsetHeight ignora transform: scale)
  useLayoutEffect(() => {
    const element = contentRef.current
    if (!element) return
    const theme = telemetry.theme

    const measure = () => {
      const h = Math.ceil(Math.max(element.offsetHeight, element.scrollHeight))
      if (h > 0) {
        setNatural((prev) => (prev && prev.theme === theme && Math.abs(prev.height - h) < 2 ? prev : { theme, height: h }))
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [telemetry.theme])

  const naturalWidth = profile.width
  const naturalHeight = natural && natural.theme === telemetry.theme ? natural.height : profile.height

  // Fallback seguro caso os bounds ainda não tenham sido medidos no primeiro tick síncrono
  const effectiveWidth =
    bounds.width > 0 ? bounds.width : typeof window !== 'undefined' ? window.innerWidth : 390
  const effectiveHeight =
    bounds.height > 0 ? bounds.height : typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.4) : 260

  const maxScale = expanded ? 1.6 : 1.35
  const rawScale = Math.min(maxScale, effectiveWidth / naturalWidth, effectiveHeight / naturalHeight)
  const scale = Math.floor(rawScale * 1000) / 1000

  return (
    <section
      ref={containerRef}
      aria-label="Painel de instrumentos original"
      className="relative flex h-full w-full min-h-0 flex-1 self-stretch items-center justify-center overflow-hidden"
    >
      <div
        className="relative shrink-0 will-change-transform"
        style={{ width: Math.floor(naturalWidth * scale), height: Math.floor(naturalHeight * scale) }}
      >
        <div
          ref={contentRef}
          className="absolute left-0 top-0 pointer-events-none"
          style={{ width: naturalWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <ClusterView telemetry={telemetry} />
        </div>
      </div>
    </section>
  )
})
