import { clamp } from '@/utils/math'

export const ZERO_TO_HUNDRED_STOP_KMH = 0.3
export const ZERO_TO_HUNDRED_LAUNCH_KMH = 0.6
export const ZERO_TO_HUNDRED_ROLLING_DISARM_KMH = 5
export const ZERO_TO_HUNDRED_MAX_NEUTRAL_SECONDS = 1.5

export interface ZeroToHundredState {
  isTiming: boolean
  armed: boolean
  elapsedSeconds: number
  neutralSeconds: number
  lastCompleted: number | null
  bestCompleted: number | null
  currentDisplay: number | null
}

export interface ZeroToHundredStepInput {
  prevSpeedKmh: number
  speedKmh: number
  gear: number
  throttle: number
  brake: number
  handbrake: boolean
  isRunning: boolean
  deltaTime: number
}

export interface ZeroToHundredStepResult {
  state: ZeroToHundredState
  completedRun: number | null
  isNewBest: boolean
}

export function createInitialZeroToHundredState(
  overrides?: Partial<ZeroToHundredState>,
): ZeroToHundredState {
  return {
    isTiming: false,
    armed: true,
    elapsedSeconds: 0,
    neutralSeconds: 0,
    lastCompleted: null,
    bestCompleted: null,
    currentDisplay: null,
    ...overrides,
  }
}

export function formatZeroToHundredSeconds(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return '--'
  }
  return `${seconds.toFixed(1).replace('.', ',')} s`
}

/**
 * Avança a máquina de estados determinística da medição de 0 a 100 km/h.
 * - Usa estritamente o deltaTime físico da simulação (imune a pausas de clock).
 * - Exige repouso completo (<= 0.3 km/h) para armar nova medição.
 * - Mantém lastCompleted preservado durante tentativas em andamento e abortadas.
 */
export function stepZeroToHundredTimer(
  current: ZeroToHundredState,
  input: ZeroToHundredStepInput,
): ZeroToHundredStepResult {
  const {
    prevSpeedKmh,
    speedKmh,
    gear,
    throttle,
    brake,
    handbrake,
    isRunning,
    deltaTime,
  } = input

  if (deltaTime < 0) {
    return { state: current, completedRun: null, isNewBest: false }
  }

  let {
    isTiming,
    armed,
    elapsedSeconds,
    neutralSeconds,
    lastCompleted,
    bestCompleted,
    currentDisplay,
  } = current

  // 1. Re-arma apenas quando o veículo estiver completamente parado
  if (!isTiming) {
    if (speedKmh <= ZERO_TO_HUNDRED_STOP_KMH) {
      armed = true
    }

    const canLaunchFromRest =
      armed &&
      isRunning &&
      gear > 0 &&
      !handbrake &&
      brake < 0.3 &&
      throttle > 0.15

    if (
      canLaunchFromRest &&
      speedKmh >= ZERO_TO_HUNDRED_LAUNCH_KMH &&
      prevSpeedKmh < ZERO_TO_HUNDRED_ROLLING_DISARM_KMH
    ) {
      const span = speedKmh - prevSpeedKmh
      const initialSlice =
        span > 1e-6 && prevSpeedKmh < ZERO_TO_HUNDRED_LAUNCH_KMH
          ? deltaTime * clamp((speedKmh - ZERO_TO_HUNDRED_LAUNCH_KMH) / span, 0, 1)
          : deltaTime

      isTiming = true
      armed = false
      elapsedSeconds = initialSlice
      neutralSeconds = 0
      currentDisplay = Math.round(elapsedSeconds * 100) / 100

      // Caso extremo em que já atingiu 100 km/h no mesmo passo
      if (speedKmh >= 100) {
        const rounded = Math.max(0.01, Math.round(elapsedSeconds * 100) / 100)
        const isNewBest = bestCompleted === null || rounded < bestCompleted
        return {
          state: {
            isTiming: false,
            armed: false,
            elapsedSeconds: 0,
            neutralSeconds: 0,
            lastCompleted: rounded,
            bestCompleted: isNewBest ? rounded : bestCompleted,
            currentDisplay: rounded,
          },
          completedRun: rounded,
          isNewBest,
        }
      }

      return {
        state: {
          isTiming,
          armed,
          elapsedSeconds,
          neutralSeconds,
          lastCompleted,
          bestCompleted,
          currentDisplay,
        },
        completedRun: null,
        isNewBest: false,
      }
    }

    // Se embalou sem atender aos critérios de largada a partir do repouso, desarma até parar novamente
    if (speedKmh >= ZERO_TO_HUNDRED_ROLLING_DISARM_KMH) {
      armed = false
    }

    return {
      state: {
        isTiming: false,
        armed,
        elapsedSeconds: 0,
        neutralSeconds: 0,
        lastCompleted,
        bestCompleted,
        currentDisplay,
      },
      completedRun: null,
      isNewBest: false,
    }
  }

  // 2. Medição em andamento: verificar conclusão em >= 100 km/h
  if (speedKmh >= 100) {
    const span = speedKmh - prevSpeedKmh
    const crossingFraction =
      span > 1e-6 && prevSpeedKmh < 100
        ? clamp((100 - prevSpeedKmh) / span, 0, 1)
        : 1
    const exactElapsed = elapsedSeconds + deltaTime * crossingFraction
    const rounded = Math.max(0.01, Math.round(exactElapsed * 100) / 100)
    const isNewBest = bestCompleted === null || rounded < bestCompleted

    return {
      state: {
        isTiming: false,
        armed: false,
        elapsedSeconds: 0,
        neutralSeconds: 0,
        lastCompleted: rounded,
        bestCompleted: isNewBest ? rounded : bestCompleted,
        currentDisplay: rounded,
      },
      completedRun: rounded,
      isNewBest,
    }
  }

  // 3. Verificar abortamento da tentativa (nunca sobrescreve lastCompleted)
  const neutralExceeded =
    gear === 0 && neutralSeconds + deltaTime > ZERO_TO_HUNDRED_MAX_NEUTRAL_SECONDS

  const aborted =
    !isRunning ||
    handbrake ||
    gear < 0 ||
    brake >= 0.35 ||
    (speedKmh <= ZERO_TO_HUNDRED_STOP_KMH && elapsedSeconds > 0.25) ||
    neutralExceeded

  if (aborted) {
    return {
      state: {
        isTiming: false,
        armed: speedKmh <= ZERO_TO_HUNDRED_STOP_KMH,
        elapsedSeconds: 0,
        neutralSeconds: 0,
        lastCompleted,
        bestCompleted,
        currentDisplay: lastCompleted,
      },
      completedRun: null,
      isNewBest: false,
    }
  }

  // 4. Segue cronometrando normalmente
  const nextElapsed = elapsedSeconds + deltaTime
  const nextNeutralSeconds = gear === 0 ? neutralSeconds + deltaTime : 0

  return {
    state: {
      isTiming: true,
      armed: false,
      elapsedSeconds: nextElapsed,
      neutralSeconds: nextNeutralSeconds,
      lastCompleted,
      bestCompleted,
      currentDisplay: Math.round(nextElapsed * 100) / 100,
    },
    completedRun: null,
    isNewBest: false,
  }
}

