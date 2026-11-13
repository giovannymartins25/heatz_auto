import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { mapRange } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { AMBIENT_COLOR_MAP } from '@/utils/ambientLighting'

interface ToyotaYarisRealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * ToyotaYarisRealCluster — Réplica fiel do painel Optitron 3D do Toyota Yaris XLS (Hatch/Sedan).
 *
 * Características reais da Toyota:
 * - 3 cilindros individuais com iluminação ambiente Optitron azul/ciano gelo (Ice Blue Halo)
 * - Mostrador central de velocidade aumentado com aro acetinado e mostrador de posição de câmbio (P-R-N-D / M1-M7)
 * - Tela colorida TFT de 4.2" à direita (Multi-Information Display) com:
 *   - Eco Driving Bar dinâmico que premia aceleração suave com selo verde "ECO"
 *   - Marcador digital de nível de combustível com autonomia em km e seta indicando o bocal à esquerda ◀⛽
 *   - Indicador de temperatura digital (C ... H)
 *   - Modo de condução selecionado (ECO MODE verde / NORMAL ciano / SPORT vermelho)
 * - Agulhas iluminadas em tom azul óptico com ponta branca de alta visibilidade
 */
export const ToyotaYarisRealCluster = memo(function ToyotaYarisRealCluster({
  telemetry,
}: ToyotaYarisRealClusterProps) {
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
  const radius = 98
  const startAngle = -215
  const endAngle = 35

  // ── Ângulo do Tacômetro (0 a 8.000 RPM) ──
  const clampedRpm = Math.min(Math.max(tachometer.rpm, 0), 8000)
  const tachAngle = mapRange(clampedRpm, 0, 8000, startAngle, endAngle)

  // ── Ângulo do Velocímetro Central (0 a 220 km/h) ──
  const clampedSpeed = Math.min(Math.max(speedometer.speed, 0), 220)
  const speedAngle = mapRange(clampedSpeed, 0, 220, startAngle, endAngle)

  // Barra de condução Eco da Toyota (0 a 100% de suavidade no acelerador)
  // Se acelerando muito (> 60%), sai do Eco e vai pra PWR
  const ecoPercent = Math.max(0, Math.min(100, Math.round((clampedRpm / 3500) * 100)))
  const isEcoActive = clampedRpm > 0 && clampedRpm < 2600 && engine.status === 'RUNNING'

  // Marcações do Tacômetro Toyota Optitron (0 a 8)
  const tachMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isRedzone: boolean }[] = []
    for (let r = 0; r <= 8000; r += 200) {
      const isMajor = r % 1000 === 0
      const isSemiMajor = r % 500 === 0
      const angle = mapRange(r, 0, 8000, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(r / 1000) : '',
        isMajor: isMajor || isSemiMajor,
        isRedzone: r >= 6200,
      })
    }
    return list
  }, [startAngle, endAngle])

  // Marcações do Velocímetro Central Toyota
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

  // Posição do Câmbio Automático Multidrive Toyota
  const isManualSimulated = gear.transmissionMode === 'manual_simulated'
  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const ambientTheme = AMBIENT_COLOR_MAP[ambientLightColor] || AMBIENT_COLOR_MAP.cyan

  return (
    <div className={`@container relative flex flex-col items-center w-full max-w-4xl p-4 sm:p-6 rounded-[2.5rem] bg-gradient-to-b from-[#060d16] via-[#03070d] to-black border-2 ${ambientTheme.borderClass} ${ambientTheme.shadowClass} select-none transition-all duration-300`}>
      {/* Luz ambiente de fundo Optitron sincronizada */}
      <div
        className={`absolute inset-x-12 top-0 h-1 bg-gradient-to-r ${ambientTheme.haloGradient} rounded-t-full`}
        style={{ boxShadow: `0 0 20px ${ambientTheme.glowRgba}` }}
      />

      {/* ── Faixa Superior: Luzes de Advertência e Farol ── */}
      <div className="flex items-center justify-between w-full max-w-xl px-4 py-1.5 mb-2 rounded-xl bg-sky-950/20 border border-sky-500/10">
        <div className="w-5 h-5 flex items-center justify-center text-emerald-400 font-bold text-sm">
          ◀
        </div>

        <div className="flex items-center gap-3">
          {/* Farol Baixo / Lanterna Verde */}
          <span className="text-emerald-400 text-xs" title="Luzes de Posição">
            💡
          </span>
          {/* Cinto de Segurança */}
          <span className="text-red-500 text-xs" title="Cinto de Segurança">
            👤
          </span>
          {/* Freio de Mão */}
          <span
            className={`px-1 rounded text-[10px] font-mono font-bold transition-opacity duration-150 ${
              warningLights.brake ? 'bg-red-600 text-white opacity-100 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-zinc-800 opacity-30'
            }`}
          >
            (P)
          </span>
          {/* TCS / VSC */}
          <span
            className={`text-xs transition-opacity duration-150 ${
              warningLights.tcsFlash ? 'text-amber-400 animate-ping' : warningLights.tcs ? 'text-amber-400 opacity-100' : 'text-zinc-800 opacity-30'
            }`}
          >
            🚗💨
          </span>
          {/* Check Engine */}
          <span
            className={`text-xs transition-opacity duration-150 ${
              warningLights.checkEngine ? 'text-amber-400 opacity-100' : 'text-zinc-800 opacity-30'
            }`}
          >
            ⚠️
          </span>
          {shiftLight.isActive && (
            <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[9px] font-mono font-black animate-pulse">
              REDLINE
            </span>
          )}
        </div>

        <div className="w-5 h-5 flex items-center justify-center text-emerald-400 font-bold text-sm">
          ▶
        </div>
      </div>

      {/* ── Conjunto de 3 Cilíndros Optitron 3D da Toyota ── */}
      <div className="flex items-center justify-center gap-3 sm:gap-6 w-full flex-wrap @[640px]:flex-nowrap">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 1. CILINDRO ESQUERDO: TACÔMETRO OPTITRON                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-[230px] sm:w-[250px] drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
          >
            <defs>
              <radialGradient id="yarisTachBg" cx="50%" cy="50%" r="50%">
                <stop offset="60%" stopColor="#020810" />
                <stop offset="85%" stopColor="#081424" />
                <stop offset="98%" stopColor="#0f253e" />
                <stop offset="100%" stopColor="#0284c7" />
              </radialGradient>
              {/* Anel Optitron Cyan Halo */}
              <linearGradient id="optitronCyanRing" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#00f2fe" />
              </linearGradient>
            </defs>

            {/* Aro externo Optitron com halo de iluminação ciano */}
            <circle
              cx={center}
              cy={center}
              r={radius + 18}
              fill="none"
              stroke="url(#optitronCyanRing)"
              strokeWidth="2.5"
              className="drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]"
            />
            {/* Fundo escuro azulado Optitron */}
            <circle
              cx={center}
              cy={center}
              r={radius + 15}
              fill="url(#yarisTachBg)"
              stroke="#0f172a"
              strokeWidth="2"
            />

            {/* Inscrição x1000r/min típica da Toyota */}
            <text
              x={center}
              y={center - 32}
              textAnchor="middle"
              className="fill-sky-400/80 font-mono text-[9px] tracking-wider uppercase font-semibold"
            >
              x1000 r/min
            </text>

            {/* Faixa vermelha de redline (6200 a 8000 RPM) */}
            <path
              d={describeArc(center, center, radius - 5, mapRange(6200, 0, 8000, startAngle, endAngle), endAngle)}
              fill="none"
              stroke="#ef4444"
              strokeWidth="4"
              strokeLinecap="round"
              className="drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]"
            />

            {/* Marcações do Tacômetro */}
            {tachMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const innerR = m.isMajor ? radius - 14 : radius - 7
              const outerR = radius - 1
              const x1 = center + innerR * Math.cos(rad)
              const y1 = center + innerR * Math.sin(rad)
              const x2 = center + outerR * Math.cos(rad)
              const y2 = center + outerR * Math.sin(rad)

              const textR = radius - 24
              const tx = center + textR * Math.cos(rad)
              const ty = center + textR * Math.sin(rad) + 4

              return (
                <g key={i}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={m.isRedzone ? '#ef4444' : '#e0f2fe'}
                    strokeWidth={m.isMajor ? 2.2 : 1}
                    opacity={m.isMajor ? 0.95 : 0.45}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      className={`font-sans text-xs font-bold ${
                        m.isRedzone ? 'fill-red-400' : 'fill-sky-100'
                      }`}
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* ── Agulha Optitron Azul Gelo com Ponta Branca ── */}
            <g transform={`rotate(${tachAngle} ${center} ${center})`}>
              {/* Brilho da agulha em camada SVG nativa (sem drop-shadow CSS para evitar flicker) */}
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#38bdf8"
                strokeWidth="5.5"
                strokeLinecap="round"
                opacity="0.35"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#38bdf8"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <line
                x1={center + radius - 24}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#ffffff"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center}
                x2={center - 18}
                y2={center}
                stroke="#0284c7"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="12" fill="#030712" stroke="#38bdf8" strokeWidth="1.5" />
              <circle cx={center} cy={center} r="4" fill="#0284c7" />
            </g>
          </svg>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 2. CILINDRO CENTRAL: VELOCÍMETRO + GATE DE CÂMBIO AUTOMÁTICO       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-[250px] sm:w-[270px] drop-shadow-[0_12px_30px_rgba(0,0,0,0.9)]"
          >
            {/* Aro externo maior com moldura acetinada prateada */}
            <circle
              cx={center}
              cy={center}
              r={radius + 20}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="4"
              className="drop-shadow-[0_0_8px_rgba(148,163,184,0.4)]"
            />
            {/* Halo ciano Optitron interno */}
            <circle
              cx={center}
              cy={center}
              r={radius + 16}
              fill="url(#yarisTachBg)"
              stroke="#0284c7"
              strokeWidth="1.5"
            />

            {/* Inscrição "km/h" central */}
            <text
              x={center}
              y={center - 36}
              textAnchor="middle"
              className="fill-sky-200 font-sans text-xs tracking-wider uppercase font-black"
            >
              km/h
            </text>

            {/* Marcações de Velocidade */}
            {speedMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const innerR = m.isMajor ? radius - 15 : radius - 8
              const outerR = radius - 1
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
                    stroke="#e0f2fe"
                    strokeWidth={m.isMajor ? 2.4 : 1}
                    opacity={m.isMajor ? 0.95 : 0.45}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      className="font-sans text-[13px] font-black fill-white drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* ── Display Inferior Integrado: P-R-N-D e Temperatura Externa ── */}
            <g transform={`translate(${center}, ${center + 44})`}>
              <rect
                x="-54"
                y="-14"
                width="108"
                height="28"
                rx="6"
                fill="#030712"
                stroke="#0284c7"
                strokeWidth="1"
              />
              {/* Gate de Marchas Automático Multidrive Toyota */}
              <text x="-40" y="3" className={`font-mono text-[9px] font-bold ${gear.label === 'P' ? 'fill-amber-400 font-black' : 'fill-zinc-600'}`}>
                P
              </text>
              <text x="-24" y="3" className={`font-mono text-[9px] font-bold ${gear.isReverse ? 'fill-red-400 font-black' : 'fill-zinc-600'}`}>
                R
              </text>
              <text x="-8" y="3" className={`font-mono text-[9px] font-bold ${gear.isNeutral ? 'fill-emerald-400 font-black' : 'fill-zinc-600'}`}>
                N
              </text>
              <text x="8" y="3" className={`font-mono text-[9px] font-bold ${!gear.isNeutral && !gear.isReverse && !isManualSimulated ? 'fill-cyan-400 font-black' : 'fill-zinc-600'}`}>
                D
              </text>
              <text x="26" y="3" className={`font-mono text-[9px] font-bold ${isManualSimulated ? 'fill-cyan-400 font-black' : 'fill-zinc-600'}`}>
                {isManualSimulated ? gear.label : 'M'}
              </text>

              <text x="0" y="11" textAnchor="middle" className="fill-zinc-400 font-mono text-[7px]">
                EXT 27°C · 14:35
              </text>
            </g>

            {/* ── Agulha Optitron do Velocímetro ── */}
            <g transform={`rotate(${speedAngle} ${center} ${center})`}>
              {/* Brilho da agulha em camada SVG nativa (sem drop-shadow CSS para evitar flicker) */}
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#38bdf8"
                strokeWidth="5.5"
                strokeLinecap="round"
                opacity="0.35"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#38bdf8"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <line
                x1={center + radius - 24}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#ffffff"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center}
                x2={center - 18}
                y2={center}
                stroke="#0284c7"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="12" fill="#030712" stroke="#38bdf8" strokeWidth="1.5" />
              <circle cx={center} cy={center} r="4" fill="#0284c7" />
            </g>
          </svg>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 3. CILINDRO DIREITO: DISPLAY TFT COLORIDO 4.2" (TOYOTA MID)        */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center justify-between w-48 sm:w-54 h-58 p-3 rounded-2xl bg-zinc-950 border-2 border-sky-900/60 shadow-[inset_0_2px_15px_rgba(0,0,0,0.9),0_0_20px_rgba(56,189,248,0.1)]">
          {/* Tela TFT de Alta Resolução da Toyota */}
          <div className="w-full flex-1 flex flex-col justify-between p-2.5 rounded-xl bg-gradient-to-b from-[#021020] via-[#05182e] to-[#010811] border border-cyan-500/20 shadow-[inset_0_0_20px_rgba(6,182,212,0.12)]">
            {/* Topo do TFT: Modo de Condução e Selo ECO */}
            <div className="flex items-center justify-between w-full border-b border-sky-800/40 pb-1.5">
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  gear.drivingMode === 'eco'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : gear.drivingMode === 'sport'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                }`}
              >
                {gear.drivingMode === 'eco' ? 'ECO MODE' : gear.drivingMode === 'sport' ? 'SPORT' : 'NORMAL'}
              </span>

              {/* Selo Verde ECO Indicator Toyota */}
              <span
                className={`text-[9px] font-sans font-black px-1 rounded flex items-center gap-1 transition-all ${
                  isEcoActive ? 'text-emerald-400 opacity-100 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'text-zinc-600 opacity-40'
                }`}
              >
                🌱 ECO
              </span>
            </div>

            {/* Barra Gráfica Eco Driving Bar da Toyota */}
            <div className="w-full my-1.5">
              <div className="flex justify-between text-[7px] font-mono text-zinc-400 mb-0.5">
                <span className="text-emerald-400 font-bold">ECO</span>
                <span>PWR</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-900 border border-white/10 overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-100 ${
                    ecoPercent > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, ecoPercent)}%` }}
                />
              </div>
            </div>

            {/* Marcadores Digitais Verticais: Combustível e Arrefecimento */}
            <div className="grid grid-cols-2 gap-2 my-auto">
              {/* Nível de Combustível com seta do bocal à esquerda ◀⛽ */}
              <div className="flex flex-col bg-sky-950/40 rounded-lg p-1.5 border border-sky-800/20">
                <div className="flex justify-between items-center text-[8px] font-mono text-sky-300">
                  <span>◀ ⛽</span>
                  <span className="font-bold">{Math.round(auxGauges.fuelPercent)}%</span>
                </div>
                {/* Barra de Combustível */}
                <div className="w-full h-1.5 bg-zinc-900 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all"
                    style={{ width: `${auxGauges.fuelPercent}%` }}
                  />
                </div>
                <span className="text-[7px] font-mono text-zinc-400 mt-1">
                  Auton: {Math.round(auxGauges.fuelPercent * 6.8)} km
                </span>
              </div>

              {/* Temperatura do Motor (C ... H) */}
              <div className="flex flex-col bg-sky-950/40 rounded-lg p-1.5 border border-sky-800/20">
                <div className="flex justify-between items-center text-[8px] font-mono text-sky-300">
                  <span>🌡️</span>
                  <span className="font-bold">{Math.round(auxGauges.coolantTemp)}°C</span>
                </div>
                {/* Barra de Temp */}
                <div className="w-full h-1.5 bg-zinc-900 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(10, ((auxGauges.coolantTemp - 50) / 80) * 100),
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-[7px] font-mono text-zinc-400 mt-1">
                  {auxGauges.isTempOptimal ? 'Ideal (90°C)' : 'Aquecendo'}
                </span>
              </div>
            </div>

            {/* Consumo Instantâneo Toyota (km/L) */}
            <div className="flex justify-between items-center border-t border-sky-800/40 pt-1 text-[9px] font-mono">
              <span className="text-zinc-400">Consumo médio:</span>
              <span className="font-bold text-sky-200">14.6 km/L</span>
            </div>
          </div>

          <span className="text-[8px] font-mono tracking-widest text-sky-700 uppercase mt-1">
            TOYOTA OPTITRON
          </span>
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

