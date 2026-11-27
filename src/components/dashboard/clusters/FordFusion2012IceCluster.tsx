import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp, mapRange } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { ClusterIndicatorIcon } from '@/components/gauges'

export interface FordFusion2012IceClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * FordFusion2012IceCluster — Quadro de Instrumentos Analógico "Ice Blue" (3 Copos Cromados)
 * exclusivo do Ford Fusion SEL 2.5 16V 2012 (CD338).
 */
export const FordFusion2012IceCluster = memo(function FordFusion2012IceCluster({
  telemetry,
}: FordFusion2012IceClusterProps) {
  const { tachometer, speedometer, warningLights, auxGauges, abs } = telemetry

  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const gearSelectorPosition = useSimulationStore((s) => s.gearSelectorPosition)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const fogLightsLit = useSimulationStore((s) => s.fogLightsLit)
  const odometerKm = useSimulationStore((s) => s.odometerKm)
  const estimatedRangeKm = useSimulationStore((s) => s.estimatedRangeKm)

  const maxRpm = tachometer.maxRpm || 7000
  const redlineStart = tachometer.redlineStart || 6500
  const maxSpeed = speedometer.maxSpeed || 220

  const rpm = clamp(Number.isFinite(tachometer.rpm) ? tachometer.rpm : 0, 0, maxRpm)
  const speed = clamp(Number.isFinite(speedometer.speed) ? speedometer.speed : 0, 0, maxSpeed)
  const coolantTemp = clamp(auxGauges.coolantTemp || 90, 50, 130)
  const fuelPercent = clamp(auxGauges.fuelPercent, 0, 100)

  const startAngle = -220
  const endAngle = 40
  const rpmAngle = mapRange(rpm, 0, maxRpm, startAngle, endAngle)
  const speedAngle = mapRange(speed, 0, maxSpeed, startAngle, endAngle)

  const rpmMarks = useMemo(() => {
    const arr: { angle: number; label: string; major: boolean; red: boolean }[] = []
    for (let r = 0; r <= maxRpm; r += 500) {
      const major = r % 1000 === 0
      arr.push({
        angle: mapRange(r, 0, maxRpm, startAngle, endAngle),
        label: major ? String(r / 1000) : '',
        major,
        red: r >= redlineStart,
      })
    }
    return arr
  }, [maxRpm, redlineStart])

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

  const gearBadge =
    gearSelectorPosition === 'P' || currentGear === -2
      ? 'P'
      : gearSelectorPosition === 'R' || currentGear === -1
        ? 'R'
        : gearSelectorPosition === 'N' || currentGear === 0
          ? 'N'
          : transmissionMode === 'manual_simulated' || gearSelectorPosition === 'M'
            ? `M${currentGear > 0 ? currentGear : 1}`
            : `D (${currentGear > 0 ? currentGear : 1})`

  const fuelAngle = mapRange(fuelPercent, 0, 100, 145, 35)
  const tempAngle = mapRange(coolantTemp, 50, 125, -145, -35)

  return (
    <div
      className="relative flex w-full max-w-5xl flex-col items-center overflow-hidden rounded-2xl border-2 border-sky-400/35 bg-gradient-to-b from-[#131820] via-[#0a0e14] to-[#05070b] px-2.5 py-2 font-mono text-white shadow-[0_0_28px_rgba(56,189,248,0.18)] select-none"
      data-testid="cluster-ford-fusion-2012-ice"
    >
      {/* Topo cromado / Ice Blue */}
      <div className="mb-1 flex w-full items-center justify-between border-b border-sky-400/20 pb-1 text-[8.5px]">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-5 w-6 items-center justify-center rounded border font-black ${
              leftIndicatorLit
                ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.9)]'
                : 'border-white/10 bg-zinc-900 text-zinc-600'
            }`}
          >
            ◀
          </span>
          <span className="font-black tracking-widest text-sky-300">FORD FUSION SEL</span>
          <span className="hidden text-zinc-400 sm:inline">· 2.5 DURATEC ICE BLUE</span>
        </div>

        <div className="flex items-center gap-1.5">
          {headlightsMode !== 'off' && (
            <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[7.5px] font-bold text-emerald-300">
              {headlightsMode === 'high' ? '≡D ALTO' : '≡D'}
            </span>
          )}
          {fogLightsLit && (
            <span className="rounded border border-amber-400/50 bg-amber-500/20 px-1.5 py-0.5 text-[7.5px] font-bold text-amber-200">
              ‡D NEBLINA
            </span>
          )}
          <span
            className={`inline-flex h-5 w-6 items-center justify-center rounded border font-black ${
              rightIndicatorLit
                ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.9)]'
                : 'border-white/10 bg-zinc-900 text-zinc-600'
            }`}
          >
            ▶
          </span>
        </div>
      </div>

      {/* 3 Copos Cromados Ice Blue: Tacômetro | Velocímetro + VFD | Auxiliares */}
      <div className="grid w-full grid-cols-[0.95fr_1.15fr_0.95fr] items-center gap-1.5">
        {/* COPO 1: TACÔMETRO ICE BLUE (0–7 x1000) */}
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 205 198" className="w-full max-w-[215px]">
            <circle cx="102" cy="102" r="90" fill="#070d16" stroke="#94a3b8" strokeWidth="4" />
            <circle cx="102" cy="102" r="84" fill="none" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="2" />
            {rpmMarks.map((m, idx) => {
              const rad = (m.angle * Math.PI) / 180
              const x1 = 102 + (81 - (m.major ? 12 : 6)) * Math.cos(rad)
              const y1 = 102 + (81 - (m.major ? 12 : 6)) * Math.sin(rad)
              const x2 = 102 + 81 * Math.cos(rad)
              const y2 = 102 + 81 * Math.sin(rad)
              const tx = 102 + 60 * Math.cos(rad)
              const ty = 102 + 60 * Math.sin(rad)
              return (
                <g key={idx}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={m.red ? '#ef4444' : '#7dd3fc'}
                    strokeWidth={m.major ? 2.4 : 1.1}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      fill={m.red ? '#f87171' : '#e0f2fe'}
                      fontSize="12"
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
            <text x="102" y="72" fill="#7dd3fc" fontSize="8" fontWeight="700" textAnchor="middle">
              RPM x1000
            </text>
            <g transform={`rotate(${rpmAngle} 102 102)`}>
              <line x1="86" y1="102" x2="173" y2="102" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
            </g>
            <circle cx="102" cy="102" r="10" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
          </svg>
        </div>

        {/* COPO 2 (MAIOR): VELOCÍMETRO 0–220 KM/H + VISOR VFD CENTRAL */}
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 230 205" className="w-full max-w-[242px]">
            <circle cx="115" cy="103" r="95" fill="#070d16" stroke="#cbd5e1" strokeWidth="4.5" />
            <circle cx="115" cy="103" r="89" fill="none" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="2" />
            {speedMarks.map((m, idx) => {
              const rad = (m.angle * Math.PI) / 180
              const x1 = 115 + (86 - (m.major ? 12 : 6)) * Math.cos(rad)
              const y1 = 103 + (86 - (m.major ? 12 : 6)) * Math.sin(rad)
              const x2 = 115 + 86 * Math.cos(rad)
              const y2 = 103 + 86 * Math.sin(rad)
              const tx = 115 + 64 * Math.cos(rad)
              const ty = 103 + 64 * Math.sin(rad)
              return (
                <g key={idx}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#7dd3fc"
                    strokeWidth={m.major ? 2.2 : 1.0}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      fill="#e0f2fe"
                      fontSize="9.5"
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

            <text x="115" y="68" fill="#7dd3fc" fontSize="8.5" fontWeight="800" textAnchor="middle">
              km/h
            </text>

            {/* Visor VFD verde-ciano de matriz de pontos */}
            <rect x="57" y="130" width="116" height="40" rx="4" fill="#041517" stroke="#0e7490" strokeWidth="1.2" />
            <text x="115" y="144" fill="#22d3ee" fontSize="10" fontWeight="900" textAnchor="middle">
              {gearBadge} · {estimatedRangeKm} km
            </text>
            <text x="115" y="160" fill="#67e8f9" fontSize="8.5" fontWeight="700" textAnchor="middle">
              ODO {Math.round(odometerKm).toLocaleString('pt-BR')} km
            </text>

            <g transform={`rotate(${speedAngle} 115 103)`}>
              <line x1="96" y1="103" x2="190" y2="103" stroke="#38bdf8" strokeWidth="3.6" strokeLinecap="round" />
            </g>
            <circle cx="115" cy="103" r="11" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
          </svg>
        </div>

        {/* COPO 3: TEMPERATURA (SUPERIOR) + COMBUSTÍVEL 66L (INFERIOR) + LUZES ESPIA */}
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 205 198" className="w-full max-w-[215px]">
            <circle cx="102" cy="102" r="90" fill="#070d16" stroke="#94a3b8" strokeWidth="4" />
            <circle cx="102" cy="102" r="84" fill="none" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="2" />

            <text x="52" y="66" fill="#7dd3fc" fontSize="10" fontWeight="800">
              C
            </text>
            <text x="144" y="66" fill="#ef4444" fontSize="10" fontWeight="800">
              H
            </text>
            <text x="102" y="54" fill="#bae6fd" fontSize="8.5" fontWeight="700" textAnchor="middle">
              🌡 {Math.round(coolantTemp)}°C
            </text>
            <g transform={`rotate(${tempAngle} 102 82)`}>
              <line x1="102" y1="82" x2="145" y2="82" stroke="#38bdf8" strokeWidth="2.8" strokeLinecap="round" />
            </g>
            <circle cx="102" cy="82" r="5" fill="#94a3b8" />

            <line x1="36" y1="102" x2="168" y2="102" stroke="#1e293b" strokeWidth="1.5" />

            <text x="52" y="144" fill="#f87171" fontSize="10" fontWeight="800">
              E
            </text>
            <text x="144" y="144" fill="#7dd3fc" fontSize="10" fontWeight="800">
              F
            </text>
            <text x="102" y="160" fill="#bae6fd" fontSize="8.5" fontWeight="700" textAnchor="middle">
              ⛽ {Math.round(fuelPercent)}% (66L)
            </text>
            <g transform={`rotate(${fuelAngle} 102 122)`}>
              <line x1="102" y1="122" x2="145" y2="122" stroke="#38bdf8" strokeWidth="2.8" strokeLinecap="round" />
            </g>
            <circle cx="102" cy="122" r="5" fill="#94a3b8" />
          </svg>

          <div className="-mt-1 flex items-center justify-center gap-2">
            <ClusterIndicatorIcon kind="battery" active={Boolean(warningLights.battery)} />
            <ClusterIndicatorIcon kind="oil" active={Boolean(warningLights.oil)} />
            <ClusterIndicatorIcon kind="checkEngine" active={Boolean(warningLights.checkEngine)} />
            {abs.available && (
              <ClusterIndicatorIcon
                kind="abs"
                active={Boolean(warningLights.absFault)}
                flashing={Boolean(warningLights.absActive && !warningLights.absFault)}
              />
            )}
            <ClusterIndicatorIcon kind="tcs" active={Boolean(warningLights.tcs)} flashing={Boolean(warningLights.tcsFlash)} />
            <ClusterIndicatorIcon kind="brake" active={Boolean(warningLights.brake)} />
            <ClusterIndicatorIcon kind="temp" active={Boolean(warningLights.temp)} />
          </div>
        </div>
      </div>
    </div>
  )
})
