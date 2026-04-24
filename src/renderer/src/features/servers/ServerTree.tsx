import { useEffect, useState } from 'react'
import { useServersStore } from '@renderer/store/servers'
import { useSourcesStore, getSourceColor } from '@renderer/store/sources'
import { AddServerForm } from './AddServerForm'
import type { ServerProfile } from '@shared/types'

export function ServerTree(): JSX.Element {
  const { servers, loaded, load, save, remove } = useServersStore()
  const { sources, subscribe, unsubscribe } = useSourcesStore()
  const [showForm, setShowForm] = useState(false)
  const [pathInputs, setPathInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  async function handleSave(profile: ServerProfile): Promise<void> {
    await save(profile)
    setShowForm(false)
  }

  function handleConnect(server: ServerProfile): void {
    const path = pathInputs[server.id] ?? server.logPath ?? ''
    if (!path.trim()) {
      setPathInputs((p) => ({ ...p, [server.id]: p[server.id] ?? '' }))
      return
    }
    void subscribe(server, path.trim())
    setPathInputs((p) => {
      const next = { ...p }
      delete next[server.id]
      return next
    })
  }

  function cancelPathInput(serverId: string): void {
    setPathInputs((p) => {
      const next = { ...p }
      delete next[serverId]
      return next
    })
  }

  const serverSources = (serverId: string) =>
    sources.filter((s) => s.serverId === serverId)

  return (
    <div className="text-sm h-full flex flex-col">
      <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-neutral-500 flex items-center justify-between border-b border-neutral-800/50">
        <span>Servers</span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-neutral-500 hover:text-neutral-200 w-5 h-5 flex items-center justify-center"
          title={showForm ? 'Cancel' : 'Add server'}
        >
          {showForm ? '×' : '+'}
        </button>
      </div>

      {showForm && (
        <AddServerForm onSave={handleSave} onCancel={() => setShowForm(false)} />
      )}

      <ul className="flex-1 overflow-auto">
        {servers.length === 0 && !showForm && (
          <li className="px-2 py-3 text-xs text-neutral-500">
            No servers. Click + to add one.
          </li>
        )}

        {servers.map((server) => {
          const active = serverSources(server.id)
          const hasPathPrompt = server.id in pathInputs

          return (
            <li key={server.id} className="border-b border-neutral-800/40 last:border-0">
              <div className="px-2 py-1.5 flex items-start gap-1 hover:bg-neutral-800/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">{server.name}</span>
                    {server.env && (
                      <span className="text-[10px] text-neutral-500 border border-neutral-700 rounded px-1 shrink-0">
                        {server.env}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    {server.username}@{server.host}:{server.port}
                  </div>
                </div>
                <button
                  onClick={() => handleConnect(server)}
                  className="text-neutral-500 hover:text-blue-400 mt-0.5 text-[11px] shrink-0 px-0.5"
                  title="Connect"
                >
                  ▶
                </button>
                <button
                  onClick={() => remove(server.id)}
                  className="text-neutral-600 hover:text-red-400 mt-0.5 text-[11px] shrink-0 px-0.5"
                  title="Remove"
                >
                  ×
                </button>
              </div>

              {hasPathPrompt && (
                <form
                  className="px-3 pb-1.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleConnect(server)
                  }}
                >
                  <input
                    autoFocus
                    className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-600"
                    placeholder="/var/log/app.log"
                    value={pathInputs[server.id]}
                    onChange={(e) =>
                      setPathInputs((p) => ({ ...p, [server.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') cancelPathInput(server.id)
                    }}
                  />
                </form>
              )}

              {active.map((src) => {
                const idx = sources.indexOf(src)
                return (
                  <div
                    key={src.sourceId}
                    className="pl-4 pr-2 py-0.5 flex items-center gap-1.5 text-[11px] text-neutral-400"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: getSourceColor(idx) }}
                    />
                    <span className="flex-1 truncate">{src.path}</span>
                    {src.status === 'connecting' && (
                      <span className="text-neutral-600">…</span>
                    )}
                    {src.status === 'error' && (
                      <span className="text-red-400" title={src.error}>!</span>
                    )}
                    <button
                      onClick={() => void unsubscribe(src.sourceId)}
                      className="text-neutral-600 hover:text-red-400 shrink-0"
                      title="Stop"
                    >
                      ■
                    </button>
                  </div>
                )
              })}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
