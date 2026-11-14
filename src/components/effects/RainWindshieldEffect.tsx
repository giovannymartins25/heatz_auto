import { memo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore } from '@/stores/useUIStore'

/**
 * RainWindshieldEffect — Efeito de chuva dinâmica no para-brisa e limpadores funcionais.
 *
 * Gera gotas de água, pista molhada com redução de atrito e palhetas de limpador
 * oscilando no vidro com animação física realista.
 * O perfil gráfico ajusta apenas a densidade visual sem alterar o atrito físico da pista.
 */
export const RainWindshieldEffect = memo(function RainWindshieldEffect() {
  const isRaining = useSimulationStore((s) => s.isRaining)
  const isWiperActive = useSimulationStore((s) => s.isWiperActive)
  const graphicProfile = useUIStore((s) => s.graphicProfile)

  if (!isRaining) return null

  const isEco = graphicProfile === 'eco'
  const isHigh = graphicProfile === 'high'
  const dropCount = isEco ? 14 : graphicProfile === 'normal' ? 38 : 52

  return (
    <div className="fixed inset-0 pointer-events-none z-35 overflow-hidden select-none">
      {/* ─── Gotas e Linhas de Chuva no Vidro ─── */}
      <div className={`absolute inset-0 bg-sky-950/15 ${isEco ? '' : isHigh ? 'backdrop-blur-[1px]' : 'backdrop-blur-[0.5px]'}`}>
        {/* Camada atmosférica de chuva contínua (omitida/simplificada no modo ECO) */}
        {!isEco && (
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#93c5fd_1px,transparent_1px)] [background-size:24px_24px] animate-pulse" />
        )}
        {isHigh && (
          <div className="absolute inset-0 bg-gradient-to-b from-sky-300/10 via-transparent to-sky-950/20" />
        )}

        {/* Gotas estáticas condensadas no para-brisa */}
        {Array.from({ length: dropCount }).map((_, i) => {
          const top = ((i * 37) % 95) + '%'
          const left = ((i * 47) % 95) + '%'
          const size = 3 + (i % 4) * 2
          return (
            <div
              key={i}
              className={`absolute rounded-full bg-white/40 border border-white/60 ${isEco ? '' : 'shadow-[0_1px_4px_rgba(255,255,255,0.4)]'}`}
              style={{
                top,
                left,
                width: `${size}px`,
                height: `${size * 1.5}px`,
                transform: 'rotate(-12deg)',
              }}
            />
          )
        })}
      </div>

      {/* ─── Palhetas do Limpador de Para-brisa (Braço Duplo) ─── */}
      {isWiperActive && (
        <div className="absolute inset-x-0 bottom-0 h-96 flex justify-around">
          {/* Palheta do Lado do Motorista */}
          <div className="relative w-48 h-full origin-bottom-left animate-[wiperSweep_1.3s_ease-in-out_infinite_alternate]">
            <div className="absolute bottom-0 left-12 w-2 h-72 bg-gradient-to-t from-zinc-950 via-zinc-800 to-zinc-900 rounded-full border border-white/20 shadow-xl" />
            <div className="absolute top-4 left-6 w-32 h-2.5 bg-black rounded border-t border-white/30 rotate-12 shadow-lg" />
          </div>

          {/* Palheta do Lado do Passageiro */}
          <div className="relative w-48 h-full origin-bottom-left animate-[wiperSweep_1.3s_ease-in-out_infinite_alternate]">
            <div className="absolute bottom-0 left-16 w-2 h-64 bg-gradient-to-t from-zinc-950 via-zinc-800 to-zinc-900 rounded-full border border-white/20 shadow-xl" />
            <div className="absolute top-6 left-8 w-28 h-2.5 bg-black rounded border-t border-white/30 rotate-12 shadow-lg" />
          </div>
        </div>
      )}

      {/* Indicador discreto de chuva ativa */}
      <div className="absolute top-14 left-4 z-40 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-950/80 border border-sky-400/30 text-sky-300 font-mono text-[9px] font-bold shadow-lg">
        <span>🌧️</span>
        <span>PISTA MOLHADA · -32% ATRITO</span>
      </div>
    </div>
  )
})

