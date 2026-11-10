import { create } from 'zustand'

export interface CarUpgrades {
  turboKit: boolean // Se tem kit turbo instalado (mesmo em carros aspirados)
  multimediaKit: boolean // Central multimídia 2-DIN retrofit com YouTube
  exhaustType: 'stock' | 'sport' | 'straight_pipe' // Escapamento: original, esportivo com difusor ou direto
  intakeType: 'stock' | 'cold_air' // Admissão: original ou intake cônico K&N
  tires: 'street' | 'semi_slick' // Pneus de rua ou semi-slick de arrancada
  tuningStage: 0 | 1 | 2 | 3 // Estágio de reprogramação de ECU
  exhaustValveOpen: boolean // Válvula de difusor aberta/fechada
}

export interface GarageCarInstance {
  instanceId: string
  vehicleId: string
  customName: string
  upgrades: CarUpgrades
  mileageKm: number
  acquiredAt: number
}

interface GarageStoreState {
  ownedCars: GarageCarInstance[]
  activeCarInstanceId: string | null
  credits: number
  sandboxMode: boolean
}

interface GarageStoreActions {
  buyCar: (vehicleId: string, defaultName?: string, price?: number) => GarageCarInstance
  sellCar: (instanceId: string, refundPrice?: number) => void
  renameCar: (instanceId: string, newName: string) => void
  installUpgrade: (instanceId: string, upgrade: Partial<CarUpgrades>) => void
  setActiveCar: (instanceId: string) => void
  getActiveCar: () => GarageCarInstance | undefined
  addCredits: (amount: number) => void
  toggleSandboxMode: () => void
  resetToDefaults: () => void
}

type GarageStore = GarageStoreState & GarageStoreActions

const STORAGE_KEY = 'heatz_garage_v2'

function createDefaultUpgrades(vehicleId: string): CarUpgrades {
  const isOriginallyTurbo =
    vehicleId === 'golf-gti' ||
    vehicleId === 'porsche-gt3' ||
    vehicleId === 'gol-quadrado-turbo'

  const hasDefaultMultimedia =
    vehicleId === 'golf-gti' ||
    vehicleId === 'porsche-gt3' ||
    vehicleId === 'yaris-2019' ||
    vehicleId === 'civic-si'

  return {
    turboKit: isOriginallyTurbo,
    multimediaKit: hasDefaultMultimedia,
    exhaustType: isOriginallyTurbo ? 'sport' : 'stock',
    intakeType: 'stock',
    tires: 'street',
    tuningStage: 0,
    exhaustValveOpen: true,
  }
}

const DEFAULT_INITIAL_CARS: GarageCarInstance[] = [
  {
    instanceId: 'inst-gol-g6-default',
    vehicleId: 'gol-g6',
    customName: 'Gol G6 1.6 MSI (Original)',
    upgrades: createDefaultUpgrades('gol-g6'),
    mileageKm: 42150,
    acquiredAt: Date.now() - 86400000 * 10,
  },
  {
    instanceId: 'inst-golf-gti-default',
    vehicleId: 'golf-gti',
    customName: 'Golf GTI Mk7 DSG',
    upgrades: createDefaultUpgrades('golf-gti'),
    mileageKm: 18200,
    acquiredAt: Date.now() - 86400000 * 8,
  },
  {
    instanceId: 'inst-porsche-gt3-default',
    vehicleId: 'porsche-gt3',
    customName: 'Porsche 911 GT3 RS PDK',
    upgrades: createDefaultUpgrades('porsche-gt3'),
    mileageKm: 3450,
    acquiredAt: Date.now() - 86400000 * 6,
  },
  {
    instanceId: 'inst-yaris-default',
    vehicleId: 'yaris-2019',
    customName: 'Toyota Yaris XLS CVT',
    upgrades: createDefaultUpgrades('yaris-2019'),
    mileageKm: 31200,
    acquiredAt: Date.now() - 86400000 * 4,
  },
  {
    instanceId: 'inst-gol-quadrado-default',
    vehicleId: 'gol-quadrado-turbo',
    customName: 'Gol Quadrado 1.9 AP Forjado',
    upgrades: createDefaultUpgrades('gol-quadrado-turbo'),
    mileageKm: 142850,
    acquiredAt: Date.now() - 86400000 * 2,
  },
  {
    instanceId: 'inst-civic-si-default',
    vehicleId: 'civic-si',
    customName: 'Honda Civic Si 2.0 i-VTEC K20',
    upgrades: createDefaultUpgrades('civic-si'),
    mileageKm: 78500,
    acquiredAt: Date.now() - 86400000 * 1,
  },
  {
    instanceId: 'inst-cb1000r-default',
    vehicleId: 'cb1000r',
    customName: 'Honda CB1000R Neo Sports',
    upgrades: createDefaultUpgrades('cb1000r'),
    mileageKm: 8200,
    acquiredAt: Date.now(),
  },
]

function loadStoredState(): { ownedCars: GarageCarInstance[]; activeCarInstanceId: string | null; credits: number; sandboxMode: boolean } {
  if (typeof window === 'undefined') {
    return {
      ownedCars: DEFAULT_INITIAL_CARS,
      activeCarInstanceId: DEFAULT_INITIAL_CARS[0].instanceId,
      credits: 250000,
      sandboxMode: false,
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.ownedCars) && parsed.ownedCars.length > 0) {
        return {
          ownedCars: parsed.ownedCars,
          activeCarInstanceId: parsed.activeCarInstanceId || parsed.ownedCars[0].instanceId,
          credits: typeof parsed.credits === 'number' ? parsed.credits : 250000,
          sandboxMode: Boolean(parsed.sandboxMode),
        }
      }
    }
  } catch (err) {
    console.error('Erro ao ler garagem do localStorage:', err)
  }

  return {
    ownedCars: DEFAULT_INITIAL_CARS,
    activeCarInstanceId: DEFAULT_INITIAL_CARS[0].instanceId,
    credits: 250000,
    sandboxMode: false,
  }
}

function persistState(state: { ownedCars: GarageCarInstance[]; activeCarInstanceId: string | null; credits: number; sandboxMode: boolean }) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.error('Erro ao persistir garagem:', err)
  }
}

const initialData = loadStoredState()

export const useGarageStore = create<GarageStore>((set, get) => ({
  ownedCars: initialData.ownedCars,
  activeCarInstanceId: initialData.activeCarInstanceId,
  credits: initialData.credits,
  sandboxMode: initialData.sandboxMode,

  buyCar: (vehicleId: string, defaultName?: string, price = 50000) => {
    const { ownedCars, credits, sandboxMode } = get()
    if (!sandboxMode && credits < price) {
      throw new Error(`Créditos insuficientes! Preço: R$ ${price.toLocaleString()}, Saldo: R$ ${credits.toLocaleString()}`)
    }

    const instanceId = `car-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const newCar: GarageCarInstance = {
      instanceId,
      vehicleId,
      customName: defaultName || `Novo ${vehicleId.toUpperCase()}`,
      upgrades: createDefaultUpgrades(vehicleId),
      mileageKm: 0,
      acquiredAt: Date.now(),
    }

    const updatedCars = [...ownedCars, newCar]
    const updatedCredits = sandboxMode ? credits : credits - price

    set({
      ownedCars: updatedCars,
      activeCarInstanceId: instanceId,
      credits: updatedCredits,
    })

    persistState({
      ownedCars: updatedCars,
      activeCarInstanceId: instanceId,
      credits: updatedCredits,
      sandboxMode,
    })

    return newCar
  },

  sellCar: (instanceId: string, refundPrice = 35000) => {
    const { ownedCars, activeCarInstanceId, credits, sandboxMode } = get()
    if (ownedCars.length <= 1) {
      throw new Error('Você deve ter pelo menos um veículo na garagem!')
    }

    const updatedCars = ownedCars.filter((c) => c.instanceId !== instanceId)
    const newActiveId = activeCarInstanceId === instanceId ? updatedCars[0].instanceId : activeCarInstanceId
    const updatedCredits = sandboxMode ? credits : credits + refundPrice

    set({
      ownedCars: updatedCars,
      activeCarInstanceId: newActiveId,
      credits: updatedCredits,
    })

    persistState({
      ownedCars: updatedCars,
      activeCarInstanceId: newActiveId,
      credits: updatedCredits,
      sandboxMode,
    })
  },

  renameCar: (instanceId: string, newName: string) => {
    const { ownedCars, activeCarInstanceId, credits, sandboxMode } = get()
    const updatedCars = ownedCars.map((c) =>
      c.instanceId === instanceId ? { ...c, customName: newName } : c
    )

    set({ ownedCars: updatedCars })
    persistState({
      ownedCars: updatedCars,
      activeCarInstanceId,
      credits,
      sandboxMode,
    })
  },

  installUpgrade: (instanceId: string, upgrade: Partial<CarUpgrades>) => {
    const { ownedCars, activeCarInstanceId, credits, sandboxMode } = get()
    const updatedCars = ownedCars.map((c) =>
      c.instanceId === instanceId
        ? {
            ...c,
            upgrades: {
              ...c.upgrades,
              ...upgrade,
            },
          }
        : c
    )

    set({ ownedCars: updatedCars })
    persistState({
      ownedCars: updatedCars,
      activeCarInstanceId,
      credits,
      sandboxMode,
    })
  },

  setActiveCar: (instanceId: string) => {
    const { ownedCars, credits, sandboxMode } = get()
    set({ activeCarInstanceId: instanceId })
    persistState({
      ownedCars,
      activeCarInstanceId: instanceId,
      credits,
      sandboxMode,
    })
  },

  getActiveCar: () => {
    const { ownedCars, activeCarInstanceId } = get()
    return ownedCars.find((c) => c.instanceId === activeCarInstanceId) || ownedCars[0]
  },

  addCredits: (amount: number) => {
    const { ownedCars, activeCarInstanceId, credits, sandboxMode } = get()
    const updatedCredits = credits + amount
    set({ credits: updatedCredits })
    persistState({
      ownedCars,
      activeCarInstanceId,
      credits: updatedCredits,
      sandboxMode,
    })
  },

  toggleSandboxMode: () => {
    const { ownedCars, activeCarInstanceId, credits, sandboxMode } = get()
    const newSandbox = !sandboxMode
    set({ sandboxMode: newSandbox })
    persistState({
      ownedCars,
      activeCarInstanceId,
      credits,
      sandboxMode: newSandbox,
    })
  },

  resetToDefaults: () => {
    set({
      ownedCars: DEFAULT_INITIAL_CARS,
      activeCarInstanceId: DEFAULT_INITIAL_CARS[0].instanceId,
      credits: 250000,
      sandboxMode: false,
    })
    persistState({
      ownedCars: DEFAULT_INITIAL_CARS,
      activeCarInstanceId: DEFAULT_INITIAL_CARS[0].instanceId,
      credits: 250000,
      sandboxMode: false,
    })
  },
}))
