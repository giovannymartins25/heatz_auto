import { clamp } from '@/utils/math'
import { VehicleChassis, type ChassisConfig, type DynamicLoadResult, type AxleLoads, createVehicleChassis } from './Chassis'

export interface VehiclePhysicsConfig {
  weight: number        // kg
  wheelDiameter: number // metros
  isMotorcycle?: boolean
  vehicleId?: string
  chassis?: VehicleChassis | ChassisConfig
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
 * Fase 1.6.1: Integrado com VehicleChassis para representação tipada do centro de massa,
 * geometria entre-eixos e distribuição estática/dinâmica de cargas normais (SI).
 *
 * Equações físicas fundamentadas:
 * - Força peso: W = m * g
 * - Distribuição estática: F_zf0 = m * g * (b / L), F_zr0 = m * g * (a / L)
 * - Transferência dinâmica: Delta_Fz = (m * h_cg / L) * a_x
 * - Força de tração nas rodas: F_trac = (Torque * Relação * Diferencial * Eficiência) / Raio
 * - Limite de aderência do pneu (Atrito de Coulomb): F_grip = mu * N_motriz
 * - Escorregamento de roda (Wheel Slip) sob excesso de torque
 * - Resistência ao rolamento: F_rr = Crr * m * g
 * - Arrasto aerodinâmico: F_aero = 0.5 * rho * Cd * A * v²
 * - Força de frenagem proporcional ao pedal (0-100%)
 * - Aceleração: a = F_líquida / m
 */
export class VehiclePhysics {
  private readonly mass: number
  private readonly wheelRadius: number
  private readonly efficiency: number
  private readonly aeroConstant: number
  private readonly rollingCoeff: number
  private readonly driveAxleWeightRatio: number
  private readonly isMotorcycle: boolean
  private readonly vehicleId?: string
  private readonly chassis: VehicleChassis

  private speedMs: number = 0 // velocidade linear em m/s
  private accelerationMs2: number = 0
  private surfaceFriction: number = 0.95 // Coeficiente de atrito mu (0.95 asfalto seco, ~0.35 piso molhado/escorregadio)
  private wheelSpeedMs: number = 0

  constructor(config: VehiclePhysicsConfig) {
    this.isMotorcycle = config.isMotorcycle ?? false
    this.vehicleId = config.vehicleId

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

    // Relação de peso no eixo tracionado
    if (this.vehicleId === 'porsche-gt3' || this.vehicleId === 'opala-4100' || this.isMotorcycle) {
      // Veículos com tração traseira (RWD / Motocicleta)
      this.driveAxleWeightRatio = this.chassis.rearWeightRatio
    } else {
      // Veículos com tração dianteira (FWD padrão)
      this.driveAxleWeightRatio = this.chassis.frontWeightRatio
    }

    // Constante aerodinâmica 0.5 * rho * Cd * A
    this.aeroConstant = this.isMotorcycle ? 0.25 : 0.40
    this.rollingCoeff = 0.015 // Asfalto típico
  }

  /**
   * Retorna a instância física de chassi e centro de massa associada.
   */
  getChassis(): VehicleChassis {
    return this.chassis
  }

  /**
   * Retorna as cargas dinâmicas atuais nos eixos sob a aceleração corrente.
   */
  getAxleLoads(): DynamicLoadResult {
    return this.chassis.getDynamicAxleLoads(this.accelerationMs2)
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
   * Utiliza a carga normal sobre o eixo de tração com base no centro de massa e gravidade física.
   */
  getMaxGripTorque(): number {
    const normalForce = this.mass * this.chassis.gravity * this.driveAxleWeightRatio
    const maxGripForce = this.surfaceFriction * normalForce
    return maxGripForce * this.wheelRadius
  }

  /**
   * Executa um tick da física longitudinal.
   */
  tick(input: PhysicsTickInput): PhysicsTickResult {
    const { driveTorqueAtTransmission, gearRatio, finalDrive, brake, deltaTime } = input
    const effectiveTotalRatio = gearRatio * finalDrive

    // 1. Torque e Força de Tração teórica nas Rodas (Newtons)
    let wheelTorque = 0
    let tractionForce = 0
    let isWheelSlipping = false
    let slipRatio = 0

    const maxGripTorque = this.getMaxGripTorque()
    const maxGripForce = maxGripTorque / this.wheelRadius

    if (gearRatio !== 0 && driveTorqueAtTransmission > 0) {
      wheelTorque = driveTorqueAtTransmission * effectiveTotalRatio * this.efficiency
      
      // Verificação de perda de aderência (Wheel Spin)
      if (wheelTorque > maxGripTorque && brake < 0.1) {
        isWheelSlipping = true
        // Sob patinamento, o atrito passa para cinético (~80% da aderência máxima estática)
        const kineticFrictionFactor = 0.80
        tractionForce = maxGripForce * kineticFrictionFactor
        
        // A velocidade da roda sobe acima da velocidade do carro devido ao torque excedente
        const excessTorqueRatio = (wheelTorque - maxGripTorque) / Math.max(100, maxGripTorque)
        const slipSpeedMs = excessTorqueRatio * 4.5 // m/s de patinamento
        this.wheelSpeedMs = this.speedMs + slipSpeedMs
        slipRatio = slipSpeedMs / Math.max(2.5, this.wheelSpeedMs)
      } else {
        // Aderência normal: tração total transmitida
        tractionForce = wheelTorque / this.wheelRadius
        this.wheelSpeedMs = this.speedMs
        slipRatio = 0
      }
    } else if (gearRatio !== 0 && driveTorqueAtTransmission < 0 && this.speedMs > 0.05) {
      // Freio motor em desaceleração: torque negativo na transmissão desacelera o veículo
      const rawBrakingWheelTorque =
        (driveTorqueAtTransmission * effectiveTotalRatio) / Math.max(0.75, this.efficiency)
      wheelTorque = Math.max(rawBrakingWheelTorque, -maxGripTorque)
      tractionForce = wheelTorque / this.wheelRadius
      this.wheelSpeedMs = this.speedMs
      slipRatio = 0
    } else {
      this.wheelSpeedMs = this.speedMs
    }

    // 2. Força de Resistência ao Rolamento (Newtons)
    const rollingResistance = this.rollingCoeff * this.mass * this.chassis.gravity

    // 3. Força de Resistência Aerodinâmica (Newtons: proporcional a v²)
    const aeroResistance = this.aeroConstant * this.speedMs * this.speedMs

    // 4. Força de Frenagem (Newtons: desaceleração máxima de ~1.1G)
    const maxBrakeForce = this.mass * this.chassis.gravity * 1.1
    const brakeForce = clamp(brake, 0, 1) * maxBrakeForce

    // 5. Força Líquida atuando no chassi
    let netForce = 0
    if (this.speedMs > 0.05) {
      netForce = tractionForce - rollingResistance - aeroResistance - brakeForce
    } else {
      const staticThreshold = rollingResistance * 1.2 + brakeForce
      if (tractionForce > staticThreshold) {
        netForce = tractionForce - staticThreshold
      } else {
        netForce = 0
        this.speedMs = 0
        this.wheelSpeedMs = 0
      }
    }

    // 6. Aceleração (Segunda Lei de Newton: a = F / m)
    this.accelerationMs2 = netForce / this.mass

    // 7. Atualizar Velocidade
    this.speedMs += this.accelerationMs2 * deltaTime
    if (this.speedMs < 0) {
      this.speedMs = 0
      this.accelerationMs2 = 0
      this.wheelSpeedMs = 0
    }

    // 8. Calcular rotação do eixo primário da transmissão baseado na velocidade da roda
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
      resistiveForce: rollingResistance + aeroResistance + brakeForce,
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
      wheelSpeedMs: this.wheelSpeedMs,
    }
  }

  /** Restaura estado da dinâmica a partir do snapshot */
  restoreSnapshot(snapshot: VehiclePhysicsSnapshot): void {
    this.speedMs = snapshot.speedMs
    this.accelerationMs2 = snapshot.accelerationMs2
    this.surfaceFriction = snapshot.surfaceFriction
    this.wheelSpeedMs = snapshot.wheelSpeedMs
  }
}

/**
 * Snapshot isolado do estado do veículo.
 */
export interface VehiclePhysicsSnapshot {
  speedMs: number
  accelerationMs2: number
  surfaceFriction: number
  wheelSpeedMs: number
}
