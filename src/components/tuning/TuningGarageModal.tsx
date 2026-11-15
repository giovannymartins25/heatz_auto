import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import { useSimulationStore } from '@/stores/useSimulationStore'
import {
  useGarageStore,
  type CarUpgrades,
  type GarageCarInstance,
  type ExhaustType,
  type SuspensionHeight,
  type RearWingPosition,
} from '@/stores/useGarageStore'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'
import { DynoTestModal } from './DynoTestModal'

interface TuningGarageModalProps {
  isOpen: boolean
  onClose: () => void
  vehicle: VehicleConfig
  carInstance?: GarageCarInstance
}

export type ShopTab =
  | 'motor'
  | 'admissao'
  | 'escape'
  | 'transmissao'
  | 'suspensao'
  | 'freios'
  | 'pneus'
  | 'aerodinamica'
  | 'estetica'

export const PAINT_COLORS = [
  { name: 'Vermelho Tornado', hex: '#dc2626' },
  { name: 'Nardo Gray', hex: '#64748b' },
  { name: 'Preto Vulcano', hex: '#18181b' },
  { name: 'Branco Cristal', hex: '#f8fafc' },
  { name: 'Azul Yas Marina', hex: '#0284c7' },
  { name: 'Amarelo Speed Racing', hex: '#eab308' },
  { name: 'Verde British Racing', hex: '#15803d' },
  { name: 'Ultra Purple Midnight', hex: '#7e22ce' },
]

export const CALIPER_COLORS = [
  { name: 'Vermelho Brembo Sport', hex: '#ef4444' },
  { name: 'Amarelo Cerâmica Carbon', hex: '#facc15' },
  { name: 'Verde Neon Acid', hex: '#84cc16' },
  { name: 'Dourado Motorsport', hex: '#f59e0b' },
  { name: 'Azul Elétrico M', hex: '#06b6d4' },
]

export const TuningGarageModal = memo(function TuningGarageModal({
  isOpen,
  onClose,
  vehicle,
  carInstance,
}: TuningGarageModalProps) {
  const [activeTab, setActiveTab] = useState<ShopTab>('motor')
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)
  const [isDynoOpen, setIsDynoOpen] = useState(false)

  // Store de Simulação
  const hasTurbo = useSimulationStore((s) => s.hasTurbo)
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const setTuningStage = useSimulationStore((s) => s.setTuningStage)
  const exhaustType = useSimulationStore((s) => s.exhaustType)
  const intakeType = useSimulationStore((s) => s.intakeType)
  const tires = useSimulationStore((s) => s.tires)
  const hasRetrofitInfotainment = useSimulationStore((s) => s.hasRetrofitInfotainment)
  const hasBoostGaugeKit = useSimulationStore((s) => s.hasBoostGaugeKit)
  const hasNosKit = useSimulationStore((s) => s.hasNosKit)
  const nosPressurePercent = useSimulationStore((s) => s.nosPressurePercent)
  const refillNos = useSimulationStore((s) => s.refillNos)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const toggleExhaustValve = useSimulationStore((s) => s.toggleExhaustValve)
  const suspensionHeight = useSimulationStore((s) => s.suspensionHeight)
  const setSuspensionHeight = useSimulationStore((s) => s.setSuspensionHeight)
  const rearWingPosition = useSimulationStore((s) => s.rearWingPosition)
  const setRearWingPosition = useSimulationStore((s) => s.setRearWingPosition)
  const hasPopsAndBangs = useSimulationStore((s) => s.hasPopsAndBangs)
  const popsAndBangsEnabled = useSimulationStore((s) => s.popsAndBangsEnabled)
  const togglePopsAndBangs = useSimulationStore((s) => s.togglePopsAndBangs)
  const setEquippedUpgrades = useSimulationStore((s) => s.setEquippedUpgrades)

  // Store da Garagem
  const credits = useGarageStore((s) => s.credits)
  const sandboxMode = useGarageStore((s) => s.sandboxMode)
  const toggleSandboxMode = useGarageStore((s) => s.toggleSandboxMode)
  const addCredits = useGarageStore((s) => s.addCredits)
  const installUpgrade = useGarageStore((s) => s.installUpgrade)

  // Carro ativo
  const liveCar = useGarageStore((s) => {
    if (carInstance?.instanceId) {
      return s.getCarById(carInstance.instanceId)
    }
    return s.resolveInstanceForVehicle(vehicle.id) || s.getActiveCar()
  }) || carInstance

  const upgrades = liveCar?.upgrades

  const isOriginalTurboCar = Boolean(vehicle.engine.turbo?.enabled)
  const isDieselCar =
    vehicle.engine.engineType === 'i4_diesel' ||
    vehicle.audio.synthConfig?.engineType === 'i4_diesel' ||
    vehicle.id === 'fiat-toro-ranch-2025'

  // Upgrades ativos
  const activeStage = upgrades?.tuningStage ?? tuningStage
  const activeExhaust = (upgrades?.exhaustType ?? exhaustType) as ExhaustType
  const activeIntake = upgrades?.intakeType ?? intakeType
  const activeTires = upgrades?.tires ?? tires
  const activeSuspension = (upgrades?.suspensionHeight ?? suspensionHeight) as SuspensionHeight
  const activeWing = (upgrades?.rearWingPosition ?? rearWingPosition) as RearWingPosition
  const activeClutch = upgrades?.clutchUpgrade ?? 'stock'
  const activeBrake = upgrades?.brakeUpgrade ?? 'stock'
  const isPopsPurchased = Boolean(upgrades?.hasPopsAndBangs ?? hasPopsAndBangs)
  const isPopsActive = Boolean(upgrades?.popsAndBangsEnabled ?? popsAndBangsEnabled)
  const isTurboInstalled = isOriginalTurboCar || Boolean(upgrades?.turboKit ?? hasTurbo)
  const isMultimediaInstalled = Boolean(upgrades?.multimediaKit ?? hasRetrofitInfotainment)
  const isBoostGaugeInstalled = Boolean(upgrades?.boostGaugeKit ?? hasBoostGaugeKit)
  const isNosInstalled = Boolean(upgrades?.hasNosKit ?? hasNosKit)

  const showNotification = (msg: string) => {
    setFeedbackMsg(msg)
    HapticFeedback.light()
    setTimeout(() => setFeedbackMsg(null), 2500)
  }

  const handlePurchaseAndEquip = (
    upgradeKey: keyof CarUpgrades,
    value: any,
    price: number,
    itemName: string,
  ) => {
    if (!sandboxMode && credits < price) {
      showNotification(`❌ Saldo insuficiente! Faltam R$ ${(price - credits).toLocaleString()}`)
      return
    }

    if (!sandboxMode && price > 0) {
      addCredits(-price)
    }

    const partialUpgrade: Partial<CarUpgrades> = { [upgradeKey]: value }

    if (liveCar && liveCar.instanceId) {
      installUpgrade(liveCar.instanceId, partialUpgrade)
    }
    setEquippedUpgrades(partialUpgrade)

    if (upgradeKey === 'tuningStage') setTuningStage(value)
    if (upgradeKey === 'suspensionHeight') setSuspensionHeight(value)
    if (upgradeKey === 'rearWingPosition') setRearWingPosition(value)

    HapticFeedback.gearShift()
    showNotification(`✅ ${itemName} instalado com sucesso!`)
  }

  // Atalho Tecla ESC
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Estatísticas Dinâmicas
  const basePower = vehicle.engine.maxPower || 150
  const baseTorque = vehicle.engine.maxTorque || 200

  const stageMult = activeStage === 1 ? 1.22 : activeStage === 2 ? 1.45 : activeStage === 3 ? 1.80 : 1.0
  const turboMult = (!isOriginalTurboCar && isTurboInstalled) ? 1.40 : 1.0
  const intakeMult = activeIntake === 'cold_air' ? 1.05 : 1.0

  let exhaustMult = 1.0
  if (activeExhaust === 'straight_pipe') exhaustMult = 1.08
  else if (activeExhaust === 'downpipe') exhaustMult = isTurboInstalled ? 1.07 : 1.04
  else if (activeExhaust === 'cat_back') exhaustMult = 1.05
  else if (activeExhaust === 'sport') exhaustMult = 1.03

  const totalMult = stageMult * turboMult * intakeMult * exhaustMult
  const estimatedPower = Math.round(basePower * totalMult)
  const estimatedTorque = Math.round(baseTorque * totalMult)

  const tabs: { id: ShopTab; label: string; icon: string }[] = [
    { id: 'motor', label: 'MOTOR & ECU', icon: '⚡' },
    { id: 'admissao', label: 'ADMISSÃO', icon: '🌪️' },
    { id: 'escape', label: 'ESCAPE', icon: '💥' },
    { id: 'transmissao', label: 'TRANSMISSÃO', icon: '⚙️' },
    { id: 'suspensao', label: 'SUSPENSÃO', icon: '🏎️' },
    { id: 'freios', label: 'FREIOS', icon: '🛑' },
    { id: 'pneus', label: 'PNEUS', icon: '🛞' },
    { id: 'aerodinamica', label: 'AERO', icon: '🪽' },
    { id: 'estetica', label: 'ESTÉTICA & SOM', icon: '🎨' },
  ]

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md font-mono select-none animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-3xl rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border-2 border-white/20 p-3 sm:p-5 shadow-2xl flex flex-col gap-3 max-h-[94vh] overflow-y-auto">
        {/* ─── Topo / Cabeçalho ─── */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔧</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                  OFICINA & PREPARAÇÃO DE ALTA PERFORMANCE
                </h2>
                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {liveCar?.customName || vehicle.info.name}
                </span>
              </div>
              <span className="text-[9.5px] text-zinc-400">
                {vehicle.info.brand} {vehicle.info.name} · Impacto real na simulação determinística 120Hz
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Saldo de Créditos */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/70 border border-emerald-500/40 text-emerald-400 text-xs font-black shadow-inner">
              <span>💰</span>
              <span>R$ {sandboxMode ? '∞ ILIMITADO' : credits.toLocaleString()}</span>
            </div>

            {/* Modo Sandbox */}
            <button
              onClick={toggleSandboxMode}
              className={`px-2 py-1 rounded-xl text-[8.5px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                sandboxMode
                  ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                  : 'bg-zinc-800/80 text-zinc-400 border-white/10 hover:text-white'
              }`}
            >
              {sandboxMode ? '⚡ MODO LIVRE' : 'NORMAL'}
            </button>

            {!sandboxMode && (
              <button
                onClick={() => addCredits(50000)}
                className="px-2 py-1 rounded-xl text-[8.5px] font-black bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/40 cursor-pointer"
              >
                +R$50k
              </button>
            )}

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Feedback Toast */}
        {feedbackMsg && (
          <div className="w-full py-1 px-3 rounded-xl bg-zinc-800 border border-white/20 text-center text-xs font-bold text-white shadow-lg">
            {feedbackMsg}
          </div>
        )}

        {/* Telemetria Rápida */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-2 rounded-2xl bg-black/60 border border-white/10 text-center">
          <div className="p-1 rounded-xl bg-zinc-900/40">
            <span className="text-[7.5px] text-zinc-500 uppercase">Potência Motor</span>
            <div className="text-xs sm:text-sm font-black text-white">{estimatedPower} cv</div>
            <span className="text-[7.5px] text-emerald-400 font-bold">+{Math.round((totalMult - 1) * 100)}%</span>
          </div>

          <div className="p-1 rounded-xl bg-zinc-900/40">
            <span className="text-[7.5px] text-zinc-500 uppercase">Torque</span>
            <div className="text-xs sm:text-sm font-black text-amber-400">{estimatedTorque} Nm</div>
            <span className="text-[7.5px] text-amber-300 font-bold">+{Math.round((totalMult - 1) * 100)}%</span>
          </div>

          <div className="p-1 rounded-xl bg-zinc-900/40">
            <span className="text-[7.5px] text-zinc-500 uppercase">Indução</span>
            <div className="text-xs sm:text-sm font-black text-sky-400">
              {isTurboInstalled ? 'Turbo Ativo' : 'Aspirado'}
            </div>
            <span className="text-[7.5px] text-sky-300 font-bold">
              {vehicle.engine.engineType || vehicle.audio.synthConfig?.engineType || 'Motor Combustão'}
            </span>
          </div>

          <div className="p-1 rounded-xl bg-zinc-900/40">
            <span className="text-[7.5px] text-zinc-500 uppercase">Escapamento</span>
            <div className="text-xs sm:text-sm font-black text-orange-400 uppercase truncate">
              {activeExhaust}
            </div>
            <span className="text-[7.5px] text-zinc-400 font-bold">
              {isPopsPurchased && isPopsActive ? '🔥 Pops On' : 'Civil'}
            </span>
          </div>

          <button
            onClick={() => setIsDynoOpen(true)}
            className="col-span-2 sm:col-span-1 py-1.5 px-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-[9px] uppercase tracking-wider flex flex-col items-center justify-center shadow-lg border border-red-500/30 cursor-pointer active:scale-98"
          >
            <span>🔥 PUXADA DINAMÔMETRO</span>
            <span className="text-[7px] text-red-200">BHP vs WHP</span>
          </button>
        </div>

        {/* ─── 9 Abas da Oficina Reformulada ─── */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-black border-b border-white/10 no-scrollbar">
          {tabs.map((t) => {
            const isSel = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  isSel
                    ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-white'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* ─── Conteúdo da Aba Ativa ─── */}
        <div className="flex-1 min-h-[220px] flex flex-col gap-2">
          {/* 1. MOTOR & ECU */}
          {activeTab === 'motor' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { stage: 0, title: 'ECU Stock (Fábrica)', desc: 'Mapa original de injeção e ponto', price: 0, mult: '+0%' },
                { stage: 1, title: 'Stage 1 Remap', desc: 'Reprogramação de ECU, avanço de ponto e pressão (+22% cv)', price: 3500, mult: '+22%' },
                { stage: 2, title: 'Stage 2 Motorsport', desc: 'Mapa agressivo para intake e escape direto (+45% cv)', price: 8500, mult: '+45%' },
                { stage: 3, title: 'Stage 3 Big Turbo / Forjado', desc: 'Pistões e bielas forjadas, turbina roletada (+80% cv)', price: 24000, mult: '+80%' },
              ].map((item) => (
                <div
                  key={item.stage}
                  className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                    activeStage === item.stage
                      ? 'bg-red-950/40 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
                      : 'bg-zinc-900/70 border-white/10'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center">
                      <strong className="text-xs font-black text-white">{item.title}</strong>
                      <span className="text-[10px] text-emerald-400 font-bold">{item.mult}</span>
                    </div>
                    <p className="text-[9px] text-zinc-400 mt-1">{item.desc}</p>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] font-black text-amber-400">
                      {item.price === 0 ? 'GRÁTIS' : `R$ ${item.price.toLocaleString()}`}
                    </span>
                    <button
                      onClick={() => handlePurchaseAndEquip('tuningStage', item.stage, item.price, item.title)}
                      disabled={activeStage === item.stage}
                      className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase transition-all cursor-pointer ${
                        activeStage === item.stage
                          ? 'bg-zinc-800 text-zinc-500 cursor-default'
                          : 'bg-red-600 hover:bg-red-500 text-white'
                      }`}
                    >
                      {activeStage === item.stage ? 'EQUIPADO' : 'INSTALAR'}
                    </button>
                  </div>
                </div>
              ))}

              {/* Kit Nitro NOS */}
              <div className="col-span-1 sm:col-span-2 p-3 rounded-2xl border bg-cyan-950/20 border-cyan-500/30 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🚀</span>
                    <strong className="text-xs font-black text-cyan-300">KIT ÓXIDO NITROSO (NOS)</strong>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[8px] font-black">+120 CV</span>
                  </div>
                  <p className="text-[9px] text-zinc-400 mt-0.5">Garrafa pressurizada com injeção úmida disparada por botão no volante</p>
                </div>
                <div className="flex items-center gap-2">
                  {isNosInstalled ? (
                    <button
                      onClick={() => refillNos()}
                      className="px-3 py-1 rounded-xl text-[9px] font-black bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
                    >
                      RECARREGAR GARRAFA ({Math.round(nosPressurePercent)}%)
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePurchaseAndEquip('hasNosKit', true, 12000, 'Kit Nitro NOS')}
                      className="px-3 py-1 rounded-xl text-[9px] font-black bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
                    >
                      COMPRAR (R$ 12.000)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. ADMISSÃO */}
          {activeTab === 'admissao' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                  activeIntake === 'stock' ? 'bg-sky-950/40 border-sky-500' : 'bg-zinc-900/70 border-white/10'
                }`}
              >
                <div>
                  <strong className="text-xs font-black text-white">Filtro de Ar Original (Stock)</strong>
                  <p className="text-[9px] text-zinc-400 mt-1">Caixa de ar fechada original com elemento de papel</p>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-amber-400">GRÁTIS</span>
                  <button
                    onClick={() => handlePurchaseAndEquip('intakeType', 'stock', 0, 'Filtro Original')}
                    disabled={activeIntake === 'stock'}
                    className="px-3 py-1 rounded-xl text-[9px] font-black uppercase bg-zinc-800 text-zinc-400"
                  >
                    {activeIntake === 'stock' ? 'EQUIPADO' : 'INSTALAR'}
                  </button>
                </div>
              </div>

              <div
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                  activeIntake === 'cold_air' ? 'bg-sky-950/40 border-sky-500' : 'bg-zinc-900/70 border-white/10'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center">
                    <strong className="text-xs font-black text-white">Cold Air Intake Cônico Esportivo</strong>
                    <span className="text-[9px] text-sky-400 font-bold">+5% CV</span>
                  </div>
                  <p className="text-[9px] text-zinc-400 mt-1">Duto de alumínio polido com filtro cônico de alta vazão e som de sucção alto</p>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-amber-400">R$ 1.800</span>
                  <button
                    onClick={() => handlePurchaseAndEquip('intakeType', 'cold_air', 1800, 'Cold Air Intake')}
                    disabled={activeIntake === 'cold_air'}
                    className="px-3 py-1 rounded-xl text-[9px] font-black uppercase bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                  >
                    {activeIntake === 'cold_air' ? 'EQUIPADO' : 'INSTALAR'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. ESCAPE */}
          {activeTab === 'escape' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { type: 'stock' as ExhaustType, title: 'Original de Fábrica', desc: 'Silencioso, abafadores e catalisadores originais', mult: '+0%', price: 0, turboOnly: false },
                { type: 'sport' as ExhaustType, title: 'Escape Esportivo Sport', desc: 'Ponteiras duplas em inox e ronco encorpado (+3% cv)', mult: '+3%', price: 2800, turboOnly: false },
                { type: 'cat_back' as ExhaustType, title: 'Sistema Cat-Back', desc: 'Troca abafadores intermediário e final, preservando catalisador (+5% cv)', mult: '+5%', price: 4600, turboOnly: false },
                {
                  type: 'downpipe' as ExhaustType,
                  title: 'Downpipe de Alto Fluxo',
                  desc: isTurboInstalled ? 'Fluxo livre imediato na saída da turbina, reduzindo contrapressão (+7% cv)' : 'INCOMPATÍVEL: Requer motor turboalimentado',
                  mult: '+7%',
                  price: 5800,
                  turboOnly: true,
                },
                { type: 'straight_pipe' as ExhaustType, title: 'Straight Pipe (Direto)', desc: 'Cano direto em inox 3 pol sem abafador. Ronco ensurdecedor (+8% cv)', mult: '+8%', price: 7200, turboOnly: false },
              ].map((item) => {
                const isBlocked = item.turboOnly && !isTurboInstalled
                const isEquipped = activeExhaust === item.type
                return (
                  <div
                    key={item.type}
                    className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                      isEquipped
                        ? 'bg-amber-950/40 border-amber-500'
                        : isBlocked
                        ? 'bg-zinc-950/40 border-zinc-800 opacity-60'
                        : 'bg-zinc-900/70 border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center">
                        <strong className="text-xs font-black text-white">{item.title}</strong>
                        <span className="text-[9px] text-amber-400 font-bold">{item.mult}</span>
                      </div>
                      <p className={`text-[8.5px] mt-1 ${isBlocked ? 'text-rose-400 font-bold' : 'text-zinc-400'}`}>
                        {item.desc}
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-amber-400">
                        {item.price === 0 ? 'GRÁTIS' : `R$ ${item.price.toLocaleString()}`}
                      </span>
                      <button
                        onClick={() => handlePurchaseAndEquip('exhaustType', item.type, item.price, item.title)}
                        disabled={isEquipped || isBlocked}
                        className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase transition-all ${
                          isEquipped
                            ? 'bg-zinc-800 text-zinc-500 cursor-default'
                            : isBlocked
                            ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                            : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                        }`}
                      >
                        {isEquipped ? 'EQUIPADO' : isBlocked ? 'INCOMPATÍVEL' : 'INSTALAR'}
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Botão de Válvula de Difusor PSE */}
              <div className="col-span-1 sm:col-span-2 p-2.5 rounded-2xl border bg-black/60 border-white/10 flex items-center justify-between">
                <div>
                  <strong className="text-xs font-black text-amber-300">Válvula Ativa de Escape (PSE / Difusor)</strong>
                  <p className="text-[8.5px] text-zinc-400">Abre as borboletas de escape para ronco direto sob demanda</p>
                </div>
                <button
                  onClick={toggleExhaustValve}
                  className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase border transition-all cursor-pointer ${
                    exhaustValveOpen
                      ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                      : 'bg-zinc-800 text-zinc-400 border-white/10'
                  }`}
                >
                  {exhaustValveOpen ? 'VÁLVULA ABERTA (ROAR)' : 'SILENCIOSO'}
                </button>
              </div>
            </div>
          )}

          {/* 4. TRANSMISSÃO */}
          {activeTab === 'transmissao' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                  activeClutch === 'stock' ? 'bg-orange-950/30 border-orange-500' : 'bg-zinc-900/70 border-white/10'
                }`}
              >
                <div>
                  <strong className="text-xs font-black text-white">Embreagem Original (Stock)</strong>
                  <p className="text-[9px] text-zinc-400 mt-1">Disco orgânico convencional para uso diário civil</p>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-amber-400">GRÁTIS</span>
                  <button
                    onClick={() => handlePurchaseAndEquip('clutchUpgrade', 'stock', 0, 'Embreagem Stock')}
                    disabled={activeClutch === 'stock'}
                    className="px-3 py-1 rounded-xl text-[9px] font-black uppercase bg-zinc-800 text-zinc-400"
                  >
                    {activeClutch === 'stock' ? 'EQUIPADO' : 'INSTALAR'}
                  </button>
                </div>
              </div>

              <div
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                  activeClutch === 'ceramic' ? 'bg-orange-950/30 border-orange-500' : 'bg-zinc-900/70 border-white/10'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center">
                    <strong className="text-xs font-black text-white">Embreagem Multidisco Cerâmica</strong>
                    <span className="text-[9px] text-orange-400 font-bold">900 Nm Grip</span>
                  </div>
                  <p className="text-[9px] text-zinc-400 mt-1">Platô pesado de 6 pastilhas cerâmicas anti-patinamento para arrancadas fortes</p>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-amber-400">R$ 3.900</span>
                  <button
                    onClick={() => handlePurchaseAndEquip('clutchUpgrade', 'ceramic', 3900, 'Embreagem Cerâmica')}
                    disabled={activeClutch === 'ceramic'}
                    className="px-3 py-1 rounded-xl text-[9px] font-black uppercase bg-orange-600 hover:bg-orange-500 text-white cursor-pointer"
                  >
                    {activeClutch === 'ceramic' ? 'EQUIPADO' : 'INSTALAR'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. SUSPENSÃO */}
          {activeTab === 'suspensao' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { height: 'stock' as SuspensionHeight, title: 'Suspensão Original (0mm)', desc: 'Altura e curso de fábrica para conforto de rua', price: 0 },
                { height: 'sport' as SuspensionHeight, title: 'Molas Esportivas (-15mm)', desc: 'Centro de massa mais baixo, menos rolagem de carroceria', price: 2200 },
                { height: 'track' as SuspensionHeight, title: 'Coilovers Competição (-30mm)', desc: 'Setup pista, transferência longitudinal de peso otimizada', price: 6500 },
                { height: 'lift' as SuspensionHeight, title: 'Front Axle Lift (+30mm)', desc: 'Elevação pneumática dianteira para transposição de obstáculos', price: 8900 },
              ].map((item) => {
                const isEq = activeSuspension === item.height
                return (
                  <div
                    key={item.height}
                    className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                      isEq ? 'bg-amber-950/40 border-amber-500' : 'bg-zinc-900/70 border-white/10'
                    }`}
                  >
                    <div>
                      <strong className="text-xs font-black text-white">{item.title}</strong>
                      <p className="text-[9px] text-zinc-400 mt-1">{item.desc}</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-amber-400">
                        {item.price === 0 ? 'GRÁTIS' : `R$ ${item.price.toLocaleString()}`}
                      </span>
                      <button
                        onClick={() => handlePurchaseAndEquip('suspensionHeight', item.height, item.price, item.title)}
                        disabled={isEq}
                        className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase transition-all ${
                          isEq ? 'bg-zinc-800 text-zinc-500 cursor-default' : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                        }`}
                      >
                        {isEq ? 'EQUIPADO' : 'INSTALAR'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 6. FREIOS */}
          {activeTab === 'freios' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                  activeBrake === 'stock' ? 'bg-red-950/40 border-red-500' : 'bg-zinc-900/70 border-white/10'
                }`}
              >
                <div>
                  <strong className="text-xs font-black text-white">Freios Originais de Fábrica</strong>
                  <p className="text-[9px] text-zinc-400 mt-1">Discos ventilados convencionais e pastilhas semimetálicas</p>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-amber-400">GRÁTIS</span>
                  <button
                    onClick={() => handlePurchaseAndEquip('brakeUpgrade', 'stock', 0, 'Freios Stock')}
                    disabled={activeBrake === 'stock'}
                    className="px-3 py-1 rounded-xl text-[9px] font-black uppercase bg-zinc-800 text-zinc-400"
                  >
                    {activeBrake === 'stock' ? 'EQUIPADO' : 'INSTALAR'}
                  </button>
                </div>
              </div>

              <div
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                  activeBrake === 'sport' ? 'bg-red-950/40 border-red-500' : 'bg-zinc-900/70 border-white/10'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center">
                    <strong className="text-xs font-black text-white">Kit Freios Brembo Carbon-Ceramic</strong>
                    <span className="text-[9px] text-rose-400 font-bold">+35% Potência de Frenagem</span>
                  </div>
                  <p className="text-[9px] text-zinc-400 mt-1">Pinças de 6 pistões monobloco, discos perfurados flutuantes e aeroquip</p>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-amber-400">R$ 14.500</span>
                  <button
                    onClick={() => handlePurchaseAndEquip('brakeUpgrade', 'sport', 14500, 'Freios Brembo')}
                    disabled={activeBrake === 'sport'}
                    className="px-3 py-1 rounded-xl text-[9px] font-black uppercase bg-red-600 hover:bg-red-500 text-white cursor-pointer"
                  >
                    {activeBrake === 'sport' ? 'EQUIPADO' : 'INSTALAR'}
                  </button>
                </div>
              </div>

              {/* Cores de Pinça de Freio */}
              <div className="col-span-1 sm:col-span-2 p-2.5 rounded-2xl border bg-black/60 border-white/10">
                <span className="text-[9px] font-bold text-zinc-400 uppercase">Cores das Pinças de Freio</span>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {CALIPER_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => handlePurchaseAndEquip('caliperColor', c.hex, 800, `Pinça ${c.name}`)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-zinc-900 border border-white/10 hover:border-white text-[8px] text-zinc-300 cursor-pointer"
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.hex }} />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7. PNEUS */}
          {activeTab === 'pneus' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                  activeTires === 'street' ? 'bg-zinc-800 border-white/30' : 'bg-zinc-900/70 border-white/10'
                }`}
              >
                <div>
                  <strong className="text-xs font-black text-white">Pneus Radiais de Rua (Stock)</strong>
                  <p className="text-[9px] text-zinc-400 mt-1">Aderência base para durabilidade urbana (µ = 0.95)</p>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-amber-400">GRÁTIS</span>
                  <button
                    onClick={() => handlePurchaseAndEquip('tires', 'street', 0, 'Pneus de Rua')}
                    disabled={activeTires === 'street'}
                    className="px-3 py-1 rounded-xl text-[9px] font-black uppercase bg-zinc-800 text-zinc-400"
                  >
                    {activeTires === 'street' ? 'EQUIPADO' : 'INSTALAR'}
                  </button>
                </div>
              </div>

              <div
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                  activeTires === 'semi_slick' ? 'bg-rose-950/40 border-rose-500' : 'bg-zinc-900/70 border-white/10'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center">
                    <strong className="text-xs font-black text-white">Pneus Semi-Slick Motorsport UHP</strong>
                    <span className="text-[9px] text-rose-400 font-bold">µ = 1.25 Grip</span>
                  </div>
                  <p className="text-[9px] text-zinc-400 mt-1">Composto de borracha de alta temperatura para arrancadas sem destracionar</p>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-amber-400">R$ 5.200</span>
                  <button
                    onClick={() => handlePurchaseAndEquip('tires', 'semi_slick', 5200, 'Pneus Semi-Slick')}
                    disabled={activeTires === 'semi_slick'}
                    className="px-3 py-1 rounded-xl text-[9px] font-black uppercase bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                  >
                    {activeTires === 'semi_slick' ? 'EQUIPADO' : 'INSTALAR'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 8. AERODINÂMICA */}
          {activeTab === 'aerodinamica' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { pos: 'low_drag' as RearWingPosition, title: 'Low Drag (Arrasto Baixo)', desc: 'Ângulo raso de asa para atingir velocidade final máxima em retas longas', mult: 'Max V-Max' },
                { pos: 'balanced' as RearWingPosition, title: 'Balanced (Equilibrado)', desc: 'Equilíbrio aerodinâmico entre carga e resistência para circuitos mistos', mult: 'Setup Misto' },
                { pos: 'high_downforce' as RearWingPosition, title: 'High Downforce (Carga Máxima)', desc: 'Asa inclinada com carga quadrática máxima F = CL * v² para contorno de curvas', mult: 'Max Grip Curva' },
              ].map((item) => {
                const isEq = activeWing === item.pos
                return (
                  <div
                    key={item.pos}
                    className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                      isEq ? 'bg-red-950/40 border-red-500' : 'bg-zinc-900/70 border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center">
                        <strong className="text-xs font-black text-white">{item.title}</strong>
                      </div>
                      <span className="text-[8px] text-red-400 font-bold block mt-0.5">{item.mult}</span>
                      <p className="text-[8.5px] text-zinc-400 mt-1">{item.desc}</p>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] font-black text-amber-400">AJUSTE</span>
                      <button
                        onClick={() => handlePurchaseAndEquip('rearWingPosition', item.pos, 0, item.title)}
                        disabled={isEq}
                        className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase transition-all ${
                          isEq ? 'bg-zinc-800 text-zinc-500 cursor-default' : 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                        }`}
                      >
                        {isEq ? 'ATIVO' : 'SELECIONAR'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 9. ESTÉTICA & SOM (POPS AND BANGS) */}
          {activeTab === 'estetica' && (
            <div className="flex flex-col gap-2">
              {/* Pops and Bangs Especial */}
              <div
                className={`p-3 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                  isDieselCar
                    ? 'bg-zinc-950/50 border-zinc-800 opacity-60'
                    : isPopsPurchased
                    ? 'bg-amber-950/30 border-amber-500'
                    : 'bg-zinc-900/70 border-white/10'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">💥</span>
                    <strong className="text-xs font-black text-white">MAPA POPS AND BANGS (OVERRUN CRACKLE)</strong>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                      isDieselCar
                        ? 'bg-rose-500/20 text-rose-300'
                        : isPopsPurchased && isPopsActive
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {isDieselCar ? 'INCOMPATÍVEL COM MOTOR DIESEL' : isPopsPurchased ? (isPopsActive ? 'LIGADO' : 'DESLIGADO') : 'NÃO ADQUIRIDO'}
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-400 mt-1">
                    {isDieselCar
                      ? 'Motores diesel operam por compressão sem borboleta de aceleração; estampidos de overrun não são aplicáveis.'
                      : 'Atraso de ponto de ignição e injeção de combustível na desaceleração para produzir estampidos fortes e labaredas no escapamento.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isDieselCar ? (
                    <span className="text-[9px] text-rose-400 font-bold">BLOQUEADO DIESEL</span>
                  ) : isPopsPurchased ? (
                    <button
                      onClick={togglePopsAndBangs}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all cursor-pointer ${
                        isPopsActive
                          ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                          : 'bg-zinc-800 text-zinc-400 border-white/10'
                      }`}
                    >
                      {isPopsActive ? '💥 POPS ATIVOS (ON)' : '🔇 DESATIVADO (OFF)'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        handlePurchaseAndEquip('hasPopsAndBangs', true, 3200, 'Mapa Pops and Bangs')
                        handlePurchaseAndEquip('popsAndBangsEnabled', true, 0, 'Pops Ativados')
                      }}
                      className="px-3 py-1.5 rounded-xl text-[9px] font-black bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
                    >
                      ADQUIRIR MAPA (R$ 3.200)
                    </button>
                  )}
                </div>
              </div>

              {/* Retrofit Multimídia e Manômetro de Turbo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-3 rounded-2xl border bg-black/60 border-white/10 flex items-center justify-between">
                  <div>
                    <strong className="text-xs font-black text-white">Central Multimídia Retrofit</strong>
                    <p className="text-[8.5px] text-zinc-400">Instala central com GPS, músicas e ar-condicionado digital</p>
                  </div>
                  <button
                    onClick={() => handlePurchaseAndEquip('multimediaKit', !isMultimediaInstalled, 4500, 'Central Multimídia')}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all cursor-pointer ${
                      isMultimediaInstalled ? 'bg-sky-600 text-white border-sky-400' : 'bg-zinc-800 text-zinc-400 border-white/10'
                    }`}
                  >
                    {isMultimediaInstalled ? 'INSTALADA' : 'INSTALAR (R$ 4.500)'}
                  </button>
                </div>

                <div className="p-3 rounded-2xl border bg-black/60 border-white/10 flex items-center justify-between">
                  <div>
                    <strong className="text-xs font-black text-white">Manômetro de Turbo Analógico</strong>
                    <p className="text-[8.5px] text-zinc-400">Relógio de pressão de turbo na coluna com ponteiro luminoso</p>
                  </div>
                  <button
                    onClick={() => handlePurchaseAndEquip('boostGaugeKit', !isBoostGaugeInstalled, 1200, 'Manômetro de Pressão')}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all cursor-pointer ${
                      isBoostGaugeInstalled ? 'bg-amber-600 text-white border-amber-400' : 'bg-zinc-800 text-zinc-400 border-white/10'
                    }`}
                  >
                    {isBoostGaugeInstalled ? 'INSTALADO' : 'INSTALAR (R$ 1.200)'}
                  </button>
                </div>
              </div>

              {/* Pinturas da Carroceria */}
              <div className="p-3 rounded-2xl border bg-black/60 border-white/10">
                <span className="text-[9px] font-bold text-zinc-400 uppercase">Pintura da Carroceria</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {PAINT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => handlePurchaseAndEquip('bodyColor', c.hex, 2500, `Pintura ${c.name}`)}
                      className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900 border border-white/10 hover:border-white text-[9px] text-zinc-200 cursor-pointer"
                    >
                      <span className="h-4 w-4 rounded-full border border-white/30 shrink-0" style={{ backgroundColor: c.hex }} />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isDynoOpen && (
        <DynoTestModal
          config={vehicle}
          upgrades={liveCar?.upgrades}
          onClose={() => setIsDynoOpen(false)}
        />
      )}
    </div>
  )
})
