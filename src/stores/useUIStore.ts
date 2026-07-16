import { create } from 'zustand'

type Screen = 'home' | 'simulator'

interface UIStoreState {
  /** Tela ativa */
  currentScreen: Screen
  /** Se os controles estão visíveis */
  showControls: boolean
  /** Se as informações do veículo estão visíveis */
  showVehicleInfo: boolean
}

interface UIStoreActions {
  setScreen: (screen: Screen) => void
  toggleControls: () => void
  toggleVehicleInfo: () => void
}

type UIStore = UIStoreState & UIStoreActions

export const useUIStore = create<UIStore>((set) => ({
  currentScreen: 'home',
  showControls: true,
  showVehicleInfo: false,

  setScreen: (screen) => set({ currentScreen: screen }),
  toggleControls: () => set((s) => ({ showControls: !s.showControls })),
  toggleVehicleInfo: () => set((s) => ({ showVehicleInfo: !s.showVehicleInfo })),
}))
