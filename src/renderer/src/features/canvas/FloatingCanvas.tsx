import { memo, useEffect, useRef, useState } from 'react'
import {
  useCanvasesStore,
  type CanvasState
} from '@renderer/store/canvases'
import { useSourcesStore, getSourceColor } from '@renderer/store/sources'
import { Canvas } from './Canvas'

const MIN_W = 360
const MIN_H = 220

interface Props {
  canvas: CanvasState
}

function FloatingCanvasInner({ canvas }: Props): JSX.Element {
  const rect = useCanvasesStore((s) => s.floatingRects[canvas.id])
  const setRect = useCanvasesStore((s) => s.setFloatingRect)
  const bringFront = useCanvasesStore((s) => s.bringFloatingToFront)
  const close = useCanvasesStore((s) => s.close)
  const dock = useCanvasesStore((s) => s.dockCanvas)
  const sources = useSourcesStore((s) => s.sources)

  const [dragging, setDragging] = useState<{
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)
  const [resizing, setResizing] = useState<{
    startX: number
    startY: number
    origW: number
    origH: number
  } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dragging && !resizing) return
    function onMove(e: MouseEvent): void {
      if (dragging) {
        const dx = e.clientX - dragging.startX
        const dy = e.clientY - dragging.startY
        setRect(canvas.id, {
          x: Math.max(0, dragging.origX + dx),
          y: Math.max(32, dragging.origY + dy)
        })
      } else if (resizing) {
        const dw = e.clientX - resizing.startX
        const dh = e.clientY - resizing.startY
        setRect(canvas.id, {
          w: Math.max(MIN_W, resizing.origW + dw),
          h: Math.max(MIN_H, resizing.origH + dh)
        })
      }
    }
    function onUp(): void {
      setDragging(null)
      setResizing(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [dragging, resizing, canvas.id, setRect])

  if (!rect) return <></>
  const r = rect
  if (r.minimized) return <></>

  const color = (() => {
    const idx = sources.findIndex((s) => s.sourceId === canvas.sourceId)
    return idx >= 0 ? getSourceColor(idx) : '#71717a'
  })()

  const label = canvas.title

  return (
    <div
      ref={panelRef}
      className="absolute bg-neutral-950 border border-neutral-700 rounded-md shadow-2xl flex flex-col overflow-hidden"
      style={{
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        zIndex: 100 + r.z
      }}
      onMouseDown={() => bringFront(canvas.id)}
    >
      {/* Title bar — drag handle */}
      <div
        className="h-7 shrink-0 flex items-center gap-2 px-2 border-b border-neutral-800 bg-neutral-900 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={(e) => {
          if (e.button !== 0) return
          setDragging({
            startX: e.clientX,
            startY: e.clientY,
            origX: r.x,
            origY: r.y
          })
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: color }}
        />
        <span className="text-[11px] text-neutral-200 truncate flex-1">
          {label}
        </span>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() =>
            useCanvasesStore.getState().setFloatingRect(canvas.id, {
              minimized: true
            })
          }
          className="text-[11px] text-neutral-500 hover:text-neutral-200 px-1"
          title="Minimize"
        >
          _
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => dock(canvas.id)}
          className="text-[11px] text-neutral-500 hover:text-cyan-300 px-1"
          title="Dock to tile"
        >
          ▤
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => close(canvas.id)}
          className="text-[11px] text-neutral-500 hover:text-red-400 px-1"
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        <Canvas canvasId={canvas.id} />
      </div>

      {/* Resize handle — bottom-right */}
      <div
        className="absolute right-0 bottom-0 w-3 h-3 cursor-se-resize"
        onMouseDown={(e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          setResizing({
            startX: e.clientX,
            startY: e.clientY,
            origW: r.w,
            origH: r.h
          })
        }}
      >
        <svg viewBox="0 0 10 10" className="w-full h-full text-neutral-600">
          <path d="M10 0 L0 10 M10 5 L5 10" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      </div>
    </div>
  )
}

export const FloatingCanvas = memo(FloatingCanvasInner)
