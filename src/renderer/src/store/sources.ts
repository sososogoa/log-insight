import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { LogSourceSpec, ServerProfile } from '@shared/types'
import { useLogsStore } from './logs'
import { useCanvasesStore } from './canvases'

export interface ActiveSource {
  sourceId: string
  serverId: string
  serverName: string
  path: string
  kind: LogSourceSpec['kind']
  spec: LogSourceSpec
  status: 'connecting' | 'streaming' | 'error'
  error?: string
}

export interface RestoreSpec {
  serverId: string
  spec: LogSourceSpec
}

const SOURCE_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fb923c']

export function getSourceColor(index: number): string {
  return SOURCE_COLORS[index % SOURCE_COLORS.length]
}

function specToDisplay(spec: LogSourceSpec): { path: string; kind: LogSourceSpec['kind'] } {
  if (spec.kind === 'file') return { path: spec.path, kind: 'file' }
  if (spec.kind === 'docker')
    return { path: `docker:${spec.container}${spec.sudo ? ' (sudo)' : ''}`, kind: 'docker' }
  return { path: spec.label || spec.command, kind: 'custom' }
}

function specKey(serverId: string, spec: LogSourceSpec): string {
  if (spec.kind === 'file') return `${serverId}:file:${spec.path}`
  if (spec.kind === 'docker') return `${serverId}:docker:${spec.container}`
  return `${serverId}:custom:${spec.command}`
}

interface SourcesState {
  sources: ActiveSource[]
  /** 앱 재시작 시 자동 재연결 대상. subscribe/unsubscribe 와 동기화 유지 */
  restoreSpecs: RestoreSpec[]
  /** 한 번이라도 재연결 루틴이 실행됐는지 — 첫 부팅 가드 */
  restoreDone: boolean
  subscribe: (server: ServerProfile, spec: LogSourceSpec) => Promise<void>
  unsubscribe: (sourceId: string) => Promise<void>
  setError: (sourceId: string, error: string) => void
  pruneRestoreFor: (serverId: string) => void
  markRestoreDone: () => void
  clearRestoreSpecs: () => void
}

export const useSourcesStore = create<SourcesState>()(
  persist(
    (set, get) => ({
      sources: [],
      restoreSpecs: [],
      restoreDone: false,

      subscribe: async (server, spec) => {
        const key = specKey(server.id, spec)
        const existing = get().sources.find(
          (s) => specKey(s.serverId, s.spec) === key
        )
        if (existing) return

        const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const display = specToDisplay(spec)
        set((s) => ({
          sources: [
            ...s.sources,
            {
              sourceId: tempId,
              serverId: server.id,
              serverName: server.name,
              path: display.path,
              kind: display.kind,
              spec,
              status: 'connecting'
            }
          ],
          restoreSpecs: s.restoreSpecs.some(
            (r) => specKey(r.serverId, r.spec) === key
          )
            ? s.restoreSpecs
            : [...s.restoreSpecs, { serverId: server.id, spec }]
        }))

        try {
          const { sourceId } = await window.api.logs.subscribe(server, spec)
          set((s) => ({
            sources: s.sources.map((src) =>
              src.sourceId === tempId ? { ...src, sourceId, status: 'streaming' } : src
            )
          }))
          const title = `${server.name}:${
            spec.kind === 'file'
              ? spec.path.split('/').pop() ?? spec.path
              : spec.kind === 'docker'
                ? spec.container
                : spec.label
          }`
          useCanvasesStore.getState().openOrFocus(sourceId, title)
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
        const src = get().sources.find((s) => s.sourceId === sourceId)
        try {
          await window.api.logs.unsubscribe(sourceId)
        } catch {
          // main may have already cleaned up
        }
        set((s) => ({
          sources: s.sources.filter((x) => x.sourceId !== sourceId),
          restoreSpecs: src
            ? s.restoreSpecs.filter(
                (r) => specKey(r.serverId, r.spec) !== specKey(src.serverId, src.spec)
              )
            : s.restoreSpecs
        }))
        useLogsStore.getState().clearSource(sourceId)
        useCanvasesStore.getState().closeBySource(sourceId)
      },

      setError: (sourceId, error) =>
        set((s) => ({
          sources: s.sources.map((src) =>
            src.sourceId === sourceId ? { ...src, status: 'error', error } : src
          )
        })),

      pruneRestoreFor: (serverId) =>
        set((s) => ({
          restoreSpecs: s.restoreSpecs.filter((r) => r.serverId !== serverId)
        })),

      markRestoreDone: () => set({ restoreDone: true }),

      clearRestoreSpecs: () => set({ restoreSpecs: [] })
    }),
    {
      name: 'loginsight-sources',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ restoreSpecs: state.restoreSpecs }),
      merge: (persisted: unknown, current) => {
        const p = persisted as { restoreSpecs?: RestoreSpec[] }
        return {
          ...current,
          restoreSpecs: p?.restoreSpecs ?? [],
          sources: [],
          restoreDone: false
        }
      }
    }
  )
)
