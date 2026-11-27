import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'

interface HondaCB1000RRealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * HondaCB1000RRealCluster — Tela TFT Colorida de 5 polegadas da Honda CB1000R Black Edition (2022).
 *
 * Instrumentação exclusiva de motocicleta:
 * - Sem multimídia automotiva e sem freio de mão `(P)`
 * - Indicador ABS estritamente vinculado a `telemetry.abs` (`absFault` fixo vs `absActive` pulsante, apagado em standby)
 * - Escala real de combustível em 6 segmentos sobre tanque de 16,2 L + autonomia e odômetro reais
 * - Parâmetros eletrônicos Honda `P` (Power), `EB` (Engine Brake) e `T` (HSTC)
 */
export const HondaCB1000RRealCluster = memo(function HondaCB1000RRealCluster({
  telemetry,
}: HondaCB1000RRealClusterProps) {
  const { tachometer, speedometer, gear, warningLights, auxGauges, shiftLight, abs } = telemetry

  const odometerKm = useSimulationStore((s) => s.odometerKm)
  const estimatedRangeKm = useSimulationStore((s) => s.estimatedRangeKm)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)

  const maxRpm = tachometer.maxRpm || 12000
  const redlineStart = tachometer.redlineStart || 10500
  const clampedRpm = clamp(tachometer.rpm, 0, maxRpm)
  const rpmPercent = clamp((clampedRpm / maxRpm) * 100, 0, 100)
  const isRedline = clampedRpm >= redlineStart

  // 6 segmentos reais de combustível sobre o tanque de 16.2 L
  const fuelPercent = clamp(auxGauges.fuelPercent, 0, 100)
  const fuelSegments = fuelPercent <= 0 ? 0 : Math.max(1, Math.round((fuelPercent / 100) * 6))
  const isLowFuel = fuelPercent > 0 && fuelPercent <= 18

  return (
    <div
      data-testid="cluster-honda-cb1000r"
      className="relative flex flex-col items-center w-full max-w-2xl p-1.5 sm:p-2 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.9)] select-none"
    >
      {/* Borda Superior: Seta Esq + Shift Lights de LED + Luzes-Espia da Moto + Seta Dir */}
      <div className="flex items-center justify-between gap-2 w-full px-1.5 mb-1">
        <span
          className={`font-mono text-xs font-black ${
            leftIndicatorLit ? 'text-emerald-400 opacity-100' : 'text-zinc-800 opacity-40'
          }`}
        >
          ◀
        </span>

        {/* Barra de LEDs de Shift Light */}
        <div className="flex items-center gap-1 flex-1">
          {[...Array(8)].map((_, i) => {
            const step = 8200 + i * 330
            const active = clampedRpm >= step
            const isRed = i >= 5
            return (
              <div
                key={i}
                className={`flex-1 h-2 rounded-xs transition-all ${
                  shiftLight.isBlinking
                    ? 'bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)] animate-pulse'
                    : active
                      ? isRed
                        ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                        : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                      : 'bg-zinc-800'
                }`}
              />
            )
          })}
        </div>

        {/* Luzes de Alerta de Moto: Neutro [N], ABS real, PGM-FI, Óleo, Bateria, Temp, Farol */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black transition-all ${
              gear.isNeutral
                ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.9)]'
                : 'text-zinc-800 opacity-30'
            }`}
          >
            N
          </span>
          {abs.available && (
            <span
              data-testid="cb1000r-abs-indicator"
              data-abs-status={abs.status}
              className={`text-[9px] font-mono font-bold px-1 rounded ${
                warningLights.absFault
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-400/60 opacity-100'
                  : warningLights.absActive
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-400/60 animate-pulse opacity-100'
                    : 'text-zinc-800 opacity-30'
              }`}
              title={
                warningLights.absFault
                  ? 'Falha no sistema ABS'
                  : warningLights.absActive
                    ? 'ABS modulando frenagem'
                    : 'ABS em prontidão'
              }
            >
              ABS
            </span>
          )}
          <span
            className={`text-[9px] font-mono font-black px-1 rounded ${
              warningLights.checkEngine ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-zinc-800 opacity-30'
            }`}
          >
            FI
          </span>
          <span
            className={`text-[9px] font-mono font-black px-1 rounded ${
              warningLights.oil ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-zinc-800 opacity-30'
            }`}
          >
            OIL
          </span>
          <span
            className={`text-[9px] font-mono font-black px-1 rounded ${
              warningLights.battery ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-zinc-800 opacity-30'
            }`}
          >
            BAT
          </span>
          <span
            className={`text-[9px] font-mono font-black px-1 rounded ${
              warningLights.temp ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-zinc-800 opacity-30'
            }`}
          >
            HI°
          </span>
          {headlightsMode === 'high' && (
            <span className="text-[9px] font-mono font-black px-1 rounded bg-blue-500/25 text-blue-300 border border-blue-400/50">
              ≡D
            </span>
          )}
        </div>

        <span
          className={`font-mono text-xs font-black ${
            rightIndicatorLit ? 'text-emerald-400 opacity-100' : 'text-zinc-800 opacity-40'
          }`}
        >
          ▶
        </span>
      </div>

      {/* Tela TFT Principal da CB1000R */}
      <div className="w-full rounded-xl bg-gradient-to-b from-zinc-950 via-[#0a0f16] to-black border border-white/10 p-2 sm:p-3 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] flex flex-col justify-between gap-2">
        {/* 1. TOPO: TACÔMETRO SWEEPING DIGITAL (0 a 12.000 RPM) */}
        <div className="w-full flex flex-col gap-1">
          <div className="flex justify-between text-[9px] font-mono font-bold text-zinc-400 px-1">
            <span>0</span>
            <span>2</span>
            <span>4</span>
            <span>6</span>
            <span>8</span>
            <span className="text-amber-400">10</span>
            <span className="text-red-500">12</span>
          </div>

          <div className="relative w-full h-4 bg-zinc-900 rounded-sm overflow-hidden border border-white/15 p-0.5">
            <div
              className={`h-full rounded-xs transition-all duration-75 ${
                isRedline
                  ? 'bg-gradient-to-r from-amber-400 via-red-500 to-red-600 shadow-[0_0_15px_rgba(239,68,68,0.9)] animate-pulse'
                  : clampedRpm > 8000
                    ? 'bg-gradient-to-r from-cyan-400 via-amber-400 to-amber-500'
                    : 'bg-gradient-to-r from-sky-400 to-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.5)]'
              }`}
              style={{ width: `${rpmPercent}%` }}
            />
          </div>

          <div className="flex justify-between items-center px-1 text-[10px] font-mono">
            <span className="text-zinc-500 uppercase tracking-widest font-bold">r/min × 1000</span>
            <span className={`font-black tabular-nums ${isRedline ? 'text-red-500' : 'text-zinc-200'}`}>
              {Math.round(clampedRpm)} RPM
            </span>
          </div>
        </div>

        {/* 2. CENTRO: VELOCÍMETRO GIGANTE + CAIXA DE MARCHA + MODO HONDA */}
        <div className="flex items-center justify-between w-full my-auto px-2">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1">
              GEAR
            </span>
            <div
              className={`w-16 h-18 sm:w-18 sm:h-20 rounded-xl border-2 flex items-center justify-center shadow-lg transition-all ${
                gear.isNeutral
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                  : 'bg-zinc-900/90 border-amber-500/80 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              }`}
            >
              <span className="text-4xl sm:text-5xl font-mono font-black leading-none">{gear.label}</span>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-7xl sm:text-8xl font-mono font-black text-white tracking-tighter leading-none drop-shadow-[0_0_24px_rgba(255,255,255,0.35)] tabular-nums">
              {Math.round(speedometer.speed)}
            </span>
            <span className="text-xs font-mono font-black uppercase tracking-widest text-zinc-300 mt-1">
              km/h
            </span>
          </div>

          <div className="flex flex-col gap-1.5 items-end">
            <span
              className={`text-[9px] font-mono font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                gear.drivingMode === 'sport'
                  ? 'bg-red-500/20 text-red-400 border border-red-500'
                  : gear.drivingMode === 'eco'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                    : 'bg-sky-500/20 text-sky-400 border border-sky-500'
              }`}
            >
              {gear.drivingMode === 'sport' ? 'SPORT' : gear.drivingMode === 'eco' ? 'RAIN' : 'STANDARD'}
            </span>

            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px] font-mono">
              <span className="text-zinc-400 font-bold">P</span>
              <span className="text-white font-black">
                {gear.drivingMode === 'sport' ? '3' : gear.drivingMode === 'eco' ? '1' : '2'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px] font-mono">
              <span className="text-zinc-400 font-bold">EB</span>
              <span className="text-white font-black">
                {gear.drivingMode === 'sport' ? '1' : gear.drivingMode === 'eco' ? '3' : '2'}
              </span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono transition-all ${
                warningLights.tcsFlash
                  ? 'bg-amber-500 text-black border-amber-400 font-black animate-pulse'
                  : warningLights.tcs
                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/50'
                    : 'bg-zinc-900 text-white border-white/10'
              }`}
            >
              <span className="text-zinc-400 font-bold">T</span>
              <span className="font-black">
                {!telemetry.tcs.enabled
                  ? 'OFF'
                  : gear.drivingMode === 'sport'
                    ? '1'
                    : gear.drivingMode === 'eco'
                      ? '3'
                      : '2'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. BASE: COMBUSTÍVEL EM 6 SEGMENTOS (16,2 L), AUTONOMIA, ODÔMETRO E TEMPERATURA */}
        <div className="flex items-center justify-between w-full border-t border-white/10 pt-2 px-1 text-[9.5px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className={isLowFuel ? 'text-amber-400 animate-pulse' : 'text-zinc-400'}>⛽</span>
            <div className="flex items-center gap-0.5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-3 rounded-xs ${
                    i < fuelSegments
                      ? isLowFuel
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-cyan-400'
                      : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>
            <span className="text-[8.5px] text-zinc-400 tabular-nums">{Math.round(fuelPercent)}%</span>
          </div>

          <div className="flex items-center gap-2.5 text-zinc-400 text-[9px]">
            <span>
              RANGE <strong className="text-cyan-300 tabular-nums">{estimatedRangeKm} km</strong>
            </span>
            <span>
              ODO <strong className="text-white tabular-nums">{Math.round(odometerKm).toLocaleString('pt-BR')} km</strong>
            </span>
          </div>

          <div className="flex items-center gap-1 text-zinc-300">
            <span className="text-zinc-500">TEMP</span>
            <span className="font-bold text-white tabular-nums">{Math.round(auxGauges.coolantTemp)}°C</span>
          </div>
        </div>
      </div>
    </div>
  )
})
