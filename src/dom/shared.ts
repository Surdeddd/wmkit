import type { SnapDetectOptions } from '../core/geometry'
import type { Bounds, WindowManager, WindowState } from '../core/types'
import type { AnnouncerMessages } from './announcer'
import type { PinchOptions, SwipeOptions } from './gestures'

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
  snapShortcuts?: boolean
  historyShortcuts?: boolean
}

export interface HitAreaOptions {
  edge?: number
  corner?: number
}

export interface MagnetismOptions {
  threshold?: number
}

export interface GroupingOptions {
  dwell?: number
}

export interface StackingOptions {
  base?: number
  gap?: number
  isolate?: boolean
}

export interface DesktopOptions {
  grouping?: boolean | GroupingOptions
  snap?: boolean | DesktopSnapOptions
  keyboard?: boolean | DesktopKeyboardOptions
  announce?: boolean | Partial<AnnouncerMessages>
  autoViewport?: boolean
  hitAreas?: HitAreaOptions
  magnetism?: boolean | MagnetismOptions
  stacking?: StackingOptions
  animation?: boolean | AnimationOptions
  pinch?: boolean | PinchOptions
  swipe?: boolean | SwipeOptions
  interactiveSelector?: string
  // biome-ignore lint/suspicious/noConfusingVoidType: a handler may return nothing
  beforeClose?: (window: WindowState) => boolean | void
  minimizeTarget?: (window: WindowState) => Element | null
  windowVariant?: (window: WindowState) => string | null
  onTitlebarContextMenu?: (window: WindowState, event: MouseEvent) => void
}

export interface AnimationOptions {
  duration?: number
  easing?: string
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
  view: Window & typeof globalThis
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
  interactiveSelector: string
  magnetThreshold: number
  groupDwell: number
  groupTarget(clientX: number, clientY: number, selfId: string): string | null
  markGroupTarget(id: string | null): void
  currentDrag(): ActiveDrag | null
  claimDrag(session: ActiveDrag): void
  releaseDrag(session: ActiveDrag): void
}

export function windowOf(element: HTMLElement): Window & typeof globalThis {
  const view = element.ownerDocument.defaultView
  if (!view) throw new Error('wmkit: desktop element is not attached to a document')
  return view
}
