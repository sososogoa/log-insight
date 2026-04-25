import { useMemo } from 'react'
import type { LogLine } from '@shared/types'

interface Props {
  lines: LogLine[]
  /** Time range to render (ms). Default: last 120s. */
  windowMs?: number
  /** Number of segments. */
  segments?: number
  /** Called on segment click — passes the index of the first log in that interval. */
  onSeek?: (lineIdx: number) => void
}

type Level = 'error' | 'warn' | 'info' | 'other'
interface Bucket {
  start: number
  end: number
  count: number
  byLevel: Record<Level, number>
  firstIdx: number | null
}

function levelKey(l: LogLine['level']): Level {
  if (l === 'error') return 'error'
  if (l === 'warn') return 'warn'
  if (l === 'info') return 'info'
  return 'other'
}

const LEVEL_COLOR: Record<Level, string> = {
  error: '#f87171',
  warn: '#fbbf24',
  info: '#60a5fa',
  other: '#6b7280'
}

export function TimelineStrip({
  lines,
  windowMs = 120_000,
  segments = 60,
  onSeek
}: Props): JSX.Element | null {
  const buckets = useMemo<Bucket[] | null>(() => {
    if (lines.length === 0) return null
    const last = lines[lines.length - 1].timestamp
    const first = Math.max(lines[0].timestamp, last - windowMs)
    const span = Math.max(1, last - first)
    const step = span / segments

    const b: Bucket[] = []
    for (let i = 0; i < segments; i++) {
      b.push({
        start: first + step * i,
        end: first + step * (i + 1),
        count: 0,
        byLevel: { error: 0, warn: 0, info: 0, other: 0 },
        firstIdx: null
      })
    }

    for (let idx = 0; idx < lines.length; idx++) {
      const l = lines[idx]
      if (l.timestamp < first) continue
      let seg = Math.floor((l.timestamp - first) / step)
      if (seg >= segments) seg = segments - 1
      if (seg < 0) continue
      const bucket = b[seg]
      bucket.count++
      bucket.byLevel[levelKey(l.level)]++
      if (bucket.firstIdx === null) bucket.firstIdx = idx
    }

    return b
  }, [lines, windowMs, segments])

  if (!buckets) {
    return (
      <div className="h-[18px] bg-neutral-900/30 border-b border-neutral-800/80" />
    )
  }

  const peak = Math.max(1, ...buckets.map((b) => b.count))

  return (
    <div className="h-[18px] bg-neutral-900/30 border-b border-neutral-800/80 flex items-end px-0.5 gap-px select-none">
      {buckets.map((b, i) => {
        const h = (b.count / peak) * 14
        // dominant level: error > warn > info > other
        const dom: Level =
          b.byLevel.error > 0
            ? 'error'
            : b.byLevel.warn > 0
              ? 'warn'
              : b.byLevel.info > 0
                ? 'info'
                : 'other'
        const color = LEVEL_COLOR[dom]
        return (
          <button
            key={i}
            onClick={() => {
              if (b.firstIdx !== null) onSeek?.(b.firstIdx)
            }}
            disabled={b.count === 0}
            className="flex-1 flex items-end justify-center relative group"
            title={
              b.count > 0
                ? `${new Date(b.start).toLocaleTimeString()} — ${b.count} lines (err ${b.byLevel.error}, warn ${b.byLevel.warn})`
                : undefined
            }
            style={{ height: 16 }}
          >
            <span
              className="w-full transition-opacity group-hover:opacity-80"
              style={{
                height: Math.max(b.count > 0 ? 2 : 0, h),
                background: color,
                opacity: b.count > 0 ? 0.85 : 0
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
