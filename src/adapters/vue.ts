import {
  type ComputedRef,
  computed,
  getCurrentScope,
  type MaybeRefOrGetter,
  onScopeDispose,
  type Ref,
  type ShallowRef,
  shallowRef,
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

export function useWindowManager(options?: ManagerOptions): WindowManager {
  const wm = createWindowManager(options)
  disposeWithScope(() => wm.destroy())
  return wm
}

export function useWmState(wm: WindowManager): ShallowRef<ManagerState> {
  const state = shallowRef(wm.getState())
  disposeWithScope(
    wm.subscribe((next) => {
      state.value = next
    }),
  )
  return state
}

export function useWmWindow(
  wm: WindowManager,
  id: MaybeRefOrGetter<string>,
): ComputedRef<WindowState | undefined> {
  const state = useWmState(wm)
  return computed(() => state.value.windows[toValue(id)])
}

export function useDesktop(
  wm: WindowManager,
  target: Ref<HTMLElement | null | undefined>,
  options?: DesktopOptions,
): DesktopBinder {
  const binder = createDesktopBinder(wm, options)
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
