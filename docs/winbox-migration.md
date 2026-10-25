# Migrating from WinBox

`@surdeddd/wmkit/winbox` speaks the WinBox.js 0.2 API, so an app moves over by changing one import. Under it runs the wmkit manager, which brings snapping, keyboard control, screen-reader announcements, undo and persistence along.

## Three steps

1. Install: `npm i @surdeddd/wmkit`.
2. Swap the import:
   ```js
   // before
   import WinBox from 'winbox/src/js/winbox.js'
   import 'winbox/dist/css/winbox.min.css'
   // after
   import WinBox from '@surdeddd/wmkit/winbox'
   ```
3. Delete the WinBox stylesheet import. A WinBox-like look is injected once (`<style data-wmkit-winbox>`); call `WinBox.configure({ styles: false })` before the first window to bring your own.

Every way of opening a window keeps working: `new WinBox(title, options)`, `new WinBox(options)`, `WinBox.new(...)` and `WinBox(...)` without `new`.

## What maps to what

| WinBox | wmkit |
| --- | --- |
| `id`, `title`, `width`, `height`, `x`, `y` (`px`, `%`, `"center"`, `"right"`, `"bottom"`) | the same, resolved against the window area |
| `minwidth`, `minheight`, `maxwidth`, `maxheight` | `minSize` / `maxSize` of the window |
| `modal` | `layer: 'modal'` plus a backdrop; the windows below take no input |
| `max`, `min`, `hidden` | start maximized, minimized or hidden |
| `mount`, `html`, `url` | node moved in (and back on close), `innerHTML`, an `iframe` |
| `top`, `right`, `bottom`, `left` | the area the windows live in; snapping and maximize respect it |
| `overflow` | windows may leave the area |
| `background`, `border`, `icon`, `class` | the same; control classes `no-min`, `no-max`, `no-full`, `no-close`, `no-resize`, `no-move`, `no-header`, `no-shadow`, `no-animation` |
| `autosize` | size to the content once it is in |
| `oncreate`, `onclose(force)` (a truthy return vetoes), `onfocus`, `onblur`, `onmove(x, y)`, `onresize(w, h)`, `onminimize`, `onmaximize`, `onrestore`, `onfullscreen`, `onhide`, `onshow` | the same, with the instance as `this` |
| `mount`, `unmount`, `setUrl`, `setTitle`, `setIcon`, `setBackground`, `move`, `resize`, `close(force)`, `focus`, `blur`, `hide`, `show`, `minimize`, `maximize`, `fullscreen`, `restore`, `addClass`, `removeClass`, `hasClass`, `toggleClass`, `addControl`, `removeControl` | the same, chainable |
| `x`, `y`, `width`, `height`, `minwidth` … (writable), `min`, `max`, `full`, `hidden`, `focused` | the same |
| `WinBox.stack()` | open windows in focus order, the focused one last |

The markup keeps WinBox's class names — `.winbox` with the `focus`, `min`, `max`, `full`, `hide` and `modal` state classes, `.wb-header`, `.wb-control` (`.wb-min`, `.wb-max`, `.wb-full`, `.wb-close`), `.wb-drag`, `.wb-icon`, `.wb-title`, `.wb-body` — so CSS written for WinBox keeps applying.

## What is different

- **Snapping and keyboard control are on.** Drag a window to an edge to snap it, use the arrow keys on a focused window. Turn either off with `WinBox.configure({ snap: false, keyboard: false })`. Grouping windows into tabs is off by default and comes back with `grouping: true`.
- **Minimized windows** wait in a strip of title buttons along the bottom edge; a click restores them.
- **`top`/`right`/`bottom`/`left` belong to a desktop, not a window.** Windows created with the same set share one desktop; another set gets its own. Positions are measured inside that area.
- **`index`** is ignored: stacking is the manager's job.
- **`html`** writes `innerHTML`, as in WinBox. Pages that enforce Trusted Types or a strict CSP should pass `mount` instead.
- **Size.** The compat entry is about 19 kB brotli with the manager inside it; `winbox.bundle.min.js` 0.2.82 is 5.4 kB. The difference pays for snapping, undo, persistence, keyboard control, focus management and the screen-reader layer — if you need none of those, WinBox stays the lighter choice.

## Going further

`WinBox.manager(root?)` returns the underlying `WindowManager`, so the rest of wmkit is one call away:

```js
import WinBox from '@surdeddd/wmkit/winbox'
import { persist } from '@surdeddd/wmkit/persist'

persist(WinBox.manager(), { key: 'my-desktop' })
new WinBox('Notes', { width: 400, height: 300 })
```
