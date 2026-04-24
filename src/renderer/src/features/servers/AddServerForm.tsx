import { useState } from 'react'
import type { ServerProfile } from '@shared/types'

interface Props {
  onSave: (profile: ServerProfile) => Promise<void>
  onCancel?: () => void
}

const ENVS = ['prod', 'staging', 'dev', 'local'] as const

interface DirEntry {
  name: string
  isDir: boolean
}

interface BrowserState {
  path: string
  entries: DirEntry[]
  loading: boolean
  error: string
}

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

function buildTempServer(
  form: ReturnType<typeof emptyForm>
): ServerProfile {
  return {
    id: 'temp',
    name: 'temp',
    host: form.host,
    port: form.port,
    username: form.username,
    authType: form.authType,
    ...(form.password && { password: form.password }),
    ...(form.pemPath && { pemPath: form.pemPath })
  }
}

function joinPath(base: string, name: string): string {
  return base.endsWith('/') ? base + name : base + '/' + name
}

function parentPath(path: string): string {
  if (path === '/') return '/'
  const parts = path.replace(/\/$/, '').split('/')
  parts.pop()
  return parts.join('/') || '/'
}

export function AddServerForm({ onSave }: Props): JSX.Element {
  const [form, setForm] = useState(emptyForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showBrowser, setShowBrowser] = useState(false)
  const [browser, setBrowser] = useState<BrowserState>({
    path: '/var/log',
    entries: [],
    loading: false,
    error: ''
  })

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'required'
    if (!form.host.trim()) errs.host = 'required'
    if (!form.username.trim()) errs.username = 'required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
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
    await onSave(profile)
  }

  async function pickPemFile(): Promise<void> {
    const path = await window.api.dialog.openFile([
      { name: 'PEM / Key files', extensions: ['pem', 'key', 'ppk', ''] }
    ])
    if (path) setForm((f) => ({ ...f, pemPath: path }))
  }

  async function loadDir(path: string): Promise<void> {
    setBrowser((b) => ({ ...b, loading: true, error: '' }))
    try {
      const result = await window.api.ssh.listDir(buildTempServer(form), path)
      setBrowser({ path: result.path, entries: result.entries, loading: false, error: '' })
    } catch (err) {
      setBrowser((b) => ({
        ...b,
        loading: false,
        error: String(err).replace('Error: ', '')
      }))
    }
  }

  async function openBrowser(): Promise<void> {
    if (!form.host || !form.username) {
      setErrors((e) => ({ ...e, host: 'Fill host + username first' }))
      return
    }
    setShowBrowser(true)
    await loadDir(browser.path)
  }

  function selectFile(name: string): void {
    setForm((f) => ({ ...f, logPath: joinPath(browser.path, name) }))
    setShowBrowser(false)
  }

  const inputCls = (field?: string) =>
    `w-full bg-neutral-900 border ${
      field && errors[field] ? 'border-red-500/60' : 'border-neutral-800'
    } rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-neutral-600`

  return (
    <form
      onSubmit={handleSubmit}
      className="px-2 py-2 space-y-1.5 border-b border-neutral-800 bg-neutral-950/50 shrink-0"
    >
      {/* Name */}
      <input
        className={inputCls('name')}
        placeholder="Name *"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        autoFocus
      />

      {/* Host + Port */}
      <div className="flex gap-1">
        <div className="flex-1">
          <input
            className={inputCls('host')}
            placeholder="1.2.3.4 or hostname *"
            value={form.host}
            onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
          />
          {errors.host && (
            <p className="text-[10px] text-red-400 mt-0.5">{errors.host}</p>
          )}
        </div>
        <input
          className="w-14 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
          type="number"
          value={form.port}
          onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) || 22 }))}
        />
      </div>

      {/* Username */}
      <input
        className={inputCls('username')}
        placeholder="username * (e.g. ubuntu, ec2-user)"
        value={form.username}
        onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
      />

      {/* Auth type */}
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

      {/* Password */}
      {form.authType === 'password' && (
        <input
          className={inputCls()}
          placeholder="password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        />
      )}

      {/* PEM file picker */}
      {form.authType === 'pem' && (
        <div className="flex gap-1">
          <input
            className={inputCls()}
            placeholder="/path/to/key.pem"
            value={form.pemPath}
            onChange={(e) => setForm((f) => ({ ...f, pemPath: e.target.value }))}
            readOnly
          />
          <button
            type="button"
            onClick={pickPemFile}
            className="shrink-0 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded px-2 py-1 text-[11px] text-neutral-300 transition-colors"
          >
            Browse
          </button>
        </div>
      )}

      {/* Log path */}
      <div className="flex gap-1">
        <input
          className={inputCls()}
          placeholder="/var/log/app.log"
          value={form.logPath}
          onChange={(e) => setForm((f) => ({ ...f, logPath: e.target.value }))}
        />
        <button
          type="button"
          onClick={openBrowser}
          className="shrink-0 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded px-2 py-1 text-[11px] text-neutral-300 transition-colors"
          title="Browse server filesystem"
        >
          Browse
        </button>
      </div>

      {/* Remote file browser */}
      {showBrowser && (
        <div className="border border-neutral-800 rounded bg-neutral-950 text-[11px]">
          <div className="flex items-center gap-1 px-2 py-1 border-b border-neutral-800 text-neutral-500">
            <button
              type="button"
              onClick={() => loadDir(parentPath(browser.path))}
              className="hover:text-neutral-200"
              title="Up"
            >
              ↑
            </button>
            <span className="flex-1 truncate text-neutral-400">{browser.path}</span>
            <button
              type="button"
              onClick={() => setShowBrowser(false)}
              className="hover:text-neutral-200"
            >
              ×
            </button>
          </div>

          {browser.loading && (
            <div className="px-2 py-2 text-neutral-600">Loading…</div>
          )}
          {browser.error && (
            <div className="px-2 py-1.5 text-red-400 text-[10px] leading-snug">
              {browser.error}
            </div>
          )}

          {!browser.loading && !browser.error && (
            <ul className="max-h-36 overflow-auto">
              {browser.entries.length === 0 && (
                <li className="px-2 py-1.5 text-neutral-600">Empty</li>
              )}
              {browser.entries.map((entry) => (
                <li key={entry.name}>
                  <button
                    type="button"
                    onClick={() =>
                      entry.isDir
                        ? loadDir(joinPath(browser.path, entry.name))
                        : selectFile(entry.name)
                    }
                    className="w-full text-left px-2 py-0.5 hover:bg-neutral-900 flex items-center gap-1.5"
                  >
                    <span className={entry.isDir ? 'text-neutral-500' : 'text-neutral-600'}>
                      {entry.isDir ? '▸' : '·'}
                    </span>
                    <span className={entry.isDir ? 'text-neutral-300' : 'text-neutral-400'}>
                      {entry.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Env */}
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
  )
}
