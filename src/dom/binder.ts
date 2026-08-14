import type { WindowManager } from '../core/types'
import { attachDesktop } from './controller'
import type { DesktopController, DesktopOptions, WindowAttachOptions } from './shared'

export interface DesktopBinder {
  wm: WindowManager
  controller(): DesktopController | null
  bindDesktop(element: HTMLElement): () => void
  bindWindow(id: string, element: HTMLElement, options?: WindowAttachOptions): () => void
  destroy(): void
}

interface PendingWindow {
  id: string
  element: HTMLElement
  options: WindowAttachOptions | undefined
  detach: (() => void) | null
}

export function createDesktopBinder(
  wm: WindowManager,
  options: DesktopOptions = {},
): DesktopBinder {
  let controller: DesktopController | null = null
  let stops: Array<() => void> = []
  const entries = new Set<PendingWindow>()

  function attachEntry(entry: PendingWindow): void {
    if (controller && !entry.detach && wm.get(entry.id)) {
      entry.detach = controller.attachWindow(entry.id, entry.element, entry.options)
    }
  }

  function unbindDesktop(): void {
    for (const stop of stops) stop()
    stops = []
    for (const entry of entries) entry.detach = null
    controller?.destroy()
    controller = null
  }

  return {
    wm,
    controller: () => controller,
    bindDesktop(element) {
      if (controller) throw new Error('wmkit: desktop is already bound')
      controller = attachDesktop(wm, element, options)
      stops.push(
        wm.on('open', ({ window: win }) => {
          for (const entry of entries) {
            if (entry.id === win.id) attachEntry(entry)
          }
        }),
        wm.on('close', ({ window: win }) => {
          for (const entry of entries) {
            if (entry.id === win.id) entry.detach = null
          }
        }),
      )
      for (const entry of entries) attachEntry(entry)
      return unbindDesktop
    },
    bindWindow(id, element, windowOptions) {
      const entry: PendingWindow = { id, element, options: windowOptions, detach: null }
      entries.add(entry)
      attachEntry(entry)
      return () => {
        entry.detach?.()
        entry.detach = null
        entries.delete(entry)
      }
    },
    destroy() {
      unbindDesktop()
      entries.clear()
    },
  }
}
