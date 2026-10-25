// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager, WindowState } from '../../src/core/types'
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

  it('expands a placeholder named after an Object.prototype member to nothing', () => {
    const render = compileTemplate('<b>{{toString}}</b><i>{{constructor}}</i>')
    expect(render({ title: 'x' })).toBe('<b></b><i></i>')
  })

  it('refuses a placeholder where escaping cannot keep the value inert', () => {
    for (const template of [
      '<span title={{title}}>t</span>',
      '<span {{title}}>t</span>',
      '<{{title}}>',
      '<span title = {{title}}>t</span>',
      '<a href="{{variant}}">link</a>',
      '<img src="{{id}}">',
      '<button onclick="{{title}}"></button>',
      '<p style="{{title}}"></p>',
      '<p data-x="1" ="{{title}}"></p>',
      '<p data-x=1 ="{{title}}"></p>',
      '<style>.t::before { content: "{{title}}" }</style>',
      '<!-- {{title}} -->',
    ]) {
      expect(() => compileTemplate(template), template).toThrow(/placeholder/)
    }
  })

  it('accepts a placeholder in text and in the quoted values of inert attributes', () => {
    const render = compileTemplate(
      '<b title="a > b" data-id=\'{{id}}\' aria-label="Close {{title}}" class = "{{variant}}">' +
        '{{title}}</b><!-- note --><style>b{}</style>{{stage}}<br/><i data-n=1 title="{{id}}"></i>',
    )
    expect(
      render({ id: 'a', title: 'x onpointerenter=alert(1)', variant: 'v', stage: 'normal' }),
    ).toBe(
      '<b title="a > b" data-id=\'a\' aria-label="Close x onpointerenter=alert(1)" class = "v">' +
        'x onpointerenter=alert(1)</b><!-- note --><style>b{}</style>normal<br/><i data-n=1 title="a"></i>',
    )
  })

  it('keeps a placeholder out of raw-text elements and CDATA, whatever their quotes pretend', () => {
    for (const template of [
      '<textarea><p title="</textarea><img src=x title={{title}}>"></textarea>',
      '<div><title><p title="</title><b id={{title}}>"></title></div>',
      '<xmp><p title="</xmp><b id={{title}}>"></xmp>',
      '<noscript><p title="</noscript><b id={{title}}>"></noscript>',
      '<svg><style><![CDATA[</style><b title="]]><img src=x id={{title}}>">]]></style></svg>',
      '<script>{{title}}</script>',
      '<iframe>{{title}}</iframe>',
      '<noembed>{{title}}</noembed>',
      '<noframes>{{title}}</noframes>',
      '<plaintext></plaintext>{{title}}',
      '<style></stylex>{{title}}</style>',
      '<STYLE>{{title}}</STYLE>',
      '<noscript></noscript><b>{{title}}</b>',
      '<svg><style>{{title}}</style></svg>',
      '<svg><script></script></svg><b>{{title}}</b>',
      '<svg/><style>{{title}}</style>',
      '<math></math><style>{{title}}</style>',
      '<![CDATA[ > <b x="]]>" y={{title}}>',
    ]) {
      expect(() => compileTemplate(template), template).toThrow(/placeholder/)
    }
    const render = compileTemplate(
      '<textarea></textarea>{{title}}<style-x>{{title}}</style-x></svg><b>{{id}}</b>' +
        '<svg aria-label="{{title}}"><title>{{title}}</title><g title="{{id}}"></g>' +
        '<![CDATA[ > <b x="]]>{{id}}</svg><![CDATA[ x ]]>{{id}}',
    )
    expect(render({ title: 't', id: 'i' })).toBe(
      '<textarea></textarea>t<style-x>t</style-x></svg><b>i</b>' +
        '<svg aria-label="t"><title>t</title><g title="i"></g>' +
        '<![CDATA[ > <b x="]]>i</svg><![CDATA[ x ]]>i',
    )
  })

  it('reads a less-than that opens no tag as text, the way the parser does', () => {
    const render = compileTemplate(
      '<span>a < b: {{title}}</span><span>{{title}} <3</span><!x title="> {{id}}' +
        '<?x?>{{id}}<!-->{{id}}<!--->{{id}}</ >{{id}}',
    )
    expect(render({ title: 't', id: 'i' })).toBe(
      '<span>a < b: t</span><span>t <3</span><!x title="> i<?x?>i<!-->i<!--->i</ >i',
    )
    for (const template of ['</{{title}}>', '<!x title="> <b y={{title}}>', '<!x {{title}}>']) {
      expect(() => compileTemplate(template), template).toThrow(/placeholder/)
    }
  })

  it('names the refused placeholder and the markup just before it', () => {
    expect(() => compileTemplate('<section><a href="{{id}}">')).toThrow(
      `({{id}} after '<section><a href="')`,
    )
    expect(() =>
      compileTemplate('<div data-a="{{id}}" data-b="0123456789"><a href="{{title}}">'),
    ).toThrow(`({{title}} after '123456789"><a href="')`)
  })

  it('admits for, value, placeholder and label, and nothing else that could carry a meaning', () => {
    const render = compileTemplate(
      '<label for="f-{{id}}">x</label><input value="{{title}}" placeholder="{{title}}">' +
        '<option label="{{title}}"></option>',
    )
    expect(render({ id: 'a', title: 't' })).toBe(
      '<label for="f-a">x</label><input value="t" placeholder="t"><option label="t"></option>',
    )
    for (const name of [
      'name',
      'tabindex',
      'width',
      'height',
      'form',
      'popovertarget',
      'commandfor',
      'command',
      'is',
      'target',
      'type',
      'content',
    ]) {
      expect(() => compileTemplate(`<i ${name}="{{id}}"></i>`), name).toThrow(/placeholder/)
    }
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

  it('counts the content slot as an attribute, not as a word in the markup', () => {
    for (const template of [
      'data-wm-content',
      '<div>data-wm-content</div>',
      '<div title="[data-wm-content]"></div>',
      '<data-wm-content></data-wm-content>',
    ]) {
      expect(() => skin({ template }), template).toThrow(/exactly one/)
    }
    for (const template of [
      '<section data-wm-content-wrapper><header data-wm-drag></header><div data-wm-content></div></section>',
      '<section><!-- the data-wm-content slot --><div data-wm-content></div></section>',
      '<section><DIV DATA-WM-CONTENT></DIV></section>',
    ]) {
      expect(() => skin({ template }), template).not.toThrow()
    }
  })

  it('refuses a template whose content slot does not end up inside its single root', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a' })
    for (const template of [
      '<section><template><div data-wm-content></div></template></section>',
      '<div></div><div data-wm-content></div>',
      '<section><header data-wm-drag></header><div data-wm-content></div></section><footer>ok</footer>',
    ]) {
      expect(() => harness.desktop.mountWindow('a', skin({ template })), template).toThrow(
        /single root element/,
      )
    }
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

  it('gives a same-named skin its own styles and clears them with the last window wearing them', () => {
    const harness = makeHarness()
    const template = '<section><header data-wm-drag></header><div data-wm-content></div></section>'
    const first = skin({ name: 'custom', styles: '.v1{}', template })
    const second = skin({ name: 'custom', styles: '.v2{}', template })
    const styles = () =>
      [...document.head.querySelectorAll('style[data-wm-skin-styles="custom"]')].map(
        (tag) => tag.textContent,
      )
    harness.wm.open({ id: 'a' })
    harness.wm.open({ id: 'b' })
    harness.wm.open({ id: 'c' })
    const a = harness.desktop.mountWindow('a', first)
    harness.desktop.mountWindow('b', first)
    harness.desktop.mountWindow('c', second)
    expect(styles()).toEqual(['.v1{}', '.v2{}'])

    a.detach()
    expect(styles()).toEqual(['.v1{}', '.v2{}'])
    harness.desktop.destroy()
    expect(styles()).toEqual([])

    const again = makeHarness()
    again.wm.open({ id: 'a' })
    again.desktop.mountWindow('a', first)
    expect(styles()).toEqual(['.v1{}'])
  })

  it('releases the styles of a light skin when the last window wearing it closes', () => {
    const harness = makeHarness()
    const tinted = skin({
      name: 'tinted',
      styles: '.t{}',
      template: '<section><header data-wm-drag></header><div data-wm-content></div></section>',
    })
    const tag = () => document.head.querySelector('style[data-wm-skin-styles="tinted"]')
    harness.wm.open({ id: 'a' })
    harness.wm.open({ id: 'b' })
    harness.desktop.mountWindow('a', tinted)
    harness.desktop.mountWindow('b', tinted)

    harness.wm.close('a')
    expect(tag()).not.toBeNull()
    harness.wm.close('b')
    expect(tag()).toBeNull()
  })

  it('releases its styles once however many times a mount is destroyed', () => {
    const harness = makeHarness()
    const tinted = skin({
      name: 'tinted',
      styles: '.t{}',
      template: '<section><div data-wm-content></div></section>',
    })
    harness.wm.open({ id: 'a' })
    harness.wm.open({ id: 'b' })
    const context = (id: string) => ({
      doc: document,
      id,
      window: harness.wm.get(id) as WindowState,
      actions: harness.desktop.actions(id),
    })
    const first = tinted(context('a'))
    tinted(context('b'))
    first.destroy?.()
    first.destroy?.()
    expect(document.head.querySelector('style[data-wm-skin-styles="tinted"]')).not.toBeNull()
  })

  it('takes any skin name, quotes included', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a' })
    const quoted = skin({
      name: 'my "pro" \\ skin',
      styles: '.x{}',
      template: '<section><div data-wm-content></div></section>',
    })
    const mounted = harness.desktop.mountWindow('a', quoted)
    expect(mounted.element.dataset.wmSkin).toBe('my "pro" \\ skin')
    expect(document.head.querySelector('style')?.dataset.wmSkinStyles).toBe('my "pro" \\ skin')
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

  it('takes its labels as text, never as markup or placeholders', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a', title: 'A' })
    const mounted = harness.desktop.mountWindow(
      'a',
      windowChrome({
        minimize: 'Hide "A" > tray',
        maximize: "it's {{title}}",
        close: '<b data-wm-content>',
      }),
    )
    const label = (selector: string) =>
      mounted.element.querySelector(selector)?.getAttribute('aria-label')
    expect(label('[data-wm-minimize]')).toBe('Hide "A" > tray')
    expect(label('[data-wm-maximize]')).toBe("it's {{title}}")
    expect(label('[data-wm-close]')).toBe('<b data-wm-content>')
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

  it('keeps the template content element, its attributes and its default children', () => {
    const template =
      '<section><header data-wm-drag><span data-wm-title>{{title}}</span></header>' +
      '<div data-wm-content class="body"><p class="lead">{{title}}</p></div></section>'
    const harness = makeHarness()
    harness.wm.open({ id: 'light', title: 'L' })
    harness.wm.open({ id: 'dark', title: 'D' })
    const light = harness.desktop.mountWindow('light', skin({ template }))
    const shadow = harness.desktop.mountWindow('dark', skin({ template, shadow: true }))

    expect(light.content.querySelector('.lead')?.textContent).toBe('L')
    expect(shadow.content.querySelector('.lead')?.textContent).toBe('D')
    expect(shadow.content.classList.contains('body')).toBe(true)
    expect(shadow.content.parentElement).toBe(shadow.element)
    expect(shadow.element.shadowRoot?.querySelector('[data-wm-content], .lead')).toBeNull()
  })

  it('keeps a template that is nothing but a slot', () => {
    const harness = makeHarness()
    harness.wm.open({ id: 'a' })
    const mounted = harness.desktop.mountWindow(
      'a',
      skin({ shadow: true, template: '<div data-wm-content class="only"></div>' }),
    )
    const root = mounted.element.shadowRoot as ShadowRoot

    expect(root.querySelector('slot')).not.toBeNull()
    expect(mounted.content.parentElement).toBe(mounted.element)
    expect(mounted.content.className).toBe('only')
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
