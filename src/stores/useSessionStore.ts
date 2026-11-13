import { create } from 'zustand'

export type SessionEntryMode = 'cluster' | 'drive'

export interface SessionState {
  vehicleId: string | null
  instanceId: string | null
  entryMode: SessionEntryMode
  isSessionActive: boolean
  sessionStartedAt: number | null
}

export interface SessionActions {
  startSession: (vehicleId: string, entryMode: SessionEntryMode, instanceId?: string | null) => void
  endSession: () => void
  setEntryMode: (mode: SessionEntryMode) => void
}

export type SessionStore = SessionState & SessionActions

export const useSessionStore = create<SessionStore>((set) => ({
  vehicleId: null,
  instanceId: null,
  entryMode: 'drive',
  isSessionActive: false,
  sessionStartedAt: null,

  startSession: (vehicleId, entryMode, instanceId = null) =>
    set({
      vehicleId,
      instanceId,
      entryMode,
      isSessionActive: true,
      sessionStartedAt: Date.now(),
    }),

  endSession: () =>
    set({
      vehicleId: null,
      instanceId: null,
      isSessionActive: false,
      sessionStartedAt: null,
    }),

  setEntryMode: (mode) => set({ entryMode: mode }),
}))
