import { create } from 'zustand'
import type { ServerProfile } from '@shared/types'
import { useSourcesStore } from './sources'

interface ServersState {
  servers: ServerProfile[]
  loaded: boolean
  load: () => Promise<void>
  save: (p: ServerProfile) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useServersStore = create<ServersState>((set) => ({
  servers: [],
  loaded: false,
  load: async () => {
    const servers = await window.api.servers.list()
    set({ servers, loaded: true })
  },
  save: async (p) => {
    const servers = await window.api.servers.save(p)
    set({ servers })
  },
  remove: async (id) => {
    const servers = await window.api.servers.remove(id)
    set({ servers })
    useSourcesStore.getState().pruneRestoreFor(id)
  }
}))
