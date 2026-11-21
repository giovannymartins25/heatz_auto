import { clamp } from '@/utils/math'
import { RAD_S_TO_RPM } from '../engine/constants'

export type ClutchMechanicalState = 'OPEN' | 'SLIPPING' | 'LOCKED'

export interface ClutchState {
  position: number            // 0 = pedal solto / acoplada, 1 = pedal pressionado / desacoplada
  engagement: number          // 0 = livre/desacoplada, 1 = 100% acoplada
  isSlipping: boolean         // true se houver patinação ativa sob carga
  transmittedTorque: number   // Nm transmitido para o eixo da transmissão
  loadTorqueOnEngine: number  // Nm de carga resistiva imposta ao volante do motor
  slipRpm: number             // diferença de rotação (RPM) entre motor e transmissão
  slipRatio: number           // razão relativa de patinamento (0 a 1)
  heat: number                // energia térmica acumulada em kJ
  mechanicalState: ClutchMechanicalState // OPEN | SLIPPING | LOCKED
}

/**
 * ClutchSystem — Modelo físico de acoplamento mecânico por atrito de Coulomb em 3 estados (OPEN, SLIPPING, LOCKED).
 *
 * Características físicas rigorosas:
 * 1. Estado OPEN: Desacoplamento total, tau = 0.
 * 2. Estado SLIPPING: Deslizamento com atrito cinético regularizado a 120 Hz, dissipação térmica irreversível.
 * 3. Estado LOCKED: Vínculo cinemático rígido com Delta_omega = 0, transmitindo torque
 *    bidirecional (aceleração positiva e freio-motor negativo) sem perdas numéricas.
 * 4. Conservação de Momento Angular na sincronização com conversão de energia residual em calor.
 * 5. Histerese de descolamento estático (Breakaway) para estabilidade temporal a 120 Hz.
 */
export class ClutchSystem {
  private position: number = 0 // 0 a 1 (0 = solta/acoplada, 1 = pressionada/desacoplada)
  private maxTorqueCapacity: number
  private heat: number = 0 // Calor acumulado em kJ
  private mechanicalState: ClutchMechanicalState = 'LOCKED'

  // Parâmetros de inércia rotacional para acoplamento dinâmico
  private engineInertia: number = 0.22 // kg·m² (volante + virabrequim)
  private shaftInertia: number = 0.08  // kg·m² (árvore primária + engrenagens)
  private readonly baseTorqueCapacity: number
  private coolingRate: number = 0.035
  private isCeramic: boolean = false

  constructor(maxEngineTorque: number, engineInertia?: number, shaftInertia?: number) {
    // Capacidade de atrito do disco (~1.4x o torque máximo do motor para margem estática segura)
    this.maxTorqueCapacity = Math.max(50, maxEngineTorque * 1.4)
    this.baseTorqueCapacity = this.maxTorqueCapacity
    if (engineInertia) this.engineInertia = engineInertia
    if (shaftInertia) this.shaftInertia = shaftInertia
  }

  /** Atualiza capacidades para upgrades (ex: embreagem de alta performance / cerâmica) */
  setTorqueCapacityMultiplier(multiplier: number): void {
    this.maxTorqueCapacity = this.baseTorqueCapacity * Math.max(1.0, multiplier)
  }

  /** Configura se a embreagem é cerâmica de alta performance (+75% capacidade de torque e +50% dissipação térmica) */
  setCeramicClutch(isCeramic: boolean): void {
    this.isCeramic = isCeramic
    if (isCeramic) {
      this.maxTorqueCapacity = this.baseTorqueCapacity * 1.75
      this.coolingRate = 0.055
    } else {
      this.maxTorqueCapacity = this.baseTorqueCapacity
      this.coolingRate = 0.035
    }
  }

  getMaxTorqueCapacity(): number {
    return this.maxTorqueCapacity
  }

  getBaseTorqueCapacity(): number {
    return this.baseTorqueCapacity
  }

  isCeramicClutch(): boolean {
    return this.isCeramic
  }

  /** Define a posição do pedal/manete de embreagem (0 a 1) */
  setPosition(pos: number): void {
    this.position = clamp(pos, 0, 1)
  }

  getPosition(): number {
    return this.position
  }

  getMechanicalState(): ClutchMechanicalState {
    return this.mechanicalState
  }

  /**
   * Retorna o fator de acoplamento mecânico (1 = 100% acoplada, 0 = desacoplada).
   * Curva progressiva não-linear realista com folga inicial e zona de atrito (0.15 a 0.85).
   */
  getEngagement(): number {
    if (this.position <= 0.15) return 1.0
    if (this.position >= 0.85) return 0.0

    const normalized = (0.85 - this.position) / 0.70
    return Math.pow(normalized, 1.4)
  }

  getHeat(): number {
    return this.heat
  }

  /**
   * Calcula a transferência física de torque entre motor e transmissão a 120 Hz.
   */
  calculateTorqueTransfer(
    engineAngularVelocity: number,
    transmissionAngularVelocity: number,
    isInNeutral: boolean,
    engineTorque: number = 0,
    deltaTime: number = 1 / 120,
    resistiveLoadTorque: number = 0,
  ): ClutchState {
    const engagement = this.getEngagement()
    const engineRpm = Math.max(0, engineAngularVelocity * RAD_S_TO_RPM)
    const transRpm = Math.max(0, transmissionAngularVelocity * RAD_S_TO_RPM)
    const deltaOmega = engineAngularVelocity - transmissionAngularVelocity
    const slipRpm = isInNeutral ? 0 : Math.abs(engineRpm - transRpm)
    const slipRatio = clamp(slipRpm / Math.max(engineRpm, transRpm, 150), 0, 1)

    // 1. ESTADO OPEN: Desacoplamento ou Ponto Morto
    if (isInNeutral || engagement <= 0.01) {
      this.mechanicalState = 'OPEN'
      this.coolDown(deltaTime)
      return {
        position: this.position,
        engagement: 0,
        isSlipping: false,
        transmittedTorque: 0,
        loadTorqueOnEngine: 0,
        slipRpm: 0,
        slipRatio: 0,
        heat: this.heat,
        mechanicalState: 'OPEN',
      }
    }

    // Capacidades de torque: estática (com folga de histerese 15%) e cinética
    const kineticCapacity = this.maxTorqueCapacity * engagement
    const staticCapacity = kineticCapacity * 1.15

    const deltaOmegaLockThreshold = 12.0 // rad/s (~115 RPM)

    // 2. MÁQUINA DE ESTADOS DO ACOPLAMENTO: OPEN, SLIPPING, LOCKED
    if (this.mechanicalState === 'LOCKED') {
      // Verifica condição de descolamento estático (Breakaway)
      if (Math.abs(engineTorque) > staticCapacity || engagement < 0.75) {
        this.mechanicalState = 'SLIPPING'
      }
    } else {
      // De OPEN ou SLIPPING: verifica transição para LOCKED
      if (Math.abs(deltaOmega) <= deltaOmegaLockThreshold && engagement >= 0.80 && Math.abs(engineTorque) <= staticCapacity) {
        this.mechanicalState = 'LOCKED'

        // Conservação de Momento Angular e dissipação de energia residual da sincronização
        const I_e = this.engineInertia
        const I_s = this.shaftInertia
        const totalInertia = I_e + I_s
        const dissipatedKineticEnergyJ =
          0.5 * ((I_e * I_s) / totalInertia) * (deltaOmega * deltaOmega)
        this.heat += dissipatedKineticEnergyJ / 1000 // Converte para kJ
      }
    }

    let transmittedTorque: number
    let loadTorqueOnEngine: number
    let isSlipping = false

    if (this.mechanicalState === 'LOCKED') {
      // Estado LOCKED: Vínculo cinemático rígido bidirecional (tração e freio motor)
      transmittedTorque = engineTorque
      loadTorqueOnEngine = engineTorque
      isSlipping = false
    } else {
      // Estado SLIPPING: Atrito dinâmico de Coulomb regularizado a 120 Hz
      this.mechanicalState = 'SLIPPING'
      isSlipping = slipRpm > 30

      // Regularização física viscosa-Coulomb contínua a 120 Hz (evita degrau rígido em baixa rotação)
      const K_friction = 3.2
      const dynamicFrictionTorque = clamp(deltaOmega * K_friction * engagement, -kineticCapacity, kineticCapacity)

      // Em aceleração normal ou freio motor com escorregamento
      if (engineTorque < 0 && transmissionAngularVelocity > 1.0) {
        // Freio motor sob desaceleração
        transmittedTorque = clamp(engineTorque * engagement, -kineticCapacity, 0)
        loadTorqueOnEngine = Math.min(0, dynamicFrictionTorque)
      } else {
        // 3ª Lei de Newton no trem de força: quando o limite de aderência refletido pelo
        // câmbio (resistiveLoadTorque > 0) é menor que a capacidade do disco, as rodas patinam
        // e não conseguem reagir com torque superior ao limite de tração + inércia rotacional.
        const effectiveFrictionTorque =
          resistiveLoadTorque > 0 && dynamicFrictionTorque > 0
            ? Math.min(dynamicFrictionTorque, resistiveLoadTorque)
            : dynamicFrictionTorque
        transmittedTorque = Math.max(0, effectiveFrictionTorque)
        loadTorqueOnEngine = effectiveFrictionTorque
      }

      // Potência térmica dissipada por atrito contínuo: P = tau * |deltaOmega|
      const frictionPowerWatts = Math.abs(dynamicFrictionTorque * deltaOmega)
      const heatIncrementKj = (frictionPowerWatts * 0.00008) * deltaTime
      this.heat = Math.min(600, this.heat + heatIncrementKj)
    }

    this.coolDown(deltaTime)

    return {
      position: this.position,
      engagement,
      isSlipping,
      transmittedTorque,
      loadTorqueOnEngine,
      slipRpm,
      slipRatio,
      heat: this.heat,
      mechanicalState: this.mechanicalState,
    }
  }

  private coolDown(deltaTime: number): void {
    if (this.heat > 0) {
      this.heat = Math.max(0, this.heat - (this.heat * this.coolingRate + 0.01) * deltaTime)
    }
  }

  reset(): void {
    this.position = 0
    this.heat = 0
    this.mechanicalState = 'LOCKED'
  }

  getStateSnapshot(): ClutchSnapshot {
    return {
      position: this.position,
      heat: this.heat,
      mechanicalState: this.mechanicalState,
    }
  }

  restoreSnapshot(snapshot: ClutchSnapshot): void {
    this.position = snapshot.position
    this.heat = snapshot.heat
    if (snapshot.mechanicalState) {
      this.mechanicalState = snapshot.mechanicalState
    }
  }
}

export interface ClutchSnapshot {
  position: number
  heat: number
  mechanicalState?: ClutchMechanicalState
}
