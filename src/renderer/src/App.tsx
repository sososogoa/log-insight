import { useCallback, useEffect, useMemo, useState } from 'react'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
import type { PanelSize } from 'react-resizable-panels'
import { ServerTree } from './features/servers/ServerTree'
import { CanvasHost } from './features/canvas/CanvasHost'
import { OverviewRail } from './features/overview/OverviewRail'
import { TerminalPane } from './features/terminal/TerminalPane'
import { CommandPalette } from './features/command/CommandPalette'
import { IncidentToast } from './features/incident/IncidentToast'
import { BookmarksPanel } from './features/bookmarks/BookmarksPanel'
import { useTerminalStore } from './store/terminal'
import { useUiStore } from './store/ui'
import { useBookmarksStore } from './store/bookmarks'
import { useGlobalHotkeys } from './hooks/useGlobalHotkeys'
import { useIncidentDetection } from './hooks/useIncidentDetection'
import { useGlobalLogIngest } from './hooks/useGlobalLogIngest'

export default function App(): JSX.Element {
  const serverRef = usePanelRef()
  const overviewRef = usePanelRef()
  const terminalRef = usePanelRef()
  const [serverCollapsed, setServerCollapsed] = useState(false)
  const [overviewCollapsed, setOverviewCollapsed] = useState(false)
  const [terminalCollapsed, setTerminalCollapsed] = useState(false)
  const expandCount = useTerminalStore((s) => s.expandCount)
  const requestFocusInstruction = useUiStore((s) => s.requestFocusInstruction)
  const requestFocusSearch = useUiStore((s) => s.requestFocusSearch)
  const bookmarksCount = useBookmarksStore((s) => s.list.length)
  const toggleBookmarks = useBookmarksStore((s) => s.togglePanel)
  const loadBookmarks = useBookmarksStore((s) => s.load)
  const bookmarksLoaded = useBookmarksStore((s) => s.loaded)

  useGlobalLogIngest()

  useEffect(() => {
    if (expandCount === 0) return
    terminalRef.current?.expand()
    setTerminalCollapsed(false)
  }, [expandCount, terminalRef])

  useEffect(() => {
    if (!bookmarksLoaded) void loadBookmarks()
  }, [bookmarksLoaded, loadBookmarks])

  function onServerResize(size: PanelSize): void {
    setServerCollapsed(size.asPercentage === 0)
  }
  function onOverviewResize(size: PanelSize): void {
    setOverviewCollapsed(size.asPercentage === 0)
  }
  function onTerminalResize(size: PanelSize): void {
    setTerminalCollapsed(size.asPercentage === 0)
  }

  const togglePanel = useCallback(
    (id: 'servers' | 'overview' | 'terminal') => {
      if (id === 'servers') {
        serverCollapsed ? serverRef.current?.expand() : serverRef.current?.collapse()
      } else if (id === 'overview') {
        overviewCollapsed
          ? overviewRef.current?.expand()
          : overviewRef.current?.collapse()
      } else {
        terminalCollapsed
          ? terminalRef.current?.expand()
          : terminalRef.current?.collapse()
      }
    },
    [
      serverCollapsed,
      overviewCollapsed,
      terminalCollapsed,
      serverRef,
      overviewRef,
      terminalRef
    ]
  )

  const focusLogSearch = useCallback((): void => {
    if (overviewCollapsed) overviewRef.current?.expand()
    requestFocusSearch()
  }, [overviewCollapsed, overviewRef, requestFocusSearch])

  const hotkeyCb = useMemo(
    () => ({
      focusInstruction: requestFocusInstruction,
      focusLogSearch
    }),
    [requestFocusInstruction, focusLogSearch]
  )
  useGlobalHotkeys(hotkeyCb)
  useIncidentDetection()

  const paletteCtx = useMemo(
    () => ({
      togglePanel: (id: 'servers' | 'filters' | 'terminal') =>
        togglePanel(id === 'filters' ? 'overview' : id),
      focusInstruction: requestFocusInstruction,
      focusLogSearch
    }),
    [togglePanel, requestFocusInstruction, focusLogSearch]
  )

  return (
    <div className="h-full flex flex-col bg-neutral-950 text-neutral-200">
      <header className="drag-region h-9 shrink-0 border-b border-neutral-800 pl-[76px] pr-3 flex items-center justify-between text-xs text-neutral-400">
        <span className="font-semibold text-neutral-200">LogInsight</span>
      </header>

      <div className="flex-1 overflow-hidden">
        <Group orientation="vertical" style={{ height: '100%' }}>
          <Panel defaultSize="62" minSize="20">
            <Group orientation="horizontal" style={{ height: '100%' }}>
              <Panel
                panelRef={serverRef}
                defaultSize="18"
                minSize="12"
                maxSize="40"
                collapsible
                collapsedSize="0"
                onResize={onServerResize}
              >
                <div className="h-full border-r border-neutral-800 overflow-hidden">
                  <ServerTree />
                </div>
              </Panel>

              <Separator className="w-1 bg-transparent data-[separator]:hover:bg-blue-500/30 transition-colors cursor-col-resize" />

              <Panel defaultSize="64" minSize="25">
                <CanvasHost />
              </Panel>

              <Separator className="w-1 bg-transparent data-[separator]:hover:bg-blue-500/30 transition-colors cursor-col-resize" />

              <Panel
                panelRef={overviewRef}
                defaultSize="18"
                minSize="12"
                maxSize="30"
                collapsible
                collapsedSize="0"
                onResize={onOverviewResize}
              >
                <div className="h-full overflow-hidden">
                  <OverviewRail />
                </div>
              </Panel>
            </Group>
          </Panel>

          <Separator className="h-1 bg-transparent data-[separator]:hover:bg-blue-500/30 transition-colors cursor-row-resize" />

          <Panel
            panelRef={terminalRef}
            defaultSize="38"
            minSize="8"
            collapsible
            collapsedSize="0"
            onResize={onTerminalResize}
          >
            <div className="h-full border-t border-neutral-800 overflow-hidden">
              <TerminalPane />
            </div>
          </Panel>
        </Group>
      </div>

      <footer className="h-6 shrink-0 border-t border-neutral-800 px-3 text-[11px] text-neutral-400 flex items-center gap-4">
        <button
          onClick={() => togglePanel('servers')}
          className="hover:text-neutral-300 transition-colors"
        >
          {serverCollapsed ? '▸ Servers' : '◂ Servers'}
        </button>
        <button
          onClick={() => togglePanel('overview')}
          className="hover:text-neutral-300 transition-colors"
        >
          {overviewCollapsed ? '◂ Overview' : '▸ Overview'}
        </button>
        <button
          onClick={() => togglePanel('terminal')}
          className="hover:text-neutral-300 transition-colors"
        >
          {terminalCollapsed ? '▲ Terminal' : '▼ Terminal'}
        </button>
        <button
          onClick={toggleBookmarks}
          className="hover:text-neutral-300 transition-colors"
          title="북마크 열기 (⌘B, 선택 없을 때)"
        >
          🔖 Bookmarks
          {bookmarksCount > 0 && (
            <span className="ml-1 text-neutral-500 tabular-nums">
              {bookmarksCount}
            </span>
          )}
        </button>
        <span className="ml-auto flex items-center gap-2">
          <kbd className="text-[10px] text-neutral-500 border border-neutral-700 rounded px-1 py-px">
            ⌘K
          </kbd>
          <span className="text-neutral-500">명령</span>
        </span>
      </footer>

      <CommandPalette ctx={paletteCtx} />
      <IncidentToast />
      <BookmarksPanel />
    </div>
  )
}
