import { useEffect, useState } from 'react'
import { useServersStore } from '@renderer/store/servers'
import { useSourcesStore, getSourceColor } from '@renderer/store/sources'
import { useTerminalStore } from '@renderer/store/terminal'
import { AddServerForm } from './AddServerForm'
import { SourcePicker } from './SourcePicker'
import type { LogSourceSpec, ServerProfile } from '@shared/types'

export function ServerTree(): JSX.Element {
  const { servers, loaded, load, save, remove } = useServersStore()
  const { sources, subscribe, unsubscribe } = useSourcesStore()
  const activeTerminalId = useTerminalStore((s) => s.activeId)
  const [showForm, setShowForm] = useState(false)
  const [editingServer, setEditingServer] = useState<ServerProfile | null>(null)
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  async function handleSave(profile: ServerProfile): Promise<void> {
    await save(profile)
    setShowForm(false)
    setEditingServer(null)
  }

  async function handleRemove(serverId: string): Promise<void> {
    const serverSrcs = sources.filter((s) => s.serverId === serverId)
    for (const src of serverSrcs) {
      await unsubscribe(src.sourceId)
    }
    await remove(serverId)
    setConfirmDelete(null)
    // close the form if the server being edited is deleted
    if (editingServer?.id === serverId) setEditingServer(null)
    if (pickerFor === serverId) setPickerFor(null)
  }

  function openPicker(server: ServerProfile): void {
    setPickerFor(server.id)
  }

  function handlePickerConnect(server: ServerProfile, spec: LogSourceSpec): void {
    void subscribe(server, spec)
    setPickerFor(null)
    if (server.localProjectPath && activeTerminalId) {
      const escaped = server.localProjectPath.replace(/'/g, "'\\''")
      void window.api.terminal.write(activeTerminalId, `cd '${escaped}'\n`)
    }
  }

  const serverSources = (serverId: string) =>
    sources.filter((s) => s.serverId === serverId)

  return (
    <div className="text-sm h-full flex flex-col">
      <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-neutral-400 flex items-center justify-between border-b border-neutral-800/50">
        <span>Servers</span>
        <button
          onClick={() => {
            if (showForm || editingServer) {
              setShowForm(false)
              setEditingServer(null)
            } else {
              setShowForm(true)
            }
          }}
          className="text-neutral-500 hover:text-neutral-200 w-5 h-5 flex items-center justify-center"
          title={showForm || editingServer ? 'Cancel' : 'Add server'}
        >
          {showForm || editingServer ? '×' : '+'}
        </button>
      </div>

      {showForm && (
        <AddServerForm onSave={handleSave} onCancel={() => setShowForm(false)} />
      )}
      {editingServer && (
        <AddServerForm
          onSave={handleSave}
          onCancel={() => setEditingServer(null)}
          initialProfile={editingServer}
        />
      )}

      <ul className="flex-1 overflow-auto scrollbar-hidden">
        {servers.length === 0 && !showForm && (
          <li className="px-4 py-8 flex flex-col items-center gap-3 text-center">
            <div className="text-neutral-400 text-[11px] leading-relaxed">
              Stream remote server logs in<br />real-time over SSH
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs transition-colors"
            >
              + Add first server
            </button>
            <div className="text-neutral-500 text-[10px] leading-relaxed">
              Subscribes to /var/log/*.log<br />files via tail -F
            </div>
          </li>
        )}

        {servers.map((server) => {
          const active = serverSources(server.id)
          const pickerOpen = pickerFor === server.id

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
                  <div className="text-[11px] text-neutral-400 truncate">
                    {server.username}@{server.host}:{server.port}
                  </div>
                </div>
                <button
                  onClick={() => openPicker(server)}
                  className="text-neutral-500 hover:text-blue-400 mt-0.5 text-[11px] shrink-0 px-0.5"
                  title="Connect — File / Docker / Custom"
                >
                  ▶
                </button>
                <button
                  onClick={() => { setEditingServer(server); setShowForm(false) }}
                  className="text-neutral-500 hover:text-neutral-200 mt-0.5 text-[11px] shrink-0 px-0.5"
                  title="Edit"
                >
                  ✎
                </button>
                <button
                  onClick={() => setConfirmDelete(server.id)}
                  className="text-neutral-500 hover:text-red-400 mt-0.5 text-[11px] shrink-0 px-0.5"
                  title="Remove"
                >
                  ×
                </button>
              </div>

              {confirmDelete === server.id && (
                <div className="px-3 pb-1.5 flex items-center gap-2">
                  <span className="text-[11px] text-neutral-400 flex-1 truncate">
                    Delete <span className="text-neutral-200">{server.name}</span>?
                  </span>
                  <button
                    onClick={() => void handleRemove(server.id)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/60 hover:bg-red-800/70 text-red-300 transition-colors shrink-0"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 transition-colors shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {pickerOpen && (
                <SourcePicker
                  server={server}
                  initialPath={server.logPath}
                  onConnect={(spec) => handlePickerConnect(server, spec)}
                  onCancel={() => setPickerFor(null)}
                />
              )}

              {active.map((src) => {
                const idx = sources.indexOf(src)
                return (
                  <div key={src.sourceId}>
                    <div className="pl-4 pr-2 py-0.5 flex items-center gap-1.5 text-[11px] text-neutral-400">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: getSourceColor(idx) }}
                      />
                      <span className="flex-1 truncate">{src.path}</span>
                      {src.status === 'connecting' && (
                        <span className="text-neutral-500">…</span>
                      )}
                      <button
                        onClick={() => void unsubscribe(src.sourceId)}
                        className="text-neutral-600 hover:text-red-400 shrink-0"
                        title="Stop"
                      >
                        ■
                      </button>
                    </div>
                    {src.status === 'error' && (
                      <div className="pl-4 pr-2 pb-1.5 space-y-0.5">
                        <p className="text-[10px] text-red-400/80 leading-snug break-all">
                          {src.error ?? 'Connection error'}
                        </p>
                        <button
                          onClick={async () => {
                            const spec = src.spec
                            await unsubscribe(src.sourceId)
                            void subscribe(server, spec)
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    )}
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
