---
title: Taskbar, snap layouts and Alt+Tab for a web desktop
description: Turn floating windows into a desktop with wmkit — a taskbar, a snap layout menu like the one in Windows 11, neighbours that resize together, a window switcher with an overview, a close confirmation and one desktop across browser tabs.
---

# A taskbar, snap layouts and Alt+Tab

Windows that drag and resize are the first tenth of a desktop. The rest is what people reach for without thinking: a taskbar to find a window, a menu that tiles it into a third of the screen, Alt+Tab, a question before unsaved work disappears. Each of these is a small plugin over the same manager, and each can be used alone.

## Everything at once

```js
import { attachDesktop, createWindowManager } from '@surdeddd/wmkit'
import { createLayoutPicker, linkSnapped } from '@surdeddd/wmkit/layouts'
import { createSwitcher } from '@surdeddd/wmkit/switcher'
import { sync } from '@surdeddd/wmkit/sync'
import { createTaskbar } from '@surdeddd/wmkit/taskbar'
import '@surdeddd/wmkit/themes/glass.css'

const wm = createWindowManager()
const taskbar = createTaskbar(wm, document.querySelector('#taskbar'))
const desktop = attachDesktop(wm, document.querySelector('#desktop'), {
  minimizeTarget: (win) => taskbar.targetOf(win),
  grid: 16,
})

createLayoutPicker(desktop)
linkSnapped(desktop)
const switcher = createSwitcher(desktop)
sync(wm, { channel: 'my-desktop' })

document.querySelector('#overview').addEventListener('click', () => switcher.overview())
```

## The taskbar

`createTaskbar` fills an element of yours with one button per window, in opening order, and one per tab group. A click focuses the window, restores it when it is minimized, and minimizes it when it already has the focus; a middle click asks it to close. The bar is one tab stop and the arrow keys walk it. `minimizeTarget` makes a minimized window fly to its button.

The plugin brings behaviour and accessibility and no look. The buttons carry attributes for your CSS:

```css
#taskbar { display: flex; gap: 6px; }
#taskbar [data-wm-task] { padding: 6px 12px; border-radius: 8px; }
#taskbar [data-wm-task][data-wm-focused] { background: rgb(255 255 255 / 0.16); }
#taskbar [data-wm-task][data-wm-stage='minimized'] { opacity: 0.6; }
```

## Snap layouts

`createLayoutPicker` opens a menu of layouts when the mouse rests on a maximize button, from the context menu of that button, on a long press and on `Ctrl/⌘ + Alt + L`. Pick an area and the window snaps into it: halves, a wide column with a narrow one, thirds, quarters, or layouts of your own.

`linkSnapped` puts a separator on the edge that snapped neighbours share. Drag it, or focus it and press the arrow keys, and the windows on both sides resize together as one undo step. `grid: 16` in the desktop options lands free windows on a 16 px step; holding Alt while dragging turns the grid off.

## Alt+Tab and the overview

Hold Alt and press the backquote to walk the windows from the most recently used; let go to switch. `switcher.overview()` scales every window down into a grid so one can be picked with the pointer or the arrows. The overview moves elements, not state: the manager and its history stay as they were.

## Ask before a window closes

```js
import { createWindowManager } from '@surdeddd/wmkit'

const wm = createWindowManager()
wm.onBeforeClose((win) => (win.meta.unsaved ? window.confirm(`Discard changes in ${win.title}?`) : true))
```

The close button, the taskbar and `wm.requestClose(id)` ask the guards in turn; the first one that answers `false` keeps the window. A guard may return a promise, so the question can be a dialog of your own.

## One desktop in every tab

`sync(wm, { channel })` sends every change over a `BroadcastChannel`. A tab that opens later joins the desktop that is already there, and the later change wins everywhere.

## Next

- [API reference](../api.md) — the options of every plugin on this page
- [Dockable panels like an IDE](./dockable-panels-ide-layout.md) — split panels and tabs next to floating windows
- [Recipes](../recipes.md) — persistence with migrations, modal dialogs
