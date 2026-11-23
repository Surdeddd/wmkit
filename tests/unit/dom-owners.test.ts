// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowInit, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController, DesktopOptions } from '../../src/dom/shared'

const VIEWPORT = { width: 800, height: 600 }
const FRAMED =
  '<header data-wm-drag><span data-wm-title>t</span></header><button type="button">go</button><iframe></iframe>'

function pointerEvent(type: string, x: number, y: number): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
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
  button: HTMLButtonElement
  frame: HTMLIFrameElement
}

interface Harness {
  wm: WindowManager
  desktop: DesktopController
  element: HTMLElement
  add(init: WindowInit & { id: string }): Added
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
    add(init) {
      wm.open(init)
      const root = document.createElement('section')
      root.innerHTML = FRAMED
      element.append(root)
      desktop.attachWindow(init.id, root)
      return {
        root,
        handle: root.querySelector('[data-wm-drag]') as HTMLElement,
        button: root.querySelector('button') as HTMLButtonElement,
        frame: root.querySelector('iframe') as HTMLIFrameElement,
      }
    },
    flush() {
      for (const frame of frames.splice(0)) frame()
    },
  }
}

function placeTitlebar(handle: HTMLElement, left: number, top: number): void {
  const box = { left, top, right: left + 200, bottom: top + 30, x: left, y: top, width: 200 }
  handle.getBoundingClientRect = () => ({ ...box, height: 30 }) as DOMRect
}

function press(target: HTMLElement): MouseEvent {
  target.dispatchEvent(pointerEvent('pointerdown', 30, 30))
  const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true })
  target.dispatchEvent(down)
  return down
}

function scene() {
  const h = makeHarness()
  const other = h.add({ id: 'other', x: 500, y: 20, width: 200, height: 150 })
  const doc = h.add({ id: 'doc', x: 20, y: 20, width: 300, height: 200 })
  const find = h.add({ id: 'find', owner: 'doc', x: 40, y: 260, width: 200, height: 150 })
  const ask = h.add({
    id: 'ask',
    owner: 'doc',
    layer: 'modal',
    x: 60,
    y: 60,
    width: 200,
    height: 150,
  })
  return { h, other, doc, find, ask }
}

afterEach(() => {
  frames.length = 0
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('an owned window on the page', () => {
  it('carries the id of its owner, and a window without one carries nothing', () => {
    const h = makeHarness()
    const doc = h.add({ id: 'doc' })
    const find = h.add({ id: 'find', owner: 'doc' })
    expect(find.root.dataset.wmOwner).toBe('doc')
    expect(doc.root.dataset.wmOwner).toBeUndefined()
  })

  it('says it is modal for assistive technology only when it rules the whole desktop', () => {
    const h = makeHarness()
    const dialog = h.add({ id: 'dialog', layer: 'modal' })
    const sheet = h.add({ id: 'sheet', owner: 'dialog', layer: 'modal' })
    expect(dialog.root.getAttribute('aria-modal')).toBe('true')
    expect(sheet.root.getAttribute('aria-modal')).toBeNull()
  })
})

describe('the family of a modal child on the page', () => {
  it('shields the frames of the windows the modal blocks and of nothing else', () => {
    const { h, other, doc, find, ask } = scene()
    expect([doc, find].map((win) => win.frame.style.pointerEvents)).toEqual(['none', 'none'])
    expect([ask, other].map((win) => win.frame.style.pointerEvents)).toEqual(['', ''])
    const pick = h.add({ id: 'pick', owner: 'ask' })
    expect(pick.frame.style.pointerEvents).toBe('')
    h.wm.close('ask')
    expect([doc, find].map((win) => win.frame.style.pointerEvents)).toEqual(['', ''])
  })

  it('swallows a press on a blocked window, flashes the modal and gives it the focus', () => {
    const { h, other, doc, ask } = scene()
    h.wm.focus('other')
    other.button.focus()
    const down = press(doc.button)
    expect(down.defaultPrevented).toBe(true)
    expect(ask.root.dataset.wmFlash).toBe('')
    expect(h.wm.getState().focusedId).toBe('ask')
    expect(h.wm.getState().order).toEqual(['other', 'doc', 'find', 'ask'])
    expect(ask.root.contains(document.activeElement)).toBe(true)
  })

  it('does not let a blocked window be dragged', () => {
    const { h, doc } = scene()
    doc.handle.dispatchEvent(pointerEvent('pointerdown', 30, 30))
    doc.handle.dispatchEvent(pointerEvent('pointermove', 200, 220))
    h.flush()
    expect(h.wm.get('doc')?.bounds).toMatchObject({ x: 20, y: 20 })
    expect(doc.root.dataset.wmDragging).toBeUndefined()
  })

  it('hands the keyboard back to the modal when the focus lands in a blocked window', () => {
    const { h, doc, ask } = scene()
    doc.button.focus()
    expect(ask.root.contains(document.activeElement)).toBe(true)
    expect(h.wm.getState().focusedId).toBe('ask')
  })

  it('leaves the rest of the desktop to the pointer and the keyboard', () => {
    const { h, other } = scene()
    const down = press(other.button)
    expect(down.defaultPrevented).toBe(false)
    expect(h.wm.getState().focusedId).toBe('other')
    other.button.focus()
    expect(document.activeElement).toBe(other.button)
  })

  it('blocks a window that sits above the modal without being owned by it', () => {
    const { h, find, ask } = scene()
    h.wm.update('ask', { layer: 'normal' })
    h.wm.focus('find')
    h.wm.update('ask', { layer: 'modal' })
    expect(h.wm.getState().focusedId).toBe('ask')
    expect(find.frame.style.pointerEvents).toBe('none')
    expect(ask.frame.style.pointerEvents).toBe('')
  })
})

describe('a window that a modal blocks', () => {
  const marked = (h: Harness) =>
    [...h.element.querySelectorAll<HTMLElement>('[data-wm-blocked]')].map(
      (node) => node.dataset.wmWindow,
    )

  it('is marked on the page while the modal of its family is up', () => {
    const { h } = scene()
    expect(marked(h)).toEqual(['doc', 'find'])
    h.wm.minimize('ask')
    expect(marked(h)).toEqual(['doc', 'find'])
    h.wm.close('ask')
    expect(marked(h)).toEqual([])
  })

  it('is marked under a modal of the whole desktop, and unmarked when it is detached', () => {
    const h = makeHarness()
    h.add({ id: 'plain' })
    h.add({ id: 'dialog', layer: 'modal' })
    h.add({ id: 'picker', owner: 'dialog' })
    expect(marked(h)).toEqual(['plain'])
    const plain = h.element.querySelector('[data-wm-window="plain"]') as HTMLElement
    h.desktop.destroy()
    expect(plain.dataset.wmBlocked).toBeUndefined()
  })
})

describe('a family and tab groups on the page', () => {
  it('never groups a member of a family, dragged or under the pointer', () => {
    const h = makeHarness({ grouping: { dwell: 0 } })
    const target = h.add({ id: 'target', x: 400, y: 400, width: 200, height: 150 })
    const child = h.add({ id: 'child', owner: 'target', x: 600, y: 100, width: 150, height: 100 })
    const moving = h.add({ id: 'moving', x: 10, y: 10, width: 200, height: 150 })
    placeTitlebar(target.handle, 400, 400)
    moving.handle.dispatchEvent(pointerEvent('pointerdown', 60, 20))
    moving.handle.dispatchEvent(pointerEvent('pointermove', 450, 410))
    h.flush()
    expect(target.root.dataset.wmTabTarget).toBeUndefined()
    moving.handle.dispatchEvent(pointerEvent('pointercancel', 450, 410))

    const free = h.add({ id: 'free', x: 100, y: 300, width: 200, height: 150 })
    placeTitlebar(free.handle, 100, 300)
    child.handle.dispatchEvent(pointerEvent('pointerdown', 610, 110))
    child.handle.dispatchEvent(pointerEvent('pointermove', 150, 310))
    h.flush()
    expect(free.root.dataset.wmTabTarget).toBeUndefined()
    child.handle.dispatchEvent(pointerEvent('pointercancel', 150, 310))

    target.handle.dispatchEvent(pointerEvent('pointerdown', 410, 410))
    target.handle.dispatchEvent(pointerEvent('pointermove', 150, 310))
    h.flush()
    expect(free.root.dataset.wmTabTarget).toBeUndefined()
    target.handle.dispatchEvent(pointerEvent('pointercancel', 150, 310))

    moving.handle.dispatchEvent(pointerEvent('pointerdown', 60, 20))
    moving.handle.dispatchEvent(pointerEvent('pointermove', 150, 310))
    h.flush()
    expect(free.root.dataset.wmTabTarget).toBe('')
  })
})
