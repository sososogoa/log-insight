import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { ServerProfile } from '@shared/types'

const STORE_FILE = 'servers.json'
const ENC_PREFIX = 'enc:'

function storePath(): string {
  return join(app.getPath('userData'), STORE_FILE)
}

function encryptField(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) return value
  return ENC_PREFIX + safeStorage.encryptString(value).toString('base64')
}

function decryptField(value: string): string {
  if (!value.startsWith(ENC_PREFIX)) return value
  if (!safeStorage.isEncryptionAvailable()) return ''
  try {
    return safeStorage.decryptString(Buffer.from(value.slice(ENC_PREFIX.length), 'base64'))
  } catch {
    return ''
  }
}

async function readStore(): Promise<ServerProfile[]> {
  try {
    const buf = await fs.readFile(storePath(), 'utf8')
    const list = JSON.parse(buf) as ServerProfile[]
    return list.map((p) => ({
      ...p,
      ...(p.password !== undefined && { password: decryptField(p.password) })
    }))
  } catch {
    return []
  }
}

async function writeStore(list: ServerProfile[]): Promise<void> {
  const encrypted = list.map((p) => ({
    ...p,
    ...(p.password !== undefined && { password: encryptField(p.password) })
  }))
  const target = storePath()
  const tmp = target + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(encrypted, null, 2), 'utf8')
  await fs.rename(tmp, target)
}

export async function listServers(): Promise<ServerProfile[]> {
  return readStore()
}

export async function saveServer(profile: ServerProfile): Promise<ServerProfile[]> {
  const list = await readStore()
  const idx = list.findIndex((p) => p.id === profile.id)
  if (idx >= 0) list[idx] = profile
  else list.push(profile)
  await writeStore(list)
  return list
}

export async function removeServer(id: string): Promise<ServerProfile[]> {
  const list = (await readStore()).filter((p) => p.id !== id)
  await writeStore(list)
  return list
}
