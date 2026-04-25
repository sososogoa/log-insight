import { useEffect, useState } from 'react'
import type {
  DockerContainer,
  DockerListResult,
  LogSourceSpec,
  ServerProfile
} from '@shared/types'

type Mode = 'file' | 'docker' | 'custom'

interface Props {
  server: ServerProfile
  initialPath?: string
  onConnect: (spec: LogSourceSpec) => void
  onCancel: () => void
}

export function SourcePicker({
  server,
  initialPath,
  onConnect,
  onCancel
}: Props): JSX.Element {
  const [mode, setMode] = useState<Mode>('file')
  const [filePath, setFilePath] = useState(initialPath ?? '')
  const [customCmd, setCustomCmd] = useState('')
  const [customLabel, setCustomLabel] = useState('')

  const [dockerLoading, setDockerLoading] = useState(false)
  const [dockerResult, setDockerResult] = useState<DockerListResult | null>(null)
  const [dockerTail, setDockerTail] = useState(200)
  const [dockerContainer, setDockerContainer] = useState<DockerContainer | null>(null)

  async function loadDocker(): Promise<void> {
    setDockerLoading(true)
    setDockerResult(null)
    try {
      const res = await window.api.ssh.dockerList(server)
      setDockerResult(res)
      if (res.containers.length > 0 && !dockerContainer) {
        setDockerContainer(res.containers[0])
      }
    } catch (err) {
      setDockerResult({
        containers: [],
        sudoRequired: false,
        unavailable: true,
        error: String(err)
      })
    } finally {
      setDockerLoading(false)
    }
  }

  useEffect(() => {
    if (mode === 'docker' && !dockerResult && !dockerLoading) {
      void loadDocker()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function handleConnect(): void {
    if (mode === 'file') {
      const p = filePath.trim()
      if (!p) return
      onConnect({ kind: 'file', path: p })
      return
    }
    if (mode === 'docker') {
      if (!dockerContainer) return
      onConnect({
        kind: 'docker',
        container: dockerContainer.name,
        tail: dockerTail,
        sudo: dockerResult?.sudoRequired
      })
      return
    }
    const cmd = customCmd.trim()
    if (!cmd) return
    onConnect({
      kind: 'custom',
      command: cmd,
      label: customLabel.trim() || cmd.slice(0, 30)
    })
  }

  return (
    <div className="px-3 pb-2 space-y-2">
      <div className="flex gap-0.5 bg-neutral-900 rounded p-0.5">
        {(['file', 'docker', 'custom'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 text-[11px] py-1 rounded transition-colors ${
              mode === m
                ? 'bg-neutral-700 text-neutral-100'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {m === 'file' ? '📄 File' : m === 'docker' ? '🐳 Docker' : '⚙ Custom'}
          </button>
        ))}
      </div>

      {mode === 'file' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleConnect()
          }}
        >
          <input
            autoFocus
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-500"
            placeholder="/var/log/app.log"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancel()
            }}
          />
        </form>
      )}

      {mode === 'docker' && (
        <div className="space-y-1.5">
          {dockerLoading && (
            <div className="text-[11px] text-neutral-500 italic px-1">
              Loading container list…
            </div>
          )}
          {!dockerLoading && dockerResult?.unavailable && (
            <div className="text-[11px] text-red-400/90 px-1 py-1 whitespace-pre-wrap leading-snug">
              {dockerResult.error || 'Docker is unavailable.'}
            </div>
          )}
          {!dockerLoading && dockerResult && !dockerResult.unavailable && dockerResult.containers.length === 0 && (
            <div className="text-[11px] text-neutral-500 px-1">
              No running containers.
            </div>
          )}
          {!dockerLoading && dockerResult && dockerResult.containers.length > 0 && (
            <>
              {dockerResult.sudoRequired && (
                <div className="text-[10px] text-amber-300/90 px-1">
                  ℹ Accessing with sudo privileges
                </div>
              )}
              <select
                autoFocus
                className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={dockerContainer?.name ?? ''}
                onChange={(e) => {
                  const c = dockerResult.containers.find((x) => x.name === e.target.value)
                  if (c) setDockerContainer(c)
                }}
              >
                {dockerResult.containers.map((c) => (
                  <option key={c.id || c.name} value={c.name}>
                    {c.name}  ·  {c.image}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                <label className="flex items-center gap-1">
                  <span>--tail</span>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    step={100}
                    className="w-20 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-xs"
                    value={dockerTail}
                    onChange={(e) =>
                      setDockerTail(Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </label>
                <button
                  onClick={() => void loadDocker()}
                  className="text-[11px] text-neutral-500 hover:text-neutral-300 ml-auto"
                  title="Refresh container list"
                >
                  ↻ refresh
                </button>
              </div>
            </>
          )}
          {!dockerResult && !dockerLoading && (
            <button
              onClick={() => void loadDocker()}
              className="text-[11px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 w-full"
            >
              Load container list
            </button>
          )}
        </div>
      )}

      {mode === 'custom' && (
        <div className="space-y-1.5">
          <input
            autoFocus
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-500"
            placeholder="journalctl -fu myapp"
            value={customCmd}
            onChange={(e) => setCustomCmd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancel()
            }}
          />
          <input
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-500"
            placeholder="Display name (optional): myapp-journal"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
          />
          <div className="text-[10px] text-neutral-500">
            ⚠ Executed as-is in the SSH session. Command safety is the server's responsibility.
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-[11px] px-2 py-1 rounded text-neutral-400 hover:text-neutral-200"
        >
          Cancel
        </button>
        <button
          onClick={handleConnect}
          disabled={
            (mode === 'file' && !filePath.trim()) ||
            (mode === 'docker' && !dockerContainer) ||
            (mode === 'custom' && !customCmd.trim())
          }
          className="text-[11px] px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
        >
          Connect
        </button>
      </div>
    </div>
  )
}
