import { memo } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { VehicleMultimedia } from './infotainment/VehicleMultimedia'

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
 * (Fase 1.5.1) Substitui os quadrados com dimensões próprias por um layout fluido:
 * barra de status + conteúdo da aba ativa + barra de navegação inferior.
 */
export const InfotainmentScreen = memo(function InfotainmentScreen({
  vehicle,
  telemetry,
  fill = false,
  className = '',
}: InfotainmentScreenProps) {
  return <VehicleMultimedia vehicle={vehicle} telemetry={telemetry} fill={fill} className={className} />
})
