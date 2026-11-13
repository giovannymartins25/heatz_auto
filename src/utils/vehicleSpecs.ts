import type { VehicleConfig } from '@/types'

const SHORT_NAMES: Record<string, string> = {
  'civic-si': 'CIVIC SI',
  'golf-gti': 'GOLF GTI',
  'gol-g6': 'GOL RALLYE',
  'gol-rallye': 'GOL RALLYE',
  'gol-quadrado-turbo': 'GOL TURBO',
  'gol-turbo': 'GOL TURBO',
  'porsche-gt3': '911 GT3 RS',
  'porsche-911-gt3-rs': '911 GT3 RS',
  'opala-4100': 'OPALA 4.1',
  'opala-diplomata': 'OPALA 4.1',
  'yaris-2019': 'YARIS XLS',
  'yaris-xls': 'YARIS XLS',
  cb1000r: 'CB1000R',
}

/** Identificação curta e discreta do veículo para o cockpit mobile. */
export function getShortVehicleName(vehicle: (Partial<VehicleConfig> & { name?: string }) | null | undefined): string {
  if (!vehicle) return ''
  if (vehicle.id && SHORT_NAMES[vehicle.id]) return SHORT_NAMES[vehicle.id]
  const name = vehicle.info?.name || vehicle.name || ''
  if (!name) return vehicle.id?.toUpperCase() || ''
  const words = name.toUpperCase().split(/\s+/).slice(0, 2)
  return words.join(' ')
}

export interface VehicleHeaderSummary {
  title: string
  specsSummary: string
}

/**
 * Extrai nome conciso e ficha técnica resumida dinamicamente a partir de VehicleConfig,
 * evitando dados hardcoded por veículo e respeitando áreas compactas no cockpit mobile.
 */
export function formatVehicleHeaderInfo(vehicle: VehicleConfig): VehicleHeaderSummary {
  const { info, engine, transmission } = vehicle

  const rawPower =
    typeof engine.maxPower === 'number' && Number.isFinite(engine.maxPower)
      ? `${Math.round(engine.maxPower)} CV`
      : info.powerHp
      ? String(info.powerHp)
      : ''

  const rawTorqueKgfm =
    typeof info.torqueKgfm === 'number' && Number.isFinite(info.torqueKgfm)
      ? info.torqueKgfm
      : typeof engine.maxTorque === 'number' && Number.isFinite(engine.maxTorque)
      ? Math.round((engine.maxTorque / 9.80665) * 10) / 10
      : null

  const formattedTorque =
    rawTorqueKgfm !== null ? `${rawTorqueKgfm.toFixed(1).replace('.', ',')} kgfm` : ''

  const displacementMatch = `${info.name} ${info.description ?? ''}`.match(/\b\d\.\d\b/)
  const hasTurbo = Boolean(engine.turbo?.enabled)
  const descLower = (info.description ?? '').toLowerCase()
  const nameLower = info.name.toLowerCase()

  let engineTag = ''
  if (nameLower.includes('tsi')) {
    engineTag = displacementMatch ? `${displacementMatch[0]} TSI` : 'TSI'
  } else if (nameLower.includes('i-vtec') || descLower.includes('k20')) {
    engineTag = displacementMatch ? `${displacementMatch[0]} i-VTEC` : 'i-VTEC'
  } else if (nameLower.includes('msi')) {
    engineTag = displacementMatch ? `${displacementMatch[0]} MSI` : 'MSI'
  } else if (nameLower.includes('ap') && hasTurbo) {
    engineTag = displacementMatch ? `${displacementMatch[0]} AP Turbo` : 'AP Turbo'
  } else if (descLower.includes('bi-turbo') || nameLower.includes('bi-turbo')) {
    engineTag = displacementMatch ? `${displacementMatch[0]} Bi-Turbo` : 'Bi-Turbo'
  } else if (descLower.includes('6 cilindros') || descLower.includes('6 cil')) {
    engineTag = displacementMatch ? `${displacementMatch[0]} 6 Cil.` : '6 Cil.'
  } else if (descLower.includes('4 cilindros') || info.category === 'motorcycle') {
    engineTag = '4 Cil.'
  } else if (displacementMatch) {
    engineTag = hasTurbo ? `${displacementMatch[0]} Turbo` : displacementMatch[0]
  } else if (hasTurbo) {
    engineTag = 'Turbo'
  }

  const shortTransTag =
    transmission.type === 'cvt'
      ? 'CVT'
      : transmission.type === 'dct'
      ? `DCT ${transmission.gearCount}M`
      : transmission.type === 'automatic'
      ? `${transmission.gearCount}M Auto`
      : `${transmission.gearCount}M`

  const parts = [engineTag || shortTransTag, rawPower, formattedTorque].filter(Boolean)

  return {
    title: info.name,
    specsSummary: parts.join(' · '),
  }
}

