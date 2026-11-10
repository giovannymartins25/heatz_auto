import type { IAudioEngine } from '@/types'
import type { SynthAudioConfig } from '@/types'
import { clamp, mapRange } from '@/utils/math'

export interface EngineAcousticProfile {
  cylinders: number
  engineType: 'i4' | 'boxer6' | 'i4_highrev' | 'i4_ap' | 'i4_vtec' | 'v6' | 'v8'
  exhaustResonanceHz: number
  exhaustResonanceQ: number
  intakeResonanceHz: number
  hasBrapOnShift: boolean
  subHarmonicWeight: number
  highHarmonicRasp: number
}

/**
 * SynthEngine — Motor de áudio acústico sintetizado ultra-realista via Web Audio API.
 *
 * Em vez de osciladores estáticos genéricos que soam como sintetizadores eletrônicos,
 * este motor utiliza modelagem física da mecânica de combustão interna:
 * 1. Frequência fundamental de disparo dos cilindros: f_fire = (RPM / 60) * (Cilindros / 2)
 * 2. Sub-harmônicos de ordem fracionária (0.5x, 1.5x): simulam o desbalanço acústico
 *    natural dos coletores de escape e tempos de admissão, gerando o clássico ronco mecânico.
 * 3. Ressonância acústica de escape (BiquadFilter com Q ajustado): caixa de ressonância
 *    específica de cada carro (Gol G6 encorpado, Yaris suave, CB1000R gritador, GT3 RS boxer).
 * 4. Ronco de Admissão Dinâmico (Induction Roar): abre com o acelerador (borboleta aberta),
 *    gerando a sucção profunda de ar quando o piloto pisa fundo.
 * 5. Saturação não-linear de combustão (WaveShaper): distorção harmônica suave que
 *    dá peso e textura sob carga do motor.
 * 6. Decel Burble & Overrun Crackles: estalos e borbulhas no escape ao soltar o acelerador em alto giro.
 * 7. Estouro de troca de marcha (PDK/DSG shift brap): corte ultrarrápido de ignição com estampido.
 * 8. Som de motor de arranque (Starter Crank): cadência mecânica real na ignição.
 */
export class SynthEngine implements IAudioEngine {
  private readonly config: SynthAudioConfig
  private readonly idleRpm: number
  private readonly maxRpm: number
  private readonly profile: EngineAcousticProfile

  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private userVolume: number = 1.0

  // Cadeia de Combustão & Escape
  private combustionGain: GainNode | null = null
  private exhaustFilter: BiquadFilterNode | null = null
  private exhaustRaspFilter: BiquadFilterNode | null = null
  private waveShaper: WaveShaperNode | null = null

  // Osciladores de combustão
  private fundamentalOsc: OscillatorNode | null = null
  private subOscHalf: OscillatorNode | null = null
  private subOscOneAndHalf: OscillatorNode | null = null
  private harmonicOscs: OscillatorNode[] = []
  private harmonicGains: GainNode[] = []

  // Camada de Ronco de Admissão (Intake Induction Roar)
  private intakeOsc: OscillatorNode | null = null
  private intakeFilter: BiquadFilterNode | null = null
  private intakeGain: GainNode | null = null

  // Camada de Ruído Mecânico e Válvulas
  private noiseSource: AudioBufferSourceNode | null = null
  private noiseGain: GainNode | null = null
  private noiseFilter: BiquadFilterNode | null = null

  // Camada de Cam Whine / Superbike Gear Whine (para CB1000R e GT3)
  private camWhineOsc: OscillatorNode | null = null
  private camWhineGain: GainNode | null = null

  // Camada de Assobio de Turbina (Turbo Spool Whine)
  private turboWhistleOsc: OscillatorNode | null = null
  private turboWhistleGain: GainNode | null = null

  // Buzina & Efeitos
  private hornOsc1: OscillatorNode | null = null
  private hornOsc2: OscillatorNode | null = null
  private hornGain: GainNode | null = null
  private lastBackfireTime = 0
  private lastBurbleTime = 0
  private starterOsc: OscillatorNode | null = null
  private starterGain: GainNode | null = null
  private exhaustValveOpen = true

  private currentRpm = 0
  private currentThrottle = 0
  private _isInitialized = false
  private _isPlaying = false

  constructor(
    config: SynthAudioConfig,
    idleRpm: number,
    maxRpm: number,
    customProfile?: Partial<EngineAcousticProfile>,
  ) {
    // Normaliza a configuração: garante valores padrão seguros para evitar que
    // um config.json incompleto (sem harmonics/baseFrequency) derrube o áudio inteiro.
    this.config = {
      ...config,
      baseFrequency: Number.isFinite(config?.baseFrequency) ? config.baseFrequency : 65,
      harmonics: Array.isArray(config?.harmonics) && config.harmonics.length > 0 ? config.harmonics : [1, 2, 3, 4, 6],
      gainIdle: Number.isFinite(config?.gainIdle) ? config.gainIdle : 0.2,
      gainMax: Number.isFinite(config?.gainMax) ? config.gainMax : 0.75,
      cylinders: config?.cylinders ?? 4,
    }
    this.idleRpm = idleRpm
    this.maxRpm = maxRpm
    this.currentRpm = idleRpm

    // Detectar ou configurar perfil acústico de acordo com o veículo
    this.profile = this.resolveProfile(customProfile)
  }

  get isInitialized(): boolean {
    return this._isInitialized
  }

  get isPlaying(): boolean {
    return this._isPlaying
  }

  private resolveProfile(custom?: Partial<EngineAcousticProfile>): EngineAcousticProfile {
    // 1. Volkswagen AP 1.9 Turbo (Gol Quadrado Forjado: ronco encorpado, marcha lenta embaralhada, estampidos de 3-step)
    if (this.config.engineType === 'i4_ap' || this.config.cylinders === 4 && this.maxRpm === 7600) {
      return {
        cylinders: 4,
        engineType: 'i4_ap',
        exhaustResonanceHz: 160,
        exhaustResonanceQ: 3.5,
        intakeResonanceHz: 480,
        hasBrapOnShift: true,
        subHarmonicWeight: 0.65, // Grave profundo e descompasso clássico de comando bravo
        highHarmonicRasp: 0.85,
        ...custom,
      }
    }

    // 2. Honda Civic Si 2.0 16V K20 i-VTEC (Duplo comando variável, berro agudo estridente acima de 5.800 RPM)
    if (this.config.engineType === 'i4_vtec' || this.config.engineType === 'i4_highrev' && this.maxRpm <= 8800) {
      return {
        cylinders: 4,
        engineType: 'i4_vtec',
        exhaustResonanceHz: 330,
        exhaustResonanceQ: 3.4,
        intakeResonanceHz: 780,
        hasBrapOnShift: false,
        subHarmonicWeight: 0.25,
        highHarmonicRasp: 0.82,
        ...custom,
      }
    }

    // 3. Porsche 911 Flat-6 Boxer (Bi-Turbo ou GT3)
    if (this.config.engineType === 'boxer6' || (this.maxRpm >= 7000 && this.config.cylinders === 6)) {
      return {
        cylinders: 6,
        engineType: 'boxer6',
        exhaustResonanceHz: 320,
        exhaustResonanceQ: 3.0,
        intakeResonanceHz: 720,
        hasBrapOnShift: true,
        subHarmonicWeight: 0.40,
        highHarmonicRasp: 0.70,
        ...custom,
      }
    }

    // 2. Moto de Alta Rotação: CB1000R (11500 RPM, 4-cilindros em linha)
    if (this.maxRpm >= 10500) {
      return {
        cylinders: 4,
        engineType: 'i4_highrev',
        exhaustResonanceHz: 480,
        exhaustResonanceQ: 3.5,
        intakeResonanceHz: 820,
        hasBrapOnShift: false,
        subHarmonicWeight: 0.22,
        highHarmonicRasp: 0.90,
        ...custom,
      }
    }

    // 3. Volkswagen Golf GTI Mk7 2.0 TSI EA888 (Ronco encorpado, DSG shift brap, ressonância esportiva)
    if (this.config.hasBrapOnShift && this.config.cylinders === 4) {
      return {
        cylinders: 4,
        engineType: 'i4',
        exhaustResonanceHz: 215,
        exhaustResonanceQ: 2.8,
        intakeResonanceHz: 550,
        hasBrapOnShift: true,
        subHarmonicWeight: 0.46,
        highHarmonicRasp: 0.62,
        ...custom,
      }
    }

    // 4. Toyota Yaris 1.5 (Suave, VVT-i)
    if (this.config.baseFrequency <= 60) {
      return {
        cylinders: 4,
        engineType: 'i4',
        exhaustResonanceHz: 210,
        exhaustResonanceQ: 1.8,
        intakeResonanceHz: 450,
        hasBrapOnShift: false,
        subHarmonicWeight: 0.28,
        highHarmonicRasp: 0.35,
        ...custom,
      }
    }

    // 5. Gol G6 1.6 MSI (4 cilindros clássico, encorpado)
    return {
      cylinders: 4,
      engineType: 'i4',
      exhaustResonanceHz: 175,
      exhaustResonanceQ: 2.4,
      intakeResonanceHz: 520,
      hasBrapOnShift: false,
      subHarmonicWeight: 0.42,
      highHarmonicRasp: 0.55,
      ...custom,
    }
  }

  async init(): Promise<void> {
    if (this._isInitialized) return
    if (typeof window === 'undefined' && typeof AudioContext === 'undefined') return

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.context = new AudioCtx()

    // 1. Master Gain
    this.masterGain = this.context.createGain()
    this.masterGain.gain.value = 0
    this.masterGain.connect(this.context.destination)

    // 2. WaveShaper para saturação harmônica de combustão real
    this.waveShaper = this.context.createWaveShaper()
    this.waveShaper.curve = this.createDistortionCurve(18)
    this.waveShaper.oversample = '2x'

    // 3. Filtros acústicos de ressonância de escape
    this.exhaustFilter = this.context.createBiquadFilter()
    this.exhaustFilter.type = 'peaking'
    this.exhaustFilter.frequency.value = this.profile.exhaustResonanceHz
    this.exhaustFilter.Q.value = this.profile.exhaustResonanceQ
    this.exhaustFilter.gain.value = 6 // +6dB de ressonância no corpo do escape

    this.exhaustRaspFilter = this.context.createBiquadFilter()
    this.exhaustRaspFilter.type = 'lowpass'
    this.exhaustRaspFilter.frequency.value = 3500
    this.exhaustRaspFilter.Q.value = 1.0

    this.combustionGain = this.context.createGain()
    this.combustionGain.gain.value = 0.5

    // Conectar cadeia de escape:
    // Osciladores -> CombustionGain -> WaveShaper -> ExhaustFilter -> ExhaustRaspFilter -> MasterGain
    this.combustionGain.connect(this.waveShaper)
    this.waveShaper.connect(this.exhaustFilter)
    this.exhaustFilter.connect(this.exhaustRaspFilter)
    this.exhaustRaspFilter.connect(this.masterGain)

    // 4. Criar Oscilador Fundamental de Disparo de Cilindros
    const idleFireFreq = (this.idleRpm / 60) * (this.profile.cylinders / 2)
    this.fundamentalOsc = this.context.createOscillator()
    this.fundamentalOsc.type = this.profile.engineType === 'boxer6' ? 'sawtooth' : 'triangle'
    this.fundamentalOsc.frequency.value = idleFireFreq

    const fundGain = this.context.createGain()
    fundGain.gain.value = 0.8
    this.fundamentalOsc.connect(fundGain)
    fundGain.connect(this.combustionGain)

    // 5. Sub-harmônico 0.5x (Desbalanço de 4 tempos / batimento do coletor)
    this.subOscHalf = this.context.createOscillator()
    this.subOscHalf.type = 'sawtooth'
    this.subOscHalf.frequency.value = idleFireFreq * 0.5
    const subHalfGain = this.context.createGain()
    subHalfGain.gain.value = this.profile.subHarmonicWeight
    this.subOscHalf.connect(subHalfGain)
    subHalfGain.connect(this.combustionGain)

    // 6. Sub-harmônico 1.5x (Ordem acústica de pulso de escape cruzado)
    this.subOscOneAndHalf = this.context.createOscillator()
    this.subOscOneAndHalf.type = 'sawtooth'
    this.subOscOneAndHalf.frequency.value = idleFireFreq * 1.5
    const subOneHalfGain = this.context.createGain()
    subOneHalfGain.gain.value = this.profile.subHarmonicWeight * 0.7
    this.subOscOneAndHalf.connect(subOneHalfGain)
    subOneHalfGain.connect(this.combustionGain)

    // 7. Harmônicos Superiores (Rasp, metálico e ressonância de cabeçote)
    const harmonicMultipliers = this.config.harmonics.length > 0
      ? this.config.harmonics
      : [2, 3, 4, 6]

    this.harmonicOscs = []
    this.harmonicGains = []
    for (const mult of harmonicMultipliers) {
      const osc = this.context.createOscillator()
      const gain = this.context.createGain()

      osc.type = 'sawtooth'
      osc.frequency.value = idleFireFreq * mult
      gain.gain.value = (1 / (mult * 1.6)) * (0.5 + this.profile.highHarmonicRasp * 0.5)

      osc.connect(gain)
      gain.connect(this.combustionGain)

      this.harmonicOscs.push(osc)
      this.harmonicGains.push(gain)
    }

    // 8. Cadeia de Ronco de Admissão (Induction Roar)
    this.intakeOsc = this.context.createOscillator()
    this.intakeOsc.type = 'triangle'
    this.intakeOsc.frequency.value = idleFireFreq * 2

    this.intakeFilter = this.context.createBiquadFilter()
    this.intakeFilter.type = 'bandpass'
    this.intakeFilter.frequency.value = this.profile.intakeResonanceHz
    this.intakeFilter.Q.value = 2.8

    this.intakeGain = this.context.createGain()
    this.intakeGain.gain.value = 0

    this.intakeOsc.connect(this.intakeFilter)
    this.intakeFilter.connect(this.intakeGain)
    this.intakeGain.connect(this.masterGain)

    // 9. Cam Whine / Gear Whine (apenas para superbike CB1000R e GT3)
    if (this.profile.engineType === 'i4_highrev' || this.profile.engineType === 'boxer6') {
      this.camWhineOsc = this.context.createOscillator()
      this.camWhineOsc.type = 'sine'
      this.camWhineOsc.frequency.value = idleFireFreq * 8
      this.camWhineGain = this.context.createGain()
      this.camWhineGain.gain.value = 0.02

      this.camWhineOsc.connect(this.camWhineGain)
      this.camWhineGain.connect(this.masterGain)
    }

    // 10. Ruído mecânico filtrado (válvulas e atrito)
    this.noiseGain = this.context.createGain()
    this.noiseGain.gain.value = 0.015
    this.noiseFilter = this.context.createBiquadFilter()
    this.noiseFilter.type = 'bandpass'
    this.noiseFilter.frequency.value = 1800
    this.noiseFilter.Q.value = 1.2
    this.noiseGain.connect(this.noiseFilter)
    this.noiseFilter.connect(this.masterGain)

    // 11. Assobio de Turbina (Turbo Spool Whine)
    this.turboWhistleOsc = this.context.createOscillator()
    this.turboWhistleOsc.type = 'sine'
    this.turboWhistleOsc.frequency.value = 1400
    this.turboWhistleGain = this.context.createGain()
    this.turboWhistleGain.gain.value = 0

    this.turboWhistleOsc.connect(this.turboWhistleGain)
    this.turboWhistleGain.connect(this.masterGain)

    this._isInitialized = true
  }

  start(): void {
    if (!this.context || !this.masterGain || this._isPlaying) return

    if (this.context.state === 'suspended') {
      this.context.resume()
    }

    // Iniciar todos os osciladores
    const oscsToStart = [
      this.fundamentalOsc,
      this.subOscHalf,
      this.subOscOneAndHalf,
      this.intakeOsc,
      this.camWhineOsc,
      this.turboWhistleOsc,
      ...this.harmonicOscs,
    ]

    for (const osc of oscsToStart) {
      if (osc) {
        try {
          osc.start()
        } catch {
          // Já iniciado
        }
      }
    }

    // Iniciar ruído mecânico
    this.createNoiseSource()

    // Fade in suave
    this.masterGain.gain.setTargetAtTime(
      this.config.gainIdle * this.userVolume,
      this.context.currentTime,
      0.08,
    )

    this._isPlaying = true
  }

  stop(): void {
    if (!this.context || !this.masterGain || !this._isPlaying) return

    this.masterGain.gain.setTargetAtTime(0, this.context.currentTime, 0.12)
    this._isPlaying = false
  }

  /**
   * Atualiza as frequências de todos os disparos de cilindro em tempo real.
   */
  setRpm(rpm: number): void {
    if (!this.context || !this._isPlaying) return
    this.currentRpm = Math.max(0, rpm)

    const now = this.context.currentTime
    const fireFreq = (this.currentRpm / 60) * (this.profile.cylinders / 2)

    // 1. Fundamental
    if (this.fundamentalOsc) {
      this.fundamentalOsc.frequency.setTargetAtTime(Math.max(12, fireFreq), now, 0.012)
    }

    // 2. Sub-harmônicos
    if (this.subOscHalf) {
      this.subOscHalf.frequency.setTargetAtTime(Math.max(6, fireFreq * 0.5), now, 0.012)
    }
    if (this.subOscOneAndHalf) {
      this.subOscOneAndHalf.frequency.setTargetAtTime(Math.max(18, fireFreq * 1.5), now, 0.012)
    }

    // 3. Harmônicos superiores
    for (let i = 0; i < this.harmonicOscs.length; i++) {
      const mult = this.config.harmonics[i] || (i + 2)
      this.harmonicOscs[i].frequency.setTargetAtTime(
        Math.max(20, fireFreq * mult),
        now,
        0.012,
      )
    }

    // 4. Oscilador de admissão
    if (this.intakeOsc) {
      this.intakeOsc.frequency.setTargetAtTime(Math.max(25, fireFreq * 2), now, 0.012)
    }

    // 5. Cam whine (guincho mecânico em alta rotação)
    if (this.camWhineOsc && this.camWhineGain) {
      this.camWhineOsc.frequency.setTargetAtTime(fireFreq * 6, now, 0.015)
      const whineGain = mapRange(this.currentRpm, this.idleRpm, this.maxRpm, 0.008, 0.065)
      this.camWhineGain.gain.setTargetAtTime(whineGain, now, 0.03)
    }

    // 6. Dinâmica do filtro de escape e VTEC Crossover
    const isVtecCrossover = this.profile.engineType === 'i4_vtec' && this.currentRpm >= 5800
    if (this.intakeFilter && this.intakeGain && isVtecCrossover) {
      // VTEC Crossover: abre a admissão e solta o berro agudo de comando bravo
      this.intakeFilter.frequency.setTargetAtTime(1400 + (this.currentRpm - 5800) * 0.4, now, 0.02)
      this.intakeFilter.Q.setTargetAtTime(3.8, now, 0.02)
      this.intakeGain.gain.setTargetAtTime(0.38 + this.currentThrottle * 0.45, now, 0.02)
    }

    // AP 1.9 Turbo: marcha lenta rústica com flutter de comando bravo
    if (this.profile.engineType === 'i4_ap' && this.currentRpm < 1200 && this.fundamentalOsc) {
      const lumpyMod = 1 + 0.07 * Math.sin(now * 14 * Math.PI)
      this.fundamentalOsc.frequency.setTargetAtTime(fireFreq * lumpyMod, now, 0.02)
    }

    if (this.exhaustRaspFilter) {
      const maxCutoff = isVtecCrossover ? 7200 : this.profile.engineType === 'i4_highrev' ? 6500 : 4800
      const cutoff = mapRange(
        this.currentRpm,
        this.idleRpm,
        this.maxRpm,
        1800,
        maxCutoff,
      )
      this.exhaustRaspFilter.frequency.setTargetAtTime(cutoff, now, 0.03)
    }

    // 7. Ruído mecânico de textura
    if (this.noiseGain) {
      const noiseLevel = mapRange(this.currentRpm, this.idleRpm, this.maxRpm, 0.012, 0.055)
      this.noiseGain.gain.setTargetAtTime(noiseLevel, now, 0.05)
    }
  }

  /**
   * Ajusta o volume e o ronco de admissão baseado no acelerador e na carga.
   */
  setThrottle(throttle: number): void {
    if (!this.context || !this.masterGain || !this._isPlaying) return
    const prevThrottle = this.currentThrottle
    this.currentThrottle = clamp(throttle, 0, 1)

    const now = this.context.currentTime

    // 1. Ganho Master geral proporcional ao acelerador, giro e volume do usuário
    const targetGain =
      mapRange(
        this.currentThrottle,
        0,
        1,
        this.config.gainIdle,
        this.config.gainMax,
      ) * this.userVolume
    this.masterGain.gain.setTargetAtTime(clamp(targetGain, 0, 1), now, 0.04)

    // 2. Ronco de Admissão (Induction Roar): abre agressivamente a partir de 25% de pé
    if (this.intakeGain && this.intakeFilter) {
      const intakeLevel = Math.pow(this.currentThrottle, 1.4) * (this.profile.engineType === 'boxer6' ? 0.38 : 0.28)
      this.intakeGain.gain.setTargetAtTime(intakeLevel, now, 0.035)

      // Cutoff do filtro de admissão sobe com a borboleta abrindo
      const intakeFreq = mapRange(
        this.currentThrottle,
        0,
        1,
        this.profile.intakeResonanceHz * 0.7,
        this.profile.intakeResonanceHz * 1.5,
      )
      this.intakeFilter.frequency.setTargetAtTime(intakeFreq, now, 0.04)
    }

    // 3. Detecção de desaceleração rápida (Overrun Burble)
    if (prevThrottle > 0.45 && this.currentThrottle < 0.1 && this.currentRpm > this.idleRpm * 2.2) {
      this.triggerDecelBurble()
    }
  }

  setMasterGain(gain: number): void {
    this.userVolume = clamp(gain, 0, 1)
    if (!this.masterGain || !this.context) return
    const currentGain = mapRange(this.currentThrottle, 0, 1, this.config.gainIdle, this.config.gainMax)
    this.masterGain.gain.setTargetAtTime(clamp(currentGain * this.userVolume, 0, 1), this.context.currentTime, 0.05)
  }

  /**
   * Válvula de Difusor de Escape (Direct Exhaust / Active Flap).
   * Aberto: aumenta ganho harmônico, graves e estampidos de corte.
   */
  setExhaustValve(open: boolean): void {
    this.exhaustValveOpen = open
    if (!this.context || !this.combustionGain) return
    const now = this.context.currentTime
    const mult = open ? 1.35 : 0.8
    this.combustionGain.gain.setTargetAtTime(clamp(this.config.gainMax * mult, 0, 1), now, 0.04)
  }

  /**
   * Estouro de troca de marcha (PDK / DSG shift brap).
   * Produz um corte ultrarrápido de ignição seguido de estampido violento no escape.
   */
  triggerShiftBrap(): void {
    if (!this.context || !this._isPlaying || !this.masterGain) return
    const now = this.context.currentTime
    const popIntensity = this.exhaustValveOpen ? 1.15 : 0.65

    // 1. Corte rápido de ignição (45ms)
    this.masterGain.gain.cancelScheduledValues(now)
    this.masterGain.gain.setValueAtTime(0.05, now)
    this.masterGain.gain.setValueAtTime(this.config.gainMax * (this.exhaustValveOpen ? 1.55 : 1.1), now + 0.042)
    this.masterGain.gain.setTargetAtTime(this.config.gainMax, now + 0.08, 0.03)

    // 2. Estampido duplo característico de DSG (grave + estalo de corte)
    this.createTransientPop(popIntensity, 380)
    setTimeout(() => {
      if (this._isPlaying) this.createTransientPop(popIntensity * 0.7, 620)
    }, 25)
  }

  /**
   * Modula o assobio da turbina (Turbo Spool Whine) baseado na pressão positiva gerada.
   */
  setTurboBoost(boostBar: number): void {
    if (!this.context || !this.turboWhistleGain || !this.turboWhistleOsc || !this._isPlaying) return
    const now = this.context.currentTime
    const positiveBoost = Math.max(0, boostBar)

    if (positiveBoost > 0.05) {
      // Frequência do rotor do compressor sobe de 1250 até 2600 Hz
      const targetFreq = 1250 + positiveBoost * 1050
      this.turboWhistleOsc.frequency.setTargetAtTime(targetFreq, now, 0.03)
      const targetGain = clamp(positiveBoost * 0.065, 0, 0.075)
      this.turboWhistleGain.gain.setTargetAtTime(targetGain, now, 0.04)
    } else {
      this.turboWhistleGain.gain.setTargetAtTime(0, now, 0.06)
    }
  }

  /**
   * Borbulhas e estalos na desaceleração (Overrun Crackles / Pops & Bangs).
   */
  triggerDecelBurble(): void {
    if (!this.context || !this._isPlaying) return
    const now = this.context.currentTime
    const minInterval = this.exhaustValveOpen ? 0.06 : 0.12
    if (now - this.lastBurbleTime < minInterval) return
    this.lastBurbleTime = now

    const count = (this.exhaustValveOpen ? 3 : 2) + Math.floor(Math.random() * (this.exhaustValveOpen ? 5 : 2))
    const baseIntensity = this.exhaustValveOpen ? 0.85 : 0.4
    for (let i = 0; i < count; i++) {
      const delay = i * 0.055 + Math.random() * 0.035
      setTimeout(() => {
        if (this._isPlaying && this.currentThrottle < 0.20) {
          this.createTransientPop(baseIntensity + Math.random() * 0.45, 1200 + Math.random() * 800)
        }
      }, delay * 1000)
    }
  }

  /**
   * Som da Válvula de Alívio do Turbo (Blow-off Valve / Compressor Surge Flutter "Tschhh / Stututu").
   */
  triggerBlowOff(boostBar = 1.0): void {
    if (!this.context || !this._isPlaying) return
    const now = this.context.currentTime

    const duration = Math.min(0.65, 0.28 + boostBar * 0.22)
    const bufferSize = Math.floor(this.context.sampleRate * duration)
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate)
    const data = buffer.getChannelData(0)

    // Modulação de flutter a 18Hz (compressor surge "tu-tu-tu")
    const flutterFreq = 18
    for (let i = 0; i < bufferSize; i++) {
      const t = i / this.context.sampleRate
      const decay = Math.exp(-t / (duration * 0.42))
      const flutter = 0.65 + 0.35 * Math.sin(2 * Math.PI * flutterFreq * t)
      data[i] = (Math.random() * 2 - 1) * decay * flutter
    }

    const noise = this.context.createBufferSource()
    noise.buffer = buffer

    const filter = this.context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(2800, now)
    filter.frequency.exponentialRampToValueAtTime(1400, now + duration)
    filter.Q.value = 2.2

    const gain = this.context.createGain()
    gain.gain.setValueAtTime(clamp(boostBar * 0.55, 0.2, 0.85), now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.context.destination)

    noise.start(now)
    noise.stop(now + duration)
  }

  /**
   * Estouro do limitador do Controle de Largada (Launch Control 2-step anti-lag).
   */
  triggerLaunchLimiter(): void {
    if (!this.context || !this._isPlaying) return
    const now = this.context.currentTime
    if (now - this.lastBackfireTime < 0.045) return
    this.lastBackfireTime = now

    this.createTransientPop(0.75, 950 + Math.random() * 350)
  }

  /**
   * Estouro de corte de giro (Rev Limiter Backfire).
   */
  triggerBackfire(): void {
    if (!this.context || !this._isPlaying) return
    const now = this.context.currentTime
    if (now - this.lastBackfireTime < 0.065) return
    this.lastBackfireTime = now

    this.createTransientPop(0.85, 850 + Math.random() * 400)
  }

  /**
   * Som de partida mecânica (Starter Motor Crank).
   */
  playStarterCrank(): void {
    if (!this.context || this.starterGain) return
    if (this.context.state === 'suspended') this.context.resume()

    const now = this.context.currentTime
    this.starterGain = this.context.createGain()
    this.starterGain.gain.setValueAtTime(0.25, now)
    this.starterGain.gain.setTargetAtTime(0, now + 0.45, 0.08)
    this.starterGain.connect(this.context.destination)

    this.starterOsc = this.context.createOscillator()
    this.starterOsc.type = 'sawtooth'
    this.starterOsc.frequency.setValueAtTime(14, now) // Cadência de 14 compressões por segundo
    this.starterOsc.frequency.exponentialRampToValueAtTime(32, now + 0.35)

    this.starterOsc.connect(this.starterGain)
    this.starterOsc.start(now)
    this.starterOsc.stop(now + 0.5)

    setTimeout(() => {
      this.starterOsc?.disconnect()
      this.starterGain?.disconnect()
      this.starterOsc = null
      this.starterGain = null
    }, 550)
  }

  startHorn(): void {
    if (!this.context || this.hornGain) return
    if (this.context.state === 'suspended') this.context.resume()

    const now = this.context.currentTime
    this.hornGain = this.context.createGain()
    this.hornGain.gain.setValueAtTime(0, now)
    this.hornGain.gain.linearRampToValueAtTime(0.35, now + 0.02)
    this.hornGain.connect(this.context.destination)

    this.hornOsc1 = this.context.createOscillator()
    this.hornOsc2 = this.context.createOscillator()
    this.hornOsc1.type = 'sawtooth'
    this.hornOsc2.type = 'sawtooth'
    this.hornOsc1.frequency.value = 420
    this.hornOsc2.frequency.value = 500

    this.hornOsc1.connect(this.hornGain)
    this.hornOsc2.connect(this.hornGain)
    this.hornOsc1.start()
    this.hornOsc2.start()
  }

  stopHorn(): void {
    if (!this.context || !this.hornGain) return
    const now = this.context.currentTime
    this.hornGain.gain.linearRampToValueAtTime(0.001, now + 0.05)
    setTimeout(() => {
      try {
        this.hornOsc1?.stop()
        this.hornOsc2?.stop()
        this.hornOsc1?.disconnect()
        this.hornOsc2?.disconnect()
        this.hornGain?.disconnect()
      } catch {}
      this.hornOsc1 = null
      this.hornOsc2 = null
      this.hornGain = null
    }, 60)
  }

  dispose(): void {
    try {
      this.hornOsc1?.stop()
      this.hornOsc2?.stop()
    } catch {}
    this.hornGain?.disconnect()
    this.hornOsc1 = null
    this.hornOsc2 = null
    this.hornGain = null

    const allOscs = [
      this.fundamentalOsc,
      this.subOscHalf,
      this.subOscOneAndHalf,
      this.intakeOsc,
      this.camWhineOsc,
      this.turboWhistleOsc,
      ...this.harmonicOscs,
    ]

    for (const osc of allOscs) {
      if (osc) {
        try {
          osc.stop()
          osc.disconnect()
        } catch {}
      }
    }

    this.noiseSource?.stop()
    this.noiseSource?.disconnect()
    this.noiseGain?.disconnect()
    this.intakeGain?.disconnect()
    this.combustionGain?.disconnect()
    this.masterGain?.disconnect()
    this.context?.close()

    this.fundamentalOsc = null
    this.subOscHalf = null
    this.subOscOneAndHalf = null
    this.intakeOsc = null
    this.camWhineOsc = null
    this.turboWhistleOsc = null
    this.turboWhistleGain = null
    this.harmonicOscs = []
    this.harmonicGains = []
    this.noiseSource = null
    this.noiseGain = null
    this.masterGain = null
    this.context = null
    this._isInitialized = false
    this._isPlaying = false
  }

  /** Gera estampido de pressão no escape realista (pops & bangs / braps / backfire explosivo) */
  private createTransientPop(volume: number, filterFreq: number): void {
    if (!this.context) return
    const now = this.context.currentTime
    const isLoud = this.exhaustValveOpen
    const adjustedVol = isLoud ? volume * 1.5 : volume * 0.85

    // 1. Sub-Bass Thump (Impacto físico de baixa frequência no escapamento)
    const subOsc = this.context.createOscillator()
    const subGain = this.context.createGain()
    subOsc.type = 'sine'
    subOsc.frequency.setValueAtTime(130, now)
    subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.055)
    subGain.gain.setValueAtTime(adjustedVol * 0.75, now)
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065)

    subOsc.connect(subGain)
    subGain.connect(this.context.destination)
    subOsc.start(now)
    subOsc.stop(now + 0.07)

    // 2. Ruído explosivo de queima com estalo agudo (Crackle / Gunshot Snap)
    const duration = isLoud ? 0.08 : 0.045
    const bufferSize = Math.floor(this.context.sampleRate * duration)
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 7)
    }

    const popSource = this.context.createBufferSource()
    popSource.buffer = buffer

    const filter = this.context.createBiquadFilter()
    filter.type = isLoud ? 'bandpass' : 'lowpass'
    filter.frequency.value = isLoud ? 1700 : filterFreq
    filter.Q.value = isLoud ? 1.6 : 1.0

    const popGain = this.context.createGain()
    popGain.gain.setValueAtTime(adjustedVol, now)
    popGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    popSource.connect(filter)
    filter.connect(popGain)
    popGain.connect(this.context.destination)

    popSource.start(now)
    popSource.stop(now + duration)
  }

  /** Cria fonte contínua de ruído branco para textura mecânica */
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

  /** Curva sigmoide suave para saturação harmônica de câmara de combustão */
  private createDistortionCurve(k = 20): Float32Array<ArrayBuffer> {
    const nSamples = 44100
    const buffer = new ArrayBuffer(nSamples * 4)
    const curve = new Float32Array(buffer)
    const deg = Math.PI / 180
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x))
    }
    return curve
  }
}
