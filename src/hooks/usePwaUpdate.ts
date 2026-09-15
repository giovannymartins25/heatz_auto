import { useState, useEffect, useCallback } from 'react'
import { registerSW } from 'virtual:pwa-register'

export interface PwaUpdateState {
  needRefresh: boolean
  offlineReady: boolean
  updateServiceWorker: () => void
  appVersion: string
  buildId: string
}

/**
 * usePwaUpdate — Gerencia o ciclo de vida do Service Worker e atualizações do PWA.
 *
 * Garante que:
 * 1. O Service Worker seja registrado com verificação imediata.
 * 2. Ao reabrir o app instalado (visibilitychange), force verificação por atualizações na rede.
 * 3. Notifique o usuário caso uma nova versão esteja pronta ou ativada.
 */
export function usePwaUpdate(): PwaUpdateState {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [updateSWFn, setUpdateSWFn] = useState<(() => Promise<void>) | null>(null)

  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.8.0'
  const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onOfflineReady() {
        setOfflineReady(true)
      },
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          // Checa atualização ao voltar para a aba ou desbloquear o celular
          const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
              registration.update().catch(() => {})
            }
          }
          document.addEventListener('visibilitychange', handleVisibilityChange)

          // Checa a cada 10 minutos em segundo plano se o app permanecer aberto
          const intervalId = setInterval(() => {
            registration.update().catch(() => {})
          }, 10 * 60 * 1000)

          return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            clearInterval(intervalId)
          }
        }
      },
    })

    setUpdateSWFn(() => update)

    // Ao assumir novo controlador (novo SW ativado), recarrega de forma transparente se necessário
    const handleControllerChange = () => {
      // Se não houver jogo ativo no momento, recarregar para aplicar a nova versão imediatamente
      console.log('[Heatz Auto PWA] Novo Service Worker assumiu o controle.')
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  const updateServiceWorker = useCallback(() => {
    if (updateSWFn) {
      updateSWFn()
        .then(() => {
          window.location.reload()
        })
        .catch(() => {
          window.location.reload()
        })
    } else {
      window.location.reload()
    }
  }, [updateSWFn])

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker,
    appVersion,
    buildId,
  }
}
