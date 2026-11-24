/**
 * cockpitPanels.ts — Lógica pura de descoberta e validação dos painéis do cockpit modular (Fase 4.3).
 *
 * Responsabilidades:
 * - Determinar quais painéis estão disponíveis para um dado `VehicleConfig`,
 *   respeitando estritamente os contratos declarativos (`multimedia`, `cabin`, `info.category`).
 * - Adaptar rótulos do Painel 2 conforme o equipamento real do veículo:
 *   · Multimídia de fábrica ou aftermarket → "Mídia"
 *   · Rádio 1-DIN clássico (Gol G6, Opala) → "Rádio"
 *   · Console analógico original sem rádio (Gol Quadrado) → "Console"
 *   · Motocicleta (CB1000R) → Painel 2 omitido (sem multimídia automotiva)
 * - Garantir que redimensionamentos preservem o painel ativo e que trocas de veículo
 *   nunca mantenham uma seleção inválida.
 */

import type { VehicleConfig } from '@/types/vehicle'
import type { CockpitPanelId, DesktopSecondaryPanelId } from '@/stores/useUIStore'
import { resolveVehicleMultimediaSpec } from '@/systems/vehicle/vehicleResolvers'

export interface CockpitPanelDescriptor {
  id: CockpitPanelId
  label: string
  shortLabel: string
  icon: string
  accentClass: string
}

export function getAvailableCockpitPanels(
  vehicle: VehicleConfig,
  upgrades?: { multimediaKit?: boolean } | null,
): CockpitPanelDescriptor[] {
  const isMotorcycle = vehicle.info.category === 'motorcycle'
  const mediaSpec = resolveVehicleMultimediaSpec(vehicle, upgrades)

  const panels: CockpitPanelDescriptor[] = [
    {
      id: 'cluster',
      label: isMotorcycle ? 'Painel TFT' : 'Instrumentos',
      shortLabel: 'PAINEL',
      icon: '📟',
      accentClass: 'bg-amber-400',
    },
  ]

  // Painel 2: Multimídia / Rádio / Console — omitido exclusivamente em motocicletas
  if (!isMotorcycle && mediaSpec.unitId !== 'none') {
    const isRadio = mediaSpec.type === 'radio'
    const isBlankConsole = mediaSpec.type === 'none'
    panels.push({
      id: 'multimedia',
      label: isRadio ? 'Rádio 1-DIN' : isBlankConsole ? 'Console' : 'Multimídia',
      shortLabel: isRadio ? 'RÁDIO' : isBlankConsole ? 'CONSOLE' : 'MÍDIA',
      icon: isRadio ? '📻' : isBlankConsole ? '🎛️' : '📺',
      accentClass: 'bg-cyan-400',
    })
  }

  // Painel 3: Controles do veículo (adaptado declarativamente por VehicleCabinSpec + VehicleIgnitionSpec)
  panels.push({
    id: 'controls',
    label: isMotorcycle ? 'Comandos Moto' : 'Controles',
    shortLabel: 'CONTROLES',
    icon: isMotorcycle ? '🏍️' : '🎛️',
    accentClass: 'bg-emerald-400',
  })

  return panels
}

/**
 * Valida o painel selecionado para o veículo atual.
 * Caso o veículo não disponha do painel anteriormente selecionado (ex.: trocar de Golf GTI em
 * `'multimedia'` para CB1000R), retorna de forma segura para `'cluster'`.
 */
export function resolveValidCockpitPanel(
  current: CockpitPanelId,
  vehicle: VehicleConfig,
  upgrades?: { multimediaKit?: boolean } | null,
): CockpitPanelId {
  const available = getAvailableCockpitPanels(vehicle, upgrades)
  if (available.some((p) => p.id === current)) {
    return current
  }
  return 'cluster'
}

/**
 * Valida o painel secundário do layout desktop (`'multimedia'` ou `'controls'`).
 * Para motocicletas (sem painel multimídia), força `'controls'`.
 */
export function resolveValidDesktopSecondaryPanel(
  current: DesktopSecondaryPanelId,
  vehicle: VehicleConfig,
  upgrades?: { multimediaKit?: boolean } | null,
): DesktopSecondaryPanelId {
  const available = getAvailableCockpitPanels(vehicle, upgrades)
  const hasMultimedia = available.some((p) => p.id === 'multimedia')
  if (!hasMultimedia) {
    return 'controls'
  }
  return current
}
