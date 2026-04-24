import type { AiBridgeRequest } from '@shared/types'
import { writePty } from '../pty/pty-manager'

export function sendToAiBridge(req: AiBridgeRequest): { ok: boolean; reason?: string } {
  const prefix = req.instruction ? `${req.instruction}\n\n` : ''
  const body = req.template ? req.template.replace('{{payload}}', req.payload) : req.payload
  const text = prefix + body
  const ok = writePty(req.terminalId, text)
  return ok ? { ok: true } : { ok: false, reason: '터미널 세션을 찾을 수 없습니다' }
}
