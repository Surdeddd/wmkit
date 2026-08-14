// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { createElement, useEffect } from 'react'
import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
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
import type { WindowManager, WindowState } from '../../src/core/types'
import type { DesktopBinder } from '../../src/dom/binder'
import { isPopoutSupported, popout } from '../../src/plugins/popout'

const VIEWPORT = { viewport: { width: 800, height: 600 } }
const DESKTOP_OPTIONS = { autoViewport: false, announce: false } as const

afterEach(() => {
  document.body.replaceChildren()
})

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
    createRoot((dispose) => {
      const wm = useSolidManager(VIEWPORT)
      const state = useSolidState(wm)
      const dk = createSolidDesktop(wm, DESKTOP_OPTIONS)

      const desktopEl = document.createElement('div')
      document.body.append(desktopEl)
      dk.desktop(desktopEl)

      wm.open({ id: 'sol', title: 'Solid' })
      const winEl = document.createElement('section')
      desktopEl.append(winEl)
      dk.window('sol')(winEl)

      expect(desktopEl.dataset.wmDesktop).toBe('')
      expect(winEl.dataset.wmWindow).toBe('sol')
      expect(state().windows.sol?.title).toBe('Solid')
      dispose()
    })
  })
})

describe('popout smoke', () => {
  it('moves content into a picture-in-picture window and back', async () => {
    const pipDoc = document.implementation.createHTMLDocument('pip')
    const pipWindow = {
      document: pipDoc,
      addEventListener: vi.fn(),
      close: vi.fn(),
    }
    const requestWindow = vi.fn(async () => pipWindow as unknown as Window)
    Object.defineProperty(window, 'documentPictureInPicture', {
      configurable: true,
      value: { requestWindow },
    })

    expect(isPopoutSupported()).toBe(true)

    const wm = createWindowManager(VIEWPORT)
    wm.open({ id: 'p', title: 'Popped', width: 300, height: 200 })
    const host = document.createElement('div')
    const content = document.createElement('div')
    host.append(content)
    document.body.append(host)

    const handle = await popout(wm, 'p', content)
    expect(requestWindow).toHaveBeenCalledWith({ width: 300, height: 200 })
    expect(content.ownerDocument).toBe(pipDoc)
    expect(pipDoc.title).toBe('Popped')
    expect(wm.get('p')?.stage).toBe('minimized')

    handle.close()
    expect(pipWindow.close).toHaveBeenCalled()
    expect(content.parentNode).toBe(host)
    expect(wm.get('p')?.stage).toBe('normal')

    Object.defineProperty(window, 'documentPictureInPicture', {
      configurable: true,
      value: undefined,
    })
    expect(isPopoutSupported()).toBe(false)
    await expect(popout(wm, 'p', content)).rejects.toThrow(/not supported/)
    await expect(popout(wm, 'ghost', content)).rejects.toThrow(/unknown window/)
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
      let wanted = 'a'
      const win = useSolidWindow(wm, () => wanted)
      expect(win()?.title).toBe('A')

      wanted = 'b'
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
