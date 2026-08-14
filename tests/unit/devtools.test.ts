// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import {
  createDevtools,
  devtoolsMessages,
  devtoolsMessagesRu,
} from '../../src/plugins/devtools/index'

const VIEWPORT = { viewport: { width: 800, height: 600 } }

function rowsOf(panel: HTMLElement): string[] {
  return [...panel.querySelectorAll<HTMLElement>('[data-wm-devtools-row]')].map(
    (node) => node.dataset.wmDevtoolsRow ?? '',
  )
}

function actionButton(panel: HTMLElement, action: string, id: string): HTMLButtonElement {
  return panel.querySelector<HTMLButtonElement>(
    `button[data-wm-devtools-action="${action}"][data-wm-devtools-id="${id}"]`,
  ) as HTMLButtonElement
}

function globalButton(panel: HTMLElement, action: string): HTMLButtonElement {
  return panel.querySelector<HTMLButtonElement>(
    `button[data-wm-devtools-global="${action}"]`,
  ) as HTMLButtonElement
}

function logLines(panel: HTMLElement): string[] {
  return [...panel.querySelectorAll('.wm-dt-log li')].map((node) => node.textContent ?? '')
}

afterEach(() => {
  document.body.replaceChildren()
  document.head.querySelector('#wm-devtools-style')?.remove()
  vi.unstubAllGlobals()
})

describe('devtools messages', () => {
  it('ships an english and a russian catalog with the same keys', () => {
    expect(Object.keys(devtoolsMessagesRu).sort()).toEqual(Object.keys(devtoolsMessages).sort())
    expect(devtoolsMessages.stage('maximized')).toBe('maximized')
    expect(devtoolsMessagesRu.stage('maximized')).toBe('развёрнуто')
    expect(devtoolsMessagesRu.workspace(2)).toBe('рабочий стол 3')
    expect(devtoolsMessages.workspace(0)).toBe('workspace 1')
  })
})

describe('devtools panel', () => {
  it('lists the open windows newest first and follows the manager', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm)

    expect(panel.element.querySelector('p')?.textContent).toBe(devtoolsMessages.empty)

    wm.open({ id: 'a', title: 'First' })
    wm.open({ id: 'b', title: 'Second' })
    expect(rowsOf(panel.element)).toEqual(['b', 'a'])

    wm.close('a')
    expect(rowsOf(panel.element)).toEqual(['b'])
    panel.destroy()
  })

  it('shows the stage, layer, workspace and geometry of every window', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm)
    wm.open({ id: 'a', title: 'First', x: 12, y: 34, width: 200, height: 150, layer: 'modal' })

    const meta = panel.element.querySelector('.wm-dt-meta')?.textContent ?? ''
    expect(meta).toContain('normal')
    expect(meta).toContain('modal')
    expect(meta).toContain('workspace 1')
    expect(meta).toContain('12,34 200×150')
    panel.destroy()
  })

  it('marks the focused window', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm)
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })

    const focused = panel.element.querySelector('[data-wm-devtools-row][data-focused]')
    expect(focused?.getAttribute('data-wm-devtools-row')).toBe('b')
    panel.destroy()
  })

  it('drives the manager from the row buttons', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm)
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })

    actionButton(panel.element, 'focus', 'a').click()
    expect(wm.getState().focusedId).toBe('a')

    actionButton(panel.element, 'minimize', 'a').click()
    expect(wm.get('a')?.stage).toBe('minimized')

    actionButton(panel.element, 'maximize', 'b').click()
    expect(wm.get('b')?.stage).toBe('maximized')

    actionButton(panel.element, 'close', 'b').click()
    expect(wm.get('b')).toBeUndefined()
    panel.destroy()
  })

  it('ignores clicks that are not on a control without throwing', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm)
    wm.open({ id: 'a' })

    const thrown: unknown[] = []
    const onError = (event: ErrorEvent) => {
      thrown.push(event.error)
      event.preventDefault()
    }
    window.addEventListener('error', onError)
    panel.element.querySelector('h2')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    window.removeEventListener('error', onError)

    expect(thrown).toEqual([])
    expect(wm.get('a')).toBeDefined()
    panel.destroy()
  })

  it('logs the events it was asked for and caps the buffer', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm, { logLimit: 3 })

    expect(panel.element.textContent).toContain(devtoolsMessages.quiet)

    for (const id of ['a', 'b', 'c', 'd']) wm.open({ id })
    const lines = logLines(panel.element)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('d')
    expect(lines.join(' ')).not.toContain('opena')
    panel.destroy()
  })

  it('spells out a stage change and a workspace switch', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm)
    wm.open({ id: 'a' })
    wm.maximize('a')
    expect(logLines(panel.element)[0]).toContain('a → maximized')

    wm.setWorkspace(2)
    expect(logLines(panel.element)[0]).toContain('3')
    panel.destroy()
  })

  it('names the group a grouping event carries', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm, { events: ['group'] })
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    const groupId = wm.group(['a', 'b'])

    expect(logLines(panel.element)[0]).toContain(groupId ?? 'missing')
    panel.destroy()
  })

  it('falls back to an empty detail for an event with nothing to name', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm, { events: ['order'] })
    wm.open({ id: 'a' })

    expect(logLines(panel.element)[0]?.trim()).toBe('order')
    panel.destroy()
  })

  it('mirrors the undo and redo availability', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm)
    const undo = globalButton(panel.element, 'undo')
    const redo = globalButton(panel.element, 'redo')
    expect(undo.disabled).toBe(true)
    expect(redo.disabled).toBe(true)

    wm.open({ id: 'a' })
    expect(undo.disabled).toBe(false)

    undo.click()
    expect(wm.get('a')).toBeUndefined()
    expect(redo.disabled).toBe(false)

    redo.click()
    expect(wm.get('a')).toBeDefined()
    panel.destroy()
  })

  it('copies the serialized state through the clipboard when there is one', () => {
    const writeText = vi.fn(async (_text: string) => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm)
    wm.open({ id: 'a' })

    globalButton(panel.element, 'copy').click()
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(String(writeText.mock.calls[0]?.[0])).toContain('"id":"a"')
    expect(panel.element.querySelector('[role="status"]')?.textContent).toBe(
      devtoolsMessages.copied,
    )
    panel.destroy()
  })

  it('shows the json itself when there is no clipboard', () => {
    vi.stubGlobal('navigator', {})
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm)
    wm.open({ id: 'a' })

    globalButton(panel.element, 'copy').click()
    expect(panel.element.querySelector('[role="status"]')?.textContent).toContain('"id":"a"')
    panel.destroy()
  })

  it('renders in russian when handed the russian catalog', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm, { messages: devtoolsMessagesRu })
    wm.open({ id: 'a' })
    wm.minimize('a')

    expect(panel.element.textContent).toContain('окна')
    expect(panel.element.querySelector('.wm-dt-meta')?.textContent).toContain('свёрнуто')
    expect(actionButton(panel.element, 'close', 'a').getAttribute('aria-label')).toBe('закрыть a')
    panel.destroy()
  })

  it('keeps the same row nodes while a window moves, so focus survives', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm)
    wm.open({ id: 'a', x: 10, y: 10, width: 200, height: 150 })

    const close = actionButton(panel.element, 'close', 'a')
    close.focus()
    expect(document.activeElement).toBe(close)

    wm.move('a', 120, 90)
    expect(panel.element.querySelector('.wm-dt-meta')?.textContent).toContain('120,90')
    expect(actionButton(panel.element, 'close', 'a')).toBe(close)
    expect(document.activeElement).toBe(close)
    panel.destroy()
  })

  it('drops the row of a window that is gone', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm)
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    const rowB = panel.element.querySelector("[data-wm-devtools-row='b']")

    wm.close('b')
    expect(rowsOf(panel.element)).toEqual(['a'])
    expect(rowB?.isConnected).toBe(false)
    panel.destroy()
  })

  it('shows only the id for a window that has no title', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm)
    wm.open({ id: 'a', title: '' })

    expect(panel.element.querySelector('.wm-dt-id')?.textContent).toBe('a')
    panel.destroy()
  })

  it('mounts into a container of its own when given one', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm, { container: host })

    expect(host.contains(panel.element)).toBe(true)
    expect(panel.element.getAttribute('role')).toBe('complementary')
    panel.destroy()
  })

  it('shares one stylesheet between panels and removes it with the last one', () => {
    const wm = createWindowManager(VIEWPORT)
    const first = createDevtools(wm)
    const second = createDevtools(wm)
    expect(document.head.querySelectorAll('#wm-devtools-style')).toHaveLength(1)

    first.destroy()
    expect(document.head.querySelectorAll('#wm-devtools-style')).toHaveLength(1)

    second.destroy()
    expect(document.head.querySelectorAll('#wm-devtools-style')).toHaveLength(0)
  })

  it('leaves nothing behind on destroy', () => {
    const wm = createWindowManager(VIEWPORT)
    const panel = createDevtools(wm)
    wm.open({ id: 'a' })
    const before = logLines(panel.element).length

    panel.destroy()
    expect(panel.element.isConnected).toBe(false)

    wm.open({ id: 'b' })
    expect(logLines(panel.element)).toHaveLength(before)
  })
})
