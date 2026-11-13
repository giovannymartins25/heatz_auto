import { memo } from 'react'
import type { MapViewportSize } from '@/stores/useUIStore'
import type { DashboardTelemetry } from '@/systems/dashboard'

interface DrivingMapViewportProps {
  size: MapViewportSize
  onSizeChange: (size: MapViewportSize) => void
  compact?: boolean
  className?: string
  telemetry?: DashboardTelemetry
}

/**
 * DrivingMapViewport — Mapa 2D de condução automotiva em tempo real.
 *
 * Características:
 * - Posicionado no topo da área central do cockpit.
 * - Proporção visual equilibrada e adaptativa, sem distorção nem faixa estreita.
 * - Ruas cinzas, quarteirões escuros e veículo representado por um marcador azul luminoso.
 * - Bússola digital, status de telemetria GPS e seletor de modos (P · M · G).
 * - Preparado para futuras evoluções de navegação sem alterar a física do veículo.
 */
export const DrivingMapViewport = memo(function DrivingMapViewport({
  size,
  onSizeChange,
  compact = false,
  className = '',
  telemetry,
}: DrivingMapViewportProps) {
  const currentSpeed = telemetry ? Math.round(telemetry.speedometer.speed) : 0
  const isMoving = currentSpeed > 0
  const paddingClass = compact ? 'p-1.5' : 'p-2'

  return (
    <section
      aria-label="Mapa de condução central"
      className={`relative isolate flex flex-col w-full h-full max-w-xl sm:max-w-2xl mx-auto overflow-hidden rounded-2xl border border-sky-500/25 bg-[#06090f] shadow-[0_4px_25px_rgba(0,0,0,0.85),inset_0_0_20px_rgba(15,23,42,0.9)] transition-all duration-200 select-none ${className}`}
    >
      {/* ── 1. Grid e Mapa Vetorial 2D (Ruas Cinzas, Quarteirões Escuros) ── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 600 280"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          {/* Fundo do terreno escuro */}
          <linearGradient id="mapTerrain" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#080c14" />
            <stop offset="50%" stopColor="#0a0f1a" />
            <stop offset="100%" stopColor="#05080e" />
          </linearGradient>

          {/* Textura sutil de quarteirões urbanos */}
          <pattern id="urbanSubGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.25" />
          </pattern>
        </defs>

        {/* Fundo geral */}
        <rect width="600" height="280" fill="url(#mapTerrain)" />
        <rect width="600" height="280" fill="url(#urbanSubGrid)" />

        {/* ── Quarteirões Escuros Urbanos (City Blocks) ── */}
        <g fill="#0b111e" stroke="#172236" strokeWidth="1.2" opacity="0.95">
          {/* Bloco Noroeste */}
          <rect x="20" y="20" width="130" height="90" rx="8" />
          <rect x="35" y="35" width="45" height="30" rx="3" fill="#070a12" opacity="0.6" />
          <rect x="90" y="35" width="45" height="60" rx="3" fill="#070a12" opacity="0.6" />

          {/* Bloco Norte Central */}
          <rect x="175" y="20" width="250" height="90" rx="8" />
          <rect x="190" y="32" width="105" height="66" rx="4" fill="#070a12" opacity="0.6" />
          <rect x="310" y="32" width="100" height="66" rx="4" fill="#070a12" opacity="0.6" />

          {/* Bloco Nordeste */}
          <rect x="450" y="20" width="130" height="90" rx="8" />
          <rect x="465" y="35" width="100" height="60" rx="4" fill="#070a12" opacity="0.6" />

          {/* Bloco Sudoeste */}
          <rect x="20" y="170" width="130" height="90" rx="8" />
          <rect x="35" y="185" width="100" height="60" rx="4" fill="#070a12" opacity="0.6" />

          {/* Bloco Sul Central */}
          <rect x="175" y="170" width="250" height="90" rx="8" />
          <rect x="190" y="185" width="105" height="60" rx="4" fill="#070a12" opacity="0.6" />
          <rect x="310" y="185" width="100" height="60" rx="4" fill="#070a12" opacity="0.6" />

          {/* Bloco Sudeste */}
          <rect x="450" y="170" width="130" height="90" rx="8" />
          <rect x="465" y="185" width="100" height="60" rx="4" fill="#070a12" opacity="0.6" />
        </g>

        {/* ── Malha de Ruas e Avenidas Cinzas ── */}
        {/* Ruas Secundárias (Cinza Escuro) */}
        <g stroke="#334155" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
          <line x1="85" y1="0" x2="85" y2="280" />
          <line x1="515" y1="0" x2="515" y2="280" />
        </g>

        {/* Avenidas Principais (Cinza Claro) */}
        <g stroke="#475569" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round">
          {/* Avenida Transversal (Horizontal Central) */}
          <line x1="0" y1="140" x2="600" y2="140" />
        </g>

        {/* Avenida Cruzada Norte-Sul Central */}
        <g stroke="#475569" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round">
          <line x1="300" y1="0" x2="300" y2="280" />
        </g>

        {/* Rotatória Central da Condução */}
        <circle cx="300" cy="140" r="38" fill="#475569" />
        <circle cx="300" cy="140" r="22" fill="#0a0f1a" stroke="#1e293b" strokeWidth="2" />

        {/* Faixas e Linhas de Trânsito */}
        {/* Linha tracejada da Avenida Horizontal */}
        <line
          x1="0"
          y1="140"
          x2="260"
          y2="140"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeDasharray="14 10"
          opacity="0.75"
        />
        <line
          x1="340"
          y1="140"
          x2="600"
          y2="140"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeDasharray="14 10"
          opacity="0.75"
        />

        {/* Linha tracejada da Avenida Vertical */}
        <line
          x1="300"
          y1="0"
          x2="300"
          y2="100"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeDasharray="14 10"
          opacity="0.75"
        />
        <line
          x1="300"
          y1="180"
          x2="300"
          y2="280"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeDasharray="14 10"
          opacity="0.75"
        />

        {/* Rota Ativa de GPS (Trajeto em Ciano Luminoso) */}
        <path
          d="M 40 140 L 262 140 A 38 38 0 0 1 300 178 L 300 280"
          fill="none"
          stroke="#0284c7"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
        <path
          d="M 40 140 L 262 140 A 38 38 0 0 1 300 178 L 300 280"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />

        {/* Marcador do Veículo (Ponto Azul Luminoso com Bússola/Orientação) */}
        <g transform="translate(300, 140)">
          {/* Anel de Pulso Radar */}
          <circle
            cx="0"
            cy="0"
            r="16"
            fill="#3b82f6"
            fillOpacity="0.25"
            className={isMoving ? 'animate-ping' : ''}
          />
          {/* Halo Externo Azul */}
          <circle
            cx="0"
            cy="0"
            r="11"
            fill="#1d4ed8"
            stroke="#60a5fa"
            strokeWidth="2"
          />
          {/* Núcleo Branco Central */}
          <circle cx="0" cy="0" r="4.5" fill="#ffffff" />
          {/* Indicador de Direção / Proa */}
          <polygon
            points="0,-16 5,-9 -5,-9"
            fill="#38bdf8"
            stroke="#ffffff"
            strokeWidth="0.8"
          />
        </g>
      </svg>

      {/* ── 2. HUD / Badges Superiores ── */}
      <div className={`relative z-10 flex items-center justify-between w-full ${paddingClass} text-white pointer-events-none`}>
        {/* Status GPS e Rota */}
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/75 px-2 py-0.5 backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span className="font-mono text-[8px] sm:text-[9px] font-black tracking-wider text-slate-200">
            GPS 2D · {isMoving ? `${currentSpeed} KM/H` : 'PARADO'}
          </span>
        </div>

        {/* Bússola e Coordenadas */}
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/75 px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-slate-300 backdrop-blur-sm">
          <span className="text-sky-400 font-black">N ▲</span>
          <span>358°</span>
        </div>
      </div>

      {/* ── 3. Rodapé com Informações de Rua & Seletor de Modos ── */}
      <div className={`relative z-10 mt-auto flex items-end justify-between w-full ${paddingClass}`}>
        {/* Localização Atual */}
        <div className="rounded-lg border border-white/10 bg-black/75 px-2 py-1 font-mono text-[7.5px] sm:text-[8.5px] font-semibold text-slate-300 backdrop-blur-sm pointer-events-none">
          <span className="text-sky-400 font-bold">📍 </span>
          <span className="font-bold text-white">AV. PRINCIPAL</span>
          <span className="text-slate-400 ml-1 hidden xs:inline">· SETOR CENTRAL</span>
        </div>

        {/* ── Alternador de Modos de Visualização (P · M · G) ── */}
        <div
          className="flex items-center rounded-xl border border-white/15 bg-black/85 p-0.5 shadow-lg backdrop-blur-md"
          role="group"
          aria-label="Modo de visualização do cockpit"
        >
          {(
            [
              { id: 'compact', label: 'P', title: 'Painel Imersivo (Painel em destaque)' },
              { id: 'balanced', label: 'M', title: 'Equilibrado (Mapa e painel bem visíveis)' },
              { id: 'expanded', label: 'G', title: 'Mapa Expandido (Mapa em destaque máximo)' },
            ] as const
          ).map((option) => {
            const isSelected = size === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSizeChange(option.id)}
                aria-pressed={isSelected}
                title={option.title}
                className={`min-h-6 min-w-7 rounded-lg px-2 font-mono text-[9px] font-black uppercase transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300 active:scale-95 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.85)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
})
