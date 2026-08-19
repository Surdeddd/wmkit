# wmkit

**Headless window manager for the web.** Draggable, resizable, snappable windows with a taskbar model, keyboard accessibility and state persistence — for vanilla JS and every major framework.

[Русская версия](./README.ru.md) · [Live demo](https://wmkit.vercel.app) · [Mirror (Pages)](https://surdeddd.github.io/wmkit/) · [Docs](./docs/README.md) · [GitHub](https://github.com/Surdeddd/wmkit)

[![CI](https://github.com/Surdeddd/wmkit/actions/workflows/ci.yml/badge.svg)](https://github.com/Surdeddd/wmkit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@surdeddd/wmkit)](https://www.npmjs.com/package/@surdeddd/wmkit)
[![license](https://img.shields.io/badge/license-MIT-2dd4a8)](./LICENSE)

[![wmkit — live demo desktop](https://raw.githubusercontent.com/Surdeddd/wmkit/main/.github/assets/hero.png)](https://surdeddd.github.io/wmkit/)

<p align="center"><em>Every window above is real — <a href="https://surdeddd.github.io/wmkit/">open the demo</a> and drag one.</em></p>

- 🪟 **Full window lifecycle** — open, close, focus, minimize, maximize, restore, drag, 8-direction resize
- 🧠 **Headless core** — a serializable state machine plus a DOM controller; bring your own markup or use the glass theme
- ⚛️ **Official adapters** — `@surdeddd/wmkit/react`, `/vue`, `/svelte`, `/solid`, `/angular`, all thin sugar over one core
- 🗃️ **Tab groups** — drop one titlebar onto another and the windows share a frame, dockview style; the tab order is yours to reorder
- ⊞ **Snap zones** — halves, quarters, thirds and drag-to-top maximize with a live preview
- 🧲 **Magnetism** — window edges align to neighbours and the viewport while dragging
- ↩️ **Undo/redo** — every mutation is one step; a whole drag collapses into a single history entry
- 🗂️ **Workspaces & layouts** — virtual desktops, saved snapshots, `cascade`/`tile` in one call
- 🔒 **Aspect ratio lock** — pin a window to 16:9 or 4:3 and resize stays honest
- ⌨️ **Accessible** — keyboard move/resize/snap, F6 window cycling, focus-trapped modals, `aria-live` announcements
- ⚡ **Fast** — `transform`-only positioning, rAF-batched pointer input, structural sharing; 50 windows drag at 60fps
- 💾 **Persistence** — one call to serialize the desktop, one call to restore it, with versioned migrations
- 🎨 **Sixteen themes** — glass, light, retro, terminal, paper, neon, aqua, frost, candy, carbon, brutalist, blueprint, amber, noir, forest, synth — or bring your own CSS
- 🖼️ **Popout** *(experimental)* — send a window into Document Picture-in-Picture
- 📦 **Zero dependencies**, strict TypeScript, ESM + CJS, ~10.7 kB brotli core

## Install

```bash
npm install @surdeddd/wmkit
# or
pnpm add @surdeddd/wmkit
```

## Quick start (vanilla)

```js
import { createWindowManager, attachDesktop } from '@surdeddd/wmkit'
import '@surdeddd/wmkit/themes/glass.css'

const wm = createWindowManager()
const desktop = attachDesktop(wm, document.querySelector('#desktop'))

const win = wm.open({ title: 'Hello', width: 420, height: 280 })

const el = document.createElement('section')
el.innerHTML = `
  <header data-wm-drag>
    <span data-wm-title>Hello</span>
    <span data-wm-controls>
      <button data-wm-minimize aria-label="Minimize"></button>
      <button data-wm-maximize aria-label="Maximize"></button>
      <button data-wm-close aria-label="Close"></button>
    </span>
  </header>
  <div data-wm-content>Anything you want.</div>
`
document.querySelector('#desktop').append(el)
desktop.attachWindow(win.id, el, { removeOnClose: true })
```

The desktop element becomes the coordinate space. Your markup stays yours — wmkit wires behavior onto `data-wm-*` attributes:

| Attribute | Meaning |
| --- | --- |
| `data-wm-drag` | drag handle (usually the titlebar); double-click toggles maximize |
| `data-wm-title` | window title node; its text follows the state, and it is linked via `aria-labelledby` when it shares a root with the window |
| `data-wm-close` / `data-wm-minimize` / `data-wm-maximize` | control buttons, wired by delegation |
| `data-wm-content` | scrollable content area (styled by themes) |

`removeOnClose` detaches the controller and removes the element when the window closes. Touch devices get larger resize hit areas and snap thresholds automatically (`pointer: coarse`); tune via `attachDesktop(wm, el, { hitAreas: { edge, corner } })`.

The controller adds resize handles (`[data-wm-resize]`), a snap preview (`[data-wm-snap-preview]`) and a visually hidden live region for screen readers.

## React

```tsx
import { useWindowManager, useDesktop, useWmState, useWmWindowRef } from '@surdeddd/wmkit/react'
import '@surdeddd/wmkit/themes/glass.css'

function Desktop() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)

  return (
    <div ref={ref} style={{ position: 'relative', height: '100vh' }}>
      <button onClick={() => wm.open({ title: 'New window' })}>open</button>
      {state.order.map((id) => {
        const win = state.windows[id]
        return win ? <Win key={id} binder={binder} win={win} /> : null
      })}
    </div>
  )
}

function Win({ binder, win }) {
  const ref = useWmWindowRef(binder, win.id)
  return (
    <section ref={ref}>
      <header data-wm-drag>
        <span data-wm-title>{win.title}</span>
        <span data-wm-controls>
          <button data-wm-minimize aria-label="Minimize" />
          <button data-wm-maximize aria-label="Maximize" />
          <button data-wm-close aria-label="Close" />
        </span>
      </header>
      <div data-wm-content>Your React tree lives here — no portals, no innerHTML.</div>
    </section>
  )
}
```

`useWmState` subscribes through `useSyncExternalStore`; unchanged windows keep referential identity, so memoized children skip re-renders.

## Vue

```vue
<script setup>
import { ref } from 'vue'
import { useWindowManager, useDesktop, useWmWindowEl, useWmState } from '@surdeddd/wmkit/vue'
import '@surdeddd/wmkit/themes/glass.css'

const wm = useWindowManager()
const desktopEl = ref(null)
const binder = useDesktop(wm, desktopEl)
const state = useWmState(wm)

const noteEl = ref(null)
useWmWindowEl(binder, 'note', noteEl)
wm.open({ id: 'note', title: 'Note' })
</script>

<template>
  <div ref="desktopEl" style="position: relative; height: 100vh">
    <section ref="noteEl">
      <header data-wm-drag><span data-wm-title>{{ state.windows.note?.title }}</span></header>
      <div data-wm-content>composables all the way down</div>
    </section>
  </div>
</template>
```

## Svelte

```svelte
<script>
  import { createManager, createDesktop, wmWindowStore } from '@surdeddd/wmkit/svelte'
  import '@surdeddd/wmkit/themes/glass.css'

  const wm = createManager()
  const dk = createDesktop(wm)
  wm.open({ id: 'main', title: 'Hello' })
  const main = wmWindowStore(wm, 'main')
</script>

<div use:dk.desktop style="position: relative; height: 100vh">
  <section use:dk.window={{ id: 'main' }}>
    <header data-wm-drag><span data-wm-title>{$main?.title}</span></header>
    <div data-wm-content>stores and actions, no wrapper components</div>
  </section>
</div>
```

## Solid

```tsx
import { For } from 'solid-js'
import { useWindowManager, createDesktop, useWmState } from '@surdeddd/wmkit/solid'

function Desktop() {
  const wm = useWindowManager()
  const dk = createDesktop(wm)
  const state = useWmState(wm)
  wm.open({ title: 'Hello' })

  return (
    <div ref={dk.desktop} style={{ position: 'relative', height: '100vh' }}>
      <For each={state().order}>
        {(id) => (
          <section ref={dk.window(id)}>
            <header data-wm-drag>
              <span data-wm-title>{state().windows[id]?.title}</span>
            </header>
            <div data-wm-content>fine-grained, obviously</div>
          </section>
        )}
      </For>
    </div>
  )
}
```

## Angular

```ts
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core'
import { useWindowManager, createDesktop, useWmState } from '@surdeddd/wmkit/angular'

@Component({
  selector: 'app-desktop',
  standalone: true,
  template: `
    <div #desktop style="position: relative; height: 100vh">
      <section #hello>
        <header data-wm-drag><span data-wm-title>Hello</span></header>
        <div data-wm-content>signals inside</div>
      </section>
    </div>
  `,
})
export class DesktopComponent implements AfterViewInit {
  wm = useWindowManager()
  dk = createDesktop(this.wm)
  state = useWmState(this.wm)
  @ViewChild('desktop') desktopRef!: ElementRef<HTMLElement>
  @ViewChild('hello') helloRef!: ElementRef<HTMLElement>

  ngAfterViewInit(): void {
    this.wm.open({ id: 'hello', title: 'Hello' })
    this.dk.desktop(this.desktopRef.nativeElement)
    this.dk.window('hello')(this.helloRef.nativeElement)
  }
}
```

`useWmState` returns a read-only `Signal<ManagerState>` and `useWmWindow(wm, id)` a computed per-window signal, so templates track updates fine-grained. Hooks called in an injection context clean up through `DestroyRef` automatically; outside one they simply skip auto-cleanup.

## Snap zones in action

[![Snap zones — three windows tiled into thirds](https://raw.githubusercontent.com/Surdeddd/wmkit/main/.github/assets/snap.png)](https://surdeddd.github.io/wmkit/)

Throw a window against an edge or corner — a live preview shows the target zone, releasing tiles it. Halves, quarters, and drag-to-top maximize.

## Core API

### `createWindowManager(options?)`

Pure state machine — no DOM access, safe to create during SSR.

```ts
interface ManagerOptions {
  viewport?: { width: number; height: number }
  keepInViewport?: boolean      // clamp windows so the titlebar stays reachable (default true)
  minVisible?: number           // minimum visible strip in px (default 48)
  defaultSize?: { width: number; height: number }
  cascadeOffset?: number        // auto-position step for new windows (default 32)
  cascadeOrigin?: { x: number; y: number }
  idPrefix?: string
  historyLimit?: number         // undo/redo depth (default 50, 0 disables history)
  workspace?: number            // initial virtual desktop (default 0)
}
```

Manager methods:

| Method | Notes |
| --- | --- |
| `open(init?)` → `WindowState` | throws on duplicate `id`; cascades position when `x`/`y` omitted |
| `close(id)` / `closeAll()` | focus moves to the next eligible window |
| `focus(id)` / `blur()` / `cycleFocus(dir?)` | focusing a minimized window restores it; modals block focus below them |
| `minimize(id)` / `maximize(id)` / `restore(id)` / `toggleMaximize(id)` | restore returns to the pre-minimize stage, including maximized/snapped |
| `snap(id, zone)` | halves, quarters and thirds: `'left' \| 'right' \| 'top' \| 'bottom' \| 'top-left' \| … \| 'left-third' \| 'center-third' \| 'right-third'` |
| `move(id, x, y)` / `moveBy(id, dx, dy)` / `resize(id, patch)` | resizing a snapped window unsnaps it; `aspectRatio` is preserved |
| `center(id)` / `sendToBack(id)` | centre in the viewport, or drop to the bottom of the window's layer |
| `restoreTo(id, bounds)` | used for drag-off-snap; stage → `normal` at explicit bounds |
| `update(id, patch)` | title, layer, min/max size, `aspectRatio`, per-window flags, `meta` |
| `setViewport(size)` | re-derives maximized/snapped bounds, clamps the rest; never recorded in history |
| `workspace()` / `setWorkspace(n)` / `moveToWorkspace(id, n)` | virtual desktops; focusing a window switches to its workspace |
| `serialize()` / `hydrate(data)` | JSON-safe snapshot of the whole desktop, re-derived against the current viewport |
| `undo()` / `redo()` / `canUndo()` / `canRedo()` / `clearHistory()` | every mutation is one step; a whole drag or resize collapses into a single entry |
| `beginInteraction()` / `endInteraction()` / `abortInteraction()` | group a live gesture into one history entry, or drop it entirely on cancel |
| `saveLayout(name)` / `loadLayout(name)` / `deleteLayout(name)` / `layoutNames()` | named desktop snapshots; `getLayout`/`setLayout` for external storage |
| `arrange('cascade' \| 'tile')` | cascade staggers restored sizes, tile fills the viewport in a grid |
| `minimizeAll()` / `restoreAll()` | bulk stage switches in one history step |
| `subscribe(fn)` / `on(event, fn)` | granular events: `open, close, focus, move, resize, stage, update, order, modalblocked` |
| `batch(fn)` | coalesce many operations into one `change` notification |

Windows carry `layer: 'normal' | 'floating' | 'modal'` — floating stays on top, modals trap focus and block interaction below (blocked attempts emit `modalblocked` and flash the modal).

### `attachDesktop(wm, element, options?)`

DOM controller: pointer drag with capture (touch/pen included), 8-direction resize, snap detection with preview, keyboard handling, ARIA wiring, FLIP-to-taskbar animation.

```ts
interface DesktopOptions {
  snap?: boolean | { threshold?: number; cornerSize?: number; preview?: boolean; topEdge?: 'maximize' | 'top' | 'none' }
  keyboard?: boolean | { moveStep?: number; cycle?: boolean; snapShortcuts?: boolean; historyShortcuts?: boolean }
  announce?: boolean | Partial<AnnouncerMessages>   // localize screen-reader strings here
  autoViewport?: boolean                            // ResizeObserver → wm.setViewport (default true)
  magnetism?: boolean | { threshold?: number }      // edge-align to neighbours + viewport while dragging (default on, 8 px / 12 px coarse)
  hitAreas?: { edge?: number; corner?: number }     // resize handle thickness (auto-doubles on touch)
  minimizeTarget?: (win: WindowState) => Element | null  // FLIP ghost target on minimize
  onTitlebarContextMenu?: (win: WindowState, event: MouseEvent) => void  // right-click / long-press hook for your own menu
}
```

Keyboard defaults: arrows move the focused window (16 px), `Alt` for 1 px steps, `Shift+arrows` resize, `Ctrl/⌘+Alt+←/→` snap to a half, `Ctrl/⌘+Alt+↑/↓` maximize or minimize, `Ctrl/⌘+Z` / `Ctrl/⌘+Shift+Z` undo and redo, `F6` / `Shift+F6` cycle windows, `Escape` cancels an in-flight drag or resize (and drops it from the history).

### `persist(wm, options?)` — `@surdeddd/wmkit/persist`

```js
import { persist } from '@surdeddd/wmkit/persist'

const store = persist(wm, { key: 'my-desktop' })  // auto-restores, then debounce-saves on change
store.clear()
```

Storage defaults to `localStorage` (probed safely — SSR and private-mode friendly) and accepts any `getItem/setItem/removeItem` implementation.

Payloads are wrapped in a `{ version, state }` envelope. Bump `version` when your window contract changes and pass `migrate` to upgrade older data — anything you cannot migrate is discarded instead of restored broken:

```js
persist(wm, {
  version: 2,
  migrate: (state, from) => (from === 1 ? upgrade(state) : null),
})
```

### `popout(wm, id, contentEl, options?)` — `@surdeddd/wmkit/popout` *(experimental)*

Moves a window's content into a [Document Picture-in-Picture](https://developer.mozilla.org/docs/Web/API/Document_Picture-in-Picture_API) always-on-top OS window, keeping the same JS context and state. Feature-detect with `isPopoutSupported()`.

### `pinch(options?)`, `swipe(options?)`, `touchGestures(options?)` — `@surdeddd/wmkit/gestures`

Two-finger gestures, opt-in so the core never pays for them: pinch a window to resize it around the point between your fingers, swipe two fingers sideways to change workspace. 1.46 kB brotlied.

```js
import { attachDesktop } from '@surdeddd/wmkit'
import { touchGestures } from '@surdeddd/wmkit/gestures'

attachDesktop(wm, root, { gestures: [touchGestures({ swipe: { workspaces: 4 } })] })
```

A gesture is just a function that takes a `GestureContext` and returns its teardown, so your own gestures cooperate with the built-in drag and resize through the same `claim`/`busy` pair — see [docs/api.md](docs/api.md).

### `createDevtools(wm, options?)` — `@surdeddd/wmkit/devtools`

An opt-in panel that shows the live window table, an event log and the manager controls, so you can see what the state machine is doing without a debugger. It follows the manager, never the DOM, so it works with any adapter or none.

```js
import { createDevtools, devtoolsMessagesRu } from '@surdeddd/wmkit/devtools'

const panel = createDevtools(wm, { logLimit: 100 })
panel.destroy()
```

| Option | Default | Meaning |
| --- | --- | --- |
| `container` | `document.body` | where the panel mounts |
| `messages` | English catalog | pass `devtoolsMessagesRu` for Russian, or your own strings |
| `logLimit` | `50` | ring buffer size for the event log |
| `events` | open, close, focus, stage, workspace, group, modalblocked | which manager events to log |

Rows are patched in place rather than re-rendered, so keyboard focus inside the panel survives while windows move. It injects one scoped stylesheet, shared between panels and removed with the last one.

## Theming

`@surdeddd/wmkit/themes/glass.css` styles the `data-wm-*` attributes and exposes CSS variables:

```css
[data-wm-desktop] {
  --wm-radius: 14px;
  --wm-bg: rgba(22, 24, 34, 0.55);
  --wm-accent: #7c6cff;
  /* --wm-border, --wm-shadow, --wm-titlebar-bg, --wm-text, --wm-blur, --wm-transition … */
}
```

Fifteen more ready-made themes ship alongside — `light`, `retro`, `terminal`, `paper`, `neon`, `aqua`, `frost`, `candy`, `carbon`, `brutalist`, `blueprint`, `amber`, `noir`, `forest` and `synth`. They all style the same `data-wm-*` attributes, so switching is a one-line import swap, and every one of them ships 24px pointer targets plus `prefers-reduced-motion` and `forced-colors` blocks.

A theme dresses every window; a variant dresses one. Set `meta.variant` on a window and the desktop mirrors it to `data-wm-variant` for your CSS to pick up — see [docs/theming.md](docs/theming.md).

Skip the import entirely and the library stays headless: state attributes (`data-wm-stage`, `data-wm-focused`, `data-wm-dragging`, `data-wm-flash`, `[hidden]`) are yours to style.

## SSR

The core never touches `window`/`document` — create managers and even `hydrate()` state on the server, then call `attachDesktop` after mount. `persist` no-ops without usable storage.

## Documentation

This README is the tour. The reference lives in [`docs/`](./docs/README.md):

| Page | What is in it |
| --- | --- |
| [API reference](./docs/api.md) | every export, option, method, event and type |
| [Adapters](./docs/adapters.md) | complete React, Vue, Svelte, Solid and Angular integrations |
| [Theming](./docs/theming.md) | `data-wm-*` contract, CSS variables, writing a theme from scratch |
| [Recipes](./docs/recipes.md) | taskbar, modals, persistence, workspaces, SSR, testing, performance |
| [Browser support](./docs/browser-support.md) | baselines per entry point and what degrades where |

## Comparison

| | wmkit | WinBox | jsPanel4 | Dockview | Zag floating-panel |
| --- | --- | --- | --- | --- | --- |
| Maintained | ✓ 2026 | ✗ since 2023 | ✗ since 2022 | ✓ | ✓ |
| Headless core | ✓ | ✗ | ✗ | ~ own UI | ✓ |
| Official adapters | React·Vue·Svelte·Solid·Angular | community | ✗ | React·Vue·Angular | via Ark UI |
| Multi-window (z-order, taskbar, modals) | ✓ | partial | partial | dock groups | ✗ single panel |
| Snap zones + preview | ✓ | ✗ | ✗ | — | ✗ |
| Keyboard + screen reader | ✓ | ✗ | ✗ | partial | partial |
| Persistence built in | ✓ | ✗ | ✗ | ✓ | ✗ |
| Document PiP popout | ✓ | ✗ | ✗ | window.open | ✗ |
| TypeScript | strict | @types | ✗ | ✓ | ✓ |

*(checked July 2026: commit history, npm downloads, open feature requests)*

## Quality

- 250 unit tests: **100%** line/branch/function/statement coverage on the core state machine and persistence, with enforced floors on the DOM layer and the adapters
- 190+ Playwright scenarios on Chromium, WebKit and mobile emulation: drag, 8-way resize, snap, magnetism, workspaces, undo after drag, keyboard, touch, persistence across reloads, 50-window stress, modal traps, axe accessibility scans, visual regression screenshots
- performance benchmarks run in CI on every push (`vitest bench`): 1 000 windows open in ~150 ms, a move among 50 windows costs ~1.2 µs, a full 100-step undo/redo sweep ~52 µs
- `publint` + `@arethetypeswrong/cli` validate the published package, `size-limit` guards bundle budgets

## Development

```bash
pnpm install
pnpm dev          # landing + playground on Vite
pnpm test         # unit tests
pnpm test:e2e     # Playwright matrix
pnpm verify       # the full gate: lint, types, coverage, build, size, publint, e2e
```

## License

[MIT](./LICENSE) © Maksim Kravcov
