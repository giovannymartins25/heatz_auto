/**
 * MultimediaPanel.tsx — Painel 2 do Cockpit Modular (Fase 4.3).
 *
 * Reutiliza `InfotainmentScreen` -> `VehicleMultimedia` -> `MULTIMEDIA_REGISTRY`,
 * preservando integralmente a unidade específica de cada veículo (PCM 6.0, Discover Pro,
 * Uconnect 7"/10.1", Toyota Smart Connect, Honda H-Audio, Rádio 1-DIN, Console Clássico
 * ou Retrofit 2-DIN quando instalado na oficina).
 */

import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import { InfotainmentScreen } from '@/components/dashboard/InfotainmentScreen'

export interface MultimediaPanelProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  className?: string
}

export const MultimediaPanel = memo(function MultimediaPanel({
  vehicle,
  telemetry,
  className = '',
}: MultimediaPanelProps) {
  if (vehicle.info.category === 'motorcycle') {
    return null
  }

  return (
    <div
      className={`relative flex h-full w-full min-h-0 items-center justify-center overflow-hidden ${className}`}
      data-testid="cockpit-panel-multimedia"
    >
      <InfotainmentScreen vehicle={vehicle} telemetry={telemetry} fill />
    </div>
  )
})
