# API reference

Everything exported from `@surdeddd/wmkit` and its subpaths. Types are the real ones from `src/core/types.ts` and `src/dom/shared.ts`.

- [Core types](#core-types)
- [createWindowManager](#createwindowmanageroptions)
- [WindowManager methods](#windowmanager-methods)
- [Events](#events)
- [attachDesktop](#attachdesktopwm-element-options)
- [createDesktopBinder](#createdesktopbinderwm-options)
- [Geometry helpers](#geometry-helpers)
- [Animation helpers](#animation-helpers)
- [Announcer](#announcer)
- [Emitter](#emitter)
- [persist](#persistwm-options--surdedddwmkitpersist)
- [popout](#popoutwm-id-content-options--surdedddwmkitpopout)

## Core types

```ts
interface Size {
  width: number
  height: number
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

type WindowStage = 'normal' | 'minimized' | 'maximized' | 'snapped'
type WindowLayer = 'normal' | 'floating' | 'modal'
type ArrangeMode = 'cascade' | 'tile'

type SnapZone =
  | 'left' | 'right' | 'top' | 'bottom'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | 'left-third' | 'center-third' | 'right-third'

interface WindowFlags {
  draggable: boolean
  resizable: boolean
  closable: boolean
  minimizable: boolean
  maximizable: boolean
  snappable: boolean
}
```

The flags are advisory state: the DOM layer refuses the matching gesture, while the programmatic API always obeys you. `wm.close(id)` closes a `closable: false` window on purpose — the flag exists to stop the user, not your code.

### WindowState

Every field is JSON-safe. Objects are replaced, never mutated, so `previous === next` is a valid "nothing changed" check.

```ts
interface WindowState extends WindowFlags {
  id: string
  title: string
  bounds: Bounds
  restoreBounds: Bounds | null   // geometry to return to from maximized/snapped
  restoreStage: WindowStage | null // stage to return to from minimized
  stage: WindowStage
  snapZone: SnapZone | null
  layer: WindowLayer
  workspace: number
  minSize: Size
  maxSize: Size | null           // Infinity on an axis means unbounded
  aspectRatio: number | null     // width / height
  openedSeq: number              // monotonic; taskbar ordering
  meta: Record<string, unknown>  // yours, merged on update, serialized
}
```

### WindowInit

```ts
interface WindowInit extends Partial<WindowFlags> {
  id?: string          // generated as `${idPrefix}-${n}` when omitted; duplicates throw
  title?: string       // 'Window'
  x?: number           // cascades when x or y is omitted
  y?: number
  width?: number       // defaultSize.width
  height?: number      // defaultSize.height
  minWidth?: number    // 160
  minHeight?: number   // 100
  maxWidth?: number
  maxHeight?: number
  aspectRatio?: number // ignored unless finite and > 0
  stage?: WindowStage  // 'snapped' is downgraded to 'normal' (no zone to snap to yet)
  layer?: WindowLayer
  workspace?: number   // active workspace; non-integers and negatives fall back
  meta?: Record<string, unknown>
}
```

### ManagerState

```ts
interface ManagerState {
  windows: Readonly<Record<string, WindowState>>
  order: readonly string[]   // back to front, sorted by layer
  focusedId: string | null
  viewport: Size
  workspace: number
}
```

`getState()` returns a cached object that is replaced on every change, so a `!==` check is enough to know something happened.

### SerializedState

```ts
interface SerializedState {
  version: 1
  windows: SerializedWindowState[]   // WindowState with maxSize as { width: number | null; height: number | null } | null
  order: string[]
  focusedId: string | null
  workspace: number
}
```

`hydrate()` validates the payload and returns `false` instead of throwing: wrong `version`, a non-array `windows`, duplicate ids, a missing `bounds`, or an unknown `stage`/`layer` all reject the whole snapshot. Unknown per-window fields are replaced with defaults rather than rejected.

## `createWindowManager(options?)`

Pure state machine. Safe to construct during SSR.

```ts
interface ManagerOptions {
  viewport?: Size                      // { width: 0, height: 0 } — clamping is off until set
  keepInViewport?: boolean             // true
  minVisible?: number                  // 48 — visible strip kept reachable
  defaultSize?: Size                   // { width: 480, height: 320 }
  cascadeOffset?: number               // 32
  cascadeOrigin?: { x: number; y: number } // { x: 32, y: 32 }
  idPrefix?: string                    // 'wm'
  historyLimit?: number                // 50; 0 disables undo/redo
  workspace?: number                   // 0
}
```

With `viewport` at its zero default, `clampToViewport` is a no-op — so a manager hydrated before mount keeps its stored geometry, and the first `setViewport()` (usually from the controller's `ResizeObserver`) re-derives everything.

## WindowManager methods

### Lifecycle

| Method | Returns | Notes |
| --- | --- | --- |
| `open(init?)` | `WindowState` | throws on a duplicate id; cascades when `x`/`y` are omitted; focuses unless minimized or on another workspace |
| `close(id)` | `boolean` | `false` for unknown ids; focus moves to the next eligible window |
| `closeAll()` | `void` | every workspace, one transaction |
| `destroy()` | `void` | drops all listeners; the state object stays usable |

### Focus and order

| Method | Returns | Notes |
| --- | --- | --- |
| `focus(id)` | `boolean` | switches to the window's workspace first; restores it if minimized; `false` when a modal blocks it (emits `modalblocked`) |
| `blur()` | `void` | clears `focusedId` without touching order |
| `cycleFocus(direction?)` | `string \| null` | `1` (default) or `-1`, wraps, skips minimized and other workspaces |
| `sendToBack(id)` | `boolean` | bottom of the window's own layer band; hands focus over if it was focused |

### Stage

| Method | Returns | Notes |
| --- | --- | --- |
| `minimize(id)` | `boolean` | remembers the stage it came from |
| `maximize(id)` | `boolean` | fills the viewport; keeps geometry in `restoreBounds` |
| `toggleMaximize(id)` | `boolean` | maximize, or restore when already maximized |
| `restore(id)` | `boolean` | from minimized returns to the remembered stage; from maximized/snapped returns to `restoreBounds`, re-clamped against min/max and the viewport |
| `restoreTo(id, bounds)` | `boolean` | forces `normal` at explicit bounds; used by drag-off-snap |
| `snap(id, zone)` | `boolean` | zone geometry, clamped to the window's own min/max |

### Geometry

| Method | Returns | Notes |
| --- | --- | --- |
| `move(id, x, y)` | `boolean` | `normal` stage only; `true` when the clamp made it a no-op |
| `moveBy(id, dx, dy)` | `boolean` | relative `move` |
| `center(id)` | `boolean` | centres a `normal` window in the viewport |
| `resize(id, patch)` | `boolean` | `Partial<Bounds>`; unsnaps a snapped window; honours `aspectRatio`, driven by the axis that changed most |
| `update(id, patch)` | `boolean` | title, layer, min/max size, `aspectRatio`, flags, `meta` (shallow-merged) |
| `setViewport(size)` | `void` | re-derives maximized and snapped bounds, clamps the rest; never recorded in history |

### Workspaces

| Method | Returns | Notes |
| --- | --- | --- |
| `workspace()` | `number` | active index |
| `setWorkspace(n)` | `boolean` | `false` when unchanged or invalid; refocuses the top window of the target |
| `moveToWorkspace(id, n)` | `boolean` | `false` for unknown ids or a no-op move |

Windows outside the active workspace are hidden by the DOM layer, skipped by `focusTargets`, `minimized()`, `arrange()`, `minimizeAll()` and drag magnetism.

### Tab groups

Several windows can share one frame. Members keep their own identity, content and title, but
share geometry; exactly one member is visible at a time and the rest behave like hidden windows.

| Method | Returns | Notes |
| --- | --- | --- |
| `group(ids)` | `string \| null` | `null` for fewer than two known windows; the first id is the host whose geometry and stage the group adopts, and it becomes the active tab. Windows that already belong to a group bring their whole group with them |
| `ungroup(id)` | `boolean` | detaches one member; a group left with a single member dissolves entirely |
| `activateTab(id)` | `boolean` | makes a member the visible tab; `false` when it is already active or not grouped. Focus follows the tab, but only when the member going hidden was the focused window |
| `moveTab(id, index)` | `boolean` | moves a member to another slot in the tab order; the index is clamped, and `false` means nothing moved. The active tab, the focus and the geometry stay put |
| `cycleTab(direction?)` | `string \| null` | activates the next (`1`) or previous (`-1`) tab of the focused window's group, wrapping around; `null` when the focused window is not grouped |
| `groupMembers(groupId)` | `readonly WindowState[]` | members in tab order (back to front) |

```ts
const groupId = wm.group(['editor', 'preview', 'console'])
wm.activateTab('preview')
wm.groupMembers(groupId).map((win) => win.title)
wm.ungroup('console')
```

Invariants the manager maintains for you:

- every member shares `bounds`, `stage`, `snapZone`, `layer` and `workspace` — moving, resizing,
  snapping, maximizing or moving a group to another workspace moves the whole group in one step
- inactive tabs are skipped by `focus`, `cycleFocus`, `minimized()`, `arrange()`, `minimizeAll()`,
  viewport reflow and drag magnetism, exactly like windows on another workspace — the group counts
  as one frame, driven by its visible tab
- the frame is sized so it satisfies every member's `minSize` and `maxSize`, not just the host's —
  including later moves, resizes and stage changes, so resizing one tab can grow the frame rather
  than push a sibling under its own minimum. The `resize` and `update` events carry the frame the
  group actually took, which is not always the one you asked for
- `focus(id)` on an inactive tab activates it first, so DOM focus never lands on a hidden element;
  a focus a modal refuses leaves the active tab untouched
- members stay contiguous in `order`, so switching tabs never changes where the frame sits in the
  stack, and the tab order is yours: focusing, raising or sending the frame to the back never
  shuffles it, only `moveTab` does
- closing the active tab hands the tab over to a sibling; closing the second-to-last member
  dissolves the group
- when a change hides the focused window — minimizing the frame through a hidden member, moving it
  to another workspace — focus falls back to the topmost window that is still reachable

`ManagerState.groups` exposes the current picture, which is what a tab strip renders from:

```ts
interface WindowGroup {
  id: string
  activeId: string
  members: readonly string[]
}
```

The `group` event fires on creation, activation and membership changes with
`{ groupId, members, activeId, previous }`.

### History

| Method | Returns | Notes |
| --- | --- | --- |
| `undo()` / `redo()` | `boolean` | `false` when the stack is empty |
| `canUndo()` / `canRedo()` | `boolean` | |
| `clearHistory()` | `void` | both stacks |
| `beginInteraction()` / `endInteraction()` | `void` | collapse a gesture into one entry; nestable |
| `abortInteraction()` | `void` | ends the interaction and drops the entry it created — for cancelled gestures |

`hydrate()` and `loadLayout()` clear the history: you cannot undo across a restore.

### Layouts and arrangement

| Method | Returns | Notes |
| --- | --- | --- |
| `saveLayout(name)` | `SerializedState` | snapshot stored under `name` and returned |
| `loadLayout(name)` | `boolean` | `false` when the name is unknown |
| `getLayout(name)` | `SerializedState \| undefined` | isolated copy |
| `setLayout(name, data)` | `boolean` | validates like `hydrate` |
| `deleteLayout(name)` / `layoutNames()` | `boolean` / `string[]` | |
| `arrange(mode)` | `void` | `'cascade'` staggers from `cascadeOrigin`; `'tile'` fills a `ceil(sqrt(n))` grid; both skip minimized windows and other workspaces |
| `minimizeAll()` / `restoreAll()` | `void` | active workspace, one history entry |

Layout storage is in-memory. Persist it yourself with `getLayout`/`setLayout`, or use the persist plugin for the live desktop.

### Reading and subscribing

| Method | Returns | Notes |
| --- | --- | --- |
| `get(id)` | `WindowState \| undefined` | |
| `getState()` | `ManagerState` | cached until the next change |
| `minimized()` | `readonly WindowState[]` | active workspace, ordered by `openedSeq` — taskbar order |
| `serialize()` | `SerializedState` | |
| `hydrate(data)` | `boolean` | emits `open`/`close` for the difference, re-derives against the viewport |
| `subscribe(fn)` | `() => void` | one call per committed transaction |
| `on(event, fn)` | `() => void` | granular events, see below |
| `batch(fn)` | `void` | one `change`, one history entry, events flushed at the end |

## Events

```ts
interface ManagerEvents {
  open: { window: WindowState }
  close: { window: WindowState }
  focus: { window: WindowState; previous: string | null }
  move: { window: WindowState }
  resize: { window: WindowState }
  stage: { window: WindowState; previous: WindowStage }
  update: { window: WindowState }
  order: { order: readonly string[] }
  workspace: { workspace: number; previous: number }
  modalblocked: { window: WindowState }   // the modal that blocked, not the blocked window
  change: { state: ManagerState }
}
```

Ordering inside one transaction: the specific events fire in the order they happened, then `change` last. Payload objects are the post-change state.

`open` and `close` cover every way a window appears or disappears, not just the calls named after them: `hydrate`, `loadLayout`, `undo` and `redo` all report the difference they made, so mounting your content on `open` and disposing it on `close` stays correct across history. It is safe to call `attachWindow` straight from an `open` handler.

## `attachDesktop(wm, element, options?)`

Binds the manager to a DOM subtree and returns a `DesktopController`. The element becomes the coordinate space; it gets `data-wm-desktop`, `tabindex="-1"` and `position: relative` when it was `static`.

```ts
interface DesktopOptions {
  grouping?: boolean | { dwell?: number }   // drop-to-group gesture, 420 ms hover before it arms
  snap?: boolean | {
    threshold?: number      // 12, or 20 on coarse pointers
    cornerSize?: number     // 64, or 96 on coarse pointers
    preview?: boolean       // true
    topEdge?: 'maximize' | 'top' | 'none'  // 'maximize'
  }
  keyboard?: boolean | {
    moveStep?: number         // 16
    cycle?: boolean           // true — F6
    snapShortcuts?: boolean   // true — Ctrl/Cmd+Alt+arrows
    historyShortcuts?: boolean // true — Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z
  }
  announce?: boolean | Partial<AnnouncerMessages>
  autoViewport?: boolean      // true — ResizeObserver drives setViewport
  hitAreas?: { edge?: number; corner?: number }  // 8/12, or 16/24 on coarse pointers
  magnetism?: boolean | { threshold?: number }   // 8, or 12 on coarse pointers
  stacking?: {
    base?: number      // 0 — z-index of the desktop floor
    gap?: number       // 32 — room left between neighbours for cheap reordering
    isolate?: boolean  // true — isolation:isolate so window layers stay inside the desktop
  }
  animation?: boolean | {
    duration?: number   // 260
    easing?: string     // cubic-bezier(0.32, 0.72, 0, 1)
  }
  gestures?: readonly DesktopGesture[]  // opt-in, from @surdeddd/wmkit/gestures or your own
  interactiveSelector?: string  // what a drag handle must not start on
  beforeClose?: (window: WindowState) => boolean | void  // return false to keep it open
  minimizeTarget?: (window: WindowState) => Element | null
  onTitlebarContextMenu?: (window: WindowState, event: MouseEvent) => void
}

### Gestures

The desktop ships no gestures of its own. Pass the ones you want and only those
reach your bundle.

```js
import { attachDesktop } from '@surdeddd/wmkit'
import { touchGestures } from '@surdeddd/wmkit/gestures'

attachDesktop(wm, root, { gestures: [touchGestures({ swipe: { workspaces: 4 } })] })
```

`@surdeddd/wmkit/gestures` exports three factories: `pinch(options?)`,
`swipe(options?)` and `touchGestures({ pinch, swipe })` when you want both from
one listener.

| Option | Default | Meaning |
| --- | --- | --- |
| `pinch.threshold` | `12` | how far the fingers must spread before it resizes |
| `pinch.lockTouchAction` | `false` | set `touch-action: none` on the desktop instead of `pan-x pan-y` |
| `swipe.threshold` | `72` | how far two fingers must travel sideways |
| `swipe.workspaces` | `0` | no upper bound; set it to stop at the last workspace |

A gesture is a function. It receives a `GestureContext` and returns its own
teardown, so you can write your own the same way the shipped ones are written:

```ts
type DesktopGesture = (ctx: GestureContext) => () => void

interface GestureContext {
  wm: WindowManager
  doc: Document
  view: Window & typeof globalThis
  desktop: HTMLElement
  toLocal(event: PointerEvent): { x: number; y: number }
  trackRect(): () => void
  windowElement(id: string): HTMLElement | undefined
  busy(): boolean                       // a drag or resize already owns the pointer
  claim(gesture: ActiveGesture): void   // take the pointer, so nothing else acts on it
  release(gesture: ActiveGesture): void
}
```

`claim` is what keeps gestures from fighting the built-in drag and resize: the
desktop holds one interaction at a time, and `busy()` tells you whether it is
already taken.

interface DesktopController {
  element: HTMLElement
  wm: WindowManager
  attachWindow(id: string, element: HTMLElement, options?: WindowAttachOptions): () => void
  destroy(): void
}

interface WindowAttachOptions {
  handle?: HTMLElement | string   // defaults to [data-wm-drag]
  resizeHandles?: boolean         // true
  removeOnClose?: boolean         // false
}
```

`attachWindow` throws for an unknown id or an id that is already attached. It returns a detach function; `destroy()` detaches everything, cancels an in-flight gesture and removes the snap preview.

A window that the manager closes — including one that `undo` takes away — is detached for you: its listeners and resize handles go, and the element loses `data-wm-window` so nothing mistakes it for a live window afterwards. The element itself stays in the page unless you passed `removeOnClose`, and the detach function you were handed is safe to call again at any point, including after you have attached that same element to a different window.

### What the controller writes

On the window element: `data-wm-window`, `data-wm-stage`, `data-wm-layer`, `data-wm-workspace`, `data-wm-focused`, `data-wm-dragging`, `data-wm-resizing`, `data-wm-flash`, `hidden`, `role="dialog"`, `tabindex="-1"`, `aria-label`, `aria-labelledby` (when `[data-wm-title]` sits in the same root as the window; a title inside a shadow root is carried by `aria-label` instead), `aria-modal` on modal layers, plus inline `transform`, `width`, `height`, `z-index`.

### Touch

Every gesture is driven by pointer events, so a finger and a mouse take the same path. The drag handle and the resize grips are given `touch-action: none`, which is what stops the browser from panning the page out from under a drag, and hit areas grow on coarse pointers — the defaults above show both figures. Only one gesture runs at a time: a second finger landing on another titlebar mid-drag is ignored rather than starting a competing drag. A long press produces a `contextmenu` event like anywhere else, which is where `onTitlebarContextMenu` is called from, with the browser's own menu suppressed for you.

The desktop element itself gets `isolation: isolate`, so the `z-index` values the controller writes stay inside it and can never fight the host page's own layers. Turn that off with `stacking: { isolate: false }` when the desktop must share a stacking context with the page around it.

Raising a window rewrites exactly one `z-index`: values are spread `gap` apart and the controller only re-numbers the windows that actually changed places, falling back to a full renumber when it runs out of room. Reading a window's `z-index` therefore tells you nothing but its relative position.

It also injects `[data-wm-resize]` handles, one `[data-wm-snap-preview]` per desktop and one visually hidden `[data-wm-announcer]` live region. A `<header>`, `<footer>`, `<nav>` or `<aside>` used as the drag handle gets `role="presentation"` so it does not leak a landmark out of the dialog.

### Keyboard defaults

| Keys | Action |
| --- | --- |
| arrows | move the focused window by `moveStep` |
| `Alt` + arrows | move by 1 px |
| `Shift` + arrows | resize |
| `Ctrl`/`Cmd` + `Alt` + `←`/`→` | snap to a half |
| `Ctrl`/`Cmd` + `Alt` + `↑`/`↓` | maximize / minimize or restore |
| `Ctrl`/`Cmd` + `Z`, `+ Shift` | undo, redo |
| `F6`, `Shift` + `F6` | cycle focus |
| `Escape` during a gesture | cancel and drop it from history |
| double click on the handle | toggle maximize |

Shortcuts never fire while the event target is a `button, input, select, textarea, a[href], [contenteditable]`.

## `createDesktopBinder(wm, options?)`

Order-independent wrapper used by the adapters: bind windows before or after the desktop exists, and before or after the window is opened.

```ts
interface DesktopBinder {
  wm: WindowManager
  controller(): DesktopController | null
  bindDesktop(element: HTMLElement): () => void
  bindWindow(id: string, element: HTMLElement, options?: WindowAttachOptions): () => void
  destroy(): void
}
```

`bindDesktop` throws if a desktop is already bound. Unbinding and re-binding is supported — the binder re-subscribes, which is what makes React StrictMode double-mounting harmless.

## Geometry helpers

Pure functions, no DOM, exported for building your own layout logic.

```ts
clamp(value, min, max): number
clampSize(size, min, max: Size | null): Size
clampToViewport(bounds, viewport, minVisible): Bounds
boundsEqual(a, b): boolean
zoneBounds(zone, viewport): Bounds
applyAspect(size, ratio, min, max, drive: 'width' | 'height'): Size
detectSnapZone(x, y, viewport, options?: { threshold?: number; cornerSize?: number }): SnapZone | null
magnetize(bounds, targets: readonly Bounds[], threshold): MagnetResult
```

`zoneBounds` tiles exactly: halves, quarters and thirds add back up to the viewport with no gap or overlap on odd sizes. `clampToViewport` keeps `minVisible` pixels reachable and never pushes a window narrower than that off both edges. `magnetize` returns `{ x, y, snappedX, snappedY }` and aligns any edge pair within `threshold`.

## Animation helpers

```ts
prefersReducedMotion(win: Window): boolean
flipToTarget(source: HTMLElement, target: Element, options?: FlipGhostOptions): void
flipFromTarget(source: HTMLElement, target: Element, options?: FlipGhostOptions): void
interface FlipGhostOptions { duration?: number; easing?: string }
```

Both flips render a throwaway ghost element and remove it on finish or cancel. They no-op under reduced motion, without `Element.animate`, or when either rect has zero width. `attachDesktop` calls them for you when `minimizeTarget` is set.

## Announcer

```ts
createAnnouncer(wm, container, messages?: Partial<AnnouncerMessages>): Announcer

interface AnnouncerMessages {
  opened(title: string): string
  closed(title: string): string
  minimized(title: string): string
  restored(title: string): string
  maximized(title: string): string
  snapped(title: string, zone: string): string
  focused(title: string): string
  workspace(index: number): string
}

interface Announcer {
  element: HTMLElement
  announce(message: string): void
  destroy(): void
}
```

`attachDesktop` creates one unless `announce: false`; pass an object to localise. A stage or workspace message always wins over the focus message produced in the same transaction, so the region never narrates "focused" over "maximized".

## Emitter

```ts
createEmitter<Events>(): Emitter<Events>
interface Emitter<Events> {
  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void
  emit<K extends keyof Events>(event: K, payload: Events[K]): void
  clear(): void
}
```

Listeners are snapshotted before dispatch, so subscribing or unsubscribing inside a handler is safe.

## `persist(wm, options?)` — `@surdeddd/wmkit/persist`

```ts
interface PersistOptions {
  key?: string             // 'wmkit'
  storage?: PersistStorage // localStorage, safely probed
  debounce?: number        // 150 ms
  autoRestore?: boolean    // true
  version?: number         // 0
  migrate?: (state: unknown, from: number) => SerializedState | null
}

interface PersistStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface PersistController {
  restore(): boolean
  save(): void
  clear(): void
  destroy(): void
}
```

Stored shape is `{ version, state }`. A payload from another `version` is passed to `migrate`; returning `null` (or having no `migrate`) discards it rather than restoring something broken, and a successful migration is written back immediately. Payloads written before the envelope existed are still read, as version `0`. Every storage call is wrapped: a throwing or absent storage turns the plugin into a no-op instead of an exception.

## `popout(wm, id, content, options?)` — `@surdeddd/wmkit/popout`

```ts
isPopoutSupported(): boolean
popout(wm, id, content: HTMLElement, options?: PopoutOptions): Promise<PopoutHandle>

interface PopoutOptions {
  width?: number                  // the window's current width
  height?: number
  copyStyles?: boolean            // true — styleSheets and adoptedStyleSheets
  minimizeWhilePopped?: boolean   // true, unless the window is already minimized
}

interface PopoutHandle {
  pipWindow: Window
  close(): void
}
```

Moves the live element into a Document Picture-in-Picture window — same JS context, same manager, no re-render. A comment marker holds its place in the original tree so `close()` or the user closing the OS window puts it back. Experimental and Chromium-only; always guard with `isPopoutSupported()`.
