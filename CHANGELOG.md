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
