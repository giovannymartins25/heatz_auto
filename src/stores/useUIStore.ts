import { create } from 'zustand'

type Screen = 'home' | 'simulator'

export interface ActiveKeysState {
  w: boolean
  e: boolean
  q: boolean
  s: boolean
  up: boolean
  down: boolean
  space: boolean
  horn: boolean
  nos: boolean
}

interface UIStoreState {
  /** Tela ativa */
  currentScreen: Screen
  /** Se os controles estão visíveis */
  showControls: boolean
  /** Se as informações do veículo estão visíveis */
  showVehicleInfo: boolean
  /** Modo de visualização no simulador: painel de instrumentos (cluster) ou visão de cabine/pista (cockpit) */
  viewMode: 'cluster' | 'cockpit'
  /** Se o usuário aceitou jogar em modo retrato vertical no celular */
  allowPortraitCockpit: boolean
  /** Teclas do teclado ativas para feedback visual no PC */
  activeKeys: ActiveKeysState
}

interface UIStoreActions {
  setScreen: (screen: Screen) => void
  toggleControls: () => void
  toggleVehicleInfo: () => void
  setViewMode: (mode: 'cluster' | 'cockpit') => void
  setAllowPortraitCockpit: (allowed: boolean) => void
  setActiveKey: (key: keyof ActiveKeysState, pressed: boolean) => void
}

type UIStore = UIStoreState & UIStoreActions

export const useUIStore = create<UIStore>((set) => ({
  currentScreen: 'home',
  showControls: true,
  showVehicleInfo: false,
  viewMode: 'cluster',
  allowPortraitCockpit: false,
  activeKeys: {
    w: false,
    e: false,
    q: false,
    s: false,
    up: false,
    down: false,
    space: false,
    horn: false,
    nos: false,
  },

  setScreen: (screen) => set({ currentScreen: screen }),
  toggleControls: () => set((s) => ({ showControls: !s.showControls })),
  toggleVehicleInfo: () => set((s) => ({ showVehicleInfo: !s.showVehicleInfo })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setAllowPortraitCockpit: (allowed) => set({ allowPortraitCockpit: allowed }),
  setActiveKey: (key, pressed) =>
    set((s) => {
      if (s.activeKeys[key] === pressed) return s
      return {
        activeKeys: {
          ...s.activeKeys,
          [key]: pressed,
        },
      }
    }),
}))

