import { memo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useVehicleStore } from '@/stores/useVehicleStore'
import type { VehicleConfig } from '@/types'
import { AnalogPedal } from './AnalogPedal'
import { ClutchControl } from './ClutchControl'

export interface PedalsProps {
  vehicle?: VehicleConfig | null
}

/**
 * Pedals — Conjunto de controles analógicos interativos de aceleração, frenagem e embreagem.
 *
 * Utiliza PointerEvents com leitura contínua de 0% a 100%:
 * - Acelerador e Freio analógicos com retorno suave a 0%
 * - Embreagem analógica com zona de atrito/slip (automática para veículos manuais)
 * - Veículos automáticos (como o Yaris CVT) não exibem embreagem
 * - Motocicletas exibem manete ergonômica de guidão
 */
export const Pedals = memo(function Pedals({ vehicle: propVehicle }: PedalsProps) {
  const storeVehicle = useVehicleStore((s) => s.selectedVehicle)
  const vehicle = propVehicle || storeVehicle

  const throttle = useSimulationStore((s) => s.throttle)
  const brake = useSimulationStore((s) => s.brake)
  const clutchPosition = useSimulationStore((s) => s.clutchPosition)

  const setThrottle = useSimulationStore((s) => s.setThrottle)
  const setBrake = useSimulationStore((s) => s.setBrake)
  const setClutch = useSimulationStore((s) => s.setClutch)
  const isRunning = useSimulationStore((s) => s.isRunning)

  const hasClutch = vehicle?.transmission.hasClutch ?? false
  const category = vehicle?.info.category ?? 'car'
  const isMotorcycle = category === 'motorcycle'

  return (
    <div className="flex flex-col items-center w-full max-w-sm px-2 select-none touch-none">
      {/* Manete de Embreagem para Motocicletas */}
      {hasClutch && isMotorcycle && (
        <ClutchControl
          category="motorcycle"
          value={clutchPosition}
          onChange={setClutch}
          disabled={!isRunning}
        />
      )}

      {/* Conjunto de Pedais Inferiores */}
      <div className="flex items-end justify-center gap-5 sm:gap-7 w-full">
        {/* Pedal de Embreagem (Apenas para Carros Manuais) */}
        {hasClutch && !isMotorcycle && (
          <ClutchControl
            category="car"
            value={clutchPosition}
            onChange={setClutch}
            disabled={!isRunning}
          />
        )}

        {/* Pedal do Freio (0-100%) */}
        <AnalogPedal
          label="FREIO"
          sublabel="BRAKE"
          value={brake}
          onChange={setBrake}
          colorTheme="red"
          widthClass="w-16"
          heightClass="h-44"
          disabled={!isRunning}
          showPercent={true}
        />

        {/* Pedal do Acelerador (0-100%) */}
        <AnalogPedal
          label="RUN"
          sublabel="ACEL."
          value={throttle}
          onChange={setThrottle}
          colorTheme="accent"
          widthClass="w-14"
          heightClass="h-44"
          disabled={!isRunning}
          showPercent={true}
        />
      </div>
    </div>
  )
})
