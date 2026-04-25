import { create } from 'zustand'

interface UiState {
  /** increments → LogViewer enters instruction edit mode and focuses */
  focusInstructionTick: number
  /** increments → FilterPanel search input focuses */
  focusSearchTick: number
  /** increments → request to save current selection as bookmark */
  bookmarkTick: number
  requestFocusInstruction: () => void
  requestFocusSearch: () => void
  requestBookmark: () => void
}

export const useUiStore = create<UiState>((set) => ({
  focusInstructionTick: 0,
  focusSearchTick: 0,
  bookmarkTick: 0,
  requestFocusInstruction: () =>
    set((s) => ({ focusInstructionTick: s.focusInstructionTick + 1 })),
  requestFocusSearch: () =>
    set((s) => ({ focusSearchTick: s.focusSearchTick + 1 })),
  requestBookmark: () => set((s) => ({ bookmarkTick: s.bookmarkTick + 1 }))
}))
