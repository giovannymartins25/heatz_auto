import { useEffect, useState, useMemo } from 'react'
import { useVehicleStore } from '@/stores/useVehicleStore'
import { SearchBar, CategoryFilter, VehicleCard } from '@/components/ui'
import type { FilterOption } from '@/components/ui'

/**
 * HomeScreen — Tela inicial do Heatz Auto.
 *
 * Carrega a lista de veículos do manifest.json via VehicleLoader,
 * oferece filtro por categoria e busca em tempo real.
 * Layout mobile-first premium com tema dark automotivo.
 */
export function HomeScreen() {
  const vehicleList = useVehicleStore((s) => s.vehicleList)
  const loadVehicleList = useVehicleStore((s) => s.loadVehicleList)
  const isLoading = useVehicleStore((s) => s.isLoading)
  const error = useVehicleStore((s) => s.error)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<FilterOption>('all')

  // Carregar lista de veículos ao montar
  useEffect(() => {
    loadVehicleList()
  }, [loadVehicleList])

  // Filtrar veículos por busca e categoria
  const filteredVehicles = useMemo(() => {
    return vehicleList.filter((v) => {
      // Filtro de categoria
      if (category !== 'all' && v.category !== category) return false

      // Filtro de busca (nome ou marca)
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          v.name.toLowerCase().includes(q) ||
          v.brand.toLowerCase().includes(q) ||
          v.id.toLowerCase().includes(q)
        )
      }

      return true
    })
  }, [vehicleList, search, category])

  return (
    <div className="flex flex-col min-h-dvh safe-top safe-bottom">
      {/* ─── Header ─── */}
      <header className="flex flex-col items-center pt-12 pb-6 px-6">
        {/* Logo */}
        <div className="relative mb-1">
          <h1 className="text-5xl font-black tracking-tighter">
            <span className="text-gradient">Heatz</span>
            <span className="text-white"> Auto</span>
          </h1>
          {/* Glow atrás do logo */}
          <div
            className="absolute inset-0 blur-3xl opacity-20 -z-10"
            style={{ background: 'radial-gradient(ellipse, var(--color-accent), transparent 70%)' }}
          />
        </div>

        <p className="text-[var(--color-text-muted)] text-xs font-mono tracking-[0.2em] uppercase mb-8">
          Simulador de Motores
        </p>

        {/* Busca */}
        <SearchBar value={search} onChange={setSearch} />

        {/* Filtros de categoria */}
        <div className="mt-4 w-full max-w-sm">
          <CategoryFilter active={category} onChange={setCategory} />
        </div>
      </header>

      {/* ─── Lista de Veículos ─── */}
      <main className="flex-1 px-6 pb-8">
        {/* Estado de carregamento */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-[var(--color-accent)] animate-spin mb-3" />
            <p className="text-xs font-mono text-[var(--color-text-muted)] tracking-wider">
              Carregando garagem...
            </p>
          </div>
        )}

        {/* Estado de erro */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500 text-lg font-bold mb-3">
              !
            </div>
            <p className="text-xs text-[var(--color-text-muted)] max-w-xs">{error}</p>
            <button
              onClick={() => loadVehicleList()}
              className="mt-4 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Lista de veículos */}
        {!isLoading && !error && (
          <>
            {/* Contador */}
            <div className="flex items-center justify-between max-w-sm mx-auto mb-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                {filteredVehicles.length} {filteredVehicles.length === 1 ? 'veículo' : 'veículos'}
              </p>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-3 max-w-sm mx-auto">
              {filteredVehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>

            {/* Estado vazio */}
            {filteredVehicles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center border border-[var(--color-border)] text-2xl mb-4">
                  🔍
                </div>
                <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">
                  Nenhum veículo encontrado
                </p>
                <p className="text-xs text-[var(--color-text-muted)] max-w-xs">
                  Tente buscar por outro nome ou limpe os filtros.
                </p>
                <button
                  onClick={() => { setSearch(''); setCategory('all') }}
                  className="mt-4 px-4 py-2 text-xs font-bold rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent-muted)] transition-colors cursor-pointer"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ─── Footer ─── */}
      <footer className="flex flex-col items-center py-6 border-t border-[var(--color-border)]">
        <p className="text-[10px] font-mono text-[var(--color-text-muted)] tracking-wider">
          Heatz Auto v0.2.0 · MVP
        </p>
      </footer>
    </div>
  )
}
