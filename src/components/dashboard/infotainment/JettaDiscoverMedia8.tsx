import { memo, useState, useEffect } from 'react'
import type { VehicleConfig, DrivingMode } from '@/types/vehicle'
import type { DashboardTelemetry } from '@/systems/dashboard'
import { BoostGauge, CircularProgressDial } from '@/components/gauges'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { clamp } from '@/utils/math'
import { AMBIENT_COLOR_MAP, type AmbientLightColor } from '@/utils/ambientLighting'
import { InternetMediaCenter } from './shared/InternetMediaCenter'
import type { FanLevel } from '@/systems/cabin'

export interface JettaDiscoverMedia8Props {
  vehicle: VehicleConfig
  telemetry: DashboardTelemetry
  className?: string
  fill?: boolean
}

type DiscoverMediaTab = 'perf' | 'clima' | 'media' | 'car'

/**
 * JettaDiscoverMedia8 — Central Multimídia Volkswagen Discover Media 8" (MIB)
 * específica do Volkswagen Jetta GLI 350 TSI 2021 (ano-modelo 2021 — NÃO utiliza VW Play 10,1").
 *
 * Características reais da unidade Discover Media 8" MIB:
 * - Moldura com tela de 8 polegadas integrada ao acabamento GLI, dois seletores giratórios físicos
 *   (Volume/Power à esquerda, Tune/Scroll à direita) e teclas capacitivas MIB laterais
 * - Performance Monitor GLI: pressão de turbo (BAR), potência instantânea (CV) e força G lateral / temp. óleo
 * - Climatronic Dual-Zone real sincronizado diretamente ao `ClimateSystem` (`useSimulationStore`) + aquecimento de bancos dianteiros
 * - Seletor de perfil de condução (Eco / Normal / Sport) e iluminação ambiente GLI
 */
export const JettaDiscoverMedia8 = memo(function JettaDiscoverMedia8({
  vehicle,
  telemetry,
  className = '',
  fill = false,
}: JettaDiscoverMedia8Props) {
  const [activeTab, setActiveTab] = useState<DiscoverMediaTab>('perf')
  const [clockTime, setClockTime] = useState('14:40')
  const [passengerOffsetC, setPassengerOffsetC] = useState(0.5)
  const [seatHeatLevel, setSeatHeatLevel] = useState<0 | 1 | 2 | 3>(0)

  const ambientLightColor = useSimulationStore((s) => s.ambientLightColor)
  const setAmbientLightColor = useSimulationStore((s) => s.setAmbientLightColor)
  const ambientTheme = AMBIENT_COLOR_MAP[ambientLightColor] || AMBIENT_COLOR_MAP.red

  const boostPressureBar = useSimulationStore((s) => s.boostPressureBar)
  const peakBoostBar = useSimulationStore((s) => s.peakBoostBar)
  const lateralAccelG = useSimulationStore((s) => s.lateralAccelG)
  const drivingMode = useSimulationStore((s) => s.drivingMode)
  const setDrivingMode = useSimulationStore((s) => s.setDrivingMode)
  const zoneName = useSimulationStore((s) => s.zoneName)
  const surfaceType = useSimulationStore((s) => s.surfaceType)
  const toggleMap = useSimulationStore((s) => s.toggleMap)

  // Climatronic real (ClimateSystem)
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
    const updateClock = () => {
      const now = new Date()
      setClockTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      )
    }
    updateClock()
    const id = setInterval(updateClock, 30000)
    return () => clearInterval(id)
  }, [])

  const rpm = telemetry.tachometer.rpm
  const throttlePercent = telemetry.pedals.throttlePercent
  const maxPowerHp = vehicle.engine.maxPower || 230
  const redlineRpm = vehicle.engine.maxRpm || 6800
  const oilTemp = Math.round(telemetry.auxGauges.oilTemp ?? (telemetry.auxGauges.coolantTemp || 90) + 4)

  const instantHp = Math.round(
    clamp(
      maxPowerHp *
        clamp(rpm / redlineRpm, 0.08, 1.04) *
        (0.22 + 0.78 * (throttlePercent / 100)) *
        clamp(1 + Math.max(0, boostPressureBar) * 0.42, 0.75, 1.35) *
        (rpm > 1100 ? 1 : 0.2),
      0,
      maxPowerHp * 1.15,
    ),
  )

  const passengerTempC = clamp(climateTargetTempC + passengerOffsetC, 16, 30)

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 ${ambientTheme.borderClass} bg-gradient-to-b from-[#15171d] via-[#0b0d11] to-[#050608] font-mono text-white shadow-2xl select-none ${
        fill ? 'h-full w-full p-1.5 sm:p-2' : 'w-[340px] p-2.5 sm:w-[365px]'
      } ${className}`}
      data-testid="multimedia-vw-discover-media-8"
    >
      {/* Cabeçalho MIB Discover Media 8" com representação dos 2 seletores rotativos físicos */}
      <div className="mb-1 flex shrink-0 items-center justify-between border-b border-red-500/30 pb-1 text-[8px] sm:text-[9px]">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-500 bg-zinc-900 text-[7px] font-black text-zinc-300 shadow-inner"
            title=" Botão Físico Power / Volume (MIB 8&quot;)"
          >
            ⏻
          </span>
          <span className="font-black tracking-wider text-red-400">DISCOVER MEDIA 8&quot;</span>
          <span className="hidden text-zinc-400 sm:inline">· GLI MIB</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-300">
          <span className="text-[7.5px] text-zinc-400">{cabinTempC.toFixed(1)}°C</span>
          <span className="font-bold">{clockTime}</span>
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-500 bg-zinc-900 text-[7px] font-black text-zinc-300 shadow-inner"
            title="Seletor Físico Tune / Scroll (MIB 8&quot;)"
          >
            ◎
          </span>
        </div>
      </div>

      {/* Área Principal */}
      <div className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto px-0.5 py-0.5" style={{ touchAction: 'pan-y' }}>
        {activeTab === 'perf' && (
          <div className="my-auto flex w-full flex-col gap-1.5">
            <div className="flex w-full items-center justify-around">
              <div className="flex flex-col items-center">
                <span className="mb-0.5 text-[7px] font-bold tracking-wider text-red-400 uppercase">
                  BOOST TSI
                </span>
                <div className="rounded-full border border-red-600/35 bg-zinc-900/90 p-0.5">
                  <BoostGauge
                    boostBar={boostPressureBar}
                    peakBar={peakBoostBar}
                    size={fill ? 52 : 68}
                    showPeak={false}
                    showLabel={false}
                  />
                </div>
                <span className="mt-0.5 text-[8px] font-black text-red-300 tabular-nums">
                  {boostPressureBar >= 0 ? `+${boostPressureBar.toFixed(2)}` : boostPressureBar.toFixed(2)} bar
                </span>
              </div>

              <CircularProgressDial
                label="POTÊNCIA"
                value={instantHp}
                max={maxPowerHp}
                unit="CV"
                color="#ef4444"
                glowColor="#ef4444"
                subLabel={`MAX ${maxPowerHp} CV`}
                fill={fill}
              />

              <CircularProgressDial
                label="ÓLEO TSI"
                value={oilTemp}
                min={50}
                max={130}
                unit="°C"
                color="#38bdf8"
                glowColor="#38bdf8"
                subLabel={`${Math.abs(lateralAccelG).toFixed(2)} G LAT`}
                fill={fill}
              />
            </div>

            <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-black/60 px-2 py-1 text-center text-[7.5px]">
              <div>
                <span className="block text-[6.5px] text-zinc-500">CÂMBIO</span>
                <span className="font-black text-white">DSG DQ250 6M</span>
              </div>
              <div>
                <span className="block text-[6.5px] text-zinc-500">FORÇA G</span>
                <span className="font-black text-red-400 tabular-nums">{lateralAccelG.toFixed(2)} G</span>
              </div>
              <div>
                <span className="block text-[6.5px] text-zinc-500">PERFIL</span>
                <span className="font-black text-amber-300 uppercase">{drivingMode}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clima' && (
          <div className="my-auto flex w-full flex-col gap-1">
            <div className="flex items-center justify-between border-b border-white/10 pb-0.5 text-[8px]">
              <span className="font-black text-red-400">CLIMATRONIC 2-ZONAS</span>
              <span className="text-zinc-400">
                Cabine <b className="text-white">{cabinTempC.toFixed(1)}°C</b>
              </span>
            </div>

            {/* Temperaturas Motorista / Passageiro */}
            <div className="grid grid-cols-2 gap-1.5 py-0.5">
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/80 px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => stepClimateTargetTempC(-0.5)}
                  className="h-5 w-5 rounded bg-zinc-800 text-xs font-black text-sky-400 active:scale-90 cursor-pointer"
                >
                  -
                </button>
                <div className="text-center leading-tight">
                  <span className="block text-[6.5px] text-zinc-400">MOTORISTA</span>
                  <span className="text-xs font-black text-white tabular-nums">
                    {climateTargetTempC.toFixed(1)}°C
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => stepClimateTargetTempC(0.5)}
                  className="h-5 w-5 rounded bg-zinc-800 text-xs font-black text-red-400 active:scale-90 cursor-pointer"
                >
                  +
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/80 px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => setPassengerOffsetC((v) => clamp(v - 0.5, -4, 4))}
                  className="h-5 w-5 rounded bg-zinc-800 text-xs font-black text-sky-400 active:scale-90 cursor-pointer"
                >
                  -
                </button>
                <div className="text-center leading-tight">
                  <span className="block text-[6.5px] text-zinc-400">PASSAGEIRO</span>
                  <span className="text-xs font-black text-white tabular-nums">
                    {passengerTempC.toFixed(1)}°C
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPassengerOffsetC((v) => clamp(v + 0.5, -4, 4))}
                  className="h-5 w-5 rounded bg-zinc-800 text-xs font-black text-red-400 active:scale-90 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Ventilação e funções reais */}
            <div className="flex items-center justify-between gap-1 rounded-lg border border-white/10 bg-black/50 px-1.5 py-1 text-[7.5px]">
              <div className="flex items-center gap-0.5">
                {([0, 1, 2, 3, 4, 5] as FanLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setClimateFanLevel(lvl)}
                    className={`h-5 w-4 rounded text-[7.5px] font-black cursor-pointer ${
                      climateFanLevel === lvl
                        ? 'bg-red-600 text-white'
                        : 'bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSeatHeatLevel((prev) => ((prev + 1) % 4) as 0 | 1 | 2 | 3)}
                className={`rounded border px-1.5 py-0.5 text-[7.5px] font-black cursor-pointer ${
                  seatHeatLevel > 0
                    ? 'border-orange-400 bg-orange-500/25 text-orange-200'
                    : 'border-white/10 bg-zinc-900 text-zinc-400'
                }`}
              >
                🔥 BANCO {seatHeatLevel > 0 ? `${seatHeatLevel}/3` : 'OFF'}
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1 text-[7.5px] font-black">
              <button
                type="button"
                onClick={toggleClimateAc}
                className={`rounded border py-1 cursor-pointer ${
                  climateAcEnabled
                    ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border-white/10 bg-zinc-900 text-zinc-400'
                }`}
              >
                A/C{isCompressorEngaged ? ' ●' : ''}
              </button>
              <button
                type="button"
                onClick={toggleClimateAutoMode}
                className={`rounded border py-1 cursor-pointer ${
                  climateAutoMode
                    ? 'border-red-400 bg-red-600/25 text-red-200'
                    : 'border-white/10 bg-zinc-900 text-zinc-400'
                }`}
              >
                AUTO
              </button>
              <button
                type="button"
                onClick={toggleClimateRecirculation}
                className={`rounded border py-1 cursor-pointer ${
                  climateRecirculation
                    ? 'border-emerald-400 bg-emerald-600/25 text-emerald-200'
                    : 'border-white/10 bg-zinc-900 text-zinc-400'
                }`}
              >
                RECIRC
              </button>
              <button
                type="button"
                onClick={toggleClimateDefroster}
                className={`rounded border py-1 cursor-pointer ${
                  climateDefrosterEnabled
                    ? 'border-amber-400 bg-amber-600/25 text-amber-200'
                    : 'border-white/10 bg-zinc-900 text-zinc-400'
                }`}
              >
                MAX 💨
              </button>
            </div>
          </div>
        )}

        {activeTab === 'media' && <InternetMediaCenter theme="gti" compact={fill} />}

        {activeTab === 'car' && (
          <div className="my-auto flex w-full flex-col gap-1.5 text-[8px]">
            <div className="grid grid-cols-3 gap-1">
              {(['eco', 'normal', 'sport'] as DrivingMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDrivingMode(mode)}
                  className={`rounded-lg border py-1 font-black uppercase cursor-pointer ${
                    drivingMode === mode
                      ? 'border-red-500 bg-red-600/25 text-white'
                      : 'border-white/10 bg-zinc-900 text-zinc-400'
                  }`}
                >
                  {mode === 'sport' ? 'SPORT GLI' : mode.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/80 px-2 py-1">
              <span className="text-zinc-400">LUZ AMBIENTE</span>
              <div className="flex items-center gap-1">
                {(['red', 'cyan', 'white', 'amber'] as AmbientLightColor[]).map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setAmbientLightColor(col)}
                    className={`h-4 w-4 rounded-full border cursor-pointer ${
                      ambientLightColor === col ? 'scale-110 border-white' : 'border-white/20 opacity-70'
                    }`}
                    style={{ backgroundColor: AMBIENT_COLOR_MAP[col].hex }}
                    title={col}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/60 px-2 py-1">
              <span className="truncate text-zinc-300">
                📍 {zoneName || 'Setor Urbano'} · <b className="text-red-300 uppercase">{surfaceType}</b>
              </span>
              <button
                type="button"
                onClick={toggleMap}
                className="rounded border border-red-500/40 bg-red-600/20 px-2 py-0.5 text-[7.5px] font-black text-red-200 cursor-pointer"
              >
                MAPA 2D
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Teclas inferiores MIB 8" */}
      <div className="mt-1 grid shrink-0 grid-cols-4 gap-1 border-t border-white/10 pt-1 text-[7.5px] font-black">
        {(
          [
            { id: 'perf', label: 'PERF GLI' },
            { id: 'clima', label: 'CLIMA' },
            { id: 'media', label: 'MEDIA' },
            { id: 'car', label: 'CAR / MODE' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`rounded-md border py-1 transition-all cursor-pointer ${
              activeTab === item.id
                ? 'border-red-500 bg-red-600/25 text-white'
                : 'border-white/10 bg-zinc-900/90 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
})
