import { describe, expect, it } from 'vitest'
import type { Bounds } from '../../src/core/types'
import {
  activate,
  type DockGeometry,
  type DockLayout,
  type DockNode,
  type DockSplit,
  type DockStack,
  emptyLayout,
  insert,
  moveInStack,
  rects,
  remove,
  resize,
  stackOf,
  validate,
  windowsOf,
} from '../../src/plugins/dock/layout'

const AREA: Bounds = { x: 0, y: 0, width: 1000, height: 600 }
const GEOMETRY: DockGeometry = { sash: 6, minSize: { width: 120, height: 80 } }

function build(...ids: string[]): DockLayout {
  return ids.reduce((layout, id) => insert(layout, id, { side: 'right' }), emptyLayout)
}

function shape(node: DockNode | null): unknown {
  if (!node) return null
  if (node.kind === 'stack') return node.windows.join('+')
  return { [node.axis]: node.children.map(shape) }
}

function rootSplit(layout: DockLayout): DockSplit {
  return layout.root as DockSplit
}

function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function overlap(a: Bounds, b: Bounds): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

describe('dock layout', () => {
  it('starts empty and puts the first window at the root', () => {
    expect(validate(emptyLayout)).toBe(true)
    const layout = insert(emptyLayout, 'a')
    expect(shape(layout.root)).toBe('a')
    expect((layout.root as DockStack).active).toBe('a')
    expect(validate(layout)).toBe(true)
    expect(rects(emptyLayout, AREA, GEOMETRY)).toEqual({ stacks: [], sashes: [] })
  })

  it('splits the root along the side, and appends along a matching root split', () => {
    const two = insert(insert(emptyLayout, 'a'), 'b', { side: 'right' })
    expect(shape(two.root)).toEqual({ row: ['a', 'b'] })
    expect(rootSplit(two).sizes).toEqual([0.5, 0.5])
    const three = insert(two, 'c', { side: 'left' })
    expect(shape(three.root)).toEqual({ row: ['c', 'a', 'b'] })
    expect(rootSplit(three).sizes.map((s) => s.toFixed(4))).toEqual(['0.3333', '0.3333', '0.3333'])
    const crossed = insert(three, 'd', { side: 'bottom' })
    expect(shape(crossed.root)).toEqual({ column: [{ row: ['c', 'a', 'b'] }, 'd'] })
    const top = insert(crossed, 'e', { side: 'top' })
    expect(shape(top.root)).toEqual({ column: ['e', { row: ['c', 'a', 'b'] }, 'd'] })
    expect(validate(top)).toBe(true)
  })

  it('tabs into a stack at the centre, or into the first stack when aimed at the root', () => {
    const base = build('a', 'b')
    const right = stackOf(base, 'b') as DockStack
    const tabbed = insert(base, 'c', { stackId: right.id, side: 'center' })
    expect(shape(tabbed.root)).toEqual({ row: ['a', 'b+c'] })
    expect(stackOf(tabbed, 'c')?.active).toBe('c')
    const rooted = insert(tabbed, 'd')
    expect(shape(rooted.root)).toEqual({ row: ['a+d', 'b+c'] })
    const single = insert(insert(emptyLayout, 'a'), 'b', { side: 'center' })
    expect(shape(single.root)).toBe('a+b')
  })

  it('splits a stack in place, sharing its size inside a split of the same axis', () => {
    const base = build('a', 'b')
    const b = stackOf(base, 'b') as DockStack
    const same = insert(base, 'c', { stackId: b.id, side: 'left' })
    expect(shape(same.root)).toEqual({ row: ['a', 'c', 'b'] })
    expect(rootSplit(same).sizes).toEqual([0.5, 0.25, 0.25])
    const cross = insert(base, 'c', { stackId: b.id, side: 'bottom' })
    expect(shape(cross.root)).toEqual({ row: ['a', { column: ['b', 'c'] }] })
    const above = insert(cross, 'd', {
      stackId: (stackOf(cross, 'c') as DockStack).id,
      side: 'top',
    })
    expect(shape(above.root)).toEqual({ row: ['a', { column: ['b', 'd', 'c'] }] })
    const lone = insert(emptyLayout, 'a')
    const split = insert(lone, 'b', { stackId: (lone.root as DockStack).id, side: 'top' })
    expect(shape(split.root)).toEqual({ column: ['b', 'a'] })
    expect(validate(above)).toBe(true)
  })

  it('moves a window that is already docked and refuses moves that cannot happen', () => {
    const base = build('a', 'b', 'c')
    const c = stackOf(base, 'c') as DockStack
    const moved = insert(base, 'a', { stackId: c.id, side: 'center' })
    expect(shape(moved.root)).toEqual({ row: ['b', 'c+a'] })
    expect(insert(moved, 'a', { stackId: c.id, side: 'center' })).toBe(moved)
    expect(insert(base, 'c', { stackId: c.id, side: 'left' })).toBe(base)
    const split = insert(moved, 'a', { stackId: c.id, side: 'bottom' })
    expect(shape(split.root)).toEqual({ row: ['b', { column: ['c', 'a'] }] })
    expect(insert(base, 'x', { stackId: 'missing' })).toBe(base)
    expect(insert(base, 'a')).toBe(base)
    const lone = insert(emptyLayout, 'a')
    expect(insert(lone, 'a', { side: 'left' })).toBe(lone)
    expect(insert(emptyLayout, 'x', { stackId: 'missing' })).toBe(emptyLayout)
    expect(insert(base, 'b', { stackId: 'missing' })).toBe(base)
  })

  it('collapses empty stacks and lone splits, merges same-axis splits and keeps sizes whole', () => {
    const base = build('a', 'b', 'c')
    const b = stackOf(base, 'b') as DockStack
    const nested = insert(base, 'd', { stackId: b.id, side: 'bottom' })
    expect(shape(nested.root)).toEqual({ row: ['a', { column: ['b', 'd'] }, 'c'] })
    const flattened = remove(nested, 'd')
    expect(shape(flattened.root)).toEqual({ row: ['a', 'b', 'c'] })
    const fewer = remove(flattened, 'b')
    expect(shape(fewer.root)).toEqual({ row: ['a', 'c'] })
    expect(rootSplit(fewer).sizes.reduce((sum, size) => sum + size, 0)).toBeCloseTo(1, 9)
    expect(shape(remove(fewer, 'a').root)).toBe('c')
    expect(remove(remove(fewer, 'a'), 'c')).toEqual(emptyLayout)
    expect(remove(fewer, 'missing')).toBe(fewer)
    expect(remove(emptyLayout, 'a')).toBe(emptyLayout)

    const deep = insert(build('a', 'b'), 'c', { side: 'bottom' })
    const inner = insert(deep, 'd', {
      stackId: (stackOf(deep, 'b') as DockStack).id,
      side: 'bottom',
    })
    expect(shape(inner.root)).toEqual({ column: [{ row: ['a', { column: ['b', 'd'] }] }, 'c'] })
    const hoisted = remove(inner, 'a')
    expect(shape(hoisted.root)).toEqual({ column: ['b', 'd', 'c'] })
    expect(validate(hoisted)).toBe(true)
  })

  it('hands the active tab to a neighbour when the active window leaves', () => {
    let layout = insert(emptyLayout, 'a')
    const id = (layout.root as DockStack).id
    layout = insert(layout, 'b', { stackId: id })
    layout = insert(layout, 'c', { stackId: id })
    expect(stackOf(layout, 'a')?.active).toBe('c')
    expect(stackOf(remove(layout, 'c'), 'a')?.active).toBe('b')
    const first = activate(layout, 'a')
    expect(stackOf(remove(first, 'a'), 'b')?.active).toBe('b')
    expect(stackOf(remove(layout, 'a'), 'b')?.active).toBe('c')
  })

  it('activates and reorders tabs, ignoring what changes nothing', () => {
    let layout = insert(emptyLayout, 'a')
    const id = (layout.root as DockStack).id
    layout = insert(insert(layout, 'b', { stackId: id }), 'c', { stackId: id })
    expect(activate(layout, 'c')).toBe(layout)
    expect(activate(layout, 'missing')).toBe(layout)
    expect(stackOf(activate(layout, 'a'), 'a')?.active).toBe('a')
    expect((moveInStack(layout, 'c', 0).root as DockStack).windows).toEqual(['c', 'a', 'b'])
    expect((moveInStack(layout, 'a', 99).root as DockStack).windows).toEqual(['b', 'c', 'a'])
    expect(moveInStack(layout, 'b', 1)).toBe(layout)
    expect(moveInStack(layout, 'missing', 0)).toBe(layout)
    const split = build('a', 'b')
    expect(stackOf(activate(split, 'b'), 'b')).toBe(stackOf(split, 'b'))
    expect(windowsOf(layout)).toEqual(['a', 'b', 'c'])
    expect(stackOf(layout, 'missing')).toBeNull()
  })

  it('tiles the area exactly with stacks and sashes', () => {
    const layout = insert(build('a', 'b'), 'c', { side: 'bottom' })
    const { stacks, sashes } = rects(layout, AREA, GEOMETRY)
    const byId = (window: string) =>
      stacks.find((rect) => rect.id === (stackOf(layout, window) as DockStack).id)?.bounds
    expect(byId('a')).toEqual({ x: 0, y: 0, width: 497, height: 297 })
    expect(byId('b')).toEqual({ x: 503, y: 0, width: 497, height: 297 })
    expect(byId('c')).toEqual({ x: 0, y: 303, width: 1000, height: 297 })
    expect(sashes).toHaveLength(2)
    const outer = sashes.find((sash) => sash.axis === 'column')
    expect(outer?.bounds).toEqual({ x: 0, y: 297, width: 1000, height: 6 })
    expect(outer).toMatchObject({ index: 0, value: 297, min: 80, max: 514 })
    const inner = sashes.find((sash) => sash.axis === 'row')
    expect(inner?.bounds).toEqual({ x: 497, y: 0, width: 6, height: 297 })
    expect(inner).toMatchObject({ value: 497, min: 120, max: 874 })
  })

  it('keeps panels at their minimum when the area allows, and scales when it does not', () => {
    const layout = build('a', 'b', 'c')
    const squeezed = { ...rootSplit(layout), sizes: [0.9, 0.05, 0.05] }
    const tight = rects({ root: squeezed }, AREA, GEOMETRY).stacks.map((rect) => rect.bounds.width)
    expect(tight[1]).toBeGreaterThanOrEqual(120)
    expect(tight[2]).toBeGreaterThanOrEqual(120)
    expect(tight.reduce((sum, width) => sum + width, 0) + 12).toBe(1000)
    const small = rects(layout, { x: 0, y: 0, width: 300, height: 200 }, GEOMETRY)
    expect(small.stacks.map((rect) => rect.bounds.width)).toEqual([96, 96, 96])
  })

  it('asks each stack for its own minimum when a callback is given', () => {
    const layout = build('a', 'b')
    const wide = (stack: DockStack) => ({
      width: stack.windows.includes('a') ? 600 : 100,
      height: 80,
    })
    const placed = rects(layout, AREA, { ...GEOMETRY, minOf: wide }).stacks
    expect(placed.map((rect) => rect.bounds.width)).toEqual([600, 394])
  })

  it('moves a sash within the neighbours limits, one split at a time', () => {
    const layout = insert(build('a', 'b'), 'c', { side: 'bottom' })
    const row = (rootSplit(layout).children[0] as DockSplit).id
    const wider = resize(layout, row, 0, 100, AREA, GEOMETRY)
    const widths = rects(wider, AREA, GEOMETRY)
      .stacks.slice(0, 2)
      .map((rect) => rect.bounds.width)
    expect(widths).toEqual([597, 397])
    const clamped = resize(layout, row, 0, 5000, AREA, GEOMETRY)
    expect(rects(clamped, AREA, GEOMETRY).stacks[1]?.bounds.width).toBe(120)
    expect(resize(clamped, row, 0, 5000, AREA, GEOMETRY)).toBe(clamped)
    expect(resize(layout, 'missing', 0, 10, AREA, GEOMETRY)).toBe(layout)
    expect(resize(layout, row, 5, 10, AREA, GEOMETRY)).toBe(layout)
    expect(resize(layout, (stackOf(layout, 'a') as DockStack).id, 0, 10, AREA, GEOMETRY)).toBe(
      layout,
    )
    const tiny = { x: 0, y: 0, width: 200, height: 200 }
    expect(resize(layout, row, 0, 10, tiny, GEOMETRY)).toBe(layout)
    expect(validate(wider)).toBe(true)
  })

  it('rejects layouts that break an invariant', () => {
    const stack = (id: string, windows: string[], active = windows[0] ?? ''): DockStack => ({
      kind: 'stack',
      id,
      windows,
      active,
    })
    const split = (id: string, children: DockNode[], sizes: number[], axis = 'row' as const) =>
      ({ kind: 'split', id, axis, children, sizes }) as DockSplit
    const valid = split('r', [stack('s1', ['a']), stack('s2', ['b'])], [0.5, 0.5])
    expect(validate({ root: valid })).toBe(true)
    const broken: unknown[] = [
      { root: stack('s', []) },
      { root: stack('s', ['a'], 'b') },
      { root: stack('s', ['a', 'a']) },
      { root: split('r', [stack('s1', ['a']), stack('s2', ['a'])], [0.5, 0.5]) },
      { root: split('r', [stack('s', ['a']), stack('s', ['b'])], [0.5, 0.5]) },
      { root: split('r', [stack('s1', ['a'])], [1]) },
      { root: split('r', [stack('s1', ['a']), stack('s2', ['b'])], [0.5]) },
      { root: split('r', [stack('s1', ['a']), stack('s2', ['b'])], [0.7, 0.7]) },
      { root: split('r', [stack('s1', ['a']), stack('s2', ['b'])], [1, 0]) },
      { root: split('r', [stack('s1', ['a']), stack('s2', ['b'])], [Number.NaN, 0.5]) },
      {
        root: split(
          'r',
          [stack('s1', ['a']), split('n', [stack('s3', ['c']), stack('s4', ['d'])], [0.5, 0.5])],
          [0.5, 0.5],
        ),
      },
      { root: { ...valid, axis: 'diagonal' } },
      { root: { kind: 'tile', id: 'x' } },
      { root: { ...stack('s', ['a']), windows: 'a' } },
      { root: { ...valid, children: 'nope' } },
      { root: { ...valid, sizes: 'nope' } },
      { root: { ...stack('s', ['a']), id: 7 } },
      { root: { ...stack('s', [7 as unknown as string]) } },
      { root: 'stack' },
      { nothing: true },
      null,
    ]
    for (const layout of broken) expect(validate(layout as DockLayout)).toBe(false)
  })

  it('keeps every invariant and an exact tiling through random operation sequences', () => {
    const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const sides = ['left', 'right', 'top', 'bottom', 'center'] as const
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = rng(seed)
      const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
      let layout = emptyLayout
      const area = {
        x: 0,
        y: 0,
        width: 400 + Math.floor(random() * 1200),
        height: 300 + Math.floor(random() * 700),
      }
      for (let step = 0; step < 40; step += 1) {
        const docked = windowsOf(layout)
        const stacks = rects(layout, area, GEOMETRY).stacks
        const roll = random()
        if (roll < 0.5 || docked.length === 0) {
          const target = random() < 0.3 || stacks.length === 0 ? {} : { stackId: pick(stacks).id }
          layout = insert(layout, pick(pool), { ...target, side: pick(sides) })
        } else if (roll < 0.7) {
          layout = remove(layout, pick(docked))
        } else if (roll < 0.85) {
          const { sashes } = rects(layout, area, GEOMETRY)
          if (sashes.length > 0) {
            const sash = pick(sashes)
            layout = resize(
              layout,
              sash.splitId,
              sash.index,
              (random() - 0.5) * 600,
              area,
              GEOMETRY,
            )
          }
        } else if (roll < 0.93) {
          layout = activate(layout, pick(docked))
        } else {
          layout = moveInStack(layout, pick(docked), Math.floor(random() * 4))
        }
        const label = `seed ${seed} step ${step}`
        expect(validate(layout), label).toBe(true)
        expect(new Set(windowsOf(layout)).size, label).toBe(windowsOf(layout).length)
        const placed = rects(layout, area, GEOMETRY)
        const boxes = [...placed.stacks, ...placed.sashes].map((rect) => rect.bounds)
        const covered = boxes.reduce((sum, box) => sum + box.width * box.height, 0)
        expect(covered, label).toBeCloseTo(boxes.length > 0 ? area.width * area.height : 0, 6)
        for (let i = 0; i < boxes.length; i += 1) {
          for (let j = i + 1; j < boxes.length; j += 1) {
            expect(overlap(boxes[i] as Bounds, boxes[j] as Bounds), label).toBe(0)
          }
        }
        const fits =
          placed.stacks.length * (GEOMETRY.minSize.width + GEOMETRY.sash) <= area.width &&
          placed.stacks.length * (GEOMETRY.minSize.height + GEOMETRY.sash) <= area.height
        if (fits) {
          for (const stack of placed.stacks) {
            expect(stack.bounds.width, label).toBeGreaterThanOrEqual(GEOMETRY.minSize.width - 1)
            expect(stack.bounds.height, label).toBeGreaterThanOrEqual(GEOMETRY.minSize.height - 1)
          }
        }
      }
    }
  })
})
