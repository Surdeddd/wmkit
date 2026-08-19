// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowInit, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController, DesktopOptions } from '../../src/dom/shared'
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
    expect(root.getAttribute('aria-labelledby')).toBe('wmkit-title-a')
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
