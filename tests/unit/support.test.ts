// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { breathe, fuzz, patience, seedCount } from './support/fuzz'
import { type Resources, trackResources } from './support/resources'

let resources: Resources | null = null

function track(): Resources {
  resources = trackResources()
  return resources
}

afterEach(() => {
  resources?.restore()
  resources = null
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('resource tracker', () => {
  it('reports a listener left on the document and forgets it once removed', () => {
    const tracker = track()
    const listener = () => {}
    document.addEventListener('pointermove', listener)
    expect(tracker.live()).toEqual(['listener pointermove on document'])
    document.removeEventListener('pointermove', listener)
    expect(tracker.live()).toEqual([])
  })

  it('tells capture listeners from bubbling ones and counts a repeated registration once', () => {
    const tracker = track()
    const listener = () => {}
    document.addEventListener('keydown', listener)
    document.addEventListener('keydown', listener)
    document.addEventListener('keydown', listener, true)
    expect(tracker.live()).toEqual([
      'listener keydown on document',
      'listener keydown (capture) on document',
    ])
    document.removeEventListener('keydown', listener, { capture: true })
    expect(tracker.live()).toEqual(['listener keydown on document'])
    document.removeEventListener('keydown', listener)
    expect(tracker.live()).toEqual([])
  })

  it('sees listeners registered on the window, however the window is reached', () => {
    const tracker = track()
    const first = () => {}
    const second = () => {}
    window.addEventListener('resize', first)
    document.defaultView?.addEventListener('scroll', second, true)
    expect(tracker.live()).toEqual([
      'listener resize on window',
      'listener scroll (capture) on window',
    ])
    window.removeEventListener('resize', first)
    document.defaultView?.removeEventListener('scroll', second, true)
    expect(tracker.live()).toEqual([])
  })

  it('names the element a listener was left on', () => {
    const tracker = track()
    const panel = document.createElement('section')
    panel.id = 'notes'
    document.body.append(panel)
    panel.addEventListener('click', () => {})
    document.createElement('div').addEventListener('click', { handleEvent() {} })
    expect(tracker.live()).toEqual(['listener click on <section#notes>', 'listener click on <div>'])
  })

  it('counts as a leak only what outlives the page: the window, the document and connected nodes', () => {
    const tracker = track()
    const kept = document.createElement('section')
    const gone = document.createElement('div')
    document.body.append(kept)
    kept.addEventListener('click', () => {})
    gone.addEventListener('click', () => {})
    window.addEventListener('resize', () => {})
    expect(tracker.live()).toHaveLength(3)
    expect(tracker.leaks()).toEqual(['listener click on <section>', 'listener resize on window'])
    kept.remove()
    expect(tracker.leaks()).toEqual(['listener resize on window'])
  })

  it('ignores timers that third-party code sets for itself', () => {
    const tracker = track()
    const field = document.createElement('div')
    field.tabIndex = 0
    document.body.append(field)
    field.focus()
    expect(document.activeElement).toBe(field)
    expect(tracker.live()).toEqual([])
  })

  it('leaves alone listeners that existed before tracking began', () => {
    const early = () => {}
    document.addEventListener('wheel', early)
    const tracker = track()
    expect(tracker.live()).toEqual([])
    document.removeEventListener('wheel', early)
    expect(tracker.live()).toEqual([])
  })

  it('ignores once listeners and forgets a listener its signal aborted', () => {
    const tracker = track()
    const controller = new AbortController()
    document.addEventListener('click', () => {}, { once: true })
    document.addEventListener('click', () => {}, { signal: controller.signal })
    expect(tracker.live()).toEqual(['listener click on document'])
    controller.abort()
    expect(tracker.live()).toEqual([])
  })

  it('still delivers events to the listeners it tracks', () => {
    track()
    const heard: string[] = []
    const listener = (event: Event) => heard.push(event.type)
    document.addEventListener('ping', listener)
    document.dispatchEvent(new Event('ping'))
    document.removeEventListener('ping', listener)
    document.dispatchEvent(new Event('ping'))
    expect(heard).toEqual(['ping'])
  })

  it('reports a pending timeout until it fires or is cleared', () => {
    vi.useFakeTimers()
    const tracker = track()
    const fired = vi.fn()
    setTimeout(fired, 50, 'payload')
    const cleared = setTimeout(fired, 80)
    expect(tracker.live()).toEqual(['pending timeout', 'pending timeout'])
    clearTimeout(cleared)
    expect(tracker.live()).toEqual(['pending timeout'])
    vi.advanceTimersByTime(60)
    expect(fired).toHaveBeenCalledExactlyOnceWith('payload')
    expect(tracker.live()).toEqual([])
  })

  it('keeps reporting an interval until it is cleared', () => {
    vi.useFakeTimers()
    const tracker = track()
    const tick = vi.fn()
    const id = setInterval(tick, 10)
    vi.advanceTimersByTime(35)
    expect(tick).toHaveBeenCalledTimes(3)
    expect(tracker.live()).toEqual(['pending interval'])
    clearInterval(id)
    expect(tracker.live()).toEqual([])
  })

  it('reports a requested frame until it runs or is cancelled', () => {
    const queue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => queue.push(callback))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const tracker = track()
    const draw = vi.fn()
    requestAnimationFrame(draw)
    const dropped = requestAnimationFrame(draw)
    expect(tracker.live()).toEqual(['pending frame', 'pending frame'])
    cancelAnimationFrame(dropped)
    expect(tracker.live()).toEqual(['pending frame'])
    queue[0]?.(16)
    expect(draw).toHaveBeenCalledExactlyOnceWith(16)
    expect(tracker.live()).toEqual([])
  })

  it('reports an observer until it disconnects', () => {
    const tracker = track()
    const observer = new MutationObserver(() => {})
    observer.observe(document.body, { childList: true })
    expect(tracker.live()).toEqual(['MutationObserver watching 1'])
    observer.disconnect()
    expect(tracker.live()).toEqual([])
  })

  it('follows an observer that lets go of its targets one by one', () => {
    class StubObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', StubObserver)
    const tracker = track()
    const first = document.createElement('div')
    const second = document.createElement('div')
    const observer = new ResizeObserver(() => {})
    observer.observe(first)
    observer.observe(second)
    expect(tracker.live()).toEqual(['ResizeObserver watching 2'])
    observer.unobserve(first)
    expect(tracker.live()).toEqual(['ResizeObserver watching 1'])
    observer.unobserve(second)
    expect(tracker.live()).toEqual([])
  })

  it('puts every patched function back on restore', () => {
    const before = {
      add: EventTarget.prototype.addEventListener,
      remove: EventTarget.prototype.removeEventListener,
      windowAdd: window.addEventListener,
      timeout: setTimeout,
      clear: clearTimeout,
      frame: requestAnimationFrame,
      observer: MutationObserver,
    }
    const tracker = trackResources()
    expect(EventTarget.prototype.addEventListener).not.toBe(before.add)
    expect(setTimeout).not.toBe(before.timeout)
    tracker.restore()
    expect({
      add: EventTarget.prototype.addEventListener,
      remove: EventTarget.prototype.removeEventListener,
      windowAdd: window.addEventListener,
      timeout: setTimeout,
      clear: clearTimeout,
      frame: requestAnimationFrame,
      observer: MutationObserver,
    }).toEqual(before)
  })
})

describe('fuzz budget', () => {
  it('lets the event loop turn between runs', async () => {
    const order: string[] = []
    setImmediate(() => order.push('loop'))
    await breathe()
    order.push('run')
    expect(order).toEqual(['loop', 'run'])
  })

  it('uses the base run count and a fixed seed by default', () => {
    vi.stubEnv('WMKIT_FUZZ', '')
    vi.stubEnv('WMKIT_FUZZ_SEED', '')
    expect(fuzz(40)).toEqual({ numRuns: 40, seed: 1 })
    expect(seedCount(24)).toBe(24)
  })

  it('takes the run count from WMKIT_FUZZ and the seed from WMKIT_FUZZ_SEED', () => {
    vi.stubEnv('WMKIT_FUZZ', '2000')
    vi.stubEnv('WMKIT_FUZZ_SEED', '77')
    expect(fuzz(40)).toEqual({ numRuns: 2000, seed: 77 })
    expect(seedCount(24)).toBe(2000)
  })

  it('draws a fresh seed for a long run that pins none', () => {
    vi.stubEnv('WMKIT_FUZZ', '300')
    vi.stubEnv('WMKIT_FUZZ_SEED', '')
    const budget = fuzz(40)
    expect(budget.numRuns).toBe(300)
    expect(Number.isInteger(budget.seed) && budget.seed >= 0).toBe(true)
  })

  it('gives a long run an hour and a normal run its own timeout', () => {
    vi.stubEnv('WMKIT_FUZZ', '')
    expect(patience(120_000)).toBe(120_000)
    vi.stubEnv('WMKIT_FUZZ', '3000')
    expect(patience(120_000)).toBe(3_600_000)
  })

  it('ignores a WMKIT_FUZZ that is not a positive number', () => {
    for (const value of ['0', '-5', 'many', 'NaN', 'Infinity']) {
      vi.stubEnv('WMKIT_FUZZ', value)
      expect(seedCount(24), value).toBe(24)
    }
  })
})
