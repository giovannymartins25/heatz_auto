import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { mapRange, clamp } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { AMBIENT_COLOR_MAP } from '@/utils/ambientLighting'

interface Porsche992GT3RealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * Porsche992GT3RealCluster — Réplica fiel da instrumentação do Porsche 911 GT3 RS (Geração 992).
 *
 * Características reais da Porsche Motorsport:
 * - Painel Triplo:
 *   1. ESQUERDA: Velocímetro analógico dedicado (0-350 km/h) com agulha amarela de pista e display digital.
 *   2. CENTRO: Tacômetro analógico icônico (0-10.000 RPM) com linha vermelha em 9.000 RPM e indicador de marcha PDK.
 *   3. DIREITA: Tela TFT de Telemetria de Pista (TPMS nos 4 pneus, G-Force Friction Circle, fluidos e modos).
 * - Régua de shift lights sequenciais F1 / GT3 RS duplos convergentes no topo.
 * - Banner visual em tempo real do Porsche Launch Control (ativo / largada).
 * - Sem filtros CSS drop-shadow em elementos de alta frequência para eliminar 100% de flickering na GPU do PC.
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

  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const ambientTheme = AMBIENT_COLOR_MAP[ambientLightColor] || AMBIENT_COLOR_MAP.amber

  const pdkDisplay = transmissionMode === 'automatic'
    ? (currentGear === 0 ? 'N' : currentGear === -1 ? 'R' : drivingMode === 'sport' || drivingMode === 'track' ? `S${currentGear || 1}` : `D${currentGear || 1}`)
    : gear.label

  // Configurações geométricas dos mostradores
  const size = 260
  const center = size / 2
  const radius = 94
  const startAngle = -220
  const endAngle = 40

  // 1. Tacômetro (0 a 10.000 RPM)
  const maxRpm = 10000
  const redlineStart = 9000
  const clampedRpm = Math.min(Math.max(tachometer.rpm, 0), maxRpm)
  const rpmNeedleAngle = mapRange(clampedRpm, 0, maxRpm, startAngle, endAngle)

  const rpmMarks = useMemo(() => {
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

  // 2. Velocímetro (0 a 350 km/h)
  const maxSpeed = 350
  const clampedSpeed = Math.min(Math.max(speedometer.speed, 0), maxSpeed)
  const speedNeedleAngle = mapRange(clampedSpeed, 0, maxSpeed, startAngle, endAngle)

  const speedMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean }[] = []
    for (let s = 0; s <= maxSpeed; s += 10) {
      const isMajor = s % 50 === 0
      const isSemiMajor = s % 25 === 0
      const angle = mapRange(s, 0, maxSpeed, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(s) : '',
        isMajor: isMajor || isSemiMajor,
      })
    }
    return list
  }, [maxSpeed, startAngle, endAngle])

  // 3. Acelerômetro G-Force
  const gForceX = 0
  const gForceY = Math.min(1.4, Math.max(-1.4, (speedometer.speed > 5 ? 0.6 : 0) * (tachometer.rpm > 5000 ? 1 : 0.4)))

  return (
    <div className={`relative flex flex-col items-center w-full max-w-6xl p-3 sm:p-5 rounded-[2.5rem] bg-gradient-to-b from-[#0a0b0e] via-zinc-950 to-black border-2 ${ambientTheme.borderClass} ${ambientTheme.shadowClass} select-none transition-all duration-300`}>
      {/* ── Régua Superior de Shift Lights F1 / GT3 RS Duplos Convergentes ── */}
      <div className="flex flex-col items-center w-full max-w-xl mb-2">
        <div className="flex items-center justify-between w-full px-2 mb-1 text-[10px] font-mono">
          <span className="font-black tracking-widest flex items-center gap-1.5 uppercase" style={{ color: ambientTheme.hex }}>
            <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: ambientTheme.hex }} />
            992 GT3 RS · CLUSTER DIGITAL
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
        <div className="flex items-center justify-center gap-1.5 w-full py-1 bg-zinc-900/90 rounded-full border border-white/10 px-3">
          {[...Array(16)].map((_, idx) => {
            const distanceFromCenter = Math.abs(idx - 7.5)
            const triggerRatio = (7.5 - distanceFromCenter) / 7.5
            const rpmRatio = clampedRpm / maxRpm
            const isActive = rpmRatio >= 0.75 + triggerRatio * 0.16
            const isRedlineLed = triggerRatio >= 0.8
            const isYellowLed = triggerRatio >= 0.4 && triggerRatio < 0.8

            return (
              <div
                key={idx}
                className={`h-2 flex-1 rounded-xs transition-all duration-75 ${
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

      {/* ── Banner de Launch Control Ativo ── */}
      {isLaunchControlArmed && (
        <div className="w-full max-w-lg mb-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 text-center text-xs font-mono font-black animate-pulse flex items-center justify-center gap-2">
          <span>🏁</span>
          <span>LAUNCH CONTROL ATIVO · ACELERADOR A FUNDO · SOLTE O FREIO PARA LARGAR!</span>
          <span>🏁</span>
        </div>
      )}
      {isLaunching && (
        <div className="w-full max-w-lg mb-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-center text-xs font-mono font-black flex items-center justify-center gap-2">
          <span>🚀</span>
          <span>PORSCHE LAUNCH INICIADO!</span>
          <span>🚀</span>
        </div>
      )}

      {/* ── Conjunto Triplo de Instrumentos GT3 RS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 w-full items-center justify-items-center">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 1. MOSTRADOR ESQUERDO: VELOCÍMETRO ANALÓGICO PORSCHE (0-350 KM/H)  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-[230px] sm:w-[250px]">
            <defs>
              <radialGradient id="porscheSpeedBg" cx="50%" cy="50%" r="50%">
                <stop offset="65%" stopColor="#090a0d" />
                <stop offset="90%" stopColor="#121318" />
                <stop offset="100%" stopColor="#252730" />
              </radialGradient>
              <linearGradient id="porscheNeedleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>

            {/* Aros externos com visual Porsche Motorsport */}
            <circle cx={center} cy={center} r={radius + 18} fill="none" stroke="#3f3f46" strokeWidth="3" />
            <circle cx={center} cy={center} r={radius + 15} fill="url(#porscheSpeedBg)" stroke="#18181b" strokeWidth="2" />

            {/* Inscrição "km/h" */}
            <text
              x={center}
              y={center - 32}
              textAnchor="middle"
              className="fill-zinc-400 font-mono text-[9px] tracking-widest font-black uppercase"
            >
              KM / H
            </text>

            {/* Arco da escala de velocidade */}
            <path
              d={describeArc(center, center, radius - 6, startAngle, endAngle)}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              opacity="0.4"
            />

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
                    stroke="#fafafa"
                    strokeWidth={m.isMajor ? 2.2 : 1}
                    opacity={m.isMajor ? 0.95 : 0.4}
                  />
                  {m.label && (
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      className="font-mono text-[10px] font-black fill-zinc-200"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Display Digital Central de Velocidade */}
            <g transform={`translate(${center}, ${center + 26})`}>
              <circle cx="0" cy="0" r="25" fill="#090a0d" stroke="#3f3f46" strokeWidth="1.2" />
              <text
                x="0"
                y="3"
                textAnchor="middle"
                className="font-mono text-xl font-black fill-white"
              >
                {Math.round(speedometer.speed)}
              </text>
              <text
                x="0"
                y="14"
                textAnchor="middle"
                className="font-mono text-[7px] font-bold fill-amber-400"
              >
                VELOCIDADE
              </text>
            </g>

            {/* Agulha Amarela de Velocidade (Camadas SVG nativas sem drop-shadow CSS) */}
            <g transform={`rotate(${speedNeedleAngle} ${center} ${center})`}>
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#fbbf24"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.35"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="url(#porscheNeedleGrad)"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center}
                x2={center - 18}
                y2={center}
                stroke="#b45309"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="11" fill="#141416" stroke="#fbbf24" strokeWidth="1.5" />
              <circle cx={center} cy={center} r="3.5" fill="#f59e0b" />
            </g>
          </svg>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 2. MOSTRADOR CENTRAL: TACÔMETRO ICÔNICO PORSCHE GT3 RS (10.000 RPM) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-[240px] sm:w-[260px]">
            <defs>
              <radialGradient id="porscheTachBg" cx="50%" cy="50%" r="50%">
                <stop offset="65%" stopColor="#090a0d" />
                <stop offset="90%" stopColor="#121318" />
                <stop offset="100%" stopColor="#2a2c35" />
              </radialGradient>
            </defs>

            {/* Aro externo motorsport com acabamento titânio escovado */}
            <circle cx={center} cy={center} r={radius + 18} fill="none" stroke="#52525b" strokeWidth="3.5" />
            <circle cx={center} cy={center} r={radius + 15} fill="url(#porscheTachBg)" stroke="#18181b" strokeWidth="2" />

            {/* Inscrição "911 BI-TURBO" no topo do mostrador */}
            <text
              x={center}
              y={center - 34}
              textAnchor="middle"
              className="fill-amber-400 font-mono text-[9px] tracking-widest font-black uppercase"
            >
              911 BI-TURBO
            </text>

            {/* Faixa vermelha de redline brutal em 9000 RPM */}
            <path
              d={describeArc(center, center, radius - 6, mapRange(9000, 0, maxRpm, startAngle, endAngle), endAngle)}
              fill="none"
              stroke="#ef4444"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Marcações do Tacômetro */}
            {rpmMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const innerR = m.isMajor ? radius - 15 : radius - 8
              const outerR = radius - 2
              const x1 = center + innerR * Math.cos(rad)
              const y1 = center + innerR * Math.sin(rad)
              const x2 = center + outerR * Math.cos(rad)
              const y2 = center + outerR * Math.sin(rad)

              const textR = radius - 25
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

            {/* Display Central Digital Integrado no Tacômetro (PDK Gear) */}
            <g transform={`translate(${center}, ${center + 26})`}>
              <circle cx="0" cy="0" r="26" fill="#090a0d" stroke="#3f3f46" strokeWidth="1.5" />
              <text
                x="0"
                y="6"
                textAnchor="middle"
                className="font-mono text-2xl font-black fill-amber-400"
              >
                {pdkDisplay}
              </text>
              <text
                x="0"
                y="17"
                textAnchor="middle"
                className="font-mono text-[7px] font-bold fill-zinc-400"
              >
                PDK GEAR
              </text>
            </g>

            {/* Agulha Amarela Oficial Porsche GT3 RS (Camadas SVG nativas sem drop-shadow) */}
            <g transform={`rotate(${rpmNeedleAngle} ${center} ${center})`}>
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="#fbbf24"
                strokeWidth="5.5"
                strokeLinecap="round"
                opacity="0.35"
              />
              <line
                x1={center}
                y1={center}
                x2={center + radius - 4}
                y2={center}
                stroke="url(#porscheNeedleGrad)"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center}
                x2={center - 20}
                y2={center}
                stroke="#b45309"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="12" fill="#141416" stroke="#fbbf24" strokeWidth="1.5" />
              <circle cx={center} cy={center} r="4" fill="#f59e0b" />
            </g>
          </svg>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 3. TELA TFT DIREITA: G-FORCE, PRESSÃO DE PNEUS E TELEMETRIA PORSCHE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col items-center justify-between w-full max-w-[280px] h-[260px] p-3 rounded-2xl bg-zinc-950/90 border border-white/10 shadow-[inset_0_2px_15px_rgba(0,0,0,0.8)]">
          <div className="w-full flex justify-between items-center border-b border-white/10 pb-1 text-[9px] font-mono text-zinc-400">
            <span className="font-bold text-amber-400">CHASSIS & DYNAMICS</span>
            <span>FRICTION CIRCLE</span>
          </div>

          {/* Gráfico Duplo: Pneus TPMS + Friction Circle G-Force */}
          <div className="w-full flex items-center justify-around my-auto py-1">
            {/* Silhueta minimalista do 911 com TPMS */}
            <div className="w-16 h-28 rounded-2xl border border-zinc-700/60 bg-zinc-900/60 flex flex-col justify-between items-center py-1.5 relative">
              <span className="text-[6px] font-mono text-zinc-400 font-bold">FRONT</span>
              <div className="w-8 h-0.5 bg-amber-500/40 rounded-full" />
              <span className="text-[6px] font-mono text-zinc-400 font-bold">REAR</span>

              <div className="absolute -left-7 top-2 text-[7px] font-mono text-emerald-400 font-bold">
                2.1
              </div>
              <div className="absolute -right-7 top-2 text-[7px] font-mono text-emerald-400 font-bold">
                2.1
              </div>
              <div className="absolute -left-7 bottom-2 text-[7px] font-mono text-emerald-400 font-bold">
                2.3
              </div>
              <div className="absolute -right-7 bottom-2 text-[7px] font-mono text-emerald-400 font-bold">
                2.3
              </div>
            </div>

            {/* Medidor Friction Circle G-Force */}
            <div className="relative w-24 h-24 rounded-full border border-white/20 bg-zinc-900/60 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border border-white/10" />
              <div className="w-8 h-8 rounded-full border border-white/10" />
              <div className="absolute inset-x-0 h-px bg-white/15" />
              <div className="absolute inset-y-0 w-px bg-white/15" />

              <div
                className="absolute w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,1)] transition-transform duration-100"
                style={{
                  transform: `translate(${gForceX * 18}px, ${-gForceY * 18}px)`,
                }}
              />
              <span className="absolute bottom-1 text-[7px] font-mono text-zinc-400">
                {Math.abs(gForceY).toFixed(1)}G LAT
              </span>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* MANÔMETRO OFICIAL DE TURBO PORSCHE 992 (BOOST / LADEDRUCK)   */}
          {/* ═════════════════════════════════════════════════════════════ */}
          <div className="w-full flex flex-col p-1.5 rounded-xl bg-zinc-900/90 border border-white/10 my-0.5">
            <div className="w-full flex justify-between items-center text-[8px] font-mono mb-0.5">
              <span className="font-bold text-amber-400 flex items-center gap-1">
                <span>⚡</span>
                <span>BOOST · LADEDRUCK</span>
              </span>
              <strong className={`font-mono text-[10px] font-black ${boostPressureBar > 0 ? 'text-amber-400' : 'text-sky-400'}`}>
                {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR
              </strong>
            </div>

            {/* Barra horizontal de boost da Porsche */}
            <div className="w-full h-2 bg-zinc-950 rounded-full border border-white/10 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-red-500 transition-all duration-75"
                style={{ width: `${clamp((boostPressureBar + 1.0) / 2.6, 0, 1) * 100}%` }}
              />
            </div>

            <div className="w-full flex justify-between items-center text-[6px] font-mono text-zinc-500 mt-0.5">
              <span>0.0</span>
              <span>0.5</span>
              <span>1.0</span>
              <span>+1.5 BAR</span>
              {peakBoostBar > 0.1 && (
                <span className="text-amber-400 font-bold">PEAK +{peakBoostBar.toFixed(2)}</span>
              )}
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

          {/* Rodapé: Modos do Volante e TC */}
          <div className="w-full flex justify-between items-center border-t border-white/10 pt-1.5 text-[8px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 font-black">
              TRACK MODE
            </span>
            <div className="flex items-center gap-1">
              <span className={`px-1 rounded font-bold ${telemetry.tcs.enabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-red-950 text-red-400 border border-red-500/40'}`}>
                TC {telemetry.tcs.enabled ? 'ON' : 'OFF'}
              </span>
              <span className="px-1 rounded font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/40">
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
