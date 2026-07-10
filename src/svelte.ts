import { createWindowManager } from './core/manager'
import type { ManagerOptions, ManagerState, WindowManager, WindowState } from './core/types'
import {
  createDesktopBinder,
  type DesktopBinder,
  type DesktopOptions,
  type WindowAttachOptions,
} from './dom/controller'

export interface ReadableStore<T> {
  subscribe(run: (value: T) => void): () => void
}

export interface ActionResult {
  update?(params: WindowActionParams): void
  destroy(): void
}

export interface WindowActionParams extends WindowAttachOptions {
  id: string
}

export function createManager(options?: ManagerOptions): WindowManager {
  return createWindowManager(options)
}

export function wmStore(wm: WindowManager): ReadableStore<ManagerState> {
  return {
    subscribe(run) {
      run(wm.getState())
      return wm.subscribe(run)
    },
  }
}

export function wmWindowStore(
  wm: WindowManager,
  id: string,
): ReadableStore<WindowState | undefined> {
  return {
    subscribe(run) {
      run(wm.get(id))
      let last = wm.get(id)
      return wm.subscribe(() => {
        const next = wm.get(id)
        if (next !== last) {
          last = next
          run(next)
        }
      })
    },
  }
}

export interface SvelteDesktop {
  binder: DesktopBinder
  desktop(node: HTMLElement): ActionResult
  window(node: HTMLElement, params: WindowActionParams): ActionResult
}

export function createDesktop(wm: WindowManager, options?: DesktopOptions): SvelteDesktop {
  const binder = createDesktopBinder(wm, options)
  return {
    binder,
    desktop(node) {
      const unbind = binder.bindDesktop(node)
      return { destroy: unbind }
    },
    window(node, params) {
      let unbind = binder.bindWindow(params.id, node, params)
      return {
        update(next) {
          unbind()
          unbind = binder.bindWindow(next.id, node, next)
        },
        destroy() {
          unbind()
        },
      }
    },
  }
}
