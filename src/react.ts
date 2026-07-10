import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createWindowManager } from './core/manager'
import type { ManagerOptions, ManagerState, WindowManager, WindowState } from './core/types'
import {
  createDesktopBinder,
  type DesktopBinder,
  type DesktopController,
  type DesktopOptions,
  type WindowAttachOptions,
} from './dom/controller'

export type ElementRef = (node: HTMLElement | null) => void

export function useWindowManager(options?: ManagerOptions): WindowManager {
  const [wm] = useState(() => createWindowManager(options))
  useEffect(() => () => wm.destroy(), [wm])
  return wm
}

export function useWmState(wm: WindowManager): ManagerState {
  return useSyncExternalStore(wm.subscribe, wm.getState, wm.getState)
}

export function useWmWindow(wm: WindowManager, id: string): WindowState | undefined {
  const getSnapshot = useCallback(() => wm.get(id), [wm, id])
  return useSyncExternalStore(wm.subscribe, getSnapshot, getSnapshot)
}

export interface UseDesktopResult {
  ref: ElementRef
  binder: DesktopBinder
  controller(): DesktopController | null
}

export function useDesktop(wm: WindowManager, options?: DesktopOptions): UseDesktopResult {
  const optionsRef = useRef(options)
  const binder = useMemo(() => createDesktopBinder(wm, optionsRef.current), [wm])
  const cleanupRef = useRef<(() => void) | null>(null)
  const ref = useCallback<ElementRef>(
    (node) => {
      if (node) {
        cleanupRef.current = binder.bindDesktop(node)
      } else {
        cleanupRef.current?.()
        cleanupRef.current = null
      }
    },
    [binder],
  )
  return { ref, binder, controller: binder.controller }
}

export function useWmWindowRef(
  binder: DesktopBinder,
  id: string,
  options?: WindowAttachOptions,
): ElementRef {
  const optionsRef = useRef(options)
  const cleanupRef = useRef<(() => void) | null>(null)
  return useCallback<ElementRef>(
    (node) => {
      if (node) {
        cleanupRef.current = binder.bindWindow(id, node, optionsRef.current)
      } else {
        cleanupRef.current?.()
        cleanupRef.current = null
      }
    },
    [binder, id],
  )
}
