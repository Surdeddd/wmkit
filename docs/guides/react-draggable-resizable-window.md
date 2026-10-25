---
title: React draggable resizable window
description: Build a draggable, resizable window in React with wmkit — snapping, keyboard control, focus and z-order, minimum sizes and persistence, in about thirty lines of your own markup.
---

# A draggable, resizable window in React

A window you can drag by its titlebar and resize from any edge sounds like an afternoon of `mousemove` handlers. It turns into a week once the details arrive. The window has to come to the front when clicked, stop at a minimum size, stay inside the viewport and survive touch input. Then it should snap to half the screen, answer the keyboard and remember where it was. wmkit handles all of that and leaves the markup to you.

<ClientOnly>
  <ReactWindowDemo />
</ClientOnly>

Drag the titlebar, pull any edge or corner, drop the window on the left or right edge of the box to snap it, double-click the titlebar to maximize. With a window focused, the arrow keys move it.

## Install

```bash
npm i @surdeddd/wmkit
```

React 18 and 19 are supported. The adapter has no dependencies of its own.

## The whole component

```tsx
import { useDesktop, useWindowManager, useWmState, useWmWindowRef } from '@surdeddd/wmkit/react'
import type { DesktopBinder, WindowState } from '@surdeddd/wmkit'
import '@surdeddd/wmkit/themes/glass.css'

function Window({ binder, win }: { binder: DesktopBinder; win: WindowState }) {
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
      <div data-wm-content>Anything React renders goes here.</div>
    </section>
  )
}

export function Desktop() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)

  return (
    <div ref={ref} style={{ position: 'relative', height: '100vh' }}>
      <button onClick={() => wm.open({ title: 'Notes', width: 360, height: 240, minWidth: 220 })}>
        New window
      </button>
      {Object.values(state.windows).map((win) => (
        <Window key={win.id} binder={binder} win={win} />
      ))}
    </div>
  )
}
```

`data-wm-drag` marks the drag handle, `data-wm-title` receives the title, and the three buttons work by attribute alone. The resize handles on all eight sides are added for you. Iterate `state.windows`, not `state.order`: `order` is the stacking order and changes on every click, and re-ordering DOM nodes in the middle of a click drops it.

## What you get without writing it

- **Drag and resize** with pointer capture, batched to one style write per frame, so a drag never loses the pointer over an iframe or outside the window.
- **Constraints**: `minWidth`, `minHeight`, `maxWidth`, `maxHeight` and `aspectRatio` are honoured by every move, including keyboard resizing and snapping.
- **Focus and stacking**: a press raises the window, focus moves into it, `Tab` stays inside a modal, and `F6` cycles windows.
- **Snapping** to halves, quarters and thirds with a live preview, and a drag off a snapped window tears it out at the cursor.
- **Keyboard**: arrows move, Shift+arrows resize, Ctrl/⌘+Alt+arrows snap, Ctrl/⌘+Z undoes the last move.
- **Screen readers** hear what happened ("Notes maximized", "Notes snapped to left") through one live region, in words you can replace.
- **Undo and redo**: a whole drag is one history step.

## Reading and controlling the position

The window state is plain data. Read it with a hook and change it through the manager:

```tsx
import { useWmWindow } from '@surdeddd/wmkit/react'

function Position({ wm }) {
  const notes = useWmWindow(wm, 'notes')
  if (!notes) return null
  return (
    <p>
      {Math.round(notes.bounds.x)}, {Math.round(notes.bounds.y)}
      <button onClick={() => wm.move('notes', 0, 0)}>top left</button>
      <button onClick={() => wm.snap('notes', 'right')}>right half</button>
    </p>
  )
}
```

`useWmWindow` re-renders only when that one window changes, so a panel showing coordinates does not re-render the rest of the page during a drag.

## Remember the layout

```ts
import { persist } from '@surdeddd/wmkit/persist'

persist(wm, { key: 'my-app-windows' })
```

Positions, sizes, stages and the stacking order are saved to `localStorage` and restored on the next visit.

## Next.js and server rendering

The manager is plain data and runs on the server. The DOM part attaches in an effect, so in the App Router mark the component that owns the desktop with `'use client'`. Nothing else changes.

## Compared with react-rnd and react-draggable

`react-draggable` moves an element and `react-rnd` adds resize handles to it. Both are good at exactly that. Stacking, focus, snapping, minimize and maximize, keyboard access and persistence are left to you, and once several windows share a screen most of the work is in those. wmkit is a window manager: the movement is the smallest part of what it does. If you only need one box that moves, react-draggable is lighter. If you are building windows, start here.

## Next

- [Adapters](../adapters.md#react) — every React hook and its contract
- [Theming](../theming.md) — sixteen themes, or style the `data-wm-*` attributes yourself
- [A Windows 95 desktop in React](./windows-95-desktop-react.md) — a taskbar, a start button and the retro theme
