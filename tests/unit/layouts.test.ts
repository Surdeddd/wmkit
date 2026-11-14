// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { Bounds, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController } from '../../src/dom/shared'
import {
  createLayoutPicker,
  type LayoutPicker,
  type LayoutPickerOptions,
  layoutMessages,
  layoutMessagesRu,
  type SnapLayout,
  snapLayouts,
} from '../../src/plugins/layouts'
import { stubFrames } from './support/frames'
import { trackResources } from './support/resources'

let wm: WindowManager
let desktop: DesktopController
let host: HTMLElement
let picker: LayoutPicker

function build(id: string): HTMLElement {
  const root = document.createElement('section')
  root.innerHTML =
    '<header data-wm-drag><span data-wm-title>t</span>' +
    '<button data-wm-maximize type="button" aria-label="Maximize"></button></header>' +
    '<div data-wm-content><input></div>'
  host.append(root)
  desktop.attachWindow(id, root)
  return root
}

function mount(options?: LayoutPickerOptions): void {
  host = document.createElement('div')
  document.body.append(host)
  wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  desktop = attachDesktop(wm, host, { autoViewport: false, announce: false })
  wm.open({ id: 'a', x: 100, y: 100, width: 300, height: 200 })
  wm.open({ id: 'b', x: 500, y: 100, width: 300, height: 200 })
  build('a')
  build('b')
  picker = createLayoutPicker(desktop, options)
}

const windowEl = (id: string) => host.querySelector(`[data-wm-window="${id}"]`) as HTMLElement
const maximize = (id: string) => windowEl(id).querySelector('[data-wm-maximize]') as HTMLElement
const cells = () => [...picker.element.querySelectorAll<HTMLButtonElement>('[data-wm-layout-cell]')]
const key = (target: Element, name: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}
const pointer = (target: Element, type: string, pointerType = 'mouse') => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  target.dispatchEvent(event)
  return event
}

beforeEach(() => {
  stubFrames()
})

afterEach(() => {
  picker?.destroy()
  desktop?.destroy()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('the layouts that come with the package', () => {
  it.each(
    Object.entries(snapLayouts),
  )('%s tiles the whole desktop without overlap', (_name, layout) => {
    const overlap = (a: Bounds, b: Bounds) =>
      Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1e-9 &&
      Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1e-9
    let area = 0
    layout.forEach((rect, index) => {
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(1 + 1e-9)
      expect(rect.y + rect.height).toBeLessThanOrEqual(1 + 1e-9)
      area += rect.width * rect.height
      for (const other of layout.slice(index + 1)) expect(overlap(rect, other)).toBe(false)
    })
    expect(area).toBeCloseTo(1, 9)
  })
})

describe('a layout picker', () => {
  it('is a hidden menu inside the desktop with an item for every area of every layout', () => {
    mount()
    expect(picker.element.parentElement).toBe(host)
    expect(picker.element.hidden).toBe(true)
    expect(picker.element.getAttribute('role')).toBe('menu')
    expect(picker.element.getAttribute('aria-label')).toBe(layoutMessages.label)
    const groups = [...picker.element.querySelectorAll('[data-wm-layout]')]
    expect(groups.map((group) => group.querySelectorAll('[data-wm-layout-cell]').length)).toEqual([
      2, 2, 3, 4,
    ])
    for (const group of groups) expect(group.getAttribute('role')).toBe('group')
    const [first, second] = cells()
    expect(first?.getAttribute('role')).toBe('menuitem')
    expect(first?.type).toBe('button')
    expect(first?.getAttribute('aria-label')).toBe('Layout 1, area 1 of 2')
    expect(second?.getAttribute('aria-label')).toBe('Layout 1, area 2 of 2')
    expect([first?.style.left, first?.style.top, first?.style.width, first?.style.height]).toEqual([
      '0%',
      '0%',
      '50%',
      '100%',
    ])
    expect(cells()[4]?.style.left).toBe('0%')
    expect(cells()[5]?.style.left).toBe('33.33%')
    expect(cells()[5]?.style.width).toBe('33.33%')
    expect(cells().every((cell) => cell.tabIndex === -1)).toBe(true)
  })

  it('opens for a window that may be snapped and for no other', () => {
    mount()
    expect(picker.open('nope')).toBe(false)
    wm.update('a', { snappable: false })
    expect(picker.open('a')).toBe(false)
    wm.minimize('b')
    expect(picker.open('b')).toBe(false)
    expect(picker.element.hidden).toBe(true)
    wm.update('a', { snappable: true })
    expect(picker.open('a')).toBe(true)
    expect(picker.element.hidden).toBe(false)
    expect(maximize('a').getAttribute('aria-expanded')).toBe('true')
    picker.close()
    picker.close()
    expect(picker.element.hidden).toBe(true)
    expect(maximize('a').hasAttribute('aria-expanded')).toBe(false)
  })

  it('snaps the window to the area that is chosen, as one step of history, and gives it the focus', () => {
    mount()
    wm.focus('b')
    picker.open('a')
    cells()[0]?.focus()
    cells()[5]?.click()
    const snapped = wm.get('a')
    expect(snapped?.stage).toBe('snapped')
    expect(snapped?.snapRect).toEqual(snapLayouts.thirds[1])
    expect(snapped?.bounds).toEqual({ x: 400, y: 0, width: 400, height: 800 })
    expect(wm.getState().focusedId).toBe('a')
    expect(picker.element.hidden).toBe(true)
    expect(document.activeElement).toBe(windowEl('a'))
    wm.undo()
    expect(wm.get('a')?.stage).toBe('normal')
    expect(wm.getState().focusedId).toBe('b')
  })

  it('walks the areas with the arrows, Home and End, and lets Escape and Tab close it', () => {
    mount()
    picker.open('a')
    const all = cells()
    all[0]?.focus()
    key(all[0] as Element, 'ArrowRight')
    expect(document.activeElement).toBe(all[1])
    key(all[1] as Element, 'ArrowDown')
    expect(document.activeElement).toBe(all[2])
    key(all[2] as Element, 'ArrowLeft')
    key(all[1] as Element, 'ArrowUp')
    expect(document.activeElement).toBe(all[0])
    key(all[0] as Element, 'ArrowLeft')
    expect(document.activeElement).toBe(all.at(-1))
    key(all.at(-1) as Element, 'ArrowRight')
    expect(document.activeElement).toBe(all[0])
    key(all[0] as Element, 'End')
    expect(document.activeElement).toBe(all.at(-1))
    expect(key(all.at(-1) as Element, 'Home').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(all[0])
    expect(key(all[0] as Element, 'x').defaultPrevented).toBe(false)

    const left = key(all[0] as Element, 'Escape')
    expect(left.defaultPrevented).toBe(true)
    expect(picker.element.hidden).toBe(true)
    expect(document.activeElement).toBe(windowEl('a'))
    expect(wm.get('a')?.stage).toBe('normal')

    picker.open('a')
    all[3]?.focus()
    expect(key(all[3] as Element, 'Tab').defaultPrevented).toBe(false)
    expect(picker.element.hidden).toBe(true)
  })

  it('opens on Ctrl or Cmd with Alt and L for the focused window and focuses the first area', () => {
    mount()
    wm.focus('b')
    const field = windowEl('b').querySelector('input') as HTMLElement
    expect(key(field, 'l', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(key(field, 'l', { altKey: true }).defaultPrevented).toBe(false)
    expect(key(field, 'k', { ctrlKey: true, altKey: true }).defaultPrevented).toBe(false)
    expect(picker.element.hidden).toBe(true)
    expect(key(field, 'l', { ctrlKey: true, altKey: true }).defaultPrevented).toBe(true)
    expect(picker.element.hidden).toBe(false)
    expect(document.activeElement).toBe(cells()[0])
    expect(maximize('b').getAttribute('aria-expanded')).toBe('true')
    picker.close()
    expect(key(field, '¬', { metaKey: true, altKey: true, code: 'KeyL' }).defaultPrevented).toBe(
      true,
    )
    picker.close()
    wm.blur()
    expect(key(field, 'L', { metaKey: true, altKey: true }).defaultPrevented).toBe(false)
    expect(picker.element.hidden).toBe(true)
  })

  it('has no shortcut when it is told so', () => {
    mount({ shortcut: false })
    const field = windowEl('b').querySelector('input') as HTMLElement
    expect(key(field, 'l', { ctrlKey: true, altKey: true }).defaultPrevented).toBe(false)
    expect(picker.element.hidden).toBe(true)
  })

  it('opens when a mouse rests on a maximize button, and not for a touch or a short visit', () => {
    vi.useFakeTimers()
    mount()
    pointer(maximize('a'), 'pointerover')
    vi.advanceTimersByTime(399)
    expect(picker.element.hidden).toBe(true)
    vi.advanceTimersByTime(1)
    expect(picker.element.hidden).toBe(false)
    expect(maximize('a').getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).not.toBe(cells()[0])
    picker.close()

    pointer(maximize('a'), 'pointerover')
    vi.advanceTimersByTime(200)
    pointer(windowEl('a'), 'pointerover')
    vi.advanceTimersByTime(2000)
    expect(picker.element.hidden).toBe(true)

    pointer(maximize('b'), 'pointerover', 'touch')
    pointer(maximize('b'), 'pointerover', 'pen')
    vi.advanceTimersByTime(2000)
    expect(picker.element.hidden).toBe(true)
  })

  it('stays while the pointer is on the button or on the menu and goes soon after it leaves both', () => {
    vi.useFakeTimers()
    mount({ hover: 50 })
    pointer(maximize('a'), 'pointerover')
    vi.advanceTimersByTime(50)
    expect(picker.element.hidden).toBe(false)
    pointer(windowEl('a'), 'pointerover')
    vi.advanceTimersByTime(250)
    pointer(cells()[1] as Element, 'pointerover')
    vi.advanceTimersByTime(5000)
    expect(picker.element.hidden).toBe(false)
    pointer(host, 'pointerover')
    vi.advanceTimersByTime(100)
    pointer(maximize('a'), 'pointerover')
    vi.advanceTimersByTime(5000)
    expect(picker.element.hidden).toBe(false)
    pointer(host, 'pointerover')
    pointer(host, 'pointerover')
    vi.advanceTimersByTime(299)
    expect(picker.element.hidden).toBe(false)
    vi.advanceTimersByTime(1)
    expect(picker.element.hidden).toBe(true)
  })

  it('moves to the other window when the mouse rests on its button', () => {
    vi.useFakeTimers()
    mount({ hover: 50 })
    pointer(maximize('a'), 'pointerover')
    vi.advanceTimersByTime(50)
    pointer(maximize('b'), 'pointerover')
    vi.advanceTimersByTime(50)
    expect(picker.element.hidden).toBe(false)
    expect(maximize('a').hasAttribute('aria-expanded')).toBe(false)
    expect(maximize('b').getAttribute('aria-expanded')).toBe('true')
    cells()[0]?.click()
    expect(wm.get('b')?.stage).toBe('snapped')
    expect(wm.get('a')?.stage).toBe('normal')
  })

  it('forgets a visit and goes away when the mouse leaves the desktop altogether', () => {
    vi.useFakeTimers()
    mount({ hover: 50 })
    pointer(maximize('a'), 'pointerover')
    vi.advanceTimersByTime(20)
    pointer(host, 'pointerleave')
    vi.advanceTimersByTime(5000)
    expect(picker.element.hidden).toBe(true)

    pointer(maximize('a'), 'pointerover')
    vi.advanceTimersByTime(50)
    expect(picker.element.hidden).toBe(false)
    pointer(host, 'pointerleave', 'touch')
    vi.advanceTimersByTime(5000)
    expect(picker.element.hidden).toBe(false)
    pointer(host, 'pointerleave')
    vi.advanceTimersByTime(299)
    expect(picker.element.hidden).toBe(false)
    vi.advanceTimersByTime(1)
    expect(picker.element.hidden).toBe(true)
  })

  it('never opens on hover when hover is off, and a press on the button calls the wait off', () => {
    vi.useFakeTimers()
    mount({ hover: false })
    pointer(maximize('a'), 'pointerover')
    vi.advanceTimersByTime(5000)
    expect(picker.element.hidden).toBe(true)
    picker.destroy()

    picker = createLayoutPicker(desktop, { hover: 100 })
    pointer(maximize('a'), 'pointerover')
    vi.advanceTimersByTime(60)
    pointer(maximize('a'), 'pointerdown')
    vi.advanceTimersByTime(5000)
    expect(picker.element.hidden).toBe(true)
  })

  it('opens from the context menu of a maximize button, which a long press also asks for', () => {
    mount()
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
    maximize('a').dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(true)
    expect(picker.element.hidden).toBe(false)
    expect(document.activeElement).toBe(cells()[0])
    picker.close()

    const elsewhere = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    windowEl('a').dispatchEvent(elsewhere)
    expect(elsewhere.defaultPrevented).toBe(false)
    wm.update('a', { snappable: false })
    const refused = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    maximize('a').dispatchEvent(refused)
    expect(refused.defaultPrevented).toBe(false)
    expect(picker.element.hidden).toBe(true)
  })

  it('closes on a press outside, when focus leaves it, and when its window goes or may no longer be snapped', () => {
    mount()
    picker.open('a')
    pointer(cells()[0] as Element, 'pointerdown')
    pointer(maximize('a'), 'pointerdown')
    expect(picker.element.hidden).toBe(false)
    pointer(document.body, 'pointerdown')
    expect(picker.element.hidden).toBe(true)

    picker.open('a')
    cells()[0]?.focus()
    cells()[1]?.focus()
    expect(picker.element.hidden).toBe(false)
    ;(windowEl('b').querySelector('input') as HTMLElement).focus()
    expect(picker.element.hidden).toBe(true)

    picker.open('a')
    wm.move('b', 10, 10)
    expect(picker.element.hidden).toBe(false)
    wm.minimize('a')
    expect(picker.element.hidden).toBe(true)
    wm.restore('a')
    picker.open('a')
    wm.update('a', { snappable: false })
    expect(picker.element.hidden).toBe(true)
    picker.open('b')
    cells()[2]?.focus()
    wm.close('b')
    expect(picker.element.hidden).toBe(true)
  })

  it('takes the layouts it is given and leaves out areas that are not inside the desktop', () => {
    const mine: SnapLayout = [
      { x: 0, y: 0, width: 0.25, height: 1 },
      { x: 0.25, y: 0, width: 0.75, height: 1 },
      { x: 0.5, y: 0, width: 0.75, height: 1 },
      { x: Number.NaN, y: 0, width: 0.5, height: 1 },
      { x: 0, y: -0.1, width: 0.5, height: 1 },
      { x: 0, y: 0, width: 0, height: 1 },
      null as never,
    ]
    mount({ layouts: [mine, [], 'junk' as never] })
    expect(picker.element.querySelectorAll('[data-wm-layout]')).toHaveLength(1)
    expect(cells().map((cell) => cell.getAttribute('aria-label'))).toEqual([
      'Layout 1, area 1 of 2',
      'Layout 1, area 2 of 2',
    ])
    picker.open('a')
    cells()[1]?.click()
    expect(wm.get('a')?.bounds).toEqual({ x: 300, y: 0, width: 900, height: 800 })
  })

  it('does not open with nothing to offer', () => {
    mount({ layouts: [] })
    expect(picker.open('a')).toBe(false)
    const field = windowEl('a').querySelector('input') as HTMLElement
    expect(key(field, 'l', { ctrlKey: true, altKey: true }).defaultPrevented).toBe(false)
  })

  it('speaks Russian with the Russian catalogue', () => {
    mount({ messages: layoutMessagesRu })
    expect(picker.element.getAttribute('aria-label')).toBe('Раскладки окон')
    expect(cells()[6]?.getAttribute('aria-label')).toBe('Раскладка 3, область 3 из 3')
    expect(Object.keys(layoutMessagesRu).sort()).toEqual(Object.keys(layoutMessages).sort())
  })

  it('stands under its button, or above it when there is no room below, and stays inside the desktop', () => {
    mount()
    const box = (left: number, top: number, width: number, height: number) => () =>
      ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect
    host.getBoundingClientRect = box(100, 50, 1200, 800)
    Object.defineProperty(host, 'offsetWidth', { value: 1200 })
    Object.defineProperty(picker.element, 'offsetWidth', { value: 320 })
    Object.defineProperty(picker.element, 'offsetHeight', { value: 64 })
    maximize('a').getBoundingClientRect = box(500, 150, 20, 20)
    picker.open('a')
    expect([picker.element.style.left, picker.element.style.top]).toEqual(['250px', '126px'])

    maximize('a').getBoundingClientRect = box(110, 820, 20, 20)
    picker.open('a')
    expect([picker.element.style.left, picker.element.style.top]).toEqual(['0px', '700px'])

    maximize('a').getBoundingClientRect = box(1290, 60, 20, 20)
    picker.open('a')
    expect([picker.element.style.left, picker.element.style.top]).toEqual(['880px', '36px'])
  })

  it('reads its place in the units of a desktop that is scaled', () => {
    mount()
    const box = (left: number, top: number, width: number, height: number) => () =>
      ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect
    host.getBoundingClientRect = box(0, 0, 600, 400)
    Object.defineProperty(host, 'offsetWidth', { value: 1200 })
    Object.defineProperty(picker.element, 'offsetWidth', { value: 320 })
    Object.defineProperty(picker.element, 'offsetHeight', { value: 64 })
    maximize('a').getBoundingClientRect = box(300, 100, 10, 10)
    picker.open('a')
    expect([picker.element.style.left, picker.element.style.top]).toEqual(['450px', '226px'])
  })

  it('stands by the window itself when the window has no maximize button', () => {
    mount()
    maximize('a').remove()
    const box = (left: number, top: number, width: number, height: number) => () =>
      ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect
    host.getBoundingClientRect = box(0, 0, 1200, 800)
    Object.defineProperty(host, 'offsetWidth', { value: 1200 })
    Object.defineProperty(picker.element, 'offsetWidth', { value: 320 })
    Object.defineProperty(picker.element, 'offsetHeight', { value: 64 })
    windowEl('a').getBoundingClientRect = box(100, 100, 300, 200)
    expect(picker.open('a')).toBe(true)
    expect([picker.element.style.left, picker.element.style.top]).toEqual(['90px', '306px'])
  })

  it('shares one stylesheet between pickers and takes it away with the last one', () => {
    mount()
    const sheets = () => document.head.querySelectorAll('style[data-wm-layouts-style]').length
    expect(sheets()).toBe(1)
    const second = createLayoutPicker(desktop)
    expect(sheets()).toBe(1)
    picker.destroy()
    expect(sheets()).toBe(1)
    second.destroy()
    second.destroy()
    expect(sheets()).toBe(0)
  })

  it('takes everything it brought away with it', () => {
    const resources = trackResources()
    host = document.createElement('div')
    document.body.append(host)
    wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
    desktop = attachDesktop(wm, host, { autoViewport: false, announce: false })
    wm.open({ id: 'a' })
    build('a')
    const before = resources.leaks()
    picker = createLayoutPicker(desktop, { hover: 10 })
    pointer(maximize('a'), 'pointerover')
    picker.open('a')
    picker.destroy()
    expect(picker.open('a')).toBe(false)
    expect(host.querySelector('[data-wm-layouts]')).toBeNull()
    expect(maximize('a').hasAttribute('aria-expanded')).toBe(false)
    expect(resources.leaks()).toEqual(before)
    resources.restore()
  })
})

describe('a layout picker asked for less usual things', () => {
  it('opens for a window that has no element yet and stands by the desktop itself', () => {
    mount()
    wm.open({ id: 'bare', width: 300, height: 200 })
    expect(picker.open('bare')).toBe(true)
    expect(picker.element.hidden).toBe(false)
    cells()[0]?.click()
    expect(wm.get('bare')?.stage).toBe('snapped')
  })

  it('does nothing on a click between the areas, or on an area while it is closed', () => {
    mount()
    picker.open('a')
    picker.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    picker.element
      .querySelector('[data-wm-layout]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(picker.element.hidden).toBe(false)
    expect(wm.get('a')?.stage).toBe('normal')
    picker.close()
    cells()[0]?.click()
    expect(wm.get('a')?.stage).toBe('normal')
  })
})
