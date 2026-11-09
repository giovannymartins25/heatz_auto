import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'
import {
  Tachometer,
  Speedometer,
  GearIndicator,
  WarningLights,
  AuxGauges,
  DigitalDisplay,
} from '@/components/gauges'

interface ClusterViewProps {
  telemetry: DashboardTelemetry
}

/**
 * ClusterView — Componente modular de painel de instrumentos (Instrument Cluster).
 *
 * Renderiza layouts especializados e dinâmicos de acordo com o DashboardTheme do veículo:
 * - 'classic': Gol G6 — mostrador analógico duplo clássico com molduras e display central.
 * - 'modern': Toyota Yaris — cluster elegante com iluminação ciano/azul e visor TFT central.
 * - 'motorcycle': Honda CB1000R — cockpit esportivo horizontal digital com tacômetro de alto giro.
 */
export const ClusterView = memo(function ClusterView({ telemetry }: ClusterViewProps) {
  const {
    tachometer,
    shiftLight,
    speedometer,
    gear,
    engine,
    warningLights,
    auxGauges,
    theme,
  } = telemetry

  // 1. Layout Específico de Motocicleta (CB1000R)
  if (theme === 'motorcycle') {
    return (
      <div className="flex flex-col items-center w-full max-w-xl p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-2xl backdrop-blur-md">
        {/* Faixa superior de luzes de alerta e shift light */}
        <div className="flex items-center justify-between w-full px-2 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            CB1000R TFT SPORT
          </span>
          <WarningLights lights={warningLights} />
        </div>

        {/* Mostradores principais lado a lado ou integrados */}
        <div className="flex items-center justify-center gap-3 sm:gap-6 w-full flex-wrap">
          <Tachometer
            rpm={tachometer.rpm}
            maxRpm={tachometer.maxRpm}
            redlineStart={tachometer.redlineStart}
            shiftLightActive={shiftLight.isActive}
            shiftLightBlink={shiftLight.isBlinking}
            theme={theme}
          />

          <div className="flex flex-col items-center gap-2">
            <GearIndicator
              gear={gear.label === 'N' ? 0 : gear.label === 'R' ? -1 : parseInt(gear.label, 10) || 0}
              transmissionMode={gear.transmissionMode}
              drivingMode={gear.drivingMode}
              isKickdown={gear.isKickdown}
              engineStatus={engine.status}
            />
            <Speedometer
              speed={speedometer.speed}
              maxSpeed={speedometer.maxSpeed}
              theme={theme}
            />
          </div>
        </div>

        {/* Indicadores auxiliares inferiores */}
        <AuxGauges
          fuelLevel={auxGauges.fuelLevel}
          fuelCapacity={auxGauges.fuelCapacity}
          fuelPercent={auxGauges.fuelPercent}
          coolantTemp={auxGauges.coolantTemp}
          tempTarget={auxGauges.tempTarget}
          isTempOptimal={auxGauges.isTempOptimal}
        />
      </div>
    )
  }

  // 2. Layout Moderno (Toyota Yaris 2019)
  if (theme === 'modern') {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl p-3 sm:p-4 rounded-3xl bg-zinc-950/80 border border-sky-500/20 shadow-[0_0_30px_rgba(56,189,248,0.06)] backdrop-blur-md">
        {/* Luzes de alerta no topo */}
        <div className="flex justify-center w-full mb-3">
          <WarningLights lights={warningLights} />
        </div>

        {/* Instrumentos duplos com display TFT central */}
        <div className="flex items-center justify-center gap-3 sm:gap-6 w-full flex-wrap">
          {/* Tacômetro */}
          <Tachometer
            rpm={tachometer.rpm}
            maxRpm={tachometer.maxRpm}
            redlineStart={tachometer.redlineStart}
            shiftLightActive={shiftLight.isActive}
            shiftLightBlink={shiftLight.isBlinking}
            theme={theme}
          />

          {/* Display TFT Central */}
          <div className="flex flex-col items-center gap-3">
            <GearIndicator
              gear={
                gear.isNeutral
                  ? 0
                  : gear.isReverse
                  ? -1
                  : parseInt(gear.label.replace(/^[DM]/, ''), 10) || 1
              }
              transmissionMode={gear.transmissionMode}
              drivingMode={gear.drivingMode}
              isKickdown={gear.isKickdown}
              engineStatus={engine.status}
            />
            <Speedometer
              speed={speedometer.speed}
              maxSpeed={speedometer.maxSpeed}
              theme={theme}
            />
          </div>
        </div>

        {/* Marcadores de Combustível e Temperatura */}
        <div className="mt-2 w-full flex justify-center">
          <AuxGauges
            fuelLevel={auxGauges.fuelLevel}
            fuelCapacity={auxGauges.fuelCapacity}
            fuelPercent={auxGauges.fuelPercent}
            coolantTemp={auxGauges.coolantTemp}
            tempTarget={auxGauges.tempTarget}
            isTempOptimal={auxGauges.isTempOptimal}
          />
        </div>
      </div>
    )
  }

  // 3. Layout Supercarro / Track (Porsche 911 GT3 RS)
  if (theme === 'supercar') {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl p-3 sm:p-5 rounded-3xl bg-zinc-950/90 border border-amber-500/25 shadow-[0_0_40px_rgba(245,158,11,0.08)] backdrop-blur-md">
        {/* Faixa Superior: Shift Lights Sequenciais e Avisos */}
        <div className="flex items-center justify-between w-full px-3 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            GT3 RS · TRACK DISPLAY
          </span>
          <WarningLights lights={warningLights} />
        </div>

        {/* Barra de LEDs de Giro Sequenciais F1/GT3 */}
        <div className="flex items-center justify-center gap-1.5 w-full max-w-md py-1.5 mb-3 bg-zinc-900/90 rounded-full border border-white/10 px-3">
          {[...Array(14)].map((_, idx) => {
            const stepPercent = (idx + 1) / 14
            const currentRpmRatio = tachometer.rpm / tachometer.maxRpm
            const isActive = currentRpmRatio >= stepPercent * 0.94
            const isRedline = idx >= 10
            const isYellow = idx >= 6 && idx < 10

            return (
              <div
                key={idx}
                className={`h-2.5 flex-1 rounded-sm transition-all duration-75 ${
                  shiftLight.isBlinking
                    ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] animate-pulse'
                    : isActive
                    ? isRedline
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                      : isYellow
                      ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                      : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                    : 'bg-zinc-800/80'
                }`}
              />
            )
          })}
        </div>

        {/* Mostradores principais */}
        <div className="flex items-center justify-center gap-3 sm:gap-6 w-full flex-wrap">
          <Tachometer
            rpm={tachometer.rpm}
            maxRpm={tachometer.maxRpm}
            redlineStart={tachometer.redlineStart}
            shiftLightActive={shiftLight.isActive}
            shiftLightBlink={shiftLight.isBlinking}
            theme={theme}
          />

          <div className="flex flex-col items-center gap-3">
            <GearIndicator
              gear={
                gear.isNeutral
                  ? 0
                  : gear.isReverse
                  ? -1
                  : parseInt(gear.label.replace(/^[DM]/, ''), 10) || 1
              }
              transmissionMode={gear.transmissionMode}
              drivingMode={gear.drivingMode}
              isKickdown={gear.isKickdown}
              engineStatus={engine.status}
            />
            <Speedometer
              speed={speedometer.speed}
              maxSpeed={speedometer.maxSpeed}
              theme={theme}
            />
          </div>
        </div>

        {/* Marcadores de Combustível e Temperatura */}
        <div className="mt-3 w-full flex justify-center">
          <AuxGauges
            fuelLevel={auxGauges.fuelLevel}
            fuelCapacity={auxGauges.fuelCapacity}
            fuelPercent={auxGauges.fuelPercent}
            coolantTemp={auxGauges.coolantTemp}
            tempTarget={auxGauges.tempTarget}
            isTempOptimal={auxGauges.isTempOptimal}
          />
        </div>
      </div>
    )
  }

  // 4. Layout Clássico Popular (Gol G6) e Default
  return (
    <div className="flex flex-col items-center w-full max-w-2xl p-3 sm:p-4 rounded-3xl bg-zinc-950/90 border border-zinc-700/50 shadow-2xl backdrop-blur-md">
      {/* Luzes de alerta */}
      <div className="flex justify-center w-full mb-3">
        <WarningLights lights={warningLights} />
      </div>

      {/* Conjunto duplo de mostradores com computador de bordo central */}
      <div className="flex items-center justify-center gap-3 sm:gap-6 w-full flex-wrap">
        <Tachometer
          rpm={tachometer.rpm}
          maxRpm={tachometer.maxRpm}
          redlineStart={tachometer.redlineStart}
          shiftLightActive={shiftLight.isActive}
          shiftLightBlink={shiftLight.isBlinking}
          theme={theme}
        />

        <div className="flex flex-col items-center gap-3">
          <GearIndicator
            gear={
              gear.isNeutral
                ? 0
                : gear.isReverse
                ? -1
                : parseInt(gear.label, 10) || 0
            }
            transmissionMode={gear.transmissionMode}
            drivingMode={gear.drivingMode}
            isKickdown={gear.isKickdown}
            engineStatus={engine.status}
          />
          <Speedometer
            speed={speedometer.speed}
            maxSpeed={speedometer.maxSpeed}
            theme={theme}
          />
        </div>
      </div>

      {/* Computador de bordo digital auxiliar + AuxGauges */}
      <div className="flex flex-col items-center gap-2 mt-3 w-full">
        <AuxGauges
          fuelLevel={auxGauges.fuelLevel}
          fuelCapacity={auxGauges.fuelCapacity}
          fuelPercent={auxGauges.fuelPercent}
          coolantTemp={auxGauges.coolantTemp}
          tempTarget={auxGauges.tempTarget}
          isTempOptimal={auxGauges.isTempOptimal}
        />
        <DigitalDisplay
          rpm={tachometer.rpm}
          speed={speedometer.speed}
          isRevLimiting={shiftLight.isBlinking}
        />
      </div>
    </div>
  )
})
