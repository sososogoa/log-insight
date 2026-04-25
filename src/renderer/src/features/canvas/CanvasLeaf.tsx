import { memo, useMemo } from 'react'
import {
  useCanvasesStore,
  type CanvasState
} from '@renderer/store/canvases'
import { useSourcesStore, getSourceColor } from '@renderer/store/sources'
import type { LayoutLeaf } from '@renderer/store/layout'
import { Canvas } from './Canvas'
import { TabErrorBadge } from './TabErrorBadge'

const DND_MIME = 'application/x-loginsight-canvas'

interface TabProps {
  leaf: LayoutLeaf
  canvas: CanvasState
  active: boolean
  color: string
  label: string
  onClick: () => void
  onClose: () => void
  onMinimize: () => void
  onFloat: () => void
  onSplitRight: () => void
  onSplitDown: () => void
}

function Tab({
  leaf,
  canvas,
  active,
  color,
  label,
  onClick,
  onClose,
  onMinimize,
  onFloat,
  onSplitRight,
  onSplitDown
}: TabProps): JSX.Element {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          DND_MIME,
          JSON.stringify({ canvasId: canvas.id, fromLeafId: leaf.id })
        )
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onClick}
      onDoubleClick={onMinimize}
      className={`group flex items-center gap-1 pl-2 pr-1 py-0.5 text-[11px] border-r border-neutral-800 cursor-pointer select-none ${
        active ? 'bg-neutral-900 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-900/50'
      } ${canvas.minimized ? 'opacity-60' : ''}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className="truncate max-w-[180px]">{label}</span>
      <TabErrorBadge sourceId={canvas.sourceId} />
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSplitRight()
          }}
          className="text-neutral-500 hover:text-blue-300 w-3.5 leading-none"
          title="Split right"
        >
          ⇥
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSplitDown()
          }}
          className="text-neutral-500 hover:text-blue-300 w-3.5 leading-none"
          title="Split down"
        >
          ⤓
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onFloat()
          }}
          className="text-neutral-500 hover:text-cyan-300 w-3.5 leading-none"
          title="Pop out"
        >
          ⎋
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMinimize()
          }}
          className="text-neutral-500 hover:text-neutral-200 w-3.5 leading-none"
          title={canvas.minimized ? 'Restore' : 'Minimize'}
        >
          {canvas.minimized ? '▢' : '_'}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="text-neutral-500 hover:text-red-400 w-3.5 leading-none"
          title="Close"
        >
          ×
        </button>
      </div>
    </div>
  )
}

interface Props {
  leaf: LayoutLeaf
}

function CanvasLeafInner({ leaf }: Props): JSX.Element {
  const byId = useCanvasesStore((s) => s.byId)
  const activeId = useCanvasesStore((s) => s.activeId)
  const setActive = useCanvasesStore((s) => s.setActive)
  const closeCanvas = useCanvasesStore((s) => s.close)
  const toggleMinimize = useCanvasesStore((s) => s.toggleMinimize)
  const floatCanvas = useCanvasesStore((s) => s.floatCanvas)
  const splitOut = useCanvasesStore((s) => s.splitOut)
  const moveCanvas = useCanvasesStore((s) => s.moveCanvas)
  const setActiveLeaf = useCanvasesStore((s) => s.setActiveLeaf)

  const sources = useSourcesStore((s) => s.sources)

  const colorMap = useMemo(() => {
    const m = new Map<string, string>()
    sources.forEach((s, i) => m.set(s.sourceId, getSourceColor(i)))
    return m
  }, [sources])

  const canvases = leaf.canvasIds.map((id) => byId[id]).filter(Boolean) as CanvasState[]
  const activeCanvas = byId[leaf.activeId] ?? canvases[0]

  function handleTabBarDrop(e: React.DragEvent, index?: number): void {
    const raw = e.dataTransfer.getData(DND_MIME)
    if (!raw) return
    try {
      const { canvasId } = JSON.parse(raw) as { canvasId: string; fromLeafId: string }
      if (!canvasId) return
      moveCanvas(canvasId, leaf.id, index)
      e.preventDefault()
    } catch {
      /* noop */
    }
  }

  return (
    <div
      className="h-full flex flex-col"
      onMouseDown={() => setActiveLeaf(leaf.id)}
    >
      {/* Tab bar */}
      <div
        className="flex items-center bg-neutral-950 border-b border-neutral-800 min-h-[28px] overflow-x-auto scrollbar-hidden"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DND_MIME)) e.preventDefault()
        }}
        onDrop={(e) => handleTabBarDrop(e)}
      >
        {canvases.map((c, i) => {
          const color = colorMap.get(c.sourceId) ?? '#71717a'
          return (
            <div
              key={c.id}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(DND_MIME)) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }
              }}
              onDrop={(e) => {
                e.stopPropagation()
                handleTabBarDrop(e, i)
              }}
            >
              <Tab
                leaf={leaf}
                canvas={c}
                active={c.id === activeId && c.id === leaf.activeId}
                color={color}
                label={c.title}
                onClick={() => setActive(c.id)}
                onClose={() => closeCanvas(c.id)}
                onMinimize={() => toggleMinimize(c.id)}
                onFloat={() => floatCanvas(c.id)}
                onSplitRight={() => splitOut(c.id, 'row', 'after')}
                onSplitDown={() => splitOut(c.id, 'column', 'after')}
              />
            </div>
          )
        })}
        <div className="flex-1" />
      </div>

      {/* Body */}
      <div className="flex-1 relative overflow-hidden">
        {canvases.map((c) => (
          <div
            key={c.id}
            className="absolute inset-0"
            style={{
              display: c.id === leaf.activeId && !c.minimized ? 'flex' : 'none'
            }}
          >
            <div className="flex-1 h-full">
              <Canvas canvasId={c.id} />
            </div>
          </div>
        ))}
        {(!activeCanvas || activeCanvas.minimized) && (
          <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-[11px] gap-2">
            <div>No canvas</div>
            <div>Press ▶ in the server panel or drag a tab here</div>
          </div>
        )}
      </div>
    </div>
  )
}

export const CanvasLeaf = memo(CanvasLeafInner)
