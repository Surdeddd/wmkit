// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowInit, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController, DesktopOptions } from '../../src/dom/shared'

const VIEWPORT = { width: 800, height: 600 }

function touchEvent(type: string, id: number, x: number, y: number, kind = 'touch'): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'pointerId', { value: id })
  Object.defineProperty(event, 'pointerType', { value: kind })
  return event as PointerEvent
}

interface Harness {
  wm: WindowManager
  desktop: DesktopController
  element: HTMLElement
  add(init: WindowInit & { id: string }): { root: HTMLElement; handle: HTMLElement }
  flushFrames(): void
}

const frames: Array<() => void> = []

function makeHarness(options: DesktopOptions = {}): Harness {
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.hasPointerCapture = () => false
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(() => callback(0))
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})

  const element = document.createElement('div')
  document.body.append(element)
  const wm = createWindowManager({ viewport: VIEWPORT })
  const desktop = attachDesktop(wm, element, { autoViewport: false, announce: false, ...options })

  return {
    wm,
    desktop,
    element,
    add(init) {
      wm.open(init)
      const root = document.createElement('section')
      root.innerHTML = '<header data-wm-drag><span data-wm-title>t</span></header>'
      element.append(root)
      desktop.attachWindow(init.id, root)
      return { root, handle: root.querySelector('[data-wm-drag]') as HTMLElement }
    },
    flushFrames() {
      for (const frame of frames.splice(0)) frame()
    },
  }
}

function pinch(
  harness: Harness,
  target: HTMLElement,
  from: [number, number, number, number],
  to: [number, number, number, number],
): void {
  target.dispatchEvent(touchEvent('pointerdown', 1, from[0], from[1]))
  target.dispatchEvent(touchEvent('pointerdown', 2, from[2], from[3]))
  target.dispatchEvent(touchEvent('pointermove', 1, to[0], to[1]))
  target.dispatchEvent(touchEvent('pointermove', 2, to[2], to[3]))
  harness.flushFrames()
}

function swipe(
  harness: Harness,
  target: HTMLElement,
  from: [number, number],
  travel: [number, number],
): void {
  const [x, y] = from
  const [dx, dy] = travel
  target.dispatchEvent(touchEvent('pointerdown', 3, x, y))
  target.dispatchEvent(touchEvent('pointerdown', 4, x + 60, y))
  target.dispatchEvent(touchEvent('pointermove', 3, x + dx, y + dy))
  target.dispatchEvent(touchEvent('pointermove', 4, x + 60 + dx, y + dy))
  harness.flushFrames()
  target.dispatchEvent(touchEvent('pointerup', 3, x + dx, y + dy))
  target.dispatchEvent(touchEvent('pointerup', 4, x + 60 + dx, y + dy))
}

afterEach(() => {
  frames.length = 0
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('pinch to resize', () => {
  it('scales the window around the midpoint of the two fingers', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    pinch(harness, root, [100, 100, 300, 300], [50, 50, 350, 350])

    expect(root.dataset.wmPinching).toBe('')
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 50, y: 50, width: 300, height: 300 })
  })

  it('keeps the anchor when the fingers close in', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 100, y: 100, width: 400, height: 400 })
    const root = harness.element.querySelector('[data-wm-window="a"]') as HTMLElement

    pinch(harness, root, [100, 100, 500, 500], [200, 200, 400, 400])

    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 200, y: 200, width: 200, height: 200 })
  })

  it('waits for the fingers to travel past the threshold', () => {
    const harness = makeHarness({ pinch: { threshold: 40 } })
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    pinch(harness, root, [100, 100, 300, 100], [95, 100, 305, 100])

    expect(root.dataset.wmPinching).toBeUndefined()
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100, width: 200 })
  })

  it('refuses to pinch while a drag is in flight', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { root, handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    handle.dispatchEvent(touchEvent('pointerdown', 9, 150, 110))
    handle.dispatchEvent(touchEvent('pointermove', 9, 180, 140))
    harness.flushFrames()
    const dragged = harness.wm.get('a')?.bounds

    pinch(harness, root, [100, 100, 300, 300], [50, 50, 350, 350])

    expect(root.dataset.wmPinching).toBeUndefined()
    expect(harness.wm.get('a')?.bounds).toEqual(dragged)
  })

  it('refuses to pinch a window that cannot resize or is not normal', () => {
    const harness = makeHarness()
    const fixed = harness.add({ id: 'a', x: 0, y: 0, width: 200, height: 200, resizable: false })
    pinch(harness, fixed.root, [0, 0, 200, 200], [-50, -50, 250, 250])
    expect(harness.wm.get('a')?.bounds).toMatchObject({ width: 200, height: 200 })

    const big = harness.add({ id: 'b', x: 100, y: 100, width: 200, height: 200 })
    harness.wm.maximize('b')
    const maximized = harness.wm.get('b')?.bounds
    pinch(harness, big.root, [100, 100, 300, 300], [50, 50, 350, 350])
    expect(harness.wm.get('b')?.bounds).toEqual(maximized)
  })

  it('keeps the anchor honest when the minimum size stops the shrink', () => {
    const harness = makeHarness()
    const small = harness.add({
      id: 'a',
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      minWidth: 180,
      minHeight: 180,
    })

    pinch(harness, small.root, [100, 100, 300, 300], [180, 180, 220, 220])

    expect(harness.wm.get('a')?.bounds).toEqual({ x: 110, y: 110, width: 180, height: 180 })
  })

  it('keeps the anchor honest when the aspect ratio stops the shrink', () => {
    const harness = makeHarness()
    const wide = harness.add({
      id: 'b',
      x: 100,
      y: 100,
      width: 400,
      height: 200,
      minWidth: 300,
      aspectRatio: 2,
    })

    pinch(harness, wide.root, [100, 100, 500, 300], [250, 150, 350, 250])

    expect(harness.wm.get('b')?.bounds).toEqual({ x: 150, y: 125, width: 300, height: 150 })
  })

  it('grows on the aspect ratio without drifting', () => {
    const harness = makeHarness()
    const wide = harness.add({ id: 'c', x: 100, y: 100, width: 200, height: 100, aspectRatio: 2 })

    pinch(harness, wide.root, [100, 100, 300, 200], [50, 75, 350, 225])

    const bounds = harness.wm.get('c')?.bounds
    expect(bounds?.width).toBeCloseTo(300)
    expect(bounds?.height).toBeCloseTo(150)
    expect(bounds?.x).toBeCloseTo(50)
    expect(bounds?.y).toBeCloseTo(75)
  })

  it('escape and pointercancel put the start bounds back', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    pinch(harness, root, [100, 100, 300, 300], [50, 50, 350, 350])
    expect(harness.wm.get('a')?.bounds.width).toBe(300)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100, width: 200, height: 200 })
    expect(root.dataset.wmPinching).toBeUndefined()

    root.dispatchEvent(touchEvent('pointerup', 1, 50, 50))
    root.dispatchEvent(touchEvent('pointerup', 2, 350, 350))

    pinch(harness, root, [100, 100, 300, 300], [50, 50, 350, 350])
    expect(harness.wm.get('a')?.bounds.width).toBe(300)
    root.dispatchEvent(touchEvent('pointercancel', 1, 50, 50))
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100, width: 200, height: 200 })
  })

  it('refuses to start again while the same fingers are still down', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    pinch(harness, root, [100, 100, 300, 300], [50, 50, 350, 350])
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    pinch(harness, root, [100, 100, 300, 300], [0, 0, 400, 400])
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100, width: 200, height: 200 })
  })

  it('collapses a whole pinch into a single undo step', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })
    harness.wm.clearHistory()

    root.dispatchEvent(touchEvent('pointerdown', 1, 100, 100))
    root.dispatchEvent(touchEvent('pointerdown', 2, 300, 300))
    for (const step of [20, 40, 60]) {
      root.dispatchEvent(touchEvent('pointermove', 1, 100 - step, 100 - step))
      root.dispatchEvent(touchEvent('pointermove', 2, 300 + step, 300 + step))
      harness.flushFrames()
    }
    root.dispatchEvent(touchEvent('pointerup', 1, 40, 40))

    expect(harness.wm.get('a')?.bounds.width).toBe(320)
    expect(harness.wm.undo()).toBe(true)
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100, width: 200, height: 200 })
    expect(harness.wm.canUndo()).toBe(false)
  })

  it('ignores mouse and pen pointers and a third finger', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    root.dispatchEvent(touchEvent('pointerdown', 1, 100, 100, 'mouse'))
    root.dispatchEvent(touchEvent('pointerdown', 2, 300, 300, 'pen'))
    root.dispatchEvent(touchEvent('pointermove', 1, 50, 50, 'mouse'))
    harness.flushFrames()
    expect(harness.wm.get('a')?.bounds).toMatchObject({ width: 200, height: 200 })

    root.dispatchEvent(touchEvent('pointerdown', 3, 100, 100))
    root.dispatchEvent(touchEvent('pointerdown', 4, 300, 300))
    root.dispatchEvent(touchEvent('pointerdown', 5, 200, 200))
    root.dispatchEvent(touchEvent('pointermove', 5, 500, 500))
    harness.flushFrames()
    expect(harness.wm.get('a')?.bounds).toMatchObject({ width: 200, height: 200 })
  })

  it('ignores two fingers that land on the very same spot', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    pinch(harness, root, [200, 200, 200, 200], [100, 100, 300, 300])
    expect(harness.wm.get('a')?.bounds).toMatchObject({ width: 200, height: 200 })
  })

  it('stays out of the way when the gesture is switched off', () => {
    const harness = makeHarness({ pinch: false })
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    pinch(harness, root, [100, 100, 300, 300], [50, 50, 350, 350])
    expect(harness.wm.get('a')?.bounds).toMatchObject({ width: 200, height: 200 })
  })

  it('still pinches when the window is asked to hold the touch action', () => {
    const harness = makeHarness({ pinch: { lockTouchAction: true } })
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    pinch(harness, root, [100, 100, 300, 300], [50, 50, 350, 350])
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 50, y: 50, width: 300, height: 300 })
  })

  it('cancels an in-flight pinch when the desktop is destroyed', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    pinch(harness, root, [100, 100, 300, 300], [50, 50, 350, 350])
    expect(harness.wm.get('a')?.bounds.width).toBe(300)

    harness.desktop.destroy()
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100, width: 200, height: 200 })
  })

  it('lets go quietly when the window closes mid-gesture', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    root.dispatchEvent(touchEvent('pointerdown', 1, 100, 100))
    root.dispatchEvent(touchEvent('pointerdown', 2, 300, 300))
    root.dispatchEvent(touchEvent('pointermove', 1, 50, 50))
    harness.wm.close('a')
    harness.flushFrames()
    root.dispatchEvent(touchEvent('pointerup', 1, 50, 50))

    expect(harness.wm.get('a')).toBeUndefined()
  })

  it('ignores a stray third pointer and keys other than escape', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    pinch(harness, root, [100, 100, 300, 300], [50, 50, 350, 350])
    expect(root.dataset.wmPinching).toBe('')

    root.dispatchEvent(touchEvent('pointermove', 9, 0, 0))
    root.dispatchEvent(touchEvent('pointerup', 9, 0, 0))
    root.dispatchEvent(touchEvent('pointercancel', 9, 0, 0))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    harness.flushFrames()

    expect(root.dataset.wmPinching).toBe('')
    expect(harness.wm.get('a')?.bounds.width).toBe(300)
  })

  it('leaves the bounds alone when a gesture is cancelled before it moves', () => {
    const harness = makeHarness({ pinch: { threshold: 500 } })
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })
    harness.wm.clearHistory()

    pinch(harness, root, [100, 100, 300, 300], [50, 50, 350, 350])
    root.dispatchEvent(touchEvent('pointercancel', 1, 50, 50))

    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100, width: 200, height: 200 })
    expect(harness.wm.canUndo()).toBe(false)
  })

  it('commits the last movement that was still waiting on a frame', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    root.dispatchEvent(touchEvent('pointerdown', 1, 100, 100))
    root.dispatchEvent(touchEvent('pointerdown', 2, 300, 300))
    root.dispatchEvent(touchEvent('pointermove', 1, 50, 50))
    root.dispatchEvent(touchEvent('pointermove', 2, 350, 350))
    root.dispatchEvent(touchEvent('pointerup', 1, 50, 50))

    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 50, y: 50, width: 300, height: 300 })
  })

  it('drops the pinch listeners once the window is detached', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', x: 100, y: 100, width: 200, height: 200 })
    const root = document.createElement('section')
    harness.element.append(root)
    const detach = harness.desktop.attachWindow('a', root)

    detach()
    pinch(harness, root, [100, 100, 300, 300], [50, 50, 350, 350])
    expect(harness.wm.get('a')?.bounds).toMatchObject({ width: 200, height: 200 })
  })
})

describe('two finger swipe to change workspace', () => {
  it('steps to the next workspace and back', () => {
    const harness = makeHarness({ swipe: { threshold: 60, workspaces: 3 } })

    swipe(harness, harness.element, [400, 300], [-120, 10])
    expect(harness.wm.workspace()).toBe(1)

    swipe(harness, harness.element, [300, 300], [140, -6])
    expect(harness.wm.workspace()).toBe(0)
  })

  it('works over a window, not only over bare desktop', () => {
    const harness = makeHarness({ swipe: { threshold: 60, workspaces: 3 } })
    const { root } = harness.add({ id: 'a', x: 0, y: 0, width: 800, height: 600 })

    swipe(harness, root, [400, 300], [-120, 0])

    expect(harness.wm.workspace()).toBe(1)
    expect(harness.wm.get('a')?.bounds).toMatchObject({ width: 800, height: 600 })
  })

  it('stops at the last workspace and never below the first', () => {
    const harness = makeHarness({ swipe: { threshold: 60, workspaces: 2 } })

    swipe(harness, harness.element, [300, 300], [140, 0])
    expect(harness.wm.workspace()).toBe(0)

    swipe(harness, harness.element, [400, 300], [-140, 0])
    swipe(harness, harness.element, [400, 300], [-140, 0])
    expect(harness.wm.workspace()).toBe(1)
  })

  it('keeps going when no workspace count is given', () => {
    const harness = makeHarness({ swipe: { threshold: 60 } })

    swipe(harness, harness.element, [400, 300], [-140, 0])
    swipe(harness, harness.element, [400, 300], [-140, 0])
    expect(harness.wm.workspace()).toBe(2)
  })

  it('ignores a short travel and a mostly vertical one', () => {
    const harness = makeHarness({ swipe: { threshold: 60 } })

    swipe(harness, harness.element, [400, 300], [-40, 0])
    swipe(harness, harness.element, [400, 300], [-100, 120])
    expect(harness.wm.workspace()).toBe(0)
  })

  it('ignores mouse pointers and a third finger', () => {
    const harness = makeHarness({ swipe: { threshold: 60 } })
    const el = harness.element

    el.dispatchEvent(touchEvent('pointerdown', 3, 400, 300, 'mouse'))
    el.dispatchEvent(touchEvent('pointerdown', 4, 460, 300, 'mouse'))
    el.dispatchEvent(touchEvent('pointermove', 3, 260, 300, 'mouse'))
    harness.flushFrames()
    expect(harness.wm.workspace()).toBe(0)

    el.dispatchEvent(touchEvent('pointerdown', 5, 400, 300))
    el.dispatchEvent(touchEvent('pointerdown', 6, 460, 300))
    el.dispatchEvent(touchEvent('pointerdown', 7, 500, 300))
    el.dispatchEvent(touchEvent('pointermove', 5, 260, 300))
    harness.flushFrames()
    expect(harness.wm.workspace()).toBe(0)
  })

  it('never hijacks a drag that is already in flight', () => {
    const harness = makeHarness({ swipe: { threshold: 60 }, magnetism: false, snap: false })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })

    handle.dispatchEvent(touchEvent('pointerdown', 8, 150, 110))
    handle.dispatchEvent(touchEvent('pointermove', 8, 170, 130))
    harness.flushFrames()

    harness.element.dispatchEvent(touchEvent('pointerdown', 9, 400, 300))
    harness.element.dispatchEvent(touchEvent('pointermove', 9, 260, 300))
    harness.element.dispatchEvent(touchEvent('pointermove', 8, 130, 130))
    harness.flushFrames()

    expect(harness.wm.workspace()).toBe(0)
  })

  it('lets the pinch win when the fingers spread instead of travelling', () => {
    const harness = makeHarness({ swipe: { threshold: 60 } })
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    pinch(harness, root, [100, 100, 300, 300], [50, 50, 350, 350])

    expect(harness.wm.workspace()).toBe(0)
    expect(harness.wm.get('a')?.bounds.width).toBe(300)
  })

  it('stays out of the way when the gesture is switched off or the desktop is gone', () => {
    const off = makeHarness({ swipe: false })
    swipe(off, off.element, [400, 300], [-140, 0])
    expect(off.wm.workspace()).toBe(0)

    const live = makeHarness({ swipe: { threshold: 60 } })
    live.desktop.destroy()
    swipe(live, live.element, [400, 300], [-140, 0])
    expect(live.wm.workspace()).toBe(0)
  })
})

describe('two finger gestures give up cleanly', () => {
  it('drops a frame that was already queued when a third finger lands', () => {
    const harness = makeHarness({ swipe: { threshold: 60 } })
    const el = harness.element

    el.dispatchEvent(touchEvent('pointerdown', 3, 400, 300))
    el.dispatchEvent(touchEvent('pointerdown', 4, 460, 300))
    el.dispatchEvent(touchEvent('pointermove', 3, 260, 300))
    el.dispatchEvent(touchEvent('pointerdown', 5, 500, 300))
    harness.flushFrames()

    expect(harness.wm.workspace()).toBe(0)
  })

  it('drops a queued frame when the pointer is cancelled', () => {
    const harness = makeHarness({ swipe: { threshold: 60 } })
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    root.dispatchEvent(touchEvent('pointerdown', 1, 100, 100))
    root.dispatchEvent(touchEvent('pointerdown', 2, 300, 300))
    root.dispatchEvent(touchEvent('pointermove', 1, 50, 50))
    root.dispatchEvent(touchEvent('pointercancel', 1, 50, 50))
    harness.flushFrames()

    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100, width: 200, height: 200 })
    expect(root.dataset.wmPinching).toBeUndefined()
  })

  it('ignores a move from a finger it never saw go down', () => {
    const harness = makeHarness({ swipe: { threshold: 60 } })

    harness.element.dispatchEvent(touchEvent('pointermove', 42, 100, 100))
    harness.element.dispatchEvent(touchEvent('pointerup', 42, 100, 100))
    harness.flushFrames()

    expect(harness.wm.workspace()).toBe(0)
  })

  it('needs a real spread between the two fingers', () => {
    const harness = makeHarness({ swipe: { threshold: 60 } })
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

    root.dispatchEvent(touchEvent('pointerdown', 1, 200, 200))
    root.dispatchEvent(touchEvent('pointerdown', 2, 200, 200))
    root.dispatchEvent(touchEvent('pointermove', 1, 100, 100))
    root.dispatchEvent(touchEvent('pointermove', 2, 300, 300))
    harness.flushFrames()

    expect(harness.wm.get('a')?.bounds).toMatchObject({ width: 200, height: 200 })
  })
})

describe('two fingers on two windows', () => {
  it('never resizes either of them', () => {
    const harness = makeHarness({ swipe: { threshold: 600 } })
    const left = harness.add({ id: 'a', x: 0, y: 0, width: 200, height: 200 })
    const right = harness.add({ id: 'b', x: 400, y: 0, width: 200, height: 200 })

    left.root.dispatchEvent(touchEvent('pointerdown', 1, 100, 100))
    right.root.dispatchEvent(touchEvent('pointerdown', 2, 500, 100))
    left.root.dispatchEvent(touchEvent('pointermove', 1, 20, 20))
    right.root.dispatchEvent(touchEvent('pointermove', 2, 580, 180))
    harness.flushFrames()

    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 0, y: 0, width: 200, height: 200 })
    expect(harness.wm.get('b')?.bounds).toMatchObject({ x: 400, y: 0, width: 200, height: 200 })
    expect(left.root.dataset.wmPinching).toBeUndefined()
    expect(right.root.dataset.wmPinching).toBeUndefined()
  })
})
