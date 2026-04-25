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
// ⌘/   focus AI prompt · ⌘F focus log search · ⌘⇧E errors only · ⌘⇧G grouping
// ⌘B   selection → bookmark / toggle panel if nothing selected
// Esc  clear in order: selection → Focus → TraceFilter
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

      // ⌘/ — focus instruction
      if (mod && !e.shiftKey && e.key === '/') {
        e.preventDefault()
        cb.focusInstruction()
        return
      }

      // ⌘F — focus log search
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'f' && !inEditable) {
        e.preventDefault()
        cb.focusLogSearch()
        return
      }

      // ⌘⇧E — show errors only in active canvas
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

      // ⌘⇧G — toggle grouping in active canvas
      if (mod && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        const c = useCanvasesStore.getState()
        if (c.activeId) c.toggleGrouping(c.activeId)
        return
      }

      // ⌘B — bookmark
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

      // Esc — clear selection/Focus/Trace in order
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
