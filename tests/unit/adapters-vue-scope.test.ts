// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import {
  useDesktop,
  useWindowManager,
  useWmState,
  useWmWindow,
  useWmWindowEl,
} from '../../src/adapters/vue'
import { createWindowManager } from '../../src/core/manager'

class StubObserver {
  observe(): void {}
  disconnect(): void {}
}

const quiet = { autoViewport: false, announce: false } as const

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('vue composables inside a scope', () => {
  it('destroy the manager they made when the scope stops', () => {
    const scope = effectScope()
    const wm = scope.run(() => useWindowManager({ viewport: { width: 800, height: 600 } }))
    const heard = vi.fn()
    wm?.subscribe(heard)
    wm?.open({ id: 'a' })
    expect(heard).toHaveBeenCalledTimes(1)
    scope.stop()
    wm?.open({ id: 'b' })
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('stop following the manager when the scope stops', () => {
    const wm = createWindowManager({ viewport: { width: 800, height: 600 } })
    wm.open({ id: 'a', title: 'Alpha' })
    const scope = effectScope()
    const [state, win] = scope.run(() => [useWmState(wm), useWmWindow(wm, 'a')] as const) ?? []
    expect(state?.value.order).toEqual(['a'])
    wm.update('a', { title: 'Seen' })
    expect(win?.value?.title).toBe('Seen')
    const calls = vi.spyOn(wm, 'getState')
    scope.stop()
    wm.open({ id: 'b' })
    expect(calls).not.toHaveBeenCalled()
  })

  it('bind an element that was there before they ran, and let it go when the scope stops', async () => {
    const wm = createWindowManager({ viewport: { width: 800, height: 600 } })
    wm.open({ id: 'a' })
    const desk = document.createElement('div')
    const section = document.createElement('section')
    desk.append(section)
    document.body.append(desk)
    const scope = effectScope()
    const binder = scope.run(() => {
      const made = useDesktop(wm, ref(desk), quiet)
      useWmWindowEl(made, 'a', ref(section), { resizeHandles: false })
      return made
    })
    await nextTick()
    expect(binder?.controller()?.element).toBe(desk)
    expect(section.dataset.wmWindow).toBe('a')
    expect(section.querySelector('[data-wm-resize]')).toBeNull()
    scope.stop()
    expect(binder?.controller()).toBeNull()
    expect(section.dataset.wmWindow).toBeUndefined()
  })

  it('work outside any scope without a word from vue', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wm = useWindowManager({ viewport: { width: 800, height: 600 } })
    const state = useWmState(wm)
    wm.open({ id: 'a' })
    expect(state.value.order).toEqual(['a'])
    const desk = document.createElement('div')
    document.body.append(desk)
    const binder = useDesktop(wm, ref(desk), quiet)
    await nextTick()
    expect(binder.controller()?.element).toBe(desk)
    expect(warned).not.toHaveBeenCalled()
    binder.destroy()
    warned.mockRestore()
  })
})
