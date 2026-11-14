import { memo, useState, useEffect } from 'react'
import type { VehicleConfig, VehicleManifestEntry } from '@/types/vehicle'
import { getVehicleCapabilities } from '@/types/vehicle'
import { vehicleLoader } from '@/systems/vehicle/VehicleLoader'

export interface VehicleSpecsModalProps {
  vehicleId: string
  manifestEntry?: VehicleManifestEntry
  vehicleConfig?: VehicleConfig | null
  onClose: () => void
  onBuy?: (vehicleId: string) => void
  isOwned?: boolean
  price?: number
  onDrive?: () => void
  onWorkshop?: () => void
}

type SpecsTab = 'id' | 'engine' | 'trans' | 'chassis' | 'equip'

/**
 * VehicleSpecsModal — Modal responsivo de Ficha Técnica Completa.
 *
 * Apresenta especificações técnicas oficiais e dados da simulação física
 * organizados em 5 seções estruturadas:
 * - Identificação
 * - Motor
 * - Transmissão & Tração
 * - Dimensões & Chassi
 * - Equipamentos & Tecnologia
 */
export const VehicleSpecsModal = memo(function VehicleSpecsModal({
  vehicleId,
  manifestEntry,
  vehicleConfig: initialConfig,
  onClose,
  onBuy,
  isOwned = false,
  price,
  onDrive,
  onWorkshop,
}: VehicleSpecsModalProps) {
  const [config, setConfig] = useState<VehicleConfig | null>(initialConfig || null)
  const [loading, setLoading] = useState(!initialConfig)
  const [activeTab, setActiveTab] = useState<SpecsTab>('id')

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig)
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)
    vehicleLoader
      .loadVehicleById(vehicleId)
      .then((cfg) => {
        if (isMounted) {
          setConfig(cfg)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar config da ficha técnica:', err)
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [vehicleId, initialConfig])

  // Fechar no ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const name = config?.info.name || manifestEntry?.name || vehicleId
  const brand = config?.info.brand || manifestEntry?.brand || 'Heatz'
  const year = config?.info.year || manifestEntry?.year || 2025
  const category = config?.info.category || manifestEntry?.category || 'car'
  const thumb = manifestEntry?.thumbnailPath || config?.info.thumbnailPath
  const caps = config ? getVehicleCapabilities(config) : null

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative flex flex-col w-full max-w-2xl max-h-[92dvh] bg-zinc-950 border border-white/15 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-zinc-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Topo / Header da Ficha Técnica ─── */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {thumb && (
              <img
                src={thumb}
                alt={name}
                className="w-10 h-7 object-contain rounded bg-zinc-900 border border-white/10 shrink-0"
              />
            )}
            <div className="min-w-0">
              <span className="block text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest leading-none">
                {brand} · FICHA TÉCNICA OFICIAL · {category.toUpperCase()}
              </span>
              <h2 className="text-sm sm:text-base font-black text-white truncate tracking-tight">
                {name} ({year})
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
            aria-label="Fechar ficha técnica"
          >
            ✕
          </button>
        </header>

        {/* ─── Navegação por Abas ─── */}
        <nav className="flex items-center justify-around border-b border-white/10 bg-zinc-900/60 px-2 py-1 text-[9px] sm:text-[10px] font-mono font-bold shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('id')}
            className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'id'
                ? 'bg-white text-zinc-950 font-black shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            📋 Identificação
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('engine')}
            className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'engine'
                ? 'bg-red-600 text-white font-black shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            ⚡ Motor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('trans')}
            className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'trans'
                ? 'bg-amber-500 text-zinc-950 font-black shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            ⚙️ Câmbio & Tração
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chassis')}
            className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'chassis'
                ? 'bg-cyan-500 text-zinc-950 font-black shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            📐 Chassi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('equip')}
            className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'equip'
                ? 'bg-purple-600 text-white font-black shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            📱 Tecnologia
          </button>
        </nav>

        {/* ─── Conteúdo Principal da Ficha ─── */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 min-h-[260px] text-xs font-mono space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
              <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-white animate-spin mb-2" />
              <p className="text-[10px]">Carregando especificações técnicas...</p>
            </div>
          )}

          {!loading && config && (
            <>
              {/* ─── ABA 1: IDENTIFICAÇÃO ─── */}
              {activeTab === 'id' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-2">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">
                      Resumo do Veículo
                    </span>
                    <p className="text-zinc-300 font-sans text-xs sm:text-sm leading-relaxed">
                      {config.info.description || 'Veículo com calibração física determinística a 120 Hz.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-500 block">Marca</span>
                      <span className="font-bold text-white text-xs">{config.info.brand}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-500 block">Modelo</span>
                      <span className="font-bold text-white text-xs">{config.info.model}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-500 block">Ano de Fabricação</span>
                      <span className="font-bold text-white text-xs">{config.info.year}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-500 block">Categoria</span>
                      <span className="font-bold text-amber-400 text-xs uppercase">{config.info.category}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-500 block">Massa em Ordem de Marcha</span>
                      <span className="font-bold text-emerald-400 text-xs">{config.info.weight} kg</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-500 block">Diâmetro de Roda</span>
                      <span className="font-bold text-cyan-400 text-xs">{config.info.wheelDiameter} m ({((config.info.wheelDiameter / 0.0254)).toFixed(0)}")</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── ABA 2: MOTOR & POTÊNCIA ─── */}
              {activeTab === 'engine' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/30">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Potência Máxima</span>
                      <span className="font-black text-red-400 text-base">{config.engine.maxPower} CV</span>
                      <span className="text-[8px] text-zinc-500 block">@ {config.engine.maxPowerRpm} RPM</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Torque Máximo</span>
                      <span className="font-black text-amber-400 text-base">{config.engine.maxTorque} Nm</span>
                      <span className="text-[8px] text-zinc-500 block">({(config.engine.maxTorque / 9.80665).toFixed(1)} kgfm @ {config.engine.maxTorqueRpm} RPM)</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Corte / Redline</span>
                      <span className="font-black text-white text-base">{config.engine.maxRpm} RPM</span>
                      <span className="text-[8px] text-zinc-500 block">RevLimiter {config.engine.revLimiter} RPM</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Marcha Lenta</span>
                      <span className="font-black text-emerald-400 text-base">{config.engine.idleRpm} RPM</span>
                      <span className="text-[8px] text-zinc-500 block">Inércia {config.engine.flywheelMass} kg</span>
                    </div>
                  </div>

                  {/* Turbocompressor ou Aspirado */}
                  <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[8.5px] font-bold uppercase tracking-wider text-zinc-400">
                        Indução de Ar / Sobrealimentação
                      </span>
                      <span
                        className={`text-[8.5px] font-black px-2 py-0.5 rounded-full uppercase ${
                          config.engine.turbo?.enabled
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {config.engine.turbo?.enabled ? 'TURBOCOMPRESSOR' : 'ASPIRADO NATURAL'}
                      </span>
                    </div>

                    {config.engine.turbo?.enabled ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px]">
                        <div>
                          <span className="text-zinc-500 block text-[7.5px]">Pressão Máxima:</span>
                          <span className="text-red-400 font-bold">{config.engine.turbo.maxBoostBar} bar</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[7.5px]">Início do Spool:</span>
                          <span className="text-white font-bold">{config.engine.turbo.spoolRpmStart} RPM</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[7.5px]">Pressão Total:</span>
                          <span className="text-white font-bold">{config.engine.turbo.fullBoostRpm} RPM</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[7.5px]">Válvula Blow-off:</span>
                          <span className="text-emerald-400 font-bold">{config.engine.turbo.hasBlowOff ? 'Sim (Auditiva)' : 'Não'}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-400">
                        Motor de aspiração natural com resposta de aceleração linear e progressividade autêntica.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ─── ABA 3: TRANSMISSÃO & TRAÇÃO ─── */}
              {activeTab === 'trans' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Tipo de Câmbio</span>
                      <span className="font-bold text-amber-400 text-xs uppercase">{config.transmission.type}</span>
                      <span className="text-[8px] text-zinc-500 block">{config.transmission.gearCount} velocidades</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Arquitetura de Tração</span>
                      <span className="font-bold text-cyan-400 text-xs">
                        {caps?.has4x4Selector ? '4x4 INTEGRAL' : config.info.category === 'motorcycle' ? 'RWD (MOTO)' : config.chassis?.frontWeightRatio && config.chassis.frontWeightRatio >= 0.58 ? 'FWD (DIANTEIRA)' : 'RWD (TRASEIRA)'}
                      </span>
                      <span className="text-[8px] text-zinc-500 block">{caps?.has4x4Selector ? 'AUTO / 4WD / LOW' : 'Tração Mecânica'}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Paddle Shifters</span>
                      <span className="font-bold text-white text-xs">
                        {caps?.supportsPaddleShifters ? 'Sim (Borboletas)' : 'Não'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Pedal Embreagem</span>
                      <span className="font-bold text-white text-xs">
                        {caps?.hasClutchPedal ? 'Sim (Mecânica)' : 'Não (Automático)'}
                      </span>
                    </div>
                  </div>

                  {/* Escalonamento de Marchas */}
                  <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/5">
                    <span className="block text-[8.5px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      Relações de Transmissão Oficiais (Gear Ratios)
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-[9px]">
                      {config.transmission.gearRatios.map((g) => (
                        <div key={g.gear} className="p-1.5 rounded-lg bg-zinc-950/80 border border-white/5 text-center">
                          <span className="text-zinc-500 block text-[7.5px]">{g.gear}ª Marcha</span>
                          <span className="font-bold text-white">{g.ratio.toFixed(3)}:1</span>
                        </div>
                      ))}
                      <div className="p-1.5 rounded-lg bg-zinc-950/80 border border-white/5 text-center">
                        <span className="text-zinc-500 block text-[7.5px]">Marcha Ré</span>
                        <span className="font-bold text-red-400">{config.transmission.reverseRatio.toFixed(3)}:1</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-zinc-950/80 border border-white/5 text-center">
                        <span className="text-zinc-500 block text-[7.5px]">Diferencial</span>
                        <span className="font-bold text-amber-400">{config.transmission.finalDrive.toFixed(3)}:1</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── ABA 4: CHASSI & DIMENSÕES ─── */}
              {activeTab === 'chassis' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Massa Total</span>
                      <span className="font-bold text-emerald-400 text-sm">
                        {config.chassis?.totalMass || config.info.weight} kg
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Distância Entre-eixos</span>
                      <span className="font-bold text-white text-sm">
                        {config.chassis?.wheelbase ? `${config.chassis.wheelbase.toFixed(3)} m` : 'N/A'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Centro de Massa (h)</span>
                      <span className="font-bold text-cyan-400 text-sm">
                        {config.chassis?.centerOfMassHeight ? `${config.chassis.centerOfMassHeight.toFixed(2)} m` : 'N/A'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Distribuição de Peso</span>
                      <span className="font-bold text-amber-400 text-sm">
                        {config.chassis?.frontWeightRatio
                          ? `${Math.round(config.chassis.frontWeightRatio * 100)}% D / ${Math.round((1 - config.chassis.frontWeightRatio) * 100)}% T`
                          : 'N/A'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Raio Dinâmico da Roda</span>
                      <span className="font-bold text-white text-sm">
                        {config.chassis?.wheelRadius ? `${config.chassis.wheelRadius.toFixed(3)} m` : `${(config.info.wheelDiameter / 2).toFixed(3)} m`}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Inércia das Rodas (Iw)</span>
                      <span className="font-bold text-purple-400 text-sm">
                        {config.chassis?.wheelInertia ? `${config.chassis.wheelInertia.toFixed(2)} kg·m²` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── ABA 5: EQUIPAMENTOS & TECNOLOGIA ─── */}
              {activeTab === 'equip' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Painel Digital</span>
                      <span className="font-bold text-white text-xs uppercase">{config.dashboard.theme || 'Moderno'}</span>
                      <span className="text-[8px] text-zinc-500 block">TFT Alta Resolução</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Central Multimídia</span>
                      <span className="font-bold text-cyan-400 text-xs">
                        {caps?.hasInfotainment ? 'Presente' : 'Não'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Controle de Tração (TCS)</span>
                      <span className="font-bold text-emerald-400 text-xs">
                        {config.transmission.tcs?.enabled ? 'Eletrônico Ativo' : 'Desativado'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Tanque de Combustível</span>
                      <span className="font-bold text-white text-xs">{config.dashboard.fuelCapacity || 50} Litros</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Launch Control</span>
                      <span className="font-bold text-white text-xs">
                        {config.transmission.launchControl?.enabled ? 'Habilitado' : 'Não disponível'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-[7.5px] uppercase text-zinc-400 block">Suporte Nitro / NOS</span>
                      <span className="font-bold text-purple-400 text-xs">
                        {caps?.supportsNos ? 'Compatível (Oficina)' : 'Não'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Footer com Ações ─── */}
        <footer className="flex items-center justify-between p-3 sm:p-4 border-t border-white/10 bg-zinc-950 shrink-0">
          <div className="flex items-center gap-2">
            {price !== undefined && (
              <div className="leading-tight">
                <span className="block text-[8px] font-mono text-zinc-500 uppercase">Preço Concessionária</span>
                <span className="text-sm sm:text-base font-black font-mono text-emerald-400">
                  R$ {price.toLocaleString()}
                </span>
              </div>
            )}
            {isOwned && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase">
                ✓ NA GARAGEM
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onBuy && !isOwned && (
              <button
                type="button"
                onClick={() => onBuy(vehicleId)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-lg shadow-emerald-600/30"
              >
                Comprar Veículo
              </button>
            )}

            {isOwned && onWorkshop && (
              <button
                type="button"
                onClick={onWorkshop}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95 border border-white/10"
              >
                🔧 Oficina
              </button>
            )}

            {isOwned && onDrive && (
              <button
                type="button"
                onClick={onDrive}
                className="px-4 py-2 rounded-xl bg-[var(--color-accent)] hover:brightness-110 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-lg"
              >
                🏎️ Pilotar
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-mono text-xs uppercase transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
})
