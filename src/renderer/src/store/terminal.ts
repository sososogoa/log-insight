import { create } from 'zustand'
import type { TerminalSession } from '@shared/types'

interface TerminalState {
  sessions: TerminalSession[]
  activeId: string | null
  expandCount: number
  setActive: (id: string) => void
  add: (s: TerminalSession) => void
  remove: (id: string) => void
  requestExpand: () => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sessions: [],
  activeId: null,
  expandCount: 0,
  setActive: (id) => set({ activeId: id }),
  requestExpand: () => set((s) => ({ expandCount: s.expandCount + 1 })),
  add: (s) =>
    set((state) => ({
      sessions: [...state.sessions, s],
      activeId: state.activeId ?? s.id
    })),
  remove: (id) =>
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id)
      return {
        sessions,
        activeId: state.activeId === id ? (sessions[0]?.id ?? null) : state.activeId
      }
    })
}))
