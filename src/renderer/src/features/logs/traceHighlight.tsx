import React from 'react'

/**
 * Auto-detects trace/request identifiers in log text and replaces them with clickable tokens.
 *  - UUID v1–v5 (8-4-4-4-12)
 *  - OpenTelemetry span id (16-char hex)
 *  - OpenTelemetry trace id (32-char hex)
 */
const TRACE_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\b[0-9a-f]{32}\b|\b[0-9a-f]{16}\b/gi

export function renderWithTraceIds(
  text: string,
  onTraceClick?: (value: string) => void
): React.ReactNode {
  if (!onTraceClick) return text
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  TRACE_RE.lastIndex = 0
  for (let m = TRACE_RE.exec(text); m !== null; m = TRACE_RE.exec(text)) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index))
    const id = m[0]
    parts.push(
      <button
        key={`${m.index}:${id}`}
        onClick={(e) => {
          e.stopPropagation()
          onTraceClick(id)
        }}
        className="inline-block align-baseline text-[12px] font-mono text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10 rounded px-0.5 -mx-0.5 cursor-pointer"
        title={`Filter all sources by this ID · ${id}`}
      >
        {id}
      </button>
    )
    lastIdx = m.index + id.length
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  if (parts.length === 0) return text
  return parts
}
