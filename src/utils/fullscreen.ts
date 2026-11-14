/**
 * Utilitário e Gerenciador Centralizado de Modo Imersivo / Fullscreen para PWA e Navegadores Mobile.
 *
 * Suporta a W3C Fullscreen API com fallback para prefixos de fornecedores (WebKit/Blink/Gecko),
 * opção { navigationUI: 'hide' } para ocultar as barras de navegação do sistema Android,
 * detecção de display-mode ('fullscreen' | 'standalone' | 'browser'), deduplicação de requisições
 * simultâneas e ciclo de vida global no root da aplicação.
 */

export type AppDisplayMode = 'fullscreen' | 'standalone' | 'browser'

export interface FullscreenRequestOptions {
  /** Tenta travar orientação landscape após entrar em fullscreen (opcional). */
  lockLandscape?: boolean
}

export interface ImmersiveLifecycleOptions {
  /** Se true, tenta solicitar fullscreen na montagem caso não haja restrição conhecida de userActivation. */
  attemptOnInit?: boolean
  /** Se true, tenta travar orientação landscape quando o fullscreen é ativado. */
  lockLandscapeOnFullscreen?: boolean
}

interface VendorFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
  mozRequestFullScreen?: () => Promise<void> | void
  msRequestFullscreen?: () => Promise<void> | void
}

interface VendorFullscreenDocument extends Document {
  webkitFullscreenEnabled?: boolean
  mozFullScreenEnabled?: boolean
  msFullscreenEnabled?: boolean
  webkitFullscreenElement?: Element | null
  mozFullScreenElement?: Element | null
  msFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
  mozCancelFullScreen?: () => Promise<void> | void
  msExitFullscreen?: () => Promise<void> | void
}

interface NavigatorWithStandalone extends Omit<Navigator, 'userActivation'> {
  standalone?: boolean
  userActivation?: {
    isActive?: boolean
    hasBeenActive?: boolean
  }
}

let inFlightFullscreenRequest: Promise<boolean> | null = null
let userExplicitlyExited = false
let activeLifecycleCleanup: (() => void) | null = null
let internalAutoAttempt = false

function safeMatchMedia(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return Boolean(window.matchMedia(query)?.matches)
  } catch {
    return false
  }
}

async function tryLockLandscapeOrientation(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const orientation = window.screen?.orientation as
      | (ScreenOrientation & { lock?: (orientation: string) => Promise<void> })
      | undefined
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape')
      return true
    }
  } catch {
    // Recusado ou não suportado fora de dispositivos compatíveis
  }
  return false
}

function isFullscreenToggleTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const el = target as { closest?: (selector: string) => Element | null }
  if (typeof el.closest === 'function') {
    return Boolean(el.closest('[data-fullscreen-toggle]'))
  }
  return false
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false
  const doc = document as VendorFullscreenDocument
  const elem = document.documentElement as VendorFullscreenElement | null
  const explicitlyDisabled =
    doc.fullscreenEnabled === false &&
    doc.webkitFullscreenEnabled !== true &&
    doc.mozFullScreenEnabled !== true &&
    doc.msFullscreenEnabled !== true

  if (explicitlyDisabled) return false

  return Boolean(
    doc.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      doc.mozFullScreenEnabled ||
      doc.msFullscreenEnabled ||
      elem?.requestFullscreen ||
      elem?.webkitRequestFullscreen ||
      elem?.mozRequestFullScreen ||
      elem?.msRequestFullscreen,
  )
}

export function isDocumentFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  const doc = document as VendorFullscreenDocument
  return Boolean(
    doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement,
  )
}

/**
 * Detecta o modo de exibição atual do aplicativo instalado/navegado.
 */
export function getAppDisplayMode(): AppDisplayMode {
  if (isDocumentFullscreen() || safeMatchMedia('(display-mode: fullscreen)')) {
    return 'fullscreen'
  }
  const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithStandalone) : undefined
  if (safeMatchMedia('(display-mode: standalone)') || nav?.standalone === true) {
    return 'standalone'
  }
  return 'browser'
}

/**
 * Retorna true se o app já estiver em modo fullscreen (via DOM Fullscreen API ou PWA display-mode: fullscreen).
 */
export function isImmersiveFullscreenActive(): boolean {
  return isDocumentFullscreen() || safeMatchMedia('(display-mode: fullscreen)')
}

export function isStandaloneOrFullscreenApp(): boolean {
  return getAppDisplayMode() !== 'browser'
}

export function hasUserExitedFullscreen(): boolean {
  return userExplicitlyExited
}

/**
 * Solicita tela cheia no elemento raiz com opção { navigationUI: 'hide' } (Android immersive).
 * Deduplica chamadas concorrentes e evita requisições redundantes caso já esteja em fullscreen.
 */
export async function requestAppFullscreen(options: FullscreenRequestOptions = {}): Promise<boolean> {
  if (typeof document === 'undefined') return false

  const isAuto = internalAutoAttempt
  if (isAuto && userExplicitlyExited) return false
  if (!isAuto) {
    userExplicitlyExited = false
  }

  // Já em fullscreen no DOM: não dispara nova requisição na API nativa
  if (isDocumentFullscreen()) {
    if (options.lockLandscape) {
      await tryLockLandscapeOrientation()
    }
    return true
  }

  // Em WebAPK / PWA nativamente fullscreen pelo sistema, não duplica se a API nativa já reflete imersão
  if (isAuto && safeMatchMedia('(display-mode: fullscreen)')) {
    return true
  }

  if (inFlightFullscreenRequest) {
    return inFlightFullscreenRequest
  }

  const elem = document.documentElement as VendorFullscreenElement | null
  if (!elem) return false

  inFlightFullscreenRequest = (async () => {
    try {
      if (typeof elem.requestFullscreen === 'function') {
        try {
          // navigationUI: 'hide' solicita explicitamente que a barra inferior do Android seja ocultada
          await elem.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions)
        } catch (err) {
          // Navegadores mais antigos que não aceitam FullscreenOptions lançam TypeError
          if (err instanceof TypeError) {
            await elem.requestFullscreen()
          } else {
            throw err
          }
        }
        userExplicitlyExited = false
        if (options.lockLandscape) {
          await tryLockLandscapeOrientation()
        }
        return true
      }

      if (typeof elem.webkitRequestFullscreen === 'function') {
        await elem.webkitRequestFullscreen()
        userExplicitlyExited = false
        if (options.lockLandscape) {
          await tryLockLandscapeOrientation()
        }
        return true
      }

      if (typeof elem.mozRequestFullScreen === 'function') {
        await elem.mozRequestFullScreen()
        userExplicitlyExited = false
        return true
      }

      if (typeof elem.msRequestFullscreen === 'function') {
        await elem.msRequestFullscreen()
        userExplicitlyExited = false
        return true
      }
    } catch (err) {
      // Ignora silenciosamente se o navegador rejeitar (ex.: sem interação do usuário ou bloqueado pelo SO)
      console.debug('[Fullscreen] Rejeitado ou não suportado:', err)
    } finally {
      inFlightFullscreenRequest = null
    }

    return false
  })()

  return inFlightFullscreenRequest
}

export async function exitAppFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false
  userExplicitlyExited = true

  if (!isDocumentFullscreen()) return true

  const doc = document as VendorFullscreenDocument

  try {
    if (typeof doc.exitFullscreen === 'function') {
      await doc.exitFullscreen()
      return true
    } else if (typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen()
      return true
    } else if (typeof doc.mozCancelFullScreen === 'function') {
      await doc.mozCancelFullScreen()
      return true
    } else if (typeof doc.msExitFullscreen === 'function') {
      await doc.msExitFullscreen()
      return true
    }
  } catch (err) {
    console.debug('[Fullscreen] Erro ao sair de tela cheia:', err)
  }

  return false
}

export async function toggleAppFullscreen(options: FullscreenRequestOptions = {}): Promise<boolean> {
  if (isDocumentFullscreen()) {
    await exitAppFullscreen()
    return false
  }
  userExplicitlyExited = false
  return await requestAppFullscreen(options)
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

/**
 * Inicializa o gerenciador global de modo imersivo no ciclo de vida da aplicação.
 *
 * Em PWAs Android que iniciam em display-mode 'standalone' (com a barra do sistema visível),
 * arma listeners globais de primeiro gesto em fase de captura para solicitar
 * `requestFullscreen({ navigationUI: 'hide' })` logo no primeiro toque em qualquer tela
 * (sem depender de clique específico em DIRIGIR) e re-arma ao retornar do background.
 */
export function initImmersiveFullscreenLifecycle(options: ImmersiveLifecycleOptions = {}): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {}
  }

  if (activeLifecycleCleanup) {
    activeLifecycleCleanup()
    activeLifecycleCleanup = null
  }

  let disposed = false
  let gestureListenersArmed = false
  let exhaustedInVisibilityCycle = false

  const gestureEvents = ['pointerdown', 'touchstart', 'click'] as const

  const requestAutoFullscreen = async (): Promise<boolean> => {
    if (disposed || userExplicitlyExited || isImmersiveFullscreenActive()) {
      return isImmersiveFullscreenActive()
    }
    internalAutoAttempt = true
    try {
      return await requestAppFullscreen({
        lockLandscape: options.lockLandscapeOnFullscreen,
      })
    } finally {
      internalAutoAttempt = false
    }
  }

  const handleUserGesture = (event: Event) => {
    if (disposed) {
      disarmGestureListeners()
      return
    }

    if (isFullscreenToggleTarget(event.target)) {
      return
    }

    if (userExplicitlyExited || isImmersiveFullscreenActive()) {
      disarmGestureListeners()
      return
    }

    void requestAutoFullscreen().then((entered) => {
      if (disposed) return
      if (entered || isImmersiveFullscreenActive()) {
        disarmGestureListeners()
      } else if (event.type === 'click') {
        // Evita spam contínuo se o navegador/SO recusar mesmo após ativação completa de click;
        // será re-armado se o app retornar de background.
        exhaustedInVisibilityCycle = true
        disarmGestureListeners()
      }
    })
  }

  const armGestureListeners = () => {
    if (
      disposed ||
      gestureListenersArmed ||
      userExplicitlyExited ||
      exhaustedInVisibilityCycle ||
      isImmersiveFullscreenActive() ||
      !isFullscreenSupported()
    ) {
      return
    }

    gestureListenersArmed = true
    for (const eventName of gestureEvents) {
      document.addEventListener(eventName, handleUserGesture, { capture: true, passive: true })
    }
  }

  const disarmGestureListeners = () => {
    if (!gestureListenersArmed) return
    gestureListenersArmed = false
    for (const eventName of gestureEvents) {
      document.removeEventListener(eventName, handleUserGesture, { capture: true })
    }
  }

  const unsubscribeFullscreen = onFullscreenChange((fullscreen) => {
    if (disposed) return
    if (fullscreen) {
      disarmGestureListeners()
      if (options.lockLandscapeOnFullscreen) {
        void tryLockLandscapeOrientation()
      }
    }
  })

  const handleVisibilityOrPageShow = () => {
    if (disposed) return
    if (document.visibilityState === 'visible') {
      exhaustedInVisibilityCycle = false
      if (!userExplicitlyExited && !isImmersiveFullscreenActive()) {
        armGestureListeners()
      }
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityOrPageShow)
  window.addEventListener('pageshow', handleVisibilityOrPageShow)

  // Inicialização imediata: arma captura do primeiro gesto se não estiver já em fullscreen
  if (!isImmersiveFullscreenActive() && !userExplicitlyExited && isFullscreenSupported()) {
    armGestureListeners()

    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithStandalone) : undefined
    const hasActivationApi = Boolean(nav && 'userActivation' in nav && nav.userActivation)
    const canTryWithoutViolation = !hasActivationApi || Boolean(nav?.userActivation?.isActive)

    if (options.attemptOnInit && canTryWithoutViolation) {
      void requestAutoFullscreen().then((entered) => {
        if (!disposed && entered && isDocumentFullscreen()) {
          disarmGestureListeners()
        }
      })
    }
  }

  const cleanup = () => {
    if (disposed) return
    disposed = true
    disarmGestureListeners()
    unsubscribeFullscreen()
    document.removeEventListener('visibilitychange', handleVisibilityOrPageShow)
    window.removeEventListener('pageshow', handleVisibilityOrPageShow)
    if (activeLifecycleCleanup === cleanup) {
      activeLifecycleCleanup = null
    }
  }

  activeLifecycleCleanup = cleanup
  return cleanup
}

/**
 * Utilitário exclusivo para testes automatizados reiniciarem estado interno do módulo.
 */
export function resetFullscreenManagerForTests(): void {
  if (activeLifecycleCleanup) {
    activeLifecycleCleanup()
    activeLifecycleCleanup = null
  }
  inFlightFullscreenRequest = null
  userExplicitlyExited = false
  internalAutoAttempt = false
}
