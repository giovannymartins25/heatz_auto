import { memo } from 'react'
import type { VehicleConfig, DrivingMode } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'

export interface MobileQuickMenuProps {
  isOpen: boolean
  onClose: () => void
  vehicle: VehicleConfig
  onOpenDragStrip: () => void
  onOpenDyno: () => void
  onOpenTuning: () => void
  onExit: () => void
}

interface TileProps {
  icon: string
  label: string
  sub?: string
  active?: boolean
  activeClass?: string
  onClick: () => void
}

function Tile({ icon, label, sub, active, activeClass, onClick }: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 h-[72px] rounded-2xl border transition-all active:scale-95 cursor-pointer ${
        active
          ? activeClass ?? 'bg-amber-500/20 border-amber-400 text-amber-200'
          : 'bg-zinc-900/90 border-white/10 text-zinc-300'
      }`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[10px] font-mono font-black uppercase tracking-wider leading-none">{label}</span>
      {sub && <span className="text-[8px] font-mono text-zinc-400 leading-none">{sub}</span>}
    </button>
  )
}

/**
 * MobileQuickMenu — Painel deslizante (bottom sheet) com todos os atalhos
 * secundários em botões grandes, para manter o cockpit mobile limpo.
 */
export const MobileQuickMenu = memo(function MobileQuickMenu({
  isOpen,
  onClose,
  vehicle,
  onOpenDragStrip,
  onOpenDyno,
  onOpenTuning,
  onExit,
}: MobileQuickMenuProps) {
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const toggleExhaustValve = useSimulationStore((s) => s.toggleExhaustValve)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const cycleHeadlights = useSimulationStore((s) => s.cycleHeadlights)
  const isRaining = useSimulationStore((s) => s.isRaining)
  const toggleRain = useSimulationStore((s) => s.toggleRain)
  const isMuted = useSimulationStore((s) => s.isMuted)
  const toggleMute = useSimulationStore((s) => s.toggleMute)
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const tcsEnabled = useSimulationStore((s) => s.tcsEnabled)
  const setTcsEnabled = useSimulationStore((s) => s.setTcsEnabled)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const setDrivingMode = useSimulationStore((s) => s.setDrivingMode)
  const best0to100 = useSimulationStore((s) => s.best0to100)

  if (!isOpen) return null

  const supportedModes = vehicle.transmission.supportedModes || []
  const headlightLabel =
    headlightsMode === 'off' ? 'DESLIG.' : headlightsMode === 'parking' ? 'LANTERNA' : headlightsMode === 'low' ? 'BAIXO' : 'ALTO'

  const openAndClose = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-zinc-950 border-t border-x border-white/10 p-4 shadow-2xl"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-zinc-700" />

        <div className="flex items-center justify-between mb-3">
          <div className="leading-tight">
            <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest">{vehicle.info.brand}</span>
            <span className="block text-sm font-bold text-white">{vehicle.info.name}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 text-lg active:scale-95 cursor-pointer"
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>

        {/* Modos de condução */}
        {supportedModes.length > 0 && (
          <div className="mb-4">
            <span className="block mb-1.5 text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Modo de condução</span>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${supportedModes.length}, minmax(0, 1fr))` }}>
              {supportedModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDrivingMode(mode as DrivingMode)}
                  className={`h-11 rounded-xl border font-mono font-black text-xs uppercase transition-all active:scale-95 cursor-pointer ${
                    drivingMode === mode
                      ? 'bg-white text-zinc-950 border-white shadow'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Carro */}
        <span className="block mb-1.5 text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Carro</span>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Tile
            icon="⚡"
            label="Escape"
            sub={exhaustValveOpen ? 'ABERTO' : 'FECHADO'}
            active={exhaustValveOpen}
            onClick={toggleExhaustValve}
          />
          <Tile
            icon="💡"
            label="Faróis"
            sub={headlightLabel}
            active={headlightsMode !== 'off'}
            activeClass="bg-sky-500/20 border-sky-400 text-sky-200"
            onClick={cycleHeadlights}
          />
          <Tile
            icon={isRaining ? '🌧️' : '☀️'}
            label="Clima"
            sub={isRaining ? 'CHUVA' : 'SECO'}
            active={isRaining}
            activeClass="bg-blue-600/30 border-blue-400 text-blue-200"
            onClick={toggleRain}
          />
          {vehicle.transmission.tcs?.enabled && (
            <Tile
              icon="🛞"
              label="TCS"
              sub={tcsEnabled ? 'LIGADO' : 'DESLIGADO'}
              active={tcsEnabled}
              activeClass="bg-emerald-500/20 border-emerald-400 text-emerald-200"
              onClick={() => setTcsEnabled(!tcsEnabled)}
            />
          )}
          <Tile
            icon={isMuted ? '🔇' : '🔊'}
            label="Som"
            sub={isMuted ? 'MUDO' : 'LIGADO'}
            active={isMuted}
            activeClass="bg-red-500/20 border-red-400 text-red-200"
            onClick={toggleMute}
          />
        </div>

        {/* Garagem & Pista */}
        <span className="block mb-1.5 text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Garagem & Pista</span>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Tile icon="🔧" label="Oficina" sub={tuningStage > 0 ? `STAGE ${tuningStage}` : 'STOCK'} onClick={openAndClose(onOpenTuning)} />
          <Tile icon="🏁" label="402M" sub={best0to100 ? `0-100 ${best0to100.toFixed(2)}s` : 'ARRANCADA'} onClick={openAndClose(onOpenDragStrip)} />
          <Tile icon="📈" label="Dyno" sub="POTÊNCIA" onClick={openAndClose(onOpenDyno)} />
        </div>

        <button
          type="button"
          onClick={onExit}
          className="w-full h-11 rounded-xl border border-white/10 bg-zinc-900 text-zinc-300 font-mono font-black text-xs uppercase tracking-wider active:scale-95 cursor-pointer"
        >
          ← Sair para a garagem
        </button>
      </div>
    </div>
  )
})

