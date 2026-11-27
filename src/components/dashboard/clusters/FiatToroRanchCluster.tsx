import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp } from '@/utils/math'
import { ClusterIndicatorIcon } from '@/components/gauges'

export interface FiatToroRanchClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * FiatToroRanchCluster — Quadro de Instrumentos Digital TFT de 7" Off-Road Diesel
 * exclusivo da Fiat Toro Ranch 2.2 Turbodiesel 4x4 AT9 (2025).
 *
 * Layout próprio da Ranch (distinto do layout urbano da Toro Endurance T270):
 * - Mostrador circular de torque/rotação Diesel MultiJet II 0–6.000 RPM (redline 4.500 RPM)
 * - Centro Off-Road com velocímetro robusto, caixa ZF 9HP AT9 e diagrama vivo de repartição dos eixos 4x4
 * - Painel direito dedicado a Diesel S10 (60 L), autonomia real, temperaturas (água + óleo) e status da reduzida
 */
export const FiatToroRanchCluster = memo(function FiatToroRanchCluster({
  telemetry,
}: FiatToroRanchClusterProps) {
  const { tachometer, speedometer, gear, warningLights, auxGauges, shiftLight, abs } = telemetry

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const fourWheelDriveMode = useSimulationStore((s) => s.fourWheelDriveMode)
  const frontTorqueSplitPercent = useSimulationStore((s) => s.frontTorqueSplitPercent)
  const rearTorqueSplitPercent = useSimulationStore((s) => s.rearTorqueSplitPercent)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const oilTemp = useSimulationStore((s) => s.oilTemp)
  const odometerKm = useSimulationStore((s) => s.odometerKm)
  const estimatedRangeKm = useSimulationStore((s) => s.estimatedRangeKm)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const fogLightsLit = useSimulationStore((s) => s.fogLightsLit)

  const coolantSegments = Math.round(clamp((auxGauges.coolantTemp - 50) / 80, 0, 1) * 8)

  const maxRpm = tachometer.maxRpm || 6000
  const redlineRpm = tachometer.redlineStart || 4500
  const rpm = clamp(Number.isFinite(tachometer.rpm) ? tachometer.rpm : 0, 0, maxRpm)
  const speed = Math.round(Number.isFinite(speedometer.speed) ? speedometer.speed : 0)
  const isRedline = rpm >= redlineRpm

  const cx = 128
  const cy = 122
  const radius = 84
  const startDeg = 140
  const totalSweepDeg = 260
  const totalArcLen = (totalSweepDeg / 360) * 2 * Math.PI * radius

  const currentRatio = clamp(rpm / maxRpm, 0, 1)
  const activeArcLen = currentRatio * totalArcLen
  const currentAngleDeg = startDeg + currentRatio * totalSweepDeg

  const degToRad = (d: number) => (d * Math.PI) / 180
  const polar = (r: number, angleDeg: number) => ({
    x: cx + r * Math.cos(degToRad(angleDeg)),
    y: cy + r * Math.sin(degToRad(angleDeg)),
  })

  const arcStart = polar(radius, startDeg)
  const arcEnd = polar(radius, startDeg + totalSweepDeg)
  const baseArcPath = `M ${arcStart.x.toFixed(1)} ${arcStart.y.toFixed(1)} A ${radius} ${radius} 0 1 1 ${arcEnd.x.toFixed(1)} ${arcEnd.y.toFixed(1)}`

  const redlineRatio = redlineRpm / maxRpm
  const redlineAngleDeg = startDeg + redlineRatio * totalSweepDeg
  const redlineStartPt = polar(radius, redlineAngleDeg)
  const redlineArcPath = `M ${redlineStartPt.x.toFixed(1)} ${redlineStartPt.y.toFixed(1)} A ${radius} ${radius} 0 0 1 ${arcEnd.x.toFixed(1)} ${arcEnd.y.toFixed(1)}`

  const needleInner = polar(radius - 12, currentAngleDeg)
  const needleOuter = polar(radius + 7, currentAngleDeg)

  const boostRatio = clamp((boostPressureBar || 0) / 2.0, 0, 1)

  const gearDisplay =
    gear.isPark
      ? 'P'
      : gear.isReverse
        ? 'R'
        : gear.isNeutral
          ? 'N'
          : gear.gearSelectorPosition === 'M' || gear.transmissionMode === 'manual_simulated'
            ? gear.label
            : gear.gearSelectorPosition === 'S'
              ? `S${gear.label.replace(/\D/g, '') || '1'}`
              : `D${gear.label.replace(/\D/g, '') || '1'}`

  return (
    <div
      data-testid="cluster-fiat-toro-ranch"
      className="relative flex flex-col w-full max-w-[760px] min-h-[268px] bg-gradient-to-b from-[#0d0905] via-[#120c06] to-[#080603] border-2 border-amber-800/65 rounded-3xl px-3 py-2 select-none overflow-hidden font-sans shadow-2xl text-zinc-100"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(217,119,6,0.09)_0%,_transparent_75%)] pointer-events-none" />

      {/* Barra Superior Off-Road Ranch: Setas + Identidade + Luzes-Espia */}
      <div className="relative z-10 flex w-full items-center justify-between border-b border-amber-900/45 pb-1 mb-1 px-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-5 w-6 items-center justify-center rounded border text-[10px] font-mono font-black ${
              leftIndicatorLit
                ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.9)]'
                : 'border-amber-950 bg-black/60 text-zinc-600'
            }`}
          >
            ◀
          </span>
          <span className="text-amber-400 font-black text-xs tracking-wider flex items-center gap-1">
            <span>🐂</span>
            <span>RANCH 4×4</span>
          </span>
          <span className="text-[8px] font-mono text-amber-500/80 font-bold tracking-wider">
            2.2 MULTIJET II · AT9
          </span>
          <span
            className={`px-1.5 py-0.5 rounded font-mono text-[7.5px] font-black uppercase border ${
              drivingMode === 'sport'
                ? 'bg-red-600/25 border-red-500/60 text-red-300'
                : drivingMode === 'eco'
                  ? 'bg-emerald-600/25 border-emerald-500/60 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-800/70 text-amber-200'
            }`}
          >
            {drivingMode}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {headlightsMode !== 'off' && (
            <span className="px-1 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 font-mono text-[7.5px] font-bold text-emerald-300">
              {headlightsMode === 'high' ? '≡D ALTO' : '≡D'}
            </span>
          )}
          {fogLightsLit && (
            <span className="px-1 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 font-mono text-[7.5px] font-bold text-amber-200">
              NEBL
            </span>
          )}
          <ClusterIndicatorIcon kind="checkEngine" active={warningLights.checkEngine} sizeClass="w-3.5 h-3.5" />
          <ClusterIndicatorIcon kind="oil" active={warningLights.oil} sizeClass="w-3.5 h-3.5" />
          <ClusterIndicatorIcon kind="battery" active={warningLights.battery} sizeClass="w-3.5 h-3.5" />
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
          <span
            className={`inline-flex h-5 w-6 items-center justify-center rounded border text-[10px] font-mono font-black ${
              rightIndicatorLit
                ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.9)]'
                : 'border-amber-950 bg-black/60 text-zinc-600'
            }`}
          >
            ▶
          </span>
        </div>
      </div>

      {/* Corpo 3 Colunas Off-Road: Anel Diesel (0-6k) | Centro Velocidade + Diagrama 4x4 | Coluna Diesel S10 + Térmica */}
      <div className="relative z-10 grid flex-1 grid-cols-[248px_1fr_196px] items-center gap-2">
        {/* 1. Tacômetro Turbodiesel MultiJet II (0-6000 RPM) */}
        <div className="relative h-[224px] flex items-center justify-center">
          <svg viewBox="0 0 256 236" className="w-full h-full overflow-hidden">
            <circle cx={cx} cy={cy} r={radius + 14} fill="#090603" stroke="#451a03" strokeWidth="2.5" />
            <circle cx={cx} cy={cy} r={radius + 6} fill="none" stroke="#78350f" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={cx} cy={cy} r={radius - 28} fill="#140c04" stroke="#291305" strokeWidth="1.5" />

            <path d={baseArcPath} fill="none" stroke="#1c1208" strokeWidth="9" strokeLinecap="round" />
            <path d={redlineArcPath} fill="none" stroke="#ef4444" strokeWidth="9" strokeLinecap="round" opacity="0.4" />

            {activeArcLen > 0.5 && (
              <path
                d={baseArcPath}
                fill="none"
                stroke={isRedline ? '#ef4444' : '#f59e0b'}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${activeArcLen.toFixed(1)} ${totalArcLen.toFixed(1)}`}
              />
            )}

            <line
              x1={needleInner.x.toFixed(1)}
              y1={needleInner.y.toFixed(1)}
              x2={needleOuter.x.toFixed(1)}
              y2={needleOuter.y.toFixed(1)}
              stroke={isRedline ? '#fca5a5' : '#fef3c7'}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle
              cx={needleOuter.x.toFixed(1)}
              cy={needleOuter.y.toFixed(1)}
              r="2.5"
              fill={isRedline ? '#ef4444' : '#fbbf24'}
            />

            {[0, 1, 2, 3, 4, 5, 6].map((n) => {
              const val = n * 1000
              const ang = startDeg + (val / maxRpm) * totalSweepDeg
              const p = polar(radius - 19, ang)
              const isRedZone = val >= redlineRpm
              return (
                <text
                  key={n}
                  x={p.x.toFixed(1)}
                  y={(p.y + 4).toFixed(1)}
                  textAnchor="middle"
                  fill={isRedZone ? '#ef4444' : '#fbbf24'}
                  fontSize="11"
                  fontWeight="900"
                  fontFamily="ui-monospace, monospace"
                >
                  {n}
                </text>
              )
            })}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pt-1 pointer-events-none">
            <span className="text-[8.5px] font-mono font-bold text-amber-500/80">RPM DIESEL</span>
            <span className="text-2xl font-mono font-black text-amber-100 tabular-nums">
              {Math.round(rpm)}
            </span>
            <span className="text-[7px] font-mono font-bold text-amber-500 mt-0.5">
              TURBO {boostPressureBar >= 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} bar
            </span>
            <div className="mt-1 w-20 h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-amber-900/50">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-300"
                style={{ width: `${boostRatio * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. Centro: Velocímetro Digital + Caixa ZF 9HP + Diagrama Off-Road 4x4 Vivo */}
        <div className="flex h-full flex-col items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black font-mono text-white tracking-tighter tabular-nums">
                {speed}
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">km/h</span>
            </div>

            <div className="flex flex-col items-center px-2.5 py-1 rounded-xl bg-zinc-950 border border-amber-800/60">
              <span className="text-[7.5px] font-mono text-amber-500 font-bold">ZF 9HP</span>
              <span className="text-lg font-mono font-black text-amber-300 leading-none">{gearDisplay}</span>
            </div>

            {shiftLight.isActive && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black font-mono text-[8px] font-black animate-pulse">
                SHIFT
              </span>
            )}
          </div>

          {/* Diagrama Exclusivo Off-Road de Repartição dos Eixos 4x4 */}
          <div className="w-full rounded-2xl border border-amber-800/50 bg-zinc-950/85 p-2 font-mono">
            <div className="flex items-center justify-between text-[8px] mb-1">
              <span className="font-black text-amber-400">TRAÇÃO 4×4 TORQUE SPLIT</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                  fourWheelDriveMode === '4wd_low'
                    ? 'bg-red-600 text-white'
                    : fourWheelDriveMode === '4wd'
                      ? 'bg-amber-500 text-black'
                      : 'bg-zinc-800 text-amber-200'
                }`}
              >
                {fourWheelDriveMode === '4wd_low'
                  ? '4WD LOW · REDUZIDA'
                  : fourWheelDriveMode === '4wd'
                    ? '4WD LOCK · 50/50'
                    : '4WD AUTO'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[7.5px]">
              <div>
                <div className="flex justify-between text-zinc-300">
                  <span>DIANTEIRO</span>
                  <b className="text-amber-300 tabular-nums">{frontTorqueSplitPercent}%</b>
                </div>
                <div className="mt-0.5 h-2 rounded bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-100"
                    style={{ width: `${frontTorqueSplitPercent}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-zinc-300">
                  <span>TRASEIRO</span>
                  <b className="text-orange-300 tabular-nums">{rearTorqueSplitPercent}%</b>
                </div>
                <div className="mt-0.5 h-2 rounded bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full bg-orange-500 transition-all duration-100"
                    style={{ width: `${rearTorqueSplitPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé Odômetro e Autonomia Real */}
          <div className="w-full flex items-center justify-between text-[8.5px] font-mono text-zinc-300 border-t border-amber-900/40 pt-1 px-1">
            <span>
              ODO <b className="text-white tabular-nums">{Math.round(odometerKm).toLocaleString('pt-BR')} km</b>
            </span>
            <span>
              AUTON. <b className="text-amber-300 tabular-nums">{estimatedRangeKm} km</b>
            </span>
          </div>
        </div>

        {/* 3. Coluna Direita: Diesel S10 (60L) + Arrefecimento + Óleo */}
        <div className="h-[220px] flex flex-col justify-between bg-zinc-950/75 border border-amber-900/50 rounded-2xl p-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-amber-400 font-bold">⛽ DIESEL S10</span>
              <span className={`font-black tabular-nums ${auxGauges.fuelPercent <= 15 ? 'text-red-500 animate-pulse' : 'text-zinc-100'}`}>
                {Math.round(auxGauges.fuelPercent)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-zinc-950 rounded-md p-0.5 border border-amber-900/40 flex gap-0.5">
              {[...Array(10)].map((_, i) => {
                const active = auxGauges.fuelPercent >= i * 10 + 5
                return (
                  <div
                    key={i}
                    className={`flex-1 h-full rounded-xs ${
                      active ? (i < 2 ? 'bg-red-500' : 'bg-amber-500') : 'bg-zinc-900'
                    }`}
                  />
                )
              })}
            </div>
            <div className="flex justify-between text-[7.5px] font-mono text-zinc-500">
              <span>R</span>
              <span>{auxGauges.fuelLevel.toFixed(1)} / 60 L</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-amber-400 font-bold">🌡️ ÁGUA</span>
              <span className="text-zinc-100 font-black tabular-nums">{Math.round(auxGauges.coolantTemp)}°C</span>
            </div>
            <div className="w-full h-2 bg-zinc-950 rounded-md p-0.5 border border-amber-900/40 flex gap-0.5">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-xs ${
                    i < coolantSegments ? (i >= 6 ? 'bg-red-500' : 'bg-amber-400') : 'bg-zinc-900'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-black/70 border border-amber-900/40 px-2 py-1.5 flex items-center justify-between text-[8px] font-mono">
            <span className="text-zinc-400">ÓLEO MOTOR</span>
            <strong className="text-amber-200 tabular-nums">{Math.round(oilTemp)}°C</strong>
          </div>
        </div>
      </div>
    </div>
  )
})
