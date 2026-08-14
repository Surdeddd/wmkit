import type { ManagerEvents, WindowManager } from '../../core/types'
import { type DevtoolsMessages, devtoolsMessages } from './messages'
import { createDevtoolsView, type DevtoolsLogEntry } from './view'

export type { DevtoolsMessages } from './messages'
export { devtoolsMessages, devtoolsMessagesRu } from './messages'
export type { DevtoolsAction, DevtoolsLogEntry } from './view'

export type DevtoolsEvent = keyof ManagerEvents

export interface DevtoolsOptions {
  container?: HTMLElement
  messages?: Partial<DevtoolsMessages>
  logLimit?: number
  events?: readonly DevtoolsEvent[]
}

export interface DevtoolsController {
  element: HTMLElement
  destroy(): void
}

const DEFAULT_EVENTS: readonly DevtoolsEvent[] = [
  'open',
  'close',
  'focus',
  'stage',
  'workspace',
  'group',
  'modalblocked',
]

function detailOf(type: DevtoolsEvent, payload: unknown): string {
  const data = payload as Record<string, unknown>
  const win = data.window as { id?: string; stage?: string } | undefined
  if (win?.id) return type === 'stage' ? `${win.id} → ${win.stage}` : win.id
  if (typeof data.workspace === 'number') return String(data.workspace + 1)
  if (typeof data.groupId === 'string') return data.groupId
  return ''
}

export function createDevtools(
  wm: WindowManager,
  options: DevtoolsOptions = {},
): DevtoolsController {
  const container = options.container ?? document.body
  const doc = container.ownerDocument
  const messages: DevtoolsMessages = { ...devtoolsMessages, ...options.messages }
  const limit = Math.max(1, options.logLimit ?? 50)
  const watched = options.events ?? DEFAULT_EVENTS

  const view = createDevtoolsView(doc, messages)
  const log: DevtoolsLogEntry[] = []
  let seq = 0

  function draw(): void {
    view.render(wm.getState(), log, { canUndo: wm.canUndo(), canRedo: wm.canRedo() })
  }

  function record(type: DevtoolsEvent, payload: unknown): void {
    seq += 1
    log.push({ seq, type, detail: detailOf(type, payload) })
    if (log.length > limit) log.shift()
    draw()
  }

  const stops = watched.map((type) =>
    wm.on(type, (payload: unknown) => {
      record(type, payload)
    }),
  )
  stops.push(wm.subscribe(() => draw()))

  view.onWindowAction((action, id) => {
    if (action === 'focus') wm.focus(id)
    else if (action === 'minimize') wm.minimize(id)
    else if (action === 'maximize') wm.toggleMaximize(id)
    else wm.close(id)
  })

  view.onGlobalAction((action) => {
    if (action === 'undo') {
      wm.undo()
      return
    }
    if (action === 'redo') {
      wm.redo()
      return
    }
    const json = JSON.stringify(wm.serialize())
    const clipboard = doc.defaultView?.navigator.clipboard
    if (clipboard) void clipboard.writeText(json)
    view.flash(clipboard ? messages.copied : json)
  })

  container.append(view.root)
  draw()

  return {
    element: view.root,
    destroy() {
      for (const stop of stops) stop()
      view.destroy()
    },
  }
}
