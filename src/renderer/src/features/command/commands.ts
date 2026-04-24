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
    title: '🤖 선택한 로그를 AI에 보내기',
    subtitle: hasSelection
      ? `${active!.selected.size}개 라인 · 활성 캔버스(${active!.title})`
      : '먼저 로그를 선택하세요',
    group: 'AI',
    shortcut: '⌘⏎',
    disabled: !hasSelection || !hasActiveTerminal,
    disabledReason: !hasSelection
      ? '선택된 로그가 없습니다'
      : '활성 터미널이 없습니다',
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
    title: '✏️  AI 프롬프트 편집',
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
      title: `▶  ${server.name} 연결`,
      subtitle: server.logPath
        ? `${server.username}@${server.host} · ${server.logPath}`
        : `${server.username}@${server.host} · 로그 경로 필요`,
      group: 'Server',
      keywords: `${server.host} ${server.env ?? ''} connect`,
      disabled: !server.logPath,
      disabledReason: '이 서버의 기본 로그 경로가 설정되지 않았습니다',
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
        title: `■  ${server.name} · ${src.path} 연결 해제`,
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
      title: `◎  ${c.title} 로 이동`,
      group: 'Canvas',
      keywords: 'canvas focus switch',
      run: () => useCanvasesStore.getState().setActive(c.id)
    })
  }
  if (active) {
    cmds.push({
      id: 'canvas.minimize',
      title: active.minimized ? '◻ 현재 캔버스 복원' : '_ 현재 캔버스 최소화',
      group: 'Canvas',
      run: () => useCanvasesStore.getState().toggleMinimize(active.id)
    })
    cmds.push({
      id: 'canvas.maximize',
      title:
        canvasesState.maximizedId === active.id
          ? '◱ 최대화 해제'
          : '◻ 현재 캔버스 최대화',
      group: 'Canvas',
      run: () => useCanvasesStore.getState().toggleMaximize(active.id)
    })
    cmds.push({
      id: 'canvas.close',
      title: '× 현재 캔버스 닫기',
      group: 'Canvas',
      run: () => useCanvasesStore.getState().close(active.id)
    })
  }

  for (const { level, label } of LEVELS) {
    const a = active
    const isOn = a?.levelFilter.has(level) ?? false
    cmds.push({
      id: `filter.level.${level}`,
      title: `레벨 필터: ${label} ${isOn ? '끄기' : '켜기'}`,
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
    title: '에러만 보기',
    subtitle: '활성 캔버스에서 다른 레벨 해제 후 ERROR 만 ON',
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
    title: '레벨 필터 모두 해제',
    group: 'Filter',
    disabled: !active,
    run: () => {
      const s = useCanvasesStore.getState()
      if (s.activeId) s.clearLevels(s.activeId)
    }
  })
  cmds.push({
    id: 'filter.focus-search',
    title: '🔍  로그 키워드 필터로 포커스',
    group: 'Filter',
    shortcut: '⌘F',
    run: () => ctx.focusLogSearch()
  })

  cmds.push({
    id: 'view.toggle-grouping',
    title: active?.grouping
      ? '⊜ 반복 패턴 그루핑 끄기'
      : '⊜ 반복 패턴 그루핑 켜기',
    subtitle: '활성 캔버스에만 적용',
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
      title: '⊙ Focus 해제',
      subtitle: '모든 패턴 다시 보기',
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
      title: '⟲ Trace 해제',
      subtitle: `현재: ${logsState.traceFilter}`,
      group: 'View',
      shortcut: 'Esc',
      run: () => useLogsStore.getState().setTraceFilter(null)
    })
  }

  cmds.push({
    id: 'session.clear-selection',
    title: '선택 해제',
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
    title: '모든 로그 버퍼 비우기',
    subtitle: '화면에서 지우기 · 소스 연결은 유지',
    group: 'Session',
    run: () => useLogsStore.getState().clear()
  })

  cmds.push({
    id: 'terminal.new',
    title: '새 터미널 열기',
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
      title: `터미널 전환: ${t.title}`,
      group: 'Terminal',
      run: () => useTerminalStore.getState().setActive(t.id)
    })
  }
  cmds.push({
    id: 'terminal.toggle',
    title: '터미널 패널 토글',
    group: 'View',
    run: () => ctx.togglePanel('terminal')
  })

  cmds.push({
    id: 'view.toggle-servers',
    title: 'Servers 패널 토글',
    group: 'View',
    run: () => ctx.togglePanel('servers')
  })
  cmds.push({
    id: 'view.toggle-overview',
    title: 'Overview 레일 토글',
    group: 'View',
    run: () => ctx.togglePanel('filters')
  })

  cmds.push({
    id: 'bookmark.save',
    title: '🔖 선택 라인 북마크로 저장',
    subtitle: hasSelection
      ? `${active!.selected.size} lines — 메모와 함께 저장`
      : '먼저 로그를 선택하세요',
    group: 'Bookmark',
    shortcut: '⌘B',
    disabled: !hasSelection,
    disabledReason: '선택된 로그가 없습니다',
    run: () => useUiStore.getState().requestBookmark()
  })
  cmds.push({
    id: 'bookmark.open',
    title: '🔖 북마크 목록 열기',
    group: 'Bookmark',
    run: () => useBookmarksStore.getState().setPanelOpen(true)
  })
  cmds.push({
    id: 'bookmark.export',
    title: '↑ 북마크를 Markdown 리포트로 내보내기',
    subtitle: '인시던트 정리 · 공유용',
    group: 'Bookmark',
    run: async () => {
      await useBookmarksStore.getState().exportMarkdown()
    }
  })

  return cmds
}
