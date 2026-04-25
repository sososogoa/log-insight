import React from 'react'
import type { LogLine } from '@shared/types'
import { renderRichLogText, type CodeLocation } from './codeJump'

interface Props {
  line: LogLine
  selected: boolean
  onSelect: (e: React.MouseEvent) => void
  /** Count to display when this is a collapsed group header. undefined means a normal line. */
  groupCount?: number
  /** true when the group header is expanded — shown with visual distinction. */
  groupExpanded?: boolean
  /** Toggle group expand/collapse. */
  onToggleGroup?: (e: React.MouseEvent) => void
  /** Whether this line is a child of a group (indented display). */
  isGroupChild?: boolean
  /** Pattern focus action. */
  onFocusPattern?: (e: React.MouseEvent) => void
  /** Color of the source that emitted this line (left stripe). */
  sourceColor?: string
  /** Trace ID click handler. */
  onTraceClick?: (value: string) => void
  /** File:line click handler (editor jump). */
  onCodeJump?: (loc: CodeLocation) => void
}

function LogRowInner({
  line,
  selected,
  onSelect,
  groupCount,
  groupExpanded,
  onToggleGroup,
  isGroupChild,
  onFocusPattern,
  sourceColor,
  onTraceClick,
  onCodeJump
}: Props): JSX.Element {
  const levelClass =
    line.level === 'error'
      ? 'log-row--error'
      : line.level === 'warn'
        ? 'log-row--warn'
        : line.level === 'info'
          ? 'log-row--info'
          : line.level === 'debug'
            ? 'log-row--debug'
            : ''

  return (
    <div
      className={`log-row relative group/row ${levelClass} ${selected ? 'bg-blue-950/40' : 'hover:bg-neutral-900/50'} ${isGroupChild ? 'pl-3' : ''}`}
      style={
        sourceColor
          ? { boxShadow: `inset 2px 0 0 ${sourceColor}` }
          : undefined
      }
    >
      <div
        onClick={onSelect}
        onMouseDown={(e) => { if (e.shiftKey) e.preventDefault() }}
        className="w-5 shrink-0 flex justify-center pt-[3px] cursor-pointer group/check self-stretch"
        title={selected ? 'Deselect (Shift+click: range)' : 'Select (Shift+click: range)'}
      >
        <span
          className={`w-2 h-2 rounded-sm mt-0.5 transition-colors ${
            selected
              ? 'bg-blue-400'
              : 'bg-transparent group-hover/check:bg-neutral-600/70'
          }`}
        />
      </div>

      {typeof groupCount === 'number' ? (
        <button
          onClick={onToggleGroup}
          className="shrink-0 mr-1.5 mt-[1px] px-1.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors tabular-nums"
          title={groupExpanded ? 'Collapse group' : `Same pattern ×${groupCount} — expand`}
        >
          {groupExpanded ? '▾' : '▸'} ×{groupCount}
        </button>
      ) : null}

      <span className="flex-1 pr-3 select-text break-all whitespace-pre-wrap cursor-text">
        {renderRichLogText(line.text, { onTraceClick, onCodeJump })}
      </span>

      {onFocusPattern && (
        <button
          onClick={onFocusPattern}
          className="shrink-0 opacity-30 group-hover/row:opacity-90 hover:!opacity-100 text-[12px] text-neutral-400 hover:text-cyan-300 hover:bg-cyan-500/15 rounded px-1 self-start mt-[1px] transition-opacity"
          title="Show only this pattern (Focus)"
        >
          ⊙
        </button>
      )}
    </div>
  )
}

export const LogRow = React.memo(LogRowInner, (prev, next) =>
  prev.selected === next.selected &&
  prev.line.id === next.line.id &&
  prev.groupCount === next.groupCount &&
  prev.groupExpanded === next.groupExpanded &&
  prev.isGroupChild === next.isGroupChild &&
  prev.sourceColor === next.sourceColor
)
