// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defineWmElements,
  type WmDesktopElement,
  type WmWindowElement,
} from '../../src/plugins/elements'

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
})
