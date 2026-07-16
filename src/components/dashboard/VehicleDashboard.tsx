import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useSimulationLoop } from '@/hooks/useSimulationLoop'
import { useAudio } from '@/hooks/useAudio'
import { Tachometer, Speedometer, GearIndicator, DigitalDisplay } from '@/components/gauges'
import { Pedals, GearShift, EngineButton } from '@/components/controls'
import type { VehicleConfig } from '@/types'

interface VehicleDashboardProps {
  vehicle: VehicleConfig
}

export function VehicleDashboard({ vehicle }: VehicleDashboardProps) {
  const navigate = useNavigate()
  const init = useSimulationStore((s) => s.init)
  const reset = useSimulationStore((s) => s.reset)

  // Estados em tempo real da store
  const rpm = useSimulationStore((s) => s.rpm)
  const speed = useSimulationStore((s) => s.speed)
  const currentGear = useSimulationStore((s) => s.currentGear)
  const isRevLimiting = useSimulationStore((s) => s.isRevLimiting)

  // Inicializar a física com as especificações do veículo
  useEffect(() => {
    init(vehicle)
    return () => {
      reset()
    }
  }, [vehicle, init, reset])

  // Disparar loop de física
  useSimulationLoop()

  // Conectar sistema de som (SynthEngine)
  useAudio(vehicle)

  const handleBack = () => {
    reset()
    navigate('/')
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--color-bg-primary)] safe-top safe-bottom p-4 justify-between select-none">
      {/* Barra de cabeçalho superior */}
      <header className="flex justify-between items-center w-full mb-2">
        <button
          onClick={handleBack}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-[var(--radius-sm)] border border-white/10 bg-white/5 text-[var(--color-text-secondary)] hover:border-red-500/50 hover:text-white transition-all active:scale-95 cursor-pointer"
        >
          ← Voltar
        </button>
        <div className="text-right">
          <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--color-text-muted)] block">
            {vehicle.info.brand}
          </span>
          <h2 className="text-sm font-bold text-white tracking-tight">{vehicle.info.name}</h2>
        </div>
      </header>

      {/* Seção Central: Painel de Instrumentos (Gauges) */}
      <main className="flex flex-col items-center gap-6 my-auto">
        <div className="flex items-center justify-center gap-4 w-full flex-wrap">
          {/* Conta-giros principal */}
          <Tachometer
            rpm={rpm}
            maxRpm={vehicle.engine.maxRpm}
            redlineStart={vehicle.dashboard.redlineStart}
            isRevLimiting={isRevLimiting}
          />

          {/* Velocímetro menor e indicador de marcha */}
          <div className="flex flex-col items-center gap-4">
            <Speedometer speed={speed} maxSpeed={vehicle.dashboard.speedometerMax} />
            <GearIndicator gear={currentGear} />
          </div>
        </div>

        {/* Displays digitais numéricos auxiliares */}
        <DigitalDisplay rpm={rpm} speed={speed} isRevLimiting={isRevLimiting} />
      </main>

      {/* Seção Inferior: Controles de Pilotagem */}
      <footer className="w-full flex flex-col items-center gap-6 mt-auto">
        {/* Controles: Start Engine & Gear Shifter */}
        <div className="flex items-center justify-between w-full max-w-sm px-2">
          <EngineButton />
          <GearShift />
        </div>

        {/* Pedais de acelerador e freio */}
        <Pedals />
      </footer>
    </div>
  )
}
