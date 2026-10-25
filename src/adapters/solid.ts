import {
  type Accessor,
  createMemo,
  createSignal,
  getOwner,
  onCleanup,
  onMount,
  untrack,
} from 'solid-js'
import { createWindowManager } from '../core/manager'
import type { ManagerOptions, ManagerState, WindowManager, WindowState } from '../core/types'
import { createDesktopBinder, type DesktopBinder } from '../dom/binder'
import type { DesktopOptions, WindowAttachOptions } from '../dom/shared'

function disposeWithOwner(dispose: () => void): void {
  if (getOwner()) onCleanup(dispose)
}

function bindMounted(bind: () => () => void): void {
  if (getOwner()) onMount(() => onCleanup(bind()))
  else bind()
}

export function useWindowManager(options?: ManagerOptions): WindowManager {
  const wm = createWindowManager(options)
  disposeWithOwner(() => wm.destroy())
  return wm
}

export function useWmState(wm: WindowManager): Accessor<ManagerState> {
  const [state, setState] = createSignal(wm.getState())
  disposeWithOwner(wm.subscribe(setState))
  return state
}

export function useWmWindow(
  wm: WindowManager,
  id: string | Accessor<string>,
): Accessor<WindowState | undefined> {
  const state = useWmState(wm)
  const read = () => state().windows[typeof id === 'function' ? id() : id]
  if (!getOwner()) return read
  const win = createMemo(read)
  return () => {
    win()
    return untrack(read)
  }
}

export interface SolidDesktop {
  binder: DesktopBinder
  desktop(element: HTMLElement): void
  window(id: string, options?: WindowAttachOptions): (element: HTMLElement) => void
}

export function createDesktop(wm: WindowManager, options?: DesktopOptions): SolidDesktop {
  const binder = createDesktopBinder(wm, options)
  disposeWithOwner(() => binder.destroy())
  return {
    binder,
    desktop(element) {
      bindMounted(() => binder.bindDesktop(element))
    },
    window(id, options) {
      return (element) => bindMounted(() => binder.bindWindow(id, element, options))
    },
  }
}
