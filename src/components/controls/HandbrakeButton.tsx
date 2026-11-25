import { memo, useRef } from 'react'

export interface HandbrakeButtonProps {
  active: boolean
  onToggle: () => void
  variant?: 'mobile_portrait' | 'mobile_landscape' | 'desktop'
  className?: string
}

/**
 * HandbrakeButton — Controle de freio de mão dedicado e seguro para Multitouch (Fase 4.4.2.2).
 *
 * Motivação técnica:
 * - Em smartphones (Android Chrome / WebView / iOS Safari), quando o Dedo 1 já está segurando
 *   um `AnalogPedal` (acelerador ou freio, `isPrimary = true`), um segundo dedo (`!e.isPrimary`)
 *   tocando em um `<button onClick=...>` convencional NÃO gera evento `click` sintetizado.
 * - Este componente responde instantaneamente em `onPointerDown` para QUALQUER `pointerId`
 *   (primário ou secundário), isolando a propagação sem cancelar nem interferir nos pedais,
 *   e suprime o `click` sintético subsequente para nunca disparar duas vezes.
 */
export const HandbrakeButton = memo(function HandbrakeButton({
  active,
  onToggle,
  variant = 'mobile_portrait',
  className = '',
}: HandbrakeButtonProps) {
  const lastPointerActivateMsRef = useRef<number>(0)
  const handledPointersRef = useRef<Set<number>>(new Set())

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.stopPropagation()

    // Evita repetição pelo mesmo ponteiro ainda apoiado
    if (handledPointersRef.current.has(e.pointerId)) return
    handledPointersRef.current.add(e.pointerId)

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Ignora em ambientes sintéticos sem capture
    }

    lastPointerActivateMsRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
    onToggle()
  }

  const clearPointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    handledPointersRef.current.delete(e.pointerId)
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignora
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    // Ignora click sintético gerado logo após o pointerdown (preserva apenas ativação por teclado Enter/Espaço)
    if (now - lastPointerActivateMsRef.current < 450) {
      e.preventDefault()
      return
    }
    onToggle()
  }

  if (variant === 'desktop') {
    return (
      <button
        type="button"
        data-testid="btn-handbrake"
        data-prevent-secondary-tap-bridge="true"
        aria-pressed={active}
        aria-label="Freio de mão"
        onPointerDown={handlePointerDown}
        onPointerUp={clearPointer}
        onPointerCancel={clearPointer}
        onLostPointerCapture={clearPointer}
        onPointerLeave={clearPointer}
        onClick={handleClick}
        style={{ touchAction: 'none' }}
        className={`px-2.5 py-2 rounded-xl border font-mono text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer select-none ${
          active
            ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.8)]'
            : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
        } ${className}`}
        title="Tecla Espaço — Freio de mão"
      >
        (P) {active ? 'TRAVADO' : 'FREIO'}
      </button>
    )
  }

  if (variant === 'mobile_landscape') {
    return (
      <button
        type="button"
        data-testid="btn-handbrake"
        data-prevent-secondary-tap-bridge="true"
        aria-pressed={active}
        aria-label="Freio de mão"
        onPointerDown={handlePointerDown}
        onPointerUp={clearPointer}
        onPointerCancel={clearPointer}
        onLostPointerCapture={clearPointer}
        onPointerLeave={clearPointer}
        onClick={handleClick}
        style={{ touchAction: 'none' }}
        className={`h-11 rounded-xl border font-mono font-black uppercase leading-none flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm select-none ${
          active
            ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.8)]'
            : 'bg-zinc-900 border-white/10 text-zinc-400'
        } ${className}`}
      >
        <span className="text-[10.5px] sm:text-xs pointer-events-none">(P)</span>
        <span className="text-[6px] sm:text-[6.5px] mt-0.5 pointer-events-none">
          {active ? 'PUXADO' : 'F. MÃO'}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      data-testid="btn-handbrake"
      data-prevent-secondary-tap-bridge="true"
      aria-pressed={active}
      aria-label="Freio de mão"
      onPointerDown={handlePointerDown}
      onPointerUp={clearPointer}
      onPointerCancel={clearPointer}
      onPointerLeave={clearPointer}
      onClick={handleClick}
      style={{ touchAction: 'none' }}
      className={`h-10 rounded-xl border font-mono font-black uppercase leading-none flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm select-none ${
        active
          ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.7)]'
          : 'bg-zinc-900 text-zinc-400 border-white/10'
      } ${className}`}
    >
      <span className="text-[11px] pointer-events-none">(P)</span>
      <span className="text-[6px] mt-0.5 pointer-events-none">{active ? 'PUXADO' : 'F. MÃO'}</span>
    </button>
  )
})
