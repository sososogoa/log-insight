import React from 'react'
import type { LogLine } from '@shared/types'
import { renderRichLogText, type CodeLocation } from './codeJump'

interface Props {
  line: LogLine
  selected: boolean
  onSelect: (e: React.MouseEvent) => void
  /** 그룹 헤더 라인(접힘)일 때 표시할 카운트. undefined 이면 일반 라인. */
  groupCount?: number
  /** 그룹 헤더를 펼쳤을 때 true. 시각적으로 구분. */
  groupExpanded?: boolean
  /** 그룹 확장/축소 토글 */
  onToggleGroup?: (e: React.MouseEvent) => void
  /** 그룹의 자식 라인 (들여쓰기 표시) */
  isGroupChild?: boolean
  /** 패턴 포커스 액션 */
  onFocusPattern?: (e: React.MouseEvent) => void
  /** 이 라인을 송출한 소스의 컬러 (좌측 스트라이프) */
  sourceColor?: string
  /** 트레이스 ID 클릭 핸들러 */
  onTraceClick?: (value: string) => void
  /** 파일:라인 클릭 핸들러 (에디터 점프) */
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
        title={selected ? '선택 해제 (Shift+클릭: 범위)' : '선택 (Shift+클릭: 범위)'}
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
          title={groupExpanded ? '그룹 접기' : `같은 패턴 ${groupCount}회 — 펼치기`}
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
          title="이 패턴만 보기 (Focus)"
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
