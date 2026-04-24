import type { LogLine } from '@shared/types'

interface Props {
  line: LogLine
  selected: boolean
  onSelect: () => void
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
      className={`log-row cursor-pointer ${levelClass} ${
        selected ? 'bg-blue-950/40' : 'hover:bg-neutral-900'
      }`}
    >
      {line.text}
    </div>
  )
}
