# Adapters

Every adapter is a thin wrapper over the same manager and the same DOM controller — around 60 lines each. They exist to attach and detach at the right moment in a component lifecycle, nothing more. Anything you can do in one, you can do in all of them, and you can always drop to the vanilla API.

The shared contract:

- **one manager per desktop**, created once and destroyed with the owning component
- **your markup** carries `data-wm-drag`, `data-wm-title`, `data-wm-content` and the control buttons
- **binding is order-independent**: bind a window element before or after the desktop exists, before or after `wm.open()`

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

`removeOnClose` detaches the controller and removes the element when the window closes, so you never leak nodes. Call `desktop.destroy()` when the whole desktop goes away.

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

      {state.order.map((id) => (
        <Win key={id} binder={binder} id={id} />
      ))}

      <Taskbar wm={wm} />
    </div>
  )
}

function Win({ binder, id }) {
  const win = useWmWindow(binder.wm, id)
  const ref = useWmWindowRef(binder, id, { removeOnClose: true })
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
  const minimized = state.order
    .map((id) => state.windows[id])
    .filter((win) => win?.stage === 'minimized')

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
| `useWindowManager(options?)` | a manager created once, destroyed on unmount |
| `useWmState(wm)` | the whole `ManagerState` through `useSyncExternalStore` |
| `useWmWindow(wm, id)` | one `WindowState \| undefined`, re-rendering only when that window changes |
| `useDesktop(wm, options?)` | `{ ref, binder, controller() }` — put `ref` on the desktop element |
| `useWmWindowRef(binder, id, options?)` | a ref callback for a window element |

Notes:

- `useWmWindow` is the memo-friendly subscription: unchanged windows keep referential identity, so a list of windows re-renders only the one that moved.
- `options` for `useDesktop` and `useWmWindowRef` are captured on first render (they configure a controller that already exists). Change behaviour through the manager, not by swapping options.
- StrictMode double-mounting is safe: the binder re-subscribes when the ref re-attaches.

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
| `useWmState(wm)` | `ShallowRef<ManagerState>` |
| `useWmWindow(wm, id)` | `ComputedRef<WindowState \| undefined>`; `id` may be a ref or getter |
| `useDesktop(wm, targetRef, options?)` | `DesktopBinder`, bound with `flush: 'post'` |
| `useWmWindowEl(binder, id, targetRef, options?)` | binds a window element, rebinding when the id changes |

Everything hooks into the current effect scope, so a component that unmounts cleans up. Outside a scope (a module-level manager, for example) nothing is auto-disposed — call `wm.destroy()` and `binder.destroy()` yourself.

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
      <For each={state().order}>
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

`useWmState` and `useWmWindow` return real signals, so they work in templates and in `computed()`. Cleanup goes through `DestroyRef` when you are inside an injection context; outside one, the adapter silently skips it and you dispose manually. Bind elements in `afterNextRender` — the view children do not exist before that.

## Choosing an entry point

| You want | Use |
| --- | --- |
| full control, no framework | `attachDesktop` directly |
| a framework lifecycle to own the wiring | the matching adapter |
| several desktops on one page | one manager and one binder per desktop |
| a desktop rendered by one framework, windows by another | `createDesktopBinder` shared between them |
| no DOM at all (tests, SSR, a native renderer) | `createWindowManager` alone |
