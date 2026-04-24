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
    <div className={`log-row ${levelClass} ${selected ? 'bg-blue-950/40' : 'hover:bg-neutral-900/50'}`}>
      {/* 게터: 선택 전용 영역 */}
      <div
        onClick={onSelect}
        onMouseDown={(e) => { if (e.shiftKey) e.preventDefault() }}
        className="w-5 shrink-0 flex justify-center pt-[3px] cursor-pointer group self-stretch"
        title={selected ? '선택 해제 (Shift+클릭: 범위)' : '선택 (Shift+클릭: 범위)'}
      >
        <span
          className={`w-2 h-2 rounded-sm mt-0.5 transition-colors ${
            selected
              ? 'bg-blue-400'
              : 'bg-transparent group-hover:bg-neutral-600/70'
          }`}
        />
      </div>

      {/* 텍스트: 드래그 선택 자유 */}
      <span className="flex-1 pr-3 select-text break-all whitespace-pre-wrap cursor-text">
        {line.text}
      </span>
    </div>
  )
}
