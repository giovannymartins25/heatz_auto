import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { mapRange } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore, type GraphicProfile } from '@/stores/useUIStore'
import { AMBIENT_COLOR_MAP } from '@/utils/ambientLighting'
import { ClusterIndicatorIcon } from '@/components/gauges'

interface ToyotaYarisRealClusterProps {
  telemetry: DashboardTelemetry
  graphicProfile?: GraphicProfile
}

const DIAL_SIZE = 260
const DIAL_CENTER = DIAL_SIZE / 2
const DIAL_RADIUS = 98
const START_ANGLE = -215
const END_ANGLE = 35

interface StaticDialMark {
  x1: number
  y1: number
  x2: number
  y2: number
  tx: number
  ty: number
  label: string
  isMajor: boolean
  isRedzone: boolean
}

function buildDialMarks(
  maxValue: number,
  step: number,
  majorMod: number,
  semiMajorMod: number,
  tickInnerMajor: number,
  tickInnerMinor: number,
  textOffset: number,
  redlineStartValue?: number,
  divideLabelBy?: number,
): StaticDialMark[] {
  const list: StaticDialMark[] = []
  for (let v = 0; v <= maxValue; v += step) {
    const isMajor = v % majorMod === 0
    const isSemiMajor = v % semiMajorMod === 0
    const angle = mapRange(v, 0, maxValue, START_ANGLE, END_ANGLE)
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const markMajor = isMajor || isSemiMajor
    const innerR = markMajor ? DIAL_RADIUS - tickInnerMajor : DIAL_RADIUS - tickInnerMinor
    const outerR = DIAL_RADIUS - 1
    const textR = DIAL_RADIUS - textOffset

    list.push({
      x1: DIAL_CENTER + innerR * cos,
      y1: DIAL_CENTER + innerR * sin,
      x2: DIAL_CENTER + outerR * cos,
      y2: DIAL_CENTER + outerR * sin,
      tx: DIAL_CENTER + textR * cos,
      ty: DIAL_CENTER + textR * sin + 4,
      label: isMajor ? String(divideLabelBy ? v / divideLabelBy : v) : '',
      isMajor: markMajor,
      isRedzone: redlineStartValue !== undefined && v >= redlineStartValue,
    })
  }
  return list
}

const TACH_MARKS: StaticDialMark[] = buildDialMarks(8000, 200, 1000, 500, 14, 7, 24, 6200, 1000)
const SPEED_MARKS: StaticDialMark[] = buildDialMarks(220, 10, 20, 20, 15, 8, 26)
const TACH_REDLINE_ARC = describeArc(
  DIAL_CENTER,
  DIAL_CENTER,
  DIAL_RADIUS - 5,
  mapRange(6200, 0, 8000, START_ANGLE, END_ANGLE),
  END_ANGLE,
)

/**
 * Face estática memoizada do tacômetro Optitron do Yaris:
 * isola gradientes, anéis, arcos e marcações graduadas (zero CSS drop-shadow na GPU).
 */
const YarisTachometerStaticFace = memo(function YarisTachometerStaticFace() {
  return (
    <>
      <defs>
        <radialGradient id="yarisTachBg" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#020810" />
          <stop offset="85%" stopColor="#081424" />
          <stop offset="98%" stopColor="#0f253e" />
          <stop offset="100%" stopColor="#0284c7" />
        </radialGradient>
        <linearGradient id="optitronCyanRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#00f2fe" />
        </linearGradient>
      </defs>

      {/* Halo ciano nativo SVG (substitui CSS drop-shadow custoso na GPU mobile) */}
      <circle
        cx={DIAL_CENTER}
        cy={DIAL_CENTER}
        r={DIAL_RADIUS + 18}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="5.5"
        opacity="0.22"
      />
      <circle
        cx={DIAL_CENTER}
        cy={DIAL_CENTER}
        r={DIAL_RADIUS + 18}
        fill="none"
        stroke="url(#optitronCyanRing)"
        strokeWidth="2.5"
      />

      {/* Fundo escuro azulado Optitron */}
      <circle
        cx={DIAL_CENTER}
        cy={DIAL_CENTER}
        r={DIAL_RADIUS + 15}
        fill="url(#yarisTachBg)"
        stroke="#0f172a"
        strokeWidth="2"
      />

      {/* Inscrição x1000r/min típica da Toyota */}
      <text
        x={DIAL_CENTER}
        y={DIAL_CENTER - 32}
        textAnchor="middle"
        className="fill-sky-400/80 font-mono text-[9px] tracking-wider uppercase font-semibold"
      >
        x1000 r/min
      </text>

      {/* Faixa vermelha de redline (6200 a 8000 RPM) com brilho SVG nativo */}
      <path
        d={TACH_REDLINE_ARC}
        fill="none"
        stroke="#ef4444"
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.24"
      />
      <path
        d={TACH_REDLINE_ARC}
        fill="none"
        stroke="#ef4444"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Marcações pré-computadas do Tacômetro */}
      {TACH_MARKS.map((m, i) => (
        <g key={i}>
          <line
            x1={m.x1}
            y1={m.y1}
            x2={m.x2}
            y2={m.y2}
            stroke={m.isRedzone ? '#ef4444' : '#e0f2fe'}
            strokeWidth={m.isMajor ? 2.2 : 1}
            opacity={m.isMajor ? 0.95 : 0.45}
          />
          {m.label && (
            <text
              x={m.tx}
              y={m.ty}
              textAnchor="middle"
              className={`font-sans text-xs font-bold ${
                m.isRedzone ? 'fill-red-400' : 'fill-sky-100'
              }`}
            >
              {m.label}
            </text>
          )}
        </g>
      ))}
    </>
  )
})

/**
 * Face estática memoizada do velocímetro central Optitron do Yaris:
 * elimina 14 filtros CSS drop-shadow em labels/aros e evita recálculo trigonométrico por frame.
 */
const YarisSpeedometerStaticFace = memo(function YarisSpeedometerStaticFace() {
  return (
    <>
      <defs>
        <radialGradient id="yarisSpeedBg" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#020810" />
          <stop offset="85%" stopColor="#081424" />
          <stop offset="98%" stopColor="#0f253e" />
          <stop offset="100%" stopColor="#0284c7" />
        </radialGradient>
      </defs>

      {/* Halo externo acetinado nativo SVG */}
      <circle
        cx={DIAL_CENTER}
        cy={DIAL_CENTER}
        r={DIAL_RADIUS + 20}
        fill="none"
        stroke="#94a3b8"
        strokeWidth="6.5"
        opacity="0.18"
      />
      <circle
        cx={DIAL_CENTER}
        cy={DIAL_CENTER}
        r={DIAL_RADIUS + 20}
        fill="none"
        stroke="#94a3b8"
        strokeWidth="4"
      />

      {/* Halo ciano Optitron interno */}
      <circle
        cx={DIAL_CENTER}
        cy={DIAL_CENTER}
        r={DIAL_RADIUS + 16}
        fill="url(#yarisSpeedBg)"
        stroke="#0284c7"
        strokeWidth="1.5"
      />

      {/* Inscrição "km/h" central */}
      <text
        x={DIAL_CENTER}
        y={DIAL_CENTER - 36}
        textAnchor="middle"
        className="fill-sky-200 font-sans text-xs tracking-wider uppercase font-black"
      >
        km/h
      </text>

      {/* Marcações pré-computadas de Velocidade */}
      {SPEED_MARKS.map((m, i) => (
        <g key={i}>
          <line
            x1={m.x1}
            y1={m.y1}
            x2={m.x2}
            y2={m.y2}
            stroke="#e0f2fe"
            strokeWidth={m.isMajor ? 2.4 : 1}
            opacity={m.isMajor ? 0.95 : 0.45}
          />
          {m.label && (
            <text
              x={m.tx}
              y={m.ty}
              textAnchor="middle"
              className="font-sans text-[13px] font-black fill-white"
            >
              {m.label}
            </text>
          )}
        </g>
      ))}
    </>
  )
})

const YarisOptitronNeedle = memo(function YarisOptitronNeedle({ angle }: { angle: number }) {
  return (
    <g transform={`rotate(${angle} ${DIAL_CENTER} ${DIAL_CENTER})`}>
      {/* Brilho da agulha em camada SVG nativa (sem drop-shadow CSS) */}
      <line
        x1={DIAL_CENTER}
        y1={DIAL_CENTER}
        x2={DIAL_CENTER + DIAL_RADIUS - 4}
        y2={DIAL_CENTER}
        stroke="#38bdf8"
        strokeWidth="5.5"
        strokeLinecap="round"
        opacity="0.35"
      />
      <line
        x1={DIAL_CENTER}
        y1={DIAL_CENTER}
        x2={DIAL_CENTER + DIAL_RADIUS - 4}
        y2={DIAL_CENTER}
        stroke="#38bdf8"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <line
        x1={DIAL_CENTER + DIAL_RADIUS - 24}
        y1={DIAL_CENTER}
        x2={DIAL_CENTER + DIAL_RADIUS - 4}
        y2={DIAL_CENTER}
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <line
        x1={DIAL_CENTER}
        y1={DIAL_CENTER}
        x2={DIAL_CENTER - 18}
        y2={DIAL_CENTER}
        stroke="#0284c7"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx={DIAL_CENTER} cy={DIAL_CENTER} r="12" fill="#030712" stroke="#38bdf8" strokeWidth="1.5" />
      <circle cx={DIAL_CENTER} cy={DIAL_CENTER} r="4" fill="#0284c7" />
    </g>
  )
})

/**
 * ToyotaYarisRealCluster — Réplica fiel do painel Optitron 3D do Toyota Yaris XLS (Hatch/Sedan).
 *
 * Otimizações de performance mobile (Fase 1.5.4):
 * - Remoção de 17 filtros CSS drop-shadow nos elementos SVG dos mostradores (eliminando re-rasterização offscreen na GPU).
 * - Faces estáticas dos mostradores isoladas em subcomponentes memoizados com coordenadas pré-calculadas.
 * - Barras da tela TFT animadas por escala GPU (transform: scaleX) sem transition-all em width.
 */
export const ToyotaYarisRealCluster = memo(function ToyotaYarisRealCluster({
  telemetry,
  graphicProfile: graphicProfileProp,
}: ToyotaYarisRealClusterProps) {
  const {
    tachometer,
    speedometer,
    gear,
    engine,
    warningLights,
    auxGauges,
    shiftLight,
  } = telemetry

  // ── Ângulo do Tacômetro (0 a 8.000 RPM) ──
  const clampedRpm = Math.min(Math.max(tachometer.rpm, 0), 8000)
  const tachAngle = mapRange(clampedRpm, 0, 8000, START_ANGLE, END_ANGLE)

  // ── Ângulo do Velocímetro Central (0 a 220 km/h) ──
  const clampedSpeed = Math.min(Math.max(speedometer.speed, 0), 220)
  const speedAngle = mapRange(clampedSpeed, 0, 220, START_ANGLE, END_ANGLE)

  // Barra de condução Eco da Toyota (0 a 100% de suavidade no acelerador)
  const ecoPercent = Math.max(0, Math.min(100, Math.round((clampedRpm / 3500) * 100)))
  const ecoScale = ecoPercent / 100
  const fuelScale = Math.max(0, Math.min(1, auxGauges.fuelPercent / 100))
  const tempPercent = Math.min(100, Math.max(10, ((auxGauges.coolantTemp - 50) / 80) * 100))
  const tempScale = tempPercent / 100
  const isEcoActive = clampedRpm > 0 && clampedRpm < 2600 && engine.status === 'RUNNING'

  // Posição do Câmbio Automático Multidrive Toyota
  const isManualSimulated = gear.transmissionMode === 'manual_simulated'
  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const storeGraphicProfile = useUIStore((s) => s.graphicProfile)
  const graphicProfile = graphicProfileProp ?? storeGraphicProfile
  const isEcoGraphic = graphicProfile === 'eco'
  const ambientTheme = AMBIENT_COLOR_MAP[ambientLightColor] || AMBIENT_COLOR_MAP.cyan

  const activePos =
    gear.gearSelectorPosition ||
    (gear.isPark || gear.label === 'P'
      ? 'P'
      : gear.isReverse || gear.label === 'R'
      ? 'R'
      : gear.isNeutral || gear.label === 'N'
      ? 'N'
      : isManualSimulated || gear.label.startsWith('M')
      ? 'M'
      : 'D')

  return (
    <div
      className={`@container relative flex flex-col items-center w-full max-w-4xl p-1.5 sm:p-2.5 rounded-2xl bg-gradient-to-b from-[#060d16] via-[#03070d] to-black border-2 ${ambientTheme.borderClass} ${isEcoGraphic ? '' : ambientTheme.shadowClass} select-none transition-colors duration-300`}
    >
      {/* Luz ambiente de fundo Optitron sincronizada */}
      <div
        className={`absolute inset-x-12 top-0 h-1 bg-gradient-to-r ${ambientTheme.haloGradient} rounded-t-full`}
        style={isEcoGraphic ? undefined : { boxShadow: `0 0 20px ${ambientTheme.glowRgba}` }}
      />

      {/* ── Faixa Superior: 6 Luzes-Espia Reais Toyota ── */}
      <div className="flex items-center justify-between w-full max-w-xl px-3 py-0.5 mb-0.5 rounded-xl bg-sky-950/20 border border-sky-500/10">
        <div className="w-5 h-4 flex items-center justify-center text-emerald-400 font-bold text-xs">
          ◀
        </div>

        <div className="flex items-center gap-3">
          <ClusterIndicatorIcon kind="checkEngine" active={warningLights.checkEngine} sizeClass="w-3.5 h-3.5" />
          <ClusterIndicatorIcon kind="oil" active={warningLights.oil} sizeClass="w-3.5 h-3.5" />
          <ClusterIndicatorIcon kind="battery" active={warningLights.battery} sizeClass="w-3.5 h-3.5" />
          <span
            className={`px-1 rounded text-[9.5px] font-mono font-bold transition-opacity duration-150 ${
              warningLights.brake
                ? `bg-red-600 text-white opacity-100 ${isEcoGraphic ? '' : 'shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`
                : 'text-zinc-800 opacity-30'
            }`}
            title="Freio"
          >
            (P)
          </span>
          <ClusterIndicatorIcon kind="tcs" active={warningLights.tcs} flashing={warningLights.tcsFlash} sizeClass="w-3.5 h-3.5" />
          <ClusterIndicatorIcon kind="temp" active={warningLights.temp} sizeClass="w-3.5 h-3.5" />
          {shiftLight.isActive && (
            <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[9px] font-mono font-black animate-pulse">
              REDLINE
            </span>
          )}
        </div>

        <div className="w-5 h-4 flex items-center justify-center text-emerald-400 font-bold text-xs">
          ▶
        </div>
      </div>

      {/* ── Conjunto de 3 Cilíndros Optitron 3D da Toyota ── */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 w-full flex-wrap @[640px]:flex-nowrap">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 1. CILINDRO ESQUERDO: TACÔMETRO OPTITRON                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`} className="w-[242px] sm:w-[258px]">
            <YarisTachometerStaticFace />
            <YarisOptitronNeedle angle={tachAngle} />
          </svg>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 2. CILINDRO CENTRAL: VELOCÍMETRO + GATE DE CÂMBIO AUTOMÁTICO       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`} className="w-[258px] sm:w-[274px]">
            <YarisSpeedometerStaticFace />

            {/* ── Display Inferior Integrado: P-R-N-D e Temperatura Externa ── */}
            <g transform={`translate(${DIAL_CENTER}, ${DIAL_CENTER + 44})`}>
              <rect
                x="-54"
                y="-14"
                width="108"
                height="28"
                rx="6"
                fill="#030712"
                stroke="#0284c7"
                strokeWidth="1"
              />
              {/* Gate de Marchas Automático Multidrive Toyota */}
              <text
                x="-40"
                y="3"
                className={`font-mono text-[9px] font-bold ${activePos === 'P' ? 'fill-amber-400 font-black' : 'fill-zinc-600'}`}
              >
                P
              </text>
              <text
                x="-24"
                y="3"
                className={`font-mono text-[9px] font-bold ${activePos === 'R' ? 'fill-red-400 font-black' : 'fill-zinc-600'}`}
              >
                R
              </text>
              <text
                x="-8"
                y="3"
                className={`font-mono text-[9px] font-bold ${activePos === 'N' ? 'fill-emerald-400 font-black' : 'fill-zinc-600'}`}
              >
                N
              </text>
              <text
                x="8"
                y="3"
                className={`font-mono text-[9px] font-bold ${activePos === 'D' ? 'fill-cyan-400 font-black' : 'fill-zinc-600'}`}
              >
                D
              </text>
              <text
                x="26"
                y="3"
                className={`font-mono text-[9px] font-bold ${activePos === 'M' ? 'fill-cyan-400 font-black' : 'fill-zinc-600'}`}
              >
                {isManualSimulated ? gear.label : 'M'}
              </text>

              <text x="0" y="11" textAnchor="middle" className="fill-zinc-400 font-mono text-[7px]">
                EXT 27°C · 14:35
              </text>
            </g>

            <YarisOptitronNeedle angle={speedAngle} />
          </svg>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 3. CILINDRO DIREITO: DISPLAY TFT COLORIDO 4.2" (TOYOTA MID)        */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div
          className={`relative flex flex-col items-center justify-between w-48 sm:w-54 h-58 p-3 rounded-2xl bg-zinc-950 border-2 border-sky-900/60 ${
            isEcoGraphic ? '' : 'shadow-[inset_0_2px_15px_rgba(0,0,0,0.9),0_0_20px_rgba(56,189,248,0.1)]'
          }`}
        >
          {/* Tela TFT de Alta Resolução da Toyota */}
          <div
            className={`w-full flex-1 flex flex-col justify-between p-2.5 rounded-xl bg-gradient-to-b from-[#021020] via-[#05182e] to-[#010811] border border-cyan-500/20 ${
              isEcoGraphic ? '' : 'shadow-[inset_0_0_20px_rgba(6,182,212,0.12)]'
            }`}
          >
            {/* Topo do TFT: Modo de Condução e Selo ECO */}
            <div className="flex items-center justify-between w-full border-b border-sky-800/40 pb-1.5">
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  gear.drivingMode === 'eco'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : gear.drivingMode === 'sport'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                }`}
              >
                {gear.drivingMode === 'eco' ? 'ECO MODE' : gear.drivingMode === 'sport' ? 'SPORT' : 'NORMAL'}
              </span>

              {/* Selo Verde ECO Indicator Toyota */}
              <span
                className={`text-[9px] font-sans font-black px-1 rounded flex items-center gap-1 transition-opacity duration-150 ${
                  isEcoActive
                    ? `text-emerald-400 opacity-100 ${isEcoGraphic ? '' : 'shadow-[0_0_8px_rgba(52,211,153,0.8)]'}`
                    : 'text-zinc-600 opacity-40'
                }`}
              >
                🌱 ECO
              </span>
            </div>

            {/* Barra Gráfica Eco Driving Bar da Toyota (animada via transform GPU scaleX, zero layout thrashing) */}
            <div className="w-full my-1.5">
              <div className="flex justify-between text-[7px] font-mono text-zinc-400 mb-0.5">
                <span className="text-emerald-400 font-bold">ECO</span>
                <span>PWR</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-900 border border-white/10 overflow-hidden flex">
                <div
                  className={`w-full h-full origin-left ${
                    ecoPercent > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ transform: `scaleX(${ecoScale})` }}
                />
              </div>
            </div>

            {/* Marcadores Digitais Verticais: Combustível e Arrefecimento */}
            <div className="grid grid-cols-2 gap-2 my-auto">
              {/* Nível de Combustível com seta do bocal à esquerda ◀⛽ */}
              <div className="flex flex-col bg-sky-950/40 rounded-lg p-1.5 border border-sky-800/20">
                <div className="flex justify-between items-center text-[8px] font-mono text-sky-300">
                  <span>◀ ⛽</span>
                  <span className="font-bold">{Math.round(auxGauges.fuelPercent)}%</span>
                </div>
                {/* Barra de Combustível via GPU transform scaleX */}
                <div className="w-full h-1.5 bg-zinc-900 rounded-full mt-1 overflow-hidden">
                  <div
                    className="w-full h-full origin-left bg-cyan-400 rounded-full"
                    style={{ transform: `scaleX(${fuelScale})` }}
                  />
                </div>
                <span className="text-[7px] font-mono text-zinc-400 mt-1">
                  Auton: {Math.round(auxGauges.fuelPercent * 6.8)} km
                </span>
              </div>

              {/* Temperatura do Motor (C ... H) */}
              <div className="flex flex-col bg-sky-950/40 rounded-lg p-1.5 border border-sky-800/20">
                <div className="flex justify-between items-center text-[8px] font-mono text-sky-300">
                  <span>🌡️</span>
                  <span className="font-bold">{Math.round(auxGauges.coolantTemp)}°C</span>
                </div>
                {/* Barra de Temp via GPU transform scaleX */}
                <div className="w-full h-1.5 bg-zinc-900 rounded-full mt-1 overflow-hidden">
                  <div
                    className="w-full h-full origin-left bg-emerald-400 rounded-full"
                    style={{ transform: `scaleX(${tempScale})` }}
                  />
                </div>
                <span className="text-[7px] font-mono text-zinc-400 mt-1">
                  {auxGauges.isTempOptimal ? 'Ideal (90°C)' : 'Aquecendo'}
                </span>
              </div>
            </div>

            {/* Consumo Instantâneo Toyota (km/L) */}
            <div className="flex justify-between items-center border-t border-sky-800/40 pt-1 text-[9px] font-mono">
              <span className="text-zinc-400">Consumo médio:</span>
              <span className="font-bold text-sky-200">14.6 km/L</span>
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
