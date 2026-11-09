import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import {
  GolG6RealCluster,
  ToyotaYarisRealCluster,
  HondaCB1000RRealCluster,
  Porsche992GT3RealCluster,
} from './clusters'

interface ClusterViewProps {
  telemetry: DashboardTelemetry
}

/**
 * ClusterView — Componente modular de painel de instrumentos (Instrument Cluster).
 *
 * Renderiza réplicas fiéis dos quadros de instrumentos reais de acordo com o veículo:
 * - 'classic': Volkswagen Gol G6 — quadro clássico com aros cromados, agulhas vermelhas,
 *              mini marcadores de água/combustível e tela central I-System Maxi-DOT.
 * - 'modern': Toyota Yaris XLS — painel Optitron 3D com halos azul gelo (Ice Blue),
 *             velocímetro central com gate P-R-N-D / M1-M7 e tela colorida TFT 4.2" com Eco Bar.
 * - 'motorcycle': Honda CB1000R Neo Sports Café — tela TFT digital colorida de 5 polegadas,
 *                 tacômetro sweeping até 12.000 RPM, marcha esportiva e parâmetros P, EB, T.
 * - 'supercar': Porsche 911 GT3 RS (992) — cockpit de corrida com tacômetro central de 10.000 RPM,
 *               agulha amarela, régua de LEDs convergentes F1/GT3, TPMS de 4 pneus e G-Force Meter.
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

    case 'classic':
    default:
      return <GolG6RealCluster telemetry={telemetry} />
  }
})
