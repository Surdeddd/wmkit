# Browser support

wmkit ships ES2022 (`target: es2022` in tsup), ESM + CJS, no polyfills and no runtime dependencies. The floor is set by the platform APIs each layer touches, not by the syntax — so the answer differs depending on how much of the package you actually import.

## Supported baselines

| What you import | Chrome / Edge | Safari | Firefox | Set by |
| --- | --- | --- | --- | --- |
| core state machine, without named layouts | 94 | 15.4 | 93 | the ES2022 build target |
| core with `saveLayout` / `getLayout` / `setLayout` | 98 | 15.4 | 94 | `structuredClone` |
| `attachDesktop` (drag, resize, snap, keyboard, a11y) | 98 | 15.4 | 94 | ES2022 and `structuredClone` still dominate |
| `themes/glass.css`, `themes/light.css` | 111 | 16.2 | 113 | `color-mix()` in the snap preview |
| `themes/retro.css` | 98 | 15.4 | 94 | plain borders and gradients only |
| `@surdeddd/wmkit/persist` | 98 | 15.4 | 94 | same as core; a missing or throwing `localStorage` makes it a no-op |
| `@surdeddd/wmkit/popout` | 98 | 15.4 | 94 | a `window.open` popup everywhere; picture-in-picture needs Chrome/Edge 116+ or Firefox 151+ |
| `@surdeddd/wmkit/dock` | 98 | 15.4 | 94 | same as `attachDesktop`; `MutationObserver` marks late windows |

The adapters add whatever their framework requires and nothing else: React >= 18, Vue >= 3.3, Svelte >= 4, Solid >= 1.8, Angular >= 16.

The DOM APIs the controller needs — pointer capture, `ResizeObserver`, `requestAnimationFrame` — all landed years before the ES2022 target, so they never set the floor in practice.

**Practical summary:** the library works in every browser from early 2022 onward; importing a bundled glass theme raises that to spring 2023. Style the windows yourself and the theme row disappears entirely.

## Platform APIs, and what happens without them

| API | Used by | Missing behaviour |
| --- | --- | --- |
| Pointer Events + `setPointerCapture` | `src/dom/drag.ts`, `src/dom/resize.ts`, dock separators | no drag or resize; keyboard control and the core still work |
| `ResizeObserver` | `attachDesktop` viewport tracking | throws on attach — pass `autoViewport: false` and drive `wm.setViewport()` yourself |
| `requestAnimationFrame` | pointer batching in drag and resize | required |
| `structuredClone` | named layouts in `src/core/manager.ts` | `saveLayout`/`getLayout`/`setLayout` throw; every other core method is unaffected |
| `Element.animate` | FLIP minimize and restore ghosts | feature-detected — the animation is skipped, state still changes |
| `Element.moveBefore` | skin rebuilds in `src/dom/controller.ts` | feature-detected — content moves with `append`, so an `iframe` inside a rebuilt window reloads (Chromium 133+ keeps it running) |
| `matchMedia` | coarse-pointer and reduced-motion detection | feature-detected — falls back to fine-pointer defaults |
| `localStorage` | `persist` default storage | read inside a `try`/`catch`; the plugin becomes a no-op, or pass your own storage |
| `document.adoptedStyleSheets` | `popout` style copying | guarded — only `document.styleSheets` are copied |
| `documentPictureInPicture` | `popout` (`target: 'pip'`, and `'auto'` when present) | `'auto'` falls back to a popup; `isPopoutSupported('pip')` returns `false` |
| `window.open` | `popout` (`target: 'window'`) | `isPopoutSupported()` returns `false` when neither kind exists; `popout()` rejects with a clear error |
| `getScreenDetails` (Window Management API) | `popout` `screen` option, `listScreens()` | feature-detected — the popup opens at the browser's default position and `listScreens()` resolves `null`; the same happens when the permission is denied |

Nothing in `src/core` touches `window` or `document`, so the manager can be created, mutated, serialized and hydrated during SSR. Only `attachDesktop` and the adapters' bind helpers need a document — call them after mount.

## CSS features in the bundled themes

| Feature | Where | Fallback |
| --- | --- | --- |
| `color-mix()` | snap preview fill and border (`glass.css`, `light.css`) | the preview renders unstyled; override `[data-wm-snap-preview]` with a static colour |
| `backdrop-filter` | window and titlebar blur | degrades to a flat translucent panel |
| `contain: layout style` | window element | a perf hint only |
| individual `translate` / `scale` properties | open and modal-blocked keyframes | the animation is skipped |
| `prefers-reduced-motion` | every theme | fewer animations, never more |

All themes are pure custom properties over `data-wm-*` attributes, so replacing a theme with your own CSS removes every requirement in this table.

## Tested matrix

CI runs the full end-to-end suite on every push against:

- Chromium (Playwright `Desktop Chrome`)
- Firefox (Playwright `Desktop Firefox`)
- WebKit (Playwright `Desktop Safari`)
- Mobile Chromium (Playwright `Pixel 7`, touch and coarse pointer)

Unit tests run in Node, with jsdom for the adapter and DOM smoke tests.

## Touch and pointer

Coarse pointers (`pointer: coarse`) automatically get larger resize hit areas (16 px edges, 24 px corners instead of 8 and 12), a wider snap threshold (20 px instead of 12), bigger snap corners (96 px instead of 64) and a 12 px magnetism threshold instead of 8. Override any of it through `hitAreas`, `snap` and `magnetism` in `attachDesktop`.

Titlebar context menus fire on right click and on long press, so `onTitlebarContextMenu` works the same on both input types.

## Known gaps

- `popout` opens a popup in every engine; picture-in-picture exists in Chrome and Edge 116+ and Firefox 151+, on desktop only. Check `isPopoutSupported()` before showing the control, since a browser can disable both.
- Named layouts need `structuredClone`. If you must support older engines, ship a polyfill or avoid the layout API and store `serialize()` output yourself.
- Visual regression baselines are generated on macOS and skipped in CI, so rendering differences are caught by hand, not by the pipeline.
