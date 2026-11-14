// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import { nonced, setStyleNonce, styleNonce } from '../../src/dom/nonce'
import type { DesktopController } from '../../src/dom/shared'
import { trustedHtml } from '../../src/dom/trusted'
import { skin } from '../../src/plugins/chrome'
import { createDevtools } from '../../src/plugins/devtools'
import { createDock } from '../../src/plugins/dock'
import { defineWmElements } from '../../src/plugins/elements'
import { createLayoutPicker, linkSnapped } from '../../src/plugins/layouts'
import { popout } from '../../src/plugins/popout'
import { createSwitcher } from '../../src/plugins/switcher'
import WinBox from '../../src/plugins/winbox'
import { stubFrames } from './support/frames'

class StubObserver {
  observe(): void {}
  disconnect(): void {}
}

let wm: WindowManager
let desktop: DesktopController
let host: HTMLElement
const undo: Array<() => void> = []

function mount(): void {
  host = document.createElement('div')
  document.body.append(host)
  wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  desktop = attachDesktop(wm, host, { autoViewport: false, announce: false })
  undo.push(() => desktop.destroy())
}

function meta(attributes: Record<string, string>): HTMLMetaElement {
  const node = document.createElement('meta')
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
  document.head.append(node)
  undo.push(() => node.remove())
  return node
}

const styles = (scope: ParentNode = document) => [...scope.querySelectorAll('style')]

beforeEach(() => {
  stubFrames()
  vi.stubGlobal('ResizeObserver', StubObserver)
})

afterEach(() => {
  for (const step of undo.splice(0).reverse()) step()
  setStyleNonce(null)
  vi.unstubAllGlobals()
  document.head.replaceChildren()
  document.body.replaceChildren()
})

describe('the nonce a stylesheet of the library carries', () => {
  it('is nothing on a page that has no nonce anywhere', () => {
    expect(styleNonce(document)).toBeUndefined()
    const style = nonced(document.createElement('style'))
    expect(style.nonce).toBe('')
    expect(style.hasAttribute('nonce')).toBe(false)
  })

  it('is read from the meta tag bundlers write, from a script or from a style of the page', () => {
    const vite = meta({ property: 'csp-nonce', nonce: 'from-vite' })
    expect(styleNonce(document)).toBe('from-vite')
    vite.remove()
    const named = meta({ name: 'csp-nonce', content: 'from-content' })
    expect(styleNonce(document)).toBe('from-content')
    named.remove()
    const script = document.createElement('script')
    script.setAttribute('nonce', 'from-script')
    document.head.append(script)
    expect(styleNonce(document)).toBe('from-script')
    script.remove()
    const style = document.createElement('style')
    style.setAttribute('nonce', 'from-style')
    document.head.append(style)
    expect(styleNonce(document)).toBe('from-style')
  })

  it('is the one that was set by hand before anything the page says, until it is taken back', () => {
    meta({ property: 'csp-nonce', nonce: 'from-page' })
    setStyleNonce('by-hand')
    expect(styleNonce(document)).toBe('by-hand')
    expect(nonced(document.createElement('style')).nonce).toBe('by-hand')
    setStyleNonce(null)
    expect(styleNonce(document)).toBe('from-page')
  })

  it('is read from another document when a node is made for one and styled like the other', () => {
    meta({ property: 'csp-nonce', nonce: 'from-opener' })
    const other = document.implementation.createHTMLDocument('popup')
    expect(nonced(other.createElement('style')).nonce).toBe('')
    expect(nonced(other.createElement('style'), document).nonce).toBe('from-opener')
  })

  it('is on the stylesheet of every plugin that brings one', async () => {
    meta({ property: 'csp-nonce', nonce: 'page' })
    mount()
    wm.open({ id: 'a', width: 300, height: 200 })

    const dock = createDock(desktop)
    undo.push(() => dock.destroy())
    const tools = createDevtools(wm)
    undo.push(() => tools.destroy())
    const picker = createLayoutPicker(desktop)
    undo.push(() => picker.destroy())
    const link = linkSnapped(desktop)
    undo.push(() => link.destroy())
    const switcher = createSwitcher(desktop)
    undo.push(() => switcher.destroy())
    const dressed = skin({
      name: 'dressed',
      template: '<section><header data-wm-drag></header><div data-wm-content></div></section>',
      styles: '[data-wm-skin=dressed] { color: red; }',
    })
    desktop.mountWindow('a', dressed)
    const boxRoot = document.createElement('div')
    document.body.append(boxRoot)
    const box = new WinBox('Box', { root: boxRoot })
    undo.push(() => box.close(true))

    const found = styles()
    expect(found.length).toBeGreaterThanOrEqual(7)
    for (const style of found) {
      expect(style.nonce, style.outerHTML.slice(0, 80)).toBe('page')
    }
  })

  it('is on the fallback style elements inside shadow roots where sheets cannot be constructed', () => {
    meta({ property: 'csp-nonce', nonce: 'page' })
    const replaceSync = CSSStyleSheet.prototype.replaceSync
    Reflect.deleteProperty(CSSStyleSheet.prototype, 'replaceSync')
    undo.push(() => {
      CSSStyleSheet.prototype.replaceSync = replaceSync
    })
    mount()
    wm.open({ id: 'a' })
    const sealed = skin({
      name: 'sealed',
      shadow: true,
      template: '<section><header data-wm-drag></header><div data-wm-content></div></section>',
      styles: 'section { color: red; }',
    })
    const mounted = desktop.mountWindow('a', sealed)
    const inside = styles(mounted.element.shadowRoot as ShadowRoot)
    expect(inside).toHaveLength(1)
    expect(inside[0]?.nonce).toBe('page')

    defineWmElements({ prefix: 'csp' })
    const holder = document.createElement('div')
    holder.innerHTML = '<csp-desktop><csp-window label="W"></csp-window></csp-desktop>'
    document.body.append(holder)
    const chrome = styles(holder.querySelector('csp-window')?.shadowRoot as ShadowRoot)
    expect(chrome.length).toBeGreaterThan(0)
    for (const style of chrome) expect(style.nonce).toBe('page')
  })

  it('travels with the styles a popped out window takes along', async () => {
    meta({ property: 'csp-nonce', nonce: 'opener' })
    const mine = document.createElement('style')
    mine.textContent = '.app { color: red; }'
    document.head.append(mine)
    const target = {
      document: document.implementation.createHTMLDocument('popout'),
      closed: false,
      close: vi.fn(),
      focus: vi.fn(),
      moveTo: vi.fn(),
      addEventListener: vi.fn(),
    }
    vi.stubGlobal('open', () => target)
    const manager = createWindowManager({ viewport: { width: 1000, height: 800 } })
    manager.open({ id: 'p', width: 300, height: 200 })
    const content = document.createElement('div')
    document.body.append(content)
    const popped = await popout(manager, 'p', content, { target: 'window' })
    const copied = styles(target.document)
    expect(copied.length).toBeGreaterThan(0)
    for (const style of copied) expect(style.nonce).toBe('opener')
    popped.close()
  })
})

describe('html the library writes into the page', () => {
  function fakeTypes(refuse = false) {
    const made: string[] = []
    const passed: string[] = []
    const factory = {
      createPolicy(name: string, rules: { createHTML(html: string): string }) {
        if (refuse) throw new TypeError('policy not allowed')
        made.push(name)
        return {
          createHTML(html: string) {
            passed.push(html)
            const out = rules.createHTML(html)
            return { toString: () => out }
          },
        }
      },
    }
    return { factory, made, passed }
  }

  it('is handed over as it is where there are no trusted types', () => {
    expect(trustedHtml(window, '<b>x</b>')).toBe('<b>x</b>')
    expect(trustedHtml(null, '<b>x</b>')).toBe('<b>x</b>')
  })

  it('goes through one policy named wmkit where there are', () => {
    const types = fakeTypes()
    const view = { trustedTypes: types.factory } as unknown as Window
    const first = trustedHtml(view, '<b>one</b>')
    const second = trustedHtml(view, '<i>two</i>')
    expect(String(first)).toBe('<b>one</b>')
    expect(String(second)).toBe('<i>two</i>')
    expect(first).not.toBe('<b>one</b>')
    expect(types.made).toEqual(['wmkit'])
    expect(types.passed).toEqual(['<b>one</b>', '<i>two</i>'])
  })

  it('makes a policy for each window of its own', () => {
    const [one, two] = [fakeTypes(), fakeTypes()]
    trustedHtml({ trustedTypes: one.factory } as unknown as Window, 'a')
    trustedHtml({ trustedTypes: two.factory } as unknown as Window, 'b')
    expect([one.made, two.made]).toEqual([['wmkit'], ['wmkit']])
  })

  it('is handed over as it is when the page does not allow the policy, and does not ask twice', () => {
    const types = fakeTypes(true)
    const create = vi.spyOn(types.factory, 'createPolicy')
    const view = { trustedTypes: types.factory } as unknown as Window
    expect(trustedHtml(view, '<b>x</b>')).toBe('<b>x</b>')
    expect(trustedHtml(view, '<b>y</b>')).toBe('<b>y</b>')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('passes through the policy when a skin builds a window and when WinBox takes html', () => {
    const types = fakeTypes()
    vi.stubGlobal('trustedTypes', types.factory)
    mount()
    wm.open({ id: 'a', title: 'Skinned' })
    const plain = skin({
      template:
        '<section><header data-wm-drag>{{title}}</header><div data-wm-content></div></section>',
    })
    const mounted = desktop.mountWindow('a', plain)
    expect(mounted.element.querySelector('header')?.textContent).toBe('Skinned')
    expect(types.passed).toHaveLength(1)
    expect(types.passed[0]).toContain('Skinned')

    const boxRoot = document.createElement('div')
    document.body.append(boxRoot)
    const box = new WinBox('Box', { root: boxRoot, html: '<em>inside</em>' })
    undo.push(() => box.close(true))
    expect(box.body.querySelector('em')?.textContent).toBe('inside')
    expect(types.passed.at(-1)).toBe('<em>inside</em>')
    expect(types.made).toEqual(['wmkit'])
  })
})
