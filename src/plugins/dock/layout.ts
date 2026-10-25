import type { Bounds, Size } from '../../core/types'

export type DockAxis = 'row' | 'column'
export type DockSide = 'left' | 'right' | 'top' | 'bottom' | 'center'

export interface DockStack {
  kind: 'stack'
  id: string
  windows: string[]
  active: string
}

export interface DockSplit {
  kind: 'split'
  id: string
  axis: DockAxis
  children: DockNode[]
  sizes: number[]
}

export type DockNode = DockStack | DockSplit

export interface DockLayout {
  root: DockNode | null
}

export interface DockTarget {
  stackId?: string
  side?: DockSide
}

export interface DockGeometry {
  sash: number
  minSize: Size
  minOf?(stack: DockStack): Size
}

export interface StackRect {
  id: string
  bounds: Bounds
}

export interface SashRect {
  splitId: string
  index: number
  axis: DockAxis
  bounds: Bounds
  span: number
  value: number
  min: number
  max: number
}

export interface DockRects {
  stacks: StackRect[]
  sashes: SashRect[]
}

export const emptyLayout: DockLayout = { root: null }

function* walk(node: DockNode | null): Generator<DockNode> {
  if (!node) return
  yield node
  if (node.kind === 'split') for (const child of node.children) yield* walk(child)
}

function stacksOf(layout: DockLayout): DockStack[] {
  return [...walk(layout.root)].filter((node): node is DockStack => node.kind === 'stack')
}

export function windowsOf(layout: DockLayout): string[] {
  return stacksOf(layout).flatMap((stack) => stack.windows)
}

export function stackOf(layout: DockLayout, windowId: string): DockStack | null {
  return stacksOf(layout).find((stack) => stack.windows.includes(windowId)) ?? null
}

function freshId(layout: DockLayout, also?: string): string {
  const taken = new Set([...walk(layout.root)].map((node) => node.id))
  if (also) taken.add(also)
  let n = taken.size + 1
  while (taken.has(`d${n}`)) n += 1
  return `d${n}`
}

function mapNode(node: DockNode, id: string, change: (node: DockNode) => DockNode): DockNode {
  if (node.id === id) return change(node)
  if (node.kind === 'stack') return node
  let changed = false
  const children = node.children.map((child) => {
    const next = mapNode(child, id, change)
    if (next !== child) changed = true
    return next
  })
  return changed ? tidy({ ...node, children }) : node
}

function tidy(split: DockSplit): DockNode {
  const children: DockNode[] = []
  const sizes: number[] = []
  split.children.forEach((child, i) => {
    const share = split.sizes[i] as number
    if (child.kind === 'split' && child.axis === split.axis) {
      children.push(...child.children)
      sizes.push(...child.sizes.map((size) => size * share))
    } else {
      children.push(child)
      sizes.push(share)
    }
  })
  if (children.length === 1) return children[0] as DockNode
  const total = sizes.reduce((sum, size) => sum + size, 0)
  return { ...split, children, sizes: sizes.map((size) => size / total) }
}

function axisOf(side: DockSide): DockAxis {
  return side === 'left' || side === 'right' ? 'row' : 'column'
}

function besideNode(
  layout: DockLayout,
  node: DockNode,
  added: DockStack,
  side: Exclude<DockSide, 'center'>,
): DockNode {
  const axis = axisOf(side)
  const before = side === 'left' || side === 'top'
  const pair = (target: DockNode): DockSplit => ({
    kind: 'split',
    id: freshId(layout, added.id),
    axis,
    children: before ? [added, target] : [target, added],
    sizes: [0.5, 0.5],
  })
  const root = layout.root as DockNode
  const parent = [...walk(root)].find(
    (candidate): candidate is DockSplit =>
      candidate.kind === 'split' && candidate.children.includes(node),
  )
  if (parent?.axis === axis) {
    return mapNode(root, parent.id, () => {
      const index = parent.children.indexOf(node)
      const share = (parent.sizes[index] as number) / 2
      const children = [...parent.children]
      const sizes = [...parent.sizes]
      children.splice(before ? index : index + 1, 0, added)
      sizes.splice(index, 1, share, share)
      return { ...parent, children, sizes }
    })
  }
  return mapNode(root, node.id, pair)
}

export function insert(layout: DockLayout, windowId: string, target: DockTarget = {}): DockLayout {
  const side = target.side ?? 'center'
  const current = stackOf(layout, windowId)
  const aimedId = target.stackId ?? (side === 'center' ? stacksOf(layout)[0]?.id : undefined)
  if (current && current.id === aimedId && (side === 'center' || current.windows.length === 1)) {
    return layout
  }
  const base = current ? remove(layout, windowId) : layout
  const root = base.root
  const added: DockStack = {
    kind: 'stack',
    id: freshId(base),
    windows: [windowId],
    active: windowId,
  }
  if (!root) return target.stackId || current ? layout : { root: added }
  const aimed = target.stackId
    ? stacksOf(base).find((stack) => stack.id === target.stackId)
    : side === 'center'
      ? stacksOf(base)[0]
      : undefined
  if (target.stackId && !aimed) return layout
  if (side === 'center') {
    const stack = aimed as DockStack
    return {
      root: mapNode(root, stack.id, () => ({
        ...stack,
        windows: [...stack.windows, windowId],
        active: windowId,
      })),
    }
  }
  if (aimed) return { root: besideNode(base, aimed, added, side) }
  const axis = axisOf(side)
  const before = side === 'left' || side === 'top'
  if (root.kind === 'split' && root.axis === axis) {
    const n = root.children.length
    const sizes = root.sizes.map((size) => (size * n) / (n + 1))
    return {
      root: {
        ...root,
        children: before ? [added, ...root.children] : [...root.children, added],
        sizes: before ? [1 / (n + 1), ...sizes] : [...sizes, 1 / (n + 1)],
      },
    }
  }
  return {
    root: {
      kind: 'split',
      id: freshId(base, added.id),
      axis,
      children: before ? [added, root] : [root, added],
      sizes: [0.5, 0.5],
    },
  }
}

function removeFrom(node: DockNode, windowId: string): DockNode | null {
  if (node.kind === 'stack') {
    const index = node.windows.indexOf(windowId)
    if (index < 0) return node
    const windows = node.windows.filter((id) => id !== windowId)
    if (windows.length === 0) return null
    const active =
      node.active === windowId
        ? (windows[Math.min(index, windows.length - 1)] as string)
        : node.active
    return { ...node, windows, active }
  }
  let changed = false
  const children: DockNode[] = []
  const sizes: number[] = []
  node.children.forEach((child, i) => {
    const next = removeFrom(child, windowId)
    if (next !== child) changed = true
    if (next) {
      children.push(next)
      sizes.push(node.sizes[i] as number)
    }
  })
  return changed ? tidy({ ...node, children, sizes }) : node
}

export function remove(layout: DockLayout, windowId: string): DockLayout {
  if (!layout.root) return layout
  const root = removeFrom(layout.root, windowId)
  return root === layout.root ? layout : { root }
}

export function activate(layout: DockLayout, windowId: string): DockLayout {
  const stack = stackOf(layout, windowId)
  if (!stack || stack.active === windowId) return layout
  return {
    root: mapNode(layout.root as DockNode, stack.id, () => ({ ...stack, active: windowId })),
  }
}

export function moveInStack(layout: DockLayout, windowId: string, index: number): DockLayout {
  const stack = stackOf(layout, windowId)
  if (!stack) return layout
  const windows = stack.windows.filter((id) => id !== windowId)
  const at = Math.max(0, Math.min(index, windows.length))
  if (stack.windows[at] === windowId) return layout
  windows.splice(at, 0, windowId)
  return { root: mapNode(layout.root as DockNode, stack.id, () => ({ ...stack, windows })) }
}

function minLength(node: DockNode, axis: DockAxis, geometry: DockGeometry): number {
  if (node.kind === 'stack') {
    const min = geometry.minOf?.(node) ?? geometry.minSize
    return axis === 'row' ? min.width : min.height
  }
  const lengths = node.children.map((child) => minLength(child, axis, geometry))
  if (node.axis !== axis) return Math.max(...lengths)
  return lengths.reduce((sum, length) => sum + length, 0) + geometry.sash * (lengths.length - 1)
}

function distribute(sizes: number[], mins: number[], total: number): number[] {
  if (mins.reduce((sum, min) => sum + min, 0) > total) return sizes.map((size) => size * total)
  const fixed = sizes.map(() => false)
  for (;;) {
    let free = total
    let weight = 0
    sizes.forEach((size, i) => {
      if (fixed[i]) free -= mins[i] as number
      else weight += size
    })
    const lengths = sizes.map((size, i) =>
      fixed[i] ? (mins[i] as number) : (size / weight) * free,
    )
    let short = false
    lengths.forEach((length, i) => {
      if (!fixed[i] && length < (mins[i] as number) - 1e-9) {
        fixed[i] = true
        short = true
      }
    })
    if (!short) return lengths
  }
}

interface Placed {
  bounds: Bounds
  lengths: number[]
  mins: number[]
}

function place(
  node: DockNode,
  bounds: Bounds,
  geometry: DockGeometry,
  out: DockRects,
  splits: Map<string, Placed>,
): void {
  if (node.kind === 'stack') {
    out.stacks.push({ id: node.id, bounds })
    return
  }
  const row = node.axis === 'row'
  const start = row ? bounds.x : bounds.y
  const span = row ? bounds.width : bounds.height
  const mins = node.children.map((child) => minLength(child, node.axis, geometry))
  const lengths = distribute(
    node.sizes,
    mins,
    Math.max(0, span - geometry.sash * (node.children.length - 1)),
  )
  splits.set(node.id, { bounds, lengths, mins })
  const last = node.children.length - 1
  let sum = 0
  const ends = lengths.map((length, i) => {
    sum += length
    return i === last ? start + span : Math.round(start + sum + geometry.sash * i)
  })
  node.children.forEach((child, i) => {
    const from = i === 0 ? start : (ends[i - 1] as number) + geometry.sash
    const to = ends[i] as number
    const box = row
      ? { x: from, y: bounds.y, width: to - from, height: bounds.height }
      : { x: bounds.x, y: from, width: bounds.width, height: to - from }
    place(child, box, geometry, out, splits)
    if (i === last) return
    out.sashes.push({
      splitId: node.id,
      index: i,
      axis: node.axis,
      bounds: row
        ? { x: to, y: bounds.y, width: geometry.sash, height: bounds.height }
        : { x: bounds.x, y: to, width: bounds.width, height: geometry.sash },
      span,
      value: to - start,
      min: from - start + (mins[i] as number),
      max: (ends[i + 1] as number) - start - geometry.sash - (mins[i + 1] as number),
    })
  })
}

export function rects(layout: DockLayout, area: Bounds, geometry: DockGeometry): DockRects {
  const out: DockRects = { stacks: [], sashes: [] }
  if (layout.root) place(layout.root, area, geometry, out, new Map())
  return out
}

export function resize(
  layout: DockLayout,
  splitId: string,
  index: number,
  delta: number,
  area: Bounds,
  geometry: DockGeometry,
): DockLayout {
  const split = [...walk(layout.root)].find(
    (node): node is DockSplit => node.kind === 'split' && node.id === splitId,
  )
  if (!split || index < 0 || index >= split.children.length - 1) return layout
  const splits = new Map<string, Placed>()
  place(layout.root as DockNode, area, geometry, { stacks: [], sashes: [] }, splits)
  const { lengths, mins } = splits.get(splitId) as Placed
  const a = lengths[index] as number
  const b = lengths[index + 1] as number
  const minA = mins[index] as number
  const minB = mins[index + 1] as number
  if (a + b < minA + minB) return layout
  const nextA = Math.max(minA, Math.min(a + delta, a + b - minB))
  if (Math.abs(nextA - a) < 1e-9) return layout
  const next = [...lengths]
  next[index] = nextA
  next[index + 1] = a + b - nextA
  const total = next.reduce((sum, length) => sum + length, 0)
  return {
    root: mapNode(layout.root as DockNode, splitId, () => ({
      ...split,
      sizes: next.map((length) => length / total),
    })),
  }
}

function validNode(
  node: unknown,
  seenIds: Set<string>,
  seenWindows: Set<string>,
  axis?: DockAxis,
): boolean {
  if (typeof node !== 'object' || node === null) return false
  const candidate = node as Record<string, unknown>
  if (typeof candidate.id !== 'string' || seenIds.has(candidate.id)) return false
  seenIds.add(candidate.id)
  if (candidate.kind === 'stack') {
    const windows = candidate.windows
    if (!Array.isArray(windows) || windows.length === 0) return false
    for (const id of windows) {
      if (typeof id !== 'string' || seenWindows.has(id)) return false
      seenWindows.add(id)
    }
    return windows.includes(candidate.active)
  }
  if (candidate.kind !== 'split') return false
  const { children, sizes } = candidate
  if (candidate.axis !== 'row' && candidate.axis !== 'column') return false
  if (candidate.axis === axis) return false
  if (!Array.isArray(children) || !Array.isArray(sizes)) return false
  if (children.length < 2 || sizes.length !== children.length) return false
  if (!sizes.every((size) => typeof size === 'number' && Number.isFinite(size) && size > 0)) {
    return false
  }
  if (Math.abs(sizes.reduce((sum: number, size: number) => sum + size, 0) - 1) > 1e-6) return false
  return children.every((child) =>
    validNode(child, seenIds, seenWindows, candidate.axis as DockAxis),
  )
}

export function validate(layout: DockLayout): boolean {
  if (typeof layout !== 'object' || layout === null) return false
  if (layout.root === null) return true
  return validNode(layout.root, new Set(), new Set())
}
