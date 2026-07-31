// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowInit, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController, DesktopOptions } from '../../src/dom/shared'

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
  add(init: WindowInit & { id: string }): { root: HTMLElement; handle: HTMLElement }
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
      desktop.attachWindow(init.id, root)
      const handle = root.querySelector<HTMLElement>('[data-wm-drag]') as HTMLElement
      return { root, handle }
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

afterEach(() => {
  frames.length = 0
  vi.unstubAllGlobals()
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

  it('does not group when the gesture is disabled', () => {
    const harness = makeHarness({ magnetism: false, snap: false, grouping: false })
    harness.add({ id: 'target', x: 400, y: 400, width: 200, height: 150 })
    const { handle } = harness.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
    document.elementsFromPoint = () => [harness.handleOf('target')]

    drag(harness, handle, [60, 20], [450, 410])
    handle.dispatchEvent(pointerEvent('pointerup', 450, 410))
    expect(harness.wm.get('moving')?.groupId).toBeNull()
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

  it('refuses to attach an unknown or already attached window', () => {
    const harness = makeHarness()
    harness.add({ id: 'a' })
    const stray = document.createElement('section')
    expect(() => harness.desktop.attachWindow('ghost', stray)).toThrow(/unknown window/)
    expect(() => harness.desktop.attachWindow('a', stray)).toThrow(/already attached/)
  })
})
