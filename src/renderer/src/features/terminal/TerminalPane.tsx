import { useEffect, useState } from 'react'
import { useTerminalStore } from '@renderer/store/terminal'
import { TerminalView } from './TerminalView'

const HINT_KEY = 'terminal-hint-dismissed'

export function TerminalPane(): JSX.Element {
  const { sessions, activeId, setActive, add, remove } = useTerminalStore()
  const [showHint, setShowHint] = useState(
    () => !localStorage.getItem(HINT_KEY)
  )

  useEffect(() => {
    if (sessions.length === 0) {
      void window.api.terminal.create().then((s) => add(s))
    }
  }, [sessions.length, add])

  async function newTerminal(): Promise<void> {
    const s = await window.api.terminal.create()
    add(s)
  }

  async function closeTerminal(id: string): Promise<void> {
    await window.api.terminal.dispose(id)
    remove(id)
  }

  function dismissHint(): void {
    localStorage.setItem(HINT_KEY, '1')
    setShowHint(false)
  }

  return (
    <div className="h-full flex flex-col bg-black">
      <div className="flex items-center gap-1 px-2 py-1 border-b border-neutral-800 text-xs shrink-0">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-1 rounded ${
              s.id === activeId ? 'bg-neutral-800' : 'hover:bg-neutral-900'
            }`}
          >
            <button
              onClick={() => setActive(s.id)}
              className={`px-2 py-0.5 ${
                s.id === activeId ? 'text-neutral-100' : 'text-neutral-400'
              }`}
            >
              {s.title}
            </button>
            <button
              onClick={() => void closeTerminal(s.id)}
              className="pr-1.5 text-neutral-600 hover:text-neutral-300 transition-colors"
              title="Close terminal"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={newTerminal}
          className="ml-1 px-2 py-0.5 text-neutral-500 hover:text-neutral-200"
          title="New terminal"
        >
          +
        </button>
      </div>

      {showHint && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900/80 border-b border-neutral-800 text-[11px] text-neutral-500 shrink-0">
          <span className="flex-1">
            이 터미널에서{' '}
            <code className="text-neutral-300 bg-neutral-800 px-1 rounded">claude</code>
            {' '}또는{' '}
            <code className="text-neutral-300 bg-neutral-800 px-1 rounded">codex</code>
            를 실행하면, 로그 선택 후 Ask AI 버튼으로 컨텍스트를 바로 전달할 수 있습니다.
          </span>
          <button
            onClick={dismissHint}
            className="text-neutral-600 hover:text-neutral-300 shrink-0 transition-colors"
            title="닫기"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        {sessions.map((s) => (
          <TerminalView key={s.id} session={s} visible={s.id === activeId} />
        ))}
      </div>
    </div>
  )
}
