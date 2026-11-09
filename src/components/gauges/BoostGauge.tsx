import { memo, useMemo } from 'react'
import { mapRange, clamp } from '@/utils/math'

interface BoostGaugeProps {
  boostBar: number
  peakBar?: number
  size?: number
  className?: string
  showPeak?: boolean
  showLabel?: boolean
}

/**
 * BoostGauge — Manômetro analógico e digital de precisão para pressão de turbo.
 *
 * Utiliza sistema vetorial normalizado (viewBox 0 0 100 100), garantindo escalabilidade
 * perfeita e proporcional em qualquer tamanho (60px, 80px, 120px) sem cortes ou distorções.
 *
 * - Faixa de Vácuo: -1.0 a 0.0 bar (admissão em desaceleração / marcha lenta)
 * - Faixa de Pressão Positiva: 0.0 a +1.5 bar (pressão de trabalho do turbo)
 * - Faixa de Overboost: +1.5 a +2.0 bar (pico de sobrealimentação)
 * - Retenção de Pico (Peak Hold) em dourado esportivo
 * - Display digital central de alta visibilidade
 */
export const BoostGauge = memo(function BoostGauge({
  boostBar,
  peakBar = 0,
  size = 80,
  className = '',
  showPeak = true,
  showLabel = true,
}: BoostGaugeProps) {
  // Coordenadas normalizadas em viewBox 0 0 100 100
  const center = 50
  const radius = 37
  const startAngle = -215
  const endAngle = 35

  const minBar = -1.0
  const maxBar = 2.0

  const clampedBoost = clamp(boostBar, minBar, maxBar)
  const needleAngle = mapRange(clampedBoost, minBar, maxBar, startAngle, endAngle)
  const clampedPeak = clamp(peakBar, minBar, maxBar)
  const peakAngle = mapRange(clampedPeak, minBar, maxBar, startAngle, endAngle)

  // Escala de marcações
  const marks = useMemo(() => {
    const list: { angle: number; label: string; isMajor: boolean; isPositive: boolean; isOverboost: boolean }[] = []
    const step = 0.5
    const count = Math.round((maxBar - minBar) / step)

    for (let i = 0; i <= count; i++) {
      const val = Math.round((minBar + i * step) * 10) / 10
      const angle = mapRange(val, minBar, maxBar, startAngle, endAngle)
      list.push({
        angle,
        label: val === 0 ? '0' : val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1),
        isMajor: true,
        isPositive: val > 0,
        isOverboost: val >= 1.5,
      })
    }
    return list
  }, [minBar, maxBar, startAngle, endAngle])

  const isPositive = boostBar > 0.05
  const displayVal = boostBar > 0 ? `+${boostBar.toFixed(2)}` : boostBar.toFixed(2)

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm overflow-visible">
        <defs>
          <radialGradient id="boostDialBgNorm" cx="50%" cy="50%" r="50%">
            <stop offset="65%" stopColor="#090a0f" />
            <stop offset="90%" stopColor="#12141c" />
            <stop offset="100%" stopColor="#1e2230" />
          </radialGradient>
          <linearGradient id="boostNeedleGradNorm" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
        </defs>

        {/* Aro externo automotivo */}
        <circle cx={center} cy={center} r={radius + 8} fill="none" stroke="#27272a" strokeWidth="1.5" />
        <circle cx={center} cy={center} r={radius + 7} fill="url(#boostDialBgNorm)" stroke="#18181b" strokeWidth="1" />

        {/* Arco de Vácuo (-1.0 a 0.0 bar) */}
        <path
          d={describeArc(center, center, radius - 2, startAngle, mapRange(0, minBar, maxBar, startAngle, endAngle))}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
          opacity="0.5"
        />

        {/* Arco de Pressão Positiva (0.0 a 1.5 bar) */}
        <path
          d={describeArc(
            center,
            center,
            radius - 2,
            mapRange(0, minBar, maxBar, startAngle, endAngle),
            mapRange(1.5, minBar, maxBar, startAngle, endAngle),
          )}
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
          opacity="0.75"
        />

        {/* Arco de Overboost (1.5 a 2.0 bar) */}
        <path
          d={describeArc(
            center,
            center,
            radius - 2,
            mapRange(1.5, minBar, maxBar, startAngle, endAngle),
            endAngle,
          )}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          opacity="0.85"
        />

        {/* Marcações da escala */}
        {marks.map((m, i) => {
          const rad = (m.angle * Math.PI) / 180
          const innerR = radius - 6
          const outerR = radius - 1
          const x1 = center + innerR * Math.cos(rad)
          const y1 = center + innerR * Math.sin(rad)
          const x2 = center + outerR * Math.cos(rad)
          const y2 = center + outerR * Math.sin(rad)

          const textR = radius - 11
          const tx = center + textR * Math.cos(rad)
          const ty = center + textR * Math.sin(rad) + 1.8

          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={m.isOverboost ? '#ef4444' : m.isPositive ? '#10b981' : '#38bdf8'}
                strokeWidth={1.2}
                opacity={0.8}
              />
              <text
                x={tx}
                y={ty}
                textAnchor="middle"
                fontSize="4"
                fontFamily="monospace"
                fontWeight="bold"
                className={
                  m.isOverboost
                    ? 'fill-red-400'
                    : m.isPositive
                    ? 'fill-emerald-300'
                    : 'fill-sky-300'
                }
              >
                {m.label}
              </text>
            </g>
          )
        })}

        {/* Rótulo BOOST se habilitado */}
        {showLabel && (
          <text
            x={center}
            y={center - 13}
            textAnchor="middle"
            fontSize="4.2"
            fontFamily="monospace"
            fontWeight="900"
            className="fill-zinc-400 tracking-wider uppercase"
          >
            BOOST
          </text>
        )}

        {/* Marcador de Pico Máximo (Peak Hold) */}
        {peakBar > 0.1 && (
          <g transform={`rotate(${peakAngle} ${center} ${center})`}>
            <line
              x1={center + radius - 7}
              y1={center}
              x2={center + radius - 1}
              y2={center}
              stroke="#fbbf24"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Display Digital Central de Pressão */}
        <g transform={`translate(${center}, ${center + 12})`}>
          <rect
            x="-16"
            y="-6"
            width="32"
            height="12"
            rx="2.5"
            fill="#080a0e"
            stroke="#27272a"
            strokeWidth="0.8"
          />
          <text
            x="0"
            y="1"
            textAnchor="middle"
            fontSize="5.8"
            fontFamily="monospace"
            fontWeight="900"
            className={isPositive ? 'fill-emerald-400' : 'fill-sky-400'}
          >
            {displayVal}
          </text>
          <text
            x="0"
            y="5"
            textAnchor="middle"
            fontSize="3"
            fontFamily="monospace"
            fontWeight="bold"
            className="fill-zinc-400"
          >
            BAR
          </text>
        </g>

        {/* Agulha Vermelha Esportiva */}
        <g transform={`rotate(${needleAngle} ${center} ${center})`}>
          <line
            x1={center}
            y1={center}
            x2={center + radius - 2}
            y2={center}
            stroke="#f87171"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.25"
          />
          <line
            x1={center}
            y1={center}
            x2={center + radius - 2}
            y2={center}
            stroke="url(#boostNeedleGradNorm)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1={center}
            y1={center}
            x2={center - 7}
            y2={center}
            stroke="#991b1b"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx={center} cy={center} r="4" fill="#18181b" stroke="#f87171" strokeWidth="0.8" />
          <circle cx={center} cy={center} r="1.5" fill="#ef4444" />
        </g>
      </svg>

      {/* Indicador de Pico Pequeno */}
      {showPeak && peakBar > 0.1 && (
        <div className="text-[8px] font-mono font-bold text-amber-400 mt-0.5 flex items-center gap-1">
          <span className="text-zinc-500 text-[7px]">PK:</span>
          <span>+{peakBar.toFixed(2)}</span>
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
