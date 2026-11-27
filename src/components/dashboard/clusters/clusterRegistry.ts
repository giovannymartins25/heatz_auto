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
  JettaGLIActiveInfoCluster,
  BMW320iCurvedCluster,
  FordPampa1997Cluster,
  FordFusion2012IceCluster,
  FordFusion2019SmartGaugeCluster,
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
    label: 'Porsche 911 Turbo S (992.1) Tacômetro Central',
    component: Porsche992GT3RealCluster,
    profile: { width: 770, height: 268 },
  },
  gti: {
    theme: 'gti',
    label: 'VW Golf GTI Mk7',
    component: GolfGTIRealCluster,
    profile: { width: 790, height: 260 },
  },
  jetta_gli_aid: {
    theme: 'jetta_gli_aid',
    label: 'VW Jetta GLI Active Info Display 10.25"',
    component: JettaGLIActiveInfoCluster,
    profile: { width: 760, height: 258 },
  },
  bmw_curved_msport: {
    theme: 'bmw_curved_msport',
    label: 'BMW 320i Live Cockpit M Sport 12.3"',
    component: BMW320iCurvedCluster,
    profile: { width: 770, height: 256 },
  },
  ford_pampa_1997: {
    theme: 'ford_pampa_1997',
    label: 'Ford Pampa L 1.8i Analógico 1997',
    component: FordPampa1997Cluster,
    profile: { width: 720, height: 254 },
  },
  ford_fusion_2012_ice: {
    theme: 'ford_fusion_2012_ice',
    label: 'Ford Fusion SEL 2012 Ice Blue',
    component: FordFusion2012IceCluster,
    profile: { width: 760, height: 256 },
  },
  ford_fusion_2019_smartgauge: {
    theme: 'ford_fusion_2019_smartgauge',
    label: 'Ford Fusion Titanium 2019 SmartGauge Dual TFT',
    component: FordFusion2019SmartGaugeCluster,
    profile: { width: 770, height: 256 },
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
