import { create } from 'zustand'

type Screen = 'home' | 'simulator'
export type MapViewportSize = 'hidden' | 'compact' | 'balanced' | 'expanded' | 'fullscreen'
export type GraphicProfile = 'eco' | 'normal' | 'high'
export type CockpitPanelId = 'cluster' | 'multimedia' | 'controls'
export type DesktopSecondaryPanelId = 'multimedia' | 'controls'

const STORAGE_SHOW_TILT_INDICATOR_KEY = 'heatz_show_tilt_indicator'

function getInitialShowTiltIndicator(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const saved = localStorage.getItem(STORAGE_SHOW_TILT_INDICATOR_KEY)
    if (saved === null) return true
    return saved === 'true'
  } catch {
    return true
  }
}

export interface ActiveKeysState {
  w: boolean
  a: boolean
  d: boolean
  e: boolean
  q: boolean
  s: boolean
  up: boolean
  down: boolean
  space: boolean
  horn: boolean
  map: boolean
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
  /** Tamanho do espaço reservado ao futuro mapa de direção. */
  mapViewportSize: MapViewportSize
  /** Se o minimapa 2D dirigível está visível no cockpit */
  isMapOpen: boolean
  /** Se o Mapa do Mundo em visão ampla (overlay dedicado) está aberto */
  isWorldMapOpen: boolean
  /** Perfil de desempenho visual e renderização mobile (ECO / NORMAL / ALTO) */
  graphicProfile: GraphicProfile
  /** Exibir HUD diagnóstico interno de desempenho (FPS, frame time, P95, física) */
  showPerformanceMonitor: boolean
  /** Exibir indicador visual de inclinação do smartphone no HUD mobile (padrão: true) */
  showTiltIndicator: boolean
  /** Painel ativo no carrossel modular de 3 painéis (preservado ao redimensionar portrait ↔ landscape) */
  activeCockpitPanel: CockpitPanelId
  /** Painel secundário ativo no layout desktop (multimídia ou controles) */
  desktopSecondaryPanel: DesktopSecondaryPanelId
  /** Teclas do teclado ativas para feedback visual no PC */
  activeKeys: ActiveKeysState
}

interface UIStoreActions {
  setScreen: (screen: Screen) => void
  toggleControls: () => void
  toggleVehicleInfo: () => void
  setViewMode: (mode: 'cluster' | 'cockpit') => void
  setAllowPortraitCockpit: (allowed: boolean) => void
  setMapViewportSize: (size: MapViewportSize) => void
  toggleMap: () => void
  setMapOpen: (open: boolean) => void
  openWorldMap: () => void
  closeWorldMap: () => void
  toggleWorldMap: () => void
  setGraphicProfile: (profile: GraphicProfile) => void
  togglePerformanceMonitor: () => void
  setShowTiltIndicator: (show: boolean) => void
  setActiveCockpitPanel: (panel: CockpitPanelId) => void
  setDesktopSecondaryPanel: (panel: DesktopSecondaryPanelId) => void
  setActiveKey: (key: keyof ActiveKeysState, pressed: boolean) => void
}

type UIStore = UIStoreState & UIStoreActions

export const useUIStore = create<UIStore>((set) => ({
  currentScreen: 'home',
  showControls: true,
  showVehicleInfo: false,
  viewMode: 'cluster',
  allowPortraitCockpit: false,
  mapViewportSize: 'balanced',
  isMapOpen: true,
  isWorldMapOpen: false,
  graphicProfile: 'normal',
  showPerformanceMonitor: false,
  showTiltIndicator: getInitialShowTiltIndicator(),
  activeCockpitPanel: 'cluster',
  desktopSecondaryPanel: 'multimedia',
  activeKeys: {
    w: false,
    a: false,
    d: false,
    e: false,
    q: false,
    s: false,
    up: false,
    down: false,
    space: false,
    horn: false,
    map: false,
    nos: false,
  },

  setScreen: (screen) => set({ currentScreen: screen }),
  toggleControls: () => set((s) => ({ showControls: !s.showControls })),
  toggleVehicleInfo: () => set((s) => ({ showVehicleInfo: !s.showVehicleInfo })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setAllowPortraitCockpit: (allowed) => set({ allowPortraitCockpit: allowed }),
  setMapViewportSize: (size) => set({ mapViewportSize: size, isMapOpen: size !== 'hidden' }),
  toggleMap: () =>
    set((s) => {
      const nextOpen = !s.isMapOpen
      return {
        isMapOpen: nextOpen,
        mapViewportSize: nextOpen
          ? (s.mapViewportSize === 'hidden' ? 'balanced' : s.mapViewportSize)
          : 'hidden',
      }
    }),
  setMapOpen: (open) =>
    set((s) => ({
      isMapOpen: open,
      mapViewportSize: open
        ? (s.mapViewportSize === 'hidden' ? 'balanced' : s.mapViewportSize)
        : 'hidden',
    })),
  openWorldMap: () => set({ isWorldMapOpen: true }),
  closeWorldMap: () => set({ isWorldMapOpen: false }),
  toggleWorldMap: () => set((s) => ({ isWorldMapOpen: !s.isWorldMapOpen })),
  setGraphicProfile: (profile) => set({ graphicProfile: profile }),
  togglePerformanceMonitor: () => set((s) => ({ showPerformanceMonitor: !s.showPerformanceMonitor })),
  setShowTiltIndicator: (show) => {
    try {
      localStorage.setItem(STORAGE_SHOW_TILT_INDICATOR_KEY, String(show))
    } catch {
      // Ignora restrições locais de sandbox/localStorage
    }
    set({ showTiltIndicator: show })
  },
  setActiveCockpitPanel: (panel) => set({ activeCockpitPanel: panel }),
  setDesktopSecondaryPanel: (panel) => set({ desktopSecondaryPanel: panel }),
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

