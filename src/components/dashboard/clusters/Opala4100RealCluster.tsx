import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp, mapRange } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'

interface Opala4100RealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * Opala4100RealCluster — Quadro de instrumentos clássico do Chevrolet Opala Diplomata SE 4.1 (1992).
 *
 * Preserva integralmente a identidade clássica GM anos 80/90 (sem ABS, arcos SVG polares exatos
 * em 4.500–5.000 e 5.000–6.000 RPM, voltímetro funcional de rede 12V, pressão de óleo [SIM],
 * nível do tanque de 65 L e temperatura H2O).
 */
export const Opala4100RealCluster = memo(function Opala4100RealCluster({
  telemetry,
}: Opala4100RealClusterProps) {
  const { tachometer, speedometer, gear, warningLights, auxGauges } = telemetry
  const coolantTemp = useSimulationStore((s) => s.coolantTemp)
  const fuelLevelLiters = useSimulationStore((s) => s.fuelLevelLiters)
  const batteryVoltageV = useSimulationStore((s) => s.batteryVoltageV)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const isRevLimiting = useSimulationStore((s) => s.isRevLimiting)
  const hasNosKit = useSimulationStore((s) => s.hasNosKit)
  const nosActive = useSimulationStore((s) => s.nosActive)
  const nosPressurePercent = useSimulationStore((s) => s.nosPressurePercent)
  const odometerKm = useSimulationStore((s) => s.odometerKm)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)

  const maxRpm = tachometer.maxRpm || 6000
  const redlineStart = tachometer.redlineStart || 5000
  const maxSpeed = speedometer.maxSpeed || 220

  const currentRpm = clamp(tachometer.rpm, 0, maxRpm)
  const currentSpeed = clamp(speedometer.speed, 0, maxSpeed)
  const fuelPercent = clamp(auxGauges.fuelPercent, 0, 100)

  const gaugeSize = 220
  const center = gaugeSize / 2
  const radius = 86
  const startAngle = -225
  const endAngle = 45

  const rpmAngle = mapRange(currentRpm, 0, maxRpm, startAngle, endAngle)
  const speedAngle = mapRange(currentSpeed, 0, maxSpeed, startAngle, endAngle)

  // Pressão do Óleo estimada a partir do regime do motor 250-S [SIM]
  const oilPressure = isRunning ? clamp(1.2 + (currentRpm / maxRpm) * 3.4, 0, 5) : 0.0

  const tachMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isRedline: boolean }[] = []
    for (let r = 0; r <= maxRpm; r += 200) {
      const isMajor = r % 1000 === 0
      const angle = mapRange(r, 0, maxRpm, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(r / 1000) : '',
        isMajor,
        isRedline: r >= redlineStart,
      })
    }
    return list
  }, [maxRpm, redlineStart, startAngle, endAngle])

  const speedMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean }[] = []
    for (let s = 0; s <= maxSpeed; s += 10) {
      const isMajor = s % 20 === 0
      const angle = mapRange(s, 0, maxSpeed, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(s) : '',
        isMajor,
      })
    }
    return list
  }, [maxSpeed, startAngle, endAngle])

  const cautionArc = describeArc(
    center,
    center,
    radius - 6,
    mapRange(4500, 0, maxRpm, startAngle, endAngle),
    mapRange(redlineStart, 0, maxRpm, startAngle, endAngle),
  )
  const redlineArc = describeArc(
    center,
    center,
    radius - 6,
    mapRange(redlineStart, 0, maxRpm, startAngle, endAngle),
    endAngle,
  )

  return (
    <div
      data-testid="cluster-opala-4100"
      className="@container relative flex flex-col items-center justify-center p-1.5 sm:p-2.5 rounded-2xl bg-gradient-to-b from-stone-900 via-neutral-950 to-black border-2 border-stone-800 shadow-[0_20px_50px_rgba(0,0,0,0.9)] max-w-4xl w-full select-none font-mono"
    >
      {/* Friso clássico em jacarandá + Lentes de seta superiores */}
      <div className="mb-1 flex w-full items-center justify-between gap-2 px-2">
        <span
          className={`inline-flex h-5 w-6 items-center justify-center rounded-xs border text-[10px] font-black ${
            leftIndicatorLit
              ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.85)]'
              : 'border-stone-800 bg-stone-950 text-stone-700'
          }`}
        >
          ◀
        </span>
        <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-amber-950 via-amber-800/80 to-amber-950 border-y border-amber-700/40 shadow-inner" />
        {headlightsMode !== 'off' && (
          <span
            className={`px-1.5 py-0.5 rounded-xs border text-[7.5px] font-black ${
              headlightsMode === 'high'
                ? 'border-blue-400 bg-blue-600 text-white'
                : 'border-emerald-500/60 bg-emerald-900/70 text-emerald-200'
            }`}
          >
            {headlightsMode === 'high' ? '≡D ALTO' : '≡D'}
          </span>
        )}
        <span
          className={`inline-flex h-5 w-6 items-center justify-center rounded-xs border text-[10px] font-black ${
            rightIndicatorLit
              ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.85)]'
              : 'border-stone-800 bg-stone-950 text-stone-700'
          }`}
        >
          ▶
        </span>
      </div>

      {/* Painel Principal de Instrumentos */}
      <div className="flex flex-col @[580px]:flex-row items-center justify-around w-full gap-2 p-1 rounded-xl bg-neutral-950/90 border border-neutral-800">
        {/* 1. CONTA-GIROS CLÁSSICO 4.1L (0–6.000 RPM) */}
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${gaugeSize} ${gaugeSize}`} className="w-[232px]">
            <circle cx={center} cy={center} r={radius + 15} fill="#0a0a0c" stroke="#262626" strokeWidth={3} />
            <circle cx={center} cy={center} r={radius} fill="#141417" stroke="#1f1f23" strokeWidth={1.5} />

            {/* Faixa Amarela (4.500–5.000) e Vermelha (5.000–6.000) geometricamente exatas */}
            <path d={cautionArc} fill="none" stroke="#eab308" strokeWidth={4.5} strokeLinecap="butt" />
            <path d={redlineArc} fill="none" stroke="#ef4444" strokeWidth={4.5} strokeLinecap="butt" />

            {tachMarks.map((m, idx) => {
              const rad = (m.angle * Math.PI) / 180
              const x1 = center + (radius - (m.isMajor ? 14 : 7)) * Math.cos(rad)
              const y1 = center + (radius - (m.isMajor ? 14 : 7)) * Math.sin(rad)
              const x2 = center + radius * Math.cos(rad)
              const y2 = center + radius * Math.sin(rad)
              const tx = center + (radius - 26) * Math.cos(rad)
              const ty = center + (radius - 26) * Math.sin(rad)

              return (
                <g key={idx}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={m.isRedline ? '#ef4444' : '#e5e5e5'}
                    strokeWidth={m.isMajor ? 2.5 : 1.2}
                  />
                  {m.isMajor && (
                    <text
                      x={tx}
                      y={ty + 4}
                      fill={m.isRedline ? '#ef4444' : '#f5f5f5'}
                      fontSize={11}
                      fontWeight="bold"
                      textAnchor="middle"
                      className="font-mono"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            <text x={center} y={center - 32} fill="#737373" fontSize={9} textAnchor="middle" fontWeight="bold">
              RPM x1000
            </text>
            <text x={center} y={center + 36} fill="#d97706" fontSize={10} textAnchor="middle" fontWeight="bold">
              4.1 / S
            </text>

            <g transform={`rotate(${rpmAngle} ${center} ${center})`}>
              <line
                x1={center - 12}
                y1={center}
                x2={center + radius - 10}
                y2={center}
                stroke="#ff4d00"
                strokeWidth={5.5}
                strokeLinecap="round"
                opacity={0.3}
              />
              <line
                x1={center - 12}
                y1={center}
                x2={center + radius - 10}
                y2={center}
                stroke="#ff4d00"
                strokeWidth={3}
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r={10} fill="#1c1917" stroke="#44403c" strokeWidth={2} />
              <circle cx={center} cy={center} r={4} fill="#ff4d00" />
            </g>
          </svg>
        </div>

        {/* 2. BLOCO CENTRAL: 4 MEDIDORES AUXILIARES (ÓLEO, TANQUE 65L, H2O, BATERIA) & MARCHA */}
        <div className="flex flex-col items-center justify-between gap-2 p-2.5 rounded-2xl bg-stone-950/85 border border-stone-800 w-full max-w-xs">
          <div className="grid grid-cols-2 gap-1.5 w-full text-center">
            <div className="flex flex-col items-center p-1.5 rounded-xl bg-black/60 border border-stone-800">
              <span className="text-[7px] text-stone-400 uppercase tracking-wider">ÓLEO</span>
              <span className="text-xs font-black text-amber-400 tabular-nums">{oilPressure.toFixed(1)} bar</span>
            </div>

            <div className="flex flex-col items-center p-1.5 rounded-xl bg-black/60 border border-stone-800">
              <span className="text-[7px] text-stone-400 uppercase tracking-wider">VOLTÍMETRO</span>
              <span
                className={`text-xs font-black tabular-nums ${
                  batteryVoltageV < 11.6 ? 'text-red-400' : 'text-amber-300'
                }`}
              >
                {batteryVoltageV.toFixed(1)} V
              </span>
            </div>

            <div className="flex flex-col items-center p-1.5 rounded-xl bg-black/60 border border-stone-800">
              <span className="text-[7px] text-stone-400 uppercase tracking-wider">TANQUE 65L</span>
              <span className={`text-xs font-black tabular-nums ${fuelPercent <= 15 ? 'text-red-400' : 'text-amber-200'}`}>
                {Math.round(fuelPercent)}% ({Math.round(fuelLevelLiters)}L)
              </span>
            </div>

            <div className="flex flex-col items-center p-1.5 rounded-xl bg-black/60 border border-stone-800">
              <span className="text-[7px] text-stone-400 uppercase tracking-wider">H2O</span>
              <span className="text-xs font-black text-white tabular-nums">{Math.round(coolantTemp)}°C</span>
            </div>
          </div>

          <div className="flex items-center justify-between w-full px-3 py-1 rounded-xl bg-neutral-900 border border-stone-700">
            <span className="text-[8px] text-stone-400 uppercase tracking-widest font-bold">CÂMBIO 5M</span>
            <span className="text-xl font-black text-amber-400 leading-none">{gear.label}</span>
          </div>

          {/* Luzes-Espia Quadradas Anos 80/90 (sem ABS) */}
          <div className="flex items-center justify-center gap-1 flex-wrap pt-1 border-t border-stone-800/80 w-full">
            <span
              className={`px-1.5 py-0.5 rounded-xs text-[7px] font-bold uppercase border ${
                warningLights.oil
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-stone-900 text-stone-600 border-stone-800'
              }`}
            >
              ÓLEO
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-xs text-[7px] font-bold uppercase border ${
                warningLights.battery
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-stone-900 text-stone-600 border-stone-800'
              }`}
            >
              BAT
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-xs text-[7px] font-bold uppercase border ${
                warningLights.brake
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-stone-900 text-stone-600 border-stone-800'
              }`}
            >
              (P) FREIO
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-xs text-[7px] font-bold uppercase border ${
                warningLights.temp
                  ? 'bg-red-600 text-white border-red-500 animate-pulse'
                  : 'bg-stone-900 text-stone-600 border-stone-800'
              }`}
            >
              TEMP
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-xs text-[7px] font-bold uppercase border ${
                warningLights.checkEngine
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-stone-900 text-stone-600 border-stone-800'
              }`}
            >
              INJ
            </span>
            {hasNosKit && (
              <span
                className={`px-1.5 py-0.5 rounded-xs text-[7px] font-bold uppercase border ${
                  nosActive
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 animate-pulse'
                    : 'bg-stone-900 text-cyan-500/80 border-stone-800'
                }`}
              >
                NOS {Math.round(nosPressurePercent)}%
              </span>
            )}
            {isRevLimiting && (
              <span className="px-1.5 py-0.5 rounded-xs text-[7px] font-black uppercase bg-amber-500 text-black animate-pulse">
                CORTE
              </span>
            )}
          </div>
        </div>

        {/* 3. VELOCÍMETRO CLÁSSICO ATÉ 220 KM/H + HODÔMETRO */}
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${gaugeSize} ${gaugeSize}`} className="w-[232px]">
            <circle cx={center} cy={center} r={radius + 15} fill="#0a0a0c" stroke="#262626" strokeWidth={3} />
            <circle cx={center} cy={center} r={radius} fill="#141417" stroke="#1f1f23" strokeWidth={1.5} />

            {speedMarks.map((m, idx) => {
              const rad = (m.angle * Math.PI) / 180
              const x1 = center + (radius - (m.isMajor ? 14 : 7)) * Math.cos(rad)
              const y1 = center + (radius - (m.isMajor ? 14 : 7)) * Math.sin(rad)
              const x2 = center + radius * Math.cos(rad)
              const y2 = center + radius * Math.sin(rad)
              const tx = center + (radius - 26) * Math.cos(rad)
              const ty = center + (radius - 26) * Math.sin(rad)

              return (
                <g key={idx}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e5e5e5" strokeWidth={m.isMajor ? 2.5 : 1.2} />
                  {m.isMajor && (
                    <text
                      x={tx}
                      y={ty + 4}
                      fill="#f5f5f5"
                      fontSize={10}
                      fontWeight="bold"
                      textAnchor="middle"
                      className="font-mono"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            <rect x={center - 34} y={center + 24} width={68} height={18} fill="#0a0a0a" stroke="#444" rx={3} />
            <text x={center} y={center + 37} fill="#ffffff" fontSize={10.5} fontFamily="monospace" textAnchor="middle" fontWeight="bold">
              {String(Math.round(odometerKm)).padStart(6, '0')}
            </text>

            <text x={center} y={center - 30} fill="#737373" fontSize={9} textAnchor="middle" fontWeight="bold">
              KM/H
            </text>

            <g transform={`rotate(${speedAngle} ${center} ${center})`}>
              <line
                x1={center - 12}
                y1={center}
                x2={center + radius - 10}
                y2={center}
                stroke="#ff4d00"
                strokeWidth={5.5}
                strokeLinecap="round"
                opacity={0.3}
              />
              <line
                x1={center - 12}
                y1={center}
                x2={center + radius - 10}
                y2={center}
                stroke="#ff4d00"
                strokeWidth={3}
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r={10} fill="#1c1917" stroke="#44403c" strokeWidth={2} />
              <circle cx={center} cy={center} r={4} fill="#ff4d00" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
})

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(x, y, radius, endAngle)
  const end = polarToCartesian(x, y, radius, startAngle)
  const arcSweep = endAngle - startAngle <= 180 ? '0' : '1'
  return ['M', start.x, start.y, 'A', radius, radius, 0, arcSweep, 0, end.x, end.y].join(' ')
}

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}
