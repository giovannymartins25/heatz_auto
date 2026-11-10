import React, { useEffect } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

interface DragStripTreeProps {
  onClose?: () => void
}

/**
 * DragStripTree — Árvore de Natal NHRA e Painel de Arrancada 402m (Drag Strip).
 * Gerencia a contagem de largada, detecção de queima de largada (Red Foul)
 * e exibe o comprovante oficial de telemetria (Time-Slip).
 */
export const DragStripTree: React.FC<DragStripTreeProps> = ({ onClose }) => {
  const dragStage = useSimulationStore((s) => s.dragStage)
  const dragTimeSlip = useSimulationStore((s) => s.dragTimeSlip)
  const distanceTraveled = useSimulationStore((s) => s._dragDistanceTraveled)
  const speed = useSimulationStore((s) => s.speed)
  const startDragRace = useSimulationStore((s) => s.startDragRace)
  const resetDragRace = useSimulationStore((s) => s.resetDragRace)

  const isPreStage = dragStage === 'pre_stage' || dragStage === 'staged' || dragStage.startsWith('yellow') || dragStage === 'green' || dragStage === 'racing'
  const isStaged = dragStage === 'staged' || dragStage.startsWith('yellow') || dragStage === 'green' || dragStage === 'racing'
  const isYellow1 = dragStage === 'yellow_1' || dragStage === 'yellow_2' || dragStage === 'yellow_3'
  const isYellow2 = dragStage === 'yellow_2' || dragStage === 'yellow_3'
  const isYellow3 = dragStage === 'yellow_3'
  const isGreen = dragStage === 'green' || dragStage === 'racing' || dragStage === 'finished'
  const isRed = dragStage === 'false_start'

  // Fechar no ESC
  useEffect(() => {
    if (!onClose) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resetDragRace()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, resetDragRace])

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          resetDragRace()
          onClose()
        }
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
    >
      <div className="relative flex flex-col md:flex-row items-center gap-6 rounded-3xl border border-neutral-700/80 bg-neutral-950 p-6 shadow-2xl max-w-2xl w-full">
        {/* Botão de Fechar */}
        {onClose && (
          <button
            onClick={() => {
              resetDragRace()
              onClose()
            }}
            className="absolute top-4 right-4 rounded-full bg-neutral-800 p-2 text-neutral-400 hover:bg-neutral-700 hover:text-white"
          >
            ✕
          </button>
        )}

        {/* ─── Árvore de Natal NHRA (Christmas Tree) ─── */}
        <div className="flex flex-col items-center rounded-2xl border-4 border-neutral-800 bg-neutral-900 px-4 py-5 shadow-2xl">
          <div className="mb-3 text-[10px] font-mono font-black tracking-widest text-neutral-400 uppercase">
            NHRA CHRISTMAS TREE
          </div>

          {/* Pre-Stage (Luzes Azuis Superiores) */}
          <div className="flex gap-4 mb-2">
            <span
              className={`h-5 w-5 rounded-full border-2 transition-all ${
                isPreStage ? 'border-sky-300 bg-sky-400 shadow-lg shadow-sky-400' : 'border-neutral-700 bg-neutral-800'
              }`}
            />
            <span
              className={`h-5 w-5 rounded-full border-2 transition-all ${
                isPreStage ? 'border-sky-300 bg-sky-400 shadow-lg shadow-sky-400' : 'border-neutral-700 bg-neutral-800'
              }`}
            />
          </div>

          {/* Stage (Luzes Azuis Inferiores) */}
          <div className="flex gap-4 mb-4">
            <span
              className={`h-5 w-5 rounded-full border-2 transition-all ${
                isStaged ? 'border-sky-300 bg-sky-400 shadow-lg shadow-sky-400' : 'border-neutral-700 bg-neutral-800'
              }`}
            />
            <span
              className={`h-5 w-5 rounded-full border-2 transition-all ${
                isStaged ? 'border-sky-300 bg-sky-400 shadow-lg shadow-sky-400' : 'border-neutral-700 bg-neutral-800'
              }`}
            />
          </div>

          {/* Amarelas 1, 2, 3 */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex gap-6">
              <span
                className={`h-7 w-7 rounded-full border-2 transition-all ${
                  isYellow1 ? 'border-amber-300 bg-amber-400 shadow-xl shadow-amber-400 scale-110' : 'border-neutral-700 bg-neutral-800'
                }`}
              />
              <span
                className={`h-7 w-7 rounded-full border-2 transition-all ${
                  isYellow1 ? 'border-amber-300 bg-amber-400 shadow-xl shadow-amber-400 scale-110' : 'border-neutral-700 bg-neutral-800'
                }`}
              />
            </div>
            <div className="flex gap-6">
              <span
                className={`h-7 w-7 rounded-full border-2 transition-all ${
                  isYellow2 ? 'border-amber-300 bg-amber-400 shadow-xl shadow-amber-400 scale-110' : 'border-neutral-700 bg-neutral-800'
                }`}
              />
              <span
                className={`h-7 w-7 rounded-full border-2 transition-all ${
                  isYellow2 ? 'border-amber-300 bg-amber-400 shadow-xl shadow-amber-400 scale-110' : 'border-neutral-700 bg-neutral-800'
                }`}
              />
            </div>
            <div className="flex gap-6">
              <span
                className={`h-7 w-7 rounded-full border-2 transition-all ${
                  isYellow3 ? 'border-amber-300 bg-amber-400 shadow-xl shadow-amber-400 scale-110' : 'border-neutral-700 bg-neutral-800'
                }`}
              />
              <span
                className={`h-7 w-7 rounded-full border-2 transition-all ${
                  isYellow3 ? 'border-amber-300 bg-amber-400 shadow-xl shadow-amber-400 scale-110' : 'border-neutral-700 bg-neutral-800'
                }`}
              />
            </div>
          </div>

          {/* Verde e Vermelho */}
          <div className="flex gap-6">
            <span
              className={`h-8 w-8 rounded-full border-2 transition-all ${
                isGreen ? 'border-emerald-300 bg-emerald-500 shadow-2xl shadow-emerald-400 scale-115' : 'border-neutral-700 bg-neutral-800'
              }`}
            />
            <span
              className={`h-8 w-8 rounded-full border-2 transition-all ${
                isRed ? 'border-red-400 bg-red-600 shadow-2xl shadow-red-500 scale-115 animate-ping' : 'border-neutral-700 bg-neutral-800'
              }`}
            />
          </div>
        </div>

        {/* ─── Telemetria & Time Slip ─── */}
        <div className="flex-1 w-full">
          <div className="mb-4">
            <h2 className="font-mono text-xl font-black text-amber-400 uppercase tracking-wider">
              PISTA DE ARRANCADA 402M
            </h2>
            <p className="font-mono text-xs text-neutral-400">
              Dispute o 1/4 de milha: respeite a árvore de natal e crave o melhor tempo de reação e trap speed!
            </p>
          </div>

          {/* Status ao vivo */}
          {dragStage === 'racing' && (
            <div className="mb-4 rounded-xl border border-emerald-500/50 bg-emerald-950/40 p-3 font-mono">
              <div className="flex justify-between text-xs text-emerald-400">
                <span>DISTÂNCIA: <strong>{Math.round(distanceTraveled)}m / 402m</strong></span>
                <span>VELOCIDADE: <strong>{Math.round(speed)} km/h</strong></span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, (distanceTraveled / 402) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Time Slip Oficial */}
          {dragTimeSlip && (
            <div className="mb-4 rounded-2xl border border-neutral-700 bg-neutral-900/90 p-4 font-mono shadow-inner">
              <div className="mb-2 flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-xs font-bold text-neutral-400">TIME-SLIP OFICIAL 402M</span>
                <span
                  className={`text-xs font-black ${
                    dragTimeSlip.isDisqualified ? 'text-red-500' : 'text-emerald-400'
                  }`}
                >
                  {dragTimeSlip.isDisqualified ? 'RED FOUL (QUEIMA)' : 'PUXADA VÁLIDA'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">TEMPO REAÇÃO:</span>
                  <span className="font-bold text-amber-300">{dragTimeSlip.reactionTime.toFixed(3)}s</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">60 PÉS (18M):</span>
                  <span className="font-bold text-white">{dragTimeSlip.time60ft ? `${dragTimeSlip.time60ft.toFixed(3)}s` : '--'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">0 A 100 KM/H:</span>
                  <span className="font-bold text-cyan-300">{dragTimeSlip.time0to100 ? `${dragTimeSlip.time0to100.toFixed(2)}s` : '--'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/60">
                  <span className="text-neutral-400">1/8 MI (201M):</span>
                  <span className="font-bold text-white">{dragTimeSlip.time201m ? `${dragTimeSlip.time201m.toFixed(3)}s` : '--'}</span>
                </div>
                <div className="flex justify-between py-1 col-span-2 bg-neutral-800/50 px-2 rounded">
                  <span className="text-amber-400 font-bold">1/4 MI (402M):</span>
                  <span className="font-black text-amber-400 text-sm">
                    {dragTimeSlip.time402m ? `${dragTimeSlip.time402m.toFixed(3)}s` : '--'}
                  </span>
                </div>
                <div className="flex justify-between py-1 col-span-2 px-2">
                  <span className="text-neutral-400">TRAP SPEED (FINAL):</span>
                  <span className="font-black text-white text-sm">{dragTimeSlip.trapSpeedKmh} km/h</span>
                </div>
              </div>
            </div>
          )}

          {/* Controles da Pista */}
          <div className="flex gap-3">
            {dragStage === 'idle' || dragStage === 'finished' || dragStage === 'false_start' ? (
              <button
                onClick={startDragRace}
                className="flex-1 rounded-xl border border-amber-500 bg-amber-600 px-4 py-2.5 font-mono text-xs font-black uppercase text-white shadow-lg transition hover:bg-amber-500 active:scale-95"
              >
                🏁 ALINHAR NA LARGADA (STAGING)
              </button>
            ) : (
              <button
                onClick={resetDragRace}
                className="flex-1 rounded-xl border border-neutral-600 bg-neutral-800 px-4 py-2.5 font-mono text-xs font-bold text-neutral-300 transition hover:bg-neutral-700 active:scale-95"
              >
                ABORTAR LARGADA
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

