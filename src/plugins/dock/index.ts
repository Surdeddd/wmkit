import type {
  Bounds,
  SerializedMaxSize,
  Size,
  WindowFlags,
  WindowState,
  WindowUpdate,
} from '../../core/types'
import type { DesktopController, DropHit, Point } from '../../dom/shared'
import {
  activate,
  type DockGeometry,
  type DockLayout,
  type DockNode,
  type DockSide,
  type DockStack,
  type DockTarget,
  insert,
  rects,
  remove,
  resize,
  type SashRect,
  type StackRect,
  stackOf,
  validate,
  windowsOf,
} from './layout'

export type {
  DockAxis,
  DockGeometry,
  DockLayout,
  DockNode,
  DockRects,
  DockSide,
  DockSplit,
  DockStack,
  DockTarget,
  SashRect,
  StackRect,
} from './layout'
export * as dockLayout from './layout'

export interface DockMessages {
  docked(title: string): string
  undocked(title: string): string
  resized(percent: number): string
  separator: string
}

export const dockMessages: DockMessages = {
  docked: (title) => `${title} docked`,
  undocked: (title) => `${title} undocked`,
  resized: (percent) => `Panel resized to ${percent}%`,
  separator: 'Resize panels',
}

export const dockMessagesRu: DockMessages = {
  docked: (title) => `${title}: закреплено`,
  undocked: (title) => `${title}: откреплено`,
  resized: (percent) => `Размер панели: ${percent}%`,
  separator: 'Изменить размер панелей',
}

export interface DockOptions {
  area?: (viewport: Size) => Bounds
  sash?: number
  edgeDrop?: number
  minSize?: Size
  keyboard?: boolean
  messages?: Partial<DockMessages>
}

export interface Dock {
  dock(id: string, target?: DockTarget): boolean
  undock(id: string): boolean
  layout(): DockLayout
  setLayout(layout: DockLayout): boolean
  destroy(): void
}

type Saved = Pick<WindowFlags, 'resizable' | 'minimizable' | 'snappable'> & {
  maxSize?: SerializedMaxSize | null
  aspectRatio?: number | null
}

interface DockState {
  root: DockNode | null
  flags: Record<string, Saved>
  workspace: number
}

type Followed = [state: DockState, out: string[], loose: string[]]

const KEY = 'dock'
const EMPTY: DockState = { root: null, flags: {}, workspace: 0 }
const LOCKED: WindowUpdate = {
  resizable: false,
  minimizable: false,
  snappable: false,
  maxSize: null,
  aspectRatio: null,
}
const SIDES: Record<string, DockSide> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'top',
  ArrowDown: 'bottom',
}
const CSS =
  '[data-wm-sash]{position:absolute;z-index:1;touch-action:none;box-sizing:border-box}' +
  '[data-wm-sash][aria-orientation=vertical]{cursor:ew-resize}' +
  '[data-wm-sash][aria-orientation=horizontal]{cursor:ns-resize}' +
  '[data-wm-sash]:hover,[data-wm-sash]:focus-visible,[data-wm-sash][data-wm-active]{background:var(--wm-accent,#4c8dff)}' +
  '[data-wm-sash]:focus-visible{outline:2px solid var(--wm-accent,#4c8dff);outline-offset:-2px}' +
  '[data-wm-desktop] [data-wm-window][data-wm-docked]{border-radius:0;box-shadow:none}'

function inside(box: Bounds, x: number, y: number): boolean {
  return x >= box.x && y >= box.y && x < box.x + box.width && y < box.y + box.height
}

function close(a: Bounds | null, b: Bounds): boolean {
  return (
    a !== null &&
    Math.abs(a.x - b.x) < 1e-6 &&
    Math.abs(a.y - b.y) < 1e-6 &&
    Math.abs(a.width - b.width) < 1e-6 &&
    Math.abs(a.height - b.height) < 1e-6
  )
}

function valid(value: unknown): value is DockState {
  const state = value as DockState | null
  return (
    typeof state?.flags === 'object' &&
    state.flags !== null &&
    Number.isInteger(state.workspace) &&
    validate({ root: state.root })
  )
}

function capture(win: WindowState): Saved {
  const json = (value: number) => (value < Number.POSITIVE_INFINITY ? value : null)
  return {
    resizable: win.resizable,
    minimizable: win.minimizable,
    snappable: win.snappable,
    maxSize: win.maxSize && { width: json(win.maxSize.width), height: json(win.maxSize.height) },
    aspectRatio: win.aspectRatio,
  }
}

function unlock({ maxSize, ...saved }: Saved): WindowUpdate {
  const open = (value: number | null) => value ?? Number.POSITIVE_INFINITY
  return {
    ...saved,
    maxSize: maxSize && { width: open(maxSize.width), height: open(maxSize.height) },
  }
}

function* stacks(node: DockNode | null): Generator<DockStack> {
  if (node?.kind === 'split') for (const child of node.children) yield* stacks(child)
  else if (node) yield node
}

export function createDock(desktop: DesktopController, options: DockOptions = {}): Dock {
  const { wm, element } = desktop
  const doc = element.ownerDocument
  const view = doc.defaultView as Window & typeof globalThis
  const coarse = view.matchMedia?.('(pointer: coarse)').matches === true
  const floor = options.minSize ?? { width: 0, height: 0 }
  const geometry: DockGeometry = {
    sash: options.sash ?? (coarse ? 12 : 6),
    minSize: floor,
    minOf: (stack) =>
      stack.windows.reduce((size, id) => {
        const min = wm.get(id)?.minSize ?? size
        return { width: Math.max(size.width, min.width), height: Math.max(size.height, min.height) }
      }, floor),
  }
  const edgeDrop = options.edgeDrop ?? 24
  const messages = { ...dockMessages, ...options.messages }
  const sashes = new Map<string, HTMLElement>()
  const painted = new WeakMap<HTMLElement, string>()
  const style = doc.createElement('style')
  style.dataset.wmDock = ''
  style.textContent = CSS
  element.append(style)
  let applying = 0
  let torn: { id: string; state: DockState; rect: Bounds } | null = null
  let sliding: { key: string; finish(cancelled: boolean): void } | null = null
  let floating = false
  let cache: [stored: unknown, state: DockState, ids: string[]] = [undefined, EMPTY, []]
  let seen: unknown[] = []
  let marked: string | undefined

  function read(): DockState {
    const stored = wm.getState().extensions[KEY]
    if (cache[0] !== stored) {
      const state = valid(stored) ? stored : EMPTY
      cache = [stored, state, windowsOf(state)]
    }
    return cache[1]
  }

  function areaOf(): Bounds {
    const { viewport } = wm.getState()
    return options.area?.(viewport) ?? { x: 0, y: 0, ...viewport }
  }

  function announce(text: string): void {
    const live = element.querySelector('[data-wm-announcer]')
    if (live) live.textContent = live.textContent === text ? text + String.fromCharCode(160) : text
  }

  function expected(state: DockState): Map<string, Bounds> {
    const out = new Map<string, Bounds>()
    const { viewport } = wm.getState()
    if (!state.root || viewport.width <= 0 || viewport.height <= 0) return out
    const placed = rects(state, areaOf(), geometry).stacks
    for (const stack of stacks(state.root)) {
      const { bounds } = placed.find((rect) => rect.id === stack.id) as StackRect
      const rect = {
        x: bounds.x / viewport.width,
        y: bounds.y / viewport.height,
        width: bounds.width / viewport.width,
        height: bounds.height / viewport.height,
      }
      for (const id of stack.windows) out.set(id, rect)
    }
    return out
  }

  function follow(state = read()): Followed {
    const { windows, groups, order } = wm.getState()
    const out: string[] = []
    const loose: string[] = []
    let layout: DockLayout = state
    const leave = (id: string, away?: boolean) => {
      out.push(id)
      if (away) loose.push(id)
      layout = remove(layout, id)
    }
    for (const id of windowsOf(state)) {
      const win = windows[id]
      if (!win?.snapRect || win.stage === 'normal') leave(id)
      else if (win.workspace !== state.workspace) leave(id, true)
    }
    for (const stack of stacks(layout.root)) {
      const free = stack.windows.filter((id) => (windows[id] as WindowState).groupId === null)
      if (free.length === stack.windows.length) {
        free.splice(free.indexOf(order.find((id) => free.includes(id)) as string), 1)
      }
      for (const id of free) leave(id, true)
    }
    for (const group of Object.values(groups)) {
      const owner = [group.activeId, ...group.members]
        .map((id) => stackOf(layout, id))
        .find(Boolean)
      if (!owner) continue
      for (const id of group.members) layout = insert(layout, id, { stackId: owner.id })
      layout = activate(layout, group.activeId)
    }
    return [{ ...state, root: layout.root }, out, loose]
  }

  function unpin(id: string): void {
    const win = wm.get(id) as WindowState
    wm.moveToWorkspace(id, wm.workspace())
    wm.restoreTo(id, win.restoreBounds ?? win.bounds)
    wm.moveToWorkspace(id, win.workspace)
  }

  function place(state: DockState, named?: boolean): void {
    for (const id of windowsOf(state)) wm.update(id, LOCKED)
    for (const stack of stacks(state.root)) {
      for (const id of stack.windows) {
        const groupId = (wm.get(id) as WindowState).groupId
        if (groupId === null) continue
        const members = wm.groupMembers(groupId)
        if (
          members.length !== stack.windows.length ||
          members.some((win) => !stack.windows.includes(win.id))
        ) {
          wm.ungroup(id)
        }
      }
    }
    for (const [id, rect] of expected(state)) {
      const win = wm.get(id) as WindowState
      if (
        win.stage === 'normal' ||
        !win.snapRect ||
        (win.stage === 'snapped' && !close(win.snapRect, rect))
      ) {
        wm.snapTo(id, rect)
      }
    }
    for (const stack of stacks(state.root)) {
      const fresh =
        stack.windows.length > 1 &&
        (wm.get(stack.windows[0] as string) as WindowState).groupId === null
      if (fresh) {
        wm.group([
          ...stack.windows.filter((id) => wm.get(id)?.stage !== 'minimized'),
          ...stack.windows,
        ])
      }
      if (fresh || named) wm.activateTab(stack.active)
    }
  }

  function settle([next, out, loose]: Followed, named?: boolean): void {
    const flags = { ...next.flags }
    for (const id of out) {
      const saved = flags[id]
      delete flags[id]
      if (saved && wm.get(id)) wm.update(id, unlock(saved))
    }
    for (const id of windowsOf(next)) {
      if (flags[id]?.aspectRatio === undefined) {
        flags[id] = { ...capture(wm.get(id) as WindowState), ...flags[id] }
      }
    }
    place(next, named)
    let shown: DockLayout = next
    for (const group of Object.values(wm.getState().groups)) shown = activate(shown, group.activeId)
    wm.setExtension(KEY, shown.root ? { ...next, root: shown.root, flags } : undefined)
    for (const id of loose) unpin(id)
    torn = null
  }

  function guard(run: () => void): void {
    applying += 1
    try {
      wm.batch(run)
    } finally {
      applying -= 1
    }
    render()
  }

  function quiet(run: () => void): void {
    wm.beginInteraction()
    try {
      guard(run)
    } finally {
      wm.abortInteraction()
    }
  }

  function dock(id: string, target: DockTarget = {}): boolean {
    const win = wm.get(id)
    const [base, out, loose] = follow()
    if (!win || (base.root && win.workspace !== base.workspace)) return false
    const next = insert(base, id, target)
    if (next.root === base.root) return false
    const workspace = base.root ? base.workspace : win.workspace
    guard(() => {
      if (win.stage === 'minimized') wm.restore(id)
      settle([{ ...base, root: next.root, workspace }, out, loose])
      wm.focus(id)
    })
    announce(messages.docked(win.title))
    return true
  }

  function undock(id: string): boolean {
    const [base, out, loose] = follow()
    const win = wm.get(id)
    if (!win || !stackOf(base, id)) return false
    guard(() => {
      wm.ungroup(id)
      settle([{ ...base, root: remove(base, id).root }, [...out, id], [...loose, id]])
    })
    announce(messages.undocked(win.title))
    return true
  }

  function setLayout(layout: DockLayout): boolean {
    if (!validate(layout)) return false
    const ids = windowsOf(layout)
    const [base, out, loose] = follow()
    const workspace = base.root ? base.workspace : wm.workspace()
    if (!ids.every((id) => wm.get(id)?.workspace === workspace)) return false
    const leaving = windowsOf(base).filter((id) => !ids.includes(id))
    guard(() => {
      for (const id of ids) if (wm.get(id)?.stage === 'minimized') wm.restore(id)
      settle(
        [
          { root: layout.root, flags: base.flags, workspace },
          [...out, ...leaving],
          [...loose.filter((id) => !ids.includes(id)), ...leaving],
        ],
        true,
      )
    })
    return true
  }

  function reconcile(): void {
    if (applying > 0) return
    if (torn) {
      const win = wm.get(torn.id)
      if (win?.stage === 'snapped' && close(win.snapRect, torn.rect)) {
        const restored = torn.state
        quiet(() => settle(follow(restored)))
        return
      }
    }
    const { extensions, viewport, workspace, windows, groups } = wm.getState()
    const state = read()
    const now: unknown[] = [extensions[KEY], viewport, workspace]
    for (const id of cache[2]) {
      const win = windows[id]
      now.push(win, win?.groupId && groups[win.groupId]?.activeId)
    }
    if (now.length === seen.length && now.every((value, i) => value === seen[i])) return
    seen = now
    const followed = follow(state)
    const [next, out] = followed
    if (next.root !== state.root || extensions[KEY] !== (state.root ? state : undefined)) {
      const stack = stackOf(state, out[0] as string)
      const rect =
        stack?.windows.every((id) => out.includes(id) && wm.get(id)?.stage === 'normal') &&
        expected(state).get(stack.windows[0] as string)
      quiet(() => settle(followed))
      if (stack && rect) torn = { id: stack.windows[0] as string, state, rect }
      for (const id of out) {
        const win = wm.get(id)
        if (win) announce(messages.undocked(win.title))
      }
      return
    }
    for (const [id, rect] of expected(state)) {
      const win = windows[id] as WindowState
      if (win.stage === 'snapped' && !close(win.snapRect, rect)) {
        quiet(() => place(state))
        return
      }
    }
    render()
  }

  function render(): void {
    const state = read()
    const visible = state.root !== null && state.workspace === wm.workspace()
    const placed = visible ? rects(state, areaOf(), geometry).sashes : []
    const keep = new Set<string>()
    for (const sash of placed) {
      const key = `${sash.splitId}:${sash.index}`
      keep.add(key)
      let node = sashes.get(key)
      if (!node) {
        node = createSash(key)
        sashes.set(key, node)
        element.append(node)
      }
      paint(node, sash)
    }
    for (const [key, node] of sashes) {
      if (keep.has(key)) continue
      if (sliding?.key === key) sliding.finish(false)
      node.remove()
      sashes.delete(key)
    }
    mark()
  }

  function mark(force?: unknown): void {
    const state = read()
    const docked = state.workspace === wm.workspace() ? cache[2] : []
    const key = docked.join('\n')
    if (key === marked && !force) return
    marked = key
    for (const node of element.querySelectorAll<HTMLElement>('[data-wm-window]')) {
      node.toggleAttribute('data-wm-docked', docked.includes(node.dataset.wmWindow as string))
    }
  }

  function paint(node: HTMLElement, sash: SashRect): void {
    const percent = (value: number) => String(Math.round((value / sash.span) * 100))
    const { x, y, width, height } = sash.bounds
    const key = `${sash.axis} ${percent(sash.value)} ${percent(sash.min)} ${percent(sash.max)} ${x} ${y} ${width} ${height}`
    if (painted.get(node) === key) return
    painted.set(node, key)
    node.setAttribute('aria-orientation', sash.axis === 'row' ? 'vertical' : 'horizontal')
    node.setAttribute('aria-valuenow', percent(sash.value))
    node.setAttribute('aria-valuemin', percent(sash.min))
    node.setAttribute('aria-valuemax', percent(sash.max))
    node.style.left = `${x}px`
    node.style.top = `${y}px`
    node.style.width = `${width}px`
    node.style.height = `${height}px`
  }

  function sashAt(key: string): SashRect | undefined {
    return rects(read(), areaOf(), geometry).sashes.find(
      (sash) => `${sash.splitId}:${sash.index}` === key,
    )
  }

  function shift(key: string, start: DockState, delta: number): void {
    if (!sashAt(key)) return
    const [splitId, index] = key.split(':') as [string, string]
    const next = resize(start, splitId, Number(index), delta, areaOf(), geometry)
    if (next.root !== read().root) guard(() => settle(follow({ ...start, root: next.root })))
  }

  function createSash(key: string): HTMLElement {
    const node = doc.createElement('div')
    node.dataset.wmSash = ''
    node.setAttribute('role', 'separator')
    node.setAttribute('tabindex', '0')
    node.setAttribute('aria-label', messages.separator)
    node.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || sliding) return
      try {
        node.setPointerCapture(event.pointerId)
      } catch {
        return
      }
      event.preventDefault()
      const start = read()
      const sash = sashAt(key) as SashRect
      const from = sash.axis === 'row' ? event.clientX : event.clientY
      const live = [
        ...element.querySelectorAll<HTMLElement>('[data-wm-docked]:not([data-wm-live])'),
      ]
      let raf = 0
      let delta = 0
      wm.beginInteraction()
      node.dataset.wmActive = ''
      for (const el of live) el.dataset.wmLive = ''
      const flush = () => {
        raf = 0
        shift(key, start, delta)
      }
      const move = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return
        delta = (sash.axis === 'row' ? moveEvent.clientX : moveEvent.clientY) - from
        if (raf === 0) raf = view.requestAnimationFrame(flush)
      }
      const up = (upEvent: PointerEvent) => {
        if (upEvent.pointerId === event.pointerId) finish(false)
      }
      const lost = () => finish(true)
      const onEscape = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== 'Escape') return
        keyEvent.preventDefault()
        finish(true)
      }
      const finish = (cancelled: boolean) => {
        sliding = null
        if (raf !== 0) view.cancelAnimationFrame(raf)
        node.removeEventListener('pointermove', move)
        node.removeEventListener('pointerup', up)
        node.removeEventListener('pointercancel', lost)
        node.removeEventListener('lostpointercapture', lost)
        doc.removeEventListener('keydown', onEscape, true)
        delete node.dataset.wmActive
        for (const el of live) delete el.dataset.wmLive
        if (cancelled) {
          if (read().root !== start.root) guard(() => settle(follow(start)))
          wm.abortInteraction()
        } else {
          if (raf !== 0) shift(key, start, delta)
          wm.endInteraction()
        }
      }
      sliding = { key, finish }
      node.addEventListener('pointermove', move)
      node.addEventListener('pointerup', up)
      node.addEventListener('pointercancel', lost)
      node.addEventListener('lostpointercapture', lost)
      doc.addEventListener('keydown', onEscape, true)
    })
    node.addEventListener('keydown', (event) => {
      const sash = sashAt(key)
      if (!sash || sliding) return
      const forward = sash.axis === 'row' ? 'ArrowRight' : 'ArrowDown'
      const back = sash.axis === 'row' ? 'ArrowLeft' : 'ArrowUp'
      const step = event.shiftKey ? 1 : 16
      const delta =
        event.key === forward
          ? step
          : event.key === back
            ? -step
            : event.key === 'Home'
              ? sash.min - sash.value
              : event.key === 'End'
                ? sash.max - sash.value
                : null
      if (delta === null) return
      event.preventDefault()
      const before = read().root
      shift(key, read(), delta)
      if (read().root !== before) {
        announce(messages.resized(Number(node.getAttribute('aria-valuenow'))))
      }
    })
    return node
  }

  function targetAt(x: number, y: number): DockTarget | null {
    const area = areaOf()
    if (!inside(area, x, y)) return null
    if (x - area.x < edgeDrop) return { side: 'left' }
    if (area.x + area.width - x <= edgeDrop) return { side: 'right' }
    if (y - area.y < edgeDrop) return { side: 'top' }
    if (area.y + area.height - y <= edgeDrop) return { side: 'bottom' }
    const root = read().root
    if (!root) return null
    const hit = rects({ root }, area, geometry).stacks.find((stack) => inside(stack.bounds, x, y))
    if (!hit) return null
    const { bounds } = hit
    const rx = (x - bounds.x) / bounds.width
    const ry = (y - bounds.y) / bounds.height
    const near: Array<[DockSide, number]> = [
      ['left', rx],
      ['right', 1 - rx],
      ['top', ry],
      ['bottom', 1 - ry],
    ]
    const [side, distance] = near.reduce((best, entry) => (entry[1] < best[1] ? entry : best))
    return { stackId: hit.id, side: distance < 0.25 ? side : 'center' }
  }

  function hit(_x: number, _y: number, id: string, local: Point): DropHit | null {
    const win = wm.get(id)
    const state = read()
    if (floating || win?.layer !== 'normal') return null
    if (state.root && win.workspace !== state.workspace) return null
    const target = targetAt(local.x, local.y)
    if (!target) return null
    const next = insert(state, id, target)
    const stack = stackOf(next, id) as DockStack
    const placed = rects(next, areaOf(), geometry).stacks.find((rect) => rect.id === stack.id)
    return { preview: (placed as StackRect).bounds, commit: () => void dock(id, target) }
  }

  function onKeydown(event: KeyboardEvent): void {
    const side = SIDES[event.key]
    if (!side || !event.shiftKey || !event.altKey || !(event.ctrlKey || event.metaKey)) return
    const focused = wm.getState().focusedId
    if (!focused || stackOf(read(), focused)) return
    event.preventDefault()
    event.stopPropagation()
    dock(focused, { side })
  }

  const track = (event: PointerEvent) => {
    floating = event.shiftKey
  }
  element.addEventListener('pointermove', track, true)
  const watcher = new MutationObserver(mark)
  watcher.observe(element, { subtree: true, attributeFilter: ['data-wm-window'] })
  const stops = [
    wm.subscribe(reconcile),
    desktop.addDropTarget(hit),
    () => watcher.disconnect(),
    () => element.removeEventListener('pointermove', track, true),
  ]
  if (options.keyboard !== false) {
    element.addEventListener('keydown', onKeydown, true)
    stops.push(() => element.removeEventListener('keydown', onKeydown, true))
  }
  quiet(() => settle(follow()))

  return {
    dock,
    undock,
    layout: () => ({ root: read().root }),
    setLayout,
    destroy() {
      sliding?.finish(true)
      for (const stop of stops) stop()
      const { flags } = read()
      wm.beginInteraction()
      wm.batch(() => {
        for (const id of cache[2]) {
          const saved = flags[id]
          if (saved && wm.get(id)) wm.update(id, unlock(saved))
        }
      })
      wm.abortInteraction()
      for (const node of sashes.values()) node.remove()
      sashes.clear()
      style.remove()
      for (const node of element.querySelectorAll('[data-wm-docked]')) {
        node.removeAttribute('data-wm-docked')
      }
    },
  }
}
