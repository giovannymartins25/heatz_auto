/**
 * Tipos do sistema de áudio.
 * Interface base que tanto SynthEngine quanto SampleEngine implementarão.
 */

/** Interface base para motores de áudio */
export interface IAudioEngine {
  init(): Promise<void>
  start(): void
  stop(): void
  setRpm(rpm: number): void
  setThrottle(throttle: number): void
  setMasterGain(gain: number): void
  dispose(): void
  readonly isInitialized: boolean
  readonly isPlaying: boolean
}

/** Categorias de som (extensível para futuro) */
export type SoundCategory =
  | 'engine'
  | 'exhaust'
  | 'turbo'
  | 'blowoff'
  | 'wastegate'
  | 'transmission'
  | 'tires'
  | 'brakes'
  | 'wind'
  | 'ambient'
