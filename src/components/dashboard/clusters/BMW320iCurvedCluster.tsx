import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { clamp } from '@/utils/math'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { ClusterIndicatorIcon } from '@/components/gauges'
import { formatZeroToHundredSeconds } from '@/systems/vehicle'

export interface BMW320iCurvedClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * BMW320iCurvedCluster — BMW Live Cockpit Professional 12,3" (BMW Curved Display)
 * exclusivo do BMW 320i M Sport 2.0 ActiveFlex 2024 (G20 LCI RWD).
 */
export const BMW320iCurvedCluster = memo(function BMW320iCurvedCluster({
  telemetry,
}: BMW320iCurvedClusterProps) {
  const { tachometer, speedometer, warningLights, auxGauges, shiftLight, abs } = telemetry

  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const transmissionMode = useSimulationStore((s) => s.transmissionMode)
  const gearSelectorPosition = useSimulationStore((s) => s.gearSelectorPosition)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const lateralAccelG = useSimulationStore((s) => s.lateralAccelG)
  const livePowerHp = useSimulationStore((s) => s.livePowerHp)
  const liveTorqueNm = useSimulationStore((s) => s.liveTorqueNm)
  const last0to100 = useSimulationStore((s) => s.last0to100)
  const leftIndicatorLit = useSimulationStore((s) => s.leftIndicatorLit)
  const rightIndicatorLit = useSimulationStore((s) => s.rightIndicatorLit)
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const isLaunchControlArmed = useSimulationStore((s) => s.isLaunchControlArmed)
  const isLaunching = useSimulationStore((s) => s.isLaunching)
  const odometerKm = useSimulationStore((s) => s.odometerKm)
  const estimatedRangeKm = useSimulationStore((s) => s.estimatedRangeKm)

  const maxRpm = tachometer.maxRpm || 7000
  const redlineStart = tachometer.redlineStart || 6500
  const maxSpeed = speedometer.maxSpeed || 260

  const rpm = clamp(Number.isFinite(tachometer.rpm) ? tachometer.rpm : 0, 0, maxRpm)
  const speed = Math.round(clamp(Number.isFinite(speedometer.speed) ? speedometer.speed : 0, 0, 300))
  const coolantTemp = Math.round(clamp(auxGauges.coolantTemp || 92, 50, 130))
  const fuelPercent = Math.round(clamp(auxGauges.fuelPercent, 0, 100))

  const rpmRatio = clamp(rpm / maxRpm, 0, 1)
  const speedRatio = clamp(speed / maxSpeed, 0, 1)

  const zfGearLabel =
    gearSelectorPosition === 'P' || currentGear === -2
      ? 'P'
      : gearSelectorPosition === 'R' || currentGear === -1
        ? 'R'
        : gearSelectorPosition === 'N' || currentGear === 0
          ? 'N'
          : transmissionMode === 'manual_simulated' || gearSelectorPosition === 'M'
            ? `M${currentGear > 0 ? currentGear : 1}`
            : `${gearSelectorPosition === 'S' ? 'S' : 'D'}${currentGear > 0 ? currentGear : 1}`

  const modePalette =
    drivingMode === 'sport'
      ? {
          primary: '#ef4444',
          secondary: '#38bdf8',
          badge: 'SPORT · M SPORT',
          border: 'border-red-500/45',
        }
      : drivingMode === 'eco'
        ? {
            primary: '#0ea5e9',
            secondary: '#38bdf8',
            badge: 'ECO PRO · EFFICIENT',
            border: 'border-sky-500/45',
          }
        : {
            primary: '#38bdf8',
            secondary: '#f59e0b',
            badge: 'COMFORT · RWD',
            border: 'border-cyan-500/40',
          }

  return (
    <div
      className={`relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-2 ${modePalette.border} bg-gradient-to-b from-[#080d16] via-[#05080f] to-[#020408] px-3 py-2 font-mono text-white shadow-[0_0_34px_rgba(56,189,248,0.18)] select-none`}
      data-testid="cluster-bmw-320i-curved"
    >
      {/* Topo BMW Live Cockpit Professional + Emblema ///M + 320i */}
      <div className="mb-1 flex w-full items-center justify-between border-b border-white/10 pb-1 text-[8.5px]">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-5 w-6 items-center justify-center rounded border text-[10px] font-black ${
              leftIndicatorLit
                ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.9)]'
                : 'border-white/10 bg-zinc-900 text-zinc-600'
            }`}
          >
            ◀
          </span>
          <div className="flex items-center gap-0.5 rounded border border-white/15 bg-black/80 px-1.5 py-0.5">
            <span className="h-2.5 w-1 -skew-x-18 bg-[#38bdf8]" />
            <span className="h-2.5 w-1 -skew-x-18 bg-[#1d4ed8]" />
            <span className="h-2.5 w-1 -skew-x-18 bg-[#ef4444]" />
            <span className="ml-1 text-[9px] font-black italic tracking-wider text-white">M</span>
            <span className="ml-1 text-[8.5px] font-bold tracking-wider text-zinc-300">320i</span>
          </div>
          <span className="hidden text-[7.5px] font-bold tracking-widest text-zinc-400 sm:inline">
            CURVED DISPLAY 12.3&quot;
          </span>
        </div>

        {/* Shift Lights M Sport */}
        <div className="flex items-center gap-1">
          {[0.62, 0.72, 0.81, 0.89, 0.95].map((th, idx) => {
            const active = rpm / redlineStart >= th || shiftLight.isActive
            return (
              <span
                key={idx}
                className={`h-1.5 w-4 rounded-xs ${
                  active
                    ? idx >= 3
                      ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]'
                      : idx >= 1
                        ? 'bg-amber-400'
                        : 'bg-sky-400'
                    : 'bg-zinc-800'
                }`}
              />
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <span
            className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[8px] font-black tracking-wider"
            style={{ color: modePalette.primary }}
          >
            {modePalette.badge}
          </span>
          {headlightsMode !== 'off' && (
            <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1 py-0.5 text-[7.5px] font-bold text-emerald-300">
              {headlightsMode === 'high' ? 'LED ALTO' : 'LED'}
            </span>
          )}
          <span
            className={`inline-flex h-5 w-6 items-center justify-center rounded border text-[10px] font-black ${
              rightIndicatorLit
                ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,189,129,0.9)]'
                : 'border-white/10 bg-zinc-900 text-zinc-600'
            }`}
          >
            ▶
          </span>
        </div>
      </div>

      {(isLaunchControlArmed || isLaunching) && (
        <div className="mb-1 w-full rounded-lg border border-red-500/60 bg-red-600/20 py-0.5 text-center text-[9px] font-black tracking-wider text-red-200">
          {isLaunching ? '🚀 LAUNCH CONTROL ATIVO' : '🏁 LAUNCH CONTROL ARMADO · SOLTE O FREIO'}
        </div>
      )}

      {/* SVG Panorâmico Angular OS 8 */}
      <svg viewBox="0 0 760 205" className="w-full">
        <defs>
          <linearGradient id="bmwLeftChevron" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
            <stop offset="60%" stopColor={modePalette.primary} stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
          <linearGradient id="bmwRightChevron" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.3" />
            <stop offset="72%" stopColor={modePalette.primary} stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <clipPath id="bmwSpeedClip">
            <rect x="0" y={188 - speedRatio * 170} width="280" height={speedRatio * 170 + 10} />
          </clipPath>
          <clipPath id="bmwRpmClip">
            <rect x="480" y={188 - rpmRatio * 170} width="280" height={rpmRatio * 170 + 10} />
          </clipPath>
        </defs>

        <line x1="250" y1="158" x2="510" y2="158" stroke="#1e293b" strokeWidth="1" />
        <line x1="335" y1="78" x2="270" y2="180" stroke={modePalette.primary} strokeOpacity="0.28" strokeWidth="2" />
        <line x1="425" y1="78" x2="490" y2="180" stroke={modePalette.primary} strokeOpacity="0.28" strokeWidth="2" />

        {/* 1. CHEVRON ESQUERDO: VELOCIDADE (0–260 KM/H) */}
        <polyline points="195,18 68,103 195,188" fill="none" stroke="#1e293b" strokeWidth="16" strokeLinejoin="miter" />
        <polyline
          points="195,18 68,103 195,188"
          fill="none"
          stroke="url(#bmwLeftChevron)"
          strokeWidth="16"
          strokeLinejoin="miter"
          clipPath="url(#bmwSpeedClip)"
        />
        {[0, 60, 120, 180, 260].map((val, idx) => {
          const y = 184 - (val / maxSpeed) * 162
          const x = val <= 130 ? 195 - (val / 130) * 118 : 77 + ((val - 130) / 130) * 118
          return (
            <text key={idx} x={x + 22} y={y + 3} fill="#94a3b8" fontSize="10" fontWeight="800">
              {val}
            </text>
          )
        })}

        <text x="195" y="98" fill="#ffffff" fontSize="50" fontWeight="900" fontStyle="italic" textAnchor="middle">
          {speed}
        </text>
        <text x="195" y="118" fill="#94a3b8" fontSize="10" fontWeight="800" textAnchor="middle">
          km/h
        </text>

        {/* Barra de Combustível 59L + Autonomia */}
        <text x="26" y="176" fill="#94a3b8" fontSize="8.5" fontWeight="700">
          ⛽ {fuelPercent}% · {estimatedRangeKm} km
        </text>
        <rect x="26" y="182" width="108" height="6" rx="2" fill="#0f172a" />
        <rect
          x="26"
          y="182"
          width={clamp((fuelPercent / 100) * 108, 0, 108)}
          height="6"
          rx="2"
          fill={fuelPercent <= 15 ? '#ef4444' : '#38bdf8'}
        />

        {/* 2. CENTRO LIVE COCKPIT: ZF 8HP, SPORT DISPLAYS REAIS E ODO */}
        <rect x="292" y="18" width="176" height="62" rx="10" fill="#090f1c" stroke="#1e293b" strokeWidth="1.5" />
        <text x="336" y="40" fill="#64748b" fontSize="8.5" fontWeight="800" textAnchor="middle">
          ZF 8HP
        </text>
        <text
          x="336"
          y="67"
          fill={modePalette.primary}
          fontSize="28"
          fontWeight="900"
          fontStyle="italic"
          textAnchor="middle"
        >
          {zfGearLabel}
        </text>
        <line x1="376" y1="26" x2="376" y2="72" stroke="#1e293b" strokeWidth="1" />
        <text x="422" y="38" fill="#94a3b8" fontSize="8" fontWeight="700" textAnchor="middle">
          {drivingMode === 'sport' ? 'SPORT DISPLAY' : 'B48 RWD'}
        </text>
        <text x="422" y="54" fill="#f8fafc" fontSize="10.5" fontWeight="900" textAnchor="middle">
          {drivingMode === 'sport'
            ? `${Math.round(livePowerHp)} cv · ${Math.round(liveTorqueNm)} Nm`
            : `${boostPressureBar >= 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} bar`}
        </text>
        <text x="422" y="69" fill="#38bdf8" fontSize="8" fontWeight="700" textAnchor="middle">
          {Math.abs(lateralAccelG).toFixed(2)} G · RWD
        </text>

        <rect x="358" y="106" width="44" height="24" rx="6" fill="#0f172a" stroke={modePalette.primary} strokeWidth="1.5" />
        <line x1="362" y1="126" x2="398" y2="126" stroke="#ef4444" strokeWidth="2.5" />
        <text x="380" y="149" fill="#94a3b8" fontSize="8.5" fontWeight="700" textAnchor="middle">
          {last0to100 !== null
            ? `0–100 km/h: ${formatZeroToHundredSeconds(last0to100)} s`
            : `${Math.round(livePowerHp)} cv · ${Math.round(liveTorqueNm)} Nm`}
        </text>
        <text x="380" y="186" fill="#cbd5e1" fontSize="9.5" fontWeight="800" textAnchor="middle">
          ODO {Math.round(odometerKm).toLocaleString('pt-BR')} km
        </text>

        {/* 3. CHEVRON DIREITO: CONTA-GIROS CONTRA-ROTATIVO M SPORT (0–7 x1000 RPM) */}
        <polyline points="565,18 692,103 565,188" fill="none" stroke="#1e293b" strokeWidth="16" strokeLinejoin="miter" />
        <line x1="590" y1="35" x2="565" y2="18" stroke="#7f1d1d" strokeWidth="16" />
        <polyline
          points="565,18 692,103 565,188"
          fill="none"
          stroke="url(#bmwRightChevron)"
          strokeWidth="16"
          strokeLinejoin="miter"
          clipPath="url(#bmwRpmClip)"
        />

        {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
          const y = 184 - (k / 7) * 162
          const x = k <= 3.5 ? 565 + (k / 3.5) * 118 : 683 - ((k - 3.5) / 3.5) * 118
          return (
            <text
              key={k}
              x={x - 24}
              y={y + 3}
              fill={k >= 6.5 ? '#ef4444' : '#cbd5e1'}
              fontSize="10.5"
              fontWeight="900"
              textAnchor="end"
            >
              {k}
            </text>
          )
        })}

        <text
          x="568"
          y="98"
          fill={rpm >= redlineStart ? '#f87171' : '#ffffff'}
          fontSize="40"
          fontWeight="900"
          fontStyle="italic"
          textAnchor="middle"
        >
          {(rpm / 1000).toFixed(1)}
        </text>
        <text x="568" y="118" fill="#94a3b8" fontSize="9.5" fontWeight="800" textAnchor="middle">
          1/min x1000
        </text>

        <text x="638" y="176" fill="#94a3b8" fontSize="9" fontWeight="700">
          🌡 {coolantTemp}°C MOTOR
        </text>
        <rect x="638" y="182" width="96" height="6" rx="2" fill="#0f172a" />
        <rect
          x="638"
          y="182"
          width={clamp(((coolantTemp - 50) / 80) * 96, 4, 96)}
          height="6"
          rx="2"
          fill={coolantTemp > 110 ? '#ef4444' : '#38bdf8'}
        />
      </svg>

      {/* Rodapé de Luzes Espia BMW */}
      <div className="mt-0.5 flex w-full items-center justify-center gap-3 border-t border-white/10 pt-1">
        <ClusterIndicatorIcon kind="battery" active={Boolean(warningLights.battery)} />
        <ClusterIndicatorIcon kind="oil" active={Boolean(warningLights.oil)} />
        <ClusterIndicatorIcon kind="checkEngine" active={Boolean(warningLights.checkEngine)} />
        {abs.available && (
          <ClusterIndicatorIcon
            kind="abs"
            active={Boolean(warningLights.absFault)}
            flashing={Boolean(warningLights.absActive && !warningLights.absFault)}
          />
        )}
        <ClusterIndicatorIcon kind="tcs" active={Boolean(warningLights.tcs)} flashing={Boolean(warningLights.tcsFlash)} />
        <ClusterIndicatorIcon kind="brake" active={Boolean(warningLights.brake)} />
        <ClusterIndicatorIcon kind="temp" active={Boolean(warningLights.temp)} />
      </div>
    </div>
  )
})
