import { create } from 'zustand'
import type { Bookmark } from '@shared/types'

interface BookmarksState {
  list: Bookmark[]
  loaded: boolean
  panelOpen: boolean
  /** Bookmark id whose note editing starts as soon as the panel opens. One-shot. */
  focusNoteId: string | null

  load: () => Promise<void>
  save: (bm: Bookmark) => Promise<void>
  remove: (id: string) => Promise<void>
  clear: () => Promise<void>
  exportMarkdown: () => Promise<{ ok: boolean; path?: string }>
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
}

export const useBookmarksStore = create<BookmarksState>((set) => ({
  list: [],
  loaded: false,
  panelOpen: false,
  focusNoteId: null,

  load: async () => {
    const list = await window.api.bookmarks.list()
    set({ list, loaded: true })
  },

  save: async (bm) => {
    const list = await window.api.bookmarks.save(bm)
    set({ list })
  },

  remove: async (id) => {
    const list = await window.api.bookmarks.remove(id)
    set({ list })
  },

  clear: async () => {
    const list = await window.api.bookmarks.clear()
    set({ list })
  },

  exportMarkdown: () => window.api.bookmarks.exportMarkdown(),

  setPanelOpen: (open) => set({ panelOpen: open }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen }))
}))
