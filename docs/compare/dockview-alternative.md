---
title: dockview or wmkit
description: Looking for a dockview alternative? An honest comparison of dockview and wmkit — a docking layout manager against a window manager with docking as a plugin — and which one fits an IDE workbench, a web desktop or a dashboard.
---

# dockview or wmkit

dockview is a very good docking layout manager, and for some applications it is the right choice over wmkit. The two libraries start from opposite ends. dockview starts from a docked workbench of panels and lets a group float or pop out. wmkit starts from free windows — open, minimize, maximize, snap, stack, switch — and lets a window dock. Which end your application lives on decides the answer.

Facts about dockview on this page were checked against its documentation and repository in November 2026.

## Side by side

| | dockview | wmkit |
| --- | --- | --- |
| What it is first | a docking layout: grids, split views, tab groups | a window manager: floating windows with a full lifecycle |
| Docking with splits and tabs | the core of the library | the `dock` plugin |
| Floating panels | floating groups over the layout | every window, with minimize, maximize, restore and z-order layers |
| Popout into another browser window | yes, groups pop out | `popout`, Picture-in-Picture or a popup |
| Snap to halves, quarters, thirds, a layout menu | — | built in, plus `layouts` |
| Taskbar, window switcher, overview | — | `taskbar`, `switcher` |
| Workspaces (virtual desktops) | — | built in |
| Undo and redo | Enterprise edition | in the MIT core, a whole drag as one step |
| Frameworks | React, Vue, Angular, vanilla TypeScript | React, Vue, Svelte, Solid, Angular, Preact, Lit, Qwik, web components, vanilla |
| Licence | MIT core, commercial Enterprise edition | MIT, everything |
| Dependencies | none | none |

## Choose dockview when

- the application **is** a workbench: almost everything is docked almost always, as in an IDE or a trading terminal with fixed panels;
- you need what its docking does beyond the basics, such as nested grids with fine control of every group, or its Enterprise features;
- floating is the exception, a panel pulled out for a moment.

## Choose wmkit when

- windows float by default and the user arranges them: a web desktop, a dashboard of widgets, tools over a canvas, a support console;
- the windows need a life of their own: minimize into a taskbar, maximize, snap side by side, Alt+Tab, several workspaces, a question before closing;
- some windows dock and the others keep floating over the dock;
- every action has to work from the keyboard and be announced, and undo has to cover all of it;
- the page uses Svelte, Solid, Preact, Lit or Qwik, no framework at all, or several at once.

## Docking in wmkit

```js
import { attachDesktop, createWindowManager } from '@surdeddd/wmkit'
import { createDock } from '@surdeddd/wmkit/dock'

const wm = createWindowManager()
const desktop = attachDesktop(wm, document.querySelector('#desktop'))
const dock = createDock(desktop)

wm.open({ id: 'editor', title: 'main.ts' })
wm.open({ id: 'files', title: 'Files' })
dock.dock('editor')
dock.dock('files', { side: 'left' })
```

A docked window is still a window: tear it out and it floats, undo and it is back in its panel, and `persist` saves both states.

## Next

- [Dockable panels like an IDE](../guides/dockable-panels-ide-layout.md) — the whole docking guide
- [A taskbar, snap layouts and Alt+Tab](../guides/taskbar-snap-layouts-window-switcher.md)
- [API reference](../api.md)
