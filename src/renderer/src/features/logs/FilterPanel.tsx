import { useState } from 'react'
import { useLogsStore } from '@renderer/store/logs'
import type { FilterRule } from '@shared/types'

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

export function FilterPanel(): JSX.Element {
  const { filters, addFilter, updateFilter, removeFilter } = useLogsStore()
  const [draft, setDraft] = useState('')

  return (
    <div className="p-3 space-y-3 text-sm">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">Filters</div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          addFilter(makeRule({ value: draft }))
          setDraft('')
        }}
      >
        <input
          className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="keyword or /regex/"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </form>
      <ul className="space-y-1">
        {filters.map((f) => (
          <li
            key={f.id}
            className="flex items-center gap-2 text-xs px-2 py-1 bg-neutral-900 rounded"
          >
            <input
              type="checkbox"
              checked={f.enabled}
              onChange={(e) => updateFilter({ ...f, enabled: e.target.checked })}
            />
            <select
              className="bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5"
              value={f.kind}
              onChange={(e) =>
                updateFilter({ ...f, kind: e.target.value as FilterRule['kind'] })
              }
            >
              <option value="include">incl</option>
              <option value="exclude">excl</option>
            </select>
            <select
              className="bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5"
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
  )
}
