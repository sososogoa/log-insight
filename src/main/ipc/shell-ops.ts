import { shell } from 'electron'

// Jumps via the vscode://file URL scheme so we never exec the renderer-supplied path.
// Cursor and other VS Code forks register the same scheme.
export async function openInEditor(payload: {
  path: string
  line?: number
  column?: number
}): Promise<{ ok: boolean; error?: string }> {
  const { path: p, line, column } = payload
  if (!p) return { ok: false, error: 'empty path' }

  const loc = line ? `:${line}${column ? `:${column}` : ''}` : ''
  const url = `vscode://file${p.startsWith('/') ? '' : '/'}${p}${loc}`
  try {
    await shell.openExternal(url)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
