import { memo, useMemo } from 'react'
import { mapRange } from '@/utils/math'

interface TachometerProps {
  rpm: number
  maxRpm: number
  redlineStart: number
  isRevLimiting?: boolean
  shiftLightActive?: boolean
  shiftLightBlink?: boolean
  theme?: string
}

/**
 * Tachometer — Conta-giros SVG realista com faixas dinâmica e Shift Light integrado.
 *
 * Exibe:
 * - Faixa Normal (0 até 75% do redline): arco neutro discreto
 * - Faixa Elevada (75% até o redline): arco âmbar indicando regime alto
 * - Zona Vermelha (redlineStart até maxRpm): arco vermelho vivo com pulso no corte
 * - Agulha animada acompanhando o RPM real
 * - Shift Light configurável: acende "SHIFT" próximo do redline e pisca no limitador
 */
export const Tachometer = memo(function Tachometer({
  rpm,
  maxRpm,
  redlineStart,
  isRevLimiting = false,
  shiftLightActive = false,
  shiftLightBlink = false,
  theme = 'default',
}: TachometerProps) {
  const size = 280
  const center = size / 2
  const radius = 112
  const startAngle = -210 // graus (7 horas)
  const endAngle = 30     // graus (5 horas)

  // Ângulo da agulha baseado estritamente no RPM real
  const clampedRpm = Math.min(Math.max(rpm, 0), maxRpm)
  const needleAngle = mapRange(clampedRpm, 0, maxRpm, startAngle, endAngle)

  // Faixas angulares
  const elevatedRpmStart = redlineStart * 0.75
  const elevatedAngleStart = mapRange(elevatedRpmStart, 0, maxRpm, startAngle, endAngle)
  const redlineAngleStart = mapRange(redlineStart, 0, maxRpm, startAngle, endAngle)

  // Gerar marcações do tacômetro de acordo com o maxRpm do veículo
  const marks = useMemo(() => {
    const result: { angle: number; label: string; isMajor: boolean; isRedzone: boolean; isElevated: boolean }[] = []
    const step = maxRpm >= 10000 ? 2000 : 1000
    const minorStep = maxRpm >= 10000 ? 500 : 200

    for (let r = 0; r <= maxRpm; r += minorStep) {
      const isMajor = r % step === 0
      const angle = mapRange(r, 0, maxRpm, startAngle, endAngle)
      const isRedzone = r >= redlineStart
      const isElevated = r >= elevatedRpmStart && !isRedzone

      result.push({
        angle,
        label: isMajor ? String(r / 1000) : '',
        isMajor,
        isRedzone,
        isElevated,
      })
    }

    return result
  }, [maxRpm, redlineStart, elevatedRpmStart, startAngle, endAngle])

  const isShift = shiftLightActive || shiftLightBlink || isRevLimiting

  return (
    <div className="relative flex flex-col items-center select-none">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[260px] sm:max-w-[280px]"
        role="img"
        aria-label={`Conta-giros: ${Math.round(rpm)} RPM`}
      >
        <defs>
          {/* Gradiente radial para fundo metálico/esportivo */}
          <radialGradient id="tachBgGrad" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#09090b" />
            <stop offset="95%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#27272a" />
          </radialGradient>
        </defs>

        {/* Fundo do gauge com moldura */}
        <circle
          cx={center}
          cy={center}
          r={radius + 18}
          fill="url(#tachBgGrad)"
          stroke={theme === 'classic' ? '#3f3f46' : '#27272a'}
          strokeWidth={theme === 'classic' ? '3' : '1.5'}
        />

        {/* Anel decorativo interno */}
        <circle
          cx={center}
          cy={center}
          r={radius + 8}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="1"
        />

        {/* 1. Arco Faixa Normal (Neutro) */}
        <ArcPath
          cx={center}
          cy={center}
          r={radius}
          startAngle={startAngle}
          endAngle={elevatedAngleStart}
          stroke="#52525b"
          strokeWidth={3}
          opacity={0.4}
        />

        {/* 2. Arco Faixa Elevada (Âmbar/Amarelo de advertência) */}
        <ArcPath
          cx={center}
          cy={center}
          r={radius}
          startAngle={elevatedAngleStart}
          endAngle={redlineAngleStart}
          stroke="#f59e0b"
          strokeWidth={4}
          opacity={0.65}
        />

        {/* 3. Arco Zona Vermelha (Redline configurado pelo veículo) */}
        <ArcPath
          cx={center}
          cy={center}
          r={radius}
          startAngle={redlineAngleStart}
          endAngle={endAngle}
          stroke="#ef4444"
          strokeWidth={5}
          opacity={isRevLimiting ? 1 : 0.85}
        />

        {/* Marcações e Números */}
        {marks.map((mark, i) => {
          const rad = (mark.angle * Math.PI) / 180
          const innerR = mark.isMajor ? radius - 16 : radius - 8
          const outerR = radius - 1
          const x1 = center + innerR * Math.cos(rad)
          const y1 = center + innerR * Math.sin(rad)
          const x2 = center + outerR * Math.cos(rad)
          const y2 = center + outerR * Math.sin(rad)

          const markColor = mark.isRedzone
            ? '#ef4444'
            : mark.isElevated
            ? '#f59e0b'
            : '#e4e4e7'

          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={markColor}
                strokeWidth={mark.isMajor ? 2.5 : 1}
                opacity={mark.isMajor ? 0.95 : 0.45}
              />
              {mark.label && (
                <text
                  x={center + (innerR - 15) * Math.cos(rad)}
                  y={center + (innerR - 15) * Math.sin(rad)}
                  fill={mark.isRedzone ? '#ef4444' : '#d4d4d8'}
                  fontSize={theme === 'motorcycle' ? 14 : 12}
                  fontFamily="var(--font-display, monospace)"
                  fontWeight="700"
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
            x2={center + radius - 20}
            y2={center}
            stroke="#ef4444"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Brilho da agulha */}
          <line
            x1={center}
            y1={center}
            x2={center + radius - 20}
            y2={center}
            stroke="#ef4444"
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.25"
          />
        </g>

        {/* Centro da agulha */}
        <circle cx={center} cy={center} r="9" fill="#ef4444" />
        <circle cx={center} cy={center} r="4" fill="#09090b" />

        {/* Rótulo Central RPM × 1000 */}
        <text
          x={center}
          y={center + 44}
          fill="#71717a"
          fontSize={9}
          fontFamily="monospace"
          textAnchor="middle"
          letterSpacing="0.12em"
        >
          RPM × 1000
        </text>

        {/* Leitura digital de RPM dentro do mostrador */}
        <text
          x={center}
          y={center + 62}
          fill="#fafafa"
          fontSize={15}
          fontFamily="monospace"
          fontWeight="bold"
          textAnchor="middle"
        >
          {Math.round(rpm)}
        </text>
      </svg>

      {/* SHIFT LIGHT: Acende "SHIFT" próximo da região de corte */}
      {isShift && (
        <div
          className={`absolute top-4 px-3 py-0.5 rounded-full font-mono text-[10px] font-black tracking-widest uppercase transition-all duration-75 ${
            shiftLightBlink || isRevLimiting
              ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,1)] animate-ping'
              : 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.9)] animate-pulse'
          }`}
        >
          ⚡ SHIFT
        </div>
      )}
    </div>
  )
})

/** Componente auxiliar SVG para renderizar arcos precisos */
function ArcPath({
  cx,
  cy,
  r,
  startAngle,
  endAngle,
  stroke,
  strokeWidth,
  opacity = 1,
}: {
  cx: number
  cy: number
  r: number
  startAngle: number
  endAngle: number
  stroke: string
  strokeWidth: number
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
