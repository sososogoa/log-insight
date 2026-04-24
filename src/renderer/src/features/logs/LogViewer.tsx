import { useEffect, useMemo, useRef } from 'react'
import { applyFilters, useLogsStore } from '@renderer/store/logs'
import { useTerminalStore } from '@renderer/store/terminal'
import { LogRow } from './LogRow'

export function LogViewer(): JSX.Element {
  const { lines, filters, append, selected, toggleSelect, clearSelection } = useLogsStore()
  const activeTerminalId = useTerminalStore((s) => s.activeId)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const off = window.api.logs.onLine((line) => append(line))
    return off
  }, [append])

  const visible = useMemo(() => lines.filter((l) => applyFilters(l, filters)), [lines, filters])

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
      instruction: '다음 로그의 원인과 수정 방향을 분석해줘:',
      payload: chosen.join('\n')
    })
    clearSelection()
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 border-b border-neutral-800 text-xs text-neutral-400 flex items-center gap-3">
        <span>{visible.length} lines</span>
        {selected.size > 0 && (
          <>
            <span className="text-neutral-300">{selected.size} selected</span>
            <button
              onClick={sendSelectionToAi}
              className="px-2 py-0.5 rounded bg-blue-600 text-white text-[11px] hover:bg-blue-500"
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
