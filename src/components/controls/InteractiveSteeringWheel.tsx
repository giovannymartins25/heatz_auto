import { memo, useRef, useState, useEffect } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import type { VehicleConfig } from '@/types/vehicle'

interface InteractiveSteeringWheelProps {
  vehicle: VehicleConfig
  compact?: boolean
  className?: string
}

/**
 * InteractiveSteeringWheel — Volante automotivo esportivo interativo.
 *
 * Características:
 * - Empunhadura esportiva com costuras e marcador central às 12 horas
 * - Centro com botão de buzina integrado e emblema autêntico da marca
 * - Responde suavemente às setas/teclas A/D e permite esterçar tocando/arrastando
 */
export const InteractiveSteeringWheel = memo(function InteractiveSteeringWheel({
  vehicle,
  compact = false,
  className = '',
}: InteractiveSteeringWheelProps) {
  const steeringAngle = useSimulationStore((s) => s.steeringAngle)
  const setSteeringAngle = useSimulationStore((s) => s.setSteeringAngle)
  const setHorn = useSimulationStore((s) => s.setHorn)

  const isDraggingRef = useRef(false)
  const [touchAngle, setTouchAngle] = useState(0)

  // Escutar teclado A / D para esterçar
  useEffect(() => {
    let target = 0
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'a' || k === 'arrowleft') {
        target = -0.75
        setSteeringAngle(target)
      } else if (k === 'd' || k === 'arrowright') {
        target = 0.75
        setSteeringAngle(target)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'a' || k === 'arrowleft' || k === 'd' || k === 'arrowright') {
        target = 0
        setSteeringAngle(0)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [setSteeringAngle])

  const wheelRotationDeg = (steeringAngle || touchAngle) * 90 // -90 a +90 graus

  const brand = vehicle.info.brand.toUpperCase()
  const size = compact ? 130 : 180

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    isDraggingRef.current = true
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const deltaX = (e.clientX - centerX) / (rect.width / 2)
    const clamped = Math.max(-1, Math.min(1, deltaX))
    setTouchAngle(clamped)
    setSteeringAngle(clamped)
  }

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isDraggingRef.current = false
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {}
    setTouchAngle(0)
    setSteeringAngle(0)
  }

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `rotate(${wheelRotationDeg}deg)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.15s ease-out',
          cursor: 'grab',
        }}
        className="drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)] touch-none"
      >
        {/* Aro externo do volante (Couro texturizado escuro) */}
        <circle cx="100" cy="100" r="88" fill="none" stroke="#18181b" strokeWidth="18" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="#27272a" strokeWidth="14" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="#3f3f46" strokeWidth="2" strokeDasharray="3 4" />

        {/* Faixa central às 12 horas (Marcador esportivo amarelo/vermelho de corrida) */}
        <rect x="96" y="4" width="8" height="18" fill="#f59e0b" rx="2" />

        {/* Raios do volante (3 raios metálicos em alumínio escovado) */}
        {/* Raio Esquerdo (9 horas) */}
        <path d="M 20 100 L 75 100" stroke="#52525b" strokeWidth="12" strokeLinecap="round" />
        <path d="M 22 100 L 75 100" stroke="#71717a" strokeWidth="4" />

        {/* Raio Direito (3 horas) */}
        <path d="M 125 100 L 180 100" stroke="#52525b" strokeWidth="12" strokeLinecap="round" />
        <path d="M 125 100 L 178 100" stroke="#71717a" strokeWidth="4" />

        {/* Raio Inferior (6 horas) */}
        <path d="M 100 125 L 100 180" stroke="#52525b" strokeWidth="12" strokeLinecap="round" />
        <path d="M 100 125 L 100 178" stroke="#71717a" strokeWidth="4" />

        {/* Cubo central (Airbag / Buzina) */}
        <circle cx="100" cy="100" r="32" fill="#09090b" stroke="#3f3f46" strokeWidth="3" />
        <circle cx="100" cy="100" r="28" fill="#18181b" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.4" />

        {/* Emblema da marca no centro */}
        <text
          x="100"
          y="98"
          textAnchor="middle"
          fill="#f4f4f5"
          fontSize="9"
          fontWeight="900"
          fontFamily="monospace"
          letterSpacing="0.05em"
        >
          {brand.includes('PORSCHE')
            ? 'PORSCHE'
            : brand.includes('VOLKS') || brand.includes('VW')
            ? 'VW'
            : brand.includes('TOYOTA')
            ? 'TOYOTA'
            : brand.includes('HONDA')
            ? 'HONDA'
            : brand}
        </text>

        {/* Ícone de Buzina */}
        <text
          x="100"
          y="112"
          textAnchor="middle"
          fill="#a1a1aa"
          fontSize="8"
          fontFamily="sans-serif"
        >
          📢
        </text>
      </svg>

      {/* Botão de buzina touch rápido no centro */}
      <button
        onPointerDown={() => setHorn(true)}
        onPointerUp={() => setHorn(false)}
        onPointerCancel={() => setHorn(false)}
        className="mt-1 px-3 py-0.5 rounded-full bg-zinc-900 border border-white/10 text-[8px] font-mono font-bold text-zinc-400 active:bg-amber-500/20 active:text-amber-400 cursor-pointer shadow"
      >
        TOQUE NO CENTRO · BUZINA (H)
      </button>
    </div>
  )
})

