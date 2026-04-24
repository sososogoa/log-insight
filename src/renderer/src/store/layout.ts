/**
 * 캔버스 배치를 표현하는 트리.
 *  - Leaf: 탭 그룹. 하나 이상의 캔버스를 탭으로 가짐
 *  - Split: 가로/세로 분할. 자식 노드 여러 개
 *  - Floating: 트리 밖에서 절대 좌표로 떠 있는 캔버스 (pop-out)
 */

export interface LayoutLeaf {
  id: string
  kind: 'leaf'
  canvasIds: string[]
  /** leaf 내 현재 활성 canvasId (탭) */
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

/** 트리 동형사상 map — 변경한 노드만 새 참조, 나머지는 기존 참조 유지 */
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
      // 이미 있으면 order 만 조정
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
    // split: 자식에 leaf 가 포함됐고 split 의 방향이 같으면 flat 화
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

