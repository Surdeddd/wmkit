import type { WindowManager } from '../core/types'

interface DocumentPictureInPictureApi {
  requestWindow(options?: {
    width?: number
    height?: number
    disallowReturnToOpener?: boolean
  }): Promise<Window>
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPictureApi
  }
}

export interface PopoutOptions {
  width?: number
  height?: number
  copyStyles?: boolean
  minimizeWhilePopped?: boolean
}

export interface PopoutHandle {
  pipWindow: Window
  close(): void
}

export function isPopoutSupported(): boolean {
  return typeof window !== 'undefined' && window.documentPictureInPicture !== undefined
}

function copyStylesInto(pipWindow: Window, source: Document): void {
  for (const sheet of Array.from(source.styleSheets)) {
    const owner = sheet.ownerNode
    if (!owner) continue
    try {
      const rules = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join('\n')
      const style = pipWindow.document.createElement('style')
      style.textContent = rules
      pipWindow.document.head.append(style)
    } catch {
      if (owner instanceof HTMLLinkElement && owner.href) {
        const link = pipWindow.document.createElement('link')
        link.rel = 'stylesheet'
        link.href = owner.href
        pipWindow.document.head.append(link)
      }
    }
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
  const api = typeof window !== 'undefined' ? window.documentPictureInPicture : undefined
  if (!api) throw new Error('wmkit: Document Picture-in-Picture is not supported in this browser')

  const pipWindow = await api.requestWindow({
    width: options.width ?? Math.round(win.bounds.width),
    height: options.height ?? Math.round(win.bounds.height),
  })

  if (options.copyStyles !== false) copyStylesInto(pipWindow, content.ownerDocument)

  const parent = content.parentNode
  const marker = content.ownerDocument.createComment('wmkit-popout')
  parent?.insertBefore(marker, content)
  pipWindow.document.body.append(content)
  pipWindow.document.title = win.title

  const minimizeWhilePopped = options.minimizeWhilePopped !== false
  if (minimizeWhilePopped) wm.minimize(id)

  let closed = false
  function handleReturn(): void {
    if (closed) return
    closed = true
    if (marker.parentNode) {
      marker.parentNode.insertBefore(content, marker)
      marker.remove()
    }
    if (minimizeWhilePopped && wm.get(id)) wm.restore(id)
  }

  pipWindow.addEventListener('pagehide', handleReturn)

  return {
    pipWindow,
    close() {
      pipWindow.close()
      handleReturn()
    },
  }
}
