import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { mapRange, clamp } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { AMBIENT_COLOR_MAP } from '@/utils/ambientLighting'

interface GolfGTIRealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * GolfGTIRealCluster — Réplica autêntica do quadro de instrumentos do Volkswagen Golf GTI Mk7.
 *
 * Características reais da Volkswagen GTI:
 * - Aros duplos esportivos com acabamento em alumínio acetinado e fundo texturizado preto
 * - Mostrador Esquerdo: Tacômetro 0 a 8.000 RPM (x100/min), linha vermelha aos 6.500 RPM,
 *   com termômetro analógico de água (50°C - 90°C - 130°C) integrado no quadrante inferior
 * - Mostrador Direito: Velocímetro 0 a 280 km/h com marcas vermelhas aos 30 e 50 km/h,
 *   com marcador de combustível analógico (0 - 1/2 - 1/1) integrado no quadrante inferior
 * - Agulhas vermelhas GTI translúcidas iluminadas com miolo central prateado
 * - Display Central Maxi-DOT / MFD Colorido Premium:
 *   - Seletor de Câmbio DSG: P - R - N - D - S com marcha ativa (D1..D6, S1..S6, M1..M6)
 *   - Velocímetro Digital central
 *   - MANÔMETRO DE TURBO OFICIAL VW (LADEDRUCK / BOOST): barra horizontal dinâmica e valor digital em BAR
 *   - Alerta visual de Launch Control (LAUNCH CONTROL AKTIV)
 *   - Temperatura de Óleo (ÖLTEMP) e Odômetro
 * - 100% SVG nativo em camadas sem CSS drop-shadow para eliminar qualquer flicker na GPU.
 */
export const GolfGTIRealCluster = memo(function GolfGTIRealCluster({
  telemetry,
}: GolfGTIRealClusterProps) {
  const {
    tachometer,
    speedometer,
    warningLights,
    auxGauges,
  } = telemetry

  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const gearSelectorPosition = useSimulationStore((s) => s.gearSelectorPosition)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const current0to100 = useSimulationStore((s) => s.current0to100)
  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const ambientTheme = AMBIENT_COLOR_MAP[ambientLightColor] || AMBIENT_COLOR_MAP.red

  const dialSize = 250
  const center = dialSize / 2
  const radius = 90
  const startAngle = -225
  const endAngle = 45

  // 1. Tacômetro (0 a 8.000 RPM)
  const maxRpm = 8000
  const redlineStart = 6500
  const clampedRpm = clamp(tachometer.rpm, 0, maxRpm)
  const rpmNeedleAngle = mapRange(clampedRpm, 0, maxRpm, startAngle, endAngle)

  const rpmMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isRedline: boolean }[] = []
    for (let r = 0; r <= maxRpm; r += 200) {
      const isMajor = r % 1000 === 0
      const isSemiMajor = r % 500 === 0
      const angle = mapRange(r, 0, maxRpm, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(r / 100) : '',
        isMajor: isMajor || isSemiMajor,
        isRedline: r >= redlineStart,
      })
    }
    return list
  }, [maxRpm, redlineStart, startAngle, endAngle])

  // Mini Marcador de Temperatura da Água (50 a 130°C)
  const coolantTemp = auxGauges.coolantTemp || 90
  const coolantAngle = mapRange(clamp(coolantTemp, 50, 130), 50, 130, -50, 50)

  // 2. Velocímetro (0 a 280 km/h)
  const maxSpeed = 280
  const clampedSpeed = clamp(speedometer.speed, 0, maxSpeed)
  const speedNeedleAngle = mapRange(clampedSpeed, 0, maxSpeed, startAngle, endAngle)

  const speedMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isCityLimit: boolean }[] = []
    for (let s = 0; s <= maxSpeed; s += 10) {
      const isMajor = s % 20 === 0
      const angle = mapRange(s, 0, maxSpeed, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(s) : '',
        isMajor,
        isCityLimit: s === 30 || s === 50,
      })
    }
    return list
  }, [maxSpeed, startAngle, endAngle])

  // Mini Marcador de Combustível (0 a 100%)
  const fuelPercent = auxGauges.fuelLevel ?? 80
  const fuelAngle = mapRange(clamp(fuelPercent, 0, 100), 0, 100, 50, -50)

  // Cálculo da barra de Boost no MFD (-1.0 a +1.5 bar)
  const boostPercent = clamp((boostPressureBar + 1.0) / 2.5, 0, 1) * 100
  const isPositiveBoost = boostPressureBar > 0.05

  // Rótulo da marcha DSG
  const dsgModeLabel =
    gearSelectorPosition === 'P' || currentGear === -2
      ? 'P'
      : gearSelectorPosition === 'R' || currentGear === -1
      ? 'R'
      : gearSelectorPosition === 'N' || currentGear === 0
      ? 'N'
      : transmissionMode === 'automatic'
      ? `${gearSelectorPosition === 'S' ? 'S' : 'D'}${currentGear > 0 ? currentGear : 1}`
      : (currentGear === 0 ? 'N' : currentGear === -1 ? 'R' : `M${currentGear}`)

  return (
    <div className={`@container relative flex flex-col items-center w-full max-w-5xl p-1.5 sm:p-2.5 rounded-2xl bg-gradient-to-b from-[#131418] via-[#0d0e12] to-[#060709] border-2 ${ambientTheme.borderClass} ${ambientTheme.shadowClass} select-none transition-all duration-300`}>
      {/* ── Faixa Superior Iluminada com Luz Ambiente da Cabine ── */}
      <div className={`w-full flex items-center justify-between px-3 pb-1 border-b ${ambientTheme.headerBorderClass} text-[9.5px] font-mono`}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: ambientTheme.hex }} />
          <span className="font-black tracking-widest uppercase" style={{ color: ambientTheme.hex }}>GTI · PERFORMANCE</span>
          <span className="text-zinc-500 font-bold hidden sm:inline">2.0 TSI EA888 · DSG DQ250</span>
        </div>

        <div className="flex items-center gap-3">
          {warningLights.brake && (
            <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[8px] font-bold">
              (P) FREIO
            </span>
          )}
          {warningLights.checkEngine && <span className="text-amber-400 text-xs">⚠️</span>}
          {telemetry.tcs.enabled && (
            <span className="text-emerald-400 font-bold text-[8px]">ESP ON</span>
          )}
          <span className="text-zinc-400 font-bold">230 CV · 350 NM</span>
        </div>
      </div>

      {/* ── Banner de Launch Control Ativo ── */}
      {isLaunchControlArmed && (
        <div className="w-full max-w-lg my-1 px-3 py-1 rounded-lg bg-red-600/20 border border-red-500 text-red-300 text-center text-xs font-mono font-black animate-pulse flex items-center justify-center gap-2">
          <span>🏁</span>
          <span>LAUNCH CONTROL AKTIV · SEGURE O FREIO E ACELERE · SOLTE PARA LARGAR!</span>
          <span>🏁</span>
        </div>
      )}
      {isLaunching && (
        <div className="w-full max-w-lg my-1 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-center text-xs font-mono font-black flex items-center justify-center gap-2">
          <span>🚀</span>
          <span>GTI DSG LAUNCH!</span>
          <span>🚀</span>
        </div>
      )}

      {/* ── Conjunto de Instrumentos: Tacômetro + MFD Central + Velocímetro ── */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 w-full flex-wrap @[680px]:flex-nowrap mt-0.5">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 1. MOSTRADOR ESQUERDO: TACÔMETRO GTI (0-80 x100/MIN) + ÁGUA         */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${dialSize} ${dialSize}`} className="w-[230px] sm:w-[250px]">
            <defs>
              <radialGradient id="gtiDialBg" cx="50%" cy="50%" r="50%">
                <stop offset="70%" stopColor="#0b0c10" />
                <stop offset="92%" stopColor="#14151b" />
                <stop offset="98%" stopColor="#22232a" />
                <stop offset="100%" stopColor="#353640" />
              </radialGradient>
              <linearGradient id="gtiRedNeedle" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>

            {/* Aros cromados GTI esportivos com iluminação ambiente sincronizada */}
            <circle cx={center} cy={center} r={radius + 18} fill="none" stroke="#4b5563" strokeWidth="3" />
            <circle cx={center} cy={center} r={radius + 15} fill="url(#gtiDialBg)" stroke={ambientTheme.hex} strokeWidth="2" strokeOpacity="0.75" />

            {/* Inscrição x100/min */}
            <text
              x={center}
              y={center - 32}
              textAnchor="middle"
              className="fill-zinc-400 font-mono text-[9px] tracking-wider font-bold"
            >
              1/min x 100
            </text>

            {/* Faixa vermelha de redline (6.500 a 8.000 RPM) */}
            <path
              d={describeArc(center, center, radius - 6, mapRange(6500, 0, maxRpm, startAngle, endAngle), endAngle)}
              fill="none"
              stroke="#ef4444"
              strokeWidth="5"
              strokeLinecap="round"
            />

            {/* Marcações da escala */}
            {rpmMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const innerR = m.isMajor ? radius - 14 : radius - 8
              const outerR = radius - 2
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
                    stroke={m.isRedline ? '#ef4444' : '#f4f4f5'}
                    strokeWidth={m.isMajor ? 2.2 : 1}
                    opacity={m.isMajor ? 0.95 : 0.4}
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

            {/* ── Mini Mostrador de Temperatura da Água no quadrante inferior ── */}
            <g transform={`translate(${center}, ${center + 44})`}>
              {/* Arco da escala de água */}
              <path
                d={describeArc(0, 0, 24, -50, 50)}
                fill="none"
                stroke="#3f3f46"
                strokeWidth="2"
              />
              <text x="-26" y="6" textAnchor="end" className="fill-zinc-400 font-mono text-[7px] font-bold">50</text>
              <text x="0" y="-12" textAnchor="middle" className="fill-zinc-300 font-mono text-[7px] font-black">90°C</text>
              <text x="26" y="6" textAnchor="start" className="fill-red-400 font-mono text-[7px] font-bold">130</text>
              <text x="0" y="10" textAnchor="middle" className="fill-zinc-500 font-mono text-[6px]">ÁGUA</text>

              {/* Ponteirinho da água */}
              <g transform={`rotate(${coolantAngle})`}>
                <line x1="0" y1="0" x2="0" y2="-20" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                <circle cx="0" cy="0" r="4" fill="#18181b" stroke="#dc2626" strokeWidth="1" />
              </g>
            </g>

            {/* ── Agulha Vermelha Oficial GTI (Camadas SVG nativas) ── */}
            <g transform={`rotate(${rpmNeedleAngle} ${center} ${center})`}>
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#ef4444"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.35"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="url(#gtiRedNeedle)"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center}
                x2={center - 18}
                y2={center}
                stroke="#991b1b"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="12" fill="#1f2026" stroke="#9ca3af" strokeWidth="1.5" />
              <circle cx={center} cy={center} r="4" fill="#dc2626" />
            </g>
          </svg>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 2. CENTRO: TELA MAXI-DOT / MFD COLORIDA COM TURBO BOOST GTI REAL    */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col items-center justify-between w-64 sm:w-72 h-[250px] p-3 rounded-2xl bg-black/95 border-2 border-zinc-700/60 shadow-[inset_0_2px_20px_rgba(0,0,0,0.9)]">
          {/* Topo do MFD: Hora, Temp Externa e Rótulo GTI */}
          <div className="w-full flex justify-between items-center border-b border-white/10 pb-1 text-[9px] font-mono text-zinc-400">
            <span>12:45</span>
            <span className="font-black text-red-500">SPORT HMI</span>
            <span>22.0 °C</span>
          </div>

          {/* Seletor DSG: P R N D S / M com marcha ativa em destaque */}
          <div className="flex items-center gap-2 py-0.5 px-3 rounded-full bg-zinc-900 border border-white/10 text-[10px] font-mono">
            <span className="text-zinc-500 font-bold">DSG:</span>
            <span className="px-2 py-0.5 rounded bg-red-600 text-white font-black text-xs shadow-md">
              {dsgModeLabel}
            </span>
            <span className="text-zinc-500 text-[8px] uppercase">{drivingMode}</span>
          </div>

          {/* Velocidade Digital Central */}
          <div className="flex flex-col items-center my-auto">
            <span className="text-5xl sm:text-6xl font-mono font-black text-white tracking-tight leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
              {Math.round(speedometer.speed)}
            </span>
            <span className="text-[10px] font-mono text-zinc-300 uppercase tracking-widest font-bold mt-0.5">
              KM / H
            </span>
          </div>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* MANÔMETRO OFICIAL DE PRESSÃO DO TURBO VW GTI (LADEDRUCK / BOOST)  */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <div className="w-full flex flex-col items-center p-2 rounded-xl bg-zinc-900/90 border border-white/10 my-1">
            <div className="w-full flex justify-between items-center text-[9px] font-mono mb-1">
              <span className="font-bold text-red-400 flex items-center gap-1">
                <span>⚡</span>
                <span>LADEDRUCK · TURBO</span>
              </span>
              <strong className={`font-mono text-xs font-black ${isPositiveBoost ? 'text-emerald-400' : 'text-sky-400'}`}>
                {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR
              </strong>
            </div>

            {/* Barra Gráfica Horizontal de Boost (-1.0 a +1.5 BAR) */}
            <div className="w-full h-2.5 bg-zinc-950 rounded-full border border-white/10 overflow-hidden relative">
              {/* Marca de 0.0 bar (atmosférico) no meio (40%) */}
              <div className="absolute left-[40%] inset-y-0 w-0.5 bg-white/40 z-10" />

              <div
                className={`h-full transition-all duration-75 ${
                  boostPressureBar > 1.2
                    ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500'
                    : boostPressureBar > 0
                    ? 'bg-gradient-to-r from-sky-400 to-emerald-400'
                    : 'bg-sky-500/70'
                }`}
                style={{ width: `${boostPercent}%` }}
              />
            </div>

            <div className="w-full flex justify-between items-center text-[7px] font-mono text-zinc-500 mt-1">
              <span>-1.0 VAC</span>
              <span>0.0 ATM</span>
              <span>+1.5 BOOST</span>
              {peakBoostBar > 0.1 && (
                <span className="text-amber-400 font-bold">PEAK +{peakBoostBar.toFixed(2)}</span>
              )}
            </div>
          </div>

          {/* Rodapé MFD: Temperatura do Óleo e Odômetro */}
          <div className="w-full flex justify-between items-center border-t border-white/10 pt-1 text-[8px] font-mono text-zinc-400">
            <span>ÖLTEMP: <strong className="text-white">92°C</strong></span>
            <span className="text-zinc-500">TRIP 142.8 KM</span>
            <span>0-100: <strong className="text-amber-400">{current0to100 ? `${current0to100.toFixed(2)}s` : '--'}</strong></span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 3. MOSTRADOR DIREITO: VELOCÍMETRO GTI (0-280 KM/H) + COMBUSTÍVEL    */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${dialSize} ${dialSize}`} className="w-[230px] sm:w-[250px]">
            {/* Aros cromados esportivos com iluminação ambiente sincronizada */}
            <circle cx={center} cy={center} r={radius + 18} fill="none" stroke="#4b5563" strokeWidth="3" />
            <circle cx={center} cy={center} r={radius + 15} fill="url(#gtiDialBg)" stroke={ambientTheme.hex} strokeWidth="2" strokeOpacity="0.75" />

            {/* Inscrição "km/h" */}
            <text
              x={center}
              y={center - 32}
              textAnchor="middle"
              className="fill-zinc-400 font-mono text-[9px] tracking-widest font-black uppercase"
            >
              km / h
            </text>

            {/* Marcações de velocidade */}
            {speedMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const innerR = m.isMajor ? radius - 14 : radius - 8
              const outerR = radius - 2
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
                    stroke={m.isCityLimit ? '#ef4444' : '#fafafa'}
                    strokeWidth={m.isMajor ? 2.2 : 1}
                    opacity={m.isMajor ? 0.95 : 0.4}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      className={`font-mono text-[10px] font-black ${
                        m.isCityLimit ? 'fill-red-400' : 'fill-white'
                      }`}
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* ── Mini Mostrador de Combustível no quadrante inferior ── */}
            <g transform={`translate(${center}, ${center + 44})`}>
              <path
                d={describeArc(0, 0, 24, -50, 50)}
                fill="none"
                stroke="#3f3f46"
                strokeWidth="2"
              />
              <text x="-26" y="6" textAnchor="end" className="fill-red-400 font-mono text-[7px] font-bold">R</text>
              <text x="0" y="-12" textAnchor="middle" className="fill-zinc-300 font-mono text-[7px] font-black">1/2</text>
              <text x="26" y="6" textAnchor="start" className="fill-zinc-400 font-mono text-[7px] font-bold">1/1</text>
              <text x="0" y="10" textAnchor="middle" className="fill-zinc-500 font-mono text-[6px]">GASOLINA</text>

              {/* Ponteirinho do combustível */}
              <g transform={`rotate(${fuelAngle})`}>
                <line x1="0" y1="0" x2="0" y2="-20" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                <circle cx="0" cy="0" r="4" fill="#18181b" stroke="#dc2626" strokeWidth="1" />
              </g>
            </g>

            {/* ── Agulha Vermelha de Velocidade GTI (Camadas SVG nativas) ── */}
            <g transform={`rotate(${speedNeedleAngle} ${center} ${center})`}>
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#ef4444"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.35"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="url(#gtiRedNeedle)"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center}
                x2={center - 18}
                y2={center}
                stroke="#991b1b"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="12" fill="#1f2026" stroke="#9ca3af" strokeWidth="1.5" />
              <circle cx={center} cy={center} r="4" fill="#dc2626" />
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
