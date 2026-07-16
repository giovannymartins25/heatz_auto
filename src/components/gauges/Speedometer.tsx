import { memo, useMemo } from 'react'
import { mapRange } from '@/utils/math'

interface SpeedometerProps {
  speed: number
  maxSpeed: number
}

/**
 * Speedometer — Velocímetro SVG.
 * Menor que o conta-giros, posicionado ao lado.
 */
export const Speedometer = memo(function Speedometer({
  speed,
  maxSpeed,
}: SpeedometerProps) {
  const size = 200
  const center = size / 2
  const radius = 78
  const startAngle = -210
  const endAngle = 30
  const clampedSpeed = Math.min(speed, maxSpeed)

  const needleAngle = mapRange(clampedSpeed, 0, maxSpeed, startAngle, endAngle)

  const marks = useMemo(() => {
    const result: { angle: number; label: string; isMajor: boolean }[] = []
    const step = maxSpeed <= 220 ? 20 : 40
    const minorStep = step / 4

    for (let s = 0; s <= maxSpeed; s += minorStep) {
      const isMajor = s % step === 0
      const angle = mapRange(s, 0, maxSpeed, startAngle, endAngle)
      result.push({ angle, label: isMajor ? String(s) : '', isMajor })
    }

    return result
  }, [maxSpeed, startAngle, endAngle])

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full max-w-[200px]"
      role="img"
      aria-label={`Velocímetro: ${Math.round(speed)} km/h`}
    >
      {/* Fundo */}
      <circle
        cx={center}
        cy={center}
        r={radius + 12}
        fill="var(--color-surface-gauge)"
        stroke="var(--color-border)"
        strokeWidth="1"
      />

      {/* Marcações */}
      {marks.map((mark, i) => {
        const rad = (mark.angle * Math.PI) / 180
        const innerR = mark.isMajor ? radius - 14 : radius - 8
        const outerR = radius - 2

        return (
          <g key={i}>
            <line
              x1={center + innerR * Math.cos(rad)}
              y1={center + innerR * Math.sin(rad)}
              x2={center + outerR * Math.cos(rad)}
              y2={center + outerR * Math.sin(rad)}
              stroke="var(--color-gauge-text)"
              strokeWidth={mark.isMajor ? 2 : 0.8}
              opacity={mark.isMajor ? 0.9 : 0.4}
            />
            {mark.label && (
              <text
                x={center + (innerR - 13) * Math.cos(rad)}
                y={center + (innerR - 13) * Math.sin(rad)}
                fill="var(--color-gauge-text)"
                fontSize="10"
                fontFamily="var(--font-display)"
                fontWeight="500"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {mark.label}
              </text>
            )}
          </g>
        )
      })}

      {/* Agulha */}
      <g
        style={{
          transform: `rotate(${needleAngle}deg)`,
          transformOrigin: `${center}px ${center}px`,
          transition: 'transform 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <line
          x1={center}
          y1={center}
          x2={center + radius - 20}
          y2={center}
          stroke="#4a9eff"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1={center}
          y1={center}
          x2={center + radius - 20}
          y2={center}
          stroke="#4a9eff"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.12"
        />
      </g>

      {/* Centro */}
      <circle cx={center} cy={center} r="6" fill="#4a9eff" />
      <circle cx={center} cy={center} r="3" fill="var(--color-bg-primary)" />

      {/* Label */}
      <text
        x={center}
        y={center + 35}
        fill="var(--color-text-muted)"
        fontSize="9"
        fontFamily="var(--font-mono)"
        textAnchor="middle"
        letterSpacing="0.1em"
      >
        km/h
      </text>
    </svg>
  )
})
