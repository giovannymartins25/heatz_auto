import { memo } from 'react'
import { useUIStore } from '@/stores/useUIStore'
import { useSimulationStore } from '@/stores/useSimulationStore'

interface KeyboardHUDProps {
  hasClutch?: boolean
}

/**
 * KeyboardHUD — Indicador visual em tempo real das teclas físicas pressionadas no PC e status do veículo.
 *
 * Exibe feedback luminoso dinâmico para W, E, Q, [, ], Espaço, H, V, L e C.
 */
export const KeyboardHUD = memo(function KeyboardHUD({
  hasClutch = false,
}: KeyboardHUDProps) {
  const activeKeys = useUIStore((s) => s.activeKeys)
  const handbrake = useSimulationStore((s) => s.handbrake)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const isRaining = useSimulationStore((s) => s.isRaining)

  return (
    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950/80 border border-white/10 text-[10px] font-mono shadow-md select-none backdrop-blur-md">
      <span className="text-zinc-600 font-bold uppercase text-[9px] mr-1">PC Keys:</span>

      {/* [W] Acelerador */}
      <span
        className={`px-2 py-0.5 rounded font-bold transition-all ${
          activeKeys.w
            ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.8)] scale-105'
            : 'bg-zinc-900 text-zinc-400 border border-white/5'
        }`}
      >
        W · Acel
      </span>

      {/* [E] Freio */}
      <span
        className={`px-2 py-0.5 rounded font-bold transition-all ${
          activeKeys.e
            ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.8)] scale-105'
            : 'bg-zinc-900 text-zinc-400 border border-white/5'
        }`}
      >
        E · Freio
      </span>

      {/* [Q] Embreagem (Apenas se tiver) */}
      {hasClutch && (
        <span
          className={`px-2 py-0.5 rounded font-bold transition-all ${
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
        className={`px-2 py-0.5 rounded font-bold transition-all ${
          activeKeys.up || activeKeys.down
            ? 'bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.8)] scale-105'
            : 'bg-zinc-900 text-zinc-400 border border-white/5'
        }`}
      >
        [ / ] · Marcha
      </span>

      {/* [Espaço] Freio de Mão */}
      <span
        className={`px-2 py-0.5 rounded font-bold transition-all ${
          activeKeys.space || handbrake
            ? 'bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.8)] scale-105'
            : 'bg-zinc-900 text-zinc-400 border border-white/5'
        }`}
      >
        Espaço · Freio
      </span>

      {/* [V] Difusor de Escape */}
      <span
        className={`px-2 py-0.5 rounded font-bold transition-all ${
          exhaustValveOpen
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
            : 'bg-zinc-900 text-zinc-500 border border-white/5'
        }`}
      >
        V · Difusor {exhaustValveOpen ? 'ON' : 'OFF'}
      </span>

      {/* [L] Faróis */}
      <span
        className={`px-2 py-0.5 rounded font-bold transition-all ${
          headlightsMode !== 'off'
            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/60 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
            : 'bg-zinc-900 text-zinc-500 border border-white/5'
        }`}
      >
        L · Luz ({headlightsMode})
      </span>

      {/* [C] Clima */}
      <span
        className={`px-2 py-0.5 rounded font-bold transition-all ${
          isRaining
            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/60 shadow-[0_0_10px_rgba(59,130,246,0.4)]'
            : 'bg-zinc-900 text-zinc-500 border border-white/5'
        }`}
      >
        C · {isRaining ? '🌧️ Chuva' : '☀️ Seco'}
      </span>

      {/* [H] Buzina */}
      <span
        className={`px-2 py-0.5 rounded font-bold transition-all ${
          activeKeys.horn
            ? 'bg-yellow-400 text-black shadow-[0_0_10px_rgba(250,204,21,0.8)] scale-105'
            : 'bg-zinc-900 text-zinc-400 border border-white/5'
        }`}
      >
        H · Buzina
      </span>
    </div>
  )
})
