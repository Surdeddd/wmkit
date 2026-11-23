---
title: Vue draggable resizable window
description: Build draggable, resizable windows in Vue 3 with wmkit — composables for the manager and each window, snapping, keyboard control, a modal dialog and a saved layout, with your own template as the window.
---

# Draggable, resizable windows in Vue 3

`vue-draggable-resizable` and its relatives move one box. A screen with several windows needs more than that: one of them is on top, a click raises another, a dialog blocks the rest, the keyboard has to reach all of them and the layout should be there after a reload. wmkit is a window manager with a Vue entry: the windows are your own templates, and the composables keep them in step with one state machine.

## Install

```bash
npm i @surdeddd/wmkit
```

Vue 3.3 and later. The adapter is a few hundred bytes on top of the core and has no dependencies of its own.

## One window

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
useWmWindowEl(binder, 'notes', notes)
const note = useWmWindow(wm, 'notes')

wm.open({ id: 'notes', title: 'Notes', width: 420, height: 280 })
</script>

<template>
  <div ref="host" style="position: relative; height: 100vh">
    <section v-if="note" ref="notes">
      <header data-wm-drag>
        <span data-wm-title>{{ note.title }}</span>
        <span data-wm-controls>
          <button data-wm-minimize aria-label="Minimize" />
          <button data-wm-maximize aria-label="Maximize" />
          <button data-wm-close aria-label="Close" />
        </span>
      </header>
      <div data-wm-content>{{ state.order.length }} windows open</div>
    </section>
  </div>
</template>
```

`useDesktop` makes the `host` element the desktop, `useWmWindowEl` binds a template ref to a window id, and the attributes do the rest: `data-wm-drag` is the handle, the three buttons work without a listener, and resize handles appear on all eight sides. `v-if` removes the section when the window closes and renders it again when undo brings it back.

## What the composables return

| Composable | Returns |
| --- | --- |
| `useWindowManager(options?)` | the manager, destroyed with the effect scope |
| `useWmState(wm)` | a read-only `ComputedRef` of the whole state |
| `useWmWindow(wm, id)` | a `ComputedRef` of one window that changes only with that window |
| `useDesktop(wm, targetRef, options?)` | the binder that window elements attach to |
| `useWmWindowEl(binder, id, targetRef, options?)` | binds one element and rebinds when the id changes |

## Move it from code

The state is plain data and every change goes through the manager:

```ts
import type { WindowManager } from '@surdeddd/wmkit'

export function arrange(wm: WindowManager) {
  wm.snap('notes', 'left')
  wm.open({ id: 'confirm', title: 'Delete the note?', layer: 'modal', width: 320, height: 160 })
  return () => wm.undo()
}
```

`snap` takes halves, quarters and thirds. A window on the `modal` layer keeps focus inside itself and blocks the windows below until it closes.

## Remember the layout

```ts
import type { WindowManager } from '@surdeddd/wmkit'
import { persist } from '@surdeddd/wmkit/persist'

export const remember = (wm: WindowManager) => persist(wm, { key: 'my-app-windows' })
```

## Nuxt and server rendering

The manager is plain data and can be created on the server. The DOM part attaches after mount, so nothing needs a `<ClientOnly>` wrapper.

## Next

- [Adapters](../adapters.md#vue) — every composable and its contract
- [Theming](../theming.md) — sixteen themes, or style the `data-wm-*` attributes yourself
- [Recipes](../recipes.md) — a taskbar, modal dialogs, persistence with migrations
