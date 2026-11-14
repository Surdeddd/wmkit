// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowInit, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type {
  DesktopController,
  DesktopOptions,
  GestureContext,
  WindowSkin,
} from '../../src/dom/shared'
import { type Frames, stubFrames } from './support/frames'

function pointerEvent(type: string, x: number, y: number, buttons = 0, pointerId = 1) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  return event as PointerEvent
}

let wm: WindowManager
let desktop: DesktopController
let element: HTMLElement
let frames: Frames

function mount(options: DesktopOptions = {}): void {
  element = document.createElement('div')
  document.body.append(element)
  wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  desktop = attachDesktop(wm, element, { autoViewport: false, announce: false, ...options })
}

interface Mounted {
  root: HTMLElement
  handle: HTMLElement
  content: HTMLElement
  grip(direction: string): HTMLElement
  detach(): void
}

function add(init: WindowInit & { id: string }, attach = true): Mounted {
  if (!wm.get(init.id)) wm.open(init)
  const root = document.createElement('section')
  root.innerHTML =
    '<header data-wm-drag><span data-wm-title>t</span><button data-wm-minimize type="button"></button></header><div data-wm-content></div>'
  element.append(root)
  const detach = attach ? desktop.attachWindow(init.id, root) : () => {}
  return {
    root,
    handle: root.querySelector('[data-wm-drag]') as HTMLElement,
    content: root.querySelector('[data-wm-content]') as HTMLElement,
    grip: (direction) => root.querySelector(`[data-wm-resize="${direction}"]`) as HTMLElement,
    detach,
  }
}

function drag(target: HTMLElement, from: [number, number], to: [number, number]): void {
  target.dispatchEvent(pointerEvent('pointerdown', from[0], from[1], 1))
  target.dispatchEvent(pointerEvent('pointermove', to[0], to[1], 1))
  frames.flush(2)
}

beforeEach(() => {
  frames = stubFrames()
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.hasPointerCapture = () => false
})

afterEach(() => {
  desktop.destroy()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('a coarse pointer', () => {
  it('gets wider grips and a longer magnet reach when nothing sets them', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }))
    mount({ snap: false })
    const a = add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    add({ id: 'b', x: 400, y: 100, width: 200, height: 150 })
    expect(a.grip('e').style.width).toBe('16px')
    expect(a.grip('se').style.width).toBe('24px')

    drag(a.handle, [150, 110], [240, 110])
    a.handle.dispatchEvent(pointerEvent('pointerup', 240, 110))
    expect(wm.get('a')?.bounds.x, 'a gap of 10 px is inside the 12 px reach').toBe(200)
  })
})

describe('grip sizes given by the application', () => {
  it('are used as given, and a missing one falls back to the default', () => {
    mount({ hitAreas: { edge: 20, corner: 30 } })
    const a = add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    expect(a.grip('e').style.width).toBe('20px')
    expect(a.grip('se').style.width).toBe('30px')
    desktop.destroy()

    mount({ hitAreas: { corner: 18 } })
    const b = add({ id: 'b', x: 100, y: 100, width: 200, height: 150 })
    expect(b.grip('e').style.width).toBe('8px')
    expect(b.grip('se').style.width).toBe('18px')
  })
})

describe('a snap preview that is turned off', () => {
  it('is never created, and the window still snaps', () => {
    mount({ snap: { preview: false }, magnetism: false })
    const a = add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    drag(a.handle, [150, 110], [2, 300])
    expect(element.querySelector('[data-wm-snap-preview]')).toBeNull()
    a.handle.dispatchEvent(pointerEvent('pointerup', 2, 300))
    expect(wm.get('a')?.stage).toBe('snapped')
  })
})

describe('the pointer position a gesture plugin asks for', () => {
  let ctx: GestureContext
  const plugin = (context: GestureContext) => {
    ctx = context
    return () => {}
  }

  it('is measured on the spot when nothing tracks the desktop', () => {
    mount({ gestures: [plugin] })
    element.getBoundingClientRect = () => new DOMRect(50, 40, 1200, 800)
    expect(ctx.toLocal(pointerEvent('pointermove', 150, 140))).toEqual({ x: 100, y: 100 })
  })

  it('keeps using the tracked rectangle after one tracker let go twice', () => {
    mount({ gestures: [plugin] })
    element.getBoundingClientRect = () => new DOMRect(50, 40, 1200, 800)
    const first = ctx.trackRect()
    const second = ctx.trackRect()
    first()
    first()
    element.getBoundingClientRect = () => new DOMRect(0, 0, 1200, 800)
    expect(
      ctx.toLocal(pointerEvent('pointermove', 150, 140)),
      'a second release dropped the rectangle another tracker still holds',
    ).toEqual({ x: 100, y: 100 })
    second()
    expect(ctx.toLocal(pointerEvent('pointermove', 150, 140))).toEqual({ x: 150, y: 140 })
  })
})

describe('a tab target that goes away while the drag waits over it', () => {
  it('is not marked and not grouped with', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mount({ grouping: { dwell: 200 }, snap: false, magnetism: false })
    const a = add({ id: 'a', x: 100, y: 100, width: 200, height: 150 })
    const b = add({ id: 'b', x: 400, y: 300, width: 300, height: 200 })
    b.handle.getBoundingClientRect = () => new DOMRect(400, 300, 300, 30)
    wm.focus('a')

    drag(a.handle, [150, 110], [450, 310])
    b.detach()
    vi.advanceTimersByTime(250)
    expect(element.querySelector('[data-wm-tab-target]')).toBeNull()

    a.handle.dispatchEvent(pointerEvent('pointerup', 450, 310))
    expect(wm.get('a')?.bounds).toMatchObject({ x: 400, y: 300 })
  })
})

describe('frames under a modal window', () => {
  it('keep the value the page gave them through further changes of their window', () => {
    mount()
    const a = add({ id: 'a', x: 100, y: 100, width: 300, height: 200 })
    const frame = document.createElement('iframe')
    frame.style.pointerEvents = 'auto'
    a.content.append(frame)
    add({ id: 'm', layer: 'modal', x: 300, y: 200, width: 200, height: 150 })
    expect(frame.style.pointerEvents).toBe('none')

    wm.move('a', 150, 150)
    wm.move('a', 160, 160)
    expect(frame.style.pointerEvents).toBe('none')
    wm.close('m')
    expect(frame.style.pointerEvents, 'the page value was overwritten while shielded').toBe('auto')
  })
})

describe('a second pointer over another frame', () => {
  it('does not start a second watch', () => {
    mount()
    const a = add({ id: 'a', x: 100, y: 100, width: 300, height: 200 })
    const first = document.createElement('iframe')
    const second = document.createElement('iframe')
    a.content.append(first, second)
    first.dispatchEvent(new Event('pointerover', { bubbles: true }))
    const waiting = frames.waiting()
    expect(waiting).toBeGreaterThan(0)
    second.dispatchEvent(new Event('pointerover', { bubbles: true }))
    expect(frames.waiting()).toBe(waiting)
  })
})

describe('a blocked press on a desktop that never drew the modal', () => {
  it('flashes nothing and does not throw', () => {
    mount()
    add({ id: 'a', x: 100, y: 100, width: 300, height: 200 })
    wm.open({ id: 'm', layer: 'modal' })
    expect(() => wm.focus('a')).not.toThrow()
    expect(element.querySelector('[data-wm-flash]')).toBeNull()
  })
})

describe('input that reaches a window closed earlier in the same batch', () => {
  it('does nothing', () => {
    mount()
    const a = add({ id: 'a', x: 100, y: 100, width: 300, height: 200 })
    const heard: string[] = []
    wm.on('stage', () => heard.push('stage'))
    wm.on('move', () => heard.push('move'))
    wm.batch(() => {
      wm.close('a')
      const press = () =>
        (a.root.querySelector('[data-wm-minimize]') as HTMLElement).dispatchEvent(
          new MouseEvent('click', { bubbles: true }),
        )
      expect(press).not.toThrow()
      expect(() =>
        a.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
      ).not.toThrow()
    })
    expect(heard).toEqual([])
    expect(wm.get('a')).toBeUndefined()
  })
})

describe('a click or a key whose target is not an element', () => {
  it('is read as coming from the titlebar it bubbled through', () => {
    mount()
    const a = add({ id: 'a', x: 100, y: 100, width: 300, height: 200 })
    const text = a.handle.querySelector('[data-wm-title]')?.firstChild as Text
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(wm.get('a')?.stage).toBe('maximized')
  })
})

describe('a skin rebuild that fails', () => {
  const skin: WindowSkin = ({ doc }) => {
    const root = doc.createElement('section')
    root.innerHTML = '<header data-wm-drag></header><div data-wm-content></div>'
    return { element: root, content: root.querySelector('[data-wm-content]') as HTMLElement }
  }

  it('takes the old element away too, and a later mount works', () => {
    mount()
    wm.open({ id: 'a' })
    const first = desktop.mountWindow('a', skin)
    expect(first.element.isConnected).toBe(true)

    expect(() => desktop.mountWindow('a', skin, { handle: '[[' })).toThrow()
    expect(first.element.isConnected).toBe(false)
    expect(element.querySelector('[data-wm-window]')).toBeNull()

    const again = desktop.mountWindow('a', skin)
    expect(again.element.isConnected).toBe(true)
    expect(again.element.dataset.wmWindow).toBe('a')
  })
})

describe('a window that came from storage without a place to go back to', () => {
  function stored(stage: 'maximized' | 'snapped'): Mounted {
    mount({ magnetism: false })
    wm.open({ id: 'a', x: 100, y: 100, width: 300, height: 200 })
    if (stage === 'maximized') wm.maximize('a')
    else wm.snap('a', 'left')
    const data = JSON.parse(JSON.stringify(wm.serialize()))
    data.windows[0].restoreBounds = null
    wm.hydrate(data)
    wm.clearHistory()
    expect(wm.get('a')).toMatchObject({ stage, restoreBounds: null })
    return add({ id: 'a' })
  }

  it('is dragged out of maximized at the size it has', () => {
    const a = stored('maximized')
    drag(a.handle, [600, 10], [600, 300])
    a.handle.dispatchEvent(pointerEvent('pointerup', 600, 300))
    expect(wm.get('a')).toMatchObject({ stage: 'normal', bounds: { width: 1200, height: 800 } })
  })

  it('goes back to maximized when the drag is cancelled', () => {
    const a = stored('maximized')
    drag(a.handle, [600, 10], [600, 300])
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wm.get('a')).toMatchObject({
      stage: 'maximized',
      bounds: { x: 0, y: 0, width: 1200, height: 800 },
    })
  })

  it('goes back to its snap zone when a resize is cancelled', () => {
    const a = stored('snapped')
    const before = wm.get('a')?.bounds
    drag(a.grip('e'), [600, 400], [700, 400])
    expect(wm.get('a')?.bounds.width).toBe(700)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wm.get('a')).toMatchObject({ stage: 'snapped', snapZone: 'left', bounds: before })
  })
})

describe('resizing a tab group', () => {
  it('keeps the ratio another member asks for when the window itself has none', () => {
    mount({ magnetism: false, snap: false })
    const a = add({ id: 'a', x: 100, y: 100, width: 400, height: 200 })
    add({ id: 'b', x: 100, y: 100, width: 400, height: 200, aspectRatio: 2 })
    wm.group(['a', 'b'])
    wm.activateTab('a')
    expect(wm.get('a')?.aspectRatio).toBeNull()
    drag(a.grip('e'), [500, 200], [600, 200])
    a.grip('e').dispatchEvent(pointerEvent('pointerup', 600, 200))
    const bounds = wm.get('a')?.bounds
    expect(bounds?.width).toBe(500)
    expect((bounds?.width ?? 0) / (bounds?.height ?? 1)).toBeCloseTo(2, 5)
  })
})

describe('a frame that still fires after the resize ended', () => {
  it('changes nothing where frames cannot be cancelled', () => {
    mount({ magnetism: false, snap: false })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const a = add({ id: 'a', x: 100, y: 100, width: 300, height: 200 })
    const grip = a.grip('se')
    grip.dispatchEvent(pointerEvent('pointerdown', 400, 300, 1))
    grip.dispatchEvent(pointerEvent('pointermove', 450, 340, 1))
    grip.dispatchEvent(pointerEvent('pointerup', 450, 340))
    const settled = wm.get('a')
    expect(settled?.bounds).toMatchObject({ width: 350, height: 240 })
    frames.flush(3)
    expect(wm.get('a')).toBe(settled)
  })
})

describe('a release heard again while the gesture is finishing', () => {
  for (const gesture of ['drag', 'resize'] as const) {
    it(`does not finish the ${gesture} twice`, () => {
      mount({ magnetism: false, snap: false })
      const a = add({ id: 'a', x: 100, y: 100, width: 300, height: 200 })
      wm.clearHistory()
      const target = gesture === 'drag' ? a.handle : a.grip('se')
      const from: [number, number] = gesture === 'drag' ? [150, 110] : [400, 300]
      let echo = false
      const stop = wm.subscribe(() => {
        if (!echo) return
        echo = false
        target.dispatchEvent(pointerEvent('pointerup', from[0] + 60, from[1] + 40))
      })
      target.dispatchEvent(pointerEvent('pointerdown', from[0], from[1], 1))
      target.dispatchEvent(pointerEvent('pointermove', from[0] + 30, from[1] + 20, 1))
      frames.flush(2)
      target.dispatchEvent(pointerEvent('pointermove', from[0] + 60, from[1] + 40, 1))
      echo = true
      expect(() =>
        target.dispatchEvent(pointerEvent('pointerup', from[0] + 60, from[1] + 40)),
      ).not.toThrow()
      stop()
      expect(a.root.dataset.wmDragging ?? a.root.dataset.wmResizing).toBeUndefined()
      const bounds = wm.get('a')?.bounds
      expect(gesture === 'drag' ? bounds?.x : bounds?.width).toBe(gesture === 'drag' ? 160 : 360)

      wm.move('a', 500, 500)
      expect(wm.undo()).toBe(true)
      expect(wm.get('a')?.bounds).toEqual(bounds)
      expect(wm.undo()).toBe(true)
      expect(wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100, width: 300, height: 200 })
      expect(wm.canUndo()).toBe(false)
    })
  }
})
