# Adapters

Every adapter is a thin wrapper over the same manager and the same DOM controller. They exist to attach and detach at the right moment in a component lifecycle, nothing more. Anything you can do in one, you can do in all of them, and you can always drop to the vanilla API.

The shared contract:

- **one manager per desktop**, created once and destroyed with the owning component
- **your markup** carries `data-wm-drag`, `data-wm-title`, `data-wm-content` and the control buttons
- **binding is order-independent**: bind a window element before or after the desktop exists, before or after `wm.open()`
- **render windows from `state.windows`**, not `state.order`: `order` is the stacking order and changes on every focus, so a keyed list over it moves DOM nodes — the click that follows the press is lost and iframes reload. The keys of `state.windows` keep opening order, and stacking is applied with `z-index`, so the DOM order never matters

## Vanilla

```js
import { createWindowManager, attachDesktop } from '@surdeddd/wmkit'
import '@surdeddd/wmkit/themes/glass.css'

const wm = createWindowManager()
const desktop = attachDesktop(wm, document.querySelector('#desktop'))

function spawn(init, render) {
  const win = wm.open(init)
  const el = document.createElement('section')
  el.innerHTML = `
    <header data-wm-drag>
      <span data-wm-title>${win.title}</span>
      <span data-wm-controls>
        <button data-wm-minimize aria-label="Minimize"></button>
        <button data-wm-maximize aria-label="Maximize"></button>
        <button data-wm-close aria-label="Close"></button>
      </span>
    </header>
    <div data-wm-content></div>
  `
  render(el.querySelector('[data-wm-content]'))
  document.querySelector('#desktop').append(el)
  desktop.attachWindow(win.id, el, { removeOnClose: true })
  return win
}

spawn({ title: 'Notes', width: 420, height: 280 }, (body) => {
  body.textContent = 'Anything you want.'
})
```

`removeOnClose` detaches the controller and removes the element when the window closes, so you never leak nodes. Through a binder (what the adapters use), a window that comes back — undo, a reopen, a close and open in one batch — gets its element appended to the desktop element again before it is attached. Call `desktop.destroy()` when the whole desktop goes away.

## React

`@surdeddd/wmkit/react`

```tsx
import {
  useWindowManager, useDesktop, useWmState, useWmWindow, useWmWindowRef,
} from '@surdeddd/wmkit/react'
import '@surdeddd/wmkit/themes/glass.css'

export function Desktop() {
  const wm = useWindowManager({ historyLimit: 100 })
  const { ref, binder } = useDesktop(wm, { magnetism: { threshold: 12 } })
  const state = useWmState(wm)

  return (
    <div ref={ref} style={{ position: 'relative', height: '100vh' }}>
      <button type="button" onClick={() => wm.open({ title: 'New window' })}>
        open
      </button>

      {Object.keys(state.windows).map((id) => (
        <Win key={id} binder={binder} id={id} />
      ))}

      <Taskbar wm={wm} />
    </div>
  )
}

function Win({ binder, id }) {
  const win = useWmWindow(binder.wm, id)
  const ref = useWmWindowRef(binder, id)
  if (!win) return null

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

function Taskbar({ wm }) {
  const state = useWmState(wm)
  const minimized = Object.values(state.windows).filter((win) => win.stage === 'minimized')

  return (
    <div role="toolbar" aria-label="Taskbar">
      {minimized.map((win) => (
        <button key={win.id} type="button" onClick={() => wm.focus(win.id)}>
          {win.title}
        </button>
      ))}
    </div>
  )
}
```

| Hook | Returns |
| --- | --- |
| `useWindowManager(options?)` | a manager created once, destroyed on the next macrotask after a real unmount; StrictMode's simulated unmount and Fast Refresh do not destroy it, so listeners added during render or in initializers survive in dev |
| `useWmState(wm)` | the whole `ManagerState` through `useSyncExternalStore` |
| `useWmWindow(wm, id)` | one `WindowState \| undefined`, re-rendering only when that window changes |
| `useDesktop(wm, options?)` | `{ ref, binder, controller() }` — put `ref` on the desktop element |
| `useWmWindowRef(binder, id, options?)` | a ref callback for a window element; `options` is `Omit<WindowAttachOptions, 'removeOnClose'>` |

Notes:

- `useWmWindow` is the memo-friendly subscription: unchanged windows keep referential identity, so a list of windows re-renders only the one that moved.
- `options` for `useDesktop` and `useWmWindowRef` are captured on first render (they configure a controller that already exists). Change behaviour through the manager, not by swapping options.
- React owns the window node, so the adapter never lets the controller remove it: render the window conditionally (`if (!win) return null`, as above) and React removes it. `removeOnClose` is not an option of `useWmWindowRef`.
- StrictMode double-mounting is safe: the adapter tears nothing down in an effect. The desktop ref's `null` call unbinds, the binder re-subscribes when the ref re-attaches, and the manager's destroy is deferred and cancelled by a remount. Works on React 18 and 19.

## Vue

`@surdeddd/wmkit/vue`

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  useWindowManager, useDesktop, useWmState, useWmWindow, useWmWindowEl,
} from '@surdeddd/wmkit/vue'
import '@surdeddd/wmkit/themes/glass.css'

const host = ref<HTMLElement>()
const wm = useWindowManager()
const binder = useDesktop(wm, host)
const state = useWmState(wm)

const notes = ref<HTMLElement>()
useWmWindowEl(binder, 'notes', notes, { removeOnClose: true })
const note = useWmWindow(wm, 'notes')

wm.open({ id: 'notes', title: 'Notes', width: 420, height: 280 })
</script>

<template>
  <div ref="host" style="position: relative; height: 100vh">
    <section ref="notes">
      <header data-wm-drag>
        <span data-wm-title>{{ note?.title }}</span>
        <span data-wm-controls>
          <button data-wm-minimize aria-label="Свернуть" />
          <button data-wm-maximize aria-label="Развернуть" />
          <button data-wm-close aria-label="Закрыть" />
        </span>
      </header>
      <div data-wm-content>{{ state.order.length }} windows open</div>
    </section>
  </div>
</template>
```

| Composable | Returns |
| --- | --- |
| `useWindowManager(options?)` | manager, destroyed with the effect scope |
| `useWmState(wm)` | `ComputedRef<ManagerState>`, read-only (writes are rejected) |
| `useWmWindow(wm, id)` | `ComputedRef<WindowState \| undefined>`; `id` may be a ref or getter |
| `useDesktop(wm, targetRef, options?)` | `DesktopBinder`, bound with `flush: 'post'` |
| `useWmWindowEl(binder, id, targetRef, options?)` | binds a window element, rebinding when the id changes |

Everything hooks into the current effect scope, so a component that unmounts cleans up. Outside a scope (a module-level manager, for example) nothing is auto-disposed — call `wm.destroy()` and `binder.destroy()` yourself. During server rendering `useWmState` and `useWmWindow` do not subscribe at all and return live getter refs, so a module-level manager shared across SSR requests does not accumulate listeners.

## Svelte

`@surdeddd/wmkit/svelte`

```svelte
<script lang="ts">
  import { createManager, createDesktop, wmStore, wmWindowStore } from '@surdeddd/wmkit/svelte'
  import '@surdeddd/wmkit/themes/glass.css'

  const wm = createManager()
  const dk = createDesktop(wm)
  const state = wmStore(wm)

  wm.open({ id: 'notes', title: 'Notes', width: 420, height: 280 })
  const notes = wmWindowStore(wm, 'notes')
</script>

<div use:dk.desktop style="position: relative; height: 100vh">
  <section use:dk.window={{ id: 'notes', removeOnClose: true }}>
    <header data-wm-drag>
      <span data-wm-title>{$notes?.title}</span>
      <span data-wm-controls>
        <button data-wm-minimize aria-label="Minimize"></button>
        <button data-wm-maximize aria-label="Maximize"></button>
        <button data-wm-close aria-label="Close"></button>
      </span>
    </header>
    <div data-wm-content>{$state.order.length} windows open</div>
  </section>
</div>
```

| Export | Returns |
| --- | --- |
| `createManager(options?)` | a plain manager — destroy it yourself if the component owns it |
| `wmStore(wm)` | readable store of `ManagerState` |
| `wmWindowStore(wm, id)` | readable store of one window, emitting only when that window changes |
| `createDesktop(wm, options?)` | `{ binder, desktop, window }` actions |

The `window` action only rebinds when `params.id` actually changes, so re-rendering during a drag does not interrupt it. The `desktop` action destroys the binder when the element goes away.

## Solid

`@surdeddd/wmkit/solid`

```tsx
import { For } from 'solid-js'
import { useWindowManager, createDesktop, useWmState, useWmWindow } from '@surdeddd/wmkit/solid'
import '@surdeddd/wmkit/themes/glass.css'

export function Desktop() {
  const wm = useWindowManager()
  const dk = createDesktop(wm)
  const state = useWmState(wm)

  wm.open({ title: 'Notes', width: 420, height: 280 })

  return (
    <div ref={dk.desktop} style={{ position: 'relative', height: '100vh' }}>
      <For each={Object.keys(state().windows)}>
        {(id) => {
          const win = useWmWindow(wm, id)
          return (
            <section ref={dk.window(id, { removeOnClose: true })}>
              <header data-wm-drag>
                <span data-wm-title>{win()?.title}</span>
                <span data-wm-controls>
                  <button data-wm-minimize aria-label="Minimize" />
                  <button data-wm-maximize aria-label="Maximize" />
                  <button data-wm-close aria-label="Close" />
                </span>
              </header>
              <div data-wm-content>fine-grained, obviously</div>
            </section>
          )
        }}
      </For>
    </div>
  )
}
```

`useWmWindow` accepts a string or an accessor. Everything registers `onCleanup` when an owner exists, so components dispose themselves; called outside an owner, nothing is auto-disposed.

Inside an owner, `dk.desktop` and `dk.window` bind on mount, after Solid inserts the element, so a newly opened window takes focus and the `position: relative` fix applies; outside an owner they bind immediately. Inside an owner `useWmWindow` is a memo that notifies only when its window changes, and an accessor id must be reactive (a signal or a prop) to be followed; outside an owner it is a plain live accessor, and on the server it reads live.

## Angular

`@surdeddd/wmkit/angular`

```ts
import { Component, ElementRef, afterNextRender, viewChild } from '@angular/core'
import { useWindowManager, createDesktop, useWmState, useWmWindow } from '@surdeddd/wmkit/angular'

@Component({
  selector: 'app-desktop',
  template: `
    <div class="desktop" #host style="position: relative; height: 100vh">
      <section #panel>
        <header data-wm-drag>
          <span data-wm-title>{{ note()?.title }}</span>
          <span data-wm-controls>
            <button data-wm-minimize aria-label="Minimize"></button>
            <button data-wm-maximize aria-label="Maximize"></button>
            <button data-wm-close aria-label="Close"></button>
          </span>
        </header>
        <div data-wm-content>{{ state().order.length }} windows open</div>
      </section>
    </div>
  `,
})
export class DesktopComponent {
  private host = viewChild.required<ElementRef<HTMLElement>>('host')
  private panel = viewChild.required<ElementRef<HTMLElement>>('panel')

  wm = useWindowManager()
  state = useWmState(this.wm)
  note = useWmWindow(this.wm, 'notes')

  constructor() {
    const dk = createDesktop(this.wm)
    afterNextRender(() => {
      dk.desktop(this.host().nativeElement)
      this.wm.open({ id: 'notes', title: 'Notes', width: 420, height: 280 })
      dk.window('notes', { removeOnClose: true })(this.panel().nativeElement)
    })
  }
}
```

`useWmState` and `useWmWindow` return real signals, so they work in templates and in `computed()`. The adapter writes its signal `untracked`, so a manager change made inside `effect()` or `computed()` does not throw NG0600 (Angular 16–18) or leave the signal stale. Cleanup goes through `DestroyRef` when you are inside an injection context; outside one, the adapter silently skips it and you dispose manually. Bind elements in `afterNextRender` — the view children do not exist before that.

## Preact

`@surdeddd/wmkit/preact`

```ts
import { h } from 'preact'
import {
  useWindowManager, useDesktop, useWmState, useWmWindowRef,
} from '@surdeddd/wmkit/preact'
import '@surdeddd/wmkit/themes/glass.css'

function Win({ binder, win }) {
  const ref = useWmWindowRef(binder, win.id)
  return h('section', { ref },
    h('header', { 'data-wm-drag': '' },
      h('span', { 'data-wm-title': '' }, win.title),
      h('span', { 'data-wm-controls': '' },
        h('button', { 'data-wm-minimize': '', 'aria-label': 'Minimize' }),
        h('button', { 'data-wm-maximize': '', 'aria-label': 'Maximize' }),
        h('button', { 'data-wm-close': '', 'aria-label': 'Close' }),
      ),
    ),
    h('div', { 'data-wm-content': '' }, 'Preact content'),
  )
}

export function Desktop() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)
  return h('div', { ref, style: { position: 'relative', height: '100vh' } },
    h('button', { type: 'button', onClick: () => wm.open({ title: 'New window' }) }, 'open'),
    Object.values(state.windows).map((win) => h(Win, { key: win.id, binder, win })),
  )
}
```

The same five hooks with the same contracts as the React adapter, built on `preact/hooks` (Preact 10 and later, JSX works the same way). Preact has no `useSyncExternalStore`, so the hooks subscribe in a layout effect and re-read the snapshot right after subscribing: a change made between render and subscription is not lost.

## Lit

`@surdeddd/wmkit/lit`

```ts
import { createWindowManager, createDesktopBinder } from '@surdeddd/wmkit'
import { WmStateController, wmDesktop, wmWindow } from '@surdeddd/wmkit/lit'
import { html, LitElement } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import '@surdeddd/wmkit/themes/glass.css'

const wm = createWindowManager()
const binder = createDesktopBinder(wm)

class AppDesktop extends LitElement {
  private view = new WmStateController(this, wm)

  createRenderRoot() {
    return this
  }

  render() {
    const windows = Object.values(this.view.state.windows)
    return html`<div ${wmDesktop(binder)} style="position: relative; height: 100vh">
      ${repeat(windows, (win) => win.id, (win) => html`
        <section ${wmWindow(binder, win.id)}>
          <header data-wm-drag>
            <span data-wm-title>${win.title}</span>
            <span data-wm-controls>
              <button data-wm-minimize aria-label="Minimize"></button>
              <button data-wm-maximize aria-label="Maximize"></button>
              <button data-wm-close aria-label="Close"></button>
            </span>
          </header>
          <div data-wm-content>Lit content</div>
        </section>`)}
    </div>`
  }
}

customElements.define('app-desktop', AppDesktop)
```

| Export | What it does |
| --- | --- |
| `WmStateController(host, wm)` | reactive controller; `.state` is the `ManagerState`, the host re-renders on every change while connected |
| `WmWindowController(host, wm, id)` | `.window` is one `WindowState \| undefined`; the host re-renders only when that window changes |
| `wmDesktop(binder)` | element directive that binds the desktop element |
| `wmWindow(binder, id, options?)` | element directive that binds a window element |

The directives bind when the part renders, release when it disconnects and bind again on reconnect, so moving the host around the page is safe. The controllers re-read the state on reconnect, so a host that was detached while the manager changed renders fresh. Key the window list with `repeat`, so a template instance stays with its window. Render into the light DOM (`createRenderRoot() { return this }`) for a theme stylesheet in the page to reach the windows. Inside the element's own shadow root, add the theme to its styles instead: `static styles = unsafeCSS(themeStyle('glass'))`, with `themeStyle` from `@surdeddd/wmkit/themes` ([Theming](./theming.md#themes-as-text)).

## Qwik

`@surdeddd/wmkit/qwik`

```tsx
import { component$ } from '@builder.io/qwik'
import { WmDesktop, WmWindow, useWm, useWmState } from '@surdeddd/wmkit/qwik'
import '@surdeddd/wmkit/themes/glass.css'

export const Count = component$(() => {
  const state = useWmState()
  return <output>{state.value?.order.length ?? 0} windows</output>
})

export const Opener = component$(() => {
  const store = useWm()
  return <button onClick$={() => store.wm?.open({ title: 'New window' })}>open</button>
})

export default component$(() => (
  <WmDesktop class="desktop">
    <WmWindow id="notes" title="Notes" x={20} y={60} width={320} height={220}>
      <button q:slot="controls" data-wm-close aria-label="Close">×</button>
      <p>Server-rendered content, resumable.</p>
    </WmWindow>
    <Count />
    <Opener />
  </WmDesktop>
))
```

| Export | What it does |
| --- | --- |
| `WmDesktop` | renders the desktop element; the manager is created on the client in `useVisibleTask$` and provided through `WmContext`. Props: `options` (desktop and manager options), `class` |
| `WmWindow` | renders a window section: a titlebar with `data-wm-title`, a `controls` slot and a content slot. Props: `id` plus any `WindowInit` field, `class` |
| `useWm()` | the desktop store: `wm` and `binder` (both `undefined` until the desktop is visible on the client) and `version`, bumped on every change |
| `useWmState()` | a computed signal with the `ManagerState`, `undefined` on the server |

`WmWindow` renders its initial bounds inline, so the server markup sits where the client will put it and resuming does not shift the layout. The window opens and attaches once the desktop exists on the client. Qwik owns the node: a window closed through the manager is hidden, and it comes back attached when its id is opened again. Unmounting a `WmWindow` closes its window.

The entry ships as `qwik.qwik.mjs`, so the Qwik optimizer processes it like your own components. Peer range: `@builder.io/qwik` 1.5 and later, below 2. Qwik City and other server-rendered setups load the Qwik loader for you. With a client-only `render()` you have to load it yourself, or no `onClick$` handler runs:

```ts
import { render } from '@builder.io/qwik'
import loader from '@builder.io/qwik/qwikloader.js?raw'

render(document.getElementById('app')!, <App />).then(() => {
  const script = document.createElement('script')
  script.textContent = loader
  document.head.append(script)
})
```

## Web Components

`@surdeddd/wmkit/elements`

```html
<script type="module">
  import '@surdeddd/wmkit/elements/define'
  import '@surdeddd/wmkit/themes/glass.css'
</script>

<wm-desktop persist="my-desktop" style="display: block; height: 100vh">
  <wm-window window-id="notes" label="Notes" x="20" y="20" width="320" height="220">
    <textarea>hello</textarea>
  </wm-window>
  <wm-window window-id="chart" label="Chart" x="360" y="40" width="320" height="220">
    <button slot="actions" type="button">↻</button>
    <p>chart</p>
  </wm-window>
  <wm-window window-id="later" label="Later" closed>
    <p>opens when the closed attribute goes away</p>
  </wm-window>
</wm-desktop>
```

`@surdeddd/wmkit/elements/define` registers `<wm-desktop>` and `<wm-window>`, and does nothing on the server. For another prefix, call `defineWmElements({ prefix: 'acme' })` from `@surdeddd/wmkit/elements` to get `<acme-desktop>` and `<acme-window>`. The elements work in any framework that renders HTML: React 19, Vue, Angular, Svelte, Solid or plain HTML.

`<wm-desktop>`

| Attribute or property | Meaning |
| --- | --- |
| `snap`, `keyboard`, `grouping`, `magnetism`, `announce` | on by default; `="false"` turns one off |
| `persist="key"` | saves the layout to `localStorage` under the key and restores it |
| `lang` | `ru…` picks the Russian button labels; the nearest `lang` on the page counts |
| `.options` | any desktop or manager option; set it before the element connects |
| `.messages` | your own button labels (`{ minimize, maximize, close }`); wins over `lang` |
| `.manager`, `.controller` | the manager and the controller, once connected |

`<wm-window>`

| Attribute | Meaning |
| --- | --- |
| `window-id` | the window id; generated when missing |
| `label` | the title |
| `x`, `y`, `width`, `height`, `min-width`, `min-height`, `max-width`, `max-height`, `aspect-ratio`, `workspace` | geometry and constraints |
| `stage` | `normal`, `minimized` or `maximized`; reflects the current stage back |
| `layer` | `normal`, `floating` or `modal` |
| `closable`, `minimizable`, `maximizable`, `resizable`, `draggable`, `snappable` | on by default; `="false"` turns one off |
| `closed` | the window is closed and hidden; removing the attribute reopens it |
| `chrome="none"` | hides the built-in titlebar, for your own `data-wm-drag` markup |

Changing an attribute drives the manager, and the manager reflects `stage` and `closed` back. The element is never removed by the library, so the framework that rendered it keeps ownership. Removing the element from the page closes its window; moving it does not.

The chrome lives in a shadow root with the parts `titlebar`, `title`, `control` (plus `minimize`, `maximize`, `close`) and `content`. The children stay in the light DOM, in the default slot, and the `actions` slot puts extra buttons into the titlebar. Style the parts with `::part()` and the theme tokens, which cross the shadow boundary.

Events bubble and cross shadow roots. Each `detail` carries the `window`:

| Event | When |
| --- | --- |
| `wm-ready` (on the desktop) | the manager exists; `detail.manager` |
| `wm-open`, `wm-close` | the window opened or closed |
| `wm-beforeclose` | a close was asked for; `preventDefault()` keeps the window open |
| `wm-move`, `wm-resize`, `wm-stage`, `wm-focus` | geometry, stage or focus changed |

## Choosing an entry point

| You want | Use |
| --- | --- |
| full control, no framework | `attachDesktop` directly |
| a framework lifecycle to own the wiring | the matching adapter |
| several desktops on one page | one manager and one binder per desktop |
| a desktop rendered by one framework, windows by another | `createDesktopBinder` shared between them |
| no DOM at all (tests, SSR, a native renderer) | `createWindowManager` alone |
