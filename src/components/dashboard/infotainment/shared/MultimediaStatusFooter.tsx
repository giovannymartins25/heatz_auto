import { memo, useEffect, useState } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'

export type MultimediaFooterTheme = 'cyan' | 'amber' | 'red' | 'sky' | 'emerald' | 'zinc'

export interface MultimediaStatusFooterProps {
  theme?: MultimediaFooterTheme
  className?: string
}

const THEME_ACCENT_CLASS: Readonly<Record<MultimediaFooterTheme, string>> = {
  cyan: 'text-cyan-300 border-cyan-500/20',
  amber: 'text-amber-300 border-amber-500/20',
  red: 'text-red-300 border-red-500/20',
  sky: 'text-sky-300 border-sky-400/25',
  emerald: 'text-emerald-300 border-emerald-500/20',
  zinc: 'text-zinc-200 border-white/10',
}

function formatLocalClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * MultimediaStatusFooter — Rodapé padronizado das centrais multimídia (Fase 4.4.2.1).
 *
 * Exibe em tempo real:
 * 1. Horário local real do dispositivo (`HH:mm`, atualizado automaticamente)
 * 2. Temperatura interna simulada da cabine (`cabinTempC` do `ClimateSystem`, não o setpoint alvo)
 * 3. Temperatura ambiente externa simulada (`ambientTempC` do `ClimateSystem`)
 */
export const MultimediaStatusFooter = memo(function MultimediaStatusFooter({
  theme = 'zinc',
  className = '',
}: MultimediaStatusFooterProps) {
  const [clockStr, setClockStr] = useState<string>(() => formatLocalClock(new Date()))
  const cabinTempC = useSimulationStore((s) => s.cabinTempC)
  const ambientTempC = useSimulationStore((s) => s.ambientTempC)

  useEffect(() => {
    const syncClock = () => setClockStr(formatLocalClock(new Date()))
    syncClock()
    const timerId = window.setInterval(syncClock, 10000)
    return () => window.clearInterval(timerId)
  }, [])

  const interiorRounded = Math.round(cabinTempC)
  const exteriorRounded = Math.round(ambientTempC)
  const accentClasses = THEME_ACCENT_CLASS[theme]

  return (
    <div
      data-testid="multimedia-status-footer"
      className={`mt-0.5 flex shrink-0 items-center justify-center gap-1.5 border-t bg-black/55 px-2 py-0.5 font-mono text-[6.8px] sm:text-[7.5px] font-bold tracking-wide text-zinc-300 select-none ${accentClasses} ${className}`}
    >
      <span data-testid="multimedia-footer-clock" className="font-black text-white tabular-nums">
        {clockStr}
      </span>
      <span className="text-zinc-600">|</span>
      <span data-testid="multimedia-footer-interior" className="tabular-nums">
        INTERIOR <b className="text-white">{interiorRounded}°C</b>
      </span>
      <span className="text-zinc-600">|</span>
      <span data-testid="multimedia-footer-exterior" className="tabular-nums">
        EXTERIOR <b className="text-zinc-200">{exteriorRounded}°C</b>
      </span>
    </div>
  )
})
