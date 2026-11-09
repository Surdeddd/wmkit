// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDock } from '../../src/plugins/dock'
import {
  defineWmElements,
  type WmDesktopElement,
  type WmWindowElement,
} from '../../src/plugins/elements'
import { themeStyle } from '../../src/themes'

class StubObserver {
  observe(): void {}
  disconnect(): void {}
}

function mount(html: string): WmDesktopElement {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  return holder.querySelector('wm-desktop') as WmDesktopElement
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubObserver)
  defineWmElements()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

const windowOf = (desktop: WmDesktopElement, id: string) =>
  desktop.querySelector(`[window-id="${id}"]`) as WmWindowElement
const rootOf = (desktop: WmDesktopElement, id: string) =>
  windowOf(desktop, id).shadowRoot as ShadowRoot
const shown = (desktop: WmDesktopElement, id: string) =>
  [...rootOf(desktop, id).querySelectorAll<HTMLElement>('[part~=control]')]
    .filter((button) => !button.hidden)
    .map((button) => button.getAttribute('part'))
const stripOf = (desktop: WmDesktopElement, id: string) =>
  rootOf(desktop, id).querySelector('[part=tabs]') as HTMLElement
const tabsOf = (desktop: WmDesktopElement, id: string) => [
  ...stripOf(desktop, id).querySelectorAll<HTMLButtonElement>('[part~=tab]'),
]

describe('the chrome buttons', () => {
  it('show only what the window flags allow and follow flag changes', () => {
    const desktop = mount(`<wm-desktop>
      <wm-window window-id="a" closable="false"></wm-window>
      <wm-window window-id="b"></wm-window>
    </wm-desktop>`)
    expect(shown(desktop, 'a')).toEqual(['control minimize', 'control maximize'])
    expect(shown(desktop, 'b')).toEqual(['control minimize', 'control maximize', 'control close'])
    desktop.manager?.update('a', { minimizable: false, closable: true })
    expect(shown(desktop, 'a')).toEqual(['control maximize', 'control close'])
    const close = rootOf(desktop, 'b').querySelector('[part~=close]') as HTMLElement
    expect(close.textContent).toBe('')
    expect(close.hasAttribute('data-wm-close')).toBe(true)
    expect(close.parentElement?.hasAttribute('data-wm-controls')).toBe(true)
  })

  it('drop the minimize button while the window is docked', () => {
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a"></wm-window><wm-window window-id="b"></wm-window></wm-desktop>',
    )
    desktop.manager?.setViewport({ width: 1000, height: 600 })
    const dock = createDock(desktop.controller as NonNullable<WmDesktopElement['controller']>)
    dock.dock('a')
    expect(shown(desktop, 'a')).toEqual(['control maximize', 'control close'])
    dock.undock('a')
    expect(shown(desktop, 'a')).toEqual(['control minimize', 'control maximize', 'control close'])
  })
})

describe('a tab group', () => {
  const group = () => {
    const desktop = mount(`<wm-desktop>
      <wm-window window-id="a" label="Revenue"></wm-window>
      <wm-window window-id="b" label="Live log"></wm-window>
      <wm-window window-id="c" label="Orders"></wm-window>
    </wm-desktop>`)
    const wm = desktop.manager as NonNullable<WmDesktopElement['manager']>
    wm.group(['a', 'b'])
    return { desktop, wm }
  }

  it('shows a tab strip on its active member and nowhere else', () => {
    const { desktop, wm } = group()
    const active = wm.getState().groups[wm.get('a')?.groupId as string]?.activeId as string
    const other = active === 'a' ? 'b' : 'a'
    const strip = stripOf(desktop, active)
    expect(strip.hidden).toBe(false)
    expect(strip.getAttribute('role')).toBe('tablist')
    expect(strip.getAttribute('aria-label')).toBe('Tabs')
    expect((rootOf(desktop, active).querySelector('[part=title]') as HTMLElement).hidden).toBe(true)
    expect(
      tabsOf(desktop, active).map((tab) => [
        tab.textContent,
        tab.getAttribute('role'),
        tab.getAttribute('aria-selected'),
        tab.tabIndex,
        tab.getAttribute('part'),
        tab.dataset.windowId,
      ]),
    ).toEqual([
      [
        'Revenue',
        'tab',
        String(active === 'a'),
        active === 'a' ? 0 : -1,
        active === 'a' ? 'tab active' : 'tab',
        'a',
      ],
      [
        'Live log',
        'tab',
        String(active === 'b'),
        active === 'b' ? 0 : -1,
        active === 'b' ? 'tab active' : 'tab',
        'b',
      ],
    ])
    expect(stripOf(desktop, other).hidden).toBe(true)
    expect(stripOf(desktop, 'c').hidden).toBe(true)
    expect((rootOf(desktop, 'c').querySelector('[part=title]') as HTMLElement).hidden).toBe(false)
  })

  it('switches tabs with a click and hands the focus to the new strip', () => {
    const { desktop, wm } = group()
    wm.activateTab('a')
    const [revenue, log] = tabsOf(desktop, 'a') as [HTMLButtonElement, HTMLButtonElement]
    stripOf(desktop, 'a').click()
    revenue.click()
    expect(wm.getState().groups[wm.get('a')?.groupId as string]?.activeId).toBe('a')
    log.click()
    expect(wm.getState().groups[wm.get('a')?.groupId as string]?.activeId).toBe('b')
    expect(windowOf(desktop, 'a').hidden).toBe(true)
    expect(windowOf(desktop, 'b').hidden).toBe(false)
    const selected = tabsOf(desktop, 'b').find(
      (tab) => tab.getAttribute('aria-selected') === 'true',
    )
    expect(selected?.textContent).toBe('Live log')
    expect(rootOf(desktop, 'b').activeElement).toBe(selected)
  })

  it('moves the focus between tabs with the arrow keys, Home and End', () => {
    const { desktop, wm } = group()
    wm.update('c', { title: 'Orders' })
    wm.batch(() => {
      wm.ungroup('a')
      wm.group(['a', 'b', 'c'])
      wm.activateTab('a')
    })
    const strip = stripOf(desktop, 'a')
    const tabs = tabsOf(desktop, 'a')
    const press = (key: string) => {
      const focused = (rootOf(desktop, 'a').activeElement ?? tabs[0]) as HTMLElement
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      focused.dispatchEvent(event)
      return event.defaultPrevented
    }
    ;(tabs[0] as HTMLElement).focus()
    expect(press('ArrowLeft')).toBe(true)
    expect(rootOf(desktop, 'a').activeElement).toBe(tabs[2])
    press('ArrowRight')
    expect(rootOf(desktop, 'a').activeElement).toBe(tabs[0])
    press('End')
    press('Home')
    press('ArrowRight')
    expect(rootOf(desktop, 'a').activeElement).toBe(tabs[1])
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1])
    expect(press('a')).toBe(false)
    expect(strip.contains(rootOf(desktop, 'a').activeElement)).toBe(true)
    expect(wm.getState().groups[wm.get('a')?.groupId as string]?.activeId).toBe('a')
  })

  it('follows member titles and ungrouping, and leaves the strip alone on unrelated changes', () => {
    const { desktop, wm } = group()
    wm.activateTab('a')
    const before = tabsOf(desktop, 'a')
    wm.move('c', 300, 200)
    wm.move('a', 40, 40)
    expect(tabsOf(desktop, 'a')).toEqual(before)
    expect(tabsOf(desktop, 'a')[0]).toBe(before[0])
    wm.update('b', { title: '' })
    expect(tabsOf(desktop, 'a').map((tab) => tab.textContent)).toEqual(['Revenue', 'b'])
    wm.ungroup('b')
    expect(stripOf(desktop, 'a').hidden).toBe(true)
    expect(tabsOf(desktop, 'a')).toEqual([])
    expect((rootOf(desktop, 'a').querySelector('[part=title]') as HTMLElement).hidden).toBe(false)
  })

  it('names the strip in the language of the page or of the desktop messages', () => {
    const ru = mount(
      '<wm-desktop lang="ru"><wm-window window-id="a"></wm-window><wm-window window-id="b"></wm-window></wm-desktop>',
    )
    expect(stripOf(ru, 'a').getAttribute('aria-label')).toBe('Вкладки')
    const desktop = document.createElement('wm-desktop') as WmDesktopElement
    desktop.messages = { minimize: 'Réduire', maximize: 'Agrandir', close: 'Fermer' }
    document.body.append(desktop)
    const element = document.createElement('wm-window')
    desktop.append(element)
    const strip = (element.shadowRoot as ShadowRoot).querySelector('[part=tabs]') as HTMLElement
    expect(strip.getAttribute('aria-label')).toBe('Tabs')
  })

  it('ignores a click on a tab once the desktop is gone', async () => {
    const { desktop, wm } = group()
    wm.activateTab('a')
    const [, log] = tabsOf(desktop, 'a') as [HTMLButtonElement, HTMLButtonElement]
    desktop.remove()
    await new Promise<void>((resolve) => queueMicrotask(resolve))
    expect(() => log.click()).not.toThrow()
  })
})

describe('desktop styles', () => {
  const adopted = new WeakMap<ShadowRoot, CSSStyleSheet[]>()

  function constructable(): void {
    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
      configurable: true,
      get(this: ShadowRoot) {
        return adopted.get(this) ?? []
      },
      set(this: ShadowRoot, sheets: CSSStyleSheet[]) {
        adopted.set(this, sheets)
      },
    })
    Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', {
      configurable: true,
      value(this: CSSStyleSheet, text: string) {
        const style = document.createElement('style')
        style.textContent = text
        document.head.append(style)
        for (const rule of (style.sheet as CSSStyleSheet).cssRules) {
          this.insertRule(rule.cssText, this.cssRules.length)
        }
        style.remove()
      },
    })
  }

  afterEach(() => {
    Reflect.deleteProperty(ShadowRoot.prototype, 'adoptedStyleSheets')
    Reflect.deleteProperty(CSSStyleSheet.prototype, 'replaceSync')
  })

  const textOf = (sheet: CSSStyleSheet) => [...sheet.cssRules].map((rule) => rule.cssText).join('')

  it('adopts a string, a sheet or a list of both into every window, later ones too', () => {
    constructable()
    const desktop = mount('<wm-desktop><wm-window window-id="a"></wm-window></wm-desktop>')
    expect(desktop.styles).toBeNull()
    desktop.styles = '[part=title]{color:red}'
    expect(desktop.styles).toBe('[part=title]{color:red}')
    expect(rootOf(desktop, 'a').adoptedStyleSheets.map(textOf)).toEqual([
      '[part=title] {color: red;}',
    ])

    const own = new CSSStyleSheet()
    own.insertRule('[part=content]{padding:4px}', 0)
    const foreign = new CSSStyleSheet()
    rootOf(desktop, 'a').adoptedStyleSheets = [foreign, ...rootOf(desktop, 'a').adoptedStyleSheets]
    desktop.styles = [own, '[part=titlebar]{height:20px}']
    expect(rootOf(desktop, 'a').adoptedStyleSheets[0]).toBe(foreign)
    expect(rootOf(desktop, 'a').adoptedStyleSheets[1]).toBe(own)
    expect(rootOf(desktop, 'a').adoptedStyleSheets.map(textOf).slice(1)).toEqual([
      '[part=content] {padding: 4px;}',
      '[part=titlebar] {height: 20px;}',
    ])

    const later = document.createElement('wm-window')
    desktop.append(later)
    expect(later.shadowRoot?.adoptedStyleSheets[0]).toBe(own)
    desktop.styles = own
    expect(later.shadowRoot?.adoptedStyleSheets).toEqual([own])
    desktop.styles = null
    expect(rootOf(desktop, 'a').adoptedStyleSheets).toEqual([foreign])
    expect(later.shadowRoot?.adoptedStyleSheets).toEqual([])
  })

  it('brings the structural rules of a shadow theme into the chrome', () => {
    constructable()
    const desktop = mount(
      '<wm-desktop><wm-window window-id="a" label="A"></wm-window></wm-desktop>',
    )
    desktop.styles = themeStyle('retro', { shadow: true })
    const root = rootOf(desktop, 'a')
    const rules = [...(root.adoptedStyleSheets[0] as CSSStyleSheet).cssRules] as CSSStyleRule[]
    const ruleFor = (selector: string) =>
      rules.find((rule) => rule.selectorText?.replace(/\s+/g, ' ') === selector)
    const titlebar = root.querySelector('[part=titlebar]') as HTMLElement
    const drag = ruleFor('[data-wm-drag]') as CSSStyleRule
    expect(titlebar.matches(drag.selectorText)).toBe(true)
    expect(drag.cssText).toContain('var(--wm-title-inactive)')
    const title = ruleFor('[data-wm-title]') as CSSStyleRule
    expect((root.querySelector('[part=title]') as HTMLElement).matches(title.selectorText)).toBe(
      true,
    )
    const controls = ruleFor('[data-wm-controls]') as CSSStyleRule
    const close = root.querySelector('[part~=close]') as HTMLElement
    expect((close.parentElement as HTMLElement).matches(controls.selectorText)).toBe(true)
    const buttons = ruleFor(
      '[data-wm-close], [data-wm-minimize], [data-wm-maximize]',
    ) as CSSStyleRule
    for (const button of root.querySelectorAll('[part~=control]')) {
      expect(button.matches(buttons.selectorText)).toBe(true)
    }
  })

  it('skips strings where constructable sheets are missing and still adopts given sheets', () => {
    const desktop = mount('<wm-desktop><wm-window window-id="a"></wm-window></wm-desktop>')
    expect(() => {
      desktop.styles = '[part=title]{color:red}'
    }).not.toThrow()
    expect(rootOf(desktop, 'a').adoptedStyleSheets).toBeUndefined()
    const sheet = new CSSStyleSheet()
    desktop.styles = [sheet]
    expect(rootOf(desktop, 'a').adoptedStyleSheets).toEqual([sheet])
  })
})
