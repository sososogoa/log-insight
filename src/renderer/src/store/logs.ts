import { create } from 'zustand'
import type { FilterRule, LogLevel, LogLine } from '@shared/types'

const MAX_LINES_PER_SOURCE = 2000
const MAX_LINES_TOTAL = 10000

const DEFAULT_INSTRUCTION = '다음 로그의 원인과 수정 방향을 분석해줘:'

interface LogsState {
  sourceLines: Record<string, LogLine[]>
  lines: LogLine[]
  selected: Set<string>
  filters: FilterRule[]
  levelFilter: Set<LogLevel>
  instruction: string
  append: (line: LogLine) => void
  clear: () => void
  clearSource: (sourceId: string) => void
  toggleSelect: (id: string) => void
  selectRange: (ids: string[]) => void
  clearSelection: () => void
  addFilter: (rule: FilterRule) => void
  updateFilter: (rule: FilterRule) => void
  removeFilter: (id: string) => void
  toggleLevel: (level: LogLevel) => void
  clearLevels: () => void
  setInstruction: (instruction: string) => void
}

function buildMergedLines(sourceLines: Record<string, LogLine[]>): LogLine[] {
  const all: LogLine[] = []
  for (const bucket of Object.values(sourceLines)) {
    for (const line of bucket) all.push(line)
  }
  all.sort((a, b) => a.timestamp - b.timestamp)
  return all.length > MAX_LINES_TOTAL ? all.slice(-MAX_LINES_TOTAL) : all
}

export const useLogsStore = create<LogsState>((set) => ({
  sourceLines: {},
  lines: [],
  selected: new Set(),
  filters: [],
  levelFilter: new Set(),
  instruction: DEFAULT_INSTRUCTION,

  append: (line) =>
    set((s) => {
      const existing = s.sourceLines[line.sourceId] ?? []
      const trimmed =
        existing.length >= MAX_LINES_PER_SOURCE
          ? existing.slice(-(MAX_LINES_PER_SOURCE - 1))
          : existing
      const sourceLines = { ...s.sourceLines, [line.sourceId]: [...trimmed, line] }
      return { sourceLines, lines: buildMergedLines(sourceLines) }
    }),

  clear: () => set({ sourceLines: {}, lines: [], selected: new Set() }),

  clearSource: (sourceId) =>
    set((s) => {
      const { [sourceId]: _removed, ...rest } = s.sourceLines
      return { sourceLines: rest, lines: buildMergedLines(rest) }
    }),

  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selected)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selected: next }
    }),

  selectRange: (ids) =>
    set((s) => {
      const next = new Set(s.selected)
      ids.forEach((id) => next.add(id))
      return { selected: next }
    }),

  clearSelection: () => set({ selected: new Set() }),

  addFilter: (rule) => set((s) => ({ filters: [...s.filters, rule] })),
  updateFilter: (rule) =>
    set((s) => ({ filters: s.filters.map((r) => (r.id === rule.id ? rule : r)) })),
  removeFilter: (id) => set((s) => ({ filters: s.filters.filter((r) => r.id !== id) })),

  toggleLevel: (level) =>
    set((s) => {
      const next = new Set(s.levelFilter)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return { levelFilter: next }
    }),

  clearLevels: () => set({ levelFilter: new Set() }),
  setInstruction: (instruction) => set({ instruction })
}))

export function applyFilters(
  line: LogLine,
  filters: FilterRule[],
  levelFilter: Set<LogLevel>
): boolean {
  if (levelFilter.size > 0 && !levelFilter.has(line.level)) return false

  const enabled = filters.filter((f) => f.enabled)
  if (enabled.length === 0) return true

  const includes = enabled.filter((f) => f.kind === 'include')
  const excludes = enabled.filter((f) => f.kind === 'exclude')

  const match = (rule: FilterRule): boolean => {
    if (rule.levels && rule.levels.length && !rule.levels.includes(line.level)) return false
    if (rule.mode === 'regex') {
      try {
        return new RegExp(rule.value, rule.caseSensitive ? '' : 'i').test(line.text)
      } catch {
        return false
      }
    }
    return rule.caseSensitive
      ? line.text.includes(rule.value)
      : line.text.toLowerCase().includes(rule.value.toLowerCase())
  }

  if (excludes.some(match)) return false
  if (includes.length === 0) return true
  return includes.some(match)
}
