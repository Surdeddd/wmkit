// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController } from '../../src/dom/shared'
import {
  drag,
  type Frames,
  pointer,
  press,
  resize,
  stubFrames,
  stubPointerCapture,
} from '../../src/testing'

let frames: Frames | undefined
let release: (() => void) | undefined
let desktop: DesktopController | undefined

function mount(): { wm: WindowManager; root: HTMLElement; handle: HTMLElement } {
  frames = stubFrames()
  release = stubPointerCapture()
  const host = document.createElement('div')
  document.body.append(host)
  const wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  desktop = attachDesktop(wm, host, {
    autoViewport: false,
    announce: false,
    magnetism: false,
    snap: false,
  })
  wm.open({ id: 'a', x: 100, y: 100, width: 300, height: 200 })
  const root = document.createElement('section')
  root.innerHTML = '<header data-wm-drag><span data-wm-title>t</span></header>'
  host.append(root)
  desktop.attachWindow('a', root)
  return { wm, root, handle: root.querySelector('[data-wm-drag]') as HTMLElement }
}

afterEach(() => {
  desktop?.destroy()
  desktop = undefined
  frames?.restore()
  frames = undefined
  release?.()
  release = undefined
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('frames a test turns by hand', () => {
  it('hold every callback until they are flushed, one pass at a time', () => {
    const real = window.requestAnimationFrame
    const made = stubFrames()
    const order: string[] = []
    requestAnimationFrame(() => {
      order.push('first')
      requestAnimationFrame(() => order.push('nested'))
    })
    const dropped = requestAnimationFrame(() => order.push('dropped'))
    cancelAnimationFrame(dropped)
    expect(made.waiting()).toBe(1)
    expect(order).toEqual([])
    made.flush()
    expect(order).toEqual(['first'])
    expect(made.waiting()).toBe(1)
    made.flush(5)
    expect(order).toEqual(['first', 'nested'])
    expect(made.waiting()).toBe(0)
    made.flush()
    requestAnimationFrame(() => order.push('left behind'))
    made.restore()
    expect(made.waiting()).toBe(0)
    expect(window.requestAnimationFrame).toBe(real)
  })

  it('hand each callback a time, and work on the window they are given', () => {
    const view = {
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
    } as unknown as Window & typeof globalThis
    const made = stubFrames(view)
    const times: number[] = []
    view.requestAnimationFrame((time) => times.push(time))
    made.flush()
    expect(times).toEqual([0])
    made.restore()
  })
})

describe('pointer capture a test can count on', () => {
  it('remembers which element holds a pointer and forgets it on release', () => {
    const before = Element.prototype.setPointerCapture
    const undo = stubPointerCapture()
    const [one, two] = [document.createElement('div'), document.createElement('div')]
    one.setPointerCapture(1)
    expect(one.hasPointerCapture(1)).toBe(true)
    expect(two.hasPointerCapture(1)).toBe(false)
    two.releasePointerCapture(1)
    expect(one.hasPointerCapture(1)).toBe(true)
    two.setPointerCapture(1)
    expect(one.hasPointerCapture(1)).toBe(false)
    two.releasePointerCapture(1)
    expect(two.hasPointerCapture(1)).toBe(false)
    undo()
    expect(Element.prototype.setPointerCapture).toBe(before)
  })
})

describe('a pointer event made for a test', () => {
  it('is dispatched where it is told with the place, the pointer and the keys it is given', () => {
    const target = document.createElement('div')
    document.body.append(target)
    const heard: PointerEvent[] = []
    document.addEventListener('pointermove', (event) => heard.push(event), { once: true })
    const sent = pointer(target, 'pointermove', 40, 30, {
      pointerId: 7,
      pointerType: 'touch',
      altKey: true,
    })
    expect(heard).toEqual([sent])
    expect([sent.clientX, sent.clientY, sent.pointerId, sent.pointerType]).toEqual([
      40,
      30,
      7,
      'touch',
    ])
    expect([sent.altKey, sent.shiftKey, sent.button, sent.buttons, sent.isPrimary]).toEqual([
      true,
      false,
      0,
      1,
      true,
    ])
    expect([sent.bubbles, sent.cancelable, sent.composed]).toEqual([true, true, true])
  })

  it('has a mouse, pointer 1 and a pressed button unless it says otherwise, and none after a release', () => {
    const target = document.createElement('div')
    const down = pointer(target, 'pointerdown', 1, 2)
    expect([down.pointerId, down.pointerType, down.buttons]).toEqual([1, 'mouse', 1])
    expect(pointer(target, 'pointerup', 1, 2).buttons).toBe(0)
    expect(pointer(target, 'pointercancel', 1, 2).buttons).toBe(0)
    const right = pointer(target, 'pointerdown', 1, 2, { button: 2, buttons: 2 })
    expect([right.button, right.buttons]).toEqual([2, 2])
  })

  it('is a real PointerEvent where the page has one', () => {
    class Real extends MouseEvent {
      readonly pointerId: number
      readonly pointerType: string
      constructor(type: string, init: PointerEventInit) {
        super(type, init)
        this.pointerId = init.pointerId ?? 0
        this.pointerType = init.pointerType ?? ''
      }
    }
    vi.stubGlobal('PointerEvent', Real)
    const sent = pointer(document.createElement('div'), 'pointerdown', 5, 6, { pointerType: 'pen' })
    expect(sent).toBeInstanceOf(Real)
    expect([sent.pointerId, sent.pointerType, sent.clientX]).toEqual([1, 'pen', 5])
  })
})

describe('gestures written in one line', () => {
  it('drag a window by its handle and let it go', () => {
    const { wm, root, handle } = mount()
    drag(handle, { x: 120, y: 80 }, { frames })
    expect(wm.get('a')?.bounds).toEqual({ x: 220, y: 180, width: 300, height: 200 })
    expect(root.hasAttribute('data-wm-dragging')).toBe(false)
    expect(wm.undo()).toBe(true)
    expect(wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
  })

  it('hold the window when they are told not to release, and take the keys along', () => {
    const { wm, root, handle } = mount()
    drag(handle, { x: 50, y: 0 }, { frames, release: false, steps: 1, from: { x: 400, y: 300 } })
    expect(root.hasAttribute('data-wm-dragging')).toBe(true)
    expect(wm.get('a')?.bounds.x).toBe(150)
    pointer(handle, 'pointerup', 450, 300)
    expect(root.hasAttribute('data-wm-dragging')).toBe(false)

    const moves: PointerEvent[] = []
    const listen = (event: Event) => moves.push(event as PointerEvent)
    document.addEventListener('pointermove', listen)
    drag(handle, { x: 30, y: 30 }, { frames, steps: 3, shiftKey: true, pointerId: 4 })
    document.removeEventListener('pointermove', listen)
    expect(moves).toHaveLength(3)
    expect(moves.map((event) => event.clientX)).toEqual([10, 20, 30])
    expect(moves.every((event) => event.shiftKey && event.pointerId === 4)).toBe(true)
  })

  it('take at least one step whatever number they are given', () => {
    const { wm, handle } = mount()
    drag(handle, { x: 40, y: 10 }, { frames, steps: 0 })
    expect(wm.get('a')?.bounds).toMatchObject({ x: 140, y: 110 })
  })

  it('resize a window by one of its handles', () => {
    const { wm, root } = mount()
    resize(root, 'se', { x: 60, y: 40 }, { frames })
    expect(wm.get('a')?.bounds).toEqual({ x: 100, y: 100, width: 360, height: 240 })
    resize(root, 'w', { x: -20, y: 0 }, { frames })
    expect(wm.get('a')?.bounds).toEqual({ x: 80, y: 100, width: 380, height: 240 })
    expect(() => resize(root, 'center' as never, { x: 1, y: 1 })).toThrow(
      'wmkit: this window has no resize handle for "center"',
    )
  })

  it('press a key where the focus is and say whether it was taken', () => {
    const { wm, root } = mount()
    root.focus()
    const taken = press(root, 'ArrowRight')
    expect(taken.defaultPrevented).toBe(true)
    expect(wm.get('a')?.bounds.x).toBe(116)
    const fine = press(root, 'ArrowRight', { altKey: true })
    expect(fine.altKey).toBe(true)
    expect(wm.get('a')?.bounds.x).toBe(117)
    const ignored = press(root, 'q')
    expect([ignored.defaultPrevented, ignored.key, ignored.bubbles]).toEqual([false, 'q', true])
  })
})
