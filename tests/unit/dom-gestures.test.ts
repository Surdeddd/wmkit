// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowInit, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController, DesktopOptions, WindowSkin } from '../../src/dom/shared'
import { createDock, dockLayout } from '../../src/plugins/dock'

const VIEWPORT = { width: 800, height: 600 }
const TRASH = { x: 600, y: 400, width: 200, height: 200 }

function pointerEvent(type: string, x: number, y: number, pointerId = 1): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
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

const frames: Array<() => void> = []

interface Added {
  root: HTMLElement
  handle: HTMLElement
  detach: () => void
}

interface Harness {
  wm: WindowManager
  desktop: DesktopController
  element: HTMLElement
  add(init: WindowInit & { id: string }, html?: string): Added
  grip(id: string, direction: string): HTMLElement
  flush(): void
}

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
  const desktop = attachDesktop(wm, element, {
    autoViewport: false,
    announce: false,
    magnetism: false,
    snap: false,
    ...options,
  })
  return {
    wm,
    desktop,
    element,
    add(init, html = '<header data-wm-drag><span data-wm-title>t</span></header>') {
      wm.open(init)
      const root = document.createElement('section')
      root.innerHTML = html
      element.append(root)
      const detach = desktop.attachWindow(init.id, root)
      return { root, handle: root.querySelector('[data-wm-drag]') as HTMLElement, detach }
    },
    grip(id, direction) {
      return element.querySelector(
        `[data-wm-window="${id}"] [data-wm-resize="${direction}"]`,
      ) as HTMLElement
    },
    flush() {
      for (const frame of frames.splice(0)) frame()
    },
  }
}

function dragTo(h: Harness, handle: HTMLElement, from: [number, number], to: [number, number]) {
  handle.dispatchEvent(pointerEvent('pointerdown', from[0], from[1]))
  handle.dispatchEvent(pointerEvent('pointermove', to[0], to[1]))
  h.flush()
}

function placeTitlebar(handle: HTMLElement, left: number, top: number, width = 200, height = 30) {
  const box = {
    left,
    top,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    width,
    height,
  }
  const read = vi.fn(() => box as DOMRect)
  handle.getBoundingClientRect = read
  return read
}

function escape(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  document.dispatchEvent(event)
  return event
}

const realElementsFromPoint = document.elementsFromPoint

afterEach(() => {
  frames.length = 0
  vi.unstubAllGlobals()
  document.elementsFromPoint = realElementsFromPoint
  document.body.replaceChildren()
})

describe('finding a tab group target', () => {
  function scene() {
    const h = makeHarness({ grouping: { dwell: 0 } })
    document.elementsFromPoint = () => {
      throw new Error('the page is hit-tested')
    }
    const target = h.add({ id: 'target', x: 400, y: 400, width: 200, height: 150 })
    const moving = h.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
    return { h, target, moving }
  }

  it('finds the window from the manager bounds and measures only its titlebar', () => {
    const { h, target, moving } = scene()
    const read = placeTitlebar(target.handle, 400, 400)
    const seen: string[] = []
    read.mockImplementation(() => {
      seen.push(moving.root.style.transform)
      return { left: 400, top: 400, right: 600, bottom: 430 } as DOMRect
    })

    moving.handle.dispatchEvent(pointerEvent('pointerdown', 60, 20))
    for (const x of [440, 450, 460]) {
      moving.handle.dispatchEvent(pointerEvent('pointermove', x, 410))
      h.flush()
    }
    expect(target.root.dataset.wmTabTarget).toBe('')
    moving.handle.dispatchEvent(pointerEvent('pointerup', 460, 410))

    expect(h.wm.get('moving')?.groupId).toBe(h.wm.get('target')?.groupId)
    expect(h.wm.get('moving')?.groupId).not.toBeNull()
    expect(seen).toEqual(['translate3d(10px, 10px, 0)'])
  })

  it('measures the titlebar again in a new gesture and after the page scrolls', () => {
    const { h, target, moving } = scene()
    const read = placeTitlebar(target.handle, 400, 400)
    dragTo(h, moving.handle, [60, 20], [450, 410])
    window.dispatchEvent(new Event('scroll'))
    moving.handle.dispatchEvent(pointerEvent('pointermove', 452, 412))
    h.flush()
    moving.handle.dispatchEvent(pointerEvent('pointercancel', 452, 412))
    dragTo(h, moving.handle, [60, 20], [450, 410])
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('never groups through a window that covers the titlebar, nor with a hidden one', () => {
    const { h, target, moving } = scene()
    placeTitlebar(target.handle, 400, 400)
    h.add({ id: 'cover', x: 380, y: 380, width: 300, height: 300 })
    h.wm.focus('moving')
    dragTo(h, moving.handle, [60, 20], [450, 410])
    expect(target.root.dataset.wmTabTarget).toBeUndefined()
    moving.handle.dispatchEvent(pointerEvent('pointercancel', 450, 410))

    h.wm.minimize('cover')
    h.wm.open({ id: 'ghost', x: 380, y: 380, width: 300, height: 300 })
    h.wm.focus('moving')
    dragTo(h, moving.handle, [60, 20], [450, 410])
    expect(target.root.dataset.wmTabTarget).toBe('')
  })

  it('leaves the target alone when the pointer misses its titlebar or it has none', () => {
    const { h, target, moving } = scene()
    placeTitlebar(target.handle, 400, 400)
    dragTo(h, moving.handle, [60, 20], [450, 500])
    expect(target.root.dataset.wmTabTarget).toBeUndefined()
    moving.handle.dispatchEvent(pointerEvent('pointercancel', 450, 500))

    const bare = h.add({ id: 'bare', x: 100, y: 300, width: 200, height: 150 }, '<div></div>')
    h.wm.focus('moving')
    dragTo(h, moving.handle, [60, 20], [150, 310])
    expect(bare.root.dataset.wmTabTarget).toBeUndefined()
    expect(h.element.querySelector('[data-wm-tab-target]')).toBeNull()
  })
})

describe('a gesture whose window closes', () => {
  function trash(h: Harness, commit: (id: string) => void) {
    h.desktop.addDropTarget((x, y, id) =>
      x >= TRASH.x && y >= TRASH.y ? { preview: TRASH, commit: () => commit(id) } : null,
    )
  }

  it('keeps the close undoable when a drop target closes the dragged window', () => {
    const h = makeHarness()
    const a = h.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    h.add({ id: 'b', x: 50, y: 300, width: 200, height: 150 })
    h.wm.focus('a')
    h.wm.clearHistory()
    trash(h, (id) => h.wm.close(id))

    dragTo(h, a.handle, [150, 110], [650, 450])
    a.handle.dispatchEvent(pointerEvent('pointerup', 650, 450))

    expect(h.wm.get('a')).toBeUndefined()
    expect(h.wm.canUndo()).toBe(true)
    h.wm.undo()
    expect(h.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
    expect(h.wm.canUndo()).toBe(false)
  })

  it('keeps a commit that minimizes and detaches the window', () => {
    const h = makeHarness()
    const a = h.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    h.wm.clearHistory()
    trash(h, (id) => {
      h.wm.minimize(id)
      a.detach()
    })

    dragTo(h, a.handle, [150, 110], [650, 450])
    a.handle.dispatchEvent(pointerEvent('pointerup', 650, 450))

    expect(h.wm.get('a')?.stage).toBe('minimized')
    expect(a.root.dataset.wmDragging).toBeUndefined()
    expect(h.wm.canUndo()).toBe(true)
  })

  it('runs a commit that rebuilds the skin exactly once', () => {
    const skin =
      (tag: string): WindowSkin =>
      ({ doc }) => {
        const element = doc.createElement(tag)
        element.innerHTML = '<header data-wm-drag></header><div data-wm-content></div>'
        return { element, content: element.lastElementChild as HTMLElement }
      }
    const h = makeHarness({ skins: { plain: skin('section'), compact: skin('article') } })
    h.wm.open({ id: 'a', x: 100, y: 100, width: 200, height: 150, meta: { skin: 'plain' } })
    const mounted = h.desktop.mountWindow('a', 'plain')
    let commits = 0
    trash(h, (id) => {
      commits += 1
      h.wm.update(id, { meta: { skin: 'compact' } })
    })
    const handle = mounted.element.querySelector('[data-wm-drag]') as HTMLElement
    dragTo(h, handle, [150, 110], [650, 450])
    handle.dispatchEvent(pointerEvent('pointerup', 650, 450))

    expect(commits).toBe(1)
    expect(mounted.element.localName).toBe('article')
  })

  it('keeps a window the app closes in the middle of its drag undoable', () => {
    const h = makeHarness()
    const a = h.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    h.add({ id: 'b', x: 400, y: 300, width: 200, height: 150 })
    h.wm.focus('a')
    h.wm.clearHistory()
    let commits = 0
    trash(h, () => {
      commits += 1
    })

    dragTo(h, a.handle, [150, 110], [650, 450])
    a.handle.dispatchEvent(pointerEvent('pointermove', 660, 460))
    h.wm.close('a')

    expect(commits).toBe(0)
    expect(a.root.dataset.wmDragging).toBeUndefined()
    expect(h.wm.canUndo()).toBe(true)
    h.wm.undo()
    expect(h.wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
    dragTo(
      h,
      h.element.querySelector('[data-wm-window="b"] [data-wm-drag]') as HTMLElement,
      [450, 310],
      [460, 320],
    )
    expect(h.wm.get('b')?.bounds).toMatchObject({ x: 410, y: 310 })
  })

  it('keeps a window the app closes in the middle of its resize undoable', () => {
    const h = makeHarness()
    h.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    h.wm.clearHistory()
    const grip = h.grip('a', 'se')
    grip.dispatchEvent(pointerEvent('pointerdown', 300, 250))
    grip.dispatchEvent(pointerEvent('pointermove', 360, 300))
    h.flush()
    grip.dispatchEvent(pointerEvent('pointermove', 380, 320))
    h.wm.close('a')

    expect(h.wm.canUndo()).toBe(true)
    h.wm.undo()
    expect(h.wm.get('a')?.bounds).toMatchObject({ width: 200, height: 150 })
  })
})

describe('escape from a drag', () => {
  const RECT = { x: 0.5, y: 0, width: 0.5, height: 1 }
  const shape = (h: Harness) => {
    const { stage, bounds, restoreBounds, snapZone, snapRect } = h.wm.get('a') ?? {}
    return { stage, bounds, restoreBounds, snapZone, snapRect }
  }

  it('puts a window maximized over a snap rectangle back exactly as it was', () => {
    const h = makeHarness()
    const { handle } = h.add({ id: 'a', x: 100, y: 100, width: 300, height: 200 })
    h.wm.snapTo('a', RECT)
    h.wm.maximize('a')
    const before = shape(h)

    dragTo(h, handle, [400, 10], [420, 60])
    expect(h.wm.get('a')?.stage).toBe('normal')
    escape()

    expect(shape(h)).toEqual(before)
    h.wm.restore('a')
    expect(h.wm.get('a')).toMatchObject({ stage: 'snapped', snapRect: RECT })
  })

  it('puts a plainly maximized and a zone-snapped window back exactly as they were', () => {
    const h = makeHarness()
    const { handle } = h.add({ id: 'a', x: 100, y: 100, width: 300, height: 200 })
    h.wm.maximize('a')
    let before = shape(h)
    dragTo(h, handle, [400, 10], [420, 60])
    escape()
    expect(shape(h)).toEqual(before)

    h.wm.restore('a')
    h.wm.snap('a', 'left')
    before = shape(h)
    dragTo(h, handle, [100, 10], [420, 260])
    escape()
    expect(shape(h)).toEqual(before)
  })

  it('puts a dragged maximized dock panel back into its place', () => {
    const element = document.createElement('div')
    document.body.append(element)
    stubPointerCapture()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(() => callback(0))
      return frames.length
    })
    const wm = createWindowManager({ viewport: { width: 1000, height: 600 } })
    const desktop = attachDesktop(wm, element, {
      autoViewport: false,
      announce: false,
      magnetism: false,
    })
    const dock = createDock(desktop)
    const add = (id: string) => {
      wm.open({ id, x: 10, y: 10, width: 300, height: 200 })
      const root = document.createElement('section')
      root.innerHTML = '<header data-wm-drag><span data-wm-title></span></header><div></div>'
      element.append(root)
      desktop.attachWindow(id, root)
      return root
    }
    add('a')
    const b = add('b')
    dock.dock('a')
    dock.dock('b', { side: 'right' })
    wm.maximize('b')
    const handle = b.querySelector('[data-wm-drag]') as HTMLElement

    handle.dispatchEvent(pointerEvent('pointerdown', 500, 10))
    handle.dispatchEvent(pointerEvent('pointermove', 400, 200))
    for (const frame of frames.splice(0)) frame()
    escape()

    expect(wm.get('b')).toMatchObject({ stage: 'maximized' })
    expect(wm.get('b')?.snapRect).not.toBeNull()
    expect(dockLayout.windowsOf(dock.layout())).toEqual(['a', 'b'])
    wm.restore('b')
    expect(wm.get('b')).toMatchObject({ stage: 'snapped', bounds: { x: 503 } })
    expect(dockLayout.windowsOf(dock.layout())).toEqual(['a', 'b'])
  })
})

describe('a held arrow key', () => {
  function key(target: EventTarget, type: string, name: string, init: KeyboardEventInit = {}) {
    target.dispatchEvent(new KeyboardEvent(type, { key: name, bubbles: true, ...init }))
  }

  function hold(target: EventTarget, name: string, repeats: number, init: KeyboardEventInit = {}) {
    for (let i = 0; i <= repeats; i += 1) key(target, 'keydown', name, { ...init, repeat: i > 0 })
  }

  function steps(wm: WindowManager): number {
    let count = 0
    while (wm.undo()) count += 1
    return count
  }

  it('moves the window in one undo step however long it is held', () => {
    const h = makeHarness()
    const { root } = h.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    h.wm.clearHistory()
    hold(root, 'ArrowRight', 29)
    expect(h.wm.get('a')?.bounds.x).toBe(100 + 30 * 16)
    key(root, 'keyup', 'ArrowRight')
    expect(steps(h.wm)).toBe(1)
    expect(h.wm.get('a')?.bounds.x).toBe(100)
  })

  it('starts a new step on a new press, another key, a resize press or a lost focus', () => {
    const h = makeHarness()
    const { root } = h.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    h.wm.clearHistory()
    hold(root, 'ArrowRight', 3)
    key(root, 'keyup', 'ArrowRight')
    hold(root, 'ArrowRight', 3)
    hold(root, 'ArrowDown', 3)
    key(root, 'keydown', 'Shift', { shiftKey: true })
    hold(root, 'ArrowDown', 3, { shiftKey: true })
    root.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    hold(root, 'ArrowLeft', 2)
    window.dispatchEvent(new Event('blur'))
    hold(root, 'ArrowUp', 2)
    key(root, 'keyup', 'ArrowUp')
    expect(steps(h.wm)).toBe(6)
  })

  it('lets go when the desktop is destroyed or the window detached mid hold', () => {
    const h = makeHarness()
    const a = h.add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    h.add({ id: 'b', x: 400, y: 100, width: 200, height: 150 })
    h.wm.clearHistory()
    hold(a.root, 'ArrowRight', 2)
    a.detach()
    h.wm.move('b', 10, 10)
    h.wm.move('b', 20, 20)
    h.wm.undo()
    expect(h.wm.get('b')?.bounds).toMatchObject({ x: 10, y: 10 })

    const other = makeHarness()
    const c = other.add({ id: 'c', x: 100, y: 100, width: 200, height: 150 })
    hold(c.root, 'ArrowRight', 2)
    other.desktop.destroy()
    other.wm.move('c', 10, 10)
    other.wm.move('c', 20, 20)
    other.wm.undo()
    expect(other.wm.get('c')?.bounds).toMatchObject({ x: 10, y: 10 })
  })
})
