// @vitest-environment jsdom
import fc from 'fast-check'
import { afterEach, describe, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { Bounds, Size, WindowManager, WindowState } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController } from '../../src/dom/shared'
import { type Frames, stubFrames } from './support/frames'
import { fuzz, patience } from './support/fuzz'

const VIEWPORT = { width: 2400, height: 1600 }
const EDGES = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as const
type Edge = (typeof EDGES)[number]

interface Limits {
  min: Size
  max: Size | null
}

interface Case {
  start: Bounds
  own: Limits
  mate: Limits | null
  aspect: number | null
  edge: Edge
  path: Array<[number, number]>
  everyFrame: boolean
  end: 'up' | 'escape' | 'cancel'
  placed: 'free' | 'zone' | 'rect'
}

interface Bench {
  wm: WindowManager
  desktop: DesktopController
  element: HTMLElement
  frames: Frames
}

function pointerEvent(type: string, x: number, y: number): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  Object.defineProperty(event, 'isPrimary', { value: true })
  return event as PointerEvent
}

function bench(): Bench {
  const frames = stubFrames()
  const captured = new Set<number>()
  Element.prototype.setPointerCapture = (id: number) => void captured.add(id)
  Element.prototype.releasePointerCapture = (id: number) => void captured.delete(id)
  Element.prototype.hasPointerCapture = (id: number) => captured.has(id)
  const element = document.createElement('div')
  document.body.append(element)
  const wm = createWindowManager({ viewport: VIEWPORT })
  const desktop = attachDesktop(wm, element, {
    autoViewport: false,
    announce: false,
    magnetism: false,
  })
  return { wm, desktop, element, frames }
}

function open(b: Bench, id: string, bounds: Bounds, limits: Limits, aspect: number | null): void {
  b.wm.open({
    id,
    ...bounds,
    minWidth: limits.min.width,
    minHeight: limits.min.height,
    maxWidth: limits.max?.width,
    maxHeight: limits.max?.height,
    aspectRatio: aspect ?? undefined,
  })
  const root = document.createElement('section')
  root.innerHTML = '<header data-wm-drag><span data-wm-title>t</span></header>'
  b.element.append(root)
  b.desktop.attachWindow(id, root)
}

function flush(b: Bench): void {
  b.frames.flush(3)
}

function stage(b: Bench, given: Case): WindowState {
  open(b, 'a', given.start, given.own, given.aspect)
  if (given.mate) {
    open(b, 'b', { ...given.start, x: given.start.x + 40 }, given.mate, null)
    b.wm.group(['a', 'b'])
    b.wm.activateTab('a')
  }
  if (given.placed === 'zone') b.wm.snap('a', 'left')
  if (given.placed === 'rect') b.wm.snapTo('a', { x: 0.25, y: 0.1, width: 0.4, height: 0.6 })
  b.wm.focus('a')
  b.wm.clearHistory()
  flush(b)
  return b.wm.get('a') as WindowState
}

function gesture(b: Bench, given: Case, path: Array<[number, number]>, everyFrame: boolean): void {
  const grip = b.element.querySelector<HTMLElement>(
    `[data-wm-window="a"] [data-wm-resize="${given.edge}"]`,
  )
  if (!grip) throw new Error(`no ${given.edge} grip`)
  const origin = { x: 1000, y: 700 }
  grip.dispatchEvent(pointerEvent('pointerdown', origin.x, origin.y))
  for (const [dx, dy] of path) {
    grip.dispatchEvent(pointerEvent('pointermove', origin.x + dx, origin.y + dy))
    if (everyFrame) flush(b)
  }
  if (given.end === 'escape') {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  } else {
    grip.dispatchEvent(pointerEvent(given.end === 'up' ? 'pointerup' : 'pointercancel', 0, 0))
  }
  flush(b)
}

function merged(given: Case): { min: Size; max: Size } {
  const all = given.mate ? [given.own, given.mate] : [given.own]
  return {
    min: {
      width: Math.max(...all.map((limits) => limits.min.width)),
      height: Math.max(...all.map((limits) => limits.min.height)),
    },
    max: {
      width: Math.min(...all.map((limits) => limits.max?.width ?? Infinity)),
      height: Math.min(...all.map((limits) => limits.max?.height ?? Infinity)),
    },
  }
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6

function judge(given: Case, before: WindowState, after: WindowState): string[] {
  const found: string[] = []
  const from = before.bounds
  const to = after.bounds
  const { min, max } = merged(given)
  const [dx, dy] = given.path[given.path.length - 1] as [number, number]
  const edge = given.edge
  const wide = edge.includes('e') || edge.includes('w')
  const tall = edge.includes('n') || edge.includes('s')

  if (!edge.includes('w') && !near(to.x, from.x)) found.push(`the left edge moved to ${to.x}`)
  if (edge.includes('w') && !near(to.x + to.width, from.x + from.width)) {
    found.push(`the right edge moved to ${to.x + to.width}`)
  }
  if (!edge.includes('n') && !near(to.y, from.y)) found.push(`the top edge moved to ${to.y}`)
  if (edge.includes('n') && !near(to.y + to.height, from.y + from.height)) {
    found.push(`the bottom edge moved to ${to.y + to.height}`)
  }
  if (to.width > max.width + 1e-6 || to.height > max.height + 1e-6) {
    found.push(`${to.width}x${to.height} is over the maximum ${max.width}x${max.height}`)
  }
  const bounded = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high)
  if (given.aspect !== null) {
    const ratio = given.aspect
    if (!near(to.width / to.height, ratio)) {
      found.push(`${to.width}x${to.height} lost the ratio ${ratio}`)
    }
    if (edge === 's') {
      const height = bounded(
        from.height + dy,
        Math.max(min.height, min.width / ratio),
        Math.min(max.height, max.width / ratio),
      )
      if (!near(to.height, height)) found.push(`${to.height} tall, the pointer asked for ${height}`)
    } else if (!edge.includes('n')) {
      const width = bounded(
        edge.includes('e') ? from.width + dx : from.width - dx,
        Math.max(min.width, min.height * ratio),
        Math.min(max.width, max.height * ratio),
      )
      if (!near(to.width, width)) found.push(`${to.width} wide, the pointer asked for ${width}`)
    }
    return found
  }
  if (min.width <= max.width && to.width < min.width)
    found.push(`${to.width} wide, under ${min.width}`)
  if (min.height <= max.height && to.height < min.height) {
    found.push(`${to.height} tall, under ${min.height}`)
  }
  const pulled = edge.includes('e') ? from.width + dx : from.width - dx
  const width = wide ? bounded(pulled, min.width, max.width) : from.width
  if (!near(to.width, width)) found.push(`${to.width} wide, the pointer asked for ${width}`)
  const top = Math.max(Math.min(0, from.y), from.y + dy)
  const stretched = edge.includes('s') ? from.height + dy : from.y + from.height - top
  const height = tall ? bounded(stretched, min.height, max.height) : from.height
  const room = edge.includes('n') ? from.y + from.height - Math.min(0, from.y) : Infinity
  if (!near(to.height, Math.min(height, Math.max(room, min.height)))) {
    found.push(`${to.height} tall, the pointer asked for ${height}`)
  }
  return found
}

const size = (low: number, high: number) =>
  fc.record({
    width: fc.integer({ min: low, max: high }),
    height: fc.integer({ min: low, max: high }),
  })

const slack = fc.record({
  under: size(0, 260),
  over: fc.option(size(0, 700), { nil: null, freq: 2 }),
  crossed: fc.integer({ min: 0, max: 9 }).map((roll) => roll === 0),
})

function around(start: Bounds, room: { under: Size; over: Size | null; crossed: boolean }): Limits {
  const min = {
    width: Math.max(20, start.width - room.under.width),
    height: Math.max(20, start.height - room.under.height),
  }
  if (room.crossed)
    return { min, max: { width: Math.max(1, min.width - 30), height: min.height + 200 } }
  if (room.over === null) return { min, max: null }
  return {
    min,
    max: { width: start.width + room.over.width, height: start.height + room.over.height },
  }
}

const travel = fc.tuple(fc.integer({ min: -900, max: 900 }), fc.integer({ min: -900, max: 900 }))

const anyCase: fc.Arbitrary<Case> = fc
  .record({
    start: fc.record({
      x: fc.integer({ min: 300, max: 900 }),
      y: fc.integer({ min: 200, max: 600 }),
      width: fc.integer({ min: 120, max: 700 }),
      height: fc.integer({ min: 100, max: 500 }),
    }),
    own: slack,
    mate: fc.option(slack, { nil: null, freq: 4 }),
    aspect: fc.option(fc.constantFrom(0.5, 1, 1.5, 2), { nil: null, freq: 2 }),
    edge: fc.constantFrom(...EDGES),
    path: fc.array(travel, { minLength: 1, maxLength: 5 }),
    everyFrame: fc.boolean(),
    end: fc.constantFrom('up' as const, 'up' as const, 'escape' as const, 'cancel' as const),
    placed: fc.constantFrom(
      'free' as const,
      'free' as const,
      'free' as const,
      'zone' as const,
      'rect' as const,
    ),
  })
  .map((drawn) => ({
    ...drawn,
    own: around(drawn.start, drawn.own),
    mate: drawn.mate && around(drawn.start, drawn.mate),
  }))

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

function run(given: Case, path = given.path, everyFrame = given.everyFrame) {
  const b = bench()
  try {
    const before = stage(b, given)
    gesture(b, given, path, everyFrame)
    const after = b.wm.get('a') as WindowState
    const mate = given.mate ? (b.wm.get('b') as WindowState) : null
    const steps = b.wm.canUndo()
    b.wm.undo()
    const undone = b.wm.get('a') as WindowState
    b.wm.redo()
    const redone = b.wm.get('a') as WindowState
    return { before, after, mate, steps, undone, redone }
  } finally {
    b.desktop.destroy()
    b.wm.destroy()
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

describe('a window resized by any grip along any path', () => {
  it(
    'keeps its other edges, its limits and its ratio, and undoes or cancels in one piece',
    () => {
      fc.assert(
        fc.property(anyCase, (given) => {
          const first = run(given)
          const found: string[] = []
          if (given.end !== 'up') {
            if (!same(first.after, first.before)) {
              found.push(`a cancelled resize left ${JSON.stringify(first.after.bounds)}`)
            }
            if (first.steps) found.push('a cancelled resize left an undo step')
          } else {
            const direct = run(given, [given.path[given.path.length - 1] as [number, number]], true)
            if (!same(first.after.bounds, direct.after.bounds)) {
              found.push(
                `the path changed the result: ${JSON.stringify(first.after.bounds)} against ${JSON.stringify(direct.after.bounds)}`,
              )
            }
            if (first.mate && !same(first.mate.bounds, first.after.bounds)) {
              found.push('the other tab of the group has another frame')
            }
            if (given.placed === 'free') found.push(...judge(given, first.before, first.after))
            const changed = !same(first.after, first.before)
            if (changed !== first.steps)
              found.push(`changed is ${changed}, an undo step is ${first.steps}`)
            if (changed && !same(first.undone, first.before)) {
              found.push(`undo gave ${JSON.stringify(first.undone.bounds)}`)
            }
            if (changed && !same(first.redone, first.after)) {
              found.push(`redo gave ${JSON.stringify(first.redone.bounds)}`)
            }
          }
          if (found.length > 0) {
            throw new Error(
              `${found.join('\n')}\nfrom ${JSON.stringify(first.before.bounds)} to ${JSON.stringify(first.after.bounds)}`,
            )
          }
        }),
        fuzz(300),
      )
    },
    patience(120_000),
  )
})
