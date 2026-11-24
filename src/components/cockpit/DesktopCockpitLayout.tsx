/**
 * DesktopCockpitLayout.tsx — Layout Modular Desktop de 3 Painéis (Fase 4.3).
 *
 * - Painel 1 (Instrument Cluster): SEMPRE visível na coluna principal (ou `CockpitView` quando selecionado).
 * - Coluna lateral secundária: alterna de forma limpa entre Painel 2 (Multimídia / Rádio / Console)
 *   e Painel 3 (Controles do Veículo), sem duplicação de componentes nem de estados.
 * - Para motocicletas (CB1000R), a coluna lateral exibe diretamente o Painel 3 (Comandos Moto)
 *   sem exibir aba de multimídia automotiva inexistente.
 */

import { memo, useEffect, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import { useUIStore, type DesktopSecondaryPanelId } from '@/stores/useUIStore'
import { useGarageStore } from '@/stores/useGarageStore'
import { useSecondaryTouchTapBridge } from '@/utils/multitouchBridge'
import { getAvailableCockpitPanels, resolveValidDesktopSecondaryPanel } from './cockpitPanels'
import { InstrumentClusterPanel } from './InstrumentClusterPanel'
import { MultimediaPanel } from './MultimediaPanel'
import { VehicleControlsPanel } from './VehicleControlsPanel'

export interface DesktopCockpitLayoutProps {
  telemetry: DashboardTelemetry
  vehicle: VehicleConfig
  viewMode: 'cluster' | 'cockpit'
  showAftermarketBoostGauge: boolean
  hasTurbo: boolean
  boostPressureBar: number
}

export const DesktopCockpitLayout = memo(function DesktopCockpitLayout({
  telemetry,
  vehicle,
  viewMode,
  showAftermarketBoostGauge,
  hasTurbo,
  boostPressureBar,
}: DesktopCockpitLayoutProps) {
  const activeCar = useGarageStore((s) => s.resolveInstanceForVehicle(vehicle.id))
  const storedSecondary = useUIStore((s) => s.desktopSecondaryPanel)
  const setStoredSecondary = useUIStore((s) => s.setDesktopSecondaryPanel)
  const secondaryTouchHandlers = useSecondaryTouchTapBridge()

  const availablePanels = useMemo(
    () => getAvailableCockpitPanels(vehicle, activeCar?.upgrades),
    [vehicle, activeCar?.upgrades],
  )
  const mediaDescriptor = availablePanels.find((p) => p.id === 'multimedia')
  const controlsDescriptor = availablePanels.find((p) => p.id === 'controls')
  const hasMultimediaPanel = Boolean(mediaDescriptor)

  const activeSecondary: DesktopSecondaryPanelId = useMemo(
    () => resolveValidDesktopSecondaryPanel(storedSecondary, vehicle, activeCar?.upgrades),
    [storedSecondary, vehicle, activeCar?.upgrades],
  )

  useEffect(() => {
    if (storedSecondary !== activeSecondary) {
      setStoredSecondary(activeSecondary)
    }
  }, [storedSecondary, activeSecondary, setStoredSecondary])

  return (
    <div
      className="relative w-full max-w-[1440px] flex flex-col lg:flex-row items-stretch justify-center gap-3 px-2"
      data-testid="desktop-cockpit-layout"
    >
      {/* Painel 1 — Instrument Cluster (sempre visível no desktop) */}
      <div className="w-full min-w-0 flex-1 flex items-center justify-center relative h-[230px] xl:h-[268px] rounded-2xl border border-white/5 bg-black/25">
        <InstrumentClusterPanel
          telemetry={telemetry}
          vehicle={vehicle}
          viewMode={viewMode}
          maxScale={1.0}
          hasTurbo={hasTurbo}
          showAftermarketBoostGauge={showAftermarketBoostGauge}
          boostPressureBar={boostPressureBar}
          showPillarGaugePod={true}
        />
      </div>

      {/* Área Secundária — Alternância limpa entre Painel 2 (Multimídia/Rádio) e Painel 3 (Controles) */}
      <div
        className="flex flex-col shrink-0 w-full max-w-[460px] mx-auto lg:mx-0 lg:w-[370px] xl:w-[420px] h-[230px] xl:h-[268px] rounded-2xl border border-white/10 bg-zinc-950/80 p-1.5"
        data-testid="desktop-secondary-panel"
        data-active-secondary={activeSecondary}
        {...secondaryTouchHandlers}
      >
        {/* Seletor de abas da coluna secundária */}
        <div
          className="mb-1 flex flex-shrink-0 items-center justify-between gap-1 px-0.5"
          role="tablist"
          aria-label="Alternar painel lateral entre Multimídia e Controles"
        >
          <div className="flex items-center gap-1">
            {hasMultimediaPanel && mediaDescriptor && (
              <button
                type="button"
                role="tab"
                aria-selected={activeSecondary === 'multimedia'}
                data-testid="desktop-tab-multimedia"
                onClick={() => setStoredSecondary('multimedia')}
                className={`px-2.5 py-0.5 rounded-lg border font-mono text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
                  activeSecondary === 'multimedia'
                    ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-200 shadow-sm'
                    : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <span>{mediaDescriptor.icon}</span>
                <span>{mediaDescriptor.label}</span>
              </button>
            )}
            {controlsDescriptor && (
              <button
                type="button"
                role="tab"
                aria-selected={activeSecondary === 'controls'}
                data-testid="desktop-tab-controls"
                onClick={() => setStoredSecondary('controls')}
                className={`px-2.5 py-0.5 rounded-lg border font-mono text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
                  activeSecondary === 'controls'
                    ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200 shadow-sm'
                    : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <span>{controlsDescriptor.icon}</span>
                <span>{controlsDescriptor.label}</span>
              </button>
            )}
          </div>
          <span className="font-mono text-[8px] uppercase text-zinc-500">
            {hasMultimediaPanel ? '2 Painéis Auxiliares' : 'Painel Moto'}
          </span>
        </div>

        {/* Conteúdo ativo da área secundária (instância única, sem duplicação) */}
        <div className="relative flex-1 min-h-0 w-full overflow-hidden">
          {activeSecondary === 'multimedia' && hasMultimediaPanel ? (
            <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
          ) : (
            <VehicleControlsPanel vehicle={vehicle} />
          )}
        </div>
      </div>
    </div>
  )
})
