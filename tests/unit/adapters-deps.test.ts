// @vitest-environment jsdom
import { act, render, renderHook } from '@testing-library/react'
import { h, render as preactRender } from 'preact'
import { act as preactAct } from 'preact/test-utils'
import { createElement, StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as preact from '../../src/adapters/preact'
import * as react from '../../src/adapters/react'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { createDesktopBinder, type DesktopBinder } from '../../src/dom/binder'

class StubObserver {
  observe(): void {}
  disconnect(): void {}
}

const makeWm = (title?: string) => {
  const wm = createWindowManager({ viewport: { width: 800, height: 600 } })
  if (title) wm.open({ id: 'a', title })
  return wm
}
const quiet = { autoViewport: false, announce: false } as const

let root: HTMLElement

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubObserver)
  root = document.createElement('div')
  document.body.append(root)
})

afterEach(() => {
  preactRender(null, root)
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('react hooks re-rendered with something else', () => {
  it('bind the desktop through the binder of the manager they are given now', () => {
    const binders: DesktopBinder[] = []
    function Desk(props: { wm: WindowManager }) {
      const desktop = react.useDesktop(props.wm, quiet)
      binders.push(desktop.binder)
      return createElement('div', { ref: desktop.ref, 'data-testid': 'desk' })
    }
    const [first, second] = [makeWm(), makeWm()]
    const view = render(createElement(Desk, { wm: first }))
    const desk = view.getByTestId('desk')
    expect(binders.at(-1)?.controller()?.wm).toBe(first)
    view.rerender(createElement(Desk, { wm: second }))
    expect(binders.at(-1)).not.toBe(binders[0])
    expect(binders.at(-1)?.controller()?.wm).toBe(second)
    expect(binders.at(-1)?.controller()?.element).toBe(desk)
    expect(binders[0]?.controller()).toBeNull()
    view.unmount()
    expect(binders.at(-1)?.controller()).toBeNull()
  })

  it('bind the element to the id they are given now, with the options they were given', () => {
    const wm = makeWm('A')
    wm.open({ id: 'b', title: 'B' })
    const binder = createDesktopBinder(wm, quiet)
    const desk = document.createElement('div')
    root.append(desk)
    binder.bindDesktop(desk)
    function Win(props: { id: string }) {
      const ref = react.useWmWindowRef(binder, props.id, { resizeHandles: false })
      return createElement('section', { ref, 'data-testid': 'win' })
    }
    const view = render(createElement(Win, { id: 'a' }), { container: desk })
    const element = view.getByTestId('win')
    expect(element.dataset.wmWindow).toBe('a')
    expect(element.querySelector('[data-wm-resize]')).toBeNull()
    view.rerender(createElement(Win, { id: 'b' }))
    expect(element.dataset.wmWindow).toBe('b')
    wm.close('b')
    expect(element.isConnected).toBe(true)
    view.unmount()
    binder.destroy()
  })

  it('let a ref be cleared that never held an element', () => {
    const wm = makeWm()
    const desk = renderHook(() => react.useDesktop(wm, quiet))
    expect(() => desk.result.current.ref(null)).not.toThrow()
    const win = renderHook(() => react.useWmWindowRef(desk.result.current.binder, 'a'))
    expect(() => win.result.current(null)).not.toThrow()
  })

  it('keep the manager alive through the double mount of StrictMode', async () => {
    let made: WindowManager | undefined
    function App() {
      const wm = react.useWindowManager({ viewport: { width: 800, height: 600 } })
      const state = react.useWmState(wm)
      made = wm
      return createElement('output', { 'data-testid': 'count' }, String(state.order.length))
    }
    const view = render(createElement(StrictMode, null, createElement(App)))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    act(() => {
      made?.open({ id: 'a' })
    })
    expect(view.getByTestId('count').textContent).toBe('1')
  })
})

describe('preact hooks re-rendered with something else', () => {
  const draw = (node: Parameters<typeof preactRender>[0]) =>
    preactAct(() => {
      preactRender(node, root)
    })

  it('follow the manager they are given now and let the old one go', () => {
    let renders = 0
    function Probe(props: { wm: WindowManager }) {
      const state = preact.useWmState(props.wm)
      renders += 1
      return h('output', null, String(state.order.length))
    }
    const [first, second] = [makeWm('One'), makeWm()]
    draw(h(Probe, { wm: first }))
    expect(root.textContent).toBe('1')
    draw(h(Probe, { wm: second }))
    expect(root.textContent).toBe('0')
    preactAct(() => {
      second.open({ id: 'x' })
      second.open({ id: 'y' })
    })
    expect(root.textContent).toBe('2')
    const before = renders
    preactAct(() => {
      first.open({ id: 'z' })
    })
    expect(renders).toBe(before)
  })

  it('follow the window they are given now and render only when it changes', () => {
    let renders = 0
    function Probe(props: { wm: WindowManager; id: string }) {
      const win = preact.useWmWindow(props.wm, props.id)
      renders += 1
      return h('output', null, win?.title ?? 'none')
    }
    const wm = makeWm('A')
    wm.open({ id: 'b', title: 'B' })
    draw(h(Probe, { wm, id: 'a' }))
    expect(root.textContent).toBe('A')
    draw(h(Probe, { wm, id: 'b' }))
    expect(root.textContent).toBe('B')
    preactAct(() => {
      wm.update('b', { title: 'Renamed' })
    })
    expect(root.textContent).toBe('Renamed')
    const before = renders
    preactAct(() => {
      wm.update('a', { title: 'Elsewhere' })
      wm.move('a', 50, 50)
    })
    expect(renders).toBe(before)
  })

  it('bind the desktop through the binder of the manager they are given now, and destroy each binder', () => {
    const binders: DesktopBinder[] = []
    function Desk(props: { wm: WindowManager }) {
      const desktop = preact.useDesktop(props.wm, quiet)
      binders.push(desktop.binder)
      return h('div', { ref: desktop.ref, 'data-testid': 'desk' })
    }
    const [first, second] = [makeWm(), makeWm()]
    draw(h(Desk, { wm: first }))
    const desk = root.querySelector('[data-testid=desk]') as HTMLElement
    expect(binders.at(-1)?.controller()?.wm).toBe(first)
    draw(h(Desk, { wm: second }))
    const latest = binders.at(-1) as DesktopBinder
    expect(latest).not.toBe(binders[0])
    expect(latest.controller()?.wm).toBe(second)
    expect(latest.controller()?.element).toBe(desk)
    expect(binders[0]?.controller()).toBeNull()
    expect(desk.hasAttribute('data-wm-desktop')).toBe(true)
    draw(null)
    expect(latest.controller()).toBeNull()
    expect(desk.hasAttribute('data-wm-desktop')).toBe(false)
  })

  it('bind the element to the id they are given now, with the options they were given, and leave it to preact', () => {
    const wm = makeWm('A')
    wm.open({ id: 'b', title: 'B' })
    const binder = createDesktopBinder(wm, quiet)
    binder.bindDesktop(root)
    function Win(props: { id: string }) {
      const ref = preact.useWmWindowRef(binder, props.id, { resizeHandles: false })
      return h('section', { ref, 'data-testid': 'win' })
    }
    draw(h(Win, { id: 'a' }))
    const element = root.querySelector('[data-testid=win]') as HTMLElement
    expect(element.dataset.wmWindow).toBe('a')
    expect(element.querySelector('[data-wm-resize]')).toBeNull()
    draw(h(Win, { id: 'b' }))
    expect(element.dataset.wmWindow).toBe('b')
    wm.close('b')
    expect(element.isConnected).toBe(true)
    draw(null)
    binder.destroy()
  })
})
