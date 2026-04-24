import { create } from 'zustand'
import type { ServerProfile } from '@shared/types'

export interface ActiveSource {
  sourceId: string
  serverId: string
  serverName: string
  path: string
  status: 'connecting' | 'streaming' | 'error'
  error?: string
}

const SOURCE_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fb923c']

export function getSourceColor(index: number): string {
  return SOURCE_COLORS[index % SOURCE_COLORS.length]
}

interface SourcesState {
  sources: ActiveSource[]
  subscribe: (server: ServerProfile, path: string) => Promise<void>
  unsubscribe: (sourceId: string) => Promise<void>
  setError: (sourceId: string, error: string) => void
}

export const useSourcesStore = create<SourcesState>((set, get) => ({
  sources: [],

  subscribe: async (server, path) => {
    const existing = get().sources.find(
      (s) => s.serverId === server.id && s.path === path
    )
    if (existing) return

    const tempId = `pending-${Date.now()}`
    set((s) => ({
      sources: [
        ...s.sources,
        {
          sourceId: tempId,
          serverId: server.id,
          serverName: server.name,
          path,
          status: 'connecting'
        }
      ]
    }))

    try {
      const { sourceId } = await window.api.logs.subscribe(server, path)
      set((s) => ({
        sources: s.sources.map((src) =>
          src.sourceId === tempId ? { ...src, sourceId, status: 'streaming' } : src
        )
      }))
    } catch (err) {
      set((s) => ({
        sources: s.sources.map((src) =>
          src.sourceId === tempId
            ? { ...src, status: 'error', error: String(err) }
            : src
        )
      }))
    }
  },

  unsubscribe: async (sourceId) => {
    try {
      await window.api.logs.unsubscribe(sourceId)
    } catch {
      // ignore — main process may have already cleaned up
    }
    set((s) => ({ sources: s.sources.filter((src) => src.sourceId !== sourceId) }))
  },

  setError: (sourceId, error) =>
    set((s) => ({
      sources: s.sources.map((src) =>
        src.sourceId === sourceId ? { ...src, status: 'error', error } : src
      )
    }))
}))
