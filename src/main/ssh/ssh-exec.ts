import { Client, type ConnectConfig } from 'ssh2'
import { promises as fs } from 'fs'
import type {
  DockerContainer,
  DockerListResult,
  ServerProfile
} from '@shared/types'

export interface DirEntry {
  name: string
  isDir: boolean
}

interface ExecResult {
  stdout: string
  stderr: string
  code: number | null
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

async function sshExecFull(
  server: ServerProfile,
  command: string
): Promise<ExecResult> {
  const config = await toConnectConfig(server)
  return new Promise((resolve, reject) => {
    const client = new Client()
    let stdout = ''
    let stderr = ''

    client.once('ready', () => {
      client.exec(command, (err, stream) => {
        if (err) {
          client.end()
          return reject(err)
        }
        stream.on('data', (d: Buffer) => {
          stdout += d.toString('utf8')
        })
        stream.stderr.on('data', (d: Buffer) => {
          stderr += d.toString('utf8')
        })
        stream.on('close', (code: number | null) => {
          client.end()
          resolve({ stdout, stderr, code })
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

async function sshExec(server: ServerProfile, command: string): Promise<string> {
  const r = await sshExecFull(server, command)
  return r.stdout
}

export async function testConnection(server: ServerProfile): Promise<{ ok: true }> {
  const config = await toConnectConfig(server)
  await new Promise<void>((resolve, reject) => {
    const client = new Client()
    client.once('ready', () => {
      client.end()
      resolve()
    })
    client.once('error', (err) => {
      client.destroy()
      reject(err)
    })
    client.connect(config)
  })
  return { ok: true }
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

const DOCKER_PS_CMD =
  `docker ps --no-trunc --format '{{.Names}}\\t{{.ID}}\\t{{.Image}}\\t{{.Status}}'`

function parseDockerPs(stdout: string): DockerContainer[] {
  const out: DockerContainer[] = []
  for (const line of stdout.split('\n')) {
    const t = line.trim()
    if (!t) continue
    const [name, id, image, status] = t.split('\t')
    if (!name) continue
    out.push({ name, id: id ?? '', image: image ?? '', status: status ?? '' })
  }
  return out
}

function isPermissionError(stderr: string): boolean {
  const s = stderr.toLowerCase()
  return (
    s.includes('permission denied') ||
    s.includes('got permission denied while trying to connect') ||
    s.includes('dial unix /var/run/docker.sock')
  )
}

function isNotFoundError(stderr: string, code: number | null): boolean {
  const s = stderr.toLowerCase()
  return (
    code === 127 ||
    s.includes('command not found') ||
    s.includes('docker: not found') ||
    s.includes('no such file or directory')
  )
}

export async function listDockerContainers(
  server: ServerProfile
): Promise<DockerListResult> {
  const plain = await sshExecFull(server, DOCKER_PS_CMD).catch((e) => ({
    stdout: '',
    stderr: String(e),
    code: -1 as number | null
  }))

  if (plain.code === 0) {
    return {
      containers: parseDockerPs(plain.stdout),
      sudoRequired: false
    }
  }

  if (isNotFoundError(plain.stderr, plain.code)) {
    return {
      containers: [],
      sudoRequired: false,
      unavailable: true,
      error: 'docker 명령을 찾을 수 없습니다. Docker 가 설치됐는지 확인해주세요.'
    }
  }

  if (isPermissionError(plain.stderr)) {
    const sudoAttempt = await sshExecFull(
      server,
      `sudo -n ${DOCKER_PS_CMD}`
    ).catch((e) => ({
      stdout: '',
      stderr: String(e),
      code: -1 as number | null
    }))

    if (sudoAttempt.code === 0) {
      return {
        containers: parseDockerPs(sudoAttempt.stdout),
        sudoRequired: true
      }
    }

    const sudoErr = sudoAttempt.stderr.toLowerCase()
    if (sudoErr.includes('a password is required') || sudoErr.includes('sudo: a terminal')) {
      return {
        containers: [],
        sudoRequired: true,
        unavailable: true,
        error:
          'sudo 비밀번호가 필요합니다. 다음 중 하나를 해주세요:\n' +
          `  1) 사용자를 docker 그룹에 추가: sudo usermod -aG docker ${server.username} 후 재로그인\n` +
          '  2) /etc/sudoers 에 NOPASSWD 규칙 추가'
      }
    }

    return {
      containers: [],
      sudoRequired: true,
      unavailable: true,
      error: sudoAttempt.stderr.trim() || 'sudo docker ps 실패'
    }
  }

  return {
    containers: [],
    sudoRequired: false,
    unavailable: true,
    error: plain.stderr.trim() || `docker ps 실패 (exit ${plain.code})`
  }
}
