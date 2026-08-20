import type { Bounds, SnapZone, WindowManager, WindowState } from '../core/types'
import { createActions } from './actions'
import { flipFromTarget, flipToTarget } from './animate'
import { type Announcer, createAnnouncer } from './announcer'
import { createDragStarter } from './drag'
import { createResizeHandles, createResizeStarter } from './resize'
import {
  type ActiveDrag,
  type AnimationOptions,
  type DesktopController,
  type DesktopKeyboardOptions,
  type DesktopOptions,
  type DesktopSnapOptions,
  type GestureContext,
  INTERACTIVE_SELECTOR,
  type MountedWindow,
  type Point,
  type SessionContext,
  type SkinMount,
  type WindowAttachOptions,
  type WindowSkin,
  windowOf,
} from './shared'
import { restack, type StackingTarget, UNASSIGNED } from './stacking'

interface AttachedWindow {
  element: HTMLElement
  handle: HTMLElement | null
  title: HTMLElement | null
  skin: string | null
  mount: SkinMount | null
  mountOptions: WindowAttachOptions
  release: (() => void) | null
  handles: HTMLElement[]
  lastState: WindowState | null
  lastZ: number
  lastWorkspace: number
  lastTab: boolean
  cleanup: Array<() => void>
}

const SNAP_SHORTCUTS: Record<string, SnapZone> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

const SNAP_ZONES = new Set<string>([
  'left',
  'right',
  'top',
  'bottom',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'left-third',
  'center-third',
  'right-third',
])

const LANDMARK_TAGS = new Set(['header', 'footer', 'aside', 'nav'])

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function firedOn(event: Event): Element | null {
  const path = event.composedPath()
  const first = path.length > 0 ? path[0] : event.target
  return first instanceof Element ? first : null
}

function findInWindow(el: HTMLElement, selector: string): HTMLElement | null {
  return (
    el.querySelector<HTMLElement>(selector) ??
    el.shadowRoot?.querySelector<HTMLElement>(selector) ??
    null
  )
}

function focusablesOf(el: HTMLElement): HTMLElement[] {
  const root = el.shadowRoot
  if (!root) return [...el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
  const found: HTMLElement[] = []
  for (const node of root.querySelectorAll<HTMLElement>(`${FOCUSABLE_SELECTOR}, slot`)) {
    if (!(node instanceof HTMLSlotElement)) {
      found.push(node)
      continue
    }
    for (const assigned of node.assignedElements()) {
      if (assigned.matches(FOCUSABLE_SELECTOR)) found.push(assigned as HTMLElement)
      found.push(...assigned.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    }
  }
  return found
}

function dragHandleAt(node: Element, clientX: number, clientY: number): Element | null {
  const handle = node.closest?.('[data-wm-drag]')
  if (handle) return handle
  const inner = node.shadowRoot?.elementFromPoint?.(clientX, clientY) ?? null
  return inner === null || inner === node ? null : dragHandleAt(inner, clientX, clientY)
}

function windowElementOf(node: Element): HTMLElement | null {
  const found = node.closest<HTMLElement>('[data-wm-window]')
  if (found) return found
  const host = (node.getRootNode() as ShadowRoot).host
  return host ? windowElementOf(host) : null
}

function defaultVariant(win: WindowState): string | null {
  const variant = win.meta.variant
  return typeof variant === 'string' && variant !== '' ? variant : null
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
  const groupingEnabled = options.grouping !== false
  const groupDwell =
    (typeof options.grouping === 'object' ? options.grouping.dwell : undefined) ?? 420
  const snapEnabled = options.snap !== false
  const snapOptions: DesktopSnapOptions = typeof options.snap === 'object' ? options.snap : {}
  const snapPreviewEnabled = snapOptions.preview !== false
  const topEdge = snapOptions.topEdge ?? 'maximize'
  const keyboardEnabled = options.keyboard !== false
  const keyboardOptions: DesktopKeyboardOptions =
    typeof options.keyboard === 'object' ? options.keyboard : {}
  const moveStep = keyboardOptions.moveStep ?? 16
  const cycleEnabled = keyboardOptions.cycle !== false
  const snapShortcuts = keyboardOptions.snapShortcuts !== false
  const historyShortcuts = keyboardOptions.historyShortcuts !== false
  const hitEdge = options.hitAreas?.edge ?? (coarsePointer ? 16 : 8)
  const hitCorner = options.hitAreas?.corner ?? (coarsePointer ? 24 : 12)
  const magnetThreshold =
    options.magnetism === false
      ? 0
      : ((typeof options.magnetism === 'object' ? options.magnetism.threshold : undefined) ??
        (coarsePointer ? 12 : 8))
  const zIndexBase = options.stacking?.base ?? 0
  const zIndexGap = options.stacking?.gap ?? 32
  const interactiveSelector = options.interactiveSelector ?? INTERACTIVE_SELECTOR
  const animationEnabled = options.animation !== false
  const animationOptions: AnimationOptions =
    typeof options.animation === 'object' ? options.animation : {}
  const windowVariant = options.windowVariant ?? defaultVariant

  element.dataset.wmDesktop = ''
  element.tabIndex = -1
  if (view.getComputedStyle(element).position === 'static') {
    element.style.position = 'relative'
  }
  if (options.stacking?.isolate !== false) element.style.isolation = 'isolate'

  const registry = new Map<string, AttachedWindow>()
  const cleanup: Array<() => void> = []
  let lastOrder: readonly string[] | null = null
  let focusedEl: HTMLElement | null = null
  let drag: ActiveDrag | null = null
  let groupTargetId: string | null = null
  let groupTargetEl: HTMLElement | null = null
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

  function refreshRect(): void {
    const rect = element.getBoundingClientRect()
    cachedRect = { left: rect.left, top: rect.top }
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
        refreshRect()
        view.addEventListener('scroll', refreshRect, true)
        view.addEventListener('resize', refreshRect)
      }
      rectUsers += 1
      let released = false
      return () => {
        if (released) return
        released = true
        rectUsers -= 1
        if (rectUsers === 0) {
          view.removeEventListener('scroll', refreshRect, true)
          view.removeEventListener('resize', refreshRect)
          cachedRect = null
        }
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
    interactiveSelector,
    magnetThreshold,
    groupDwell,
    groupTarget(clientX, clientY, selfId) {
      if (!groupingEnabled || typeof doc.elementsFromPoint !== 'function') return null
      for (const node of doc.elementsFromPoint(clientX, clientY)) {
        const handle = dragHandleAt(node, clientX, clientY)
        const host = handle && windowElementOf(handle)
        const id = host?.dataset.wmWindow
        if (id && id !== selfId && registry.get(id)?.element === host) return id
      }
      return null
    },
    markGroupTarget(id) {
      if (groupTargetId === id) return
      if (groupTargetEl) delete groupTargetEl.dataset.wmTabTarget
      groupTargetId = id
      groupTargetEl = id ? (registry.get(id)?.element ?? null) : null
      if (groupTargetEl) groupTargetEl.dataset.wmTabTarget = ''
    },
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
  if (options.gestures) {
    const gestureContext: GestureContext = {
      wm,
      doc,
      view,
      desktop: element,
      toLocal: (event) => ctx.toLocal(event),
      trackRect: () => ctx.trackRect(),
      windowElement: (id) => ctx.windowElement(id),
      busy: () => drag !== null,
      claim: (gesture) => ctx.claimDrag(gesture),
      release: (gesture) => ctx.releaseDrag(gesture),
    }
    for (const gesture of options.gestures) cleanup.push(gesture(gestureContext))
  }

  if (options.autoViewport !== false) {
    const applyViewport = () =>
      wm.setViewport({ width: element.clientWidth, height: element.clientHeight })
    applyViewport()
    const observer = new view.ResizeObserver(applyViewport)
    observer.observe(element)
    cleanup.push(() => observer.disconnect())
  }

  function syncWindow(
    attached: AttachedWindow,
    win: WindowState,
    activeWorkspace: number,
    activeTab: boolean,
  ): void {
    const el = attached.element
    const firstSync = attached.lastState === null
    if (firstSync) el.style.transition = 'none'
    if (
      attached.lastState !== win ||
      attached.lastWorkspace !== activeWorkspace ||
      attached.lastTab !== activeTab
    ) {
      el.style.transform = `translate3d(${win.bounds.x}px, ${win.bounds.y}px, 0)`
      el.style.width = `${win.bounds.width}px`
      el.style.height = `${win.bounds.height}px`
      el.dataset.wmStage = win.stage
      el.dataset.wmLayer = win.layer
      el.dataset.wmWorkspace = String(win.workspace)
      const variant = windowVariant(win)
      if (variant === null) delete el.dataset.wmVariant
      else el.dataset.wmVariant = variant
      if (win.groupId === null) {
        delete el.dataset.wmGroup
        delete el.dataset.wmTab
      } else {
        el.dataset.wmGroup = win.groupId
        el.dataset.wmTab = activeTab ? 'active' : 'inactive'
      }
      const hide = win.stage === 'minimized' || win.workspace !== activeWorkspace || !activeTab
      if (hide && !el.hidden && el.contains(doc.activeElement)) {
        element.focus({ preventScroll: true })
      }
      if (!hide && el.hidden && wm.getState().focusedId === win.id) {
        queueMicrotask(() => {
          if (!el.hidden && !el.contains(doc.activeElement)) el.focus({ preventScroll: true })
        })
      }
      el.hidden = hide
      el.setAttribute('aria-label', win.title)
      if (attached.title && attached.title.textContent !== win.title) {
        attached.title.textContent = win.title
      }
      if (win.layer === 'modal') el.setAttribute('aria-modal', 'true')
      else el.removeAttribute('aria-modal')
      for (const handle of attached.handles) {
        handle.style.display =
          win.resizable && (win.stage === 'normal' || win.stage === 'snapped') ? '' : 'none'
      }
      attached.lastState = win
      attached.lastWorkspace = activeWorkspace
      attached.lastTab = activeTab
    }
    if (firstSync) {
      void el.offsetWidth
      el.style.transition = ''
    }
  }

  const stackRows: AttachedWindow[] = []
  const stackTarget: StackingTarget = {
    length: 0,
    zAt: (index) => (stackRows[index] as AttachedWindow).lastZ,
    assign(index, z) {
      const attached = stackRows[index] as AttachedWindow
      attached.lastZ = z
      attached.element.style.zIndex = String(z)
    },
  }

  function applyStacking(order: readonly string[]): void {
    let length = 0
    for (const id of order) {
      const attached = registry.get(id)
      if (attached) stackRows[length++] = attached
    }
    stackTarget.length = length
    restack(stackTarget, { base: zIndexBase, gap: zIndexGap })
    stackRows.length = length
  }

  let syncing = false
  let syncAgain = false

  function syncAll(): void {
    if (syncing) {
      syncAgain = true
      return
    }
    syncing = true
    try {
      do {
        syncAgain = false
        syncPass()
      } while (syncAgain)
    } finally {
      syncing = false
    }
  }

  function syncPass(): void {
    const state = wm.getState()
    const orderChanged = state.order !== lastOrder
    let restyle: Array<[string, string]> | null = null
    for (const id of state.order) {
      const attached = registry.get(id)
      const win = state.windows[id]
      if (!attached || !win) continue
      const wanted = typeof win.meta.skin === 'string' ? win.meta.skin : null
      if (attached.skin !== null && wanted !== null && wanted !== attached.skin) {
        restyle = restyle ?? []
        restyle.push([id, wanted])
        continue
      }
      const activeTab = win.groupId === null || state.groups[win.groupId]?.activeId === win.id
      if (
        attached.lastState !== win ||
        attached.lastWorkspace !== state.workspace ||
        attached.lastTab !== activeTab
      ) {
        syncWindow(attached, win, state.workspace, activeTab)
      }
    }
    if (restyle !== null) {
      for (const [id, wanted] of restyle) {
        const attached = registry.get(id)
        if (attached && attached.skin !== wanted) buildSkin(id, wanted, attached.mountOptions)
      }
      syncAgain = true
      return
    }
    if (orderChanged) applyStacking(state.order)
    const wanted = state.focusedId ? (registry.get(state.focusedId)?.element ?? null) : null
    if (wanted !== focusedEl) {
      if (focusedEl) delete focusedEl.dataset.wmFocused
      focusedEl = wanted
      if (focusedEl) focusedEl.dataset.wmFocused = ''
    }
    lastOrder = state.order
  }

  cleanup.push(wm.subscribe(syncAll))

  cleanup.push(
    wm.on('focus', ({ window: win }) => {
      const attached = registry.get(win.id)
      if (!attached) return
      if (attached.element.hidden) syncAll()
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
      if (!animationEnabled) return
      if (win.stage === 'minimized' && previous !== 'minimized') {
        const target = options.minimizeTarget?.(win)
        if (target) flipToTarget(attached.element, target, animationOptions)
      } else if (previous === 'minimized' && win.stage !== 'minimized') {
        const target = options.minimizeTarget?.(win)
        if (target) {
          view.requestAnimationFrame(() =>
            flipFromTarget(attached.element, target, animationOptions),
          )
        }
      }
    }),
  )

  if (keyboardEnabled) {
    const onDesktopKeydown = (event: KeyboardEvent) => {
      if (cycleEnabled && event.key === 'F6') {
        event.preventDefault()
        wm.cycleFocus(event.shiftKey ? -1 : 1)
        return
      }
      if (!event.ctrlKey && !event.metaKey) return
      if (drag) return
      const target = firedOn(event)
      if (target?.closest(interactiveSelector)) return
      if (historyShortcuts && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault()
        if (event.shiftKey) wm.redo()
        else wm.undo()
        return
      }
      if (!snapShortcuts || !event.altKey) return
      const focused = wm.getState().focusedId
      const win = focused ? wm.get(focused) : undefined
      if (!win) return
      const zone = SNAP_SHORTCUTS[event.key]
      if (zone) {
        event.preventDefault()
        if (win.snappable) wm.snap(win.id, zone)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (win.maximizable) wm.maximize(win.id)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (win.stage === 'normal') {
          if (win.minimizable) wm.minimize(win.id)
        } else {
          wm.restore(win.id)
        }
      }
    }
    element.addEventListener('keydown', onDesktopKeydown)
    cleanup.push(() => element.removeEventListener('keydown', onDesktopKeydown))
  }

  let rebuilding = false

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
      title: null,
      skin: null,
      mount: null,
      mountOptions: windowOptions,
      release: null,
      handles: [],
      lastState: null,
      lastZ: UNASSIGNED,
      lastWorkspace: -1,
      lastTab: true,
      cleanup: [],
    }

    windowElement.dataset.wmWindow = id
    windowElement.setAttribute('role', 'dialog')
    windowElement.tabIndex = -1
    windowElement.style.position = 'absolute'
    windowElement.style.left = '0'
    windowElement.style.top = '0'

    const lightTitle = windowElement.querySelector<HTMLElement>('[data-wm-title]')
    attached.title = lightTitle ?? findInWindow(windowElement, '[data-wm-title]')
    if (lightTitle) {
      if (!lightTitle.id) lightTitle.id = `wmkit-title-${id}`
      windowElement.setAttribute('aria-labelledby', lightTitle.id)
    }

    const handle =
      typeof windowOptions.handle === 'string'
        ? findInWindow(windowElement, windowOptions.handle)
        : (windowOptions.handle ?? findInWindow(windowElement, '[data-wm-drag]'))
    attached.handle = handle
    if (handle && !handle.hasAttribute('role') && LANDMARK_TAGS.has(handle.localName)) {
      handle.setAttribute('role', 'presentation')
    }

    const onPointerDownFocus = () => {
      wm.focus(id)
    }
    windowElement.addEventListener('pointerdown', onPointerDownFocus, true)
    attached.cleanup.push(() =>
      windowElement.removeEventListener('pointerdown', onPointerDownFocus, true),
    )

    const onClick = (event: MouseEvent) => {
      const target = firedOn(event)
      if (!target) return
      const current = wm.get(id)
      if (!current) return
      if (target.closest('[data-wm-close]')) {
        if (current.closable && options.beforeClose?.(current) !== false) wm.close(id)
        return
      }
      if (target.closest('[data-wm-minimize]')) {
        if (current.minimizable) wm.minimize(id)
        return
      }
      if (target.closest('[data-wm-maximize]')) {
        if (current.maximizable) wm.toggleMaximize(id)
        return
      }
      const act = createActions(wm, id)
      const snapTarget = target.closest<HTMLElement>('[data-wm-snap]')
      if (snapTarget) {
        const zone = snapTarget.dataset.wmSnap ?? ''
        if (current.snappable && SNAP_ZONES.has(zone)) act.snap(zone as SnapZone)
        return
      }
      if (target.closest('[data-wm-restore]')) {
        act.restore()
        return
      }
      if (target.closest('[data-wm-center]')) {
        act.center()
        return
      }
      if (target.closest('[data-wm-send-back]')) {
        act.sendToBack()
        return
      }
      const workspaceTarget = target.closest<HTMLElement>('[data-wm-to-workspace]')
      if (workspaceTarget) {
        act.moveToWorkspace(Number.parseInt(workspaceTarget.dataset.wmToWorkspace ?? '', 10))
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
        const target = firedOn(event)
        if (target?.closest(interactiveSelector)) return
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
        ;(windowElement.shadowRoot ?? windowElement).append(resizeHandle)
        attached.handles.push(resizeHandle)
      }
    }

    const onWindowKeydown = (event: KeyboardEvent) => {
      const target = firedOn(event)
      if (target?.closest(interactiveSelector)) return
      const current = wm.get(id)
      if (!current) return
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }
      if (event.ctrlKey || event.metaKey) return
      const vector = arrows[event.key]
      if (!vector || !keyboardEnabled) return
      const step = event.altKey ? 1 : moveStep
      const [dx, dy] = vector
      if (event.shiftKey) {
        if (!current.resizable) return
        event.preventDefault()
        wm.resize(id, {
          width: current.bounds.width + dx * step,
          height: current.bounds.height + dy * step,
        })
      } else if (current.draggable && current.stage === 'normal') {
        event.preventDefault()
        wm.moveBy(id, dx * step, dy * step)
      }
    }
    windowElement.addEventListener('keydown', onWindowKeydown)
    attached.cleanup.push(() => windowElement.removeEventListener('keydown', onWindowKeydown))

    const onModalTrap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const current = wm.get(id)
      if (current?.layer !== 'modal') return
      const active = windowElement.shadowRoot?.activeElement ?? doc.activeElement
      const focusables = focusablesOf(windowElement).filter(
        (node) => node.offsetParent !== null || node === active,
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return
      if (!windowElement.contains(doc.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
        return
      }
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    windowElement.addEventListener('keydown', onModalTrap)
    attached.cleanup.push(() => windowElement.removeEventListener('keydown', onModalTrap))

    let detached = false
    const detach = () => {
      if (detached) return
      detached = true
      // a rebuild is not a cancellation: keep where the pointer left the window
      if (drag?.id === id) endDrag(!rebuilding)
      for (const dispose of attached.cleanup) dispose()
      for (const resizeHandle of attached.handles) resizeHandle.remove()
      registry.delete(id)
      if (registry.get(id)?.element !== windowElement) delete windowElement.dataset.wmWindow
      delete windowElement.dataset.wmFocused
      delete windowElement.dataset.wmTabTarget
      if (focusedEl === windowElement) focusedEl = null
      if (groupTargetEl === windowElement) {
        groupTargetId = null
        groupTargetEl = null
      }
    }

    const stopOnClose = wm.on('close', ({ window: closed }) => {
      if (closed.id !== id) return
      detach()
      if (windowOptions.removeOnClose) windowElement.remove()
    })
    attached.cleanup.push(stopOnClose)

    registry.set(id, attached)
    lastOrder = null
    syncAll()
    if (wm.getState().focusedId === id && !windowElement.contains(doc.activeElement)) {
      windowElement.focus({ preventScroll: true })
    }

    return detach
  }

  function resolveSkin(skin: WindowSkin | string): WindowSkin {
    if (typeof skin !== 'string') return skin
    const found = options.skins?.[skin]
    if (!found) throw new Error(`wmkit: unknown skin "${skin}"`)
    return found
  }

  function buildSkin(
    id: string,
    skin: WindowSkin | string,
    windowOptions: WindowAttachOptions,
  ): SkinMount {
    const win = wm.get(id)
    if (!win) throw new Error(`wmkit: cannot mount unknown window "${id}"`)
    // resolve before anything is torn down, so an unknown name leaves the window standing
    const build = resolveSkin(skin)
    const standing = registry.get(id)
    const previous = standing?.mount ?? null
    // a popout moves the content element into another document; what lives there now
    // belongs to that window, not to the rebuild
    const carried =
      previous === null || previous.content.ownerDocument !== doc
        ? []
        : [...previous.content.childNodes]
    if (previous !== null) {
      registry.delete(id)
      rebuilding = true
      try {
        standing?.release?.()
      } finally {
        rebuilding = false
      }
      previous.element.remove()
    }
    const mount = build({ doc, id, window: win, actions: createActions(wm, id) })
    element.append(mount.element)
    const release = attachWindow(id, mount.element, windowOptions)
    const attached = registry.get(id) as AttachedWindow
    attached.skin = typeof skin === 'string' ? skin : null
    attached.mount = mount
    attached.mountOptions = windowOptions
    attached.release = release
    mount.content.append(...carried)
    previous?.destroy?.()
    return mount
  }

  function mountWindow(
    id: string,
    skin: WindowSkin | string,
    options: WindowAttachOptions = {},
  ): MountedWindow {
    // the library created this element, so it is the library that clears it away
    const windowOptions: WindowAttachOptions = { removeOnClose: true, ...options }
    let last = buildSkin(id, skin, windowOptions)
    let spent = false
    // follow the window across rebuilds, but never adopt a mount this handle did not make
    const live = () => {
      if (spent) return last
      const now = registry.get(id)?.mount
      if (now) last = now
      return last
    }
    return {
      get element() {
        return live().element
      },
      get content() {
        return live().content
      },
      detach() {
        if (spent) return
        const mount = live()
        spent = true
        if (registry.get(id)?.mount === mount) registry.get(id)?.release?.()
        mount.element.remove()
        mount.destroy?.()
      },
    }
  }

  return {
    element,
    wm,
    attachWindow,
    mountWindow,
    actions: (id: string) => createActions(wm, id),
    destroy() {
      endDrag(true)
      for (const [, attached] of registry) {
        for (const dispose of attached.cleanup) dispose()
        for (const resizeHandle of attached.handles) resizeHandle.remove()
        // elements the library built are the library's to clear away
        if (attached.mount) {
          attached.mount.element.remove()
          attached.mount.destroy?.()
        }
      }
      registry.clear()
      for (const dispose of cleanup) dispose()
      preview?.remove()
      delete element.dataset.wmDesktop
    },
  }
}
