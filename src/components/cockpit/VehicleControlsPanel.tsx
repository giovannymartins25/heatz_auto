/**
 * VehicleControlsPanel.tsx — Painel 3 do Cockpit Modular (Fase 4.3).
 *
 * Reutiliza `CabinControlsBar` (variant="panel") conectado diretamente à `useSimulationStore`
 * sem criar nenhum estado paralelo. Respeita integralmente `VehicleConfig.cabin` e
 * `VehicleConfig.ignition` (incluindo o cockpit de motocicleta da CB1000R sem A/C nem vidros).
 *
 * Nota: o suporte a toque secundário em multitouch já é fornecido pelos containers pais
 * (`CockpitPanelCarousel` / `DesktopCockpitLayout`), garantindo disparo único sem eventos duplicados.
 */

import { memo } from 'react'
import type { VehicleConfig } from '@/types'
import { CabinControlsBar } from '@/components/dashboard/CabinControlsBar'

export interface VehicleControlsPanelProps {
  vehicle: VehicleConfig
  className?: string
}

export const VehicleControlsPanel = memo(function VehicleControlsPanel({
  vehicle,
  className = '',
}: VehicleControlsPanelProps) {
  return (
    <div
      className={`relative flex h-full w-full min-h-0 overflow-hidden ${className}`}
      data-testid="cockpit-panel-controls"
    >
      <CabinControlsBar vehicle={vehicle} variant="panel" className="h-full w-full" />
    </div>
  )
})
