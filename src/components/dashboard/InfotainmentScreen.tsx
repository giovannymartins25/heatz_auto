import { memo } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { GolfGTIDiscoverPro, PorschePCM6, ToyotaSmartConnect } from './infotainment'

interface InfotainmentScreenProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  compact?: boolean
  className?: string
}

/**
 * InfotainmentScreen — Despachador das Centrais Multimídia Automotivas Inteligentes.
 *
 * Regras de Exibição:
 * - Carros clássicos/populares (ex: Gol G6) e Motocicletas (CB1000R): NÃO POSSUEM multimídia (retorna null).
 * - Porsche 911 (992): Central Porsche Communication Management PCM 6.0 com Track Precision, Lift e Aero ativo.
 * - Golf GTI Mk7: Central Volkswagen Discover Pro com Sport HMI, Climatronic Dual e Luz Ambiente.
 * - Toyota Yaris: Central Toyota Smart Connect com GR-FOUR AWD Monitor e Intercooler Water Spray.
 * - Todas com acesso a YouTube embutido, player de músicas online e controle de Ar-Condicionado.
 */
export const InfotainmentScreen = memo(function InfotainmentScreen({
  vehicle,
  telemetry,
  compact = false,
  className = '',
}: InfotainmentScreenProps) {
  // Verificar se o veículo possui multimídia de fábrica habilitada
  const hasInfotainment = vehicle.dashboard?.hasInfotainment ?? (
    vehicle.id !== 'gol-g6' &&
    vehicle.id !== 'cb1000r' &&
    vehicle.info.category !== 'motorcycle'
  )

  if (!hasInfotainment) {
    return null
  }

  const brand = vehicle.info.brand.toLowerCase()
  const name = vehicle.info.name.toLowerCase()
  const id = vehicle.id?.toLowerCase() || ''

  // 1. Porsche 911 (992)
  if (brand.includes('porsche') || name.includes('porsche') || id.includes('porsche')) {
    return (
      <PorschePCM6
        vehicle={vehicle}
        telemetry={telemetry}
        compact={compact}
        className={className}
      />
    )
  }

  // 2. Toyota Yaris (GR-FOUR / Toyota Smart Connect)
  if (brand.includes('toyota') || name.includes('yaris') || id.includes('yaris')) {
    return (
      <ToyotaSmartConnect
        vehicle={vehicle}
        telemetry={telemetry}
        compact={compact}
        className={className}
      />
    )
  }

  // 3. Volkswagen Golf GTI Mk7 (Discover Pro Sport HMI)
  return (
    <GolfGTIDiscoverPro
      vehicle={vehicle}
      telemetry={telemetry}
      compact={compact}
      className={className}
    />
  )
})
