import { memo, useState } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useGarageStore, type CarUpgrades } from '@/stores/useGarageStore'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'

interface TuningGarageModalProps {
  isOpen: boolean
  onClose: () => void
  vehicle: VehicleConfig
}

type ShopTab = 'motor' | 'escape' | 'intake' | 'chassi' | 'interior'

/**
 * TuningGarageModal — Loja de Aprimoramentos & Oficina de Peças Automotivas
 *
 * Permite equipar e aprimorar qualquer veículo:
 * - Kits Turbo & Stages de ECU (0 a 3)
 * - Escapamentos (Original, Esportivo e Direto Straight Pipe com tiros e labaredas)
 * - Admissão de Ar (Filtro Original vs Intake Cônico K&N de alta vazão)
 * - Pneus (Radiais de Rua vs Semi-Slick de Arrancada com aderência ultra-alta)
 * - Central Multimídia Retrofit 2-DIN para carros que não vinham com tela de fábrica
 * - Sistema de créditos reais ou Modo Sandbox (dinheiro infinito/grátis)
 */
export const TuningGarageModal = memo(function TuningGarageModal({
  isOpen,
  onClose,
  vehicle,
}: TuningGarageModalProps) {
  const [activeTab, setActiveTab] = useState<ShopTab>('motor')
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  // Estado da Simulação em tempo real
  const hasTurbo = useSimulationStore((s) => s.hasTurbo)
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const setTuningStage = useSimulationStore((s) => s.setTuningStage)
  const exhaustType = useSimulationStore((s) => s.exhaustType)
  const intakeType = useSimulationStore((s) => s.intakeType)
  const tires = useSimulationStore((s) => s.tires)
  const hasRetrofitInfotainment = useSimulationStore((s) => s.hasRetrofitInfotainment)
  const exhaustValveOpen = useSimulationStore((s) => s.exhaustValveOpen)
  const toggleExhaustValve = useSimulationStore((s) => s.toggleExhaustValve)
  const setEquippedUpgrades = useSimulationStore((s) => s.setEquippedUpgrades)

  // Estado da Garagem (Persistência, Créditos e Instância Ativa)
  const credits = useGarageStore((s) => s.credits)
  const sandboxMode = useGarageStore((s) => s.sandboxMode)
  const toggleSandboxMode = useGarageStore((s) => s.toggleSandboxMode)
  const addCredits = useGarageStore((s) => s.addCredits)
  const getActiveCar = useGarageStore((s) => s.getActiveCar)
  const installUpgrade = useGarageStore((s) => s.installUpgrade)

  if (!isOpen) return null

  const activeCar = getActiveCar()
  const isOriginalTurboCar = Boolean(vehicle.engine.turbo?.enabled)
  const isOriginalInfotainmentCar = Boolean(
    vehicle.dashboard?.hasInfotainment ||
    (vehicle.id !== 'gol-g6' &&
      vehicle.id !== 'gol-quadrado-turbo' &&
      vehicle.id !== 'cb1000r' &&
      vehicle.info.category !== 'motorcycle')
  )

  const showNotification = (msg: string) => {
    setFeedbackMsg(msg)
    HapticFeedback.light()
    setTimeout(() => setFeedbackMsg(null), 2500)
  }

  const handlePurchaseAndEquip = (
    upgradeKey: keyof CarUpgrades,
    value: any,
    price: number,
    itemName: string
  ) => {
    if (!sandboxMode && credits < price) {
      showNotification(`❌ Saldo insuficiente! Faltam R$ ${(price - credits).toLocaleString()}`)
      return
    }

    if (!sandboxMode && price > 0) {
      addCredits(-price)
    }

    const partialUpgrade: Partial<CarUpgrades> = { [upgradeKey]: value }

    if (activeCar) {
      installUpgrade(activeCar.instanceId, partialUpgrade)
    }
    setEquippedUpgrades(partialUpgrade)

    if (upgradeKey === 'tuningStage') {
      setTuningStage(value)
    }

    HapticFeedback.gearShift()
    showNotification(`✅ ${itemName} instalado com sucesso!`)
  }

  // Estatísticas Dinâmicas do Motor com Modificadores
  const basePower = vehicle.engine.maxPower || 150
  const baseTorque = vehicle.engine.maxTorque || 200
  const baseBoost = vehicle.engine.turbo?.maxBoostBar || 1.15

  const stageMult = tuningStage === 1 ? 1.25 : tuningStage === 2 ? 1.50 : tuningStage === 3 ? 1.85 : 1.0
  const turboMult = (!isOriginalTurboCar && hasTurbo) ? 1.45 : 1.0
  const intakeMult = intakeType === 'cold_air' ? 1.06 : 1.0
  const exhaustMult = exhaustType === 'straight_pipe' ? 1.08 : exhaustType === 'sport' ? 1.04 : 1.0

  const totalMult = stageMult * turboMult * intakeMult * exhaustMult
  const estimatedPower = Math.round(basePower * totalMult)
  const estimatedTorque = Math.round(baseTorque * totalMult)
  const estimatedBoost = hasTurbo
    ? (isOriginalTurboCar ? baseBoost : 1.1) + (tuningStage === 1 ? 0.35 : tuningStage === 2 ? 0.65 : tuningStage === 3 ? 1.15 : 0)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md font-mono select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border-2 border-white/20 p-4 sm:p-6 shadow-2xl flex flex-col gap-3.5 max-h-[94vh] overflow-y-auto">
        
        {/* ─── Topo / Cabeçalho da Oficina ─── */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🔧</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                  LOJA DE PEÇAS & APRIMORAMENTOS
                </h2>
                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {activeCar?.customName || vehicle.info.name}
                </span>
              </div>
              <span className="text-[10px] text-zinc-400">
                {vehicle.info.brand} {vehicle.info.name} · Instalação em tempo real com física 120Hz
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Saldo de Créditos */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/70 border border-emerald-500/40 text-emerald-400 text-xs font-black shadow-inner">
              <span>💰</span>
              <span>R$ {sandboxMode ? '∞ ILIMITADO' : credits.toLocaleString()}</span>
            </div>

            {/* Alternar Modo Sandbox */}
            <button
              onClick={toggleSandboxMode}
              className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                sandboxMode
                  ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                  : 'bg-zinc-800/80 text-zinc-400 border-white/10 hover:text-white'
              }`}
              title="Ativa compras 100% grátis sem descontar saldo"
            >
              {sandboxMode ? '⚡ MODO LIVRE ATIVO' : 'MODO NORMAL'}
            </button>

            {/* Recarregar +R$50k */}
            {!sandboxMode && (
              <button
                onClick={() => addCredits(50000)}
                className="px-2 py-1 rounded-xl text-[9px] font-black bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/40 cursor-pointer"
                title="Adiciona R$ 50.000 para testes"
              >
                + R$50k
              </button>
            )}

            {/* Fechar Modal */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ─── Feedback Toast ─── */}
        {feedbackMsg && (
          <div className="w-full py-1.5 px-3 rounded-xl bg-zinc-800 border border-white/20 text-center text-xs font-bold text-white shadow-lg animate-in slide-in-from-top-1 duration-150">
            {feedbackMsg}
          </div>
        )}

        {/* ─── Banner de Telemetria Dinâmica do Motor ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 rounded-2xl bg-black/60 border border-white/10 text-center">
          <div className="flex flex-col items-center justify-center p-1 rounded-xl bg-zinc-900/40">
            <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Potência Estimada</span>
            <span className="text-sm font-black text-white">{estimatedPower} cv</span>
            <span className="text-[8px] text-emerald-400 font-bold">+{Math.round((totalMult - 1) * 100)}%</span>
          </div>

          <div className="flex flex-col items-center justify-center p-1 rounded-xl bg-zinc-900/40">
            <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Torque Dinâmico</span>
            <span className="text-sm font-black text-amber-400">{estimatedTorque} Nm</span>
            <span className="text-[8px] text-amber-300 font-bold">+{Math.round((totalMult - 1) * 100)}%</span>
          </div>

          <div className="flex flex-col items-center justify-center p-1 rounded-xl bg-zinc-900/40">
            <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Pressão de Turbo</span>
            <span className="text-sm font-black text-sky-400">
              {hasTurbo ? `${estimatedBoost.toFixed(2)} bar` : 'Aspirado'}
            </span>
            <span className="text-[8px] text-sky-300 font-bold">{hasTurbo ? 'Turbinado' : 'Natural'}</span>
          </div>

          <div className="flex flex-col items-center justify-center p-1 rounded-xl bg-zinc-900/40">
            <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Aderência Pneus</span>
            <span className="text-sm font-black text-rose-400">
              {tires === 'semi_slick' ? '1.22 µ (Grip Max)' : '0.95 µ (Rua)'}
            </span>
            <span className="text-[8px] text-rose-300 font-bold">{tires === 'semi_slick' ? 'Semi-Slick' : 'Radial'}</span>
          </div>

          <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center p-1 rounded-xl bg-zinc-900/40">
            <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Escape & Tiros</span>
            <span className={`text-xs font-black ${exhaustType === 'straight_pipe' ? 'text-orange-400' : 'text-zinc-300'}`}>
              {exhaustType === 'straight_pipe' ? '💥 TIROS / DIRETO' : exhaustType === 'sport' ? '⚡ ESPORTIVO' : 'ORIGINAL'}
            </span>
            <span className="text-[8px] text-zinc-400 font-bold">{exhaustValveOpen ? 'Válvula Aberta' : 'Silencioso'}</span>
          </div>
        </div>

        {/* ─── Abas da Loja ─── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-black border-b border-white/10">
          <button
            onClick={() => setActiveTab('motor')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'motor'
                ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-white'
            }`}
          >
            <span>⚡</span>
            <span>MOTOR & TURBO</span>
          </button>

          <button
            onClick={() => setActiveTab('escape')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'escape'
                ? 'bg-amber-600 text-white shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-white'
            }`}
          >
            <span>💥</span>
            <span>ESCAPE & TIROS</span>
          </button>

          <button
            onClick={() => setActiveTab('intake')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'intake'
                ? 'bg-sky-600 text-white shadow-[0_0_12px_rgba(2,132,199,0.5)]'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-white'
            }`}
          >
            <span>🌪️</span>
            <span>ADMISSÃO / INTAKE</span>
          </button>

          <button
            onClick={() => setActiveTab('chassi')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'chassi'
                ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-white'
            }`}
          >
            <span>🏁</span>
            <span>PNEUS & ADERÊNCIA</span>
          </button>

          <button
            onClick={() => setActiveTab('interior')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'interior'
                ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(147,51,234,0.5)]'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-white'
            }`}
          >
            <span>📺</span>
            <span>MULTIMÍDIA RETROFIT</span>
          </button>
        </div>

        {/* ─── CONTEÚDO DA ABA 1: MOTOR & TURBO ─── */}
        {activeTab === 'motor' && (
          <div className="flex flex-col gap-3">
            {/* Seção Kit Turbo */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🌀</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-black text-white uppercase">
                      KIT TURBOCOMPRESSOR FORJADO + INTERCOOLER
                    </h3>
                    {hasTurbo && (
                      <span className="px-2 py-0.5 rounded text-[8px] font-black bg-sky-500/20 text-sky-300 border border-sky-400/30">
                        INSTALADO
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5 max-w-lg">
                    {isOriginalTurboCar
                      ? 'Este carro já possui turbocompressor de fábrica. Equipado com wastegate e intercooler de alto rendimento.'
                      : 'Transforma o motor originalmente aspirado em um monstro turboalimentado! Ganho maciço de torque (+45%), espirros de blow-off, caracol de alta vazão e manômetro de pressão digital ativo.'}
                  </p>
                </div>
              </div>

              {!isOriginalTurboCar ? (
                <button
                  onClick={() =>
                    handlePurchaseAndEquip(
                      'turboKit',
                      !hasTurbo,
                      hasTurbo ? 0 : 14500,
                      hasTurbo ? 'Kit Turbo removido' : 'Kit Turbo Forjado'
                    )
                  }
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all shrink-0 ${
                    hasTurbo
                      ? 'bg-zinc-800 text-zinc-400 hover:text-red-400 border border-white/10'
                      : 'bg-sky-500 hover:bg-sky-400 text-black font-black shadow-[0_0_15px_rgba(14,165,233,0.6)]'
                  }`}
                >
                  {hasTurbo ? 'DESINSTALAR KIT' : 'COMPRAR KIT TURBO (R$ 14.500)'}
                </button>
              ) : (
                <span className="text-[10px] text-emerald-400 font-bold px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20 shrink-0">
                  TURBO DE FÁBRICA
                </span>
              )}
            </div>

            {/* Seção Estágios de Reprogramação (ECU Stages) */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                ESTÁGIOS DE REPROGRAMAÇÃO DA ECU (MAPAS DE INJEÇÃO E PONTO)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    stage: 0 as const,
                    name: 'STAGE 0 (STOCK FÁBRICA)',
                    subtitle: 'Calibração original de montadora',
                    price: 0,
                    powerGain: '0%',
                    torqueGain: '0%',
                    perks: ['Garantia preservada', 'Consumo equilibrado', 'Emissões padrão'],
                    accent: 'border-zinc-700 text-zinc-300',
                    activeBg: 'bg-zinc-800/90 border-white text-white',
                  },
                  {
                    stage: 1 as const,
                    name: 'STAGE 1 (REMAP ECU)',
                    subtitle: 'Injeção esportiva & ponto de ignição adiantado',
                    price: 3800,
                    powerGain: '+25%',
                    torqueGain: '+25%',
                    perks: ['+400 RPM no corte de giro', '+0.35 bar de pressão de turbo', 'Acelerador sem delay'],
                    accent: 'border-blue-500/50 text-blue-400',
                    activeBg: 'bg-blue-950/70 border-blue-400 text-blue-200 shadow-[0_0_20px_rgba(59,130,246,0.5)]',
                  },
                  {
                    stage: 2 as const,
                    name: 'STAGE 2 (DOWNPIPE + REMAP AGRESSIVO)',
                    subtitle: 'Mais pressão de turbo, corte alto & Pops',
                    price: 8500,
                    powerGain: '+50%',
                    torqueGain: '+50%',
                    perks: ['Estampidos de Pops & Bangs na desaceleração', '+0.65 bar no turbo', 'Fluxo otimizado'],
                    accent: 'border-amber-500/50 text-amber-400',
                    activeBg: 'bg-amber-950/70 border-amber-400 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.5)]',
                  },
                  {
                    stage: 3 as const,
                    name: 'STAGE 3 (RACING MOTORSPORT FORJADO)',
                    subtitle: 'Ponto agressivo, Boost Máximo & Corte Estridente',
                    price: 19000,
                    powerGain: '+85%',
                    torqueGain: '+85%',
                    perks: ['+1.15 bar de pressão extra', 'Arrancada brutal', 'Berro estridente no limite'],
                    accent: 'border-red-500/50 text-red-400',
                    activeBg: 'bg-red-950/70 border-red-500 text-red-200 shadow-[0_0_25px_rgba(239,68,68,0.7)]',
                  },
                ].map((st) => {
                  const isSelected = tuningStage === st.stage
                  return (
                    <div
                      key={st.stage}
                      onClick={() =>
                        handlePurchaseAndEquip(
                          'tuningStage',
                          st.stage,
                          isSelected ? 0 : st.price,
                          st.name
                        )
                      }
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                        isSelected ? st.activeBg : 'bg-zinc-900/40 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-black tracking-wide block text-white">
                            {st.name}
                          </span>
                          <span className="text-[9px] text-zinc-400 block mt-0.5 leading-tight">
                            {st.subtitle}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider ${
                            isSelected ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {isSelected ? 'EQUIPADO' : st.price === 0 ? 'GRÁTIS' : `R$ ${st.price.toLocaleString()}`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1 py-1 px-2 rounded-xl bg-black/40 border border-white/5 text-center">
                        <div>
                          <span className="text-[8px] text-zinc-500 uppercase block">Ganho Força</span>
                          <span className="text-xs font-black text-amber-400">{st.torqueGain}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-500 uppercase block">Ganho Potência</span>
                          <span className="text-xs font-black text-emerald-400">{st.powerGain}</span>
                        </div>
                      </div>

                      <ul className="text-[8.5px] text-zinc-400 flex flex-col gap-0.5">
                        {st.perks.map((p, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <span className="text-emerald-400">✓</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── CONTEÚDO DA ABA 2: ESCAPAMENTO & TIROS (POPS & BANGS) ─── */}
        {activeTab === 'escape' && (
          <div className="flex flex-col gap-3">
            {/* Válvula de Difusor Rápida */}
            <div className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-900/80 border border-white/10 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📢</span>
                <div>
                  <span className="font-bold text-white block text-[11px]">VÁLVULA DE ESCAPE / DIFUSOR (TECLA V)</span>
                  <span className="text-[9px] text-zinc-400">
                    {exhaustValveOpen
                      ? 'Válvula aberta: fluxo desobstruído, estalos agressivos e labaredas de fogo'
                      : 'Válvula fechada: fluxo pelo abafador civil e silencioso'}
                  </span>
                </div>
              </div>

              <button
                onClick={toggleExhaustValve}
                className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                  exhaustValveOpen
                    ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                    : 'bg-zinc-800 text-zinc-400 border border-white/10'
                }`}
              >
                {exhaustValveOpen ? 'DIFUSOR ABERTO (V)' : 'DIFUSOR FECHADO'}
              </button>
            </div>

            {/* Tipos de Escapamento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'stock' as const,
                  name: 'ORIGINAL DE FÁBRICA',
                  subtitle: 'Abafadores originais com catalisador',
                  price: 0,
                  badge: 'CIVIL',
                  features: ['Som abafado e silencioso', 'Zero estampidos', 'Fluxo padrão de montadora'],
                  activeBg: 'bg-zinc-800/90 border-white text-white',
                },
                {
                  id: 'sport' as const,
                  name: 'ESPORTIVO INOX COM DIFUSOR',
                  subtitle: 'Downpipe dimensionado + Abafador de fluxo livre',
                  price: 3200,
                  badge: '+4% CV · ROAR',
                  features: ['Ronco esportivo encorpado', 'Estalos suaves nas reduções', '+4% de potência'],
                  activeBg: 'bg-amber-950/70 border-amber-400 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.5)]',
                },
                {
                  id: 'straight_pipe' as const,
                  name: 'DIRETO STRAIGHT PIPE (TIROS & POPS)',
                  subtitle: 'Sem abafadores, cano direto de 3 polegadas',
                  price: 5900,
                  badge: '+8% CV · POPS & BANGS',
                  features: ['Estampidos altos como tiros secos', 'Sub-grave forte na onda de choque', 'Labaredas de backfire e fumaça'],
                  activeBg: 'bg-red-950/70 border-red-500 text-red-200 shadow-[0_0_25px_rgba(239,68,68,0.7)]',
                },
              ].map((ex) => {
                const isSelected = exhaustType === ex.id
                return (
                  <div
                    key={ex.id}
                    onClick={() =>
                      handlePurchaseAndEquip(
                        'exhaustType',
                        ex.id,
                        isSelected ? 0 : ex.price,
                        ex.name
                      )
                    }
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      isSelected ? ex.activeBg : 'bg-zinc-900/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-black tracking-wide block text-white">
                          {ex.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-black ${
                            isSelected ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {isSelected ? 'EQUIPADO' : ex.price === 0 ? 'GRÁTIS' : `R$ ${ex.price.toLocaleString()}`}
                        </span>
                      </div>
                      <span className="text-[9px] text-zinc-400 block mt-0.5">
                        {ex.subtitle}
                      </span>
                    </div>

                    <ul className="text-[8.5px] text-zinc-400 flex flex-col gap-1">
                      {ex.features.map((f, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <span className="text-amber-400">⚡</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className={`w-full py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all ${
                        isSelected
                          ? 'bg-white text-black shadow'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {isSelected ? 'INSTALADO NO CARRO' : 'EQUIPAR'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── CONTEÚDO DA ABA 3: ADMISSÃO / INTAKE ─── */}
        {activeTab === 'intake' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                id: 'stock' as const,
                name: 'FILTRO DE AR ORIGINAL (CAIXA FECHADA)',
                subtitle: 'Filtro de papel convencional com caixa acústica',
                price: 0,
                gain: 'Padrão',
                features: ['Silêncio na admissão', 'Manutenção padrão'],
                activeBg: 'bg-zinc-800/90 border-white text-white',
              },
              {
                id: 'cold_air' as const,
                name: 'INTAKE CÔNICO K&N COLD AIR + DEFLETOR',
                subtitle: 'Filtro cônico esportivo de algodão lavável de alta vazão',
                price: 2400,
                gain: '+6% CV & Sucção',
                features: [
                  '+6% de torque e potência no motor',
                  'Som alto de sucção e aspiração de ar',
                  'Espirro nítido da turbina ao tirar o pé',
                ],
                activeBg: 'bg-sky-950/70 border-sky-400 text-sky-200 shadow-[0_0_20px_rgba(2,132,199,0.5)]',
              },
            ].map((it) => {
              const isSelected = intakeType === it.id
              return (
                <div
                  key={it.id}
                  onClick={() =>
                    handlePurchaseAndEquip(
                      'intakeType',
                      it.id,
                      isSelected ? 0 : it.price,
                      it.name
                    )
                  }
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected ? it.activeBg : 'bg-zinc-900/40 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-black tracking-wide block text-white">
                        {it.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[8px] font-black ${
                          isSelected ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {isSelected ? 'EQUIPADO' : it.price === 0 ? 'GRÁTIS' : `R$ ${it.price.toLocaleString()}`}
                      </span>
                    </div>
                    <span className="text-[9px] text-zinc-400 block mt-0.5">
                      {it.subtitle}
                    </span>
                  </div>

                  <ul className="text-[9px] text-zinc-400 flex flex-col gap-1">
                    {it.features.map((f, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <span className="text-sky-400">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className={`w-full py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all ${
                      isSelected
                        ? 'bg-white text-black shadow'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {isSelected ? 'INSTALADO' : 'EQUIPAR'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ─── CONTEÚDO DA ABA 4: PNEUS & CHASSI ─── */}
        {activeTab === 'chassi' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                id: 'street' as const,
                name: 'PNEUS RADIAIS DE RUA (STREET RADIAL)',
                subtitle: 'Composto balanceado com sulcos para drenagem',
                price: 0,
                frictionSeco: '0.95 µ',
                frictionChuva: '0.62 µ (Seguro)',
                features: ['Ótima durabilidade e conforto', 'Comportamento previsível no asfalto molhado'],
                activeBg: 'bg-zinc-800/90 border-white text-white',
              },
              {
                id: 'semi_slick' as const,
                name: 'PNEUS SEMI-SLICK DE ARRANCADA (DRAG & TRACK)',
                subtitle: 'Composto macio de competição com banda de rodagem lisa',
                price: 4200,
                frictionSeco: '1.22 µ (+28% Grip)',
                frictionChuva: '0.52 µ (Sensível)',
                features: [
                  'Aderência extrema no asfalto seco: zero destracionamento na largada',
                  'Permite baixar o tempo de 0 a 100 km/h drasticamente',
                  'Exige atenção redobrada na chuva devido a aquaplanagem',
                ],
                activeBg: 'bg-emerald-950/70 border-emerald-400 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.5)]',
              },
            ].map((tp) => {
              const isSelected = tires === tp.id
              return (
                <div
                  key={tp.id}
                  onClick={() =>
                    handlePurchaseAndEquip(
                      'tires',
                      tp.id,
                      isSelected ? 0 : tp.price,
                      tp.name
                    )
                  }
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected ? tp.activeBg : 'bg-zinc-900/40 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-black tracking-wide block text-white">
                        {tp.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[8px] font-black ${
                          isSelected ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {isSelected ? 'EQUIPADO' : tp.price === 0 ? 'GRÁTIS' : `R$ ${tp.price.toLocaleString()}`}
                      </span>
                    </div>
                    <span className="text-[9px] text-zinc-400 block mt-0.5">
                      {tp.subtitle}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 py-1 px-2 rounded-xl bg-black/40 border border-white/5 text-center">
                    <div>
                      <span className="text-[8px] text-zinc-500 uppercase block">Grip no Seco</span>
                      <span className="text-xs font-black text-emerald-400">{tp.frictionSeco}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-zinc-500 uppercase block">Grip na Chuva</span>
                      <span className="text-xs font-black text-sky-400">{tp.frictionChuva}</span>
                    </div>
                  </div>

                  <ul className="text-[9px] text-zinc-400 flex flex-col gap-1">
                    {tp.features.map((f, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <span className="text-emerald-400">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className={`w-full py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all ${
                      isSelected
                        ? 'bg-white text-black shadow'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {isSelected ? 'INSTALADO' : 'EQUIPAR'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ─── CONTEÚDO DA ABA 5: CENTRAL MULTIMÍDIA RETROFIT ─── */}
        {activeTab === 'interior' && (
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📺</span>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-white uppercase">
                  KIT CENTRAL MULTIMÍDIA 2-DIN TOUCHSCREEN SMART CONNECT
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5 max-w-xl">
                  {isOriginalInfotainmentCar
                    ? 'Este modelo já vem equipado de fábrica com central multimídia de alta definição integrada ao painel.'
                    : 'Instala uma central multimídia 2-DIN moderna no painel do carro (perfeito para Gol G6 e Gol Quadrado!). Permite acessar vídeos e músicas no YouTube, Climatização Digital e Controle de Iluminação Ambiente da Cabine.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 text-center text-[10px]">
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <span className="text-zinc-500 block text-[8px] uppercase">Entretenimento</span>
                <span className="font-bold text-white">YouTube & Streaming</span>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <span className="text-zinc-500 block text-[8px] uppercase">Conforto</span>
                <span className="font-bold text-sky-400">A/C Climatização Digital</span>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <span className="text-zinc-500 block text-[8px] uppercase">Ambiente</span>
                <span className="font-bold text-purple-400">Luz de Cabine RGB</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-[10px] text-zinc-400">
                Status: {hasRetrofitInfotainment || isOriginalInfotainmentCar ? '✅ Habilitado no Console' : '❌ Não Instalado'}
              </span>

              {!isOriginalInfotainmentCar ? (
                <button
                  onClick={() =>
                    handlePurchaseAndEquip(
                      'multimediaKit',
                      !hasRetrofitInfotainment,
                      hasRetrofitInfotainment ? 0 : 2800,
                      hasRetrofitInfotainment ? 'Multimídia removida' : 'Kit Multimídia 2-DIN Retrofit'
                    )
                  }
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                    hasRetrofitInfotainment
                      ? 'bg-zinc-800 text-zinc-400 hover:text-red-400 border border-white/10'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.6)]'
                  }`}
                >
                  {hasRetrofitInfotainment ? 'REMOVER MULTIMÍDIA' : 'COMPRAR & INSTALAR (R$ 2.800)'}
                </button>
              ) : (
                <span className="text-[10px] text-emerald-400 font-bold px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
                  MULTIMÍDIA DE FÁBRICA ATIVA
                </span>
              )}
            </div>
          </div>
        )}

        {/* ─── Rodapé do Modal ─── */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[9px] text-zinc-500">
          <span>Peças salvas automaticamente na garagem e aplicadas em tempo real ao motor</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg active:scale-95 transition-all"
          >
            VOLTAR À PISTA
          </button>
        </div>

      </div>
    </div>
  )
})
