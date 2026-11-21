import { clamp } from '@/utils/math'
import { VehicleChassis, type ChassisConfig, type DynamicLoadResult, type AxleLoads, createVehicleChassis } from './Chassis'
import { WorldMap, type SurfaceType } from '../world/WorldMap'
import type { SuspensionHeight, RearWingPosition, RearWingType } from '@/stores/useGarageStore'

export type FourWheelDriveMode = 'auto' | '4wd' | '4wd_low'
export type ABSChannelState = 'PASSIVE' | 'APPLY' | 'HOLD' | 'DUMP' | 'LATCH'

export interface VehiclePhysicsConfig {
  weight: number        // kg
  wheelDiameter: number // metros
  isMotorcycle?: boolean
  vehicleId?: string
  chassis?: VehicleChassis | ChassisConfig
  fourWheelDriveMode?: FourWheelDriveMode
  roadGradePercent?: number
  initialPositionX?: number
  initialPositionY?: number
  initialHeadingDeg?: number
  frontFinalDrive?: number
  brakeUpgrade?: 'stock' | 'sport'
}

export interface PhysicsTickInput {
  driveTorqueAtTransmission: number // Nm entregue ao eixo primário pela embreagem
  gearRatio: number                 // relação da marcha atual
  finalDrive: number                // relação do diferencial
  frontFinalDrive?: number          // relação do diferencial dianteiro (ex: Porsche 992 3.330)
  brake: number                     // 0-1 posição do freio
  deltaTime: number                 // segundos
  steeringAngleRad?: number         // ângulo de esterçamento das rodas dianteiras (radianos)
  gear?: number                     // marcha engatada (-1 para ré)
  isRaining?: boolean               // condição climática de chuva
  brakeUpgrade?: 'stock' | 'sport'  // upgrade de freios esportivos (Brembo)
}

export interface PhysicsTickResult {
  speedKmh: number                  // km/h
  speedMs: number                   // m/s
  acceleration: number              // m/s²
  transmissionAngularVelocity: number // rad/s na entrada do câmbio
  wheelRpm: number
  wheelSpeedKmh: number             // velocidade periférica da roda (km/h)
  tractionForce: number             // Newtons
  resistiveForce: number            // Newtons
  wheelTorque: number               // torque bruto aplicado nas rodas (Nm)
  maxGripTorque: number             // torque máximo suportado pela aderência do solo (Nm)
  isWheelSlipping: boolean
  slipRatio: number
  // Dinâmica e Navegação no Mundo 2D
  positionX: number
  positionY: number
  headingDeg: number
  headingRad: number
  steeringAngleRad: number
  yawRate: number
  surfaceType: SurfaceType
  zoneName: string
  absEngaged: boolean
  isAirbrakeActive: boolean
  wheelAngularVelocities?: [number, number, number, number]
  absChannelStates?: [ABSChannelState, ABSChannelState, ABSChannelState, ABSChannelState]
}

/**
 * VehiclePhysics — Simulação de dinâmica veicular 2D (longitudinal + esterçamento Ackermann a 120 Hz).
 * 
 * Integrado com:
 * 1. VehicleChassis: Centro de massa, geometria entre-eixos, distribuição dinâmica de carga D'Alembert.
 * 2. Tração Porsche 911 Turbo S PTM (AWD): Eixo traseiro principal + acoplamento eletro-hidráulico PTM dianteiro.
 * 3. Tração 4x4 Fiat Toro Ranch AT9: Modos AUTO sob demanda, 4WD LOCK 50/50 e 4WD LOW com crawl ratio.
 * 4. ABS de 4 Canais: Máquina de estados prioritária (DUMP > HOLD > APPLY > LATCH > PASSIVE), filtro passa-baixa a 120 Hz (tau=15ms) e corte seguro em v < 2.0 m/s.
 * 5. Sistema PAA com Airbrake: Aerodinâmica ativa Porsche com arrasto de frenagem a ar em velocidades > 90 km/h sob frenagem severa.
 * 6. Cinemática de Direção 2D (Bicycle Model a 120 Hz): Integrado no mesmo relógio físico de 120 Hz com detecção de superfícies e barreiras do WorldMap.
 */
export class VehiclePhysics {
  private readonly mass: number
  private readonly wheelRadius: number
  private readonly efficiency: number
  private rollingCoeff: number
  private driveAxleWeightRatio: number
  private fourWheelDriveMode: FourWheelDriveMode = 'auto'
  private readonly isMotorcycle: boolean
  private readonly vehicleId?: string
  private readonly chassis: VehicleChassis

  // Propriedades Aerodinâmicas e de Suspensão Dinâmicas
  private baseAeroConstant: number = 0.40
  private currentAeroConstant: number = 0.40
  private downforceCoeff: number = 0.10
  private suspensionHeightOffset: number = 0
  private effectiveDownforceN: number = 0
  private suspensionHeight: SuspensionHeight = 'stock'
  private rearWingPosition: RearWingPosition = 'balanced'
  private isAeroWingExtended: boolean = false
  private rearWingType: RearWingType = 'none'
  private isAirbrakeActive: boolean = false

  private speedMs: number = 0 // velocidade linear longitudinal em m/s
  private accelerationMs2: number = 0
  private surfaceFriction: number = 0.95 // Coeficiente de atrito efetivo mu (superfície × composto de pneu)
  private baseSurfaceFriction: number = 0.95 // Atrito bruto da superfície do WorldMap
  private tireCompound: 'street' | 'semi_slick' = 'street'
  private manualFrictionOverride: number | null = null
  private roadGradePercent: number = 0 // Inclinação em % (+ = subida, - = descida)
  private wheelSpeedMs: number = 0

  // ─── Estado de Navegação e Cinemática no Mundo 2D ───
  private positionX: number = 0        // metros no grid global
  private positionY: number = 0        // metros no grid global
  private headingRad: number = 0       // rumo em radianos (0 = Norte / +Y, pi/2 = Leste / +X)
  private steeringAngleRad: number = 0 // ângulo atual de esterçamento das rodas dianteiras
  private yawRate: number = 0          // rad/s (velocidade angular de guinada)
  private currentSurface: SurfaceType = 'asphalt'
  private currentZoneName: string = 'Rotatória Central'

  // ─── ABS de 4 Canais & Velocidades Angulares Individuais ───
  private absChannelStates: [ABSChannelState, ABSChannelState, ABSChannelState, ABSChannelState] = [
    'PASSIVE',
    'PASSIVE',
    'PASSIVE',
    'PASSIVE',
  ]
  private wheelAngularVel: [number, number, number, number] = [0, 0, 0, 0] // [FL, FR, RL, RR] rad/s
  private filteredWheelAccels: [number, number, number, number] = [0, 0, 0, 0] // rad/s²
  private prevWheelAngularVel: [number, number, number, number] = [0, 0, 0, 0] // rad/s
  private absHoldTimers: [number, number, number, number] = [0, 0, 0, 0]       // segundos
  private absEngaged: boolean = false
  private brakeUpgrade: 'stock' | 'sport' = 'stock'
  private frontFinalDrive?: number

  constructor(config: VehiclePhysicsConfig) {
    this.isMotorcycle = config.isMotorcycle ?? false
    this.vehicleId = config.vehicleId
    this.frontFinalDrive = config.frontFinalDrive ?? (config.vehicleId === 'porsche-gt3' ? 3.330 : undefined)
    this.brakeUpgrade = config.brakeUpgrade ?? 'stock'
    this.fourWheelDriveMode = config.fourWheelDriveMode ?? 'auto'
    this.roadGradePercent = config.roadGradePercent ?? 0
    this.positionX = config.initialPositionX ?? WorldMap.SPAWN_X
    this.positionY = config.initialPositionY ?? WorldMap.SPAWN_Y
    if (config.initialHeadingDeg !== undefined) {
      this.headingRad = (config.initialHeadingDeg * Math.PI) / 180
    } else {
      this.headingRad = (WorldMap.SPAWN_HEADING_DEG * Math.PI) / 180
    }

    // Inicialização da representação física de chassi e centro de massa
    if (config.chassis instanceof VehicleChassis) {
      this.chassis = config.chassis
    } else if (config.chassis) {
      this.chassis = new VehicleChassis(config.chassis)
    } else if (config.vehicleId) {
      this.chassis = createVehicleChassis(config.vehicleId, {
        weight: config.weight,
        wheelDiameter: config.wheelDiameter,
        isMotorcycle: this.isMotorcycle,
      })
    } else {
      this.chassis = createVehicleChassis(undefined, {
        weight: config.weight,
        wheelDiameter: config.wheelDiameter,
        isMotorcycle: this.isMotorcycle,
      })
    }

    this.mass = this.chassis.totalMass
    this.wheelRadius = this.chassis.wheelRadius
    this.efficiency = this.isMotorcycle ? 0.93 : 0.90

    // Relação nominal de peso no eixo tracionado
    this.driveAxleWeightRatio = this.calculateDriveAxleWeightRatio()

    // Constante aerodinâmica 0.5 * rho * Cd * A
    this.baseAeroConstant = this.isMotorcycle ? 0.25 : 0.40
    this.currentAeroConstant = this.baseAeroConstant
    this.downforceCoeff = this.vehicleId === 'porsche-gt3' ? 0.35 : 0.08
    this.rollingCoeff = 0.015
  }

  setSuspensionHeight(height: SuspensionHeight): void {
    this.suspensionHeight = height
    switch (height) {
      case 'sport':
        this.suspensionHeightOffset = -0.03
        break
      case 'track':
        this.suspensionHeightOffset = -0.05
        break
      case 'lift':
        this.suspensionHeightOffset = 0.03
        break
      default:
        this.suspensionHeightOffset = 0
        break
    }
  }

  getSuspensionHeight(): SuspensionHeight {
    return this.suspensionHeight
  }

  setAerodynamics(
    wingPosition: RearWingPosition = 'balanced',
    isExtended = true,
    wingType: RearWingType = 'none'
  ): void {
    this.rearWingPosition = wingPosition
    this.isAeroWingExtended = isExtended
    this.rearWingType = wingType

    const isPorsche = this.vehicleId === 'porsche-gt3'
    if (isPorsche) {
      if (this.isAirbrakeActive) {
        // Airbrake ativo em frenagem severa
        this.currentAeroConstant = this.baseAeroConstant * 1.55
        this.downforceCoeff = 0.85
      } else if (!isExtended) {
        this.currentAeroConstant = this.baseAeroConstant * 0.92
        this.downforceCoeff = 0.10
      } else if (wingPosition === 'low_drag') {
        this.currentAeroConstant = this.baseAeroConstant * 0.88
        this.downforceCoeff = 0.12
      } else if (wingPosition === 'high_downforce') {
        this.currentAeroConstant = this.baseAeroConstant * 1.32
        this.downforceCoeff = 0.65
      } else {
        this.currentAeroConstant = this.baseAeroConstant * 1.05
        this.downforceCoeff = 0.35
      }
    } else {
      switch (wingType) {
        case 'sport_gt':
          this.currentAeroConstant = this.baseAeroConstant * 1.24
          this.downforceCoeff = 0.55
          break
        case 'aftermarket':
          this.currentAeroConstant = this.baseAeroConstant * 1.08
          this.downforceCoeff = 0.28
          break
        case 'oem':
          this.currentAeroConstant = this.baseAeroConstant * 1.02
          this.downforceCoeff = 0.16
          break
        case 'none':
        default:
          this.currentAeroConstant = this.baseAeroConstant * 0.96
          this.downforceCoeff = 0.04
          break
      }
    }
  }

  getDownforceN(): number {
    return this.effectiveDownforceN
  }

  getEffectiveAeroConstant(): number {
    return this.currentAeroConstant
  }

  getRearWingType(): RearWingType {
    return this.rearWingType
  }

  setFourWheelDriveMode(mode: FourWheelDriveMode): void {
    this.fourWheelDriveMode = mode
    this.driveAxleWeightRatio = this.calculateDriveAxleWeightRatio()
  }

  getFourWheelDriveMode(): FourWheelDriveMode {
    return this.fourWheelDriveMode
  }

  getDriveAxleWeightRatio(): number {
    return this.driveAxleWeightRatio
  }

  private calculateDriveAxleWeightRatio(): number {
    if (this.vehicleId === 'fiat-toro-ranch-2025') {
      if (this.fourWheelDriveMode === '4wd' || this.fourWheelDriveMode === '4wd_low') {
        return 1.0
      }
      return 0.85
    }
    if (this.vehicleId === 'porsche-gt3') {
      // Porsche 911 Turbo S PTM (AWD): sob demanda de tração mobiliza ambos os eixos
      return 0.95
    }
    if (this.vehicleId === 'fiat-toro-endurance-2025') {
      return this.chassis.frontWeightRatio
    }
    if (this.vehicleId === 'opala-4100' || this.isMotorcycle) {
      return this.chassis.rearWeightRatio
    }
    return this.chassis.frontWeightRatio
  }

  getChassis(): VehicleChassis {
    return this.chassis
  }

  setRoadGrade(gradePercent: number): void {
    this.roadGradePercent = clamp(gradePercent, -50, 50)
  }

  getRoadGrade(): number {
    return this.roadGradePercent
  }

  getAxleLoads(): DynamicLoadResult {
    const thetaRad = Math.atan(this.roadGradePercent / 100)
    const cosTheta = Math.cos(thetaRad)
    const sinTheta = Math.sin(thetaRad)

    const totalWeight = this.mass * this.chassis.gravity
    const normalWeight = totalWeight * cosTheta

    const b = this.chassis.distanceCgToRearAxle
    const a = this.chassis.distanceCgToFrontAxle
    const L = this.chassis.wheelbase
    const h = Math.max(0.20, this.chassis.centerOfMassHeight + this.suspensionHeightOffset)

    const staticFront = totalWeight * (cosTheta * (b / L) - sinTheta * (h / L))
    const staticRear = totalWeight * (cosTheta * (a / L) + sinTheta * (h / L))

    const dynamicTransfer = (this.mass * h / L) * this.accelerationMs2

    const minLoad = this.chassis.minAxleLoad
    const frontLoad = clamp(staticFront - dynamicTransfer, minLoad, normalWeight - minLoad)
    const rearLoad = clamp(staticRear + dynamicTransfer, minLoad, normalWeight - minLoad)

    return {
      frontAxleLoad: frontLoad,
      rearAxleLoad: rearLoad,
      frontWheelLoad: frontLoad / this.chassis.wheelsPerAxle,
      rearWheelLoad: rearLoad / this.chassis.wheelsPerAxle,
      totalWeight: normalWeight,
      loadTransferN: dynamicTransfer,
      accelerationX: this.accelerationMs2,
    }
  }

  getDynamicWheelLoads(ay: number = 0): {
    frontAxleLoad: number
    rearAxleLoad: number
    fl: number
    fr: number
    rl: number
    rr: number
    totalWeight: number
  } {
    const axleLoads = this.getAxleLoads()
    const trackWidth = 1.60
    const h = Math.max(0.20, this.chassis.centerOfMassHeight + this.suspensionHeightOffset)
    const lateralTransfer = (this.mass * h / trackWidth) * ay

    const latFront = lateralTransfer * this.chassis.frontWeightRatio
    const latRear = lateralTransfer * this.chassis.rearWeightRatio

    const halfFront = axleLoads.frontAxleLoad / 2
    const halfRear = axleLoads.rearAxleLoad / 2
    const minWheelLoad = this.chassis.minAxleLoad / 2

    const fl = clamp(halfFront - latFront, minWheelLoad, axleLoads.frontAxleLoad - minWheelLoad)
    const fr = clamp(halfFront + latFront, minWheelLoad, axleLoads.frontAxleLoad - minWheelLoad)
    const rl = clamp(halfRear - latRear, minWheelLoad, axleLoads.rearAxleLoad - minWheelLoad)
    const rr = clamp(halfRear + latRear, minWheelLoad, axleLoads.rearAxleLoad - minWheelLoad)

    return {
      frontAxleLoad: axleLoads.frontAxleLoad,
      rearAxleLoad: axleLoads.rearAxleLoad,
      fl,
      fr,
      rl,
      rr,
      totalWeight: axleLoads.totalWeight,
    }
  }

  getStaticAxleLoads(): AxleLoads {
    return this.chassis.getStaticAxleLoads()
  }

  getSpeedKmh(): number {
    return this.speedMs * 3.6
  }

  getSpeedMs(): number {
    return this.speedMs
  }

  getWheelSpeedKmh(): number {
    return this.wheelSpeedMs * 3.6
  }

  getWheelSpeedMs(): number {
    return this.wheelSpeedMs
  }

  getAcceleration(): number {
    return this.accelerationMs2
  }

  setSpeedKmh(speedKmh: number): void {
    this.speedMs = Math.max(0, speedKmh / 3.6)
    this.wheelSpeedMs = this.speedMs
    const omega = this.wheelRadius > 0 ? this.speedMs / this.wheelRadius : 0
    this.wheelAngularVel = [omega, omega, omega, omega]
    this.prevWheelAngularVel = [omega, omega, omega, omega]
    this.filteredWheelAccels = [0, 0, 0, 0]
  }

  setSurfaceFriction(mu: number): void {
    const clamped = clamp(mu, 0.05, 1.65)
    this.manualFrictionOverride = clamped
    this.surfaceFriction = clamped
  }

  clearSurfaceFrictionOverride(): void {
    this.manualFrictionOverride = null
  }

  /**
   * Configura o composto de pneu e recalcula o atrito composto (pneu × superfície).
   * - Street (radial de rua): referência 1.00x em todas as superfícies.
   * - Semi-slick UHP: +28% no asfalto seco / zebra, -16% em piso molhado (menor drenagem), -10% em terra/grama.
   */
  setTireCompound(compound: 'street' | 'semi_slick', isRaining: boolean = false): void {
    this.tireCompound = compound
    this.manualFrictionOverride = null
    this.surfaceFriction = this.computeCompositeFriction(this.baseSurfaceFriction, this.currentSurface, isRaining)
  }

  getTireCompound(): 'street' | 'semi_slick' {
    return this.tireCompound
  }

  private computeCompositeFriction(baseMu: number, surfaceType: SurfaceType, isRaining: boolean): number {
    if (this.tireCompound === 'street') {
      return clamp(baseMu, 0.15, 1.65)
    }
    const isWet = isRaining || surfaceType === 'wet_asphalt'
    const isOffroad = surfaceType === 'grass' || surfaceType === 'gravel'
    const tireMult = isWet ? 0.84 : isOffroad ? 0.90 : 1.28
    return clamp(baseMu * tireMult, 0.15, 1.65)
  }

  getSurfaceFriction(): number {
    return this.surfaceFriction
  }

  // ─── Getters e Setters de Navegação 2D ───
  getPosition(): { x: number; y: number } {
    return { x: this.positionX, y: this.positionY }
  }

  setPosition(x: number, y: number, headingDeg?: number): void {
    this.positionX = x
    this.positionY = y
    if (headingDeg !== undefined) {
      this.headingRad = (headingDeg * Math.PI) / 180
    }
  }

  getHeadingDeg(): number {
    let deg = (this.headingRad * 180) / Math.PI
    deg = deg % 360
    if (deg < 0) deg += 360
    return deg
  }

  getHeadingRad(): number {
    return this.headingRad
  }

  getYawRate(): number {
    return this.yawRate
  }

  getSteeringAngleRad(): number {
    return this.steeringAngleRad
  }

  setSteeringAngle(angleRad: number): void {
    const maxSteer = 0.58 // ~33 graus
    this.steeringAngleRad = clamp(angleRad, -maxSteer, maxSteer)
  }

  getCurrentSurface(): SurfaceType {
    return this.currentSurface
  }

  getCurrentZoneName(): string {
    return this.currentZoneName
  }

  getIsAirbrakeActive(): boolean {
    return this.isAirbrakeActive
  }

  getAbsEngaged(): boolean {
    return this.absEngaged
  }

  /**
   * Retorna o torque máximo que o atrito dos pneus suporta antes de patinar.
   */
  getMaxGripTorque(): number {
    const axleLoads = this.getAxleLoads()
    let normalForceOnDrivenWheels = 0

    if (this.vehicleId === 'fiat-toro-ranch-2025') {
      if (this.fourWheelDriveMode === '4wd' || this.fourWheelDriveMode === '4wd_low') {
        normalForceOnDrivenWheels = axleLoads.frontAxleLoad + axleLoads.rearAxleLoad
      } else {
        const isSlipDetected = Math.abs(this.wheelSpeedMs - this.speedMs) > 0.1
        const rearShare = isSlipDetected ? 1.0 : 0.65
        normalForceOnDrivenWheels = axleLoads.frontAxleLoad + axleLoads.rearAxleLoad * rearShare
      }
    } else if (this.vehicleId === 'porsche-gt3') {
      // Tração PTM AWD inteligente:
      // O eixo traseiro é a base de tração; sob aceleração ou deslizamento o PTM
      // acopla o eixo dianteiro proporcionalmente à carga normal dianteira disponível
      const isSlipDetected = Math.abs(this.wheelSpeedMs - this.speedMs) > 0.05
      const ptmFrontShare = isSlipDetected ? 1.0 : clamp(Math.abs(this.accelerationMs2) / 3.5, 0.30, 1.0)
      normalForceOnDrivenWheels = axleLoads.rearAxleLoad + axleLoads.frontAxleLoad * ptmFrontShare
    } else if (this.vehicleId === 'fiat-toro-endurance-2025') {
      normalForceOnDrivenWheels = axleLoads.frontAxleLoad
    } else if (this.vehicleId === 'opala-4100' || this.isMotorcycle) {
      normalForceOnDrivenWheels = axleLoads.rearAxleLoad
    } else {
      normalForceOnDrivenWheels = axleLoads.frontAxleLoad
    }

    const downforceOnDrivenWheels = this.effectiveDownforceN * this.driveAxleWeightRatio
    const totalNormalForce = normalForceOnDrivenWheels + downforceOnDrivenWheels
    const maxGripForce = this.surfaceFriction * totalNormalForce
    return maxGripForce * this.wheelRadius
  }

  /**
   * Processa o sistema ABS de 4 canais a 120 Hz com velocidades e escorregamentos individuais por roda.
   */
  private processABS(
    effectiveBrake: number,
    deltaTime: number,
    wheelLoads?: { fl: number; fr: number; rl: number; rr: number },
    brakeUpgradeMultiplier: number = 1.0,
  ): {
    modulatedBrake: number
    absEngaged: boolean
    channelModulations: [number, number, number, number]
  } {
    const defaultModulations: [number, number, number, number] = [
      effectiveBrake * brakeUpgradeMultiplier,
      effectiveBrake * brakeUpgradeMultiplier,
      effectiveBrake * brakeUpgradeMultiplier,
      effectiveBrake * brakeUpgradeMultiplier,
    ]

    if (this.speedMs < 2.0 || effectiveBrake < 0.12) {
      // Em velocidades abaixo de 2.0 m/s (~7.2 km/h) o ABS desativa para permitir parada total
      this.absChannelStates = ['PASSIVE', 'PASSIVE', 'PASSIVE', 'PASSIVE']
      this.absEngaged = false
      return {
        modulatedBrake: effectiveBrake * brakeUpgradeMultiplier,
        absEngaged: false,
        channelModulations: defaultModulations,
      }
    }

    const wheelRadius = this.wheelRadius
    const trackWidth = 1.60
    const halfTrack = trackWidth / 2
    const cosDelta = Math.cos(this.steeringAngleRad)

    // Velocidades locais de solo de cada roda considerando esterçamento e guinada
    const vFL = Math.max(0.15, (this.speedMs * cosDelta) - this.yawRate * halfTrack)
    const vFR = Math.max(0.15, (this.speedMs * cosDelta) + this.yawRate * halfTrack)
    const vRL = Math.max(0.15, this.speedMs - this.yawRate * halfTrack)
    const vRR = Math.max(0.15, this.speedMs + this.yawRate * halfTrack)
    const localSpeeds = [vFL, vFR, vRL, vRR]

    let anyChannelActive = false
    let totalModulation = 0
    const channelModulations: [number, number, number, number] = [1, 1, 1, 1]

    // Filtro digital passa-baixa a 120 Hz com tau = 15 ms:
    // alpha = dt / (dt + tau) = 0.00833 / (0.00833 + 0.015) = 0.357 (ou 0.426)
    const filterAlpha = 0.426

    const wheelInertia = this.chassis.wheelInertia || 1.25

    for (let i = 0; i < 4; i++) {
      const vLoc = localSpeeds[i]
      const currentWheelOmega = this.wheelAngularVel[i] > 0
        ? this.wheelAngularVel[i]
        : this.wheelSpeedMs / wheelRadius

      // Carga individual normal considerada na sensibilidade de travamento
      const loadRatio = wheelLoads
        ? [wheelLoads.fl, wheelLoads.fr, wheelLoads.rl, wheelLoads.rr][i] / (this.mass * 9.81 * 0.25)
        : 1.0

      const normalWheelWeight = (this.mass * this.chassis.gravity * 0.25) * loadRatio
      const wheelGripForce = normalWheelWeight * this.surfaceFriction
      const maxWheelBrakeForce = (this.mass * this.chassis.gravity * 1.15 * 0.25) * effectiveBrake * brakeUpgradeMultiplier

      let wheelDecel = (currentWheelOmega - this.prevWheelAngularVel[i]) / Math.max(deltaTime, 0.001)
      if (maxWheelBrakeForce > wheelGripForce && effectiveBrake > 0.2) {
        const excessTorque = (maxWheelBrakeForce - wheelGripForce) * wheelRadius
        const dynDecel = -(excessTorque / wheelInertia)
        wheelDecel = Math.min(wheelDecel, dynDecel)
      }

      this.prevWheelAngularVel[i] = currentWheelOmega
      this.filteredWheelAccels[i] = (1 - filterAlpha) * this.filteredWheelAccels[i] + filterAlpha * wheelDecel

      const wheelLinearSpeed = currentWheelOmega * wheelRadius
      const slip = clamp((vLoc - wheelLinearSpeed) / vLoc, 0, 1)

      const slipThreshold = clamp(0.18 * Math.sqrt(Math.max(0.4, loadRatio)), 0.12, 0.25)

      // Máquina de estados prioritária: DUMP (P1) > HOLD (P2) > APPLY (P3) > PASSIVE (P5)
      if (slip > slipThreshold || this.filteredWheelAccels[i] < -75.0) {
        this.absChannelStates[i] = 'DUMP'
        this.absHoldTimers[i] = 0.035
        anyChannelActive = true
      } else if (this.absChannelStates[i] === 'DUMP' && this.filteredWheelAccels[i] >= 0) {
        this.absChannelStates[i] = 'HOLD'
      } else if (this.absChannelStates[i] === 'HOLD') {
        this.absHoldTimers[i] -= deltaTime
        if (this.absHoldTimers[i] <= 0) {
          this.absChannelStates[i] = 'APPLY'
        }
        anyChannelActive = true
      } else if (this.absChannelStates[i] === 'APPLY') {
        if (slip < 0.10) {
          this.absChannelStates[i] = 'PASSIVE'
        } else {
          anyChannelActive = true
        }
      }

      // Modulação de pressão de freio por estado
      let mod = 1.00
      switch (this.absChannelStates[i]) {
        case 'DUMP':
          mod = 0.75 // Alívio controlado de pressão
          break
        case 'HOLD':
          mod = 0.88 // Retenção sob limiar ótimo
          break
        case 'APPLY':
          mod = 0.96 // Reaplicação progressiva
          break
        default:
          mod = 1.00 // Pressão integral
          break
      }
      channelModulations[i] = mod * brakeUpgradeMultiplier
      totalModulation += mod
    }

    const averageModulation = (totalModulation / 4) * brakeUpgradeMultiplier
    this.absEngaged = anyChannelActive
    return {
      modulatedBrake: effectiveBrake * averageModulation,
      absEngaged: anyChannelActive,
      channelModulations,
    }
  }

  /**
   * Executa um tick da física veicular integrada a 120 Hz.
   */
  tick(input: PhysicsTickInput): PhysicsTickResult {
    const { driveTorqueAtTransmission, gearRatio, finalDrive, brake, deltaTime, steeringAngleRad, gear, isRaining } = input
    const effectiveTotalRatio = gearRatio * finalDrive
    const effectiveBrakeUpgrade = input.brakeUpgrade ?? this.brakeUpgrade
    const brakeUpgradeMultiplier = effectiveBrakeUpgrade === 'sport' ? 1.25 : 1.0

    if (steeringAngleRad !== undefined) {
      this.setSteeringAngle(steeringAngleRad)
    }

    // Atualiza superfície e coeficiente de atrito composto (superfície × composto de pneu) no início do passo
    const mapQueryStart = WorldMap.query(this.positionX, this.positionY, isRaining)
    this.currentSurface = mapQueryStart.surface.type
    this.currentZoneName = mapQueryStart.zoneName
    this.baseSurfaceFriction = mapQueryStart.surface.friction
    this.surfaceFriction =
      this.manualFrictionOverride !== null
        ? this.manualFrictionOverride
        : this.computeCompositeFriction(this.baseSurfaceFriction, this.currentSurface, Boolean(isRaining))

    const thetaRad = Math.atan(this.roadGradePercent / 100)
    const cosTheta = Math.cos(thetaRad)
    const sinTheta = Math.sin(thetaRad)

    // Detecção de ativação de Airbrake no Porsche 911 Turbo S 992
    if (this.vehicleId === 'porsche-gt3') {
      const isSevereBraking = brake > 0.55 && this.speedMs > 25.0 // > 90 km/h
      if (isSevereBraking !== this.isAirbrakeActive) {
        this.isAirbrakeActive = isSevereBraking
        this.setAerodynamics(this.rearWingPosition, this.isAeroWingExtended, this.rearWingType)
      }
    }

    // Downforce aerodinâmico F_downforce = C_downforce * v²
    this.effectiveDownforceN = this.downforceCoeff * this.speedMs * this.speedMs
    const normalWeight = this.mass * this.chassis.gravity * cosTheta + this.effectiveDownforceN

    // Cargas normais dinâmicas por roda (transferência longitudinal + lateral)
    const ay = this.speedMs * this.yawRate
    const dynamicWheelLoads = this.getDynamicWheelLoads(ay)

    // 1. Torque e Força de Tração teórica nos Eixos e Rodas
    let wheelTorque = 0
    let tractionForce = 0
    let isWheelSlipping = false
    let slipRatio = 0

    const isPorschePTM = this.vehicleId === 'porsche-gt3'
    const frontFinalDriveRatio = input.frontFinalDrive ?? this.frontFinalDrive ?? (isPorschePTM ? 3.330 : finalDrive)
    const rearFinalDriveRatio = finalDrive // 3.020 no Porsche

    const maxGripTorque = this.getMaxGripTorque()
    const maxGripForce = maxGripTorque / this.wheelRadius

    // Vetores de torque motriz por roda [FL, FR, RL, RR]
    const driveTorquePerWheel: [number, number, number, number] = [0, 0, 0, 0]

    if (gearRatio !== 0 && driveTorqueAtTransmission > 0) {
      if (isPorschePTM) {
        // Porsche 911 Turbo S PTM AWD:
        // Torque entregue à caixa de transferência T_box com conservação de energia
        const tBox = driveTorqueAtTransmission * gearRatio * this.efficiency

        // Diferença de rotação entre eixos
        const wheelOmegaFront = Math.max(0, (this.wheelAngularVel[0] + this.wheelAngularVel[1]) / 2)
        const wheelOmegaRear = Math.max(0, (this.wheelAngularVel[2] + this.wheelAngularVel[3]) / 2)
        const deltaOmega = Math.max(0, wheelOmegaRear - wheelOmegaFront)

        // Taxa de acoplamento eletro-hidráulico PTM: gama_PTM in [0.15, 1.0]
        const ptmCoupling = clamp(
          0.20 + (this.accelerationMs2 / 3.5) * 0.40 + clamp(deltaOmega / 4.0, 0, 1) * 0.40,
          0.15,
          1.0,
        )

        // Divisão de torque: T_front + T_rear = T_box (CONSERVAÇÃO ESTRITA)
        const frontTorqueShare = 0.50 * ptmCoupling
        const torqueFront = tBox * frontTorqueShare
        const torqueRear = tBox - torqueFront

        // Torque nas rodas via relações dianteira (3.330) e traseira (3.020)
        const frontWheelTorque = torqueFront * frontFinalDriveRatio
        const rearWheelTorque = torqueRear * rearFinalDriveRatio
        wheelTorque = frontWheelTorque + rearWheelTorque

        // Limites de aderência por eixo baseados nas cargas dinâmicas
        const frontAxleGripForce = this.surfaceFriction * (dynamicWheelLoads.frontAxleLoad + this.effectiveDownforceN * 0.35)
        const rearAxleGripForce = this.surfaceFriction * (dynamicWheelLoads.rearAxleLoad + this.effectiveDownforceN * 0.65)
        const frontMaxGripTorque = frontAxleGripForce * this.wheelRadius
        const rearMaxGripTorque = rearAxleGripForce * this.wheelRadius

        let frontTractionForce = 0
        let rearTractionForce = 0

        // Eixo Dianteiro
        if (frontWheelTorque > frontMaxGripTorque && brake < 0.1) {
          isWheelSlipping = true
          frontTractionForce = frontAxleGripForce * 0.85
        } else {
          frontTractionForce = frontWheelTorque / this.wheelRadius
        }

        // Eixo Traseiro
        if (rearWheelTorque > rearMaxGripTorque && brake < 0.1) {
          isWheelSlipping = true
          rearTractionForce = rearAxleGripForce * 0.85
        } else {
          rearTractionForce = rearWheelTorque / this.wheelRadius
        }

        tractionForce = frontTractionForce + rearTractionForce
        const totalMaxGripTorque = frontMaxGripTorque + rearMaxGripTorque

        if (isWheelSlipping) {
          const excessTorque = Math.max(0, wheelTorque - totalMaxGripTorque)
          const excessRatio = excessTorque / Math.max(100, totalMaxGripTorque)
          const slipSpeedMs = excessRatio * 3.2
          this.wheelSpeedMs = this.speedMs + slipSpeedMs
          slipRatio = slipSpeedMs / Math.max(2.5, this.wheelSpeedMs)
        } else {
          this.wheelSpeedMs = this.speedMs
          slipRatio = 0
        }

        driveTorquePerWheel[0] = frontWheelTorque / 2
        driveTorquePerWheel[1] = frontWheelTorque / 2
        driveTorquePerWheel[2] = rearWheelTorque / 2
        driveTorquePerWheel[3] = rearWheelTorque / 2
      } else {
        // Modelo 2WD convencional ou 4x4 Toro
        wheelTorque = driveTorqueAtTransmission * effectiveTotalRatio * this.efficiency

        if (wheelTorque > maxGripTorque && brake < 0.1) {
          isWheelSlipping = true
          const kineticFrictionFactor = 0.82
          tractionForce = maxGripForce * kineticFrictionFactor

          const excessTorqueRatio = (wheelTorque - maxGripTorque) / Math.max(100, maxGripTorque)
          const slipSpeedMs = excessTorqueRatio * 3.8
          this.wheelSpeedMs = this.speedMs + slipSpeedMs
          slipRatio = slipSpeedMs / Math.max(2.5, this.wheelSpeedMs)
        } else {
          tractionForce = wheelTorque / this.wheelRadius
          this.wheelSpeedMs = this.speedMs
          slipRatio = 0
        }

        const isRwd = this.vehicleId === 'opala-4100' || this.isMotorcycle
        if (isRwd) {
          driveTorquePerWheel[2] = wheelTorque / 2
          driveTorquePerWheel[3] = wheelTorque / 2
        } else {
          driveTorquePerWheel[0] = wheelTorque / 2
          driveTorquePerWheel[1] = wheelTorque / 2
        }
      }
    } else if (gearRatio !== 0 && driveTorqueAtTransmission < 0 && this.speedMs > 0.05) {
      const rawBrakingWheelTorque =
        (driveTorqueAtTransmission * effectiveTotalRatio) / Math.max(0.75, this.efficiency)
      wheelTorque = Math.max(rawBrakingWheelTorque, -maxGripTorque)
      tractionForce = wheelTorque / this.wheelRadius
      this.wheelSpeedMs = this.speedMs
      slipRatio = 0
    } else {
      this.wheelSpeedMs = this.speedMs
    }

    // 2. Resistência ao Rolamento
    const rollingResistance = this.rollingCoeff * normalWeight

    // 3. Resistência Aerodinâmica (incluindo Airbrake se ativo)
    const aeroResistance = this.currentAeroConstant * this.speedMs * this.speedMs

    // 4. Força Gravitacional de Rampa
    const slopeForce = this.mass * this.chassis.gravity * sinTheta

    // 5. Força de Frenagem modulada pelo ABS de 4 canais
    const absResult = this.processABS(
      clamp(brake, 0, 1),
      deltaTime,
      dynamicWheelLoads,
      brakeUpgradeMultiplier,
    )
    const { modulatedBrake, absEngaged, channelModulations } = absResult

    if (absEngaged) {
      this.wheelSpeedMs += (this.speedMs - this.wheelSpeedMs) * 0.45
    }
    const maxBrakeForce = normalWeight * 1.15
    const brakeForce = modulatedBrake * maxBrakeForce

    // Integração da velocidade angular de cada uma das 4 rodas a 120 Hz
    const wheelInertia = this.chassis.wheelInertia || 1.25
    const trackWidth = 1.60
    const halfTrack = trackWidth / 2
    const cosDelta = Math.cos(this.steeringAngleRad)
    const localSpeeds = [
      Math.max(0, (this.speedMs * cosDelta) - this.yawRate * halfTrack),
      Math.max(0, (this.speedMs * cosDelta) + this.yawRate * halfTrack),
      Math.max(0, this.speedMs - this.yawRate * halfTrack),
      Math.max(0, this.speedMs + this.yawRate * halfTrack),
    ]

    for (let i = 0; i < 4; i++) {
      const tDrive = driveTorquePerWheel[i]
      const tBrake = (brakeForce / 4) * this.wheelRadius * channelModulations[i]
      const vLoc = localSpeeds[i]
      const targetOmega = vLoc / this.wheelRadius

      if (this.speedMs < 0.05 && brake > 0.05) {
        this.wheelAngularVel[i] = 0
      } else if (absEngaged) {
        // Durante ABS, a roda oscila em torno da rotação ideal
        const slipOmega = (tBrake - tDrive) / wheelInertia
        this.wheelAngularVel[i] = Math.max(0, this.wheelAngularVel[i] - slipOmega * deltaTime * 0.5)
      } else if (isWheelSlipping && tDrive > 0) {
        const excessOmega = (tDrive / wheelInertia) * deltaTime
        this.wheelAngularVel[i] = targetOmega + excessOmega * 0.4
      } else {
        // Acoplamento normal de rolamento
        this.wheelAngularVel[i] = targetOmega
      }
    }

    // 6. Força Líquida
    let netForce = 0
    const totalOpposingForce = rollingResistance + aeroResistance + brakeForce + slopeForce

    if (this.speedMs > 0.05) {
      netForce = tractionForce - totalOpposingForce
    } else {
      const staticResistance = rollingResistance * 1.2 + brakeForce + slopeForce
      if (tractionForce > staticResistance) {
        netForce = tractionForce - staticResistance
      } else if (slopeForce < 0 && Math.abs(slopeForce) > rollingResistance * 1.2 + brakeForce) {
        netForce = Math.abs(slopeForce) - (rollingResistance * 1.2 + brakeForce)
      } else {
        netForce = 0
        this.speedMs = 0
        this.wheelSpeedMs = 0
      }
    }

    // 7. Aceleração
    this.accelerationMs2 = netForce / this.mass

    // 8. Atualizar Velocidade
    this.speedMs += this.accelerationMs2 * deltaTime
    if (this.speedMs < 0) {
      this.speedMs = 0
      this.accelerationMs2 = 0
      this.wheelSpeedMs = 0
    }

    // 9. Cinemática de Direção e Movimentação 2D (Bicycle Model a 120 Hz)
    const isReverse = gear === -1
    const vDirectional = isReverse ? -this.speedMs : this.speedMs
    const wheelbase = this.chassis.wheelbase

    // Velocidade angular de guinada r = (v / L) * tan(delta)
    if (Math.abs(vDirectional) > 0.05 && Math.abs(this.steeringAngleRad) > 0.001) {
      this.yawRate = (vDirectional / wheelbase) * Math.tan(this.steeringAngleRad)
    } else {
      this.yawRate = 0
    }

    this.headingRad += this.yawRate * deltaTime
    // Normaliza heading no intervalo [-pi, pi]
    while (this.headingRad > Math.PI) this.headingRad -= 2 * Math.PI
    while (this.headingRad < -Math.PI) this.headingRad += 2 * Math.PI

    // Deslocamento no plano cartesiano métrico do mundo
    // Rumo 0 = Norte (+Y), pi/2 = Leste (+X)
    const dx = vDirectional * Math.sin(this.headingRad) * deltaTime
    const dy = vDirectional * Math.cos(this.headingRad) * deltaTime
    this.positionX += dx
    this.positionY += dy

    // 10. Consulta de Superfície e Colisão com Barreiras do WorldMap
    const mapQuery = WorldMap.query(this.positionX, this.positionY, Boolean(isRaining))
    this.currentSurface = mapQuery.surface.type
    this.currentZoneName = mapQuery.zoneName
    this.baseSurfaceFriction = mapQuery.surface.friction
    this.surfaceFriction =
      this.manualFrictionOverride !== null
        ? this.manualFrictionOverride
        : this.computeCompositeFriction(this.baseSurfaceFriction, this.currentSurface, Boolean(isRaining))
    this.rollingCoeff = mapQuery.surface.rollingResistance

    // Resposta à colisão com barreira
    if (mapQuery.collision.isColliding) {
      const col = mapQuery.collision
      // Afasta o veículo da barreira pelo vetor normal de penetração
      this.positionX += col.normalX * col.penetrationDepth
      this.positionY += col.normalY * col.penetrationDepth

      // Amortece e rebate a velocidade linear
      this.speedMs = Math.max(0, this.speedMs * 0.40 - 0.5)
      this.wheelSpeedMs = this.speedMs
    }

    // 11. Calcular rotação do eixo primário da transmissão
    const wheelAngularVelocity = this.wheelSpeedMs / this.wheelRadius
    const wheelRpm = (wheelAngularVelocity * 60) / (2 * Math.PI)
    
    const transmissionAngularVelocity = gearRatio !== 0
      ? wheelAngularVelocity * effectiveTotalRatio
      : 0

    return {
      speedKmh: this.getSpeedKmh(),
      speedMs: this.speedMs,
      acceleration: this.accelerationMs2,
      transmissionAngularVelocity,
      wheelRpm,
      wheelSpeedKmh: this.getWheelSpeedKmh(),
      tractionForce,
      resistiveForce: rollingResistance + aeroResistance + brakeForce + Math.max(0, slopeForce),
      wheelTorque,
      maxGripTorque,
      isWheelSlipping,
      slipRatio,
      positionX: this.positionX,
      positionY: this.positionY,
      headingDeg: this.getHeadingDeg(),
      headingRad: this.headingRad,
      steeringAngleRad: this.steeringAngleRad,
      yawRate: this.yawRate,
      surfaceType: this.currentSurface,
      zoneName: this.currentZoneName,
      absEngaged,
      isAirbrakeActive: this.isAirbrakeActive,
      wheelAngularVelocities: [...this.wheelAngularVel],
      absChannelStates: [...this.absChannelStates],
    }
  }

  getWheelAngularVelocities(): [number, number, number, number] {
    return [...this.wheelAngularVel]
  }

  getABSChannelStates(): [ABSChannelState, ABSChannelState, ABSChannelState, ABSChannelState] {
    return [...this.absChannelStates]
  }

  setBrakeUpgrade(upgrade: 'stock' | 'sport'): void {
    this.brakeUpgrade = upgrade
  }

  getBrakeUpgrade(): 'stock' | 'sport' {
    return this.brakeUpgrade
  }

  reset(): void {
    this.speedMs = 0
    this.accelerationMs2 = 0
    this.wheelSpeedMs = 0
    this.positionX = WorldMap.SPAWN_X
    this.positionY = WorldMap.SPAWN_Y
    this.headingRad = (WorldMap.SPAWN_HEADING_DEG * Math.PI) / 180
    this.steeringAngleRad = 0
    this.yawRate = 0
    this.absChannelStates = ['PASSIVE', 'PASSIVE', 'PASSIVE', 'PASSIVE']
    this.wheelAngularVel = [0, 0, 0, 0]
    this.prevWheelAngularVel = [0, 0, 0, 0]
    this.filteredWheelAccels = [0, 0, 0, 0]
    this.absHoldTimers = [0, 0, 0, 0]
    this.absEngaged = false
    this.isAirbrakeActive = false
  }

  getStateSnapshot(): VehiclePhysicsSnapshot {
    return {
      speedMs: this.speedMs,
      accelerationMs2: this.accelerationMs2,
      surfaceFriction: this.surfaceFriction,
      roadGradePercent: this.roadGradePercent,
      wheelSpeedMs: this.wheelSpeedMs,
      fourWheelDriveMode: this.fourWheelDriveMode,
      suspensionHeight: this.suspensionHeight,
      rearWingPosition: this.rearWingPosition,
      effectiveDownforceN: this.effectiveDownforceN,
      positionX: this.positionX,
      positionY: this.positionY,
      headingRad: this.headingRad,
      steeringAngleRad: this.steeringAngleRad,
      yawRate: this.yawRate,
      currentSurface: this.currentSurface,
    }
  }

  restoreSnapshot(snapshot: VehiclePhysicsSnapshot): void {
    this.speedMs = snapshot.speedMs
    this.accelerationMs2 = snapshot.accelerationMs2
    this.surfaceFriction = snapshot.surfaceFriction
    this.wheelSpeedMs = snapshot.wheelSpeedMs
    if (snapshot.roadGradePercent !== undefined) {
      this.roadGradePercent = snapshot.roadGradePercent
    }
    if (snapshot.fourWheelDriveMode) {
      this.setFourWheelDriveMode(snapshot.fourWheelDriveMode)
    }
    if (snapshot.suspensionHeight) {
      this.setSuspensionHeight(snapshot.suspensionHeight)
    }
    if (snapshot.rearWingPosition) {
      this.setAerodynamics(snapshot.rearWingPosition, this.isAeroWingExtended)
    }
    if (snapshot.positionX !== undefined) this.positionX = snapshot.positionX
    if (snapshot.positionY !== undefined) this.positionY = snapshot.positionY
    if (snapshot.headingRad !== undefined) this.headingRad = snapshot.headingRad
    if (snapshot.steeringAngleRad !== undefined) this.steeringAngleRad = snapshot.steeringAngleRad
    if (snapshot.yawRate !== undefined) this.yawRate = snapshot.yawRate
    if (snapshot.currentSurface !== undefined) this.currentSurface = snapshot.currentSurface
  }
}

export interface VehiclePhysicsSnapshot {
  speedMs: number
  accelerationMs2: number
  surfaceFriction: number
  roadGradePercent?: number
  wheelSpeedMs: number
  fourWheelDriveMode?: FourWheelDriveMode
  suspensionHeight?: SuspensionHeight
  rearWingPosition?: RearWingPosition
  effectiveDownforceN?: number
  positionX?: number
  positionY?: number
  headingRad?: number
  steeringAngleRad?: number
  yawRate?: number
  currentSurface?: SurfaceType
}
