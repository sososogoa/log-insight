import { useEffect, useRef, useState } from 'react'
import { useCanvasesStore } from '@renderer/store/canvases'

interface Props {
  onClose: () => void
}

export function WorkspacePresetMenu({ onClose }: Props): JSX.Element {
  const presets = useCanvasesStore((s) => s.presets)
  const savePreset = useCanvasesStore((s) => s.savePreset)
  const loadPreset = useCanvasesStore((s) => s.loadPreset)
  const deletePreset = useCanvasesStore((s) => s.deletePreset)
  const [name, setName] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])

  function handleSave(): void {
    const n = name.trim()
    if (!n) return
    savePreset(n)
    setName('')
  }

  return (
    <div
      ref={menuRef}
      className="absolute left-2 top-7 z-30 w-[320px] bg-neutral-900 border border-neutral-700 rounded-md shadow-2xl p-2 text-[11px]"
    >
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">
        Save Workspace
      </div>
      <form
        className="flex items-center gap-1 mb-2"
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
      >
        <input
          autoFocus
          className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-600"
          placeholder="Layout name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
        >
          Save
        </button>
      </form>

      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
        Saved Presets
      </div>
      {presets.length === 0 ? (
        <div className="text-neutral-600 text-[11px] p-2">
          No presets saved yet
        </div>
      ) : (
        <ul className="max-h-[240px] overflow-auto scrollbar-hidden">
          {presets.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-1 px-1 py-1 rounded hover:bg-neutral-800 group"
            >
              <button
                onClick={() => {
                  loadPreset(p.id)
                  onClose()
                }}
                className="flex-1 text-left truncate"
                title={`${p.canvases.length} canvases · ${new Date(p.createdAt).toLocaleString()}`}
              >
                <div className="text-neutral-200 truncate">{p.name}</div>
                <div className="text-[10px] text-neutral-500 tabular-nums">
                  {p.canvases.length} canvases ·{' '}
                  {new Date(p.createdAt).toLocaleDateString()}
                </div>
              </button>
              <button
                onClick={() => deletePreset(p.id)}
                className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 px-1"
                title="Delete"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 pt-2 border-t border-neutral-800 text-[10px] text-neutral-500 leading-snug">
        Saving includes layout, canvas filters, and grouping. Loading a preset overwrites current state; canvases whose sources no longer exist are restored empty.
      </div>
    </div>
  )
}
