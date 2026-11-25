import { useRef, useMemo } from 'react'
import type React from 'react'

interface PendingSecondaryTap {
  target: HTMLElement
  startX: number
  startY: number
  isRange: boolean
}

const INTERACTIVE_SELECTOR =
  'button:not(:disabled), a[href], [role="button"], input[type="checkbox"]:not(:disabled), input[type="radio"]:not(:disabled), input[type="range"]:not(:disabled), label'

const MAX_TAP_SLOP_PX = 24
const DUPLICATE_CLICK_GUARD_MS = 350

function updateRangeInputFromClientX(input: HTMLInputElement, clientX: number) {
  const rect = input.getBoundingClientRect()
  if (rect.width <= 0) return
  const min = Number(input.min || 0)
  const max = Number(input.max || 100)
  const step = Number(input.step || 1)
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  const raw = min + ratio * (max - min)
  const stepped = step > 0 ? Math.round((raw - min) / step) * step + min : raw
  const clamped = Math.max(min, Math.min(max, stepped))
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  descriptor?.set?.call(input, String(clamped))
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * useSecondaryTouchTapBridge — Garante que toques simultâneos (multitouch) com um segundo dedo
 * (`pointerType === 'touch' && !isPrimary`) acionem botões e controles normalmente mesmo enquanto
 * outro dedo está segurando o acelerador, freio ou embreagem.
 *
 * Motivação: navegadores móveis (Android Chrome / iOS Safari) frequentemente não sintetizam
 * eventos `click` para ponteiros de toque secundários (`isPrimary === false`).
 *
 * - Zero impacto em desktop/mouse e em toques primários isolados.
 * - Proteção em `onClickCapture` garante que nunca haja disparo duplo caso o navegador também
 *   sintetize um `click` nativo logo após o `pointerup`.
 */
export function useSecondaryTouchTapBridge() {
  const pendingRef = useRef<Map<number, PendingSecondaryTap>>(new Map())
  const recentSyntheticRef = useRef<WeakMap<HTMLElement, number>>(new WeakMap())

  return useMemo(() => {
    const onPointerDownCapture = (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'touch' || e.isPrimary) return
      const rawTarget = e.target as HTMLElement | null
      if (!rawTarget) return
      const interactive = rawTarget.closest(INTERACTIVE_SELECTOR) as HTMLElement | null
      if (!interactive || interactive.hasAttribute('data-prevent-secondary-tap-bridge')) return

      const isRange =
        interactive.tagName === 'INPUT' && (interactive as HTMLInputElement).type === 'range'
      pendingRef.current.set(e.pointerId, {
        target: interactive,
        startX: e.clientX,
        startY: e.clientY,
        isRange,
      })

      if (isRange) {
        updateRangeInputFromClientX(interactive as HTMLInputElement, e.clientX)
      }
    }

    const onPointerMoveCapture = (e: React.PointerEvent<HTMLElement>) => {
      const entry = pendingRef.current.get(e.pointerId)
      if (!entry) return
      if (entry.isRange) {
        updateRangeInputFromClientX(entry.target as HTMLInputElement, e.clientX)
        return
      }
      const dist = Math.hypot(e.clientX - entry.startX, e.clientY - entry.startY)
      if (dist > MAX_TAP_SLOP_PX) {
        pendingRef.current.delete(e.pointerId)
      }
    }

    const onPointerUpCapture = (e: React.PointerEvent<HTMLElement>) => {
      const entry = pendingRef.current.get(e.pointerId)
      if (!entry) return
      pendingRef.current.delete(e.pointerId)

      if (entry.isRange) return
      const dist = Math.hypot(e.clientX - entry.startX, e.clientY - entry.startY)
      if (dist > MAX_TAP_SLOP_PX) return

      const el = entry.target
      if (!el.isConnected) return
      if ((el as HTMLButtonElement).disabled) return

      // Dispara o click sintético para ativar o handler React onClick do controle
      el.click()
      recentSyntheticRef.current.set(el, performance.now())
    }

    const onPointerCancelCapture = (e: React.PointerEvent<HTMLElement>) => {
      pendingRef.current.delete(e.pointerId)
    }

    const onClickCapture = (e: React.MouseEvent<HTMLElement>) => {
      if (!e.isTrusted) return
      const rawTarget = e.target as HTMLElement | null
      if (!rawTarget) return
      const interactive = rawTarget.closest(INTERACTIVE_SELECTOR) as HTMLElement | null
      if (!interactive || interactive.hasAttribute('data-prevent-secondary-tap-bridge')) return

      const lastSynth = recentSyntheticRef.current.get(interactive)
      if (lastSynth !== undefined && performance.now() - lastSynth < DUPLICATE_CLICK_GUARD_MS) {
        recentSyntheticRef.current.delete(interactive)
        e.stopPropagation()
        e.preventDefault()
      }
    }

    return {
      onPointerDownCapture,
      onPointerMoveCapture,
      onPointerUpCapture,
      onPointerCancelCapture,
      onClickCapture,
    }
  }, [])
}
