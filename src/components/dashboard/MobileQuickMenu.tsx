import { memo, useState, useEffect } from 'react'
import type { VehicleConfig } from '@/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore, type GraphicProfile } from '@/stores/useUIStore'
import { useDeviceTilt } from '@/hooks/useDeviceTilt'
import { TILT_SENSITIVITY_PRESETS, type TiltSensitivityPreset } from '@/systems/input'
import { isDocumentFullscreen, toggleAppFullscreen, onFullscreenChange } from '@/utils/fullscreen'

export interface MobileQuickMenuProps {
  isOpen: boolean
  onClose: () => void
  vehicle: VehicleConfig
  onOpenDragStrip: () => void
  onOpenDyno: () => void
  onOpenTuning: () => void
  onExit: () => void
}

interface TileProps {
  icon: string
  label: string
  sub?: string
  active?: boolean
  activeClass?: string
  dataFullscreenToggle?: boolean
  testId?: string
  onClick: () => void
}

function Tile({
  icon,
  label,
  sub,
  active,
  activeClass,
  dataFullscreenToggle,
  testId,
  onClick,
}: TileProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-fullscreen-toggle={dataFullscreenToggle ? 'true' : undefined}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 h-[70px] rounded-2xl border transition-all active:scale-95 cursor-pointer ${
        active
          ? activeClass ?? 'bg-amber-500/20 border-amber-400 text-amber-200'
          : 'bg-zinc-900/90 border-white/10 text-zinc-300'
      }`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[10px] font-mono font-black uppercase tracking-wider leading-none">{label}</span>
      {sub && <span className="text-[8px] font-mono text-zinc-400 leading-none">{sub}</span>}
    </button>
  )
}

const SENSITIVITY_PRESET_ORDER: readonly TiltSensitivityPreset[] = ['low', 'medium', 'high']
const DEADZONE_OPTIONS: readonly number[] = [0, 2, 3, 5]

/**
 * MobileQuickMenu — Menu Hambúrguer reorganizado na Fase 4.4.1.
 *
 * Contém apenas atalhos de ambiente/áudio, Garagem & Pista, calibração/preferências completas
 * do sensor de inclinação mobile e Sistema & Performance (sem duplicar modos de condução,
 * TCS, atalho do Painel 3 ou válvula de escape).
 */
export const MobileQuickMenu = memo(function MobileQuickMenu({
  isOpen,
  onClose,
  vehicle,
  onOpenDragStrip,
  onOpenDyno,
  onOpenTuning,
  onExit,
}: MobileQuickMenuProps) {
  const headlightsMode = useSimulationStore((s) => s.headlightsMode)
  const cycleHeadlights = useSimulationStore((s) => s.cycleHeadlights)
  const isRaining = useSimulationStore((s) => s.isRaining)
  const toggleRain = useSimulationStore((s) => s.toggleRain)
  const isMuted = useSimulationStore((s) => s.isMuted)
  const toggleMute = useSimulationStore((s) => s.toggleMute)
  const tuningStage = useSimulationStore((s) => s.tuningStage)
  const best0to100 = useSimulationStore((s) => s.best0to100)

  const steeringSensitivityPreset = useSimulationStore((s) => s.steeringSensitivityPreset)
  const setSteeringSensitivityPreset = useSimulationStore((s) => s.setSteeringSensitivityPreset)
  const steeringDeadzone = useSimulationStore((s) => s.steeringDeadzone)
  const setSteeringDeadzone = useSimulationStore((s) => s.setSteeringDeadzone)
  const steeringInvertDirection = useSimulationStore((s) => s.steeringInvertDirection)
  const setSteeringInvertDirection = useSimulationStore((s) => s.setSteeringInvertDirection)

  const {
    isSupported,
    requiresPermissionPrompt,
    permission,
    requestPermission,
    calibrateNeutral,
    resetCalibration,
    calibratedAngleDeg,
    neutralAngleDeg,
    isCalibrated,
    hasValidSample,
  } = useDeviceTilt()

  const graphicProfile = useUIStore((s) => s.graphicProfile)
  const setGraphicProfile = useUIStore((s) => s.setGraphicProfile)
  const showPerformanceMonitor = useUIStore((s) => s.showPerformanceMonitor)
  const togglePerformanceMonitor = useUIStore((s) => s.togglePerformanceMonitor)
  const showTiltIndicator = useUIStore((s) => s.showTiltIndicator)
  const setShowTiltIndicator = useUIStore((s) => s.setShowTiltIndicator)

  const [isFullscreen, setIsFullscreen] = useState(isDocumentFullscreen())
  const [calibNotice, setCalibNotice] = useState<string | null>(null)

  useEffect(() => {
    setIsFullscreen(isDocumentFullscreen())
    return onFullscreenChange(setIsFullscreen)
  }, [])

  const handleToggleFullscreen = async () => {
    const next = await toggleAppFullscreen()
    setIsFullscreen(next)
  }

  const cycleGraphicProfile = () => {
    const next: GraphicProfile =
      graphicProfile === 'normal' ? 'eco' : graphicProfile === 'eco' ? 'high' : 'normal'
    setGraphicProfile(next)
  }

  const handleCalibrate = () => {
    if (!hasValidSample) {
      setCalibNotice('Aguardando leitura física do sensor do aparelho para calibrar.')
      return
    }
    const angle = calibrateNeutral()
    setCalibNotice(`Centro neutro calibrado em ${angle > 0 ? `+${angle.toFixed(1)}` : angle.toFixed(1)}°.`)
  }

  const handleResetCalibration = () => {
    resetCalibration()
    setCalibNotice('Calibração restaurada para 0.0°.')
  }

  if (!isOpen) return null

  const headlightLabel =
    headlightsMode === 'off'
      ? 'DESLIG.'
      : headlightsMode === 'parking'
        ? 'LANTERNA'
        : headlightsMode === 'low'
          ? 'BAIXO'
          : 'ALTO'

  const openAndClose = (fn: () => void) => () => {
    fn()
    onClose()
  }

  const activePresetSpec = TILT_SENSITIVITY_PRESETS[steeringSensitivityPreset]

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onClick={onClose}
      data-testid="mobile-quick-menu-overlay"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        data-testid="mobile-quick-menu"
        className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-zinc-950 border-t border-x border-white/10 p-4 shadow-2xl"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-zinc-700" />

        <div className="flex items-center justify-between mb-3">
          <div className="leading-tight">
            <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
              {vehicle.info.brand}
            </span>
            <span className="block text-sm font-bold text-white">{vehicle.info.name}</span>
          </div>
          <button
            type="button"
            data-testid="btn-close-quick-menu"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 text-lg active:scale-95 cursor-pointer"
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>

        {/* Ambiente & Áudio Rápido */}
        <span className="block mb-1.5 text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
          Ambiente & Áudio
        </span>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Tile
            icon="💡"
            label="Faróis"
            sub={headlightLabel}
            active={headlightsMode !== 'off'}
            activeClass="bg-sky-500/20 border-sky-400 text-sky-200"
            testId="menu-tile-headlights"
            onClick={cycleHeadlights}
          />
          <Tile
            icon={isRaining ? '🌧️' : '☀️'}
            label="Clima"
            sub={isRaining ? 'CHUVA' : 'SECO'}
            active={isRaining}
            activeClass="bg-blue-600/30 border-blue-400 text-blue-200"
            testId="menu-tile-rain"
            onClick={toggleRain}
          />
          <Tile
            icon={isMuted ? '🔇' : '🔊'}
            label="Som"
            sub={isMuted ? 'MUDO' : 'LIGADO'}
            active={isMuted}
            activeClass="bg-red-500/20 border-red-400 text-red-200"
            testId="menu-tile-sound"
            onClick={toggleMute}
          />
        </div>

        {/* Garagem & Pista */}
        <span className="block mb-1.5 text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
          Garagem & Pista
        </span>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Tile
            icon="🔧"
            label="Oficina"
            sub={tuningStage > 0 ? `STAGE ${tuningStage}` : 'STOCK'}
            testId="menu-tile-tuning"
            onClick={openAndClose(onOpenTuning)}
          />
          <Tile
            icon="🏁"
            label="402M"
            sub={best0to100 ? `0-100 ${best0to100.toFixed(2)}s` : 'ARRANCADA'}
            testId="menu-tile-drag"
            onClick={openAndClose(onOpenDragStrip)}
          />
          <Tile
            icon="📈"
            label="Dyno"
            sub="POTÊNCIA"
            testId="menu-tile-dyno"
            onClick={openAndClose(onOpenDyno)}
          />
        </div>

        {/* Direção Mobile — Inclinação Física (Fase 4.4.1) */}
        <span className="block mb-1.5 text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
          Direção por Inclinação do Smartphone
        </span>
        <div
          className="bg-zinc-900/60 border border-white/10 rounded-2xl p-3 mb-4 space-y-3"
          data-testid="menu-tilt-settings-section"
        >
          {/* Feedback de Permissão / Suporte */}
          {!isSupported && (
            <div
              data-testid="tilt-status-unsupported"
              className="px-3 py-2 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-[9px] font-mono"
            >
              ⚠️ Sensor de orientação não detectado neste dispositivo/navegador.
            </div>
          )}
          {isSupported && permission === 'denied' && (
            <div
              data-testid="tilt-status-denied"
              className="px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[9px] font-mono"
            >
              ⚠️ Permissão negada pelo navegador. Habilite o acesso a sensores de movimento nas configurações.
            </div>
          )}
          {isSupported && requiresPermissionPrompt && permission === 'prompt' && (
            <button
              type="button"
              data-testid="btn-ios-sensor-permission"
              onClick={requestPermission}
              className="w-full py-2 rounded-xl bg-cyan-600/30 border border-cyan-400 text-cyan-200 font-mono text-[9px] font-bold uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
            >
              🔒 Autorizar Sensor de Movimento (iOS Safari)
            </button>
          )}

          {/* Botões de Calibração Central */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="btn-tilt-calibrate"
              onClick={handleCalibrate}
              className={`flex-1 h-9 rounded-xl border font-mono text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                isCalibrated
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                  : 'bg-amber-500/20 text-amber-300 border-amber-400'
              }`}
            >
              <span>🎯</span>
              <span>{isCalibrated ? `Recalibrar Centro (${neutralAngleDeg}°)` : 'Calibrar Centro Neutro'}</span>
            </button>

            <button
              type="button"
              data-testid="btn-tilt-reset-calibration"
              onClick={handleResetCalibration}
              className="h-9 px-3 rounded-xl border border-white/10 bg-zinc-900 text-zinc-400 font-mono text-[9px] font-bold uppercase hover:text-white cursor-pointer active:scale-95"
              title="Restaurar ponto zero original (0°)"
            >
              ↺ 0°
            </button>
          </div>

          {calibNotice && (
            <div className="px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-white/10 text-[8px] font-mono text-cyan-200">
              {calibNotice}
            </div>
          )}

          {/* Telemetria do sensor atual */}
          <div className="flex items-center justify-between text-[8px] font-mono text-zinc-400 px-1">
            <span>
              Ângulo Calibrado:{' '}
              <b className="text-cyan-300">
                {calibratedAngleDeg > 0 ? `+${calibratedAngleDeg}` : calibratedAngleDeg}°
              </b>
            </span>
            <span>
              Status:{' '}
              <b className={isSupported ? 'text-emerald-400' : 'text-red-400'}>
                {!isSupported
                  ? 'INDISPONÍVEL'
                  : permission === 'granted' || (!requiresPermissionPrompt && hasValidSample)
                    ? 'ATIVO'
                    : requiresPermissionPrompt && permission === 'prompt'
                      ? 'AGUARDANDO PERMISSÃO'
                      : permission === 'denied'
                        ? 'NEGADO'
                        : 'PRONTO'}
              </b>
            </span>
          </div>

          {/* 1. Inverter Direção (sinal final) */}
          <div>
            <div className="flex items-center justify-between text-[8px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">
              <span>Sentido da Direção</span>
              <span className={steeringInvertDirection ? 'text-amber-300 font-black' : 'text-cyan-400 font-black'}>
                {steeringInvertDirection ? 'INVERTIDA' : 'NORMAL'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                data-testid="btn-tilt-invert-normal"
                onClick={() => setSteeringInvertDirection(false)}
                className={`h-8 rounded-lg border font-mono text-[8.5px] font-bold uppercase transition-all cursor-pointer ${
                  !steeringInvertDirection
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-black'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
              >
                Normal (Padrão)
              </button>
              <button
                type="button"
                data-testid="btn-tilt-invert-inverted"
                onClick={() => setSteeringInvertDirection(true)}
                className={`h-8 rounded-lg border font-mono text-[8.5px] font-bold uppercase transition-all cursor-pointer ${
                  steeringInvertDirection
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-black'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
              >
                ⇄ Inverter Direção
              </button>
            </div>
          </div>

          {/* 2. Sensibilidade em 3 Níveis (Baixa / Média / Alta) */}
          <div>
            <div className="flex items-center justify-between text-[8px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">
              <span>Sensibilidade</span>
              <span className="text-cyan-400 font-black">
                {activePresetSpec.label.toUpperCase()} (~{Math.round(activePresetSpec.fullLockDeg)}° batente)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {SENSITIVITY_PRESET_ORDER.map((presetId) => {
                const spec = TILT_SENSITIVITY_PRESETS[presetId]
                const isActive = steeringSensitivityPreset === presetId
                return (
                  <button
                    key={presetId}
                    type="button"
                    data-testid={`btn-tilt-sens-${presetId}`}
                    onClick={() => setSteeringSensitivityPreset(presetId)}
                    className={`h-8 rounded-lg border font-mono text-[8.5px] font-bold uppercase transition-all cursor-pointer ${
                      isActive
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-black'
                        : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                    }`}
                  >
                    {spec.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. Ajuste de Zona Morta (Deadzone) */}
          <div>
            <div className="flex items-center justify-between text-[8px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">
              <span>Zona Morta (Deadzone)</span>
              <span className="text-cyan-400 font-black">{steeringDeadzone}°</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {DEADZONE_OPTIONS.map((dz) => (
                <button
                  key={dz}
                  type="button"
                  data-testid={`btn-tilt-deadzone-${dz}`}
                  onClick={() => setSteeringDeadzone(dz)}
                  className={`h-7 rounded-lg border font-mono text-[8px] font-bold transition-all cursor-pointer ${
                    steeringDeadzone === dz
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-black'
                      : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                  }`}
                >
                  {dz}°
                </button>
              ))}
            </div>
          </div>

          {/* 4. Indicador Visual de Inclinação no HUD Mobile */}
          <div>
            <div className="flex items-center justify-between text-[8px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">
              <span>Indicador de Inclinação (HUD)</span>
              <span className={showTiltIndicator ? 'text-cyan-400 font-black' : 'text-zinc-500 font-bold'}>
                {showTiltIndicator ? 'MOSTRAR' : 'OCULTAR'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                data-testid="btn-tilt-hud-show"
                onClick={() => setShowTiltIndicator(true)}
                className={`h-7 rounded-lg border font-mono text-[8px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  showTiltIndicator
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-black shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
              >
                <span>👁️</span>
                <span>Mostrar</span>
              </button>
              <button
                type="button"
                data-testid="btn-tilt-hud-hide"
                onClick={() => setShowTiltIndicator(false)}
                className={`h-7 rounded-lg border font-mono text-[8px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  !showTiltIndicator
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-black shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
              >
                <span>🙈</span>
                <span>Ocultar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sistema & Performance */}
        <span className="block mb-1.5 text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
          Sistema & Performance
        </span>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Tile
            icon={isFullscreen ? '📴' : '📱'}
            label="Tela Cheia"
            sub={isFullscreen ? 'IMERSIVO' : 'NORMAL'}
            active={isFullscreen}
            activeClass="bg-cyan-500/20 border-cyan-400 text-cyan-200"
            dataFullscreenToggle={true}
            testId="menu-tile-fullscreen"
            onClick={handleToggleFullscreen}
          />
          <Tile
            icon="⚡"
            label="Gráficos"
            sub={
              graphicProfile === 'eco'
                ? 'ECO (LEVE)'
                : graphicProfile === 'normal'
                  ? 'NORMAL'
                  : 'ALTO (60FPS)'
            }
            active={graphicProfile !== 'normal'}
            activeClass="bg-purple-500/20 border-purple-400 text-purple-200"
            testId="menu-tile-graphics"
            onClick={cycleGraphicProfile}
          />
          <Tile
            icon="📊"
            label="Diagnóstico"
            sub={showPerformanceMonitor ? 'FPS VISÍVEL' : 'DESLIGADO'}
            active={showPerformanceMonitor}
            activeClass="bg-emerald-500/20 border-emerald-400 text-emerald-200"
            testId="menu-tile-diagnostics"
            onClick={togglePerformanceMonitor}
          />
        </div>

        <button
          type="button"
          data-testid="btn-exit-garage"
          onClick={onExit}
          className="w-full h-11 rounded-xl border border-white/10 bg-zinc-900 text-zinc-300 font-mono font-black text-xs uppercase tracking-wider active:scale-95 cursor-pointer"
        >
          ← Sair para a garagem
        </button>
      </div>
    </div>
  )
})
