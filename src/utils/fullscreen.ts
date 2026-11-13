/**
 * Utilitário de Modo Imersivo / Fullscreen para PWA e Navegadores Mobile.
 *
 * Suporta o W3C Fullscreen API com fallback para prefixos de fornecedores (WebKit/Blink/Gecko)
 * e a opção { navigationUI: 'hide' } para ocultar as barras de navegação do sistema Android.
 */

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(
    document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled,
  )
}

export function isDocumentFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(
    document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement,
  )
}

export function isStandaloneOrFullscreenApp(): boolean {
  if (typeof window === 'undefined') return false
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as any).standalone === true
  return isStandalone
}

/**
 * Solicita tela cheia no elemento raiz com opção navigationUI: 'hide' (Android immersive).
 * Deve ser chamado a partir de um gesto do usuário (clique, toque ou troca de tela).
 */
export async function requestAppFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false
  if (isDocumentFullscreen()) return true

  const elem = document.documentElement as any

  try {
    if (elem.requestFullscreen) {
      // navigationUI: 'hide' solicita explicitamente que a barra inferior do Android seja ocultada
      await elem.requestFullscreen({ navigationUI: 'hide' } as any)
      return true
    } else if (elem.webkitRequestFullscreen) {
      await elem.webkitRequestFullscreen()
      return true
    } else if (elem.mozRequestFullScreen) {
      await elem.mozRequestFullScreen()
      return true
    } else if (elem.msRequestFullscreen) {
      await elem.msRequestFullscreen()
      return true
    }
  } catch (err) {
    // Ignora silenciosamente se o navegador rejeitar (ex.: sem interação do usuário ainda)
    console.debug('[Fullscreen] Rejeitado ou não suportado:', err)
  }

  return false
}

export async function exitAppFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false
  if (!isDocumentFullscreen()) return true

  const doc = document as any

  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen()
      return true
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen()
      return true
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen()
      return true
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen()
      return true
    }
  } catch (err) {
    console.debug('[Fullscreen] Erro ao sair de tela cheia:', err)
  }

  return false
}

export async function toggleAppFullscreen(): Promise<boolean> {
  if (isDocumentFullscreen()) {
    await exitAppFullscreen()
    return false
  }
  return await requestAppFullscreen()
}

/**
 * Registra listener para mudanças no estado de fullscreen.
 */
export function onFullscreenChange(listener: (isFullscreen: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {}

  const handler = () => {
    listener(isDocumentFullscreen())
  }

  document.addEventListener('fullscreenchange', handler)
  document.addEventListener('webkitfullscreenchange', handler)
  document.addEventListener('mozfullscreenchange', handler)
  document.addEventListener('MSFullscreenChange', handler)

  return () => {
    document.removeEventListener('fullscreenchange', handler)
    document.removeEventListener('webkitfullscreenchange', handler)
    document.removeEventListener('mozfullscreenchange', handler)
    document.removeEventListener('MSFullscreenChange', handler)
  }
}
