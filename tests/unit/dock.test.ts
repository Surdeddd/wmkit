// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController } from '../../src/dom/shared'
import {
  createDock,
  type Dock,
  type DockOptions,
  type DockStack,
  dockLayout,
  dockMessagesRu,
} from '../../src/plugins/dock'

const VIEWPORT = { width: 1000, height: 600 }
const frames: Array<() => void> = []

function pointer(type: string, x: number, y: number, pointerId = 1): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  return event as PointerEvent
}

function key(name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init })
}

interface Harness {
  wm: WindowManager
  desktop: DesktopController
  dock: Dock
  element: HTMLElement
  add(id: string, init?: Parameters<WindowManager['open']>[0]): HTMLElement
  flush(): void
  sashes(): HTMLElement[]
  announced(): string
}

function setup(
  options: DockOptions = {},
  wm = createWindowManager({ viewport: VIEWPORT }),
): Harness {
  const element = document.createElement('div')
  document.body.append(element)
  const desktop = attachDesktop(wm, element, { autoViewport: false, magnetism: false })
  const dock = createDock(desktop, options)
  return {
    wm,
    desktop,
    dock,
    element,
    add(id, init = {}) {
      if (!wm.get(id))
        wm.open({ id, title: id.toUpperCase(), x: 40, y: 40, width: 300, height: 200, ...init })
      const root = document.createElement('section')
      root.innerHTML =
        '<header data-wm-drag><span data-wm-title></span></header><div data-wm-content></div>'
      element.append(root)
      desktop.attachWindow(id, root)
      return root
    },
    flush() {
      for (const frame of frames.splice(0)) frame()
    },
    sashes: () => [...element.querySelectorAll<HTMLElement>('[data-wm-sash]')],
    announced: () => element.querySelector('[data-wm-announcer]')?.textContent?.trim() ?? '',
  }
}

beforeEach(() => {
  const captured = new Set<number>()
  Element.prototype.setPointerCapture = (id: number) => void captured.add(id)
  Element.prototype.releasePointerCapture = (id: number) => void captured.delete(id)
  Element.prototype.hasPointerCapture = (id: number) => captured.has(id)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(() => callback(0))
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  frames.length = 0
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('docking', () => {
  it('fills the area with the first window, locks its flags and marks it', () => {
    const h = setup()
    const root = h.add('a', { resizable: true, minimizable: true })
    expect(h.dock.dock('a')).toBe(true)
    expect(h.wm.get('a')).toMatchObject({
      stage: 'snapped',
      bounds: { x: 0, y: 0, width: 1000, height: 600 },
      resizable: false,
      minimizable: false,
      snappable: false,
    })
    expect(root.hasAttribute('data-wm-docked')).toBe(true)
    expect(h.wm.getState().extensions.dock).toMatchObject({ workspace: 0 })
    expect(h.announced()).toBe('A docked')
    expect(h.sashes()).toHaveLength(0)
    expect(h.dock.dock('a')).toBe(false)
    expect(h.dock.dock('ghost')).toBe(false)
  })

  it('splits the layout, draws a separator and tabs windows together', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.add('c')
    h.dock.dock('a')
    h.dock.dock('b', { side: 'right' })
    expect(h.wm.get('a')?.bounds).toEqual({ x: 0, y: 0, width: 497, height: 600 })
    expect(h.wm.get('b')?.bounds).toEqual({ x: 503, y: 0, width: 497, height: 600 })
    const [sash] = h.sashes()
    expect(sash?.getAttribute('role')).toBe('separator')
    expect(sash?.getAttribute('aria-orientation')).toBe('vertical')
    expect(sash?.getAttribute('aria-valuenow')).toBe('50')
    expect(sash?.getAttribute('aria-label')).toBe('Resize panels')
    expect(sash?.style.left).toBe('497px')

    const right = dockLayout.stackOf(h.dock.layout(), 'b') as DockStack
    h.dock.dock('c', { stackId: right.id })
    const group = h.wm.get('c')?.groupId as string
    expect(group).not.toBeNull()
    expect(h.wm.get('b')?.groupId).toBe(group)
    expect(h.wm.getState().groups[group]?.activeId).toBe('c')
    expect(h.wm.get('c')?.bounds).toEqual(h.wm.get('b')?.bounds)

    h.dock.dock('c', { side: 'bottom' })
    expect(h.wm.get('b')?.groupId).toBeNull()
    expect(h.wm.get('c')?.groupId).toBeNull()
    expect(h.sashes()).toHaveLength(2)
  })

  it('undocks back to the floating geometry and the original flags', () => {
    const h = setup()
    const root = h.add('a', { minimizable: false })
    h.add('b')
    const floating = h.wm.get('a')?.bounds
    h.dock.dock('a')
    h.dock.dock('b', { stackId: (h.dock.layout().root as DockStack).id })
    expect(h.dock.undock('a')).toBe(true)
    expect(h.wm.get('a')).toMatchObject({
      stage: 'normal',
      bounds: floating,
      resizable: true,
      minimizable: false,
      snappable: true,
      groupId: null,
    })
    expect(root.hasAttribute('data-wm-docked')).toBe(false)
    expect(h.announced()).toBe('A undocked')
    expect(h.dock.undock('a')).toBe(false)
    expect(h.dock.undock('ghost')).toBe(false)
    h.dock.undock('b')
    expect(h.wm.getState().extensions).toEqual({})
  })

  it('never squeezes a panel below the minimum size of the windows in it', () => {
    const h = setup(
      { minSize: { width: 50, height: 50 } },
      createWindowManager({ viewport: { width: 400, height: 300 } }),
    )
    h.add('a')
    h.add('b')
    h.dock.setLayout({
      root: {
        kind: 'split',
        id: 'r',
        axis: 'row',
        children: [
          { kind: 'stack', id: 'l', windows: ['a'], active: 'a' },
          { kind: 'stack', id: 'c', windows: ['b'], active: 'b' },
        ],
        sizes: [0.2, 0.8],
      },
    })
    const a = h.wm.get('a')?.bounds as { x: number; width: number }
    const b = h.wm.get('b')?.bounds as { x: number; width: number }
    expect(a.width).toBe(160)
    expect(a.x + a.width).toBeLessThanOrEqual(b.x)
  })

  it('marks a window element attached after it was docked', async () => {
    const h = setup()
    h.wm.open({ id: 'late', title: 'Late' })
    h.dock.dock('late')
    const root = h.add('late')
    await Promise.resolve()
    expect(root.hasAttribute('data-wm-docked')).toBe(true)
  })

  it('restores a minimized window before docking it and refuses other workspaces', () => {
    const h = setup()
    h.add('a')
    h.add('b', { workspace: 1 })
    h.wm.minimize('a')
    h.dock.dock('a')
    expect(h.wm.get('a')?.stage).toBe('snapped')
    expect(h.dock.dock('b', { side: 'left' })).toBe(false)
  })

  it('undoes a dock in one step and redoes it', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.dock.dock('a')
    h.dock.dock('b', { side: 'right' })
    expect(h.wm.undo()).toBe(true)
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a'])
    expect(h.wm.get('b')?.stage).toBe('normal')
    expect(h.wm.get('a')?.bounds.width).toBe(1000)
    expect(h.sashes()).toHaveLength(0)
    expect(h.wm.redo()).toBe(true)
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a', 'b'])
    expect(h.sashes()).toHaveLength(1)
  })

  it('docks the focused floating window with Ctrl or Cmd, Alt, Shift and an arrow', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.wm.focus('a')
    h.element.dispatchEvent(key('ArrowLeft', { ctrlKey: true, altKey: true, shiftKey: true }))
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a'])
    h.wm.focus('b')
    h.element.dispatchEvent(key('ArrowLeft', { ctrlKey: true, altKey: true }))
    h.element.dispatchEvent(key('Enter', { metaKey: true, altKey: true, shiftKey: true }))
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a'])
    h.element.dispatchEvent(key('ArrowDown', { metaKey: true, altKey: true, shiftKey: true }))
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a', 'b'])
    const before = h.dock.layout()
    h.element.dispatchEvent(key('ArrowUp', { metaKey: true, altKey: true, shiftKey: true }))
    expect(h.dock.layout().root).toBe(before.root)
    h.wm.blur()
    h.element.dispatchEvent(key('ArrowUp', { metaKey: true, altKey: true, shiftKey: true }))
  })

  it('leaves the keyboard alone when told to', () => {
    const h = setup({ keyboard: false })
    h.add('a')
    h.element.dispatchEvent(key('ArrowLeft', { ctrlKey: true, altKey: true, shiftKey: true }))
    expect(h.dock.layout().root).toBeNull()
  })
})

describe('keeping the layout in step', () => {
  it('regroups a stack whose tab group drifted, and lets go of windows leaving together', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.add('c')
    h.add('d')
    h.dock.dock('a')
    const stack = (h.dock.layout().root as DockStack).id
    h.dock.dock('b', { stackId: stack })
    h.wm.ungroup('b')
    h.dock.dock('d', { side: 'right' })
    expect(h.wm.get('b')?.groupId).toBe(h.wm.get('a')?.groupId)
    expect(h.wm.get('a')?.groupId).not.toBeNull()
    const kept = h.wm.get('a')?.groupId
    h.dock.dock('d', { side: 'bottom' })
    expect(h.wm.get('a')?.groupId).toBe(kept)
    h.wm.group(['a', 'c'])
    h.dock.dock('d', { side: 'left' })
    expect(h.wm.get('c')?.groupId).toBeNull()
    expect(h.wm.groupMembers(h.wm.get('a')?.groupId as string)).toHaveLength(2)
    h.wm.batch(() => {
      h.wm.close('a')
      h.wm.close('d')
    })
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['b'])
  })

  it('undocks to the current bounds when no floating geometry is known', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.dock.dock('a')
    h.dock.dock('b', { side: 'right' })
    const data = h.wm.serialize()
    for (const win of data.windows) win.restoreBounds = null
    h.wm.hydrate(data)
    h.dock.undock('a')
    expect(h.wm.get('a')).toMatchObject({ stage: 'normal', bounds: { x: 0, width: 497 } })
    h.wm.hydrate(data)
    h.dock.setLayout(dockLayout.emptyLayout)
    expect(h.wm.get('a')).toMatchObject({ stage: 'normal', bounds: { x: 0, width: 497 } })
    expect(h.wm.get('b')).toMatchObject({ stage: 'normal', bounds: { x: 503, width: 497 } })
  })

  it('prunes a closed window without a history entry, and one undo brings both back', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.dock.dock('a')
    h.dock.dock('b', { side: 'right' })
    h.wm.close('b')
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a'])
    expect(h.wm.get('a')?.bounds.width).toBe(1000)
    expect(h.wm.undo()).toBe(true)
    expect(h.wm.get('b')?.stage).toBe('snapped')
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a', 'b'])
    expect(h.wm.get('a')?.bounds.width).toBe(497)
    expect(h.wm.redo()).toBe(true)
    expect(h.wm.get('b')).toBeUndefined()
  })

  it('re-tiles quietly when the viewport changes', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.dock.dock('a')
    h.dock.dock('b', { side: 'right' })
    const before = h.wm.canUndo()
    h.wm.clearHistory()
    h.wm.setViewport({ width: 800, height: 500 })
    expect(h.wm.get('a')?.bounds).toEqual({ x: 0, y: 0, width: 397, height: 500 })
    expect(h.wm.get('b')?.bounds).toEqual({ x: 403, y: 0, width: 397, height: 500 })
    expect(h.sashes()[0]?.style.left).toBe('397px')
    expect(before).toBe(true)
    expect(h.wm.canUndo()).toBe(false)
  })

  it('undocks a window that is restored, torn out or moved to another workspace', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.add('c')
    h.dock.dock('a')
    h.dock.dock('b', { side: 'right' })
    h.dock.dock('c', { side: 'bottom' })
    h.wm.restore('b')
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a', 'c'])
    expect(h.wm.get('b')).toMatchObject({ stage: 'normal', resizable: true })
    expect(h.announced()).toBe('B undocked')
    h.wm.moveToWorkspace('c', 2)
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a'])
  })

  it('keeps a maximized panel docked and brings it back on restore', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.dock.dock('a')
    h.dock.dock('b', { side: 'right' })
    h.wm.maximize('b')
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a', 'b'])
    h.wm.setViewport({ width: 900, height: 600 })
    expect(h.wm.get('b')?.stage).toBe('maximized')
    h.wm.restore('b')
    expect(h.wm.get('b')).toMatchObject({ stage: 'snapped', bounds: { x: 453, width: 447 } })
  })

  it('hides the separators on another workspace', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.dock.dock('a')
    h.dock.dock('b', { side: 'right' })
    h.wm.setWorkspace(1)
    expect(h.sashes()).toHaveLength(0)
    h.wm.setWorkspace(0)
    expect(h.sashes()).toHaveLength(1)
  })

  it('places a hydrated layout on a desktop of another size', () => {
    const donor = setup()
    donor.add('a')
    donor.add('b')
    donor.dock.dock('a')
    donor.dock.dock('b', { side: 'right' })
    const data = donor.wm.serialize()
    const h = setup({}, createWindowManager({ viewport: { width: 600, height: 400 } }))
    h.add('a')
    h.add('b')
    h.wm.hydrate(data)
    expect(h.wm.get('b')?.bounds).toEqual({ x: 303, y: 0, width: 297, height: 400 })
    expect(h.sashes()).toHaveLength(1)
  })
})

describe('setLayout', () => {
  it('applies a valid layout, undocking windows it leaves out', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.add('c', { workspace: 1 })
    h.dock.dock('a')
    h.wm.minimize('b')
    const layout = { root: { kind: 'stack', id: 's', windows: ['b'], active: 'b' } as DockStack }
    expect(h.dock.setLayout(layout)).toBe(true)
    expect(h.wm.get('a')).toMatchObject({ stage: 'normal', resizable: true })
    expect(h.wm.get('b')).toMatchObject({ stage: 'snapped', resizable: false })
    expect(h.dock.setLayout(layout)).toBe(true)
    expect(h.dock.setLayout({ root: { kind: 'stack', id: 's', windows: [], active: '' } })).toBe(
      false,
    )
    expect(
      h.dock.setLayout({ root: { kind: 'stack', id: 's', windows: ['ghost'], active: 'ghost' } }),
    ).toBe(false)
    expect(
      h.dock.setLayout({ root: { kind: 'stack', id: 's', windows: ['c'], active: 'c' } }),
    ).toBe(false)
    expect(h.dock.setLayout(dockLayout.emptyLayout)).toBe(true)
    expect(h.wm.get('b')?.stage).toBe('normal')
  })
})

describe('separators', () => {
  function twoPanels(options: DockOptions = {}) {
    const h = setup(options)
    h.add('a')
    h.add('b')
    h.dock.dock('a')
    h.dock.dock('b', { side: 'right' })
    return h
  }

  it('moves with the arrow keys, Shift for fine steps, Home and End for the limits', () => {
    const h = twoPanels()
    const sash = h.sashes()[0] as HTMLElement
    sash.dispatchEvent(key('ArrowRight'))
    expect(h.wm.get('a')?.bounds.width).toBe(513)
    expect(h.announced()).toBe('Panel resized to 51%')
    sash.dispatchEvent(key('ArrowLeft', { shiftKey: true }))
    expect(h.wm.get('a')?.bounds.width).toBe(512)
    sash.dispatchEvent(key('End'))
    expect(h.wm.get('b')?.bounds.width).toBe(160)
    sash.dispatchEvent(key('End'))
    sash.dispatchEvent(key('Home'))
    expect(h.wm.get('a')?.bounds.width).toBe(160)
    sash.dispatchEvent(key('Enter'))
    expect(h.wm.undo()).toBe(true)
    expect(h.wm.get('b')?.bounds.width).toBe(160)
  })

  it('follows a pointer drag as one history entry', () => {
    const h = twoPanels()
    const sash = h.sashes()[0] as HTMLElement
    sash.dispatchEvent(pointer('pointerdown', 500, 300))
    expect(sash.hasAttribute('data-wm-active')).toBe(true)
    sash.dispatchEvent(pointer('pointermove', 560, 300))
    sash.dispatchEvent(pointer('pointermove', 2, 300, 2))
    h.flush()
    sash.dispatchEvent(pointer('pointermove', 600, 300))
    sash.dispatchEvent(pointer('pointerup', 600, 300, 2))
    sash.dispatchEvent(pointer('pointerup', 600, 300))
    expect(h.wm.get('a')?.bounds.width).toBe(597)
    expect(sash.hasAttribute('data-wm-active')).toBe(false)
    expect(h.wm.undo()).toBe(true)
    expect(h.wm.get('a')?.bounds.width).toBe(497)
  })

  it('cancels a drag on Escape or a lost capture, and ignores other buttons', () => {
    const h = twoPanels()
    const sash = h.sashes()[0] as HTMLElement
    sash.dispatchEvent(pointer('pointerdown', 500, 300))
    sash.dispatchEvent(pointer('pointermove', 700, 300))
    h.flush()
    expect(h.wm.get('a')?.bounds.width).toBe(697)
    document.dispatchEvent(key('a'))
    document.dispatchEvent(key('Escape'))
    expect(h.wm.get('a')?.bounds.width).toBe(497)
    sash.dispatchEvent(pointer('pointerdown', 500, 300))
    sash.dispatchEvent(new Event('lostpointercapture'))
    sash.dispatchEvent(key('ArrowRight'))
    expect(h.wm.get('a')?.bounds.width).toBe(513)
    const secondary = new MouseEvent('pointerdown', { bubbles: true, button: 2 })
    sash.dispatchEvent(secondary)
    expect(sash.hasAttribute('data-wm-active')).toBe(false)
    Element.prototype.setPointerCapture = () => {
      throw new Error('inactive pointer')
    }
    sash.dispatchEvent(pointer('pointerdown', 500, 300))
    expect(sash.hasAttribute('data-wm-active')).toBe(false)
  })

  it('cancels a running drag when its separator goes away', () => {
    const h = twoPanels()
    const sash = h.sashes()[0] as HTMLElement
    sash.dispatchEvent(pointer('pointerdown', 500, 300))
    sash.dispatchEvent(pointer('pointermove', 400, 300))
    h.flush()
    sash.dispatchEvent(key('ArrowRight'))
    sash.dispatchEvent(pointer('pointermove', 450, 300))
    h.dock.undock('b')
    expect(sash.isConnected).toBe(false)
    expect(h.wm.get('a')?.bounds.width).toBe(1000)
    h.flush()
    expect(h.wm.get('a')?.bounds.width).toBe(1000)
  })

  it('resizes rows of panels with the vertical keys and pointer travel', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.dock.dock('a')
    h.dock.dock('b', { side: 'bottom' })
    const sash = h.sashes()[0] as HTMLElement
    expect(sash.getAttribute('aria-orientation')).toBe('horizontal')
    sash.dispatchEvent(key('ArrowDown'))
    expect(h.wm.get('a')?.bounds.height).toBe(313)
    sash.dispatchEvent(key('ArrowUp', { shiftKey: true }))
    expect(h.wm.get('a')?.bounds.height).toBe(312)
    sash.dispatchEvent(key('ArrowRight'))
    expect(h.wm.get('a')?.bounds.height).toBe(312)
    sash.dispatchEvent(pointer('pointerdown', 500, 300))
    sash.dispatchEvent(pointer('pointermove', 900, 200))
    sash.dispatchEvent(pointer('pointerup', 900, 200))
    sash.dispatchEvent(new Event('lostpointercapture'))
    expect(h.wm.get('a')?.bounds.height).toBe(212)
  })

  it('ends a running drag when the dock is destroyed', () => {
    const h = twoPanels()
    const sash = h.sashes()[0] as HTMLElement
    sash.dispatchEvent(pointer('pointerdown', 500, 300))
    sash.dispatchEvent(pointer('pointermove', 700, 300))
    h.flush()
    h.dock.destroy()
    expect(h.wm.get('a')?.bounds.width).toBe(497)
  })

  it('speaks Russian when given the Russian catalogue', () => {
    const h = setup({ messages: dockMessagesRu })
    h.add('a')
    h.add('b')
    h.dock.dock('a')
    expect(h.announced()).toBe('A: закреплено')
    h.dock.dock('b', { side: 'right' })
    h.sashes()[0]?.dispatchEvent(key('ArrowRight'))
    expect(h.announced()).toBe('Размер панели: 51%')
    h.dock.undock('b')
    expect(h.announced()).toBe('B: откреплено')
  })

  it('takes its size, area and labels from the options, and grows on coarse pointers', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const h = twoPanels({
      area: (viewport) => ({ x: 0, y: 40, width: viewport.width, height: viewport.height - 40 }),
      minSize: { width: 300, height: 100 },
      messages: { separator: dockMessagesRu.separator },
    })
    expect(h.wm.get('a')?.bounds).toEqual({ x: 0, y: 40, width: 494, height: 560 })
    expect(h.sashes()[0]?.style.width).toBe('12px')
    expect(h.sashes()[0]?.getAttribute('aria-label')).toBe('Изменить размер панелей')
    h.sashes()[0]?.dispatchEvent(key('End'))
    expect(h.wm.get('b')?.bounds.width).toBe(300)
  })
})

describe('dropping a window onto the layout', () => {
  function drag(h: Harness, id: string, from: [number, number], to: [number, number]) {
    const handle = h.element.querySelector(`[data-wm-window="${id}"] [data-wm-drag]`) as HTMLElement
    handle.dispatchEvent(pointer('pointerdown', from[0], from[1]))
    handle.dispatchEvent(pointer('pointermove', to[0], to[1]))
    h.flush()
    return handle
  }

  it('docks at an edge of an empty layout, and previews the place it will take', () => {
    const h = setup()
    h.add('a')
    const handle = drag(h, 'a', [100, 50], [4, 300])
    const preview = h.element.querySelector<HTMLElement>('[data-wm-snap-preview]')
    expect(preview?.hasAttribute('data-wm-drop')).toBe(true)
    expect(preview?.style.width).toBe('1000px')
    handle.dispatchEvent(pointer('pointerup', 4, 300))
    expect(h.wm.get('a')?.stage).toBe('snapped')
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a'])
  })

  it('splits a panel near its edges, tabs in at its centre and ignores the middle of nothing', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.add('c')
    h.dock.setLayout({ root: { kind: 'stack', id: 's', windows: ['a'], active: 'a' } })
    drag(h, 'b', [100, 50], [900, 300]).dispatchEvent(pointer('pointerup', 900, 300))
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a', 'b'])
    expect(h.wm.get('b')?.bounds.x).toBe(503)
    drag(h, 'c', [100, 50], [250, 300]).dispatchEvent(pointer('pointerup', 250, 300))
    expect(h.wm.get('c')?.groupId).toBe(h.wm.get('a')?.groupId)
    expect(h.wm.get('c')?.groupId).not.toBeNull()
  })

  it('tears a panel out on the first drag frame and puts it back when the drag is cancelled', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.dock.dock('a')
    h.dock.dock('b', { side: 'right' })
    const handle = drag(h, 'b', [700, 10], [600, 300])
    expect(h.wm.get('b')).toMatchObject({ stage: 'normal', resizable: true })
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a'])
    expect(h.wm.get('a')?.bounds.width).toBe(1000)
    document.dispatchEvent(key('Escape'))
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a', 'b'])
    expect(h.wm.get('b')).toMatchObject({ stage: 'snapped', resizable: false, bounds: { x: 503 } })
    expect(h.wm.get('a')?.bounds.width).toBe(497)
    expect(h.wm.canUndo()).toBe(true)
    handle.dispatchEvent(pointer('pointerup', 600, 300))
  })

  it('lets floating-layer windows and other workspaces drift over the layout', () => {
    const h = setup()
    h.add('a')
    h.add('f', { layer: 'floating' })
    h.dock.dock('a')
    drag(h, 'f', [100, 50], [4, 300]).dispatchEvent(pointer('pointerup', 4, 300))
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a'])
    h.wm.setWorkspace(1)
    h.add('w', { workspace: 1 })
    drag(h, 'w', [100, 50], [4, 300]).dispatchEvent(pointer('pointerup', 4, 300))
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a'])
  })

  it('docks at every edge of the area and nowhere in the middle of an empty one', () => {
    const h = setup()
    for (const id of ['a', 'b', 'c', 'd', 'e']) h.add(id)
    drag(h, 'a', [100, 50], [500, 300]).dispatchEvent(pointer('pointerup', 500, 300))
    expect(h.dock.layout().root).toBeNull()
    drag(h, 'a', [500, 300], [999, 300]).dispatchEvent(pointer('pointerup', 999, 300))
    drag(h, 'b', [100, 50], [500, 1]).dispatchEvent(pointer('pointerup', 500, 1))
    drag(h, 'c', [100, 50], [500, 599]).dispatchEvent(pointer('pointerup', 500, 599))
    drag(h, 'd', [100, 50], [999, 300]).dispatchEvent(pointer('pointerup', 999, 300))
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['b', 'a', 'c', 'd'])
  })

  it('keeps a window floating while Shift is held during the drag', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.dock.dock('a')
    const handle = h.element.querySelector('[data-wm-window="b"] [data-wm-drag]') as HTMLElement
    handle.dispatchEvent(pointer('pointerdown', 100, 50))
    const shifted = pointer('pointermove', 500, 300)
    Object.defineProperty(shifted, 'shiftKey', { value: true })
    handle.dispatchEvent(shifted)
    h.flush()
    const preview = h.element.querySelector('[data-wm-snap-preview]')
    expect(preview?.hasAttribute('data-wm-drop') ?? false).toBe(false)
    handle.dispatchEvent(pointer('pointerup', 500, 300))
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a'])
    drag(h, 'b', [500, 300], [500, 310]).dispatchEvent(pointer('pointerup', 500, 310))
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a', 'b'])
  })

  it('docks nothing outside the area or onto a separator', () => {
    const h = setup({ area: () => ({ x: 0, y: 0, width: 1000, height: 500 }), edgeDrop: 0 })
    h.add('a')
    h.add('b')
    h.add('c')
    h.dock.dock('a')
    h.dock.dock('b', { side: 'right' })
    drag(h, 'c', [100, 50], [500, 550]).dispatchEvent(pointer('pointerup', 500, 550))
    expect(h.wm.get('c')?.stage).toBe('normal')
    drag(h, 'c', [500, 550], [500, 300]).dispatchEvent(pointer('pointerup', 500, 300))
    expect(h.wm.get('c')?.stage).toBe('normal')
  })

  it('stops docking and drawing once destroyed', () => {
    const h = setup()
    h.add('a')
    h.add('b')
    h.dock.dock('a')
    h.dock.dock('b', { side: 'right' })
    h.dock.destroy()
    expect(h.sashes()).toHaveLength(0)
    expect(h.element.querySelector('[data-wm-docked]')).toBeNull()
    expect(h.element.querySelector('style[data-wm-dock]')).toBeNull()
    h.wm.close('b')
    expect(dockLayout.windowsOf(h.dock.layout())).toEqual(['a', 'b'])
  })
})
