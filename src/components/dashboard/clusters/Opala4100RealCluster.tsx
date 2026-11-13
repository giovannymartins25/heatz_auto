import { memo, useMemo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp, mapRange } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'

interface Opala4100RealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * Opala4100RealCluster — Quadro de instrumentos clássico do Chevrolet Opala Diplomata 4.1 (250-S).
 *
 * Características clássicas:
 * - Moldura retangular com detalhes em jacarandá e fundo preto fosco dos anos 80/90
 * - Tacômetro clássico 0 a 6.000 RPM com faixa de torque aos 2.600 e redline aos 5.200 RPM
 * - Velocímetro analógico de rolete até 220 km/h
 * - Manômetro de Pressão de Óleo (0-5 bar) e Voltímetro da bateria (vital no motor 250-S)
 * - Mostrador de temperatura do arrefecimento (°C) e nível do tanque (65L)
 * - Luzes espia quadradas retrô
 */
export const Opala4100RealCluster = memo(function Opala4100RealCluster({
  telemetry,
}: Opala4100RealClusterProps) {
  const { tachometer, speedometer, gear, warningLights } = telemetry
  const coolantTemp = useSimulationStore((s) => s.coolantTemp)
  const fuelLevelLiters = useSimulationStore((s) => s.fuelLevelLiters)
  const liveRpm = useSimulationStore((s) => s.rpm)
  const isRevLimiting = useSimulationStore((s) => s.isRevLimiting)
  const speed = useSimulationStore((s) => s.speed)
  const hasNosKit = useSimulationStore((s) => s.hasNosKit)
  const nosActive = useSimulationStore((s) => s.nosActive)
  const nosPressurePercent = useSimulationStore((s) => s.nosPressurePercent)

  const currentRpm = Math.max(0, liveRpm || tachometer.rpm || 0)
  const currentSpeed = Math.max(0, speed || speedometer.speed || 0)

  // Geometria dos Instrumentos
  const gaugeSize = 220
  const center = gaugeSize / 2
  const radius = 86
  const startAngle = -225
  const endAngle = 45

  // Ângulos dos ponteiros
  const rpmAngle = mapRange(clamp(currentRpm, 0, 6000), 0, 6000, startAngle, endAngle)
  const speedAngle = mapRange(clamp(currentSpeed, 0, 220), 0, 220, startAngle, endAngle)

  // Pressão do Óleo dinâmica (relacionada ao RPM: 1.5 bar na lenta a 4.5 bar em giro alto)
  const oilPressure = clamp(1.2 + (currentRpm / 6000) * 3.4, 0, 5)

  // Marcas do Tacômetro (0 a 6.000 RPM)
  const tachMarks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isRedline: boolean }[] = []
    for (let r = 0; r <= 6000; r += 200) {
      const isMajor = r % 1000 === 0
      const angle = mapRange(r, 0, 6000, startAngle, endAngle)
      list.push({
        angle,
        label: isMajor ? String(r / 1000) : '',
        isMajor,
        isRedline: r >= 5000,
      })
    }
    return list
  }, [startAngle, endAngle])

  // Marcas do Velocímetro (0 a 220 km/h)
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
    <div className="@container relative flex flex-col items-center justify-center p-3 sm:p-5 rounded-3xl bg-gradient-to-b from-stone-900 via-neutral-950 to-black border-4 border-stone-800 shadow-[0_20px_50px_rgba(0,0,0,0.9)] max-w-4xl w-full select-none font-mono">
      {/* Moldura Clássica de Acabamento em Madeira Nobre Jacarandá */}
      <div className="w-full h-2.5 rounded-full bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 border-y border-amber-800/40 mb-3 shadow-inner" />

      {/* Identificação do Modelo Clássico */}
      <div className="flex items-center justify-between w-full px-4 mb-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-serif italic text-amber-500 font-bold tracking-widest text-sm">
            Diplomata SE
          </span>
          <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-white/10 text-[9px] font-bold">
            4.1L 6 CILINDROS · 250-S
          </span>
        </div>

        {hasNosKit && (
          <span
            className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all ${
              nosActive
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.6)] animate-pulse'
                : 'bg-stone-900 text-stone-400 border-white/10'
            }`}
          >
            ⚡ NITRO NOS: {Math.round(nosPressurePercent)}%
          </span>
        )}
      </div>

      {/* Painel Principal de Instrumentos */}
      <div className="flex flex-col @[580px]:flex-row items-center justify-around w-full gap-4 p-2 rounded-2xl bg-neutral-950/90 border border-neutral-800">
        {/* ─── 1. CONTA-GIROS CLÁSSICO 4.1L (ESQUERDA) ─── */}
        <div className="relative flex flex-col items-center">
          <svg width={gaugeSize} height={gaugeSize} className="drop-shadow-lg">
            {/* Fundo do Mostrador */}
            <circle cx={center} cy={center} r={radius + 15} fill="#0a0a0c" stroke="#262626" strokeWidth={3} />
            <circle cx={center} cy={center} r={radius} fill="#141417" stroke="#1f1f23" strokeWidth={1.5} />

            {/* Faixa Amarela e Vermelha de Sobregiro (4.800 a 6.000 RPM) */}
            <circle
              cx={center}
              cy={center}
              r={radius - 8}
              fill="none"
              stroke="#eab308"
              strokeWidth={5}
              strokeDasharray={`${(radius - 8) * Math.PI * 0.15} 400`}
              strokeDashoffset={-((radius - 8) * Math.PI * 0.72)}
            />
            <circle
              cx={center}
              cy={center}
              r={radius - 8}
              fill="none"
              stroke="#ef4444"
              strokeWidth={5}
              strokeDasharray={`${(radius - 8) * Math.PI * 0.22} 400`}
              strokeDashoffset={-((radius - 8) * Math.PI * 0.82)}
            />

            {/* Marcas de Rotação */}
            {tachMarks.map((m, idx) => {
              const rad = (m.angle * Math.PI) / 180
              const x1 = center + (radius - (m.isMajor ? 14 : 7)) * Math.cos(rad)
              const y1 = center + (radius - (m.isMajor ? 14 : 7)) * Math.sin(rad)
              const x2 = center + radius * Math.cos(rad)
              const y2 = center + radius * Math.sin(rad)
              const tx = center + (radius - 26) * Math.cos(rad)
              const ty = center + (radius - 26) * Math.sin(rad)

              return (
                <g key={idx}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={m.isRedline ? '#ef4444' : '#e5e5e5'}
                    strokeWidth={m.isMajor ? 2.5 : 1.2}
                  />
                  {m.isMajor && (
                    <text
                      x={tx}
                      y={ty + 4}
                      fill={m.isRedline ? '#ef4444' : '#f5f5f5'}
                      fontSize={11}
                      fontWeight="bold"
                      textAnchor="middle"
                      className="font-mono"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Inscrições Centrais */}
            <text x={center} y={center - 32} fill="#737373" fontSize={9} textAnchor="middle" fontWeight="bold">
              RPM x1000
            </text>
            <text x={center} y={center + 36} fill="#d97706" fontSize={10} textAnchor="middle" fontWeight="bold">
              250-S
            </text>

            {/* Ponteiro Laranja Fluorescente */}
            <g transform={`rotate(${rpmAngle} ${center} ${center})`}>
              <line
                x1={center - 12}
                y1={center}
                x2={center + radius - 10}
                y2={center}
                stroke="#ff4d00"
                strokeWidth={3}
                strokeLinecap="round"
                className="drop-shadow-[0_0_6px_rgba(255,77,0,0.8)]"
              />
              <circle cx={center} cy={center} r={10} fill="#1c1917" stroke="#44403c" strokeWidth={2} />
              <circle cx={center} cy={center} r={4} fill="#ff4d00" />
            </g>
          </svg>

          <span className="text-[10px] text-stone-400 font-bold mt-1">
            ROTAÇÃO: <strong className="text-white">{Math.round(currentRpm)} RPM</strong>
          </span>
        </div>

        {/* ─── 2. BLOCO CENTRAL: MEDIDORES AUXILIARES & MARCHAS ─── */}
        <div className="flex flex-col items-center justify-between gap-3 p-3 rounded-2xl bg-stone-950/80 border border-stone-800 w-full max-w-xs">
          {/* Manômetro de Óleo, Combustível e Temperatura */}
          <div className="grid grid-cols-3 gap-1.5 w-full text-center">
            {/* Pressão de Óleo */}
            <div className="flex flex-col items-center p-1.5 rounded-xl bg-black/60 border border-stone-800">
              <span className="text-[7.5px] text-stone-400 uppercase tracking-wider">ÓLEO</span>
              <span className="text-sm font-black text-amber-400 font-mono">
                {oilPressure.toFixed(1)}
              </span>
              <span className="text-[7px] text-stone-500">kgf/cm²</span>
            </div>

            {/* Tanque de Combustível */}
            <div className="flex flex-col items-center p-1.5 rounded-xl bg-black/60 border border-stone-800">
              <span className="text-[7.5px] text-stone-400 uppercase tracking-wider">TANQUE</span>
              <span className="text-sm font-black text-amber-300 font-mono">
                {Math.round(fuelLevelLiters)}L
              </span>
              <span className="text-[7px] text-stone-500">Cap. 65L</span>
            </div>

            {/* Temperatura da Água */}
            <div className="flex flex-col items-center p-1.5 rounded-xl bg-black/60 border border-stone-800">
              <span className="text-[7.5px] text-stone-400 uppercase tracking-wider">H2O</span>
              <span className="text-sm font-black text-white font-mono">
                {Math.round(coolantTemp)}°C
              </span>
              <span className="text-[7px] text-emerald-400">88°C Nom</span>
            </div>
          </div>

          {/* Indicador de Marcha Central */}
          <div className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-neutral-900 border-2 border-stone-700 shadow-inner">
            <span className="text-[8px] text-stone-500 uppercase tracking-widest font-bold">MARCHA</span>
            <span className="text-3xl font-black text-amber-400 leading-none">
              {gear.label}
            </span>
            <span className="text-[7.5px] text-stone-400 font-mono">5M CLARK</span>
          </div>

          {/* Luzes de Alerta Espia dos Anos 80/90 */}
          <div className="flex items-center justify-center gap-2 pt-1 border-t border-stone-800/80 w-full">
            <span
              className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold uppercase border ${
                warningLights.oil
                  ? 'bg-red-600 text-white border-red-500 animate-pulse'
                  : 'bg-stone-900 text-stone-600 border-stone-800'
              }`}
            >
              ÓLEO
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold uppercase border ${
                warningLights.battery
                  ? 'bg-red-600 text-white border-red-500 animate-pulse'
                  : 'bg-stone-900 text-stone-600 border-stone-800'
              }`}
            >
              BATERIA
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold uppercase border ${
                warningLights.brake
                  ? 'bg-red-600 text-white border-red-500 animate-pulse'
                  : 'bg-stone-900 text-stone-600 border-stone-800'
              }`}
            >
              FREIO
            </span>
            {isRevLimiting && (
              <span className="px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase bg-amber-500 text-black animate-ping">
                CORTE!
              </span>
            )}
          </div>
        </div>

        {/* ─── 3. VELOCÍMETRO CLÁSSICO ATÉ 220 KM/H (DIREITA) ─── */}
        <div className="relative flex flex-col items-center">
          <svg width={gaugeSize} height={gaugeSize} className="drop-shadow-lg">
            {/* Fundo do Mostrador */}
            <circle cx={center} cy={center} r={radius + 15} fill="#0a0a0c" stroke="#262626" strokeWidth={3} />
            <circle cx={center} cy={center} r={radius} fill="#141417" stroke="#1f1f23" strokeWidth={1.5} />

            {/* Marcas de Velocidade */}
            {speedMarks.map((m, idx) => {
              const rad = (m.angle * Math.PI) / 180
              const x1 = center + (radius - (m.isMajor ? 14 : 7)) * Math.cos(rad)
              const y1 = center + (radius - (m.isMajor ? 14 : 7)) * Math.sin(rad)
              const x2 = center + radius * Math.cos(rad)
              const y2 = center + radius * Math.sin(rad)
              const tx = center + (radius - 26) * Math.cos(rad)
              const ty = center + (radius - 26) * Math.sin(rad)

              return (
                <g key={idx}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e5e5e5" strokeWidth={m.isMajor ? 2.5 : 1.2} />
                  {m.isMajor && (
                    <text
                      x={tx}
                      y={ty + 4}
                      fill="#f5f5f5"
                      fontSize={10}
                      fontWeight="bold"
                      textAnchor="middle"
                      className="font-mono"
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Odômetro Mecânico de Rolete Retrô */}
            <rect x={center - 32} y={center + 24} width={64} height={18} fill="#0a0a0a" stroke="#444" rx={3} />
            <text x={center} y={center + 37} fill="#ffffff" fontSize={11} fontFamily="monospace" textAnchor="middle" fontWeight="bold">
              048921
            </text>

            <text x={center} y={center - 30} fill="#737373" fontSize={9} textAnchor="middle" fontWeight="bold">
              KM/H
            </text>

            {/* Ponteiro Laranja Fluorescente */}
            <g transform={`rotate(${speedAngle} ${center} ${center})`}>
              <line
                x1={center - 12}
                y1={center}
                x2={center + radius - 10}
                y2={center}
                stroke="#ff4d00"
                strokeWidth={3}
                strokeLinecap="round"
                className="drop-shadow-[0_0_6px_rgba(255,77,0,0.8)]"
              />
              <circle cx={center} cy={center} r={10} fill="#1c1917" stroke="#44403c" strokeWidth={2} />
              <circle cx={center} cy={center} r={4} fill="#ff4d00" />
            </g>
          </svg>

          <span className="text-[11px] font-mono text-stone-300 font-bold mt-1">
            VELOCIDADE: <strong className="text-amber-300 font-black">{Math.round(currentSpeed)} KM/H</strong>
          </span>
        </div>
      </div>
    </div>
  )
})
