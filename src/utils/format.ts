/** Formata RPM com separador de milhar */
export function formatRpm(rpm: number): string {
  return Math.round(rpm).toLocaleString('pt-BR')
}

/** Formata velocidade com uma casa decimal */
export function formatSpeed(speed: number): string {
  return speed.toFixed(0)
}

/** Formata marcha para exibição (N, 1, 2, 3..., R) */
export function formatGear(gear: number): string {
  if (gear === 0) return 'N'
  if (gear === -1) return 'R'
  return String(gear)
}
