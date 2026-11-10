import { useEffect, useRef } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore } from '@/stores/useUIStore'
import type { VehicleConfig } from '@/types'
import { clamp } from '@/utils/math'

/**
 * useKeyboardControls — Suporte a controles analógicos por teclado no PC.
 *
 * Mapeamento universal:
 * - W / ArrowUp   = Acelerador (Throttle) — todos os veículos
 * - E / ArrowDown = Freio (Brake) — todos os veículos
 * - Q             = Embreagem (Clutch) — APENAS veículos manuais com hasClutch
 * - Espaço        = Freio de Mão (Handbrake)
 * - H             = Buzina (Horn)
 *
 * Mapeamento adicional (CVT / Sequencial):
 * - [ ou ArrowRight = Upshift (subir marcha)
 * - ] ou ArrowLeft  = Downshift (reduzir marcha)
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
  const selectPark = useSimulationStore((s) => s.selectPark)
  const selectReverse = useSimulationStore((s) => s.selectReverse)
  const selectNeutral = useSimulationStore((s) => s.selectNeutral)
  const selectDrive = useSimulationStore((s) => s.selectDrive)
  const toggleSimulatedManual = useSimulationStore((s) => s.toggleSimulatedManual)
  const setTcsEnabled = useSimulationStore((s) => s.setTcsEnabled)
  const setHandbrake = useSimulationStore((s) => s.setHandbrake)
  const setHorn = useSimulationStore((s) => s.setHorn)
  const tcsEnabled = useSimulationStore((s) => s.tcsEnabled)
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const setActiveKey = useUIStore((s) => s.setActiveKey)

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
        setActiveKey('w', true)
      }
      // Freio
      else if (key === 'e' || key === 'arrowdown') {
        keysPressedRef.current.e = true
        setActiveKey('e', true)
      }
      // Embreagem — apenas veículos manuais convencionais
      else if (key === 'q') {
        if (hasClutch) {
          keysPressedRef.current.q = true
          setActiveKey('q', true)
        }
      }
      // Freio de mão (Espaço)
      else if (key === ' ') {
        event.preventDefault()
        setActiveKey('space', true)
        setHandbrake(true)
      }
      // Buzina (H)
      else if (key === 'h') {
        setActiveKey('horn', true)
        setHorn(true)
      }
      // Subir marcha: [ ou ArrowRight (sem repetição por segurar a tecla)
      else if ((key === '[' || key === 'arrowright') && isRunning) {
        setActiveKey('up', true)
        setTimeout(() => setActiveKey('up', false), 150)
        if (!event.repeat) {
          shiftUp()
        }
      }
      // Reduzir marcha: ] ou ArrowLeft (sem repetição por segurar a tecla)
      else if ((key === ']' || key === 'arrowleft') && isRunning) {
        setActiveKey('down', true)
        setTimeout(() => setActiveKey('down', false), 150)
        if (!event.repeat) {
          shiftDown()
        }
      }
      // Toggle AUTO ↔ MANUAL SIMULADO — M (sem event.repeat para evitar spam)
      else if (key === 'm' && hasManualMode && !event.repeat && isRunning) {
        toggleSimulatedManual()
      }
      // Modos Automáticos de Câmbio: P (Park), R (Reverse), N (Neutral), D (Drive)
      else if (key === 'p' && !event.repeat && isRunning) {
        selectPark()
      }
      else if (key === 'r' && !event.repeat && isRunning) {
        selectReverse()
      }
      else if (key === 'n' && !event.repeat && isRunning) {
        selectNeutral()
      }
      else if (key === 'd' && !event.repeat && isRunning) {
        selectDrive()
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
        setActiveKey('w', false)
      } else if (key === 'e' || key === 'arrowdown') {
        keysPressedRef.current.e = false
        setActiveKey('e', false)
      } else if (key === 'q') {
        keysPressedRef.current.q = false
        setActiveKey('q', false)
      } else if (key === ' ') {
        setActiveKey('space', false)
        setHandbrake(false)
      } else if (key === 'h') {
        setActiveKey('horn', false)
        setHorn(false)
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
    setHandbrake,
    setHorn,
    setActiveKey,
  ])
}
