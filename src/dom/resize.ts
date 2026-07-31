import { applyAspect, clampSize } from '../core/geometry'
import type { Bounds } from '../core/types'
import type { ActiveDrag, SessionContext } from './shared'

export const RESIZE_DIRECTIONS = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as const
export type ResizeDirection = (typeof RESIZE_DIRECTIONS)[number]

const RESIZE_CURSORS: Record<ResizeDirection, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
}

export function createResizeStarter(ctx: SessionContext) {
  const { wm, doc, view } = ctx

  return function startResize(id: string, direction: ResizeDirection, event: PointerEvent): void {
    const win = wm.get(id)
    if (!win?.resizable || event.button !== 0 || ctx.currentDrag()) return
    event.preventDefault()
    event.stopPropagation()

    const handleEl = event.currentTarget as HTMLElement
    const session: ActiveDrag = { id, finish: (cancelled) => finish(cancelled) }
    ctx.claimDrag(session)
    wm.beginInteraction()
    const releaseRect = ctx.trackRect()
    const startPoint = ctx.toLocal(event)
    const start = win.bounds
    const startStage = win.stage
    const startZone = win.snapZone
    const startRestore = win.restoreBounds
    const minSize = win.minSize
    const maxSize = win.maxSize
    const aspect = win.aspectRatio
    const drive = direction === 'n' || direction === 's' ? 'height' : 'width'
    let raf = 0
    let pendingX = 0
    let pendingY = 0
    let hasPending = false
    let applied = false
    const el = ctx.windowElement(id)
    if (el) el.dataset.wmResizing = direction

    function flush(): void {
      if (!hasPending) return
      hasPending = false
      raf = 0
      const dx = pendingX - startPoint.x
      const dy = pendingY - startPoint.y
      const floor = Math.min(0, start.y)
      const top = direction.includes('n') ? Math.max(floor, start.y + dy) : start.y
      const raw = {
        width: direction.includes('e')
          ? start.width + dx
          : direction.includes('w')
            ? start.width - dx
            : start.width,
        height: direction.includes('s')
          ? start.height + dy
          : direction.includes('n')
            ? start.y + start.height - top
            : start.height,
      }
      let size =
        aspect === null
          ? clampSize(raw, minSize, maxSize)
          : applyAspect(raw, aspect, minSize, maxSize, drive)
      const available = start.y + start.height - floor
      if (direction.includes('n') && size.height > available) {
        size = applyAspect({ ...size, height: available }, aspect ?? 0, minSize, maxSize, 'height')
      }
      const next: Bounds = {
        x: direction.includes('w') ? start.x + start.width - size.width : start.x,
        y: direction.includes('n') ? start.y + start.height - size.height : start.y,
        ...size,
      }
      wm.resize(id, next)
      applied = true
    }

    function onMove(moveEvent: PointerEvent): void {
      if (moveEvent.pointerId !== event.pointerId) return
      const movePoint = ctx.toLocal(moveEvent)
      pendingX = movePoint.x
      pendingY = movePoint.y
      hasPending = true
      if (raf === 0) raf = view.requestAnimationFrame(flush)
    }

    function finish(cancelled: boolean): void {
      if (ctx.currentDrag() !== session) return
      try {
        if (raf !== 0) view.cancelAnimationFrame(raf)
        if (hasPending && !cancelled) flush()
        if (cancelled && applied) {
          if (startStage === 'snapped' && startZone) {
            wm.restoreTo(id, startRestore ?? start)
            wm.snap(id, startZone)
          } else {
            wm.resize(id, start)
          }
        }
      } finally {
        ctx.releaseDrag(session)
        releaseRect()
        handleEl.removeEventListener('pointermove', onMove)
        handleEl.removeEventListener('pointerup', onUp)
        handleEl.removeEventListener('pointercancel', onCancelPointer)
        doc.removeEventListener('keydown', onKeydown, true)
        if (handleEl.hasPointerCapture(event.pointerId)) {
          handleEl.releasePointerCapture(event.pointerId)
        }
        if (el) delete el.dataset.wmResizing
        if (cancelled) wm.abortInteraction()
        else wm.endInteraction()
      }
    }

    function onUp(upEvent: PointerEvent): void {
      if (upEvent.pointerId !== event.pointerId) return
      finish(false)
    }

    function onCancelPointer(cancelEvent: PointerEvent): void {
      if (cancelEvent.pointerId !== event.pointerId) return
      finish(true)
    }

    function onKeydown(keyEvent: KeyboardEvent): void {
      if (keyEvent.key === 'Escape') {
        keyEvent.preventDefault()
        finish(true)
      }
    }

    handleEl.setPointerCapture(event.pointerId)
    handleEl.addEventListener('pointermove', onMove)
    handleEl.addEventListener('pointerup', onUp)
    handleEl.addEventListener('pointercancel', onCancelPointer)
    doc.addEventListener('keydown', onKeydown, true)
  }
}

export function createResizeHandles(
  doc: Document,
  edge: number,
  corner: number,
): Array<{ element: HTMLElement; direction: ResizeDirection }> {
  const base = 'position:absolute;touch-action:none;user-select:none;-webkit-user-select:none;'
  const styles: Record<ResizeDirection, string> = {
    n: `top:${-edge / 2}px;left:${corner}px;right:${corner}px;height:${edge}px`,
    s: `bottom:${-edge / 2}px;left:${corner}px;right:${corner}px;height:${edge}px`,
    e: `right:${-edge / 2}px;top:${corner}px;bottom:${corner}px;width:${edge}px`,
    w: `left:${-edge / 2}px;top:${corner}px;bottom:${corner}px;width:${edge}px`,
    ne: `top:${-edge / 2}px;right:${-edge / 2}px;width:${corner}px;height:${corner}px`,
    nw: `top:${-edge / 2}px;left:${-edge / 2}px;width:${corner}px;height:${corner}px`,
    se: `bottom:${-edge / 2}px;right:${-edge / 2}px;width:${corner}px;height:${corner}px`,
    sw: `bottom:${-edge / 2}px;left:${-edge / 2}px;width:${corner}px;height:${corner}px`,
  }
  return RESIZE_DIRECTIONS.map((direction) => {
    const element = doc.createElement('div')
    element.dataset.wmResize = direction
    element.setAttribute('aria-hidden', 'true')
    element.style.cssText = `${base}${styles[direction]};cursor:${RESIZE_CURSORS[direction]}`
    return { element, direction }
  })
}
