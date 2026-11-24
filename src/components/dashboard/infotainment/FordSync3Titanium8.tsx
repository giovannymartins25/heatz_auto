import { memo, useState, useEffect } from 'react'
import type { VehicleConfig, DrivingMode } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp } from '@/utils/math'
import { AMBIENT_COLOR_MAP, type AmbientLightColor } from '@/utils/ambientLighting'
import { InternetMediaCenter } from './shared/InternetMediaCenter'
import type { FanLevel } from '@/systems/cabin'

export interface FordSync3Titanium8Props {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  className?: string
  fill?: boolean
}

type Sync3Tab = 'awd' | 'clima' | 'audio' | 'settings'

/**
 * FordSync3Titanium8 — Central Touchscreen Capacitiva Ford SYNC 3 de 8"
 * exclusiva do Ford Fusion Titanium 2.0 EcoBoost AWD 2019 (CD391).
 *
 * Distinção explícita em relação ao Fusion SEL 2012 (SYNC 1):
 * - Interface gráfica capacitiva SYNC 3 em paleta clara/azul-gelo Ford Titanium com barra inferior de ícones
 * - Monitor gráfico Intelligent AWD sob demanda + telemetria 2.0 EcoBoost GTDI (248 cv / 373 Nm)
 * - Climatização Dual-Zone Touch + Bancos Dianteiros Aquecidos (3 níveis) integrada ao `ClimateSystem`
 */
export const FordSync3Titanium8 = memo(function FordSync3Titanium8({
  vehicle,
  telemetry,
  className = '',
  fill = false,
}: FordSync3Titanium8Props) {
  const [tab, setTab] = useState<Sync3Tab>('awd')
  const [clockTime, setClockTime] = useState('16:20')
  const [passOffsetC, setPassOffsetC] = useState(0.5)
  const [driverSeatHeat, setDriverSeatHeat] = useState<0 | 1 | 2 | 3>(0)
  const [passSeatHeat, setPassSeatHeat] = useState<0 | 1 | 2 | 3>(0)

  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const setDrivingMode = useSimulationStore((s) => s.setDrivingMode)
  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const setAmbientLightColor = useSimulationStore((s) => s.setAmbientLightColor)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const throttle = useSimulationStore((s) => s.throttle)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const awdRearCoupling = useSimulationStore((s) => s._physics?.getStateSnapshot().awdRearCoupling ?? 0.08)
  const zoneName = useSimulationStore((s) => s.zoneName)
  const surfaceType = useSimulationStore((s) => s.surfaceType)
  const toggleMap = useSimulationStore((s) => s.toggleMap)

  // Climatização Dual-Zone real (ClimateSystem)
  const cabinTempC = useSimulationStore((s) => s.cabinTempC)
  const climateTargetTempC = useSimulationStore((s) => s.climateTargetTempC)
  const climateAcEnabled = useSimulationStore((s) => s.climateAcEnabled)
  const isCompressorEngaged = useSimulationStore((s) => s.isCompressorEngaged)
  const climateFanLevel = useSimulationStore((s) => s.climateFanLevel)
  const climateAutoMode = useSimulationStore((s) => s.climateAutoMode)
  const climateRecirculation = useSimulationStore((s) => s.climateRecirculation)
  const climateDefrosterEnabled = useSimulationStore((s) => s.climateDefrosterEnabled)
  const toggleClimateAc = useSimulationStore((s) => s.toggleClimateAc)
  const stepClimateTargetTempC = useSimulationStore((s) => s.stepClimateTargetTempC)
  const setClimateFanLevel = useSimulationStore((s) => s.setClimateFanLevel)
  const toggleClimateAutoMode = useSimulationStore((s) => s.toggleClimateAutoMode)
  const toggleClimateRecirculation = useSimulationStore((s) => s.toggleClimateRecirculation)
  const toggleClimateDefroster = useSimulationStore((s) => s.toggleClimateDefroster)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClockTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      )
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  const rpm = telemetry.tachometer.rpm
  const maxHp = vehicle.engine.maxPower || 248
  const liveHp = Math.round(
    clamp(
      maxHp *
        clamp(rpm / 5800, 0.08, 1.04) *
        (0.22 + 0.78 * throttle) *
        clamp(1 + Math.max(0, boostPressureBar) * 0.35, 0.8, 1.3) *
        (rpm > 1000 ? 1 : 0.2),
      0,
      maxHp * 1.1,
    ),
  )

  const rearSharePct =
    isRunning && currentGear > 0 && throttle > 0.02
      ? Math.round(clamp(awdRearCoupling * 50, 4, 44))
      : 0
  const frontSharePct =
    isRunning && currentGear > 0 && throttle > 0.02 ? 100 - rearSharePct : 0
  const passTempC = clamp(climateTargetTempC + passOffsetC, 16, 30)

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-sky-400/45 bg-gradient-to-b from-[#0e1b2e] via-[#0a1322] to-[#060b14] font-mono text-white shadow-[0_0_26px_rgba(56,189,248,0.18)] select-none ${
        fill ? 'h-full w-full p-1.5 sm:p-2' : 'w-[350px] p-2.5 sm:w-[375px]'
      } ${className}`}
      data-testid="multimedia-ford-sync3-8"
    >
      {/* Barra de status superior SYNC 3 */}
      <div className="mb-1 flex shrink-0 items-center justify-between border-b border-sky-400/25 pb-1 text-[8px] sm:text-[9px]">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-sky-500 px-1.5 py-0.5 text-[7.5px] font-black text-slate-950">
            SYNC 3
          </span>
          <span className="font-black text-sky-200">SONY TITANIUM 8&quot;</span>
        </div>
        <div className="flex items-center gap-2 text-sky-100">
          {driverSeatHeat > 0 && <span className="text-[7.5px] text-orange-300">🔥{driverSeatHeat}</span>}
          <span className="text-[7.5px] text-sky-300">{cabinTempC.toFixed(1)}°C</span>
          <span className="font-bold">{clockTime}</span>
        </div>
      </div>

      {/* Área de conteúdo SYNC 3 */}
      <div className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto px-0.5" style={{ touchAction: 'pan-y' }}>
        {tab === 'awd' && (
          <div className="my-auto flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[8px]">
              <span className="font-black text-sky-300">INTELLIGENT AWD &amp; ECOBOOST</span>
              <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[7px] font-bold text-sky-200">
                SOB DEMANDA
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-sky-400/25 bg-slate-950/75 p-2 text-[7.5px]">
              <div>
                <span className="block text-[6.5px] text-slate-400">TRAÇÃO DIANTEIRA (PTU)</span>
                <span className="text-sm font-black text-sky-300 tabular-nums">{frontSharePct}%</span>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-900">
                  <div className="h-full bg-sky-400" style={{ width: `${frontSharePct}%` }} />
                </div>
              </div>
              <div>
                <span className="block text-[6.5px] text-slate-400">TRAÇÃO TRASEIRA (RDM)</span>
                <span className="text-sm font-black text-cyan-300 tabular-nums">{rearSharePct}%</span>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-900">
                  <div
                    className="h-full bg-cyan-300"
                    style={{ width: `${Math.min(100, rearSharePct * 2)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 text-center text-[7.5px]">
              <div className="rounded-lg border border-white/10 bg-black/45 py-1">
                <span className="block text-[6.5px] text-slate-400">2.0 GTDI</span>
                <span className="font-black text-white tabular-nums">{liveHp} cv</span>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/45 py-1">
                <span className="block text-[6.5px] text-slate-400">BOOST</span>
                <span className="font-black text-sky-300 tabular-nums">
                  {boostPressureBar >= 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} bar
                </span>
              </div>
              <button
                type="button"
                onClick={toggleMap}
                className="rounded-lg border border-sky-400/40 bg-sky-500/20 py-1 font-black text-sky-200 cursor-pointer"
              >
                <span className="block text-[6.5px] text-sky-300">{surfaceType.toUpperCase()}</span>
                <span>MAPA GPS</span>
              </button>
            </div>
          </div>
        )}

        {tab === 'clima' && (
          <div className="my-auto flex flex-col gap-1">
            <div className="grid grid-cols-2 gap-1.5">
              {/* Motorista + Banco Aquecido */}
              <div className="rounded-xl border border-sky-400/25 bg-slate-950/75 p-1.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => stepClimateTargetTempC(-0.5)}
                    className="h-5 w-5 rounded bg-slate-800 text-xs font-black text-sky-300 cursor-pointer"
                  >
                    -
                  </button>
                  <div className="text-center leading-tight">
                    <span className="block text-[6px] text-slate-400">MOTORISTA</span>
                    <span className="text-xs font-black tabular-nums">{climateTargetTempC.toFixed(1)}°C</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => stepClimateTargetTempC(0.5)}
                    className="h-5 w-5 rounded bg-slate-800 text-xs font-black text-red-300 cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  data-testid="sync3-driver-seat-heat"
                  onClick={() => setDriverSeatHeat((s) => ((s + 1) % 4) as 0 | 1 | 2 | 3)}
                  className={`mt-1 w-full rounded border py-0.5 text-[7px] font-black cursor-pointer ${
                    driverSeatHeat > 0
                      ? 'border-orange-400 bg-orange-500/25 text-orange-200'
                      : 'border-white/10 bg-slate-900 text-slate-400'
                  }`}
                >
                  🔥 BANCO MOT. {driverSeatHeat > 0 ? `${driverSeatHeat}/3` : 'OFF'}
                </button>
              </div>

              {/* Passageiro + Banco Aquecido */}
              <div className="rounded-xl border border-sky-400/25 bg-slate-950/75 p-1.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPassOffsetC((v) => clamp(v - 0.5, -4, 4))}
                    className="h-5 w-5 rounded bg-slate-800 text-xs font-black text-sky-300 cursor-pointer"
                  >
                    -
                  </button>
                  <div className="text-center leading-tight">
                    <span className="block text-[6px] text-slate-400">PASSAGEIRO</span>
                    <span className="text-xs font-black tabular-nums">{passTempC.toFixed(1)}°C</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPassOffsetC((v) => clamp(v + 0.5, -4, 4))}
                    className="h-5 w-5 rounded bg-slate-800 text-xs font-black text-red-300 cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  data-testid="sync3-pass-seat-heat"
                  onClick={() => setPassSeatHeat((s) => ((s + 1) % 4) as 0 | 1 | 2 | 3)}
                  className={`mt-1 w-full rounded border py-0.5 text-[7px] font-black cursor-pointer ${
                    passSeatHeat > 0
                      ? 'border-orange-400 bg-orange-500/25 text-orange-200'
                      : 'border-white/10 bg-slate-900 text-slate-400'
                  }`}
                >
                  🔥 BANCO PASS. {passSeatHeat > 0 ? `${passSeatHeat}/3` : 'OFF'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/45 px-2 py-0.5 text-[7px]">
              <span className="text-slate-300">VENTILADOR</span>
              <div className="flex gap-0.5">
                {([0, 1, 2, 3, 4, 5] as FanLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setClimateFanLevel(lvl)}
                    className={`h-4 w-4 rounded font-black cursor-pointer ${
                      climateFanLevel === lvl ? 'bg-sky-400 text-slate-950' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1 text-[7px] font-black">
              <button
                type="button"
                onClick={toggleClimateAc}
                className={`rounded border py-0.5 cursor-pointer ${
                  climateAcEnabled ? 'border-sky-400 bg-sky-500/25 text-sky-200' : 'border-white/10 bg-slate-900 text-slate-400'
                }`}
              >
                A/C{isCompressorEngaged ? ' ●' : ''}
              </button>
              <button
                type="button"
                onClick={toggleClimateAutoMode}
                className={`rounded border py-0.5 cursor-pointer ${
                  climateAutoMode ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200' : 'border-white/10 bg-slate-900 text-slate-400'
                }`}
              >
                AUTO
              </button>
              <button
                type="button"
                onClick={toggleClimateRecirculation}
                className={`rounded border py-0.5 cursor-pointer ${
                  climateRecirculation ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200' : 'border-white/10 bg-slate-900 text-slate-400'
                }`}
              >
                RECIRC
              </button>
              <button
                type="button"
                onClick={toggleClimateDefroster}
                className={`rounded border py-0.5 cursor-pointer ${
                  climateDefrosterEnabled ? 'border-amber-400 bg-amber-500/25 text-amber-200' : 'border-white/10 bg-slate-900 text-slate-400'
                }`}
              >
                MAX 💨
              </button>
            </div>
          </div>
        )}

        {tab === 'audio' && <InternetMediaCenter theme="toyota" compact={fill} />}

        {tab === 'settings' && (
          <div className="my-auto flex flex-col gap-1.5 text-[8px]">
            <div className="grid grid-cols-3 gap-1">
              {(['eco', 'normal', 'sport'] as DrivingMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDrivingMode(m)}
                  className={`rounded-lg border py-1 font-black uppercase cursor-pointer ${
                    drivingMode === m
                      ? 'border-sky-400 bg-sky-500/25 text-white'
                      : 'border-white/10 bg-slate-900 text-slate-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/75 px-2 py-1">
              <span className="text-slate-300">ICE BLUE AMBIENT</span>
              <div className="flex gap-1">
                {(['cyan', 'blue', 'white', 'red', 'amber'] as AmbientLightColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAmbientLightColor(c)}
                    className={`h-4 w-4 rounded-full border cursor-pointer ${
                      ambientLightColor === c ? 'scale-110 border-white' : 'border-white/20 opacity-70'
                    }`}
                    style={{ backgroundColor: AMBIENT_COLOR_MAP[c].hex }}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/45 px-2 py-1 text-[7.5px] text-slate-300">
              📍 {zoneName || 'Setor Urbano'} · Tanque 68 L · SelectShift Paddles
            </div>
          </div>
        )}
      </div>

      {/* Dock inferior característico do Ford SYNC 3 */}
      <div className="mt-1 grid shrink-0 grid-cols-4 gap-1 border-t border-sky-400/25 pt-1 text-[7.5px] font-black">
        {(
          [
            { id: 'awd', label: 'AWD / GTDI' },
            { id: 'clima', label: 'CLIMA / 🔥' },
            { id: 'audio', label: 'ÁUDIO SONY' },
            { id: 'settings', label: 'AJUSTES' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg border py-1 transition-all cursor-pointer ${
              tab === item.id
                ? 'border-sky-400 bg-sky-500/25 text-white shadow'
                : 'border-white/10 bg-slate-900/90 text-slate-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
})
