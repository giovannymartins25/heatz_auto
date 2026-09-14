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

  // 3. Layout Clássico Popular (Gol G6) e Default
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
