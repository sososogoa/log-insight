import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { buildFilterPredicate, useLogsStore } from '@renderer/store/logs'
import { useSourcesStore } from '@renderer/store/sources'
import { useTerminalStore } from '@renderer/store/terminal'
import { LogRow } from './LogRow'

const MAX_AI_LINES = 300

function isNearBottom(el: HTMLDivElement, threshold = 80): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

export function LogViewer(): JSX.Element {
  const {
    lines,
    filters,
    levelFilter,
    instruction,
    appendBatch,
    selected,
    toggleSelect,
    selectRange,
    clearSelection,
    setInstruction
  } = useLogsStore()
  const anchorIdRef = useRef<string | null>(null)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const linesRef = useRef(lines)
  linesRef.current = lines

  const { setError } = useSourcesStore()
  const activeTerminalId = useTerminalStore((s) => s.activeId)
  const requestExpand = useTerminalStore((s) => s.requestExpand)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const [editingInstruction, setEditingInstruction] = useState(false)
  const [draftInstruction, setDraftInstruction] = useState(instruction)
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    const offBatch = window.api.logs.onLineBatch((batch) => appendBatch(batch))
    const offLine = window.api.logs.onLine((line) => appendBatch([line]))
    const offError = window.api.logs.onError(({ sourceId, message }) =>
      setError(sourceId, message)
    )
    return () => {
      offBatch()
      offLine()
      offError()
    }
  }, [appendBatch, setError])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const sel = selectedRef.current
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && sel.size > 0) {
        const ls = linesRef.current
        const text = ls.filter((l) => sel.has(l.id)).map((l) => l.text).join('\n')
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const predicate = useMemo(
    () => buildFilterPredicate(filters),
    [filters]
  )
  const visible = useMemo(
    () => lines.filter((l) => predicate(l, levelFilter)),
    [lines, predicate, levelFilter]
  )

  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 22,
    overscan: 15
  })

  useEffect(() => {
    if (!autoScrollRef.current || selected.size > 0 || visible.length === 0) return
    virtualizer.scrollToIndex(visible.length - 1, { align: 'end' })
  }, [visible.length, selected.size, virtualizer])

  function handleScroll(): void {
    const el = scrollRef.current
    if (!el) return
    autoScrollRef.current = isNearBottom(el)
  }

  const handleRowClick = useCallback((id: string, e: React.MouseEvent): void => {
    if (e.shiftKey && anchorIdRef.current !== null) {
      const visibleNow = linesRef.current
      const anchorIdx = visibleNow.findIndex((l) => l.id === anchorIdRef.current)
      const currentIdx = visibleNow.findIndex((l) => l.id === id)
      if (anchorIdx !== -1 && currentIdx !== -1) {
        const [from, to] =
          anchorIdx <= currentIdx ? [anchorIdx, currentIdx] : [currentIdx, anchorIdx]
        selectRange(visibleNow.slice(from, to + 1).map((l) => l.id))
        return
      }
    }
    anchorIdRef.current = id
    toggleSelect(id)
  }, [selectRange, toggleSelect])

  async function sendSelectionToAi(): Promise<void> {
    if (!activeTerminalId || selected.size === 0) return
    const chosen = linesRef.current.filter((l) => selected.has(l.id)).map((l) => l.text)
    if (chosen.length > MAX_AI_LINES) {
      const ok = window.confirm(`${chosen.length}개 라인을 전송합니다 (처음 ${MAX_AI_LINES}개만 사용). 계속할까요?`)
      if (!ok) return
    }
    const payload = chosen.slice(0, MAX_AI_LINES).join('\n')
    const result = await window.api.aiBridge.send({
      terminalId: activeTerminalId,
      instruction,
      payload
    })
    if (!result.ok) {
      setSendError('전송 실패: 터미널 세션을 찾을 수 없습니다')
      setTimeout(() => setSendError(''), 3000)
      return
    }
    clearSelection()
    requestExpand()
    setSent(true)
    setTimeout(() => setSent(false), 2000)
  }

  function commitInstruction(): void {
    setInstruction(draftInstruction)
    setEditingInstruction(false)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 border-b border-neutral-800 text-xs text-neutral-400 flex items-center gap-3 min-h-[32px]">
        <span className="shrink-0">{visible.length} lines</span>

        {selected.size === 0 && visible.length > 0 && (
          <span className="text-neutral-500 text-[11px] truncate select-none">
            라인 클릭으로 선택 · Shift+클릭 범위 선택 → Ask AI
          </span>
        )}

        {selected.size > 0 && (
          <>
            <span className="text-neutral-300 shrink-0">{selected.size} selected</span>

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
              className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[11px] hover:bg-neutral-700 shrink-0 transition-colors"
              title="Copy selected lines (⌘C)"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>

            {editingInstruction ? (
              <input
                autoFocus
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={draftInstruction}
                onChange={(e) => setDraftInstruction(e.target.value)}
                onBlur={commitInstruction}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitInstruction()
                  if (e.key === 'Escape') {
                    setDraftInstruction(instruction)
                    setEditingInstruction(false)
                  }
                }}
              />
            ) : (
              <button
                onClick={() => {
                  setDraftInstruction(instruction)
                  setEditingInstruction(true)
                }}
                className="flex-1 text-left text-neutral-500 hover:text-neutral-300 truncate text-[11px]"
                title="Click to edit instruction"
              >
                {instruction}
              </button>
            )}

            {sendError ? (
              <span className="text-[11px] text-red-400 shrink-0">{sendError}</span>
            ) : (
              <button
                onClick={sendSelectionToAi}
                className={`px-2 py-0.5 rounded text-[11px] shrink-0 transition-colors ${
                  sent
                    ? 'bg-green-700/60 text-green-300'
                    : 'bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40'
                }`}
                disabled={!activeTerminalId}
                title={
                  !activeTerminalId
                    ? '터미널 탭을 먼저 열어주세요'
                    : '터미널에서 claude (또는 다른 AI CLI)를 실행한 뒤 전송하세요'
                }
              >
                {sent ? '전송됨 ✓' : '🤖 Ask AI'}
              </button>
            )}
          </>
        )}
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-auto">
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((vItem) => {
            const line = visible[vItem.index]
            return (
              <div
                key={line.id}
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
                  line={line}
                  selected={selected.has(line.id)}
                  onSelect={(e) => handleRowClick(line.id, e)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
