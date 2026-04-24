import { Client, type ConnectConfig } from 'ssh2'
import { promises as fs } from 'fs'
import { StringDecoder } from 'string_decoder'
import type { WebContents } from 'electron'
import { randomUUID } from 'crypto'
import { Channels } from '@shared/ipc-channels'
import type {
  LogLevel,
  LogLine,
  LogSourceSpec,
  ServerProfile
} from '@shared/types'

interface SubscribePayload {
  server: ServerProfile
  spec: LogSourceSpec
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

const DOCKER_TS_RE =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s/

// CSI / OSC / single-char escapes. Strip before displaying because the browser
// treats ESC as non-printing, leaving the CSI parameters visible as garbage.
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1B\\)|[@-Z\\-_])/g

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}

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

function escapeContainerRef(ref: string): string {
  const cleaned = ref.replace(/[^a-zA-Z0-9_.\-]/g, '')
  return cleaned || '_invalid_'
}

function buildStreamCommand(spec: LogSourceSpec): string {
  if (spec.kind === 'file') {
    return `tail -n 200 -F ${escapePath(spec.path)}`
  }
  if (spec.kind === 'docker') {
    const container = escapeContainerRef(spec.container)
    const tail = Math.max(0, Math.min(10000, spec.tail ?? 200))
    const prefix = spec.sudo ? 'sudo -n ' : ''
    // --timestamps: parsed by parseIncomingLine and stripped from display.
    // No shell-level 2>&1 — stdout/stderr are read as separate ssh2 channels
    // because shell merging can break line boundaries across their buffers.
    return `${prefix}docker logs -f --tail ${tail} --timestamps ${container}`
  }
  return spec.command
}

function parseIncomingLine(
  rawText: string,
  spec: LogSourceSpec,
  fallback: number
): { text: string; timestamp: number } {
  const clean = stripAnsi(rawText)
  if (spec.kind === 'docker') {
    const m = DOCKER_TS_RE.exec(clean)
    if (m) {
      const ts = Date.parse(m[1])
      return {
        text: clean.slice(m[0].length),
        timestamp: Number.isFinite(ts) ? ts : fallback
      }
    }
  }
  return { text: clean, timestamp: fallback }
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

// StringDecoder keeps multibyte UTF-8 chars intact across chunk boundaries.
function attachLineReader(opts: {
  stream: NodeJS.ReadableStream
  sourceId: string
  spec: LogSourceSpec
  push: (line: LogLine) => void
  scheduleFlush: () => void
  onEnd: () => void
}): void {
  const decoder = new StringDecoder('utf8')
  let buf = ''

  function consume(chunk: string): void {
    if (!chunk) return
    buf += chunk
    buf = buf.replace(/\r\n/g, '\n').replace(/\r(?!\n)/g, '\n')
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    const now = Date.now()
    for (const rawText of lines) {
      if (stopped.has(opts.sourceId)) return
      if (rawText === '') continue
      const parsed = parseIncomingLine(rawText, opts.spec, now)
      opts.push({
        id: randomUUID(),
        sourceId: opts.sourceId,
        timestamp: parsed.timestamp,
        level: detectLevel(parsed.text),
        text: parsed.text
      })
    }
    opts.scheduleFlush()
  }

  opts.stream.on('data', (data: Buffer) => {
    consume(decoder.write(data))
  })
  opts.stream.on('end', () => {
    const tail = decoder.end()
    if (tail || buf) {
      consume(tail)
      // flush trailing partial line on stream close
      if (buf) {
        if (!stopped.has(opts.sourceId)) {
          const parsed = parseIncomingLine(buf, opts.spec, Date.now())
          opts.push({
            id: randomUUID(),
            sourceId: opts.sourceId,
            timestamp: parsed.timestamp,
            level: detectLevel(parsed.text),
            text: parsed.text
          })
        }
        buf = ''
      }
      opts.scheduleFlush()
    }
    opts.onEnd()
  })
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

  client.exec(buildStreamCommand(payload.spec), (err, stream) => {
    if (err) {
      sender.send(Channels.LogsError, { sourceId, message: err.message })
      client.end()
      scheduleReconnect(payload, sourceId, sender, attempt + 1, err.message)
      return
    }

    let pending: LogLine[] = []
    let flushTimer: NodeJS.Timeout | null = null

    function flush(): void {
      flushTimer = null
      if (pending.length === 0) return
      const batch = pending
      pending = []
      sender.send(Channels.LogsLineBatch, batch)
    }

    function scheduleFlush(): void {
      if (pending.length > 0 && !flushTimer) {
        flushTimer = setTimeout(flush, BATCH_FLUSH_MS)
      }
    }

    let endedStreams = 0
    const END_NEEDED = 2 // stdout + stderr
    function onEnd(): void {
      endedStreams++
      if (endedStreams >= END_NEEDED) {
        if (flushTimer) { clearTimeout(flushTimer); flush() }
        client.end()
        scheduleReconnect(payload, sourceId, sender, attempt + 1, 'stream closed')
      }
    }

    attachLineReader({
      stream,
      sourceId,
      spec: payload.spec,
      push: (line) => pending.push(line),
      scheduleFlush,
      onEnd
    })

    // stderr is also a log source (docker often writes to it); default level
    // becomes 'error' when the line has no explicit level marker.
    attachLineReader({
      stream: stream.stderr,
      sourceId,
      spec: payload.spec,
      push: (line) => {
        if (line.level === 'unknown') line.level = 'error'
        pending.push(line)
      },
      scheduleFlush,
      onEnd
    })

    stream.on('close', () => {
      if (flushTimer) { clearTimeout(flushTimer); flush() }
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
