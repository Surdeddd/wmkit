import { clamp, detectSnapZone, magnetize, zoneBounds } from '../core/geometry'
import type { Bounds, SnapZone, WindowStage } from '../core/types'
import { type ActiveDrag, INTERACTIVE_SELECTOR, type SessionContext } from './shared'

interface DragSession extends ActiveDrag {
  pointerId: number
  grabDX: number
  grabDY: number
  grabRatio: number
  startBounds: Bounds
  startStage: WindowStage
  startZone: SnapZone | null
  startRestoreBounds: Bounds | null
  restored: boolean
  moved: boolean
  zone: SnapZone | 'maximize' | null
  raf: number
  pendingX: number
  pendingY: number
  hasPending: boolean
}

export function createDragStarter(ctx: SessionContext) {
  const { wm, doc, view } = ctx

  return function startDrag(id: string, handle: HTMLElement, event: PointerEvent): void {
    const win = wm.get(id)
    if (!win?.draggable || event.button !== 0 || ctx.currentDrag()) return
    const target = event.target as Element | null
    if (target?.closest(INTERACTIVE_SELECTOR)) return
    event.preventDefault()

    const releaseRect = ctx.trackRect()
    const point = ctx.toLocal(event)
    const startBounds = win.bounds
    const session: DragSession = {
      id,
      pointerId: event.pointerId,
      grabDX: point.x - startBounds.x,
      grabDY: point.y - startBounds.y,
      grabRatio: clamp((point.x - startBounds.x) / startBounds.width, 0.05, 0.95),
      startBounds,
      startStage: win.stage,
      startZone: win.snapZone,
      startRestoreBounds: win.restoreBounds,
      restored: win.stage === 'normal',
      moved: false,
      zone: null,
      raf: 0,
      pendingX: 0,
      pendingY: 0,
      hasPending: false,
      finish: () => {},
    }

    const el = ctx.windowElement(id)

    function flush(): void {
      if (!session.hasPending || ctx.currentDrag() !== session) return
      session.hasPending = false
      session.raf = 0
      const current = wm.get(id)
      if (!current) return

      if (!session.restored) {
        const source = current.restoreBounds ?? session.startBounds
        const width = source.width
        const height = source.height
        wm.restoreTo(id, {
          x: session.pendingX - width * session.grabRatio,
          y: session.pendingY - Math.min(session.grabDY, 24),
          width,
          height,
        })
        session.restored = true
        const restoredWin = wm.get(id)
        if (restoredWin) {
          session.grabDX = session.pendingX - restoredWin.bounds.x
          session.grabDY = session.pendingY - restoredWin.bounds.y
        }
        return
      }

      let nextX = session.pendingX - session.grabDX
      let nextY = session.pendingY - session.grabDY
      if (ctx.magnetThreshold > 0) {
        const state = wm.getState()
        const targets: Bounds[] = [
          { x: 0, y: 0, width: state.viewport.width, height: state.viewport.height },
        ]
        for (const otherId of state.order) {
          if (otherId === id) continue
          const other = state.windows[otherId]
          if (other && other.stage !== 'minimized') targets.push(other.bounds)
        }
        const magnet = magnetize(
          { x: nextX, y: nextY, width: current.bounds.width, height: current.bounds.height },
          targets,
          ctx.magnetThreshold,
        )
        nextX = magnet.x
        nextY = magnet.y
      }
      wm.move(id, nextX, nextY)

      if (ctx.snapEnabled && current.snappable) {
        const viewport = wm.getState().viewport
        const rawZone = detectSnapZone(session.pendingX, session.pendingY, viewport, ctx.snapDetect)
        let zone: DragSession['zone'] = rawZone
        if (rawZone === 'top') {
          if (ctx.topEdge === 'maximize') zone = current.maximizable ? 'maximize' : null
          else if (ctx.topEdge === 'none') zone = null
        }
        session.zone = zone
        if (zone) {
          ctx.showPreview(
            zone === 'maximize'
              ? { x: 0, y: 0, width: viewport.width, height: viewport.height }
              : zoneBounds(zone, viewport),
          )
        } else {
          ctx.hidePreview()
        }
      }
    }

    function onMove(moveEvent: PointerEvent): void {
      if (moveEvent.pointerId !== session.pointerId) return
      const movePoint = ctx.toLocal(moveEvent)
      if (!session.moved) {
        const travelled =
          Math.abs(movePoint.x - (session.startBounds.x + session.grabDX)) +
          Math.abs(movePoint.y - (session.startBounds.y + session.grabDY))
        if (travelled < 3 && session.restored) return
        session.moved = true
        if (el) {
          el.dataset.wmDragging = ''
          el.style.willChange = 'transform'
        }
      }
      session.pendingX = movePoint.x
      session.pendingY = movePoint.y
      session.hasPending = true
      if (session.raf === 0) session.raf = view.requestAnimationFrame(flush)
    }

    function onUp(upEvent: PointerEvent): void {
      if (upEvent.pointerId !== session.pointerId) return
      finish(false)
    }

    function onCancel(cancelEvent: PointerEvent): void {
      if (cancelEvent.pointerId !== session.pointerId) return
      finish(true)
    }

    function onKeydown(keyEvent: KeyboardEvent): void {
      if (keyEvent.key === 'Escape') {
        keyEvent.preventDefault()
        finish(true)
      }
    }

    function finish(cancelled: boolean): void {
      if (ctx.currentDrag() !== session) return
      if (session.raf !== 0) view.cancelAnimationFrame(session.raf)
      if (session.hasPending && !cancelled) flush()
      ctx.releaseDrag(session)
      releaseRect()
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onCancel)
      doc.removeEventListener('keydown', onKeydown, true)
      if (handle.hasPointerCapture(session.pointerId)) {
        handle.releasePointerCapture(session.pointerId)
      }
      if (el) {
        delete el.dataset.wmDragging
        el.style.willChange = ''
      }
      ctx.hidePreview()

      if (cancelled) {
        if (session.moved && session.restored) {
          if (session.startStage === 'maximized') {
            wm.restoreTo(id, session.startRestoreBounds ?? session.startBounds)
            wm.maximize(id)
          } else if (session.startStage === 'snapped' && session.startZone) {
            wm.restoreTo(id, session.startRestoreBounds ?? session.startBounds)
            wm.snap(id, session.startZone)
          } else {
            wm.move(id, session.startBounds.x, session.startBounds.y)
          }
        }
        wm.endInteraction()
        return
      }
      if (session.moved && session.zone) {
        if (session.zone === 'maximize') wm.maximize(id)
        else wm.snap(id, session.zone)
      }
      wm.endInteraction()
    }

    session.finish = finish
    wm.beginInteraction()
    ctx.claimDrag(session)
    handle.setPointerCapture(event.pointerId)
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onCancel)
    doc.addEventListener('keydown', onKeydown, true)
  }
}
