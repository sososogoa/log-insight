import { useEffect, useState } from 'react'
import { useServersStore } from '@renderer/store/servers'
import { useSourcesStore, getSourceColor } from '@renderer/store/sources'
import type { ServerProfile } from '@shared/types'

const ENVS = ['prod', 'staging', 'dev', 'local'] as const

function emptyForm() {
  return {
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password' as ServerProfile['authType'],
    password: '',
    pemPath: '',
    logPath: '',
    env: ''
  }
}

export function ServerTree(): JSX.Element {
  const { servers, loaded, load, save, remove } = useServersStore()
  const { sources, subscribe, unsubscribe } = useSourcesStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pathInputs, setPathInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'required'
    if (!form.host.trim()) errs.host = 'required'
    if (!form.username.trim()) errs.username = 'required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!validate()) return
    const profile: ServerProfile = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      host: form.host.trim(),
      port: form.port,
      username: form.username.trim(),
      authType: form.authType,
      ...(form.password && { password: form.password }),
      ...(form.pemPath && { pemPath: form.pemPath.trim() }),
      ...(form.logPath && { logPath: form.logPath.trim() }),
      ...(form.env && { env: form.env })
    }
    await save(profile)
    setShowForm(false)
    setForm(emptyForm())
    setErrors({})
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
          onClick={() => {
            setShowForm((v) => !v)
            setErrors({})
            setForm(emptyForm())
          }}
          className="text-neutral-500 hover:text-neutral-200 w-5 h-5 flex items-center justify-center"
          title={showForm ? 'Cancel' : 'Add server'}
        >
          {showForm ? '×' : '+'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSave}
          className="px-2 py-2 space-y-1.5 border-b border-neutral-800 bg-neutral-950/50 shrink-0"
        >
          <input
            className={`w-full bg-neutral-900 border ${errors.name ? 'border-red-500/60' : 'border-neutral-800'} rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-600`}
            placeholder="Name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <div className="flex gap-1">
            <input
              className={`flex-1 bg-neutral-900 border ${errors.host ? 'border-red-500/60' : 'border-neutral-800'} rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-600`}
              placeholder="host *"
              value={form.host}
              onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
            />
            <input
              className="w-14 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
              type="number"
              value={form.port}
              onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) || 22 }))}
            />
          </div>
          <input
            className={`w-full bg-neutral-900 border ${errors.username ? 'border-red-500/60' : 'border-neutral-800'} rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-600`}
            placeholder="username *"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          />
          <select
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-neutral-300"
            value={form.authType}
            onChange={(e) =>
              setForm((f) => ({ ...f, authType: e.target.value as ServerProfile['authType'] }))
            }
          >
            <option value="password">Password</option>
            <option value="pem">PEM key</option>
            <option value="agent">SSH Agent</option>
          </select>
          {form.authType === 'password' && (
            <input
              className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-600"
              placeholder="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          )}
          {form.authType === 'pem' && (
            <input
              className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-600"
              placeholder="/path/to/key.pem"
              value={form.pemPath}
              onChange={(e) => setForm((f) => ({ ...f, pemPath: e.target.value }))}
            />
          )}
          <input
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-600"
            placeholder="/var/log/app.log"
            value={form.logPath}
            onChange={(e) => setForm((f) => ({ ...f, logPath: e.target.value }))}
          />
          <select
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-neutral-400"
            value={form.env}
            onChange={(e) => setForm((f) => ({ ...f, env: e.target.value }))}
          >
            <option value="">— env —</option>
            {ENVS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="w-full bg-neutral-800 hover:bg-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 transition-colors"
          >
            Save
          </button>
        </form>
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
                      <span className="text-red-400" title={src.error}>
                        !
                      </span>
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
