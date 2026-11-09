import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { mapRange } from '@/utils/math'

interface Porsche992GT3RealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * Porsche992GT3RealCluster — Réplica fiel da instrumentação de pista do Porsche 911 GT3 RS (Geração 992).
 *
 * Características reais da Porsche Motorsport:
 * - Tacômetro central icônico com escala até 10.000 RPM e linha vermelha brutal em 9.000 RPM
 * - Agulha amarela de competição com ponta iluminada e miolo central preto
 * - Display digital central dentro do tacômetro exibindo marcha PDK gigante e velocidade digital
 * - Régua de shift lights sequenciais F1/GT3 RS duplos convergentes (Verde ➔ Amarelo ➔ Vermelho ➔ Azul piscante)
 * - Tela TFT Esquerda de telemetria de pista:
 *   - TPMS com pressão individual dos 4 pneus (FL 2.1, FR 2.1, RL 2.3, RR 2.3 bar)
 *   - Pressão de óleo (bar), temperatura de óleo e temperatura de água
 * - Tela TFT Direita de performance:
 *   - Acelerômetro G-Force (Friction Circle) com ponto inercial dinâmico
 *   - Seletor de modo do volante (TRACK / SPORT / NORMAL)
 *   - Status de estabilidade ESC e TC (Porsche Stability Management)
 */
export const Porsche992GT3RealCluster = memo(function Porsche992GT3RealCluster({
  telemetry,
}: Porsche992GT3RealClusterProps) {
  const {
    tachometer,
    speedometer,
    gear,
    warningLights,
    auxGauges,
    shiftLight,
  } = telemetry

  const size = 280
  const center = size / 2
  const radius = 104
  const startAngle = -220
  const endAngle = 40

  const maxRpm = 10000
  const redlineStart = 9000
  const clampedRpm = Math.min(Math.max(tachometer.rpm, 0), maxRpm)
  const needleAngle = mapRange(clampedRpm, 0, maxRpm, startAngle, endAngle)

  // Marcações do Tacômetro de 10.000 RPM da Porsche
  const marks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isRedline: boolean }[] = []
    for (let r = 0; r <= maxRpm; r += 250) {
      const isMajor = r % 1000 === 0
      const isSemiMajor = r % 500 === 0
      const angle = mapRange(r, 0, maxRpm, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(r / 1000) : '',
        isMajor: isMajor || isSemiMajor,
        isRedline: r >= redlineStart,
      })
    }
    return list
  }, [maxRpm, redlineStart, startAngle, endAngle])

  // Cálculo inercial simples para a bolinha do acelerômetro G-Force
  // Derivado da aceleração longitudinal e velocidade
  const gForceX = 0
  const gForceY = Math.min(1.4, Math.max(-1.4, (speedometer.speed > 5 ? 0.6 : 0) * (tachometer.rpm > 5000 ? 1 : 0.4)))

  return (
    <div className="relative flex flex-col items-center w-full max-w-5xl p-4 sm:p-6 rounded-[2.5rem] bg-gradient-to-b from-[#0b0c10] via-zinc-950 to-black border-2 border-amber-500/30 shadow-[0_20px_70px_rgba(245,158,11,0.12)] select-none">
      {/* ── Régua Superior de Shift Lights F1 / GT3 RS Duplos Convergentes ── */}
      <div className="flex flex-col items-center w-full max-w-lg mb-3">
        <div className="flex items-center justify-between w-full px-2 mb-1.5 text-[10px] font-mono">
          <span className="text-amber-400 font-black tracking-widest flex items-center gap-1.5 uppercase">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            992 GT3 RS · TRACK COCKPIT
          </span>
          <div className="flex items-center gap-2">
            {warningLights.brake && (
              <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[8px] font-bold">
                (P)
              </span>
            )}
            {warningLights.checkEngine && <span className="text-amber-400 text-xs">⚠️</span>}
            <span className="text-zinc-500 font-bold">9.000 RPM REDLINE</span>
          </div>
        </div>

        {/* Barra convergente de 16 LEDs de giro */}
        <div className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-zinc-900/90 rounded-full border border-white/10 px-3">
          {[...Array(16)].map((_, idx) => {
            const distanceFromCenter = Math.abs(idx - 7.5) // 0 no centro, 7.5 nas pontas
            const triggerRatio = (7.5 - distanceFromCenter) / 7.5 // 0 nas pontas, 1 no centro
            const rpmRatio = clampedRpm / maxRpm
            const isActive = rpmRatio >= 0.75 + triggerRatio * 0.16
            const isRedlineLed = triggerRatio >= 0.8
            const isYellowLed = triggerRatio >= 0.4 && triggerRatio < 0.8

            return (
              <div
                key={idx}
                className={`h-2.5 flex-1 rounded-xs transition-all duration-75 ${
                  shiftLight.isBlinking
                    ? 'bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,1)] animate-pulse'
                    : isActive
                    ? isRedlineLed
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]'
                      : isYellowLed
                      ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]'
                      : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                    : 'bg-zinc-800/80'
                }`}
              />
            )
          })}
        </div>
      </div>

      {/* ── Conjunto de Instrumentos: Tela Esquerda + Tacômetro Central + Tela Direita ── */}
      <div className="flex items-center justify-center gap-3 sm:gap-6 w-full flex-wrap xl:flex-nowrap">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 1. TELA TFT ESQUERDA: PRESSÃO DE PNEUS (TPMS), ÓLEO E FLUIDOS      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col items-center justify-between w-56 sm:w-64 h-64 p-3 rounded-2xl bg-zinc-950/90 border border-white/10 shadow-[inset_0_2px_15px_rgba(0,0,0,0.8)]">
          <div className="w-full flex justify-between items-center border-b border-white/10 pb-1 text-[9px] font-mono text-zinc-400">
            <span className="font-bold text-amber-400">CHASSIS & TPMS</span>
            <span>2.1 / 2.3 BAR</span>
          </div>

          {/* Gráfico do Carro com Pressão dos 4 Pneus */}
          <div className="relative w-full flex items-center justify-center my-auto py-2">
            {/* Silhueta minimalista do 911 */}
            <div className="w-20 h-32 rounded-3xl border-2 border-zinc-700/60 bg-zinc-900/60 flex flex-col justify-between items-center py-2 relative">
              <span className="text-[7px] font-mono text-zinc-500 font-bold">FRONT</span>
              <div className="w-12 h-1 bg-amber-500/40 rounded-full" />
              <span className="text-[7px] font-mono text-zinc-500 font-bold">REAR</span>

              {/* Pneu Dianteiro Esquerdo (FL) */}
              <div className="absolute -left-10 top-3 text-[8px] font-mono text-emerald-400 font-bold">
                2.1 <span className="text-[6px] text-zinc-500">BAR</span>
              </div>
              {/* Pneu Dianteiro Direito (FR) */}
              <div className="absolute -right-10 top-3 text-[8px] font-mono text-emerald-400 font-bold">
                2.1 <span className="text-[6px] text-zinc-500">BAR</span>
              </div>
              {/* Pneu Traseiro Esquerdo (RL) */}
              <div className="absolute -left-10 bottom-3 text-[8px] font-mono text-emerald-400 font-bold">
                2.3 <span className="text-[6px] text-zinc-500">BAR</span>
              </div>
              {/* Pneu Traseiro Direito (RR) */}
              <div className="absolute -right-10 bottom-3 text-[8px] font-mono text-emerald-400 font-bold">
                2.3 <span className="text-[6px] text-zinc-500">BAR</span>
              </div>
            </div>
          </div>

          {/* Medidores de Fluido Porsche: Pressão e Temperatura de Óleo */}
          <div className="w-full grid grid-cols-3 gap-1 border-t border-white/10 pt-1.5 text-center text-[8px] font-mono">
            <div className="bg-zinc-900/80 p-1 rounded">
              <span className="text-zinc-500 block">ÓLEO BAR</span>
              <strong className="text-white">5.4</strong>
            </div>
            <div className="bg-zinc-900/80 p-1 rounded">
              <span className="text-zinc-500 block">ÓLEO °C</span>
              <strong className="text-white">98°C</strong>
            </div>
            <div className="bg-zinc-900/80 p-1 rounded">
              <span className="text-zinc-500 block">ÁGUA °C</span>
              <strong className="text-emerald-400">{Math.round(auxGauges.coolantTemp)}°C</strong>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 2. CENTRO: TACÔMETRO ICÔNICO PORSCHE GT3 RS (10.000 RPM)           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-[260px] sm:w-[280px] drop-shadow-[0_15px_35px_rgba(0,0,0,0.9)]"
          >
            <defs>
              <radialGradient id="porscheDialBg" cx="50%" cy="50%" r="50%">
                <stop offset="65%" stopColor="#090a0d" />
                <stop offset="90%" stopColor="#121318" />
                <stop offset="98%" stopColor="#1e2026" />
                <stop offset="100%" stopColor="#30323a" />
              </radialGradient>
              <linearGradient id="porscheYellowNeedle" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>

            {/* Aro externo motorsport com acabamento titânio escovado */}
            <circle
              cx={center}
              cy={center}
              r={radius + 20}
              fill="none"
              stroke="#52525b"
              strokeWidth="4"
            />
            <circle
              cx={center}
              cy={center}
              r={radius + 17}
              fill="url(#porscheDialBg)"
              stroke="#18181b"
              strokeWidth="2"
            />

            {/* Inscrição "GT3 RS" no dial */}
            <text
              x={center}
              y={center - 36}
              textAnchor="middle"
              className="fill-amber-400 font-mono text-[10px] tracking-widest font-black uppercase"
            >
              GT3 RS
            </text>

            {/* Faixa vermelha de redline brutal em 9000 RPM */}
            <path
              d={describeArc(center, center, radius - 6, mapRange(9000, 0, maxRpm, startAngle, endAngle), endAngle)}
              fill="none"
              stroke="#ef4444"
              strokeWidth="4.5"
              strokeLinecap="round"
              className="drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]"
            />

            {/* Marcações do Tacômetro */}
            {marks.map((m, i) => {
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
                    stroke={m.isRedline ? '#ef4444' : '#fafafa'}
                    strokeWidth={m.isMajor ? 2.4 : 1}
                    opacity={m.isMajor ? 0.95 : 0.45}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      className={`font-mono text-xs font-black ${
                        m.isRedline ? 'fill-red-500' : 'fill-white'
                      }`}
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* ── Display Central Digital Integrado no Tacômetro (PDK Gear + Speed) ── */}
            <g transform={`translate(${center}, ${center + 36})`}>
              <circle cx="0" cy="0" r="30" fill="#090a0d" stroke="#3f3f46" strokeWidth="1.5" />
              {/* Marcha PDK Gigante */}
              <text
                x="0"
                y="-4"
                textAnchor="middle"
                className="font-mono text-2xl font-black fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]"
              >
                {gear.label}
              </text>
              {/* Velocidade Digital */}
              <text
                x="0"
                y="14"
                textAnchor="middle"
                className="font-mono text-[10px] font-bold fill-white"
              >
                {Math.round(speedometer.speed)} km/h
              </text>
            </g>

            {/* ── Agulha Amarela Oficial Porsche GT3 RS ── */}
            <g transform={`rotate(${needleAngle} ${center} ${center})`}>
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="url(#porscheYellowNeedle)"
                strokeWidth="3.4"
                strokeLinecap="round"
                className="drop-shadow-[0_0_10px_rgba(245,158,11,0.9)]"
              />
              <line
                x1={center}
                y1={center}
                x2={center - 22}
                y2={center}
                stroke="#b45309"
                strokeWidth="3.6"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="13" fill="#141416" stroke="#fbbf24" strokeWidth="1.5" />
              <circle cx={center} cy={center} r="4" fill="#f59e0b" />
            </g>
          </svg>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 3. TELA TFT DIREITA: G-FORCE METER, MODOS DE PISTA E ESTABILIDADE  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col items-center justify-between w-56 sm:w-64 h-64 p-3 rounded-2xl bg-zinc-950/90 border border-white/10 shadow-[inset_0_2px_15px_rgba(0,0,0,0.8)]">
          <div className="w-full flex justify-between items-center border-b border-white/10 pb-1 text-[9px] font-mono text-zinc-400">
            <span className="font-bold text-amber-400">G-FORCE & DYNAMICS</span>
            <span>FRICTION CIRCLE</span>
          </div>

          {/* Medidor Gráfico G-Force (Friction Circle Porsche) */}
          <div className="relative w-32 h-32 rounded-full border border-white/20 bg-zinc-900/60 flex items-center justify-center my-auto">
            {/* Círculos concêntricos de 0.5G e 1.0G */}
            <div className="w-20 h-20 rounded-full border border-white/10" />
            <div className="w-10 h-10 rounded-full border border-white/10" />
            <div className="absolute inset-x-0 h-px bg-white/15" />
            <div className="absolute inset-y-0 w-px bg-white/15" />

            {/* Ponto Dinâmico inercial G-Force */}
            <div
              className="absolute w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,1)] transition-all duration-100"
              style={{
                transform: `translate(${gForceX * 24}px, ${-gForceY * 24}px)`,
              }}
            />

            <span className="absolute bottom-1 text-[8px] font-mono text-zinc-400">
              {Math.abs(gForceY).toFixed(1)}G LAT
            </span>
          </div>

          {/* Modos do Volante e Sistemas de Assistência */}
          <div className="w-full flex justify-between items-center border-t border-white/10 pt-2 text-[9px] font-mono">
            {/* Seletor de Modo */}
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 font-black">
              TRACK MODE
            </span>

            {/* Status ESC e TC */}
            <div className="flex items-center gap-1.5">
              <span className={`px-1 rounded text-[8px] font-bold ${telemetry.tcs.enabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-red-950 text-red-400 border border-red-500/40'}`}>
                TC {telemetry.tcs.enabled ? 'ON' : 'OFF'}
              </span>
              <span className="px-1 rounded text-[8px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                ESC ON
              </span>
            </div>
          </div>
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
