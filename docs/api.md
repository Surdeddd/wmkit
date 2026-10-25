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
- [devtools](#createdevtoolswm-options--surdedddwmkitdevtools)

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

`WindowGroup`, `HistoryEntry`, `SerializedWindowState`, `SerializedMaxSize` and `WindowUpdate` are exported types too.

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
  snapRect: Bounds | null        // snapTo target in viewport fractions; kept while maximized
  layer: WindowLayer
  workspace: number
  groupId: string | null          // the tab group it belongs to
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
  id?: string          // generated as `${idPrefix}-${n}` when omitted or empty; duplicates throw
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
  groups: Readonly<Record<string, WindowGroup>>   // see Tab groups
  extensions: Readonly<Record<string, unknown>>   // plugin state, see setExtension
}
```

`getState()` returns a cached object that is replaced on every change, so a `!==` check is enough to know something happened. Window ids may be any string, `constructor` and `__proto__` included: `windows` has a null prototype, so read it with `Object.keys`, `in` or `Object.hasOwn`, not `windows.hasOwnProperty`.

### SerializedState

```ts
interface SerializedState {
  version: 1
  windows: SerializedWindowState[]   // WindowState with maxSize as { width: number | null; height: number | null } | null
  order: string[]
  focusedId: string | null
  workspace: number
  activeTabs: Record<string, string>   // group id -> id of its visible member
  extensions?: Record<string, unknown> // always written; optional on read
}
```

`hydrate()` validates the payload and returns `false` instead of throwing: wrong `version`, a non-array `windows`, duplicate ids, a missing `bounds`, or an unknown `stage`/`layer` all reject the whole snapshot. Unknown per-window fields are replaced with defaults rather than rejected. A valid snapshot keeps its bounds as stored, `meta` is copied, and group members are re-synced to their active tab (an `activeTabs` entry that names no member falls back to the group's first). `focusedId: null` keeps the desktop blurred; only a missing or invalid id falls back to the top window.

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

With `viewport` at its zero default, `clampToViewport` is a no-op — so a manager hydrated before mount keeps its stored geometry, and the first `setViewport()` (usually from the controller's `ResizeObserver`) re-derives everything. Until the viewport is known, `maximize` and `open({ stage: 'maximized' })` keep the window's own frame, and undo, redo and hydrate do not re-derive geometry either. Under jsdom `clientWidth`/`clientHeight` are 0, so with `autoViewport` on the `setViewport` at mount is ignored and the constructor viewport stays: pass `viewport` to `createWindowManager` in tests.

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
| `focus(id)` | `boolean` | switches to the window's workspace first; restores it if minimized; `false` when a modal blocks it (emits `modalblocked`). Emits `focus` only when `focusedId` changes; focusing the focused window only raises it |
| `blur()` | `void` | clears `focusedId` without touching order |
| `cycleFocus(direction?)` | `string \| null` | `1` (default) or `-1`, wraps, skips minimized and other workspaces. `1` raises the bottom-most focusable window; `-1` sends the focused window to the back of its layer and focuses the one now on top, so the directions undo each other and both reach every window |
| `sendToBack(id)` | `boolean` | bottom of the window's own layer band; hands focus over if it was focused |

### Stage

| Method | Returns | Notes |
| --- | --- | --- |
| `minimize(id)` | `boolean` | remembers the stage it came from |
| `maximize(id)` | `boolean` | fills the viewport; keeps geometry in `restoreBounds` |
| `toggleMaximize(id)` | `boolean` | maximize, or restore when already maximized |
| `restore(id)` | `boolean` | from minimized returns to the remembered stage (a window returning to `normal` is re-clamped against the viewport when `keepInViewport` is on); from maximized/snapped returns to `restoreBounds`, re-clamped against min/max and the viewport — except a maximized window that carries a `snapRect`, which goes back to that rectangle |
| `restoreTo(id, bounds)` | `boolean` | forces `normal` at explicit bounds; used by drag-off-snap |
| `snap(id, zone)` | `boolean` | zone geometry, clamped to the window's own min/max |
| `snapTo(id, rect)` | `boolean` | snaps to any rectangle given in viewport fractions (`{ x: 0.5, y: 0, width: 0.5, height: 1 }` is the right half); it follows viewport changes like a zone does, and the first drag frame tears the window out. Unlike `snap` it neither focuses nor raises the window. The dock plugin is built on it |

`maximize`, `snap`, `restore`, `restoreTo`, `group` and `ungroup` focus the window the way `focus()` does: they switch to its workspace first, even when a modal is up on the current workspace. When a modal blocks the window they skip the focus silently and do not emit `modalblocked`, which means a blocked `focus()` call.

### Geometry

| Method | Returns | Notes |
| --- | --- | --- |
| `move(id, x, y)` | `boolean` | `normal` stage only; `true` when the clamp made it a no-op |
| `moveBy(id, dx, dy)` | `boolean` | relative `move` |
| `center(id)` | `boolean` | centres a `normal` window in the viewport |
| `resize(id, patch)` | `boolean` | `Partial<Bounds>`; unsnaps a snapped window; honours `aspectRatio`, driven by the axis that changed most |
| `update(id, patch)` | `boolean` | title, layer, min/max size, `aspectRatio`, flags, `meta` (shallow-merged). A patch that sets the values the window already has is a no-op: same object, no events, no history entry. Primitives compare by value; a new `meta`, `minSize` or `maxSize` object always counts as a change. Changing the constraints of a snapped window re-derives its zone |
| `setViewport(size)` | `void` | re-derives maximized and snapped bounds, clamps the rest; never recorded in history; a size with a zero or negative dimension (a hidden desktop) is ignored and the last known viewport stays |

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
| `ungroup(id)` | `boolean` | detaches one member, the rest stay contiguous in `order` (emits `order`); a group left with a single member dissolves entirely |
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
- a maximized group fills the viewport exactly, member constraints ignored, like a single maximized window
- otherwise the frame is sized so it satisfies every member's `minSize` and `maxSize`, not just the host's —
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

The `group` event fires on creation, activation and membership changes, including when a member closes and when a group dissolves (`members: []`, `activeId: ''`), with
`{ groupId, members, activeId, previous }`.

### History

| Method | Returns | Notes |
| --- | --- | --- |
| `undo()` / `redo()` | `boolean` | `false` when the stack is empty |
| `canUndo()` / `canRedo()` | `boolean` | |
| `clearHistory()` | `void` | both stacks. Inside a `batch` history restarts at the call, and later changes in the same batch undo back to it. During a gesture the rest of that gesture is not recorded, and `abortInteraction()` restores the history from before the gesture, which brings back what was cleared |
| `beginInteraction()` / `endInteraction()` | `void` | collapse a gesture into one entry; nestable |
| `abortInteraction()` | `void` | ends the interaction and drops the entry it created — for cancelled gestures |

`hydrate()` and `loadLayout()` clear the history: you cannot undo across a restore. Undo or redo during an interaction makes the rest of the gesture a new step and clears redo.

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
| `hydrate(data)` | `boolean` | emits `open`/`close` for the difference (and `focus` when focus moves), re-derives against the viewport |
| `subscribe(fn)` | `() => void` | one call per committed transaction; changes made by listeners during a dispatch can share one call. A transaction that only emits events, such as a blocked `focus`, delivers them without a `change` |
| `on(event, fn)` | `() => void` | granular events, see below |
| `batch(fn)` | `void` | one `change`, one history entry, events flushed at the end |
| `setExtension(key, value)` | `void` | stores plugin state under `getState().extensions[key]`; it is serialized, restored by `hydrate` and recorded in history, so a plugin change and the window changes in the same `batch` undo together. `undefined` removes the key; the same value is a no-op |

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
  group: { groupId: string; members: readonly string[]; activeId: string; previous: string | null }
  modalblocked: { window: WindowState }   // the modal that blocked, not the blocked window
  change: { state: ManagerState }
}
```

Ordering inside one transaction: the specific events fire in the order they happened, then `change` last. Payload objects are the post-change state.

`focus` fires only when `focusedId` changes, so `previous` is never the window itself; raising the focused window emits `order` alone. It also fires for `undo`, `redo`, `hydrate` and `loadLayout` when focus moves, and when an `open` behind a modal hands focus to the modal. `modalblocked` is emitted by a blocked `focus()` call only.

A modal that becomes the top modal through `update(…, { layer })` or `moveToWorkspace` (any tab of a modal group) takes focus; demoting the focused modal hands focus to the next visible modal.

A call made from inside a listener is queued behind the events already being delivered, and its `change` carries the latest state (it may be shared with the outer one). If a listener throws, the remaining events and `change` are still delivered and the first error is rethrown from the call that triggered them; an error raised while delivering a nested call's events surfaces at the outermost call. The listeners of the same event registered after a throwing one are skipped. A listener that keeps changing the state for 10 000 delivery rounds makes the call throw `wmkit: listeners keep changing the state`: the state stays committed and undelivered events go out with the next transaction.

`open` and `close` cover every way a window appears or disappears, not just the calls named after them: `hydrate`, `loadLayout`, `undo` and `redo` all report the difference they made, so mounting your content on `open` and disposing it on `close` stays correct across history. Their `open` payloads carry the final geometry, and a window that appears gets no `move` or `resize` before its `open`. It is safe to call `attachWindow` straight from an `open` handler.

The controller moves real DOM focus into the window that `focus` reports, so an app that applies remote `hydrate` or `loadLayout` snapshots while the user types takes the focus away from the input.

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
  skins?: Readonly<Record<string, WindowSkin>>  // named skins for mountWindow and meta.skin
  windowVariant?: (window: WindowState) => string | null  // defaults to meta.variant
}
```

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
| `pinch.lockTouchAction` | `false` | set `touch-action: none` on the desktop instead of `pan-x pan-y` (any two-finger gesture sets `pan-x pan-y`; `pinch()` and `swipe()` together restore the original value on destroy) |
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

```ts
interface DesktopController {
  element: HTMLElement
  wm: WindowManager
  attachWindow(id: string, element: HTMLElement, options?: WindowAttachOptions): () => void
  mountWindow(id: string, skin: WindowSkin | string, options?: WindowAttachOptions): MountedWindow
  actions(id: string): WindowActions
  destroy(): void
}

interface WindowAttachOptions {
  handle?: HTMLElement | string   // defaults to [data-wm-drag]
  resizeHandles?: boolean         // true
  removeOnClose?: boolean         // false for attachWindow, true for mountWindow
}
```

`attachWindow` throws for an unknown id or an id that is already attached. It returns a detach function; `destroy()` detaches everything, cancels an in-flight gesture and removes the snap preview, and the elements lose `data-wm-window` and `data-wm-focused` exactly as with a detach.

A window that the manager closes — including one that `undo` takes away — is detached for you: its listeners and resize handles go, and the element loses `data-wm-window` so nothing mistakes it for a live window afterwards. The element itself stays in the page unless you passed `removeOnClose`, and the detach function you were handed is safe to call again at any point, including after you have attached that same element to a different window or after `desktop.destroy()`.

### `desktop.actions(id)`

The same ten moves the manager exposes, already bound to one window, so a button handler never has to close over an id:

```js
const act = desktop.actions('notes')
closeButton.onclick = () => act.close()
```

`focus`, `close`, `minimize`, `maximize`, `toggleMaximize`, `restore`, `center`, `sendToBack`, `snap(zone)` and `moveToWorkspace(n)`. Each returns the same boolean the manager returns, and each returns `false` once the window is gone rather than throwing.

### `desktop.addDropTarget(hit)`

```ts
type DropTarget = (clientX: number, clientY: number, id: string) => DropHit | null
interface DropHit {
  preview: Bounds   // desktop-local rectangle shown while the pointer is over the target
  commit(): void    // runs when the drag ends there
}
```

Lets a plugin claim a window drag. On every drag frame the targets are asked in the order they were added, before tab grouping and snapping, and the first hit wins: its `preview` is drawn with the snap preview element, marked `data-wm-drop`, and its `commit` runs when the pointer is released there. Cancelling the drag (Escape, a lost pointer) commits nothing. The drop preview shows even with `snap: { preview: false }`. Returns a function that removes the target. The dock plugin is built on it.

### Driving a window from markup

Any element inside a window can carry one of these and the controller will act on it, with no listener of your own:

| attribute | effect |
| --- | --- |
| `data-wm-close` | closes the window |
| `data-wm-minimize` | minimizes it |
| `data-wm-maximize` | toggles maximized |
| `data-wm-restore` | returns it to its stored bounds |
| `data-wm-center` | centres it in the viewport |
| `data-wm-send-back` | drops it to the bottom of the stack |
| `data-wm-snap="left"` | snaps it to that zone, if the window is snappable |
| `data-wm-to-workspace="2"` | moves it to that workspace |

An unknown snap zone is ignored rather than thrown, so a typo in a template never takes the page down with it.

### `desktop.mountWindow(id, skin, options?)`

Builds a window's element from a skin instead of taking one you already made.

```ts
type WindowSkin = (context: SkinContext) => SkinMount

interface SkinContext {
  doc: Document
  id: string
  window: WindowState
  actions: WindowActions
}

interface SkinMount {
  element: HTMLElement
  content: HTMLElement
  destroy?(): void
}

interface MountedWindow {
  readonly element: HTMLElement
  readonly content: HTMLElement
  detach(): void
}
```

`skin` is either a factory or the name of one registered in `attachDesktop(wm, root, { skins })`; an unregistered name throws. A `meta.skin` change to an unregistered name, or to a factory that throws, throws once from the call that made the change: the window keeps its current skin and stays fully driven, and the controller does not retry until `meta.skin` changes again. The returned `element` and `content` are live: after the window is rebuilt they point at the new nodes, so a reference you took at mount time never goes stale. A handle whose window closed keeps pointing at its last nodes and never adopts a later window that reuses the id.

A window is rebuilt when `meta.skin` changes to another registered name, or when you call `mountWindow` again for the same id. Either way the content children move across, the id, geometry, focus and stacking survive, and the previous skin's `destroy` runs after the swap. Windows you attached yourself with `attachWindow` are never rebuilt behind your back. Mounting under a name other than `meta.skin` is kept; it is not corrected on the next change.

A skin's `destroy` runs exactly once: after a rebuild swap, on close, on `detach()` or on `desktop.destroy()`, whichever comes first.

### What the controller writes

On the window element: `data-wm-window`, `data-wm-stage`, `data-wm-layer`, `data-wm-workspace`, `data-wm-focused`, `data-wm-dragging`, `data-wm-resizing`, `data-wm-flash`, `hidden`, `role="dialog"`, `tabindex="-1"`, `aria-label`, `aria-labelledby` (when `[data-wm-title]` sits in the same root as the window; a title inside a shadow root is carried by `aria-label` instead), `aria-modal` on modal layers, plus inline `transform`, `width`, `height`, `z-index`. The first sync briefly sets `transition: none`, and an inline `transition` your app set is restored afterwards.

`data-wm-flash` is set when an interaction is blocked by a modal and stays until the next blocked interaction or until the window detaches, so style the flash with an animation that runs once per set rather than a static rule.

The controller moves keyboard focus into a window when the manager focuses it, or when its titlebar or a grip is pressed, returning it to the control that last had focus in that window; a press into the content is left to the browser. It parks focus on the desktop when its window closes or hides. Generated title ids are `wmkit-title-<id>-<n>`, unique per page.

Under a visible modal the DOM layer refuses pointer interaction on the lower windows: presses, drags, resizes, double clicks, action attributes and the titlebar menu. A blocked press flashes the modal. Keyboard input into lower windows is not blocked: Tab arriving from outside the desktop, or typing in a control that already had focus. An `iframe` as the first or last stop of a modal lets Tab leave from inside the frame, because key events inside a frame do not reach the parent document.

Frames inside windows (`iframe`, `object`, `embed`) never send their pointer or key events to the page, so the controller watches where focus goes instead: while the pointer is over a frame, and once whenever the page loses focus, a frame that took focus raises and focuses its window. Under a visible modal the frames in the lower windows get `pointer-events: none` until the modal goes away, so a click cannot reach their content.
### Touch

Every gesture is driven by pointer events, so a finger and a mouse take the same path. The drag handle and the resize grips are given `touch-action: none`, which is what stops the browser from panning the page out from under a drag, and hit areas grow on coarse pointers — the defaults above show both figures. Only one gesture runs at a time: a second finger landing on another titlebar mid-drag is ignored entirely, so it neither starts a competing drag nor focuses or raises that window. A drag or resize whose `setPointerCapture` throws does not start, and losing pointer capture cancels the gesture like `pointercancel`. A press on a control inside a web component in the titlebar does not start a drag (the inner target is read through `composedPath()`), and drop-to-group only targets the topmost window under the pointer. A long press produces a `contextmenu` event like anywhere else, which is where `onTitlebarContextMenu` is called from, with the browser's own menu suppressed for you.

The desktop element itself gets `isolation: isolate`, so the `z-index` values the controller writes stay inside it and can never fight the host page's own layers. Turn that off with `stacking: { isolate: false }` when the desktop must share a stacking context with the page around it.

Raising a window rewrites exactly one `z-index`: values are spread `gap` apart and the controller only re-numbers the windows that actually changed places, falling back to a full renumber when it runs out of room. Reading a window's `z-index` therefore tells you nothing but its relative position.

It also injects `[data-wm-resize]` handles, one `[data-wm-snap-preview]` per desktop and one visually hidden `[data-wm-announcer]` live region. A `<header>`, `<footer>`, `<nav>` or `<aside>` used as the drag handle gets `role="presentation"` so it does not leak a landmark out of the dialog.

### Keyboard defaults

| Keys | Action |
| --- | --- |
| arrows | move the focused window by `moveStep`; only while keyboard focus is on the window element or inside its titlebar, so lists, sliders and scroll areas in the content keep their arrows, and ignored during a pointer drag or resize |
| `Alt` + arrows | move by 1 px |
| `Shift` + arrows | resize |
| `Ctrl`/`Cmd` + `Alt` + `←`/`→` | snap to a half |
| `Ctrl`/`Cmd` + `Alt` + `↑`/`↓` | maximize / minimize or restore |
| `Ctrl`/`Cmd` + `Z`, `+ Shift` | undo, redo; non-Latin layouts work too, through the layout's Z key |
| `F6`, `Shift` + `F6` | cycle focus |
| `Escape` during a gesture | cancel and drop it from history |
| double click on the handle | toggle maximize |

Shortcuts never fire while the event target is a `button, input, select, textarea, a[href], [contenteditable]`, with one exception: `F6` and `Shift+F6` cycle windows from anywhere, including inside a field, because that is how keyboard users leave one.

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

- A bound element with no parent (one that was removed, for example by `removeOnClose` when its window closed) is appended to the desktop element when its window attaches, so a window that comes back through undo or a reopen is visible again. Elements still inside some tree are left where they are, even an off-document one. The element comes back as a direct child of the desktop, not inside the wrapper it lived in, so use `removeOnClose` only for nodes you created yourself, never for nodes a framework renders.
- When a window opens, only the first element bound to that id attaches, so `wm.open` never throws from the binder.
- A `bindWindow` call that throws (for example "already attached") leaves no binding behind.

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

`attachDesktop` creates one unless `announce: false`; pass an object to localise. A stage or workspace message always wins over the focus message produced in the same transaction, so the region never narrates "focused" over "maximized". Two identical announcements in a row still change the live region's text (a trailing no-break space toggles), so a screen reader speaks both.

## Emitter

```ts
createEmitter<Events>(): Emitter<Events>
interface Emitter<Events> {
  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void
  emit<K extends keyof Events>(event: K, payload: Events[K]): void
  clear(): void
}
```

Listeners are snapshotted before dispatch, so subscribing or unsubscribing inside a handler is safe. The manager's own events add the re-entrancy and error rules described under [Events](#events).

## `skin(spec)` — `@surdeddd/wmkit/chrome`

Turns a markup string into a `WindowSkin`, the factory `mountWindow` and the `skins` registry take.

```ts
interface SkinSpec {
  template: string      // one [data-wm-content] attribute, one root element, {{placeholders}} escaped and placed
  styles?: string       // one <style data-wm-skin-styles> per skin per document; needs a name to scope it
  shadow?: boolean      // build the chrome inside an open shadow root
  name?: string         // lands on the window as data-wm-skin
}

function skin(spec: SkinSpec): WindowSkin
function compileTemplate(template: string): (values: Record<string, string>) => string
function windowChrome(messages?: ChromeMessages): WindowSkin
const defaultSkin: WindowSkin    // titlebar, title and the three controls
const barebones: WindowSkin      // titlebar and title, nothing else

interface ChromeMessages {
  minimize: string
  maximize: string
  close: string
}
const chromeMessages: ChromeMessages    // English
const chromeMessagesRu: ChromeMessages  // Russian
```

Placeholders are `{{title}}`, `{{id}}`, `{{stage}}`, `{{layer}}`, `{{workspace}}` and `{{variant}}`. Every substitution is HTML-escaped with no opt-out (`{` included), so a window title can never smuggle markup into the chrome around it; an unknown placeholder expands to nothing rather than throwing, because a template outlives a rename.

A placeholder may sit only in text or in a *quoted* value of `aria-*`, `data-*`, `title`, `alt`, `class`, `id`, `role`, `lang`, `dir`, `for`, `value`, `placeholder` or `label`. Anywhere else, `compileTemplate()` and `skin()` throw a message naming the placeholder and the markup before it: an unquoted value, a tag or attribute name, any other attribute (URLs, `style`, `on*`, `srcdoc` …), a comment, the content of `script`, `style`, `textarea`, `title`, `xmp`, `iframe`, `noembed`, `noframes` and `plaintext`, anything after `<noscript>`, and anything after a `<style>` or `<script>` inside SVG. The compiler models the HTML tokenizer only, not SVG or MathML foreign-content breakout, so do not build placeholders inside foreign content that relies on breakout tags.

Only `{{title}}` inside `[data-wm-title]` follows state afterwards. Every other placeholder is rendered at mount or rebuild and goes stale, `aria-label="Close {{title}}"` included.

A template must contain exactly one `[data-wm-content]` attribute (a mention in text, a comment or an attribute value does not count) and a single root element, and `skin()` throws while you are writing it rather than silently dropping your content; extra roots throw `wmkit: a skin template needs a single root element …` at mount. `styles` without a `name` throws too — there would be nothing to scope the rules to.

Each `skin()` call owns its `<style data-wm-skin-styles="<name>">` per document, so two skins with the same name get one tag each and an edited skin's styles do land. The tag is removed when the last window wearing that skin is detached, rebuilt onto another skin or destroyed with the desktop.

With `shadow: true` the chrome is built inside an open shadow root; the template's root element is unwrapped, so `:host` is the box the titlebar and content sit in. Your content is the template's own `[data-wm-content]` element (attributes and default children kept), moved into the light DOM and projected through a `<slot>` placed where it stood, so shadow CSS reaches it as `::slotted([data-wm-content])`. Styles become one constructable stylesheet per skin per document, with a `<style>` element as the fallback where constructable sheets are missing.

## `themeNames`, `themeStyle(name, options?)` — `@surdeddd/wmkit/themes`

The sixteen shipped stylesheets as strings, for skins that cannot be reached by a stylesheet in `document.head`.

```ts
const themeNames: readonly ThemeName[]
const themeCss: Record<ThemeName, string>        // byte for byte the .css files
const themeShadowCss: Record<ThemeName, string>  // the same rules re-anchored to :host
function themeStyle(name: ThemeName, options?: { shadow?: boolean }): string
```

Pass `{ shadow: true }` for a shadow skin. Custom properties inherit through a shadow boundary, so the plain text delivers a theme's tokens and none of its rules — every rule is written from `[data-wm-window]`, and inside a shadow root nothing carries that attribute. See [theming.md](theming.md).

## `persist(wm, options?)` — `@surdeddd/wmkit/persist`

```ts
interface PersistOptions {
  key?: string             // 'wmkit'
  storage?: PersistStorage // localStorage, when reading it does not throw
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

Stored shape is `{ version, state }`. A payload from another `version` is passed to `migrate`; returning `null` (or having no `migrate`) discards it rather than restoring something broken, and a successful migration is written back immediately. Payloads written before the envelope existed are still read, as version `0`. Every storage call is wrapped: a throwing or absent storage turns the plugin into a no-op instead of an exception. There is no write probe: a full storage is still read, and a failed write is swallowed. A pending save is flushed on `pagehide` and on `destroy()`; `clear()` also cancels a pending save.

## `popout(wm, id, content, options?)` — `@surdeddd/wmkit/popout`

```ts
isPopoutSupported(target?: PopoutTarget): boolean     // 'auto' — either target works
listScreens(): Promise<readonly PopoutScreen[] | null> // null: no Window Management API, or permission denied
popout(wm, id, content: HTMLElement, options?: PopoutOptions): Promise<PopoutHandle>

type PopoutTarget = 'auto' | 'pip' | 'window'          // auto: picture-in-picture when available, else a popup

interface PopoutOptions {
  target?: PopoutTarget             // 'auto'
  width?: number                    // the window's current width
  height?: number
  screen?: PopoutScreen | 'current' | 'other'   // popup only: centre it on that screen
  left?: number                     // popup only: explicit position in screen coordinates
  top?: number
  mode?: 'move' | 'container'       // 'move' — carry `content`; 'container' — leave it, render into handle.container
  copyStyles?: boolean              // true — styleSheets and adoptedStyleSheets, with their media; disabled sheets skipped
  minimizeWhilePopped?: boolean     // true, unless the window is already minimized
}

interface PopoutHandle {
  target: 'pip' | 'window'
  window: Window
  pipWindow: Window                 // the same object as window, kept for 0.11 code
  container: HTMLElement            // the element in the popout that holds the content
  closed: Promise<void>             // settles once the content is back and the popout is gone
  close(): void                     // safe to call more than once
}
```

Moves the live element into a separate OS window — same JS context, same manager, no re-render. Two kinds exist. Document Picture-in-Picture (Chrome and Edge 116+, Firefox 151+) is always on top and sized by the browser; there is one per page. A popup (`window.open`, every engine) can be placed: `screen: 'other'` centres it on the first screen that is not the current one, `screen: 'current'` on the current one, or pass a screen from `listScreens()`. Placement needs the Window Management API (Chromium) and its permission; without either the popup opens where the browser puts it. A popup has to be opened from a user gesture, or the browser blocks it and `popout()` rejects with `wmkit: the popout window was blocked`.

A comment marker holds the content's place in the original tree. When the popout closes — `close()`, the user closing it, the window closing in the manager, or the page itself going away — the content goes back to the marker, or into the window's current `[data-wm-content]` if a skin rebuild discarded the marker's place. The popout's title follows the window's title. A window the popout minimized is restored only if it is still minimized, so a window the user restored and maximized meanwhile is left alone.

React (and any framework that delegates events from its root) loses its handlers on a node moved into another document. Use `mode: 'container'` and render into the popout through a portal — see the recipe in `recipes.md`.

## `createDock(desktop, options?)` — `@surdeddd/wmkit/dock`

```ts
createDock(desktop: DesktopController, options?: DockOptions): Dock

interface DockOptions {
  area?: (viewport: Size) => Bounds   // the whole desktop
  sash?: number                       // 6 px, 12 on coarse pointers
  edgeDrop?: number                   // 24 px band along the area edges that docks to the root; 0 turns it off
  minSize?: Size                      // floor for every panel; a panel never goes below its windows' own minSize
  keyboard?: boolean                  // true — Ctrl/⌘+Alt+Shift+arrows dock the focused window
  messages?: Partial<DockMessages>    // English; dockMessagesRu for Russian
}

interface Dock {
  dock(id: string, target?: { stackId?: string; side?: DockSide }): boolean
  undock(id: string): boolean
  layout(): DockLayout
  setLayout(layout: DockLayout): boolean
  destroy(): void
}

type DockSide = 'left' | 'right' | 'top' | 'bottom' | 'center'
type DockLayout = { root: DockNode | null }
type DockNode =
  | { kind: 'stack'; id: string; windows: string[]; active: string }
  | { kind: 'split'; id: string; axis: 'row' | 'column'; children: DockNode[]; sizes: number[] }
```

Tiles windows into a layout of panels, dockview style, while the other windows keep floating above it. A docked window is a snapped window with a `snapRect`: the panel rectangle in viewport fractions. It loses `resizable`, `minimizable` and `snappable` while docked and gets them back on undock, and its element carries `data-wm-docked` (square corners, no shadow). A panel with several windows is a tab group, so tabs come from the group machinery. The layout lives in `getState().extensions.dock`, which gives three things for free. One dock operation, with all its window changes, is one undo step. `persist` saves and restores the layout. `hydrate` places it on a desktop of any size.

- `dock(id)` with no target tabs the window into the first panel, or fills the area when nothing is docked. `side` splits the root, or a panel when `stackId` is given; `center` tabs in. `false` when nothing changed, the window is unknown, or it is on another workspace than the layout.
- `undock(id)` returns the window to its floating geometry.
- `setLayout(layout)` docks exactly the windows the layout names and undocks the rest. `false` for a layout that breaks an invariant (an empty panel, a split with one child, sizes that do not add up to 1, a window twice) or names an unknown window. `dockLayout` exports the pure operations (`insert`, `remove`, `resize`, `activate`, `moveInStack`, `stackOf`, `windowsOf`, `rects`, `validate`, `emptyLayout`) for building one.

Dragging a window over the area previews where it would land and docks it there on release. Near a panel edge it splits that panel, at the panel's centre it tabs in, and inside the edge band of the area it docks to the root. Hold Shift while dragging to keep a window floating over the layout. Windows on the `floating` or `modal` layer never dock by drag, and neither does a drop outside `area`. The first drag frame of a docked window tears it out and the panels close the gap. A cancelled drag puts it back.

Separators between panels are `div[data-wm-sash][role=separator]` with `aria-orientation` and `aria-valuenow`/`min`/`max` in percent. Drag one with the pointer (one undo step per drag), or focus it and press the arrow keys (16 px, 1 px with Shift) or Home/End for the limits. A panel never shrinks below the largest `minSize` of its windows, or `options.minSize` when that is larger.

A docked window that closes, is restored, is torn out or moves to another workspace leaves the layout, without an extra undo step: undoing the close brings back both the window and its panel. Maximizing a panel keeps it docked, and restoring returns it to the panel. A viewport change re-tiles the panels without touching history. The layout belongs to one workspace, and its separators hide on the others.

## `createDevtools(wm, options?)` — `@surdeddd/wmkit/devtools`

```ts
interface DevtoolsOptions {
  container?: HTMLElement           // document.body
  messages?: Partial<DevtoolsMessages>   // devtoolsMessages (English); devtoolsMessagesRu is exported
  logLimit?: number                 // 50
  events?: readonly (keyof ManagerEvents)[]  // open, close, focus, stage, workspace, group, modalblocked
}

interface DevtoolsController {
  element: HTMLElement
  destroy(): void
}
```

A panel with the live window table, an event log and undo, redo and copy-state controls. It follows the manager, never the DOM. The row buttons are fixed glyphs; copy writes `serialize()` as JSON to the clipboard and shows the JSON itself when the clipboard is missing or rejects the write.
