import type { WindowManager } from '../core/types'

export interface AnnouncerMessages {
  opened(title: string): string
  closed(title: string): string
  minimized(title: string): string
  restored(title: string): string
  maximized(title: string): string
  snapped(title: string, zone: string): string
  focused(title: string): string
}

export const defaultMessages: AnnouncerMessages = {
  opened: (title) => `${title} window opened`,
  closed: (title) => `${title} window closed`,
  minimized: (title) => `${title} minimized`,
  restored: (title) => `${title} restored`,
  maximized: (title) => `${title} maximized`,
  snapped: (title, zone) => `${title} snapped to ${zone.replace('-', ' ')}`,
  focused: (title) => `${title} focused`,
}

export interface Announcer {
  element: HTMLElement
  announce(message: string): void
  destroy(): void
}

export function createAnnouncer(
  wm: WindowManager,
  container: HTMLElement,
  messages: Partial<AnnouncerMessages> = {},
): Announcer {
  const dict: AnnouncerMessages = { ...defaultMessages, ...messages }
  const element = container.ownerDocument.createElement('div')
  element.setAttribute('role', 'status')
  element.setAttribute('aria-live', 'polite')
  element.dataset.wmAnnouncer = ''
  element.style.cssText =
    'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0'
  container.append(element)

  let clearTimer: ReturnType<typeof setTimeout> | undefined

  function announce(message: string): void {
    element.textContent = message
    if (clearTimer !== undefined) clearTimeout(clearTimer)
    clearTimer = setTimeout(() => {
      element.textContent = ''
    }, 2000)
  }

  const unsubscribers = [
    wm.on('open', ({ window: win }) => announce(dict.opened(win.title))),
    wm.on('close', ({ window: win }) => announce(dict.closed(win.title))),
    wm.on('stage', ({ window: win, previous }) => {
      if (win.stage === 'minimized') announce(dict.minimized(win.title))
      else if (win.stage === 'maximized') announce(dict.maximized(win.title))
      else if (win.stage === 'snapped' && win.snapZone)
        announce(dict.snapped(win.title, win.snapZone))
      else if (win.stage === 'normal' && previous !== 'normal') announce(dict.restored(win.title))
    }),
  ]

  return {
    element,
    announce,
    destroy() {
      for (const unsubscribe of unsubscribers) unsubscribe()
      if (clearTimer !== undefined) clearTimeout(clearTimer)
      element.remove()
    },
  }
}
