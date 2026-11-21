import { useEffect, useRef, memo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { WorldMap } from '@/systems/world/WorldMap'
import type { VehicleConfig } from '@/types/vehicle'

interface DrivingWorldCanvasProps {
  vehicle?: VehicleConfig
  className?: string
  cameraMode?: 'follow' | 'north_up'
  zoomScale?: number // pixels por metro
}

interface SkidMark {
  x: number
  y: number
  opacity: number
}

interface SmokeParticle {
  x: number
  y: number
  radius: number
  opacity: number
  vx: number
  vy: number
  life: number
}

/**
 * DrivingWorldCanvas — Renderizador 2D Top-Down de alta performance em Canvas.
 * Executa em loop requestAnimationFrame direto sobre a store sem overhead de re-renderização do React.
 */
export const DrivingWorldCanvas = memo(function DrivingWorldCanvas({
  vehicle,
  className = '',
  cameraMode = 'follow',
  zoomScale = 4.2,
}: DrivingWorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameIdRef = useRef<number | null>(null)

  // Histórico de marcas de pneu (Skid marks) persistentes na pista
  const skidMarksRef = useRef<SkidMark[]>([])
  const smokeParticlesRef = useRef<SmokeParticle[]>([])

  // Suavização da câmera (lerp) — inicia centrada no ponto seguro de spawn
  const cameraRef = useRef<{ x: number; y: number; headingDeg: number }>({
    x: WorldMap.SPAWN_X,
    y: WorldMap.SPAWN_Y,
    headingDeg: WorldMap.SPAWN_HEADING_DEG,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let lastTime = performance.now()

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1)
      lastTime = time

      // Leitura direta do estado sem subscribe reativo do React
      const state = useSimulationStore.getState()
      const carX = state.visualPositionX ?? state.positionX ?? 0
      const carY = state.visualPositionY ?? state.positionY ?? 0
      const carHeadingDeg = state.visualHeadingDeg ?? state.headingDeg ?? 0
      const carSpeed = state.visualSpeed ?? state.speed ?? 0
      const steeringAngle = state.steeringAngle ?? 0
      const brake = state.brake ?? 0
      const currentGear = state.currentGear ?? 0
      const isReverse = currentGear === -1
      const isWheelSlipping = state._phys?.isClutchSlipping || (state.speed > 5 && Math.abs(state._phys?.clutchSlipRpm || 0) > 80) || state._phys?.isBurningOut
      const isAirbrake = state.isAirbrakeActive
      const headlightsOn = state.headlightsMode !== 'off'

      // Ajusta dimensões do canvas ao tamanho real do elemento
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const width = Math.floor(rect.width * dpr)
      const height = Math.floor(rect.height * dpr)

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      // Suavização da câmera (10 Hz lerp)
      const camLerp = Math.min(1.0, dt * 12.0)
      cameraRef.current.x += (carX - cameraRef.current.x) * camLerp
      cameraRef.current.y += (carY - cameraRef.current.y) * camLerp

      let targetHeading = cameraMode === 'follow' ? carHeadingDeg : 0
      let dH = targetHeading - cameraRef.current.headingDeg
      while (dH > 180) dH -= 360
      while (dH < -180) dH += 360
      cameraRef.current.headingDeg += dH * camLerp

      // Limpa quadro com fundo de asfalto/terreno urbano
      ctx.fillStyle = '#070b12'
      ctx.fillRect(0, 0, width, height)

      ctx.save()
      // Centro da viewport
      ctx.translate(width / 2, height / 2)

      // Escala métrica (pixels por metro)
      const scale = zoomScale * dpr
      ctx.scale(scale, scale)

      // Rotação da câmera
      const camRad = (cameraRef.current.headingDeg * Math.PI) / 180
      if (cameraMode === 'follow') {
        ctx.rotate(-camRad)
      }
      ctx.translate(-cameraRef.current.x, cameraRef.current.y) // Inverte Y para +Y ser Norte

      // ─── 1. RENDERIZAÇÃO DO MUNDO MÉTRICO (WorldMap) ───
      // Conversão explícita de coordenadas: Mundo +Y (Norte) => Canvas -Y (Topo)
      const toCanvasY = (worldY: number) => -worldY

      // Quarteirões verdes / gramados
      ctx.fillStyle = '#062615'
      ctx.fillRect(-300, -300, 600, 600)

      // Anel Viário Perimetral (WorldMap: |x| ou |y| em [220, 240], cobrindo [-240, 240])
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(-240, toCanvasY(240), 480, 20)   // Trecho Norte (worldY: +220..+240)
      ctx.fillRect(-240, toCanvasY(-220), 480, 20)  // Trecho Sul (worldY: -240..-220)
      ctx.fillRect(-240, toCanvasY(240), 20, 480)   // Trecho Oeste (worldX: -240..-220)
      ctx.fillRect(220, toCanvasY(240), 20, 480)    // Trecho Leste (worldX: +220..+240)
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 0.5
      ctx.setLineDash([6, 6])
      ctx.strokeRect(-230, -230, 460, 460)
      ctx.setLineDash([])

      // Área Off-road (Setor Sudeste: worldX = +140, worldY = -140)
      ctx.fillStyle = '#3f2512'
      ctx.beginPath()
      ctx.arc(140, toCanvasY(-140), 75, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#5a341a'
      ctx.lineWidth = 3
      ctx.stroke()

      // Área de Skidpad Molhado (Setor Sudoeste: worldX = -140, worldY = -140)
      ctx.fillStyle = '#09152a'
      ctx.beginPath()
      ctx.arc(-140, toCanvasY(-140), 65, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#1e3a8a'
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Circuito de Handling Sinuoso (Setor Noroeste: worldX = -140, worldY = +140)
      ctx.strokeStyle = '#273549'
      ctx.lineWidth = 30
      ctx.beginPath()
      ctx.arc(-140, toCanvasY(140), 80, 0, Math.PI * 2)
      ctx.stroke()
      // Linhas da pista de handling
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 0.8
      ctx.setLineDash([8, 8])
      ctx.stroke()
      ctx.setLineDash([])

      // Avenidas Principais (Cruciforme de 24m)
      ctx.fillStyle = '#1e293b'
      // Avenida Leste-Oeste (worldY entre -12 e +12, worldX de -280 a +280)
      ctx.fillRect(-280, toCanvasY(12), 560, 24)
      // Avenida Norte-Sul (worldX entre -12 e +12, worldY de -280 a +280)
      ctx.fillRect(-12, toCanvasY(280), 24, 560)

      // Guias e Zebras das Avenidas
      ctx.fillStyle = '#dc2626'
      ctx.fillRect(-280, toCanvasY(-12), 560, 1.2)
      ctx.fillRect(-280, toCanvasY(13.2), 560, 1.2)
      ctx.fillRect(12, toCanvasY(280), 1.2, 560)
      ctx.fillRect(-13.2, toCanvasY(280), 1.2, 560)

      // Linhas Centrais das Avenidas (Amarelas tracejadas)
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 0.6
      ctx.setLineDash([6, 5])
      ctx.beginPath()
      ctx.moveTo(-280, 0)
      ctx.lineTo(-42, 0)
      ctx.moveTo(42, 0)
      ctx.lineTo(280, 0)
      ctx.moveTo(0, toCanvasY(280))
      ctx.lineTo(0, toCanvasY(42))
      ctx.moveTo(0, toCanvasY(-42))
      ctx.lineTo(0, toCanvasY(-280))
      ctx.stroke()
      ctx.setLineDash([])

      // ── Pista de Arrancada Oficial (Drag Strip 402m — worldY = +52) ──
      const dsX = WorldMap.DRAG_STRIP_START_X
      const dsCanvasY = toCanvasY(WorldMap.DRAG_STRIP_Y_CENTER)
      const dsHalfW = WorldMap.DRAG_STRIP_HALF_WIDTH
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(dsX - 10, dsCanvasY - dsHalfW, 480, dsHalfW * 2)

      // Linha de Largada (Start)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(dsX, dsCanvasY - dsHalfW, 1.5, dsHalfW * 2)

      // Linha de 60 Pés (60ft)
      ctx.fillStyle = '#38bdf8'
      ctx.fillRect(WorldMap.DRAG_STRIP_60FT_X, dsCanvasY - dsHalfW, 0.8, dsHalfW * 2)

      // Linha de 201 Metros (1/8 milha)
      ctx.fillStyle = '#fbbf24'
      ctx.fillRect(WorldMap.DRAG_STRIP_201M_X, dsCanvasY - dsHalfW, 1.2, dsHalfW * 2)

      // Linha de Chegada 402 Metros (1/4 milha) — Estampa Quadriculada
      const finishX = WorldMap.DRAG_STRIP_402M_X
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(finishX, dsCanvasY - dsHalfW, 2.5, dsHalfW * 2)
      ctx.fillStyle = '#000000'
      for (let y = dsCanvasY - dsHalfW; y < dsCanvasY + dsHalfW; y += 2) {
        ctx.fillRect(finishX, y, 1.25, 1)
        ctx.fillRect(finishX + 1.25, y + 1, 1.25, 1)
      }

      // Rotatória Central (Raio externo = 42m, Ilha = 16m)
      ctx.fillStyle = '#1e293b'
      ctx.beginPath()
      ctx.arc(0, 0, 42, 0, Math.PI * 2)
      ctx.fill()

      // Faixa de Rolamento da Rotatória
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 0.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.arc(0, 0, 29, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])

      // Ilha Central Verde da Rotatória
      ctx.fillStyle = '#14532d'
      ctx.beginPath()
      ctx.arc(0, 0, 16, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#dc2626'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Monumento Central
      ctx.fillStyle = '#cbd5e1'
      ctx.beginPath()
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2)
      ctx.fill()

      // Barreiras Perimetrais da Cidade (Muros de Concreto)
      const bLimit = WorldMap.BOUNDARY_LIMIT
      ctx.strokeStyle = '#dc2626'
      ctx.lineWidth = 2.5
      ctx.strokeRect(-bLimit, -bLimit, bLimit * 2, bLimit * 2)

      // ─── 2. SKID MARKS DE PNEUS ───
      if (isWheelSlipping || brake > 0.45) {
        skidMarksRef.current.push({
          x: carX,
          y: -carY,
          opacity: 0.75,
        })
        if (skidMarksRef.current.length > 250) {
          skidMarksRef.current.shift()
        }
      }

      // Desenha Skid Marks
      if (skidMarksRef.current.length > 1) {
        ctx.fillStyle = '#000000'
        for (let i = 0; i < skidMarksRef.current.length; i++) {
          const sm = skidMarksRef.current[i]
          ctx.globalAlpha = sm.opacity * 0.45
          ctx.beginPath()
          ctx.arc(sm.x, sm.y, 0.55, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1.0
      }

      // ─── 3. FUMAÇA DE BURNOUT E PNEUS ───
      if (isWheelSlipping && carSpeed < 40) {
        for (let k = 0; k < 2; k++) {
          smokeParticlesRef.current.push({
            x: carX + (Math.random() - 0.5) * 1.5,
            y: -carY + (Math.random() - 0.5) * 1.5,
            radius: 0.8 + Math.random() * 0.8,
            opacity: 0.55,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            life: 1.0,
          })
        }
      }

      // Atualiza e desenha fumaça
      for (let i = smokeParticlesRef.current.length - 1; i >= 0; i--) {
        const p = smokeParticlesRef.current[i]
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.radius += dt * 1.2
        p.opacity -= dt * 0.55
        p.life -= dt

        if (p.opacity <= 0 || p.life <= 0) {
          smokeParticlesRef.current.splice(i, 1)
        } else {
          ctx.fillStyle = '#ffffff'
          ctx.globalAlpha = p.opacity * 0.4
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1.0

      // ─── 4. RENDERIZAÇÃO DO VEÍCULO DO JOGADOR ───
      ctx.save()
      ctx.translate(carX, -carY)
      // Converte rumo automotivo (0 = Norte / -Y no canvas, 90 = Leste / +X)
      const carHeadingRad = (carHeadingDeg * Math.PI) / 180
      ctx.rotate(carHeadingRad)

      const isMotorcycle = vehicle?.info?.category === 'motorcycle'
      const carLength = isMotorcycle ? 2.2 : 4.5
      const carWidth = isMotorcycle ? 0.8 : 1.95
      const halfL = carLength / 2
      const halfW = carWidth / 2

      // Feixe de Faróis (Luz projetada à frente)
      if (headlightsOn) {
        ctx.save()
        const beamGradient = ctx.createRadialGradient(0, -halfL - 2, 1, 0, -halfL - 32, 28)
        beamGradient.addColorStop(0, 'rgba(254, 240, 138, 0.45)')
        beamGradient.addColorStop(1, 'rgba(254, 240, 138, 0.0)')
        ctx.fillStyle = beamGradient
        ctx.beginPath()
        ctx.moveTo(-1.2, -halfL)
        ctx.lineTo(-14, -halfL - 32)
        ctx.lineTo(14, -halfL - 32)
        ctx.lineTo(1.2, -halfL)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      // Rodas Traseiras
      ctx.fillStyle = '#09090b'
      const tireWidth = isMotorcycle ? 0.22 : 0.38
      const tireLength = isMotorcycle ? 0.65 : 0.72
      // Traseira esquerda / direita
      if (!isMotorcycle) {
        ctx.fillRect(-halfW - 0.05, halfL * 0.45 - tireLength / 2, tireWidth, tireLength)
        ctx.fillRect(halfW - tireWidth + 0.05, halfL * 0.45 - tireLength / 2, tireWidth, tireLength)
      } else {
        ctx.fillRect(-tireWidth / 2, halfL * 0.45 - tireLength / 2, tireWidth, tireLength)
      }

      // Rodas Dianteiras (Esterçam fisicamente de acordo com steeringAngle)
      const steerRad = (steeringAngle * 0.55) // max ~31 graus
      if (!isMotorcycle) {
        // Dianteira esquerda
        ctx.save()
        ctx.translate(-halfW + tireWidth / 2, -halfL * 0.55)
        ctx.rotate(steerRad)
        ctx.fillStyle = '#09090b'
        ctx.fillRect(-tireWidth / 2, -tireLength / 2, tireWidth, tireLength)
        ctx.restore()

        // Dianteira direita
        ctx.save()
        ctx.translate(halfW - tireWidth / 2, -halfL * 0.55)
        ctx.rotate(steerRad)
        ctx.fillStyle = '#09090b'
        ctx.fillRect(-tireWidth / 2, -tireLength / 2, tireWidth, tireLength)
        ctx.restore()
      } else {
        // Roda dianteira da moto
        ctx.save()
        ctx.translate(0, -halfL * 0.55)
        ctx.rotate(steerRad)
        ctx.fillStyle = '#09090b'
        ctx.fillRect(-tireWidth / 2, -tireLength / 2, tireWidth, tireLength)
        ctx.restore()
      }

      // Chassi do Veículo
      const bodyColor = vehicle?.id === 'porsche-gt3' ? '#f59e0b' : vehicle?.id === 'golf-gti' ? '#dc2626' : '#2563eb'
      ctx.fillStyle = bodyColor
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 0.12

      ctx.beginPath()
      if (!isMotorcycle) {
        ctx.roundRect(-halfW, -halfL, carWidth, carLength, 0.6)
      } else {
        ctx.roundRect(-halfW, -halfL, carWidth, carLength, 0.35)
      }
      ctx.fill()
      ctx.stroke()

      // Vidros (Para-brisa e Vigia Traseiro)
      if (!isMotorcycle) {
        ctx.fillStyle = '#0a1120'
        // Para-brisa dianteiro
        ctx.beginPath()
        ctx.roundRect(-halfW * 0.75, -halfL * 0.45, carWidth * 0.75, carLength * 0.22, 0.2)
        ctx.fill()

        // Teto central
        ctx.fillStyle = bodyColor
        ctx.fillRect(-halfW * 0.7, -halfL * 0.20, carWidth * 0.7, carLength * 0.32)

        // Vigia traseiro
        ctx.fillStyle = '#0a1120'
        ctx.beginPath()
        ctx.roundRect(-halfW * 0.72, halfL * 0.15, carWidth * 0.72, carLength * 0.20, 0.2)
        ctx.fill()
      }

      // Lanternas Traseiras (Freio e Ré)
      const isBraking = brake > 0.05
      ctx.fillStyle = isBraking ? '#ff0000' : '#7f1d1d'
      ctx.shadowColor = isBraking ? '#ff0000' : 'transparent'
      ctx.shadowBlur = isBraking ? 12 : 0

      // Lanterna traseira esquerda e direita
      ctx.fillRect(-halfW + 0.1, halfL - 0.22, 0.45, 0.18)
      ctx.fillRect(halfW - 0.55, halfL - 0.22, 0.45, 0.18)

      // Luz de Ré Branca (quando em marcha ré R)
      if (isReverse) {
        ctx.fillStyle = '#ffffff'
        ctx.shadowColor = '#ffffff'
        ctx.shadowBlur = 8
        ctx.fillRect(-halfW + 0.6, halfL - 0.22, 0.3, 0.18)
        ctx.fillRect(halfW - 0.9, halfL - 0.22, 0.3, 0.18)
      }

      // Airbrake Ativo (Porsche 911 Turbo S)
      if (isAirbrake) {
        ctx.fillStyle = '#ef4444'
        ctx.shadowColor = '#ef4444'
        ctx.shadowBlur = 15
        ctx.fillRect(-halfW * 0.9, halfL - 0.45, carWidth * 0.9, 0.35)
      }

      ctx.restore()
      ctx.restore()

      animFrameIdRef.current = requestAnimationFrame(render)
    }

    animFrameIdRef.current = requestAnimationFrame(render)

    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current)
      }
    }
  }, [vehicle, cameraMode, zoomScale])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block rounded-xl overflow-hidden cursor-crosshair ${className}`}
    />
  )
})
