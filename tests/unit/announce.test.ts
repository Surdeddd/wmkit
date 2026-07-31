// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import { flipFromTarget, flipToTarget, prefersReducedMotion } from '../../src/dom/animate'
import { createAnnouncer, defaultMessages } from '../../src/dom/announcer'

const VIEWPORT = { viewport: { width: 800, height: 600 } }

function makeAnnouncer(messages = {}) {
  const wm = createWindowManager(VIEWPORT)
  const container = document.createElement('div')
  document.body.append(container)
  const announcer = createAnnouncer(wm, container, messages)
  return { wm, container, announcer }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('announcer', () => {
  it('mounts a polite live region inside the desktop', () => {
    const { announcer, container } = makeAnnouncer()
    expect(announcer.element.getAttribute('role')).toBe('status')
    expect(announcer.element.getAttribute('aria-live')).toBe('polite')
    expect(container.contains(announcer.element)).toBe(true)
  })

  it('narrates the window lifecycle', () => {
    const { wm, announcer } = makeAnnouncer()
    wm.open({ id: 'a', title: 'Notes' })
    expect(announcer.element.textContent).toBe('Notes window opened')

    wm.minimize('a')
    expect(announcer.element.textContent).toBe('Notes minimized')
    wm.restore('a')
    expect(announcer.element.textContent).toBe('Notes restored')
    wm.maximize('a')
    expect(announcer.element.textContent).toBe('Notes maximized')
    wm.snap('a', 'top-left')
    expect(announcer.element.textContent).toBe('Notes snapped to top left')
    wm.close('a')
    expect(announcer.element.textContent).toBe('Notes window closed')
  })

  it('clears the region so the same message can repeat', () => {
    const { wm, announcer } = makeAnnouncer()
    wm.open({ id: 'a', title: 'Notes' })
    vi.advanceTimersByTime(2000)
    expect(announcer.element.textContent).toBe('')
  })

  it('announces focus changes but never over the open message', () => {
    const { wm, announcer } = makeAnnouncer()
    wm.open({ id: 'a', title: 'First' })
    wm.open({ id: 'b', title: 'Second' })
    expect(announcer.element.textContent).toBe('Second window opened')

    wm.focus('a')
    expect(announcer.element.textContent).toBe('First focused')
  })

  it('lets a stage message win over the focus message in the same commit', () => {
    const { wm, announcer } = makeAnnouncer()
    wm.open({ id: 'a', title: 'First' })
    wm.open({ id: 'b', title: 'Second' })
    wm.focus('a')
    wm.maximize('b')
    expect(announcer.element.textContent).toBe('Second maximized')
  })

  it('announces workspace switches', () => {
    const { wm, announcer } = makeAnnouncer()
    wm.open({ id: 'a', title: 'Notes' })
    wm.setWorkspace(2)
    expect(announcer.element.textContent).toBe('workspace 3')
  })

  it('accepts localised messages', () => {
    const { wm, announcer } = makeAnnouncer({ opened: (title: string) => `${title} открыто` })
    wm.open({ id: 'a', title: 'Заметки' })
    expect(announcer.element.textContent).toBe('Заметки открыто')
    expect(defaultMessages.opened('Notes')).toBe('Notes window opened')
  })

  it('stops listening and removes itself on destroy', () => {
    const { wm, announcer } = makeAnnouncer()
    announcer.destroy()
    expect(announcer.element.isConnected).toBe(false)
    wm.open({ id: 'a', title: 'Notes' })
    expect(announcer.element.textContent).toBe('')
  })
})

describe('flip animations', () => {
  function stubRects(source: HTMLElement, target: HTMLElement, width = 200): void {
    source.getBoundingClientRect = () => ({ left: 10, top: 20, width, height: 100 }) as DOMRect
    target.getBoundingClientRect = () => ({ left: 300, top: 400, width: 40, height: 20 }) as DOMRect
  }

  function setup(width = 200) {
    const source = document.createElement('div')
    const target = document.createElement('div')
    document.body.append(source, target)
    stubRects(source, target, width)
    const anim = { onfinish: null as (() => void) | null, oncancel: null as (() => void) | null }
    const animate = vi.fn(() => anim as unknown as Animation)
    Object.defineProperty(source, 'animate', { value: animate, configurable: true })
    Object.defineProperty(HTMLDivElement.prototype, 'animate', {
      value: animate,
      configurable: true,
      writable: true,
    })
    return { source, target, animate, anim }
  }

  it('reports the reduced motion preference', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(prefersReducedMotion(window)).toBe(true)
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(prefersReducedMotion(window)).toBe(false)
  })

  it('runs a ghost from the window to the target and removes it when finished', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const { source, target, animate, anim } = setup()
    flipToTarget(source, target)

    expect(animate).toHaveBeenCalledTimes(1)
    const ghost = document.body.lastElementChild as HTMLElement
    expect(ghost.style.position).toBe('fixed')
    const call = animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions]
    expect(call[1].duration).toBe(260)
    expect(call[0][0]?.transform).toBe('translate(0, 0) scale(1, 1)')
    expect(call[0][1]?.transform).toBe('translate(210px, 340px) scale(0.2, 0.2)')

    expect(ghost.isConnected).toBe(true)
    anim.onfinish?.()
    expect(ghost.isConnected).toBe(false)
  })

  it('runs the reverse ghost from the target back to the window', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const { source, target, animate, anim } = setup()
    flipFromTarget(source, target, { duration: 120, easing: 'linear' })

    const call = animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions]
    expect(call[1]).toMatchObject({ duration: 120, easing: 'linear' })
    expect(call[0][0]?.transform).toBe('translate(210px, 340px) scale(0.2, 0.2)')
    expect(call[0][1]?.transform).toBe('translate(0, 0) scale(1, 1)')

    const ghost = document.body.lastElementChild as HTMLElement
    anim.oncancel?.()
    expect(ghost.isConnected).toBe(false)
  })

  it('skips the ghost under reduced motion or a collapsed rect', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const reduced = setup()
    flipToTarget(reduced.source, reduced.target)
    expect(reduced.animate).not.toHaveBeenCalled()

    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const collapsed = setup(0)
    flipToTarget(collapsed.source, collapsed.target)
    expect(collapsed.animate).not.toHaveBeenCalled()
  })
})
