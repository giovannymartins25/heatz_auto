import { memo } from 'react'

export interface RotateDeviceOverlayProps {
  onAttemptLock?: () => void
  onPlayInPortrait?: () => void
  onBack?: () => void
}

/**
 * RotateDeviceOverlay — Tela de aviso para orientar o jogador a girar o dispositivo para horizontal,
 * com opção de jogar no novo modo Retrato vertical dedicado.
 */
export const RotateDeviceOverlay = memo(function RotateDeviceOverlay({
  onAttemptLock,
  onPlayInPortrait,
  onBack,
}: RotateDeviceOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/98 p-6 text-center select-none touch-none backdrop-blur-xl">
      {/* Glow de fundo */}
      <div
        className="absolute w-72 h-72 rounded-full opacity-25 blur-3xl pointer-events-none -z-10"
        style={{ background: 'radial-gradient(circle, var(--color-accent), transparent 70%)' }}
      />

      {/* Ícone animado de rotação de celular */}
      <div className="relative w-24 h-24 mb-5 flex items-center justify-center">
        <svg
          viewBox="0 0 100 100"
          className="w-20 h-20 text-[var(--color-accent)] animate-pulse"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Silhueta do smartphone com rotação */}
          <rect
            x="32"
            y="18"
            width="36"
            height="64"
            rx="6"
            className="animate-spin"
            style={{ transformOrigin: '50px 50px', animationDuration: '4s' }}
          />
          {/* Círculo do botão home */}
          <circle cx="50" cy="74" r="2" fill="currentColor" />
          {/* Flechas de rotação circular */}
          <path
            d="M 18 50 A 32 32 0 0 1 82 50"
            strokeDasharray="6 6"
            className="opacity-40"
          />
        </svg>
      </div>

      <span className="text-[11px] font-mono font-black text-[var(--color-accent)] tracking-[0.25em] uppercase mb-2">
        Heatz Auto Cockpit
      </span>

      <h2 className="text-2xl font-black text-white tracking-tight mb-2">
        Vire o celular para jogar
      </h2>

      <p className="text-xs text-zinc-400 font-mono max-w-xs leading-relaxed mb-6">
        O cockpit completo foi otimizado para controle com os polegares em modo horizontal (Landscape).
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {onAttemptLock && (
          <button
            onClick={onAttemptLock}
            className="w-full px-5 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:scale-95 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-red-500/30"
          >
            🔄 Girar Tela Agora
          </button>
        )}

        {onPlayInPortrait && (
          <button
            onClick={onPlayInPortrait}
            className="w-full px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 border border-white/15 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            📱 Continuar em Modo Vertical
          </button>
        )}

        {onBack && (
          <button
            onClick={onBack}
            className="w-full px-4 py-2 text-zinc-500 hover:text-zinc-300 font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
          >
            ← Voltar para Garagem
          </button>
        )}
      </div>
    </div>
  )
})
