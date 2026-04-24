import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { Channels } from '@shared/ipc-channels'
import type {
  AiBridgeRequest,
  LogLine,
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
    subscribe: (server: ServerProfile, path: string): Promise<{ sourceId: string }> =>
      ipcRenderer.invoke(Channels.LogsSubscribe, { server, path }),
    unsubscribe: (sourceId: string): Promise<void> =>
      ipcRenderer.invoke(Channels.LogsUnsubscribe, sourceId),
    onLine: (cb: (line: LogLine) => void): (() => void) => {
      const handler = (_: unknown, line: LogLine): void => cb(line)
      ipcRenderer.on(Channels.LogsLine, handler)
      return () => ipcRenderer.off(Channels.LogsLine, handler)
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
