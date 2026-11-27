import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp, mapRange } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'

export interface FordPampa1997ClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * FordPampa1997Cluster — Quadro de Instrumentos Analógico Utilitário (1997)
 * exclusivo da Ford Pampa L 1.8i CFI 1997 (sem ABS, sem telas modernas, iluminação incandescente esverdeada).
 */
export const FordPampa1997Cluster = memo(function FordPampa1997Cluster({
  telemetry,
}: FordPampa1997ClusterProps) {
  const { tachometer, speedometer, warningLights, auxGauges } = telemetry

  const currentGear = useSimulationStore((s) => s.currentGear)
  const ignitionPosition = useSimulationStore((s) => s.ignitionPosition)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const odometerKm = useSimulationStore((s) => s.odometerKm)

  const maxSpeed = speedometer.maxSpeed || 180
  const maxRpm = tachometer.maxRpm || 6000
  const redlineStart = tachometer.redlineStart || 5500

  const speed = clamp(Number.isFinite(speedometer.speed) ? speedometer.speed : 0, 0, maxSpeed)
  const rpm = clamp(Number.isFinite(tachometer.rpm) ? tachometer.rpm : 0, 0, maxRpm)
  const coolantTemp = clamp(auxGauges.coolantTemp || 89, 50, 130)
  const fuelPercent = clamp(auxGauges.fuelPercent, 0, 100)

  const startAngle = -220
  const endAngle = 40
  const speedAngle = mapRange(speed, 0, maxSpeed, startAngle, endAngle)
  const rpmAngle = mapRange(rpm, 0, maxRpm, startAngle, endAngle)

  const speedMarks = useMemo(() => {
    const arr: { angle: number; label: string; major: boolean }[] = []
    for (let s = 0; s <= maxSpeed; s += 10) {
      const major = s % 20 === 0
      arr.push({
        angle: mapRange(s, 0, maxSpeed, startAngle, endAngle),
        label: major ? String(s) : '',
        major,
      })
    }
    return arr
  }, [maxSpeed])

  const rpmMarks = useMemo(() => {
    const arr: { angle: number; label: string; major: boolean; red: boolean }[] = []
    for (let r = 0; r <= maxRpm; r += 250) {
      const major = r % 1000 === 0
      arr.push({
        angle: mapRange(r, 0, maxRpm, startAngle, endAngle),
        label: major ? String(r / 100) : '',
        major: major || r % 500 === 0,
        red: r >= redlineStart,
      })
    }
    return arr
  }, [maxRpm, redlineStart])

  // Tambores do hodômetro mecânico (5 dígitos inteiros + 1 dígito decimal branco)
  const totalTenths = Math.round(Math.max(0, odometerKm) * 10)
  const tenthDigit = String(totalTenths % 10)
  const wholeDigits = String(Math.floor(totalTenths / 10) % 100000).padStart(5, '0')

  const gearLabel = currentGear === -1 ? 'R' : currentGear === 0 ? 'N' : String(currentGear)
  const backlightOn = ignitionPosition !== 'OFF' && headlightsMode !== 'off'

  const fuelNeedleY = mapRange(fuelPercent, 0, 100, 72, 18)
  const tempNeedleY = mapRange(coolantTemp, 50, 125, 72, 18)

  return (
    <div
      className="relative flex w-full max-w-4xl flex-col items-center rounded-xl border-4 border-zinc-700 bg-gradient-to-b from-[#25282c] via-[#17191c] to-[#0f1113] p-2 font-mono text-zinc-100 shadow-[inset_0_2px_10px_rgba(0,0,0,0.9)] select-none"
      data-testid="cluster-ford-pampa-1997"
    >
      {/* Faixa superior de lentes quadradas incandescentes estilo anos 90 */}
      <div className="mb-1.5 flex w-full items-center justify-between rounded border border-zinc-700 bg-[#0d0f10] px-2.5 py-1 text-[8.5px] font-black">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex h-5 w-6 items-center justify-center rounded-xs border ${
              leftIndicatorLit
                ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.85)]'
                : 'border-zinc-800 bg-[#142016] text-emerald-950'
            }`}
          >
            ◀
          </span>
          <span className="text-[8px] tracking-widest text-zinc-400 uppercase">
            FORD PAMPA L · 1.8i CFI
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span
            className={`rounded-xs border px-1.5 py-0.5 text-[7.5px] ${
              warningLights.battery
                ? 'border-red-400 bg-red-600 text-white'
                : 'border-zinc-800 bg-[#221111] text-red-950'
            }`}
          >
            BAT
          </span>
          <span
            className={`rounded-xs border px-1.5 py-0.5 text-[7.5px] ${
              warningLights.oil
                ? 'border-red-400 bg-red-600 text-white'
                : 'border-zinc-800 bg-[#221111] text-red-950'
            }`}
          >
            ÓLEO
          </span>
          <span
            className={`rounded-xs border px-1.5 py-0.5 text-[7.5px] ${
              warningLights.checkEngine
                ? 'border-amber-300 bg-amber-500 text-black'
                : 'border-zinc-800 bg-[#241c0e] text-amber-950'
            }`}
          >
            EEC-IV
          </span>
          <span
            className={`rounded-xs border px-1.5 py-0.5 text-[7.5px] ${
              warningLights.brake
                ? 'border-red-400 bg-red-600 text-white'
                : 'border-zinc-800 bg-[#221111] text-red-950'
            }`}
            title="Freio de Estacionamento"
          >
            ( P )
          </span>
          <span
            className={`rounded-xs border px-1.5 py-0.5 text-[7.5px] ${
              warningLights.temp
                ? 'border-red-400 bg-red-600 text-white'
                : 'border-zinc-800 bg-[#221111] text-red-950'
            }`}
          >
            TEMP
          </span>
          <span
            className={`rounded-xs border px-1.5 py-0.5 text-[7.5px] ${
              headlightsMode === 'high'
                ? 'border-blue-300 bg-blue-600 text-white'
                : headlightsMode === 'low'
                  ? 'border-emerald-400 bg-emerald-700 text-white'
                  : 'border-zinc-800 bg-[#101822] text-blue-950'
            }`}
          >
            ≡D
          </span>
        </div>

        <span
          className={`inline-flex h-5 w-6 items-center justify-center rounded-xs border ${
            rightIndicatorLit
              ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.85)]'
              : 'border-zinc-800 bg-[#142016] text-emerald-950'
          }`}
        >
          ▶
        </span>
      </div>

      {/* Binnacle Retangular Analógico: Velocímetro 180 km/h | Auxiliares Verticais (66L + Temp) | Conta-Giros AP */}
      <div className="grid w-full grid-cols-[1fr_0.72fr_1fr] items-center gap-1.5 rounded-lg border-2 border-zinc-800 bg-[#0b0d0c] p-1.5">
        {/* 1. VELOCÍMETRO ANALÓGICO 0–180 KM/H + HODÔMETRO DE TAMBOR */}
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 210 200" className="w-full max-w-[225px]">
            <circle
              cx="105"
              cy="105"
              r="90"
              fill={backlightOn ? '#0c1510' : '#0b0c0d'}
              stroke="#3f3f46"
              strokeWidth="2.5"
            />
            {speedMarks.map((m, idx) => {
              const rad = (m.angle * Math.PI) / 180
              const x1 = 105 + (84 - (m.major ? 12 : 6)) * Math.cos(rad)
              const y1 = 105 + (84 - (m.major ? 12 : 6)) * Math.sin(rad)
              const x2 = 105 + 84 * Math.cos(rad)
              const y2 = 105 + 84 * Math.sin(rad)
              const tx = 105 + 61 * Math.cos(rad)
              const ty = 105 + 61 * Math.sin(rad)
              return (
                <g key={idx}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={backlightOn ? '#bbf7d0' : '#e4e4e7'}
                    strokeWidth={m.major ? 2.2 : 1.1}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      fill={backlightOn ? '#dcfce7' : '#e4e4e7'}
                      fontSize="10.5"
                      fontWeight="800"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            <text x="105" y="68" fill="#86efac" fontSize="8.5" fontWeight="800" textAnchor="middle">
              km/h
            </text>

            <rect x="64" y="128" width="82" height="17" rx="2" fill="#050505" stroke="#52525b" strokeWidth="1" />
            {wholeDigits.split('').map((d, i) => (
              <g key={i}>
                <rect x={66 + i * 13} y="130" width="11.5" height="13" fill="#18181b" />
                <text x={71.7 + i * 13} y="140" fill="#f4f4f5" fontSize="9.5" fontWeight="800" textAnchor="middle">
                  {d}
                </text>
              </g>
            ))}
            <rect x="131" y="130" width="12.5" height="13" fill="#e4e4e7" />
            <text x="137.2" y="140" fill="#09090b" fontSize="9.5" fontWeight="900" textAnchor="middle">
              {tenthDigit}
            </text>

            <g transform={`rotate(${speedAngle} 105 105)`}>
              <line x1="88" y1="105" x2="176" y2="105" stroke="#f97316" strokeWidth="3.2" strokeLinecap="round" />
            </g>
            <circle cx="105" cy="105" r="9" fill="#27272a" stroke="#52525b" strokeWidth="1.5" />
          </svg>
        </div>

        {/* 2. COLUNA CENTRAL ANALÓGICA: COMBUSTÍVEL (66L) + TEMPERATURA + MARCHA MANUAL */}
        <div className="flex flex-col items-center justify-between gap-1.5 rounded border border-zinc-800 bg-[#101412] px-2 py-2">
          <div className="grid w-full grid-cols-2 gap-1.5">
            <div className="flex flex-col items-center rounded border border-zinc-800 bg-black/70 p-1">
              <span className="text-[7px] font-bold text-emerald-300">COMB. 66L</span>
              <svg viewBox="0 0 56 90" className="w-12">
                <line x1="16" y1="18" x2="16" y2="72" stroke="#52525b" strokeWidth="2" />
                <line x1="12" y1="18" x2="22" y2="18" stroke="#bbf7d0" strokeWidth="2" />
                <line x1="12" y1="45" x2="20" y2="45" stroke="#bbf7d0" strokeWidth="1.5" />
                <line x1="12" y1="72" x2="22" y2="72" stroke="#ef4444" strokeWidth="2.5" />
                <text x="27" y="21" fill="#dcfce7" fontSize="8" fontWeight="800">
                  C
                </text>
                <text x="27" y="48" fill="#a1a1aa" fontSize="7" fontWeight="700">
                  1/2
                </text>
                <text x="27" y="75" fill="#f87171" fontSize="8" fontWeight="800">
                  V
                </text>
                <polygon
                  points={`8,${fuelNeedleY - 3} 23,${fuelNeedleY} 8,${fuelNeedleY + 3}`}
                  fill="#f97316"
                />
              </svg>
              <span className="text-[7px] text-zinc-400">{Math.round(fuelPercent)}%</span>
            </div>

            <div className="flex flex-col items-center rounded border border-zinc-800 bg-black/70 p-1">
              <span className="text-[7px] font-bold text-emerald-300">TEMP.</span>
              <svg viewBox="0 0 56 90" className="w-12">
                <line x1="16" y1="18" x2="16" y2="72" stroke="#52525b" strokeWidth="2" />
                <line x1="12" y1="18" x2="22" y2="18" stroke="#ef4444" strokeWidth="2.5" />
                <rect x="13" y="34" width="6" height="24" fill="none" stroke="#86efac" strokeWidth="1.2" />
                <line x1="12" y1="72" x2="22" y2="72" stroke="#38bdf8" strokeWidth="2" />
                <text x="27" y="21" fill="#f87171" fontSize="8" fontWeight="800">
                  Q
                </text>
                <text x="25" y="48" fill="#bbf7d0" fontSize="6.5" fontWeight="700">
                  NORM
                </text>
                <text x="27" y="75" fill="#7dd3fc" fontSize="8" fontWeight="800">
                  F
                </text>
                <polygon
                  points={`8,${tempNeedleY - 3} 23,${tempNeedleY} 8,${tempNeedleY + 3}`}
                  fill="#f97316"
                />
              </svg>
              <span className="text-[7px] text-zinc-400">{Math.round(coolantTemp)}°C</span>
            </div>
          </div>

          <div className="flex w-full items-center justify-between rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[8px]">
            <span className="text-zinc-400">CÂMBIO 5M</span>
            <span className="rounded bg-black px-2 py-0.5 text-xs font-black text-amber-400">{gearLabel}</span>
          </div>
        </div>

        {/* 3. CONTA-GIROS ANALÓGICO AP-1800 (0–60 x100 RPM) */}
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 210 200" className="w-full max-w-[225px]">
            <circle
              cx="105"
              cy="105"
              r="90"
              fill={backlightOn ? '#0c1510' : '#0b0c0d'}
              stroke="#3f3f46"
              strokeWidth="2.5"
            />
            {rpmMarks.map((m, idx) => {
              const rad = (m.angle * Math.PI) / 180
              const x1 = 105 + (84 - (m.major ? 12 : 6)) * Math.cos(rad)
              const y1 = 105 + (84 - (m.major ? 12 : 6)) * Math.sin(rad)
              const x2 = 105 + 84 * Math.cos(rad)
              const y2 = 105 + 84 * Math.sin(rad)
              const tx = 105 + 61 * Math.cos(rad)
              const ty = 105 + 61 * Math.sin(rad)
              return (
                <g key={idx}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={m.red ? '#ef4444' : backlightOn ? '#bbf7d0' : '#e4e4e7'}
                    strokeWidth={m.major ? 2.2 : 1.1}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      fill={m.red ? '#f87171' : backlightOn ? '#dcfce7' : '#e4e4e7'}
                      fontSize="11"
                      fontWeight="800"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            <text x="105" y="68" fill="#86efac" fontSize="8" fontWeight="800" textAnchor="middle">
              RPM x100
            </text>
            <text x="105" y="142" fill="#a1a1aa" fontSize="8" fontWeight="700" textAnchor="middle">
              AP 1800i
            </text>

            <g transform={`rotate(${rpmAngle} 105 105)`}>
              <line x1="88" y1="105" x2="176" y2="105" stroke="#f97316" strokeWidth="3.2" strokeLinecap="round" />
            </g>
            <circle cx="105" cy="105" r="9" fill="#27272a" stroke="#52525b" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
    </div>
  )
})
