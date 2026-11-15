import React, { useState, useEffect, useMemo, useRef } from 'react'
import type { VehicleConfig } from '@/types'
import type { CarUpgrades } from '@/stores/useGarageStore'
import { calculateDynoProfile, getDrivetrainType } from '@/utils/dynoCalculator'

interface DynoTestModalProps {
  config: VehicleConfig
  upgrades?: Partial<CarUpgrades>
  onClose: () => void
}

/**
 * DynoTestModal — Dinamômetro de Chassi Virtual com Puxada Realista em Tempo Real.
 *
 * Características:
 * - Relação física exata: P(cv) = (T(Nm) * RPM) / 7023.3
 * - Diferenciação estrita entre Potência no Motor (BHP) e nas Rodas (WHP) com perdas mecânicas calculadas
 * - Puxada progressiva ponto a ponto (sem GIF fake) com rotação, velocímetro do rolo e animação de rolos dinâmicos
 * - Comparativo Antes vs Depois (Curva Original de Fábrica vs Curva Preparada Atual)
 * - Design mobile-first de alta densidade sem cortes horizontais ou verticais
 */
export const DynoTestModal: React.FC<DynoTestModalProps> = ({
  config,
  upgrades,
  onClose,
}) => {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(100) // Inicia com puxada concluída para ver as curvas de imediato
  const [showOriginalComparison, setShowOriginalComparison] = useState(true)
  const animFrameRef = useRef<number | null>(null)

  // Perfil Atual do Veículo (com upgrades)
  const currentProfile = useMemo(() => calculateDynoProfile(config, upgrades), [config, upgrades])

  // Perfil Original de Fábrica (Stock, sem upgrades)
  const originalProfile = useMemo(
    () =>
      calculateDynoProfile(config, {
        tuningStage: 0,
        intakeType: 'stock',
        exhaustType: 'stock',
        turboKit: false,
        hasNosKit: false,
      }),
    [config],
  )

  const handleStartPull = () => {
    setIsRunning(true)
    setProgress(0)
  }

  useEffect(() => {
    if (!isRunning) return
    const startTime = performance.now()
    const durationMs = 4200 // Puxada de 4.2 segundos

    const step = (now: number) => {
      const elapsed = now - startTime
      const p = Math.min(100, (elapsed / durationMs) * 100)
      setProgress(p)

      if (p < 100) {
        animFrameRef.current = requestAnimationFrame(step)
      } else {
        setIsRunning(false)
      }
    }

    animFrameRef.current = requestAnimationFrame(step)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isRunning])

  // ESC fecha o modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const maxRpm = config.engine.maxRpm || 6500
  const currentRpm = Math.round(1000 + (progress / 100) * (maxRpm - 1000))

  // Velocidade do rolo estimada na marcha de teste (em km/h)
  const tireRadiusMeters = config.info.wheelDiameter ? config.info.wheelDiameter / 2 : 0.31
  const finalDrive = config.transmission.finalDrive || 3.9
  const gearRatio = currentProfile.testGearRatio || 1.0
  const currentRollerSpeedKmh = Math.round(
    ((currentRpm / 60) * (2 * Math.PI * tireRadiusMeters) / (gearRatio * finalDrive)) * 3.6,
  )

  // Escala SVG do gráfico
  const svgWidth = 560
  const svgHeight = 220
  const pad = { top: 20, right: 38, bottom: 26, left: 45 }

  const maxScaleHp = Math.max(currentProfile.maxEnginePowerHp, originalProfile.maxEnginePowerHp) * 1.12
  const maxScaleTq = Math.max(currentProfile.maxEngineTorqueNm, originalProfile.maxEngineTorqueNm) * 1.12

  const pointsToSvgPath = (points: { rpm: number; val: number }[], maxVal: number) => {
    if (points.length === 0) return ''
    return points
      .map((p, idx) => {
        const x = pad.left + ((p.rpm - 1000) / (maxRpm - 1000)) * (svgWidth - pad.left - pad.right)
        const y = svgHeight - pad.bottom - (p.val / maxVal) * (svgHeight - pad.top - pad.bottom)
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }

  // Pontos ativos durante a puxada
  const activeCurrentPoints = currentProfile.dataPoints.filter((p) => p.rpm <= currentRpm)
  const currentEngineHpPath = pointsToSvgPath(
    activeCurrentPoints.map((p) => ({ rpm: p.rpm, val: p.enginePowerHp })),
    maxScaleHp,
  )
  const currentWheelHpPath = pointsToSvgPath(
    activeCurrentPoints.map((p) => ({ rpm: p.rpm, val: p.wheelPowerHp })),
    maxScaleHp,
  )
  const currentEngineTqPath = pointsToSvgPath(
    activeCurrentPoints.map((p) => ({ rpm: p.rpm, val: p.engineTorqueNm })),
    maxScaleTq,
  )

  // Curvas originais (Stock) para comparação
  const origPoints = originalProfile.dataPoints
  const origEngineHpPath = pointsToSvgPath(
    origPoints.map((p) => ({ rpm: p.rpm, val: p.enginePowerHp })),
    maxScaleHp,
  )
  const origEngineTqPath = pointsToSvgPath(
    origPoints.map((p) => ({ rpm: p.rpm, val: p.engineTorqueNm })),
    maxScaleTq,
  )

  // Deltas de Ganho
  const deltaHp = currentProfile.maxEnginePowerHp - originalProfile.maxEnginePowerHp
  const deltaTq = currentProfile.maxEngineTorqueNm - originalProfile.maxEngineTorqueNm

  const drivetrainLabel = getDrivetrainType(config).toUpperCase()
  const transLabel = config.transmission.type === 'automatic' ? 'AUT' : 'MANUAL/DCT'

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-1.5 sm:p-4 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative flex flex-col rounded-2xl sm:rounded-3xl border border-neutral-700/80 bg-neutral-950 p-2.5 sm:p-5 shadow-2xl max-w-2xl w-full max-h-[96dvh] overflow-y-auto text-zinc-100 font-sans my-auto">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white flex items-center justify-center transition-all cursor-pointer z-10 text-xs sm:text-base"
        >
          ✕
        </button>

        {/* Cabeçalho */}
        <div className="mb-2 pr-8">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <h2 className="font-mono text-sm sm:text-base font-black text-white uppercase tracking-wider">
              DINAMÔMETRO DE CHASSI · TESTE DE POTÊNCIA
            </h2>
          </div>
          <p className="font-mono text-[8.5px] sm:text-[9.5px] text-neutral-400 truncate">
            {config.info.name} · Medição em {currentProfile.testGear}ª Marcha ({drivetrainLabel} · {transLabel})
          </p>
        </div>

        {/* Rolos e Telemetria em Tempo Real */}
        <div className="mb-2 grid grid-cols-3 gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/80 p-1.5 sm:p-2.5 font-mono">
          {/* Rotação */}
          <div className="flex items-center gap-2">
            <div
              className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full border-2 border-dashed border-neutral-600 bg-neutral-800 flex items-center justify-center shrink-0 ${
                isRunning ? 'animate-spin border-amber-400' : ''
              }`}
            >
              <span className="text-[10px]">⚙️</span>
            </div>
            <div>
              <div className="text-[7.5px] sm:text-[8px] text-neutral-400">ROTAÇÃO</div>
              <div className="text-sm sm:text-base font-black text-amber-400 leading-none">
                {currentRpm} <span className="text-[9px] font-normal text-neutral-400">RPM</span>
              </div>
            </div>
          </div>

          {/* Velocidade dos Rolos */}
          <div className="text-center flex flex-col justify-center">
            <div className="text-[7.5px] sm:text-[8px] text-neutral-400">VELOCIDADE ROLO</div>
            <div className="text-sm sm:text-base font-black text-cyan-400 leading-none">
              {currentRollerSpeedKmh} <span className="text-[9px] font-normal text-neutral-400">KM/H</span>
            </div>
          </div>

          {/* Perda de Transmissão */}
          <div className="text-right flex flex-col justify-center">
            <div className="text-[7.5px] sm:text-[8px] text-neutral-400">PERDA MECÂNICA</div>
            <div className="text-xs sm:text-sm font-black text-red-400 leading-none">
              -{currentProfile.drivetrainLossPercent}% <span className="text-[8px] font-normal text-neutral-400">({drivetrainLabel})</span>
            </div>
          </div>
        </div>

        {/* Gráfico SVG de Dinamômetro */}
        <div className="relative mb-2 rounded-xl border border-neutral-800 bg-black/85 p-1 sm:p-2">
          {/* Legenda das Curvas e Toggle de Comparação */}
          <div className="flex items-center justify-between font-mono text-[8px] sm:text-[8.5px] mb-1 px-1">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-red-500 font-bold">
                <span className="h-1.5 w-3 rounded bg-red-500" /> BHP Motor
              </span>
              <span className="flex items-center gap-1 text-orange-400 font-bold">
                <span className="h-1.5 w-3 rounded bg-orange-400" /> WHP Roda
              </span>
              <span className="flex items-center gap-1 text-cyan-400 font-bold">
                <span className="h-1.5 w-3 rounded bg-cyan-400" /> Torque (Nm)
              </span>
              {showOriginalComparison && (
                <span className="flex items-center gap-1 text-zinc-500 font-medium hidden sm:flex">
                  <span className="h-0.5 w-3 border-t border-dashed border-zinc-500" /> Original
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowOriginalComparison(!showOriginalComparison)}
              className="text-[7.5px] sm:text-[8px] px-1.5 py-0.5 rounded border border-white/10 bg-zinc-900 text-zinc-300 hover:text-white cursor-pointer"
            >
              {showOriginalComparison ? 'Ocultar Fábrica' : 'Comparar Fábrica'}
            </button>
          </div>

          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-36 sm:h-48 overflow-visible">
            {/* Grade Horizontais */}
            {[0.25, 0.5, 0.75, 1.0].map((frac) => {
              const y = pad.top + frac * (svgHeight - pad.top - pad.bottom)
              const valHp = Math.round((1 - frac) * maxScaleHp)
              const valTq = Math.round((1 - frac) * maxScaleTq)
              return (
                <g key={frac}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={svgWidth - pad.right}
                    y2={y}
                    stroke="#27272a"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={pad.left - 4}
                    y={y + 3}
                    textAnchor="end"
                    fill="#ef4444"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    {valHp}
                  </text>
                  <text
                    x={svgWidth - pad.right + 4}
                    y={y + 3}
                    textAnchor="start"
                    fill="#22d3ee"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    {valTq}
                  </text>
                </g>
              )
            })}

            {/* Linhas Verticais de RPM */}
            {[1000, 2000, 3000, 4000, 5000, 6000, 7000].filter((r) => r <= maxRpm).map((r) => {
              const x = pad.left + ((r - 1000) / (maxRpm - 1000)) * (svgWidth - pad.left - pad.right)
              return (
                <g key={r}>
                  <line
                    x1={x}
                    y1={pad.top}
                    x2={x}
                    y2={svgHeight - pad.bottom}
                    stroke="#27272a"
                    strokeDasharray="2 2"
                  />
                  <text
                    x={x}
                    y={svgHeight - pad.bottom + 11}
                    textAnchor="middle"
                    fill="#71717a"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    {r / 1000}k
                  </text>
                </g>
              )
            })}

            {/* Curvas Originais de Fábrica (Tracejadas Cinza) */}
            {showOriginalComparison && (
              <>
                <path
                  d={origEngineHpPath}
                  fill="none"
                  stroke="#52525b"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  opacity="0.8"
                />
                <path
                  d={origEngineTqPath}
                  fill="none"
                  stroke="#3f3f46"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  opacity="0.8"
                />
              </>
            )}

            {/* Curva de Torque Atual (Azul / Ciano) */}
            <path d={currentEngineTqPath} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />

            {/* Curva de Potência nas Rodas (Laranja WHP) */}
            <path d={currentWheelHpPath} fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" opacity="0.9" />

            {/* Curva de Potência no Motor (Vermelho BHP) */}
            <path d={currentEngineHpPath} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        {/* Quadro Comparativo e Medições Finais */}
        <div className="mb-2.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-center">
          {/* Potência no Motor */}
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-1.5 sm:p-2">
            <div className="text-[7.5px] sm:text-[8px] text-neutral-400 uppercase">POTÊNCIA MOTOR (BHP)</div>
            <div className="text-sm sm:text-base font-black text-red-400 leading-tight">
              {currentProfile.maxEnginePowerHp} <span className="text-[9px] font-normal">CV</span>
            </div>
            <div className="text-[7.5px] text-neutral-500">@ {currentProfile.maxPowerRpm} RPM</div>
          </div>

          {/* Potência nas Rodas */}
          <div className="rounded-xl border border-orange-500/30 bg-orange-950/20 p-1.5 sm:p-2">
            <div className="text-[7.5px] sm:text-[8px] text-neutral-400 uppercase">NAS RODAS (WHP)</div>
            <div className="text-sm sm:text-base font-black text-orange-400 leading-tight">
              {currentProfile.maxWheelPowerHp} <span className="text-[9px] font-normal">WHP</span>
            </div>
            <div className="text-[7.5px] text-neutral-500">-{currentProfile.drivetrainLossPercent}% perdas</div>
          </div>

          {/* Torque Motor */}
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-1.5 sm:p-2">
            <div className="text-[7.5px] sm:text-[8px] text-neutral-400 uppercase">TORQUE MÁXIMO</div>
            <div className="text-sm sm:text-base font-black text-cyan-400 leading-tight">
              {currentProfile.maxEngineTorqueNm} <span className="text-[9px] font-normal">Nm</span>
            </div>
            <div className="text-[7.5px] text-neutral-500">{(currentProfile.maxEngineTorqueNm / 9.80665).toFixed(1)} kgfm</div>
          </div>

          {/* Ganho da Preparação */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-1.5 sm:p-2">
            <div className="text-[7.5px] sm:text-[8px] text-neutral-400 uppercase">GANHO PREPARAÇÃO</div>
            <div className="text-sm sm:text-base font-black text-emerald-400 leading-tight">
              {deltaHp >= 0 ? `+${deltaHp}` : deltaHp} <span className="text-[9px] font-normal">CV</span>
            </div>
            <div className="text-[7.5px] text-emerald-500">
              {deltaTq >= 0 ? `+${deltaTq}` : deltaTq} Nm vs Original
            </div>
          </div>
        </div>

        {/* Botão de Iniciar Puxada */}
        <button
          disabled={isRunning}
          onClick={handleStartPull}
          className={`w-full rounded-xl sm:rounded-2xl border py-2 sm:py-2.5 font-mono text-xs sm:text-sm font-black uppercase shadow-lg transition active:scale-95 cursor-pointer ${
            isRunning
              ? 'border-neutral-700 bg-neutral-800 text-neutral-400 animate-pulse'
              : 'border-red-500 bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
          }`}
        >
          {isRunning ? `ACELERANDO NO DINAMÔMETRO... (${Math.round(progress)}%)` : '🔥 INICIAR PUXADA COMPLETA NO DINO'}
        </button>
      </div>
    </div>
  )
}
