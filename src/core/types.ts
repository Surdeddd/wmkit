export interface Size {
  width: number
  height: number
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export type WindowStage = 'normal' | 'minimized' | 'maximized' | 'snapped'

export type WindowLayer = 'normal' | 'floating' | 'modal'

export type SnapZone =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export interface WindowFlags {
  draggable: boolean
  resizable: boolean
  closable: boolean
  minimizable: boolean
  maximizable: boolean
  snappable: boolean
}

export interface WindowState extends WindowFlags {
  id: string
  title: string
  bounds: Bounds
  restoreBounds: Bounds | null
  restoreStage: WindowStage | null
  stage: WindowStage
  snapZone: SnapZone | null
  layer: WindowLayer
  minSize: Size
  maxSize: Size | null
  openedSeq: number
  meta: Record<string, unknown>
}

export interface WindowInit extends Partial<WindowFlags> {
  id?: string
  title?: string
  x?: number
  y?: number
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  stage?: WindowStage
  layer?: WindowLayer
  meta?: Record<string, unknown>
}

export interface ManagerState {
  windows: Readonly<Record<string, WindowState>>
  order: readonly string[]
  focusedId: string | null
  viewport: Size
}

export interface SerializedState {
  version: 1
  windows: WindowState[]
  order: string[]
  focusedId: string | null
}

export interface ManagerEvents {
  open: { window: WindowState }
  close: { window: WindowState }
  focus: { window: WindowState; previous: string | null }
  move: { window: WindowState }
  resize: { window: WindowState }
  stage: { window: WindowState; previous: WindowStage }
  update: { window: WindowState }
  order: { order: readonly string[] }
  modalblocked: { window: WindowState }
  change: { state: ManagerState }
}

export interface ManagerOptions {
  viewport?: Size
  keepInViewport?: boolean
  minVisible?: number
  defaultSize?: Size
  cascadeOffset?: number
  cascadeOrigin?: { x: number; y: number }
  idPrefix?: string
}

export interface WindowUpdate {
  title?: string
  layer?: WindowLayer
  minSize?: Size
  maxSize?: Size | null
  meta?: Record<string, unknown>
  draggable?: boolean
  resizable?: boolean
  closable?: boolean
  minimizable?: boolean
  maximizable?: boolean
  snappable?: boolean
}

export interface WindowManager {
  open(init?: WindowInit): WindowState
  close(id: string): boolean
  closeAll(): void
  focus(id: string): boolean
  blur(): void
  cycleFocus(direction?: 1 | -1): string | null
  minimize(id: string): boolean
  maximize(id: string): boolean
  toggleMaximize(id: string): boolean
  restore(id: string): boolean
  restoreTo(id: string, bounds: Bounds): boolean
  snap(id: string, zone: SnapZone): boolean
  move(id: string, x: number, y: number): boolean
  moveBy(id: string, dx: number, dy: number): boolean
  resize(id: string, patch: Partial<Bounds>): boolean
  update(id: string, patch: WindowUpdate): boolean
  get(id: string): WindowState | undefined
  getState(): ManagerState
  minimized(): readonly WindowState[]
  setViewport(viewport: Size): void
  batch(run: () => void): void
  serialize(): SerializedState
  hydrate(data: SerializedState): boolean
  subscribe(listener: (state: ManagerState) => void): () => void
  on<K extends keyof ManagerEvents>(
    event: K,
    listener: (payload: ManagerEvents[K]) => void,
  ): () => void
  destroy(): void
}
