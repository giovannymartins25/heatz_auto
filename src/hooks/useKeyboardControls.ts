import { useEffect, useRef } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore } from '@/stores/useUIStore'
import type { VehicleConfig } from '@/types'
import { canControlExhaustValve, resolveVehicleControls } from '@/systems/vehicle/vehicleResolvers'
import { clamp } from '@/utils/math'

const STEER_INPUT_RATE = 3.4
const STEER_RETURN_RATE = 5.2

/**
 * useKeyboardControls — Controles progressivos por teclado no Desktop / PC.
 *
 * Em repouso (nenhuma tecla pressionada e pedais/volante em 0), não mantém loop rAF ocioso,
 * eliminando trabalho desnecessário por frame tanto em Mobile quanto em Desktop.
 */
export function useKeyboardControls(vehicle?: VehicleConfig | null, enabled: boolean = true) {
  const sessionMode = useSimulationStore((s) => s.sessionMode)
  const isDriveSession = sessionMode === 'drive'
  const setThrottle = useSimulationStore((s) => s.setThrottle)
  const setBrake = useSimulationStore((s) => s.setBrake)
  const setClutch = useSimulationStore((s) => s.setClutch)
  const shiftUp = useSimulationStore((s) => s.shiftUp)
  const shiftDown = useSimulationStore((s) => s.shiftDown)
  const selectPark = useSimulationStore((s) => s.selectPark)
  const selectReverse = useSimulationStore((s) => s.selectReverse)
  const selectNeutral = useSimulationStore((s) => s.selectNeutral)
  const selectDrive = useSimulationStore((s) => s.selectDrive)
  const selectSport = useSimulationStore((s) => s.selectSport)
  const selectManual = useSimulationStore((s) => s.selectManual)
  const toggleSimulatedManual = useSimulationStore((s) => s.toggleSimulatedManual)
  const toggleExhaustValve = useSimulationStore((s) => s.toggleExhaustValve)
  const cycleHeadlights = useSimulationStore((s) => s.cycleHeadlights)
  const toggleRain = useSimulationStore((s) => s.toggleRain)
  const setTcsEnabled = useSimulationStore((s) => s.setTcsEnabled)
  const setHandbrake = useSimulationStore((s) => s.setHandbrake)
  const setHorn = useSimulationStore((s) => s.setHorn)
  const tcsEnabled = useSimulationStore((s) => s.tcsEnabled)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const isAutomaticVehicle = useSimulationStore((s) => s.isAutomaticVehicle)
  const hasNosKit = useSimulationStore((s) => s.hasNosKit)
  const setNosActive = useSimulationStore((s) => s.setNosActive)
  const purgeNos = useSimulationStore((s) => s.purgeNos)
  const setSteeringAngle = useSimulationStore((s) => s.setSteeringAngle)
  const toggleMap = useSimulationStore((s) => s.toggleMap)
  const setActiveKey = useUIStore((s) => s.setActiveKey)

  const keysPressedRef = useRef({ w: false, e: false, q: false, a: false, d: false })
  const valuesRef = useRef({ throttle: 0, brake: 0, clutch: 0, steering: 0 })

  const hasClutch = vehicle?.transmission.hasClutch ?? false
  const hasManualMode = vehicle?.transmission.hasManualMode ?? false

  useEffect(() => {
    if (!enabled) {
      keysPressedRef.current = { w: false, e: false, q: false, a: false, d: false }
      const hadKeyboardInput =
        valuesRef.current.throttle > 0 ||
        valuesRef.current.brake > 0 ||
        valuesRef.current.clutch > 0 ||
        Math.abs(valuesRef.current.steering) > 0
      valuesRef.current = { throttle: 0, brake: 0, clutch: 0, steering: 0 }
      if (hadKeyboardInput) {
        setThrottle(0)
        setBrake(0)
        setClutch(0)
        if (useSimulationStore.getState().steeringMethod === 'keyboard') {
          setSteeringAngle(0, 'keyboard')
        }
      }
      return
    }

    let active = true
    let lastFrameTime = performance.now()
    let rafId = 0

    const hasPendingRampWork = () => {
      const k = keysPressedRef.current
      const v = valuesRef.current
      return (
        k.w ||
        k.e ||
        k.q ||
        k.a ||
        k.d ||
        v.throttle > 0 ||
        v.brake > 0 ||
        v.clutch > 0 ||
        Math.abs(v.steering) > 0
      )
    }

    const loop = (now: number) => {
      rafId = 0
      if (!active) return

      const dt = clamp((now - lastFrameTime) / 1000, 0.001, 0.05)
      lastFrameTime = now

      let pedalsChanged = false
      let steeringChanged = false
      const keys = keysPressedRef.current
      const vals = valuesRef.current

      // ─── Acelerador (W): sobe em ~120ms, desce em ~100ms ───
      if (keys.w && isRunning) {
        if (vals.throttle < 1) {
          vals.throttle = clamp(vals.throttle + 8.5 * dt, 0, 1)
          pedalsChanged = true
        }
      } else if (vals.throttle > 0) {
        vals.throttle = clamp(vals.throttle - 11.0 * dt, 0, 1)
        pedalsChanged = true
      }

      // ─── Freio (E): sobe em ~80ms, desce em ~100ms ───
      if (keys.e) {
        if (vals.brake < 1) {
          vals.brake = clamp(vals.brake + 11.0 * dt, 0, 1)
          pedalsChanged = true
        }
      } else if (vals.brake > 0) {
        vals.brake = clamp(vals.brake - 13.5 * dt, 0, 1)
        pedalsChanged = true
      }

      // ─── Embreagem (Q): apenas veículos manuais com embreagem física ───
      if (hasClutch) {
        if (keys.q) {
          if (vals.clutch < 1) {
            vals.clutch = clamp(vals.clutch + 10.0 * dt, 0, 1)
            pedalsChanged = true
          }
        } else if (vals.clutch > 0) {
          vals.clutch = clamp(vals.clutch - 12.0 * dt, 0, 1)
          pedalsChanged = true
        }
      }

      // ─── Direção progressiva (A / D): rampa suave sem saltos abruptos ───
      const targetSteer = (keys.d ? 1 : 0) - (keys.a ? 1 : 0)
      if (targetSteer !== 0) {
        const delta = targetSteer - vals.steering
        const maxStep = STEER_INPUT_RATE * dt
        const nextSteer =
          Math.abs(delta) <= maxStep
            ? targetSteer
            : vals.steering + Math.sign(delta) * maxStep
        if (Math.abs(nextSteer - vals.steering) > 1e-4) {
          vals.steering = clamp(nextSteer, -1, 1)
          steeringChanged = true
        }
      } else if (Math.abs(vals.steering) > 0) {
        const maxReturn = STEER_RETURN_RATE * dt
        const nextSteer =
          Math.abs(vals.steering) <= maxReturn
            ? 0
            : vals.steering - Math.sign(vals.steering) * maxReturn
        if (Math.abs(nextSteer - vals.steering) > 1e-4 || nextSteer === 0) {
          vals.steering = nextSteer
          steeringChanged = true
        }
      }

      if (pedalsChanged) {
        setThrottle(vals.throttle)
        setBrake(vals.brake)
        if (hasClutch) {
          setClutch(vals.clutch)
        }
      }

      if (steeringChanged) {
        setSteeringAngle(vals.steering, 'keyboard')
      }

      if (hasPendingRampWork()) {
        rafId = requestAnimationFrame(loop)
      }
    }

    const wakeLoop = () => {
      if (!active || rafId !== 0) return
      lastFrameTime = performance.now()
      rafId = requestAnimationFrame(loop)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const key = event.key.toLowerCase()

      // ─── 1. Seletor de câmbio automático: Shift + P / R / N / D / S / M ───
      if (event.shiftKey) {
        if (key === 'm' && !event.repeat && isRunning && hasManualMode) {
          event.preventDefault()
          selectManual()
          return
        }
        if (key === 'p' && !event.repeat && isRunning && isAutomaticVehicle) {
          event.preventDefault()
          selectPark()
          return
        }
        if (key === 'r' && !event.repeat && isRunning && isAutomaticVehicle) {
          event.preventDefault()
          selectReverse()
          return
        }
        if (key === 'n' && !event.repeat && isRunning) {
          event.preventDefault()
          selectNeutral()
          return
        }
        if (key === 'd' && !event.repeat && isRunning && isAutomaticVehicle) {
          event.preventDefault()
          selectDrive()
          return
        }
        if (key === 's' && !event.repeat && isRunning && isAutomaticVehicle) {
          event.preventDefault()
          setActiveKey('s', true)
          setTimeout(() => setActiveKey('s', false), 200)
          selectSport()
          return
        }
      }

      // ─── 2. Direção exclusiva (A = Esquerda, D = Direita — apenas no Modo Dirigir) ───
      if (key === 'a') {
        if (isDriveSession) {
          keysPressedRef.current.a = true
          setActiveKey('a', true)
          wakeLoop()
        }
        return
      }
      if (key === 'd') {
        if (isDriveSession) {
          keysPressedRef.current.d = true
          setActiveKey('d', true)
          wakeLoop()
        }
        return
      }

      // ─── 3. Pedais e controles de condução ───
      if (key === 'w' || key === 'arrowup') {
        keysPressedRef.current.w = true
        setActiveKey('w', true)
        wakeLoop()
      } else if (key === 'e' || key === 'arrowdown') {
        if (isDriveSession) {
          keysPressedRef.current.e = true
          setActiveKey('e', true)
          wakeLoop()
        }
      } else if (key === 'q') {
        if (isDriveSession && hasClutch) {
          keysPressedRef.current.q = true
          setActiveKey('q', true)
          wakeLoop()
        }
      } else if (key === ' ') {
        event.preventDefault()
        if (isDriveSession) {
          setActiveKey('space', true)
          setHandbrake(true)
        }
      } else if (key === 'h') {
        setActiveKey('horn', true)
        setHorn(true)
      } else if ((key === '[' || key === 'arrowright') && isRunning) {
        setActiveKey('up', true)
        setTimeout(() => setActiveKey('up', false), 150)
        if (!event.repeat) {
          shiftUp()
        }
      } else if ((key === ']' || key === 'arrowleft') && isRunning) {
        setActiveKey('down', true)
        setTimeout(() => setActiveKey('down', false), 150)
        if (!event.repeat) {
          shiftDown()
        }
      } else if (key === 'm' && !event.repeat) {
        if (isDriveSession) {
          setActiveKey('map', true)
          setTimeout(() => setActiveKey('map', false), 200)
          toggleMap()
        }
      } else if (key === 'k' && hasManualMode && !event.repeat && isRunning) {
        toggleSimulatedManual()
      } else if (key === 't' && !event.repeat) {
        const tcsSpec = vehicle ? resolveVehicleControls(vehicle).tractionControl : null
        if (!tcsSpec || (tcsSpec.available && tcsSpec.userToggleable)) {
          setTcsEnabled(!tcsEnabled)
        }
      } else if (key === 'v' && !event.repeat) {
        const st = useSimulationStore.getState()
        if (
          canControlExhaustValve(vehicle ?? st._config, {
            exhaustType: st.exhaustType,
            hasExhaustValveKit: st.hasExhaustValveKit,
          })
        ) {
          toggleExhaustValve()
        }
      } else if (key === 'l' && !event.repeat) {
        cycleHeadlights()
      } else if (key === 'c' && !event.repeat) {
        toggleRain()
      } else if (key === 'b' && hasNosKit && isRunning) {
        setNosActive(true)
        setActiveKey('nos', true)
      } else if (key === 'x' && !event.repeat && hasNosKit) {
        purgeNos()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'w' || key === 'arrowup') {
        keysPressedRef.current.w = false
        setActiveKey('w', false)
        wakeLoop()
      } else if (key === 'e' || key === 'arrowdown') {
        keysPressedRef.current.e = false
        setActiveKey('e', false)
        wakeLoop()
      } else if (key === 'q') {
        keysPressedRef.current.q = false
        setActiveKey('q', false)
        wakeLoop()
      } else if (key === 'a') {
        keysPressedRef.current.a = false
        setActiveKey('a', false)
        wakeLoop()
      } else if (key === 'd') {
        keysPressedRef.current.d = false
        setActiveKey('d', false)
        wakeLoop()
      } else if (key === ' ') {
        setActiveKey('space', false)
        setHandbrake(false)
      } else if (key === 'h') {
        setActiveKey('horn', false)
        setHorn(false)
      } else if (key === 'm') {
        setActiveKey('map', false)
      } else if (key === 's') {
        setActiveKey('s', false)
      } else if (key === 'b') {
        setActiveKey('nos', false)
        setNosActive(false)
      }
    }

    const handleWindowBlur = () => {
      keysPressedRef.current = { w: false, e: false, q: false, a: false, d: false }
      setActiveKey('w', false)
      setActiveKey('e', false)
      setActiveKey('q', false)
      setActiveKey('a', false)
      setActiveKey('d', false)
      setActiveKey('space', false)
      setActiveKey('horn', false)
      setActiveKey('nos', false)
      setHandbrake(false)
      setHorn(false)
      setNosActive(false)
      wakeLoop()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)

    if (hasPendingRampWork()) {
      wakeLoop()
    }

    return () => {
      active = false
      if (rafId !== 0) cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [
    enabled,
    isDriveSession,
    vehicle,
    hasClutch,
    hasManualMode,
    hasNosKit,
    isRunning,
    isAutomaticVehicle,
    tcsEnabled,
    setThrottle,
    setBrake,
    setClutch,
    shiftUp,
    shiftDown,
    toggleSimulatedManual,
    toggleExhaustValve,
    cycleHeadlights,
    toggleRain,
    toggleMap,
    setTcsEnabled,
    setHandbrake,
    setHorn,
    setNosActive,
    purgeNos,
    setSteeringAngle,
    selectPark,
    selectReverse,
    selectNeutral,
    selectDrive,
    selectSport,
    selectManual,
    setActiveKey,
  ])
}
