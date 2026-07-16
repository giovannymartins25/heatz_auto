import type { IAudioEngine } from '@/types'
import type { SynthAudioConfig } from '@/types'
import { clamp, mapRange } from '@/utils/math'

/**
 * SynthEngine — Motor de áudio sintetizado via Web Audio API.
 *
 * Gera som de motor usando múltiplos osciladores com harmônicos.
 * Cada harmônico é um multiplicador da frequência base, criando
 * um timbre mais rico que um único oscilador.
 *
 * Exemplo para o Gol G6 (4 cilindros, baseFrequency: 65Hz):
 *   Harmônicos [1, 2, 3, 4.02, 6] geram osciladores em:
 *   65Hz, 130Hz, 195Hz, 261Hz, 390Hz
 *   O leve desvio (4.02 em vez de 4) cria batimento natural.
 *
 * A frequência de cada oscilador escala com o RPM:
 *   freq = baseFreq × harmônico × (currentRpm / idleRpm)
 *
 * Implementa IAudioEngine para troca transparente com SampleEngine.
 */
export class SynthEngine implements IAudioEngine {
  private readonly config: SynthAudioConfig
  private readonly idleRpm: number
  private readonly maxRpm: number

  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private oscillators: OscillatorNode[] = []
  private oscillatorGains: GainNode[] = []
  private noiseSource: AudioBufferSourceNode | null = null
  private noiseGain: GainNode | null = null

  private _isInitialized = false
  private _isPlaying = false

  constructor(config: SynthAudioConfig, idleRpm: number, maxRpm: number) {
    this.config = config
    this.idleRpm = idleRpm
    this.maxRpm = maxRpm
  }

  get isInitialized(): boolean {
    return this._isInitialized
  }

  get isPlaying(): boolean {
    return this._isPlaying
  }

  async init(): Promise<void> {
    if (this._isInitialized) return

    this.context = new AudioContext()

    // Master gain — controle geral de volume
    this.masterGain = this.context.createGain()
    this.masterGain.gain.value = 0
    this.masterGain.connect(this.context.destination)

    // Criar osciladores para cada harmônico
    for (const harmonic of this.config.harmonics) {
      const osc = this.context.createOscillator()
      const gain = this.context.createGain()

      // Tipo de onda: sawtooth simula melhor um motor de combustão
      osc.type = 'sawtooth'
      osc.frequency.value = this.config.baseFrequency * harmonic

      // Harmônicos mais altos têm volume menor (decaimento natural)
      gain.gain.value = 1 / (harmonic * 1.5)

      osc.connect(gain)
      gain.connect(this.masterGain)

      this.oscillators.push(osc)
      this.oscillatorGains.push(gain)
    }

    // Ruído branco sutil para textura mecânica
    this.noiseGain = this.context.createGain()
    this.noiseGain.gain.value = 0.02
    this.noiseGain.connect(this.masterGain)

    this._isInitialized = true
  }

  start(): void {
    if (!this.context || !this.masterGain || this._isPlaying) return

    // Resumir context (necessário após interação do usuário em mobile)
    if (this.context.state === 'suspended') {
      this.context.resume()
    }

    // Iniciar osciladores
    for (const osc of this.oscillators) {
      try {
        osc.start()
      } catch {
        // Oscilador já foi iniciado — ignorar
      }
    }

    // Iniciar ruído branco
    this.createNoiseSource()

    // Fade in suave
    this.masterGain.gain.setTargetAtTime(
      this.config.gainIdle,
      this.context.currentTime,
      0.1,
    )

    this._isPlaying = true
  }

  stop(): void {
    if (!this.context || !this.masterGain || !this._isPlaying) return

    // Fade out suave
    this.masterGain.gain.setTargetAtTime(0, this.context.currentTime, 0.15)

    this._isPlaying = false
  }

  /**
   * Atualiza frequência dos osciladores baseado no RPM atual.
   * Chamado a cada frame pelo game loop.
   */
  setRpm(rpm: number): void {
    if (!this.context || !this._isPlaying) return

    const rpmRatio = rpm / this.idleRpm
    const now = this.context.currentTime

    // Atualizar frequência de cada oscilador
    for (let i = 0; i < this.oscillators.length; i++) {
      const harmonic = this.config.harmonics[i]
      const targetFreq = this.config.baseFrequency * harmonic * rpmRatio

      // setTargetAtTime para suavizar a transição (evita cliques)
      this.oscillators[i].frequency.setTargetAtTime(targetFreq, now, 0.01)
    }

    // Volume do ruído aumenta com RPM (simula mais atividade mecânica)
    if (this.noiseGain) {
      const noiseLevel = mapRange(rpm, this.idleRpm, this.maxRpm, 0.01, 0.06)
      this.noiseGain.gain.setTargetAtTime(noiseLevel, now, 0.05)
    }
  }

  /**
   * Ajusta o ganho baseado na posição do acelerador.
   * Throttle 0 = volume baixo (idle), Throttle 1 = volume alto.
   */
  setThrottle(throttle: number): void {
    if (!this.context || !this.masterGain || !this._isPlaying) return

    const targetGain = mapRange(
      throttle,
      0,
      1,
      this.config.gainIdle,
      this.config.gainMax,
    )

    this.masterGain.gain.setTargetAtTime(
      clamp(targetGain, 0, 1),
      this.context.currentTime,
      0.05,
    )
  }

  setMasterGain(gain: number): void {
    if (!this.masterGain || !this.context) return
    this.masterGain.gain.setTargetAtTime(
      clamp(gain, 0, 1),
      this.context.currentTime,
      0.05,
    )
  }

  dispose(): void {
    for (const osc of this.oscillators) {
      try {
        osc.stop()
        osc.disconnect()
      } catch {
        // Já parado
      }
    }

    this.noiseSource?.stop()
    this.noiseSource?.disconnect()
    this.noiseGain?.disconnect()
    this.masterGain?.disconnect()
    this.context?.close()

    this.oscillators = []
    this.oscillatorGains = []
    this.noiseSource = null
    this.noiseGain = null
    this.masterGain = null
    this.context = null
    this._isInitialized = false
    this._isPlaying = false
  }

  /** Cria uma fonte de ruído branco para textura mecânica */
  private createNoiseSource(): void {
    if (!this.context || !this.noiseGain) return

    const bufferSize = this.context.sampleRate * 2
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    this.noiseSource = this.context.createBufferSource()
    this.noiseSource.buffer = buffer
    this.noiseSource.loop = true
    this.noiseSource.connect(this.noiseGain)
    this.noiseSource.start()
  }
}
