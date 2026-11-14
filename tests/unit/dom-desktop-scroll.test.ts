// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController } from '../../src/dom/shared'
import { trackResources } from './support/resources'

let desktop: DesktopController | null = null

function mount(overflowX: string, overflowY: string): HTMLElement {
  const element = document.createElement('div')
  element.style.overflowX = overflowX
  element.style.overflowY = overflowY
  document.body.append(element)
  const wm = createWindowManager({ viewport: { width: 800, height: 600 } })
  desktop = attachDesktop(wm, element, { autoViewport: false, announce: false })
  return element
}

function scrollTo(element: HTMLElement, left: number, top: number): void {
  element.scrollLeft = left
  element.scrollTop = top
  element.dispatchEvent(new Event('scroll'))
}

afterEach(() => {
  desktop?.destroy()
  desktop = null
  document.body.replaceChildren()
})

describe('a desktop the browser scrolled to show a focused control', () => {
  it('goes back to its origin when it hides its overflow', () => {
    const element = mount('hidden', 'hidden')
    scrollTo(element, 40, 228)
    expect([element.scrollLeft, element.scrollTop]).toEqual([0, 0])
  })

  it('keeps the offset of an axis that is allowed to scroll', () => {
    const element = mount('auto', 'hidden')
    scrollTo(element, 40, 228)
    expect([element.scrollLeft, element.scrollTop]).toEqual([40, 0])

    const other = mount('hidden', 'scroll')
    scrollTo(other, 40, 228)
    expect([other.scrollLeft, other.scrollTop]).toEqual([0, 228])
  })

  it('keeps its offset when it is meant to scroll', () => {
    const element = mount('auto', 'auto')
    scrollTo(element, 40, 228)
    expect([element.scrollLeft, element.scrollTop]).toEqual([40, 228])
  })

  it('is left alone once the controller is gone, with no listener behind', () => {
    const resources = trackResources()
    try {
      const before = resources.live().length
      const element = mount('hidden', 'hidden')
      desktop?.destroy()
      desktop = null
      expect(resources.live().length).toBe(before)
      scrollTo(element, 40, 228)
      expect([element.scrollLeft, element.scrollTop]).toEqual([40, 228])
    } finally {
      resources.restore()
    }
  })
})
