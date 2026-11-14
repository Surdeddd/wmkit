// @vitest-environment jsdom
import { html, LitElement, render } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WmStateController, WmWindowController, wmDesktop, wmWindow } from '../../src/adapters/lit'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { createDesktopBinder, type DesktopBinder } from '../../src/dom/binder'

class StubObserver {
  observe(): void {}
  disconnect(): void {}
}

let wm: WindowManager
let binder: DesktopBinder

class TestDesktop extends LitElement {
  readonly view = new WmStateController(this, wm)

  override createRenderRoot(): HTMLElement {
    return this
  }

  override render() {
    return html`<div class="desktop" ${wmDesktop(binder)} data-count=${this.view.state.order.length}>
      ${this.view.state.order.map(
        (id) => html`<section ${wmWindow(binder, id, { resizeHandles: false })} data-id=${id}>
          <header data-wm-drag><span data-wm-title>${this.view.state.windows[id]?.title}</span></header>
        </section>`,
      )}
    </div>`
  }
}

class TestTitle extends LitElement {
  readonly view = new WmWindowController(this, wm, 'a')

  override createRenderRoot(): HTMLElement {
    return this
  }

  override render() {
    return html`<span>${this.view.window?.title ?? 'none'}</span>`
  }
}

class TestKeyed extends LitElement {
  readonly view = new WmStateController(this, wm)
  handles = false
  more = false
  binder: DesktopBinder | null = null

  override createRenderRoot(): HTMLElement {
    return this
  }

  set(patch: Partial<Pick<TestKeyed, 'handles' | 'more' | 'binder'>>): void {
    Object.assign(this, patch)
    this.requestUpdate()
  }

  override render() {
    const used = this.binder ?? binder
    const options = this.more
      ? { resizeHandles: this.handles, removeOnClose: false }
      : { resizeHandles: this.handles }
    return html`<div class="desktop" ${wmDesktop(used)}>
      ${repeat(
        this.view.state.order,
        (id) => id,
        (id) => html`<section ${wmWindow(used, id, { ...options })} data-id=${id}>
          <header data-wm-drag><span data-wm-title>${this.view.state.windows[id]?.title}</span></header>
        </section>`,
      )}
    </div>`
  }
}

customElements.define('test-desktop', TestDesktop)
customElements.define('test-keyed', TestKeyed)
customElements.define('test-title', TestTitle)

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubObserver)
  wm = createWindowManager({ viewport: { width: 800, height: 600 } })
  binder = createDesktopBinder(wm, { autoViewport: false, announce: false })
})

afterEach(() => {
  binder.destroy()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('lit adapter', () => {
  it('re-renders on manager changes and binds the desktop and its windows', async () => {
    const element = document.createElement('test-desktop') as TestDesktop
    document.body.append(element)
    await element.updateComplete
    const desktop = element.querySelector('.desktop') as HTMLElement
    expect(desktop.hasAttribute('data-wm-desktop')).toBe(true)

    wm.open({ id: 'a', title: 'Alpha' })
    await element.updateComplete
    expect(desktop.dataset.count).toBe('1')
    const section = element.querySelector('[data-id="a"]') as HTMLElement
    expect(section.dataset.wmWindow).toBe('a')

    wm.update('a', { title: 'Renamed' })
    await element.updateComplete
    expect(section.textContent?.trim()).toBe('Renamed')
    element.requestUpdate()
    await element.updateComplete
    expect(section.dataset.wmWindow).toBe('a')

    element.remove()
    expect(section.dataset.wmWindow).toBeUndefined()
    wm.update('a', { title: 'Unseen' })
    document.body.append(element)
    await element.updateComplete
    expect(section.dataset.wmWindow).toBe('a')
    expect(section.textContent?.trim()).toBe('Unseen')
  })

  it('follows one window and ignores changes to the others', async () => {
    wm.open({ id: 'a', title: 'Alpha' })
    wm.open({ id: 'b', title: 'Beta' })
    const element = document.createElement('test-title') as TestTitle
    document.body.append(element)
    await element.updateComplete
    expect(element.textContent).toBe('Alpha')
    const updates = vi.spyOn(element, 'requestUpdate')
    wm.update('b', { title: 'Other' })
    expect(updates).not.toHaveBeenCalled()
    wm.update('a', { title: 'Changed' })
    await element.updateComplete
    expect(element.textContent).toBe('Changed')
    element.remove()
    wm.update('a', { title: 'Away' })
    expect(element.view.window?.title).toBe('Changed')
    wm.close('a')
    document.body.append(element)
    await element.updateComplete
    expect(element.textContent).toBe('none')
  })

  it('hands a window over when a template swap builds its new element before dropping the old one', () => {
    wm.open({ id: 'notes', title: 'Notes', x: 40, y: 40, width: 300, height: 200 })
    wm.move('notes', 220, 160)
    const host = document.createElement('div')
    document.body.append(host)
    const compact = () =>
      html`<section class="compact" ${wmWindow(binder, 'notes')}><header data-wm-drag></header></section>`
    const full = () =>
      html`<article class="full" ${wmWindow(binder, 'notes')}><header data-wm-drag></header></article>`
    const page = (wide: boolean) =>
      html`<div ${wmDesktop(binder)}>${wide ? full() : compact()}</div>`
    const attached = () =>
      [...host.querySelectorAll<HTMLElement>('[data-wm-window]')].map((node) => node.className)

    render(page(false), host)
    expect(attached()).toEqual(['compact'])
    expect(() => render(page(true), host)).not.toThrow()
    expect(attached()).toEqual(['full'])
    expect((host.querySelector('.full') as HTMLElement).style.transform).toBe(
      'translate3d(220px, 160px, 0)',
    )
    expect(wm.get('notes')?.bounds).toMatchObject({ x: 220, y: 160 })
    render(page(false), host)
    expect(attached()).toEqual(['compact'])
  })

  it('moves the desktop when a template swap builds its new element before dropping the old one', () => {
    wm.open({ id: 'notes', title: 'Notes' })
    const host = document.createElement('div')
    document.body.append(host)
    const windows = () =>
      html`<section ${wmWindow(binder, 'notes')}><header data-wm-drag></header></section>`
    const page = (wide: boolean) =>
      wide
        ? html`<main class="wide" ${wmDesktop(binder)}>${windows()}</main>`
        : html`<div class="narrow" ${wmDesktop(binder)}>${windows()}</div>`
    const desktops = () =>
      [...host.querySelectorAll<HTMLElement>('[data-wm-desktop]')].map((node) => node.className)

    render(page(false), host)
    expect(desktops()).toEqual(['narrow'])
    expect(() => render(page(true), host)).not.toThrow()
    expect(desktops()).toEqual(['wide'])
    expect(binder.controller()?.element.className).toBe('wide')
    expect(host.querySelector<HTMLElement>('.wide [data-wm-window]')?.dataset.wmWindow).toBe(
      'notes',
    )
    render(page(false), host)
    expect(desktops()).toEqual(['narrow'])
    expect(host.querySelectorAll('[data-wm-window]')).toHaveLength(1)
  })

  it('keeps a window bound while the template is drawn again with the same options written in place', async () => {
    Element.prototype.setPointerCapture = () => {}
    Element.prototype.releasePointerCapture = () => {}
    Element.prototype.hasPointerCapture = () => false
    const bound = vi.spyOn(binder, 'bindWindow')
    const element = document.createElement('test-keyed') as TestKeyed
    document.body.append(element)
    wm.open({ id: 'a', title: 'Alpha', x: 100, y: 100 })
    wm.open({ id: 'b', title: 'Beta', x: 400, y: 100 })
    await element.updateComplete
    expect(bound).toHaveBeenCalledTimes(2)
    const section = element.querySelector('[data-id="a"]') as HTMLElement
    const handle = section.querySelector('[data-wm-drag]') as HTMLElement
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: 1,
        clientX: x,
        clientY: y,
      })
      Object.defineProperty(event, 'pointerId', { value: 1 })
      handle.dispatchEvent(event)
    }
    pointer('pointerdown', 120, 110)
    pointer('pointermove', 160, 150)
    await element.updateComplete
    expect(section.hasAttribute('data-wm-dragging')).toBe(true)
    const before = bound.mock.calls.length

    wm.update('b', { title: 'Renamed in the middle of the drag' })
    await element.updateComplete
    element.requestUpdate()
    await element.updateComplete
    expect(bound).toHaveBeenCalledTimes(before)
    expect(section.hasAttribute('data-wm-dragging')).toBe(true)
    pointer('pointerup', 160, 150)
    expect(section.hasAttribute('data-wm-dragging')).toBe(false)
    expect(section.querySelector('[data-wm-resize]')).toBeNull()
  })

  it('binds again when an option, the id or the binder it is given is another one', async () => {
    const bound = vi.spyOn(binder, 'bindWindow')
    const element = document.createElement('test-keyed') as TestKeyed
    document.body.append(element)
    wm.open({ id: 'a', title: 'Alpha' })
    await element.updateComplete
    const section = element.querySelector('[data-id="a"]') as HTMLElement
    expect(bound).toHaveBeenCalledTimes(1)
    expect(section.querySelector('[data-wm-resize]')).toBeNull()

    element.set({ handles: true })
    await element.updateComplete
    expect(bound).toHaveBeenCalledTimes(2)
    expect(section.querySelector('[data-wm-resize]')).not.toBeNull()
    element.requestUpdate()
    await element.updateComplete
    expect(bound).toHaveBeenCalledTimes(2)

    element.set({ more: true })
    await element.updateComplete
    expect(bound).toHaveBeenCalledTimes(3)
    element.set({ more: false })
    await element.updateComplete
    expect(bound).toHaveBeenCalledTimes(4)

    const other = createDesktopBinder(wm, { autoViewport: false, announce: false })
    const rebound = vi.spyOn(other, 'bindWindow')
    element.set({ binder: other })
    await element.updateComplete
    expect(rebound).toHaveBeenCalledTimes(1)
    expect(bound).toHaveBeenCalledTimes(4)
    expect(section.dataset.wmWindow).toBe('a')
    other.destroy()
  })

  it('refuses to sit anywhere but on an element', () => {
    const host = document.createElement('div')
    expect(() => render(html`<p>${wmDesktop(binder)}</p>`, host)).toThrow(/on an element/)
  })
})

describe('lit controllers on a host that only counts', () => {
  const bare = () => ({
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
  })

  it('the state controller catches up when it connects, asks for an update only on a change, and lets go', () => {
    const host = bare()
    const controller = new WmStateController(host, wm)
    expect(host.addController).toHaveBeenCalledWith(controller)
    expect(() => controller.hostDisconnected()).not.toThrow()
    controller.hostConnected()
    expect(host.requestUpdate).not.toHaveBeenCalled()
    controller.hostDisconnected()
    wm.open({ id: 'a' })
    expect(host.requestUpdate).not.toHaveBeenCalled()
    expect(controller.state).not.toBe(wm.getState())
    controller.hostConnected()
    expect(host.requestUpdate).toHaveBeenCalledTimes(1)
    expect(controller.state).toBe(wm.getState())
    wm.open({ id: 'b' })
    expect(host.requestUpdate).toHaveBeenCalledTimes(2)
    controller.hostDisconnected()
    controller.hostDisconnected()
    wm.open({ id: 'c' })
    expect(host.requestUpdate).toHaveBeenCalledTimes(2)
  })

  it('the window controller does the same for its one window', () => {
    wm.open({ id: 'a', title: 'Alpha' })
    wm.open({ id: 'b', title: 'Beta' })
    const host = bare()
    const controller = new WmWindowController(host, wm, 'a')
    expect(host.addController).toHaveBeenCalledWith(controller)
    expect(controller.window?.title).toBe('Alpha')
    expect(() => controller.hostDisconnected()).not.toThrow()
    wm.update('a', { title: 'Changed before it connected' })
    controller.hostConnected()
    expect(host.requestUpdate).toHaveBeenCalledTimes(1)
    expect(controller.window?.title).toBe('Changed before it connected')
    wm.update('b', { title: 'Another window' })
    expect(host.requestUpdate).toHaveBeenCalledTimes(1)
    controller.hostDisconnected()
    wm.update('a', { title: 'Unseen' })
    expect(host.requestUpdate).toHaveBeenCalledTimes(1)
    controller.hostConnected()
    expect(host.requestUpdate).toHaveBeenCalledTimes(2)
    controller.hostDisconnected()
    controller.hostConnected()
    expect(host.requestUpdate).toHaveBeenCalledTimes(2)
  })
})
