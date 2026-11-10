import { memo } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useGarageStore } from '@/stores/useGarageStore'
import { GolfGTIDiscoverPro, PorschePCM6, ToyotaSmartConnect, CivicSiInfotainment, Retrofit2DinInfotainment } from './infotainment'

interface InfotainmentScreenProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  compact?: boolean
  className?: string
}

/**
 * InfotainmentScreen — Despachador das Centrais Multimídia Automotivas Inteligentes.
 *
 * Suporte completo:
 * - Honda Civic Si: Central H-Audio / Pioneer 2-DIN com VTEC Telemetry, A/C digital e YouTube
 * - Porsche 911 (992): Central Porsche Communication Management PCM 6.0 com Track Precision, Lift e Aero ativo
 * - Golf GTI Mk7: Central Volkswagen Discover Pro com Sport HMI, Climatronic Dual e Luz Ambiente
 * - Toyota Yaris: Central Toyota Smart Connect com GR-FOUR AWD Monitor e Intercooler Water Spray
 * - Carros com Kit Multimídia 2-DIN Retrofit instalado pela Loja de Peças (ex: Gol G6 ou Gol Quadrado preparado)
 */
export const InfotainmentScreen = memo(function InfotainmentScreen({
  vehicle,
  telemetry,
  compact = false,
  className = '',
}: InfotainmentScreenProps) {
  const activeCar = useGarageStore((s) => s.resolveInstanceForVehicle(vehicle.id))
  const storeRetrofit = useSimulationStore((s) => s.hasRetrofitInfotainment)
  const hasRetrofitInfotainment = Boolean(activeCar?.upgrades?.multimediaKit || storeRetrofit)

  // Verificar se o veículo possui multimídia de fábrica habilitada ou instalada pela Loja de Peças
  const hasInfotainment =
    hasRetrofitInfotainment ||
    vehicle.dashboard?.hasInfotainment ||
    (vehicle.id !== 'gol-g6' &&
      vehicle.id !== 'gol-quadrado-turbo' &&
      vehicle.id !== 'cb1000r' &&
      vehicle.info.category !== 'motorcycle')

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

  // 2. Honda Civic Si
  if (brand.includes('honda') || name.includes('civic') || id.includes('civic')) {
    return (
      <CivicSiInfotainment
        vehicle={vehicle}
        telemetry={telemetry}
        compact={compact}
        className={className}
      />
    )
  }

  // 3. Toyota Yaris (GR-FOUR / Toyota Smart Connect)
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

  // 4. Volkswagen Golf GTI Mk7 (Discover Pro Sport HMI)
  if (id.includes('golf') || name.includes('golf') || name.includes('gti')) {
    return (
      <GolfGTIDiscoverPro
        vehicle={vehicle}
        telemetry={telemetry}
        compact={compact}
        className={className}
      />
    )
  }

  // 5. Central Multimídia 2-DIN Retrofit para demais modelos (Gol G6, Gol Quadrado, etc.)
  return (
    <Retrofit2DinInfotainment
      vehicle={vehicle}
      telemetry={telemetry}
      compact={compact}
      className={className}
    />
  )
})
