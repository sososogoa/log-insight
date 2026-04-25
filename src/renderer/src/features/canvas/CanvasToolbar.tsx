import { memo, useRef, useState } from 'react'
import { useCanvasesStore, type CanvasState } from '@renderer/store/canvases'
import type { FilterRule, LogLevel } from '@shared/types'

const LEVEL_CONFIG: { level: LogLevel; color: string; label: string }[] = [
  { level: 'error', color: '#f87171', label: 'ERR' },
  { level: 'warn', color: '#fbbf24', label: 'WRN' },
  { level: 'info', color: '#60a5fa', label: 'INF' },
  { level: 'debug', color: '#94a3b8', label: 'DBG' },
  { level: 'trace', color: '#64748b', label: 'TRC' }
]

function makeRule(value: string): FilterRule {
  return {
    id: crypto.randomUUID(),
    kind: 'include',
    mode: value.startsWith('/') && value.endsWith('/') ? 'regex' : 'plain',
    value: value.startsWith('/') && value.endsWith('/') ? value.slice(1, -1) : value,
    enabled: true
  }
}

interface Props {
  canvas: CanvasState
  rowCount: number
  filteredCount: number
  uniquePatterns: number
}

function CanvasToolbarInner({
  canvas,
  rowCount,
  filteredCount,
  uniquePatterns
}: Props): JSX.Element {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [showFilters, setShowFilters] = useState(false)

  const toggleLevel = useCanvasesStore((s) => s.toggleLevel)
  const clearLevels = useCanvasesStore((s) => s.clearLevels)
  const addFilter = useCanvasesStore((s) => s.addFilter)
  const updateFilter = useCanvasesStore((s) => s.updateFilter)
  const removeFilter = useCanvasesStore((s) => s.removeFilter)
  const toggleGrouping = useCanvasesStore((s) => s.toggleGrouping)

  function submitFilter(): void {
    if (!draft.trim()) return
    addFilter(canvas.id, makeRule(draft.trim()))
    setDraft('')
    setShowFilters(true)
  }

  return (
    <div className="border-b border-neutral-800 text-xs text-neutral-400">
      <div className="px-2 py-1 flex items-center gap-2 min-h-[30px]">
        <span className="shrink-0 tabular-nums text-[11px]">
          {rowCount}
          {canvas.grouping && ` / ${filteredCount}`}
        </span>
        {canvas.grouping && (
          <span className="text-[10px] text-neutral-500 shrink-0">
            {uniquePatterns}p
          </span>
        )}

        {/* Level chips */}
        <div className="flex items-center gap-0.5 shrink-0">
          {LEVEL_CONFIG.map(({ level, color, label }) => {
            const active =
              canvas.levelFilter.size === 0 || canvas.levelFilter.has(level)
            return (
              <button
                key={level}
                onClick={() => toggleLevel(canvas.id, level)}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium transition-opacity"
                style={{
                  color,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: `${color}40`,
                  opacity: active ? 1 : 0.28
                }}
              >
                {label}
              </button>
            )
          })}
          {canvas.levelFilter.size > 0 && (
            <button
              onClick={() => clearLevels(canvas.id)}
              className="text-[10px] text-neutral-500 hover:text-neutral-300 px-1"
              title="Clear all level filters"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter input */}
        <form
          className="flex-1 min-w-0"
          onSubmit={(e) => {
            e.preventDefault()
            submitFilter()
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="keyword or /regex/"
            className="w-full bg-neutral-900/70 border border-neutral-800 rounded px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-600"
          />
        </form>

        {/* Filter count badge (click → expand list) */}
        {canvas.filters.length > 0 && (
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 tabular-nums"
            title="Filter list"
          >
            {showFilters ? '▾' : '▸'} {canvas.filters.length}f
          </button>
        )}

        {/* Grouping toggle */}
        <button
          onClick={() => toggleGrouping(canvas.id)}
          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
            canvas.grouping
              ? 'bg-blue-600/30 border-blue-500/50 text-blue-200'
              : 'border-neutral-700 text-neutral-400 hover:text-neutral-200'
          }`}
          title="Group repeated logs by pattern"
        >
          ⊜
        </button>
      </div>

      {showFilters && canvas.filters.length > 0 && (
        <ul className="px-2 pb-1.5 space-y-0.5">
          {canvas.filters.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 bg-neutral-900 rounded"
            >
              <input
                type="checkbox"
                checked={f.enabled}
                onChange={(e) =>
                  updateFilter(canvas.id, { ...f, enabled: e.target.checked })
                }
              />
              <select
                className="bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 text-[10px]"
                value={f.kind}
                onChange={(e) =>
                  updateFilter(canvas.id, {
                    ...f,
                    kind: e.target.value as FilterRule['kind']
                  })
                }
              >
                <option value="include">incl</option>
                <option value="exclude">excl</option>
              </select>
              <select
                className="bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 text-[10px]"
                value={f.mode}
                onChange={(e) =>
                  updateFilter(canvas.id, {
                    ...f,
                    mode: e.target.value as FilterRule['mode']
                  })
                }
              >
                <option value="plain">plain</option>
                <option value="regex">regex</option>
              </select>
              <span className="flex-1 truncate font-mono">{f.value}</span>
              <button
                onClick={() => removeFilter(canvas.id, f.id)}
                className="text-neutral-500 hover:text-red-400"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const CanvasToolbar = memo(CanvasToolbarInner)
