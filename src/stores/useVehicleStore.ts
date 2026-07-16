import { create } from 'zustand'
import type { VehicleConfig, VehicleManifestEntry } from '@/types'
import { vehicleLoader } from '@/systems/vehicle/VehicleLoader'

interface VehicleStoreState {
  /** Lista de veículos disponíveis (do manifest) */
  vehicleList: VehicleManifestEntry[]
  /** Veículo atualmente selecionado/carregado */
  selectedVehicle: VehicleConfig | null
  /** ID do veículo selecionado */
  selectedId: string | null
  /** Estado de carregamento */
  isLoading: boolean
  /** Mensagem de erro */
  error: string | null
}

interface VehicleStoreActions {
  /** Carrega a lista de veículos do manifest */
  loadVehicleList: () => Promise<void>
  /** Seleciona e carrega um veículo por ID */
  selectVehicle: (vehicleId: string) => Promise<VehicleConfig | null>
  /** Limpa a seleção */
  clearSelection: () => void
}

type VehicleStore = VehicleStoreState & VehicleStoreActions

export const useVehicleStore = create<VehicleStore>((set) => ({
  vehicleList: [],
  selectedVehicle: null,
  selectedId: null,
  isLoading: false,
  error: null,

  loadVehicleList: async () => {
    set({ isLoading: true, error: null })
    try {
      const manifest = await vehicleLoader.loadManifest()
      set({ vehicleList: manifest.vehicles, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Erro ao carregar veículos',
        isLoading: false,
      })
    }
  },

  selectVehicle: async (vehicleId: string) => {
    set({ isLoading: true, error: null, selectedId: vehicleId })
    try {
      const config = await vehicleLoader.loadVehicleById(vehicleId)
      set({ selectedVehicle: config, isLoading: false })
      return config
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Erro ao carregar veículo',
        isLoading: false,
        selectedVehicle: null,
      })
      return null
    }
  },

  clearSelection: () => {
    set({ selectedVehicle: null, selectedId: null })
  },
}))
