// @vitest-environment jsdom
import { h, render } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useDesktop,
  useWindowManager,
  useWmState,
  useWmWindow,
  useWmWindowRef,
} from '../../src/adapters/preact'
import type { WindowManager } from '../../src/core/types'
import type { DesktopBinder } from '../../src/dom/binder'

class StubObserver {
  observe(): void {}
  disconnect(): void {}
}

let root: HTMLElement

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubObserver)
  root = document.createElement('div')
  document.body.append(root)
})

afterEach(() => {
  render(null, root)
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

function Window(props: { binder: DesktopBinder; wm: WindowManager; id: string }) {
  const ref = useWmWindowRef(props.binder, props.id, { resizeHandles: false })
  const win = useWmWindow(props.wm, props.id)
  if (!win) return null
  return h(
    'section',
    { ref, 'data-testid': props.id },
    h('header', { 'data-wm-drag': '' }, win.title),
  )
}

function App(props: { onReady: (wm: WindowManager, binder: DesktopBinder) => void }) {
  const wm = useWindowManager({ viewport: { width: 800, height: 600 } })
  const desktop = useDesktop(wm, { autoViewport: false, announce: false })
  const state = useWmState(wm)
  props.onReady(wm, desktop.binder)
  return h(
    'div',
    { ref: desktop.ref, 'data-count': state.order.length },
    state.order.map((id) => h(Window, { key: id, id, wm, binder: desktop.binder })),
  )
}

describe('preact adapter', () => {
  it('renders windows from the state and keeps them attached and up to date', () => {
    let wm: WindowManager | null = null
    let binder: DesktopBinder | null = null
    act(() => {
      render(
        h(App, {
          onReady: (manager, bound) => {
            wm = manager
            binder = bound
          },
        }),
        root,
      )
    })
    const manager = wm as unknown as WindowManager
    expect(binder).not.toBeNull()
    act(() => {
      manager.open({ id: 'a', title: 'Alpha' })
      manager.open({ id: 'b', title: 'Beta' })
    })
    const desktop = root.firstElementChild as HTMLElement
    expect(desktop.dataset.count).toBe('2')
    const a = root.querySelector('[data-testid="a"]') as HTMLElement
    expect(a.dataset.wmWindow).toBe('a')
    expect(a.textContent).toBe('Alpha')

    act(() => {
      manager.update('a', { title: 'Renamed' })
    })
    expect(a.textContent).toBe('Renamed')

    act(() => {
      manager.close('b')
    })
    expect(root.querySelector('[data-testid="b"]')).toBeNull()
    expect(desktop.dataset.count).toBe('1')
  })

  it('catches a change made between render and subscription', () => {
    let wm: WindowManager | null = null
    let calls = 0
    act(() => {
      render(
        h(App, {
          onReady: (manager) => {
            wm = manager
            calls += 1
            if (calls === 1) manager.open({ id: 'early', title: 'Early' })
          },
        }),
        root,
      )
    })
    expect((wm as unknown as WindowManager).getState().order).toEqual(['early'])
    expect(root.querySelector('[data-testid="early"]')).not.toBeNull()
  })

  it('destroys the manager and lets go of the desktop on unmount', () => {
    let wm: WindowManager | null = null
    act(() => {
      render(h(App, { onReady: (manager) => (wm = manager) }), root)
    })
    const manager = wm as unknown as WindowManager
    const listener = vi.fn()
    manager.subscribe(listener)
    const desktop = root.firstElementChild as HTMLElement
    act(() => {
      render(null, root)
    })
    manager.open({ id: 'after' })
    expect(listener).not.toHaveBeenCalled()
    expect(desktop.hasAttribute('data-wm-desktop')).toBe(false)
  })
})
