import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { buildFilterPredicate, useLogsStore } from '@renderer/store/logs'
import { useSourcesStore, getSourceColor } from '@renderer/store/sources'
import { useServersStore } from '@renderer/store/servers'
import { useTerminalStore } from '@renderer/store/terminal'
import { useBookmarksStore } from '@renderer/store/bookmarks'
import { useUiStore } from '@renderer/store/ui'
import { useCanvasesStore } from '@renderer/store/canvases'
import { groupLines, type VisibleRow } from '../logs/groupLines'
import { previewFingerprint } from '../logs/patternFingerprint'
import { TimelineStrip } from '../logs/TimelineStrip'
import { LogRow } from '../logs/LogRow'
import {
  SlashCommandInput,
  type SlashCommandInputHandle
} from '../ai-bridge/SlashCommandInput'
import { CanvasToolbar } from './CanvasToolbar'
import type { LogLine } from '@shared/types'

const MAX_AI_LINES = 300

function isNearBottom(el: HTMLDivElement, threshold = 80): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

interface Props {
  canvasId: string
}

function CanvasInner({ canvasId }: Props): JSX.Element | null {
  const canvas = useCanvasesStore((s) => s.byId[canvasId])
  const sourceId = canvas?.sourceId ?? ''
  const sourceLines = useLogsStore((s) =>
    sourceId ? s.sourceLines[sourceId] ?? EMPTY : EMPTY
  )
  const globalInstruction = useLogsStore((s) => s.instruction)
  const traceFilter = useLogsStore((s) => s.traceFilter)
  const setTraceFilter = useLogsStore((s) => s.setTraceFilter)

  const sources = useSourcesStore((s) => s.sources)
  const serversList = useServersStore((s) => s.servers)
  const activeTerminalId = useTerminalStore((s) => s.activeId)
  const requestExpandTerm = useTerminalStore((s) => s.requestExpand)
  const saveBookmark = useBookmarksStore((s) => s.save)
  const openBookmarksPanel = useBookmarksStore((s) => s.setPanelOpen)

  const instruction = canvas?.customInstruction ?? globalInstruction

  const scrollRef = useRef<HTMLDivElement>(null)
  const instructionInputRef = useRef<SlashCommandInputHandle>(null)
  const autoScrollRef = useRef(true)

  const [editingInstruction, setEditingInstruction] = useState(false)
  const [draftInstruction, setDraftInstruction] = useState(instruction)
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState('')

  const anchorIdRef = useRef<string | null>(null)

  const isActive = useCanvasesStore((s) => s.activeId === canvasId)
  const focusInstructionTick = useUiStore((s) => s.focusInstructionTick)
  const bookmarkTick = useUiStore((s) => s.bookmarkTick)

  // subscribe only to selected to narrow selector scope
  const selected = useCanvasesStore(
    (s) => s.byId[canvasId]?.selected ?? EMPTY_SET
  )
  const linesRef = useRef(sourceLines)
  linesRef.current = sourceLines
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  // ⌘C — copy only from active canvas (inactive canvases return early even with listener)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (!isActive) return
      const sel = selectedRef.current
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && sel.size > 0) {
        const ls = linesRef.current
        const text = ls
          .filter((l) => sel.has(l.id))
          .map((l) => l.text)
          .join('\n')
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isActive])

  const sourceColorMap = useMemo(() => {
    const m = new Map<string, string>()
    sources.forEach((s, i) => m.set(s.sourceId, getSourceColor(i)))
    return m
  }, [sources])

  const sourceMap = useMemo(() => {
    const m = new Map<string, (typeof sources)[number]>()
    for (const s of sources) m.set(s.sourceId, s)
    return m
  }, [sources])

  const predicate = useMemo(
    () => (canvas ? buildFilterPredicate(canvas.filters) : () => true),
    [canvas?.filters]
  )

  const filtered = useMemo(() => {
    if (!canvas) return EMPTY
    const levelFilter = canvas.levelFilter
    const base = sourceLines.filter((l) => predicate(l, levelFilter))
    if (!traceFilter) return base
    return base.filter((l) => l.text.includes(traceFilter))
  }, [sourceLines, predicate, canvas?.levelFilter, traceFilter])

  const { rows, fingerprintCounts } = useMemo(() => {
    if (!canvas) return { rows: [] as VisibleRow[], fingerprintCounts: new Map() }
    if (canvas.focusFingerprint) {
      const g = groupLines(filtered, {
        enabled: false,
        expandedGroups: new Set()
      })
      const onlyFocus = g.rows.filter(
        (r): r is Extract<VisibleRow, { kind: 'single' }> =>
          r.kind === 'single' && r.fingerprint === canvas.focusFingerprint
      )
      const counts = new Map<string, number>()
      counts.set(canvas.focusFingerprint, onlyFocus.length)
      return { rows: onlyFocus as VisibleRow[], fingerprintCounts: counts }
    }
    return groupLines(filtered, {
      enabled: canvas.grouping,
      expandedGroups: canvas.expandedGroups
    })
  }, [filtered, canvas?.grouping, canvas?.focusFingerprint, canvas?.expandedGroups])

  // use estimate mode to reduce measureElement overhead when there are many sources
  const heavyMode = sources.length >= 4

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 22,
    overscan: heavyMode ? 8 : 15
  })

  useEffect(() => {
    if (!autoScrollRef.current || selected.size > 0 || rows.length === 0) return
    virtualizer.scrollToIndex(rows.length - 1, { align: 'end' })
  }, [rows.length, selected.size, virtualizer])

  // ⌘/ request — respond only from active canvas
  useEffect(() => {
    if (focusInstructionTick === 0 || !isActive) return
    if (selectedRef.current.size === 0) return
    setDraftInstruction(instruction)
    setEditingInstruction(true)
    requestAnimationFrame(() => instructionInputRef.current?.focus())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusInstructionTick])

  // ⌘B request — respond only from active canvas
  useEffect(() => {
    if (bookmarkTick === 0 || !isActive) return
    void bookmarkSelection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarkTick])

  function handleScroll(): void {
    const el = scrollRef.current
    if (!el) return
    autoScrollRef.current = isNearBottom(el)
  }

  const makeCodeJumpHandler = useCallback(
    (sourceId: string) => {
      return async (loc: {
        path: string
        line: number
        column?: number
      }): Promise<void> => {
        let abs = loc.path
        if (!abs.startsWith('/') && !/^[A-Za-z]:/.test(abs)) {
          const src = sourceMap.get(sourceId)
          const server = src
            ? serversList.find((p) => p.id === src.serverId)
            : undefined
          if (server?.localProjectPath) {
            const root = server.localProjectPath.replace(/\/+$/, '')
            const clean = abs.replace(/^\.?\.?\//, '')
            abs = `${root}/${clean}`
          }
        }
        await window.api.shell.openInEditor({
          path: abs,
          line: loc.line,
          column: loc.column
        })
      }
    },
    [sourceMap, serversList]
  )

  const filteredToRowIdx = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r, i) => {
      m.set(r.line.id, i)
      if (r.kind === 'group') for (const id of r.ids) m.set(id, i)
    })
    return m
  }, [rows])

  const handleSeek = useCallback(
    (filteredIdx: number) => {
      const line = filtered[filteredIdx]
      if (!line) return
      const rowIdx = filteredToRowIdx.get(line.id)
      if (rowIdx === undefined) return
      autoScrollRef.current = false
      virtualizer.scrollToIndex(rowIdx, { align: 'center' })
    },
    [filtered, filteredToRowIdx, virtualizer]
  )

  const handleRowClick = useCallback(
    (row: VisibleRow, e: React.MouseEvent): void => {
      if (!canvas) return
      const targetId = row.line.id
      const s = useCanvasesStore.getState()
      if (e.shiftKey && anchorIdRef.current !== null) {
        const src = linesRef.current.filter((l) =>
          predicate(l, canvas.levelFilter)
        )
        const anchorIdx = src.findIndex(
          (l) => l.id === anchorIdRef.current
        )
        const currentIdx = src.findIndex((l) => l.id === targetId)
        if (anchorIdx !== -1 && currentIdx !== -1) {
          const [from, to] =
            anchorIdx <= currentIdx
              ? [anchorIdx, currentIdx]
              : [currentIdx, anchorIdx]
          s.selectRange(
            canvasId,
            src.slice(from, to + 1).map((l) => l.id)
          )
          return
        }
      }
      anchorIdRef.current = targetId

      if (row.kind === 'group') {
        const allSelected = row.ids.every((id) => selectedRef.current.has(id))
        if (allSelected) {
          const next = new Set(selectedRef.current)
          row.ids.forEach((id) => next.delete(id))
          s.setSelection(canvasId, next)
        } else {
          s.selectRange(canvasId, row.ids)
        }
      } else {
        s.toggleSelect(canvasId, targetId)
      }
    },
    [canvas, canvasId, predicate]
  )

  async function sendSelectionToAi(): Promise<void> {
    if (!canvas || !activeTerminalId || selected.size === 0) return
    const chosen = linesRef.current
      .filter((l) => selected.has(l.id))
      .map((l) => l.text)
    if (chosen.length > MAX_AI_LINES) {
      const ok = window.confirm(
        `Sending ${chosen.length} lines (only the first ${MAX_AI_LINES} will be used). Continue?`
      )
      if (!ok) return
    }
    const payload = chosen.slice(0, MAX_AI_LINES).join('\n')
    const result = await window.api.aiBridge.send({
      terminalId: activeTerminalId,
      instruction,
      payload
    })
    if (!result.ok) {
      setSendError('Send failed: terminal session not found')
      setTimeout(() => setSendError(''), 3000)
      return
    }
    useCanvasesStore.getState().clearSelection(canvasId)
    requestExpandTerm()
    setSent(true)
    setTimeout(() => setSent(false), 2000)
  }

  function commitInstruction(): void {
    if (!canvas) return
    useCanvasesStore.getState().setCustomInstruction(canvasId, draftInstruction)
    setEditingInstruction(false)
  }

  async function bookmarkSelection(): Promise<void> {
    if (!canvas || selected.size === 0) return
    const chosen = linesRef.current.filter((l) => selected.has(l.id))
    if (chosen.length === 0) return
    const bookmark = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      lines: chosen.map((l) => {
        const src = sourceMap.get(l.sourceId)
        return {
          text: l.text,
          level: l.level,
          timestamp: l.timestamp,
          sourceLabel: src ? `${src.serverName}:${src.path}` : undefined
        }
      })
    }
    await saveBookmark(bookmark)
    useCanvasesStore.getState().clearSelection(canvasId)
    openBookmarksPanel(true)
    useBookmarksStore.setState({ focusNoteId: bookmark.id })
  }

  if (!canvas) return null

  const uniquePatterns = fingerprintCounts.size
  const focusCount = canvas.focusFingerprint
    ? fingerprintCounts.get(canvas.focusFingerprint) ?? 0
    : 0

  return (
    <div className="h-full flex flex-col bg-neutral-950" data-canvas-id={canvasId}>
      <CanvasToolbar
        canvas={canvas}
        rowCount={rows.length}
        filteredCount={filtered.length}
        uniquePatterns={uniquePatterns}
      />

      {/* Selection action bar */}
      {selected.size > 0 && (
        <div className="px-2 py-1 border-b border-neutral-800 flex items-center gap-2 text-[11px] bg-blue-950/20">
          <span className="text-neutral-300 shrink-0 tabular-nums">
            {selected.size} selected
          </span>

          <button
            onClick={() => {
              const text = linesRef.current
                .filter((l) => selectedRef.current.has(l.id))
                .map((l) => l.text)
                .join('\n')
              void navigator.clipboard.writeText(text).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              })
            }}
            className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 shrink-0"
            title="Copy (⌘C)"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>

          <button
            onClick={() => void bookmarkSelection()}
            className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 shrink-0"
            title="Save bookmark (⌘B)"
          >
            🔖
          </button>

          {editingInstruction ? (
            <SlashCommandInput
              ref={instructionInputRef}
              value={draftInstruction}
              onChange={setDraftInstruction}
              onCommit={commitInstruction}
              onCancel={() => {
                setDraftInstruction(instruction)
                setEditingInstruction(false)
              }}
              placeholder="instruction · / for templates"
            />
          ) : (
            <button
              onClick={() => {
                setDraftInstruction(instruction)
                setEditingInstruction(true)
              }}
              className="flex-1 text-left text-neutral-500 hover:text-neutral-300 truncate"
              title="Click to edit · type / for templates"
            >
              {instruction}
            </button>
          )}

          {sendError ? (
            <span className="text-red-400 shrink-0">{sendError}</span>
          ) : (
            <button
              onClick={() => void sendSelectionToAi()}
              className={`px-2 py-0.5 rounded shrink-0 transition-colors ${
                sent
                  ? 'bg-green-700/60 text-green-300'
                  : 'bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40'
              }`}
              disabled={!activeTerminalId}
              title={
                !activeTerminalId
                  ? 'Open a terminal first'
                  : 'Inject selected logs into AI'
              }
            >
              {sent ? 'Sent ✓' : '🤖 Ask AI'}
            </button>
          )}
        </div>
      )}

      {canvas.focusFingerprint && (
        <div className="px-2 py-1 border-b border-blue-500/30 bg-blue-950/30 flex items-center gap-2 text-[11px]">
          <span className="text-blue-300 shrink-0">● Focus</span>
          <code className="flex-1 truncate text-neutral-300">
            {previewFingerprint(canvas.focusFingerprint, 120)}
          </code>
          <span className="text-neutral-400 shrink-0 tabular-nums">
            {focusCount} matches
          </span>
          <button
            onClick={() =>
              useCanvasesStore.getState().setFocusFingerprint(canvasId, null)
            }
            className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {traceFilter && (
        <div className="px-2 py-1 border-b border-cyan-500/30 bg-cyan-950/30 flex items-center gap-2 text-[11px]">
          <span className="text-cyan-300 shrink-0">⟲ Trace</span>
          <code className="flex-1 truncate text-neutral-200 font-mono">
            {traceFilter}
          </code>
          <button
            onClick={() => setTraceFilter(null)}
            className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 shrink-0"
          >
            ×
          </button>
        </div>
      )}

      <TimelineStrip lines={filtered} onSeek={handleSeek} />

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto scrollbar-hidden"
      >
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((vItem) => {
            const row = rows[vItem.index]
            const selectedRow =
              row.kind === 'group'
                ? row.ids.every((id) => selected.has(id))
                : selected.has(row.line.id)
            return (
              <div
                key={
                  row.kind === 'group'
                    ? `g:${row.groupId}`
                    : row.kind === 'group-child'
                      ? `c:${row.line.id}`
                      : row.line.id
                }
                data-index={vItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vItem.start}px)`
                }}
              >
                <LogRow
                  line={row.line}
                  selected={selectedRow}
                  onSelect={(e) => handleRowClick(row, e)}
                  sourceColor={sourceColorMap.get(row.line.sourceId)}
                  onTraceClick={(v) => setTraceFilter(v)}
                  onCodeJump={makeCodeJumpHandler(row.line.sourceId)}
                  groupCount={row.kind === 'group' ? row.count : undefined}
                  groupExpanded={
                    row.kind === 'group'
                      ? canvas.expandedGroups.has(row.groupId)
                      : undefined
                  }
                  onToggleGroup={
                    row.kind === 'group'
                      ? (e) => {
                          e.stopPropagation()
                          useCanvasesStore
                            .getState()
                            .toggleGroupExpansion(canvasId, row.groupId)
                        }
                      : undefined
                  }
                  isGroupChild={row.kind === 'group-child'}
                  onFocusPattern={
                    !canvas.focusFingerprint
                      ? (e) => {
                          e.stopPropagation()
                          useCanvasesStore
                            .getState()
                            .setFocusFingerprint(canvasId, row.fingerprint)
                        }
                      : undefined
                  }
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const EMPTY: LogLine[] = []
const EMPTY_SET: Set<string> = new Set()

export const Canvas = memo(CanvasInner)
