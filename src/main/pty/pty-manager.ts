import * as pty from 'node-pty'
import { randomUUID } from 'crypto'
import type { WebContents } from 'electron'
import { Channels } from '@shared/ipc-channels'
import type { TerminalSession } from '@shared/types'

interface Entry {
  id: string
  proc: pty.IPty
  sender: WebContents
}

const sessions = new Map<string, Entry>()
let shuttingDown = false

function safeSend(sender: WebContents, channel: string, payload: unknown): void {
  if (shuttingDown) return
  if (sender.isDestroyed()) return
  try {
    sender.send(channel, payload)
  } catch {
    // webContents may be torn down between the isDestroyed check and send
  }
}

export function createPtySession(
  opts: Partial<TerminalSession>,
  sender: WebContents
): TerminalSession {
  const id = opts.id ?? randomUUID()
  const shell =
    opts.shell ??
    process.env.SHELL ??
    (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh')
  const proc = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: opts.cols ?? 120,
    rows: opts.rows ?? 30,
    cwd: opts.cwd ?? process.env.HOME ?? process.cwd(),
    env: process.env as Record<string, string>
  })

  proc.onData((chunk) => {
    safeSend(sender, Channels.TerminalData, { terminalId: id, chunk })
  })
  proc.onExit(({ exitCode }) => {
    safeSend(sender, Channels.TerminalExit, { terminalId: id, code: exitCode })
    sessions.delete(id)
  })

  // If the host window goes away (dev server kill, user closes the window on
  // non-darwin), reap this session eagerly instead of waiting for shell exit.
  sender.once('destroyed', () => {
    const entry = sessions.get(id)
    if (!entry) return
    try { entry.proc.kill() } catch { /* noop */ }
    sessions.delete(id)
  })

  sessions.set(id, { id, proc, sender })
  return {
    id,
    title: opts.title ?? shell.split('/').pop() ?? 'terminal',
    shell,
    cols: opts.cols ?? 120,
    rows: opts.rows ?? 30,
    cwd: opts.cwd
  }
}

export function writePty(id: string, data: string): boolean {
  const entry = sessions.get(id)
  if (!entry) return false
  entry.proc.write(data)
  return true
}

export function resizePty(id: string, cols: number, rows: number): void {
  sessions.get(id)?.proc.resize(cols, rows)
}

export function disposePty(id: string): void {
  const entry = sessions.get(id)
  if (!entry) return
  try { entry.proc.kill() } catch { /* noop */ }
  sessions.delete(id)
}

export function disposeAll(): void {
  shuttingDown = true
  for (const entry of sessions.values()) {
    try { entry.proc.kill() } catch { /* noop */ }
  }
  sessions.clear()
}
