import { useEffect, useMemo, useRef, useState } from 'react'
import { applyFilters, useLogsStore } from '@renderer/store/logs'
import { useSourcesStore } from '@renderer/store/sources'
import { useTerminalStore } from '@renderer/store/terminal'
import { LogRow } from './LogRow'

export function LogViewer(): JSX.Element {
  const {
    lines,
    filters,
    levelFilter,
    instruction,
    append,
    selected,
    toggleSelect,
    clearSelection,
    setInstruction
  } = useLogsStore()
  const { setError } = useSourcesStore()
  const activeTerminalId = useTerminalStore((s) => s.activeId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [editingInstruction, setEditingInstruction] = useState(false)
  const [draftInstruction, setDraftInstruction] = useState(instruction)

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

  const visible = useMemo(
    () => lines.filter((l) => applyFilters(l, filters, levelFilter)),
    [lines, filters, levelFilter]
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [visible.length])

  async function sendSelectionToAi(): Promise<void> {
    if (!activeTerminalId || selected.size === 0) return
    const chosen = lines.filter((l) => selected.has(l.id)).map((l) => l.text)
    await window.api.aiBridge.send({
      terminalId: activeTerminalId,
      instruction,
      payload: chosen.join('\n')
    })
    clearSelection()
  }

  function commitInstruction(): void {
    setInstruction(draftInstruction)
    setEditingInstruction(false)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 border-b border-neutral-800 text-xs text-neutral-400 flex items-center gap-3 min-h-[32px]">
        <span className="shrink-0">{visible.length} lines</span>

        {selected.size > 0 && (
          <>
            <span className="text-neutral-300 shrink-0">{selected.size} selected</span>

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
              className="px-2 py-0.5 rounded bg-blue-600 text-white text-[11px] hover:bg-blue-500 disabled:opacity-40 shrink-0 transition-colors"
              disabled={!activeTerminalId}
              title={activeTerminalId ? 'Send to active terminal' : 'Open a terminal first'}
            >
              🤖 Ask AI
            </button>
          </>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto">
        {visible.map((line) => (
          <LogRow
            key={line.id}
            line={line}
            selected={selected.has(line.id)}
            onSelect={() => toggleSelect(line.id)}
          />
        ))}
      </div>
    </div>
  )
}
