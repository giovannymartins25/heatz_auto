/**
 * tiltPreferences.ts — Persistência validada das preferências de direção mobile por inclinação (Fases 4.4.1 / 4.4.2.2).
 *
 * Persiste apenas configurações duráveis do usuário:
 * - Preset de sensibilidade ('low' | 'medium' | 'high') calibrado para curva progressiva natural
 * - Inversão do sinal final da direção (boolean)
 * - Zona morta em graus (number)
 * - Calibração de centro neutro separada por eixo de orientação (paisagem vs retrato) + campo ativo retrocompatível
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
  /** Ângulo aproximado de inclinação física para batente total em baixa velocidade */
  fullLockDeg: number
}

export const TILT_SENSITIVITY_PRESETS: Readonly<Record<TiltSensitivityPreset, TiltSensitivitySpec>> = {
  low: {
    id: 'low',
    label: 'Baixa',
    sensitivity: 0.48,
    fullLockDeg: 62.5,
  },
  medium: {
    id: 'medium',
    label: 'Média',
    sensitivity: 0.68,
    fullLockDeg: 44.1,
  },
  high: {
    id: 'high',
    label: 'Alta',
    sensitivity: 0.96,
    fullLockDeg: 31.3,
  },
}

export interface PersistedTiltPreferences {
  sensitivityPreset: TiltSensitivityPreset
  invertDirection: boolean
  deadzoneDeg: number
  neutralAngleDeg: number
  isCalibrated: boolean
  neutralLandscapeDeg?: number
  isCalibratedLandscape?: boolean
  neutralPortraitDeg?: number
  isCalibratedPortrait?: boolean
}

export const TILT_PREFERENCES_STORAGE_KEY = 'heatz_tilt_preferences_v1'

export const DEFAULT_TILT_PREFERENCES: Readonly<PersistedTiltPreferences> = {
  sensitivityPreset: 'medium',
  invertDirection: false,
  deadzoneDeg: 3.0,
  neutralAngleDeg: 0,
  isCalibrated: false,
  neutralLandscapeDeg: 0,
  isCalibratedLandscape: false,
  neutralPortraitDeg: 0,
  isCalibratedPortrait: false,
}

export function isValidTiltSensitivityPreset(val: unknown): val is TiltSensitivityPreset {
  return val === 'low' || val === 'medium' || val === 'high'
}

export function resolveTiltSensitivityPresetFromValue(sens: number): TiltSensitivityPreset {
  if (!Number.isFinite(sens)) return 'medium'
  if (sens <= 0.58) return 'low'
  if (sens >= 0.84) return 'high'
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

function sanitizeAngleOrZero(rawVal: unknown, flagVal: unknown): { angle: number; calibrated: boolean } {
  const valid = typeof rawVal === 'number' && Number.isFinite(rawVal) && Math.abs(rawVal) <= 75
  const calibrated = Boolean(flagVal) && valid
  return {
    angle: calibrated ? clamp(rawVal as number, -75, 75) : 0,
    calibrated,
  }
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

    const primary = sanitizeAngleOrZero(obj.neutralAngleDeg, obj.isCalibrated)
    const land =
      obj.isCalibratedLandscape !== undefined
        ? sanitizeAngleOrZero(obj.neutralLandscapeDeg, obj.isCalibratedLandscape)
        : primary
    const port =
      obj.isCalibratedPortrait !== undefined
        ? sanitizeAngleOrZero(obj.neutralPortraitDeg, obj.isCalibratedPortrait)
        : { angle: 0, calibrated: false }

    return {
      sensitivityPreset,
      invertDirection,
      deadzoneDeg,
      neutralAngleDeg: primary.angle,
      isCalibrated: primary.calibrated,
      neutralLandscapeDeg: land.angle,
      isCalibratedLandscape: land.calibrated,
      neutralPortraitDeg: port.angle,
      isCalibratedPortrait: port.calibrated,
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
  const nextCalibrated = typeof patch.isCalibrated === 'boolean' ? patch.isCalibrated : current.isCalibrated
  const nextNeutral =
    typeof patch.neutralAngleDeg === 'number' && Number.isFinite(patch.neutralAngleDeg)
      ? clamp(patch.neutralAngleDeg, -75, 75)
      : current.neutralAngleDeg

  const nextLandCal =
    typeof patch.isCalibratedLandscape === 'boolean'
      ? patch.isCalibratedLandscape
      : current.isCalibratedLandscape ?? false
  const nextLandDeg =
    typeof patch.neutralLandscapeDeg === 'number' && Number.isFinite(patch.neutralLandscapeDeg)
      ? clamp(patch.neutralLandscapeDeg, -75, 75)
      : current.neutralLandscapeDeg ?? 0

  const nextPortCal =
    typeof patch.isCalibratedPortrait === 'boolean'
      ? patch.isCalibratedPortrait
      : current.isCalibratedPortrait ?? false
  const nextPortDeg =
    typeof patch.neutralPortraitDeg === 'number' && Number.isFinite(patch.neutralPortraitDeg)
      ? clamp(patch.neutralPortraitDeg, -75, 75)
      : current.neutralPortraitDeg ?? 0

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
    isCalibrated: nextCalibrated,
    neutralAngleDeg: nextCalibrated ? nextNeutral : 0,
    isCalibratedLandscape: nextLandCal,
    neutralLandscapeDeg: nextLandCal ? nextLandDeg : 0,
    isCalibratedPortrait: nextPortCal,
    neutralPortraitDeg: nextPortCal ? nextPortDeg : 0,
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
