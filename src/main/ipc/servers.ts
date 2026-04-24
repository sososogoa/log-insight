import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { ServerProfile } from '@shared/types'

const STORE_FILE = 'servers.json'

function storePath(): string {
  return join(app.getPath('userData'), STORE_FILE)
}

async function readStore(): Promise<ServerProfile[]> {
  try {
    const buf = await fs.readFile(storePath(), 'utf8')
    return JSON.parse(buf) as ServerProfile[]
  } catch {
    return []
  }
}

async function writeStore(list: ServerProfile[]): Promise<void> {
  await fs.writeFile(storePath(), JSON.stringify(list, null, 2), 'utf8')
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
