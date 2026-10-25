// @vitest-environment jsdom
import { html, LitElement, render } from 'lit'
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

customElements.define('test-desktop', TestDesktop)
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

  it('refuses to sit anywhere but on an element', () => {
    const host = document.createElement('div')
    expect(() => render(html`<p>${wmDesktop(binder)}</p>`, host)).toThrow(/on an element/)
  })
})
