import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useVehicleStore } from '@/stores/useVehicleStore'
import { VehicleDashboard } from '@/components/dashboard'

export function SimulatorScreen() {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle)
  const selectVehicle = useVehicleStore((s) => s.selectVehicle)
  const clearSelection = useVehicleStore((s) => s.clearSelection)
  const isLoading = useVehicleStore((s) => s.isLoading)
  const error = useVehicleStore((s) => s.error)

  useEffect(() => {
    if (vehicleId) {
      selectVehicle(vehicleId)
    }

    return () => {
      clearSelection()
    }
  }, [vehicleId, selectVehicle, clearSelection])

  // Estado de Carregamento Premium
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-[var(--color-bg-primary)] p-6">
        <div className="relative w-16 h-16 mb-4">
          {/* Anel giratório */}
          <div className="absolute inset-0 rounded-full border-4 border-zinc-800 border-t-[var(--color-accent)] animate-spin" />
        </div>
        <p className="text-[var(--color-text-secondary)] font-mono text-xs tracking-widest uppercase animate-pulse">
          Sincronizando Motor...
        </p>
      </div>
    )
  }

  // Estado de Erro
  if (error || !selectedVehicle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-[var(--color-bg-primary)] p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500 text-2xl font-bold mb-4">
          !
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Erro de Calibração</h2>
        <p className="text-xs text-[var(--color-text-muted)] max-w-xs mb-8">
          {error || 'Não foi possível carregar as especificações do motor.'}
        </p>
        <Link
          to="/"
          className="px-5 py-2.5 rounded-[var(--radius-sm)] border border-white/10 bg-white/5 text-[var(--color-text-secondary)] font-bold text-xs uppercase hover:border-[var(--color-accent)] hover:text-white transition-all active:scale-95"
        >
          Voltar para Garagem
        </Link>
      </div>
    )
  }

  // Renderiza o painel completo integrado
  return <VehicleDashboard vehicle={selectedVehicle} />
}
