// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import {
  createTaskbar,
  type TaskbarController,
  type TaskbarOptions,
  taskbarMessages,
  taskbarMessagesRu,
} from '../../src/plugins/taskbar'
import { trackResources } from './support/resources'

let wm: WindowManager
let bar: HTMLElement
let taskbar: TaskbarController

function mount(options?: TaskbarOptions, prepare?: (element: HTMLElement) => void): void {
  wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  bar = document.createElement('div')
  prepare?.(bar)
  document.body.append(bar)
  wm.open({ id: 'a', title: 'Alpha' })
  wm.open({ id: 'b', title: 'Beta' })
  wm.open({ id: 'c', title: 'Gamma' })
  taskbar = createTaskbar(wm, bar, options)
}

const buttons = () => [...bar.querySelectorAll<HTMLButtonElement>('[data-wm-task]')]
const ids = () => buttons().map((button) => button.dataset.wmTask)
const button = (id: string) => bar.querySelector(`[data-wm-task="${id}"]`) as HTMLButtonElement
const click = (id: string, init: MouseEventInit = {}) =>
  button(id).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }))
const key = (name: string) =>
  (document.activeElement as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
  )

afterEach(() => {
  taskbar.destroy()
  document.body.replaceChildren()
})

describe('a taskbar', () => {
  it('shows a button for every window of the active workspace, in the order they opened', () => {
    mount()
    expect(ids()).toEqual(['a', 'b', 'c'])
    wm.focus('a')
    wm.sendToBack('c')
    expect(ids()).toEqual(['a', 'b', 'c'])
    expect(buttons().map((one) => one.textContent)).toEqual(['Alpha', 'Beta', 'Gamma'])
    for (const one of buttons()) expect(one.type).toBe('button')
    wm.open({ id: 'd', title: 'Delta', workspace: 1 })
    expect(ids()).toEqual(['a', 'b', 'c'])
    wm.setWorkspace(1)
    expect(ids()).toEqual(['d'])
  })

  it('orders by opening also when ids look like numbers, and puts a group where its oldest tab was', () => {
    mount()
    wm.open({ id: '7', title: 'Seven' })
    wm.open({ id: '3', title: 'Three' })
    expect(ids()).toEqual(['a', 'b', 'c', '7', '3'])
    wm.group(['3', 'b'])
    wm.activateTab('3')
    expect(ids()).toEqual(['a', '3', 'c', '7'])
  })

  it('presses the button of the focused window and carries the stage of each', () => {
    mount()
    const look = () =>
      buttons().map((one) => [
        one.dataset.wmTask,
        one.getAttribute('aria-pressed'),
        one.hasAttribute('data-wm-focused'),
        one.dataset.wmStage,
      ])
    expect(look()).toEqual([
      ['a', 'false', false, 'normal'],
      ['b', 'false', false, 'normal'],
      ['c', 'true', true, 'normal'],
    ])
    wm.minimize('c')
    wm.focus('a')
    wm.maximize('a')
    expect(look()).toEqual([
      ['a', 'true', true, 'maximized'],
      ['b', 'false', false, 'normal'],
      ['c', 'false', false, 'minimized'],
    ])
    wm.blur()
    expect(look().map((entry) => entry[1])).toEqual(['false', 'false', 'false'])
  })

  it('keeps the element of a button while its window lives and follows the title', () => {
    mount()
    const before = buttons()
    wm.update('b', { title: 'Renamed' })
    wm.focus('a')
    wm.close('a')
    wm.open({ id: 'e', title: 'Epsilon' })
    expect(ids()).toEqual(['b', 'c', 'e'])
    expect(button('b')).toBe(before[1])
    expect(button('c')).toBe(before[2])
    expect(button('b').textContent).toBe('Renamed')
    expect(before[0]?.isConnected).toBe(false)
  })

  it('writes nothing to a button whose window did not change', () => {
    mount()
    const seen: MutationRecord[] = []
    const watch = new MutationObserver((records) => seen.push(...records))
    watch.observe(button('a'), {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    })
    wm.move('b', 300, 300)
    wm.update('c', { title: 'Other' })
    seen.push(...watch.takeRecords())
    watch.disconnect()
    expect(seen).toEqual([])
  })

  it('brings back a minimized window, focuses one in the background, minimizes the focused one', () => {
    mount()
    wm.minimize('a')
    click('a')
    expect(wm.get('a')?.stage).toBe('normal')
    expect(wm.getState().focusedId).toBe('a')
    click('b')
    expect(wm.getState().focusedId).toBe('b')
    click('b')
    expect(wm.get('b')?.stage).toBe('minimized')
    wm.focus('c')
    wm.update('c', { minimizable: false })
    click('c')
    expect(wm.get('c')?.stage).toBe('normal')
    expect(wm.getState().focusedId).toBe('c')
  })

  it('asks a window to close on a middle click, and only one that may be closed', async () => {
    mount()
    const guard = vi.fn((win: { id: string }) => win.id !== 'b')
    wm.onBeforeClose(guard)
    const middle = (id: string) =>
      button(id).dispatchEvent(
        new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }),
      )
    middle('a')
    middle('b')
    wm.update('c', { closable: false })
    middle('c')
    button('c').dispatchEvent(
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 }),
    )
    expect(guard.mock.calls.map(([win]) => win.id)).toEqual(['a', 'b'])
    expect(ids()).toEqual(['b', 'c'])
  })

  it('shows one button for a tab group: the active tab, with the number of tabs', () => {
    mount()
    wm.group(['a', 'c'])
    wm.activateTab('c')
    expect(ids()).toEqual(['c', 'b'])
    const group = button('c')
    expect(group.querySelector('[data-wm-task-title]')?.textContent).toBe('Gamma')
    expect(group.querySelector('[data-wm-task-count]')?.textContent).toBe('2')
    expect(group.querySelector('[data-wm-task-count]')?.getAttribute('aria-hidden')).toBe('true')
    expect(group.getAttribute('aria-label')).toBe(taskbarMessages.tabs('Gamma', 2))
    expect(button('b').hasAttribute('aria-label')).toBe(false)
    expect(button('b').querySelector('[data-wm-task-count]')).toBeNull()

    wm.activateTab('a')
    expect(ids()).toEqual(['a', 'b'])
    expect(button('a')).toBe(group)
    wm.ungroup('a')
    expect(ids()).toEqual(['a', 'b', 'c'])
    expect(button('a').hasAttribute('aria-label')).toBe(false)
    expect(button('a').querySelector('[data-wm-task-count]')).toBeNull()
  })

  it('lists only minimized windows when it is asked to', () => {
    mount({ show: 'minimized' })
    expect(ids()).toEqual([])
    wm.minimize('b')
    wm.minimize('a')
    expect(ids()).toEqual(['a', 'b'])
    click('a')
    expect(ids()).toEqual(['b'])
    expect(wm.getState().focusedId).toBe('a')
  })

  it('lists every workspace when it is asked to, and a click goes to the workspace', () => {
    mount({ workspace: 'all' })
    wm.open({ id: 'd', title: 'Delta', workspace: 2 })
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
    click('d')
    expect(wm.workspace()).toBe(2)
    expect(wm.getState().focusedId).toBe('d')
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('is a toolbar with one tab stop that arrows, Home and End move', () => {
    mount()
    expect(bar.getAttribute('role')).toBe('toolbar')
    expect(bar.getAttribute('aria-label')).toBe(taskbarMessages.label)
    const stops = () => buttons().map((one) => one.tabIndex)
    expect(stops()).toEqual([-1, -1, 0])
    button('c').focus()
    key('ArrowLeft')
    expect(document.activeElement).toBe(button('b'))
    expect(stops()).toEqual([-1, 0, -1])
    key('ArrowUp')
    expect(document.activeElement).toBe(button('a'))
    key('ArrowLeft')
    expect(document.activeElement).toBe(button('c'))
    key('ArrowRight')
    expect(document.activeElement).toBe(button('a'))
    key('ArrowDown')
    expect(document.activeElement).toBe(button('b'))
    key('End')
    expect(document.activeElement).toBe(button('c'))
    key('Home')
    expect(document.activeElement).toBe(button('a'))
    expect(stops()).toEqual([0, -1, -1])
    const typed = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true })
    button('a').dispatchEvent(typed)
    expect(typed.defaultPrevented).toBe(false)
    expect(wm.getState().focusedId).toBe('c')
  })

  it('walks the other way in a bar that reads right to left', () => {
    mount(undefined, (element) => {
      element.style.direction = 'rtl'
    })
    button('b').focus()
    key('ArrowLeft')
    expect(document.activeElement).toBe(button('c'))
    key('ArrowRight')
    key('ArrowRight')
    expect(document.activeElement).toBe(button('a'))
    key('ArrowDown')
    expect(document.activeElement).toBe(button('b'))
  })

  it('keeps the tab stop on the focused window while the keyboard is elsewhere, and where the user left it while it is inside', () => {
    mount()
    const stops = () => buttons().map((one) => one.tabIndex)
    wm.focus('a')
    expect(stops()).toEqual([0, -1, -1])
    wm.blur()
    expect(stops()).toEqual([0, -1, -1])
    button('b').focus()
    wm.focus('c')
    expect(stops()).toEqual([-1, 0, -1])
    button('b').blur()
    wm.focus('a')
    expect(stops()).toEqual([0, -1, -1])
  })

  it('moves the tab stop to a button that is left when the one that had it goes', () => {
    mount()
    button('b').focus()
    wm.close('b')
    expect(buttons().map((one) => one.tabIndex)).toEqual([-1, 0])
    wm.closeAll()
    expect(buttons()).toEqual([])
    wm.open({ id: 'z', title: 'Zeta' })
    expect(buttons().map((one) => one.tabIndex)).toEqual([0])
  })

  it('keeps the label the element came with', () => {
    mount(undefined, (element) => element.setAttribute('aria-label', 'Open apps'))
    expect(bar.getAttribute('aria-label')).toBe('Open apps')
    taskbar.destroy()
    expect(bar.getAttribute('aria-label')).toBe('Open apps')
  })

  it('speaks Russian with the Russian catalogue, and takes single lines from the caller', () => {
    mount({ messages: taskbarMessagesRu })
    wm.group(['a', 'b'])
    wm.activateTab('b')
    expect(bar.getAttribute('aria-label')).toBe('Окна')
    expect(button('b').getAttribute('aria-label')).toBe('Beta, вкладок: 2')
    expect(Object.keys(taskbarMessagesRu).sort()).toEqual(Object.keys(taskbarMessages).sort())
    taskbar.destroy()
    document.body.replaceChildren()

    mount({ messages: { label: 'Running' } })
    wm.group(['a', 'b'])
    wm.activateTab('b')
    expect(bar.getAttribute('aria-label')).toBe('Running')
    expect(button('b').getAttribute('aria-label')).toBe('Beta, 2 tabs')
  })

  it('gives the button of a window, of any tab of a group, and nothing for a window it does not show', () => {
    mount({ show: 'minimized' })
    const heard: Array<Element | null> = []
    wm.on('stage', ({ window: win }) => heard.push(taskbar.targetOf(win)))
    wm.minimize('a')
    expect(heard).toEqual([button('a')])
    expect(taskbar.targetOf(wm.get('b') as never)).toBeNull()
    wm.group(['b', 'c'])
    wm.activateTab('c')
    wm.minimize('c')
    expect(taskbar.targetOf(wm.get('b') as never)).toBe(button('c'))
  })

  it('leaves children that are not its own alone', () => {
    const clock = document.createElement('time')
    mount(undefined, (element) => element.append(clock))
    wm.close('a')
    wm.open({ id: 'n' })
    expect(clock.parentElement).toBe(bar)
    taskbar.destroy()
    expect([...bar.children]).toEqual([clock])
  })

  it('takes everything it brought away with it', () => {
    const resources = trackResources()
    wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
    bar = document.createElement('div')
    document.body.append(bar)
    wm.open({ id: 'a' })
    taskbar = createTaskbar(wm, bar)
    button('a').focus()
    taskbar.destroy()
    taskbar.destroy()
    expect(bar.children).toHaveLength(0)
    expect(bar.hasAttribute('role')).toBe(false)
    expect(bar.hasAttribute('aria-label')).toBe(false)
    wm.open({ id: 'b' })
    expect(bar.children).toHaveLength(0)
    expect(resources.leaks()).toEqual([])
    resources.restore()
  })
})

describe('a taskbar in less usual circumstances', () => {
  it('gives the first button the tab stop when no window has the focus', () => {
    wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
    bar = document.createElement('div')
    document.body.append(bar)
    wm.open({ id: 'a', title: 'Alpha' })
    wm.open({ id: 'b', title: 'Beta' })
    wm.blur()
    taskbar = createTaskbar(wm, bar)
    expect(buttons().map((one) => one.tabIndex)).toEqual([0, -1])
  })

  it('keeps one tab stop when the button that had it goes while the focus is on something else in the bar', () => {
    const extra = document.createElement('button')
    mount(undefined, (element) => element.append(extra))
    button('b').focus()
    extra.focus()
    wm.blur()
    wm.close('b')
    expect(buttons().map((one) => one.tabIndex)).toEqual([0, -1])
    wm.focus('c')
    wm.close('a')
    expect(buttons().map((one) => one.tabIndex)).toEqual([0])
  })

  it('answers only to its own buttons', () => {
    const stranger = document.createElement('button')
    stranger.dataset.wmTask = 'a'
    mount(undefined, (element) => element.append(stranger))
    wm.focus('b')
    stranger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    bar.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    stranger.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    bar.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    stranger.focus()
    stranger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(wm.getState().focusedId).toBe('b')
    expect(Object.keys(wm.getState().windows)).toEqual(['a', 'b', 'c'])
    expect(document.activeElement).toBe(stranger)
  })

  it('leaves the arrows to the page when a modifier is held', () => {
    mount()
    button('a').focus()
    for (const held of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      const pressed = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
        ...held,
      })
      button('a').dispatchEvent(pressed)
      expect(pressed.defaultPrevented).toBe(false)
    }
    expect(document.activeElement).toBe(button('a'))
  })

  it('does nothing for a button whose window went away behind its back', () => {
    mount()
    wm.destroy()
    wm.close('a')
    expect(ids()).toEqual(['a', 'b', 'c'])
    expect(() => click('a')).not.toThrow()
    button('a').dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(wm.get('a')).toBeUndefined()
  })

  it('gives no button once it is destroyed, and puts back the role the element came with', () => {
    mount(undefined, (element) => element.setAttribute('role', 'navigation'))
    expect(bar.getAttribute('role')).toBe('toolbar')
    const win = wm.get('a') as never
    expect(taskbar.targetOf(win)).toBe(button('a'))
    wm.close('a')
    expect(taskbar.targetOf(win)).toBeNull()
    expect(taskbar.targetOf(wm.get('b') as never)).toBe(button('b'))
    taskbar.destroy()
    expect(taskbar.targetOf(wm.get('b') as never)).toBeNull()
    expect(bar.getAttribute('role')).toBe('navigation')
  })

  it('never mixes up a window and a group that carry the same name', () => {
    mount()
    wm.open({ id: 'wm-group-1', title: 'Named like a group' })
    wm.group(['a', 'b'])
    wm.activateTab('a')
    expect(Object.keys(wm.getState().groups)).toEqual(['wm-group-1'])
    expect(ids()).toEqual(['a', 'c', 'wm-group-1'])
    expect(button('wm-group-1').querySelector('[data-wm-task-count]')).toBeNull()
    expect(taskbar.targetOf(wm.get('wm-group-1') as never)).toBe(button('wm-group-1'))
    expect(taskbar.targetOf(wm.get('b') as never)).toBe(button('a'))
  })
})
