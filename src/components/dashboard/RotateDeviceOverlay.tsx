import { memo } from 'react'

export interface RotateDeviceOverlayProps {
  onAttemptLock?: () => void
}

/**
 * RotateDeviceOverlay — Tela de aviso para orientar o jogador a girar o dispositivo para horizontal.
 *
 * Exibido quando o simulador é aberto em celular/tablet na orientação vertical (portrait).
 */
export const RotateDeviceOverlay = memo(function RotateDeviceOverlay({
  onAttemptLock,
}: RotateDeviceOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/98 p-6 text-center select-none touch-none backdrop-blur-xl">
      {/* Glow de fundo */}
      <div
        className="absolute w-72 h-72 rounded-full opacity-25 blur-3xl pointer-events-none -z-10"
        style={{ background: 'radial-gradient(circle, var(--color-accent), transparent 70%)' }}
      />

      {/* Ícone animado de rotação de celular */}
      <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
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
        O cockpit foi projetado para controle com os polegares em modo horizontal (Landscape).
      </p>

      {onAttemptLock && (
        <button
          onClick={onAttemptLock}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
        >
          Girar Tela Agora
        </button>
      )}
    </div>
  )
})
