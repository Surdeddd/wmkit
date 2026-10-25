// @vitest-environment jsdom
import { computed as ngComputed } from '@angular/core'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createElement, StrictMode, useEffect, useState } from 'react'
import { createEffect, createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  type ComputedRef,
  createApp,
  createSSRApp,
  defineComponent,
  effectScope,
  h,
  nextTick,
  shallowRef,
} from 'vue'
import { renderToString } from 'vue/server-renderer'
import {
  createDesktop as createNgDesktop,
  useWindowManager as useNgManager,
  useWmState as useNgState,
  useWmWindow as useNgWindow,
} from '../../src/adapters/angular'
import {
  useDesktop,
  useWindowManager as useReactManager,
  useWmState as useReactState,
  useWmWindow as useReactWindow,
  useWmWindowRef,
} from '../../src/adapters/react'
import {
  createDesktop as createSolidDesktop,
  useWindowManager as useSolidManager,
  useWmState as useSolidState,
  useWmWindow as useSolidWindow,
} from '../../src/adapters/solid'
import {
  createManager,
  createDesktop as createSvelteDesktop,
  wmStore,
  wmWindowStore,
} from '../../src/adapters/svelte'
import {
  useDesktop as useVueDesktop,
  useWindowManager as useVueManager,
  useWmState as useVueState,
  useWmWindow as useVueWindow,
  useWmWindowEl,
} from '../../src/adapters/vue'
import { createWindowManager } from '../../src/core/manager'
import type { ManagerState, WindowManager, WindowState } from '../../src/core/types'
import { createDesktopBinder, type DesktopBinder } from '../../src/dom/binder'

vi.mock('solid-js', () => import('solid-js/dist/dev.js' as string))

const VIEWPORT = { viewport: { width: 800, height: 600 } }
const DESKTOP_OPTIONS = { autoViewport: false, announce: false } as const

afterEach(() => {
  document.body.replaceChildren()
})

function captureErrors() {
  const errors: string[] = []
  const onError = (event: ErrorEvent) => {
    errors.push(String(event.error?.message ?? event.message))
    event.preventDefault()
  }
  window.addEventListener('error', onError)
  const spy = vi.spyOn(console, 'error').mockImplementation((first) => {
    errors.push(String(first?.message ?? first))
  })
  return {
    errors,
    stop() {
      window.removeEventListener('error', onError)
      spy.mockRestore()
    },
  }
}

describe('react adapter smoke', () => {
  function Win({ binder, win }: { binder: DesktopBinder; win: WindowState }) {
    const ref = useWmWindowRef(binder, win.id)
    return createElement(
      'section',
      { ref, 'data-testid': `w-${win.id}` },
      createElement(
        'header',
        { 'data-wm-drag': '' },
        createElement('span', { 'data-wm-title': '' }, win.title),
      ),
    )
  }

  function App() {
    const wm = useReactManager(VIEWPORT)
    const { ref, binder } = useDesktop(wm, DESKTOP_OPTIONS)
    const state = useReactState(wm)
    useEffect(() => {
      wm.open({ id: 'a', title: 'Alpha', x: 10, y: 20, width: 200, height: 150 })
    }, [wm])
    return createElement(
      'div',
      { ref },
      state.order.flatMap((id) => {
        const win = state.windows[id]
        return win ? [createElement(Win, { key: id, binder, win })] : []
      }),
    )
  }

  it('renders manager state and wires the dom controller', async () => {
    const { unmount } = render(createElement(App))
    const el = await screen.findByTestId('w-a')
    expect(el.dataset.wmWindow).toBe('a')
    expect(el.style.transform).toBe('translate3d(10px, 20px, 0)')
    expect(el.getAttribute('role')).toBe('dialog')
    unmount()
  })
})

describe('react window lifecycle', () => {
  function Win({ binder, id }: { binder: DesktopBinder; id: string }) {
    const win = useReactWindow(binder.wm, id)
    // @ts-expect-error
    const ref = useWmWindowRef(binder, id, { removeOnClose: true })
    if (!win) return null
    return createElement(
      'section',
      { ref, 'data-testid': `w-${id}` },
      createElement(
        'header',
        { 'data-wm-drag': '' },
        createElement('span', { 'data-wm-title': '' }, win.title),
        createElement('button', {
          type: 'button',
          'data-wm-close': '',
          'data-testid': `close-${id}`,
        }),
      ),
    )
  }

  function Plain({ binder, id }: { binder: DesktopBinder; id: string }) {
    const ref = useWmWindowRef(binder, id)
    return createElement('section', { ref, 'data-testid': `w-${id}` })
  }

  let wm: WindowManager | undefined
  let binder: DesktopBinder | undefined
  const opened: string[] = []

  function Desktop({ item = Win }: { item?: typeof Win }) {
    const manager = useReactManager(VIEWPORT)
    useState(() => manager.on('open', ({ window: win }) => opened.push(win.id)))
    const desktop = useDesktop(manager, DESKTOP_OPTIONS)
    const state = useReactState(manager)
    wm = manager
    binder = desktop.binder
    return createElement(
      'div',
      { ref: desktop.ref },
      createElement('span', { 'data-testid': 'alive' }),
      state.order.map((id) => createElement(item, { key: id, binder: desktop.binder, id })),
    )
  }

  afterEach(() => {
    opened.length = 0
  })

  it('closing a removeOnClose window from its button keeps the React tree mounted', async () => {
    render(createElement(Desktop))
    act(() => {
      wm?.open({ id: 'a', title: 'A' })
    })
    expect((await screen.findByTestId('w-a')).dataset.wmWindow).toBe('a')

    const log = captureErrors()
    try {
      act(() => {
        fireEvent.click(screen.getByTestId('close-a'))
      })
    } catch (error) {
      log.errors.push(String((error as Error).message))
    }
    log.stop()

    expect(wm?.get('a')).toBeUndefined()
    expect(screen.queryByTestId('alive'), 'the whole React root was unmounted').not.toBeNull()
    expect(log.errors, 'React removed a node the controller had already removed').toEqual([])
  })

  it('a StrictMode double mount keeps the desktop bound and the manager listeners', () => {
    const view = render(createElement(StrictMode, null, createElement(Desktop, { item: Plain })))
    expect(binder?.controller(), 'the simulated unmount tore the desktop down').not.toBeNull()

    act(() => {
      wm?.open({ id: 'a', title: 'A' })
    })
    expect(screen.getByTestId('w-a').dataset.wmWindow, 'the window never attached').toBe('a')
    expect(opened, 'a listener added with the manager was dropped').toContain('a')

    view.unmount()
    expect(binder?.controller()).toBeNull()
  })

  it('destroys the manager once the component really unmounts', async () => {
    const view = render(createElement(Desktop, { item: Plain }))
    const late = vi.fn()
    wm?.on('open', late)
    view.unmount()
    await new Promise((resolve) => setTimeout(resolve))
    wm?.open({ id: 'late', title: 'Late' })
    expect(late).not.toHaveBeenCalled()
  })
})

describe('vue adapter smoke', () => {
  it('drives composables and attaches elements through refs', async () => {
    const scope = effectScope()
    let wm: WindowManager | undefined
    await scope.run(async () => {
      wm = useVueManager(VIEWPORT)
      const state = useVueState(wm)
      wm.open({ id: 'v', title: 'Vue', x: 5, y: 6, width: 200, height: 150 })
      expect(state.value.windows.v?.title).toBe('Vue')

      const desktopEl = document.createElement('div')
      const winEl = document.createElement('section')
      document.body.append(desktopEl)
      desktopEl.append(winEl)

      const desktopTarget = shallowRef<HTMLElement | null>(null)
      const winTarget = shallowRef<HTMLElement | null>(null)
      const binder = useVueDesktop(wm, desktopTarget, DESKTOP_OPTIONS)
      useWmWindowEl(binder, 'v', winTarget)

      desktopTarget.value = desktopEl
      winTarget.value = winEl
      await nextTick()

      expect(desktopEl.dataset.wmDesktop).toBe('')
      expect(winEl.dataset.wmWindow).toBe('v')
      expect(winEl.style.transform).toBe('translate3d(5px, 6px, 0)')
    })
    scope.stop()
    expect(wm).toBeDefined()
  })
})

describe('svelte adapter smoke', () => {
  it('exposes store contracts and actions', () => {
    const wm = createManager(VIEWPORT)
    const dk = createSvelteDesktop(wm, DESKTOP_OPTIONS)

    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    const desktopAction = dk.desktop(desktopEl)
    expect(desktopEl.dataset.wmDesktop).toBe('')

    wm.open({ id: 's', title: 'Svelte' })
    const winEl = document.createElement('section')
    desktopEl.append(winEl)
    const winAction = dk.window(winEl, { id: 's' })
    expect(winEl.dataset.wmWindow).toBe('s')

    const states: string[] = []
    const stopStore = wmStore(wm).subscribe((state) => states.push(state.order.join(',')))
    const titles: Array<string | undefined> = []
    const stopWin = wmWindowStore(wm, 's').subscribe((win) => titles.push(win?.title))
    wm.update('s', { title: 'Svelte 2' })

    expect(states[0]).toBe('s')
    expect(titles).toEqual(['Svelte', 'Svelte 2'])

    stopStore()
    stopWin()
    winAction.destroy()
    desktopAction.destroy()
  })
})

describe('solid adapter smoke', () => {
  it('exposes signal accessors and element refs', () => {
    const desktopEl = document.createElement('div')
    const winEl = document.createElement('section')
    document.body.append(desktopEl)
    const { dispose, state } = createRoot((done) => {
      const wm = useSolidManager(VIEWPORT)
      const dk = createSolidDesktop(wm, DESKTOP_OPTIONS)
      dk.desktop(desktopEl)
      wm.open({ id: 'sol', title: 'Solid' })
      desktopEl.append(winEl)
      dk.window('sol')(winEl)
      return { dispose: done, state: useSolidState(wm) }
    })

    expect(desktopEl.dataset.wmDesktop).toBe('')
    expect(winEl.dataset.wmWindow).toBe('sol')
    expect(state().windows.sol?.title).toBe('Solid')
    dispose()
  })
})

describe('removeOnClose smoke', () => {
  it('detaches the controller and removes the element on close', () => {
    const wm = createWindowManager(VIEWPORT)
    const dk = createSvelteDesktop(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)

    wm.open({ id: 'gone', title: 'Ephemeral' })
    const winEl = document.createElement('section')
    desktopEl.append(winEl)
    dk.binder.bindWindow('gone', winEl, { removeOnClose: true })
    expect(winEl.dataset.wmWindow).toBe('gone')

    wm.close('gone')
    expect(winEl.isConnected).toBe(false)
    expect(desktopEl.querySelector('[data-wm-window]')).toBeNull()
  })
})

describe('angular adapter smoke', () => {
  it('exposes signals and element bindings outside injection context', () => {
    const wm = useNgManager(VIEWPORT)
    const state = useNgState(wm)
    wm.open({ id: 'ng', title: 'Angular', x: 7, y: 9, width: 200, height: 150 })
    expect(state().windows.ng?.title).toBe('Angular')

    const winSignal = useNgWindow(wm, 'ng')
    expect(winSignal()?.bounds).toMatchObject({ x: 7, y: 9 })

    const dk = createNgDesktop(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)
    const winEl = document.createElement('section')
    desktopEl.append(winEl)
    dk.window('ng')(winEl)

    expect(desktopEl.dataset.wmDesktop).toBe('')
    expect(winEl.dataset.wmWindow).toBe('ng')
    expect(winEl.style.transform).toBe('translate3d(7px, 9px, 0)')

    wm.update('ng', { title: 'Angular 2' })
    expect(state().windows.ng?.title).toBe('Angular 2')
  })
})

describe('per window subscriptions', () => {
  it('react gives a component just the window it asked for', () => {
    const wm = createWindowManager(VIEWPORT)
    wm.open({ id: 'a', title: 'A' })
    wm.open({ id: 'b', title: 'B' })
    const renders: string[] = []

    function Title({ id }: { id: string }) {
      const win = useReactWindow(wm, id)
      renders.push(`${id}:${win?.title ?? 'gone'}`)
      return createElement('span', { 'data-testid': `t-${id}` }, win?.title ?? 'gone')
    }

    render(createElement(Title, { id: 'a' }))
    expect(screen.getByTestId('t-a').textContent).toBe('A')

    act(() => {
      wm.update('a', { title: 'A renamed' })
    })
    expect(screen.getByTestId('t-a').textContent).toBe('A renamed')

    const before = renders.length
    act(() => {
      wm.update('b', { title: 'B renamed' })
    })
    expect(renders.length, 'a change to another window re-rendered this one').toBe(before)

    act(() => {
      wm.close('a')
    })
    expect(screen.getByTestId('t-a').textContent).toBe('gone')
  })

  it('react follows the id a component is re-rendered with', () => {
    const wm = createWindowManager(VIEWPORT)
    wm.open({ id: 'a', title: 'A' })
    wm.open({ id: 'b', title: 'B' })

    function Title({ id }: { id: string }) {
      const win = useReactWindow(wm, id)
      return createElement('span', { 'data-testid': 'title' }, win?.title ?? 'gone')
    }

    const view = render(createElement(Title, { id: 'a' }))
    expect(screen.getByTestId('title').textContent).toBe('A')

    view.rerender(createElement(Title, { id: 'b' }))
    expect(screen.getByTestId('title').textContent, 'the hook kept the old id').toBe('B')

    act(() => {
      wm.update('b', { title: 'B renamed' })
    })
    expect(screen.getByTestId('title').textContent).toBe('B renamed')
  })

  it('vue hands out read-only refs', () => {
    expectTypeOf(useVueState).returns.toEqualTypeOf<ComputedRef<ManagerState>>()
    expectTypeOf(useVueWindow).returns.toEqualTypeOf<ComputedRef<WindowState | undefined>>()
  })

  it('vue tracks one window through a ref id', async () => {
    const wm = createWindowManager(VIEWPORT)
    wm.open({ id: 'a', title: 'A' })
    wm.open({ id: 'b', title: 'B' })
    const scope = effectScope()

    scope.run(() => {
      const id = shallowRef('a')
      const win = useVueWindow(wm, id)
      expect(win.value?.title).toBe('A')

      id.value = 'b'
      expect(win.value?.title).toBe('B')

      wm.update('b', { title: 'B renamed' })
      expect(win.value?.title).toBe('B renamed')

      wm.close('b')
      expect(win.value).toBeUndefined()
    })
    await nextTick()
    scope.stop()
  })

  it('solid tracks one window through an accessor id', () => {
    const wm = createWindowManager(VIEWPORT)
    wm.open({ id: 'a', title: 'A' })
    wm.open({ id: 'b', title: 'B' })

    createRoot((dispose) => {
      const [wanted, setWanted] = createSignal('a')
      const win = useSolidWindow(wm, wanted)
      expect(win()?.title).toBe('A')

      setWanted('b')
      expect(win()?.title).toBe('B')

      wm.update('b', { title: 'B renamed' })
      expect(win()?.title).toBe('B renamed')

      const fixed = useSolidWindow(wm, 'a')
      expect(fixed()?.title).toBe('A')
      dispose()
    })
  })

  it('svelte exposes a store per window', () => {
    const wm = createManager(VIEWPORT)
    wm.open({ id: 'a', title: 'A' })
    const store = wmWindowStore(wm, 'a')
    const seen: Array<string | undefined> = []
    const stop = store.subscribe((win) => seen.push(win?.title))

    wm.update('a', { title: 'A renamed' })
    wm.close('a')
    stop()

    expect(seen[0]).toBe('A')
    expect(seen.at(-1)).toBeUndefined()
    expect(seen).toContain('A renamed')
  })
})

describe('svelte window action', () => {
  it('keeps the binding when the action re-runs with the same id', () => {
    const wm = createManager(VIEWPORT)
    const dk = createSvelteDesktop(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)
    wm.open({ id: 'a', title: 'A', x: 5, y: 6, width: 200, height: 150 })

    const winEl = document.createElement('section')
    desktopEl.append(winEl)
    const action = dk.window(winEl, { id: 'a' })
    expect(winEl.dataset.wmWindow).toBe('a')

    action.update?.({ id: 'a' })
    expect(winEl.dataset.wmWindow, 'the element lost its binding on a re-render').toBe('a')
    expect(winEl.style.transform).toBe('translate3d(5px, 6px, 0)')

    wm.move('a', 40, 50)
    expect(winEl.style.transform, 'the rebound element stopped following the window').toBe(
      'translate3d(40px, 50px, 0)',
    )
    action.destroy?.()
  })

  it('does not cancel a drag when the component re-renders mid gesture', () => {
    const captured = new Set<number>()
    Element.prototype.setPointerCapture = function setPointerCapture(id: number) {
      captured.add(id)
    }
    Element.prototype.releasePointerCapture = function releasePointerCapture(id: number) {
      captured.delete(id)
    }
    Element.prototype.hasPointerCapture = function hasPointerCapture(id: number) {
      return captured.has(id)
    }
    const frames: Array<() => void> = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(() => callback(0))
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      })
      Object.defineProperty(event, 'pointerId', { value: 1 })
      return event as PointerEvent
    }

    const wm = createManager(VIEWPORT)
    const dk = createSvelteDesktop(wm, {
      ...DESKTOP_OPTIONS,
      magnetism: false,
      snap: false,
    })
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)
    wm.open({ id: 'a', title: 'A', x: 100, y: 100, width: 200, height: 150 })

    const winEl = document.createElement('section')
    winEl.innerHTML = '<header data-wm-drag></header>'
    desktopEl.append(winEl)
    const action = dk.window(winEl, { id: 'a' })
    const handle = winEl.querySelector('[data-wm-drag]') as HTMLElement

    handle.dispatchEvent(pointer('pointerdown', 150, 110))
    handle.dispatchEvent(pointer('pointermove', 190, 150))
    for (const frame of frames.splice(0)) frame()
    expect(wm.get('a')?.bounds).toMatchObject({ x: 140, y: 140 })

    action.update?.({ id: 'a' })

    handle.dispatchEvent(pointer('pointermove', 230, 190))
    for (const frame of frames.splice(0)) frame()
    expect(wm.get('a')?.bounds, 'the re-render cancelled the drag').toMatchObject({
      x: 180,
      y: 180,
    })

    handle.dispatchEvent(pointer('pointerup', 230, 190))
    action.destroy?.()
    vi.unstubAllGlobals()
  })

  it('rebinds the element when the action is given another id', () => {
    const wm = createManager(VIEWPORT)
    const dk = createSvelteDesktop(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)
    wm.open({ id: 'a', title: 'A', x: 5, y: 6, width: 200, height: 150 })
    wm.open({ id: 'b', title: 'B', x: 70, y: 80, width: 200, height: 150 })

    const winEl = document.createElement('section')
    desktopEl.append(winEl)
    const action = dk.window(winEl, { id: 'a' })
    action.update?.({ id: 'b' })

    expect(winEl.dataset.wmWindow).toBe('b')
    expect(winEl.style.transform).toBe('translate3d(70px, 80px, 0)')
    action.destroy?.()
  })
})

describe('titlebar landmark neutralisation', () => {
  it('stops a header handle from leaking a banner landmark out of the dialog', () => {
    const wm = createWindowManager(VIEWPORT)
    const dk = createSvelteDesktop(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)

    wm.open({ id: 'mark', title: 'Landmark' })
    const winEl = document.createElement('section')
    winEl.innerHTML = '<header data-wm-drag><span data-wm-title>Landmark</span></header>'
    desktopEl.append(winEl)
    dk.window(winEl, { id: 'mark' })

    expect(winEl.getAttribute('role')).toBe('dialog')
    expect(winEl.querySelector('[data-wm-drag]')?.getAttribute('role')).toBe('presentation')
  })

  it('leaves an explicit handle role alone', () => {
    const wm = createWindowManager(VIEWPORT)
    const dk = createSvelteDesktop(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)

    wm.open({ id: 'kept', title: 'Kept' })
    const winEl = document.createElement('section')
    winEl.innerHTML = '<header data-wm-drag role="toolbar"></header>'
    desktopEl.append(winEl)
    dk.window(winEl, { id: 'kept' })

    expect(winEl.querySelector('[data-wm-drag]')?.getAttribute('role')).toBe('toolbar')
  })

  it('does not touch a plain div handle', () => {
    const wm = createWindowManager(VIEWPORT)
    const dk = createSvelteDesktop(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)

    wm.open({ id: 'plain', title: 'Plain' })
    const winEl = document.createElement('section')
    winEl.innerHTML = '<div data-wm-drag></div>'
    desktopEl.append(winEl)
    dk.window(winEl, { id: 'plain' })

    expect(winEl.querySelector('[data-wm-drag]')?.hasAttribute('role')).toBe(false)
  })
})

describe('binder lifecycle', () => {
  it('re-subscribes after a rebind so late windows still attach', () => {
    const wm = createWindowManager(VIEWPORT)
    const dk = createSvelteDesktop(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)

    const action = dk.desktop(desktopEl)
    action.destroy()
    dk.desktop(desktopEl)

    const winEl = document.createElement('section')
    desktopEl.append(winEl)
    dk.binder.bindWindow('late', winEl)
    expect(winEl.dataset.wmWindow).toBeUndefined()

    wm.open({ id: 'late', title: 'Late' })
    expect(winEl.dataset.wmWindow).toBe('late')
  })

  it('re-attaches an element when its window comes back', () => {
    const wm = createWindowManager(VIEWPORT)
    const dk = createSvelteDesktop(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)

    const winEl = document.createElement('section')
    desktopEl.append(winEl)
    dk.binder.bindWindow('doc', winEl)
    wm.open({ id: 'doc', title: 'Doc' })
    expect(winEl.dataset.wmWindow).toBe('doc')

    wm.close('doc')
    expect(winEl.dataset.wmWindow).toBeUndefined()

    wm.open({ id: 'doc', title: 'Doc again' })
    expect(winEl.dataset.wmWindow, 'the element never came back').toBe('doc')
  })

  it('re-attaches an element when history brings its window back', () => {
    const wm = createWindowManager(VIEWPORT)
    const dk = createSvelteDesktop(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)

    const winEl = document.createElement('section')
    desktopEl.append(winEl)
    dk.binder.bindWindow('doc', winEl)
    wm.open({ id: 'doc', title: 'Doc' })
    wm.close('doc')
    expect(wm.undo()).toBe(true)

    expect(winEl.dataset.wmWindow, 'undo left the element unbound').toBe('doc')
  })

  it('destroy releases the desktop and stops attaching new windows', () => {
    const wm = createWindowManager(VIEWPORT)
    const dk = createSvelteDesktop(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)
    dk.binder.destroy()
    expect(dk.binder.controller()).toBeNull()

    const winEl = document.createElement('section')
    desktopEl.append(winEl)
    dk.binder.bindWindow('after', winEl)
    wm.open({ id: 'after', title: 'After' })
    expect(winEl.dataset.wmWindow).toBeUndefined()
  })

  it('refuses a second desktop while one is bound', () => {
    const binder = createDesktopBinder(createWindowManager(VIEWPORT), DESKTOP_OPTIONS)
    binder.bindDesktop(document.createElement('div'))
    expect(() => binder.bindDesktop(document.createElement('div'))).toThrow(/already bound/)
    binder.destroy()
  })

  function boundNotes() {
    const wm = createWindowManager(VIEWPORT)
    const dk = createSvelteDesktop(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)
    wm.open({ id: 'notes', title: 'Notes' })
    const winEl = document.createElement('section')
    desktopEl.append(winEl)
    dk.window(winEl, { id: 'notes', removeOnClose: true })
    return { wm, desktopEl, winEl }
  }

  it('puts a removeOnClose element back when undo reopens its window', () => {
    const { wm, desktopEl, winEl } = boundNotes()
    wm.close('notes')
    expect(winEl.isConnected).toBe(false)

    expect(wm.undo()).toBe(true)
    expect(winEl.dataset.wmWindow).toBe('notes')
    expect(winEl.parentNode, 'the open, focused window has an element nobody can see').toBe(
      desktopEl,
    )
    expect(document.activeElement).toBe(winEl)
  })

  it('leaves a window where it is when the whole desktop is built off-document', () => {
    const wm = createWindowManager(VIEWPORT)
    wm.open({ id: 'a', title: 'A' })
    const desktopEl = document.createElement('div')
    const layer = document.createElement('div')
    const winEl = document.createElement('section')
    desktopEl.append(layer)
    layer.append(winEl)
    const binder = createDesktopBinder(wm, DESKTOP_OPTIONS)
    binder.bindWindow('a', winEl)
    binder.bindDesktop(desktopEl)
    document.body.append(desktopEl)
    expect(winEl.dataset.wmWindow).toBe('a')
    expect(winEl.parentNode, 'the window was pulled out of its wrapper').toBe(layer)
    binder.destroy()
  })

  it('keeps the element in the page when one batch closes and reopens its window', () => {
    const { wm, desktopEl, winEl } = boundNotes()
    wm.batch(() => {
      wm.close('notes')
      wm.open({ id: 'notes', title: 'Notes again' })
    })
    expect(winEl.dataset.wmWindow).toBe('notes')
    expect(winEl.parentNode, 'attached, open, and missing from the page').toBe(desktopEl)
  })

  function unboundPair() {
    const wm = createWindowManager(VIEWPORT)
    const binder = createDesktopBinder(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    wm.open({ id: 'a', title: 'A' })
    wm.open({ id: 'b', title: 'B' })
    const a = document.createElement('section')
    const b = document.createElement('section')
    desktopEl.append(a, b)
    binder.bindWindow('a', a)
    binder.bindWindow('b', b)
    return { wm, binder, desktopEl, a, b, unbind: binder.bindDesktop(desktopEl) }
  }

  it('a desktop rebind leaves no window marked focused that is not', () => {
    const { wm, binder, desktopEl, a, b, unbind } = unboundPair()
    wm.focus('a')
    unbind()
    wm.focus('b')
    binder.bindDesktop(desktopEl)
    expect(b.hasAttribute('data-wm-focused')).toBe(true)
    expect(a.hasAttribute('data-wm-focused'), 'a stale focus marker survived the rebind').toBe(
      false,
    )
  })

  it('a window closed while the desktop is unbound stops claiming to be a window', () => {
    const { wm, binder, desktopEl, a, unbind } = unboundPair()
    unbind()
    wm.close('a')
    binder.bindDesktop(desktopEl)
    expect(a.getAttribute('data-wm-window')).toBeNull()
  })

  it('two pending bindings for one id do not break wm.open', () => {
    const wm = createWindowManager(VIEWPORT)
    const binder = createDesktopBinder(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    binder.bindDesktop(desktopEl)
    const first = document.createElement('section')
    const second = document.createElement('section')
    desktopEl.append(first, second)
    binder.bindWindow('a', first)
    binder.bindWindow('a', second)
    const changes: number[] = []
    wm.subscribe((state) => changes.push(state.order.length))

    expect(() => wm.open({ id: 'a', title: 'A' })).not.toThrow()
    expect(changes, 'the change event was swallowed').toEqual([1])
    expect(first.dataset.wmWindow).toBe('a')
    expect(second.dataset.wmWindow).toBeUndefined()
  })

  it('a bindWindow that throws leaves nothing behind', () => {
    const wm = createWindowManager(VIEWPORT)
    const binder = createDesktopBinder(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    binder.bindDesktop(desktopEl)
    wm.open({ id: 'a', title: 'A' })
    const first = document.createElement('section')
    const second = document.createElement('section')
    desktopEl.append(first, second)
    const unbindFirst = binder.bindWindow('a', first)
    expect(() => binder.bindWindow('a', second)).toThrow(/already attached/)

    unbindFirst()
    wm.close('a')
    wm.open({ id: 'a', title: 'A again' })
    expect(second.dataset.wmWindow, 'the binding whose call threw attached later').toBeUndefined()
  })
})

describe('framework timing and reactivity', () => {
  function countSubscriptions(wm: WindowManager) {
    let live = 0
    const subscribe = wm.subscribe
    wm.subscribe = (listener) => {
      live += 1
      const stop = subscribe(listener)
      return () => {
        live -= 1
        stop()
      }
    }
    return () => live
  }

  it('vue server rendering with a shared manager leaves no subscriptions behind', async () => {
    const shared = createWindowManager()
    shared.open({ id: 'a', title: 'A' })
    const live = countSubscriptions(shared)
    const Comp = defineComponent({
      setup: () => {
        const state = useVueState(shared)
        const win = useVueWindow(shared, 'a')
        return () => h('div', `${state.value.order.length} ${win.value?.title}`)
      },
    })
    for (let i = 0; i < 3; i += 1) {
      expect(await renderToString(createSSRApp(Comp))).toContain('1 A')
    }
    expect(live(), 'every server render leaked its listeners').toBe(0)
  })

  it('vue server rendering shows a window opened later in setup', async () => {
    const Comp = defineComponent({
      setup: () => {
        const wm = useVueManager()
        const state = useVueState(wm)
        const note = useVueWindow(wm, 'notes')
        wm.open({ id: 'notes', title: 'Notes' })
        return () => h('div', `${state.value.order.length} ${note.value?.title}`)
      },
    })
    expect(await renderToString(createSSRApp(Comp))).toContain('1 Notes')
  })

  it('vue server rendering shows a change made after setup already read the state', async () => {
    const Comp = defineComponent({
      setup: () => {
        const wm = useVueManager()
        const state = useVueState(wm)
        const note = useVueWindow(wm, 'notes')
        if (state.value.order.length === 0 && !note.value) wm.open({ id: 'notes', title: 'Notes' })
        return () => h('div', `${state.value.order.length} ${note.value?.title}`)
      },
    })
    expect(await renderToString(createSSRApp(Comp)), 'a cached read went out stale').toContain(
      '1 Notes',
    )
  })

  it('vue re-renders a mounted component only when its own window changes', async () => {
    const wm = createWindowManager(VIEWPORT)
    wm.open({ id: 'a', title: 'A' })
    wm.open({ id: 'b', title: 'B' })
    const live = countSubscriptions(wm)
    let renders = 0
    const Comp = defineComponent({
      setup: () => {
        const win = useVueWindow(wm, 'a')
        return () => {
          renders += 1
          return h('span', win.value?.title)
        }
      },
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(Comp)
    app.mount(host)
    wm.update('a', { title: 'A2' })
    await nextTick()
    expect(host.textContent).toBe('A2')

    const before = renders
    for (let i = 1; i <= 5; i += 1) {
      wm.move('b', i * 5, i * 5)
      await nextTick()
    }
    expect(renders - before, 'moving another window re-rendered this one').toBe(0)
    app.unmount()
    expect(live()).toBe(0)
  })

  it('solid binds elements once they are in the page, so a new window takes focus', () => {
    const wm = createWindowManager(VIEWPORT)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    wm.open({ id: 'a', title: 'A' })
    const section = document.createElement('section')

    const dispose = createRoot((done) => {
      const dk = createSolidDesktop(wm, DESKTOP_OPTIONS)
      dk.desktop(desktopEl)
      dk.window('a')(section)
      desktopEl.append(section)
      return done
    })
    expect(section.dataset.wmWindow).toBe('a')
    expect(document.activeElement, 'Solid assigns refs before inserting the element').toBe(section)

    dispose()
    expect(section.dataset.wmWindow).toBeUndefined()
  })

  it('solid binds at once outside an owner', () => {
    const wm = createWindowManager(VIEWPORT)
    const dk = createSolidDesktop(wm, DESKTOP_OPTIONS)
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)
    wm.open({ id: 'a', title: 'A' })
    const section = document.createElement('section')
    desktopEl.append(section)
    dk.window('a')(section)
    expect(section.dataset.wmWindow).toBe('a')
    dk.binder.destroy()
  })

  it('solid useWmWindow only notifies when that window changes', () => {
    const wm = createWindowManager(VIEWPORT)
    wm.open({ id: 'a', title: 'A' })
    wm.open({ id: 'b', title: 'B' })
    let runs = 0
    const dispose = createRoot((done) => {
      const win = useSolidWindow(wm, 'a')
      createEffect(() => {
        win()
        runs += 1
      })
      return done
    })
    wm.update('a', { title: 'A2' })
    expect(runs).toBe(2)
    for (let i = 1; i <= 5; i += 1) wm.move('b', i * 5, i * 5)
    expect(runs, 'moving window b re-ran a computation that only reads a').toBe(2)
    dispose()
  })

  it('solid useWmWindow outside an owner reads live and creates no computation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wm = createWindowManager(VIEWPORT)
    const win = useSolidWindow(wm, 'a')
    expect(win()).toBeUndefined()
    wm.open({ id: 'a', title: 'A' })
    expect(win()?.title).toBe('A')
    expect(warn, 'a computation that is never disposed was created').not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('solid useWmWindow on the server build sees a window opened later in the render', async () => {
    vi.resetModules()
    vi.doMock('solid-js', () => import('solid-js/dist/server.js' as string))
    try {
      const server = await import('solid-js')
      const adapter = await import('../../src/adapters/solid')
      const wm = createWindowManager(VIEWPORT)
      const seen = server.createRoot((done) => {
        const win = adapter.useWmWindow(wm, 'notes')
        const before = win()?.title
        wm.open({ id: 'notes', title: 'Notes' })
        const after = win()?.title
        done()
        return [before, after]
      })
      expect(seen, 'the server read was frozen at its first value').toEqual([undefined, 'Notes'])
    } finally {
      vi.doUnmock('solid-js')
      vi.resetModules()
    }
  })

  it('angular takes a manager change made inside a reactive context', () => {
    const wm = useNgManager(VIEWPORT)
    const state = useNgState(wm)
    const opening = ngComputed(() => wm.open({ id: 'inside', title: 'Inside' }).id)
    expect(() => opening(), 'the adapter wrote its signal inside a reactive context').not.toThrow()
    expect(state().windows.inside?.title).toBe('Inside')
  })
})

describe('titlebar context menu hook', () => {
  it('fires the hook with the window state and suppresses the native menu', () => {
    const wm = createWindowManager(VIEWPORT)
    const onMenu = vi.fn()
    const dk = createSvelteDesktop(wm, { ...DESKTOP_OPTIONS, onTitlebarContextMenu: onMenu })
    const desktopEl = document.createElement('div')
    document.body.append(desktopEl)
    dk.desktop(desktopEl)

    wm.open({ id: 'ctx', title: 'Menu' })
    const winEl = document.createElement('section')
    winEl.innerHTML = '<header data-wm-drag><span data-wm-title>Menu</span></header>'
    desktopEl.append(winEl)
    dk.window(winEl, { id: 'ctx' })

    const handle = winEl.querySelector('[data-wm-drag]') as HTMLElement
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    handle.dispatchEvent(event)

    expect(onMenu).toHaveBeenCalledTimes(1)
    expect(onMenu.mock.calls[0]?.[0]).toMatchObject({ id: 'ctx', title: 'Menu' })
    expect(event.defaultPrevented).toBe(true)
  })
})
