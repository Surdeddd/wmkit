import { applyAspect, clampSize } from '../core/geometry'
import type { Bounds, Size, WindowState } from '../core/types'
import type { ActiveGesture, DesktopGesture, GestureContext, Point } from '../dom/shared'

export interface PinchOptions {
  threshold?: number
  lockTouchAction?: boolean
}

export interface SwipeOptions {
  threshold?: number
  workspaces?: number
}

interface Finger {
  point: Point
  windowId: string | null
}

interface PinchSession extends ActiveGesture {
  startBounds: Bounds
  midX: number
  midY: number
}

function spreadOf(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function watch(
  ctx: GestureContext,
  options: { pinch: Required<PinchOptions> | null; swipe: Required<SwipeOptions> | null },
): () => void {
  const { wm, doc, view } = ctx
  const element = ctx.desktop
  const fingers = new Map<number, Finger>()
  let armed = false
  let target: string | null = null
  let startSpread = 0
  let startMid: Point = { x: 0, y: 0 }
  let session: PinchSession | null = null
  let releaseRect: (() => void) | null = null
  let raf = 0
  let pending: [Point, Point] | null = null

  function windowIdAt(event: PointerEvent): string | null {
    const host = (event.target as Element | null)?.closest<HTMLElement>('[data-wm-window]')
    return host?.dataset.wmWindow ?? null
  }

  function pair(): [Finger, Finger] | null {
    if (fingers.size !== 2) return null
    const [first, second] = [...fingers.values()] as [Finger, Finger]
    return [first, second]
  }

  function disarm(): void {
    armed = false
    target = null
    pending = null
    if (raf !== 0) {
      view.cancelAnimationFrame(raf)
      raf = 0
    }
  }

  function endPinch(cancelled: boolean): void {
    const active = session
    if (!active) return
    session = null
    if (cancelled) wm.resize(active.id, active.startBounds)
    ctx.release(active)
    releaseRect?.()
    releaseRect = null
    const host = ctx.windowElement(active.id)
    if (host) delete host.dataset.wmPinching
    if (cancelled) wm.abortInteraction()
    else wm.endInteraction()
  }

  function beginPinch(id: string, mid: Point): void {
    const win = wm.get(id)
    if (!win) return
    const claimed: PinchSession = {
      id,
      finish: (cancelled: boolean) => endPinch(cancelled),
      startBounds: win.bounds,
      midX: mid.x,
      midY: mid.y,
    }
    session = claimed
    ctx.claim(claimed)
    wm.beginInteraction()
    releaseRect = ctx.trackRect()
    const host = ctx.windowElement(id)
    if (host) host.dataset.wmPinching = ''
  }

  function applyPinch(active: PinchSession, win: WindowState, spread: number): void {
    const start = active.startBounds
    const ratio = spread / startSpread
    const raw: Size = { width: start.width * ratio, height: start.height * ratio }
    const size =
      win.aspectRatio === null
        ? clampSize(raw, win.minSize, win.maxSize)
        : applyAspect(raw, win.aspectRatio, win.minSize, win.maxSize, 'width')
    const sx = size.width / start.width
    const sy = size.height / start.height
    wm.resize(active.id, {
      x: active.midX - (active.midX - start.x) * sx,
      y: active.midY - (active.midY - start.y) * sy,
      ...size,
    })
  }

  function flush(): void {
    raf = 0
    const points = pending
    pending = null
    if (!points) return
    const [a, b] = points
    const spread = spreadOf(a, b)
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const pinch = options.pinch

    if (session) {
      const win = wm.get(session.id)
      if (win) applyPinch(session, win, spread)
      return
    }
    if (pinch !== null && target !== null && Math.abs(spread - startSpread) > pinch.threshold) {
      const win = wm.get(target)
      if (!win) return
      beginPinch(target, startMid)
      if (session) applyPinch(session, win, spread)
      return
    }
    const swipe = options.swipe
    if (swipe === null) return
    const dx = mid.x - startMid.x
    const dy = mid.y - startMid.y
    if (Math.abs(dx) < swipe.threshold || Math.abs(dx) <= 2 * Math.abs(dy)) return
    disarm()
    const next = wm.workspace() + (dx < 0 ? 1 : -1)
    if (swipe.workspaces > 0 && next > swipe.workspaces - 1) return
    wm.setWorkspace(next)
  }

  function onDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch') return
    if (fingers.size >= 2) {
      disarm()
      return
    }
    fingers.set(event.pointerId, { point: ctx.toLocal(event), windowId: windowIdAt(event) })
    const both = pair()
    if (!both) return
    if (ctx.busy()) return
    const [first, second] = both
    startSpread = spreadOf(first.point, second.point)
    if (startSpread === 0) return
    startMid = {
      x: (first.point.x + second.point.x) / 2,
      y: (first.point.y + second.point.y) / 2,
    }
    const shared = first.windowId === second.windowId ? first.windowId : null
    const state = shared === null ? undefined : wm.get(shared)
    target = state?.resizable && state.stage === 'normal' ? state.id : null
    armed = true
  }

  function onMove(event: PointerEvent): void {
    const finger = fingers.get(event.pointerId)
    if (!finger) return
    finger.point = ctx.toLocal(event)
    if (!armed) return
    const both = pair()
    if (!both) return
    pending = [both[0].point, both[1].point]
    if (raf === 0) raf = view.requestAnimationFrame(flush)
  }

  function onRelease(event: PointerEvent): void {
    if (!fingers.delete(event.pointerId)) return
    if (pending) {
      if (raf !== 0) {
        view.cancelAnimationFrame(raf)
        raf = 0
      }
      flush()
    }
    if (session) endPinch(false)
    disarm()
  }

  function onCancel(event: PointerEvent): void {
    if (!fingers.delete(event.pointerId)) return
    if (session) endPinch(true)
    disarm()
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !session) return
    event.preventDefault()
    endPinch(true)
    disarm()
  }

  const previousTouchAction = element.style.touchAction
  if (options.pinch) {
    element.style.touchAction = options.pinch.lockTouchAction ? 'none' : 'pan-x pan-y'
  }
  element.addEventListener('pointerdown', onDown)
  element.addEventListener('pointermove', onMove)
  element.addEventListener('pointerup', onRelease)
  element.addEventListener('pointercancel', onCancel)
  doc.addEventListener('keydown', onKeydown, true)

  return () => {
    if (session) endPinch(true)
    disarm()
    fingers.clear()
    element.style.touchAction = previousTouchAction
    element.removeEventListener('pointerdown', onDown)
    element.removeEventListener('pointermove', onMove)
    element.removeEventListener('pointerup', onRelease)
    element.removeEventListener('pointercancel', onCancel)
    doc.removeEventListener('keydown', onKeydown, true)
  }
}

export function pinch(options: PinchOptions = {}): DesktopGesture {
  const settings: Required<PinchOptions> = {
    threshold: options.threshold ?? 12,
    lockTouchAction: options.lockTouchAction === true,
  }
  return (ctx) => watch(ctx, { pinch: settings, swipe: null })
}

export function swipe(options: SwipeOptions = {}): DesktopGesture {
  const settings: Required<SwipeOptions> = {
    threshold: options.threshold ?? 72,
    workspaces: options.workspaces ?? 0,
  }
  return (ctx) => watch(ctx, { pinch: null, swipe: settings })
}

export function touchGestures(
  options: { pinch?: PinchOptions; swipe?: SwipeOptions } = {},
): DesktopGesture {
  const pinchSettings: Required<PinchOptions> = {
    threshold: options.pinch?.threshold ?? 12,
    lockTouchAction: options.pinch?.lockTouchAction === true,
  }
  const swipeSettings: Required<SwipeOptions> = {
    threshold: options.swipe?.threshold ?? 72,
    workspaces: options.swipe?.workspaces ?? 0,
  }
  return (ctx) => watch(ctx, { pinch: pinchSettings, swipe: swipeSettings })
}
