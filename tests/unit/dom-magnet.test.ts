// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { magnetize } from '../../src/core/geometry'
import { createWindowManager } from '../../src/core/manager'
import { attachDesktop } from '../../src/dom/controller'

vi.mock('../../src/core/geometry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/geometry')>()
  return { ...actual, magnetize: vi.fn(actual.magnetize) }
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('magnetism during a drag', () => {
  it('reuses its targets and probe from frame to frame and still snaps', () => {
    const frames: Array<() => void> = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(() => callback(0))
      return frames.length
    })
    Element.prototype.setPointerCapture = () => {}
    Element.prototype.hasPointerCapture = () => false
    const element = document.createElement('div')
    document.body.append(element)
    const wm = createWindowManager({ viewport: { width: 800, height: 600 } })
    const desktop = attachDesktop(wm, element, {
      autoViewport: false,
      announce: false,
      snap: false,
    })
    for (const [id, x] of [
      ['a', 100],
      ['b', 400],
    ] as const) {
      wm.open({ id, x, y: 100, width: 200, height: 150 })
      const root = document.createElement('section')
      root.innerHTML = '<header data-wm-drag></header>'
      element.append(root)
      desktop.attachWindow(id, root)
    }
    const handle = element.querySelector('[data-wm-window="a"] [data-wm-drag]') as HTMLElement
    const pointer = (type: string, x: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 110 })
      Object.defineProperty(event, 'pointerId', { value: 1 })
      handle.dispatchEvent(event)
    }
    const spy = vi.mocked(magnetize)
    spy.mockClear()
    pointer('pointerdown', 150)
    for (const x of [180, 230, 245]) {
      pointer('pointermove', x)
      for (const frame of frames.splice(0)) frame()
    }
    pointer('pointerup', 245)

    expect(spy).toHaveBeenCalledTimes(3)
    const [first, second, third] = spy.mock.calls
    expect(second?.[0]).toBe(first?.[0])
    expect(third?.[1]).toBe(first?.[1])
    expect(wm.get('a')?.bounds.x).toBe(200)
  })
})
