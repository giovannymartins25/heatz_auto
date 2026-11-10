import React, { useState, useRef, useCallback } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { HapticFeedback } from '@/systems/haptics/HapticFeedback'

export interface HPatternShifterProps {
  className?: string
  gearCount?: number
  size?: 'compact' | 'normal'
  showModeToggle?: boolean
}

/**
 * HPatternShifter — Alavanca de Câmbio Manual em Grade H Realista (Gated Shifter).
 *
 * Simula um câmbio mecânico autêntico:
 * - Haste metálica cromada e manopla esférica que se move fisicamente para a marcha engatada.
 * - Suporta toque direto nos engates e arrasto (drag & drop) da manopla com o dedo no celular ou mouse no PC.
 * - Física de trava e sincronizador: trocar marcha em movimento sem pisar na embreagem faz o câmbio
 *   arranhar violentamente (Crrrrck!) com alerta visual e resposta tátil.
 * - Suporta câmbios de 5 marchas (Gol G6 / Gol Quadrado) e 6 marchas (Civic Si).
 */
export const HPatternShifter: React.FC<HPatternShifterProps> = ({
  className = '',
  gearCount = 5,
  size = 'normal',
  showModeToggle = true,
}) => {
  const currentGear = useSimulationStore((s) => s.currentGear)
  const isGearGrinding = useSimulationStore((s) => s.isGearGrinding)
  const clutchPosition = useSimulationStore((s) => s.clutchPosition)
  const shiftHPattern = useSimulationStore((s) => s.shiftHPattern)
  const isEngineBlown = useSimulationStore((s) => s.isEngineBlown)
  const toggleShifterLayout = useSimulationStore((s) => s.toggleShifterLayout)
  const speed = useSimulationStore((s) => s.speed)

  const isClutchEngaged = clutchPosition >= 0.45
  const isCompact = size === 'compact'

  // Estado para arraste tátil da manopla
  const [isDragging, setIsDragging] = useState(false)
  const [dragHoverGear, setDragHoverGear] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Definição das posições na grade física
  // 5 marchas:
  // [1] [3] [5]
  // ===  N  ===
  // [2] [4] [R]
  // 6 marchas:
  // [R] [1] [3] [5]
  // ====   N   ====
  //     [2] [4] [6]
  const isSixSpeed = gearCount >= 6

  const gearSlots = isSixSpeed
    ? [
        { label: 'R', gear: -1, row: 0, col: 0, color: 'text-rose-400 border-rose-500/60' },
        { label: '1', gear: 1, row: 0, col: 1, color: 'text-amber-400 border-amber-500/60' },
        { label: '3', gear: 3, row: 0, col: 2, color: 'text-cyan-400 border-cyan-500/60' },
        { label: '5', gear: 5, row: 0, col: 3, color: 'text-emerald-400 border-emerald-500/60' },
        { label: '2', gear: 2, row: 2, col: 1, color: 'text-amber-400 border-amber-500/60' },
        { label: '4', gear: 4, row: 2, col: 2, color: 'text-cyan-400 border-cyan-500/60' },
        { label: '6', gear: 6, row: 2, col: 3, color: 'text-emerald-400 border-emerald-500/60' },
      ]
    : [
        { label: '1', gear: 1, row: 0, col: 0, color: 'text-amber-400 border-amber-500/60' },
        { label: '3', gear: 3, row: 0, col: 1, color: 'text-cyan-400 border-cyan-500/60' },
        { label: '5', gear: 5, row: 0, col: 2, color: 'text-emerald-400 border-emerald-500/60' },
        { label: '2', gear: 2, row: 2, col: 0, color: 'text-amber-400 border-amber-500/60' },
        { label: '4', gear: 4, row: 2, col: 1, color: 'text-cyan-400 border-cyan-500/60' },
        { label: 'R', gear: -1, row: 2, col: 2, color: 'text-rose-400 border-rose-500/60' },
      ]

  const handleSelectGear = useCallback(
    (targetGear: number) => {
      if (isEngineBlown) return
      shiftHPattern(targetGear)
    },
    [isEngineBlown, shiftHPattern]
  )

  // Localiza o slot mais próximo a partir das coordenadas do pointer
  const findClosestSlot = useCallback(
    (clientX: number, clientY: number): number => {
      if (!containerRef.current) return currentGear
      const rect = containerRef.current.getBoundingClientRect()
      const relX = clientX - rect.left
      const relY = clientY - rect.top

      // Altura central é Ponto Morto (N)
      const centerY = rect.height / 2
      if (Math.abs(relY - centerY) < rect.height * 0.18) {
        return 0 // Neutro
      }

      const isTop = relY < centerY
      const candidates = gearSlots.filter((g) => (isTop ? g.row === 0 : g.row === 2))
      if (candidates.length === 0) return 0

      // Encontra o mais próximo horizontalmente
      let closest = candidates[0]
      let minDistance = Infinity

      const slotWidth = rect.width / (isSixSpeed ? 4 : 3)
      for (const slot of candidates) {
        const slotCenterX = (slot.col + 0.5) * slotWidth
        const dist = Math.abs(relX - slotCenterX)
        if (dist < minDistance) {
          minDistance = dist
          closest = slot
        }
      }

      return closest.gear
    },
    [currentGear, gearSlots, isSixSpeed]
  )

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isEngineBlown) return
    setIsDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const closest = findClosestSlot(e.clientX, e.clientY)
    setDragHoverGear(closest)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const closest = findClosestSlot(e.clientX, e.clientY)
    setDragHoverGear(closest)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    const finalGear = findClosestSlot(e.clientX, e.clientY)
    handleSelectGear(finalGear)
    setDragHoverGear(null)
  }

  const handlePointerCancel = () => {
    setIsDragging(false)
    setDragHoverGear(null)
  }

  const displayGear = isDragging && dragHoverGear !== null ? dragHoverGear : currentGear

  return (
    <div
      className={`relative flex flex-col items-center select-none font-mono transition-all ${
        isCompact
          ? 'w-full max-w-[175px] p-2 rounded-2xl bg-zinc-950/95 border border-white/10 shadow-xl'
          : 'w-full max-w-[240px] p-3 rounded-3xl bg-zinc-950/95 border-2 border-white/15 shadow-2xl'
      } ${className}`}
    >
      {/* ── Cabeçalho do Câmbio: Status da Embreagem e Layout ── */}
      <div className="w-full flex items-center justify-between mb-1.5 px-0.5 text-[9px]">
        <div className="flex items-center gap-1">
          <span className="text-zinc-500 font-bold uppercase">CÂMBIO</span>
          <span className="text-amber-400 font-black tracking-wider">
            {isSixSpeed ? '6M' : '5M'} H-GATE
          </span>
        </div>

        {/* Indicador Luminoso de Embreagem */}
        <span
          className={`px-1.5 py-0.5 rounded-full font-bold text-[8px] transition-all flex items-center gap-1 ${
            isClutchEngaged
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
              : speed > 6
              ? 'bg-red-500/20 text-red-300 border border-red-500/60 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.3)]'
              : 'bg-zinc-800 text-zinc-400 border border-white/5'
          }`}
          title={isClutchEngaged ? 'Embreagem livre para engate' : 'Pise na embreagem para não arranhar'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isClutchEngaged ? 'bg-emerald-400' : 'bg-red-500'}`} />
          <span>{isClutchEngaged ? 'EMBR. OK' : 'SOLTA'}</span>
        </span>
      </div>

      {/* ── Alerta Visual de Arranhar Sincronizador ── */}
      {isGearGrinding && (
        <div className="w-full mb-1.5 py-1 px-1.5 rounded-xl bg-red-950/90 border-2 border-red-500 text-red-200 text-center text-[9px] font-black animate-bounce shadow-lg shadow-red-950/80">
          ⚠️ ARRANHOU! PISE NA EMBREAGEM!
        </div>
      )}

      {/* ── Grade Metálica Mecânica (Gated Shifter Plate) com Drag & Touch ── */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={`relative w-full rounded-2xl border-2 border-zinc-700/80 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black p-2 flex flex-col justify-between shadow-inner touch-none cursor-grab active:cursor-grabbing ${
          isCompact ? 'h-32' : 'h-40'
        } ${isGearGrinding ? 'border-red-500 ring-2 ring-red-500/40 animate-pulse' : ''}`}
      >
        {/* Sulco de Metal Central (Trilho Horizontal do Ponto Morto) */}
        <div className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 h-3 rounded-full bg-black/90 border-y border-zinc-800 shadow-inner" />

        {/* Sulcos Verticais de Engate de Marchas */}
        {Array.from({ length: isSixSpeed ? 4 : 3 }).map((_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute top-3 bottom-3 w-3 rounded-full bg-black/90 border-x border-zinc-800 shadow-inner"
            style={{
              left: `${((i + 0.5) / (isSixSpeed ? 4 : 3)) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          />
        ))}

        {/* ── Linha Superior de Marchas (R, 1, 3, 5 ou 1, 3, 5) ── */}
        <div className="relative z-10 flex justify-between items-center w-full px-1">
          {gearSlots
            .filter((g) => g.row === 0)
            .map((g) => {
              const isSelected = displayGear === g.gear
              return (
                <button
                  key={g.label}
                  disabled={isEngineBlown}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectGear(g.gear)
                  }}
                  className={`flex items-center justify-center rounded-xl font-mono font-black transition-all active:scale-95 cursor-pointer shadow-md border ${
                    isCompact ? 'w-8 h-8 text-[11px]' : 'w-10 h-10 text-xs'
                  } ${
                    isSelected
                      ? 'border-white bg-gradient-to-b from-white to-zinc-300 text-black shadow-lg shadow-white/40 scale-110 ring-2 ring-amber-400'
                      : `bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 ${g.color}`
                  }`}
                  title={`Engatar ${g.label === 'R' ? 'Marcha Ré' : `${g.label}ª Marcha`}`}
                >
                  {/* Se engatado: renderiza topo da manopla metálica */}
                  {isSelected ? (
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] font-bold text-zinc-600 leading-none">GEAR</span>
                      <span className="leading-none text-black font-black">{g.label}</span>
                    </div>
                  ) : (
                    g.label
                  )}
                </button>
              )
            })}
        </div>

        {/* ── Linha Central: Botão de Neutro (Ponto Morto) ── */}
        <div className="relative z-10 flex justify-center items-center w-full">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleSelectGear(0)
            }}
            className={`rounded-full px-3 py-1 font-mono font-black transition-all active:scale-95 cursor-pointer border shadow ${
              isCompact ? 'text-[9px] py-0.5' : 'text-[10px] py-1'
            } ${
              displayGear === 0
                ? 'border-amber-400 bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.8)] scale-105'
                : 'border-white/10 bg-zinc-900/80 text-zinc-400 hover:text-white'
            }`}
            title="Colocar em Ponto Morto (N)"
          >
            {displayGear === 0 ? '● NEUTRO (N)' : 'NEUTRO'}
          </button>
        </div>

        {/* ── Linha Inferior de Marchas (2, 4, 6 ou 2, 4, R) ── */}
        <div className="relative z-10 flex justify-between items-center w-full px-1">
          {gearSlots
            .filter((g) => g.row === 2)
            .map((g) => {
              const isSelected = displayGear === g.gear
              return (
                <button
                  key={g.label}
                  disabled={isEngineBlown}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectGear(g.gear)
                  }}
                  className={`flex items-center justify-center rounded-xl font-mono font-black transition-all active:scale-95 cursor-pointer shadow-md border ${
                    isCompact ? 'w-8 h-8 text-[11px]' : 'w-10 h-10 text-xs'
                  } ${
                    isSelected
                      ? 'border-white bg-gradient-to-b from-white to-zinc-300 text-black shadow-lg shadow-white/40 scale-110 ring-2 ring-amber-400'
                      : `bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 ${g.color}`
                  }`}
                  title={`Engatar ${g.label === 'R' ? 'Marcha Ré' : `${g.label}ª Marcha`}`}
                >
                  {isSelected ? (
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] font-bold text-zinc-600 leading-none">GEAR</span>
                      <span className="leading-none text-black font-black">{g.label}</span>
                    </div>
                  ) : (
                    g.label
                  )}
                </button>
              )
            })}
        </div>
      </div>

      {/* ── Rodapé: Marcha Atual e Botão de Alternância H-Gate ↔ Seq ── */}
      <div className="w-full mt-1.5 flex items-center justify-between text-[9px] px-1 text-zinc-400">
        <div>
          ENGATADA:{' '}
          <strong className="text-amber-400 text-xs font-black">
            {currentGear === -1 ? 'RÉ' : currentGear === 0 ? 'NEUTRO' : `${currentGear}ª`}
          </strong>
        </div>

        {showModeToggle && (
          <button
            onClick={() => {
              toggleShifterLayout()
              HapticFeedback.light()
            }}
            className="px-2 py-0.5 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[8px] font-black uppercase transition-all active:scale-95 cursor-pointer"
            title="Alternar para Câmbio Sequencial (+ / -)"
          >
            SEQ (+/-)
          </button>
        )}
      </div>
    </div>
  )
}
