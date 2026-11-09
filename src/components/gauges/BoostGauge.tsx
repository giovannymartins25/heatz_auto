import { memo, useMemo } from 'react'
import { mapRange } from '@/utils/math'

interface BoostGaugeProps {
  boostBar: number
  peakBar?: number
  size?: number
  className?: string
}

/**
 * BoostGauge — Manômetro analógico e digital de pressão de turbo.
 *
 * Exibido estritamente em veículos sobrealimentados por turbo (ex: Golf GTI 2.0 TSI).
 * - Faixa de Vácuo: -1.0 a 0.0 bar (coletor de admissão em desaceleração/marcha lenta)
 * - Faixa de Pressão Positiva: 0.0 a +2.0 bar (turbina pressurizada)
 * - Indicador de Pico (Peak Hold) da puxada
 * - Camadas SVG nativas de alta performance sem CSS filter para eliminar qualquer flicker.
 */
export const BoostGauge = memo(function BoostGauge({
  boostBar,
  peakBar = 0,
  size = 180,
  className = '',
}: BoostGaugeProps) {
  const center = size / 2
  const radius = size * 0.38
  const startAngle = -215
  const endAngle = 35

  const minBar = -1.0
  const maxBar = 2.0

  const clampedBoost = Math.min(Math.max(boostBar, minBar), maxBar)
  const needleAngle = mapRange(clampedBoost, minBar, maxBar, startAngle, endAngle)
  const clampedPeak = Math.min(Math.max(peakBar, minBar), maxBar)
  const peakAngle = mapRange(clampedPeak, minBar, maxBar, startAngle, endAngle)

  // Marcações da escala: -1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0 bar
  const marks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isPositive: boolean; isOverboost: boolean }[] = []
    const step = 0.25
    const count = Math.round((maxBar - minBar) / step)

    for (let i = 0; i <= count; i++) {
      const val = Math.round((minBar + i * step) * 100) / 100
      const isMajor = Math.abs(val % 0.5) < 0.01
      const angle = mapRange(val, minBar, maxBar, startAngle, endAngle)

      list.push({
        angle,
        label: isMajor ? (val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)) : '',
        isMajor,
        isPositive: val > 0,
        isOverboost: val >= 1.5,
      })
    }
    return list
  }, [minBar, maxBar, startAngle, endAngle])

  const isPositive = boostBar > 0.05
  const displayVal = boostBar > 0 ? `+${boostBar.toFixed(2)}` : boostBar.toFixed(2)

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto drop-shadow-md">
        <defs>
          <radialGradient id="boostDialBg" cx="50%" cy="50%" r="50%">
            <stop offset="65%" stopColor="#08090c" />
            <stop offset="92%" stopColor="#111318" />
            <stop offset="100%" stopColor="#1e2029" />
          </radialGradient>
          <linearGradient id="boostNeedleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
        </defs>

        {/* Aro externo esportivo */}
        <circle cx={center} cy={center} r={radius + 16} fill="none" stroke="#27272a" strokeWidth="2.5" />
        <circle cx={center} cy={center} r={radius + 14} fill="url(#boostDialBg)" stroke="#18181b" strokeWidth="1.5" />

        {/* Arco de Vácuo (-1.0 a 0.0 bar) */}
        <path
          d={describeArc(center, center, radius - 4, startAngle, mapRange(0, minBar, maxBar, startAngle, endAngle))}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="3"
          opacity="0.45"
        />

        {/* Arco de Pressão Positiva (0.0 a 1.5 bar) */}
        <path
          d={describeArc(
            center,
            center,
            radius - 4,
            mapRange(0, minBar, maxBar, startAngle, endAngle),
            mapRange(1.5, minBar, maxBar, startAngle, endAngle),
          )}
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
          opacity="0.6"
        />

        {/* Arco de Overboost (1.5 a 2.0 bar) */}
        <path
          d={describeArc(
            center,
            center,
            radius - 4,
            mapRange(1.5, minBar, maxBar, startAngle, endAngle),
            endAngle,
          )}
          fill="none"
          stroke="#ef4444"
          strokeWidth="3"
          opacity="0.8"
        />

        {/* Marcações da escala */}
        {marks.map((m, i) => {
          const rad = (m.angle * Math.PI) / 180
          const innerR = m.isMajor ? radius - 11 : radius - 6
          const outerR = radius - 1
          const x1 = center + innerR * Math.cos(rad)
          const y1 = center + innerR * Math.sin(rad)
          const x2 = center + outerR * Math.cos(rad)
          const y2 = center + outerR * Math.sin(rad)

          const textR = radius - 19
          const tx = center + textR * Math.cos(rad)
          const ty = center + textR * Math.sin(rad) + 3

          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={m.isOverboost ? '#ef4444' : m.isPositive ? '#10b981' : '#38bdf8'}
                strokeWidth={m.isMajor ? 1.8 : 0.9}
                opacity={m.isMajor ? 0.9 : 0.4}
              />
              {m.label && (
                <text
                  x={tx}
                  y={ty}
                  textAnchor="middle"
                  className={`font-mono text-[7px] font-bold ${
                    m.isOverboost
                      ? 'fill-red-400'
                      : m.isPositive
                      ? 'fill-emerald-300'
                      : 'fill-sky-300'
                  }`}
                >
                  {m.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Label Central TURBO BOOST */}
        <text
          x={center}
          y={center - 24}
          textAnchor="middle"
          className="fill-zinc-400 font-mono text-[7px] tracking-widest font-black uppercase"
        >
          TURBO BOOST
        </text>

        {/* Marcador de Pico (Peak Hold) */}
        {peakBar > 0.1 && (
          <g transform={`rotate(${peakAngle} ${center} ${center})`}>
            <line
              x1={center + radius - 12}
              y1={center}
              x2={center + radius - 1}
              y2={center}
              stroke="#fbbf24"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Display Digital Central de Pressão */}
        <g transform={`translate(${center}, ${center + 20})`}>
          <rect
            x="-26"
            y="-10"
            width="52"
            height="18"
            rx="4"
            fill="#090a0d"
            stroke="#27272a"
            strokeWidth="1"
          />
          <text
            x="0"
            y="2"
            textAnchor="middle"
            className={`font-mono text-[10px] font-black ${
              isPositive ? 'fill-emerald-400' : 'fill-sky-400'
            }`}
          >
            {displayVal}
          </text>
          <text
            x="0"
            y="14"
            textAnchor="middle"
            className="font-mono text-[6px] font-bold fill-zinc-500"
          >
            BAR
          </text>
        </g>

        {/* Agulha Vermelha de Pressão (Camadas SVG nativas) */}
        <g transform={`rotate(${needleAngle} ${center} ${center})`}>
          <line
            x1={center}
            y1={center}
            x2={center + radius - 3}
            y2={center}
            stroke="#f87171"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.3"
          />
          <line
            x1={center}
            y1={center}
            x2={center + radius - 3}
            y2={center}
            stroke="url(#boostNeedleGrad)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <line
            x1={center}
            y1={center}
            x2={center - 12}
            y2={center}
            stroke="#991b1b"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx={center} cy={center} r="7" fill="#18181b" stroke="#f87171" strokeWidth="1" />
          <circle cx={center} cy={center} r="2.5" fill="#ef4444" />
        </g>
      </svg>

      {/* Indicador de Pico Máximo */}
      {peakBar > 0.1 && (
        <div className="text-[9px] font-mono font-bold text-amber-400 mt-0.5 flex items-center gap-1">
          <span className="text-zinc-500 text-[8px]">PEAK:</span>
          <span>+{peakBar.toFixed(2)} BAR</span>
        </div>
      )}
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
