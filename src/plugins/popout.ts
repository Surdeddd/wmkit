import type { WindowManager } from '../core/types'

interface DocumentPictureInPictureApi {
  readonly window?: Window | null
  requestWindow(options?: {
    width?: number
    height?: number
    disallowReturnToOpener?: boolean
  }): Promise<Window>
}

export interface PopoutScreen {
  availLeft: number
  availTop: number
  availWidth: number
  availHeight: number
  isPrimary?: boolean
  label?: string
}

interface ScreenDetailsApi {
  screens: readonly PopoutScreen[]
  currentScreen: PopoutScreen
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPictureApi
    getScreenDetails?: () => Promise<ScreenDetailsApi>
  }
}

export type PopoutTarget = 'auto' | 'pip' | 'window'

export interface PopoutOptions {
  width?: number
  height?: number
  copyStyles?: boolean
  minimizeWhilePopped?: boolean
  target?: PopoutTarget
  screen?: PopoutScreen | 'current' | 'other'
  left?: number
  top?: number
  mode?: 'move' | 'container'
}

export interface PopoutHandle {
  target: 'pip' | 'window'
  window: Window
  pipWindow: Window
  container: HTMLElement
  closed: Promise<void>
  close(): void
}

function host(): (Window & typeof globalThis) | undefined {
  return typeof window === 'undefined' ? undefined : window
}

export function isPopoutSupported(target: PopoutTarget = 'auto'): boolean {
  const view = host()
  const pip = view?.documentPictureInPicture !== undefined
  const popup = typeof view?.open === 'function'
  return target === 'pip' ? pip : target === 'window' ? popup : pip || popup
}

async function screenDetails(): Promise<ScreenDetailsApi | null> {
  try {
    return (await host()?.getScreenDetails?.()) ?? null
  } catch {
    return null
  }
}

export async function listScreens(): Promise<readonly PopoutScreen[] | null> {
  return (await screenDetails())?.screens ?? null
}

async function screenFor(choice: PopoutOptions['screen']): Promise<PopoutScreen | null> {
  if (typeof choice === 'object') return choice
  const details = await screenDetails()
  if (!details) return null
  const { screens, currentScreen } = details
  return choice === 'other'
    ? (screens.find((screen) => screen !== currentScreen) ?? currentScreen)
    : currentScreen
}

function copyStylesInto(target: Document, source: Document): void {
  for (const sheet of [...source.styleSheets, ...(source.adoptedStyleSheets ?? [])]) {
    if (sheet.disabled) continue
    let node: HTMLStyleElement | HTMLLinkElement
    try {
      node = target.createElement('style')
      node.textContent = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n')
    } catch {
      const owner = sheet.ownerNode
      if (!(owner instanceof HTMLLinkElement) || !owner.href) continue
      const link = target.createElement('link')
      link.rel = 'stylesheet'
      link.href = owner.href
      node = link
    }
    const media = sheet.media?.mediaText
    if (media) node.media = media
    target.head.append(node)
  }
}

export async function popout(
  wm: WindowManager,
  id: string,
  content: HTMLElement,
  options: PopoutOptions = {},
): Promise<PopoutHandle> {
  const win = wm.get(id)
  if (!win) throw new Error(`wmkit: cannot pop out unknown window "${id}"`)
  const view = host()
  const wanted = options.target ?? 'auto'
  const pip = view?.documentPictureInPicture
  const usePip = wanted === 'pip' || (wanted === 'auto' && pip !== undefined)
  if (!view || (usePip ? !pip : typeof view.open !== 'function')) {
    throw new Error('wmkit: popout is not supported in this browser')
  }
  const width = options.width ?? Math.round(win.bounds.width)
  const height = options.height ?? Math.round(win.bounds.height)
  let target: Window | null
  if (usePip) {
    target = await (pip as DocumentPictureInPictureApi).requestWindow({ width, height })
  } else {
    const screen = options.screen === undefined ? null : await screenFor(options.screen)
    const left = options.left ?? (screen && screen.availLeft + (screen.availWidth - width) / 2)
    const top = options.top ?? (screen && screen.availTop + (screen.availHeight - height) / 2)
    const place = (name: string, value: number | null) =>
      value === null ? '' : `,${name}=${Math.round(value)}`
    target = view.open(
      '',
      '_blank',
      `popup,width=${width},height=${height}${place('left', left)}${place('top', top)}`,
    )
  }
  if (!target) throw new Error('wmkit: the popout window was blocked')
  const popped = target
  const doc = popped.document
  const source = content.ownerDocument
  if (options.copyStyles !== false) copyStylesInto(doc, source)
  doc.title = win.title
  const container = doc.createElement('div')
  container.dataset.wmPopout = id
  doc.body.append(container)
  const moved = options.mode !== 'container'
  const marker = source.createComment('wmkit-popout')
  if (moved) {
    content.parentNode?.insertBefore(marker, content)
    container.append(content)
  }
  const minimized = options.minimizeWhilePopped !== false && win.stage !== 'minimized'
  if (minimized) wm.minimize(id)

  let settle!: () => void
  const closed = new Promise<void>((resolve) => {
    settle = resolve
  })
  let done = false
  const stops = [
    wm.on('update', ({ window: next }) => {
      if (next.id === id) doc.title = next.title
    }),
    wm.on('close', ({ window: gone }) => {
      if (gone.id === id) finish()
    }),
  ]

  function finish(): void {
    if (done) return
    done = true
    for (const stop of stops) stop()
    view?.removeEventListener('pagehide', finish)
    if (moved) {
      if (marker.isConnected) marker.replaceWith(content)
      else {
        marker.remove()
        const owner = [...source.querySelectorAll<HTMLElement>('[data-wm-window]')].find(
          (el) => el.dataset.wmWindow === id,
        )
        owner?.querySelector('[data-wm-content]')?.append(content)
      }
    }
    if (!popped.closed) popped.close()
    if (minimized && wm.get(id)?.stage === 'minimized') wm.restore(id)
    settle()
  }

  popped.addEventListener('pagehide', finish)
  if (!usePip) view.addEventListener('pagehide', finish)
  return {
    target: usePip ? 'pip' : 'window',
    window: popped,
    pipWindow: popped,
    container,
    closed,
    close: finish,
  }
}
