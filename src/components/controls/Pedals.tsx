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

  const hasClutch = vehicle?.transmission.hasClutch ?? false
  const category = vehicle?.info.category ?? 'car'
  const isMotorcycle = category === 'motorcycle'

  return (
    <div
      data-testid="pedal-slots-grid"
      className="grid grid-cols-[56px_64px_56px] items-end gap-5 w-[216px] flex-shrink-0 select-none touch-none"
    >
      {/* Slot 1 fixo (56px): Embreagem / Manete ou Slot Vazio reservado (FREIO e ACEL nunca mudam de posição) */}
      <div data-testid="pedal-slot-clutch" className="w-[56px] flex items-end justify-center">
        {hasClutch ? (
          <ClutchControl
            category={category}
            value={clutchPosition}
            onChange={setClutch}
            disabled={false}
            compactSlot={true}
          />
        ) : (
          <div aria-hidden="true" className="flex flex-col items-center justify-end pointer-events-none opacity-0">
            <span className="mb-1 text-[7.5px] font-mono font-bold px-1 py-0.5 rounded border leading-none">
              Acoplada
            </span>
            <div className="w-14 h-28 xl:h-36" />
          </div>
        )}
      </div>

      {/* Slot 2 fixo (64px): Pedal do Freio (0-100%) */}
      <div data-testid="pedal-slot-brake" className="w-[64px] flex items-end justify-center">
        <AnalogPedal
          label={isMotorcycle ? 'F. TRAS' : 'FREIO'}
          sublabel={isMotorcycle ? 'TRASEIRO' : 'BRAKE'}
          value={brake}
          onChange={setBrake}
          colorTheme="red"
          widthClass="w-16"
          heightClass="h-28 xl:h-36"
          disabled={false}
          showPercent={true}
        />
      </div>

      {/* Slot 3 fixo (56px): Pedal do Acelerador (0-100%) */}
      <div data-testid="pedal-slot-throttle" className="w-[56px] flex items-end justify-center">
        <AnalogPedal
          label="RUN"
          sublabel="ACEL."
          value={throttle}
          onChange={setThrottle}
          colorTheme="accent"
          widthClass="w-14"
          heightClass="h-28 xl:h-36"
          disabled={false}
          showPercent={true}
        />
      </div>
    </div>
  )
})
