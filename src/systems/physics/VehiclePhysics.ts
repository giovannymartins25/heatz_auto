import { clamp } from '@/utils/math'
import { VehicleChassis, type ChassisConfig, type DynamicLoadResult, type AxleLoads, createVehicleChassis } from './Chassis'
import type { SuspensionHeight, RearWingPosition, RearWingType } from '@/stores/useGarageStore'

export type FourWheelDriveMode = 'auto' | '4wd' | '4wd_low'

export interface VehiclePhysicsConfig {
  weight: number        // kg
  wheelDiameter: number // metros
  isMotorcycle?: boolean
  vehicleId?: string
  chassis?: VehicleChassis | ChassisConfig
  fourWheelDriveMode?: FourWheelDriveMode
  roadGradePercent?: number
}

export interface PhysicsTickInput {
  driveTorqueAtTransmission: number // Nm entregue ao eixo primário pela embreagem
  gearRatio: number                 // relação da marcha atual
  finalDrive: number                // relação do diferencial
  brake: number                     // 0-1 posição do freio
  deltaTime: number                 // segundos
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
}

/**
 * VehiclePhysics — Simulação de dinâmica longitudinal do veículo baseada em forças.
 * 
 * Fase 1.6.1 + Refinamento 4x4: Integrado com VehicleChassis para representação tipada do centro de massa,
 * geometria entre-eixos, distribuição estática/dinâmica de cargas normais e física autêntica de tração 4x4.
 *
 * Equações físicas fundamentadas:
 * - Força peso e inclinação: W = m * g, W_N = m * g * cos(theta), F_slope = m * g * sin(theta)
 * - Distribuição estática sob inclinação: F_zf0 = m * g * (cos(theta)*b/L - sin(theta)*h_cg/L)
 * - Transferência dinâmica por aceleração: Delta_Fz = (m * h_cg / L) * a_x
 * - Força normal sobre eixos tracionados (FWD, RWD, 4WD LOCK 50/50, 4WD AUTO sob demanda)
 * - Limite de aderência do pneu (Atrito de Coulomb dinâmico): F_grip = mu * N_motriz
 * - Relação natural de transmissão: 4WD LOW utiliza a 1ª marcha ultracurta (crawl ratio 4.700:1)
 *   sem multiplicadores arbitrários de torque adicionais.
 * - Resistência ao rolamento: F_rr = Crr * W_N
 * - Arrasto aerodinâmico: F_aero = 0.5 * rho * Cd * A * v²
 * - Força de frenagem proporcional ao pedal
 * - Segunda Lei de Newton: a = F_líquida / m
 */
export class VehiclePhysics {
  private readonly mass: number
  private readonly wheelRadius: number
  private readonly efficiency: number
  private readonly rollingCoeff: number
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

  private speedMs: number = 0 // velocidade linear em m/s
  private accelerationMs2: number = 0
  private surfaceFriction: number = 0.95 // Coeficiente de atrito mu (0.95 asfalto seco, 0.55 molhado, 0.45 terra, 0.25 lama/gelo)
  private roadGradePercent: number = 0 // Inclinação em % (+ = subida, - = descida)
  private wheelSpeedMs: number = 0

  constructor(config: VehiclePhysicsConfig) {
    this.isMotorcycle = config.isMotorcycle ?? false
    this.vehicleId = config.vehicleId
    this.fourWheelDriveMode = config.fourWheelDriveMode ?? 'auto'
    this.roadGradePercent = config.roadGradePercent ?? 0

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

    // Relação nominal de peso no eixo tracionado de acordo com arquitetura e modo de tração
    this.driveAxleWeightRatio = this.calculateDriveAxleWeightRatio()

    // Constante aerodinâmica 0.5 * rho * Cd * A
    this.baseAeroConstant = this.isMotorcycle ? 0.25 : 0.40
    this.currentAeroConstant = this.baseAeroConstant
    this.downforceCoeff = this.vehicleId === 'porsche-gt3' ? 0.35 : 0.08
    this.rollingCoeff = 0.015 // Asfalto típico
  }

  /**
   * Configura a altura da suspensão e deslocamento do centro de gravidade.
   */
  setSuspensionHeight(height: SuspensionHeight): void {
    this.suspensionHeight = height
    switch (height) {
      case 'sport':
        this.suspensionHeightOffset = -0.03 // -30 mm
        break
      case 'track':
        this.suspensionHeightOffset = -0.05 // -50 mm
        break
      case 'lift':
        this.suspensionHeightOffset = 0.03 // +30 mm (Front Lift Porsche / off-road)
        break
      default:
        this.suspensionHeightOffset = 0
        break
    }
  }

  getSuspensionHeight(): SuspensionHeight {
    return this.suspensionHeight
  }

  /**
   * Configura parâmetros aerodinâmicos funcionais (asa traseira, tipo de aerofólio e downforce).
   */
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
      // Porsche 911 GT3 RS: Aerodinâmica Ativa controlada pelo PCM 6.0
      if (!isExtended) {
        // Asa recolhida: menor arrasto
        this.currentAeroConstant = this.baseAeroConstant * 0.92
        this.downforceCoeff = 0.10
      } else if (wingPosition === 'low_drag') {
        // Baixo arrasto para velocidade máxima em retas longas
        this.currentAeroConstant = this.baseAeroConstant * 0.88
        this.downforceCoeff = 0.12
      } else if (wingPosition === 'high_downforce') {
        // Alto downforce: maior aderência em curvas, porém mais arrasto em retas
        this.currentAeroConstant = this.baseAeroConstant * 1.32
        this.downforceCoeff = 0.65
      } else {
        // Equilíbrio padrão de pista (balanced)
        this.currentAeroConstant = this.baseAeroConstant * 1.05
        this.downforceCoeff = 0.35
      }
    } else {
      // Demais veículos com aerofólios configuráveis na oficina
      switch (wingType) {
        case 'sport_gt': {
          // Asa alta Motorsport GT: Downforce brutal em curvas, porém maior arrasto em retas (+24% drag)
          this.currentAeroConstant = this.baseAeroConstant * 1.24
          this.downforceCoeff = 0.55
          break
        }
        case 'aftermarket': {
          // Spoiler ducktail esportivo: Downforce moderado, leve acréscimo de arrasto (+8% drag)
          this.currentAeroConstant = this.baseAeroConstant * 1.08
          this.downforceCoeff = 0.28
          break
        }
        case 'oem': {
          // Spoiler original de fábrica (ex: Civic Si)
          this.currentAeroConstant = this.baseAeroConstant * 1.02
          this.downforceCoeff = 0.16
          break
        }
        case 'none':
        default: {
          // Sem aerofólio traseiro: menor arrasto possível, mas carga aerodinâmica mínima
          this.currentAeroConstant = this.baseAeroConstant * 0.96
          this.downforceCoeff = 0.04
          break
        }
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

  /**
   * Define o modo de tração 4x4 (AUTO, 4WD bloqueado 50/50, 4WD LOW com crawl).
   */
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
        // Bloqueio integral 50/50: ambos os eixos geram tração simultânea (100% da carga normal total do veículo)
        return 1.0
      }
      // AUTO sob demanda: controle eletrônico de acoplamento inteligente
      return 0.85
    }
    if (this.vehicleId === 'fiat-toro-endurance-2025') {
      // Picape FWD de entrada: tração apenas dianteira
      return this.chassis.frontWeightRatio
    }
    if (this.vehicleId === 'porsche-gt3' || this.vehicleId === 'opala-4100' || this.isMotorcycle) {
      // Veículos com tração traseira (RWD / Motocicleta)
      return this.chassis.rearWeightRatio
    }
    // Veículos com tração dianteira (FWD padrão)
    return this.chassis.frontWeightRatio
  }

  /**
   * Retorna a instância física de chassi e centro de massa associada.
   */
  getChassis(): VehicleChassis {
    return this.chassis
  }

  /**
   * Define e obtém a inclinação longitudinal da pista (Road Grade em %).
   * Exemplo: 0% = plano, 15% = subida íngreme, -10% = descida acentuada.
   */
  setRoadGrade(gradePercent: number): void {
    this.roadGradePercent = clamp(gradePercent, -50, 50)
  }

  getRoadGrade(): number {
    return this.roadGradePercent
  }

  /**
   * Retorna as cargas dinâmicas atuais nos eixos sob a aceleração corrente e inclinação.
   */
  getAxleLoads(): DynamicLoadResult {
    const thetaRad = Math.atan(this.roadGradePercent / 100)
    const cosTheta = Math.cos(thetaRad)
    const sinTheta = Math.sin(thetaRad)

    const totalWeight = this.mass * this.chassis.gravity
    const normalWeight = totalWeight * cosTheta

    // Distribuição estática sobre plano inclinado
    const b = this.chassis.distanceCgToRearAxle
    const a = this.chassis.distanceCgToFrontAxle
    const L = this.chassis.wheelbase
    const h = Math.max(0.20, this.chassis.centerOfMassHeight + this.suspensionHeightOffset)

    const staticFront = totalWeight * (cosTheta * (b / L) - sinTheta * (h / L))
    const staticRear = totalWeight * (cosTheta * (a / L) + sinTheta * (h / L))

    // Transferência longitudinal dinâmica D'Alembert
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

  /**
   * Retorna as cargas estáticas em repouso nos eixos.
   */
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
  }

  setSurfaceFriction(mu: number): void {
    this.surfaceFriction = clamp(mu, 0.05, 1.5)
  }

  getSurfaceFriction(): number {
    return this.surfaceFriction
  }

  /**
   * Retorna o torque máximo que o atrito dos pneus suporta antes de patinar.
   * Utiliza a carga normal dinamicamente atuando sobre os eixos motrizes,
   * considerando inclinação e transferência dinâmica de carga longitudinal.
   */
  getMaxGripTorque(): number {
    const axleLoads = this.getAxleLoads()
    let normalForceOnDrivenWheels = 0

    if (this.vehicleId === 'fiat-toro-ranch-2025') {
      if (this.fourWheelDriveMode === '4wd' || this.fourWheelDriveMode === '4wd_low') {
        // Tração 4x4 bloqueada 50/50: 100% da carga normal de ambos os eixos
        normalForceOnDrivenWheels = axleLoads.frontAxleLoad + axleLoads.rearAxleLoad
      } else {
        // AUTO sob demanda: sob repouso/cruzeiro mobiliza dianteira + parcela traseira;
        // com escorregamento fecha acoplamento até 100%
        const isSlipDetected = Math.abs(this.wheelSpeedMs - this.speedMs) > 0.1
        const rearShare = isSlipDetected ? 1.0 : 0.65
        normalForceOnDrivenWheels = axleLoads.frontAxleLoad + axleLoads.rearAxleLoad * rearShare
      }
    } else if (this.vehicleId === 'fiat-toro-endurance-2025') {
      // Picape FWD: exclusivamente carga normal do eixo dianteiro (diminui em aceleração e em subidas!)
      normalForceOnDrivenWheels = axleLoads.frontAxleLoad
    } else if (this.vehicleId === 'porsche-gt3' || this.vehicleId === 'opala-4100' || this.isMotorcycle) {
      // RWD / Moto: carga normal do eixo traseiro (aumenta em aceleração e em subidas)
      normalForceOnDrivenWheels = axleLoads.rearAxleLoad
    } else {
      // Demais automóveis FWD padrão
      normalForceOnDrivenWheels = axleLoads.frontAxleLoad
    }

    // Downforce aerodinâmico transfere carga normal para os eixos em alta velocidade
    const downforceOnDrivenWheels = this.effectiveDownforceN * this.driveAxleWeightRatio
    const totalNormalForce = normalForceOnDrivenWheels + downforceOnDrivenWheels
    const maxGripForce = this.surfaceFriction * totalNormalForce
    return maxGripForce * this.wheelRadius
  }

  /**
   * Executa um tick da física longitudinal a 120 Hz.
   */
  tick(input: PhysicsTickInput): PhysicsTickResult {
    const { driveTorqueAtTransmission, gearRatio, finalDrive, brake, deltaTime } = input
    const effectiveTotalRatio = gearRatio * finalDrive

    const thetaRad = Math.atan(this.roadGradePercent / 100)
    const cosTheta = Math.cos(thetaRad)
    const sinTheta = Math.sin(thetaRad)

    // Downforce aerodinâmico real proporcional a v²: F_downforce = C_downforce * v²
    this.effectiveDownforceN = this.downforceCoeff * this.speedMs * this.speedMs
    const normalWeight = this.mass * this.chassis.gravity * cosTheta + this.effectiveDownforceN

    // 1. Torque e Força de Tração teórica nas Rodas (Newtons)
    let wheelTorque = 0
    let tractionForce = 0
    let isWheelSlipping = false
    let slipRatio = 0

    const maxGripTorque = this.getMaxGripTorque()
    const maxGripForce = maxGripTorque / this.wheelRadius

    if (gearRatio !== 0 && driveTorqueAtTransmission > 0) {
      // Transmissão mecânica direta: sem multiplicador arbitrário
      wheelTorque = driveTorqueAtTransmission * effectiveTotalRatio * this.efficiency
      
      // Verificação física de perda de aderência (Wheel Spin)
      if (wheelTorque > maxGripTorque && brake < 0.1) {
        isWheelSlipping = true
        // Sob patinamento, o atrito passa para o regime cinético (~82% da aderência máxima estática)
        const kineticFrictionFactor = 0.82
        tractionForce = maxGripForce * kineticFrictionFactor
        
        // A velocidade da roda se eleva proporcionalmente ao torque excedente
        const excessTorqueRatio = (wheelTorque - maxGripTorque) / Math.max(100, maxGripTorque)
        const slipSpeedMs = excessTorqueRatio * 3.8
        this.wheelSpeedMs = this.speedMs + slipSpeedMs
        slipRatio = slipSpeedMs / Math.max(2.5, this.wheelSpeedMs)
      } else {
        // Aderência normal integral
        tractionForce = wheelTorque / this.wheelRadius
        this.wheelSpeedMs = this.speedMs
        slipRatio = 0
      }
    } else if (gearRatio !== 0 && driveTorqueAtTransmission < 0 && this.speedMs > 0.05) {
      // Freio motor em desaceleração:
      // O freio-motor é naturalmente proporcional à relação da marcha engatada
      const rawBrakingWheelTorque =
        (driveTorqueAtTransmission * effectiveTotalRatio) / Math.max(0.75, this.efficiency)
      wheelTorque = Math.max(rawBrakingWheelTorque, -maxGripTorque)
      tractionForce = wheelTorque / this.wheelRadius
      this.wheelSpeedMs = this.speedMs
      slipRatio = 0
    } else {
      this.wheelSpeedMs = this.speedMs
    }

    // 2. Força de Resistência ao Rolamento (Newtons, proporcional à carga normal)
    const rollingResistance = this.rollingCoeff * normalWeight

    // 3. Força de Resistência Aerodinâmica (Newtons: proporcional a v²)
    const aeroResistance = this.currentAeroConstant * this.speedMs * this.speedMs

    // 4. Força Gravitacional de Rampa / Subida (Newtons)
    // Positiva na subida (resiste ao avanço); negativa na descida (auxilia o avanço)
    const slopeForce = this.mass * this.chassis.gravity * sinTheta

    // 5. Força de Frenagem (Newtons: desaceleração máxima de ~1.1G)
    const maxBrakeForce = normalWeight * 1.1
    const brakeForce = clamp(brake, 0, 1) * maxBrakeForce

    // 6. Força Líquida atuando no chassi
    let netForce = 0
    const totalOpposingForce = rollingResistance + aeroResistance + brakeForce + slopeForce

    if (this.speedMs > 0.05) {
      netForce = tractionForce - totalOpposingForce
    } else {
      const staticResistance = rollingResistance * 1.2 + brakeForce + slopeForce
      if (tractionForce > staticResistance) {
        netForce = tractionForce - staticResistance
      } else if (slopeForce < 0 && Math.abs(slopeForce) > rollingResistance * 1.2 + brakeForce) {
        // Descida livre (gravidade puxa para frente na ausência de freio)
        netForce = Math.abs(slopeForce) - (rollingResistance * 1.2 + brakeForce)
      } else {
        netForce = 0
        this.speedMs = 0
        this.wheelSpeedMs = 0
      }
    }

    // 7. Aceleração (Segunda Lei de Newton: a = F / m)
    this.accelerationMs2 = netForce / this.mass

    // 8. Atualizar Velocidade
    this.speedMs += this.accelerationMs2 * deltaTime
    if (this.speedMs < 0) {
      this.speedMs = 0
      this.accelerationMs2 = 0
      this.wheelSpeedMs = 0
    }

    // 9. Calcular rotação do eixo primário da transmissão baseado na velocidade da roda
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
    }
  }

  reset(): void {
    this.speedMs = 0
    this.accelerationMs2 = 0
    this.wheelSpeedMs = 0
  }

  /** Captura snapshot imutável para isolamento transacional */
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
    }
  }

  /** Restaura estado da dinâmica a partir do snapshot */
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
  }
}

/**
 * Snapshot isolado do estado do veículo.
 */
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
}
