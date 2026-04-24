import { ServerTree } from './features/servers/ServerTree'
import { LogViewer } from './features/logs/LogViewer'
import { TerminalPane } from './features/terminal/TerminalPane'
import { FilterPanel } from './features/logs/FilterPanel'
import { AiBridgeStatus } from './features/ai-bridge/AiBridgeStatus'

export default function App(): JSX.Element {
  return (
    <div className="h-full grid grid-cols-[260px_1fr_320px] grid-rows-[36px_1fr_40%_24px]">
      <header className="col-span-3 row-start-1 border-b border-neutral-800 px-3 flex items-center justify-between text-xs text-neutral-400">
        <span className="font-semibold text-neutral-200">LogInsight</span>
        <AiBridgeStatus />
      </header>

      <aside className="row-start-2 row-end-4 border-r border-neutral-800 overflow-auto">
        <ServerTree />
      </aside>

      <main className="row-start-2 overflow-hidden">
        <LogViewer />
      </main>

      <aside className="row-start-2 border-l border-neutral-800 overflow-auto">
        <FilterPanel />
      </aside>

      <section className="col-span-3 row-start-3 border-t border-neutral-800 overflow-hidden">
        <TerminalPane />
      </section>

      <footer className="col-span-3 row-start-4 border-t border-neutral-800 px-3 text-[11px] text-neutral-500 flex items-center">
        Ready
      </footer>
    </div>
  )
}
