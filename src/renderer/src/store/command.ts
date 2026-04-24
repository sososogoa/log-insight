import { create } from 'zustand'

interface CommandState {
  open: boolean
  query: string
  setOpen: (open: boolean) => void
  setQuery: (query: string) => void
  toggle: () => void
  close: () => void
}

export const useCommandStore = create<CommandState>((set) => ({
  open: false,
  query: '',
  setOpen: (open) => set({ open, query: open ? '' : '' }),
  setQuery: (query) => set({ query }),
  toggle: () => set((s) => ({ open: !s.open, query: '' })),
  close: () => set({ open: false, query: '' })
}))
