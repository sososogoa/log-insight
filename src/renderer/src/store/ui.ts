import { create } from 'zustand'

interface UiState {
  /** increments → LogViewer 가 instruction 편집 모드 진입 + 포커스 */
  focusInstructionTick: number
  /** increments → FilterPanel 검색 인풋 포커스 */
  focusSearchTick: number
  /** increments → 현재 선택을 북마크로 저장 요청 */
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
