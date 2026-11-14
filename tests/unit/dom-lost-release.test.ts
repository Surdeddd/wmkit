// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController } from '../../src/dom/shared'
import { type Frames, stubFrames } from './support/frames'
import { trackResources } from './support/resources'

interface Sent {
  pointer?: number
  kind?: string
  buttons?: number
}

function pointerEvent(type: string, x: number, y: number, sent: Sent = {}): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: sent.buttons ?? 0,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'pointerId', { value: sent.pointer ?? 1 })
  Object.defineProperty(event, 'pointerType', { value: sent.kind ?? 'mouse' })
  return event as PointerEvent
}

let wm: WindowManager
let desktop: DesktopController
let element: HTMLElement
let frames: Frames

function add(id: string, x: number): { root: HTMLElement; handle: HTMLElement } {
  wm.open({ id, x, y: 100, width: 240, height: 180 })
  const root = document.createElement('section')
  root.innerHTML = '<header data-wm-drag><span data-wm-title>t</span></header>'
  element.append(root)
  desktop.attachWindow(id, root)
  return { root, handle: root.querySelector('[data-wm-drag]') as HTMLElement }
}

beforeEach(() => {
  frames = stubFrames()
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.hasPointerCapture = () => false
  element = document.createElement('div')
  document.body.append(element)
  wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  desktop = attachDesktop(wm, element, {
    autoViewport: false,
    announce: false,
    magnetism: false,
    snap: false,
  })
})

afterEach(() => {
  desktop.destroy()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

for (const gesture of ['drag', 'resize'] as const) {
  describe(`a ${gesture} whose release the page never saw`, () => {
    function begin(): { root: HTMLElement; grip: HTMLElement; mark: string } {
      const a = add('a', 100)
      wm.clearHistory()
      const grip =
        gesture === 'drag'
          ? a.handle
          : (a.root.querySelector('[data-wm-resize="se"]') as HTMLElement)
      grip.dispatchEvent(pointerEvent('pointerdown', 340, 280, { buttons: 1 }))
      grip.dispatchEvent(pointerEvent('pointermove', 400, 330, { buttons: 1 }))
      frames.flush(2)
      return { root: a.root, grip, mark: gesture === 'drag' ? 'wmDragging' : 'wmResizing' }
    }

    it('ends, keeping what it did, when the same pointer presses again', () => {
      const { root, mark } = begin()
      const b = add('b', 600)
      expect(root.dataset[mark]).toBeDefined()
      const moved = wm.get('a')?.bounds
      wm.focus('a')

      b.handle.dispatchEvent(pointerEvent('pointerdown', 700, 110, { buttons: 1 }))
      expect(root.dataset[mark], 'the stale gesture went on').toBeUndefined()
      expect(wm.get('a')?.bounds).toEqual(moved)
      b.handle.dispatchEvent(pointerEvent('pointermove', 760, 170, { buttons: 1 }))
      frames.flush(2)
      expect(b.root.dataset.wmDragging, 'the new press started nothing').toBeDefined()
      b.handle.dispatchEvent(pointerEvent('pointerup', 760, 170))
      expect(wm.get('b')?.bounds).toMatchObject({ x: 660, y: 160 })

      let steps = 0
      while (wm.undo()) steps += 1
      expect(steps, 'each gesture is its own undo step').toBeGreaterThanOrEqual(2)
    })

    it('ends when the mouse that pressed moves with no button held, and only then', () => {
      const { root, mark } = begin()
      document.body.dispatchEvent(pointerEvent('pointermove', 30, 30, { kind: 'touch' }))
      document.body.dispatchEvent(pointerEvent('pointermove', 30, 30, { kind: 'pen' }))
      document.body.dispatchEvent(pointerEvent('pointermove', 30, 30, { pointer: 2 }))
      document.body.dispatchEvent(pointerEvent('pointermove', 30, 30, { buttons: 1 }))
      expect(root.dataset[mark], 'a move that proves nothing ended the gesture').toBeDefined()

      frames.flush(2)
      const kept = wm.get('a')?.bounds
      document.body.dispatchEvent(pointerEvent('pointermove', 30, 30))
      expect(root.dataset[mark]).toBeUndefined()
      expect(wm.get('a')?.bounds).toEqual(kept)
      expect(wm.canUndo()).toBe(true)
    })

    it('goes on through moves without buttons when the press itself reported none', () => {
      const a = add('a', 100)
      const grip =
        gesture === 'drag'
          ? a.handle
          : (a.root.querySelector('[data-wm-resize="se"]') as HTMLElement)
      grip.dispatchEvent(pointerEvent('pointerdown', 340, 280))
      grip.dispatchEvent(pointerEvent('pointermove', 400, 330))
      frames.flush(2)
      grip.dispatchEvent(pointerEvent('pointermove', 420, 350))
      frames.flush(2)
      expect(a.root.dataset[gesture === 'drag' ? 'wmDragging' : 'wmResizing']).toBeDefined()
      grip.dispatchEvent(pointerEvent('pointerup', 420, 350))
      const bounds = wm.get('a')?.bounds
      expect(gesture === 'drag' ? bounds?.x : bounds?.width).toBe(gesture === 'drag' ? 180 : 320)
    })

    it('goes on when another pointer presses', () => {
      const { root, mark } = begin()
      document.body.dispatchEvent(pointerEvent('pointerdown', 30, 30, { pointer: 2, buttons: 1 }))
      expect(root.dataset[mark]).toBeDefined()
    })

    it('leaves no listener on the document once it is over', () => {
      const resources = trackResources()
      try {
        const outer = () =>
          resources
            .leaks()
            .filter((entry) => / on (window|document)/.test(entry))
            .sort()
        const before = outer()
        const { grip } = begin()
        expect(outer().length).toBeGreaterThan(before.length)
        grip.dispatchEvent(pointerEvent('pointerup', 400, 330))
        expect(outer()).toEqual(before)
      } finally {
        resources.restore()
      }
    })
  })
}
