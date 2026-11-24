import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useGarageStore } from '@/stores/useGarageStore'
import { ClusterIndicatorIcon } from '@/components/gauges'
import { formatZeroToHundredSeconds } from '@/systems/vehicle'

export interface JettaGLIActiveInfoClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * JettaGLIActiveInfoCluster — Active Info Display 10,25" (Digital Cockpit)
 * exclusivo do Volkswagen Jetta GLI 350 TSI 2021 (Mk7).
 *
 * Identidade visual autêntica GLI:
 * - Tela 100% digital widescreen com textura colmeia (honeycomb) sutil e linhas horizontais vermelhas GLI
 * - Dois anéis digitais segmentados (0–8.000 RPM à esquerda, 0–280 km/h à direita)
 * - Mostrador central tabular com velocidade digital, marcha ativa do DSG DQ250 (P/R/N/D1..D6/S1..S6/M1..M6),
 *   barra horizontal de pressão do turbo EA888 (BAR), modo de condução, temp. de óleo e cronômetro 0–100
 * - Barras laterais digitais de temperatura do líquido de arrefecimento (°C) e combustível (50 L)
 */
export const JettaGLIActiveInfoCluster = memo(function JettaGLIActiveInfoCluster({
  telemetry,
}: JettaGLIActiveInfoClusterProps) {
  const { tachometer, speedometer, warningLights, auxGauges, shiftLight } = telemetry

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const gearSelectorPosition = useSimulationStore((s) => s.gearSelectorPosition)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const last0to100 = useSimulationStore((s) => s.last0to100)
  const oilTemp = useSimulationStore((s) => s.oilTemp)
  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const ignitionPosition = useSimulationStore((s) => s.ignitionPosition)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const mileageKm = useGarageStore((s) => s.getActiveCar()?.mileageKm ?? 0)

  const maxRpm = 8000
  const redlineStart = 6500
  const maxSpeed = 280

  const rpm = clamp(Number.isFinite(tachometer.rpm) ? tachometer.rpm : 0, 0, maxRpm)
  const speed = Math.round(clamp(Number.isFinite(speedometer.speed) ? speedometer.speed : 0, 0, 320))
  const coolantTemp = Math.round(clamp(auxGauges.coolantTemp || 90, 50, 130))
  const fuelPercent = Math.round(clamp(auxGauges.fuelLevel ?? 80, 0, 100))

  const dsgGearLabel =
    gearSelectorPosition === 'P' || currentGear === -2
      ? 'P'
      : gearSelectorPosition === 'R' || currentGear === -1
        ? 'R'
        : gearSelectorPosition === 'N' || currentGear === 0
          ? 'N'
          : transmissionMode === 'automatic'
            ? `${gearSelectorPosition === 'S' ? 'S' : 'D'}${currentGear > 0 ? currentGear : 1}`
            : `M${currentGear > 0 ? currentGear : 1}`

  // Geometria dos anéis digitais Active Info Display (Raio 84, varredura 250° de 145° a 395°)
  const radius = 84
  const startDeg = 145
  const sweepDeg = 250
  const arcCircumference = (sweepDeg / 360) * 2 * Math.PI * radius

  const rpmRatio = clamp(rpm / maxRpm, 0, 1)
  const speedRatio = clamp(speed / maxSpeed, 0, 1)

  const polar = (cx: number, cy: number, r: number, deg: number) => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  const buildArc = (cx: number, cy: number, r: number, fromDeg: number, toDeg: number) => {
    const p1 = polar(cx, cy, r, fromDeg)
    const p2 = polar(cx, cy, r, toDeg)
    const largeArc = toDeg - fromDeg > 180 ? 1 : 0
    return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  const rpmTicks = useMemo(() => {
    const list: { deg: number; label: string; major: boolean; red: boolean }[] = []
    for (let r = 0; r <= maxRpm; r += 500) {
      const major = r % 1000 === 0
      const deg = startDeg + (r / maxRpm) * sweepDeg
      list.push({ deg, label: major ? String(r / 1000) : '', major, red: r >= redlineStart })
    }
    return list
  }, [])

  const speedTicks = useMemo(() => {
    const list: { deg: number; label: string; major: boolean }[] = []
    for (let s = 0; s <= maxSpeed; s += 20) {
      const major = s % 40 === 0
      const deg = startDeg + (s / maxSpeed) * sweepDeg
      list.push({ deg, label: major ? String(s) : '', major })
    }
    return list
  }, [])

  const boostRatio = clamp((boostPressureBar + 0.8) / 2.3, 0, 1) * 100
  const modeLabel =
    drivingMode === 'sport' ? 'SPORT GLI' : drivingMode === 'eco' ? 'ECO' : 'NORMAL'

  return (
    <div
      className="relative flex w-full max-w-5xl flex-col items-center overflow-hidden rounded-2xl border-2 border-red-600/50 bg-gradient-to-b from-[#0b0d13] via-[#07080c] to-[#030406] px-2.5 py-2 font-mono text-white shadow-[0_0_32px_rgba(220,38,38,0.22)] select-none"
      data-testid="cluster-jetta-gli-aid"
    >
      {/* Linha superior estilo grade colmeia GLI */}
      <div className="mb-1 flex w-full items-center justify-between border-b border-red-600/35 pb-1 text-[9px]">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-5 w-6 items-center justify-center rounded border text-[10px] font-black transition-all ${
              leftIndicatorLit
                ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.9)]'
                : 'border-white/10 bg-zinc-900/80 text-zinc-600'
            }`}
          >
            ◀
          </span>
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[8.5px] font-black tracking-widest text-white shadow">
            GLI
          </span>
          <span className="text-[8px] font-bold tracking-widest text-zinc-400 uppercase">
            ACTIVE INFO DISPLAY 10.25&quot;
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded border px-1.5 py-0.5 text-[8px] font-black uppercase ${
              drivingMode === 'sport'
                ? 'border-red-500/60 bg-red-600/20 text-red-300'
                : drivingMode === 'eco'
                  ? 'border-sky-500/60 bg-sky-600/20 text-sky-300'
                  : 'border-zinc-600 bg-zinc-900 text-zinc-300'
            }`}
          >
            {modeLabel}
          </span>
          {headlightsMode !== 'off' && (
            <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300">
              {headlightsMode === 'high' ? '≡D ALTO' : '≡D BAIXO'}
            </span>
          )}
          <span
            className={`inline-flex h-5 w-6 items-center justify-center rounded border text-[10px] font-black transition-all ${
              rightIndicatorLit
                ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.9)]'
                : 'border-white/10 bg-zinc-900/80 text-zinc-600'
            }`}
          >
            ▶
          </span>
        </div>
      </div>

      {(isLaunchControlArmed || isLaunching) && (
        <div className="mb-1 w-full rounded-lg border border-red-500 bg-red-600/20 py-0.5 text-center text-[9.5px] font-black tracking-wider text-red-200">
          {isLaunching ? '🚀 LAUNCH CONTROL DSG ATIVO' : '🏁 LAUNCH CONTROL PROGRAMADO · SOLTE O FREIO'}
        </div>
      )}

      {/* Corpo principal: Anel RPM Esquerdo + Palco Digital Central + Anel Velocidade Direito */}
      <div className="grid w-full grid-cols-[1fr_1.15fr_1fr] items-center gap-1.5">
        {/* 1. ANEL DIGITAL DE RPM + BARRA DE TEMPERATURA */}
        <div className="relative flex flex-col items-center">
          <svg viewBox="0 0 210 200" className="w-full max-w-[225px]">
            <defs>
              <linearGradient id="gliRpmArc" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="75%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#fb7185" />
              </linearGradient>
            </defs>
            <circle cx="105" cy="104" r="92" fill="#090b10" stroke="#dc2626" strokeOpacity="0.35" strokeWidth="1.5" />
            <path
              d={buildArc(105, 104, radius, startDeg, startDeg + sweepDeg)}
              fill="none"
              stroke="#1e2230"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d={buildArc(
                105,
                104,
                radius,
                startDeg + (redlineStart / maxRpm) * sweepDeg,
                startDeg + sweepDeg,
              )}
              fill="none"
              stroke="#7f1d1d"
              strokeWidth="10"
            />
            <path
              d={buildArc(105, 104, radius, startDeg, startDeg + sweepDeg)}
              fill="none"
              stroke="url(#gliRpmArc)"
              strokeWidth="10"
              strokeDasharray={`${(rpmRatio * arcCircumference).toFixed(1)} 999`}
            />

            {rpmTicks.map((t, i) => {
              const pIn = polar(105, 104, radius - (t.major ? 14 : 8), t.deg)
              const pOut = polar(105, 104, radius - 3, t.deg)
              const pTxt = polar(105, 104, radius - 25, t.deg)
              return (
                <g key={i}>
                  <line
                    x1={pIn.x}
                    y1={pIn.y}
                    x2={pOut.x}
                    y2={pOut.y}
                    stroke={t.red ? '#ef4444' : '#e4e4e7'}
                    strokeWidth={t.major ? 2.2 : 1.1}
                  />
                  {t.label && (
                    <text
                      x={pTxt.x}
                      y={pTxt.y}
                      fill={t.red ? '#f87171' : '#f4f4f5'}
                      fontSize="11"
                      fontWeight="800"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {t.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Centro digital do conta-giros */}
            <text x="105" y="92" fill="#71717a" fontSize="8" fontWeight="700" textAnchor="middle">
              1/min x1000
            </text>
            <text
              x="105"
              y="113"
              fill={rpm >= redlineStart ? '#f87171' : '#ffffff'}
              fontSize="22"
              fontWeight="900"
              textAnchor="middle"
            >
              {(rpm / 1000).toFixed(1)}
            </text>
            <text x="105" y="132" fill="#ef4444" fontSize="9" fontWeight="800" textAnchor="middle">
              {dsgGearLabel}
            </text>

            {/* Barra inferior de Temperatura */}
            <text x="68" y="176" fill="#9ca3af" fontSize="8" fontWeight="700">
              🌡 {coolantTemp}°C
            </text>
            <rect x="65" y="181" width="80" height="5" rx="2.5" fill="#18181b" />
            <rect
              x="65"
              y="181"
              width={clamp(((coolantTemp - 50) / 80) * 80, 4, 80)}
              height="5"
              rx="2.5"
              fill={coolantTemp > 108 ? '#ef4444' : '#38bdf8'}
            />
          </svg>
        </div>

        {/* 2. PALCO CENTRAL MFD (VELOCIDADE TABULAR, DSG, BOOST E LUZES ESPIA) */}
        <div className="flex flex-col items-center justify-between rounded-xl border border-red-500/25 bg-zinc-950/90 px-2.5 py-2">
          {/* Shift light bar */}
          <div className="mb-1 flex w-full justify-center gap-1">
            {[0.65, 0.75, 0.84, 0.91, 0.96].map((th, idx) => {
              const lit = rpm / redlineStart >= th || shiftLight.isActive
              return (
                <span
                  key={idx}
                  className={`h-1.5 flex-1 rounded-full ${
                    lit
                      ? idx >= 3
                        ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]'
                        : 'bg-amber-400'
                      : 'bg-zinc-800'
                  }`}
                />
              )
            })}
          </div>

          {/* Velocidade digital central */}
          <div className="flex flex-col items-center leading-none">
            <span className="text-[40px] font-black tracking-tight text-white tabular-nums sm:text-[46px]">
              {speed}
            </span>
            <span className="text-[9px] font-bold tracking-widest text-zinc-400">KM/H</span>
          </div>

          {/* Seletor DSG P R N D/S M */}
          <div className="my-1.5 flex items-center gap-1 rounded-lg border border-white/10 bg-black/80 px-2 py-0.5 text-[9.5px] font-black">
            {(['P', 'R', 'N', 'D', 'S'] as const).map((pos) => {
              const active =
                (pos === 'D' && transmissionMode === 'automatic' && gearSelectorPosition === 'D') ||
                (pos === 'S' && transmissionMode === 'automatic' && gearSelectorPosition === 'S') ||
                (pos !== 'D' && pos !== 'S' && gearSelectorPosition === pos)
              return (
                <span
                  key={pos}
                  className={`rounded px-1.5 py-0.5 ${
                    active ? 'bg-red-600 text-white shadow' : 'text-zinc-500'
                  }`}
                >
                  {pos}
                </span>
              )
            })}
            <span className="ml-1 border-l border-white/15 pl-1.5 text-red-400">{dsgGearLabel}</span>
          </div>

          {/* Barra de Pressão Turbo 350 TSI */}
          <div className="w-full">
            <div className="mb-0.5 flex items-center justify-between text-[8px] font-bold">
              <span className="text-red-400">TURBO 350 TSI</span>
              <span className="text-zinc-200 tabular-nums">
                {boostPressureBar >= 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} bar
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-zinc-900">
              <div
                className="h-full bg-gradient-to-r from-red-700 via-red-500 to-amber-400 transition-all duration-75"
                style={{ width: `${boostRatio.toFixed(1)}%` }}
              />
            </div>
          </div>

          {/* Dados de bordo + Luzes espia */}
          <div className="mt-1.5 flex w-full items-center justify-between border-t border-white/10 pt-1 text-[8px] text-zinc-400">
            <span>ÓLEO {Math.round(oilTemp || 92)}°C</span>
            {last0to100 !== null ? (
              <span className="font-bold text-emerald-400">0-100 {formatZeroToHundredSeconds(last0to100)}s</span>
            ) : (
              <span>IGN {ignitionPosition}</span>
            )}
            <span className="tabular-nums">{Math.round(mileageKm).toLocaleString()} km</span>
          </div>

          <div className="mt-1 flex items-center justify-center gap-2">
            <ClusterIndicatorIcon
              kind="battery"
              active={!isRunning && ignitionPosition !== 'OFF'}
            />
            <ClusterIndicatorIcon kind="oil" active={Boolean(warningLights.oil)} />
            <ClusterIndicatorIcon kind="checkEngine" active={Boolean(warningLights.checkEngine)} />
            <ClusterIndicatorIcon kind="tcs" active={Boolean(warningLights.tcs)} flashing={Boolean(warningLights.tcsFlash)} />
            <ClusterIndicatorIcon kind="brake" active={Boolean(warningLights.brake)} />
          </div>
        </div>

        {/* 3. ANEL DIGITAL DE VELOCIDADE + BARRA DE COMBUSTÍVEL (50 L) */}
        <div className="relative flex flex-col items-center">
          <svg viewBox="0 0 210 200" className="w-full max-w-[225px]">
            <circle cx="105" cy="104" r="92" fill="#090b10" stroke="#dc2626" strokeOpacity="0.35" strokeWidth="1.5" />
            <path
              d={buildArc(105, 104, radius, startDeg, startDeg + sweepDeg)}
              fill="none"
              stroke="#1e2230"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d={buildArc(105, 104, radius, startDeg, startDeg + sweepDeg)}
              fill="none"
              stroke="#ef4444"
              strokeWidth="10"
              strokeDasharray={`${(speedRatio * arcCircumference).toFixed(1)} 999`}
            />

            {speedTicks.map((t, i) => {
              const pIn = polar(105, 104, radius - (t.major ? 14 : 8), t.deg)
              const pOut = polar(105, 104, radius - 3, t.deg)
              const pTxt = polar(105, 104, radius - 26, t.deg)
              return (
                <g key={i}>
                  <line
                    x1={pIn.x}
                    y1={pIn.y}
                    x2={pOut.x}
                    y2={pOut.y}
                    stroke="#e4e4e7"
                    strokeWidth={t.major ? 2.0 : 1.0}
                  />
                  {t.label && (
                    <text
                      x={pTxt.x}
                      y={pTxt.y}
                      fill="#f4f4f5"
                      fontSize="9.5"
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {t.label}
                    </text>
                  )}
                </g>
              )
            })}

            <text x="105" y="92" fill="#71717a" fontSize="8" fontWeight="700" textAnchor="middle">
              VELOCÍMETRO
            </text>
            <text x="105" y="114" fill="#ffffff" fontSize="22" fontWeight="900" textAnchor="middle">
              {speed}
            </text>
            <text x="105" y="131" fill="#a1a1aa" fontSize="8.5" fontWeight="700" textAnchor="middle">
              km/h · MQB
            </text>

            {/* Barra inferior de Combustível (50 L) */}
            <text x="65" y="176" fill="#9ca3af" fontSize="8" fontWeight="700">
              ⛽ {fuelPercent}% (50L)
            </text>
            <rect x="65" y="181" width="80" height="5" rx="2.5" fill="#18181b" />
            <rect
              x="65"
              y="181"
              width={clamp((fuelPercent / 100) * 80, 3, 80)}
              height="5"
              rx="2.5"
              fill={fuelPercent <= 15 ? '#ef4444' : '#f43f5e'}
            />
          </svg>
        </div>
      </div>
    </div>
  )
})
