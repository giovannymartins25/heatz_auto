import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp, mapRange } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'

interface GolQuadradoRealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * GolQuadradoRealCluster — Quadro satélite VDO (0–260 km/h) + instrumentos de preparação `[UPG]`
 * (AutoMeter Monster 5" 10.000 RPM + Shift Light + Manômetro Cronomac 52mm Turbo) do Gol Quadrado 1.9 AP Turbo (1994).
 */
export const GolQuadradoRealCluster = memo(function GolQuadradoRealCluster({
  telemetry,
}: GolQuadradoRealClusterProps) {
  const { tachometer, speedometer, gear, warningLights, auxGauges } = telemetry

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const isRevLimiting = useSimulationStore((s) => s.isRevLimiting)
  const odometerKm = useSimulationStore((s) => s.odometerKm)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)

  const tachSize = 280
  const tachCenter = tachSize / 2
  const tachRadius = 110
  const tachStartAngle = -225
  const tachEndAngle = 45

  const maxRpm = tachometer.maxRpm || 10000
  const redlineStart = tachometer.redlineStart || 7200
  const clampedRpm = clamp(tachometer.rpm, 0, maxRpm)
  const tachAngle = mapRange(clampedRpm, 0, maxRpm, tachStartAngle, tachEndAngle)

  const isShiftLightActive = clampedRpm >= 7000 || isRevLimiting || isLaunchControlArmed

  const tachMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isRedzone: boolean }[] = []
    for (let r = 0; r <= maxRpm; r += 200) {
      const isMajor = r % 1000 === 0
      const angle = mapRange(r, 0, maxRpm, tachStartAngle, tachEndAngle)
      list.push({
        angle,
        label: isMajor ? String(r / 1000) : '',
        isMajor,
        isRedzone: r >= redlineStart,
      })
    }
    return list
  }, [maxRpm, redlineStart, tachStartAngle, tachEndAngle])

  // Velocímetro alinhado ao config.json (0 a 260 km/h)
  const speedSize = 220
  const speedCenter = speedSize / 2
  const speedRadius = 85
  const speedStartAngle = -220
  const speedEndAngle = 40
  const maxSpeed = speedometer.maxSpeed || 260
  const clampedSpeed = clamp(speedometer.speed, 0, maxSpeed)
  const speedAngle = mapRange(clampedSpeed, 0, maxSpeed, speedStartAngle, speedEndAngle)

  const speedMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean }[] = []
    for (let s = 0; s <= maxSpeed; s += 10) {
      const isMajor = s % 20 === 0
      const angle = mapRange(s, 0, maxSpeed, speedStartAngle, speedEndAngle)
      list.push({
        angle,
        label: isMajor ? String(s) : '',
        isMajor,
      })
    }
    return list
  }, [maxSpeed, speedStartAngle, speedEndAngle])

  const boostSize = 160
  const boostCenter = boostSize / 2
  const boostRadius = 60
  const boostStartAngle = -210
  const boostEndAngle = 30
  const clampedBoost = clamp(boostPressureBar, -1.0, 3.0)
  const boostAngle = mapRange(clampedBoost, -1.0, 3.0, boostStartAngle, boostEndAngle)

  const fuelPercent = clamp(auxGauges.fuelPercent, 0, 100)
  const tempAngle = mapRange(clamp(auxGauges.coolantTemp, 50, 120), 50, 120, -45, 45)
  const fuelAngle = mapRange(fuelPercent, 0, 100, -45, 45)

  return (
    <div
      data-testid="cluster-gol-quadrado-turbo"
      className="@container relative flex flex-col items-center justify-center p-1.5 sm:p-2.5 rounded-2xl bg-[#0d0f12] border-2 border-[#24272e] shadow-[0_15px_50px_rgba(0,0,0,0.9),inset_0_2px_8px_rgba(255,255,255,0.06)] font-mono select-none overflow-hidden max-w-4xl w-full"
    >
      <div className="absolute inset-0 bg-[radial-gradient(#1a1d24_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

      <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-zinc-700 border border-zinc-900 shadow flex items-center justify-center text-[7px] text-zinc-950 font-black">+</div>
      <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-zinc-700 border border-zinc-900 shadow flex items-center justify-center text-[7px] text-zinc-900 font-black">+</div>
      <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-zinc-700 border border-zinc-900 shadow flex items-center justify-center text-[7px] text-zinc-950 font-black">+</div>
      <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-zinc-700 border border-zinc-900 shadow flex items-center justify-center text-[7px] text-zinc-950 font-black">+</div>

      {(isLaunchControlArmed || isLaunching) && (
        <div className="relative z-10 w-full flex items-center justify-center mb-1">
          {isLaunchControlArmed ? (
            <div className="px-3 py-0.5 rounded bg-amber-500/20 border border-amber-400 text-amber-300 text-[10px] font-black tracking-widest animate-pulse">
              ⚡ 3-STEP CORTE ATIVO
            </div>
          ) : (
            <div className="px-3 py-0.5 rounded bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[10px] font-black tracking-widest">
              🚀 LARGADA FULL BOOST!
            </div>
          )}
        </div>
      )}

      {/* Conteúdo Principal do Painel */}
      <div className="relative z-10 flex flex-wrap @[640px]:flex-nowrap items-center justify-center gap-2 sm:gap-4 w-full">
        {/* 1. VELOCÍMETRO VDO (0–260 KM/H) */}
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${speedSize} ${speedSize}`} className="w-[232px]">
            <circle cx={speedCenter} cy={speedCenter} r={speedRadius + 18} fill="#14171d" stroke="#2a2e37" strokeWidth="4" />
            <circle cx={speedCenter} cy={speedCenter} r={speedRadius + 12} fill="#0d0e12" stroke="#1c1f26" strokeWidth="2" />

            {speedMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const cos = Math.cos(rad)
              const sin = Math.sin(rad)
              const r1 = speedRadius
              const r2 = m.isMajor ? speedRadius - 12 : speedRadius - 6
              const textR = speedRadius - 22

              return (
                <g key={i}>
                  <line
                    x1={speedCenter + r1 * cos}
                    y1={speedCenter + r1 * sin}
                    x2={speedCenter + r2 * cos}
                    y2={speedCenter + r2 * sin}
                    stroke={m.isMajor ? '#e4e4e7' : '#71717a'}
                    strokeWidth={m.isMajor ? '2' : '1'}
                  />
                  {m.isMajor && (
                    <text
                      x={speedCenter + textR * cos}
                      y={speedCenter + textR * sin + 3.5}
                      textAnchor="middle"
                      fill="#e4e4e7"
                      fontSize="8.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            <text x={speedCenter} y={speedCenter - 28} textAnchor="middle" fill="#71717a" fontSize="9.5" fontWeight="bold">
              km/h · VDO
            </text>

            <g transform={`translate(${speedCenter - 34}, ${speedCenter + 26})`}>
              <rect width="68" height="18" rx="2" fill="#000" stroke="#3f3f46" strokeWidth="1" />
              <text x="34" y="13" textAnchor="middle" fill="#f4f4f5" fontSize="10" fontWeight="black" letterSpacing="2">
                {String(Math.round(odometerKm)).padStart(6, '0')}
              </text>
            </g>

            <g transform={`rotate(${speedAngle}, ${speedCenter}, ${speedCenter})`}>
              <line
                x1={speedCenter}
                y1={speedCenter}
                x2={speedCenter + speedRadius - 2}
                y2={speedCenter}
                stroke="#ff4d00"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1={speedCenter}
                y1={speedCenter}
                x2={speedCenter - 16}
                y2={speedCenter}
                stroke="#ff4d00"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle cx={speedCenter} cy={speedCenter} r="10" fill="#18181b" stroke="#71717a" strokeWidth="1.5" />
              <circle cx={speedCenter} cy={speedCenter} r="3" fill="#ff4d00" />
            </g>
          </svg>
          <span className="text-[9.5px] text-zinc-500 font-bold mt-0.5">VELOCÍMETRO 260</span>
        </div>

        {/* 2. CENTRO: AUTOMETER MONSTER 5" [UPG] + SHIFT LIGHT */}
        <div className="relative flex flex-col items-center">
          <div
            className={`absolute top-0.5 right-0.5 z-20 flex items-center justify-center transition-all ${
              isShiftLightActive ? 'scale-105' : 'scale-100 opacity-90'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all shadow-xl ${
                isShiftLightActive
                  ? 'bg-amber-400 border-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.95)] animate-pulse'
                  : 'bg-zinc-900 border-zinc-700'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[8px] ${
                  isShiftLightActive
                    ? 'bg-amber-300 text-black shadow-[inset_0_0_10px_rgba(255,255,255,0.8)]'
                    : 'bg-zinc-800 text-zinc-600'
                }`}
              >
                SHIFT
              </div>
            </div>
          </div>

          <svg viewBox={`0 0 ${tachSize} ${tachSize}`} className="w-[235px] sm:w-[266px] h-auto max-w-full">
            <circle cx={tachCenter} cy={tachCenter} r={tachRadius + 24} fill="#272a33" stroke="#4a4f5c" strokeWidth="4" />
            <circle cx={tachCenter} cy={tachCenter} r={tachRadius + 18} fill="#12141a" stroke="#1f222a" strokeWidth="2" />

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
                  stroke="#ef4444"
                  strokeWidth="8"
                  strokeOpacity="0.8"
                />
              )
            })()}

            {tachMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const cos = Math.cos(rad)
              const sin = Math.sin(rad)
              const r1 = tachRadius
              const r2 = m.isMajor ? tachRadius - 14 : tachRadius - 7
              const textR = tachRadius - 26

              return (
                <g key={i}>
                  <line
                    x1={tachCenter + r1 * cos}
                    y1={tachCenter + r1 * sin}
                    x2={tachCenter + r2 * cos}
                    y2={tachCenter + r2 * sin}
                    stroke={m.isRedzone ? '#ef4444' : m.isMajor ? '#ffffff' : '#94a3b8'}
                    strokeWidth={m.isMajor ? '2.5' : '1.2'}
                  />
                  {m.isMajor && (
                    <text
                      x={tachCenter + textR * cos}
                      y={tachCenter + textR * sin + 4.5}
                      textAnchor="middle"
                      fill={m.isRedzone ? '#ef4444' : '#ffffff'}
                      fontSize="14"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            <text x={tachCenter} y={tachCenter - 40} textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="900" letterSpacing="1">
              Auto Meter
            </text>
            <text x={tachCenter} y={tachCenter - 28} textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold" letterSpacing="2">
              SPORT-COMP
            </text>
            <text x={tachCenter} y={tachCenter + 46} textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="bold">
              RPM × 1000
            </text>

            <g transform={`rotate(${tachAngle}, ${tachCenter}, ${tachCenter})`}>
              <line
                x1={tachCenter}
                y1={tachCenter}
                x2={tachCenter + tachRadius - 2}
                y2={tachCenter}
                stroke="#f59e0b"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <line
                x1={tachCenter}
                y1={tachCenter}
                x2={tachCenter - 22}
                y2={tachCenter}
                stroke="#f59e0b"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle cx={tachCenter} cy={tachCenter} r="14" fill="#090a0f" stroke="#e2e8f0" strokeWidth="2" />
              <circle cx={tachCenter} cy={tachCenter} r="4" fill="#f59e0b" />
            </g>
          </svg>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-zinc-500 font-bold">MARCHA:</span>
            <div className="px-3 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-black text-amber-400 text-sm shadow">
              {gear.label}
            </div>
            <span className="text-[10px] text-zinc-400 font-bold tabular-nums">
              {Math.round(clampedRpm)} <span className="text-[8px] text-zinc-500">RPM</span>
            </span>
          </div>
        </div>

        {/* 3. COLUNA DIREITA: MANÔMETRO DE TURBO 52MM [UPG] + ÁGUA + TANQUE 55L */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="relative flex flex-col items-center">
            <svg viewBox={`0 0 ${boostSize} ${boostSize}`} className="w-[144px] sm:w-[156px] h-auto max-w-full">
              <circle cx={boostCenter} cy={boostCenter} r={boostRadius + 14} fill="#1c1f26" stroke="#373c49" strokeWidth="3" />
              <circle cx={boostCenter} cy={boostCenter} r={boostRadius + 9} fill="#0d0f14" stroke="#171920" strokeWidth="1.5" />

              {[-1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((b, i) => {
                const angle = mapRange(b, -1.0, 3.0, boostStartAngle, boostEndAngle)
                const rad = (angle * Math.PI) / 180
                const cos = Math.cos(rad)
                const sin = Math.sin(rad)
                const r1 = boostRadius
                const r2 = boostRadius - 8
                const textR = boostRadius - 16
                const isZero = b === 0
                const isOver = b > 1.5

                return (
                  <g key={i}>
                    <line
                      x1={boostCenter + r1 * cos}
                      y1={boostCenter + r1 * sin}
                      x2={boostCenter + r2 * cos}
                      y2={boostCenter + r2 * sin}
                      stroke={isOver ? '#ef4444' : isZero ? '#10b981' : '#cbd5e1'}
                      strokeWidth={isZero ? '2.5' : '1.5'}
                    />
                    <text
                      x={boostCenter + textR * cos}
                      y={boostCenter + textR * sin + 3}
                      textAnchor="middle"
                      fill={isOver ? '#ef4444' : isZero ? '#10b981' : '#94a3b8'}
                      fontSize="8"
                      fontWeight="bold"
                    >
                      {b > 0 ? `+${b}` : b}
                    </text>
                  </g>
                )
              })}

              <text x={boostCenter} y={boostCenter - 16} textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold">
                TURBO
              </text>
              <text x={boostCenter} y={boostCenter + 22} textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="bold">
                BAR
              </text>

              <g transform={`rotate(${boostAngle}, ${boostCenter}, ${boostCenter})`}>
                <line
                  x1={boostCenter}
                  y1={boostCenter}
                  x2={boostCenter + boostRadius - 2}
                  y2={boostCenter}
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx={boostCenter} cy={boostCenter} r="7" fill="#18181b" stroke="#71717a" strokeWidth="1" />
                <circle cx={boostCenter} cy={boostCenter} r="2.5" fill="#ef4444" />
              </g>
            </svg>
            <div className="flex items-center gap-1.5 text-[9.5px] font-black tabular-nums">
              <span className={boostPressureBar > 0 ? 'text-amber-400' : 'text-sky-400'}>
                {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR
              </span>
              {peakBoostBar > 0.05 && (
                <span className="text-zinc-500 text-[8.5px]">PK +{peakBoostBar.toFixed(2)}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-950 border border-zinc-800 shadow">
            <div className="flex flex-col items-center">
              <div className="w-12 h-10 relative flex items-center justify-center">
                <svg width="48" height="40" viewBox="0 0 48 40">
                  <path d="M 6 32 A 18 18 0 0 1 42 32" fill="none" stroke="#3f3f46" strokeWidth="3" />
                  <g transform={`rotate(${tempAngle}, 24, 32)`}>
                    <line x1="24" y1="32" x2="24" y2="12" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="24" cy="32" r="4" fill="#18181b" />
                  </g>
                </svg>
              </div>
              <span className="text-[7.5px] text-zinc-400 font-bold">ÁGUA {Math.round(auxGauges.coolantTemp)}°C</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-12 h-10 relative flex items-center justify-center">
                <svg width="48" height="40" viewBox="0 0 48 40">
                  <path d="M 6 32 A 18 18 0 0 1 42 32" fill="none" stroke="#3f3f46" strokeWidth="3" />
                  <g transform={`rotate(${fuelAngle}, 24, 32)`}>
                    <line x1="24" y1="32" x2="24" y2="12" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="24" cy="32" r="4" fill="#18181b" />
                  </g>
                </svg>
              </div>
              <span className="text-[7.5px] text-zinc-400 font-bold">⛽ {Math.round(fuelPercent)}% (55L)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Luzes-Espia Retrô na Base (sem ABS, com setas e farol) */}
      <div className="relative z-10 w-full flex items-center justify-between px-3 mt-1.5 pt-1 border-t border-zinc-800/80">
        <span className={`text-xs font-black ${leftIndicatorLit ? 'text-emerald-400' : 'text-zinc-800'}`}>◀</span>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className={`text-[9.5px] font-black ${warningLights.oil ? 'text-red-500 animate-pulse' : 'text-zinc-800'}`}>
            ÓLEO
          </div>
          <div className={`text-[9.5px] font-black ${warningLights.battery ? 'text-red-500' : 'text-zinc-800'}`}>
            BATERIA
          </div>
          <div className={`text-[9.5px] font-black ${warningLights.brake ? 'text-red-500' : 'text-zinc-800'}`}>
            (P) FREIO
          </div>
          <div className={`text-[9.5px] font-black ${warningLights.checkEngine ? 'text-amber-500' : 'text-zinc-800'}`}>
            INJ.
          </div>
          <div className={`text-[9.5px] font-black ${warningLights.temp ? 'text-red-500 animate-pulse' : 'text-zinc-800'}`}>
            TEMP
          </div>
          {headlightsMode !== 'off' && (
            <div className={`text-[9px] font-black ${headlightsMode === 'high' ? 'text-sky-400' : 'text-emerald-400'}`}>
              ≡D
            </div>
          )}
        </div>

        <span className={`text-xs font-black ${rightIndicatorLit ? 'text-emerald-400' : 'text-zinc-800'}`}>▶</span>
      </div>
    </div>
  )
})
