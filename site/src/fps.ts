export interface FpsHost {
  requestAnimationFrame(callback: (now: number) => void): number
  performance: { now(): number }
  addEventListener(type: string, listener: () => void, options: AddEventListenerOptions): void
}

export const FPS_WAKE_EVENTS = [
  'pointermove',
  'pointerdown',
  'keydown',
  'wheel',
  'scroll',
  'resize',
]

export function startFpsMeter(
  output: { textContent: string | null },
  host: FpsHost,
  subscribe: (listener: () => void) => unknown,
  awakeMs = 2000,
): void {
  let frames = 0
  let mark = 0
  let awakeUntil = 0
  let running = false
  const tick = (now: number) => {
    frames += 1
    if (now - mark >= 1000) {
      output.textContent = String(Math.min(120, Math.round((frames * 1000) / (now - mark))))
      frames = 0
      mark = now
    }
    if (now < awakeUntil) host.requestAnimationFrame(tick)
    else running = false
  }
  const wake = () => {
    awakeUntil = host.performance.now() + awakeMs
    if (running) return
    running = true
    frames = 0
    mark = host.performance.now()
    host.requestAnimationFrame(tick)
  }
  for (const type of FPS_WAKE_EVENTS) {
    host.addEventListener(type, wake, { capture: true, passive: true })
  }
  subscribe(wake)
  wake()
}
