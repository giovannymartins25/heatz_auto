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
 * Exibido quando o veículo não possui central multimídia de fábrica (ex.: Gol Quadrado 1994 sem kit 2-DIN):
 * - Tampa cega 1-DIN com acabamento preto texturizado e emblema de época
 * - Relógio digital de quartzo clássico dos anos 90
 * - Comandos de ventilação mecânica analógica (deslizantes com ar quente/frio)
 * - Identificação de que o veículo é puramente mecânico e pode receber central na Oficina
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
  const [fanSpeed, setFanSpeed] = useState(1)
  const [tempPos, setTempPos] = useState(30) // 0% azul a 100% vermelho

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date()
      setClock(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div
      className={`relative rounded-xl border-2 border-zinc-700 bg-gradient-to-b from-[#1c1c1f] via-[#121214] to-[#0a0a0c] p-1.5 sm:p-2.5 select-none font-mono flex flex-col justify-between shadow-2xl overflow-hidden ${
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

      <div className="flex-1 min-h-0 w-full flex flex-col justify-between overflow-y-auto py-0.5" style={{ touchAction: 'pan-y' }}>
        {/* ─── Centro: Tampa Cega 1-DIN com Emblema e Relógio Digital Quartzo ─── */}
        <div className="my-1 p-1.5 sm:p-2 rounded-lg bg-[#141518] border border-white/10 shadow-inner flex flex-col items-center justify-center gap-1.5">
          <div className="w-full flex items-center justify-between px-1">
            {/* Emblema Vintage */}
            <div className="flex items-center gap-1.5 text-zinc-400 truncate">
              <span className="text-xs">⚙️</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300 truncate">
                {vehicle.info.name}
              </span>
            </div>

            {/* Relógio Digital de Quartzo dos anos 90 */}
            <div className="px-2 py-0.5 rounded bg-[#0d140e] border border-[#2d4a34] shadow-[0_0_8px_rgba(88,214,141,0.2)] text-[#58d68d] font-mono font-black text-xs tracking-widest shrink-0">
              {clock}
            </div>
          </div>

          {/* Tampa Cega Texturizada */}
          <div className="w-full py-1 px-2 rounded bg-zinc-900 border border-zinc-700/80 flex items-center justify-between text-[7.5px] text-zinc-500 font-bold">
            <span>SLOT 1-DIN</span>
            <span className="text-amber-400/80">OFICINA: KIT MULTIMÍDIA 2-DIN</span>
          </div>
        </div>

        {/* ─── Base: Controles Mecânicos Deslizantes de Ar ─── */}
        <div className="pt-0.5 border-t border-white/10 flex flex-col gap-1 shrink-0">
          <div className="flex items-center justify-between text-[7.5px] font-bold text-zinc-400">
            <span>VENTILAÇÃO FORÇADA</span>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setFanSpeed(spd)}
                  className={`w-4 h-4 rounded text-[7px] font-bold flex items-center justify-center border transition-all cursor-pointer ${
                    fanSpeed === spd
                      ? 'bg-zinc-200 text-black border-white'
                      : 'bg-zinc-800 text-zinc-400 border-white/10'
                  }`}
                >
                  {spd}
                </button>
              ))}
            </div>
          </div>

          {/* Barra Térmica Azul / Vermelha */}
          <div className="w-full flex items-center gap-1 text-[7px] text-zinc-500">
            <span className="text-sky-400 font-bold">FRIO</span>
            <div className="flex-1 h-1.5 rounded-full bg-gradient-to-r from-sky-500 via-zinc-600 to-red-500 relative">
              <div
                className="w-2.5 h-2.5 rounded-full bg-white border border-black shadow absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer"
                style={{ left: `${tempPos}%` }}
                onClick={() => setTempPos((p) => (p === 30 ? 70 : 30))}
              />
            </div>
            <span className="text-red-400 font-bold">QUENTE</span>
          </div>
        </div>
      </div>
    </div>
  )
})
