import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp, mapRange } from '@/utils/math'
import { ClusterIndicatorIcon } from '@/components/gauges'

export interface FiatToroRanchClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * FiatToroRanchCluster — Quadro de Instrumentos 100% Digital TFT de 7 polegadas
 * exclusivo da Fiat Toro Ranch 2.2 Turbodiesel 4x4 AT9 (2025).
 *
 * Características nobres da versão Ranch:
 * - Tema visual Ranch Premium com tons bronze, cobre, âmbar e amadeirados escuros
 * - Tacômetro digital para motor Turbodiesel MultiJet II de 0 a 6.000 RPM (faixa vermelha aos 4.500 RPM)
 * - Velocímetro digital central proeminente com tipografia robusta
 * - Mostrador de transmissão ZF 9HP AT9: P / R / N / D / M1..M9 com suporte a Paddle Shifters
 * - Indicador ativo do Modo de Tração 4x4:
 *   · AUTO (Tração Integral sob Demanda)
 *   · 4WD LOCK (Bloqueio 50/50 Eixos Dianteiro e Traseiro)
 *   · 4WD LOW (Reduzida com Crawl Ratio engatado)
 * - Manômetro de Turbo Diesel de alta pressão (até 2.0 bar)
 * - Tanque de combustível diesel (60 L) e temperatura (90 °C)
 * - Computador de bordo completo com odômetro e autonomia estendida (> 850 km)
 */
export const FiatToroRanchCluster = memo(function FiatToroRanchCluster({
  telemetry,
}: FiatToroRanchClusterProps) {
  const {
    tachometer,
    speedometer,
    gear,
    warningLights,
    auxGauges,
    shiftLight,
    tcs,
  } = telemetry

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const fourWheelDriveMode = useSimulationStore((s) => s.fourWheelDriveMode)
  const mileageKm = 18320

  const maxRpm = 6000
  const redlineRpm = 4500
  const rpm = clamp(tachometer.rpm, 0, maxRpm)
  const speed = Math.round(speedometer.speed)
  const isRedline = rpm >= redlineRpm

  // Arcos SVG para o Tacômetro Diesel (0-6000 RPM)
  const startAngle = -210
  const endAngle = 30
  const currentAngle = mapRange(rpm, 0, maxRpm, startAngle, endAngle)

  const cx = 135
  const cy = 134
  const radius = 95

  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    }
  }

  const describeArc = (x: number, y: number, r: number, startA: number, endA: number) => {
    const start = polarToCartesian(x, y, r, endA)
    const end = polarToCartesian(x, y, r, startA)
    const largeArcFlag = endA - startA <= 180 ? '0' : '1'
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
  }

  const needle = polarToCartesian(cx, cy, radius - 6, currentAngle)
  const baseTrack = describeArc(cx, cy, radius, startAngle, endAngle)
  const activeTrack = rpm > 50 ? describeArc(cx, cy, radius, startAngle, currentAngle) : ''
  const redlineArc = describeArc(cx, cy, radius, mapRange(redlineRpm, 0, maxRpm, startAngle, endAngle), endAngle)

  // Barra de Pressão de Turbo Diesel (até 2.0 bar)
  const boostRatio = clamp((boostPressureBar || 0) / 2.0, 0, 1)

  // Formatação de marcha AT9
  const gearDisplay =
    gear.isPark ? 'P'
    : gear.isReverse ? 'R'
    : gear.isNeutral ? 'N'
    : gear.gearSelectorPosition === 'M' || gear.transmissionMode === 'manual_simulated' ? gear.label
    : `D${gear.label.replace(/\D/g, '') || ''}`

  return (
    <div
      className="relative flex items-center justify-between w-[750px] h-[268px] bg-gradient-to-b from-[#0d0905] via-[#120c06] to-[#0a0704] border-2 border-amber-900/60 rounded-3xl p-3 select-none overflow-hidden font-sans shadow-2xl text-zinc-100"
      style={{
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.95), 0 10px 30px rgba(180,83,9,0.2)',
      }}
    >
      {/* Halo de iluminação de fundo Ranch Bronze / Âmbar */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(217,119,6,0.09)_0%,_transparent_75%)] pointer-events-none" />

      {/* ─── 1. Tacômetro Turbodiesel MultiJet II (0-6000 RPM) ─── */}
      <div className="relative w-[270px] h-[244px] flex items-center justify-center flex-shrink-0">
        <svg viewBox="0 0 270 268" className="w-full h-full drop-shadow-[0_0_12px_rgba(0,0,0,0.9)]">
          {/* Aro de bronze usinado */}
          <circle cx={cx} cy={cy} r={radius + 12} fill="#090603" stroke="#451a03" strokeWidth="2.5" />
          <circle cx={cx} cy={cy} r={radius + 6} fill="none" stroke="#78350f" strokeWidth="1" strokeDasharray="3 3" />

          {/* Trilho de fundo */}
          <path d={baseTrack} fill="none" stroke="#1c1208" strokeWidth="10" strokeLinecap="round" />

          {/* Faixa Vermelha Diesel (4500 a 6000 RPM) */}
          <path d={redlineArc} fill="none" stroke="#ef4444" strokeWidth="10" strokeLinecap="round" opacity="0.35" />

          {/* Trilha Ativa Iluminada (Âmbar/Bronze Ranch) */}
          {activeTrack && (
            <path
              d={activeTrack}
              fill="none"
              stroke={isRedline ? '#ef4444' : '#f59e0b'}
              strokeWidth="10"
              strokeLinecap="round"
              className="transition-all duration-75"
              style={{
                filter: isRedline ? 'drop-shadow(0 0 8px #ef4444)' : 'drop-shadow(0 0 6px #f59e0b)',
              }}
            />
          )}

          {/* Ponteiro iluminado âmbar */}
          <line
            x1={cx}
            y1={cy}
            x2={needle.x}
            y2={needle.y}
            stroke={isRedline ? '#ef4444' : '#fbbf24'}
            strokeWidth="3.5"
            strokeLinecap="round"
            style={{
              filter: 'drop-shadow(0 0 6px #f59e0b)',
            }}
          />
          <circle cx={cx} cy={cy} r="16" fill="#140c04" stroke="#d97706" strokeWidth="2.5" />
          <circle cx={cx} cy={cy} r="6" fill="#f59e0b" />

          {/* Escala graduada (0 a 6) */}
          {[0, 1, 2, 3, 4, 5, 6].map((n) => {
            const val = n * 1000
            const ang = mapRange(val, 0, maxRpm, startAngle, endAngle)
            const p = polarToCartesian(cx, cy, radius - 20, ang)
            const isRedZone = val >= redlineRpm
            return (
              <text
                key={n}
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fill={isRedZone ? '#ef4444' : '#fbbf24'}
                fontSize="12"
                fontWeight="900"
                fontFamily="ui-monospace, monospace"
              >
                {n}
              </text>
            )
          })}
        </svg>

        {/* Textos internos */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-7 pointer-events-none">
          <span className="text-[10px] font-mono font-bold text-amber-500/80 tracking-wider">
            RPM × 1000
          </span>
          <span className="text-[18px] font-mono font-black text-amber-100 tracking-tight">
            {rpm}
          </span>
          <span className="text-[8px] font-mono font-bold text-amber-500 uppercase tracking-widest mt-0.5">
            2.2 TURBODIESEL 16V
          </span>
        </div>
      </div>

      {/* ─── 2. Centro: Display Digital TFT 7" (Velocidade, Marcha ZF 9HP e Tração 4x4) ─── */}
      <div className="flex-1 h-full flex flex-col justify-between items-center px-2 py-1 min-w-0">
        {/* Barra Superior: Badge Ranch + Luzes-Espia */}
        <div className="w-full flex items-center justify-between border-b border-amber-900/40 pb-1 px-1">
          {/* Badge Ranch */}
          <div className="flex items-center gap-1.5">
            <span className="text-amber-500 font-sans font-black text-xs tracking-wider flex items-center gap-1">
              <span>🐂</span>
              <span>RANCH</span>
            </span>
            <span className="text-[8px] font-mono text-amber-800">|</span>
            <span className="text-[8px] font-mono text-amber-400/80 font-bold tracking-wider">4X4 DIESEL AT9</span>
          </div>

          {/* Ícones de Alerta */}
          <div className="flex items-center gap-1.5">
            <ClusterIndicatorIcon
              kind="checkEngine"
              active={warningLights.checkEngine}
            />
            <ClusterIndicatorIcon
              kind="oil"
              active={warningLights.oil}
            />
            <ClusterIndicatorIcon
              kind="battery"
              active={warningLights.battery}
            />
            <ClusterIndicatorIcon
              kind="brake"
              active={warningLights.brake}
            />
            <ClusterIndicatorIcon
              kind="tcs"
              active={tcs.intervening}
            />
          </div>
        </div>

        {/* Velocímetro Digital */}
        <div className="flex flex-col items-center justify-center my-auto">
          <div className="flex items-baseline gap-1">
            <span className="text-6xl font-black font-mono text-white tracking-tighter drop-shadow-[0_0_20px_rgba(245,158,11,0.25)]">
              {speed}
            </span>
            <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-widest">
              km/h
            </span>
          </div>

          {/* Seletor ZF 9HP + Paddle Shifter Indicator */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-950 border border-amber-900/60 shadow-inner">
              <span className="text-[9px] font-mono text-amber-600 uppercase">ZF 9HP</span>
              <span className="text-lg font-mono font-black text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]">
                {gearDisplay}
              </span>
            </div>
            {shiftLight.isActive && (
              <span className="px-2 py-1 rounded-lg bg-amber-500 text-black font-mono text-[9px] font-black uppercase animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]">
                PADDLE
              </span>
            )}
          </div>
        </div>

        {/* Badge Proeminente de Tração 4x4 (AUTO / 4WD LOCK / 4WD LOW) */}
        <div className="w-full max-w-[260px] flex items-center justify-between px-2.5 py-1 rounded-xl bg-zinc-950/80 border border-amber-900/50 shadow-md">
          <span className="text-[8px] font-mono text-amber-500 font-bold uppercase tracking-wider">
            SISTEMA 4X4:
          </span>
          <span
            className={`text-[9px] font-mono font-black px-2 py-0.5 rounded uppercase tracking-wider transition-all ${
              fourWheelDriveMode === '4wd_low'
                ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.8)] animate-pulse'
                : fourWheelDriveMode === '4wd'
                ? 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                : 'bg-zinc-800 text-amber-300'
            }`}
          >
            {fourWheelDriveMode === '4wd_low'
              ? '4WD LOW (REDUZIDA)'
              : fourWheelDriveMode === '4wd'
              ? '4WD LOCK (50/50)'
              : 'AUTO (INTEGRAL)'}
          </span>
        </div>

        {/* Manômetro Turbo Diesel (0 a 2.0 bar) */}
        <div className="w-full max-w-[260px] flex flex-col gap-0.5 bg-zinc-950/60 p-1.5 rounded-xl border border-amber-950">
          <div className="flex justify-between items-center text-[8px] font-mono text-amber-400/80">
            <span>BOOST MULTIJET II</span>
            <span className="font-bold text-amber-400">{boostPressureBar.toFixed(2)} bar</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-75"
              style={{ width: `${boostRatio * 100}%` }}
            />
          </div>
        </div>

        {/* Barra Inferior */}
        <div className="w-full flex items-center justify-between text-[9px] font-mono text-zinc-400 border-t border-amber-900/40 pt-1 px-1">
          <span>ODO: <b className="text-white">{Math.round(mileageKm).toLocaleString()} km</b></span>
          <span>RANGE: <b className="text-amber-400">{Math.round((auxGauges.fuelPercent / 100) * 880)} km</b></span>
          <span className="text-amber-600 font-bold">4WD AT9 DIESEL</span>
        </div>
      </div>

      {/* ─── 3. Mostrador Direito: Combustível Diesel (60L) e Temperatura ─── */}
      <div className="relative w-[190px] h-[244px] flex flex-col justify-between bg-zinc-950/50 border border-amber-900/50 rounded-2xl p-3 flex-shrink-0">
        {/* Nível de Combustível Diesel */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-amber-400 flex items-center gap-1 font-bold">
              <span>⛽</span>
              <span>DIESEL S10</span>
            </span>
            <span className={`font-black ${auxGauges.fuelPercent <= 15 ? 'text-red-500 animate-pulse' : 'text-amber-200'}`}>
              {Math.round(auxGauges.fuelPercent)}%
            </span>
          </div>
          <div className="w-full h-3 bg-zinc-950 rounded-lg p-0.5 border border-amber-950 flex gap-0.5">
            {[...Array(10)].map((_, i) => {
              const active = auxGauges.fuelPercent >= (i + 1) * 10
              const isReserve = i < 2
              return (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-xs transition-colors ${
                    active
                      ? isReserve
                        ? 'bg-amber-600'
                        : 'bg-amber-400'
                      : 'bg-zinc-800/40'
                  }`}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-[8px] font-mono text-zinc-500 px-0.5">
            <span>R (RESERVA)</span>
            <span>60 L (CHEIO)</span>
          </div>
        </div>

        {/* Temperatura do Motor */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-amber-400 flex items-center gap-1 font-bold">
              <span>🌡️</span>
              <span>TEMPERATURA</span>
            </span>
            <span className="text-amber-100 font-black">
              {Math.round(auxGauges.coolantTemp)}°C
            </span>
          </div>
          <div className="w-full h-2.5 bg-zinc-950 rounded-lg p-0.5 border border-amber-950 flex gap-0.5">
            {[...Array(8)].map((_, i) => {
              const active = i <= 4
              return (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-xs ${
                    active ? (i >= 6 ? 'bg-red-500' : 'bg-amber-500') : 'bg-zinc-800/40'
                  }`}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-[8px] font-mono text-zinc-500 px-0.5">
            <span>50°C</span>
            <span>90°C</span>
            <span>130°C</span>
          </div>
        </div>

        {/* Status Eletrônico da Tração 4x4 */}
        <div className="rounded-xl bg-zinc-950 border border-amber-900/60 p-2 flex flex-col gap-1 text-[9px] font-mono">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 text-[8px]">DIFERENCIAL TRAS.</span>
            <span className={`font-bold ${fourWheelDriveMode !== 'auto' ? 'text-amber-400' : 'text-zinc-400'}`}>
              {fourWheelDriveMode !== 'auto' ? 'BLOQUEADO' : 'AUTO DESAC.'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 text-[8px]">REDUZIDA</span>
            <span className={`font-bold ${fourWheelDriveMode === '4wd_low' ? 'text-red-400 font-black' : 'text-zinc-400'}`}>
              {fourWheelDriveMode === '4wd_low' ? 'ENGATADA' : 'DESENGATADA'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})
