import { useEffect, useRef } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import type { VehicleConfig } from '@/types'
import { clamp } from '@/utils/math'

/**
 * useKeyboardControls — Suporte a controles analógicos por teclado no PC.
 *
 * Mapeamento universal:
 * - W / ArrowUp   = Acelerador (Throttle) — todos os veículos
 * - E / ArrowDown = Freio (Brake) — todos os veículos
 * - Q             = Embreagem (Clutch) — APENAS veículos manuais com hasClutch
 *
 * Mapeamento adicional (CVT com modo manual):
 * - ] ou ArrowRight = Upshift (M+ — marcha acima no modo manual simulado)
 * - [ ou ArrowLeft  = Downshift (M− — marcha abaixo no modo manual simulado)
 * - M               = Toggle AUTO ↔ MANUAL SIMULADO (apenas CVTs)
 * - T               = Toggle TCS ON/OFF
 *
 * Aplica interpolação suave (~100-150ms) para simular o curso físico do pedal.
 */
export function useKeyboardControls(vehicle?: VehicleConfig | null) {
  const setThrottle = useSimulationStore((s) => s.setThrottle)
  const setBrake = useSimulationStore((s) => s.setBrake)
  const setClutch = useSimulationStore((s) => s.setClutch)
  const shiftUp = useSimulationStore((s) => s.shiftUp)
  const shiftDown = useSimulationStore((s) => s.shiftDown)
  const toggleSimulatedManual = useSimulationStore((s) => s.toggleSimulatedManual)
  const setTcsEnabled = useSimulationStore((s) => s.setTcsEnabled)
  const tcsEnabled = useSimulationStore((s) => s.tcsEnabled)
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const isRunning = useSimulationStore((s) => s.isRunning)

  const keysPressedRef = useRef({ w: false, e: false, q: false })
  const valuesRef = useRef({ throttle: 0, brake: 0, clutch: 0 })

  const hasClutch = vehicle?.transmission.hasClutch ?? false
  const hasManualMode = vehicle?.transmission.hasManualMode ?? false
  const isManualSimulated = transmissionMode === 'manual_simulated'

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignora se o usuário estiver digitando em um input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const key = event.key.toLowerCase()

      // Acelerador
      if (key === 'w' || key === 'arrowup') {
        keysPressedRef.current.w = true
      }
      // Freio
      else if (key === 'e' || key === 'arrowdown') {
        keysPressedRef.current.e = true
      }
      // Embreagem — apenas veículos manuais convencionais
      else if (key === 'q') {
        if (hasClutch) {
          keysPressedRef.current.q = true
        }
      }
      // Subir marcha: [ ou ArrowRight (sem repetição por segurar a tecla)
      else if ((key === '[' || key === 'arrowright') && isRunning) {
        if (!event.repeat) {
          shiftUp()
        }
      }
      // Reduzir marcha: ] ou ArrowLeft (sem repetição por segurar a tecla)
      else if ((key === ']' || key === 'arrowleft') && isRunning) {
        if (!event.repeat) {
          shiftDown()
        }
      }
      // Toggle AUTO ↔ MANUAL SIMULADO — M (sem event.repeat para evitar spam)
      else if (key === 'm' && hasManualMode && !event.repeat && isRunning) {
        toggleSimulatedManual()
      }
      // Toggle TCS — T
      else if (key === 't' && !event.repeat) {
        setTcsEnabled(!tcsEnabled)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'w' || key === 'arrowup') {
        keysPressedRef.current.w = false
      } else if (key === 'e' || key === 'arrowdown') {
        keysPressedRef.current.e = false
      } else if (key === 'q') {
        keysPressedRef.current.q = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    let active = true
    const loop = () => {
      if (!active) return

      let changed = false
      const keys = keysPressedRef.current
      const vals = valuesRef.current

      // ─── Acelerador (W): sobe em ~120ms, desce em ~100ms ───
      if (keys.w && isRunning) {
        if (vals.throttle < 1) {
          vals.throttle = clamp(vals.throttle + 0.14, 0, 1)
          changed = true
        }
      } else if (vals.throttle > 0) {
        vals.throttle = clamp(vals.throttle - 0.18, 0, 1)
        changed = true
      }

      // ─── Freio (E): sobe em ~80ms, desce em ~100ms ───
      if (keys.e) {
        if (vals.brake < 1) {
          vals.brake = clamp(vals.brake + 0.18, 0, 1)
          changed = true
        }
      } else if (vals.brake > 0) {
        vals.brake = clamp(vals.brake - 0.22, 0, 1)
        changed = true
      }

      // ─── Embreagem (Q): apenas se o veículo tiver embreagem física ───
      if (hasClutch) {
        if (keys.q) {
          if (vals.clutch < 1) {
            vals.clutch = clamp(vals.clutch + 0.16, 0, 1)
            changed = true
          }
        } else if (vals.clutch > 0) {
          vals.clutch = clamp(vals.clutch - 0.20, 0, 1)
          changed = true
        }
      }

      if (changed) {
        setThrottle(vals.throttle)
        setBrake(vals.brake)
        if (hasClutch) {
          setClutch(vals.clutch)
        }
      }

      requestAnimationFrame(loop)
    }

    requestAnimationFrame(loop)

    return () => {
      active = false
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    hasClutch,
    hasManualMode,
    isManualSimulated,
    isRunning,
    tcsEnabled,
    setThrottle,
    setBrake,
    setClutch,
    shiftUp,
    shiftDown,
    toggleSimulatedManual,
    setTcsEnabled,
  ])
}
