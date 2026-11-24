import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types/vehicle'

export interface ClassicDashboardBlankUnitProps {
  vehicle: VehicleConfig
  className?: string
  fill?: boolean
}

/**
 * ClassicDashboardBlankUnit — Painel de console original analógico dos anos 80/90.
 *
 * Exibido quando o veículo não possui central multimídia nem rádio instalado (ex.: Gol Quadrado 1994 sem kit 2-DIN):
 * - Tampa cega 1-DIN com acabamento preto texturizado e emblema de época
 * - Relógio digital de quartzo clássico dos anos 90
 * - Os comandos mecânicos reais de ventilação/aquecimento permanecem exclusivamente no Painel 3
 *   (`climateControlsLocation: 'panel'`), sem duplicação de estado.
 */
export const ClassicDashboardBlankUnit = memo(function ClassicDashboardBlankUnit({
  vehicle,
  className = '',
  fill = false,
}: ClassicDashboardBlankUnitProps) {
  const [clock, setClock] = useState(() => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date()
      setClock(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div
      className={`relative rounded-xl border-2 border-zinc-700 bg-gradient-to-b from-[#1c1c1f] via-[#121214] to-[#0a0a0c] p-2 sm:p-2.5 select-none font-mono flex flex-col justify-between shadow-2xl overflow-hidden ${
        fill ? 'w-full h-full' : 'w-[320px] h-[190px]'
      } ${className}`}
    >
      {/* ─── Topo: Moldura de Console Original ─── */}
      <div className="flex items-center justify-between pr-28 pb-1 border-b border-white/10 text-[8px] sm:text-[9px] shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          <span className="font-bold tracking-wider text-zinc-400 uppercase truncate">
            {vehicle.info.brand} CONSOLE ORIGINAL
          </span>
        </div>
        <span className="text-zinc-500 font-bold uppercase shrink-0">{vehicle.info.year}</span>
      </div>

      {/* ─── Centro: Tampa Cega 1-DIN com Emblema e Relógio Digital Quartzo ─── */}
      <div className="my-auto p-2 rounded-lg bg-[#141518] border border-white/10 shadow-inner flex flex-col items-center justify-center gap-2">
        <div className="w-full flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-zinc-400 truncate">
            <span className="text-xs">⚙️</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300 truncate">
              {vehicle.info.name}
            </span>
          </div>

          <div className="px-2 py-0.5 rounded bg-[#0d140e] border border-[#2d4a34] shadow-[0_0_8px_rgba(88,214,141,0.2)] text-[#58d68d] font-mono font-black text-xs tracking-widest shrink-0">
            {clock}
          </div>
        </div>

        <div className="w-full py-1.5 px-2 rounded bg-zinc-900 border border-zinc-700/80 flex items-center justify-between text-[7.5px] text-zinc-500 font-bold">
          <span>TAMPA CEGA 1-DIN (SEM RÁDIO)</span>
          <span className="text-amber-400/80">OFICINA: KIT 2-DIN</span>
        </div>
      </div>

      <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[7px] text-zinc-500 font-bold">
        <span>PAINEL ANALÓGICO DE ÉPOCA</span>
        <span className="text-zinc-400">CLIMATIZAÇÃO NO PAINEL DE CONTROLES</span>
      </div>
    </div>
  )
})
