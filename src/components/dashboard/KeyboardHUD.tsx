import { memo } from 'react'
import { useUIStore } from '@/stores/useUIStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { canControlExhaustValve } from '@/systems/vehicle/vehicleResolvers'

interface KeyboardHUDProps {
  hasClutch?: boolean
}

/**
 * KeyboardHUD — Indicador visual em tempo real das teclas físicas pressionadas no PC e status do veículo.
 */
export const KeyboardHUD = memo(function KeyboardHUD({
  hasClutch = false,
}: KeyboardHUDProps) {
  const activeKeys = useUIStore((s) => s.activeKeys)
  const handbrake = useSimulationStore((s) => s.handbrake)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const exhaustType = useSimulationStore((s) => s.exhaustType)
  const hasExhaustValveKit = useSimulationStore((s) => s.hasExhaustValveKit)
  const simConfig = useSimulationStore((s) => s._config)
  const showExhaustValve = canControlExhaustValve(simConfig, { exhaustType, hasExhaustValveKit })
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const isRaining = useSimulationStore((s) => s.isRaining)
  const isAutomaticVehicle = useSimulationStore((s) => s.isAutomaticVehicle)
  const gearSelectorPosition = useSimulationStore((s) => s.gearSelectorPosition)
  const hasNosKit = useSimulationStore((s) => s.hasNosKit)
  const nosActive = useSimulationStore((s) => s.nosActive)
  const nosPressurePercent = useSimulationStore((s) => s.nosPressurePercent)
  const isMapOpen = useSimulationStore((s) => s.isMapOpen)

  return (
    <div className="hidden lg:flex flex-wrap items-center justify-center gap-1.5 px-3 py-1 rounded-2xl bg-zinc-950/80 border border-white/10 text-[10px] font-mono shadow-md select-none backdrop-blur-md">
      <span className="text-zinc-500 font-bold uppercase text-[9px] mr-0.5">PC Keys:</span>

      {/* [W] Acelerador */}
      <span
        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
          activeKeys.w
            ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.8)] scale-105'
            : 'bg-zinc-900 text-zinc-400 border border-white/5'
        }`}
      >
        W · Acel
      </span>

      {/* [A / D] Direção exclusiva */}
      <span
        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
          activeKeys.a || activeKeys.d
            ? 'bg-sky-400 text-black shadow-[0_0_10px_rgba(56,189,248,0.8)] scale-105'
            : 'bg-zinc-900 text-zinc-300 border border-white/5'
        }`}
        title="A vira para a esquerda · D vira para a direita"
      >
        {activeKeys.a && !activeKeys.d ? '◀ A' : !activeKeys.a && activeKeys.d ? 'D ▶' : 'A / D'} · Direção
      </span>

      {/* [E] Freio */}
      <span
        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
          activeKeys.e
            ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.8)] scale-105'
            : 'bg-zinc-900 text-zinc-400 border border-white/5'
        }`}
      >
        E · Freio
      </span>

      {/* [Q] Embreagem (Apenas veículos manuais) */}
      {hasClutch && (
        <span
          className={`px-1.5 py-0.5 rounded font-bold transition-all ${
            activeKeys.q
              ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.8)] scale-105'
              : 'bg-zinc-900 text-zinc-400 border border-white/5'
          }`}
        >
          Q · Embr
        </span>
      )}

      {/* [ [ ] / [ ] ] Marchas */}
      <span
        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
          activeKeys.up || activeKeys.down
            ? 'bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.8)] scale-105'
            : 'bg-zinc-900 text-zinc-400 border border-white/5'
        }`}
      >
        [ / ] · Marcha
      </span>

      {/* [Shift+P/R/N/D/S/M] Seletor Automático */}
      {isAutomaticVehicle && (
        <span
          className={`px-1.5 py-0.5 rounded font-bold transition-all ${
            activeKeys.s || gearSelectorPosition === 'S'
              ? 'bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.8)] scale-105'
              : 'bg-zinc-900 text-zinc-300 border border-white/5'
          }`}
          title="Segure Shift + P/R/N/D/S/M para trocar a posição da alavanca automática"
        >
          Shift+P/R/N/D/S/M ({gearSelectorPosition})
        </span>
      )}

      {/* [B] Nitro (NOS) */}
      {hasNosKit && (
        <span
          className={`px-1.5 py-0.5 rounded font-bold transition-all ${
            nosActive || activeKeys.nos
              ? 'bg-cyan-400 text-black shadow-[0_0_12px_rgba(34,211,238,0.9)] scale-105 animate-pulse'
              : 'bg-zinc-900 text-cyan-400/80 border border-cyan-500/30'
          }`}
          title="Segure B para disparar Nitro (NOS)"
        >
          B · NOS ({Math.round(nosPressurePercent)}%)
        </span>
      )}

      {/* [Espaço] Freio de Mão */}
      <span
        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
          activeKeys.space || handbrake
            ? 'bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.8)] scale-105'
            : 'bg-zinc-900 text-zinc-400 border border-white/5'
        }`}
      >
        Espaço · F.Mão
      </span>

      {/* [V] Difusor de Escape (somente quando equipado com upgrade compatível) */}
      {showExhaustValve && (
        <span
          className={`px-1.5 py-0.5 rounded font-bold transition-all ${
            exhaustValveOpen
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
              : 'bg-zinc-900 text-zinc-500 border border-white/5'
          }`}
        >
          V · Difusor {exhaustValveOpen ? 'ON' : 'OFF'}
        </span>
      )}

      {/* [L] Faróis */}
      <span
        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
          headlightsMode !== 'off'
            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/60 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
            : 'bg-zinc-900 text-zinc-500 border border-white/5'
        }`}
      >
        L · Luz ({headlightsMode})
      </span>

      {/* [C] Clima */}
      <span
        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
          isRaining
            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/60 shadow-[0_0_10px_rgba(59,130,246,0.4)]'
            : 'bg-zinc-900 text-zinc-500 border border-white/5'
        }`}
      >
        C · {isRaining ? '🌧️ Chuva' : '☀️ Seco'}
      </span>

      {/* [H] Buzina */}
      <span
        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
          activeKeys.horn
            ? 'bg-yellow-400 text-black shadow-[0_0_10px_rgba(250,204,21,0.8)] scale-105'
            : 'bg-zinc-900 text-zinc-400 border border-white/5'
        }`}
      >
        H · Buzina
      </span>

      {/* [M] Mapa 2D */}
      <span
        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
          activeKeys.map || isMapOpen
            ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.8)] scale-105'
            : 'bg-zinc-900 text-zinc-400 border border-white/5'
        }`}
      >
        M · Mapa {isMapOpen ? 'ON' : 'OFF'}
      </span>
    </div>
  )
})
