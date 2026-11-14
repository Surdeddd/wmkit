// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController, DesktopOptions } from '../../src/dom/shared'
import { stubFrames } from './support/frames'

interface Gate {
  promise: Promise<boolean | undefined>
  open(value?: boolean): void
  fail(error: unknown): void
}

function gate(): Gate {
  let open!: (value?: boolean) => void
  let fail!: (error: unknown) => void
  const promise = new Promise<boolean | undefined>((resolve, reject) => {
    open = resolve
    fail = reject
  })
  return { promise, open, fail }
}

const turn = () => new Promise<void>((resolve) => setImmediate(resolve))

let wm: WindowManager
let desktop: DesktopController
let host: HTMLElement
let release: () => void

function build(): HTMLElement {
  const root = document.createElement('section')
  root.innerHTML =
    '<header data-wm-drag><span data-wm-title>t</span>' +
    '<button data-wm-close type="button"></button></header>'
  host.append(root)
  return root
}

function mount(options: DesktopOptions = {}): HTMLElement {
  host = document.createElement('div')
  document.body.append(host)
  wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  desktop = attachDesktop(wm, host, { autoViewport: false, announce: false, ...options })
  wm.open({ id: 'a', x: 100, y: 100, width: 240, height: 180 })
  const root = build()
  release = desktop.attachWindow('a', root)
  return root
}

const press = (root: HTMLElement) =>
  (root.querySelector('[data-wm-close]') as HTMLElement).dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true }),
  )

beforeEach(() => {
  stubFrames()
})

afterEach(() => {
  desktop.destroy()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('the close button of a window', () => {
  it('closes at once when nobody objects', () => {
    const root = mount()
    press(root)
    expect(wm.get('a')).toBeUndefined()
    expect(root.hasAttribute('data-wm-closing')).toBe(false)
  })

  it('asks the guards of the manager and keeps the window on a no', () => {
    const root = mount()
    const guard = vi.fn(() => false)
    wm.onBeforeClose(guard)
    press(root)
    expect(guard).toHaveBeenCalledTimes(1)
    expect(wm.get('a')).toBeDefined()
    expect(root.hasAttribute('data-wm-closing')).toBe(false)
  })

  it('marks the window while a guard thinks and closes it on a late yes', async () => {
    const root = mount()
    const later = gate()
    wm.onBeforeClose(() => later.promise)
    press(root)
    expect(wm.get('a')).toBeDefined()
    expect(root.getAttribute('data-wm-closing')).toBe('')
    later.open()
    await turn()
    expect(wm.get('a')).toBeUndefined()
    expect(root.hasAttribute('data-wm-closing')).toBe(false)
    expect(root.hasAttribute('data-wm-window')).toBe(false)
  })

  it('takes the mark off when the late answer is no', async () => {
    const root = mount()
    const later = gate()
    wm.onBeforeClose(() => later.promise)
    press(root)
    later.open(false)
    await turn()
    expect(wm.get('a')).toBeDefined()
    expect(root.hasAttribute('data-wm-closing')).toBe(false)
  })

  it('asks once however often it is pressed during the wait', async () => {
    const root = mount()
    const later = gate()
    const guard = vi.fn(() => later.promise)
    wm.onBeforeClose(guard)
    press(root)
    press(root)
    press(root)
    expect(guard).toHaveBeenCalledTimes(1)
    later.open()
    await turn()
    expect(wm.get('a')).toBeUndefined()
  })

  it('asks the beforeClose option first and the guards only after its yes', () => {
    const calls: string[] = []
    let allow = false
    const root = mount({
      beforeClose: () => {
        calls.push('option')
        return allow
      },
    })
    wm.onBeforeClose(() => {
      calls.push('guard')
      return false
    })
    press(root)
    expect(calls).toEqual(['option'])
    allow = true
    press(root)
    expect(calls).toEqual(['option', 'option', 'guard'])
    expect(wm.get('a')).toBeDefined()
  })

  it('asks nobody about a window that cannot be closed', () => {
    const root = mount()
    const guard = vi.fn()
    wm.onBeforeClose(guard)
    wm.update('a', { closable: false })
    press(root)
    expect(guard).not.toHaveBeenCalled()
    expect(wm.get('a')).toBeDefined()
  })

  it('leaves what a guard threw to the promise of the request', async () => {
    const root = mount()
    const asked: Array<Promise<boolean>> = []
    const ask = wm.requestClose
    wm.requestClose = (id) => {
      const promise = ask(id)
      asked.push(promise)
      return promise
    }
    wm.onBeforeClose(() => {
      throw new Error('no disk')
    })
    press(root)
    expect(asked).toHaveLength(1)
    await expect(asked[0]).rejects.toThrow('no disk')
    expect(wm.get('a')).toBeDefined()
    expect(root.hasAttribute('data-wm-closing')).toBe(false)
  })
})

describe('the close action of a window', () => {
  it('says whether the window is closed by the time it returns', async () => {
    mount()
    const later = gate()
    let answer: boolean | Promise<boolean | undefined> = false
    wm.onBeforeClose(() => answer)
    const actions = desktop.actions('a')
    expect(actions.close()).toBe(false)
    answer = later.promise
    expect(actions.close()).toBe(false)
    later.open()
    await turn()
    expect(wm.get('a')).toBeUndefined()
    expect(actions.close()).toBe(false)

    wm.open({ id: 'b' })
    answer = true
    expect(desktop.actions('b').close()).toBe(true)
  })
})

describe('the mark of a window that waits for an answer', () => {
  it('is set for a request nobody made through the desktop', async () => {
    const root = mount()
    const later = gate()
    wm.onBeforeClose(() => later.promise)
    const asked = wm.requestClose('a')
    expect(root.getAttribute('data-wm-closing')).toBe('')
    later.open(false)
    await asked
    expect(root.hasAttribute('data-wm-closing')).toBe(false)
  })

  it('moves to the element that takes the window over during the wait', async () => {
    const root = mount()
    const later = gate()
    wm.onBeforeClose(() => later.promise)
    void wm.requestClose('a')
    const next = build()
    release()
    desktop.attachWindow('a', next)
    expect(root.hasAttribute('data-wm-closing')).toBe(false)
    expect(next.getAttribute('data-wm-closing')).toBe('')
    later.open(false)
    await turn()
    expect(next.hasAttribute('data-wm-closing')).toBe(false)
  })

  it('is not given to a window that opens later with the id of one that left during its wait', async () => {
    mount()
    const later = gate()
    wm.onBeforeClose((win) => (win.title === 'old' ? later.promise : undefined))
    wm.update('a', { title: 'old' })
    void wm.requestClose('a')
    wm.close('a')
    wm.open({ id: 'a', title: 'new' })
    const next = build()
    desktop.attachWindow('a', next)
    expect(next.hasAttribute('data-wm-closing')).toBe(false)
    later.open()
    await turn()
    expect(wm.get('a')?.title).toBe('new')
  })

  it('is not left on an element that lets the window go', () => {
    const root = mount()
    const later = gate()
    wm.onBeforeClose(() => later.promise)
    void wm.requestClose('a')
    expect(root.hasAttribute('data-wm-closing')).toBe(true)
    release()
    expect(root.hasAttribute('data-wm-closing')).toBe(false)
    later.open(false)
  })
})
