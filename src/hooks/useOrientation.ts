import { useState, useEffect, useCallback } from 'react'

export interface OrientationInfo {
  isLandscape: boolean
  isPortrait: boolean
  isMobileDevice: boolean
  canLock: boolean
  lockLandscape: () => Promise<boolean>
}

/**
 * useOrientation — Detecta e gerencia a orientação da tela e dispositivo.
 *
 * Utiliza Screen Orientation API com fallback gracioso para window.matchMedia / window.innerWidth.
 */
export function useOrientation(): OrientationInfo {
  const getIsLandscape = () => {
    if (typeof window === 'undefined') return true
    if (window.screen?.orientation) {
      return window.screen.orientation.type.startsWith('landscape')
    }
    return window.innerWidth > window.innerHeight
  }

  const getIsMobile = () => {
    if (typeof window === 'undefined') return false
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches
    const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) <= 600
    const userAgentMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    return hasCoarsePointer || isSmallScreen || userAgentMobile
  }

  const [isLandscape, setIsLandscape] = useState(getIsLandscape)
  const [isMobileDevice, setIsMobileDevice] = useState(getIsMobile)

  const updateOrientation = useCallback(() => {
    setIsLandscape(getIsLandscape())
    setIsMobileDevice(getIsMobile())
  }, [])

  useEffect(() => {
    updateOrientation()

    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', updateOrientation)
    }
    window.addEventListener('resize', updateOrientation)

    return () => {
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', updateOrientation)
      }
      window.removeEventListener('resize', updateOrientation)
    }
  }, [updateOrientation])

  const lockLandscape = useCallback(async (): Promise<boolean> => {
    try {
      if (window.screen?.orientation && 'lock' in window.screen.orientation) {
        await (window.screen.orientation as any).lock('landscape')
        return true
      }
    } catch {
      // Bloqueio recusado ou não suportado (comum em navegadores desktop ou sem fullscreen prévio)
    }
    return false
  }, [])

  // Tenta travar em landscape automaticamente na montagem se for mobile
  useEffect(() => {
    if (isMobileDevice) {
      lockLandscape().catch(() => {})
    }
  }, [isMobileDevice, lockLandscape])

  const canLock = typeof window !== 'undefined' && !!window.screen?.orientation && 'lock' in window.screen.orientation

  return {
    isLandscape,
    isPortrait: !isLandscape,
    isMobileDevice,
    canLock,
    lockLandscape,
  }
}
