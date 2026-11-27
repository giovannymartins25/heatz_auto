import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp } from '@/utils/math'
import { ClusterIndicatorIcon } from '@/components/gauges'

export interface FiatToroEnduranceClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * FiatToroEnduranceCluster — Quadro Digital TFT de 7" Urbano da Fiat Toro Endurance 1.3 T270 Flex AT6 (2025).
 *
 * Arquitetura visual própria Fiat T270 Urbana (claramente distinta do painel Off-Road Diesel da Toro Ranch):
 * - Barra horizontal superior progressiva de RPM (0 a 7.000 RPM, redline 6.200 RPM) estilo modo urbano Fiat 7"
 * - Coluna esquerda: Nível de combustível Flex (55 L) em barra vertical segmentada + autonomia real
 * - Centro amplo: Velocímetro digital gigante + seletor Aisin AT6 (P / R / N / D1..D6 / M1..M6)
 * - Coluna direita: Pressão do Turbo GSE T270 + Computador de Bordo real (Consumo e Temperatura) — zero itens 4x4
 */
export const FiatToroEnduranceCluster = memo(function FiatToroEnduranceCluster({
  telemetry,
}: FiatToroEnduranceClusterProps) {
  const { tachometer, speedometer, gear, warningLights, auxGauges, shiftLight, abs } = telemetry

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const fuelType = useSimulationStore((s) => s.fuelType)
  const odometerKm = useSimulationStore((s) => s.odometerKm)
  const estimatedRangeKm = useSimulationStore((s) => s.estimatedRangeKm)
  const avgConsumptionKmL = useSimulationStore((s) => s.avgConsumptionKmL)
  const hasMeasuredAvgConsumption = useSimulationStore((s) => s.hasMeasuredAvgConsumption)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)

  const maxRpm = tachometer.maxRpm || 7000
  const redlineRpm = tachometer.redlineStart || 6200
  const rpm = clamp(Number.isFinite(tachometer.rpm) ? tachometer.rpm : 0, 0, maxRpm)
  const rpmPercent = clamp((rpm / maxRpm) * 100, 0, 100)
  const speed = Math.round(Number.isFinite(speedometer.speed) ? speedometer.speed : 0)
  const isRedline = rpm >= redlineRpm
  const boostRatio = clamp((boostPressureBar || 0) / 1.5, 0, 1)

  const gearDisplay =
    gear.isPark
      ? 'P'
      : gear.isReverse
        ? 'R'
        : gear.isNeutral
          ? 'N'
          : gear.gearSelectorPosition === 'M' || gear.transmissionMode === 'manual_simulated'
            ? gear.label
            : `D${gear.label.replace(/\D/g, '') || '1'}`

  const fuelPercent = clamp(auxGauges.fuelPercent, 0, 100)
  const coolantRatio = clamp((auxGauges.coolantTemp - 50) / 80, 0, 1)

  return (
    <div
      data-testid="cluster-fiat-toro-endurance"
      className="relative flex flex-col justify-between w-full max-w-[750px] min-h-[264px] bg-gradient-to-b from-[#090a0f] via-[#0d1017] to-[#06070b] border-2 border-zinc-800 rounded-3xl px-3.5 py-2.5 select-none overflow-hidden font-sans shadow-2xl text-zinc-100"
    >
      <div className="absolute inset-x-16 top-0 h-1 bg-gradient-to-r from-transparent via-red-600/80 to-transparent" />

      {/* 1. Cabeçalho Fiat + Setas + Luzes-Espia */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-1.5">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-5 w-6 items-center justify-center rounded border font-mono text-[10px] font-black ${
              leftIndicatorLit
                ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.9)]'
                : 'border-white/10 bg-zinc-900 text-zinc-600'
            }`}
          >
            ◀
          </span>
          <span className="text-red-500 font-black text-xs tracking-widest">FIAT</span>
          <span className="text-[8.5px] font-mono text-zinc-400 font-bold tracking-wider">
            TORO ENDURANCE · T270 FLEX AT6
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {headlightsMode !== 'off' && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 font-mono text-[7.5px] font-bold text-emerald-300">
              {headlightsMode === 'high' ? '≡D ALTO' : '≡D'}
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
            className={`inline-flex h-5 w-6 items-center justify-center rounded border font-mono text-[10px] font-black ${
              rightIndicatorLit
                ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.9)]'
                : 'border-white/10 bg-zinc-900 text-zinc-600'
            }`}
          >
            ▶
          </span>
        </div>
      </div>

      {/* 2. Tacômetro Horizontal Panorâmico Fiat 7" (0 a 7.000 RPM) */}
      <div className="w-full rounded-2xl border border-white/10 bg-black/55 px-3 py-1.5 my-1">
        <div className="flex items-center justify-between text-[9px] font-mono font-bold text-zinc-400 mb-1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
            <span key={k} className={k >= 6 ? 'text-red-500 font-black' : 'text-zinc-300'}>
              {k}
            </span>
          ))}
        </div>
        <div className="relative h-3.5 w-full rounded-full bg-zinc-900 border border-white/10 overflow-hidden">
          {/* Demarcação de Redline em 6.200 RPM (88.5%) */}
          <div className="absolute right-0 inset-y-0 w-[11.5%] bg-red-950/70 border-l border-red-500/60" />
          <div
            className={`h-full transition-all duration-75 ${
              isRedline
                ? 'bg-gradient-to-r from-red-600 via-red-500 to-amber-300'
                : 'bg-gradient-to-r from-zinc-200 via-red-500 to-red-600'
            }`}
            style={{ width: `${rpmPercent}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[8px] font-mono text-zinc-400">
          <span>RPM × 1000</span>
          <strong className={isRedline ? 'text-red-400 font-black' : 'text-white'}>
            {Math.round(rpm)} RPM
          </strong>
        </div>
      </div>

      {/* 3. Corpo Urbano 3 Colunas: Combustível Flex (55L) | Velocímetro + AT6 | Turbo T270 + Computador */}
      <div className="grid grid-cols-[175px_1fr_195px] items-center gap-2.5 flex-1">
        {/* Esquerda: Tanque Flex 55 L + Autonomia */}
        <div className="h-full rounded-2xl border border-white/10 bg-zinc-900/55 p-2.5 flex flex-col justify-between font-mono">
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-zinc-300 font-bold">⛽ TANQUE 55L</span>
            <strong className={fuelPercent <= 15 ? 'text-red-400 animate-pulse' : 'text-white'}>
              {Math.round(fuelPercent)}%
            </strong>
          </div>
          <div className="w-full h-2.5 rounded-full bg-zinc-950 border border-white/10 overflow-hidden">
            <div
              className={`h-full ${fuelPercent <= 15 ? 'bg-red-500' : 'bg-emerald-400'}`}
              style={{ width: `${fuelPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[8px] text-zinc-400">
            <span>{fuelType === 'ethanol_e100' ? 'ETANOL' : 'GASOLINA'}</span>
            <strong className="text-emerald-300">{estimatedRangeKm} km</strong>
          </div>
        </div>

        {/* Centro: Velocímetro Digital + Seletor Aisin AT6 */}
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-baseline gap-1.5">
            <span className="text-6xl font-black font-mono text-white tracking-tighter leading-none tabular-nums">
              {speed}
            </span>
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase">km/h</span>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-xl bg-zinc-900 border border-red-500/40">
              <span className="text-[8.5px] font-mono text-zinc-400">AISIN AT6</span>
              <span className="text-base font-mono font-black text-red-400">{gearDisplay}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-lg font-mono text-[8px] font-black uppercase border ${
                drivingMode === 'sport'
                  ? 'border-red-500/60 bg-red-600/25 text-red-300'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-300'
              }`}
            >
              {drivingMode === 'sport' ? 'SPORT' : 'NORMAL'} · FWD
            </span>
            {shiftLight.isActive && (
              <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-mono text-[8px] font-black animate-pulse">
                SHIFT
              </span>
            )}
          </div>
        </div>

        {/* Direita: Turbo GSE T270 + Temperatura + Computador de Bordo */}
        <div className="h-full rounded-2xl border border-white/10 bg-zinc-900/55 p-2.5 flex flex-col justify-between font-mono text-[8.5px]">
          <div>
            <div className="flex justify-between text-zinc-300 font-bold">
              <span>TURBO T270</span>
              <span className="text-red-400 tabular-nums">{boostPressureBar.toFixed(2)} bar</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-zinc-950 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-amber-400"
                style={{ width: `${boostRatio * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-zinc-300">
              <span>🌡️ ÁGUA</span>
              <strong className="text-white tabular-nums">{Math.round(auxGauges.coolantTemp)}°C</strong>
            </div>
            <div className="mt-0.5 h-1.5 w-full rounded-full bg-zinc-950 overflow-hidden">
              <div
                className={`h-full ${auxGauges.coolantTemp >= 112 ? 'bg-red-500' : 'bg-cyan-400'}`}
                style={{ width: `${coolantRatio * 100}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-white/10 pt-1 text-[8px] text-zinc-400">
            <span>
              {hasMeasuredAvgConsumption ? `${avgConsumptionKmL.toFixed(1)} km/L` : 'FWD URBANO'}
            </span>
            <strong className="text-white tabular-nums">{Math.round(odometerKm).toLocaleString('pt-BR')} km</strong>
          </div>
        </div>
      </div>
    </div>
  )
})
