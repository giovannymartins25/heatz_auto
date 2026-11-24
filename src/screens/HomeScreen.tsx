import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVehicleStore } from '@/stores/useVehicleStore'
import { useGarageStore, type GarageCarInstance } from '@/stores/useGarageStore'
import {
  SearchBar,
  CategoryFilter,
  VehicleSpecsModal,
  ManufacturerSection,
  GarageCarCard,
  DealershipVehicleCard,
} from '@/components/ui'
import { TuningGarageModal, DynoTestModal } from '@/components/tuning'
import type { FilterOption } from '@/components/ui'
import type { VehicleConfig } from '@/types/vehicle'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.9.0'
const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'

import { requestAppFullscreen } from '@/utils/fullscreen'

export const VEHICLE_PRICES: Record<string, { price: number; badge: string; description: string }> = {
  'gol-g6': { price: 42000, badge: 'POPULAR HATCH', description: '1.6 MSI 8V · Câmbio Manual 5M · Ágil e robusto' },
  'gol-quadrado-turbo': { price: 38000, badge: 'FORJADO DE RUA', description: '1.9 AP Turbo · Turbina .50 · 3-Step a 4.800 RPM · 380 cv' },
  'civic-si': { price: 89000, badge: 'VTEC CROSSOVER', description: '2.0 16V K20Z3 · 8.300 RPM · Manual 6M · Berro Estridente' },
  'golf-gti': { price: 145000, badge: 'HOT HATCH', description: '2.0 TSI EA888 · Câmbio DSG Dupla Embreagem · Launch Control' },
  'yaris-2019': { price: 78000, badge: 'SEDAN CONFORT', description: '1.5 Dual VVT-i · Multidrive CVT 7M · Direção Elétrica' },
  'cb1000r': { price: 72000, badge: 'SUPER NAKED', description: '1.000cc 4 Cilindros · 142 cv · 12.000 RPM · Quickshifter' },
  'porsche-gt3': { price: 1850000, badge: 'SUPERCAR AWD', description: '3.7 Flat-6 Bi-Turbo · 650 cv · Câmbio PDK 8M · PTM AWD · PAA Ativa' },
  'opala-4100': { price: 68000, badge: '6 CILINDROS RWD', description: '4.1L 250-S · Tração Traseira · Câmbio 5M · Ronco Cavernoso' },
  'fiat-toro-endurance-2025': { price: 152000, badge: 'SUP TURBO FLEX', description: '1.3 GSE T270 Flex · Câmbio AT6 Aisin · Tração Dianteira FWD' },
  'fiat-toro-ranch-2025': { price: 219000, badge: 'SUP 4X4 DIESEL', description: '2.2 MultiJet II Turbodiesel · Câmbio ZF 9HP · Tração 4x4 com Reduzida' },
  'jetta-gli-2021': { price: 189000, badge: 'SEDAN SPORT GLI', description: '2.0 TSI EA888 · 230 cv · Câmbio DSG 6M · Active Info Display + Discover Media 8"' },
  'bmw-320i-msport-2024': { price: 339000, badge: 'M SPORT RWD', description: '2.0 TwinPower Turbo Flex · 184 cv · ZF 8M · Tração Traseira · BMW Curved Display' },
  'ford-pampa-l-1997': { price: 29500, badge: 'PICAPE CLÁSSICA', description: '1.8i AP Monoponto · 95 cv · Manual 5M · Cabine Simples Utilitária 1997' },
  'ford-fusion-sel-2012': { price: 58000, badge: 'EXEC SEDAN 2012', description: '2.5 16V Duratec · 173 cv · AT6 6F35 · Painel Ice Blue + Ford SYNC 1' },
  'ford-fusion-titanium-awd-2019': { price: 138000, badge: 'TITANIUM AWD', description: '2.0 EcoBoost Turbo · 248 cv · Intelligent AWD · SmartGauge + SYNC 3 8"' },
}

export function getVehicleSpecs(manifest?: any, vehicleId?: string) {
  const id = vehicleId || manifest?.id || ''
  let engine = 'Motor Original'
  let drivetrain = 'FWD (Dianteira)'

  if (id.includes('civic')) {
    engine = '2.0 16V i-VTEC (K20Z3)'
    drivetrain = 'FWD (Dianteira)'
  } else if (id.includes('jetta-gli')) {
    engine = '2.0 16V TSI (EA888 Gen 3)'
    drivetrain = 'FWD (Dianteira)'
  } else if (id.includes('bmw-320i')) {
    engine = '2.0 16V TwinPower Turbo (B48)'
    drivetrain = 'RWD (Traseira)'
  } else if (id.includes('ford-pampa')) {
    engine = '1.8 8V AP-1800i CFI (EEC-IV)'
    drivetrain = 'FWD (Dianteira)'
  } else if (id.includes('fusion-sel-2012')) {
    engine = '2.5 16V Duratec iVCT'
    drivetrain = 'FWD (Dianteira)'
  } else if (id.includes('fusion-titanium-awd')) {
    engine = '2.0 16V EcoBoost GTDI'
    drivetrain = 'AWD (Intelligent Sob Demanda)'
  } else if (id.includes('golf')) {
    engine = '2.0 TSI (EA888 Gen 3)'
    drivetrain = 'FWD (Dianteira)'
  } else if (id.includes('gol-g6')) {
    engine = '1.6 16V MSI (EA211)'
    drivetrain = 'FWD (Dianteira)'
  } else if (id.includes('gol-quadrado')) {
    engine = '1.9 8V AP Forjado Turbo'
    drivetrain = 'FWD (Dianteira)'
  } else if (id.includes('porsche')) {
    engine = '3.7 Flat-6 Bi-Turbo (992)'
    drivetrain = 'AWD (PTM Integral)'
  } else if (id.includes('opala')) {
    engine = '4.1 6 Cilindros (250-S)'
    drivetrain = 'RWD (Traseira)'
  } else if (id.includes('yaris')) {
    engine = '1.5 16V Dual VVT-i'
    drivetrain = 'FWD (Dianteira)'
  } else if (id.includes('cb1000r')) {
    engine = '998cc 4 Cilindros DOHC'
    drivetrain = 'RWD (Moto)'
  } else if (id.includes('toro-endurance')) {
    engine = '1.3 16V GSE T270 Flex'
    drivetrain = 'FWD (Dianteira)'
  } else if (id.includes('toro-ranch')) {
    engine = '2.2 16V MultiJet II Turbodiesel'
    drivetrain = '4x4 Integral (AWD / LOW)'
  }

  const power = manifest?.powerHp ? `${manifest.powerHp} CV` : 'Potência'
  const torque = manifest?.torqueKgfm ? `${manifest.torqueKgfm} kgfm` : 'Torque'
  const transmission = manifest?.transmissionLabel || 'Câmbio'

  return { engine, drivetrain, power, torque, transmission }
}

export function HomeScreen() {
  const navigate = useNavigate()
  const vehicleList = useVehicleStore((s) => s.vehicleList)
  const loadVehicleList = useVehicleStore((s) => s.loadVehicleList)
  const selectVehicle = useVehicleStore((s) => s.selectVehicle)
  const isLoading = useVehicleStore((s) => s.isLoading)

  // Garagem State
  const ownedCars = useGarageStore((s) => s.ownedCars)
  const activeCarInstanceId = useGarageStore((s) => s.activeCarInstanceId)
  const credits = useGarageStore((s) => s.credits)
  const sandboxMode = useGarageStore((s) => s.sandboxMode)
  const buyCar = useGarageStore((s) => s.buyCar)
  const sellCar = useGarageStore((s) => s.sellCar)
  const renameCar = useGarageStore((s) => s.renameCar)
  const setActiveCar = useGarageStore((s) => s.setActiveCar)
  const toggleSandboxMode = useGarageStore((s) => s.toggleSandboxMode)
  const addCredits = useGarageStore((s) => s.addCredits)

  // UI State
  const [activeTab, setActiveTab] = useState<'garage' | 'dealership'>('garage')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<FilterOption>('all')
  const [selectedBrand, setSelectedBrand] = useState<string>('all')
  const [selectedTransmission, setSelectedTransmission] = useState<string>('all')
  const [notification, setNotification] = useState<string | null>(null)

  // Modal de Ficha Técnica
  const [specsModalData, setSpecsModalData] = useState<{
    vehicleId: string
    manifestEntry?: any
    isOwned?: boolean
    price?: number
    onDrive?: () => void
    onWorkshop?: () => void
  } | null>(null)

  // Modal de Renomeação
  const [renamingCar, setRenamingCar] = useState<GarageCarInstance | null>(null)
  const [newNameInput, setNewNameInput] = useState('')

  // Modal de Oficina
  const [tuningModalData, setTuningModalData] = useState<{
    vehicle: VehicleConfig
    instance: GarageCarInstance
  } | null>(null)

  // Modal de Dinamômetro
  const [dynoModalData, setDynoModalData] = useState<{
    vehicle: VehicleConfig
    instance: GarageCarInstance
  } | null>(null)

  useEffect(() => {
    loadVehicleList()
  }, [loadVehicleList])

  const showToast = (msg: string) => {
    setNotification(msg)
    HapticFeedback.light()
    setTimeout(() => setNotification(null), 3000)
  }

  // Marcas únicas disponíveis no catálogo
  const availableBrands = useMemo(() => {
    return Array.from(new Set(vehicleList.map((v) => v.brand)))
  }, [vehicleList])

  // Filtragem para Concessionária
  const filteredVehicles = useMemo(() => {
    return vehicleList.filter((v) => {
      // Filtro de Categoria (Todos / Carros / Motos)
      if (category !== 'all' && v.category !== category) return false

      // Filtro de Fabricante
      if (selectedBrand !== 'all' && v.brand.toLowerCase() !== selectedBrand.toLowerCase()) return false

      // Filtro de Câmbio (Manual vs Automático/CVT/DCT)
      if (selectedTransmission !== 'all') {
        const isAuto = v.transmissionType === 'automatic' || v.transmissionType === 'cvt' || v.transmissionType === 'dct'
        if (selectedTransmission === 'manual' && isAuto) return false
        if (selectedTransmission === 'automatic' && !isAuto) return false
      }

      // Busca por texto
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          v.name.toLowerCase().includes(q) ||
          v.brand.toLowerCase().includes(q) ||
          v.id.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [vehicleList, search, category, selectedBrand, selectedTransmission])

  // Filtragem para Garagem do Usuário
  const filteredOwnedCars = useMemo(() => {
    return ownedCars.filter((c) => {
      const manifest = vehicleList.find((v) => v.id === c.vehicleId)

      // Filtro de Categoria
      if (category !== 'all' && manifest && manifest.category !== category) return false

      // Filtro de Fabricante
      if (selectedBrand !== 'all' && manifest && manifest.brand.toLowerCase() !== selectedBrand.toLowerCase()) return false

      // Filtro de Câmbio
      if (selectedTransmission !== 'all' && manifest) {
        const isAuto = manifest.transmissionType === 'automatic' || manifest.transmissionType === 'cvt' || manifest.transmissionType === 'dct'
        if (selectedTransmission === 'manual' && isAuto) return false
        if (selectedTransmission === 'automatic' && !isAuto) return false
      }

      // Busca por texto
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          c.customName.toLowerCase().includes(q) ||
          c.vehicleId.toLowerCase().includes(q) ||
          (manifest && manifest.name.toLowerCase().includes(q)) ||
          (manifest && manifest.brand.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [ownedCars, vehicleList, search, category, selectedBrand, selectedTransmission])

  // Agrupamento vertical dinâmico da Garagem por Fabricante (Estilo Forza Horizon)
  const groupedOwnedCarsByBrand = useMemo(() => {
    const brandMap = new Map<string, GarageCarInstance[]>()

    for (const car of filteredOwnedCars) {
      const manifest = vehicleList.find((v) => v.id === car.vehicleId)
      const brand = manifest?.brand || 'Outros'
      if (!brandMap.has(brand)) {
        brandMap.set(brand, [])
      }
      brandMap.get(brand)!.push(car)
    }

    const groups: { brand: string; cars: GarageCarInstance[] }[] = []
    for (const [brand, cars] of brandMap.entries()) {
      if (cars.length > 0) {
        groups.push({ brand, cars })
      }
    }

    return groups.sort((a, b) => a.brand.localeCompare(b.brand))
  }, [filteredOwnedCars, vehicleList])

  // Agrupamento vertical dinâmico da Concessionária por Fabricante (Estilo Forza Horizon)
  const groupedDealershipByBrand = useMemo(() => {
    const brandMap = new Map<string, typeof vehicleList>()

    for (const v of filteredVehicles) {
      const brand = v.brand || 'Outros'
      if (!brandMap.has(brand)) {
        brandMap.set(brand, [])
      }
      brandMap.get(brand)!.push(v)
    }

    const groups: { brand: string; vehicles: typeof vehicleList }[] = []
    for (const [brand, vehicles] of brandMap.entries()) {
      if (vehicles.length > 0) {
        groups.push({ brand, vehicles })
      }
    }

    return groups.sort((a, b) => a.brand.localeCompare(b.brand))
  }, [filteredVehicles])

  // Comprar Carro na Concessionária
  const handleBuyCar = (vId: string) => {
    const info = VEHICLE_PRICES[vId] || { price: 50000, badge: 'VEÍCULO', description: '' }
    const manifest = vehicleList.find((v) => v.id === vId)
    const baseName = manifest ? `${manifest.brand} ${manifest.name}` : vId

    try {
      const newCar = buyCar(vId, `${baseName} #${ownedCars.filter((c) => c.vehicleId === vId).length + 1}`, info.price)
      showToast(`🎉 Parabéns! ${newCar.customName} foi adicionado à sua garagem!`)
      setActiveTab('garage')
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Erro ao comprar veículo'}`)
    }
  }

  // Vender Carro da Garagem
  const handleSellCar = (instance: GarageCarInstance) => {
    if (ownedCars.length <= 1) {
      showToast('⚠️ Você precisa ter pelo menos um veículo na garagem!')
      return
    }
    const info = VEHICLE_PRICES[instance.vehicleId] || { price: 50000 }
    const refund = Math.round(info.price * 0.7)
    try {
      sellCar(instance.instanceId, refund)
      showToast(`💰 Veículo vendido! R$ ${refund.toLocaleString()} creditados.`)
    } catch (err: any) {
      showToast(`❌ ${err.message}`)
    }
  }

  // Seleção de Modo: PAINEL ou DIRIGIR (Fase 1.5)
  const handleSelectMode = (instance: GarageCarInstance, mode: 'cluster' | 'drive') => {
    setActiveCar(instance.instanceId)
    HapticFeedback.gearShift()
    requestAppFullscreen().catch(() => {})
    navigate(`/simulator/${instance.vehicleId}?instance=${instance.instanceId}&mode=${mode}`)
  }

  // Abrir Oficina para o Carro
  const handleOpenWorkshop = async (instance: GarageCarInstance) => {
    setActiveCar(instance.instanceId)
    const config = await selectVehicle(instance.vehicleId)
    if (config) {
      setTuningModalData({ vehicle: config, instance })
      HapticFeedback.light()
    }
  }

  // Abrir Dinamômetro para o Carro
  const handleOpenDyno = async (instance: GarageCarInstance) => {
    setActiveCar(instance.instanceId)
    const config = await selectVehicle(instance.vehicleId)
    if (config) {
      setDynoModalData({ vehicle: config, instance })
      HapticFeedback.light()
    }
  }

  // Confirmar Renomeação
  const handleConfirmRename = () => {
    if (renamingCar && newNameInput.trim()) {
      renameCar(renamingCar.instanceId, newNameInput.trim())
      showToast(`✏️ Renomeado para "${newNameInput.trim()}"!`)
      setRenamingCar(null)
    }
  }

  return (
    <div className="flex flex-col min-h-dvh safe-top safe-bottom bg-[var(--color-bg-primary)] font-sans">
      
      {/* ─── Topo / Barra de Economia & Status ─── */}
      <div className="w-full bg-zinc-950 border-b border-white/10 px-3 sm:px-4 py-1 sm:py-1.5 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-1.5 sm:gap-3 text-[10px] sm:text-xs font-mono">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Saldo de Créditos */}
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 rounded-xl bg-black/80 border border-emerald-500/40 text-emerald-400 font-black shadow-inner">
              <span className="text-xs">💰</span>
              <span>CARTEIRA: R$ {sandboxMode ? '∞ ILIMITADO' : credits.toLocaleString()}</span>
            </div>

            {/* Alternador de Modo Sandbox */}
            <button
              onClick={toggleSandboxMode}
              className={`px-2.5 sm:px-3 py-0.5 rounded-xl font-bold uppercase tracking-wider text-[8.5px] sm:text-[10px] border transition-all cursor-pointer ${
                sandboxMode
                  ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                  : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              {sandboxMode ? '⚡ SANDBOX' : 'MODO CARREIRA'}
            </button>

            {/* Adicionar Saldo Rápido */}
            {!sandboxMode && (
              <button
                onClick={() => { addCredits(50000); showToast('💰 + R$ 50.000 adicionados!') }}
                className="px-2 py-0.5 sm:px-2.5 rounded-xl text-[8.5px] sm:text-[10px] font-bold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/40 cursor-pointer"
              >
                + R$ 50k
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-zinc-400 text-[9px] sm:text-[11px]">
            <span>GARAGEM: <b className="text-white">{ownedCars.length}</b> MÁQUINAS</span>
            <span className="text-zinc-600">|</span>
            <span className="text-emerald-400 font-bold">120Hz REAL-PHYSICS</span>
          </div>
        </div>
      </div>

      {/* ─── Toast Feedback ─── */}
      {notification && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 py-2 px-5 rounded-2xl bg-zinc-900 border-2 border-white/20 text-white font-mono text-xs font-bold shadow-2xl animate-in slide-in-from-top duration-150">
          {notification}
        </div>
      )}

      {/* ─── Header Principal ─── */}
      <header className="flex flex-col items-center pt-2 sm:pt-4 md:pt-6 pb-2 sm:pb-3 px-3 sm:px-6 w-full max-w-7xl mx-auto hero-header-landscape">
        <div className="relative mb-0.5 sm:mb-1.5 text-center">
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter hero-title-landscape">
            <span className="text-gradient">Heatz</span>
            <span className="text-white"> Auto</span>
          </h1>
          <div
            className="absolute inset-0 blur-3xl opacity-25 -z-10 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, var(--color-accent), transparent 70%)' }}
          />
        </div>

        <p className="text-[var(--color-text-muted)] text-[9.5px] sm:text-xs font-mono tracking-wider sm:tracking-[0.2em] uppercase text-center mb-2 sm:mb-4 hero-sub-landscape">
          Simulador Físico de Motores, Loja de Peças & Garagem Customizada
        </p>

        {/* ─── Seletor de Abas Principais: GARAGEM vs CONCESSIONÁRIA ─── */}
        <div className="flex items-center p-0.5 sm:p-1 rounded-xl sm:rounded-2xl bg-zinc-950 border border-white/10 shadow-2xl mb-2 sm:mb-4 gap-1 sm:gap-2 hero-tabs-landscape">
          <button
            onClick={() => setActiveTab('garage')}
            className={`px-3 sm:px-6 py-1 sm:py-2 rounded-lg sm:rounded-xl font-mono text-[10.5px] sm:text-sm font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'garage'
                ? 'bg-[var(--color-accent)] text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>🚗</span>
            <span>MINHA GARAGEM ({ownedCars.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('dealership')}
            className={`px-3 sm:px-6 py-1 sm:py-2 rounded-lg sm:rounded-xl font-mono text-[10.5px] sm:text-sm font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dealership'
                ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>🏪</span>
            <span>CONCESSIONÁRIA ({vehicleList.length})</span>
          </button>
        </div>

        {/* Barra de Ações: Busca + Filtros */}
        <div className="flex flex-col items-center gap-2 w-full max-w-3xl">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full">
            <div className="flex-1 w-full">
              <SearchBar value={search} onChange={setSearch} />
            </div>
            <div className="w-full sm:w-auto shrink-0">
              <CategoryFilter active={category} onChange={setCategory} />
            </div>
          </div>

          {/* Filtros de Fabricante e Câmbio (Unificados para Garagem e Concessionária) */}
          <div className="w-full flex flex-col gap-1.5 pt-1 border-t border-white/5">
            {/* Filtro por Marca */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full py-0.5 no-scrollbar text-[8.5px] sm:text-[9.5px] font-mono">
              <span className="text-zinc-500 uppercase shrink-0 text-[8px] font-bold">Marca:</span>
              <button
                type="button"
                onClick={() => setSelectedBrand('all')}
                className={`px-2 py-0.5 rounded-lg border transition-all whitespace-nowrap cursor-pointer ${
                  selectedBrand === 'all'
                    ? 'bg-amber-500 text-black font-black border-amber-400 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
              >
                TODAS
              </button>
              {availableBrands.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setSelectedBrand(b)}
                  className={`px-2 py-0.5 rounded-lg border transition-all whitespace-nowrap cursor-pointer uppercase ${
                    selectedBrand.toLowerCase() === b.toLowerCase()
                      ? 'bg-amber-500 text-black font-black border-amber-400 shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            {/* Filtro por Câmbio */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full py-0.5 no-scrollbar text-[8px] sm:text-[9px] font-mono">
              <span className="text-zinc-500 uppercase shrink-0 text-[8px] font-bold">Câmbio:</span>
              <button
                type="button"
                onClick={() => setSelectedTransmission('all')}
                className={`px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                  selectedTransmission === 'all'
                    ? 'bg-zinc-700 text-white font-bold border-zinc-500'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
              >
                TODOS
              </button>
              <button
                type="button"
                onClick={() => setSelectedTransmission('manual')}
                className={`px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                  selectedTransmission === 'manual'
                    ? 'bg-zinc-700 text-white font-bold border-zinc-500'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
              >
                MANUAL
              </button>
              <button
                type="button"
                onClick={() => setSelectedTransmission('automatic')}
                className={`px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                  selectedTransmission === 'automatic'
                    ? 'bg-zinc-700 text-white font-bold border-zinc-500'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
              >
                AUTOMÁTICO / CVT / DCT
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Conteúdo Principal ─── */}
      <main className="flex-1 px-3 sm:px-6 lg:px-8 pb-10 w-full max-w-7xl mx-auto">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-3 border-zinc-800 border-t-[var(--color-accent)] animate-spin mb-3" />
            <p className="text-xs font-mono text-[var(--color-text-muted)] tracking-wider">
              Carregando simulador...
            </p>
          </div>
        )}

        {/* ─── ABA 1: MINHA GARAGEM ─── */}
        {!isLoading && activeTab === 'garage' && (
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="flex items-center justify-between px-1 text-[11px] sm:text-xs font-mono text-zinc-400">
              <span>{filteredOwnedCars.length} veículos na coleção</span>
              <span className="text-[9px] sm:text-[10px] text-zinc-500">
                {groupedOwnedCarsByBrand.length} {groupedOwnedCarsByBrand.length === 1 ? 'fabricante' : 'fabricantes'}
              </span>
            </div>

            {filteredOwnedCars.length === 0 ? (
              <div className="py-16 text-center border border-white/5 rounded-2xl bg-zinc-950/60 p-6">
                <span className="text-3xl block mb-2">🔍</span>
                <p className="text-zinc-400 font-mono text-xs uppercase tracking-wider">
                  Nenhum veículo encontrado com os filtros selecionados
                </p>
              </div>
            ) : (
              groupedOwnedCarsByBrand.map((group) => {
                const countLabel = `${group.cars.length} ${
                  group.cars.length === 1 ? 'MÁQUINA NA COLEÇÃO' : 'MÁQUINAS NA COLEÇÃO'
                }`

                return (
                  <ManufacturerSection
                    key={group.brand}
                    brand={group.brand}
                    countLabel={countLabel}
                  >
                    {group.cars.map((car) => {
                      const manifest = vehicleList.find((v) => v.id === car.vehicleId)
                      const isActive = activeCarInstanceId === car.instanceId
                      const specs = getVehicleSpecs(manifest, car.vehicleId)
                      const sellPrice = Math.round((VEHICLE_PRICES[car.vehicleId]?.price || 50000) * 0.7)

                      return (
                        <GarageCarCard
                          key={car.instanceId}
                          car={car}
                          manifest={manifest}
                          specs={specs}
                          isActive={isActive}
                          canSell={ownedCars.length > 1}
                          sellPrice={sellPrice}
                          onRename={() => {
                            setRenamingCar(car)
                            setNewNameInput(car.customName)
                          }}
                          onSelectMode={(mode) => handleSelectMode(car, mode)}
                          onOpenWorkshop={() => handleOpenWorkshop(car)}
                          onOpenDyno={() => handleOpenDyno(car)}
                          onOpenSpecs={() =>
                            setSpecsModalData({
                              vehicleId: car.vehicleId,
                              manifestEntry: manifest,
                              isOwned: true,
                              onDrive: () => handleSelectMode(car, 'drive'),
                              onWorkshop: () => handleOpenWorkshop(car),
                            })
                          }
                          onSell={() => handleSellCar(car)}
                        />
                      )
                    })}
                  </ManufacturerSection>
                )
              })
            )}
          </div>
        )}

        {/* ─── ABA 2: CONCESSIONÁRIA / LOJA DE CARROS ─── */}
        {!isLoading && activeTab === 'dealership' && (
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="flex items-center justify-between px-1 text-[11px] sm:text-xs font-mono text-zinc-400">
              <span>{filteredVehicles.length} modelos disponíveis</span>
              <span className="text-[9px] sm:text-[10px] text-emerald-400 font-bold">
                {groupedDealershipByBrand.length} {groupedDealershipByBrand.length === 1 ? 'fabricante disponível' : 'fabricantes disponíveis'}
              </span>
            </div>

            {filteredVehicles.length === 0 ? (
              <div className="py-16 text-center border border-white/5 rounded-2xl bg-zinc-950/60 p-6">
                <span className="text-3xl block mb-2">🔍</span>
                <p className="text-zinc-400 font-mono text-xs uppercase tracking-wider">
                  Nenhum modelo disponível com os filtros selecionados
                </p>
              </div>
            ) : (
              groupedDealershipByBrand.map((group) => {
                const countLabel = `${group.vehicles.length} ${
                  group.vehicles.length === 1 ? 'MODELO DISPONÍVEL' : 'MODELOS DISPONÍVEIS'
                }`

                return (
                  <ManufacturerSection
                    key={group.brand}
                    brand={group.brand}
                    countLabel={countLabel}
                  >
                    {group.vehicles.map((vehicle) => {
                      const info = VEHICLE_PRICES[vehicle.id] || {
                        price: 50000,
                        badge: 'CATÁLOGO',
                        description: '',
                      }
                      const ownedCount = ownedCars.filter((c) => c.vehicleId === vehicle.id).length
                      const canAfford = sandboxMode || credits >= info.price

                      return (
                        <DealershipVehicleCard
                          key={vehicle.id}
                          vehicle={vehicle}
                          priceInfo={info}
                          ownedCount={ownedCount}
                          canAfford={canAfford}
                          sandboxMode={sandboxMode}
                          onBuy={() => handleBuyCar(vehicle.id)}
                          onOpenSpecs={() =>
                            setSpecsModalData({
                              vehicleId: vehicle.id,
                              manifestEntry: vehicle,
                              isOwned: ownedCount > 0,
                              price: info.price,
                            })
                          }
                        />
                      )
                    })}
                  </ManufacturerSection>
                )
              })
            )}
          </div>
        )}
      </main>

      {/* ─── Modal de Renomeação de Carro ─── */}
      {renamingCar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono select-none">
          <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border-2 border-white/20 p-5 shadow-2xl flex flex-col gap-3">
            <h3 className="text-sm font-black text-white uppercase">Renomear Veículo</h3>
            <p className="text-[10px] text-zinc-400">
              Dê um apelido personalizado para identificar este carro na sua garagem.
            </p>
            <input
              type="text"
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              placeholder="Ex: Gol Quadrado Arrancada"
              className="w-full px-3 py-2 rounded-xl bg-black border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRenamingCar(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRename}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider"
              >
                Salvar Nome
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal da Oficina de Peças (TuningGarageModal) ─── */}
      {tuningModalData && (
        <TuningGarageModal
          isOpen={Boolean(tuningModalData)}
          onClose={() => setTuningModalData(null)}
          vehicle={tuningModalData.vehicle}
          carInstance={tuningModalData.instance}
        />
      )}

      {/* ─── Modal do Dinamômetro Virtual (DynoTestModal) ─── */}
      {dynoModalData && (
        <DynoTestModal
          config={dynoModalData.vehicle}
          upgrades={dynoModalData.instance.upgrades}
          onClose={() => setDynoModalData(null)}
        />
      )}

      {/* ─── Modal de Ficha Técnica Completa ─── */}
      {specsModalData && (
        <VehicleSpecsModal
          vehicleId={specsModalData.vehicleId}
          manifestEntry={specsModalData.manifestEntry}
          isOwned={specsModalData.isOwned}
          price={specsModalData.price}
          onClose={() => setSpecsModalData(null)}
          onBuy={handleBuyCar}
          onDrive={specsModalData.onDrive}
          onWorkshop={specsModalData.onWorkshop}
        />
      )}

      {/* ─── Footer ─── */}
      <footer className="flex flex-col items-center py-6 border-t border-[var(--color-border)] gap-1 mt-auto font-mono text-zinc-500 text-xs">
        <p>Heatz Auto · Simulador Automotivo v{appVersion}</p>
        <p className="text-[10px] text-zinc-600">Build {buildId} · 120Hz Real-Time Physics & Multi-Car Garage</p>
      </footer>
    </div>
  )
}
