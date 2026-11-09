import { memo } from 'react'
import { useUIStore } from '@/stores/useUIStore'
import { useSimulationStore } from '@/stores/useSimulationStore'

interface KeyboardHUDProps {
  hasClutch?: boolean
}

/**
 * KeyboardHUD — Indicador visual em tempo real das teclas físicas pressionadas no PC.
 *
 * Exibe feedback luminoso dinâmico para W, E, Q, [, ], Espaço e H.
 */
export const KeyboardHUD = memo(function KeyboardHUD({
  hasClutch = false,
}: KeyboardHUDProps) {
  const activeKeys = useUIStore((s) => s.activeKeys)
  const handbrake = useSimulationStore((s) => s.handbrake)

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
        Espaço · Freio Mão
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

