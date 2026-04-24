import { create } from 'zustand'
import type { LogSourceSpec, ServerProfile } from '@shared/types'
import { useLogsStore } from './logs'
import { useCanvasesStore } from './canvases'

export interface ActiveSource {
  sourceId: string
  serverId: string
  serverName: string
  /** 표시용 레이블 — file: path, docker: container, custom: label */
  path: string
  /** 어떤 종류의 소스인지 — UI 아이콘/뱃지용 */
  kind: LogSourceSpec['kind']
  /** 재연결·재시도용 원본 spec */
  spec: LogSourceSpec
  status: 'connecting' | 'streaming' | 'error'
  error?: string
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
  subscribe: (server: ServerProfile, spec: LogSourceSpec) => Promise<void>
  unsubscribe: (sourceId: string) => Promise<void>
  setError: (sourceId: string, error: string) => void
}

export const useSourcesStore = create<SourcesState>((set, get) => ({
  sources: [],

  subscribe: async (server, spec) => {
    const key = specKey(server.id, spec)
    const existing = get().sources.find(
      (s) => specKey(s.serverId, s.spec) === key
    )
    if (existing) return

    const tempId = `pending-${Date.now()}`
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
      ]
    }))

    try {
      const { sourceId } = await window.api.logs.subscribe(server, spec)
      set((s) => ({
        sources: s.sources.map((src) =>
          src.sourceId === tempId ? { ...src, sourceId, status: 'streaming' } : src
        )
      }))
      // 새 소스가 연결되면 대응되는 Canvas 를 자동으로 열고 포커스
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
    try {
      await window.api.logs.unsubscribe(sourceId)
    } catch {
      // ignore — main process may have already cleaned up
    }
    set((s) => ({ sources: s.sources.filter((src) => src.sourceId !== sourceId) }))
    useLogsStore.getState().clearSource(sourceId)
    useCanvasesStore.getState().closeBySource(sourceId)
  },

  setError: (sourceId, error) =>
    set((s) => ({
      sources: s.sources.map((src) =>
        src.sourceId === sourceId ? { ...src, status: 'error', error } : src
      )
    }))
}))

