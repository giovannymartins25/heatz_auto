import React, { useState, useEffect, useRef } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useGarageStore } from '@/stores/useGarageStore'

export const RIVALS = [
  { id: 'gol-ap', name: 'Gol Turbo AP 1.9 Forjado', time: 11.24, trapSpeed: 205, reaction: 0.28 },
  { id: 'civic-k20', name: 'Honda Civic Si VTEC Turbo', time: 11.75, trapSpeed: 198, reaction: 0.24 },
  { id: 'golf-gti', name: 'VW Golf GTI DSG Stg 2', time: 11.38, trapSpeed: 203, reaction: 0.22 },
  { id: 'porsche-gt3', name: 'Porsche 911 GT3 RS PDK', time: 10.62, trapSpeed: 221, reaction: 0.18 },
]

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
  const timerStart = useSimulationStore((s) => s._dragTimerStart)
  const speed = useSimulationStore((s) => s.speed)
  const startDragRace = useSimulationStore((s) => s.startDragRace)
  const resetDragRace = useSimulationStore((s) => s.resetDragRace)
  const addCredits = useGarageStore((s) => s.addCredits)

  // Modo Duelo 1v1
  const [isDuelMode, setIsDuelMode] = useState(true)
  const [rivalIndex, setRivalIndex] = useState(0)
  const [rivalDistance, setRivalDistance] = useState(0)
  const duelBonusAwarded = useRef(false)

  const activeRival = RIVALS[rivalIndex]

  // Reseta estado do rival e bônus ao reiniciar corrida
  useEffect(() => {
    if (dragStage === 'idle' || dragStage === 'pre_stage') {
      duelBonusAwarded.current = false
      setRivalDistance(0)
    }
  }, [dragStage])

  // Progresso em tempo real do Rival na pista (simulação física do tempo 402m do rival)
  useEffect(() => {
    if (dragStage !== 'racing' || !timerStart) {
      return
    }

    const interval = setInterval(() => {
      const elapsed = (performance.now() - timerStart) / 1000
      const rivalReaction = activeRival.reaction
      if (elapsed < rivalReaction) {
        setRivalDistance(0)
        return
      }
      const runTime = elapsed - rivalReaction
      const avgA = (2 * 402) / Math.pow(activeRival.time, 2)
      const dist = Math.min(402, 0.5 * avgA * Math.pow(runTime, 2))
      setRivalDistance(dist)
    }, 40)

    return () => clearInterval(interval)
  }, [dragStage, timerStart, activeRival])

  // Verifica vitória no Duelo 1v1
  const playerWonDuel =
    isDuelMode &&
    dragStage === 'finished' &&
    dragTimeSlip &&
    !dragTimeSlip.isDisqualified &&
    dragTimeSlip.time402m > 0 &&
    dragTimeSlip.time402m < activeRival.time

  useEffect(() => {
    if (playerWonDuel && !duelBonusAwarded.current) {
      duelBonusAwarded.current = true
      addCredits(10000)
    }
  }, [playerWonDuel, addCredits])

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

          {/* Seletor de Modo: Solo vs Duelo 1v1 */}
          <div className="mb-3 flex items-center justify-between gap-2 bg-neutral-900/80 p-1.5 rounded-2xl border border-neutral-800">
            <div className="flex gap-1">
              <button
                disabled={dragStage !== 'idle' && dragStage !== 'finished' && dragStage !== 'false_start'}
                onClick={() => setIsDuelMode(false)}
                className={`px-3 py-1 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  !isDuelMode ? 'bg-amber-500 text-black shadow' : 'text-neutral-400 hover:text-white'
                }`}
              >
                SOLO
              </button>
              <button
                disabled={dragStage !== 'idle' && dragStage !== 'finished' && dragStage !== 'false_start'}
                onClick={() => setIsDuelMode(true)}
                className={`px-3 py-1 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  isDuelMode ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>⚔️</span>
                <span>DUELO 1V1</span>
              </button>
            </div>

            {/* Seletor de Rival */}
            {isDuelMode && (
              <select
                disabled={dragStage !== 'idle' && dragStage !== 'finished' && dragStage !== 'false_start'}
                value={rivalIndex}
                onChange={(e) => setRivalIndex(Number(e.target.value))}
                className="bg-neutral-950 border border-neutral-700 text-amber-300 text-[10px] font-mono rounded-lg px-2 py-1 outline-none cursor-pointer"
              >
                {RIVALS.map((r, idx) => (
                  <option key={r.id} value={idx}>
                    {r.name} (~{r.time}s)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Status ao vivo */}
          {dragStage === 'racing' && (
            <div className="mb-4 rounded-xl border border-emerald-500/50 bg-emerald-950/40 p-3 font-mono space-y-2">
              <div>
                <div className="flex justify-between text-xs text-emerald-400">
                  <span>VOCÊ (PISTA A): <strong>{Math.round(distanceTraveled)}m / 402m</strong></span>
                  <span><strong>{Math.round(speed)} km/h</strong></span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, (distanceTraveled / 402) * 100)}%` }}
                  />
                </div>
              </div>

              {isDuelMode && (
                <div>
                  <div className="flex justify-between text-xs text-rose-400">
                    <span>{activeRival.name} (PISTA B): <strong>{Math.round(rivalDistance)}m / 402m</strong></span>
                    <span><strong>~{activeRival.trapSpeed} km/h</strong></span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 transition-all duration-75"
                      style={{ width: `${Math.min(100, (rivalDistance / 402) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
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

                {dragTimeSlip.reward !== undefined && dragTimeSlip.reward > 0 && (
                  <div className="col-span-2 mt-2 p-2 rounded-xl bg-gradient-to-r from-emerald-950/80 to-amber-950/80 border border-emerald-500/50 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs font-black text-emerald-400">
                      <span>🏆 PRÊMIO RECEBIDO:</span>
                      <span className="text-sm text-amber-300 font-mono font-black">
                        +R$ {dragTimeSlip.reward.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {dragTimeSlip.rewardBreakdown && dragTimeSlip.rewardBreakdown.length > 0 && (
                      <div className="text-[10px] text-neutral-400 font-mono space-y-0.5">
                        {dragTimeSlip.rewardBreakdown.map((b, i) => (
                          <div key={i} className="flex items-center gap-1 text-emerald-300/80">
                            <span>✓</span>
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Resultado do Duelo 1v1 */}
                {isDuelMode && dragTimeSlip.time402m > 0 && !dragTimeSlip.isDisqualified && (
                  <div
                    className={`col-span-2 mt-2 p-2.5 rounded-xl border flex flex-col gap-1.5 font-mono ${
                      playerWonDuel
                        ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                        : 'bg-red-950/90 border-red-500 text-red-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-black">
                      <span>{playerWonDuel ? '🏆 VITÓRIA NO DUELO 1V1!' : '🥈 DERROTA NO DUELO 1V1'}</span>
                      <span className="text-amber-300 text-sm font-black">
                        {playerWonDuel ? '+R$ 10.000' : 'SEM BÔNUS'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-neutral-300">
                      <span>Seu Tempo: <strong className="text-white">{dragTimeSlip.time402m.toFixed(3)}s</strong></span>
                      <span>Rival ({activeRival.name}): <strong className="text-amber-300">{activeRival.time.toFixed(3)}s</strong></span>
                    </div>
                  </div>
                )}
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

