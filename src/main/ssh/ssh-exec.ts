import { Client, type ConnectConfig } from 'ssh2'
import { promises as fs } from 'fs'
import type { ServerProfile } from '@shared/types'

export interface DirEntry {
  name: string
  isDir: boolean
}

async function toConnectConfig(p: ServerProfile): Promise<ConnectConfig> {
  const base: ConnectConfig = { host: p.host, port: p.port, username: p.username, readyTimeout: 10000 }
  if (p.authType === 'pem' && p.pemPath) {
    base.privateKey = await fs.readFile(p.pemPath)
  } else if (p.authType === 'password' && p.password) {
    base.password = p.password
  } else if (p.authType === 'agent') {
    base.agent = process.env.SSH_AUTH_SOCK
  }
  return base
}

async function sshExec(server: ServerProfile, command: string): Promise<string> {
  const config = await toConnectConfig(server)
  return new Promise((resolve, reject) => {
    const client = new Client()
    let output = ''

    client.once('ready', () => {
      client.exec(command, (err, stream) => {
        if (err) {
          client.end()
          return reject(err)
        }
        stream.on('data', (d: Buffer) => { output += d.toString('utf8') })
        stream.stderr.on('data', () => {})
        stream.on('close', () => {
          client.end()
          resolve(output)
        })
      })
    })
    client.once('error', (err) => {
      client.end()
      reject(err)
    })
    client.connect(config)
  })
}

export async function listDir(
  server: ServerProfile,
  path: string
): Promise<{ path: string; entries: DirEntry[] }> {
  const safePath = path.replace(/'/g, "'\\''")
  const output = await sshExec(server, `ls -1ap '${safePath}' 2>/dev/null`)
  const entries: DirEntry[] = output
    .split('\n')
    .filter((l) => l && l !== './' && l !== '../')
    .map((l) => ({
      name: l.endsWith('/') ? l.slice(0, -1) : l,
      isDir: l.endsWith('/')
    }))
  return { path, entries }
}
