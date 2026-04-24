import type { LogLine } from '@shared/types'
import { fingerprint } from './patternFingerprint'

export type VisibleRow =
  | { kind: 'single'; line: LogLine; fingerprint: string }
  | {
      kind: 'group'
      /** 대표 라인 (가장 최근) */
      line: LogLine
      /** 해당 그룹의 모든 id (선택/AI 전송 시 사용) */
      ids: string[]
      count: number
      fingerprint: string
      /** 그룹 헤더의 안정 id — 가장 오래된 라인 id 사용 */
      groupId: string
      firstTs: number
      lastTs: number
    }
  | {
      kind: 'group-child'
      line: LogLine
      fingerprint: string
      /** 속한 그룹 id */
      groupId: string
    }

export interface GroupingResult {
  rows: VisibleRow[]
  /** fingerprint → 원본 라인 총 개수 (상단 패턴 인사이트 등) */
  fingerprintCounts: Map<string, number>
}

/**
 * 연속(consecutive) 로그 그루핑.
 * 같은 fingerprint 가 이어지면 하나의 그룹으로 묶는다.
 * expanded 그룹은 헤더 + 자식 라인들로 평탄화되어 가상 스크롤에서 그대로 사용 가능.
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
