import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp, mapRange } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'

interface GolQuadradoRealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * GolQuadradoRealCluster — Quadro de instrumentos lendário do VW Gol Quadrado 1.9 AP Turbo.
 *
 * Características clássicas de arrancada dos anos 90:
 * - Moldura satélite retrô com textura plástica granulada e parafusos aparentes
 * - Conta-giros AutoMeter Monster 5" (0 a 10.000 RPM) de alta precisão
 * - Shift Light externa com canhão de luz âmbar/vermelho pulsante no corte
 * - Manômetro analógico de pressão de turbo (Vácuo -1.0 a Pressão +3.0 bar)
 * - Velocímetro analógico clássico com odômetro de rolete mecânico
 * - Indicador dinâmico do corte de largada 3-Step / Anti-lag
 */
export const GolQuadradoRealCluster = memo(function GolQuadradoRealCluster({
  telemetry,
}: GolQuadradoRealClusterProps) {
  const { tachometer, speedometer, gear, warningLights, auxGauges } = telemetry

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const liveRpm = useSimulationStore((s) => s.rpm)
  const isRevLimiting = useSimulationStore((s) => s.isRevLimiting)

  // ── AutoMeter Monster Tachometer Geometry (0 a 10.000 RPM) ──
  const tachSize = 280
  const tachCenter = tachSize / 2
  const tachRadius = 110
  const tachStartAngle = -225
  const tachEndAngle = 45

  // RPM ao vivo sem atraso e limitado à escala do AutoMeter Monster
  const currentRpm = Math.max(0, liveRpm || tachometer.rpm || 0)
  const clampedRpm = clamp(currentRpm, 0, 10000)
  const tachAngle = mapRange(clampedRpm, 0, 10000, tachStartAngle, tachEndAngle)

  // Shift Light ativa a partir de 7.000 RPM, durante corte de giro ou no 3-Step
  const isShiftLightActive = clampedRpm >= 7000 || isRevLimiting || isLaunchControlArmed

  // Marcações do Conta-Giros AutoMeter (0 a 10 x1000 RPM)
  const tachMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isRedzone: boolean }[] = []
    for (let r = 0; r <= 10000; r += 200) {
      const isMajor = r % 1000 === 0
      const angle = mapRange(r, 0, 10000, tachStartAngle, tachEndAngle)
      list.push({
        angle,
        label: isMajor ? String(r / 1000) : '',
        isMajor,
        isRedzone: r >= 7200,
      })
    }
    return list
  }, [])

  // ── Velocímetro Clássico (0 a 240 km/h) ──
  const speedSize = 220
  const speedCenter = speedSize / 2
  const speedRadius = 85
  const speedStartAngle = -220
  const speedEndAngle = 40
  const clampedSpeed = clamp(speedometer.speed, 0, 240)
  const speedAngle = mapRange(clampedSpeed, 0, 240, speedStartAngle, speedEndAngle)

  const speedMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean }[] = []
    for (let s = 0; s <= 240; s += 10) {
      const isMajor = s % 20 === 0
      const angle = mapRange(s, 0, 240, speedStartAngle, speedEndAngle)
      list.push({
        angle,
        label: isMajor ? String(s) : '',
        isMajor,
      })
    }
    return list
  }, [])

  // ── Manômetro de Turbo Analógico 52mm (-1.0 a +3.0 bar) ──
  const boostSize = 160
  const boostCenter = boostSize / 2
  const boostRadius = 60
  const boostStartAngle = -210
  const boostEndAngle = 30
  const clampedBoost = clamp(boostPressureBar, -1.0, 3.0)
  const boostAngle = mapRange(clampedBoost, -1.0, 3.0, boostStartAngle, boostEndAngle)

  // Ângulos dos Minis Marcadores de Água e Tanque
  const tempAngle = mapRange(clamp(auxGauges.coolantTemp, 50, 120), 50, 120, -45, 45)
  const fuelAngle = mapRange(clamp(auxGauges.fuelPercent, 0, 100), 0, 100, -45, 45)

  return (
    <div className="@container relative flex flex-col items-center justify-center p-1.5 sm:p-2.5 rounded-2xl bg-[#0d0f12] border-2 border-[#24272e] shadow-[0_15px_50px_rgba(0,0,0,0.9),inset_0_2px_8px_rgba(255,255,255,0.06)] font-mono select-none overflow-hidden max-w-4xl w-full">
      {/* Textura de Fundo do Painel Satélite Quadrado */}
      <div className="absolute inset-0 bg-[radial-gradient(#1a1d24_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

      {/* Parafusos de Painel de Corrida nos 4 Cantos */}
      <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-zinc-700 border border-zinc-900 shadow flex items-center justify-center text-[7px] text-zinc-950 font-black">+</div>
      <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-zinc-700 border border-zinc-900 shadow flex items-center justify-center text-[7px] text-zinc-950 font-black">+</div>
      <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-zinc-700 border border-zinc-900 shadow flex items-center justify-center text-[7px] text-zinc-950 font-black">+</div>
      <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-zinc-700 border border-zinc-900 shadow flex items-center justify-center text-[7px] text-zinc-950 font-black">+</div>

      {/* Topo do Painel: Banner Satélite e 3-Step */}
      <div className="relative z-10 w-full flex items-center justify-between mb-1 px-2.5 border-b border-zinc-800/80 pb-1">
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-black text-amber-400 tracking-wider">
            VW AP 1.9 FORJADO
          </div>
          <span className="text-zinc-500 text-[10px] hidden sm:inline">TURBINA .50/.63</span>
        </div>

        {/* Alerta de 3-Step / Launch Control */}
        {isLaunchControlArmed ? (
          <div className="px-3 py-0.5 rounded bg-amber-500/20 border border-amber-400 text-amber-300 text-[11px] font-black tracking-widest animate-pulse flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.5)]">
            <span>⚡ 3-STEP CORTE ATIVO [4.800 RPM]</span>
          </div>
        ) : isLaunching ? (
          <div className="px-3 py-0.5 rounded bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[11px] font-black tracking-widest animate-bounce flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
            <span>🚀 LARGADA FULL BOOST!</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
            <span>PICO TURBO:</span>
            <span className="text-amber-400 font-black font-mono">+{peakBoostBar.toFixed(2)} BAR</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500">CORTE:</span>
          <span className="text-red-400 text-[10px] font-black">7.400 RPM</span>
        </div>
      </div>

      {/* Conteúdo Principal do Painel */}
      <div className="relative z-10 flex flex-wrap @[640px]:flex-nowrap items-center justify-center gap-2 sm:gap-4 w-full">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 1. VELOCÍMETRO CLÁSSICO RETRÔ VW (0-240 KM/H)                      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center">
          <svg width={speedSize} height={speedSize} className="drop-shadow-[0_8px_20px_rgba(0,0,0,0.8)]">
            {/* Aro externo preto acetinado */}
            <circle cx={speedCenter} cy={speedCenter} r={speedRadius + 18} fill="#14171d" stroke="#2a2e37" strokeWidth="4" />
            <circle cx={speedCenter} cy={speedCenter} r={speedRadius + 12} fill="#0d0e12" stroke="#1c1f26" strokeWidth="2" />

            {/* Escala graduada */}
            {speedMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const cos = Math.cos(rad)
              const sin = Math.sin(rad)
              const r1 = speedRadius
              const r2 = m.isMajor ? speedRadius - 12 : speedRadius - 6
              const textR = speedRadius - 22

              return (
                <g key={i}>
                  <line
                    x1={speedCenter + r1 * cos}
                    y1={speedCenter + r1 * sin}
                    x2={speedCenter + r2 * cos}
                    y2={speedCenter + r2 * sin}
                    stroke={m.isMajor ? '#e4e4e7' : '#71717a'}
                    strokeWidth={m.isMajor ? '2' : '1'}
                  />
                  {m.isMajor && (
                    <text
                      x={speedCenter + textR * cos}
                      y={speedCenter + textR * sin + 3.5}
                      textAnchor="middle"
                      fill="#e4e4e7"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Identificação km/h */}
            <text x={speedCenter} y={speedCenter - 28} textAnchor="middle" fill="#71717a" fontSize="10" fontWeight="bold">
              km/h
            </text>

            {/* Odômetro Mecânico de Rolete Retrô */}
            <g transform={`translate(${speedCenter - 34}, ${speedCenter + 26})`}>
              <rect width="68" height="18" rx="2" fill="#000" stroke="#3f3f46" strokeWidth="1" />
              <text x="34" y="13" textAnchor="middle" fill="#f4f4f5" fontSize="10" fontWeight="black" letterSpacing="2">
                {String(Math.round(clampedSpeed * 12.8 + 142850)).padStart(6, '0')}
              </text>
            </g>

            {/* Agulha Laranja Fluorescente */}
            <g transform={`rotate(${speedAngle}, ${speedCenter}, ${speedCenter})`}>
              <line
                x1={speedCenter}
                y1={speedCenter}
                x2={speedCenter + speedRadius - 2}
                y2={speedCenter}
                stroke="#ff4d00"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1={speedCenter}
                y1={speedCenter}
                x2={speedCenter - 16}
                y2={speedCenter}
                stroke="#ff4d00"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle cx={speedCenter} cy={speedCenter} r="10" fill="#18181b" stroke="#71717a" strokeWidth="1.5" />
              <circle cx={speedCenter} cy={speedCenter} r="3" fill="#ff4d00" />
            </g>
          </svg>
          <span className="text-[10px] text-zinc-500 font-bold mt-1">VELOCIDADE</span>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 2. CENTRO: CONTA-GIROS AUTOMETER MONSTER 5" COM SHIFT LIGHT EXTERNA */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center">
          {/* Canhão de Shift Light Externa Montada no Topo Direito */}
          <div
            className={`absolute -top-3 -right-4 z-20 flex items-center justify-center transition-all ${
              isShiftLightActive ? 'scale-110' : 'scale-100 opacity-90'
            }`}
          >
            {/* Tubo de alumínio com lente estroboscópica */}
            <div
              className={`w-12 h-12 rounded-full border-2 border-zinc-600 flex items-center justify-center transition-all shadow-xl ${
                isShiftLightActive
                  ? 'bg-amber-400 border-amber-300 shadow-[0_0_35px_rgba(251,191,36,1)] animate-pulse'
                  : 'bg-zinc-900 border-zinc-700'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-[9px] ${
                  isShiftLightActive
                    ? 'bg-amber-300 text-black shadow-[inset_0_0_10px_rgba(255,255,255,0.8)]'
                    : 'bg-zinc-800 text-zinc-600'
                }`}
              >
                SHIFT
              </div>
            </div>
          </div>

          <svg width={tachSize} height={tachSize} className="drop-shadow-[0_10px_30px_rgba(0,0,0,0.95)]">
            {/* Moldura de Aço Escovado AutoMeter Monster */}
            <circle cx={tachCenter} cy={tachCenter} r={tachRadius + 24} fill="#272a33" stroke="#4a4f5c" strokeWidth="4" />
            <circle cx={tachCenter} cy={tachCenter} r={tachRadius + 18} fill="#12141a" stroke="#1f222a" strokeWidth="2" />

            {/* Faixa Vermelha de Redline (7.200 a 10.000 RPM) */}
            {(() => {
              const rStart = mapRange(7200, 0, 10000, tachStartAngle, tachEndAngle)
              const rEnd = tachEndAngle
              const rad1 = (rStart * Math.PI) / 180
              const rad2 = (rEnd * Math.PI) / 180
              const r = tachRadius - 2
              const x1 = tachCenter + r * Math.cos(rad1)
              const y1 = tachCenter + r * Math.sin(rad1)
              const x2 = tachCenter + r * Math.cos(rad2)
              const y2 = tachCenter + r * Math.sin(rad2)
              return (
                <path
                  d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="8"
                  strokeOpacity="0.8"
                />
              )
            })()}

            {/* Ticks e Números AutoMeter */}
            {tachMarks.map((m, i) => {
              const rad = (m.angle * Math.PI) / 180
              const cos = Math.cos(rad)
              const sin = Math.sin(rad)
              const r1 = tachRadius
              const r2 = m.isMajor ? tachRadius - 14 : tachRadius - 7
              const textR = tachRadius - 26

              return (
                <g key={i}>
                  <line
                    x1={tachCenter + r1 * cos}
                    y1={tachCenter + r1 * sin}
                    x2={tachCenter + r2 * cos}
                    y2={tachCenter + r2 * sin}
                    stroke={m.isRedzone ? '#ef4444' : m.isMajor ? '#ffffff' : '#94a3b8'}
                    strokeWidth={m.isMajor ? '2.5' : '1.2'}
                  />
                  {m.isMajor && (
                    <text
                      x={tachCenter + textR * cos}
                      y={tachCenter + textR * sin + 4.5}
                      textAnchor="middle"
                      fill={m.isRedzone ? '#ef4444' : '#ffffff'}
                      fontSize="14"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Logotipo AutoMeter Sport-Comp Retrô */}
            <text x={tachCenter} y={tachCenter - 40} textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="900" letterSpacing="1">
              Auto Meter
            </text>
            <text x={tachCenter} y={tachCenter - 28} textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold" letterSpacing="2">
              SPORT-COMP
            </text>
            <text x={tachCenter} y={tachCenter + 46} textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="bold">
              RPM × 1000
            </text>

            {/* Agulha Monster Amarela/Fluorescente */}
            <g transform={`rotate(${tachAngle}, ${tachCenter}, ${tachCenter})`}>
              <line
                x1={tachCenter}
                y1={tachCenter}
                x2={tachCenter + tachRadius - 2}
                y2={tachCenter}
                stroke="#f59e0b"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <line
                x1={tachCenter}
                y1={tachCenter}
                x2={tachCenter - 22}
                y2={tachCenter}
                stroke="#f59e0b"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle cx={tachCenter} cy={tachCenter} r="14" fill="#090a0f" stroke="#e2e8f0" strokeWidth="2" />
              <circle cx={tachCenter} cy={tachCenter} r="4" fill="#f59e0b" />
            </g>
          </svg>

          {/* Marcha Atual Mecânica Central */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-zinc-500 font-bold">MARCHA:</span>
            <div className="px-3 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-black text-amber-400 text-sm shadow">
              {gear.label}
            </div>
            <span className="text-[10px] text-zinc-400 font-bold font-mono">
              {Math.round(clampedRpm)} <span className="text-[8px] text-zinc-500">RPM</span>
            </span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 3. COLUNA DIREITA: MANÔMETRO DE TURBO + TEMPERATURA + COMBUSTÍVEL   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col items-center gap-3">
          {/* Manômetro de Turbo 52mm Cronomac (-1.0 a +3.0 bar) */}
          <div className="relative flex flex-col items-center">
            <svg width={boostSize} height={boostSize} className="drop-shadow-[0_6px_16px_rgba(0,0,0,0.85)]">
              <circle cx={boostCenter} cy={boostCenter} r={boostRadius + 14} fill="#1c1f26" stroke="#373c49" strokeWidth="3" />
              <circle cx={boostCenter} cy={boostCenter} r={boostRadius + 9} fill="#0d0f14" stroke="#171920" strokeWidth="1.5" />

              {/* Ticks de Vácuo e Pressão */}
              {[-1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((b, i) => {
                const angle = mapRange(b, -1.0, 3.0, boostStartAngle, boostEndAngle)
                const rad = (angle * Math.PI) / 180
                const cos = Math.cos(rad)
                const sin = Math.sin(rad)
                const r1 = boostRadius
                const r2 = boostRadius - 8
                const textR = boostRadius - 16
                const isZero = b === 0
                const isOver = b > 1.5

                return (
                  <g key={i}>
                    <line
                      x1={boostCenter + r1 * cos}
                      y1={boostCenter + r1 * sin}
                      x2={boostCenter + r2 * cos}
                      y2={boostCenter + r2 * sin}
                      stroke={isOver ? '#ef4444' : isZero ? '#10b981' : '#cbd5e1'}
                      strokeWidth={isZero ? '2.5' : '1.5'}
                    />
                    <text
                      x={boostCenter + textR * cos}
                      y={boostCenter + textR * sin + 3}
                      textAnchor="middle"
                      fill={isOver ? '#ef4444' : isZero ? '#10b981' : '#94a3b8'}
                      fontSize="8"
                      fontWeight="bold"
                    >
                      {b > 0 ? `+${b}` : b}
                    </text>
                  </g>
                )
              })}

              <text x={boostCenter} y={boostCenter - 16} textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold">
                TURBO
              </text>
              <text x={boostCenter} y={boostCenter + 22} textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="bold">
                BAR
              </text>

              {/* Agulha Mecânica do Turbo */}
              <g transform={`rotate(${boostAngle}, ${boostCenter}, ${boostCenter})`}>
                <line
                  x1={boostCenter}
                  y1={boostCenter}
                  x2={boostCenter + boostRadius - 2}
                  y2={boostCenter}
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx={boostCenter} cy={boostCenter} r="7" fill="#18181b" stroke="#71717a" strokeWidth="1" />
                <circle cx={boostCenter} cy={boostCenter} r="2.5" fill="#ef4444" />
              </g>
            </svg>
            <div className="flex items-center gap-1 text-[11px] font-black font-mono">
              <span className={boostPressureBar > 0 ? 'text-amber-400' : 'text-sky-400'}>
                {boostPressureBar > 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} BAR
              </span>
            </div>
          </div>

          {/* Marcadores Duplos de Temperatura e Nível de Tanque */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-950 border border-zinc-800 shadow">
            {/* Temp Água */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-10 relative flex items-center justify-center">
                <svg width="48" height="40" viewBox="0 0 48 40">
                  <path d="M 6 32 A 18 18 0 0 1 42 32" fill="none" stroke="#3f3f46" strokeWidth="3" />
                  <g transform={`rotate(${tempAngle}, 24, 32)`}>
                    <line x1="24" y1="32" x2="24" y2="12" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="24" cy="32" r="4" fill="#18181b" />
                  </g>
                </svg>
              </div>
              <span className="text-[8px] text-zinc-400 font-bold">TEMP 90°C</span>
            </div>

            {/* Combustível */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-10 relative flex items-center justify-center">
                <svg width="48" height="40" viewBox="0 0 48 40">
                  <path d="M 6 32 A 18 18 0 0 1 42 32" fill="none" stroke="#3f3f46" strokeWidth="3" />
                  <g transform={`rotate(${fuelAngle}, 24, 32)`}>
                    <line x1="24" y1="32" x2="24" y2="12" stroke="#ff4d00" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="24" cy="32" r="4" fill="#18181b" />
                  </g>
                </svg>
              </div>
              <span className="text-[8px] text-zinc-400 font-bold">TANQUE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Luzes-Espia Retrô na Base */}
      <div className="relative z-10 w-full flex items-center justify-center gap-3 sm:gap-6 mt-3 pt-2 border-t border-zinc-800/80">
        <div className={`text-[10px] font-black ${warningLights.oil ? 'text-red-500 animate-pulse' : 'text-zinc-800'}`}>
          🛢️ ÓLEO
        </div>
        <div className={`text-[10px] font-black ${warningLights.battery ? 'text-red-500 animate-pulse' : 'text-zinc-800'}`}>
          🔋 BATERIA
        </div>
        <div className={`text-[10px] font-black ${warningLights.brake ? 'text-red-500' : 'text-zinc-800'}`}>
          (P) FREIO
        </div>
        <div className={`text-[10px] font-black ${warningLights.checkEngine ? 'text-amber-500 animate-pulse' : 'text-zinc-800'}`}>
          ⚡ CHECK
        </div>
        <div className={`text-[10px] font-black ${warningLights.temp ? 'text-red-500 animate-pulse' : 'text-zinc-800'}`}>
          🌡️ TEMP
        </div>
      </div>
    </div>
  )
})

