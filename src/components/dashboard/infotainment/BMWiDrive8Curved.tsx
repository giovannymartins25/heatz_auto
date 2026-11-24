import { memo, useState, useEffect } from 'react'
import type { VehicleConfig, DrivingMode } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp } from '@/utils/math'
import { AMBIENT_COLOR_MAP, type AmbientLightColor } from '@/utils/ambientLighting'
import { InternetMediaCenter } from './shared/InternetMediaCenter'
import type { FanLevel } from '@/systems/cabin'

export interface BMWiDrive8CurvedProps {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  className?: string
  fill?: boolean
}

type IDrive8View = 'analyzer' | 'modes' | 'trizone' | 'media'

/**
 * BMWiDrive8Curved — Central Multimídia Widescreen 14,9" (BMW Operating System 8 / Curved Display)
 * específica do BMW 320i M Sport 2.0 ActiveFlex 2024 (G20 LCI).
 *
 * Recursos dedicados BMW OS 8:
 * - Dock vertical esquerdo estilo iDrive 8 + widgets horizontais em vidro curvo sem bordas pesadas
 * - M Sport Driving Analyzer: pressão TwinPower Turbo, potência (184 cv), torque (300 Nm), ângulo de deriva RWD e força G
 * - My Modes: Personal (Comfort), Sport e Efficient (Eco Pro) sincronizados com a física
 * - Ar-Condicionado Automático Digital Tri-Zone (Motorista, Passageiro e 3ª Zona Traseira) sincronizado ao `ClimateSystem`
 */
export const BMWiDrive8Curved = memo(function BMWiDrive8Curved({
  vehicle,
  telemetry,
  className = '',
  fill = false,
}: BMWiDrive8CurvedProps) {
  const [view, setView] = useState<IDrive8View>('analyzer')
  const [clockTime, setClockTime] = useState('15:10')
  const [passOffsetC, setPassOffsetC] = useState(0.5)
  const [rearZoneOffsetC, setRearZoneOffsetC] = useState(1.0)

  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const setDrivingMode = useSimulationStore((s) => s.setDrivingMode)
  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const setAmbientLightColor = useSimulationStore((s) => s.setAmbientLightColor)
  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const lateralAccelG = useSimulationStore((s) => s.lateralAccelG)
  const slipAngleDeg = useSimulationStore((s) => s.slipAngleDeg)
  const zoneName = useSimulationStore((s) => s.zoneName)
  const surfaceType = useSimulationStore((s) => s.surfaceType)
  const toggleMap = useSimulationStore((s) => s.toggleMap)

  // Climatização Tri-Zone integrada ao ClimateSystem
  const cabinTempC = useSimulationStore((s) => s.cabinTempC)
  const climateTargetTempC = useSimulationStore((s) => s.climateTargetTempC)
  const climateAcEnabled = useSimulationStore((s) => s.climateAcEnabled)
  const isCompressorEngaged = useSimulationStore((s) => s.isCompressorEngaged)
  const climateFanLevel = useSimulationStore((s) => s.climateFanLevel)
  const climateAutoMode = useSimulationStore((s) => s.climateAutoMode)
  const climateRecirculation = useSimulationStore((s) => s.climateRecirculation)
  const climateHeaterEnabled = useSimulationStore((s) => s.climateHeaterEnabled)
  const climateDefrosterEnabled = useSimulationStore((s) => s.climateDefrosterEnabled)
  const toggleClimateAc = useSimulationStore((s) => s.toggleClimateAc)
  const stepClimateTargetTempC = useSimulationStore((s) => s.stepClimateTargetTempC)
  const setClimateFanLevel = useSimulationStore((s) => s.setClimateFanLevel)
  const toggleClimateAutoMode = useSimulationStore((s) => s.toggleClimateAutoMode)
  const toggleClimateRecirculation = useSimulationStore((s) => s.toggleClimateRecirculation)
  const toggleClimateHeater = useSimulationStore((s) => s.toggleClimateHeater)
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
  const throttle = telemetry.pedals.throttlePercent / 100
  const maxHp = vehicle.engine.maxPower || 184
  const maxNm = vehicle.engine.maxTorque || 300
  const oilTemp = Math.round(telemetry.auxGauges.oilTemp ?? (telemetry.auxGauges.coolantTemp || 92) + 5)

  const liveHp = Math.round(
    clamp(maxHp * clamp(rpm / 5600, 0.08, 1.02) * (0.2 + 0.8 * throttle) * (rpm > 1000 ? 1 : 0.18), 0, maxHp),
  )
  const liveNm = Math.round(
    clamp(
      maxNm * (rpm >= 1350 && rpm <= 4200 ? 1.0 : 0.78) * (0.18 + 0.82 * throttle) * (rpm > 900 ? 1 : 0.2),
      0,
      maxNm,
    ),
  )

  const passTempC = clamp(climateTargetTempC + passOffsetC, 16, 30)
  const rearTempC = clamp(climateTargetTempC + rearZoneOffsetC, 16, 30)

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-cyan-500/35 bg-gradient-to-br from-[#0a1222] via-[#060a14] to-[#03050a] font-mono text-white shadow-[0_0_28px_rgba(56,189,248,0.16)] select-none ${
        fill ? 'h-full w-full p-1.5 sm:p-2' : 'w-[355px] p-2.5 sm:w-[385px]'
      } ${className}`}
      data-testid="multimedia-bmw-idrive8-curved"
    >
      {/* Barra superior BMW OS 8 */}
      <div className="mb-1 flex shrink-0 items-center justify-between border-b border-cyan-500/25 pb-1 text-[8px] sm:text-[9px]">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
          <span className="font-black tracking-wider text-cyan-300">BMW iDRIVE 8</span>
          <span className="hidden text-zinc-400 sm:inline">· CURVED 14.9&quot;</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-300">
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[7px] font-bold text-cyan-200 uppercase">
            {drivingMode === 'sport' ? 'SPORT' : drivingMode === 'eco' ? 'EFFICIENT' : 'PERSONAL'}
          </span>
          <span className="font-bold">{clockTime}</span>
        </div>
      </div>

      {/* Layout BMW OS 8: Dock Lateral Esquerdo + Palco Widescreen */}
      <div className="flex min-h-0 flex-1 gap-1.5">
        {/* Dock vertical OS 8 */}
        <div className="flex shrink-0 flex-col justify-between gap-1 rounded-xl border border-white/10 bg-black/50 p-1 text-[7.5px] font-black">
          {(
            [
              { id: 'analyzer', icon: '///M', title: 'M Sport Analyzer' },
              { id: 'modes', icon: '◈', title: 'My Modes' },
              { id: 'trizone', icon: '❄️', title: 'Tri-Zone Climate' },
              { id: 'media', icon: '♫', title: 'Media & Maps' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              title={item.title}
              className={`flex h-7 w-9 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                view === item.id
                  ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.4)]'
                  : 'border-transparent bg-zinc-900/70 text-zinc-400 hover:text-white'
              }`}
            >
              {item.icon}
            </button>
          ))}
        </div>

        {/* Conteúdo Widescreen */}
        <div className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto pr-0.5" style={{ touchAction: 'pan-y' }}>
          {view === 'analyzer' && (
            <div className="my-auto flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[8px]">
                <span className="font-black tracking-wider text-cyan-300">M DRIVING ANALYZER · RWD</span>
                <span className="text-zinc-400">ÓLEO {oilTemp}°C</span>
              </div>

              {/* Barras horizontais estilo Sport Displays BMW */}
              <div className="space-y-1 rounded-xl border border-white/10 bg-zinc-950/85 p-2">
                <div>
                  <div className="flex justify-between text-[7.5px] font-bold">
                    <span className="text-zinc-400">POTÊNCIA B48</span>
                    <span className="text-cyan-300 tabular-nums">
                      {liveHp} / {maxHp} cv
                    </span>
                  </div>
                  <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-zinc-900">
                    <div
                      className="h-full bg-gradient-to-r from-sky-600 to-cyan-300"
                      style={{ width: `${clamp((liveHp / maxHp) * 100, 2, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[7.5px] font-bold">
                    <span className="text-zinc-400">TORQUE TWINPOWER</span>
                    <span className="text-red-400 tabular-nums">
                      {liveNm} / {maxNm} Nm
                    </span>
                  </div>
                  <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-zinc-900">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-red-500"
                      style={{ width: `${clamp((liveNm / maxNm) * 100, 2, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 text-center text-[7.5px]">
                <div className="rounded-lg border border-white/10 bg-black/50 py-1">
                  <span className="block text-[6.5px] text-zinc-500">BOOST</span>
                  <span className="font-black text-cyan-300 tabular-nums">
                    {boostPressureBar >= 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} bar
                  </span>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/50 py-1">
                  <span className="block text-[6.5px] text-zinc-500">G LATERAL</span>
                  <span className="font-black text-white tabular-nums">{lateralAccelG.toFixed(2)} G</span>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/50 py-1">
                  <span className="block text-[6.5px] text-zinc-500">DERIVA RWD</span>
                  <span className="font-black text-amber-300 tabular-nums">{Math.abs(slipAngleDeg).toFixed(1)}°</span>
                </div>
              </div>
            </div>
          )}

          {view === 'modes' && (
            <div className="my-auto flex flex-col gap-1.5">
              <span className="text-[8px] font-black tracking-wider text-cyan-300">BMW MY MODES</span>
              <div className="grid grid-cols-3 gap-1 text-[8px]">
                {(
                  [
                    { id: 'normal', title: 'PERSONAL', sub: 'Comfort RWD' },
                    { id: 'sport', title: 'SPORT', sub: 'M Dynamic' },
                    { id: 'eco', title: 'EFFICIENT', sub: 'Eco Pro' },
                  ] as { id: DrivingMode; title: string; sub: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setDrivingMode(m.id)}
                    className={`rounded-xl border p-1.5 text-left transition-all cursor-pointer ${
                      drivingMode === m.id
                        ? 'border-cyan-400 bg-cyan-500/20 text-white shadow'
                        : 'border-white/10 bg-zinc-900/80 text-zinc-400'
                    }`}
                  >
                    <span className="block font-black">{m.title}</span>
                    <span className="block text-[6.5px] opacity-80">{m.sub}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/70 px-2 py-1 text-[7.5px]">
                <span className="text-zinc-400">AMBIENT LIGHT</span>
                <div className="flex items-center gap-1">
                  {(['cyan', 'blue', 'red', 'amber', 'white'] as AmbientLightColor[]).map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setAmbientLightColor(col)}
                      className={`h-4 w-4 rounded-full border cursor-pointer ${
                        ambientLightColor === col ? 'scale-110 border-white' : 'border-white/20 opacity-70'
                      }`}
                      style={{ backgroundColor: AMBIENT_COLOR_MAP[col].hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[7.5px]">
                <span className="truncate text-zinc-300">
                  📍 {zoneName || 'Circuito'} · <b className="text-cyan-300 uppercase">{surfaceType}</b>
                </span>
                <button
                  type="button"
                  onClick={toggleMap}
                  className="rounded border border-cyan-500/40 bg-cyan-500/20 px-2 py-0.5 font-black text-cyan-200 cursor-pointer"
                >
                  BMW MAPS
                </button>
              </div>
            </div>
          )}

          {view === 'trizone' && (
            <div className="my-auto flex flex-col gap-1">
              <div className="flex items-center justify-between text-[7.5px]">
                <span className="font-black text-cyan-300">CLIMATE CONTROL · 3 ZONAS</span>
                <span className="text-zinc-400">Cabine {cabinTempC.toFixed(1)}°C</span>
              </div>

              {/* 3 Zonas: Motorista, Passageiro, Traseira */}
              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-1">
                  <span className="block text-[6px] text-zinc-400">MOTORISTA</span>
                  <div className="mt-0.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => stepClimateTargetTempC(-0.5)}
                      className="h-4 w-4 rounded bg-zinc-800 text-[10px] font-black text-sky-400 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-[10px] font-black tabular-nums">{climateTargetTempC.toFixed(1)}°</span>
                    <button
                      type="button"
                      onClick={() => stepClimateTargetTempC(0.5)}
                      className="h-4 w-4 rounded bg-zinc-800 text-[10px] font-black text-red-400 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-1">
                  <span className="block text-[6px] text-zinc-400">PASSAGEIRO</span>
                  <div className="mt-0.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setPassOffsetC((v) => clamp(v - 0.5, -4, 4))}
                      className="h-4 w-4 rounded bg-zinc-800 text-[10px] font-black text-sky-400 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-[10px] font-black tabular-nums">{passTempC.toFixed(1)}°</span>
                    <button
                      type="button"
                      onClick={() => setPassOffsetC((v) => clamp(v + 0.5, -4, 4))}
                      className="h-4 w-4 rounded bg-zinc-800 text-[10px] font-black text-red-400 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-cyan-500/25 bg-zinc-900/80 p-1">
                  <span className="block text-[6px] text-cyan-300">3ª ZONA TRAS.</span>
                  <div className="mt-0.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setRearZoneOffsetC((v) => clamp(v - 0.5, -4, 4))}
                      className="h-4 w-4 rounded bg-zinc-800 text-[10px] font-black text-sky-400 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-[10px] font-black tabular-nums">{rearTempC.toFixed(1)}°</span>
                    <button
                      type="button"
                      onClick={() => setRearZoneOffsetC((v) => clamp(v + 0.5, -4, 4))}
                      className="h-4 w-4 rounded bg-zinc-800 text-[10px] font-black text-red-400 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/50 px-1.5 py-0.5 text-[7px]">
                <span className="text-zinc-400">VENTILADOR</span>
                <div className="flex gap-0.5">
                  {([0, 1, 2, 3, 4, 5] as FanLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setClimateFanLevel(lvl)}
                      className={`h-4 w-4 rounded font-black cursor-pointer ${
                        climateFanLevel === lvl ? 'bg-cyan-500 text-black' : 'bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1 text-[7px] font-black" data-testid="multimedia-climate-panel">
                <button
                  type="button"
                  data-testid="multimedia-btn-ac"
                  onClick={toggleClimateAc}
                  className={`rounded border py-0.5 cursor-pointer ${
                    climateAcEnabled ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200' : 'border-white/10 bg-zinc-900 text-zinc-400'
                  }`}
                >
                  A/C{isCompressorEngaged ? ' ●' : ''}
                </button>
                <button
                  type="button"
                  data-testid="multimedia-btn-auto"
                  onClick={toggleClimateAutoMode}
                  className={`rounded border py-0.5 cursor-pointer ${
                    climateAutoMode ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200' : 'border-white/10 bg-zinc-900 text-zinc-400'
                  }`}
                >
                  AUTO
                </button>
                <button
                  type="button"
                  data-testid="multimedia-btn-recirc"
                  onClick={toggleClimateRecirculation}
                  className={`rounded border py-0.5 cursor-pointer ${
                    climateRecirculation ? 'border-sky-400 bg-sky-500/25 text-sky-200' : 'border-white/10 bg-zinc-900 text-zinc-400'
                  }`}
                >
                  RECIRC
                </button>
                <button
                  type="button"
                  data-testid="multimedia-btn-heater"
                  onClick={toggleClimateHeater}
                  className={`rounded border py-0.5 cursor-pointer ${
                    climateHeaterEnabled ? 'border-orange-400 bg-orange-500/25 text-orange-200' : 'border-white/10 bg-zinc-900 text-zinc-400'
                  }`}
                >
                  AQUEC
                </button>
                <button
                  type="button"
                  data-testid="multimedia-btn-defrost"
                  onClick={toggleClimateDefroster}
                  className={`rounded border py-0.5 cursor-pointer ${
                    climateDefrosterEnabled ? 'border-amber-400 bg-amber-500/25 text-amber-200' : 'border-white/10 bg-zinc-900 text-zinc-400'
                  }`}
                >
                  DESEMB
                </button>
              </div>
            </div>
          )}

          {view === 'media' && <InternetMediaCenter theme="toyota" compact={fill} />}
        </div>
      </div>

      {/* Barra inferior permanente de clima OS 8 */}
      <div className="mt-1 flex shrink-0 items-center justify-between border-t border-white/10 pt-1 text-[7.5px] text-zinc-300">
        <button
          type="button"
          onClick={() => setView('trizone')}
          className="font-bold text-cyan-300 hover:underline cursor-pointer"
        >
          ❄️ {climateTargetTempC.toFixed(1)}°C | {passTempC.toFixed(1)}°C | {rearTempC.toFixed(1)}°C
        </button>
        <span className="text-zinc-400">
          {climateAcEnabled ? 'A/C ON' : 'VENT'} · FAN {climateFanLevel}/5
        </span>
      </div>
    </div>
  )
})
