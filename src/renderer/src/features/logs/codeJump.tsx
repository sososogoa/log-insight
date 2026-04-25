import type React from 'react'
import { renderWithTraceIds } from './traceHighlight'

/**
 * Detects "filepath:line" or "filepath:line:column" patterns in log text
 * and renders them as clickable code-jump links.
 *
 * Examples:
 *   - /var/app/src/api/users.ts:42
 *   - src/api/users.ts:42:18
 *   - ./lib/db.js:137
 *   - utils\helpers.py:10
 *
 * Conservative matching: extension must be a known source code extension (reduces false positives).
 */
const EXT =
  '(?:tsx?|jsx?|mjs|cjs|py|go|rs|rb|java|kt|kts|swift|cpp|cc|cxx|hpp|hh|h|c|cs|php|scala|sh|bash|zsh|sql|yml|yaml|toml|json)'
const FILE_LINE_RE = new RegExp(
  `(?:[A-Za-z]:[\\\\/]|[\\\\/]|\\.?\\.?[\\\\/])?[A-Za-z0-9._\\-/\\\\]+\\.${EXT}:\\d+(?::\\d+)?\\b`,
  'gi'
)

export interface CodeLocation {
  path: string
  line: number
  column?: number
}

function parseLoc(match: string): CodeLocation | null {
  const parts = match.split(':')
  if (parts.length < 2) return null
  // Windows-style path: first token is a drive letter ("C"), so path combines the first two tokens
  let path: string
  let lineStr: string
  let colStr: string | undefined
  if (parts[0].length === 1 && /^[A-Za-z]$/.test(parts[0])) {
    path = `${parts[0]}:${parts[1]}`
    lineStr = parts[2]
    colStr = parts[3]
  } else {
    path = parts[0]
    lineStr = parts[1]
    colStr = parts[2]
  }
  const line = Number.parseInt(lineStr, 10)
  if (!Number.isFinite(line)) return null
  const column = colStr ? Number.parseInt(colStr, 10) : undefined
  return { path, line, column: Number.isFinite(column ?? NaN) ? column : undefined }
}

export function renderRichLogText(
  text: string,
  opts: {
    onTraceClick?: (value: string) => void
    onCodeJump?: (loc: CodeLocation) => void
  }
): React.ReactNode {
  // 1) extract code-jump tokens → delegate gaps to trace highlight
  const nodes: React.ReactNode[] = []
  let lastIdx = 0
  FILE_LINE_RE.lastIndex = 0
  for (let m = FILE_LINE_RE.exec(text); m !== null; m = FILE_LINE_RE.exec(text)) {
    if (m.index > lastIdx) {
      nodes.push(
        renderWithTraceIds(text.slice(lastIdx, m.index), opts.onTraceClick)
      )
    }
    const loc = parseLoc(m[0])
    if (loc && opts.onCodeJump) {
      nodes.push(
        <button
          key={`c:${m.index}`}
          onClick={(e) => {
            e.stopPropagation()
            opts.onCodeJump!(loc)
          }}
          className="inline-block align-baseline font-mono text-[12px] text-violet-300 hover:text-violet-200 hover:bg-violet-500/10 rounded px-0.5 -mx-0.5 cursor-pointer underline decoration-dotted underline-offset-2"
          title={`Open in editor · ${loc.path}:${loc.line}`}
        >
          {m[0]}
        </button>
      )
    } else {
      nodes.push(m[0])
    }
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < text.length) {
    nodes.push(renderWithTraceIds(text.slice(lastIdx), opts.onTraceClick))
  }
  if (nodes.length === 0) {
    return renderWithTraceIds(text, opts.onTraceClick)
  }
  return nodes
}
