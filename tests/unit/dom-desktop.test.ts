// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowInit, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController, DesktopOptions } from '../../src/dom/shared'

const VIEWPORT = { width: 800, height: 600 }

const frames = new Map<number, FrameRequestCallback>()
let frameSeq = 0

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
}

function makeHarness(options: DesktopOptions = {}, element = document.createElement('div')) {
  stubFrames()
  if (!element.isConnected) document.body.append(element)
  const wm = createWindowManager({ viewport: VIEWPORT })
  const desktop = attachDesktop(wm, element, { autoViewport: false, announce: false, ...options })
  const harness: Harness = {
    wm,
    desktop,
    element,
    add(init, html = '<header data-wm-drag><span data-wm-title>t</span></header>') {
      wm.open(init)
      const root = document.createElement('section')
      root.innerHTML = html
      element.append(root)
      desktop.attachWindow(init.id, root)
      return root
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
