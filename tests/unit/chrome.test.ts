// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController } from '../../src/dom/shared'
import {
  barebones,
  chromeMessagesRu,
  compileTemplate,
  defaultSkin,
  skin,
  windowChrome,
} from '../../src/plugins/chrome'

interface Harness {
  wm: WindowManager
  desktop: DesktopController
  element: HTMLElement
}

function makeHarness(): Harness {
  const element = document.createElement('div')
  document.body.append(element)
  const wm = createWindowManager({ viewport: { width: 1024, height: 768 } })
  const desktop = attachDesktop(wm, element, { autoViewport: false, announce: false })
  return { wm, desktop, element }
}

beforeEach(() => {
  document.body.replaceChildren()
  document.head.replaceChildren()
})

describe('template compiler', () => {
  it('expands placeholders and escapes every substitution', () => {
    const render = compileTemplate('<b>{{title}}</b><i>{{stage}}</i><u>{{nope}}</u>')
    expect(render({ title: '<img src=x onerror=alert(1)>', stage: 'normal' })).toBe(
      '<b>&lt;img src=x onerror=alert(1)&gt;</b><i>normal</i><u></u>',
    )
  })

  it('escapes quotes and ampersands so an attribute cannot be broken out of', () => {
    const render = compileTemplate('<b title="{{title}}">{{title}}</b>')
    expect(render({ title: `a"b'c&d` })).toBe(
      '<b title="a&quot;b&#39;c&amp;d">a&quot;b&#39;c&amp;d</b>',
    )
  })

  it('tolerates spacing inside the braces', () => {
    expect(compileTemplate('{{ title }}')({ title: 'Notes' })).toBe('Notes')
  })
})

describe('skin()', () => {
  it('builds a window from a template and wires its buttons', () => {
    const harness = makeHarness()
    const mac = skin({
      name: 'mac',
      template:
        '<section><header data-wm-drag>' +
        '<button class="c" data-wm-close></button><span data-wm-title>{{title}}</span>' +
        '</header><div data-wm-content></div></section>',
    })
    harness.wm.open({ id: 'a', title: 'Notes', width: 200, height: 150 })
    const mounted = harness.desktop.mountWindow('a', mac)

    expect(mounted.element.dataset.wmSkin).toBe('mac')
    expect(mounted.element.querySelector('[data-wm-title]')?.textContent).toBe('Notes')
    expect(mounted.content.dataset.wmContent).toBe('')
    mounted.element.querySelector<HTMLButtonElement>('.c')?.click()
    expect(harness.wm.get('a')).toBeUndefined()
  })

  it('fills every placeholder from the window it is built for', () => {
    const harness = makeHarness()
    const probe = skin({
      template:
        '<section data-id="{{id}}" data-stage="{{stage}}" data-layer="{{layer}}" ' +
        'data-ws="{{workspace}}" data-variant="{{variant}}">' +
        '<header data-wm-drag>{{title}}</header><div data-wm-content></div></section>',
    })
    harness.wm.open({ id: 'a', title: 'Notes', layer: 'floating', meta: { variant: 'aurora' } })
    harness.wm.maximize('a')
    const { element } = harness.desktop.mountWindow('a', probe)

    expect(element.dataset.id).toBe('a')
    expect(element.dataset.stage).toBe('maximized')
    expect(element.dataset.layer).toBe('floating')
    expect(element.dataset.ws).toBe('0')
    expect(element.dataset.variant).toBe('aurora')
  })

  it('leaves a window without a variant with an empty one rather than the word undefined', () => {
    const harness = makeHarness()
    const probe = skin({
      template:
        '<section data-variant="{{variant}}"><header data-wm-drag></header>' +
        '<div data-wm-content></div></section>',
    })
    harness.wm.open({ id: 'a' })
    expect(harness.desktop.mountWindow('a', probe).element.dataset.variant).toBe('')
  })

  it('refuses a template without exactly one content slot', () => {
    expect(() => skin({ template: '<div></div>' })).toThrow(/exactly one/)
    expect(() =>
      skin({ template: '<div data-wm-content></div><div data-wm-content></div>' }),
    ).toThrow(/exactly one/)
  })

  it('refuses a template whose root or content slot is not a real element', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a' })
    expect(() => harness.desktop.mountWindow('a', skin({ template: 'data-wm-content' }))).toThrow(
      /single root element/,
    )
    expect(() =>
      harness.desktop.mountWindow('a', skin({ template: '<div>data-wm-content</div>' })),
    ).toThrow(/single root element/)
  })

  it('accepts a template whose root is itself the content slot', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a' })
    const mounted = harness.desktop.mountWindow('a', skin({ template: '<div data-wm-content/>' }))
    expect(mounted.content).toBe(mounted.element)
  })

  it('refuses styles it cannot scope to a name', () => {
    expect(() =>
      skin({ template: '<div data-wm-content></div>', styles: 'div { color: red }' }),
    ).toThrow(/needs a name/)
  })

  it('injects the styles of a light skin once and tags the window', () => {
    const harness = makeHarness()
    const tinted = skin({
      name: 'tinted',
      styles: '[data-wm-skin="tinted"] { --wm-bg: red; }',
      template: '<section><header data-wm-drag></header><div data-wm-content></div></section>',
    })
    harness.wm.open({ id: 'a' })
    harness.wm.open({ id: 'b' })
    harness.desktop.mountWindow('a', tinted)
    harness.desktop.mountWindow('b', tinted)

    const sheets = document.head.querySelectorAll('style[data-wm-skin-styles="tinted"]')
    expect(sheets).toHaveLength(1)
    expect(sheets[0]?.textContent).toBe('[data-wm-skin="tinted"] { --wm-bg: red; }')
  })

  it('leaves the head alone for a skin that brings no styles', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a' })
    harness.desktop.mountWindow(
      'a',
      skin({ name: 'plain', template: '<section><div data-wm-content></div></section>' }),
    )
    expect(document.head.querySelector('style')).toBeNull()
  })

  it('ships a default skin with working controls and a bare one without', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Notes' })
    const full = harness.desktop.mountWindow('a', defaultSkin)
    expect(full.element.querySelector('[data-wm-close]')).not.toBeNull()
    expect(full.element.querySelector('[data-wm-minimize]')).not.toBeNull()
    expect(full.element.querySelector('[data-wm-maximize]')).not.toBeNull()
    full.element.querySelector<HTMLButtonElement>('[data-wm-minimize]')?.click()
    expect(harness.wm.get('a')?.stage).toBe('minimized')

    harness.wm.open({ id: 'b', title: 'Bare' })
    const bare = harness.desktop.mountWindow('b', barebones)
    expect(bare.element.querySelector('[data-wm-close]')).toBeNull()
    expect(bare.element.querySelector('[data-wm-drag]')).not.toBeNull()
    expect(bare.element.querySelector('[data-wm-title]')?.textContent).toBe('Bare')
  })

  it('labels the default controls in the language it is handed', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Notes' })
    const ru = harness.desktop.mountWindow('a', windowChrome(chromeMessagesRu))

    expect(ru.element.querySelector('[data-wm-close]')?.getAttribute('aria-label')).toBe('Закрыть')
    expect(ru.element.querySelector('[data-wm-minimize]')?.getAttribute('aria-label')).toBe(
      'Свернуть',
    )
  })
})

const SHADOW_TEMPLATE =
  '<section><header data-wm-drag><span data-wm-title>{{title}}</span></header>' +
  '<div data-wm-content></div></section>'

function stubConstructableSheets(): () => void {
  const owned = new WeakMap<ShadowRoot, readonly CSSStyleSheet[]>()
  Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', {
    configurable: true,
    value(this: { cssText: string }, css: string) {
      this.cssText = css
    },
  })
  Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
    configurable: true,
    get(this: ShadowRoot) {
      return owned.get(this) ?? []
    },
    set(this: ShadowRoot, sheets: readonly CSSStyleSheet[]) {
      owned.set(this, sheets)
    },
  })
  return () => {
    Reflect.deleteProperty(CSSStyleSheet.prototype, 'replaceSync')
    Reflect.deleteProperty(ShadowRoot.prototype, 'adoptedStyleSheets')
  }
}

describe('shadow skins', () => {
  it('mounts the chrome in a shadow root and projects the content', () => {
    const harness = makeHarness()
    const isolated = skin({ name: 'iso', shadow: true, template: SHADOW_TEMPLATE })
    harness.wm.open({ id: 'a', title: 'Notes' })
    const mounted = harness.desktop.mountWindow('a', isolated)

    expect(mounted.element.shadowRoot).not.toBeNull()
    expect(mounted.element.dataset.wmSkin).toBe('iso')
    expect(mounted.element.shadowRoot?.querySelector('[data-wm-title]')?.textContent).toBe('Notes')
    expect(mounted.element.querySelector('[data-wm-drag]')).toBeNull()
    expect(mounted.element.shadowRoot?.querySelector('slot')).not.toBeNull()
    expect(mounted.content.getRootNode()).toBe(document)
    expect(mounted.content.parentElement).toBe(mounted.element)
  })

  it('puts the chrome straight in the shadow root so :host is its layout box', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'Notes' })
    const mounted = harness.desktop.mountWindow(
      'a',
      skin({ shadow: true, template: SHADOW_TEMPLATE }),
    )
    const root = mounted.element.shadowRoot as ShadowRoot

    expect(root.querySelector('section')).toBeNull()
    expect(root.firstElementChild?.tagName).toBe('HEADER')
    expect([...root.children].some((node) => node.tagName === 'SLOT')).toBe(true)
  })

  it('keeps a template that is nothing but a slot', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a' })
    const mounted = harness.desktop.mountWindow(
      'a',
      skin({ shadow: true, template: '<div data-wm-content></div>' }),
    )
    const root = mounted.element.shadowRoot as ShadowRoot

    expect(root.querySelector('slot')).not.toBeNull()
    expect(mounted.content.parentElement).toBe(mounted.element)
  })

  it('keeps the resize grips out of reach of page css', () => {
    const harness = makeHarness()
    const isolated = skin({ name: 'iso', shadow: true, template: SHADOW_TEMPLATE })
    harness.wm.open({ id: 'a', title: 'Notes' })
    const mounted = harness.desktop.mountWindow('a', isolated)

    expect(mounted.element.querySelector('[data-wm-resize]')).toBeNull()
    expect(mounted.element.shadowRoot?.querySelectorAll('[data-wm-resize]')).toHaveLength(8)

    mounted.detach()
    expect(mounted.element.shadowRoot?.querySelector('[data-wm-resize]')).toBeNull()
  })

  it('renames a shadow window through the boundary', () => {
    const harness = makeHarness()
    const isolated = skin({ name: 'iso', shadow: true, template: SHADOW_TEMPLATE })
    harness.wm.open({ id: 'a', title: 'Notes' })
    const mounted = harness.desktop.mountWindow('a', isolated)

    harness.wm.update('a', { title: 'Renamed' })
    expect(mounted.element.shadowRoot?.querySelector('[data-wm-title]')?.textContent).toBe(
      'Renamed',
    )
    expect(mounted.element.getAttribute('aria-label')).toBe('Renamed')
    expect(mounted.element.hasAttribute('aria-labelledby')).toBe(false)
  })

  it('falls back to a style tag where constructable sheets are missing', () => {
    const harness = makeHarness()
    const isolated = skin({
      name: 'iso',
      shadow: true,
      styles: ':host { display: block }',
      template: SHADOW_TEMPLATE,
    })
    harness.wm.open({ id: 'a' })
    const mounted = harness.desktop.mountWindow('a', isolated)

    const tag = mounted.element.shadowRoot?.querySelector('style')
    expect(tag?.textContent).toBe(':host { display: block }')
    expect(document.head.querySelector('style')).toBeNull()
  })

  it('shares one stylesheet between every window of a shadow skin', () => {
    const restore = stubConstructableSheets()
    try {
      const harness = makeHarness()
      const isolated = skin({
        name: 'iso',
        shadow: true,
        styles: ':host { display: block }',
        template: SHADOW_TEMPLATE,
      })
      harness.wm.open({ id: 'a' })
      harness.wm.open({ id: 'b' })
      const first = harness.desktop.mountWindow('a', isolated)
      const second = harness.desktop.mountWindow('b', isolated)

      const sheet = first.element.shadowRoot?.adoptedStyleSheets[0]
      expect(sheet).toBeDefined()
      expect(second.element.shadowRoot?.adoptedStyleSheets[0]).toBe(sheet)
      expect((sheet as unknown as { cssText: string }).cssText).toBe(':host { display: block }')
      expect(first.element.shadowRoot?.querySelector('style')).toBeNull()
    } finally {
      restore()
    }
  })

  it('gives a second skin a stylesheet of its own', () => {
    const restore = stubConstructableSheets()
    try {
      const harness = makeHarness()
      const one = skin({ name: 'one', shadow: true, styles: 'a{}', template: SHADOW_TEMPLATE })
      const two = skin({ name: 'two', shadow: true, styles: 'b{}', template: SHADOW_TEMPLATE })
      harness.wm.open({ id: 'a' })
      harness.wm.open({ id: 'b' })

      expect(
        harness.desktop.mountWindow('a', one).element.shadowRoot?.adoptedStyleSheets[0],
      ).not.toBe(harness.desktop.mountWindow('b', two).element.shadowRoot?.adoptedStyleSheets[0])
    } finally {
      restore()
    }
  })

  it('mounts a shadow skin that brings no styles at all', () => {
    const restore = stubConstructableSheets()
    try {
      const harness = makeHarness()
      harness.wm.open({ id: 'a' })
      const mounted = harness.desktop.mountWindow(
        'a',
        skin({ shadow: true, template: SHADOW_TEMPLATE }),
      )
      expect(mounted.element.shadowRoot?.adoptedStyleSheets).toHaveLength(0)
      expect(mounted.element.dataset.wmSkin).toBeUndefined()
    } finally {
      restore()
    }
  })
})
