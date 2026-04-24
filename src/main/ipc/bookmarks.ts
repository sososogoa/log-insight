import { app, dialog } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { Bookmark } from '@shared/types'

const STORE_FILE = 'bookmarks.json'

function storePath(): string {
  return join(app.getPath('userData'), STORE_FILE)
}

async function readStore(): Promise<Bookmark[]> {
  try {
    const buf = await fs.readFile(storePath(), 'utf8')
    return JSON.parse(buf) as Bookmark[]
  } catch {
    return []
  }
}

async function writeStore(list: Bookmark[]): Promise<void> {
  const target = storePath()
  const tmp = target + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8')
  await fs.rename(tmp, target)
}

export async function listBookmarks(): Promise<Bookmark[]> {
  return readStore()
}

export async function saveBookmark(bm: Bookmark): Promise<Bookmark[]> {
  const list = await readStore()
  const idx = list.findIndex((b) => b.id === bm.id)
  if (idx >= 0) list[idx] = bm
  else list.unshift(bm) // newest first
  await writeStore(list)
  return list
}

export async function removeBookmark(id: string): Promise<Bookmark[]> {
  const list = (await readStore()).filter((b) => b.id !== id)
  await writeStore(list)
  return list
}

export async function clearBookmarks(): Promise<Bookmark[]> {
  await writeStore([])
  return []
}

function levelBadge(level: string): string {
  switch (level) {
    case 'error':
      return '🔴'
    case 'warn':
      return '🟡'
    case 'info':
      return '🔵'
    case 'debug':
      return '⚪'
    default:
      return '·'
  }
}

function fmtTs(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z')
}

function renderMarkdown(list: Bookmark[]): string {
  const now = new Date().toISOString()
  const lines: string[] = []
  lines.push(`# LogInsight 인시던트 리포트`)
  lines.push('')
  lines.push(`> 생성 시각: ${now}`)
  lines.push(`> 북마크 수: ${list.length}`)
  lines.push('')

  const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt)
  for (const bm of sorted) {
    lines.push(`## ${fmtTs(bm.createdAt)}${bm.note ? ` — ${bm.note}` : ''}`)
    lines.push('')
    lines.push('```log')
    for (const l of bm.lines) {
      const src = l.sourceLabel ? `[${l.sourceLabel}] ` : ''
      lines.push(`${levelBadge(l.level)} ${fmtTs(l.timestamp)} ${src}${l.text}`)
    }
    lines.push('```')
    lines.push('')
  }
  return lines.join('\n')
}

export async function exportBookmarks(): Promise<{ ok: boolean; path?: string }> {
  const list = await readStore()
  if (list.length === 0) return { ok: false }
  const res = await dialog.showSaveDialog({
    title: '북마크 Markdown 내보내기',
    defaultPath: `loginsight-report-${new Date().toISOString().slice(0, 10)}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false }
  await fs.writeFile(res.filePath, renderMarkdown(list), 'utf8')
  return { ok: true, path: res.filePath }
}
