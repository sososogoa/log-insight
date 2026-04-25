import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCommandStore } from '@renderer/store/command'
import { buildCommands, type CommandContext, type CommandItem } from './commands'
import { fuzzyMatch } from './fuzzyMatch'

interface Props {
  ctx: CommandContext
}

interface ScoredItem {
  item: CommandItem
  score: number
}

export function CommandPalette({ ctx }: Props): JSX.Element | null {
  const { open, query, setQuery, close } = useCommandStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [tick, setTick] = useState(0)

  // regenerate commands each time the palette opens (reflects current store state)
  useEffect(() => {
    if (open) {
      setActive(0)
      setTick((t) => t + 1)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const all = useMemo<CommandItem[]>(
    () => buildCommands(ctx),
    // include `tick` to reflect latest store state at open time
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, tick]
  )

  const scored = useMemo<ScoredItem[]>(() => {
    if (!query.trim()) {
      return all.map((item) => ({ item, score: 0 }))
    }
    const results: ScoredItem[] = []
    for (const item of all) {
      const hay = `${item.title} ${item.subtitle ?? ''} ${item.keywords ?? ''} ${item.group}`
      const m = fuzzyMatch(query.trim(), hay)
      if (m) results.push({ item, score: m.score })
    }
    results.sort((a, b) => b.score - a.score)
    return results
  }, [all, query])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-idx="${active}"]`
    )
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [active])

  const execute = useCallback(
    (item: CommandItem) => {
      if (item.disabled) return
      close()
      // Run after close so focus returns naturally
      queueMicrotask(() => void item.run())
    },
    [close]
  )

  if (!open) return null

  const grouped = new Map<string, ScoredItem[]>()
  for (const s of scored) {
    const g = s.item.group
    if (!grouped.has(g)) grouped.set(g, [])
    grouped.get(g)!.push(s)
  }

  // flat index map → so keyboard navigation stays correct under grouped display
  const flat: ScoredItem[] = []
  for (const list of grouped.values()) for (const s of list) flat.push(s)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="w-[640px] max-w-[90vw] rounded-lg bg-neutral-900 border border-neutral-700 shadow-2xl overflow-hidden flex flex-col"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            close()
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, flat.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            const pick = flat[active]
            if (pick) execute(pick.item)
          }
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-neutral-800">
          <span className="text-neutral-500 text-sm">›</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands · Esc close · ↑↓ navigate · ⏎ run"
            className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
          />
          <span className="text-[10px] text-neutral-600 border border-neutral-700 rounded px-1.5 py-0.5 uppercase tracking-wider">
            ⌘K
          </span>
        </div>

        <div
          ref={listRef}
          className="flex-1 overflow-auto max-h-[60vh] py-1"
        >
          {flat.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">
              No matching commands
            </div>
          )}
          {Array.from(grouped.entries()).map(([group, list]) => {
            if (list.length === 0) return null
            return (
              <div key={group}>
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-neutral-500">
                  {group}
                </div>
                {list.map((s) => {
                  const idx = flat.indexOf(s)
                  const isActive = idx === active
                  return (
                    <button
                      key={s.item.id}
                      data-idx={idx}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => execute(s.item)}
                      disabled={s.item.disabled}
                      className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
                        isActive
                          ? 'bg-blue-600/20 border-l-2 border-blue-500'
                          : 'border-l-2 border-transparent'
                      } ${s.item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-800/60'}`}
                      title={s.item.disabled ? s.item.disabledReason : undefined}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-neutral-100">
                          {s.item.title}
                        </div>
                        {s.item.subtitle && (
                          <div className="truncate text-[11px] text-neutral-500 mt-0.5">
                            {s.item.subtitle}
                          </div>
                        )}
                      </div>
                      {s.item.shortcut && (
                        <span className="text-[10px] text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5 shrink-0">
                          {s.item.shortcut}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="px-3 py-1.5 border-t border-neutral-800 flex items-center gap-3 text-[10px] text-neutral-500">
          <span>↑↓ navigate</span>
          <span>⏎ run</span>
          <span>Esc close</span>
          <span className="ml-auto">{flat.length} commands</span>
        </div>
      </div>
    </div>
  )
}
