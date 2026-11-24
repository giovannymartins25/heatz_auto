/**
 * multimediaRegistry.ts — Registro dedicado de unidades multimídia/áudio.
 *
 * Responsabilidade única:
 * - Mapear `MultimediaUnitId` para seu componente React dedicado.
 * - Fornecer fallback explícito (`generic_multimedia`) para unidades desconhecidas e `null` para `'none'`.
 * - Eliminar cascatas `if (vehicle.id === ...)` dentro de `VehicleMultimedia.tsx`.
 */

import type { ComponentType } from 'react'
import type { MultimediaUnitId, VehicleConfig } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { FiatToroUconnect7 } from './FiatToroUconnect7'
import { FiatToroUconnectVertical } from './FiatToroUconnectVertical'
import { PorschePCM6 } from './PorschePCM6'
import { GolfGTIDiscoverPro } from './GolfGTIDiscoverPro'
import { JettaDiscoverMedia8 } from './JettaDiscoverMedia8'
import { BMWiDrive8Curved } from './BMWiDrive8Curved'
import { FordPampa1997RadioUnit } from './FordPampa1997RadioUnit'
import { FordSync1Console2012 } from './FordSync1Console2012'
import { FordSync3Titanium8 } from './FordSync3Titanium8'
import { CivicSiInfotainment } from './CivicSiInfotainment'
import { ToyotaSmartConnect } from './ToyotaSmartConnect'
import { Retrofit2DinInfotainment } from './Retrofit2DinInfotainment'
import { ClassicRadioAudioUnit } from './ClassicRadioAudioUnit'
import { ClassicDashboardBlankUnit } from './ClassicDashboardBlankUnit'

export interface MultimediaComponentProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  className?: string
  fill?: boolean
}

export interface MultimediaRegistryEntry {
  unitId: Exclude<MultimediaUnitId, 'none'>
  label: string
  component: ComponentType<MultimediaComponentProps> | 'generic'
}

export const MULTIMEDIA_REGISTRY: Readonly<
  Record<Exclude<MultimediaUnitId, 'none'>, MultimediaRegistryEntry>
> = {
  toro_uconnect_7: {
    unitId: 'toro_uconnect_7',
    label: 'Fiat Uconnect 7"',
    component: FiatToroUconnect7,
  },
  toro_uconnect_10_vertical: {
    unitId: 'toro_uconnect_10_vertical',
    label: 'Fiat Uconnect 10.1" Vertical',
    component: FiatToroUconnectVertical,
  },
  porsche_pcm6: {
    unitId: 'porsche_pcm6',
    label: 'Porsche PCM 6.0',
    component: PorschePCM6,
  },
  vw_discover_pro: {
    unitId: 'vw_discover_pro',
    label: 'VW Discover Pro 8"',
    component: GolfGTIDiscoverPro,
  },
  vw_discover_media_8: {
    unitId: 'vw_discover_media_8',
    label: 'VW Discover Media 8" MIB',
    component: JettaDiscoverMedia8,
  },
  bmw_idrive8_curved: {
    unitId: 'bmw_idrive8_curved',
    label: 'BMW Curved Display 14.9" (OS 8)',
    component: BMWiDrive8Curved,
  },
  ford_pampa_radio_1din: {
    unitId: 'ford_pampa_radio_1din',
    label: 'Rádio Ford FIC Sound 1-DIN (1997)',
    component: FordPampa1997RadioUnit,
  },
  ford_sync1_2012: {
    unitId: 'ford_sync1_2012',
    label: 'Ford SYNC 1 Console 2012',
    component: FordSync1Console2012,
  },
  ford_sync3_8: {
    unitId: 'ford_sync3_8',
    label: 'Ford SYNC 3 Touchscreen 8" (2019)',
    component: FordSync3Titanium8,
  },
  toyota_smart_connect: {
    unitId: 'toyota_smart_connect',
    label: 'Toyota Smart Connect 7"',
    component: ToyotaSmartConnect,
  },
  honda_haudio: {
    unitId: 'honda_haudio',
    label: 'Honda H-Audio 2-DIN',
    component: CivicSiInfotainment,
  },
  retrofit_2din: {
    unitId: 'retrofit_2din',
    label: 'Central 2-DIN Heatz Performance',
    component: Retrofit2DinInfotainment,
  },
  classic_radio_1din: {
    unitId: 'classic_radio_1din',
    label: 'Rádio Clássico 1-DIN',
    component: ClassicRadioAudioUnit,
  },
  classic_blank_console: {
    unitId: 'classic_blank_console',
    label: 'Console Original Sem Rádio',
    component: ClassicDashboardBlankUnit as ComponentType<MultimediaComponentProps>,
  },
  generic_multimedia: {
    unitId: 'generic_multimedia',
    label: 'Central Multimídia Genérica',
    component: 'generic',
  },
}

/**
 * Resolve o registro de multimídia pelo `unitId`.
 * Retorna `null` apenas quando `unitId === 'none'` (ex.: motocicletas).
 * Para qualquer `unitId` desconhecido, faz fallback explícito para `generic_multimedia`.
 */
export function resolveMultimediaEntry(
  unitId: MultimediaUnitId | string,
): MultimediaRegistryEntry | null {
  if (unitId === 'none') {
    return null
  }
  if (unitId in MULTIMEDIA_REGISTRY) {
    return MULTIMEDIA_REGISTRY[unitId as Exclude<MultimediaUnitId, 'none'>]
  }
  return MULTIMEDIA_REGISTRY.generic_multimedia
}
