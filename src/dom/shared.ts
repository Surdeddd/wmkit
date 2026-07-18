import type { SnapDetectOptions } from '../core/geometry'
import type { Bounds, WindowManager, WindowState } from '../core/types'
import type { AnnouncerMessages } from './announcer'

export const INTERACTIVE_SELECTOR =
  'button, input, select, textarea, a[href], [contenteditable], [data-wm-close], [data-wm-minimize], [data-wm-maximize]'

export interface Point {
  x: number
  y: number
}

export interface DesktopSnapOptions extends SnapDetectOptions {
  preview?: boolean
  topEdge?: 'maximize' | 'top' | 'none'
}

export interface DesktopKeyboardOptions {
  moveStep?: number
  cycle?: boolean
}

export interface HitAreaOptions {
  edge?: number
  corner?: number
}

export interface MagnetismOptions {
  threshold?: number
}

export interface DesktopOptions {
  snap?: boolean | DesktopSnapOptions
  keyboard?: boolean | DesktopKeyboardOptions
  announce?: boolean | Partial<AnnouncerMessages>
  autoViewport?: boolean
  hitAreas?: HitAreaOptions
  magnetism?: boolean | MagnetismOptions
  minimizeTarget?: (window: WindowState) => Element | null
  onTitlebarContextMenu?: (window: WindowState, event: MouseEvent) => void
}

export interface WindowAttachOptions {
  handle?: HTMLElement | string
  resizeHandles?: boolean
  removeOnClose?: boolean
}

export interface DesktopController {
  element: HTMLElement
  wm: WindowManager
  attachWindow(id: string, element: HTMLElement, options?: WindowAttachOptions): () => void
  destroy(): void
}

export interface ActiveDrag {
  id: string
  finish(cancelled: boolean): void
}

export interface SessionContext {
  wm: WindowManager
  doc: Document
  view: Window
  toLocal(event: PointerEvent): Point
  trackRect(): () => void
  windowElement(id: string): HTMLElement | undefined
  showPreview(bounds: Bounds): void
  hidePreview(): void
  snapEnabled: boolean
  snapDetect: Required<SnapDetectOptions>
  topEdge: 'maximize' | 'top' | 'none'
  hitEdge: number
  hitCorner: number
  magnetThreshold: number
  currentDrag(): ActiveDrag | null
  claimDrag(session: ActiveDrag): void
  releaseDrag(session: ActiveDrag): void
}

export function windowOf(element: HTMLElement): Window {
  const view = element.ownerDocument.defaultView
  if (!view) throw new Error('wmkit: desktop element is not attached to a document')
  return view
}
