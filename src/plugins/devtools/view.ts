import type { ManagerState, WindowState } from '../../core/types'
import type { DevtoolsMessages } from './messages'

export type DevtoolsAction = 'focus' | 'minimize' | 'maximize' | 'close'

export type DevtoolsGlobal = 'undo' | 'redo' | 'copy'

export interface DevtoolsHistory {
  canUndo: boolean
  canRedo: boolean
}

export interface DevtoolsLogEntry {
  seq: number
  type: string
  detail: string
}

export interface DevtoolsView {
  root: HTMLElement
  onWindowAction(handler: (action: DevtoolsAction, id: string) => void): void
  onGlobalAction(handler: (action: DevtoolsGlobal) => void): void
  render(state: ManagerState, log: readonly DevtoolsLogEntry[], history: DevtoolsHistory): void
  flash(message: string): void
  destroy(): void
}

const STYLE_ID = 'wm-devtools-style'

const CSS = `[data-wm-devtools]{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:340px;max-width:calc(100vw - 32px);max-height:min(70vh,560px);display:flex;flex-direction:column;overflow:hidden;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#14161c;color:#e7e9f0;font:12px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;box-shadow:0 18px 48px rgba(0,0,0,.45)}
[data-wm-devtools] h2{margin:0;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9aa0b5}
[data-wm-devtools] header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1)}
[data-wm-devtools] header h2{flex:1}
[data-wm-devtools] button{font:inherit;color:inherit;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:3px 7px;min-height:24px;cursor:pointer}
[data-wm-devtools] button:hover:not(:disabled){border-color:#7c6cff}
[data-wm-devtools] button:disabled{opacity:.45;cursor:not-allowed}
[data-wm-devtools] button:focus-visible{outline:2px solid #7c6cff;outline-offset:2px}
[data-wm-devtools] section{padding:10px 12px;overflow:auto}
[data-wm-devtools] section+section{border-top:1px solid rgba(255,255,255,.1)}
[data-wm-devtools] ul{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
[data-wm-devtools] [data-wm-devtools-row]{display:grid;grid-template-columns:1fr auto;gap:4px 8px;padding:7px 8px;border:1px solid rgba(255,255,255,.1);border-radius:6px}
[data-wm-devtools] [data-wm-devtools-row][data-focused]{border-color:#7c6cff}
[data-wm-devtools] .wm-dt-id{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-wm-devtools] .wm-dt-meta{grid-column:1/-1;color:#9aa0b5;font-size:11px}
[data-wm-devtools] .wm-dt-acts{display:flex;gap:4px}
[data-wm-devtools] .wm-dt-log{gap:2px}
[data-wm-devtools] .wm-dt-log li{display:flex;gap:8px;color:#9aa0b5}
[data-wm-devtools] .wm-dt-log b{color:#e7e9f0;font-weight:600;min-width:88px}
[data-wm-devtools] p{margin:6px 0 0;color:#9aa0b5}
@media (prefers-reduced-motion:reduce){[data-wm-devtools] *{transition:none!important}}`

function acquireStyle(doc: Document): HTMLStyleElement {
  const existing = doc.getElementById(STYLE_ID)
  if (existing instanceof HTMLStyleElement) {
    existing.dataset.owners = String(Number(existing.dataset.owners) + 1)
    return existing
  }
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.dataset.owners = '1'
  style.textContent = CSS
  doc.head.append(style)
  return style
}

function releaseStyle(style: HTMLStyleElement): void {
  const left = Number(style.dataset.owners) - 1
  if (left > 0) style.dataset.owners = String(left)
  else style.remove()
}

function box(win: WindowState): string {
  const { x, y, width, height } = win.bounds
  return `${Math.round(x)},${Math.round(y)} ${Math.round(width)}×${Math.round(height)}`
}

export function createDevtoolsView(doc: Document, messages: DevtoolsMessages): DevtoolsView {
  const style = acquireStyle(doc)

  const root = doc.createElement('aside')
  root.dataset.wmDevtools = ''
  root.setAttribute('role', 'complementary')

  const heading = doc.createElement('h2')
  heading.id = `wm-devtools-title-${Math.round(performance.now())}`
  heading.textContent = messages.title
  root.setAttribute('aria-labelledby', heading.id)

  const undo = doc.createElement('button')
  undo.type = 'button'
  undo.dataset.wmDevtoolsGlobal = 'undo'
  undo.textContent = messages.undo

  const redo = doc.createElement('button')
  redo.type = 'button'
  redo.dataset.wmDevtoolsGlobal = 'redo'
  redo.textContent = messages.redo

  const copy = doc.createElement('button')
  copy.type = 'button'
  copy.dataset.wmDevtoolsGlobal = 'copy'
  copy.textContent = messages.copyState

  const header = doc.createElement('header')
  header.append(heading, undo, redo, copy)

  const windowsHead = doc.createElement('h2')
  windowsHead.textContent = messages.windows
  const windowList = doc.createElement('ul')
  const windowsEmpty = doc.createElement('p')
  windowsEmpty.textContent = messages.empty
  const windowsSection = doc.createElement('section')
  windowsSection.append(windowsHead, windowsEmpty, windowList)

  const eventsHead = doc.createElement('h2')
  eventsHead.textContent = messages.events
  const logList = doc.createElement('ul')
  logList.className = 'wm-dt-log'
  const logEmpty = doc.createElement('p')
  logEmpty.textContent = messages.quiet
  const eventsSection = doc.createElement('section')
  eventsSection.append(eventsHead, logEmpty, logList)

  const status = doc.createElement('p')
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  eventsSection.append(status)

  root.append(header, windowsSection, eventsSection)

  let windowHandler: ((action: DevtoolsAction, id: string) => void) | null = null
  let globalHandler: ((action: DevtoolsGlobal) => void) | null = null

  const onClick = (event: MouseEvent) => {
    const target = (event.target as Element | null)?.closest<HTMLElement>('button')
    if (!target) return
    const global = target.dataset.wmDevtoolsGlobal
    if (global) {
      globalHandler?.(global as DevtoolsGlobal)
      return
    }
    const action = target.dataset.wmDevtoolsAction
    const id = target.dataset.wmDevtoolsId
    if (action && id) windowHandler?.(action as DevtoolsAction, id)
  }
  root.addEventListener('click', onClick)

  interface Row {
    node: HTMLElement
    id: HTMLElement
    meta: HTMLElement
  }

  const rows = new Map<string, Row>()
  let listOrder = ''

  function buildRow(win: WindowState): Row {
    const node = doc.createElement('li')
    node.dataset.wmDevtoolsRow = win.id

    const id = doc.createElement('span')
    id.className = 'wm-dt-id'

    const acts = doc.createElement('span')
    acts.className = 'wm-dt-acts'
    const buttons: Array<[DevtoolsAction, string]> = [
      ['focus', messages.focus],
      ['minimize', messages.minimize],
      ['maximize', messages.maximize],
      ['close', messages.close],
    ]
    for (const [action, label] of buttons) {
      const button = doc.createElement('button')
      button.type = 'button'
      button.dataset.wmDevtoolsAction = action
      button.dataset.wmDevtoolsId = win.id
      button.textContent = label.slice(0, 1)
      button.setAttribute('aria-label', `${label} ${win.id}`)
      acts.append(button)
    }

    const meta = doc.createElement('span')
    meta.className = 'wm-dt-meta'

    node.append(id, acts, meta)
    return { node, id, meta }
  }

  function paintRow(row: Row, win: WindowState, focused: boolean): void {
    const label = win.title ? `${win.id} · ${win.title}` : win.id
    if (row.id.textContent !== label) row.id.textContent = label
    const meta = `${messages.stage(win.stage)} · ${win.layer} · ${messages.workspace(
      win.workspace,
    )} · ${box(win)}`
    if (row.meta.textContent !== meta) row.meta.textContent = meta
    if (focused) row.node.dataset.focused = ''
    else delete row.node.dataset.focused
  }

  return {
    root,
    onWindowAction(handler) {
      windowHandler = handler
    },
    onGlobalAction(handler) {
      globalHandler = handler
    },
    render(state, log, history) {
      const windows = state.order.map((id) => state.windows[id]).filter(Boolean) as WindowState[]
      windowsEmpty.hidden = windows.length > 0

      const ordered: HTMLElement[] = []
      const live = new Set<string>()
      for (let index = windows.length - 1; index >= 0; index -= 1) {
        const win = windows[index] as WindowState
        live.add(win.id)
        let entry = rows.get(win.id)
        if (!entry) {
          entry = buildRow(win)
          rows.set(win.id, entry)
        }
        paintRow(entry, win, win.id === state.focusedId)
        ordered.push(entry.node)
      }
      for (const [id, entry] of rows) {
        if (live.has(id)) continue
        entry.node.remove()
        rows.delete(id)
      }
      const key = ordered.map((node) => node.dataset.wmDevtoolsRow).join('|')
      if (key !== listOrder) {
        listOrder = key
        windowList.replaceChildren(...ordered)
      }
      logEmpty.hidden = log.length > 0
      logList.replaceChildren(
        ...[...log].reverse().map((entry) => {
          const item = doc.createElement('li')
          const type = doc.createElement('b')
          type.textContent = entry.type
          const detail = doc.createElement('span')
          detail.textContent = entry.detail
          item.append(type, detail)
          return item
        }),
      )
      undo.disabled = !history.canUndo
      redo.disabled = !history.canRedo
    },
    flash(message) {
      status.textContent = message
    },
    destroy() {
      root.removeEventListener('click', onClick)
      root.remove()
      releaseStyle(style)
    },
  }
}
