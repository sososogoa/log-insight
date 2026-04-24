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
  client: Client
  sourceId: string
}

const active = new Map<string, ActiveStream>()

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

async function toConnectConfig(p: ServerProfile): Promise<ConnectConfig> {
  const base: ConnectConfig = { host: p.host, port: p.port, username: p.username }
  if (p.authType === 'pem' && p.pemPath) {
    base.privateKey = await fs.readFile(p.pemPath)
  } else if (p.authType === 'password' && p.password) {
    base.password = p.password
  } else if (p.authType === 'agent') {
    base.agent = process.env.SSH_AUTH_SOCK
  }
  return base
}

export async function createSshLogStream(
  payload: SubscribePayload,
  sender: WebContents
): Promise<{ sourceId: string }> {
  const sourceId = payload.sourceId ?? randomUUID()
  const client = new Client()
  const config = await toConnectConfig(payload.server)

  await new Promise<void>((resolve, reject) => {
    client.once('ready', () => resolve())
    client.once('error', reject)
    client.connect(config)
  })

  client.exec(`tail -n 200 -F ${payload.path}`, (err, stream) => {
    if (err) {
      sender.send(Channels.LogsError, { sourceId, message: err.message })
      client.end()
      return
    }

    let buf = ''
    stream.on('data', (data: Buffer) => {
      buf += data.toString('utf8')
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const text of lines) {
        const line: LogLine = {
          id: randomUUID(),
          sourceId,
          timestamp: Date.now(),
          level: detectLevel(text),
          text,
          raw: text
        }
        sender.send(Channels.LogsLine, line)
      }
    })

    stream.stderr.on('data', (data: Buffer) => {
      sender.send(Channels.LogsError, { sourceId, message: data.toString('utf8') })
    })

    stream.on('close', () => {
      client.end()
      active.delete(sourceId)
    })
  })

  active.set(sourceId, { client, sourceId })
  return { sourceId }
}

export function stopLogStream(sourceId: string): void {
  const entry = active.get(sourceId)
  if (!entry) return
  entry.client.end()
  active.delete(sourceId)
}
