import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp } from '@/utils/math'
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
 * - Iluminação angular estritamente delimitada com strokeDasharray e clipPath anti-vazamento
 * - Ponteiro radial delimitado à pista do tacômetro, sem sobrepor a leitura central
 * - Velocímetro digital central proeminente com tipografia robusta
 * - Mostrador de transmissão ZF 9HP AT9: P / R / N / D / M1..M9 com suporte a Paddle Shifters
 * - Indicador ativo do Modo de Tração 4x4:
 *   · AUTO (Tração Integral sob Demanda)
 *   · 4WD LOCK (Bloqueio 50/50 Eixos Dianteiro e Traseiro)
 *   · 4WD LOW (Reduzida com Crawl Ratio da 1ª marcha engatado)
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
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const mileageKm = 18320

  const maxRpm = telemetry.tachometer.maxRpm || 6000
  const redlineRpm = telemetry.tachometer.redlineStart || 4500
  const rpm = clamp(Number.isFinite(tachometer.rpm) ? tachometer.rpm : 0, 0, maxRpm)
  const speed = Math.round(Number.isFinite(speedometer.speed) ? speedometer.speed : 0)
  const isRedline = rpm >= redlineRpm

  // Geometria precisa do Tacômetro Diesel Fiat TFT 7"
  // Centro: (135, 125), Raio: 85px
  // Inicia a 140° (inferior esquerdo) e varre 260° até 400° (inferior direito)
  const cx = 135
  const cy = 125
  const radius = 85
  const startDeg = 140
  const totalSweepDeg = 260
  const totalArcLen = (totalSweepDeg / 360) * 2 * Math.PI * radius // ~385.72 px

  const currentRatio = clamp(rpm / maxRpm, 0, 1)
  const activeArcLen = currentRatio * totalArcLen
  const currentAngleDeg = startDeg + currentRatio * totalSweepDeg

  const degToRad = (d: number) => (d * Math.PI) / 180
  const polar = (r: number, angleDeg: number) => ({
    x: cx + r * Math.cos(degToRad(angleDeg)),
    y: cy + r * Math.sin(degToRad(angleDeg)),
  })

  // Coordenadas estáticas do arco de 140° a 400°
  const arcStart = polar(radius, startDeg) // { x: 69.9, y: 179.6 }
  const arcEnd = polar(radius, startDeg + totalSweepDeg) // { x: 200.1, y: 179.6 }
  const baseArcPath = `M ${arcStart.x.toFixed(1)} ${arcStart.y.toFixed(1)} A ${radius} ${radius} 0 1 1 ${arcEnd.x.toFixed(1)} ${arcEnd.y.toFixed(1)}`

  // Arco da faixa vermelha Diesel (4.500 a 6.000 RPM)
  const redlineRatio = redlineRpm / maxRpm
  const redlineAngleDeg = startDeg + redlineRatio * totalSweepDeg
  const redlineStartPt = polar(radius, redlineAngleDeg)
  const redlineArcPath = `M ${redlineStartPt.x.toFixed(1)} ${redlineStartPt.y.toFixed(1)} A ${radius} ${radius} 0 0 1 ${arcEnd.x.toFixed(1)} ${arcEnd.y.toFixed(1)}`

  // Ponteiro radial delimitado à pista do tacômetro (não invade a área central)
  const needleInner = polar(radius - 12, currentAngleDeg)
  const needleOuter = polar(radius + 7, currentAngleDeg)

  // Barra de Pressão de Turbo Diesel (até 2.0 bar)
  const boostRatio = clamp((boostPressureBar || 0) / 2.0, 0, 1)

  // Formatação de marcha AT9 (P, R, N, D1..D9, S1..S9, M1..M9)
  const gearDisplay =
    gear.isPark ? 'P'
    : gear.isReverse ? 'R'
    : gear.isNeutral ? 'N'
    : gear.gearSelectorPosition === 'S' ? (gear.label.startsWith('M') ? gear.label : `S${gear.label.replace(/\D/g, '') || ''}`)
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
        <svg viewBox="0 0 270 250" className="w-full h-full overflow-hidden">
          <defs>
            <clipPath id="toro-ranch-tach-clip">
              <rect x="0" y="0" width="270" height="250" rx="20" />
            </clipPath>
          </defs>

          <g clipPath="url(#toro-ranch-tach-clip)">
            {/* Aro de bronze usinado */}
            <circle cx={cx} cy={cy} r={radius + 15} fill="#090603" stroke="#451a03" strokeWidth="2.5" />
            <circle cx={cx} cy={cy} r={radius + 7} fill="none" stroke="#78350f" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={cx} cy={cy} r={radius - 28} fill="#140c04" stroke="#291305" strokeWidth="1.5" />

            {/* Trilho de fundo */}
            <path
              d={baseArcPath}
              fill="none"
              stroke="#1c1208"
              strokeWidth="9"
              strokeLinecap="round"
            />

            {/* Faixa Vermelha Diesel (4500 a 6000 RPM) */}
            <path
              d={redlineArcPath}
              fill="none"
              stroke="#ef4444"
              strokeWidth="9"
              strokeLinecap="round"
              opacity="0.4"
            />

            {/* Trilha Ativa Iluminada (Âmbar/Bronze Ranch) */}
            {activeArcLen > 0.5 && (
              <path
                d={baseArcPath}
                fill="none"
                stroke={isRedline ? '#ef4444' : '#f59e0b'}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${activeArcLen.toFixed(1)} ${totalArcLen.toFixed(1)}`}
                strokeDashoffset="0"
                style={{
                  filter: isRedline
                    ? 'drop-shadow(0 0 6px rgba(239,68,68,0.85))'
                    : 'drop-shadow(0 0 5px rgba(245,158,11,0.75))',
                }}
              />
            )}

            {/* Ponteiro iluminado âmbar */}
            <line
              x1={needleInner.x.toFixed(1)}
              y1={needleInner.y.toFixed(1)}
              x2={needleOuter.x.toFixed(1)}
              y2={needleOuter.y.toFixed(1)}
              stroke={isRedline ? '#fca5a5' : '#fef3c7'}
              strokeWidth="3.5"
              strokeLinecap="round"
              style={{
                filter: isRedline
                  ? 'drop-shadow(0 0 5px #ef4444)'
                  : 'drop-shadow(0 0 4px #f59e0b)',
              }}
            />
            {/* Marcador em ponta de diamante */}
            <circle
              cx={needleOuter.x.toFixed(1)}
              cy={needleOuter.y.toFixed(1)}
              r="2.5"
              fill={isRedline ? '#ef4444' : '#fbbf24'}
            />

            {/* Escala graduada diesel (0 a 6) */}
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
          </g>
        </svg>

        {/* Display Central do Tacômetro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 pointer-events-none">
          <span className="text-[9px] font-mono font-bold text-amber-500/80 tracking-wider">
            RPM
          </span>
          <span className="text-2xl font-mono font-black text-amber-100 tracking-tight drop-shadow-sm">
            {Math.round(rpm)}
          </span>
          <span className="text-[7.5px] font-mono font-bold text-amber-500 uppercase tracking-widest mt-0.5">
            2.2 TURBODIESEL 16V
          </span>
        </div>
      </div>

      {/* ─── 2. Centro: Display Digital TFT 7" (Velocidade, Marcha ZF 9HP e Tração 4x4) ─── */}
      <div className="flex-1 h-full flex flex-col justify-between items-center px-2 py-1 min-w-0">
        {/* Barra Superior: Badge Ranch + Luzes-Espia */}
        <div className="w-full flex items-center justify-between border-b border-amber-900/40 pb-1 px-1">
          {/* Badge Ranch + Modo de Condução */}
          <div className="flex items-center gap-1.5">
            <span className="text-amber-500 font-sans font-black text-xs tracking-wider flex items-center gap-1">
              <span>🐂</span>
              <span>RANCH</span>
            </span>
            <span className="text-[8px] font-mono text-amber-800">|</span>
            <span className="text-[8px] font-mono text-amber-400/80 font-bold tracking-wider">4X4 DIESEL AT9</span>
            {drivingMode === 'sport' && (
              <span className="px-1.5 py-0.5 rounded bg-red-600/30 border border-red-500/60 text-red-400 font-mono text-[7.5px] font-black tracking-wider uppercase animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                SPORT
              </span>
            )}
            {drivingMode === 'eco' && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-600/30 border border-emerald-500/60 text-emerald-400 font-mono text-[7.5px] font-black tracking-wider uppercase shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                ECO
              </span>
            )}
            {drivingMode === 'normal' && (
              <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/80 text-amber-300 font-mono text-[7.5px] font-bold tracking-wider uppercase">
                NORMAL
              </span>
            )}
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
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded text-[9px] font-mono font-black transition-all ${
                fourWheelDriveMode === '4wd_low'
                  ? 'bg-red-600 text-white animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                  : fourWheelDriveMode === '4wd'
                  ? 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                  : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              {fourWheelDriveMode === '4wd_low'
                ? '4WD LOW'
                : fourWheelDriveMode === '4wd'
                ? '4WD LOCK'
                : 'AUTO'}
            </span>
            <span className="text-[8px] font-mono text-zinc-400">
              {fourWheelDriveMode === '4wd_low'
                ? 'REDUZIDA'
                : fourWheelDriveMode === '4wd'
                ? '50/50'
                : 'SOB DEMANDA'}
            </span>
          </div>
        </div>

        {/* Manômetro Turbo Diesel */}
        <div className="w-full max-w-[240px] flex flex-col gap-0.5 bg-zinc-950/70 p-1.5 rounded-xl border border-amber-900/40">
          <div className="flex justify-between items-center text-[8px] font-mono text-amber-400/80">
            <span>PRESSÃO TURBO DIESEL</span>
            <span className="font-bold text-amber-400">{boostPressureBar.toFixed(2)} bar</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-300 transition-all duration-75"
              style={{ width: `${boostRatio * 100}%` }}
            />
          </div>
        </div>

        {/* Barra Inferior */}
        <div className="w-full flex items-center justify-between text-[9px] font-mono text-zinc-400 border-t border-amber-900/40 pt-1 px-1">
          <span>ODO: <b className="text-white">{Math.round(mileageKm).toLocaleString()} km</b></span>
          <span>RANGE: <b className="text-amber-400">{Math.round((auxGauges.fuelPercent / 100) * 880)} km</b></span>
          <span className="text-amber-600 font-bold">4X4 AT9</span>
        </div>
      </div>

      {/* ─── 3. Mostrador Direito: Nível de Diesel (60L) e Telemetria Off-Road ─── */}
      <div className="relative w-[190px] h-[244px] flex flex-col justify-between bg-zinc-950/60 border border-amber-900/50 rounded-2xl p-3 flex-shrink-0">
        {/* Nível de Combustível Diesel */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-amber-500/90 flex items-center gap-1 font-bold">
              <span>⛽</span>
              <span>DIESEL S10</span>
            </span>
            <span className={`font-black ${auxGauges.fuelPercent <= 15 ? 'text-red-500 animate-pulse' : 'text-zinc-200'}`}>
              {Math.round(auxGauges.fuelPercent)}%
            </span>
          </div>
          <div className="w-full h-3 bg-zinc-950 rounded-lg p-0.5 border border-amber-900/40 flex gap-0.5">
            {[...Array(10)].map((_, i) => {
              const active = auxGauges.fuelPercent >= (i + 1) * 10
              const isReserve = i < 2
              return (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-xs transition-colors ${
                    active
                      ? isReserve
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                      : 'bg-zinc-900'
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

        {/* Temperatura do Motor Diesel */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-amber-500/90 flex items-center gap-1 font-bold">
              <span>🌡️</span>
              <span>TEMPERATURA</span>
            </span>
            <span className="text-zinc-200 font-black">
              {Math.round(auxGauges.coolantTemp)}°C
            </span>
          </div>
          <div className="w-full h-2.5 bg-zinc-950 rounded-lg p-0.5 border border-amber-900/40 flex gap-0.5">
            {[...Array(8)].map((_, i) => {
              const active = i <= 4
              return (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-xs ${
                    active ? (i >= 6 ? 'bg-red-500' : 'bg-amber-400') : 'bg-zinc-900'
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

        {/* Bloco de Status Off-Road e Eixos */}
        <div className="rounded-xl bg-zinc-950 border border-amber-900/40 p-2 flex flex-col gap-1 text-[8.5px] font-mono">
          <div className="flex justify-between text-zinc-400">
            <span>EIXO TRASEIRO</span>
            <span className={`font-bold ${fourWheelDriveMode !== 'auto' ? 'text-amber-400' : 'text-zinc-400'}`}>
              {fourWheelDriveMode !== 'auto' ? 'BLOQUEADO' : 'AUTO DESAC.'}
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>REDUZIDA</span>
            <span className={`font-bold ${fourWheelDriveMode === '4wd_low' ? 'text-red-400 font-black' : 'text-zinc-400'}`}>
              {fourWheelDriveMode === '4wd_low' ? 'ENGATADA' : 'DESENGATADA'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})
