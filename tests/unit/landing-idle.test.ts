import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FPS_WAKE_EVENTS, type FpsHost, startFpsMeter } from '../../site/src/fps'

const root = new URL('../../', import.meta.url).pathname

function fakeHost() {
  let now = 0
  let frames: Array<(time: number) => void> = []
  const listeners = new Map<string, () => void>()
  let wakeOnChange: (() => void) | null = null
  const host: FpsHost = {
    requestAnimationFrame(callback) {
      frames.push(callback)
      return frames.length
    },
    performance: { now: () => now },
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
  }
  return {
    host,
    listeners,
    subscribe(listener: () => void) {
      wakeOnChange = listener
    },
    change() {
      wakeOnChange?.()
    },
    pending: () => frames.length,
    run(ms: number) {
      const end = now + ms
      while (now < end && frames.length > 0) {
        now += 1000 / 60
        const due = frames
        frames = []
        for (const frame of due) frame(now)
      }
      now = Math.max(now, end)
    },
  }
}

describe('the frame meter on the landing', () => {
  it('measures while something happens, then lets the page idle', () => {
    const page = fakeHost()
    const readout = { textContent: '' as string | null }
    startFpsMeter(readout, page.host, (listener) => page.subscribe(listener))

    page.run(1500)
    expect(readout.textContent).toBe('60')
    expect(page.pending()).toBe(1)
    page.run(5000)
    expect(page.pending()).toBe(0)
  })

  it('wakes up for input and for every change of the desktop', () => {
    const page = fakeHost()
    startFpsMeter({ textContent: '' }, page.host, (listener) => page.subscribe(listener))
    page.run(5000)
    expect(page.pending()).toBe(0)

    expect([...page.listeners.keys()].sort()).toEqual([...FPS_WAKE_EVENTS].sort())
    page.listeners.get('pointermove')?.()
    expect(page.pending()).toBe(1)
    page.run(5000)
    expect(page.pending()).toBe(0)

    page.change()
    expect(page.pending()).toBe(1)
    page.change()
    expect(page.pending()).toBe(1)
  })
})

describe('the drifting beam behind the landing', () => {
  const css = readFileSync(`${root}site/src/os.css`, 'utf8')

  it('animates only what the compositor can move on its own', () => {
    const keyframes = /@keyframes beam-drift \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
    const animated = [...keyframes.matchAll(/^\s+([a-z-]+):/gm)].map((match) => match[1])
    expect(animated.length).toBeGreaterThan(0)
    for (const property of animated) expect(['transform', 'opacity']).toContain(property)
  })

  it('stands still for anyone who asks for reduced motion', () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css)?.[1]
    expect(reduced).toMatch(/\.bg-beam \{\s*animation: none;/)
  })
})
