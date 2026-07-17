// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { createElement, useEffect } from 'react'
import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import {
  useDesktop,
  useWindowManager as useReactManager,
  useWmState as useReactState,
  useWmWindowRef,
} from '../../src/adapters/react'
import {
  createDesktop as createSolidDesktop,
  useWindowManager as useSolidManager,
  useWmState as useSolidState,
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
