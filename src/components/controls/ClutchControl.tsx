import { useState, useRef, useEffect, useCallback, memo } from 'react'
import type { VehicleCategory } from '@/types'
import { clamp } from '@/utils/math'
import { AnalogPedal } from './AnalogPedal'

export interface ClutchControlProps {
  category: VehicleCategory
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

/** Retorna o estado textual e cor da embreagem conforme a zona de acoplamento */
export function getClutchZone(value: number) {
  if (value < 0.25) {
    return {
      status: 'Acoplada',
      badgeClass: 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400',
      description: '100% de tração',
    }
  }
  if (value <= 0.75) {
    return {
      status: 'Patinando (Slip)',
      badgeClass: 'bg-amber-950/40 border-amber-500/40 text-amber-400 animate-pulse',
      description: 'Ponto de fricção',
    }
  }
  return {
    status: 'Desacoplada',
    badgeClass: 'bg-cyan-950/40 border-cyan-500/30 text-cyan-400',
    description: 'Livre / Desengatada',
  }
}

/**
 * ClutchControl — Controle de embreagem de 0% a 100%.
 *
 * Adapta-se automaticamente:
 * - Carros: Pedal de embreagem analógico com indicador de slip.
 * - Motos: Manete de guidão ergonômico com puxada horizontal/analógica.
 */
export const ClutchControl = memo(function ClutchControl({
  category,
  value,
  onChange,
  disabled = false,
}: ClutchControlProps) {
  const zone = getClutchZone(value)

  // ─── Renderização para Motocicletas (Manete de Guidão) ───
  if (category === 'motorcycle') {
    return (
      <MotorcycleClutchLever
        value={value}
        onChange={onChange}
        disabled={disabled}
        zone={zone}
      />
    )
  }

  // ─── Renderização para Carros (Pedal de Embreagem) ───
  return (
    <div className="flex flex-col items-center">
      <AnalogPedal
        label="CLUTCH"
        sublabel="EMBR."
        value={value}
        onChange={onChange}
        colorTheme="blue"
        widthClass="w-14"
        heightClass="h-44"
        disabled={disabled}
        showPercent={true}
      />
      {/* Indicador de Zona de Fricção do Carro */}
      <span
        className={`mt-1 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${zone.badgeClass}`}
      >
        {zone.status}
      </span>
    </div>
  )
})

/** Componente de Manete de Embreagem para Motocicletas */
interface MotorcycleClutchLeverProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  zone: ReturnType<typeof getClutchZone>
}

const MotorcycleClutchLever = memo(function MotorcycleClutchLever({
  value,
  onChange,
  disabled = false,
  zone,
}: MotorcycleClutchLeverProps) {
  const leverRef = useRef<HTMLDivElement>(null)
  const isPointerDownRef = useRef(false)
  const animFrameRef = useRef<number>(0)
  const [internalValue, setInternalValue] = useState(value)

  useEffect(() => {
    if (!isPointerDownRef.current) {
      setInternalValue(value)
    }
  }, [value])

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  const calculateLeverValue = useCallback((clientX: number): number => {
    if (!leverRef.current) return 0
    const rect = leverRef.current.getBoundingClientRect()
    // Puxar da esquerda para a direita ou da extremidade para o punho
    // 0% = solto (esquerda), 100% = puxado contra o punho (direita)
    const normalized = (clientX - rect.left) / rect.width
    return clamp(normalized, 0, 1)
  }, [])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    isPointerDownRef.current = true
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Ignora
    }

    const newVal = calculateLeverValue(e.clientX)
    setInternalValue(newVal)
    onChange(newVal)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current || disabled) return
    const newVal = calculateLeverValue(e.clientX)
    setInternalValue(newVal)
    onChange(newVal)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignora
    }

    // Retorno suave da manete (mola externa da moto)
    let current = internalValue
    const springBack = () => {
      current -= 0.25
      if (current <= 0) {
        setInternalValue(0)
        onChange(0)
      } else {
        setInternalValue(current)
        onChange(current)
        animFrameRef.current = requestAnimationFrame(springBack)
      }
    }
    animFrameRef.current = requestAnimationFrame(springBack)
  }

  const percent = Math.round(internalValue * 100)

  return (
    <div className={`flex flex-col items-center w-full max-w-[280px] select-none touch-none mb-3 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      {/* Cabeçalho da Manete */}
      <div className="flex items-center justify-between w-full px-2 mb-1">
        <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 flex items-center gap-1.5">
          <span>🏍️</span> Manete de Embreagem
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${zone.badgeClass}`}>
            {zone.status}
          </span>
          <span className="text-xs font-mono font-black text-cyan-400">{percent}%</span>
        </div>
      </div>

      {/* Trilho e Manete de Alumínio */}
      <div
        ref={leverRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-full h-12 rounded-xl bg-zinc-950 border-2 border-zinc-800 hover:border-zinc-700 cursor-grab active:cursor-grabbing p-1.5 flex items-center overflow-hidden transition-colors"
      >
        {/* Marcador das 3 zonas de fundo */}
        <div className="absolute inset-0 flex pointer-events-none opacity-20">
          <div className="w-1/4 h-full bg-emerald-500 border-r border-white/10" />
          <div className="w-2/4 h-full bg-amber-500 border-r border-white/10" />
          <div className="w-1/4 h-full bg-cyan-500" />
        </div>

        {/* Manete Física estilizada em metal */}
        <div
          className="relative h-8 rounded-lg bg-gradient-to-r from-zinc-400 via-zinc-200 to-zinc-500 border border-white/40 shadow-lg flex items-center justify-end px-3 transition-[width] duration-75 ease-out"
          style={{ width: `${Math.max(22, internalValue * 100)}%` }}
        >
          {/* Ponta esférica clássica da manete de moto */}
          <div className="w-4 h-4 rounded-full bg-zinc-300 border-2 border-zinc-600 shadow-md absolute -right-2 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Guia de Zonas */}
      <div className="flex justify-between w-full text-[8px] font-mono text-zinc-500 px-1 mt-1">
        <span>0% SOLTA</span>
        <span>SLIP 30-70%</span>
        <span>100% PRESS.</span>
      </div>
    </div>
  )
})
