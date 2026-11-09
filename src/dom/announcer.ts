import type { WindowManager } from '../core/types'

export interface AnnouncerMessages {
  opened(title: string): string
  closed(title: string): string
  minimized(title: string): string
  restored(title: string): string
  maximized(title: string): string
  snapped(title: string, zone: string): string
  focused(title: string): string
  workspace(index: number): string
  openedMany?(count: number): string
  closedMany?(count: number): string
  minimizedMany?(count: number): string
  restoredMany?(count: number): string
}

export const defaultMessages: AnnouncerMessages = {
  opened: (title) => `${title} window opened`,
  closed: (title) => `${title} window closed`,
  minimized: (title) => `${title} minimized`,
  restored: (title) => `${title} restored`,
  maximized: (title) => `${title} maximized`,
  snapped: (title, zone) => `${title} snapped to ${zone.replace('-', ' ')}`,
  focused: (title) => `${title} focused`,
  workspace: (index) => `workspace ${index + 1}`,
  openedMany: (count) => `${count} windows opened`,
  closedMany: (count) => `${count} windows closed`,
  minimizedMany: (count) => `${count} windows minimized`,
  restoredMany: (count) => `${count} windows restored`,
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
  const dict: Partial<AnnouncerMessages> = { ...defaultMessages, ...messages }
  for (const key of ['opened', 'closed', 'minimized', 'restored'] as const) {
    if (key in messages) dict[`${key}Many`] = messages[`${key}Many`]
  }
  const element = container.ownerDocument.createElement('div')
  element.setAttribute('role', 'status')
  element.setAttribute('aria-live', 'polite')
  element.dataset.wmAnnouncer = ''
  element.style.cssText =
    'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0'
  container.append(element)

  let clearTimer: ReturnType<typeof setTimeout> | undefined
  let detailed = false
  let kind = ''
  let times = 0

  function announce(message: string): void {
    element.textContent = element.textContent === message ? `${message} ` : message
    if (clearTimer !== undefined) clearTimeout(clearTimer)
    clearTimer = setTimeout(() => {
      element.textContent = ''
    }, 2000)
  }

  function say(next: string, message?: string): void {
    times = next === kind ? times + 1 : 1
    kind = next
    detailed = true
    const many = dict[`${next}Many` as 'openedMany']
    if (message) announce(times > 1 && many ? many(times) : message)
  }

  const unsubscribers = [
    wm.on('open', ({ window: win }) => say('opened', dict.opened?.(win.title))),
    wm.on('close', ({ window: win }) => say('closed', dict.closed?.(win.title))),
    wm.on('stage', ({ window: win, previous }) => {
      const title = win.title
      if (win.stage === 'minimized') say('minimized', dict.minimized?.(title))
      else if (win.stage === 'maximized') say('maximized', dict.maximized?.(title))
      else if (win.stage === 'snapped' && win.snapZone)
        say('snapped', dict.snapped?.(title, win.snapZone))
      else if (win.stage === 'normal' && previous !== 'normal')
        say('restored', dict.restored?.(title))
    }),
    wm.on('focus', ({ window: win, previous }) => {
      const message = detailed || previous === null ? undefined : dict.focused?.(win.title)
      if (message) announce(message)
    }),
    wm.on('workspace', ({ workspace }) => say('workspace', dict.workspace?.(workspace))),
    wm.subscribe(() => {
      detailed = false
      kind = ''
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
