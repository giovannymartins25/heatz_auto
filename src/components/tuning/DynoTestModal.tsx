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

  // Escala SVG para o gráfico
  const svgWidth = 520
  const svgHeight = 240
  const padding = { top: 20, right: 30, bottom: 30, left: 45 }

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="relative flex flex-col rounded-3xl border border-neutral-700/80 bg-neutral-950 p-6 shadow-2xl max-w-2xl w-full">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full bg-neutral-800 p-2 text-neutral-400 hover:bg-neutral-700 hover:text-white"
        >
          ✕
        </button>

        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <h2 className="font-mono text-xl font-black text-white uppercase tracking-wider">
              DINAMÔMETRO DE CHASSI VIRTUAL
            </h2>
          </div>
          <p className="font-mono text-xs text-neutral-400">
            {config.info.name} — Teste de medição de Potência nas Rodas e Torque Máximo em 4ª Marcha
          </p>
        </div>

        {/* Rolos e Indicador de RPM em Tempo Real */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 font-mono">
          <div className="flex items-center gap-4">
            <div
              className={`h-12 w-12 rounded-full border-4 border-dashed border-neutral-600 bg-neutral-800 ${
                isRunning ? 'animate-spin border-amber-400' : ''
              }`}
            />
            <div>
              <div className="text-[11px] text-neutral-400">ROTAÇÃO DO MOTOR</div>
              <div className="text-2xl font-black text-amber-400">
                {isRunning ? currentRpm : dynoResult ? profile.maxPowerRpm : 1000} <span className="text-sm font-normal text-neutral-400">RPM</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] text-neutral-400">COMBUSTÍVEL NO TANQUE</div>
            <div className="text-xs font-bold text-emerald-400">{fuelLabel}</div>
          </div>
        </div>

        {/* Gráfico SVG de Dinamômetro */}
        <div className="relative mb-4 rounded-2xl border border-neutral-800 bg-black/70 p-2">
          <div className="absolute top-3 right-4 flex items-center gap-4 font-mono text-[11px]">
            <span className="flex items-center gap-1.5 text-red-500 font-bold">
              <span className="h-2 w-4 rounded bg-red-500" /> Potência (cv)
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <span className="h-2 w-4 rounded bg-cyan-400" /> Torque (Nm)
            </span>
          </div>

          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-52">
            {/* Linhas de Grade */}
            {[0.25, 0.5, 0.75, 1.0].map((frac) => (
              <line
                key={frac}
                x1={padding.left}
                y1={padding.top + frac * (svgHeight - padding.top - padding.bottom)}
                x2={svgWidth - padding.right}
                y2={padding.top + frac * (svgHeight - padding.top - padding.bottom)}
                stroke="#262626"
                strokeDasharray="3 3"
              />
            ))}

            {/* Curva de Torque (Azul / Cyan) */}
            <path d={torquePath} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />

            {/* Curva de Potência (Vermelho) */}
            <path d={hpPath} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        {/* Resultados Finais */}
        <div className="mb-4 grid grid-cols-2 gap-3 font-mono">
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3">
            <div className="text-[10px] text-neutral-400 uppercase">POTÊNCIA MÁXIMA</div>
            <div className="text-xl font-black text-red-400">
              {profile.maxPowerHp} <span className="text-xs font-normal">CV</span>
            </div>
            <div className="text-[10px] text-neutral-500">@ {profile.maxPowerRpm} RPM</div>
          </div>

          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3">
            <div className="text-[10px] text-neutral-400 uppercase">TORQUE MÁXIMO</div>
            <div className="text-xl font-black text-cyan-400">
              {profile.maxTorqueNm} <span className="text-xs font-normal">Nm ({Math.round(profile.maxTorqueNm / 9.80665)} kgfm)</span>
            </div>
            <div className="text-[10px] text-neutral-500">@ {profile.maxTorqueRpm} RPM</div>
          </div>
        </div>

        {/* Botão de Iniciar Puxada */}
        <button
          disabled={isRunning}
          onClick={handleStartPull}
          className={`rounded-2xl border px-6 py-3 font-mono text-sm font-black uppercase shadow-lg transition active:scale-95 ${
            isRunning
              ? 'border-neutral-700 bg-neutral-800 text-neutral-500'
              : 'border-red-500 bg-red-600 text-white hover:bg-red-500'
          }`}
        >
          {isRunning ? `ACELERANDO NO ROLO... (${Math.round(progress)}%)` : '🔥 REALIZAR PUXADA COMPLETA NO DINO'}
        </button>
      </div>
    </div>
  )
}
