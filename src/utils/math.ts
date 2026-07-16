/** Restringe um valor entre min e max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Interpolação linear entre dois valores */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

/** Mapeia um valor de uma faixa para outra */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)
}

/** Converte RPM para radianos por segundo */
export function rpmToRadPerSec(rpm: number): number {
  return (rpm * 2 * Math.PI) / 60
}

/** Converte radianos por segundo para RPM */
export function radPerSecToRpm(radPerSec: number): number {
  return (radPerSec * 60) / (2 * Math.PI)
}

/** Converte km/h para m/s */
export function kmhToMs(kmh: number): number {
  return kmh / 3.6
}

/** Converte m/s para km/h */
export function msToKmh(ms: number): number {
  return ms * 3.6
}
