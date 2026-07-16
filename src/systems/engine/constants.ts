/**
 * Constantes físicas utilizadas na simulação do motor.
 * Valores baseados em engenharia automotiva real.
 */

/** Fator para converter RPM em rad/s: (2π / 60) */
export const RPM_TO_RAD_S = (2 * Math.PI) / 60

/** Fator para converter rad/s em RPM: (60 / 2π) */
export const RAD_S_TO_RPM = 60 / (2 * Math.PI)

/**
 * Raio efetivo do volante do motor para cálculo do momento de inércia.
 * Simplificação: I = massa * raio².
 * Valor de ~0.12m é típico para volantes automotivos.
 */
export const FLYWHEEL_RADIUS = 0.12

/**
 * Coeficiente de atrito interno do motor.
 * Representa perdas por atrito nos pistões, anéis, mancais, etc.
 * Torque de atrito = FRICTION_COEFFICIENT * angularVelocity
 */
export const ENGINE_FRICTION_COEFFICIENT = 0.05

/**
 * Ganho do controlador de marcha lenta.
 * Quanto maior, mais rápido o motor volta ao RPM de idle.
 */
export const IDLE_CONTROLLER_GAIN = 8.0

/**
 * Timestep fixo da simulação física em segundos.
 * 120Hz = 0.008333s — garante estabilidade e precisão.
 */
export const PHYSICS_TIMESTEP = 1 / 120

/**
 * Número máximo de sub-steps por frame.
 * Previne "spiral of death" em dispositivos lentos.
 */
export const MAX_SUBSTEPS = 8
