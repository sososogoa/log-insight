import { memo } from 'react'
import { useLogsStore } from '@renderer/store/logs'

interface Props {
  sourceId: string
  /** Badge style — compact (for tabs) / dock (for chips). */
  variant?: 'compact' | 'dock'
}

/**
 * Purpose: subscribe **only to the source buffer for its own sourceId**.
 * Isolated to prevent CanvasHost/CanvasLeaf re-renders caused by other source changes.
 */
function TabErrorBadgeInner({ sourceId, variant = 'compact' }: Props): JSX.Element | null {
  const bucket = useLogsStore((s) => s.sourceLines[sourceId])
  if (!bucket || bucket.length === 0) return null
  let n = 0
  for (const l of bucket) if (l.level === 'error') n++
  if (n === 0) return null
  if (variant === 'dock') {
    return <span className="text-[9px] text-red-300 tabular-nums">{n}</span>
  }
  return (
    <span className="ml-1 text-[9px] bg-red-900/60 text-red-200 rounded px-1 tabular-nums">
      {n > 99 ? '99+' : n}
    </span>
  )
}

export const TabErrorBadge = memo(TabErrorBadgeInner)
