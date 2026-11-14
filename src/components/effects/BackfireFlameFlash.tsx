import { memo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore } from '@/stores/useUIStore'

/**
 * BackfireFlameFlash — Efeito visual de chama de escape e estampidos (Pops & Bangs).
 *
 * Pisca um clarão de fogo alaranjado/âmbar nas bordas e espelho retrovisor
 * quando o escape estipula corte de giro, troca rápida PDK/DSG ou desaceleração brusca.
 * Ajusta apenas camadas de brilho conforme graphicProfile, sem alterar a física.
 */
export const BackfireFlameFlash = memo(function BackfireFlameFlash() {
  const isBackfireFlashing = useSimulationStore((s) => s.isBackfireFlashing)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const nosActive = useSimulationStore((s) => s.nosActive)
  const isNosPurging = useSimulationStore((s) => s.isNosPurging)
  const graphicProfile = useUIStore((s) => s.graphicProfile)

  if (!isBackfireFlashing && !nosActive && !isNosPurging) return null

  const isEco = graphicProfile === 'eco'
  const isHigh = graphicProfile === 'high'

  // 1. Purga de Nitro (NOS Purge Valve)
  if (isNosPurging) {
    return (
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none animate-in fade-in duration-75">
        <div className={`absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-sky-100/40 via-white/20 to-transparent ${isEco ? '' : 'blur-md'}`} />
        <div className="absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <span className={`text-2xl ${isEco ? '' : 'animate-pulse'}`}>💨</span>
          <span className="px-3 py-1 rounded-full bg-cyan-600/90 text-white font-mono text-[10px] font-black uppercase tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.9)] border border-cyan-300">
            💨 PURGA DE NITRO (NOS PURGE) 💨
          </span>
          <span className={`text-2xl ${isEco ? '' : 'animate-pulse'}`}>💨</span>
        </div>
      </div>
    )
  }

  // 2. Injeção de Nitro Ativa (Blue Flame Boost)
  if (nosActive) {
    return (
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none animate-in fade-in duration-75">
        <div className={`absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-cyan-600/60 via-blue-500/30 to-transparent ${isEco ? '' : 'blur-md'}`} />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3">
          <span className={`text-2xl ${isEco ? '' : 'animate-bounce drop-shadow-[0_0_20px_rgba(6,182,212,1)]'}`}>
            ⚡
          </span>
          <span className="px-3 py-1 rounded bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-mono text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(6,182,212,0.9)] border border-cyan-300">
            ⚡ NITRO NOS INJECTION! +120 CV ⚡
          </span>
          <span className={`text-2xl ${isEco ? '' : 'animate-bounce drop-shadow-[0_0_20px_rgba(6,182,212,1)]'}`}>
            ⚡
          </span>
        </div>
        {!isEco && (
          <div className={`absolute inset-0 bg-radial from-transparent ${isHigh ? 'via-cyan-950/30 to-blue-500/40' : 'via-cyan-950/20 to-blue-600/30'}`} />
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none animate-in fade-in duration-75">
      {/* Clarão inferior de chama no escape */}
      <div className={`absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-orange-600/50 via-amber-500/25 to-transparent ${isEco ? '' : 'blur-md'}`} />

      {/* Labareda estilizada de escape saindo da traseira */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <span className={`text-2xl ${isEco ? '' : 'animate-bounce drop-shadow-[0_0_15px_rgba(249,115,22,1)]'}`}>
          🔥
        </span>
        <span className="px-2 py-0.5 rounded bg-orange-600/90 text-white font-mono text-[9px] font-black uppercase tracking-wider shadow-[0_0_12px_rgba(249,115,22,0.8)]">
          {exhaustValveOpen ? '💥 POPS & BANGS · FLAME!' : '💥 ESTALO DE ESCAPE!'}
        </span>
        <span className={`text-2xl ${isEco ? '' : 'animate-bounce drop-shadow-[0_0_15px_rgba(249,115,22,1)]'}`}>
          🔥
        </span>
      </div>

      {/* Reflexo periférico de chama nos cantos (omitido no modo ECO; realçado no ALTO) */}
      {!isEco && (
        <div className={`absolute inset-0 bg-radial from-transparent ${isHigh ? 'via-orange-950/20 to-amber-500/30' : 'via-orange-950/10 to-amber-600/20'}`} />
      )}
    </div>
  )
})

