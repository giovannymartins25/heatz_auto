import { memo, useEffect, useRef } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import type { VehicleConfig } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { BoostGauge } from '@/components/gauges'

interface CockpitViewProps {
  telemetry: DashboardTelemetry
  vehicle: VehicleConfig
}

/**
 * CockpitView — Visão imersiva estilo cabine de pilotagem com horizonte dinâmico e pista.
 *
 * Renderiza:
 * - Pista de asfalto em perspectiva com linhas de velocidade animadas pelo VehiclePhysics real.
 * - Efeito de câmera shake proporcional ao RPM e velocidade.
 * - Barra de shift lights estilo GT3 no para-brisa.
 * - HUD futurista de corrida com velocidade digital, marcha gigante e telemetria.
 */
export const CockpitView = memo(function CockpitView({
  telemetry,
  vehicle,
}: CockpitViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const offsetRef = useRef<number>(0)

  const speed = telemetry.speedometer.speed
  const rpm = telemetry.tachometer.rpm
  const maxRpm = vehicle.engine.maxRpm
  const isRevLimiting = telemetry.shiftLight.isBlinking

  const hasTurbo = useSimulationStore((s) => s.hasTurbo)
  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)

  // Animação de estrada no canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let lastTime = performance.now()

    const render = (time: number) => {
      const dt = (time - lastTime) / 1000
      lastTime = time

      // Velocidade do asfalto baseada na velocidade real (km/h)
      const currentSpeed = speed
      const speedFactor = Math.max(0.05, currentSpeed / 25)
      offsetRef.current = (offsetRef.current + speedFactor * dt * 8) % 1

      const w = canvas.width
      const h = canvas.height

      ctx.clearRect(0, 0, w, h)

      // 1. Céu noturno com gradiente
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.45)
      skyGrad.addColorStop(0, '#050508')
      skyGrad.addColorStop(1, '#0e0e14')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, w, h * 0.45)

      // 2. Horizonte de neon distante
      ctx.strokeStyle = 'rgba(230, 62, 62, 0.15)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, h * 0.45)
      ctx.lineTo(w, h * 0.45)
      ctx.stroke()

      // 3. Pista de asfalto em perspectiva
      const roadTop = h * 0.45
      const roadBottom = h
      const horizonWidth = w * 0.22
      const baseWidth = w * 0.95

      const roadGrad = ctx.createLinearGradient(0, roadTop, 0, roadBottom)
      roadGrad.addColorStop(0, '#101014')
      roadGrad.addColorStop(1, '#060608')
      ctx.fillStyle = roadGrad

      ctx.beginPath()
      ctx.moveTo(w / 2 - horizonWidth / 2, roadTop)
      ctx.lineTo(w / 2 + horizonWidth / 2, roadTop)
      ctx.lineTo(w / 2 + baseWidth / 2, roadBottom)
      ctx.lineTo(w / 2 - baseWidth / 2, roadBottom)
      ctx.closePath()
      ctx.fill()

      // Linhas de zebra nas laterais (vermelho e branco)
      const numSegments = 16
      for (let i = 0; i < numSegments; i++) {
        const segProgress = ((i / numSegments) + offsetRef.current) % 1
        const yTop = roadTop + Math.pow(segProgress, 2.2) * (roadBottom - roadTop)
        const nextProgress = (((i + 0.5) / numSegments) + offsetRef.current) % 1
        const yBottom = roadTop + Math.pow(nextProgress, 2.2) * (roadBottom - roadTop)

        const leftXTop = (w / 2 - horizonWidth / 2) + ((w / 2 - baseWidth / 2) - (w / 2 - horizonWidth / 2)) * Math.pow(segProgress, 2.2)
        const leftXBottom = (w / 2 - horizonWidth / 2) + ((w / 2 - baseWidth / 2) - (w / 2 - horizonWidth / 2)) * Math.pow(nextProgress, 2.2)
        const rightXTop = (w / 2 + horizonWidth / 2) + ((w / 2 + baseWidth / 2) - (w / 2 + horizonWidth / 2)) * Math.pow(segProgress, 2.2)
        const rightXBottom = (w / 2 + horizonWidth / 2) + ((w / 2 + baseWidth / 2) - (w / 2 + horizonWidth / 2)) * Math.pow(nextProgress, 2.2)

        const isAlt = i % 2 === 0
        ctx.fillStyle = isAlt ? '#e63e3e' : '#ffffff'

        // Zebra esquerda
        ctx.beginPath()
        ctx.moveTo(leftXTop - 12, yTop)
        ctx.lineTo(leftXTop, yTop)
        ctx.lineTo(leftXBottom, yBottom)
        ctx.lineTo(leftXBottom - 16, yBottom)
        ctx.closePath()
        ctx.fill()

        // Zebra direita
        ctx.beginPath()
        ctx.moveTo(rightXTop, yTop)
        ctx.lineTo(rightXTop + 12, yTop)
        ctx.lineTo(rightXBottom + 16, yBottom)
        ctx.lineTo(rightXBottom, yBottom)
        ctx.closePath()
        ctx.fill()
      }

      // Linha central pontilhada amarela
      for (let i = 0; i < 8; i++) {
        const segProgress = ((i / 8) + offsetRef.current) % 1
        const yTop = roadTop + Math.pow(segProgress, 2.4) * (roadBottom - roadTop)
        const nextProgress = (((i + 0.35) / 8) + offsetRef.current) % 1
        const yBottom = roadTop + Math.pow(nextProgress, 2.4) * (roadBottom - roadTop)
        const lineWidth = 2 + Math.pow(segProgress, 2.5) * 8

        ctx.fillStyle = 'rgba(251, 191, 36, 0.85)'
        ctx.fillRect(w / 2 - lineWidth / 2, yTop, lineWidth, Math.max(2, yBottom - yTop))
      }

      // Linhas de velocidade (Speed streaks laterais em alta velocidade)
      if (currentSpeed > 60) {
        const intensity = Math.min(1, (currentSpeed - 60) / 120)
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 * intensity})`
        ctx.lineWidth = 1.5

        for (let s = 0; s < 5; s++) {
          const sx = (Math.sin(s * 99 + time * 0.01) * 0.5 + 0.5) * w
          if (sx < w * 0.3 || sx > w * 0.7) {
            ctx.beginPath()
            ctx.moveTo(w / 2, roadTop)
            ctx.lineTo(sx, h)
            ctx.stroke()
          }
        }
      }

      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [speed])

  // Shake da câmera baseado no RPM e velocidade
  const shakeAmount = isRevLimiting ? 3.5 : rpm > maxRpm * 0.85 ? 1.8 : speed > 180 ? 1.2 : 0

  return (
    <div
      className="relative w-full max-w-4xl h-[340px] sm:h-[420px] rounded-3xl overflow-hidden border border-zinc-700/60 shadow-2xl bg-black select-none flex flex-col justify-between"
      style={{
        transform: shakeAmount > 0 ? `translate(${(Math.random() - 0.5) * shakeAmount}px, ${(Math.random() - 0.5) * shakeAmount}px)` : 'none',
      }}
    >
      {/* Canvas da estrada em 3D */}
      <canvas
        ref={canvasRef}
        width={800}
        height={420}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* ─── HUD Superior: Barra de Shift Lights F1 / LEDs ─── */}
      <div className="relative z-10 flex flex-col items-center pt-3 px-4 w-full">
        {/* Barra de LEDs de RPM */}
        <div className="flex items-center justify-center gap-1.5 w-full max-w-lg p-1.5 rounded-full bg-black/75 border border-white/15 backdrop-blur-md">
          {[...Array(16)].map((_, i) => {
            const step = (i + 1) / 16
            const ratio = rpm / maxRpm
            const active = ratio >= step * 0.94
            const isRed = i >= 12
            const isAmber = i >= 8 && i < 12

            return (
              <div
                key={i}
                className={`h-2.5 flex-1 rounded-sm transition-all duration-75 ${
                  isRevLimiting
                    ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)] animate-ping'
                    : active
                    ? isRed
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]'
                      : isAmber
                      ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]'
                      : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                    : 'bg-zinc-800/80'
                }`}
              />
            )
          })}
        </div>

        {/* Alerta de Limitador / Backfire Flash */}
        {isRevLimiting && (
          <div className="mt-1 px-4 py-0.5 rounded-full bg-red-600/90 text-white font-mono font-black text-[10px] tracking-widest uppercase animate-pulse shadow-lg shadow-red-500/50">
            💥 CORTE DE GIRO! 💥
          </div>
        )}

        {/* Alerta de Launch Control */}
        {isLaunchControlArmed && (
          <div className="mt-1 px-4 py-1 rounded-full bg-amber-500/90 text-zinc-950 font-mono font-black text-[11px] tracking-widest uppercase animate-pulse shadow-lg shadow-amber-500/50">
            🏁 LAUNCH CONTROL ATIVO · SOLTE O FREIO! 🏁
          </div>
        )}
        {isLaunching && (
          <div className="mt-1 px-4 py-1 rounded-full bg-emerald-500/90 text-zinc-950 font-mono font-black text-[11px] tracking-widest uppercase shadow-lg shadow-emerald-500/50">
            🚀 LARGADA! 🚀
          </div>
        )}
      </div>

      {/* ─── HUD Central: Marcha, Velocidade, Rotação e Turbo Boost ─── */}
      <div className="relative z-10 flex flex-wrap items-center justify-around w-full px-4 sm:px-12 my-auto gap-4">
        {/* Velocímetro Digital HUD */}
        <div className="flex flex-col items-center p-3 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Velocidade</span>
          <span className="text-4xl sm:text-6xl font-mono font-black text-white tracking-tight leading-none">
            {Math.round(speed)}
          </span>
          <span className="text-[10px] font-mono text-zinc-400 tracking-wider">KM/H</span>
        </div>

        {/* Indicador de Marcha em Moldura de Volante */}
        <div className="relative flex flex-col items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-zinc-950/90 border-2 border-[var(--color-accent)] shadow-[0_0_30px_var(--color-accent-muted)] backdrop-blur-lg">
          <span className="text-4xl sm:text-5xl font-mono font-black text-[var(--color-accent)] leading-none">
            {telemetry.gear.label}
          </span>
          <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase mt-1">
            {telemetry.gear.subLabel}
          </span>
        </div>

        {/* Conta-giros Digital HUD */}
        <div className="flex flex-col items-center p-3 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Rotação</span>
          <span
            className={`text-4xl sm:text-6xl font-mono font-black tracking-tight leading-none ${
              rpm > maxRpm * 0.9 ? 'text-red-500 animate-pulse' : 'text-zinc-200'
            }`}
          >
            {Math.round(rpm)}
          </span>
          <span className="text-[10px] font-mono text-zinc-400 tracking-wider">RPM</span>
        </div>

        {/* Turbo Boost Gauge (Apenas veículos com Turbo) */}
        {hasTurbo && (
          <div className="flex flex-col items-center p-2 rounded-2xl bg-black/70 border border-white/15 backdrop-blur-md shadow-xl">
            <BoostGauge boostBar={boostPressureBar} peakBar={peakBoostBar} size={110} />
          </div>
        )}
      </div>

      {/* ─── Moldura Inferior: Painel de Fibra de Carbono / Telemetria ─── */}
      <div className="relative z-10 w-full p-3 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent border-t border-white/10 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 uppercase tracking-wider">{vehicle.info.brand}</span>
          <span className="text-white font-bold">{vehicle.info.name}</span>
        </div>

        {/* Telemetria rápida de Pedais */}
        <div className="flex items-center gap-4 text-[10px] text-zinc-400">
          <span>THR: <b className="text-emerald-400">{Math.round(telemetry.pedals.throttlePercent)}%</b></span>
          <span>BRK: <b className="text-red-400">{Math.round(telemetry.pedals.brakePercent)}%</b></span>
          {telemetry.pedals.hasClutch && (
            <span>CLU: <b className="text-blue-400">{Math.round(telemetry.pedals.clutchPercent ?? 0)}%</b></span>
          )}
        </div>
      </div>
    </div>
  )
})

