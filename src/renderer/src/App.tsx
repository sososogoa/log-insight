import { useEffect, useState } from 'react'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
import type { PanelSize } from 'react-resizable-panels'
import { ServerTree } from './features/servers/ServerTree'
import { LogViewer } from './features/logs/LogViewer'
import { TerminalPane } from './features/terminal/TerminalPane'
import { FilterPanel } from './features/logs/FilterPanel'
import { AiBridgeStatus } from './features/ai-bridge/AiBridgeStatus'
import { useTerminalStore } from './store/terminal'

export default function App(): JSX.Element {
  const serverRef = usePanelRef()
  const filterRef = usePanelRef()
  const terminalRef = usePanelRef()
  const [serverCollapsed, setServerCollapsed] = useState(false)
  const [filterCollapsed, setFilterCollapsed] = useState(false)
  const [terminalCollapsed, setTerminalCollapsed] = useState(false)
  const expandCount = useTerminalStore((s) => s.expandCount)

  useEffect(() => {
    if (expandCount === 0) return
    terminalRef.current?.expand()
    setTerminalCollapsed(false)
  }, [expandCount, terminalRef])

  function onServerResize(size: PanelSize): void {
    setServerCollapsed(size.asPercentage === 0)
  }
  function onFilterResize(size: PanelSize): void {
    setFilterCollapsed(size.asPercentage === 0)
  }
  function onTerminalResize(size: PanelSize): void {
    setTerminalCollapsed(size.asPercentage === 0)
  }

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      <header className="drag-region h-9 shrink-0 border-b border-neutral-800 pl-[76px] pr-3 flex items-center justify-between text-xs text-neutral-400">
        <span className="font-semibold text-neutral-200">LogInsight</span>
        <span className="no-drag">
          <AiBridgeStatus />
        </span>
      </header>

      <div className="flex-1 overflow-hidden">
        <Group orientation="vertical" style={{ height: '100%' }}>
          <Panel defaultSize="62" minSize="20">
            <Group orientation="horizontal" style={{ height: '100%' }}>
              <Panel
                panelRef={serverRef}
                defaultSize="20"
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

              <Separator
                className="w-1 bg-transparent data-[separator]:hover:bg-blue-500/30 transition-colors cursor-col-resize"
              />

              <Panel defaultSize="60" minSize="25">
                <LogViewer />
              </Panel>

              <Separator
                className="w-1 bg-transparent data-[separator]:hover:bg-blue-500/30 transition-colors cursor-col-resize"
              />

              <Panel
                panelRef={filterRef}
                defaultSize="20"
                minSize="12"
                maxSize="40"
                collapsible
                collapsedSize="0"
                onResize={onFilterResize}
              >
                <div className="h-full border-l border-neutral-800 overflow-hidden">
                  <FilterPanel />
                </div>
              </Panel>
            </Group>
          </Panel>

          <Separator
            className="h-1 bg-transparent data-[separator]:hover:bg-blue-500/30 transition-colors cursor-row-resize"
          />

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

      <footer className="h-6 shrink-0 border-t border-neutral-800 px-3 text-[11px] text-neutral-600 flex items-center gap-4">
        <button
          onClick={() =>
            serverCollapsed ? serverRef.current?.expand() : serverRef.current?.collapse()
          }
          className="hover:text-neutral-300 transition-colors"
        >
          {serverCollapsed ? '▸ Servers' : '◂ Servers'}
        </button>
        <button
          onClick={() =>
            filterCollapsed ? filterRef.current?.expand() : filterRef.current?.collapse()
          }
          className="hover:text-neutral-300 transition-colors"
        >
          {filterCollapsed ? '◂ Filters' : '▸ Filters'}
        </button>
        <button
          onClick={() =>
            terminalCollapsed ? terminalRef.current?.expand() : terminalRef.current?.collapse()
          }
          className="hover:text-neutral-300 transition-colors"
        >
          {terminalCollapsed ? '▲ Terminal' : '▼ Terminal'}
        </button>
        <span className="ml-auto">Ready</span>
      </footer>
    </div>
  )
}
