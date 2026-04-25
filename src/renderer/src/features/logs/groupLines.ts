import type { LogLine } from '@shared/types'
import { fingerprint } from './patternFingerprint'

export type VisibleRow =
  | { kind: 'single'; line: LogLine; fingerprint: string }
  | {
      kind: 'group'
      /** Representative line (most recent). */
      line: LogLine
      /** All ids in this group (used for selection/AI send). */
      ids: string[]
      count: number
      fingerprint: string
      /** Stable id for the group header — uses the oldest line's id. */
      groupId: string
      firstTs: number
      lastTs: number
    }
  | {
      kind: 'group-child'
      line: LogLine
      fingerprint: string
      /** Id of the group this line belongs to. */
      groupId: string
    }

export interface GroupingResult {
  rows: VisibleRow[]
  /** fingerprint → total original line count (for top-level pattern insights, etc.) */
  fingerprintCounts: Map<string, number>
}

/**
 * Consecutive log grouping.
 * Consecutive lines with the same fingerprint are merged into one group.
 * Expanded groups are flattened to header + child lines, ready for use in virtual scroll.
 */
export function groupLines(
  lines: LogLine[],
  opts: { enabled: boolean; expandedGroups: Set<string> }
): GroupingResult {
  const fingerprintCounts = new Map<string, number>()

  if (!opts.enabled) {
    const rows: VisibleRow[] = lines.map((line) => {
      const fp = fingerprint(line.text)
      fingerprintCounts.set(fp, (fingerprintCounts.get(fp) ?? 0) + 1)
      return { kind: 'single', line, fingerprint: fp }
    })
    return { rows, fingerprintCounts }
  }

  type Accum = {
    groupId: string
    first: LogLine
    last: LogLine
    lines: LogLine[]
    fp: string
  }
  const groups: Accum[] = []
  let cur: Accum | null = null

  for (const line of lines) {
    const fp = fingerprint(line.text)
    fingerprintCounts.set(fp, (fingerprintCounts.get(fp) ?? 0) + 1)
    if (cur && cur.fp === fp) {
      cur.last = line
      cur.lines.push(line)
    } else {
      cur = {
        groupId: line.id,
        first: line,
        last: line,
        lines: [line],
        fp
      }
      groups.push(cur)
    }
  }

  const rows: VisibleRow[] = []
  for (const g of groups) {
    if (g.lines.length === 1) {
      rows.push({ kind: 'single', line: g.first, fingerprint: g.fp })
      continue
    }
    const expanded = opts.expandedGroups.has(g.groupId)
    rows.push({
      kind: 'group',
      line: g.last,
      ids: g.lines.map((l) => l.id),
      count: g.lines.length,
      fingerprint: g.fp,
      groupId: g.groupId,
      firstTs: g.first.timestamp,
      lastTs: g.last.timestamp
    })
    if (expanded) {
      for (const l of g.lines) {
        rows.push({
          kind: 'group-child',
          line: l,
          fingerprint: g.fp,
          groupId: g.groupId
        })
      }
    }
  }

  return { rows, fingerprintCounts }
}
