import { memo } from 'react'

export interface PwaUpdatePromptProps {
  needRefresh: boolean
  onUpdate: () => void
  version: string
  buildId?: string
}

export const PwaUpdatePrompt = memo(function PwaUpdatePrompt({
  needRefresh,
  onUpdate,
  version,
  buildId,
}: PwaUpdatePromptProps) {
  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs bg-zinc-900/95 border border-sky-500/50 shadow-[0_0_25px_rgba(14,165,233,0.3)] backdrop-blur-md rounded-xl p-3.5 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
        <span className="text-xs font-bold text-white tracking-tight">Nova versão disponível</span>
      </div>
      <p className="text-[11px] font-mono text-zinc-400 leading-tight">
        Heatz Auto v{version} foi atualizado. Toque abaixo para carregar as novas melhorias.
      </p>
      {buildId && (
        <span className="text-[9px] font-mono text-zinc-500 truncate">
          Build: {buildId}
        </span>
      )}
      <div className="flex items-center justify-end gap-2 mt-1">
        <button
          onClick={onUpdate}
          className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 active:scale-95 text-zinc-950 font-mono text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-sky-500/20"
        >
          Atualizar Agora
        </button>
      </div>
    </div>
  )
})
