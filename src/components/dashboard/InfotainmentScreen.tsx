import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types/vehicle'
import { VehicleMultimedia } from './infotainment/VehicleMultimedia'
import { useSecondaryTouchTapBridge } from '@/utils/multitouchBridge'

interface InfotainmentScreenProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  /** Mantido por compatibilidade: a central sempre preenche 100% do container pai. */
  compact?: boolean
  /** true: preenche 100% do container pai posicionado (slot do cockpit). */
  fill?: boolean
  className?: string
}

/**
 * InfotainmentScreen — central multimídia única que ocupa integralmente o retângulo do painel.
 * Inclui ponte de multitouch secundário para que todos os botões da multimídia respondam
 * simultaneamente enquanto o motorista mantém o acelerador ou freio pressionado.
 */
export const InfotainmentScreen = memo(function InfotainmentScreen({
  vehicle,
  telemetry,
  fill = false,
  className = '',
}: InfotainmentScreenProps) {
  const secondaryTouchHandlers = useSecondaryTouchTapBridge()
  return (
    <div
      className={fill ? 'w-full h-full flex items-center justify-center' : 'contents'}
      style={{ touchAction: 'manipulation' }}
      {...secondaryTouchHandlers}
    >
      <VehicleMultimedia vehicle={vehicle} telemetry={telemetry} fill={fill} className={className} />
    </div>
  )
})
