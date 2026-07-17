import { clamp } from '../core/geometry'
import type { Bounds } from '../core/types'
import type { SessionContext } from './shared'

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
    const releaseRect = ctx.trackRect()
    const startPoint = ctx.toLocal(event)
    const start = win.bounds
    const minSize = win.minSize
    const maxSize = win.maxSize
    let raf = 0
    let pendingX = 0
    let pendingY = 0
    let hasPending = false
    const el = ctx.windowElement(id)
    if (el) el.dataset.wmResizing = direction

    function clampWidth(width: number): number {
      return clamp(width, minSize.width, maxSize ? maxSize.width : Number.POSITIVE_INFINITY)
    }

    function clampHeight(height: number): number {
      return clamp(height, minSize.height, maxSize ? maxSize.height : Number.POSITIVE_INFINITY)
    }

    function flush(): void {
      if (!hasPending) return
      hasPending = false
      raf = 0
      const dx = pendingX - startPoint.x
      const dy = pendingY - startPoint.y
      const next: Bounds = { ...start }
      if (direction.includes('e')) next.width = clampWidth(start.width + dx)
      if (direction.includes('s')) next.height = clampHeight(start.height + dy)
      if (direction.includes('w')) {
        next.width = clampWidth(start.width - dx)
        next.x = start.x + (start.width - next.width)
      }
      if (direction.includes('n')) {
        next.height = clampHeight(start.height - dy)
        next.y = start.y + (start.height - next.height)
      }
      wm.resize(id, next)
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
      if (raf !== 0) view.cancelAnimationFrame(raf)
      if (hasPending && !cancelled) flush()
      releaseRect()
      handleEl.removeEventListener('pointermove', onMove)
      handleEl.removeEventListener('pointerup', onUp)
      handleEl.removeEventListener('pointercancel', onCancelPointer)
      doc.removeEventListener('keydown', onKeydown, true)
      if (handleEl.hasPointerCapture(event.pointerId)) {
        handleEl.releasePointerCapture(event.pointerId)
      }
      if (el) delete el.dataset.wmResizing
      if (cancelled) wm.resize(id, start)
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
