import { memo } from 'react'
import { useLogsStore } from '@renderer/store/logs'

interface Props {
  sourceId: string
  /** badge 스타일 — compact(탭 용) / dock(칩 용) */
  variant?: 'compact' | 'dock'
}

/**
 * 이 컴포넌트의 목적: **자신의 sourceId 에 해당하는 소스 버퍼만 구독**.
 * 다른 소스 변경으로 인한 CanvasHost/CanvasLeaf 의 리렌더를 막기 위해 분리.
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
