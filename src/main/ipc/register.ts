import { ipcMain } from 'electron'
import { Channels } from '@shared/ipc-channels'
import { createSshLogStream, stopLogStream } from '../ssh/log-stream'
import { createPtySession, writePty, resizePty, disposePty } from '../pty/pty-manager'
import { sendToAiBridge } from './ai-bridge'
import { listServers, saveServer, removeServer } from './servers'

export function registerIpcHandlers(): void {
  ipcMain.handle(Channels.ServersList, () => listServers())
  ipcMain.handle(Channels.ServersSave, (_e, profile) => saveServer(profile))
  ipcMain.handle(Channels.ServersRemove, (_e, id: string) => removeServer(id))

  ipcMain.handle(Channels.LogsSubscribe, (e, payload) =>
    createSshLogStream(payload, e.sender)
  )
  ipcMain.handle(Channels.LogsUnsubscribe, (_e, sourceId: string) =>
    stopLogStream(sourceId)
  )

  ipcMain.handle(Channels.TerminalCreate, (e, opts) => createPtySession(opts, e.sender))
  ipcMain.handle(Channels.TerminalWrite, (_e, { id, data }) => writePty(id, data))
  ipcMain.handle(Channels.TerminalResize, (_e, { id, cols, rows }) =>
    resizePty(id, cols, rows)
  )
  ipcMain.handle(Channels.TerminalDispose, (_e, id: string) => disposePty(id))

  ipcMain.handle(Channels.AiBridgeSend, (_e, req) => sendToAiBridge(req))
}
