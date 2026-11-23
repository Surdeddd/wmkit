// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowInit, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController } from '../../src/dom/shared'
import {
  createSwitcher,
  type Switcher,
  type SwitcherOptions,
  switcherMessages,
  switcherMessagesRu,
} from '../../src/plugins/switcher'
import { stubFrames } from './support/frames'
import { trackResources } from './support/resources'

let wm: WindowManager
let desktop: DesktopController
let host: HTMLElement
let switcher: Switcher | undefined

function open(id: string, init: WindowInit = {}): HTMLElement {
  wm.open({ id, title: id.toUpperCase(), x: 100, y: 100, width: 300, height: 200, ...init })
  const root = document.createElement('section')
  root.innerHTML = '<header data-wm-drag><span data-wm-title>t</span></header><input>'
  host.append(root)
  desktop.attachWindow(id, root)
  return root
}

function mount(options?: SwitcherOptions): Switcher {
  host = document.createElement('div')
  document.body.append(host)
  wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  desktop = attachDesktop(wm, host, { autoViewport: false, announce: false })
  open('a')
  open('b')
  open('c')
  switcher = createSwitcher(desktop, options)
  return switcher
}

const windowEl = (id: string) => host.querySelector(`[data-wm-window="${id}"]`) as HTMLElement
const options = () => [
  ...(switcher as Switcher).element.querySelectorAll<HTMLElement>('[role=option]'),
]
const listed = () => options().map((option) => option.dataset.wmSwitch)
const picked = () => options().find((option) => option.getAttribute('aria-selected') === 'true')
const key = (target: EventTarget, type: string, name: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}
const backquote = (target: EventTarget, init: KeyboardEventInit = {}) =>
  key(target, 'keydown', '`', { code: 'Backquote', altKey: true, ...init })

beforeEach(() => {
  stubFrames()
})

afterEach(() => {
  switcher?.destroy()
  switcher = undefined
  desktop?.destroy()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('a window switcher', () => {
  it('is a hidden listbox inside the desktop', () => {
    const made = mount()
    expect(made.element.parentElement).toBe(host)
    expect(made.element.hidden).toBe(true)
    expect(made.element.getAttribute('role')).toBe('listbox')
    expect(made.element.tabIndex).toBe(-1)
    expect(options()).toEqual([])
  })

  it('lists the windows from the most recent one, picks the one before it and takes the focus', () => {
    const made = mount()
    wm.focus('a')
    expect(made.open()).toBe(true)
    expect(made.element.hidden).toBe(false)
    expect(made.element.dataset.wmSwitcher).toBe('list')
    expect(made.element.getAttribute('aria-label')).toBe(switcherMessages.label)
    expect(listed()).toEqual(['a', 'c', 'b'])
    expect(options().map((option) => option.textContent)).toEqual(['A', 'C', 'B'])
    expect(picked()?.dataset.wmSwitch).toBe('c')
    expect(made.element.getAttribute('aria-activedescendant')).toBe(picked()?.id)
    expect(new Set(options().map((option) => option.id)).size).toBe(3)
    expect(document.activeElement).toBe(made.element)
  })

  it('picks the top window when nothing has the focus, and the only window when there is one', () => {
    const made = mount()
    wm.blur()
    made.open()
    expect(picked()?.dataset.wmSwitch).toBe('c')
    made.close()
    wm.close('a')
    wm.close('b')
    made.open()
    expect(listed()).toEqual(['c'])
    expect(picked()?.dataset.wmSwitch).toBe('c')
  })

  it('does not open with no window to offer', () => {
    const made = mount()
    wm.setWorkspace(1)
    expect(made.open()).toBe(false)
    expect(made.overview()).toBe(false)
    expect(made.element.hidden).toBe(true)
    expect(backquote(host).defaultPrevented).toBe(true)
    expect(made.element.hidden).toBe(true)
  })

  it('opens while Alt is held and the key is pressed, steps on every press, and switches when Alt goes up', () => {
    const made = mount()
    const field = windowEl('c').querySelector('input') as HTMLElement
    field.focus()
    expect(key(field, 'keydown', '`', { code: 'Backquote' }).defaultPrevented).toBe(false)
    expect(key(field, 'keydown', 'a', { code: 'KeyA', altKey: true }).defaultPrevented).toBe(false)
    expect(made.element.hidden).toBe(true)

    expect(backquote(field).defaultPrevented).toBe(true)
    expect(listed()).toEqual(['c', 'b', 'a'])
    expect(picked()?.dataset.wmSwitch).toBe('b')
    backquote(made.element)
    expect(picked()?.dataset.wmSwitch).toBe('a')
    backquote(made.element)
    expect(picked()?.dataset.wmSwitch).toBe('c')
    backquote(made.element, { shiftKey: true })
    expect(picked()?.dataset.wmSwitch).toBe('a')
    key(document, 'keyup', 'Shift', { altKey: true })
    expect(made.element.hidden).toBe(false)

    key(document, 'keyup', 'Alt')
    expect(made.element.hidden).toBe(true)
    expect(options()).toEqual([])
    expect(wm.getState().focusedId).toBe('a')
    expect(document.activeElement).toBe(windowEl('a'))
  })

  it('stays open after Alt goes up when it was opened by a call, until a choice is made', () => {
    const made = mount()
    made.open()
    key(document, 'keyup', 'Alt')
    expect(made.element.hidden).toBe(false)
    key(made.element, 'keydown', 'Enter')
    expect(made.element.hidden).toBe(true)
    expect(wm.getState().focusedId).toBe('b')
  })

  it('walks with the arrows, Home and End, keeps Tab inside and lets other keys through', () => {
    const made = mount()
    made.open()
    const press = (name: string) => key(made.element, 'keydown', name)
    press('ArrowDown')
    expect(picked()?.dataset.wmSwitch).toBe('a')
    press('ArrowDown')
    expect(picked()?.dataset.wmSwitch).toBe('c')
    press('ArrowUp')
    expect(picked()?.dataset.wmSwitch).toBe('a')
    press('ArrowLeft')
    press('ArrowRight')
    expect(press('Home').defaultPrevented).toBe(true)
    expect(picked()?.dataset.wmSwitch).toBe('c')
    press('End')
    expect(picked()?.dataset.wmSwitch).toBe('a')
    expect(press('Tab').defaultPrevented).toBe(true)
    expect(press('x').defaultPrevented).toBe(false)
    expect(made.element.hidden).toBe(false)
    expect(press(' ').defaultPrevented).toBe(true)
    expect(wm.getState().focusedId).toBe('a')
  })

  it('leaves everything as it was on Escape and gives the focus back', () => {
    const made = mount()
    const field = windowEl('c').querySelector('input') as HTMLElement
    field.focus()
    backquote(field)
    const pressed = key(made.element, 'keydown', 'Escape')
    expect(pressed.defaultPrevented).toBe(true)
    expect(made.element.hidden).toBe(true)
    expect(wm.getState().focusedId).toBe('c')
    expect(document.activeElement).toBe(field)
    key(document, 'keyup', 'Alt')
    expect(wm.getState().focusedId).toBe('c')
  })

  it('switches on a click on a window of the list and closes on a press anywhere else', () => {
    const made = mount()
    made.open()
    options()[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(wm.getState().focusedId).toBe('a')
    expect(made.element.hidden).toBe(true)

    made.open()
    made.element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }))
    expect(made.element.hidden).toBe(false)
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }))
    expect(made.element.hidden).toBe(true)
    expect(wm.getState().focusedId).toBe('a')

    made.open()
    window.dispatchEvent(new Event('blur'))
    expect(made.element.hidden).toBe(true)
  })

  it('closes when the focus goes somewhere else on its own', () => {
    const made = mount()
    made.open()
    ;(windowEl('a').querySelector('input') as HTMLElement).focus()
    expect(made.element.hidden).toBe(true)
  })

  it('lists a minimized window and brings it back when it is chosen', () => {
    const made = mount()
    wm.minimize('c')
    made.open()
    expect(listed()).toEqual(['c', 'b', 'a'])
    options()[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(wm.get('c')?.stage).toBe('normal')
    expect(wm.getState().focusedId).toBe('c')
  })

  it('lists only the modal windows while one is open, and one entry for a group of tabs', () => {
    const made = mount()
    wm.group(['a', 'b'])
    wm.activateTab('a')
    made.open()
    expect(listed().sort()).toEqual(['a', 'c'])
    made.close()
    open('m', { layer: 'modal' })
    made.open()
    expect(listed()).toEqual(['m'])
  })

  it('leaves out the windows a modal of their family blocks, and lists the rest of the desktop', () => {
    const made = mount()
    open('find', { owner: 'b' })
    open('ask', { owner: 'b', layer: 'modal' })
    open('pick', { owner: 'ask' })
    made.open()
    expect(listed().sort()).toEqual(['a', 'ask', 'c', 'pick'])
    made.close()
    open('m', { layer: 'modal' })
    open('own', { owner: 'm' })
    made.open()
    expect(listed().sort()).toEqual(['m', 'own'])
  })

  it('follows the windows while it is open and closes with the last of them', () => {
    const made = mount()
    made.open()
    expect(picked()?.dataset.wmSwitch).toBe('b')
    wm.close('a')
    expect(listed()).toEqual(['c', 'b'])
    expect(picked()?.dataset.wmSwitch).toBe('b')
    wm.close('b')
    expect(listed()).toEqual(['c'])
    expect(picked()?.dataset.wmSwitch).toBe('c')
    wm.update('c', { title: 'Renamed' })
    expect(options()[0]?.textContent).toBe('Renamed')
    wm.setWorkspace(1)
    expect(made.element.hidden).toBe(true)
  })

  it('closes when the manager hands the focus to another window', () => {
    const made = mount()
    made.open()
    wm.close('c')
    expect(made.element.hidden).toBe(true)
    expect(document.activeElement).toBe(windowEl('b'))
  })

  it('takes another key and another modifier, or none at all', () => {
    const made = mount({ shortcut: { code: 'KeyK', modifier: 'ctrl' } })
    expect(backquote(host).defaultPrevented).toBe(false)
    const pressed = key(host, 'keydown', 'k', { code: 'KeyK', ctrlKey: true })
    expect(pressed.defaultPrevented).toBe(true)
    expect(made.element.hidden).toBe(false)
    key(document, 'keyup', 'Alt', { ctrlKey: true })
    expect(made.element.hidden).toBe(false)
    key(document, 'keyup', 'Control')
    expect(made.element.hidden).toBe(true)
    made.destroy()

    switcher = createSwitcher(desktop, { shortcut: { modifier: 'meta' } })
    key(host, 'keydown', '`', { code: 'Backquote', metaKey: true })
    expect(switcher.element.hidden).toBe(false)
    key(document, 'keyup', 'Meta')
    expect(switcher.element.hidden).toBe(true)
    switcher.destroy()

    switcher = createSwitcher(desktop, { shortcut: false })
    expect(backquote(host).defaultPrevented).toBe(false)
    expect(switcher.element.hidden).toBe(true)
    switcher.open()
    expect(backquote(switcher.element).defaultPrevented).toBe(false)
  })

  it('speaks Russian with the Russian catalogue', () => {
    const made = mount({ messages: switcherMessagesRu })
    made.open()
    expect(made.element.getAttribute('aria-label')).toBe('Переключить окно')
    made.overview()
    expect(made.element.getAttribute('aria-label')).toBe('Все окна')
    expect(Object.keys(switcherMessagesRu).sort()).toEqual(Object.keys(switcherMessages).sort())
  })
})

describe('an overview of the windows', () => {
  it('lays the windows of the desktop out in a grid without touching the manager', () => {
    const made = mount({ gap: 20 })
    wm.move('a', 0, 0)
    wm.resize('b', { width: 760, height: 740 })
    const before = wm.getState()
    const steps = wm.canUndo()
    expect(made.overview()).toBe(true)
    expect(wm.getState()).toBe(before)
    expect(wm.canUndo()).toBe(steps)
    expect(made.element.dataset.wmSwitcher).toBe('overview')
    expect(made.element.getAttribute('aria-label')).toBe(switcherMessages.overview)
    expect(listed()).toEqual(['a', 'b', 'c'])
    expect(picked()?.dataset.wmSwitch).toBe('c')

    const cells = options().map((option) => [
      option.style.left,
      option.style.top,
      option.style.width,
      option.style.height,
    ])
    expect(cells).toEqual([
      ['155px', '105px', '300px', '200px'],
      ['705px', '20px', '380px', '370px'],
      ['155px', '495px', '300px', '200px'],
    ])
    expect([windowEl('a').style.translate, windowEl('a').style.scale]).toEqual(['155px 105px', '1'])
    expect([windowEl('b').style.translate, windowEl('b').style.scale]).toEqual([
      '465px -215px',
      '0.5',
    ])
    expect([windowEl('c').style.translate, windowEl('c').style.scale]).toEqual(['55px 395px', '1'])
    for (const id of ['a', 'b', 'c'])
      expect(windowEl(id).hasAttribute('data-wm-overview')).toBe(true)
  })

  it('walks the grid with the arrows and focuses the window that is chosen', () => {
    const made = mount()
    open('d')
    made.overview()
    expect(listed()).toEqual(['a', 'b', 'c', 'd'])
    expect(picked()?.dataset.wmSwitch).toBe('d')
    const press = (name: string) => key(made.element, 'keydown', name)
    press('ArrowUp')
    expect(picked()?.dataset.wmSwitch).toBe('b')
    press('ArrowUp')
    expect(picked()?.dataset.wmSwitch).toBe('b')
    press('ArrowLeft')
    expect(picked()?.dataset.wmSwitch).toBe('a')
    press('ArrowDown')
    expect(picked()?.dataset.wmSwitch).toBe('c')
    press('ArrowDown')
    expect(picked()?.dataset.wmSwitch).toBe('c')
    press('ArrowRight')
    press('ArrowRight')
    expect(picked()?.dataset.wmSwitch).toBe('a')
    press('End')
    press('Home')
    press('ArrowRight')
    press('Enter')
    expect(made.element.hidden).toBe(true)
    expect(wm.getState().focusedId).toBe('b')
    expect(document.activeElement).toBe(windowEl('b'))
    for (const id of ['a', 'b', 'c', 'd']) {
      expect([windowEl(id).style.translate, windowEl(id).style.scale]).toEqual(['', ''])
      expect(windowEl(id).hasAttribute('data-wm-overview')).toBe(false)
    }
  })

  it('focuses the window under a click and leaves on Escape or a click between windows', () => {
    const made = mount()
    made.overview()
    options()[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(wm.getState().focusedId).toBe('a')
    expect(windowEl('a').style.scale).toBe('')

    made.overview()
    made.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(made.element.hidden).toBe(true)
    expect(wm.getState().focusedId).toBe('a')

    made.overview()
    key(made.element, 'keydown', 'Escape')
    expect(made.element.hidden).toBe(true)
    expect(windowEl('b').style.translate).toBe('')
  })

  it('leaves minimized windows out and follows windows that come and go', () => {
    const made = mount()
    open('d')
    wm.minimize('b')
    made.overview()
    expect(listed()).toEqual(['a', 'c', 'd'])
    expect(windowEl('b').style.scale).toBe('')
    wm.close('c')
    expect(listed()).toEqual(['a', 'd'])
    wm.minimize('a')
    expect(listed()).toEqual(['d'])
    expect(windowEl('a').style.scale).toBe('')
    expect(windowEl('a').hasAttribute('data-wm-overview')).toBe(false)
    expect(options()[0]?.style.width).toBe('300px')
    wm.setViewport({ width: 200, height: 150 })
    expect(options()[0]?.style.width).toBe('152px')
    expect(windowEl('d').style.scale).not.toBe('1')
    wm.setWorkspace(1)
    expect(made.element.hidden).toBe(true)
    expect(windowEl('d').style.scale).toBe('')
  })

  it('turns from the list into the overview and back without leaving a trace', () => {
    const made = mount()
    made.overview()
    made.open()
    expect(made.element.dataset.wmSwitcher).toBe('list')
    expect(windowEl('a').style.scale).toBe('')
    expect(options().every((option) => !option.hasAttribute('style'))).toBe(true)
    made.overview()
    expect(windowEl('a').style.scale).not.toBe('')
  })

  it('reads the pivot the theme gave the windows', () => {
    const made = mount({ gap: 20 })
    wm.resize('b', { width: 760, height: 740 })
    const real = window.getComputedStyle
    vi.stubGlobal('getComputedStyle', (node: Element) =>
      node === windowEl('b')
        ? ({ transformOrigin: '0px 0px' } as CSSStyleDeclaration)
        : real.call(window, node),
    )
    made.overview()
    expect(windowEl('b').style.translate).toBe('655px -30px')
  })

  it('glides in and out when it may, and never when motion is reduced or animation is off', () => {
    const made = mount({ animation: 300 })
    const frames: Array<[Keyframe[], KeyframeAnimationOptions]> = []
    const animate = vi.fn(function (
      this: HTMLElement,
      steps: Keyframe[],
      timing: KeyframeAnimationOptions,
    ) {
      frames.push([steps, timing])
      return {} as Animation
    })
    HTMLElement.prototype.animate = animate as never
    wm.move('a', 0, 0)
    made.overview()
    expect(animate).toHaveBeenCalledTimes(3)
    expect(frames[0]?.[0]).toEqual([
      { translate: '0px 0px', scale: '1' },
      { translate: windowEl('a').style.translate, scale: '1' },
    ])
    expect(frames[0]?.[1].duration).toBe(300)
    const there = windowEl('a').style.translate
    made.close()
    expect(animate).toHaveBeenCalledTimes(6)
    expect(frames[3]?.[0]).toEqual([
      { translate: there, scale: '1' },
      { translate: '0px 0px', scale: '1' },
    ])

    animate.mockClear()
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduced-motion') }))
    made.overview()
    made.close()
    expect(animate).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
    stubFrames()
    made.destroy()

    switcher = createSwitcher(desktop, { animation: false })
    switcher.overview()
    switcher.close()
    expect(animate).not.toHaveBeenCalled()
    Reflect.deleteProperty(HTMLElement.prototype, 'animate')
  })

  it('shares one stylesheet between switchers and takes everything away with the last one', () => {
    const resources = trackResources()
    host = document.createElement('div')
    document.body.append(host)
    wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
    desktop = attachDesktop(wm, host, { autoViewport: false, announce: false })
    open('a')
    const before = resources.leaks()
    switcher = createSwitcher(desktop)
    const second = createSwitcher(desktop)
    const sheets = () => document.head.querySelectorAll('style[data-wm-switcher-style]').length
    expect(sheets()).toBe(1)
    second.destroy()
    expect(sheets()).toBe(1)
    switcher.overview()
    switcher.destroy()
    switcher.destroy()
    expect(sheets()).toBe(0)
    expect(switcher.open()).toBe(false)
    expect(host.querySelector('[data-wm-switcher]')).toBeNull()
    expect(windowEl('a').style.scale).toBe('')
    expect(windowEl('a').hasAttribute('data-wm-overview')).toBe(false)
    expect(resources.leaks()).toEqual(before)
    resources.restore()
  })
})

describe('a switcher asked for less usual things', () => {
  it('lists a window that has no element and lays out the ones that do', () => {
    const made = mount()
    wm.open({ id: 'bare', title: 'Bare', width: 300, height: 200 })
    expect(made.overview()).toBe(true)
    expect(listed()).toEqual(['a', 'b', 'c', 'bare'])
    expect(windowEl('a').style.scale).not.toBe('')
    key(made.element, 'keydown', 'Enter')
    expect(wm.getState().focusedId).toBe('bare')
  })

  it('scrolls the list to the window that is picked', () => {
    const scrolled: Element[] = []
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled.push(this)
    }
    const made = mount()
    made.open()
    expect(scrolled).toEqual([picked()])
    key(made.element, 'keydown', 'ArrowDown')
    expect(scrolled.at(-1)).toBe(picked())
    made.overview()
    const before = scrolled.length
    key(made.element, 'keydown', 'ArrowRight')
    expect(scrolled).toHaveLength(before)
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })

  it('has nothing to close or to choose while it is closed', () => {
    const made = mount()
    made.close()
    made.close()
    expect(key(made.element, 'keydown', 'Enter').defaultPrevented).toBe(true)
    expect(wm.getState().focusedId).toBe('c')
    expect(made.element.hidden).toBe(true)
  })

  it('lets its own key through when the modifier is not held', () => {
    const made = mount()
    made.open()
    const plain = key(made.element, 'keydown', '`', { code: 'Backquote' })
    expect(plain.defaultPrevented).toBe(false)
    expect(picked()?.dataset.wmSwitch).toBe('b')
  })
})

describe('a window switcher that is left in an unusual way', () => {
  it('does not hand the focus back to an element that left the page meanwhile', () => {
    const made = mount()
    const input = windowEl('c').querySelector('input') as HTMLElement
    input.focus()
    made.open()
    expect(made.element.contains(document.activeElement)).toBe(true)
    input.remove()
    key(document.activeElement as Element, 'keydown', 'Escape')
    expect(made.element.hidden).toBe(true)
    expect(document.activeElement).not.toBe(input)
  })

  it('focuses nothing on the page when the app closes the chosen window as it comes back', () => {
    const made = mount()
    wm.minimize('a')
    wm.on('stage', ({ window: win }) => {
      if (win.id === 'a' && win.stage === 'normal') wm.close('a')
    })
    made.open()
    const choice = options().find((option) => option.dataset.wmSwitch === 'a')
    expect(choice).toBeDefined()
    expect(() => choice?.dispatchEvent(new MouseEvent('click', { bubbles: true }))).not.toThrow()
    expect(wm.get('a')).toBeUndefined()
    expect(made.element.hidden).toBe(true)
    expect(wm.getState().focusedId).not.toBe('a')
  })
})
