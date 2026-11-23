---
title: Dockable panels like an IDE
description: Build an IDE layout in the browser with wmkit — dock windows into split panels with tabs and draggable separators, let panels float and dock again, save the layout as JSON and drive it from the keyboard.
---

# Dockable panels, the IDE layout

An editor in the middle, files on the left, a terminal below, and every panel can be torn out, floated over the rest and dropped back somewhere else. That is the layout of VS Code, of a trading terminal, of an admin console. In wmkit it is one plugin on top of ordinary windows: a window is docked or floating, and it is the same window either way.

## Dock three windows

```js
import { attachDesktop, createWindowManager } from '@surdeddd/wmkit'
import { createDock } from '@surdeddd/wmkit/dock'
import '@surdeddd/wmkit/themes/carbon.css'

const wm = createWindowManager()
const desktop = attachDesktop(wm, document.querySelector('#desktop'))
const dock = createDock(desktop)

for (const [id, title] of [['editor', 'main.ts'], ['files', 'Files'], ['terminal', 'Terminal']]) {
  wm.open({ id, title })
  const el = document.createElement('section')
  el.innerHTML = `<header data-wm-drag><span data-wm-title></span></header><div data-wm-content></div>`
  document.querySelector('#desktop').append(el)
  desktop.attachWindow(id, el)
}

dock.dock('editor')
dock.dock('files', { side: 'left' })
dock.dock('terminal', { side: 'bottom' })
```

`dock(id)` with no target fills the area or tabs into the first panel. A `side` splits the root; with a `stackId` it splits that panel, and `side: 'center'` adds a tab to it.

## What the user can do

- **Drag a titlebar** over a panel: near an edge the panel splits, at its centre the window becomes a tab, along the edge of the area it docks beside everything. A preview shows where it will land.
- **Tear a panel out** by its titlebar and it floats again, at the size it had before it was docked.
- **Drag a separator**, or focus it and press the arrow keys; Home and End go to the limits. One drag is one undo step.
- **Hold Shift** while dragging to keep a window floating over the panels.
- **Keyboard**: `Ctrl/⌘ + Alt + Shift + arrows` dock the focused window to a side, `Ctrl/⌘ + Alt + Shift + Backspace` undocks it.

Everything is undoable with `wm.undo()`, and screen readers hear what happened.

## Save and restore the layout

A layout is plain data: stacks of windows and splits with sizes.

```js
import { createDock } from '@surdeddd/wmkit/dock'
import { persist } from '@surdeddd/wmkit/persist'

export function workspace(wm, desktop) {
  const dock = createDock(desktop)
  persist(wm, { key: 'ide-layout' })
  return {
    save: () => JSON.stringify(dock.layout()),
    load: (text) => dock.setLayout(JSON.parse(text)),
  }
}
```

`persist` keeps the whole desktop, the dock included, across reloads. `layout()` and `setLayout()` are for presets of your own: a "debug" layout, a "review" layout, a reset button. `setLayout` returns `false` for a layout that names an unknown window or breaks an invariant, and changes nothing.

## Floating and docked together

The dock owns an area, by default the whole desktop. Windows that are not docked float above it, and windows on the `floating` or `modal` layer never dock by drag, so a palette or a dialog stays a window. Give the dock a smaller area to keep a toolbar or a taskbar free:

```js
import { createDock } from '@surdeddd/wmkit/dock'

export const dockBelowToolbar = (desktop) =>
  createDock(desktop, {
    area: ({ width, height }) => ({ x: 0, y: 40, width, height: height - 40 }),
  })
```

## Next

- [API reference](../api.md) — `createDock`, the layout types and the pure layout operations in `dockLayout`
- [Looking for a dockview alternative?](../compare/dockview-alternative.md) — when each library fits
- [Recipes](../recipes.md) — persistence with migrations, modal dialogs, a taskbar
