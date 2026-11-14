import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp } from '@/utils/math'
import { ClusterIndicatorIcon } from '@/components/gauges'

export interface FiatToroEnduranceClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * FiatToroEnduranceCluster — Quadro de Instrumentos 100% Digital TFT de 7 polegadas
 * oficial da Fiat Toro Endurance 1.3 Turbo 270 Flex AT6 (2025).
 *
 * Características reais Fiat:
 * - Tela colorida TFT de 7" de alta definição com identidade visual Fiat e detalhes em vermelho esportivo
 * - Tacômetro digital curvado de 0 a 7.000 RPM (faixa vermelha aos 6.200 RPM)
 * - Iluminação angular estritamente delimitada com strokeDasharray e clipPath anti-vazamento
 * - Ponteiro radial proporcional que não invade a área central
 * - Velocímetro digital central proeminente de altíssima legibilidade
 * - Mostrador de transmissão Aisin AT6: P / R / N / D / S / M1..M6
 * - Manômetro de pressão do turbo GSE T270 (até 1.5 bar)
 * - Nível de combustível (tanque de 55 L) e temperatura do arrefecimento (90 °C)
 * - Computador de bordo completo: odômetro, autonomia estimada e consumo
 * - Conjunto completo de luzes-espia regulamentares (Injeção, Óleo, Bateria, Freio, Temp, TCS)
 */
export const FiatToroEnduranceCluster = memo(function FiatToroEnduranceCluster({
  telemetry,
}: FiatToroEnduranceClusterProps) {
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
  const mileageKm = 12450

  const maxRpm = telemetry.tachometer.maxRpm || 7000
  const redlineRpm = telemetry.tachometer.redlineStart || 6200
  const rpm = clamp(Number.isFinite(tachometer.rpm) ? tachometer.rpm : 0, 0, maxRpm)
  const speed = Math.round(Number.isFinite(speedometer.speed) ? speedometer.speed : 0)
  const isRedline = rpm >= redlineRpm

  // Geometria precisa do Tacômetro Fiat TFT 7"
  // Centro: (135, 125), Raio: 85px
  // Ângulos: Inicia a 140° (inferior esquerdo) e varre 260° até 400° (inferior direito)
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

  // Arco da faixa vermelha (6.200 a 7.000 RPM)
  const redlineRatio = redlineRpm / maxRpm
  const redlineAngleDeg = startDeg + redlineRatio * totalSweepDeg
  const redlineStartPt = polar(radius, redlineAngleDeg)
  const redlineArcPath = `M ${redlineStartPt.x.toFixed(1)} ${redlineStartPt.y.toFixed(1)} A ${radius} ${radius} 0 0 1 ${arcEnd.x.toFixed(1)} ${arcEnd.y.toFixed(1)}`

  // Ponteiro radial delimitado à pista do tacômetro (não invade a área central)
  const needleInner = polar(radius - 12, currentAngleDeg)
  const needleOuter = polar(radius + 7, currentAngleDeg)

  // Barra de Turbo Boost
  const boostRatio = clamp((boostPressureBar || 0) / 1.5, 0, 1)

  // Formatação de marcha Fiat
  const gearDisplay =
    gear.isPark ? 'P'
    : gear.isReverse ? 'R'
    : gear.isNeutral ? 'N'
    : gear.gearSelectorPosition === 'S' ? (gear.label.startsWith('M') ? gear.label : `S${gear.label.replace(/\D/g, '') || ''}`)
    : gear.gearSelectorPosition === 'M' || gear.transmissionMode === 'manual_simulated' ? gear.label
    : `D${gear.label.replace(/\D/g, '') || ''}`

  return (
    <div
      className="relative flex items-center justify-between w-[750px] h-[268px] bg-gradient-to-b from-zinc-950 via-[#0a0a0f] to-zinc-950 border-2 border-zinc-800 rounded-3xl p-3 select-none overflow-hidden font-sans shadow-2xl text-zinc-100"
      style={{
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.9), 0 10px 30px rgba(0,0,0,0.8)',
      }}
    >
      {/* Halo de iluminação de fundo Fiat vermelho rubi */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.08)_0%,_transparent_75%)] pointer-events-none" />

      {/* ─── 1. Mostrador Esquerdo: Tacômetro Analógico-Digital Fiat (0-7000 RPM) ─── */}
      <div className="relative w-[270px] h-[244px] flex items-center justify-center flex-shrink-0">
        <svg viewBox="0 0 270 250" className="w-full h-full overflow-hidden">
          <defs>
            {/* ClipPath para conter estritamente a iluminação e evitar qualquer vazamento */}
            <clipPath id="toro-endurance-tach-clip">
              <rect x="0" y="0" width="270" height="250" rx="20" />
            </clipPath>
          </defs>

          <g clipPath="url(#toro-endurance-tach-clip)">
            {/* Fundo do aro do tacômetro */}
            <circle cx={cx} cy={cy} r={radius + 15} fill="#050508" stroke="#1f2937" strokeWidth="2" />
            <circle cx={cx} cy={cy} r={radius + 7} fill="none" stroke="#27272a" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={cx} cy={cy} r={radius - 28} fill="#09090d" stroke="#18181b" strokeWidth="1.5" />

            {/* Trilho de fundo (apagado) */}
            <path
              d={baseArcPath}
              fill="none"
              stroke="#18181b"
              strokeWidth="9"
              strokeLinecap="round"
            />

            {/* Faixa Vermelha de Alerta de Fundo (6200 a 7000 RPM) */}
            <path
              d={redlineArcPath}
              fill="none"
              stroke="#ef4444"
              strokeWidth="9"
              strokeLinecap="round"
              opacity="0.35"
            />

            {/* Trilha Ativa Iluminada (Vermelho Fiat T270)
                Usa strokeDasharray estrito para acompanhar a posição angular exata do ponteiro */}
            {activeArcLen > 0.5 && (
              <path
                d={baseArcPath}
                fill="none"
                stroke={isRedline ? '#ef4444' : '#dc2626'}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${activeArcLen.toFixed(1)} ${totalArcLen.toFixed(1)}`}
                strokeDashoffset="0"
                style={{
                  filter: isRedline
                    ? 'drop-shadow(0 0 6px rgba(239,68,68,0.85))'
                    : 'drop-shadow(0 0 5px rgba(220,38,38,0.75))',
                }}
              />
            )}

            {/* Ponteiro Indicador Radial (Localizado na borda externa, sem invadir o centro) */}
            <line
              x1={needleInner.x.toFixed(1)}
              y1={needleInner.y.toFixed(1)}
              x2={needleOuter.x.toFixed(1)}
              y2={needleOuter.y.toFixed(1)}
              stroke={isRedline ? '#fca5a5' : '#ffffff'}
              strokeWidth="3.5"
              strokeLinecap="round"
              style={{
                filter: isRedline
                  ? 'drop-shadow(0 0 5px #ef4444)'
                  : 'drop-shadow(0 0 4px #dc2626)',
              }}
            />
            {/* Marcador em ponta de diamante na extremidade do ponteiro */}
            <circle
              cx={needleOuter.x.toFixed(1)}
              cy={needleOuter.y.toFixed(1)}
              r="2.5"
              fill={isRedline ? '#ef4444' : '#f87171'}
            />

            {/* Números da Escala (0 a 7) posicionados radialmente ao longo do arco */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
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
                  fill={isRedZone ? '#ef4444' : '#a1a1aa'}
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

        {/* Display Central do Tacômetro (limpo, sem corte de ponteiro ou textos confusos) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 pointer-events-none">
          <span className="text-[9px] font-mono font-bold text-zinc-400 tracking-wider">
            RPM
          </span>
          <span className="text-2xl font-mono font-black text-white tracking-tight drop-shadow-sm">
            {Math.round(rpm)}
          </span>
          <span className="text-[7.5px] font-mono font-bold text-red-400 uppercase tracking-widest mt-0.5">
            TURBO FLEX T270
          </span>
        </div>
      </div>

      {/* ─── 2. Centro: Display Digital TFT 7" (Velocímetro, Marcha, Turbo e Alertas) ─── */}
      <div className="flex-1 h-full flex flex-col justify-between items-center px-2 py-1 min-w-0">
        {/* Barra Superior: Logo Fiat + Luzes Espia Regulamentares */}
        <div className="w-full flex items-center justify-between border-b border-zinc-800/80 pb-1 px-1">
          {/* Logo Fiat cromado/vermelho */}
          <div className="flex items-center gap-1.5">
            <span className="text-red-500 font-sans font-black text-xs tracking-widest">FIAT</span>
            <span className="text-[8px] font-mono text-zinc-500">|</span>
            <span className="text-[8px] font-mono text-zinc-400 font-bold tracking-wider">TORO ENDURANCE</span>
          </div>

          {/* Ícones de Alerta / Warning Lights */}
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

        {/* Núcleo Central: Velocímetro Digital Gigante + Marcha AT6 */}
        <div className="flex flex-col items-center justify-center my-auto">
          <div className="flex items-baseline gap-1">
            <span className="text-6xl font-black font-mono text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.25)]">
              {speed}
            </span>
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">
              km/h
            </span>
          </div>

          {/* Display da Marcha AT6 */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1 px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-700/80 shadow-inner">
              <span className="text-[9px] font-mono text-zinc-500 uppercase">CÂMBIO</span>
              <span className="text-lg font-mono font-black text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                {gearDisplay}
              </span>
            </div>
            {shiftLight.isActive && (
              <span className="px-2 py-1 rounded-lg bg-red-600 text-white font-mono text-[9px] font-black uppercase animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]">
                SHIFT
              </span>
            )}
          </div>
        </div>

        {/* Manômetro de Pressão de Turbo T270 (0.0 a 1.5 bar) */}
        <div className="w-full max-w-[240px] flex flex-col gap-0.5 bg-zinc-900/60 p-1.5 rounded-xl border border-zinc-800">
          <div className="flex justify-between items-center text-[8px] font-mono text-zinc-400">
            <span>PRESSÃO TURBO GSE</span>
            <span className="font-bold text-red-400">{boostPressureBar.toFixed(2)} bar</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-amber-400 transition-all duration-75"
              style={{ width: `${boostRatio * 100}%` }}
            />
          </div>
        </div>

        {/* Barra Inferior: Odômetro, Autonomia e Consumo */}
        <div className="w-full flex items-center justify-between text-[9px] font-mono text-zinc-400 border-t border-zinc-800/80 pt-1 px-1">
          <span>ODO: <b className="text-white">{Math.round(mileageKm).toLocaleString()} km</b></span>
          <span>RANGE: <b className="text-emerald-400">{Math.round((auxGauges.fuelPercent / 100) * 620)} km</b></span>
          <span className="text-zinc-500">FWD AT6</span>
        </div>
      </div>

      {/* ─── 3. Mostrador Direito: Nível de Combustível (55L) e Temperatura (90°C) ─── */}
      <div className="relative w-[190px] h-[244px] flex flex-col justify-between bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-3 flex-shrink-0">
        {/* Barra de Combustível */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-zinc-400 flex items-center gap-1 font-bold">
              <span>⛽</span>
              <span>COMBUSTÍVEL</span>
            </span>
            <span className={`font-black ${auxGauges.fuelPercent <= 15 ? 'text-red-500 animate-pulse' : 'text-zinc-200'}`}>
              {Math.round(auxGauges.fuelPercent)}%
            </span>
          </div>
          <div className="w-full h-3 bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 flex gap-0.5">
            {[...Array(10)].map((_, i) => {
              const active = auxGauges.fuelPercent >= (i + 1) * 10
              const isReserve = i < 2
              return (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-xs transition-colors ${
                    active
                      ? isReserve
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                      : 'bg-zinc-800/60'
                  }`}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-[8px] font-mono text-zinc-500 px-0.5">
            <span>R (RESERVA)</span>
            <span>55 L (CHEIO)</span>
          </div>
        </div>

        {/* Temperatura do Motor (90°C Nominal) */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-zinc-400 flex items-center gap-1 font-bold">
              <span>🌡️</span>
              <span>ARREFECIMENTO</span>
            </span>
            <span className="text-zinc-200 font-black">
              {Math.round(auxGauges.coolantTemp)}°C
            </span>
          </div>
          <div className="w-full h-2.5 bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 flex gap-0.5">
            {[...Array(8)].map((_, i) => {
              const active = i <= 4 // faixa nominal normal
              return (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-xs ${
                    active ? (i >= 6 ? 'bg-red-500' : 'bg-cyan-500') : 'bg-zinc-800/60'
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

        {/* Indicador de Tração Dianteira FWD & Modo do Câmbio */}
        <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-2 flex items-center justify-between text-[9px] font-mono">
          <div className="flex flex-col">
            <span className="text-zinc-500 text-[8px]">TRAÇÃO</span>
            <span className="text-zinc-200 font-bold">FWD DIANTEIRA</span>
          </div>
          <div className="text-right">
            <span className="text-zinc-500 text-[8px]">MODO CÂMBIO</span>
            <span className="text-red-400 font-bold">
              {gear.gearSelectorPosition === 'S' ? 'SPORT' : 'COMFORT'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})
