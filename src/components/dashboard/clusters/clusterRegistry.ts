/**
 * clusterRegistry.ts — Registro dedicado de painéis de instrumentos (Instrument Clusters).
 *
 * Responsabilidade única:
 * - Associar cada `DashboardTheme` ao seu componente React e perfil dimensional natural.
 * - Fornecer fallback explícito (`classic` / GolG6RealCluster) para temas desconhecidos.
 * - Eliminando duplicação entre `ClusterView.tsx` e `VehicleDashboardCluster.tsx`.
 */

import type { ComponentType } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { DashboardTheme } from '@/types/vehicle'
import {
  GolG6RealCluster,
  ToyotaYarisRealCluster,
  HondaCB1000RRealCluster,
  Porsche992GT3RealCluster,
  GolfGTIRealCluster,
  GolQuadradoRealCluster,
  CivicSiRealCluster,
  Opala4100RealCluster,
  FiatToroEnduranceCluster,
  FiatToroRanchCluster,
} from './index'

export interface ClusterProfile {
  width: number
  height: number
}

export interface ClusterRegistryEntry {
  theme: DashboardTheme
  label: string
  component: ComponentType<{ telemetry: DashboardTelemetry }>
  profile: ClusterProfile
}

export const CLUSTER_REGISTRY: Readonly<Record<DashboardTheme, ClusterRegistryEntry>> = {
  classic: {
    theme: 'classic',
    label: 'VW Gol G6 Analógico Clássico',
    component: GolG6RealCluster,
    profile: { width: 710, height: 265 },
  },
  modern: {
    theme: 'modern',
    label: 'Toyota Yaris Optitron 3D',
    component: ToyotaYarisRealCluster,
    profile: { width: 750, height: 268 },
  },
  motorcycle: {
    theme: 'motorcycle',
    label: 'Honda CB1000R TFT 5"',
    component: HondaCB1000RRealCluster,
    profile: { width: 500, height: 228 },
  },
  supercar: {
    theme: 'supercar',
    label: 'Porsche 911 (992) Tacômetro Central',
    component: Porsche992GT3RealCluster,
    profile: { width: 770, height: 268 },
  },
  gti: {
    theme: 'gti',
    label: 'VW Golf GTI Mk7',
    component: GolfGTIRealCluster,
    profile: { width: 790, height: 260 },
  },
  square_turbo: {
    theme: 'square_turbo',
    label: 'VW Gol Quadrado AP Turbo + AutoMeter',
    component: GolQuadradoRealCluster,
    profile: { width: 700, height: 270 },
  },
  civic_si: {
    theme: 'civic_si',
    label: 'Honda Civic Si K20 Multiplex',
    component: CivicSiRealCluster,
    profile: { width: 640, height: 335 },
  },
  opala_classic: {
    theme: 'opala_classic',
    label: 'Chevrolet Opala 4.1 Clássico',
    component: Opala4100RealCluster,
    profile: { width: 730, height: 248 },
  },
  toro_endurance: {
    theme: 'toro_endurance',
    label: 'Fiat Toro Endurance T270',
    component: FiatToroEnduranceCluster,
    profile: { width: 750, height: 268 },
  },
  toro_ranch: {
    theme: 'toro_ranch',
    label: 'Fiat Toro Ranch 4x4 AT9',
    component: FiatToroRanchCluster,
    profile: { width: 750, height: 268 },
  },
  default: {
    theme: 'default',
    label: 'Painel Padrão Heatz',
    component: GolG6RealCluster,
    profile: { width: 750, height: 268 },
  },
}

/**
 * Resolve uma entrada de cluster pelo tema com fallback explícito e seguro.
 */
export function resolveClusterEntry(theme?: DashboardTheme | string): ClusterRegistryEntry {
  if (theme && theme in CLUSTER_REGISTRY) {
    return CLUSTER_REGISTRY[theme as DashboardTheme]
  }
  return CLUSTER_REGISTRY.classic
}
