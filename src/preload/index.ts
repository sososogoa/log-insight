import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { Channels } from '@shared/ipc-channels'
import type {
  AiBridgeRequest,
  Bookmark,
  DockerListResult,
  LogLine,
  LogSourceSpec,
  ServerProfile,
  TerminalSession
} from '@shared/types'

const api = {
  servers: {
    list: (): Promise<ServerProfile[]> => ipcRenderer.invoke(Channels.ServersList),
    save: (p: ServerProfile): Promise<ServerProfile[]> =>
      ipcRenderer.invoke(Channels.ServersSave, p),
    remove: (id: string): Promise<ServerProfile[]> =>
      ipcRenderer.invoke(Channels.ServersRemove, id)
  },
  logs: {
    subscribe: (
      server: ServerProfile,
      spec: LogSourceSpec
    ): Promise<{ sourceId: string }> =>
      ipcRenderer.invoke(Channels.LogsSubscribe, { server, spec }),
    unsubscribe: (sourceId: string): Promise<void> =>
      ipcRenderer.invoke(Channels.LogsUnsubscribe, sourceId),
    onLine: (cb: (line: LogLine) => void): (() => void) => {
      const handler = (_: unknown, line: LogLine): void => cb(line)
      ipcRenderer.on(Channels.LogsLine, handler)
      return () => ipcRenderer.off(Channels.LogsLine, handler)
    },
    onLineBatch: (cb: (lines: LogLine[]) => void): (() => void) => {
      const handler = (_: unknown, lines: LogLine[]): void => cb(lines)
      ipcRenderer.on(Channels.LogsLineBatch, handler)
      return () => ipcRenderer.off(Channels.LogsLineBatch, handler)
    },
    onError: (
      cb: (err: { sourceId: string; message: string }) => void
    ): (() => void) => {
      const handler = (_: unknown, payload: { sourceId: string; message: string }): void =>
        cb(payload)
      ipcRenderer.on(Channels.LogsError, handler)
      return () => ipcRenderer.off(Channels.LogsError, handler)
    }
  },
  terminal: {
    create: (opts: Partial<TerminalSession> = {}): Promise<TerminalSession> =>
      ipcRenderer.invoke(Channels.TerminalCreate, opts),
    write: (id: string, data: string): Promise<void> =>
      ipcRenderer.invoke(Channels.TerminalWrite, { id, data }),
    resize: (id: string, cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke(Channels.TerminalResize, { id, cols, rows }),
    dispose: (id: string): Promise<void> =>
      ipcRenderer.invoke(Channels.TerminalDispose, id),
    onData: (cb: (p: { terminalId: string; chunk: string }) => void): (() => void) => {
      const handler = (_: unknown, payload: { terminalId: string; chunk: string }): void =>
        cb(payload)
      ipcRenderer.on(Channels.TerminalData, handler)
      return () => ipcRenderer.off(Channels.TerminalData, handler)
    },
    onExit: (cb: (p: { terminalId: string; code: number }) => void): (() => void) => {
      const handler = (_: unknown, payload: { terminalId: string; code: number }): void =>
        cb(payload)
      ipcRenderer.on(Channels.TerminalExit, handler)
      return () => ipcRenderer.off(Channels.TerminalExit, handler)
    }
  },
  aiBridge: {
    send: (req: AiBridgeRequest): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke(Channels.AiBridgeSend, req)
  },
  dialog: {
    openFile: (
      filters: { name: string; extensions: string[] }[] = []
    ): Promise<string | null> => ipcRenderer.invoke(Channels.DialogOpenFile, filters),
    openFolder: (): Promise<string | null> => ipcRenderer.invoke(Channels.DialogOpenFolder)
  },
  ssh: {
    listDir: (
      server: ServerProfile,
      path: string
    ): Promise<{ path: string; entries: { name: string; isDir: boolean }[] }> =>
      ipcRenderer.invoke(Channels.SshListDir, { server, path }),
    test: (server: ServerProfile): Promise<{ ok: true }> =>
      ipcRenderer.invoke(Channels.SshTest, server),
    dockerList: (server: ServerProfile): Promise<DockerListResult> =>
      ipcRenderer.invoke(Channels.SshDockerList, server)
  },
  bookmarks: {
    list: (): Promise<Bookmark[]> => ipcRenderer.invoke(Channels.BookmarksList),
    save: (bm: Bookmark): Promise<Bookmark[]> =>
      ipcRenderer.invoke(Channels.BookmarksSave, bm),
    remove: (id: string): Promise<Bookmark[]> =>
      ipcRenderer.invoke(Channels.BookmarksRemove, id),
    clear: (): Promise<Bookmark[]> => ipcRenderer.invoke(Channels.BookmarksClear),
    exportMarkdown: (): Promise<{ ok: boolean; path?: string }> =>
      ipcRenderer.invoke(Channels.BookmarksExport)
  },
  shell: {
    openInEditor: (payload: {
      path: string
      line?: number
      column?: number
    }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(Channels.ShellOpenInEditor, payload)
  },
  menu: {
    onCommandPalette: (cb: () => void): (() => void) => {
      const handler = (): void => cb()
      ipcRenderer.on(Channels.MenuCommandPalette, handler)
      return () => ipcRenderer.off(Channels.MenuCommandPalette, handler)
    }
  }
}

export type LogInsightApi = typeof api

try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(err)
}
