import { useTerminalStore } from '@renderer/store/terminal'

export function AiBridgeStatus(): JSX.Element {
  const activeId = useTerminalStore((s) => s.activeId)
  return (
    <span className="text-[11px] text-neutral-400">
      AI bridge:{' '}
      {activeId ? (
        <span className="text-green-400">● terminal ready</span>
      ) : (
        <span className="text-neutral-500">○ no active terminal</span>
      )}
    </span>
  )
}
