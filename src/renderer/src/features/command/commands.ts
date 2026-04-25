import { useLogsStore } from '@renderer/store/logs'
import { useSourcesStore } from '@renderer/store/sources'
import { useServersStore } from '@renderer/store/servers'
import { useTerminalStore } from '@renderer/store/terminal'
import { useCanvasesStore } from '@renderer/store/canvases'
import { BUILTIN_TEMPLATES } from '@renderer/features/ai-bridge/templates'
import { useBookmarksStore } from '@renderer/store/bookmarks'
import { useUiStore } from '@renderer/store/ui'
import type { LogLevel } from '@shared/types'

export type CommandGroup =
  | 'AI'
  | 'Server'
  | 'Filter'
  | 'View'
  | 'Terminal'
  | 'Session'
  | 'Bookmark'
  | 'Canvas'

export interface CommandItem {
  id: string
  title: string
  subtitle?: string
  group: CommandGroup
  shortcut?: string
  keywords?: string
  disabled?: boolean
  disabledReason?: string
  run: () => void | Promise<void>
}

export interface CommandContext {
  togglePanel: (id: 'servers' | 'filters' | 'terminal') => void
  focusInstruction: () => void
  focusLogSearch: () => void
}

const LEVELS: { level: LogLevel; label: string }[] = [
  { level: 'error', label: 'ERROR' },
  { level: 'warn', label: 'WARN' },
  { level: 'info', label: 'INFO' },
  { level: 'debug', label: 'DEBUG' },
  { level: 'trace', label: 'TRACE' }
]

export function buildCommands(ctx: CommandContext): CommandItem[] {
  const logsState = useLogsStore.getState()
  const sourcesState = useSourcesStore.getState()
  const serversState = useServersStore.getState()
  const termState = useTerminalStore.getState()
  const canvasesState = useCanvasesStore.getState()

  const active = canvasesState.byId[canvasesState.activeId]
  const hasSelection = (active?.selected.size ?? 0) > 0
  const hasActiveTerminal = !!termState.activeId

  const cmds: CommandItem[] = []

  cmds.push({
    id: 'ai.send',
    title: '🤖 Send selected logs to AI',
    subtitle: hasSelection
      ? `${active!.selected.size} lines · active canvas (${active!.title})`
      : 'Select log lines first',
    group: 'AI',
    shortcut: '⌘⏎',
    disabled: !hasSelection || !hasActiveTerminal,
    disabledReason: !hasSelection
      ? 'No logs selected'
      : 'No active terminal',
    run: async () => {
      const c = useCanvasesStore.getState()
      const activeCanvas = c.byId[c.activeId]
      const t = useTerminalStore.getState()
      const logs = useLogsStore.getState()
      if (!activeCanvas || !t.activeId || activeCanvas.selected.size === 0) return
      const source = logs.sourceLines[activeCanvas.sourceId] ?? []
      const chosen = source
        .filter((l) => activeCanvas.selected.has(l.id))
        .map((l) => l.text)
      const payload = chosen.slice(0, 300).join('\n')
      const instruction = activeCanvas.customInstruction ?? logs.instruction
      await window.api.aiBridge.send({
        terminalId: t.activeId,
        instruction,
        payload
      })
      c.clearSelection(activeCanvas.id)
      t.requestExpand()
    }
  })

  cmds.push({
    id: 'ai.edit-instruction',
    title: '✏️  Edit AI prompt',
    subtitle: active?.customInstruction ?? logsState.instruction,
    group: 'AI',
    shortcut: '⌘/',
    run: () => ctx.focusInstruction()
  })

  for (const t of BUILTIN_TEMPLATES) {
    cmds.push({
      id: `ai.template.${t.slash}`,
      title: `${t.slash}  ${t.label}`,
      subtitle: t.prompt,
      group: 'AI',
      keywords: `template prompt ${t.slash}`,
      run: () => {
        useLogsStore.getState().setInstruction(t.prompt)
        const c = useCanvasesStore.getState()
        if (c.activeId)
          c.setCustomInstruction(c.activeId, t.prompt)
      }
    })
  }

  for (const server of serversState.servers) {
    const connected = sourcesState.sources.filter(
      (s) => s.serverId === server.id
    )
    cmds.push({
      id: `server.connect.${server.id}`,
      title: `▶  Connect ${server.name}`,
      subtitle: server.logPath
        ? `${server.username}@${server.host} · ${server.logPath}`
        : `${server.username}@${server.host} · log path required`,
      group: 'Server',
      keywords: `${server.host} ${server.env ?? ''} connect`,
      disabled: !server.logPath,
      disabledReason: 'Default log path not set for this server',
      run: () => {
        if (!server.logPath) return
        void useSourcesStore
          .getState()
          .subscribe(server, { kind: 'file', path: server.logPath })
      }
    })
    for (const src of connected) {
      cmds.push({
        id: `server.disconnect.${src.sourceId}`,
        title: `■  Disconnect ${server.name} · ${src.path}`,
        group: 'Server',
        keywords: 'disconnect stop unsubscribe',
        run: () => void useSourcesStore.getState().unsubscribe(src.sourceId)
      })
    }
  }

  for (const c of canvasesState.order.map((id) => canvasesState.byId[id])) {
    if (!c) continue
    if (c.id === canvasesState.activeId) continue
    cmds.push({
      id: `canvas.focus.${c.id}`,
      title: `◎  Go to ${c.title}`,
      group: 'Canvas',
      keywords: 'canvas focus switch',
      run: () => useCanvasesStore.getState().setActive(c.id)
    })
  }
  if (active) {
    cmds.push({
      id: 'canvas.minimize',
      title: active.minimized ? '◻ Restore current canvas' : '_ Minimize current canvas',
      group: 'Canvas',
      run: () => useCanvasesStore.getState().toggleMinimize(active.id)
    })
    cmds.push({
      id: 'canvas.maximize',
      title:
        canvasesState.maximizedId === active.id
          ? '◱ Unmaximize'
          : '◻ Maximize current canvas',
      group: 'Canvas',
      run: () => useCanvasesStore.getState().toggleMaximize(active.id)
    })
    cmds.push({
      id: 'canvas.close',
      title: '× Close current canvas',
      group: 'Canvas',
      run: () => useCanvasesStore.getState().close(active.id)
    })
  }

  for (const { level, label } of LEVELS) {
    const a = active
    const isOn = a?.levelFilter.has(level) ?? false
    cmds.push({
      id: `filter.level.${level}`,
      title: `Level filter: ${label} ${isOn ? 'off' : 'on'}`,
      group: 'Filter',
      keywords: `level ${level}`,
      disabled: !a,
      run: () => {
        const s = useCanvasesStore.getState()
        if (s.activeId) s.toggleLevel(s.activeId, level)
      }
    })
  }
  cmds.push({
    id: 'filter.only-errors',
    title: 'Errors only',
    subtitle: 'Disable all other levels and enable ERROR in active canvas',
    group: 'Filter',
    keywords: 'only errors error',
    disabled: !active,
    run: () => {
      const s = useCanvasesStore.getState()
      if (!s.activeId) return
      s.clearLevels(s.activeId)
      s.toggleLevel(s.activeId, 'error')
    }
  })
  cmds.push({
    id: 'filter.clear-levels',
    title: 'Clear all level filters',
    group: 'Filter',
    disabled: !active,
    run: () => {
      const s = useCanvasesStore.getState()
      if (s.activeId) s.clearLevels(s.activeId)
    }
  })
  cmds.push({
    id: 'filter.focus-search',
    title: '🔍  Focus log keyword filter',
    group: 'Filter',
    shortcut: '⌘F',
    run: () => ctx.focusLogSearch()
  })

  cmds.push({
    id: 'view.toggle-grouping',
    title: active?.grouping
      ? '⊜ Disable repeat pattern grouping'
      : '⊜ Enable repeat pattern grouping',
    subtitle: 'Applies to active canvas only',
    group: 'View',
    shortcut: '⌘⇧G',
    keywords: 'group grouping pattern dedupe',
    disabled: !active,
    run: () => {
      const s = useCanvasesStore.getState()
      if (s.activeId) s.toggleGrouping(s.activeId)
    }
  })
  if (active?.focusFingerprint) {
    cmds.push({
      id: 'view.clear-focus',
      title: '⊙ Clear Focus',
      subtitle: 'Show all patterns again',
      group: 'View',
      shortcut: 'Esc',
      run: () => {
        const s = useCanvasesStore.getState()
        if (s.activeId) s.setFocusFingerprint(s.activeId, null)
      }
    })
  }
  if (logsState.traceFilter) {
    cmds.push({
      id: 'view.clear-trace',
      title: '⟲ Clear Trace filter',
      subtitle: `Current: ${logsState.traceFilter}`,
      group: 'View',
      shortcut: 'Esc',
      run: () => useLogsStore.getState().setTraceFilter(null)
    })
  }

  cmds.push({
    id: 'session.clear-selection',
    title: 'Clear selection',
    group: 'Session',
    shortcut: 'Esc',
    disabled: !hasSelection,
    run: () => {
      const s = useCanvasesStore.getState()
      if (s.activeId) s.clearSelection(s.activeId)
    }
  })
  cmds.push({
    id: 'session.clear-logs',
    title: 'Clear all log buffers',
    subtitle: 'Clears the display · source connections remain active',
    group: 'Session',
    run: () => useLogsStore.getState().clear()
  })

  cmds.push({
    id: 'terminal.new',
    title: 'New terminal',
    group: 'Terminal',
    run: async () => {
      const s = await window.api.terminal.create()
      useTerminalStore.getState().add(s)
    }
  })
  for (const t of termState.sessions) {
    if (t.id === termState.activeId) continue
    cmds.push({
      id: `terminal.activate.${t.id}`,
      title: `Switch terminal: ${t.title}`,
      group: 'Terminal',
      run: () => useTerminalStore.getState().setActive(t.id)
    })
  }
  cmds.push({
    id: 'terminal.toggle',
    title: 'Toggle terminal panel',
    group: 'View',
    run: () => ctx.togglePanel('terminal')
  })

  cmds.push({
    id: 'view.toggle-servers',
    title: 'Toggle Servers panel',
    group: 'View',
    run: () => ctx.togglePanel('servers')
  })
  cmds.push({
    id: 'view.toggle-overview',
    title: 'Toggle Overview rail',
    group: 'View',
    run: () => ctx.togglePanel('filters')
  })

  cmds.push({
    id: 'bookmark.save',
    title: '🔖 Save selected lines as bookmark',
    subtitle: hasSelection
      ? `${active!.selected.size} lines — save with note`
      : 'Select log lines first',
    group: 'Bookmark',
    shortcut: '⌘B',
    disabled: !hasSelection,
    disabledReason: 'No logs selected',
    run: () => useUiStore.getState().requestBookmark()
  })
  cmds.push({
    id: 'bookmark.open',
    title: '🔖 Open bookmarks',
    group: 'Bookmark',
    run: () => useBookmarksStore.getState().setPanelOpen(true)
  })
  cmds.push({
    id: 'bookmark.export',
    title: '↑ Export bookmarks as Markdown report',
    subtitle: 'For incident summaries and sharing',
    group: 'Bookmark',
    run: async () => {
      await useBookmarksStore.getState().exportMarkdown()
    }
  })

  return cmds
}
