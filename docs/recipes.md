# Recipes

Working patterns for the things people build with a window manager. Every snippet is framework-agnostic unless it says otherwise.

- [Taskbar](#taskbar)
- [Minimize animation into the taskbar](#minimize-animation-into-the-taskbar)
- [Modal dialogs](#modal-dialogs)
- [Persistence and migrations](#persistence-and-migrations)
- [Workspaces](#workspaces)
- [Aspect-ratio windows](#aspect-ratio-windows)
- [Custom snap layouts](#custom-snap-layouts)
- [Grouping a gesture into one undo](#grouping-a-gesture-into-one-undo)
- [A context menu on the titlebar](#a-context-menu-on-the-titlebar)
- [Reacting to one window only](#reacting-to-one-window-only)
- [Server-side rendering](#server-side-rendering)
- [Testing](#testing)
- [Performance](#performance)

## Taskbar

`minimized()` returns the minimized windows of the active workspace, ordered by open time — that is exactly taskbar order.

```js
function renderTaskbar() {
  taskbar.replaceChildren(
    ...wm.minimized().map((win) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.task = win.id
      button.textContent = win.title
      button.addEventListener('click', () => wm.focus(win.id))
      return button
    }),
  )
}

wm.subscribe(renderTaskbar)
renderTaskbar()
```

`wm.focus(id)` on a minimized window restores it to whatever stage it was in before — maximized windows come back maximized. It also switches workspaces if the window lives on another one, which makes a global "all windows" list work with no extra code.

## Minimize animation into the taskbar

Point `minimizeTarget` at the element the window should fly into. Return `null` to skip the animation for a particular window.

```js
attachDesktop(wm, desktopEl, {
  minimizeTarget: (win) => taskbar.querySelector(`[data-task="${win.id}"]`) ?? taskbar,
})
```

The controller runs `flipToTarget` on minimize and `flipFromTarget` on restore, using a throwaway ghost so your content is never re-parented or re-rendered. Both no-op under reduced motion.

## Modal dialogs

Open with `layer: 'modal'`. The manager blocks focus on everything below it and emits `modalblocked`; the DOM layer flashes the modal and traps Tab inside it.

```js
const confirm = wm.open({
  id: 'confirm',
  title: 'Delete file?',
  layer: 'modal',
  width: 360,
  height: 180,
  closable: false,
})

wm.on('modalblocked', ({ window: modal }) => {
  console.log('user tried to reach past', modal.id)
})
```

Notes:

- `floating` is the softer variant: always on top, but not blocking.
- The trap needs something focusable inside the window; give the dialog a button.
- Programmatic calls are never blocked — `wm.close('confirm')` always works, which is how you dismiss it.

## Persistence and migrations

```js
import { persist } from '@surdeddd/wmkit/persist'

const store = persist(wm, {
  key: 'my-app-desktop',
  version: 2,
  migrate: (state, from) => (from === 1 ? upgradeV1(state) : null),
})
```

The plugin auto-restores on creation, then debounce-saves on every change. Payloads are wrapped as `{ version, state }`; a payload from another version goes through `migrate`, and returning `null` discards it instead of restoring something broken. A successful migration is written back immediately.

Restoring what you rendered is the other half — `hydrate` emits `open` for every window that appeared, so mounting can be driven entirely by events:

```js
wm.on('open', ({ window: win }) => {
  if (!mounted.has(win.id)) mount(win)
})
store.restore()
```

Bounds are re-derived against the current viewport during `hydrate`, so a desktop saved on a 27-inch monitor and restored on a laptop comes back on-screen: maximized windows refill, snapped windows re-snap, and normal windows are clamped so their titlebars stay reachable.

## Workspaces

```js
wm.open({ id: 'mail', title: 'Mail' })                 // active workspace
wm.open({ id: 'build', title: 'Build log', workspace: 1 })

wm.setWorkspace(1)          // 'mail' is now hidden, 'build' is focused
wm.moveToWorkspace('mail', 1)
wm.focus('build')           // switches back to workspace 1 if you had left
```

Windows outside the active workspace are `hidden`, unfocusable, excluded from `cycleFocus`, `minimized()`, `arrange()`, `minimizeAll()` and drag magnetism. Everything else — bounds, history, serialization — treats them normally. Render a switcher from `wm.getState().workspace` and mark the ones that contain windows:

```js
const populated = new Set(Object.values(wm.getState().windows).map((win) => win.workspace))
```

## Aspect-ratio windows

```js
wm.open({ id: 'player', title: 'Player', width: 640, aspectRatio: 16 / 9 })
wm.update('player', { aspectRatio: null })   // release the lock
```

The ratio is enforced on open, on `resize` and on `update`. During a pointer resize the driving axis is the edge you grabbed: north and south handles drive height, everything else drives width, so the window follows the cursor instead of fighting it. `minSize` and `maxSize` still win — if the box cannot satisfy the ratio, you get the closest legal size.

## Custom snap layouts

`zoneBounds` and `detectSnapZone` are exported, so you can build a layout picker without touching the drag code.

```js
import { zoneBounds } from '@surdeddd/wmkit'

const ZONES = ['left-third', 'center-third', 'right-third']

ZONES.forEach((zone) => {
  const button = document.createElement('button')
  button.textContent = zone
  button.addEventListener('click', () => {
    const id = wm.getState().focusedId
    if (id) wm.snap(id, zone)
  })
  pad.append(button)
})
```

To change what a drag to the edge does, use `snap` options: `threshold` and `cornerSize` move the hot zones, `topEdge: 'top' | 'none'` changes the drag-to-top behaviour, `preview: false` removes the ghost, and `snap: false` disables the whole thing. For a fixed grid, turn snapping off and drive `restoreTo` yourself from the `move` event.

## Grouping a gesture into one undo

Drag and resize already collapse into a single history entry. Do the same for your own gestures:

```js
wm.beginInteraction()
for (const id of selection) wm.moveBy(id, dx, dy)
wm.endInteraction()          // one undo step for the whole group
```

If the user cancels, `abortInteraction()` ends the interaction *and* drops the entry it created, so Escape leaves no trace in the history. `batch(fn)` is the non-gesture equivalent: one `change` notification and one history entry for a burst of calls.

## A context menu on the titlebar

```js
attachDesktop(wm, desktopEl, {
  onTitlebarContextMenu: (win, event) => {
    showMyMenu(event.clientX, event.clientY, [
      { label: 'Send to back', run: () => wm.sendToBack(win.id) },
      { label: 'Centre', run: () => wm.center(win.id) },
      { label: 'Move to desktop 2', run: () => wm.moveToWorkspace(win.id, 1) },
      { label: 'Close', run: () => wm.close(win.id) },
    ])
  },
})
```

The hook fires on right click and on long press, and the native menu is suppressed for you.

## Reacting to one window only

`subscribe` fires for every change on the desktop. When you only care about one window, compare identity — unchanged windows keep the same object:

```js
let last = wm.get(id)
const stop = wm.subscribe(() => {
  const next = wm.get(id)
  if (next === last) return
  last = next
  render(next)
})
```

That is exactly what `useWmWindow` and `wmWindowStore` do, and it is why a fifty-window desktop re-renders one component when one window moves.

## Server-side rendering

`src/core` never touches `window` or `document`. Create the manager on the server, hydrate a saved layout, serialize it into the payload, and only attach the DOM layer after mount.

```js
// server
const wm = createWindowManager({ viewport: { width: 0, height: 0 } })
wm.hydrate(savedLayout)
const payload = wm.serialize()

// client, after mount
const wm = createWindowManager()
wm.hydrate(payload)
attachDesktop(wm, desktopEl)   // ResizeObserver sets the real viewport, bounds re-derive
```

Leaving the viewport at `0 × 0` on the server keeps clamping switched off, so nothing is squeezed into a viewport you do not know yet. `persist` probes storage in a `try`/`catch` and becomes a no-op when there is none.

## Testing

The core is a plain object with no DOM, so unit tests need no environment:

```js
import { createWindowManager } from '@surdeddd/wmkit'

const wm = createWindowManager({ viewport: { width: 1000, height: 800 } })
const win = wm.open({ title: 'Test' })
wm.snap(win.id, 'left')
expect(wm.get(win.id).bounds).toEqual({ x: 0, y: 0, width: 500, height: 800 })
```

For DOM behaviour, drive real pointer events — the library uses pointer capture, so synthetic mouse events will not do. In Playwright:

```js
const box = await handle.boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(target.x, target.y, { steps: 16 })
await page.mouse.up()
```

Wait for animations before asserting geometry, and remember that magnetism can shift a final position by up to the threshold — assert with a tolerance, or pass `magnetism: false` in the fixture.

## Performance

The defaults are already the fast path: positioning is `transform` only, pointer input is batched into one `requestAnimationFrame`, state uses structural sharing, and the desktop rect is cached for the duration of a gesture.

What still matters on your side:

- **Batch bulk work.** `wm.batch(() => { for (…) wm.open(…) })` turns fifty opens into one notification, one re-render and one layout pass.
- **Subscribe narrowly.** Per-window subscriptions beat re-rendering the list.
- **Keep content cheap while dragging.** `[data-wm-dragging]` is on the element — use it to pause expensive effects.
- **Do not animate `transform` in your theme during a gesture.** The shipped themes already switch the transition off; a custom theme must do the same.
