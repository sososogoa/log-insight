import { useEffect, useRef, useState } from 'react'
import { useBookmarksStore } from '@renderer/store/bookmarks'
import type { Bookmark } from '@shared/types'

function fmtTs(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function NoteEditor({
  bookmark,
  autoFocus,
  onDone
}: {
  bookmark: Bookmark
  autoFocus: boolean
  onDone: () => void
}): JSX.Element {
  const save = useBookmarksStore((s) => s.save)
  const [editing, setEditing] = useState(autoFocus)
  const [draft, setDraft] = useState(bookmark.note ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [editing])

  async function commit(): Promise<void> {
    const note = draft.trim()
    if (note !== (bookmark.note ?? '')) {
      await save({ ...bookmark, note: note || undefined })
    }
    setEditing(false)
    onDone()
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="w-full mt-0.5 bg-neutral-900 border border-blue-500/40 rounded px-2 py-1 text-[12px] text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Add note (Enter to save · Esc to cancel)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setDraft(bookmark.note ?? '')
            setEditing(false)
            onDone()
          }
        }}
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`text-left text-[13px] mt-0.5 px-1 -mx-1 rounded hover:bg-neutral-800/50 transition-colors ${
        bookmark.note ? 'text-neutral-200' : 'text-neutral-500 italic'
      }`}
    >
      {bookmark.note ?? '＋ Add note'}
    </button>
  )
}

export function BookmarksPanel(): JSX.Element | null {
  const open = useBookmarksStore((s) => s.panelOpen)
  const setOpen = useBookmarksStore((s) => s.setPanelOpen)
  const list = useBookmarksStore((s) => s.list)
  const loaded = useBookmarksStore((s) => s.loaded)
  const load = useBookmarksStore((s) => s.load)
  const remove = useBookmarksStore((s) => s.remove)
  const clear = useBookmarksStore((s) => s.clear)
  const exportMd = useBookmarksStore((s) => s.exportMarkdown)
  const focusNoteId = useBookmarksStore((s) => s.focusNoteId)
  const [exportStatus, setExportStatus] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  if (!open) return null

  async function doExport(): Promise<void> {
    const res = await exportMd()
    if (res.ok && res.path) {
      setExportStatus(`Saved: ${res.path}`)
      setTimeout(() => setExportStatus(''), 3000)
    } else {
      setExportStatus('Cancelled')
      setTimeout(() => setExportStatus(''), 1500)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <aside className="absolute right-0 top-0 bottom-0 w-[420px] bg-neutral-950 border-l border-neutral-800 flex flex-col shadow-2xl">
        <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
          <span className="font-semibold text-neutral-200 text-sm flex-1">
            🔖 Bookmarks
            <span className="ml-2 text-[11px] text-neutral-500">
              {list.length}
            </span>
          </span>
          <button
            onClick={() => void doExport()}
            disabled={list.length === 0}
            className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40"
            title="Export as Markdown"
          >
            ↑ Export
          </button>
          {confirmClear ? (
            <>
              <button
                onClick={async () => {
                  await clear()
                  setConfirmClear(false)
                }}
                className="text-[11px] px-2 py-0.5 rounded bg-red-900/60 hover:bg-red-800/70 text-red-300"
              >
                Confirm Clear
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              disabled={list.length === 0}
              className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 disabled:opacity-40"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="text-neutral-400 hover:text-neutral-100 text-lg leading-none px-1"
          >
            ×
          </button>
        </div>

        {exportStatus && (
          <div className="px-3 py-1 text-[11px] text-neutral-400 bg-neutral-900 border-b border-neutral-800 truncate">
            {exportStatus}
          </div>
        )}

        <div className="flex-1 overflow-auto scrollbar-hidden">
          {list.length === 0 && (
            <div className="p-6 text-center text-sm text-neutral-500 space-y-2">
              <div className="text-2xl">🔖</div>
              <div>No bookmarks yet</div>
              <div className="text-[11px]">
                Select log lines and press <kbd className="px-1 border border-neutral-700 rounded text-[10px]">⌘B</kbd> to save
              </div>
            </div>
          )}
          {list.map((bm) => (
            <div
              key={bm.id}
              className="border-b border-neutral-800/60 p-3 hover:bg-neutral-900/30 group"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-neutral-500 tabular-nums">
                    {fmtTs(bm.createdAt)} · {bm.lines.length} lines
                  </div>
                  <NoteEditor
                    bookmark={bm}
                    autoFocus={focusNoteId === bm.id}
                    onDone={() => {
                      if (focusNoteId === bm.id) {
                        useBookmarksStore.setState({ focusNoteId: null })
                      }
                    }}
                  />
                </div>
                <button
                  onClick={() => void remove(bm.id)}
                  className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 text-sm shrink-0"
                  title="Delete"
                >
                  ×
                </button>
              </div>
              <div className="mt-2 bg-neutral-900 rounded px-2 py-1 font-mono text-[11px] space-y-0.5 max-h-[140px] overflow-auto">
                {bm.lines.slice(0, 8).map((l, i) => (
                  <div
                    key={i}
                    className={`truncate ${
                      l.level === 'error'
                        ? 'text-log-error'
                        : l.level === 'warn'
                          ? 'text-log-warn'
                          : l.level === 'info'
                            ? 'text-log-info'
                            : 'text-neutral-400'
                    }`}
                  >
                    {l.text}
                  </div>
                ))}
                {bm.lines.length > 8 && (
                  <div className="text-neutral-500">
                    … +{bm.lines.length - 8} more
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
