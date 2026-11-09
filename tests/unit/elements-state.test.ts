// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDock, dockLayout } from '../../src/plugins/dock'
import {
  defineWmElements,
  type WmDesktopElement,
  type WmWindowElement,
} from '../../src/plugins/elements'

class StubObserver {
  observe(): void {}
  disconnect(): void {}
}

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve))
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 200))

function mount(html: string): WmDesktopElement {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  return holder.querySelector('wm-desktop') as WmDesktopElement
}

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  }
}

let storage: Storage

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubObserver)
  storage = memoryStorage()
  vi.stubGlobal('localStorage', storage)
  defineWmElements()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

const windowOf = (desktop: WmDesktopElement, id: string) =>
  desktop.querySelector(`[window-id="${id}"]`) as WmWindowElement

const closedList = (desktop: WmDesktopElement) =>
  (desktop.manager?.getState().extensions.elements as { closed: string[] } | undefined)?.closed

describe('a size attribute', () => {
  it('changes only its own dimension and keeps the other one', () => {
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a" width="300"></wm-window></wm-desktop>',
    )
    const wm = desktop.manager
    const element = windowOf(desktop, 'a')
    const height = wm?.get('a')?.bounds.height
    element.setAttribute('width', '400')
    expect(wm?.get('a')?.bounds).toMatchObject({ width: 400, height })
    wm?.resize('a', { width: 500, height: 350 })
    element.setAttribute('height', '260')
    expect(wm?.get('a')?.bounds).toMatchObject({ width: 500, height: 260 })
    element.setAttribute('width', '420')
    expect(wm?.get('a')?.bounds).toMatchObject({ width: 420, height: 260 })
    element.removeAttribute('width')
    element.setAttribute('height', 'tall')
    expect(wm?.get('a')?.bounds).toMatchObject({ width: 420, height: 260 })
    expect(Object.values(wm?.get('a')?.bounds ?? {}).every(Number.isFinite)).toBe(true)
  })

  it('moves along one axis and keeps the other where the manager put it', () => {
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a" x="10" y="20" width="300" height="200"></wm-window></wm-desktop>',
    )
    const wm = desktop.manager
    const element = windowOf(desktop, 'a')
    wm?.move('a', 300, 200)
    element.setAttribute('x', '50')
    expect(wm?.get('a')?.bounds).toMatchObject({ x: 50, y: 200 })
    element.setAttribute('y', '60')
    expect(wm?.get('a')?.bounds).toMatchObject({ x: 50, y: 60 })
    element.removeAttribute('x')
    element.setAttribute('y', 'up')
    expect(wm?.get('a')?.bounds).toMatchObject({ x: 50, y: 60 })
  })

  it('changes one side of a size limit and keeps the other side', () => {
    const desktop = mount(`<wm-desktop><wm-window window-id="a" width="300" height="200"
      min-width="150" min-height="100" max-width="600" max-height="500"></wm-window></wm-desktop>`)
    const wm = desktop.manager
    const element = windowOf(desktop, 'a')
    wm?.update('a', { minSize: { width: 150, height: 180 }, maxSize: { width: 600, height: 450 } })
    element.setAttribute('min-width', '170')
    expect(wm?.get('a')?.minSize).toEqual({ width: 170, height: 180 })
    element.removeAttribute('min-height')
    expect(wm?.get('a')?.minSize).toEqual({ width: 170, height: 180 })
    element.setAttribute('max-width', '650')
    expect(wm?.get('a')?.maxSize).toEqual({ width: 650, height: 450 })
    element.removeAttribute('max-height')
    expect(wm?.get('a')?.maxSize).toEqual({ width: 650, height: Number.POSITIVE_INFINITY })
    wm?.update('a', { maxSize: null })
    element.setAttribute('max-height', '480')
    expect(wm?.get('a')?.maxSize).toEqual({ width: Number.POSITIVE_INFINITY, height: 480 })
  })
})

describe('an element follows the manager', () => {
  it('reflects the stage after an undo and a redo', () => {
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a" label="A"></wm-window></wm-desktop>',
    )
    const wm = desktop.manager
    const element = windowOf(desktop, 'a')
    expect(element.hasAttribute('stage')).toBe(false)
    wm?.maximize('a')
    expect(element.getAttribute('stage')).toBe('maximized')
    wm?.undo()
    expect(wm?.get('a')?.stage).toBe('normal')
    expect(element.getAttribute('stage')).toBe('normal')
    wm?.redo()
    expect(element.getAttribute('stage')).toBe('maximized')
  })

  it('comes back on screen when an undo reopens its window, and closes again on redo', () => {
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a" label="A"></wm-window></wm-desktop>',
    )
    const wm = desktop.manager
    const element = windowOf(desktop, 'a')
    const opened = vi.fn()
    element.addEventListener('wm-open', opened)
    wm?.close('a')
    expect(element.hasAttribute('closed')).toBe(true)
    expect(element.dataset.wmWindow).toBeUndefined()
    wm?.undo()
    expect(wm?.get('a')).toBeDefined()
    expect(element.hasAttribute('closed')).toBe(false)
    expect(element.dataset.wmWindow).toBe('a')
    expect(desktop.windows.get('a')).toBe(element)
    expect(opened).toHaveBeenCalledTimes(1)
    wm?.redo()
    expect(element.hasAttribute('closed')).toBe(true)
    expect(desktop.windows.has('a')).toBe(false)
    wm?.undo()
    wm?.move('a', 40, 50)
    expect(element.style.transform).toContain('40px, 50px')
    expect(opened).toHaveBeenCalledTimes(2)
  })

  it('brings a closed docked panel back into its place on undo', () => {
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a" label="A"></wm-window><wm-window window-id="b" label="B"></wm-window></wm-desktop>',
    )
    const wm = desktop.manager as NonNullable<WmDesktopElement['manager']>
    wm.setViewport({ width: 1000, height: 600 })
    const dock = createDock(desktop.controller as NonNullable<WmDesktopElement['controller']>)
    dock.dock('a')
    dock.dock('b', { side: 'right' })
    const b = windowOf(desktop, 'b')
    wm.close('b')
    expect(wm.get('a')?.bounds.width).toBe(1000)
    wm.undo()
    expect(dockLayout.windowsOf(dock.layout())).toEqual(['a', 'b'])
    expect(wm.get('a')?.bounds.width).toBe(497)
    expect(b.hasAttribute('closed')).toBe(false)
    expect(b.dataset.wmWindow).toBe('b')
  })

  it('binds when the window appears by other means and leaves a second element with the same id alone', () => {
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a" closed></wm-window><wm-window window-id="b"></wm-window></wm-desktop>',
    )
    const wm = desktop.manager
    const a = windowOf(desktop, 'a')
    wm?.open({ id: 'a', title: 'From code' })
    expect(a.hasAttribute('closed')).toBe(false)
    expect(a.dataset.wmWindow).toBe('a')
    expect(closedList(desktop)).toBeUndefined()

    const twin = document.createElement('wm-window')
    twin.setAttribute('window-id', 'b')
    desktop.append(twin)
    expect(() => wm?.move('b', 30, 30)).not.toThrow()
    expect(desktop.windows.get('b')).toBe(windowOf(desktop, 'b'))
    expect(twin.hasAttribute('data-wm-window')).toBe(false)
  })
})

describe('closed panels', () => {
  it('stay closed after a reload with persist', async () => {
    const html =
      '<wm-desktop persist="k"><wm-window window-id="a" label="A"></wm-window><wm-window window-id="b" label="B"></wm-window></wm-desktop>'
    const first = mount(html)
    first.manager?.close('b')
    await settle()
    const saved = JSON.parse(storage.getItem('k') ?? '{}')
    expect(saved.state.windows.map((win: { id: string }) => win.id)).toEqual(['a'])
    expect(saved.state.extensions.elements).toEqual({ closed: ['b'] })
    first.parentElement?.remove()
    await flush()

    const second = mount(html)
    const b = windowOf(second, 'b')
    expect(second.manager?.get('b')).toBeUndefined()
    expect(b.hasAttribute('closed')).toBe(true)
    expect(b.dataset.wmWindow).toBeUndefined()

    b.removeAttribute('closed')
    expect(second.manager?.get('b')?.title).toBe('B')
    expect(closedList(second)).toBeUndefined()
    await settle()
    second.parentElement?.remove()
    await flush()

    const third = mount(html)
    expect(third.manager?.get('b')).toBeDefined()
    expect(windowOf(third, 'b').hasAttribute('closed')).toBe(false)
  })

  it('open from the saved state even when the markup says closed', async () => {
    const html =
      '<wm-desktop persist="k"><wm-window window-id="later" label="Later" closed></wm-window></wm-desktop>'
    const first = mount(html)
    windowOf(first, 'later').removeAttribute('closed')
    await settle()
    first.parentElement?.remove()
    await flush()
    const second = mount(html)
    expect(windowOf(second, 'later').hasAttribute('closed')).toBe(false)
    expect(windowOf(second, 'later').dataset.wmWindow).toBe('later')
  })

  it('remember the closing in the same undo step and add no step of their own', () => {
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a"></wm-window><wm-window window-id="b"></wm-window></wm-desktop>',
    )
    const wm = desktop.manager
    wm?.clearHistory()
    windowOf(desktop, 'b').setAttribute('closed', '')
    expect(closedList(desktop)).toEqual(['b'])
    expect(wm?.undo()).toBe(true)
    expect(closedList(desktop)).toBeUndefined()
    expect(windowOf(desktop, 'b').dataset.wmWindow).toBe('b')
    expect(wm?.canUndo()).toBe(false)
    expect(wm?.redo()).toBe(true)
    expect(closedList(desktop)).toEqual(['b'])
    expect(wm?.canRedo()).toBe(false)
  })

  it('forget an element that left the page, and survive a foreign extension value', async () => {
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a"></wm-window><wm-window window-id="b"></wm-window></wm-desktop>',
    )
    const wm = desktop.manager
    windowOf(desktop, 'a').remove()
    await flush()
    expect(wm?.get('a')).toBeUndefined()
    expect(closedList(desktop)).toBeUndefined()
    wm?.setExtension('elements', 'not a list')
    wm?.close('b')
    expect(closedList(desktop)).toEqual(['b'])
  })
})
