import { memo, useMemo } from 'react'
import { mapRange } from '@/utils/math'

interface TachometerProps {
  rpm: number
  maxRpm: number
  redlineStart: number
  isRevLimiting: boolean
}

/**
 * Tachometer — Conta-giros SVG realista.
 *
 * Arco de 240° com marcações numeradas, zona vermelha,
 * e agulha que se move suavemente com o RPM.
 *
 * A zona vermelha é definida pelo veículo (redlineStart).
 * Ex: Gol G6 começa em 6000, CB1000R em 10500.
 */
export const Tachometer = memo(function Tachometer({
  rpm,
  maxRpm,
  redlineStart,
  isRevLimiting,
}: TachometerProps) {
  const size = 280
  const center = size / 2
  const radius = 115
  const startAngle = -210 // graus (7 horas)
  const endAngle = 30    // graus (5 horas)

  // Ângulo da agulha baseado no RPM
  const needleAngle = mapRange(rpm, 0, maxRpm, startAngle, endAngle)

  // Gerar marcações do conta-giros
  const marks = useMemo(() => {
    const result: { angle: number; label: string; isMajor: boolean; isRedzone: boolean }[] = []
    const step = maxRpm <= 8000 ? 1000 : 1000
    const minorStep = step / 5

    for (let r = 0; r <= maxRpm; r += minorStep) {
      const isMajor = r % step === 0
      const angle = mapRange(r, 0, maxRpm, startAngle, endAngle)
      const isRedzone = r >= redlineStart

      result.push({
        angle,
        label: isMajor ? String(r / 1000) : '',
        isMajor,
        isRedzone,
      })
    }

    return result
  }, [maxRpm, redlineStart, startAngle, endAngle])

  // Arco da zona vermelha
  const redlineAngleStart = mapRange(redlineStart, 0, maxRpm, startAngle, endAngle)

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full max-w-[280px]"
      role="img"
      aria-label={`Conta-giros: ${Math.round(rpm)} RPM`}
    >
      {/* Fundo do gauge */}
      <circle
        cx={center}
        cy={center}
        r={radius + 15}
        fill="var(--color-surface-gauge)"
        stroke="var(--color-border)"
        strokeWidth="1"
      />

      {/* Arco de fundo */}
      <ArcPath
        cx={center}
        cy={center}
        r={radius}
        startAngle={startAngle}
        endAngle={endAngle}
        stroke="var(--color-gauge-mark)"
        strokeWidth={3}
        opacity={0.3}
      />

      {/* Arco da zona vermelha */}
      <ArcPath
        cx={center}
        cy={center}
        r={radius}
        startAngle={redlineAngleStart}
        endAngle={endAngle}
        stroke="var(--color-gauge-redzone)"
        strokeWidth={5}
        opacity={isRevLimiting ? 1 : 0.7}
      />

      {/* Marcações */}
      {marks.map((mark, i) => {
        const rad = (mark.angle * Math.PI) / 180
        const innerR = mark.isMajor ? radius - 18 : radius - 10
        const outerR = radius - 2
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
              stroke={mark.isRedzone ? 'var(--color-gauge-redzone)' : 'var(--color-gauge-text)'}
              strokeWidth={mark.isMajor ? 2.5 : 1}
              opacity={mark.isMajor ? 1 : 0.5}
            />
            {mark.label && (
              <text
                x={center + (innerR - 16) * Math.cos(rad)}
                y={center + (innerR - 16) * Math.sin(rad)}
                fill={mark.isRedzone ? 'var(--color-gauge-redzone)' : 'var(--color-gauge-text)'}
                fontSize={13}
                fontFamily="var(--font-display)"
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

      {/* Agulha */}
      <g
        style={{
          transform: `rotate(${needleAngle}deg)`,
          transformOrigin: `${center}px ${center}px`,
          transition: 'transform 0.06s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <line
          x1={center}
          y1={center}
          x2={center + radius - 25}
          y2={center}
          stroke="var(--color-surface-needle)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Glow da agulha */}
        <line
          x1={center}
          y1={center}
          x2={center + radius - 25}
          y2={center}
          stroke="var(--color-surface-needle)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.15"
        />
      </g>

      {/* Centro da agulha */}
      <circle cx={center} cy={center} r="8" fill="var(--color-surface-needle)" />
      <circle cx={center} cy={center} r="4" fill="var(--color-bg-primary)" />

      {/* Label RPM */}
      <text
        x={center}
        y={center + 45}
        fill="var(--color-text-muted)"
        fontSize={10}
        fontFamily="var(--font-mono)"
        textAnchor="middle"
        letterSpacing="0.1em"
      >
        RPM × 1000
      </text>
    </svg>
  )
})

/** Componente auxiliar para desenhar arcos SVG */
function ArcPath({
  cx, cy, r, startAngle, endAngle, stroke, strokeWidth, opacity = 1,
}: {
  cx: number; cy: number; r: number
  startAngle: number; endAngle: number
  stroke: string; strokeWidth: number
  opacity?: number
}) {
  const startRad = (startAngle * Math.PI) / 180
  const endRad = (endAngle * Math.PI) / 180
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0

  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`

  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      opacity={opacity}
    />
  )
}
