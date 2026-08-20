# [0.11.0](https://github.com/Surdeddd/wmkit/compare/v0.10.0...v0.11.0) (2026-08-20)


### Features

* **site:** grow the builder into a window designer ([e4b6cb8](https://github.com/Surdeddd/wmkit/commit/e4b6cb8651a6430b86477e7b475d11f4c72bbf26))

# [0.10.0](https://github.com/Surdeddd/wmkit/compare/v0.9.2...v0.10.0) (2026-08-20)


### Bug Fixes

* **dom:** find a shadow window's titlebar by geometry, not by elementFromPoint ([ef9a214](https://github.com/Surdeddd/wmkit/commit/ef9a2140aa6ac0accd94c9eb7ff67f7df582b77e))
* **dom:** make a shadow window answer its own chrome ([8fb03fd](https://github.com/Surdeddd/wmkit/commit/8fb03fdd88eeabd430c2cc2ebba4a059444b3f9a))
* **dom:** six ways a mounted window came apart ([5f5394b](https://github.com/Surdeddd/wmkit/commit/5f5394b764d995da643dd971c29d4a95f313bf0a))
* **site:** switch themes without a frame of no theme at all ([1f94b33](https://github.com/Surdeddd/wmkit/commit/1f94b33afcb4cb6b08c3e1155d6a8ac840b4cd87))


### Features

* **site:** put the skin constructor in the hero, and label what it builds ([7a54009](https://github.com/Surdeddd/wmkit/commit/7a54009d044bff4912977b92dccdece811c3801c))
* **site:** put the window builder on the page itself ([9649c79](https://github.com/Surdeddd/wmkit/commit/9649c79ba68c54b35e3566aea1f850e670482226))

## [0.9.2](https://github.com/Surdeddd/wmkit/compare/v0.9.1...v0.9.2) (2026-08-20)


### Bug Fixes

* **site:** stop the desktop from covering the landing copy, and settle the contrast gate ([9c0364d](https://github.com/Surdeddd/wmkit/commit/9c0364d84bd458e7049242cde3bf8d64e919a06c))
* **themes:** make every shipped theme readable, and measure it from now on ([98ebc91](https://github.com/Surdeddd/wmkit/commit/98ebc91ba51e3de4e962803728a7f7a104e79110))

## [0.9.1](https://github.com/Surdeddd/wmkit/compare/v0.9.0...v0.9.1) (2026-08-19)


### Bug Fixes

* **site:** lead the skins app with the constructor instead of burying it ([aebe480](https://github.com/Surdeddd/wmkit/commit/aebe480494ecd7812dfb1f55968f4f70f37ba811))

# [0.9.0](https://github.com/Surdeddd/wmkit/compare/v0.8.0...v0.9.0) (2026-08-19)


### Bug Fixes

* **dom:** rebuild a window outside the sync pass and unregister it before releasing ([881f2fe](https://github.com/Surdeddd/wmkit/commit/881f2feeeb2c52ce1e6ebc5c53ad9acc94c9369c))
* **themes:** make a shipped theme actually usable inside a shadow root ([a71495f](https://github.com/Surdeddd/wmkit/commit/a71495f5d74e40508c79f131269ea9d5895dc6ea))


### Features

* **chrome:** build a window from a template string ([068bf61](https://github.com/Surdeddd/wmkit/commit/068bf61362adcd78054aa8693dd6f7dd0381727e))
* **chrome:** isolate a skin in a shadow root without losing grouping, focus or the accessible name ([e063c15](https://github.com/Surdeddd/wmkit/commit/e063c15bc6b34ef709627709ae2230a3f2bf7fe9))
* **dom:** drive snap, restore, centre, back and workspace from window attributes ([16c9932](https://github.com/Surdeddd/wmkit/commit/16c9932874ac8541ecd9e6b67f1ba249588e2032))
* **dom:** expose the window actions as a typed object ([96dfed0](https://github.com/Surdeddd/wmkit/commit/96dfed0fc736327dfe068065dd5c9248c08946c2))
* **dom:** keep the title node in step with the window title ([3f7d876](https://github.com/Surdeddd/wmkit/commit/3f7d876c48d6dbd6a1405c15df69753fc2dcc0f5))
* **dom:** mount a window from a skin and rebuild it when the skin changes ([590af92](https://github.com/Surdeddd/wmkit/commit/590af92d9825d01c6bebd89e8184dea945602801))
* **site:** build a window skin in the demo ([63394c8](https://github.com/Surdeddd/wmkit/commit/63394c84aff6f9525e7d23e374d43a9a954f85bd))

# [0.8.0](https://github.com/Surdeddd/wmkit/compare/v0.7.2...v0.8.0) (2026-08-14)


### Bug Fixes

* **build:** declare the new subpaths for node10 type resolution ([cff9fc6](https://github.com/Surdeddd/wmkit/commit/cff9fc61e167a8e6061499adef7ee2ee5282784e))


### Features

* **devtools:** ship a panel that shows what the manager is doing ([8f69320](https://github.com/Surdeddd/wmkit/commit/8f6932031eebafdf636298ea298a04b9650c5e1e))
* **dom:** pinch a window to resize it and swipe two fingers to change workspace ([c27feab](https://github.com/Surdeddd/wmkit/commit/c27feab42fb0e4edb0036a8f00cd04734f1a1b49))
* **themes:** dress a single window with a variant and ship thirteen more themes ([ab00797](https://github.com/Surdeddd/wmkit/commit/ab0079797acf94dbb8ce2917323053152c3e2da5))

## [0.7.2](https://github.com/Surdeddd/wmkit/compare/v0.7.1...v0.7.2) (2026-08-14)


### Bug Fixes

* **adapters:** let an element bind again when its window comes back ([6dcae7a](https://github.com/Surdeddd/wmkit/commit/6dcae7a99aca3e3f42cf4d15724b911bd242cc03))

## [0.7.1](https://github.com/Surdeddd/wmkit/compare/v0.7.0...v0.7.1) (2026-08-14)


### Bug Fixes

* **dom:** keep the rendered desktop in step with the state it renders ([64a85d6](https://github.com/Surdeddd/wmkit/commit/64a85d6ace6f3304aa9f7dd9da9150059dc49374))

# [0.7.0](https://github.com/Surdeddd/wmkit/compare/v0.6.1...v0.7.0) (2026-08-14)


### Features

* **core:** give a tab group a real tab order with moveTab and cycleTab ([862dd42](https://github.com/Surdeddd/wmkit/commit/862dd429ba8dae88e2593c7e8989237210c31511))

## [0.6.1](https://github.com/Surdeddd/wmkit/compare/v0.6.0...v0.6.1) (2026-08-13)


### Bug Fixes

* **site:** hide the boot overlay instead of only fading it out ([bc32e7a](https://github.com/Surdeddd/wmkit/commit/bc32e7a1c9d657ee0a1b4e21d798c12dba79c94d))

# [0.6.0](https://github.com/Surdeddd/wmkit/compare/v0.5.1...v0.6.0) (2026-08-13)


### Bug Fixes

* **core:** size a tab group's frame for every member, not just the one that moved ([306887f](https://github.com/Surdeddd/wmkit/commit/306887f8a3d27bc293ea0d8374c46b55d4680da6))
* **site:** compose the demo for every width instead of only the widest ([511d852](https://github.com/Surdeddd/wmkit/commit/511d8521673bc9d0faacdacd10191de26a169225))


### Features

* **dom:** make the desktop configurable and fix what the themes hid ([0993f2f](https://github.com/Surdeddd/wmkit/commit/0993f2f06d79ecc50a392f15d0964db47a37bc84))


### Performance Improvements

* make stacking and bulk operations scale to large desktops ([04c2909](https://github.com/Surdeddd/wmkit/commit/04c290931fb0a0bc1fa89a4f748f417aeb683c4e))

## [0.5.1](https://github.com/Surdeddd/wmkit/compare/v0.5.0...v0.5.1) (2026-07-31)


### Bug Fixes

* **groups:** close the tab group defects found by the third audit wave ([97b3f22](https://github.com/Surdeddd/wmkit/commit/97b3f2255fb5a4bfcc8625dfad8e73c3863f5320))

# [0.5.0](https://github.com/Surdeddd/wmkit/compare/v0.4.2...v0.5.0) (2026-07-31)


### Features

* tab groups — several windows sharing one frame ([c4900aa](https://github.com/Surdeddd/wmkit/commit/c4900aac412084c4a566c31aecd105d3e2080504))

## [0.4.2](https://github.com/Surdeddd/wmkit/compare/v0.4.1...v0.4.2) (2026-07-31)


### Bug Fixes

* repair 32 defects found by a second audit of the 0.4 code ([3eef29b](https://github.com/Surdeddd/wmkit/commit/3eef29b810271ce922ff6f9b6561bd18ba447941))

## [0.4.1](https://github.com/Surdeddd/wmkit/compare/v0.4.0...v0.4.1) (2026-07-26)


### Bug Fixes

* **dom:** stop a header drag handle from leaking a banner landmark, and document the platform contract ([3fa22ac](https://github.com/Surdeddd/wmkit/commit/3fa22acc8b889b435f3b1bba5b52f4284305361b))

# [0.4.0](https://github.com/Surdeddd/wmkit/compare/v0.3.0...v0.4.0) (2026-07-26)


### Features

* workspaces, snap thirds, aspect ratio lock, keyboard snap and history shortcuts, versioned persistence, rebuilt demo ([64fa225](https://github.com/Surdeddd/wmkit/commit/64fa22548e9975222412ed62c31749b317c096d9))

# [0.3.0](https://github.com/Surdeddd/wmkit/compare/v0.2.0...v0.3.0) (2026-07-18)


### Features

* window magnetism, undo/redo history, named layouts, arrange commands, Angular adapter, reverse FLIP restore, light and retro themes, titlebar context menu hook, perf benchmarks in CI, visual regression baselines ([b99ae0d](https://github.com/Surdeddd/wmkit/commit/b99ae0d8e70a61fb4a4f6da31d110babf9cb6681))

# [0.2.0](https://github.com/Surdeddd/wmkit/compare/v0.1.1...v0.2.0) (2026-07-17)


### Features

* **dom:** adaptive touch hit areas, removeOnClose attach option, per-session rect caching and will-change ([5b3e236](https://github.com/Surdeddd/wmkit/commit/5b3e23624f014f9f23ce00c16ce388ee9a1e79d7))

## [0.1.1](https://github.com/Surdeddd/wmkit/compare/v0.1.0...v0.1.1) (2026-07-13)


### Bug Fixes

* **core:** atomic state transactions, id generation after hydrate, Infinity-safe max size serialization, modal focus on hydrate/promote, full stage restore on drag cancel ([8059de6](https://github.com/Surdeddd/wmkit/commit/8059de6f22f93808c00100743fe171b145f9958e))

# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/). Releases are automated with [semantic-release](https://github.com/semantic-release/semantic-release) — every push to main with releasable commits publishes to npm.

## 0.1.0 — 2026-07-10

### Added

- Headless window manager core: serializable state machine with open/close/focus, z-order layers (`normal`/`floating`/`modal`), stages (`normal`/`minimized`/`maximized`/`snapped`), viewport clamping, cascade positioning, batch transactions and granular events
- DOM controller: pointer-capture drag (mouse/touch/pen), 8-direction resize, snap zones with live preview and drag-to-top maximize, Escape cancellation, keyboard move/resize, F6 window cycling, modal focus trap, ARIA roles and `aria-live` announcements, FLIP minimize-to-taskbar animation
- Framework adapters: `@surdeddd/wmkit/react` (hooks on `useSyncExternalStore`), `@surdeddd/wmkit/vue` (composables), `@surdeddd/wmkit/svelte` (stores + actions), `@surdeddd/wmkit/solid` (signals)
- `@surdeddd/wmkit/persist`: pluggable storage persistence with debounce, safe probing and auto-restore
- `@surdeddd/wmkit/popout` *(experimental)*: Document Picture-in-Picture tear-off sharing manager state
- Glass theme (`@surdeddd/wmkit/themes/glass.css`) driven by CSS variables, `prefers-reduced-motion` aware
- Test suite: 121 unit tests with 100% coverage of the core and persistence; 160+ Playwright scenarios across Chromium, WebKit and mobile emulation including touch, stress and axe accessibility audits
- Bilingual (EN/RU) landing page with a live wmkit desktop, deployed via GitHub Pages
