import { memo, useMemo } from 'react'
import { useLogsStore } from '@renderer/store/logs'
import {
  useSourcesStore,
  getSourceColor,
  type ActiveSource
} from '@renderer/store/sources'
import { useCanvasesStore } from '@renderer/store/canvases'
import { useBookmarksStore } from '@renderer/store/bookmarks'
import { useIncidentStore } from '@renderer/store/incident'
import type { LogLine } from '@shared/types'

const LANE_SEGMENTS = 40
const LANE_WINDOW_MS = 120_000

interface Buckets {
  buckets: { total: number; err: number }[]
  peak: number
  errCount: number
}

function computeBuckets(lines: readonly LogLine[]): Buckets {
  const last = lines.length > 0 ? lines[lines.length - 1].timestamp : Date.now()
  const first = Math.max(
    lines.length > 0 ? lines[0].timestamp : last - LANE_WINDOW_MS,
    last - LANE_WINDOW_MS
  )
  const span = Math.max(1, last - first)
  const step = span / LANE_SEGMENTS
  const buckets = Array.from({ length: LANE_SEGMENTS }, () => ({
    total: 0,
    err: 0
  }))
  let peak = 0
  let errCount = 0
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]
    if (l.timestamp < first) break
    const idx = Math.min(
      LANE_SEGMENTS - 1,
      Math.max(0, Math.floor((l.timestamp - first) / step))
    )
    buckets[idx].total++
    if (l.level === 'error') {
      buckets[idx].err++
      errCount++
    }
  }
  for (const b of buckets) if (b.total > peak) peak = b.total
  return { buckets, peak: Math.max(1, peak), errCount }
}

/**
 * Independent component per source — subscribes only to `sourceLines[sourceId]`.
 * A log arriving for one source does not re-render other lanes or the parent OverviewRail.
 */
function SourceLaneInner({ source }: { source: ActiveSource }): JSX.Element {
  const lines = useLogsStore(
    (s) => s.sourceLines[source.sourceId] ?? EMPTY_LINES
  )
  const colorIdx = useSourcesStore((s) =>
    s.sources.findIndex((x) => x.sourceId === source.sourceId)
  )
  const color = colorIdx >= 0 ? getSourceColor(colorIdx) : '#71717a'

  const { buckets, peak, errCount } = useMemo(() => computeBuckets(lines), [lines])

  const shortLabel = (() => {
    const p = source.path
    if (p.startsWith('docker:')) {
      return p.replace(/^docker:/, '').replace(/\s*\(sudo\)$/, '')
    }
    if (p.includes('/')) return p.split('/').filter(Boolean).pop() ?? p
    return p
  })()

  const openOrFocus = useCanvasesStore((s) => s.openOrFocus)
  const focusSource = useCanvasesStore((s) => s.focusSource)

  function activate(): void {
    const existing = Object.values(useCanvasesStore.getState().byId).some(
      (c) => c.sourceId === source.sourceId
    )
    if (existing) focusSource(source.sourceId)
    else openOrFocus(source.sourceId, `${source.serverName}:${shortLabel}`)
  }

  return (
    <button
      onClick={activate}
      className="w-full text-left block px-2 py-1 hover:bg-neutral-900 rounded-sm group"
      title={`${source.serverName} · ${source.path} — click to restore/focus canvas`}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mb-0.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: color }}
        />
        <span className="truncate flex-1 min-w-0">
          <span className="text-neutral-500">{source.serverName}</span>
          <span className="text-neutral-600"> · </span>
          <span className="text-neutral-300">{shortLabel}</span>
        </span>
        {errCount > 0 && (
          <span className="text-red-400 tabular-nums shrink-0">
            {errCount} err
          </span>
        )}
      </div>
      <div className="flex items-end h-4 gap-px">
        {buckets.map((b, i) => {
          const h = (b.total / peak) * 14
          const err = b.err > 0
          return (
            <span
              key={i}
              className="flex-1"
              style={{
                height: Math.max(b.total > 0 ? 1 : 0, h),
                background: err ? '#f87171' : color,
                opacity: err ? 0.95 : 0.6
              }}
            />
          )
        })}
      </div>
    </button>
  )
}

const EMPTY_LINES: LogLine[] = []
const SourceLane = memo(SourceLaneInner)

function OverviewRailInner(): JSX.Element {
  const sources = useSourcesStore((s) => s.sources)
  const bookmarks = useBookmarksStore((s) => s.list)
  const openBookmarksPanel = useBookmarksStore((s) => s.setPanelOpen)
  const activeIncident = useIncidentStore((s) => s.active)
  const clearIncident = useIncidentStore((s) => s.clearActive)
  const focusSource = useCanvasesStore((s) => s.focusSource)

  return (
    <aside className="h-full flex flex-col bg-neutral-950 border-l border-neutral-800 text-xs">
      <div className="px-2 py-1 border-b border-neutral-800/70 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">
          Overview · 120s
        </span>
        <span className="text-[10px] text-neutral-600 tabular-nums">
          {sources.length} sources
        </span>
      </div>

      <div className="flex-1 overflow-auto scrollbar-hidden">
        {sources.length === 0 && (
          <div className="px-3 py-6 text-center text-neutral-500 text-[11px]">
            No sources connected
          </div>
        )}
        {sources.map((s) => (
          <SourceLane key={s.sourceId} source={s} />
        ))}

        {/* Incident strip */}
        {activeIncident && (
          <div className="mx-2 my-2 p-2 rounded border border-red-500/40 bg-red-950/30">
            <div className="flex items-center gap-1 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-200 font-semibold text-[11px] flex-1">
                Incident
              </span>
              <button
                onClick={clearIncident}
                className="text-neutral-400 hover:text-neutral-200 text-xs leading-none"
              >
                ×
              </button>
            </div>
            <div className="text-[10px] text-neutral-400">
              <span className="text-red-300 font-semibold tabular-nums">
                {activeIncident.errorCount} errors
              </span>{' '}
              / 60s · baseline{' '}
              <span className="tabular-nums">
                {activeIncident.baselinePerMin.toFixed(1)}/min
              </span>
            </div>
            {activeIncident.topSourceId && (
              <button
                onClick={() => {
                  if (activeIncident.topSourceId)
                    focusSource(activeIncident.topSourceId)
                }}
                className="mt-1 text-[10px] text-cyan-300 hover:text-cyan-200 underline decoration-dotted"
              >
                → Go to source canvas
              </button>
            )}
          </div>
        )}

        {/* Bookmarks resident */}
        <div className="mt-3 px-2 pb-2">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 flex items-center justify-between">
            <span>🔖 Bookmarks</span>
            <button
              onClick={() => openBookmarksPanel(true)}
              className="text-neutral-500 hover:text-neutral-300 normal-case tracking-normal text-[10px]"
            >
              All
            </button>
          </div>
          {bookmarks.length === 0 && (
            <div className="text-[10px] text-neutral-600">
              Save selected lines with ⌘B
            </div>
          )}
          <ul className="space-y-0.5">
            {bookmarks.slice(0, 6).map((bm) => (
              <li key={bm.id}>
                <button
                  onClick={() => openBookmarksPanel(true)}
                  className="w-full text-left px-1 py-0.5 rounded hover:bg-neutral-900 text-[10px] truncate"
                  title={bm.note || `${bm.lines.length} lines`}
                >
                  <span className="text-neutral-400">
                    {new Date(bm.createdAt).toLocaleTimeString().slice(0, 5)}
                  </span>{' '}
                  <span className="text-neutral-300">
                    {bm.note ?? `${bm.lines.length} lines`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  )
}

export const OverviewRail = memo(OverviewRailInner)
