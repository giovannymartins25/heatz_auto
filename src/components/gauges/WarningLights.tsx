import { memo } from 'react'

interface WarningLightsProps {
  lights: {
    checkEngine: boolean
    oil: boolean
    battery: boolean
    brake: boolean
    tcs: boolean
    tcsFlash: boolean
    temp: boolean
  }
}

/**
 * WarningLights — Painel de luzes-espia automotivas autênticas em SVG.
 *
 * Exibe as luzes de advertência padrão da indústria automotiva:
 * - CHECK ENGINE (Âmbar): ativo quando o motor morre ou na checagem de ignição (starting)
 * - ÓLEO (Vermelho): ativo quando não há pressão de lubrificação (motor desligado ou morto)
 * - BATERIA (Vermelho): ativo quando o alternador não gera carga (motor off/cranking/stalled)
 * - FREIO (Vermelho): ativo ao pressionar o pedal de freio
 * - TCS / ESP (Âmbar): aceso quando TCS desativado, pisca rapidamente durante intervenção
 * - TEMPERATURA (Vermelho): preparado para futura sobretemperatura
 */
export const WarningLights = memo(function WarningLights({ lights }: WarningLightsProps) {
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 px-3 py-1.5 rounded-full bg-zinc-950/80 border border-white/10 shadow-inner select-none">
      {/* 1. CHECK ENGINE (Injeção / Diagnóstico) */}
      <div
        className={`flex items-center justify-center transition-all duration-150 ${
          lights.checkEngine
            ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)] opacity-100'
            : 'text-zinc-800 opacity-25'
        }`}
        title={lights.checkEngine ? 'Lâmpada de Injeção: Alerta de Falha/Estol' : 'Injeção OK'}
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
          <path d="M7 4V2H17V4H20C21.1 4 22 4.9 22 6V9H20V16H18V18H16V20H14V22H10V20H8V18H6V16H4V9H2V6C2 4.9 2.9 4 4 4H7M6 6V14H8V16H10V18H14V16H16V14H18V6H6M8 8H16V10H8V8Z" />
        </svg>
      </div>

      {/* 2. ÓLEO (Pressão de Lubrificação) */}
      <div
        className={`flex items-center justify-center transition-all duration-150 ${
          lights.oil
            ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] opacity-100'
            : 'text-zinc-800 opacity-25'
        }`}
        title={lights.oil ? 'Pressão de Óleo Baixa / Motor Parado' : 'Pressão de Óleo Normal'}
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
          <path d="M19.5 9.5C20.3 9.5 21 10.2 21 11V13.5C21 14.3 20.3 15 19.5 15H17.5V17C17.5 17.8 16.8 18.5 16 18.5H5C4.2 18.5 3.5 17.8 3.5 17V12C3.5 11.2 4.2 10.5 5 10.5H7.5V7C7.5 6.2 8.2 5.5 9 5.5H13C13.8 5.5 14.5 6.2 14.5 7V10.5H16.5C17.3 10.5 18 11.2 18 12V13.5H19.5V11C19.5 10.2 18.8 9.5 18 9.5H17.5V8H19.5C20.3 8 21 8.7 21 9.5M5 12V17H16V12H5Z" />
        </svg>
      </div>

      {/* 3. BATERIA / ALTERNADOR */}
      <div
        className={`flex items-center justify-center transition-all duration-150 ${
          lights.battery
            ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] opacity-100'
            : 'text-zinc-800 opacity-25'
        }`}
        title={lights.battery ? 'Carga de Bateria / Alternador Inativo' : 'Sistema de Carga OK'}
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
          <path d="M16 4H19V7H22V19H2V7H5V4H8V7H16V4M4 9V17H20V9H4M6 12H10V14H6V12M14 12H18V14H14V12Z" />
        </svg>
      </div>

      {/* 4. FREIO (Brake System) */}
      <div
        className={`flex items-center justify-center transition-all duration-150 ${
          lights.brake
            ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] opacity-100'
            : 'text-zinc-800 opacity-25'
        }`}
        title={lights.brake ? 'Freio Acionado' : 'Freio Liberado'}
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <path strokeLinecap="round" d="M3 8a10 10 0 0 0 0 8M21 8a10 10 0 0 1 0 8M12 9v3.5M12 15.5v.5" />
        </svg>
      </div>

      {/* 5. TCS / CONTROLE DE TRAÇÃO */}
      <div
        className={`flex items-center justify-center transition-all duration-150 ${
          lights.tcsFlash
            ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,1)] animate-ping'
            : lights.tcs
            ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)] opacity-100'
            : 'text-zinc-800 opacity-25'
        }`}
        title={
          lights.tcsFlash
            ? 'TCS Intervindo: Corte Proporcional Ativo!'
            : lights.tcs
            ? 'TCS Desativado'
            : 'TCS Ativo e Vigilante'
        }
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.28 5.42 5.08 6.01L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H18V20C18 20.55 18.45 21 19 21H20C20.55 21 21 20.55 21 20V12L18.92 6.01M6.85 7H17.14L18.22 10H5.77L6.85 7M19 17H5V12H19V17M7.5 13C8.33 13 9 13.67 9 14.5S8.33 16 7.5 16 6 15.33 6 14.5 6.67 13 7.5 13M16.5 13C17.33 13 18 13.67 18 14.5S17.33 16 16.5 16 15 15.33 15 14.5 15.67 13 16.5 13Z" />
        </svg>
      </div>

      {/* 6. TEMPERATURA DO LÍQUIDO DE ARREFECIMENTO */}
      <div
        className={`flex items-center justify-center transition-all duration-150 ${
          lights.temp
            ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] opacity-100'
            : 'text-zinc-800 opacity-25'
        }`}
        title={lights.temp ? 'Alerta de Sobreaquecimento' : 'Temperatura Operacional Normal'}
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
          <path d="M15 13V5C15 3.34 13.66 2 12 2S9 3.34 9 5V13C6.79 14.66 6.34 17.79 8 20S12.79 22.66 15 21C16.21 20.09 17 18.66 17 17C17 15.43 16.23 13.97 15 13M12 4C12.55 4 13 4.45 13 5V8H11V5C11 4.45 11.45 4 12 4Z" />
        </svg>
      </div>
    </div>
  )
})
