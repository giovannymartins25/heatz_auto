import React, { useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types'
import type { CarUpgrades } from '@/stores/useGarageStore'
import { calculateDynoProfile, type DynoResult } from '@/utils/dynoCalculator'

interface DynoTestModalProps {
  config: VehicleConfig
  upgrades?: Partial<CarUpgrades>
  onClose: () => void
}

/**
 * DynoTestModal — Dinamômetro de Chassi Virtual com rolos e curvas de Potência (cv) e Torque (Nm).
 *
 * Otimizado para telas mobile e desktop:
 * - Layout fluido e adaptativo com scroll vertical seguro (zero corte em smartphone)
 * - Gráfico SVG com eixos e legendas graduadas proporcionais
 * - Indicadores numéricos legíveis e rolos animados
 */
export const DynoTestModal: React.FC<DynoTestModalProps> = ({
  config,
  upgrades,
  onClose,
}) => {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dynoResult, setDynoResult] = useState<DynoResult | null>(null)

  const profile = calculateDynoProfile(config, upgrades)

  const handleStartPull = () => {
    setIsRunning(true)
    setProgress(0)
    setDynoResult(null)
  }

  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsRunning(false)
          setDynoResult(profile)
          return 100
        }
        return prev + 2.5
      })
    }, 45)
    return () => clearInterval(interval)
  }, [isRunning, profile])

  const currentRpm = Math.round(1000 + (progress / 100) * (config.engine.maxRpm - 1000))

  // Fechar no ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Escala SVG para o gráfico
  const svgWidth = 540
  const svgHeight = 220
  const padding = { top: 22, right: 38, bottom: 28, left: 45 }

  const maxHp = profile.maxPowerHp * 1.15
  const maxTorque = profile.maxTorqueNm * 1.15

  const pointsToSvgPath = (points: { rpm: number; val: number }[], maxVal: number) => {
    if (points.length === 0) return ''
    return points
      .map((p, idx) => {
        const x = padding.left + ((p.rpm - 1000) / (config.engine.maxRpm - 1000)) * (svgWidth - padding.left - padding.right)
        const y = svgHeight - padding.bottom - (p.val / maxVal) * (svgHeight - padding.top - padding.bottom)
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }

  const activePoints = profile.dataPoints.filter((p) => p.rpm <= currentRpm)
  const hpPath = pointsToSvgPath(activePoints.map((p) => ({ rpm: p.rpm, val: p.powerHp })), maxHp)
  const torquePath = pointsToSvgPath(activePoints.map((p) => ({ rpm: p.rpm, val: p.torqueNm })), maxTorque)

  const fuelLabel =
    upgrades?.fuelType === 'ethanol_e100'
      ? 'Etanol E100 (+12% Boost)'
      : upgrades?.fuelType === 'premium_podium'
      ? 'Gasolina Podium 102 (+5%)'
      : 'Gasolina Comum'

  // Eixos graduados para o gráfico
  const rpmSteps = Math.min(6, Math.floor((config.engine.maxRpm - 1000) / 1000))
  const stepRpm = (config.engine.maxRpm - 1000) / (rpmSteps || 1)

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative flex flex-col rounded-2xl sm:rounded-3xl border border-neutral-700/80 bg-neutral-950 p-3 sm:p-5 shadow-2xl max-w-2xl w-full max-h-[92dvh] overflow-y-auto text-zinc-100 font-sans my-auto">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white flex items-center justify-center transition-all cursor-pointer z-10"
        >
          ✕
        </button>

        {/* Cabeçalho */}
        <div className="mb-2 sm:mb-3 pr-8">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <h2 className="font-mono text-base sm:text-lg font-black text-white uppercase tracking-wider">
              DINAMÔMETRO DE CHASSI
            </h2>
          </div>
          <p className="font-mono text-[9px] sm:text-[10px] text-neutral-400 truncate">
            {config.info.name} — Teste de medição de Potência nas Rodas e Torque em 4ª Marcha
          </p>
        </div>

        {/* Rolos e Indicador de RPM em Tempo Real */}
        <div className="mb-2.5 flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/80 p-2 sm:p-3 font-mono">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div
              className={`h-9 w-9 sm:h-11 sm:w-11 rounded-full border-3 border-dashed border-neutral-600 bg-neutral-800 flex items-center justify-center shrink-0 ${
                isRunning ? 'animate-spin border-amber-400' : ''
              }`}
            >
              <span className="text-[10px]">⚙️</span>
            </div>
            <div>
              <div className="text-[9px] text-neutral-400">ROTAÇÃO DO MOTOR</div>
              <div className="text-lg sm:text-xl font-black text-amber-400 leading-none">
                {isRunning ? currentRpm : dynoResult ? profile.maxPowerRpm : 1000}{' '}
                <span className="text-xs font-normal text-neutral-400">RPM</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[8.5px] text-neutral-400">COMBUSTÍVEL</div>
            <div className="text-[10px] sm:text-xs font-bold text-emerald-400">{fuelLabel}</div>
          </div>
        </div>

        {/* Gráfico SVG de Dinamômetro */}
        <div className="relative mb-2.5 rounded-xl border border-neutral-800 bg-black/80 p-1 sm:p-2">
          {/* Legenda das curvas */}
          <div className="flex items-center justify-end gap-3 font-mono text-[9px] mb-1 px-1">
            <span className="flex items-center gap-1 text-red-500 font-bold">
              <span className="h-1.5 w-3 rounded bg-red-500" /> Potência (cv)
            </span>
            <span className="flex items-center gap-1 text-cyan-400 font-bold">
              <span className="h-1.5 w-3 rounded bg-cyan-400" /> Torque (Nm)
            </span>
          </div>

          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-40 sm:h-52 overflow-visible">
            {/* Linhas de Grade Horizontais */}
            {[0.25, 0.5, 0.75, 1.0].map((frac) => {
              const y = padding.top + frac * (svgHeight - padding.top - padding.bottom)
              const valHp = Math.round((1 - frac) * maxHp)
              const valTq = Math.round((1 - frac) * maxTorque)
              return (
                <g key={frac}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={svgWidth - padding.right}
                    y2={y}
                    stroke="#27272a"
                    strokeDasharray="3 3"
                  />
                  {/* Label CV no eixo Y esquerdo */}
                  <text
                    x={padding.left - 4}
                    y={y + 3}
                    textAnchor="end"
                    fill="#ef4444"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    {valHp}
                  </text>
                  {/* Label Nm no eixo Y direito */}
                  <text
                    x={svgWidth - padding.right + 4}
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

            {/* Linhas de Grade Verticais (RPM) */}
            {[...Array(rpmSteps + 1)].map((_, i) => {
              const r = 1000 + i * stepRpm
              const x = padding.left + (i / rpmSteps) * (svgWidth - padding.left - padding.right)
              return (
                <g key={i}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={svgHeight - padding.bottom}
                    stroke="#27272a"
                    strokeDasharray="2 2"
                  />
                  <text
                    x={x}
                    y={svgHeight - padding.bottom + 12}
                    textAnchor="middle"
                    fill="#71717a"
                    fontSize="7.5"
                    fontFamily="monospace"
                  >
                    {Math.round(r / 1000)}k
                  </text>
                </g>
              )
            })}

            {/* Curva de Torque (Azul / Cyan) */}
            <path d={torquePath} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />

            {/* Curva de Potência (Vermelho) */}
            <path d={hpPath} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        {/* Resultados Finais */}
        <div className="mb-3 grid grid-cols-2 gap-2 font-mono">
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-2 sm:p-2.5">
            <div className="text-[8.5px] text-neutral-400 uppercase">POTÊNCIA MÁXIMA</div>
            <div className="text-base sm:text-lg font-black text-red-400">
              {profile.maxPowerHp} <span className="text-xs font-normal">CV</span>
            </div>
            <div className="text-[8.5px] text-neutral-500">@ {profile.maxPowerRpm} RPM</div>
          </div>

          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-2 sm:p-2.5">
            <div className="text-[8.5px] text-neutral-400 uppercase">TORQUE MÁXIMO</div>
            <div className="text-base sm:text-lg font-black text-cyan-400">
              {profile.maxTorqueNm} <span className="text-xs font-normal">Nm ({(profile.maxTorqueNm / 9.80665).toFixed(1)} kgfm)</span>
            </div>
            <div className="text-[8.5px] text-neutral-500">@ {profile.maxTorqueRpm} RPM</div>
          </div>
        </div>

        {/* Botão de Iniciar Puxada */}
        <button
          disabled={isRunning}
          onClick={handleStartPull}
          className={`w-full rounded-xl sm:rounded-2xl border py-2.5 sm:py-3 font-mono text-xs sm:text-sm font-black uppercase shadow-lg transition active:scale-95 cursor-pointer ${
            isRunning
              ? 'border-neutral-700 bg-neutral-800 text-neutral-500'
              : 'border-red-500 bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
          }`}
        >
          {isRunning ? `ACELERANDO NO ROLO... (${Math.round(progress)}%)` : '🔥 REALIZAR PUXADA COMPLETA NO DINO'}
        </button>
      </div>
    </div>
  )
}
