export type { Emitter, Listener } from './core/emitter'
export { createEmitter } from './core/emitter'
export type { MagnetResult, SnapDetectOptions } from './core/geometry'
export {
  applyAspect,
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
export type { WindowActions } from './dom/actions'
export type { FlipGhostOptions } from './dom/animate'
export { flipFromTarget, flipToTarget, prefersReducedMotion } from './dom/animate'
export type { Announcer, AnnouncerMessages } from './dom/announcer'
export { createAnnouncer, defaultMessages } from './dom/announcer'
export type { DesktopBinder } from './dom/binder'
export { createDesktopBinder } from './dom/binder'
export { attachDesktop } from './dom/controller'
export type {
  ActiveGesture,
  DesktopController,
  DesktopGesture,
  DesktopKeyboardOptions,
  DesktopOptions,
  DesktopSnapOptions,
  GestureContext,
  HitAreaOptions,
  MagnetismOptions,
  MountedWindow,
  SkinContext,
  SkinMount,
  WindowAttachOptions,
  WindowSkin,
} from './dom/shared'
