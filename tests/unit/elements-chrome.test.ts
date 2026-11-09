// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDock } from '../../src/plugins/dock'
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
const rootOf = (desktop: WmDesktopElement, id: string) =>
  windowOf(desktop, id).shadowRoot as ShadowRoot
const shown = (desktop: WmDesktopElement, id: string) =>
  [...rootOf(desktop, id).querySelectorAll<HTMLElement>('[part~=control]')]
    .filter((button) => !button.hidden)
    .map((button) => button.getAttribute('part'))

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
