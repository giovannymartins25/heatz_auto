import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { mapRange, clamp } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { AMBIENT_COLOR_MAP } from '@/utils/ambientLighting'
import { ClusterIndicatorIcon } from '@/components/gauges'
import { formatZeroToHundredSeconds } from '@/systems/vehicle'

interface GolfGTIRealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * GolfGTIRealCluster — Quadro de instrumentos autêntico do Volkswagen Golf GTI Mk7 2.0 TSI (2018).
 * Iluminação original vermelha GTI (`[OEM]`, sem RGB de fábrica), ponteiro de combustível corrigido
 * (`0% -> R` à esquerda, `100% -> 1/1` à direita sobre tanque de 50 L).
 */
export const GolfGTIRealCluster = memo(function GolfGTIRealCluster({
  telemetry,
}: GolfGTIRealClusterProps) {
  const { tachometer, speedometer, warningLights, auxGauges, shiftLight, abs } = telemetry

  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const gearSelectorPosition = useSimulationStore((s) => s.gearSelectorPosition)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const last0to100 = useSimulationStore((s) => s.last0to100)
  const oilTemp = useSimulationStore((s) => s.oilTemp)
  const odometerKm = useSimulationStore((s) => s.odometerKm)
  const estimatedRangeKm = useSimulationStore((s) => s.estimatedRangeKm)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const ambientTheme = AMBIENT_COLOR_MAP.red

  const dialSize = 250
  const center = dialSize / 2
  const radius = 90
  const startAngle = -225
  const endAngle = 45

  // 1. Tacômetro (0 a 8.000 RPM)
  const maxRpm = tachometer.maxRpm || 8000
  const redlineStart = tachometer.redlineStart || 6500
  const clampedRpm = clamp(tachometer.rpm, 0, maxRpm)
  const rpmNeedleAngle = mapRange(clampedRpm, 0, maxRpm, startAngle, endAngle)

  const rpmMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isRedline: boolean }[] = []
    for (let r = 0; r <= maxRpm; r += 200) {
      const isMajor = r % 1000 === 0
      const isSemiMajor = r % 500 === 0
      const angle = mapRange(r, 0, maxRpm, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(r / 100) : '',
        isMajor: isMajor || isSemiMajor,
        isRedline: r >= redlineStart,
      })
    }
    return list
  }, [maxRpm, redlineStart, startAngle, endAngle])

  const coolantTemp = auxGauges.coolantTemp || 90
  const coolantAngle = mapRange(clamp(coolantTemp, 50, 130), 50, 130, -50, 50)

  // 2. Velocímetro (0 a 280 km/h)
  const maxSpeed = speedometer.maxSpeed || 280
  const clampedSpeed = clamp(speedometer.speed, 0, maxSpeed)
  const speedNeedleAngle = mapRange(clampedSpeed, 0, maxSpeed, startAngle, endAngle)

  const speedMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isCityLimit: boolean }[] = []
    for (let s = 0; s <= maxSpeed; s += 10) {
      const isMajor = s % 20 === 0
      const angle = mapRange(s, 0, maxSpeed, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(s) : '',
        isMajor,
        isCityLimit: s === 30 || s === 50,
      })
    }
    return list
  }, [maxSpeed, startAngle, endAngle])

  // Mini Marcador de Combustível (0% -> -50° R esquerda, 100% -> +50° 1/1 direita)
  const fuelPercent = clamp(auxGauges.fuelPercent, 0, 100)
  const fuelAngle = mapRange(fuelPercent, 0, 100, -50, 50)

  const boostPercent = clamp((boostPressureBar + 1.0) / 2.5, 0, 1) * 100
  const isPositiveBoost = boostPressureBar > 0.05

  const dsgModeLabel =
    gearSelectorPosition === 'P' || currentGear === -2
      ? 'P'
      : gearSelectorPosition === 'R' || currentGear === -1
        ? 'R'
        : gearSelectorPosition === 'N' || currentGear === 0
          ? 'N'
          : transmissionMode === 'manual_simulated' || gearSelectorPosition === 'M'
            ? `M${currentGear > 0 ? currentGear : 1}`
            : `${gearSelectorPosition === 'S' ? 'S' : 'D'}${currentGear > 0 ? currentGear : 1}`

  return (
    <div
      data-testid="cluster-golf-gti"
      className={`@container relative flex flex-col items-center w-full max-w-5xl p-1.5 rounded-2xl bg-gradient-to-b from-[#131418] via-[#0d0e12] to-[#060709] border-2 ${ambientTheme.borderClass} ${ambientTheme.shadowClass} select-none`}
    >
      {/* Faixa superior GTI: Seta Esquerda + Shift Light + Faróis + Seta Direita */}
      <div className="mb-1 flex w-full max-w-2xl items-center justify-between px-3 py-0.5 rounded-full bg-black/70 border border-red-900/35 text-[9px] font-mono">
        <span
          className={`font-black ${
            leftIndicatorLit ? 'text-emerald-400 opacity-100' : 'text-zinc-700 opacity-35'
          }`}
        >
          ◀
        </span>
        <div className="flex items-center gap-2">
          <span className="font-black tracking-widest text-red-500">GTI PERFORMANCE</span>
          {shiftLight.isActive && (
            <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[8px] font-black animate-pulse">
              SHIFT ▲
            </span>
          )}
          {headlightsMode !== 'off' && (
            <span className={`text-[8px] font-bold ${headlightsMode === 'high' ? 'text-sky-400' : 'text-emerald-400'}`}>
              {headlightsMode === 'high' ? '≡D ALTO' : '≡D'}
            </span>
          )}
        </div>
        <span
          className={`font-black ${
            rightIndicatorLit ? 'text-emerald-400 opacity-100' : 'text-zinc-700 opacity-35'
          }`}
        >
          ▶
        </span>
      </div>

      {isLaunchControlArmed && (
        <div className="w-full max-w-lg mb-1 px-3 py-0.5 rounded-lg bg-red-600/20 border border-red-500 text-red-300 text-center text-[10px] font-mono font-black animate-pulse">
          🏁 LAUNCH CONTROL AKTIV · SOLTE O FREIO PARA LARGAR!
        </div>
      )}
      {isLaunching && (
        <div className="w-full max-w-lg mb-1 px-3 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-center text-[10px] font-mono font-black">
          🚀 GTI DSG LAUNCH!
        </div>
      )}

      {/* Conjunto de Instrumentos: Tacômetro + Luzes + MFD Central + Luzes + Velocímetro */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 w-full flex-wrap @[640px]:flex-nowrap">
        {/* 1. MOSTRADOR ESQUERDO: TACÔMETRO GTI (0-80 x100/MIN) + ÁGUA */}
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${dialSize} ${dialSize}`} className="w-[235px] sm:w-[248px]">
            <defs>
              <radialGradient id="gtiDialBg" cx="50%" cy="50%" r="50%">
                <stop offset="70%" stopColor="#0b0c10" />
                <stop offset="92%" stopColor="#14151b" />
                <stop offset="98%" stopColor="#22232a" />
                <stop offset="100%" stopColor="#353640" />
              </radialGradient>
              <linearGradient id="gtiRedNeedle" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>

            <circle cx={center} cy={center} r={radius + 18} fill="none" stroke="#4b5563" strokeWidth="3" />
            <circle cx={center} cy={center} r={radius + 15} fill="url(#gtiDialBg)" stroke={ambientTheme.hex} strokeWidth="2" strokeOpacity="0.75" />

            <text
              x={center}
              y={center - 32}
              textAnchor="middle"
              className="fill-zinc-400 font-mono text-[9px] tracking-wider font-bold"
            >
              1/min x 100
            </text>

            <path
              d={describeArc(center, center, radius - 6, mapRange(redlineStart, 0, maxRpm, startAngle, endAngle), endAngle)}
              fill="none"
              stroke="#ef4444"
              strokeWidth="5"
              strokeLinecap="round"
            />

            {rpmMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const innerR = m.isMajor ? radius - 14 : radius - 8
              const outerR = radius - 2
              const x1 = center + innerR * Math.cos(rad)
              const y1 = center + innerR * Math.sin(rad)
              const x2 = center + outerR * Math.cos(rad)
              const y2 = center + outerR * Math.sin(rad)

              const textR = radius - 24
              const tx = center + textR * Math.cos(rad)
              const ty = center + textR * Math.sin(rad) + 4

              return (
                <g key={i}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={m.isRedline ? '#ef4444' : '#f4f4f5'}
                    strokeWidth={m.isMajor ? 2.2 : 1}
                    opacity={m.isMajor ? 0.95 : 0.4}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      className={`font-mono text-xs font-black ${
                        m.isRedline ? 'fill-red-500' : 'fill-white'
                      }`}
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Mini Mostrador de Temperatura da Água */}
            <g transform={`translate(${center}, ${center + 44})`}>
              <path d={describeArc(0, 0, 24, -50, 50)} fill="none" stroke="#3f3f46" strokeWidth="2" />
              <text x="-26" y="6" textAnchor="end" className="fill-zinc-400 font-mono text-[7px] font-bold">50</text>
              <text x="0" y="-12" textAnchor="middle" className="fill-zinc-300 font-mono text-[7px] font-black">90°C</text>
              <text x="26" y="6" textAnchor="start" className="fill-red-400 font-mono text-[7px] font-bold">130</text>
              <text x="0" y="10" textAnchor="middle" className="fill-zinc-500 font-mono text-[6px]">ÁGUA</text>

              <g transform={`rotate(${coolantAngle})`}>
                <line x1="0" y1="0" x2="0" y2="-20" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                <circle cx="0" cy="0" r="4" fill="#18181b" stroke="#dc2626" strokeWidth="1" />
              </g>
            </g>

            {/* Agulha Vermelha GTI */}
            <g transform={`rotate(${rpmNeedleAngle} ${center} ${center})`}>
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#ef4444"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.35"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="url(#gtiRedNeedle)"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center}
                x2={center - 18}
                y2={center}
                stroke="#991b1b"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="12" fill="#1f2026" stroke="#9ca3af" strokeWidth="1.5" />
              <circle cx={center} cy={center} r="4" fill="#dc2626" />
            </g>
          </svg>
        </div>

        {/* Luzes-Espia à Esquerda da Tela Central */}
        <div className="flex @[640px]:flex-col items-center justify-center gap-3 px-1 py-2 rounded-xl bg-black/55 border border-white/5">
          <ClusterIndicatorIcon kind="checkEngine" active={warningLights.checkEngine} sizeClass="w-3.5 h-3.5" />
          <ClusterIndicatorIcon kind="oil" active={warningLights.oil} sizeClass="w-3.5 h-3.5" />
          <ClusterIndicatorIcon kind="battery" active={warningLights.battery} sizeClass="w-3.5 h-3.5" />
        </div>

        {/* 2. CENTRO: TELA MAXI-DOT / MFD COLORIDA GTI */}
        <div className="flex flex-col items-center justify-between w-56 sm:w-60 h-[242px] p-2.5 rounded-2xl bg-black/95 border-2 border-zinc-700/60 shadow-[inset_0_2px_20px_rgba(0,0,0,0.9)]">
          <div className="w-full flex justify-between items-center border-b border-white/10 pb-1 text-[8.5px] font-mono text-zinc-400">
            <span>{Math.round(tachometer.rpm)} RPM</span>
            <span className="font-black text-red-500">SPORT HMI</span>
            <span>⛽ {estimatedRangeKm} km</span>
          </div>

          <div className="flex items-center gap-2 py-0.5 px-3 rounded-full bg-zinc-900 border border-white/10 text-[10px] font-mono">
            <span className="text-zinc-500 font-bold">DSG:</span>
            <span className="px-2 py-0.5 rounded bg-red-600 text-white font-black text-xs shadow-md">
              {dsgModeLabel}
            </span>
            <span className="text-zinc-400 text-[8px] uppercase">{drivingMode}</span>
          </div>

          <div className="flex flex-col items-center my-auto">
            <span className="text-5xl sm:text-6xl font-mono font-black text-white tracking-tight leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
              {Math.round(speedometer.speed)}
            </span>
            <span className="text-[10px] font-mono text-zinc-300 uppercase tracking-widest font-bold mt-0.5">
              KM / H
            </span>
          </div>

          {/* Manômetro de Pressão do Turbo GTI */}
          <div className="w-full flex flex-col items-center p-2 rounded-xl bg-zinc-900/90 border border-white/10 my-1">
            <div className="w-full flex justify-between items-center text-[9px] font-mono mb-1">
              <span className="font-bold text-red-400">⚡ LADEDRUCK · TURBO</span>
              <strong className={`font-mono text-xs font-black ${isPositiveBoost ? 'text-emerald-400' : 'text-sky-400'}`}>
                {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR
              </strong>
            </div>

            <div className="w-full h-2.5 bg-zinc-950 rounded-full border border-white/10 overflow-hidden relative">
              <div className="absolute left-[40%] inset-y-0 w-0.5 bg-white/40 z-10" />
              <div
                className={`h-full ${
                  boostPressureBar > 1.2
                    ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500'
                    : boostPressureBar > 0
                      ? 'bg-gradient-to-r from-sky-400 to-emerald-400'
                      : 'bg-sky-500/70'
                }`}
                style={{ width: `${boostPercent}%` }}
              />
            </div>

            <div className="w-full flex justify-between items-center text-[7px] font-mono text-zinc-500 mt-1">
              <span>-1.0 VAC</span>
              <span>0.0 ATM</span>
              <span>+1.5 BOOST</span>
              {peakBoostBar > 0.1 && (
                <span className="text-amber-400 font-bold">PK +{peakBoostBar.toFixed(2)}</span>
              )}
            </div>
          </div>

          <div className="w-full flex justify-between items-center border-t border-white/10 pt-1 text-[8px] font-mono text-zinc-400">
            <span>ÖL: <strong className="text-white">{Math.round(oilTemp)}°C</strong></span>
            <span className="text-zinc-300">ODO {Math.round(odometerKm).toLocaleString('pt-BR')}</span>
            <span>0-100: <strong className="text-amber-400">{formatZeroToHundredSeconds(last0to100)}</strong></span>
          </div>
        </div>

        {/* Luzes-Espia à Direita da Tela Central */}
        <div className="flex @[640px]:flex-col items-center justify-center gap-2.5 px-1 py-2 rounded-xl bg-black/55 border border-white/5">
          {abs.available && (
            <ClusterIndicatorIcon
              kind="abs"
              active={warningLights.absFault}
              flashing={warningLights.absActive && !warningLights.absFault}
              sizeClass="w-3.5 h-3.5"
            />
          )}
          <ClusterIndicatorIcon kind="brake" active={warningLights.brake} sizeClass="w-3.5 h-3.5" />
          <ClusterIndicatorIcon kind="tcs" active={warningLights.tcs} flashing={warningLights.tcsFlash} sizeClass="w-3.5 h-3.5" />
          <ClusterIndicatorIcon kind="temp" active={warningLights.temp} sizeClass="w-3.5 h-3.5" />
        </div>

        {/* 3. MOSTRADOR DIREITO: VELOCÍMETRO GTI (0-280 KM/H) + COMBUSTÍVEL (50L) */}
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${dialSize} ${dialSize}`} className="w-[235px] sm:w-[248px]">
            <circle cx={center} cy={center} r={radius + 18} fill="none" stroke="#4b5563" strokeWidth="3" />
            <circle cx={center} cy={center} r={radius + 15} fill="url(#gtiDialBg)" stroke={ambientTheme.hex} strokeWidth="2" strokeOpacity="0.75" />

            <text
              x={center}
              y={center - 32}
              textAnchor="middle"
              className="fill-zinc-400 font-mono text-[9px] tracking-widest font-black uppercase"
            >
              km / h
            </text>

            {speedMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const innerR = m.isMajor ? radius - 14 : radius - 8
              const outerR = radius - 2
              const x1 = center + innerR * Math.cos(rad)
              const y1 = center + innerR * Math.sin(rad)
              const x2 = center + outerR * Math.cos(rad)
              const y2 = center + outerR * Math.sin(rad)

              const textR = radius - 24
              const tx = center + textR * Math.cos(rad)
              const ty = center + textR * Math.sin(rad) + 4

              return (
                <g key={i}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={m.isCityLimit ? '#ef4444' : '#fafafa'}
                    strokeWidth={m.isMajor ? 2.2 : 1}
                    opacity={m.isMajor ? 0.95 : 0.4}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      className={`font-mono text-[10px] font-black ${
                        m.isCityLimit ? 'fill-red-400' : 'fill-white'
                      }`}
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Mini Mostrador de Combustível corrigido (-50° = R vazio, +50° = 1/1 cheio) */}
            <g transform={`translate(${center}, ${center + 44})`}>
              <path d={describeArc(0, 0, 24, -50, 50)} fill="none" stroke="#3f3f46" strokeWidth="2" />
              <text x="-26" y="6" textAnchor="end" className="fill-red-400 font-mono text-[7px] font-bold">R</text>
              <text x="0" y="-12" textAnchor="middle" className="fill-zinc-300 font-mono text-[7px] font-black">1/2</text>
              <text x="26" y="6" textAnchor="start" className="fill-zinc-400 font-mono text-[7px] font-bold">1/1</text>
              <text x="0" y="10" textAnchor="middle" className="fill-zinc-400 font-mono text-[6px]">
                ⛽ {Math.round(fuelPercent)}% (50L)
              </text>

              <g transform={`rotate(${fuelAngle})`}>
                <line x1="0" y1="0" x2="0" y2="-20" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                <circle cx="0" cy="0" r="4" fill="#18181b" stroke="#dc2626" strokeWidth="1" />
              </g>
            </g>

            {/* Agulha Vermelha de Velocidade GTI */}
            <g transform={`rotate(${speedNeedleAngle} ${center} ${center})`}>
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#ef4444"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.35"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="url(#gtiRedNeedle)"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center}
                x2={center - 18}
                y2={center}
                stroke="#991b1b"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="12" fill="#1f2026" stroke="#9ca3af" strokeWidth="1.5" />
              <circle cx={center} cy={center} r="4" fill="#dc2626" />
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
