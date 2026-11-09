// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowInit, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController, DesktopOptions, WindowSkin } from '../../src/dom/shared'

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

afterEach(() => {
  frames.length = 0
  vi.unstubAllGlobals()
  document.body.replaceChildren()
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
