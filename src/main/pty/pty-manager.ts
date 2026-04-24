import * as pty from 'node-pty'
import { randomUUID } from 'crypto'
import type { WebContents } from 'electron'
import { Channels } from '@shared/ipc-channels'
import type { TerminalSession } from '@shared/types'

interface Entry {
  id: string
  proc: pty.IPty
}

const sessions = new Map<string, Entry>()

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
    sender.send(Channels.TerminalData, { terminalId: id, chunk })
  })
  proc.onExit(({ exitCode }) => {
    sender.send(Channels.TerminalExit, { terminalId: id, code: exitCode })
    sessions.delete(id)
  })

  sessions.set(id, { id, proc })
  return {
    id,
    title: opts.title ?? shell.split('/').pop() ?? 'terminal',
    shell,
    cols: opts.cols ?? 120,
    rows: opts.rows ?? 30,
    cwd: opts.cwd
  }
}

export function writePty(id: string, data: string): void {
  sessions.get(id)?.proc.write(data)
}

export function resizePty(id: string, cols: number, rows: number): void {
  sessions.get(id)?.proc.resize(cols, rows)
}

export function disposePty(id: string): void {
  const entry = sessions.get(id)
  if (!entry) return
  try {
    entry.proc.kill()
  } catch {
    /* noop */
  }
  sessions.delete(id)
}
