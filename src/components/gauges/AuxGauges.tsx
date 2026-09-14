import { memo } from 'react'

interface AuxGaugesProps {
  fuelLevel: number     // litros atuais
  fuelCapacity: number  // capacidade total do tanque em litros
  fuelPercent: number   // 0 a 100%
  coolantTemp: number   // temperatura do arrefecimento em °C
  tempTarget: number    // temperatura ideal operacional (ex: 90°C)
  isTempOptimal: boolean
}

/**
 * AuxGauges — Mostradores auxiliares SVG para Combustível e Temperatura.
 *
 * Estrutura visual pronta para receber a física térmica e de consumo em etapas futuras.
 * Mantém valores neutros e realistas sem criar física artificial ou consumo falso.
 */
export const AuxGauges = memo(function AuxGauges({
  fuelCapacity,
  coolantTemp,
}: AuxGaugesProps) {
  return (
    <div className="flex items-center justify-between w-full max-w-[280px] px-2 py-1 select-none">
      {/* Marcador de Combustível */}
      <div className="flex items-center gap-1.5 text-zinc-400">
        <svg className="w-3.5 h-3.5 fill-current opacity-70" viewBox="0 0 24 24">
          <path d="M19 5H18V4H16V3H8V4H6V5H5V19H6V20H8V21H16V20H18V19H19V11.5L20.5 13L22 11.5L19 8.5V5M17 18H7V7H17V18Z" />
        </svg>
        <div className="flex flex-col">
          <div className="flex justify-between w-16 text-[8px] font-mono text-zinc-500">
            <span>E</span>
            <span>{fuelCapacity}L</span>
            <span>F</span>
          </div>
          {/* Barra de combustível — nível inicial cheio/preparado */}
          <div className="w-16 h-1.5 rounded-full bg-zinc-900 border border-white/10 overflow-hidden">
            <div className="w-full h-full bg-emerald-500/80 rounded-full" />
          </div>
        </div>
      </div>

      {/* Marcador de Temperatura do Líquido de Arrefecimento */}
      <div className="flex items-center gap-1.5 text-zinc-400">
        <div className="flex flex-col items-end">
          <div className="flex justify-between w-16 text-[8px] font-mono text-zinc-500">
            <span>C</span>
            <span>{coolantTemp}°C</span>
            <span>H</span>
          </div>
          {/* Barra de temperatura — estado neutro ideal na zona de 90°C */}
          <div className="w-16 h-1.5 rounded-full bg-zinc-900 border border-white/10 overflow-hidden">
            <div className="w-[50%] h-full bg-cyan-400/80 rounded-full" />
          </div>
        </div>
        <svg className="w-3.5 h-3.5 fill-current opacity-70" viewBox="0 0 24 24">
          <path d="M15 13V5C15 3.34 13.66 2 12 2S9 3.34 9 5V13C6.79 14.66 6.34 17.79 8 20S12.79 22.66 15 21C16.21 20.09 17 18.66 17 17C17 15.43 16.23 13.97 15 13M12 4C12.55 4 13 4.45 13 5V8H11V5C11 4.45 11.45 4 12 4Z" />
        </svg>
      </div>
    </div>
  )
})
