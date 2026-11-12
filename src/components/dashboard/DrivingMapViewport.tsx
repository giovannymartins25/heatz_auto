import { memo } from 'react'
import type { MapViewportSize } from '@/stores/useUIStore'

interface DrivingMapViewportProps {
  size: MapViewportSize
  onSizeChange: (size: MapViewportSize) => void
  compact?: boolean
}

/** Espaço visual estável para o mapa 2D; não participa da simulação nesta fase. */
export const DrivingMapViewport = memo(function DrivingMapViewport({
  size,
  onSizeChange,
  compact = false,
}: DrivingMapViewportProps) {
  const heightClass = compact
    ? { compact: 'h-[18vh]', balanced: 'h-[23vh]', expanded: 'h-[29vh]' }[size]
    : { compact: 'h-[25vh]', balanced: 'h-[34vh]', expanded: 'h-[43vh]' }[size]

  return (
    <section
      aria-label="Mapa de direção em desenvolvimento"
      className={`relative isolate w-full ${heightClass} min-h-28 overflow-hidden rounded-2xl border border-slate-500/30 bg-[#070b12] shadow-inner transition-[height] duration-200`}
    >
      <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(28deg,transparent_46%,#5b6471_47%,#5b6471_51%,transparent_52%),linear-gradient(112deg,transparent_43%,#39424e_44%,#39424e_47%,transparent_48%),linear-gradient(0deg,transparent_48%,#4b5563_49%,#4b5563_52%,transparent_53%)] [background-size:150px_110px,120px_90px,100px_75px]" />
      <div className="absolute inset-4 rounded-xl border border-black/70 bg-black/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025)]" />
      <div className="absolute left-[28%] top-[19%] h-[24%] w-[31%] rounded-sm bg-black/80" />
      <div className="absolute bottom-[18%] right-[16%] h-[28%] w-[24%] rounded-sm bg-black/80" />
      <div className="absolute left-1/2 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,.9)]">
        <span className="h-2 w-2 rounded-full bg-white" />
      </div>
      <div className="absolute left-2 top-2 rounded-md border border-white/10 bg-black/70 px-2 py-1 font-mono text-[8px] font-bold tracking-wider text-slate-300">
        MAPA 2D · EM DESENVOLVIMENTO
      </div>
      <div className="absolute bottom-2 right-2 z-20 flex rounded-lg border border-white/10 bg-black/80 p-0.5" aria-label="Tamanho do mapa">
        {(['compact', 'balanced', 'expanded'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSizeChange(option)}
            aria-pressed={size === option}
            className={`min-h-7 rounded-md px-1.5 font-mono text-[8px] font-black uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300 ${size === option ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {option === 'compact' ? 'P' : option === 'balanced' ? 'M' : 'G'}
          </button>
        ))}
      </div>
    </section>
  )
})
