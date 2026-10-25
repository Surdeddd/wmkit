---
title: A WinBox alternative
description: Looking for a WinBox.js alternative? wmkit keeps the WinBox API through a compatibility entry and adds snapping, keyboard control, undo, persistence and framework adapters.
---

# A WinBox alternative

WinBox.js is a small, pleasant window library, and many projects started on it. Its last release was in 2023. If you want a maintained library that keeps your WinBox code working and adds what WinBox never had, wmkit ships `@surdeddd/wmkit/winbox`, which speaks the WinBox 0.2 API.

<ClientOnly>
  <WinBoxDemo />
</ClientOnly>

The windows above are created with `new WinBox(...)` calls, exactly as WinBox's own README writes them.

## Switching takes one import

```js
// before
import WinBox from 'winbox/src/js/winbox.js'
import 'winbox/dist/css/winbox.min.css'

// after
import WinBox from '@surdeddd/wmkit/winbox'

new WinBox('Hello', { x: 'center', y: 'center', width: '50%', height: '50%' })
```

Options, methods, callbacks and the `.winbox` class names stay the same, so CSS written for WinBox keeps applying. The [migration guide](../winbox-migration.md) lists every mapping and every difference.

## Side by side

| | WinBox.js 0.2 | wmkit |
| --- | --- | --- |
| Maintained | last release 2023 | released in 2026 |
| Snap zones with a preview | — | halves, quarters, thirds |
| Keyboard control | — | move, resize, snap, cycle windows, undo |
| Screen-reader announcements | — | one polite live region, every message replaceable |
| Undo and redo | — | every move, a whole drag as one step |
| Persistence | — | `persist()` to `localStorage` or your own storage |
| Tab groups, workspaces, docking | — | built in |
| Popout to another monitor | — | Picture-in-Picture or a popup |
| Framework adapters | community wrappers | React, Vue, Svelte, Solid, Angular, Preact, Lit, Qwik, web components |
| Your own markup | its own DOM | any markup, or the WinBox DOM through the compat entry |
| TypeScript | community types | strict, shipped |
| Size (brotli) | 5.4 kB | about 19 kB for the compat entry with the manager inside |

WinBox is still the lighter option when you need none of the above. The size difference pays for the behaviour in the rest of the table.

## Beyond the compat entry

The compat entry is a way in. `WinBox.manager()` hands you the underlying window manager, so the rest of wmkit is one call away:

```js
import WinBox from '@surdeddd/wmkit/winbox'
import { persist } from '@surdeddd/wmkit/persist'

persist(WinBox.manager(), { key: 'my-desktop' })
```

When the time comes to move to your own markup or to a framework, the [adapters](../adapters.md) keep the same manager under a React, Vue, Svelte, Solid, Angular, Preact, Lit or Qwik component tree.

## Next

- [Migrating from WinBox](../winbox-migration.md) — every option, method and callback mapped
- [A draggable, resizable window in React](../guides/react-draggable-resizable-window.md)
- [API reference](../api.md)
