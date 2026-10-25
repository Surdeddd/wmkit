// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defineWmElements,
  elementsMessagesRu,
  WmDesktopElement,
  WmWindowElement,
} from '../../src/plugins/elements'

class StubObserver {
  observe(): void {}
  disconnect(): void {}
}

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve))

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

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubObserver)
  vi.stubGlobal('localStorage', memoryStorage())
  defineWmElements()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('defining the elements', () => {
  it('defines the default tags from the side-effect entry', async () => {
    await import('../../src/plugins/elements/define')
    expect(customElements.get('wm-desktop')).toBeDefined()
  })

  it('registers both tags once, under any prefix, and does nothing without a registry', () => {
    defineWmElements()
    expect(customElements.get('wm-desktop')).toBeDefined()
    expect(customElements.get('wm-window')).toBeDefined()
    defineWmElements({ prefix: 'os' })
    expect(new (customElements.get('os-window') as typeof WmWindowElement)()).toBeInstanceOf(
      WmWindowElement,
    )
    vi.stubGlobal('customElements', undefined)
    expect(() => defineWmElements({ prefix: 'never' })).not.toThrow()
  })
})

describe('a desktop', () => {
  it('builds a manager and a controller when it connects and says so', () => {
    const ready = vi.fn()
    const desktop = document.createElement('wm-desktop') as WmDesktopElement
    desktop.addEventListener('wm-ready', ready)
    desktop.options = { viewport: { width: 900, height: 600 } }
    document.body.append(desktop)
    expect(desktop.manager?.getState().viewport).toEqual({ width: 900, height: 600 })
    expect(desktop.controller).not.toBeNull()
    expect(ready).toHaveBeenCalledTimes(1)
  })

  it('reads its switches from attributes', () => {
    const desktop = mount(
      '<wm-desktop snap="false" keyboard="false" grouping="false"></wm-desktop>',
    )
    expect(desktop.manager).not.toBeNull()
    expect(desktop.hasAttribute('data-wm-desktop')).toBe(true)
  })

  it('survives a move and tears down once it is really gone', async () => {
    const desktop = mount('<wm-desktop></wm-desktop>')
    const wm = desktop.manager
    const other = document.createElement('section')
    document.body.append(other)
    other.append(desktop)
    await flush()
    expect(desktop.manager).toBe(wm)
    desktop.remove()
    await flush()
    expect(desktop.manager).toBeNull()
    expect(desktop.controller).toBeNull()
    desktop.disconnectedCallback()
    await flush()
  })

  it('persists and restores its windows under a key', async () => {
    const first = mount(
      '<wm-desktop persist="layout"><wm-window window-id="notes" label="Notes" x="10" y="20" width="300" height="200"></wm-window></wm-desktop>',
    )
    first.manager?.move('notes', 120, 90)
    first.remove()
    await flush()
    await new Promise((resolve) => setTimeout(resolve, 200))
    const second = mount(
      '<wm-desktop persist="layout"><wm-window window-id="notes" label="Notes" x="10" y="20"></wm-window></wm-desktop>',
    )
    expect(second.manager?.get('notes')?.bounds).toMatchObject({ x: 120, y: 90 })
  })
})

describe('a window', () => {
  it('opens from its attributes and wears a chrome with parts', () => {
    const desktop = mount(`<wm-desktop>
      <wm-window window-id="a" label="Alpha" x="10" y="20" width="300" height="200"
        min-width="150" min-height="100" max-width="600" max-height="500" aspect-ratio="1.5"
        workspace="0" layer="floating" closable="false" snappable="false">
        <p>body</p>
      </wm-window>
    </wm-desktop>`)
    const win = desktop.manager?.get('a')
    expect(win).toMatchObject({
      title: 'Alpha',
      layer: 'floating',
      closable: false,
      snappable: false,
      minSize: { width: 150, height: 100 },
      maxSize: { width: 600, height: 500 },
      aspectRatio: 1.5,
    })
    expect(win?.bounds.x).toBe(10)
    const element = desktop.querySelector('wm-window') as WmWindowElement
    expect(element.windowId).toBe('a')
    expect(element.manager).toBe(desktop.manager)
    const root = element.shadowRoot as ShadowRoot
    expect(root.querySelector('[part=title]')?.textContent).toBe('Alpha')
    expect(root.querySelector('[part=titlebar]')?.hasAttribute('data-wm-drag')).toBe(true)
    expect(
      [...root.querySelectorAll('[part~=control]')].map((node) => node.getAttribute('aria-label')),
    ).toEqual(['Minimize', 'Maximize', 'Close'])
    expect(element.hasAttribute('data-wm-window')).toBe(true)
  })

  it('takes a generated id and the desktop messages', () => {
    const desktop = document.createElement('wm-desktop') as WmDesktopElement
    desktop.messages = elementsMessagesRu
    document.body.append(desktop)
    const element = document.createElement('wm-window') as WmWindowElement
    desktop.append(element)
    expect(element.windowId).toMatch(/^wm-/)
    expect(element.shadowRoot?.querySelector('[part~=close]')?.getAttribute('aria-label')).toBe(
      'Закрыть',
    )
  })

  it('picks the button labels from the nearest lang unless messages are set', () => {
    const label = (element: Element) =>
      element.shadowRoot?.querySelector('[part~=minimize]')?.getAttribute('aria-label')
    const desktop = mount(`<wm-desktop lang="ru-RU">
      <wm-window window-id="ru"></wm-window>
      <section lang="en"><wm-window window-id="en"></wm-window></section>
    </wm-desktop>`)
    expect(label(desktop.querySelector('[window-id=ru]') as Element)).toBe('Свернуть')
    expect(label(desktop.querySelector('[window-id=en]') as Element)).toBe('Minimize')

    document.documentElement.lang = 'ru'
    try {
      const plain = mount('<wm-desktop><wm-window window-id="page"></wm-window></wm-desktop>')
      expect(label(plain.querySelector('wm-window') as Element)).toBe('Свернуть')
    } finally {
      document.documentElement.removeAttribute('lang')
    }
  })

  it('waits for a desktop that is not ready yet, and stays inert without one', () => {
    defineWmElements({ prefix: 'late' })
    const loose = document.createElement('wm-window') as WmWindowElement
    document.body.append(loose)
    expect(loose.windowId).toBeNull()
    expect(loose.manager).toBeNull()

    const holder = document.createElement('div')
    holder.innerHTML =
      '<lazy-desktop><wm-window window-id="w" label="Waiting"></wm-window></lazy-desktop>'
    document.body.append(holder)
    const waiting = holder.querySelector('wm-window') as WmWindowElement
    expect(waiting.windowId).toBeNull()
    customElements.define('lazy-desktop', class extends WmDesktopElement {})
    expect(waiting.windowId).toBe('w')
  })

  it('drives the manager from attribute changes', () => {
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a" label="A" x="10" y="10" width="300" height="200"></wm-window></wm-desktop>',
    )
    const wm = desktop.manager
    const element = desktop.querySelector('wm-window') as WmWindowElement
    element.setAttribute('label', 'Renamed')
    element.setAttribute('x', '40')
    element.setAttribute('y', '60')
    element.setAttribute('width', '320')
    element.setAttribute('height', '220')
    element.setAttribute('min-width', '200')
    element.setAttribute('max-height', '400')
    element.setAttribute('aspect-ratio', '2')
    element.removeAttribute('aspect-ratio')
    element.setAttribute('layer', 'floating')
    element.removeAttribute('layer')
    element.setAttribute('resizable', 'false')
    element.setAttribute('workspace', '1')
    element.removeAttribute('workspace')
    element.removeAttribute('label')
    const win = wm?.get('a')
    expect(win?.title).toBe('')
    expect(win?.bounds).toMatchObject({ x: 40, y: 60 })
    expect(win?.minSize.width).toBe(200)
    expect(win?.maxSize?.height).toBe(400)
    expect(win?.aspectRatio).toBeNull()
    expect(win?.layer).toBe('normal')
    expect(win?.resizable).toBe(false)
    expect(win?.workspace).toBe(0)
    element.removeAttribute('x')
    element.removeAttribute('y')
    element.setAttribute('x', '70')
    expect(wm?.get('a')?.bounds).toMatchObject({ x: 70, y: 60 })
    element.removeAttribute('min-width')
    element.setAttribute('min-height', '120')
    element.removeAttribute('max-height')
    element.setAttribute('max-width', '700')
    expect(wm?.get('a')?.minSize).toEqual({ width: 200, height: 120 })
    expect(wm?.get('a')?.maxSize?.width).toBe(700)

    element.setAttribute('stage', 'maximized')
    expect(wm?.get('a')?.stage).toBe('maximized')
    element.setAttribute('stage', 'minimized')
    expect(wm?.get('a')?.stage).toBe('minimized')
    element.setAttribute('stage', 'normal')
    expect(wm?.get('a')?.stage).toBe('normal')
  })

  it('ignores attribute changes before it opens and after its window is gone', () => {
    const element = document.createElement('wm-window') as WmWindowElement
    element.setAttribute('label', 'Detached')
    const desktop = mount('<wm-desktop></wm-desktop>')
    desktop.append(element)
    desktop.manager?.close(element.windowId as string)
    element.removeAttribute('closed')
    desktop.manager?.close(element.windowId as string)
    expect(element.hasAttribute('closed')).toBe(true)
    element.setAttribute('label', 'Still closed')
    expect(desktop.manager?.get(element.windowId as string)).toBeUndefined()
  })

  it('reflects the stage and announces what happens to it', () => {
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a" label="A"></wm-window><wm-window window-id="b" label="B"></wm-window></wm-desktop>',
    )
    const wm = desktop.manager
    const element = desktop.querySelector('[window-id="a"]') as WmWindowElement
    const seen: string[] = []
    for (const type of ['wm-move', 'wm-resize', 'wm-stage', 'wm-focus', 'wm-close']) {
      element.addEventListener(type, () => seen.push(type))
    }
    wm?.focus('a')
    wm?.move('a', 5, 5)
    wm?.resize('a', { width: 333 })
    wm?.maximize('a')
    expect(element.getAttribute('stage')).toBe('maximized')
    wm?.close('a')
    expect(seen).toEqual(['wm-focus', 'wm-move', 'wm-resize', 'wm-stage', 'wm-close'])
    expect(element.hasAttribute('closed')).toBe(true)
    expect(desktop.windows.has('a')).toBe(false)
  })

  it('closes from its button unless a wm-beforeclose listener says no, and reopens when unclosed', () => {
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a" label="A"></wm-window></wm-desktop>',
    )
    const element = desktop.querySelector('wm-window') as WmWindowElement
    const close = element.shadowRoot?.querySelector('[part~=close]') as HTMLButtonElement
    const veto = (event: Event) => event.preventDefault()
    element.addEventListener('wm-beforeclose', veto)
    close.click()
    expect(desktop.manager?.get('a')).toBeDefined()
    element.removeEventListener('wm-beforeclose', veto)
    close.click()
    expect(desktop.manager?.get('a')).toBeUndefined()
    expect(element.hasAttribute('closed')).toBe(true)

    const opened = vi.fn()
    element.addEventListener('wm-open', opened)
    element.removeAttribute('closed')
    expect(desktop.manager?.get('a')?.title).toBe('A')
    expect(opened).toHaveBeenCalledTimes(1)
    element.setAttribute('closed', '')
    expect(desktop.manager?.get('a')).toBeUndefined()
  })

  it('starts closed when told to, and closes its window when it leaves the page', async () => {
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a" closed></wm-window><wm-window window-id="b"></wm-window></wm-desktop>',
    )
    expect(desktop.manager?.get('a')).toBeUndefined()
    const b = desktop.querySelector('[window-id="b"]') as WmWindowElement
    const other = document.createElement('wm-window')
    desktop.append(other)
    desktop.append(b)
    await flush()
    expect(desktop.manager?.get('b')).toBeDefined()
    b.remove()
    await flush()
    expect(desktop.manager?.get('b')).toBeUndefined()
    expect(b.hasAttribute('closed')).toBe(false)
  })
})
