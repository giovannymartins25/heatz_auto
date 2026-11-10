import { memo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

/**
 * BackfireFlameFlash — Efeito visual de chama de escape e estampidos (Pops & Bangs).
 *
 * Pisca um clarão de fogo alaranjado/âmbar nas bordas e espelho retrovisor
 * quando o escape estipula corte de giro, troca rápida PDK/DSG ou desaceleração brusca.
 */
export const BackfireFlameFlash = memo(function BackfireFlameFlash() {
  const isBackfireFlashing = useSimulationStore((s) => s.isBackfireFlashing)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)

  if (!isBackfireFlashing) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none animate-in fade-in duration-75">
      {/* Clarão inferior de chama no escape */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-orange-600/50 via-amber-500/25 to-transparent blur-md" />

      {/* Labareda estilizada de escape saindo da traseira */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <span className="text-2xl animate-bounce drop-shadow-[0_0_15px_rgba(249,115,22,1)]">
          🔥
        </span>
        <span className="px-2 py-0.5 rounded bg-orange-600/90 text-white font-mono text-[9px] font-black uppercase tracking-wider shadow-[0_0_12px_rgba(249,115,22,0.8)]">
          {exhaustValveOpen ? '💥 POPS & BANGS · FLAME!' : '💥 ESTALO DE ESCAPE!'}
        </span>
        <span className="text-2xl animate-bounce drop-shadow-[0_0_15px_rgba(249,115,22,1)]">
          🔥
        </span>
      </div>

      {/* Reflexo periférico de chama nos cantos */}
      <div className="absolute inset-0 bg-radial from-transparent via-orange-950/10 to-amber-600/20" />
    </div>
  )
})

