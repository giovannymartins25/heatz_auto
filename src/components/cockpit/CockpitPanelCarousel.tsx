/**
 * CockpitPanelCarousel.tsx — Carrossel horizontal responsivo de 3 painéis para Mobile (Fase 4.3).
 *
 * Painéis (conforme `getAvailableCockpitPanels(vehicle)`):
 *   1. Painel 1 — Instrument Cluster (`InstrumentClusterPanel`)
 *   2. Painel 2 — Multimídia / Rádio / Console (`MultimediaPanel` — omitido em motocicletas)
 *   3. Painel 3 — Controles do Veículo (`VehicleControlsPanel`)
 *
 * Garantias:
 * - Cada painel ocupa exatamente 100% da largura disponível do carrossel.
 * - Estado do painel ativo persistido em `useUIStore.activeCockpitPanel`, preservando o painel
 *   atual ao redimensionar entre portrait (390×844) e landscape (844×390).
 * - Validação automática via `resolveValidCockpitPanel()` ao trocar de veículo (evita seleção inválida).
 * - Compatibilidade plena com `multitouchBridge.ts`: permite manter o acelerador pressionado com um dedo
 *   enquanto outro dedo desliza entre painéis ou aciona botões/sliders internos sem eventos duplicados.
 */

import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import { useUIStore, type CockpitPanelId } from '@/stores/useUIStore'
import { useGarageStore } from '@/stores/useGarageStore'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'
import { useSecondaryTouchTapBridge } from '@/utils/multitouchBridge'
import { getAvailableCockpitPanels, resolveValidCockpitPanel } from './cockpitPanels'
import { InstrumentClusterPanel } from './InstrumentClusterPanel'
import { MultimediaPanel } from './MultimediaPanel'
import { VehicleControlsPanel } from './VehicleControlsPanel'

export interface CockpitPanelCarouselProps {
  telemetry: DashboardTelemetry
  vehicle: VehicleConfig
  expanded?: boolean
  supportsPaddleShifters?: boolean
  isManualActive?: boolean
  hasTurbo?: boolean
  showAftermarketBoostGauge?: boolean
  boostPressureBar?: number
  className?: string
  onPanelChange?: (panel: CockpitPanelId) => void
}

const SWIPE_THRESHOLD = 40 // px

export const CockpitPanelCarousel = memo(function CockpitPanelCarousel({
  telemetry,
  vehicle,
  expanded = false,
  supportsPaddleShifters = false,
  isManualActive = false,
  hasTurbo = false,
  showAftermarketBoostGauge = false,
  boostPressureBar = 0,
  className = '',
  onPanelChange,
}: CockpitPanelCarouselProps) {
  const activeCar = useGarageStore((s) => s.resolveInstanceForVehicle(vehicle.id))
  const storedPanel = useUIStore((s) => s.activeCockpitPanel)
  const setStoredPanel = useUIStore((s) => s.setActiveCockpitPanel)

  const panels = useMemo(
    () => getAvailableCockpitPanels(vehicle, activeCar?.upgrades),
    [vehicle, activeCar?.upgrades],
  )

  const validPanel = useMemo(
    () => resolveValidCockpitPanel(storedPanel, vehicle, activeCar?.upgrades),
    [storedPanel, vehicle, activeCar?.upgrades],
  )

  // Corrige seleção na store automaticamente ao trocar para um veículo incompatível (ex.: CB1000R)
  useEffect(() => {
    if (storedPanel !== validPanel) {
      setStoredPanel(validPanel)
    }
  }, [storedPanel, validPanel, setStoredPanel])

  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  const startRef = useRef<{ x: number; y: number; id: number } | null>(null)
  const lastDxRef = useRef(0)
  const lockedRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const secondaryTouchHandlers = useSecondaryTouchTapBridge()

  const activeIndex = Math.max(
    0,
    panels.findIndex((p) => p.id === validPanel),
  )

  const selectPanel = useCallback(
    (panelId: CockpitPanelId) => {
      if (panelId !== validPanel) {
        HapticFeedback.light()
        setStoredPanel(panelId)
        onPanelChange?.(panelId)
      }
    },
    [validPanel, setStoredPanel, onPanelChange],
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panels.length <= 1) return
    // Em multitouch (ex.: dedo 1 no acelerador, dedo 2 no swipe), permite toque secundário iniciar o swipe
    if (e.pointerType !== 'touch' && !e.isPrimary) return
    if (e.pointerType === 'mouse' && e.button !== undefined && e.button !== 0) return
    if (startRef.current !== null) return

    const target = e.target as HTMLElement
    // Nunca sequestrar toques sobre controles internos (botões, sliders, inputs, áreas marcadas)
    if (target.closest('button, a, input, select, textarea, [data-prevent-swipe]')) return

    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    lastDxRef.current = 0
    lockedRef.current = false

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = startRef.current
    if (!s || e.pointerId !== s.id) return

    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    lastDxRef.current = dx

    if (!lockedRef.current) {
      // Rolagem vertical dentro dos painéis (ex.: lista de controles): libera imediatamente
      if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx) * 2) {
        try {
          if (rootRef.current?.hasPointerCapture(s.id)) {
            rootRef.current.releasePointerCapture(s.id)
          }
        } catch {
          /* noop */
        }
        startRef.current = null
        return
      }

      if (Math.abs(dx) >= 6 && Math.abs(dx) >= Math.abs(dy)) {
        lockedRef.current = true
        setDragging(true)
      } else {
        return
      }
    }

    if (lockedRef.current) {
      e.stopPropagation()
    }

    const w = rootRef.current?.clientWidth ?? 300
    const max = w * 0.65
    let off = Math.max(-max, Math.min(max, dx))
    // Resistência elástica nas extremidades
    if ((activeIndex === 0 && dx > 0) || (activeIndex === panels.length - 1 && dx < 0)) {
      off *= 0.2
    }
    setDragOffset(off)
  }

  const endGesture = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const s = startRef.current
    if (!s || e.pointerId !== s.id) return

    const wasLocked = lockedRef.current
    const currentX =
      e.clientX !== undefined && Number.isFinite(e.clientX) && e.clientX !== 0
        ? e.clientX
        : s.x + lastDxRef.current
    const dx = currentX - s.x

    startRef.current = null
    lockedRef.current = false
    setDragging(false)
    setDragOffset(0)

    try {
      if (rootRef.current?.hasPointerCapture(s.id)) {
        rootRef.current.releasePointerCapture(s.id)
      }
    } catch {
      /* noop */
    }

    if (!wasLocked) return
    if (cancelled && Math.abs(dx) < SWIPE_THRESHOLD) return

    if (dx <= -SWIPE_THRESHOLD && activeIndex < panels.length - 1) {
      selectPanel(panels[activeIndex + 1].id)
    } else if (dx >= SWIPE_THRESHOLD && activeIndex > 0) {
      selectPanel(panels[activeIndex - 1].id)
    }
  }

  const trackWidthPercent = panels.length * 100
  const stepPercent = 100 / panels.length

  return (
    <div
      ref={rootRef}
      className={`relative flex h-full w-full min-h-0 flex-1 self-stretch flex-col select-none overflow-hidden ${
        dragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => endGesture(e)}
      onPointerCancel={(e) => endGesture(e, true)}
      {...secondaryTouchHandlers}
      style={{ touchAction: 'pan-y' }}
      aria-label="Carrossel modular de painéis do cockpit"
      data-testid="cockpit-panel-carousel"
      data-active-panel={validPanel}
      data-panel-count={panels.length}
      data-swipe-slot
    >
      {/* Barra compacta superior de navegação direta entre os painéis + indicadores */}
      <div
        className="z-30 flex flex-shrink-0 items-center justify-between gap-1 px-1 pb-0.5 pt-px pointer-events-auto"
        data-prevent-swipe
      >
        <div className="flex items-center gap-1" role="tablist" aria-label="Selecionar painel do cockpit">
          {panels.map((p) => {
            const isActive = p.id === validPanel
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`cockpit-tab-${p.id}`}
                onClick={() => selectPanel(p.id)}
                className={`px-2 py-0.5 rounded-full border font-mono text-[8px] font-black tracking-wider transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
                  isActive
                    ? 'bg-zinc-800 text-white border-white/30 shadow'
                    : 'bg-zinc-950/80 text-zinc-400 border-white/10 hover:text-zinc-200'
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.shortLabel}</span>
              </button>
            )
          })}
        </div>

        {/* Indicadores (dots) clicáveis */}
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-1.5 py-0.5">
          {panels.map((p) => {
            const isActive = p.id === validPanel
            return (
              <button
                key={p.id}
                type="button"
                data-testid={`cockpit-dot-${p.id}`}
                onClick={() => selectPanel(p.id)}
                aria-label={`Ir para ${p.label}`}
                title={p.label}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  isActive ? `${p.accentClass} w-3.5` : 'bg-zinc-600 hover:bg-zinc-400 w-1.5'
                }`}
              />
            )
          })}
        </div>
      </div>

      {/* Área deslizante (esteira com 100% de largura por painel) */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 flex ${dragging ? '' : 'transition-transform duration-200 ease-out'}`}
          style={{
            width: `${trackWidthPercent}%`,
            transform: `translateX(calc(${-activeIndex * stepPercent}% + ${dragOffset}px))`,
            touchAction: 'pan-y',
          }}
          data-swipe-track
        >
          {panels.map((p) => {
            const isActive = p.id === validPanel
            return (
              <div
                key={p.id}
                className="relative h-full overflow-hidden"
                style={{
                  width: `${stepPercent}%`,
                  pointerEvents: dragging ? 'none' : isActive ? 'auto' : 'none',
                }}
                data-pane={p.id}
                aria-hidden={!isActive}
              >
                {p.id === 'cluster' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <InstrumentClusterPanel
                      telemetry={telemetry}
                      vehicle={vehicle}
                      expanded={expanded}
                      supportsPaddleShifters={supportsPaddleShifters}
                      isManualActive={isManualActive}
                      hasTurbo={hasTurbo}
                      showAftermarketBoostGauge={showAftermarketBoostGauge}
                      boostPressureBar={boostPressureBar}
                    />
                  </div>
                )}

                {p.id === 'multimedia' && (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center p-0.5 overflow-hidden">
                    <MultimediaPanel vehicle={vehicle} telemetry={telemetry} />
                  </div>
                )}

                {p.id === 'controls' && (
                  <div className="absolute inset-0 w-full h-full p-0.5 overflow-hidden">
                    <VehicleControlsPanel vehicle={vehicle} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
