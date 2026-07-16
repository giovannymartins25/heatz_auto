/**
 * HapticFeedback — Sistema de vibração para dispositivos compatíveis.
 * 
 * Utiliza a Vibration API do navegador para fornecer
 * feedback tátil em eventos como:
 * - Troca de marcha
 * - Corte de giros (rev limiter)
 * - Engine start/stop
 * - Impactos
 * 
 * Será implementado na Etapa 11.
 */

export class HapticFeedback {
  private static isSupported(): boolean {
    return 'vibrate' in navigator
  }

  static light(): void {
    if (this.isSupported()) navigator.vibrate(10)
  }

  static medium(): void {
    if (this.isSupported()) navigator.vibrate(25)
  }

  static heavy(): void {
    if (this.isSupported()) navigator.vibrate(50)
  }

  static gearShift(): void {
    if (this.isSupported()) navigator.vibrate([15, 30, 15])
  }

  static revLimiter(): void {
    if (this.isSupported()) navigator.vibrate([8, 15, 8, 15, 8])
  }

  static engineStart(): void {
    if (this.isSupported()) navigator.vibrate([30, 50, 80])
  }
}
