import type { Bounds } from '../../core/types'
import type { DesktopController } from '../../dom/shared'
import { type LayoutMessages, layoutMessages } from './messages'

export type { LayoutMessages } from './messages'
export { layoutMessages, layoutMessagesRu } from './messages'
export type { SeamOptions, SnapLink } from './seams'
export { linkSnapped } from './seams'

export type SnapLayout = readonly Bounds[]

export interface LayoutPickerOptions {
  layouts?: readonly SnapLayout[]
  messages?: Partial<LayoutMessages>
  hover?: number | false
  shortcut?: boolean
}

export interface LayoutPicker {
  element: HTMLElement
  open(id: string): boolean
  close(): void
  destroy(): void
}

const cell = (x: number, y: number, width: number, height: number): Bounds => ({
  x,
  y,
  width,
  height,
})

export const snapLayouts: {
  halves: readonly [Bounds, Bounds]
  wide: readonly [Bounds, Bounds]
  thirds: readonly [Bounds, Bounds, Bounds]
  quarters: readonly [Bounds, Bounds, Bounds, Bounds]
} = {
  halves: [cell(0, 0, 1 / 2, 1), cell(1 / 2, 0, 1 / 2, 1)],
  wide: [cell(0, 0, 2 / 3, 1), cell(2 / 3, 0, 1 / 3, 1)],
  thirds: [cell(0, 0, 1 / 3, 1), cell(1 / 3, 0, 1 / 3, 1), cell(2 / 3, 0, 1 / 3, 1)],
  quarters: [
    cell(0, 0, 1 / 2, 1 / 2),
    cell(1 / 2, 0, 1 / 2, 1 / 2),
    cell(0, 1 / 2, 1 / 2, 1 / 2),
    cell(1 / 2, 1 / 2, 1 / 2, 1 / 2),
  ],
}

const CSS =
  '[data-wm-layouts]{position:absolute;z-index:2147483646;display:flex;gap:8px;padding:8px;box-sizing:border-box;border-radius:var(--wm-radius,10px);border:1px solid var(--wm-border,rgba(128,128,128,.4));background:var(--wm-bg-solid,var(--wm-bg,#1b1d24));color:var(--wm-text,#e7e9f0);box-shadow:var(--wm-shadow,0 12px 32px rgba(0,0,0,.35))}' +
  '[data-wm-layouts][hidden]{display:none}' +
  '[data-wm-layout]{position:relative;width:72px;height:48px;flex:none}' +
  '[data-wm-layout-cell]{position:absolute;box-sizing:border-box;margin:0;padding:0;border:1px solid var(--wm-border,rgba(128,128,128,.6));border-radius:3px;background:var(--wm-titlebar-bg,rgba(128,128,128,.25));cursor:pointer;background-clip:padding-box}' +
  '[data-wm-layout-cell]:hover,[data-wm-layout-cell]:focus-visible{background:var(--wm-accent,#4c8dff);outline:none}' +
  '@media (forced-colors:active){[data-wm-layout-cell]:hover,[data-wm-layout-cell]:focus-visible{background:Highlight}}'

const GRACE = 300
const styled = new WeakMap<Document, { node: HTMLStyleElement; users: number }>()

function usable(layout: SnapLayout): Bounds[] {
  return [layout].flat().filter((rect) => {
    const numbers = [rect?.x, rect?.y, rect?.width, rect?.height]
    return (
      numbers.every((value) => Number.isFinite(value)) &&
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.x + rect.width <= 1 + 1e-9 &&
      rect.y + rect.height <= 1 + 1e-9
    )
  })
}

export function createLayoutPicker(
  desktop: DesktopController,
  options: LayoutPickerOptions = {},
): LayoutPicker {
  const { wm, element: host } = desktop
  const doc = host.ownerDocument
  const view = doc.defaultView as Window & typeof globalThis
  const messages: LayoutMessages = { ...layoutMessages, ...options.messages }
  const hover = options.hover === false ? -1 : (options.hover ?? 400)
  const layouts = (options.layouts ?? Object.values<SnapLayout>(snapLayouts)).map(usable)
  const cells: Array<[HTMLButtonElement, Bounds]> = []
  let alive = true
  let target: string | null = null
  let anchor: Element | null = null
  let opening = 0
  let closing = 0

  let sheet = styled.get(doc)
  if (!sheet) {
    sheet = { node: doc.createElement('style'), users: 0 }
    sheet.node.dataset.wmLayoutsStyle = ''
    sheet.node.textContent = CSS
    doc.head.append(sheet.node)
    styled.set(doc, sheet)
  }
  sheet.users += 1

  const panel = doc.createElement('div')
  panel.dataset.wmLayouts = ''
  panel.hidden = true
  panel.setAttribute('role', 'menu')
  panel.setAttribute('aria-label', messages.label)
  const percent = (value: number) => `${Math.round(value * 1e4) / 100}%`
  layouts.forEach((layout, at) => {
    if (layout.length === 0) return
    const group = doc.createElement('div')
    group.dataset.wmLayout = ''
    group.setAttribute('role', 'group')
    layout.forEach((rect, index) => {
      const button = doc.createElement('button')
      button.type = 'button'
      button.dataset.wmLayoutCell = ''
      button.tabIndex = -1
      button.setAttribute('role', 'menuitem')
      button.setAttribute('aria-label', messages.cell(at + 1, index + 1, layout.length))
      button.style.left = percent(rect.x)
      button.style.top = percent(rect.y)
      button.style.width = percent(rect.width)
      button.style.height = percent(rect.height)
      group.append(button)
      cells.push([button, rect])
    })
    panel.append(group)
  })
  host.append(panel)

  const pathOf = (event: Event) => event.composedPath() as HTMLElement[]
  const within = (event: Event, node: Element | null) =>
    !!node && pathOf(event).includes(node as HTMLElement)
  const windowOf = (event: Event): string | undefined =>
    pathOf(event).find((node) => node.dataset?.wmWindow !== undefined && host.contains(node))
      ?.dataset.wmWindow
  const control = (event: Event): Element | undefined =>
    pathOf(event).find((node) => node.matches?.('[data-wm-maximize]'))
  const elementOf = (id: string): HTMLElement | null =>
    [...host.querySelectorAll<HTMLElement>('[data-wm-window]')].find(
      (node) => node.dataset.wmWindow === id,
    ) ?? null

  function settle(): void {
    view.clearTimeout(opening)
    opening = 0
  }

  function stay(): void {
    view.clearTimeout(closing)
    closing = 0
  }

  function drift(): void {
    if (target !== null && closing === 0) closing = view.setTimeout(close, GRACE)
  }

  function place(): void {
    const frame = host.getBoundingClientRect()
    const scale = frame.width / host.offsetWidth || 1
    const from = (anchor ?? elementOf(target as string) ?? host).getBoundingClientRect()
    const width = panel.offsetWidth
    const height = panel.offsetHeight
    const room = { width: frame.width / scale, height: frame.height / scale }
    const middle = (from.left + from.width / 2 - frame.left) / scale
    let top = (from.bottom - frame.top) / scale + 6
    if (top + height > room.height) top = (from.top - frame.top) / scale - height - 6
    panel.style.left = `${Math.max(0, Math.min(middle - width / 2, room.width - width))}px`
    panel.style.top = `${Math.max(0, Math.min(top, room.height - height))}px`
  }

  function open(id: string, from: Element | null = null): boolean {
    const win = wm.get(id)
    if (!alive || cells.length === 0 || !win?.snappable || win.stage === 'minimized') return false
    close()
    settle()
    target = id
    anchor = from ?? elementOf(id)?.querySelector('[data-wm-maximize]') ?? null
    anchor?.setAttribute('aria-expanded', 'true')
    panel.hidden = false
    place()
    return true
  }

  function close(): void {
    stay()
    if (target === null) return
    target = null
    anchor?.removeAttribute('aria-expanded')
    anchor = null
    panel.hidden = true
  }

  function leave(): void {
    const id = target
    const inside = panel.contains(doc.activeElement)
    close()
    if (id !== null && inside) elementOf(id)?.focus({ preventScroll: true })
  }

  function onClick(event: MouseEvent): void {
    const chosen = cells.find(([button]) => within(event, button))
    const id = target
    if (!chosen || id === null) return
    leave()
    wm.batch(() => {
      if (wm.snapTo(id, chosen[1])) wm.focus(id)
    })
  }

  function onPanelKeydown(event: KeyboardEvent): void {
    const at = cells.findIndex(([button]) => button === doc.activeElement)
    let to = -1
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      leave()
      return
    }
    if (event.key === 'Tab') {
      leave()
      return
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') to = (at + 1) % cells.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      to = (Math.max(at, 0) - 1 + cells.length) % cells.length
    } else if (event.key === 'Home') to = 0
    else if (event.key === 'End') to = cells.length - 1
    else return
    event.preventDefault()
    event.stopPropagation()
    ;(cells[to] as [HTMLButtonElement, Bounds])[0].focus()
  }

  function onKeydown(event: KeyboardEvent): void {
    if (options.shortcut === false || !(event.ctrlKey || event.metaKey) || !event.altKey) return
    if (event.key.toLowerCase() !== 'l' && event.code !== 'KeyL') return
    const id = wm.getState().focusedId
    if (id === null || !open(id)) return
    event.preventDefault()
    ;(cells[0] as [HTMLButtonElement, Bounds])[0].focus()
  }

  function onOver(event: PointerEvent): void {
    settle()
    if (within(event, panel)) {
      stay()
      return
    }
    const button = control(event)
    const id = button && windowOf(event)
    if (button && target === id && anchor === button) {
      stay()
      return
    }
    drift()
    if (!button || id === undefined || hover < 0 || event.pointerType !== 'mouse') return
    opening = view.setTimeout(() => {
      opening = 0
      open(id, button)
    }, hover)
  }

  function onLeave(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return
    settle()
    drift()
  }

  function onMenu(event: Event): void {
    const button = control(event)
    const id = button && windowOf(event)
    if (!button || id === undefined || !open(id, button)) return
    event.preventDefault()
    ;(cells[0] as [HTMLButtonElement, Bounds])[0].focus()
  }

  function onDown(event: Event): void {
    settle()
    if (target !== null && !within(event, panel) && !within(event, anchor)) close()
  }

  function onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null
    if (target !== null && next && !panel.contains(next)) close()
  }

  const stop = wm.subscribe(() => {
    const win = target === null ? undefined : wm.get(target)
    if (target !== null && (!win?.snappable || win.stage === 'minimized')) leave()
  })
  panel.addEventListener('click', onClick)
  panel.addEventListener('keydown', onPanelKeydown)
  panel.addEventListener('focusout', onFocusOut)
  host.addEventListener('keydown', onKeydown)
  host.addEventListener('pointerover', onOver)
  host.addEventListener('pointerleave', onLeave)
  host.addEventListener('contextmenu', onMenu)
  doc.addEventListener('pointerdown', onDown, true)

  return {
    element: panel,
    open: (id) => open(id),
    close,
    destroy() {
      if (!alive) return
      close()
      settle()
      alive = false
      stop()
      panel.removeEventListener('click', onClick)
      panel.removeEventListener('keydown', onPanelKeydown)
      panel.removeEventListener('focusout', onFocusOut)
      host.removeEventListener('keydown', onKeydown)
      host.removeEventListener('pointerover', onOver)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('contextmenu', onMenu)
      doc.removeEventListener('pointerdown', onDown, true)
      panel.remove()
      const shared = styled.get(doc)
      if (shared && --shared.users === 0) {
        shared.node.remove()
        styled.delete(doc)
      }
    },
  }
}
