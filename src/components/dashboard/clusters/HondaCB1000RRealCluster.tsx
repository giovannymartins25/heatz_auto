import { memo } from 'react'
import type { DashboardTelemetry } from '@/systems/dashboard'

interface HondaCB1000RRealClusterProps {
  telemetry: DashboardTelemetry
}

/**
 * HondaCB1000RRealCluster — Réplica fiel da tela TFT Colorida de 5 polegadas da superbike Honda CB1000R Neo Sports Café.
 *
 * Características reais da Honda:
 * - Painel 100% digital TFT com chassi angular esportivo para motos naked
 * - Tacômetro sweeping superior de alta rotação (0 a 12.000 RPM) com escala ciano/âmbar/vermelho
 * - Velocímetro digital gigante central de altíssima legibilidade
 * - Caixa de marcha em destaque com iluminação verde para 'N' (Neutro)
 * - Mostrador dos 3 parâmetros eletrônicos da Honda:
 *   - P (Potência do Motor: 1 a 3)
 *   - EB (Engine Brake / Freio-Motor: 1 a 3)
 *   - T (HSTC - Honda Selectable Torque Control: 1 a 3 com ícone piscante em intervenção)
 * - 4 Modos de pilotagem: SPORT (vermelho), STANDARD (azul), RAIN (ciano), USER (laranja)
 * - Shift light sequencial de LEDs no topo do display
 */
export const HondaCB1000RRealCluster = memo(function HondaCB1000RRealCluster({
  telemetry,
}: HondaCB1000RRealClusterProps) {
  const {
    tachometer,
    speedometer,
    gear,
    warningLights,
    auxGauges,
    shiftLight,
  } = telemetry

  const maxRpm = 12000
  const clampedRpm = Math.min(Math.max(tachometer.rpm, 0), maxRpm)
  const rpmPercent = Math.min(100, (clampedRpm / maxRpm) * 100)
  const isRedline = clampedRpm >= 10500

  // 6 segmentos de combustível no padrão da CB1000R
  const fuelSegments = Math.round((auxGauges.fuelPercent / 100) * 6)

  return (
    <div className="relative flex flex-col items-center w-full max-w-2xl p-4 sm:p-5 rounded-3xl bg-zinc-950 border-2 border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.9)] select-none">
      {/* ── Borda Superior: Faixa de Shift Lights de LED da CB1000R ── */}
      <div className="flex items-center justify-between w-full px-3 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-500 uppercase">
            HONDA TFT 5"
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
        </div>

        {/* Barra de LEDs de Shift Light */}
        <div className="flex items-center gap-1">
          {[...Array(8)].map((_, i) => {
            const step = 8500 + i * 400
            const active = clampedRpm >= step
            const isRed = i >= 5
            return (
              <div
                key={i}
                className={`w-3 h-2 rounded-xs transition-all ${
                  shiftLight.isBlinking
                    ? 'bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)] animate-pulse'
                    : active
                    ? isRed
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                      : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                    : 'bg-zinc-800'
                }`}
              />
            )
          })}
        </div>

        {/* Luzes de Alerta de Moto: Neutro [N], ABS, Check Engine */}
        <div className="flex items-center gap-2">
          {/* Neutro [N] */}
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black transition-all ${
              gear.isNeutral
                ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.9)]'
                : 'text-zinc-800 opacity-30'
            }`}
          >
            N
          </span>
          {/* ABS */}
          <span
            className={`text-[9px] font-mono font-bold px-1 rounded ${
              warningLights.brake ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-zinc-800 opacity-30'
            }`}
          >
            ABS
          </span>
          {/* MIL / Injeção */}
          <span
            className={`text-xs ${
              warningLights.checkEngine ? 'text-amber-400 opacity-100' : 'text-zinc-800 opacity-30'
            }`}
          >
            ⚠️
          </span>
        </div>
      </div>

      {/* ── Tela TFT Principal da CB1000R ── */}
      <div className="w-full rounded-2xl bg-gradient-to-b from-zinc-950 via-[#0a0f16] to-black border border-white/10 p-3 sm:p-4 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] flex flex-col justify-between gap-3">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 1. TOPO: TACÔMETRO SWEEPING DIGITAL (0 a 12.000 RPM)                */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="w-full flex flex-col gap-1">
          {/* Números da escala de giro da CB1000R */}
          <div className="flex justify-between text-[9px] font-mono font-bold text-zinc-400 px-1">
            <span>0</span>
            <span>2</span>
            <span>4</span>
            <span>6</span>
            <span>8</span>
            <span className="text-amber-400">10</span>
            <span className="text-red-500">12</span>
          </div>

          {/* Barra dinâmica de RPM com transição de cor */}
          <div className="relative w-full h-4 bg-zinc-900 rounded-sm overflow-hidden border border-white/15 p-0.5">
            <div
              className={`h-full rounded-xs transition-all duration-75 ${
                isRedline
                  ? 'bg-gradient-to-r from-amber-400 via-red-500 to-red-600 shadow-[0_0_15px_rgba(239,68,68,0.9)] animate-pulse'
                  : clampedRpm > 8000
                  ? 'bg-gradient-to-r from-cyan-400 via-amber-400 to-amber-500'
                  : 'bg-gradient-to-r from-sky-400 to-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.5)]'
              }`}
              style={{ width: `${rpmPercent}%` }}
            />
          </div>

          <div className="flex justify-between items-center px-1 text-[10px] font-mono">
            <span className="text-zinc-500 uppercase tracking-widest font-bold">r/min</span>
            <span className={`font-black ${isRedline ? 'text-red-500' : 'text-zinc-200'}`}>
              {Math.round(clampedRpm)} RPM
            </span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 2. CENTRO: VELOCÍMETRO GIGANTE + CAIXA DE MARCHA + MODO HONDA       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between w-full my-auto px-2">
          {/* Caixa de Marcha Esportiva Honda */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1">
              GEAR
            </span>
            <div
              className={`w-16 h-18 sm:w-18 sm:h-20 rounded-xl border-2 flex items-center justify-center shadow-lg transition-all ${
                gear.isNeutral
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                  : 'bg-zinc-900/90 border-amber-500/80 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              }`}
            >
              <span className="text-4xl sm:text-5xl font-mono font-black leading-none">
                {gear.label}
              </span>
            </div>
          </div>

          {/* Velocímetro Central Gigante da Moto */}
          <div className="flex flex-col items-center">
            <span className="text-7xl sm:text-8xl font-mono font-black text-white tracking-tighter leading-none drop-shadow-[0_0_24px_rgba(255,255,255,0.35)]">
              {Math.round(speedometer.speed)}
            </span>
            <span className="text-xs font-mono font-black uppercase tracking-widest text-zinc-300 mt-1">
              km/h
            </span>
          </div>

          {/* Pilha de Parâmetros Eletrônicos Honda: P, EB, T */}
          <div className="flex flex-col gap-1.5 items-end">
            {/* Riding Mode Badge */}
            <span
              className={`text-[9px] font-mono font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                gear.drivingMode === 'sport'
                  ? 'bg-red-500/20 text-red-400 border border-red-500'
                  : gear.drivingMode === 'eco'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                  : 'bg-sky-500/20 text-sky-400 border border-sky-500'
              }`}
            >
              {gear.drivingMode === 'sport' ? 'SPORT' : gear.drivingMode === 'eco' ? 'RAIN' : 'STANDARD'}
            </span>

            {/* P (Power) */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px] font-mono">
              <span className="text-zinc-400 font-bold">P</span>
              <span className="text-white font-black">{gear.drivingMode === 'sport' ? '3' : '2'}</span>
            </div>

            {/* EB (Engine Brake) */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px] font-mono">
              <span className="text-zinc-400 font-bold">EB</span>
              <span className="text-white font-black">{gear.drivingMode === 'sport' ? '1' : '2'}</span>
            </div>

            {/* T (HSTC Traction Control) */}
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono transition-all ${
                warningLights.tcsFlash
                  ? 'bg-amber-500 text-black border-amber-400 font-black animate-ping'
                  : 'bg-zinc-900 text-white border-white/10'
              }`}
            >
              <span className="text-zinc-400 font-bold">T</span>
              <span className="font-black">{telemetry.tcs.enabled ? '1' : 'OFF'}</span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 3. BASE: COMBUSTÍVEL EM BARRAS, TEMPERATURA E ODÔMETRO              */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between w-full border-t border-white/10 pt-2 px-1 text-[10px] font-mono">
          {/* Nível de Combustível em 6 Segmentos */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">⛽</span>
            <div className="flex items-center gap-0.5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-3 rounded-xs ${
                    i < fuelSegments
                      ? i === 0 && fuelSegments === 1
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-cyan-400'
                      : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Odômetro / Trip */}
          <div className="flex items-center gap-2 text-zinc-400 text-[9px]">
            <span>TRIP A: <strong className="text-white">124.8 km</strong></span>
            <span>TOTAL: <strong className="text-white">4.820 km</strong></span>
          </div>

          {/* Temperatura da Água */}
          <div className="flex items-center gap-1 text-zinc-300">
            <span className="text-zinc-500">TEMP:</span>
            <span className="font-bold text-white">{Math.round(auxGauges.coolantTemp)}°C</span>
          </div>
        </div>
      </div>
    </div>
  )
})
