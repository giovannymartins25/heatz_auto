import { memo } from 'react'
import type { VehicleManifestEntry } from '@/types/vehicle'

export interface DealershipVehicleCardProps {
  vehicle: VehicleManifestEntry
  priceInfo: { price: number; badge: string; description: string }
  ownedCount: number
  canAfford: boolean
  sandboxMode: boolean
  onBuy: () => void
  onOpenSpecs: () => void
}

/**
 * DealershipVehicleCard — Card do showroom da Concessionária oficial HEATZ AUTO.
 * Exibe especificações de fábrica, preço de aquisição, indicador de posse na garagem e botão de compra.
 */
export const DealershipVehicleCard = memo(function DealershipVehicleCard({
  vehicle,
  priceInfo,
  ownedCount,
  canAfford,
  sandboxMode,
  onBuy,
  onOpenSpecs,
}: DealershipVehicleCardProps) {
  return (
    <div className="rounded-xl sm:rounded-2xl border border-white/10 p-2.5 sm:p-3.5 lg:p-4 bg-gradient-to-b from-zinc-900/80 via-zinc-950 to-black flex flex-col justify-between gap-1.5 sm:gap-2.5 shadow-xl hover:border-white/20 transition-all car-card-landscape">
      <div>
        {/* Topo do Card */}
        <div className="flex items-start justify-between gap-1 mb-1 sm:mb-1.5">
          <span className="text-[8.5px] sm:text-[9.5px] font-mono uppercase tracking-widest text-zinc-400">
            {vehicle.brand}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[7px] sm:text-[7.5px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            {priceInfo.badge}
          </span>
        </div>

        <h3 className="text-sm sm:text-base font-black text-white tracking-tight mb-1 sm:mb-1.5 truncate">
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
            <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[7px] sm:text-[7.5px] font-mono font-bold bg-amber-500 text-black shadow">
              {ownedCount} NA GARAGEM
            </span>
          )}
        </div>

        <p className="text-[8.5px] sm:text-[9.5px] font-mono text-zinc-400 mb-1.5 sm:mb-2 line-clamp-2">
          {priceInfo.description || `${vehicle.powerHp} CV · ${vehicle.transmissionType.toUpperCase()}`}
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

      {/* Preço, Ficha Técnica e Botão de Compra */}
      <div className="pt-2 border-t border-white/10 font-mono flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-zinc-500 block text-[7px] uppercase">Preço</span>
            <span className="font-black text-emerald-400 text-xs sm:text-sm truncate block">
              {sandboxMode ? 'GRÁTIS' : `R$ ${priceInfo.price.toLocaleString()}`}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenSpecs}
            className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 font-bold text-[8px] sm:text-[8.5px] uppercase flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            title="Ver Ficha Técnica Completa"
          >
            <span>📋</span>
            <span>FICHA TÉCNICA</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onBuy}
          disabled={!canAfford}
          className={`w-full h-8 sm:h-9 rounded-xl font-black text-[9.5px] sm:text-[10.5px] uppercase tracking-wider transition-all shadow active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
            canAfford
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]'
              : 'bg-zinc-800 text-zinc-500 border border-white/5 cursor-not-allowed'
          }`}
        >
          <span>🛒</span>
          <span>{canAfford ? 'COMPRAR VEÍCULO' : 'INSUFICIENTE'}</span>
        </button>
      </div>
    </div>
  )
})
