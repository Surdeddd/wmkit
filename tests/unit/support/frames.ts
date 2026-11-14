import { vi } from 'vitest'

export interface Frames {
  flush(passes?: number): void
  waiting(): number
}

export function stubFrames(): Frames {
  const queue = new Map<number, FrameRequestCallback>()
  let last = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    last += 1
    queue.set(last, callback)
    return last
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue.delete(id)
  })
  return {
    flush(passes = 1) {
      for (let pass = 0; pass < passes && queue.size > 0; pass += 1) {
        const due = [...queue]
        queue.clear()
        for (const [, callback] of due) callback(0)
      }
    },
    waiting: () => queue.size,
  }
}
