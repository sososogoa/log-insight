import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { FilterRule, LogLevel, LogLine } from '@shared/types'

const MAX_LINES_PER_SOURCE = 2000
const MAX_LINES_TOTAL = 10000

const DEFAULT_INSTRUCTION = '다음 로그의 원인과 수정 방향을 분석해줘:'

interface LogsState {
  sourceLines: Record<string, LogLine[]>
  lines: LogLine[]
  instruction: string
  traceFilter: string | null

  appendBatch: (newLines: LogLine[]) => void
  append: (line: LogLine) => void
  clear: () => void
  clearSource: (sourceId: string) => void
  setInstruction: (instruction: string) => void
  setTraceFilter: (value: string | null) => void
}

function insertSorted(arr: LogLine[], line: LogLine): LogLine[] {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid].timestamp <= line.timestamp) lo = mid + 1
    else hi = mid
  }
  const next = [...arr]
  next.splice(lo, 0, line)
  return next
}

function mergeBatchIntoLines(current: LogLine[], batch: LogLine[]): LogLine[] {
  if (batch.length === 0) return current
  if (current.length === 0) return batch.slice(-MAX_LINES_TOTAL)

  const lastCurrentTs = current[current.length - 1].timestamp
  const allInOrder = batch.every((l) => l.timestamp >= lastCurrentTs)
  let merged: LogLine[]
  if (allInOrder) {
    merged = [...current, ...batch]
  } else {
    merged = [...current, ...batch].sort((a, b) => a.timestamp - b.timestamp)
  }
  return merged.length > MAX_LINES_TOTAL ? merged.slice(-MAX_LINES_TOTAL) : merged
}

function trimSourceBucket(existing: LogLine[], incoming: LogLine[]): LogLine[] {
  const combined = [...existing, ...incoming]
  return combined.length > MAX_LINES_PER_SOURCE
    ? combined.slice(-MAX_LINES_PER_SOURCE)
    : combined
}

function rebuildMerged(sourceLines: Record<string, LogLine[]>): LogLine[] {
  const buckets = Object.values(sourceLines)
  if (buckets.length === 0) return []
  if (buckets.length === 1) {
    const b = buckets[0]
    return b.length > MAX_LINES_TOTAL ? b.slice(-MAX_LINES_TOTAL) : b
  }
  const all: LogLine[] = []
  for (const b of buckets) for (const l of b) all.push(l)
  all.sort((a, b) => a.timestamp - b.timestamp)
  return all.length > MAX_LINES_TOTAL ? all.slice(-MAX_LINES_TOTAL) : all
}

export const useLogsStore = create<LogsState>()(
  persist(
    (set) => ({
      sourceLines: {},
      lines: [],
      instruction: DEFAULT_INSTRUCTION,
      traceFilter: null,

      append: (line) =>
        set((s) => {
          const existing = s.sourceLines[line.sourceId] ?? []
          const bucket = trimSourceBucket(existing, [line])
          const sourceLines = { ...s.sourceLines, [line.sourceId]: bucket }
          const lines = insertSorted(s.lines, line).slice(-MAX_LINES_TOTAL)
          return { sourceLines, lines }
        }),

      appendBatch: (newLines) =>
        set((s) => {
          if (newLines.length === 0) return s
          const grouped: Record<string, LogLine[]> = {}
          for (const l of newLines) {
            if (!grouped[l.sourceId]) grouped[l.sourceId] = []
            grouped[l.sourceId].push(l)
          }
          const sourceLines = { ...s.sourceLines }
          for (const [sid, batch] of Object.entries(grouped)) {
            sourceLines[sid] = trimSourceBucket(sourceLines[sid] ?? [], batch)
          }
          const lines = mergeBatchIntoLines(s.lines, newLines)
          return { sourceLines, lines }
        }),

      clear: () => set({ sourceLines: {}, lines: [] }),

      clearSource: (sourceId) =>
        set((s) => {
          const { [sourceId]: _removed, ...rest } = s.sourceLines
          return { sourceLines: rest, lines: rebuildMerged(rest) }
        }),

      setInstruction: (instruction) => set({ instruction }),
      setTraceFilter: (value) => set({ traceFilter: value })
    }),
    {
      name: 'loginsight-global',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ instruction: state.instruction }),
      merge: (persisted: unknown, current) => {
        const p = persisted as { instruction?: string }
        return { ...current, instruction: p.instruction ?? current.instruction }
      }
    }
  )
)

const regexCache = new Map<string, RegExp>()

function getRegex(value: string, caseSensitive?: boolean): RegExp | null {
  const key = `${caseSensitive ? 'cs' : 'ci'}:${value}`
  if (regexCache.has(key)) return regexCache.get(key)!
  try {
    const re = new RegExp(value, caseSensitive ? '' : 'i')
    regexCache.set(key, re)
    return re
  } catch {
    return null
  }
}

export function buildFilterPredicate(
  filters: FilterRule[]
): (line: LogLine, levelFilter: Set<LogLevel>) => boolean {
  const enabled = filters.filter((f) => f.enabled)
  const includes = enabled.filter((f) => f.kind === 'include')
  const excludes = enabled.filter((f) => f.kind === 'exclude')

  const match = (rule: FilterRule, line: LogLine): boolean => {
    if (rule.levels && rule.levels.length && !rule.levels.includes(line.level)) return false
    if (rule.mode === 'regex') {
      const re = getRegex(rule.value, rule.caseSensitive)
      return re ? re.test(line.text) : false
    }
    return rule.caseSensitive
      ? line.text.includes(rule.value)
      : line.text.toLowerCase().includes(rule.value.toLowerCase())
  }

  return (line, levelFilter) => {
    if (levelFilter.size > 0 && !levelFilter.has(line.level)) return false
    if (enabled.length === 0) return true
    if (excludes.some((r) => match(r, line))) return false
    if (includes.length === 0) return true
    return includes.some((r) => match(r, line))
  }
}

export function applyFilters(
  line: LogLine,
  filters: FilterRule[],
  levelFilter: Set<LogLevel>
): boolean {
  return buildFilterPredicate(filters)(line, levelFilter)
}
