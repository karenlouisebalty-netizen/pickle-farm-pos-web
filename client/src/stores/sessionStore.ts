import { create } from 'zustand'
import type { Session } from '../shared/types'

interface SessionStore {
  session: Session | null
  setSession: (s: Session | null) => void
  isAuthenticated: () => boolean
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  setSession: (s) => set({ session: s }),
  isAuthenticated: () => get().session !== null,
}))
