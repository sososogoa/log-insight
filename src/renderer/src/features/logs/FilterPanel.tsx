import { useState } from 'react'
import { useLogsStore } from '@renderer/store/logs'
import { useSourcesStore, getSourceColor } from '@renderer/store/sources'
import type { FilterRule, LogLevel } from '@shared/types'

function makeRule(partial: Partial<FilterRule>): FilterRule {
  return {
    id: crypto.randomUUID(),
    kind: 'include',
    mode: 'plain',
    value: '',
    enabled: true,
    ...partial
  }
}

const LEVEL_CONFIG: { level: LogLevel; color: string; label: string }[] = [
  { level: 'error', color: '#f87171', label: 'ERR' },
  { level: 'warn', color: '#fbbf24', label: 'WRN' },
  { level: 'info', color: '#60a5fa', label: 'INF' },
  { level: 'debug', color: '#94a3b8', label: 'DBG' },
  { level: 'trace', color: '#64748b', label: 'TRC' }
]

export function FilterPanel(): JSX.Element {
  const { filters, levelFilter, addFilter, updateFilter, removeFilter, toggleLevel, clearLevels } =
    useLogsStore()
  const { sources } = useSourcesStore()
  const [draft, setDraft] = useState('')

  return (
    <div className="p-3 space-y-4 text-sm h-full overflow-auto">
      {/* Level quick-filter */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5 flex items-center justify-between">
          <span>Level</span>
          {levelFilter.size > 0 && (
            <button
              onClick={clearLevels}
              className="text-[10px] text-neutral-600 hover:text-neutral-400"
            >
              all
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {LEVEL_CONFIG.map(({ level, color, label }) => {
            const active = levelFilter.size === 0 || levelFilter.has(level)
            return (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className="px-1.5 py-0.5 rounded text-[11px] font-medium transition-opacity"
                style={{
                  color,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: `${color}40`,
                  opacity: active ? 1 : 0.3
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Keyword filters */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">
          Filters
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.trim()) return
            addFilter(makeRule({ value: draft }))
            setDraft('')
          }}
        >
          <input
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-600"
            placeholder="keyword or /regex/"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </form>
        <ul className="space-y-1 mt-2">
          {filters.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-1.5 text-xs px-2 py-1 bg-neutral-900 rounded"
            >
              <input
                type="checkbox"
                checked={f.enabled}
                onChange={(e) => updateFilter({ ...f, enabled: e.target.checked })}
              />
              <select
                className="bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 text-[11px]"
                value={f.kind}
                onChange={(e) =>
                  updateFilter({ ...f, kind: e.target.value as FilterRule['kind'] })
                }
              >
                <option value="include">incl</option>
                <option value="exclude">excl</option>
              </select>
              <select
                className="bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 text-[11px]"
                value={f.mode}
                onChange={(e) =>
                  updateFilter({ ...f, mode: e.target.value as FilterRule['mode'] })
                }
              >
                <option value="plain">plain</option>
                <option value="regex">regex</option>
              </select>
              <span className="flex-1 truncate">{f.value}</span>
              <button
                onClick={() => removeFilter(f.id)}
                className="text-neutral-500 hover:text-red-400"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Active sources */}
      {sources.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">
            Sources
          </div>
          <ul className="space-y-1">
            {sources.map((src, idx) => (
              <li key={src.sourceId} className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: getSourceColor(idx) }}
                />
                <span className="truncate flex-1">
                  {src.serverName}: {src.path}
                </span>
                {src.status === 'connecting' && (
                  <span className="text-neutral-600 shrink-0">…</span>
                )}
                {src.status === 'error' && (
                  <span className="text-red-400 shrink-0" title={src.error}>!</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
