// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowInit, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController, DesktopOptions, WindowSkin } from '../../src/dom/shared'
import { windowOf } from '../../src/dom/shared'

const VIEWPORT = { width: 800, height: 600 }

function pointerEvent(type: string, x: number, y: number, pointerId = 1): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  return event as PointerEvent
}

function stubPointerCapture(): void {
  const captured = new Set<number>()
  Element.prototype.setPointerCapture = function setPointerCapture(id: number) {
    captured.add(id)
  }
  Element.prototype.releasePointerCapture = function releasePointerCapture(id: number) {
    captured.delete(id)
  }
  Element.prototype.hasPointerCapture = function hasPointerCapture(id: number) {
    return captured.has(id)
  }
}

interface Harness {
  wm: WindowManager
  desktop: DesktopController
  element: HTMLElement
  add(init: WindowInit & { id: string }): {
    root: HTMLElement
    handle: HTMLElement
    detach: () => void
  }
  handleOf(id: string): HTMLElement
  resizeHandle(id: string, direction: string): HTMLElement
  flushFrames(): void
}

const frames: Array<() => void> = []

function makeHarness(options: DesktopOptions = {}): Harness {
  stubPointerCapture()
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
      const detach = desktop.attachWindow(init.id, root)
      const handle = root.querySelector<HTMLElement>('[data-wm-drag]') as HTMLElement
      return { root, handle, detach }
    },
    handleOf(id) {
      return element.querySelector<HTMLElement>(
        `[data-wm-window="${id}"] [data-wm-drag]`,
      ) as HTMLElement
    },
    resizeHandle(id, direction) {
      return element.querySelector<HTMLElement>(
        `[data-wm-window="${id}"] [data-wm-resize="${direction}"]`,
      ) as HTMLElement
    },
    flushFrames() {
      for (const frame of frames.splice(0)) frame()
    },
  }
}

function drag(harness: Harness, handle: HTMLElement, from: [number, number], to: [number, number]) {
  handle.dispatchEvent(pointerEvent('pointerdown', from[0], from[1]))
  handle.dispatchEvent(pointerEvent('pointermove', to[0], to[1]))
  harness.flushFrames()
}

const realElementsFromPoint = document.elementsFromPoint

afterEach(() => {
  frames.length = 0
  vi.unstubAllGlobals()
  document.elementsFromPoint = realElementsFromPoint
  document.body.replaceChildren()
})

describe('drag session', () => {
  it('moves the window and clears the dragging flag on release', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { root, handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })

    drag(harness, handle, [150, 110], [230, 190])
    expect(root.dataset.wmDragging).toBe('')
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 180, y: 180 })

    handle.dispatchEvent(pointerEvent('pointerup', 230, 190))
    expect(root.dataset.wmDragging).toBeUndefined()
  })

  it('ignores a pointer that never travels', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })

    drag(harness, handle, [150, 110], [151, 111])
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
  })

  it('refuses to start on an interactive target or a secondary button', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { root, handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const button = document.createElement('button')
    handle.append(button)

    button.dispatchEvent(pointerEvent('pointerdown', 150, 110))
    handle.dispatchEvent(pointerEvent('pointermove', 250, 210))
    harness.flushFrames()
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
    expect(root.dataset.wmDragging).toBeUndefined()

    const secondary = new MouseEvent('pointerdown', { bubbles: true, button: 2, clientX: 150 })
    Object.defineProperty(secondary, 'pointerId', { value: 2 })
    handle.dispatchEvent(secondary)
    handle.dispatchEvent(pointerEvent('pointermove', 250, 210, 2))
    harness.flushFrames()
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
  })

  it('escape cancels the drag, restores the origin and leaves no history entry', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    harness.wm.clearHistory()

    drag(harness, handle, [150, 110], [260, 220])
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 210, y: 210 })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
    expect(harness.wm.canUndo()).toBe(false)
  })

  it('collapses a whole drag into a single undo step', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    harness.wm.clearHistory()

    handle.dispatchEvent(pointerEvent('pointerdown', 150, 110))
    for (const step of [40, 80, 120]) {
      handle.dispatchEvent(pointerEvent('pointermove', 150 + step, 110 + step))
      harness.flushFrames()
    }
    handle.dispatchEvent(pointerEvent('pointerup', 270, 230))

    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 220, y: 220 })
    expect(harness.wm.undo()).toBe(true)
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
    expect(harness.wm.canUndo()).toBe(false)
  })

  it('magnetises to a neighbour edge and ignores windows on other workspaces', () => {
    const harness = makeHarness({ magnetism: { threshold: 10 }, snap: false })
    harness.add({ id: 'anchor', x: 400, y: 100, width: 200, height: 150 })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })

    drag(harness, handle, [150, 110], [245, 110])
    expect(harness.wm.get('a')?.bounds.x).toBe(200)

    harness.wm.moveToWorkspace('anchor', 1)
    harness.wm.move('a', 100, 100)
    drag(harness, harness.handleOf('a'), [150, 110], [245, 110])
    expect(harness.wm.get('a')?.bounds.x).toBe(195)
  })

  it('does not magnetise a grouped window to its own hidden siblings', () => {
    const harness = makeHarness({ magnetism: { threshold: 10 }, snap: false })
    harness.add({ id: 'hidden', x: 100, y: 100, width: 200, height: 150 })
    harness.add({ id: 'moving', x: 100, y: 100, width: 200, height: 150 })
    harness.wm.group(['moving', 'hidden'])

    drag(harness, harness.handleOf('moving'), [150, 110], [156, 110])
    expect(harness.wm.get('moving')?.bounds.x).toBe(106)
  })

  it('previews a snap zone and applies it on release', () => {
    const harness = makeHarness({ magnetism: false })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })

    drag(harness, handle, [150, 110], [4, 300])
    const preview = harness.element.querySelector<HTMLElement>('[data-wm-snap-preview]')
    expect(preview?.style.display).toBe('block')

    handle.dispatchEvent(pointerEvent('pointermove', 400, 300))
    harness.flushFrames()
    expect(preview?.style.display).toBe('none')

    handle.dispatchEvent(pointerEvent('pointermove', 4, 300))
    harness.flushFrames()
    handle.dispatchEvent(pointerEvent('pointerup', 4, 300))
    expect(harness.wm.get('a')).toMatchObject({ stage: 'snapped', snapZone: 'left' })
    expect(preview?.style.display).toBe('none')
  })

  it('restores a maximized window under the cursor when dragged off', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    harness.wm.maximize('a')

    drag(harness, handle, [400, 10], [420, 120])
    expect(harness.wm.get('a')).toMatchObject({
      stage: 'normal',
      bounds: { x: 320, y: 110, width: 200, height: 150 },
    })

    handle.dispatchEvent(pointerEvent('pointermove', 470, 160))
    harness.flushFrames()
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 370, y: 150 })
  })

  it('ignores a second pointer on another window instead of focusing and raising it', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const other = harness.add({ id: 'b', x: 400, y: 300, width: 200, height: 150 })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })

    drag(harness, handle, [150, 110], [250, 210])
    other.handle.dispatchEvent(pointerEvent('pointerdown', 450, 310, 2))
    other.handle.dispatchEvent(pointerEvent('pointermove', 550, 410, 2))
    harness.flushFrames()

    expect(harness.wm.getState().focusedId).toBe('a')
    expect(harness.wm.getState().order.at(-1)).toBe('a')
    expect(harness.wm.get('b')?.bounds).toMatchObject({ x: 400, y: 300 })
  })
})

describe('resize session', () => {
  it('drags the east edge and keeps the origin fixed', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const handle = harness.resizeHandle('a', 'e')

    handle.dispatchEvent(pointerEvent('pointerdown', 300, 175))
    handle.dispatchEvent(pointerEvent('pointermove', 360, 175))
    harness.flushFrames()

    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100, width: 260 })
  })

  it('keeps the bottom edge still when the north edge is dragged past the viewport top', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const handle = harness.resizeHandle('a', 'n')

    handle.dispatchEvent(pointerEvent('pointerdown', 200, 100))
    handle.dispatchEvent(pointerEvent('pointermove', 200, -80))
    harness.flushFrames()

    const bounds = harness.wm.get('a')?.bounds
    expect(bounds?.y).toBe(0)
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBe(250)
  })

  it('honours an aspect ratio while resizing', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 0, y: 0, width: 200, height: 100, aspectRatio: 2 })
    const handle = harness.resizeHandle('a', 'e')

    handle.dispatchEvent(pointerEvent('pointerdown', 200, 50))
    handle.dispatchEvent(pointerEvent('pointermove', 300, 50))
    harness.flushFrames()

    expect(harness.wm.get('a')?.bounds).toMatchObject({ width: 300, height: 150 })
  })

  it('drives the ratio from the dragged north edge and keeps the bottom anchored', () => {
    const harness = makeHarness()
    harness.add({ id: 'b', x: 100, y: 200, width: 200, height: 100, aspectRatio: 2 })
    const handle = harness.resizeHandle('b', 'n')

    handle.dispatchEvent(pointerEvent('pointerdown', 200, 200))
    handle.dispatchEvent(pointerEvent('pointermove', 200, 150))
    harness.flushFrames()

    const bounds = harness.wm.get('b')?.bounds
    expect(bounds).toMatchObject({ width: 300, height: 150 })
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBe(300)
  })

  it('keeps the opposite corner pinned when an aspect-locked window is resized by nw', () => {
    const harness = makeHarness()
    harness.add({ id: 'd', x: 100, y: 200, width: 200, height: 100, aspectRatio: 2 })
    const handle = harness.resizeHandle('d', 'nw')

    handle.dispatchEvent(pointerEvent('pointerdown', 100, 200))
    handle.dispatchEvent(pointerEvent('pointermove', 90, 120))
    harness.flushFrames()

    const bounds = harness.wm.get('d')?.bounds
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBe(300)
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBe(300)
    expect((bounds?.width ?? 0) / (bounds?.height ?? 1)).toBe(2)
  })

  it('never lets an aspect-locked north drag push the window above the desktop', () => {
    const harness = makeHarness()
    harness.add({ id: 'c', x: 0, y: 40, width: 200, height: 100, aspectRatio: 2 })
    const handle = harness.resizeHandle('c', 'n')

    handle.dispatchEvent(pointerEvent('pointerdown', 100, 40))
    handle.dispatchEvent(pointerEvent('pointermove', 100, -400))
    harness.flushFrames()

    const bounds = harness.wm.get('c')?.bounds
    expect(bounds?.y).toBeGreaterThanOrEqual(0)
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBe(140)
  })

  it('escape during a resize puts a snapped window back where it was', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    harness.wm.snap('a', 'left')
    const snapped = harness.wm.get('a')?.bounds
    const handle = harness.resizeHandle('a', 'e')

    handle.dispatchEvent(pointerEvent('pointerdown', 400, 300))
    handle.dispatchEvent(pointerEvent('pointermove', 500, 300))
    harness.flushFrames()
    expect(harness.wm.get('a')?.stage).toBe('normal')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(harness.wm.get('a')).toMatchObject({ stage: 'snapped', snapZone: 'left' })
    expect(harness.wm.get('a')?.bounds).toEqual(snapped)
  })

  it('blocks a drag while a resize owns the pointer session', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const resize = harness.resizeHandle('a', 'e')
    const handle = harness.handleOf('a')

    resize.dispatchEvent(pointerEvent('pointerdown', 300, 175))
    handle.dispatchEvent(pointerEvent('pointerdown', 150, 110, 2))
    handle.dispatchEvent(pointerEvent('pointermove', 400, 400, 2))
    harness.flushFrames()

    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
  })

  it('hides its handles when the window cannot be resized', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    expect(harness.resizeHandle('a', 'e').style.display).toBe('')

    harness.wm.update('a', { resizable: false })
    expect(harness.resizeHandle('a', 'e').style.display).toBe('none')
  })
})

describe('tab groups in the dom', () => {
  it('hides inactive tabs and marks the active one', () => {
    const harness = makeHarness()
    const a = harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    const b = harness.add({ id: 'b', x: 300, y: 300, width: 200, height: 150 })
    const groupId = harness.wm.group(['a', 'b']) as string

    expect(a.root.dataset.wmGroup).toBe(groupId)
    expect(a.root.dataset.wmTab).toBe('active')
    expect(a.root.hidden).toBe(false)
    expect(b.root.dataset.wmTab).toBe('inactive')
    expect(b.root.hidden).toBe(true)

    harness.wm.activateTab('b')
    expect(a.root.hidden).toBe(true)
    expect(b.root.hidden).toBe(false)
    expect(b.root.dataset.wmTab).toBe('active')
  })

  it('clears the group attributes when the group dissolves', () => {
    const harness = makeHarness()
    const a = harness.add({ id: 'a' })
    harness.add({ id: 'b' })
    harness.wm.group(['a', 'b'])
    expect(a.root.dataset.wmGroup).toBeDefined()

    harness.wm.ungroup('a')
    expect(a.root.dataset.wmGroup).toBeUndefined()
    expect(a.root.dataset.wmTab).toBeUndefined()
    expect(a.root.hidden).toBe(false)
  })

  it('groups a window when its titlebar is dropped on another one', () => {
    const harness = makeHarness({ magnetism: false, snap: false, grouping: { dwell: 0 } })
    harness.add({ id: 'target', x: 400, y: 400, width: 200, height: 150 })
    const { handle } = harness.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
    const targetHandle = harness.handleOf('target')
    document.elementsFromPoint = () => [targetHandle]

    handle.dispatchEvent(pointerEvent('pointerdown', 60, 20))
    handle.dispatchEvent(pointerEvent('pointermove', 450, 410))
    harness.flushFrames()
    expect(
      harness.element.querySelector('[data-wm-tab-target]')?.getAttribute('data-wm-window'),
    ).toBe('target')

    handle.dispatchEvent(pointerEvent('pointerup', 450, 410))
    const state = harness.wm.getState()
    const groupId = harness.wm.get('moving')?.groupId as string
    expect(groupId).toBeTruthy()
    expect(state.groups[groupId]?.activeId).toBe('moving')
    expect(harness.element.querySelector('[data-wm-tab-target]')).toBeNull()
  })

  it('does not group on a quick pass over another titlebar', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    harness.add({ id: 'target', x: 400, y: 400, width: 200, height: 150 })
    const { handle } = harness.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
    document.elementsFromPoint = () => [harness.handleOf('target')]

    drag(harness, handle, [60, 20], [450, 410])
    handle.dispatchEvent(pointerEvent('pointerup', 450, 410))
    expect(harness.wm.get('moving')?.groupId).toBeNull()
  })

  it('disarms the pending group when the pointer moves off the titlebar again', () => {
    vi.useFakeTimers()
    try {
      const harness = makeHarness({ magnetism: false, snap: false, grouping: { dwell: 200 } })
      harness.add({ id: 'target', x: 400, y: 400, width: 200, height: 150 })
      const { handle } = harness.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
      document.elementsFromPoint = () => [harness.handleOf('target')]

      handle.dispatchEvent(pointerEvent('pointerdown', 60, 20))
      handle.dispatchEvent(pointerEvent('pointermove', 450, 410))
      harness.flushFrames()

      document.elementsFromPoint = () => []
      handle.dispatchEvent(pointerEvent('pointermove', 200, 300))
      harness.flushFrames()
      vi.advanceTimersByTime(1000)

      expect(harness.element.querySelector('[data-wm-tab-target]')).toBeNull()
      handle.dispatchEvent(pointerEvent('pointerup', 200, 300))
      expect(harness.wm.get('moving')?.groupId).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('rolls a cancelled pointer back to where the window started', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { root, handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })

    drag(harness, handle, [150, 110], [250, 210])
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 200, y: 200 })

    handle.dispatchEvent(pointerEvent('pointercancel', 250, 210))
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
    expect(root.dataset.wmDragging).toBeUndefined()
  })

  it('puts a cancelled drag back into the snap zone it was torn from', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    harness.wm.snap('a', 'left')
    const snapped = harness.wm.get('a')?.bounds

    drag(harness, handle, [150, 110], [420, 260])
    expect(harness.wm.get('a')?.stage).toBe('normal')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(harness.wm.get('a')).toMatchObject({ stage: 'snapped', snapZone: 'left' })
    expect(harness.wm.get('a')?.bounds).toEqual(snapped)
  })

  it('leaves the top edge inert when it is configured to do nothing', () => {
    const harness = makeHarness({ magnetism: false, snap: { topEdge: 'none' } })
    const { handle } = harness.add({ id: 'a', x: 100, y: 300, width: 200, height: 150 })

    drag(harness, handle, [150, 310], [400, 2])
    expect(harness.element.querySelector('[data-wm-preview]')).toBeNull()

    handle.dispatchEvent(pointerEvent('pointerup', 400, 2))
    expect(harness.wm.get('a')?.stage).toBe('normal')
  })

  it('does not group when the gesture is disabled', () => {
    vi.useFakeTimers()
    try {
      const harness = makeHarness({ magnetism: false, snap: false, grouping: false })
      harness.add({ id: 'target', x: 400, y: 400, width: 200, height: 150 })
      const { handle } = harness.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
      document.elementsFromPoint = () => [harness.handleOf('target')]

      drag(harness, handle, [60, 20], [450, 410])
      vi.advanceTimersByTime(1000)
      expect(harness.element.querySelector('[data-wm-tab-target]')).toBeNull()

      handle.dispatchEvent(pointerEvent('pointerup', 450, 410))
      expect(harness.wm.get('moving')?.groupId).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('arms the group target once the dwell elapses', () => {
    vi.useFakeTimers()
    try {
      const harness = makeHarness({ magnetism: false, snap: false })
      harness.add({ id: 'target', x: 400, y: 400, width: 200, height: 150 })
      const { handle } = harness.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
      document.elementsFromPoint = () => [harness.handleOf('target')]

      drag(harness, handle, [60, 20], [450, 410])
      expect(harness.element.querySelector('[data-wm-tab-target]')).toBeNull()

      vi.advanceTimersByTime(500)
      expect(
        harness.element.querySelector('[data-wm-tab-target]')?.getAttribute('data-wm-window'),
      ).toBe('target')

      handle.dispatchEvent(pointerEvent('pointerup', 450, 410))
      expect(harness.wm.get('moving')?.groupId).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('drops the snap preview once the group target arms', () => {
    vi.useFakeTimers()
    try {
      const harness = makeHarness({ magnetism: false })
      harness.add({ id: 'target', x: 0, y: 0, width: 200, height: 150 })
      const { handle } = harness.add({ id: 'moving', x: 300, y: 300, width: 200, height: 150 })
      document.elementsFromPoint = () => [harness.handleOf('target')]

      drag(harness, handle, [350, 310], [4, 200])
      const preview = harness.element.querySelector<HTMLElement>('[data-wm-snap-preview]')
      expect(preview?.style.display).toBe('block')

      vi.advanceTimersByTime(500)
      expect(preview?.style.display).toBe('none')
      expect(harness.element.querySelector('[data-wm-tab-target]')).not.toBeNull()

      handle.dispatchEvent(pointerEvent('pointerup', 4, 200))
      expect(harness.wm.get('moving')?.stage).toBe('normal')
      expect(harness.wm.get('moving')?.groupId).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores a hit test result that is not this desktop window element', () => {
    const harness = makeHarness({ magnetism: false, snap: false, grouping: { dwell: 0 } })
    harness.add({ id: 'target', x: 400, y: 400, width: 200, height: 150 })
    const { handle } = harness.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
    const stale = harness.handleOf('target').closest('[data-wm-window]') as HTMLElement
    const clone = stale.cloneNode(true) as HTMLElement
    document.elementsFromPoint = () => [clone.querySelector('[data-wm-drag]') as HTMLElement]

    drag(harness, handle, [60, 20], [450, 410])
    handle.dispatchEvent(pointerEvent('pointerup', 450, 410))
    expect(harness.wm.get('moving')?.groupId).toBeNull()
  })

  it('clears the target flag when the marked window detaches mid drag', () => {
    const harness = makeHarness({ magnetism: false, snap: false, grouping: { dwell: 0 } })
    const target = harness.add({ id: 'target', x: 400, y: 400, width: 200, height: 150 })
    const { handle } = harness.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
    document.elementsFromPoint = () => [harness.handleOf('target')]

    drag(harness, handle, [60, 20], [450, 410])
    expect(target.root.dataset.wmTabTarget).toBe('')

    target.detach()
    handle.dispatchEvent(pointerEvent('pointerup', 450, 410))
    expect(target.root.dataset.wmTabTarget).toBeUndefined()
  })
})

describe('configuration surface', () => {
  it('lets a veto keep the close button from closing a window', () => {
    const blocked: string[] = []
    const harness = makeHarness({
      beforeClose: (win) => {
        blocked.push(win.id)
        return win.id === 'guarded' ? false : undefined
      },
    })
    const closeOf = (root: HTMLElement) => {
      const button = document.createElement('button')
      button.dataset.wmClose = ''
      root.querySelector('[data-wm-drag]')?.append(button)
      return button
    }
    const guarded = harness.add({ id: 'guarded' })
    const plain = harness.add({ id: 'plain' })

    closeOf(guarded.root).click()
    expect(harness.wm.get('guarded')).toBeDefined()

    closeOf(plain.root).click()
    expect(harness.wm.get('plain')).toBeUndefined()
    expect(blocked).toEqual(['guarded', 'plain'])
  })

  it('treats a custom interactive selector as undraggable', () => {
    const harness = makeHarness({
      magnetism: false,
      snap: false,
      interactiveSelector: '.no-drag',
    })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const guard = document.createElement('span')
    guard.className = 'no-drag'
    handle.append(guard)

    guard.dispatchEvent(pointerEvent('pointerdown', 150, 110))
    handle.dispatchEvent(pointerEvent('pointermove', 250, 210))
    harness.flushFrames()
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })

    drag(harness, handle, [150, 110], [250, 210])
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 200, y: 200 })
  })

  it('passes the configured duration to the minimize animation', () => {
    const calls: Array<{ duration?: unknown; easing?: unknown }> = []
    const original = Element.prototype.animate
    Element.prototype.animate = function animate(
      _keyframes: unknown,
      options?: number | KeyframeAnimationOptions,
    ) {
      calls.push(typeof options === 'object' && options !== null ? options : { duration: options })
      return { onfinish: null, oncancel: null } as unknown as Animation
    } as typeof Element.prototype.animate

    try {
      const dock = document.createElement('div')
      dock.getBoundingClientRect = () => new DOMRect(0, 500, 40, 20)
      document.body.append(dock)
      const harness = makeHarness({
        animation: { duration: 90, easing: 'linear' },
        minimizeTarget: () => dock,
      })
      const { root } = harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
      root.getBoundingClientRect = () => new DOMRect(10, 10, 200, 150)

      harness.wm.minimize('a')
      expect(calls).toHaveLength(1)
      expect(calls[0]).toMatchObject({ duration: 90, easing: 'linear' })
    } finally {
      Element.prototype.animate = original
    }
  })

  it('skips the minimize animation when animation is turned off', () => {
    const original = Element.prototype.animate
    let called = 0
    Element.prototype.animate = function animate() {
      called += 1
      return { onfinish: null, oncancel: null } as unknown as Animation
    } as typeof Element.prototype.animate

    try {
      const dock = document.createElement('div')
      dock.getBoundingClientRect = () => new DOMRect(0, 500, 40, 20)
      document.body.append(dock)
      const harness = makeHarness({ animation: false, minimizeTarget: () => dock })
      const { root } = harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
      root.getBoundingClientRect = () => new DOMRect(10, 10, 200, 150)

      harness.wm.minimize('a')
      expect(called).toBe(0)
    } finally {
      Element.prototype.animate = original
    }
  })

  it('leaves the native context menu to fields and controls inside the titlebar', () => {
    const calls: string[] = []
    const harness = makeHarness({ onTitlebarContextMenu: (win) => calls.push(win.id) })
    const { handle } = harness.add({ id: 'a' })
    const search = document.createElement('input')
    handle.append(search)

    const onField = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    search.dispatchEvent(onField)
    expect(onField.defaultPrevented).toBe(false)
    expect(calls).toEqual([])

    const onBar = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    handle.dispatchEvent(onBar)
    expect(onBar.defaultPrevented).toBe(true)
    expect(calls).toEqual(['a'])
  })
})

describe('focus marker', () => {
  const marked = (harness: Harness) =>
    [...harness.element.querySelectorAll<HTMLElement>('[data-wm-focused]')].map(
      (node) => node.dataset.wmWindow,
    )

  it('marks exactly one window when another is attached', () => {
    const harness = makeHarness()
    harness.add({ id: 'a' })
    expect(marked(harness)).toEqual(['a'])

    harness.add({ id: 'b' })
    expect(marked(harness)).toEqual(['b'])

    harness.wm.focus('a')
    expect(marked(harness)).toEqual(['a'])
  })

  it('marks one window when the app attaches from the open event', () => {
    const harness = makeHarness()
    harness.wm.on('open', ({ window: win }) => {
      if (harness.element.querySelector(`[data-wm-window="${win.id}"]`)) return
      const root = document.createElement('section')
      root.innerHTML = '<header data-wm-drag><span data-wm-title>t</span></header>'
      harness.element.append(root)
      harness.desktop.attachWindow(win.id, root)
    })

    harness.wm.open({ id: 'a' })
    harness.wm.open({ id: 'b' })
    expect(marked(harness)).toEqual(['b'])
  })

  it('moves the mark when the same window is re-attached to a new element', () => {
    const harness = makeHarness()
    const first = harness.add({ id: 'a' })
    first.detach()

    const replacement = document.createElement('section')
    replacement.innerHTML = '<header data-wm-drag><span data-wm-title>t</span></header>'
    harness.element.append(replacement)
    harness.desktop.attachWindow('a', replacement)

    expect(first.root.dataset.wmFocused).toBeUndefined()
    expect(replacement.dataset.wmFocused).toBe('')
  })

  it('drops the mark when the focused window is closed', () => {
    const harness = makeHarness()
    harness.add({ id: 'a' })
    harness.add({ id: 'b' })

    harness.wm.close('b')
    expect(marked(harness)).toEqual(['a'])
  })
})

describe('keyboard focus', () => {
  function closable(harness: Harness, id: string): HTMLButtonElement {
    harness.wm.open({ id, width: 200, height: 150 })
    const root = document.createElement('section')
    const close = document.createElement('button')
    close.dataset.wmClose = ''
    root.append(close)
    harness.element.append(root)
    harness.desktop.attachWindow(id, root, { removeOnClose: true })
    return close
  }

  it('parks focus on the desktop when the window holding it closes and nothing takes over', () => {
    const harness = makeHarness()
    const close = closable(harness, 'a')
    close.focus()

    close.click()

    expect(close.isConnected).toBe(false)
    expect(document.activeElement).toBe(harness.element)
  })

  it('still hands focus on to the next window when the one holding it closes', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'b' })
    const close = closable(harness, 'a')
    close.focus()

    close.click()

    expect(document.activeElement).toBe(root)
  })

  it('returns focus to the control that had it when a modal closes', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const field = document.createElement('textarea')
    root.append(field)
    field.focus()

    const modal = harness.add({ id: 'm', layer: 'modal' })
    expect(document.activeElement).toBe(modal.root)

    harness.wm.close('m')
    expect(document.activeElement).toBe(field)
  })

  it('returns focus to the control that had it when the window comes back from minimize', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const field = document.createElement('input')
    root.append(field)
    field.focus()

    harness.wm.minimize('a')
    expect(document.activeElement).toBe(harness.element)

    harness.wm.restore('a')
    expect(document.activeElement).toBe(field)
  })

  it('falls back to the window when the control that had focus is gone', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const field = document.createElement('textarea')
    root.append(field)
    field.focus()

    harness.add({ id: 'm', layer: 'modal' })
    field.remove()
    harness.wm.close('m')

    expect(document.activeElement).toBe(root)
  })

  it('pulls keyboard focus back into the focused window when its titlebar or a grip is pressed', () => {
    const harness = makeHarness()
    const { root, handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const field = document.createElement('input')
    root.append(field)
    const outside = document.createElement('button')
    document.body.append(outside)

    field.focus()
    outside.focus()
    handle.dispatchEvent(pointerEvent('pointerdown', 150, 110))
    handle.dispatchEvent(pointerEvent('pointerup', 150, 110))
    expect(document.activeElement).toBe(field)

    outside.focus()
    const grip = harness.resizeHandle('a', 'e')
    grip.dispatchEvent(pointerEvent('pointerdown', 300, 175))
    grip.dispatchEvent(pointerEvent('pointerup', 300, 175))
    expect(document.activeElement).toBe(field)
  })

  it('leaves a press into window content to the browser, never touching the remembered control', () => {
    const harness = makeHarness()
    const a = harness.add({ id: 'a', x: 0, y: 0, width: 200, height: 150 })
    const field = document.createElement('input')
    const content = document.createElement('p')
    a.root.append(field, content)
    const seen: string[] = []
    field.addEventListener('focus', () => seen.push('focus'))
    field.addEventListener('blur', () => seen.push('blur'))
    const outside = document.createElement('button')
    document.body.append(outside)

    field.focus()
    outside.focus()
    seen.length = 0
    content.dispatchEvent(pointerEvent('pointerdown', 50, 50))
    expect(document.activeElement).toBe(outside)
    expect(seen).toEqual([])

    field.focus()
    harness.add({ id: 'b', x: 300, y: 300, width: 200, height: 150 })
    seen.length = 0
    content.dispatchEvent(pointerEvent('pointerdown', 50, 50))
    expect(harness.wm.getState().focusedId).toBe('a')
    expect(document.activeElement).toBe(a.root)
    expect(seen).toEqual([])
  })

  it('never hands focus to a remembered control that now lives in another window', () => {
    const harness = makeHarness()
    const a = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const b = harness.add({ id: 'b', x: 300, y: 300, width: 200, height: 150 })
    const field = document.createElement('input')
    a.root.append(field)
    harness.wm.focus('a')
    field.focus()
    const seen: string[] = []
    field.addEventListener('focus', () => seen.push('focus'))

    harness.wm.focus('b')
    b.root.append(field)
    harness.wm.focus('a')

    expect(seen).toEqual([])
    expect(document.activeElement).toBe(a.root)
  })

  it('returns focus to a remembered control inside a shadow skin', () => {
    const harness = makeHarness()
    const host = shadowWindow(
      harness,
      { id: 'a', x: 100, y: 100, width: 200, height: 150 },
      '<header data-wm-drag></header><button>one</button><button>two</button>',
    )
    const shadow = host.shadowRoot as ShadowRoot
    const [one, button] = [...shadow.querySelectorAll('button')] as HTMLButtonElement[]
    expect(document.activeElement).toBe(host)
    one?.focus()
    button?.focus()
    expect(shadow.activeElement).toBe(button)

    harness.add({ id: 'm', layer: 'modal' })
    harness.wm.close('m')

    expect(document.activeElement).toBe(host)
    expect(shadow.activeElement).toBe(button)
  })

  it('leaves keyboard focus alone when the focused window is only raised', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    harness.add({ id: 'b', x: 300, y: 300, width: 200, height: 150 })
    harness.wm.minimize('b')
    harness.wm.sendToBack('a')
    expect(harness.wm.getState()).toMatchObject({ focusedId: 'a', order: ['a', 'b'] })
    const taskbar = document.createElement('button')
    document.body.append(taskbar)
    taskbar.focus()

    harness.wm.focus('a')

    expect(harness.wm.getState().order).toEqual(['b', 'a'])
    expect(document.activeElement).toBe(taskbar)
  })
})

describe('attachment lifecycle', () => {
  it('lets go of a window that the manager closed', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a' })
    harness.add({ id: 'b' })
    expect(root.dataset.wmWindow).toBe('a')

    harness.wm.close('a')
    expect(root.dataset.wmWindow).toBeUndefined()
    expect(root.dataset.wmFocused).toBeUndefined()
    expect(root.querySelector('[data-wm-resize]')).toBeNull()
    expect(harness.element.querySelectorAll('[data-wm-window]')).toHaveLength(1)
  })

  it('leaves the element in the page unless it was asked to remove it', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a' })

    harness.wm.close('a')
    expect(root.isConnected).toBe(true)
  })

  it('survives a detach after the window is already gone', () => {
    const harness = makeHarness()
    const { detach } = harness.add({ id: 'a' })

    harness.wm.close('a')
    expect(() => detach()).not.toThrow()
  })

  it('does not let a stale detach unhook the element it was handed on to', () => {
    const harness = makeHarness()
    const { root, detach } = harness.add({ id: 'a' })

    harness.wm.close('a')
    harness.wm.open({ id: 'b' })
    harness.desktop.attachWindow('b', root)
    expect(root.dataset.wmWindow).toBe('b')

    detach()
    expect(root.dataset.wmWindow).toBe('b')
    expect(harness.wm.get('b')).toBeDefined()
  })

  it('lets go of a window that history removed', () => {
    const harness = makeHarness()
    harness.add({ id: 'a' })
    const { root } = harness.add({ id: 'b' })

    expect(harness.wm.undo()).toBe(true)
    expect(harness.wm.get('b')).toBeUndefined()
    expect(root.dataset.wmWindow).toBeUndefined()
  })

  it('strips the window markers from every element when the desktop is destroyed', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', title: 'A' })
    expect(root.dataset.wmFocused).toBe('')

    harness.desktop.destroy()

    expect(root.dataset.wmWindow).toBeUndefined()
    expect(root.dataset.wmFocused).toBeUndefined()
    expect(root.querySelector('[data-wm-resize]')).toBeNull()
  })

  it('does not let a detach from a destroyed desktop strip the element attached elsewhere', () => {
    const harness = makeHarness()
    const { root, detach } = harness.add({ id: 'a', title: 'A' })
    harness.desktop.destroy()

    const next = attachDesktop(harness.wm, harness.element, {
      autoViewport: false,
      announce: false,
    })
    next.attachWindow('a', root)
    detach()

    expect(root.dataset.wmWindow).toBe('a')
    expect(root.dataset.wmFocused).toBe('')
  })

  it('keeps the inline transition the app put on the window, muted only for the first write', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', x: 30, y: 40 })
    const root = document.createElement('section')
    root.style.transition = 'opacity 200ms ease'
    harness.element.append(root)
    const proto = Object.getPrototypeOf(root.style)
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'transform') as PropertyDescriptor
    let during: string | undefined
    Object.defineProperty(root.style, 'transform', {
      configurable: true,
      get: () => descriptor.get?.call(root.style),
      set: (value: string) => {
        during = root.style.transition
        descriptor.set?.call(root.style, value)
      },
    })

    harness.desktop.attachWindow('a', root)

    expect(during).toBe('none')
    expect(root.style.transition).toBe('opacity 200ms ease')
  })
})

describe('stacking order in the dom', () => {
  function zOf(harness: Harness, id: string): number {
    const el = harness.element.querySelector<HTMLElement>(`[data-wm-window="${id}"]`)
    return Number(el?.style.zIndex)
  }

  it('paints windows in manager order', () => {
    const harness = makeHarness()
    for (const id of ['a', 'b', 'c']) harness.add({ id })

    expect(zOf(harness, 'a')).toBeLessThan(zOf(harness, 'b'))
    expect(zOf(harness, 'b')).toBeLessThan(zOf(harness, 'c'))

    harness.wm.focus('a')
    expect(zOf(harness, 'a')).toBeGreaterThan(zOf(harness, 'c'))
  })

  it('rewrites a single z-index when one window is raised', () => {
    const harness = makeHarness()
    for (let i = 0; i < 12; i += 1) harness.add({ id: `w${i}` })
    const writes = new Set<string>()
    for (let i = 0; i < 12; i += 1) {
      const el = harness.element.querySelector<HTMLElement>(
        `[data-wm-window="w${i}"]`,
      ) as HTMLElement
      const before = el.style.zIndex
      Object.defineProperty(el.style, 'zIndex', {
        get: () => before,
        set: () => writes.add(`w${i}`),
        configurable: true,
      })
    }

    harness.wm.focus('w3')
    expect([...writes]).toEqual(['w3'])
  })

  it('isolates the desktop so window layers never escape the host page', () => {
    const harness = makeHarness()
    expect(harness.element.style.isolation).toBe('isolate')

    const opened = makeHarness({ stacking: { isolate: false } })
    expect(opened.element.style.isolation).toBe('')
  })

  it('honours the configured stacking base and gap', () => {
    const harness = makeHarness({ stacking: { base: 900, gap: 5 } })
    harness.add({ id: 'a' })
    harness.add({ id: 'b' })

    expect(zOf(harness, 'a')).toBe(905)
    expect(zOf(harness, 'b')).toBe(910)
  })

  it('keeps a group contiguous above an unrelated window', () => {
    const harness = makeHarness()
    for (const id of ['a', 'b', 'c']) harness.add({ id })
    harness.wm.group(['a', 'b'])

    expect(zOf(harness, 'c')).toBeLessThan(zOf(harness, 'a'))
    expect(zOf(harness, 'c')).toBeLessThan(zOf(harness, 'b'))
  })
})

describe('desktop controller', () => {
  it('hides windows that belong to another workspace', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 10, y: 10 })

    expect(root.hidden).toBe(false)
    harness.wm.setWorkspace(1)
    expect(root.hidden).toBe(true)
    expect(root.dataset.wmWorkspace).toBe('0')
    harness.wm.setWorkspace(0)
    expect(root.hidden).toBe(false)
  })

  it('runs snap and history shortcuts from the desktop', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    harness.wm.focus('a')

    harness.element.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        ctrlKey: true,
        altKey: true,
        bubbles: true,
      }),
    )
    expect(harness.wm.get('a')).toMatchObject({ stage: 'snapped', snapZone: 'left' })

    harness.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    )
    expect(harness.wm.get('a')?.stage).toBe('normal')

    harness.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }),
    )
    expect(harness.wm.get('a')?.stage).toBe('snapped')
  })

  it('keeps shortcuts out of text fields', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const input = document.createElement('input')
    root.append(input)
    harness.wm.focus('a')

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        ctrlKey: true,
        altKey: true,
        bubbles: true,
      }),
    )
    expect(harness.wm.get('a')?.stage).toBe('normal')
  })

  it('cancels an in-flight gesture when the desktop is destroyed', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { root, handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })

    drag(harness, handle, [150, 110], [250, 210])
    expect(root.dataset.wmDragging).toBe('')

    harness.desktop.destroy()
    expect(root.dataset.wmDragging).toBeUndefined()
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
  })

  it('cancels an in-flight resize when the desktop is destroyed', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const handle = harness.resizeHandle('a', 'e')

    handle.dispatchEvent(pointerEvent('pointerdown', 300, 175))
    handle.dispatchEvent(pointerEvent('pointermove', 380, 175))
    harness.flushFrames()
    expect(harness.wm.get('a')?.bounds.width).toBe(280)

    harness.desktop.destroy()
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100, width: 200, height: 150 })
    expect(root.dataset.wmResizing).toBeUndefined()
  })

  it('keeps the title node in step with the window title', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', title: 'First', width: 200, height: 150 })
    const title = root.querySelector('[data-wm-title]') as HTMLElement

    expect(title.textContent).toBe('First')

    harness.wm.update('a', { title: 'Second' })
    expect(title.textContent).toBe('Second')
    expect(root.getAttribute('aria-label')).toBe('Second')
  })

  it('writes the title in place and leaves framework markers in the title node', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'First', width: 200, height: 150 })
    const root = document.createElement('section')
    root.innerHTML = '<header data-wm-drag><span data-wm-title><!--marker--></span></header>'
    harness.element.append(root)
    harness.desktop.attachWindow('a', root)
    const title = root.querySelector('[data-wm-title]') as HTMLElement
    const marker = title.firstChild as Comment

    expect(title.textContent).toBe('First')
    expect(marker.isConnected).toBe(true)
    const text = title.lastChild as Text

    harness.wm.update('a', { title: 'Second' })
    expect(title.textContent).toBe('Second')
    expect(marker.isConnected).toBe(true)
    expect(text.isConnected).toBe(true)
    expect(text.data).toBe('Second')

    title.append('tail')
    harness.wm.update('a', { title: 'Third' })
    expect(title.textContent).toBe('Third')
    expect(title.childNodes).toHaveLength(3)

    title.innerHTML = '<b>bold</b>'
    harness.wm.update('a', { title: 'Fourth' })
    expect(title.innerHTML).toBe('Fourth')
  })

  it('never touches the title node when the title has not changed', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { root, handle } = harness.add({
      id: 'a',
      title: 'First',
      x: 10,
      y: 10,
      width: 200,
      height: 150,
    })
    const title = root.querySelector('[data-wm-title]') as HTMLElement

    const observer = new MutationObserver(() => {})
    observer.observe(title, { characterData: true, childList: true, subtree: true })

    drag(harness, handle, [60, 20], [160, 120])
    harness.wm.focus('a')
    harness.wm.minimize('a')
    const seen = observer.takeRecords()
    observer.disconnect()

    expect(seen).toEqual([])
  })

  it('leaves a window without a title node alone', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'First', width: 200, height: 150 })
    const root = document.createElement('section')
    root.innerHTML = '<header data-wm-drag></header>'
    harness.element.append(root)

    expect(() => harness.desktop.attachWindow('a', root)).not.toThrow()
    expect(root.getAttribute('aria-label')).toBe('First')
  })

  it('hands out actions for a window from the desktop', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })

    expect(harness.desktop.actions('a').minimize()).toBe(true)
    expect(harness.wm.get('a')?.stage).toBe('minimized')
    expect(harness.desktop.actions('nope').focus()).toBe(false)
  })

  it('drives snap, restore, centre, back and workspace from window attributes', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    const bar = document.createElement('div')
    bar.innerHTML =
      '<button data-wm-snap="left"></button><button data-wm-restore></button>' +
      '<button data-wm-center></button><button data-wm-send-back></button>' +
      '<button data-wm-to-workspace="2"></button>'
    root.append(bar)
    const [snap, restore, centre, back, workspace] = [
      ...bar.querySelectorAll('button'),
    ] as HTMLButtonElement[]

    snap?.click()
    expect(harness.wm.get('a')?.snapZone).toBe('left')

    restore?.click()
    expect(harness.wm.get('a')?.stage).toBe('normal')

    centre?.click()
    expect(harness.wm.get('a')?.bounds.x).toBe(300)

    harness.add({ id: 'b', width: 100, height: 100 })
    back?.click()
    expect(harness.wm.getState().order[0]).toBe('a')

    workspace?.click()
    expect(harness.wm.get('a')?.workspace).toBe(2)
  })

  it('refuses an unknown zone without letting the manager throw', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', width: 200, height: 150 })
    const odd = document.createElement('button')
    odd.dataset.wmSnap = 'sideways'
    root.append(odd)

    const thrown: unknown[] = []
    const onError = (event: ErrorEvent) => {
      thrown.push(event.error)
      event.preventDefault()
    }
    window.addEventListener('error', onError)
    odd.click()
    window.removeEventListener('error', onError)

    expect(thrown).toEqual([])
    expect(harness.wm.get('a')?.snapZone).toBeNull()
  })

  it('leaves a window that cannot snap alone, and shrugs off a bad workspace', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', width: 200, height: 150, snappable: false })
    const bar = document.createElement('div')
    bar.innerHTML =
      '<button data-wm-snap="left"></button><button data-wm-to-workspace="x"></button>'
    root.append(bar)

    for (const node of bar.querySelectorAll('button')) (node as HTMLButtonElement).click()

    expect(harness.wm.get('a')?.snapZone).toBeNull()
    expect(harness.wm.get('a')?.workspace).toBe(0)
  })

  it('finds an action attribute however deeply it is nested', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', width: 200, height: 150 })
    const nest = document.createElement('div')
    nest.innerHTML = '<div><span><button data-wm-snap="right"><i></i></button></span></div>'
    root.append(nest)

    nest.querySelector('i')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(harness.wm.get('a')?.snapZone).toBe('right')
  })

  it('refuses to attach an unknown or already attached window', () => {
    const harness = makeHarness()
    harness.add({ id: 'a' })
    const stray = document.createElement('section')
    expect(() => harness.desktop.attachWindow('ghost', stray)).toThrow(/unknown window/)
    expect(() => harness.desktop.attachWindow('a', stray)).toThrow(/already attached/)
  })
})

function keydown(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...init })
  target.dispatchEvent(event)
  return event
}

describe('window keyboard', () => {
  it('moves the window one step per arrow and one pixel with alt', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })

    expect(keydown(root, 'ArrowRight').defaultPrevented).toBe(true)
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 116, y: 100 })

    keydown(root, 'ArrowUp', { altKey: true })
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 116, y: 99 })
  })

  it('resizes with shift and refuses on a window that cannot resize', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })

    keydown(root, 'ArrowRight', { shiftKey: true })
    keydown(root, 'ArrowDown', { shiftKey: true })
    expect(harness.wm.get('a')?.bounds).toMatchObject({ width: 216, height: 166 })

    const fixed = harness.add({ id: 'b', x: 0, y: 0, width: 200, height: 150, resizable: false })
    expect(keydown(fixed.root, 'ArrowRight', { shiftKey: true }).defaultPrevented).toBe(false)
    expect(harness.wm.get('b')?.bounds).toMatchObject({ width: 200, height: 150 })
  })

  it('leaves arrows alone for shortcuts, form fields, unknown keys and locked windows', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const field = document.createElement('input')
    root.append(field)

    keydown(root, 'ArrowRight', { ctrlKey: true })
    keydown(root, 'ArrowRight', { metaKey: true })
    keydown(field, 'ArrowRight')
    keydown(root, 'Home')
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })

    harness.wm.maximize('a')
    const before = harness.wm.get('a')?.bounds
    expect(keydown(root, 'ArrowRight').defaultPrevented).toBe(false)
    expect(harness.wm.get('a')?.bounds).toEqual(before)
  })

  it('ignores arrows entirely when keyboard support is switched off', () => {
    const harness = makeHarness({ keyboard: false })
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })

    keydown(root, 'ArrowRight')
    keydown(root, 'ArrowDown', { shiftKey: true })
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100, width: 200, height: 150 })
  })

  it('drops the listener once the window is detached', () => {
    const harness = makeHarness()
    const { root, detach } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })

    detach()
    keydown(root, 'ArrowRight')
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100 })
  })

  it('moves the window only while focus sits on the window or its titlebar', () => {
    const harness = makeHarness()
    const { root, handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const list = document.createElement('ul')
    list.setAttribute('role', 'listbox')
    list.tabIndex = 0
    root.append(list)

    expect(keydown(list, 'ArrowDown').defaultPrevented).toBe(false)
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })

    keydown(handle, 'ArrowDown')
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 116 })
  })

  it('leaves arrows alone while a pointer drag holds the window', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { root, handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })

    drag(harness, handle, [150, 110], [250, 210])
    const during = harness.wm.get('a')?.bounds

    expect(keydown(root, 'ArrowRight').defaultPrevented).toBe(false)
    expect(harness.wm.get('a')?.bounds).toEqual(during)
  })
})

describe('modal focus trap', () => {
  function makeModal(): { harness: Harness; root: HTMLElement; buttons: HTMLButtonElement[] } {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'm', layer: 'modal', width: 200, height: 150 })
    const buttons = ['first', 'second'].map((name) => {
      const button = document.createElement('button')
      button.textContent = name
      Object.defineProperty(button, 'offsetParent', { configurable: true, value: root })
      root.append(button)
      return button
    })
    return { harness, root, buttons }
  }

  it('wraps forwards and backwards between the first and last control', () => {
    const { root, buttons } = makeModal()
    const [first, last] = buttons as [HTMLButtonElement, HTMLButtonElement]

    last.focus()
    expect(keydown(root, 'Tab').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    expect(keydown(root, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
  })

  it('lets a tab in the middle of the window through untouched', () => {
    const { root, buttons } = makeModal()
    const middle = document.createElement('button')
    Object.defineProperty(middle, 'offsetParent', { configurable: true, value: root })
    root.insertBefore(middle, buttons[1] as HTMLButtonElement)

    middle.focus()
    expect(keydown(root, 'Tab').defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(middle)
  })

  it('pulls focus back in when it has escaped the modal', () => {
    const { root, buttons } = makeModal()
    const outside = document.createElement('button')
    document.body.append(outside)
    const [first, last] = buttons as [HTMLButtonElement, HTMLButtonElement]

    outside.focus()
    expect(keydown(root, 'Tab').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    outside.focus()
    keydown(root, 'Tab', { shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('stays out of the way for other keys, empty modals and ordinary windows', () => {
    const { harness, root } = makeModal()
    expect(keydown(root, 'Enter').defaultPrevented).toBe(false)

    const empty = harness.add({ id: 'e', layer: 'modal', width: 100, height: 100 })
    expect(keydown(empty.root, 'Tab').defaultPrevented).toBe(false)

    const plain = harness.add({ id: 'p', width: 100, height: 100 })
    const button = document.createElement('button')
    Object.defineProperty(button, 'offsetParent', { configurable: true, value: plain.root })
    plain.root.append(button)
    button.focus()
    expect(keydown(plain.root, 'Tab').defaultPrevented).toBe(false)
  })

  it('wraps a shift+tab pressed on the modal itself, where focus lands when it opens', () => {
    const { root, buttons } = makeModal()
    expect(document.activeElement).toBe(root)

    expect(keydown(root, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(buttons[1])
  })

  it('counts editors, frames, summaries and media controls as stops, but not a non-editable island', () => {
    const kinds: Array<[string, () => { stop: HTMLElement; mount: HTMLElement }, boolean]> = [
      [
        'editor',
        () => {
          const stop = document.createElement('div')
          stop.setAttribute('contenteditable', 'true')
          return { stop, mount: stop }
        },
        true,
      ],
      [
        'summary',
        () => {
          const mount = document.createElement('details')
          const stop = document.createElement('summary')
          mount.append(stop)
          return { stop, mount }
        },
        true,
      ],
      [
        'frame',
        () => {
          const stop = document.createElement('iframe')
          return { stop, mount: stop }
        },
        true,
      ],
      [
        'video',
        () => {
          const stop = document.createElement('video')
          stop.controls = true
          return { stop, mount: stop }
        },
        false,
      ],
    ]
    for (const [kind, build, focusableHere] of kinds) {
      const { root, buttons } = makeModal()
      const [first, last] = buttons as [HTMLButtonElement, HTMLButtonElement]
      const { stop, mount } = build()
      const island = document.createElement('div')
      island.setAttribute('contenteditable', 'false')
      for (const node of [stop, island]) {
        Object.defineProperty(node, 'offsetParent', { configurable: true, value: root })
      }
      root.append(mount, island)

      last.focus()
      expect(keydown(root, 'Tab').defaultPrevented, kind).toBe(false)

      if (!focusableHere) continue
      stop.focus()
      expect(keydown(root, 'Tab').defaultPrevented, kind).toBe(true)
      expect(document.activeElement, kind).toBe(first)
    }
  })

  it('keeps tab inside the modal from an element that is not a stop, in both directions', () => {
    const { root, buttons } = makeModal()
    const [first, last] = buttons as [HTMLButtonElement, HTMLButtonElement]
    const heading = document.createElement('h2')
    heading.tabIndex = -1
    const panel = document.createElement('div')
    panel.tabIndex = -1
    root.prepend(heading)
    root.append(panel)

    heading.focus()
    expect(keydown(root, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)

    panel.focus()
    expect(keydown(root, 'Tab').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    root.focus()
    expect(keydown(root, 'Tab').defaultPrevented).toBe(false)
  })
})

describe('interaction under a modal', () => {
  function underModal(options: DesktopOptions = {}) {
    const harness = makeHarness({ magnetism: false, snap: false, ...options })
    const below = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const modal = harness.add({ id: 'm', layer: 'modal', x: 400, y: 300, width: 200, height: 150 })
    return { harness, below, modal }
  }

  it('refuses to drag, resize, double-click or open the menu of a window under a modal', () => {
    const calls: string[] = []
    const { harness, below } = underModal({ onTitlebarContextMenu: (win) => calls.push(win.id) })

    drag(harness, below.handle, [150, 110], [250, 210])
    below.handle.dispatchEvent(pointerEvent('pointerup', 250, 210))
    const grip = harness.resizeHandle('a', 'e')
    grip.dispatchEvent(pointerEvent('pointerdown', 300, 175))
    grip.dispatchEvent(pointerEvent('pointermove', 380, 175))
    harness.flushFrames()
    grip.dispatchEvent(pointerEvent('pointerup', 380, 175))
    below.handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    below.handle.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))

    expect(harness.wm.get('a')).toMatchObject({
      stage: 'normal',
      bounds: { x: 100, y: 100, width: 200, height: 150 },
    })
    expect(calls).toEqual([])
  })

  it('refuses the action attributes of a window under a modal', () => {
    const { harness, below } = underModal()
    const close = document.createElement('button')
    close.dataset.wmClose = ''
    const snap = document.createElement('button')
    snap.dataset.wmSnap = 'left'
    below.root.append(close, snap)

    close.click()
    snap.click()

    expect(harness.wm.get('a')).toMatchObject({ stage: 'normal', snapZone: null })
  })

  it('keeps a press below the modal from moving focus out of it', () => {
    const { harness, below, modal } = underModal()
    const field = document.createElement('input')
    below.root.append(field)

    field.dispatchEvent(pointerEvent('pointerdown', 150, 200))
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    field.dispatchEvent(press)

    expect(press.defaultPrevented).toBe(true)
    expect(harness.wm.getState().focusedId).toBe('m')
    expect(modal.root.dataset.wmFlash).toBe('')
  })

  it('lets the modal itself, and everything once it is out of the way, take input', () => {
    const { harness, below, modal } = underModal()

    drag(harness, modal.handle, [450, 310], [460, 320])
    modal.handle.dispatchEvent(pointerEvent('pointerup', 460, 320))
    expect(harness.wm.get('m')?.bounds).toMatchObject({ x: 410, y: 310 })

    harness.wm.minimize('m')
    drag(harness, below.handle, [150, 110], [250, 210])
    below.handle.dispatchEvent(pointerEvent('pointerup', 250, 210))
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 200, y: 200 })

    harness.wm.close('m')
    const close = document.createElement('button')
    close.dataset.wmClose = ''
    below.root.append(close)
    close.click()
    expect(harness.wm.get('a')).toBeUndefined()
  })
})

describe('remaining session edges', () => {
  it('keeps a north corner inside the desktop while an aspect ratio widens it', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200, aspectRatio: 1 })
    const handle = harness.resizeHandle('a', 'nw')

    handle.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    handle.dispatchEvent(pointerEvent('pointermove', -300, 100))
    harness.flushFrames()

    const bounds = harness.wm.get('a')?.bounds
    expect(bounds?.y).toBe(0)
    expect(bounds?.height).toBe(300)
    expect(bounds?.width).toBe(300)
  })

  it('rolls a resize back when the pointer is cancelled mid-gesture', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const handle = harness.resizeHandle('a', 'e')

    handle.dispatchEvent(pointerEvent('pointerdown', 300, 175))
    handle.dispatchEvent(pointerEvent('pointermove', 380, 175))
    harness.flushFrames()
    expect(harness.wm.get('a')?.bounds.width).toBe(280)

    handle.dispatchEvent(pointerEvent('pointercancel', 380, 175))
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100, width: 200, height: 150 })
    expect(root.dataset.wmResizing).toBeUndefined()
  })

  it('refuses to work against an element that has no window', () => {
    const detached = document.implementation.createHTMLDocument('x')
    expect(() => windowOf(detached.createElement('div'))).toThrow(/not attached to a document/)
    expect(windowOf(document.createElement('div'))).toBe(window)
  })

  it('gives a statically positioned desktop a containing block of its own', () => {
    const element = document.createElement('div')
    element.style.position = 'static'
    document.body.append(element)
    const wm = createWindowManager({ viewport: VIEWPORT })

    attachDesktop(wm, element, { autoViewport: false, announce: false })
    expect(element.style.position).toBe('relative')
    expect(element.style.isolation).toBe('isolate')
  })

  it('follows the desktop size when the viewport is tracked automatically', () => {
    const observed: Element[] = []
    let notify: (() => void) | undefined
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback
        }
        observe(target: Element) {
          observed.push(target)
        }
        disconnect() {
          observed.length = 0
        }
      },
    )

    const element = document.createElement('div')
    document.body.append(element)
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 640 })
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: 480 })
    const wm = createWindowManager({ viewport: VIEWPORT })
    const desktop = attachDesktop(wm, element, { announce: false })

    expect(wm.getState().viewport).toEqual({ width: 640, height: 480 })
    expect(observed).toEqual([element])

    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 320 })
    notify?.()
    expect(wm.getState().viewport).toEqual({ width: 320, height: 480 })

    desktop.destroy()
    expect(observed).toHaveLength(0)
  })

  it('mounts a live region unless announcements are switched off', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const wm = createWindowManager({ viewport: VIEWPORT })
    const desktop = attachDesktop(wm, element, {
      autoViewport: false,
      announce: { opened: (title: string) => `${title} готово` },
    })

    wm.open({ id: 'a', title: 'Заметки' })
    const region = element.querySelector<HTMLElement>('[data-wm-announcer]')
    expect(region?.textContent).toBe('Заметки готово')

    desktop.destroy()
    expect(element.querySelector('[data-wm-announcer]')).toBeNull()
  })

  it('flashes the window a blocked click landed on', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'm', layer: 'modal', width: 200, height: 150 })
    const other = harness.add({ id: 'a', width: 200, height: 150 })

    harness.wm.focus('a')
    expect(root.dataset.wmFlash).toBe('')
    expect(other.root.dataset.wmFlash).toBeUndefined()
  })

  it('keeps the flash until the next blocked interaction re-runs it, and drops it on detach', () => {
    const harness = makeHarness()
    const modal = harness.add({ id: 'm', layer: 'modal', width: 200, height: 150 })
    harness.add({ id: 'a', width: 200, height: 150 })

    harness.wm.focus('a')
    modal.root.dispatchEvent(new Event('animationend', { bubbles: true }))
    expect(modal.root.dataset.wmFlash).toBe('')

    harness.wm.focus('a')
    expect(modal.root.dataset.wmFlash).toBe('')

    modal.detach()
    expect(modal.root.dataset.wmFlash).toBeUndefined()
  })

  it('gives every generated title id its own value, across desktops and re-attaches', () => {
    const labelOf = (root: HTMLElement) =>
      document.getElementById(root.getAttribute('aria-labelledby') ?? '')
    const first = makeHarness()
    const one = first.add({ id: 'a', title: 'First' })
    const second = makeHarness()
    const two = second.add({ id: 'a', title: 'Second' })

    expect(labelOf(one.root)).toBe(one.root.querySelector('[data-wm-title]'))
    expect(labelOf(two.root)).toBe(two.root.querySelector('[data-wm-title]'))

    one.detach()
    const again = document.createElement('section')
    again.innerHTML = '<header data-wm-drag><span data-wm-title>t</span></header>'
    first.element.append(again)
    first.desktop.attachWindow('a', again)
    expect(labelOf(again)).toBe(again.querySelector('[data-wm-title]'))
  })

  it('takes an explicit drag handle selector and labels the window by its title', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Notes', x: 0, y: 0, width: 200, height: 150 })
    const root = document.createElement('section')
    root.innerHTML = '<div class="bar"><span data-wm-title>Notes</span></div>'
    harness.element.append(root)
    harness.desktop.attachWindow('a', root, { handle: '.bar' })

    const bar = root.querySelector<HTMLElement>('.bar') as HTMLElement
    bar.dispatchEvent(pointerEvent('pointerdown', 50, 10))
    bar.dispatchEvent(pointerEvent('pointermove', 150, 110))
    harness.flushFrames()
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
    expect(document.getElementById(root.getAttribute('aria-labelledby') ?? '')).toBe(
      root.querySelector('[data-wm-title]'),
    )
  })

  it('maximizes on a double click that misses the window controls', () => {
    const harness = makeHarness()
    const { root, handle } = harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    const button = document.createElement('button')
    handle.append(button)

    button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(harness.wm.get('a')?.stage).toBe('normal')

    handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(harness.wm.get('a')?.stage).toBe('maximized')
    expect(root.dataset.wmStage).toBe('maximized')
  })
})

describe('desktop keyboard', () => {
  it('cycles focus with F6 in both directions', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', width: 200, height: 150 })
    harness.add({ id: 'b', width: 200, height: 150 })
    harness.add({ id: 'c', width: 200, height: 150 })

    keydown(harness.element, 'F6')
    const forward = harness.wm.getState().focusedId
    keydown(harness.element, 'F6', { shiftKey: true })
    expect(harness.wm.getState().focusedId).not.toBe(forward)
  })

  it('cycles with F6 even from inside a text field, the way out of a field it is meant to be', () => {
    const harness = makeHarness()
    harness.add({ id: 'b', width: 200, height: 150 })
    const { root } = harness.add({ id: 'a', width: 200, height: 150 })
    const field = document.createElement('input')
    root.append(field)
    field.focus()

    expect(keydown(field, 'F6').defaultPrevented).toBe(true)
    expect(harness.wm.getState().focusedId).toBe('b')
  })

  it('undoes and redoes on the Z key of a non-Latin layout, and never on another letter there', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    harness.wm.move('a', 200, 200)
    const press = (key: string, code: string, keyCode: number, init: KeyboardEventInit = {}) =>
      keydown(harness.element, key, { code, keyCode, ctrlKey: true, ...init } as KeyboardEventInit)

    press('я', 'KeyZ', 90)
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })

    press('Я', 'KeyZ', 90, { shiftKey: true })
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 200, y: 200 })

    press('y', 'KeyZ', 89)
    press(';', 'KeyZ', 186)
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 200, y: 200 })

    press('z', 'KeyY', 90, { ctrlKey: false, metaKey: true })
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
  })

  it('snaps, maximizes, minimizes and restores the focused window', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    const combo = { ctrlKey: true, altKey: true }

    keydown(harness.element, 'ArrowLeft', combo)
    expect(harness.wm.get('a')?.snapZone).toBe('left')

    keydown(harness.element, 'ArrowUp', combo)
    expect(harness.wm.get('a')?.stage).toBe('maximized')

    keydown(harness.element, 'ArrowDown', combo)
    expect(harness.wm.get('a')?.stage).toBe('normal')

    keydown(harness.element, 'ArrowDown', combo)
    expect(harness.wm.get('a')?.stage).toBe('minimized')
  })

  it('leaves the shortcuts alone without alt, without focus or when switched off', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })

    keydown(harness.element, 'ArrowLeft', { ctrlKey: true })
    keydown(harness.element, 'Home', { ctrlKey: true, altKey: true })
    expect(harness.wm.get('a')?.snapZone).toBeNull()

    harness.wm.close('a')
    keydown(harness.element, 'ArrowLeft', { metaKey: true, altKey: true })

    const locked = makeHarness({ keyboard: { snapShortcuts: false } })
    locked.add({ id: 'b', x: 10, y: 10, width: 200, height: 150 })
    keydown(locked.element, 'ArrowLeft', { ctrlKey: true, altKey: true })
    expect(locked.wm.get('b')?.snapZone).toBeNull()
  })

  it('refuses to move a window that has opted out of the stage change', () => {
    const harness = makeHarness()
    harness.add({
      id: 'a',
      x: 10,
      y: 10,
      width: 200,
      height: 150,
      snappable: false,
      maximizable: false,
      minimizable: false,
    })
    const combo = { ctrlKey: true, altKey: true }

    keydown(harness.element, 'ArrowLeft', combo)
    keydown(harness.element, 'ArrowUp', combo)
    keydown(harness.element, 'ArrowDown', combo)
    expect(harness.wm.get('a')).toMatchObject({ stage: 'normal', snapZone: null })
  })
})

describe('minimize flight', () => {
  const realAnimate = Element.prototype.animate

  afterEach(() => {
    Element.prototype.animate = realAnimate
  })

  it('flies the window to its taskbar slot and back', () => {
    const flights: KeyframeAnimationOptions[] = []
    Element.prototype.animate = function fake(_keyframes: unknown, options: unknown) {
      flights.push(options as KeyframeAnimationOptions)
      return { onfinish: null, oncancel: null } as unknown as Animation
    } as typeof Element.prototype.animate

    const slot = document.createElement('button')
    slot.getBoundingClientRect = () => ({ left: 10, top: 560, width: 40, height: 20 }) as DOMRect
    document.body.append(slot)

    const harness = makeHarness({ minimizeTarget: () => slot, animation: { duration: 120 } })
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    root.getBoundingClientRect = () => ({ left: 100, top: 100, width: 200, height: 150 }) as DOMRect

    harness.wm.minimize('a')
    expect(flights).toHaveLength(1)
    expect(flights[0]).toMatchObject({ duration: 120 })

    harness.wm.restore('a')
    expect(flights).toHaveLength(1)
    harness.flushFrames()
    expect(flights).toHaveLength(2)
  })

  it('stays still when there is no slot to fly to or animation is off', () => {
    const flights: unknown[] = []
    Element.prototype.animate = function fake() {
      flights.push(1)
      return { onfinish: null, oncancel: null } as unknown as Animation
    } as typeof Element.prototype.animate

    const silent = makeHarness({ minimizeTarget: () => null })
    silent.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    silent.wm.minimize('a')
    silent.wm.restore('a')
    silent.flushFrames()

    const still = makeHarness({ animation: false, minimizeTarget: () => document.body })
    still.add({ id: 'b', x: 100, y: 100, width: 200, height: 150 })
    still.wm.minimize('b')

    expect(flights).toHaveLength(0)
  })
})

describe('window appearance variants', () => {
  it('mirrors a variant from the window meta and keeps it in step', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', meta: { variant: 'terminal' } })
    expect(root.dataset.wmVariant).toBe('terminal')

    harness.wm.update('a', { meta: { variant: 'paper' } })
    expect(root.dataset.wmVariant).toBe('paper')

    harness.wm.update('a', { meta: { variant: '' } })
    expect(root.dataset.wmVariant).toBeUndefined()
  })

  it('leaves the attribute off for a window that never asked for one', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a' })
    expect(root.dataset.wmVariant).toBeUndefined()
  })

  it('ignores a variant that is not a name', () => {
    const harness = makeHarness()
    const numeric = harness.add({ id: 'a', meta: { variant: 7 } })
    const empty = harness.add({ id: 'b', meta: { variant: '' } })

    expect(numeric.root.dataset.wmVariant).toBeUndefined()
    expect(empty.root.dataset.wmVariant).toBeUndefined()
  })

  it('lets the desktop decide the variant itself', () => {
    const harness = makeHarness({
      windowVariant: (win) => (win.layer === 'modal' ? 'sheet' : null),
    })
    const modal = harness.add({ id: 'a', layer: 'modal', meta: { variant: 'terminal' } })
    const plain = harness.add({ id: 'b', meta: { variant: 'terminal' } })

    expect(modal.root.dataset.wmVariant).toBe('sheet')
    expect(plain.root.dataset.wmVariant).toBeUndefined()
  })
})

function makeSkin(look: string, extra: { destroy?: () => void } = {}): WindowSkin {
  return ({ doc, actions }) => {
    const element = doc.createElement('section')
    element.dataset.look = look
    const header = doc.createElement('header')
    header.dataset.wmDrag = ''
    const title = doc.createElement('b')
    title.dataset.wmTitle = ''
    const close = doc.createElement('button')
    close.className = 'shut'
    close.addEventListener('click', () => actions.close())
    header.append(title, close)
    const content = doc.createElement('div')
    element.append(header, content)
    return { element, content, ...extra }
  }
}

describe('window skins', () => {
  it('mounts a window from a skin and hands back the content node', () => {
    const stripe = makeSkin('stripe')
    const harness = makeHarness({ skins: { stripe } })
    harness.wm.open({ id: 'a', title: 'Hello', width: 200, height: 150 })

    const mounted = harness.desktop.mountWindow('a', 'stripe')

    expect(mounted.element.dataset.wmWindow).toBe('a')
    expect(mounted.element.dataset.look).toBe('stripe')
    expect(mounted.element.querySelector('[data-wm-title]')?.textContent).toBe('Hello')
    expect(harness.element.contains(mounted.element)).toBe(true)

    mounted.content.append(document.createTextNode('body'))
    mounted.element.querySelector<HTMLButtonElement>('.shut')?.click()
    expect(harness.wm.get('a')).toBeUndefined()
  })

  it('takes a skin object as well as a registered name', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Hello' })

    const mounted = harness.desktop.mountWindow('a', makeSkin('inline'))
    expect(mounted.element.dataset.look).toBe('inline')
  })

  it('refuses a skin name it does not know, and an unknown window', () => {
    const harness = makeHarness({ skins: { stripe: makeSkin('stripe') } })
    harness.wm.open({ id: 'a' })

    expect(() => harness.desktop.mountWindow('a', 'nope')).toThrow(/unknown skin/)
    expect(() => harness.desktop.mountWindow('ghost', 'stripe')).toThrow(/unknown window/)
  })

  it('rebuilds the window when the skin changes and carries the content over', () => {
    const destroyed: string[] = []
    const harness = makeHarness({
      skins: {
        stripe: makeSkin('stripe', { destroy: () => destroyed.push('stripe') }),
        plain: makeSkin('plain'),
      },
    })
    harness.wm.open({ id: 'a', title: 'Hello', meta: { skin: 'stripe' } })
    const mounted = harness.desktop.mountWindow('a', 'stripe')
    const shed = mounted.element
    const live = document.createElement('canvas')
    mounted.content.append(live)

    harness.wm.update('a', { meta: { skin: 'plain' } })

    const now = harness.element.querySelector<HTMLElement>('[data-wm-window="a"]')
    expect(now?.dataset.look).toBe('plain')
    expect(now?.contains(live)).toBe(true)
    expect(shed.isConnected).toBe(false)
    expect(destroyed).toEqual(['stripe'])
    expect(harness.wm.get('a')?.title).toBe('Hello')
    expect(now?.querySelector('[data-wm-title]')?.textContent).toBe('Hello')
  })

  it('keeps driving the manager from the rebuilt chrome', () => {
    const harness = makeHarness({
      skins: { stripe: makeSkin('stripe'), plain: makeSkin('plain') },
    })
    harness.wm.open({ id: 'a', title: 'Hello', meta: { skin: 'stripe' } })
    harness.desktop.mountWindow('a', 'stripe')

    harness.wm.update('a', { meta: { skin: 'plain' } })
    const now = harness.element.querySelector<HTMLElement>('[data-wm-window="a"]')
    now?.querySelector<HTMLButtonElement>('.shut')?.click()

    expect(harness.wm.get('a')).toBeUndefined()
  })

  it('leaves the window alone when the skin name is unchanged or dropped', () => {
    const harness = makeHarness({ skins: { stripe: makeSkin('stripe') } })
    harness.wm.open({ id: 'a', title: 'Hello', meta: { skin: 'stripe' } })
    const mounted = harness.desktop.mountWindow('a', 'stripe')

    harness.wm.update('a', { title: 'Same skin' })
    expect(harness.element.querySelector('[data-wm-window="a"]')).toBe(mounted.element)

    harness.wm.update('a', { meta: { skin: 7 } })
    expect(harness.element.querySelector('[data-wm-window="a"]')).toBe(mounted.element)
  })

  it('never rebuilds a window that was attached rather than mounted', () => {
    const harness = makeHarness({ skins: { stripe: makeSkin('stripe') } })
    const { root } = harness.add({ id: 'a', title: 'Hello' })

    harness.wm.update('a', { meta: { skin: 'stripe' } })
    expect(harness.element.querySelector('[data-wm-window="a"]')).toBe(root)
  })

  it('keeps pointing at the window it mounted after a rebuild', () => {
    const harness = makeHarness({
      skins: { stripe: makeSkin('stripe'), plain: makeSkin('plain') },
    })
    harness.wm.open({ id: 'a', title: 'Hello', meta: { skin: 'stripe' } })
    const mounted = harness.desktop.mountWindow('a', 'stripe')
    const before = mounted.element

    harness.wm.update('a', { meta: { skin: 'plain' } })

    expect(mounted.element).not.toBe(before)
    expect(mounted.element.dataset.look).toBe('plain')
    expect(mounted.content.parentElement).toBe(mounted.element)

    mounted.content.append(document.createTextNode('late'))
    expect(mounted.element.textContent).toContain('late')
  })

  it('rebuilds in place when the same window is mounted again', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Hello' })
    const mounted = harness.desktop.mountWindow('a', makeSkin('one'))
    const live = document.createElement('canvas')
    mounted.content.append(live)
    const shed = mounted.element

    harness.desktop.mountWindow('a', makeSkin('two'))

    expect(harness.element.querySelectorAll('[data-wm-window="a"]')).toHaveLength(1)
    expect(mounted.element.dataset.look).toBe('two')
    expect(mounted.content.contains(live)).toBe(true)
    expect(shed.isConnected).toBe(false)

    mounted.element.querySelector<HTMLButtonElement>('.shut')?.click()
    expect(harness.wm.get('a')).toBeUndefined()
  })

  it('survives a detach after the window has already closed', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Hello' })
    const mounted = harness.desktop.mountWindow('a', makeSkin('inline'))

    harness.wm.close('a')
    expect(() => mounted.detach()).not.toThrow()
    expect(mounted.element.isConnected).toBe(false)
  })

  it('runs the skin teardown when a mounted window is detached', () => {
    const gone: string[] = []
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Hello' })
    const mounted = harness.desktop.mountWindow(
      'a',
      makeSkin('inline', { destroy: () => gone.push('inline') }),
    )

    mounted.detach()
    expect(gone).toEqual(['inline'])
  })

  it('clears away what it mounted when the desktop is destroyed', () => {
    const gone: string[] = []
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Hello' })
    const mounted = harness.desktop.mountWindow(
      'a',
      makeSkin('inline', { destroy: () => gone.push('inline') }),
    )

    harness.desktop.destroy()

    expect(mounted.element.isConnected).toBe(false)
    expect(gone).toEqual(['inline'])
  })

  it('leaves a window standing when its next skin is not registered', () => {
    const harness = makeHarness({ skins: { stripe: makeSkin('stripe') } })
    harness.wm.open({ id: 'a', title: 'Hello', meta: { skin: 'stripe' } })
    const mounted = harness.desktop.mountWindow('a', 'stripe')
    const live = document.createElement('canvas')
    mounted.content.append(live)

    expect(() => harness.wm.update('a', { meta: { skin: 'nope' } })).toThrow(/unknown skin/)

    expect(harness.wm.get('a')).toBeDefined()
    expect(mounted.element.isConnected).toBe(true)
    expect(mounted.element.dataset.look).toBe('stripe')
    expect(mounted.content.contains(live)).toBe(true)
  })

  it('takes the mounted element away when the window closes', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Hello' })
    const mounted = harness.desktop.mountWindow('a', makeSkin('inline'))

    harness.wm.close('a')
    expect(mounted.element.isConnected).toBe(false)
  })

  it('keeps the window where the pointer left it when the skin changes mid-drag', () => {
    const harness = makeHarness({
      magnetism: false,
      snap: false,
      skins: { stripe: makeSkin('stripe'), plain: makeSkin('plain') },
    })
    harness.wm.open({ id: 'a', title: 'Hello', x: 100, y: 100, meta: { skin: 'stripe' } })
    harness.desktop.mountWindow('a', 'stripe')
    const handle = harness.handleOf('a')

    handle.dispatchEvent(pointerEvent('pointerdown', 150, 120))
    handle.dispatchEvent(pointerEvent('pointermove', 250, 220))
    harness.flushFrames()
    const dragged = harness.wm.get('a')?.bounds

    harness.wm.update('a', { meta: { skin: 'plain' } })

    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: dragged?.x, y: dragged?.y })
  })

  it('does not tear down the window that took the place of a spent handle', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Hello' })
    const first = harness.desktop.mountWindow('a', makeSkin('one'))
    first.detach()

    const second = harness.desktop.mountWindow('a', makeSkin('two'))
    first.detach()

    expect(second.element.isConnected).toBe(true)
    expect(harness.element.querySelector('[data-wm-window="a"]')).toBe(second.element)
  })

  it('leaves behind content the app moved to another document', () => {
    const harness = makeHarness({
      skins: { stripe: makeSkin('stripe'), plain: makeSkin('plain') },
    })
    harness.wm.open({ id: 'a', title: 'Hello', meta: { skin: 'stripe' } })
    const mounted = harness.desktop.mountWindow('a', 'stripe')
    const travelled = document.createElement('p')
    mounted.content.append(travelled)
    // this is what popout does: it moves the content element into another document
    const elsewhere = document.implementation.createHTMLDocument('popout')
    elsewhere.body.append(mounted.content)

    harness.wm.update('a', { meta: { skin: 'plain' } })

    expect(mounted.element.dataset.look).toBe('plain')
    expect(travelled.ownerDocument).toBe(elsewhere)
    expect(mounted.content.contains(travelled)).toBe(false)
  })

  it('detaches a mounted window and takes its element with it', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Hello' })
    const mounted = harness.desktop.mountWindow('a', makeSkin('inline'))

    mounted.detach()
    expect(mounted.element.isConnected).toBe(false)
    expect(harness.element.querySelector('[data-wm-window="a"]')).toBeNull()
  })

  it('runs the skin teardown exactly once when a mounted window is closed', () => {
    const gone: string[] = []
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Hello' })
    harness.wm.open({ id: 'b', title: 'There' })
    const a = harness.desktop.mountWindow('a', makeSkin('a', { destroy: () => gone.push('a') }))
    const b = harness.desktop.mountWindow('b', makeSkin('b', { destroy: () => gone.push('b') }))

    harness.wm.close('a')
    expect(gone).toEqual(['a'])

    a.detach()
    harness.desktop.destroy()
    b.detach()
    expect(gone).toEqual(['a', 'b'])
  })

  it('leaves the window standing when the next skin throws while it is built', () => {
    const broken: WindowSkin = () => {
      throw new Error('template has no single root')
    }
    const harness = makeHarness({ skins: { stripe: makeSkin('stripe'), broken } })
    harness.wm.open({ id: 'a', title: 'Hello', meta: { skin: 'stripe' } })
    const mounted = harness.desktop.mountWindow('a', 'stripe')
    const live = document.createElement('canvas')
    mounted.content.append(live)

    expect(() => harness.wm.update('a', { meta: { skin: 'broken' } })).toThrow(/single root/)

    expect(mounted.element.isConnected).toBe(true)
    expect(harness.element.querySelector('[data-wm-window="a"]')).toBe(mounted.element)
    expect(live.isConnected).toBe(true)
    expect(() => harness.wm.move('a', 40, 40)).not.toThrow()
    expect(mounted.element.style.transform).toBe('translate3d(40px, 40px, 0)')
  })

  it('keeps projecting every later change after a rebuild onto an unregistered skin', () => {
    const harness = makeHarness({ skins: { stripe: makeSkin('stripe') } })
    harness.wm.open({ id: 'a', title: 'Hello', meta: { skin: 'stripe' } })
    const mounted = harness.desktop.mountWindow('a', 'stripe')
    const { root } = harness.add({ id: 'b', x: 10, y: 10, width: 200, height: 150 })
    const later: number[] = []
    harness.wm.subscribe(() => later.push(1))

    expect(() => harness.wm.update('a', { meta: { skin: 'nope' } })).toThrow(/unknown skin/)

    expect(() => harness.wm.move('b', 300, 300)).not.toThrow()
    expect(root.style.transform).toBe('translate3d(300px, 300px, 0)')
    expect(later).toHaveLength(1)
    harness.wm.focus('a')
    expect(mounted.element.dataset.wmFocused).toBe('')
  })

  it('does not rebuild a window mounted under another name until meta.skin changes', () => {
    const harness = makeHarness({
      magnetism: false,
      snap: false,
      skins: { stripe: makeSkin('stripe'), plain: makeSkin('plain') },
    })
    harness.wm.open({ id: 'a', title: 'Hello', x: 100, y: 100, meta: { skin: 'stripe' } })
    const mounted = harness.desktop.mountWindow('a', 'plain')
    const first = mounted.element
    const handle = harness.handleOf('a')

    drag(harness, handle, [150, 110], [200, 160])
    handle.dispatchEvent(pointerEvent('pointermove', 300, 260))
    harness.flushFrames()
    handle.dispatchEvent(pointerEvent('pointerup', 300, 260))

    expect(mounted.element).toBe(first)
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 250, y: 250 })

    harness.wm.update('a', { meta: { skin: 'plain' } })
    expect(mounted.element).toBe(first)
    harness.wm.update('a', { meta: { skin: 'stripe' } })
    expect(mounted.element.dataset.look).toBe('stripe')
  })

  it('leaves no stray chrome behind when the mounted element cannot be attached', () => {
    const gone: string[] = []
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', title: 'Hello' })
    harness.wm.open({ id: 'b', title: 'There' })

    expect(() =>
      harness.desktop.mountWindow('a', makeSkin('stray', { destroy: () => gone.push('stray') })),
    ).toThrow(/already attached/)
    expect(() => harness.desktop.mountWindow('b', makeSkin('bad'), { handle: '[[' })).toThrow()

    expect(harness.element.querySelector('[data-look="stray"]')).toBeNull()
    expect(harness.element.querySelector('[data-look="bad"]')).toBeNull()
    expect(gone).toEqual(['stray'])
    expect(harness.element.querySelector('[data-wm-window="a"]')).toBe(root)
    expect(harness.desktop.mountWindow('b', makeSkin('good')).element.dataset.wmWindow).toBe('b')
  })

  it('does not let a handle that outlived its window tear down the next one with that id', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Hello' })
    const first = harness.desktop.mountWindow('a', makeSkin('one'))
    harness.wm.close('a')

    harness.wm.open({ id: 'a', title: 'Again' })
    const second = harness.desktop.mountWindow('a', makeSkin('two'))
    first.detach()

    expect(first.element.dataset.look).toBe('one')
    expect(second.element.isConnected).toBe(true)
    expect(harness.element.querySelector('[data-wm-window="a"]')).toBe(second.element)
  })
})

function shadowWindow(harness: Harness, init: WindowInit, markup: string): HTMLElement {
  harness.wm.open(init)
  const host = document.createElement('section')
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = markup
  harness.element.append(host)
  harness.desktop.attachWindow(init.id as string, host)
  return host
}

describe('windows built inside a shadow root', () => {
  it('names the window by string when its title lives across the boundary', () => {
    const harness = makeHarness()
    const host = shadowWindow(
      harness,
      { id: 'a', title: 'Notes' },
      '<header data-wm-drag><span data-wm-title></span></header>',
    )

    expect(host.getAttribute('aria-label')).toBe('Notes')
    expect(host.hasAttribute('aria-labelledby')).toBe(false)
    expect(host.shadowRoot?.querySelector('[data-wm-title]')?.textContent).toBe('Notes')

    harness.wm.update('a', { title: 'Renamed' })
    expect(host.shadowRoot?.querySelector('[data-wm-title]')?.textContent).toBe('Renamed')
  })

  it('still points at a light title by reference', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', title: 'Notes' })
    const title = root.querySelector('[data-wm-title]') as HTMLElement

    expect(root.getAttribute('aria-labelledby')).toBe(title.id)
  })

  it('finds a drop target whose titlebar is inside a shadow root', () => {
    const harness = makeHarness({ magnetism: false, snap: false, grouping: { dwell: 0 } })
    const host = shadowWindow(
      harness,
      { id: 'target', x: 400, y: 400, width: 200, height: 150 },
      '<header data-wm-drag><span data-wm-title></span></header>',
    )
    const root = host.shadowRoot as ShadowRoot
    const inner = root.querySelector('[data-wm-drag]') as HTMLElement
    // the handle is found by geometry inside the root, so give it one
    inner.getBoundingClientRect = () =>
      ({
        left: 400,
        top: 400,
        right: 600,
        bottom: 440,
        x: 400,
        y: 400,
        width: 200,
        height: 40,
      }) as DOMRect
    document.elementsFromPoint = () => [host]

    const { handle } = harness.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
    handle.dispatchEvent(pointerEvent('pointerdown', 60, 20))
    handle.dispatchEvent(pointerEvent('pointermove', 450, 410))
    harness.flushFrames()

    expect(host.dataset.wmTabTarget).toBe('')

    handle.dispatchEvent(pointerEvent('pointerup', 450, 410))
    expect(harness.wm.get('moving')?.groupId).toBeTruthy()
  })

  it('gives up on a shadow root that cannot answer where a point lands', () => {
    const harness = makeHarness({ magnetism: false, snap: false, grouping: { dwell: 0 } })
    const host = shadowWindow(
      harness,
      { id: 'target', x: 400, y: 400, width: 200, height: 150 },
      '<header data-wm-drag></header>',
    )
    document.elementsFromPoint = () => [host]

    const { handle } = harness.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
    drag(harness, handle, [60, 20], [450, 410])

    expect(harness.element.querySelector('[data-wm-tab-target]')).toBeNull()
  })

  it('gives up on a shadow root that keeps answering with its own host', () => {
    const harness = makeHarness({ magnetism: false, snap: false, grouping: { dwell: 0 } })
    const host = shadowWindow(
      harness,
      { id: 'target', x: 400, y: 400, width: 200, height: 150 },
      '<header data-wm-drag></header>',
    )
    Object.assign(host.shadowRoot as ShadowRoot, { elementFromPoint: () => host })
    document.elementsFromPoint = () => [host]

    const { handle } = harness.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
    drag(harness, handle, [60, 20], [450, 410])

    expect(harness.element.querySelector('[data-wm-tab-target]')).toBeNull()
  })

  it('ignores a hit that belongs to no window at all', () => {
    const harness = makeHarness({ magnetism: false, snap: false, grouping: { dwell: 0 } })
    const stray = document.createElement('div')
    stray.dataset.wmDrag = ''
    document.body.append(stray)
    document.elementsFromPoint = () => [stray]

    const { handle } = harness.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
    drag(harness, handle, [60, 20], [450, 410])

    expect(harness.wm.get('moving')?.groupId).toBeNull()
  })

  it('wraps the tab key across the boundary and through the projected content', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'm', layer: 'modal', width: 200, height: 150 })
    const host = document.createElement('section')
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML =
      '<header data-wm-drag><button id="shut">x</button></header>' +
      '<div><slot></slot></div>' +
      '<footer><button id="help">?</button></footer>'
    const body = document.createElement('div')
    const field = document.createElement('input')
    body.append(field)
    host.append(body)
    harness.element.append(host)
    harness.desktop.attachWindow('m', host)

    const shut = root.querySelector<HTMLElement>('#shut') as HTMLElement
    const help = root.querySelector<HTMLElement>('#help') as HTMLElement
    for (const node of [shut, help, field]) {
      Object.defineProperty(node, 'offsetParent', { configurable: true, value: host })
    }

    help.focus()
    expect(keydown(host, 'Tab').defaultPrevented).toBe(true)
    expect(root.activeElement).toBe(shut)

    expect(keydown(host, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true)
    expect(root.activeElement).toBe(help)

    field.focus()
    expect(keydown(host, 'Tab').defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(field)
  })

  it('counts a projected control that is focused but has no layout', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'm', layer: 'modal', width: 200, height: 150 })
    const host = document.createElement('section')
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = '<header data-wm-drag></header><slot></slot>'
    const only = document.createElement('button')
    host.append(only)
    harness.element.append(host)
    harness.desktop.attachWindow('m', host)

    only.focus()
    expect(keydown(host, 'Tab').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(only)
  })

  it('leaves a shadow window without a titlebar unlabelled by reference', () => {
    const harness = makeHarness()
    const host = shadowWindow(harness, { id: 'a', title: 'Notes' }, '<div>no titlebar</div>')

    expect(host.hasAttribute('aria-labelledby')).toBe(false)
    expect(host.getAttribute('aria-label')).toBe('Notes')
  })
})

describe('sync writes', () => {
  function spyStyle(el: HTMLElement): Record<'transform' | 'width' | 'height', number> {
    const counts = { transform: 0, width: 0, height: 0 }
    for (const key of ['transform', 'width', 'height'] as const) {
      const proto = Object.getPrototypeOf(el.style)
      const descriptor = Object.getOwnPropertyDescriptor(proto, key) as PropertyDescriptor
      Object.defineProperty(el.style, key, {
        configurable: true,
        get: () => descriptor.get?.call(el.style),
        set: (value: string) => {
          counts[key] += 1
          descriptor.set?.call(el.style, value)
        },
      })
    }
    return counts
  }

  it('writes only the transform while a window is dragged', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { root, handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const counts = spyStyle(root)
    handle.dispatchEvent(pointerEvent('pointerdown', 150, 110))
    for (let i = 1; i <= 10; i += 1) {
      handle.dispatchEvent(pointerEvent('pointermove', 150 + i * 10, 110 + i * 5))
      harness.flushFrames()
    }
    expect(counts).toEqual({ transform: 10, width: 0, height: 0 })
  })

  it('touches no attribute but style and the drag flag during a drag', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { root, handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const seen: string[] = []
    const observer = new MutationObserver((records) => {
      for (const record of records) seen.push(record.attributeName ?? '')
    })
    observer.observe(root, { attributes: true })
    handle.dispatchEvent(pointerEvent('pointerdown', 150, 110))
    for (let i = 1; i <= 10; i += 1) {
      handle.dispatchEvent(pointerEvent('pointermove', 150 + i * 10, 110 + i * 5))
      harness.flushFrames()
    }
    for (const record of observer.takeRecords()) seen.push(record.attributeName ?? '')
    observer.disconnect()
    expect(new Set(seen)).toEqual(new Set(['style', 'data-wm-dragging']))
  })

  it('writes width and height when the window is resized, not the transform', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const counts = spyStyle(root)
    harness.wm.resize('a', { width: 260 })
    expect(counts).toEqual({ transform: 0, width: 1, height: 0 })
  })

  it('still renames and restyles the element when the state really changes', () => {
    const harness = makeHarness()
    const { root } = harness.add({ id: 'a', title: 'One', x: 100, y: 100, width: 200, height: 150 })
    harness.wm.update('a', { title: 'Two', resizable: false })
    expect(root.getAttribute('aria-label')).toBe('Two')
    expect(harness.resizeHandle('a', 'se').style.display).toBe('none')
    harness.wm.maximize('a')
    expect(root.dataset.wmStage).toBe('maximized')
  })
})

describe('drag robustness', () => {
  it('never groups with a window whose titlebar is covered by another window', () => {
    const harness = makeHarness({ magnetism: false, snap: false, grouping: { dwell: 0 } })
    const c = harness.add({ id: 'c', x: 300, y: 300, width: 200, height: 150 })
    const b = harness.add({ id: 'b', x: 250, y: 250, width: 300, height: 300 })
    const body = document.createElement('div')
    b.root.append(body)
    const a = harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    document.elementsFromPoint = () => [a.handle, a.root, body, b.root, c.handle, c.root]

    a.handle.dispatchEvent(pointerEvent('pointerdown', 60, 20))
    a.handle.dispatchEvent(pointerEvent('pointermove', 350, 310))
    harness.flushFrames()
    a.handle.dispatchEvent(pointerEvent('pointermove', 352, 312))
    harness.flushFrames()

    expect(c.root.dataset.wmTabTarget).toBeUndefined()
    a.handle.dispatchEvent(pointerEvent('pointerup', 352, 312))
    expect(harness.wm.get('a')?.groupId).toBeNull()
  })

  it('still groups with the topmost window when its titlebar is under the pointer', () => {
    const harness = makeHarness({ magnetism: false, snap: false, grouping: { dwell: 0 } })
    const b = harness.add({ id: 'b', x: 250, y: 250, width: 300, height: 300 })
    const a = harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    document.elementsFromPoint = () => [a.handle, a.root, b.handle, b.root]

    a.handle.dispatchEvent(pointerEvent('pointerdown', 60, 20))
    a.handle.dispatchEvent(pointerEvent('pointermove', 350, 260))
    harness.flushFrames()
    a.handle.dispatchEvent(pointerEvent('pointermove', 352, 262))
    harness.flushFrames()
    a.handle.dispatchEvent(pointerEvent('pointerup', 352, 262))

    expect(harness.wm.get('a')?.groupId).not.toBeNull()
    expect(harness.wm.get('a')?.groupId).toBe(harness.wm.get('b')?.groupId)
  })

  it('leaves no phantom gesture when pointer capture throws', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const a = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const b = harness.add({ id: 'b', x: 400, y: 300, width: 200, height: 150 })
    const capture = Element.prototype.setPointerCapture
    Element.prototype.setPointerCapture = () => {
      throw new DOMException('No active pointer with the given id is found.', 'NotFoundError')
    }
    a.handle.dispatchEvent(pointerEvent('pointerdown', 150, 110, 7))
    harness.resizeHandle('a', 'se').dispatchEvent(pointerEvent('pointerdown', 300, 250, 8))
    Element.prototype.setPointerCapture = capture

    drag(harness, b.handle, [450, 310], [550, 410])
    b.handle.dispatchEvent(pointerEvent('pointerup', 550, 410))
    expect(harness.wm.get('b')?.bounds).toMatchObject({ x: 500, y: 400 })

    harness.wm.moveBy('a', 5, 0)
    harness.wm.moveBy('a', 5, 0)
    harness.wm.undo()
    expect(harness.wm.get('a')?.bounds.x).toBe(105)
  })

  it('cancels a drag whose pointer capture is lost', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const a = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const b = harness.add({ id: 'b', x: 400, y: 300, width: 200, height: 150 })

    drag(harness, a.handle, [150, 110], [250, 210])
    a.handle.dispatchEvent(pointerEvent('lostpointercapture', 250, 210))
    document.body.dispatchEvent(pointerEvent('pointerup', 250, 210))
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })

    drag(harness, b.handle, [450, 310], [550, 410])
    expect(harness.wm.get('b')?.bounds).toMatchObject({ x: 500, y: 400 })
  })

  it('cancels a resize whose pointer capture is lost', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const b = harness.add({ id: 'b', x: 400, y: 300, width: 200, height: 150 })
    const grip = harness.resizeHandle('a', 'e')

    grip.dispatchEvent(pointerEvent('pointerdown', 300, 150))
    grip.dispatchEvent(pointerEvent('pointermove', 360, 150))
    harness.flushFrames()
    grip.dispatchEvent(pointerEvent('lostpointercapture', 360, 150))
    expect(harness.wm.get('a')?.bounds.width).toBe(200)

    drag(harness, b.handle, [450, 310], [550, 410])
    expect(harness.wm.get('b')?.bounds).toMatchObject({ x: 500, y: 400 })
  })

  it('does not start a drag from a control inside a web component in the titlebar', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const a = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const widget = document.createElement('menu-button')
    const inner = document.createElement('button')
    widget.attachShadow({ mode: 'open' }).append(inner)
    a.handle.append(widget)

    const down = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 0,
      clientX: 150,
      clientY: 110,
    })
    Object.defineProperty(down, 'pointerId', { value: 1 })
    inner.dispatchEvent(down)
    a.handle.dispatchEvent(pointerEvent('pointermove', 250, 210))
    harness.flushFrames()

    expect(down.defaultPrevented).toBe(false)
    expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
  })
})

describe('frames inside windows', () => {
  function frameIn(root: HTMLElement): HTMLIFrameElement {
    const frame = document.createElement('iframe')
    root.append(frame)
    return frame
  }

  it('focuses the window whose frame took focus while the pointer was over it', () => {
    const harness = makeHarness()
    const a = harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    harness.add({ id: 'b', x: 300, y: 10, width: 200, height: 150 })
    const frame = frameIn(a.root)
    frame.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
    frame.focus()
    harness.flushFrames()
    expect(harness.wm.getState().focusedId).toBe('a')

    harness.wm.focus('b')
    a.handle.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
    harness.flushFrames()
    expect(harness.wm.getState().focusedId).toBe('b')
  })

  it('checks once more when the pointer leaves a frame and when the page loses focus', () => {
    vi.useFakeTimers()
    try {
      const harness = makeHarness()
      const a = harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
      harness.add({ id: 'b', x: 300, y: 10, width: 200, height: 150 })
      const frame = frameIn(a.root)
      frame.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
      frame.focus()
      a.handle.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
      expect(harness.wm.getState().focusedId).toBe('a')

      harness.wm.focus('b')
      frame.focus()
      window.dispatchEvent(new Event('blur'))
      vi.runAllTimers()
      expect(harness.wm.getState().focusedId).toBe('a')
    } finally {
      vi.useRealTimers()
    }
  })

  it('makes frames in the windows below a modal ignore the pointer while the modal is up', () => {
    const harness = makeHarness()
    const a = harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    const frame = frameIn(a.root)
    const m = harness.add({ id: 'm', x: 100, y: 100, width: 200, height: 150, layer: 'modal' })
    const own = frameIn(m.root)
    harness.wm.update('m', { title: 'sync' })
    expect(frame.style.pointerEvents).toBe('none')
    expect(own.style.pointerEvents).toBe('')

    frame.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
    frame.focus()
    harness.flushFrames()
    expect(harness.wm.getState().focusedId).toBe('m')

    harness.wm.close('m')
    expect(frame.style.pointerEvents).toBe('')
  })

  it('moves carried content with moveBefore where the browser has it', () => {
    const harness = makeHarness()
    const calls: Node[] = []
    const proto = Element.prototype as Element & { moveBefore?: (node: Node, child: null) => void }
    proto.moveBefore = function moveBefore(node: Node) {
      calls.push(node)
      this.append(node)
    }
    try {
      const plain = (ctx: { doc: Document }) => {
        const element = ctx.doc.createElement('section')
        const content = ctx.doc.createElement('div')
        content.dataset.wmContent = ''
        element.append(content)
        return { element, content }
      }
      harness.wm.open({ id: 'k' })
      const first = harness.desktop.mountWindow('k', plain)
      const kept = document.createElement('iframe')
      first.content.append(kept)
      const second = harness.desktop.mountWindow('k', plain)
      expect(calls).toEqual([kept])
      expect(second.content.contains(kept)).toBe(true)
    } finally {
      delete proto.moveBefore
    }
  })
})

describe('drop targets', () => {
  const ZONE = { x: 400, y: 0, width: 400, height: 600 }

  function withTarget(harness: Harness) {
    const commit = vi.fn()
    const hit = vi.fn((clientX: number, _clientY: number, id: string) =>
      clientX > 600 && id === 'a' ? { preview: ZONE, commit } : null,
    )
    const remove = harness.desktop.addDropTarget(hit)
    return { commit, hit, remove }
  }

  function previewOf(harness: Harness): HTMLElement | null {
    return harness.element.querySelector<HTMLElement>('[data-wm-snap-preview]')
  }

  it('previews the drop, commits it on release and wins over snapping', () => {
    const harness = makeHarness({ magnetism: false })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const { commit, hit } = withTarget(harness)

    drag(harness, handle, [150, 110], [799, 300])
    expect(hit).toHaveBeenLastCalledWith(799, 300, 'a')
    const preview = previewOf(harness) as HTMLElement
    expect(preview.hasAttribute('data-wm-drop')).toBe(true)
    expect(preview.style.display).toBe('block')
    expect(preview.style.width).toBe('400px')

    handle.dispatchEvent(pointerEvent('pointerup', 799, 300))
    expect(commit).toHaveBeenCalledTimes(1)
    expect(harness.wm.get('a')?.stage).toBe('normal')
    expect(preview.style.display).toBe('none')
  })

  it('hides the drop preview when the pointer leaves, and falls back to a snap preview', () => {
    const harness = makeHarness({ magnetism: false })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const { commit } = withTarget(harness)

    drag(harness, handle, [150, 110], [700, 300])
    handle.dispatchEvent(pointerEvent('pointermove', 400, 300))
    harness.flushFrames()
    expect(previewOf(harness)?.style.display).toBe('none')
    handle.dispatchEvent(pointerEvent('pointermove', 1, 300))
    harness.flushFrames()
    expect(previewOf(harness)?.hasAttribute('data-wm-drop')).toBe(false)
    expect(previewOf(harness)?.style.display).toBe('block')
    handle.dispatchEvent(pointerEvent('pointerup', 1, 300))
    expect(commit).not.toHaveBeenCalled()
    expect(harness.wm.get('a')?.snapZone).toBe('left')
  })

  it('shows the drop preview even with the snap preview turned off, and stops when removed', () => {
    const harness = makeHarness({ magnetism: false, snap: { preview: false } })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const { commit, remove } = withTarget(harness)

    drag(harness, handle, [150, 110], [700, 300])
    expect(previewOf(harness)?.style.display).toBe('block')
    handle.dispatchEvent(pointerEvent('pointerup', 700, 300))
    expect(commit).toHaveBeenCalledTimes(1)

    remove()
    remove()
    drag(harness, handle, [700, 310], [720, 320])
    handle.dispatchEvent(pointerEvent('pointerup', 720, 320))
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('asks every target in turn and takes the first hit', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const miss = vi.fn(() => null)
    harness.desktop.addDropTarget(miss)
    const { commit } = withTarget(harness)
    drag(harness, handle, [150, 110], [700, 300])
    handle.dispatchEvent(pointerEvent('pointerup', 700, 300))
    expect(miss).toHaveBeenCalled()
    expect(commit).toHaveBeenCalledTimes(1)
  })
})

describe('cancelling out of a rectangle', () => {
  const HALF = { x: 0.5, y: 0, width: 0.5, height: 1 }

  it('puts a cancelled drag back into its rectangle', () => {
    const harness = makeHarness({ magnetism: false, snap: false })
    const { handle } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    harness.wm.snapTo('a', HALF)
    const snapped = harness.wm.get('a')?.bounds

    drag(harness, handle, [450, 10], [300, 200])
    expect(harness.wm.get('a')?.stage).toBe('normal')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(harness.wm.get('a')).toMatchObject({ stage: 'snapped', snapRect: HALF })
    expect(harness.wm.get('a')?.bounds).toEqual(snapped)
  })

  it('puts a cancelled resize back into its rectangle', () => {
    const harness = makeHarness()
    harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    harness.wm.snapTo('a', HALF)
    const snapped = harness.wm.get('a')?.bounds
    const handle = harness.resizeHandle('a', 'w')

    handle.dispatchEvent(pointerEvent('pointerdown', 400, 300))
    handle.dispatchEvent(pointerEvent('pointermove', 300, 300))
    harness.flushFrames()
    expect(harness.wm.get('a')?.stage).toBe('normal')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(harness.wm.get('a')).toMatchObject({ stage: 'snapped', snapRect: HALF })
    expect(harness.wm.get('a')?.bounds).toEqual(snapped)
  })
})
