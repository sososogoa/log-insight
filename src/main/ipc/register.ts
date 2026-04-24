import { ipcMain } from 'electron'
import { Channels } from '@shared/ipc-channels'
import { createSshLogStream, stopLogStream } from '../ssh/log-stream'
import { createPtySession, writePty, resizePty, disposePty } from '../pty/pty-manager'
import { sendToAiBridge } from './ai-bridge'
import { listServers, saveServer, removeServer } from './servers'
import { openFileDialog, openFolderDialog } from './dialog'
import { listDir, listDockerContainers, testConnection } from '../ssh/ssh-exec'
import {
  listBookmarks,
  saveBookmark,
  removeBookmark,
  clearBookmarks,
  exportBookmarks
} from './bookmarks'
import { openInEditor } from './shell-ops'

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

  ipcMain.handle(Channels.DialogOpenFile, (_e, filters) => openFileDialog(filters))
  ipcMain.handle(Channels.DialogOpenFolder, () => openFolderDialog())
  ipcMain.handle(Channels.SshListDir, (_e, { server, path }) => listDir(server, path))
  ipcMain.handle(Channels.SshTest, (_e, server) => testConnection(server))
  ipcMain.handle(Channels.SshDockerList, (_e, server) => listDockerContainers(server))

  ipcMain.handle(Channels.BookmarksList, () => listBookmarks())
  ipcMain.handle(Channels.BookmarksSave, (_e, bm) => saveBookmark(bm))
  ipcMain.handle(Channels.BookmarksRemove, (_e, id: string) => removeBookmark(id))
  ipcMain.handle(Channels.BookmarksClear, () => clearBookmarks())
  ipcMain.handle(Channels.BookmarksExport, () => exportBookmarks())

  ipcMain.handle(Channels.ShellOpenInEditor, (_e, payload) => openInEditor(payload))
}
