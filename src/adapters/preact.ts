import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks'
import { createWindowManager } from '../core/manager'
import type { ManagerOptions, ManagerState, WindowManager, WindowState } from '../core/types'
import { createDesktopBinder, type DesktopBinder } from '../dom/binder'
import type { DesktopController, DesktopOptions, WindowAttachOptions } from '../dom/shared'

export type ElementRef = (node: HTMLElement | null) => void

export function useWindowManager(options?: ManagerOptions): WindowManager {
  const [wm] = useState(() => createWindowManager(options))
  useEffect(() => () => wm.destroy(), [wm])
  return wm
}

function useSnapshot<T>(wm: WindowManager, read: () => T): T {
  const [, rerender] = useState(0)
  const value = read()
  const shown = useRef(value)
  shown.current = value
  useLayoutEffect(() => {
    const check = () => {
      if (read() !== shown.current) rerender((n) => n + 1)
    }
    const stop = wm.subscribe(check)
    check()
    return stop
  }, [wm, read])
  return value
}

export function useWmState(wm: WindowManager): ManagerState {
  return useSnapshot(wm, wm.getState)
}

export function useWmWindow(wm: WindowManager, id: string): WindowState | undefined {
  const read = useCallback(() => wm.get(id), [wm, id])
  return useSnapshot(wm, read)
}

export interface UseDesktopResult {
  ref: ElementRef
  binder: DesktopBinder
  controller(): DesktopController | null
}

export function useDesktop(wm: WindowManager, options?: DesktopOptions): UseDesktopResult {
  const optionsRef = useRef(options)
  const binder = useMemo(() => createDesktopBinder(wm, optionsRef.current), [wm])
  useEffect(() => () => binder.destroy(), [binder])
  const cleanupRef = useRef<(() => void) | null>(null)
  const ref = useCallback<ElementRef>(
    (node) => {
      cleanupRef.current?.()
      cleanupRef.current = node ? binder.bindDesktop(node) : null
    },
    [binder],
  )
  return { ref, binder, controller: binder.controller }
}

export function useWmWindowRef(
  binder: DesktopBinder,
  id: string,
  options?: Omit<WindowAttachOptions, 'removeOnClose'>,
): ElementRef {
  const optionsRef = useRef(options)
  const cleanupRef = useRef<(() => void) | null>(null)
  return useCallback<ElementRef>(
    (node) => {
      cleanupRef.current?.()
      cleanupRef.current = node
        ? binder.bindWindow(id, node, { ...optionsRef.current, removeOnClose: false })
        : null
    },
    [binder, id],
  )
}
