import type { AiBridgeRequest } from '@shared/types'
import { writePty } from '../pty/pty-manager'

/**
 * Routes selected log text (optionally with a template) into an active terminal
 * session so the user's running AI CLI (claude, codex, gemini …) receives it
 * as input. The terminal is the contract — anything that reads stdin works.
 */
export function sendToAiBridge(req: AiBridgeRequest): { ok: boolean } {
  const prefix = req.instruction ? `${req.instruction}\n\n` : ''
  const body = req.template ? req.template.replace('{{payload}}', req.payload) : req.payload
  const text = prefix + body
  writePty(req.terminalId, text)
  return { ok: true }
}
