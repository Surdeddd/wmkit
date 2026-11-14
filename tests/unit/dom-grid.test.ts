// @vitest-environment jsdom
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { Bounds, WindowInit, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController, DesktopOptions } from '../../src/dom/shared'
import { type Frames, stubFrames } from './support/frames'
import { fuzz, patience } from './support/fuzz'

type Move = [x: number, y: number, alt?: boolean]
type Direction = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

function pointerEvent(type: string, x: number, y: number, alt = false): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX: x,
    clientY: y,
    altKey: alt,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  return event as PointerEvent
}

let wm: WindowManager
let desktop: DesktopController
let frames: Frames
let root: HTMLElement
const mounted: DesktopController[] = []

function mount(options: DesktopOptions, init: WindowInit = {}): void {
  const element = document.createElement('div')
  document.body.append(element)
  wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  desktop = attachDesktop(wm, element, {
    autoViewport: false,
    announce: false,
    magnetism: false,
    snap: false,
    ...options,
  })
  mounted.push(desktop)
  wm.open({ id: 'a', x: 113, y: 87, width: 240, height: 180, ...init })
  root = document.createElement('section')
  root.innerHTML = '<header data-wm-drag><span data-wm-title>t</span></header>'
  element.append(root)
  desktop.attachWindow('a', root)
}

function unmount(): void {
  for (const one of mounted.splice(0)) one.destroy()
  document.body.replaceChildren()
}

const bounds = (): Bounds => (wm.get('a') as { bounds: Bounds }).bounds

function gesture(
  target: HTMLElement,
  from: [number, number],
  path: Move[],
  end: 'up' | 'escape' | 'hold' = 'up',
): void {
  target.dispatchEvent(pointerEvent('pointerdown', from[0], from[1]))
  let last = from
  for (const [x, y, alt] of path) {
    target.dispatchEvent(pointerEvent('pointermove', x, y, alt))
    frames.flush(2)
    last = [x, y]
  }
  if (end === 'up') target.dispatchEvent(pointerEvent('pointerup', last[0], last[1]))
  if (end === 'escape') {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  }
}

function drag(by: Move[], end: 'up' | 'escape' | 'hold' = 'up'): void {
  const start = bounds()
  const from: [number, number] = [start.x + 40, start.y + 10]
  gesture(
    root.querySelector('[data-wm-drag]') as HTMLElement,
    from,
    by.map(([dx, dy, alt]) => [from[0] + dx, from[1] + dy, alt]),
    end,
  )
}

function pull(direction: Direction, by: Move[], end: 'up' | 'escape' | 'hold' = 'up'): void {
  const from: [number, number] = [600, 400]
  gesture(
    root.querySelector(`[data-wm-resize="${direction}"]`) as HTMLElement,
    from,
    by.map(([dx, dy, alt]) => [from[0] + dx, from[1] + dy, alt]),
    end,
  )
}

const onGrid = (value: number, step: number) =>
  Math.abs(value - Math.round(value / step) * step) < 1e-6

beforeEach(() => {
  frames = stubFrames()
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.hasPointerCapture = () => false
})

afterEach(() => {
  unmount()
  vi.unstubAllGlobals()
})

describe('dragging a window over a grid', () => {
  it('lands on the nearest crossing of the grid', () => {
    mount({ grid: 20 })
    drag([[31, 6]])
    expect(bounds()).toMatchObject({ x: 140, y: 100, width: 240, height: 180 })
  })

  it('puts a window that stood off the grid onto it with the first movement', () => {
    mount({ grid: 50 })
    drag([[4, 0]], 'hold')
    expect(bounds()).toMatchObject({ x: 100, y: 100 })
  })

  it('never writes a negative zero', () => {
    mount({ grid: 100 }, { x: 30, y: 30 })
    drag([[-40, -5]])
    expect(Object.is(bounds().x, 0)).toBe(true)
    expect(Object.is(bounds().y, 0)).toBe(true)
  })

  it('takes a step for each axis', () => {
    mount({ grid: { x: 50, y: 30 } })
    drag([[31, 6]])
    expect(bounds()).toMatchObject({ x: 150, y: 90 })
  })

  it('leaves an axis without a step alone', () => {
    mount({ grid: { x: 50 } })
    drag([[31, 6]])
    expect(bounds()).toMatchObject({ x: 150, y: 93 })
    unmount()

    mount({ grid: { y: 30 } })
    drag([[31, 6]])
    expect(bounds()).toMatchObject({ x: 144, y: 90 })
  })

  it.each([
    0,
    -20,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    '20',
    null,
    {},
    { x: 0, y: -1 },
    { x: Number.NaN, y: Number.POSITIVE_INFINITY },
  ])('has no grid for a step of %o', (grid) => {
    mount({ grid: grid as never })
    drag([[31, 6]])
    expect(bounds()).toMatchObject({ x: 144, y: 93 })
  })

  it('lets the window go where the pointer is while Alt is held, and takes it back after', () => {
    mount({ grid: 20 })
    drag(
      [
        [31, 6, true],
        [33, 8, true],
      ],
      'hold',
    )
    expect(bounds()).toMatchObject({ x: 146, y: 95 })
    const handle = root.querySelector('[data-wm-drag]') as HTMLElement
    handle.dispatchEvent(pointerEvent('pointermove', 113 + 40 + 34, 87 + 10 + 8))
    frames.flush(2)
    expect(bounds()).toMatchObject({ x: 140, y: 100 })
  })

  it('returns the window to where it stood, off the grid, on Escape', () => {
    mount({ grid: 20 })
    drag([[31, 6]], 'escape')
    expect(bounds()).toMatchObject({ x: 113, y: 87 })
  })

  it('keeps an edge the magnet caught where the magnet put it, and the other axis on the grid', () => {
    mount({ grid: 50, magnetism: { threshold: 8 } })
    wm.open({ id: 'b', x: 500, y: 331, width: 210, height: 200 })
    drag([[143, 6]], 'hold')
    expect(bounds()).toMatchObject({ x: 260, y: 100 })

    unmount()
    mount({ grid: 50, magnetism: { threshold: 8 } })
    wm.open({ id: 'b', x: 500, y: 331, width: 210, height: 200 })
    drag([[113, 60]], 'hold')
    expect(bounds()).toMatchObject({ x: 250, y: 151 })
  })

  it('still snaps to a zone the pointer reaches', () => {
    mount({ grid: 50, snap: true })
    const start = bounds()
    gesture(
      root.querySelector('[data-wm-drag]') as HTMLElement,
      [start.x + 40, start.y + 10],
      [[2, 400]],
    )
    expect(wm.get('a')).toMatchObject({ stage: 'snapped', snapZone: 'left' })
  })

  it('lands on the grid when it is dragged out of a maximized window', () => {
    mount({ grid: 50 })
    wm.maximize('a')
    gesture(root.querySelector('[data-wm-drag]') as HTMLElement, [600, 10], [[623, 317]])
    const after = wm.get('a')
    expect(after?.stage).toBe('normal')
    expect(onGrid(bounds().x, 50)).toBe(true)
    expect(onGrid(bounds().y, 50)).toBe(true)
  })

  it('does not change what the arrow keys do', () => {
    mount({ grid: 50 })
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(bounds()).toMatchObject({ x: 129, y: 87 })
  })

  it(
    'holds for any path of the pointer: each axis is on the grid or at a limit of the desktop',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            step: fc.record({
              x: fc.integer({ min: 2, max: 90 }),
              y: fc.integer({ min: 2, max: 90 }),
            }),
            start: fc.record({
              x: fc.integer({ min: 0, max: 900 }),
              y: fc.integer({ min: 0, max: 500 }),
              width: fc.integer({ min: 120, max: 400 }),
              height: fc.integer({ min: 90, max: 300 }),
            }),
            path: fc.array(
              fc.tuple(fc.integer({ min: -300, max: 1500 }), fc.integer({ min: -200, max: 1000 })),
              { minLength: 1, maxLength: 12 },
            ),
          }),
          ({ step, start, path }) => {
            mount({ grid: step }, start)
            try {
              const opened = bounds()
              const handle = root.querySelector('[data-wm-drag]') as HTMLElement
              handle.dispatchEvent(pointerEvent('pointerdown', opened.x + 30, opened.y + 8))
              for (const [x, y] of path) {
                handle.dispatchEvent(pointerEvent('pointermove', x, y))
                frames.flush(2)
                if (!('wmDragging' in root.dataset)) continue
                const now = bounds()
                const where = `${JSON.stringify(now)} over ${JSON.stringify(step)}`
                expect(onGrid(now.x, step.x) || [48 - now.width, 1152].includes(now.x), where).toBe(
                  true,
                )
                expect(onGrid(now.y, step.y) || [0, 752].includes(now.y), where).toBe(true)
                expect([now.width, now.height], where).toEqual([opened.width, opened.height])
              }
              handle.dispatchEvent(pointerEvent('pointerup', 0, 0))
            } finally {
              unmount()
            }
          },
        ),
        fuzz(80),
      )
    },
    patience(60_000),
  )
})

describe('resizing a window over a grid', () => {
  it('lands the edge that is pulled on the grid and leaves the others alone', () => {
    mount({ grid: 20 })
    pull('e', [[9, 50]])
    expect(bounds()).toEqual({ x: 113, y: 87, width: 247, height: 180 })
    pull('s', [[70, 9]])
    expect(bounds()).toEqual({ x: 113, y: 87, width: 247, height: 193 })
    pull('w', [[-9, 50]])
    expect(bounds()).toEqual({ x: 100, y: 87, width: 260, height: 193 })
    pull('n', [[70, -9]])
    expect(bounds()).toEqual({ x: 100, y: 80, width: 260, height: 200 })
  })

  it('lands both edges of a corner, each on its own step', () => {
    mount({ grid: { x: 50, y: 30 } })
    pull('se', [[20, 20]])
    expect(bounds()).toEqual({ x: 113, y: 87, width: 237, height: 213 })
    pull('nw', [[-20, -20]])
    expect(bounds()).toEqual({ x: 100, y: 60, width: 250, height: 240 })
    pull('ne', [[30, 20]])
    expect(bounds()).toEqual({ x: 100, y: 90, width: 300, height: 210 })
    pull('sw', [[30, 40]])
    expect(bounds()).toEqual({ x: 150, y: 90, width: 250, height: 240 })
  })

  it('lets the smallest and the largest size win over the grid', () => {
    mount({ grid: 100 }, { minWidth: 230, minHeight: 170, maxWidth: 270, maxHeight: 190 })
    pull('se', [[-200, -200]])
    expect(bounds()).toEqual({ x: 113, y: 87, width: 230, height: 170 })
    pull('se', [[300, 300]])
    expect(bounds()).toEqual({ x: 113, y: 87, width: 270, height: 190 })
  })

  it('lets the proportions win: the pulled side lands, the other follows it', () => {
    mount({ grid: 50 }, { x: 100, y: 100, width: 200, height: 100, aspectRatio: 2 })
    pull('e', [[38, 0]])
    expect(bounds()).toEqual({ x: 100, y: 100, width: 250, height: 125 })
    pull('s', [[0, 12]])
    expect(bounds()).toEqual({ x: 100, y: 100, width: 300, height: 150 })
  })

  it('stops at the top of the desktop even when the grid lies above it', () => {
    mount({ grid: 50 }, { x: 100, y: 10, width: 200, height: 100 })
    pull('n', [[0, -40]])
    expect(bounds()).toEqual({ x: 100, y: 0, width: 200, height: 110 })
  })

  it('follows the pointer exactly while Alt is held, and returns to the grid after', () => {
    mount({ grid: 20 })
    pull('se', [[9, 9, true]], 'hold')
    expect(bounds()).toEqual({ x: 113, y: 87, width: 249, height: 189 })
    const grip = root.querySelector('[data-wm-resize="se"]') as HTMLElement
    grip.dispatchEvent(pointerEvent('pointermove', 600 + 9, 400 + 9))
    frames.flush(2)
    expect(bounds()).toEqual({ x: 113, y: 87, width: 247, height: 193 })
  })

  it('returns the window to its size, off the grid, on Escape', () => {
    mount({ grid: 20 })
    pull('se', [[9, 9]], 'escape')
    expect(bounds()).toEqual({ x: 113, y: 87, width: 240, height: 180 })
  })

  it('changes nothing about a resize when there is no grid', () => {
    mount({}, { x: 0.1, y: 0.7, width: 200.2, height: 100.4 })
    pull('se', [[0.3, 0.3]])
    expect(bounds()).toEqual({
      x: 0.1,
      y: 0.7,
      width: 200.2 + (600.3 - 600),
      height: 100.4 + (400.3 - 400),
    })
  })

  it(
    'holds for any pull: a pulled edge is on the grid unless a limit of the window stopped it',
    () => {
      const limits = { minWidth: 100, minHeight: 80, maxWidth: 700, maxHeight: 500 }
      fc.assert(
        fc.property(
          fc.record({
            step: fc.record({
              x: fc.integer({ min: 2, max: 90 }),
              y: fc.integer({ min: 2, max: 90 }),
            }),
            start: fc.record({
              x: fc.integer({ min: 0, max: 600 }),
              y: fc.integer({ min: 0, max: 300 }),
              width: fc.integer({ min: 120, max: 400 }),
              height: fc.integer({ min: 90, max: 300 }),
            }),
            direction: fc.constantFrom<Direction>('n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'),
            path: fc.array(
              fc.tuple(fc.integer({ min: -500, max: 500 }), fc.integer({ min: -400, max: 400 })),
              { minLength: 1, maxLength: 10 },
            ),
          }),
          ({ step, start, direction, path }) => {
            mount({ grid: step }, { ...start, ...limits })
            try {
              const opened = bounds()
              const grip = root.querySelector(`[data-wm-resize="${direction}"]`) as HTMLElement
              grip.dispatchEvent(pointerEvent('pointerdown', 600, 400))
              for (const [dx, dy] of path) {
                grip.dispatchEvent(pointerEvent('pointermove', 600 + dx, 400 + dy))
                frames.flush(2)
                const now = bounds()
                const where = `${direction}: ${JSON.stringify(now)} over ${JSON.stringify(step)}`
                const stoppedX = now.width === limits.minWidth || now.width === limits.maxWidth
                const stoppedY =
                  now.height === limits.minHeight || now.height === limits.maxHeight || now.y === 0
                if (direction.includes('e')) {
                  expect(onGrid(now.x + now.width, step.x) || stoppedX, where).toBe(true)
                  expect(now.x, where).toBe(opened.x)
                } else if (direction.includes('w')) {
                  expect(onGrid(now.x, step.x) || stoppedX, where).toBe(true)
                  expect(now.x + now.width, where).toBe(opened.x + opened.width)
                } else {
                  expect([now.x, now.width], where).toEqual([opened.x, opened.width])
                }
                if (direction.includes('s')) {
                  expect(onGrid(now.y + now.height, step.y) || stoppedY, where).toBe(true)
                  expect(now.y, where).toBe(opened.y)
                } else if (direction.includes('n')) {
                  expect(onGrid(now.y, step.y) || stoppedY, where).toBe(true)
                  expect(now.y + now.height, where).toBe(opened.y + opened.height)
                } else {
                  expect([now.y, now.height], where).toEqual([opened.y, opened.height])
                }
              }
              grip.dispatchEvent(pointerEvent('pointerup', 600, 400))
            } finally {
              unmount()
            }
          },
        ),
        fuzz(120),
      )
    },
    patience(60_000),
  )
})
