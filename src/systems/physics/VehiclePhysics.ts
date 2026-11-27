import { clamp } from '@/utils/math'
import { VehicleChassis, type ChassisConfig, type DynamicLoadResult, type AxleLoads, createVehicleChassis } from './Chassis'
import { WorldMap, type SurfaceType } from '../world/WorldMap'
import type { SuspensionHeight, RearWingPosition, RearWingType } from '@/stores/useGarageStore'
import type { DrivetrainConfigValue, DrivetrainLayout } from '@/types/vehicle'
import { resolveVehicleDrivetrain } from '@/systems/vehicle/vehicleResolvers'

export type FourWheelDriveMode = 'auto' | '4wd' | '4wd_low'
export type ABSChannelState = 'PASSIVE' | 'APPLY' | 'HOLD' | 'DUMP' | 'LATCH'

export interface VehiclePhysicsConfig {
  weight: number        // kg
  wheelDiameter: number // metros
  isMotorcycle?: boolean
  vehicleId?: string
  drivetrain?: DrivetrainConfigValue
  hasAirbrake?: boolean
  baseDownforceCoeff?: number
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
  handbrake?: boolean               // freio de mão traseiro acionado
  deltaTime: number                 // segundos
  steeringAngleRad?: number         // ângulo de esterçamento das rodas dianteiras (radianos)
  gear?: number                     // marcha engatada (-1 para ré)
  isRaining?: boolean               // condição climática de chuva
  brakeUpgrade?: 'stock' | 'sport'  // upgrade de freios esportivos (Brembo)
  /** Simulação estacionária (Modo Painel): calcula giro/inércia longitudinal sem deslocamento 2D nem colisões */
  stationarySimulation?: boolean
  /** Override opcional de atrito por eixo (split-mu) para testes controlados de aderência assimétrica */
  frontSurfaceFrictionOverride?: number
  rearSurfaceFrictionOverride?: number
}

export interface PhysicsTickResult {
  speedKmh: number                  // km/h
  speedMs: number                   // m/s
  lateralSpeedMs: number            // velocidade lateral no referencial do veículo (m/s)
  slipAngleDeg: number              // ângulo de deriva/escorregamento lateral do chassi (graus)
  lateralAccelG: number             // aceleração lateral efetiva (G)
  leanAngleDeg: number              // ângulo de inclinação (roll) para motocicletas (graus, 0 para carros)
  acceleration: number              // m/s²
  transmissionAngularVelocity: number // rad/s na entrada do câmbio
  wheelRpm: number
  wheelSpeedKmh: number             // velocidade periférica da roda (km/h)
  tractionForce: number             // Newtons
  resistiveForce: number            // Newtons
  brakeForceN: number               // Newtons (força de frenagem efetiva aplicada)
  rollingResistanceN: number        // Newtons
  aeroResistanceN: number           // Newtons
  scrubForceN: number               // Newtons (arrasto induzido de deriva)
  yawInertiaKgM2: number            // kg·m² (momento de inércia de guinada efetivo)
  lateralWorkJ: number              // Joules (trabalho das forças laterais dos pneus no passo)
  wheelTorque: number               // torque bruto aplicado nas rodas (Nm)
  maxGripTorque: number             // torque máximo suportado pela aderência do solo (Nm)
  frontAxleTorqueNm: number         // torque motriz entregue ao eixo dianteiro (Nm)
  rearAxleTorqueNm: number          // torque motriz entregue ao eixo traseiro (Nm)
  frontTractionForceN: number       // força de tração efetiva no eixo dianteiro (N)
  rearTractionForceN: number        // força de tração efetiva no eixo traseiro (N)
  frontAxleSlip: boolean            // patinamento detectado no eixo dianteiro
  rearAxleSlip: boolean             // patinamento detectado no eixo traseiro
  awdRearCoupling: number           // grau de acoplamento do eixo traseiro [0..1] (Toro 4x4 / AWD)
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
  isColliding: boolean
  collisionBoundaryName: string | null
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
  private readonly drivetrain: DrivetrainLayout
  private readonly hasAirbrake: boolean
  private readonly chassis: VehicleChassis

  // Propriedades Aerodinâmicas e de Suspensão Dinâmicas
  private baseAeroConstant: number = 0.40
  private currentAeroConstant: number = 0.40
  /** Multiplicador de arrasto por abertura de vidros (1.0 = fechados; ponto único de aplicação) */
  private windowAeroDragMultiplier: number = 1.0
  private downforceCoeff: number = 0.10
  private suspensionHeightOffset: number = 0
  private effectiveDownforceN: number = 0
  private suspensionHeight: SuspensionHeight = 'stock'
  private rearWingPosition: RearWingPosition = 'balanced'
  private isAeroWingExtended: boolean = false
  private rearWingType: RearWingType = 'none'
  private isAirbrakeActive: boolean = false

  private speedMs: number = 0 // velocidade linear longitudinal em m/s (módulo >= 0)
  /** Sentido longitudinal efetivo de deslocamento (-1 = ré, 0 = parado, +1 = frente) para impedir inversão instantânea em trocas D↔R */
  private motionDirection: -1 | 0 | 1 = 0
  private accelerationMs2: number = 0
  private surfaceFriction: number = 0.95 // Coeficiente de atrito efetivo mu (superfície × composto de pneu)
  private baseSurfaceFriction: number = 0.95 // Atrito bruto da superfície do WorldMap
  private tireCompound: 'street' | 'semi_slick' = 'street'
  private manualFrictionOverride: number | null = null
  private roadGradePercent: number = 0 // Inclinação em % (+ = subida, - = descida)
  private wheelSpeedMs: number = 0

  // ─── Estado de Navegação e Dinâmica Planar 2D ───
  private positionX: number = 0        // metros no grid global
  private positionY: number = 0        // metros no grid global
  private headingRad: number = 0       // rumo em radianos (0 = Norte / +Y, pi/2 = Leste / +X)
  private steeringAngleRad: number = 0 // ângulo atual de esterçamento das rodas dianteiras
  private yawRate: number = 0          // rad/s (velocidade angular de guinada)
  private lateralSpeedMs: number = 0   // velocidade lateral no eixo do veículo (+ = direita)
  private slipAngleRad: number = 0     // ângulo de deriva do chassi (rad)
  private lateralAccelMs2: number = 0  // aceleração lateral real (m/s²)
  private leanAngleRad: number = 0     // ângulo de inclinação (roll) de motocicleta (+ = direita, rad)
  private awdRearCoupling: number = 0  // acoplamento contínuo sob demanda do eixo traseiro [0..1] (Toro 4x4 AUTO)
  private isColliding: boolean = false
  private collisionBoundaryName: string | null = null
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
    this.drivetrain = resolveVehicleDrivetrain({
      id: config.vehicleId,
      drivetrain: config.drivetrain,
      isMotorcycle: this.isMotorcycle,
      frontFinalDrive: config.frontFinalDrive,
    })
    this.hasAirbrake = config.hasAirbrake ?? (this.drivetrain === 'awd_ptm')
    this.frontFinalDrive = config.frontFinalDrive ?? (this.drivetrain === 'awd_ptm' ? 3.330 : undefined)
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
    this.downforceCoeff = config.baseDownforceCoeff ?? (this.drivetrain === 'awd_ptm' ? 0.35 : 0.08)
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

    const hasActiveAeroProfile = this.hasAirbrake
    if (hasActiveAeroProfile) {
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

  /**
   * Define o multiplicador de arrasto aerodinâmico decorrente da abertura dos vidros da cabine.
   * Ponto único de aplicação no cálculo de `aeroResistance` dentro de `tick()`.
   */
  setWindowAeroDragMultiplier(multiplier: number): void {
    this.windowAeroDragMultiplier = this.isMotorcycle ? 1.0 : clamp(multiplier, 1.0, 1.25)
  }

  getWindowAeroDragMultiplier(): number {
    return this.windowAeroDragMultiplier
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

  getDrivetrain(): DrivetrainLayout {
    return this.drivetrain
  }

  private calculateDriveAxleWeightRatio(): number {
    if (this.drivetrain === '4x4_selectable') {
      if (this.fourWheelDriveMode === '4wd' || this.fourWheelDriveMode === '4wd_low') {
        return 1.0
      }
      return 0.85
    }
    if (this.drivetrain === 'awd_ondemand') {
      return 0.85
    }
    if (this.drivetrain === 'awd_ptm') {
      // Tração AWD PTM (ex.: Porsche 911 Turbo S): sob demanda de tração mobiliza ambos os eixos
      return 0.95
    }
    if (this.drivetrain === 'rwd' || this.isMotorcycle) {
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
    const halfFront = axleLoads.frontAxleLoad / 2
    const halfRear = axleLoads.rearAxleLoad / 2

    // Motocicletas possuem 2 rodas em tandem (bitola = 0): equilíbrio lateral ocorre via inclinação (roll),
    // sem transferência de carga entre roda esquerda e direita.
    if (this.isMotorcycle) {
      return {
        frontAxleLoad: axleLoads.frontAxleLoad,
        rearAxleLoad: axleLoads.rearAxleLoad,
        fl: halfFront,
        fr: halfFront,
        rl: halfRear,
        rr: halfRear,
        totalWeight: axleLoads.totalWeight,
      }
    }

    const trackWidth = 1.60
    const h = Math.max(0.20, this.chassis.centerOfMassHeight + this.suspensionHeightOffset)
    // Curva à direita (ay > 0) transfere carga para as rodas externas à ESQUERDA (fl, rl)
    const lateralTransfer = (this.mass * h / trackWidth) * ay

    const latFront = lateralTransfer * this.chassis.frontWeightRatio
    const latRear = lateralTransfer * this.chassis.rearWeightRatio

    const minWheelLoad = this.chassis.minAxleLoad / 2

    const fl = clamp(halfFront + latFront, minWheelLoad, axleLoads.frontAxleLoad - minWheelLoad)
    const fr = clamp(halfFront - latFront, minWheelLoad, axleLoads.frontAxleLoad - minWheelLoad)
    const rl = clamp(halfRear + latRear, minWheelLoad, axleLoads.rearAxleLoad - minWheelLoad)
    const rr = clamp(halfRear - latRear, minWheelLoad, axleLoads.rearAxleLoad - minWheelLoad)

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
    const signed = Number.isFinite(speedKmh) ? speedKmh : 0
    this.speedMs = Math.max(0, Math.abs(signed) / 3.6)
    this.motionDirection = this.speedMs > 0.05 ? (signed < 0 ? -1 : 1) : 0
    this.wheelSpeedMs = this.speedMs
    const omega = this.wheelRadius > 0 ? this.speedMs / this.wheelRadius : 0
    this.wheelAngularVel = [omega, omega, omega, omega]
    this.prevWheelAngularVel = [omega, omega, omega, omega]
    this.filteredWheelAccels = [0, 0, 0, 0]
  }

  getMotionDirection(): -1 | 0 | 1 {
    return this.motionDirection
  }

  getSignedLongitudinalSpeedKmh(): number {
    if (this.speedMs < 0.02 || this.motionDirection === 0) return 0
    return this.motionDirection * this.getSpeedKmh()
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

  getLateralSpeedMs(): number {
    return this.lateralSpeedMs
  }

  getSlipAngleDeg(): number {
    return (this.slipAngleRad * 180) / Math.PI
  }

  getLateralAccelG(): number {
    return this.lateralAccelMs2 / this.chassis.gravity
  }

  getLeanAngleDeg(): number {
    return (this.leanAngleRad * 180) / Math.PI
  }

  private getCollisionRadius(): number {
    return this.isMotorcycle ? 0.65 : 1.15
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

    if (this.drivetrain === '4x4_selectable') {
      if (this.fourWheelDriveMode === '4wd' || this.fourWheelDriveMode === '4wd_low') {
        normalForceOnDrivenWheels = axleLoads.frontAxleLoad + axleLoads.rearAxleLoad
      } else {
        const isSlipDetected = Math.abs(this.wheelSpeedMs - this.speedMs) > 0.1
        const rearShare = isSlipDetected ? 1.0 : 0.65
        normalForceOnDrivenWheels = axleLoads.frontAxleLoad + axleLoads.rearAxleLoad * rearShare
      }
    } else if (this.drivetrain === 'awd_ondemand') {
      const isSlipDetected = Math.abs(this.wheelSpeedMs - this.speedMs) > 0.1
      const rearShare = isSlipDetected ? 1.0 : 0.65
      normalForceOnDrivenWheels = axleLoads.frontAxleLoad + axleLoads.rearAxleLoad * rearShare
    } else if (this.drivetrain === 'awd_ptm') {
      // Tração PTM AWD inteligente:
      // O eixo traseiro é a base de tração; sob aceleração ou deslizamento o PTM
      // acopla o eixo dianteiro proporcionalmente à carga normal dianteira disponível
      const isSlipDetected = Math.abs(this.wheelSpeedMs - this.speedMs) > 0.05
      const ptmFrontShare = isSlipDetected ? 1.0 : clamp(Math.abs(this.accelerationMs2) / 3.5, 0.30, 1.0)
      normalForceOnDrivenWheels = axleLoads.rearAxleLoad + axleLoads.frontAxleLoad * ptmFrontShare
    } else if (this.drivetrain === 'rwd' || this.isMotorcycle) {
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
    const trackWidth = this.isMotorcycle ? 0 : 1.60
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
    const vehicleRadius = this.getCollisionRadius()
    const mapQueryStart = WorldMap.query(this.positionX, this.positionY, Boolean(isRaining), vehicleRadius)
    this.currentSurface = mapQueryStart.surface.type
    this.currentZoneName = mapQueryStart.zoneName
    this.baseSurfaceFriction = mapQueryStart.surface.friction
    this.surfaceFriction =
      this.manualFrictionOverride !== null
        ? this.manualFrictionOverride
        : this.computeCompositeFriction(this.baseSurfaceFriction, this.currentSurface, Boolean(isRaining))
    this.rollingCoeff = mapQueryStart.surface.rollingResistance

    const thetaRad = Math.atan(this.roadGradePercent / 100)
    const cosTheta = Math.cos(thetaRad)
    const sinTheta = Math.sin(thetaRad)

    // Detecção de ativação de Airbrake (aerodinâmica ativa com airbrake)
    if (this.hasAirbrake) {
      const isSevereBraking = brake > 0.55 && this.speedMs > 25.0 // > 90 km/h
      if (isSevereBraking !== this.isAirbrakeActive) {
        this.isAirbrakeActive = isSevereBraking
        this.setAerodynamics(this.rearWingPosition, this.isAeroWingExtended, this.rearWingType)
      }
    }

    // Downforce aerodinâmico F_downforce = C_downforce * v²
    this.effectiveDownforceN = this.downforceCoeff * this.speedMs * this.speedMs
    const normalWeight = this.mass * this.chassis.gravity * cosTheta + this.effectiveDownforceN

    // Cargas normais dinâmicas por roda (transferência longitudinal + lateral real limitada pela aderência)
    const ay = Math.abs(this.lateralAccelMs2) > 0.01 ? this.lateralAccelMs2 : this.speedMs * this.yawRate
    const dynamicWheelLoads = this.getDynamicWheelLoads(ay)

    // 1. Torque e Força de Tração teórica nos Eixos e Rodas
    let wheelTorque = 0
    let tractionForce = 0
    let isWheelSlipping = false
    let slipRatio = 0

    const isPorschePTM = this.drivetrain === 'awd_ptm'
    const isFrontBiasedAwd = this.drivetrain === '4x4_selectable' || this.drivetrain === 'awd_ondemand'
    const frontFinalDriveRatio = input.frontFinalDrive ?? this.frontFinalDrive ?? (isPorschePTM ? 3.330 : finalDrive)
    const rearFinalDriveRatio = finalDrive // 3.020 no Porsche

    const frontSurfaceMu = input.frontSurfaceFrictionOverride ?? this.surfaceFriction
    const rearSurfaceMu = input.rearSurfaceFrictionOverride ?? this.surfaceFriction

    const maxGripTorque = this.getMaxGripTorque()
    const maxGripForce = maxGripTorque / this.wheelRadius

    // Telemetria explícita por eixo
    let frontAxleTorqueNm = 0
    let rearAxleTorqueNm = 0
    let frontTractionForceN = 0
    let rearTractionForceN = 0
    let frontAxleSlip = false
    let rearAxleSlip = false

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
        this.awdRearCoupling = 1 - 0.50 * ptmCoupling

        // Divisão de torque: T_front + T_rear = T_box (CONSERVAÇÃO ESTRITA)
        const frontTorqueShare = 0.50 * ptmCoupling
        const torqueFront = tBox * frontTorqueShare
        const torqueRear = tBox - torqueFront

        // Torque nas rodas via relações dianteira (3.330) e traseira (3.020)
        const frontWheelTorque = torqueFront * frontFinalDriveRatio
        const rearWheelTorque = torqueRear * rearFinalDriveRatio
        frontAxleTorqueNm = frontWheelTorque
        rearAxleTorqueNm = rearWheelTorque
        wheelTorque = frontWheelTorque + rearWheelTorque

        // Limites de aderência por eixo baseados nas cargas dinâmicas
        const frontAxleGripForce = frontSurfaceMu * (dynamicWheelLoads.frontAxleLoad + this.effectiveDownforceN * 0.35)
        const rearAxleGripForce = rearSurfaceMu * (dynamicWheelLoads.rearAxleLoad + this.effectiveDownforceN * 0.65)
        const frontMaxGripTorque = frontAxleGripForce * this.wheelRadius
        const rearMaxGripTorque = rearAxleGripForce * this.wheelRadius

        // Eixo Dianteiro
        if (frontWheelTorque > frontMaxGripTorque && brake < 0.1) {
          isWheelSlipping = true
          frontAxleSlip = true
          frontTractionForceN = frontAxleGripForce * 0.85
        } else {
          frontTractionForceN = frontWheelTorque / this.wheelRadius
        }

        // Eixo Traseiro
        if (rearWheelTorque > rearMaxGripTorque && brake < 0.1) {
          isWheelSlipping = true
          rearAxleSlip = true
          rearTractionForceN = rearAxleGripForce * 0.85
        } else {
          rearTractionForceN = rearWheelTorque / this.wheelRadius
        }

        tractionForce = frontTractionForceN + rearTractionForceN
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
      } else if (isFrontBiasedAwd) {
        // Arquitetura AWD sob demanda / 4x4 selecionável (PTU + RDM em AUTO vs bloqueio 50/50 em 4WD / 4WD LOW)
        // Nota de calibração: a divisão numérica exata de acoplamento é parâmetro calibrado de simulação,
        // refletindo a arquitetura física conhecida: AUTO/awd_ondemand prioriza eixo dianteiro e acopla o traseiro
        // sob demanda após detecção de patinamento/carga; 4WD e 4WD LOW travam acoplamento integral preventivo 50/50.
        wheelTorque = driveTorqueAtTransmission * effectiveTotalRatio * this.efficiency

        const frontAxleGripForce = frontSurfaceMu * (dynamicWheelLoads.frontAxleLoad + this.effectiveDownforceN * 0.50)
        const rearAxleGripForce = rearSurfaceMu * (dynamicWheelLoads.rearAxleLoad + this.effectiveDownforceN * 0.50)
        const frontMaxGripTorque = frontAxleGripForce * this.wheelRadius
        const rearMaxGripTorque = rearAxleGripForce * this.wheelRadius

        const isLocked4wd =
          this.drivetrain === '4x4_selectable' &&
          (this.fourWheelDriveMode === '4wd' || this.fourWheelDriveMode === '4wd_low')
        if (isLocked4wd) {
          this.awdRearCoupling = 1.0
        } else {
          // Modo AUTO: acoplamento reativo sob demanda com constante de tempo finita (tau ~0.28s)
          const frontDemandRatio = wheelTorque / Math.max(100, frontMaxGripTorque)
          const targetCoupling = frontDemandRatio > 0.85 ? clamp((frontDemandRatio - 0.80) * 1.15, 0.12, 0.85) : 0.08
          const tau = targetCoupling > this.awdRearCoupling ? 0.28 : 0.45
          this.awdRearCoupling += (targetCoupling - this.awdRearCoupling) * Math.min(1, deltaTime / tau)
        }

        // Fração de torque no eixo traseiro: 50% em 4WD/4WD LOW; em AUTO varia de 4% (cruzeiro) até ~42% sob demanda
        const rearTorqueShare = isLocked4wd ? 0.50 : clamp(this.awdRearCoupling * 0.50, 0.04, 0.44)
        frontAxleTorqueNm = wheelTorque * (1 - rearTorqueShare)
        rearAxleTorqueNm = wheelTorque * rearTorqueShare

        // Em 4WD / 4WD LOW (eixo central bloqueado), se um eixo exceder sua aderência mas o outro ainda tiver margem,
        // o acoplamento mecânico transfere torque adicional ao eixo com maior aderência (efeito split-mu real!)
        if (isLocked4wd) {
          if (frontAxleTorqueNm > frontMaxGripTorque && rearAxleTorqueNm < rearMaxGripTorque) {
            const transferable = Math.min(frontAxleTorqueNm - frontMaxGripTorque, rearMaxGripTorque - rearAxleTorqueNm)
            frontAxleTorqueNm -= transferable
            rearAxleTorqueNm += transferable
          } else if (rearAxleTorqueNm > rearMaxGripTorque && frontAxleTorqueNm < frontMaxGripTorque) {
            const transferable = Math.min(rearAxleTorqueNm - rearMaxGripTorque, frontMaxGripTorque - frontAxleTorqueNm)
            rearAxleTorqueNm -= transferable
            frontAxleTorqueNm += transferable
          }
        }

        if (frontAxleTorqueNm > frontMaxGripTorque && brake < 0.1) {
          isWheelSlipping = true
          frontAxleSlip = true
          frontTractionForceN = frontAxleGripForce * 0.84
        } else {
          frontTractionForceN = frontAxleTorqueNm / this.wheelRadius
        }

        if (rearAxleTorqueNm > rearMaxGripTorque && brake < 0.1) {
          isWheelSlipping = true
          rearAxleSlip = true
          rearTractionForceN = rearAxleGripForce * 0.84
        } else {
          rearTractionForceN = rearAxleTorqueNm / this.wheelRadius
        }

        tractionForce = frontTractionForceN + rearTractionForceN

        if (isWheelSlipping) {
          const excessFront = Math.max(0, frontAxleTorqueNm - frontMaxGripTorque)
          const excessRear = Math.max(0, rearAxleTorqueNm - rearMaxGripTorque)
          const excessRatio = (excessFront + excessRear) / Math.max(100, frontMaxGripTorque + rearMaxGripTorque)
          const slipSpeedMs = excessRatio * 3.4
          this.wheelSpeedMs = this.speedMs + slipSpeedMs
          slipRatio = slipSpeedMs / Math.max(2.5, this.wheelSpeedMs)
        } else {
          this.wheelSpeedMs = this.speedMs
          slipRatio = 0
        }

        driveTorquePerWheel[0] = frontAxleTorqueNm / 2
        driveTorquePerWheel[1] = frontAxleTorqueNm / 2
        driveTorquePerWheel[2] = rearAxleTorqueNm / 2
        driveTorquePerWheel[3] = rearAxleTorqueNm / 2
      } else {
        // Modelo 2WD convencional (FWD ou RWD / Motocicleta)
        wheelTorque = driveTorqueAtTransmission * effectiveTotalRatio * this.efficiency
        const isRwd = this.drivetrain === 'rwd' || this.isMotorcycle
        const drivenSurfaceMu = isRwd ? rearSurfaceMu : frontSurfaceMu
        const effectiveMaxGripForce =
          drivenSurfaceMu !== this.surfaceFriction
            ? (maxGripForce / Math.max(0.05, this.surfaceFriction)) * drivenSurfaceMu
            : maxGripForce
        const effectiveMaxGripTorque = effectiveMaxGripForce * this.wheelRadius

        if (wheelTorque > effectiveMaxGripTorque && brake < 0.1) {
          isWheelSlipping = true
          if (isRwd) rearAxleSlip = true
          else frontAxleSlip = true
          const kineticFrictionFactor = 0.82
          tractionForce = effectiveMaxGripForce * kineticFrictionFactor

          const excessTorqueRatio = (wheelTorque - effectiveMaxGripTorque) / Math.max(100, effectiveMaxGripTorque)
          const slipSpeedMs = excessTorqueRatio * 3.8
          this.wheelSpeedMs = this.speedMs + slipSpeedMs
          slipRatio = slipSpeedMs / Math.max(2.5, this.wheelSpeedMs)
        } else {
          tractionForce = wheelTorque / this.wheelRadius
          this.wheelSpeedMs = this.speedMs
          slipRatio = 0
        }

        if (isRwd) {
          rearAxleTorqueNm = wheelTorque
          rearTractionForceN = tractionForce
          driveTorquePerWheel[2] = wheelTorque / 2
          driveTorquePerWheel[3] = wheelTorque / 2
        } else {
          frontAxleTorqueNm = wheelTorque
          frontTractionForceN = tractionForce
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

    // 3. Resistência Aerodinâmica (incluindo Airbrake se ativo e penalidade única de vidros abertos)
    const aeroResistance =
      this.currentAeroConstant * this.windowAeroDragMultiplier * this.speedMs * this.speedMs

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
    const trackWidth = this.isMotorcycle ? 0 : 1.60
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

    // 6. Força Líquida e Sentido Longitudinal Efetivo (Proteção Física contra inversão instantânea D ↔ R)
    const safeGear = gear ?? 0
    const desiredGearDir: -1 | 0 | 1 = safeGear === -1 ? -1 : safeGear > 0 ? 1 : 0
    if (this.speedMs <= 0.12 && this.motionDirection === 0 && desiredGearDir !== 0 && tractionForce > 0) {
      this.motionDirection = desiredGearDir
    } else if (this.speedMs > 0.12 && this.motionDirection === 0) {
      this.motionDirection = desiredGearDir !== 0 ? desiredGearDir : 1
    }

    const isGearOpposingMotion =
      this.speedMs > 0.12 &&
      this.motionDirection !== 0 &&
      desiredGearDir !== 0 &&
      desiredGearDir !== this.motionDirection

    // Quando a rampa atua sobre o carro em ré vs frente: slopeForce > 0 opõe subida para frente
    const directionalSlopeForce = this.motionDirection === -1 ? -slopeForce : slopeForce
    let netForce = 0
    const totalOpposingForce = rollingResistance + aeroResistance + brakeForce + directionalSlopeForce

    if (this.speedMs > 0.05) {
      // Se uma marcha contrária ao deslocamento atual estiver acoplada, qualquer força nas rodas desacelera
      // o módulo da velocidade até zero (nunca soma velocidade instantaneamente no sentido oposto!)
      const signedTractionAlongMotion = isGearOpposingMotion ? -tractionForce : tractionForce
      netForce = signedTractionAlongMotion - totalOpposingForce
    } else {
      const staticSlope = (desiredGearDir === -1 ? -1 : 1) * slopeForce
      const staticResistance = rollingResistance * 1.2 + brakeForce + staticSlope
      if (tractionForce > staticResistance && desiredGearDir !== 0) {
        this.motionDirection = desiredGearDir
        netForce = tractionForce - staticResistance
      } else if (slopeForce < 0 && Math.abs(slopeForce) > rollingResistance * 1.2 + brakeForce) {
        this.motionDirection = 1
        netForce = Math.abs(slopeForce) - (rollingResistance * 1.2 + brakeForce)
      } else {
        netForce = 0
        this.speedMs = 0
        this.motionDirection = 0
        this.wheelSpeedMs = 0
      }
    }

    // 7. Aceleração
    this.accelerationMs2 = netForce / this.mass

    // 8. Atualizar Velocidade (ao cruzar zero por frenagem/força oposta, para em 0 antes de inverter sentido)
    this.speedMs += this.accelerationMs2 * deltaTime
    if (this.speedMs <= 0) {
      this.speedMs = 0
      this.accelerationMs2 = 0
      this.wheelSpeedMs = 0
      this.motionDirection = 0
    }

    // 9. Dinâmica Planar 2D Acoplada (Carros: Bicicleta Dinâmica + Círculo de Atrito | Motocicletas: Roll/Lean + Camber Thrust)
    const isMovingReverse =
      this.speedMs > 0.05 ? this.motionDirection === -1 : gear === -1
    const isReverse = isMovingReverse
    const wheelbase = this.chassis.wheelbase
    const aDist = this.chassis.distanceCgToFrontAxle
    const bDist = this.chassis.distanceCgToRearAxle
    const delta = this.steeringAngleRad
    const isHandbrake = Boolean(input.handbrake)
    let headingDelta = 0
    let scrubForceN = 0
    let lateralWorkJ = 0
    const yawInertiaKgM2 = this.isMotorcycle
      ? Math.max(28, this.mass * (aDist * bDist * 0.55 + 0.045 * wheelbase * wheelbase))
      : Math.max(180, this.mass * (aDist * bDist + 0.16 * wheelbase * wheelbase))

    if (
      Math.abs(delta) < 0.0005 &&
      Math.abs(this.lateralSpeedMs) < 0.001 &&
      Math.abs(this.yawRate) < 0.001 &&
      Math.abs(this.leanAngleRad) < 0.001
    ) {
      // Invariante estrito em linha reta: zero deriva lateral, zero inclinação e zero impacto na física longitudinal pura
      this.lateralSpeedMs = 0
      this.yawRate = 0
      this.lateralAccelMs2 = 0
      this.slipAngleRad = 0
      this.leanAngleRad = 0
    } else if (this.speedMs < 0.05) {
      // Veículo parado: amortecimento completo de guinada, deriva e retorno vertical da motocicleta
      this.lateralSpeedMs = 0
      this.yawRate = 0
      this.lateralAccelMs2 = 0
      this.slipAngleRad = 0
      this.leanAngleRad *= Math.exp(-10 * deltaTime)
      if (Math.abs(this.leanAngleRad) < 0.001) this.leanAngleRad = 0
    } else if (isReverse || this.speedMs < 2.0) {
      // Regime de baixa velocidade / marcha ré: modelo cinemático Ackermann estável sem singularidade em v -> 0
      const vDir = isReverse ? -this.speedMs : this.speedMs
      this.yawRate = Math.abs(delta) > 0.001 ? (vDir / wheelbase) * Math.tan(delta) : 0
      this.lateralSpeedMs *= Math.exp(-14 * deltaTime)
      if (Math.abs(this.lateralSpeedMs) < 0.001) this.lateralSpeedMs = 0
      this.lateralAccelMs2 = vDir * this.yawRate
      this.slipAngleRad = 0
      if (this.isMotorcycle) {
        // Em baixa velocidade (< 7.2 km/h), a moto esterça primariamente pelo guidão com inclinação mínima
        const lowSpeedTargetLean = clamp(Math.atan((vDir * this.yawRate) / this.chassis.gravity), -0.22, 0.22)
        this.leanAngleRad += (lowSpeedTargetLean - this.leanAngleRad) * Math.min(1, deltaTime * 8)
      } else {
        this.leanAngleRad = 0
      }
      headingDelta = this.yawRate * deltaTime
    } else if (this.isMotorcycle) {
      // ── MODELO ESPECÍFICO DE MOTOCICLETA (Roll / Inclinação + Empuxo de Cambagem + Deriva Residual) ──
      // Diferente de carros de 4 rodas, a motocicleta inclina (phi) para equilibrar a força centrífuga (ay = g * tan(phi)),
      // gera empuxo lateral majoritariamente por cambagem (camber thrust) com pequeno ângulo de deriva,
      // e tem inércia de guinada real proporcional à sua massa compacta (~70 kg·m², não 180 kg·m² de carro).
      const vx = this.speedMs
      const g = this.chassis.gravity
      const dynWeight = clamp((vx - 2.0) / 3.0, 0, 1) // transição suave guidão -> inclinação entre 7.2 e 18 km/h

      const fzFront = Math.max(80, dynamicWheelLoads.frontAxleLoad + this.effectiveDownforceN * 0.45)
      const fzRear = Math.max(80, dynamicWheelLoads.rearAxleLoad + this.effectiveDownforceN * 0.55)

      // Orçamento de aderência longitudinal vs lateral (círculo de atrito em 2 rodas: tração na traseira, freio 75/25)
      const fxFront = -brakeForce * 0.75
      const fxRear = tractionForce - brakeForce * 0.25
      const maxFrontForce = Math.max(80, this.surfaceFriction * fzFront)
      const maxRearForce = Math.max(80, this.surfaceFriction * fzRear)

      const frontUsage = clamp(Math.abs(fxFront) / maxFrontForce, 0, 0.85)
      let rearUsage = clamp(Math.abs(fxRear) / maxRearForce, 0, 0.85)
      if (isWheelSlipping) {
        rearUsage = Math.max(rearUsage, 0.82)
      }

      const fyMaxFront = maxFrontForce * Math.sqrt(Math.max(0.20, 1 - frontUsage * frontUsage))
      const fyMaxRear = maxRearForce * Math.sqrt(Math.max(0.18, 1 - rearUsage * rearUsage))
      const totalLateralGripAccel = (fyMaxFront + fyMaxRear) / this.mass

      // Ângulo máximo físico de inclinação: menor entre limite mecânico das pedaleiras (48°) e limite de atrito (atan(ay_max/g))
      const maxMechanicalLeanRad = (48 * Math.PI) / 180
      const maxGripLeanRad = Math.atan(Math.max(0.15, totalLateralGripAccel / g) * 0.96)
      const maxLeanRad = Math.min(maxMechanicalLeanRad, maxGripLeanRad)

      // Demanda progressiva de inclinação a partir do comando de esterço (contra-esterço estabilizado)
      const steerNorm = clamp(delta / 0.58, -1, 1)
      const speedLeanFactor = clamp((vx - 1.5) / 14.0, 0.15, 1.0)
      const targetLeanRad = clamp(steerNorm * maxLeanRad * speedLeanFactor, -maxLeanRad, maxLeanRad)

      // Dinâmica de rolagem amortecida (taxa máxima ~115°/s, tau = 0.15s — evita salto instantâneo de inclinação)
      const maxRollRate = (115 * Math.PI) / 180
      const rollRate = clamp((targetLeanRad - this.leanAngleRad) / 0.15, -maxRollRate, maxRollRate)
      this.leanAngleRad = clamp(this.leanAngleRad + rollRate * deltaTime, -maxMechanicalLeanRad, maxMechanicalLeanRad)

      // Inércia real de guinada de motocicleta (CB1000R ~72-82 kg·m²)
      const yawInertia = yawInertiaKgM2

      // Empuxo de cambagem (camber thrust) em equilíbrio de rolagem (F_y,camber = F_z * tan(phi))
      // + rigidez de deriva amortecedora (mantém ay/g ≈ tan(phi) sem momento de tombamento espúrio)
      const camberThrustFront = fzFront * Math.tan(this.leanAngleRad)
      const camberThrustRear = fzRear * Math.tan(this.leanAngleRad)
      const cAlphaBike = this.tireCompound === 'semi_slick' ? 4.2 : 3.5

      const subDt = deltaTime / 2
      let vy = this.lateralSpeedMs
      let r = this.yawRate
      let lastAy = 0

      // Equilíbrio de guinada guiado pela inclinação (r_eq = g * tan(phi) / vx)
      const leanEqYaw = (g * Math.tan(this.leanAngleRad)) / Math.max(2.0, vx)

      for (let s = 0; s < 2; s++) {
        // No regime dinâmico (dynWeight -> 1), o comando do piloto define o ângulo de inclinação (targetLeanRad)
        // e o ângulo geométrico do guidão alinha-se ao equilíbrio cinemático da curva (atan(L * r_eq / vx)).
        const kinSteerEq = Math.atan((wheelbase * leanEqYaw) / Math.max(2.0, vx))
        const effectiveFrontSteer = delta * (1 - dynWeight) + kinSteerEq * dynWeight
        const alphaFront = effectiveFrontSteer - Math.atan2(vy + aDist * r, vx)
        const alphaRear = -Math.atan2(vy - bDist * r, vx)

        const rawFyFront = camberThrustFront + cAlphaBike * fzFront * alphaFront
        const rawFyRear = camberThrustRear + cAlphaBike * fzRear * alphaRear

        const fyFront = fyMaxFront * Math.tanh(rawFyFront / Math.max(80, fyMaxFront))
        const fyRear = fyMaxRear * Math.tanh(rawFyRear / Math.max(80, fyMaxRear))

        const ayBody = (fyFront + fyRear) / this.mass
        const vyDot = ayBody - vx * r
        // Amortecimento giroscópico natural + momento de guinada dos pneus
        const rDot = (aDist * fyFront - bDist * fyRear) / yawInertia + (leanEqYaw - r) * 8.0

        vy += vyDot * subDt
        r += rDot * subDt

        vy = clamp(vy, -vx * 0.65, vx * 0.65)
        r = clamp(r, -3.8, 3.8)
        headingDelta += r * subDt
        lastAy = ayBody
      }

      // Mistura C0 contínua entre regime de guidão (< 2 m/s) e regime de inclinação (>= 5 m/s)
      if (dynWeight < 1.0) {
        const kinYaw = (vx / wheelbase) * Math.tan(delta)
        r = kinYaw * (1 - dynWeight) + r * dynWeight
        vy *= dynWeight
        lastAy = (vx * kinYaw) * (1 - dynWeight) + lastAy * dynWeight
        headingDelta = r * deltaTime
      }

      this.lateralSpeedMs = Math.abs(vy) < 0.0005 ? 0 : vy
      this.yawRate = Math.abs(r) < 0.0005 ? 0 : r
      this.lateralAccelMs2 = lastAy
      this.slipAngleRad = Math.atan2(this.lateralSpeedMs, Math.max(0.5, this.speedMs))
    } else {
      // ── MODELO PLANAR 2D PARA AUTOMÓVEIS / PICAPES (4 RODAS) ──
      // Bicicleta dinâmica com saturação não-linear, transferência de carga por eixo,
      // círculo de atrito acoplado à tração (FWD / RWD / AWD / 4x4) e conservação de Coriolis.
      this.leanAngleRad = 0
      const vx = this.speedMs
      const dynWeight = clamp((vx - 2.0) / 4.0, 0, 1)

      // Força normal por eixo (incluindo downforce aerodinâmico)
      const frontDownforceShare = this.chassis.frontWeightRatio < 0.5 ? 0.35 : 0.45
      const fzFront = Math.max(200, dynamicWheelLoads.frontAxleLoad + this.effectiveDownforceN * frontDownforceShare)
      const fzRear = Math.max(200, dynamicWheelLoads.rearAxleLoad + this.effectiveDownforceN * (1 - frontDownforceShare))

      // Distribuição de força longitudinal por eixo conforme arquitetura de tração (FWD / RWD / AWD / 4x4)
      const isRwd = this.drivetrain === 'rwd'
      const isFrontBiasedAwdLat = this.drivetrain === '4x4_selectable' || this.drivetrain === 'awd_ondemand'
      const isPtmAwdLat = this.drivetrain === 'awd_ptm'
      const isAwd = isPtmAwdLat || isFrontBiasedAwdLat

      let frontDriveForce = 0
      let rearDriveForce = 0
      if (isPtmAwdLat) {
        // PTM reduz acoplamento dianteiro sob esterçamento para preservar aderência lateral na frente
        frontDriveForce = tractionForce * 0.25
        rearDriveForce = tractionForce * 0.75
      } else if (isFrontBiasedAwdLat) {
        // AWD sob demanda / 4x4: utiliza diretamente as forças de tração reais calculadas por eixo
        frontDriveForce = frontTractionForceN
        rearDriveForce = rearTractionForceN
      } else if (isRwd) {
        rearDriveForce = tractionForce
      } else {
        // FWD
        frontDriveForce = tractionForce
      }

      const fxFront = frontDriveForce - brakeForce * 0.65
      const fxRear = rearDriveForce - brakeForce * 0.35

      // Círculo de atrito elíptico por eixo: patinamento longitudinal reduz aderência lateral disponível
      // -> FWD sob aceleração forte tende ao subesterço (alarga a frente)
      // -> RWD sob aceleração forte tende ao sobresterço (solta a traseira)
      // -> AWD / 4x4 distribui o esforço conforme o modo ativo (AUTO reativo vs 4WD/LOW bloqueado 50/50)
      const maxFrontForce = Math.max(100, frontSurfaceMu * fzFront)
      const maxRearForce = Math.max(100, rearSurfaceMu * fzRear)

      let frontUsage = clamp((Math.abs(fxFront) / maxFrontForce) * 0.85, 0, 0.72)
      let rearUsage = clamp((Math.abs(fxRear) / maxRearForce) * 0.85, 0, 0.72)
      if (isWheelSlipping) {
        if (isFrontBiasedAwdLat) {
          if (frontAxleSlip) frontUsage = Math.max(frontUsage, 0.90)
          if (rearAxleSlip) rearUsage = Math.max(rearUsage, 0.86)
        } else if (!isRwd && !isAwd) {
          frontUsage = Math.max(frontUsage, 0.88)
        } else if (isRwd) {
          rearUsage = Math.max(rearUsage, 0.88)
        } else {
          frontUsage = Math.max(frontUsage, 0.58)
          rearUsage = Math.max(rearUsage, 0.70)
        }
      }
      if (isHandbrake) {
        rearUsage = 0.94
      }

      const fyMaxFront = maxFrontForce * Math.sqrt(Math.max(0.24, 1 - frontUsage * frontUsage))
      const fyMaxRear = maxRearForce * Math.sqrt(Math.max(0.18, 1 - rearUsage * rearUsage))

      // Rigidez de deriva (cornering stiffness) proporcional à carga e ao composto de pneu
      const stiffnessMult = this.tireCompound === 'semi_slick' ? 12.8 : 10.4
      const cAlphaFront = stiffnessMult * fzFront
      const cAlphaRear = stiffnessMult * fzRear * (isHandbrake ? 0.45 : 1.04)

      // Momento de inércia de guinada Iz = m * (a*b + 0.16*L^2)
      const yawInertia = yawInertiaKgM2

      // 2 micropassos internos (240 Hz efetivo) garantem estabilidade numérica incondicional
      const subDt = deltaTime / 2
      let vy = this.lateralSpeedMs
      let r = this.yawRate
      let lastFyFront = 0
      let lastAlphaFront = 0
      let lastAy = 0
      let coriolisVxDelta = 0

      for (let s = 0; s < 2; s++) {
        const prevVy = vy
        const prevR = r
        const alphaFront = delta - Math.atan2(vy + aDist * r, vx)
        const alphaRear = -Math.atan2(vy - bDist * r, vx)

        const fyFront = fyMaxFront * Math.tanh((cAlphaFront * alphaFront) / Math.max(100, fyMaxFront))
        const fyRear = fyMaxRear * Math.tanh((cAlphaRear * alphaRear) / Math.max(100, fyMaxRear))

        const totalFy = fyFront * Math.cos(delta) + fyRear
        const yawTorque = aDist * fyFront * Math.cos(delta) - bDist * fyRear
        const ayBody = totalFy / this.mass
        const vyDot = ayBody - vx * r
        const rDot = yawTorque / yawInertia

        vy += vyDot * subDt
        r += rDot * subDt

        // Proteção física de teto de guinada/deriva contra extremos numéricos
        vy = clamp(vy, -vx * 1.15, vx * 1.15)
        r = clamp(r, -4.5, 4.5)

        const midVy = 0.5 * (prevVy + vy)
        const midR = 0.5 * (prevR + r)
        headingDelta += midR * subDt
        // Acoplamento de Coriolis (+vy * r) usando ponto médio para conservação de energia cinética
        coriolisVxDelta += midVy * midR * subDt
        lateralWorkJ += (totalFy * midVy + yawTorque * midR) * subDt

        lastFyFront = fyFront
        lastAlphaFront = alphaFront
        lastAy = ayBody
      }

      // Mistura C0 contínua cinemática -> dinâmica entre 2.0 m/s e 6.0 m/s
      if (dynWeight < 1.0) {
        const kinYaw = (vx / wheelbase) * Math.tan(delta)
        r = kinYaw * (1 - dynWeight) + r * dynWeight
        vy *= dynWeight
        lastAy = (vx * kinYaw) * (1 - dynWeight) + lastAy * dynWeight
        headingDelta = r * deltaTime
        coriolisVxDelta *= dynWeight
        lateralWorkJ *= dynWeight
      }

      this.lateralSpeedMs = Math.abs(vy) < 0.0005 ? 0 : vy
      this.yawRate = Math.abs(r) < 0.0005 ? 0 : r
      this.lateralAccelMs2 = lastAy

      // Arrasto induzido de deriva (scrub drag) + conservação de Coriolis
      scrubForceN = Math.abs(lastFyFront * Math.sin(lastAlphaFront)) * 0.45 * dynWeight
      const totalVxAdjustment = coriolisVxDelta - (scrubForceN / this.mass) * deltaTime
      if (Math.abs(totalVxAdjustment) > 1e-5 && this.speedMs > 0.2) {
        this.speedMs = Math.max(0, this.speedMs + totalVxAdjustment)
        if (!isWheelSlipping) {
          this.wheelSpeedMs = this.speedMs
        }
      }

      this.slipAngleRad = Math.atan2(this.lateralSpeedMs, Math.max(0.5, this.speedMs))
    }

    if (input.stationarySimulation) {
      // Modo Painel (Simulador Estacionário): zero deslocamento espacial 2D, zero esterçamento, zero consulta/colisão no mundo
      this.steeringAngleRad = 0
      this.yawRate = 0
      this.lateralSpeedMs = 0
      this.lateralAccelMs2 = 0
      this.slipAngleRad = 0
      this.leanAngleRad = 0
      this.isColliding = false
      this.collisionBoundaryName = null
      this.currentSurface = 'asphalt'
      this.baseSurfaceFriction = 1.0
      this.surfaceFriction =
        this.manualFrictionOverride !== null
          ? this.manualFrictionOverride
          : this.computeCompositeFriction(1.0, 'asphalt', Boolean(isRaining))
      this.rollingCoeff = 0.015
    } else {
      this.headingRad += headingDelta
      // Normaliza heading no intervalo [-pi, pi]
      while (this.headingRad > Math.PI) this.headingRad -= 2 * Math.PI
      while (this.headingRad < -Math.PI) this.headingRad += 2 * Math.PI

      // Velocidade vetorial no referencial do mundo (Norte = +Y, Leste = +X)
      const vDirectional = isReverse ? -this.speedMs : this.speedMs
      const sinH = Math.sin(this.headingRad)
      const cosH = Math.cos(this.headingRad)
      let vWorldX = vDirectional * sinH + this.lateralSpeedMs * cosH
      let vWorldY = vDirectional * cosH - this.lateralSpeedMs * sinH

      this.positionX += vWorldX * deltaTime
      this.positionY += vWorldY * deltaTime

      // 10. Consulta de Superfície e Colisão Vetorial com Barreiras e Obstáculos do WorldMap
      let mapQuery = WorldMap.query(this.positionX, this.positionY, Boolean(isRaining), vehicleRadius)
      this.isColliding = false
      this.collisionBoundaryName = null

      // Até 2 passes de resolução para cantos entre barreiras/blocos
      for (let pass = 0; pass < 2 && mapQuery.collision.isColliding; pass++) {
        const col = mapQuery.collision
        this.isColliding = true
        this.collisionBoundaryName = col.boundaryName ?? 'Barreira'

        // Afasta o veículo da barreira pelo vetor normal de penetração
        this.positionX += col.normalX * (col.penetrationDepth + 0.01)
        this.positionY += col.normalY * (col.penetrationDepth + 0.01)

        // Projeção da velocidade do mundo sobre a normal da barreira
        const vDotN = vWorldX * col.normalX + vWorldY * col.normalY
        if (vDotN < 0) {
          // Impacto inelástico com leve restituição (0.12) e amortecimento tangencial por atrito no muro
          const restitution = 0.12
          const wallFrictionDamping = 0.72
          vWorldX = (vWorldX - (1 + restitution) * vDotN * col.normalX) * wallFrictionDamping
          vWorldY = (vWorldY - (1 + restitution) * vDotN * col.normalY) * wallFrictionDamping

          // Reprojeção para o referencial do chassi (longitudinal + lateral)
          const nextVx = vWorldX * sinH + vWorldY * cosH
          const nextVy = vWorldX * cosH - vWorldY * sinH

          this.speedMs = isReverse ? Math.max(0, -nextVx) : Math.max(0, nextVx)
          if (this.speedMs < 0.25) {
            this.speedMs = 0
            this.motionDirection = 0
          }
          this.lateralSpeedMs = nextVy * 0.45
          if (Math.abs(this.lateralSpeedMs) < 0.05) this.lateralSpeedMs = 0
          this.yawRate *= 0.35
          this.wheelSpeedMs = this.speedMs
        }

        mapQuery = WorldMap.query(this.positionX, this.positionY, Boolean(isRaining), vehicleRadius)
      }

      // Guarda de integridade numérica (garante zero NaN/Infinity no estado 2D)
      if (!Number.isFinite(this.positionX)) this.positionX = WorldMap.SPAWN_X
      if (!Number.isFinite(this.positionY)) this.positionY = WorldMap.SPAWN_Y
      if (!Number.isFinite(this.headingRad)) this.headingRad = 0
      if (!Number.isFinite(this.speedMs)) this.speedMs = 0
      if (!Number.isFinite(this.lateralSpeedMs)) this.lateralSpeedMs = 0
      if (!Number.isFinite(this.yawRate)) this.yawRate = 0
      if (!Number.isFinite(this.lateralAccelMs2)) this.lateralAccelMs2 = 0
      if (!Number.isFinite(this.slipAngleRad)) this.slipAngleRad = 0
      if (!Number.isFinite(this.leanAngleRad)) this.leanAngleRad = 0

      this.currentSurface = mapQuery.surface.type
      this.currentZoneName = mapQuery.zoneName
      this.baseSurfaceFriction = mapQuery.surface.friction
      this.surfaceFriction =
        this.manualFrictionOverride !== null
          ? this.manualFrictionOverride
          : this.computeCompositeFriction(this.baseSurfaceFriction, this.currentSurface, Boolean(isRaining))
      this.rollingCoeff = mapQuery.surface.rollingResistance
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
      lateralSpeedMs: this.lateralSpeedMs,
      slipAngleDeg: this.getSlipAngleDeg(),
      lateralAccelG: this.getLateralAccelG(),
      leanAngleDeg: this.getLeanAngleDeg(),
      acceleration: this.accelerationMs2,
      transmissionAngularVelocity,
      wheelRpm,
      wheelSpeedKmh: this.getWheelSpeedKmh(),
      tractionForce,
      resistiveForce: rollingResistance + aeroResistance + brakeForce + Math.max(0, slopeForce),
      brakeForceN: brakeForce,
      rollingResistanceN: rollingResistance,
      aeroResistanceN: aeroResistance,
      scrubForceN,
      yawInertiaKgM2,
      lateralWorkJ,
      wheelTorque,
      maxGripTorque,
      frontAxleTorqueNm,
      rearAxleTorqueNm,
      frontTractionForceN,
      rearTractionForceN,
      frontAxleSlip,
      rearAxleSlip,
      awdRearCoupling: this.awdRearCoupling,
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
      isColliding: this.isColliding,
      collisionBoundaryName: this.collisionBoundaryName,
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
    this.motionDirection = 0
    this.accelerationMs2 = 0
    this.wheelSpeedMs = 0
    this.positionX = WorldMap.SPAWN_X
    this.positionY = WorldMap.SPAWN_Y
    this.headingRad = (WorldMap.SPAWN_HEADING_DEG * Math.PI) / 180
    this.steeringAngleRad = 0
    this.yawRate = 0
    this.lateralSpeedMs = 0
    this.slipAngleRad = 0
    this.lateralAccelMs2 = 0
    this.leanAngleRad = 0
    this.awdRearCoupling = 0
    this.isColliding = false
    this.collisionBoundaryName = null
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
      motionDirection: this.motionDirection,
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
      lateralSpeedMs: this.lateralSpeedMs,
      slipAngleRad: this.slipAngleRad,
      lateralAccelMs2: this.lateralAccelMs2,
      leanAngleRad: this.leanAngleRad,
      awdRearCoupling: this.awdRearCoupling,
      currentSurface: this.currentSurface,
      windowAeroDragMultiplier: this.windowAeroDragMultiplier,
    }
  }

  restoreSnapshot(snapshot: VehiclePhysicsSnapshot): void {
    this.speedMs = snapshot.speedMs
    if (snapshot.motionDirection !== undefined) {
      this.motionDirection = snapshot.motionDirection
    } else if (this.speedMs <= 0.02) {
      this.motionDirection = 0
    }
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
    if (snapshot.lateralSpeedMs !== undefined) this.lateralSpeedMs = snapshot.lateralSpeedMs
    if (snapshot.slipAngleRad !== undefined) this.slipAngleRad = snapshot.slipAngleRad
    if (snapshot.lateralAccelMs2 !== undefined) this.lateralAccelMs2 = snapshot.lateralAccelMs2
    if (snapshot.leanAngleRad !== undefined) this.leanAngleRad = snapshot.leanAngleRad
    if (snapshot.awdRearCoupling !== undefined) this.awdRearCoupling = snapshot.awdRearCoupling
    if (snapshot.currentSurface !== undefined) this.currentSurface = snapshot.currentSurface
    if (snapshot.windowAeroDragMultiplier !== undefined) {
      this.windowAeroDragMultiplier = snapshot.windowAeroDragMultiplier
    }
  }
}

export interface VehiclePhysicsSnapshot {
  speedMs: number
  motionDirection?: -1 | 0 | 1
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
  lateralSpeedMs?: number
  slipAngleRad?: number
  lateralAccelMs2?: number
  leanAngleRad?: number
  awdRearCoupling?: number
  currentSurface?: SurfaceType
  windowAeroDragMultiplier?: number
}
