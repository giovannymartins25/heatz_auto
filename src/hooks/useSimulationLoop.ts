import { useEffect, useRef, useCallback } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

/**
 * useSimulationLoop — Game loop principal do simulador.
 *
 * Usa requestAnimationFrame para chamar a store.update() a cada frame.
 * O fixed timestep é gerenciado internamente pela store (acumulador).
 *
 * Este hook é leve: ele apenas mede o deltaTime e repassa para a store.
 * Toda a física roda dentro do store, não no componente React.
 */
export function useSimulationLoop() {
  const lastTimeRef = useRef<number>(0)
  const rafRef = useRef<number>(0)
  const update = useSimulationStore((s) => s.update)
  const isInitialized = useSimulationStore((s) => s._isInitialized)

  const loop = useCallback(
    (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp
      }

      // DeltaTime em segundos, capped a 100ms para evitar saltos
      const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1)
      lastTimeRef.current = timestamp

      update(deltaTime)

      rafRef.current = requestAnimationFrame(loop)
    },
    [update],
  )

  useEffect(() => {
    if (isInitialized) {
      lastTimeRef.current = 0
      rafRef.current = requestAnimationFrame(loop)
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [isInitialized, loop])
}
