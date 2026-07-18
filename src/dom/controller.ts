import type { Bounds, WindowManager, WindowState } from '../core/types'
import { flipFromTarget, flipToTarget } from './animate'
import { type Announcer, createAnnouncer } from './announcer'
import { createDragStarter } from './drag'
import { createResizeHandles, createResizeStarter } from './resize'
import {
  type ActiveDrag,
  type DesktopController,
  type DesktopKeyboardOptions,
  type DesktopOptions,
  type DesktopSnapOptions,
  INTERACTIVE_SELECTOR,
  type Point,
  type SessionContext,
  type WindowAttachOptions,
  windowOf,
} from './shared'

interface AttachedWindow {
  element: HTMLElement
  handle: HTMLElement | null
  handles: HTMLElement[]
  lastState: WindowState | null
  lastZ: number
  cleanup: Array<() => void>
}

export function attachDesktop(
  wm: WindowManager,
  element: HTMLElement,
  options: DesktopOptions = {},
): DesktopController {
  const doc = element.ownerDocument
  const view = windowOf(element)

  const coarsePointer =
    typeof view.matchMedia === 'function' && view.matchMedia('(pointer: coarse)').matches
  const snapEnabled = options.snap !== false
  const snapOptions: DesktopSnapOptions = typeof options.snap === 'object' ? options.snap : {}
  const snapPreviewEnabled = snapOptions.preview !== false
  const topEdge = snapOptions.topEdge ?? 'maximize'
  const keyboardEnabled = options.keyboard !== false
  const keyboardOptions: DesktopKeyboardOptions =
    typeof options.keyboard === 'object' ? options.keyboard : {}
  const moveStep = keyboardOptions.moveStep ?? 16
  const cycleEnabled = keyboardOptions.cycle !== false
  const hitEdge = options.hitAreas?.edge ?? (coarsePointer ? 16 : 8)
  const hitCorner = options.hitAreas?.corner ?? (coarsePointer ? 24 : 12)
  const magnetThreshold =
    options.magnetism === false
      ? 0
      : ((typeof options.magnetism === 'object' ? options.magnetism.threshold : undefined) ??
        (coarsePointer ? 12 : 8))

  element.dataset.wmDesktop = ''
  if (view.getComputedStyle(element).position === 'static') {
    element.style.position = 'relative'
  }

  const registry = new Map<string, AttachedWindow>()
  const cleanup: Array<() => void> = []
  let lastOrder: readonly string[] | null = null
  let lastFocused: string | null = null
  let drag: ActiveDrag | null = null
  let cachedRect: { left: number; top: number } | null = null
  let rectUsers = 0

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

  const ctx: SessionContext = {
    wm,
    doc,
    view,
    toLocal(event: PointerEvent): Point {
      const rect = cachedRect ?? element.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    },
    trackRect() {
      if (rectUsers === 0) {
        const rect = element.getBoundingClientRect()
        cachedRect = { left: rect.left, top: rect.top }
      }
      rectUsers += 1
      let released = false
      return () => {
        if (released) return
        released = true
        rectUsers -= 1
        if (rectUsers === 0) cachedRect = null
      }
    },
    windowElement: (id) => registry.get(id)?.element,
    showPreview,
    hidePreview,
    snapEnabled,
    snapDetect: {
      threshold: snapOptions.threshold ?? (coarsePointer ? 20 : 12),
      cornerSize: snapOptions.cornerSize ?? (coarsePointer ? 96 : 64),
    },
    topEdge,
    hitEdge,
    hitCorner,
    magnetThreshold,
    currentDrag: () => drag,
    claimDrag(session) {
      drag = session
    },
    releaseDrag(session) {
      if (drag === session) drag = null
    },
  }

  const startDrag = createDragStarter(ctx)
  const startResize = createResizeStarter(ctx)

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
    if (attached.lastZ !== zIndex) {
      el.style.zIndex = String(zIndex + 1)
      attached.lastZ = zIndex
    }
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
      const attached = registry.get(win.id)
      if (!attached) return
      if (win.stage === 'minimized' && previous !== 'minimized') {
        const target = options.minimizeTarget?.(win)
        if (target) flipToTarget(attached.element, target)
      } else if (previous === 'minimized' && win.stage !== 'minimized') {
        const target = options.minimizeTarget?.(win)
        if (target) flipFromTarget(attached.element, target)
      }
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

  function endDrag(cancelled: boolean): void {
    if (drag) drag.finish(cancelled)
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
      lastZ: -1,
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

      if (options.onTitlebarContextMenu) {
        const onContextMenu = (event: MouseEvent) => {
          const current = wm.get(id)
          if (!current) return
          event.preventDefault()
          options.onTitlebarContextMenu?.(current, event)
        }
        handle.addEventListener('contextmenu', onContextMenu)
        attached.cleanup.push(() => handle.removeEventListener('contextmenu', onContextMenu))
      }
    }

    if (windowOptions.resizeHandles !== false) {
      for (const { element: resizeHandle, direction } of createResizeHandles(
        doc,
        hitEdge,
        hitCorner,
      )) {
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

    const detach = () => {
      if (drag?.id === id) endDrag(true)
      for (const dispose of attached.cleanup) dispose()
      for (const resizeHandle of attached.handles) resizeHandle.remove()
      registry.delete(id)
    }

    if (windowOptions.removeOnClose) {
      const stopOnClose = wm.on('close', ({ window: closed }) => {
        if (closed.id !== id) return
        detach()
        windowElement.remove()
      })
      attached.cleanup.push(stopOnClose)
    }

    registry.set(id, attached)
    lastOrder = null
    lastFocused = null
    syncAll()

    return detach
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
