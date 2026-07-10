export type { Emitter, Listener } from './core/emitter'
export { createEmitter } from './core/emitter'
export type { SnapDetectOptions } from './core/geometry'
export {
  boundsEqual,
  clamp,
  clampSize,
  clampToViewport,
  detectSnapZone,
  zoneBounds,
} from './core/geometry'
export { createWindowManager } from './core/manager'
export type {
  Bounds,
  ManagerEvents,
  ManagerOptions,
  ManagerState,
  SerializedState,
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
export type {
  DesktopBinder,
  DesktopController,
  DesktopKeyboardOptions,
  DesktopOptions,
  DesktopSnapOptions,
  WindowAttachOptions,
} from './dom/controller'
export { attachDesktop, createDesktopBinder } from './dom/controller'
