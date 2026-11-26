/**
 * PanelModeInteriorView.tsx — Palco Interno Dirigível do Modo Painel (Fase 4.4.3 — Etapa 2).
 *
 * Renderizado dentro do mesmo cockpit dirigível principal (`VehicleDashboard`, `MobilePortraitCockpit`,
 * `MobileLandscapeCockpit`) quando `entryMode === 'cluster'`, preservando 100% da mesma simulação
 * determinística (`useSimulationStore`) e mantendo pedais, embreagem, câmbio, freio de mão, ignição e
 * direção por inclinação nas exatas mesmas posições e dimensões do Modo Dirigir.
 *
 * Regras estritas do Modo Painel:
 * - NÃO exibe mapa 2D (`DrivingMapViewport`), minimapa (`HudMinimap`), modal de mapa nem guias de pista.
 * - Organiza verticalmente o interior do veículo no espaço central:
 *   1. Área superior (anteriormente ocupada pelo GPS/Mapa): `VehicleControlsPanel` (controles físicos da cabine)
 *   2. Centro em destaque: `InstrumentClusterPanel` centralizado
 *   3. Abaixo do cluster: `MultimediaPanel` centralizado (omitido em motocicletas como CB1000R)
 */

import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import { getVehicleCapabilities } from '@/types'
import { type GarageCarInstance } from '@/stores/useGarageStore'
import { SteeringControlZone } from '@/components/controls'
import { getAvailableCockpitPanels } from './cockpitPanels'
import { InstrumentClusterPanel } from './InstrumentClusterPanel'
import { MultimediaPanel } from './MultimediaPanel'
import { VehicleControlsPanel } from './VehicleControlsPanel'

export type PanelModeViewportLayout = 'desktop' | 'mobile_portrait' | 'mobile_landscape'

export interface PanelModeInteriorViewProps {
  layout: PanelModeViewportLayout
  telemetry: DashboardTelemetry
  vehicle: VehicleConfig
  carInstance?: GarageCarInstance
  hasTurbo: boolean
  showAftermarketBoostGauge: boolean
  boostPressureBar: number
}

export const PanelModeInteriorView = memo(function PanelModeInteriorView({
  layout,
  telemetry,
  vehicle,
  carInstance,
  hasTurbo,
  showAftermarketBoostGauge,
  boostPressureBar,
}: PanelModeInteriorViewProps) {
  const caps = getVehicleCapabilities(vehicle)
  const isManualActive =
    telemetry.gear.transmissionMode === 'manual_simulated' ||
    telemetry.gear.gearSelectorPosition === 'M'

  const availablePanels = getAvailableCockpitPanels(vehicle, carInstance?.upgrades)
  const hasMultimediaPanel = availablePanels.some((p) => p.id === 'multimedia')

  // ─── 1. MOBILE RETRATO (390×844): Controles no topo (ex-GPS) · Cluster centralizado · Multimídia abaixo ───
  if (layout === 'mobile_portrait') {
    return (
      <div
        data-testid="panel-mode-interior-root"
        data-layout="mobile_portrait"
        className="flex flex-1 flex-col items-center justify-between w-full h-full min-h-0 gap-1 overflow-hidden self-stretch"
      >
        {/* 1. Área anteriormente ocupada pelo GPS: Controles da Cabine */}
        <section
          data-testid="panel-mode-controls-region"
          aria-label="Controles físicos da cabine"
          className="h-[104px] w-full rounded-2xl border border-white/10 bg-zinc-950/90 p-1 overflow-y-auto flex-shrink-0"
        >
          <VehicleControlsPanel vehicle={vehicle} />
        </section>

        {/* 2. Região Central em Destaque: Painel de Instrumentos Centralizado */}
        <section
          data-testid="panel-mode-cluster-region"
          aria-label="Painel de instrumentos centralizado"
          className={`${
            hasMultimediaPanel ? 'h-[166px]' : 'flex-1 min-h-0'
          } w-full rounded-2xl border border-white/10 bg-black/45 flex items-center justify-center relative overflow-hidden flex-shrink-0`}
        >
          <InstrumentClusterPanel
            telemetry={telemetry}
            vehicle={vehicle}
            expanded={false}
            supportsPaddleShifters={caps.supportsPaddleShifters}
            isManualActive={isManualActive}
            hasTurbo={hasTurbo}
            showAftermarketBoostGauge={showAftermarketBoostGauge}
            boostPressureBar={boostPressureBar}
          />
        </section>

        {/* 3. Abaixo do Painel: Central Multimídia / Rádio do Veículo */}
        {hasMultimediaPanel && (
          <section
            data-testid="panel-mode-multimedia-region"
            aria-label="Multimídia do veículo"
            className="flex-1 min-h-0 w-full rounded-2xl border border-white/10 bg-zinc-950/90 p-1 overflow-hidden flex items-center justify-center"
          >
            <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
          </section>
        )}
      </div>
    )
  }

  // ─── 2. MOBILE PAISAGEM (844×390): Controles no topo (ex-GPS) + Tilt · Cluster centralizado · Multimídia abaixo ───
  if (layout === 'mobile_landscape') {
    return (
      <div
        data-testid="panel-mode-interior-root"
        data-layout="mobile_landscape"
        className="flex flex-1 flex-col items-center justify-between w-full h-full min-h-0 gap-1 overflow-hidden self-stretch"
      >
        {/* 1. Área anteriormente ocupada pelo GPS: Indicador/Calibração de Inclinação + Controles da Cabine */}
        <section
          data-testid="panel-mode-controls-region"
          aria-label="Controles físicos da cabine"
          className={`${
            hasMultimediaPanel ? 'h-[78px]' : 'h-[118px]'
          } w-full rounded-xl border border-white/10 bg-zinc-950/90 px-1 py-0.5 flex flex-col gap-0.5 overflow-hidden flex-shrink-0`}
        >
          <div className="flex items-center justify-between gap-1 flex-shrink-0">
            <span className="font-mono text-[7.5px] font-black uppercase tracking-wider text-cyan-300/90 px-1 truncate">
              🎛️ Comandos da Cabine
            </span>
            <SteeringControlZone vehicle={vehicle} className="!p-0.5 !bg-transparent !border-0 !shadow-none" />
          </div>
          <div className="flex-1 min-h-0 w-full overflow-y-auto">
            <VehicleControlsPanel vehicle={vehicle} />
          </div>
        </section>

        {/* 2. Região Central em Destaque: Painel de Instrumentos Centralizado */}
        <section
          data-testid="panel-mode-cluster-region"
          aria-label="Painel de instrumentos centralizado"
          className={`${
            hasMultimediaPanel ? 'h-[134px]' : 'flex-1 min-h-0'
          } w-full rounded-xl border border-white/10 bg-black/45 flex items-center justify-center relative overflow-hidden flex-shrink-0`}
        >
          <InstrumentClusterPanel
            telemetry={telemetry}
            vehicle={vehicle}
            expanded={false}
            supportsPaddleShifters={caps.supportsPaddleShifters}
            isManualActive={isManualActive}
            hasTurbo={hasTurbo}
            showAftermarketBoostGauge={showAftermarketBoostGauge}
            boostPressureBar={boostPressureBar}
          />
        </section>

        {/* 3. Abaixo do Painel: Central Multimídia / Rádio do Veículo */}
        {hasMultimediaPanel && (
          <section
            data-testid="panel-mode-multimedia-region"
            aria-label="Multimídia do veículo"
            className="flex-1 min-h-0 w-full rounded-xl border border-white/10 bg-zinc-950/90 p-0.5 overflow-hidden flex items-center justify-center"
          >
            <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
          </section>
        )}
      </div>
    )
  }

  // ─── 3. DESKTOP (1280×800+): Controles na área superior (ex-GPS) · Cluster centralizado · Multimídia abaixo ───
  return (
    <div
      data-testid="panel-mode-interior-root"
      data-layout="desktop"
      className="flex flex-1 flex-col items-center justify-between w-full max-w-5xl mx-auto min-h-0 gap-1.5 px-2 overflow-hidden"
    >
      {/* 1. Área anteriormente ocupada pelo GPS: Console Superior de Controles da Cabine */}
      <section
        data-testid="panel-mode-controls-region"
        aria-label="Controles físicos da cabine"
        className="h-[108px] xl:h-[124px] w-full max-w-4xl rounded-2xl border border-white/10 bg-zinc-950/85 px-2 py-1 flex flex-col overflow-hidden flex-shrink-0"
      >
        <div className="flex items-center justify-between px-1 pb-0.5 text-[8.5px] font-mono text-zinc-400 uppercase tracking-wider flex-shrink-0">
          <span>🎛️ Comandos Físicos da Cabine</span>
          <span className="text-zinc-500">Iluminação · Vidros · Climatização / Tração</span>
        </div>
        <div className="flex-1 min-h-0 w-full overflow-y-auto">
          <VehicleControlsPanel vehicle={vehicle} />
        </div>
      </section>

      {/* 2. Região Central em Destaque: Painel de Instrumentos Centralizado */}
      <section
        data-testid="panel-mode-cluster-region"
        aria-label="Painel de instrumentos centralizado"
        className={`${
          hasMultimediaPanel ? 'flex-1 min-h-[168px]' : 'flex-1 min-h-[240px]'
        } w-full max-w-4xl rounded-2xl border border-white/10 bg-black/35 px-2 py-1 flex items-center justify-center relative overflow-hidden`}
      >
        <InstrumentClusterPanel
          telemetry={telemetry}
          vehicle={vehicle}
          viewMode="cluster"
          maxScale={0.96}
          hasTurbo={hasTurbo}
          showAftermarketBoostGauge={showAftermarketBoostGauge}
          boostPressureBar={boostPressureBar}
          showPillarGaugePod={true}
        />
      </section>

      {/* 3. Abaixo do Painel: Central Multimídia / Rádio Centralizado */}
      {hasMultimediaPanel && (
        <section
          data-testid="panel-mode-multimedia-region"
          aria-label="Multimídia do veículo"
          className="h-[192px] xl:h-[214px] w-full max-w-3xl rounded-2xl border border-white/10 bg-zinc-950/85 p-1.5 flex items-center justify-center overflow-hidden flex-shrink-0"
        >
          <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
        </section>
      )}
    </div>
  )
})
