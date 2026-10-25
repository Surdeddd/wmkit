import {
  type ComputedRef,
  computed,
  getCurrentInstance,
  getCurrentScope,
  inject,
  type MaybeRefOrGetter,
  onScopeDispose,
  type Ref,
  shallowRef,
  ssrContextKey,
  toRef,
  toValue,
  watch,
} from 'vue'
import { createWindowManager } from '../core/manager'
import type { ManagerOptions, ManagerState, WindowManager, WindowState } from '../core/types'
import { createDesktopBinder, type DesktopBinder } from '../dom/binder'
import type { DesktopOptions, WindowAttachOptions } from '../dom/shared'

function disposeWithScope(dispose: () => void): void {
  if (getCurrentScope()) onScopeDispose(dispose)
}

function follow<T>(wm: WindowManager, read: () => T): ComputedRef<T> {
  if (getCurrentInstance() && inject(ssrContextKey, null)) return toRef(read) as ComputedRef<T>
  const seen = shallowRef(read())
  disposeWithScope(
    wm.subscribe(() => {
      seen.value = read()
    }),
  )
  return computed(() => {
    seen.value
    return read()
  })
}

export function useWindowManager(options?: ManagerOptions): WindowManager {
  const wm = createWindowManager(options)
  disposeWithScope(wm.destroy)
  return wm
}

export function useWmState(wm: WindowManager): ComputedRef<ManagerState> {
  return follow(wm, wm.getState)
}

export function useWmWindow(
  wm: WindowManager,
  id: MaybeRefOrGetter<string>,
): ComputedRef<WindowState | undefined> {
  return follow(wm, () => wm.get(toValue(id)))
}

export function useDesktop(
  wm: WindowManager,
  target: Ref<HTMLElement | null | undefined>,
  options?: DesktopOptions,
): DesktopBinder {
  const binder = createDesktopBinder(wm, options)
  disposeWithScope(binder.destroy)
  watch(
    target,
    (element, _previous, onCleanup) => {
      if (element) onCleanup(binder.bindDesktop(element))
    },
    { immediate: true, flush: 'post' },
  )
  return binder
}

export function useWmWindowEl(
  binder: DesktopBinder,
  id: MaybeRefOrGetter<string>,
  target: Ref<HTMLElement | null | undefined>,
  options?: WindowAttachOptions,
): void {
  watch(
    [target, () => toValue(id)],
    ([element, windowId], _previous, onCleanup) => {
      if (element && windowId) onCleanup(binder.bindWindow(windowId, element, options))
    },
    { immediate: true, flush: 'post' },
  )
}
