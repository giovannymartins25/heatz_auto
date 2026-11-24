/**
 * WindowSystem.ts — Sistema determinístico de controle individual de vidros, arrasto e acústica.
 *
 * Responsabilidades:
 * 1. Configurar os vidros disponíveis conforme `VehicleCabinSpec` (`windowCount`: 0, 2 ou 4;
 *    `windowControlType`: 'none' | 'manual_crank' | 'electric').
 * 2. Permitir abertura individual e gradual entre 0% (0.0 = fechado) e 100% (1.0 = aberto).
 * 3. Manter o estado consolidado booleano `windowsOpen` para retrocompatibilidade total.
 * 4. Calcular em ponto único o multiplicador de arrasto aerodinâmico (`aeroDragMultiplier`)
 *    e os parâmetros acústicos da cabine (`cabinNoiseLevel`, `cabinFilterCutoffHz`).
 *
 * NOTA DE CALIBRAÇÃO:
 * Os coeficientes `MAX_AERO_DRAG_PENALTY` (+4.5% CdA com todos os vidros 100% abertos) e taxas
 * de deslocamento (`ELECTRIC_WINDOW_SPEED_PER_SEC`, `CRANK_WINDOW_SPEED_PER_SEC`) são parâmetros
 * calibrados de simulação física, não especificações de fábrica OEM.
 */

import type { VehicleCabinSpec } from '@/types/vehicle'
import { clamp } from '@/utils/math'

export type WindowId = 'front_left' | 'front_right' | 'rear_left' | 'rear_right'

export interface WindowChannelState {
  id: WindowId
  label: string
  /** Abertura atual normalizada [0..1] (0 = 0% fechado, 1 = 100% aberto) */
  position: number
  /** Alvo de abertura para movimento gradual em `tick(dt)` [0..1] */
  targetPosition: number
}

export interface WindowStateSnapshot {
  windowCount: 0 | 2 | 4
  controlType: 'none' | 'manual_crank' | 'electric'
  positions: Record<WindowId, number>
  targets: Record<WindowId, number>
  windowsOpen: boolean
  averageOpenRatio: number
  aeroDragMultiplier: number
  cabinNoiseLevel: number
  cabinFilterCutoffHz: number
}

// ─── Parâmetros Calibrados de Simulação (Não-OEM) ────────────────────────────
export const WINDOW_CALIBRATION = {
  /** Penalidade máxima de arrasto aerodinâmico (CdA) com todos os vidros 100% abertos — [CALIBRAÇÃO] */
  MAX_AERO_DRAG_PENALTY: 0.045,
  /** Velocidade de curso do vidro elétrico (fração por segundo, ~1.4s de 0 a 100%) — [CALIBRAÇÃO] */
  ELECTRIC_WINDOW_SPEED_PER_SEC: 0.72,
  /** Velocidade de curso do vidro a manivela (fração por segundo, ~2.0s de 0 a 100%) — [CALIBRAÇÃO] */
  CRANK_WINDOW_SPEED_PER_SEC: 0.50,
  /** Frequência de corte do filtro passa-baixa da cabine com vidros 100% fechados (Hz) — [CALIBRAÇÃO] */
  CLOSED_CABIN_CUTOFF_HZ: 2200,
  /** Frequência de corte do filtro passa-baixa da cabine com vidros 100% abertos (Hz) — [CALIBRAÇÃO] */
  OPEN_CABIN_CUTOFF_HZ: 14000,
  /** Limiar mínimo de abertura para considerar `windowsOpen = true` — [CALIBRAÇÃO] */
  OPEN_THRESHOLD: 0.05,
} as const

const WINDOW_LABELS: Readonly<Record<WindowId, string>> = {
  front_left: 'Dianteiro Esq. (Motorista)',
  front_right: 'Dianteiro Dir. (Passageiro)',
  rear_left: 'Traseiro Esq.',
  rear_right: 'Traseiro Dir.',
}

export class WindowSystem {
  private readonly windowCount: 0 | 2 | 4
  private readonly controlType: 'none' | 'manual_crank' | 'electric'
  private readonly availableIds: WindowId[]
  private readonly maxAeroDragPenalty: number

  private positions: Record<WindowId, number> = {
    front_left: 0,
    front_right: 0,
    rear_left: 0,
    rear_right: 0,
  }

  private targets: Record<WindowId, number> = {
    front_left: 0,
    front_right: 0,
    rear_left: 0,
    rear_right: 0,
  }

  constructor(
    cabinSpec: Pick<VehicleCabinSpec, 'windowCount' | 'windowControlType'>,
    maxAeroDragPenalty: number = WINDOW_CALIBRATION.MAX_AERO_DRAG_PENALTY,
  ) {
    this.windowCount = cabinSpec.windowCount
    this.controlType = this.windowCount === 0 ? 'none' : cabinSpec.windowControlType
    this.maxAeroDragPenalty = Math.max(0, maxAeroDragPenalty)

    if (this.windowCount === 4) {
      this.availableIds = ['front_left', 'front_right', 'rear_left', 'rear_right']
    } else if (this.windowCount === 2) {
      this.availableIds = ['front_left', 'front_right']
    } else {
      this.availableIds = []
    }
  }

  getWindowCount(): 0 | 2 | 4 {
    return this.windowCount
  }

  getControlType(): 'none' | 'manual_crank' | 'electric' {
    return this.controlType
  }

  getAvailableWindowIds(): WindowId[] {
    return [...this.availableIds]
  }

  hasWindow(id: WindowId): boolean {
    return this.availableIds.includes(id)
  }

  getWindowPosition(id: WindowId): number {
    if (!this.hasWindow(id)) return 0
    return this.positions[id]
  }

  getWindowTarget(id: WindowId): number {
    if (!this.hasWindow(id)) return 0
    return this.targets[id]
  }

  getWindowsList(): WindowChannelState[] {
    return this.availableIds.map((id) => ({
      id,
      label: WINDOW_LABELS[id],
      position: this.positions[id],
      targetPosition: this.targets[id],
    }))
  }

  /**
   * Define imediatamente a abertura de um vidro específico entre 0.0 (0%) e 1.0 (100%).
   * Ignora silenciosamente vidros inexistentes no veículo (ex.: traseiros em cupê/2 portas ou motocicleta).
   */
  setWindowPosition(id: WindowId, openRatio: number): void {
    if (!this.hasWindow(id)) return
    const clamped = clamp(openRatio, 0, 1)
    this.positions[id] = clamped
    this.targets[id] = clamped
  }

  /**
   * Define o alvo de abertura para movimentação contínua gradual em `tick(dt)`.
   */
  setWindowTarget(id: WindowId, targetRatio: number): void {
    if (!this.hasWindow(id)) return
    this.targets[id] = clamp(targetRatio, 0, 1)
  }

  /**
   * Incrementa ou decrementa a abertura de um vidro individual (ex.: botão ou manivela).
   */
  stepWindowPosition(id: WindowId, deltaRatio: number): void {
    if (!this.hasWindow(id)) return
    this.setWindowPosition(id, this.positions[id] + deltaRatio)
  }

  /**
   * Define imediatamente todos os vidros disponíveis para um valor [0..1].
   */
  setAllWindowsPosition(openRatio: number): void {
    const clamped = clamp(openRatio, 0, 1)
    for (const id of this.availableIds) {
      this.positions[id] = clamped
      this.targets[id] = clamped
    }
  }

  /**
   * Define o alvo gradual de todos os vidros disponíveis para [0..1].
   */
  setAllWindowsTarget(targetRatio: number): void {
    const clamped = clamp(targetRatio, 0, 1)
    for (const id of this.availableIds) {
      this.targets[id] = clamped
    }
  }

  /**
   * Compatibilidade com o booleano legado `setWindowsOpen(open: boolean)`.
   */
  setWindowsOpen(open: boolean): void {
    this.setAllWindowsPosition(open ? 1 : 0)
  }

  /**
   * Alterna todos os vidros entre 100% abertos e 100% fechados.
   */
  toggleAllWindows(): boolean {
    if (this.windowCount === 0) return false
    const nextOpen = !this.isWindowsOpen()
    this.setWindowsOpen(nextOpen)
    return nextOpen
  }

  /**
   * Retorna `true` se qualquer vidro disponível estiver aberto acima do limiar (5%).
   */
  isWindowsOpen(): boolean {
    if (this.windowCount === 0) return false
    for (const id of this.availableIds) {
      if (this.positions[id] >= WINDOW_CALIBRATION.OPEN_THRESHOLD) {
        return true
      }
    }
    return false
  }

  /**
   * Razão média de abertura dos vidros instalados no veículo [0..1].
   */
  getAverageOpenRatio(): number {
    if (this.availableIds.length === 0) return 0
    let sum = 0
    for (const id of this.availableIds) {
      sum += this.positions[id]
    }
    return clamp(sum / this.availableIds.length, 0, 1)
  }

  /**
   * Multiplicador de arrasto aerodinâmico (`>= 1.0`).
   * Aplicado em local único (`VehiclePhysics.tick`) para evitar duplicação.
   */
  getAeroDragMultiplier(): number {
    if (this.windowCount === 0) return 1.0
    const avgOpen = this.getAverageOpenRatio()
    return 1.0 + avgOpen * this.maxAeroDragPenalty
  }

  /**
   * Nível normalizado de ruído interno da cabine [0..1] (0 = isolamento máximo, 1 = aberto).
   */
  getCabinNoiseLevel(): number {
    if (this.windowCount === 0) return 1.0
    return clamp(0.18 + this.getAverageOpenRatio() * 0.82, 0.18, 1.0)
  }

  /**
   * Frequência de corte do filtro passa-baixa acústico da cabine (2200 Hz fechado -> 14000 Hz aberto).
   */
  getCabinFilterCutoffHz(): number {
    if (this.windowCount === 0) return WINDOW_CALIBRATION.OPEN_CABIN_CUTOFF_HZ
    const avgOpen = this.getAverageOpenRatio()
    return Math.round(
      WINDOW_CALIBRATION.CLOSED_CABIN_CUTOFF_HZ +
        avgOpen * (WINDOW_CALIBRATION.OPEN_CABIN_CUTOFF_HZ - WINDOW_CALIBRATION.CLOSED_CABIN_CUTOFF_HZ),
    )
  }

  /**
   * Evolução determinística a 120 Hz da abertura gradual dos vidros em direção a `targets`.
   */
  tick(deltaTime: number): WindowStateSnapshot {
    const dt = Math.max(0, deltaTime)
    if (this.windowCount > 0 && dt > 0) {
      const rate =
        this.controlType === 'electric'
          ? WINDOW_CALIBRATION.ELECTRIC_WINDOW_SPEED_PER_SEC
          : WINDOW_CALIBRATION.CRANK_WINDOW_SPEED_PER_SEC
      const maxStep = rate * dt

      for (const id of this.availableIds) {
        const current = this.positions[id]
        const target = this.targets[id]
        const diff = target - current
        if (Math.abs(diff) > 1e-6) {
          this.positions[id] =
            Math.abs(diff) <= maxStep ? target : clamp(current + Math.sign(diff) * maxStep, 0, 1)
        }
      }
    }
    return this.getStateSnapshot()
  }

  reset(): void {
    for (const id of ['front_left', 'front_right', 'rear_left', 'rear_right'] as WindowId[]) {
      this.positions[id] = 0
      this.targets[id] = 0
    }
  }

  getStateSnapshot(): WindowStateSnapshot {
    return {
      windowCount: this.windowCount,
      controlType: this.controlType,
      positions: { ...this.positions },
      targets: { ...this.targets },
      windowsOpen: this.isWindowsOpen(),
      averageOpenRatio: this.getAverageOpenRatio(),
      aeroDragMultiplier: this.getAeroDragMultiplier(),
      cabinNoiseLevel: this.getCabinNoiseLevel(),
      cabinFilterCutoffHz: this.getCabinFilterCutoffHz(),
    }
  }

  restoreSnapshot(snapshot: WindowStateSnapshot): void {
    this.positions = { ...snapshot.positions }
    this.targets = { ...snapshot.targets }
  }
}
