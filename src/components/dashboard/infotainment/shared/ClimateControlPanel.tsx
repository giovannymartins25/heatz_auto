import { memo, useState } from 'react'

export interface ClimateControlProps {
  theme?: 'gti' | 'porsche' | 'toyota' | 'honda'
  compact?: boolean
}

/**
 * ClimateControlPanel — Sistema automotivo interativo de Ar-Condicionado (Climatronic / Digital A/C).
 *
 * Recursos:
 * - Controle Dual-Zone independente (Motorista e Passageiro) com incremento de 0.5°C
 * - Velocidade do ventilador (1 a 5 barras ou OFF) com indicador gráfico de fluxo
 * - Modos: A/C ligado, AC MAX (resfriamento rápido polar), AUTO e Recirculação interna
 * - Direção do ar: Para-brisa (desembaçador), Difusores frontais, Assoalho/pés
 * - Animação suave de brisa/ar condicionado soprando
 * - Design adaptável ao tema da montadora (GTI vermelho, Porsche titânio/âmbar, Toyota GR ciano)
 */
export const ClimateControlPanel = memo(function ClimateControlPanel({
  theme = 'gti',
  compact = false,
}: ClimateControlProps) {
  const [driverTemp, setDriverTemp] = useState(21.5)
  const [passTemp, setPassTemp] = useState(22.0)
  const [isAcOn, setIsAcOn] = useState(true)
  const [isMaxAc, setIsMaxAc] = useState(false)
  const [isAuto, setIsAuto] = useState(true)
  const [isSync, setIsSync] = useState(false)
  const [fanSpeed, setFanSpeed] = useState(3) // 0 (OFF) a 5 (MAX)
  const [recirc, setRecirc] = useState(true)
  const [ventDirection, setVentDirection] = useState<'face' | 'windshield' | 'feet'>('face')

  const changeDriverTemp = (delta: number) => {
    setDriverTemp((prev) => {
      const next = Math.round((prev + delta) * 10) / 10
      const clamped = Math.min(Math.max(next, 16.0), 29.5)
      if (isSync) setPassTemp(clamped)
      return clamped
    })
  }

  const changePassTemp = (delta: number) => {
    setPassTemp((prev) => {
      const next = Math.round((prev + delta) * 10) / 10
      return Math.min(Math.max(next, 16.0), 29.5)
    })
  }

  const toggleMaxAc = () => {
    if (!isMaxAc) {
      setIsMaxAc(true)
      setIsAcOn(true)
      setFanSpeed(5)
      setDriverTemp(16.0)
      if (isSync) setPassTemp(16.0)
    } else {
      setIsMaxAc(false)
      setFanSpeed(2)
      setDriverTemp(21.5)
    }
  }

  const themeBgActive =
    theme === 'porsche'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
      : theme === 'toyota'
      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
      : theme === 'honda'
      ? 'bg-red-500/25 text-red-300 border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
      : 'bg-red-600/20 text-red-400 border-red-500/50'

  return (
    <div className={`w-full flex flex-col items-center select-none font-mono ${compact ? 'gap-1' : 'gap-2'}`}>
      {/* ── Status do Ar-Condicionado ── */}
      <div className="w-full flex items-center justify-between px-1 text-[8px] sm:text-[9px] border-b border-white/10 pb-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isAcOn
                ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse'
                : 'bg-zinc-600'
            }`}
          />
          <span className="font-bold text-zinc-300">
            {isMaxAc ? '❄️ A/C MÁXIMO POLAR' : isAcOn ? '❄️ CLIMATIZAÇÃO ATIVA' : 'VENTILAÇÃO PURA'}
          </span>
        </div>
        <span className="text-[7px] text-zinc-500 uppercase">
          {theme === 'porsche'
            ? 'PORSCHE 2-ZONE'
            : theme === 'toyota'
            ? 'TOYOTA NANOEX'
            : 'AIR CARE CLIMATRONIC'}
        </span>
      </div>

      {/* ── Seletor Dual de Temperatura (Motorista / Passageiro) ── */}
      <div className="w-full flex items-center justify-around py-1">
        {/* Lado Esquerdo: Motorista */}
        <div className="flex flex-col items-center">
          <span className="text-[7px] text-zinc-400 font-bold uppercase mb-0.5">MOTORISTA</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => changeDriverTemp(-0.5)}
              className="w-6 h-6 rounded-lg bg-zinc-900 border border-white/10 active:bg-sky-500/20 active:border-sky-400 text-sky-400 font-black text-xs flex items-center justify-center cursor-pointer transition-transform active:scale-90"
              title="Diminuir Temperatura"
            >
              -
            </button>
            <div className="flex flex-col items-center justify-center w-14 h-9 rounded-xl bg-black/80 border border-white/10">
              <span className="text-base sm:text-lg font-black text-white leading-none">
                {driverTemp <= 16.0 ? 'LO' : driverTemp.toFixed(1)}
              </span>
              <span className="text-[6px] font-bold text-zinc-400">°C DUAL</span>
            </div>
            <button
              onClick={() => changeDriverTemp(0.5)}
              className="w-6 h-6 rounded-lg bg-zinc-900 border border-white/10 active:bg-red-500/20 active:border-red-400 text-red-400 font-black text-xs flex items-center justify-center cursor-pointer transition-transform active:scale-90"
              title="Aumentar Temperatura"
            >
              +
            </button>
          </div>
        </div>

        {/* Central: Velocidade do Ventilador & Animação do Fluxo de Ar */}
        <div className="flex flex-col items-center px-1">
          <span className="text-[7px] text-zinc-400 font-bold uppercase mb-0.5">VENTILADOR</span>
          <div className="flex items-center gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFanSpeed(lvl)}
                className={`w-2.5 h-6 rounded-sm transition-all cursor-pointer ${
                  fanSpeed >= lvl
                    ? isAcOn
                      ? 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.7)]'
                      : 'bg-amber-400'
                    : 'bg-zinc-800'
                }`}
                title={`Velocidade ${lvl}`}
              />
            ))}
          </div>
          <span className="text-[7px] font-bold text-zinc-400">
            VELOCIDADE {fanSpeed}/5
          </span>
        </div>

        {/* Lado Direito: Passageiro */}
        <div className="flex flex-col items-center">
          <span className="text-[7px] text-zinc-400 font-bold uppercase mb-0.5">PASSAGEIRO</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => changePassTemp(-0.5)}
              disabled={isSync}
              className={`w-6 h-6 rounded-lg bg-zinc-900 border border-white/10 text-sky-400 font-black text-xs flex items-center justify-center cursor-pointer transition-transform active:scale-90 ${
                isSync ? 'opacity-40 cursor-not-allowed' : 'active:bg-sky-500/20 active:border-sky-400'
              }`}
              title="Diminuir Temperatura Passageiro"
            >
              -
            </button>
            <div className="flex flex-col items-center justify-center w-14 h-9 rounded-xl bg-black/80 border border-white/10">
              <span className="text-base sm:text-lg font-black text-white leading-none">
                {passTemp <= 16.0 ? 'LO' : passTemp.toFixed(1)}
              </span>
              <span className="text-[6px] font-bold text-zinc-400">°C DUAL</span>
            </div>
            <button
              onClick={() => changePassTemp(0.5)}
              disabled={isSync}
              className={`w-6 h-6 rounded-lg bg-zinc-900 border border-white/10 text-red-400 font-black text-xs flex items-center justify-center cursor-pointer transition-transform active:scale-90 ${
                isSync ? 'opacity-40 cursor-not-allowed' : 'active:bg-red-500/20 active:border-red-400'
              }`}
              title="Aumentar Temperatura Passageiro"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* ── Botões Rápidos de Climatização ── */}
      <div className="w-full grid grid-cols-4 gap-1 text-[8px] font-bold">
        {/* A/C Toggle */}
        <button
          onClick={() => setIsAcOn(!isAcOn)}
          className={`py-1 rounded-lg border transition-all cursor-pointer flex flex-col items-center justify-center ${
            isAcOn
              ? 'bg-sky-500/20 text-sky-300 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
              : 'bg-zinc-900 text-zinc-500 border-white/10'
          }`}
        >
          <span>A/C</span>
          <span className="text-[6px]">{isAcOn ? 'ON' : 'OFF'}</span>
        </button>

        {/* AC MAX */}
        <button
          onClick={toggleMaxAc}
          className={`py-1 rounded-lg border transition-all cursor-pointer flex flex-col items-center justify-center ${
            isMaxAc
              ? 'bg-sky-600 text-white border-sky-300 animate-pulse'
              : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
          }`}
        >
          <span>AC MAX</span>
          <span className="text-[6px]">GELAR</span>
        </button>

        {/* MODO AUTO */}
        <button
          onClick={() => setIsAuto(!isAuto)}
          className={`py-1 rounded-lg border transition-all cursor-pointer flex flex-col items-center justify-center ${
            isAuto
              ? themeBgActive
              : 'bg-zinc-900 text-zinc-500 border-white/10'
          }`}
        >
          <span>AUTO</span>
          <span className="text-[6px]">CLIMA</span>
        </button>

        {/* SYNC DUAL */}
        <button
          onClick={() => {
            const nextSync = !isSync
            setIsSync(nextSync)
            if (nextSync) setPassTemp(driverTemp)
          }}
          className={`py-1 rounded-lg border transition-all cursor-pointer flex flex-col items-center justify-center ${
            isSync
              ? themeBgActive
              : 'bg-zinc-900 text-zinc-500 border-white/10'
          }`}
        >
          <span>SYNC</span>
          <span className="text-[6px]">{isSync ? 'ATIVO' : 'DUAL'}</span>
        </button>
      </div>

      {/* ── Seleção de Direção do Fluxo de Ar & Recirculação ── */}
      <div className="w-full flex items-center justify-between border-t border-white/10 pt-1 text-[7px] font-bold text-zinc-400">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setVentDirection('windshield')}
            className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
              ventDirection === 'windshield' ? 'bg-sky-500/20 text-sky-300 border-sky-400' : 'border-transparent'
            }`}
          >
            💨 PÁRA-BRISA
          </button>
          <button
            onClick={() => setVentDirection('face')}
            className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
              ventDirection === 'face' ? 'bg-sky-500/20 text-sky-300 border-sky-400' : 'border-transparent'
            }`}
          >
            🌬️ FRONTAL
          </button>
          <button
            onClick={() => setVentDirection('feet')}
            className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
              ventDirection === 'feet' ? 'bg-sky-500/20 text-sky-300 border-sky-400' : 'border-transparent'
            }`}
          >
            🦶 PÉS
          </button>
        </div>

        <button
          onClick={() => setRecirc(!recirc)}
          className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
            recirc ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-zinc-900 text-zinc-500 border-white/10'
          }`}
        >
          {recirc ? '🔄 RECIRCULAÇÃO' : '💨 AR EXTERNO'}
        </button>
      </div>
    </div>
  )
})
