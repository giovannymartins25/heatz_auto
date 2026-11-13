import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVehicleStore } from '@/stores/useVehicleStore'
import { useGarageStore, type GarageCarInstance } from '@/stores/useGarageStore'
import { SearchBar, CategoryFilter } from '@/components/ui'
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
  'porsche-gt3': { price: 1850000, badge: 'MOTORSPORT', description: '4.0 Flat-6 Boxer · 9.000 RPM · Câmbio PDK 7M · Asa Ativa' },
  'opala-4100': { price: 68000, badge: '6 CILINDROS RWD', description: '4.1L 250-S · Tração Traseira · Câmbio 5M · Ronco Cavernoso' },
}

export function getVehicleSpecs(manifest?: any, vehicleId?: string) {
  const id = vehicleId || manifest?.id || ''
  let engine = 'Motor Original'
  let drivetrain = 'FWD (Dianteira)'

  if (id.includes('civic')) {
    engine = '2.0 16V i-VTEC (K20Z3)'
    drivetrain = 'FWD (Dianteira)'
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
    engine = '4.0 Boxer-6 9000 RPM'
    drivetrain = 'RWD (Traseira)'
  } else if (id.includes('opala')) {
    engine = '4.1 6 Cilindros (250-S)'
    drivetrain = 'RWD (Traseira)'
  } else if (id.includes('yaris')) {
    engine = '1.5 16V Dual VVT-i'
    drivetrain = 'FWD (Dianteira)'
  } else if (id.includes('cb1000r')) {
    engine = '998cc 4 Cilindros DOHC'
    drivetrain = 'RWD (Moto)'
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
  const [notification, setNotification] = useState<string | null>(null)

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

  // Filtragem para Concessionária
  const filteredVehicles = useMemo(() => {
    return vehicleList.filter((v) => {
      if (category !== 'all' && v.category !== category) return false
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
  }, [vehicleList, search, category])

  // Filtragem para Garagem do Usuário
  const filteredOwnedCars = useMemo(() => {
    return ownedCars.filter((c) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const manifest = vehicleList.find((v) => v.id === c.vehicleId)
      return (
        c.customName.toLowerCase().includes(q) ||
        c.vehicleId.toLowerCase().includes(q) ||
        (manifest && manifest.name.toLowerCase().includes(q)) ||
        (manifest && manifest.brand.toLowerCase().includes(q))
      )
    })
  }, [ownedCars, vehicleList, search])

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
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full max-w-2xl">
          <div className="flex-1 w-full">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          {activeTab === 'dealership' && (
            <div className="w-full sm:w-auto shrink-0">
              <CategoryFilter active={category} onChange={setCategory} />
            </div>
          )}
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
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center justify-between px-1 text-[11px] sm:text-xs font-mono text-zinc-400">
              <span>{filteredOwnedCars.length} veículos na coleção</span>
              <span className="text-[9px] sm:text-[10px] text-zinc-500">Múltiplas preparações suportadas</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6">
              {filteredOwnedCars.map((car) => {
                const manifest = vehicleList.find((v) => v.id === car.vehicleId)
                const isActive = activeCarInstanceId === car.instanceId
                const up = car.upgrades
                const specs = getVehicleSpecs(manifest, car.vehicleId)

                return (
                  <div
                    key={car.instanceId}
                    className={`relative rounded-xl sm:rounded-2xl border-2 p-2.5 sm:p-3.5 lg:p-4 bg-gradient-to-b from-zinc-900/90 via-zinc-950 to-black flex flex-col justify-between gap-1.5 sm:gap-2.5 transition-all shadow-xl hover:shadow-2xl car-card-landscape ${
                      isActive ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/50' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Topo do Card */}
                    <div>
                      <div className="flex items-start justify-between gap-1.5 mb-1 sm:mb-1.5">
                        <div className="min-w-0">
                          <span className="text-[8.5px] sm:text-[9.5px] font-mono uppercase tracking-widest text-zinc-400 block truncate">
                            {manifest?.brand || 'VEÍCULO'}
                          </span>
                          <h3 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1 truncate">
                            <span className="truncate">{car.customName}</span>
                            <button
                              onClick={() => { setRenamingCar(car); setNewNameInput(car.customName) }}
                              className="text-zinc-500 hover:text-amber-400 text-[11px] p-0.5 cursor-pointer shrink-0"
                              title="Renomear carro"
                            >
                              ✏️
                            </button>
                          </h3>
                        </div>

                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[7px] sm:text-[7.5px] font-black uppercase tracking-wider bg-[var(--color-accent)] text-white shadow-md shrink-0">
                            SELECIONADO
                          </span>
                        )}
                      </div>

                      {/* Imagem / Preview do Veículo — escala moderada e 100% visível sem cortes */}
                      <div className="w-full h-20 sm:h-24 md:h-28 lg:h-32 rounded-lg sm:rounded-xl bg-zinc-950/90 border border-white/5 overflow-hidden relative flex items-center justify-center my-1 sm:my-1.5 car-thumb-landscape">
                        {manifest?.thumbnailPath ? (
                          <img
                            src={manifest.thumbnailPath}
                            alt={car.customName}
                            className="w-full h-full object-contain p-1.5 sm:p-2 opacity-95 hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <span className="text-2xl sm:text-3xl">🏎️</span>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                        <span className="absolute bottom-1 left-1 text-[7.5px] sm:text-[8.5px] font-mono text-zinc-400 bg-black/80 px-1.5 py-0.5 rounded border border-white/10">
                          ODÔMETRO: {car.mileageKm.toLocaleString()} KM
                        </span>
                      </div>

                      {/* Especificações Técnicas Claras */}
                      <div className="bg-zinc-900/70 rounded-lg p-1.5 sm:p-2 border border-white/5 my-1 sm:my-1.5 text-[8px] sm:text-[9px] font-mono space-y-0.5">
                        <div className="flex justify-between items-center text-zinc-300">
                          <span className="text-zinc-500 uppercase">MOTOR:</span>
                          <span className="font-bold text-white truncate max-w-[68%] text-right">{specs.engine}</span>
                        </div>
                        <div className="flex justify-between items-center text-zinc-300">
                          <span className="text-zinc-500 uppercase">FORÇA:</span>
                          <span className="font-bold text-amber-300">{specs.power} · {specs.torque}</span>
                        </div>
                        <div className="flex justify-between items-center text-zinc-300">
                          <span className="text-zinc-500 uppercase">CÂMBIO / TRAÇÃO:</span>
                          <span className="font-bold text-zinc-200">{specs.transmission} · {specs.drivetrain}</span>
                        </div>
                      </div>

                      {/* Tags de Peças Instaladas (Upgrades) */}
                      <div className="flex flex-wrap gap-1 my-1 font-mono text-[7px] sm:text-[7.5px]">
                        {/* Turbo Kit */}
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold uppercase border ${
                            up.turboKit
                              ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                              : 'bg-zinc-800/60 text-zinc-400 border-white/5'
                          }`}
                        >
                          {up.turboKit ? '🌀 TURBO' : '🍃 ASPIRADO'}
                        </span>

                        {/* Stage ECU */}
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold uppercase border ${
                            up.tuningStage > 0
                              ? 'bg-red-500/20 text-red-300 border-red-500/40'
                              : 'bg-zinc-800/60 text-zinc-400 border-white/5'
                          }`}
                        >
                          {up.tuningStage === 0 ? 'STOCK' : `STAGE ${up.tuningStage}`}
                        </span>

                        {/* Escapamento */}
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold uppercase border ${
                            up.exhaustType === 'straight_pipe'
                              ? 'bg-orange-500/20 text-orange-300 border-orange-400/40'
                              : up.exhaustType === 'sport'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                              : 'bg-zinc-800/60 text-zinc-400 border-white/5'
                          }`}
                        >
                          {up.exhaustType === 'straight_pipe'
                            ? '💥 DIRETO'
                            : up.exhaustType === 'sport'
                            ? '⚡ SPORT'
                            : 'ORIGINAL'}
                        </span>

                        {/* Pneus */}
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold uppercase border ${
                            up.tires === 'semi_slick'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                              : 'bg-zinc-800/60 text-zinc-400 border-white/5'
                          }`}
                        >
                          {up.tires === 'semi_slick' ? '🏁 SEMI-SLICK' : 'RADIAL'}
                        </span>

                        {/* Manômetro Aftermarket */}
                        {up.boostGaugeKit && (
                          <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-400/40">
                            ⏱️ MANÔMETRO
                          </span>
                        )}

                        {/* Multimídia */}
                        {up.multimediaKit && (
                          <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-400/40">
                            📺 2-DIN
                          </span>
                        )}

                        {/* Kit Nitro NOS */}
                        {up.hasNosKit && (
                          <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                            ⚡ NITRO
                          </span>
                        )}

                        {/* Pintura Customizada */}
                        {up.paintColor && (
                          <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/40 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: up.paintColor }} />
                            <span>PINTURA</span>
                          </span>
                        )}

                        {/* Pinças de Freio */}
                        {up.brakeCaliperColor && (
                          <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: up.brakeCaliperColor }} />
                            <span>PINÇAS</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botões de Ação do Veículo: PAINEL e DIRIGIR (Fase 1.5) */}
                    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-white/10 font-mono">
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                        {/* Botão Painel */}
                        <button
                          onClick={() => handleSelectMode(car, 'cluster')}
                          className="h-10 sm:h-11 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-700 hover:from-zinc-700 hover:to-zinc-600 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider border border-white/20 shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                          title="Visualizar apenas o Painel Original do veículo (sem mapa)"
                        >
                          <span className="text-sm sm:text-base">📟</span>
                          <span>PAINEL</span>
                        </button>

                        {/* Botão Dirigir */}
                        <button
                          onClick={() => handleSelectMode(car, 'drive')}
                          className="h-10 sm:h-11 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider border border-red-400/40 shadow-lg shadow-red-600/30 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                          title="Abrir Cockpit Completo com Mapa e Controles"
                        >
                          <span className="text-sm sm:text-base">🏎️</span>
                          <span>DIRIGIR</span>
                        </button>
                      </div>

                      {/* Ações Secundárias */}
                      <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                        <button
                          onClick={() => handleOpenWorkshop(car)}
                          className="h-7 sm:h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-400/30 font-bold text-[8.5px] sm:text-[9.5px] uppercase tracking-wide transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <span>🔧</span>
                          <span>OFICINA</span>
                        </button>

                        <button
                          onClick={() => handleOpenDyno(car)}
                          className="h-7 sm:h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sky-300 border border-sky-500/30 font-bold text-[8.5px] sm:text-[9.5px] uppercase tracking-wide transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <span>📈</span>
                          <span>DYNO</span>
                        </button>
                      </div>

                      {/* Botão de Vender */}
                      {ownedCars.length > 1 && (
                        <button
                          onClick={() => handleSellCar(car)}
                          className="w-full py-0.5 rounded text-[7.5px] sm:text-[8px] text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer text-center"
                        >
                          Vender por R$ {Math.round((VEHICLE_PRICES[car.vehicleId]?.price || 50000) * 0.7).toLocaleString()}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── ABA 2: CONCESSIONÁRIA / LOJA DE CARROS ─── */}
        {!isLoading && activeTab === 'dealership' && (
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center justify-between px-1 text-[11px] sm:text-xs font-mono text-zinc-400">
              <span>{filteredVehicles.length} modelos disponíveis</span>
              <span className="text-[9px] sm:text-[10px] text-emerald-400 font-bold">Compre quantas unidades quiser</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-6">
              {filteredVehicles.map((vehicle) => {
                const info = VEHICLE_PRICES[vehicle.id] || { price: 50000, badge: 'CATÁLOGO', description: '' }
                const ownedCount = ownedCars.filter((c) => c.vehicleId === vehicle.id).length
                const canAfford = sandboxMode || credits >= info.price

                return (
                  <div
                    key={vehicle.id}
                    className="rounded-xl sm:rounded-2xl border border-white/10 p-2.5 sm:p-3.5 lg:p-4 bg-gradient-to-b from-zinc-900/80 via-zinc-950 to-black flex flex-col justify-between gap-1.5 sm:gap-2.5 shadow-xl hover:border-white/20 transition-all car-card-landscape"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1 sm:mb-1.5">
                        <span className="text-[8.5px] sm:text-[9.5px] font-mono uppercase tracking-widest text-zinc-400">
                          {vehicle.brand}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[7px] sm:text-[7.5px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                          {info.badge}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-black text-white tracking-tight mb-1 sm:mb-1.5">
                        {vehicle.name}
                      </h3>

                      {/* Imagem do modelo */}
                      <div className="w-full h-20 sm:h-24 md:h-28 lg:h-32 rounded-lg sm:rounded-xl bg-zinc-950/90 border border-white/5 overflow-hidden relative flex items-center justify-center mb-1.5 sm:mb-2 car-thumb-landscape">
                        {vehicle.thumbnailPath ? (
                          <img
                            src={vehicle.thumbnailPath}
                            alt={vehicle.name}
                            className="w-full h-full object-contain p-1.5 sm:p-2 opacity-95 hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <span className="text-2xl sm:text-3xl">🏎️</span>
                        )}
                        {ownedCount > 0 && (
                          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[7px] sm:text-[7.5px] font-mono font-bold bg-amber-500 text-black">
                            {ownedCount} NA GARAGEM
                          </span>
                        )}
                      </div>

                      <p className="text-[8.5px] sm:text-[9.5px] font-mono text-zinc-400 mb-1.5 sm:mb-2 line-clamp-2">
                        {info.description || `${vehicle.powerHp} CV · ${vehicle.transmissionType.toUpperCase()}`}
                      </p>

                      {/* Specs Rápidas */}
                      <div className="grid grid-cols-2 gap-1 py-1 px-1.5 rounded-lg bg-black/40 border border-white/5 text-center font-mono text-[7.5px] sm:text-[8.5px] mb-1.5 sm:mb-2">
                        <div>
                          <span className="text-zinc-500 block text-[6.5px] sm:text-[7px] uppercase">Potência</span>
                          <span className="font-bold text-white">{vehicle.powerHp} CV</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[6.5px] sm:text-[7px] uppercase">Torque</span>
                          <span className="font-bold text-amber-400">{vehicle.torqueKgfm} kgfm</span>
                        </div>
                      </div>
                    </div>

                    {/* Preço e Botão de Compra em Linha Única */}
                    <div className="pt-1.5 border-t border-white/10 font-mono flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-zinc-500 block text-[7px] sm:text-[7.5px] uppercase">Preço</span>
                        <span className="font-black text-emerald-400 text-[11px] sm:text-xs truncate block">
                          {sandboxMode ? 'GRÁTIS' : `R$ ${info.price.toLocaleString()}`}
                        </span>
                      </div>

                      <button
                        onClick={() => handleBuyCar(vehicle.id)}
                        disabled={!canAfford}
                        className={`px-3.5 h-8 sm:h-9 rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-wider transition-all shadow active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                          canAfford
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                            : 'bg-zinc-800 text-zinc-500 border border-white/5 cursor-not-allowed'
                        }`}
                      >
                        <span>🛒</span>
                        <span>{canAfford ? 'COMPRAR' : 'INSUFICIENTE'}</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
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

      {/* ─── Footer ─── */}
      <footer className="flex flex-col items-center py-6 border-t border-[var(--color-border)] gap-1 mt-auto font-mono text-zinc-500 text-xs">
        <p>Heatz Auto · Simulador Automotivo v{appVersion}</p>
        <p className="text-[10px] text-zinc-600">Build {buildId} · 120Hz Real-Time Physics & Multi-Car Garage</p>
      </footer>
    </div>
  )
}
