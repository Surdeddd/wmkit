import { computed, DestroyRef, inject, type Signal, signal } from '@angular/core'
import { createWindowManager } from '../core/manager'
import type { ManagerOptions, ManagerState, WindowManager, WindowState } from '../core/types'
import { createDesktopBinder, type DesktopBinder } from '../dom/binder'
import type { DesktopOptions, WindowAttachOptions } from '../dom/shared'

function onDestroy(dispose: () => void): void {
  let destroyRef: DestroyRef | null = null
  try {
    destroyRef = inject(DestroyRef)
  } catch {
    destroyRef = null
  }
  destroyRef?.onDestroy(dispose)
}

export function useWindowManager(options?: ManagerOptions): WindowManager {
  const wm = createWindowManager(options)
  onDestroy(() => wm.destroy())
  return wm
}

export function useWmState(wm: WindowManager): Signal<ManagerState> {
  const state = signal(wm.getState())
  const stop = wm.subscribe((next) => state.set(next))
  onDestroy(stop)
  return state.asReadonly()
}

export function useWmWindow(wm: WindowManager, id: string): Signal<WindowState | undefined> {
  const state = useWmState(wm)
  return computed(() => state().windows[id])
}

export interface AngularDesktop {
  binder: DesktopBinder
  desktop(element: HTMLElement): void
  window(id: string, options?: WindowAttachOptions): (element: HTMLElement) => void
}

export function createDesktop(wm: WindowManager, options?: DesktopOptions): AngularDesktop {
  const binder = createDesktopBinder(wm, options)
  return {
    binder,
    desktop(element) {
      const unbind = binder.bindDesktop(element)
      onDestroy(unbind)
    },
    window(id, windowOptions) {
      return (element) => {
        const unbind = binder.bindWindow(id, element, windowOptions)
        onDestroy(unbind)
      }
    },
  }
}
