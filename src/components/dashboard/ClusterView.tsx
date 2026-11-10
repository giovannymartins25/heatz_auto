import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import {
  GolG6RealCluster,
  ToyotaYarisRealCluster,
  HondaCB1000RRealCluster,
  Porsche992GT3RealCluster,
  GolfGTIRealCluster,
  GolQuadradoRealCluster,
  CivicSiRealCluster,
} from './clusters'

interface ClusterViewProps {
  telemetry: DashboardTelemetry
}

/**
 * ClusterView — Componente modular de painel de instrumentos (Instrument Cluster).
 *
 * Renderiza réplicas fiéis dos quadros de instrumentos reais de acordo com o veículo:
 * - 'classic': Volkswagen Gol G6 — quadro clássico com aros cromados, agulhas vermelhas e display Maxi-DOT.
 * - 'modern': Toyota Yaris XLS — painel Optitron 3D com halos azul gelo, velocímetro central e tela TFT 4.2".
 * - 'motorcycle': Honda CB1000R Neo Sports Café — tela TFT digital colorida de 5 polegadas.
 * - 'supercar': Porsche 911 GT3 RS (992) — cockpit de corrida com tacômetro central de 10.000 RPM e LEDs F1.
 * - 'gti': Volkswagen Golf GTI Mk7 — quadro de instrumentos esportivo GTI com ponteiros azuis e manômetro.
 * - 'square_turbo': VW Gol Quadrado 1.9 AP Turbo — AutoMeter Monster 5", Shift Light e manômetro Cronomac 3.0 bar.
 * - 'civic_si': Honda Civic Si K20 — painel Multiplex de dois andares com LEDs progressivos de acoplamento do i-VTEC.
 */
export const ClusterView = memo(function ClusterView({ telemetry }: ClusterViewProps) {
  const { theme } = telemetry

  switch (theme) {
    case 'motorcycle':
      return <HondaCB1000RRealCluster telemetry={telemetry} />

    case 'modern':
      return <ToyotaYarisRealCluster telemetry={telemetry} />

    case 'supercar':
      return <Porsche992GT3RealCluster telemetry={telemetry} />

    case 'gti':
      return <GolfGTIRealCluster telemetry={telemetry} />

    case 'square_turbo':
      return <GolQuadradoRealCluster telemetry={telemetry} />

    case 'civic_si':
      return <CivicSiRealCluster telemetry={telemetry} />

    case 'classic':
    default:
      return <GolG6RealCluster telemetry={telemetry} />
  }
})
