import { clamp, detectSnapZone, type SnapDetectOptions, zoneBounds } from '../core/geometry'
import type { Bounds, SnapZone, WindowManager, WindowState } from '../core/types'
import { flipToTarget } from './animate'
import { type Announcer, type AnnouncerMessages, createAnnouncer } from './announcer'

const RESIZE_DIRECTIONS = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as const
type ResizeDirection = (typeof RESIZE_DIRECTIONS)[number]

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

const INTERACTIVE_SELECTOR =
  'button, input, select, textarea, a[href], [contenteditable], [data-wm-close], [data-wm-minimize], [data-wm-maximize]'

export interface DesktopSnapOptions extends SnapDetectOptions {
  preview?: boolean
  topEdge?: 'maximize' | 'top' | 'none'
}

export interface DesktopKeyboardOptions {
  moveStep?: number
  cycle?: boolean
}

export interface DesktopOptions {
  snap?: boolean | DesktopSnapOptions
  keyboard?: boolean | DesktopKeyboardOptions
  announce?: boolean | Partial<AnnouncerMessages>
  autoViewport?: boolean
  minimizeTarget?: (window: WindowState) => Element | null
}

export interface WindowAttachOptions {
  handle?: HTMLElement | string
  resizeHandles?: boolean
}

export interface DesktopController {
  element: HTMLElement
  wm: WindowManager
  attachWindow(id: string, element: HTMLElement, options?: WindowAttachOptions): () => void
  destroy(): void
}

interface AttachedWindow {
  element: HTMLElement
  handle: HTMLElement | null
  handles: HTMLElement[]
  lastState: WindowState | null
  cleanup: Array<() => void>
}

interface DragSession {
  id: string
  pointerId: number
  grabDX: number
  grabDY: number
  grabRatio: number
  startBounds: Bounds
  restored: boolean
  moved: boolean
  zone: SnapZone | 'maximize' | null
  raf: number
  pendingX: number
  pendingY: number
  hasPending: boolean
  finish(cancelled: boolean): void
}

function windowOf(element: HTMLElement): Window {
  const view = element.ownerDocument.defaultView
  if (!view) throw new Error('wmkit: desktop element is not attached to a document')
  return view
}

export function attachDesktop(
  wm: WindowManager,
  element: HTMLElement,
  options: DesktopOptions = {},
): DesktopController {
  const doc = element.ownerDocument
  const view = windowOf(element)

  const snapEnabled = options.snap !== false
  const snapOptions: DesktopSnapOptions = typeof options.snap === 'object' ? options.snap : {}
  const snapPreviewEnabled = snapOptions.preview !== false
  const topEdge = snapOptions.topEdge ?? 'maximize'
  const keyboardEnabled = options.keyboard !== false
  const keyboardOptions: DesktopKeyboardOptions =
    typeof options.keyboard === 'object' ? options.keyboard : {}
  const moveStep = keyboardOptions.moveStep ?? 16
  const cycleEnabled = keyboardOptions.cycle !== false

  element.dataset.wmDesktop = ''
  if (view.getComputedStyle(element).position === 'static') {
    element.style.position = 'relative'
  }

  const registry = new Map<string, AttachedWindow>()
  const cleanup: Array<() => void> = []
  let lastOrder: readonly string[] | null = null
  let lastFocused: string | null = null
  let drag: DragSession | null = null

  let announcer: Announcer | null = null
  if (options.announce !== false) {
    announcer = createAnnouncer(
      wm,
      element,
      typeof options.announce === 'object' ? options.announce : {},
    )
    cleanup.push(() => announcer?.destroy())
  }

  let preview: HTMLElement | null = null
  function showPreview(bounds: Bounds): void {
    if (!snapPreviewEnabled) return
    if (!preview) {
      preview = doc.createElement('div')
      preview.dataset.wmSnapPreview = ''
      preview.style.cssText =
        'position:absolute;left:0;top:0;pointer-events:none;display:none;z-index:2147483646'
      element.append(preview)
    }
    preview.style.display = 'block'
    preview.style.transform = `translate3d(${bounds.x}px, ${bounds.y}px, 0)`
    preview.style.width = `${bounds.width}px`
    preview.style.height = `${bounds.height}px`
  }

  function hidePreview(): void {
    if (preview) preview.style.display = 'none'
  }

  if (options.autoViewport !== false) {
    const applyViewport = () =>
      wm.setViewport({ width: element.clientWidth, height: element.clientHeight })
    applyViewport()
    const observer = new ResizeObserver(applyViewport)
    observer.observe(element)
    cleanup.push(() => observer.disconnect())
  }

  function syncWindow(attached: AttachedWindow, win: WindowState, zIndex: number): void {
    const el = attached.element
    const firstSync = attached.lastState === null
    if (firstSync) el.style.transition = 'none'
    if (attached.lastState !== win) {
      el.style.transform = `translate3d(${win.bounds.x}px, ${win.bounds.y}px, 0)`
      el.style.width = `${win.bounds.width}px`
      el.style.height = `${win.bounds.height}px`
      el.dataset.wmStage = win.stage
      el.dataset.wmLayer = win.layer
      el.hidden = win.stage === 'minimized'
      el.setAttribute('aria-label', win.title)
      if (win.layer === 'modal') el.setAttribute('aria-modal', 'true')
      else el.removeAttribute('aria-modal')
      for (const handle of attached.handles) {
        handle.style.display = win.resizable && win.stage === 'normal' ? '' : 'none'
      }
      attached.lastState = win
    }
    el.style.zIndex = String(zIndex + 1)
    if (firstSync) {
      void el.offsetWidth
      el.style.transition = ''
    }
  }

  function syncAll(): void {
    const state = wm.getState()
    const orderChanged = state.order !== lastOrder
    state.order.forEach((id, index) => {
      const attached = registry.get(id)
      const win = state.windows[id]
      if (!attached || !win) return
      if (orderChanged || attached.lastState !== win) syncWindow(attached, win, index)
    })
    if (state.focusedId !== lastFocused) {
      if (lastFocused) {
        const prev = registry.get(lastFocused)
        if (prev) delete prev.element.dataset.wmFocused
      }
      if (state.focusedId) {
        const next = registry.get(state.focusedId)
        if (next) next.element.dataset.wmFocused = ''
      }
      lastFocused = state.focusedId
    }
    lastOrder = state.order
  }

  cleanup.push(wm.subscribe(syncAll))

  cleanup.push(
    wm.on('focus', ({ window: win }) => {
      const attached = registry.get(win.id)
      if (!attached) return
      if (!attached.element.contains(doc.activeElement)) {
        attached.element.focus({ preventScroll: true })
      }
    }),
  )

  cleanup.push(
    wm.on('modalblocked', ({ window: win }) => {
      const attached = registry.get(win.id)
      if (!attached) return
      delete attached.element.dataset.wmFlash
      void attached.element.offsetWidth
      attached.element.dataset.wmFlash = ''
    }),
  )

  cleanup.push(
    wm.on('stage', ({ window: win, previous }) => {
      if (win.stage !== 'minimized' || previous === 'minimized') return
      const attached = registry.get(win.id)
      const target = options.minimizeTarget?.(win)
      if (attached && target) flipToTarget(attached.element, target)
    }),
  )

  if (keyboardEnabled && cycleEnabled) {
    const onDesktopKeydown = (event: KeyboardEvent) => {
      if (event.key === 'F6') {
        event.preventDefault()
        wm.cycleFocus(event.shiftKey ? -1 : 1)
      }
    }
    element.addEventListener('keydown', onDesktopKeydown)
    cleanup.push(() => element.removeEventListener('keydown', onDesktopKeydown))
  }

  function desktopPoint(event: PointerEvent): { x: number; y: number } {
    const rect = element.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function endDrag(cancelled: boolean): void {
    if (drag) drag.finish(cancelled)
  }

  function startDrag(id: string, handle: HTMLElement, event: PointerEvent): void {
    const win = wm.get(id)
    if (!win?.draggable || event.button !== 0 || drag) return
    const target = event.target as Element | null
    if (target?.closest(INTERACTIVE_SELECTOR)) return
    event.preventDefault()

    const point = desktopPoint(event)
    const startBounds = win.bounds
    const session: DragSession = {
      id,
      pointerId: event.pointerId,
      grabDX: point.x - startBounds.x,
      grabDY: point.y - startBounds.y,
      grabRatio: clamp((point.x - startBounds.x) / startBounds.width, 0.05, 0.95),
      startBounds,
      restored: win.stage === 'normal',
      moved: false,
      zone: null,
      raf: 0,
      pendingX: 0,
      pendingY: 0,
      hasPending: false,
      finish: () => {},
    }

    const attached = registry.get(id)
    const el = attached?.element

    function flush(): void {
      if (!session.hasPending || drag !== session) return
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

      wm.move(id, session.pendingX - session.grabDX, session.pendingY - session.grabDY)

      if (snapEnabled && current.snappable) {
        const viewport = wm.getState().viewport
        const rawZone = detectSnapZone(session.pendingX, session.pendingY, viewport, snapOptions)
        let zone: DragSession['zone'] = rawZone
        if (rawZone === 'top') {
          if (topEdge === 'maximize') zone = current.maximizable ? 'maximize' : null
          else if (topEdge === 'none') zone = null
        }
        session.zone = zone
        if (zone) {
          showPreview(
            zone === 'maximize'
              ? { x: 0, y: 0, width: viewport.width, height: viewport.height }
              : zoneBounds(zone, viewport),
          )
        } else {
          hidePreview()
        }
      }
    }

    function onMove(moveEvent: PointerEvent): void {
      if (moveEvent.pointerId !== session.pointerId) return
      const movePoint = desktopPoint(moveEvent)
      if (!session.moved) {
        const travelled =
          Math.abs(movePoint.x - (session.startBounds.x + session.grabDX)) +
          Math.abs(movePoint.y - (session.startBounds.y + session.grabDY))
        if (travelled < 3 && session.restored) return
        session.moved = true
        if (el) el.dataset.wmDragging = ''
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
      if (drag !== session) return
      if (session.raf !== 0) view?.cancelAnimationFrame(session.raf)
      if (session.hasPending && !cancelled) flush()
      drag = null
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onCancel)
      doc.removeEventListener('keydown', onKeydown, true)
      if (handle.hasPointerCapture(session.pointerId)) {
        handle.releasePointerCapture(session.pointerId)
      }
      if (el) delete el.dataset.wmDragging
      hidePreview()

      if (cancelled) {
        if (session.moved && session.restored) {
          wm.move(id, session.startBounds.x, session.startBounds.y)
        }
        return
      }
      if (session.moved && session.zone) {
        if (session.zone === 'maximize') wm.maximize(id)
        else wm.snap(id, session.zone)
      }
    }

    session.finish = finish
    drag = session
    handle.setPointerCapture(event.pointerId)
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onCancel)
    doc.addEventListener('keydown', onKeydown, true)
  }

  function startResize(id: string, direction: ResizeDirection, event: PointerEvent): void {
    const win = wm.get(id)
    if (!win?.resizable || event.button !== 0 || drag) return
    event.preventDefault()
    event.stopPropagation()

    const handleEl = event.currentTarget as HTMLElement
    const startPoint = desktopPoint(event)
    const start = win.bounds
    const minSize = win.minSize
    const maxSize = win.maxSize
    let raf = 0
    let pendingX = 0
    let pendingY = 0
    let hasPending = false
    const attached = registry.get(id)
    if (attached) attached.element.dataset.wmResizing = direction

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
      const movePoint = desktopPoint(moveEvent)
      pendingX = movePoint.x
      pendingY = movePoint.y
      hasPending = true
      if (raf === 0) raf = view?.requestAnimationFrame(flush) ?? 0
    }

    function finish(cancelled: boolean): void {
      if (raf !== 0) view?.cancelAnimationFrame(raf)
      if (hasPending && !cancelled) flush()
      handleEl.removeEventListener('pointermove', onMove)
      handleEl.removeEventListener('pointerup', onUp)
      handleEl.removeEventListener('pointercancel', onCancelPointer)
      doc.removeEventListener('keydown', onKeydown, true)
      if (handleEl.hasPointerCapture(event.pointerId)) {
        handleEl.releasePointerCapture(event.pointerId)
      }
      if (attached) delete attached.element.dataset.wmResizing
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

  function attachWindow(
    id: string,
    windowElement: HTMLElement,
    windowOptions: WindowAttachOptions = {},
  ): () => void {
    const win = wm.get(id)
    if (!win) throw new Error(`wmkit: cannot attach unknown window "${id}"`)
    if (registry.has(id)) throw new Error(`wmkit: window "${id}" is already attached`)

    const attached: AttachedWindow = {
      element: windowElement,
      handle: null,
      handles: [],
      lastState: null,
      cleanup: [],
    }

    windowElement.dataset.wmWindow = id
    windowElement.setAttribute('role', 'dialog')
    windowElement.tabIndex = -1
    windowElement.style.position = 'absolute'
    windowElement.style.left = '0'
    windowElement.style.top = '0'

    const titleEl = windowElement.querySelector('[data-wm-title]')
    if (titleEl) {
      if (!titleEl.id) titleEl.id = `wmkit-title-${id}`
      windowElement.setAttribute('aria-labelledby', titleEl.id)
    }

    const handle =
      typeof windowOptions.handle === 'string'
        ? windowElement.querySelector<HTMLElement>(windowOptions.handle)
        : (windowOptions.handle ?? windowElement.querySelector<HTMLElement>('[data-wm-drag]'))
    attached.handle = handle

    const onPointerDownFocus = () => {
      wm.focus(id)
    }
    windowElement.addEventListener('pointerdown', onPointerDownFocus, true)
    attached.cleanup.push(() =>
      windowElement.removeEventListener('pointerdown', onPointerDownFocus, true),
    )

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target) return
      const current = wm.get(id)
      if (!current) return
      if (target.closest('[data-wm-close]')) {
        if (current.closable) wm.close(id)
      } else if (target.closest('[data-wm-minimize]')) {
        if (current.minimizable) wm.minimize(id)
      } else if (target.closest('[data-wm-maximize]')) {
        if (current.maximizable) wm.toggleMaximize(id)
      }
    }
    windowElement.addEventListener('click', onClick)
    attached.cleanup.push(() => windowElement.removeEventListener('click', onClick))

    if (handle) {
      handle.style.touchAction = 'none'
      const onHandleDown = (event: PointerEvent) => startDrag(id, handle, event)
      handle.addEventListener('pointerdown', onHandleDown)
      attached.cleanup.push(() => handle.removeEventListener('pointerdown', onHandleDown))

      const onDoubleClick = (event: MouseEvent) => {
        const target = event.target as Element | null
        if (target?.closest(INTERACTIVE_SELECTOR)) return
        const current = wm.get(id)
        if (current?.maximizable) wm.toggleMaximize(id)
      }
      handle.addEventListener('dblclick', onDoubleClick)
      attached.cleanup.push(() => handle.removeEventListener('dblclick', onDoubleClick))
    }

    if (windowOptions.resizeHandles !== false) {
      for (const direction of RESIZE_DIRECTIONS) {
        const resizeHandle = doc.createElement('div')
        resizeHandle.dataset.wmResize = direction
        resizeHandle.setAttribute('aria-hidden', 'true')
        const base =
          'position:absolute;touch-action:none;user-select:none;-webkit-user-select:none;'
        const size = 8
        const corner = 12
        const styles: Record<ResizeDirection, string> = {
          n: `top:${-size / 2}px;left:${corner}px;right:${corner}px;height:${size}px`,
          s: `bottom:${-size / 2}px;left:${corner}px;right:${corner}px;height:${size}px`,
          e: `right:${-size / 2}px;top:${corner}px;bottom:${corner}px;width:${size}px`,
          w: `left:${-size / 2}px;top:${corner}px;bottom:${corner}px;width:${size}px`,
          ne: `top:${-size / 2}px;right:${-size / 2}px;width:${corner}px;height:${corner}px`,
          nw: `top:${-size / 2}px;left:${-size / 2}px;width:${corner}px;height:${corner}px`,
          se: `bottom:${-size / 2}px;right:${-size / 2}px;width:${corner}px;height:${corner}px`,
          sw: `bottom:${-size / 2}px;left:${-size / 2}px;width:${corner}px;height:${corner}px`,
        }
        resizeHandle.style.cssText = `${base}${styles[direction]};cursor:${RESIZE_CURSORS[direction]}`
        const onResizeDown = (event: PointerEvent) => startResize(id, direction, event)
        resizeHandle.addEventListener('pointerdown', onResizeDown)
        attached.cleanup.push(() => resizeHandle.removeEventListener('pointerdown', onResizeDown))
        windowElement.append(resizeHandle)
        attached.handles.push(resizeHandle)
      }
    }

    const onWindowKeydown = (event: KeyboardEvent) => {
      const target = event.target as Element | null
      if (target?.closest(INTERACTIVE_SELECTOR)) return
      const current = wm.get(id)
      if (!current) return
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }
      const vector = arrows[event.key]
      if (!vector || !keyboardEnabled) return
      event.preventDefault()
      const step = event.altKey ? 1 : moveStep
      const [dx, dy] = vector
      if (event.shiftKey) {
        if (current.resizable) {
          wm.resize(id, {
            width: current.bounds.width + dx * step,
            height: current.bounds.height + dy * step,
          })
        }
      } else if (current.draggable && current.stage === 'normal') {
        wm.moveBy(id, dx * step, dy * step)
      }
    }
    windowElement.addEventListener('keydown', onWindowKeydown)
    attached.cleanup.push(() => windowElement.removeEventListener('keydown', onWindowKeydown))

    const onModalTrap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const current = wm.get(id)
      if (current?.layer !== 'modal') return
      const focusables = windowElement.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    windowElement.addEventListener('keydown', onModalTrap)
    attached.cleanup.push(() => windowElement.removeEventListener('keydown', onModalTrap))

    registry.set(id, attached)
    lastOrder = null
    lastFocused = null
    syncAll()

    return () => {
      if (drag?.id === id) endDrag(true)
      for (const dispose of attached.cleanup) dispose()
      for (const resizeHandle of attached.handles) resizeHandle.remove()
      registry.delete(id)
    }
  }

  return {
    element,
    wm,
    attachWindow,
    destroy() {
      endDrag(true)
      for (const [, attached] of registry) {
        for (const dispose of attached.cleanup) dispose()
        for (const resizeHandle of attached.handles) resizeHandle.remove()
      }
      registry.clear()
      for (const dispose of cleanup) dispose()
      preview?.remove()
      delete element.dataset.wmDesktop
    },
  }
}

export interface DesktopBinder {
  wm: WindowManager
  controller(): DesktopController | null
  bindDesktop(element: HTMLElement): () => void
  bindWindow(id: string, element: HTMLElement, options?: WindowAttachOptions): () => void
}

interface PendingWindow {
  id: string
  element: HTMLElement
  options: WindowAttachOptions | undefined
  detach: (() => void) | null
}

export function createDesktopBinder(
  wm: WindowManager,
  options: DesktopOptions = {},
): DesktopBinder {
  let controller: DesktopController | null = null
  const entries = new Set<PendingWindow>()

  function attachEntry(entry: PendingWindow): void {
    if (controller && !entry.detach && wm.get(entry.id)) {
      entry.detach = controller.attachWindow(entry.id, entry.element, entry.options)
    }
  }

  wm.on('open', ({ window: win }) => {
    for (const entry of entries) {
      if (entry.id === win.id) attachEntry(entry)
    }
  })

  return {
    wm,
    controller: () => controller,
    bindDesktop(element) {
      if (controller) throw new Error('wmkit: desktop is already bound')
      controller = attachDesktop(wm, element, options)
      for (const entry of entries) attachEntry(entry)
      return () => {
        for (const entry of entries) entry.detach = null
        controller?.destroy()
        controller = null
      }
    },
    bindWindow(id, element, windowOptions) {
      const entry: PendingWindow = { id, element, options: windowOptions, detach: null }
      entries.add(entry)
      attachEntry(entry)
      return () => {
        entry.detach?.()
        entry.detach = null
        entries.delete(entry)
      }
    },
  }
}
