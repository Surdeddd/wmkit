// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowInit, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController, DesktopOptions } from '../../src/dom/shared'
import type { AnimationOptions, GroupingOptions, StackingOptions } from '../../src/index'

const VIEWPORT = { width: 800, height: 600 }

const frames = new Map<number, FrameRequestCallback>()
let frameSeq = 0

function pointerOn(target: EventTarget, type: string): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true }))
}

function stubFrames(): void {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameSeq, callback)
    return frameSeq
  })
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => frames.delete(handle))
}

function flushFrames(): void {
  const due = [...frames.values()]
  frames.clear()
  for (const frame of due) frame(0)
}

interface Harness {
  wm: WindowManager
  desktop: DesktopController
  element: HTMLElement
  add(init: WindowInit & { id: string }, html?: string): HTMLElement
  detach(id: string): void
}

function makeHarness(options: DesktopOptions = {}, element = document.createElement('div')) {
  stubFrames()
  if (!element.isConnected) document.body.append(element)
  const wm = createWindowManager({ viewport: VIEWPORT })
  const desktop = attachDesktop(wm, element, { autoViewport: false, announce: false, ...options })
  const detachers = new Map<string, () => void>()
  const harness: Harness = {
    wm,
    desktop,
    element,
    add(init, html = '<header data-wm-drag><span data-wm-title>t</span></header>') {
      wm.open(init)
      const root = document.createElement('section')
      root.innerHTML = html
      element.append(root)
      detachers.set(init.id, desktop.attachWindow(init.id, root))
      return root
    },
    detach(id) {
      detachers.get(id)?.()
    },
  }
  return harness
}

function observeResizes(): { notify(): void; observed: Element[] } {
  const api = { notify: () => {}, observed: [] as Element[] }
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        api.notify = callback
      }
      observe(target: Element) {
        api.observed.push(target)
      }
      disconnect() {
        api.observed.length = 0
      }
    },
  )
  return api
}

function sizeOf(element: HTMLElement, width: number, height: number): void {
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: height })
}

afterEach(() => {
  frames.clear()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('option types', () => {
  it('names every nested desktop option from the package entry', () => {
    const grouping: GroupingOptions = { dwell: 200 }
    const stacking: StackingOptions = { base: 10, gap: 4, isolate: false, deep: 6 }
    const animation: AnimationOptions = { duration: 120, easing: 'linear' }
    const options: DesktopOptions = { grouping, stacking, animation }
    expect(options.stacking?.deep).toBe(6)
  })
})

describe('windows follow a resizing desktop live', () => {
  function liveDesktop() {
    const resizes = observeResizes()
    const element = document.createElement('div')
    sizeOf(element, 800, 600)
    const harness = makeHarness({ autoViewport: true }, element)
    const a = harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    const b = harness.add({ id: 'b', x: 300, y: 10, width: 200, height: 150 })
    harness.wm.maximize('b')
    return { ...harness, resizes, a, b }
  }

  it('marks every window live before the manager learns the new size', () => {
    const h = liveDesktop()
    const seen: Array<string | undefined> = []
    h.wm.on('resize', () => seen.push(h.b.dataset.wmLive))
    sizeOf(h.element, 700, 600)
    h.resizes.notify()

    expect(h.wm.getState().viewport).toEqual({ width: 700, height: 600 })
    expect(seen).toEqual([''])
    expect(h.a.dataset.wmLive).toBe('')
    expect(h.b.dataset.wmLive).toBe('')
  })

  it('drops the mark once the frame after the last change has been drawn', () => {
    const h = liveDesktop()
    sizeOf(h.element, 700, 600)
    h.resizes.notify()
    flushFrames()
    expect(h.b.dataset.wmLive).toBe('')
    flushFrames()
    expect(h.b.dataset.wmLive).toBeUndefined()
    expect(h.a.dataset.wmLive).toBeUndefined()
  })

  it('re-arms on every further change and writes the attribute only twice', () => {
    const h = liveDesktop()
    const writes: MutationRecord[] = []
    const observer = new MutationObserver((records) => writes.push(...records))
    observer.observe(h.b, { attributes: true, attributeFilter: ['data-wm-live'] })
    for (const width of [790, 780, 770]) {
      sizeOf(h.element, width, 600)
      h.resizes.notify()
      flushFrames()
    }
    expect(h.b.dataset.wmLive).toBe('')
    flushFrames()
    expect(h.b.dataset.wmLive).toBeUndefined()
    writes.push(...observer.takeRecords())
    observer.disconnect()
    expect(writes).toHaveLength(2)
  })

  it('leaves windows alone when the desktop reports the size it already has', () => {
    const h = liveDesktop()
    h.resizes.notify()
    expect(h.a.dataset.wmLive).toBeUndefined()
  })

  it('never takes away a live mark that someone else put on a window', () => {
    const h = liveDesktop()
    h.a.dataset.wmLive = ''
    sizeOf(h.element, 700, 600)
    h.resizes.notify()
    flushFrames()
    flushFrames()
    expect(h.a.dataset.wmLive).toBe('')
    expect(h.b.dataset.wmLive).toBeUndefined()
  })

  it('clears the mark when the desktop is destroyed mid resize', () => {
    const h = liveDesktop()
    sizeOf(h.element, 700, 600)
    h.resizes.notify()
    h.desktop.destroy()
    expect(h.b.dataset.wmLive).toBeUndefined()
    expect(h.resizes.observed).toHaveLength(0)
  })

  it('measures the desktop once where ResizeObserver is missing', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const element = document.createElement('div')
    sizeOf(element, 640, 480)
    const h = makeHarness({ autoViewport: true }, element)
    expect(h.wm.getState().viewport).toEqual({ width: 640, height: 480 })
    expect(() => h.desktop.destroy()).not.toThrow()
  })
})

describe('windows deep in the stack', () => {
  function deepOf(h: Harness): string[] {
    return [...h.element.querySelectorAll<HTMLElement>('[data-wm-deep]')].map(
      (node) => node.dataset.wmWindow as string,
    )
  }

  function stack(h: Harness, count: number): HTMLElement[] {
    const roots: HTMLElement[] = []
    for (let i = 0; i < count; i += 1) {
      roots.push(h.add({ id: `w${i}`, x: i * 4, y: i * 4, width: 200, height: 150 }))
    }
    return roots
  }

  it('marks the visible windows more than twelve places below the top', () => {
    const h = makeHarness()
    stack(h, 15)
    expect(deepOf(h)).toEqual(['w0', 'w1'])
  })

  it('follows the stacking order and skips hidden windows when it counts', () => {
    const h = makeHarness({ stacking: { deep: 2 } })
    stack(h, 5)
    expect(deepOf(h)).toEqual(['w0', 'w1'])

    h.wm.focus('w0')
    expect(deepOf(h)).toEqual(['w1', 'w2'])

    h.wm.minimize('w4')
    expect(deepOf(h)).toEqual(['w1'])

    h.wm.moveToWorkspace('w3', 1)
    expect(deepOf(h)).toEqual([])
  })

  it('writes the attribute only when a window crosses the line, never per drag frame', () => {
    const h = makeHarness({ stacking: { deep: 1 } })
    const roots = stack(h, 4)
    const writes: MutationRecord[] = []
    const observer = new MutationObserver((records) => writes.push(...records))
    for (const root of roots) {
      observer.observe(root, { attributes: true, attributeFilter: ['data-wm-deep'] })
    }
    for (let i = 0; i < 20; i += 1) h.wm.move('w3', 100 + i, 100)
    h.wm.update('w2', { title: 'renamed' })
    writes.push(...observer.takeRecords())
    expect(writes).toHaveLength(0)

    h.wm.focus('w1')
    writes.push(...observer.takeRecords())
    observer.disconnect()
    expect(writes.map((record) => (record.target as HTMLElement).dataset.wmWindow)).toEqual([
      'w1',
      'w2',
    ])
  })

  it('takes the mark off a detached window and recounts the rest on the next change', () => {
    const h = makeHarness({ stacking: { deep: 1 } })
    const roots = stack(h, 4)
    h.detach('w0')
    expect((roots[0] as HTMLElement).hasAttribute('data-wm-deep')).toBe(false)
    h.detach('w3')
    h.wm.update('w2', { title: 'renamed' })
    expect(deepOf(h)).toEqual([])
  })

  it('can be switched off', () => {
    const h = makeHarness({ stacking: { deep: false } })
    stack(h, 15)
    expect(deepOf(h)).toEqual([])
  })
})

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

describe('tab shortcuts', () => {
  function grouped(options: DesktopOptions = {}) {
    const h = makeHarness(options)
    for (const id of ['a', 'b', 'c']) h.add({ id, x: 10, y: 10, width: 300, height: 200 })
    h.wm.group(['a', 'b', 'c'])
    h.wm.activateTab('a')
    return h
  }

  const activeTab = (h: Harness) => {
    const id = h.wm.getState().focusedId as string
    return h.wm.getState().groups[h.wm.get(id)?.groupId as string]?.activeId
  }

  it('moves to the next and previous tab with Ctrl or Cmd, Alt and PageDown or PageUp', () => {
    const h = grouped()
    const next = press(h.element, 'PageDown', { ctrlKey: true, altKey: true })
    expect(next.defaultPrevented).toBe(true)
    expect(activeTab(h)).toBe('b')
    press(h.element, 'PageDown', { metaKey: true, altKey: true })
    expect(activeTab(h)).toBe('c')
    press(h.element, 'PageUp', { ctrlKey: true, altKey: true })
    expect(activeTab(h)).toBe('b')
  })

  it('keeps out of the way without the modifiers, in fields or when switched off', () => {
    const h = grouped()
    expect(press(h.element, 'PageDown', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(press(h.element, 'PageDown', { altKey: true }).defaultPrevented).toBe(false)
    const field = document.createElement('input')
    h.element.append(field)
    press(field, 'PageDown', { ctrlKey: true, altKey: true })
    expect(activeTab(h)).toBe('a')

    const off = grouped({ keyboard: { tabShortcuts: false } })
    expect(press(off.element, 'PageDown', { ctrlKey: true, altKey: true }).defaultPrevented).toBe(
      false,
    )
    expect(activeTab(off)).toBe('a')
  })

  it('still snaps with the arrows when only the tab shortcuts are on', () => {
    const h = grouped({ keyboard: { snapShortcuts: false } })
    press(h.element, 'ArrowLeft', { ctrlKey: true, altKey: true })
    expect(h.wm.get('a')?.stage).toBe('normal')
    press(h.element, 'PageDown', { ctrlKey: true, altKey: true })
    expect(activeTab(h)).toBe('b')
  })
})

describe('frames inside windows', () => {
  const FRAMED = '<header data-wm-drag><span data-wm-title>t</span></header><iframe></iframe>'

  function frameOf(root: HTMLElement, focused = false): HTMLIFrameElement {
    const frame = root.querySelector('iframe') as HTMLIFrameElement
    if (focused) {
      frame.tabIndex = 0
      frame.focus()
    }
    return frame
  }

  it('stops watching once the pointer leaves the frame, whatever it moves to', () => {
    const h = makeHarness()
    const frame = frameOf(h.add({ id: 'a', x: 0, y: 0, width: 200, height: 150 }, FRAMED))
    pointerOn(frame, 'pointerover')
    expect(frames.size).toBe(1)
    pointerOn(frame, 'pointerout')
    expect(frames.size).toBe(0)
  })

  it('stops watching a frame whose window has left the page', () => {
    const h = makeHarness()
    const root = h.add({ id: 'a', x: 0, y: 0, width: 200, height: 150 }, FRAMED)
    pointerOn(frameOf(root), 'pointerover')
    h.wm.close('a')
    root.remove()
    flushFrames()
    expect(frames.size).toBe(0)
  })

  it('never takes focus back for a frame that already had it', () => {
    const h = makeHarness()
    const frame = frameOf(h.add({ id: 'a', x: 0, y: 0, width: 200, height: 150 }, FRAMED), true)
    pointerOn(frame, 'pointerover')
    flushFrames()

    h.wm.blur()
    flushFrames()
    expect(h.wm.getState().focusedId).toBe(null)

    h.wm.open({ id: 'b', x: 20, y: 20, width: 200, height: 150 })
    flushFrames()
    expect(h.wm.getState().focusedId).toBe('b')
    expect(h.wm.getState().order.at(-1)).toBe('b')
  })

  it('still focuses the window of a frame that takes focus under the pointer', () => {
    const h = makeHarness()
    const root = h.add({ id: 'a', x: 0, y: 0, width: 200, height: 150 }, FRAMED)
    h.add({ id: 'b', x: 300, y: 0, width: 200, height: 150 })
    const frame = frameOf(root)
    pointerOn(frame, 'pointerover')
    frameOf(root, true)
    flushFrames()
    expect(h.wm.getState().focusedId).toBe('a')
  })
})

describe('a desktop that lives in another document', () => {
  function framed() {
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const doc = frame.contentDocument as Document
    const view = frame.contentWindow as Window & typeof globalThis
    view.requestAnimationFrame = (() => 0) as typeof view.requestAnimationFrame
    const host = doc.createElement('div')
    doc.body.append(host)
    const wm = createWindowManager({ viewport: VIEWPORT })
    const desktop = attachDesktop(wm, host, { autoViewport: false, announce: false })
    wm.open({ id: 'a', x: 100, y: 100, width: 300, height: 200 })
    const root = doc.createElement('section')
    root.innerHTML =
      '<header data-wm-drag><button data-wm-close></button></header><input class="field">'
    host.append(root)
    desktop.attachWindow('a', root)
    expect(root instanceof Element).toBe(false)
    return { wm, view, root }
  }

  it('answers the action buttons of its windows', () => {
    const { wm, view, root } = framed()
    const button = root.querySelector('[data-wm-close]') as HTMLElement
    button.dispatchEvent(new view.MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(wm.get('a')).toBeUndefined()
  })

  it('moves a window with the arrows and keeps Ctrl+Z out of its fields', () => {
    const { wm, view, root } = framed()
    root.dispatchEvent(new view.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(wm.get('a')?.bounds.x).toBe(116)
    const undo = new view.KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    ;(root.querySelector('.field') as HTMLElement).dispatchEvent(undo)
    expect(undo.defaultPrevented).toBe(false)
    expect(wm.get('a')?.bounds.x).toBe(116)
  })
})

describe('shortcuts inside editing surfaces', () => {
  const FIELDS =
    '<header data-wm-drag><input class="title-field"></header>' +
    '<input class="field"><textarea></textarea><select></select>' +
    '<div contenteditable><b class="inner">rich</b></div><canvas tabindex="0"></canvas>' +
    '<button class="plain">ok</button>'

  function moved(options: DesktopOptions = {}) {
    const h = makeHarness(options)
    const root = h.add({ id: 'a', x: 100, y: 100, width: 300, height: 200 }, FIELDS)
    h.wm.move('a', 300, 300)
    return { h, root, at: (selector: string) => root.querySelector(selector) as HTMLElement }
  }

  it('leaves Ctrl+Z to every editing surface whatever the drag-handle selector is', () => {
    for (const options of [{}, { interactiveSelector: '.no-drag' }]) {
      const { h, at } = moved(options)
      for (const selector of ['.field', 'textarea', 'select', '.inner', '.title-field']) {
        const event = press(at(selector), 'z', { ctrlKey: true })
        expect(event.defaultPrevented).toBe(false)
        press(at(selector), 'ArrowLeft', { ctrlKey: true, altKey: true })
      }
      expect(h.wm.get('a')?.bounds.x).toBe(300)
      expect(h.wm.get('a')?.stage).toBe('normal')
      h.desktop.destroy()
    }
  })

  it('leaves Ctrl+Z alone once the app has handled it', () => {
    const { h, at } = moved()
    const canvas = at('canvas')
    canvas.addEventListener('keydown', (event) => event.preventDefault())
    press(canvas, 'z', { ctrlKey: true })
    expect(h.wm.get('a')?.bounds.x).toBe(300)
  })

  it('still undoes from a control that does not edit text', () => {
    const { h, at } = moved()
    expect(press(at('.plain'), 'z', { ctrlKey: true }).defaultPrevented).toBe(true)
    expect(h.wm.get('a')?.bounds.x).toBe(100)
  })

  it('keeps the arrows in a field of the titlebar with a custom drag-handle selector', () => {
    const { h, at } = moved({ interactiveSelector: '.no-drag' })
    press(at('.title-field'), 'ArrowRight')
    expect(h.wm.get('a')?.bounds.x).toBe(300)
  })
})
