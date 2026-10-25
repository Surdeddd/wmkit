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
  type DropTarget,
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

interface MountSlot {
  mount: SkinMount
  done: boolean
}

interface AttachedWindow {
  element: HTMLElement
  handle: HTMLElement | null
  title: HTMLElement | null
  skin: string | null
  slot: MountSlot | null
  mountOptions: WindowAttachOptions
  release: (() => void) | null
  last: HTMLElement | null
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
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable=false]), iframe, summary, [controls]'

const FRAMES = 'iframe, object, embed'

let titleSeq = 0

function setData(el: HTMLElement, key: string, value: string | null): void {
  if (value === null) {
    if (key in el.dataset) delete el.dataset[key]
  } else if (el.dataset[key] !== value) {
    el.dataset[key] = value
  }
}

function setAttr(el: HTMLElement, name: string, value: string | null): void {
  if (value === null) el.removeAttribute(name)
  else if (el.getAttribute(name) !== value) el.setAttribute(name, value)
}

function setText(el: HTMLElement, text: string): void {
  if (el.textContent === text) return
  if (el.firstElementChild) {
    el.textContent = text
    return
  }
  let first: Text | null = null
  for (const node of el.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE) continue
    if (first) (node as Text).data = ''
    else first = node as Text
  }
  if (first) first.data = text
  else el.append(text)
}

function retire(slot: MountSlot): void {
  if (slot.done) return
  slot.done = true
  slot.mount.destroy?.()
}

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
  const root = node.shadowRoot
  if (!root) return null
  for (const candidate of root.querySelectorAll('[data-wm-drag]')) {
    const box = candidate.getBoundingClientRect()
    if (
      clientX >= box.left &&
      clientX <= box.right &&
      clientY >= box.top &&
      clientY <= box.bottom
    ) {
      return candidate
    }
  }
  return null
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
  const dropTargets = new Set<DropTarget>()
  function showPreview(bounds: Bounds, drop = false): void {
    if (!snapPreviewEnabled && !drop) return
    if (!preview) {
      preview = doc.createElement('div')
      preview.dataset.wmSnapPreview = ''
      preview.style.cssText =
        'position:absolute;left:0;top:0;pointer-events:none;display:none;z-index:2147483646'
      element.append(preview)
    }
    preview.style.display = 'block'
    preview.toggleAttribute('data-wm-drop', drop)
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
        const host = windowElementOf(node)
        const id = host?.dataset.wmWindow
        if (!id || id === selfId || registry.get(id)?.element !== host) continue
        const handle = dragHandleAt(node, clientX, clientY)
        return handle && windowElementOf(handle) === host ? id : null
      }
      return null
    },
    dropAt(clientX, clientY, id) {
      for (const hit of dropTargets) {
        const found = hit(clientX, clientY, id)
        if (found) return found
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

  function rescue(el: HTMLElement): void {
    if (el.contains(doc.activeElement)) element.focus({ preventScroll: true })
  }

  function pull(attached: AttachedWindow): void {
    const el = attached.element
    if (el.contains(doc.activeElement)) return
    const last = attached.last
    if (last?.isConnected && windowElementOf(last) === el) last.focus({ preventScroll: true })
    if (!el.contains(doc.activeElement)) el.focus({ preventScroll: true })
  }

  const modalUp = () =>
    [...registry.values()].some(({ element: el }) => el.dataset.wmLayer === 'modal' && !el.hidden)

  function syncWindow(
    attached: AttachedWindow,
    win: WindowState,
    activeWorkspace: number,
    activeTab: boolean,
  ): void {
    const el = attached.element
    const prev = attached.lastState
    const transition = prev ? null : el.style.transition
    if (transition !== null) el.style.transition = 'none'
    if (
      prev !== win ||
      attached.lastWorkspace !== activeWorkspace ||
      attached.lastTab !== activeTab
    ) {
      const b = win.bounds
      if (prev === null || prev.bounds.x !== b.x || prev.bounds.y !== b.y) {
        el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`
      }
      if (prev === null || prev.bounds.width !== b.width) el.style.width = `${b.width}px`
      if (prev === null || prev.bounds.height !== b.height) el.style.height = `${b.height}px`
      setData(el, 'wmStage', win.stage)
      setData(el, 'wmLayer', win.layer)
      setData(el, 'wmWorkspace', String(win.workspace))
      setData(el, 'wmVariant', windowVariant(win))
      setData(el, 'wmGroup', win.groupId)
      setData(el, 'wmTab', win.groupId === null ? null : activeTab ? 'active' : 'inactive')
      const hide = win.stage === 'minimized' || win.workspace !== activeWorkspace || !activeTab
      if (hide && !el.hidden) rescue(el)
      if (!hide && el.hidden && wm.getState().focusedId === win.id) {
        queueMicrotask(() => {
          if (!el.hidden) pull(attached)
        })
      }
      if (el.hidden !== hide) el.hidden = hide
      setAttr(el, 'aria-label', win.title)
      if (attached.title) setText(attached.title, win.title)
      setAttr(el, 'aria-modal', win.layer === 'modal' ? 'true' : null)
      const display =
        win.resizable && (win.stage === 'normal' || win.stage === 'snapped') ? '' : 'none'
      for (const handle of attached.handles) {
        if (handle.style.display !== display) handle.style.display = display
      }
      attached.lastState = win
      attached.lastWorkspace = activeWorkspace
      attached.lastTab = activeTab
    }
    if (transition !== null) {
      void el.offsetWidth
      el.style.transition = transition
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
  let shielded = false

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
    let modal = false
    for (const id of state.order) {
      const attached = registry.get(id)
      const win = state.windows[id]
      if (!attached || !win) continue
      const wanted = typeof win.meta.skin === 'string' ? win.meta.skin : null
      if (
        attached.skin !== null &&
        wanted !== null &&
        wanted !== attached.skin &&
        wanted !== attached.lastState?.meta.skin
      ) {
        restyle = restyle ?? []
        restyle.push([id, wanted])
      }
      const activeTab = win.groupId === null || state.groups[win.groupId]?.activeId === win.id
      if (
        win.layer === 'modal' &&
        activeTab &&
        win.stage !== 'minimized' &&
        win.workspace === state.workspace
      ) {
        modal = true
      }
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
    if (modal !== shielded) {
      shielded = modal
      for (const { element: el } of registry.values()) {
        if (el.dataset.wmLayer === 'modal') continue
        for (const frame of el.querySelectorAll<HTMLElement>(FRAMES)) {
          frame.style.pointerEvents = modal ? 'none' : ''
        }
      }
    }
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
      pull(attached)
    }),
  )

  function followFrame(): void {
    const active = doc.activeElement
    const host = active?.matches(FRAMES) ? windowElementOf(active) : null
    const id = host?.dataset.wmWindow
    if (id && registry.get(id)?.element === host && wm.getState().focusedId !== id && !shielded) {
      wm.focus(id)
    }
  }
  let frameWatch = 0
  const watchFrame = () => {
    followFrame()
    frameWatch = view.requestAnimationFrame(watchFrame)
  }
  const onPointerOver = (event: Event) => {
    const over = !!firedOn(event)?.matches(FRAMES)
    if (over && !frameWatch) frameWatch = view.requestAnimationFrame(watchFrame)
    else if (!over && frameWatch) {
      view.cancelAnimationFrame(frameWatch)
      frameWatch = 0
      followFrame()
    }
  }
  const onViewBlur = () => view.setTimeout(followFrame)
  element.addEventListener('pointerover', onPointerOver)
  view.addEventListener('blur', onViewBlur)
  cleanup.push(() => {
    element.removeEventListener('pointerover', onPointerOver)
    view.removeEventListener('blur', onViewBlur)
    view.cancelAnimationFrame(frameWatch)
  })

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
      if (historyShortcuts && (event.key === 'z' || event.key === 'Z' || event.keyCode === 90)) {
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
      slot: null,
      mountOptions: windowOptions,
      release: null,
      last: null,
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
      if (!lightTitle.id) lightTitle.id = `wmkit-title-${id}-${++titleSeq}`
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

    const onPointerDownFocus = (event: Event) => {
      if (drag) return
      const target = firedOn(event) as HTMLElement | null
      const chrome = !!target && (!!handle?.contains(target) || attached.handles.includes(target))
      if (!chrome && !windowElement.contains(doc.activeElement)) attached.last = null
      if (!wm.focus(id)) event.stopPropagation()
      else if (chrome) pull(attached)
    }
    windowElement.addEventListener('pointerdown', onPointerDownFocus, true)
    attached.cleanup.push(() =>
      windowElement.removeEventListener('pointerdown', onPointerDownFocus, true),
    )

    const onBlockedInput = (event: Event) => {
      if (windowElement.dataset.wmLayer !== 'modal' && modalUp()) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    for (const type of ['mousedown', 'click', 'dblclick', 'contextmenu']) {
      windowElement.addEventListener(type, onBlockedInput, true)
      attached.cleanup.push(() => windowElement.removeEventListener(type, onBlockedInput, true))
    }

    const onFocusIn = (event: Event) => {
      attached.last = firedOn(event) as HTMLElement | null
    }
    for (const scope of [windowElement, windowElement.shadowRoot]) {
      scope?.addEventListener('focusin', onFocusIn)
      attached.cleanup.push(() => scope?.removeEventListener('focusin', onFocusIn))
    }

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
          if (!current || firedOn(event)?.closest(interactiveSelector)) return
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
      if (drag || target?.closest(interactiveSelector)) return
      if (target !== windowElement && !handle?.contains(target)) return
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
      const index = focusables.indexOf(active as HTMLElement)
      if (
        event.shiftKey
          ? index < 1
          : index === focusables.length - 1 || (index < 0 && active !== windowElement)
      ) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
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
      delete windowElement.dataset.wmFlash
      if (focusedEl === windowElement) focusedEl = null
      if (groupTargetEl === windowElement) {
        groupTargetId = null
        groupTargetEl = null
      }
    }

    const stopOnClose = wm.on('close', ({ window: closed }) => {
      if (closed.id !== id) return
      rescue(windowElement)
      detach()
      if (windowOptions.removeOnClose) windowElement.remove()
      if (attached.slot) retire(attached.slot)
    })
    attached.cleanup.push(stopOnClose)

    attached.release = detach
    registry.set(id, attached)
    lastOrder = null
    syncAll()
    if (wm.getState().focusedId === id) pull(attached)

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
  ): MountSlot {
    const win = wm.get(id)
    if (!win) throw new Error(`wmkit: cannot mount unknown window "${id}"`)
    const mount = resolveSkin(skin)({ doc, id, window: win, actions: createActions(wm, id) })
    const standing = registry.get(id)
    const previous = standing?.slot?.mount ?? null
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
    }
    element.append(mount.element)
    try {
      attachWindow(id, mount.element, windowOptions)
    } catch (error) {
      mount.element.remove()
      previous?.element.remove()
      mount.destroy?.()
      throw error
    }
    const into = mount.content as HTMLElement & { moveBefore?(node: Node, child: null): void }
    for (const node of carried) {
      if (into.moveBefore && node.isConnected) into.moveBefore(node, null)
      else into.append(node)
    }
    previous?.element.remove()
    const attached = registry.get(id) as AttachedWindow
    attached.skin = typeof skin === 'string' ? skin : null
    const slot = standing?.slot ?? { mount, done: false }
    slot.mount = mount
    attached.slot = slot
    previous?.destroy?.()
    return slot
  }

  function mountWindow(
    id: string,
    skin: WindowSkin | string,
    options: WindowAttachOptions = {},
  ): MountedWindow {
    // the library created this element, so it is the library that clears it away
    const slot = buildSkin(id, skin, { removeOnClose: true, ...options })
    return {
      get element() {
        return slot.mount.element
      },
      get content() {
        return slot.mount.content
      },
      detach() {
        const attached = registry.get(id)
        if (attached?.slot === slot) attached.release?.()
        slot.mount.element.remove()
        retire(slot)
      },
    }
  }

  return {
    element,
    wm,
    attachWindow,
    mountWindow,
    actions: (id: string) => createActions(wm, id),
    addDropTarget(target) {
      dropTargets.add(target)
      return () => {
        dropTargets.delete(target)
      }
    },
    destroy() {
      endDrag(true)
      for (const [, attached] of registry) {
        attached.release?.()
        // elements the library built are the library's to clear away
        if (attached.slot) {
          attached.slot.mount.element.remove()
          retire(attached.slot)
        }
      }
      registry.clear()
      for (const dispose of cleanup) dispose()
      preview?.remove()
      delete element.dataset.wmDesktop
    },
  }
}
