---
title: react-rnd or wmkit
description: Looking for a react-rnd alternative? When one draggable, resizable box is enough react-rnd is the lighter choice, and when several windows share a screen wmkit adds stacking, focus, snapping, keyboard control and persistence.
---

# react-rnd or wmkit

react-rnd is a React component that makes one element draggable and resizable, and it is good at exactly that. wmkit is a window manager. If your screen has one movable box, read no further: react-rnd is smaller and simpler. The moment a second box appears, the questions change — which one is on top, where does focus go, what happens at the edge of the screen — and those are the questions a window manager answers.

Facts about react-rnd on this page were checked against its repository in November 2026.

## Side by side

| | react-rnd | wmkit |
| --- | --- | --- |
| What it is | one draggable, resizable component | a window manager with a React entry |
| Drag and resize, minimum and maximum size, aspect ratio | yes | yes |
| Bounds | the parent, the window, a selector | the desktop, with a strip that always stays reachable |
| Which window is on top | your `zIndex` in `style` | managed: a press raises, with normal, floating and modal layers |
| Focus, modal dialogs | yours to write | focus follows the window, a modal traps it |
| Minimize, maximize, restore | yours to write | built in |
| Snapping | to a grid | to a grid, to halves, quarters and thirds with a preview, to neighbours |
| Keyboard | — | move, resize, snap, cycle windows |
| Screen readers | — | one live region that says what happened |
| Undo, persistence | yours to write | `wm.undo()`, `persist()` |
| Beyond React | — | Vue, Svelte, Solid, Angular, Preact, Lit, Qwik, web components, vanilla |

## Choose react-rnd when

- there is one box, or a few that never overlap and never need focus rules: a resizable sidebar, a crop frame, items on a canvas;
- the position and size live in your own React state and you want nothing else from the library.

## Choose wmkit when

- windows overlap and the user moves between them;
- they need titlebars with close, minimize and maximize, a taskbar, snapping side by side;
- the layout should survive a reload, and a drag should be one undo step;
- keyboard and screen reader users have to be able to do everything the mouse does.

## The same window in wmkit

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
        <button data-wm-close aria-label="Close" />
      </header>
      <div data-wm-content>Your content.</div>
    </section>
  )
}

export function Desktop() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)
  return (
    <div ref={ref} style={{ position: 'relative', height: '100vh' }}>
      <button onClick={() => wm.open({ title: 'Notes', width: 360, height: 240 })}>New window</button>
      {Object.values(state.windows).map((win) => (
        <Window key={win.id} binder={binder} win={win} />
      ))}
    </div>
  )
}
```

The markup is yours, as with react-rnd. The difference is what you no longer write: stacking, focus, snapping, the keyboard and the history.

## Next

- [A draggable, resizable window in React](../guides/react-draggable-resizable-window.md) — the full guide
- [A taskbar, snap layouts and Alt+Tab](../guides/taskbar-snap-layouts-window-switcher.md)
- [Adapters](../adapters.md#react) — every hook and its contract
