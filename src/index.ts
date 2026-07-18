export type { Emitter, Listener } from './core/emitter'
export { createEmitter } from './core/emitter'
export type { MagnetResult, SnapDetectOptions } from './core/geometry'
export {
  boundsEqual,
  clamp,
  clampSize,
  clampToViewport,
  detectSnapZone,
  magnetize,
  zoneBounds,
} from './core/geometry'
export { createWindowManager } from './core/manager'
export type {
  ArrangeMode,
  Bounds,
  HistoryEntry,
  ManagerEvents,
  ManagerOptions,
  ManagerState,
  SerializedMaxSize,
  SerializedState,
  SerializedWindowState,
  Size,
  SnapZone,
  WindowFlags,
  WindowInit,
  WindowLayer,
  WindowManager,
  WindowStage,
  WindowState,
  WindowUpdate,
} from './core/types'
export type { FlipGhostOptions } from './dom/animate'
export { flipToTarget, prefersReducedMotion } from './dom/animate'
export type { Announcer, AnnouncerMessages } from './dom/announcer'
export { createAnnouncer, defaultMessages } from './dom/announcer'
export type { DesktopBinder } from './dom/binder'
export { createDesktopBinder } from './dom/binder'
export { attachDesktop } from './dom/controller'
export type {
  DesktopController,
  DesktopKeyboardOptions,
  DesktopOptions,
  DesktopSnapOptions,
  HitAreaOptions,
  MagnetismOptions,
  WindowAttachOptions,
} from './dom/shared'
