import type { Bounds, WindowState } from '../../core/types'
import { prefersReducedMotion } from '../../dom/animate'
import type { DesktopController } from '../../dom/shared'
import { type SwitcherMessages, switcherMessages } from './messages'

export type { SwitcherMessages } from './messages'
export { switcherMessages, switcherMessagesRu } from './messages'

export interface SwitcherShortcut {
  code?: string
  modifier?: 'alt' | 'ctrl' | 'meta'
}

export interface SwitcherOptions {
  shortcut?: false | SwitcherShortcut
  messages?: Partial<SwitcherMessages>
  animation?: number | false
  gap?: number
}

export interface Switcher {
  element: HTMLElement
  open(): boolean
  overview(): boolean
  close(): void
  destroy(): void
}

type Mode = 'list' | 'overview'

const CSS =
  '[data-wm-switcher]{position:absolute;z-index:2147483646;box-sizing:border-box;outline:none}' +
  '[data-wm-switcher][hidden]{display:none}' +
  '[data-wm-switcher=list]{left:50%;top:50%;transform:translate(-50%,-50%);min-width:200px;max-width:min(480px,90%);max-height:80%;overflow:auto;padding:8px;border-radius:var(--wm-radius,10px);border:1px solid var(--wm-border,rgba(128,128,128,.4));background:var(--wm-bg-solid,var(--wm-bg,#1b1d24));color:var(--wm-text,#e7e9f0);box-shadow:var(--wm-shadow,0 12px 32px rgba(0,0,0,.35));font:14px/1.4 system-ui,sans-serif}' +
  '[data-wm-switcher=list] [role=option]{padding:6px 12px;border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}' +
  '[data-wm-switcher=list] [aria-selected=true]{outline:2px solid var(--wm-accent,#4c8dff);outline-offset:-2px}' +
  '[data-wm-switcher=overview]{left:0;top:0;width:100%;height:100%}' +
  '[data-wm-switcher=overview] [role=option]{position:absolute;box-sizing:border-box;border-radius:var(--wm-radius,10px);color:transparent;overflow:hidden;cursor:pointer}' +
  '[data-wm-switcher=overview] [aria-selected=true]{outline:3px solid var(--wm-accent,#4c8dff);outline-offset:3px}' +
  '@media (forced-colors:active){[data-wm-switcher] [aria-selected=true]{outline-color:Highlight}}'

const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'
const MODIFIERS = {
  alt: ['altKey', 'Alt'],
  ctrl: ['ctrlKey', 'Control'],
  meta: ['metaKey', 'Meta'],
} as const
const styled = new WeakMap<Document, { node: HTMLStyleElement; users: number }>()
let instances = 0

export function createSwitcher(
  desktop: DesktopController,
  options: SwitcherOptions = {},
): Switcher {
  const { wm, element: host } = desktop
  const doc = host.ownerDocument
  const view = doc.defaultView as Window & typeof globalThis
  const messages: SwitcherMessages = { ...switcherMessages, ...options.messages }
  const shortcut = options.shortcut === false ? null : (options.shortcut ?? {})
  const code = shortcut?.code ?? 'Backquote'
  const [held, released] = MODIFIERS[shortcut?.modifier ?? 'alt']
  const duration = options.animation === false ? 0 : (options.animation ?? 220)
  const gap = options.gap ?? 24
  const prefix = `wmkit-switch-${++instances}`
  let alive = true
  let mode: Mode | null = null
  let quick = false
  let shown: WindowState[] = []
  let at = 0
  let columns = 1
  let before: HTMLElement | null = null
  let laid: HTMLElement[] = []

  let sheet = styled.get(doc)
  if (!sheet) {
    sheet = { node: doc.createElement('style'), users: 0 }
    sheet.node.dataset.wmSwitcherStyle = ''
    sheet.node.textContent = CSS
    doc.head.append(sheet.node)
    styled.set(doc, sheet)
  }
  sheet.users += 1

  const panel = doc.createElement('div')
  panel.hidden = true
  panel.tabIndex = -1
  panel.setAttribute('role', 'listbox')
  host.append(panel)

  const elementOf = (id: string): HTMLElement | undefined =>
    [...host.querySelectorAll<HTMLElement>('[data-wm-window]')].find(
      (node) => node.dataset.wmWindow === id,
    )

  function candidates(wanted: Mode): WindowState[] {
    const state = wm.getState()
    const visible = state.order
      .map((id) => state.windows[id] as WindowState)
      .filter(
        (win) =>
          win.workspace === state.workspace &&
          (win.groupId === null || state.groups[win.groupId]?.activeId === win.id) &&
          (wanted === 'list' || win.stage !== 'minimized'),
      )
    const modal = visible.some((win) => win.layer === 'modal' && win.stage !== 'minimized')
    const open = visible.filter((win) => !modal || win.layer === 'modal')
    return wanted === 'list'
      ? open.reverse()
      : open.sort((left, right) => left.openedSeq - right.openedSeq)
  }

  function cellOf(index: number, total: number, win: WindowState): Bounds & { scale: number } {
    const { width, height } = wm.getState().viewport
    const rows = Math.ceil(total / columns)
    const room = {
      width: Math.max(1, (width - gap * (columns + 1)) / columns),
      height: Math.max(1, (height - gap * (rows + 1)) / rows),
    }
    const scale = Math.min(1, room.width / win.bounds.width, room.height / win.bounds.height)
    const size = { width: win.bounds.width * scale, height: win.bounds.height * scale }
    return {
      x: gap + (index % columns) * (room.width + gap) + (room.width - size.width) / 2,
      y: gap + Math.floor(index / columns) * (room.height + gap) + (room.height - size.height) / 2,
      ...size,
      scale,
    }
  }

  function spread(animate: boolean): void {
    const next: HTMLElement[] = []
    shown.forEach((win, index) => {
      const node = elementOf(win.id)
      if (!node) return
      const cell = cellOf(index, shown.length, win)
      const origin = view.getComputedStyle(node).transformOrigin.split(' ').map(Number.parseFloat)
      const pivot = {
        x: Number.isFinite(origin[0]) ? (origin[0] as number) : win.bounds.width / 2,
        y: Number.isFinite(origin[1]) ? (origin[1] as number) : win.bounds.height / 2,
      }
      const move = `${cell.x - cell.scale * win.bounds.x - (1 - cell.scale) * pivot.x}px ${
        cell.y - cell.scale * win.bounds.y - (1 - cell.scale) * pivot.y
      }px`
      const size = String(cell.scale)
      if (animate && !laid.includes(node)) glide(node, ['0px 0px', '1'], [move, size])
      node.style.translate = move
      node.style.scale = size
      node.dataset.wmOverview = ''
      next.push(node)
    })
    for (const node of laid) if (!next.includes(node)) gather(node, false)
    laid = next
  }

  function gather(node: HTMLElement, animate: boolean): void {
    if (animate) glide(node, [node.style.translate, node.style.scale], ['0px 0px', '1'])
    node.style.translate = ''
    node.style.scale = ''
    delete node.dataset.wmOverview
  }

  function glide(node: HTMLElement, from: string[], to: string[]): void {
    if (duration <= 0 || typeof node.animate !== 'function' || prefersReducedMotion(view)) return
    node.animate(
      [
        { translate: from[0], scale: from[1] },
        { translate: to[0], scale: to[1] },
      ],
      { duration, easing: EASING },
    )
  }

  function paint(): void {
    const options = [...panel.children] as HTMLElement[]
    shown.forEach((win, index) => {
      let option = options[index]
      if (!option) {
        option = doc.createElement('div')
        option.id = `${prefix}-${index}`
        option.setAttribute('role', 'option')
        panel.append(option)
      }
      const picked = index === at
      option.dataset.wmSwitch = win.id
      if (option.textContent !== win.title) option.textContent = win.title
      option.setAttribute('aria-selected', String(picked))
      if (mode === 'overview') {
        const cell = cellOf(index, shown.length, win)
        option.style.left = `${cell.x}px`
        option.style.top = `${cell.y}px`
        option.style.width = `${cell.width}px`
        option.style.height = `${cell.height}px`
      } else option.removeAttribute('style')
      if (picked && mode === 'list') option.scrollIntoView?.({ block: 'nearest' })
    })
    for (const stale of options.slice(shown.length)) stale.remove()
    panel.setAttribute('aria-activedescendant', `${prefix}-${at}`)
  }

  function show(wanted: Mode, shortcutHeld: boolean): boolean {
    const found = candidates(wanted)
    if (!alive || found.length === 0) return false
    if (mode !== null) hide(false)
    const focused = wm.getState().focusedId
    mode = wanted
    quick = shortcutHeld
    shown = found
    columns = Math.ceil(Math.sqrt(found.length))
    at =
      wanted === 'list'
        ? found[0]?.id === focused && found.length > 1
          ? 1
          : 0
        : Math.max(
            0,
            found.findIndex((win) => win.id === focused),
          )
    before = doc.activeElement as HTMLElement | null
    panel.dataset.wmSwitcher = wanted
    panel.setAttribute('aria-label', wanted === 'list' ? messages.label : messages.overview)
    panel.hidden = false
    if (wanted === 'overview') spread(true)
    paint()
    panel.focus({ preventScroll: true })
    return true
  }

  function hide(animate: boolean): void {
    if (mode === null) return
    mode = null
    quick = false
    panel.hidden = true
    panel.replaceChildren()
    panel.removeAttribute('aria-activedescendant')
    for (const node of laid) gather(node, animate)
    laid = []
    shown = []
  }

  function cancel(): void {
    if (mode === null) return
    const back = before
    const inside = panel.contains(doc.activeElement)
    hide(true)
    if (inside && back?.isConnected) back.focus({ preventScroll: true })
  }

  function commit(index = at): void {
    if (mode === null) return
    const id = (shown[index] as WindowState).id
    hide(true)
    wm.focus(id)
    if (wm.getState().focusedId === id) elementOf(id)?.focus({ preventScroll: true })
  }

  function step(by: number): void {
    at = (((at + by) % shown.length) + shown.length) % shown.length
    paint()
  }

  function onHostKeydown(event: KeyboardEvent): void {
    if (!shortcut || event.code !== code || !event[held]) return
    event.preventDefault()
    event.stopPropagation()
    if (mode === 'list') step(event.shiftKey ? -1 : 1)
    else show('list', true)
  }

  function onPanelKeydown(event: KeyboardEvent): void {
    const wide = mode === 'overview' ? columns : 1
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: wide,
      ArrowUp: -wide,
      Home: -at,
      End: shown.length - 1 - at,
    }
    const by = moves[event.key]
    if (event.key === 'Escape') cancel()
    else if (event.key === 'Enter' || event.key === ' ') commit()
    else if (by !== undefined) {
      const to = at + by
      if (Math.abs(by) === wide && wide > 1 && (to < 0 || to >= shown.length)) return
      step(by)
    } else if (event.key !== 'Tab') return
    event.preventDefault()
    event.stopPropagation()
  }

  function onKeyup(event: KeyboardEvent): void {
    if (mode === 'list' && quick && (event.key === released || !event[held])) commit()
  }

  function onClick(event: MouseEvent): void {
    const option = (event.target as Element | null)?.closest?.('[data-wm-switch]')
    const index = option ? [...panel.children].indexOf(option) : -1
    if (index >= 0) commit(index)
    else cancel()
  }

  function onDown(event: Event): void {
    if (mode !== null && !event.composedPath().includes(panel)) cancel()
  }

  function onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null
    if (mode !== null && next && !panel.contains(next)) hide(true)
  }

  const stop = wm.subscribe(() => {
    if (mode === null) return
    const picked = shown[at]?.id
    const found = candidates(mode)
    if (found.length === 0) {
      cancel()
      return
    }
    shown = found
    columns = Math.ceil(Math.sqrt(found.length))
    at = Math.max(
      0,
      found.findIndex((win) => win.id === picked),
    )
    if (mode === 'overview') spread(false)
    paint()
  })
  panel.addEventListener('keydown', onPanelKeydown)
  panel.addEventListener('click', onClick)
  panel.addEventListener('focusout', onFocusOut)
  host.addEventListener('keydown', onHostKeydown, true)
  doc.addEventListener('keyup', onKeyup, true)
  doc.addEventListener('pointerdown', onDown, true)
  view.addEventListener('blur', cancel)

  return {
    element: panel,
    open: () => show('list', false),
    overview: () => show('overview', false),
    close: cancel,
    destroy() {
      if (!alive) return
      hide(false)
      alive = false
      stop()
      panel.removeEventListener('keydown', onPanelKeydown)
      panel.removeEventListener('click', onClick)
      panel.removeEventListener('focusout', onFocusOut)
      host.removeEventListener('keydown', onHostKeydown, true)
      doc.removeEventListener('keyup', onKeyup, true)
      doc.removeEventListener('pointerdown', onDown, true)
      view.removeEventListener('blur', cancel)
      panel.remove()
      const shared = styled.get(doc)
      if (shared && --shared.users === 0) {
        shared.node.remove()
        styled.delete(doc)
      }
    },
  }
}
