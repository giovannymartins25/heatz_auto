import { memo, useRef, useCallback } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'

export interface EngineButtonProps {
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'pill'
  showStatusText?: boolean
}

/**
 * EngineButton — Botão automotivo de Start/Stop Engine de alta fidelidade.
 *
 * Estados visuais e táteis:
 * - OFF: Anel metálico acetinado com LED pulsante suave âmbar convidando a ligar
 * - STARTING (Cranking): Borda rotativa ciano elétrica com aviso visual de partida ativa
 * - RUNNING: Retroiluminação vermelha esportiva com halo luminoso e indicação STOP
 * - STALLED: Alerta de emergência âmbar piscante convidando o piloto a religar
 *
 * Blindado contra toques duplos acidentais (debounce de 400ms e trava durante o cranking).
 */
export const EngineButton = memo(function EngineButton({
  className = '',
  size = 'md',
  showStatusText = false,
}: EngineButtonProps) {
  const isRunning = useSimulationStore((s) => s.isRunning)
  const isStalled = useSimulationStore((s) => s.isStalled)
  const status = useSimulationStore((s) => s.status)
  const damageReason = useSimulationStore((s) => s.damageReason)
  const startEngine = useSimulationStore((s) => s.startEngine)
  const stopEngine = useSimulationStore((s) => s.stopEngine)
  const lastPressRef = useRef(0)

  const isStarting = status === 'starting'

  const handleTrigger = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const now = performance.now()
      if (now - lastPressRef.current < 400) return
      lastPressRef.current = now

      // Se o arranque já estiver girando (cranking), não interrompe
      if (status === 'starting') return

      if (isRunning) {
        HapticFeedback.medium()
        stopEngine()
      } else {
        HapticFeedback.heavy()
        startEngine()
      }
    },
    [isRunning, status, startEngine, stopEngine]
  )

  // Formato compacto tipo pílula para headers superiores
  if (size === 'xs') {
    return (
      <div className={`relative flex items-center select-none touch-none ${className}`}>
        <button
          type="button"
          onPointerDown={handleTrigger}
          onClick={handleTrigger}
          style={{ touchAction: 'none' }}
          disabled={isStarting}
          className={`h-7 px-2 sm:px-2.5 rounded-lg border font-mono font-black text-[8.5px] uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow ${
            isStalled
              ? 'border-amber-400 bg-amber-950/80 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse'
              : isStarting
              ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.7)] animate-pulse'
              : isRunning
              ? 'border-red-500/80 bg-red-950/80 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.4)]'
              : 'border-emerald-500/80 bg-emerald-950/70 text-emerald-300 hover:border-emerald-400 hover:text-white animate-pulse'
          }`}
          title={
            isRunning
              ? 'Desligar motor (STOP)'
              : isStalled
              ? 'Religar motor apagado (RESTART)'
              : isStarting
              ? 'Dando partida (CRANK)'
              : 'Ligar motor (START)'
          }
        >
          <div
            className={`w-2 h-2 rounded-full transition-all ${
              isStalled
                ? 'bg-amber-400 animate-ping'
                : isStarting
                ? 'bg-cyan-400 animate-pulse'
                : isRunning
                ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                : 'bg-emerald-500 animate-pulse'
            }`}
          />
          <span>{isStalled ? 'RELIGAR' : isStarting ? 'PARTIDA...' : isRunning ? 'STOP' : 'START'}</span>
        </button>
      </div>
    )
  }

  // Dimensões responsivas do botão circular padrão
  const sizeClasses =
    size === 'sm'
      ? 'w-14 h-14 text-[9px]'
      : size === 'lg'
      ? 'w-20 h-20 text-[11px]'
      : size === 'pill'
      ? 'h-12 px-4 rounded-2xl flex-row gap-2'
      : 'w-16 h-16 text-[10px]' // 'md' padrão

  return (
    <div className={`relative flex flex-col items-center select-none touch-none ${className}`}>
      {/* Halo de Brilho Dinâmico em volta do Botão */}
      <div
        className={`absolute inset-0 rounded-full blur-md transition-all duration-300 pointer-events-none ${
          isStalled
            ? 'bg-amber-500/40 animate-pulse'
            : isStarting
            ? 'bg-cyan-500/50 animate-ping'
            : isRunning
            ? 'bg-red-500/30'
            : 'bg-white/10'
        }`}
      />

      <button
        type="button"
        onPointerDown={handleTrigger}
        onClick={handleTrigger}
        style={{ touchAction: 'none' }}
        disabled={isStarting}
        className={`relative ${sizeClasses} rounded-full border-2 flex flex-col items-center justify-center p-1 transition-all active:scale-95 duration-150 cursor-pointer shadow-xl ${
          isStalled
            ? 'border-amber-400 bg-gradient-to-b from-amber-950/80 via-black to-amber-950/60 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-pulse'
            : isStarting
            ? 'border-cyan-400 bg-gradient-to-b from-cyan-950/80 via-black to-cyan-950/60 text-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.7)] animate-pulse'
            : isRunning
            ? 'border-red-500/80 bg-gradient-to-b from-red-950/80 via-neutral-950 to-red-950/60 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
            : 'border-zinc-700 bg-gradient-to-b from-zinc-800 via-neutral-950 to-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-white'
        }`}
        aria-label={
          isRunning
            ? 'Desligar motor (ENGINE STOP)'
            : isStalled
            ? 'Religar motor apagado (ENGINE RESTART)'
            : isStarting
            ? 'Dando partida no motor (CRANKING)'
            : 'Ligar motor (ENGINE START)'
        }
      >
        {/* Moldura circular concêntrica usinada */}
        <div className="absolute inset-1 rounded-full border border-white/10 pointer-events-none" />

        {/* LED superior de Status */}
        <div
          className={`w-1.5 h-1.5 rounded-full mb-0.5 transition-all ${
            isStalled
              ? 'bg-amber-400 shadow-[0_0_6px_#f59e0b] animate-ping'
              : isStarting
              ? 'bg-cyan-400 shadow-[0_0_6px_#06b6d4] animate-pulse'
              : isRunning
              ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
              : 'bg-zinc-600'
          }`}
        />

        {/* Linha 1: ENGINE / START */}
        <span className="text-[7.5px] font-mono font-bold tracking-widest uppercase opacity-80 leading-none">
          {isStalled ? 'RELIGAR' : isStarting ? 'PARTIDA' : 'ENGINE'}
        </span>

        {/* Linha 2: Ação Principal em Destaque */}
        <span className="font-mono font-black tracking-tighter uppercase my-0.5 leading-none">
          {isStalled ? 'START' : isStarting ? 'CRANK' : isRunning ? 'STOP' : 'START'}
        </span>

        {/* Linha 3: Sub-rótulo */}
        <span className="text-[6.5px] font-mono font-bold tracking-widest uppercase opacity-60 leading-none">
          {isStalled ? 'ESTOLOU' : isStarting ? '...' : isRunning ? 'LIGADO' : 'PUSH'}
        </span>
      </button>

      {/* Legenda Opcional de Status */}
      {showStatusText && (
        <span
          className={`text-[8.5px] font-mono font-bold mt-1 uppercase tracking-wider ${
            isStalled
              ? 'text-amber-400 animate-pulse'
              : isStarting
              ? 'text-cyan-400 animate-pulse'
              : isRunning
              ? 'text-emerald-400'
              : 'text-zinc-500'
          }`}
        >
          {damageReason || (isStalled ? 'Motor Apagou!' : isStarting ? 'Acionando Partida...' : isRunning ? 'Motor Ligado' : 'Toque p/ Ligar')}
        </span>
      )}
    </div>
  )
})
