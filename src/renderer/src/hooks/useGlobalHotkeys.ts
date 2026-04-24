import { useEffect } from 'react'
import { useCommandStore } from '@renderer/store/command'
import { useLogsStore } from '@renderer/store/logs'
import { useUiStore } from '@renderer/store/ui'
import { useBookmarksStore } from '@renderer/store/bookmarks'
import { useCanvasesStore } from '@renderer/store/canvases'

export interface HotkeyCallbacks {
  focusInstruction: () => void
  focusLogSearch: () => void
}

// ⌘K is owned by the native app menu (see main/menu.ts).
// ⌘/   AI 프롬프트 포커스 · ⌘F 필터 검색 · ⌘⇧E 에러만 · ⌘⇧G 그루핑
// ⌘B   선택 → 북마크 / 없으면 패널 토글
// Esc  선택 → Focus → TraceFilter 순 해제
export function useGlobalHotkeys(cb: HotkeyCallbacks): void {
  useEffect(() => {
    const offMenu = window.api.menu.onCommandPalette(() =>
      useCommandStore.getState().toggle()
    )
    function onKey(e: KeyboardEvent): void {
      const mod = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement | null
      const inEditable =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)

      // ⌘/ — instruction 포커스
      if (mod && !e.shiftKey && e.key === '/') {
        e.preventDefault()
        cb.focusInstruction()
        return
      }

      // ⌘F — 로그 검색 포커스
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'f' && !inEditable) {
        e.preventDefault()
        cb.focusLogSearch()
        return
      }

      // ⌘⇧E — 활성 캔버스에서 에러만 보기
      if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        const c = useCanvasesStore.getState()
        if (!c.activeId) return
        const a = c.byId[c.activeId]
        if (!a) return
        const onlyError = a.levelFilter.size === 1 && a.levelFilter.has('error')
        c.clearLevels(c.activeId)
        if (!onlyError) c.toggleLevel(c.activeId, 'error')
        return
      }

      // ⌘⇧G — 활성 캔버스 그루핑 토글
      if (mod && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        const c = useCanvasesStore.getState()
        if (c.activeId) c.toggleGrouping(c.activeId)
        return
      }

      // ⌘B — 북마크
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'b' && !inEditable) {
        e.preventDefault()
        const c = useCanvasesStore.getState()
        const a = c.byId[c.activeId]
        if (!a || a.selected.size === 0) {
          useBookmarksStore.getState().togglePanel()
        } else {
          useUiStore.getState().requestBookmark()
        }
        return
      }

      // Esc — 선택/Focus/Trace 순차 해제
      if (e.key === 'Escape' && !inEditable) {
        const cmd = useCommandStore.getState()
        if (cmd.open) return
        const c = useCanvasesStore.getState()
        const a = c.byId[c.activeId]
        if (a?.selected.size) {
          e.preventDefault()
          c.clearSelection(c.activeId)
          return
        }
        if (a?.focusFingerprint) {
          e.preventDefault()
          c.setFocusFingerprint(c.activeId, null)
          return
        }
        const logs = useLogsStore.getState()
        if (logs.traceFilter) {
          e.preventDefault()
          logs.setTraceFilter(null)
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      offMenu()
    }
  }, [cb])
}
