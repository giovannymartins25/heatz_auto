import { memo } from 'react'
import type { GarageCarInstance } from '@/stores/useGarageStore'
import type { VehicleManifestEntry } from '@/types/vehicle'

export interface GarageCarCardProps {
  car: GarageCarInstance
  manifest?: VehicleManifestEntry
  specs: {
    engine: string
    drivetrain: string
    power: string
    torque: string
    transmission: string
  }
  isActive: boolean
  canSell: boolean
  sellPrice?: number
  onRename: () => void
  onSelectMode: (mode: 'cluster' | 'drive') => void
  onOpenWorkshop: () => void
  onOpenDyno: () => void
  onOpenSpecs: () => void
  onSell?: () => void
}

/**
 * GarageCarCard — Card representativo de uma instância única na Garagem do Jogador.
 * Exibe odômetro real, nome customizado, upgrades instalados e ações de pilotagem, oficina e dyno.
 */
export const GarageCarCard = memo(function GarageCarCard({
  car,
  manifest,
  specs,
  isActive,
  canSell,
  sellPrice,
  onRename,
  onSelectMode,
  onOpenWorkshop,
  onOpenDyno,
  onOpenSpecs,
  onSell,
}: GarageCarCardProps) {
  const up = car.upgrades

  return (
    <div
      className={`relative rounded-xl sm:rounded-2xl border-2 p-2.5 sm:p-3.5 lg:p-4 bg-gradient-to-b from-zinc-900/90 via-zinc-950 to-black flex flex-col justify-between gap-1.5 sm:gap-2.5 transition-all shadow-xl hover:shadow-2xl car-card-landscape ${
        isActive
          ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/50'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* ─── Topo do Card: Marca, Nome e Status ─── */}
      <div>
        <div className="flex items-start justify-between gap-1.5 mb-1 sm:mb-1.5">
          <div className="min-w-0">
            <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-widest text-zinc-400 block truncate">
              {manifest?.brand || 'VEÍCULO'}
            </span>
            <h3 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1 truncate">
              <span className="truncate">{car.customName}</span>
              <button
                type="button"
                onClick={onRename}
                className="text-zinc-500 hover:text-amber-400 text-[11px] p-0.5 cursor-pointer shrink-0 transition-colors"
                title="Renomear veículo"
                aria-label="Renomear veículo"
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

        {/* ─── Imagem / Preview do Veículo ─── */}
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

        {/* ─── Ficha Técnica Essencial ─── */}
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

        {/* ─── Tags de Upgrades Instalados ─── */}
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

          {/* Multimídia Retrofit */}
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

      {/* ─── Botões de Ação do Veículo ─── */}
      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-white/10 font-mono">
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          {/* Botão Painel */}
          <button
            type="button"
            onClick={() => onSelectMode('cluster')}
            className="h-10 sm:h-11 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-700 hover:from-zinc-700 hover:to-zinc-600 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider border border-white/20 shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
            title="Visualizar apenas o Painel Original do veículo"
          >
            <span className="text-sm sm:text-base">📟</span>
            <span>PAINEL</span>
          </button>

          {/* Botão Dirigir */}
          <button
            type="button"
            onClick={() => onSelectMode('drive')}
            className="h-10 sm:h-11 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider border border-red-400/40 shadow-lg shadow-red-600/30 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
            title="Abrir Cockpit Completo com Mapa e Controles"
          >
            <span className="text-sm sm:text-base">🏎️</span>
            <span>DIRIGIR</span>
          </button>
        </div>

        {/* Ações Secundárias */}
        <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={onOpenWorkshop}
            className="h-7 sm:h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-400/30 font-bold text-[8px] sm:text-[9px] uppercase tracking-wide transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
          >
            <span>🔧</span>
            <span>OFICINA</span>
          </button>

          <button
            type="button"
            onClick={onOpenDyno}
            className="h-7 sm:h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sky-300 border border-sky-500/30 font-bold text-[8px] sm:text-[9px] uppercase tracking-wide transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
          >
            <span>📈</span>
            <span>DYNO</span>
          </button>

          <button
            type="button"
            onClick={onOpenSpecs}
            className="h-7 sm:h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 font-bold text-[8px] sm:text-[9px] uppercase tracking-wide transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
            title="Abrir Ficha Técnica Completa"
          >
            <span>📋</span>
            <span>FICHA</span>
          </button>
        </div>

        {/* Botão de Vender */}
        {canSell && onSell && sellPrice !== undefined && (
          <button
            type="button"
            onClick={onSell}
            className="w-full py-0.5 rounded text-[7.5px] sm:text-[8px] text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer text-center"
          >
            Vender por R$ {sellPrice.toLocaleString()}
          </button>
        )}
      </div>
    </div>
  )
})
