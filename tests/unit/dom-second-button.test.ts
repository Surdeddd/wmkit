// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController } from '../../src/dom/shared'
import { type Frames, stubFrames } from './support/frames'
import { trackResources } from './support/resources'

function pointerEvent(type: string, x: number, y: number, buttons = 0): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  return event as PointerEvent
}

const menuEvent = (): MouseEvent =>
  new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, buttons: 3 })

let wm: WindowManager
let desktop: DesktopController
let element: HTMLElement
let frames: Frames
let heard: Mock<(event: Event) => void>

function mount(hook?: () => void): { root: HTMLElement; handle: HTMLElement; grip: HTMLElement } {
  element = document.createElement('div')
  document.body.append(element)
  wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  desktop = attachDesktop(wm, element, {
    autoViewport: false,
    announce: false,
    magnetism: false,
    snap: false,
    ...(hook ? { onTitlebarContextMenu: hook } : {}),
  })
  wm.open({ id: 'a', x: 100, y: 100, width: 240, height: 180 })
  const root = document.createElement('section')
  root.innerHTML = '<header data-wm-drag><span data-wm-title>t</span></header>'
  element.append(root)
  desktop.attachWindow('a', root)
  return {
    root,
    handle: root.querySelector('[data-wm-drag]') as HTMLElement,
    grip: root.querySelector('[data-wm-resize="se"]') as HTMLElement,
  }
}

beforeEach(() => {
  frames = stubFrames()
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.hasPointerCapture = () => false
  heard = vi.fn<(event: Event) => void>()
  document.body.addEventListener('contextmenu', heard)
})

afterEach(() => {
  desktop.destroy()
  document.body.removeEventListener('contextmenu', heard)
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('a context menu asked for in the middle of a gesture', () => {
  it('is swallowed by a drag that is moving, which then goes on to its release', () => {
    const hook = vi.fn()
    const { root, handle } = mount(hook)
    handle.dispatchEvent(pointerEvent('pointerdown', 150, 110, 1))
    handle.dispatchEvent(pointerEvent('pointermove', 200, 150, 1))
    frames.flush(2)

    const menu = menuEvent()
    handle.dispatchEvent(menu)
    expect(menu.defaultPrevented, 'the browser menu would open over the drag').toBe(true)
    expect(hook, 'the titlebar menu opened over the drag').not.toHaveBeenCalled()
    expect(heard, 'the page heard the menu').not.toHaveBeenCalled()
    expect(root.dataset.wmDragging).toBeDefined()

    handle.dispatchEvent(pointerEvent('pointermove', 260, 190, 1))
    frames.flush(2)
    handle.dispatchEvent(pointerEvent('pointerup', 260, 190))
    expect(root.dataset.wmDragging).toBeUndefined()
    expect(wm.get('a')?.bounds).toMatchObject({ x: 210, y: 180 })
  })

  it('still reaches the titlebar hook from a press that has not moved', () => {
    const hook = vi.fn()
    const { handle } = mount(hook)
    handle.dispatchEvent(pointerEvent('pointerdown', 150, 110, 1))
    const menu = menuEvent()
    handle.dispatchEvent(menu)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(menu.defaultPrevented).toBe(true)
    expect(heard).toHaveBeenCalledTimes(1)
    handle.dispatchEvent(pointerEvent('pointerup', 150, 110))
    expect(wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
  })

  it('is left to the browser from a press that has not moved when there is no hook', () => {
    const { handle } = mount()
    handle.dispatchEvent(pointerEvent('pointerdown', 150, 110, 1))
    const menu = menuEvent()
    handle.dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(false)
    handle.dispatchEvent(pointerEvent('pointerup', 150, 110))
  })

  it('is swallowed by a resize from the press on', () => {
    const { root, grip } = mount()
    grip.dispatchEvent(pointerEvent('pointerdown', 340, 280, 1))
    const early = menuEvent()
    grip.dispatchEvent(early)
    expect(early.defaultPrevented).toBe(true)

    grip.dispatchEvent(pointerEvent('pointermove', 400, 330, 1))
    frames.flush(2)
    const late = menuEvent()
    grip.dispatchEvent(late)
    expect(late.defaultPrevented).toBe(true)
    expect(heard).not.toHaveBeenCalled()
    expect(root.dataset.wmResizing).toBeDefined()

    grip.dispatchEvent(pointerEvent('pointerup', 400, 330))
    expect(wm.get('a')?.bounds).toMatchObject({ width: 300, height: 230 })
  })

  for (const gesture of ['drag', 'resize'] as const) {
    it(`opens as usual once the ${gesture} is over, and the gesture leaves no listener behind`, () => {
      const resources = trackResources()
      try {
        const outer = () =>
          resources
            .leaks()
            .filter((entry) => / on (window|document)/.test(entry))
            .sort()
        const { handle, grip } = mount()
        const before = outer()
        const target = gesture === 'drag' ? handle : grip
        target.dispatchEvent(pointerEvent('pointerdown', 340, 280, 1))
        target.dispatchEvent(pointerEvent('pointermove', 400, 330, 1))
        frames.flush(2)
        target.dispatchEvent(pointerEvent('pointerup', 400, 330))
        expect(outer()).toEqual(before)

        const menu = menuEvent()
        target.dispatchEvent(menu)
        expect(menu.defaultPrevented).toBe(false)
        expect(heard).toHaveBeenCalledTimes(1)
      } finally {
        resources.restore()
      }
    })
  }

  it('opens as usual after Escape cancelled the drag', () => {
    const { root, handle } = mount()
    handle.dispatchEvent(pointerEvent('pointerdown', 150, 110, 1))
    handle.dispatchEvent(pointerEvent('pointermove', 200, 150, 1))
    frames.flush(2)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(root.dataset.wmDragging).toBeUndefined()
    const menu = menuEvent()
    handle.dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(false)
  })
})

describe('the capture taken away while the button is still held', () => {
  function lost(buttons: number): PointerEvent {
    return pointerEvent('lostpointercapture', 200, 150, buttons)
  }

  for (const gesture of ['drag', 'resize'] as const) {
    it(`is taken back by the ${gesture}, which goes on to its release`, () => {
      const { root, handle, grip } = mount()
      const target = gesture === 'drag' ? handle : grip
      const mark = gesture === 'drag' ? 'wmDragging' : 'wmResizing'
      target.dispatchEvent(pointerEvent('pointerdown', 340, 280, 1))
      target.dispatchEvent(pointerEvent('pointermove', 370, 300, 1))
      frames.flush(2)
      const capture = vi.fn()
      Element.prototype.setPointerCapture = capture

      target.dispatchEvent(lost(1))
      expect(capture, 'nothing asked for the capture again').toHaveBeenCalledWith(1)
      expect(capture.mock.contexts[0]).toBe(target)
      expect(root.dataset[mark], 'the gesture was cancelled').toBeDefined()

      document.body.dispatchEvent(pointerEvent('pointermove', 400, 330, 1))
      frames.flush(2)
      document.body.dispatchEvent(pointerEvent('pointerup', 400, 330))
      expect(root.dataset[mark]).toBeUndefined()
      const bounds = wm.get('a')?.bounds
      expect(
        gesture === 'drag' ? bounds?.x : bounds?.width,
        'moves that no longer reach the handle were not followed',
      ).toBe(gesture === 'drag' ? 160 : 300)
    })

    it(`cancels the ${gesture} when no button is held any more`, () => {
      const { root, handle, grip } = mount()
      const target = gesture === 'drag' ? handle : grip
      target.dispatchEvent(pointerEvent('pointerdown', 340, 280, 1))
      target.dispatchEvent(pointerEvent('pointermove', 370, 300, 1))
      frames.flush(2)
      target.dispatchEvent(lost(0))
      expect(root.dataset.wmDragging ?? root.dataset.wmResizing).toBeUndefined()
      expect(wm.get('a')?.bounds).toEqual({ x: 100, y: 100, width: 240, height: 180 })
    })

    it(`cancels the ${gesture} when the capture cannot be taken back`, () => {
      const { root, handle, grip } = mount()
      const target = gesture === 'drag' ? handle : grip
      target.dispatchEvent(pointerEvent('pointerdown', 340, 280, 1))
      target.dispatchEvent(pointerEvent('pointermove', 370, 300, 1))
      frames.flush(2)
      Element.prototype.setPointerCapture = () => {
        throw new DOMException('gone', 'InvalidStateError')
      }
      target.dispatchEvent(lost(1))
      expect(root.dataset.wmDragging ?? root.dataset.wmResizing).toBeUndefined()
      expect(wm.get('a')?.bounds).toEqual({ x: 100, y: 100, width: 240, height: 180 })
    })
  }
})
