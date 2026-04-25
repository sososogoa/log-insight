import { useEffect, useRef, useState } from 'react'
import { useSourcesStore } from '@renderer/store/sources'

export function RestoreBanner(): JSX.Element | null {
  const sources = useSourcesStore((s) => s.sources)
  const restoreDone = useSourcesStore((s) => s.restoreDone)
  const initialSpecCount = useRef(useSourcesStore.getState().restoreSpecs.length)
  const [dismissed, setDismissed] = useState(false)

  const connecting = sources.filter((s) => s.status === 'connecting').length
  const streaming = sources.filter((s) => s.status === 'streaming').length
  const errored = sources.filter((s) => s.status === 'error').length
  const total = sources.length

  useEffect(() => {
    if (!restoreDone || connecting > 0 || total === 0) return
    const t = setTimeout(() => setDismissed(true), 3000)
    return () => clearTimeout(t)
  }, [restoreDone, connecting, total])

  if (dismissed) return null
  if (initialSpecCount.current === 0) return null

  async function cancelAll(): Promise<void> {
    const unsubscribe = useSourcesStore.getState().unsubscribe
    const ids = useSourcesStore.getState().sources.map((s) => s.sourceId)
    useSourcesStore.getState().clearRestoreSpecs()
    await Promise.all(ids.map((id) => unsubscribe(id)))
    setDismissed(true)
  }

  const label =
    connecting > 0
      ? `Restoring · ${streaming}/${total}`
      : errored > 0
        ? `Restore complete · ${streaming} connected, ${errored} failed`
        : `Restore complete · ${streaming} sources`

  const icon =
    connecting > 0 ? '↻' : errored > 0 ? '⚠' : '✓'
  const iconColor =
    connecting > 0
      ? 'text-blue-300'
      : errored > 0
        ? 'text-amber-300'
        : 'text-emerald-300'

  return (
    <div className="flex items-center gap-2 px-3 py-1 border-b border-neutral-800 bg-neutral-900/80 text-[11px] text-neutral-300">
      <span className={iconColor}>{icon}</span>
      <span className="flex-1">{label}</span>
      {connecting > 0 && (
        <button
          onClick={() => void cancelAll()}
          className="text-neutral-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-neutral-800"
        >
          Cancel all
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="text-neutral-500 hover:text-neutral-200 px-1"
      >
        ×
      </button>
    </div>
  )
}
