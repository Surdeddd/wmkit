import {
  computed,
  DestroyRef,
  type Injector,
  inject,
  type Signal,
  signal,
  untracked,
} from '@angular/core'
import { createWindowManager } from '../core/manager'
import type { ManagerOptions, ManagerState, WindowManager, WindowState } from '../core/types'
import { createDesktopBinder, type DesktopBinder } from '../dom/binder'
import type { DesktopOptions, WindowAttachOptions } from '../dom/shared'

export type WmLifetime = DestroyRef | Injector

function destroyRefOf(lifetime?: WmLifetime): DestroyRef | null {
  if (lifetime) return 'onDestroy' in lifetime ? lifetime : lifetime.get(DestroyRef)
  try {
    return inject(DestroyRef)
  } catch {
    return null
  }
}

function onDestroy(dispose: () => void, owner = destroyRefOf()): () => void {
  let live = true
  const release = () => {
    if (live) {
      live = false
      dispose()
    }
  }
  const off = owner?.onDestroy(release)
  return () => {
    off?.()
    release()
  }
}

export function useWindowManager(options?: ManagerOptions): WindowManager {
  const wm = createWindowManager(options)
  onDestroy(() => wm.destroy())
  return wm
}

export function useWmState(wm: WindowManager): Signal<ManagerState> {
  const state = signal(wm.getState())
  const stop = wm.subscribe((next) => untracked(() => state.set(next)))
  onDestroy(stop)
  return state.asReadonly()
}

export function useWmWindow(wm: WindowManager, id: string): Signal<WindowState | undefined> {
  const state = useWmState(wm)
  return computed(() => state().windows[id])
}

export interface AngularDesktop {
  binder: DesktopBinder
  desktop(element: HTMLElement, lifetime?: WmLifetime): () => void
  window(
    id: string,
    options?: WindowAttachOptions,
    lifetime?: WmLifetime,
  ): (element: HTMLElement) => () => void
}

interface WindowBinding {
  id: string
  element: HTMLElement
  release(): void
}

export function createDesktop(wm: WindowManager, options?: DesktopOptions): AngularDesktop {
  const binder = createDesktopBinder(wm, options)
  const bindings = new Set<WindowBinding>()
  onDestroy(() => binder.destroy())
  return {
    binder,
    desktop(element, lifetime) {
      return onDestroy(binder.bindDesktop(element), destroyRefOf(lifetime))
    },
    window(id, windowOptions, lifetime) {
      const owner = destroyRefOf(lifetime)
      return (element) => {
        for (const binding of bindings) {
          if (binding.id === id && !binding.element.isConnected) binding.release()
        }
        const unbind = binder.bindWindow(id, element, windowOptions)
        const binding: WindowBinding = {
          id,
          element,
          release: onDestroy(() => {
            bindings.delete(binding)
            unbind()
          }, owner),
        }
        bindings.add(binding)
        return binding.release
      }
    },
  }
}
