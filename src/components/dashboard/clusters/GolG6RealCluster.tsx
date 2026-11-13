import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { mapRange } from '@/utils/math'
import { ClusterIndicatorIcon } from '@/components/gauges'

interface GolG6RealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * GolG6RealCluster — Réplica fiel do quadro de instrumentos do Volkswagen Gol G6 (Trendline / Comfortline / MSI).
 *
 * Características reais da VW:
 * - Aros cromados acetinados nos dois mostradores principais com efeito de profundidade 3D
 * - Tipografia e grafismo oficial VW DIN automotivo
 * - Agulhas vermelhas translúcidas iluminadas com miolo central preto e pino metálico
 * - Display central I-System / Maxi-DOT matriz de pontos vermelho/âmbar característico
 * - Marcadores analógicos integrados de temperatura do líquido de arrefecimento e nível de combustível
 * - Luzes de advertência originais: setas verdes, bateria, óleo, freio de mão, check engine e EPC
 */
export const GolG6RealCluster = memo(function GolG6RealCluster({ telemetry }: GolG6RealClusterProps) {
  const {
    tachometer,
    speedometer,
    gear,
    engine,
    warningLights,
    auxGauges,
    shiftLight,
  } = telemetry

  const size = 260
  const center = size / 2
  const radius = 100
  const startAngle = -215
  const endAngle = 35

  // ── Ângulo do Tacômetro (0 a 7.000 RPM) ──
  const clampedRpm = Math.min(Math.max(tachometer.rpm, 0), 7000)
  const tachAngle = mapRange(clampedRpm, 0, 7000, startAngle, endAngle)

  // ── Ângulo do Velocímetro (0 a 220 km/h) ──
  const clampedSpeed = Math.min(Math.max(speedometer.speed, 0), 220)
  const speedAngle = mapRange(clampedSpeed, 0, 220, startAngle, endAngle)

  // ── Ângulos dos Minis Marcadores Integrados (Temp e Combustível) ──
  // Temp: 50°C (-60°) até 130°C (60°), ideal 90°C (0°)
  const tempAngle = mapRange(auxGauges.coolantTemp, 50, 130, -50, 50)
  // Combustível: 0% (-50°) até 100% (50°)
  const fuelAngle = mapRange(auxGauges.fuelPercent, 0, 100, -50, 50)

  // Marcações do Tacômetro VW (0 a 7 x1000)
  const tachMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isRedzone: boolean }[] = []
    for (let r = 0; r <= 7000; r += 200) {
      const isMajor = r % 1000 === 0
      const isSemiMajor = r % 500 === 0
      const angle = mapRange(r, 0, 7000, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(r / 1000) : '',
        isMajor: isMajor || isSemiMajor,
        isRedzone: r >= 6000,
      })
    }
    return list
  }, [startAngle, endAngle])

  // Marcações do Velocímetro VW (0 a 220 km/h)
  const speedMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean }[] = []
    for (let s = 0; s <= 220; s += 10) {
      const isMajor = s % 20 === 0
      const angle = mapRange(s, 0, 220, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(s) : '',
        isMajor,
      })
    }
    return list
  }, [startAngle, endAngle])

  return (
    <div className="@container relative flex flex-col items-center w-full max-w-4xl p-1.5 sm:p-2.5 rounded-2xl bg-gradient-to-b from-zinc-950 via-zinc-900 to-black border-2 border-zinc-800 shadow-[0_20px_60px_rgba(0,0,0,0.9)] select-none">
      {/* Moldura de topo estilo painel binnacle com textura automotiva */}
      <div className="absolute inset-x-8 top-0 h-1.5 bg-gradient-to-r from-transparent via-zinc-700/60 to-transparent rounded-t-full" />

      {/* ── Fileira Superior: Luzes-Espia Originais VW ── */}
      <div className="flex items-center justify-between w-full max-w-xl px-3 py-0.5 mb-0.5 rounded-xl bg-zinc-950/80 border border-white/5">
        <div className="w-5 h-4 flex items-center justify-center text-emerald-500 font-bold text-xs">
          ◀
        </div>

        {/* 6 Indicadores reais VW */}
        <div className="flex items-center gap-3">
          <ClusterIndicatorIcon kind="battery" active={warningLights.battery} sizeClass="w-3.5 h-3.5" />
          <ClusterIndicatorIcon kind="oil" active={warningLights.oil} sizeClass="w-3.5 h-3.5" />
          <span
            className={`px-1 rounded text-[9.5px] font-mono font-bold transition-opacity duration-150 ${
              warningLights.brake ? 'bg-red-600 text-white opacity-100 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-zinc-800 opacity-30'
            }`}
            title="Freio de Mão"
          >
            (P)
          </span>
          <ClusterIndicatorIcon kind="checkEngine" active={warningLights.checkEngine} sizeClass="w-3.5 h-3.5" />
          <span
            className={`text-[9px] font-mono font-black tracking-tighter px-1 rounded transition-opacity duration-150 ${
              warningLights.checkEngine || engine.status === 'STARTING'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 opacity-100'
                : 'text-zinc-800 opacity-30'
            }`}
            title="EPC"
          >
            EPC
          </span>
          <ClusterIndicatorIcon kind="temp" active={warningLights.temp} sizeClass="w-3.5 h-3.5" />
          {shiftLight.isActive && (
            <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[9px] font-mono font-black animate-pulse">
              SHIFT
            </span>
          )}
        </div>

        <div className="w-5 h-4 flex items-center justify-center text-emerald-500 font-bold text-xs">
          ▶
        </div>
      </div>

      {/* ── Conjunto de Instrumentos: Tacômetro + I-System + Velocímetro ── */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 w-full flex-wrap @[640px]:flex-nowrap">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 1. MOSTRADOR ESQUERDO: TACÔMETRO + MINI TEMP                      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-[248px] sm:w-[264px] drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
          >
            <defs>
              {/* Fundo do mostrador com degradê sutil VW */}
              <radialGradient id="golDialBg" cx="50%" cy="50%" r="50%">
                <stop offset="65%" stopColor="#0a0a0c" />
                <stop offset="90%" stopColor="#141418" />
                <stop offset="98%" stopColor="#222228" />
                <stop offset="100%" stopColor="#3a3a44" />
              </radialGradient>
              {/* Aro cromado acetinado VW */}
              <linearGradient id="golChromeBezel" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e4e4e7" />
                <stop offset="25%" stopColor="#71717a" />
                <stop offset="50%" stopColor="#ffffff" />
                <stop offset="75%" stopColor="#52525b" />
                <stop offset="100%" stopColor="#d4d4d8" />
              </linearGradient>
            </defs>

            {/* Aro externo cromado texturizado */}
            <circle
              cx={center}
              cy={center}
              r={radius + 20}
              fill="none"
              stroke="url(#golChromeBezel)"
              strokeWidth="4.5"
            />
            {/* Sombra de profundidade binnacle */}
            <circle
              cx={center}
              cy={center}
              r={radius + 17}
              fill="url(#golDialBg)"
              stroke="#18181b"
              strokeWidth="2"
            />

            {/* Inscrição "1/min x 1000" característica da VW */}
            <text
              x={center}
              y={center - 36}
              textAnchor="middle"
              className="fill-zinc-400 font-mono text-[9px] tracking-wider uppercase font-semibold"
            >
              1/min x 1000
            </text>

            {/* Arco vermelho de corte (6000 a 7000 RPM) */}
            <path
              d={describeArc(center, center, radius - 6, mapRange(6000, 0, 7000, startAngle, endAngle), endAngle)}
              fill="none"
              stroke="#ef4444"
              strokeWidth="4"
              strokeLinecap="round"
              className="opacity-90"
            />

            {/* Marcações de RPM */}
            {tachMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const innerR = m.isMajor ? radius - 15 : radius - 8
              const outerR = radius - 2
              const x1 = center + innerR * Math.cos(rad)
              const y1 = center + innerR * Math.sin(rad)
              const x2 = center + outerR * Math.cos(rad)
              const y2 = center + outerR * Math.sin(rad)

              // Posição do texto numérico VW
              const textR = radius - 26
              const tx = center + textR * Math.cos(rad)
              const ty = center + textR * Math.sin(rad) + 4

              return (
                <g key={i}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={m.isRedzone ? '#ef4444' : '#fafafa'}
                    strokeWidth={m.isMajor ? 2.2 : 1}
                    opacity={m.isMajor ? 0.95 : 0.45}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      className={`font-mono text-xs font-bold ${
                        m.isRedzone ? 'fill-red-500' : 'fill-white'
                      }`}
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* ── Sub-mostrador Integrado de Temperatura da Água (Inferior) ── */}
            <g transform={`translate(${center}, ${center + 42})`}>
              <circle cx="0" cy="0" r="28" fill="#09090b" stroke="#27272a" strokeWidth="1" />
              <text x="0" y="-12" textAnchor="middle" className="fill-zinc-400 font-mono text-[7px]">
                °C
              </text>
              <text x="-16" y="8" textAnchor="middle" className="fill-zinc-500 font-mono text-[7px]">
                50
              </text>
              <text x="0" y="16" textAnchor="middle" className="fill-zinc-200 font-mono text-[8px] font-bold">
                90
              </text>
              <text x="16" y="8" textAnchor="middle" className="fill-red-400 font-mono text-[7px]">
                130
              </text>
              {/* Agulha de Temperatura */}
              <g transform={`rotate(${tempAngle})`}>
                <line x1="0" y1="0" x2="0" y2="-22" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="0" cy="0" r="3" fill="#18181b" stroke="#71717a" strokeWidth="0.8" />
              </g>
            </g>

            {/* ── Agulha Vermelha Iluminada Principal (Tacômetro) ── */}
            <g transform={`rotate(${tachAngle} ${center} ${center})`}>
              {/* Brilho da agulha translúcida */}
              {/* Brilho da agulha em camada SVG nativa (sem drop-shadow CSS para eliminar flicker) */}
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#ff4444"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.4"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#ff2222"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#ffffff"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.8"
              />
              {/* Rabicho da agulha */}
              <line
                x1={center}
                y1={center}
                x2={center - 20}
                y2={center}
                stroke="#b91c1c"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Miolo central preto com anel cromado VW */}
              <circle cx={center} cy={center} r="13" fill="#141416" stroke="#a1a1aa" strokeWidth="1.5" />
              <circle cx={center} cy={center} r="4" fill="#52525b" />
            </g>
          </svg>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 2. CENTRO: COMPUTADOR DE BORDO I-SYSTEM (MAXI-DOT)                 */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col items-center justify-between w-40 sm:w-48 h-56 p-3 rounded-2xl bg-zinc-950 border-2 border-zinc-800 shadow-[inset_0_2px_12px_rgba(0,0,0,0.9)]">
          {/* Moldura da tela LCD com textura pontilhada */}
          <div className="w-full flex-1 flex flex-col justify-between items-center p-2 rounded-xl bg-gradient-to-b from-[#1a0808] to-[#250b0b] border border-red-950/60 shadow-[inset_0_0_15px_rgba(239,68,68,0.15)] text-red-500 font-mono">
            {/* Topo do LCD: Marcha Atual e Recomendação de Troca VW */}
            <div className="flex items-center justify-between w-full border-b border-red-900/40 pb-1 text-[10px]">
              <span className="text-red-400 font-bold">MARCHA</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-black text-red-400">{gear.label}</span>
                {gear.label !== 'N' && gear.label !== 'R' && tachometer.rpm > 2800 && (
                  <span className="text-[10px] text-red-300 font-bold animate-pulse">▶ {Math.min(5, (parseInt(gear.label, 10) || 1) + 1)}</span>
                )}
              </div>
            </div>

            {/* Centro do LCD: Grande Velocímetro Digital */}
            <div className="flex flex-col items-center my-auto">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-red-400 drop-shadow-[0_0_14px_rgba(239,68,68,0.85)] leading-none">
                {Math.round(speedometer.speed)}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-red-300 font-black mt-1">
                km/h
              </span>
            </div>

            {/* Informações de Viagem (Trip & Consumo VW) */}
            <div className="w-full border-t border-red-900/40 pt-1.5 flex flex-col gap-0.5 text-[9px]">
              <div className="flex justify-between items-center">
                <span className="text-red-400/70">AUTONOMIA</span>
                <span className="font-bold text-red-400">
                  {Math.round(auxGauges.fuelPercent * 6.5)} km
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-400/70">ODO TOTAL</span>
                <span className="font-bold text-red-400">128.450 km</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-400/70">EXTERNA</span>
                <span className="font-bold text-red-400">26.5 °C</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 3. MOSTRADOR DIREITO: VELOCÍMETRO + MINI COMBUSTÍVEL              */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-[248px] sm:w-[264px] drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
          >
            {/* Aro externo cromado */}
            <circle
              cx={center}
              cy={center}
              r={radius + 20}
              fill="none"
              stroke="url(#golChromeBezel)"
              strokeWidth="4.5"
            />
            {/* Fundo do mostrador */}
            <circle
              cx={center}
              cy={center}
              r={radius + 17}
              fill="url(#golDialBg)"
              stroke="#18181b"
              strokeWidth="2"
            />

            {/* Inscrição "km/h" central */}
            <text
              x={center}
              y={center - 36}
              textAnchor="middle"
              className="fill-zinc-400 font-mono text-[10px] tracking-wider uppercase font-semibold"
            >
              km/h
            </text>

            {/* Marcações de Velocidade VW */}
            {speedMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const innerR = m.isMajor ? radius - 15 : radius - 8
              const outerR = radius - 2
              const x1 = center + innerR * Math.cos(rad)
              const y1 = center + innerR * Math.sin(rad)
              const x2 = center + outerR * Math.cos(rad)
              const y2 = center + outerR * Math.sin(rad)

              const textR = radius - 26
              const tx = center + textR * Math.cos(rad)
              const ty = center + textR * Math.sin(rad) + 4

              return (
                <g key={i}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#fafafa"
                    strokeWidth={m.isMajor ? 2.2 : 1}
                    opacity={m.isMajor ? 0.95 : 0.45}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      className="font-mono text-xs font-bold fill-white"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* ── Sub-mostrador Integrado de Nível de Combustível (Inferior) ── */}
            <g transform={`translate(${center}, ${center + 42})`}>
              <circle cx="0" cy="0" r="28" fill="#09090b" stroke="#27272a" strokeWidth="1" />
              <text x="0" y="-12" textAnchor="middle" className="fill-zinc-400 font-mono text-[7px]">
                ⛽ ➔
              </text>
              <text x="-16" y="8" textAnchor="middle" className="fill-red-400 font-mono text-[7px] font-bold">
                0
              </text>
              <text x="0" y="16" textAnchor="middle" className="fill-zinc-200 font-mono text-[8px] font-bold">
                1/2
              </text>
              <text x="16" y="8" textAnchor="middle" className="fill-zinc-200 font-mono text-[7px] font-bold">
                1/1
              </text>
              {/* Agulha de Combustível */}
              <g transform={`rotate(${fuelAngle})`}>
                <line x1="0" y1="0" x2="0" y2="-22" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="0" cy="0" r="3" fill="#18181b" stroke="#71717a" strokeWidth="0.8" />
              </g>
            </g>

            {/* ── Agulha Vermelha Iluminada Principal (Velocímetro) ── */}
            <g transform={`rotate(${speedAngle} ${center} ${center})`}>
              {/* Brilho da agulha em camada SVG nativa (sem drop-shadow CSS para eliminar flicker) */}
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#ff4444"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.4"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#ff2222"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#ffffff"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.8"
              />
              <line
                x1={center}
                y1={center}
                x2={center - 20}
                y2={center}
                stroke="#b91c1c"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="13" fill="#141416" stroke="#a1a1aa" strokeWidth="1.5" />
              <circle cx={center} cy={center} r="4" fill="#52525b" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
})

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(x, y, radius, endAngle)
  const end = polarToCartesian(x, y, radius, startAngle)
  const arcSweep = endAngle - startAngle <= 180 ? '0' : '1'
  return ['M', start.x, start.y, 'A', radius, radius, 0, arcSweep, 0, end.x, end.y].join(' ')
}

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

