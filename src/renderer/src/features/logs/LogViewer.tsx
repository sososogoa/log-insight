import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { applyFilters, useLogsStore } from '@renderer/store/logs'
import { useSourcesStore } from '@renderer/store/sources'
import { useTerminalStore } from '@renderer/store/terminal'
import { LogRow } from './LogRow'

function isNearBottom(el: HTMLDivElement, threshold = 60): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

export function LogViewer(): JSX.Element {
  const {
    lines,
    filters,
    levelFilter,
    instruction,
    append,
    selected,
    toggleSelect,
    selectRange,
    clearSelection,
    setInstruction
  } = useLogsStore()
  const anchorIdRef = useRef<string | null>(null)
  const { setError } = useSourcesStore()
  const activeTerminalId = useTerminalStore((s) => s.activeId)
  const requestExpand = useTerminalStore((s) => s.requestExpand)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const [editingInstruction, setEditingInstruction] = useState(false)
  const [draftInstruction, setDraftInstruction] = useState(instruction)
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const offLine = window.api.logs.onLine((line) => append(line))
    const offError = window.api.logs.onError(({ sourceId, message }) =>
      setError(sourceId, message)
    )
    return () => {
      offLine()
      offError()
    }
  }, [append, setError])

  useEffect(() => {
    if (selected.size === 0) return
    function onKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        const text = lines
          .filter((l) => selected.has(l.id))
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
  }, [selected, lines])

  const visible = useMemo(
    () => lines.filter((l) => applyFilters(l, filters, levelFilter)),
    [lines, filters, levelFilter]
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !autoScrollRef.current || selected.size > 0) return
    el.scrollTop = el.scrollHeight
  }, [visible.length, selected.size])

  function handleScroll(): void {
    const el = scrollRef.current
    if (!el) return
    autoScrollRef.current = isNearBottom(el)
  }

  function handleRowClick(id: string, e: React.MouseEvent): void {
    if (e.shiftKey && anchorIdRef.current !== null) {
      const anchorIdx = visible.findIndex((l) => l.id === anchorIdRef.current)
      const currentIdx = visible.findIndex((l) => l.id === id)
      if (anchorIdx !== -1 && currentIdx !== -1) {
        const [from, to] =
          anchorIdx <= currentIdx ? [anchorIdx, currentIdx] : [currentIdx, anchorIdx]
        selectRange(visible.slice(from, to + 1).map((l) => l.id))
        return
      }
    }
    anchorIdRef.current = id
    toggleSelect(id)
  }

  async function sendSelectionToAi(): Promise<void> {
    if (!activeTerminalId || selected.size === 0) return
    const chosen = lines.filter((l) => selected.has(l.id)).map((l) => l.text)
    await window.api.aiBridge.send({
      terminalId: activeTerminalId,
      instruction,
      payload: chosen.join('\n')
    })
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
          <span className="text-neutral-700 text-[11px] truncate select-none">
            라인 클릭으로 선택 · Shift+클릭 범위 선택 → Ask AI
          </span>
        )}

        {selected.size > 0 && (
          <>
            <span className="text-neutral-300 shrink-0">{selected.size} selected</span>

            <button
              onClick={() => {
                const text = lines
                  .filter((l) => selected.has(l.id))
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
          </>
        )}
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-auto">
        {visible.map((line) => (
          <LogRow
            key={line.id}
            line={line}
            selected={selected.has(line.id)}
            onSelect={(e) => handleRowClick(line.id, e)}
          />
        ))}
      </div>
    </div>
  )
}
