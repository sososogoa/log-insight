import React from 'react'
import type { LogLine } from '@shared/types'

interface Props {
  line: LogLine
  selected: boolean
  onSelect: (e: React.MouseEvent) => void
}

export function LogRow({ line, selected, onSelect }: Props): JSX.Element {
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
      onClick={onSelect}
      onMouseDown={(e) => { if (e.shiftKey) e.preventDefault() }}
      className={`log-row cursor-pointer select-none ${levelClass} ${
        selected ? 'bg-blue-950/40' : 'hover:bg-neutral-900'
      }`}
    >
      {line.text}
    </div>
  )
}
