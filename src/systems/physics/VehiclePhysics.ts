import { clamp } from '@/utils/math'

export interface VehiclePhysicsConfig {
  weight: number        // kg
  wheelDiameter: number // metros
  isMotorcycle?: boolean
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
 * Substitui o cálculo cinemático rígido (rpmToSpeed) por física real:
 * - Força de tração nas rodas: F_trac = (Torque * Relação * Diferencial * Eficiência) / Raio
 * - Limite de aderência do pneu (Atrito de Coulomb): F_grip = mu * N
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

  private speedMs: number = 0 // velocidade linear em m/s
  private accelerationMs2: number = 0
  private surfaceFriction: number = 0.95 // Coeficiente de atrito mu (0.95 asfalto seco, ~0.35 piso molhado/escorregadio)
  private wheelSpeedMs: number = 0

  constructor(config: VehiclePhysicsConfig) {
    this.mass = Math.max(100, config.weight)
    this.wheelRadius = config.wheelDiameter / 2
    this.efficiency = config.isMotorcycle ? 0.93 : 0.90
    this.driveAxleWeightRatio = config.isMotorcycle ? 0.50 : 0.62 // Tração dianteira no Yaris (~62% peso na frente)

    // Constante aerodinâmica 0.5 * rho * Cd * A
    this.aeroConstant = config.isMotorcycle ? 0.25 : 0.40
    this.rollingCoeff = 0.015 // Asfalto típico
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
   */
  getMaxGripTorque(): number {
    const normalForce = this.mass * 9.81 * this.driveAxleWeightRatio
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
    } else {
      this.wheelSpeedMs = this.speedMs
    }

    // 2. Força de Resistência ao Rolamento (Newtons)
    const rollingResistance = this.rollingCoeff * this.mass * 9.81

    // 3. Força de Resistência Aerodinâmica (Newtons: proporcional a v²)
    const aeroResistance = this.aeroConstant * this.speedMs * this.speedMs

    // 4. Força de Frenagem (Newtons: desaceleração máxima de ~1.1G)
    const maxBrakeForce = this.mass * 9.81 * 1.1
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
  }
}
