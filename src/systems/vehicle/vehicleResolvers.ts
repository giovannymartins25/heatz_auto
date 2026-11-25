/**
 * vehicleResolvers.ts — Resolvedores puros, declarativos e retrocompatíveis para VehicleConfig.
 *
 * Responsabilidade única:
 * - Traduzir campos declarativos de `VehicleConfig` (drivetrain, ignition, cabin, multimedia,
 *   visual2d, aerodynamics, fuel/upgrades) com validação explícita.
 * - Quando um veículo legado (dos 10 modelos pré-Fase 4.1) ainda não declara um campo opcional,
 *   preservar seu comportamento histórico EXATO sem deduzir características físicas incorretas.
 */

import type {
  ClimateControlsLocation,
  ControlActuationType,
  ControlPanelTarget,
  DriverAssistAdjustability,
  DriverAssistControlType,
  DriverAssistImplementationState,
  DrivetrainConfigValue,
  DrivetrainLayout,
  EquipmentConfirmationStatus,
  IgnitionStartInterlock,
  MultimediaUnitId,
  VehicleAeroSpec,
  VehicleCabinSpec,
  VehicleCategory,
  VehicleConfig,
  VehicleControlsSpec,
  VehicleDriverAssistEntry,
  VehicleFuelType,
  VehicleIgnitionSpec,
  VehicleMultimediaSpec,
  VehicleVisual2DSpec,
} from '@/types/vehicle'
import type {
  CarUpgrades,
  EngineInternals,
  ExhaustType,
  RearWingPosition,
  RearWingType,
  TurboLevel,
} from '@/stores/useGarageStore'
import type { FuelType } from '@/types/simulation'
import type { AmbientLightColor } from '@/utils/ambientLighting'

// ─── Tipos de Resultado ──────────────────────────────────────────────────────

export interface ResolvedVehicleAero {
  hasActiveRearWing: boolean
  hasAdjustableRideHeight: boolean
  hasAirbrake: boolean
  defaultWingType: RearWingType
  defaultWingPosition: RearWingPosition
  baseDownforceCoeff: number
}

export interface ResolvedVehicleFuelDefaults {
  defaultFuelType: FuelType
  podiumGainMultiplier: number
  podiumGainMinRpm: number
}

export interface VehicleConfigValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ─── Tabelas de Fallback Legado (exclusivas para os 10 veículos pré-Fase 4.1) ─

const VALID_DRIVETRAINS: ReadonlySet<string> = new Set([
  'fwd',
  'rwd',
  'awd_ptm',
  'awd_ondemand',
  '4x4_selectable',
  'awd',
])

const LEGACY_DRIVETRAIN_BY_ID: Readonly<Record<string, DrivetrainLayout>> = {
  'porsche-gt3': 'awd_ptm',
  'fiat-toro-ranch-2025': '4x4_selectable',
  'fiat-toro-endurance-2025': 'fwd',
  'opala-4100': 'rwd',
  cb1000r: 'rwd',
  'gol-g6': 'fwd',
  'gol-quadrado-turbo': 'fwd',
  'golf-gti': 'fwd',
  'civic-si': 'fwd',
  'yaris-2019': 'fwd',
}

const LEGACY_VISUAL2D_BY_ID: Readonly<Record<string, VehicleVisual2DSpec>> = {
  'gol-quadrado-turbo': {
    bodyColor: '#e2e8f0',
    accentColor: '#dc2626',
    lengthM: 3.85,
    widthM: 1.68,
    silhouette: 'hatch_square',
    hasFrontRedStripe: true,
  },
  'porsche-gt3': {
    bodyColor: '#f59e0b',
    lengthM: 4.5,
    widthM: 1.95,
    silhouette: 'coupe',
  },
  'golf-gti': {
    bodyColor: '#dc2626',
    lengthM: 4.5,
    widthM: 1.95,
    silhouette: 'hatch',
  },
  'civic-si': {
    bodyColor: '#ef4444',
    lengthM: 4.5,
    widthM: 1.95,
    silhouette: 'sedan',
  },
  'opala-4100': {
    bodyColor: '#7c2d12',
    lengthM: 4.5,
    widthM: 1.95,
    silhouette: 'sedan',
  },
  'fiat-toro-endurance-2025': {
    bodyColor: '#475569',
    lengthM: 4.5,
    widthM: 1.95,
    silhouette: 'pickup_mid',
  },
  'fiat-toro-ranch-2025': {
    bodyColor: '#475569',
    lengthM: 4.5,
    widthM: 1.95,
    silhouette: 'pickup_mid',
  },
  cb1000r: {
    bodyColor: '#2563eb',
    lengthM: 2.15,
    widthM: 0.78,
    silhouette: 'motorcycle',
  },
  'gol-g6': {
    bodyColor: '#2563eb',
    lengthM: 4.5,
    widthM: 1.95,
    silhouette: 'hatch',
  },
  'yaris-2019': {
    bodyColor: '#2563eb',
    lengthM: 4.5,
    widthM: 1.95,
    silhouette: 'hatch',
  },
}

// ─── 1. Drivetrain Resolver (Localização Canônica: transmission.drivetrain) ──

export interface DrivetrainResolutionInput {
  id?: string
  drivetrain?: DrivetrainConfigValue
  isMotorcycle?: boolean
  category?: VehicleCategory
  frontFinalDrive?: number
}

/**
 * Resolve a arquitetura de tração canônica do veículo.
 * Prioridade:
 *  1. Campo declarativo `transmission.drivetrain` (com tratamento retrocompatível do alias `'awd'`)
 *  2. Categoria motocicleta (`'rwd'`)
 *  3. Tabela legada exata dos 10 veículos pré-Fase 4.1
 *  4. Fallback seguro (`'fwd'`)
 */
export function resolveVehicleDrivetrain(
  input?: VehicleConfig | DrivetrainResolutionInput | string,
  isMotorcycleFlag?: boolean,
): DrivetrainLayout {
  if (!input) {
    return isMotorcycleFlag ? 'rwd' : 'fwd'
  }

  let id: string | undefined
  let declared: DrivetrainConfigValue | undefined
  let isMoto = Boolean(isMotorcycleFlag)
  let hasFrontFinalDrive = false

  if (typeof input === 'string') {
    id = input
  } else if ('transmission' in input && input.transmission) {
    id = input.id
    declared = input.transmission.drivetrain
    isMoto = isMoto || input.info?.category === 'motorcycle'
    hasFrontFinalDrive = input.transmission.frontFinalDrive !== undefined
  } else {
    const partial = input as DrivetrainResolutionInput
    id = partial.id
    declared = partial.drivetrain
    isMoto = isMoto || Boolean(partial.isMotorcycle) || partial.category === 'motorcycle'
    hasFrontFinalDrive = partial.frontFinalDrive !== undefined
  }

  if (declared) {
    if (declared === 'awd') {
      // Alias legado presente em porsche-gt3/config.json: preserva PTM no Porsche/dual-final-drive
      if (id === 'porsche-gt3' || hasFrontFinalDrive) {
        return 'awd_ptm'
      }
      return 'awd_ondemand'
    }
    if (
      declared === 'fwd' ||
      declared === 'rwd' ||
      declared === 'awd_ptm' ||
      declared === 'awd_ondemand' ||
      declared === '4x4_selectable'
    ) {
      return declared
    }
  }

  if (isMoto) {
    return 'rwd'
  }

  if (id && id in LEGACY_DRIVETRAIN_BY_ID) {
    return LEGACY_DRIVETRAIN_BY_ID[id]
  }

  // Retrocompatibilidade para variantes com sufixo/prefixo dos IDs legados
  if (id) {
    if (id.includes('toro-ranch') || id.includes('4x4')) return '4x4_selectable'
    if (id.includes('porsche-gt3')) return 'awd_ptm'
    if (id.includes('opala-4100')) return 'rwd'
  }

  return 'fwd'
}

/** Converte `DrivetrainLayout` detalhado para a classificação simplificada de dinamômetro */
export function toSimpleDrivetrain(layout: DrivetrainLayout): 'fwd' | 'rwd' | 'awd' {
  if (layout === 'rwd') return 'rwd'
  if (layout === 'fwd') return 'fwd'
  return 'awd'
}

// ─── 2. Ignition Resolver ────────────────────────────────────────────────────

export function resolveVehicleIgnition(vehicle: VehicleConfig): VehicleIgnitionSpec {
  const isAutoOrCvt =
    vehicle.transmission.type === 'automatic' ||
    vehicle.transmission.type === 'cvt' ||
    vehicle.transmission.type === 'dct'

  if (vehicle.ignition) {
    // Normaliza configs legados que eventualmente tenham usado requiresPedalForStart sem startInterlock
    const inferredInterlock: IgnitionStartInterlock =
      vehicle.ignition.startInterlock ??
      (vehicle.ignition.requiresPedalForStart
        ? isAutoOrCvt
          ? 'brake'
          : 'clutch'
        : 'none')
    return {
      type: vehicle.ignition.type,
      startInterlock: inferredInterlock,
      supportsAccessoryMode: vehicle.ignition.supportsAccessoryMode,
      requiresPedalForStart: inferredInterlock !== 'none',
    }
  }

  if (vehicle.info.category === 'motorcycle') {
    return {
      type: 'key',
      startInterlock: 'none',
      supportsAccessoryMode: false,
      requiresPedalForStart: false,
    }
  }

  const isModernPushButton =
    vehicle.id === 'porsche-gt3' ||
    vehicle.id === 'golf-gti' ||
    vehicle.id === 'fiat-toro-ranch-2025' ||
    vehicle.id === 'yaris-2019'

  if (isModernPushButton) {
    return {
      type: 'push_button',
      startInterlock: isAutoOrCvt ? 'brake' : 'clutch',
      supportsAccessoryMode: true,
      requiresPedalForStart: true,
    }
  }

  if (vehicle.id === 'fiat-toro-endurance-2025') {
    return {
      type: 'key',
      startInterlock: 'brake',
      supportsAccessoryMode: true,
      requiresPedalForStart: true,
    }
  }

  if (vehicle.id === 'civic-si') {
    return {
      type: 'key',
      startInterlock: 'clutch',
      supportsAccessoryMode: true,
      requiresPedalForStart: true,
    }
  }

  return {
    type: 'key',
    startInterlock: 'none',
    supportsAccessoryMode: true,
    requiresPedalForStart: false,
  }
}

// ─── 3. Cabin Resolver ───────────────────────────────────────────────────────

export function resolveVehicleCabin(vehicle: VehicleConfig): VehicleCabinSpec {
  if (vehicle.cabin) {
    return vehicle.cabin
  }

  if (vehicle.info.category === 'motorcycle') {
    return {
      climateType: 'none',
      hasAcCompressor: false,
      hasHeater: false,
      hasRecirculation: false,
      hasDefroster: false,
      windowCount: 0,
      windowControlType: 'none',
      hasFogLights: false,
      hasAmbientLighting: false,
      defaultAmbientColor: 'red',
    }
  }

  const defaultAmbientColor: AmbientLightColor =
    vehicle.id === 'golf-gti'
      ? 'red'
      : vehicle.id === 'porsche-gt3'
        ? 'amber'
        : vehicle.id.includes('yaris')
          ? 'cyan'
          : 'red'

  if (vehicle.id === 'gol-quadrado-turbo' || vehicle.id === 'opala-4100') {
    return {
      climateType: 'manual_vent',
      hasAcCompressor: false,
      hasHeater: true,
      hasRecirculation: false,
      hasDefroster: true,
      windowCount: vehicle.id === 'opala-4100' ? 4 : 2,
      windowControlType: 'manual_crank',
      hasFogLights: vehicle.id === 'gol-quadrado-turbo',
      hasAmbientLighting: false,
      defaultAmbientColor,
    }
  }

  if (vehicle.id === 'porsche-gt3' || vehicle.id === 'golf-gti' || vehicle.id === 'fiat-toro-ranch-2025') {
    return {
      climateType: 'auto_dual',
      hasAcCompressor: true,
      hasHeater: true,
      hasSeatHeating: vehicle.id === 'porsche-gt3',
      hasRecirculation: true,
      hasDefroster: true,
      windowCount: vehicle.id === 'porsche-gt3' ? 2 : 4,
      windowControlType: 'electric',
      hasFogLights: true,
      hasAmbientLighting: true,
      defaultAmbientColor,
    }
  }

  if (vehicle.id === 'yaris-2019' || vehicle.id === 'civic-si') {
    return {
      climateType: 'auto_single',
      hasAcCompressor: true,
      hasHeater: true,
      hasRecirculation: true,
      hasDefroster: true,
      windowCount: 4,
      windowControlType: 'electric',
      hasFogLights: true,
      hasAmbientLighting: vehicle.id === 'yaris-2019',
      defaultAmbientColor,
    }
  }

  // Gol G6, Toro Endurance e padrão seguro de carros modernos de entrada
  return {
    climateType: 'manual_ac',
    hasAcCompressor: true,
    hasHeater: true,
    hasRecirculation: true,
    hasDefroster: true,
    windowCount: 4,
    windowControlType: 'electric',
    hasFogLights: true,
    hasAmbientLighting: false,
    defaultAmbientColor,
  }
}

export function resolveDefaultAmbientColor(vehicle: VehicleConfig): AmbientLightColor {
  return resolveVehicleCabin(vehicle).defaultAmbientColor ?? 'red'
}

function createUnavailableAssist(
  confirmationStatus: EquipmentConfirmationStatus = 'confirmed',
  notes?: string,
): VehicleDriverAssistEntry {
  return {
    available: false,
    confirmationStatus,
    controlType: 'none',
    panel: 'none',
    adjustable: 'none',
    implementationState: 'not_applicable',
    ...(notes ? { notes } : {}),
  }
}

/**
 * Resolve declarativamente a distribuição completa de comandos do veículo (`VehicleControlsSpec`):
 * - Climatização (`climate`): Painel 2 ('multimedia'), Painel 3 ('controls') ou ausente ('none'),
 *   respeitando também upgrade aftermarket 2-DIN (`retrofit_2din`) na Oficina.
 * - Controle de Tração/Estabilidade (`tractionControl`): disponibilidade real, se pode ser alternado
 *   pelo motorista (`userToggleable`), natureza física vs digital e painel exclusivo ('controls' vs 'multimedia').
 * - Comandos de volante (`steeringWheel`) e Assistências de Condução (`driverAssists`: Cruise Control, ACC, LKA)
 *   como preparação arquitetural auditada (`implementationState: 'pending_sensors'`), sem simulação falsa.
 */
export function resolveVehicleControls(
  vehicle: VehicleConfig,
  upgrades?: { multimediaKit?: boolean } | null,
): VehicleControlsSpec {
  const cabin = resolveVehicleCabin(vehicle)
  const media = resolveVehicleMultimediaSpec(vehicle, upgrades)
  const isMoto = vehicle.info.category === 'motorcycle'
  const isAftermarketRetrofit = media.unitId === 'retrofit_2din' && media.type === 'aftermarket'

  // 1. Climatização
  let climatePanel: ControlPanelTarget = 'none'
  let climateControlType: ControlActuationType = 'none'
  let climateAdjustable: 'setpoint_and_fan' | 'vent_only' | 'none' = 'none'

  if (cabin.climateType !== 'none' && !isMoto) {
    climateAdjustable = cabin.hasAcCompressor || cabin.hasHeater ? 'setpoint_and_fan' : 'vent_only'
    if (isAftermarketRetrofit) {
      climatePanel = 'multimedia'
      climateControlType = 'digital'
    } else if (vehicle.controls?.climate) {
      climatePanel = vehicle.controls.climate.panel
      climateControlType = vehicle.controls.climate.controlType
      climateAdjustable = vehicle.controls.climate.adjustable
    } else if (cabin.climateControlsLocation) {
      climatePanel = cabin.climateControlsLocation === 'panel' ? 'controls' : cabin.climateControlsLocation
      climateControlType = climatePanel === 'multimedia' ? 'digital' : 'physical'
    } else {
      const isConventionalRadioOrBlank =
        media.type === 'radio' ||
        media.type === 'none' ||
        media.unitId === 'honda_haudio' ||
        media.unitId === 'ford_sync1_2012' ||
        media.unitId === 'ford_pampa_radio_1din' ||
        media.unitId === 'classic_radio_1din' ||
        media.unitId === 'classic_blank_console'
      climatePanel = isConventionalRadioOrBlank ? 'controls' : 'multimedia'
      climateControlType = climatePanel === 'multimedia' ? 'digital' : 'physical'
    }
  }

  // 2. Controle de Tração / Estabilidade
  const hasTcsPhysics = Boolean(vehicle.transmission.tcs?.enabled)
  let tractionSpec = vehicle.controls?.tractionControl
  if (!tractionSpec) {
    if (!hasTcsPhysics) {
      tractionSpec = {
        available: false,
        confirmationStatus: 'confirmed',
        userToggleable: false,
        controlType: 'none',
        panel: 'none',
        systemLabel: 'N/A',
      }
    } else {
      const isDigitalMultimediaTcs =
        vehicle.id === 'bmw-320i-msport-2024' ||
        vehicle.id === 'golf-gti' ||
        vehicle.id === 'jetta-gli-2021' ||
        vehicle.id === 'ford-fusion-titanium-awd-2019'
      tractionSpec = {
        available: true,
        confirmationStatus: 'confirmed',
        userToggleable: true,
        controlType: isDigitalMultimediaTcs ? 'digital' : 'physical',
        panel: isDigitalMultimediaTcs ? 'multimedia' : 'controls',
        systemLabel:
          vehicle.id === 'porsche-gt3'
            ? 'PSM'
            : vehicle.id === 'bmw-320i-msport-2024'
              ? 'DSC'
              : vehicle.id === 'golf-gti' || vehicle.id === 'jetta-gli-2021'
                ? 'ASR / ESC'
                : vehicle.id === 'civic-si'
                  ? 'VSA'
                  : vehicle.id === 'cb1000r'
                    ? 'HSTC'
                    : vehicle.id === 'yaris-2019'
                      ? 'VSC / TRC'
                      : vehicle.id.includes('toro')
                        ? 'TC+ / ESC'
                        : vehicle.id.includes('fusion')
                          ? 'AdvanceTrac'
                          : 'TCS',
      }
    }
  }

  // 3. Comandos de Volante e Assistências (fallback seguro caso config parcial legado omita `controls`)
  const steeringWheel = vehicle.controls?.steeringWheel ?? {
    hasAudioControls:
      !isMoto &&
      vehicle.id !== 'gol-quadrado-turbo' &&
      vehicle.id !== 'opala-4100' &&
      vehicle.id !== 'ford-pampa-l-1997',
    hasCruiseControls:
      vehicle.id === 'porsche-gt3' ||
      vehicle.id === 'golf-gti' ||
      vehicle.id === 'jetta-gli-2021' ||
      vehicle.id === 'bmw-320i-msport-2024' ||
      vehicle.id === 'ford-fusion-titanium-awd-2019' ||
      vehicle.id === 'ford-fusion-sel-2012' ||
      vehicle.id === 'fiat-toro-ranch-2025' ||
      vehicle.id === 'fiat-toro-endurance-2025' ||
      vehicle.id === 'yaris-2019' ||
      vehicle.id === 'civic-si',
    confirmationStatus: 'confirmed',
  }

  const driverAssists = vehicle.controls?.driverAssists ?? {
    cruiseControl: createUnavailableAssist('unconfirmed'),
    adaptiveCruiseControl: createUnavailableAssist('unconfirmed'),
    laneKeepingAssist: createUnavailableAssist('unconfirmed'),
  }

  return {
    climate: {
      available: climatePanel !== 'none',
      confirmationStatus: vehicle.controls?.climate.confirmationStatus ?? 'confirmed',
      controlType: climateControlType,
      panel: climatePanel,
      adjustable: climateAdjustable,
    },
    tractionControl: tractionSpec,
    steeringWheel,
    driverAssists,
  }
}

/**
 * Resolve declarativamente onde os controles de climatização devem ser exibidos:
 * - `'none'`: veículos sem climatização/ventilação (ex.: motocicletas como a CB1000R)
 * - `'multimedia'`: veículos com central multimídia integrada (touchscreen OEM) ou upgrade aftermarket 2-DIN (`retrofit_2din`)
 * - `'panel'`: veículos com rádio convencional 1-DIN/2-DIN OEM (ex.: Gol G6, Opala, Pampa, Civic Si 2008 H-Audio 2-DIN, Fusion SEL 2012 SYNC 1 VFD) ou console cego (Gol Quadrado)
 *
 * Delega diretamente a `resolveVehicleControls` para manter fonte única da verdade sem redundância.
 */
export function resolveClimateControlsLocation(
  vehicle: VehicleConfig,
  upgrades?: { multimediaKit?: boolean } | null,
): ClimateControlsLocation {
  const panel = resolveVehicleControls(vehicle, upgrades).climate.panel
  if (panel === 'multimedia') return 'multimedia'
  if (panel === 'controls') return 'panel'
  return 'none'
}

// ─── 4. Visual 2D Resolver ───────────────────────────────────────────────────

export function resolveVehicleVisual2D(vehicle?: VehicleConfig): VehicleVisual2DSpec {
  if (vehicle?.visual2d) {
    return vehicle.visual2d
  }

  if (vehicle?.id && vehicle.id in LEGACY_VISUAL2D_BY_ID) {
    return LEGACY_VISUAL2D_BY_ID[vehicle.id]
  }

  const isMotorcycle = vehicle?.info?.category === 'motorcycle'
  if (isMotorcycle) {
    return {
      bodyColor: '#2563eb',
      lengthM: 2.15,
      widthM: 0.78,
      silhouette: 'motorcycle',
    }
  }

  if (vehicle?.id?.includes('toro')) {
    return {
      bodyColor: '#475569',
      lengthM: 4.5,
      widthM: 1.95,
      silhouette: 'pickup_mid',
    }
  }

  return {
    bodyColor: '#2563eb',
    lengthM: 4.5,
    widthM: 1.95,
    silhouette: 'hatch',
  }
}

// ─── 5. Multimedia Spec Resolver ─────────────────────────────────────────────

export function resolveVehicleMultimediaSpec(
  vehicle: VehicleConfig,
  upgrades?: { multimediaKit?: boolean } | null,
): VehicleMultimediaSpec {
  const isMoto = vehicle.info.category === 'motorcycle'
  const hasAftermarketMedia = Boolean(upgrades?.multimediaKit)

  // 1. Motocicletas nunca exibem central multimídia automotiva
  if (isMoto) {
    if (vehicle.multimedia) {
      return vehicle.multimedia
    }
    return {
      unitId: 'none',
      type: 'none',
      layout: 'none',
      name: 'Painel TFT 5" Integrado (Sem Multimídia)',
      features: ['Computador de bordo TFT', 'Indicador de marcha', 'Conta-giros digital'],
      supportsAftermarketUpgrade: false,
    }
  }

  // 2. Especificação declarativa explícita no VehicleConfig
  if (vehicle.multimedia) {
    if (hasAftermarketMedia && vehicle.multimedia.supportsAftermarketUpgrade && vehicle.multimedia.type !== 'factory') {
      return {
        unitId: 'retrofit_2din',
        type: 'aftermarket',
        layout: 'horizontal',
        screenSize: 7.0,
        name: 'Central 2-DIN Heatz Performance',
        features: [
          'Apple CarPlay / Android Auto',
          'Media Player Digital',
          'Telemetria OBD-II',
          'Streaming de Música',
        ],
        supportsAftermarketUpgrade: true,
      }
    }
    return vehicle.multimedia
  }

  // 3. Fallback legado exato para os 10 veículos existentes
  if (vehicle.id.includes('porsche-gt3')) {
    return {
      unitId: 'porsche_pcm6',
      type: 'factory',
      layout: 'horizontal',
      screenSize: 10.9,
      name: 'Porsche Communication Management (PCM 6.0)',
      era: '2020s',
      features: [
        'Track Precision App',
        'Aerodinâmica Ativa',
        'Front Axle Lift',
        'Sport Chrono',
        'Climatronic Dual',
      ],
      supportsAftermarketUpgrade: false,
    }
  }

  if (vehicle.id.includes('golf-gti')) {
    return {
      unitId: 'vw_discover_pro',
      type: 'factory',
      layout: 'horizontal',
      screenSize: 8.0,
      name: 'VW Discover Pro 8" com Sport HMI',
      era: '2010s',
      features: [
        'Sport HMI (Pressão Turbo / G-Force / Temp Óleo)',
        'Climatronic Dual Zone',
        'Modos de Condução VW',
        'Media Player',
      ],
      supportsAftermarketUpgrade: false,
    }
  }

  if (vehicle.id.includes('toro-ranch')) {
    return {
      unitId: 'toro_uconnect_10_vertical',
      type: 'factory',
      layout: 'vertical',
      screenSize: 10.1,
      name: 'Uconnect 10.1" Vertical HD',
      era: '2020s',
      features: [
        'Monitor de Tração 4x4 Off-Road',
        'Climatização Dual Zone Touch',
        'Telemetria Turbodiesel',
        'Android Auto / Apple CarPlay',
      ],
      supportsAftermarketUpgrade: false,
    }
  }

  if (vehicle.id.includes('toro-endurance')) {
    return {
      unitId: 'toro_uconnect_7',
      type: 'factory',
      layout: 'horizontal',
      screenSize: 7.0,
      name: 'Uconnect 7" Touchscreen',
      era: '2020s',
      features: [
        'Controles de Áudio e Rádio',
        'Status T270 Flex',
        'Climatização Analógica/Digital',
        'Bluetooth / Espelhamento',
      ],
      supportsAftermarketUpgrade: false,
    }
  }

  if (vehicle.id === 'yaris-2019' || vehicle.id.includes('yaris')) {
    return {
      unitId: 'toyota_smart_connect',
      type: 'factory',
      layout: 'horizontal',
      screenSize: 7.0,
      name: 'Toyota Play 7" Smart Connect',
      era: '2010s',
      features: [
        'Eco & Drive Monitor',
        'Consumo Médio e Autonomia',
        'Climatização Digital',
        'YouTube / Media Center',
      ],
      supportsAftermarketUpgrade: false,
    }
  }

  if (vehicle.id.includes('civic-si')) {
    // Civic Si mantém Honda H-Audio 2-DIN OEM como unidade dedicada na multimídia,
    // mas no capabilities histórico reportava aftermarket quando multimediaKit = true.
    if (hasAftermarketMedia) {
      return {
        unitId: 'honda_haudio',
        type: 'aftermarket',
        layout: 'horizontal',
        screenSize: 7.0,
        name: 'Central 2-DIN Heatz Performance',
        features: [
          'Apple CarPlay / Android Auto',
          'Media Player Digital',
          'Telemetria OBD-II',
          'Streaming de Música',
        ],
        supportsAftermarketUpgrade: true,
      }
    }
    return {
      unitId: 'honda_haudio',
      type: 'factory',
      layout: 'horizontal',
      screenSize: 6.5,
      name: 'Honda H-Audio 2-DIN OEM',
      era: '2000s',
      features: ['Telemetria i-VTEC', 'Controle de Áudio Integrado', 'Computador de bordo'],
      supportsAftermarketUpgrade: true,
    }
  }

  if (hasAftermarketMedia) {
    return {
      unitId: 'retrofit_2din',
      type: 'aftermarket',
      layout: 'horizontal',
      screenSize: 7.0,
      name: 'Central 2-DIN Heatz Performance',
      features: [
        'Apple CarPlay / Android Auto',
        'Media Player Digital',
        'Telemetria OBD-II',
        'Streaming de Música',
      ],
      supportsAftermarketUpgrade: true,
    }
  }

  if (vehicle.id.includes('gol-quadrado')) {
    return {
      unitId: 'classic_blank_console',
      type: 'none',
      layout: 'compact',
      name: 'Console Original VW GL (Sem Rádio)',
      era: '1990s',
      features: ['Tampa cega 1-DIN', 'Relógio de quartzo digital', 'Difusores de ar mecânicos'],
      supportsAftermarketUpgrade: true,
    }
  }

  if (vehicle.id.includes('opala-4100')) {
    return {
      unitId: 'classic_radio_1din',
      type: 'radio',
      layout: 'compact',
      name: 'Toca-Fitas / Rádio Albatroz 1-DIN Vintage',
      era: '1990s',
      features: ['Receptor AM/FM Clássico', 'Equalizador Analógico', 'Visor LCD Verde Vintage'],
      supportsAftermarketUpgrade: true,
    }
  }

  if (vehicle.id.includes('gol-g6')) {
    return {
      unitId: 'classic_radio_1din',
      type: 'radio',
      layout: 'compact',
      name: 'Rádio VW RCD 320G 1-DIN',
      era: '2010s',
      features: ['Receptor FM/AM', 'Entrada USB / Bluetooth', 'Display Dot-Matrix'],
      supportsAftermarketUpgrade: true,
    }
  }

  const isFactory = Boolean(vehicle.dashboard.hasInfotainment)
  return {
    unitId: isFactory ? 'generic_multimedia' : 'classic_blank_console',
    type: isFactory ? 'factory' : 'none',
    layout: isFactory ? 'horizontal' : 'none',
    screenSize: isFactory ? 7.0 : undefined,
    name: isFactory ? 'Central Multimídia' : 'Sem Multimídia',
    features: isFactory ? ['Media Player', 'Status do Veículo'] : [],
    supportsAftermarketUpgrade: !isFactory,
  }
}

// ─── 6. Aerodynamics & Fuel Defaults Resolvers ───────────────────────────────

export function resolveVehicleAero(vehicle: VehicleConfig): ResolvedVehicleAero {
  const aero: VehicleAeroSpec | undefined = vehicle.aerodynamics
  const isLegacyPorsche = vehicle.id === 'porsche-gt3'
  const isLegacyCivicSi = vehicle.id === 'civic-si'

  return {
    hasActiveRearWing: aero?.hasActiveRearWing ?? isLegacyPorsche,
    hasAdjustableRideHeight: aero?.hasAdjustableRideHeight ?? isLegacyPorsche,
    hasAirbrake: aero?.hasAirbrake ?? isLegacyPorsche,
    defaultWingType: aero?.defaultWingType ?? (isLegacyPorsche || isLegacyCivicSi ? 'oem' : 'none'),
    defaultWingPosition: aero?.defaultWingPosition ?? (isLegacyPorsche ? 'balanced' : 'low_drag'),
    baseDownforceCoeff: aero?.baseDownforceCoeff ?? (isLegacyPorsche ? 0.35 : 0.08),
  }
}

export function resolveVehicleFuelDefaults(vehicle: VehicleConfig): ResolvedVehicleFuelDefaults {
  let defaultFuelType: VehicleFuelType = vehicle.engine.defaultFuelType ?? 'common_gasoline'
  if (!vehicle.engine.defaultFuelType) {
    if (vehicle.id === 'gol-quadrado' || vehicle.id === 'gol-quadrado-turbo') {
      defaultFuelType = 'ethanol_e100'
    }
  }

  let podiumGainMultiplier = vehicle.engine.podiumGainMultiplier ?? 1.0
  let podiumGainMinRpm = vehicle.engine.podiumGainMinRpm ?? 0

  if (vehicle.engine.podiumGainMultiplier === undefined) {
    if (vehicle.id === 'porsche-gt3') {
      podiumGainMultiplier = 1.05
    } else if (vehicle.id === 'golf-gti') {
      podiumGainMultiplier = 1.04
    } else if (vehicle.id === 'civic-si') {
      podiumGainMultiplier = 1.04
      podiumGainMinRpm = 5500
    }
  }

  return {
    defaultFuelType,
    podiumGainMultiplier,
    podiumGainMinRpm,
  }
}

// ─── 7. Default Garage Upgrades Resolver ─────────────────────────────────────

/**
 * Resolve os upgrades padrão de fábrica de um veículo.
 * Quando `config` é fornecido, deriva tudo declarativamente (sem listas hardcoded).
 * Quando chamado apenas com `vehicleId` (legado), preserva o comportamento exato dos 10 modelos atuais.
 */
export function resolveDefaultUpgradesForVehicle(
  vehicleId: string,
  config?: VehicleConfig,
): CarUpgrades {
  if (config) {
    const isOriginallyTurbo = Boolean(config.engine.turbo?.enabled)
    const multimediaSpec = resolveVehicleMultimediaSpec(config)
    const hasDefaultMultimedia = multimediaSpec.type === 'factory'
    const aero = resolveVehicleAero(config)
    const fuelDefaults = resolveVehicleFuelDefaults(config)
    const defaultFuel: FuelType =
      config.engine.defaultFuelType ??
      (vehicleId === 'gol-quadrado-turbo'
        ? 'ethanol_e100'
        : vehicleId === 'porsche-gt3' || vehicleId === 'golf-gti'
          ? 'premium_podium'
          : fuelDefaults.defaultFuelType)
    const defaultTurboLevel: TurboLevel =
      config.engine.turbo?.defaultUpgradeLevel ??
      (vehicleId === 'gol-quadrado-turbo' ? 'intermediate' : 'none')
    const defaultInternals: EngineInternals =
      config.engine.defaultInternals ??
      (vehicleId === 'gol-quadrado-turbo' ? 'forged' : 'stock')

    return {
      turboKit: isOriginallyTurbo,
      turboLevel: defaultTurboLevel,
      engineInternals: defaultInternals,
      rearWingType: aero.defaultWingType,
      multimediaKit: hasDefaultMultimedia,
      boostGaugeKit: false,
      exhaustType: isOriginallyTurbo ? 'sport' : 'stock',
      intakeType: 'stock',
      tires: 'street',
      tuningStage: 0,
      hasExhaustValveKit: false,
      exhaustValveOpen: false,
      fuelType: defaultFuel,
      hasNosKit: false,
      hasPopsAndBangs: false,
      popsAndBangsEnabled: false,
      suspensionHeight: 'stock',
      rearWingPosition: aero.defaultWingPosition,
      clutchUpgrade: 'stock',
      brakeUpgrade: 'stock',
      paintColor: undefined,
      brakeCaliperColor: undefined,
    }
  }

  // Fallback legado / por-ID quando apenas vehicleId está disponível (ex.: buyCar ou estado inicial do useGarageStore)
  const isOriginallyTurbo =
    vehicleId === 'golf-gti' ||
    vehicleId === 'jetta-gli-2021' ||
    vehicleId === 'bmw-320i-msport-2024' ||
    vehicleId === 'ford-fusion-titanium-awd-2019' ||
    vehicleId === 'porsche-gt3' ||
    vehicleId === 'gol-quadrado-turbo' ||
    vehicleId === 'fiat-toro-endurance-2025' ||
    vehicleId === 'fiat-toro-ranch-2025'

  const hasDefaultMultimedia =
    vehicleId === 'golf-gti' ||
    vehicleId === 'jetta-gli-2021' ||
    vehicleId === 'bmw-320i-msport-2024' ||
    vehicleId === 'ford-fusion-sel-2012' ||
    vehicleId === 'ford-fusion-titanium-awd-2019' ||
    vehicleId === 'porsche-gt3' ||
    vehicleId === 'yaris-2019' ||
    vehicleId === 'civic-si' ||
    vehicleId === 'fiat-toro-endurance-2025' ||
    vehicleId === 'fiat-toro-ranch-2025'

  const defaultFuel: FuelType =
    vehicleId === 'gol-quadrado-turbo'
      ? 'ethanol_e100'
      : vehicleId === 'porsche-gt3' || vehicleId === 'golf-gti' || vehicleId === 'jetta-gli-2021'
        ? 'premium_podium'
        : 'common_gasoline'

  const defaultTurboLevel: TurboLevel =
    vehicleId === 'gol-quadrado-turbo' ? 'intermediate' : 'none'

  const defaultInternals: EngineInternals =
    vehicleId === 'gol-quadrado-turbo' ? 'forged' : 'stock'
  const defaultWingType: RearWingType =
    vehicleId === 'porsche-gt3' || vehicleId === 'civic-si' ? 'oem' : 'none'

  return {
    turboKit: isOriginallyTurbo,
    turboLevel: defaultTurboLevel,
    engineInternals: defaultInternals,
    rearWingType: defaultWingType,
    multimediaKit: hasDefaultMultimedia,
    boostGaugeKit: false,
    exhaustType: isOriginallyTurbo ? 'sport' : 'stock',
    intakeType: 'stock',
    tires: 'street',
    tuningStage: 0,
    hasExhaustValveKit: false,
    exhaustValveOpen: false,
    fuelType: defaultFuel,
    hasNosKit: false,
    hasPopsAndBangs: false,
    popsAndBangsEnabled: false,
    suspensionHeight: 'stock',
    rearWingPosition: vehicleId === 'porsche-gt3' ? 'balanced' : 'low_drag',
    clutchUpgrade: 'stock',
    brakeUpgrade: 'stock',
    paintColor: undefined,
    brakeCaliperColor: undefined,
  }
}

/**
 * Resolve declarativamente se o veículo possui controle funcional de abertura de válvula/difusor
 * de escapamento no estado atual de equipamentos.
 *
 * Regras (Fase 4.4.2.2):
 * - Não é concedido automaticamente aos 15 veículos originais.
 * - Disponível apenas quando o veículo declarar `cabin.hasFactoryActiveExhaust === true`,
 *   quando possuir o `hasExhaustValveKit` instalado na Oficina, ou quando estiver equipado
 *   com escapamento aftermarket compatível com válvula (`cat_back` ou `downpipe`).
 */
export function canControlExhaustValve(
  vehicle?: VehicleConfig | null,
  upgrades?: { exhaustType?: ExhaustType; hasExhaustValveKit?: boolean } | null,
): boolean {
  if (!vehicle) return false
  if (vehicle.cabin?.hasFactoryActiveExhaust === true) return true
  if (upgrades?.hasExhaustValveKit === true) return true
  const exhaustType = upgrades?.exhaustType
  return exhaustType === 'cat_back' || exhaustType === 'downpipe'
}

// ─── 8. Runtime Config Validation ────────────────────────────────────────────

const VALID_IGNITION_TYPES = new Set(['key', 'push_button'])
const VALID_START_INTERLOCKS = new Set(['none', 'brake', 'clutch', 'brake_or_clutch'])
const VALID_CLIMATE_TYPES = new Set(['none', 'manual_vent', 'manual_ac', 'auto_single', 'auto_dual', 'auto_tri'])
const VALID_CLIMATE_LOCATIONS = new Set(['multimedia', 'panel', 'none'])
const VALID_CONTROL_PANELS = new Set<ControlPanelTarget>(['controls', 'multimedia', 'none'])
const VALID_CONTROL_ACTUATIONS = new Set<ControlActuationType>(['physical', 'digital', 'none'])
const VALID_CONFIRMATION_STATUSES = new Set<EquipmentConfirmationStatus>([
  'confirmed',
  'estimated_or_optional',
  'unconfirmed',
])
const VALID_ASSIST_CONTROL_TYPES = new Set<DriverAssistControlType>([
  'steering_wheel_physical',
  'stalk_physical',
  'digital_multimedia',
  'none',
])
const VALID_ASSIST_ADJUSTABILITY = new Set<DriverAssistAdjustability>([
  'toggle_only',
  'setpoint_adjustable',
  'none',
])
const VALID_ASSIST_IMPL_STATES = new Set<DriverAssistImplementationState>([
  'pending_sensors',
  'not_applicable',
])
const VALID_WINDOW_CONTROLS = new Set(['none', 'manual_crank', 'electric'])
const VALID_SILHOUETTES = new Set([
  'hatch',
  'hatch_square',
  'sedan',
  'coupe',
  'pickup_compact',
  'pickup_mid',
  'motorcycle',
])
const VALID_MULTIMEDIA_UNITS: ReadonlySet<MultimediaUnitId> = new Set([
  'toro_uconnect_7',
  'toro_uconnect_10_vertical',
  'porsche_pcm6',
  'vw_discover_pro',
  'vw_discover_media_8',
  'bmw_idrive8_curved',
  'ford_pampa_radio_1din',
  'ford_sync1_2012',
  'ford_sync3_8',
  'toyota_smart_connect',
  'honda_haudio',
  'retrofit_2din',
  'classic_radio_1din',
  'classic_blank_console',
  'generic_multimedia',
  'none',
])

/**
 * Valida a consistência estrutural e semântica de um `VehicleConfig`
 * (incluindo os novos campos declarativos opcionais da Fase 4.1).
 */
export function validateVehicleConfig(config: VehicleConfig): VehicleConfigValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['VehicleConfig inválido ou ausente.'], warnings }
  }

  if (!config.id || typeof config.id !== 'string') {
    errors.push('Campo obrigatório `id` ausente ou inválido.')
  }

  if (!config.info || config.info.weight <= 0 || config.info.wheelDiameter <= 0) {
    errors.push('`info.weight` e `info.wheelDiameter` devem ser positivos.')
  }

  if (!config.engine || config.engine.maxTorque <= 0 || config.engine.revLimiter <= config.engine.idleRpm) {
    errors.push('Configuração de motor inconsistente (`maxTorque`, `idleRpm`, `revLimiter`).')
  }

  if (!config.transmission || !Array.isArray(config.transmission.gearRatios) || config.transmission.gearRatios.length === 0) {
    errors.push('`transmission.gearRatios` deve conter ao menos uma marcha.')
  }

  // Garante que drivetrain não esteja duplicado na raiz do objeto
  if ('drivetrain' in (config as unknown as Record<string, unknown>)) {
    errors.push('Propriedade `drivetrain` duplicada na raiz: use exclusivamente `transmission.drivetrain`.')
  }

  if (config.transmission?.drivetrain !== undefined && !VALID_DRIVETRAINS.has(config.transmission.drivetrain)) {
    errors.push(`transmission.drivetrain inválido: "${String(config.transmission.drivetrain)}".`)
  }

  if (config.ignition) {
    if (!VALID_IGNITION_TYPES.has(config.ignition.type)) {
      errors.push(`ignition.type inválido: "${String(config.ignition.type)}".`)
    }
    if (
      config.ignition.startInterlock !== undefined &&
      !VALID_START_INTERLOCKS.has(config.ignition.startInterlock)
    ) {
      errors.push(`ignition.startInterlock inválido: "${String(config.ignition.startInterlock)}".`)
    }
    if (typeof config.ignition.supportsAccessoryMode !== 'boolean') {
      errors.push('ignition.supportsAccessoryMode deve ser boolean.')
    }
  }

  if (config.cabin) {
    if (!VALID_CLIMATE_TYPES.has(config.cabin.climateType)) {
      errors.push(`cabin.climateType inválido: "${String(config.cabin.climateType)}".`)
    }
    if (
      config.cabin.climateControlsLocation !== undefined &&
      !VALID_CLIMATE_LOCATIONS.has(config.cabin.climateControlsLocation)
    ) {
      errors.push(`cabin.climateControlsLocation inválido: "${String(config.cabin.climateControlsLocation)}".`)
    }
    if (!VALID_WINDOW_CONTROLS.has(config.cabin.windowControlType)) {
      errors.push(`cabin.windowControlType inválido: "${String(config.cabin.windowControlType)}".`)
    }
    if (![0, 2, 4].includes(config.cabin.windowCount)) {
      errors.push(`cabin.windowCount inválido: ${String(config.cabin.windowCount)} (esperado 0, 2 ou 4).`)
    }
    if (config.cabin.hasAcCompressor && (config.cabin.climateType === 'none' || config.cabin.climateType === 'manual_vent')) {
      warnings.push('cabin.hasAcCompressor=true com climateType sem A/C.')
    }
  }

  if (config.multimedia) {
    if (!VALID_MULTIMEDIA_UNITS.has(config.multimedia.unitId)) {
      errors.push(`multimedia.unitId inválido: "${String(config.multimedia.unitId)}".`)
    }
    if (config.multimedia.screenSize !== undefined && config.multimedia.screenSize <= 0) {
      errors.push('multimedia.screenSize deve ser positivo quando definido.')
    }
  }

  if (config.visual2d) {
    if (!VALID_SILHOUETTES.has(config.visual2d.silhouette)) {
      errors.push(`visual2d.silhouette inválido: "${String(config.visual2d.silhouette)}".`)
    }
    if (config.visual2d.lengthM <= 0 || config.visual2d.widthM <= 0) {
      errors.push('visual2d.lengthM e visual2d.widthM devem ser positivos.')
    }
    if (!config.visual2d.bodyColor || typeof config.visual2d.bodyColor !== 'string') {
      errors.push('visual2d.bodyColor deve ser uma string de cor válida.')
    }
  }

  if (config.controls) {
    const { climate, tractionControl, steeringWheel, driverAssists } = config.controls
    if (!climate || !VALID_CONTROL_PANELS.has(climate.panel) || !VALID_CONTROL_ACTUATIONS.has(climate.controlType)) {
      errors.push('controls.climate possui panel ou controlType inválido.')
    } else {
      if (!VALID_CONFIRMATION_STATUSES.has(climate.confirmationStatus)) {
        errors.push(`controls.climate.confirmationStatus inválido: "${String(climate.confirmationStatus)}".`)
      }
      if (!climate.available && climate.panel !== 'none') {
        errors.push('controls.climate indisponível deve declarar panel="none".')
      }
      if (config.cabin?.climateType === 'none' && (climate.available || climate.panel !== 'none')) {
        errors.push('controls.climate conflita com cabin.climateType="none".')
      }
      if (config.cabin?.climateControlsLocation) {
        const mappedPanel: ControlPanelTarget =
          config.cabin.climateControlsLocation === 'panel'
            ? 'controls'
            : config.cabin.climateControlsLocation
        if (mappedPanel !== climate.panel) {
          errors.push(
            `Conflito declarativo entre cabin.climateControlsLocation ("${config.cabin.climateControlsLocation}") e controls.climate.panel ("${climate.panel}").`,
          )
        }
      }
    }

    if (
      !tractionControl ||
      !VALID_CONTROL_PANELS.has(tractionControl.panel) ||
      !VALID_CONTROL_ACTUATIONS.has(tractionControl.controlType) ||
      !VALID_CONFIRMATION_STATUSES.has(tractionControl.confirmationStatus)
    ) {
      errors.push('controls.tractionControl possui campos estruturais inválidos.')
    } else {
      const hasTcsCfg = Boolean(config.transmission?.tcs?.enabled)
      if (tractionControl.available !== hasTcsCfg) {
        errors.push(
          `Inconsistência entre controls.tractionControl.available (${String(tractionControl.available)}) e transmission.tcs.enabled (${String(hasTcsCfg)}).`,
        )
      }
      if (!tractionControl.available && (tractionControl.userToggleable || tractionControl.panel !== 'none')) {
        errors.push('Veículo sem controle de tração não pode expor comando userToggleable ou panel ativo.')
      }
      if (tractionControl.userToggleable && tractionControl.panel === 'none') {
        errors.push('controls.tractionControl.userToggleable=true exige panel="controls" ou panel="multimedia".')
      }
      if (!tractionControl.userToggleable && tractionControl.panel !== 'none') {
        errors.push('controls.tractionControl.userToggleable=false deve declarar panel="none".')
      }
    }

    if (
      !steeringWheel ||
      typeof steeringWheel.hasAudioControls !== 'boolean' ||
      typeof steeringWheel.hasCruiseControls !== 'boolean' ||
      !VALID_CONFIRMATION_STATUSES.has(steeringWheel.confirmationStatus)
    ) {
      errors.push('controls.steeringWheel inválido.')
    }

    if (!driverAssists) {
      errors.push('controls.driverAssists ausente.')
    } else {
      for (const [assistKey, entry] of [
        ['cruiseControl', driverAssists.cruiseControl],
        ['adaptiveCruiseControl', driverAssists.adaptiveCruiseControl],
        ['laneKeepingAssist', driverAssists.laneKeepingAssist],
      ] as const) {
        if (
          !entry ||
          typeof entry.available !== 'boolean' ||
          !VALID_CONFIRMATION_STATUSES.has(entry.confirmationStatus) ||
          !VALID_ASSIST_CONTROL_TYPES.has(entry.controlType) ||
          !VALID_CONTROL_PANELS.has(entry.panel) ||
          !VALID_ASSIST_ADJUSTABILITY.has(entry.adjustable) ||
          !VALID_ASSIST_IMPL_STATES.has(entry.implementationState)
        ) {
          errors.push(`controls.driverAssists.${assistKey} possui valores inválidos.`)
        } else if (entry.available && entry.implementationState !== 'pending_sensors') {
          errors.push(
            `controls.driverAssists.${assistKey}: assistências disponíveis devem permanecer com implementationState="pending_sensors" nesta fase.`,
          )
        } else if (!entry.available && (entry.panel !== 'none' || entry.controlType !== 'none')) {
          errors.push(
            `controls.driverAssists.${assistKey} indisponível deve declarar panel="none" e controlType="none".`,
          )
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
