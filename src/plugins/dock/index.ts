import type { Bounds, Size, WindowFlags, WindowState } from '../../core/types'
import type { DesktopController, DropHit } from '../../dom/shared'
import {
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

type Saved = Pick<WindowFlags, 'resizable' | 'minimizable' | 'snappable'>

interface DockState {
  root: DockNode | null
  flags: Record<string, Saved>
  workspace: number
}

const KEY = 'dock'
const LOCKED: Saved = { resizable: false, minimizable: false, snappable: false }
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
  const style = doc.createElement('style')
  style.dataset.wmDock = ''
  style.textContent = CSS
  element.append(style)
  let applying = 0
  let torn: { id: string; state: DockState; rect: Bounds } | null = null
  let sliding: { key: string; finish(cancelled: boolean): void } | null = null
  let floating = false

  function read(): DockState {
    const stored = wm.getState().extensions[KEY] as DockState | undefined
    return stored ?? { root: null, flags: {}, workspace: wm.workspace() }
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
    const layout = { root: state.root }
    for (const { id, bounds } of rects(layout, areaOf(), geometry).stacks) {
      const rect = {
        x: bounds.x / viewport.width,
        y: bounds.y / viewport.height,
        width: bounds.width / viewport.width,
        height: bounds.height / viewport.height,
      }
      const stack = [...stacks(state.root)].find((node) => node.id === id) as DockStack
      for (const windowId of stack.windows) out.set(windowId, rect)
    }
    return out
  }

  function* stacks(node: DockNode): Generator<DockStack> {
    if (node.kind === 'stack') yield node
    else for (const child of node.children) yield* stacks(child)
  }

  function place(state: DockState): void {
    for (const [id, rect] of expected(state)) {
      const win = wm.get(id) as WindowState
      if (win.stage === 'maximized' || win.stage === 'minimized') continue
      if (win.stage !== 'snapped' || !close(win.snapRect, rect)) wm.snapTo(id, rect)
    }
    if (state.root) {
      for (const stack of stacks(state.root)) {
        const [first] = stack.windows as [string]
        const groupId = (wm.get(first) as WindowState).groupId
        if (stack.windows.length === 1) {
          if (groupId !== null) wm.ungroup(first)
          continue
        }
        const members = groupId === null ? [] : wm.groupMembers(groupId).map((win) => win.id)
        const same =
          members.length === stack.windows.length &&
          stack.windows.every((id) => members.includes(id))
        if (!same) {
          for (const id of stack.windows) if ((wm.get(id) as WindowState).groupId) wm.ungroup(id)
          wm.group(stack.windows)
        }
        wm.activateTab(stack.active)
      }
    }
  }

  function apply(state: DockState): void {
    wm.setExtension(KEY, state.root ? state : undefined)
    place(state)
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
    if (sliding || element.querySelector('[data-wm-dragging],[data-wm-resizing]')) {
      guard(run)
      return
    }
    wm.beginInteraction()
    try {
      guard(run)
    } finally {
      wm.abortInteraction()
    }
  }

  function release(state: DockState, ids: readonly string[]): DockState {
    let layout: DockLayout = { root: state.root }
    const flags = { ...state.flags }
    for (const id of ids) {
      layout = remove(layout, id)
      const saved = flags[id]
      delete flags[id]
      const win = wm.get(id)
      if (!win) continue
      if (saved) wm.update(id, saved)
      if (win.groupId !== null) wm.ungroup(id)
    }
    return { ...state, root: layout.root, flags }
  }

  function dock(id: string, target: DockTarget = {}): boolean {
    const win = wm.get(id)
    const state = read()
    if (!win || (state.root && win.workspace !== state.workspace)) return false
    const next = insert({ root: state.root }, id, target)
    if (next.root === state.root) return false
    const flags = state.flags[id]
      ? state.flags
      : {
          ...state.flags,
          [id]: {
            resizable: win.resizable,
            minimizable: win.minimizable,
            snappable: win.snappable,
          },
        }
    guard(() => {
      if (win.stage === 'minimized') wm.restore(id)
      wm.update(id, LOCKED)
      apply({ root: next.root, flags, workspace: state.root ? state.workspace : win.workspace })
      wm.focus(id)
    })
    announce(messages.docked(win.title))
    return true
  }

  function undock(id: string): boolean {
    const state = read()
    const win = wm.get(id)
    if (!win || !stackOf({ root: state.root }, id)) return false
    guard(() => {
      apply(release(state, [id]))
      wm.restoreTo(id, win.restoreBounds ?? win.bounds)
    })
    announce(messages.undocked(win.title))
    return true
  }

  function setLayout(layout: DockLayout): boolean {
    if (!validate(layout)) return false
    const ids = windowsOf(layout)
    const state = read()
    const workspace = state.root ? state.workspace : wm.workspace()
    if (!ids.every((id) => wm.get(id)?.workspace === workspace)) return false
    guard(() => {
      const leaving = windowsOf({ root: state.root }).filter((id) => !ids.includes(id))
      const flags = { ...release(state, leaving).flags }
      for (const id of ids) {
        const win = wm.get(id) as WindowState
        flags[id] ??= {
          resizable: win.resizable,
          minimizable: win.minimizable,
          snappable: win.snappable,
        }
        if (win.stage === 'minimized') wm.restore(id)
        wm.update(id, LOCKED)
      }
      apply({ root: layout.root, flags, workspace })
      for (const id of leaving) {
        const win = wm.get(id) as WindowState
        wm.restoreTo(id, win.restoreBounds ?? win.bounds)
      }
    })
    return true
  }

  function reconcile(): void {
    if (applying > 0) return
    const state = read()
    if (torn) {
      const win = wm.get(torn.id)
      if (win?.stage === 'snapped' && close(win.snapRect, torn.rect)) {
        const restored = torn.state
        quiet(() => {
          wm.update(win.id, LOCKED)
          apply(restored)
        })
        return
      }
    }
    const gone = windowsOf({ root: state.root }).filter((id) => {
      const win = wm.get(id)
      return !win || win.stage === 'normal' || win.workspace !== state.workspace
    })
    if (gone.length > 0) {
      const single = gone.length === 1 ? wm.get(gone[0] as string) : undefined
      const rect = single?.stage === 'normal' ? expected(state).get(single.id) : undefined
      quiet(() => apply(release(state, gone)))
      if (single && rect) torn = { id: single.id, state, rect }
      for (const id of gone) {
        const win = wm.get(id)
        if (win) announce(messages.undocked(win.title))
      }
      return
    }
    for (const [id, rect] of expected(state)) {
      const win = wm.get(id) as WindowState
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
    const placed = visible ? rects({ root: state.root }, areaOf(), geometry).sashes : []
    const seen = new Set<string>()
    for (const sash of placed) {
      const key = `${sash.splitId}:${sash.index}`
      seen.add(key)
      let node = sashes.get(key)
      if (!node) {
        node = createSash(key)
        sashes.set(key, node)
        element.append(node)
      }
      paint(node, sash)
    }
    for (const [key, node] of sashes) {
      if (seen.has(key)) continue
      if (sliding?.key === key) sliding.finish(false)
      node.remove()
      sashes.delete(key)
    }
    mark()
  }

  function mark(): void {
    const state = read()
    const docked = new Set(
      state.workspace === wm.workspace() ? windowsOf({ root: state.root }) : [],
    )
    for (const node of element.querySelectorAll<HTMLElement>('[data-wm-window]')) {
      node.toggleAttribute('data-wm-docked', docked.has(node.dataset.wmWindow as string))
    }
  }

  function paint(node: HTMLElement, sash: SashRect): void {
    const percent = (value: number) => String(Math.round((value / sash.span) * 100))
    node.setAttribute('aria-orientation', sash.axis === 'row' ? 'vertical' : 'horizontal')
    node.setAttribute('aria-valuenow', percent(sash.value))
    node.setAttribute('aria-valuemin', percent(sash.min))
    node.setAttribute('aria-valuemax', percent(sash.max))
    node.style.left = `${sash.bounds.x}px`
    node.style.top = `${sash.bounds.y}px`
    node.style.width = `${sash.bounds.width}px`
    node.style.height = `${sash.bounds.height}px`
  }

  function sashAt(key: string): SashRect | undefined {
    return rects({ root: read().root }, areaOf(), geometry).sashes.find(
      (sash) => `${sash.splitId}:${sash.index}` === key,
    )
  }

  function shift(key: string, start: DockState, delta: number): void {
    if (!sashAt(key)) return
    const [splitId, index] = key.split(':') as [string, string]
    const next = resize({ root: start.root }, splitId, Number(index), delta, areaOf(), geometry)
    if (next.root !== read().root) guard(() => apply({ ...start, root: next.root }))
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
      let raf = 0
      let delta = 0
      wm.beginInteraction()
      node.dataset.wmActive = ''
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
        if (cancelled) {
          if (read().root !== start.root) guard(() => apply(start))
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

  function hit(clientX: number, clientY: number, id: string): DropHit | null {
    const win = wm.get(id)
    const state = read()
    if (floating || win?.layer !== 'normal') return null
    if (state.root && win.workspace !== state.workspace) return null
    const box = element.getBoundingClientRect()
    const target = targetAt(clientX - box.left, clientY - box.top)
    if (!target) return null
    const next = insert({ root: state.root }, id, target)
    const stack = stackOf(next, id) as DockStack
    const placed = rects(next, areaOf(), geometry).stacks.find((rect) => rect.id === stack.id)
    return { preview: (placed as { bounds: Bounds }).bounds, commit: () => void dock(id, target) }
  }

  function onKeydown(event: KeyboardEvent): void {
    const side = SIDES[event.key]
    if (!side || !event.shiftKey || !event.altKey || !(event.ctrlKey || event.metaKey)) return
    const focused = wm.getState().focusedId
    if (!focused || stackOf({ root: read().root }, focused)) return
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
  render()

  return {
    dock,
    undock,
    layout: () => ({ root: read().root }),
    setLayout,
    destroy() {
      sliding?.finish(true)
      for (const stop of stops) stop()
      for (const node of sashes.values()) node.remove()
      sashes.clear()
      style.remove()
      for (const node of element.querySelectorAll('[data-wm-docked]')) {
        node.removeAttribute('data-wm-docked')
      }
    },
  }
}
