import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp, mapRange } from '@/utils/math'

interface CivicSiRealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * CivicSiRealCluster — Réplica fiel do painel Multiplex de dois andares do Honda Civic Si 2.0 i-VTEC (8ª Geração FA5/FG2).
 *
 * Características icônicas:
 * - Painel de dois andares (Multiplex Upper & Lower Deck)
 * - Andar Superior: Velocímetro digital luminoso, barras digitais de temperatura/combustível
 * - Barra de LEDs progressivos de acoplamento do i-VTEC (5.800 a 8.300 RPM)
 * - Indicador luminoso "i-VTEC" que acende quando o comando variável de válvulas é ativado
 * - Andar Inferior: Tacômetro analógico gigante com fundo vermelho esportivo Si (0 a 9.000 RPM)
 * - Marcha esportiva central com grafismo Honda Racing
 */
export const CivicSiRealCluster = memo(function CivicSiRealCluster({
  telemetry,
}: CivicSiRealClusterProps) {
  const { tachometer, speedometer, gear, warningLights, auxGauges } = telemetry

  const rpm = tachometer.rpm
  const speed = Math.round(speedometer.speed)

  // ── Lógica de Ativação do i-VTEC (Crossover aos 5.800 RPM até corte aos 8.300 RPM) ──
  const isVtecActive = rpm >= 5800
  const isRevLimiter = rpm >= 8250

  // 6 LEDs sequenciais de VTEC (5.800 a 8.300 RPM)
  const vtecLeds = [
    rpm >= 5800,
    rpm >= 6300,
    rpm >= 6800,
    rpm >= 7300,
    rpm >= 7800,
    rpm >= 8200,
  ]

  // ── Tacômetro Analógico Inferior Si (0 a 9.000 RPM) ──
  const tachSize = 270
  const tachCenter = tachSize / 2
  const tachRadius = 105
  const tachStartAngle = -225
  const tachEndAngle = 45

  const clampedRpm = clamp(rpm, 0, 9000)
  const tachAngle = mapRange(clampedRpm, 0, 9000, tachStartAngle, tachEndAngle)

  // Marcações do Tacômetro Honda Si
  const tachMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isRedline: boolean }[] = []
    for (let r = 0; r <= 9000; r += 200) {
      const isMajor = r % 1000 === 0
      const angle = mapRange(r, 0, 9000, tachStartAngle, tachEndAngle)
      list.push({
        angle,
        label: isMajor ? String(r / 1000) : '',
        isMajor,
        isRedline: r >= 8000,
      })
    }
    return list
  }, [])

  // Segmentos digitais de Temperatura (10 blocos)
  const tempBlocks = Math.round(clamp((auxGauges.coolantTemp - 50) / 70, 0, 1) * 10)
  // Segmentos digitais de Combustível (10 blocos)
  const fuelBlocks = Math.round(clamp(auxGauges.fuelPercent / 100, 0, 1) * 10)

  return (
    <div className="relative flex flex-col items-center justify-center p-1.5 rounded-2xl bg-[#090b0e] border-2 border-[#1f242d] shadow-[0_20px_60px_rgba(0,0,0,0.95)] font-mono select-none overflow-hidden max-w-4xl w-full">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. ANDAR SUPERIOR (UPPER DECK): VELOCÍMETRO DIGITAL & VTEC LIGHTS   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative w-full max-w-2xl flex flex-col items-center px-2 py-1.5 rounded-xl bg-gradient-to-b from-[#10141b] to-[#08090d] border-2 border-red-950/70 shadow-[inset_0_2px_15px_rgba(0,0,0,0.9)] mb-1">
        <div className="w-full flex items-center justify-between px-2 sm:px-6 gap-2">
          {/* Marcador Digital de Temperatura em Blocos */}
          <div className="flex flex-col items-start gap-1 w-20">
            <span className="text-[9px] text-zinc-400 font-bold">TEMP [H]</span>
            <div className="flex gap-0.5 w-full">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 flex-1 rounded-sm transition-all ${
                    i < tempBlocks
                      ? i > 6
                        ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                        : 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]'
                      : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>
            <span className="text-[8px] text-zinc-600 font-bold">[C] 90°C</span>
          </div>

          {/* Centro: Grande Velocímetro Digital */}
          <div className="flex flex-col items-center">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl sm:text-7xl font-black tracking-tighter text-sky-200 drop-shadow-[0_0_24px_rgba(56,189,248,0.95)] leading-none font-sans">
                {speed}
              </span>
              <span className="text-xs sm:text-sm font-bold text-sky-300">km/h</span>
            </div>
          </div>

          {/* Marcador Digital de Combustível em Blocos */}
          <div className="flex flex-col items-end gap-1 w-20">
            <span className="text-[9px] text-zinc-400 font-bold">[F] TANQUE</span>
            <div className="flex gap-0.5 w-full">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 flex-1 rounded-sm transition-all ${
                    i < fuelBlocks
                      ? 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]'
                      : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>
            <span className="text-[8px] text-zinc-600 font-bold">[E] 100%</span>
          </div>
        </div>

        {/* ── Régua de LEDs Sequenciais do i-VTEC (5.800 a 8.300 RPM) ── */}
        <div className="w-full flex items-center justify-center gap-3 sm:gap-6 mt-3 pt-2 border-t border-zinc-800/80">
          {/* Logo Luminosa i-VTEC */}
          <div
            className={`px-2.5 py-0.5 rounded border transition-all duration-100 ${
              isVtecActive
                ? 'bg-red-600 text-white border-red-400 shadow-[0_0_18px_rgba(220,38,38,0.9)] animate-pulse'
                : 'bg-zinc-900/80 text-zinc-600 border-zinc-800'
            }`}
          >
            <span className="text-[11px] font-black tracking-widest">i-VTEC</span>
          </div>

          {/* 6 Pontos de LED progressivos */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {vtecLeds.map((active, idx) => {
              const isLast = idx >= 4
              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border transition-all duration-75 flex items-center justify-center ${
                    active
                      ? isLast || isRevLimiter
                        ? 'bg-red-500 border-red-300 shadow-[0_0_12px_rgba(239,68,68,1)] animate-ping'
                        : 'bg-amber-400 border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.9)]'
                      : 'bg-zinc-900 border-zinc-700'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      active ? 'bg-white' : 'bg-transparent'
                    }`}
                  />
                </div>
              )
            })}
          </div>

          <span className="text-[9px] text-zinc-500 font-bold hidden sm:inline">
            {isVtecActive ? '5.800+ RPM VTEC ON' : 'VTEC @ 5.800 RPM'}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2. ANDAR INFERIOR (LOWER DECK): TACÔMETRO + LUZES-ESPIA DISTRIBUÍDAS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative flex items-center justify-center gap-3 sm:gap-6 w-full">
        {/* 3 Luzes-Espia à Esquerda */}
        <div className="flex flex-col items-start gap-2.5 px-2 py-2 rounded-xl bg-black/50 border border-white/5">
          <div className={`text-[10px] font-black ${warningLights.checkEngine ? 'text-amber-500 animate-pulse' : 'text-zinc-800'}`}>
            ENGINE
          </div>
          <div className={`text-[10px] font-black ${warningLights.oil ? 'text-red-500 animate-pulse' : 'text-zinc-800'}`}>
            OIL
          </div>
          <div className={`text-[10px] font-black ${warningLights.battery ? 'text-red-500 animate-pulse' : 'text-zinc-800'}`}>
            BATTERY
          </div>
        </div>

        <div className="relative flex flex-col items-center">
          <svg width={tachSize} height={tachSize}>
          {/* Aro Externo Alumínio Escovado */}
          <circle cx={tachCenter} cy={tachCenter} r={tachRadius + 22} fill="#141820" stroke="#2e3544" strokeWidth="4" />
          <circle cx={tachCenter} cy={tachCenter} r={tachRadius + 16} fill="#0b0e13" stroke="#1c202a" strokeWidth="2" />

          {/* Faixa Vermelha de Redline Honda (8.000 a 9.000 RPM) */}
          {(() => {
            const rStart = mapRange(8000, 0, 9000, tachStartAngle, tachEndAngle)
            const rEnd = tachEndAngle
            const rad1 = (rStart * Math.PI) / 180
            const rad2 = (rEnd * Math.PI) / 180
            const r = tachRadius - 2
            const x1 = tachCenter + r * Math.cos(rad1)
            const y1 = tachCenter + r * Math.sin(rad1)
            const x2 = tachCenter + r * Math.cos(rad2)
            const y2 = tachCenter + r * Math.sin(rad2)
            return (
              <path
                d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                fill="none"
                stroke="#dc2626"
                strokeWidth="7"
                strokeOpacity="0.9"
              />
            )
          })()}

          {/* Ticks e Números Vermelhos Si */}
          {tachMarks.map((m, i) => {
            const rad = (m.angle * Math.PI) / 180
            const cos = Math.cos(rad)
            const sin = Math.sin(rad)
            const r1 = tachRadius
            const r2 = m.isMajor ? tachRadius - 14 : tachRadius - 7
            const textR = tachRadius - 25

            return (
              <g key={i}>
                <line
                  x1={tachCenter + r1 * cos}
                  y1={tachCenter + r1 * sin}
                  x2={tachCenter + r2 * cos}
                  y2={tachCenter + r2 * sin}
                  stroke={m.isRedline ? '#dc2626' : m.isMajor ? '#f87171' : '#7f1d1d'}
                  strokeWidth={m.isMajor ? '2.5' : '1.2'}
                />
                {m.isMajor && (
                  <text
                    x={tachCenter + textR * cos}
                    y={tachCenter + textR * sin + 4.5}
                    textAnchor="middle"
                    fill={m.isRedline ? '#ef4444' : '#fca5a5'}
                    fontSize="13"
                    fontWeight="900"
                    fontFamily="monospace"
                  >
                    {m.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* Emblema Si e Honda Racing */}
          <text x={tachCenter} y={tachCenter - 36} textAnchor="middle" fill="#ef4444" fontSize="18" fontWeight="900" letterSpacing="1">
            Si
          </text>
          <text x={tachCenter} y={tachCenter - 22} textAnchor="middle" fill="#71717a" fontSize="7" fontWeight="bold" letterSpacing="2">
            VTEC DOHC
          </text>
          <text x={tachCenter} y={tachCenter + 46} textAnchor="middle" fill="#71717a" fontSize="8" fontWeight="bold">
            r/min × 1000
          </text>

          {/* Agulha Esportiva Vermelha com Iluminação Central */}
          <g transform={`rotate(${tachAngle}, ${tachCenter}, ${tachCenter})`}>
            <line
              x1={tachCenter}
              y1={tachCenter}
              x2={tachCenter + tachRadius - 2}
              y2={tachCenter}
              stroke="#ef4444"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <line
              x1={tachCenter}
              y1={tachCenter}
              x2={tachCenter - 18}
              y2={tachCenter}
              stroke="#b91c1c"
              strokeWidth="3.8"
              strokeLinecap="round"
            />
            <circle cx={tachCenter} cy={tachCenter} r="13" fill="#090a0f" stroke="#ef4444" strokeWidth="1.8" />
            <circle cx={tachCenter} cy={tachCenter} r="4" fill="#ffffff" />
          </g>
        </svg>

          {/* Display Central da Marcha Atual */}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-zinc-500 font-bold">CÂMBIO 6M:</span>
            <div className="px-3 py-0.5 rounded bg-red-950/60 border border-red-700/80 font-black text-red-400 text-sm shadow">
              {gear.label}
            </div>
            <span className="text-[10px] text-zinc-400 font-bold">
              {Math.round(rpm)} <span className="text-[8px] text-zinc-500">RPM</span>
            </span>
          </div>
        </div>

        {/* 3 Luzes-Espia à Direita */}
        <div className="flex flex-col items-end gap-2.5 px-2 py-2 rounded-xl bg-black/50 border border-white/5">
          <div className={`text-[10px] font-black ${warningLights.brake ? 'text-red-500' : 'text-zinc-800'}`}>
            BRAKE (!)
          </div>
          <div className={`text-[10px] font-black ${warningLights.tcs ? 'text-amber-400' : 'text-zinc-800'}`}>
            VSA
          </div>
          <div className={`text-[10px] font-black ${warningLights.temp ? 'text-red-500 animate-pulse' : 'text-zinc-800'}`}>
            TEMP (!)
          </div>
        </div>
      </div>
    </div>
  )
})

