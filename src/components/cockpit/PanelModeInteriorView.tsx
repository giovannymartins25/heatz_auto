/**
 * PanelModeInteriorView.tsx — Palco Central do Modo Painel (Fase 4.4.3 — Etapa 3A).
 *
 * Opera dentro da casca unificada do cockpit (`VehicleDashboard`, `MobilePortraitCockpit`,
 * `MobileLandscapeCockpit`), compartilhando a MESMA `useSimulationStore` a 120 Hz e os MESMOS
 * 3 slots geométricos fixos de pedais (`[EMBR/Vazio]`, `[FREIO]`, `[ACEL]`), câmbio e coluna de ignição
 * nas exatas mesmas coordenadas do Modo Dirigir (`Δ = 0 px`).
 *
 * Separação estrita preservada no Modo Painel:
 * - Zero veículo no mundo 2D/3D, zero deslocamento espacial (`positionX`, `positionY`, `headingDeg`),
 *   zero direção por inclinação/teclado, zero mapa/minimapa/rotas/colisões e zero gasto de combustível.
 * - Renderiza exclusivamente:
 *   1. Painel de instrumentos como elemento visual principal (hero), com amplo aproveitamento e proporção real;
 *   2. Multimídia dedicada e bem dimensionada (omitida em motocicletas como CB1000R);
 *   3. Controles físicos da cabine organizados e acessíveis;
 *   4. Telemetria real ao vivo do motor/sistema elétrico.
 */

import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { type GarageCarInstance } from '@/stores/useGarageStore'
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
  onBack?: () => void
}

interface LivePanelTelemetryProps {
  compact?: boolean
  grid?: boolean
  hasBoost: boolean
  boostPressureBar: number
}

const PanelModeLiveTelemetryStrip = memo(function PanelModeLiveTelemetryStrip({
  compact = false,
  grid = false,
  hasBoost,
  boostPressureBar,
}: LivePanelTelemetryProps) {
  const livePowerHp = useSimulationStore((s) => s.livePowerHp)
  const liveTorqueNm = useSimulationStore((s) => s.liveTorqueNm)
  const coolantTemp = useSimulationStore((s) => s.coolantTemp)
  const oilTemp = useSimulationStore((s) => s.oilTemp)
  const batteryVoltageV = useSimulationStore((s) => s.batteryVoltageV)

  const items = [
    {
      key: 'power',
      label: 'POTÊNCIA',
      value: `${Math.round(livePowerHp)} CV`,
      tone: 'text-amber-300',
    },
    {
      key: 'torque',
      label: 'TORQUE',
      value: `${Math.round(liveTorqueNm)} Nm`,
      tone: 'text-cyan-300',
    },
    {
      key: 'coolant',
      label: 'ÁGUA',
      value: `${Math.round(coolantTemp)}°C`,
      tone: coolantTemp >= 112 ? 'text-red-400' : 'text-emerald-300',
    },
    {
      key: 'oil',
      label: 'ÓLEO',
      value: `${Math.round(oilTemp)}°C`,
      tone: oilTemp >= 125 ? 'text-red-400' : 'text-zinc-100',
    },
    {
      key: 'battery',
      label: 'BATERIA',
      value: `${batteryVoltageV.toFixed(1)}V`,
      tone: batteryVoltageV < 11.6 ? 'text-amber-400' : 'text-sky-300',
    },
    ...(hasBoost
      ? [
          {
            key: 'boost',
            label: 'TURBO',
            value: `${boostPressureBar >= 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} bar`,
            tone: boostPressureBar > 0.05 ? 'text-amber-400' : 'text-sky-300',
          },
        ]
      : []),
  ]

  if (grid) {
    return (
      <div
        data-testid="panel-mode-telemetry-strip"
        aria-label="Telemetria real ao vivo do motor"
        className="flex h-full min-h-0 flex-col justify-between gap-1 rounded-2xl border border-white/10 bg-zinc-950/90 p-2 font-mono shadow-xl"
      >
        <div className="border-b border-white/10 pb-1 text-[8.5px] font-black uppercase tracking-wider text-cyan-300">
          ⚡ Telemetria Real do Conjunto
        </div>
        <div className="grid flex-1 content-center grid-cols-1 gap-1">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-1.5 rounded-lg border border-white/5 bg-black/60 px-2 py-1"
            >
              <span className="text-[7.5px] font-bold text-zinc-400 uppercase">{item.label}</span>
              <strong className={`text-[9.5px] font-black tabular-nums ${item.tone}`}>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="panel-mode-telemetry-strip"
      aria-label="Telemetria real ao vivo do motor"
      className={`grid w-full flex-shrink-0 font-mono rounded-xl border border-white/10 bg-zinc-950/90 ${
        compact ? 'px-1.5 py-1 gap-1' : 'p-1.5 gap-1.5'
      }`}
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      }}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className="flex flex-col items-center justify-center rounded-lg border border-white/5 bg-black/55 px-1 py-0.5 leading-tight"
        >
          <span className="text-[6px] sm:text-[6.5px] font-bold text-zinc-500 uppercase tracking-wider truncate max-w-full">
            {item.label}
          </span>
          <strong className={`text-[8px] sm:text-[9px] font-black tabular-nums whitespace-nowrap ${item.tone}`}>
            {item.value}
          </strong>
        </div>
      ))}
    </div>
  )
})

export const PanelModeInteriorView = memo(function PanelModeInteriorView({
  layout,
  telemetry,
  vehicle,
  carInstance,
  hasTurbo,
  showAftermarketBoostGauge,
  boostPressureBar,
}: PanelModeInteriorViewProps) {
  const hasBoostDisplay = hasTurbo || showAftermarketBoostGauge
  const availablePanels = getAvailableCockpitPanels(vehicle, carInstance?.upgrades)
  const hasMultimediaPanel = availablePanels.some((p) => p.id === 'multimedia')

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. MOBILE RETRATO (390×844) — Palco central embutido acima do câmbio e dos 3 slots fixos de pedais
  // ═══════════════════════════════════════════════════════════════════════════════
  if (layout === 'mobile_portrait') {
    return (
      <div
        data-testid="panel-mode-interior-root"
        data-layout="mobile_portrait"
        className="flex h-full min-h-0 w-full flex-col justify-between gap-1 overflow-hidden select-none"
      >
        <section
          data-testid="panel-mode-cluster-region"
          aria-label="Painel de instrumentos principal"
          className={`${
            hasMultimediaPanel ? 'h-[150px]' : 'flex-1 min-h-[180px]'
          } w-full rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/50 to-black/80 px-1 py-0.5 flex items-center justify-center relative overflow-hidden flex-shrink-0 shadow-lg`}
        >
          <InstrumentClusterPanel
            telemetry={telemetry}
            vehicle={vehicle}
            viewMode="cluster"
            maxScale={1.18}
            hasTurbo={hasTurbo}
            showAftermarketBoostGauge={showAftermarketBoostGauge}
            boostPressureBar={boostPressureBar}
          />
        </section>

        {hasMultimediaPanel && (
          <section
            data-testid="panel-mode-multimedia-region"
            aria-label="Multimídia do veículo"
            className="h-[148px] w-full rounded-2xl border border-white/10 bg-zinc-950/90 p-1 flex items-center justify-center overflow-hidden flex-shrink-0"
          >
            <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
          </section>
        )}

        <section
          data-testid="panel-mode-controls-region"
          aria-label="Controles físicos da cabine"
          className={`${
            hasMultimediaPanel ? 'flex-1 min-h-[64px]' : 'h-[128px]'
          } w-full rounded-2xl border border-white/10 bg-zinc-950/90 p-1 overflow-y-auto`}
        >
          <VehicleControlsPanel vehicle={vehicle} />
        </section>

        <PanelModeLiveTelemetryStrip
          compact
          hasBoost={hasBoostDisplay}
          boostPressureBar={boostPressureBar}
        />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. MOBILE PAISAGEM (844×390) — Palco central entre coluna esquerda fixa (3 pedais) e direita fixa (câmbio/ignição)
  // ═══════════════════════════════════════════════════════════════════════════════
  if (layout === 'mobile_landscape') {
    return (
      <div
        data-testid="panel-mode-interior-root"
        data-layout="mobile_landscape"
        className="flex h-full min-h-0 w-full flex-col justify-between gap-1 overflow-hidden select-none"
      >
        <section
          data-testid="panel-mode-cluster-region"
          aria-label="Painel de instrumentos principal"
          className={`${
            hasMultimediaPanel ? 'h-[168px]' : 'flex-1 min-h-0'
          } w-full rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/50 to-black/80 px-1.5 py-0.5 flex items-center justify-center relative overflow-hidden flex-shrink-0 shadow-lg`}
        >
          <InstrumentClusterPanel
            telemetry={telemetry}
            vehicle={vehicle}
            viewMode="cluster"
            maxScale={1.16}
            hasTurbo={hasTurbo}
            showAftermarketBoostGauge={showAftermarketBoostGauge}
            boostPressureBar={boostPressureBar}
          />
        </section>

        <div
          className={`${
            hasMultimediaPanel
              ? 'grid flex-1 min-h-0 w-full grid-cols-[1.12fr_1fr] gap-1'
              : 'flex h-[126px] flex-shrink-0 w-full'
          } overflow-hidden`}
        >
          {hasMultimediaPanel && (
            <section
              data-testid="panel-mode-multimedia-region"
              aria-label="Multimídia do veículo"
              className="h-full min-h-0 w-full rounded-xl border border-white/10 bg-zinc-950/90 p-1 flex items-center justify-center overflow-hidden"
            >
              <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
            </section>
          )}

          <section
            data-testid="panel-mode-controls-region"
            aria-label="Controles físicos da cabine"
            className="h-full min-h-0 w-full rounded-xl border border-white/10 bg-zinc-950/90 p-1 overflow-y-auto"
          >
            <VehicleControlsPanel vehicle={vehicle} />
          </section>
        </div>

        <PanelModeLiveTelemetryStrip
          compact
          hasBoost={hasBoostDisplay}
          boostPressureBar={boostPressureBar}
        />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. DESKTOP (1280×800+) — Hero Cluster centralizado + Deck inferior [Multimídia | Controles | Telemetria]
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div
      data-testid="panel-mode-interior-root"
      data-layout="desktop"
      className="flex flex-1 min-h-0 w-full max-w-[1260px] flex-col justify-between gap-2 overflow-hidden select-none"
    >
      <section
        data-testid="panel-mode-cluster-region"
        aria-label="Painel de instrumentos principal"
        className="mx-auto flex flex-[1.12] min-h-[210px] max-h-[290px] w-full max-w-[1200px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/45 via-zinc-950/80 to-black px-4 py-1.5 relative shadow-2xl"
      >
        <InstrumentClusterPanel
          telemetry={telemetry}
          vehicle={vehicle}
          viewMode="cluster"
          maxScale={1.25}
          hasTurbo={hasTurbo}
          showAftermarketBoostGauge={showAftermarketBoostGauge}
          boostPressureBar={boostPressureBar}
          showPillarGaugePod={true}
        />
      </section>

      <div
        className={`mx-auto grid flex-1 min-h-[175px] max-h-[235px] w-full max-w-[1240px] gap-2.5 overflow-hidden ${
          hasMultimediaPanel ? 'grid-cols-[1.15fr_1fr_240px]' : 'grid-cols-[1fr_260px]'
        }`}
      >
        {hasMultimediaPanel && (
          <section
            data-testid="panel-mode-multimedia-region"
            aria-label="Multimídia do veículo"
            className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 p-1.5 shadow-xl"
          >
            <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
          </section>
        )}

        <section
          data-testid="panel-mode-controls-region"
          aria-label="Controles físicos da cabine"
          className="flex h-full min-h-0 w-full flex-col gap-1 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 p-2 shadow-xl"
        >
          <div className="border-b border-white/10 pb-1 font-mono text-[8.5px] font-black uppercase tracking-wider text-zinc-300 flex-shrink-0">
            🎛️ Controles Físicos da Cabine
          </div>
          <div className="flex-1 min-h-0 w-full overflow-y-auto">
            <VehicleControlsPanel vehicle={vehicle} />
          </div>
        </section>

        <PanelModeLiveTelemetryStrip
          grid
          hasBoost={hasBoostDisplay}
          boostPressureBar={boostPressureBar}
        />
      </div>
    </div>
  )
})
