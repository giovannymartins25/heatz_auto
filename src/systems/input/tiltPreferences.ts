/**
 * tiltPreferences.ts — Persistência validada das preferências de direção mobile por inclinação (Fase 4.4.1).
 *
 * Persiste apenas configurações duráveis do usuário:
 * - Preset de sensibilidade ('low' | 'medium' | 'high')
 * - Inversão do sinal final da direção (boolean)
 * - Zona morta em graus (number)
 * - Calibração de centro neutro (neutralAngleDeg e isCalibrated)
 *
 * Nunca persiste leituras brutas transitórias de acelerômetro/giroscópio.
 */

import { clamp } from '@/utils/math'

export type TiltSensitivityPreset = 'low' | 'medium' | 'high'

export interface TiltSensitivitySpec {
  id: TiltSensitivityPreset
  label: 'Baixa' | 'Média' | 'Alta'
  /** Multiplicador de sensibilidade aplicado a baseMaxAngleDeg (30°) */
  sensitivity: number
  /** Ângulo aproximado de inclinação para batente total das rodas (0.55 rad) */
  fullLockDeg: number
}

export const TILT_SENSITIVITY_PRESETS: Readonly<Record<TiltSensitivityPreset, TiltSensitivitySpec>> = {
  low: {
    id: 'low',
    label: 'Baixa',
    sensitivity: 0.55,
    fullLockDeg: 54.5,
  },
  medium: {
    id: 'medium',
    label: 'Média',
    sensitivity: 0.78,
    fullLockDeg: 38.5,
  },
  high: {
    id: 'high',
    label: 'Alta',
    sensitivity: 1.12,
    fullLockDeg: 26.8,
  },
}

export interface PersistedTiltPreferences {
  sensitivityPreset: TiltSensitivityPreset
  invertDirection: boolean
  deadzoneDeg: number
  neutralAngleDeg: number
  isCalibrated: boolean
}

export const TILT_PREFERENCES_STORAGE_KEY = 'heatz_tilt_preferences_v1'

export const DEFAULT_TILT_PREFERENCES: Readonly<PersistedTiltPreferences> = {
  sensitivityPreset: 'medium',
  invertDirection: false,
  deadzoneDeg: 3.0,
  neutralAngleDeg: 0,
  isCalibrated: false,
}

export function isValidTiltSensitivityPreset(val: unknown): val is TiltSensitivityPreset {
  return val === 'low' || val === 'medium' || val === 'high'
}

export function resolveTiltSensitivityPresetFromValue(sens: number): TiltSensitivityPreset {
  if (!Number.isFinite(sens)) return 'medium'
  if (sens <= 0.66) return 'low'
  if (sens >= 0.95) return 'high'
  return 'medium'
}

export function getStorageSafe(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage
    }
  } catch {
    // Ambiente restrito / sandbox sem localStorage
  }
  return null
}

/**
 * Carrega e valida rigorosamente as preferências persistidas do sensor mobile.
 * Caso os dados estejam ausentes, corrompidos ou fora de faixa, aplica defaults seguros.
 */
export function loadTiltPreferences(): PersistedTiltPreferences {
  const storage = getStorageSafe()
  if (!storage) {
    return { ...DEFAULT_TILT_PREFERENCES }
  }

  try {
    const raw = storage.getItem(TILT_PREFERENCES_STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULT_TILT_PREFERENCES }
    }

    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_TILT_PREFERENCES }
    }

    const obj = parsed as Record<string, unknown>

    const sensitivityPreset: TiltSensitivityPreset = isValidTiltSensitivityPreset(obj.sensitivityPreset)
      ? obj.sensitivityPreset
      : typeof obj.sensitivity === 'number' && Number.isFinite(obj.sensitivity)
        ? resolveTiltSensitivityPresetFromValue(obj.sensitivity)
        : DEFAULT_TILT_PREFERENCES.sensitivityPreset

    const invertDirection =
      typeof obj.invertDirection === 'boolean'
        ? obj.invertDirection
        : DEFAULT_TILT_PREFERENCES.invertDirection

    const deadzoneDeg =
      typeof obj.deadzoneDeg === 'number' && Number.isFinite(obj.deadzoneDeg)
        ? clamp(obj.deadzoneDeg, 0, 12)
        : DEFAULT_TILT_PREFERENCES.deadzoneDeg

    const hasValidNeutral =
      typeof obj.neutralAngleDeg === 'number' &&
      Number.isFinite(obj.neutralAngleDeg) &&
      Math.abs(obj.neutralAngleDeg) <= 75

    const isCalibrated = Boolean(obj.isCalibrated) && hasValidNeutral
    const neutralAngleDeg = isCalibrated && hasValidNeutral ? clamp(obj.neutralAngleDeg as number, -75, 75) : 0

    return {
      sensitivityPreset,
      invertDirection,
      deadzoneDeg,
      neutralAngleDeg,
      isCalibrated,
    }
  } catch {
    return { ...DEFAULT_TILT_PREFERENCES }
  }
}

/**
 * Atualiza parcialmente as preferências persistidas em localStorage de forma atômica e segura.
 */
export function saveTiltPreferencesPatch(patch: Partial<PersistedTiltPreferences>): PersistedTiltPreferences {
  const current = loadTiltPreferences()
  const next: PersistedTiltPreferences = {
    sensitivityPreset: isValidTiltSensitivityPreset(patch.sensitivityPreset)
      ? patch.sensitivityPreset
      : current.sensitivityPreset,
    invertDirection:
      typeof patch.invertDirection === 'boolean' ? patch.invertDirection : current.invertDirection,
    deadzoneDeg:
      typeof patch.deadzoneDeg === 'number' && Number.isFinite(patch.deadzoneDeg)
        ? clamp(patch.deadzoneDeg, 0, 12)
        : current.deadzoneDeg,
    isCalibrated: typeof patch.isCalibrated === 'boolean' ? patch.isCalibrated : current.isCalibrated,
    neutralAngleDeg:
      typeof patch.neutralAngleDeg === 'number' && Number.isFinite(patch.neutralAngleDeg)
        ? clamp(patch.neutralAngleDeg, -75, 75)
        : current.neutralAngleDeg,
  }

  if (!next.isCalibrated) {
    next.neutralAngleDeg = 0
  }

  const storage = getStorageSafe()
  if (storage) {
    try {
      storage.setItem(TILT_PREFERENCES_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignora quota excedida / modo privado
    }
  }

  return next
}
