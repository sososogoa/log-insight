import { useEffect } from 'react'
import { useTerminalStore } from '@renderer/store/terminal'
import { TerminalView } from './TerminalView'

export function TerminalPane(): JSX.Element {
  const { sessions, activeId, setActive, add } = useTerminalStore()

  useEffect(() => {
    if (sessions.length === 0) {
      void window.api.terminal.create().then((s) => add(s))
    }
  }, [sessions.length, add])

  async function newTerminal(): Promise<void> {
    const s = await window.api.terminal.create()
    add(s)
  }

  return (
    <div className="h-full flex flex-col bg-black">
      <div className="flex items-center gap-1 px-2 py-1 border-b border-neutral-800 text-xs">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`px-2 py-0.5 rounded ${
              s.id === activeId
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-400 hover:bg-neutral-900'
            }`}
          >
            {s.title}
          </button>
        ))}
        <button
          onClick={newTerminal}
          className="ml-1 px-2 py-0.5 text-neutral-500 hover:text-neutral-200"
          title="New terminal"
        >
          +
        </button>
        <div className="ml-auto text-neutral-500">
          Tip: Run claude / codex here. Selected logs pipe into stdin.
        </div>
      </div>
      <div className="flex-1 relative">
        {sessions.map((s) => (
          <TerminalView key={s.id} session={s} visible={s.id === activeId} />
        ))}
      </div>
    </div>
  )
}
