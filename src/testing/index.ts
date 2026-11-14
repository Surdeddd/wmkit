export interface Frames {
  flush(passes?: number): void
  waiting(): number
  restore(): void
}

export interface PointerDetails {
  button?: number
  buttons?: number
  pointerId?: number
  pointerType?: 'mouse' | 'touch' | 'pen'
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}

export interface Point {
  x: number
  y: number
}

export interface GestureOptions extends PointerDetails {
  from?: Point
  steps?: number
  frames?: Frames
  release?: boolean
}

export type ResizeEdge = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

type View = Window & typeof globalThis

const viewOf = (target: Element): View => target.ownerDocument.defaultView as View

export function stubFrames(view: View = window): Frames {
  const queue = new Map<number, FrameRequestCallback>()
  const { requestAnimationFrame: request, cancelAnimationFrame: cancel } = view
  let last = 0
  view.requestAnimationFrame = (callback) => {
    last += 1
    queue.set(last, callback)
    return last
  }
  view.cancelAnimationFrame = (id) => {
    queue.delete(id)
  }
  return {
    flush(passes = 1) {
      for (let pass = 0; pass < passes && queue.size > 0; pass += 1) {
        const due = [...queue.values()]
        queue.clear()
        for (const callback of due) callback(view.performance?.now() ?? 0)
      }
    },
    waiting: () => queue.size,
    restore() {
      view.requestAnimationFrame = request
      view.cancelAnimationFrame = cancel
      queue.clear()
    },
  }
}

export function stubPointerCapture(view: View = window): () => void {
  const proto = view.Element.prototype
  const kept = {
    setPointerCapture: proto.setPointerCapture,
    releasePointerCapture: proto.releasePointerCapture,
    hasPointerCapture: proto.hasPointerCapture,
  }
  const held = new Map<number, Element>()
  proto.setPointerCapture = function setPointerCapture(id: number) {
    held.set(id, this)
  }
  proto.releasePointerCapture = function releasePointerCapture(id: number) {
    if (held.get(id) === this) held.delete(id)
  }
  proto.hasPointerCapture = function hasPointerCapture(id: number) {
    return held.get(id) === this
  }
  return () => {
    Object.assign(proto, kept)
    held.clear()
  }
}

export function pointer(
  target: Element,
  type: string,
  x: number,
  y: number,
  details: PointerDetails = {},
): PointerEvent {
  const view = viewOf(target)
  const { pointerId = 1, pointerType = 'mouse', button = 0, ...keys } = details
  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    button,
    buttons: details.buttons ?? (type === 'pointerup' || type === 'pointercancel' ? 0 : 1),
    ...keys,
  }
  let event: MouseEvent
  if (typeof view.PointerEvent === 'function') {
    event = new view.PointerEvent(type, { ...init, pointerId, pointerType, isPrimary: true })
  } else {
    event = new view.MouseEvent(type, init)
    Object.defineProperties(event, {
      pointerId: { value: pointerId },
      pointerType: { value: pointerType },
      isPrimary: { value: true },
    })
  }
  target.dispatchEvent(event)
  return event as PointerEvent
}

export function drag(handle: Element, by: Point, options: GestureOptions = {}): void {
  const { from, steps = 4, frames, release = true, ...details } = options
  const box = handle.getBoundingClientRect()
  const start = from ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  const count = Math.max(1, Math.round(steps))
  pointer(handle, 'pointerdown', start.x, start.y, details)
  for (let step = 1; step <= count; step += 1) {
    pointer(
      handle,
      'pointermove',
      start.x + (by.x * step) / count,
      start.y + (by.y * step) / count,
      details,
    )
    frames?.flush(2)
  }
  if (release) pointer(handle, 'pointerup', start.x + by.x, start.y + by.y, details)
}

export function resize(
  windowElement: Element,
  edge: ResizeEdge,
  by: Point,
  options: GestureOptions = {},
): void {
  const handle = windowElement.querySelector(`[data-wm-resize="${edge}"]`)
  if (!handle) throw new Error(`wmkit: this window has no resize handle for "${edge}"`)
  drag(handle, by, options)
}

export function press(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new (viewOf(target).KeyboardEvent)('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}
