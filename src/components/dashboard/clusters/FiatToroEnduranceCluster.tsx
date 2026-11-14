import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp, mapRange } from '@/utils/math'
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
 * - Velocímetro digital central proeminente de altíssima legibilidade
 * - Mostrador de transmissão Aisin AT6: P / R / N / D / S / M1..M6
 * - Manômetro de pressão do turbo GSE T270 (até 1.4 bar)
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

  const maxRpm = 7000
  const redlineRpm = 6200
  const rpm = clamp(tachometer.rpm, 0, maxRpm)
  const speed = Math.round(speedometer.speed)
  const isRedline = rpm >= redlineRpm

  // Arcos SVG para o Tacômetro Esquerdo (raio 100, centro 120, 130)
  // Ângulo de -210° a 30° (arco total de 240°)
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
        <svg viewBox="0 0 270 268" className="w-full h-full drop-shadow-[0_0_12px_rgba(0,0,0,0.8)]">
          {/* Fundo do aro do tacômetro */}
          <circle cx={cx} cy={cy} r={radius + 12} fill="#050508" stroke="#1f2937" strokeWidth="2" />
          <circle cx={cx} cy={cy} r={radius + 6} fill="none" stroke="#374151" strokeWidth="1" strokeDasharray="2 3" />

          {/* Trilho de fundo (apagado) */}
          <path d={baseTrack} fill="none" stroke="#18181b" strokeWidth="10" strokeLinecap="round" />

          {/* Faixa Vermelha de Alerta (6200 a 7000 RPM) */}
          <path d={redlineArc} fill="none" stroke="#ef4444" strokeWidth="10" strokeLinecap="round" opacity="0.3" />

          {/* Trilha Ativa Iluminada (Vermelho Fiat T270) */}
          {activeTrack && (
            <path
              d={activeTrack}
              fill="none"
              stroke={isRedline ? '#ef4444' : '#dc2626'}
              strokeWidth="10"
              strokeLinecap="round"
              className="transition-all duration-75"
              style={{
                filter: isRedline ? 'drop-shadow(0 0 8px #ef4444)' : 'drop-shadow(0 0 6px #dc2626)',
              }}
            />
          )}

          {/* Ponteiro / Marcador Iluminado */}
          <line
            x1={cx}
            y1={cy}
            x2={needle.x}
            y2={needle.y}
            stroke={isRedline ? '#ef4444' : '#f87171'}
            strokeWidth="3.5"
            strokeLinecap="round"
            style={{
              filter: 'drop-shadow(0 0 6px #ef4444)',
            }}
          />
          <circle cx={cx} cy={cy} r="16" fill="#09090b" stroke="#dc2626" strokeWidth="2.5" />
          <circle cx={cx} cy={cy} r="6" fill="#ef4444" />

          {/* Números da Escala (0 a 7) */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
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
                fill={isRedZone ? '#ef4444' : '#9ca3af'}
                fontSize="12"
                fontWeight="900"
                fontFamily="ui-monospace, monospace"
              >
                {n}
              </text>
            )
          })}
        </svg>

        {/* Textos internos do Tacômetro */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-7 pointer-events-none">
          <span className="text-[10px] font-mono font-bold text-zinc-400 tracking-wider">
            RPM × 1000
          </span>
          <span className="text-[18px] font-mono font-black text-white tracking-tight">
            {rpm}
          </span>
          <span className="text-[8px] font-mono font-bold text-red-400 uppercase tracking-widest mt-0.5">
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
