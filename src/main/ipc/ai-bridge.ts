import type { AiBridgeRequest } from '@shared/types'
import { writePty } from '../pty/pty-manager'

export function sendToAiBridge(req: AiBridgeRequest): { ok: boolean; reason?: string } {
  const prefix = req.instruction ? `${req.instruction}\n\n` : ''
  const ok = writePty(req.terminalId, prefix + req.payload)
  return ok ? { ok: true } : { ok: false, reason: '터미널 세션을 찾을 수 없습니다' }
}
