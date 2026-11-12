import { memo } from 'react'
import type { VehicleConfig } from '@/types'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { InfotainmentScreen } from './InfotainmentScreen'

interface InfotainmentOverlayProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  isOpen: boolean
  onClose: () => void
}

/** Contêiner sobreposto para a central existente, sem substituir o cluster. */
export const InfotainmentOverlay = memo(function InfotainmentOverlay({ vehicle, telemetry, isOpen, onClose }: InfotainmentOverlayProps) {
  if (!isOpen) return null
  return (
    <aside className="absolute inset-x-3 bottom-3 z-30 flex justify-center" aria-label="Central multimídia">
      <div className="relative max-w-full rounded-3xl border border-white/15 bg-black/90 p-1 shadow-2xl backdrop-blur">
        <button type="button" onClick={onClose} className="absolute right-2 top-2 z-10 min-h-8 min-w-8 rounded-full bg-zinc-800 text-xs text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300" aria-label="Fechar multimídia">×</button>
        <InfotainmentScreen vehicle={vehicle} telemetry={telemetry} compact />
      </div>
    </aside>
  )
})
