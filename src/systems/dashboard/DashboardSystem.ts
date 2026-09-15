import type { VehicleConfig, DashboardConfig, DashboardTheme, DrivingMode } from '@/types'
import type { EngineStatus } from '@/types/simulation'
import type { TransmissionMode } from '@/stores/useSimulationStore'
import { clamp, mapRange } from '@/utils/math'
import { formatGear } from '@/utils/format'

export interface DashboardInput {
  rpm: number
  engineStatus: EngineStatus
  isRevLimiting: boolean
  isBogWarning: boolean
  engineConfig: {
    maxRpm: number
    idleRpm: number
    revLimiter: number
  }
  speed: number
  currentGear: number
  transmissionMode: TransmissionMode
  drivingMode: DrivingMode
  isKickdown: boolean
  hasClutch: boolean
  throttle: number
  brake: number
  clutchPosition: number
  clutchSlipRpm: number
  clutchSlipRatio: number
  clutchTorqueTransfer: number
  clutchHeat: number
  isClutchSlipping: boolean
  tcsEnabled: boolean
  tcsIntervening: boolean
  tcsInterventionLevel: number
  dashboardConfig: DashboardConfig
}

export interface DashboardTelemetry {
  tachometer: {
    rpm: number
    maxRpm: number
    redlineStart: number
    normalMax: number
    elevatedMax: number
    needleAngle: number
    normalizedRpm: number
  }
  shiftLight: {
    isActive: boolean
    isBlinking: boolean
    offsetRpm: number
  }
  speedometer: {
    speed: number
    maxSpeed: number
    needleAngle: number
  }
  gear: {
    label: string
    subLabel: string
    isNeutral: boolean
    isReverse: boolean
    transmissionMode: TransmissionMode
    drivingMode: DrivingMode
    isKickdown: boolean
  }
  engine: {
    status: 'OFF' | 'STARTING' | 'RUNNING' | 'STALLED'
    isRunning: boolean
    isStalled: boolean
    isStarting: boolean
    isOff: boolean
    isBogWarning: boolean
  }
  pedals: {
    throttlePercent: number
    brakePercent: number
    clutchPercent: number | null
    hasClutch: boolean
  }
  clutchTelemetry: {
    slipRpm: number
    slipRatio: number
    torqueTransfer: number
    heat: number
    isSlipping: boolean
    hasClutch: boolean
  }
  tcs: {
    enabled: boolean
    statusLabel: 'TCS ON' | 'TCS OFF'
    intervening: boolean
    interventionLevel: number
  }
  warningLights: {
    checkEngine: boolean
    oil: boolean
    battery: boolean
    brake: boolean
    tcs: boolean
    tcsFlash: boolean
    temp: boolean
    clutchSlip: boolean
    bogWarning: boolean
  }
  auxGauges: {
    fuelLevel: number
    fuelCapacity: number
    fuelPercent: number
    coolantTemp: number
    tempTarget: number
    isTempOptimal: boolean
  }
  theme: DashboardTheme
}

/**
 * DashboardSystem — Sistema modular de instrumentação e telemetria visual.
 *
 * Transforma o estado REAL da física (motor, transmissão, física longitudinal,
 * pedais e TCS) em dados limpos para os mostradores SVG, sem criar física paralela
 * e sem duplicar cálculos nos componentes visuais.
 */
export class DashboardSystem {
  /**
   * Transforma os dados brutos da simulação em telemetria visual pura.
   */
  public static computeTelemetry(input: DashboardInput): DashboardTelemetry {
    const {
      rpm,
      engineStatus,
      isRevLimiting,
      isBogWarning,
      engineConfig,
      speed,
      currentGear,
      transmissionMode,
      drivingMode,
      isKickdown,
      hasClutch,
      throttle,
      brake,
      clutchPosition,
      clutchSlipRpm,
      clutchSlipRatio,
      clutchTorqueTransfer,
      clutchHeat,
      isClutchSlipping,
      tcsEnabled,
      tcsIntervening,
      tcsInterventionLevel,
      dashboardConfig,
    } = input

    const maxRpm = dashboardConfig.tachometerMax || engineConfig.maxRpm || 8000
    const redlineStart = dashboardConfig.redlineStart || engineConfig.revLimiter || 6000
    const shiftLightOffset = dashboardConfig.shiftLightOffsetRpm ?? 500
    const maxSpeed = dashboardConfig.speedometerMax || 220
    const theme: DashboardTheme = dashboardConfig.theme || 'default'

    // 1. Tacômetro
    const clampedRpm = clamp(rpm, 0, maxRpm)
    // Arco padrão de 240° (-210° a +30°)
    const startAngle = -210
    const endAngle = 30
    const tachNeedleAngle = mapRange(clampedRpm, 0, maxRpm, startAngle, endAngle)
    const normalizedRpm = clamp(clampedRpm / maxRpm, 0, 1)

    // Faixas de RPM: Normal (< 75% da redline), Elevada (75% a redline), Redline (>= redline)
    const normalMax = redlineStart * 0.75
    const elevatedMax = redlineStart

    // 2. Shift Light
    const isRunning = engineStatus === 'running'
    const shiftThreshold = Math.max(engineConfig.idleRpm, redlineStart - shiftLightOffset)
    const shiftLightActive = isRunning && clampedRpm >= shiftThreshold
    const shiftLightBlink = isRunning && (clampedRpm >= engineConfig.revLimiter - 150 || isRevLimiting)

    // 3. Velocímetro (baseado estritamente na velocidade real da VehiclePhysics)
    const clampedSpeed = clamp(speed, 0, maxSpeed)
    const speedNeedleAngle = mapRange(clampedSpeed, 0, maxSpeed, startAngle, endAngle)

    // 4. Marcha / Relação
    const isNeutral = currentGear === 0
    const isReverse = currentGear === -1
    const isAutomatic = transmissionMode === 'automatic'
    const isManualSimulated = transmissionMode === 'manual_simulated'

    let gearLabel: string
    let gearSubLabel = ''

    if (isNeutral) {
      gearLabel = 'N'
      gearSubLabel = isAutomatic ? 'NEUTRO' : 'PONTO MORTO'
    } else if (isReverse) {
      gearLabel = 'R'
      gearSubLabel = 'RÉ'
    } else if (isAutomatic) {
      gearLabel = `D${currentGear > 0 ? currentGear : ''}`
      gearSubLabel = drivingMode.toUpperCase()
    } else if (isManualSimulated) {
      gearLabel = `M${currentGear}`
      gearSubLabel = 'MANUAL'
    } else {
      gearLabel = formatGear(currentGear)
      gearSubLabel = 'MANUAL'
    }

    // 5. Estado do motor
    const engineUpperStatus: 'OFF' | 'STARTING' | 'RUNNING' | 'STALLED' =
      engineStatus === 'running'
        ? 'RUNNING'
        : engineStatus === 'starting'
        ? 'STARTING'
        : engineStatus === 'stalled'
        ? 'STALLED'
        : 'OFF'

    // 6. Pedais (0% a 100%)
    const throttlePercent = Math.round(clamp(throttle, 0, 1) * 100)
    const brakePercent = Math.round(clamp(brake, 0, 1) * 100)
    const clutchPercent = hasClutch ? Math.round(clamp(clutchPosition, 0, 1) * 100) : null
    // 7. Luzes de aviso automotivas (Tell-tales baseadas em estados reais)
    const warningLights = {
      // Check engine: acende se motor estolou ou no auto-teste durante partida
      checkEngine: engineStatus === 'stalled' || engineStatus === 'starting',
      // Luz de óleo: acende se motor desligado ou estolado (bomba sem pressão)
      oil: engineStatus === 'off' || engineStatus === 'stalled',
      // Bateria/Alternador: acende se não está gerando carga com motor ligado
      battery: engineStatus === 'off' || engineStatus === 'starting' || engineStatus === 'stalled',
      // Freio: acende quando pedal de freio está pressionado
      brake: brake > 0.05,
      // TCS: acende fixo quando TCS desativado
      tcs: !tcsEnabled,
      // TCS flash: pisca durante intervenção
      tcsFlash: tcsEnabled && tcsIntervening,
      // Temperatura: neutro (pronto para futura física térmica)
      temp: false,
      // Clutch slip: indica patinão ativa da embreagem
      clutchSlip: hasClutch && (isClutchSlipping ?? false),
      // Bog warning: motor amarrando (pré-afogamento)
      bogWarning: (isBogWarning ?? false) && engineStatus === 'running',
    }

    // 8. Instrumentos auxiliares (Combustível e Temperatura — estrutura preparada)
    const fuelCapacity = dashboardConfig.fuelCapacity ?? 50
    const fuelLevel = fuelCapacity
    const coolantTemp = dashboardConfig.coolantTempTarget ?? 90

    return {
      tachometer: {
        rpm: clampedRpm,
        maxRpm,
        redlineStart,
        normalMax,
        elevatedMax,
        needleAngle: tachNeedleAngle,
        normalizedRpm,
      },
      shiftLight: {
        isActive: shiftLightActive,
        isBlinking: shiftLightBlink,
        offsetRpm: shiftLightOffset,
      },
      speedometer: {
        speed: clampedSpeed,
        maxSpeed,
        needleAngle: speedNeedleAngle,
      },
      gear: {
        label: gearLabel,
        subLabel: gearSubLabel,
        isNeutral,
        isReverse,
        transmissionMode,
        drivingMode,
        isKickdown,
      },
      engine: {
        status: engineUpperStatus,
        isRunning: engineStatus === 'running',
        isStalled: engineStatus === 'stalled',
        isStarting: engineStatus === 'starting',
        isOff: engineStatus === 'off',
        isBogWarning: (isBogWarning ?? false) && engineStatus === 'running',
      },
      pedals: {
        throttlePercent,
        brakePercent,
        clutchPercent,
        hasClutch,
      },
      clutchTelemetry: {
        slipRpm: hasClutch ? (clutchSlipRpm ?? 0) : 0,
        slipRatio: hasClutch ? (clutchSlipRatio ?? 0) : 0,
        torqueTransfer: clutchTorqueTransfer ?? 0,
        heat: hasClutch ? (clutchHeat ?? 0) : 0,
        isSlipping: hasClutch && (isClutchSlipping ?? false),
        hasClutch,
      },
      tcs: {
        enabled: tcsEnabled,
        statusLabel: tcsEnabled ? 'TCS ON' : 'TCS OFF',
        intervening: tcsIntervening,
        interventionLevel: tcsInterventionLevel,
      },
      warningLights,
      auxGauges: {
        fuelLevel,
        fuelCapacity,
        fuelPercent: 100,
        coolantTemp,
        tempTarget: coolantTemp,
        isTempOptimal: true,
      },
      theme,
    }
  }

  /**
   * Constrói o payload de entrada a partir da VehicleConfig e da store.
   */
  public static createInputFromState(
    config: VehicleConfig,
    state: {
      rpm: number
      status: EngineStatus
      isRevLimiting: boolean
      isBogWarning: boolean
      speed: number
      currentGear: number
      transmissionMode: TransmissionMode
      drivingMode: DrivingMode
      isKickdown: boolean
      throttle: number
      brake: number
      clutchPosition: number
      clutchSlipRpm: number
      clutchSlipRatio: number
      clutchTorqueTransfer: number
      clutchHeat: number
      isClutchSlipping: boolean
      tcsEnabled: boolean
      tcsIntervening: boolean
      tcsInterventionLevel: number
    },
  ): DashboardInput {
    return {
      rpm: state.rpm,
      engineStatus: state.status,
      isRevLimiting: state.isRevLimiting,
      isBogWarning: state.isBogWarning,
      engineConfig: {
        maxRpm: config.engine.maxRpm,
        idleRpm: config.engine.idleRpm,
        revLimiter: config.engine.revLimiter,
      },
      speed: state.speed,
      currentGear: state.currentGear,
      transmissionMode: state.transmissionMode,
      drivingMode: state.drivingMode,
      isKickdown: state.isKickdown,
      hasClutch: config.transmission.hasClutch,
      throttle: state.throttle,
      brake: state.brake,
      clutchPosition: state.clutchPosition,
      clutchSlipRpm: state.clutchSlipRpm,
      clutchSlipRatio: state.clutchSlipRatio,
      clutchTorqueTransfer: state.clutchTorqueTransfer,
      clutchHeat: state.clutchHeat,
      isClutchSlipping: state.isClutchSlipping,
      tcsEnabled: state.tcsEnabled,
      tcsIntervening: state.tcsIntervening,
      tcsInterventionLevel: state.tcsInterventionLevel,
      dashboardConfig: config.dashboard,
    }
  }
}
