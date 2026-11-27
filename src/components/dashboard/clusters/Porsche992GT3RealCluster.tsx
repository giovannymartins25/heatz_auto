import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { mapRange, clamp } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { AMBIENT_COLOR_MAP } from '@/utils/ambientLighting'
import { ClusterIndicatorIcon } from '@/components/gauges'

interface Porsche992GT3RealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * Porsche992GT3RealCluster — Instrumentação fiel do Porsche 911 Turbo S (Geração 992.1 · 3.8 Bi-Turbo PDK AWD).
 *
 * Calibração autêntica 992.1 Turbo S (`config.json`):
 * - Tacômetro analógico central Porsche 0–8.000 RPM com redline aos 7.000 RPM e corte em 7.200 RPM (`[OEM]`)
 * - Velocímetro esquerdo 0–350 km/h com velocímetro digital central, odômetro real e nível do tanque de 67 L (`[OEM]`)
 * - Tela direita de telemetria Porsche: Repartição real de torque PTM AWD (`frontTorqueSplitPercent`/`rearTorqueSplitPercent`),
 *   G-Meter real (`lateralAccelG` / `longitudinalAccelG`), pressão do biturbo (bar), fluidos e modos `WET / NORMAL / SPORT PLUS / TRACK` (`[OEM]`/`[SIM]`)
 */
export const Porsche992GT3RealCluster = memo(function Porsche992GT3RealCluster({
  telemetry,
}: Porsche992GT3RealClusterProps) {
  const { tachometer, speedometer, warningLights, auxGauges, shiftLight, abs } = telemetry

  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const oilTemp = useSimulationStore((s) => s.oilTemp)
  const lateralAccelG = useSimulationStore((s) => s.lateralAccelG)
  const longitudinalAccelG = useSimulationStore((s) => s.longitudinalAccelG)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const gearSelectorPosition = useSimulationStore((s) => s.gearSelectorPosition)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const frontTorqueSplitPercent = useSimulationStore((s) => s.frontTorqueSplitPercent)
  const rearTorqueSplitPercent = useSimulationStore((s) => s.rearTorqueSplitPercent)
  const torqueSplitSource = useSimulationStore((s) => s.torqueSplitSource)
  const odometerKm = useSimulationStore((s) => s.odometerKm)
  const estimatedRangeKm = useSimulationStore((s) => s.estimatedRangeKm)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const ambientTheme = AMBIENT_COLOR_MAP[ambientLightColor] || AMBIENT_COLOR_MAP.amber

  const pdkDisplay =
    gearSelectorPosition === 'P' || currentGear === -2
      ? 'P'
      : gearSelectorPosition === 'R' || currentGear === -1
        ? 'R'
        : gearSelectorPosition === 'N' || currentGear === 0
          ? 'N'
          : transmissionMode === 'manual_simulated' || gearSelectorPosition === 'M'
            ? `M${currentGear > 0 ? currentGear : 1}`
            : gearSelectorPosition === 'S'
              ? `S${currentGear > 0 ? currentGear : 1}`
              : `D${currentGear > 0 ? currentGear : 1}`

  const size = 260
  const center = size / 2
  const radius = 94
  const startAngle = -220
  const endAngle = 40

  // 1. Tacômetro 911 Turbo S 992.1 (0 a 8.000 RPM, redline 7.000 RPM)
  const maxRpm = tachometer.maxRpm || 8000
  const redlineStart = tachometer.redlineStart || 7000
  const clampedRpm = clamp(tachometer.rpm, 0, maxRpm)
  const rpmNeedleAngle = mapRange(clampedRpm, 0, maxRpm, startAngle, endAngle)

  const rpmMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isRedline: boolean }[] = []
    for (let r = 0; r <= maxRpm; r += 250) {
      const isMajor = r % 1000 === 0
      const isSemiMajor = r % 500 === 0
      const angle = mapRange(r, 0, maxRpm, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(r / 1000) : '',
        isMajor: isMajor || isSemiMajor,
        isRedline: r >= redlineStart,
      })
    }
    return list
  }, [maxRpm, redlineStart, startAngle, endAngle])

  // 2. Velocímetro (0 a 350 km/h)
  const maxSpeed = speedometer.maxSpeed || 350
  const clampedSpeed = clamp(speedometer.speed, 0, maxSpeed)
  const speedNeedleAngle = mapRange(clampedSpeed, 0, maxSpeed, startAngle, endAngle)
  const fuelPercent = clamp(auxGauges.fuelPercent, 0, 100)

  const speedMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean }[] = []
    for (let s = 0; s <= maxSpeed; s += 10) {
      const isMajor = s % 50 === 0
      const isSemiMajor = s % 25 === 0
      const angle = mapRange(s, 0, maxSpeed, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(s) : '',
        isMajor: isMajor || isSemiMajor,
      })
    }
    return list
  }, [maxSpeed, startAngle, endAngle])

  // 3. Pressão de óleo estimada a partir do giro real [SIM] e G-Force real da física 2D
  const oilPressureBar = isRunning ? clamp(1.6 + (clampedRpm / maxRpm) * 3.8, 1.5, 5.4) : 0.0
  const gForceX = clamp(lateralAccelG, -1.5, 1.5)
  const gForceY = clamp(longitudinalAccelG, -1.5, 1.5)
  const totalG = Math.hypot(gForceX, gForceY)

  const porscheModeLabel =
    drivingMode === 'track'
      ? 'TRACK'
      : drivingMode === 'sport'
        ? 'SPORT PLUS'
        : drivingMode === 'eco'
          ? 'WET'
          : 'NORMAL'

  const shiftStartRpm = Math.max(4800, redlineStart - 1600)

  return (
    <div
      data-testid="cluster-porsche-992-turbos"
      className={`@container relative flex flex-col items-center w-full max-w-6xl p-1.5 rounded-2xl bg-gradient-to-b from-[#0a0b0e] via-zinc-950 to-black border-2 ${ambientTheme.borderClass} ${ambientTheme.shadowClass} select-none transition-colors duration-300`}
    >
      {/* Régua Superior: Setas + Luzes-Espia · 16 LEDs Convergentes · Luzes-Espia + Seta */}
      <div className="flex items-center justify-between gap-2 w-full max-w-2xl mb-1">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900/90 border border-white/10">
          <span
            className={`text-[10px] font-mono font-black ${
              leftIndicatorLit ? 'text-emerald-400 opacity-100' : 'text-zinc-700 opacity-35'
            }`}
          >
            ◀
          </span>
          <ClusterIndicatorIcon kind="checkEngine" active={warningLights.checkEngine} sizeClass="w-3.5 h-3.5" />
          <ClusterIndicatorIcon kind="oil" active={warningLights.oil} sizeClass="w-3.5 h-3.5" />
          <ClusterIndicatorIcon kind="battery" active={warningLights.battery} sizeClass="w-3.5 h-3.5" />
        </div>

        {/* Barra convergente de 16 LEDs calibrada para 5.400–7.000 RPM */}
        <div className="flex items-center justify-center gap-1 flex-1 py-1 bg-zinc-900/90 rounded-full border border-white/10 px-2.5">
          {[...Array(16)].map((_, idx) => {
            const distanceFromCenter = Math.abs(idx - 7.5)
            const triggerRatio = (7.5 - distanceFromCenter) / 7.5
            const triggerRpm = shiftStartRpm + triggerRatio * (redlineStart - shiftStartRpm)
            const isActive = isRunning && clampedRpm >= triggerRpm
            const isRedlineLed = triggerRatio >= 0.8
            const isYellowLed = triggerRatio >= 0.4 && triggerRatio < 0.8

            return (
              <div
                key={idx}
                className={`h-2 flex-1 rounded-xs transition-all duration-75 ${
                  shiftLight.isBlinking
                    ? 'bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,1)] animate-pulse'
                    : isActive
                      ? isRedlineLed
                        ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]'
                        : isYellowLed
                          ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]'
                          : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                      : 'bg-zinc-800/80'
                }`}
              />
            )
          })}
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900/90 border border-white/10">
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
          {headlightsMode !== 'off' && (
            <span
              className={`text-[8px] font-mono font-black ${
                headlightsMode === 'high' ? 'text-sky-400' : 'text-emerald-400'
              }`}
            >
              ≡D
            </span>
          )}
          <span
            className={`text-[10px] font-mono font-black ${
              rightIndicatorLit ? 'text-emerald-400 opacity-100' : 'text-zinc-700 opacity-35'
            }`}
          >
            ▶
          </span>
        </div>
      </div>

      {/* Banner de Launch Control Ativo */}
      {isLaunchControlArmed && (
        <div className="w-full max-w-lg mb-1 px-3 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 text-center text-[10px] font-mono font-black animate-pulse">
          🏁 LAUNCH CONTROL ATIVO · SOLTE O FREIO PARA LARGAR!
        </div>
      )}
      {isLaunching && (
        <div className="w-full max-w-lg mb-1 px-3 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-center text-[10px] font-mono font-black">
          🚀 PORSCHE 992 LAUNCH CONTROL!
        </div>
      )}

      {/* Conjunto Triplo de Instrumentos 911 Turbo S */}
      <div className="grid grid-cols-1 @[660px]:grid-cols-3 gap-2 sm:gap-3 w-full items-center justify-items-center">
        {/* 1. MOSTRADOR ESQUERDO: VELOCÍMETRO ANALÓGICO 0-350 KM/H + TANQUE 67L + ODO */}
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-[242px] sm:w-[254px]">
            <defs>
              <radialGradient id="porscheSpeedBg" cx="50%" cy="50%" r="50%">
                <stop offset="65%" stopColor="#090a0d" />
                <stop offset="90%" stopColor="#121318" />
                <stop offset="100%" stopColor="#252730" />
              </radialGradient>
              <linearGradient id="porscheNeedleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>

            <circle cx={center} cy={center} r={radius + 18} fill="none" stroke="#3f3f46" strokeWidth="3" />
            <circle cx={center} cy={center} r={radius + 15} fill="url(#porscheSpeedBg)" stroke="#18181b" strokeWidth="2" />

            <text
              x={center}
              y={center - 32}
              textAnchor="middle"
              className="fill-zinc-400 font-mono text-[9px] tracking-widest font-black uppercase"
            >
              KM / H
            </text>

            <path
              d={describeArc(center, center, radius - 6, startAngle, endAngle)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              opacity="0.28"
            />

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
                    stroke="#fafafa"
                    strokeWidth={m.isMajor ? 2.2 : 1}
                    opacity={m.isMajor ? 0.95 : 0.4}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      className="font-mono text-[10px] font-black fill-zinc-200"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Velocidade digital + Odômetro + Tanque 67L integrados */}
            <g transform={`translate(${center}, ${center + 30})`}>
              <rect x="-46" y="-20" width="92" height="58" rx="10" fill="#090a0d" stroke="#3f3f46" strokeWidth="1.2" />
              <text x="0" y="0" textAnchor="middle" className="font-mono text-[22px] font-black fill-white">
                {Math.round(speedometer.speed)}
              </text>
              <text x="0" y="12" textAnchor="middle" className="font-mono text-[7.5px] font-bold fill-zinc-400">
                ODO {Math.round(odometerKm).toLocaleString('pt-BR')} km
              </text>
              <rect x="-36" y="18" width="72" height="4.5" rx="2" fill="#18181b" />
              <rect
                x="-36"
                y="18"
                width={clamp((fuelPercent / 100) * 72, 0, 72)}
                height="4.5"
                rx="2"
                fill={fuelPercent <= 15 ? '#ef4444' : '#fbbf24'}
              />
              <text x="0" y="32" textAnchor="middle" className="font-mono text-[7px] font-bold fill-amber-300">
                ⛽ {Math.round(fuelPercent)}% · {estimatedRangeKm} km
              </text>
            </g>

            {/* Agulha de Velocidade */}
            <g transform={`rotate(${speedNeedleAngle} ${center} ${center})`}>
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#fbbf24"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.35"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="url(#porscheNeedleGrad)"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center}
                x2={center - 18}
                y2={center}
                stroke="#b45309"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="11" fill="#141416" stroke="#fbbf24" strokeWidth="1.5" />
              <circle cx={center} cy={center} r="3.5" fill="#f59e0b" />
            </g>
          </svg>
        </div>

        {/* 2. MOSTRADOR CENTRAL: TACÔMETRO ANALÓGICO 911 TURBO S (0–8.000 RPM, REDLINE 7.000) */}
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-[240px] sm:w-[260px]">
            <defs>
              <radialGradient id="porscheTachBg" cx="50%" cy="50%" r="50%">
                <stop offset="65%" stopColor="#090a0d" />
                <stop offset="90%" stopColor="#121318" />
                <stop offset="100%" stopColor="#2a2c35" />
              </radialGradient>
            </defs>

            <circle cx={center} cy={center} r={radius + 18} fill="none" stroke="#52525b" strokeWidth="3.5" />
            <circle cx={center} cy={center} r={radius + 15} fill="url(#porscheTachBg)" stroke="#18181b" strokeWidth="2" />

            <text
              x={center}
              y={center - 36}
              textAnchor="middle"
              className="fill-amber-400 font-mono text-[9.5px] tracking-widest font-black uppercase"
            >
              turbo S
            </text>
            <text
              x={center}
              y={center - 24}
              textAnchor="middle"
              className="fill-zinc-400 font-mono text-[7.5px] tracking-wider font-bold"
            >
              1/min × 1000
            </text>

            {/* Faixa vermelha de redline (7.000 a 8.000 RPM) */}
            <path
              d={describeArc(center, center, radius - 6, mapRange(redlineStart, 0, maxRpm, startAngle, endAngle), endAngle)}
              fill="none"
              stroke="#ef4444"
              strokeWidth="4.5"
              strokeLinecap="round"
            />

            {rpmMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const innerR = m.isMajor ? radius - 15 : radius - 8
              const outerR = radius - 2
              const x1 = center + innerR * Math.cos(rad)
              const y1 = center + innerR * Math.sin(rad)
              const x2 = center + outerR * Math.cos(rad)
              const y2 = center + outerR * Math.sin(rad)

              const textR = radius - 25
              const tx = center + textR * Math.cos(rad)
              const ty = center + textR * Math.sin(rad) + 4

              return (
                <g key={i}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={m.isRedline ? '#ef4444' : '#fafafa'}
                    strokeWidth={m.isMajor ? 2.4 : 1}
                    opacity={m.isMajor ? 0.95 : 0.45}
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

            {/* Janela digital da caixa PDK de 8 marchas */}
            <g transform={`translate(${center}, ${center + 30})`}>
              <circle cx="0" cy="0" r="26" fill="#090a0d" stroke="#3f3f46" strokeWidth="1.5" />
              <text x="0" y="6" textAnchor="middle" className="font-mono text-2xl font-black fill-amber-400">
                {pdkDisplay}
              </text>
              <text x="0" y="17" textAnchor="middle" className="font-mono text-[7px] font-bold fill-zinc-400">
                8G PDK
              </text>
            </g>

            {/* Agulha do Tacômetro */}
            <g transform={`rotate(${rpmNeedleAngle} ${center} ${center})`}>
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#fbbf24"
                strokeWidth="5.5"
                strokeLinecap="round"
                opacity="0.35"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="url(#porscheNeedleGrad)"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center}
                x2={center - 20}
                y2={center}
                stroke="#b45309"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="12" fill="#141416" stroke="#fbbf24" strokeWidth="1.5" />
              <circle cx={center} cy={center} r="4" fill="#f59e0b" />
            </g>
          </svg>
        </div>

        {/* 3. TELA TFT DIREITA: PTM TORQUE SPLIT REAL, G-METER REAL, BOOST E FLUIDOS */}
        <div className="flex flex-col items-center justify-between gap-1 w-full max-w-[280px] min-h-[256px] p-2.5 rounded-2xl bg-zinc-950/90 border border-white/10 shadow-[inset_0_2px_15px_rgba(0,0,0,0.8)]">
          <div className="w-full flex justify-between items-center border-b border-white/10 pb-1 text-[8px] font-mono text-zinc-400">
            <span className="font-bold text-amber-400">PTM AWD & G-FORCE</span>
            <span className="text-[7px] text-zinc-500">
              {torqueSplitSource === 'measured_axle_torque' ? 'TORQUE ATIVO' : 'ACOPL. NOMINAL'}
            </span>
          </div>

          {/* Repartição Real PTM AWD + Círculo de Atrito G-Force Real */}
          <div className="w-full flex items-center justify-between px-1 py-0.5 gap-2">
            {/* Eixos Dianteiro / Traseiro PTM */}
            <div className="flex-1 flex flex-col gap-1.5 rounded-xl border border-white/10 bg-zinc-900/70 p-2 font-mono text-[7.5px]">
              <div>
                <div className="flex justify-between text-zinc-300 font-bold">
                  <span>DIANT.</span>
                  <span className="text-sky-300 tabular-nums">{frontTorqueSplitPercent}%</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full rounded-full bg-zinc-950 overflow-hidden">
                  <div
                    className="h-full bg-sky-400 transition-all duration-100"
                    style={{ width: `${clamp(frontTorqueSplitPercent, 0, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-zinc-300 font-bold">
                  <span>TRAS.</span>
                  <span className="text-amber-300 tabular-nums">{rearTorqueSplitPercent}%</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full rounded-full bg-zinc-950 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-100"
                    style={{ width: `${clamp(rearTorqueSplitPercent, 0, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Medidor G-Force alimentado pela dinâmica real */}
            <div className="relative w-18 h-18 rounded-full border border-white/20 bg-zinc-900/60 flex items-center justify-center flex-shrink-0">
              <div className="w-12 h-12 rounded-full border border-white/10" />
              <div className="w-6 h-6 rounded-full border border-white/10" />
              <div className="absolute inset-x-0 h-px bg-white/15" />
              <div className="absolute inset-y-0 w-px bg-white/15" />

              <div
                className="absolute w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,1)] transition-transform duration-75"
                style={{
                  transform: `translate(${gForceX * 14}px, ${-gForceY * 14}px)`,
                }}
              />
              <span className="absolute bottom-0.5 text-[6.5px] font-mono text-zinc-300 tabular-nums">
                {totalG.toFixed(2)}G
              </span>
            </div>
          </div>

          {/* Manômetro de Pressão Biturbo 3.8L */}
          <div className="w-full flex flex-col p-1.5 rounded-xl bg-zinc-900/90 border border-white/10">
            <div className="w-full flex justify-between items-center text-[8px] font-mono mb-0.5">
              <span className="font-bold text-amber-400">⚡ BOOST · BI-TURBO</span>
              <strong className={`font-mono text-[10px] font-black ${boostPressureBar > 0 ? 'text-amber-400' : 'text-sky-400'}`}>
                {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR
              </strong>
            </div>

            <div className="w-full h-2 bg-zinc-950 rounded-full border border-white/10 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-red-500"
                style={{ width: `${clamp((boostPressureBar + 1.0) / 2.6, 0, 1) * 100}%` }}
              />
            </div>

            <div className="w-full flex justify-between items-center text-[6px] font-mono text-zinc-500 mt-0.5">
              <span>0.0</span>
              <span>0.8</span>
              <span>+1.6 BAR</span>
              {peakBoostBar > 0.1 && (
                <span className="text-amber-400 font-bold">PK +{peakBoostBar.toFixed(2)}</span>
              )}
            </div>
          </div>

          {/* Fluidos */}
          <div className="w-full grid grid-cols-3 gap-1 border-t border-white/10 pt-1 text-center text-[8px] font-mono">
            <div className="bg-zinc-900/80 p-1 rounded">
              <span className="text-zinc-500 block">ÓLEO BAR</span>
              <strong className="text-white">{oilPressureBar.toFixed(1)}</strong>
            </div>
            <div className="bg-zinc-900/80 p-1 rounded">
              <span className="text-zinc-500 block">ÓLEO °C</span>
              <strong className="text-white">{Math.round(oilTemp ?? auxGauges.oilTemp ?? auxGauges.coolantTemp)}°C</strong>
            </div>
            <div className="bg-zinc-900/80 p-1 rounded">
              <span className="text-zinc-500 block">ÁGUA °C</span>
              <strong className="text-emerald-400">{Math.round(auxGauges.coolantTemp)}°C</strong>
            </div>
          </div>

          {/* Rodapé: Seletor de Modo no Volante + PSM + PTM */}
          <div className="w-full flex justify-between items-center gap-1 border-t border-white/10 pt-1 text-[7.5px] font-mono">
            <span
              className={`px-1.5 py-0.5 rounded font-black whitespace-nowrap border ${
                drivingMode === 'track'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-400/50'
                  : drivingMode === 'sport'
                    ? 'bg-red-500/20 text-red-300 border-red-500/50'
                    : drivingMode === 'eco'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
            >
              {porscheModeLabel}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span
                className={`px-1 py-0.5 rounded font-bold whitespace-nowrap ${
                  telemetry.tcs.enabled
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                }`}
              >
                PSM {telemetry.tcs.enabled ? 'ON' : 'OFF'}
              </span>
              <span className="px-1 py-0.5 rounded font-bold whitespace-nowrap bg-zinc-900 text-amber-300 border border-white/10">
                PTM {frontTorqueSplitPercent}/{rearTorqueSplitPercent}
              </span>
            </div>
          </div>
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
