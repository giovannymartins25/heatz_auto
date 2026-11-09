import { useEffect, useState, useMemo } from 'react'
import { useVehicleStore } from '@/stores/useVehicleStore'
import { SearchBar, CategoryFilter, VehicleCard } from '@/components/ui'
import type { FilterOption } from '@/components/ui'

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.8.0'
const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'

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
    <div className="flex flex-col min-h-dvh safe-top safe-bottom bg-[var(--color-bg-primary)]">
      {/* ─── Header Principal ─── */}
      <header className="flex flex-col items-center pt-8 sm:pt-14 pb-6 px-4 sm:px-6 w-full max-w-7xl mx-auto">
        {/* Badge superior */}
        <div className="flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-zinc-900/80 border border-white/10 text-[10px] font-mono text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>FÍSICA EM TEMPO REAL 120HZ</span>
          <span className="text-zinc-600">|</span>
          <span className="text-[var(--color-accent)] font-bold">PWA READY</span>
        </div>

        {/* Logo Cinematográfico */}
        <div className="relative mb-2 text-center">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter">
            <span className="text-gradient">Heatz</span>
            <span className="text-white"> Auto</span>
          </h1>
          {/* Glow dinâmico atrás do logo */}
          <div
            className="absolute inset-0 blur-3xl opacity-25 -z-10 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, var(--color-accent), transparent 70%)' }}
          />
        </div>

        <p className="text-[var(--color-text-muted)] text-xs sm:text-sm font-mono tracking-[0.25em] uppercase text-center mb-6">
          Simulador Físico de Motores & Cockpit Virtual
        </p>

        {/* Estatísticas da Garagem (Desktop e Mobile) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full max-w-3xl mb-8">
          <div className="flex flex-col items-center p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
            <span className="text-base sm:text-lg font-mono font-black text-white">{vehicleList.length}</span>
            <span className="text-[9px] sm:text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Máquinas</span>
          </div>
          <div className="flex flex-col items-center p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
            <span className="text-base sm:text-lg font-mono font-black text-[var(--color-accent)]">525 HP</span>
            <span className="text-[9px] sm:text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Potência Máx.</span>
          </div>
          <div className="flex flex-col items-center p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
            <span className="text-base sm:text-lg font-mono font-black text-amber-400">9.200</span>
            <span className="text-[9px] sm:text-[10px] font-mono uppercase text-zinc-500 tracking-wider">RPM de Corte</span>
          </div>
          <div className="flex flex-col items-center p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
            <span className="text-base sm:text-lg font-mono font-black text-sky-400">3 Câmbios</span>
            <span className="text-[9px] sm:text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Manual / CVT / PDK</span>
          </div>
        </div>

        {/* Guia Rápido de Teclas (PC / Desktop) */}
        <div className="hidden md:flex items-center justify-center gap-3 p-2.5 px-5 rounded-2xl bg-zinc-950/80 border border-white/10 text-[11px] font-mono text-zinc-400 mb-6 shadow-inner">
          <span className="text-[var(--color-accent)] font-bold uppercase tracking-wider">Controles PC:</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-800 text-white rounded border border-white/10 font-bold">W</kbd> Acelerar</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-800 text-white rounded border border-white/10 font-bold">E</kbd> Frear</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-800 text-white rounded border border-white/10 font-bold">Q</kbd> Embreagem</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-800 text-white rounded border border-white/10 font-bold">[</kbd> / <kbd className="px-1.5 py-0.5 bg-zinc-800 text-white rounded border border-white/10 font-bold">]</kbd> Marchas</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-800 text-white rounded border border-white/10 font-bold">Espaço</kbd> Freio de Mão</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-800 text-white rounded border border-white/10 font-bold">H</kbd> Buzina</span>
        </div>

        {/* Barra de Ações: Busca + Filtros */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-2xl">
          <div className="flex-1 w-full">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <div className="w-full sm:w-auto shrink-0">
            <CategoryFilter active={category} onChange={setCategory} />
          </div>
        </div>
      </header>

      {/* ─── Lista de Veículos (Grid Responsiva) ─── */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-12 w-full max-w-7xl mx-auto">
        {/* Estado de carregamento */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-3 border-zinc-800 border-t-[var(--color-accent)] animate-spin mb-3" />
            <p className="text-xs font-mono text-[var(--color-text-muted)] tracking-wider">
              Carregando garagem...
            </p>
          </div>
        )}

        {/* Estado de erro */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500 text-xl font-bold mb-3">
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
            {/* Contador e Informação */}
            <div className="flex items-center justify-between mb-4 px-1">
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                {filteredVehicles.length} {filteredVehicles.length === 1 ? 'veículo disponível' : 'veículos disponíveis'}
              </p>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs font-mono text-[var(--color-accent)] hover:underline cursor-pointer"
                >
                  Limpar busca
                </button>
              )}
            </div>

            {/* Grid de Cards Responsiva */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
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
                  Tente buscar por outro modelo ou limpe os filtros.
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
      <footer className="flex flex-col items-center py-6 border-t border-[var(--color-border)] gap-1 mt-auto">
        <p className="text-xs font-mono text-[var(--color-text-muted)] tracking-wider">
          Heatz Auto · Simulador Automotivo v{appVersion}
        </p>
        <p className="text-[10px] font-mono text-zinc-600 tracking-tight">
          Build {buildId} · 120Hz Physics Engine
        </p>
      </footer>
    </div>
  )
}
