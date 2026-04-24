import { Client, type ConnectConfig } from 'ssh2'
import { promises as fs } from 'fs'
import type { WebContents } from 'electron'
import { randomUUID } from 'crypto'
import { Channels } from '@shared/ipc-channels'
import type { LogLevel, LogLine, ServerProfile } from '@shared/types'

interface SubscribePayload {
  server: ServerProfile
  path: string
  sourceId?: string
}

interface ActiveStream {
  client: Client | null
  sourceId: string
}

const active = new Map<string, ActiveStream>()
const stopped = new Set<string>()

const MAX_RETRIES = 6
const BASE_DELAY_MS = 1500
const BATCH_FLUSH_MS = 16

function detectLevel(line: string): LogLevel {
  const m = /\b(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|SEVERE)\b/i.exec(line)
  if (!m) return 'unknown'
  const t = m[1].toUpperCase()
  if (t.startsWith('WARN')) return 'warn'
  if (t === 'INFO') return 'info'
  if (t === 'DEBUG') return 'debug'
  if (t === 'TRACE') return 'trace'
  if (t === 'ERROR' || t === 'FATAL' || t === 'SEVERE') return 'error'
  return 'unknown'
}

function escapePath(p: string): string {
  return `'${p.replace(/'/g, "'\\''")}'`
}

async function toConnectConfig(p: ServerProfile): Promise<ConnectConfig> {
  const base: ConnectConfig = {
    host: p.host,
    port: p.port,
    username: p.username,
    readyTimeout: 15000,
    keepaliveInterval: 10000,
    keepaliveCountMax: 3
  }
  if (p.authType === 'pem' && p.pemPath) {
    base.privateKey = await fs.readFile(p.pemPath)
  } else if (p.authType === 'password' && p.password) {
    base.password = p.password
  } else if (p.authType === 'agent') {
    base.agent = process.env.SSH_AUTH_SOCK
  }
  return base
}

function scheduleReconnect(
  payload: SubscribePayload,
  sourceId: string,
  sender: WebContents,
  attempt: number,
  reason: string
): void {
  if (stopped.has(sourceId)) return
  if (attempt > MAX_RETRIES) {
    stopped.add(sourceId)
    setTimeout(() => stopped.delete(sourceId), 60_000)
    active.delete(sourceId)
    sender.send(Channels.LogsError, {
      sourceId,
      message: `연결 끊김 (재시도 ${MAX_RETRIES}회 초과): ${reason}`
    })
    return
  }
  const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), 30000)
  setTimeout(() => void connectAndStream(payload, sourceId, sender, attempt), delay)
}

async function connectAndStream(
  payload: SubscribePayload,
  sourceId: string,
  sender: WebContents,
  attempt: number
): Promise<void> {
  if (stopped.has(sourceId)) return

  const client = new Client()
  const config = await toConnectConfig(payload.server)

  try {
    await new Promise<void>((resolve, reject) => {
      client.once('ready', resolve)
      client.once('error', reject)
      client.connect(config)
    })
  } catch (err) {
    try { client.destroy() } catch { /* noop */ }
    if (attempt === 0) {
      active.delete(sourceId)
      throw err
    }
    scheduleReconnect(payload, sourceId, sender, attempt + 1, (err as Error).message)
    return
  }

  if (stopped.has(sourceId)) {
    client.end()
    return
  }

  active.set(sourceId, { client, sourceId })

  client.exec(`tail -n 200 -F ${escapePath(payload.path)}`, (err, stream) => {
    if (err) {
      sender.send(Channels.LogsError, { sourceId, message: err.message })
      client.end()
      scheduleReconnect(payload, sourceId, sender, attempt + 1, err.message)
      return
    }

    let buf = ''
    let pending: LogLine[] = []
    let flushTimer: NodeJS.Timeout | null = null

    function flush(): void {
      flushTimer = null
      if (pending.length === 0) return
      const batch = pending
      pending = []
      sender.send(Channels.LogsLineBatch, batch)
    }

    stream.on('data', (data: Buffer) => {
      buf += data.toString('utf8')
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      const now = Date.now()
      for (const text of lines) {
        if (stopped.has(sourceId)) return
        pending.push({
          id: randomUUID(),
          sourceId,
          timestamp: now,
          level: detectLevel(text),
          text
        })
      }
      if (pending.length > 0 && !flushTimer) {
        flushTimer = setTimeout(flush, BATCH_FLUSH_MS)
      }
    })

    stream.stderr.on('data', (data: Buffer) => {
      const msg = data.toString('utf8').trim()
      if (msg) sender.send(Channels.LogsError, { sourceId, message: msg })
    })

    stream.on('close', () => {
      if (flushTimer) { clearTimeout(flushTimer); flush() }
      client.end()
      scheduleReconnect(payload, sourceId, sender, attempt + 1, 'stream closed')
    })
  })
}

export async function createSshLogStream(
  payload: SubscribePayload,
  sender: WebContents
): Promise<{ sourceId: string }> {
  const sourceId = payload.sourceId ?? randomUUID()
  stopped.delete(sourceId)
  active.set(sourceId, { client: null, sourceId })

  await connectAndStream(payload, sourceId, sender, 0)
  return { sourceId }
}

export function stopLogStream(sourceId: string): void {
  stopped.add(sourceId)
  setTimeout(() => stopped.delete(sourceId), 60_000)
  const entry = active.get(sourceId)
  if (entry?.client) {
    try { entry.client.end() } catch { /* noop */ }
  }
  active.delete(sourceId)
}

export function stopAllStreams(): void {
  for (const sourceId of active.keys()) {
    stopLogStream(sourceId)
  }
}
