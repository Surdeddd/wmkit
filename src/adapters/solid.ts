import { type Accessor, createSignal, getOwner, onCleanup } from 'solid-js'
import { createWindowManager } from '../core/manager'
import type { ManagerOptions, ManagerState, WindowManager, WindowState } from '../core/types'
import { createDesktopBinder, type DesktopBinder } from '../dom/binder'
import type { DesktopOptions, WindowAttachOptions } from '../dom/shared'

function disposeWithOwner(dispose: () => void): void {
  if (getOwner()) onCleanup(dispose)
}

export function useWindowManager(options?: ManagerOptions): WindowManager {
  const wm = createWindowManager(options)
  disposeWithOwner(() => wm.destroy())
  return wm
}

export function useWmState(wm: WindowManager): Accessor<ManagerState> {
  const [state, setState] = createSignal(wm.getState())
  disposeWithOwner(wm.subscribe((next) => setState(next)))
  return state
}

export function useWmWindow(
  wm: WindowManager,
  id: string | Accessor<string>,
): Accessor<WindowState | undefined> {
  const state = useWmState(wm)
  return () => state().windows[typeof id === 'function' ? id() : id]
}

export interface SolidDesktop {
  binder: DesktopBinder
  desktop(element: HTMLElement): void
  window(id: string, options?: WindowAttachOptions): (element: HTMLElement) => void
}

export function createDesktop(wm: WindowManager, options?: DesktopOptions): SolidDesktop {
  const binder = createDesktopBinder(wm, options)
  return {
    binder,
    desktop(element) {
      const unbind = binder.bindDesktop(element)
      disposeWithOwner(unbind)
    },
    window(id, options) {
      return (element) => {
        const unbind = binder.bindWindow(id, element, options)
        disposeWithOwner(unbind)
      }
    },
  }
}
