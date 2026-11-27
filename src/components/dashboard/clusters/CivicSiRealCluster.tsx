import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp, mapRange } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'

interface CivicSiRealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * CivicSiRealCluster — Painel Multiplex de dois andares do Honda Civic Si 2.0 i-VTEC (FA5 · 2008).
 *
 * Fidelidade autêntica Honda Si:
 * - Andar Superior (Upper Deck) com retroiluminação vermelha profunda característica da versão Si
 *   (distinta do azul usado nas versões LXS/EXS)
 * - Escalas de 8 segmentos calibradas 0–100% para Temperatura e Combustível (50 L) + Odômetro digital
 * - Régua progressiva de 6 LEDs sequenciais do i-VTEC (5.800 a 8.300 RPM)
 * - Andar Inferior: Tacômetro central 0–9.000 RPM (redline 8.000 RPM) e luzes-espia reais (incluindo VSA e ABS)
 */
export const CivicSiRealCluster = memo(function CivicSiRealCluster({
  telemetry,
}: CivicSiRealClusterProps) {
  const { tachometer, speedometer, gear, warningLights, auxGauges, abs } = telemetry

  const odometerKm = useSimulationStore((s) => s.odometerKm)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)

  const rpm = tachometer.rpm
  const speed = Math.round(speedometer.speed)

  const isVtecActive = rpm >= 5800
  const isRevLimiter = rpm >= 8250

  const vtecLeds = [
    rpm >= 5800,
    rpm >= 6300,
    rpm >= 6800,
    rpm >= 7300,
    rpm >= 7800,
    rpm >= 8200,
  ]

  const tachSize = 270
  const tachCenter = tachSize / 2
  const tachRadius = 105
  const tachStartAngle = -225
  const tachEndAngle = 45

  const maxRpm = tachometer.maxRpm || 9000
  const redlineStart = tachometer.redlineStart || 8000
  const clampedRpm = clamp(rpm, 0, maxRpm)
  const tachAngle = mapRange(clampedRpm, 0, maxRpm, tachStartAngle, tachEndAngle)

  const tachMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isRedline: boolean }[] = []
    for (let r = 0; r <= maxRpm; r += 200) {
      const isMajor = r % 1000 === 0
      const angle = mapRange(r, 0, maxRpm, tachStartAngle, tachEndAngle)
      list.push({
        angle,
        label: isMajor ? String(r / 1000) : '',
        isMajor,
        isRedline: r >= redlineStart,
      })
    }
    return list
  }, [maxRpm, redlineStart, tachStartAngle, tachEndAngle])

  // 8 segmentos calibrados exatos de 0 a 100% (sem saturar em 80%)
  const fuelPercent = clamp(auxGauges.fuelPercent, 0, 100)
  const tempBlocks = Math.round(clamp((auxGauges.coolantTemp - 50) / 70, 0, 1) * 8)
  const fuelBlocks = fuelPercent <= 0 ? 0 : Math.max(1, Math.round((fuelPercent / 100) * 8))

  return (
    <div
      data-testid="cluster-civic-si"
      className="relative flex flex-col items-center justify-center p-1.5 rounded-2xl bg-[#090b0e] border-2 border-[#231518] shadow-[0_20px_60px_rgba(0,0,0,0.95)] font-mono select-none overflow-hidden max-w-4xl w-full"
    >
      {/* 1. ANDAR SUPERIOR (UPPER DECK): VELOCÍMETRO DIGITAL VERMELHO SI & VTEC LIGHTS */}
      <div className="relative w-full max-w-2xl flex flex-col items-center px-2 py-1.5 rounded-xl bg-gradient-to-b from-[#17090b] via-[#110709] to-[#080406] border-2 border-red-900/75 shadow-[inset_0_2px_15px_rgba(0,0,0,0.9)] mb-1">
        <div className="w-full flex items-center justify-between px-2 sm:px-5 gap-2">
          {/* Marcador Digital de Temperatura (8 blocos vermelhos Si) */}
          <div className="flex flex-col items-start gap-1 w-22">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-black ${leftIndicatorLit ? 'text-emerald-400' : 'text-zinc-700'}`}>◀</span>
              <span className="text-[8.5px] text-red-300/80 font-bold">TEMP [H]</span>
            </div>
            <div className="flex gap-0.5 w-full">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 flex-1 rounded-xs transition-all ${
                    i < tempBlocks
                      ? i >= 6
                        ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.85)]'
                        : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.75)]'
                      : 'bg-zinc-900'
                  }`}
                />
              ))}
            </div>
            <span className="text-[8px] text-zinc-400 font-bold">[C] {Math.round(auxGauges.coolantTemp)}°C</span>
          </div>

          {/* Centro: Grande Velocímetro Digital Vermelho Si + Odômetro */}
          <div className="flex flex-col items-center">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl sm:text-6xl font-black tracking-tighter text-red-100 drop-shadow-[0_0_22px_rgba(239,68,68,0.9)] leading-none font-sans tabular-nums">
                {speed}
              </span>
              <span className="text-xs sm:text-sm font-bold text-red-400">km/h</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[8px] text-red-300/80 font-bold">
              <span>ODO {Math.round(odometerKm).toLocaleString('pt-BR')} km</span>
              {headlightsMode !== 'off' && (
                <span className={headlightsMode === 'high' ? 'text-sky-400' : 'text-emerald-400'}>
                  {headlightsMode === 'high' ? '≡D ALTO' : '≡D'}
                </span>
              )}
            </div>
          </div>

          {/* Marcador Digital de Combustível (8 blocos, 50 L) */}
          <div className="flex flex-col items-end gap-1 w-22">
            <div className="flex items-center gap-1.5">
              <span className="text-[8.5px] text-red-300/80 font-bold">[F] 50L</span>
              <span className={`text-xs font-black ${rightIndicatorLit ? 'text-emerald-400' : 'text-zinc-700'}`}>▶</span>
            </div>
            <div className="flex gap-0.5 w-full">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 flex-1 rounded-xs transition-all ${
                    i < fuelBlocks
                      ? fuelBlocks <= 1
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.75)]'
                      : 'bg-zinc-900'
                  }`}
                />
              ))}
            </div>
            <span className="text-[8px] text-zinc-400 font-bold">[E] {Math.round(fuelPercent)}%</span>
          </div>
        </div>

        {/* Régua de LEDs Sequenciais do i-VTEC (5.800 a 8.300 RPM) */}
        <div className="w-full flex items-center justify-center gap-3 sm:gap-5 mt-2 pt-1.5 border-t border-red-950/70">
          <div
            className={`px-2.5 py-0.5 rounded border transition-all duration-100 ${
              isVtecActive
                ? 'bg-red-600 text-white border-red-400 shadow-[0_0_18px_rgba(220,38,38,0.9)] animate-pulse'
                : 'bg-zinc-900/80 text-zinc-600 border-zinc-800'
            }`}
          >
            <span className="text-[10.5px] font-black tracking-widest">i-VTEC</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {vtecLeds.map((active, idx) => {
              const isLast = idx >= 4
              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border transition-all duration-75 flex items-center justify-center ${
                    active
                      ? isLast || isRevLimiter
                        ? 'bg-red-500 border-red-300 shadow-[0_0_12px_rgba(239,68,68,1)] animate-pulse'
                        : 'bg-amber-400 border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.9)]'
                      : 'bg-zinc-900 border-zinc-700'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-transparent'}`} />
                </div>
              )
            })}
          </div>

          <span className="text-[8.5px] text-zinc-400 font-bold hidden sm:inline">
            {isVtecActive ? 'K20Z3 VTEC ON' : 'VTEC @ 5.800 RPM'}
          </span>
        </div>
      </div>

      {/* 2. ANDAR INFERIOR (LOWER DECK): TACÔMETRO + LUZES-ESPIA DISTRIBUÍDAS */}
      <div className="relative flex items-center justify-center gap-3 sm:gap-6 w-full">
        {/* Luzes-Espia à Esquerda */}
        <div className="flex flex-col items-start gap-2 px-2.5 py-2 rounded-xl bg-black/60 border border-white/5">
          <div className={`text-[9.5px] font-black ${warningLights.checkEngine ? 'text-amber-400 animate-pulse' : 'text-zinc-800'}`}>
            PGM-FI
          </div>
          <div className={`text-[9.5px] font-black ${warningLights.oil ? 'text-red-500 animate-pulse' : 'text-zinc-800'}`}>
            OIL
          </div>
          <div className={`text-[9.5px] font-black ${warningLights.battery ? 'text-red-500' : 'text-zinc-800'}`}>
            BATTERY
          </div>
        </div>

        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${tachSize} ${tachSize}`} className="w-[226px] sm:w-[260px] h-auto max-w-full">
            <circle cx={tachCenter} cy={tachCenter} r={tachRadius + 22} fill="#141820" stroke="#2e3544" strokeWidth="4" />
            <circle cx={tachCenter} cy={tachCenter} r={tachRadius + 16} fill="#0b0e13" stroke="#1c202a" strokeWidth="2" />

            {/* Faixa Vermelha de Redline Honda (8.000 a 9.000 RPM) */}
            {(() => {
              const rStart = mapRange(redlineStart, 0, maxRpm, tachStartAngle, tachEndAngle)
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

            <text x={tachCenter} y={tachCenter - 36} textAnchor="middle" fill="#ef4444" fontSize="18" fontWeight="900" letterSpacing="1">
              Si
            </text>
            <text x={tachCenter} y={tachCenter - 22} textAnchor="middle" fill="#71717a" fontSize="7" fontWeight="bold" letterSpacing="2">
              DOHC i-VTEC
            </text>
            <text x={tachCenter} y={tachCenter + 46} textAnchor="middle" fill="#71717a" fontSize="8" fontWeight="bold">
              r/min × 1000
            </text>

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

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9.5px] text-zinc-500 font-bold">6MT LSD:</span>
            <div className="px-2.5 py-0.5 rounded bg-red-950/60 border border-red-700/80 font-black text-red-400 text-xs shadow">
              {gear.label}
            </div>
            <span className="text-[9.5px] text-zinc-400 font-bold tabular-nums">
              {Math.round(rpm)} <span className="text-[8px] text-zinc-500">RPM</span>
            </span>
          </div>
        </div>

        {/* Luzes-Espia à Direita */}
        <div className="flex flex-col items-end gap-2 px-2.5 py-2 rounded-xl bg-black/60 border border-white/5">
          <div className={`text-[9.5px] font-black ${warningLights.brake ? 'text-red-500' : 'text-zinc-800'}`}>
            (P) BRAKE
          </div>
          <div
            className={`text-[9.5px] font-black ${
              warningLights.tcsFlash
                ? 'text-amber-300 animate-pulse'
                : warningLights.tcs
                  ? 'text-amber-400'
                  : 'text-zinc-800'
            }`}
          >
            VSA
          </div>
          {abs.available && (
            <div
              className={`text-[9.5px] font-black ${
                warningLights.absFault
                  ? 'text-amber-400'
                  : warningLights.absActive
                    ? 'text-amber-300 animate-pulse'
                    : 'text-zinc-800'
              }`}
            >
              (ABS)
            </div>
          )}
          <div className={`text-[9.5px] font-black ${warningLights.temp ? 'text-red-500 animate-pulse' : 'text-zinc-800'}`}>
            TEMP (!)
          </div>
        </div>
      </div>
    </div>
  )
})
