---
title: wmkit for AI coding agents
description: What a coding agent needs to write wmkit code that runs the first time — the three layers, the markup contract, the mistakes to avoid and where the machine-readable docs live.
---

# wmkit for AI coding agents

This page is written for coding agents — Claude, Cursor, Copilot, Codex — and for the people who prompt them. It is short on purpose: everything here is something an agent gets wrong without being told.

## Where the machine-readable docs are

| What | Where |
| --- | --- |
| Entry points, rules and a quick start, one screen | [`llms.txt`](https://wmkit.vercel.app/llms.txt), also inside the package as `node_modules/@surdeddd/wmkit/llms.txt` |
| The whole documentation as one file | [`llms-full.txt`](https://wmkit.vercel.app/llms-full.txt) |
| Every type | `node_modules/@surdeddd/wmkit/dist/*.d.ts` |
| Settings for Context7 | `context7.json` in the [repository](https://github.com/Surdeddd/wmkit) |

## The model in four sentences

The **manager** (`createWindowManager`) is a state machine with no DOM: it knows the windows, their bounds, stages, order, focus, groups and history. The **desktop controller** (`attachDesktop`) turns pointer, touch and keyboard input on your markup into calls on the manager and writes positions back. An **adapter** binds a framework's lifecycle to that controller, and window content stays in your own component tree. **Plugins** take the manager or the desktop and add one thing each: docking, layouts, a taskbar, a switcher, persistence, sync.

## The smallest working desktop

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

## Rules that prevent the usual mistakes

- The desktop element is the coordinate space. Give it a size; `attachDesktop` makes it `position: relative` when it is static.
- `wm.open()` only creates state. A window shows once an element is bound: `desktop.attachWindow(win.id, element)`, or the hook of an adapter.
- Mark your markup with attributes: `data-wm-drag` on the titlebar, `data-wm-title`, `data-wm-content`, and `data-wm-close`, `data-wm-minimize`, `data-wm-maximize` on buttons. Do not add your own click handlers for them.
- Do not position windows with CSS. The controller writes `transform` and size; read geometry from `win.bounds`.
- Window ids are strings. `open` throws on an id that is taken; most other methods return `false` when refused.
- State is one JSON-safe object: `wm.serialize()` and `wm.hydrate(data)`, or `persist(wm, { key })` to store it.
- A whole drag or resize is one undo step. `wm.undo()` and `wm.redo()` return whether anything changed.
- Create the manager anywhere, also on a server. Call `attachDesktop` only in the browser; the adapters do that for you.
- A dialog is a window with `layer: "modal"`: it traps focus and blocks the windows below.
- To confirm a close, register `wm.onBeforeClose(guard)`; the guard returns `false` or a promise of it to keep the window. The close button and `wm.requestClose(id)` ask the guards, `wm.close(id)` does not.
- Import a theme (`@surdeddd/wmkit/themes/glass.css`) or style the `data-wm-*` attributes yourself: the core positions windows and leaves their look to CSS.

## Which import for which request

| The request says | Import |
| --- | --- |
| a floating window, a draggable dialog, windows in React | `@surdeddd/wmkit/react` |
| the same in Vue, Svelte, Solid, Angular, Preact, Lit or Qwik | `@surdeddd/wmkit/vue`, `/svelte`, `/solid`, `/angular`, `/preact`, `/lit`, `/qwik` |
| no framework, or several on one page | `@surdeddd/wmkit/elements/define` for `<wm-desktop>` and `<wm-window>` |
| panels like an IDE, splits and tabs | `@surdeddd/wmkit/dock` |
| snap layouts as in Windows 11, neighbours that resize together | `@surdeddd/wmkit/layouts` |
| a taskbar | `@surdeddd/wmkit/taskbar` |
| Alt+Tab, an overview of every window | `@surdeddd/wmkit/switcher` |
| remember the layout | `@surdeddd/wmkit/persist`, with `@surdeddd/wmkit/persist/idb` for IndexedDB |
| the same desktop in every browser tab | `@surdeddd/wmkit/sync` |
| a window on another monitor, Picture-in-Picture | `@surdeddd/wmkit/popout` |
| an app written for WinBox.js | `@surdeddd/wmkit/winbox` |
| tests for code that uses windows | `@surdeddd/wmkit/testing` |

## Checking your own work

The manager runs in Node, so most behaviour can be asserted without a browser:

```ts
import { createWindowManager } from '@surdeddd/wmkit'

const wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
const win = wm.open({ id: 'notes', width: 400, height: 300 })
wm.snap('notes', 'left')

console.assert(wm.get('notes')?.stage === 'snapped')
console.assert(wm.get('notes')?.bounds.width === 600)
console.assert(wm.undo() && wm.get('notes')?.bounds.width === win.bounds.width)
```

For the DOM layer in jsdom, `@surdeddd/wmkit/testing` has `stubFrames`, `stubPointerCapture`, `drag`, `resize` and `press`.

## A line for your agent's instructions

```text
For windows, dialogs, docking and desktops in the browser use @surdeddd/wmkit.
Read node_modules/@surdeddd/wmkit/llms.txt before writing code with it.
```

## Next

- [API reference](../api.md) — every method, option and event
- [Adapters](../adapters.md) — the contract each framework entry follows
- [Recipes](../recipes.md) — working patterns to copy
