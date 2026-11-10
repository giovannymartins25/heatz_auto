import { useSimulationStore } from '@/stores/useSimulationStore'
import { useGarageStore } from '@/stores/useGarageStore'
import type { DashboardTheme, VehicleConfig } from '@/types/vehicle'

/** Temas de painel cujo quadro de instrumentos de fábrica já exibe a pressão do turbo */
const FACTORY_BOOST_THEMES: DashboardTheme[] = ['gti', 'supercar', 'square_turbo']

/** Carros que saem de fábrica SEM central multimídia */
export function hasFactoryInfotainment(vehicle: VehicleConfig): boolean {
  return (
    vehicle.dashboard?.hasInfotainment ??
    (vehicle.id !== 'gol-g6' &&
      vehicle.id !== 'gol-quadrado-turbo' &&
      vehicle.id !== 'opala-4100' &&
      vehicle.id !== 'cb1000r' &&
      vehicle.info.category !== 'motorcycle')
  )
}

/** Quadro de instrumentos de fábrica já possui manômetro de turbo? */
export function hasFactoryBoostDisplay(theme?: DashboardTheme | string): boolean {
  return FACTORY_BOOST_THEMES.includes(theme as DashboardTheme)
}

/** Motos não recebem acessórios de interior (multimídia / manômetro de coluna) */
export function supportsInteriorAccessories(vehicle: VehicleConfig): boolean {
  return vehicle.info.category !== 'motorcycle'
}

/**
 * useInteriorAccessories — decide o que aparece no interior do carro:
 * equipamento de fábrica + acessórios comprados na Loja de Peças da unidade pilotada.
 */
export function useInteriorAccessories(vehicle: VehicleConfig) {
  const activeCar = useGarageStore((s) => s.resolveInstanceForVehicle(vehicle.id))
  const storeRetrofit = useSimulationStore((s) => s.hasRetrofitInfotainment)
  const storeBoostGauge = useSimulationStore((s) => s.hasBoostGaugeKit)
  const storeTurbo = useSimulationStore((s) => s.hasTurbo)

  const hasRetrofitInfotainment = Boolean(activeCar?.upgrades?.multimediaKit || storeRetrofit)
  const hasBoostGaugeKit = Boolean(activeCar?.upgrades?.boostGaugeKit || storeBoostGauge)
  const hasTurbo = Boolean(vehicle.engine.turbo?.enabled || activeCar?.upgrades?.turboKit || storeTurbo)

  const supportsAccessories = supportsInteriorAccessories(vehicle)
  const factoryInfotainment = hasFactoryInfotainment(vehicle)
  const factoryBoost = hasFactoryBoostDisplay(vehicle.dashboard?.theme)

  const isRetrofitInfotainment = !factoryInfotainment && supportsAccessories && hasRetrofitInfotainment
  const hasInfotainment = factoryInfotainment || isRetrofitInfotainment

  // Manômetro aftermarket só aparece em carros cujo painel original não mostra o turbo
  // Ativado se o jogador comprou o Manômetro de Coluna OU se colocou Kit Turbo num carro sem manômetro original
  const showAftermarketBoostGauge = supportsAccessories && !factoryBoost && (hasBoostGaugeKit || hasTurbo)
  // Algum manômetro visível no interior (fábrica com turbo, ou acessório instalado)
  const showAnyBoostGauge = (factoryBoost && hasTurbo) || showAftermarketBoostGauge

  return {
    hasInfotainment,
    factoryInfotainment,
    isRetrofitInfotainment,
    factoryBoost,
    showAftermarketBoostGauge,
    showAnyBoostGauge,
  }
}

