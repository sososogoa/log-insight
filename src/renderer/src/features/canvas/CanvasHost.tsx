import { memo, useEffect, useMemo, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { useCanvasesStore } from '@renderer/store/canvases'
import { useSourcesStore, getSourceColor } from '@renderer/store/sources'
import type { LayoutNode } from '@renderer/store/layout'
import { CanvasLeaf } from './CanvasLeaf'
import { FloatingCanvas } from './FloatingCanvas'
import { WorkspacePresetMenu } from './WorkspacePresetMenu'
import { TabErrorBadge } from './TabErrorBadge'

function LayoutTreeView({ node }: { node: LayoutNode }): JSX.Element {
  if (node.kind === 'leaf') {
    return <CanvasLeaf leaf={node} />
  }
  const direction = node.direction === 'row' ? 'horizontal' : 'vertical'
  return (
    <Group
      orientation={direction === 'horizontal' ? 'horizontal' : 'vertical'}
      style={{ height: '100%', width: '100%' }}
    >
      {node.children.map((child, i) => (
        <RowItem
          key={child.id}
          child={child}
          isLast={i === node.children.length - 1}
          direction={direction}
        />
      ))}
    </Group>
  )
}

function RowItem({
  child,
  isLast,
  direction
}: {
  child: LayoutNode
  isLast: boolean
  direction: 'horizontal' | 'vertical'
}): JSX.Element {
  return (
    <>
      <Panel defaultSize={`${100 / 2}`} minSize="10">
        <LayoutTreeView node={child} />
      </Panel>
      {!isLast && (
        <Separator
          className={`${
            direction === 'horizontal'
              ? 'w-1 cursor-col-resize'
              : 'h-1 cursor-row-resize'
          } bg-transparent data-[separator]:hover:bg-blue-500/30 transition-colors`}
        />
      )}
    </>
  )
}

function CanvasHostInner(): JSX.Element {
  const layout = useCanvasesStore((s) => s.layout)
  const byId = useCanvasesStore((s) => s.byId)
  const order = useCanvasesStore((s) => s.order)
  const setActive = useCanvasesStore((s) => s.setActive)
  const floatingIds = useCanvasesStore((s) => s.floatingIds)
  const floatingRects = useCanvasesStore((s) => s.floatingRects)
  const setFloatingRect = useCanvasesStore((s) => s.setFloatingRect)
  const toggleMinimize = useCanvasesStore((s) => s.toggleMinimize)

  const sources = useSourcesStore((s) => s.sources)

  const [showPresetMenu, setShowPresetMenu] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.shiftKey || e.altKey) return
      if (!/^[1-9]$/.test(e.key)) return
      const idx = Number(e.key) - 1
      const id = order[idx]
      if (id) {
        e.preventDefault()
        setActive(id)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [order, setActive])

  const colorMap = useMemo(() => {
    const m = new Map<string, string>()
    sources.forEach((s, i) => m.set(s.sourceId, getSourceColor(i)))
    return m
  }, [sources])

  const dockItems = useMemo(() => {
    const items: {
      canvasId: string
      sourceId: string
      label: string
      color: string
      onRestore: () => void
    }[] = []
    for (const id of order) {
      const c = byId[id]
      if (!c) continue
      const isFloating = floatingIds.includes(id)
      const isMinimized = isFloating
        ? floatingRects[id]?.minimized ?? false
        : c.minimized
      if (!isMinimized) continue
      items.push({
        canvasId: id,
        sourceId: c.sourceId,
        label: c.title,
        color: colorMap.get(c.sourceId) ?? '#71717a',
        onRestore: () => {
          if (isFloating) setFloatingRect(id, { minimized: false })
          else toggleMinimize(id)
          setActive(id)
        }
      })
    }
    return items
  }, [
    order,
    byId,
    floatingIds,
    floatingRects,
    colorMap,
    setFloatingRect,
    toggleMinimize,
    setActive
  ])

  const hasAnyCanvas = order.length > 0
  const hasAnyTile = useMemo(() => {
    function leafCount(n: LayoutNode): number {
      if (n.kind === 'leaf') return n.canvasIds.length
      return n.children.reduce((a, c) => a + leafCount(c), 0)
    }
    return leafCount(layout) > 0
  }, [layout])

  return (
    <div className="h-full flex flex-col relative">
      <div className="h-6 shrink-0 flex items-center gap-2 px-2 border-b border-neutral-800 bg-neutral-950 text-[10px] text-neutral-400">
        <button
          onClick={() => setShowPresetMenu((v) => !v)}
          className="hover:text-neutral-200"
          title="Workspace presets"
        >
          ▦ Workspace
        </button>
        <span className="ml-auto tabular-nums text-neutral-600">
          {order.length} canvases
          {floatingIds.length > 0 && ` · ${floatingIds.length} floating`}
        </span>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {hasAnyTile ? (
          <LayoutTreeView node={layout} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-sm gap-2 p-4 text-center">
            <div className="text-2xl">📡</div>
            <div>{hasAnyCanvas ? 'No canvas to display in the tile' : 'No sources connected yet'}</div>
            <div className="text-[11px] text-neutral-600">
              Press ▶ in the server panel to start a log stream
            </div>
          </div>
        )}

        {floatingIds.map((id) => {
          const c = byId[id]
          if (!c) return null
          return <FloatingCanvas key={id} canvas={c} />
        })}
      </div>

      {dockItems.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 border-t border-neutral-800 bg-neutral-950 text-[11px] overflow-x-auto scrollbar-hidden">
          <span className="text-neutral-500 shrink-0">min:</span>
          {dockItems.map((d) => (
            <button
              key={d.canvasId}
              onClick={d.onRestore}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 shrink-0"
              title={`Restore: ${d.label}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: d.color }}
              />
              <span className="truncate max-w-[140px]">{d.label}</span>
              <TabErrorBadge sourceId={d.sourceId} variant="dock" />
            </button>
          ))}
        </div>
      )}

      {showPresetMenu && (
        <WorkspacePresetMenu onClose={() => setShowPresetMenu(false)} />
      )}
    </div>
  )
}

export const CanvasHost = memo(CanvasHostInner)
