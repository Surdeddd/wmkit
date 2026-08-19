# wmkit documentation

Headless window manager for the web. The [root README](../README.md) is the tour; these pages are the reference.

| Page | What is in it |
| --- | --- |
| [API reference](./api.md) | every export, option, method, event and type |
| [Adapters](./adapters.md) | complete React, Vue, Svelte, Solid and Angular integrations |
| [Theming](./theming.md) | `data-wm-*` contract, CSS variables, writing a theme from scratch |
| [Recipes](./recipes.md) | building a window from scratch, taskbar, modals, persistence, workspaces, SSR, testing |
| [Browser support](./browser-support.md) | baselines per entry point and what degrades where |

## Mental model

Three layers, each usable on its own:

```text
createWindowManager()   state machine — bounds, stacking, stages, focus, history. No DOM.
attachDesktop()         DOM controller — pointer, keyboard, ARIA, snap preview, animations.
adapters                ~60 lines each — wire the two above into a framework lifecycle.
```

The manager never reads or writes the DOM, so it runs in Node and during SSR. The controller never renders content — it moves and labels elements you already own. Window content therefore stays in your component tree: no `innerHTML`, no portals, no re-parenting.

## Vocabulary

| Term | Meaning |
| --- | --- |
| **window** | an entry in the manager: id, bounds, stage, layer, workspace, flags, `meta` |
| **stage** | `normal`, `minimized`, `maximized` or `snapped` — mutually exclusive |
| **layer** | `normal` < `floating` (always on top) < `modal` (blocks focus below) |
| **workspace** | a virtual desktop index; only one is active at a time |
| **zone** | a snap target: halves, quarters or thirds of the viewport |
| **desktop** | the element you pass to `attachDesktop`; it is the coordinate space |
| **interaction** | a live gesture grouped into one undo entry |

## Install

```bash
pnpm add @surdeddd/wmkit
```

Entry points: `.` (core + DOM), `./react`, `./vue`, `./svelte`, `./solid`, `./angular`, `./persist`, `./popout`, `./themes/*.css`. ESM and CJS, types per condition, zero dependencies.
