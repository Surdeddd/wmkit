import { zoneBounds } from '../../core/geometry'
import type { Bounds, SnapZone, WindowState } from '../../core/types'
import { nonced } from '../../dom/nonce'
import { type DesktopController, lostRelease, muteMenu, regained } from '../../dom/shared'
import { type LayoutMessages, layoutMessages } from './messages'

export interface Seam {
  key: string
  vertical: boolean
  at: number
  from: number
  to: number
  before: string[]
  after: string[]
}

export interface SeamOptions {
  size?: number
  step?: number
  messages?: Partial<LayoutMessages>
}

export interface SnapLink {
  destroy(): void
}

interface Item {
  id: string
  rect: Bounds
}

interface Start {
  rect: Bounds
  zone: SnapZone | null
  given: Bounds | null
}

const EPS = 1e-6
const CSS =
  '[data-wm-seam]{position:absolute;touch-action:none;box-sizing:border-box;background:transparent}' +
  '[data-wm-seam][aria-orientation=vertical]{cursor:ew-resize}' +
  '[data-wm-seam][aria-orientation=horizontal]{cursor:ns-resize}' +
  '[data-wm-seam]:hover,[data-wm-seam]:focus-visible,[data-wm-seam][data-wm-active]{background:var(--wm-accent,#4c8dff)}' +
  '[data-wm-seam]:focus-visible{outline:2px solid var(--wm-accent,#4c8dff);outline-offset:-2px}' +
  '@media (forced-colors:active){[data-wm-seam]:hover,[data-wm-seam]:focus-visible,[data-wm-seam][data-wm-active]{background:Highlight}}'

const styled = new WeakMap<Document, { node: HTMLStyleElement; users: number }>()

export function findSeams(items: readonly Item[]): Seam[] {
  const seams: Seam[] = []
  for (const vertical of [true, false]) {
    const near = (item: Item) => (vertical ? item.rect.x : item.rect.y)
    const far = (item: Item) => near(item) + (vertical ? item.rect.width : item.rect.height)
    const low = (item: Item) => (vertical ? item.rect.y : item.rect.x)
    const high = (item: Item) => low(item) + (vertical ? item.rect.height : item.rect.width)
    const lines = [...new Set(items.map((item) => Math.round(far(item) / EPS)))]
    for (const line of lines.sort((a, b) => a - b)) {
      const at = line * EPS
      const sides = items
        .filter((item) => Math.abs(far(item) - at) < EPS || Math.abs(near(item) - at) < EPS)
        .sort((a, b) => low(a) - low(b))
      let run: Item[] = []
      let reach = Number.NEGATIVE_INFINITY
      const close = () => {
        const edge = run.find((item) => Math.abs(far(item) - at) < EPS)
        const before = run.filter((item) => Math.abs(far(item) - at) < EPS).map((item) => item.id)
        const after = run.filter((item) => Math.abs(near(item) - at) < EPS).map((item) => item.id)
        if (edge && after.length > 0) {
          seams.push({
            key: `${vertical ? 'v' : 'h'}:${[...before, '', ...after].join('\n')}`,
            vertical,
            at: far(edge),
            from: Math.min(...run.map(low)),
            to: reach,
            before,
            after,
          })
        }
        run = []
      }
      for (const item of sides) {
        if (low(item) > reach - EPS) close()
        run.push(item)
        reach = Math.max(run.length === 1 ? Number.NEGATIVE_INFINITY : reach, high(item))
      }
      close()
    }
  }
  return seams
}

export function linkSnapped(desktop: DesktopController, options: SeamOptions = {}): SnapLink {
  const { wm, element: host } = desktop
  const doc = host.ownerDocument
  const view = doc.defaultView as Window & typeof globalThis
  const coarse = view.matchMedia?.('(pointer: coarse)').matches === true
  const size = options.size ?? (coarse ? 16 : 8)
  const step = options.step ?? 16
  const label = { ...layoutMessages, ...options.messages }.seam
  const nodes = new Map<string, HTMLElement>()
  const shown = new Map<HTMLElement, Seam>()
  let alive = true
  let active: { node: HTMLElement; finish(cancelled: boolean): void } | null = null

  let sheet = styled.get(doc)
  if (!sheet) {
    sheet = { node: nonced(doc.createElement('style')), users: 0 }
    sheet.node.dataset.wmSeamStyle = ''
    sheet.node.textContent = CSS
    doc.head.append(sheet.node)
    styled.set(doc, sheet)
  }
  sheet.users += 1

  const elementOf = (id: string): HTMLElement | undefined =>
    [...host.querySelectorAll<HTMLElement>('[data-wm-window]')].find(
      (node) => node.dataset.wmWindow === id,
    )

  function rectOf(win: WindowState): Bounds {
    const { width, height } = wm.getState().viewport
    if (win.snapRect) return win.snapRect
    const zone = zoneBounds(win.snapZone as SnapZone, { width, height })
    return {
      x: zone.x / width,
      y: zone.y / height,
      width: zone.width / width,
      height: zone.height / height,
    }
  }

  function items(): Item[] {
    const state = wm.getState()
    if (!(state.viewport.width > 0 && state.viewport.height > 0)) return []
    const found: Item[] = []
    for (const id of state.order) {
      const win = state.windows[id] as WindowState
      if (win.stage !== 'snapped' || win.workspace !== state.workspace || !win.resizable) continue
      if (win.groupId !== null && state.groups[win.groupId]?.activeId !== id) continue
      found.push({ id, rect: rectOf(win) })
    }
    return found
  }

  function range(seam: Seam): [low: number, high: number] {
    const state = wm.getState()
    const span = seam.vertical ? state.viewport.width : state.viewport.height
    const side = seam.vertical ? 'width' : 'height'
    let low = 0
    let high = 1
    const bound = (id: string, before: boolean) => {
      const win = state.windows[id] as WindowState
      const rect = rectOf(win)
      const edge = before
        ? seam.vertical
          ? rect.x
          : rect.y
        : (seam.vertical ? rect.x : rect.y) + rect[side]
      const members = win.groupId === null ? [win] : wm.groupMembers(win.groupId)
      const least = Math.max(1, ...members.map((member) => member.minSize[side])) / span
      const most = Math.min(...members.map((member) => member.maxSize?.[side] ?? Infinity)) / span
      if (before) {
        low = Math.max(low, edge + least)
        high = Math.min(high, edge + most)
      } else {
        high = Math.min(high, edge - least)
        low = Math.max(low, edge - most)
      }
    }
    for (const id of seam.before) bound(id, true)
    for (const id of seam.after) bound(id, false)
    return low > high ? [seam.at, seam.at] : [low, high]
  }

  function move(seam: Seam, starts: Map<string, Start>, to: number): void {
    wm.batch(() => {
      for (const id of seam.before) {
        const { rect } = starts.get(id) as Start
        wm.snapTo(
          id,
          seam.vertical ? { ...rect, width: to - rect.x } : { ...rect, height: to - rect.y },
        )
      }
      for (const id of seam.after) {
        const { rect } = starts.get(id) as Start
        wm.snapTo(
          id,
          seam.vertical
            ? { ...rect, x: to, width: rect.x + rect.width - to }
            : { ...rect, y: to, height: rect.y + rect.height - to },
        )
      }
    })
  }

  function startsOf(seam: Seam): Map<string, Start> {
    const starts = new Map<string, Start>()
    for (const id of [...seam.before, ...seam.after]) {
      const win = wm.get(id) as WindowState
      starts.set(id, { rect: rectOf(win), zone: win.snapZone, given: win.snapRect })
    }
    return starts
  }

  function paint(node: HTMLElement, seam: Seam): void {
    const { width, height } = wm.getState().viewport
    const [low, high] = range(seam)
    const along = seam.vertical ? width : height
    const across = seam.vertical ? height : width
    const begin = Math.round(seam.from * across)
    const start = `${Math.round(seam.at * along) - size / 2}px`
    const from = `${begin}px`
    const length = `${Math.round(seam.to * across) - begin}px`
    node.style.left = seam.vertical ? start : from
    node.style.top = seam.vertical ? from : start
    node.style.width = seam.vertical ? `${size}px` : length
    node.style.height = seam.vertical ? length : `${size}px`
    const layers = [...seam.before, ...seam.after].map(
      (id) => Number(elementOf(id)?.style.zIndex) || 0,
    )
    node.style.zIndex = String(Math.max(...layers) + 1)
    node.setAttribute('aria-orientation', seam.vertical ? 'vertical' : 'horizontal')
    node.setAttribute('aria-valuenow', String(Math.round(seam.at * 100)))
    node.setAttribute('aria-valuemin', String(Math.round(low * 100)))
    node.setAttribute('aria-valuemax', String(Math.round(high * 100)))
  }

  function render(): void {
    const kept = new Set<string>()
    for (const seam of findSeams(items())) {
      let node = nodes.get(seam.key)
      if (!node) {
        node = doc.createElement('div')
        node.dataset.wmSeam = ''
        node.tabIndex = 0
        node.setAttribute('role', 'separator')
        node.setAttribute('aria-label', label)
        nodes.set(seam.key, node)
        host.append(node)
      }
      kept.add(seam.key)
      shown.set(node, seam)
      paint(node, seam)
    }
    for (const [key, node] of nodes) {
      if (kept.has(key) || active?.node === node) continue
      nodes.delete(key)
      shown.delete(node)
      node.remove()
    }
  }

  function onDown(event: PointerEvent): void {
    const node = event.target as HTMLElement
    const seam = shown.get(node)
    if (!seam || event.button !== 0 || active) return
    event.preventDefault()
    event.stopPropagation()
    try {
      node.setPointerCapture(event.pointerId)
    } catch {
      return
    }
    const starts = startsOf(seam)
    const [low, high] = range(seam)
    const frame = host.getBoundingClientRect()
    const scale = frame.width / host.offsetWidth || 1
    const { width, height } = wm.getState().viewport
    const live = [...starts.keys()].map(elementOf)
    const point = (at: PointerEvent) =>
      seam.vertical
        ? (at.clientX - frame.left) / scale / width
        : (at.clientY - frame.top) / scale / height
    const grab = point(event) - seam.at
    let last = seam.at
    let moved = false

    const onMove = (at: PointerEvent) => {
      const to = Math.min(high, Math.max(low, point(at) - grab))
      if (at.pointerId !== event.pointerId || to === last) return
      last = to
      moved = true
      move(seam, starts, to)
    }
    const onUp = (at: PointerEvent) => {
      if (at.pointerId === event.pointerId) finish(false)
    }
    const onLost = (at: PointerEvent) => {
      if (at.pointerId === event.pointerId && !regained(at, node)) finish(true)
    }
    const onStray = (at: PointerEvent) => {
      if (lostRelease(at, event)) finish(false)
    }
    const onKey = (at: KeyboardEvent) => {
      if (at.key !== 'Escape') return
      at.preventDefault()
      at.stopPropagation()
      finish(true)
    }
    const finish = (cancelled: boolean) => {
      active = null
      doc.removeEventListener('pointerdown', onStray, true)
      doc.removeEventListener('pointermove', onStray, true)
      doc.removeEventListener('pointermove', onMove, true)
      doc.removeEventListener('pointerup', onUp, true)
      doc.removeEventListener('pointercancel', onLost, true)
      doc.removeEventListener('lostpointercapture', onLost, true)
      doc.removeEventListener('keydown', onKey, true)
      doc.removeEventListener('contextmenu', muteMenu, true)
      if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId)
      delete node.dataset.wmActive
      for (const element of live) delete element?.dataset.wmLive
      if (cancelled && moved) {
        wm.batch(() => {
          for (const [id, start] of starts) {
            if (start.given) wm.snapTo(id, start.given)
            else wm.snap(id, start.zone as SnapZone)
          }
        })
      }
      if (cancelled) wm.abortInteraction()
      else wm.endInteraction()
      render()
    }

    active = { node, finish }
    node.dataset.wmActive = ''
    for (const element of live) if (element) element.dataset.wmLive = ''
    wm.beginInteraction()
    doc.addEventListener('pointerdown', onStray, true)
    doc.addEventListener('pointermove', onStray, true)
    doc.addEventListener('pointermove', onMove, true)
    doc.addEventListener('pointerup', onUp, true)
    doc.addEventListener('pointercancel', onLost, true)
    doc.addEventListener('lostpointercapture', onLost, true)
    doc.addEventListener('keydown', onKey, true)
    doc.addEventListener('contextmenu', muteMenu, true)
  }

  function onKeydown(event: KeyboardEvent): void {
    const seam = shown.get(event.target as HTMLElement)
    if (!seam || active || event.altKey || event.ctrlKey || event.metaKey) return
    const span = seam.vertical ? wm.getState().viewport.width : wm.getState().viewport.height
    const [low, high] = range(seam)
    const back = seam.vertical ? 'ArrowLeft' : 'ArrowUp'
    const forth = seam.vertical ? 'ArrowRight' : 'ArrowDown'
    let to: number
    if (event.key === back) to = seam.at - step / span
    else if (event.key === forth) to = seam.at + step / span
    else if (event.key === 'Home') to = low
    else if (event.key === 'End') to = high
    else return
    event.preventDefault()
    event.stopPropagation()
    const key = seam.key
    move(seam, startsOf(seam), Math.min(high, Math.max(low, to)))
    nodes.get(key)?.focus()
  }

  host.addEventListener('pointerdown', onDown)
  host.addEventListener('keydown', onKeydown)
  const stop = wm.subscribe(render)
  render()

  return {
    destroy() {
      if (!alive) return
      active?.finish(true)
      alive = false
      stop()
      host.removeEventListener('pointerdown', onDown)
      host.removeEventListener('keydown', onKeydown)
      for (const node of nodes.values()) node.remove()
      nodes.clear()
      shown.clear()
      const shared = styled.get(doc)
      if (shared && --shared.users === 0) {
        shared.node.remove()
        styled.delete(doc)
      }
    },
  }
}
