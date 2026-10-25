import { createWindowManager } from '../../core/manager'
import type {
  ManagerOptions,
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
}

export const elementsMessages: ElementsMessages = {
  minimize: 'Minimize',
  maximize: 'Maximize',
  close: 'Close',
}

export const elementsMessagesRu: ElementsMessages = {
  minimize: 'Свернуть',
  maximize: 'Развернуть',
  close: 'Закрыть',
}

export type WmDesktopOptions = DesktopOptions & ManagerOptions

const CHROME_CSS = `:host{position:absolute;left:0;top:0;display:flex;flex-direction:column;box-sizing:border-box;color:var(--wm-text,#1d1d1f);background:var(--wm-bg,#fff);border:1px solid var(--wm-border,rgba(0,0,0,.14));border-radius:var(--wm-radius,10px);box-shadow:var(--wm-shadow,0 8px 28px rgba(0,0,0,.2))}
:host([hidden]),:host([closed]){display:none!important}
[part=titlebar]{border-radius:inherit;border-bottom-left-radius:0;border-bottom-right-radius:0;display:flex;align-items:center;gap:6px;flex:none;height:36px;padding:0 6px 0 12px;background:var(--wm-titlebar-bg,transparent);user-select:none;-webkit-user-select:none;touch-action:none}
[part=title]{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:600 13px/1 system-ui,sans-serif}
[part~=control]{width:24px;height:24px;padding:0;border:0;border-radius:6px;background:none;color:inherit;font:16px/1 system-ui,sans-serif;cursor:pointer;opacity:.7}
[part~=control]:hover,[part~=control]:focus-visible{opacity:1;outline:2px solid var(--wm-accent,currentColor)}
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

const READ = Symbol('wmkit')
const OPEN = Symbol('wmkit-open')

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

export class WmDesktopElement extends HTMLElement {
  manager: WindowManager | null = null
  controller: DesktopController | null = null
  options: WmDesktopOptions = {}
  messages: ElementsMessages | null = null
  readonly windows = new Map<string, WmWindowElement>()
  private store: PersistController | null = null
  private stops: Array<() => void> = []

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
    const route =
      (type: string, pick: (payload: { window: WindowState }) => WindowState) =>
      (payload: { window: WindowState }) => {
        const element = this.windows.get(pick(payload).id)
        if (element) element[READ](type, payload)
      }
    this.stops = [
      wm.on(
        'move',
        route('wm-move', (p) => p.window),
      ),
      wm.on(
        'resize',
        route('wm-resize', (p) => p.window),
      ),
      wm.on(
        'stage',
        route('wm-stage', (p) => p.window),
      ),
      wm.on(
        'focus',
        route('wm-focus', (p) => p.window),
      ),
      wm.on(
        'close',
        route('wm-close', (p) => p.window),
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
}

export class WmWindowElement extends HTMLElement {
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

  get manager(): WindowManager | null {
    return this.host?.manager ?? null
  }

  connectedCallback(): void {
    this[OPEN]()
  }

  disconnectedCallback(): void {
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
      if (value === null) this[OPEN]()
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
      wm.resize(id, { width: numberAt(this, 'width'), height: numberAt(this, 'height') })
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

  [READ](type: string, payload: { window: WindowState }): void {
    if (type === 'wm-stage') this.reflect('stage', payload.window.stage)
    if (type === 'wm-close') {
      this.release(false)
      this.reflect('closed', '')
    }
    emit(this, type, payload)
  }

  private reflect(name: string, value: string): void {
    this.quiet = true
    this.setAttribute(name, value)
    this.quiet = false
  }

  [OPEN](): void {
    let host = this.parentElement
    while (host && !(host instanceof WmDesktopElement)) host = host.parentElement
    this.chrome(host?.messages ?? catalogueFor(this))
    const wm = host?.manager
    const controller = host?.controller
    if (this.detach || this.hasAttribute('closed') || !host || !wm || !controller) return
    this.host = host
    const init: WindowInit = {
      id: this.getAttribute('window-id') ?? this.windowId ?? undefined,
      title: this.getAttribute('label') ?? '',
      stage: (this.getAttribute('stage') ?? undefined) as WindowInit['stage'],
      layer: (this.getAttribute('layer') ?? undefined) as WindowInit['layer'],
    }
    for (const [attribute, key] of Object.entries(NUMBERS)) {
      const value = numberAt(this, attribute)
      if (value !== undefined) (init as Record<string, unknown>)[key] = value
    }
    for (const flag of FLAGS) if (this.getAttribute(flag) === 'false') init[flag] = false
    const existing = init.id === undefined ? undefined : wm.get(init.id)
    const id = existing?.id ?? wm.open(init).id
    this.windowId = id
    host.windows.set(id, this)
    this.detach = controller.attachWindow(id, this)
    emit(this, 'wm-open', { window: wm.get(id) })
  }

  private release(close: boolean): void {
    const host = this.host
    const id = this.windowId
    if (!host || !id || !this.detach) return
    const detach = this.detach
    this.detach = null
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
    const part = (tag: string, name: string) => {
      const node = doc.createElement(tag)
      node.setAttribute('part', name)
      return node
    }
    const bar = part('header', 'titlebar')
    bar.dataset.wmDrag = ''
    const title = part('span', 'title')
    title.dataset.wmTitle = ''
    const actions = doc.createElement('slot')
    actions.name = 'actions'
    bar.append(title, actions)
    for (const [action, glyph, label] of [
      ['wmMinimize', '–', messages.minimize],
      ['wmMaximize', '□', messages.maximize],
      ['wmClose', '×', messages.close],
    ] as const) {
      const button = part('button', `control ${action.slice(2).toLowerCase()}`)
      button.setAttribute('type', 'button')
      button.setAttribute('aria-label', label)
      button.dataset[action] = ''
      button.textContent = glyph
      bar.append(button)
    }
    const content = part('div', 'content')
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
