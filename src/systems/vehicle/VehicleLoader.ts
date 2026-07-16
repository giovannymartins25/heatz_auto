import type { VehicleConfig, VehicleManifest } from '@/types'

/**
 * VehicleLoader — Carregamento de veículos a partir de JSON.
 * 
 * Lê o manifest.json para descobrir veículos disponíveis,
 * e carrega o config.json de cada veículo sob demanda.
 * 
 * Estrutura esperada em /public/vehicles/:
 *   vehicles/
 *     manifest.json
 *     gol-g6/
 *       config.json
 *       thumbnail.png (futuro)
 *       sounds/ (futuro)
 *       dashboard/ (futuro)
 *     cb1000r/
 *       config.json
 *       ...
 */

const MANIFEST_PATH = '/vehicles/manifest.json'

export class VehicleLoader {
  private cache = new Map<string, VehicleConfig>()

  async loadManifest(): Promise<VehicleManifest> {
    const response = await fetch(MANIFEST_PATH)
    if (!response.ok) {
      throw new Error(`Falha ao carregar manifest: ${response.status}`)
    }
    return response.json()
  }

  async loadVehicle(configPath: string): Promise<VehicleConfig> {
    const cached = this.cache.get(configPath)
    if (cached) return cached

    const response = await fetch(configPath)
    if (!response.ok) {
      throw new Error(`Falha ao carregar veículo: ${configPath} (${response.status})`)
    }

    const config: VehicleConfig = await response.json()
    this.cache.set(configPath, config)
    return config
  }

  async loadVehicleById(vehicleId: string): Promise<VehicleConfig> {
    const manifest = await this.loadManifest()
    const entry = manifest.vehicles.find(v => v.id === vehicleId)

    if (!entry) {
      throw new Error(`Veículo não encontrado: ${vehicleId}`)
    }

    return this.loadVehicle(entry.configPath)
  }

  clearCache(): void {
    this.cache.clear()
  }
}

/** Instância singleton do loader */
export const vehicleLoader = new VehicleLoader()
