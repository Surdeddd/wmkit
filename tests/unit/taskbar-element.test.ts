// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import { defineWmElements, type WmDesktopElement } from '../../src/plugins/elements'
import {
  defineWmTaskbar,
  taskbarMessagesRu,
  type WmTaskbarElement,
} from '../../src/plugins/taskbar'
import { trackResources } from './support/resources'

class StubObserver {
  observe(): void {}
  disconnect(): void {}
}

const settle = () => new Promise<void>((resolve) => setImmediate(resolve))

function mount(html: string): HTMLElement {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  return holder
}

const tasks = (bar: Element) =>
  [...bar.querySelectorAll<HTMLElement>('[data-wm-task]')].map((button) => button.textContent)

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubObserver)
  defineWmElements()
  defineWmTaskbar()
})

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('<wm-taskbar>', () => {
  it('lists the windows of the desktop that its for attribute names', () => {
    const page = mount(
      '<wm-desktop id="desk"><wm-window label="Alpha"></wm-window><wm-window label="Beta"></wm-window></wm-desktop>' +
        '<wm-taskbar for="desk"></wm-taskbar>',
    )
    const bar = page.querySelector('wm-taskbar') as WmTaskbarElement
    const desk = page.querySelector('wm-desktop') as WmDesktopElement
    expect(bar.getAttribute('role')).toBe('toolbar')
    expect(tasks(bar)).toEqual(['Alpha', 'Beta'])
    desk.manager?.open({ title: 'Gamma' })
    expect(tasks(bar)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(bar.controller?.element).toBe(bar)
  })

  it('waits for a desktop that is defined after it', async () => {
    const page = mount(
      '<wm-taskbar for="later"></wm-taskbar>' +
        '<slow-desktop id="later"><slow-window label="Late"></slow-window></slow-desktop>',
    )
    const bar = page.querySelector('wm-taskbar') as WmTaskbarElement
    expect(bar.controller).toBeNull()
    expect(tasks(bar)).toEqual([])
    defineWmElements({ prefix: 'slow' })
    await settle()
    expect(tasks(bar)).toEqual(['Late'])
  })

  it('stays empty next to an element that is no desktop, and without a for', async () => {
    const page = mount(
      '<div id="plain"></div><wm-taskbar for="plain"></wm-taskbar><wm-taskbar></wm-taskbar>' +
        '<wm-taskbar for="nowhere"></wm-taskbar><never-defined id="x"></never-defined>',
    )
    await settle()
    for (const bar of page.querySelectorAll<WmTaskbarElement>('wm-taskbar')) {
      expect(bar.controller).toBeNull()
      expect(bar.hasAttribute('role')).toBe(false)
      expect(bar.targetOf({ id: 'a' } as never)).toBeNull()
    }
  })

  it('takes a manager through its property, before or after it joins the page', () => {
    const wm = createWindowManager({ viewport: { width: 800, height: 600 } })
    wm.open({ id: 'a', title: 'Alpha' })
    const early = document.createElement('wm-taskbar') as WmTaskbarElement
    early.manager = wm
    expect(early.controller).toBeNull()
    document.body.append(early)
    expect(tasks(early)).toEqual(['Alpha'])

    const late = document.createElement('wm-taskbar') as WmTaskbarElement
    document.body.append(late)
    expect(late.controller).toBeNull()
    late.manager = wm
    expect(late.manager).toBe(wm)
    expect(tasks(late)).toEqual(['Alpha'])
    expect(late.targetOf(wm.get('a') as never)).toBe(late.querySelector('[data-wm-task="a"]'))
    late.manager = null
    expect(tasks(late)).toEqual([])
    expect(late.controller).toBeNull()
  })

  it('follows its show and workspace attributes and its messages', () => {
    const wm = createWindowManager({ viewport: { width: 800, height: 600 } })
    wm.open({ id: 'a', title: 'Alpha' })
    wm.open({ id: 'b', title: 'Beta', workspace: 1 })
    wm.open({ id: 'c', title: 'Gamma' })
    wm.minimize('c')
    const bar = document.createElement('wm-taskbar') as WmTaskbarElement
    bar.manager = wm
    document.body.append(bar)
    expect(tasks(bar)).toEqual(['Alpha', 'Gamma'])
    bar.setAttribute('show', 'minimized')
    expect(tasks(bar)).toEqual(['Gamma'])
    bar.setAttribute('show', 'everything')
    bar.setAttribute('workspace', 'all')
    expect(tasks(bar)).toEqual(['Alpha', 'Beta', 'Gamma'])
    bar.removeAttribute('workspace')
    expect(tasks(bar)).toEqual(['Alpha', 'Gamma'])
    expect(bar.messages).toBeNull()
    bar.messages = taskbarMessagesRu
    expect(bar.messages).toBe(taskbarMessagesRu)
    expect(bar.getAttribute('aria-label')).toBe('Окна')
  })

  it('lets go of everything when it leaves the page and picks it up when it returns', () => {
    const resources = trackResources()
    const wm = createWindowManager({ viewport: { width: 800, height: 600 } })
    wm.open({ id: 'a', title: 'Alpha' })
    const bar = document.createElement('wm-taskbar') as WmTaskbarElement
    bar.manager = wm
    document.body.append(bar)
    bar.remove()
    expect(bar.children).toHaveLength(0)
    expect(bar.controller).toBeNull()
    expect(resources.leaks()).toEqual([])
    wm.open({ id: 'b', title: 'Beta' })
    document.body.append(bar)
    expect(tasks(bar)).toEqual(['Alpha', 'Beta'])
    bar.remove()
    expect(resources.leaks()).toEqual([])
    resources.restore()
  })

  it('defines itself once under any prefix', () => {
    defineWmTaskbar()
    defineWmTaskbar({ prefix: 'os' })
    defineWmTaskbar({ prefix: 'os' })
    expect(customElements.get('os-taskbar')).toBeDefined()
    expect(customElements.get('os-taskbar')).not.toBe(customElements.get('wm-taskbar'))
  })

  it('does nothing where custom elements do not exist', () => {
    vi.stubGlobal('customElements', undefined)
    expect(() => defineWmTaskbar({ prefix: 'none' })).not.toThrow()
  })
})
