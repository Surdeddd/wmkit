---
title: Window manager with web components
description: Draggable, resizable windows in plain HTML with the wm-desktop and wm-window custom elements of wmkit — no framework and no build step required, with snapping, keyboard control, themes and a saved layout.
---

# A window manager in plain HTML

Two custom elements are the whole integration: `<wm-desktop>` is the area, `<wm-window>` is a window in it. They work in a static page, in a server-rendered template, inside any framework and in several frameworks at once, because the contract is HTML.

## The whole page

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

Every window drags by its titlebar, resizes from eight sides, snaps to halves, quarters and thirds, minimizes, maximizes and closes, and answers the keyboard. `persist="my-desktop"` saves the layout to `localStorage` and restores it on the next visit. The children of a window stay in the light DOM, so your styles and your scripts reach them as usual.

## Attributes are the API

| On `<wm-window>` | Meaning |
| --- | --- |
| `window-id` | a stable id; needed for a layout that survives a reload |
| `label` | the title |
| `x`, `y`, `width`, `height` | the starting geometry |
| `stage` | `normal`, `minimized`, `maximized`; follows the window and can be set |
| `closed` | the window is closed while the attribute is there |

The elements fire `wm-open`, `wm-close`, `wm-move`, `wm-resize`, `wm-stage` and `wm-focus`, each with the window in `detail`, and `wm-beforeclose` can be cancelled to keep a window open:

```html
<script type="module">
  document.querySelector('wm-desktop').addEventListener('wm-beforeclose', (event) => {
    if (event.detail.window.id === 'notes') event.preventDefault()
  })
</script>
```

## The manager is still there

`desktop.manager` is the same state machine every other entry uses, so anything the attributes do not cover is one call away:

```html
<button id="tile" type="button">Side by side</button>

<script type="module">
  const desktop = document.querySelector('wm-desktop')
  document.querySelector('#tile').addEventListener('click', () => {
    desktop.manager.snap('notes', 'left')
    desktop.manager.snap('chart', 'right')
  })
</script>
```

The manager exists once the element is connected; `wm-ready` on the desktop announces it with `detail.manager` for code that runs earlier.

## Style the frame

The frame of a window lives in a shadow root and exposes parts: `titlebar`, `title`, `control`, `content`, `tabs`, `tab`. Style them with `::part()`, or hand the desktop a whole theme:

```html
<script type="module">
  import { retroShadowTheme } from '@surdeddd/wmkit/themes'

  document.querySelector('wm-desktop').styles = retroShadowTheme
</script>
```

## A taskbar element

`<wm-taskbar for="desk">` from `@surdeddd/wmkit/taskbar/define` lists the windows of the desktop with that id as buttons. It brings behaviour and accessibility and leaves the look to your CSS.

## Next

- [Adapters](../adapters.md#web-components) — every attribute, property, part and event
- [Theming](../theming.md) — sixteen themes and the tokens they are made of
- [wmkit for AI coding agents](./ai-coding-agents.md) — the short version for a model
