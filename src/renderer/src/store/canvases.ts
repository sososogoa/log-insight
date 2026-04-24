import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { FilterRule, LogLevel } from '@shared/types'
import {
  addCanvasToLeaf,
  collectLeaves,
  findLeafById,
  findLeafOf,
  makeLeaf,
  mapLayout,
  removeCanvasFromTree,
  splitLeaf,
  type FloatingRect,
  type LayoutLeaf,
  type LayoutNode
} from './layout'

export interface CanvasState {
  id: string
  sourceId: string
  title: string
  filters: FilterRule[]
  levelFilter: Set<LogLevel>
  grouping: boolean
  focusFingerprint: string | null
  expandedGroups: Set<string>
  selected: Set<string>
  customInstruction: string | null
  minimized: boolean
  colorSeed: number
}

export interface WorkspacePreset {
  id: string
  name: string
  createdAt: number
  layout: LayoutNode
  floatingIds: string[]
  floatingRects: Record<string, FloatingRect>
  canvases: {
    id: string
    sourceId: string
    title: string
    filters: FilterRule[]
    levelFilter: LogLevel[]
    grouping: boolean
    customInstruction: string | null
    colorSeed: number
  }[]
}

export interface CanvasesState {
  byId: Record<string, CanvasState>
  order: string[]
  activeId: string
  maximizedId: string | null

  layout: LayoutNode
  floatingIds: string[]
  floatingRects: Record<string, FloatingRect>
  /** z-index stacking: increments on front-bring so newer beats older */
  zCounter: number

  activeLeafId: string

  presets: WorkspacePreset[]

  open: (sourceId: string, title: string) => string
  openOrFocus: (sourceId: string, title: string) => string
  close: (canvasId: string) => void
  closeBySource: (sourceId: string) => void
  setActive: (canvasId: string) => void
  focusSource: (sourceId: string) => void
  reorder: (from: number, to: number) => void
  toggleMinimize: (canvasId: string) => void
  toggleMaximize: (canvasId: string) => void

  /* filter ops */
  setFilters: (canvasId: string, filters: FilterRule[]) => void
  addFilter: (canvasId: string, rule: FilterRule) => void
  updateFilter: (canvasId: string, rule: FilterRule) => void
  removeFilter: (canvasId: string, ruleId: string) => void
  toggleLevel: (canvasId: string, level: LogLevel) => void
  clearLevels: (canvasId: string) => void
  toggleGrouping: (canvasId: string) => void
  setFocusFingerprint: (canvasId: string, fp: string | null) => void
  toggleGroupExpansion: (canvasId: string, groupId: string) => void

  /* selection */
  toggleSelect: (canvasId: string, lineId: string) => void
  selectRange: (canvasId: string, ids: string[]) => void
  setSelection: (canvasId: string, ids: Set<string>) => void
  clearSelection: (canvasId: string) => void

  setCustomInstruction: (canvasId: string, value: string | null) => void

  /* layout ops */
  setActiveLeaf: (leafId: string) => void
  moveCanvas: (canvasId: string, toLeafId: string, toIndex?: number) => void
  splitOut: (
    canvasId: string,
    direction: 'row' | 'column',
    position?: 'before' | 'after'
  ) => void

  /* floating ops */
  floatCanvas: (canvasId: string) => void
  dockCanvas: (canvasId: string, toLeafId?: string) => void
  setFloatingRect: (canvasId: string, rect: Partial<FloatingRect>) => void
  bringFloatingToFront: (canvasId: string) => void

  /* preset ops */
  savePreset: (name: string) => WorkspacePreset
  loadPreset: (presetId: string) => void
  deletePreset: (presetId: string) => void
}

function makeCanvas(sourceId: string, title: string, colorSeed: number): CanvasState {
  return {
    id: crypto.randomUUID(),
    sourceId,
    title,
    filters: [],
    levelFilter: new Set(),
    grouping: false,
    focusFingerprint: null,
    expandedGroups: new Set(),
    selected: new Set(),
    customInstruction: null,
    minimized: false,
    colorSeed
  }
}

function mutate(
  state: CanvasesState,
  id: string,
  fn: (c: CanvasState) => CanvasState
): Partial<CanvasesState> {
  const prev = state.byId[id]
  if (!prev) return {}
  const next = fn(prev)
  if (next === prev) return {}
  return { byId: { ...state.byId, [id]: next } }
}

const DEFAULT_LEAF_ID = 'root-leaf'
const defaultLayout: LayoutLeaf = {
  id: DEFAULT_LEAF_ID,
  kind: 'leaf',
  canvasIds: [],
  activeId: ''
}

export const useCanvasesStore = create<CanvasesState>()(
  persist(
    (set, get) => ({
      byId: {},
      order: [],
      activeId: '',
      maximizedId: null,

      layout: defaultLayout,
      floatingIds: [],
      floatingRects: {},
      zCounter: 1,

      activeLeafId: DEFAULT_LEAF_ID,

      presets: [],

      open: (sourceId, title) => {
        const c = makeCanvas(sourceId, title, Object.keys(get().byId).length)
        set((s) => {
          const leafId = findLeafById(s.layout, s.activeLeafId)
            ? s.activeLeafId
            : collectLeaves(s.layout)[0]?.id
          let layout = s.layout
          if (leafId) {
            layout = addCanvasToLeaf(s.layout, leafId, c.id)
          } else {
            layout = { ...defaultLayout, canvasIds: [c.id], activeId: c.id }
          }
          return {
            byId: { ...s.byId, [c.id]: c },
            order: [...s.order, c.id],
            activeId: c.id,
            layout,
            activeLeafId: leafId ?? DEFAULT_LEAF_ID
          }
        })
        return c.id
      },

      openOrFocus: (sourceId, title) => {
        const existing = Object.values(get().byId).find(
          (c) => c.sourceId === sourceId
        )
        if (existing) {
          get().setActive(existing.id)
          return existing.id
        }
        return get().open(sourceId, title)
      },

      close: (canvasId) =>
        set((s) => {
          if (!s.byId[canvasId]) return s
          const { [canvasId]: _removed, ...rest } = s.byId
          const order = s.order.filter((id) => id !== canvasId)
          const layoutNext = removeCanvasFromTree(s.layout, canvasId) ?? {
            ...defaultLayout
          }
          const floatingIds = s.floatingIds.filter((id) => id !== canvasId)
          const { [canvasId]: _r2, ...restRects } = s.floatingRects
          const activeId =
            s.activeId === canvasId ? order[order.length - 1] ?? '' : s.activeId
          const maximizedId = s.maximizedId === canvasId ? null : s.maximizedId
          const activeLeafId = findLeafById(layoutNext, s.activeLeafId)
            ? s.activeLeafId
            : collectLeaves(layoutNext)[0]?.id ?? DEFAULT_LEAF_ID
          return {
            byId: rest,
            order,
            activeId,
            maximizedId,
            layout: layoutNext,
            floatingIds,
            floatingRects: restRects,
            activeLeafId
          }
        }),

      closeBySource: (sourceId) => {
        const victims = Object.values(get().byId).filter(
          (c) => c.sourceId === sourceId
        )
        for (const v of victims) get().close(v.id)
      },

      setActive: (canvasId) =>
        set((s) => {
          const canvas = s.byId[canvasId]
          if (!canvas) return s

          // 최소화 자동 해제 (타일/플로팅 공통)
          let byId = s.byId
          if (canvas.minimized) {
            byId = { ...byId, [canvasId]: { ...canvas, minimized: false } }
          }

          const leaf = findLeafOf(s.layout, canvasId)
          if (leaf) {
            const layout = mapLayout(s.layout, (n) =>
              n.kind === 'leaf' && n.id === leaf.id
                ? { ...n, activeId: canvasId }
                : n
            )
            return {
              byId,
              activeId: canvasId,
              activeLeafId: leaf.id,
              layout
            }
          }

          // floating: minimize 해제 + z 상승
          if (s.floatingIds.includes(canvasId)) {
            const z = s.zCounter + 1
            return {
              byId,
              activeId: canvasId,
              floatingRects: {
                ...s.floatingRects,
                [canvasId]: {
                  ...(s.floatingRects[canvasId] ?? defaultFloatingRect()),
                  minimized: false,
                  z
                }
              },
              zCounter: z
            }
          }

          return { byId, activeId: canvasId }
        }),

      focusSource: (sourceId) => {
        const hit = Object.values(get().byId).find(
          (c) => c.sourceId === sourceId
        )
        if (hit) get().setActive(hit.id)
      },

      reorder: (from, to) =>
        set((s) => {
          if (from === to || from < 0 || to < 0) return s
          const order = [...s.order]
          const [moved] = order.splice(from, 1)
          if (!moved) return s
          order.splice(to, 0, moved)
          return { order }
        }),

      toggleMinimize: (canvasId) =>
        set((s) =>
          mutate(s, canvasId, (c) => ({ ...c, minimized: !c.minimized }))
        ),

      toggleMaximize: (canvasId) =>
        set((s) => ({
          maximizedId: s.maximizedId === canvasId ? null : canvasId
        })),

      setFilters: (id, filters) =>
        set((s) => mutate(s, id, (c) => ({ ...c, filters }))),
      addFilter: (id, rule) =>
        set((s) =>
          mutate(s, id, (c) => ({ ...c, filters: [...c.filters, rule] }))
        ),
      updateFilter: (id, rule) =>
        set((s) =>
          mutate(s, id, (c) => ({
            ...c,
            filters: c.filters.map((r) => (r.id === rule.id ? rule : r))
          }))
        ),
      removeFilter: (id, ruleId) =>
        set((s) =>
          mutate(s, id, (c) => ({
            ...c,
            filters: c.filters.filter((r) => r.id !== ruleId)
          }))
        ),
      toggleLevel: (id, level) =>
        set((s) =>
          mutate(s, id, (c) => {
            const next = new Set(c.levelFilter)
            if (next.has(level)) next.delete(level)
            else next.add(level)
            return { ...c, levelFilter: next }
          })
        ),
      clearLevels: (id) =>
        set((s) => mutate(s, id, (c) => ({ ...c, levelFilter: new Set() }))),
      toggleGrouping: (id) =>
        set((s) =>
          mutate(s, id, (c) => ({
            ...c,
            grouping: !c.grouping,
            expandedGroups: new Set()
          }))
        ),
      setFocusFingerprint: (id, fp) =>
        set((s) => mutate(s, id, (c) => ({ ...c, focusFingerprint: fp }))),
      toggleGroupExpansion: (id, groupId) =>
        set((s) =>
          mutate(s, id, (c) => {
            const next = new Set(c.expandedGroups)
            if (next.has(groupId)) next.delete(groupId)
            else next.add(groupId)
            return { ...c, expandedGroups: next }
          })
        ),

      toggleSelect: (id, lineId) =>
        set((s) =>
          mutate(s, id, (c) => {
            const next = new Set(c.selected)
            if (next.has(lineId)) next.delete(lineId)
            else next.add(lineId)
            return { ...c, selected: next }
          })
        ),
      selectRange: (id, ids) =>
        set((s) =>
          mutate(s, id, (c) => {
            const next = new Set(c.selected)
            for (const x of ids) next.add(x)
            return { ...c, selected: next }
          })
        ),
      setSelection: (id, ids) =>
        set((s) => mutate(s, id, (c) => ({ ...c, selected: new Set(ids) }))),
      clearSelection: (id) =>
        set((s) => mutate(s, id, (c) => ({ ...c, selected: new Set() }))),

      setCustomInstruction: (id, value) =>
        set((s) => mutate(s, id, (c) => ({ ...c, customInstruction: value }))),

      setActiveLeaf: (leafId) =>
        set((s) => (findLeafById(s.layout, leafId) ? { activeLeafId: leafId } : s)),

      moveCanvas: (canvasId, toLeafId, toIndex) =>
        set((s) => {
          if (!s.byId[canvasId]) return s
          // 트리에서 제거 (floating 이었으면 floating 에서 제거)
          let layout = removeCanvasFromTree(s.layout, canvasId) ?? { ...defaultLayout }
          const floatingIds = s.floatingIds.filter((id) => id !== canvasId)
          // 대상 leaf 존재 확인
          if (!findLeafById(layout, toLeafId)) {
            // 대상 leaf 가 없으면 첫 leaf 에 붙이거나 신규 leaf 생성
            const firstLeaf = collectLeaves(layout)[0]
            if (firstLeaf) toLeafId = firstLeaf.id
            else {
              const newLeaf = makeLeaf([canvasId])
              return {
                layout: newLeaf,
                activeId: canvasId,
                activeLeafId: newLeaf.id,
                floatingIds
              }
            }
          }
          layout = addCanvasToLeaf(layout, toLeafId, canvasId, toIndex)
          return {
            layout,
            floatingIds,
            activeId: canvasId,
            activeLeafId: toLeafId
          }
        }),

      splitOut: (canvasId, direction, position = 'after') =>
        set((s) => {
          if (!s.byId[canvasId]) return s
          const leaf = findLeafOf(s.layout, canvasId)
          if (!leaf) return s
          if (leaf.canvasIds.length === 1) {
            // 이미 혼자 있는 leaf — 의미 없음
            return s
          }
          // 이 canvas 를 leaf 에서 제거 후 새 leaf 로 분할
          const layoutRemoved = removeCanvasFromTree(s.layout, canvasId)
          if (!layoutRemoved) return s
          const remainingLeaf = findLeafById(layoutRemoved, leaf.id)
          if (!remainingLeaf) return s
          const newLeaf = makeLeaf([canvasId])
          const layout = splitLeaf(
            layoutRemoved,
            remainingLeaf.id,
            direction,
            newLeaf,
            position
          )
          return {
            layout,
            activeId: canvasId,
            activeLeafId: newLeaf.id
          }
        }),

      floatCanvas: (canvasId) =>
        set((s) => {
          if (!s.byId[canvasId]) return s
          if (s.floatingIds.includes(canvasId)) return s
          const layout = removeCanvasFromTree(s.layout, canvasId) ?? {
            ...defaultLayout
          }
          const activeLeafId = findLeafById(layout, s.activeLeafId)
            ? s.activeLeafId
            : collectLeaves(layout)[0]?.id ?? DEFAULT_LEAF_ID
          const zCounter = s.zCounter + 1
          return {
            layout,
            floatingIds: [...s.floatingIds, canvasId],
            floatingRects: {
              ...s.floatingRects,
              [canvasId]: initialFloatingRect(s.floatingIds.length, zCounter)
            },
            zCounter,
            activeId: canvasId,
            activeLeafId
          }
        }),

      dockCanvas: (canvasId, toLeafId) =>
        set((s) => {
          if (!s.floatingIds.includes(canvasId)) return s
          const leaves = collectLeaves(s.layout)
          const targetId = toLeafId ?? leaves[0]?.id ?? DEFAULT_LEAF_ID
          let layout = s.layout
          if (!findLeafById(layout, targetId)) {
            layout = makeLeaf([canvasId])
          } else {
            layout = addCanvasToLeaf(layout, targetId, canvasId)
          }
          const floatingIds = s.floatingIds.filter((id) => id !== canvasId)
          const { [canvasId]: _r, ...restRects } = s.floatingRects
          return {
            layout,
            floatingIds,
            floatingRects: restRects,
            activeId: canvasId,
            activeLeafId:
              (layout.kind === 'leaf' ? layout.id : targetId) ?? DEFAULT_LEAF_ID
          }
        }),

      setFloatingRect: (canvasId, rect) =>
        set((s) => ({
          floatingRects: {
            ...s.floatingRects,
            [canvasId]: {
              ...(s.floatingRects[canvasId] ?? defaultFloatingRect()),
              ...rect
            }
          }
        })),

      bringFloatingToFront: (canvasId) =>
        set((s) => {
          if (!s.floatingIds.includes(canvasId)) return s
          const z = s.zCounter + 1
          return {
            zCounter: z,
            floatingRects: {
              ...s.floatingRects,
              [canvasId]: {
                ...(s.floatingRects[canvasId] ?? defaultFloatingRect()),
                z
              }
            },
            activeId: canvasId
          }
        }),

      savePreset: (name) => {
        const s = get()
        const preset: WorkspacePreset = {
          id: crypto.randomUUID(),
          name,
          createdAt: Date.now(),
          layout: s.layout,
          floatingIds: [...s.floatingIds],
          floatingRects: { ...s.floatingRects },
          canvases: Object.values(s.byId).map((c) => ({
            id: c.id,
            sourceId: c.sourceId,
            title: c.title,
            filters: c.filters,
            levelFilter: [...c.levelFilter],
            grouping: c.grouping,
            customInstruction: c.customInstruction,
            colorSeed: c.colorSeed
          }))
        }
        set((st) => ({ presets: [preset, ...st.presets].slice(0, 20) }))
        return preset
      },

      loadPreset: (presetId) =>
        set((s) => {
          const p = s.presets.find((x) => x.id === presetId)
          if (!p) return s
          const byId: Record<string, CanvasState> = {}
          for (const c of p.canvases) {
            byId[c.id] = {
              id: c.id,
              sourceId: c.sourceId,
              title: c.title,
              filters: c.filters,
              levelFilter: new Set(c.levelFilter),
              grouping: c.grouping,
              focusFingerprint: null,
              expandedGroups: new Set(),
              selected: new Set(),
              customInstruction: c.customInstruction,
              minimized: false,
              colorSeed: c.colorSeed
            }
          }
          const order = p.canvases.map((c) => c.id)
          const firstLeaf = collectLeaves(p.layout)[0]
          return {
            byId,
            order,
            layout: p.layout,
            floatingIds: [...p.floatingIds],
            floatingRects: { ...p.floatingRects },
            activeId: firstLeaf?.activeId ?? order[0] ?? '',
            activeLeafId: firstLeaf?.id ?? DEFAULT_LEAF_ID,
            maximizedId: null
          }
        }),

      deletePreset: (presetId) =>
        set((s) => ({ presets: s.presets.filter((p) => p.id !== presetId) }))
    }),
    {
      name: 'loginsight-canvases',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        byId: Object.fromEntries(
          Object.entries(state.byId).map(([id, c]) => [
            id,
            {
              id: c.id,
              sourceId: c.sourceId,
              title: c.title,
              filters: c.filters,
              levelFilter: [...c.levelFilter],
              grouping: c.grouping,
              colorSeed: c.colorSeed,
              customInstruction: c.customInstruction
            }
          ])
        ) as unknown as Record<string, CanvasState>,
        order: state.order,
        activeId: state.activeId,
        layout: state.layout,
        floatingIds: state.floatingIds,
        floatingRects: state.floatingRects,
        activeLeafId: state.activeLeafId,
        presets: state.presets
      }),
      merge: (persisted: unknown, current) => {
        const p = persisted as {
          byId?: Record<
            string,
            Partial<CanvasState> & { levelFilter?: LogLevel[] }
          >
          order?: string[]
          activeId?: string
          layout?: LayoutNode
          floatingIds?: string[]
          floatingRects?: Record<string, FloatingRect>
          activeLeafId?: string
          presets?: WorkspacePreset[]
        }
        if (!p?.byId) return current
        const byId: Record<string, CanvasState> = {}
        for (const [id, raw] of Object.entries(p.byId)) {
          // sourceId 없는 이전 버전의 Merged 캔버스는 무시
          if (!raw.sourceId || raw.sourceId === '__merged__') continue
          byId[id] = {
            id,
            sourceId: raw.sourceId,
            title: raw.title ?? 'Canvas',
            filters: raw.filters ?? [],
            levelFilter: new Set<LogLevel>(raw.levelFilter ?? []),
            grouping: raw.grouping ?? false,
            focusFingerprint: null,
            expandedGroups: new Set(),
            selected: new Set(),
            customInstruction: raw.customInstruction ?? null,
            minimized: false,
            colorSeed: raw.colorSeed ?? 0
          }
        }
        const order = (p.order ?? Object.keys(byId)).filter((id) => !!byId[id])
        const activeId =
          p.activeId && byId[p.activeId] ? p.activeId : order[0] ?? ''

        let layout: LayoutNode
        if (p.layout) {
          // 영속화된 layout 에서 사라진 canvasId 정리
          layout = removeOrphansFromLayout(p.layout, byId)
          if (!layout) layout = { ...defaultLayout }
        } else {
          layout = { ...defaultLayout, canvasIds: order, activeId }
        }
        const activeLeafId =
          p.activeLeafId && findLeafById(layout, p.activeLeafId)
            ? p.activeLeafId
            : collectLeaves(layout)[0]?.id ?? DEFAULT_LEAF_ID

        return {
          ...current,
          byId,
          order,
          activeId,
          layout,
          floatingIds:
            p.floatingIds?.filter((id) => !!byId[id]) ?? [],
          floatingRects: p.floatingRects ?? {},
          activeLeafId,
          presets: p.presets ?? [],
          maximizedId: null,
          zCounter: 1
        }
      }
    }
  )
)

function defaultFloatingRect(): FloatingRect {
  return { x: 120, y: 120, w: 720, h: 440, z: 1, minimized: false }
}

function initialFloatingRect(
  stackIndex: number,
  z: number
): FloatingRect {
  const offset = (stackIndex % 6) * 24
  return {
    x: 120 + offset,
    y: 120 + offset,
    w: 720,
    h: 440,
    z,
    minimized: false
  }
}

function removeOrphansFromLayout(
  node: LayoutNode,
  byId: Record<string, CanvasState>
): LayoutNode {
  if (node.kind === 'leaf') {
    const canvasIds = node.canvasIds.filter((id) => !!byId[id])
    const activeId = canvasIds.includes(node.activeId)
      ? node.activeId
      : canvasIds[0] ?? ''
    return { ...node, canvasIds, activeId }
  }
  const children = node.children
    .map((c) => removeOrphansFromLayout(c, byId))
    .filter((c) => {
      if (c.kind === 'leaf') return c.canvasIds.length > 0
      return c.children.length > 0
    })
  if (children.length === 0) return { ...defaultLayout }
  if (children.length === 1) return children[0]
  return { ...node, children }
}

export function useCanvas(canvasId: string): CanvasState | undefined {
  return useCanvasesStore((s) => s.byId[canvasId])
}

export function useActiveCanvas(): CanvasState | undefined {
  return useCanvasesStore((s) => s.byId[s.activeId])
}

