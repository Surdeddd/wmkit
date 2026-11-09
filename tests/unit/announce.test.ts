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

  it('drops a pending clear when it is destroyed mid-message', () => {
    const { wm, announcer } = makeAnnouncer()
    wm.open({ id: 'a', title: 'Notes' })
    expect(announcer.element.textContent).toBe('Notes window opened')

    announcer.destroy()
    vi.runAllTimers()
    expect(announcer.element.textContent).toBe('Notes window opened')
  })

  it('says nothing when a window is placed where it already was', () => {
    const { wm, announcer } = makeAnnouncer()
    wm.open({ id: 'a', title: 'Notes', x: 10, y: 10, width: 200, height: 150 })
    wm.focus('a')
    announcer.announce('')

    wm.restoreTo('a', { x: 40, y: 40, width: 200, height: 150 })
    expect(announcer.element.textContent).toBe('')
  })

  it('changes the live text when the same message is announced twice in a row', () => {
    const { announcer } = makeAnnouncer()
    announcer.announce('Saved')
    const first = announcer.element.textContent
    announcer.announce('Saved')
    expect(announcer.element.textContent).not.toBe(first)
    expect(announcer.element.textContent?.trim()).toBe('Saved')
    announcer.announce('Saved')
    expect(announcer.element.textContent).toBe(first)
  })

  it('stays quiet for a message the app left undefined', () => {
    const silent: { opened?: (title: string) => string } = {}
    silent.opened = undefined
    const { wm, announcer } = makeAnnouncer(silent)
    expect(() => wm.open({ id: 'a', title: 'Notes' })).not.toThrow()
    expect(announcer.element.textContent).toBe('')
    wm.open({ id: 'b', title: 'Plans' })
    wm.focus('a')
    expect(announcer.element.textContent).toBe('Notes focused')
  })

  it('sums up many windows changed at once in one message', () => {
    const source = createWindowManager(VIEWPORT)
    for (let i = 0; i < 5; i += 1) source.open({ id: `w${i}`, title: `Doc ${i}` })
    const { wm, announcer } = makeAnnouncer()
    wm.hydrate(source.serialize())
    expect(announcer.element.textContent).toBe('5 windows opened')

    wm.minimizeAll()
    expect(announcer.element.textContent).toBe('5 windows minimized')
    wm.restoreAll()
    expect(announcer.element.textContent).toBe('5 windows restored')
    wm.closeAll()
    expect(announcer.element.textContent).toBe('5 windows closed')
  })

  it('takes localised summaries and keeps the single message where it has none', () => {
    const { wm, announcer } = makeAnnouncer({
      openedMany: (count: number) => `открыто окон: ${count}`,
    })
    wm.batch(() => {
      wm.open({ id: 'a', title: 'A' })
      wm.open({ id: 'b', title: 'B' })
    })
    expect(announcer.element.textContent).toBe('открыто окон: 2')
    wm.batch(() => {
      wm.maximize('a')
      wm.maximize('b')
    })
    expect(announcer.element.textContent).toBe('B maximized')
  })

  it('never mixes a default summary into messages the app translated itself', () => {
    const { wm, announcer } = makeAnnouncer({ opened: (title: string) => `${title}: открыто` })
    wm.batch(() => {
      wm.open({ id: 'a', title: 'A' })
      wm.open({ id: 'b', title: 'B' })
    })
    expect(announcer.element.textContent).toBe('B: открыто')
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
    flipFromTarget(reduced.source, reduced.target)
    expect(reduced.animate).not.toHaveBeenCalled()

    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const collapsed = setup(0)
    flipToTarget(collapsed.source, collapsed.target)
    flipFromTarget(collapsed.source, collapsed.target)
    expect(collapsed.animate).not.toHaveBeenCalled()
  })

  it('falls back to no motion where the browser has no web animations', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const { source, target } = setup()
    Object.defineProperty(source, 'animate', { value: undefined, configurable: true })
    Object.defineProperty(HTMLDivElement.prototype, 'animate', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    flipToTarget(source, target)
    flipFromTarget(source, target)
    expect(document.body.children).toHaveLength(2)
  })

  it('leaves an element that belongs to no window alone', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const { target } = setup()
    const orphan = document.implementation.createHTMLDocument('x').createElement('div')

    flipToTarget(orphan, target)
    flipFromTarget(orphan, target)
    expect(document.body.children).toHaveLength(2)
  })

  it('runs the reverse ghost with the default duration and easing', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const { source, target, animate, anim } = setup()
    flipFromTarget(source, target)

    const call = animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions]
    expect(call[1]).toMatchObject({ duration: 260, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' })

    const ghost = document.body.lastElementChild as HTMLElement
    anim.onfinish?.()
    expect(ghost.isConnected).toBe(false)
  })

  it('clears the outbound ghost when its animation is interrupted', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const { source, target, anim } = setup()
    flipToTarget(source, target)

    const ghost = document.body.lastElementChild as HTMLElement
    anim.oncancel?.()
    expect(ghost.isConnected).toBe(false)
  })
})
