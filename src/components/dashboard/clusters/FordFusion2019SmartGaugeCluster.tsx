import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp, mapRange } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useGarageStore } from '@/stores/useGarageStore'
import { ClusterIndicatorIcon } from '@/components/gauges'
import { formatZeroToHundredSeconds } from '@/systems/vehicle'

export interface FordFusion2019SmartGaugeClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * FordFusion2019SmartGaugeCluster — Painel Duplo Digital "SmartGauge with EcoGuide"
 * exclusivo do Ford Fusion Titanium 2.0 EcoBoost AWD 2019 (CD391).
 *
 * Arquitetura autêntica Ford Titanium 2019:
 * - Velocímetro central 0–260 km/h com aro cromado, ponteiro branco translúcido e seletor rotativo e-Shifter (P R N D S)
 * - Tela TFT Esquerda de 4,2": Conta-giros digital (0–7 x1000 RPM), pressão EcoBoost (BAR), Temperatura e Tanque de 68 L
 * - Tela TFT Direita de 4,2": Monitor gráfico em tempo real do sistema **Intelligent AWD** sob demanda
 *   (exibindo a repartição dinâmica de torque entre eixo dianteiro e eixo traseiro sem modos 4WD Lock/Low)
 */
export const FordFusion2019SmartGaugeCluster = memo(function FordFusion2019SmartGaugeCluster({
  telemetry,
}: FordFusion2019SmartGaugeClusterProps) {
  const { tachometer, speedometer, warningLights, auxGauges } = telemetry

  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const gearSelectorPosition = useSimulationStore((s) => s.gearSelectorPosition)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const throttle = useSimulationStore((s) => s.throttle)
  const awdRearCoupling = useSimulationStore((s) => s._physics?.getStateSnapshot().awdRearCoupling ?? 0.08)
  const last0to100 = useSimulationStore((s) => s.last0to100)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const fogLightsLit = useSimulationStore((s) => s.fogLightsLit)
  const ignitionPosition = useSimulationStore((s) => s.ignitionPosition)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const mileageKm = useGarageStore((s) => s.getActiveCar()?.mileageKm ?? 0)

  const maxRpm = 7000
  const redlineStart = 6200
  const maxSpeed = 260

  const rpm = clamp(Number.isFinite(tachometer.rpm) ? tachometer.rpm : 0, 0, maxRpm)
  const speed = clamp(Number.isFinite(speedometer.speed) ? speedometer.speed : 0, 0, maxSpeed)
  const coolantTemp = Math.round(clamp(auxGauges.coolantTemp || 90, 50, 130))
  const fuelPercent = Math.round(clamp(auxGauges.fuelLevel ?? 82, 0, 100))

  const startAngle = -220
  const endAngle = 40
  const speedAngle = mapRange(speed, 0, maxSpeed, startAngle, endAngle)

  const speedMarks = useMemo(() => {
    const arr: { angle: number; label: string; major: boolean }[] = []
    for (let s = 0; s <= maxSpeed; s += 20) {
      const major = s % 40 === 0
      arr.push({
        angle: mapRange(s, 0, maxSpeed, startAngle, endAngle),
        label: major ? String(s) : '',
        major,
      })
    }
    return arr
  }, [])

  // Repartição real do Intelligent AWD sob demanda (VehiclePhysics: rearShare = clamp(awdRearCoupling * 0.50, 0.04, 0.44))
  const rearSharePct = isRunning && currentGear > 0 && throttle > 0.02
    ? Math.round(clamp(awdRearCoupling * 50, 4, 44))
    : 0
  const frontSharePct = isRunning && currentGear > 0 && throttle > 0.02
    ? 100 - rearSharePct
    : 0

  const activeGearBadge =
    gearSelectorPosition === 'P' || currentGear === -2
      ? 'P'
      : gearSelectorPosition === 'R' || currentGear === -1
        ? 'R'
        : gearSelectorPosition === 'N' || currentGear === 0
          ? 'N'
          : transmissionMode === 'manual'
            ? `S${currentGear > 0 ? currentGear : 1}`
            : `${gearSelectorPosition === 'S' ? 'S' : 'D'}${currentGear > 0 ? currentGear : 1}`

  return (
    <div
      className="relative flex w-full max-w-5xl flex-col items-center overflow-hidden rounded-2xl border-2 border-sky-400/40 bg-gradient-to-b from-[#0e1522] via-[#080d16] to-[#04070c] px-2.5 py-2 font-mono text-white shadow-[0_0_30px_rgba(56,189,248,0.2)] select-none"
      data-testid="cluster-ford-fusion-2019-smartgauge"
    >
      {/* Barra superior Titanium AWD */}
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
          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-black tracking-wider text-sky-300">
            TITANIUM AWD
          </span>
          <span className="hidden text-zinc-400 sm:inline">· SMARTGAUGE DUAL TFT</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="rounded border border-sky-500/35 bg-sky-500/10 px-1.5 py-0.5 text-[7.5px] font-black text-sky-200 uppercase">
            {drivingMode}
          </span>
          {headlightsMode !== 'off' && (
            <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[7.5px] font-bold text-emerald-300">
              {headlightsMode === 'high' ? 'LED ALTO' : 'LED'}
            </span>
          )}
          {fogLightsLit && (
            <span className="rounded border border-amber-400/50 bg-amber-500/20 px-1.5 py-0.5 text-[7.5px] font-bold text-amber-200">
              NEBLINA
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

      {/* Layout SmartGauge: TFT 4,2" Esquerda | Velocímetro Central 260 km/h | TFT 4,2" Direita (Intelligent AWD) */}
      <div className="grid w-full grid-cols-[1fr_1.15fr_1fr] items-center gap-2">
        {/* 1. TELA TFT ESQUERDA 4,2": CONTA-GIROS DIGITAL + ECOBOOST + TANQUE 68L */}
        <div className="flex h-full flex-col justify-between rounded-xl border border-sky-400/30 bg-[#07111e] p-2 shadow-inner">
          <div className="flex items-center justify-between border-b border-sky-500/20 pb-1 text-[8px]">
            <span className="font-black text-sky-300">RPM x1000</span>
            <span className={rpm >= redlineStart ? 'font-black text-red-400' : 'font-black text-white'}>
              {Math.round(rpm)} RPM
            </span>
          </div>

          {/* Barra segmentada vertical/horizontal de RPM */}
          <div className="my-1.5 space-y-1">
            <div className="flex h-6 items-end gap-0.5 rounded bg-black/50 p-1">
              {Array.from({ length: 20 }).map((_, idx) => {
                const segRpm = ((idx + 1) / 20) * maxRpm
                const active = rpm >= segRpm - 180
                const isRed = segRpm >= redlineStart
                return (
                  <div
                    key={idx}
                    className="flex-1 rounded-xs transition-all duration-75"
                    style={{
                      height: `${35 + (idx / 20) * 65}%`,
                      backgroundColor: active ? (isRed ? '#ef4444' : '#38bdf8') : '#1e293b',
                    }}
                  />
                )
              })}
            </div>
            <div className="flex justify-between text-[7px] font-bold text-slate-400">
              <span>0</span>
              <span>2</span>
              <span>4</span>
              <span className="text-red-400">6.2</span>
              <span className="text-red-400">7</span>
            </div>
          </div>

          {/* Pressão EcoBoost GTDI */}
          <div>
            <div className="flex justify-between text-[7.5px] font-bold">
              <span className="text-sky-300">2.0 ECOBOOST</span>
              <span className="text-white tabular-nums">
                {boostPressureBar >= 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} bar
              </span>
            </div>
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-cyan-300"
                style={{ width: `${clamp(((boostPressureBar + 0.8) / 2.3) * 100, 4, 100)}%` }}
              />
            </div>
          </div>

          {/* Barras inferiores de Temperatura e Combustível (68 L) */}
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 border-t border-white/10 pt-1 text-[7.5px]">
            <div>
              <span className="block text-slate-400">🌡 {coolantTemp}°C</span>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-900">
                <div
                  className="h-full bg-sky-400"
                  style={{ width: `${clamp(((coolantTemp - 50) / 80) * 100, 6, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <span className="block text-slate-400">⛽ {fuelPercent}% (68L)</span>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-900">
                <div
                  className={`h-full ${fuelPercent <= 15 ? 'bg-red-500' : 'bg-cyan-400'}`}
                  style={{ width: `${clamp(fuelPercent, 4, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. ANEL CENTRAL CROMADO 0–260 KM/H + E-SHIFTER ROTATIVO */}
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 225 202" className="w-full max-w-[238px]">
            <circle cx="112" cy="102" r="93" fill="#060c16" stroke="#e2e8f0" strokeWidth="4" />
            <circle cx="112" cy="102" r="87" fill="none" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="2" />
            {speedMarks.map((m, idx) => {
              const rad = (m.angle * Math.PI) / 180
              const x1 = 112 + (84 - (m.major ? 12 : 6)) * Math.cos(rad)
              const y1 = 102 + (84 - (m.major ? 12 : 6)) * Math.sin(rad)
              const x2 = 112 + 84 * Math.cos(rad)
              const y2 = 102 + 84 * Math.sin(rad)
              const tx = 112 + 63 * Math.cos(rad)
              const ty = 102 + 63 * Math.sin(rad)
              return (
                <g key={idx}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#bae6fd"
                    strokeWidth={m.major ? 2.2 : 1.1}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      fill="#f1f5f9"
                      fontSize="10"
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

            <text x="112" y="75" fill="#7dd3fc" fontSize="8.5" fontWeight="700" textAnchor="middle">
              KM/H
            </text>
            <text x="112" y="136" fill="#ffffff" fontSize="22" fontWeight="900" textAnchor="middle">
              {Math.round(speed)}
            </text>
            <text x="112" y="156" fill="#38bdf8" fontSize="11" fontWeight="900" textAnchor="middle">
              e-SHIFTER {activeGearBadge}
            </text>

            <g transform={`rotate(${speedAngle} 112 102)`}>
              <line x1="94" y1="102" x2="186" y2="102" stroke="#f8fafc" strokeWidth="3.4" strokeLinecap="round" />
            </g>
            <circle cx="112" cy="102" r="10" fill="#e2e8f0" stroke="#334155" strokeWidth="2" />
          </svg>

          <div className="-mt-1 flex items-center justify-center gap-2">
            <ClusterIndicatorIcon kind="battery" active={!isRunning && ignitionPosition !== 'OFF'} />
            <ClusterIndicatorIcon kind="oil" active={Boolean(warningLights.oil)} />
            <ClusterIndicatorIcon kind="checkEngine" active={Boolean(warningLights.checkEngine)} />
            <ClusterIndicatorIcon kind="tcs" active={Boolean(warningLights.tcs)} flashing={Boolean(warningLights.tcsFlash)} />
            <ClusterIndicatorIcon kind="brake" active={Boolean(warningLights.brake)} />
          </div>
        </div>

        {/* 3. TELA TFT DIREITA 4,2": MONITOR INTELLIGENT AWD SOB DEMANDA */}
        <div className="flex h-full flex-col justify-between rounded-xl border border-sky-400/30 bg-[#07111e] p-2 shadow-inner">
          <div className="flex items-center justify-between border-b border-sky-500/20 pb-1 text-[8px]">
            <span className="font-black text-sky-300">INTELLIGENT AWD</span>
            <span className="text-[7px] text-cyan-200">AUTO ON-DEMAND</span>
          </div>

          {/* Gráfico das 4 rodas com barras de torque por eixo */}
          <div className="my-1 flex flex-col gap-1.5 rounded-lg border border-white/10 bg-black/45 p-1.5 text-[7.5px]">
            <div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-300">EIXO DIANTEIRO</span>
                <span className="text-sky-300 tabular-nums">{frontSharePct}%</span>
              </div>
              <div className="mt-0.5 grid grid-cols-2 gap-1.5">
                <div className="h-2 overflow-hidden rounded bg-slate-900">
                  <div className="h-full bg-sky-400 transition-all duration-100" style={{ width: `${frontSharePct}%` }} />
                </div>
                <div className="h-2 overflow-hidden rounded bg-slate-900">
                  <div className="h-full bg-sky-400 transition-all duration-100" style={{ width: `${frontSharePct}%` }} />
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-300">EIXO TRASEIRO (RDM)</span>
                <span className="text-cyan-300 tabular-nums">{rearSharePct}%</span>
              </div>
              <div className="mt-0.5 grid grid-cols-2 gap-1.5">
                <div className="h-2 overflow-hidden rounded bg-slate-900">
                  <div className="h-full bg-cyan-300 transition-all duration-100" style={{ width: `${Math.min(100, rearSharePct * 2)}%` }} />
                </div>
                <div className="h-2 overflow-hidden rounded bg-slate-900">
                  <div className="h-full bg-cyan-300 transition-all duration-100" style={{ width: `${Math.min(100, rearSharePct * 2)}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-1 text-[7.5px] text-slate-300">
            <span>
              {last0to100 !== null ? `0-100 ${formatZeroToHundredSeconds(last0to100)}s` : `IGN ${ignitionPosition}`}
            </span>
            <span className="font-bold tabular-nums">{Math.round(mileageKm).toLocaleString()} km</span>
          </div>
        </div>
      </div>
    </div>
  )
})
