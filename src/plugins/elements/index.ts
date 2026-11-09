import { createWindowManager } from '../../core/manager'
import type {
  ManagerOptions,
  ManagerState,
  WindowFlags,
  WindowInit,
  WindowManager,
  WindowState,
  WindowUpdate,
} from '../../core/types'
import { attachDesktop } from '../../dom/controller'
import type { DesktopController, DesktopOptions } from '../../dom/shared'
import { type PersistController, persist } from '../persist'

export interface ElementsMessages {
  minimize: string
  maximize: string
  close: string
  tabs?: string
}

export const elementsMessages: ElementsMessages = {
  minimize: 'Minimize',
  maximize: 'Maximize',
  close: 'Close',
  tabs: 'Tabs',
}

export const elementsMessagesRu: ElementsMessages = {
  minimize: 'Свернуть',
  maximize: 'Развернуть',
  close: 'Закрыть',
  tabs: 'Вкладки',
}

export type WmDesktopOptions = DesktopOptions & ManagerOptions

export type WmDesktopStyles = string | CSSStyleSheet | ReadonlyArray<string | CSSStyleSheet>

const CHROME_CSS = `:host{position:absolute;left:0;top:0;display:flex;flex-direction:column;box-sizing:border-box;color:var(--wm-text,#1d1d1f);background:var(--wm-bg,#fff);border:1px solid var(--wm-border,rgba(0,0,0,.14));border-radius:var(--wm-radius,10px);box-shadow:var(--wm-shadow,0 8px 28px rgba(0,0,0,.2))}
:host([hidden]),:host([closed]){display:none!important}
[hidden]{display:none!important}
[part=titlebar]{border-radius:inherit;border-bottom-left-radius:0;border-bottom-right-radius:0;display:flex;align-items:center;gap:6px;flex:none;height:36px;padding:0 6px 0 12px;background:var(--wm-titlebar-bg,transparent);user-select:none;-webkit-user-select:none;touch-action:none}
[part=title]{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:600 13px/1 system-ui,sans-serif}
[data-wm-controls]{display:contents}
[part~=control]{width:24px;height:24px;padding:0;border:0;border-radius:6px;background:none;color:inherit;font:16px/1 system-ui,sans-serif;cursor:pointer;opacity:.7}
[part~=control]:hover,[part~=control]:focus-visible{opacity:1;outline:2px solid var(--wm-accent,currentColor)}
[data-wm-minimize]::after{content:"–"}[data-wm-maximize]::after{content:"□"}[data-wm-close]::after{content:"×"}
[part=tabs]{flex:1;display:flex;gap:2px;min-width:0;overflow:hidden}
[part~=tab]{min-width:0;max-width:16ch;height:26px;padding:0 10px;border:0;border-radius:6px;background:none;color:inherit;font:13px/1 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;opacity:.7}
[part~=tab]:hover,[part~=active]{opacity:1}
[part~=active]{font-weight:600;background:color-mix(in srgb,currentColor 12%,transparent)}
[part~=tab]:focus-visible{opacity:1;outline:2px solid var(--wm-accent,currentColor)}
[part=content]{position:relative;flex:1;min-height:0;overflow:auto;border-radius:inherit;border-top-left-radius:0;border-top-right-radius:0}
:host([chrome=none]) [part=titlebar]{display:none}`

const NUMBERS: Record<string, keyof WindowInit> = {
  x: 'x',
  y: 'y',
  width: 'width',
  height: 'height',
  'min-width': 'minWidth',
  'min-height': 'minHeight',
  'max-width': 'maxWidth',
  'max-height': 'maxHeight',
  'aspect-ratio': 'aspectRatio',
  workspace: 'workspace',
}

const FLAGS = [
  'closable',
  'minimizable',
  'maximizable',
  'resizable',
  'draggable',
  'snappable',
] as const

const KEY = 'elements'
const OPEN = Symbol('wmkit-open')
const SYNC = Symbol('wmkit-sync')
const ADOPT = Symbol('wmkit-adopt')
const MEMBERS = Symbol('wmkit-members')
const SHEETS = Symbol('wmkit-sheets')

const Base = (typeof HTMLElement === 'undefined' ? Object : HTMLElement) as typeof HTMLElement

function numberAt(element: Element, name: string): number | undefined {
  const raw = element.getAttribute(name)
  const value = raw === null ? Number.NaN : Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function catalogueFor(element: Element): ElementsMessages {
  const lang = element.closest('[lang]')?.getAttribute('lang') ?? ''
  return lang.toLowerCase().startsWith('ru') ? elementsMessagesRu : elementsMessages
}

function emit(element: Element, type: string, detail: unknown, cancelable = false): boolean {
  return element.dispatchEvent(
    new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable }),
  )
}

function part(doc: Document, tag: string, name: string): HTMLElement {
  const node = doc.createElement(tag)
  node.setAttribute('part', name)
  return node
}

function closedIn(state: ManagerState): unknown[] {
  const closed = (state.extensions[KEY] as { closed?: unknown } | undefined)?.closed
  return Array.isArray(closed) ? closed : []
}

export class WmDesktopElement extends Base {
  manager: WindowManager | null = null
  controller: DesktopController | null = null
  options: WmDesktopOptions = {}
  messages: ElementsMessages | null = null
  readonly windows = new Map<string, WmWindowElement>()
  readonly [MEMBERS] = new Set<WmWindowElement>();
  [SHEETS]: CSSStyleSheet[] = []
  private css: WmDesktopStyles | null = null
  private store: PersistController | null = null
  private stops: Array<() => void> = []

  get styles(): WmDesktopStyles | null {
    return this.css
  }

  set styles(value: WmDesktopStyles | null) {
    this.css = value
    const Sheet = (this.ownerDocument.defaultView as Window & typeof globalThis).CSSStyleSheet
    this[SHEETS] = [value ?? []].flat().flatMap((css) => {
      if (typeof css !== 'string') return [css]
      if (typeof Sheet.prototype.replaceSync !== 'function') return []
      const sheet = new Sheet()
      sheet.replaceSync(css)
      return [sheet]
    })
    for (const element of this[MEMBERS]) element[ADOPT](this[SHEETS])
  }

  connectedCallback(): void {
    if (this.manager) return
    const on = (name: string) => this.getAttribute(name) !== 'false'
    const wm = createWindowManager(this.options)
    this.manager = wm
    this.controller = attachDesktop(wm, this, {
      snap: on('snap'),
      keyboard: on('keyboard'),
      grouping: on('grouping'),
      magnetism: on('magnetism'),
      announce: on('announce'),
      beforeClose: (win) => {
        const element = this.windows.get(win.id)
        return !element || emit(element, 'wm-beforeclose', { window: win }, true)
      },
      ...this.options,
    })
    this.stops = [
      wm.subscribe((state) => this.follow(state)),
      ...(['move', 'resize', 'stage', 'focus', 'close'] as const).map((type) =>
        wm.on(type as 'move', (payload) => {
          const element = this.windows.get(payload.window.id)
          if (!element) return
          element[SYNC](wm.getState())
          emit(element, `wm-${type}`, payload)
        }),
      ),
    ]
    const key = this.getAttribute('persist')
    if (key) this.store = persist(wm, { key })
    for (const node of this.querySelectorAll('*')) {
      if (node instanceof WmWindowElement) node[OPEN]()
    }
    emit(this, 'wm-ready', { manager: wm })
  }

  disconnectedCallback(): void {
    queueMicrotask(() => {
      if (this.isConnected || !this.manager) return
      for (const stop of this.stops) stop()
      this.store?.destroy()
      this.controller?.destroy()
      this.manager.destroy()
      this.manager = null
      this.controller = null
      this.store = null
    })
  }

  private follow(state: ManagerState): void {
    const stored = closedIn(state)
    const closed = stored.filter((id) => !state.windows[id as string])
    let changed = closed.length !== stored.length
    for (const element of this[MEMBERS]) {
      element[SYNC](state)
      const id = element.windowId
      if (id !== null && !state.windows[id] && !closed.includes(id)) {
        closed.push(id)
        changed = true
      }
    }
    if (!changed) return
    const wm = this.manager as WindowManager
    wm.beginInteraction()
    wm.setExtension(KEY, closed.length > 0 ? { closed } : undefined)
    wm.abortInteraction()
  }
}

export class WmWindowElement extends Base {
  static observedAttributes = [
    'label',
    'stage',
    'layer',
    'closed',
    ...Object.keys(NUMBERS),
    ...FLAGS,
  ]

  windowId: string | null = null
  private host: WmDesktopElement | null = null
  private detach: (() => void) | null = null
  private quiet = false
  private last: WindowState | null = null
  private tabs = ''
  private adopted: CSSStyleSheet[] = []
  private controls: Array<[keyof WindowFlags, HTMLElement]> = []

  get manager(): WindowManager | null {
    return this.host?.manager ?? null
  }

  connectedCallback(): void {
    this[OPEN]()
  }

  disconnectedCallback(): void {
    this.host?.[MEMBERS].delete(this)
    queueMicrotask(() => {
      if (this.isConnected) return
      this.release(true)
    })
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    const wm = this.manager
    const id = this.windowId
    if (this.quiet) return
    if (name === 'closed') {
      if (value === null) this[OPEN](true)
      else if (wm && id) wm.close(id)
      return
    }
    if (!wm || !id) return
    const win = wm.get(id)
    if (!win) return
    if (name === 'label') wm.update(id, { title: value ?? '' })
    else if (name === 'layer') wm.update(id, { layer: (value ?? 'normal') as WindowState['layer'] })
    else if (name === 'stage') {
      if (value === 'minimized') wm.minimize(id)
      else if (value === 'maximized') wm.maximize(id)
      else for (let i = 0; i < 2 && wm.get(id)?.stage !== 'normal'; i += 1) wm.restore(id)
    } else if (name === 'workspace') wm.moveToWorkspace(id, numberAt(this, name) ?? 0)
    else if (name === 'x' || name === 'y') {
      wm.move(id, numberAt(this, 'x') ?? win.bounds.x, numberAt(this, 'y') ?? win.bounds.y)
    } else if (name === 'width' || name === 'height') {
      const size = numberAt(this, name)
      if (size !== undefined) wm.resize(id, { [name]: size })
    } else if (name === 'aspect-ratio') wm.update(id, { aspectRatio: numberAt(this, name) ?? null })
    else if (name.startsWith('min-')) {
      wm.update(id, {
        minSize: {
          width: numberAt(this, 'min-width') ?? win.minSize.width,
          height: numberAt(this, 'min-height') ?? win.minSize.height,
        },
      })
    } else if (name.startsWith('max-')) {
      wm.update(id, {
        maxSize: {
          width: numberAt(this, 'max-width') ?? Number.POSITIVE_INFINITY,
          height: numberAt(this, 'max-height') ?? Number.POSITIVE_INFINITY,
        },
      })
    } else wm.update(id, { [name]: value !== 'false' } as WindowUpdate)
  }

  private reflect(change: () => void): void {
    this.quiet = true
    change()
    this.quiet = false
  }

  [SYNC](state: ManagerState): void {
    const host = this.host
    const id = this.windowId
    if (!host || id === null) return
    const win = state.windows[id]
    this.reflect(() => this.toggleAttribute('closed', !win))
    if (!win) {
      this.release(false)
      return
    }
    const opened = !this.detach
    if (opened) {
      if (host.windows.has(id)) return
      this.detach = (host.controller as DesktopController).attachWindow(id, this)
      host.windows.set(id, this)
    }
    const last = this.last
    if (win !== last) {
      this.last = win
      if ((this.getAttribute('stage') ?? 'normal') !== win.stage) {
        this.reflect(() => this.setAttribute('stage', win.stage))
      }
      for (const [flag, button] of this.controls) {
        if (last?.[flag] !== win[flag]) button.hidden = !win[flag]
      }
    }
    const group = win.groupId === null ? undefined : state.groups[win.groupId]
    const members = group?.activeId === id && group.members.length > 1 ? group.members : []
    const tabs = members
      .map((member) => `${member}\n${(state.windows[member] as WindowState).title}`)
      .join('\n')
    if (tabs !== this.tabs) {
      this.tabs = tabs
      const root = this.shadowRoot as ShadowRoot
      const strip = root.querySelector('[part=tabs]') as HTMLElement
      ;(root.querySelector('[part=title]') as HTMLElement).hidden = members.length > 0
      strip.hidden = members.length === 0
      strip.replaceChildren(
        ...members.map((member) => {
          const tab = part(this.ownerDocument, 'button', member === id ? 'tab active' : 'tab')
          tab.setAttribute('type', 'button')
          tab.setAttribute('role', 'tab')
          tab.setAttribute('aria-selected', String(member === id))
          tab.tabIndex = member === id ? 0 : -1
          tab.dataset.windowId = member
          tab.textContent = (state.windows[member] as WindowState).title || member
          return tab
        }),
      )
    }
    if (opened) emit(this, 'wm-open', { window: win })
  }

  [ADOPT](sheets: CSSStyleSheet[]): void {
    if (sheets.length + this.adopted.length === 0) return
    const root = this.shadowRoot as ShadowRoot
    const others = (root.adoptedStyleSheets ?? []).filter((sheet) => !this.adopted.includes(sheet))
    root.adoptedStyleSheets = [...others, ...sheets]
    this.adopted = sheets
  }

  [OPEN](reopen = false): void {
    let host = this.parentElement
    while (host && !(host instanceof WmDesktopElement)) host = host.parentElement
    this.chrome(host?.messages ?? catalogueFor(this))
    if (this.detach) {
      ;(this.host as WmDesktopElement)[MEMBERS].add(this)
      return
    }
    const wm = host?.manager
    if (!host || !wm) return
    this.host = host
    host[MEMBERS].add(this)
    this[ADOPT](host[SHEETS])
    const id = this.getAttribute('window-id') ?? this.windowId
    this.windowId = id
    if (id === null || !wm.get(id)) {
      if (!reopen && (this.hasAttribute('closed') || closedIn(wm.getState()).includes(id))) {
        this.reflect(() => this.toggleAttribute('closed', true))
        return
      }
      const init: WindowInit = {
        id: id ?? undefined,
        title: this.getAttribute('label') ?? '',
        stage: (this.getAttribute('stage') ?? undefined) as WindowInit['stage'],
        layer: (this.getAttribute('layer') ?? undefined) as WindowInit['layer'],
      }
      for (const [attribute, key] of Object.entries(NUMBERS)) {
        const value = numberAt(this, attribute)
        if (value !== undefined) (init as Record<string, unknown>)[key] = value
      }
      for (const flag of FLAGS) if (this.getAttribute(flag) === 'false') init[flag] = false
      this.windowId = wm.open(init).id
    }
    this[SYNC](wm.getState())
  }

  private release(close: boolean): void {
    const host = this.host
    const id = this.windowId
    if (!host || !id || !this.detach) return
    const detach = this.detach
    this.detach = null
    this.last = null
    host.windows.delete(id)
    detach()
    if (close) host.manager?.close(id)
  }

  private chrome(messages: ElementsMessages): void {
    if (this.shadowRoot) return
    const root = this.attachShadow({ mode: 'open' })
    const doc = this.ownerDocument
    const style = doc.createElement('style')
    style.textContent = CHROME_CSS
    const bar = part(doc, 'header', 'titlebar')
    bar.dataset.wmDrag = ''
    const title = part(doc, 'span', 'title')
    title.dataset.wmTitle = ''
    const strip = part(doc, 'div', 'tabs')
    strip.setAttribute('role', 'tablist')
    strip.setAttribute('aria-label', messages.tabs ?? (elementsMessages.tabs as string))
    strip.hidden = true
    strip.addEventListener('click', (event) => {
      const id = (event.target as HTMLElement).dataset.windowId
      if (id && this.manager?.activateTab(id)) {
        const next = (this.host as WmDesktopElement).windows.get(id)?.shadowRoot
        next?.querySelector<HTMLElement>('[part~=active]')?.focus()
      }
    })
    strip.addEventListener('keydown', (event) => {
      const tabs = [...strip.children] as HTMLElement[]
      const at = tabs.indexOf(event.target as HTMLElement)
      const to = (
        { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: tabs.length - 1 } as Record<
          string,
          number
        >
      )[event.key]
      if (to === undefined) return
      event.preventDefault()
      const next = tabs[(to + tabs.length) % tabs.length] as HTMLElement
      for (const tab of tabs) tab.tabIndex = tab === next ? 0 : -1
      next.focus()
    })
    const actions = doc.createElement('slot')
    actions.name = 'actions'
    const controls = doc.createElement('span')
    controls.dataset.wmControls = ''
    for (const [action, flag] of [
      ['minimize', 'minimizable'],
      ['maximize', 'maximizable'],
      ['close', 'closable'],
    ] as const) {
      const button = part(doc, 'button', `control ${action}`)
      button.setAttribute('type', 'button')
      button.setAttribute('aria-label', messages[action])
      button.setAttribute(`data-wm-${action}`, '')
      controls.append(button)
      this.controls.push([flag, button])
    }
    bar.append(title, strip, actions, controls)
    const content = part(doc, 'div', 'content')
    content.append(doc.createElement('slot'))
    root.append(style, bar, content)
  }
}

export interface DefineOptions {
  prefix?: string
}

export function defineWmElements(options: DefineOptions = {}): void {
  if (typeof customElements === 'undefined') return
  const prefix = options.prefix ?? 'wm'
  if (!customElements.get(`${prefix}-desktop`)) {
    customElements.define(`${prefix}-desktop`, class extends WmDesktopElement {})
  }
  if (!customElements.get(`${prefix}-window`)) {
    customElements.define(`${prefix}-window`, class extends WmWindowElement {})
  }
}
