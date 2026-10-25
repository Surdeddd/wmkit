import { nothing, type ReactiveController, type ReactiveControllerHost } from 'lit'
import {
  AsyncDirective,
  directive,
  type ElementPart,
  type PartInfo,
  PartType,
} from 'lit/async-directive.js'
import type { ManagerState, WindowManager, WindowState } from '../core/types'
import type { DesktopBinder } from '../dom/binder'
import type { WindowAttachOptions } from '../dom/shared'

export class WmStateController implements ReactiveController {
  state: ManagerState
  private stop: (() => void) | null = null

  constructor(
    private readonly host: ReactiveControllerHost,
    readonly wm: WindowManager,
  ) {
    this.state = wm.getState()
    host.addController(this)
  }

  hostConnected(): void {
    const sync = () => {
      const next = this.wm.getState()
      if (next === this.state) return
      this.state = next
      this.host.requestUpdate()
    }
    this.stop = this.wm.subscribe(sync)
    sync()
  }

  hostDisconnected(): void {
    this.stop?.()
    this.stop = null
  }
}

export class WmWindowController implements ReactiveController {
  window: WindowState | undefined
  private stop: (() => void) | null = null

  constructor(
    private readonly host: ReactiveControllerHost,
    readonly wm: WindowManager,
    readonly id: string,
  ) {
    this.window = wm.get(id)
    host.addController(this)
  }

  hostConnected(): void {
    const sync = () => {
      const next = this.wm.get(this.id)
      if (next === this.window) return
      this.window = next
      this.host.requestUpdate()
    }
    this.stop = this.wm.subscribe(sync)
    sync()
  }

  hostDisconnected(): void {
    this.stop?.()
    this.stop = null
  }
}

abstract class BindingDirective<A extends unknown[]> extends AsyncDirective {
  private release: (() => void) | null = null
  private element: HTMLElement | null = null
  private args: A | null = null

  constructor(info: PartInfo) {
    super(info)
    if (info.type !== PartType.ELEMENT)
      throw new Error('wmkit: this directive belongs on an element')
  }

  protected abstract bind(element: HTMLElement, ...args: A): () => void

  protected same(next: A): boolean {
    return this.args !== null && next.every((value, i) => value === (this.args as A)[i])
  }

  render(..._args: A): typeof nothing {
    return nothing
  }

  override update(part: ElementPart, args: A): typeof nothing {
    const element = part.element as HTMLElement
    if (element !== this.element || !this.same(args)) {
      this.release?.()
      this.element = element
      this.args = args
      this.release = this.bind(element, ...args)
    }
    return this.render(...args)
  }

  protected override disconnected(): void {
    this.release?.()
    this.release = null
  }

  protected override reconnected(): void {
    if (this.element && this.args) this.release = this.bind(this.element, ...this.args)
  }
}

class DesktopDirective extends BindingDirective<[DesktopBinder]> {
  protected bind(element: HTMLElement, binder: DesktopBinder): () => void {
    return binder.bindDesktop(element)
  }
}

class WindowDirective extends BindingDirective<[DesktopBinder, string, WindowAttachOptions?]> {
  protected bind(
    element: HTMLElement,
    binder: DesktopBinder,
    id: string,
    options?: WindowAttachOptions,
  ): () => void {
    return binder.bindWindow(id, element, options)
  }
}

export const wmDesktop = directive(DesktopDirective)
export const wmWindow = directive(WindowDirective)
