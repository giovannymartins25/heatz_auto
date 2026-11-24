import { memo, useState } from 'react'
import type { VehicleConfig } from '@/types/vehicle'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { resolveVehicleCabin } from '@/systems/vehicle/vehicleResolvers'
import { clamp } from '@/utils/math'
import type { FanLevel } from '@/systems/cabin'

export interface ClimateControlProps {
  vehicle?: VehicleConfig
  theme?: 'gti' | 'porsche' | 'toyota' | 'honda'
  compact?: boolean
}

/**
 * ClimateControlPanel — Interface integrada de Ar-Condicionado na Central Multimídia (Fase 4.4.2).
 *
 * Conectado diretamente ao `ClimateSystem` único em `useSimulationStore` (zero estado duplicado):
 * - Temperatura alvo real (`climateTargetTempC`), temperatura interna (`cabinTempC`) e externa (`ambientTempC`)
 * - Nível de ventilação real (`0` a `5`)
 * - Compressor A/C, modo AUTO, Recirculação, Aquecimento e Desembaçador respeitando `VehicleCabinSpec`
 */
export const ClimateControlPanel = memo(function ClimateControlPanel({
  vehicle,
  theme = 'gti',
  compact = false,
}: ClimateControlProps) {
  const storeConfig = useSimulationStore((s) => s._config)
  const effectiveVehicle = vehicle ?? storeConfig ?? undefined
  const cabinSpec = effectiveVehicle ? resolveVehicleCabin(effectiveVehicle) : null

  const ambientTempC = useSimulationStore((s) => s.ambientTempC)
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
  const setClimateTargetTempC = useSimulationStore((s) => s.setClimateTargetTempC)
  const setClimateFanLevel = useSimulationStore((s) => s.setClimateFanLevel)
  const toggleClimateAutoMode = useSimulationStore((s) => s.toggleClimateAutoMode)
  const toggleClimateRecirculation = useSimulationStore((s) => s.toggleClimateRecirculation)
  const toggleClimateHeater = useSimulationStore((s) => s.toggleClimateHeater)
  const toggleClimateDefroster = useSimulationStore((s) => s.toggleClimateDefroster)

  // Offset visual apenas para a zona do passageiro em veículos Dual-Zone
  const [passOffsetC, setPassOffsetC] = useState(0.5)
  const [isSync, setIsSync] = useState(false)

  const isDualZone =
    !cabinSpec || cabinSpec.climateType === 'auto_dual' || cabinSpec.climateType === 'auto_tri'
  const hasAutoClimate =
    !cabinSpec ||
    cabinSpec.climateType === 'auto_single' ||
    cabinSpec.climateType === 'auto_dual' ||
    cabinSpec.climateType === 'auto_tri'
  const hasAcCompressor = cabinSpec ? cabinSpec.hasAcCompressor : true
  const hasRecirculation = cabinSpec ? cabinSpec.hasRecirculation : true
  const hasHeater = cabinSpec ? cabinSpec.hasHeater : true
  const hasDefroster = cabinSpec ? cabinSpec.hasDefroster : true
  const hasSeatHeating = Boolean(cabinSpec?.hasSeatHeating)

  const passTemp = isSync ? climateTargetTempC : clamp(climateTargetTempC + passOffsetC, 16.0, 30.0)
  const isMaxAc = hasAcCompressor && climateAcEnabled && climateFanLevel === 5 && climateTargetTempC <= 16.5

  const handleMaxAc = () => {
    if (!hasAcCompressor) return
    if (!isMaxAc) {
      if (!climateAcEnabled) toggleClimateAc()
      setClimateTargetTempC(16.0)
      setClimateFanLevel(5)
    } else {
      setClimateTargetTempC(21.5)
      setClimateFanLevel(2)
    }
  }

  const themeBgActive =
    theme === 'porsche'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
      : theme === 'toyota'
        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
        : theme === 'honda'
          ? 'bg-red-500/25 text-red-300 border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
          : 'bg-red-600/20 text-red-400 border-red-500/50'

  return (
    <div
      className={`w-full flex flex-col items-center select-none font-mono ${compact ? 'gap-0.5 my-auto' : 'gap-1.5 my-auto'}`}
      data-testid="multimedia-climate-panel"
    >
      {/* ── Status Real do Ar-Condicionado e Cabine ── */}
      <div className="w-full flex items-center justify-between px-1 text-[7.5px] sm:text-[9px] border-b border-white/10 pb-0.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
              climateAcEnabled && hasAcCompressor
                ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse'
                : climateFanLevel > 0
                  ? 'bg-amber-400'
                  : 'bg-zinc-600'
            }`}
          />
          <span className="font-bold text-zinc-300">
            {isMaxAc
              ? '❄️ A/C MAX'
              : climateAcEnabled && hasAcCompressor
                ? `❄️ A/C${isCompressorEngaged ? ' ●' : ''}`
                : climateFanLevel > 0
                  ? '💨 VENTILAÇÃO'
                  : 'CLIMA OFF'}
          </span>
        </div>
        <span className="text-[6.5px] sm:text-[7.5px] text-zinc-400">
          Ext <b>{ambientTempC.toFixed(0)}°</b> · Cab{' '}
          <b className="text-cyan-300" data-testid="multimedia-cabin-temp">
            {cabinTempC.toFixed(1)}°C
          </b>
          {hasSeatHeating && <span className="ml-1 text-orange-300">· 🔥 BANCOS</span>}
        </span>
      </div>

      {/* ── Seletor de Temperatura e Ventilação (0..5) ── */}
      <div className="w-full flex items-center justify-around py-0.5">
        {/* Motorista / Zona Principal */}
        <div className="flex flex-col items-center">
          <span className="text-[6.5px] sm:text-[7px] text-zinc-400 font-bold uppercase mb-0.5">
            {isDualZone ? 'MOTORISTA' : 'TEMPERATURA'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="multimedia-btn-temp-down"
              onClick={() => stepClimateTargetTempC(-0.5)}
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-zinc-900 border border-white/10 active:bg-sky-500/20 active:border-sky-400 text-sky-400 font-black text-xs flex items-center justify-center cursor-pointer transition-transform active:scale-90"
              title="Diminuir Temperatura"
            >
              -
            </button>
            <div className="flex flex-col items-center justify-center w-11 h-7 sm:w-14 sm:h-9 rounded-xl bg-black/80 border border-white/10">
              <span
                className="text-sm sm:text-lg font-black text-white leading-none tabular-nums"
                data-testid="multimedia-target-temp"
              >
                {climateTargetTempC.toFixed(1)}
              </span>
              <span className="text-[5.5px] sm:text-[6px] font-bold text-zinc-400">
                °C {isDualZone ? 'DUAL' : 'DIGITAL'}
              </span>
            </div>
            <button
              type="button"
              data-testid="multimedia-btn-temp-up"
              onClick={() => stepClimateTargetTempC(0.5)}
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-zinc-900 border border-white/10 active:bg-red-500/20 active:border-red-400 text-red-400 font-black text-xs flex items-center justify-center cursor-pointer transition-transform active:scale-90"
              title="Aumentar Temperatura"
            >
              +
            </button>
          </div>
        </div>

        {/* Central: Velocidade Real do Ventilador (0..5) */}
        <div className="flex flex-col items-center px-1">
          <span className="text-[6.5px] sm:text-[7px] text-zinc-400 font-bold uppercase mb-0.5">VENTILADOR</span>
          <div className="flex items-center gap-0.5 mb-0.5">
            {([0, 1, 2, 3, 4, 5] as FanLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                data-testid={`multimedia-btn-fan-${lvl}`}
                onClick={() => setClimateFanLevel(lvl)}
                className={`w-3.5 sm:w-4 h-5 sm:h-6 rounded text-[7px] font-black transition-all cursor-pointer ${
                  climateFanLevel === lvl
                    ? climateAcEnabled
                      ? 'bg-sky-400 text-black shadow-[0_0_6px_rgba(56,189,248,0.7)]'
                      : 'bg-amber-400 text-black'
                    : lvl > 0 && lvl <= climateFanLevel
                      ? 'bg-sky-500/30 text-sky-200'
                      : 'bg-zinc-800 text-zinc-400'
                }`}
                title={`Velocidade ${lvl}`}
              >
                {lvl}
              </button>
            ))}
          </div>
          <span className="text-[6.5px] sm:text-[7px] font-bold text-zinc-400">
            NÍVEL {climateFanLevel}/5
          </span>
        </div>

        {/* Lado Direito: Passageiro (somente Dual-Zone) */}
        {isDualZone && (
          <div className="flex flex-col items-center">
            <span className="text-[6.5px] sm:text-[7px] text-zinc-400 font-bold uppercase mb-0.5">PASSAGEIRO</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPassOffsetC((v) => clamp(v - 0.5, -4, 4))}
                disabled={isSync}
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-zinc-900 border border-white/10 text-sky-400 font-black text-xs flex items-center justify-center cursor-pointer transition-transform active:scale-90 ${
                  isSync ? 'opacity-40 cursor-not-allowed' : 'active:bg-sky-500/20 active:border-sky-400'
                }`}
                title="Diminuir Temperatura Passageiro"
              >
                -
              </button>
              <div className="flex flex-col items-center justify-center w-11 h-7 sm:w-14 sm:h-9 rounded-xl bg-black/80 border border-white/10">
                <span className="text-sm sm:text-lg font-black text-white leading-none tabular-nums">
                  {passTemp.toFixed(1)}
                </span>
                <span className="text-[5.5px] sm:text-[6px] font-bold text-zinc-400">°C DUAL</span>
              </div>
              <button
                type="button"
                onClick={() => setPassOffsetC((v) => clamp(v + 0.5, -4, 4))}
                disabled={isSync}
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-zinc-900 border border-white/10 text-red-400 font-black text-xs flex items-center justify-center cursor-pointer transition-transform active:scale-90 ${
                  isSync ? 'opacity-40 cursor-not-allowed' : 'active:bg-red-500/20 active:border-red-400'
                }`}
                title="Aumentar Temperatura Passageiro"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Botões Reais de Funções conforme VehicleCabinSpec ── */}
      <div className="w-full flex flex-wrap items-center justify-center gap-1 text-[7.5px] sm:text-[8px] font-bold pt-0.5 border-t border-white/10">
        {hasAcCompressor && (
          <button
            type="button"
            data-testid="multimedia-btn-ac"
            onClick={toggleClimateAc}
            className={`px-2 py-0.5 sm:py-1 rounded-lg border transition-all cursor-pointer ${
              climateAcEnabled
                ? 'bg-sky-500/20 text-sky-300 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                : 'bg-zinc-900 text-zinc-500 border-white/10'
            }`}
          >
            A/C {climateAcEnabled ? 'ON' : 'OFF'}
          </button>
        )}

        {hasAcCompressor && (
          <button
            type="button"
            onClick={handleMaxAc}
            className={`px-2 py-0.5 sm:py-1 rounded-lg border transition-all cursor-pointer ${
              isMaxAc
                ? 'bg-sky-600 text-white border-sky-300'
                : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
            }`}
          >
            AC MAX
          </button>
        )}

        {hasAutoClimate && (
          <button
            type="button"
            data-testid="multimedia-btn-auto"
            onClick={toggleClimateAutoMode}
            className={`px-2 py-0.5 sm:py-1 rounded-lg border transition-all cursor-pointer ${
              climateAutoMode ? themeBgActive : 'bg-zinc-900 text-zinc-500 border-white/10'
            }`}
          >
            AUTO
          </button>
        )}

        {hasRecirculation && (
          <button
            type="button"
            data-testid="multimedia-btn-recirc"
            onClick={toggleClimateRecirculation}
            className={`px-2 py-0.5 sm:py-1 rounded-lg border transition-all cursor-pointer ${
              climateRecirculation
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-zinc-900 text-zinc-500 border-white/10'
            }`}
          >
            RECIRC
          </button>
        )}

        {hasHeater && (
          <button
            type="button"
            data-testid="multimedia-btn-heater"
            onClick={toggleClimateHeater}
            className={`px-2 py-0.5 sm:py-1 rounded-lg border transition-all cursor-pointer ${
              climateHeaterEnabled
                ? 'bg-orange-500/25 text-orange-200 border-orange-400'
                : 'bg-zinc-900 text-zinc-500 border-white/10'
            }`}
          >
            AQUEC
          </button>
        )}

        {hasDefroster && (
          <button
            type="button"
            data-testid="multimedia-btn-defrost"
            onClick={toggleClimateDefroster}
            className={`px-2 py-0.5 sm:py-1 rounded-lg border transition-all cursor-pointer ${
              climateDefrosterEnabled
                ? 'bg-amber-500/25 text-amber-200 border-amber-400'
                : 'bg-zinc-900 text-zinc-500 border-white/10'
            }`}
          >
            DESEMB
          </button>
        )}

        {isDualZone && (
          <button
            type="button"
            onClick={() => {
              const nextSync = !isSync
              setIsSync(nextSync)
              if (nextSync) setPassOffsetC(0)
            }}
            className={`px-2 py-0.5 sm:py-1 rounded-lg border transition-all cursor-pointer ${
              isSync ? themeBgActive : 'bg-zinc-900 text-zinc-500 border-white/10'
            }`}
          >
            SYNC
          </button>
        )}
      </div>
    </div>
  )
})
