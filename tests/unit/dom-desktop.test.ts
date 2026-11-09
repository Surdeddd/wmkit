// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import { attachDesktop } from '../../src/dom/controller'

const VIEWPORT = { width: 800, height: 600 }

function sizeOf(element: HTMLElement, width: number, height: number): void {
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: height })
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('automatic viewport', () => {
  it('measures the desktop once where ResizeObserver is missing', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const element = document.createElement('div')
    document.body.append(element)
    sizeOf(element, 640, 480)
    const wm = createWindowManager({ viewport: VIEWPORT })
    const desktop = attachDesktop(wm, element, { announce: false })
    expect(wm.getState().viewport).toEqual({ width: 640, height: 480 })
    expect(() => desktop.destroy()).not.toThrow()
  })
})
