/**
 * HEATZ AUTO — FASE 1.6.1: SISTEMA DE CHASSI E CENTRO DE MASSA
 * 
 * Centralização física e dimensional da distribuição de massas do veículo.
 * Todas as grandezas utilizam estritamente o Sistema Internacional de Unidades (SI):
 * - Massa: kg
 * - Comprimento / Distâncias: m
 * - Tempo: s
 * - Força: N
 * - Aceleração: m/s²
 * - Inércia rotacional: kg·m²
 */

import { clamp } from '@/utils/math'

/**
 * Interface tipada para configuração física de chassi e distribuição de massa.
 */
export interface ChassisConfig {
  /** Massa total do veículo em repouso [kg] */
  totalMass: number
  /** Distância entre eixos (Wheelbase) [m] */
  wheelbase: number
  /** Altura do centro de massa em relação ao plano do solo (h_cg) [m] */
  centerOfMassHeight: number
  /** Proporção estática de peso no eixo dianteiro (d_f) [0..1, adimensional] */
  frontWeightRatio: number
  /** Raio dinâmico efetivo da roda sob carga (r_w) [m] */
  wheelRadius: number
  /** Momento de inércia rotacional de cada conjunto roda/pneu (I_w) [kg·m²] */
  wheelInertia: number
  /** Número de rodas no solo (4 para automóveis, 2 para motocicletas) */
  wheelCount?: number
  /** Aceleração da gravidade local (g) [m/s²] (padrão: 9.81 m/s²) */
  gravity?: number
  /** Batente de carga normal mínima por eixo [N] para evitar singularidades (padrão: 50 N) */
  minAxleLoad?: number
  /** Sinaliza se os parâmetros contêm estimativas provisórias de engenharia */
  isProvisional?: boolean
  /** Notas de engenharia ou calibração */
  notes?: string
}

/**
 * Distribuição de cargas normais por eixo e por roda.
 */
export interface AxleLoads {
  /** Carga normal total no eixo dianteiro [N] */
  frontAxleLoad: number
  /** Carga normal total no eixo traseiro [N] */
  rearAxleLoad: number
  /** Carga normal por roda dianteira [N] */
  frontWheelLoad: number
  /** Carga normal por roda traseira [N] */
  rearWheelLoad: number
  /** Força peso total do veículo (W = m * g) [N] */
  totalWeight: number
}

/**
 * Resultado do cálculo dinâmico de transferência de carga longitudinal.
 */
export interface DynamicLoadResult extends AxleLoads {
  /** Transferência dinâmica de carga do eixo dianteiro para o traseiro [N] (positivo na aceleração) */
  loadTransferN: number
  /** Aceleração longitudinal considerada [m/s²] */
  accelerationX: number
}

/**
 * Classe física responsável pela representação de chassi, centro de massa
 * e equilíbrio quase-estático de forças normais.
 */
export class VehicleChassis {
  public readonly totalMass: number
  public readonly wheelbase: number
  public readonly centerOfMassHeight: number
  public readonly frontWeightRatio: number
  public readonly rearWeightRatio: number
  public readonly distanceCgToFrontAxle: number // a [m]
  public readonly distanceCgToRearAxle: number  // b [m]
  public readonly wheelRadius: number
  public readonly wheelInertia: number
  public readonly wheelCount: number
  public readonly wheelsPerAxle: number
  public readonly gravity: number
  public readonly minAxleLoad: number
  public readonly isProvisional: boolean
  public readonly notes?: string

  constructor(config: ChassisConfig) {
    if (config.totalMass <= 0) {
      throw new Error(`[VehicleChassis] Massa total inválida: ${config.totalMass} kg (deve ser > 0)`)
    }
    if (config.wheelbase <= 0) {
      throw new Error(`[VehicleChassis] Wheelbase inválido: ${config.wheelbase} m (deve ser > 0)`)
    }
    if (config.centerOfMassHeight <= 0) {
      throw new Error(`[VehicleChassis] Altura do CG inválida: ${config.centerOfMassHeight} m (deve ser > 0)`)
    }
    if (config.frontWeightRatio <= 0 || config.frontWeightRatio >= 1) {
      throw new Error(`[VehicleChassis] Distribuição de peso dianteiro inválida: ${config.frontWeightRatio} (deve estar entre 0 e 1)`)
    }
    if (config.wheelRadius <= 0) {
      throw new Error(`[VehicleChassis] Raio de roda inválido: ${config.wheelRadius} m (deve ser > 0)`)
    }
    if (config.wheelInertia <= 0) {
      throw new Error(`[VehicleChassis] Inércia de roda inválida: ${config.wheelInertia} kg·m² (deve ser > 0)`)
    }

    this.totalMass = config.totalMass
    this.wheelbase = config.wheelbase
    this.centerOfMassHeight = config.centerOfMassHeight
    this.frontWeightRatio = config.frontWeightRatio
    this.rearWeightRatio = 1 - config.frontWeightRatio

    // Relações geométricas fundamentais do chassi:
    // b = d_f * L (distância do CG até o eixo traseiro)
    // a = d_r * L = (1 - d_f) * L (distância do CG até o eixo dianteiro)
    // a + b = (d_r + d_f) * L = L
    this.distanceCgToRearAxle = this.frontWeightRatio * this.wheelbase
    this.distanceCgToFrontAxle = this.rearWeightRatio * this.wheelbase

    this.wheelRadius = config.wheelRadius
    this.wheelInertia = config.wheelInertia
    this.wheelCount = config.wheelCount ?? 4
    this.wheelsPerAxle = Math.max(1, this.wheelCount / 2)
    this.gravity = config.gravity ?? 9.81
    this.minAxleLoad = config.minAxleLoad ?? 50
    this.isProvisional = config.isProvisional ?? false
    this.notes = config.notes
  }

  /**
   * Força peso total do veículo: W = m * g [N].
   */
  getTotalWeight(): number {
    return this.totalMass * this.gravity
  }

  /**
   * Cargas estáticas em repouso sobre piso plano horizontal (a_x = 0).
   * Satisfaz estritamente o equilíbrio estático:
   * F_zf0 + F_zr0 = W
   */
  getStaticAxleLoads(): AxleLoads {
    const totalWeight = this.getTotalWeight()
    const frontAxleLoad = totalWeight * this.frontWeightRatio
    const rearAxleLoad = totalWeight * this.rearWeightRatio

    return {
      frontAxleLoad,
      rearAxleLoad,
      frontWheelLoad: frontAxleLoad / this.wheelsPerAxle,
      rearWheelLoad: rearAxleLoad / this.wheelsPerAxle,
      totalWeight,
    }
  }

  /**
   * Cargas dinâmicas por eixo sob aceleração longitudinal a_x [m/s²].
   * 
   * Modelo quase-estático de transferência de carga por D'Alembert:
   * Delta_Fz = (m * h_cg / L) * a_x
   * 
   * - Em aceleração (a_x > 0): carga migra da dianteira para a traseira.
   * - Em frenagem (a_x < 0): carga migra da traseira para a dianteira.
   * 
   * Possui clamp em batente seguro [minAxleLoad, W - minAxleLoad] para impedir
   * cargas normais negativas (decolagem de eixo) e garantir conservação estrita:
   * F_zf + F_zr = W = m * g.
   */
  getDynamicAxleLoads(accelerationX: number): DynamicLoadResult {
    const totalWeight = this.getTotalWeight()
    const staticLoads = this.getStaticAxleLoads()

    // Transferência longitudinal de carga em Newtons
    const rawDeltaFz = (this.totalMass * this.centerOfMassHeight / this.wheelbase) * accelerationX

    // Limites de segurança física para o eixo dianteiro
    const minFront = this.minAxleLoad
    const maxFront = totalWeight - this.minAxleLoad

    const clampedFrontAxle = clamp(staticLoads.frontAxleLoad - rawDeltaFz, minFront, maxFront)
    const clampedRearAxle = totalWeight - clampedFrontAxle // Preserva exatamente a soma = totalWeight
    const effectiveDeltaFz = staticLoads.frontAxleLoad - clampedFrontAxle

    return {
      frontAxleLoad: clampedFrontAxle,
      rearAxleLoad: clampedRearAxle,
      frontWheelLoad: clampedFrontAxle / this.wheelsPerAxle,
      rearWheelLoad: clampedRearAxle / this.wheelsPerAxle,
      totalWeight,
      loadTransferN: effectiveDeltaFz,
      accelerationX,
    }
  }
}

/**
 * Banco de parâmetros físicos centralizados para os 8 veículos do HEATZ AUTO.
 * 
 * Preserva estritamente os pesos e diâmetros de rodas já homologados nos arquivos de configuração,
 * integrando dimensões de entre-eixos, distribuição estática e altura de CG com rastreabilidade.
 */
export const VEHICLE_CHASSIS_DATABASE: Record<string, ChassisConfig> = {
  'golf-gti': {
    totalMass: 1351,
    wheelbase: 2.631,
    centerOfMassHeight: 0.51,
    frontWeightRatio: 0.62,
    wheelRadius: 0.64 / 2, // 0.32 m
    wheelInertia: 1.20,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: false,
    notes: 'Volkswagen Golf GTI Mk7 2.0 TSI (Plataforma MQB FWD)',
  },
  'porsche-gt3': {
    totalMass: 1500,
    wheelbase: 2.457,
    centerOfMassHeight: 0.44,
    frontWeightRatio: 0.39, // Motor traseiro RR: 39% frente / 61% traseira
    wheelRadius: 0.68 / 2,  // 0.34 m
    wheelInertia: 1.35,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: false,
    notes: 'Porsche 911 (992) GT3 / Bi-Turbo (Layout RR)',
  },
  'civic-si': {
    totalMass: 1300,
    wheelbase: 2.700,
    centerOfMassHeight: 0.50,
    frontWeightRatio: 0.60,
    wheelRadius: 0.64 / 2, // 0.32 m
    wheelInertia: 1.15,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: false,
    notes: 'Honda Civic Si 2.0 i-VTEC K20Z3 FWD',
  },
  'gol-g6': {
    totalMass: 1075,
    wheelbase: 2.465,
    centerOfMassHeight: 0.53,
    frontWeightRatio: 0.63,
    wheelRadius: 0.59 / 2, // 0.295 m
    wheelInertia: 1.05,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: false,
    notes: 'Volkswagen Gol G6 1.6 MSI (Plataforma PQ24 FWD)',
  },
  'gol-quadrado-turbo': {
    totalMass: 950,
    wheelbase: 2.358,
    centerOfMassHeight: 0.52,
    frontWeightRatio: 0.64, // Motor AP longitudinal montado à frente do eixo dianteiro
    wheelRadius: 0.62 / 2,  // 0.31 m
    wheelInertia: 1.00,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: true,
    notes: 'Volkswagen Gol Quadrado 1.9 AP Turbo (BX Longitudinal FWD - Parâmetros Provisórios)',
  },
  'opala-4100': {
    totalMass: 1360,
    wheelbase: 2.667,
    centerOfMassHeight: 0.54,
    frontWeightRatio: 0.54, // Motor Chevrolet 250-S 6 cilindros em ferro fundido FR
    wheelRadius: 0.65 / 2,  // 0.325 m
    wheelInertia: 1.25,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: true,
    notes: 'Chevrolet Opala Diplomata 4.1 6cc RWD (Parâmetros Provisórios)',
  },
  'yaris-2019': {
    totalMass: 1130,
    wheelbase: 2.550,
    centerOfMassHeight: 0.52,
    frontWeightRatio: 0.62,
    wheelRadius: 0.60 / 2, // 0.30 m
    wheelInertia: 1.05,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: false,
    notes: 'Toyota Yaris 1.5 XLS CVT (Plataforma XP150 FWD)',
  },
  'cb1000r': {
    totalMass: 212,
    wheelbase: 1.455,
    centerOfMassHeight: 0.55,
    frontWeightRatio: 0.50, // 50% frente / 50% traseira em repouso
    wheelRadius: 0.63 / 2,  // 0.315 m
    wheelInertia: 0.65,
    wheelCount: 2,          // Motocicleta (2 rodas)
    gravity: 9.81,
    isProvisional: false,
    notes: 'Honda CB1000R Neo Sports Café (Motocicleta 2-DOF/5-DOF)',
  },
  'fiat-toro-endurance-2025': {
    totalMass: 1650,
    wheelbase: 2.990,
    centerOfMassHeight: 0.65,
    frontWeightRatio: 0.60,
    wheelRadius: 0.686 / 2, // 0.343 m (215/65 R16)
    wheelInertia: 1.30,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: false,
    notes: 'Fiat Toro Endurance 1.3 Turbo 270 Flex AT6 2025 (FWD 4x2)',
  },
  'fiat-toro-ranch-2025': {
    totalMass: 1910,
    wheelbase: 2.990,
    centerOfMassHeight: 0.68,
    frontWeightRatio: 0.56,
    wheelRadius: 0.700 / 2, // 0.350 m (225/60 R18)
    wheelInertia: 1.40,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: false,
    notes: 'Fiat Toro Ranch 2.2 Turbo Diesel 4x4 AT9 2025 (AWD/4WD sob demanda e Reduzida 4WD LOW)',
  },
  'jetta-gli-2021': {
    totalMass: 1432,
    wheelbase: 2.680,
    centerOfMassHeight: 0.51,
    frontWeightRatio: 0.61, // Sedã MQB 2.0 TSI transversal dianteiro (estimativa de engenharia)
    wheelRadius: 0.660 / 2, // 0.330 m (225/45 R18)
    wheelInertia: 1.24,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: false,
    notes: 'Volkswagen Jetta GLI 350 TSI 2021 (Plataforma MQB FWD, Multilink traseiro)',
  },
  'bmw-320i-msport-2024': {
    totalMass: 1460,
    wheelbase: 2.851,
    centerOfMassHeight: 0.49,
    frontWeightRatio: 0.50, // Distribuição 50/50 nominal da plataforma CLAR G20 RWD
    wheelRadius: 0.663 / 2, // 0.3315 m (225/40 R19 / 255/35 R19)
    wheelInertia: 1.28,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: false,
    notes: 'BMW 320i M Sport 2.0 ActiveFlex 2024 (G20 LCI RWD, ZF 8HP)',
  },
  'ford-pampa-l-1997': {
    totalMass: 1040,
    wheelbase: 2.578,
    centerOfMassHeight: 0.57,
    frontWeightRatio: 0.62, // Motor AP-1800i longitudinal dianteiro + caçamba descarregada (estimativa de engenharia)
    wheelRadius: 0.561 / 2, // 0.2805 m (165/70 R13)
    wheelInertia: 0.96,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: true,
    notes: 'Ford Pampa L 1.8i CFI 1997 (Picape leve FWD derivada do Corcel II/Del Rey)',
  },
  'ford-fusion-sel-2012': {
    totalMass: 1520,
    wheelbase: 2.728,
    centerOfMassHeight: 0.53,
    frontWeightRatio: 0.61, // Sedã CD338 2.5 Duratec transversal FWD
    wheelRadius: 0.657 / 2, // 0.3285 m (225/50 R17)
    wheelInertia: 1.26,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: false,
    notes: 'Ford Fusion SEL 2.5 16V AT6 2012 (CD338 FWD)',
  },
  'ford-fusion-titanium-awd-2019': {
    totalMass: 1691,
    wheelbase: 2.850,
    centerOfMassHeight: 0.53,
    frontWeightRatio: 0.57, // Sedã CD391 2.0 EcoBoost com PTU + diferencial traseiro Intelligent AWD
    wheelRadius: 0.669 / 2, // 0.3345 m (235/45 R18)
    wheelInertia: 1.32,
    wheelCount: 4,
    gravity: 9.81,
    isProvisional: false,
    notes: 'Ford Fusion Titanium 2.0 EcoBoost AWD AT6 2019 (CD391 Intelligent AWD sob demanda)',
  },
}

/**
 * Cria ou recupera uma instância de VehicleChassis com base no ID do veículo ou configuração customizada.
 * Fornece fallback seguro para compatibilidade retroativa caso apenas peso e diâmetro sejam conhecidos.
 */
export function createVehicleChassis(
  vehicleIdOrConfig?: string | ChassisConfig,
  fallbackConfig?: { weight: number; wheelDiameter: number; isMotorcycle?: boolean }
): VehicleChassis {
  if (typeof vehicleIdOrConfig === 'string') {
    const knownConfig = VEHICLE_CHASSIS_DATABASE[vehicleIdOrConfig]
    if (knownConfig) {
      return new VehicleChassis(knownConfig)
    }
  } else if (vehicleIdOrConfig && typeof vehicleIdOrConfig === 'object') {
    return new VehicleChassis(vehicleIdOrConfig)
  }

  // Fallback baseado nos parâmetros básicos existentes
  const isMoto = fallbackConfig?.isMotorcycle ?? false
  const mass = Math.max(50, fallbackConfig?.weight ?? 1200)
  const diameter = Math.max(0.2, fallbackConfig?.wheelDiameter ?? 0.62)

  const fallbackChassis: ChassisConfig = {
    totalMass: mass,
    wheelbase: isMoto ? 1.45 : 2.60,
    centerOfMassHeight: isMoto ? 0.55 : 0.52,
    frontWeightRatio: isMoto ? 0.50 : 0.62,
    wheelRadius: diameter / 2,
    wheelInertia: isMoto ? 0.65 : 1.15,
    wheelCount: isMoto ? 2 : 4,
    gravity: 9.81,
    isProvisional: true,
    notes: 'Chassis fallback gerado automaticamente a partir de peso e diâmetro básicos',
  }

  return new VehicleChassis(fallbackChassis)
}
