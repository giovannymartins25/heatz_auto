import { memo, useMemo } from 'react'
import { mapRange } from '@/utils/math'

interface SpeedometerProps {
  speed: number
  maxSpeed: number
  theme?: string
}

/**
 * Speedometer — Velocímetro SVG com agulha animada e velocidade calculada pelo VehiclePhysics.
 *
 * Utiliza estritamente a velocidade física real do veículo (km/h), sem conversão artificial de RPM.
 */
export const Speedometer = memo(function Speedometer({
  speed,
  maxSpeed,
  theme = 'default',
}: SpeedometerProps) {
  const size = 220
  const center = size / 2
  const radius = 86
  const startAngle = -210
  const endAngle = 30

  // Velocidade física real (km/h) limitada à escala
  const clampedSpeed = Math.min(Math.max(speed, 0), maxSpeed)
  const needleAngle = mapRange(clampedSpeed, 0, maxSpeed, startAngle, endAngle)

  const marks = useMemo(() => {
    const result: { angle: number; label: string; isMajor: boolean }[] = []
    const step = maxSpeed <= 220 ? 20 : 30
    const minorStep = step / 2

    for (let s = 0; s <= maxSpeed; s += minorStep) {
      const isMajor = s % step === 0
      const angle = mapRange(s, 0, maxSpeed, startAngle, endAngle)
      result.push({ angle, label: isMajor ? String(s) : '', isMajor })
    }

    return result
  }, [maxSpeed, startAngle, endAngle])

  return (
    <div className="flex flex-col items-center select-none">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[200px] sm:max-w-[220px]"
        role="img"
        aria-label={`Velocímetro: ${Math.round(speed)} km/h`}
      >
        <defs>
          <radialGradient id="speedBgGrad" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#09090b" />
            <stop offset="95%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#27272a" />
          </radialGradient>
        </defs>

        {/* Fundo circular */}
        <circle
          cx={center}
          cy={center}
          r={radius + 15}
          fill="url(#speedBgGrad)"
          stroke={theme === 'classic' ? '#3f3f46' : '#27272a'}
          strokeWidth={theme === 'classic' ? '3' : '1.5'}
        />

        {/* Arco sutil de fundo */}
        <circle
          cx={center}
          cy={center}
          r={radius + 6}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="1"
        />

        {/* Marcações de velocidade */}
        {marks.map((mark, i) => {
          const rad = (mark.angle * Math.PI) / 180
          const innerR = mark.isMajor ? radius - 14 : radius - 7
          const outerR = radius - 1
          const x1 = center + innerR * Math.cos(rad)
          const y1 = center + innerR * Math.sin(rad)
          const x2 = center + outerR * Math.cos(rad)
          const y2 = center + outerR * Math.sin(rad)

          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#e4e4e7"
                strokeWidth={mark.isMajor ? 2 : 0.9}
                opacity={mark.isMajor ? 0.9 : 0.35}
              />
              {mark.label && (
                <text
                  x={center + (innerR - 12) * Math.cos(rad)}
                  y={center + (innerR - 12) * Math.sin(rad)}
                  fill="#d4d4d8"
                  fontSize={10}
                  fontFamily="monospace"
                  fontWeight="600"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {mark.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Agulha em rotação pura SVG */}
        <g
          style={{
            transform: `rotate(${needleAngle}deg)`,
            transformOrigin: `${center}px ${center}px`,
            transition: 'transform 0.05s cubic-bezier(0.2, 0, 0.2, 1)',
          }}
        >
          <line
            x1={center}
            y1={center}
            x2={center + radius - 16}
            y2={center}
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1={center}
            y1={center}
            x2={center + radius - 16}
            y2={center}
            stroke="#38bdf8"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.25"
          />
        </g>

        {/* Centro da agulha */}
        <circle cx={center} cy={center} r="7" fill="#38bdf8" />
        <circle cx={center} cy={center} r="3" fill="#09090b" />

        {/* Unidade km/h */}
        <text
          x={center}
          y={center + 36}
          fill="#71717a"
          fontSize={9}
          fontFamily="monospace"
          textAnchor="middle"
          letterSpacing="0.1em"
        >
          km/h
        </text>

        {/* Leitura digital no velocímetro */}
        <text
          x={center}
          y={center + 52}
          fill="#38bdf8"
          fontSize={14}
          fontFamily="monospace"
          fontWeight="bold"
          textAnchor="middle"
        >
          {Math.round(speed)}
        </text>
      </svg>
    </div>
  )
})
