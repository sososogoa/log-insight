import type { LogLine } from '@shared/types'

export interface Incident {
  id: string
  startTs: number
  detectedAt: number
  errorCount: number
  warnCount: number
  baselinePerMin: number
  sampleErrors: LogLine[]
  windowLineIds: string[]
  topSourceId: string | null
}

export interface DetectorResult {
  incident: Incident | null
  recentErrors: number
  baselinePerMin: number
}

const WINDOW_MS = 60_000
const BASELINE_MS = 300_000
// Spike condition: recentErrors ≥ baseline × RATE_MULTIPLIER AND ≥ MIN_ABS_ERRORS.
// MIN_BASELINE floors baseline so a single prior error doesn't trip every spike.
const RATE_MULTIPLIER = 3
const MIN_ABS_ERRORS = 5
const MIN_BASELINE = 0.5

let counter = 0

export function detectIncident(
  lines: LogLine[],
  now: number
): DetectorResult {
  const windowStart = now - WINDOW_MS
  const baselineStart = now - BASELINE_MS
  const baselineEnd = windowStart

  let recentErrors = 0
  let recentWarns = 0
  let baselineErrors = 0
  const errorSamples: LogLine[] = []
  const windowIds: string[] = []
  const srcCount = new Map<string, number>()

  // walk backwards and break once outside the baseline window
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]
    if (l.timestamp < baselineStart) break
    if (l.timestamp >= windowStart) {
      windowIds.push(l.id)
      if (l.level === 'error') {
        recentErrors++
        if (errorSamples.length < 10) errorSamples.push(l)
        srcCount.set(l.sourceId, (srcCount.get(l.sourceId) ?? 0) + 1)
      } else if (l.level === 'warn') {
        recentWarns++
      }
    } else if (l.timestamp >= baselineStart && l.timestamp < baselineEnd) {
      if (l.level === 'error') baselineErrors++
    }
  }

  const baselineMinutes = (BASELINE_MS - WINDOW_MS) / 60_000
  const baselinePerMin = Math.max(
    MIN_BASELINE,
    baselineErrors / Math.max(1, baselineMinutes)
  )

  const isSpike =
    recentErrors >= MIN_ABS_ERRORS &&
    recentErrors >= baselinePerMin * RATE_MULTIPLIER

  if (!isSpike) {
    return { incident: null, recentErrors, baselinePerMin }
  }

  let topSourceId: string | null = null
  let topCount = 0
  for (const [sid, c] of srcCount) {
    if (c > topCount) {
      topCount = c
      topSourceId = sid
    }
  }

  // minute-bucket id collapses repeat spikes within the same minute
  const minuteBucket = Math.floor(windowStart / WINDOW_MS)
  const id = `inc-${minuteBucket}-${++counter}`

  const incident: Incident = {
    id,
    startTs: windowStart,
    detectedAt: now,
    errorCount: recentErrors,
    warnCount: recentWarns,
    baselinePerMin,
    sampleErrors: errorSamples.reverse(), // chronological order
    windowLineIds: windowIds,
    topSourceId
  }

  return { incident, recentErrors, baselinePerMin }
}
