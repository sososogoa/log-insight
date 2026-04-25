/**
 * Tree representing canvas layout.
 *  - Leaf: tab group — holds one or more canvases as tabs
 *  - Split: horizontal/vertical split — multiple child nodes
 *  - Floating: canvas that floats at absolute coordinates outside the tree (pop-out)
 */

export interface LayoutLeaf {
  id: string
  kind: 'leaf'
  canvasIds: string[]
  /** Currently active canvasId within the leaf (tab). */
  activeId: string
}

export interface LayoutSplit {
  id: string
  kind: 'split'
  direction: 'row' | 'column'
  children: LayoutNode[]
}

export type LayoutNode = LayoutLeaf | LayoutSplit

export interface FloatingRect {
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
}

export function makeLeaf(canvasIds: string[] = []): LayoutLeaf {
  return {
    id: crypto.randomUUID(),
    kind: 'leaf',
    canvasIds: [...canvasIds],
    activeId: canvasIds[0] ?? ''
  }
}

export function makeSplit(
  direction: 'row' | 'column',
  children: LayoutNode[]
): LayoutSplit {
  return {
    id: crypto.randomUUID(),
    kind: 'split',
    direction,
    children
  }
}

export function findLeafOf(
  root: LayoutNode,
  canvasId: string
): LayoutLeaf | null {
  if (root.kind === 'leaf') {
    return root.canvasIds.includes(canvasId) ? root : null
  }
  for (const c of root.children) {
    const hit = findLeafOf(c, canvasId)
    if (hit) return hit
  }
  return null
}

export function findLeafById(
  root: LayoutNode,
  leafId: string
): LayoutLeaf | null {
  if (root.kind === 'leaf') return root.id === leafId ? root : null
  for (const c of root.children) {
    const hit = findLeafById(c, leafId)
    if (hit) return hit
  }
  return null
}

export function collectLeaves(root: LayoutNode): LayoutLeaf[] {
  if (root.kind === 'leaf') return [root]
  const out: LayoutLeaf[] = []
  for (const c of root.children) out.push(...collectLeaves(c))
  return out
}

/** Tree isomorphism map — only changed nodes get new references; others retain existing references. */
export function mapLayout(
  root: LayoutNode,
  fn: (n: LayoutNode) => LayoutNode
): LayoutNode {
  const next = fn(root)
  if (next.kind === 'split') {
    const children = next.children.map((c) => mapLayout(c, fn))
    const same = children.every((c, i) => c === next.children[i])
    return same ? next : { ...next, children }
  }
  return next
}

export function removeCanvasFromTree(
  root: LayoutNode,
  canvasId: string
): LayoutNode | null {
  if (root.kind === 'leaf') {
    if (!root.canvasIds.includes(canvasId)) return root
    const canvasIds = root.canvasIds.filter((id) => id !== canvasId)
    if (canvasIds.length === 0) return null
    const activeId =
      root.activeId === canvasId ? canvasIds[canvasIds.length - 1] : root.activeId
    return { ...root, canvasIds, activeId }
  }
  const children = root.children
    .map((c) => removeCanvasFromTree(c, canvasId))
    .filter((c): c is LayoutNode => c !== null)
  if (children.length === 0) return null
  if (children.length === 1) return children[0]
  return { ...root, children }
}

export function addCanvasToLeaf(
  root: LayoutNode,
  leafId: string,
  canvasId: string,
  index?: number
): LayoutNode {
  return mapLayout(root, (n) => {
    if (n.kind !== 'leaf' || n.id !== leafId) return n
    if (n.canvasIds.includes(canvasId)) {
      // already present — just reorder
      const filtered = n.canvasIds.filter((id) => id !== canvasId)
      const ids =
        typeof index === 'number'
          ? [...filtered.slice(0, index), canvasId, ...filtered.slice(index)]
          : [...filtered, canvasId]
      return { ...n, canvasIds: ids, activeId: canvasId }
    }
    const ids =
      typeof index === 'number'
        ? [...n.canvasIds.slice(0, index), canvasId, ...n.canvasIds.slice(index)]
        : [...n.canvasIds, canvasId]
    return { ...n, canvasIds: ids, activeId: canvasId }
  })
}

export function splitLeaf(
  root: LayoutNode,
  leafId: string,
  direction: 'row' | 'column',
  newLeaf: LayoutLeaf,
  position: 'before' | 'after' = 'after'
): LayoutNode {
  function visit(n: LayoutNode): LayoutNode {
    if (n.kind === 'leaf') {
      if (n.id !== leafId) return n
      const children =
        position === 'after' ? [n, newLeaf] : [newLeaf, n]
      return makeSplit(direction, children)
    }
    // split: if a child leaf is found and the split direction matches, flatten it
    let found = false
    const children: LayoutNode[] = []
    for (const c of n.children) {
      if (c.kind === 'leaf' && c.id === leafId && n.direction === direction) {
        found = true
        if (position === 'after') {
          children.push(c, newLeaf)
        } else {
          children.push(newLeaf, c)
        }
      } else {
        children.push(visit(c))
      }
    }
    if (found) return { ...n, children }
    const same = children.every((c, i) => c === n.children[i])
    return same ? n : { ...n, children }
  }
  return visit(root)
}

