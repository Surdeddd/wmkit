import { createWindowManager } from '../../core/manager'
import type { WindowManager, WindowState } from '../../core/types'
import { attachDesktop } from '../../dom/controller'
import {
  type DesktopController,
  type DesktopOptions,
  INTERACTIVE_SELECTOR,
  type SkinContext,
} from '../../dom/shared'
import { type Length, resolveLength, resolvePosition } from './parse'
import { WINBOX_CSS } from './styles'

export type { Length } from './parse'

type Callback = (this: WinBox) => void

export interface WinBoxOptions {
  id?: string | number
  index?: number
  title?: string
  root?: HTMLElement
  mount?: Node
  html?: string
  url?: string
  width?: Length
  height?: Length
  minwidth?: Length
  minheight?: Length
  maxwidth?: Length
  maxheight?: Length
  autosize?: boolean
  overflow?: boolean
  x?: Length
  y?: Length
  max?: boolean
  min?: boolean
  hidden?: boolean
  modal?: boolean
  top?: Length
  right?: Length
  bottom?: Length
  left?: Length
  background?: string
  border?: number | string
  icon?: string
  class?: string | readonly string[]
  oncreate?: (this: WinBox, options: WinBoxOptions) => void
  onclose?: (this: WinBox, force?: boolean) => unknown
  onmove?: (this: WinBox, x: number, y: number) => void
  onresize?: (this: WinBox, width: number, height: number) => void
  onfocus?: Callback
  onblur?: Callback
  onshow?: Callback
  onhide?: Callback
  onminimize?: Callback
  onmaximize?: Callback
  onrestore?: Callback
  onfullscreen?: Callback
}

export interface WinBoxControl {
  index?: number
  class: string
  image?: string
  click?: (this: WinBox, event: MouseEvent, box: WinBox) => void
}

export interface WinBoxMessages {
  minimize: string
  maximize: string
  fullscreen: string
  close: string
}

export const winboxMessages: WinBoxMessages = {
  minimize: 'Minimize',
  maximize: 'Maximize',
  fullscreen: 'Fullscreen',
  close: 'Close',
}

export const winboxMessagesRu: WinBoxMessages = {
  minimize: 'Свернуть',
  maximize: 'Развернуть',
  fullscreen: 'Во весь экран',
  close: 'Закрыть',
}

export interface WinBoxConfig
  extends Pick<DesktopOptions, 'snap' | 'keyboard' | 'magnetism' | 'announce' | 'grouping'> {
  styles?: boolean
  messages?: WinBoxMessages
}

interface Runtime {
  wm: WindowManager
  desktop: DesktopController
  layer: HTMLElement
  strip: HTMLElement
  backdrop: HTMLElement
  insets: number[]
  sync(): void
}

const CALLBACKS = [
  'onclose',
  'onmove',
  'onresize',
  'onfocus',
  'onblur',
  'onshow',
  'onhide',
  'onminimize',
  'onmaximize',
  'onrestore',
  'onfullscreen',
] as const

const FLAGS: Record<
  string,
  'minimizable' | 'maximizable' | 'closable' | 'resizable' | 'draggable'
> = {
  'no-min': 'minimizable',
  'no-max': 'maximizable',
  'no-close': 'closable',
  'no-resize': 'resizable',
  'no-move': 'draggable',
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const

const runtimes = new WeakMap<HTMLElement, Map<string, Runtime>>()
const boxes = new Map<string, WinBox>()
const history: WinBox[] = []
const watchedDocs = new WeakSet<Document>()
let config: WinBoxConfig = {}
let counter = 0

function moveToEnd(box: WinBox): void {
  const index = history.indexOf(box)
  if (index !== -1) history.splice(index, 1)
  history.push(box)
}

function runtimeFor(root: HTMLElement, insets: number[], overflow: boolean): Runtime {
  const key = `${insets.join(',')}|${overflow}`
  const forRoot = runtimes.get(root) ?? new Map<string, Runtime>()
  runtimes.set(root, forRoot)
  const existing = forRoot.get(key)
  if (existing) return existing

  const doc = root.ownerDocument
  if (config.styles !== false && !doc.querySelector('style[data-wmkit-winbox]')) {
    const style = doc.createElement('style')
    style.dataset.wmkitWinbox = ''
    style.textContent = WINBOX_CSS
    doc.head.append(style)
  }
  const layer = doc.createElement('div')
  layer.dataset.winboxRoot = ''
  layer.style.position = root === doc.body ? 'fixed' : 'absolute'
  SIDES.forEach((side, i) => {
    layer.style[side] = `${insets[i]}px`
  })
  const backdrop = doc.createElement('div')
  backdrop.className = 'wb-backdrop'
  backdrop.hidden = true
  const strip = doc.createElement('div')
  strip.className = 'wb-strip'
  layer.append(backdrop, strip)
  root.append(layer)

  const outer = areaOf(root)
  const wm = createWindowManager({
    keepInViewport: !overflow,
    viewport: {
      width: outer.width - (insets[1] as number) - (insets[3] as number),
      height: outer.height - (insets[0] as number) - (insets[2] as number),
    },
  })
  const desktop = attachDesktop(wm, layer, {
    snap: config.snap,
    keyboard: config.keyboard,
    magnetism: config.magnetism,
    announce: config.announce,
    grouping: config.grouping ?? false,
    interactiveSelector: `${INTERACTIVE_SELECTOR}, .wb-control > *`,
    beforeClose: (win) => {
      const box = boxes.get(win.id)
      return !box?.onclose?.call(box, false)
    },
  })

  let focused: string | null = null
  let minimizedKey = ''
  const runtime: Runtime = {
    wm,
    desktop,
    layer,
    strip,
    backdrop,
    insets,
    sync() {
      const state = wm.getState()
      if (state.focusedId !== focused) {
        const previous = focused === null ? undefined : boxes.get(focused)
        const next = state.focusedId === null ? undefined : boxes.get(state.focusedId)
        if (state.focusedId === null || next) {
          focused = state.focusedId
          previous?.window.classList.remove('focus')
          previous?.onblur?.call(previous)
          if (next) {
            next.window.classList.add('focus')
            moveToEnd(next)
            next.onfocus?.call(next)
          }
        }
      }
      const minimized = wm.minimized()
      const keyNow = minimized.map((win) => `${win.id}:${win.title}`).join('\n')
      if (keyNow !== minimizedKey) {
        minimizedKey = keyNow
        strip.replaceChildren(
          ...minimized.map((win) => {
            const button = doc.createElement('button')
            button.type = 'button'
            button.textContent = win.title
            button.addEventListener('click', () => wm.restore(win.id))
            return button
          }),
        )
      }
      backdrop.hidden = !Object.values(state.windows).some(
        (win) => win.layer === 'modal' && win.stage !== 'minimized',
      )
    },
  }

  const each = (win: WindowState, run: (box: WinBox) => void) => {
    const box = boxes.get(win.id)
    if (box) run(box)
  }
  wm.subscribe(() => runtime.sync())
  wm.on('move', ({ window: win }) => each(win, (box) => box.onmove?.call(box, box.x, box.y)))
  wm.on('resize', ({ window: win }) =>
    each(win, (box) => box.onresize?.call(box, win.bounds.width, win.bounds.height)),
  )
  wm.on('stage', ({ window: win, previous }) =>
    each(win, (box) => {
      box.window.classList.toggle('min', win.stage === 'minimized')
      box.window.classList.toggle('max', win.stage === 'maximized')
      if (win.stage === 'minimized') box.onminimize?.call(box)
      else if (win.stage === 'maximized') box.onmaximize?.call(box)
      else if (previous === 'minimized' || previous === 'maximized') box.onrestore?.call(box)
    }),
  )
  wm.on('close', ({ window: win }) =>
    each(win, (box) => {
      box.unmount()
      boxes.delete(win.id)
      const index = history.indexOf(box)
      if (index !== -1) history.splice(index, 1)
    }),
  )

  if (!watchedDocs.has(doc)) {
    watchedDocs.add(doc)
    doc.addEventListener('fullscreenchange', () => {
      for (const box of boxes.values()) {
        const full = doc.fullscreenElement === box.body
        if (full === box.full) continue
        box.full = full
        box.window.classList.toggle('full', full)
        if (full) box.onfullscreen?.call(box)
        else box.onrestore?.call(box)
      }
    })
  }

  forRoot.set(key, runtime)
  return runtime
}

function areaOf(root: HTMLElement): { width: number; height: number } {
  const view = root.ownerDocument.defaultView
  if (root === root.ownerDocument.body && view) {
    return { width: view.innerWidth, height: view.innerHeight }
  }
  return { width: root.clientWidth, height: root.clientHeight }
}

export class WinBox {
  readonly id: string
  readonly window: HTMLElement
  readonly body: HTMLElement
  full = false
  hidden = false
  onclose?: WinBoxOptions['onclose']
  onmove?: WinBoxOptions['onmove']
  onresize?: WinBoxOptions['onresize']
  onfocus?: Callback
  onblur?: Callback
  onshow?: Callback
  onhide?: Callback
  onminimize?: Callback
  onmaximize?: Callback
  onrestore?: Callback
  onfullscreen?: Callback
  private readonly runtime: Runtime
  private mounted: { node: Node; parent: Node | null; next: Node | null } | null = null

  static new(title?: string | WinBoxOptions, options?: WinBoxOptions): WinBox {
    return new WinBox(title, options)
  }

  static stack(): WinBox[] {
    return [...history]
  }

  static manager(root?: HTMLElement): WindowManager {
    return runtimeFor(root ?? document.body, [0, 0, 0, 0], false).wm
  }

  static configure(next: WinBoxConfig): void {
    config = { ...config, ...next }
  }

  constructor(title?: string | WinBoxOptions, options: WinBoxOptions = {}) {
    const given = typeof title === 'object' ? title : { ...options, title: title ?? options.title }
    const settings: WinBoxOptions = { ...given }
    settings.oncreate?.call(this, settings)
    for (const key of CALLBACKS) {
      const callback = settings[key]
      if (callback) (this as unknown as Record<string, unknown>)[key] = callback
    }

    const root = settings.root ?? document.body
    const outer = areaOf(root)
    const insets = SIDES.map((side, i) =>
      resolveLength(settings[side], i % 2 ? outer.width : outer.height, 0),
    )
    const [top, right, bottom, left] = insets as [number, number, number, number]
    const area = { width: outer.width - left - right, height: outer.height - top - bottom }
    this.runtime = runtimeFor(root, insets, settings.overflow === true)
    const { wm } = this.runtime

    const classes =
      typeof settings.class === 'string'
        ? settings.class.split(/\s+/).filter(Boolean)
        : [...(settings.class ?? [])]
    const width = resolveLength(settings.width, area.width, area.width / 2)
    const height = resolveLength(settings.height, area.height, area.height / 2)
    const minimum = (value: Length | undefined, total: number) =>
      value === undefined ? undefined : resolveLength(value, total, 0)
    const id = settings.id === undefined ? `winbox-${++counter}` : String(settings.id)
    this.id = id
    wm.open({
      id,
      title: settings.title ?? '',
      x: resolvePosition(settings.x, width, area.width, 'right'),
      y: resolvePosition(settings.y, height, area.height, 'bottom'),
      width,
      height,
      minWidth: minimum(settings.minwidth, area.width),
      minHeight: minimum(settings.minheight, area.height),
      maxWidth: minimum(settings.maxwidth, area.width),
      maxHeight: minimum(settings.maxheight, area.height),
      layer: settings.modal ? 'modal' : 'normal',
      ...Object.fromEntries(
        classes.filter((name) => FLAGS[name]).map((name) => [FLAGS[name], false]),
      ),
    })

    const messages = config.messages ?? winboxMessages
    const mounted = this.runtime.desktop.mountWindow(
      id,
      ({ doc, window: win }: SkinContext) => {
        const part = (name: string, tag = 'div') => {
          const node = doc.createElement(tag)
          node.className = name
          return node
        }
        const element = part('winbox')
        element.id = id
        const header = part('wb-header')
        header.dataset.wmDrag = ''
        const control = part('wb-control')
        for (const [name, action, label] of [
          ['wb-min', 'wmMinimize', messages.minimize],
          ['wb-max', 'wmMaximize', messages.maximize],
          ['wb-full', '', messages.fullscreen],
          ['wb-close', 'wmClose', messages.close],
        ] as const) {
          const button = part(name, 'span')
          button.setAttribute('role', 'button')
          button.setAttribute('aria-label', label)
          if (action) button.dataset[action] = ''
          else button.addEventListener('click', () => this.fullscreen(!this.full))
          control.append(button)
        }
        const drag = part('wb-drag')
        const title = part('wb-title')
        title.dataset.wmTitle = ''
        title.textContent = win.title
        drag.append(part('wb-icon'), title)
        header.append(control, drag)
        const content = part('wb-body')
        content.dataset.wmContent = ''
        element.append(header, content)
        return { element, content }
      },
      { removeOnClose: true },
    )
    this.window = mounted.element
    this.body = mounted.content
    this.window.classList.add(...classes, ...(settings.modal ? ['modal'] : []))
    if (settings.background) this.setBackground(settings.background)
    if (settings.border !== undefined) {
      this.window.style.setProperty(
        '--wb-border',
        typeof settings.border === 'number' ? `${settings.border}px` : settings.border,
      )
    }
    if (settings.icon) this.setIcon(settings.icon)
    if (settings.mount) this.mount(settings.mount)
    else if (settings.html !== undefined) this.body.innerHTML = settings.html
    else if (settings.url) this.setUrl(settings.url)

    boxes.set(id, this)
    history.push(this)
    this.runtime.sync()
    if (settings.autosize) {
      const header = this.window.firstElementChild as HTMLElement
      this.resize(this.body.scrollWidth, this.body.scrollHeight + header.offsetHeight)
    }
    if (settings.max) this.maximize()
    if (settings.min) this.minimize()
    if (settings.hidden) this.hide()
  }

  private get state(): WindowState | undefined {
    return this.runtime.wm.get(this.id)
  }

  get index(): number {
    return Number(this.window.style.zIndex)
  }

  get x(): number {
    return this.state?.bounds.x ?? 0
  }

  set x(value: number) {
    this.move(value, this.y)
  }

  get y(): number {
    return this.state?.bounds.y ?? 0
  }

  set y(value: number) {
    this.move(this.x, value)
  }

  get width(): number {
    return this.state?.bounds.width ?? 0
  }

  set width(value: number) {
    this.resize(value, this.height)
  }

  get height(): number {
    return this.state?.bounds.height ?? 0
  }

  set height(value: number) {
    this.resize(this.width, value)
  }

  get top(): number {
    return this.runtime.insets[0] as number
  }

  get right(): number {
    return this.runtime.insets[1] as number
  }

  get bottom(): number {
    return this.runtime.insets[2] as number
  }

  get left(): number {
    return this.runtime.insets[3] as number
  }

  get minwidth(): number {
    return this.state?.minSize.width ?? 0
  }

  set minwidth(value: number) {
    this.runtime.wm.update(this.id, { minSize: { width: value, height: this.minheight } })
  }

  get minheight(): number {
    return this.state?.minSize.height ?? 0
  }

  set minheight(value: number) {
    this.runtime.wm.update(this.id, { minSize: { width: this.minwidth, height: value } })
  }

  get maxwidth(): number {
    return this.state?.maxSize?.width ?? Number.POSITIVE_INFINITY
  }

  set maxwidth(value: number) {
    this.runtime.wm.update(this.id, { maxSize: { width: value, height: this.maxheight } })
  }

  get maxheight(): number {
    return this.state?.maxSize?.height ?? Number.POSITIVE_INFINITY
  }

  set maxheight(value: number) {
    this.runtime.wm.update(this.id, { maxSize: { width: this.maxwidth, height: value } })
  }

  get min(): boolean {
    return this.state?.stage === 'minimized'
  }

  get max(): boolean {
    return this.state?.stage === 'maximized'
  }

  get focused(): boolean {
    return this.runtime.wm.getState().focusedId === this.id
  }

  mount(node: Node): this {
    this.unmount()
    this.mounted = { node, parent: node.parentNode, next: node.nextSibling }
    this.body.append(node)
    return this
  }

  unmount(destination?: Node): this {
    const mounted = this.mounted
    if (!mounted) return this
    this.mounted = null
    const { node, parent, next } = mounted
    if (destination) destination.appendChild(node)
    else if (parent) parent.insertBefore(node, next?.parentNode === parent ? next : null)
    else node.parentNode?.removeChild(node)
    return this
  }

  setUrl(url: string): this {
    const frame = this.body.ownerDocument.createElement('iframe')
    frame.src = url
    this.body.replaceChildren(frame)
    return this
  }

  setTitle(title: string): this {
    this.runtime.wm.update(this.id, { title })
    return this
  }

  setIcon(url: string): this {
    const icon = this.window.querySelector<HTMLElement>('.wb-icon')
    if (icon) {
      icon.style.backgroundImage = `url(${JSON.stringify(url)})`
      icon.style.display = 'block'
    }
    return this
  }

  setBackground(background: string): this {
    this.window.style.background = background
    return this
  }

  move(x?: Length, y?: Length): this {
    const { clientWidth, clientHeight } = this.runtime.layer
    this.runtime.wm.move(
      this.id,
      x === undefined ? this.x : resolvePosition(x, this.width, clientWidth, 'right'),
      y === undefined ? this.y : resolvePosition(y, this.height, clientHeight, 'bottom'),
    )
    return this
  }

  resize(width?: Length, height?: Length): this {
    const area = this.runtime.layer
    this.runtime.wm.resize(this.id, {
      width: resolveLength(width, area.clientWidth, this.width),
      height: resolveLength(height, area.clientHeight, this.height),
    })
    return this
  }

  close(force?: boolean): boolean | undefined {
    if (!force && this.onclose?.call(this, force)) return true
    this.runtime.wm.close(this.id)
    return undefined
  }

  focus(state = true): this {
    if (!state) return this.blur()
    this.runtime.wm.focus(this.id)
    return this
  }

  blur(state = true): this {
    if (!state) return this.focus()
    if (this.focused) this.runtime.wm.blur()
    return this
  }

  hide(state = true): this {
    if (!state) return this.show()
    if (this.hidden) return this
    this.hidden = true
    this.window.classList.add('hide')
    this.blur()
    this.onhide?.call(this)
    return this
  }

  show(state = true): this {
    if (!state) return this.hide()
    if (!this.hidden) return this
    this.hidden = false
    this.window.classList.remove('hide')
    this.onshow?.call(this)
    return this
  }

  minimize(state = true): this {
    if (state) this.runtime.wm.minimize(this.id)
    else this.runtime.wm.restore(this.id)
    return this
  }

  maximize(state = true): this {
    if (state) this.runtime.wm.maximize(this.id)
    else this.runtime.wm.restore(this.id)
    return this
  }

  fullscreen(state = true): this {
    const doc = this.body.ownerDocument
    if (state && !this.full) void this.body.requestFullscreen?.()
    else if (!state && this.full) void doc.exitFullscreen?.()
    return this
  }

  restore(): this {
    if (this.full) this.fullscreen(false)
    this.runtime.wm.restore(this.id)
    return this
  }

  addClass(name: string): this {
    this.window.classList.add(name)
    const flag = FLAGS[name]
    if (flag) this.runtime.wm.update(this.id, { [flag]: false })
    return this
  }

  removeClass(name: string): this {
    this.window.classList.remove(name)
    const flag = FLAGS[name]
    if (flag) this.runtime.wm.update(this.id, { [flag]: true })
    return this
  }

  hasClass(name: string): boolean {
    return this.window.classList.contains(name)
  }

  toggleClass(name: string): this {
    return this.hasClass(name) ? this.removeClass(name) : this.addClass(name)
  }

  addControl(control: WinBoxControl): this {
    const holder = this.window.querySelector('.wb-control') as HTMLElement
    const button = this.window.ownerDocument.createElement('span')
    button.className = control.class
    button.setAttribute('role', 'button')
    if (control.image) button.style.backgroundImage = `url(${JSON.stringify(control.image)})`
    const click = control.click
    if (click) button.addEventListener('click', (event) => click.call(this, event, this))
    holder.insertBefore(button, holder.children[control.index ?? 0] ?? null)
    return this
  }

  removeControl(name: string): this {
    const holder = this.window.querySelector('.wb-control') as HTMLElement
    for (const child of [...holder.children]) {
      if (child.classList.contains(name)) child.remove()
    }
    return this
  }
}

interface WinBoxFactory {
  new (title?: string | WinBoxOptions, options?: WinBoxOptions): WinBox
  (title?: string | WinBoxOptions, options?: WinBoxOptions): WinBox
  new: typeof WinBox.new
  stack: typeof WinBox.stack
  manager: typeof WinBox.manager
  configure: typeof WinBox.configure
  prototype: WinBox
}

function create(title?: string | WinBoxOptions, options?: WinBoxOptions): WinBox {
  return new WinBox(title, options)
}

const factory = Object.assign(create, {
  new: WinBox.new,
  stack: WinBox.stack,
  manager: WinBox.manager,
  configure: WinBox.configure,
})
factory.prototype = WinBox.prototype

const WinBoxCompat = factory as unknown as WinBoxFactory
type WinBoxCompat = WinBox
export default WinBoxCompat
