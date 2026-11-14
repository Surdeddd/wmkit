import type { ManagerState, WindowManager, WindowState } from '../../core/types'
import { type TaskbarMessages, taskbarMessages } from './messages'

export type { TaskbarMessages } from './messages'
export { taskbarMessages, taskbarMessagesRu } from './messages'

export interface TaskbarOptions {
  show?: 'all' | 'minimized'
  workspace?: 'current' | 'all'
  messages?: Partial<TaskbarMessages>
}

export interface TaskbarController {
  element: HTMLElement
  targetOf(window: WindowState): HTMLElement | null
  destroy(): void
}

interface Entry {
  key: string
  win: WindowState
  count: number
  seq: number
}

const NEXT = ['ArrowRight', 'ArrowDown']
const PREVIOUS = ['ArrowLeft', 'ArrowUp']

const keyOf = (win: WindowState): string =>
  win.groupId === null ? `w${win.id}` : `g${win.groupId}`

function entriesOf(state: ManagerState, options: TaskbarOptions): Entry[] {
  const found = new Map<string, Entry>()
  for (const id of Object.keys(state.windows)) {
    const member = state.windows[id] as WindowState
    const group = member.groupId === null ? undefined : state.groups[member.groupId]
    const win = group ? (state.windows[group.activeId] as WindowState) : member
    if (options.workspace !== 'all' && win.workspace !== state.workspace) continue
    if (options.show === 'minimized' && win.stage !== 'minimized') continue
    const key = keyOf(member)
    const entry = found.get(key)
    if (entry) entry.seq = Math.min(entry.seq, member.openedSeq)
    else
      found.set(key, { key, win, count: group ? group.members.length : 1, seq: member.openedSeq })
  }
  return [...found.values()].sort((a, b) => a.seq - b.seq)
}

export function createTaskbar(
  wm: WindowManager,
  element: HTMLElement,
  options: TaskbarOptions = {},
): TaskbarController {
  const doc = element.ownerDocument
  const messages: TaskbarMessages = { ...taskbarMessages, ...options.messages }
  const buttons = new Map<string, HTMLButtonElement>()
  const shown = new Map<HTMLButtonElement, string>()
  let stop: HTMLButtonElement | null = null
  let seen: ManagerState | null = null

  const labelled = element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby')
  const role = element.getAttribute('role')
  element.setAttribute('role', 'toolbar')
  if (!labelled) element.setAttribute('aria-label', messages.label)

  function paint(button: HTMLButtonElement, entry: Entry, focused: boolean): void {
    const { win, count } = entry
    const look = `${win.id}\n${win.title}\n${count}\n${focused}\n${win.stage}`
    if (shown.get(button) === look) return
    shown.set(button, look)
    button.dataset.wmTask = win.id
    button.dataset.wmStage = win.stage
    button.toggleAttribute('data-wm-focused', focused)
    button.setAttribute('aria-pressed', String(focused))
    const title = button.firstChild as HTMLElement
    if (title.textContent !== win.title) title.textContent = win.title
    const badge = title.nextElementSibling
    if (count > 1) {
      const text = String(count)
      if (!badge) {
        const made = doc.createElement('span')
        made.dataset.wmTaskCount = ''
        made.setAttribute('aria-hidden', 'true')
        made.textContent = text
        button.append(made)
      } else if (badge.textContent !== text) badge.textContent = text
      button.setAttribute('aria-label', messages.tabs(win.title, count))
    }
  }

  function sync(): void {
    const state = wm.getState()
    if (state === seen) return
    seen = state
    const kept = new Set<string>()
    let cursor = element.firstElementChild
    let pressed: HTMLButtonElement | null = null
    for (const entry of entriesOf(state, options)) {
      let button = buttons.get(entry.key)
      if (!button) {
        button = doc.createElement('button')
        button.type = 'button'
        button.tabIndex = -1
        const title = doc.createElement('span')
        title.dataset.wmTaskTitle = ''
        button.append(title)
        buttons.set(entry.key, button)
      }
      kept.add(entry.key)
      if (button === cursor) cursor = cursor.nextElementSibling
      else element.insertBefore(button, cursor)
      const focused = state.focusedId === entry.win.id
      if (focused) pressed = button
      paint(button, entry, focused)
    }
    for (const [key, button] of buttons) {
      if (kept.has(key)) continue
      buttons.delete(key)
      shown.delete(button)
      button.remove()
      if (stop === button) stop = null
    }
    const first = buttons.values().next().value as HTMLButtonElement | undefined
    hold(
      element.contains(doc.activeElement) ? (stop ?? pressed ?? first) : (pressed ?? stop ?? first),
    )
  }

  function hold(next: HTMLButtonElement | null | undefined): void {
    if (next === stop || !next) return
    if (stop) stop.tabIndex = -1
    next.tabIndex = 0
    stop = next
  }

  const taskOf = (event: Event): HTMLButtonElement | null => {
    const target = event.target as Element | null
    const button = target?.closest?.('[data-wm-task]') as HTMLButtonElement | null
    return button && shown.has(button) ? button : null
  }

  function onClick(event: MouseEvent): void {
    const id = taskOf(event)?.dataset.wmTask
    const win = id === undefined ? undefined : wm.get(id)
    if (!win) return
    if (win.stage !== 'minimized' && wm.getState().focusedId === win.id) {
      if (win.minimizable) wm.minimize(win.id)
    } else wm.focus(win.id)
  }

  function onAuxClick(event: MouseEvent): void {
    const id = taskOf(event)?.dataset.wmTask
    if (event.button !== 1 || id === undefined || !wm.get(id)?.closable) return
    event.preventDefault()
    void wm.requestClose(id)
  }

  function onKeydown(event: KeyboardEvent): void {
    const from = taskOf(event)
    if (!from || event.altKey || event.ctrlKey || event.metaKey) return
    const all = [...element.children].filter((child): child is HTMLButtonElement =>
      shown.has(child as HTMLButtonElement),
    )
    const rtl = doc.defaultView?.getComputedStyle(element).direction === 'rtl'
    const forward = rtl ? ['ArrowLeft', 'ArrowDown'] : NEXT
    const backward = rtl ? ['ArrowRight', 'ArrowUp'] : PREVIOUS
    const at = all.indexOf(from)
    let to = -1
    if (forward.includes(event.key)) to = (at + 1) % all.length
    else if (backward.includes(event.key)) to = (at - 1 + all.length) % all.length
    else if (event.key === 'Home') to = 0
    else if (event.key === 'End') to = all.length - 1
    else return
    event.preventDefault()
    ;(all[to] as HTMLButtonElement).focus()
  }

  function onFocusIn(event: FocusEvent): void {
    hold(taskOf(event))
  }

  element.addEventListener('click', onClick)
  element.addEventListener('auxclick', onAuxClick)
  element.addEventListener('keydown', onKeydown)
  element.addEventListener('focusin', onFocusIn)
  let unsubscribe: (() => void) | null = wm.subscribe(sync)
  sync()

  return {
    element,
    targetOf(win) {
      if (!unsubscribe) return null
      sync()
      return buttons.get(keyOf(wm.get(win.id) ?? win)) ?? null
    },
    destroy() {
      if (!unsubscribe) return
      unsubscribe()
      unsubscribe = null
      element.removeEventListener('click', onClick)
      element.removeEventListener('auxclick', onAuxClick)
      element.removeEventListener('keydown', onKeydown)
      element.removeEventListener('focusin', onFocusIn)
      for (const button of buttons.values()) button.remove()
      buttons.clear()
      shown.clear()
      stop = null
      if (role === null) element.removeAttribute('role')
      else element.setAttribute('role', role)
      if (!labelled) element.removeAttribute('aria-label')
    },
  }
}

export interface WmTaskbarElement extends HTMLElement {
  manager: WindowManager | null
  messages: Partial<TaskbarMessages> | null
  readonly controller: TaskbarController | null
  targetOf(window: WindowState): HTMLElement | null
}

export function defineWmTaskbar(options: { prefix?: string } = {}): void {
  if (typeof customElements === 'undefined') return
  const name = `${options.prefix ?? 'wm'}-taskbar`
  if (customElements.get(name)) return
  customElements.define(
    name,
    class extends HTMLElement implements WmTaskbarElement {
      static observedAttributes = ['for', 'show', 'workspace']
      controller: TaskbarController | null = null
      private given: WindowManager | null = null
      private lines: Partial<TaskbarMessages> | null = null

      get manager(): WindowManager | null {
        return this.given
      }

      set manager(value: WindowManager | null) {
        this.given = value
        this.bind()
      }

      get messages(): Partial<TaskbarMessages> | null {
        return this.lines
      }

      set messages(value: Partial<TaskbarMessages> | null) {
        this.lines = value
        this.bind()
      }

      connectedCallback(): void {
        this.bind()
      }

      disconnectedCallback(): void {
        this.controller?.destroy()
        this.controller = null
      }

      attributeChangedCallback(): void {
        this.bind()
      }

      targetOf(win: WindowState): HTMLElement | null {
        return this.controller?.targetOf(win) ?? null
      }

      private bind(): void {
        this.disconnectedCallback()
        if (!this.isConnected) return
        const host = this.ownerDocument.getElementById(this.getAttribute('for') ?? '') as
          | (HTMLElement & { manager?: WindowManager | null })
          | null
        const wm = this.given ?? host?.manager
        if (!wm) {
          if (host?.localName.includes('-') && !customElements.get(host.localName)) {
            void customElements.whenDefined(host.localName).then(() => {
              if (!this.controller) this.bind()
            })
          }
          return
        }
        this.controller = createTaskbar(wm, this, {
          show: this.getAttribute('show') === 'minimized' ? 'minimized' : 'all',
          workspace: this.getAttribute('workspace') === 'all' ? 'all' : 'current',
          messages: this.lines ?? undefined,
        })
      }
    },
  )
}
